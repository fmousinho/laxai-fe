import { getAccessToken, withPageAuthRequired } from '@auth0/nextjs-auth0';
import { JWT } from 'google-auth-library';
import * as fs from 'fs';

export { getAccessToken, withPageAuthRequired };

/**
 * Get a Google Cloud ID token for backend API authentication
 * @param targetAudience - The backend API URL to authenticate against
 * @returns ID token string
 * @throws Error if authentication fails
 */
export async function getBackendIdToken(targetAudience: string): Promise<string> {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS not configured');
  }

  try {
    const keys = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
    const client = new JWT({
      email: keys.client_email,
      key: keys.private_key,
    });

    const idToken = await client.fetchIdToken(targetAudience);
    return idToken;
  } catch (error) {
    console.error('Failed to get backend ID token:', error);
    throw new Error('Authentication failed');
  }
}
