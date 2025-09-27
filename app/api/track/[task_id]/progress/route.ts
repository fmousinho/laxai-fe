import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/gcs-tenant';
import { GoogleAuth } from 'google-auth-library';

const BACKEND_URL = process.env.BACKEND_API_URL;

if (!BACKEND_URL) {
  throw new Error('BACKEND_API_URL environment variable is not set');
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ task_id: string }> }
) {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized or missing tenant_id' }, { status: 401 });
    }

    const { task_id } = await params;

    // Authenticate with Google Cloud
    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(BACKEND_URL!);

    // Make request to backend API
    const response = await client.request({
      url: `${BACKEND_URL}/api/v1/track/${task_id}/progress`,
      method: 'GET',
      params: { tenant_id: tenantId }
    });

    return NextResponse.json(response.data);
  } catch (error) {
    const { task_id } = await params;
    console.error(`Error getting progress for task ${task_id}:`, error);
    return NextResponse.json({ error: `Failed to get progress for task ${task_id}` }, { status: 500 });
  }
}