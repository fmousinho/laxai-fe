'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { PlayerCardModal } from '@/components/ui/PlayerCardModal';
import { PlayerList } from '@/components/ui/PlayerList';
import type { Player } from '@/types/api';

export default function TestPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [activeSessionId, setActiveSessionId] = useState('');

  // Test data
  const testPlayerId = 1;
  const testVideoId = 'test_video';
  const testSessionId = 'test-session-123';

  // Mock player data for testing
  const mockPlayer: Player = {
    player_id: 1,
    player_name: 'John Doe',
    player_number: 23,
    team: 'Blue Team',
    tracker_ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  };

  const handleLoadPlayers = () => {
    setActiveSessionId(sessionId);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Test Page</h1>
        <p className="text-muted-foreground mt-1">
          Test components
        </p>
      </div>

      {/* PlayerList Test */}
      <Card>
        <CardHeader>
          <CardTitle>PlayerList Test</CardTitle>
          <CardDescription>
            Enter a session ID to view the list of players
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter session ID"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleLoadPlayers();
                }
              }}
            />
            <Button onClick={handleLoadPlayers} disabled={!sessionId.trim()}>
              Load Players
            </Button>
          </div>

          {activeSessionId && (
            <PlayerList sessionId={activeSessionId} />
          )}
        </CardContent>
      </Card>

      {/* PlayerCardModal Test */}
      <Card>
        <CardHeader>
          <CardTitle>PlayerCardModal Test</CardTitle>
          <CardDescription>
            Click the button below to open the modal with test data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold">Player ID:</span> {testPlayerId}
              </div>
              <div>
                <span className="font-semibold">Video ID:</span> {testVideoId}
              </div>
              <div>
                <span className="font-semibold">Session ID:</span> {testSessionId}
              </div>
              <div>
                <span className="font-semibold">Tenant:</span> tenant1
              </div>
              <div className="col-span-2">
                <span className="font-semibold">Tracks:</span> 1, 2 (real GCS tracks)
              </div>
            </div>
            
            <Button onClick={() => setIsModalOpen(true)}>
              Open Player Card Modal
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PlayerCardModal */}
      <PlayerCardModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        playerId={testPlayerId}
        videoId={testVideoId}
        sessionId={testSessionId}
        mockPlayer={mockPlayer}
        tenantOverride="tenant1"
      />
    </div>
  );
}
