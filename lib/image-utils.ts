/**
 * Extract frame number from image filename
 * @param fileName - Image filename like "player_123.jpg"
 * @returns Frame number (e.g., 123) or 0 if not found
 */
export function extractFrameNumber(fileName: string): number {
  const match = fileName.match(/_(\d+)\.(jpg|jpeg|png)$/i);
  return match ? parseInt(match[1], 10) : 0;
}
