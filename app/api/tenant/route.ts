import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/gcs-tenant';

export async function GET(req: NextRequest) {
  try {
    const tenantId = await getTenantId(req);
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ tenantId });
  } catch (error) {
    console.error('Error getting tenant ID:', error);
    return NextResponse.json({ error: 'Failed to get tenant ID' }, { status: 500 });
  }
}
