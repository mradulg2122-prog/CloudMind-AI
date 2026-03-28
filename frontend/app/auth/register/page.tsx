'use client';

// =============================================================================
// CloudMind AI – app/auth/register/page.tsx
// Registration page — collects username, email, password, calls /auth/register.
// On success auto-logs the user in and redirects to dashboard.
// =============================================================================

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { registerUser, loginUser } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function onChange(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      // 1. Register the account
      await registerUser(form.username, form.email, form.password);
      setSuccess(true);

      // 2. Auto-login with the new credentials
      await loginUser(form.username, form.password);

      // 3. Redirect to dashboard after a short moment
      setTimeout(() => router.push('/'), 800);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Registration failed. Please try again.';
      setError(msg);
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.blobLeft} />
      <div style={styles.blobRight} />

      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoRow}>
          <span style={styles.logo}>☁️</span>
          <div>
            <div style={styles.brand}>CloudMind AI</div>
            <div style={styles.subBrand}>Autonomous Cloud Intelligence</div>
          </div>
        </div>

        <h1 style={styles.heading}>Create account</h1>
        <p style={styles.sub}>Start monitoring your infrastructure in seconds</p>

        {/* Success banner */}
        {success && (
          <div style={styles.successBanner}>
            ✅ Account created! Redirecting to dashboard…
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div style={styles.errorBanner}>⚠️ {error}</div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Username */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Username</label>
            <input
              id="register-username"
              type="text"
              value={form.username}
              onChange={onChange('username')}
              placeholder="cloud_admin"
              required
              autoComplete="username"
              style={styles.input}
            />
          </div>

          {/* Email */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email address</label>
            <input
              id="register-email"
              type="email"
              value={form.email}
              onChange={onChange('email')}
              placeholder="admin@mycompany.com"
              required
              autoComplete="email"
              style={styles.input}
            />
          </div>

          {/* Password */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Password</label>
            <input
              id="register-password"
              type="password"
              value={form.password}
              onChange={onChange('password')}
              placeholder="At least 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
              style={styles.input}
            />
          </div>

          {/* Confirm password */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Confirm Password</label>
            <input
              id="register-confirm"
              type="password"
              value={form.confirm}
              onChange={onChange('confirm')}
              placeholder="Repeat your password"
              required
              autoComplete="new-password"
              style={{
                ...styles.input,
                borderColor:
                  form.confirm && form.confirm !== form.password
                    ? 'rgba(239,68,68,0.5)'
                    : 'rgba(59,130,246,0.25)',
              }}
            />
            {form.confirm && form.confirm !== form.password && (
              <span style={{ color: '#f87171', fontSize: '0.75rem', marginTop: 2 }}>
                Passwords don&apos;t match
              </span>
            )}
          </div>

          {/* Submit */}
          <button
            id="register-submit"
            type="submit"
            disabled={loading || success}
            style={{
              ...styles.btn,
              opacity: loading || success ? 0.7 : 1,
              cursor: loading || success ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? (
              <span style={styles.btnContent}>
                <span style={styles.spinner} /> Creating account…
              </span>
            ) : (
              '→  Create Account'
            )}
          </button>
        </form>

        {/* Feature highlights */}
        <div style={styles.features}>
          {['ML-powered workload forecasting', 'Autonomous scaling decisions', 'Real-time alerts & monitoring'].map(
            (feat, i) => (
              <div key={i} style={styles.featureItem}>
                <span style={styles.featureCheck}>✓</span>
                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{feat}</span>
              </div>
            )
          )}
        </div>

        {/* Login link */}
        <p style={styles.footer}>
          Already have an account?{' '}
          <Link href="/auth/login" style={styles.link}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

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
    padding: '2rem 1rem',
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
    maxWidth: 450,
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
  successBanner: {
    background: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.35)',
    borderRadius: 10,
    color: '#86efac',
    fontSize: '0.84rem',
    padding: '0.75rem 1rem',
    marginBottom: '1.25rem',
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
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
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
  features: {
    marginTop: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    borderTop: '1px solid rgba(59,130,246,0.1)',
    paddingTop: '1.25rem',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  featureCheck: {
    color: '#3b82f6',
    fontWeight: 700,
    fontSize: '0.8rem',
  },
  footer: {
    marginTop: '1.25rem',
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
