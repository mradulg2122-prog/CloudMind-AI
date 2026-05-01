# =============================================================================
# CloudMind AI – app.py  (v5 — Production Grade)
#
# Architecture: API Layer → Service Layer → ML Layer → Data Layer
#
# v5 additions:
#   ✅ /status         — detailed component health (DB, model, disk)
#   ✅ /metrics        — operational metrics dashboard
#   ✅ /admin/model/versions — model version list
#   ✅ /admin/model/register — register new model version
#   ✅ /admin/model/rollback — rollback to previous model version
#   ✅ /admin/cleanup  — background cleanup of old request logs
#   ✅ TaskQueue integration — non-blocking background logging
#   ✅ Model warmup on startup via task_queue
#   ✅ Input sanitization via sanitization_service
#   ✅ Complete RBAC, XAI, Reporting, Rate Limiting, Structured Logging
# =============================================================================

import os
import io
import csv
import json
import time
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, Request, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy.orm import Session
from sqlalchemy import func

# ── Internal modules ──────────────────────────────────────────────────────────
from predict import run_prediction, MODEL_PATH
from database import (
    get_db, init_db, engine,
    TelemetryRecord, PredictionRecord, ScalingDecision,
    AlertRecord, RequestLog, User,
    PredictionExplanation, Report,
)
from auth import (
    get_current_user, authenticate_user, create_user,
    create_access_token, set_user_role,
    RegisterRequest, LoginRequest, TokenResponse, UserOut,
)
from logger_config import get_logger
from services.rbac import require_role, Role
from services.explain_service import explain_prediction
from services.report_service import ReportService
from services.logging_service import StructuredLogger
from services.health_service import HealthService
from services.task_queue import task_queue
from services.model_registry import model_registry
from services.sanitization_service import sanitize_string, sanitize_dict

# ── Loggers ───────────────────────────────────────────────────────────────────
logger      = get_logger(__name__)
slog        = StructuredLogger("app")

# ── Rate limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

# ── Lifespan handler (replaces deprecated on_event) ──────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("CloudMind AI v5 started — database initialised.")
    # Warm up the ML model in background to reduce first-request latency
    import asyncio
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, task_queue.warmup_model)
    yield
    logger.info("CloudMind AI v5 shutting down gracefully.")

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title       = "CloudMind AI — Cloud Cost Intelligence API",
    description = (
        "Autonomous cloud cost intelligence and self-optimizing infrastructure platform. "
        "Provides ML-powered workload prediction, XAI explanations, RBAC, optimization reports, "
        "model versioning, health monitoring, and structured logging."
    ),
    version     = "5.0.0",
    docs_url    = "/docs",
    redoc_url   = "/redoc",
    lifespan    = lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────────────────────
_ALLOWED_ORIGINS_ENV = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS: List[str] = (
    [o.strip() for o in _ALLOWED_ORIGINS_ENV.split(",") if o.strip()]
    if _ALLOWED_ORIGINS_ENV
    else [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
    ]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ALLOWED_ORIGINS,
    allow_credentials = True,
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers     = ["Authorization", "Content-Type", "Accept", "X-Request-ID", "X-API-Version"],
    expose_headers    = ["X-Request-ID", "X-RateLimit-Remaining", "X-Process-Time"],
    max_age           = 600,
)


# ── Security Headers Middleware ───────────────────────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"]  = "nosniff"
    response.headers["X-Frame-Options"]          = "DENY"
    response.headers["X-XSS-Protection"]         = "1; mode=block"
    response.headers["Content-Security-Policy"]  = (
        "default-src 'self'; script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
    )
    response.headers["Referrer-Policy"]          = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"]       = "camera=(), microphone=(), geolocation=()"
    # Uncomment in production with valid TLS:
    # response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    return response


# ── Request Timing + Structured Logging Middleware ────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start      = time.perf_counter()
    response   = await call_next(request)
    elapsed_ms = round((time.perf_counter() - start) * 1000, 2)

    slog.performance(
        endpoint    = str(request.url.path),
        method      = request.method,
        duration_ms = elapsed_ms,
        status      = response.status_code,
    )

    # Non-blocking DB write for request log
    try:
        db = next(get_db())
        db.add(RequestLog(
            method      = request.method,
            path        = str(request.url.path),
            status_code = response.status_code,
            duration_ms = elapsed_ms,
            ip_address  = request.client.host if request.client else None,
        ))
        db.commit()
        db.close()
    except Exception as exc:
        logger.warning(f"[Middleware] Request log write failed: {exc}")

    response.headers["X-Process-Time"] = f"{elapsed_ms}ms"
    return response


