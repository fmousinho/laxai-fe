"use client";
import React from 'react';
import { UploadState } from '../types';

interface AnalysisCompleteStateProps {
  uploadState: Extract<UploadState, { type: 'analysis_complete' }>;
  onReset: () => void;
}

export const AnalysisCompleteState: React.FC<AnalysisCompleteStateProps> = ({
  uploadState,
  onReset,
}) => {
  return (
    <div className="mt-6 text-center flex flex-col items-center gap-4">
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg max-w-md mx-auto">
        <h3 className="font-semibold text-green-800">Analysis Completed!</h3>
        <p className="text-sm text-green-700 mt-1">Video analysis has finished successfully.</p>
        {uploadState.analysisTaskId && (
          <p className="text-xs text-green-600 mt-2">Task ID: {uploadState.analysisTaskId}</p>
        )}
        <button
          className="mt-4 px-4 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
          onClick={onReset}
        >
          OK
        </button>
      </div>
    </div>
  );
};