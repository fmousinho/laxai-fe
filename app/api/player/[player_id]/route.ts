import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/gcs-tenant';
import { getBackendIdToken } from '@/lib/auth';
import { STITCHER_API_BASE_URL, STITCHER_API_ENDPOINTS, getStitcherApiUrl } from '@/lib/stitcher-api';
import type { Player, PlayerUpdateRequest } from '@/types/api';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ player_id: string }> }
) {
  try {
    if (!STITCHER_API_BASE_URL) {
      return NextResponse.json({
        error: 'Stitcher API URL not configured',
        message: 'STITCHER_API_BASE_URL environment variable is not set.'
      }, { status: 500 });
    }

    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const { player_id } = await params;
    const playerId = parseInt(player_id);
    if (isNaN(playerId)) {
      return NextResponse.json({ error: 'Invalid player_id' }, { status: 400 });
    }

    // Get ID token for backend authentication
    const idToken = await getBackendIdToken(STITCHER_API_BASE_URL);

    // Proxy request to Python backend
    const backendUrl = getStitcherApiUrl(STITCHER_API_ENDPOINTS.getPlayer(sessionId, playerId));
    console.log('=== GET PLAYER ===');
    console.log('Backend URL:', backendUrl);
    console.log('Session ID:', sessionId);
    console.log('Player ID:', playerId);

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Stitch API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch player' },
        { status: response.status }
      );
    }

    const data: Player = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching player:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ player_id: string }> }
) {
  try {
    if (!STITCHER_API_BASE_URL) {
      return NextResponse.json({
        error: 'Stitcher API URL not configured',
        message: 'STITCHER_API_BASE_URL environment variable is not set.'
      }, { status: 500 });
    }

    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const { player_id } = await params;
    const playerId = parseInt(player_id);
    if (isNaN(playerId)) {
      return NextResponse.json({ error: 'Invalid player_id' }, { status: 400 });
    }

    const body: Partial<PlayerUpdateRequest> = await req.json();

    // Get ID token for backend authentication
    const idToken = await getBackendIdToken(STITCHER_API_BASE_URL);

    // Proxy request to Python backend
    const backendUrl = getStitcherApiUrl(STITCHER_API_ENDPOINTS.updatePlayer(sessionId, playerId));
    console.log('=== UPDATE PLAYER ===');
    console.log('Backend URL:', backendUrl);
    console.log('Session ID:', sessionId);
    console.log('Player ID:', playerId);
    console.log('Update data:', body);

    const response = await fetch(backendUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Stitch API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to update player' },
        { status: response.status }
      );
    }

    const data: Player = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating player:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ player_id: string }> }
) {
  try {
    if (!STITCHER_API_BASE_URL) {
      return NextResponse.json({
        error: 'Stitcher API URL not configured',
        message: 'STITCHER_API_BASE_URL environment variable is not set.'
      }, { status: 500 });
    }

    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const { player_id } = await params;
    const playerId = parseInt(player_id);
    if (isNaN(playerId)) {
      return NextResponse.json({ error: 'Invalid player_id' }, { status: 400 });
    }

    // Get ID token for backend authentication
    const idToken = await getBackendIdToken(STITCHER_API_BASE_URL);

    // Proxy request to Python backend
    const backendUrl = getStitcherApiUrl(STITCHER_API_ENDPOINTS.deletePlayer(sessionId, playerId));
    console.log('=== DELETE PLAYER ===');
    console.log('Backend URL:', backendUrl);
    console.log('Session ID:', sessionId);
    console.log('Player ID:', playerId);

    const response = await fetch(backendUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${idToken}`
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Stitch API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to delete player' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error deleting player:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