# (Startup handled by lifespan context manager above)


# =============================================================================
# PYDANTIC SCHEMAS
# =============================================================================

class TelemetryInput(BaseModel):
    """Input telemetry payload with field-level validation."""
    model_config = ConfigDict(json_schema_extra={"example": {
        "requests_per_minute": 850, "cpu_usage_percent": 70,
        "memory_usage_percent": 65, "active_servers": 4,
        "hour": 14, "minute": 30, "response_time_ms": 120, "cost_per_server": 50,
    }})

    requests_per_minute  : float = Field(..., description="Current requests per minute")
    cpu_usage_percent    : float = Field(..., ge=0, le=100, description="CPU usage 0–100%")
    memory_usage_percent : float = Field(..., ge=0, le=100, description="Memory usage 0–100%")
    active_servers       : int   = Field(..., ge=1, description="Active server count (≥1)")
    hour                 : int   = Field(..., ge=0, le=23, description="Current hour (0–23)")
    minute               : int   = Field(..., ge=0, le=59, description="Current minute (0–59)")
    response_time_ms     : float = Field(100.0, ge=0, description="Average response time in ms")
    cost_per_server      : float = Field(50.0,  ge=0, description="Cost per server per hour ($)")

    @field_validator("requests_per_minute")
    @classmethod
    def validate_rpm(cls, v):
        if v < 0:
            raise ValueError("requests_per_minute must be ≥ 0.")
        return v




class PredictionOutput(BaseModel):
    """Extended prediction response including XAI fields."""
    model_config = ConfigDict(from_attributes=True)

    predicted_requests   : float
    recommended_servers  : int
    action               : str
    load_per_server      : float
    confidence_score     : Optional[float]  = None
    confidence_label     : Optional[str]    = None
    reasoning_summary    : Optional[str]    = None
    optimization_recommendations: Optional[List[str]] = None
    risk_level           : Optional[str]    = None
    report_id            : Optional[int]    = None


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int; severity: str; message: str; source: str; dismissed: bool; created_at: datetime


class LogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int; method: str; path: str; status_code: int
    duration_ms: Optional[float]; created_at: datetime


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int; report_type: str; title: str; created_at: datetime
    content: Optional[str] = None


class RoleUpdateRequest(BaseModel):
    role: str


class ExplanationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    prediction_id      : int
    confidence_score   : Optional[float]
    confidence_label   : Optional[str]
    reasoning_summary  : Optional[str]
    feature_contributions: Optional[str]
    recommendations    : Optional[str]
    risk_level         : Optional[str]
    risk_score         : Optional[float]
    created_at         : datetime


# =============================================================================
# ── PUBLIC ENDPOINTS
# =============================================================================

@app.get("/", tags=["Health"])
def root():
    return {
        "message"  : "CloudMind AI v5 — API is running.",
        "docs"     : "/docs",
        "version"  : "5.0.0",
        "features" : [
            "RBAC", "XAI", "Reporting", "Rate Limiting",
            "Structured Logging", "Model Registry",
            "Health Monitoring", "Input Sanitization",
            "Background Tasks",
        ],
    }


@app.get("/health", tags=["Health"])
def health_check(db: Session = Depends(get_db)):
    """Fast liveness probe — used by Docker HEALTHCHECK and load balancers."""
    svc = HealthService(db)
    return svc.liveness()


@app.get("/status", tags=["Health"])
@limiter.limit("20/minute")
def detailed_status(request: Request, db: Session = Depends(get_db)):
    """
    Detailed component health check.
    Checks: database, ML model, logging system, disk space.
    No authentication required — safe for internal monitoring.
    """
    svc = HealthService(db)
    return svc.get_full_status()


@app.get("/metrics", tags=["Health"])
@limiter.limit("30/minute")
def get_system_metrics(
    request      : Request,
    current_user : User    = Depends(require_role(Role.ADMIN)),
    db           : Session = Depends(get_db),
):
    """
    Operational metrics dashboard — admin only.
    Returns prediction counts, user stats, API latency, and cost metrics.
    """
    svc = HealthService(db)
    return svc.get_metrics()


# =============================================================================
# ── AUTH ENDPOINTS
# =============================================================================

