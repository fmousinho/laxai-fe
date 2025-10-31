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
  GripHorizontal
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
  mockPlayer?: Player; // Optional mock data for testing
}

const IMAGES_PER_PAGE = 100; // 10x10 grid

export function PlayerCardModal({ 
  open, 
  onOpenChange, 
  playerId, 
  videoId,
  sessionId,
  mockPlayer
}: PlayerCardModalProps) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [images, setImages] = useState<PlayerImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [removingImages, setRemovingImages] = useState<Set<string>>(new Set());
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Draggable state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

  // Edit state
  const [editName, setEditName] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [editTeam, setEditTeam] = useState('');

  // Fetch player data
  const fetchPlayer = useCallback(async () => {
    if (!open || !playerId) return;

    // Use mock data if provided (for testing)
    if (mockPlayer) {
      setPlayer(mockPlayer);
      setEditName(mockPlayer.player_name || '');
      setEditNumber(mockPlayer.player_number?.toString() || '');
      setEditTeam(mockPlayer.team || '');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/stitch/video/player/${playerId}?sessionId=${encodeURIComponent(sessionId)}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch player data');
      }

      const data: Player = await response.json();
      setPlayer(data);
      setEditName(data.player_name || '');
      setEditNumber(data.player_number?.toString() || '');
      setEditTeam(data.team || '');
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

    try {
      const response = await fetch('/api/tenant');
      if (response.ok) {
        const data = await response.json();
        setTenantId(data.tenantId);
      }
    } catch (err) {
      console.error('Error fetching tenant ID:', err);
    }
  }, [open, tenantId]);

  // Fetch images from all tracks
  const fetchImages = useCallback(async () => {
    if (!open || !player || !player.tracker_ids.length || !tenantId) return;

    setIsLoadingImages(true);

    try {
      const allImages: PlayerImage[] = [];

      // Fetch images from each track directory
      for (const trackId of player.tracker_ids) {
        const prefix = `laxai_dev/${tenantId}/process/${videoId}/unverified_tracks/${trackId}/`;
        
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

  useEffect(() => {
    if (player && tenantId) {
      fetchImages();
    }
  }, [player, tenantId, fetchImages]);

  const handleSave = async () => {
    if (!player) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/stitch/video/player/${playerId}?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player_name: editName.trim() || undefined,
            player_number: editNumber ? parseInt(editNumber) : undefined,
            team: editTeam.trim() || undefined,
            tracker_ids: player.tracker_ids,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update player');
      }

      const updatedPlayer: Player = await response.json();
      setPlayer(updatedPlayer);
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating player:', err);
      setError('Failed to save changes');
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

  const totalPages = Math.ceil(images.length / IMAGES_PER_PAGE);
  const paginatedImages = images.slice(
    currentPage * IMAGES_PER_PAGE,
    (currentPage + 1) * IMAGES_PER_PAGE
  );

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
            <div className="flex items-center gap-2">
              <GripHorizontal className="h-5 w-5 text-muted-foreground" />
              <DialogTitle>Player Card</DialogTitle>
            </div>
            <DialogDescription>
              View and manage player information and images
            </DialogDescription>
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
              {/* Player Info Card */}
              <Card>
                <CardContent className="pt-6">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-sm font-medium flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Player Name
                          </label>
                          <Input
                            placeholder="Enter name"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium flex items-center gap-2">
                            <Hash className="h-4 w-4" />
                            Number
                          </label>
                          <Input
                            type="number"
                            placeholder="Enter number"
                            value={editNumber}
                            onChange={(e) => setEditNumber(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Team
                          </label>
                          <Input
                            placeholder="Enter team"
                            value={editTeam}
                            onChange={(e) => setEditTeam(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsEditing(false);
                            setEditName(player.player_name || '');
                            setEditNumber(player.player_number?.toString() || '');
                            setEditTeam(player.team || '');
                          }}
                          disabled={isSaving}
                        >
                          Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                          {isSaving ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Save
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-5 w-5 text-muted-foreground" />
                          <span className="text-lg font-semibold">
                            {player.player_name || 'Unnamed Player'}
                          </span>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4 text-muted-foreground" />
                            <span>{player.player_number || 'No number'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{player.team || 'No team'}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {player.tracker_ids.map((trackerId) => (
                            <Badge key={trackerId} variant="secondary">
                              Track {trackerId}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button variant="outline" onClick={() => setIsEditing(true)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Images Section */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    Player Images ({images.length} total)
                  </h3>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                        disabled={currentPage === 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        Page {currentPage + 1} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                        disabled={currentPage === totalPages - 1}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {isLoadingImages ? (
                  <div className="grid grid-cols-10 gap-2">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <Skeleton key={i} className="aspect-[2/3] w-full" />
                    ))}
                  </div>
                ) : images.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No images found for this player
                  </div>
                ) : (
                  <div className="overflow-y-auto flex-1">
                    <div className="grid grid-cols-10 gap-2">
                      {paginatedImages.map((image) => (
                        <div
                          key={image.fullPath}
                          className="relative group aspect-[2/3] bg-muted rounded-md overflow-hidden"
                        >
                          <img
                            src={image.signedUrl}
                            alt={image.fileName}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRemoveImage(image)}
                              disabled={removingImages.has(image.fullPath)}
                            >
                              {removingImages.has(image.fullPath) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <Badge 
                            variant="secondary" 
                            className="absolute bottom-1 left-1 text-xs"
                          >
                            T{image.trackId}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
      </DialogContent>
    </Dialog>
  );
}
