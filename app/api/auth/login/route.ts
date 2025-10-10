import { auth0 } from '@/lib/auth0';
import { NextRequest } from 'next/server';

const ALLOWED_CONNECTIONS = new Set([
  'google-oauth2',
  'Username-Password-Authentication',
  'auth0',
]);

function getSafeReturnTo(raw: string | null): string | undefined {
  if (!raw) return undefined;

  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.startsWith('/')) {
      return decoded;
    }
  } catch (error) {
    console.warn('[auth/login] Failed to decode returnTo value', error);
  }

  return undefined;
}

function getSafeConnection(raw: string | null): string | undefined {
  if (!raw) return undefined;

  if (ALLOWED_CONNECTIONS.has(raw)) {
    return raw;
  }

  console.warn(`[auth/login] Ignoring unsupported connection value: ${raw}`);
  return undefined;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const connection = getSafeConnection(url.searchParams.get('connection'));
  const returnTo = getSafeReturnTo(url.searchParams.get('returnTo'));

  const options: Parameters<typeof auth0.startInteractiveLogin>[0] = {};

  if (connection) {
    options.authorizationParameters = { connection };
  }

  if (returnTo) {
    options.returnTo = returnTo;
  }

  return auth0.startInteractiveLogin(options);
}
