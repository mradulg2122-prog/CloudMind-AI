'use client';

import { useEffect } from 'react';

export function useAutoRefresh(onPredict: () => void, enabled: boolean, intervalMs = 8000) {
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(onPredict, intervalMs);
    return () => clearInterval(id);
  }, [onPredict, enabled, intervalMs]);
}
