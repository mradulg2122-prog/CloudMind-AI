'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { registerUser, loginUser } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username:'', email:'', password:'', confirm:'' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [success, setSuccess] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const onChange = (f:keyof typeof form) => (e:React.ChangeEvent<HTMLInputElement>) => setForm(p=>({...p,[f]:e.target.value}));

  const pwStrength = (() => {
    const p = form.password; if(!p) return 0; let s=0;
    if(p.length>=8) s++; if(/[A-Z]/.test(p)) s++; if(/[0-9]/.test(p)) s++; if(/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();
  const strengthMeta = [
    {label:'',color:'transparent'},
    {label:'Weak',color:'#E53E3E'},
    {label:'Fair',color:'#F6AD55'},
    {label:'Good',color:'#00BCF2'},
    {label:'Strong',color:'#00B050'},
  ][pwStrength];

  async function handleSubmit(e:FormEvent) {
    e.preventDefault(); setError(null);
    if(form.password!==form.confirm){setError('Passwords do not match.');return;}
    if(form.password.length<8){setError('Password must be at least 8 characters.');return;}
    setLoading(true);
    try {
      await registerUser(form.username,form.email,form.password);
      setSuccess(true);
      await loginUser(form.username,form.password);
      setTimeout(()=>router.push('/dashboard'),900);
    } catch(err:unknown) {
      setError((err as Error).message??'Registration failed. Please try again.');
      setSuccess(false);
    } finally { setLoading(false); }
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',background:'#020B18',fontFamily:"'Inter',sans-serif",position:'relative',overflow:'hidden'}}>
      {/* Grid background */}
      <div style={{position:'absolute',inset:0,pointerEvents:'none',backgroundImage:'linear-gradient(rgba(0,120,212,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,120,212,0.04) 1px,transparent 1px)',backgroundSize:'60px 60px',zIndex:0}}/>
      {/* Glows */}
      <div style={{position:'absolute',top:'-20%',right:'-5%',width:'600px',height:'600px',borderRadius:'50%',background:'radial-gradient(circle,rgba(0,120,212,0.08) 0%,transparent 70%)',pointerEvents:'none',zIndex:0}}/>
      <div style={{position:'absolute',bottom:'-20%',left:'-5%',width:'400px',height:'400px',borderRadius:'50%',background:'radial-gradient(circle,rgba(247,183,49,0.05) 0%,transparent 70%)',pointerEvents:'none',zIndex:0}}/>

      {/* ── LEFT PANEL ── */}
      <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',padding:'4rem 4rem 4rem 5rem',position:'relative',zIndex:1}}>
        {/* Logo */}
        <div style={{display:'flex',alignItems:'center',gap:'14px',marginBottom:'3rem'}}>
          <div style={{width:'46px',height:'46px',borderRadius:'12px',background:'linear-gradient(135deg,#0078D4 0%,#00BCF2 100%)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.4rem',boxShadow:'0 0 28px rgba(0,120,212,0.6),0 4px 12px rgba(0,0,0,0.4)'}}>☁</div>
          <div>
            <div style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:'1.15rem',background:'linear-gradient(135deg,#5BA7E0 0%,#00BCF2 40%,#F7B731 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>CloudMind AI</div>
            <div style={{fontSize:'0.7rem',color:'#3D5A80',letterSpacing:'0.3px'}}>Cloud Cost Intelligence Platform</div>
          </div>
        </div>

        <h1 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:'2.8rem',fontWeight:800,color:'#E8F0FE',lineHeight:1.1,marginBottom:'1rem'}}>
          Start Saving<br/>
          <span style={{background:'linear-gradient(135deg,#5BA7E0 0%,#00BCF2 40%,#F7B731 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>From Day One</span>
        </h1>
        <p style={{color:'#3D5A80',fontSize:'1rem',lineHeight:1.7,maxWidth:'400px',marginBottom:'3rem'}}>
          Set up in under 2 minutes. Our AI starts analyzing your workload patterns immediately and surfaces cost-saving opportunities.
        </p>

        {/* 3D Savings projection card */}
        <div style={{
          display:'inline-block',padding:'22px 26px',
          background:'rgba(4,18,38,0.9)',border:'1px solid rgba(247,183,49,0.2)',
          borderRadius:'16px',maxWidth:'380px',
          boxShadow:'0 2px 4px rgba(0,0,0,0.5),0 8px 20px rgba(0,0,0,0.4),0 20px 40px rgba(0,0,0,0.3),0 0 0 1px rgba(247,183,49,0.06)',
          transform:'perspective(800px) rotateY(-4deg) rotateX(2deg)',
          backdropFilter:'blur(20px)',
        }}>
          <div style={{fontSize:'10px',fontWeight:700,color:'#C9920A',textTransform:'uppercase',letterSpacing:'0.7px',marginBottom:'14px'}}>💰 Estimated First-Month Savings</div>
          <div style={{fontSize:'2.5rem',fontWeight:800,fontFamily:"'Space Grotesk',sans-serif",background:'linear-gradient(135deg,#C9920A,#F7B731,#FFD770)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:'4px'}}>$8,400</div>
          <div style={{fontSize:'11px',color:'#3D5A80',marginBottom:'16px'}}>based on avg 4-server deployment</div>
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {[{label:'Idle resource elimination',pct:78},{label:'Right-sizing recommendations',pct:62},{label:'Auto-scaling optimization',pct:91}].map(r=>(
              <div key={r.label}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                  <span style={{fontSize:'10px',color:'#3D5A80'}}>{r.label}</span>
                  <span style={{fontSize:'10px',color:'#F7B731',fontWeight:600}}>{r.pct}%</span>
                </div>
                <div style={{height:'3px',background:'rgba(247,183,49,0.1)',borderRadius:'2px'}}>
                  <div style={{height:'100%',width:`${r.pct}%`,background:'linear-gradient(90deg,#C9920A,#F7B731)',borderRadius:'2px'}}/>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trust indicators */}
        <div style={{marginTop:'2.5rem',display:'flex',gap:'24px'}}>
          {[{num:'2,400+',label:'Teams'},{num:'$42M',label:'Saved'},{num:'99.99%',label:'Uptime'}].map(s=>(
            <div key={s.label}>
              <div style={{fontSize:'1.1rem',fontWeight:700,color:'#5BA7E0',fontFamily:"'Space Grotesk',sans-serif"}}>{s.num}</div>
              <div style={{fontSize:'10px',color:'#1E3A5F'}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL — Form ── */}
      <div style={{width:'500px',minWidth:'500px',display:'flex',alignItems:'center',justifyContent:'center',padding:'2.5rem',borderLeft:'1px solid rgba(0,120,212,0.08)',background:'rgba(4,18,38,0.6)',backdropFilter:'blur(20px)',position:'relative',zIndex:1,overflowY:'auto'}}>
        <div style={{width:'100%',animation:'fadeIn 0.4s ease'}}>
          <h2 style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:'1.6rem',color:'#E8F0FE',marginBottom:'0.3rem'}}>Create account</h2>
          <p style={{color:'#3D5A80',fontSize:'0.875rem',marginBottom:'1.75rem'}}>Start monitoring your infrastructure in seconds</p>

          {success && (
            <div style={{background:'rgba(0,176,80,0.08)',border:'1px solid rgba(0,176,80,0.25)',borderRadius:'10px',padding:'12px 16px',marginBottom:'1.25rem',color:'#4ADE80',fontSize:'0.875rem',display:'flex',alignItems:'center',gap:'8px'}}>
              ✅ Account created! Redirecting to dashboard…
            </div>
          )}
          {error && (
            <div style={{background:'rgba(229,62,62,0.08)',border:'1px solid rgba(229,62,62,0.25)',borderRadius:'10px',padding:'12px 16px',marginBottom:'1.25rem',color:'#FC8181',fontSize:'0.875rem',display:'flex',alignItems:'center',gap:'8px',animation:'fadeIn 0.2s ease'}}>
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:'0.9rem'}}>
            {/* Username + Email row */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
              <div>
                <label>Username</label>
                <input id="register-username" type="text" value={form.username} onChange={onChange('username')} placeholder="cloud_admin" required autoComplete="username"/>
              </div>
              <div>
                <label>Email</label>
                <input id="register-email" type="email" value={form.email} onChange={onChange('email')} placeholder="admin@company.com" required autoComplete="email"/>
              </div>
            </div>

            <div>
              <label>Password</label>
              <div style={{position:'relative'}}>
                <input id="register-password" type={showPw?'text':'password'} value={form.password} onChange={onChange('password')} placeholder="At least 8 characters" required minLength={8} autoComplete="new-password" style={{paddingRight:'44px'}}/>
                <button type="button" onClick={()=>setShowPw(v=>!v)} style={{position:'absolute',right:'12px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#3D5A80',fontSize:'1rem'}}>{showPw?'🙈':'👁'}</button>
              </div>
              {form.password && (
                <div style={{marginTop:'8px'}}>
                  <div style={{display:'flex',gap:'4px',marginBottom:'4px'}}>
                    {[1,2,3,4].map(i=>(
                      <div key={i} style={{height:'3px',flex:1,borderRadius:'2px',background:i<=pwStrength?strengthMeta.color:'rgba(0,120,212,0.08)',transition:'background 0.3s'}}/>
                    ))}
                  </div>
                  {strengthMeta.label && <span style={{fontSize:'10px',color:strengthMeta.color,fontWeight:600}}>{strengthMeta.label} password</span>}
                </div>
              )}
            </div>

            <div>
              <label>Confirm Password</label>
              <input id="register-confirm" type="password" value={form.confirm} onChange={onChange('confirm')} placeholder="Repeat your password" required autoComplete="new-password"
                style={{borderColor:form.confirm&&form.confirm!==form.password?'rgba(229,62,62,0.5)':undefined}}/>
              {form.confirm&&form.confirm!==form.password&&(
                <span style={{fontSize:'10px',color:'#FC8181',marginTop:'4px',display:'block'}}>Passwords don&apos;t match</span>
              )}
            </div>

            <button id="register-submit" type="submit" disabled={loading||success} style={{marginTop:'0.4rem',padding:'13px',borderRadius:'10px',border:'none',background:(loading||success)?'rgba(0,120,212,0.25)':'linear-gradient(135deg,#0078D4 0%,#00BCF2 100%)',color:'#fff',fontSize:'0.95rem',fontWeight:700,cursor:(loading||success)?'not-allowed':'pointer',boxShadow:(loading||success)?'none':'0 4px 20px rgba(0,120,212,0.4),0 2px 8px rgba(0,0,0,0.3)',transition:'all 0.2s',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',fontFamily:"'Inter',sans-serif"}}>
              {loading?(<><div style={{width:'16px',height:'16px',border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>Creating account…</>):'→  Create Account'}
            </button>
          </form>

          {/* Savings CTA */}
          <div style={{marginTop:'1rem',padding:'12px 16px',borderRadius:'10px',background:'rgba(247,183,49,0.06)',border:'1px solid rgba(247,183,49,0.15)',display:'flex',alignItems:'center',gap:'10px'}}>
            <span style={{fontSize:'1.1rem'}}>💰</span>
            <span style={{fontSize:'12px',color:'#C9920A'}}>Free plan includes <strong style={{color:'#F7B731'}}>$5,000/mo</strong> savings analysis — no credit card needed</span>
          </div>

          <p style={{textAlign:'center',color:'#1E3A5F',fontSize:'0.875rem',marginTop:'1.25rem'}}>
            Already have an account?{' '}
            <Link href="/auth/login" style={{color:'#0078D4',fontWeight:600,textDecoration:'none'}}>Sign in →</Link>
          </p>

          {/* Feature strip */}
          <div style={{display:'flex',justifyContent:'space-between',marginTop:'1.25rem',paddingTop:'1rem',borderTop:'1px solid rgba(0,120,212,0.08)'}}>
            {['ML Forecasting','Auto Scaling','Cost Reports','RBAC Security'].map(f=>(
              <div key={f} style={{display:'flex',alignItems:'center',gap:'4px'}}>
                <span style={{color:'#0078D4',fontSize:'10px',fontWeight:700}}>✓</span>
                <span style={{fontSize:'10px',color:'#1E3A5F'}}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
