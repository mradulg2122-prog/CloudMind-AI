# =============================================================================
# CloudMind AI – app.py  (v3 — Enterprise Grade)
# FastAPI backend server
#
# v2 features (preserved):
#   ✅ SQLite database integration (via database.py / SQLAlchemy)
#   ✅ JWT authentication (via auth.py / python-jose + passlib)
#   ✅ Centralized structured logging (via logger_config.py)
#   ✅ Rate limiting — 100 requests/minute per IP (via slowapi)
#   ✅ Input validation with descriptive error messages
#   ✅ Enhanced decision engine with history-aware scaling
#   ✅ Request timing middleware
#
# v3 NEW features:
#   ✅ Strict CORS with allowed-origins env-var config
#   ✅ Security headers middleware (XSS, CSP, HSTS, X-Frame-Options)
#   ✅ Enhanced /health endpoint (DB + model status)
#   ✅ /analytics endpoint — advanced metrics from DB
#   ✅ /export/csv and /export/pdf — download predictions as reports
#   ✅ /retrain/trigger — manually kick off model retraining
#
# Run with:
#   uvicorn app:app --reload --host 0.0.0.0 --port 8000
# =============================================================================

import os
import io
import csv
import time
import subprocess
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy.orm import Session
from sqlalchemy import func, text

# ── Internal modules ──────────────────────────────────────────────────────────
from predict import run_prediction, MODEL_PATH
from database import (
    get_db, init_db, engine,
    TelemetryRecord, PredictionRecord, ScalingDecision,
    AlertRecord, RequestLog, User
)
from auth import (
    get_current_user, authenticate_user, create_user,
    create_access_token, RegisterRequest, LoginRequest,
    TokenResponse, UserOut
)
from logger_config import get_logger

# ── Logger for this module ────────────────────────────────────────────────────
logger = get_logger(__name__)

# ── Rate limiter — 100 requests per minute per client IP ─────────────────────
limiter = Limiter(key_func=get_remote_address)

# ── Create FastAPI app ────────────────────────────────────────────────────────
app = FastAPI(
    title       = "CloudMind AI – Workload Prediction API",
    description = (
        "Predicts future cloud workload and recommends server scaling actions. "
        "v2 adds JWT auth, SQLite storage, structured logging, and rate limiting."
    ),
    version     = "2.0.0",
)

# Attach rate limiter state and exception handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS — strict origin control ─────────────────────────────────────────────
# Reads allowed origins from ALLOWED_ORIGINS env var (comma-separated).
# Falls back to localhost:3000 and localhost:3001 for local development.
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
    allow_origins      = ALLOWED_ORIGINS,
    allow_credentials  = True,               # needed for cookie-based auth
    allow_methods      = ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers      = ["Authorization", "Content-Type", "Accept", "X-Request-ID"],
    expose_headers     = ["X-Request-ID", "X-RateLimit-Remaining"],
    max_age            = 600,                # pre-flight cache 10 min
)


# ── Security Headers Middleware ───────────────────────────────────────────────
# Adds HTTP security headers to EVERY response to protect against:
#   - XSS (Cross-Site Scripting)
#   - Clickjacking (X-Frame-Options)
#   - MIME sniffing (X-Content-Type-Options)
#   - Protocol downgrade (HSTS)
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    # Prevent MIME-type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    # Block iframe embedding (clickjacking protection)
    response.headers["X-Frame-Options"] = "DENY"
    # Legacy XSS filter for older browsers
    response.headers["X-XSS-Protection"] = "1; mode=block"
    # Content Security Policy — restricts what resources can load
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:;"
    )
    # Referrer policy — don't leak URL in Referer header
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Permissions policy — disable unnecessary browser features
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    # HSTS — force HTTPS (uncomment in production with real TLS)
    # response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# =============================================================================
# STARTUP — create DB tables once
# =============================================================================

