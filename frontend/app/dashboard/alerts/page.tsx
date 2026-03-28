'use client';
// =============================================================================
// CloudMind AI – app/dashboard/alerts/page.tsx (v4)
// Enhanced alerts page with severity colors, timestamp, status columns
// =============================================================================

import { useState, useEffect, useMemo } from 'react';
import { fetchAlerts } from '@/lib/api';
import { useToast } from '@/lib/toast';

const SMAP = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', icon: '🔴', label: 'Critical' },
  warning:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', icon: '🟡', label: 'Warning'  },
  info:     { color: '#06b6d4', bg: 'rgba(6,182,212,0.08)',  border: 'rgba(6,182,212,0.2)',  icon: '🔵', label: 'Info'     },
};

export default function AlertsPage() {
  const { toast } = useToast();
  const [alerts,  setAlerts]  = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<'ALL' | 'critical' | 'warning' | 'info'>('ALL');
  const [view,    setView]    = useState<'cards' | 'table'>('cards');

  useEffect(() => {
    fetchAlerts(100)
      .then(d => setAlerts(d as any[]))
      .catch(() => toast('Failed to load alerts', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() =>
    filter === 'ALL' ? alerts : alerts.filter(a => a.severity === filter),
  [alerts, filter]);

  const counts = {
    ALL:      alerts.length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning:  alerts.filter(a => a.severity === 'warning').length,
    info:     alerts.filter(a => a.severity === 'info').length,
  };

  const fmtDate = (s: string) => {
    try {
      return new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return s; }
  };

  return (
    <div className="animate-fade">
      {/* Header */}
      <div className="section-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            System Alerts
            {counts.critical > 0 && (
              <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'var(--danger-muted)', color: 'var(--danger)' }}>
                {counts.critical} critical
              </span>
            )}
          </div>
          <div className="section-sub">{alerts.length} total alerts · {filtered.length} shown</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn btn-sm ${view === 'cards' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('cards')}>⊞ Cards</button>
          <button className={`btn btn-sm ${view === 'table' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('table')}>☰ Table</button>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 20 }}>
        {(['critical', 'warning', 'info'] as const).map(sev => {
          const s = SMAP[sev];
          return (
            <div key={sev} className="card card-p" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: s.color, marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{counts[sev]}</div>
            </div>
          );
        })}
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {(['ALL', 'critical', 'warning', 'info'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={filter === f ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
          >
            {f === 'ALL' ? '⊘ All' : `${SMAP[f].icon} ${SMAP[f].label}`}
            <span style={{ opacity: 0.7, marginLeft: 4 }}>({counts[f]})</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 70 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🟢</div>
          <div className="empty-title">All clear!</div>
          <div className="empty-sub">No {filter === 'ALL' ? '' : filter} alerts at this time. Your system is operating normally.</div>
        </div>
      ) : view === 'cards' ? (
        /* Card view */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((a: any, i) => {
            const s = SMAP[a.severity as keyof typeof SMAP] ?? SMAP.info;
            return (
              <div key={a.id ?? i} className="card animate-fadeup" style={{
                padding: '14px 18px', borderLeft: `4px solid ${s.color}`,
                display: 'flex', alignItems: 'flex-start', gap: 16,
                animationDelay: `${i * 30}ms`,
              }}>
                <div style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{s.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>{a.source ?? 'system'}</span>
                    <span className={`badge badge-${a.severity === 'critical' ? 'red' : a.severity === 'warning' ? 'yellow' : 'info'}`}>{s.label}</span>
                    {!a.dismissed && <span className="badge badge-blue">Active</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{a.message}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'monospace' }}>
                  {fmtDate(a.created_at)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table view */
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Alert Type</th>
                  <th>Source</th>
                  <th>Message</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a: any, i) => {
                  const s = SMAP[a.severity as keyof typeof SMAP] ?? SMAP.info;
                  return (
                    <tr key={a.id ?? i}>
                      <td><span style={{ fontSize: 18 }}>{s.icon}</span></td>
                      <td><span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: 12 }}>{a.source ?? 'system'}</span></td>
                      <td style={{ maxWidth: 320 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{a.message}</span>
                      </td>
                      <td>
                        <span className={`badge badge-${a.severity === 'critical' ? 'red' : a.severity === 'warning' ? 'yellow' : 'info'}`}>{s.label}</span>
                      </td>
                      <td>
                        <span className={`badge badge-${a.dismissed ? 'gray' : 'blue'}`}>{a.dismissed ? 'Dismissed' : 'Active'}</span>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {fmtDate(a.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
