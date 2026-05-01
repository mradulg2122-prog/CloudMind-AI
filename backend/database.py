# =============================================================================
# CloudMind AI – database.py  (v5 — Production Schema)
#
# Changes from v4:
#   ✅ All v4 tables preserved
#   ✅ ModelVersion table — tracks registered ML model versions (NEW)
#   ✅ Updated DB version header comment
#   ✅ ModelVersion indexes for efficient querying
# =============================================================================

import os
from datetime import datetime

from sqlalchemy import (
    create_engine, Column, Integer, Float, String,
    DateTime, ForeignKey, Text, Boolean, Index
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

# ── Database URL — reads from env variable for production PostgreSQL ───────────
# Set DATABASE_URL=postgresql://user:pass@host:5432/cloudmind for Postgres
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{os.path.join(os.path.dirname(__file__), 'cloudmind.db')}"
)

# ── SQLAlchemy engine ─────────────────────────────────────────────────────────
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args = _connect_args,
    pool_pre_ping = True,        # detect stale connections
    echo          = False,       # set True for SQL debug logging
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# =============================================================================
# ORM TABLE DEFINITIONS
# =============================================================================

class User(Base):
    """Registered users — stores hashed passwords, roles, and account state."""
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True)
    username   = Column(String(64),  unique=True, nullable=False, index=True)
    email      = Column(String(128), unique=True, nullable=False, index=True)
    hashed_pw  = Column(String(256), nullable=False)
    is_active  = Column(Boolean, default=True)
    role       = Column(String(16), default="user", nullable=False)  # viewer|user|admin
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    telemetry    = relationship("TelemetryRecord",      back_populates="user", lazy="dynamic")
    predictions  = relationship("PredictionRecord",     back_populates="user", lazy="dynamic")
    reports      = relationship("Report",               back_populates="user", lazy="dynamic")


class TelemetryRecord(Base):
    """Raw telemetry snapshots sent to /predict — stored for historical analysis."""
    __tablename__ = "telemetry"

    id                   = Column(Integer, primary_key=True, index=True)
    user_id              = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    requests_per_minute  = Column(Float, nullable=False)
    cpu_usage_percent    = Column(Float, nullable=False)
    memory_usage_percent = Column(Float, nullable=False)
    active_servers       = Column(Integer, nullable=False)
    hour                 = Column(Integer, nullable=False)
    minute               = Column(Integer, nullable=False)
    response_time_ms     = Column(Float, default=100.0)
    cost_per_server      = Column(Float, default=50.0)
    recorded_at          = Column(DateTime, default=datetime.utcnow, index=True)

    user        = relationship("User", back_populates="telemetry")
    prediction  = relationship("PredictionRecord", back_populates="telemetry", uselist=False)

    __table_args__ = (
        Index("ix_telemetry_user_recorded", "user_id", "recorded_at"),
    )


class PredictionRecord(Base):
    """ML model prediction results — one row per /predict call."""
    __tablename__ = "predictions"

    id                  = Column(Integer, primary_key=True, index=True)
    telemetry_id        = Column(Integer, ForeignKey("telemetry.id", ondelete="SET NULL"), nullable=True, index=True)
    user_id             = Column(Integer, ForeignKey("users.id",     ondelete="SET NULL"), nullable=True, index=True)
    predicted_requests  = Column(Float,   nullable=False)
    recommended_servers = Column(Integer, nullable=False)
    action              = Column(String(16), nullable=False)   # SCALE UP / SCALE DOWN / KEEP SAME
    load_per_server     = Column(Float,   nullable=False)
    created_at          = Column(DateTime, default=datetime.utcnow, index=True)

    user        = relationship("User",            back_populates="predictions")
    telemetry   = relationship("TelemetryRecord", back_populates="prediction")
    explanation = relationship("PredictionExplanation", back_populates="prediction", uselist=False)
    scaling     = relationship("ScalingDecision",       back_populates="prediction", uselist=False)
    reports     = relationship("Report",                back_populates="prediction")

    __table_args__ = (
        Index("ix_predictions_user_created", "user_id", "created_at"),
        Index("ix_predictions_action",       "action"),
    )