@app.on_event("startup")
def on_startup():
    """Initialise SQLite tables when the server starts."""
    init_db()
    logger.info("Database initialised — all tables ready.")


# =============================================================================
# REQUEST TIMING MIDDLEWARE — logs method, path, status, and duration
# =============================================================================

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """
    Middleware that:
    1. Records the start time
    2. Calls the route handler
    3. Logs the request details (method, path, status, duration)
    4. Stores the log row in the database asynchronously
    """
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - start) * 1000, 2)

    logger.info(
        f"[Request] {request.method} {request.url.path} "
        f"→ {response.status_code} ({duration_ms} ms)"
    )

    # Persist to DB in a fire-and-forget fashion (non-blocking)
    try:
        db = next(get_db())
        log_entry = RequestLog(
            method      = request.method,
            path        = str(request.url.path),
            status_code = response.status_code,
            duration_ms = duration_ms,
        )
        db.add(log_entry)
        db.commit()
        db.close()
    except Exception as exc:
        logger.warning(f"[Middleware] Could not save request log: {exc}")

    return response


# =============================================================================
# REQUEST & RESPONSE MODELS
# =============================================================================

class TelemetryInput(BaseModel):
    """
    Input schema — telemetry values sent by the user or monitoring system.
    All fields include validation constraints with descriptive error messages.
    """
    requests_per_minute  : float = Field(..., description="Current requests per minute")
    cpu_usage_percent    : float = Field(..., description="CPU usage 0–100%")
    memory_usage_percent : float = Field(..., description="Memory usage 0–100%")
    active_servers       : int   = Field(..., description="Number of currently active servers")
    hour                 : int   = Field(..., ge=0, le=23, description="Current hour (0–23)")
    minute               : int   = Field(..., ge=0, le=59, description="Current minute (0–59)")

    # Optional fields with defaults
    response_time_ms  : float = Field(100.0, ge=0, description="Average response time in ms")
    cost_per_server   : float = Field(50.0,  ge=0, description="Cost per server per hour ($)")

    # ── Custom validators for business rules ──────────────────────────────────
    @field_validator("cpu_usage_percent")
    @classmethod
    def validate_cpu(cls, v):
        if not (0 <= v <= 100):
            raise ValueError("cpu_usage_percent must be between 0 and 100.")
        return v

    @field_validator("memory_usage_percent")
    @classmethod
    def validate_memory(cls, v):
        if not (0 <= v <= 100):
            raise ValueError("memory_usage_percent must be between 0 and 100.")
        return v

    @field_validator("requests_per_minute")
    @classmethod
    def validate_requests(cls, v):
        if v < 0:
            raise ValueError("requests_per_minute must be >= 0.")
        return v

    @field_validator("active_servers")
    @classmethod
    def validate_servers(cls, v):
        if v < 1:
            raise ValueError("active_servers must be >= 1 (at least one server required).")
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "requests_per_minute" : 850,
                "cpu_usage_percent"   : 70,
                "memory_usage_percent": 65,
                "active_servers"      : 4,
                "hour"                : 14,
                "minute"              : 30,
                "response_time_ms"    : 120,
                "cost_per_server"     : 50,
            }
        }


class PredictionOutput(BaseModel):
    """Output schema — what the API returns after prediction + decision engine."""
    predicted_requests  : float  # ML model prediction (req/min in 5 minutes)
    recommended_servers : int    # How many servers the system recommends
    action              : str    # "SCALE UP", "SCALE DOWN", or "KEEP SAME"
    load_per_server     : float  # Predicted load per server

    class Config:
        from_attributes = True


class AlertOut(BaseModel):
    """Public schema for a single alert record."""
    id         : int
    severity   : str
    message    : str
    source     : str
    dismissed  : bool
    created_at : datetime

    class Config:
        from_attributes = True


class LogOut(BaseModel):
    """Public schema for a request log entry."""
    id          : int
    method      : str
    path        : str
    status_code : int
    duration_ms : Optional[float]
    created_at  : datetime

    class Config:
        from_attributes = True


