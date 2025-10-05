import { redirect } from 'next/navigation';

export async function GET() {
  // Redirect to Auth0 logout
  redirect(`https://${process.env.AUTH0_DOMAIN}/v2/logout?client_id=${process.env.AUTH0_CLIENT_ID}&returnTo=${encodeURIComponent(process.env.APP_BASE_URL || 'http://localhost:3000')}`);
}
