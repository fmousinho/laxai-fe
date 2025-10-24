import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/gcs-tenant';
import { getBackendIdToken } from '@/lib/auth';
import { STITCHER_API_BASE_URL, STITCHER_API_ENDPOINTS, getStitcherApiUrl } from '@/lib/stitcher-api';

export async function GET(req: NextRequest) {
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

    // Get ID token for backend authentication
    const idToken = await getBackendIdToken(STITCHER_API_BASE_URL);

    // Proxy request to Python backend
    const backendUrl = getStitcherApiUrl(STITCHER_API_ENDPOINTS.getPlayers);
    console.log('=== GET PLAYERS ===');
    console.log('Backend URL:', backendUrl);
    console.log('Tenant ID:', tenantId);

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
        { error: 'Failed to fetch players' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}