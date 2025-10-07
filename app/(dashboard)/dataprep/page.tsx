"use client";

import React, { useState } from "react";
import ListVideos, { VideoFile } from './listVideos';
import ProcessVideo from './processVideo';
import { TrackViewDemo } from './trackView';
import { TrackingJobsList } from './trackingJobs';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function DataPrepPage() {
  const [view, setView] = useState<'list' | 'process' | 'demo' | 'tracking'>('list');
  const [selectedVideo, setSelectedVideo] = useState<VideoFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handlePrepareVideo = (video: VideoFile) => {
    setSelectedVideo(video);
    setView('process');
  };

  const handleBackToList = () => {
    setView('list');
    setSelectedVideo(null);
  };

  const handleViewChange = (newView: typeof view) => {
    setIsLoading(true);
    setView(newView);
    // Reset loading after a short delay to allow component to mount
    setTimeout(() => setIsLoading(false), 100);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      {/* Navigation */}
      <div className="mb-6 flex gap-2 flex-wrap">
        <Button
          variant={view === 'list' ? 'default' : 'outline'}
          onClick={() => handleViewChange('list')}
        >
          Video List
        </Button>
        <Button
          variant={view === 'demo' ? 'default' : 'outline'}
          onClick={() => handleViewChange('demo')}
        >
          TrackView Demo
        </Button>
        <Button
          variant={view === 'tracking' ? 'default' : 'outline'}
          onClick={() => handleViewChange('tracking')}
        >
          Tracking Jobs
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <span>Loading...</span>
        </div>
      ) : view === 'list' ? (
        <ListVideos onPrepareVideo={handlePrepareVideo} />
      ) : view === 'process' ? (
        selectedVideo && <ProcessVideo video={selectedVideo} onBackToList={handleBackToList} />
      ) : view === 'demo' ? (
        <TrackViewDemo />
      ) : view === 'tracking' ? (
        <TrackingJobsList isActive={view === 'tracking'} />
      ) : (
        <TrackViewDemo />
      )}
    </div>
  );
}
