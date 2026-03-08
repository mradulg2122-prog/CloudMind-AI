'use client';

import { motion } from 'framer-motion';
import { TelemetryInput } from '@/lib/api';

interface Props {
  telemetry: TelemetryInput;
  hourlyCost: number;
}

function MetricCard({
  label,
  value,
  unit,
  accent,
  icon,
  index,
}: {
  label: string;
  value: string;
  unit: string;
  accent?: string;
  icon: string;
  index: number;
}) {
  return (
    <motion.div
      className="metric-card"
      style={{ padding: '1.75rem 1.75rem 1.5rem' }}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: [0.34, 1.56, 0.64, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div className="metric-label" style={{ fontSize: '0.72rem', letterSpacing: '0.8px', margin: 0 }}>
          {label}
        </div>
        <span style={{ fontSize: '1.25rem', opacity: 0.7 }}>{icon}</span>
      </div>
      <div
        className="metric-value"
        style={{
          color: accent ?? '#e2e8f0',
          fontSize: '2.4rem',
          marginBottom: '0.5rem',
        }}
      >
        {value}
      </div>
      <div className="metric-unit" style={{ fontSize: '0.8rem' }}>
        {unit}
      </div>
    </motion.div>
  );
}

function ProgressBar({ label, value, color, index }: { label: string; value: number; color: string; index: number }) {
  return (
    <motion.div
      style={{
        background: 'linear-gradient(135deg, rgba(17,24,39,0.9) 0%, rgba(15,23,42,0.7) 100%)',
        border: '1px solid rgba(59,130,246,0.15)',
        borderRadius: '14px',
        padding: '1.5rem 1.75rem',
      }}
      initial={{ opacity: 0, x: index === 0 ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
        <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.875rem' }}>{label}</span>
        <span
          style={{
            color,
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '1.25rem',
            fontWeight: 700,
          }}
        >
          {value}%
        </span>
      </div>
      <div
        style={{
          height: '10px',
          borderRadius: '8px',
          background: 'rgba(30,41,59,0.7)',
          overflow: 'hidden',
        }}
      >
        <motion.div
          style={{
            height: '100%',
            borderRadius: '8px',
            background: `linear-gradient(90deg, ${color} 0%, #06b6d4 100%)`,
          }}
          initial={{ width: '0%' }}
          animate={{ width: `${Math.min(value, 100)}%` }}
          transition={{ duration: 0.8, delay: 0.5 + index * 0.1, ease: 'easeOut' }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
        <span style={{ fontSize: '0.7rem', color: '#334155' }}>0%</span>
        <span style={{ fontSize: '0.7rem', color: '#334155' }}>100%</span>
      </div>
    </motion.div>
  );
}

export default function CurrentSnapshot({ telemetry, hourlyCost }: Props) {
  const { requests_per_minute, cpu_usage_percent, memory_usage_percent, active_servers } = telemetry;

  return (
    <section>
      <div className="section-title" style={{ marginTop: 0, marginBottom: '1.25rem' }}>
        Current Snapshot
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '1.25rem',
        }}
      >
        <MetricCard icon="📡" index={0} label="Requests / Min" value={requests_per_minute.toLocaleString()} unit="req / min" />
        <MetricCard icon="🖥️" index={1} label="CPU Usage" value={`${cpu_usage_percent}%`} unit="utilisation" accent={cpu_usage_percent > 85 ? '#f87171' : cpu_usage_percent > 70 ? '#fbbf24' : '#e2e8f0'} />
        <MetricCard icon="💾" index={2} label="Memory Usage" value={`${memory_usage_percent}%`} unit="utilisation" accent={memory_usage_percent > 80 ? '#fbbf24' : '#e2e8f0'} />
        <MetricCard icon="🌐" index={3} label="Active Servers" value={String(active_servers)} unit="instances" />
        <MetricCard icon="💰" index={4} label="Hourly Cost" value={`$${hourlyCost}`} unit="USD / hour" accent="#34d399" />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.25rem',
          marginTop: '1.25rem',
        }}
      >
        <ProgressBar index={0} label="CPU Load" value={cpu_usage_percent} color="#3b82f6" />
        <ProgressBar index={1} label="Memory Load" value={memory_usage_percent} color="#8b5cf6" />
      </div>
    </section>
  );
}
