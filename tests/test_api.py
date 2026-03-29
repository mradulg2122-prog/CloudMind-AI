# =============================================================================
# CloudMind AI – tests/test_api.py
#
# Pytest test suite covering:
#   ✅ User registration
#   ✅ Duplicate registration (should return 400)
#   ✅ Login with correct credentials → returns JWT
#   ✅ Login with wrong password → returns 401
#   ✅ Predict endpoint without token → returns 401
#   ✅ Predict endpoint with valid token → returns prediction
#   ✅ Input validation (invalid cpu, memory, servers)
#   ✅ /health endpoint (public)
#   ✅ /logs endpoint (protected)
#   ✅ /alerts endpoint (protected)
#
# Run with:
#   cd CloudMind_AI/backend
#   pytest ../tests/test_api.py -v
# =============================================================================

import pytest
import time
from fastapi.testclient import TestClient

# Add backend directory to the Python path so imports work
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app import app

# ── TestClient wraps the FastAPI app without needing a real server ────────────
client = TestClient(app)

# ── Reusable test user credentials ────────────────────────────────────────────
# We append a timestamp suffix so every test session uses a fresh user,
# avoiding conflicts with the SQLite database from previous runs.
_SUFFIX   = int(time.time()) % 100000
TEST_USER = {
    "username" : f"testuser_{_SUFFIX}",
    "email"    : f"testuser_{_SUFFIX}@cloudmind.ai",
    "password" : "SecurePass!2024",
}

# ── Valid telemetry payload ────────────────────────────────────────────────────
VALID_TELEMETRY = {
    "requests_per_minute"  : 850,
    "cpu_usage_percent"    : 70,
    "memory_usage_percent" : 65,
    "active_servers"       : 4,
    "hour"                 : 14,
    "minute"               : 30,
    "response_time_ms"     : 120,
    "cost_per_server"      : 50,
}


# =============================================================================
# FIXTURES
# =============================================================================

@pytest.fixture(scope="session")
def auth_token():
    """
    Session-scoped fixture (runs once for the entire test session) that:
    1. Attempts to register the test user (safe to ignore 400 if already exists)
    2. Logs in and returns the JWT access token used by all auth-dependent tests.
    """
    # Attempt registration — 201: success, 400: already exists (both are fine)
    client.post("/auth/register", json=TEST_USER)

    # Login — should always succeed once user exists
    resp = client.post("/auth/login", json={
        "username" : TEST_USER["username"],
        "password" : TEST_USER["password"],
    })
    assert resp.status_code == 200, f"Login fixture failed: {resp.text}"
    return resp.json()["access_token"]


def auth_headers(token: str) -> dict:
    """Return the Authorization header dict for a given JWT token."""
    return {"Authorization": f"Bearer {token}"}


# =============================================================================
# ── HEALTH CHECK ─────────────────────────────────────────────────────────────
# =============================================================================

class TestHealthCheck:
    def test_health_returns_200(self):
        """Public /health endpoint should always return 200."""
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_health_contains_status(self):
        """Response JSON must include status=healthy."""
        resp = client.get("/health")
        assert resp.json()["status"] == "healthy"

    def test_root_returns_200(self):
        """Root / endpoint should return 200 with a message."""
        resp = client.get("/")
        assert resp.status_code == 200
        assert "message" in resp.json()


# =============================================================================
# ── USER REGISTRATION ─────────────────────────────────────────────────────────
# =============================================================================

class TestRegistration:
    def test_register_new_user(self):
        """Registering a brand-new user should return 201."""
        import random
        unique = {
            "username" : f"newuser_{random.randint(10000,99999)}",
            "email"    : f"newuser_{random.randint(10000,99999)}@test.com",
            "password" : "TestPass123!",
        }
        resp = client.post("/auth/register", json=unique)
        assert resp.status_code == 201
        body = resp.json()
        assert body["username"] == unique["username"]
        assert "hashed_pw" not in body          # password must NOT be exposed

    def test_register_duplicate_username(self):
        """Registering the same username twice should return 400."""
        # First registration — might already exist
        client.post("/auth/register", json=TEST_USER)
        # Second registration — must fail
        resp = client.post("/auth/register", json=TEST_USER)
        assert resp.status_code == 400
        assert "already" in resp.json()["detail"].lower()


# =============================================================================
# ── USER LOGIN ────────────────────────────────────────────────────────────────
# =============================================================================

