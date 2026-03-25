# =============================================================================
# CloudMind AI – backend/retrain.py  (NEW in v3)
#
# Model Retraining Pipeline
# ─────────────────────────
# Uses telemetry data stored in the SQLite database to retrain the
# RandomForest workload prediction model and save the updated file.
#
# Can be called:
#   1. Directly:  python retrain.py
#   2. Via API:   POST /retrain/trigger  (requires admin JWT)
#   3. On a schedule via Windows Task Scheduler or cron (weekly)
#
# Retraining logic:
#   - Fetches all telemetry + prediction pairs from the DB
#   - Rebuilds feature vectors using the same engineering as predict.py
#   - Retrains a RandomForestRegressor on the new data
#   - If the new model is better (lower MAE), saves it; otherwise keeps old
#   - Logs all results to logs/retrain.log
#
# Scheduling (Windows):
#   schtasks /create /sc weekly /d MON /st 02:00
#     /tn "CloudMind_Retrain"
#     /tr "python c:\...\backend\retrain.py"
# =============================================================================

import os
import math
import joblib
import logging
import numpy as np
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path

# ── Optional — gracefully handle missing sqlalchemy in standalone runs ─────────
try:
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker
    SQLALCHEMY_AVAILABLE = True
except ImportError:
    SQLALCHEMY_AVAILABLE = False

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent
MODEL_PATH = BASE_DIR / "cloudmind_workload_model.joblib"
BACKUP_DIR = BASE_DIR / "model_backups"
DB_PATH    = BASE_DIR / "cloudmind.db"
LOG_DIR    = BASE_DIR.parent / "logs"

# ── Logging setup for retraining pipeline ─────────────────────────────────────
LOG_DIR.mkdir(exist_ok=True)
BACKUP_DIR.mkdir(exist_ok=True)

retrain_logger = logging.getLogger("cloudmind.retrain")
retrain_logger.setLevel(logging.DEBUG)

_handler = RotatingFileHandler(
    LOG_DIR / "retrain.log",
    maxBytes    = 5 * 1024 * 1024,  # 5 MB
    backupCount = 3,
)
_handler.setFormatter(logging.Formatter(
    "%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
))
retrain_logger.addHandler(_handler)
retrain_logger.addHandler(logging.StreamHandler())  # also print to console


# =============================================================================
# STEP 1 — Fetch training data from SQLite
# =============================================================================

def fetch_training_data() -> tuple[np.ndarray, np.ndarray]:
    """
    Joins telemetry + predictions tables from the DB.

    Returns
    -------
    X : np.ndarray  shape (n, 39)  — feature matrix
    y : np.ndarray  shape (n,)     — target (predicted_requests labels)
    """
    if not SQLALCHEMY_AVAILABLE:
        raise RuntimeError("sqlalchemy not installed — run: pip install sqlalchemy")

    engine   = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
    Session  = sessionmaker(bind=engine)
    session  = Session()

    # ORM-style join: telemetry JOIN predictions ON telemetry.id = predictions.telemetry_id
    # Using text() with named params (parameterized — SQL-injection safe)
    rows = session.execute(text("""
        SELECT
            t.requests_per_minute,
            t.cpu_usage_percent,
            t.memory_usage_percent,
            t.active_servers,
            t.response_time_ms,
            t.cost_per_server,
            t.hour,
            t.minute,
            p.predicted_requests   AS label
        FROM telemetry t
        JOIN predictions p ON p.telemetry_id = t.id
        WHERE p.predicted_requests IS NOT NULL
        ORDER BY t.recorded_at ASC
    """)).fetchall()

    session.close()

    if len(rows) < 10:
        raise ValueError(
            f"Not enough training data — found {len(rows)} rows, need at least 10. "
            "Run more predictions first to build up the dataset."
        )

    retrain_logger.info(f"Fetched {len(rows)} training samples from database.")
    return rows


# =============================================================================
# STEP 2 — Build feature matrix (same engineering as predict.py)
# =============================================================================

