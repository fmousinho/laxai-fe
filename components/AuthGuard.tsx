'use client';

import { useUser } from '@auth0/nextjs-auth0';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, isLoading, error } = useUser();
  const router = useRouter();

  useEffect(() => {
    console.log('[AuthGuard] Auth state check:', { user: !!user, isLoading, error: !!error });

    // If there's an auth error or no user after loading, redirect to login
    if (!isLoading && (!user || error)) {
      console.log('[AuthGuard] No valid user, redirecting to login');

      // Clear any cached auth state
      localStorage.removeItem('auth0.is.authenticated');
      sessionStorage.clear();

      // Redirect to login
      router.push('/login');
    } else if (!isLoading && user) {
      console.log('[AuthGuard] Valid user found, allowing access');
    }
  }, [user, isLoading, error, router]);

  // Also check auth state when page becomes visible (user switches tabs/back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !isLoading) {
        console.log('[AuthGuard] Page became visible, re-checking auth');
        // Force a re-check by checking the current user
        if (!user || error) {
          console.log('[AuthGuard] No valid user on visibility change, redirecting');
          localStorage.removeItem('auth0.is.authenticated');
          sessionStorage.clear();
          router.push('/login');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, isLoading, error, router]);

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
    return null;
  }

  // User is authenticated, render children
  return <>{children}</>;
}