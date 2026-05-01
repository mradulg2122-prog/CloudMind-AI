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

function SectionLabel({ icon, title }: { icon: string; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize: '14px' }}>{icon}</span>
      <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{title}</span>
    </div>
  );
}

function SliderRow({ label, unit, min, max, step, value, onChange }: {
  label: string; unit?: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const accent = pct > 80 ? '#FF4D4F' : pct > 60 ? '#FAAD14' : '#0078D4';
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: accent, background: `${accent}18`, padding: '2px 8px', borderRadius: '5px', minWidth: '48px', textAlign: 'center', border: `1px solid ${accent}30` }}>
          {value}{unit}
        </span>
      </div>
      <div style={{ position: 'relative', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', marginBottom: '4px' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, #0078D4, ${accent})`, borderRadius: '2px', boxShadow: `0 0 8px ${accent}60`, transition: 'width 0.15s ease, background 0.3s ease' }} />
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: accent, marginTop: '2px', cursor: 'pointer' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.15)' }}>{min}</span>
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.15)' }}>{max}</span>
      </div>
    </div>
  );
}

function StepperRow({ label, unit, min, max, step, value, onChange }: {
  label: string; unit?: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>{label}</div>
        {unit && <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', marginTop: '2px' }}>{unit}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button onClick={() => onChange(Math.max(min, value - step))} style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid rgba(0,120,212,0.25)', background: 'rgba(0,120,212,0.1)', color: '#5BA7E0', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>−</button>
        <span style={{ fontSize: '15px', fontFamily: "'JetBrains Mono', monospace", color: '#fff', fontWeight: 700, minWidth: '32px', textAlign: 'center' }}>{value}</span>
        <button onClick={() => onChange(Math.min(max, value + step))} style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid rgba(0,120,212,0.25)', background: 'rgba(0,120,212,0.1)', color: '#5BA7E0', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>+</button>
      </div>
    </div>
  );
}

export default function Sidebar({ telemetry, onChange, onPredict, loading, autoRefresh, onToggleAutoRefresh }: Props) {
  const set = (k: keyof TelemetryInput) => (v: number) => onChange({ ...telemetry, [k]: v });
  const hourlyCost = telemetry.active_servers * telemetry.cost_per_server;

  return (
    <aside style={{
      width: '280px', minWidth: '280px',
      display: 'flex', flexDirection: 'column',
      background: 'rgba(4,13,33,0.97)',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      backdropFilter: 'blur(24px)',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00B050', boxShadow: '0 0 8px #00B050', animation: 'livePulse 2s ease infinite' }} />
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Telemetry Input</span>
          </div>
          {/* Live cost badge */}
          <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#F7B731', background: 'rgba(247,183,49,0.1)', border: '1px solid rgba(247,183,49,0.2)', padding: '3px 10px', borderRadius: '6px', fontWeight: 600 }}>
            ${hourlyCost}/hr
          </div>
        </div>
      </div>

      {/* Scrollable inputs */}
      <div style={{ flex: 1, padding: '20px 18px 0', overflowY: 'auto' }}>

        {/* Traffic */}
        <div style={{ marginBottom: '24px' }}>
          <SectionLabel icon="📡" title="Traffic" />
          <SliderRow label="Requests / min" min={50} max={2000} step={10} value={telemetry.requests_per_minute} onChange={set('requests_per_minute')} />
        </div>

        {/* System Resources */}
        <div style={{ marginBottom: '24px' }}>
          <SectionLabel icon="🖥" title="System Resources" />
          <SliderRow label="CPU Usage" unit="%" min={0} max={100} step={1} value={telemetry.cpu_usage_percent} onChange={set('cpu_usage_percent')} />
          <SliderRow label="Memory Usage" unit="%" min={0} max={100} step={1} value={telemetry.memory_usage_percent} onChange={set('memory_usage_percent')} />
        </div>

        {/* Infrastructure */}
        <div style={{ marginBottom: '24px' }}>
          <SectionLabel icon="🌐" title="Infrastructure" />
          <StepperRow label="Active Servers" min={1} max={20} step={1} value={telemetry.active_servers} onChange={set('active_servers')} />
          <StepperRow label="Response Time" unit="milliseconds" min={0} max={5000} step={10} value={telemetry.response_time_ms} onChange={set('response_time_ms')} />
          <StepperRow label="Cost / Server" unit="dollars per hour" min={0} max={500} step={5} value={telemetry.cost_per_server} onChange={set('cost_per_server')} />
        </div>

        {/* Time */}
        <div style={{ marginBottom: '20px' }}>
          <SectionLabel icon="🕐" title="Time Context" />
          <SliderRow label="Hour" min={0} max={23} step={1} value={telemetry.hour} onChange={set('hour')} />
          <SliderRow label="Minute" min={0} max={59} step={1} value={telemetry.minute} onChange={set('minute')} />
        </div>
      </div>

      {/* Bottom controls */}
      <div style={{ padding: '16px 18px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Run button */}
        <button onClick={onPredict} disabled={loading} style={{
          width: '100%', padding: '14px 0',
          borderRadius: '12px', border: 'none',
          background: loading ? 'rgba(0,120,212,0.2)' : 'linear-gradient(135deg, #0078D4 0%, #00BCF2 100%)',
          color: '#fff', fontSize: '13px', fontWeight: 700,
          letterSpacing: '0.6px', textTransform: 'uppercase',
          cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: loading ? 'none' : '0 6px 24px rgba(0,120,212,0.5), 0 2px 8px rgba(0,0,0,0.4)',
          transition: 'all 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
          fontFamily: "'Inter', sans-serif",
        }}
          onMouseEnter={e => { if (!loading)(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
        >
          {loading
            ? <><div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Predicting…</>
            : '⚡  Run Prediction'
          }
        </button>

        {/* Auto-refresh toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', cursor: 'pointer', background: autoRefresh ? 'rgba(0,120,212,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${autoRefresh ? 'rgba(0,120,212,0.25)' : 'rgba(255,255,255,0.05)'}`, transition: 'all 0.2s' }}>
          <input type="checkbox" checked={autoRefresh} onChange={onToggleAutoRefresh} style={{ accentColor: '#0078D4', width: '14px', height: '14px', cursor: 'pointer' }} />
          <span style={{ fontSize: '12px', color: autoRefresh ? '#5BA7E0' : 'rgba(255,255,255,0.3)', fontWeight: 500, flex: 1 }}>
            Auto Refresh <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>(8s)</span>
          </span>
          {autoRefresh && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00B050', boxShadow: '0 0 7px #00B050' }} />}
        </label>

        {/* Model info card */}
        <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '8px' }}>Model Info</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', lineHeight: 1.9, color: 'rgba(255,255,255,0.25)' }}>
            <div>RandomForestRegressor</div>
            <div>Horizon: +5 min ahead</div>
            <div>Features: 12 signals</div>
            <div style={{ color: '#0078D4', marginTop: '2px' }}>FastAPI · :8000</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
