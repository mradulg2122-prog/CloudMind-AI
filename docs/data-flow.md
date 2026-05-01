# CloudMind AI — Data Flow

## End-to-End Prediction Flow

```mermaid
sequenceDiagram
    participant FE as Frontend (Next.js)
    participant API as FastAPI (app.py)
    participant RBAC as RBAC Service
    participant ML as ML Engine (predict.py)
    participant XAI as XAI Engine (explain_service.py)
    participant RPT as Report Service
    participant DB as Database (SQLite/PostgreSQL)
    participant LOG as Logging Service

    FE ->> API: POST /predict<br/>{telemetry JSON} + Bearer token
    API ->> API: JWT validation (decode_token)
    API ->> RBAC: require_role(USER)
    RBAC -->> API: ✅ role=user — authorized

    API ->> ML: run_prediction(input_data)
    ML ->> ML: build_feature_vector() → 39 features
    ML ->> ML: RandomForest.predict() → predicted_requests
    ML ->> ML: decision_engine() → action, recommended_servers
    ML -->> API: {predicted_requests, action, recommended_servers, load_per_server}

    API ->> XAI: explain_prediction(input_data, result)
    XAI ->> ML: forest.estimators_[*].predict() → tree_preds
    XAI ->> XAI: std_dev / mean → confidence_score
    XAI ->> XAI: feature_contributions() → top drivers
    XAI ->> XAI: generate_reasoning() → NL summary
    XAI ->> XAI: compute_risk_assessment()
    XAI -->> API: {confidence_score, reasoning, risk, recommendations}

    API ->> DB: INSERT telemetry
    API ->> DB: INSERT prediction
    API ->> DB: INSERT prediction_explanation
    API ->> DB: INSERT scaling_decision (if SCALE UP/DOWN)

    API ->> RPT: generate_optimization_report()
    RPT ->> DB: INSERT report (JSON blob)
    RPT -->> API: report.id

    API ->> LOG: slog.prediction(user, action, confidence, duration_ms)
    LOG ->> LOG: Write JSON to predictions.jsonl + security.jsonl

    API -->> FE: {predicted_requests, action, confidence_score,<br/>reasoning_summary, risk_level, report_id, ...}
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant API as FastAPI

    FE ->> API: POST /auth/register {username, email, password}
    API ->> API: Validate: username 3-32 chars, email regex, password strength regex
    API ->> API: bcrypt.hash(password)
    API ->> API: INSERT user (role="user")
    API -->> FE: 201 {id, username, email, role, is_active}

    FE ->> API: POST /auth/login {username, password}
    API ->> API: get_user_by_username()
    API ->> API: bcrypt.verify(plain, hashed)
    API ->> API: create_access_token(sub=username, exp=now+60min, iat=now)
    API -->> FE: 200 {access_token, token_type, expires_in}

    FE ->> API: GET /predict (Authorization: Bearer <token>)
    API ->> API: jwt.decode(token, SECRET_KEY)
    API ->> API: db.query(User).filter(username=sub)
    API ->> API: RBAC: role >= "user"?
    API -->> FE: 200 prediction response
```

## Report Generation Flow

```mermaid
flowchart LR
    P[POST /predict] --> ML[ML Prediction]
    ML --> XAI[XAI Explanation]
    XAI --> DB1[(predictions table)]
    XAI --> DB2[(prediction_explanations table)]
    ML --> RPT[Report Service]

    RPT --> R1[generate_optimization_report\ncombines prediction + XAI]
    RPT --> R2[generate_cost_report\ncalculates savings/overhead]

    R1 --> DB3[(reports table\nJSON blob)]
    R2 --> DB3

    DB3 --> E1[GET /reports]
    DB3 --> E2[GET /reports/{id}]
    DB3 --> E3[GET /reports/export/json]
    DB3 --> E4[GET /reports/export/csv]
```

## Database Schema Relations

```mermaid
erDiagram
    users {
        int id PK
        string username UK
        string email UK
        string hashed_pw
        bool is_active
        string role
        datetime created_at
    }
    telemetry {
        int id PK
        int user_id FK
        float requests_per_minute
        float cpu_usage_percent
        float memory_usage_percent
        int active_servers
        int hour
        int minute
        float response_time_ms
        float cost_per_server
        datetime recorded_at
    }
    predictions {
        int id PK
        int telemetry_id FK
        int user_id FK
        float predicted_requests
        int recommended_servers
        string action
        float load_per_server
        datetime created_at
    }
    prediction_explanations {
        int id PK
        int prediction_id FK
        float confidence_score
        string confidence_label
        text reasoning_summary
        text feature_contributions
        text recommendations
        string risk_level
        float risk_score
        datetime created_at
    }
    scaling_decisions {
        int id PK
        int prediction_id FK
        string action
        int before_servers
        int after_servers
        text reason
        datetime decided_at
    }
    reports {
        int id PK
        int user_id FK
        int prediction_id FK
        string report_type
        string title
        text content
        datetime created_at
    }
    alerts {
        int id PK
        int user_id FK
        string severity
        text message
        string source
        bool dismissed
        datetime created_at
    }
    request_logs {
        int id PK
        int user_id FK
        string method
        string path
        int status_code
        float duration_ms
        string ip_address
        datetime created_at
    }

    users ||--o{ telemetry : "records"
    users ||--o{ predictions : "makes"
    users ||--o{ reports : "owns"
    telemetry ||--o| predictions : "analyzed_by"
    predictions ||--o| prediction_explanations : "explained_by"
    predictions ||--o| scaling_decisions : "triggers"
    predictions ||--o{ reports : "documented_in"
```
