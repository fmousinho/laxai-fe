import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';

const BACKEND_URL = process.env.BACKEND_API_URL;

export async function GET() {
  try {
    console.log('Testing backend authentication...');
    
    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(BACKEND_URL!);
    
    // Get the actual token that will be sent
    const token = await client.idTokenProvider.fetchIdToken(BACKEND_URL!);
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