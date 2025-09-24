import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(req: NextRequest) {
  const { email, managementApiToken } = await req.json();

  if (!email || !managementApiToken) {
    return NextResponse.json({ success: false, error: 'Missing required fields.' }, { status: 400 });
  }

  try {
    const res = await axios.get(
      `https://dev-du4she7bf5glt3zr.us.auth0.com/api/v2/users-by-email?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${managementApiToken}` } }
    );
    // Find the email/password user
    const emailUser = res.data.find((u: any) => u.identities.some((i: any) => i.provider === 'auth0'));
    return NextResponse.json({ success: true, user: emailUser || null });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.response?.data || error.message }, { status: 500 });
  }
}
