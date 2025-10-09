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
  thumbnailUrl?: string;
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
  onClassificationComplete: () => void;
}

export default function ProcessVideo({ video, onBackToList, onClassificationComplete }: ProcessVideoProps) {
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

  // Monitor for empty dataprep groups and log errors
  useEffect(() => {
    if (started && !loading) {
      if (!imagePair) {
        console.error('🚨 DATAPREP GROUP ERROR: No image pair available for verification', {
          video: video.fileName,
          started,
          loading,
          suspended,
          timestamp: new Date().toISOString(),
          troubleshooting: 'This indicates the video has not been processed or all verification pairs have been exhausted'
        });
      } else {
        if (!imagePair.imagesA || imagePair.imagesA.length === 0) {
          console.error('🚨 DATAPREP GROUP ERROR: Group A (imagesA) is empty', {
            video: video.fileName,
            group1_id: imagePair.group1_id,
            imagesA_length: imagePair.imagesA?.length || 0,
            imagesB_length: imagePair.imagesB?.length || 0,
            timestamp: new Date().toISOString(),
            troubleshooting: 'Group A has no images to display. Check if track splitting or image extraction failed.'
          });
        }
        if (!imagePair.imagesB || imagePair.imagesB.length === 0) {
          console.error('🚨 DATAPREP GROUP ERROR: Group B (imagesB) is empty', {
            video: video.fileName,
            group2_id: imagePair.group2_id,
            imagesA_length: imagePair.imagesA?.length || 0,
            imagesB_length: imagePair.imagesB?.length || 0,
            timestamp: new Date().toISOString(),
            troubleshooting: 'Group B has no images to display. Check if track splitting or image extraction failed.'
          });
        }
      }
    }
  }, [started, loading, imagePair, video.fileName]);

  // Initialize loading states when imagePair changes
  useEffect(() => {
    if (imagePair) {
      setImageLoadingStatesA(new Array(imagePair.imagesA.length).fill(true));
      setImageLoadingStatesB(new Array(imagePair.imagesB.length).fill(true));
    }
  }, [imagePair]);

  const fetchPair = async () => {
    await fetchNextVerificationPair();
  };

  const fetchNextVerificationPair = async () => {
    setLoading(true);
    clearError();

    try {
      const res = await fetch("/api/dataprep/next_verification_pair", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      console.log('Fetch next verification pair response status:', res.status);
      const isOk = await handleFetchError(res, 'fetchNextVerificationPair');
      if (!isOk) {
        console.log('Fetch error handled');
        // Check if this is a 404 - which means no more verification pairs available
        if (res.status === 404) {
          console.log('Classification complete - no more verification pairs available (404)');
          onClassificationComplete();
          return;
        }
        setLoading(false);
        return;
      }
      const data = await res.json();
      console.log('Received next verification pair data:', JSON.stringify(data, null, 2));

      // Check if classification is complete
      if (data.status === 'complete') {
        console.log('Classification complete - all tracks have been assigned to players');
        onClassificationComplete();
        return;
      }

      // Validate the response format
      if (!data || typeof data !== 'object') {
        console.error('Invalid response format - expected object');
        handleApiError({ message: 'Invalid response format from server' }, 'fetchNextVerificationPair');
        setLoading(false);
        return;
      }

      if (!data.imagesA || !Array.isArray(data.imagesA) || !data.imagesB || !Array.isArray(data.imagesB)) {
        console.error('🚨 DATAPREP API ERROR: Invalid API response format', {
          video: video.fileName,
          hasImagesA: !!data.imagesA,
          imagesA_isArray: Array.isArray(data.imagesA),
          imagesA_length: data.imagesA?.length || 'N/A',
          hasImagesB: !!data.imagesB,
          imagesB_isArray: Array.isArray(data.imagesB),
          imagesB_length: data.imagesB?.length || 'N/A',
          fullResponse: data,
          timestamp: new Date().toISOString(),
          troubleshooting: 'The API response does not contain valid imagesA and imagesB arrays. Check the backend API implementation.'
        });
        console.error('Invalid response format - expected imagesA and imagesB arrays');
        handleApiError({ message: 'Server returned invalid image data format' }, 'fetchNextVerificationPair');
        setLoading(false);
        return;
      }

      if (data.imagesA.length === 0 || data.imagesB.length === 0) {
        console.log('Classification complete - no more images available for verification', {
          imagesA_length: data.imagesA.length,
          imagesB_length: data.imagesB.length,
          total_pairs: data.total_pairs,
          verified_pairs: data.verified_pairs,
          status: data.status
        });
        onClassificationComplete();
        return;
      } else {
        console.log('Setting image pair with', data.imagesA.length, 'imagesA and', data.imagesB.length, 'imagesB');
        setImagePair(data);
      }
    } catch (error) {
      console.error('Failed to fetch next verification pair:', error);
      handleApiError(error, 'fetchNextVerificationPair');
    }
    setLoading(false);
  };

  const handleStart = async () => {
    setStarted(true);
    setSuspended(false);
    setLoading(true);
    clearError();

    try {
      // First, start a verification session
      const sessionRes = await fetch("/api/dataprep/start_verification_session", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_id: video.fileName.replace(/\.mp4$/i, '') // Remove .mp4 extension
        }),
      });

      const sessionIsOk = await handleFetchError(sessionRes, 'handleStart');
      if (!sessionIsOk) {
        setLoading(false);
        setStarted(false);
        return;
      }

      console.log('Verification session started successfully');

      // Then, fetch the first verification pair
      await fetchNextVerificationPair();
    } catch (error) {
      console.error('Failed to start verification session:', error);
      handleApiError(error, 'handleStart');
      setLoading(false);
      setStarted(false);
    }
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
      
      // Check if classification is complete
      if (responseData.status === 'complete') {
        console.log('Classification complete - all tracks have been assigned to players');
        onClassificationComplete();
        return;
      }
      
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
  };

  const handleSkip = async () => {
    setLoading(true);
    clearError(); // Clear any previous errors

    try {
      const res = await fetch("/api/dataprep/classify_pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "skip" }),
      });
      const isOk = await handleFetchError(res, 'handleSkip');
      if (!isOk) {
        setLoading(false);
        return;
      }
      const responseData = await res.json();
      
      // Check if classification is complete
      if (responseData.status === 'complete') {
        console.log('Classification complete - all tracks have been assigned to players');
        onClassificationComplete();
        return;
      }
      
      // Check if we got next images in the response
      if (responseData.next_images) {
        console.log('Received next images in skip response');
        setImagePair(responseData.next_images);
      } else {
        console.log('No more images available');
        setImagePair(null);
      }
    } catch (error) {
      console.error('Failed to skip pair:', error);
      handleApiError(error, 'handleSkip');
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

      // Then, fetch the next verification pair (without starting a new session)
      await fetchNextVerificationPair();
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
            <div className="flex items-center justify-center" style={{ height: '564px' }}>
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Loading next images...</p>
              </div>
            </div>
          ) : (
            <div className="transition-opacity duration-300 ease-in-out w-full overflow-hidden" style={{ height: '564px', minHeight: '564px' }}>
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
              onClick={handleSkip}
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