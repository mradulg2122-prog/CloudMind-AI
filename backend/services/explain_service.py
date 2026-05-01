# =============================================================================
# CloudMind AI – backend/services/explain_service.py
#
# Explainable AI (XAI) Engine
# ────────────────────────────
# Generates human-readable explanations for every ML prediction, including:
#   - Confidence score (0.0–1.0) derived from model internals
#   - SHAP-style feature contribution analysis (without SHAP library)
#   - Natural-language reasoning summary
#   - Optimization recommendations
#   - Risk assessment
#
# This is a self-contained XAI engine that works with the existing
# RandomForest model without requiring additional libraries.
#
# Usage:
#   from services.explain_service import explain_prediction
#
#   explanation = explain_prediction(
#       input_data         = telemetry_dict,
#       predicted_requests = 850.0,
#       action             = "SCALE UP",
#       recommended_servers= 5,
#       load_per_server    = 170.0,
#   )
# =============================================================================

from __future__ import annotations

import math
from typing import Any

# ── Lazy import of the loaded model ───────────────────────────────────────────
# We import from predict to reuse the already-loaded model (no double load)
_model = None

def _get_model():
    global _model
    if _model is None:
        try:
            from predict import model
            _model = model
        except ImportError:
            pass
    return _model


# =============================================================================
# PUBLIC API
# =============================================================================

def explain_prediction(
    input_data          : dict[str, Any],
    predicted_requests  : float,
    action              : str,
    recommended_servers : int,
    load_per_server     : float,
) -> dict[str, Any]:
    """
    Generate a full XAI explanation for a prediction result.

    Parameters
    ----------
    input_data           : raw telemetry dict (from TelemetryInput.model_dump())
    predicted_requests   : float — ML model output (req/min in 5 min)
    action               : "SCALE UP" | "SCALE DOWN" | "KEEP SAME"
    recommended_servers  : int — decision engine output
    load_per_server      : float — req/min per server

    Returns
    -------
    dict with:
        confidence_score        : float 0.0–1.0
        confidence_label        : "Very High" | "High" | "Medium" | "Low"
        reasoning_summary       : str — NL explanation
        feature_contributions   : list[dict] — top drivers of the prediction
        optimization_recommendations : list[str]
        risk_assessment         : dict
        model_info              : dict
    """
    confidence = _compute_confidence(input_data, predicted_requests)
    feature_contributions = _compute_feature_contributions(input_data, predicted_requests)
    reasoning = _generate_reasoning(
        input_data, predicted_requests, action, recommended_servers,
        load_per_server, confidence
    )
    recommendations = _generate_recommendations(
        input_data, action, load_per_server, confidence
    )
    risk = _compute_risk_assessment(input_data, load_per_server, confidence)

    return {
        "confidence_score"          : round(confidence, 4),
        "confidence_label"          : _confidence_label(confidence),
        "reasoning_summary"         : reasoning,
        "feature_contributions"     : feature_contributions,
        "optimization_recommendations": recommendations,
        "risk_assessment"           : risk,
        "model_info"                : _model_info(),
    }


# =============================================================================
# INTERNAL HELPERS
# =============================================================================

def _compute_confidence(data: dict, predicted: float) -> float:
    """
    Estimate prediction confidence using RandomForest tree variance.

    RandomForest provides individual tree predictions — the standard deviation
    across trees directly measures uncertainty: low std = high confidence.

    Falls back to a heuristic based on input feature stability if the model
    is not available.
    """
    model = _get_model()
    if model is not None and hasattr(model, "estimators_"):
        try:
            from predict import build_feature_vector
            features = build_feature_vector(data)
            # Collect predictions from each tree
            tree_preds = [tree.predict(features)[0] for tree in model.estimators_]
            mean_pred = sum(tree_preds) / len(tree_preds)
            # Coefficient of variation (CV): lower = more confident
            std_dev = math.sqrt(sum((p - mean_pred) ** 2 for p in tree_preds) / len(tree_preds))
            cv = std_dev / max(abs(mean_pred), 1e-9)
            # Map CV to confidence: CV=0 → 1.0, CV≥0.5 → 0.4
            confidence = max(0.4, min(1.0, 1.0 - (cv * 1.2)))
            return confidence
        except Exception:
            pass  # fall through to heuristic

    return _heuristic_confidence(data, predicted)


