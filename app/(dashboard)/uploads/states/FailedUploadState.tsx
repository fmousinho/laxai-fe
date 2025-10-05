"use client";
import React from 'react';
import { UploadState } from '../types';

interface FailedUploadStateProps {
  uploadState: Extract<UploadState, { type: 'failed_upload' }>;
  onRetry: () => void;
}

export const FailedUploadState: React.FC<FailedUploadStateProps> = ({
  uploadState,
  onRetry,
}) => {
  return (
    <div className="text-center">
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg max-w-md mx-auto">
        <h3 className="font-semibold text-red-800">Upload Failed</h3>
        <p className="text-sm text-red-700 mt-1">{uploadState.error || 'An error occurred during upload.'}</p>
        <button
          className="mt-4 px-4 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
          onClick={onRetry}
        >
          Try Again
        </button>
      </div>
    </div>
  );
};