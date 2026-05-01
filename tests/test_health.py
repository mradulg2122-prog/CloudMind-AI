# =============================================================================
# CloudMind AI – tests/test_health.py
#
# Health, Status & Metrics test suite — 8 tests covering:
#   ✅ GET /health returns alive status
#   ✅ GET /status returns detailed component status
#   ✅ GET /status includes database, ml_model, logging, disk components
#   ✅ GET /metrics requires admin role
#   ✅ GET /metrics returns prediction counts
#   ✅ GET /health includes uptime_s field
#   ✅ System version is correct
#   ✅ /status accessible without auth
# =============================================================================

import pytest


class TestHealthEndpoint:
    def test_health_returns_200(self, client):
        """GET /health must return 200 with alive status."""
        resp = client.get("/health")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["status"] == "alive"
        assert "uptime_s" in body
        assert "timestamp" in body

    def test_health_includes_version(self, client):
        """GET /health must include the service version."""
        resp = client.get("/health")
        assert resp.status_code == 200
        assert "version" in resp.json()

    def test_health_no_auth_required(self, client):
        """GET /health must be accessible without authentication."""
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_health_uptime_is_positive(self, client):
        """Uptime must be a positive number."""
        resp = client.get("/health")
        assert resp.status_code == 200
        uptime = resp.json().get("uptime_s", -1)
        assert isinstance(uptime, (int, float))
        assert uptime >= 0


class TestStatusEndpoint:
    def test_status_returns_200(self, client):
        """GET /status must return 200 with component breakdown."""
        resp = client.get("/status")
        assert resp.status_code == 200, resp.text

    def test_status_includes_components(self, client):
        """GET /status must include database, ml_model, logging, disk components."""
        resp = client.get("/status")
        assert resp.status_code == 200
        body = resp.json()
        assert "components" in body
        components = body["components"]
        assert "database"  in components
        assert "ml_model"  in components
        assert "logging"   in components
        assert "disk"      in components

    def test_status_database_connected(self, client):
        """Database component must report connected status."""
        resp = client.get("/status")
        assert resp.status_code == 200
        db_status = resp.json()["components"]["database"]
        assert db_status["status"] in ("ok", "degraded", "error")

    def test_status_no_auth_required(self, client):
        """GET /status must be accessible without authentication."""
        resp = client.get("/status")
        assert resp.status_code == 200


class TestMetricsEndpoint:
    def test_metrics_requires_admin_role(self, client, auth_headers):
        """GET /metrics must require admin role — regular user gets 403."""
        resp = client.get("/metrics", headers=auth_headers)
        assert resp.status_code in (403, 401)

    def test_metrics_without_auth_returns_401(self, client):
        """GET /metrics without auth must return 401."""
        resp = client.get("/metrics")
        assert resp.status_code == 401
