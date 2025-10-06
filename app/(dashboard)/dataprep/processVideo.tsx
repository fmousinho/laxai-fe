"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from '@/components/ui/button';
import { ErrorPage } from '@/components/ErrorPage';
import { useErrorHandler } from '@/lib/useErrorHandler';
import { SplitIcon } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import PlayerCrop from './playerView';
import TrackView from './trackView';

export type VideoFile = {
  fileName: string;
  signedUrl: string;
};

type ImagePair = {
  imagesA: string[];
  imagesB: string[];
  group1_id?: number;
  group2_id?: number;
};

interface ProcessVideoProps {
  video: VideoFile;
  onBackToList: () => void;
}

export default function ProcessVideo({ video, onBackToList }: ProcessVideoProps) {
  const [started, setStarted] = useState(false);
  const [imagePair, setImagePair] = useState<ImagePair | null>(null);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [suspended, setSuspended] = useState(false);
  const [imageLoadingStatesA, setImageLoadingStatesA] = useState<boolean[]>([]);
  const [imageLoadingStatesB, setImageLoadingStatesB] = useState<boolean[]>([]);

  const { error, handleFetchError, handleApiError, clearError } = useErrorHandler();

  // For lazy loading, track which images are in view (placeholder for now)
  const listARef = useRef<HTMLDivElement>(null);
  const listBRef = useRef<HTMLDivElement>(null);

  // Automatically start loading when component mounts
  useEffect(() => {
    handleStart();
  }, []);

  // Initialize loading states when imagePair changes
  useEffect(() => {
    if (imagePair) {
      setImageLoadingStatesA(new Array(imagePair.imagesA.length).fill(true));
      setImageLoadingStatesB(new Array(imagePair.imagesB.length).fill(true));
    }
  }, [imagePair]);

  const fetchPairForVideo = async (video: VideoFile) => {
    setLoading(true);
    clearError(); // Clear any previous errors

    // Extract just the video name from the full GCS path
    // video.fileName might be like "path/imported/video.mp4" or just "video.mp4"
    let processFolder = video.fileName;
    
    // If fileName contains "/imported/", extract just the base name
    if (processFolder.includes('/imported/')) {
      const parts = processFolder.split('/imported/');
      processFolder = parts[parts.length - 1]; // Get the last part (actual filename)
    }
    
    // Remove .mp4 extension if present (GCS directories drop the extension)
    processFolder = processFolder.replace(/\.mp4$/i, '');
    
    // Remove any leading/trailing whitespace and path separators
    processFolder = processFolder.trim().replace(/^\/+|\/+$/g, '');    console.log('Original fileName:', video.fileName);
    console.log('Extracted video_id:', processFolder);

    const url = `/api/dataprep/track_pair_for_verification`;
    console.log('Fetching pair for video from URL:', url);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ video_id: processFolder }),
      });
      console.log('Fetch response status:', res.status);
      const isOk = await handleFetchError(res, 'fetchPairForVideo');
      if (!isOk) {
        console.log('Fetch error handled');
        setLoading(false);
        return;
      }
      const data = await res.json();
      console.log('Received data:', data);

      // Validate the response format
      if (!data || typeof data !== 'object') {
        console.error('Invalid response format - expected object');
        handleApiError({ message: 'Invalid response format from server' }, 'fetchPairForVideo');
        setLoading(false);
        return;
      }

      if (!data.imagesA || !Array.isArray(data.imagesA) || !data.imagesB || !Array.isArray(data.imagesB)) {
        console.error('Invalid response format - expected imagesA and imagesB arrays');
        handleApiError({ message: 'Server returned invalid image data format' }, 'fetchPairForVideo');
        setLoading(false);
        return;
      }

      if (data.imagesA.length === 0 || data.imagesB.length === 0) {
        console.log('No images available for comparison');
        setImagePair(null);
        // Don't show as error, just no data available
      } else {
        setImagePair(data);
      }
    } catch (error) {
      console.error('Failed to fetch pair:', error);
      // For network errors, use handleApiError
      handleApiError(error, 'fetchPairForVideo');
    }
    setLoading(false);
  };

  const fetchPair = async () => {
    await fetchPairForVideo(video);
  };

  const handleStart = async () => {
    setStarted(true);
    setSuspended(false);
    await fetchPair();
  };

  const handleClassify = async (label: "same" | "different") => {
    setLoading(true);
    clearError(); // Clear any previous errors

    try {
      const res = await fetch("/api/dataprep/classify_pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const isOk = await handleFetchError(res, 'handleClassify');
      if (!isOk) {
        setLoading(false);
        return;
      }
      const responseData = await res.json();
      
      // Check if we got next images in the response
      if (responseData.next_images) {
        console.log('Received next images in classify response');
        setImagePair(responseData.next_images);
      } else {
        console.log('No more images available');
        setImagePair(null);
      }
    } catch (error) {
      console.error('Failed to classify pair:', error);
      handleApiError(error, 'handleClassify');
    }
    setLoading(false);
  };  const handleSuspend = async () => {
    setLoading(true);
    clearError(); // Clear any previous errors
    try {
      const res = await fetch("/api/dataprep/suspend", {
        method: "POST",
      });
      const isOk = await handleFetchError(res, 'handleSuspend');
      if (!isOk) {
        setLoading(false);
        return;
      }
      setStarted(false);
      setSuspended(true);
      setImagePair(null);
    } catch (error) {
      console.error('Failed to suspend:', error);
      handleApiError(error, 'handleSuspend');
    }
    setLoading(false);
  };

  const handleSplitTrack = async (trackId: number, cropImageName: string) => {
    setLoading(true);
    clearError();

    try {
      // First, call the split_track API
      const splitRes = await fetch("/api/dataprep/split_track", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          track_id: trackId,
          crop_image_name: cropImageName
        }),
      });

      const splitIsOk = await handleFetchError(splitRes, 'handleSplitTrack');
      if (!splitIsOk) {
        setLoading(false);
        return;
      }

      console.log('Track split successfully');

      // Then, fetch new verification images
      await fetchPairForVideo(video);
    } catch (error) {
      console.error('Failed to split track:', error);
      handleApiError(error, 'handleSplitTrack');
      setLoading(false);
    }
  };

  if (error) {
    return (
      <ErrorPage
        error={error}
        onRetry={clearError}
        onDismiss={onBackToList}
        customActions={
          <>
            <Button
              onClick={clearError}
              variant="outline"
            >
              Try Again
            </Button>
            <Button
              onClick={onBackToList}
              variant="default"
            >
              Back to Videos
            </Button>
          </>
        }
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] w-full px-0 sm:px-4 max-w-screen-lg mx-auto">
      <div className="w-full flex justify-between items-center mb-6">
        <Button
          variant="outline"
          onClick={onBackToList}
        >
          ← Back to Videos
        </Button>
        <div className="text-sm text-muted-foreground">
          Preparing: {video.fileName}
        </div>
      </div>

      {!started && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-lg font-medium mb-2">Preparing video for data classification</p>
            <p className="text-sm text-muted-foreground">Loading track images...</p>
          </div>
        </div>
      )}

      {started && !imagePair && !loading && (
        <div className="text-center py-8">
          <div className="mb-4">
            <div className="text-lg font-medium text-orange-600 mb-2">⏳ Video Not Ready</div>
            <p className="text-muted-foreground mb-2">This video hasn't been processed for data preparation yet.</p>
            <p className="text-sm text-muted-foreground">Please ensure the video has been through the analysis pipeline first.</p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={onBackToList}
              variant="outline"
            >
              Back to Videos
            </Button>
            <Button
              onClick={() => window.open('/uploads', '_blank')}
              variant="default"
            >
              Process Video
            </Button>
          </div>
        </div>
      )}

      {started && imagePair && (
        <>
          <h2 className="text-lg font-semibold mt-2 mb-1 text-center">Are these images from the same player?</h2>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Loading next images...</p>
              </div>
            </div>
          ) : (
            <div className="transition-opacity duration-300 ease-in-out w-full overflow-hidden">
              <TrackView
                images={imagePair.imagesA}
                ref={listARef}
                trackId={imagePair.group1_id}
                loadingStates={imageLoadingStatesA}
                setLoadingStates={setImageLoadingStatesA}
                onSplit={handleSplitTrack}
              />
              <TrackView
                images={imagePair.imagesB}
                ref={listBRef}
                trackId={imagePair.group2_id}
                loadingStates={imageLoadingStatesB}
                setLoadingStates={setImageLoadingStatesB}
                onSplit={handleSplitTrack}
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-6 mt-4 w-full max-w-xl">
            <button
              className="w-full px-6 py-3 rounded-lg bg-green-600 text-white font-semibold shadow hover:bg-green-700 transition disabled:opacity-50"
              onClick={() => handleClassify("same")}
              disabled={loading}
            >
              Same
            </button>
            <button
              className="w-full px-6 py-3 rounded-lg bg-red-600 text-white font-semibold shadow hover:bg-red-700 transition disabled:opacity-50"
              onClick={() => handleClassify("different")}
              disabled={loading}
            >
              Different
            </button>
            <button
              className="w-full px-6 py-3 rounded-lg bg-amber-500 text-white font-semibold shadow hover:bg-amber-600 transition disabled:opacity-50"
              onClick={() => {/* TODO: implement skip behavior */}}
              disabled={loading}
            >
              Skip
            </button>
          </div>

          <div className="mt-10">
            <button
              className="px-6 py-2 rounded-full bg-gray-200 text-gray-700 font-medium hover:bg-gray-300 transition"
              onClick={handleSuspend}
              disabled={loading}
            >
              Suspend Classification
            </button>
          </div>
        </>
      )}

      {started && !imagePair && !loading && (
        <div className="text-center py-8">
          <div className="mb-4">
            <div className="text-lg font-medium text-orange-600 mb-2">⏳ Video Not Ready</div>
            <p className="text-muted-foreground mb-2">This video hasn't been processed for data preparation yet.</p>
            <p className="text-sm text-muted-foreground">Please ensure the video has been through the analysis pipeline first.</p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={onBackToList}
              variant="outline"
            >
              Back to Videos
            </Button>
            <Button
              onClick={() => window.open('/uploads', '_blank')}
              variant="default"
            >
              Process Video
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}