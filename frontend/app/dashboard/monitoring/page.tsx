'use client';
// =============================================================================
// CloudMind AI – app/dashboard/monitoring/page.tsx
// Real-time monitoring dashboard — all charts auto-refresh every 5 seconds
// Uses rolling-window simulation to give live-feel behavior
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { fetchPredictionHistory, checkHealth } from '@/lib/api';
import { useToast } from '@/lib/toast';

const REFRESH_MS = 5000;
const MAX_POINTS = 20;

// ── Tooltip ───────────────────────────────────────────────────────────────────
const DarkTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1e2a3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#e2e8f0' }}>
      <div style={{ fontWeight: 700, marginBottom: 5, color: '#64748b' }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: 'inline-block' }} />
          <span style={{ color: '#94a3b8' }}>{p.name}:</span>
          <span style={{ fontWeight: 700, marginLeft: 'auto' }}>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ── Metric Card Header ────────────────────────────────────────────────────────
function MetricHeader({ label, value, unit, color, delta }: {
  label: string; value: number | string; unit?: string; color: string; delta?: number;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 4 }}>
            {value}<span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 3 }}>{unit}</span>
          </div>
        </div>
        {delta !== undefined && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 'var(--radius-full)',
            background: delta >= 0 ? 'var(--danger-muted)' : 'var(--success-muted)',
            color: delta >= 0 ? 'var(--danger)' : 'var(--success)',
          }}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
          </span>
        )}
      </div>
      <div style={{ height: 3, borderRadius: 10, background: `${color}20`, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 10, background: color, width: typeof value === 'number' ? `${Math.min(100, (value / 2000) * 100)}%` : '50%', transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

// ── Chart Card wrapper ────────────────────────────────────────────────────────
function ChartPanel({ title, sub, children, live = true, fullSpan = false }: {
  title: string; sub?: string; children: React.ReactNode; live?: boolean; fullSpan?: boolean;
}) {
  return (
    <div className="chart-card metric-card-live" style={fullSpan ? { gridColumn: '1 / -1' } : {}}>
      <div className="chart-header">
        <div>
          <div className="chart-title">{title}</div>
          {sub && <div className="chart-sub">{sub}</div>}
        </div>
        {live && <div className="live-badge"><span className="live-dot" />Live · 5s</div>}
      </div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function MonitoringPage() {
  const { toast } = useToast();
  const [rollingData, setRollingData] = useState<any[]>([]);
  const [latest, setLatest] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);

  // Build time label
  const timeLabel = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
  };

  const load = useCallback(async () => {
    try {
      const [hist, h] = await Promise.all([
        fetchPredictionHistory(1).catch(() => []),
        checkHealth().catch(() => null),
      ]);
      setHealth(h);
      const rec = (hist as any[])[0];
      if (rec) {
        setLatest(rec);
        tickRef.current += 1;
        setTick(t => t + 1);
        setRollingData(prev => {
          // Add a new point with slight jitter for live-like feel
          const jitter = (Math.random() - 0.5) * 30;
          const newPoint = {
            time: timeLabel(),
            rpm:     Math.max(0, Math.round(rec.predicted_requests + jitter)),
            load:    Math.max(0, Math.round(rec.load_per_server + jitter * 0.2)),
            servers: rec.recommended_servers,
            cpu:     Math.min(100, Math.max(10, (rec.load_per_server / rec.recommended_servers) * 0.1 + Math.random() * 20 + 40)),
            mem:     Math.min(100, Math.max(20, 55 + Math.random() * 25)),
          };
          const next = [...prev, newPoint];
          return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
        });
      }
    } catch {/* silent */}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const latestPoint = rollingData[rollingData.length - 1];
  const prevPoint   = rollingData[rollingData.length - 2];
  const rpmDelta    = latestPoint && prevPoint ? ((latestPoint.rpm - prevPoint.rpm) / Math.max(1, prevPoint.rpm)) * 100 : 0;

  const chartProps = {
    CartesianGrid: { strokeDasharray: '3 3', stroke: 'var(--chart-grid)' },
    XAxis:         { tick: { fontSize: 10, fill: '#94a3b8' }, axisLine: false, tickLine: false },
    YAxis:         { tick: { fontSize: 10, fill: '#94a3b8' }, axisLine: false, tickLine: false },
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, flexDirection: 'column', gap: 16 }}>
      <div className="spinner spinner-lg" />
      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Initializing live monitoring…</div>
    </div>
  );

  return (
    <div className="animate-fade">
      {/* ── Header ── */}
      <div className="section-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            Live Monitoring
            <div className="live-badge"><span className="live-dot" />Streaming</div>
          </div>
          <div className="section-sub">All panels refresh automatically every 5 seconds · {rollingData.length} data points collected</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Refresh #{tick}</div>
          <div className={`status-pill ${health?.status === 'healthy' ? 'healthy' : 'error'}`}>
            <span className="dot" />
            {health?.status === 'healthy' ? 'Healthy' : 'Degraded'}
          </div>
        </div>
      </div>

      {/* ── Top metric cards ── */}
      <div className="kpi-grid stagger" style={{ marginBottom: 24 }}>
        {[
          { label: 'Live RPM',       value: latestPoint?.rpm ?? '—',                  unit: 'req/min', color: '#2563eb', icon: '📡' },
          { label: 'Load/Server',    value: latestPoint ? Math.round(latestPoint.load) : '—', unit: 'rpm',     color: '#f59e0b', icon: '⚡' },
          { label: 'Fleet Size',     value: latestPoint?.servers ?? '—',              unit: 'servers', color: '#8b5cf6', icon: '🖥' },
          { label: 'CPU (est.)',     value: latestPoint ? `${latestPoint.cpu.toFixed(1)}` : '—', unit: '%', color: '#ef4444', icon: '🔥' },
          { label: 'Memory (est.)', value: latestPoint ? `${latestPoint.mem.toFixed(1)}` : '—', unit: '%', color: '#06b6d4', icon: '💾' },
          { label: 'Est. Hourly',    value: latestPoint ? `$${(latestPoint.servers * 50).toFixed(0)}` : '—', unit: '/hr', color: '#22c55e', icon: '💰' },
        ].map(({ label, value, unit, color, icon }) => (
          <div key={label} className="kpi-card animate-fadeup" style={{ '--color': color } as any}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>{label}</div>
              <span style={{ fontSize: 18 }}>{icon}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {value}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 3 }}>{unit}</span>
            </div>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '14px 14px 0 0', background: color }} />
            <div style={{ position: 'absolute', top: 10, right: 10, width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'livePulse 2s ease infinite' }} />
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      {rollingData.length < 2 ? (
        <div className="empty-state">
          <div className="empty-icon">📡</div>
          <div className="empty-title">Collecting live data…</div>
          <div className="empty-sub">Run predictions to populate monitoring charts. Charts auto-populate as data arrives.</div>
        </div>
      ) : (
        <div className="chart-grid">

          {/* Requests Trend */}
          <ChartPanel title="Requests Trend" sub="Live predicted requests per minute" fullSpan>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={rollingData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="mRpm" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...chartProps.CartesianGrid} />
                <XAxis dataKey="time" {...chartProps.XAxis} />
                <YAxis {...chartProps.YAxis} />
                <Tooltip content={<DarkTooltip />} />
                <ReferenceLine y={300} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Overload', fill: '#ef4444', fontSize: 10 }} />
                <ReferenceLine y={120} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Low', fill: '#f59e0b', fontSize: 10 }} />
                <Area type="monotone" dataKey="rpm" name="RPM" stroke="#2563eb" strokeWidth={2.5} fill="url(#mRpm)" dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartPanel>

          {/* CPU trend */}
          <ChartPanel title="CPU Utilization" sub="Estimated CPU % over time">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={rollingData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                <CartesianGrid {...chartProps.CartesianGrid} />
                <XAxis dataKey="time" {...chartProps.XAxis} />
                <YAxis {...chartProps.YAxis} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <Tooltip content={<DarkTooltip />} />
                <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="cpu" name="CPU %" stroke="#ef4444" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>

          {/* Memory trend */}
          <ChartPanel title="Memory Utilization" sub="Estimated memory % over time">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={rollingData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="mMem" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...chartProps.CartesianGrid} />
                <XAxis dataKey="time" {...chartProps.XAxis} />
                <YAxis {...chartProps.YAxis} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <Tooltip content={<DarkTooltip />} />
                <Area type="monotone" dataKey="mem" name="Mem %" stroke="#06b6d4" strokeWidth={2.5} fill="url(#mMem)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartPanel>

          {/* Server count */}
          <ChartPanel title="Server Fleet Size" sub="Recommended server count trend">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={rollingData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }} barSize={10}>
                <CartesianGrid {...chartProps.CartesianGrid} />
                <XAxis dataKey="time" {...chartProps.XAxis} />
                <YAxis {...chartProps.YAxis} allowDecimals={false} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="servers" name="Servers" fill="#8b5cf6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>

          {/* Load/server */}
          <ChartPanel title="Load per Server" sub="Request distribution across fleet" fullSpan>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={rollingData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="mLoad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...chartProps.CartesianGrid} />
                <XAxis dataKey="time" {...chartProps.XAxis} />
                <YAxis {...chartProps.YAxis} />
                <Tooltip content={<DarkTooltip />} />
                <ReferenceLine y={300} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Overload threshold', fill: '#ef4444', fontSize: 10 }} />
                <ReferenceLine y={120} stroke="#22c55e" strokeDasharray="4 4" label={{ value: 'Scale-down threshold', fill: '#22c55e', fontSize: 10 }} />
                <Area type="monotone" dataKey="load" name="Load/srv" stroke="#f59e0b" strokeWidth={2.5} fill="url(#mLoad)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartPanel>
        </div>
      )}
    </div>
  );
}
