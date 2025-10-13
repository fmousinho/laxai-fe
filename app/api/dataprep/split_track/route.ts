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

    const { track_id, crop_image_name } = await req.json();
    if (!track_id || !crop_image_name) {
      return NextResponse.json({
        error: 'Missing required fields',
        message: 'Both track_id and crop_image_name are required'
      }, { status: 400 });
    }

    // Validate track_id is a number
    if (typeof track_id !== 'number' || track_id <= 0) {
      return NextResponse.json({
        error: 'Invalid track_id',
        message: 'track_id must be a positive number'
      }, { status: 400 });
    }

    // Validate crop_image_name is a string
    if (typeof crop_image_name !== 'string' || !crop_image_name.trim()) {
      return NextResponse.json({
        error: 'Invalid crop_image_name',
        message: 'crop_image_name must be a non-empty string'
      }, { status: 400 });
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
    console.log('🔪 SPLIT TRACK: Calling backend split-track API with:', {
      track_id: track_id,
      crop_image_name: crop_image_name,
      tenant_id: tenantId
    });
    const response = await client.request({
      url: `${BACKEND_URL}/api/v1/dataprep/split-track`,
      method: 'POST',
      params: { tenant_id: tenantId },
      data: {
        track_id: track_id,
        crop_image_name: crop_image_name
      }
    });

    console.log('🔪 SPLIT TRACK: Backend response:', response.status, JSON.stringify(response.data, null, 2));

    const data = response.data as any;
    if (!data.success) {
      console.error('🔪 SPLIT TRACK FAILED: Backend returned success=false. Full response:', data);
      return NextResponse.json({
        error: 'Backend split failed',
        message: data.message || 'Unknown backend error',
        backendResponse: data
      }, { status: 500 });
    }

    console.log('Track split successfully:', data);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error splitting track:', error);
    return NextResponse.json({ error: 'Failed to split track' }, { status: 500 });
  }
}