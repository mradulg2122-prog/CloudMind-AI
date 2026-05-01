# =============================================================================
# CloudMind AI – tests/test_prediction.py
#
# ML Prediction test suite — 10 tests covering:
#   ✅ Predict with valid token returns all required fields
#   ✅ Predict returns XAI confidence + reasoning
#   ✅ Predict stores explanation to DB (via /explain endpoint)
#   ✅ Predict generates a report (report_id in response)
#   ✅ Input validation edge cases
#   ✅ Prediction history endpoint
#   ✅ Analytics endpoint
#   ✅ Export CSV
# =============================================================================

import pytest


class TestPredictionEndpoint:
    def test_predict_unauthenticated_returns_401(self, client, valid_telemetry):
        """Unauthenticated call must return 401."""
        resp = client.post("/predict", json=valid_telemetry)
        assert resp.status_code == 401

    def test_predict_returns_prediction_fields(self, client, auth_headers, valid_telemetry):
        """Authenticated predict must return all core prediction fields."""
        resp = client.post("/predict", json=valid_telemetry, headers=auth_headers)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert "predicted_requests"  in body
        assert "recommended_servers" in body
        assert "action"              in body
        assert "load_per_server"     in body
        assert body["action"] in {"SCALE UP", "SCALE DOWN", "KEEP SAME"}

    def test_predict_returns_xai_fields(self, client, auth_headers, valid_telemetry):
        """Predict response must include confidence_score, reasoning_summary, risk_level."""
        resp = client.post("/predict", json=valid_telemetry, headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "confidence_score"  in body
        assert "confidence_label"  in body
        assert "reasoning_summary" in body
        assert "risk_level"        in body
        assert isinstance(body["confidence_score"], float)
        assert 0.0 <= body["confidence_score"] <= 1.0
        assert body["confidence_label"] in {"Very High", "High", "Medium", "Low"}

    def test_predict_returns_report_id(self, client, auth_headers, valid_telemetry):
        """Predict must auto-generate and return a report_id."""
        resp = client.post("/predict", json=valid_telemetry, headers=auth_headers)
        assert resp.status_code == 200
        assert "report_id" in resp.json()
        assert isinstance(resp.json()["report_id"], int)

    def test_predict_explanation_stored_to_db(self, client, auth_headers, valid_telemetry):
        """After predict, /explain/{id} must return the stored explanation."""
        # Make prediction
        pred_resp = client.post("/predict", json=valid_telemetry, headers=auth_headers)
        assert pred_resp.status_code == 200

        # Fetch history to get the prediction ID
        hist_resp = client.get("/predictions/history?limit=1", headers=auth_headers)
        assert hist_resp.status_code == 200
        history = hist_resp.json()
        assert len(history) >= 1
        pred_id = history[0]["id"]

        # Fetch explanation
        expl_resp = client.get(f"/explain/{pred_id}", headers=auth_headers)
        assert expl_resp.status_code == 200
        expl = expl_resp.json()
        assert "confidence_score"      in expl
        assert "feature_contributions" in expl
        assert "recommendations"       in expl
        assert isinstance(expl["feature_contributions"], list)


class TestPredictionValidation:
    def test_predict_cpu_over_100_returns_422(self, client, auth_headers, valid_telemetry):
        resp = client.post("/predict", json={**valid_telemetry, "cpu_usage_percent": 105}, headers=auth_headers)
        assert resp.status_code == 422

    def test_predict_memory_negative_returns_422(self, client, auth_headers, valid_telemetry):
        resp = client.post("/predict", json={**valid_telemetry, "memory_usage_percent": -1}, headers=auth_headers)
        assert resp.status_code == 422

    def test_predict_zero_servers_returns_422(self, client, auth_headers, valid_telemetry):
        resp = client.post("/predict", json={**valid_telemetry, "active_servers": 0}, headers=auth_headers)
        assert resp.status_code == 422

    def test_predict_negative_rpm_returns_422(self, client, auth_headers, valid_telemetry):
        resp = client.post("/predict", json={**valid_telemetry, "requests_per_minute": -100}, headers=auth_headers)
        assert resp.status_code == 422

    def test_predict_hour_out_of_range_returns_422(self, client, auth_headers, valid_telemetry):
        resp = client.post("/predict", json={**valid_telemetry, "hour": 25}, headers=auth_headers)
        assert resp.status_code == 422


class TestHistoryAndAnalytics:
    def test_prediction_history_returns_list(self, client, auth_headers, valid_telemetry):
        """After at least one prediction, history must return a non-empty list."""
        client.post("/predict", json=valid_telemetry, headers=auth_headers)
        resp = client.get("/predictions/history", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        # Each record should now include confidence_score
        assert "confidence_score" in data[0]

    def test_analytics_endpoint_returns_metrics(self, client, auth_headers, valid_telemetry):
        """Analytics must return aggregated stats including XAI metrics."""
        client.post("/predict", json=valid_telemetry, headers=auth_headers)
        resp = client.get("/analytics", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "total_predictions"     in body
        assert "action_distribution"   in body
        assert "avg_confidence_score"  in body

    def test_export_csv_returns_file(self, client, auth_headers, valid_telemetry):
        """CSV export must return text/csv with correct headers."""
        client.post("/predict", json=valid_telemetry, headers=auth_headers)
        resp = client.get("/export/csv", headers=auth_headers)
        assert resp.status_code == 200
        assert "text/csv" in resp.headers.get("content-type", "")
        content = resp.text
        assert "predicted_requests" in content
        assert "confidence_score"   in content
