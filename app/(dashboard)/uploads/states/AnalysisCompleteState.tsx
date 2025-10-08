"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { UploadState } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';

interface AnalysisCompleteStateProps {
  uploadState: Extract<UploadState, { type: 'analysis_complete' }>;
  onReset: () => void;
}

export const AnalysisCompleteState: React.FC<AnalysisCompleteStateProps> = ({
  uploadState,
  onReset,
}) => {
  const router = useRouter();

  const handleStartPlayerIdentification = () => {
    // Navigate to dataprep page with video information as URL parameters
    const params = new URLSearchParams({
      fileName: uploadState.videoFile?.fileName || '',
      signedUrl: uploadState.videoFile?.signedUrl || '',
      autoStart: 'true' // Flag to indicate we should automatically start processing
    });
    router.push(`/dataprep?${params.toString()}`);
  };

  return (
    <div className="mt-6 text-center flex flex-col items-center gap-6">
      {/* Success Banner */}
      <Card className="w-full max-w-md mx-auto border-green-200 bg-green-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <CardTitle className="text-green-800">Analysis Complete!</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-green-700 mb-4">
            Do you want to start player identification?
          </p>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-center">
            <Button
              onClick={handleStartPlayerIdentification}
              className="px-6 py-2"
            >
              Yes
            </Button>
            <Button
              variant="outline"
              onClick={onReset}
              className="px-6 py-2"
            >
              Later
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Video Preview */}
      <div className="flex flex-col items-center gap-4">
        <video
          src={uploadState.videoFile?.signedUrl!}
          className="mx-auto max-h-64 rounded-lg border bg-black"
          style={{ maxWidth: 400 }}
          controls
        />
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