"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/lib/useErrorHandler';

interface ErrorPageProps {
  error: ErrorState;
  onRetry?: () => void;
  onDismiss?: () => void;
  showRetryButton?: boolean;
  showDismissButton?: boolean;
  customActions?: React.ReactNode;
}

/**
 * Reusable error page component for displaying API errors
 * Provides consistent error UI across the application
 */
export function ErrorPage({
  error,
  onRetry,
  onDismiss,
  showRetryButton = true,
  showDismissButton = true,
  customActions
}: ErrorPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] w-full px-4 max-w-2xl mx-auto text-center">
      <div className="bg-red-50 border border-red-200 rounded-lg p-8 w-full">
        <h1 className="text-2xl font-bold text-red-800 mb-4">
          We encountered an error
        </h1>
        <p className="text-gray-700 mb-6">
          You may not know what this means, but the administrator does and he has just been informed about it:
        </p>
        <div className="bg-white border border-red-300 rounded p-4 text-left font-mono text-sm text-red-700 max-h-40 overflow-y-auto">
          {typeof error.details === 'object'
            ? JSON.stringify(error.details, null, 2)
            : String(error.details)
          }
        </div>
        <div className="mt-6 flex justify-center gap-4">
          {customActions ? (
            customActions
          ) : (
            <>
              {showRetryButton && onRetry && (
                <Button
                  onClick={onRetry}
                  variant="outline"
                >
                  Try Again
                </Button>
              )}
              {showDismissButton && onDismiss && (
                <Button
                  onClick={onDismiss}
                  variant="default"
                >
                  Continue
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}