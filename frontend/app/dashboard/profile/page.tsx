'use client';
// =============================================================================
// CloudMind AI – app/dashboard/profile/page.tsx (v4)
// User profile page with account info, activity stats, and quick actions
// =============================================================================

import { useState, useEffect } from 'react';
import { getMe, fetchPredictionHistory } from '@/lib/api';
import { useToast } from '@/lib/toast';

export default function ProfilePage() {
  const { toast } = useToast();
  const [user,    setUser]    = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getMe(),
      fetchPredictionHistory(500).catch(() => []),
    ]).then(([u, h]) => {
      setUser(u);
      setHistory(h as any[]);
    }).catch(() => toast('Failed to load profile', 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, flexDirection: 'column', gap: 16 }}>
      <div className="spinner spinner-lg" />
      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading profile…</div>
    </div>
  );

  const initials   = user?.username ? user.username.slice(0, 2).toUpperCase() : 'CM';
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '—';
  const scaleUpCt   = history.filter(r => r.action === 'SCALE UP').length;
  const scaleDownCt = history.filter(r => r.action === 'SCALE DOWN').length;
  const keepCt      = history.filter(r => r.action === 'KEEP SAME').length;
  const savedEst    = scaleDownCt * 50;
  const avgRpm      = history.length ? Math.round(history.reduce((s, r) => s + r.predicted_requests, 0) / history.length) : 0;

  return (
    <div className="animate-fade">
      {/* Header */}
      <div className="section-header">
        <div>
          <div className="page-title">My Profile</div>
          <div className="section-sub">Account details, usage statistics, and session information</div>
        </div>
        <span className={`status-pill ${user?.is_active ? 'healthy' : 'error'}`}>
          <span className="dot" />
          {user?.is_active ? 'Active Account' : 'Inactive'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── Left: User card ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Avatar card */}
          <div className="card card-p" style={{ textAlign: 'center' }}>
            {/* Avatar */}
            <div style={{
              width: 88, height: 88, borderRadius: '50%', margin: '0 auto 16px',
              background: 'linear-gradient(135deg, #2563eb 0%, #8b5cf6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, fontWeight: 900, color: '#fff',
              boxShadow: '0 4px 20px rgba(37,99,235,0.35)',
            }}>{initials}</div>

            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>{user?.username}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{user?.email}</div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
              <span className="badge badge-blue">Cloud Engineer</span>
              <span className={`badge badge-${user?.is_active ? 'green' : 'red'}`}>{user?.is_active ? '✓ Active' : 'Inactive'}</span>
            </div>

            <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />

            {/* Info rows */}
            {[
              { label: 'Account ID',    value: `#CM-${String(user?.id ?? 0).padStart(5, '0')}` },
              { label: 'Member Since',  value: memberSince },
              { label: 'Timezone',      value: 'UTC +05:30' },
              { label: 'Role',          value: 'Administrator' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', paddingBlock: 8, borderBottom: '1px solid var(--surface-3)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontFamily: label === 'Account ID' ? 'monospace' : 'inherit' }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Quick links */}
          <div className="card card-p">
            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)', marginBottom: 14 }}>Quick Links</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { href: '/dashboard',            label: '📊 Dashboard Overview' },
                { href: '/dashboard/predict',    label: '⚡ Run Prediction' },
                { href: '/dashboard/history',    label: '🕐 View History' },
                { href: '/dashboard/settings',   label: '⚙️ Settings' },
              ].map(({ href, label }) => (
                <a key={href} href={href} style={{
                  display: 'block', padding: '9px 12px', borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-3)', color: 'var(--text-primary)',
                  textDecoration: 'none', fontSize: 13, fontWeight: 600,
                  transition: 'all 0.15s ease',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--primary-muted)'; (e.currentTarget as HTMLElement).style.color = 'var(--primary)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Stats ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Usage stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {[
              { label: 'Total Predictions', value: history.length.toLocaleString(), icon: '📡', color: '#2563eb' },
              { label: 'Avg Traffic',       value: `${avgRpm.toLocaleString()} rpm`, icon: '📈', color: '#8b5cf6' },
              { label: 'Est. Cost Saved',   value: `$${savedEst}`,                  icon: '💰', color: '#22c55e' },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className="kpi-card animate-fadeup" style={{ '--color': color } as any}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '14px 14px 0 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{label}</div>
                  <span style={{ fontSize: 20 }}>{icon}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color, letterSpacing: '-0.02em' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Scaling breakdown */}
          <div className="card card-p">
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 18 }}>Scaling Action Breakdown</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Scale Up',   count: scaleUpCt,   color: '#2563eb', icon: '🚀' },
                { label: 'Scale Down', count: scaleDownCt, color: '#22c55e', icon: '📉' },
                { label: 'Keep Same',  count: keepCt,      color: '#8b5cf6', icon: '✅' },
              ].map(({ label, count, color, icon }) => {
                const pct = history.length > 0 ? Math.round((count / history.length) * 100) : 0;
                return (
                  <div key={label}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
                        <span>{icon}</span> {label}
                      </span>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, color }}>{count}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 34, textAlign: 'right' }}>{pct}%</span>
                      </div>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Account security info */}
          <div className="card card-p">
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 14 }}>Security & Access</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: '🔐 Password',        status: 'Bcrypt hashed',              ok: true },
                { label: '🔑 Authentication',   status: 'JWT Bearer Token (HS256)',    ok: true },
                { label: '⏱ Session',           status: 'Active · 60 min. expiry',    ok: true },
                { label: '🛡 Rate Limiting',    status: '100 req/min (enforced)',      ok: true },
                { label: '📡 CORS Policy',      status: 'Restricted to localhost',    ok: true },
              ].map(({ label, status, ok }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--surface-3)', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{status}</span>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: ok ? 'var(--success)' : 'var(--danger)', display: 'inline-block' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
