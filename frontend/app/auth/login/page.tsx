'use client';

// =============================================================================
// CloudMind AI – app/auth/login/page.tsx
// Login page — collects username + password, calls /auth/login, stores JWT.
// Redirects to / on success.
// =============================================================================

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { loginUser } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await loginUser(username, password);
      router.push('/');          // redirect to dashboard
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Login failed. Please check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      {/* Ambient glow blobs */}
      <div style={styles.blobLeft} />
      <div style={styles.blobRight} />

      <div style={styles.card}>
        {/* Logo / title */}
        <div style={styles.logoRow}>
          <span style={styles.logo}>☁️</span>
          <div>
            <div style={styles.brand}>CloudMind AI</div>
            <div style={styles.subBrand}>Autonomous Cloud Intelligence</div>
          </div>
        </div>

        <h1 style={styles.heading}>Welcome back</h1>
        <p style={styles.sub}>Sign in to access your dashboard</p>

        {/* Error banner */}
        {error && (
          <div style={styles.errorBanner}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Username */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Username</label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your_username"
              required
              autoComplete="username"
              style={styles.input}
            />
          </div>

          {/* Password */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              style={styles.input}
            />
          </div>

          {/* Submit */}
          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            style={{
              ...styles.btn,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? (
              <span style={styles.btnContent}>
                <span style={styles.spinner} /> Signing in…
              </span>
            ) : (
              '→  Sign In'
            )}
          </button>
        </form>

        {/* Register link */}
        <p style={styles.footer}>
          Don&apos;t have an account?{' '}
          <Link href="/auth/register" style={styles.link}>
            Create one free
          </Link>
        </p>
      </div>
    </div>
  );
}

// ── Inline styles (keeps design consistent with existing dark theme) ──────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f172a 0%, #1a1f3a 60%, #0d1425 100%)',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Inter', sans-serif",
  },
  blobLeft: {
    position: 'absolute',
    width: 500,
    height: 500,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
    top: '-100px',
    left: '-150px',
    pointerEvents: 'none',
  },
  blobRight: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)',
    bottom: '-80px',
    right: '-100px',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    zIndex: 1,
    background: 'rgba(17,24,39,0.85)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(59,130,246,0.25)',
    borderRadius: 20,
    padding: '2.75rem 2.5rem',
    width: '100%',
    maxWidth: 430,
    boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: '1.75rem',
  },
  logo: { fontSize: '2rem' },
  brand: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 700,
    fontSize: '1.05rem',
    color: '#e2e8f0',
    lineHeight: 1.2,
  },
  subBrand: {
    fontSize: '0.72rem',
    color: '#64748b',
    letterSpacing: '0.3px',
  },
  heading: {
    color: '#f1f5f9',
    fontSize: '1.7rem',
    fontWeight: 700,
    fontFamily: "'Space Grotesk', sans-serif",
    margin: 0,
    marginBottom: '0.35rem',
  },
  sub: {
    color: '#64748b',
    fontSize: '0.875rem',
    margin: 0,
    marginBottom: '1.75rem',
  },
  errorBanner: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.35)',
    borderRadius: 10,
    color: '#fca5a5',
    fontSize: '0.84rem',
    padding: '0.75rem 1rem',
    marginBottom: '1.25rem',
    lineHeight: 1.5,
  },
  form: { display: 'flex', flexDirection: 'column', gap: '1.1rem' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  label: {
    color: '#94a3b8',
    fontSize: '0.78rem',
    fontWeight: 500,
    letterSpacing: '0.4px',
    textTransform: 'uppercase',
  },
  input: {
    background: 'rgba(30,41,59,0.7)',
    border: '1px solid rgba(59,130,246,0.25)',
    borderRadius: 10,
    color: '#e2e8f0',
    fontSize: '0.95rem',
    padding: '0.65rem 0.9rem',
    outline: 'none',
    width: '100%',
    fontFamily: "'Inter', sans-serif",
    transition: 'border-color 0.2s',
  },
  btn: {
    marginTop: '0.5rem',
    background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
    border: 'none',
    borderRadius: 10,
    color: '#ffffff',
    fontSize: '0.95rem',
    fontWeight: 600,
    padding: '0.8rem',
    width: '100%',
    fontFamily: "'Inter', sans-serif",
    letterSpacing: '0.3px',
    transition: 'transform 0.15s, box-shadow 0.15s',
    boxShadow: '0 4px 15px rgba(59,130,246,0.3)',
  },
  btnContent: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  spinner: {
    display: 'inline-block',
    width: 14,
    height: 14,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  footer: {
    marginTop: '1.5rem',
    textAlign: 'center',
    color: '#64748b',
    fontSize: '0.875rem',
  },
  link: {
    color: '#60a5fa',
    textDecoration: 'none',
    fontWeight: 500,
  },
};
