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
  const formatErrorDetails = (details: any): string => {
    if (typeof details === 'string') {
      return details;
    }
    if (typeof details === 'object' && details !== null) {
      // If it's a backend error with specific structure
      if (details.error && details.details) {
        return `${details.error}: ${details.details}`;
      }
      // If it's a simple object with a message
      if (details.message) {
        return details.message;
      }
      // For other objects, try to extract meaningful information
      if (details.code) {
        return `Error code: ${details.code}${details.message ? ` - ${details.message}` : ''}`;
      }
      // Fallback to JSON for complex objects
      return JSON.stringify(details, null, 2);
    }
    return String(details);
  };

  const getErrorTitle = (error: ErrorState): string => {
    if (error.statusCode === 503) {
      return 'Service Temporarily Unavailable';
    }
    if (error.statusCode === 401 || error.statusCode === 403) {
      return 'Access Denied';
    }
    if (error.statusCode === 404) {
      return 'Resource Not Found';
    }
    if (error.statusCode === 400) {
      return 'Invalid Request';
    }
    if (error.statusCode && error.statusCode >= 500) {
      return 'Server Error';
    }
    return 'We encountered an error';
  };

  const getErrorDescription = (error: ErrorState): string => {
    if (error.statusCode === 503) {
      return 'The service is currently unavailable. Please try again in a few moments.';
    }
    if (error.statusCode === 401) {
      return 'You are not authorized to access this resource. Please check your permissions.';
    }
    if (error.statusCode === 403) {
      return 'Access to this resource is forbidden. Please contact an administrator if you believe this is an error.';
    }
    if (error.statusCode === 404) {
      return 'The requested resource could not be found. Please check that the video has been properly processed.';
    }
    if (error.statusCode === 400) {
      return 'The request was invalid. Please check your input and try again.';
    }
    if (error.statusCode && error.statusCode >= 500) {
      return 'A server error occurred. The administrators have been notified and are working to resolve this issue.';
    }
    return 'Something went wrong while processing your request. Please try again or contact support if the problem persists.';
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] w-full px-4 max-w-2xl mx-auto text-center">
      <div className="bg-red-50 border border-red-200 rounded-lg p-8 w-full">
        <h1 className="text-2xl font-bold text-red-800 mb-4">
          {getErrorTitle(error)}
        </h1>
        <p className="text-gray-700 mb-6">
          {getErrorDescription(error)}
        </p>

        {/* Show detailed error information */}
        <div className="bg-white border border-red-300 rounded p-4 text-left">
          <div className="text-sm text-gray-600 mb-2 font-medium">Error Details:</div>
          <div className="font-mono text-sm text-red-700 max-h-32 overflow-y-auto">
            {formatErrorDetails(error.details)}
          </div>
          {error.statusCode && (
            <div className="text-xs text-gray-500 mt-2">
              HTTP Status: {error.statusCode}
            </div>
          )}
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