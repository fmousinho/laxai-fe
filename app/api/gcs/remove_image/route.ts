import { NextRequest, NextResponse } from 'next/server';
import { getStorageClient } from '@/lib/gcs-client';
import { getTenantId } from '@/lib/gcs-tenant';

const storage = getStorageClient();
const bucketName = process.env.GCS_BUCKET_NAME as string;

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized or missing tenant_id' }, { status: 401 });
    }

    const body = await req.json();
    const { imagePath, videoId } = body;

    if (!imagePath || !videoId) {
      return NextResponse.json({ error: 'Missing imagePath or videoId' }, { status: 400 });
    }

    const bucket = storage.bucket(bucketName);
    const sourceFile = bucket.file(imagePath);

    // Check if source file exists
    const [exists] = await sourceFile.exists();
    if (!exists) {
      return NextResponse.json({ error: 'Image file not found' }, { status: 404 });
    }

    // Extract the filename from the path
    const fileName = imagePath.split('/').pop();
    
  // Create the destination path in the removed folder (bucket-relative, no bucket name)
  const destinationPath = `${tenantId}/process/${videoId}/unverified_tracks/removed/${fileName}`;
    const destinationFile = bucket.file(destinationPath);

    // Copy the file to the removed folder
    await sourceFile.copy(destinationFile);

    // Delete the original file
    await sourceFile.delete();

    console.log(`Moved image from ${imagePath} to ${destinationPath}`);

    return NextResponse.json({
      success: true,
      message: 'Image moved to removed folder',
      newPath: destinationPath,
    });
  } catch (err) {
    console.error('Error removing image:', err);
    return NextResponse.json({ error: 'Failed to remove image' }, { status: 500 });
  }
}
