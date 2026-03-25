# =============================================================================
# CloudMind AI – database.py
#
# Responsibilities:
#   - Create and manage the SQLite database connection (via SQLAlchemy)
#   - Define ORM table models for:
#       • users          – registered accounts
#       • telemetry      – incoming workload snapshots
#       • predictions    – ML model outputs
#       • scaling_decisions – recommended server actions
#       • alerts         – generated system alerts
#       • request_logs   – API access logs
#
# Usage:
#   from database import SessionLocal, init_db
#   init_db()          # call once on startup to create tables
#   db = SessionLocal() # get a session, use it, then db.close()
# =============================================================================

import os
from datetime import datetime

from sqlalchemy import (
    create_engine, Column, Integer, Float, String,
    DateTime, ForeignKey, Text, Boolean
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# ── Database file lives in the backend directory ──────────────────────────────
DB_PATH = os.path.join(os.path.dirname(__file__), "cloudmind.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

# ── SQLAlchemy engine – connect_args needed for SQLite thread safety ──────────
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # required for SQLite + FastAPI
)

# ── Session factory ───────────────────────────────────────────────────────────
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ── Base class for all ORM models ─────────────────────────────────────────────
Base = declarative_base()


# =============================================================================
# ORM TABLE DEFINITIONS
# =============================================================================

class User(Base):
    """Registered users – stores hashed passwords, never plaintext."""
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True)
    username   = Column(String(64),  unique=True,  nullable=False, index=True)
    email      = Column(String(128), unique=True,  nullable=False)
    hashed_pw  = Column(String(256), nullable=False)
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class TelemetryRecord(Base):
    """Raw telemetry snapshots sent to /predict – stored for historical analysis."""
    __tablename__ = "telemetry"

    id                   = Column(Integer, primary_key=True, index=True)
    user_id              = Column(Integer, ForeignKey("users.id"), nullable=True)
    requests_per_minute  = Column(Float, nullable=False)
    cpu_usage_percent    = Column(Float, nullable=False)
    memory_usage_percent = Column(Float, nullable=False)
    active_servers       = Column(Integer, nullable=False)
    hour                 = Column(Integer, nullable=False)
    minute               = Column(Integer, nullable=False)
    response_time_ms     = Column(Float, default=100.0)
    cost_per_server      = Column(Float, default=50.0)
    recorded_at          = Column(DateTime, default=datetime.utcnow)


class PredictionRecord(Base):
    """ML model prediction results – one row per /predict call."""
    __tablename__ = "predictions"

    id                  = Column(Integer, primary_key=True, index=True)
    telemetry_id        = Column(Integer, ForeignKey("telemetry.id"), nullable=True)
    user_id             = Column(Integer, ForeignKey("users.id"),     nullable=True)
    predicted_requests  = Column(Float, nullable=False)
    recommended_servers = Column(Integer, nullable=False)
    action              = Column(String(16), nullable=False)  # SCALE UP / DOWN / KEEP SAME
    load_per_server     = Column(Float, nullable=False)
    created_at          = Column(DateTime, default=datetime.utcnow)


class ScalingDecision(Base):
    """Scaling actions taken by the decision engine."""
    __tablename__ = "scaling_decisions"

    id                  = Column(Integer, primary_key=True, index=True)
    prediction_id       = Column(Integer, ForeignKey("predictions.id"), nullable=True)
    action              = Column(String(16), nullable=False)
    before_servers      = Column(Integer, nullable=False)
    after_servers       = Column(Integer, nullable=False)
    reason              = Column(Text, nullable=True)
    decided_at          = Column(DateTime, default=datetime.utcnow)


class AlertRecord(Base):
    """System alerts logged when thresholds are breached."""
    __tablename__ = "alerts"

    id          = Column(Integer, primary_key=True, index=True)
    severity    = Column(String(16), nullable=False)  # critical / warning / info
    message     = Column(Text, nullable=False)
    source      = Column(String(64), default="system")
    dismissed   = Column(Boolean, default=False)
    created_at  = Column(DateTime, default=datetime.utcnow)


class RequestLog(Base):
    """One row per API request – useful for auditing and rate analysis."""
    __tablename__ = "request_logs"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=True)
    method      = Column(String(8),   nullable=False)
    path        = Column(String(256), nullable=False)
    status_code = Column(Integer, nullable=False)
    duration_ms = Column(Float, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def init_db():
    """Create all tables if they do not already exist."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """
    FastAPI dependency – yields a database session and ensures it is
    closed after the request completes (even on error).

    Usage in a route:
        from database import get_db
        from sqlalchemy.orm import Session
        from fastapi import Depends

        @app.post("/some-route")
        def route(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