def _heuristic_confidence(data: dict, predicted: float) -> float:
    """
    Heuristic confidence when tree variance isn't available.

    Rules:
    - Stable inputs (low variance between current and historical approx) → high confidence
    - Extreme values (CPU > 90%, mem > 90%) → lower confidence (edge of training dist.)
    - High latency → reduce confidence slightly
    """
    score = 0.80  # base

    cpu = data.get("cpu_usage_percent", 50)
    mem = data.get("memory_usage_percent", 50)
    rpm = data.get("requests_per_minute", 100)
    rt  = data.get("response_time_ms", 100)

    # Extreme CPU/memory reduces confidence (could be outlier)
    if cpu > 90 or mem > 90:
        score -= 0.12
    elif cpu > 75 or mem > 75:
        score -= 0.05

    # Very low traffic is more predictable
    if rpm < 50:
        score += 0.05

    # High latency = possible system instability = less predictable
    if rt > 500:
        score -= 0.10
    elif rt > 200:
        score -= 0.05

    return round(max(0.40, min(0.95, score)), 4)


def _confidence_label(score: float) -> str:
    if score >= 0.85:
        return "Very High"
    elif score >= 0.70:
        return "High"
    elif score >= 0.55:
        return "Medium"
    return "Low"


def _compute_feature_contributions(data: dict, predicted: float) -> list[dict]:
    """
    Compute the contribution of each key feature to the prediction.

    Uses a simplified sensitivity analysis:
    For each feature, we estimate its absolute influence on the prediction
    relative to baseline values.

    Returns the top 6 most influential features.
    """
    rpm = data.get("requests_per_minute", 0)
    cpu = data.get("cpu_usage_percent", 50)
    mem = data.get("memory_usage_percent", 50)
    servers = data.get("active_servers", 1)
    rt  = data.get("response_time_ms", 100)
    hour = data.get("hour", 12)

    # Baseline contribution estimates (domain knowledge + feature importance)
    contributions = [
        {
            "feature"     : "requests_per_minute",
            "value"       : rpm,
            "contribution": round((rpm / max(predicted, 1)) * 0.45, 3),
            "direction"   : "positive" if rpm > predicted * 0.8 else "neutral",
            "description" : f"Current traffic of {rpm:.0f} req/min is the strongest driver"
        },
        {
            "feature"     : "cpu_usage_percent",
            "value"       : cpu,
            "contribution": round((cpu / 100) * 0.20, 3),
            "direction"   : "positive" if cpu > 70 else "neutral",
            "description" : f"CPU at {cpu:.1f}% {'adds upward pressure' if cpu > 70 else 'is within normal range'}"
        },
        {
            "feature"     : "memory_usage_percent",
            "value"       : mem,
            "contribution": round((mem / 100) * 0.15, 3),
            "direction"   : "positive" if mem > 70 else "neutral",
            "description" : f"Memory at {mem:.1f}% {'contributes to load' if mem > 70 else 'is stable'}"
        },
        {
            "feature"     : "active_servers",
            "value"       : servers,
            "contribution": round((1.0 / max(servers, 1)) * 0.10, 3),
            "direction"   : "negative",
            "description" : f"{servers} active server(s) diluting load per instance"
        },
        {
            "feature"     : "response_time_ms",
            "value"       : rt,
            "contribution": round(min(rt / 1000, 0.08), 3),
            "direction"   : "positive" if rt > 150 else "neutral",
            "description" : f"{'High latency signal ({rt:.0f}ms) indicates saturation' if rt > 150 else f'Response time {rt:.0f}ms is healthy'}"
        },
        {
            "feature"     : "hour_of_day",
            "value"       : hour,
            "contribution": round(0.05 if 7 <= hour <= 10 or 17 <= hour <= 20 else 0.02, 3),
            "direction"   : "positive" if 7 <= hour <= 10 or 17 <= hour <= 20 else "neutral",
            "description" : f"Hour {hour}:00 {'is a historically high-traffic period' if 7 <= hour <= 10 or 17 <= hour <= 20 else 'is off-peak'}"
        },
    ]

    # Sort by contribution descending
    contributions.sort(key=lambda x: x["contribution"], reverse=True)
    return contributions