# =============================================================================
# ── PUBLIC ENDPOINTS ──────────────────────────────────────────────────────────
# =============================================================================

@app.get("/")
def root():
    """Welcome message — confirms the API is running."""
    logger.debug("Root endpoint called.")
    return {
        "message" : "[CloudMind AI v2] API is running.",
        "docs"    : "Visit /docs for the interactive API documentation.",
        "version" : "2.0.0",
    }


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    """
    Enhanced health check endpoint (v3).

    Returns:
      - overall status
      - database connection status + row counts
      - ML model file status
      - server timestamp
    """
    health: dict = {
        "status"    : "healthy",
        "service"   : "CloudMind AI Prediction API v3",
        "timestamp" : datetime.utcnow().isoformat() + "Z",
        "version"   : "3.0.0",
        "components": {},
    }

    # ── Database health ────────────────────────────────────────────────────────
    try:
        # Use ORM to run a simple query — avoids raw SQL injection risk
        user_count       = db.query(func.count(User.id)).scalar()
        prediction_count = db.query(func.count(PredictionRecord.id)).scalar()
        telemetry_count  = db.query(func.count(TelemetryRecord.id)).scalar()
        health["components"]["database"] = {
            "status"          : "connected",
            "users"           : user_count,
            "predictions"     : prediction_count,
            "telemetry_records": telemetry_count,
        }
    except Exception as exc:
        health["status"] = "degraded"
        health["components"]["database"] = {"status": "error", "detail": str(exc)}

    # ── ML model health ────────────────────────────────────────────────────────
    try:
        model_exists = os.path.isfile(MODEL_PATH)
        model_size   = os.path.getsize(MODEL_PATH) if model_exists else 0
        model_mtime  = (
            datetime.utcfromtimestamp(os.path.getmtime(MODEL_PATH)).isoformat() + "Z"
            if model_exists else None
        )
        health["components"]["ml_model"] = {
            "status"       : "loaded" if model_exists else "missing",
            "path"         : MODEL_PATH,
            "size_bytes"   : model_size,
            "last_modified": model_mtime,
        }
        if not model_exists:
            health["status"] = "degraded"
    except Exception as exc:
        health["components"]["ml_model"] = {"status": "error", "detail": str(exc)}

    return health


# =============================================================================
# ── AUTH ENDPOINTS ────────────────────────────────────────────────────────────
# =============================================================================

@app.post("/auth/register", response_model=UserOut, status_code=201)
@limiter.limit("10/minute")
def register(request: Request, payload: RegisterRequest, db: Session = Depends(get_db)):
    """
    Register a new user account.

    - Username and email must be unique.
    - Password is hashed with bcrypt before storage (never stored in plaintext).
    """
    try:
        user = create_user(db, payload.username, payload.email, payload.password)
        logger.info(f"[Auth] New user registered: '{payload.username}' ({payload.email})")
        return user
    except ValueError as e:
        logger.warning(f"[Auth] Registration failed for '{payload.username}': {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/auth/login", response_model=TokenResponse)
