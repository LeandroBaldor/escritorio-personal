export const MAZE_WIDTH = 1600;
export const MAZE_TIER = 288;
export const MAZE_GAP = 204;
export type MazeWall = { x: number; y: number; w: number; h: number };
const patterns = [[1, 3], [0, 2], [2, 4], [1, 4], [0, 3]];
export function mazeOpenings(level: number, tier: number) {
  const base = patterns[(tier - 1 + Math.floor(level / 5)) % patterns.length];
  return base.map(lane => level < 5 ? (lane + level) % 5 : 4 - (lane + level) % 5).sort((a, b) => a - b);
}
export const mazeLaneX = (lane: number) => 180 + lane * 310;
export function mazeFloorSegments(level: number, tier: number) {
  const segments: { x: number; w: number }[] = [];
  let left = 0;
  for (const lane of mazeOpenings(level, tier)) {
    const x = mazeLaneX(lane);
    if (x - MAZE_GAP / 2 > left) segments.push({ x: (left + x - MAZE_GAP / 2) / 2, w: x - MAZE_GAP / 2 - left });
    left = x + MAZE_GAP / 2;
  }
  if (left < MAZE_WIDTH) segments.push({ x: (left + MAZE_WIDTH) / 2, w: MAZE_WIDTH - left });
  return segments;
}
export function mazeWalls() {
  const walls: MazeWall[] = [];
  for (let band = 1; band < 50; band++) {
    const level = Math.floor(band / 5), tier = band % 5 + 1;
    const lanes = mazeOpenings(level, tier);
    // Hanging partitions leave a walkable doorway below. Low partitions can be cleared with the weakest gas.
    for (let boundary = 0; boundary < 4; boundary++) {
      if ((boundary + band + level) % 2) continue;
      const low = !lanes.includes(boundary) && !lanes.includes(boundary + 1) && (band + level) % 3 === 0;
      walls.push({ x: 335 + boundary * 310 - 14, y: band * MAZE_TIER + (low ? 0 : 152), w: 28, h: low ? 130 : 114 });
    }
  }
  return walls;
}