class TestLogin:
    def test_login_success(self):
        """Valid credentials should return a JWT access token."""
        client.post("/auth/register", json=TEST_USER)  # ensure user exists
        resp = client.post("/auth/login", json={
            "username" : TEST_USER["username"],
            "password" : TEST_USER["password"],
        })
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"

    def test_login_wrong_password(self):
        """Wrong password must return 401 Unauthorized."""
        resp = client.post("/auth/login", json={
            "username" : TEST_USER["username"],
            "password" : "WrongPassword!",
        })
        assert resp.status_code == 401

    def test_login_unknown_user(self):
        """Non-existent username must return 401."""
        resp = client.post("/auth/login", json={
            "username" : "nobody_xyz_12345",
            "password" : "anything",
        })
        assert resp.status_code == 401


# =============================================================================
# ── PREDICTION ENDPOINT ───────────────────────────────────────────────────────
# =============================================================================

class TestPrediction:
    def test_predict_without_token_returns_401(self):
        """Unauthenticated /predict call must return 401."""
        resp = client.post("/predict", json=VALID_TELEMETRY)
        assert resp.status_code == 401

    def test_predict_with_valid_token(self, auth_token):
        """Authenticated /predict should return the expected fields."""
        resp = client.post(
            "/predict",
            json    = VALID_TELEMETRY,
            headers = auth_headers(auth_token),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert "predicted_requests"  in body
        assert "recommended_servers" in body
        assert "action"              in body
        assert "load_per_server"     in body
        assert body["action"] in {"SCALE UP", "SCALE DOWN", "KEEP SAME"}

    def test_predict_invalid_cpu(self, auth_token):
        """CPU > 100 should return 422 Unprocessable Entity."""
        bad_payload = {**VALID_TELEMETRY, "cpu_usage_percent": 110}
        resp = client.post(
            "/predict",
            json    = bad_payload,
            headers = auth_headers(auth_token),
        )
        assert resp.status_code == 422

    def test_predict_invalid_memory(self, auth_token):
        """Memory < 0 should return 422."""
        bad_payload = {**VALID_TELEMETRY, "memory_usage_percent": -5}
        resp = client.post(
            "/predict",
            json    = bad_payload,
            headers = auth_headers(auth_token),
        )
        assert resp.status_code == 422

    def test_predict_zero_servers(self, auth_token):
        """active_servers = 0 should return 422 (must be >= 1)."""
        bad_payload = {**VALID_TELEMETRY, "active_servers": 0}
        resp = client.post(
            "/predict",
            json    = bad_payload,
            headers = auth_headers(auth_token),
        )
        assert resp.status_code == 422

    def test_predict_negative_requests(self, auth_token):
        """requests_per_minute < 0 should return 422."""
        bad_payload = {**VALID_TELEMETRY, "requests_per_minute": -100}
        resp = client.post(
            "/predict",
            json    = bad_payload,
            headers = auth_headers(auth_token),
        )
        assert resp.status_code == 422


# =============================================================================
# ── PROTECTED ROUTES ──────────────────────────────────────────────────────────
# =============================================================================

class TestProtectedRoutes:
    def test_logs_without_token_returns_401(self):
        """/logs must require authentication."""
        resp = client.get("/logs")
        assert resp.status_code == 401

    def test_logs_with_token(self, auth_token):
        """/logs with valid token should return a list."""
        resp = client.get("/logs", headers=auth_headers(auth_token))
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_alerts_without_token_returns_401(self):
        """/alerts must require authentication."""
        resp = client.get("/alerts")
        assert resp.status_code == 401

    def test_alerts_with_token(self, auth_token):
        """/alerts with valid token should return a list."""
        resp = client.get("/alerts", headers=auth_headers(auth_token))
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_prediction_history_with_token(self, auth_token):
        """/predictions/history should return a list for authenticated user."""
        resp = client.get("/predictions/history", headers=auth_headers(auth_token))
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_me_endpoint(self, auth_token):
        """/auth/me should return the current user's profile."""
        resp = client.get("/auth/me", headers=auth_headers(auth_token))
        assert resp.status_code == 200
        body = resp.json()
        assert body["username"] == TEST_USER["username"]
        assert "hashed_pw" not in body


# =============================================================================
# ── DATABASE PERSISTENCE (integration test) ───────────────────────────────────
# =============================================================================

class TestDatabaseLogging:
    def test_prediction_is_saved_to_db(self, auth_token):
        """
        After a /predict call, the prediction should appear in /predictions/history.
        This verifies the full DB write pipeline.
        """
        # Make a prediction
        resp = client.post(
            "/predict",
            json    = VALID_TELEMETRY,
            headers = auth_headers(auth_token),
        )
        assert resp.status_code == 200

        # Check history
        history_resp = client.get(
            "/predictions/history",
            headers = auth_headers(auth_token),
        )
        assert history_resp.status_code == 200
        history = history_resp.json()
        assert len(history) >= 1

        # The most recent prediction should match what we just predicted
        latest = history[0]
        assert latest["predicted_requests"] == resp.json()["predicted_requests"]
