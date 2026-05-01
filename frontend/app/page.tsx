'use client';

// =============================================================================
// CloudMind AI – app/page.tsx  (v3)
//
// Enhancements over v2:
//   ✅ AdvancedAnalytics section — analytics, export, retrain trigger
//   ✅ All v2 features preserved (auth, history charts, etc.)
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import Sidebar                from '@/components/Sidebar';
import CurrentSnapshot        from '@/components/CurrentSnapshot';
import PredictionResults      from '@/components/PredictionResults';
import ScalingDecisionPanel   from '@/components/ScalingDecisionPanel';
import InfrastructureTopology from '@/components/InfrastructureTopology';
import PerformanceAnalytics   from '@/components/PerformanceAnalytics';
import TopStatusBar           from '@/components/TopStatusBar';
import AlertPanel             from '@/components/AlertPanel';
import HistoricalCharts       from '@/components/HistoricalCharts';
import AdvancedAnalytics      from '@/components/AdvancedAnalytics';

import { TelemetryInput, PredictionOutput, runPrediction, checkHealth, isLoggedIn } from '@/lib/api';
import { useSimulation }  from '@/hooks/useSimulation';
import { useAlerts }      from '@/hooks/useAlerts';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { useAuth }        from '@/hooks/useAuth';

const now = new Date();

const DEFAULT_TELEMETRY: TelemetryInput = {
  requests_per_minute  : 850,
  cpu_usage_percent    : 70,
  memory_usage_percent : 65,
  active_servers       : 4,
  hour                 : now.getHours(),
  minute               : now.getMinutes(),
  response_time_ms     : 120,
  cost_per_server      : 50,
};