@app.post("/auth/register", response_model=UserOut, status_code=201, tags=["Auth"])
@limiter.limit("10/minute")
def register(request: Request, payload: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user. Password strength is enforced server-side."""
    try:
        user = create_user(db, payload.username, payload.email, payload.password)
        slog.info(f"New user registered: '{payload.username}'", event="user_registered")
        return user
    except ValueError as e:
        slog.security_event("registration_failed", user=payload.username, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/auth/login", response_model=TokenResponse, tags=["Auth"])
@limiter.limit("20/minute")
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate and return a JWT Bearer token."""
    user = authenticate_user(db, payload.username, payload.password)
    if not user:
        slog.security_event(
            "login_failed", severity="warning",
            ip=request.client.host if request.client else None,
            user=payload.username,
        )
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail      = "Invalid username or password.",
            headers     = {"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(data={"sub": user.username})
    slog.info(f"User logged in: '{payload.username}'", event="login_success")
    return TokenResponse(access_token=token)


@app.get("/auth/me", response_model=UserOut, tags=["Auth"])
def get_me(current_user: User = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return current_user


# =============================================================================
# ── PREDICTION ENDPOINT (with XAI + Auto-Reports)
# =============================================================================

@app.post("/predict", response_model=PredictionOutput, tags=["Prediction"])
@limiter.limit("100/minute")
def predict(
    request            : Request,
    telemetry          : TelemetryInput,
    background_tasks   : BackgroundTasks,
    current_user       : User    = Depends(require_role(Role.USER)),
    db                 : Session = Depends(get_db),
):
    """
    Run ML workload prediction with XAI explanation (PROTECTED — requires 'user' role).

    Returns full prediction result including:
    - predicted_requests:  workload forecast ~5 min ahead
    - recommended_servers: decision engine output
    - action:              SCALE UP / SCALE DOWN / KEEP SAME
    - confidence_score:    ML model certainty (0.0–1.0)
    - reasoning_summary:   natural-language explanation
    - risk_level:          low / medium / high / critical
    - report_id:           stored optimization report ID
    """
    t_start = time.perf_counter()
    try:
        input_data = telemetry.model_dump()

        # ── 1. ML Prediction ──────────────────────────────────────────────────
        result     = run_prediction(input_data)

        # ── 2. XAI Explanation ────────────────────────────────────────────────
        explanation = explain_prediction(
            input_data          = input_data,
            predicted_requests  = result["predicted_requests"],
            action              = result["action"],
            recommended_servers = result["recommended_servers"],
            load_per_server     = result["load_per_server"],
        )

        # ── 3. Save telemetry ─────────────────────────────────────────────────
        telemetry_record = TelemetryRecord(
            user_id              = current_user.id,
            requests_per_minute  = telemetry.requests_per_minute,
            cpu_usage_percent    = telemetry.cpu_usage_percent,
            memory_usage_percent = telemetry.memory_usage_percent,
            active_servers       = telemetry.active_servers,
            hour                 = telemetry.hour,
            minute               = telemetry.minute,
            response_time_ms     = telemetry.response_time_ms,
            cost_per_server      = telemetry.cost_per_server,
        )
        db.add(telemetry_record)
        db.flush()

        # ── 4. Save prediction ────────────────────────────────────────────────
        prediction_record = PredictionRecord(
            telemetry_id        = telemetry_record.id,
            user_id             = current_user.id,
            predicted_requests  = result["predicted_requests"],
            recommended_servers = result["recommended_servers"],
            action              = result["action"],
            load_per_server     = result["load_per_server"],
        )
        db.add(prediction_record)
        db.flush()

        # ── 5. Save XAI explanation ───────────────────────────────────────────
        import json as _json
        explanation_record = PredictionExplanation(
            prediction_id         = prediction_record.id,
            confidence_score      = explanation["confidence_score"],
            confidence_label      = explanation["confidence_label"],
            reasoning_summary     = explanation["reasoning_summary"],
            feature_contributions = _json.dumps(explanation["feature_contributions"]),
            recommendations       = _json.dumps(explanation["optimization_recommendations"]),
            risk_level            = explanation["risk_assessment"]["overall_risk"],
            risk_score            = explanation["risk_assessment"]["risk_score"],
        )
        db.add(explanation_record)
        db.flush()

        # ── 6. Save scaling decision ──────────────────────────────────────────
        if result["action"] != "KEEP SAME":
            db.add(ScalingDecision(
                prediction_id  = prediction_record.id,
                action         = result["action"],
                before_servers = telemetry.active_servers,
                after_servers  = result["recommended_servers"],
                reason         = explanation["reasoning_summary"][:200],
            ))

        db.commit()

        # ── 7. Auto-generate reports (background) ─────────────────────────────
        rpt_svc = ReportService(db)
        rpt = rpt_svc.generate_optimization_report(
            user_id       = current_user.id,
            prediction_id = prediction_record.id,
            input_data    = input_data,
            prediction    = result,
            explanation   = explanation,
        )

        elapsed_ms = round((time.perf_counter() - t_start) * 1000, 2)

        slog.prediction(
            user          = current_user.username,
            action        = result["action"],
            predicted_rpm = result["predicted_requests"],
            confidence    = explanation["confidence_score"],
            recommended   = result["recommended_servers"],
            duration_ms   = elapsed_ms,
        )

        return {
            **result,
            "confidence_score"            : explanation["confidence_score"],
            "confidence_label"            : explanation["confidence_label"],
            "reasoning_summary"           : explanation["reasoning_summary"],
            "optimization_recommendations": explanation["optimization_recommendations"],
            "risk_level"                  : explanation["risk_assessment"]["overall_risk"],
            "report_id"                   : rpt.id,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Predict] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


# =============================================================================
# ── EXPLANATION ENDPOINTS
# =============================================================================

@app.get("/explain/{prediction_id}", tags=["XAI"])
@limiter.limit("60/minute")
def get_explanation(
    request       : Request,
    prediction_id : int,
    current_user  : User    = Depends(get_current_user),
    db            : Session = Depends(get_db),
):
    """Retrieve the stored XAI explanation for a specific prediction (PROTECTED)."""
    pred = db.query(PredictionRecord).filter(
        PredictionRecord.id      == prediction_id,
        PredictionRecord.user_id == current_user.id,
    ).first()
    if not pred:
        raise HTTPException(status_code=404, detail="Prediction not found.")

    expl = db.query(PredictionExplanation).filter(
        PredictionExplanation.prediction_id == prediction_id
    ).first()
    if not expl:
        raise HTTPException(status_code=404, detail="Explanation not yet generated for this prediction.")

    return {
        "prediction_id"        : prediction_id,
        "confidence_score"     : expl.confidence_score,
        "confidence_label"     : expl.confidence_label,
        "reasoning_summary"    : expl.reasoning_summary,
        "feature_contributions": json.loads(expl.feature_contributions) if expl.feature_contributions else [],
        "recommendations"      : json.loads(expl.recommendations) if expl.recommendations else [],
        "risk_level"           : expl.risk_level,
        "risk_score"           : expl.risk_score,
        "created_at"           : expl.created_at.isoformat() if expl.created_at else None,
    }


@app.get("/predictions/history", tags=["Prediction"])
@limiter.limit("30/minute")
def get_prediction_history(
    request      : Request,
    limit        : int     = 50,
    current_user : User    = Depends(get_current_user),
    db           : Session = Depends(get_db),
):
    """Return the most recent predictions with explanation data (PROTECTED)."""
    records = (
        db.query(PredictionRecord)
        .filter(PredictionRecord.user_id == current_user.id)
        .order_by(PredictionRecord.created_at.desc())
        .limit(min(limit, 200))
        .all()
    )
    return [
        {
            "id"                  : r.id,
            "predicted_requests"  : r.predicted_requests,
            "recommended_servers" : r.recommended_servers,
            "action"              : r.action,
            "load_per_server"     : r.load_per_server,
            "confidence_score"    : r.explanation.confidence_score if r.explanation else None,
            "confidence_label"    : r.explanation.confidence_label if r.explanation else None,
            "risk_level"          : r.explanation.risk_level if r.explanation else None,
            "created_at"          : r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]


# =============================================================================
# ── REPORT ENDPOINTS
# =============================================================================

@app.get("/reports", tags=["Reports"])
@limiter.limit("30/minute")
def list_reports(
    request      : Request,
    limit        : int   = 20,
    report_type  : Optional[str] = None,
    current_user : User    = Depends(get_current_user),
    db           : Session = Depends(get_db),
):
    """List all reports for the current user (PROTECTED)."""
    query = db.query(Report).filter(Report.user_id == current_user.id)
    if report_type:
        query = query.filter(Report.report_type == report_type)
    reports = query.order_by(Report.created_at.desc()).limit(min(limit, 100)).all()
    return [
        {
            "id"         : r.id,
            "report_type": r.report_type,
            "title"      : r.title,
            "created_at" : r.created_at.isoformat() if r.created_at else None,
        }
        for r in reports
    ]


@app.get("/reports/{report_id}", tags=["Reports"])
@limiter.limit("30/minute")
def get_report(
    request      : Request,
    report_id    : int,
    current_user : User    = Depends(get_current_user),
    db           : Session = Depends(get_db),
):
    """Retrieve full content of a specific report (PROTECTED)."""
    report = db.query(Report).filter(
        Report.id      == report_id,
        Report.user_id == current_user.id,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    return {
        "id"         : report.id,
        "report_type": report.report_type,
        "title"      : report.title,
        "content"    : json.loads(report.content) if report.content else {},
        "created_at" : report.created_at.isoformat() if report.created_at else None,
    }


@app.post("/reports/historical", tags=["Reports"])
@limiter.limit("10/minute")
def generate_historical_report(
    request      : Request,
    days         : int   = 7,
    current_user : User    = Depends(require_role(Role.USER)),
    db           : Session = Depends(get_db),
):
    """Generate and store a historical performance report (PROTECTED)."""
    rpt_svc = ReportService(db)
    report  = rpt_svc.generate_historical_report(user_id=current_user.id, days=min(days, 90))
    return {
        "report_id"  : report.id,
        "title"      : report.title,
        "content"    : json.loads(report.content) if report.content else {},
        "created_at" : report.created_at.isoformat() if report.created_at else None,
    }


@app.get("/reports/export/json", tags=["Reports"])
@limiter.limit("10/minute")
def export_reports_json(
    request      : Request,
    limit        : int   = 50,
    current_user : User    = Depends(get_current_user),
    db           : Session = Depends(get_db),
):
    """Export all reports as JSON download (PROTECTED)."""
    rpt_svc   = ReportService(db)
    json_data = rpt_svc.export_reports_json(current_user.id, limit)
    filename  = f"cloudmind_reports_{current_user.username}_{datetime.utcnow().strftime('%Y%m%d')}.json"
    return StreamingResponse(
        iter([json_data]),
        media_type = "application/json",
        headers    = {"Content-Disposition": f"attachment; filename={filename}"},
    )


@app.get("/reports/export/csv", tags=["Reports"])
@limiter.limit("10/minute")
def export_reports_csv(
    request      : Request,
    limit        : int   = 200,
    current_user : User    = Depends(get_current_user),
    db           : Session = Depends(get_db),
):
    """Export reports as CSV download (PROTECTED)."""
    rpt_svc  = ReportService(db)
    csv_data = rpt_svc.export_reports_csv(current_user.id, limit)
    filename = f"cloudmind_reports_{current_user.username}_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([csv_data]),
        media_type = "text/csv",
        headers    = {"Content-Disposition": f"attachment; filename={filename}"},
    )


# =============================================================================
# ── ANALYTICS ENDPOINT
# =============================================================================

@app.get("/analytics", tags=["Analytics"])
@limiter.limit("30/minute")
def get_analytics(
    request      : Request,
    current_user : User    = Depends(get_current_user),
    db           : Session = Depends(get_db),
):
    """Aggregated analytics for the current user including XAI metrics (PROTECTED)."""
    preds = (
        db.query(PredictionRecord)
        .filter(PredictionRecord.user_id == current_user.id)
        .all()
    )
    total = len(preds)
    if total == 0:
        return {"message": "No predictions yet.", "total_predictions": 0}

    action_dist = {"SCALE UP": 0, "SCALE DOWN": 0, "KEEP SAME": 0}
    for p in preds:
        action_dist[p.action] = action_dist.get(p.action, 0) + 1

    avg_req     = round(sum(p.predicted_requests  for p in preds) / total, 2)
    avg_load    = round(sum(p.load_per_server      for p in preds) / total, 2)
    avg_servers = round(sum(p.recommended_servers  for p in preds) / total, 2)
    peak_req    = round(max(p.predicted_requests   for p in preds), 2)
    min_req     = round(min(p.predicted_requests   for p in preds), 2)

    # XAI confidence metrics
    explanations = [p.explanation for p in preds if p.explanation is not None]
    avg_confidence = (
        round(sum(e.confidence_score for e in explanations if e.confidence_score) / len(explanations), 3)
        if explanations else None
    )
    risk_dist = {}
    for e in explanations:
        if e.risk_level:
            risk_dist[e.risk_level] = risk_dist.get(e.risk_level, 0) + 1

    tele = db.query(TelemetryRecord).filter(TelemetryRecord.user_id == current_user.id).all()
    avg_cpu  = round(sum(t.cpu_usage_percent    for t in tele) / len(tele), 2) if tele else 0
    avg_mem  = round(sum(t.memory_usage_percent for t in tele) / len(tele), 2) if tele else 0
    cost_sv  = tele[-1].cost_per_server if tele else 50
    est_saved = round(action_dist["SCALE DOWN"] * cost_sv, 2)

    scaling_decisions = (
        db.query(ScalingDecision)
        .order_by(ScalingDecision.decided_at.desc())
        .limit(10)
        .all()
    )
    recent_scaling = [
        {
            "action": s.action, "before_servers": s.before_servers,
            "after_servers": s.after_servers, "reason": s.reason,
            "decided_at": s.decided_at.isoformat() if s.decided_at else None,
        }
        for s in scaling_decisions
    ]

    return {
        "total_predictions"          : total,
        "action_distribution"        : action_dist,
        "avg_predicted_requests"     : avg_req,
        "avg_load_per_server"        : avg_load,
        "avg_servers_recommended"    : avg_servers,
        "peak_predicted_requests"    : peak_req,
        "min_predicted_requests"     : min_req,
        "scale_up_rate_pct"          : round(action_dist["SCALE UP"]   / total * 100, 1),
        "scale_down_rate_pct"        : round(action_dist["SCALE DOWN"] / total * 100, 1),
        "estimated_cost_saved_usd"   : est_saved,
        "avg_cpu_percent"            : avg_cpu,
        "avg_memory_percent"         : avg_mem,
        "avg_confidence_score"       : avg_confidence,
        "risk_distribution"          : risk_dist,
        "recent_scaling_decisions"   : recent_scaling,
    }


# =============================================================================
# ── STANDARD PROTECTED ENDPOINTS
# =============================================================================

@app.get("/alerts", response_model=List[AlertOut], tags=["Monitoring"])
@limiter.limit("60/minute")
def get_alerts(
    request      : Request,
    limit        : int   = 50,
    current_user : User    = Depends(get_current_user),
    db           : Session = Depends(get_db),
):
    """Return recent system alerts (PROTECTED)."""
    alerts = (
        db.query(AlertRecord)
        .order_by(AlertRecord.created_at.desc())
        .limit(min(limit, 200))
        .all()
    )
    return alerts


@app.get("/logs", response_model=List[LogOut], tags=["Monitoring"])
@limiter.limit("30/minute")
def get_logs(
    request      : Request,
    limit        : int   = 100,
    current_user : User    = Depends(require_role(Role.ADMIN)),
    db           : Session = Depends(get_db),
):
    """Return API request logs — admin only (PROTECTED)."""
    logs = (
        db.query(RequestLog)
        .order_by(RequestLog.created_at.desc())
        .limit(min(limit, 500))
        .all()
    )
    return logs


# =============================================================================
# ── EXPORT ENDPOINTS
# =============================================================================

@app.get("/export/csv", tags=["Export"])
@limiter.limit("10/minute")
def export_predictions_csv(
    request      : Request,
    limit        : int   = 200,
    current_user : User    = Depends(get_current_user),
    db           : Session = Depends(get_db),
):
    """Export prediction history as CSV (PROTECTED)."""
    records = (
        db.query(PredictionRecord)
        .filter(PredictionRecord.user_id == current_user.id)
        .order_by(PredictionRecord.created_at.desc())
        .limit(min(limit, 1000))
        .all()
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "predicted_requests", "recommended_servers",
        "action", "load_per_server",
        "confidence_score", "confidence_label", "risk_level",
        "created_at",
    ])
    for r in records:
        expl = r.explanation
        writer.writerow([
            r.id,
            round(r.predicted_requests, 2),
            r.recommended_servers,
            r.action,
            round(r.load_per_server, 2),
            round(expl.confidence_score, 4) if expl and expl.confidence_score else "",
            expl.confidence_label if expl else "",
            expl.risk_level if expl else "",
            r.created_at.isoformat() if r.created_at else "",
        ])
    output.seek(0)
    filename = f"cloudmind_predictions_{current_user.username}_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type = "text/csv",
        headers    = {"Content-Disposition": f"attachment; filename={filename}"},
    )


@app.get("/export/pdf", tags=["Export"])
@limiter.limit("5/minute")
def export_predictions_pdf(
    request      : Request,
    current_user : User    = Depends(get_current_user),
    db           : Session = Depends(get_db),
):
    """Export prediction summary as PDF (PROTECTED). Falls back to text if reportlab missing."""
    preds = (
        db.query(PredictionRecord)
        .filter(PredictionRecord.user_id == current_user.id)
        .order_by(PredictionRecord.created_at.desc())
        .limit(50)
        .all()
    )
    total = len(preds)
    if total == 0:
        raise HTTPException(status_code=404, detail="No predictions to export.")

    action_dist = {"SCALE UP": 0, "SCALE DOWN": 0, "KEEP SAME": 0}
    for p in preds:
        action_dist[p.action] = action_dist.get(p.action, 0) + 1

    avg_req  = round(sum(p.predicted_requests for p in preds) / total, 2)
    avg_load = round(sum(p.load_per_server     for p in preds) / total, 2)
    now      = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet

        buf  = io.BytesIO()
        doc  = SimpleDocTemplate(buf, pagesize=letter)
        st   = getSampleStyleSheet()
        els  = []

        els.append(Paragraph("CloudMind AI — Prediction Report", st["Title"]))
        els.append(Paragraph(f"Generated: {now} | User: {current_user.username}", st["Normal"]))
        els.append(Spacer(1, 20))

        sum_data = [
            ["Metric", "Value"],
            ["Total Predictions",     str(total)],
            ["Avg Traffic",           f"{avg_req} req/min"],
            ["Avg Load/Server",       f"{avg_load} req/min"],
            ["SCALE UP",              str(action_dist["SCALE UP"])],
            ["SCALE DOWN",            str(action_dist["SCALE DOWN"])],
            ["KEEP SAME",             str(action_dist["KEEP SAME"])],
            ["Est. Cost Saved",       f"${action_dist['SCALE DOWN'] * 50}"],
        ]
        t = Table(sum_data, colWidths=[260, 200])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#1e3a5f")),
            ("TEXTCOLOR",  (0,0), (-1,0), colors.white),
            ("FONTNAME",   (0,0), (-1,0), "Helvetica-Bold"),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.whitesmoke, colors.lightgrey]),
            ("GRID", (0,0), (-1,-1), 0.5, colors.grey),
            ("FONTSIZE", (0,0), (-1,-1), 10),
        ]))
        els.append(t)
        doc.build(els)
        buf.seek(0)
        content    = buf.read()
        media_type = "application/pdf"

    except ImportError:
        lines = [
            "CLOUDMIND AI — PREDICTION REPORT", "=" * 50,
            f"Generated: {now}  |  User: {current_user.username}", "",
            "SUMMARY", "-" * 30,
            f"Total        : {total}",
            f"Avg Traffic  : {avg_req} req/min",
            f"Avg Load     : {avg_load} req/min",
            f"SCALE UP     : {action_dist['SCALE UP']}",
            f"SCALE DOWN   : {action_dist['SCALE DOWN']}",
            f"KEEP SAME    : {action_dist['KEEP SAME']}",
            f"Cost Saved   : ${action_dist['SCALE DOWN'] * 50}",
        ]
        content    = "\n".join(lines).encode("utf-8")
        media_type = "application/pdf"

    filename = f"cloudmind_report_{current_user.username}_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        io.BytesIO(content),
        media_type = media_type,
        headers    = {"Content-Disposition": f"attachment; filename={filename}"},
    )


