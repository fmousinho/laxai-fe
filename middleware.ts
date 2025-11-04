
import type { NextRequest } from "next/server";
import { auth0 } from "./lib/auth0";

export async function middleware(request: NextRequest) {

  // First, let Auth0 handle its middleware (session management, etc.)
  const authResponse = await auth0.middleware(request);

  // If Auth0 returned a response (like a redirect), return it
  if (authResponse) {
    return authResponse;
  }

  // Define protected routes that require authentication
  const protectedRoutes = [
    '/uploads',
    '/dataprep',
    '/customers'
  ];

  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some(route =>
    request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(route + '/')
  );

  console.log(`[MIDDLEWARE] Path: ${request.nextUrl.pathname}, isProtected: ${isProtectedRoute}`);

  if (isProtectedRoute) {
    console.log(`[MIDDLEWARE] Checking protected route: ${request.nextUrl.pathname}`);

    try {
      // Verify the user has a valid session
      const session = await auth0.getSession(request);
      console.log(`[MIDDLEWARE] Session check result:`, {
        hasSession: !!session,
        hasUser: !!session?.user,
        userSub: session?.user?.sub,
        userId: session?.user?.sub
      });

      // More strict validation: check if session exists AND has a user AND has required fields
      if (!session?.user || !session.user.sub) {
        console.log(`[MIDDLEWARE] No valid session found, redirecting to login`);
        // Redirect to login page with return URL
        const loginUrl = new URL('/api/auth/login', request.url);
        loginUrl.searchParams.set('returnTo', request.nextUrl.pathname);
        return Response.redirect(loginUrl);
      }

      console.log(`[MIDDLEWARE] Valid session found, allowing access`);

    } catch (error) {
      console.log(`[MIDDLEWARE] Session verification failed:`, error);
      // If session verification fails for any reason, redirect to login
      const loginUrl = new URL('/api/auth/login', request.url);
      loginUrl.searchParams.set('returnTo', request.nextUrl.pathname);
      return Response.redirect(loginUrl);
    }
  }

  // Allow the request to continue
  return;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"
  ]
};