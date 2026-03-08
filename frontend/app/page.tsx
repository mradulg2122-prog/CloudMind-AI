'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import CurrentSnapshot from '@/components/CurrentSnapshot';
import PredictionResults from '@/components/PredictionResults';
import ScalingDecisionPanel from '@/components/ScalingDecisionPanel';
import InfrastructureTopology from '@/components/InfrastructureTopology';
import PerformanceAnalytics from '@/components/PerformanceAnalytics';
import TopStatusBar from '@/components/TopStatusBar';
import AlertPanel from '@/components/AlertPanel';
import { TelemetryInput, PredictionOutput, runPrediction, checkHealth } from '@/lib/api';
import { useSimulation } from '@/hooks/useSimulation';
import { useAlerts } from '@/hooks/useAlerts';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

const now = new Date();

const DEFAULT_TELEMETRY: TelemetryInput = {
  requests_per_minute: 850,
  cpu_usage_percent: 70,
  memory_usage_percent: 65,
  active_servers: 4,
  hour: now.getHours(),
  minute: now.getMinutes(),
  response_time_ms: 120,
  cost_per_server: 50,
};

export default function DashboardPage() {
  const [telemetry, setTelemetry] = useState<TelemetryInput>(DEFAULT_TELEMETRY);
  const [prediction, setPrediction] = useState<PredictionOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendAlive, setBackendAlive] = useState<boolean | null>(null);
  const [lastPredicted, setLastPredicted] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Real-time simulation hook
  const simHistory = useSimulation({
    baseTraffic: telemetry.requests_per_minute,
    baseCpu: telemetry.cpu_usage_percent,
    baseMemory: telemetry.memory_usage_percent,
    enabled: true,
  });

  // Alert system
  const { alerts, dismiss } = useAlerts(telemetry, prediction);

  // Health check on mount
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
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [telemetry]);

  // Auto-refresh
  useAutoRefresh(handlePredict, autoRefresh, 8000);

  const hourlyCost = telemetry.active_servers * telemetry.cost_per_server;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #0f172a 0%, #1a1f3a 50%, #0d1425 100%)',
      }}
    >
      {/* ── Top Status Bar ─────────────────────────────────────────── */}
      <TopStatusBar backendAlive={backendAlive} />

      {/* ── Alert Panel (floating overlay) ─────────────────────────── */}
      <AlertPanel alerts={alerts} onDismiss={dismiss} />

      {/* ── Body: Sidebar + Main ─────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          telemetry={telemetry}
          onChange={setTelemetry}
          onPredict={handlePredict}
          loading={loading}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={() => setAutoRefresh((v) => !v)}
        />

        {/* ── Main content ──────────────────────────────────────────── */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '2.5rem 2.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '2.5rem',
          }}
        >
          {/* ── Current Snapshot ─────────────────────────────────────── */}
          <CurrentSnapshot telemetry={telemetry} hourlyCost={hourlyCost} />

          {/* ── Error banner ─────────────────────────────────────────── */}
          {error && (
            <div
              style={{
                borderRadius: '14px',
                padding: '1.25rem 1.5rem',
                border: '1px solid rgba(239,68,68,0.4)',
                background: 'rgba(239,68,68,0.08)',
                color: '#fca5a5',
                fontSize: '0.875rem',
                lineHeight: 1.6,
              }}
            >
              ❌{' '}
              {error.includes('fetch') || error.includes('Failed') || error.includes('connect')
                ? 'Cannot connect to backend. Make sure FastAPI is running on port 8000.'
                : error}
            </div>
          )}

          {/* ── Prediction sections or placeholder ───────────────────── */}
          {prediction ? (
            <>
              <PredictionResults prediction={prediction} telemetry={telemetry} hourlyCost={hourlyCost} />
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
              {/* Show performance analytics with sim data even before first prediction */}
              {simHistory.length >= 5 && (
                <div>
                  <div
                    style={{
                      borderRadius: '14px',
                      padding: '1rem 1.5rem',
                      border: '1px solid rgba(59,130,246,0.2)',
                      background: 'rgba(59,130,246,0.05)',
                      color: '#93c5fd',
                      fontSize: '0.82rem',
                      marginBottom: '-1rem',
                      fontFamily: "'Space Mono', monospace",
                    }}
                  >
                    📡 Live telemetry simulation active — click <strong>RUN PREDICTION</strong> to get ML forecast
                  </div>
                </div>
              )}

              <div
                style={{
                  borderRadius: '18px',
                  padding: '4rem 2rem',
                  textAlign: 'center',
                  border: '1px dashed rgba(30,58,95,0.8)',
                }}
              >
                <div style={{ fontSize: '3.5rem', marginBottom: '1.25rem' }}>🔮</div>
                <div
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: '0.9rem',
                    color: '#334155',
                    lineHeight: 1.8,
                  }}
                >
                  Adjust telemetry values in the sidebar
                  <br />
                  and press{' '}
                  <strong style={{ color: '#3b82f6' }}>RUN PREDICTION</strong> to forecast workload
                </div>
              </div>
            </>
          )}

          {/* ── Timestamp ─────────────────────────────────────────────── */}
          {lastPredicted && (
            <p
              style={{
                textAlign: 'right',
                fontFamily: "'Space Mono', monospace",
                fontSize: '0.7rem',
                color: '#334155',
                marginTop: '-1rem',
              }}
            >
              Last prediction: {lastPredicted}
              {autoRefresh && <span style={{ color: '#4ade80', marginLeft: '0.5rem' }}>· Auto-refresh ON</span>}
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
