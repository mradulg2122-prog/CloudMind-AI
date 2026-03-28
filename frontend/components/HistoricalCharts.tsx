'use client';

// =============================================================================
// CloudMind AI – components/HistoricalCharts.tsx
//
// Displays three charts sourced from the database:
//   1. Predicted Requests over time (line chart)
//   2. Cost Trend — hourly cost per prediction
//   3. Server Usage — recommended_servers bar chart
//
// Data is fetched from GET /predictions/history (JWT-protected).
// =============================================================================

import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { fetchPredictionHistory, PredictionOutput } from '@/lib/api';

interface ChartPoint {
  index    : number;
  label    : string;
  requests : number;
  servers  : number;
  load     : number;
  cost     : number;  // estimated: servers × 50 $/hr
}

export default function HistoricalCharts() {
  const [data,    setData]    = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetchPredictionHistory(30)
      .then((records: PredictionOutput[]) => {
        // Reverse so latest is on the right
        const reversed = [...records].reverse();
        const points: ChartPoint[] = reversed.map((r, i) => ({
          index    : i + 1,
          label    : `#${i + 1}`,
          requests : Math.round(r.predicted_requests),
          servers  : r.recommended_servers,
          load     : Math.round(r.load_per_server),
          cost     : r.recommended_servers * 50,
        }));
        setData(points);
      })
      .catch(() => setError('Could not load prediction history.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} />;
  if (data.length === 0) return <EmptyState />;

  return (
    <div style={wrapperStyle}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>Historical Predictions</h2>
          <p style={subtitleStyle}>
            Last {data.length} predictions stored in database
          </p>
        </div>
        <div style={badgeStyle}>
          📊 {data.length} records
        </div>
      </div>

      {/* ── Grid of charts ─────────────────────────────────────────────── */}
      <div style={gridStyle}>

        {/* Chart 1 — Predicted Traffic (Area) */}
        <div style={chartCardStyle}>
          <div style={chartTitleStyle}>
            📈 Predicted Traffic
            <span style={chartUnitStyle}>req / min</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="trafficGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.08)" />
              <XAxis dataKey="label" tick={tickStyle} />
              <YAxis tick={tickStyle} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="requests"
                name="Predicted req/min"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#trafficGrad)"
                dot={false}
                activeDot={{ r: 5, fill: '#3b82f6' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2 — Cost Trend (Line) */}
        <div style={chartCardStyle}>
          <div style={chartTitleStyle}>
            💰 Cost Trend
            <span style={chartUnitStyle}>$ / hour</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="costGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%"   stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.08)" />
              <XAxis dataKey="label" tick={tickStyle} />
              <YAxis tick={tickStyle} unit="$" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`$${v}`, 'Cost/hr']} />
              <Line
                type="monotone"
                dataKey="cost"
                name="Hourly cost ($)"
                stroke="url(#costGrad)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: '#f59e0b' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 3 — Server Usage (Bar) */}
        <div style={{ ...chartCardStyle, gridColumn: '1 / -1' }}>
          <div style={chartTitleStyle}>
            🖥️ Recommended Servers &amp; Load per Server
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.08)" />
              <XAxis dataKey="label" tick={tickStyle} />
              <YAxis tick={tickStyle} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend
                wrapperStyle={{ color: '#64748b', fontSize: '0.75rem', paddingTop: 8 }}
              />
              <Bar
                dataKey="servers"
                name="Recommended Servers"
                fill="rgba(59,130,246,0.7)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="load"
                name="Load / Server (req/min)"
                fill="rgba(6,182,212,0.6)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={{ ...wrapperStyle, textAlign: 'center', padding: '3rem' }}>
      <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
        ⏳ Loading prediction history…
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div style={{ ...wrapperStyle, padding: '2rem' }}>
      <div style={{
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 10,
        color: '#fca5a5',
        padding: '1rem',
        fontSize: '0.85rem',
      }}>
        ❌ {message}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ ...wrapperStyle, textAlign: 'center', padding: '3rem' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📭</div>
      <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
        No prediction history yet — run your first prediction to see charts here.
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const wrapperStyle: React.CSSProperties = {
  background : 'linear-gradient(135deg, rgba(17,24,39,0.9) 0%, rgba(15,23,42,0.7) 100%)',
  border     : '1px solid rgba(59,130,246,0.2)',
  borderRadius: 16,
  padding    : '1.75rem 2rem',
  backdropFilter: 'blur(8px)',
};

const headerStyle: React.CSSProperties = {
  display        : 'flex',
  justifyContent : 'space-between',
  alignItems     : 'center',
  marginBottom   : '1.75rem',
};

const titleStyle: React.CSSProperties = {
  fontFamily : "'Space Grotesk', sans-serif",
  fontWeight : 700,
  fontSize   : '1.1rem',
  color      : '#f1f5f9',
  margin     : 0,
};

const subtitleStyle: React.CSSProperties = {
  color     : '#64748b',
  fontSize  : '0.78rem',
  margin    : '0.2rem 0 0',
};

const badgeStyle: React.CSSProperties = {
  background    : 'rgba(59,130,246,0.1)',
  border        : '1px solid rgba(59,130,246,0.25)',
  borderRadius  : 8,
  color         : '#93c5fd',
  fontSize      : '0.78rem',
  padding       : '0.35rem 0.75rem',
  fontWeight    : 500,
};

const gridStyle: React.CSSProperties = {
  display              : 'grid',
  gridTemplateColumns  : 'repeat(auto-fit, minmax(300px, 1fr))',
  gap                  : '1.25rem',
};

const chartCardStyle: React.CSSProperties = {
  background    : 'rgba(15,23,42,0.5)',
  border        : '1px solid rgba(59,130,246,0.12)',
  borderRadius  : 12,
  padding       : '1.25rem',
};

const chartTitleStyle: React.CSSProperties = {
  color      : '#94a3b8',
  fontSize   : '0.8rem',
  fontWeight : 600,
  textTransform : 'uppercase',
  letterSpacing : '0.5px',
  marginBottom  : '1rem',
  display    : 'flex',
  alignItems : 'center',
  gap        : 8,
};

const chartUnitStyle: React.CSSProperties = {
  color        : '#475569',
  fontWeight   : 400,
  textTransform: 'none',
  letterSpacing: 'normal',
  marginLeft   : 'auto',
};

const tickStyle = { fill: '#475569', fontSize: 11 };

const tooltipStyle: React.CSSProperties = {
  background   : 'rgba(15,23,42,0.95)',
  border       : '1px solid rgba(59,130,246,0.25)',
  borderRadius : 8,
  color        : '#e2e8f0',
  fontSize     : '0.8rem',
};
