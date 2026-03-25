# =============================================================================
# CloudMind AI – predict.py
# Responsibilities:
#   1. Load the trained RandomForest model from disk
#   2. Build the feature vector from incoming telemetry
#   3. Run the ML prediction
#   4. Apply an IMPROVED decision engine that uses:
#        - Historical rolling average
#        - Peak traffic detection
#        - Smarter adaptive thresholds
# =============================================================================

import joblib
import numpy as np
import os
from collections import deque
from logger_config import get_logger

logger = get_logger(__name__)

# ── Path to the saved model (same folder as this file) ───────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), "cloudmind_workload_model.joblib")

# ── Load model once at startup (not on every request) ────────────────────────
try:
    model = joblib.load(MODEL_PATH)
    logger.info(f"Model loaded from: {MODEL_PATH}")
except FileNotFoundError:
    logger.critical(f"Model file not found at: {MODEL_PATH}")
    raise FileNotFoundError(
        f"Model file not found at: {MODEL_PATH}\n"
        "Please copy 'cloudmind_workload_model.joblib' into the backend/ folder."
    )

# ── Feature column order must EXACTLY match what the model was trained on ─────
# These are the 39 features used during training with advanced feature engineering
FEATURE_COLS = [
    "requests_per_minute",
    "cpu_usage_percent",
    "memory_usage_percent",
    "active_servers",
    "response_time_ms",
    "cost_per_server",
    "total_cost",
    "hour_sin",
    "hour_cos",
    "minute_sin",
    "minute_cos",
    "requests_last_5min_avg",
    "requests_last_10min_avg",
    "requests_last_15min_avg",
    "cpu_last_5min_avg",
    "cpu_last_10min_avg",
    "memory_last_5min_avg",
    "requests_lag_1",
    "requests_lag_5",
    "requests_lag_10",
    "requests_lag_15",
    "requests_lag_30",
    "cpu_lag_1",
    "cpu_lag_5",
    "cpu_lag_10",
    "memory_lag_5",
    "requests_change_1min",
    "requests_change_5min",
    "requests_std_5min",
    "requests_std_10min",
    "requests_max_5min",
    "requests_min_5min",
    "cpu_memory_interaction",
    "server_utilisation",
    "load_per_server",
    "cost_efficiency",
    "high_latency_flag",
    "is_morning_peak",
    "is_afternoon_peak",
]

# ── In-memory rolling history for improved decision engine ────────────────────
# Stores the last 30 predicted_requests values (≈ 30 prediction cycles)
_prediction_history: deque = deque(maxlen=30)

# Adaptive threshold constants
OVERLOAD_THRESHOLD   = 300   # req/server — above this = scale up
UNDERLOAD_THRESHOLD  = 120   # req/server — below this = scale down
TARGET_LOAD          = 200   # req/server — healthy target load
PEAK_FACTOR          = 0.15  # 15% above historical avg is considered "peak traffic"
SCALE_DOWN_FACTOR    = 0.20  # 20% below historical avg triggers scale-down
MIN_SERVERS          = 1     # never go below 1 server


