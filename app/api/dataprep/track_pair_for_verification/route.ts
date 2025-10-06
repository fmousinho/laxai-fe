import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/gcs-tenant';
import { GoogleAuth } from 'google-auth-library';

const BACKEND_URL = process.env.BACKEND_API_URL;

if (!BACKEND_URL) {
  console.error('BACKEND_API_URL environment variable is not set. Please add it to your .env.local file.');
}

async function getImageUrlsFromPrefixes(storage: any, prefixes: string[]): Promise<string[]> {
  const allUrls: string[] = [];
  
  for (const prefix of prefixes) {
    try {
      // Security: Only process prefixes from process directories
      if (!prefix.includes('process/')) {
        console.warn(`Skipping non-process directory prefix: ${prefix}`);
        continue;
      }
      
      // Remove gs:// prefix and split bucket/path
      const prefixWithoutGs = prefix.replace('gs://', '');
      const [bucketName, ...pathParts] = prefixWithoutGs.split('/');
      const prefixPath = pathParts.join('/');
      
      console.log(`Listing files in gs://${bucketName}/${prefixPath}`);
      
      const [files] = await storage.bucket(bucketName).getFiles({
        prefix: prefixPath
      });
      
      // Filter for JPG image files and generate signed URLs
      const signedUrls = await Promise.all(
        files
          .filter((file: any) => {
            const fileName = file.name.toLowerCase();
            return fileName.endsWith('.jpg') || fileName.endsWith('.jpeg');
          })
          .map(async (file: any) => {
            const [signedUrl] = await file.getSignedUrl({
              version: 'v4',
              action: 'read',
              expires: Date.now() + 60 * 60 * 1000, // 1 hour
            });
            return signedUrl;
          })
      );
      
      allUrls.push(...signedUrls);
      console.log(`Found ${signedUrls.length} images in ${prefix}`);
      
    } catch (error) {
      console.error(`Error listing files for prefix ${prefix}:`, error);
      // Continue with other prefixes
    }
  }
  
  return allUrls;
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

    // Authenticate with Google Cloud
    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(BACKEND_URL!);

    // If video_id is provided, start a session first
    if (video_id) {
      console.log('Starting session for video:', video_id);
      try {
        const startUrl = `${BACKEND_URL}/api/v1/dataprep/start?tenant_id=${encodeURIComponent(tenantId)}`;
        const requestBody = { video_id: video_id };
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
    console.log('Fetching verification images for tenant:', tenantId, 'video:', video_id);
    let verificationUrl = `${BACKEND_URL}/api/v1/dataprep/verification-images?tenant_id=${encodeURIComponent(tenantId)}`;
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
    
    // Handle new API format with group prefixes
    if (data.group1_prefixes && data.group2_prefixes) {
      console.log('Received new API format with prefixes, converting to image URLs...');
      
      try {
        // Import GCS utilities
        const { Storage } = require('@google-cloud/storage');
        const storage = new Storage();
        
        // Convert prefixes to image URLs
        const imagesA = await getImageUrlsFromPrefixes(storage, data.group1_prefixes);
        const imagesB = await getImageUrlsFromPrefixes(storage, data.group2_prefixes);
        
        const transformedData = {
          imagesA,
          imagesB,
          group1_id: data.group1_id,
          group2_id: data.group2_id,
          total_pairs: data.total_pairs,
          verified_pairs: data.verified_pairs,
          status: data.status
        };
        
        console.log(`Returning ${imagesA.length} imagesA and ${imagesB.length} imagesB`);
        return NextResponse.json(transformedData);
        
      } catch (conversionError) {
        console.error('Error converting prefixes to image URLs:', conversionError);
        return NextResponse.json({ error: 'Failed to convert image prefixes to URLs' }, { status: 502 });
      }
    }
    
    // Fallback for old format (if backend still returns imagesA/imagesB)
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
