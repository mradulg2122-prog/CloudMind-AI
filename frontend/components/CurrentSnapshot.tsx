'use client';
import { TelemetryInput } from '@/lib/api';

interface Props { telemetry: TelemetryInput; hourlyCost: number; }

function KpiCard({ label, value, sub, icon, accentColor, glowColor, index }: {
  label: string; value: string; sub: string; icon: string;
  accentColor: string; glowColor: string; index: number;
}) {
  return (
    <div
      className="kpi-card-ms"
      style={{
        background: 'rgba(8,20,50,0.85)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px',
        padding: '24px 22px',
        position: 'relative',
        overflow: 'hidden',
        backdropFilter: 'blur(20px)',
        cursor: 'default',
        animation: `fadeInUp 0.45s ease ${index * 70}ms both`,
        transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(-6px)';
        el.style.border = `1px solid ${accentColor}40`;
        el.style.boxShadow = `0 20px 40px rgba(0,0,0,0.4), 0 0 30px ${glowColor}`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(0)';
        el.style.border = '1px solid rgba(255,255,255,0.06)';
        el.style.boxShadow = 'none';
      }}
    >
      {/* Top accent line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${accentColor}, ${accentColor}50, transparent)`, borderRadius: '16px 16px 0 0' }} />
      {/* BG glow */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: '120px', height: '120px', background: `radial-gradient(circle at top right, ${glowColor} 0%, transparent 70%)`, pointerEvents: 'none' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</span>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${accentColor}18`, border: `1px solid ${accentColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>{icon}</div>
      </div>

      <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fff', fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1, marginBottom: '8px', letterSpacing: '-0.5px' }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>{sub}</div>
    </div>
  );
}

function ResourceBar({ label, value, accentColor, delay }: { label: string; value: number; accentColor: string; delay: number }) {
  const level = value > 85 ? { text: 'Critical', color: '#FF4D4F' } : value > 70 ? { text: 'High', color: '#FAAD14' } : { text: 'Normal', color: accentColor };
  return (
    <div style={{
      background: 'rgba(8,20,50,0.85)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '16px',
      padding: '22px 24px',
      backdropFilter: 'blur(20px)',
      animation: `fadeInUp 0.45s ease ${delay}ms both`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: '3px' }}>{label}</div>
          <div style={{ fontSize: '11px', color: level.color, fontWeight: 600 }}>{level.text}</div>
        </div>
        <div style={{ fontSize: '2rem', fontWeight: 800, color: level.color, fontFamily: "'Space Grotesk', sans-serif" }}>{value}%</div>
      </div>
      <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${Math.min(value, 100)}%`,
          background: `linear-gradient(90deg, ${accentColor}, ${level.color})`,
          borderRadius: '4px',
          boxShadow: `0 0 12px ${level.color}80`,
          transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>0%</span>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>100%</span>
      </div>
    </div>
  );
}

export default function CurrentSnapshot({ telemetry, hourlyCost }: Props) {
  const { requests_per_minute, cpu_usage_percent, memory_usage_percent, active_servers, response_time_ms } = telemetry;
  const monthlyCost = hourlyCost * 720;
  const estimatedSaving = Math.round(monthlyCost * 0.38);

  return (
    <section>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '4px', height: '28px', borderRadius: '2px', background: 'linear-gradient(180deg, #0078D4, #00BCF2)' }} />
          <div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#fff', fontFamily: "'Space Grotesk', sans-serif" }}>Infrastructure Snapshot</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>Real-time telemetry · updates every 8s</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '999px', background: 'rgba(0,176,80,0.1)', border: '1px solid rgba(0,176,80,0.25)', fontSize: '11px', fontWeight: 600, color: '#00B050' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00B050', animation: 'livePulse 2s ease infinite' }} />
          Live · Streaming
        </div>
      </div>

      {/* 5-col KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '14px' }}>
        <KpiCard index={0} icon="📡" label="Requests / Min" value={requests_per_minute.toLocaleString()} sub="incoming traffic" accentColor="#0078D4" glowColor="rgba(0,120,212,0.12)" />
        <KpiCard index={1} icon="🖥" label="CPU Usage" value={`${cpu_usage_percent}%`} sub="utilisation" accentColor={cpu_usage_percent > 85 ? '#FF4D4F' : cpu_usage_percent > 70 ? '#FAAD14' : '#0078D4'} glowColor={cpu_usage_percent > 85 ? 'rgba(255,77,79,0.1)' : 'rgba(0,120,212,0.1)'} />
        <KpiCard index={2} icon="💾" label="Memory Usage" value={`${memory_usage_percent}%`} sub="utilisation" accentColor={memory_usage_percent > 80 ? '#FAAD14' : '#00BCF2'} glowColor="rgba(0,188,242,0.1)" />
        <KpiCard index={3} icon="🌐" label="Active Servers" value={String(active_servers)} sub="instances running" accentColor="#8B5CF6" glowColor="rgba(139,92,246,0.1)" />
        <KpiCard index={4} icon="⚡" label="Response Time" value={`${response_time_ms}ms`} sub="avg latency" accentColor={response_time_ms > 1000 ? '#FF4D4F' : response_time_ms > 500 ? '#FAAD14' : '#00B050'} glowColor="rgba(0,176,80,0.1)" />
      </div>

      {/* Cost row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '14px', marginBottom: '14px' }}>
        {/* Hourly cost */}
        <div style={{ background: 'rgba(8,20,50,0.85)', border: '1px solid rgba(247,183,49,0.2)', borderRadius: '16px', padding: '24px', backdropFilter: 'blur(20px)', position: 'relative', overflow: 'hidden', animation: 'fadeInUp 0.45s ease 350ms both' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #C9920A, #F7B731)' }} />
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(247,183,49,0.6)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>💰 Hourly Cost</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#F7B731', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.5px' }}>${hourlyCost}</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', marginTop: '6px' }}>USD per hour</div>
        </div>

        {/* Monthly projection */}
        <div style={{ background: 'rgba(8,20,50,0.85)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px', backdropFilter: 'blur(20px)', position: 'relative', overflow: 'hidden', animation: 'fadeInUp 0.45s ease 420ms both' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #F6AD55, #F59E0B)' }} />
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>📅 Monthly Projection</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fff', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.5px' }}>${monthlyCost.toLocaleString()}</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', marginTop: '6px' }}>at current rate</div>
        </div>

        {/* AI Savings Opportunity */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(8,20,50,0.95) 0%, rgba(10,30,70,0.9) 100%)',
          border: '1px solid rgba(247,183,49,0.25)',
          borderRadius: '16px', padding: '24px',
          backdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'relative', overflow: 'hidden',
          animation: 'fadeInUp 0.45s ease 490ms both',
          boxShadow: '0 0 40px rgba(247,183,49,0.06)',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #C9920A, #F7B731, #FFD770)' }} />
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '200px', background: 'radial-gradient(ellipse at right, rgba(247,183,49,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#F7B731', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>💡 AI Cost Saving Opportunity</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#F7B731', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.5px' }}>${estimatedSaving.toLocaleString()}</span>
              <span style={{ fontSize: '14px', color: 'rgba(247,183,49,0.6)', fontWeight: 600 }}>/mo</span>
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginTop: '6px' }}>Estimated 38% reduction via ML auto-scaling</div>
          </div>
          <div style={{ textAlign: 'center', padding: '16px 20px', borderRadius: '14px', background: 'rgba(247,183,49,0.1)', border: '1px solid rgba(247,183,49,0.2)', flexShrink: 0 }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#F7B731', fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>38%</div>
            <div style={{ fontSize: '9px', color: 'rgba(247,183,49,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>savings</div>
          </div>
        </div>
      </div>

      {/* Resource bars */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <ResourceBar label="CPU Load" value={cpu_usage_percent} accentColor="#0078D4" delay={560} />
        <ResourceBar label="Memory Load" value={memory_usage_percent} accentColor="#00BCF2" delay={630} />
      </div>
    </section>
  );
}
