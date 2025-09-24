import { handleLogin } from '@auth0/nextjs-auth0';

export const GET = handleLogin({
  authorizationParams: {
    // Enable Google and Apple social logins via Auth0 connections
    connection: undefined, // Let Auth0 show all enabled connections
  },
});
