import { NextResponse } from 'next/server';

export async function GET() {
  // Create response that clears the session cookie and redirects to login
  const response = NextResponse.redirect('/login');

  // Clear the auth0 session cookie
  response.cookies.set('auth0.sid', '', {
    maxAge: 0,
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });

  // Also clear any app.sid cookie if it exists
  response.cookies.set('app.sid', '', {
    maxAge: 0,
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });

  return response;
}
