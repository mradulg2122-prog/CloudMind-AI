"use client";
// =============================================================================
// CloudMind AI – components/ReportViewer.tsx
//
// Report Viewer Component
// ────────────────────────
// Displays a list of generated optimization/historical reports
// with ability to view detail and download as JSON or CSV.
// =============================================================================

import React, { useState, useEffect, useCallback } from "react";

interface Report {
  id          : number;
  report_type : string;
  title       : string;
  created_at  : string;
}

interface ReportDetail {
  id          : number;
  report_type : string;
  title       : string;
  content     : Record<string, any>;
  created_at  : string;
}

interface Props {
  apiUrl   : string;
  token    : string | null;
}

const REPORT_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  "cost_prediction"       : { label: "Cost Prediction",    icon: "💰", color: "#10b981" },
  "optimization_decision" : { label: "Optimization",       icon: "⚡", color: "#3b82f6" },
  "historical_performance": { label: "Historical Analysis", icon: "📈", color: "#8b5cf6" },
};

export default function ReportViewer({ apiUrl, token }: Props) {
  const [reports, setReports]           = useState<Report[]>([]);
  const [selected, setSelected]         = useState<ReportDetail | null>(null);
  const [isLoading, setIsLoading]       = useState(false);
  const [isDetailLoading, setDetailLoading] = useState(false);
  const [filter, setFilter]             = useState<string>("");
  const [error, setError]               = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchReports = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${apiUrl}/reports?limit=50`, { headers });
      if (!resp.ok) throw new Error(`${resp.status} — ${resp.statusText}`);
      setReports(await resp.json());
    } catch (err: any) {
      setError(err.message || "Failed to load reports");
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, token]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const fetchDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const resp = await fetch(`${apiUrl}/reports/${id}`, { headers });
      if (!resp.ok) throw new Error(`${resp.status}`);
      setSelected(await resp.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const generateHistorical = async () => {
    setIsLoading(true);
    try {
      const resp = await fetch(`${apiUrl}/reports/historical?days=7`, {
        method: "POST", headers,
      });
      if (!resp.ok) throw new Error(`${resp.status}`);
      await fetchReports();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadCSV = () => {
    if (!token) return;
    const url = `${apiUrl}/reports/export/csv`;
    const a = document.createElement("a");
    a.href = url;
    a.click();
  };

  const downloadJSON = () => {
    if (!token) return;
    fetch(`${apiUrl}/reports/export/json`, { headers })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement("a");
        a.href    = url;
        a.download = "cloudmind_reports.json";
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  const filtered = filter
    ? reports.filter((r) => r.report_type === filter)
    : reports;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "16px" }}>
      {/* Report List */}
      <div style={panelStyle}>
        <div style={headerStyle}>
          <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: "14px" }}>📄 Reports</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={generateHistorical} style={actionBtnStyle("blue")} title="Generate 7-day historical report">
              + Historical
            </button>
            <button onClick={downloadCSV}  style={actionBtnStyle("green")} title="Download CSV">CSV</button>
            <button onClick={downloadJSON} style={actionBtnStyle("purple")} title="Download JSON">JSON</button>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: "4px", padding: "8px 12px", borderBottom: "1px solid #1e293b" }}>
          <FilterTab label="All" value="" current={filter} onChange={setFilter} />
          {Object.entries(REPORT_TYPE_LABELS).map(([key, { label }]) => (
            <FilterTab key={key} label={label} value={key} current={filter} onChange={setFilter} />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: "10px 12px", color: "#f87171", fontSize: "12px", background: "#450a0a" }}>
            ⚠ {error}
          </div>
        )}

        {/* List */}
        <div style={{ overflowY: "auto", maxHeight: "420px" }}>
          {isLoading ? (
            <div style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>
              No reports yet. Make a prediction to auto-generate one.
            </div>
          ) : (
            filtered.map((r) => {
              const meta = REPORT_TYPE_LABELS[r.report_type] || { label: r.report_type, icon: "📋", color: "#6b7280" };
              return (
                <div key={r.id}
                  onClick={() => fetchDetail(r.id)}
                  style={{
                    padding     : "12px 16px",
                    borderBottom: "1px solid #1e293b",
                    cursor      : "pointer",
                    background  : selected?.id === r.id ? "#1e293b" : "transparent",
                    transition  : "background 0.15s",
                  }}
                  onMouseEnter={(e) => { if (selected?.id !== r.id) (e.currentTarget as HTMLElement).style.background = "#0f1a2e"; }}
                  onMouseLeave={(e) => { if (selected?.id !== r.id) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{
                      background  : meta.color + "22",
                      color       : meta.color,
                      borderRadius: "4px",
                      padding     : "2px 6px",
                      fontSize    : "10px",
                      fontWeight  : 700,
                    }}>
                      {meta.icon} {meta.label}
                    </span>
                    <span style={{ color: "#64748b", fontSize: "10px", marginLeft: "auto" }}>
                      #{r.id}
                    </span>
                  </div>
                  <div style={{ color: "#cbd5e1", fontSize: "12px", lineHeight: "1.4" }}>
                    {r.title}
                  </div>
                  <div style={{ color: "#475569", fontSize: "10px", marginTop: "4px" }}>
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Report Detail */}
      <div style={panelStyle}>
        <div style={headerStyle}>
          <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: "14px" }}>
            📊 Report Detail
          </span>
          {selected && (
            <span style={{ color: "#64748b", fontSize: "11px" }}>ID #{selected.id}</span>
          )}
        </div>

        <div style={{ padding: "16px", overflowY: "auto", maxHeight: "480px" }}>
          {isDetailLoading ? (
            <div style={{ textAlign: "center", color: "#64748b" }}>Loading detail…</div>
          ) : !selected ? (
            <div style={{ textAlign: "center", color: "#64748b", paddingTop: "40px" }}>
              Select a report to view its full content.
            </div>
          ) : (
            <ReportContent report={selected} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Report Content Renderer ────────────────────────────────────────────────────
function ReportContent({ report }: { report: ReportDetail }) {
  const content = report.content || {};

  return (
    <div>
      <h3 style={{ color: "#f1f5f9", fontSize: "14px", margin: "0 0 16px" }}>{report.title}</h3>

      {/* Key metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "16px" }}>
        {[
          ["Total Predictions", content.total_predictions],
          ["Avg Traffic",       content.avg_predicted_requests ? `${content.avg_predicted_requests} rpm` : null],
          ["Est. Saved",        content.estimated_cost_saved   ? `$${content.estimated_cost_saved}` : null],
          ["Period",            content.period_days            ? `${content.period_days} days` : null],
          ["Current Cost",      content.current_hourly_cost    ? `$${content.current_hourly_cost}/hr` : null],
          ["Rec. Cost",         content.recommended_hourly     ? `$${content.recommended_hourly}/hr` : null],
          ["Action",            content.action || content.prediction?.action],
          ["Confidence",        content.explanation?.confidence_label],
        ]
          .filter(([, v]) => v != null)
          .map(([label, value], i) => (
            <div key={i} style={{
              background  : "#1e293b",
              borderRadius: "8px",
              padding     : "10px 12px",
            }}>
              <div style={{ color: "#64748b", fontSize: "10px", fontWeight: 600 }}>{label}</div>
              <div style={{ color: "#f1f5f9", fontSize: "14px", fontWeight: 700, marginTop: "2px" }}>
                {String(value)}
              </div>
            </div>
          ))}
      </div>

      {/* Summary */}
      {(content.summary || content.explanation?.reasoning_summary) && (
        <div style={{
          background  : "#0f172a",
          border      : "1px solid #1e293b",
          borderRadius: "8px",
          padding     : "12px",
          marginBottom: "12px",
        }}>
          <div style={{ color: "#94a3b8", fontSize: "11px", fontWeight: 600, marginBottom: "6px" }}>SUMMARY</div>
          <p style={{ color: "#cbd5e1", fontSize: "12px", margin: 0, lineHeight: "1.6" }}>
            {content.summary || content.explanation?.reasoning_summary}
          </p>
        </div>
      )}

      {/* Recommendations */}
      {content.explanation?.recommendations && content.explanation.recommendations.length > 0 && (
        <div>
          <div style={{ color: "#94a3b8", fontSize: "11px", fontWeight: 600, marginBottom: "8px" }}>
            RECOMMENDATIONS
          </div>
          {content.explanation.recommendations.map((rec: string, i: number) => (
            <div key={i} style={{
              background  : "#0f172a",
              border      : "1px solid #1e293b",
              borderRadius: "6px",
              padding     : "8px 10px",
              marginBottom: "6px",
              fontSize    : "11px",
              color       : "#cbd5e1",
              lineHeight  : "1.5",
            }}>
              {rec}
            </div>
          ))}
        </div>
      )}

      {/* Action distribution */}
      {content.action_distribution && (
        <div style={{ marginTop: "12px" }}>
          <div style={{ color: "#94a3b8", fontSize: "11px", fontWeight: 600, marginBottom: "8px" }}>
            ACTION DISTRIBUTION
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {Object.entries(content.action_distribution as Record<string, number>).map(([action, count]) => (
              <div key={action} style={{
                flex        : 1,
                background  : action === "SCALE UP" ? "#1e3a5f22" : action === "SCALE DOWN" ? "#06402022" : "#1e293b",
                border      : `1px solid ${action === "SCALE UP" ? "#3b82f6" : action === "SCALE DOWN" ? "#10b981" : "#374151"}`,
                borderRadius: "8px",
                padding     : "8px",
                textAlign   : "center",
              }}>
                <div style={{ color: "#f1f5f9", fontSize: "18px", fontWeight: 700 }}>{count}</div>
                <div style={{ color: "#64748b", fontSize: "9px" }}>{action}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function FilterTab({ label, value, current, onChange }: {
  label: string; value: string; current: string; onChange: (v: string) => void;
}) {
  const active = current === value;
  return (
    <button onClick={() => onChange(value)} style={{
      padding     : "4px 10px",
      borderRadius: "20px",
      border      : `1px solid ${active ? "#3b82f6" : "#1e293b"}`,
      background  : active ? "#1e3a5f" : "transparent",
      color       : active ? "#60a5fa" : "#64748b",
      fontSize    : "10px",
      fontWeight  : 600,
      cursor      : "pointer",
      whiteSpace  : "nowrap",
    }}>
      {label}
    </button>
  );
}

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
  padding       : "12px 16px",
  borderBottom  : "1px solid #1e293b",
  background    : "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
};

const actionBtnStyle = (color: string): React.CSSProperties => ({
  padding      : "4px 10px",
  borderRadius : "6px",
  border       : `1px solid ${color === "blue" ? "#3b82f6" : color === "green" ? "#10b981" : "#8b5cf6"}`,
  background   : color === "blue" ? "#1e3a5f22" : color === "green" ? "#06402022" : "#1e1b4b22",
  color        : color === "blue" ? "#60a5fa" : color === "green" ? "#34d399" : "#a78bfa",
  fontSize     : "11px",
  fontWeight   : 600,
  cursor       : "pointer",
});
