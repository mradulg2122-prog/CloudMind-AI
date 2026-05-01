# CloudMind AI — Architecture (v5)

## System Architecture Diagram

```mermaid
graph TB
    subgraph Client["🖥️ Client Layer"]
        UI[Next.js Frontend<br/>React + Recharts<br/>Port 3000]
    end

    subgraph API["⚡ API Layer (FastAPI v5)"]
        GW[API Gateway<br/>app.py]
        MW[Middleware Stack<br/>CORS · Security Headers<br/>Rate Limiting · Request Logging<br/>Input Sanitization]
        AUTH[Auth Endpoints<br/>/auth/register · /auth/login · /auth/me]
        PRED[Prediction Endpoint<br/>POST /predict]
        XAI[Explanation Endpoints<br/>GET /explain/{id}]
        RPT[Report Endpoints<br/>GET/POST /reports]
        ADM[Admin Endpoints<br/>/admin/users · /admin/model/* · /retrain/trigger]
        EXP[Export Endpoints<br/>/export/csv · /export/pdf]
        HEALTH[Health Endpoints<br/>GET /health · GET /status · GET /metrics]
    end

    subgraph SVC["🔧 Service Layer"]
        RBAC[RBAC Service<br/>services/rbac.py<br/>viewer · user · admin]
        XAISVC[XAI Engine<br/>services/explain_service.py<br/>Confidence · Reasoning · Risk]
        RPTSVC[Report Service<br/>services/report_service.py<br/>Cost · Optimization · Historical]
        LOGSVC[Logging Service<br/>services/logging_service.py<br/>JSON Structured Logs]
        HEALTHSVC[Health Service<br/>services/health_service.py<br/>Liveness · Status · Metrics]
        TASKSVC[Task Queue<br/>services/task_queue.py<br/>Async · Retry · Warmup]
        REGSVC[Model Registry<br/>services/model_registry.py<br/>Versions · Rollback · Metadata]
        SANSVC[Sanitization<br/>services/sanitization_service.py<br/>XSS · SQLi · PathTraversal]
    end

    subgraph ML["🤖 ML Layer"]
        FEAT[Feature Engineering<br/>39 features · cyclic time encoding<br/>lag features · rolling averages]
        MODEL[RandomForest Model<br/>cloudmind_workload_model.joblib<br/>200 estimators · depth 15]
        DECIDE[Decision Engine<br/>predict.py<br/>Historical avg · Peak detection]
        RETRAIN[Retraining Pipeline<br/>retrain.py<br/>DB-driven retraining]
    end

    subgraph DATA["💾 Data Layer (SQLAlchemy)"]
        DB[(SQLite / PostgreSQL<br/>cloudmind.db)]
        T1[users]
        T2[telemetry]
        T3[predictions]
        T4[prediction_explanations]
        T5[scaling_decisions]
        T6[alerts]
        T7[request_logs]
        T8[reports]
        T9[model_versions]
    end

    subgraph SEC["🔒 Security Layer"]
        JWT[JWT Auth<br/>python-jose · HS256<br/>1hr expiry]
        BCRYPT[bcrypt hashing<br/>passlib]
        RATE[Rate Limiting<br/>slowapi<br/>100 req/min]
        HDR[Security Headers<br/>CSP · HSTS · X-Frame-Options<br/>XSS Protection]
        CORS_MW[CORS Middleware<br/>Allowlist-based<br/>env-configurable]
    end

    subgraph LOG["📊 Logging Layer"]
        APPLOG[app_structured.jsonl<br/>JSON structured logs]
        PREDLOG[predictions.jsonl<br/>ML prediction audit log]
        SECLOG[security.jsonl<br/>Auth + RBAC events]
        PERFLOG[performance.jsonl<br/>API latency tracking]
    end

    UI -->|HTTP REST| GW
    GW --> MW
    MW --> AUTH
    MW --> PRED
    MW --> XAI
    MW --> RPT
    MW --> ADM
    MW --> EXP
    MW --> HEALTH

    AUTH --> JWT
    AUTH --> BCRYPT

    PRED --> RBAC
    PRED --> SANSVC
    PRED --> FEAT
    FEAT --> MODEL
    MODEL --> DECIDE
    DECIDE --> XAISVC
    DECIDE --> RPTSVC
    DECIDE --> TASKSVC

    ADM --> RBAC
    ADM --> RETRAIN
    ADM --> REGSVC

    HEALTH --> HEALTHSVC
    HEALTHSVC --> DATA

    XAISVC --> DATA
    RPTSVC --> DATA
    REGSVC --> DATA
    RBAC --> SEC

    MW --> RATE
    MW --> CORS_MW
    GW --> HDR
    GW --> LOGSVC

    LOGSVC --> APPLOG
    LOGSVC --> PREDLOG
    LOGSVC --> SECLOG
    LOGSVC --> PERFLOG

    DATA --> DB
    DB --- T1
    DB --- T2
    DB --- T3
    DB --- T4
    DB --- T5
    DB --- T6
    DB --- T7
    DB --- T8
    DB --- T9
```

