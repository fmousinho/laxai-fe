import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { getTenantId } from '@/lib/gcs-tenant';

const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME as string;

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized or missing tenant_id' }, { status: 401 });
    }
    const { fileName, contentType } = await req.json();
    if (!fileName || !contentType) {
      return NextResponse.json({ error: 'Missing fileName or contentType' }, { status: 400 });
    }
    const objectPath = `${tenantId}/raw/${fileName}`;
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectPath);
    const expirationTime = Date.now() + 1 * 60 * 1000;
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: expirationTime,
      contentType: contentType,
    });
    return NextResponse.json({
      signedUrl,
      objectName: objectPath,
    });
  } catch (err) {
    console.error('GCS upload error:', err);
    return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 });
  }
}
