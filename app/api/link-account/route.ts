import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(req: NextRequest) {
  const { primaryUserId, secondaryUserId, provider, managementApiToken } = await req.json();

  if (!primaryUserId || !secondaryUserId || !provider || !managementApiToken) {
    return NextResponse.json({ success: false, error: 'Missing required fields.' }, { status: 400 });
  }

  try {
    const res = await axios.post(
      `https://dev-du4she7bf5glt3zr.us.auth0.com/api/v2/users/${primaryUserId}/identities`,
      { provider, user_id: secondaryUserId },
      { headers: { Authorization: `Bearer ${managementApiToken}` } }
    );
    return NextResponse.json({ success: true, data: res.data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.response?.data || error.message }, { status: 500 });
  }
}
