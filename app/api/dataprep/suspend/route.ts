import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/gcs-tenant';
import { GoogleAuth } from 'google-auth-library';
import * as fs from 'fs';

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

    // Authenticate with Google Cloud using explicit credentials to avoid deprecated methods
    let client;
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        // Load credentials from file and use credentials option instead of keyFile
        const credentials = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
        const auth = new GoogleAuth({
          credentials,
        });
        client = await auth.getIdTokenClient(BACKEND_URL!);
      } catch (error) {
        console.error('Failed to create authenticated client from service account key:', error);
        return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
      }
    } else {
      // Fallback to GoogleAuth for other credential types
      const auth = new GoogleAuth();
      client = await auth.getIdTokenClient(BACKEND_URL!);
    }

    // Make request to backend API
    const response = await client.request({
      url: `${BACKEND_URL}/api/v1/dataprep/suspend`,
      method: 'POST',
      params: { tenant_id: tenantId }
    });

    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error suspending prep:', error);
    return NextResponse.json({ error: 'Failed to suspend preparation' }, { status: 500 });
  }
}
