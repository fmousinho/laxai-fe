import { NextRequest } from 'next/server';
import { auth0 } from '@/lib/auth0';
import jwt from 'jsonwebtoken';

// In-memory cache for tenantId per request (per serverless instance)
const tenantCache = new Map<string, string>();

export async function getTenantId(req: NextRequest): Promise<string | null> {
  // Use session cookie as cache key (or fallback to IP+UA for dev)
  const cookie = req.headers.get('cookie') || '';
  if (tenantCache.has(cookie)) {
    return tenantCache.get(cookie)!;
  }
  const session = await auth0.getSession(req);
  if (!session || !session.user) return null;
  const idToken = session.tokenSet.idToken;
  const NAMESPACE = 'https://myapp.com';
  let tenantId: string | null = null;
  if (typeof idToken === 'string') {
    const decoded = jwt.decode(idToken);
    tenantId = decoded && (decoded as Record<string, any>)[`${NAMESPACE}/tenant_id`] as string;
  }
  if (tenantId) {
    tenantCache.set(cookie, tenantId);
  }
  return tenantId;
}