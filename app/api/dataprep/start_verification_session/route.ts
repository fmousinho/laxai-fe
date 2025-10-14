import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/gcs-tenant';
import { JWT } from 'google-auth-library';
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
      console.log('No tenant ID found');
      return NextResponse.json({ error: 'Unauthorized or missing tenant_id' }, { status: 401 });
    }

    const body = await req.json();
    const { video_id } = body;
    console.log('Video ID:', video_id);
    console.log('Tenant ID:', tenantId);

    if (!video_id) {
      return NextResponse.json({ error: 'video_id is required' }, { status: 400 });
    }

    // Authenticate with Google Cloud using JWT constructor to avoid deprecated methods
    let client;
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        // Load credentials and create JWT client directly
        const keys = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
        client = new JWT({
          email: keys.client_email,
          key: keys.private_key,
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

    // Start a verification session for the video
    console.log('Starting verification session for video:', video_id);
    try {
      const startUrl = `${BACKEND_URL}/api/v1/dataprep/start?tenant_id=${encodeURIComponent(tenantId)}`;
      const requestBody = { video_id: video_id };
      console.log('Start URL:', startUrl);
      console.log('Start request body:', requestBody);

      // Get ID token for backend authentication
      const idToken = await client.fetchIdToken(BACKEND_URL!);
      console.log('ID Token obtained, length:', idToken?.length);

      const startResponse = await fetch(startUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(requestBody)
      });

      const responseData = await startResponse.json();
      console.log('Start session response:', startResponse.status, responseData);

      // Check if session start was successful
      const sessionData = responseData as any;
      if (!sessionData.success) {
        console.error('Backend failed to start session:', sessionData.message);
        return NextResponse.json({
          error: 'Failed to start session',
          details: sessionData.message || 'Backend could not start session for this video'
        }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: 'Verification session started successfully',
        session_data: sessionData
      });
    } catch (startError: any) {
      console.error('Error starting session:', startError);
      console.error('Start error details:', startError.message);

      // Try to get error details from response if available
      let errorDetails = startError.message;
      if (startError.response) {
        try {
          const errorData = await startError.response.text();
          errorDetails = errorData || startError.message;
        } catch (e) {
          // Ignore error parsing
        }
      }

      return NextResponse.json({
        error: 'Failed to start session',
        details: errorDetails
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in start_verification_session:', error);
    return NextResponse.json({
      error: 'Failed to start verification session',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
