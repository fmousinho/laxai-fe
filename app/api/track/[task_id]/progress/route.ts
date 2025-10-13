import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/gcs-tenant';
import { JWT } from 'google-auth-library';
import * as fs from 'fs';

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

    // Authenticate with Google Cloud using JWT constructor to avoid deprecated methods
    let client;
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        // Load credentials and create JWT client directly
        const keys = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
        client = new JWT({
          email: keys.client_email,
          key: keys.private_key,
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });
      } catch (error) {
        console.error('Failed to create JWT client from service account key:', error);
        return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
      }
    } else {
      // Fallback - this might not work without credentials
      console.error('GOOGLE_APPLICATION_CREDENTIALS not set');
      return NextResponse.json({ error: 'Authentication configuration missing' }, { status: 500 });
    }

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