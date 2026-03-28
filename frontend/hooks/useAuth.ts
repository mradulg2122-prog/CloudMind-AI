// =============================================================================
// CloudMind AI – hooks/useAuth.ts
//
// Custom hook that tracks authentication state across the app.
// Provides:
//   - isLoggedIn  : boolean
//   - user        : UserOut | null (fetched from /auth/me)
//   - logout()    : clears token and redirects to /auth/login
//   - loading     : true while fetching the current user profile
// =============================================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getMe, logoutUser, isLoggedIn, UserOut } from '@/lib/api';

interface UseAuthReturn {
  user      : UserOut | null;
  loggedIn  : boolean;
  loading   : boolean;
  logout    : () => void;
}

export function useAuth(): UseAuthReturn {
  const router  = useRouter();
  const [user,    setUser]    = useState<UserOut | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch the current user on mount (validates token is still valid)
  useEffect(() => {
    if (!isLoggedIn()) {
      setLoading(false);
      return;
    }

    getMe()
      .then((u) => setUser(u))
      .catch(() => {
        // Token invalid/expired — clear it and redirect to login
        logoutUser();
        router.push('/auth/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const logout = useCallback(() => {
    logoutUser();
    setUser(null);
    router.push('/auth/login');
  }, [router]);

  return {
    user,
    loggedIn : !!user,
    loading,
    logout,
  };
}
