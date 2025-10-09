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
    // If there's an auth error or no user after loading, redirect to login
    if (!isLoading && (!user || error)) {
      // Clear any cached auth state
      localStorage.removeItem('auth0.is.authenticated');
      sessionStorage.clear();

      // Redirect to login
      router.push('/api/auth/login');
    }
  }, [user, isLoading, error, router]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render children if not authenticated (will redirect)
  if (!user) {
    return null;
  }

  return <>{children}</>;
}