import { NextRequest, NextResponse } from 'next/server';
import { JWT } from 'google-auth-library';
import * as fs from 'fs';

const BACKEND_URL = process.env.BACKEND_API_URL;

export async function GET() {
  try {
    console.log('Testing backend authentication...');
    
    // Load service account credentials
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentialsPath) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set');
    }
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    
    // Create JWT client for authentication
    const client = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    
    // Get the ID token for the backend URL
    const token = await client.fetchIdToken(BACKEND_URL!);
    console.log('Token created, length:', token?.length);
    
    // Try to decode the token to see what's in it
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(token, { complete: true });
    console.log('Token header:', JSON.stringify(decoded?.header, null, 2));
    console.log('Token payload claims:', Object.keys(decoded?.payload || {}));
    console.log('Token audience:', decoded?.payload?.aud);
    console.log('Token issuer:', decoded?.payload?.iss);
    console.log('Token subject:', decoded?.payload?.sub);
    
    // Test the actual endpoints
    const response = await client.request({
      url: `${BACKEND_URL}/api/v1/track`,
      method: 'POST',
      data: { video_filename: 'test.mp4', tenant_id: 'tenant1' }
    });
    
    return NextResponse.json({
      success: true,
      status: response.status,
      data: response.data
    });
    
  } catch (error: any) {
    console.error('Backend test error:', error.message);
    return NextResponse.json({
      success: false,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    }, { status: 500 });
  }
}