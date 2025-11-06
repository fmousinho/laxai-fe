'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAnnotationCanvas } from './useAnnotationCanvas';
import type { Recipe, FrameMetadata, ApiAnnotationsResponse, AnnotationInstruction } from './FrameRenderer.types';

interface FrameRendererProps {
  sessionId: string;
  videoId: string;
  totalFrames: number;
  /**
   * When this value changes, forces a refresh of the current frame
   */
  refreshTrigger?: number;
  onError?: (error: string) => void;
  /**
   * Called after a frame (initial, next, or previous) has been fully loaded
   * (image + annotations) and currentFrameId is updated.
   */
  onFrameLoaded?: (frameId: number) => void;
  /**
   * Called when user clicks a bbox on the canvas. Provides player_id and tracker_id (if any).
   */
  onSelectionChange?: (sel: { tracker_id?: number; player_id: number; bbox?: [number, number, number, number] } | null) => void;
  /**
   * Currently selected bbox to highlight
   */
  selectedBbox?: { player_id: number; tracker_id?: number; bbox?: [number, number, number, number] } | null;
  /**
   * Called after successfully creating a new player from tracker or assigning tracker to an existing player.
   * Parent can use this to refresh frame and player list.
   */
  onAssignmentDone?: () => void;
  /**
   * Whether a modal is currently open. Disables keyboard shortcuts when true.
   */
  isModalOpen?: boolean;
}

interface CachedFrame {
  frameId: number;
  recipe: Recipe;
  imageBlob: Blob;
  timestamp: number;
  // Cache version at the time this entry was saved
  version: number;
}

const FRAME_CACHE_SIZE = 20;

