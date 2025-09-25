import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { auth0 } from '@/lib/auth0';

// Initialize GCS client. It securely uses environment variables (see setup notes).
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME as string;

export async function POST(req: NextRequest) {
  try {
    // Get Auth0 session (user must be authenticated)
    const session = await auth0.getSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get tenant_id from user app_metadata
    const tenantId = session.user.app_metadata?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant_id found in user metadata' }, { status: 403 });
    }

    const { fileName, contentType } = await req.json();
    if (!fileName || !contentType) {
      return NextResponse.json({ error: 'Missing fileName or contentType' }, { status: 400 });
    }

    // Enforce path: laxai_dev/{tenant_id}/raw/{fileName}
    const objectPath = `laxai_dev/${tenantId}/raw/${fileName}`;
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectPath);
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
      objectName: objectPath,
    });

  } catch (error) {
    console.error('Error generating signed URL:', error);
    return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 });
  }
}

// NOTE: Add 'export const dynamic = "force-dynamic"' if you use a full-stack cache
