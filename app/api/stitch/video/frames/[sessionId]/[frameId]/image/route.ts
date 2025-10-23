import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/gcs-tenant';
import { getBackendIdToken } from '@/lib/auth';
import { STITCHER_API_BASE_URL, STITCHER_API_ENDPOINTS, getStitcherApiUrl } from '@/lib/stitcher-api';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; frameId: string }> }
) {
  try {
    if (!STITCHER_API_BASE_URL) {
      return NextResponse.json({ error: 'Stitcher API URL not configured' }, { status: 500 });
    }

    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId, frameId } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'png';

    // Get ID token for backend authentication
    const idToken = await getBackendIdToken(STITCHER_API_BASE_URL);

    // Proxy request to Python backend
    const backendUrl = getStitcherApiUrl(STITCHER_API_ENDPOINTS.frameImage(sessionId, frameId));
    const response = await fetch(`${backendUrl}?format=${format}`, {
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `${await response.text()}` },
        { status: response.status }
      );
    }

    // Return image blob
    const blob = await response.blob();
    return new NextResponse(blob, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/png',
      },
    });
  } catch (error) {
    console.error('Error fetching frame image:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
