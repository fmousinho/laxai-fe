import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

// Initialize GCS client. It securely uses environment variables (see setup notes).
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME as string;

export async function POST(req: NextRequest) {
  try {
    const { fileName, contentType } = await req.json();

    if (!fileName || !contentType) {
      return NextResponse.json({ error: 'Missing fileName or contentType' }, { status: 400 });
    }

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);
    const expirationTime = Date.now() + 1 * 60 * 1000; // URL expires in 1 minute

    // Generate a V4 signed URL for a PUT request (upload)
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: expirationTime,
      contentType: contentType, // Important for the upload to work
    });

    return NextResponse.json({
      signedUrl: signedUrl,
      objectName: fileName,
    });

  } catch (error) {
    console.error('Error generating signed URL:', error);
    return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 });
  }
}

// NOTE: Add 'export const dynamic = "force-dynamic"' if you use a full-stack cache