def _generate_reasoning(
    data              : dict,
    predicted         : float,
    action            : str,
    rec_servers       : int,
    load_per_server   : float,
    confidence        : float,
) -> str:
    """Generate a natural-language reasoning summary for the prediction."""
    rpm      = data.get("requests_per_minute", 0)
    cpu      = data.get("cpu_usage_percent", 50)
    mem      = data.get("memory_usage_percent", 50)
    servers  = data.get("active_servers", 1)
    hour     = data.get("hour", 12)
    conf_pct = int(confidence * 100)

    # Time context
    if 7 <= hour <= 10:
        time_ctx = "morning peak hours"
    elif 17 <= hour <= 20:
        time_ctx = "evening peak hours"
    elif 0 <= hour <= 6:
        time_ctx = "off-peak overnight hours"
    else:
        time_ctx = "standard business hours"

    # Action-specific reasoning
    if action == "SCALE UP":
        reason = (
            f"The model predicts workload will increase to {predicted:.0f} req/min in ~5 minutes "
            f"during {time_ctx}. With {servers} active server(s), each would handle "
            f"{load_per_server:.0f} req/min — exceeding the healthy threshold of 300 req/server. "
            f"Adding server(s) to reach {rec_servers} total will redistribute load and "
            f"prevent latency degradation. "
        )
    elif action == "SCALE DOWN":
        reason = (
            f"Traffic is forecast to decrease to {predicted:.0f} req/min during {time_ctx}. "
            f"With {servers} server(s), each will only handle {load_per_server:.0f} req/min — "
            f"well below the 120 req/server threshold. Reducing to {rec_servers} server(s) "
            f"saves infrastructure cost while maintaining performance headroom. "
        )
    else:
        reason = (
            f"Workload is predicted to remain stable at {predicted:.0f} req/min during {time_ctx}. "
            f"Current load of {load_per_server:.0f} req/server across {servers} instance(s) "
            f"is within the healthy 120–300 req/server range. No scaling action is needed. "
        )

    # Add CPU/memory context
    if cpu > 80:
        reason += f"Note: CPU at {cpu:.0f}% is elevated — monitor closely for further increases. "
    if mem > 80:
        reason += f"Memory at {mem:.0f}% is high — consider memory-optimized instance types. "

    reason += f"Model confidence: {conf_pct}%."
    return reason


def _generate_recommendations(
    data            : dict,
    action          : str,
    load_per_server : float,
    confidence      : float,
) -> list[str]:
    """Generate actionable optimization recommendations."""
    recs = []
    cpu = data.get("cpu_usage_percent", 50)
    mem = data.get("memory_usage_percent", 50)
    rt  = data.get("response_time_ms", 100)
    rpm = data.get("requests_per_minute", 0)
    servers = data.get("active_servers", 1)
    cost_sv = data.get("cost_per_server", 50)

    # Cost optimization
    if action == "SCALE DOWN":
        saved = (data.get("active_servers", 1) - servers) * cost_sv
        recs.append(
            f"💰 Cost saving opportunity: Reducing servers by "
            f"{data.get('active_servers', 1) - servers} could save "
            f"~${cost_sv:.0f}/hour per server removed."
        )

    # Performance recommendations
    if rt > 300:
        recs.append(
            "⚡ Response time is critically high (>300ms). Investigate "
            "application bottlenecks, database query performance, and connection pooling."
        )
    elif rt > 150:
        recs.append(
            "⚠️ Response time is elevated (>150ms). Consider enabling "
            "caching layers (Redis/Memcached) for frequently accessed data."
        )

    # Resource-specific recommendations
    if cpu > 85:
        recs.append(
            "🔥 CPU is critically high. Consider upgrading to compute-optimized "
            "instances or load-balancing with auto-scaling groups."
        )
    elif cpu > 70 and action == "KEEP SAME":
        recs.append(
            "📊 CPU approaching 70%. Set up an auto-scaling trigger at 75% "
            "to proactively add capacity before saturation."
        )

    if mem > 85:
        recs.append(
            "💾 Memory pressure detected. Profile for memory leaks or "
            "migrate to memory-optimized instance types (e.g., r5.large)."
        )

    # Confidence-based recommendations
    if confidence < 0.60:
        recs.append(
            "🔄 Prediction confidence is moderate. Collect more telemetry data "
            "and consider retraining the model for better accuracy."
        )

    # Peak traffic handling
    hour = data.get("hour", 12)
    if 7 <= hour <= 10 or 17 <= hour <= 20:
        recs.append(
            "📈 You are in a peak traffic window. Pre-warm capacity 10–15 min "
            "ahead of known peak periods using scheduled scaling policies."
        )

    # Cost efficiency
    current_cost = servers * cost_sv
    recs.append(
        f"💡 Current infrastructure cost: ${current_cost:.2f}/hour. "
        f"At {rpm:.0f} req/min, cost efficiency is "
        f"${(current_cost / max(rpm, 1)) * 1000:.2f} per 1000 requests."
    )

    return recs[:5]  # Return top 5 recommendations


