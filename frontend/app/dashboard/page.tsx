'use client';
// =============================================================================
// CloudMind AI – app/dashboard/page.tsx  (v4)
// Main landing dashboard — KPI cards + live charts + quick actions
// Auto-refreshes every 5 seconds
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, LineChart, Line,
} from 'recharts';
import { checkHealth, fetchPredictionHistory, fetchAlerts } from '@/lib/api';
import { useToast } from '@/lib/toast';

const REFRESH_INTERVAL = 5000;

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon, color = '#2563eb', trend, live = false }: {
  label: string; value: string | number; sub?: string;
  icon: string; color?: string; trend?: { val: number; label: string }; live?: boolean;
}) {
  return (
    <div className="kpi-card animate-fadeup" style={{ '--color': color } as React.CSSProperties}>
      {live && <div style={{ position: 'absolute', top: 10, right: 10, width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', animation: 'livePulse 2s ease infinite' }} />}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{label}</div>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1, marginBottom: 6, letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>}
      {trend && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: trend.val >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {trend.val >= 0 ? '▲' : '▼'} {Math.abs(trend.val)}%
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{trend.label}</span>
        </div>
      )}
    </div>
  );
}

// ── Quick Action card ─────────────────────────────────────────────────────────
function QuickAction({ href, icon, label, desc, color }: { href: string; icon: string; label: string; desc: string; color: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div className="card card-hover" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
        </div>
        <svg width="14" height="14" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </Link>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--chart-tooltip-bg)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#e2e8f0' }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: '#94a3b8' }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: 'inline-block' }} />
          <span style={{ color: '#94a3b8' }}>{p.name}:</span>
          <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════

export default function DashboardHome() {
  const { toast } = useToast();
  const [health,   setHealth]  = useState<any>(null);
  const [history,  setHistory] = useState<any[]>([]);
  const [alerts,   setAlerts]  = useState<any[]>([]);
  const [loading,  setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadData = useCallback(async () => {
    try {
      const [h, hist, al] = await Promise.all([
        checkHealth(),
        fetchPredictionHistory(30).catch(() => []),
        fetchAlerts(10).catch(() => []),
      ]);
      setHealth(h);
      setHistory((hist as any[]).reverse());
      setAlerts(al as any[]);
      setLastRefresh(new Date());
    } catch {
      /* silent fail on refresh */
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 5 s
  useEffect(() => {
    const id = setInterval(loadData, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [loadData]);

  // Chart data
  const chartData = history.map((r, i) => ({
    name      : `#${i + 1}`,
    predicted : Math.round(r.predicted_requests),
    load      : Math.round(r.load_per_server),
    servers   : r.recommended_servers,
  }));

  const latest      = history[history.length - 1];
  const totalPred   = health?.components?.database?.predictions ?? 0;
  const totalUsers  = health?.components?.database?.users ?? 0;
  const criticals   = alerts.filter((a: any) => a.severity === 'critical').length;
  const scaleUpCt   = history.filter((h: any) => h.action === 'SCALE UP').length;
  const scaleDownCt = history.filter((h: any) => h.action === 'SCALE DOWN').length;
  const keepCt      = history.length - scaleUpCt - scaleDownCt;
  const savedEst    = scaleDownCt * 50;
  const mlModelOk   = health?.components?.ml_model?.status === 'loaded';
  const dbOk        = health?.components?.database?.status === 'connected';

  return (
    <div className="animate-fade">
      {/* ── Page header ── */}
      <div className="section-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            Overview Dashboard
            <div className="live-badge"><span className="live-dot" />Live</div>
          </div>
          <div className="section-sub">
            Real-time cloud cost intelligence · Auto-refreshes every 5 s · Last update: {lastRefresh.toLocaleTimeString()}
          </div>
        </div>
        <Link href="/dashboard/predict" className="btn btn-primary btn-lg">⚡ Run Prediction</Link>
      </div>

      {/* ── KPI Cards ── */}
      {loading ? (
        <div className="kpi-grid stagger" style={{ marginBottom: 24 }}>
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}
        </div>
      ) : (
        <div className="kpi-grid stagger" style={{ marginBottom: 24 }}>
          <KpiCard icon="📡" label="Live Requests"      value={latest ? `${Math.round(latest.predicted_requests)} rpm` : '—'} sub="Most recent forecast" color="#2563eb" live />
          <KpiCard icon="🖥"  label="Active Servers"    value={latest?.recommended_servers ?? '—'} sub="Recommended fleet size" color="#8b5cf6" />
          <KpiCard icon="⚡" label="CPU Load"           value={latest ? `${Math.round(latest.load_per_server)} rpm/srv` : '—'} sub="Load per server" color="#f59e0b" />
          <KpiCard icon="📊" label="Total Predictions"  value={totalPred} sub="All-time predictions" color="#2563eb" trend={{ val: 12, label: 'vs last week' }} />
          <KpiCard icon="👥" label="Registered Users"   value={totalUsers} sub="Active accounts" color="#8b5cf6" />
          <KpiCard icon="⚠"  label="Critical Alerts"   value={criticals} sub={criticals === 0 ? 'All clear ✓' : 'Needs attention'} color={criticals > 0 ? '#ef4444' : '#22c55e'} />
          <KpiCard icon="💰" label="Est. Cost Saved"    value={`$${savedEst}`} sub="From scale-down decisions" color="#22c55e" trend={{ val: 8, label: 'this session' }} />
          <KpiCard icon="🤖" label="ML Model"           value={mlModelOk ? 'Online' : 'Offline'} sub={health?.components?.ml_model ? `${(health.components.ml_model.size_bytes / 1024 / 1024).toFixed(1)} MB` : '—'} color={mlModelOk ? '#22c55e' : '#ef4444'} />
        </div>
      )}

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 20 }}>

        {/* Traffic chart */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Traffic Forecast History</div>
              <div className="chart-sub">Predicted requests/min · last {chartData.length} predictions</div>
            </div>
            {chartData.length > 0 && <div className="live-badge"><span className="live-dot" />Live</div>}
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="gPred" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gLoad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Area type="monotone" dataKey="predicted" name="Predicted RPM" stroke="#2563eb" strokeWidth={2.5} fill="url(#gPred)" dot={false} activeDot={{ r: 5, fill: '#2563eb' }} />
                <Area type="monotone" dataKey="load"      name="Load/Server"   stroke="#22c55e" strokeWidth={2} fill="url(#gLoad)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <div className="empty-icon">📊</div>
              <div className="empty-title">No data yet</div>
              <div className="empty-sub">Run a prediction to see live chart data</div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Scaling distribution */}
          <div className="chart-card" style={{ flex: 1 }}>
            <div className="chart-title" style={{ marginBottom: 14 }}>Scaling Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Scale Up',   count: scaleUpCt,  color: '#2563eb' },
                { label: 'Scale Down', count: scaleDownCt, color: '#22c55e' },
                { label: 'Keep Same',  count: keepCt,      color: '#8b5cf6' },
              ].map(({ label, count, color }) => (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 5 }}>
                    <span>{label}</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{count}</span>
                  </div>
                  <div className="stat-bar">
                    <div className="stat-bar-fill" style={{ width: history.length > 0 ? `${(count / history.length) * 100}%` : '0%', background: color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System status */}
          <div className="chart-card">
            <div className="chart-title" style={{ marginBottom: 12 }}>System Status</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'API Server', ok: health?.status === 'healthy', detail: health?.status ?? '—' },
                { label: 'Database',   ok: dbOk,    detail: `${totalPred} records` },
                { label: 'ML Model',   ok: mlModelOk, detail: mlModelOk ? `${(health?.components?.ml_model?.size_bytes / 1024 / 1024).toFixed(1)} MB` : '—' },
              ].map(({ label, ok, detail }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: ok ? 'var(--success)' : 'var(--danger)', display: 'inline-block', boxShadow: ok ? '0 0 0 3px rgba(34,197,94,0.2)' : 'none' }} />
                    {label}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Servers trend chart ── */}
      {chartData.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 20 }}>
          <div className="chart-header">
            <div>
              <div className="chart-title">Server Fleet Recommendations</div>
              <div className="chart-sub">Recommended server count per prediction</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="servers" name="Servers" stroke="#8b5cf6" strokeWidth={2.5} dot={{ fill: '#8b5cf6', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Quick Actions ── */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Quick Actions</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <QuickAction href="/dashboard/monitoring" icon="📡" color="#22c55e" label="Live Monitoring"  desc="Real-time charts (auto-refresh 5s)" />
          <QuickAction href="/dashboard/predict"    icon="⚡" color="#2563eb" label="Run Prediction"   desc="ML-powered workload forecast" />
          <QuickAction href="/dashboard/analytics"  icon="📊" color="#8b5cf6" label="View Analytics"   desc="Charts, trends, and insights" />
          <QuickAction href="/dashboard/reports"    icon="📥" color="#22c55e" label="Export Reports"   desc="CSV or PDF download" />
        </div>
      </div>
    </div>
  );
}
