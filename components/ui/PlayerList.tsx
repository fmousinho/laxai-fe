'use client';

import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getPlayerColor } from '@/lib/player-colors';
import { PlayerCardModal } from '@/components/ui/PlayerCardModal';
import type { Player } from '@/types/api';

interface PlayerListProps {
  sessionId: string;
  videoId?: string;
  /**
   * When this value changes, the component will refetch the players.
   * Useful for parent-driven refreshes after external events.
   */
  refreshKey?: number | string;
  /**
   * If provided, enables the "Create new player" tile when this tracker_id is not yet assigned.
   */
  selectedUnassignedTrackerId?: number | null;
}

function PlayerItemSkeleton() {
  return (
    <div className="flex-shrink-0 w-28 space-y-2">
      <Skeleton className="w-full aspect-[2/3] rounded-md" />
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-3 w-12" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

interface PlayerItemProps {
  player: Player;
  onClick: () => void;
}

function PlayerItem({ player, onClick }: PlayerItemProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const playerColor = getPlayerColor(player.player_id);

  // Fetch signed URL for player image
  useEffect(() => {
    const fetchSignedUrl = async () => {
      if (!player.image_path) {
        setImageLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/gcs/signed-url?path=${encodeURIComponent(player.image_path)}`);
        if (response.ok) {
          const data = await response.json();
          setSignedUrl(data.signedUrl);
        } else {
          console.error('Failed to fetch signed URL for player image:', player.image_path);
          setImageError(true);
        }
      } catch (error) {
        console.error('Error fetching signed URL:', error);
        setImageError(true);
      } finally {
        setImageLoading(false);
      }
    };

    fetchSignedUrl();
  }, [player.image_path]);

  return (
    <div 
      className="flex-shrink-0 w-28 space-y-2 cursor-pointer hover:opacity-80 transition-opacity"
      onClick={onClick}
    >
      {/* Image */}
      <div 
        className="w-full aspect-[2/3] bg-muted rounded-md overflow-hidden relative"
        style={{ border: `3px solid ${playerColor}` }}
      >
        {signedUrl && !imageError ? (
          <>
            {imageLoading && <Skeleton className="absolute inset-0" />}
            <img
              src={signedUrl}
              alt={player.player_name || `Player ${player.player_id}`}
              className="w-full h-full object-contain"
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageError(true);
                setImageLoading(false);
              }}
            />
          </>
        ) : imageLoading && player.image_path ? (
          <Skeleton className="absolute inset-0" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        )}
      </div>

      {/* Player Info */}
      <div className="space-y-1 text-xs">
        <div className="font-medium truncate">ID: {player.player_id}</div>
        <div className="text-muted-foreground truncate">Name: {player.player_name || '-'}</div>
        <div className="text-muted-foreground truncate">Number: {player.player_number ?? '-'}</div>
        <div className="text-muted-foreground truncate">Team: {player.team_id ?? '-'}</div>
      </div>
    </div>
  );
}

export function PlayerList({ sessionId, videoId, refreshKey, selectedUnassignedTrackerId }: PlayerListProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // When the modal saves changes, update the local list immediately
  const handlePlayerUpdated = (updated: Player) => {
    setPlayers((prev) =>
      prev.map((p) => (p.player_id === updated.player_id ? { ...p, ...updated } : p))
    );
  };

  useEffect(() => {
    const fetchPlayers = async () => {
      if (!sessionId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/players?sessionId=${encodeURIComponent(sessionId)}`);

        if (!response.ok) {
          throw new Error('Failed to fetch players');
        }

        const data = await response.json();
        setPlayers(data.players || []);
      } catch (err) {
        console.error('Error fetching players:', err);
        setError('Failed to load players');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayers();
  }, [sessionId, refreshKey]);

  const handlePlayerClick = (playerId: number) => {
    console.log('🔵 Player clicked:', { playerId, videoId, sessionId });
    setSelectedPlayerId(playerId);
    setIsModalOpen(true);
    console.log('🟢 Modal state set:', { selectedPlayerId: playerId, isModalOpen: true });
  };

  const assignedTrackerIds = new Set<number>(
    players.flatMap((p) => p.tracker_ids || [])
  );

  const canCreateFromTracker =
    typeof selectedUnassignedTrackerId === 'number' &&
    selectedUnassignedTrackerId >= 0 &&
    !assignedTrackerIds.has(selectedUnassignedTrackerId);

  const handleCreateFromTracker = async () => {
    if (!sessionId || !canCreateFromTracker || isCreating) return;
    setIsCreating(true);
    try {
      const resp = await fetch(`/api/player/create?sessionId=${encodeURIComponent(sessionId)}` , {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracker_ids: [selectedUnassignedTrackerId] }),
      });
      if (!resp.ok) {
        const msg = await resp.text();
        throw new Error(`Create failed: ${resp.status} ${msg}`);
      }
      const created: Player = await resp.json();
      // Update local list and open modal for the new player
      setPlayers((prev) => {
        const existingIdx = prev.findIndex((p) => p.player_id === created.player_id);
        if (existingIdx >= 0) {
          const copy = prev.slice();
          copy[existingIdx] = { ...prev[existingIdx], ...created };
          return copy;
        }
        return [created, ...prev];
      });
      setSelectedPlayerId(created.player_id);
      setIsModalOpen(true);
    } catch (e) {
      console.error('Error creating player from tracker:', e);
      setError('Failed to create player');
    } finally {
      setIsCreating(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Players</h2>
        <div className="text-destructive p-4 border border-destructive rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Players</h2>
      <div className="rounded-lg border">
        {isLoading ? (
          <div className="flex gap-3 overflow-x-auto p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <PlayerItemSkeleton key={i} />
            ))}
          </div>
        ) : players.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No players found for this session
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto p-3">
            {/* Create new player tile */}
            <div className="flex-shrink-0 w-28 space-y-2">
              <button
                type="button"
                onClick={handleCreateFromTracker}
                disabled={!canCreateFromTracker || isCreating}
                className={
                  'w-full aspect-[2/3] rounded-md border flex items-center justify-center text-center p-2 ' +
                  (!canCreateFromTracker || isCreating
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'hover:bg-muted/50')
                }
                title={
                  canCreateFromTracker
                    ? 'Create new player from selected bbox'
                    : 'Select an unassigned bbox to enable'
                }
              >
                {isCreating ? 'Creating…' : 'Create new player'}
              </button>
            </div>
            {players.map((player) => (
              <PlayerItem 
                key={player.player_id} 
                player={player}
                onClick={() => handlePlayerClick(player.player_id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Player Card Modal */}
      {(() => {
        const shouldRender = selectedPlayerId !== null && videoId;
        console.log('🟣 Modal render check:', { 
          selectedPlayerId, 
          videoId, 
          sessionId, 
          isModalOpen, 
          shouldRender 
        });
        return shouldRender ? (
          <PlayerCardModal
            open={isModalOpen}
            onOpenChange={setIsModalOpen}
            playerId={selectedPlayerId}
            videoId={videoId}
            sessionId={sessionId}
            onPlayerUpdated={handlePlayerUpdated}
          />
        ) : null;
      })()}
    </div>
  );
}
