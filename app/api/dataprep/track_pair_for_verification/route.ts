import { NextResponse } from 'next/server';

// Mocked image URLs (replace with real GCS URLs later)
const mockImagesA = Array.from({ length: 20 }, (_, i) => `https://placehold.co/60x${40 + (i % 3) * 20}?text=A${i+1}`);
const mockImagesB = Array.from({ length: 20 }, (_, i) => `https://placehold.co/60x${40 + (i % 3) * 20}?text=B${i+1}`);

export async function GET() {
  // Simulate latency
  await new Promise((r) => setTimeout(r, 300));
  return NextResponse.json({ imagesA: mockImagesA, imagesB: mockImagesB });
}