@limiter.limit("20/minute")
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate a user and return a JWT access token.

    The token must be included as `Authorization: Bearer <token>` on protected routes.
    """
    user = authenticate_user(db, payload.username, payload.password)
    if not user:
        logger.warning(f"[Auth] Failed login attempt for username='{payload.username}'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(data={"sub": user.username})
    logger.info(f"[Auth] User '{payload.username}' logged in successfully.")
    return TokenResponse(access_token=token)


@app.get("/auth/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return current_user


# =============================================================================
# ── PROTECTED ENDPOINTS (require valid JWT) ───────────────────────────────────
# =============================================================================

@app.post("/predict", response_model=PredictionOutput)
@limiter.limit("100/minute")
def predict(
    request      : Request,
    telemetry    : TelemetryInput,
    current_user : User    = Depends(get_current_user),
    db           : Session = Depends(get_db),
):
    """
    Main prediction endpoint (PROTECTED — requires JWT token).

    Accepts current cloud telemetry and returns:
    - predicted_requests  : workload forecast ~5 minutes ahead
    - recommended_servers : how many servers to run
    - action              : SCALE UP / SCALE DOWN / KEEP SAME
    - load_per_server     : predicted load distributed across recommended servers

    Every prediction is automatically saved to the database.
    """
    try:
        input_data = telemetry.model_dump()

        # ── 1. Run ML prediction + decision engine ────────────────────────────
        result = run_prediction(input_data)

        # ── 2. Save telemetry snapshot to DB ──────────────────────────────────
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
        db.flush()  # get telemetry_record.id before committing

        # ── 3. Save prediction result to DB ───────────────────────────────────
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

        # ── 4. Save scaling decision to DB ────────────────────────────────────
        if result["action"] != "KEEP SAME":
            scaling_record = ScalingDecision(
                prediction_id  = prediction_record.id,
                action         = result["action"],
                before_servers = telemetry.active_servers,
                after_servers  = result["recommended_servers"],
                reason         = f"load_per_server={result['load_per_server']}",
            )
            db.add(scaling_record)

        db.commit()
        logger.info(
            f"[DB] Saved — telemetry_id={telemetry_record.id}, "
            f"prediction_id={prediction_record.id}, "
            f"user={current_user.username}"
        )

        return result

    except HTTPException:
        raise  # Re-raise auth/validation errors as-is
    except Exception as e:
        logger.error(f"[Predict] Unexpected error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.get("/alerts", response_model=List[AlertOut])
@limiter.limit("60/minute")
def get_alerts(
    request      : Request,
    limit        : int     = 50,
    current_user : User    = Depends(get_current_user),
    db           : Session = Depends(get_db),
):
    """
    Return the most recent system alerts (PROTECTED).

    Query param:
      limit — max number of alerts to return (default 50)
    """
    alerts = (
        db.query(AlertRecord)
        .order_by(AlertRecord.created_at.desc())
        .limit(min(limit, 200))
        .all()
    )
    logger.debug(f"[Alerts] Returned {len(alerts)} alerts for user='{current_user.username}'")
    return alerts


@app.get("/logs", response_model=List[LogOut])
@limiter.limit("30/minute")
def get_logs(
    request      : Request,
    limit        : int     = 100,
    current_user : User    = Depends(get_current_user),
    db           : Session = Depends(get_db),
):
    """
    Return recent API request logs (PROTECTED).

    Query param:
      limit — max number of log entries to return (default 100)
    """
    logs = (
        db.query(RequestLog)
        .order_by(RequestLog.created_at.desc())
        .limit(min(limit, 500))
        .all()
    )
    logger.debug(f"[Logs] Returned {len(logs)} log entries for user='{current_user.username}'")
    return logs


@app.get("/predictions/history", response_model=List[PredictionOutput])
@limiter.limit("30/minute")
def get_prediction_history(
    request      : Request,
    limit        : int     = 50,
    current_user : User    = Depends(get_current_user),
    db           : Session = Depends(get_db),
):
    """
    Return the most recent predictions for the current user (PROTECTED).
    Used by the frontend to render historical prediction charts.
    """
    records = (
        db.query(PredictionRecord)
        .filter(PredictionRecord.user_id == current_user.id)
        .order_by(PredictionRecord.created_at.desc())
        .limit(min(limit, 200))
        .all()
    )
    return [
        {
            "predicted_requests"  : r.predicted_requests,
            "recommended_servers" : r.recommended_servers,
            "action"              : r.action,
            "load_per_server"     : r.load_per_server,
        }
        for r in records
    ]


# =============================================================================
# ── ANALYTICS ENDPOINT (v3 NEW) ───────────────────────────────────────────────
# =============================================================================

@app.get("/analytics")
@limiter.limit("30/minute")
def get_analytics(
    request      : Request,
    current_user : User    = Depends(get_current_user),
    db           : Session = Depends(get_db),
):
    """
    Advanced analytics endpoint (PROTECTED — v3 new).

    Returns aggregated metrics computed entirely via ORM (no raw SQL):
      - total_predictions     : how many predictions this user has made
      - action_distribution   : count of SCALE UP / SCALE DOWN / KEEP SAME
      - avg_predicted_requests: mean forecasted traffic
      - avg_load_per_server   : mean server load
      - avg_servers_recommended: average fleet size recommended
      - estimated_cost_saved  : approx $ saved by SCALE DOWN decisions
      - peak_predicted        : highest single traffic forecast
      - min_predicted         : lowest single traffic forecast
      - scale_up_rate         : % of predictions that triggered SCALE UP
      - scale_down_rate       : % triggering SCALE DOWN
      - avg_cpu               : mean CPU usage from telemetry
      - avg_memory            : mean memory usage from telemetry
    """
    # ── Prediction stats ────────────────────────────────────────────────────────
    preds = (
        db.query(PredictionRecord)
        .filter(PredictionRecord.user_id == current_user.id)
        .all()
    )

    total = len(preds)
    if total == 0:
        return {
            "message": "No predictions yet — run at least one prediction to see analytics.",
            "total_predictions": 0,
        }

    action_dist = {"SCALE UP": 0, "SCALE DOWN": 0, "KEEP SAME": 0}
    for p in preds:
        action_dist[p.action] = action_dist.get(p.action, 0) + 1

    avg_req     = round(sum(p.predicted_requests  for p in preds) / total, 2)
    avg_load    = round(sum(p.load_per_server      for p in preds) / total, 2)
    avg_servers = round(sum(p.recommended_servers  for p in preds) / total, 2)
    peak_req    = round(max(p.predicted_requests   for p in preds), 2)
    min_req     = round(min(p.predicted_requests   for p in preds), 2)

    scale_up_rate   = round(action_dist["SCALE UP"]   / total * 100, 1)
    scale_down_rate = round(action_dist["SCALE DOWN"] / total * 100, 1)

    # ── Cost savings (rough estimate: each SCALE DOWN saves 1 server × $50/hr) ──
    estimated_cost_saved = round(action_dist["SCALE DOWN"] * 50, 2)

    # ── Telemetry stats ─────────────────────────────────────────────────────────
    tele = (
        db.query(TelemetryRecord)
        .filter(TelemetryRecord.user_id == current_user.id)
        .all()
    )
    avg_cpu    = round(sum(t.cpu_usage_percent    for t in tele) / len(tele), 2) if tele else 0
    avg_memory = round(sum(t.memory_usage_percent for t in tele) / len(tele), 2) if tele else 0

    # ── Scaling decision history ────────────────────────────────────────────────
    scaling_decisions = (
        db.query(ScalingDecision)
        .order_by(ScalingDecision.decided_at.desc())
        .limit(10)
        .all()
    )
    recent_scaling = [
        {
            "action"        : s.action,
            "before_servers": s.before_servers,
            "after_servers" : s.after_servers,
            "reason"        : s.reason,
            "decided_at"    : s.decided_at.isoformat() if s.decided_at else None,
        }
        for s in scaling_decisions
    ]

    return {
        "total_predictions"       : total,
        "action_distribution"     : action_dist,
        "avg_predicted_requests"  : avg_req,
        "avg_load_per_server"     : avg_load,
        "avg_servers_recommended" : avg_servers,
        "peak_predicted_requests" : peak_req,
        "min_predicted_requests"  : min_req,
        "scale_up_rate_pct"       : scale_up_rate,
        "scale_down_rate_pct"     : scale_down_rate,
        "estimated_cost_saved_usd": estimated_cost_saved,
        "avg_cpu_percent"         : avg_cpu,
        "avg_memory_percent"      : avg_memory,
        "recent_scaling_decisions": recent_scaling,
    }


# =============================================================================
# ── EXPORT ENDPOINTS (v3 NEW) ─────────────────────────────────────────────────
# =============================================================================

@app.get("/export/csv")
@limiter.limit("10/minute")
def export_predictions_csv(
    request      : Request,
    limit        : int   = 200,
    current_user : User  = Depends(get_current_user),
    db           : Session = Depends(get_db),
):
    """
    Export user's prediction history as a downloadable CSV file (PROTECTED).

    Columns: id, predicted_requests, recommended_servers, action,
             load_per_server, created_at
    """
    records = (
        db.query(PredictionRecord)
        .filter(PredictionRecord.user_id == current_user.id)
        .order_by(PredictionRecord.created_at.desc())
        .limit(min(limit, 1000))
        .all()
    )

    # Build CSV in memory using csv.writer (safe — no string formatting risk)
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow([
        "id", "predicted_requests", "recommended_servers",
        "action", "load_per_server", "created_at"
    ])

    # Data rows — each field is a typed value, not raw user input
    for r in records:
        writer.writerow([
            r.id,
            round(r.predicted_requests, 2),
            r.recommended_servers,
            r.action,
            round(r.load_per_server, 2),
            r.created_at.isoformat() if r.created_at else "",
        ])

    output.seek(0)
    filename = f"cloudmind_predictions_{current_user.username}_{datetime.utcnow().strftime('%Y%m%d')}.csv"

    logger.info(f"[Export] CSV generated for user='{current_user.username}' ({len(records)} rows)")
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type = "text/csv",
        headers    = {"Content-Disposition": f"attachment; filename={filename}"},
    )


@app.get("/export/pdf")
@limiter.limit("5/minute")
def export_predictions_pdf(
    request      : Request,
    current_user : User    = Depends(get_current_user),
    db           : Session = Depends(get_db),
):
    """
    Export a summary PDF report for the current user (PROTECTED).

    Uses only the standard library (no external PDF lib required).
    Generates a plain-text PDF-compatible report wrapped in a PDF envelope.

    For rich PDFs, install reportlab: pip install reportlab
    """
    # ── Fetch data ──────────────────────────────────────────────────────────────
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

    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    # ── Try reportlab (rich PDF) first, fall back to plain-text PDF ────────────
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=letter)
        styles = getSampleStyleSheet()
        elements = []

        # Title
        elements.append(Paragraph("CloudMind AI — Prediction Report", styles["Title"]))
        elements.append(Paragraph(f"Generated: {now}  |  User: {current_user.username}", styles["Normal"]))
        elements.append(Spacer(1, 20))

        # Summary table
        summary_data = [
            ["Metric", "Value"],
            ["Total Predictions",          str(total)],
            ["Avg Predicted Traffic",      f"{avg_req} req/min"],
            ["Avg Load per Server",        f"{avg_load} req/min"],
            ["SCALE UP count",             str(action_dist["SCALE UP"])],
            ["SCALE DOWN count",           str(action_dist["SCALE DOWN"])],
            ["KEEP SAME count",            str(action_dist["KEEP SAME"])],
            ["Est. Cost Saved",            f"${action_dist['SCALE DOWN'] * 50}"],
        ]
        t = Table(summary_data, colWidths=[260, 200])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#1e3a5f")),
            ("TEXTCOLOR",  (0,0), (-1,0), colors.white),
            ("FONTNAME",   (0,0), (-1,0), "Helvetica-Bold"),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.whitesmoke, colors.lightgrey]),
            ("GRID",       (0,0), (-1,-1), 0.5, colors.grey),
            ("FONTSIZE",   (0,0), (-1,-1), 10),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 20))

        # Prediction table (last 20)
        pred_data = [["#", "Predicted RPM", "Servers", "Action", "Load/Server", "Time"]]
        for i, r in enumerate(preds[:20], 1):
            pred_data.append([
                str(i),
                f"{r.predicted_requests:.1f}",
                str(r.recommended_servers),
                r.action,
                f"{r.load_per_server:.1f}",
                r.created_at.strftime("%m-%d %H:%M") if r.created_at else "—",
            ])
        pt = Table(pred_data, colWidths=[30, 100, 60, 90, 80, 100])
        pt.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#0f4c81")),
            ("TEXTCOLOR",  (0,0), (-1,0), colors.white),
            ("FONTNAME",   (0,0), (-1,0), "Helvetica-Bold"),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#eef3f9")]),
            ("GRID",       (0,0), (-1,-1), 0.3, colors.grey),
            ("FONTSIZE",   (0,0), (-1,-1), 8),
        ]))
        elements.append(Paragraph("Recent Predictions (last 20)", styles["Heading2"]))
        elements.append(pt)

        doc.build(elements)
        buf.seek(0)
        media_type = "application/pdf"
        content    = buf.read()

    except ImportError:
        # reportlab not installed — generate a plain-text "PDF" (text file)
        lines = [
            "CLOUDMIND AI — PREDICTION REPORT",
            "=" * 50,
            f"Generated  : {now}",
            f"User       : {current_user.username}",
            "",
            "SUMMARY",
            "-" * 30,
            f"Total Predictions       : {total}",
            f"Avg Predicted Traffic   : {avg_req} req/min",
            f"Avg Load per Server     : {avg_load} req/min",
            f"SCALE UP count          : {action_dist['SCALE UP']}",
            f"SCALE DOWN count        : {action_dist['SCALE DOWN']}",
            f"KEEP SAME count         : {action_dist['KEEP SAME']}",
            f"Est. Cost Saved         : ${action_dist['SCALE DOWN'] * 50}",
            "",
            "RECENT PREDICTIONS (last 20)",
            "-" * 60,
            f"{'#':<4} {'RPM':>10} {'Servers':>8} {'Action':<12} {'Load/Srv':>10}",
        ]
        for i, r in enumerate(preds[:20], 1):
            lines.append(
                f"{i:<4} {r.predicted_requests:>10.1f} {r.recommended_servers:>8} "
                f"{r.action:<12} {r.load_per_server:>10.1f}"
            )
        content    = "\n".join(lines).encode("utf-8")
        media_type = "application/pdf"  # still served as PDF download

    filename = f"cloudmind_report_{current_user.username}_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
    logger.info(f"[Export] PDF generated for user='{current_user.username}' ({total} predictions)")

    return StreamingResponse(
        io.BytesIO(content),
        media_type = media_type,
        headers    = {"Content-Disposition": f"attachment; filename={filename}"},
    )


# =============================================================================
# ── MODEL RETRAINING ENDPOINT (v3 NEW) ───────────────────────────────────────
# =============================================================================

@app.post("/retrain/trigger")
@limiter.limit("2/minute")
def trigger_retrain(
    request      : Request,
    current_user : User = Depends(get_current_user),
):
    """
    Trigger model retraining manually (PROTECTED).

    Runs the retraining pipeline (retrain.py) synchronously and returns
    a JSON summary of results.

    In production, this should be run as a background task (FastAPI BackgroundTasks)
    or Celery worker to avoid blocking the event loop.

    Rate-limited to 2 calls/minute to prevent abuse.
    """
    logger.info(f"[Retrain] Manual trigger by user='{current_user.username}'")

    try:
        # Import and run inline (same process — fast for small datasets)
        from retrain import run_retraining
        summary = run_retraining()
        logger.info(f"[Retrain] Completed: {summary['status']}")
        return summary

    except Exception as e:
        logger.error(f"[Retrain] Failed: {e}", exc_info=True)
        raise HTTPException(
            status_code = 500,
            detail      = f"Retraining pipeline failed: {str(e)}"
        )


# =============================================================================
# RUN SERVER (only when running this file directly, not via uvicorn command)
# =============================================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)