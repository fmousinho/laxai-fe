import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/gcs-tenant';
import { JWT } from 'google-auth-library';
import * as fs from 'fs';

const BACKEND_URL = process.env.BACKEND_API_URL;

if (!BACKEND_URL) {
  console.error('BACKEND_API_URL environment variable is not set. Please add it to your .env.local file.');
}

export async function GET(req: NextRequest) {
  try {
    if (!BACKEND_URL) {
      return NextResponse.json({
        error: 'Backend API URL not configured',
        message: 'BACKEND_API_URL environment variable is not set. Please add it to your .env.local file.'
      }, { status: 500 });
    }

    console.log('Tracking jobs API called with method:', req.method);
    console.log('BACKEND_URL:', BACKEND_URL);

    const tenantId = await getTenantId(req);
    console.log('Tenant ID:', tenantId);
    // TEMP: For testing, allow requests without tenant_id
    // if (!tenantId) {
    //   return NextResponse.json({ error: 'Unauthorized or missing tenant_id' }, { status: 401 });
    // }
    const effectiveTenantId = tenantId || 'test-tenant'; // Use test tenant for unauthenticated requests
    console.log('Effective tenant ID:', effectiveTenantId);

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get('limit') || '50';

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
    console.log('Google Auth client created');

    // Make request to backend API for listing tracking jobs
    let response;
    try {
      console.log('Making request to:', `${BACKEND_URL}/`);
      response = await client.request({
        url: `${BACKEND_URL}/api/v1/track/`,
        method: 'GET',
        params: {
          tenant_id: effectiveTenantId,
          limit: limit
        }
      });
      console.log('Backend response received');
    } catch (backendError) {
      console.error('Backend API error:', backendError);
      const errorMessage = backendError instanceof Error ? backendError.message : 'Unknown backend error';
      return NextResponse.json({
        error: 'Backend service unavailable',
        details: errorMessage
      }, { status: 503 });
    }

    console.log('Backend response:', response.data);

    // Extract jobs with status and task_id as requested
    const data = response.data as { jobs: any[]; count: number };
    const jobs = data.jobs || [];
    const jobsWithDetails = jobs.map((job: any) => ({
      task_id: job.task_id,
      status: job.status,
      ...job // Include all other job properties
    }));

    return NextResponse.json({
      jobs: jobsWithDetails,
      count: data.count || jobs.length
    });

  } catch (error) {
    console.error('Error listing tracking jobs:', error);
    return NextResponse.json({ error: 'Failed to list tracking jobs' }, { status: 500 });
  }
}