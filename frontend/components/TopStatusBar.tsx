'use client';
import { useEffect, useState } from 'react';
import UserMenu from '@/components/UserMenu';
import { UserOut } from '@/lib/api';

interface Props { backendAlive: boolean | null; user: UserOut | null; authLoading: boolean; onLogout: () => void; }

const NAV = ['Dashboard', 'Analytics', 'Reports', 'Settings'];

export default function TopStatusBar({ backendAlive, user, authLoading, onLogout }: Props) {
  const [clock, setClock] = useState('');
  const [active, setActive] = useState('Dashboard');

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setClock(
        n.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) +
        '  ·  ' +
        n.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      );
    };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);

  const on = backendAlive === true, off = backendAlive === false;

  return (
    <header style={{
      height: '64px', minHeight: '64px',
      display: 'flex', alignItems: 'center',
      padding: '0 20px',
      background: 'rgba(4,13,33,0.98)',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      backdropFilter: 'blur(24px)',
      position: 'sticky', top: 0, zIndex: 100, flexShrink: 0,
      boxShadow: '0 1px 0 rgba(0,120,212,0.1), 0 4px 24px rgba(0,0,0,0.5)',
      gap: '0',
    }}>

      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginRight: '32px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
          background: 'linear-gradient(135deg, #0078D4 0%, #00BCF2 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.1rem',
          boxShadow: '0 0 20px rgba(0,120,212,0.6), 0 2px 8px rgba(0,0,0,0.5)',
        }}>☁</div>
        <div>
          <div style={{
            fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '0.9rem',
            background: 'linear-gradient(135deg, #5BA7E0 0%, #00BCF2 50%, #F7B731 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            lineHeight: 1.2,
          }}>CloudMind AI</div>
          <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.3px' }}>Cloud Cost Intelligence</div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.06)', marginRight: '24px', flexShrink: 0 }} />

      {/* Nav tabs */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '2px', marginRight: 'auto' }}>
        {NAV.map(tab => (
          <button key={tab} onClick={() => setActive(tab)} style={{
            background: active === tab ? 'rgba(0,120,212,0.15)' : 'transparent',
            border: active === tab ? '1px solid rgba(0,120,212,0.25)' : '1px solid transparent',
            borderRadius: '8px', padding: '6px 14px',
            fontSize: '12px', fontWeight: active === tab ? 600 : 400,
            color: active === tab ? '#5BA7E0' : 'rgba(255,255,255,0.35)',
            cursor: 'pointer', transition: 'all 0.18s',
            fontFamily: "'Inter', sans-serif",
          }}
            onMouseEnter={e => { if (active !== tab)(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.65)'; }}
            onMouseLeave={e => { if (active !== tab)(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.35)'; }}
          >{tab}</button>
        ))}
      </nav>

      {/* Right cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00B050', boxShadow: '0 0 8px #00B050', animation: 'livePulse 2s ease infinite' }} />
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontFamily: "'JetBrains Mono', monospace" }}>Forecasting Active</span>
        </div>

        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.06)' }} />

        {/* Clock */}
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.3px' }}>{clock}</span>

        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.06)' }} />

        {/* Savings badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '5px 12px', borderRadius: '999px',
          background: 'rgba(247,183,49,0.08)',
          border: '1px solid rgba(247,183,49,0.2)',
          fontSize: '11px', fontWeight: 700, color: '#F7B731',
        }}>💰 Saved $12.8K this month</div>

        {/* API status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '5px 12px', borderRadius: '999px',
          background: on ? 'rgba(0,176,80,0.08)' : off ? 'rgba(229,62,62,0.08)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${on ? 'rgba(0,176,80,0.25)' : off ? 'rgba(229,62,62,0.25)' : 'rgba(255,255,255,0.08)'}`,
          fontSize: '11px', fontWeight: 600,
          color: on ? '#00B050' : off ? '#FF4D4F' : 'rgba(255,255,255,0.3)',
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: on ? '#00B050' : off ? '#FF4D4F' : 'rgba(255,255,255,0.3)', animation: on ? 'livePulse 2s ease infinite' : 'none' }} />
          API {on ? 'Online' : off ? 'Offline' : 'Checking…'}
        </div>

        {/* ENV badge */}
        <div style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(0,120,212,0.1)', border: '1px solid rgba(0,120,212,0.2)', fontSize: '10px', fontWeight: 700, color: 'rgba(0,188,242,0.8)', letterSpacing: '1px', fontFamily: "'JetBrains Mono', monospace" }}>DEV</div>

        <UserMenu user={user} loading={authLoading} onLogout={onLogout} />
      </div>
    </header>
  );
}
