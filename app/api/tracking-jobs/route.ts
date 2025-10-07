import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/gcs-tenant';
import { GoogleAuth } from 'google-auth-library';

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

    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized or missing tenant_id' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get('limit') || '50';

    // Authenticate with Google Cloud
    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(BACKEND_URL!);

    // Make request to backend API for listing tracking jobs
    let response;
    try {
      response = await client.request({
        url: `${BACKEND_URL}/`, // Backend root endpoint for listing jobs
        method: 'GET',
        params: {
          tenant_id: tenantId,
          limit: limit
        }
      });
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