# =============================================================================
# CloudMind AI – tests/conftest.py  (v4 — shared fixtures)
# =============================================================================

import pytest
import time
import sys
import os

# Ensure backend directory is on the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from fastapi.testclient import TestClient
from app import app

# ── Single shared TestClient ───────────────────────────────────────────────────
@pytest.fixture(scope="session")
def client():
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


# ── Unique test user (fresh per session) ──────────────────────────────────────
_SUFFIX = int(time.time()) % 100000

@pytest.fixture(scope="session")
def test_user():
    return {
        "username": f"testuser_{_SUFFIX}",
        "email"   : f"testuser_{_SUFFIX}@cloudmind.ai",
        "password": "TestPass!2024A",
    }


@pytest.fixture(scope="session")
def admin_user():
    return {
        "username": f"adminuser_{_SUFFIX}",
        "email"   : f"admin_{_SUFFIX}@cloudmind.ai",
        "password": "AdminPass!2024B",
    }


@pytest.fixture(scope="session")
def auth_token(client, test_user):
    """Session-scoped: register + login and return JWT."""
    client.post("/auth/register", json=test_user)
    resp = client.post("/auth/login", json={
        "username": test_user["username"],
        "password": test_user["password"],
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture(scope="session")
def valid_telemetry():
    return {
        "requests_per_minute"  : 850,
        "cpu_usage_percent"    : 70,
        "memory_usage_percent" : 65,
        "active_servers"       : 4,
        "hour"                 : 14,
        "minute"               : 30,
        "response_time_ms"     : 120,
        "cost_per_server"      : 50,
    }
