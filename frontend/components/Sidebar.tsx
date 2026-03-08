'use client';

import { TelemetryInput } from '@/lib/api';

interface Props {
  telemetry: TelemetryInput;
  onChange: (t: TelemetryInput) => void;
  onPredict: () => void;
  loading: boolean;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
}

const labelStyle: React.CSSProperties = {
  color: '#64b5f6',
  fontWeight: 600,
  fontSize: '0.82rem',
  letterSpacing: '0.3px',
  marginBottom: '0.55rem',
  display: 'block',
};

const sectionHeadingStyle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: '0.75rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  marginBottom: '1rem',
};

function SliderInput({
  label, min, max, step, value, onChange,
}: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: '1.4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.55rem' }}>
        <label style={labelStyle}>{label}</label>
        <span
          style={{
            fontSize: '0.82rem',
            fontFamily: "'Space Mono', monospace",
            color: '#e2e8f0',
            background: 'rgba(59,130,246,0.12)',
            padding: '0.15rem 0.5rem',
            borderRadius: '5px',
            minWidth: '2.5rem',
            textAlign: 'center',
          }}
        >
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem' }}>
        <span style={{ fontSize: '0.65rem', color: '#334155' }}>{min}</span>
        <span style={{ fontSize: '0.65rem', color: '#334155' }}>{max}</span>
      </div>
    </div>
  );
}

function NumberInput({
  label, min, max, step, value, onChange,
}: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: '1.4rem' }}>
      <label style={labelStyle}>{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ padding: '0.6rem 0.85rem', fontSize: '0.9rem' }}
      />
    </div>
  );
}

function SectionGroup({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          marginBottom: '1rem',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid rgba(30,41,59,0.7)',
        }}
      >
        <span style={{ fontSize: '0.85rem' }}>{icon}</span>
        <span style={sectionHeadingStyle as React.CSSProperties}>{title}</span>
      </div>
      {children}
    </div>
  );
}

export default function Sidebar({
  telemetry,
  onChange,
  onPredict,
  loading,
  autoRefresh,
  onToggleAutoRefresh,
}: Props) {
  const set = (key: keyof TelemetryInput) => (val: number) => onChange({ ...telemetry, [key]: val });

  return (
    <aside
      style={{
        width: '300px',
        minWidth: '300px',
        overflowY: 'auto',
        padding: '1.75rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #0c1221 0%, #111827 100%)',
        borderRight: '1px solid rgba(30,41,59,0.8)',
      }}
    >
      {/* Section title */}
      <div className="section-title" style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '0.7rem' }}>
        Telemetry Input
      </div>

      <SectionGroup icon="📡" title="Current Traffic">
        <SliderInput
          label="Requests / Minute"
          min={50} max={2000} step={10}
          value={telemetry.requests_per_minute}
          onChange={set('requests_per_minute')}
        />
      </SectionGroup>

      <SectionGroup icon="🖥️" title="System Resources">
        <SliderInput
          label="CPU Usage (%)"
          min={0} max={100} step={1}
          value={telemetry.cpu_usage_percent}
          onChange={set('cpu_usage_percent')}
        />
        <SliderInput
          label="Memory Usage (%)"
          min={0} max={100} step={1}
          value={telemetry.memory_usage_percent}
          onChange={set('memory_usage_percent')}
        />
      </SectionGroup>

      <SectionGroup icon="🌐" title="Infrastructure">
        <NumberInput
          label="Active Servers"
          min={1} max={20} step={1}
          value={telemetry.active_servers}
          onChange={set('active_servers')}
        />
        <NumberInput
          label="Response Time (ms)"
          min={0} max={5000} step={10}
          value={telemetry.response_time_ms}
          onChange={set('response_time_ms')}
        />
        <NumberInput
          label="Cost / Server / Hour ($)"
          min={0} max={500} step={5}
          value={telemetry.cost_per_server}
          onChange={set('cost_per_server')}
        />
      </SectionGroup>

      <SectionGroup icon="🕐" title="Time Context">
        <SliderInput
          label="Hour (0–23)"
          min={0} max={23} step={1}
          value={telemetry.hour}
          onChange={set('hour')}
        />
        <SliderInput
          label="Minute (0–59)"
          min={0} max={59} step={1}
          value={telemetry.minute}
          onChange={set('minute')}
        />
      </SectionGroup>

      <hr style={{ borderColor: 'rgba(30,41,59,0.6)', margin: '1rem 0 1.25rem' }} />

      {/* Predict Button */}
      <button
        onClick={onPredict}
        disabled={loading}
        style={{
          width: '100%',
          fontWeight: 700,
          fontSize: '0.85rem',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          padding: '0.85rem 1rem',
          borderRadius: '12px',
          border: 'none',
          background: loading
            ? 'rgba(59,130,246,0.3)'
            : 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
          color: 'white',
          boxShadow: loading ? 'none' : '0 4px 20px rgba(59,130,246,0.35)',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.3s ease',
        }}
      >
        {loading ? '⏳  Running...' : '⚡  RUN PREDICTION'}
      </button>

      {/* Auto Refresh Toggle */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          marginTop: '0.85rem',
          padding: '0.7rem 0.9rem',
          borderRadius: '10px',
          background: autoRefresh ? 'rgba(59,130,246,0.1)' : 'rgba(30,41,59,0.4)',
          border: `1px solid ${autoRefresh ? 'rgba(59,130,246,0.4)' : 'rgba(30,41,59,0.7)'}`,
          cursor: 'pointer',
          transition: 'all 0.25s ease',
          userSelect: 'none',
        }}
      >
        <input
          type="checkbox"
          checked={autoRefresh}
          onChange={onToggleAutoRefresh}
          style={{ accentColor: '#3b82f6', width: '15px', height: '15px', cursor: 'pointer' }}
        />
        <span style={{ fontSize: '0.78rem', color: autoRefresh ? '#93c5fd' : '#64748b', fontWeight: 600 }}>
          Auto Refresh&nbsp;
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.7rem' }}>
            (every 8s)
          </span>
        </span>
        {autoRefresh && (
          <span
            style={{
              marginLeft: 'auto',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#4ade80',
              boxShadow: '0 0 6px #4ade80',
              flexShrink: 0,
              animation: 'pulse-blue 2s infinite',
            }}
          />
        )}
      </label>

      {/* Model Info Footer */}
      <div
        style={{
          marginTop: '1.25rem',
          padding: '1rem 1.1rem',
          borderRadius: '12px',
          background: 'rgba(13,27,42,0.8)',
          border: '1px solid rgba(30,58,95,0.6)',
          color: '#64b5f6',
          fontFamily: "'Space Mono', monospace",
          fontSize: '0.72rem',
          lineHeight: 2,
        }}
      >
        MODEL: RandomForestRegressor<br />
        HORIZON: +5 minutes ahead<br />
        FEATURES: 12 telemetry signals<br />
        BACKEND: FastAPI · localhost:8000
      </div>
    </aside>
  );
}
