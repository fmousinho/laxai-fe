import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/gcs-tenant';
import { GoogleAuth } from 'google-auth-library';

const BACKEND_URL = process.env.BACKEND_API_URL;

if (!BACKEND_URL) {
  throw new Error('BACKEND_API_URL environment variable is not set');
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized or missing tenant_id' }, { status: 401 });
    }

    const body = await req.json();

    // Authenticate with Google Cloud
    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(BACKEND_URL!);

    // Make request to backend API
    const response = await client.request({
      url: `${BACKEND_URL}/api/v1/track`,
      method: 'POST',
      data: {
        ...body,
        tenant_id: tenantId
      }
    });

    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error creating tracking job:', error);
    return NextResponse.json({ error: 'Failed to create tracking job' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized or missing tenant_id' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get('limit') || '50';

    // Authenticate with Google Cloud
    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(BACKEND_URL!);

    // Make request to backend API
    const response = await client.request({
      url: `${BACKEND_URL}/api/v1/track`,
      method: 'GET',
      params: {
        tenant_id: tenantId,
        limit: limit
      }
    });

    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error listing tracking jobs:', error);
    return NextResponse.json({ error: 'Failed to list tracking jobs' }, { status: 500 });
  }
}