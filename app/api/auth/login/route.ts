import { auth0 } from '@/lib/auth0';

export async function GET() {
  return auth0.startInteractiveLogin({
    authorizationParameters: {
      // Enable Google and Apple social logins via Auth0 connections
      connection: undefined, // Let Auth0 show all enabled connections
    },
  });
}
