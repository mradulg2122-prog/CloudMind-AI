'use client';

// =============================================================================
// CloudMind AI – components/UserMenu.tsx
//
// Shows the currently logged-in user's avatar/username in the top bar,
// with a logout button. Redirects to /auth/login when not authenticated.
// =============================================================================

import { useState } from 'react';
import Link from 'next/link';
import { UserOut } from '@/lib/api';

interface UserMenuProps {
  user   : UserOut | null;
  loading: boolean;
  onLogout: () => void;
}

export default function UserMenu({ user, loading, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <div style={styles.skeleton} />
    );
  }

  if (!user) {
    return (
      <div style={styles.authLinks}>
        <Link href="/auth/login"    style={styles.linkBtn}>Sign In</Link>
        <Link href="/auth/register" style={styles.registerBtn}>Get Started</Link>
      </div>
    );
  }

  // Get initials for the avatar
  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <div style={styles.wrapper}>
      {/* Avatar button */}
      <button
        id="user-menu-btn"
        onClick={() => setOpen((v) => !v)}
        style={styles.avatarBtn}
        title={`Logged in as ${user.username}`}
      >
        <div style={styles.avatar}>{initials}</div>
        <span style={styles.username}>{user.username}</span>
        <span style={{ color: '#475569', fontSize: '0.65rem' }}>▼</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={styles.dropdown}>
          <div style={styles.dropdownHeader}>
            <div style={styles.avatarLg}>{initials}</div>
            <div>
              <div style={styles.dropUserName}>{user.username}</div>
              <div style={styles.dropEmail}>{user.email}</div>
            </div>
          </div>

          <div style={styles.divider} />

          <div style={styles.dropItem}>
            <span style={styles.dropIcon}>🟢</span>
            <span style={{ color: '#86efac', fontSize: '0.8rem' }}>Account Active</span>
          </div>

          <div style={styles.divider} />

          <button
            id="logout-btn"
            onClick={() => { setOpen(false); onLogout(); }}
            style={styles.logoutBtn}
          >
            🚪 Sign Out
          </button>
        </div>
      )}

      {/* Click-away overlay */}
      {open && (
        <div
          style={styles.overlay}
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'relative',
    zIndex: 100,
  },
  skeleton: {
    width: 120,
    height: 32,
    borderRadius: 8,
    background: 'rgba(30,41,59,0.6)',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  authLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  linkBtn: {
    color: '#94a3b8',
    fontSize: '0.82rem',
    textDecoration: 'none',
    padding: '0.4rem 0.75rem',
    borderRadius: 8,
    border: '1px solid rgba(59,130,246,0.2)',
    transition: 'all 0.2s',
  },
  registerBtn: {
    background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
    color: '#fff',
    fontSize: '0.82rem',
    fontWeight: 600,
    textDecoration: 'none',
    padding: '0.4rem 0.9rem',
    borderRadius: 8,
    transition: 'all 0.2s',
  },
  avatarBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(30,41,59,0.7)',
    border: '1px solid rgba(59,130,246,0.2)',
    borderRadius: 10,
    padding: '0.35rem 0.75rem 0.35rem 0.4rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.72rem',
    fontFamily: "'Space Grotesk', sans-serif",
    flexShrink: 0,
  },
  username: {
    color: '#cbd5e1',
    fontSize: '0.82rem',
    fontWeight: 500,
    maxWidth: 100,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    background: 'rgba(15,23,42,0.97)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(59,130,246,0.25)',
    borderRadius: 14,
    padding: '0.75rem',
    minWidth: 220,
    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
    zIndex: 200,
  },
  dropdownHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '0.25rem 0.25rem 0.75rem',
  },
  avatarLg: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.9rem',
    fontFamily: "'Space Grotesk', sans-serif",
    flexShrink: 0,
  },
  dropUserName: {
    color: '#f1f5f9',
    fontWeight: 600,
    fontSize: '0.9rem',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  dropEmail: {
    color: '#64748b',
    fontSize: '0.75rem',
    marginTop: 2,
  },
  divider: {
    height: 1,
    background: 'rgba(59,130,246,0.1)',
    margin: '0.4rem 0',
  },
  dropItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0.4rem 0.25rem',
  },
  dropIcon: {
    fontSize: '0.85rem',
  },
  logoutBtn: {
    width: '100%',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 8,
    color: '#f87171',
    fontSize: '0.82rem',
    fontWeight: 500,
    padding: '0.5rem 0.75rem',
    cursor: 'pointer',
    textAlign: 'left',
    marginTop: '0.2rem',
    transition: 'all 0.2s',
    fontFamily: "'Inter', sans-serif",
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 150,
    background: 'transparent',
  },
};
