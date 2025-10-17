import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/gcs-tenant';

const STITCH_API_URL = process.env.STITCH_API_URL;

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = params;

    // Proxy request to Python backend
    const response = await fetch(
      `${STITCH_API_URL}/video/previous-frame/${sessionId}`
    );

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
