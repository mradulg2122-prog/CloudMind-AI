"use client";
// =============================================================================
// CloudMind AI – components/ExplanationPanel.tsx
//
// XAI Explanation Panel Component
// ────────────────────────────────
// Renders the full explainable AI output for a prediction:
//   - Confidence score with animated gauge
//   - Risk level badge
//   - Natural-language reasoning summary
//   - Top feature contributions (bar chart)
//   - Optimization recommendations list
// =============================================================================

import React, { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface FeatureContribution {
  feature: string;
  value: number;
  contribution: number;
  direction: "positive" | "negative" | "neutral";
  description: string;
}

interface ExplanationData {
  confidence_score: number;
  confidence_label: "Very High" | "High" | "Medium" | "Low";
  reasoning_summary: string;
  feature_contributions: FeatureContribution[];
  optimization_recommendations: string[];
  risk_assessment?: {
    overall_risk: "low" | "medium" | "high" | "critical";
    risk_score: number;
    risks: Array<{ type: string; severity: string; detail: string }>;
  };
  risk_level?: string;
}

interface Props {
  explanation: ExplanationData | null;
  isLoading?: boolean;
}

// Color mapping for confidence levels
const CONFIDENCE_COLORS: Record<string, string> = {
  "Very High": "#10b981",
  "High"     : "#3b82f6",
  "Medium"   : "#f59e0b",
  "Low"      : "#ef4444",
};

// Color mapping for risk levels
const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "low"     : { bg: "#064e3b", text: "#10b981", border: "#10b981" },
  "medium"  : { bg: "#78350f", text: "#fbbf24", border: "#f59e0b" },
  "high"    : { bg: "#7c2d12", text: "#fb923c", border: "#f97316" },
  "critical": { bg: "#450a0a", text: "#f87171", border: "#ef4444" },
};

// Feature name formatter
const formatFeatureName = (name: string): string => {
  const map: Record<string, string> = {
    requests_per_minute: "Requests/min",
    cpu_usage_percent  : "CPU Usage",
    memory_usage_percent: "Memory Usage",
    active_servers     : "Active Servers",
    response_time_ms   : "Response Time",
    hour_of_day        : "Hour of Day",
  };
  return map[name] || name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

// Confidence gauge (SVG arc)
const ConfidenceGauge: React.FC<{ score: number; label: string }> = ({ score, label }) => {
  const color = CONFIDENCE_COLORS[label] || "#6b7280";
  const pct   = Math.min(100, Math.max(0, score * 100));
  // Arc math: semicircle gauge
  const r = 54;
  const cx = 70, cy = 70;
  const startAngle = -180;
  const endAngle   = startAngle + (180 * pct / 100);
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const sx = cx + r * Math.cos(toRad(startAngle));
  const sy = cy + r * Math.sin(toRad(startAngle));
  const ex = cx + r * Math.cos(toRad(endAngle));
  const ey = cy + r * Math.sin(toRad(endAngle));
  const largeArc = pct > 50 ? 1 : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width="140" height="80" viewBox="0 0 140 80">
        {/* Background track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="#1e293b" strokeWidth="10" strokeLinecap="round"
        />
        {/* Progress arc */}
        {pct > 0 && (
          <path
            d={`M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`}
            fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        )}
        {/* Score text */}
        <text x={cx} y={cy - 6} textAnchor="middle" fill={color}
          style={{ fontSize: "20px", fontWeight: 700, fontFamily: "Inter, sans-serif" }}>
          {Math.round(pct)}%
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="#94a3b8"
          style={{ fontSize: "10px", fontFamily: "Inter, sans-serif" }}>
          {label}
        </text>
      </svg>
    </div>
  );
};

