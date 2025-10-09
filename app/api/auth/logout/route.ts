import { NextResponse, NextRequest } from 'next/server';
import { auth0 } from '@/lib/auth0';

export async function GET(request: NextRequest) {
  try {
    console.log('[LOGOUT] Starting logout process');
    const hasReturnTo = request.nextUrl.searchParams.has('returnTo');

      if (!hasReturnTo) {
        const defaultReturnTo = process.env.APP_BASE_URL
          ? process.env.APP_BASE_URL.replace(/\/$/, '')
          : new URL('/', request.url).toString().replace(/\/$/, '');

        console.log('[LOGOUT] Injecting default returnTo:', defaultReturnTo);
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.searchParams.set('returnTo', defaultReturnTo);
        return NextResponse.redirect(redirectUrl);
    }

    const response = await auth0.middleware(request);

    if (response) {
      console.log('[LOGOUT] Auth0 middleware handled logout');
      return response;
    }

    console.warn('[LOGOUT] Auth0 middleware returned empty response, falling back to login redirect');
    return NextResponse.redirect(new URL('/login', request.url));
  } catch (error) {
    console.error('[LOGOUT] Error during logout:', error);
    // Fallback: redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
