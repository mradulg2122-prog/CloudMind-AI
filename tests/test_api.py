# =============================================================================
# CloudMind AI – tests/test_api.py  (v4 — updated full API suite)
#
# General API integration tests — 10 tests covering:
#   ✅ Health check and root endpoint
#   ✅ Reports endpoint (list, get, export)
#   ✅ Alerts endpoint
#   ✅ DB persistence after predict
#   ✅ Historical report generation
# =============================================================================

import pytest


class TestHealthCheck:
    def test_health_returns_200(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_health_is_liveness_probe(self, client):
        """v5: /health is a fast liveness probe returning 'alive' status."""
        body = client.get("/health").json()
        assert body["status"] == "alive"
        assert "uptime_s" in body
        assert "version"  in body

    def test_status_contains_all_components(self, client):
        """v5: /status returns detailed component breakdown."""
        body = client.get("/status").json()
        assert body["status"] in ("healthy", "degraded", "error")
        assert "components" in body
        assert "database"   in body["components"]
        assert "ml_model"   in body["components"]

    def test_root_returns_200_with_version(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        body = resp.json()
        assert "version"  in body
        assert "features" in body

    def test_health_includes_v5_version(self, client):
        body = client.get("/health").json()
        assert body["version"] == "5.0.0"


class TestReportsEndpoints:
    def test_reports_list_requires_auth(self, client):
        resp = client.get("/reports")
        assert resp.status_code == 401

    def test_reports_list_returns_list_after_predict(self, client, auth_headers, valid_telemetry):
        """After a prediction, /reports must return at least one entry."""
        client.post("/predict", json=valid_telemetry, headers=auth_headers)
        resp = client.get("/reports", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_report_detail_returns_content(self, client, auth_headers, valid_telemetry):
        """GET /reports/{id} must return report with content field."""
        client.post("/predict", json=valid_telemetry, headers=auth_headers)
        reports = client.get("/reports?limit=1", headers=auth_headers).json()
        assert len(reports) >= 1
        report_id = reports[0]["id"]
        resp = client.get(f"/reports/{report_id}", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "content"     in body
        assert "report_type" in body
        assert "title"       in body

    def test_historical_report_generation(self, client, auth_headers, valid_telemetry):
        """POST /reports/historical must generate and return a report."""
        client.post("/predict", json=valid_telemetry, headers=auth_headers)
        resp = client.post("/reports/historical?days=7", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "report_id" in body
        assert "content"   in body

    def test_reports_json_export(self, client, auth_headers, valid_telemetry):
        """GET /reports/export/json must return application/json attachment."""
        client.post("/predict", json=valid_telemetry, headers=auth_headers)
        resp = client.get("/reports/export/json", headers=auth_headers)
        assert resp.status_code == 200
        assert "application/json" in resp.headers.get("content-type", "")

    def test_reports_csv_export(self, client, auth_headers, valid_telemetry):
        """GET /reports/export/csv must return text/csv attachment."""
        client.post("/predict", json=valid_telemetry, headers=auth_headers)
        resp = client.get("/reports/export/csv", headers=auth_headers)
        assert resp.status_code == 200
        assert "text/csv" in resp.headers.get("content-type", "")


class TestAlertsEndpoint:
    def test_alerts_requires_auth(self, client):
        resp = client.get("/alerts")
        assert resp.status_code == 401

    def test_alerts_returns_list(self, client, auth_headers):
        resp = client.get("/alerts", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestDatabasePersistence:
    def test_prediction_saved_to_history(self, client, auth_headers, valid_telemetry):
        """After predict, the record must appear in /predictions/history."""
        pred_resp = client.post("/predict", json=valid_telemetry, headers=auth_headers)
        assert pred_resp.status_code == 200
        pred_val  = pred_resp.json()["predicted_requests"]

        hist_resp = client.get("/predictions/history?limit=1", headers=auth_headers)
        assert hist_resp.status_code == 200
        history = hist_resp.json()
        assert len(history) >= 1
        assert history[0]["predicted_requests"] == pred_val
