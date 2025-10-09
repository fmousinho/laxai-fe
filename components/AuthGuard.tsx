'use client';

import { useUser } from '@auth0/nextjs-auth0';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, isLoading, error } = useUser();
  const router = useRouter();
  const redirectTimerRef = useRef<number | null>(null);
  const hasLoggedErrorRef = useRef(false);

  const cancelRedirect = useCallback(() => {
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
  }, []);

  const performRedirect = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    cancelRedirect();

    try {
      localStorage.removeItem('auth0.is.authenticated');
      sessionStorage.clear();
    } catch (storageError) {
      console.warn('[AuthGuard] Failed to clear client storage during redirect', storageError);
    }

    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const loginUrl = new URL('/login', window.location.origin);
    if (currentPath && currentPath !== '/login') {
      loginUrl.searchParams.set('returnTo', currentPath);
    }

    console.log('[AuthGuard] Redirecting to login after grace period');
    router.replace(loginUrl.toString());
  }, [cancelRedirect, router]);

  const scheduleRedirect = useCallback(() => {
    if (typeof window === 'undefined' || redirectTimerRef.current) {
      return;
    }

    redirectTimerRef.current = window.setTimeout(() => {
      performRedirect();
    }, 2000);
  }, [performRedirect]);

  useEffect(() => cancelRedirect, [cancelRedirect]);

  useEffect(() => {
    if (error && !hasLoggedErrorRef.current) {
      const statusCode = (error as unknown as { status?: number; statusCode?: number }).status ??
        (error as unknown as { status?: number; statusCode?: number }).statusCode;

      console.warn('[AuthGuard] Auth error detected', {
        statusCode,
        message: (error as Error).message
      });
      hasLoggedErrorRef.current = true;
    }

    if (!error) {
      hasLoggedErrorRef.current = false;
    }
  }, [error]);

  useEffect(() => {
    console.log('[AuthGuard] Auth state check:', { user: !!user, isLoading, error: !!error });

    if (isLoading) {
      cancelRedirect();
      return;
    }

    if (user) {
      cancelRedirect();
      console.log('[AuthGuard] Valid user found, allowing access');
      return;
    }

    const statusCode = (error as unknown as { status?: number; statusCode?: number })?.status ??
      (error as unknown as { status?: number; statusCode?: number })?.statusCode;

    // For non-auth errors, redirect immediately
    if (statusCode && ![401, 403].includes(statusCode)) {
      performRedirect();
      return;
    }

    // Allow a short grace period for Auth0 session propagation before redirecting
    scheduleRedirect();
  }, [user, isLoading, error, cancelRedirect, performRedirect, scheduleRedirect]);

  // Also check auth state when page becomes visible (user switches tabs/back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !isLoading) {
        console.log('[AuthGuard] Page became visible, re-checking auth');
        // Force a re-check by checking the current user
        if (!user || error) {
          console.log('[AuthGuard] No valid user on visibility change, scheduling redirect');
          scheduleRedirect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, isLoading, error, scheduleRedirect]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // If no user, don't render children (redirect will happen in useEffect)
  if (!user || error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // User is authenticated, render children
  return <>{children}</>;
}