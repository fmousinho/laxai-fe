"use client";
import React, { useState } from 'react';
import { UploadState } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

interface FailedAnalysisStateProps {
  uploadState: Extract<UploadState, { type: 'failed_analysis' }>;
  onReset: () => void;
}

export const FailedAnalysisState: React.FC<FailedAnalysisStateProps> = ({
  uploadState,
  onReset,
}) => {
  const [showModal, setShowModal] = useState(false);
  const videoUrl = uploadState.videoFile?.signedUrl;

  return (
    <div className="mt-6 text-center flex flex-col items-center gap-6">
      {/* Error Banner */}
      <Card className="w-full max-w-md mx-auto border-red-200 bg-red-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <CardTitle className="text-red-800">Analysis Failed</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-red-700 mb-4">
            Video analysis encountered an error.
          </p>
          {uploadState.error && (
            <p className="text-sm text-red-600 mb-4 font-mono bg-red-100 p-2 rounded">
              {uploadState.error}
            </p>
          )}

          {/* Action Button */}
          <div className="flex justify-center">
            <Button
              onClick={onReset}
              variant="outline"
              className="px-6 py-2"
            >
              Ok
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Video Preview */}
      <div className="flex flex-col items-center gap-4">
        <video
          src={videoUrl!}
          className="mx-auto max-h-64 rounded-lg border bg-black cursor-pointer"
          style={{ maxWidth: 400 }}
          onClick={() => setShowModal(true)}
          controls
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
        <div className="text-sm text-muted-foreground">
          {uploadState.videoFile?.fileName}
        </div>
        {uploadState.analysisTaskId && (
          <div className="text-xs text-muted-foreground">
            Task ID: {uploadState.analysisTaskId}
          </div>
        )}
      </div>
    </div>
  );
};