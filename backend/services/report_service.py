# =============================================================================
# CloudMind AI – backend/services/report_service.py
#
# Optimization Report Generation Service
# ────────────────────────────────────────
# Auto-generates, stores, and exports structured optimization reports.
#
# Report Types:
#   1. cost_prediction    — cost forecast based on current telemetry + ML output
#   2. optimization       — scaling decision justification report
#   3. historical         — aggregated performance report over a time window
#   4. security_audit     — authentication events and rate limit incidents
#
# Reports are stored in the `reports` DB table and can be exported as
# JSON or CSV.
#
# Usage:
#   from services.report_service import ReportService
#   svc = ReportService(db)
#   report = svc.generate_cost_report(user_id=1, prediction_id=42)
#   csv_str = svc.export_reports_csv(user_id=1, limit=100)
# =============================================================================

from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from database import (
    Report, PredictionRecord, TelemetryRecord,
    ScalingDecision, AlertRecord, User
)


class ReportService:
    """Service class for generating, storing, and exporting reports."""

    def __init__(self, db: Session):
        self.db = db

    # =========================================================================
    # GENERATE REPORTS
    # =========================================================================

    def generate_cost_report(
        self,
        user_id      : int,
        prediction_id: Optional[int] = None,
        input_data   : Optional[dict] = None,
        prediction   : Optional[dict] = None,
    ) -> "Report":
        """
        Generate a cost prediction report for a single prediction event.

        Estimates:
        - Current hourly cost
        - Recommended infrastructure cost after scaling
        - Projected 24h cost
        - Estimated savings/overhead vs current config
        """
        servers     = (input_data or {}).get("active_servers", 1)
        cost_sv     = (input_data or {}).get("cost_per_server", 50.0)
        rec_servers = (prediction or {}).get("recommended_servers", servers)
        action      = (prediction or {}).get("action", "KEEP SAME")

        current_hourly   = round(servers * cost_sv, 2)
        rec_hourly       = round(rec_servers * cost_sv, 2)
        delta_hourly     = round(rec_hourly - current_hourly, 2)
        projected_24h    = round(rec_hourly * 24, 2)
        savings_24h      = round(-delta_hourly * 24, 2) if delta_hourly < 0 else 0.0
        overhead_24h     = round(delta_hourly * 24, 2)  if delta_hourly > 0 else 0.0

        content = {
            "report_type"         : "cost_prediction",
            "generated_at"        : datetime.now(timezone.utc).isoformat(),
            "current_servers"     : servers,
            "recommended_servers" : rec_servers,
            "cost_per_server_hr"  : cost_sv,
            "current_hourly_cost" : current_hourly,
            "recommended_hourly"  : rec_hourly,
            "hourly_delta"        : delta_hourly,
            "projected_24h_cost"  : projected_24h,
            "estimated_savings_24h": savings_24h,
            "estimated_overhead_24h": overhead_24h,
            "action"              : action,
            "prediction_id"       : prediction_id,
            "summary"             : self._cost_summary(action, delta_hourly, savings_24h),
        }

        return self._save_report(
            user_id     = user_id,
            report_type = "cost_prediction",
            title       = f"Cost Report — {action} ({datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')} UTC)",
            content     = content,
            prediction_id = prediction_id,
        )

    def generate_optimization_report(
        self,
        user_id       : int,
        prediction_id : Optional[int] = None,
        input_data    : Optional[dict] = None,
        prediction    : Optional[dict] = None,
        explanation   : Optional[dict] = None,
    ) -> "Report":
        """
        Generate an optimization decision report combining ML output + XAI.

        Includes:
        - Full prediction breakdown
        - Explanation and confidence
        - Feature contributions
        - Risk assessment
        - Recommended actions
        """
        content = {
            "report_type"     : "optimization_decision",
            "generated_at"    : datetime.now(timezone.utc).isoformat(),
            "prediction_id"   : prediction_id,
            "input_snapshot"  : {
                k: v for k, v in (input_data or {}).items()
                if k in {"requests_per_minute", "cpu_usage_percent",
                         "memory_usage_percent", "active_servers",
                         "response_time_ms", "cost_per_server", "hour"}
            },
            "prediction"      : {
                "predicted_requests"  : (prediction or {}).get("predicted_requests"),
                "recommended_servers" : (prediction or {}).get("recommended_servers"),
                "action"              : (prediction or {}).get("action"),
                "load_per_server"     : (prediction or {}).get("load_per_server"),
            },
            "explanation"     : {
                "confidence_score"  : (explanation or {}).get("confidence_score"),
                "confidence_label"  : (explanation or {}).get("confidence_label"),
                "reasoning_summary" : (explanation or {}).get("reasoning_summary"),
                "risk_assessment"   : (explanation or {}).get("risk_assessment"),
                "top_features"      : (explanation or {}).get("feature_contributions", [])[:3],
                "recommendations"   : (explanation or {}).get("optimization_recommendations", []),
            },
        }

        return self._save_report(
            user_id       = user_id,
            report_type   = "optimization_decision",
            title         = (
                f"Optimization Report — "
                f"{(prediction or {}).get('action', 'UNKNOWN')} "
                f"({datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')} UTC)"
            ),
            content       = content,
            prediction_id = prediction_id,
        )

    def generate_historical_report(
        self,
        user_id   : int,
        days      : int = 7,
    ) -> "Report":
        """
        Generate an aggregated historical performance report for the last N days.
        """
        since = datetime.now(timezone.utc) - timedelta(days=days)

        preds = (
            self.db.query(PredictionRecord)
            .filter(
                PredictionRecord.user_id   == user_id,
                PredictionRecord.created_at >= since,
            )
            .all()
        )

        tele = (
            self.db.query(TelemetryRecord)
            .filter(
                TelemetryRecord.user_id    == user_id,
                TelemetryRecord.recorded_at >= since,
            )
            .all()
        )

        total = len(preds)
        if total == 0:
            content = {
                "report_type"  : "historical_performance",
                "period_days"  : days,
                "generated_at" : datetime.now(timezone.utc).isoformat(),
                "message"      : "No predictions in the selected period.",
                "total_predictions": 0,
            }
        else:
            dist = {"SCALE UP": 0, "SCALE DOWN": 0, "KEEP SAME": 0}
            for p in preds:
                dist[p.action] = dist.get(p.action, 0) + 1

            avg_req     = sum(p.predicted_requests for p in preds) / total
            avg_load    = sum(p.load_per_server for p in preds) / total
            peak_req    = max(p.predicted_requests for p in preds)
            scale_events = dist["SCALE UP"] + dist["SCALE DOWN"]

            avg_cpu = (sum(t.cpu_usage_percent for t in tele) / len(tele)) if tele else 0
            avg_mem = (sum(t.memory_usage_percent for t in tele) / len(tele)) if tele else 0

            cost_sv = tele[0].cost_per_server if tele else 50
            est_saved = round(dist["SCALE DOWN"] * cost_sv, 2)

            content = {
                "report_type"            : "historical_performance",
                "period_days"            : days,
                "generated_at"           : datetime.now(timezone.utc).isoformat(),
                "total_predictions"      : total,
                "action_distribution"    : dist,
                "avg_predicted_requests" : round(avg_req, 2),
                "avg_load_per_server"    : round(avg_load, 2),
                "peak_predicted_requests": round(peak_req, 2),
                "total_scaling_events"   : scale_events,
                "avg_cpu_percent"        : round(avg_cpu, 2),
                "avg_memory_percent"     : round(avg_mem, 2),
                "estimated_cost_saved"   : est_saved,
                "scale_up_rate_pct"      : round(dist["SCALE UP"] / total * 100, 1),
                "scale_down_rate_pct"    : round(dist["SCALE DOWN"] / total * 100, 1),
                "summary"                : (
                    f"Over the last {days} days, the system made {total} predictions "
                    f"with {scale_events} scaling events. "
                    f"Estimated cost savings from scale-down decisions: ${est_saved}."
                ),
            }

        return self._save_report(
            user_id     = user_id,
            report_type = "historical_performance",
            title       = f"Historical Performance Report — Last {days} Days",
            content     = content,
        )

    # =========================================================================
    # EXPORT
    # =========================================================================

    def export_reports_json(self, user_id: int, limit: int = 50) -> str:
        """Export reports as a JSON string."""
        reports = self._get_user_reports(user_id, limit)
        data = [
            {
                "id"          : r.id,
                "report_type" : r.report_type,
                "title"       : r.title,
                "content"     : json.loads(r.content) if r.content else {},
                "created_at"  : r.created_at.isoformat() if r.created_at else None,
            }
            for r in reports
        ]
        return json.dumps(data, indent=2, default=str)

    def export_reports_csv(self, user_id: int, limit: int = 200) -> str:
        """Export a CSV summary of all reports."""
        reports = self._get_user_reports(user_id, limit)
        output  = io.StringIO()
        writer  = csv.writer(output)

        writer.writerow([
            "id", "report_type", "title", "created_at",
            "action", "confidence_score", "predicted_requests",
            "recommended_servers", "estimated_cost"
        ])

        for r in reports:
            try:
                c = json.loads(r.content) if r.content else {}
            except (json.JSONDecodeError, TypeError):
                c = {}

            pred = c.get("prediction", {}) or {}
            expl = c.get("explanation", {}) or {}

            writer.writerow([
                r.id,
                r.report_type,
                r.title,
                r.created_at.isoformat() if r.created_at else "",
                pred.get("action") or c.get("action", ""),
                expl.get("confidence_score") or "",
                pred.get("predicted_requests") or "",
                pred.get("recommended_servers") or "",
                c.get("recommended_hourly") or "",
            ])

        output.seek(0)
        return output.getvalue()

    # =========================================================================
    # PRIVATE HELPERS
    # =========================================================================

    def _save_report(
        self,
        user_id      : int,
        report_type  : str,
        title        : str,
        content      : dict,
        prediction_id: Optional[int] = None,
    ) -> "Report":
        """Persist a report to the database and return the saved ORM object."""
        report = Report(
            user_id       = user_id,
            prediction_id = prediction_id,
            report_type   = report_type,
            title         = title,
            content       = json.dumps(content, default=str),
        )
        self.db.add(report)
        self.db.commit()
        self.db.refresh(report)
        return report

    def _get_user_reports(self, user_id: int, limit: int):
        return (
            self.db.query(Report)
            .filter(Report.user_id == user_id)
            .order_by(Report.created_at.desc())
            .limit(min(limit, 500))
            .all()
        )

    @staticmethod
    def _cost_summary(action: str, delta: float, savings: float) -> str:
        if action == "SCALE DOWN" and savings > 0:
            return f"Scaling down will save ~${savings:.2f} over the next 24 hours."
        elif action == "SCALE UP":
            return f"Scaling up will increase cost by ~${abs(delta):.2f}/hour to maintain performance."
        return "No cost change expected — current configuration is optimal."
