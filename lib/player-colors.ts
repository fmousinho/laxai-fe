/**
 * Player Color Utilities
 * 
 * Provides consistent color assignment for players across the application.
 * Used for bounding boxes in FrameRenderer and borders in PlayerList.
 */

/**
 * Predefined color palette for player identification.
 * Colors are chosen for visual distinction and accessibility.
 */
const PLAYER_COLOR_PALETTE = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Sky Blue
  '#FFA07A', // Light Salmon
  '#98D8C8', // Mint
  '#F7DC6F', // Yellow
  '#BB8FCE', // Purple
  '#85C1E2', // Light Blue
  '#F8B739', // Orange
  '#52B788', // Green
  '#E74C3C', // Bright Red
  '#3498DB', // Bright Blue
  '#9B59B6', // Violet
  '#1ABC9C', // Turquoise
  '#F39C12', // Dark Orange
  '#E67E22', // Carrot Orange
  '#16A085', // Dark Teal
  '#2980B9', // Belize Blue
  '#8E44AD', // Wisteria
  '#27AE60', // Nephritis Green
];

/**
 * Get a consistent color for a player based on their ID.
 * 
 * @param playerId - The unique identifier for the player
 * @returns A hex color string (e.g., '#FF6B6B')
 * 
 * @example
 * const color = getPlayerColor(1); // Returns '#4ECDC4'
 * ctx.strokeStyle = color;
 */
export function getPlayerColor(playerId: number): string {
  // Use modulo to cycle through the palette for IDs beyond the palette size
  const index = Math.abs(playerId) % PLAYER_COLOR_PALETTE.length;
  return PLAYER_COLOR_PALETTE[index];
}

/**
 * Get the color palette length (useful for external consumers).
 */
export function getColorPaletteSize(): number {
  return PLAYER_COLOR_PALETTE.length;
}

/**
 * Get the entire color palette (for color pickers, legends, etc.).
 */
export function getColorPalette(): readonly string[] {
  return PLAYER_COLOR_PALETTE;
}
