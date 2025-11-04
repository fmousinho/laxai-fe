'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAnnotationCanvas } from './useAnnotationCanvas';
import type { Recipe, FrameMetadata, ApiAnnotationsResponse, AnnotationInstruction } from './FrameRenderer.types';

interface FrameRendererProps {
  sessionId: string;
  videoId: string;
  totalFrames: number;
  onError?: (error: string) => void;
  /**
   * Called after a frame (initial, next, or previous) has been fully loaded
   * (image + annotations) and currentFrameId is updated.
   */
  onFrameLoaded?: (frameId: number) => void;
  /**
   * Called when user clicks a bbox on the canvas. Provides player_id and tracker_id (if any).
   */
  onSelectionChange?: (sel: { tracker_id?: number; player_id: number } | null) => void;
}

export function FrameRenderer({
  sessionId,
  videoId,
  totalFrames,
  onError,
  onFrameLoaded,
  onSelectionChange,
}: FrameRendererProps) {
  const [currentFrameId, setCurrentFrameId] = useState<number>(0);
  const [currentRecipe, setCurrentRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNext, setHasNext] = useState(true);
  const [hasPrevious, setHasPrevious] = useState(false);
  const hasLoadedInitialFrameRef = useRef(false);

  const { canvasRef, loadFrame } = useAnnotationCanvas({
    sessionId,
    currentFrameId,
    currentRecipe,
    onSelectionChange,
  });

  /**
   * Convert API response to Recipe format
   */
  const convertApiResponseToRecipe = useCallback((apiResponse: ApiAnnotationsResponse): Recipe => {
    const instructions: AnnotationInstruction[] = [];

    // Convert detections to annotation instructions
    if (apiResponse.detections && apiResponse.detections.xyxy) {
      apiResponse.detections.xyxy.forEach((bbox, index) => {
        const [x1, y1, x2, y2] = bbox;
        const confidence = apiResponse.detections.confidence?.[index] || 0;
        const classId = apiResponse.detections.class_id?.[index] || 0;
        const trackerId = apiResponse.detections.tracker_id?.[index] ?? -1;
        const oldTrackerId = apiResponse.detections.data?.old_tracker_id?.[index];
        // Prefer actual trackerId when available; otherwise fall back to old_tracker_id from metadata
        // const effectiveTrackerId = (typeof trackerId === 'number' && trackerId >= 0)
        //   ? trackerId
        //   : (typeof oldTrackerId === 'number' && oldTrackerId >= 0 ? oldTrackerId : -1);
        const effectiveTrackerId = (typeof oldTrackerId === 'number' && oldTrackerId >= 0 ? oldTrackerId : -1);
        instructions.push({
          type: 'bbox',
          coords: [x1, y1, x2, y2],
          player_id: trackerId, // Keep label semantics: P-1 when unassigned
          tracker_id: effectiveTrackerId,
          confidence: confidence,
          label_text: `P${trackerId}`,
          style_preset: 'default'
        });
      });
    }

    return {
      frame_id: apiResponse.frame_id,
      video_id: apiResponse.video_id,
      instructions: instructions
    };
  }, []);

  /**
   * Fetch recipe for current frame
   */
  const fetchRecipe = useCallback(
    async (frameId: number) => {
      try {
        const response = await fetch(
          `/api/stitch/video/frames/${sessionId}/${frameId}/annotations`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch annotations');
        }

        const apiResponse: ApiAnnotationsResponse = await response.json();
        const recipe = convertApiResponseToRecipe(apiResponse);
        setCurrentRecipe(recipe);
      } catch (error) {
        console.error('Error fetching annotations:', error);
        onError?.('Failed to load frame annotations');
      }
    },
    [sessionId, onError, convertApiResponseToRecipe]
  );

  /**
   * Load frame with image and recipe
   */
  const loadFrameWithRecipe = useCallback(
    async (frameId: number) => {
      setIsLoading(true);
      try {
        // Fetch recipe and load image in parallel
        await Promise.all([fetchRecipe(frameId), loadFrame(frameId)]);

        setCurrentFrameId(frameId);
        // Notify parent after successful load
        onFrameLoaded?.(frameId);
      } catch (error) {
        console.error('Error loading frame:', error);
        onError?.('Failed to load frame');
      } finally {
        setIsLoading(false);
      }
    },
    [fetchRecipe, loadFrame, onError, onFrameLoaded]
  );

  /**
   * Navigate to next frame
   */
  const handleNext = useCallback(async () => {
    if (!hasNext || isLoading) return;

    try {
      const response = await fetch(
        `/api/stitch/video/next-frame/${sessionId}`
      );

      if (!response.ok) {
        throw new Error('Failed to navigate to next frame');
      }

      const metadata: FrameMetadata = await response.json();
      await loadFrameWithRecipe(metadata.frame_id);

      setHasNext(metadata.has_next_frame);
      setHasPrevious(metadata.has_previous_frame);
    } catch (error) {
      console.error('Error navigating to next frame:', error);
      onError?.('Failed to navigate to next frame');
    }
  }, [sessionId, hasNext, isLoading, loadFrameWithRecipe, onError]);

  /**
   * Navigate to previous frame
   */
  const handlePrevious = useCallback(async () => {
    if (!hasPrevious || isLoading) return;

    try {
      const response = await fetch(
        `/api/stitch/video/previous-frame/${sessionId}`
      );

      if (!response.ok) {
        throw new Error('Failed to navigate to previous frame');
      }

      const metadata: FrameMetadata = await response.json();
      await loadFrameWithRecipe(metadata.frame_id);

      setHasNext(metadata.has_next_frame);
      setHasPrevious(metadata.has_previous_frame);
    } catch (error) {
      console.error('Error navigating to previous frame:', error);
      onError?.('Failed to navigate to previous frame');
    }
  }, [sessionId, hasPrevious, isLoading, loadFrameWithRecipe, onError]);

  /**
   * Keyboard shortcuts for navigation
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault(); // Prevent default scroll behavior
        handlePrevious();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault(); // Prevent default scroll behavior
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrevious]);

  /**
   * Load initial frame on mount
   */
  useEffect(() => {
    if (!hasLoadedInitialFrameRef.current) {
      hasLoadedInitialFrameRef.current = true;
      loadFrameWithRecipe(0);
    }
  }, [loadFrameWithRecipe]);

  return (
    <div className="relative w-full">
      {/* Frame Info */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">Video:</span> {videoId}
        </div>
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">Frame:</span> {currentFrameId + 1} / {totalFrames}
        </div>
      </div>

      {/* Canvas Container with Overlay Controls */}
      <div className="relative rounded-lg border-2 border-border bg-black overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-auto block"
        />

        {/* Overlaid Navigation Buttons */}
        <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
          <Button
            size="lg"
            variant="secondary"
            onClick={handlePrevious}
            disabled={!hasPrevious || isLoading}
            className="pointer-events-auto opacity-80 hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          <Button
            size="lg"
            variant="secondary"
            onClick={handleNext}
            disabled={!hasNext || isLoading}
            className="pointer-events-auto opacity-80 hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-white text-lg">Loading frame...</div>
          </div>
        )}
      </div>

      {/* Keyboard Hints */}
      <div className="mt-2 text-xs text-muted-foreground text-center">
        Use arrow keys (← →) to navigate frames
      </div>
    </div>
  );
}
