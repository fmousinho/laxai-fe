import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/gcs-tenant';
import { GoogleAuth } from 'google-auth-library';

const BACKEND_URL = process.env.BACKEND_API_URL;

if (!BACKEND_URL) {
  throw new Error('BACKEND_API_URL environment variable is not set');
}

export async function GET(req: NextRequest) {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized or missing tenant_id' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const processFolder = searchParams.get('process_folder');

    // Authenticate with Google Cloud
    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(BACKEND_URL!);

    // If process_folder is provided, start a session first
    if (processFolder) {
      await client.request({
        url: `${BACKEND_URL}/dataprep/start`,
        method: 'POST',
        params: { tenant_id: tenantId },
        data: { process_folder: processFolder }
      });
    }

    // Make request to backend API
    const response = await client.request({
      url: `${BACKEND_URL}/dataprep/verification-images`,
      method: 'GET',
      params: { tenant_id: tenantId }
    });

    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error fetching verification images:', error);
    return NextResponse.json({ error: 'Failed to fetch verification images' }, { status: 500 });
  }
}
