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

  // Get video_id parameter from query string (can be filename without extension or actual ID)
  const url = new URL(req.url);
  const videoId = url.searchParams.get('video_id');

  if (!videoId) {
    return NextResponse.json({ error: 'Missing video_id parameter' }, { status: 400 });
  }

  // Validate video_id format (should be a valid identifier)
  if (!videoId || typeof videoId !== 'string' || videoId.length === 0) {
    return NextResponse.json({ error: 'Invalid video_id parameter' }, { status: 400 });
  }

  try {
    // Construct thumbnail path: {tenant}/{video_id}/thumbnail.jpg
    // If video_id includes .mp4 extension, remove it
    const cleanVideoId = videoId.replace(/\.mp4$/, '');
    const thumbnailPath = `${tenantId}/${cleanVideoId}/thumbnail.jpg`;

    // Check if thumbnail exists
    const bucket = storage.bucket(bucketName!);
    const file = bucket.file(thumbnailPath);

    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({
        error: 'Thumbnail not found',
        thumbnailPath,
        videoId,
        tenantId
      }, { status: 404 });
    }

    // Generate signed URL for the thumbnail
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour expiry (thumbnails can be cached longer)
    });

    return NextResponse.json({
      signedUrl,
      thumbnailPath,
      videoId,
      tenantId
    });

  } catch (err) {
    console.error('GCS get_thumbnail error:', err);
    return NextResponse.json({
      error: 'Failed to get thumbnail',
      videoId,
      tenantId
    }, { status: 500 });
  }
}