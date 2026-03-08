'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { PredictionOutput, TelemetryInput } from '@/lib/api';

interface Props {
  prediction: PredictionOutput;
  telemetry: TelemetryInput;
  hourlyCost: number;
}

export default function ScalingDecisionPanel({ prediction, telemetry, hourlyCost }: Props) {
  const { predicted_requests, recommended_servers, action } = prediction;
  const { active_servers, requests_per_minute, cost_per_server } = telemetry;
  const projectedCost = recommended_servers * cost_per_server;

  type ActionKey = 'SCALE UP' | 'SCALE DOWN' | 'KEEP SAME';

  const actionConfig: Record<
    ActionKey,
    { icon: string; desc: string; color: string; glow: string; bg: string; border: string; label: string }
  > = {
    'SCALE UP': {
      icon: '🔺',
      desc: 'Traffic spike detected — provision more capacity immediately',
      color: '#4ade80',
      glow: 'rgba(34,197,94,0.4)',
      bg: 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(34,197,94,0.04) 100%)',
      border: 'rgba(34,197,94,0.55)',
      label: 'SCALE UP',
    },
    'SCALE DOWN': {
      icon: '🔻',
      desc: 'Low utilisation — reduce servers to optimise costs',
      color: '#f87171',
      glow: 'rgba(239,68,68,0.4)',
      bg: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.04) 100%)',
      border: 'rgba(239,68,68,0.55)',
      label: 'SCALE DOWN',
    },
    'KEEP SAME': {
      icon: '✅',
      desc: 'System is balanced — no scaling action required',
      color: '#60a5fa',
      glow: 'rgba(59,130,246,0.4)',
      bg: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0.04) 100%)',
      border: 'rgba(59,130,246,0.55)',
      label: 'KEEP SAME',
    },
  };

  const cfg = actionConfig[action as ActionKey] ?? actionConfig['KEEP SAME'];

  return (
    <section>
      <div className="section-title" style={{ marginTop: 0, marginBottom: '1.25rem' }}>
        Scaling Decision Panel
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={action}
          initial={{ opacity: 0, scale: 0.97, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: -16 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          style={{
            borderRadius: '18px',
            padding: '2.5rem',
            border: `1px solid ${cfg.border}`,
            background: 'linear-gradient(135deg, rgba(30,41,59,0.9) 0%, rgba(17,24,39,0.7) 100%)',
            backdropFilter: 'blur(12px)',
            boxShadow: `0 0 40px ${cfg.glow}20, 0 8px 32px rgba(0,0,0,0.3)`,
          }}
        >
          <h3
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              color: '#e2e8f0',
              fontSize: '1.15rem',
              fontWeight: 600,
              marginBottom: '2rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid rgba(59,130,246,0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            ⚡ ML Scaling Decision
          </h3>

          {/* Main action badge – centered */}
          <div style={{ textAlign: 'center', padding: '1rem 0 2rem' }}>
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '1rem 2.5rem',
                  borderRadius: '16px',
                  background: cfg.bg,
                  border: `2px solid ${cfg.border}`,
                  color: cfg.color,
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '1.6rem',
                  fontWeight: 800,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  boxShadow: `0 0 32px ${cfg.glow}, 0 4px 16px rgba(0,0,0,0.2)`,
                }}
              >
                {cfg.icon}&nbsp;{cfg.label}
              </span>
            </motion.div>

            <p
              style={{
                marginTop: '1.25rem',
                fontFamily: "'Space Mono', monospace",
                fontSize: '0.85rem',
                color: '#64748b',
                lineHeight: 1.6,
              }}
            >
              {cfg.desc}
            </p>
          </div>

          {/* State comparison */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              gap: '1rem',
              alignItems: 'center',
            }}
          >
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              style={{
                padding: '1.5rem',
                borderRadius: '14px',
                background: '#080f1c',
                border: '1px solid #1e3a5f',
                fontFamily: "'Space Mono', monospace",
                fontSize: '0.82rem',
              }}
            >
              <div style={{ color: '#475569', marginBottom: '0.75rem', letterSpacing: '0.6px', fontSize: '0.7rem', fontWeight: 700 }}>
                ◉ CURRENT STATE
              </div>
              <div style={{ color: '#e2e8f0', lineHeight: 2, fontSize: '0.85rem' }}>
                <div>🖥️ &nbsp;<strong style={{ color: '#93c5fd' }}>{active_servers}</strong> servers</div>
                <div>📡 &nbsp;<strong style={{ color: '#93c5fd' }}>{requests_per_minute.toLocaleString()}</strong> req/min</div>
                <div>💰 &nbsp;<strong style={{ color: '#93c5fd' }}>${hourlyCost}</strong>/hr</div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: 'spring' }}
              style={{
                color: cfg.color,
                fontSize: '1.75rem',
                textAlign: 'center',
                filter: `drop-shadow(0 0 8px ${cfg.color})`,
              }}
            >
              →
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
              style={{
                padding: '1.5rem',
                borderRadius: '14px',
                background: '#080f1c',
                border: `1px solid ${cfg.border}`,
                fontFamily: "'Space Mono', monospace",
                fontSize: '0.82rem',
                boxShadow: `0 0 16px ${cfg.glow}20`,
              }}
            >
              <div style={{ color: cfg.color, marginBottom: '0.75rem', letterSpacing: '0.6px', fontSize: '0.7rem', fontWeight: 700 }}>
                ◎ RECOMMENDED STATE
              </div>
              <div style={{ color: '#e2e8f0', lineHeight: 2, fontSize: '0.85rem' }}>
                <div>🖥️ &nbsp;<strong style={{ color: cfg.color }}>{recommended_servers}</strong> servers</div>
                <div>📡 &nbsp;<strong style={{ color: cfg.color }}>{predicted_requests.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> req/min</div>
                <div>💰 &nbsp;<strong style={{ color: cfg.color }}>${projectedCost}</strong>/hr</div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
