import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { getTenantId } from '@/lib/gcs-tenant';
import * as fs from 'fs';

const bucketName = process.env.GCS_BUCKET_NAME;

let storage: Storage;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    const credentials = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
    storage = new Storage({ credentials });
  } catch (error) {
    console.error('Failed to load credentials:', error);
    storage = new Storage(); // Fallback
  }
} else {
  storage = new Storage(); // Fallback to default auth
}

export async function GET(req: NextRequest) {
  // Require authentication and tenantId
  const tenantId = await getTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized or missing tenant_id' }, { status: 401 });
  }

  // Get path parameter from query string
  const url = new URL(req.url);
  const path = url.searchParams.get('path');

  if (!path) {
    return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
  }

  try {
    // The path should already include tenant prefix (e.g., tenant1/process/video_id/...)
    // Validate it starts with the tenant ID for security
    if (!path.startsWith(tenantId + '/')) {
      return NextResponse.json({
        error: 'Path must start with tenant ID',
        providedPath: path,
        expectedPrefix: tenantId + '/'
      }, { status: 403 });
    }

    const bucket = storage.bucket(bucketName!);
    const file = bucket.file(path);

    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({
        error: 'File not found',
        path,
      }, { status: 404 });
    }

    // Generate signed URL
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour expiry
    });

    return NextResponse.json({
      signedUrl,
      path,
    });

  } catch (err) {
    console.error('GCS signed-url error:', err);
    return NextResponse.json({
      error: 'Failed to generate signed URL',
      path,
    }, { status: 500 });
  }
}