export function FrameRenderer({
  sessionId,
  videoId,
  totalFrames,
  refreshTrigger,
  onError,
  onFrameLoaded,
  onSelectionChange,
  selectedBbox,
  onAssignmentDone,
  isModalOpen = false,
}: FrameRendererProps) {
  const [currentFrameId, setCurrentFrameId] = useState<number>(0);
  const [currentRecipe, setCurrentRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNext, setHasNext] = useState(true);
  const [hasPrevious, setHasPrevious] = useState(false);
  const hasLoadedInitialFrameRef = useRef(false);
  const frameCacheRef = useRef<Map<number, CachedFrame>>(new Map());
  const lastRefreshTriggerRef = useRef<number | undefined>(undefined);
  // Incremented on any player change to invalidate all cached recipes/images
  const cacheVersionRef = useRef<number>(0);

  // Tooltip state for hover
  const [tooltip, setTooltip] = useState<{ tracker_id?: number; old_tracker_id?: number; x: number; y: number } | null>(null);

  const handleHoverChange = useCallback((hover: { tracker_id?: number; old_tracker_id?: number; x: number; y: number } | null) => {
    setTooltip(hover);
  }, []);

  const { canvasRef, loadFrame } = useAnnotationCanvas({
    sessionId,
    currentFrameId,
    currentRecipe,
    onSelectionChange,
    selectedBbox,
    onHoverChange: handleHoverChange,
  });

  // Assignment UI state
  const [showExistingInput, setShowExistingInput] = useState(false);
  const [existingIdInput, setExistingIdInput] = useState('');
  const [calloutBusy, setCalloutBusy] = useState(false);
  const [calloutError, setCalloutError] = useState<string | null>(null);
  const existingInputRef = useRef<HTMLInputElement>(null);

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
          old_tracker_id: oldTrackerId,
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
   * Manage frame cache - keep only the 20 most recent frames
   */
  const addToCache = useCallback((frameId: number, recipe: Recipe, imageBlob: Blob) => {
    const cache = frameCacheRef.current;
    
    // Add new frame
    cache.set(frameId, {
      frameId,
      recipe,
      imageBlob,
      timestamp: Date.now(),
      version: cacheVersionRef.current,
    });

    // If cache exceeds size limit, remove oldest entry
    if (cache.size > FRAME_CACHE_SIZE) {
      let oldestKey: number | null = null;
      let oldestTime = Infinity;

      cache.forEach((value, key) => {
        if (value.timestamp < oldestTime) {
          oldestTime = value.timestamp;
          oldestKey = key;
        }
      });

      if (oldestKey !== null) {
        cache.delete(oldestKey);
      }
    }
  }, []);

  /**
   * Get frame from cache if available
   */
  const getFromCache = useCallback((frameId: number): CachedFrame | undefined => {
    const cached = frameCacheRef.current.get(frameId);
    if (cached) {
      // Ignore cached entries from a previous cache version (player changes occurred)
      if (cached.version !== cacheVersionRef.current) {
        // Optionally delete stale entry
        frameCacheRef.current.delete(frameId);
        return undefined;
      }
      // Update timestamp to mark as recently used
      cached.timestamp = Date.now();
    }
    return cached;
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
        return recipe;
      } catch (error) {
        console.error('Error fetching annotations:', error);
        onError?.('Failed to load frame annotations');
        throw error;
      }
    },
    [sessionId, onError, convertApiResponseToRecipe]
  );

  /**
   * Load frame with image and recipe
   */
  const loadFrameWithRecipe = useCallback(
    async (frameId: number) => {
      // Check cache first
      const cached = getFromCache(frameId);
      
      if (cached) {
        // Load from cache - instant!
        console.log(`📦 Loading frame ${frameId} from cache`);
        setIsLoading(true);
        try {
          // Pass the cached recipe directly to loadFrame to avoid stale state issues
          await loadFrame(frameId, cached.imageBlob, cached.recipe);
          setCurrentRecipe(cached.recipe);
          setCurrentFrameId(frameId);
          
          // Auto-emphasize first unknown player if present
          autoEmphasizeUnknownPlayer(cached.recipe);
          
          onFrameLoaded?.(frameId);
        } catch (error) {
          console.error('Error loading cached frame:', error);
          onError?.('Failed to load cached frame');
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // Not in cache - fetch from server
      console.log(`🌐 Fetching frame ${frameId} from server`);
      setIsLoading(true);
      try {
        // Fetch recipe first
        const recipe = await fetchRecipe(frameId);
        
        // Then load image with the recipe
        const imageBlob = await loadFrame(frameId, undefined, recipe);

        // Add to cache
        if (recipe && imageBlob) {
          addToCache(frameId, recipe, imageBlob);
        }

        setCurrentRecipe(recipe);
        setCurrentFrameId(frameId);
        
        // Auto-emphasize first unknown player if present
        autoEmphasizeUnknownPlayer(recipe);
        
        onFrameLoaded?.(frameId);
      } catch (error) {
        console.error('Error loading frame:', error);
        onError?.('Failed to load frame');
      } finally {
        setIsLoading(false);
      }
    },
    [fetchRecipe, loadFrame, onError, onFrameLoaded, getFromCache, addToCache, onSelectionChange]
  );

  /**
   * Auto-select the first unknown player (player_id = -1) when a frame loads
   */
  const autoEmphasizeUnknownPlayer = useCallback((recipe: Recipe | null) => {
    if (!recipe || !onSelectionChange) return;
    
    // Find first unknown bbox instruction
    const unknownBbox = recipe.instructions.find(
      (ins) => ins.type === 'bbox' && ins.player_id === -1 && typeof ins.tracker_id === 'number' && ins.tracker_id >= 0
    );
    
    if (unknownBbox && unknownBbox.type === 'bbox') {
      onSelectionChange({
        player_id: unknownBbox.player_id,
        tracker_id: unknownBbox.tracker_id,
        bbox: unknownBbox.coords as [number, number, number, number],
      });
    }
  }, [onSelectionChange]);

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
   * Keyboard shortcuts for navigation and callout actions
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle shortcuts when a modal is open
      if (isModalOpen) return;

      // Callout actions take precedence when visible
      const isCalloutActive = !!(selectedBbox && selectedBbox.player_id === -1 && selectedBbox.tracker_id !== undefined);

      if (isCalloutActive && (event.key === 'n' || event.key === 'N')) {
        event.preventDefault();
        handleCreateFromTracker();
        return;
      }
      if (isCalloutActive && (event.key === 'e' || event.key === 'E')) {
        event.preventDefault();
        setShowExistingInput(true);
        // Focus input next tick
        setTimeout(() => existingInputRef.current?.focus(), 0);
        return;
      }

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
  }, [handleNext, handlePrevious, isModalOpen]);

  /**
   * Load initial frame on mount
   */
  useEffect(() => {
    if (!hasLoadedInitialFrameRef.current) {
      hasLoadedInitialFrameRef.current = true;
      loadFrameWithRecipe(0);
    }
  }, [loadFrameWithRecipe]);

  /**
   * Refresh current frame when refreshTrigger changes (e.g., after player creation)
   */
  useEffect(() => {
    // Only refresh if trigger value has actually changed
    if (
      refreshTrigger !== undefined && 
      refreshTrigger > 0 && 
      currentFrameId !== null &&
      refreshTrigger !== lastRefreshTriggerRef.current
    ) {
      console.log(`🔄 Refreshing frame ${currentFrameId} due to trigger change (${lastRefreshTriggerRef.current} -> ${refreshTrigger})`);
      lastRefreshTriggerRef.current = refreshTrigger;
      
      // Clear entire cache and bump cache version so all previously cached entries are invalid
      frameCacheRef.current.clear();
      cacheVersionRef.current += 1;
      
      // Reload current frame
      loadFrameWithRecipe(currentFrameId);
    }
  }, [refreshTrigger, currentFrameId, loadFrameWithRecipe]);

  /**
   * Clear input state when selection changes or is cleared
   */
  useEffect(() => {
    if (!selectedBbox || selectedBbox.player_id !== -1 || selectedBbox.tracker_id === undefined) {
      setShowExistingInput(false);
      setExistingIdInput('');
      setCalloutError(null);
    }
  }, [selectedBbox]);

  /**
   * Clear assignment UI state when frame changes
   */
  useEffect(() => {
    setShowExistingInput(false);
    setExistingIdInput('');
    setCalloutError(null);
    setCalloutBusy(false);
  }, [currentFrameId]);

  /**
   * Create new player from selected unassigned tracker
   */
  const handleCreateFromTracker = useCallback(async () => {
    if (!selectedBbox || selectedBbox.player_id !== -1 || selectedBbox.tracker_id === undefined) return;
    if (calloutBusy) return;
    setCalloutBusy(true);
    setCalloutError(null);
    try {
      const resp = await fetch(`/api/player/create?sessionId=${encodeURIComponent(sessionId)}` , {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracker_ids: [selectedBbox.tracker_id] }),
      });
      if (!resp.ok) {
        const msg = await resp.text();
        throw new Error(`Create failed: ${resp.status} ${msg}`);
      }
      // Success: ask parent to refresh frame and list
      onAssignmentDone?.();
    } catch (e: any) {
      console.error('Error creating player from tracker:', e);
      setCalloutError(e?.message || 'Failed to create player');
    } finally {
      setCalloutBusy(false);
    }
  }, [selectedBbox, calloutBusy, sessionId, onAssignmentDone]);

  /**
   * Assign selected tracker to existing player by ID
   */
  const handleAssignToExisting = useCallback(async () => {
    if (!selectedBbox || selectedBbox.player_id !== -1 || selectedBbox.tracker_id === undefined) return;
    const idStr = existingIdInput.trim();
    const targetId = Number(idStr);
    if (!idStr || !Number.isFinite(targetId)) {
      setCalloutError('Enter a valid player ID');
      return;
    }
    if (calloutBusy) return;
    setCalloutBusy(true);
    setCalloutError(null);
    try {
      // Verify player exists and get ALL current data
      const getResp = await fetch(`/api/player/${encodeURIComponent(String(targetId))}?sessionId=${encodeURIComponent(sessionId)}`);
      if (!getResp.ok) {
        const msg = await getResp.text();
        throw new Error(`Player ${targetId} not found: ${msg}`);
      }
      const existingPlayer = await getResp.json();
      const current: number[] = Array.isArray(existingPlayer.tracker_ids) ? existingPlayer.tracker_ids : [];
      if (current.includes(selectedBbox.tracker_id)) {
        // Already assigned; just refresh
        onAssignmentDone?.();
        return;
      }
      const next = Array.from(new Set([...current, selectedBbox.tracker_id]));
      
      // Send ALL player data back with updated tracker_ids
      const updatePayload = {
        player_id: existingPlayer.player_id,
        player_name: existingPlayer.player_name,
        player_number: existingPlayer.player_number,
        team_id: existingPlayer.team_id,
        image_path: existingPlayer.image_path,
        tracker_ids: next,
      };
      
      console.log('🔵 PATCH payload being sent:', updatePayload);
      console.log('🔵 tracker_ids in payload:', updatePayload.tracker_ids);
      
      const patchResp = await fetch(`/api/player/${encodeURIComponent(String(targetId))}?sessionId=${encodeURIComponent(sessionId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });
      if (!patchResp.ok) {
        const msg = await patchResp.text();
        throw new Error(`Assign failed: ${patchResp.status} ${msg}`);
      }
      onAssignmentDone?.();
    } catch (e: any) {
      console.error('Error assigning tracker to existing player:', e);
      setCalloutError(e?.message || 'Failed to assign to existing player');
    } finally {
      setCalloutBusy(false);
    }
  }, [existingIdInput, selectedBbox, sessionId, onAssignmentDone, calloutBusy]);

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

        {/* Tooltip for hover */}
        {tooltip && tooltip.old_tracker_id !== undefined && (
          <div
            className="fixed z-50 px-3 py-2 text-sm bg-black/90 text-white rounded-md shadow-lg pointer-events-none border border-white/20"
            style={{
              left: `${tooltip.x + 10}px`,
              top: `${tooltip.y - 30}px`,
            }}
          >
            Track ID: {tooltip.old_tracker_id}
          </div>
        )}

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

        {/* Semi-transparent Assignment Buttons at Bottom */}
        {selectedBbox && selectedBbox.player_id === -1 && selectedBbox.tracker_id !== undefined && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-3 p-4 bg-black/60 backdrop-blur-sm pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-3">
              <span className="text-white text-sm font-medium">
                Assign tracker {selectedBbox.tracker_id}:
              </span>
              <Button 
                size="sm" 
                variant="secondary" 
                disabled={calloutBusy} 
                onClick={handleCreateFromTracker}
                className="bg-white/90 hover:bg-white font-medium"
              >
                <span className="underline decoration-2 underline-offset-2">N</span>ew player
              </Button>
              <Button 
                size="sm" 
                variant="secondary" 
                disabled={calloutBusy} 
                onClick={() => { setShowExistingInput(true); setTimeout(() => existingInputRef.current?.focus(), 0); }}
                className="bg-white/90 hover:bg-white font-medium"
              >
                <span className="underline decoration-2 underline-offset-2">E</span>xisting player
              </Button>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-white text-lg">Loading frame...</div>
          </div>
        )}
      </div>

      {/* Input for Existing Player ID - Outside Frame */}
      {showExistingInput && selectedBbox && selectedBbox.player_id === -1 && selectedBbox.tracker_id !== undefined && (
        <div className="mt-4 p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">
              Enter existing player ID to assign tracker {selectedBbox.tracker_id}:
            </label>
            <Input
              ref={existingInputRef}
              value={existingIdInput}
              onChange={(e) => setExistingIdInput(e.target.value)}
              placeholder="Player ID"
              className="w-32"
              onKeyDown={(e) => { 
                if (e.key === 'Enter') { 
                  e.preventDefault(); 
                  handleAssignToExisting(); 
                }
                if (e.key === 'Escape') {
                  setShowExistingInput(false);
                  setExistingIdInput('');
                  setCalloutError(null);
                }
              }}
            />
            <Button size="sm" onClick={handleAssignToExisting} disabled={calloutBusy}>
              Assign
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => {
                setShowExistingInput(false);
                setExistingIdInput('');
                setCalloutError(null);
              }}
            >
              Cancel
            </Button>
          </div>
          {calloutError && (
            <div className="mt-2 text-sm text-destructive">{calloutError}</div>
          )}
        </div>
      )}

      {/* Keyboard Hints */}
      <div className="mt-2 text-xs text-muted-foreground text-center">
        Use arrow keys (← →) to navigate frames. When an unassigned bbox is selected: N = New, E = Existing.
      </div>
    </div>
  );
}
