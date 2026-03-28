'use client';
// =============================================================================
// CloudMind AI – lib/toast.tsx
// Global toast notification system via React context
// Usage: const { toast } = useToast();
//        toast('Prediction saved!', 'success');
// =============================================================================

import { createContext, useCallback, useContext, useState, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem { id: number; message: string; type: ToastType; }

interface ToastCtx { toast: (msg: string, type?: ToastType) => void; }

const ToastContext = createContext<ToastCtx>({ toast: () => {} });

let _id = 0;

const ICONS: Record<ToastType, string> = {
  success : '✅',
  error   : '❌',
  info    : 'ℹ️',
  warning : '⚠️',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++_id;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>{ICONS[t.type]}</span>
            <span style={{ flex: 1 }}>{t.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1 }}
            >×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() { return useContext(ToastContext); }
