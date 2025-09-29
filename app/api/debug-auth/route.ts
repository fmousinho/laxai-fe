import { NextResponse } from 'next/server';

export async function GET() {
  // Check both process.env and actual GoogleAuth initialization
  const hasCredentialsEnv = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  
  let googleAuthStatus = 'unknown';
  try {
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth();
    await auth.getApplicationDefault();
    googleAuthStatus = 'success';
  } catch (error) {
    googleAuthStatus = `error: ${error instanceof Error ? error.message : String(error)}`;
  }

  return NextResponse.json({
    BACKEND_API_URL: process.env.BACKEND_API_URL,
    hasCredentialsEnv,
    credentialsPath,
    googleAuthStatus,
    nodeEnv: process.env.NODE_ENV,
    // Check if files exist
    credentialsFileExists: credentialsPath ? require('fs').existsSync(credentialsPath) : false
  });
}