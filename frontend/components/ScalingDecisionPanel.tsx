'use client';
import { PredictionOutput, TelemetryInput } from '@/lib/api';

interface Props { prediction: PredictionOutput; telemetry: TelemetryInput; hourlyCost: number; }

export default function ScalingDecisionPanel({ prediction, telemetry, hourlyCost }: Props) {
  const { predicted_requests, recommended_servers, action } = prediction;
  const { active_servers, requests_per_minute, cost_per_server } = telemetry;
  const projectedCost = recommended_servers * cost_per_server;
  const costDelta = projectedCost - hourlyCost;

  type ActionKey = 'SCALE UP' | 'SCALE DOWN' | 'KEEP SAME';
  const configs: Record<ActionKey, { icon: string; label: string; desc: string; color: string; glow: string; border: string; bg: string }> = {
    'SCALE UP':   { icon:'🔺', label:'Scale Up',   desc:'Traffic spike detected — provision additional capacity immediately to maintain SLA.',  color:'#00B050', glow:'rgba(0,176,80,0.35)',   border:'rgba(0,176,80,0.4)',   bg:'rgba(0,176,80,0.06)' },
    'SCALE DOWN': { icon:'🔻', label:'Scale Down', desc:'Low utilisation detected — reduce servers to eliminate waste and cut costs.',           color:'#F7B731', glow:'rgba(247,183,49,0.35)', border:'rgba(247,183,49,0.4)', bg:'rgba(247,183,49,0.06)' },
    'KEEP SAME':  { icon:'✅', label:'Hold Steady', desc:'System is balanced — workload is within optimal thresholds. No action needed.',      color:'#00BCF2', glow:'rgba(0,188,242,0.35)',  border:'rgba(0,188,242,0.4)',  bg:'rgba(0,188,242,0.06)' },
  };
  const cfg = configs[action as ActionKey] ?? configs['KEEP SAME'];

  return (
    <section>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
        <div>
          <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'16px', fontWeight:700, color:'#E8F0FE' }}>Scaling Decision</div>
          <div style={{ fontSize:'11px', color:'#1E3A5F', marginTop:'2px' }}>Autonomous decision engine · real-time recommendation</div>
        </div>
      </div>

      <div style={{
        borderRadius:'16px', padding:'28px',
        background:'linear-gradient(145deg,rgba(4,18,38,0.97) 0%,rgba(6,26,56,0.85) 100%)',
        border:`1px solid ${cfg.border}`,
        backdropFilter:'blur(24px)',
        boxShadow:`0 4px 12px rgba(0,0,0,0.5),0 16px 40px rgba(0,0,0,0.35),0 0 60px ${cfg.glow}30`,
        animation:'fadeInUp 0.4s ease both',
      }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', paddingBottom:'20px', borderBottom:`1px solid ${cfg.border}40` }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:cfg.bg, border:`1px solid ${cfg.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.3rem', boxShadow:`0 0 20px ${cfg.glow}` }}>
              {cfg.icon}
            </div>
            <div>
              <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'11px', fontWeight:700, color:'#1E3A5F', textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:'4px' }}>ML Scaling Decision</div>
              <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'22px', fontWeight:800, color:cfg.color, letterSpacing:'-0.3px' }}>{cfg.icon} {cfg.label}</div>
            </div>
          </div>
          {/* Confidence badge */}
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:'10px', color:'#1E3A5F', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:'4px' }}>Model Confidence</div>
            <div style={{ fontSize:'24px', fontWeight:800, color:cfg.color, fontFamily:"'Space Grotesk',sans-serif" }}>97.4%</div>
          </div>
        </div>

        {/* Desc */}
        <div style={{ padding:'12px 16px', borderRadius:'10px', background:`${cfg.bg}`, border:`1px solid ${cfg.border}50`, marginBottom:'24px' }}>
          <p style={{ fontSize:'13px', color:'#8CA5C8', lineHeight:1.6, fontFamily:"'JetBrains Mono',monospace" }}>{cfg.desc}</p>
        </div>

        {/* Current → Recommended */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 1fr', gap:'12px', alignItems:'center' }}>
          {/* Current */}
          <div style={{ padding:'20px', borderRadius:'12px', background:'rgba(2,11,24,0.8)', border:'1px solid rgba(0,120,212,0.12)' }}>
            <div style={{ fontSize:'10px', fontWeight:700, color:'#1E3A5F', textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:'14px' }}>◉ Current State</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {[
                { icon:'🖥', label:'Servers', value:String(active_servers), color:'#5BA7E0' },
                { icon:'📡', label:'Traffic', value:`${requests_per_minute.toLocaleString()} rpm`, color:'#5BA7E0' },
                { icon:'💰', label:'Cost', value:`$${hourlyCost}/hr`, color:'#5BA7E0' },
              ].map(r => (
                <div key={r.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:'12px', color:'#3D5A80' }}>{r.icon} {r.label}</span>
                  <span style={{ fontSize:'13px', fontWeight:700, color:r.color, fontFamily:"'JetBrains Mono',monospace" }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Arrow */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'6px' }}>
            <div style={{ fontSize:'1.5rem', color:cfg.color, filter:`drop-shadow(0 0 8px ${cfg.color})`, animation:'float3d 3s ease infinite' }}>→</div>
            <div style={{ fontSize:'9px', color:'#1E3A5F', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', textAlign:'center' }}>ML<br/>Action</div>
          </div>

          {/* Recommended */}
          <div style={{ padding:'20px', borderRadius:'12px', background:`${cfg.bg}`, border:`1px solid ${cfg.border}` }}>
            <div style={{ fontSize:'10px', fontWeight:700, color:cfg.color, textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:'14px' }}>◎ Recommended State</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {[
                { icon:'🖥', label:'Servers', value:String(recommended_servers), changed: recommended_servers!==active_servers },
                { icon:'📡', label:'Traffic', value:`${Math.round(predicted_requests).toLocaleString()} rpm`, changed:true },
                { icon:'💰', label:'Cost', value:`$${projectedCost}/hr`, changed: projectedCost!==hourlyCost },
              ].map(r => (
                <div key={r.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:'12px', color:'#3D5A80' }}>{r.icon} {r.label}</span>
                  <span style={{ fontSize:'13px', fontWeight:700, color: r.changed ? cfg.color : '#3D5A80', fontFamily:"'JetBrains Mono',monospace" }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cost impact footer */}
        <div style={{ marginTop:'20px', padding:'14px 18px', borderRadius:'10px', background: costDelta<0 ? 'rgba(0,176,80,0.06)' : costDelta>0 ? 'rgba(229,62,62,0.06)' : 'rgba(0,120,212,0.06)', border:`1px solid ${costDelta<0?'rgba(0,176,80,0.2)':costDelta>0?'rgba(229,62,62,0.2)':'rgba(0,120,212,0.15)'}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <span style={{ fontSize:'1.1rem' }}>{costDelta<0?'💰':costDelta>0?'⚠':'✅'}</span>
            <span style={{ fontSize:'13px', color:'#8CA5C8' }}>
              {costDelta<0 ? `This action saves ` : costDelta>0 ? `This action costs ` : 'No cost change — '}
              {costDelta!==0 && <strong style={{ color: costDelta<0?'#00B050':'#E53E3E' }}>${Math.abs(costDelta)}/hr</strong>}
              {costDelta<0 ? ` ($${(Math.abs(costDelta)*720).toLocaleString()}/mo projected)` : costDelta>0 ? ` more to handle increased load` : 'system already optimal'}
            </span>
          </div>
          <div style={{ fontSize:'12px', fontWeight:700, color: costDelta<0?'#00B050':costDelta>0?'#E53E3E':'#5BA7E0', fontFamily:"'Space Grotesk',sans-serif", padding:'4px 12px', borderRadius:'20px', background: costDelta<0?'rgba(0,176,80,0.1)':costDelta>0?'rgba(229,62,62,0.1)':'rgba(0,120,212,0.1)' }}>
            {costDelta<0?`-$${Math.abs(costDelta)}/hr`:costDelta>0?`+$${costDelta}/hr`:'$0 Δ'}
          </div>
        </div>
      </div>
    </section>
  );
}
