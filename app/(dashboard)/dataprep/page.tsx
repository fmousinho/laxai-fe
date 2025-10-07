"use client";

import React, { useState } from "react";
import ListVideos, { VideoFile } from './listVideos';
import ProcessVideo from './processVideo';
import { TrackViewDemo } from './trackView';
import { TrackingJobsList } from './trackingJobs';
import { Button } from '@/components/ui/button';

export default function DataPrepPage() {
  const [view, setView] = useState<'list' | 'process' | 'demo' | 'tracking'>('list');
  const [selectedVideo, setSelectedVideo] = useState<VideoFile | null>(null);

  const handlePrepareVideo = (video: VideoFile) => {
    setSelectedVideo(video);
    setView('process');
  };

  const handleBackToList = () => {
    setView('list');
    setSelectedVideo(null);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      {/* Navigation */}
      <div className="mb-6 flex gap-2 flex-wrap">
        <Button
          variant={view === 'list' ? 'default' : 'outline'}
          onClick={() => setView('list')}
        >
          Video List
        </Button>
        <Button
          variant={view === 'demo' ? 'default' : 'outline'}
          onClick={() => setView('demo')}
        >
          TrackView Demo
        </Button>
        <Button
          variant={view === 'tracking' ? 'default' : 'outline'}
          onClick={() => setView('tracking')}
        >
          Tracking Jobs
        </Button>
      </div>

      {view === 'list' ? (
        <ListVideos onPrepareVideo={handlePrepareVideo} />
      ) : view === 'process' ? (
        selectedVideo && <ProcessVideo video={selectedVideo} onBackToList={handleBackToList} />
      ) : view === 'demo' ? (
        <TrackViewDemo />
      ) : view === 'tracking' ? (
        <TrackingJobsList />
      ) : (
        <TrackViewDemo />
      )}
    </div>
  );
}
