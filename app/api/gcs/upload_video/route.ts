import { NextRequest, NextResponse } from 'next/server';
import { getStorageClient } from '@/lib/gcs-client';
import { getTenantId } from '@/lib/gcs-tenant';

const storage = getStorageClient();

const bucketName = process.env.GCS_BUCKET_NAME as string;

export async function POST(req: NextRequest) {
  try {
    console.log('=== UPLOAD VIDEO API START ===');
    
    const tenantId = await getTenantId(req);
    console.log('Tenant ID extracted:', tenantId);
    
    if (!tenantId) {
      console.error('No tenant ID found - authentication issue');
      return NextResponse.json({ error: 'Unauthorized or missing tenant_id' }, { status: 401 });
    }
    
    const { fileName, contentType } = await req.json();
    console.log('Request payload:', { fileName, contentType });
    
    if (!fileName || !contentType) {
      console.error('Missing required fields:', { fileName, contentType });
      return NextResponse.json({ error: 'Missing fileName or contentType' }, { status: 400 });
    }
    
    console.log('Bucket name:', bucketName);
    const objectPath = `${tenantId}/raw/${fileName}`;
    console.log('Object path:', objectPath);
    
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectPath);
    const expirationTime = Date.now() + 10 * 60 * 1000; // 10 minutes instead of 1
    
    console.log('Generating signed URL...');
    console.log('Expiration time:', new Date(expirationTime).toISOString());
    
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: expirationTime,
      contentType: contentType,
    });
    
    console.log('Signed URL generated successfully');
    console.log('Signed URL (first 100 chars):', signedUrl.substring(0, 100) + '...');
    
    const response = {
      signedUrl,
      objectName: objectPath,
    };
    
    console.log('=== UPLOAD VIDEO API SUCCESS ===');
    return NextResponse.json(response);
  } catch (err) {
    console.error('=== UPLOAD VIDEO API ERROR ===');
    console.error('Error details:', err);
    console.error('Error stack:', (err as Error).stack);
    return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 });
  }
}
