# =============================================================================
# CloudMind AI – backend/services/health_service.py
#
# System Health & Monitoring Service
# ─────────────────────────────────────
# Provides comprehensive health checks for all system components.
#
# Endpoints powered by this service:
#   GET /health    — basic liveness check
#   GET /status    — detailed component status
#   GET /metrics   — operational metrics (predictions, uptime, costs)
#
# Usage:
#   from services.health_service import HealthService
#   svc = HealthService(db)
#   status = svc.get_full_status()
# =============================================================================

from __future__ import annotations

import os
import platform
import time
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func, text

# Module-level startup time (server uptime tracking)
_SERVER_START_TIME: float = time.time()


class HealthService:
    """
    Centralized health and metrics service for CloudMind AI.

    Each check method returns a dict with at minimum:
      {"status": "ok" | "degraded" | "error", ...extra_info}
    """

    def __init__(self, db: Session):
        self.db = db

    # =========================================================================
    # LIVENESS CHECK (fast — used by load balancers)
    # =========================================================================

    def liveness(self) -> dict:
        """
        Fast liveness probe — returns immediately without DB or model checks.
        Used by Docker HEALTHCHECK and Kubernetes liveness probes.
        """
        return {
            "status"   : "alive",
            "service"  : "CloudMind AI",
            "version"  : "5.0.0",
            "timestamp": _now_iso(),
            "uptime_s" : round(time.time() - _SERVER_START_TIME, 1),
        }

    # =========================================================================
    # FULL STATUS (slower — used by /status endpoint)
    # =========================================================================

    def get_full_status(self) -> dict:
        """
        Comprehensive multi-component health status.
        Checks: database, ML model, logging system, disk space.
        """
        overall = "healthy"
        components: dict[str, dict] = {}

        # ── Database check ────────────────────────────────────────────────────
        db_status = self._check_database()
        components["database"] = db_status
        if db_status["status"] != "ok":
            overall = "degraded"

        # ── ML model check ────────────────────────────────────────────────────
        ml_status = self._check_ml_model()
        components["ml_model"] = ml_status
        if ml_status["status"] == "error":
            overall = "degraded"

        # ── Logging system check ──────────────────────────────────────────────
        log_status = self._check_logging()
        components["logging"] = log_status

        # ── Disk space check ──────────────────────────────────────────────────
        disk_status = self._check_disk()
        components["disk"] = disk_status
        if disk_status["status"] == "critical":
            overall = "degraded"

        return {
            "status"     : overall,
            "service"    : "CloudMind AI",
            "version"    : "4.0.0",
            "environment": os.getenv("ENVIRONMENT", "development"),
            "timestamp"  : _now_iso(),
            "uptime_s"   : round(time.time() - _SERVER_START_TIME, 1),
            "uptime_human": _format_uptime(time.time() - _SERVER_START_TIME),
            "platform"   : {
                "python" : platform.python_version(),
                "os"     : platform.system(),
                "arch"   : platform.machine(),
            },
            "components" : components,
        }

    # =========================================================================
    # METRICS (used by /metrics endpoint for dashboards / Prometheus scraping)
    # =========================================================================

    def get_metrics(self) -> dict:
        """
        Operational metrics for monitoring dashboards.
        Returns prediction counts, cost summaries, and error rates.
        """
        from database import PredictionRecord, TelemetryRecord, Report, User, RequestLog

        metrics: dict[str, Any] = {
            "timestamp" : _now_iso(),
            "uptime_s"  : round(time.time() - _SERVER_START_TIME, 1),
        }

        try:
            # Prediction metrics
            total_preds = self.db.query(func.count(PredictionRecord.id)).scalar() or 0
            scale_ups   = self.db.query(func.count(PredictionRecord.id)).filter(
                PredictionRecord.action == "SCALE UP"
            ).scalar() or 0
            scale_downs = self.db.query(func.count(PredictionRecord.id)).filter(
                PredictionRecord.action == "SCALE DOWN"
            ).scalar() or 0
            keep_sames  = self.db.query(func.count(PredictionRecord.id)).filter(
                PredictionRecord.action == "KEEP SAME"
            ).scalar() or 0

            metrics["predictions"] = {
                "total"       : total_preds,
                "scale_up"    : scale_ups,
                "scale_down"  : scale_downs,
                "keep_same"   : keep_sames,
                "scale_up_pct": round(scale_ups / max(total_preds, 1) * 100, 1),
                "scale_down_pct": round(scale_downs / max(total_preds, 1) * 100, 1),
            }

            # User metrics
            total_users  = self.db.query(func.count(User.id)).scalar() or 0
            active_users = self.db.query(func.count(User.id)).filter(
                User.is_active == True  # noqa: E712
            ).scalar() or 0
            admin_count  = self.db.query(func.count(User.id)).filter(
                User.role == "admin"
            ).scalar() or 0

            metrics["users"] = {
                "total"  : total_users,
                "active" : active_users,
                "admins" : admin_count,
            }

            # Report metrics
            total_reports = self.db.query(func.count(Report.id)).scalar() or 0
            metrics["reports"] = {"total": total_reports}

            # API request metrics (last 1000)
            recent_logs = (
                self.db.query(RequestLog)
                .order_by(RequestLog.created_at.desc())
                .limit(1000)
                .all()
            )
            if recent_logs:
                avg_latency = round(
                    sum(r.duration_ms for r in recent_logs if r.duration_ms)
                    / max(len([r for r in recent_logs if r.duration_ms]), 1),
                    2,
                )
                error_count = sum(1 for r in recent_logs if r.status_code >= 500)
                metrics["api"] = {
                    "recent_requests"   : len(recent_logs),
                    "avg_latency_ms"    : avg_latency,
                    "server_errors"     : error_count,
                    "error_rate_pct"    : round(error_count / len(recent_logs) * 100, 1),
                }
            else:
                metrics["api"] = {"recent_requests": 0}

            # Cost metrics (from telemetry)
            recent_tele = (
                self.db.query(TelemetryRecord)
                .order_by(TelemetryRecord.recorded_at.desc())
                .limit(1)
                .first()
            )
            if recent_tele:
                metrics["cost"] = {
                    "current_servers"      : recent_tele.active_servers,
                    "cost_per_server_hr"   : recent_tele.cost_per_server,
                    "current_hourly_cost"  : round(
                        recent_tele.active_servers * recent_tele.cost_per_server, 2
                    ),
                }

        except Exception as exc:
            metrics["error"] = f"Metrics collection partial failure: {str(exc)}"

        return metrics

    # =========================================================================
    # PRIVATE COMPONENT CHECKS
    # =========================================================================

    def _check_database(self) -> dict:
        """Verify DB connectivity with a lightweight query."""
        try:
            # Ping DB with trivial query
            self.db.execute(text("SELECT 1"))

            from database import User, PredictionRecord, Report
            return {
                "status"     : "ok",
                "users"      : self.db.query(func.count(User.id)).scalar() or 0,
                "predictions": self.db.query(func.count(PredictionRecord.id)).scalar() or 0,
                "reports"    : self.db.query(func.count(Report.id)).scalar() or 0,
                "engine"     : "SQLite" if "sqlite" in str(self.db.bind.url) else "PostgreSQL",
            }
        except Exception as exc:
            return {"status": "error", "detail": str(exc)}

    def _check_ml_model(self) -> dict:
        """Verify ML model is loaded and file exists on disk."""
        try:
            from predict import MODEL_PATH, model
            exists = os.path.isfile(MODEL_PATH)
            size   = os.path.getsize(MODEL_PATH) if exists else 0
            mtime  = (
                datetime.utcfromtimestamp(os.path.getmtime(MODEL_PATH)).isoformat() + "Z"
                if exists else None
            )
            n_estimators = len(model.estimators_) if hasattr(model, "estimators_") else "unknown"
            n_features   = getattr(model, "n_features_in_", "unknown")

            return {
                "status"       : "ok" if exists else "missing",
                "path"         : MODEL_PATH,
                "size_bytes"   : size,
                "last_modified": mtime,
                "model_type"   : "RandomForestRegressor",
                "n_estimators" : n_estimators,
                "n_features"   : n_features,
            }
        except Exception as exc:
            return {"status": "error", "detail": str(exc)}

    def _check_logging(self) -> dict:
        """Verify log directory is writable and files exist."""
        try:
            logs_dir = os.path.join(os.path.dirname(__file__), "..", "..", "logs")
            logs_dir = os.path.normpath(logs_dir)

            if not os.path.isdir(logs_dir):
                return {"status": "warning", "detail": "Logs directory not found"}

            log_files = [f for f in os.listdir(logs_dir) if f.endswith((".log", ".jsonl"))]
            total_size = sum(
                os.path.getsize(os.path.join(logs_dir, f))
                for f in log_files
                if os.path.isfile(os.path.join(logs_dir, f))
            )

            return {
                "status"         : "ok",
                "logs_directory" : logs_dir,
                "log_files"      : len(log_files),
                "total_size_mb"  : round(total_size / 1_048_576, 2),
                "writable"       : os.access(logs_dir, os.W_OK),
            }
        except Exception as exc:
            return {"status": "warning", "detail": str(exc)}

    def _check_disk(self) -> dict:
        """Check available disk space on the data volume."""
        try:
            stat  = os.statvfs("." if platform.system() != "Windows" else "C:\\")
            free  = stat.f_frsize * stat.f_bavail
            total = stat.f_frsize * stat.f_blocks
            used_pct = round((1 - free / max(total, 1)) * 100, 1)

            status = "ok"
            if used_pct > 90:
                status = "critical"
            elif used_pct > 75:
                status = "warning"

            return {
                "status"      : status,
                "free_gb"     : round(free / 1_073_741_824, 2),
                "total_gb"    : round(total / 1_073_741_824, 2),
                "used_percent": used_pct,
            }
        except Exception:
            # Windows fallback
            try:
                import shutil
                total, used, free = shutil.disk_usage(".")
                used_pct = round(used / max(total, 1) * 100, 1)
                status = "critical" if used_pct > 90 else ("warning" if used_pct > 75 else "ok")
                return {
                    "status"      : status,
                    "free_gb"     : round(free / 1_073_741_824, 2),
                    "total_gb"    : round(total / 1_073_741_824, 2),
                    "used_percent": used_pct,
                }
            except Exception as exc2:
                return {"status": "unknown", "detail": str(exc2)}


# ── Utility helpers ───────────────────────────────────────────────────────────

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _format_uptime(seconds: float) -> str:
    """Convert seconds to human-readable uptime string."""
    s = int(seconds)
    days, rem = divmod(s, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, secs = divmod(rem, 60)
    parts = []
    if days:
        parts.append(f"{days}d")
    if hours:
        parts.append(f"{hours}h")
    if minutes:
        parts.append(f"{minutes}m")
    parts.append(f"{secs}s")
    return " ".join(parts)
