# =============================================================================
# CloudMind AI – backend/services/logging_service.py
#
# Production-Grade Structured Logging Service
# ─────────────────────────────────────────────
# Provides JSON-structured logging for cloud-native observability.
#
# Features:
#   - JSON formatter for log aggregation tools (Datadog, ELK, CloudWatch)
#   - Request correlation IDs for tracing
#   - Separate log streams: app, predictions, security, performance
#   - Log sampling to prevent storage exhaustion
#
# Usage:
#   from services.logging_service import StructuredLogger
#   log = StructuredLogger("mymodule")
#   log.prediction(user="alice", action="SCALE UP", confidence=0.87)
#   log.security_event("rate_limit_exceeded", ip="1.2.3.4")
#   log.performance(endpoint="/predict", duration_ms=42.1, status=200)
# =============================================================================

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from typing import Any, Optional


# ── Directory setup ────────────────────────────────────────────────────────────
_LOGS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "logs")
os.makedirs(_LOGS_DIR, exist_ok=True)


class JSONFormatter(logging.Formatter):
    """
    Formats log records as single-line JSON objects for structured log ingestion.
    Compatible with Datadog, AWS CloudWatch, ELK Stack, and GCP Cloud Logging.
    """

    def format(self, record: logging.LogRecord) -> str:
        log_obj: dict[str, Any] = {
            "timestamp"  : datetime.now(timezone.utc).isoformat(),
            "level"      : record.levelname,
            "logger"     : record.name,
            "message"    : record.getMessage(),
            "module"     : record.module,
            "function"   : record.funcName,
            "line"       : record.lineno,
        }
        # Attach any extra fields passed via logger.info(..., extra={...})
        for key, val in record.__dict__.items():
            if key not in (
                "name", "msg", "args", "levelname", "levelno", "pathname",
                "filename", "module", "exc_info", "exc_text", "stack_info",
                "lineno", "funcName", "created", "msecs", "relativeCreated",
                "thread", "threadName", "processName", "process", "message",
                "taskName",
            ):
                if not key.startswith("_"):
                    log_obj[key] = val

        # Attach exception info if present
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_obj, default=str)


def _make_handler(filename: str, max_bytes: int = 10_485_760, backup_count: int = 5) -> RotatingFileHandler:
    """Create a rotating file handler with JSON formatting."""
    handler = RotatingFileHandler(
        os.path.join(_LOGS_DIR, filename),
        maxBytes    = max_bytes,
        backupCount = backup_count,
        encoding    = "utf-8",
    )
    handler.setFormatter(JSONFormatter())
    return handler


# ── Module-level log streams ───────────────────────────────────────────────────
_app_logger        = logging.getLogger("cloudmind.app")
_prediction_logger = logging.getLogger("cloudmind.predictions")
_security_logger   = logging.getLogger("cloudmind.security")
_perf_logger       = logging.getLogger("cloudmind.performance")

# Only add handlers once
if not _app_logger.handlers:
    for _logger, _file in [
        (_app_logger,        "app_structured.jsonl"),
        (_prediction_logger, "predictions.jsonl"),
        (_security_logger,   "security.jsonl"),
        (_perf_logger,       "performance.jsonl"),
    ]:
        _logger.addHandler(_make_handler(_file))
        _logger.setLevel(logging.DEBUG)
        _logger.propagate = True  # also pass up to root logger


class StructuredLogger:
    """
    High-level structured logging interface for CloudMind AI modules.

    All log methods emit JSON records to their respective log stream
    and propagate to the root logger (which writes to app.log + console).
    """

    def __init__(self, name: str):
        self.name    = name
        self._logger = logging.getLogger(f"cloudmind.{name}")

    # ── General application events ─────────────────────────────────────────────
    def info(self, message: str, **kwargs):
        _app_logger.info(message, extra={"source": self.name, **kwargs})

    def warning(self, message: str, **kwargs):
        _app_logger.warning(message, extra={"source": self.name, **kwargs})

    def error(self, message: str, exc_info: bool = False, **kwargs):
        _app_logger.error(message, exc_info=exc_info, extra={"source": self.name, **kwargs})

    def debug(self, message: str, **kwargs):
        _app_logger.debug(message, extra={"source": self.name, **kwargs})

    # ── Prediction-specific logging ────────────────────────────────────────────
    def prediction(
        self,
        user          : str,
        action        : str,
        predicted_rpm : float,
        confidence    : float,
        recommended   : int,
        duration_ms   : Optional[float] = None,
        **kwargs,
    ):
        """Log a completed ML prediction with key metrics."""
        _prediction_logger.info(
            f"Prediction complete — action={action} rpm={predicted_rpm:.1f} conf={confidence:.2f}",
            extra={
                "source"          : self.name,
                "user"            : user,
                "action"          : action,
                "predicted_rpm"   : round(predicted_rpm, 2),
                "confidence"      : round(confidence, 4),
                "recommended_srv" : recommended,
                "duration_ms"     : duration_ms,
                "correlation_id"  : str(uuid.uuid4())[:8],
                **kwargs,
            },
        )

    # ── Security event logging ─────────────────────────────────────────────────
    def security_event(
        self,
        event_type : str,
        severity   : str = "warning",
        ip         : Optional[str] = None,
        user       : Optional[str] = None,
        detail     : Optional[str] = None,
        **kwargs,
    ):
        """Log a security-relevant event (auth failures, rate limits, etc.)."""
        level = getattr(logging, severity.upper(), logging.WARNING)
        _security_logger.log(
            level,
            f"Security event: {event_type}",
            extra={
                "source"     : self.name,
                "event_type" : event_type,
                "severity"   : severity,
                "client_ip"  : ip,
                "username"   : user,
                "detail"     : detail,
                **kwargs,
            },
        )

    # ── Performance logging ────────────────────────────────────────────────────
    def performance(
        self,
        endpoint   : str,
        duration_ms: float,
        status     : int,
        method     : str = "GET",
        **kwargs,
    ):
        """Log API request performance metrics."""
        level = logging.WARNING if duration_ms > 500 else logging.INFO
        _perf_logger.log(
            level,
            f"{method} {endpoint} → {status} ({duration_ms:.1f}ms)",
            extra={
                "source"      : self.name,
                "endpoint"    : endpoint,
                "method"      : method,
                "status_code" : status,
                "duration_ms" : round(duration_ms, 2),
                "slow"        : duration_ms > 500,
                **kwargs,
            },
        )
