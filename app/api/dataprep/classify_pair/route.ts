import { NextRequest, NextResponse } from 'next/server';

// Mocked image URLs (replace with real GCS URLs later)
const mockImagesA = Array.from({ length: 20 }, (_, i) => `https://placehold.co/60x${40 + (i % 3) * 20}?text=A${i+21}`);
const mockImagesB = Array.from({ length: 20 }, (_, i) => `https://placehold.co/60x${40 + (i % 3) * 20}?text=B${i+21}`);

export async function POST(req: NextRequest) {
  // Optionally, read the label from the request body
  // const { label } = await req.json(); // 'same' or 'different'
  await new Promise((r) => setTimeout(r, 300));
  return NextResponse.json({ imagesA: mockImagesA, imagesB: mockImagesB });
}
