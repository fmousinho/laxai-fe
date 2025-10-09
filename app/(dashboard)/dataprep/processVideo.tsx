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
  pair_id?: string; // Add pair_id field
};

interface ProcessVideoProps {
  video: VideoFile;
  onBackToList: () => void;
  onClassificationComplete: () => void;
}

export default function ProcessVideo({ video, onBackToList, onClassificationComplete }: ProcessVideoProps) {
  const [started, setStarted] = useState(false);
  const [imagePair, setImagePair] = useState<ImagePair | null>(null);
  const [nextImagePair, setNextImagePair] = useState<ImagePair | null>(null); // Prefetched next pair
  const [loading, setLoading] = useState(true); // Start with loading true
  const [suspended, setSuspended] = useState(false);
  const [prefetching, setPrefetching] = useState(false); // Track if we're currently prefetching
  const [nextImagesReady, setNextImagesReady] = useState(false); // Track if next pair images are preloaded
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
      if (!imagePair && !nextImagePair) {
        console.error('🚨 DATAPREP GROUP ERROR: No image pair available for verification', {
          video: video.fileName,
          started,
          loading,
          suspended,
          hasCurrentPair: !!imagePair,
          hasNextPair: !!nextImagePair,
          prefetching,
          timestamp: new Date().toISOString(),
          troubleshooting: 'This indicates the video has not been processed or all verification pairs have been exhausted'
        });
      } else if (imagePair) {
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
  }, [started, loading, imagePair, nextImagePair, prefetching, video.fileName]);

  // Initialize loading states when imagePair changes
  useEffect(() => {
    if (imagePair) {
      console.log(`🎯 Setting up loading states for new imagePair: ${imagePair.imagesA.length}A + ${imagePair.imagesB.length}B images`);
      setImageLoadingStatesA(new Array(imagePair.imagesA.length).fill(true));
      setImageLoadingStatesB(new Array(imagePair.imagesB.length).fill(true));
      setLoading(true); // Keep loading true until all images load
    }
  }, [imagePair]);

  // Set loading to false when all images have loaded
  useEffect(() => {
    if (imagePair && imageLoadingStatesA.length > 0 && imageLoadingStatesB.length > 0) {
      const allALoaded = imageLoadingStatesA.every(state => !state);
      const allBLoaded = imageLoadingStatesB.every(state => !state);
      console.log(`🔄 Loading check - A: ${imageLoadingStatesA.length} images, all loaded: ${allALoaded}`);
      console.log(`🔄 Loading check - B: ${imageLoadingStatesB.length} images, all loaded: ${allBLoaded}`);
      console.log(`🔄 Loading check - Current loading state: ${loading}`);
      if (allALoaded && allBLoaded) {
        console.log(`✅ All images loaded, setting loading to false`);
        setLoading(false);
      }
    }
  }, [imageLoadingStatesA, imageLoadingStatesB, imagePair]);

  // Preload images for the next pair in the background
  useEffect(() => {
    if (!nextImagePair) {
      setNextImagesReady(false);
      return;
    }

    const allImages = [...nextImagePair.imagesA, ...nextImagePair.imagesB];
    let loadedCount = 0;

    const imagePromises = allImages.map((src) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          loadedCount++;
          resolve();
        };
        img.onerror = () => {
          loadedCount++;
          resolve(); // Still resolve even on error to avoid hanging
        };
        img.src = src;
      });
    });

    Promise.all(imagePromises).then(() => {
      console.log(`✅ Preloaded ${loadedCount}/${allImages.length} images for next pair`);
      setNextImagesReady(true);
    });
  }, [nextImagePair]);

  // Add keyboard shortcuts for classification
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle shortcuts when we have an image pair and are not loading
      if (!imagePair || loading) return;

      switch (event.key.toLowerCase()) {
        case 's':
          event.preventDefault();
          handleClassify("same");
          break;
        case 'd':
          event.preventDefault();
          handleClassify("different");
          break;
        case 'k':
          event.preventDefault();
          handleSkip();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [imagePair, loading]);

  const fetchPair = async () => {
    await fetchNextVerificationPair();
  };

  const fetchNextVerificationPair = async (isPrefetch: boolean = false) => {
    if (isPrefetch && prefetching) {
      // Already prefetching, don't start another request
      return;
    }

    if (isPrefetch) {
      setPrefetching(true);
    } else {
      setLoading(true);
    }
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
        if (isPrefetch) {
          setPrefetching(false);
        } else {
          setLoading(false);
        }
        return;
      }
      const data = await res.json();
      console.log('Received next verification pair data:', JSON.stringify(data, null, 2));

      // Check if classification is complete
      if (data.status === 'complete') {
        console.log('Classification complete - all tracks have been assigned to players');
        if (isPrefetch) {
          // During prefetch, just mark that we're done prefetching
          setPrefetching(false);
        } else {
          // During normal fetch, complete the classification
          onClassificationComplete();
        }
        return;
      }

      // Validate the response format
      if (!data || typeof data !== 'object') {
        console.error('Invalid response format - expected object');
        handleApiError({ message: 'Invalid response format from server' }, 'fetchNextVerificationPair');
        if (isPrefetch) {
          setPrefetching(false);
        } else {
          setLoading(false);
        }
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
        if (isPrefetch) {
          setPrefetching(false);
        } else {
          setLoading(false);
        }
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
        if (isPrefetch) {
          setNextImagePair(data);
          setPrefetching(false);
        } else {
          setImagePair(data);
          // After setting the current pair, prefetch the next one ONLY if we don't already have one
          if (!nextImagePair && !prefetching) {
            setTimeout(() => fetchNextVerificationPair(true), 100); // Small delay to avoid overwhelming the server
          }
          // Don't set loading to false here - let the useEffect handle it when images load
        }
      }
    } catch (error) {
      console.error('Failed to fetch next verification pair:', error);
      handleApiError(error, 'fetchNextVerificationPair');
    }
    
    if (isPrefetch) {
      setPrefetching(false);
    }
    // For non-prefetch, loading is managed by the useEffect when images load
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
    if (!imagePair?.pair_id) {
      console.error('No pair_id available for classification');
      handleApiError({ message: 'Missing pair ID for classification' }, 'handleClassify');
      return;
    }

    // Only show loading if we don't have a preloaded next pair ready
    const hasPreloadedPair = nextImagePair && nextImagesReady;
    if (!hasPreloadedPair) {
      setLoading(true);
    }
    clearError(); // Clear any previous errors

    try {
      const res = await fetch("/api/dataprep/classify_pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, pair_id: imagePair.pair_id }),
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
      
      // Check if we got next images in the response (fallback)
      if (responseData.next_images) {
        console.log('Received next images in classify response');
        setImagePair(responseData.next_images);
        setLoading(false);
        // Prefetch the next pair ONLY if we don't already have one
        if (!nextImagePair && !prefetching) {
          setTimeout(() => fetchNextVerificationPair(true), 100);
        }
      } else if (nextImagePair) {
        // Use the prefetched pair (images are already loaded!)
        console.log('Using prefetched pair (images ready:', nextImagesReady, ')');
        setImagePair(nextImagePair);
        setNextImagePair(null);
        setNextImagesReady(false);
        // Since images are preloaded, set loading states to false immediately
        setImageLoadingStatesA(new Array(nextImagePair.imagesA.length).fill(false));
        setImageLoadingStatesB(new Array(nextImagePair.imagesB.length).fill(false));
        setLoading(false);
        // Prefetch a new next pair since we just consumed the previous one
        setTimeout(() => fetchNextVerificationPair(true), 100);
      } else {
        console.log('No more images available');
        setImagePair(null);
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to classify pair:', error);
      handleApiError(error, 'handleClassify');
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!imagePair?.pair_id) {
      console.error('No pair_id available for skip');
      handleApiError({ message: 'Missing pair ID for skip' }, 'handleSkip');
      return;
    }

    // Only show loading if we don't have a preloaded next pair ready
    const hasPreloadedPair = nextImagePair && nextImagesReady;
    if (!hasPreloadedPair) {
      setLoading(true);
    }
    clearError(); // Clear any previous errors

    try {
      const res = await fetch("/api/dataprep/classify_pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "skip", pair_id: imagePair.pair_id }),
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
      
      // Check if we got next images in the response (fallback)
      if (responseData.next_images) {
        console.log('Received next images in skip response');
        setImagePair(responseData.next_images);
        setLoading(false);
        // Prefetch the next pair ONLY if we don't already have one
        if (!nextImagePair && !prefetching) {
          setTimeout(() => fetchNextVerificationPair(true), 100);
        }
      } else if (nextImagePair) {
        // Use the prefetched pair (images are already loaded!)
        console.log('Using prefetched pair (images ready:', nextImagesReady, ')');
        setImagePair(nextImagePair);
        setNextImagePair(null);
        setNextImagesReady(false);
        // Since images are preloaded, set loading states to false immediately
        setImageLoadingStatesA(new Array(nextImagePair.imagesA.length).fill(false));
        setImageLoadingStatesB(new Array(nextImagePair.imagesB.length).fill(false));
        setLoading(false);
        // Prefetch a new next pair since we just consumed the previous one
        setTimeout(() => fetchNextVerificationPair(true), 100);
      } else {
        console.log('No more images available');
        setImagePair(null);
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to skip pair:', error);
      handleApiError(error, 'handleSkip');
      setLoading(false);
    }
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
      setNextImagePair(null);
      setNextImagesReady(false);
      // Navigate back to the list view after suspending
      onBackToList();
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

      {started && (
        <>
          <h2 className="text-lg font-semibold mt-2 mb-1 text-center">Are these images from the same player?</h2>
          <div className="transition-opacity duration-300 ease-in-out w-full overflow-hidden" style={{ height: '564px', minHeight: '564px' }}>
            <TrackView
              images={imagePair?.imagesA || []}
              ref={listARef}
              trackId={imagePair?.group1_id ?? -1}
              loadingStates={imageLoadingStatesA}
              setLoadingStates={setImageLoadingStatesA}
              onSplit={handleSplitTrack}
              skeletonCount={imagePair ? undefined : 4} // Show 4 skeletons when no imagePair yet
            />
            <TrackView
              images={imagePair?.imagesB || []}
              ref={listBRef}
              trackId={imagePair?.group2_id ?? -2}
              loadingStates={imageLoadingStatesB}
              setLoadingStates={setImageLoadingStatesB}
              onSplit={handleSplitTrack}
              skeletonCount={imagePair ? undefined : 2} // Show 2 skeletons when no imagePair yet
            />
          </div>

          {imagePair && (
            <>
              <div className="grid grid-cols-3 gap-6 mt-4 w-full max-w-xl">
                <button
                  className="w-full px-6 py-3 rounded-lg bg-green-600 text-white font-semibold shadow hover:bg-green-700 transition disabled:opacity-50"
                  onClick={() => handleClassify("same")}
                  disabled={loading}
                >
                  <u>S</u>ame
                </button>
                <button
                  className="w-full px-6 py-3 rounded-lg bg-red-600 text-white font-semibold shadow hover:bg-red-700 transition disabled:opacity-50"
                  onClick={() => handleClassify("different")}
                  disabled={loading}
                >
                  <u>D</u>ifferent
                </button>
                <button
                  className="w-full px-6 py-3 rounded-lg bg-amber-500 text-white font-semibold shadow hover:bg-amber-600 transition disabled:opacity-50"
                  onClick={handleSkip}
                  disabled={loading}
                >
                  S<u>k</u>ip
                </button>
              </div>

              <div className="mt-2 text-center text-sm text-muted-foreground">
                Keyboard shortcuts: <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">S</kbd> Same • <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">D</kbd> Different • <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">K</kbd> Skip
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