class PredictionExplanation(Base):
    """
    XAI explanation for each prediction — generated by explain_service.py.
    One-to-one with PredictionRecord.
    """
    __tablename__ = "prediction_explanations"

    id                  = Column(Integer, primary_key=True, index=True)
    prediction_id       = Column(Integer, ForeignKey("predictions.id", ondelete="CASCADE"), unique=True, index=True)
    confidence_score    = Column(Float,   nullable=True)
    confidence_label    = Column(String(16), nullable=True)    # Very High / High / Medium / Low
    reasoning_summary   = Column(Text,    nullable=True)
    feature_contributions = Column(Text,  nullable=True)       # JSON array
    recommendations     = Column(Text,    nullable=True)        # JSON array
    risk_level          = Column(String(16), nullable=True)    # low / medium / high / critical
    risk_score          = Column(Float,   nullable=True)
    created_at          = Column(DateTime, default=datetime.utcnow)

    prediction = relationship("PredictionRecord", back_populates="explanation")


class ScalingDecision(Base):
    """Scaling actions taken by the decision engine."""
    __tablename__ = "scaling_decisions"

    id             = Column(Integer, primary_key=True, index=True)
    prediction_id  = Column(Integer, ForeignKey("predictions.id", ondelete="SET NULL"), nullable=True, index=True)
    action         = Column(String(16), nullable=False)
    before_servers = Column(Integer, nullable=False)
    after_servers  = Column(Integer, nullable=False)
    reason         = Column(Text, nullable=True)
    decided_at     = Column(DateTime, default=datetime.utcnow, index=True)

    prediction = relationship("PredictionRecord", back_populates="scaling")


class AlertRecord(Base):
    """System alerts logged when thresholds are breached."""
    __tablename__ = "alerts"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    severity   = Column(String(16), nullable=False)    # critical / warning / info
    message    = Column(Text, nullable=False)
    source     = Column(String(64), default="system")
    dismissed  = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class RequestLog(Base):
    """One row per API request — useful for auditing and rate analysis."""
    __tablename__ = "request_logs"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    method      = Column(String(8),   nullable=False)
    path        = Column(String(256), nullable=False, index=True)
    status_code = Column(Integer,     nullable=False, index=True)
    duration_ms = Column(Float,       nullable=True)
    ip_address  = Column(String(45),  nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index("ix_request_logs_path_status", "path", "status_code"),
    )


class Report(Base):
    """
    Generated optimization reports — cost, optimization, and historical reports.
    Stored as JSON blobs for flexible schema evolution.
    """
    __tablename__ = "reports"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    prediction_id = Column(Integer, ForeignKey("predictions.id", ondelete="SET NULL"), nullable=True)
    report_type   = Column(String(32),  nullable=False, index=True)   # cost_prediction / optimization_decision / historical_performance
    title         = Column(String(256), nullable=False)
    content       = Column(Text,        nullable=False)               # JSON blob
    created_at    = Column(DateTime, default=datetime.utcnow, index=True)

    user       = relationship("User",             back_populates="reports")
    prediction = relationship("PredictionRecord", back_populates="reports")

    __table_args__ = (
        Index("ix_reports_user_type", "user_id", "report_type"),
    )


class ModelVersion(Base):
    """
    ML model version registry — tracks all trained/registered model versions.
    Mirrors model_metadata.json for DB-backed querying.

    This table is populated by:
      - POST /admin/model/register
      - POST /retrain/trigger (auto-registers)

    Rollbacks are performed via POST /admin/model/rollback.
    """
    __tablename__ = "model_versions"

    id             = Column(Integer, primary_key=True, index=True)
    version_id     = Column(String(32),  unique=True, nullable=False, index=True)  # e.g. "v20240101_120000"
    version_label  = Column(String(64),  nullable=False)                            # e.g. "v2.0.0"
    path           = Column(String(512), nullable=False)                            # full path to .joblib file
    is_current     = Column(Boolean, default=False, nullable=False, index=True)
    description    = Column(Text, nullable=True)
    n_samples      = Column(Integer, default=0)
    r2_score       = Column(Float, nullable=True)                                   # regression metric
    mae            = Column(Float, nullable=True)                                   # mean absolute error
    rmse           = Column(Float, nullable=True)
    registered_by  = Column(String(64), nullable=True)                              # username who registered
    registered_at  = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index("ix_model_versions_current", "is_current"),
        Index("ix_model_versions_registered", "registered_at"),
    )


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def init_db():
    """Create all tables — safe to call multiple times (CREATE IF NOT EXISTS)."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """
    FastAPI dependency — yields a DB session and ensures it closes on exit.

    Usage:
        @app.get("/endpoint")
        def handler(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
