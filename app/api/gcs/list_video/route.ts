import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { getTenantId } from '@/lib/gcs-tenant';

// Caching: 1 minute in-memory (per serverless instance), per-tenant
let cachedMp4: { files: { fileName: string; signedUrl: string; folder: string; fullPath: string }[]; ts: number; prefix: string } | null = null;
const CACHE_TTL = 60 * 1000;

const bucketName = process.env.GCS_BUCKET_NAME;

const storage = new Storage();

export async function GET(req: NextRequest) {
  // Require authentication and tenantId
  const tenantId = await getTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized or missing tenant_id' }, { status: 401 });
  }
  
  // Check both raw/ and process/ folders
  const prefixes = [`${tenantId}/raw/`, `${tenantId}/process/`];
  const cacheKey = `${tenantId}-videos`;
  
  if (cachedMp4 && Date.now() - cachedMp4.ts < CACHE_TTL && cachedMp4.prefix === cacheKey) {
    return NextResponse.json({ files: cachedMp4.files, cached: true });
  }
  
  try {
    // Get files from both folders
    const allFiles = [];
    for (const prefix of prefixes) {
      const [files] = await storage.bucket(bucketName!).getFiles({ prefix });
      allFiles.push(...files);
    }
    
    // Only .mp4 files, not folders
    const mp4Files = allFiles
      .filter(f => f.name.endsWith('.mp4') && !f.name.endsWith('/'));
    
    // Generate signed URLs for each file
    const signedFiles = await Promise.all(mp4Files.map(async (f) => {
      const [signedUrl] = await f.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 10 * 60 * 1000, // 10 min expiry
      });
      
      // Determine which folder the file is in and extract relative path
      let relativePath = '';
      if (f.name.startsWith(`${tenantId}/raw/`)) {
        relativePath = f.name.replace(`${tenantId}/raw/`, '');
      } else if (f.name.startsWith(`${tenantId}/process/`)) {
        relativePath = f.name.replace(`${tenantId}/process/`, '');
      }
      
      return {
        fileName: relativePath,
        signedUrl,
        folder: f.name.startsWith(`${tenantId}/process/`) ? 'process' : 'raw',
        fullPath: f.name
      };
    }));
    
    cachedMp4 = { files: signedFiles, ts: Date.now(), prefix: cacheKey };
    return NextResponse.json({ files: signedFiles, cached: false });
  } catch (err) {
    console.error('GCS list error:', err);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}
