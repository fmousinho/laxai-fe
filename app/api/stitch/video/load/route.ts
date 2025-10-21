import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/gcs-tenant';
import { getBackendIdToken } from '@/lib/auth';
import { STITCHER_API_BASE_URL, STITCHER_API_ENDPOINTS, getStitcherApiUrl } from '@/lib/stitcher-api';

export async function POST(req: NextRequest) {
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

    let { video_path } = await req.json();
    if (!video_path) {
      return NextResponse.json({ error: 'Missing video_path' }, { status: 400 });
    }

    // Normalize video_path: strip tenant prefix if present and validate starts with 'process/'
    try {
      const tenantPrefix = `${tenantId}/`;
      if (video_path.startsWith(tenantPrefix)) {
        video_path = video_path.slice(tenantPrefix.length);
      }
      // Some callers may pass a full gs path; strip bucket prefixes if any
      if (video_path.startsWith('gs://')) {
        const parts = video_path.split('/');
        // Remove 'gs://<bucket>/'
        video_path = parts.slice(3).join('/');
      }
      // Validate it looks like a process path
      if (!video_path.startsWith('process/')) {
        console.warn('Unexpected video_path, expected to start with process/:', video_path);
      }
    } catch (normErr) {
      console.warn('Failed to normalize video_path, forwarding as-is:', normErr);
    }

    // Get ID token for backend authentication
    const idToken = await getBackendIdToken(STITCHER_API_BASE_URL);

    // Proxy request to Python backend with tenant_id
    const backendUrl = getStitcherApiUrl(STITCHER_API_ENDPOINTS.loadVideo);
    console.log('=== STITCH VIDEO LOAD ===');
    console.log('Backend URL:', backendUrl);
    console.log('Tenant ID:', tenantId);
    console.log('Video path:', video_path);
    
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        video_path,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Stitch API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to load video session' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error loading video:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
