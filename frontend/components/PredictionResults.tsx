'use client';
import { PredictionOutput, TelemetryInput } from '@/lib/api';

interface Props { prediction: PredictionOutput; telemetry: TelemetryInput; hourlyCost: number; }

function PredCard({ label, value, sub, icon, color, glow, delta, index }: {
  label: string; value: string; sub: string; icon: string;
  color: string; glow: string; delta?: { text: string; up: boolean | null }; index: number;
}) {
  return (
    <div style={{
      background:'linear-gradient(145deg,rgba(4,18,38,0.95) 0%,rgba(6,26,56,0.8) 100%)',
      border:`1px solid ${glow}`,
      borderRadius:'14px', padding:'20px',
      backdropFilter:'blur(24px)',
      boxShadow:`0 2px 4px rgba(0,0,0,0.5),0 8px 20px rgba(0,0,0,0.35),0 0 24px ${glow}40`,
      position:'relative', overflow:'hidden',
      transform:'perspective(800px) translateZ(0)',
      transition:'all 0.22s cubic-bezier(0.4,0,0.2,1)',
      animation:`fadeInUp 0.4s ease ${index*90}ms both`,
    }}
    onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.transform='perspective(800px) translateZ(12px) translateY(-4px)'}}
    onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.transform='perspective(800px) translateZ(0)'}}
    >
      <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:`linear-gradient(90deg,${color},${color}80)` }} />
      <div style={{ position:'absolute', top:0, right:0, width:'70px', height:'70px', background:`radial-gradient(circle at top right,${glow}20 0%,transparent 70%)`, pointerEvents:'none' }} />

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
        <span style={{ fontSize:'10px', fontWeight:700, color:'#1E3A5F', textTransform:'uppercase', letterSpacing:'0.7px' }}>{label}</span>
        <div style={{ width:'30px', height:'30px', borderRadius:'8px', background:`${glow}15`, border:`1px solid ${glow}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.9rem' }}>{icon}</div>
      </div>
      <div style={{ fontSize:'2rem', fontWeight:800, color, fontFamily:"'Space Grotesk',sans-serif", lineHeight:1, marginBottom:'6px' }}>{value}</div>
      {delta ? (
        <div style={{ fontSize:'11px', display:'flex', alignItems:'center', gap:'4px', color: delta.up===null?'#3D5A80':delta.up?'#E53E3E':'#00B050' }}>
          {delta.up===true?'▲':delta.up===false?'▼':'—'} {delta.text}
        </div>
      ) : (
        <div style={{ fontSize:'11px', color:'#1E3A5F' }}>{sub}</div>
      )}
    </div>
  );
}

export default function PredictionResults({ prediction, telemetry, hourlyCost }: Props) {
  const { predicted_requests, recommended_servers, load_per_server } = prediction;
  const { requests_per_minute, active_servers, cost_per_server } = telemetry;
  const deltaRequests = predicted_requests - requests_per_minute;
  const deltaServers = recommended_servers - active_servers;
  const projectedCost = recommended_servers * cost_per_server;
  const costDelta = projectedCost - hourlyCost;

  return (
    <section>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
        <div>
          <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'16px', fontWeight:700, color:'#E8F0FE' }}>ML Prediction Engine</div>
          <div style={{ fontSize:'11px', color:'#1E3A5F', marginTop:'2px' }}>RandomForestRegressor · 5-minute horizon · 12 features</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'6px', padding:'5px 12px', borderRadius:'999px', background:'rgba(0,120,212,0.08)', border:'1px solid rgba(0,120,212,0.2)', fontSize:'11px', fontWeight:600, color:'#5BA7E0' }}>
          🤖 AI Forecast Ready
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px' }}>
        <PredCard index={0} icon="📈" label="Predicted Traffic (+5 min)"
          value={Math.round(predicted_requests).toLocaleString()} sub="req / min"
          color="#00BCF2" glow="rgba(0,188,242,0.3)"
          delta={{ text:`${Math.abs(Math.round(deltaRequests)).toLocaleString()} from current`, up: deltaRequests>=0 }}
        />
        <PredCard index={1} icon="🖥" label="Recommended Servers"
          value={String(recommended_servers)} sub="instances"
          color="#818CF8" glow="rgba(129,140,248,0.3)"
          delta={{ text: deltaServers===0?'no change':`${deltaServers>0?'+':''}${deltaServers} from current`, up: deltaServers===0?null:deltaServers>0 }}
        />
        <PredCard index={2} icon="⚖" label="Load / Server"
          value={Math.round(load_per_server).toLocaleString()} sub="req/min per server"
          color={load_per_server>400?'#E53E3E':'#F6AD55'} glow={load_per_server>400?'rgba(229,62,62,0.3)':'rgba(246,173,85,0.3)'}
        />
        <PredCard index={3} icon="💰" label="Projected Hourly Cost"
          value={`$${projectedCost}`} sub="USD / hour"
          color={costDelta<0?'#00B050':'#F7B731'} glow={costDelta<0?'rgba(0,176,80,0.3)':'rgba(247,183,49,0.3)'}
          delta={{ text: costDelta<0?`saves $${Math.abs(costDelta)}/hr`:costDelta>0?`+$${costDelta}/hr`:'no change', up: costDelta===0?null:costDelta<0 }}
        />
      </div>
    </section>
  );
}
