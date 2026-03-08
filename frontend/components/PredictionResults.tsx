'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { PredictionOutput, TelemetryInput } from '@/lib/api';

interface Props {
  prediction: PredictionOutput;
  telemetry: TelemetryInput;
  hourlyCost: number;
}

function PredCard({
  label,
  value,
  unit,
  accent,
  delta,
  index,
}: {
  label: string;
  value: string;
  unit: string;
  accent: string;
  delta?: { text: string; up: boolean | null };
  index: number;
}) {
  return (
    <motion.div
      className="metric-card"
      style={{ padding: '1.75rem 1.75rem 1.5rem' }}
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24, delay: index * 0.1 }}
      whileHover={{ y: -4, boxShadow: `0 12px 32px ${accent}30`, transition: { duration: 0.2 } }}
    >
      <div className="metric-label" style={{ marginBottom: '1rem', fontSize: '0.72rem', letterSpacing: '0.8px' }}>
        {label}
      </div>
      <div className="metric-value" style={{ color: accent, fontSize: '2.4rem', marginBottom: '0.5rem' }}>
        {value}
      </div>
      {delta ? (
        <div
          className="metric-unit"
          style={{
            fontSize: '0.8rem',
            color:
              delta.up === null
                ? '#94a3b8'
                : delta.up
                ? '#4ade80'
                : '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          {delta.up === true ? '▲' : delta.up === false ? '▼' : ''}
          {delta.text}
        </div>
      ) : (
        <div className="metric-unit" style={{ fontSize: '0.8rem' }}>
          {unit}
        </div>
      )}
    </motion.div>
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
      <div className="section-title" style={{ marginTop: 0, marginBottom: '1.25rem' }}>
        ML Prediction Engine
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`pred-${predicted_requests}`}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1.25rem',
          }}
        >
          <PredCard
            index={0}
            label="Predicted Traffic (+5 min)"
            value={predicted_requests.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            unit="req / min"
            accent="#22d3ee"
            delta={{
              text: `${Math.abs(deltaRequests).toLocaleString(undefined, { maximumFractionDigits: 0 })} from current`,
              up: deltaRequests >= 0,
            }}
          />

          <PredCard
            index={1}
            label="Recommended Servers"
            value={String(recommended_servers)}
            unit="instances"
            accent="#a78bfa"
            delta={{
              text: deltaServers === 0 ? 'no change' : `${deltaServers > 0 ? '+' : ''}${deltaServers} from current`,
              up: deltaServers === 0 ? null : deltaServers > 0,
            }}
          />

          <PredCard
            index={2}
            label="Load / Server"
            value={load_per_server.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            unit="req / min per server"
            accent={load_per_server > 400 ? '#f87171' : '#f59e0b'}
          />

          <PredCard
            index={3}
            label="Projected Hourly Cost"
            value={`$${projectedCost}`}
            unit="USD / hour"
            accent="#34d399"
            delta={{
              text:
                costDelta < 0
                  ? `saves $${Math.abs(costDelta)}/hr`
                  : costDelta > 0
                  ? `costs $${costDelta} more/hr`
                  : 'no cost change',
              up: costDelta < 0 ? false : costDelta > 0 ? true : null,
            }}
          />
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
