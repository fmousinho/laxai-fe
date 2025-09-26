import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { getTenantId } from '@/lib/gcs-tenant';

// Caching: 1 minute in-memory (per serverless instance), per-tenant
let cachedMp4: { files: string[]; ts: number; prefix: string } | null = null;
const CACHE_TTL = 60 * 1000;

const bucketName = process.env.GCS_BUCKET_NAME;

const storage = new Storage();

export async function GET(req: NextRequest) {
  // Require authentication and tenantId
  const tenantId = await getTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized or missing tenant_id' }, { status: 401 });
  }
  const prefix = `${tenantId}/raw/`;
  if (cachedMp4 && Date.now() - cachedMp4.ts < CACHE_TTL && cachedMp4.prefix === prefix) {
    return NextResponse.json({ files: cachedMp4.files, cached: true });
  }
  try {
    const [files] = await storage.bucket(bucketName!).getFiles({ prefix });
    // Only .mp4 files, not folders
    const mp4Files = files
      .filter(f => f.name.endsWith('.mp4') && !f.name.endsWith('/'));
    // Generate signed URLs for each file
    const signedFiles = await Promise.all(mp4Files.map(async (f) => {
      const [signedUrl] = await f.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 10 * 60 * 1000, // 10 min expiry
      });
      return {
        fileName: f.name.replace(prefix, ''),
        signedUrl,
      };
    }));
    cachedMp4 = { files: signedFiles, ts: Date.now(), prefix };
    return NextResponse.json({ files: signedFiles, cached: false });
  } catch (err) {
    console.error('GCS list error:', err);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}