def build_feature_vector(data: dict) -> np.ndarray:
    """
    Convert the incoming API request dict into a numpy feature array with all 39 engineered features.

    For fields not directly sent by the user (like lagged features and moving averages),
    we use sensible defaults since real-time streaming data is not available.

    Parameters
    ----------
    data : dict — raw telemetry values from the API request

    Returns
    -------
    np.ndarray of shape (1, 39) — ready for model.predict()
    """
    import math

    # Extract base features
    requests_per_minute  = data["requests_per_minute"]
    cpu_usage_percent    = data["cpu_usage_percent"]
    memory_usage_percent = data["memory_usage_percent"]
    active_servers       = data["active_servers"]
    response_time_ms     = data.get("response_time_ms", 100)
    cost_per_server      = data.get("cost_per_server", 50)
    total_cost           = data.get("total_cost", active_servers * cost_per_server)
    hour                 = data["hour"]
    minute               = data["minute"]

    # Cyclic encoding for hour and minute
    hour_sin   = math.sin(2 * math.pi * hour   / 24)
    hour_cos   = math.cos(2 * math.pi * hour   / 24)
    minute_sin = math.sin(2 * math.pi * minute / 60)
    minute_cos = math.cos(2 * math.pi * minute / 60)

    # Moving averages (default to current values if not provided)
    requests_last_5min_avg  = data.get("requests_last_5min_avg",  requests_per_minute)
    requests_last_10min_avg = data.get("requests_last_10min_avg", requests_per_minute * 0.98)
    requests_last_15min_avg = data.get("requests_last_15min_avg", requests_per_minute * 0.95)
    cpu_last_5min_avg       = data.get("cpu_last_5min_avg",       cpu_usage_percent)
    cpu_last_10min_avg      = data.get("cpu_last_10min_avg",      cpu_usage_percent * 0.98)
    memory_last_5min_avg    = data.get("memory_last_5min_avg",    memory_usage_percent)

    # Lagged features (default to current values with slight decay)
    requests_lag_1  = data.get("requests_lag_1",  requests_per_minute)
    requests_lag_5  = data.get("requests_lag_5",  requests_per_minute * 0.99)
    requests_lag_10 = data.get("requests_lag_10", requests_per_minute * 0.97)
    requests_lag_15 = data.get("requests_lag_15", requests_per_minute * 0.95)
    requests_lag_30 = data.get("requests_lag_30", requests_per_minute * 0.90)
    cpu_lag_1       = data.get("cpu_lag_1",  cpu_usage_percent)
    cpu_lag_5       = data.get("cpu_lag_5",  cpu_usage_percent * 0.99)
    cpu_lag_10      = data.get("cpu_lag_10", cpu_usage_percent * 0.97)
    memory_lag_5    = data.get("memory_lag_5", memory_usage_percent * 0.99)

    # Change/volatility features
    requests_change_1min = requests_per_minute - requests_lag_1
    requests_change_5min = requests_per_minute - requests_lag_5
    requests_std_5min    = abs(requests_per_minute - requests_last_5min_avg) * 0.5
    requests_std_10min   = abs(requests_per_minute - requests_last_10min_avg) * 0.7
    requests_max_5min    = max(requests_per_minute, requests_last_5min_avg)
    requests_min_5min    = min(requests_per_minute, requests_last_5min_avg)

    # Derived/interaction features
    cpu_memory_interaction = (cpu_usage_percent / 100.0) * (memory_usage_percent / 100.0)
    server_utilisation     = (cpu_usage_percent + memory_usage_percent) / 2.0 / 100.0
    load_per_server        = requests_per_minute / max(active_servers, 1)
    cost_efficiency        = requests_per_minute / max(total_cost, 1)
    high_latency_flag      = 1.0 if response_time_ms > 150 else 0.0
    is_morning_peak        = 1.0 if 7 <= hour <= 10  else 0.0
    is_afternoon_peak      = 1.0 if 17 <= hour <= 20 else 0.0

    # Build feature vector in the exact order the model expects
    feature_vector = [
        requests_per_minute,
        cpu_usage_percent,
        memory_usage_percent,
        active_servers,
        response_time_ms,
        cost_per_server,
        total_cost,
        hour_sin,
        hour_cos,
        minute_sin,
        minute_cos,
        requests_last_5min_avg,
        requests_last_10min_avg,
        requests_last_15min_avg,
        cpu_last_5min_avg,
        cpu_last_10min_avg,
        memory_last_5min_avg,
        requests_lag_1,
        requests_lag_5,
        requests_lag_10,
        requests_lag_15,
        requests_lag_30,
        cpu_lag_1,
        cpu_lag_5,
        cpu_lag_10,
        memory_lag_5,
        requests_change_1min,
        requests_change_5min,
        requests_std_5min,
        requests_std_10min,
        requests_max_5min,
        requests_min_5min,
        cpu_memory_interaction,
        server_utilisation,
        load_per_server,
        cost_efficiency,
        high_latency_flag,
        is_morning_peak,
        is_afternoon_peak,
    ]

    return np.array(feature_vector).reshape(1, -1)


