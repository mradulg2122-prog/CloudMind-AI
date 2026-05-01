# =============================================================================
# CloudMind AI – backend/services/task_queue.py
#
# Asynchronous Background Task System
# ──────────────────────────────────────
# Provides async task execution using FastAPI BackgroundTasks + a thread-pool
# executor for CPU-bound ML tasks.
#
# Task Types:
#   1. async_prediction_log   — post-prediction telemetry logging
#   2. async_report_generation — background report generation
#   3. scheduled_cleanup       — purge old logs and stale request_log entries
#   4. background_alert        — create system alerts without blocking responses
#   5. background_model_warmup — pre-warm model on startup
#
# Usage (in FastAPI handler):
#   from services.task_queue import TaskQueue
#   tq = TaskQueue()
#
#   background_tasks.add_task(tq.log_prediction_async, pred_data)
#   background_tasks.add_task(tq.cleanup_old_logs, db, days=30)
# =============================================================================

from __future__ import annotations

import asyncio
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger("cloudmind.task_queue")

# ── Thread pool for CPU-bound tasks (ML inference) ────────────────────────────
_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="cloudmind-bg")


class TaskQueue:
    """
    Lightweight task queue using FastAPI BackgroundTasks + ThreadPoolExecutor.

    Does NOT require Celery / Redis — designed for single-process deployments.
    Can be swapped for Celery when horizontal scaling is needed.

    All methods are designed to be called with FastAPI's BackgroundTasks:
        background_tasks.add_task(tq.some_method, arg1, arg2)
    """

    # =========================================================================
    # PREDICTION LOGGING TASK
    # =========================================================================

    def log_prediction_async(
        self,
        user        : str,
        action      : str,
        predicted   : float,
        confidence  : float,
        recommended : int,
        duration_ms : float,
    ) -> None:
        """
        Log a completed prediction event asynchronously.
        Safe to call as a background task — never raises to the caller.
        """
        try:
            from services.logging_service import StructuredLogger
            slog = StructuredLogger("task_queue")
            slog.prediction(
                user          = user,
                action        = action,
                predicted_rpm = predicted,
                confidence    = confidence,
                recommended   = recommended,
                duration_ms   = duration_ms,
            )
            logger.debug(f"[TaskQueue] Async prediction log written for user={user}")
        except Exception as exc:
            logger.warning(f"[TaskQueue] log_prediction_async failed: {exc}")

    # =========================================================================
    # REPORT GENERATION TASK
    # =========================================================================

    def generate_report_async(
        self,
        db            : Session,
        user_id       : int,
        prediction_id : Optional[int],
        input_data    : dict,
        prediction    : dict,
        explanation   : dict,
        report_type   : str = "optimization_decision",
        max_retries   : int = 3,
    ) -> None:
        """
        Generate and persist a report in the background with retry logic.
        Called after /predict to avoid blocking the HTTP response.

        Retry Strategy:
          - Up to max_retries attempts
          - Exponential backoff: 0.5s, 1s, 2s between retries
          - After all retries exhausted, logs error and continues
        """
        import time as _time

        for attempt in range(1, max_retries + 1):
            try:
                from services.report_service import ReportService
                svc = ReportService(db)

                if report_type == "cost_prediction":
                    svc.generate_cost_report(
                        user_id       = user_id,
                        prediction_id = prediction_id,
                        input_data    = input_data,
                        prediction    = prediction,
                    )
                else:
                    svc.generate_optimization_report(
                        user_id       = user_id,
                        prediction_id = prediction_id,
                        input_data    = input_data,
                        prediction    = prediction,
                        explanation   = explanation,
                    )

                logger.info(
                    f"[TaskQueue] Report generated — user_id={user_id} "
                    f"pred_id={prediction_id} type={report_type} (attempt {attempt})"
                )
                return  # success — exit retry loop

            except Exception as exc:
                wait = 0.5 * (2 ** (attempt - 1))  # 0.5, 1.0, 2.0 seconds
                if attempt < max_retries:
                    logger.warning(
                        f"[TaskQueue] generate_report_async attempt {attempt} failed: {exc} "
                        f"— retrying in {wait}s"
                    )
                    _time.sleep(wait)
                else:
                    logger.error(
                        f"[TaskQueue] generate_report_async exhausted {max_retries} retries: {exc}",
                        exc_info=True,
                    )

    # =========================================================================
    # CLEANUP TASK
    # =========================================================================

    def cleanup_old_logs(self, db: Session, days: int = 30) -> None:
        """
        Delete request_log entries older than `days` days.
        Should be called periodically (e.g., daily) to prevent DB bloat.

        Recommended: Call from a scheduled job or /admin/cleanup endpoint.
        """
        try:
            from database import RequestLog
            cutoff  = datetime.now(timezone.utc) - timedelta(days=days)
            deleted = (
                db.query(RequestLog)
                .filter(RequestLog.created_at < cutoff)
                .delete(synchronize_session=False)
            )
            db.commit()
            logger.info(
                f"[TaskQueue] Cleanup complete — deleted {deleted} request_logs "
                f"older than {days} days"
            )
        except Exception as exc:
            logger.error(f"[TaskQueue] cleanup_old_logs failed: {exc}", exc_info=True)
            try:
                db.rollback()
            except Exception:
                pass

    # =========================================================================
    # ALERT TASK
    # =========================================================================

    def create_alert_async(
        self,
        db       : Session,
        message  : str,
        severity : str = "warning",
        source   : str = "system",
        user_id  : Optional[int] = None,
    ) -> None:
        """
        Create a system alert in the background without blocking the response.
        Severity: 'critical' | 'warning' | 'info'
        """
        try:
            from database import AlertRecord
            alert = AlertRecord(
                user_id  = user_id,
                severity = severity,
                message  = message[:1000],  # truncate to fit DB column
                source   = source[:64],
            )
            db.add(alert)
            db.commit()
            logger.info(
                f"[TaskQueue] Alert created — severity={severity} source={source}"
            )
        except Exception as exc:
            logger.warning(f"[TaskQueue] create_alert_async failed: {exc}")
            try:
                db.rollback()
            except Exception:
                pass

    # =========================================================================
    # MODEL WARMUP TASK
    # =========================================================================

    def warmup_model(self) -> None:
        """
        Run a dummy prediction to warm up the ML model's memory caches.
        Call once at startup via lifespan handler.
        """
        try:
            from predict import run_prediction
            dummy = {
                "requests_per_minute"  : 100,
                "cpu_usage_percent"    : 30,
                "memory_usage_percent" : 30,
                "active_servers"       : 2,
                "hour"                 : 12,
                "minute"               : 0,
                "response_time_ms"     : 80,
                "cost_per_server"      : 50,
            }
            result = run_prediction(dummy)
            logger.info(
                f"[TaskQueue] Model warmed up — action={result.get('action')} "
                f"predicted={result.get('predicted_requests'):.1f} rpm"
            )
        except Exception as exc:
            logger.warning(f"[TaskQueue] warmup_model failed (non-critical): {exc}")

    # =========================================================================
    # SCHEDULED METRICS SNAPSHOT
    # =========================================================================

    def snapshot_metrics(self, db: Session) -> None:
        """
        Take a metrics snapshot and write it to the structured log.
        Designed to be called periodically for trend analysis.
        """
        try:
            from services.health_service import HealthService
            from services.logging_service import StructuredLogger
            svc  = HealthService(db)
            slog = StructuredLogger("metrics_snapshot")
            metrics = svc.get_metrics()
            slog.info(
                "Metrics snapshot",
                event       = "metrics_snapshot",
                predictions = metrics.get("predictions", {}),
                users       = metrics.get("users", {}),
                uptime_s    = metrics.get("uptime_s"),
            )
        except Exception as exc:
            logger.warning(f"[TaskQueue] snapshot_metrics failed: {exc}")


# ── Module-level singleton for easy import ────────────────────────────────────
task_queue = TaskQueue()
