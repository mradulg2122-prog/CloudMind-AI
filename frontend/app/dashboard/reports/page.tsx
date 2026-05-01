'use client';
// =============================================================================
// CloudMind AI – app/dashboard/reports/page.tsx (v4)
// Reports page with preview mini-charts + CSV/PDF export
// =============================================================================

import { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchPredictionHistory, getToken } from '@/lib/api';
import { useToast } from '@/lib/toast';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://cloudmind-ai.onrender.com';

function ExportCard({ icon, title, desc, color, format, onExport, loading }: {
  icon: string; title: string; desc: string; color: string; format: string;
  onExport: () => void; loading: boolean;
}) {
  return (
    <div className="card card-p" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{desc}</div>
      </div>
      <span className="badge badge-gray">{format}</span>
      <button
        className="btn btn-primary"
        style={{ background: color, minWidth: 120 }}
        onClick={onExport}
        disabled={loading}
      >
        {loading ? <><div className="spinner spinner-sm" /> Exporting…</> : '⬇ Export'}
      </button>
    </div>
  );
}

const DarkTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1e2a3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#e2e8f0' }}>
      <div style={{ color: '#64748b', marginBottom: 3 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: p.color, display: 'inline-block' }} />
          <span style={{ fontWeight: 700 }}>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function ReportsPage() {
  const { toast } = useToast();
  const [history,    setHistory]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [csvLoading, setCsvLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    fetchPredictionHistory(100)
      .then(d => setHistory((d as any[]).reverse()))
      .catch(() => toast('Failed to load preview data', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const exportCsv = async () => {
    setCsvLoading(true);
    try {
      const res = await fetch(`${API}/export/csv`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `cloudmind-report-${new Date().toISOString().slice(0,10)}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast('CSV downloaded successfully!', 'success');
    } catch { toast('CSV export failed', 'error'); }
    finally { setCsvLoading(false); }
  };

  const exportPdf = async () => {
    setPdfLoading(true);
    try {
      const res = await fetch(`${API}/export/pdf`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `cloudmind-report-${new Date().toISOString().slice(0,10)}.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast('PDF downloaded successfully!', 'success');
    } catch { toast('PDF export failed', 'error'); }
    finally { setPdfLoading(false); }
  };

  // Preview chart data
  const chartData = history.map((r, i) => ({
    name:     `#${i + 1}`,
    rpm:      Math.round(r.predicted_requests),
    servers:  r.recommended_servers,
    cost:     r.recommended_servers * 50,
  }));

  const totalPreds = history.length;
  const avgRpm     = history.length ? Math.round(history.reduce((s, r) => s + r.predicted_requests, 0) / history.length) : 0;
  const totalCost  = history.reduce((s, r) => s + r.recommended_servers * 50, 0);
  const scaleUpPct = history.length ? Math.round((history.filter(r => r.action === 'SCALE UP').length / history.length) * 100) : 0;

  return (
    <div className="animate-fade">
      {/* Header */}
      <div className="section-header">
        <div>
          <div className="page-title">Reports & Export</div>
          <div className="section-sub">Download prediction history as structured data files</div>
        </div>
        <span className="badge badge-green">✓ {totalPreds} records available</span>
      </div>

      {/* Export actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
        <ExportCard
          icon="📊" title="Export as CSV" format=".csv"
          desc={`Download all ${totalPreds} prediction records as a spreadsheet-compatible CSV file`}
          color="#22c55e" onExport={exportCsv} loading={csvLoading}
        />
        <ExportCard
          icon="📄" title="Export as PDF" format=".pdf"
          desc="Generate a formatted PDF report with prediction summary, top 50 records, and analytics overview"
          color="#2563eb" onExport={exportPdf} loading={pdfLoading}
        />
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Predictions', value: totalPreds.toLocaleString(), color: '#2563eb', icon: '📡' },
          { label: 'Avg Traffic',       value: `${avgRpm.toLocaleString()} rpm`, color: '#8b5cf6', icon: '📈' },
          { label: 'Total Est. Cost',   value: `$${totalCost.toLocaleString()}`, color: '#f59e0b', icon: '💰' },
          { label: 'Scale-Up Rate',     value: `${scaleUpPct}%`, color: '#ef4444', icon: '🚀' },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="kpi-card" style={{ '--color': color } as any}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '14px 14px 0 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>{label}</div>
              <span style={{ fontSize: 18 }}>{icon}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Preview charts */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="skeleton" style={{ height: 260 }} />
          <div className="skeleton" style={{ height: 260 }} />
        </div>
      ) : history.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <div className="empty-title">No data to preview</div>
          <div className="empty-sub">Run predictions to generate report data</div>
        </div>
      ) : (
        <div className="chart-grid">
          {/* RPM trend */}
          <div className="chart-card">
            <div className="chart-header">
              <div>
                <div className="chart-title">Report Preview — Traffic Trend</div>
                <div className="chart-sub">Predicted RPM across all records</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData.slice(-40)} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="rRpm" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} />
                <Area type="monotone" dataKey="rpm" name="RPM" stroke="#2563eb" strokeWidth={2.5} fill="url(#rRpm)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Cost trend */}
          <div className="chart-card">
            <div className="chart-header">
              <div>
                <div className="chart-title">Report Preview — Cost Trend</div>
                <div className="chart-sub">Estimated hourly cost per prediction</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData.slice(-30)} margin={{ top: 5, right: 5, bottom: 0, left: -10 }} barSize={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="cost" name="Cost $" fill="#22c55e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
