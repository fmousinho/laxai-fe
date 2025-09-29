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
      console.log('No tenant ID found');
      return NextResponse.json({ error: 'Unauthorized or missing tenant_id' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const processFolder = searchParams.get('process_folder');
    console.log('Process folder:', processFolder);
    console.log('Tenant ID:', tenantId);

    // Authenticate with Google Cloud
    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(BACKEND_URL!);

    // If process_folder is provided, start a session first
    if (processFolder) {
      console.log('Starting session for process folder:', processFolder);
      try {
        const startUrl = `${BACKEND_URL}/api/v1/dataprep/start?tenant_id=${encodeURIComponent(tenantId)}`;
        const requestBody = { process_folder: processFolder };
        console.log('Start URL:', startUrl);
        console.log('Start request body:', requestBody);
        const startResponse = await client.request({
          url: startUrl,
          method: 'POST',
          data: requestBody,
          headers: {
            'Content-Type': 'application/json'
          }
        });
        console.log('Start session response:', startResponse.status, startResponse.data);
        
        // Check if session start was successful
        const sessionData = startResponse.data as any;
        if (!sessionData.success) {
          console.error('Backend failed to start session:', sessionData.message);
          return NextResponse.json({ 
            error: 'Failed to start session', 
            details: sessionData.message || 'Backend could not start session for this video'
          }, { status: 400 });
        }
      } catch (startError: any) {
        console.error('Error starting session:', startError);
        console.error('Start error details:', startError.response?.data || startError.message);
        // If session start fails, return error instead of continuing
        return NextResponse.json({ 
          error: 'Failed to start session', 
          details: startError.response?.data || startError.message 
        }, { status: 500 });
      }
    }

    // Make request to backend API
    console.log('Fetching verification images for tenant:', tenantId, 'process folder:', processFolder);
    let verificationUrl = `${BACKEND_URL}/api/v1/dataprep/verification-images?tenant_id=${encodeURIComponent(tenantId)}`;
    if (processFolder) {
      verificationUrl += `&process_folder=${encodeURIComponent(processFolder)}`;
    }
    console.log('Verification URL:', verificationUrl);
    const response = await client.request({
      url: verificationUrl,
      method: 'GET'
    });

    console.log('Verification images response:', response.status, JSON.stringify(response.data, null, 2));
    
    // Validate the response format
    const data = response.data as any;
    if (!data || typeof data !== 'object') {
      console.error('Backend returned invalid response format');
      return NextResponse.json({ error: 'Backend returned invalid response format' }, { status: 502 });
    }
    
    if (!data.imagesA || !Array.isArray(data.imagesA) || !data.imagesB || !Array.isArray(data.imagesB)) {
      console.error('Backend returned invalid image data format:', data);
      return NextResponse.json({ error: 'Backend returned invalid image data format', data }, { status: 502 });
    }
    
    console.log(`Returning ${data.imagesA.length} imagesA and ${data.imagesB.length} imagesB`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching verification images:', error);
    return NextResponse.json({ error: 'Failed to fetch verification images', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
