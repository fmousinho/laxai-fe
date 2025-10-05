"use client";
import React, { useState } from 'react';
import { UploadState } from '../types';

interface FailedAnalysisStateProps {
  uploadState: Extract<UploadState, { type: 'failed_analysis' }>;
  onRetry: () => void;
}

export const FailedAnalysisState: React.FC<FailedAnalysisStateProps> = ({
  uploadState,
  onRetry,
}) => {
  const [showModal, setShowModal] = useState(false);
  const videoUrl = uploadState.videoFile?.signedUrl;

  return (
    <div className="mt-6 text-center flex flex-col items-center gap-4">
      <p className="mb-2 text-lg font-medium">Video uploaded!</p>
      <video
        src={videoUrl!}
        controls
        className="mx-auto max-h-64 rounded-lg border bg-black cursor-pointer"
        style={{ maxWidth: 400 }}
        onClick={() => setShowModal(true)}
      />
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setShowModal(false)}>
          <div className="relative" onClick={e => e.stopPropagation()}>
            <video
              src={videoUrl!}
              controls
              autoPlay
              className="rounded-lg border bg-black shadow-2xl"
              style={{ maxWidth: '90vw', maxHeight: '80vh' }}
            />
            <button
              className="absolute top-2 right-2 text-white bg-black/60 rounded-full px-3 py-1 text-lg font-bold hover:bg-black/80"
              onClick={() => setShowModal(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
      <div className="text-sm text-muted-foreground">{uploadState.videoFile?.fileName}</div>
      <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg max-w-md mx-auto">
        <h3 className="font-semibold text-red-800">Analysis Failed</h3>
        <p className="text-sm text-red-700 mt-1">Video analysis encountered an error.</p>
        {uploadState.analysisTaskId && (
          <p className="text-xs text-red-600 mt-2">Task ID: {uploadState.analysisTaskId}</p>
        )}
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