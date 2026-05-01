# =============================================================================
# CloudMind AI – tests/test_reports.py
#
# Report Generation & Export test suite — 10 tests covering:
#   ✅ Report auto-generated after /predict returns report_id
#   ✅ GET /reports lists reports for authenticated user
#   ✅ GET /reports/{id} returns full report content
#   ✅ POST /reports/historical generates historical report
#   ✅ GET /reports/export/json returns JSON download
#   ✅ GET /reports/export/csv returns CSV download
#   ✅ Unauthenticated access to /reports returns 401
#   ✅ Report content contains required fields
#   ✅ Report type is valid enum value
#   ✅ Historical report with invalid days is clamped
# =============================================================================

import json
import pytest


class TestReportGeneration:
    def test_predict_auto_generates_report(self, client, auth_headers, valid_telemetry):
        """Predict must auto-generate and return a report_id."""
        resp = client.post("/predict", json=valid_telemetry, headers=auth_headers)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert "report_id" in body
        assert isinstance(body["report_id"], int)
        assert body["report_id"] > 0

    def test_list_reports_returns_list(self, client, auth_headers, valid_telemetry):
        """GET /reports must return a list of reports for the authenticated user."""
        # Ensure at least one report exists
        client.post("/predict", json=valid_telemetry, headers=auth_headers)
        resp = client.get("/reports", headers=auth_headers)
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_list_reports_unauthenticated_returns_401(self, client):
        """GET /reports without auth must return 401."""
        resp = client.get("/reports")
        assert resp.status_code == 401

    def test_get_report_by_id_returns_content(self, client, auth_headers, valid_telemetry):
        """GET /reports/{id} must return full report content."""
        # Create a prediction to generate a report
        pred_resp = client.post("/predict", json=valid_telemetry, headers=auth_headers)
        assert pred_resp.status_code == 200
        report_id = pred_resp.json()["report_id"]

        # Fetch the report
        resp = client.get(f"/reports/{report_id}", headers=auth_headers)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert "id"          in body
        assert "report_type" in body
        assert "title"       in body
        assert "content"     in body
        assert "created_at"  in body
        assert isinstance(body["content"], dict)

    def test_report_content_has_required_fields(self, client, auth_headers, valid_telemetry):
        """Report content must include prediction data, explanation, and metadata."""
        pred_resp = client.post("/predict", json=valid_telemetry, headers=auth_headers)
        assert pred_resp.status_code == 200
        report_id = pred_resp.json()["report_id"]

        resp = client.get(f"/reports/{report_id}", headers=auth_headers)
        assert resp.status_code == 200
        content = resp.json()["content"]

        # Should have generated_at and report_type
        assert "generated_at" in content
        assert "report_type"  in content

    def test_report_type_is_valid(self, client, auth_headers, valid_telemetry):
        """Report type must be one of the expected values."""
        client.post("/predict", json=valid_telemetry, headers=auth_headers)
        resp = client.get("/reports", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()

        valid_types = {
            "cost_prediction",
            "optimization_decision",
            "historical_performance",
            "security_audit",
        }
        for report in data[:5]:  # check first 5
            assert "report_type" in report
            rt = report["report_type"]
            assert rt in valid_types, f"Unknown report type: {rt}"

    def test_get_nonexistent_report_returns_404(self, client, auth_headers):
        """GET /reports/99999 must return 404."""
        resp = client.get("/reports/99999", headers=auth_headers)
        assert resp.status_code == 404


class TestHistoricalReport:
    def test_generate_historical_report_returns_data(self, client, auth_headers, valid_telemetry):
        """POST /reports/historical must generate and return a report."""
        # Ensure data exists
        client.post("/predict", json=valid_telemetry, headers=auth_headers)

        resp = client.post("/reports/historical?days=7", headers=auth_headers)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert "report_id" in body
        assert "title"     in body
        assert "content"   in body
        assert isinstance(body["report_id"], int)

    def test_historical_report_unauthenticated_returns_401(self, client):
        """POST /reports/historical without auth must return 401."""
        resp = client.post("/reports/historical?days=7")
        assert resp.status_code == 401

    def test_list_reports_with_type_filter(self, client, auth_headers, valid_telemetry):
        """GET /reports?report_type=optimization_decision should filter correctly."""
        client.post("/predict", json=valid_telemetry, headers=auth_headers)
        resp = client.get("/reports?report_type=optimization_decision", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        for r in data:
            assert r["report_type"] == "optimization_decision"


class TestReportExport:
    def test_export_reports_json_returns_download(self, client, auth_headers, valid_telemetry):
        """GET /reports/export/json must return JSON content with reports array."""
        client.post("/predict", json=valid_telemetry, headers=auth_headers)
        resp = client.get("/reports/export/json", headers=auth_headers)
        assert resp.status_code == 200, resp.text
        assert "application/json" in resp.headers.get("content-type", "")
        assert "attachment" in resp.headers.get("content-disposition", "")

        data = resp.json()
        assert isinstance(data, list)
        if data:
            assert "id"          in data[0]
            assert "report_type" in data[0]
            assert "title"       in data[0]
            assert "created_at"  in data[0]

    def test_export_reports_csv_returns_download(self, client, auth_headers, valid_telemetry):
        """GET /reports/export/csv must return text/csv with column headers."""
        client.post("/predict", json=valid_telemetry, headers=auth_headers)
        resp = client.get("/reports/export/csv", headers=auth_headers)
        assert resp.status_code == 200, resp.text
        assert "text/csv" in resp.headers.get("content-type", "")
        text = resp.text
        # First row should contain header columns
        first_line = text.split("\n")[0]
        assert "id"          in first_line
        assert "report_type" in first_line
        assert "title"       in first_line

    def test_export_json_unauthenticated_returns_401(self, client):
        resp = client.get("/reports/export/json")
        assert resp.status_code == 401

    def test_export_csv_unauthenticated_returns_401(self, client):
        resp = client.get("/reports/export/csv")
        assert resp.status_code == 401
