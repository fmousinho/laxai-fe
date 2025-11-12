import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/gcs-tenant';
import { getBackendIdToken } from '@/lib/auth';

const BACKEND_URL = process.env.BACKEND_API_URL;

if (!BACKEND_URL) {
  console.error('BACKEND_API_URL environment variable is not set. Please add it to your .env.local file.');
}

export async function POST(req: NextRequest) {
  try {
    if (!BACKEND_URL) {
      return NextResponse.json({
        error: 'Backend API URL not configured',
        message: 'BACKEND_API_URL environment variable is not set. Please add it to your .env.local file.'
      }, { status: 500 });
    }

    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized or missing tenant_id' }, { status: 401 });
    }

    const body = await req.json().catch(() => null) as { video_filename?: string } | null;
    if (!body || !body.video_filename) {
      return NextResponse.json({ error: 'video_filename is required' }, { status: 400 });
    }

    // Get ID token for backend authentication (Cloud Run/IAP)
    const idToken = await getBackendIdToken(BACKEND_URL);

    // Make request to backend API to start tracking
    // Note: many backends redirect POST /tracking -> /tracking/ (308). Use trailing slash to avoid redirect issues.
    const payload = {
      video_filename: body.video_filename,
      tenant_id: tenantId,
    } as const;

    console.log('Starting tracking job with payload:', payload);

    const response = await fetch(`${BACKEND_URL}/api/v1/tracking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend /tracking error:', errorText);
      return NextResponse.json({ error: 'Failed to start tracking job' }, { status: response.status });
    }

    const data = await response.json();
    // Return backend response as-is (should contain task_id)
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    const message = error?.response?.data || error?.message || 'Failed to start tracking job';
    console.error('Error starting tracking job:', message);
    return NextResponse.json({ error: 'Failed to start tracking job', details: message }, { status: 500 });
  }
}

// Simple health check to verify the route is wired (useful during debugging)
export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/track', methods: ['POST'] });
}
