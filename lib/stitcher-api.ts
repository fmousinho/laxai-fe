/**
 * Centralized configuration for Stitcher Backend API
 * 
 * Backend API Structure:
 * - Base URL: Set via STITCHER_API_BASE_URL environment variable
 * - Expected format: https://backend.example.com/api/v1/stitcher
 * 
 * All backend endpoints are defined here for easy maintenance.
 */

export const STITCHER_API_BASE_URL = process.env.STITCHER_API_BASE_URL;

/**
 * All stitcher API endpoint paths (relative to base URL)
 */
export const STITCHER_API_ENDPOINTS = {
  loadVideo: '/video/load',
  nextFrame: (sessionId: string) => `/video/next-frame/${sessionId}`,
  previousFrame: (sessionId: string) => `/video/previous-frame/${sessionId}`,
  frameAnnotations: (sessionId: string, frameId: string) => 
    `/video/frames/${sessionId}/${frameId}/annotations`,
  frameImage: (sessionId: string, frameId: string) => 
    `/video/frames/${sessionId}/${frameId}/image`,
  getPlayers: '/video/players',
  createPlayer: '/video/players',
  updatePlayer: (playerId: number) => `/video/players/${playerId}`,
  deletePlayer: (playerId: number) => `/video/players/${playerId}`,
} as const;

/**
 * Build a full URL for a stitcher API endpoint
 * @param endpoint - Endpoint path or function that returns a path
 * @returns Full URL to the backend endpoint
 * @throws Error if STITCHER_API_BASE_URL is not configured
 */
export function getStitcherApiUrl(endpoint: string): string {
  if (!STITCHER_API_BASE_URL) {
    throw new Error('STITCHER_API_BASE_URL environment variable is not set');
  }
  
  // Remove leading slash from endpoint if present to avoid double slashes
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  return `${STITCHER_API_BASE_URL}${normalizedEndpoint}`;
}
