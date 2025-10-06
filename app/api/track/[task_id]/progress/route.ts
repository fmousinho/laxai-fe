import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/gcs-tenant';
import { GoogleAuth } from 'google-auth-library';

const BACKEND_URL = process.env.BACKEND_API_URL;

if (!BACKEND_URL) {
  console.error('BACKEND_API_URL environment variable is not set. Please add it to your .env.local file.');
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ task_id: string }> }
) {
  console.log('=== POLLING ROUTE CALLED ===');
  try {
    if (!BACKEND_URL) {
      return NextResponse.json({
        error: 'Backend API URL not configured',
        message: 'BACKEND_API_URL environment variable is not set. Please add it to your .env.local file.'
      }, { status: 500 });
    }

    const tenantId = await getTenantId(req);
    console.log('Tenant ID:', tenantId);

    const { task_id } = await params;

    // Authenticate with Google Cloud
    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(BACKEND_URL!);

    // Debug: Log the URL we're trying to call
    const apiUrl = `${BACKEND_URL}/api/v1/track/${task_id}/progress`;
    console.log(`Calling backend API: ${apiUrl}`);

    // Make request to backend polling API
    const response = await client.request({
      url: apiUrl,
      method: 'GET',
    });

    console.log(`Backend response status: ${response.status}`);
    console.log(`Backend response data:`, response.data);
    return NextResponse.json(response.data);


  } catch (error: any) {
    if (error.response?.status === 404) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    } else {
      const { task_id } = await params;
      console.error(`Error getting progress for task ${task_id}:`, error);
      return NextResponse.json({ error: `Failed to get progress for task ${task_id}` }, { status: 500 });
    }
  }
}