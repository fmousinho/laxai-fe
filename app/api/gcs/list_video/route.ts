import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { getTenantId } from '@/lib/gcs-tenant';

const bucketName = process.env.GCS_BUCKET_NAME;

const storage = new Storage();

export async function GET(req: NextRequest) {
  // Require authentication and tenantId
  const tenantId = await getTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized or missing tenant_id' }, { status: 401 });
  }
  
  // Get folder parameter from query string, default to 'raw' for backward compatibility
  const url = new URL(req.url);
  const folder = url.searchParams.get('folder') || 'raw';
  
  // Validate folder parameter
  const allowedFolders = ['raw', 'process', 'imported'];
  if (!allowedFolders.includes(folder)) {
    return NextResponse.json({ error: 'Invalid folder parameter' }, { status: 400 });
  }
  let prefix
  if (folder=='imported') {
    prefix = `${tenantId}/process/`;
  } else {
    prefix = `${tenantId}/${folder}/`;
  }

  try {
    // Get files from specified folder
    const [files] = await storage.bucket(bucketName!).getFiles({ prefix });
    
    // Only .mp4 files, not folders
    const mp4Files = files
      .filter(f => f.name.endsWith('.mp4') && !f.name.endsWith('/'));
    
    // Generate signed URLs for each file (limit to first 20 for performance)
    const maxFiles = 20;
    const limitedFiles = mp4Files.slice(0, maxFiles);
    
    // Generate video signed URLs first (these are required)
    const signedFilesPromises = limitedFiles.map(async (f) => {
      const [signedUrl] = await f.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 10 * 60 * 1000, // 10 min expiry
      });

      // Extract just the filename (everything after the last /)
      const fileName = f.name.split('/').pop() || '';

      // Get the folder path (everything except the filename)
      const rightFolder = f.name.replace(fileName, '');

      return {
        fileName: fileName,
        signedUrl: signedUrl,
        folder: rightFolder,
        fullPath: f.name,
        thumbnailUrl: null as string | null // Will be set below if available
      };
    });

    // Wait for all video URLs to be generated
    const signedFiles = await Promise.all(signedFilesPromises);
    
    // Now check for thumbnails in parallel (but don't block on them)
    const thumbnailPromises = signedFiles.map(async (file, index) => {
      try {
        const cleanVideoId = file.fileName.replace(/\.mp4$/, '');
        const thumbnailPath = `${tenantId}/${cleanVideoId}/thumbnail.jpg`;
        const thumbnailFile = storage.bucket(bucketName!).file(thumbnailPath);
        const [thumbnailExists] = await thumbnailFile.exists();
        if (thumbnailExists) {
          const [thumbSignedUrl] = await thumbnailFile.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 60 * 60 * 1000, // 1 hour expiry for thumbnails
          });
          signedFiles[index].thumbnailUrl = thumbSignedUrl;
        }
      } catch (thumbError) {
        // Silently ignore thumbnail errors - thumbnails are optional
        console.log(`Thumbnail not available for ${file.fileName}:`, thumbError);
      }
    });

    // Don't wait for thumbnails - let them load asynchronously
    Promise.all(thumbnailPromises).catch(err => 
      console.log('Some thumbnails failed to load:', err)
    );    return NextResponse.json({ 
      files: signedFiles, 
      totalFiles: mp4Files.length,
      hasMore: mp4Files.length > maxFiles 
    });
  } catch (err) {
    console.error('GCS list error:', err);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}
