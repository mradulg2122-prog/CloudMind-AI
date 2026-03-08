'use client';

import { useEffect, useState } from 'react';

interface Props {
  backendAlive: boolean | null;
}

export default function TopStatusBar({ backendAlive }: Props) {
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }) +
          '  ·  ' +
          now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const statusColor =
    backendAlive === true ? '#4ade80' : backendAlive === false ? '#f87171' : '#94a3b8';
  const statusBg =
    backendAlive === true
      ? 'rgba(34,197,94,0.1)'
      : backendAlive === false
      ? 'rgba(239,68,68,0.1)'
      : 'rgba(100,116,139,0.08)';
  const statusBorder =
    backendAlive === true
      ? 'rgba(34,197,94,0.4)'
      : backendAlive === false
      ? 'rgba(239,68,68,0.4)'
      : 'rgba(100,116,139,0.2)';
  const statusLabel =
    backendAlive === true ? '● ONLINE' : backendAlive === false ? '● OFFLINE' : '● CHECKING…';

  return (
    <header
      style={{
        height: '64px',
        minHeight: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2rem',
        borderBottom: '1px solid rgba(30,41,59,0.9)',
        background: 'linear-gradient(90deg, rgba(10,15,30,0.98) 0%, rgba(15,23,42,0.97) 100%)',
        backdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        flexShrink: 0,
      }}
    >
      {/* Left – Branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            boxShadow: '0 0 12px rgba(59,130,246,0.4)',
          }}
        >
          ☁
        </div>
        <div>
          <div
            className="gradient-text"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: '1rem',
              lineHeight: 1.1,
              letterSpacing: '-0.3px',
            }}
          >
            CloudMind AI
          </div>
          <div style={{ color: '#475569', fontSize: '0.65rem', letterSpacing: '0.4px' }}>
            Autonomous Cloud Cost Intelligence
          </div>
        </div>
      </div>

      {/* Center – status dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <span className="status-dot" />
        <span style={{ color: '#475569', fontSize: '0.72rem', fontFamily: "'Space Mono', monospace" }}>
          Real-time Workload Forecasting
        </span>
      </div>

      {/* Right – API status + clock + env badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div
          style={{
            fontSize: '0.7rem',
            fontFamily: "'Space Mono', monospace",
            padding: '0.3rem 0.85rem',
            borderRadius: '999px',
            background: statusBg,
            border: `1px solid ${statusBorder}`,
            color: statusColor,
            letterSpacing: '0.4px',
          }}
        >
          API {statusLabel}
        </div>

        <div
          style={{
            fontSize: '0.7rem',
            fontFamily: "'Space Mono', monospace",
            color: '#64748b',
          }}
        >
          {clock}
        </div>

        <div
          style={{
            fontSize: '0.65rem',
            fontFamily: "'Space Mono', monospace",
            padding: '0.25rem 0.65rem',
            borderRadius: '6px',
            background: 'rgba(139,92,246,0.12)',
            border: '1px solid rgba(139,92,246,0.3)',
            color: '#a78bfa',
            letterSpacing: '1px',
            fontWeight: 700,
          }}
        >
          LOCAL
        </div>
      </div>
    </header>
  );
}
