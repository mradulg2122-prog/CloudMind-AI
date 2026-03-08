'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Alert, AlertSeverity } from '@/hooks/useAlerts';

interface Props {
  alerts: Alert[];
  onDismiss: (id: string) => void;
}

const severityConfig: Record<
  AlertSeverity,
  { bg: string; border: string; color: string; icon: string; labelBg: string }
> = {
  CRITICAL: {
    bg: 'rgba(239,68,68,0.07)',
    border: 'rgba(239,68,68,0.45)',
    color: '#fca5a5',
    icon: '🚨',
    labelBg: 'rgba(239,68,68,0.2)',
  },
  WARNING: {
    bg: 'rgba(245,158,11,0.07)',
    border: 'rgba(245,158,11,0.45)',
    color: '#fcd34d',
    icon: '⚠️',
    labelBg: 'rgba(245,158,11,0.2)',
  },
  INFO: {
    bg: 'rgba(59,130,246,0.07)',
    border: 'rgba(59,130,246,0.45)',
    color: '#93c5fd',
    icon: 'ℹ️',
    labelBg: 'rgba(59,130,246,0.2)',
  },
};

const AUTO_DISMISS_MS = 8000;

function AlertItem({ alert, onDismiss }: { alert: Alert; onDismiss: () => void }) {
  const cfg = severityConfig[alert.severity];

  useEffect(() => {
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: '12px',
        padding: '0.9rem 1.1rem',
        backdropFilter: 'blur(12px)',
        boxShadow: `0 4px 24px ${cfg.border}`,
        cursor: 'pointer',
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
      onClick={onDismiss}
    >
      {/* Shimmer bar at top */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)`,
          animation: 'shimmer 2s infinite',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
        <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: '1px' }}>{cfg.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
            <span
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '0.82rem',
                color: cfg.color,
              }}
            >
              {alert.title}
            </span>
            <span
              style={{
                fontSize: '0.6rem',
                fontWeight: 700,
                letterSpacing: '0.8px',
                fontFamily: "'Space Mono', monospace",
                padding: '0.1rem 0.4rem',
                borderRadius: '4px',
                background: cfg.labelBg,
                color: cfg.color,
              }}
            >
              {alert.severity}
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
            {alert.message}
          </p>
          <div
            style={{
              marginTop: '0.4rem',
              fontSize: '0.65rem',
              color: '#475569',
              fontFamily: "'Space Mono', monospace",
            }}
          >
            {alert.timestamp.toLocaleTimeString()}  ·  click to dismiss
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function AlertPanel({ alerts, onDismiss }: Props) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '76px',
        right: '1.5rem',
        width: '340px',
        zIndex: 999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        pointerEvents: alerts.length === 0 ? 'none' : 'auto',
      }}
    >
      <AnimatePresence mode="popLayout">
        {alerts.map((alert) => (
          <AlertItem key={alert.id} alert={alert} onDismiss={() => onDismiss(alert.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
