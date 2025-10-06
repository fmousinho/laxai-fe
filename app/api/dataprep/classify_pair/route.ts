import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/gcs-tenant';
import { GoogleAuth } from 'google-auth-library';

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

    const { label } = await req.json();
    if (!label || !['same', 'different'].includes(label)) {
      return NextResponse.json({ error: 'Invalid label. Must be "same" or "different"' }, { status: 400 });
    }

    // Authenticate with Google Cloud
    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(BACKEND_URL!);

    // Make request to backend API
    const response = await client.request({
      url: `${BACKEND_URL}/api/v1/dataprep/record-response`,
      method: 'POST',
      params: { tenant_id: tenantId },
      data: { decision: label }
    });

    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error recording response:', error);
    return NextResponse.json({ error: 'Failed to record response' }, { status: 500 });
  }
}
