import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/gcs-tenant';

const STITCH_API_URL = process.env.STITCH_API_URL;

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { video_path } = await req.json();
    if (!video_path) {
      return NextResponse.json({ error: 'Missing video_path' }, { status: 400 });
    }

    // Proxy request to Python backend with tenant_id
    const response = await fetch(`${STITCH_API_URL}/video/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
