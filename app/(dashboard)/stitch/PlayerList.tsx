'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Loader2, Users } from 'lucide-react';
import type { Player } from '@/types/api';

interface PlayerListProps {
  sessionId: string;
}

export function PlayerList({ sessionId }: PlayerListProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newTrackerIds, setNewTrackerIds] = useState('');
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!hasFetchedRef.current && sessionId) {
      hasFetchedRef.current = true;
      fetchPlayers();
    }
  }, [sessionId]);

  const fetchPlayers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/stitch/video/players');

      if (!response.ok) {
        throw new Error('Failed to fetch players');
      }

      const data = await response.json();
      setPlayers(data.players || []);
    } catch (err) {
      console.error('Error fetching players:', err);
      setError('Failed to load players. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePlayer = async () => {
    if (!newTrackerIds.trim()) {
      setError('Please enter at least one tracker ID');
      return;
    }

    const trackerIds = newTrackerIds.split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id));

    if (trackerIds.length === 0) {
      setError('Please enter valid tracker IDs');
      return;
    }

    try {
      const response = await fetch('/api/stitch/video/players/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: newPlayerName.trim() || undefined,
          tracker_ids: trackerIds,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create player');
      }

      setNewPlayerName('');
      setNewTrackerIds('');
      setIsCreateDialogOpen(false);
      await fetchPlayers(); // Refresh the list
    } catch (err) {
      console.error('Error creating player:', err);
      setError('Failed to create player. Please try again.');
    }
  };

  const handleEditPlayer = async () => {
    if (!editingPlayer) return;

    const trackerIds = newTrackerIds.split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id));

    if (trackerIds.length === 0) {
      setError('Please enter valid tracker IDs');
      return;
    }

    try {
      const response = await fetch(`/api/stitch/video/players/${editingPlayer.player_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: newPlayerName.trim() || undefined,
          tracker_ids: trackerIds,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update player');
      }

      setNewPlayerName('');
      setNewTrackerIds('');
      setIsEditDialogOpen(false);
      setEditingPlayer(null);
      await fetchPlayers(); // Refresh the list
    } catch (err) {
      console.error('Error updating player:', err);
      setError('Failed to update player. Please try again.');
    }
  };

  const handleDeletePlayer = async (playerId: number) => {
    if (!confirm('Are you sure you want to delete this player?')) {
      return;
    }

    try {
      const response = await fetch(`/api/stitch/video/players/${playerId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete player');
      }

      await fetchPlayers(); // Refresh the list
    } catch (err) {
      console.error('Error deleting player:', err);
      setError('Failed to delete player. Please try again.');
    }
  };

  const openEditDialog = (player: Player) => {
    setEditingPlayer(player);
    setNewPlayerName(player.player_name || '');
    setNewTrackerIds(player.tracker_ids.join(', '));
    setIsEditDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Player Management
          </CardTitle>
        </CardHeader>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <span>Loading players...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Player Management
          </CardTitle>
        </CardHeader>
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={fetchPlayers}>Retry</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Player Management
            </CardTitle>
            <CardDescription>
              Create and manage players for video stitching
            </CardDescription>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Player
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Player</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Player Name (Optional)</label>
                  <Input
                    placeholder="Enter player name"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Tracker IDs</label>
                  <Input
                    placeholder="Enter tracker IDs (comma-separated)"
                    value={newTrackerIds}
                    onChange={(e) => setNewTrackerIds(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Example: 1, 2, 5
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      setNewPlayerName('');
                      setNewTrackerIds('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreatePlayer}>Create Player</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <div className="p-6 pt-0">
        {players.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">No players created yet</p>
            <p className="text-sm text-muted-foreground">
              Create players to assign tracker IDs and manage video stitching
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {players.map((player) => (
              <Card key={player.player_id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        {player.player_name || `Player ${player.player_id}`}
                      </CardTitle>
                      <CardDescription className="mt-2">
                        <div className="flex flex-wrap gap-1">
                          {player.tracker_ids.map((trackerId) => (
                            <Badge key={trackerId} variant="secondary">
                              Tracker {trackerId}
                            </Badge>
                          ))}
                        </div>
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(player)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeletePlayer(player.player_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit Player Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Player</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Player Name (Optional)</label>
              <Input
                placeholder="Enter player name"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Tracker IDs</label>
              <Input
                placeholder="Enter tracker IDs (comma-separated)"
                value={newTrackerIds}
                onChange={(e) => setNewTrackerIds(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Example: 1, 2, 5
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingPlayer(null);
                  setNewPlayerName('');
                  setNewTrackerIds('');
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleEditPlayer}>Update Player</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}