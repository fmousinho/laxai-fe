import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { getTenantId } from '@/lib/gcs-tenant';

const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME;

export async function DELETE(req: NextRequest) {
  const tenantId = await getTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized or missing tenant_id' }, { status: 401 });
  }
  // Accept either { fileName } or { fileName, signedUrl }
  const body = await req.json();
  const fileName = body.fileName || (body.file && body.file.fileName);
  if (!fileName) {
    return NextResponse.json({ error: 'Missing fileName' }, { status: 400 });
  }
  const objectPath = `${tenantId}/raw/${fileName}`;
  try {
    await storage.bucket(bucketName!).file(objectPath).delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('GCS delete error:', err);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
