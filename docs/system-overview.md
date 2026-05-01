# CloudMind AI — System Overview (v5)

## What is CloudMind AI?

CloudMind AI is an **Autonomous Cloud Cost Intelligence & Self-Optimizing Infrastructure Platform**. It uses a trained RandomForest model to predict cloud workload 5 minutes into the future and recommends infrastructure scaling decisions — all while explaining its reasoning through a built-in Explainable AI (XAI) engine and generating optimization reports automatically.

## Core Capabilities

| Capability | Description |
|---|---|
| **Workload Prediction** | ML model predicts requests/min 5 minutes ahead using 39 engineered features |
| **Autonomous Scaling** | Decision engine recommends SCALE UP / SCALE DOWN / KEEP SAME based on predicted load |
| **XAI Explanations** | Every prediction includes confidence score, reasoning summary, and feature contributions |
| **Cost Intelligence** | Calculates estimated savings from scale-down decisions and overhead from scale-up |
| **Auto Reports** | Generates optimization and historical reports automatically after each prediction |
| **RBAC Security** | Role-based access control (viewer / user / admin) on all endpoints |
| **Input Sanitization** | XSS, SQL injection, path traversal, and null-byte guards on all inputs |
| **Async Task System** | Background task queue with exponential-backoff retry for reports and logging |
| **Model Versioning** | Full model version registry — register, list, and rollback ML model versions |
| **Health Monitoring** | `/health` liveness, `/status` component health, `/metrics` operational dashboard |
| **Audit Logging** | Structured JSON logs to separate streams for predictions, security, and performance |

## Component Map

```
CloudMind AI
├── frontend-next/          # Next.js + React dashboard
│   ├── app/                # Pages (dashboard, auth)
│   ├── components/         # UI components:
│   │   ├── ExplanationPanel.tsx    # XAI confidence + reasoning
│   │   ├── ReportViewer.tsx        # Report browser + download
│   │   ├── ConfidenceGauge.tsx     # Animated canvas confidence meter
│   │   ├── PredictionResults.tsx   # Prediction output card
│   │   ├── ScalingDecisionPanel.tsx
│   │   ├── AdvancedAnalytics.tsx
│   │   ├── HistoricalCharts.tsx
│   │   ├── AlertPanel.tsx
│   │   └── Sidebar.tsx
│   └── lib/                # API client helpers
│
└── backend/                # FastAPI Python backend
    ├── app.py              # Main API — routes, middleware, startup (v5)
    ├── auth.py             # JWT + bcrypt + user CRUD
    ├── database.py         # SQLAlchemy ORM — 9 tables
    ├── predict.py          # ML pipeline — feature engineering + decision engine
    ├── retrain.py          # Model retraining from DB data
    ├── logger_config.py    # Root logger (rotating file + console)
    └── services/
        ├── rbac.py                  # RBAC dependency — require_role()
        ├── explain_service.py       # XAI engine — confidence, features, reasoning
        ├── report_service.py        # Report generation + export
        ├── logging_service.py       # JSON structured logging service
        ├── health_service.py        # Liveness, status, metrics
        ├── task_queue.py            # Async background tasks with retry
        ├── model_registry.py        # Model version registry + rollback
        └── sanitization_service.py  # XSS/SQLi/PathTraversal input guard
```

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 15 + React | Dashboard UI |
| Charts | Recharts | Data visualization |
| Backend | FastAPI 0.111 | REST API + middleware |
| ML | scikit-learn RandomForest | Workload prediction |
| Feature Engineering | NumPy | 39-feature vector construction |
| ORM | SQLAlchemy 2.0 | Database abstraction |
| Database | SQLite (dev) / PostgreSQL (prod) | Data persistence |
| Migrations | Alembic 1.13 | Schema version control |
| Auth | python-jose JWT + passlib bcrypt | Authentication |
| Rate Limiting | slowapi | DDoS / abuse protection |
| Serialization | Pydantic v2 | Schema validation |
| Containerization | Docker + docker-compose | Deployment |

## ML Model Details

| Attribute | Value |
|---|---|
| Algorithm | RandomForestRegressor |
| Estimators | 200 trees |
| Max Depth | 15 |
| Feature Count | 39 (engineered) |
| Target | `predicted_requests` (req/min, 5-min horizon) |
| Training Source | Synthetic + DB telemetry data |
| Serialization | joblib |
| Registry | `model_metadata.json` + `model_versions` DB table |

### Feature Categories

| Category | Features | Count |
|---|---|---|
| Base telemetry | rpm, cpu, memory, servers, response_time, cost | 6 |
| Time encoding | hour_sin, hour_cos, minute_sin, minute_cos | 4 |
| Rolling averages | requests_5/10/15min_avg, cpu_5/10min_avg, mem_5min | 7 |
| Lag features | rpm_lag_1/5/10/15/30, cpu_lag_1/5/10, mem_lag_5 | 9 |
| Change features | change_1/5min, std_5/10min, max_5min, min_5min | 6 |
| Derived features | cpu×mem, server_util, load/server, cost_eff, high_lat, peaks | 7 |

## RBAC Role Matrix

| Endpoint | viewer | user | admin |
|---|---|---|---|
| GET /health, GET /status, GET / | ✅ | ✅ | ✅ |
| POST /auth/login, POST /auth/register | ✅ | ✅ | ✅ |
| GET /auth/me | ✅ | ✅ | ✅ |
| POST /predict | ❌ | ✅ | ✅ |
| GET /predictions/history | ❌ | ✅ | ✅ |
| GET /explain/{id} | ❌ | ✅ | ✅ |
| GET /analytics | ❌ | ✅ | ✅ |
| GET /reports, GET /reports/{id} | ❌ | ✅ | ✅ |
| POST /reports/historical | ❌ | ✅ | ✅ |
| GET /reports/export/* | ❌ | ✅ | ✅ |
| GET /export/csv, GET /export/pdf | ❌ | ✅ | ✅ |
| GET /alerts | ❌ | ✅ | ✅ |
| GET /metrics | ❌ | ❌ | ✅ |
| GET /logs | ❌ | ❌ | ✅ |
| GET /admin/users | ❌ | ❌ | ✅ |
| PATCH /admin/users/{u}/role | ❌ | ❌ | ✅ |
| POST /retrain/trigger | ❌ | ❌ | ✅ |
| GET /admin/model/versions | ❌ | ❌ | ✅ |
| POST /admin/model/register | ❌ | ❌ | ✅ |
| POST /admin/model/rollback | ❌ | ❌ | ✅ |
| POST /admin/cleanup | ❌ | ❌ | ✅ |
