"use client";

import { useState, useCallback } from 'react';

export interface ErrorState {
  message: string;
  details: any;
  statusCode?: number;
}

export interface UseErrorHandlerReturn {
  error: ErrorState | null;
  setError: (error: ErrorState | null) => void;
  handleApiError: (error: any, context?: string) => void;
  handleFetchError: (response: Response, context?: string) => Promise<boolean>;
  clearError: () => void;
}

/**
 * Custom hook for handling API errors across the application
 * Provides consistent error handling for 503 and other API errors
 */
export function useErrorHandler(): UseErrorHandlerReturn {
  const [error, setError] = useState<ErrorState | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleApiError = useCallback((error: any, context?: string) => {
    console.error(`API Error${context ? ` in ${context}` : ''}:`, error);

    let errorMessage = 'An unexpected error occurred';
    let errorDetails = error;

    if (error?.response?.status === 503) {
      errorMessage = 'Service temporarily unavailable';
      errorDetails = error.response.data || error;
    } else if (error?.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    setError({
      message: errorMessage,
      details: errorDetails,
      statusCode: error?.response?.status || error?.status
    });
  }, []);

  const handleFetchError = useCallback(async (response: Response, context?: string): Promise<boolean> => {
    if (response.status === 503) {
      try {
        const errorData = await response.json();
        setError({
          message: 'Service temporarily unavailable',
          details: errorData,
          statusCode: 503
        });
      } catch {
        setError({
          message: 'Service temporarily unavailable',
          details: { error: 'Service unavailable' },
          statusCode: 503
        });
      }
      return false; // Error handled
    }

    if (!response.ok) {
      const errorText = `HTTP ${response.status}: ${response.statusText}`;
      console.error(`Fetch Error${context ? ` in ${context}` : ''}:`, errorText);
      setError({
        message: 'Request failed',
        details: errorText,
        statusCode: response.status
      });
      return false; // Error handled
    }

    return true; // No error
  }, []);

  return {
    error,
    setError,
    handleApiError,
    handleFetchError,
    clearError
  };
}