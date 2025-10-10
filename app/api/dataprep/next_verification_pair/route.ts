import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/gcs-tenant';
import { GoogleAuth, JWT } from 'google-auth-library';
import * as fs from 'fs';

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

async function fetchNextVerificationImages(client: any, tenantId: string, videoId?: string): Promise<any | { error: string, message: string }> {
  try {
    // Make request to backend API for next verification images
    let verificationUrl = `${BACKEND_URL}/api/v1/dataprep/verification-images?tenant_id=${encodeURIComponent(tenantId)}`;
    if (videoId) {
      verificationUrl += `&video_id=${encodeURIComponent(videoId)}`;
    }
    console.log('Fetching next verification images for tenant:', tenantId, 'video:', videoId);

    const response = await client.request({
      url: verificationUrl,
      method: 'GET'
    });

    console.log('Verification images response:', response.status, JSON.stringify(response.data, null, 2));

    // Validate the response format
    const data = response.data as any;
    if (!data || typeof data !== 'object') {
      console.error('Backend returned invalid response format');
      return { error: 'Invalid response format', message: 'Backend returned invalid response format' };
    }

    // Check if backend returned an error status
    if (data.status === 'error') {
      console.error('Backend returned error status:', data.message);
      return { error: 'Backend error', message: data.message || 'Unknown backend error' };
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
        status: data.status,
        pair_id: data.pair_id,
        mode: data.mode,
        issued_at: data.issued_at,
        expires_at: data.expires_at,
        outstanding_pair_ids: data.outstanding_pair_ids,
        max_outstanding_pairs: data.max_outstanding_pairs,
        group1_prefixes: data.group1_prefixes,
        group2_prefixes: data.group2_prefixes
      };

      console.log(`Fetched next pair: ${imagesA.length} imagesA and ${imagesB.length} imagesB`);
      return transformedData;

    } else {
      // Fallback for old format (if backend still returns imagesA/imagesB)
      if (!data.imagesA || !Array.isArray(data.imagesA) || !data.imagesB || !Array.isArray(data.imagesB)) {
        console.error('Backend returned invalid image data format:', data);
        return { error: 'Invalid image data format', message: 'Backend returned invalid image data format' };
      }

      console.log(`Fetched next pair: ${data.imagesA.length} imagesA and ${data.imagesB.length} imagesB`);
      return data;
    }
  } catch (error) {
    console.error('Error fetching next verification images:', error);
    return { error: 'Request failed', message: error instanceof Error ? error.message : 'Unknown error' };
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

    // Parse request body to get video_id
    let videoId: string | undefined;
    try {
      const body = await req.json();
      videoId = body.video_id;
      console.log('Received video_id:', videoId);
    } catch (error) {
      console.log('No request body or invalid JSON, proceeding without video_id');
    }

    // Authenticate with Google Cloud using JWT constructor instead of deprecated fromJSON
    let client;
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        const keyFile = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
        const jwtClient = new JWT({
          email: keyFile.client_email,
          key: keyFile.private_key,
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });
        client = await jwtClient.getIdTokenClient(BACKEND_URL!);
      } catch (error) {
        console.error('Failed to create JWT client from service account key:', error);
        return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
      }
    } else {
      // Fallback to GoogleAuth for other credential types
      const auth = new GoogleAuth();
      client = await auth.getIdTokenClient(BACKEND_URL!);
    }

    // Fetch the next verification images (without starting a new session)
    const nextImages = await fetchNextVerificationImages(client, tenantId, videoId);

    if (!nextImages || (nextImages.error && nextImages.message)) {
      if (nextImages.error) {
        return NextResponse.json({ 
          error: nextImages.error, 
          message: nextImages.message,
          details: nextImages.error === 'Backend error' ? 'The backend returned an error when fetching verification images. This may be due to corrupted session data from a suspended session.' : undefined
        }, { status: 500 });
      }
      return NextResponse.json({ error: 'No more verification images available' }, { status: 404 });
    }

    return NextResponse.json(nextImages);
  } catch (error) {
    console.error('Error fetching next verification pair:', error);
    return NextResponse.json({ error: 'Failed to fetch next verification pair' }, { status: 500 });
  }
}