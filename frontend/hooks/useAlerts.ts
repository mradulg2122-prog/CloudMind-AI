'use client';

import { useState, useEffect, useCallback } from 'react';
import { TelemetryInput, PredictionOutput } from '@/lib/api';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: Date;
}

const MAX_ALERTS = 5;

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function useAlerts(telemetry: TelemetryInput, prediction: PredictionOutput | null) {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const push = useCallback((alert: Omit<Alert, 'id' | 'timestamp'>) => {
    setAlerts((prev) => {
      const next = [{ ...alert, id: uid(), timestamp: new Date() }, ...prev];
      return next.slice(0, MAX_ALERTS);
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Telemetry-driven alerts
  useEffect(() => {
    if (telemetry.cpu_usage_percent > 85) {
      push({
        severity: 'CRITICAL',
        title: 'CPU Critical',
        message: `CPU usage at ${telemetry.cpu_usage_percent}% — approaching saturation limit.`,
      });
    } else if (telemetry.cpu_usage_percent > 70) {
      push({
        severity: 'WARNING',
        title: 'High CPU Usage',
        message: `CPU at ${telemetry.cpu_usage_percent}%. Consider scaling up.`,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telemetry.cpu_usage_percent]);

  useEffect(() => {
    if (telemetry.memory_usage_percent > 80) {
      push({
        severity: 'WARNING',
        title: 'High Memory Usage',
        message: `Memory at ${telemetry.memory_usage_percent}%. Risk of OOM events.`,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telemetry.memory_usage_percent]);

  useEffect(() => {
    if (!prediction) return;

    const trafficDeltaPct =
      ((prediction.predicted_requests - telemetry.requests_per_minute) /
        (telemetry.requests_per_minute || 1)) *
      100;

    if (trafficDeltaPct > 30) {
      push({
        severity: 'WARNING',
        title: 'Traffic Spike Detected',
        message: `Predicted traffic increase of +${trafficDeltaPct.toFixed(0)}% in next 5 minutes.`,
      });
    }

    if (prediction.action === 'SCALE UP') {
      push({
        severity: 'INFO',
        title: 'Scaling Recommended',
        message: `ML model recommends scaling to ${prediction.recommended_servers} servers to handle predicted load.`,
      });
    } else if (prediction.action === 'SCALE DOWN') {
      push({
        severity: 'INFO',
        title: 'Cost Optimisation Available',
        message: `Low utilisation detected. Scale down to ${prediction.recommended_servers} servers to reduce costs.`,
      });
    }

    if (prediction.load_per_server > 400) {
      push({
        severity: 'CRITICAL',
        title: 'Load Per Server Critical',
        message: `Each server is handling ${prediction.load_per_server.toFixed(0)} req/min — performance may degrade.`,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prediction]);

  return { alerts, dismiss };
}
