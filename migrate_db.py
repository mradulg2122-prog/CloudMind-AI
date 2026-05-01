"""
CloudMind AI — Database Migration Script
Adds new columns required by v4 schema to existing cloudmind.db
Run once: python migrate_db.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "backend", "cloudmind.db")

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()

    # ── Check & add to users table ─────────────────────────────────────────────
    cur.execute("PRAGMA table_info(users)")
    user_cols = [r[1] for r in cur.fetchall()]
    print(f"Existing users columns: {user_cols}")

    if "role" not in user_cols:
        cur.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'")
        print("  [OK] Added users.role")
    if "updated_at" not in user_cols:
        cur.execute("ALTER TABLE users ADD COLUMN updated_at DATETIME")
        print("  [OK] Added users.updated_at")

    # -- Check & add to alerts table
    cur.execute("PRAGMA table_info(alerts)")
    alert_cols = [r[1] for r in cur.fetchall()]
    if "user_id" not in alert_cols:
        cur.execute("ALTER TABLE alerts ADD COLUMN user_id INTEGER")
        print("  [OK] Added alerts.user_id")

    # -- Check & add to request_logs table
    cur.execute("PRAGMA table_info(request_logs)")
    log_cols = [r[1] for r in cur.fetchall()]
    if "ip_address" not in log_cols:
        cur.execute("ALTER TABLE request_logs ADD COLUMN ip_address TEXT")
        print("  [OK] Added request_logs.ip_address")

    # -- Create new tables if they don't exist
    cur.execute("""
        CREATE TABLE IF NOT EXISTS prediction_explanations (
            id                   INTEGER PRIMARY KEY AUTOINCREMENT,
            prediction_id        INTEGER UNIQUE,
            confidence_score     REAL,
            confidence_label     TEXT,
            reasoning_summary    TEXT,
            feature_contributions TEXT,
            recommendations      TEXT,
            risk_level           TEXT,
            risk_score           REAL,
            created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (prediction_id) REFERENCES predictions(id) ON DELETE CASCADE
        )
    """)
    print("  [OK] Ensured prediction_explanations table")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS reports (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id       INTEGER NOT NULL,
            prediction_id INTEGER,
            report_type   TEXT NOT NULL,
            title         TEXT NOT NULL,
            content       TEXT NOT NULL,
            created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id)       REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (prediction_id) REFERENCES predictions(id) ON DELETE SET NULL
        )
    """)
    print("  [OK] Ensured reports table")

    # Create indexes
    indexes = [
        "CREATE INDEX IF NOT EXISTS ix_prediction_explanations_prediction_id ON prediction_explanations(prediction_id)",
        "CREATE INDEX IF NOT EXISTS ix_reports_user_id ON reports(user_id)",
        "CREATE INDEX IF NOT EXISTS ix_reports_report_type ON reports(report_type)",
        "CREATE INDEX IF NOT EXISTS ix_reports_created_at ON reports(created_at)",
    ]
    for idx in indexes:
        cur.execute(idx)
    print("  [OK] Ensured indexes")

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
