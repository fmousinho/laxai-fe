import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/gcs-tenant';
import { getBackendIdToken } from '@/lib/auth';
import { STITCHER_API_BASE_URL, STITCHER_API_ENDPOINTS, getStitcherApiUrl } from '@/lib/stitcher-api';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    if (!STITCHER_API_BASE_URL) {
      return NextResponse.json({ error: 'Stitcher API URL not configured' }, { status: 500 });
    }

    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;

    // Get ID token for backend authentication
    const idToken = await getBackendIdToken(STITCHER_API_BASE_URL);

    // Proxy request to Python backend
    const backendUrl = getStitcherApiUrl(STITCHER_API_ENDPOINTS.previousFrame(sessionId));
    const response = await fetch(backendUrl, {
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to navigate to previous frame' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error navigating to previous frame:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
