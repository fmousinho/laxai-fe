import { NextResponse } from 'next/server';

export async function POST() {
  // For now, just return a success message. Add logic later as needed.
  return NextResponse.json({ success: true, message: 'Classification suspended.' });
}
