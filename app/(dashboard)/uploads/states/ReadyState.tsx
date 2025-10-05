"use client";
import React, { useState } from 'react';
import { UploadState } from '../types';

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
    <div className="mt-6 text-center flex flex-col items-center gap-4">
      <p className="mb-2 text-lg font-medium">Video uploaded!</p>
      {videoUrl ? (
        <video
          src={videoUrl}
          controls
          className="mx-auto max-h-64 rounded-lg border bg-black cursor-pointer"
          style={{ maxWidth: 400 }}
          onClick={() => setShowModal(true)}
          onError={(e) => console.error('Video load error:', e)}
          onLoadStart={() => console.log('Video load started')}
          onLoadedData={() => console.log('Video data loaded')}
        />
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
      <div className="text-sm text-muted-foreground">{uploadState.videoFile?.fileName}</div>
      <div className="flex gap-4 mt-2">
        <button
          className="px-4 py-2 rounded bg-gray-200 text-gray-700 font-medium hover:bg-gray-300 transition"
          onClick={onDelete}
        >
          Delete
        </button>
        <button
          className="px-4 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
          onClick={onStartAnalysis}
        >
          Start Video Analysis
        </button>
      </div>
    </div>
  );
};