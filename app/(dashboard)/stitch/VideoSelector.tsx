'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Loader2 } from 'lucide-react';
import type { VideoFile } from './FrameRenderer.types';

interface VideoSelectorProps {
  onSelectVideo: (video: VideoFile) => void;
}

export function VideoSelector({ onSelectVideo }: VideoSelectorProps) {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/gcs/list_video?folder=process');
      
      if (!response.ok) {
        throw new Error('Failed to fetch videos');
      }

      const data = await response.json();
      setVideos(data.files || []);
    } catch (err) {
      console.error('Error fetching videos:', err);
      setError('Failed to load videos. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectVideo = (video: VideoFile) => {
    onSelectVideo(video);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>Loading videos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={fetchVideos}>Retry</Button>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No videos available for stitching.</p>
        <p className="text-sm text-muted-foreground">
          Upload videos in the Uploads section first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Select Video to Stitch</h2>
        <p className="text-muted-foreground">
          Choose a video to begin frame-by-frame annotation and player stitching.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {videos.map((video) => (
          <Card
            key={video.fileName}
            className="hover:border-primary transition-colors cursor-pointer"
            onClick={() => handleSelectVideo(video)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 mr-2">
                  <CardTitle className="text-base truncate mb-2">
                    {video.fileName}
                  </CardTitle>
                  <CardDescription className="space-y-1">
                    {video.size && (
                      <div className="text-xs">
                        Size: {formatFileSize(video.size)}
                      </div>
                    )}
                    {video.uploadedAt && (
                      <div className="text-xs">
                        Uploaded: {formatDate(video.uploadedAt)}
                      </div>
                    )}
                    {video.status && (
                      <div className="text-xs">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs ${
                            video.status === 'ready'
                              ? 'bg-green-100 text-green-800'
                              : video.status === 'processing'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {video.status}
                        </span>
                      </div>
                    )}
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectVideo(video);
                  }}
                >
                  <Play className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