def decision_engine(predicted_requests: float, current_servers: int) -> dict:
    """
    IMPROVED scaling decision engine.

    Logic (smarter than v1):
    ──────────────────────────────────────────────────────────────────────────
    1.  Compute historical average from recent predictions (up to 30 samples).
        Falls back to load-based thresholds when history is too short.

    2.  Peak traffic detection:
        If predicted_requests > historical_avg × (1 + PEAK_FACTOR)
        → treat as a spike and proactively SCALE UP

    3.  Significant drop detection:
        If predicted_requests < historical_avg × (1 - SCALE_DOWN_FACTOR)
        → SCALE DOWN aggressively

    4.  Adaptive load-based thresholds (original logic, always a fallback):
        load > OVERLOAD_THRESHOLD  → SCALE UP
        load < UNDERLOAD_THRESHOLD → SCALE DOWN
        otherwise                  → KEEP SAME

    Parameters
    ----------
    predicted_requests : float — ML model output
    current_servers    : int   — currently active servers

    Returns
    -------
    dict with keys: recommended_servers, action, load_per_server, historical_avg
    """

    # Avoid division by zero
    if current_servers <= 0:
        current_servers = 1

    load_per_server = predicted_requests / current_servers

    # ── Compute historical average (requires at least 5 samples) ─────────────
    if len(_prediction_history) >= 5:
        historical_avg = float(np.mean(_prediction_history))
    else:
        historical_avg = predicted_requests  # no history yet, treat as baseline

    # ── Decision logic ─────────────────────────────────────────────────────────

    if predicted_requests > historical_avg * (1 + PEAK_FACTOR) and len(_prediction_history) >= 5:
        # Peak traffic spike detected — scale up preemptively
        recommended_servers = max(current_servers + 1,
                                  int(np.ceil(predicted_requests / TARGET_LOAD)))
        action = "SCALE UP"
        reason = (
            f"Peak traffic detected: {predicted_requests:.0f} req/min "
            f"exceeds historical avg {historical_avg:.0f} by >{PEAK_FACTOR*100:.0f}%"
        )
        logger.info(f"[Decision Engine] SCALE UP — {reason}")

    elif predicted_requests < historical_avg * (1 - SCALE_DOWN_FACTOR) and len(_prediction_history) >= 5:
        # Significant traffic drop — scale down to save cost
        recommended_servers = max(MIN_SERVERS,
                                  int(np.ceil(predicted_requests / TARGET_LOAD)))
        action = "SCALE DOWN"
        reason = (
            f"Traffic drop: {predicted_requests:.0f} req/min "
            f"is >{SCALE_DOWN_FACTOR*100:.0f}% below historical avg {historical_avg:.0f}"
        )
        logger.info(f"[Decision Engine] SCALE DOWN — {reason}")

    elif load_per_server > OVERLOAD_THRESHOLD:
        # Current servers are overloaded
        recommended_servers = max(current_servers + 1,
                                  int(np.ceil(predicted_requests / TARGET_LOAD)))
        action = "SCALE UP"
        reason = f"Load {load_per_server:.0f} req/server exceeds threshold {OVERLOAD_THRESHOLD}"
        logger.info(f"[Decision Engine] SCALE UP — {reason}")

    elif load_per_server < UNDERLOAD_THRESHOLD:
        # Servers are underutilised
        recommended_servers = max(MIN_SERVERS,
                                  int(np.ceil(predicted_requests / TARGET_LOAD)))
        action = "SCALE DOWN"
        reason = f"Load {load_per_server:.0f} req/server below threshold {UNDERLOAD_THRESHOLD}"
        logger.info(f"[Decision Engine] SCALE DOWN — {reason}")

    else:
        # Load is healthy — maintain current fleet
        recommended_servers = current_servers
        action = "KEEP SAME"
        reason = f"Load {load_per_server:.0f} req/server is within healthy range"
        logger.debug(f"[Decision Engine] KEEP SAME — {reason}")

    return {
        "recommended_servers" : recommended_servers,
        "action"              : action,
        "load_per_server"     : round(load_per_server, 2),
        "historical_avg"      : round(historical_avg, 2),
        "reason"              : reason,
    }


def run_prediction(data: dict) -> dict:
    """
    Full prediction pipeline:
      1. Build feature vector from telemetry data
      2. Run ML model to get predicted_requests
      3. Update rolling history deque
      4. Run improved decision engine to get scaling recommendation

    Parameters
    ----------
    data : dict — validated telemetry from the API request

    Returns
    -------
    dict with:
        predicted_requests   (float)
        recommended_servers  (int)
        action               (str)
        load_per_server      (float)
    """
    logger.info(
        f"[Prediction] Input — RPM={data['requests_per_minute']} "
        f"CPU={data['cpu_usage_percent']}% MEM={data['memory_usage_percent']}% "
        f"Servers={data['active_servers']}"
    )

    # Step 1 — Build feature array
    features = build_feature_vector(data)

    # Step 2 — Predict future workload using the trained RandomForest
    predicted_requests = float(model.predict(features)[0])
    predicted_requests = round(predicted_requests, 2)

    # Step 3 — Update rolling prediction history
    _prediction_history.append(predicted_requests)

    # Step 4 — Apply improved decision engine
    scaling = decision_engine(predicted_requests, data["active_servers"])

    # Combine everything into the final response
    result = {
        "predicted_requests"  : predicted_requests,
        "recommended_servers" : scaling["recommended_servers"],
        "action"              : scaling["action"],
        "load_per_server"     : scaling["load_per_server"],
    }

    logger.info(
        f"[Prediction] Output — Predicted={predicted_requests} rpm  "
        f"Action={scaling['action']}  "
        f"Servers={data['active_servers']} → {scaling['recommended_servers']}"
    )

    return result