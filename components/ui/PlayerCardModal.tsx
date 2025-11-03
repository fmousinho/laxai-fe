'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  X, 
  Edit, 
  Save, 
  Loader2, 
  ChevronLeft, 
  ChevronRight,
  Trash2,
  User,
  Hash,
  Users,
  GripHorizontal,
  Eye,
  EyeOff,
  Info
} from 'lucide-react';
import type { Player } from '@/types/api';

interface PlayerImage {
  fileName: string;
  signedUrl: string;
  fullPath: string;
  trackId: number;
}

interface PlayerCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerId: number;
  videoId: string;
  sessionId: string;
  onPlayerUpdated?: (player: Player) => void;
  mockPlayer?: Player; // Optional mock data for testing
  tenantOverride?: string; // Optional tenant for testing
}

const IMAGES_PER_ROW = 10;
const IMAGES_INITIAL_ROWS = 5;
const IMAGES_ROW_BATCH = 5;

export function PlayerCardModal({ 
  open, 
  onOpenChange, 
  playerId, 
  videoId,
  sessionId,
  onPlayerUpdated,
  mockPlayer,
  tenantOverride
}: PlayerCardModalProps) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [images, setImages] = useState<PlayerImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Infinite scroll state
  const [visibleRows, setVisibleRows] = useState(IMAGES_INITIAL_ROWS);
  const [removingImages, setRemovingImages] = useState<Set<string>>(new Set());
  const [bulkRemoving, setBulkRemoving] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [showImageInfo, setShowImageInfo] = useState(true);
  const [showHelp, setShowHelp] = useState(true);

  // Marquee selection state
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const additiveSelectRef = useRef<boolean>(false);
  const trackModeRef = useRef<boolean>(false);
  const [selectionRect, setSelectionRect] = useState<{
    left: number; top: number; width: number; height: number
  } | null>(null);

  // Draggable state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

  // Edit state
  const [editName, setEditName] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [editTeam, setEditTeam] = useState('');


  // Main image selection state
  const [mainImagePath, setMainImagePath] = useState<string | null>(null);

  // Infinite scroll logic
  const infiniteScrollRef = useRef<HTMLDivElement | null>(null);
  const handleGridScroll = useCallback(() => {
    if (!gridScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = gridScrollRef.current;
    // If near the bottom, load more rows
    if (scrollTop + clientHeight >= scrollHeight - 200) {
      setVisibleRows((rows) => Math.min(rows + IMAGES_ROW_BATCH, Math.ceil(images.length / IMAGES_PER_ROW)));
    }
  }, [images.length]);

  // Also use IntersectionObserver for robustness
  useEffect(() => {
    if (!infiniteScrollRef.current) return;
    const observer = new window.IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleRows((rows) => Math.min(rows + IMAGES_ROW_BATCH, Math.ceil(images.length / IMAGES_PER_ROW)));
      }
    }, { root: gridScrollRef.current, threshold: 0.1 });
    observer.observe(infiniteScrollRef.current);
    return () => observer.disconnect();
  }, [images.length]);

  // Reset visibleRows when images change
  useEffect(() => {
    setVisibleRows(IMAGES_INITIAL_ROWS);
  }, [images]);

  // Fetch player data
  const fetchPlayer = useCallback(async () => {
    if (!open || !playerId) return;

    // Use mock data if provided (for testing)
    if (mockPlayer) {
        setPlayer(mockPlayer);
        setEditName(mockPlayer.player_name || '');
        setEditNumber(mockPlayer.player_number?.toString() || '');
        setEditTeam(mockPlayer.team || '');
        setMainImagePath(mockPlayer.image_path || null);
        return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/player/${playerId}?sessionId=${encodeURIComponent(sessionId)}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch player data');
      }

      const data: Player = await response.json();
        setPlayer(data);
        setEditName(data.player_name || '');
        setEditNumber(data.player_number?.toString() || '');
        setEditTeam(data.team || '');
        setMainImagePath(data.image_path || null);
    } catch (err) {
      console.error('Error fetching player:', err);
      setError('Failed to load player data');
    } finally {
      setIsLoading(false);
    }
  }, [open, playerId, sessionId, mockPlayer]);

  // Fetch tenant ID
  const fetchTenantId = useCallback(async () => {
    if (!open || tenantId) return;

    // Use override when provided (tests/demo)
    if (tenantOverride) {
      setTenantId(tenantOverride);
      return;
    }

    try {
      const response = await fetch('/api/tenant');
      if (response.ok) {
        const data = await response.json();
        setTenantId(data.tenantId);
      }
    } catch (err) {
      console.error('Error fetching tenant ID:', err);
    }
  }, [open, tenantId, tenantOverride]);

  // Fetch images from all tracks
  const fetchImages = useCallback(async () => {
    if (!open || !player || !player.tracker_ids.length || !tenantId) return;

    setIsLoadingImages(true);

    try {
      const allImages: PlayerImage[] = [];

      // Fetch images from each track directory
      for (const trackId of player.tracker_ids) {
        // Use bucket-relative key (do NOT include bucket name)
        const prefix = `${tenantId}/process/${videoId}/unverified_tracks/${trackId}/`;
        
        const response = await fetch(
          `/api/gcs/list_images?prefix=${encodeURIComponent(prefix)}`
        );

        if (response.ok) {
          const data = await response.json();
          const trackImages = data.images.map((img: any) => ({
            ...img,
            trackId,
          }));
          allImages.push(...trackImages);
        } else {
          const msg = await response.text();
          console.warn('list_images failed:', response.status, msg);
        }
      }

      setImages(allImages);
    } catch (err) {
      console.error('Error fetching images:', err);
      setError('Failed to load player images');
    } finally {
      setIsLoadingImages(false);
    }
  }, [open, player, videoId, tenantId]);

  useEffect(() => {
    fetchTenantId();
  }, [fetchTenantId]);

  useEffect(() => {
    fetchPlayer();
  }, [fetchPlayer]);

  // Refetch images ONLY when relevant identifiers change (not on simple name/number/team edits)
  const trackerIdsKey = (player?.tracker_ids || []).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open || !tenantId) return;
    if (!player || !player.tracker_ids.length) return;
    fetchImages();
  }, [trackerIdsKey, tenantId, videoId]);

  // Save player info (name, number, team, main image)
  const handleSave = async (opts?: { imagePath?: string }) => {
    if (!player) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/player/${playerId}?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player_id: playerId,
            player_name: editName.trim() || undefined,
            player_number: editNumber ? parseInt(editNumber) : undefined,
            team: editTeam.trim(),
            tracker_ids: player.tracker_ids,
            image_path: opts?.imagePath ?? mainImagePath ?? undefined,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update player');
      }

      const updatedPlayer: Player = await response.json();
      setPlayer(updatedPlayer);
      setMainImagePath(updatedPlayer.image_path || null);
      // Sync edit fields with server response to reflect canonical values
      setEditName(updatedPlayer.player_name || '');
      setEditNumber(
        typeof updatedPlayer.player_number === 'number'
          ? String(updatedPlayer.player_number)
          : ''
      );
      setEditTeam(updatedPlayer.team || '');
      // Notify parent (e.g., PlayerList) so it can refresh/update
      if (onPlayerUpdated) {
        try {
          onPlayerUpdated(updatedPlayer);
        } catch (cbErr) {
          console.warn('onPlayerUpdated callback threw:', cbErr);
        }
      }
    } catch (err) {
      console.error('Error updating player:', err);
      setError('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  // Set main image handler
  const handleSetMainImage = async (image: PlayerImage) => {
    setIsSaving(true);
    setError(null);
    try {
      await handleSave({ imagePath: image.fullPath });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveImage = async (image: PlayerImage) => {
    if (!confirm('Are you sure you want to remove this image?')) {
      return;
    }

    setRemovingImages(prev => new Set(prev).add(image.fullPath));

    try {
      const response = await fetch('/api/gcs/remove_image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagePath: image.fullPath,
          videoId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove image');
      }

      // Remove from UI
      setImages(prev => prev.filter(img => img.fullPath !== image.fullPath));
    } catch (err) {
      console.error('Error removing image:', err);
      setError('Failed to remove image');
    } finally {
      setRemovingImages(prev => {
        const next = new Set(prev);
        next.delete(image.fullPath);
        return next;
      });
    }
  };

  const handleBulkRemove = async () => {
    if (selectedPaths.size === 0) return;
    if (!confirm(`Remove ${selectedPaths.size} selected image(s)?`)) return;

    setBulkRemoving(true);
    setError(null);
    const targets = images.filter(img => selectedPaths.has(img.fullPath));
    try {
      // Remove all in parallel
      const results = await Promise.allSettled(
        targets.map(image => fetch('/api/gcs/remove_image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imagePath: image.fullPath, videoId })
        }))
      );

      const failed = results
        .map((r, i) => ({ r, p: targets[i] }))
        .filter(x => x.r.status === 'rejected' || (x.r.status === 'fulfilled' && !x.r.value.ok));

      // Update UI for successes
      const succeededPaths = new Set(
        results
          .map((r, i) => ({ r, p: targets[i] }))
          .filter(x => x.r.status === 'fulfilled' && x.r.value.ok)
          .map(x => x.p.fullPath)
      );

      if (succeededPaths.size > 0) {
        setImages(prev => prev.filter(img => !succeededPaths.has(img.fullPath)));
        setSelectedPaths(prev => {
          const next = new Set(prev);
          succeededPaths.forEach((p) => next.delete(p));
          return next;
        });
      }

      if (failed.length > 0) {
        console.warn('Bulk remove failed for some items:', failed.map(f => f.p.fullPath));
        setError(`Failed to remove ${failed.length} item(s)`);
      }
    } catch (err) {
      console.error('Bulk remove error:', err);
      setError('Failed to remove selected images');
    } finally {
      setBulkRemoving(false);
    }
  };

  // Helper to get container-relative coordinates accounting for scroll
  const getContainerPoint = (e: MouseEvent | React.MouseEvent, container: HTMLDivElement) => {
    const rect = container.getBoundingClientRect();
    const x = (e as MouseEvent).clientX - rect.left + container.scrollLeft;
    const y = (e as MouseEvent).clientY - rect.top + container.scrollTop;
    return { x, y };
  };

  const onGridMouseDown = (e: React.MouseEvent) => {
    if (!gridScrollRef.current) return;
    // Only left-click and avoid starting on a button
    if (e.button !== 0) return;
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest('button')) return;

    const start = getContainerPoint(e, gridScrollRef.current);
    selectionStartRef.current = start;
    additiveSelectRef.current = e.metaKey || e.ctrlKey || e.shiftKey;
    trackModeRef.current = e.altKey; // Alt enables track-based selection
    setIsSelecting(true);
    setSelectionRect({ left: start.x, top: start.y, width: 0, height: 0 });
    // Prevent text selection
    e.preventDefault();
  };

  const onGridMouseMove = useCallback((e: MouseEvent) => {
    if (!isSelecting || !gridScrollRef.current || !selectionStartRef.current) return;
    const current = getContainerPoint(e, gridScrollRef.current);
    const start = selectionStartRef.current;
    const left = Math.min(start.x, current.x);
    const top = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);
    const rect = { left, top, width, height };
    setSelectionRect(rect);

    // Compute intersections with image tiles
    const container = gridScrollRef.current;
    const containerRect = container.getBoundingClientRect();
    const nodes = container.querySelectorAll('[data-image-key]');
    const rectIntersects = (a: {left:number;top:number;width:number;height:number}, b: {left:number;top:number;width:number;height:number}) => (
      a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top
    );

    const toSelect = new Set<string>();
    const tracksToSelect = new Set<number>();
    
    nodes.forEach((el) => {
      const node = el as HTMLElement;
      const key = node.dataset.imageKey as string;
      const trackId = parseInt(node.dataset.trackId || '0', 10);
      const r = node.getBoundingClientRect();
      const nx = r.left - containerRect.left + container.scrollLeft;
      const ny = r.top - containerRect.top + container.scrollTop;
      const nr = { left: nx, top: ny, width: r.width, height: r.height };
      if (rectIntersects(rect, nr)) {
        toSelect.add(key);
        if (trackModeRef.current) {
          tracksToSelect.add(trackId);
        }
      }
    });

    setSelectedPaths(prev => {
      let result: Set<string>;
      
      if (trackModeRef.current) {
        // Select all images belonging to the intersected tracks
        const trackImages = images.filter(img => tracksToSelect.has(img.trackId));
        result = new Set(trackImages.map(img => img.fullPath));
      } else {
        result = toSelect;
      }
      
      if (additiveSelectRef.current) {
        const next = new Set(prev);
        result.forEach(k => next.add(k));
        return next;
      }
      return result;
    });
  }, [isSelecting]);

  const onGridMouseUp = useCallback(() => {
    setIsSelecting(false);
    selectionStartRef.current = null;
    setSelectionRect(null);
  }, []);

  useEffect(() => {
    if (isSelecting) {
      document.addEventListener('mousemove', onGridMouseMove);
      document.addEventListener('mouseup', onGridMouseUp);
      return () => {
        document.removeEventListener('mousemove', onGridMouseMove);
        document.removeEventListener('mouseup', onGridMouseUp);
      };
    }
  }, [isSelecting, onGridMouseMove, onGridMouseUp]);

  // Only render images in view (plus a buffer row)
  const imagesToShow = images.slice(0, visibleRows * IMAGES_PER_ROW);

  // Draggable handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragRef.current) return;

    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;

    setPosition({
      x: dragRef.current.initialX + deltaX,
      y: dragRef.current.initialY + deltaY,
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragRef.current = null;
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Reset position when modal closes
  useEffect(() => {
    if (!open) {
      setPosition({ x: 0, y: 0 });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          // Keep the default centering (translate -50%, -50%) and add our drag offset
          transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s',
        }}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
          <DialogHeader 
            className="drag-handle cursor-move select-none"
            onMouseDown={handleMouseDown}
          >
                          <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripHorizontal className="h-5 w-5 text-muted-foreground" />
                <DialogTitle>
                  Player Card
                </DialogTitle>
              </div>
            </div>
        </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span>Loading player data...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-destructive mb-4">{error}</p>
              <Button onClick={fetchPlayer}>Retry</Button>
            </div>
          ) : player ? (
            <div className="flex flex-col gap-4 overflow-hidden">
              {/* Redesigned Top Card: Main image + info in a single card */}
              <Card className="mb-2">
                <CardContent className="py-4 px-6 flex items-center gap-6">
                  {/* Main image or placeholder */}
                  <div className="w-28 h-40 bg-muted rounded-md flex items-center justify-center overflow-hidden border border-muted-foreground/20">
                    {mainImagePath ? (
                      <img
                        src={images.find(img => img.fullPath === mainImagePath)?.signedUrl || mainImagePath}
                        alt="Main"
                        className="w-full h-full object-contain"
                        draggable={false}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground text-center px-2 select-none">
                        Click on an image to make main picture
                      </span>
                    )}
                  </div>
                  {/* Info section - Inline editable */}
                  <div className="flex-1 flex flex-col justify-center min-w-0 space-y-2">
                    {/* Player Name - Click to edit (prominent) */}
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <Input
                        placeholder="Click to add name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => {
                          if (editName !== (player.player_name || '')) {
                            handleSave();
                          }
                        }}
                        className="text-xl font-bold border-transparent hover:border-input focus:border-input bg-transparent px-2 h-10 flex-1"
                      />
                    </div>
                    
                    {/* Number - Click to edit */}
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-muted-foreground w-12">Number:</span>
                      <Input
                        type="number"
                        placeholder="—"
                        value={editNumber}
                        onChange={(e) => setEditNumber(e.target.value)}
                        onBlur={() => {
                          if (editNumber !== (player.player_number?.toString() || '')) {
                            handleSave();
                          }
                        }}
                        className="flex-1 border-transparent hover:border-input focus:border-input bg-transparent px-2 h-8 font-medium"
                      />
                    </div>
                    
                    {/* Team - Click to edit */}
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-muted-foreground w-12">Team:</span>
                      <Input
                        placeholder="—"
                        value={editTeam}
                        onChange={(e) => setEditTeam(e.target.value)}
                        onBlur={() => {
                          if (editTeam !== (player.team || '')) {
                            handleSave();
                          }
                        }}
                        className="flex-1 border-transparent hover:border-input focus:border-input bg-transparent px-2 h-8 font-medium"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Images Section */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">
                      Images ({images.length})
                    </h3>
                    {/* View controls group */}
                    <div className="flex items-center gap-1 border-l pl-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowHelp(!showHelp)}
                        title={showHelp ? "Hide shortcuts" : "Show shortcuts"}
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowImageInfo(!showImageInfo)}
                        title={showImageInfo ? "Hide info badges" : "Show info badges"}
                      >
                        {showImageInfo ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  {/* Action controls group */}
                  <div className="flex items-center gap-2">
                    {selectedPaths.size > 0 && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPaths(new Set())}
                          disabled={bulkRemoving}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Clear
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleBulkRemove}
                          disabled={bulkRemoving}
                        >
                          {bulkRemoving ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete ({selectedPaths.size})
                            </>
                          )}
                        </Button>
                        {/* Set as Main button: only if one image is selected and it's not already main */}
                        {selectedPaths.size === 1 && (() => {
                          const selectedPath = Array.from(selectedPaths)[0];
                          const isMain = mainImagePath === selectedPath;
                          return !isMain ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const img = images.find(i => i.fullPath === selectedPath);
                                if (img) handleSetMainImage(img);
                              }}
                              disabled={isSaving}
                            >
                              Set as Main
                            </Button>
                          ) : (
                            <Badge className="ml-1 bg-primary/80 text-primary-foreground">Main</Badge>
                          );
                        })()}
                        {/* Move Track button: only if all images from a single track are selected */}
                        {(() => {
                          if (selectedPaths.size === 0) return null;
                          // Find all trackIds in selection
                          const selectedImages = images.filter(img => selectedPaths.has(img.fullPath));
                          const trackIds = Array.from(new Set(selectedImages.map(img => img.trackId)));
                          if (trackIds.length !== 1) return null;
                          const trackId = trackIds[0];
                          const allTrackImages = images.filter(img => img.trackId === trackId);
                          const allSelected = allTrackImages.every(img => selectedPaths.has(img.fullPath));
                          if (!allSelected) return null;
                          return (
                            <Button variant="secondary" size="sm" disabled>
                              Move Track
                            </Button>
                          );
                        })()}
                      </>
                    )}
                  </div>
                </div>

                {/* Keyboard shortcuts help */}
                {showHelp && (
                  <div className="mb-3 px-3 py-2 bg-muted/50 rounded-md text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-6">
                      <div className="flex items-center gap-1.5">
                        <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px] font-mono">Click</kbd>
                        <span>Toggle image</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px] font-mono">Alt+Click</kbd>
                        <span>Toggle track</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px] font-mono">Drag</kbd>
                        <span>Select area</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px] font-mono">Alt+Drag</kbd>
                        <span>Select tracks</span>
                      </div>
                      </div>
                      {/* Track count - aligned right */}
                      <div className="text-xs font-medium">
                        {player.tracker_ids.length} track{player.tracker_ids.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                )}

                {isLoadingImages ? (
                  <div className="grid grid-cols-10 gap-2">
                    {Array.from({ length: IMAGES_INITIAL_ROWS * IMAGES_PER_ROW }).map((_, i) => (
                      <Skeleton key={i} className="aspect-[2/3] w-full" />
                    ))}
                  </div>
                ) : images.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No images found for this player
                  </div>
                ) : (
                  <div
                    ref={gridScrollRef}
                    className="overflow-y-auto flex-1 relative select-none pb-4"
                    onMouseDown={onGridMouseDown}
                    onScroll={handleGridScroll}
                  >
                    {/* Selection rectangle overlay */}
                    {selectionRect && (
                      <div
                        className="pointer-events-none absolute border border-primary bg-primary/10"
                        style={{
                          left: selectionRect.left,
                          top: selectionRect.top,
                          width: selectionRect.width,
                          height: selectionRect.height,
                        }}
                      />
                    )}
                    <div className="grid grid-cols-10 gap-2">
                      {imagesToShow.map((image) => {
                        const isSelected = selectedPaths.has(image.fullPath);
                        const isMain = mainImagePath === image.fullPath;
                        return (
                          <div
                            key={image.fullPath}
                            data-image-key={image.fullPath}
                            data-track-id={image.trackId}
                            className={
                              `relative group aspect-[2/3] rounded-md overflow-hidden bg-muted pt-1 ` +
                              (isSelected ? 'ring-2 ring-primary' : '')
                            }
                            style={{ marginTop: 2 }}
                            onClick={(e) => {
                              // Toggle selection on click (avoid when clicking button)
                              const el = e.target as HTMLElement;
                              if (el.closest('button')) return;
                              if (e.altKey) {
                                const trackImages = images.filter(img => img.trackId === image.trackId);
                                const trackPaths = trackImages.map(img => img.fullPath);
                                const allSelected = trackPaths.every(p => selectedPaths.has(p));
                                setSelectedPaths(prev => {
                                  const next = new Set(prev);
                                  if (allSelected) {
                                    trackPaths.forEach(p => next.delete(p));
                                  } else {
                                    trackPaths.forEach(p => next.add(p));
                                  }
                                  return next;
                                });
                              } else {
                                setSelectedPaths(prev => {
                                  const next = new Set(prev);
                                  if (next.has(image.fullPath)) next.delete(image.fullPath);
                                  else next.add(image.fullPath);
                                  return next;
                                });
                              }
                            }}
                          >
                            <div className="absolute inset-0 flex items-center justify-center p-1">
                              <div className="w-full h-full bg-muted rounded-sm flex items-center justify-center overflow-hidden">
                                <img
                                  src={image.signedUrl}
                                  alt={image.fileName}
                                  className="w-full h-full object-contain"
                                  draggable={false}
                                />
                              </div>
                            </div>
                            {/* Frame and Track info badge */}
                            {showImageInfo && (
                              <div className="absolute bottom-1 left-1 bg-muted/70 backdrop-blur-sm rounded px-1.5 py-1 text-[10px] leading-tight text-foreground">
                                <div>frame: {(() => {
                                  const match = image.fileName.match(/_(\d+)\.(jpg|jpeg)$/i);
                                  return match ? match[1] : '?';
                                })()}</div>
                                <div>track: {image.trackId}</div>
                              </div>
                            )}
                            {/* Selected indicator - checkmark */}
                            {isSelected && (
                              <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* Infinite scroll sentinel */}
                    {imagesToShow.length < images.length && (
                      <div ref={infiniteScrollRef} className="h-8 flex items-center justify-center text-xs text-muted-foreground">
                        Loading more images...
                      </div>
                    )}

                  </div>
                )}
              </div>
            </div>
          ) : null}
      </DialogContent>
    </Dialog>
  );
}
