"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';

export type VideoFile = {
  fileName: string;
  signedUrl: string;
};

interface ListVideosProps {
  onPrepareVideo: (video: VideoFile) => void;
}

export default function ListVideos({ onPrepareVideo }: ListVideosProps) {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);

  // Fetch videos on mount
  useEffect(() => {
    const fetchVideos = async () => {
      setLoadingVideos(true);
      try {
        const { data } = await axios.get('/api/gcs/list_video?folder=imported');
        console.log('GCS list_video response:', data);
        setVideos(data.files || []);
      } catch (err) {
        console.error('Failed to load videos:', err);
        setVideos([]);
      } finally {
        setLoadingVideos(false);
      }
    };
    fetchVideos();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Preparation</CardTitle>
        <CardDescription>
          Select a video to prepare for data classification tasks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadingVideos ? (
          <div className="text-center py-8">Loading videos...</div>
        ) : videos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No videos available. Please upload some videos first.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Thumbnail</TableHead>
                <TableHead>Video Name</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {videos.map((video, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <video
                      src={video.signedUrl}
                      className="w-16 h-12 object-cover rounded"
                      muted
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {video.fileName}
                  </TableCell>
                  <TableCell>
                    <Button
                      onClick={() => onPrepareVideo(video)}
                      size="sm"
                    >
                      Prepare
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}