## Layer Descriptions

### API Layer (`backend/app.py`)
The FastAPI v5 application is the entry point for all HTTP traffic. It orchestrates middleware, routes, and service calls. All routes are tagged for OpenAPI documentation at `/docs`.

| Endpoint Group | Routes | Auth Required | Role Required |
|---|---|---|---|
| Public | `GET /`, `GET /health`, `GET /status` | No | — |
| Auth | `/auth/register`, `/auth/login`, `/auth/me` | Login required for `/me` | — |
| Prediction | `POST /predict`, `GET /predictions/history` | Yes | `user` |
| XAI | `GET /explain/{id}` | Yes | `user` |
| Analytics | `GET /analytics`, `GET /export/csv`, `GET /export/pdf` | Yes | `user` |
| Reports | `GET /reports`, `GET /reports/{id}`, `POST /reports/historical` | Yes | `user` |
| Report Export | `GET /reports/export/json`, `GET /reports/export/csv` | Yes | `user` |
| Admin | `GET /admin/users`, `PATCH /admin/users/{u}/role`, `POST /retrain/trigger` | Yes | `admin` |
| Model Registry | `GET /admin/model/versions`, `POST /admin/model/register`, `POST /admin/model/rollback` | Yes | `admin` |
| Monitoring | `GET /metrics`, `GET /alerts`, `GET /logs` | Yes | `admin` (metrics/logs) |
| Cleanup | `POST /admin/cleanup` | Yes | `admin` |

### Service Layer (`backend/services/`)
Clean separation of business logic from HTTP handling:

| Service | File | Responsibility |
|---|---|---|
| RBAC | `rbac.py` | Role validation, `require_role()` dependency |
| XAI Engine | `explain_service.py` | Confidence scores, feature contributions, NL reasoning |
| Report Service | `report_service.py` | Report generation, storage, and export |
| Logging Service | `logging_service.py` | JSON structured logging to 4 separate log streams |
| Health Service | `health_service.py` | Liveness probe, full component status, operational metrics |
| Task Queue | `task_queue.py` | Async background tasks with exponential-backoff retry |
| Model Registry | `model_registry.py` | Model version tracking, rollback, metadata persistence |
| Sanitization | `sanitization_service.py` | XSS, SQL injection, path traversal protection |

### ML Layer
- **`predict.py`** — Feature engineering (39 features), model inference, history-aware decision engine
- **`retrain.py`** — Full pipeline: fetch DB data → engineer features → train → evaluate → save → auto-register

### Data Layer (`backend/database.py`)
SQLAlchemy ORM with **9 normalized tables**. Compatible with both SQLite (dev) and PostgreSQL (production) by setting `DATABASE_URL` env variable.

| Table | Purpose |
|---|---|
| `users` | RBAC-enabled user accounts |
| `telemetry` | Raw input snapshots per prediction |
| `predictions` | ML model output per request |
| `prediction_explanations` | XAI output (confidence, features, risk) |
| `scaling_decisions` | Scale up/down events triggered |
| `alerts` | System threshold breach events |
| `request_logs` | API audit trail (method, path, latency) |
| `reports` | Generated cost/optimization/historical reports |
| `model_versions` | ML model version registry with metrics |

### Security Layer
| Control | Implementation |
|---|---|
| Authentication | JWT (HS256), 1hr expiry, iat + type claims |
| Passwords | bcrypt with automatic fallback to sha256_crypt |
| Password Policy | Min 8 chars, uppercase, digit, special char (regex-enforced) |
| Authorization | RBAC (viewer / user / admin) via FastAPI dependency |
| Rate Limiting | slowapi, configurable per-endpoint |
| CORS | Allowlist-based, env-var configurable |
| Security Headers | CSP, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy |
| Input Sanitization | XSS, SQL injection, path traversal, null-byte guard (sanitization_service) |
| Input Validation | Pydantic v2 with field validators |
