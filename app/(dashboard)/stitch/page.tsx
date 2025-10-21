'use client';

import { useState } from 'react';
import { VideoSelector } from './VideoSelector';
import { FrameRenderer } from './FrameRenderer';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { VideoFile, VideoLoadResponse } from './FrameRenderer.types';

export default function StitchPage() {
  const [selectedVideo, setSelectedVideo] = useState<VideoFile | null>(null);
  const [sessionData, setSessionData] = useState<VideoLoadResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectVideo = async (video: VideoFile) => {
    setIsLoading(true);
    setError(null);

    try {
      // Load video session
      const videoPath = video.fullPath || (video.folder ? `${video.folder}${video.fileName}` : video.fileName);
      const response = await fetch('/api/stitch/video/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_path: videoPath,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to load video session');
      }

      const data: VideoLoadResponse = await response.json();
      setSessionData(data);
      setSelectedVideo(video);
    } catch (err) {
      console.error('Error loading video:', err);
      setError('Failed to load video session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToList = () => {
    setSelectedVideo(null);
    setSessionData(null);
    setError(null);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Video Stitcher</h1>
          <p className="text-muted-foreground mt-1">
            Frame-by-frame annotation and player stitching
          </p>
        </div>
        {selectedVideo && (
          <Button variant="outline" onClick={handleBackToList}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Videos
          </Button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <span>Loading video session...</span>
        </div>
      )}

      {/* Main Content */}
      {!isLoading && !selectedVideo && <VideoSelector onSelectVideo={handleSelectVideo} />}

      {!isLoading && selectedVideo && sessionData && (
        <div className="space-y-6">
          {/* Frame Renderer */}
          <div className="w-full">
            <FrameRenderer
              sessionId={sessionData.session_id}
              videoId={sessionData.video_id}
              totalFrames={sessionData.total_frames}
              onError={handleError}
            />
          </div>

          {/* Player List Placeholder */}
          <div className="w-full h-[300px] rounded-lg border-2 border-dashed border-border bg-muted/20 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium mb-2">Player List</p>
              <p className="text-sm">Coming soon: Player crops and assignments</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
