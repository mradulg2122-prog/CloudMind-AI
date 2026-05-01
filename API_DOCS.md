# CloudMind AI — API Reference (v5)

## Base URL

```
http://localhost:8000
```

Interactive docs: [http://localhost:8000/docs](http://localhost:8000/docs)  
ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## Authentication

All protected endpoints require a **Bearer token** in the `Authorization` header:

```http
Authorization: Bearer <your_jwt_token>
```

Obtain a token via `POST /auth/login`.

---

## Public Endpoints

### `GET /`
Welcome message and API version info.

**Response 200:**
```json
{
  "message": "CloudMind AI v5 — API is running.",
  "docs": "/docs",
  "version": "5.0.0",
  "features": ["RBAC", "XAI", "Reporting", "Rate Limiting", "Structured Logging",
               "Model Registry", "Health Monitoring", "Input Sanitization", "Background Tasks"]
}
```

---

### `GET /health`
Fast liveness probe — used by Docker HEALTHCHECK and load balancers.

**Response 200:**
```json
{
  "status": "alive",
  "service": "CloudMind AI",
  "version": "5.0.0",
  "timestamp": "2026-04-13T05:00:00Z",
  "uptime_s": 1234.5
}
```

---

### `GET /status`
Detailed multi-component health check. No authentication required.

**Response 200:**
```json
{
  "status": "healthy",
  "service": "CloudMind AI",
  "version": "5.0.0",
  "environment": "production",
  "timestamp": "2026-04-13T05:00:00Z",
  "uptime_s": 1234.5,
  "uptime_human": "20m 34s",
  "platform": { "python": "3.11.0", "os": "Linux", "arch": "x86_64" },
  "components": {
    "database": { "status": "ok", "users": 5, "predictions": 123, "reports": 58, "engine": "SQLite" },
    "ml_model":  { "status": "ok", "n_estimators": 200, "n_features": 39 },
    "logging":   { "status": "ok", "log_files": 4, "total_size_mb": 0.18, "writable": true },
    "disk":      { "status": "ok", "free_gb": 48.2, "used_percent": 34.1 }
  }
}
```

**Component status values:** `ok` | `warning` | `degraded` | `error` | `critical`

---

## Auth Endpoints

### `POST /auth/register`
Register a new user account.

**Rate limit:** 10/minute

**Request body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "Secure@Pass1"
}
```

**Password requirements:** Min 8 characters, must include uppercase, lowercase, digit, and special character.

**Response 201:**
```json
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "role": "user",
  "is_active": true,
  "created_at": "2026-01-01T12:00:00"
}
```

**Errors:**
| Code | Reason |
|------|--------|
| 400 | Username or email already taken |
| 422 | Validation error (weak password, bad email format, short username) |

---

### `POST /auth/login`
Authenticate and receive a JWT token.

**Rate limit:** 20/minute

**Request body:**
```json
{
  "username": "john_doe",
  "password": "Secure@Pass1"
}
```

**Response 200:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

---

### `GET /auth/me`
Return the current authenticated user's profile.

**Auth:** Bearer token required

**Response 200:**
```json
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "role": "user",
  "is_active": true,
  "created_at": "2026-01-01T12:00:00"
}
```

---

## Prediction Endpoints

### `POST /predict`
Run ML workload prediction with full XAI explanation.

**Auth:** Bearer token required (role: `user` or `admin`)  
**Rate limit:** 100/minute

**Request body:**
```json
{
  "requests_per_minute": 850,
  "cpu_usage_percent": 70,
  "memory_usage_percent": 65,
  "active_servers": 4,
  "hour": 14,
  "minute": 30,
  "response_time_ms": 120,
  "cost_per_server": 50
}
```

**Field constraints:**
| Field | Type | Range | Required |
|-------|------|--------|----------|
| `requests_per_minute` | float | ≥ 0 | ✅ |
| `cpu_usage_percent` | float | 0–100 | ✅ |
| `memory_usage_percent` | float | 0–100 | ✅ |
| `active_servers` | int | ≥ 1 | ✅ |
| `hour` | int | 0–23 | ✅ |
| `minute` | int | 0–59 | ✅ |
| `response_time_ms` | float | ≥ 0 | Default: 100 |
| `cost_per_server` | float | ≥ 0 | Default: 50 |

**Response 200:**
```json
{
  "predicted_requests": 923.5,
  "recommended_servers": 5,
  "action": "SCALE UP",
  "load_per_server": 184.7,
  "confidence_score": 0.8731,
  "confidence_label": "High",
  "reasoning_summary": "The model predicts workload will increase to 923 req/min in ~5 minutes...",
  "optimization_recommendations": [
    "📈 You are in a peak traffic window. Pre-warm capacity 10–15 min ahead...",
    "💡 Current infrastructure cost: $200.00/hour..."
  ],
  "risk_level": "medium",
  "report_id": 42
}
```

**Action values:** `SCALE UP` | `SCALE DOWN` | `KEEP SAME`  
**Confidence labels:** `Very High` | `High` | `Medium` | `Low`  
**Risk levels:** `low` | `medium` | `high` | `critical`

---

### `GET /explain/{prediction_id}`
Retrieve the stored XAI explanation for a specific prediction.

**Auth:** Bearer token required

**Response 200:**
```json
{
  "prediction_id": 42,
  "confidence_score": 0.8731,
  "confidence_label": "High",
  "reasoning_summary": "The model predicts workload will increase...",
  "feature_contributions": [
    {
      "feature": "requests_per_minute",
      "value": 850,
      "contribution": 0.45,
      "direction": "positive",
      "description": "Current traffic of 850 req/min is the strongest driver"
    }
  ],
  "recommendations": ["💰 Cost saving opportunity: ...", "💡 ..."],
  "risk_level": "medium",
  "risk_score": 0.38,
  "created_at": "2026-01-01T12:05:00"
}
```

---

### `GET /predictions/history`
Return recent predictions with XAI metadata for the current user.

**Auth:** Bearer token required  
**Query params:** `limit` (default: 50, max: 200)

---

## Analytics Endpoint

### `GET /analytics`
Aggregated metrics including XAI statistics for the current user.

**Auth:** Bearer token required

---

## Report Endpoints

### `GET /reports`
List all reports for the current user.

**Auth:** Bearer token required  
**Query params:** `limit` (default: 20), `report_type` (optional filter)

**Report types:** `cost_prediction` | `optimization_decision` | `historical_performance`

---

### `GET /reports/{report_id}`
Get full content of a specific report.

**Auth:** Bearer token required

**Response 200:**
```json
{
  "id": 1,
  "report_type": "optimization_decision",
  "title": "Optimization Report — SCALE UP (2026-01-01 12:05 UTC)",
  "content": { "...": "full report JSON" },
  "created_at": "2026-01-01T12:05:10"
}
```

---

### `POST /reports/historical`
Generate and store a historical performance report.

**Auth:** Bearer token required  
**Query params:** `days` (default: 7, max: 90)

---

### `GET /reports/export/json`
Download all reports as a JSON file.

**Auth:** Bearer token required  
**Response:** `application/json` file download (Content-Disposition: attachment)

---

### `GET /reports/export/csv`
Download report summary as CSV.

**Auth:** Bearer token required  
**Response:** `text/csv` file download

---

## Export Endpoints

### `GET /export/csv`
Download prediction history as CSV.

**Auth:** Bearer token required  
**Query params:** `limit` (default: 200, max: 1000)

**CSV columns:** `id, predicted_requests, recommended_servers, action, load_per_server, confidence_score, confidence_label, risk_level, created_at`

---

### `GET /export/pdf`
Download prediction summary as PDF (reportlab) or plaintext fallback.

**Auth:** Bearer token required

---

## Monitoring Endpoints

### `GET /metrics`
Operational metrics dashboard — **admin only**.

**Auth:** Bearer token required (role: `admin`)

**Response 200:**
```json
{
  "timestamp": "2026-04-13T05:00:00Z",
  "uptime_s": 3600,
  "predictions": {
    "total": 1502,
    "scale_up": 450,
    "scale_down": 600,
    "keep_same": 452,
    "scale_up_pct": 30.0,
    "scale_down_pct": 40.0
  },
  "users": { "total": 12, "active": 11, "admins": 2 },
  "reports": { "total": 89 },
  "api": { "recent_requests": 1000, "avg_latency_ms": 43.2, "error_rate_pct": 0.1 },
  "cost": { "current_servers": 4, "cost_per_server_hr": 50, "current_hourly_cost": 200 }
}
```

---

### `GET /alerts`
Return recent system alerts.

**Auth:** Bearer token required  
**Query params:** `limit` (default: 50, max: 200)

---

### `GET /logs`
Return API request logs — **admin only**.

**Auth:** Bearer token required (role: `admin`)

---

## Admin Endpoints

### `GET /admin/users`
List all registered users.

**Auth:** Bearer token required (role: `admin`)

---

### `PATCH /admin/users/{username}/role`
Update a user's role.

**Auth:** Bearer token required (role: `admin`)

**Request body:**
```json
{ "role": "admin" }
```

**Valid roles:** `viewer` | `user` | `admin`

---

### `POST /retrain/trigger`
Manually trigger ML model retraining + auto-register new version.

**Auth:** Bearer token required (role: `admin`)  
**Rate limit:** 2/minute

**Response 200:**
```json
{
  "status": "success",
  "samples_used": 250,
  "new_model_mae": 12.45,
  "model_replaced": true,
  "backup_path": "/app/backend/model_backups/cloudmind_model_20260101_020000.joblib",
  "completed": "2026-01-01T02:03:45Z"
}
```

---

## Model Registry Endpoints

### `GET /admin/model/versions`
List all registered model versions.

**Auth:** Bearer token required (role: `admin`)

**Response 200:**
```json
{
  "current_version": {
    "version_id"   : "v20260101_120000",
    "version_label": "v2.0.0",
    "is_current"   : true,
    "registered_at": "2026-01-01T12:00:00Z",
    "metrics"      : { "mae": 12.45, "r2_score": 0.97 }
  },
  "total_versions": 3,
  "versions": [...]
}
```

---

### `POST /admin/model/register`
Register the current active model as a named version.

**Auth:** Bearer token required (role: `admin`)

**Request body:**
```json
{
  "version_label": "v2.0.0",
  "description"  : "Retrained with 6 months of production data",
  "n_samples"    : 50000
}
```

---

### `POST /admin/model/rollback`
Roll back the active ML model to a previous version.

**Auth:** Bearer token required (role: `admin`)

**Request body:**
```json
{ "version_id": "v20260101_120000" }
```

> ⚠️ After rollback, restart the service for the change to take effect.

---

### `POST /admin/cleanup`
Trigger background cleanup of old request logs.

**Auth:** Bearer token required (role: `admin`)  
**Query params:** `days` (default: 30, max: 365)

**Response 200:**
```json
{
  "message"  : "Background cleanup started — removing request_logs older than 30 days.",
  "scheduled": true
}
```

---

## Error Response Format

All errors follow this structure:

```json
{
  "detail": "Descriptive error message here."
}
```

| HTTP Code | Meaning |
|-----------|---------|
| 400 | Bad request (duplicate user, invalid role, invalid version_id) |
| 401 | Unauthorized (missing/invalid/expired token) |
| 403 | Forbidden (insufficient role) |
| 404 | Resource not found |
| 422 | Validation error (field constraints violated) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
