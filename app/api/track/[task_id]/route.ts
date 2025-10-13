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

    // Make request to backend API
    const response = await client.request({
      url: `${BACKEND_URL}/api/v1/track/${task_id}`,
      method: 'GET',
      params: { tenant_id: tenantId }
    });

    return NextResponse.json(response.data);
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
    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized or missing tenant_id' }, { status: 401 });
    }

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

    // Make request to backend API
    const response = await client.request({
      url: `${BACKEND_URL}/api/v1/track/${task_id}`,
      method: 'DELETE',
      params: { tenant_id: tenantId }
    });

    return NextResponse.json(response.data);
  } catch (error) {
    console.error(`Error cancelling tracking job ${(await params).task_id}:`, error);
    return NextResponse.json({ error: `Failed to cancel tracking job ${(await params).task_id}` }, { status: 500 });
  }
}