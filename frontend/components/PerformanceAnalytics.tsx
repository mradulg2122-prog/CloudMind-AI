'use client';

import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { TelemetryInput, PredictionOutput } from '@/lib/api';
import { SimDataPoint } from '@/hooks/useSimulation';

interface Props {
  telemetry: TelemetryInput;
  prediction: PredictionOutput;
  history: SimDataPoint[];
}

interface ChartPoint {
  time: string;
  traffic?: number;
  cpu?: number;
  memory?: number;
}

// Fallback synthetic data when simulation hasn't started yet
function generateFallback(current: number, predicted: number): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (let i = -9; i <= 5; i++) {
    const label = i < 0 ? `${Math.abs(i * 0.5)}m ago` : i === 0 ? 'now' : `+${i * 0.5}m`;
    const ratio = (i + 9) / 14;
    const noise = Math.sin(i * 1.7) * current * 0.05;
    const val = Math.round(current + (predicted - current) * Math.max(0, ratio) + noise);
    points.push({ time: label, traffic: val });
  }
  return points;
}

const tooltipStyle = {
  backgroundColor: 'rgba(15,23,42,0.97)',
  border: '1px solid rgba(59,130,246,0.3)',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '0.78rem',
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-5 border"
      style={{
        background: 'linear-gradient(135deg, rgba(17,24,39,0.9) 0%, rgba(15,23,42,0.7) 100%)',
        borderColor: 'rgba(59,130,246,0.2)',
      }}
    >
      <h3
        className="text-sm font-semibold mb-4"
        style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#e2e8f0' }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function PerformanceAnalytics({ telemetry, prediction, history }: Props) {
  // Use live history if available, else fallback
  const trafficData =
    history.length >= 5
      ? history.slice(-60).map((p, i) => ({
          time: i % 5 === 0 ? p.time : '',
          traffic: p.traffic,
          cpu: p.cpu,
          memory: p.memory,
        }))
      : generateFallback(telemetry.requests_per_minute, prediction.predicted_requests);

  const cpuData =
    history.length >= 5
      ? history.slice(-60).map((p, i) => ({
          time: i % 5 === 0 ? p.time : '',
          cpu: p.cpu,
        }))
      : [];

  const memoryData =
    history.length >= 5
      ? history.slice(-60).map((p, i) => ({
          time: i % 5 === 0 ? p.time : '',
          memory: p.memory,
        }))
      : [];

  return (
    <section>
      <div className="section-title">Performance Analytics</div>

      {/* Row 1: Traffic + CPU */}
      <div className="grid grid-cols-2 gap-4">
        <ChartCard title="📈 Traffic Over Time (Live)">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trafficData}>
              <defs>
                <linearGradient id="trafficGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,41,59,0.6)" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="traffic" name="Traffic (req/min)" stroke="#3b82f6" fill="url(#trafficGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="🖥️ CPU Utilization (Live)">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={cpuData.length > 0 ? cpuData : trafficData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,41,59,0.6)" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'CPU']} />
              <Line type="monotone" dataKey="cpu" name="CPU %" stroke="#f59e0b" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 2: Memory + Predicted vs Actual */}
      <div className="grid grid-cols-2 gap-4" style={{ marginTop: '1rem' }}>
        <ChartCard title="💾 Memory Utilization (Live)">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={memoryData.length > 0 ? memoryData : trafficData}>
              <defs>
                <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,41,59,0.6)" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'Memory']} />
              <Area type="monotone" dataKey="memory" name="Memory %" stroke="#8b5cf6" fill="url(#memGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="🔮 Predicted vs Actual Traffic">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trafficData}>
              <defs>
                <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,41,59,0.6)" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '0.72rem', color: '#94a3b8' }} />
              <Area type="monotone" dataKey="traffic" name="Actual" stroke="#3b82f6" fill="url(#trafficGrad2)" strokeWidth={2} dot={false} />
              <Line
                type="monotone"
                dataKey="traffic"
                name="ML Predicted"
                stroke="#06b6d4"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </section>
  );
}
