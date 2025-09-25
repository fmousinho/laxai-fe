import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { auth0 } from '@/lib/auth0';
import jwt from 'jsonwebtoken';

const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME as string;

export async function POST(req: NextRequest) {
  try {
    const session = await auth0.getSession(req);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = session.tokenSet.idToken;
    let tenantId;
    const NAMESPACE = 'https://myapp.com';
    if (typeof idToken === 'string') {
      const decoded = jwt.decode(idToken);
      tenantId = decoded && (decoded as Record<string, any>)[`${NAMESPACE}/tenant_id`];
    }
    if (!tenantId) {
      return NextResponse.json({ 
        error: 'No tenant_id found in ID token',
        debug: {
          hasIdToken: !!idToken,
          idTokenDecoded: typeof idToken === 'string' ? jwt.decode(idToken) : null,
          userKeys: Object.keys(session.user),
          hasAppMetadata: !!session.user.app_metadata,
          appMetadata: session.user.app_metadata
        }
      }, { status: 403 });
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
