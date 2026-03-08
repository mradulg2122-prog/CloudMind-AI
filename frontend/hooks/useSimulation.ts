'use client';

import { useState, useEffect, useRef } from 'react';

export interface SimDataPoint {
  time: string;
  traffic: number;
  cpu: number;
  memory: number;
}

interface UseSimulationOptions {
  baseTraffic: number;
  baseCpu: number;
  baseMemory: number;
  enabled?: boolean;
}

const MAX_POINTS = 150; // ~5 minutes at 2s intervals

export function useSimulation({
  baseTraffic,
  baseCpu,
  baseMemory,
  enabled = true,
}: UseSimulationOptions) {
  const [history, setHistory] = useState<SimDataPoint[]>([]);
  const tickRef = useRef(0);
  const spikeRef = useRef<{ active: boolean; countdown: number }>({ active: false, countdown: 0 });

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      const t = tickRef.current;
      tickRef.current += 1;

      // Spike logic – random spike every ~60 ticks
      if (!spikeRef.current.active && Math.random() < 0.015) {
        spikeRef.current = { active: true, countdown: 8 };
      }
      const spikeMultiplier = spikeRef.current.active ? 1.45 : 1;
      if (spikeRef.current.active) {
        spikeRef.current.countdown -= 1;
        if (spikeRef.current.countdown <= 0) spikeRef.current = { active: false, countdown: 0 };
      }

      // Daily workload cycle (sine over ~720 ticks ≈ 24 min window)
      const dailyCycle = Math.sin((t / 720) * 2 * Math.PI) * 0.25;

      // Short wave (micro-fluctuation)
      const shortWave = Math.sin(t / 8) * 0.07;

      // Gaussian-like noise
      const noise = () => (Math.random() - 0.5) * 2 * 0.08;

      const traffic = Math.max(
        50,
        Math.round(baseTraffic * spikeMultiplier * (1 + dailyCycle + shortWave + noise()))
      );
      const cpu = Math.max(
        2,
        Math.min(100, Math.round(baseCpu * spikeMultiplier * (1 + dailyCycle * 0.5 + noise())))
      );
      const memory = Math.max(
        5,
        Math.min(100, Math.round(baseMemory * (1 + dailyCycle * 0.3 + noise())))
      );

      const now = new Date();
      const label = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      setHistory((prev) => {
        const next = [...prev, { time: label, traffic, cpu, memory }];
        return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [enabled, baseTraffic, baseCpu, baseMemory]);

  return history;
}
