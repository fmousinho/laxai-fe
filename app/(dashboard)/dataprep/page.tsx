"use client";

import React, { useState } from "react";
import ListVideos, { VideoFile } from './listVideos';
import ProcessVideo from './processVideo';

export default function DataPrepPage() {
  const [view, setView] = useState<'list' | 'process'>('list');
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
      {view === 'list' ? (
        <ListVideos onPrepareVideo={handlePrepareVideo} />
      ) : (
        selectedVideo && <ProcessVideo video={selectedVideo} onBackToList={handleBackToList} />
      )}
    </div>
  );
}
