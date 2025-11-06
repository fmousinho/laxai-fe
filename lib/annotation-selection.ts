// Minimal instruction shape for hit-testing
export interface AnnotationInstructionLite {
  type: 'bbox' | 'label' | 'point' | 'line';
  coords: number[]; // [x1,y1,x2,y2] for bbox
  player_id: number;
  tracker_id?: number;
  old_tracker_id?: number;
}

export interface HitTestResult {
  player_id: number;
  tracker_id?: number;
  old_tracker_id?: number;
  bbox: [number, number, number, number];
}

// Returns the top-most bbox (smallest area) containing the point, or null
export function findBboxAtPoint(
  instructions: AnnotationInstructionLite[],
  x: number,
  y: number
): HitTestResult | null {
  const hits: { ins: AnnotationInstructionLite; area: number }[] = [];

  for (const ins of instructions) {
    if (ins.type !== 'bbox') continue;
    const [x1, y1, x2, y2] = ins.coords;
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const right = Math.max(x1, x2);
    const bottom = Math.max(y1, y2);

    if (x >= left && x <= right && y >= top && y <= bottom) {
      const area = Math.max(1, (right - left) * (bottom - top));
      hits.push({ ins, area });
    }
  }

  if (hits.length === 0) return null;

  // Choose the smallest area match (front-most)
  hits.sort((a, b) => a.area - b.area);
  const ins = hits[0].ins;
  const [x1, y1, x2, y2] = ins.coords;
  return {
    player_id: ins.player_id,
    tracker_id: ins.tracker_id,
    old_tracker_id: ins.old_tracker_id,
    bbox: [x1, y1, x2, y2],
  };
}
