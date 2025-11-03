'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Player } from '@/types/api';

interface PlayerListProps {
  sessionId: string;
  videoId?: string;
}

function PlayerCardSkeleton() {
  return (
    <Card className="flex-shrink-0 w-48">
      <CardContent className="p-4 space-y-3">
        <Skeleton className="w-full aspect-[2/3] rounded-lg" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-28" />
      </CardContent>
    </Card>
  );
}

interface PlayerCardProps {
  player: Player;
}

function PlayerCard({ player }: PlayerCardProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  return (
    <Card className="flex-shrink-0 w-48 hover:shadow-lg transition-shadow cursor-pointer">
      <CardContent className="p-4 space-y-2">
        {/* Image */}
        <div className="w-full aspect-[2/3] bg-muted rounded-lg overflow-hidden relative">
          {player.image_path && !imageError ? (
            <>
              {imageLoading && (
                <Skeleton className="absolute inset-0" />
              )}
              <img
                src={player.image_path}
                alt={player.player_name || `Player ${player.player_id}`}
                className="w-full h-full object-contain"
                onLoad={() => setImageLoading(false)}
                onError={() => {
                  setImageError(true);
                  setImageLoading(false);
                }}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <svg
                className="w-16 h-16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Player Info */}
        <div className="space-y-1 text-sm">
          <div className="font-medium truncate">
            ID: {player.player_id}
          </div>
          <div className="text-muted-foreground truncate">
            Name: {player.player_name || '-'}
          </div>
          <div className="text-muted-foreground truncate">
            Number: {player.player_number ?? '-'}
          </div>
          <div className="text-muted-foreground truncate">
            Team: {player.team || '-'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PlayerList({ sessionId }: PlayerListProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, [sessionId]);

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
      
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <PlayerCardSkeleton key={i} />
          ))}
        </div>
      ) : players.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
          No players found for this session
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {players.map((player) => (
            <PlayerCard key={player.player_id} player={player} />
          ))}
        </div>
      )}
    </div>
  );
}
