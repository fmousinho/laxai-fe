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
    const payload = {
      tenant_id: tenantId,
      video_path,
    };
    
    console.log('=== STITCH VIDEO LOAD ===');
    console.log('Backend URL:', backendUrl);
    console.log('Tenant ID:', tenantId);
    console.log('Video path:', video_path);
    console.log('Full payload:', JSON.stringify(payload, null, 2));
    
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify(payload),
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
    console.log('Backend response data:', JSON.stringify(data, null, 2));
    
    // Extract video_id from video_path (format: process/{video_id}/...)
    let video_id = null;
    if (video_path && video_path.startsWith('process/')) {
      const pathParts = video_path.split('/');
      if (pathParts.length >= 2) {
        video_id = pathParts[1]; // Extract video_id from process/{video_id}/...
      }
    }
    
    // Add video_id to response if not already present
    if (video_id && !data.video_id) {
      data.video_id = video_id;
      console.log('Added video_id to response:', video_id);
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error loading video:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
