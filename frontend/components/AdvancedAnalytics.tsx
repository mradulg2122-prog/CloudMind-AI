// =============================================================================
// CloudMind AI – components/AdvancedAnalytics.tsx  (NEW in v3)
//
// Advanced Analytics Dashboard Panel
// ────────────────────────────────────
// Fetches data from GET /analytics and renders:
//   1. KPI Summary Cards (total predictions, cost saved, scale rates)
//   2. Action Distribution Donut Chart (Scale Up / Down / Keep Same)
//   3. Traffic Range Bar (peak vs min vs avg predicted traffic)
//   4. Server Utilization Heatmap-style bar chart
//   5. Cost Savings Gauge
//   6. Export Buttons (CSV + PDF)
// =============================================================================

"use client";

import { useEffect, useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";
import { getToken } from "../lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────
interface AnalyticsData {
  total_predictions         : number;
  action_distribution       : { "SCALE UP": number; "SCALE DOWN": number; "KEEP SAME": number };
  avg_predicted_requests    : number;
  avg_load_per_server       : number;
  avg_servers_recommended   : number;
  peak_predicted_requests   : number;
  min_predicted_requests    : number;
  scale_up_rate_pct         : number;
  scale_down_rate_pct       : number;
  estimated_cost_saved_usd  : number;
  avg_cpu_percent           : number;
  avg_memory_percent        : number;
  recent_scaling_decisions  : {
    action: string; before_servers: number; after_servers: number;
    reason: string; decided_at: string;
  }[];
  message?: string;
}

// ── Color Palette ──────────────────────────────────────────────────────────────
const COLORS = {
  scaleUp   : "#00c2ff",
  keepSame  : "#7c5cbf",
  scaleDown : "#22d3ee",
  accent    : "#4ade80",
  warn      : "#fb923c",
  danger    : "#f87171",
  text      : "#94a3b8",
};

// ── API helper ─────────────────────────────────────────────────────────────────
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchAnalytics(): Promise<AnalyticsData> {
  const token = getToken();
  const res = await fetch(`${API}/analytics`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Analytics fetch failed: ${res.status}`);
  return res.json();
}

// ── Export helpers ─────────────────────────────────────────────────────────────
async function downloadExport(endpoint: string, filename: string) {
  const token = getToken();
  const res = await fetch(`${API}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}


// =============================================================================
// SUBCOMPONENTS
// =============================================================================

function KpiCard({ label, value, sub, color = "#00c2ff" }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: `1px solid rgba(255,255,255,0.08)`,
      borderRadius: "12px",
      padding: "18px 20px",
      display: "flex", flexDirection: "column", gap: "6px",
    }}>
      <span style={{ fontSize: "11px", color: COLORS.text, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </span>
      <span style={{ fontSize: "28px", fontWeight: 700, color }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: "12px", color: COLORS.text }}>{sub}</span>}
    </div>
  );
}

// Custom donut label
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};


// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function AdvancedAnalytics() {
  const [data, setData]         = useState<AnalyticsData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [retraining, setRetrain]  = useState(false);
  const [retrainResult, setRetrainResult] = useState<any>(null);

  useEffect(() => {
    fetchAnalytics()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleExport = async (type: "csv" | "pdf") => {
    setExporting(type);
    try {
      const ext  = type === "csv" ? "csv" : "pdf";
      const name = `cloudmind_report.${ext}`;
      await downloadExport(`/export/${type}`, name);
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    } finally {
      setExporting(null);
    }
  };

  const handleRetrain = async () => {
    if (!confirm("Trigger ML model retraining? This may take a moment.")) return;
    setRetrain(true);
    setRetrainResult(null);
    try {
      const token = getToken();
      const res = await fetch(`${API}/retrain/trigger`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setRetrainResult(json);
    } catch (e: any) {
      setRetrainResult({ status: "error", error: e.message });
    } finally {
      setRetrain(false);
    }
  };

  // ── Loading / Error States ──────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding: "40px", textAlign: "center", color: COLORS.text }}>
      <div style={{ fontSize: "14px" }}>⏳ Loading analytics…</div>
    </div>
  );

  if (error) return (
    <div style={{ padding: "20px", color: COLORS.danger, fontSize: "13px" }}>
      ⚠ Failed to load analytics: {error}
    </div>
  );

  if (!data || data.total_predictions === 0) return (
    <div style={{ padding: "40px", textAlign: "center", color: COLORS.text }}>
      <div style={{ fontSize: "40px", marginBottom: "12px" }}>📊</div>
      <div style={{ fontSize: "15px", fontWeight: 600, color: "#e2e8f0" }}>No analytics yet</div>
      <div style={{ fontSize: "13px" }}>Run at least one prediction to see analytics.</div>
    </div>
  );

  // ── Derived chart data ──────────────────────────────────────────────────────
  const donutData = [
    { name: "SCALE UP",   value: data.action_distribution["SCALE UP"],   fill: COLORS.scaleUp  },
    { name: "KEEP SAME",  value: data.action_distribution["KEEP SAME"],  fill: COLORS.keepSame },
    { name: "SCALE DOWN", value: data.action_distribution["SCALE DOWN"], fill: COLORS.scaleDown},
  ].filter(d => d.value > 0);

  const trafficBarData = [
    { name: "Peak",    value: data.peak_predicted_requests,  fill: COLORS.warn     },
    { name: "Average", value: data.avg_predicted_requests,   fill: COLORS.scaleUp  },
    { name: "Min",     value: data.min_predicted_requests,   fill: COLORS.keepSame },
  ];

  const radarData = [
    { metric: "CPU %",       value: data.avg_cpu_percent       },
    { metric: "Memory %",    value: data.avg_memory_percent    },
    { metric: "Scale Up %",  value: data.scale_up_rate_pct     },
    { metric: "Scale Down%", value: data.scale_down_rate_pct   },
    { metric: "Avg Load",    value: Math.min(data.avg_load_per_server, 100) },
    { metric: "Avg Servers", value: (data.avg_servers_recommended || 1) * 10 },
  ];

  return (
    <div style={{ padding: "0 0 24px 0" }}>

      {/* ── Header + Export buttons ─────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <div style={{ fontSize: "13px", color: COLORS.text, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>
            Advanced Analytics
          </div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#f1f5f9" }}>
            Prediction Intelligence Dashboard
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {/* Export CSV */}
          <button id="export-csv-btn" onClick={() => handleExport("csv")} disabled={!!exporting} style={{
            background: "rgba(0,194,255,0.12)", border: "1px solid rgba(0,194,255,0.3)",
            color: "#00c2ff", padding: "9px 18px", borderRadius: "8px",
            fontSize: "13px", fontWeight: 600, cursor: "pointer",
            opacity: exporting === "csv" ? 0.6 : 1,
            transition: "all 0.2s",
          }}>
            {exporting === "csv" ? "⏳ Exporting…" : "⬇ Export CSV"}
          </button>

          {/* Export PDF */}
          <button id="export-pdf-btn" onClick={() => handleExport("pdf")} disabled={!!exporting} style={{
            background: "rgba(124,92,191,0.15)", border: "1px solid rgba(124,92,191,0.4)",
            color: "#a78bfa", padding: "9px 18px", borderRadius: "8px",
            fontSize: "13px", fontWeight: 600, cursor: "pointer",
            opacity: exporting === "pdf" ? 0.6 : 1,
            transition: "all 0.2s",
          }}>
            {exporting === "pdf" ? "⏳ Generating…" : "📄 Export PDF"}
          </button>

          {/* Retrain Model */}
          <button id="retrain-btn" onClick={handleRetrain} disabled={retraining} style={{
            background: "rgba(34,211,110,0.1)", border: "1px solid rgba(34,211,110,0.3)",
            color: "#4ade80", padding: "9px 18px", borderRadius: "8px",
            fontSize: "13px", fontWeight: 600, cursor: "pointer",
            opacity: retraining ? 0.6 : 1, transition: "all 0.2s",
          }}>
            {retraining ? "🔄 Retraining…" : "🤖 Retrain Model"}
          </button>
        </div>
      </div>

      {/* Retrain result banner */}
      {retrainResult && (
        <div style={{
          background: retrainResult.status === "success" ? "rgba(34,211,110,0.1)" : "rgba(248,113,113,0.1)",
          border: `1px solid ${retrainResult.status === "success" ? "rgba(34,211,110,0.3)" : "rgba(248,113,113,0.3)"}`,
          borderRadius: "10px", padding: "14px 18px", marginBottom: "20px", fontSize: "13px",
          color: retrainResult.status === "success" ? "#4ade80" : "#f87171",
        }}>
          {retrainResult.status === "success"
            ? `✅ Retraining complete! Samples used: ${retrainResult.samples_used ?? "—"} | MAE: ${retrainResult.new_model_mae ?? "—"} req/min`
            : `❌ Retraining failed: ${retrainResult.error}`}
        </div>
      )}

      {/* ── KPI Cards Row ───────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        <KpiCard label="Total Predictions"    value={data.total_predictions}                   color="#00c2ff" />
        <KpiCard label="Avg Traffic Forecast" value={`${data.avg_predicted_requests} rpm`}     color="#7c5cbf" />
        <KpiCard label="Avg Load / Server"    value={`${data.avg_load_per_server} rpm`}        color="#22d3ee" />
        <KpiCard label="Scale Up Rate"        value={`${data.scale_up_rate_pct}%`}             color={COLORS.scaleUp}  sub="of all predictions" />
        <KpiCard label="Scale Down Rate"      value={`${data.scale_down_rate_pct}%`}           color={COLORS.scaleDown} sub="of all predictions" />
        <KpiCard label="Est. Cost Saved"      value={`$${data.estimated_cost_saved_usd}`}      color="#4ade80" sub="from scale-down actions" />
      </div>

      {/* ── Charts Row ──────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "24px" }}>

        {/* Donut — Action Distribution */}
        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "14px", padding: "20px",
        }}>
          <div style={{ fontSize: "12px", color: COLORS.text, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "14px" }}>
            Action Distribution
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                labelLine={false} label={renderCustomLabel} dataKey="value">
                {donutData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} strokeWidth={0} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any, name: any) => [`${v} predictions`, name]}
                contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", marginTop: "8px" }}>
            {donutData.map(d => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: COLORS.text }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.fill, display: "inline-block" }} />
                {d.name}
              </div>
            ))}
          </div>
        </div>

        {/* Bar — Traffic Range */}
        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "14px", padding: "20px",
        }}>
          <div style={{ fontSize: "12px", color: COLORS.text, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "14px" }}>
            Traffic Trend Range (req/min)
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trafficBarData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: COLORS.text, fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {trafficBarData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Radar — System Health */}
        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "14px", padding: "20px",
        }}>
          <div style={{ fontSize: "12px", color: COLORS.text, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "14px" }}>
            System Health Radar
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: COLORS.text, fontSize: 10 }} />
              <Radar name="System" dataKey="value" stroke="#00c2ff" fill="#00c2ff" fillOpacity={0.15} strokeWidth={2} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Recent Scaling Decisions Table ──────────────────────────────────── */}
      {data.recent_scaling_decisions && data.recent_scaling_decisions.length > 0 && (
        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "14px", padding: "20px",
        }}>
          <div style={{ fontSize: "12px", color: COLORS.text, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "16px" }}>
            Recent Scaling Decisions
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {["Action", "Before", "After", "Reason", "Time"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: COLORS.text, fontWeight: 600, fontSize: "11px", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recent_scaling_decisions.map((d, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
                        background: d.action === "SCALE UP"
                          ? "rgba(0,194,255,0.15)" : d.action === "SCALE DOWN"
                          ? "rgba(34,211,238,0.15)" : "rgba(124,92,191,0.15)",
                        color: d.action === "SCALE UP"
                          ? "#00c2ff" : d.action === "SCALE DOWN"
                          ? "#22d3ee" : "#a78bfa",
                      }}>
                        {d.action}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#e2e8f0" }}>{d.before_servers} servers</td>
                    <td style={{ padding: "10px 12px", color: "#e2e8f0" }}>{d.after_servers} servers</td>
                    <td style={{ padding: "10px 12px", color: COLORS.text, maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.reason}</td>
                    <td style={{ padding: "10px 12px", color: COLORS.text }}>{d.decided_at ? new Date(d.decided_at).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