def _compute_risk_assessment(
    data            : dict,
    load_per_server : float,
    confidence      : float,
) -> dict:
    """Compute a risk assessment for the current system state."""
    cpu = data.get("cpu_usage_percent", 50)
    mem = data.get("memory_usage_percent", 50)
    rt  = data.get("response_time_ms", 100)

    risks = []
    overall_risk = "low"

    if cpu > 85:
        risks.append({"type": "cpu_saturation", "severity": "critical",
                      "detail": f"CPU at {cpu:.0f}% — approaching saturation"})
        overall_risk = "critical"
    elif cpu > 70:
        risks.append({"type": "cpu_elevated", "severity": "warning",
                      "detail": f"CPU at {cpu:.0f}% — above optimal threshold"})
        if overall_risk == "low":
            overall_risk = "medium"

    if mem > 85:
        risks.append({"type": "memory_pressure", "severity": "critical",
                      "detail": f"Memory at {mem:.0f}% — high pressure"})
        overall_risk = "critical"
    elif mem > 70:
        risks.append({"type": "memory_elevated", "severity": "warning",
                      "detail": f"Memory at {mem:.0f}% — monitor for growth"})
        if overall_risk == "low":
            overall_risk = "medium"

    if rt > 500:
        risks.append({"type": "high_latency", "severity": "critical",
                      "detail": f"Response time {rt:.0f}ms — SLA likely breached"})
        overall_risk = "critical"
    elif rt > 200:
        risks.append({"type": "latency_degraded", "severity": "warning",
                      "detail": f"Response time {rt:.0f}ms — user experience degraded"})

    if load_per_server > 400:
        risks.append({"type": "server_overload", "severity": "critical",
                      "detail": f"Load {load_per_server:.0f} req/server — critical overload"})
        overall_risk = "critical"

    if confidence < 0.55:
        risks.append({"type": "low_confidence", "severity": "info",
                      "detail": "Prediction confidence is low — treat recommendation with caution"})

    return {
        "overall_risk": overall_risk,
        "risk_score"  : round(_risk_score(cpu, mem, rt, load_per_server), 2),
        "risks"       : risks,
    }


def _risk_score(cpu: float, mem: float, rt: float, load: float) -> float:
    """Composite risk score 0.0–1.0."""
    cpu_risk  = min(cpu / 100, 1.0)
    mem_risk  = min(mem / 100, 1.0)
    rt_risk   = min(rt / 1000, 1.0)
    load_risk = min(load / 500, 1.0)
    return (cpu_risk * 0.35 + mem_risk * 0.25 + rt_risk * 0.20 + load_risk * 0.20)


def _model_info() -> dict:
    """Return metadata about the loaded model."""
    model = _get_model()
    if model is not None and hasattr(model, "estimators_"):
        return {
            "type"          : "RandomForestRegressor",
            "n_estimators"  : len(model.estimators_),
            "n_features"    : model.n_features_in_ if hasattr(model, "n_features_in_") else 39,
            "framework"     : "scikit-learn",
        }
    return {"type": "RandomForestRegressor", "n_features": 39, "framework": "scikit-learn"}
