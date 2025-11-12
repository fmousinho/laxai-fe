import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/gcs-tenant';
import { getBackendIdToken } from '@/lib/auth';

const BACKEND_URL = process.env.BACKEND_API_URL;

if (!BACKEND_URL) {
  console.error('BACKEND_API_URL environment variable is not set. Please add it to your .env.local file.');
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ task_id: string }> }
) {
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

    const { task_id } = await params;

    // Get ID token for backend authentication (Cloud Run/IAP)
    const idToken = await getBackendIdToken(BACKEND_URL);

    // Make request to backend API
    const url = new URL(`${BACKEND_URL}/api/v1/track/${task_id}`);
    url.searchParams.set('tenant_id', tenantId);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend track status error:', errorText);
      return NextResponse.json({ error: 'Failed to get task status' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(`Error getting tracking job status for ${(await params).task_id}:`, error);
    return NextResponse.json({ error: `Failed to get status for task ${(await params).task_id}` }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ task_id: string }> }
) {
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

    const { task_id } = await params;

    // Get ID token for backend authentication (Cloud Run/IAP)
    const idToken = await getBackendIdToken(BACKEND_URL);

    // Make request to backend API
    const url = new URL(`${BACKEND_URL}/api/v1/track/${task_id}`);
    url.searchParams.set('tenant_id', tenantId);

    const response = await fetch(url.toString(), {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${idToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend track delete error:', errorText);
      return NextResponse.json({ error: 'Failed to cancel tracking job' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(`Error cancelling tracking job ${(await params).task_id}:`, error);
    return NextResponse.json({ error: `Failed to cancel tracking job ${(await params).task_id}` }, { status: 500 });
  }
}