export default function ExplanationPanel({ explanation, isLoading }: Props) {
  const [activeTab, setActiveTab] = useState<"reasoning" | "features" | "recommendations">("reasoning");

  if (isLoading) {
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>
          <span style={titleStyle}>🧠 AI Explanation</span>
        </div>
        <div style={{ padding: "24px", textAlign: "center" }}>
          <div style={spinnerStyle} />
          <p style={{ color: "#64748b", marginTop: "12px" }}>Generating explanation…</p>
        </div>
      </div>
    );
  }

  if (!explanation) {
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>
          <span style={titleStyle}>🧠 AI Explanation</span>
        </div>
        <div style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>
          Run a prediction to see the AI explanation.
        </div>
      </div>
    );
  }

  const risk = explanation.risk_assessment?.overall_risk || explanation.risk_level || "low";
  const riskStyle = RISK_COLORS[risk] || RISK_COLORS.low;

  const chartData = (explanation.feature_contributions || []).slice(0, 6).map((f) => ({
    name        : formatFeatureName(f.feature),
    contribution: Math.round(f.contribution * 100),
    direction   : f.direction,
    description : f.description,
  }));

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={titleStyle}>🧠 AI Explanation</span>
        <span style={{
          ...badgeStyle,
          background  : riskStyle.bg,
          color       : riskStyle.text,
          borderColor : riskStyle.border,
        }}>
          Risk: {risk.toUpperCase()}
        </span>
      </div>

      {/* Confidence gauge */}
      <div style={{ display: "flex", alignItems: "center", gap: "24px", padding: "16px 20px", borderBottom: "1px solid #1e293b" }}>
        <ConfidenceGauge score={explanation.confidence_score} label={explanation.confidence_label} />
        <div>
          <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "4px" }}>PREDICTION CONFIDENCE</div>
          <div style={{ color: "#f1f5f9", fontSize: "22px", fontWeight: 700 }}>
            {explanation.confidence_label}
          </div>
          <div style={{ color: "#64748b", fontSize: "12px" }}>
            Score: {explanation.confidence_score.toFixed(3)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #1e293b" }}>
        {(["reasoning", "features", "recommendations"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: "10px", border: "none", cursor: "pointer",
              background   : activeTab === tab ? "#1e3a5f" : "transparent",
              color        : activeTab === tab ? "#60a5fa" : "#64748b",
              fontSize     : "12px", fontWeight: 600, textTransform: "uppercase",
              borderBottom : activeTab === tab ? "2px solid #3b82f6" : "2px solid transparent",
              transition   : "all 0.15s",
            }}>
            {tab === "reasoning" ? "💬 Reasoning" : tab === "features" ? "📊 Features" : "💡 Actions"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: "16px 20px", minHeight: "160px" }}>
        {activeTab === "reasoning" && (
          <div>
            <p style={{ color: "#cbd5e1", fontSize: "13px", lineHeight: "1.7", margin: 0 }}>
              {explanation.reasoning_summary}
            </p>
            {/* Risk items */}
            {explanation.risk_assessment?.risks && explanation.risk_assessment.risks.length > 0 && (
              <div style={{ marginTop: "12px" }}>
                <div style={{ color: "#94a3b8", fontSize: "11px", fontWeight: 600, marginBottom: "8px" }}>
                  DETECTED RISKS
                </div>
                {explanation.risk_assessment.risks.map((r, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "flex-start", gap: "8px",
                    marginBottom: "6px",
                  }}>
                    <span style={{ fontSize: "14px" }}>
                      {r.severity === "critical" ? "🔴" : r.severity === "warning" ? "🟡" : "🔵"}
                    </span>
                    <span style={{ color: "#94a3b8", fontSize: "12px" }}>{r.detail}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "features" && (
          <div>
            <div style={{ color: "#94a3b8", fontSize: "11px", fontWeight: 600, marginBottom: "10px" }}>
              TOP FEATURE CONTRIBUTIONS (% of prediction)
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: "#94a3b8", fontSize: 10 }} width={100} />
                <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
                labelStyle={{ color: "#f1f5f9" }}
                formatter={(value: any) => {
                  return value ? value.toString() : "0";
                }
              }
                />
                <Bar dataKey="contribution" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i}
                      fill={entry.direction === "positive" ? "#3b82f6" : entry.direction === "negative" ? "#10b981" : "#6b7280"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeTab === "recommendations" && (
          <div>
            {(explanation.optimization_recommendations || []).map((rec, i) => (
              <div key={i} style={{
                background  : "#0f172a",
                border      : "1px solid #1e293b",
                borderRadius: "8px",
                padding     : "10px 12px",
                marginBottom: "8px",
                fontSize    : "12px",
                color       : "#cbd5e1",
                lineHeight  : "1.6",
              }}>
                {rec}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const panelStyle: React.CSSProperties = {
  background  : "#0f172a",
  border      : "1px solid #1e293b",
  borderRadius: "12px",
  overflow    : "hidden",
};

const headerStyle: React.CSSProperties = {
  display       : "flex",
  justifyContent: "space-between",
  alignItems    : "center",
  padding       : "14px 20px",
  borderBottom  : "1px solid #1e293b",
  background    : "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
};

const titleStyle: React.CSSProperties = {
  color     : "#f1f5f9",
  fontSize  : "15px",
  fontWeight: 700,
  letterSpacing: "0.2px",
};

const badgeStyle: React.CSSProperties = {
  padding      : "3px 10px",
  borderRadius : "20px",
  border       : "1px solid",
  fontSize     : "11px",
  fontWeight   : 700,
  letterSpacing: "0.5px",
};

const spinnerStyle: React.CSSProperties = {
  width           : "32px",
  height          : "32px",
  border          : "3px solid #1e293b",
  borderTopColor  : "#3b82f6",
  borderRadius    : "50%",
  animation       : "spin 1s linear infinite",
  margin          : "0 auto",
};
