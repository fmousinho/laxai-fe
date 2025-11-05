'use client';

import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { VideoSelector } from './VideoSelector';
import { FrameRenderer } from './FrameRenderer';
import { PlayerList } from '@/components/ui/PlayerList';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { VideoFile, VideoLoadResponse } from './FrameRenderer.types';

export default function StitchPage() {
  const [selectedVideo, setSelectedVideo] = useState<VideoFile | null>(null);
  const [sessionData, setSessionData] = useState<VideoLoadResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playersRefreshTick, setPlayersRefreshTick] = useState(0);
  const [frameRefreshTrigger, setFrameRefreshTrigger] = useState(0);
  const [selectedTrackerId, setSelectedTrackerId] = useState<number | null>(null);
  const [selectedBbox, setSelectedBbox] = useState<{ player_id: number; tracker_id?: number; bbox?: [number, number, number, number] } | null>(null);
  const [frameWidth, setFrameWidth] = useState<number>(100); // percentage
  const resizeRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

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
      console.log('📹 Video load response:', data);
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
    setPlayersRefreshTick(0);
    setFrameRefreshTrigger(0);
    setSelectedBbox(null);
    setSelectedTrackerId(null);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handlePlayerCreated = () => {
    // Trigger frame refresh to update annotations with new player_id
    setFrameRefreshTrigger((t) => t + 1);
    // Also refresh player list
    setPlayersRefreshTick((t) => t + 1);
    // Clear selection
    setSelectedBbox(null);
    setSelectedTrackerId(null);
  };

  // Resizing logic
  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !resizeRef.current) return;
      const containerRect = resizeRef.current.parentElement?.getBoundingClientRect();
      if (!containerRect) return;
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      setFrameWidth(Math.min(Math.max(newWidth, 30), 90)); // clamp between 30% and 90%
    },
    [isResizing]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

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
          {/* Frame Renderer - Resizable Width */}
          <div className="flex gap-4 items-start relative">
            <div 
              ref={resizeRef}
              style={{ width: `${frameWidth}%` }}
              className="transition-none"
            >
              <FrameRenderer
                sessionId={sessionData.session_id}
                videoId={sessionData.video_id}
                totalFrames={sessionData.total_frames}
                refreshTrigger={frameRefreshTrigger}
                onError={handleError}
                onFrameLoaded={() => {
                  setPlayersRefreshTick((t) => t + 1);
                  // Do not clear selection; let FrameRenderer auto-emphasize unknown bbox
                }}
                selectedBbox={selectedBbox}
                onSelectionChange={(sel) => {
                  // Store the full selection for highlighting
                  setSelectedBbox(sel);
                  
                  // Enable creation only when the selected bbox has player_id = -1 and a valid tracker_id
                  const tracker = sel && typeof sel.tracker_id === 'number' && sel.tracker_id >= 0 ? sel.tracker_id : null;
                  const eligible = sel && sel.player_id === -1 && tracker !== null ? tracker : null;
                  setSelectedTrackerId(eligible);
                }}
                onAssignmentDone={handlePlayerCreated}
              />
            </div>

            {/* Resize Handle */}
            <div
              className="h-8 w-1 bg-border hover:bg-primary cursor-col-resize flex-shrink-0 relative group self-center"
              onMouseDown={handleMouseDown}
            >
              <div className="absolute inset-y-0 -left-1 -right-1" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <svg className="w-4 h-8 text-muted-foreground" fill="currentColor" viewBox="0 0 16 32">
                  <circle cx="4" cy="10" r="1.5" />
                  <circle cx="4" cy="16" r="1.5" />
                  <circle cx="4" cy="22" r="1.5" />
                  <circle cx="12" cy="10" r="1.5" />
                  <circle cx="12" cy="16" r="1.5" />
                  <circle cx="12" cy="22" r="1.5" />
                </svg>
              </div>
            </div>
          </div>

          {/* Player Management - Below Frame */}
          <div className="w-full">
            <PlayerList 
              sessionId={sessionData.session_id} 
              videoId={sessionData.video_id}
              refreshKey={playersRefreshTick}
              selectedUnassignedTrackerId={selectedTrackerId}
              onPlayerCreated={handlePlayerCreated}
            />
          </div>
        </div>
      )}
    </div>
  );
}
