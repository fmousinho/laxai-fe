import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { getTenantId } from '@/lib/gcs-tenant';
import * as fs from 'fs';

// Initialize storage with explicit credentials
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
let storage: Storage;
if (credentialsPath) {
  try {
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    storage = new Storage({ credentials });
  } catch (error) {
    console.error('Failed to load credentials:', error);
    storage = new Storage(); // Fallback
  }
} else {
  storage = new Storage(); // Fallback to default auth
}

const bucketName = process.env.GCS_BUCKET_NAME as string;

export async function GET(req: NextRequest) {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized or missing tenant_id' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const folder = searchParams.get('folder');
    const prefix = searchParams.get('prefix');

    if (!folder && !prefix) {
      return NextResponse.json({ error: 'Missing folder or prefix parameter' }, { status: 400 });
    }

    const bucket = storage.bucket(bucketName);
    const searchPrefix = prefix || `${tenantId}/${folder}/`;

    console.log(`Listing JPG files in gs://${bucketName}/${searchPrefix}`);

    const [files] = await bucket.getFiles({
      prefix: searchPrefix,
    });

    // Filter for JPG files only
    const jpgFiles = files
      .filter(f => f.name.toLowerCase().endsWith('.jpg') || f.name.toLowerCase().endsWith('.jpeg'))
      .filter(f => !f.name.endsWith('/')); // Exclude directories

    console.log(`Found ${jpgFiles.length} JPG files`);

    // Generate signed URLs for each JPG file
    const imageUrls = await Promise.all(
      jpgFiles.map(async (file) => {
        const [signedUrl] = await file.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 60 * 60 * 1000, // 1 hour
        });

        return {
          fileName: file.name.split('/').pop() || file.name,
          signedUrl,
          fullPath: file.name,
          folder: searchPrefix,
        };
      })
    );

    return NextResponse.json({
      images: imageUrls,
      totalCount: imageUrls.length,
      searchPrefix,
    });
  } catch (err) {
    console.error('Error listing JPG files:', err);
    return NextResponse.json({ error: 'Failed to list JPG files' }, { status: 500 });
  }
}