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

async function fetchNextVerificationImages(client: any, tenantId: string) {
  try {
    // Make request to backend API for next verification images
    const verificationUrl = `${BACKEND_URL}/api/v1/dataprep/verification-images?tenant_id=${encodeURIComponent(tenantId)}`;
    console.log('Fetching next verification images for tenant:', tenantId);
    
    const response = await client.request({
      url: verificationUrl,
      method: 'GET'
    });

    console.log('Verification images response:', response.status, JSON.stringify(response.data, null, 2));
    
    // Validate the response format
    const data = response.data as any;
    if (!data || typeof data !== 'object') {
      console.error('Backend returned invalid response format');
      return null;
    }
    
    // Handle new API format with group prefixes
    if (data.group1_prefixes && data.group2_prefixes) {
      console.log('Received new API format with prefixes, converting to image URLs...');
      
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
      
      console.log(`Fetched next pair: ${imagesA.length} imagesA and ${imagesB.length} imagesB`);
      return transformedData;
      
    } else {
      // Fallback for old format (if backend still returns imagesA/imagesB)
      if (!data.imagesA || !Array.isArray(data.imagesA) || !data.imagesB || !Array.isArray(data.imagesB)) {
        console.error('Backend returned invalid image data format:', data);
        return null;
      }
      
      console.log(`Fetched next pair: ${data.imagesA.length} imagesA and ${data.imagesB.length} imagesB`);
      return data;
    }
  } catch (error) {
    console.error('Error fetching next verification images:', error);
    return null;
  }
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

    const { label, pair_id } = await req.json();
    if (!label || !['same', 'different', 'skip'].includes(label)) {
      return NextResponse.json({ error: 'Invalid label. Must be "same", "different", or "skip"' }, { status: 400 });
    }

    if (!pair_id || typeof pair_id !== 'string') {
      return NextResponse.json({ error: 'pair_id is required and must be a string' }, { status: 400 });
    }

    // Authenticate with Google Cloud using explicit credentials to avoid deprecated methods
    let client;
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        // Create GoogleAuth with explicit credentials instead of relying on environment variable
        const auth = new GoogleAuth({
          keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
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
      url: `${BACKEND_URL}/api/v1/dataprep/record-response`,
      method: 'POST',
      params: { tenant_id: tenantId },
      data: { pair_id, decision: label }
    });

    console.log('Classification recorded successfully:', response.data);

    // After successful recording, fetch the next verification pair
    // We'll call our own next_verification_pair endpoint to get the next images
    const nextImagesResponse = await fetch(`${req.nextUrl.origin}/api/dataprep/next_verification_pair`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward the authorization headers
        ...Object.fromEntries(
          Array.from(req.headers.entries()).filter(([key]) =>
            key.toLowerCase().startsWith('x-') ||
            key.toLowerCase() === 'authorization' ||
            key.toLowerCase() === 'cookie'
          )
        )
      }
    });

    let nextImages = null;
    if (nextImagesResponse.ok) {
      nextImages = await nextImagesResponse.json();
    } else {
      console.warn('Failed to fetch next verification images:', nextImagesResponse.status);
    }

    // Return both the recording result and the next images
    const result = {
      success: true,
      recorded_response: response.data,
      next_images: nextImages
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error recording response:', error);
    return NextResponse.json({ error: 'Failed to record response' }, { status: 500 });
  }
}