# =============================================================================
# ── ADMIN ENDPOINTS (RBAC — admin role required)
# =============================================================================

@app.get("/admin/users", tags=["Admin"])
@limiter.limit("20/minute")
def list_all_users(
    request      : Request,
    limit        : int   = 50,
    current_user : User    = Depends(require_role(Role.ADMIN)),
    db           : Session = Depends(get_db),
):
    """List all registered users — admin only."""
    users = db.query(User).order_by(User.created_at.desc()).limit(min(limit, 200)).all()
    return [
        {
            "id": u.id, "username": u.username, "email": u.email,
            "role": u.role, "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@app.patch("/admin/users/{username}/role", tags=["Admin"])
@limiter.limit("10/minute")
def update_user_role(
    request      : Request,
    username     : str,
    payload      : RoleUpdateRequest,
    current_user : User    = Depends(require_role(Role.ADMIN)),
    db           : Session = Depends(get_db),
):
    """Change a user's role — admin only."""
    try:
        user = set_user_role(db, username, payload.role)
        slog.security_event(
            "role_changed", severity="info",
            user=username, detail=f"Role updated to '{payload.role}' by '{current_user.username}'"
        )
        return {"username": user.username, "role": user.role, "updated": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# ── MODEL RETRAINING
# =============================================================================

@app.post("/retrain/trigger", tags=["Admin"])
@limiter.limit("2/minute")
def trigger_retrain(
    request      : Request,
    current_user : User = Depends(require_role(Role.ADMIN)),
):
    """Manually trigger model retraining and auto-register the new version — admin only."""
    logger.info(f"[Retrain] Triggered by user='{current_user.username}'")
    try:
        from retrain import run_retraining
        summary = run_retraining()
        logger.info(f"[Retrain] Completed: {summary['status']}")
        # Auto-register the new model version
        try:
            from predict import MODEL_PATH
            model_registry.register_model(
                version_label = f"retrain-{datetime.utcnow().strftime('%Y%m%d')}",
                source_path   = MODEL_PATH,
                metrics       = summary.get("metrics", {}),
                description   = f"Retrain triggered by {current_user.username}",
            )
        except Exception as reg_err:
            logger.warning(f"[Retrain] Model registry update failed (non-critical): {reg_err}")
        slog.info(f"Model retrain completed", event="model_retrain", triggered_by=current_user.username)
        return summary
    except Exception as e:
        logger.error(f"[Retrain] Failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Retraining failed: {str(e)}")


# =============================================================================
# ── MODEL REGISTRY ENDPOINTS
# =============================================================================

@app.get("/admin/model/versions", tags=["Admin"])
@limiter.limit("20/minute")
def list_model_versions(
    request      : Request,
    current_user : User = Depends(require_role(Role.ADMIN)),
):
    """List all registered model versions — admin only."""
    versions = model_registry.list_versions()
    current  = model_registry.get_current_version()
    return {
        "current_version": current,
        "total_versions" : len(versions),
        "versions"       : versions,
    }


class ModelRegisterRequest(BaseModel):
    version_label: str = Field(..., description="Human-readable version label (e.g., 'v2.0.0')")
    description  : str = Field("", description="Optional description of changes")
    n_samples    : int = Field(0, description="Number of training samples used")


@app.post("/admin/model/register", tags=["Admin"])
@limiter.limit("5/minute")
def register_model_version(
    request      : Request,
    payload      : ModelRegisterRequest,
    current_user : User = Depends(require_role(Role.ADMIN)),
):
    """Register current model as a named version — admin only."""
    try:
        from predict import MODEL_PATH
        version_id = model_registry.register_model(
            version_label = sanitize_string(payload.version_label),
            source_path   = MODEL_PATH,
            description   = sanitize_string(payload.description),
            n_samples     = payload.n_samples,
        )
        slog.info(
            f"Model version registered: {version_id}",
            event="model_registered", registered_by=current_user.username,
        )
        return {
            "version_id"   : version_id,
            "version_label": payload.version_label,
            "registered_by": current_user.username,
            "status"       : "registered",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ModelRollbackRequest(BaseModel):
    version_id: str = Field(..., description="Version ID to restore (e.g., 'v20240101_120000')")


@app.post("/admin/model/rollback", tags=["Admin"])
@limiter.limit("3/minute")
def rollback_model(
    request      : Request,
    payload      : ModelRollbackRequest,
    current_user : User = Depends(require_role(Role.ADMIN)),
):
    """Roll back the active ML model to a previous version — admin only."""
    try:
        restored_id = model_registry.rollback(sanitize_string(payload.version_id))
        slog.security_event(
            "model_rollback", severity="warning",
            user=current_user.username,
            detail=f"Model rolled back to version '{restored_id}'",
        )
        return {
            "restored_version": restored_id,
            "rolled_back_by"  : current_user.username,
            "message"         : f"Model rolled back to '{restored_id}'. Restart the service for the change to take effect.",
        }
    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# ── ADMIN CLEANUP ENDPOINT
# =============================================================================

@app.post("/admin/cleanup", tags=["Admin"])
@limiter.limit("5/minute")
def run_cleanup(
    request      : Request,
    days         : int  = 30,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user : User = Depends(require_role(Role.ADMIN)),
    db           : Session = Depends(get_db),
):
    """Trigger background cleanup of request logs older than N days — admin only."""
    background_tasks.add_task(task_queue.cleanup_old_logs, db, min(days, 365))
    slog.info(
        f"Cleanup scheduled for logs older than {days} days",
        event="cleanup_scheduled", triggered_by=current_user.username,
    )
    return {
        "message"  : f"Background cleanup started — removing request_logs older than {days} days.",
        "scheduled": True,
    }


# =============================================================================
# ENTRY POINT
# =============================================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)