"use client";
import React, { useState } from 'react';
import { UploadState } from '../types';
import { Button } from '@/components/ui/button';

interface ReadyStateProps {
  uploadState: Extract<UploadState, { type: 'ready' }>;
  onDelete: () => void;
  onStartAnalysis: () => void;
}

export const ReadyState: React.FC<ReadyStateProps> = ({
  uploadState,
  onDelete,
  onStartAnalysis,
}) => {
  const [showModal, setShowModal] = useState(false);
  const videoUrl = uploadState.videoFile?.signedUrl;

  return (
    <div className="max-w-lg mx-auto mt-16 p-8 border-2 border-dashed rounded-2xl text-center bg-card text-card-foreground shadow-lg font-sans">
      <div className="flex flex-col items-center justify-center gap-2">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2 text-green-600">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22,4 12,14.01 9,11.01"/>
        </svg>
        <p className="text-lg font-medium mb-2">Ready for Analysis</p>
        {videoUrl ? (
          <div className="relative">
            <video
              src={videoUrl}
              controls
              className="mx-auto max-h-64 rounded-lg border bg-black cursor-pointer"
              style={{ maxWidth: 400 }}
              onError={(e) => console.error('Video load error:', e)}
              onLoadStart={() => console.log('Video load started')}
              onLoadedData={() => console.log('Video data loaded')}
            />
            <button
              onClick={() => setShowModal(true)}
              className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded hover:bg-black/80 transition-colors font-medium"
              aria-label="Expand video"
            >
              Expand
            </button>
          </div>
        ) : (
          <div className="text-red-500">Video URL not available</div>
        )}
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
        {uploadState.videoFile?.fileName && (
          <div className="mt-4 text-sm text-muted-foreground">{uploadState.videoFile.fileName}</div>
        )}
        <div className="flex gap-4 mt-4">
          <Button
            variant="outline"
            onClick={onDelete}
          >
            Delete
          </Button>
          <Button
            onClick={onStartAnalysis}
          >
            Start Video Analysis
          </Button>
        </div>
      </div>
    </div>
  );
};