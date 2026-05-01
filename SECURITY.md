# CloudMind AI — Security Policy (v5)

## Supported Versions

| Version | Supported |
|---|---|
| 5.x | ✅ Active support |
| 4.x | ⚠️ Security patches only |
| < 4.0 | ❌ End of life |

---

## Reporting a Vulnerability

If you discover a security vulnerability, please do **not** open a public GitHub issue.

Instead, email: **security@cloudmind.ai** with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Your name/handle for credit (optional)

We will respond within **72 hours** and aim to release a patch within **7 days** for critical issues.

---

## Security Architecture

### Authentication

| Control | Implementation | Details |
|---|---|---|
| Mechanism | JWT (JSON Web Tokens) | HS256 signing algorithm |
| Token Expiry | 60 minutes | Configurable via `ACCESS_TOKEN_EXPIRE_MINUTES` |
| Token Claims | `sub`, `exp`, `iat`, `type` | Standard + custom claims |
| Token Scheme | Bearer | Authorization header |
| Storage | Client-side (localStorage / httpOnly cookie) | Never logged server-side |

### Password Security

| Control | Implementation |
|---|---|
| Hashing Algorithm | bcrypt (12 rounds) + sha256_crypt fallback |
| Minimum Length | 8 characters |
| Complexity | Must include: uppercase, lowercase, digit, special character |
| Enforcement | Pydantic regex validator on `/auth/register` |
| Storage | Hashed only — plaintext never stored or logged |

### Authorization (RBAC)

Three roles in ascending privilege order:

```
viewer < user < admin
```

| Role | Description | Created By |
|---|---|---|
| `viewer` | Read-only (reserved for future use) | Admin assignment |
| `user` | Run predictions, view reports, export data | Default on registration |
| `admin` | Full access including user management, retraining, model registry | Admin assignment |

Role changes require an existing admin using `PATCH /admin/users/{username}/role`.

### Input Sanitization (`sanitization_service.py`)

All string inputs are sanitized through a dedicated service before processing:

| Threat | Protection |
|---|---|
| **XSS** | `html.escape()` + regex pattern detection (script tags, event handlers) |
| **SQL Injection** | Pattern detection (UNION SELECT, DROP TABLE, exec(), etc.) |
| **Path Traversal** | `../` and `%2e%2e` pattern stripping |
| **Null Byte Injection** | `\x00` removal |
| **Unicode Normalization** | NFC normalization to prevent homoglyph attacks |
| **Oversized Input** | Truncation at 4,096 characters |

### Transport Security

| Header | Value | Purpose |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Block clickjacking via iframes |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS filter |
| `Content-Security-Policy` | `default-src 'self'` | Restrict resource loading |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Prevent URL leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disable browser APIs |
| `Strict-Transport-Security` | **Enable in production** with valid TLS | Force HTTPS |

### CORS Protection

CORS is enforced via allowlist — only origins listed in `ALLOWED_ORIGINS` env var are permitted.
- Default: `http://localhost:3000`
- In production: set to your exact frontend domain (e.g., `https://app.yourdomain.com`)
- Credentials: allowed (for JWT refresh flows)
- Exposed headers: `X-Request-ID`, `X-RateLimit-Remaining`, `X-Process-Time`

### Rate Limiting

| Endpoint | Limit | Notes |
|---|---|---|
| `POST /auth/register` | 10/minute | Prevent user enumeration |
| `POST /auth/login` | 20/minute | Brute force protection |
| `POST /predict` | 100/minute | Core prediction endpoint |
| `POST /retrain/trigger` | 2/minute | Resource-intensive endpoint |
| `GET /export/*` | 5–10/minute | Prevent bulk data extraction |
| `POST /admin/model/rollback` | 3/minute | High-impact operation |
| Other protected | 20–60/minute | Standard API rate |
| Exceeded response | HTTP 429 | `{"detail": "Rate limit exceeded"}` |

### Input Validation

All inputs validated through **Pydantic v2** (field-level) and **sanitization_service** (content-level):
- Type coercion and strict bounds checking
- Custom field validators for business rules (e.g., CPU must be 0–100%)
- Automatic 422 responses with descriptive error details
- Parameterized database queries (SQLAlchemy ORM — no raw SQL injection risk)
- Username sanitization: alphanumeric + underscore + hyphen only, 3–64 chars

### Audit Logging

Security-relevant events are logged to `logs/security.jsonl` in JSON format:
- Login attempts (success and failure)
- Registration events
- Role changes (who changed which role to what)
- Model rollback events (with user attribution)
- Rate limit violations
- Token validation failures
- API request audit trail (method, path, status, latency)

---

## Production Security Checklist

Before deploying to production:

- [ ] Change `CLOUDMIND_SECRET_KEY` to a random 32+ character string
  ```bash
  python -c "import secrets; print(secrets.token_hex(32))"
  ```
- [ ] Set `ALLOWED_ORIGINS` to your production frontend domain only
- [ ] Set `ENVIRONMENT=production`
- [ ] Enable `Strict-Transport-Security` header (requires valid TLS cert)
- [ ] Use PostgreSQL instead of SQLite for multi-instance deployments
- [ ] Set `DATABASE_URL` to your PostgreSQL connection string
- [ ] Run Alembic migrations: `alembic upgrade head`
- [ ] Run the backend behind a TLS-terminating reverse proxy (Nginx/Caddy)
- [ ] Set up log rotation and log shipping to a SIEM (Datadog, ELK, CloudWatch)
- [ ] Restrict admin role to specific accounts only
- [ ] Enable database backups and test restore procedure
- [ ] Review and tighten Content-Security-Policy for your specific needs
- [ ] Consider adding refresh token support for longer-lived sessions
- [ ] Scan dependencies: `pip-audit -r requirements.txt`
- [ ] Review all admin accounts: `GET /admin/users` with admin token
