// File removed after migration to /api/gcs/list_video/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

// Caching: 1 minute in-memory (per serverless instance)
let cachedMp4: { files: string[]; ts: number } | null = null;
const CACHE_TTL = 60 * 1000;

// const bucketName = process.env.NEXT_PUBLIC_GCS_BUCKET_NAME; // Removed
const rawPrefix = 'raw/';

// Only import credentials if needed (Vercel/Neon may use env)
const storage = new Storage();

export async function GET(req: NextRequest) {
  // Check cache
  if (cachedMp4 && Date.now() - cachedMp4.ts < CACHE_TTL) {
    return NextResponse.json({ files: cachedMp4.files, cached: true });
  }

  try {
    const [files] = await storage.bucket(bucketName!).getFiles({ prefix: rawPrefix });
    const mp4Files = files
      .filter(f => f.name.endsWith('.mp4') && !f.name.endsWith('/'))
      .map(f => f.name.replace(rawPrefix, ''));
    cachedMp4 = { files: mp4Files, ts: Date.now() };
    return NextResponse.json({ files: mp4Files, cached: false });
  } catch (err) {
    console.error('GCS list error:', err);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}
