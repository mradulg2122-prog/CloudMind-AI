'use client';
// =============================================================================
// CloudMind AI – app/dashboard/layout.tsx  (v4 — Datadog/Grafana style)
// Persistent sidebar + fixed header shell for all dashboard pages.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { checkHealth } from '@/lib/api';

// ── SVG Icon components ───────────────────────────────────────────────────────
const Icons = {
  Dashboard:   () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  Monitoring:  () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  Predict:     () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Analytics:   () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6"  y1="20" x2="6"  y2="14"/></svg>,
  History:     () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Reports:     () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  Alerts:      () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Settings:    () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Profile:     () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Logout:      () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Bell:        () => <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Cloud:       () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>,
  ChevronRight:() => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>,
};

// ── Nav items ─────────────────────────────────────────────────────────────────
const NAV_MAIN = [
  { href: '/dashboard',            Icon: Icons.Dashboard,  label: 'Dashboard'       },
  { href: '/dashboard/monitoring', Icon: Icons.Monitoring, label: 'Live Monitoring', badge: 'LIVE' },
  { href: '/dashboard/predict',    Icon: Icons.Predict,    label: 'Predictions',     badge: 'ML'  },
  { href: '/dashboard/analytics',  Icon: Icons.Analytics,  label: 'Analytics'        },
  { href: '/dashboard/history',    Icon: Icons.History,    label: 'History'          },
  { href: '/dashboard/reports',    Icon: Icons.Reports,    label: 'Reports'          },
  { href: '/dashboard/alerts',     Icon: Icons.Alerts,     label: 'Alerts'           },
];
const NAV_BOTTOM = [
  { href: '/dashboard/settings',   Icon: Icons.Settings, label: 'Settings' },
  { href: '/dashboard/profile',    Icon: Icons.Profile,  label: 'Profile'  },
];

// ── Live Clock component ──────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
      setDate(now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{time}</span>
      <span style={{ color: 'var(--border-strong)' }}>·</span>
      <span>{date}</span>
    </div>
  );
}

// ── Page label lookup ─────────────────────────────────────────────────────────
const ALL_NAV = [...NAV_MAIN, ...NAV_BOTTOM];

