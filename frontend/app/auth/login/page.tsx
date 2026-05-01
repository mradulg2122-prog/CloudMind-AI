'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { loginUser } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try { await loginUser(username, password); router.push('/dashboard'); }
    catch (err: unknown) { setError((err as Error).message ?? 'Login failed.'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', background:'#020B18', fontFamily:"'Inter',sans-serif", position:'relative', overflow:'hidden' }}>

      {/* Deep space background grid */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', backgroundImage:'linear-gradient(rgba(0,120,212,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,120,212,0.04) 1px,transparent 1px)', backgroundSize:'60px 60px', zIndex:0 }} />

      {/* Ambient glows */}
      <div style={{ position:'absolute', top:'-20%', left:'-10%', width:'700px', height:'700px', borderRadius:'50%', background:'radial-gradient(circle,rgba(0,120,212,0.1) 0%,transparent 70%)', pointerEvents:'none', zIndex:0 }} />
      <div style={{ position:'absolute', bottom:'-20%', right:'30%', width:'500px', height:'500px', borderRadius:'50%', background:'radial-gradient(circle,rgba(247,183,49,0.06) 0%,transparent 70%)', pointerEvents:'none', zIndex:0 }} />

      {/* ── LEFT PANEL ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'4rem 4rem 4rem 5rem', position:'relative', zIndex:1 }}>

        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:'14px', marginBottom:'3.5rem' }}>
          <div style={{ width:'48px', height:'48px', borderRadius:'12px', background:'linear-gradient(135deg,#0078D4 0%,#00BCF2 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem', boxShadow:'0 0 30px rgba(0,120,212,0.6),0 4px 12px rgba(0,0,0,0.4)' }}>☁</div>
          <div>
            <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'1.15rem', background:'linear-gradient(135deg,#5BA7E0 0%,#00BCF2 40%,#F7B731 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>CloudMind AI</div>
            <div style={{ fontSize:'0.7rem', color:'#3D5A80', letterSpacing:'0.3px' }}>Cloud Cost Intelligence Platform</div>
          </div>
        </div>

        {/* Headline */}
        <div style={{ marginBottom:'3rem' }}>
          <h1 style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'3rem', fontWeight:800, color:'#E8F0FE', lineHeight:1.1, marginBottom:'1rem' }}>
            Optimize Your<br />
            <span style={{ background:'linear-gradient(135deg,#5BA7E0 0%,#00BCF2 40%,#F7B731 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Cloud Spend</span>
          </h1>
          <p style={{ color:'#3D5A80', fontSize:'1rem', lineHeight:1.7, maxWidth:'420px' }}>
            AI-powered workload forecasting that reduces infrastructure costs by up to 40% through autonomous scaling decisions.
          </p>
        </div>

        {/* 3D Floating stats card */}
        <div style={{
          display:'inline-block', padding:'24px 28px',
          background:'rgba(4,18,38,0.9)', border:'1px solid rgba(0,120,212,0.2)',
          borderRadius:'16px', maxWidth:'380px',
          boxShadow:'0 2px 4px rgba(0,0,0,0.5),0 8px 20px rgba(0,0,0,0.4),0 20px 40px rgba(0,0,0,0.3),0 0 0 1px rgba(0,120,212,0.08)',
          transform:'perspective(800px) rotateY(-4deg) rotateX(2deg)',
          backdropFilter:'blur(20px)',
        }}>
          <div style={{ fontSize:'10px', fontWeight:700, color:'#3D5A80', textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:'16px' }}>Live Savings Dashboard</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'16px' }}>
            {[
              { label:'Saved / mo', value:'$12,840', color:'#F7B731' },
              { label:'Efficiency', value:'94.2%', color:'#00BCF2' },
              { label:'Uptime', value:'99.99%', color:'#00B050' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize:'20px', fontWeight:800, color:s.color, fontFamily:"'Space Grotesk',sans-serif" }}>{s.value}</div>
                <div style={{ fontSize:'10px', color:'#3D5A80', marginTop:'2px' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:'16px', height:'3px', borderRadius:'2px', background:'rgba(0,120,212,0.1)', overflow:'hidden' }}>
            <div style={{ height:'100%', width:'72%', background:'linear-gradient(90deg,#0078D4,#00BCF2)', borderRadius:'2px' }} />
          </div>
          <div style={{ fontSize:'10px', color:'#3D5A80', marginTop:'6px' }}>72% cost reduction target achieved</div>
        </div>

        {/* Feature list */}
        <div style={{ marginTop:'2.5rem', display:'flex', flexDirection:'column', gap:'12px' }}>
          {[
            { icon:'💰', text:'Up to 40% infrastructure cost reduction' },
            { icon:'🤖', text:'Autonomous ML-powered scaling engine' },
            { icon:'🔒', text:'Enterprise-grade RBAC & JWT security' },
          ].map(f => (
            <div key={f.text} style={{ display:'flex', alignItems:'center', gap:'12px' }}>
              <div style={{ width:'30px', height:'30px', borderRadius:'8px', background:'rgba(0,120,212,0.1)', border:'1px solid rgba(0,120,212,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.85rem', flexShrink:0 }}>{f.icon}</div>
              <span style={{ color:'#3D5A80', fontSize:'0.875rem' }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL — Form ── */}
      <div style={{ width:'480px', minWidth:'480px', display:'flex', alignItems:'center', justifyContent:'center', padding:'3rem', borderLeft:'1px solid rgba(0,120,212,0.08)', background:'rgba(4,18,38,0.6)', backdropFilter:'blur(20px)', position:'relative', zIndex:1 }}>
        <div style={{ width:'100%', animation:'fadeIn 0.4s ease' }}>
          <h2 style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'1.75rem', color:'#E8F0FE', marginBottom:'0.4rem' }}>Welcome back</h2>
          <p style={{ color:'#3D5A80', fontSize:'0.9rem', marginBottom:'2rem' }}>Sign in to your CloudMind account</p>

          {error && (
            <div style={{ background:'rgba(229,62,62,0.08)', border:'1px solid rgba(229,62,62,0.25)', borderRadius:'10px', padding:'12px 16px', marginBottom:'1.5rem', display:'flex', alignItems:'center', gap:'10px', color:'#FC8181', fontSize:'0.875rem' }}>
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'1.1rem' }}>
            <div>
              <label>Username</label>
              <input id="login-username" type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="your_username" required autoComplete="username" />
            </div>
            <div>
              <label>Password</label>
              <div style={{ position:'relative' }}>
                <input id="login-password" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" style={{ paddingRight:'44px' }} />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#3D5A80', fontSize:'1rem' }}>{showPw ? '🙈' : '👁'}</button>
              </div>
            </div>

            <button id="login-submit" type="submit" disabled={loading} style={{ marginTop:'0.5rem', padding:'13px', borderRadius:'10px', border:'none', background: loading ? 'rgba(0,120,212,0.3)' : 'linear-gradient(135deg,#0078D4 0%,#00BCF2 100%)', color:'#fff', fontSize:'0.95rem', fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 4px 20px rgba(0,120,212,0.4),0 2px 8px rgba(0,0,0,0.3)', transition:'all 0.2s', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', fontFamily:"'Inter',sans-serif" }}>
              {loading ? (<><div style={{ width:'16px', height:'16px', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />Signing in…</>) : '→  Sign In'}
            </button>
          </form>

          {/* Demo credentials */}
          <div style={{ marginTop:'1.5rem', padding:'14px 16px', borderRadius:'10px', background:'rgba(0,120,212,0.06)', border:'1px solid rgba(0,120,212,0.15)' }}>
            <div style={{ fontSize:'10px', color:'#3D5A80', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>Demo Credentials</div>
            <div style={{ display:'flex', gap:'20px' }}>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'12px', color:'#5BA7E0' }}>user: <strong>admin</strong></span>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'12px', color:'#5BA7E0' }}>pass: <strong>Adm!n_Secure99</strong></span>
            </div>
          </div>

          {/* Gold savings badge */}
          <div style={{ marginTop:'1rem', padding:'10px 14px', borderRadius:'10px', background:'rgba(247,183,49,0.06)', border:'1px solid rgba(247,183,49,0.15)', display:'flex', alignItems:'center', gap:'10px' }}>
            <span style={{ fontSize:'1.1rem' }}>💰</span>
            <span style={{ fontSize:'12px', color:'#C9920A' }}>Join 2,400+ teams saving an avg <strong style={{ color:'#F7B731' }}>$9,200/mo</strong></span>
          </div>

          <p style={{ textAlign:'center', color:'#1E3A5F', fontSize:'0.875rem', marginTop:'1.5rem' }}>
            No account?{' '}
            <Link href="/auth/register" style={{ color:'#0078D4', fontWeight:600, textDecoration:'none' }}>Create one free →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