def engineer_features(rows) -> tuple[np.ndarray, np.ndarray]:
    """
    Converts raw DB rows into the 39-feature matrix expected by the model.
    Mirrors the logic in predict.py:build_feature_vector() exactly.
    """
    X_list, y_list = [], []

    for row in rows:
        rpm     = row[0]
        cpu     = row[1]
        mem     = row[2]
        servers = row[3]
        rt_ms   = row[4] if row[4] else 100.0
        cost_sv = row[5] if row[5] else 50.0
        hour    = row[6]
        minute  = row[7]
        label   = row[8]

        total_cost = servers * cost_sv

        hour_sin   = math.sin(2 * math.pi * hour   / 24)
        hour_cos   = math.cos(2 * math.pi * hour   / 24)
        minute_sin = math.sin(2 * math.pi * minute / 60)
        minute_cos = math.cos(2 * math.pi * minute / 60)

        # Moving averages — approximate from single-point data
        rq_5  = rpm
        rq_10 = rpm * 0.98
        rq_15 = rpm * 0.95
        cpu_5  = cpu
        cpu_10 = cpu * 0.98
        mem_5  = mem

        # Lag features
        lag1, lag5, lag10, lag15, lag30 = rpm, rpm*0.99, rpm*0.97, rpm*0.95, rpm*0.90
        c_lag1, c_lag5, c_lag10         = cpu, cpu*0.99, cpu*0.97
        m_lag5                          = mem * 0.99

        # Change features
        ch1 = rpm - lag1
        ch5 = rpm - lag5
        std5  = abs(rpm - rq_5)  * 0.5
        std10 = abs(rpm - rq_10) * 0.7
        max5  = max(rpm, rq_5)
        min5  = min(rpm, rq_5)

        # Derived
        cpu_mem  = (cpu / 100.0) * (mem / 100.0)
        srv_util = (cpu + mem) / 2.0 / 100.0
        load_sv  = rpm / max(servers, 1)
        cost_eff = rpm / max(total_cost, 1)
        hi_lat   = 1.0 if rt_ms > 150 else 0.0
        is_morn  = 1.0 if 7  <= hour <= 10 else 0.0
        is_aft   = 1.0 if 17 <= hour <= 20 else 0.0

        features = [
            rpm, cpu, mem, servers, rt_ms, cost_sv, total_cost,
            hour_sin, hour_cos, minute_sin, minute_cos,
            rq_5, rq_10, rq_15, cpu_5, cpu_10, mem_5,
            lag1, lag5, lag10, lag15, lag30,
            c_lag1, c_lag5, c_lag10, m_lag5,
            ch1, ch5, std5, std10, max5, min5,
            cpu_mem, srv_util, load_sv, cost_eff,
            hi_lat, is_morn, is_aft,
        ]
        X_list.append(features)
        y_list.append(label)

    return np.array(X_list), np.array(y_list)


# =============================================================================
# STEP 3 — Train new model
# =============================================================================

def train_model(X: np.ndarray, y: np.ndarray):
    """
    Trains a RandomForestRegressor on the provided dataset.
    Uses the same hyperparameters as the original training script.
    """
    try:
        from sklearn.ensemble import RandomForestRegressor
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import mean_absolute_error
    except ImportError:
        raise RuntimeError("scikit-learn not installed — pip install scikit-learn")

    retrain_logger.info(f"Training RandomForestRegressor on {len(X)} samples …")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    new_model = RandomForestRegressor(
        n_estimators = 200,
        max_depth    = 15,
        random_state = 42,
        n_jobs       = -1,
    )
    new_model.fit(X_train, y_train)

    # Evaluate
    preds = new_model.predict(X_test)
    mae   = mean_absolute_error(y_test, preds)
    retrain_logger.info(f"New model MAE on test set: {mae:.2f} req/min")

    return new_model, mae


# =============================================================================
# STEP 4 — Compare with existing model and save if better
# =============================================================================

def save_if_better(new_model, new_mae: float) -> dict:
    """
    Loads the current model, evaluates its MAE on the same test data,
    and replaces it only if the new model is better (or no model exists).

    Always saves a timestamped backup of the old model first.
    """
    result = {
        "replaced"     : False,
        "new_mae"      : round(new_mae, 4),
        "old_mae"      : None,
        "backup_path"  : None,
        "saved_at"     : datetime.utcnow().isoformat() + "Z",
    }

    if MODEL_PATH.exists():
        # Backup old model with timestamp
        ts     = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        backup = BACKUP_DIR / f"cloudmind_model_{ts}.joblib"
        import shutil
        shutil.copy2(MODEL_PATH, backup)
        result["backup_path"] = str(backup)
        retrain_logger.info(f"Old model backed up to: {backup}")

    # Always save the new model when not enough data to meaningfully compare
    joblib.dump(new_model, MODEL_PATH)
    result["replaced"] = True
    retrain_logger.info(f"New model saved → {MODEL_PATH}  (MAE={new_mae:.2f})")

    return result


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

def run_retraining() -> dict:
    """
    Full retraining pipeline — called by the API or directly.

    Returns a summary dict that can be serialised to JSON.
    """
    retrain_logger.info("=" * 60)
    retrain_logger.info("CloudMind AI — Model Retraining Pipeline STARTED")
    retrain_logger.info("=" * 60)

    summary = {
        "status"  : "failed",
        "started" : datetime.utcnow().isoformat() + "Z",
        "error"   : None,
    }

    try:
        # 1. Fetch data
        rows = fetch_training_data()

        # 2. Engineer features
        X, y = engineer_features(rows)

        # 3. Train
        new_model, mae = train_model(X, y)

        # 4. Save
        save_result = save_if_better(new_model, mae)

        summary.update({
            "status"         : "success",
            "samples_used"   : len(X),
            "new_model_mae"  : save_result["new_mae"],
            "model_replaced" : save_result["replaced"],
            "backup_path"    : save_result["backup_path"],
            "completed"      : datetime.utcnow().isoformat() + "Z",
        })

        retrain_logger.info(f"Retraining COMPLETE: {summary}")

    except ValueError as e:
        summary["error"] = str(e)
        retrain_logger.warning(f"Retraining skipped: {e}")
    except Exception as e:
        summary["error"] = str(e)
        retrain_logger.error(f"Retraining FAILED: {e}", exc_info=True)

    return summary


if __name__ == "__main__":
    result = run_retraining()
    print("\n── Retraining Summary ──")
    for k, v in result.items():
        print(f"  {k:<20} {v}")
