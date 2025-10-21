'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAnnotationCanvas } from './useAnnotationCanvas';
import type { Recipe, FrameMetadata } from './FrameRenderer.types';

interface FrameRendererProps {
  sessionId: string;
  videoId: string;
  totalFrames: number;
  onError?: (error: string) => void;
}

export function FrameRenderer({
  sessionId,
  videoId,
  totalFrames,
  onError,
}: FrameRendererProps) {
  const [currentFrameId, setCurrentFrameId] = useState<number>(0);
  const [currentRecipe, setCurrentRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNext, setHasNext] = useState(true);
  const [hasPrevious, setHasPrevious] = useState(false);

  const { canvasRef, loadFrame } = useAnnotationCanvas({
    sessionId,
    currentFrameId,
    currentRecipe,
  });

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

        const data = await response.json();
        setCurrentRecipe(data.recipe || data.annotations || null);
      } catch (error) {
        console.error('Error fetching annotations:', error);
        onError?.('Failed to load frame annotations');
      }
    },
    [sessionId, onError]
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
      } catch (error) {
        console.error('Error loading frame:', error);
        onError?.('Failed to load frame');
      } finally {
        setIsLoading(false);
      }
    },
    [fetchRecipe, loadFrame, onError]
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
        handlePrevious();
      } else if (event.key === 'ArrowRight') {
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
    loadFrameWithRecipe(0);
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
