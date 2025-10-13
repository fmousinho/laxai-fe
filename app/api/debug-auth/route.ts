import { NextResponse } from 'next/server';
import { JWT } from 'google-auth-library';
import * as fs from 'fs';

export async function GET() {
  // Check both process.env and actual JWT initialization
  const hasCredentialsEnv = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  
  let jwtStatus = 'unknown';
  try {
    // Load credentials and create JWT client directly
    const keys = JSON.parse(fs.readFileSync(credentialsPath!, 'utf8'));
    const auth = new JWT({
      email: keys.client_email,
      key: keys.private_key,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    await auth.authorize();
    jwtStatus = 'success';
  } catch (error) {
    jwtStatus = `error: ${error instanceof Error ? error.message : String(error)}`;
  }

  return NextResponse.json({
    BACKEND_API_URL: process.env.BACKEND_API_URL,
    hasCredentialsEnv,
    credentialsPath,
    jwtStatus,
    nodeEnv: process.env.NODE_ENV,
    // Check if files exist
    credentialsFileExists: credentialsPath ? fs.existsSync(credentialsPath) : false
  });
}