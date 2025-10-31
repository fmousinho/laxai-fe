import { NextRequest, NextResponse } from 'next/server';
import { getStorageClient } from '@/lib/gcs-client';
import { getTenantId } from '@/lib/gcs-tenant';

const storage = getStorageClient();

const bucketName = process.env.GCS_BUCKET_NAME as string;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const folder = searchParams.get('folder');
    const prefix = searchParams.get('prefix');

    // Always authenticate and derive tenant automatically (no overrides accepted)
    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized or missing tenant_id' }, { status: 401 });
    }

    if (!folder && !prefix) {
      return NextResponse.json({ error: 'Missing folder or prefix parameter' }, { status: 400 });
    }

    // Build a bucket-relative prefix and validate it belongs to the authenticated tenant
    let searchPrefix: string;
    if (prefix) {
      // Normalize input: trim slashes and strip any accidental bucket name
      let normalized = prefix.replace(/^laxai_dev\//, '').replace(/^\/+|\/+$/g, '');
      // Enforce tenant scope and expected structure
      if (!normalized.startsWith(`${tenantId}/`)) {
        return NextResponse.json({ error: 'Forbidden prefix for tenant' }, { status: 403 });
      }
      if (!normalized.includes('/process/') || !(normalized.includes('/unverified_tracks/') || normalized.includes('/tracks/'))) {
        return NextResponse.json({ error: 'Invalid prefix' }, { status: 400 });
      }
      searchPrefix = normalized.endsWith('/') ? normalized : `${normalized}/`;
    } else {
      // Compose under authenticated tenant; allow both relative and tenant-prefixed folder
      let normalizedFolder = (folder as string).replace(/^laxai_dev\//, '').replace(/^\/+|\/+$/g, '');
      if (!normalizedFolder.startsWith(`${tenantId}/`)) {
        normalizedFolder = `${tenantId}/${normalizedFolder}`;
      }
      searchPrefix = normalizedFolder.endsWith('/') ? normalizedFolder : `${normalizedFolder}/`;
    }

  const bucket = storage.bucket(bucketName);

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