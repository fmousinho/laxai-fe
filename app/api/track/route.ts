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

    console.log('Track API called with method:', req.method);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));

    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized or missing tenant_id' }, { status: 401 });
    }

    let body = {};
    try {
      const text = await req.text();
      console.log('Request body text:', text);
      if (text) {
        body = JSON.parse(text);
      }
    } catch (error) {
      console.error('Failed to parse request body:', error);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    console.log('Parsed body:', body);

    // Authenticate with Google Cloud
    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(BACKEND_URL!);

    // Make request to backend API
    const requestData = {
      ...body,
      tenant_id: tenantId
    };
    console.log('Sending request data:', requestData);

    let response;
    try {
      response = await client.request({
        url: `${BACKEND_URL}/api/v1/track`,
        method: 'POST',
        data: requestData
      });
    } catch (backendError) {
      console.error('Backend API error:', backendError);
      const errorMessage = backendError instanceof Error ? backendError.message : 'Unknown backend error';
      return NextResponse.json({
        error: 'Backend service unavailable',
        details: errorMessage
      }, { status: 503 });
    }

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