export default function DashboardPage() {
  const router = useRouter();

  // ── Auth state ─────────────────────────────────────────────────────────────
  const { user, loading: authLoading, logout } = useAuth();

  // ── Dashboard state ────────────────────────────────────────────────────────
  const [telemetry,   setTelemetry]   = useState<TelemetryInput>(DEFAULT_TELEMETRY);
  const [prediction,  setPrediction]  = useState<PredictionOutput | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [backendAlive,setBackendAlive]= useState<boolean | null>(null);
  const [lastPredicted,setLastPredicted] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  // Controls whether the history panel and analytics panel are visible
  const [showHistory,   setShowHistory]   = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // ── Real-time simulation hook ──────────────────────────────────────────────
  const simHistory = useSimulation({
    baseTraffic : telemetry.requests_per_minute,
    baseCpu     : telemetry.cpu_usage_percent,
    baseMemory  : telemetry.memory_usage_percent,
    enabled     : true,
  });

  // ── Alert system ───────────────────────────────────────────────────────────
  const { alerts, dismiss } = useAlerts(telemetry, prediction);

  // ── Redirect to login if not authenticated ─────────────────────────────────
  useEffect(() => {
    if (!authLoading && !isLoggedIn()) {
      router.push('/auth/login');
    }
  }, [authLoading, router]);

  // ── Health check on mount ──────────────────────────────────────────────────
  useEffect(() => {
    checkHealth()
      .then(() => setBackendAlive(true))
      .catch(() => setBackendAlive(false));
  }, []);

  const handlePredict = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await runPrediction(telemetry);
      setPrediction(result);
      setLastPredicted(new Date().toLocaleString());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      // If 401, redirect to login
      if ((e as { response?: { status?: number } })?.response?.status === 401) {
        logout();
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [telemetry, logout]);

  // ── Auto-refresh ───────────────────────────────────────────────────────────
  useAutoRefresh(handlePredict, autoRefresh, 8000);

  const hourlyCost = telemetry.active_servers * telemetry.cost_per_server;

  // While auth is still loading, show a minimal spinner
  if (authLoading) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#020B18', color:'#3D5A80', fontFamily:"'Inter',sans-serif", fontSize:'0.9rem', gap:12, flexDirection:'column' }}>
        <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:'linear-gradient(135deg,#0078D4 0%,#00BCF2 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.3rem', boxShadow:'0 0 24px rgba(0,120,212,0.5)', marginBottom:'8px' }}>☁</div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:18, height:18, border:'2px solid rgba(0,120,212,0.2)', borderTopColor:'#0078D4', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
          Verifying session…
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', background:'#020B18', position:'relative' }}>
      {/* Ambient grid */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', backgroundImage:'linear-gradient(rgba(0,120,212,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,120,212,0.03) 1px,transparent 1px)', backgroundSize:'60px 60px', zIndex:0 }} />
      {/* Glow orbs */}
      <div style={{ position:'fixed', top:'-15%', left:'-5%', width:'600px', height:'600px', borderRadius:'50%', background:'radial-gradient(circle,rgba(0,120,212,0.06) 0%,transparent 70%)', pointerEvents:'none', zIndex:0 }} />
      <div style={{ position:'fixed', bottom:'-15%', right:'-5%', width:'500px', height:'500px', borderRadius:'50%', background:'radial-gradient(circle,rgba(247,183,49,0.04) 0%,transparent 70%)', pointerEvents:'none', zIndex:0 }} />
      {/* ── Top Status Bar (now includes UserMenu) ─────────────────────── */}
      <TopStatusBar
        backendAlive={backendAlive}
        user={user}
        authLoading={authLoading}
        onLogout={logout}
      />

      {/* ── Alert Panel (floating overlay) ────────────────────────────── */}
      <AlertPanel alerts={alerts} onDismiss={dismiss} />

      {/* ── Body: Sidebar + Main ──────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          telemetry={telemetry}
          onChange={setTelemetry}
          onPredict={handlePredict}
          loading={loading}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={() => setAutoRefresh((v) => !v)}
        />

        {/* ── Main content ── */}
        <main style={{ flex:1, overflowY:'auto', padding:'28px 32px', display:'flex', flexDirection:'column', gap:'28px', position:'relative', zIndex:1 }}>
          {/* ── Current Snapshot ──────────────────────────────────── */}
          <CurrentSnapshot telemetry={telemetry} hourlyCost={hourlyCost} />

          {/* ── Error banner ──────────────────────────────────────── */}
          {error && (
            <div style={{ borderRadius:'12px', padding:'14px 18px', border:'1px solid rgba(229,62,62,0.3)', background:'rgba(229,62,62,0.06)', color:'#FC8181', fontSize:'13px', display:'flex', alignItems:'center', gap:'10px', backdropFilter:'blur(12px)' }}>
              <span style={{ fontSize:'1rem' }}>⚠</span>
              {error.includes('fetch')||error.includes('Failed')||error.includes('connect') ? 'Cannot connect to backend. Make sure FastAPI is running on port 8000.' : error}
            </div>
          )}

          {/* ── Prediction sections or placeholder ────────────────── */}
          {prediction ? (
            <>
              <PredictionResults  prediction={prediction} telemetry={telemetry} hourlyCost={hourlyCost} />
              <ScalingDecisionPanel prediction={prediction} telemetry={telemetry} hourlyCost={hourlyCost} />
              <InfrastructureTopology
                recommendedServers={prediction.recommended_servers}
                cpuUsage={telemetry.cpu_usage_percent}
                action={prediction.action}
              />
              <PerformanceAnalytics telemetry={telemetry} prediction={prediction} history={simHistory} />
            </>
          ) : (
            <>
              {simHistory.length >= 5 && (
                <div style={{ padding:'12px 18px', borderRadius:'10px', border:'1px solid rgba(0,120,212,0.15)', background:'rgba(0,120,212,0.04)', color:'#3D5A80', fontSize:'12px', fontFamily:"'JetBrains Mono',monospace", display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#00B050', animation:'livePulse 2s ease infinite', flexShrink:0 }} />
                  Live telemetry simulation active — click <strong style={{ color:'#5BA7E0' }}>Run Prediction</strong> to get ML forecast
                </div>
              )}
              <div style={{ borderRadius:'16px', padding:'64px 40px', textAlign:'center', border:'1px dashed rgba(0,120,212,0.12)', background:'rgba(4,18,38,0.4)', backdropFilter:'blur(12px)' }}>
                <div style={{ fontSize:'3.5rem', marginBottom:'16px', filter:'drop-shadow(0 0 20px rgba(0,120,212,0.4))' }}>🔮</div>
                <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'18px', fontWeight:700, color:'#E8F0FE', marginBottom:'8px' }}>Ready to Forecast</div>
                <div style={{ fontSize:'13px', color:'#1E3A5F', lineHeight:1.7, maxWidth:'360px', margin:'0 auto' }}>
                  Adjust telemetry values in the sidebar and press{' '}
                  <strong style={{ color:'#0078D4' }}>Run Prediction</strong> to get your AI workload forecast
                </div>
              </div>
            </>
          )}

          {/* ── Historical Charts toggle ── */}
          <div>
            <button id="toggle-history-btn" onClick={() => setShowHistory(v=>!v)}
              style={{ display:'flex', alignItems:'center', gap:8, background:'transparent', border:'1px solid rgba(0,120,212,0.15)', borderRadius:8, color:'#3D5A80', fontSize:'12px', fontFamily:"'JetBrains Mono',monospace", padding:'8px 14px', cursor:'pointer', marginBottom: showHistory?'14px':0, transition:'all 0.2s' }}
              onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='rgba(0,120,212,0.4)';(e.currentTarget as HTMLButtonElement).style.color='#5BA7E0';}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='rgba(0,120,212,0.15)';(e.currentTarget as HTMLButtonElement).style.color='#3D5A80';}}>
              {showHistory?'▲':'▼'}&nbsp;&nbsp;{showHistory?'Hide':'Show'} Historical Charts
            </button>
            {showHistory && <HistoricalCharts />}
          </div>

          {/* ── Advanced Analytics toggle ── */}
          <div>
            <button id="toggle-analytics-btn" onClick={() => setShowAnalytics(v=>!v)}
              style={{ display:'flex', alignItems:'center', gap:8, background:'transparent', border:'1px solid rgba(247,183,49,0.2)', borderRadius:8, color:'#C9920A', fontSize:'12px', fontFamily:"'JetBrains Mono',monospace", padding:'8px 14px', cursor:'pointer', marginBottom: showAnalytics?'14px':0, transition:'all 0.2s' }}
              onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='rgba(247,183,49,0.4)';(e.currentTarget as HTMLButtonElement).style.color='#F7B731';}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='rgba(247,183,49,0.2)';(e.currentTarget as HTMLButtonElement).style.color='#C9920A';}}>
              {showAnalytics?'▲':'▼'}&nbsp;&nbsp;{showAnalytics?'Hide':'Show'} Advanced Analytics &amp; Reports
            </button>
            {showAnalytics && (
              <div style={{ background:'rgba(4,18,38,0.6)', border:'1px solid rgba(247,183,49,0.12)', borderRadius:'14px', padding:'24px', backdropFilter:'blur(12px)' }}>
                <AdvancedAnalytics />
              </div>
            )}
          </div>

          {lastPredicted && (
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'10px', color:'#0D2040' }}>
                Last prediction: {lastPredicted}{autoRefresh && <span style={{ color:'#00B050', marginLeft:'8px' }}>· Auto-refresh ON</span>}
              </span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
