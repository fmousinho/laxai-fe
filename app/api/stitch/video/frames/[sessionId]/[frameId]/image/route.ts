import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/gcs-tenant';

const STITCH_API_URL = process.env.STITCH_API_URL;

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string; frameId: string } }
) {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId, frameId } = params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'png';

    // Proxy request to Python backend
    const response = await fetch(
      `${STITCH_API_URL}/video/frames/${sessionId}/${frameId}/image?format=${format}`
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch frame image' },
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