function getPageLabel(pathname: string): string {
  const exact = ALL_NAV.find(n => n.href === pathname);
  if (exact) return exact.label;
  const prefix = ALL_NAV.filter(n => n.href !== '/dashboard').find(n => pathname.startsWith(n.href));
  return prefix?.label ?? 'Dashboard';
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [loading, user, router]);

  // Health poll every 30 s
  useEffect(() => {
    const check = () => checkHealth().then(() => setApiOk(true)).catch(() => setApiOk(false));
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', flexDirection: 'column', gap: 16 }}>
      <div className="spinner spinner-lg" />
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading CloudMind AI…</div>
    </div>
  );

  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : 'CM';
  const pageLabel = getPageLabel(pathname);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ╔════════════════════════════════════════════════════╗
          ║                LEFT SIDEBAR                        ║
          ╚════════════════════════════════════════════════════╝ */}
      <aside className="sidebar-desktop" style={{
        width: 'var(--sidebar-w)', flexShrink: 0,
        background: 'var(--sidebar-bg)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
        borderRight: '1px solid var(--sidebar-border)',
      }}>

        {/* Logo */}
        <div style={{ padding: '18px 18px 16px', borderBottom: '1px solid var(--sidebar-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #0078D4, #00BCF2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, color: '#fff',
              boxShadow: '0 0 20px rgba(0,120,212,0.6), 0 2px 8px rgba(0,0,0,0.5)',
              fontSize: '1.1rem',
            }}>
              ☁
            </div>
            <div>
              <div style={{
                fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em', lineHeight: 1.2,
                background: 'linear-gradient(135deg, #5BA7E0 0%, #00BCF2 50%, #F7B731 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>CloudMind AI</div>
              <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', marginTop: 1, textTransform: 'uppercase' }}>Cloud Intelligence</div>
            </div>
          </div>
        </div>

        {/* API Status pill */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--sidebar-border)' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '5px 10px', borderRadius: 'var(--radius-full)',
            background: apiOk === true ? 'rgba(34,197,94,0.1)' : apiOk === false ? 'rgba(239,68,68,0.1)' : 'rgba(148,163,184,0.1)',
            border: `1px solid ${apiOk === true ? 'rgba(34,197,94,0.25)' : apiOk === false ? 'rgba(239,68,68,0.25)' : 'rgba(148,163,184,0.15)'}`,
            fontSize: 11, fontWeight: 600,
            color: apiOk === true ? '#22c55e' : apiOk === false ? '#ef4444' : '#8b9ab8',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: apiOk === true ? '#22c55e' : apiOk === false ? '#ef4444' : '#8b9ab8',
              animation: apiOk === true ? 'livePulse 2s ease infinite' : 'none',
              display: 'inline-block',
            }} />
            {apiOk === true ? 'System Healthy' : apiOk === false ? 'API Offline' : 'Checking…'}
          </div>
        </div>

        {/* Section label */}
        <div style={{ padding: '14px 16px 6px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Navigation
        </div>

        {/* Main nav */}
        <nav style={{ flex: 1, padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {NAV_MAIN.map(({ href, Icon, label, badge }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link key={href} href={href} className={`nav-item ${active ? 'active' : ''}`}>
                <Icon />
                <span style={{ flex: 1 }}>{label}</span>
                {badge && (
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                    background: badge === 'LIVE' ? 'rgba(34,197,94,0.2)' : 'rgba(37,99,235,0.25)',
                    color: badge === 'LIVE' ? '#22c55e' : '#60a5fa',
                    letterSpacing: '0.06em',
                  }}>{badge}</span>
                )}
              </Link>
            );
          })}

          {/* Separator */}
          <div style={{ height: 1, background: 'var(--sidebar-border)', margin: '8px 4px' }} />

          {NAV_BOTTOM.map(({ href, Icon, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={`nav-item ${active ? 'active' : ''}`}>
                <Icon />
                <span>{label}</span>
              </Link>
            );
          })}

          <button
            onClick={logout}
            className="nav-item"
            style={{ background: 'none', border: 'none', color: '#ef4444', width: '100%', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <Icons.Logout />
            <span>Logout</span>
          </button>
        </nav>

        {/* User card */}
        <div style={{
          padding: '12px 14px', borderTop: '1px solid var(--sidebar-border)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #0078D4, #00BCF2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800, color: '#fff',
          }}>{initials}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.username ?? 'User'}
            </div>
            <div style={{ color: 'var(--sidebar-text)', fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email ?? 'cloud engineer'}
            </div>
          </div>
          <Link href="/dashboard/profile" style={{ color: 'var(--sidebar-text)', opacity: 0.6, textDecoration: 'none' }}>
            <Icons.ChevronRight />
          </Link>
        </div>
      </aside>

      {/* ╔════════════════════════════════════════════════════╗
          ║           RIGHT SIDE — Header + Content            ║
          ╚════════════════════════════════════════════════════╝ */}
      <div style={{ flex: 1, marginLeft: 'var(--sidebar-w)', display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* ── FIXED HEADER ─────────────────────────────────── */}
        <header style={{
          height: 'var(--header-h)', flexShrink: 0,
          background: 'var(--header-bg)',
          borderBottom: '1px solid var(--header-border)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px', zIndex: 50,
          boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
        }}>

          {/* Left — breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                CloudMind AI
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {pageLabel}
              </div>
            </div>
          </div>

          {/* Right — controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <LiveClock />

            <div style={{ width: 1, height: 28, background: 'var(--border)' }} />

            {/* Notification bell */}
            <button
              className="btn btn-ghost btn-icon"
              style={{ position: 'relative', border: '1px solid var(--border)', background: 'var(--surface)' }}
            >
              <Icons.Bell />
            </button>

            {/* User pill */}
            <Link href="/dashboard/profile" style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '5px 12px 5px 6px', borderRadius: 'var(--radius-full)',
                background: 'var(--surface)', border: '1px solid var(--border)',
                cursor: 'pointer', transition: 'all var(--transition)',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0078D4, #00BCF2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: '#fff',
                }}>{initials}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{user?.username ?? 'User'}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Cloud Engineer</div>
                </div>
                <Icons.ChevronRight />
              </div>
            </Link>
          </div>
        </header>

        {/* ── PAGE CONTENT ─────────────────────────────────── */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
