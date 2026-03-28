'use client';
// =============================================================================
// CloudMind AI – app/dashboard/predict/page.tsx (v4)
// Two-column ML prediction UI — inputs left, results right
// =============================================================================

import { useState, useCallback } from 'react';
import { runPrediction, TelemetryInput, PredictionOutput } from '@/lib/api';
import { useToast } from '@/lib/toast';

const DEFAULT: TelemetryInput = {
  requests_per_minute:  850,
  cpu_usage_percent:     70,
  memory_usage_percent:  65,
  active_servers:         4,
  hour:       new Date().getHours(),
  minute:     new Date().getMinutes(),
  response_time_ms:     120,
  cost_per_server:       50,
};

// ── Slider field ──────────────────────────────────────────────────────────────
function SliderField({ label, name, value, min, max, step = 1, unit, desc, onChange }: {
  label: string; name: string; value: number; min: number; max: number;
  step?: number; unit?: string; desc?: string; onChange: (n: string, v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const dangerZone = pct > 80;
  const warnZone   = pct > 60 && !dangerZone;
  const color = dangerZone ? 'var(--danger)' : warnZone ? 'var(--warning)' : 'var(--primary)';

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</span>
          {desc && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{desc}</div>}
        </div>
        <span style={{
          background: `${color}15`, color, fontWeight: 800, fontSize: 13,
          padding: '3px 12px', borderRadius: 'var(--radius-full)', border: `1px solid ${color}30`,
          minWidth: 64, textAlign: 'center',
        }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range" className="input" min={min} max={max} step={step} value={value}
        onChange={e => onChange(name, Number(e.target.value))}
        style={{ accentColor: color, width: '100%' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
        <span>{min}{unit}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <div style={{ height: 4, width: 60, borderRadius: 10, background: `linear-gradient(90deg, var(--success), var(--warning), var(--danger))`, opacity: 0.5 }} />
        </div>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

// ── Result metric card ────────────────────────────────────────────────────────
function ResultMetric({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div style={{
      background: 'var(--surface-2)', borderRadius: 'var(--radius-md)',
      padding: '14px 18px', border: `1px solid ${color}25`,
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 900, color, letterSpacing: '-0.01em' }}>{value}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function PredictPage() {
  const { toast } = useToast();
  const [form,    setForm]    = useState<TelemetryInput>(DEFAULT);
  const [result,  setResult]  = useState<PredictionOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [runCount, setRunCount] = useState(0);

  const handleChange = useCallback((name: string, value: number) => {
    setForm(f => ({ ...f, [name]: value }));
  }, []);

  const handlePredict = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await runPrediction(form);
      setResult(res);
      setRunCount(c => c + 1);
      toast('✓ Prediction completed successfully', 'success');
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? 'Prediction failed. Check backend connection.';
      setError(msg);
      toast(msg, 'error');
    } finally { setLoading(false); }
  }, [form, toast]);

  const currentCost  = form.active_servers * form.cost_per_server;
  const resultColor  = result?.action === 'SCALE UP' ? '#2563eb' : result?.action === 'SCALE DOWN' ? '#22c55e' : '#f59e0b';
  const actionIcon   = result?.action === 'SCALE UP' ? '🚀' : result?.action === 'SCALE DOWN' ? '📉' : '✅';
  const actionDesc   = result?.action === 'SCALE UP' ? 'Increase server fleet to handle predicted traffic spike' :
                       result?.action === 'SCALE DOWN' ? 'Reduce servers to save cost — traffic load is dropping' :
                       'Current fleet size is optimal for predicted workload';

  return (
    <div className="animate-fade">
      {/* ── Header ── */}
      <div className="section-header">
        <div>
          <div className="page-title">Run Prediction</div>
          <div className="section-sub">Configure telemetry inputs and get an ML-powered scaling recommendation</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {runCount > 0 && <span className="badge badge-green">✓ {runCount} prediction{runCount > 1 ? 's' : ''} run</span>}
          <span className="badge badge-blue">🤖 Random Forest v3 · 39 features</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── LEFT: Input Form ── */}
        <div className="card card-p" style={{ position: 'sticky', top: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📡</span> Telemetry Input Parameters
          </div>

          <SliderField label="Requests / Minute"   name="requests_per_minute"  value={form.requests_per_minute}  min={0}   max={2000} unit=" rpm" desc="Incoming request rate"   onChange={handleChange} />
          <SliderField label="CPU Usage"           name="cpu_usage_percent"    value={form.cpu_usage_percent}    min={0}   max={100}  unit="%"   desc="Current CPU utilisation" onChange={handleChange} />
          <SliderField label="Memory Usage"        name="memory_usage_percent" value={form.memory_usage_percent} min={0}   max={100}  unit="%"   desc="RAM utilisation"        onChange={handleChange} />
          <SliderField label="Active Servers"      name="active_servers"       value={form.active_servers}       min={1}   max={50}   unit=""    desc="Current fleet size"      onChange={handleChange} />
          <SliderField label="Response Time"       name="response_time_ms"     value={form.response_time_ms}     min={10}  max={5000} unit=" ms" desc=">150ms = high latency flag" onChange={handleChange} />
          <SliderField label="Cost / Server / Hr"  name="cost_per_server"      value={form.cost_per_server}      min={1}   max={500}  unit="$"   desc="Cloud instance cost"     onChange={handleChange} />

          {/* Time fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
            <div>
              <label>Hour (0–23)</label>
              <input type="number" className="input" min={0} max={23} value={form.hour}
                onChange={e => handleChange('hour', Math.max(0, Math.min(23, Number(e.target.value))))} />
            </div>
            <div>
              <label>Minute (0–59)</label>
              <input type="number" className="input" min={0} max={59} value={form.minute}
                onChange={e => handleChange('minute', Math.max(0, Math.min(59, Number(e.target.value))))} />
            </div>
          </div>

          {/* Cost preview */}
          <div style={{ background: 'var(--surface-3)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Current Hourly Cost</span>
            <span style={{ fontWeight: 900, fontSize: 20, color: 'var(--warning)' }}>${currentCost.toFixed(0)}/hr</span>
          </div>

          {/* Run button */}
          <button
            id="run-prediction-btn"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', fontSize: 15, letterSpacing: '0.01em' }}
            onClick={handlePredict}
            disabled={loading}
          >
            {loading ? (
              <><div className="spinner" style={{ width: 18, height: 18 }} /> Running prediction…</>
            ) : '⚡ Run Prediction'}
          </button>

          <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center' }}>
            Powered by Random Forest · 39-feature ML model
          </div>
        </div>

        {/* ── RIGHT: Results Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Error */}
          {error && (
            <div style={{ background: 'var(--danger-muted)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', color: 'var(--danger)', fontSize: 13, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20 }}>⚠</span>
              <div><strong>Prediction Failed</strong><br />{error}</div>
            </div>
          )}

          {/* Result */}
          {result ? (
            <div className="animate-scale">
              {/* Action banner */}
              <div style={{
                background: `${resultColor}0d`,
                border: `1px solid ${resultColor}30`,
                borderRadius: 'var(--radius-xl)', padding: '24px 28px', marginBottom: 20,
                display: 'flex', alignItems: 'center', gap: 20,
                boxShadow: `0 4px 20px ${resultColor}12`,
              }}>
                <div style={{ fontSize: 52, lineHeight: 1 }}>{actionIcon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: resultColor, marginBottom: 6 }}>Scaling Recommendation</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 6 }}>{result.action}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{actionDesc}</div>
                </div>
                <div style={{ background: `${resultColor}15`, border: `1px solid ${resultColor}30`, borderRadius: 'var(--radius-lg)', padding: '14px 20px', textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: resultColor, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Confidence</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)' }}>High</div>
                </div>
              </div>

              {/* Result metric cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                <ResultMetric icon="📡" label="Predicted Traffic"   value={`${Math.round(result.predicted_requests).toLocaleString()} rpm`} color="#2563eb" />
                <ResultMetric icon="🖥" label="Recommended Servers" value={`${result.recommended_servers} servers`} color={result.action === 'SCALE UP' ? '#2563eb' : '#22c55e'} />
                <ResultMetric icon="⚡" label="Load per Server"     value={`${Math.round(result.load_per_server)} rpm`} color="#f59e0b" />
                <ResultMetric icon="💰" label="New Est. Cost"       value={`$${(result.recommended_servers * form.cost_per_server).toFixed(0)}/hr`} color={result.recommended_servers < form.active_servers ? '#22c55e' : '#2563eb'} />
              </div>

              {/* Cost delta table */}
              <div className="card card-p">
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  💸 Cost Impact Analysis
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  {[
                    { label: 'Current',     val: `${form.active_servers} servers`,    sub: `$${currentCost}/hr`, hi: false, color: undefined },
                    { label: 'Recommended', val: `${result.recommended_servers} servers`, sub: `$${result.recommended_servers * form.cost_per_server}/hr`, hi: true, color: resultColor },
                    {
                      label: 'Δ Saving',
                      val: `${form.active_servers - result.recommended_servers > 0 ? '+' : ''}${form.active_servers - result.recommended_servers} srv`,
                      sub: `$${Math.abs((form.active_servers - result.recommended_servers) * form.cost_per_server)}/hr`,
                      hi: false,
                      color: (form.active_servers - result.recommended_servers) > 0 ? 'var(--success)' : 'var(--danger)',
                    },
                  ].map(({ label, val, sub, hi, color }) => (
                    <div key={label} style={{
                      background: hi ? `${resultColor}0d` : 'var(--surface-3)',
                      borderRadius: 'var(--radius-md)', padding: '16px 14px', textAlign: 'center',
                      border: hi ? `1px solid ${resultColor}30` : '1px solid var(--border)',
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>{label}</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: color ?? (hi ? resultColor : 'var(--text-primary)'), marginBottom: 4 }}>{val}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Empty placeholder */
            <div className="empty-state" style={{ minHeight: 440 }}>
              <div style={{ fontSize: 64, marginBottom: 20 }}>🔮</div>
              <div className="empty-title">No prediction yet</div>
              <div className="empty-sub">
                Configure the telemetry parameters on the left and click<br />
                <strong style={{ color: 'var(--primary)' }}>⚡ Run Prediction</strong> to see the ML recommendation here
              </div>
              <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, maxWidth: 380, margin: '24px auto 0' }}>
                {[['🚀', 'SCALE UP', '#2563eb'], ['📉', 'SCALE DOWN', '#22c55e'], ['✅', 'KEEP SAME', '#f59e0b']].map(([icon, label, color]) => (
                  <div key={label as string} style={{ background: `${color as string}10`, borderRadius: 'var(--radius-md)', padding: '12px 8px', textAlign: 'center', border: `1px solid ${color as string}25` }}>
                    <div style={{ fontSize: 22 }}>{icon}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: color as string, marginTop: 5, letterSpacing: '0.04em' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
