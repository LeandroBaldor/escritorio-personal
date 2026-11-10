export const MAZE_WIDTH = 1600;
export const MAZE_TIER = 288;
export const MAZE_GAP = 204;
export const MAZE_TIERS_PER_LEVEL = 7;
export const MAZE_ROWS_PER_LEVEL = MAZE_TIERS_PER_LEVEL * 2;
export type MazeWall = { x: number; y: number; w: number; h: number };
export const MAZE_STRUCTURES = [
  { name: 'Galerías gemelas', gap: 204, lanes: [180, 490, 800, 1110, 1420], routes: [[1, 3], [0, 2], [2, 4], [1, 4], [0, 3], [1, 2], [0, 4]] },
  { name: 'Chimeneas de vapor', gap: 224, lanes: [160, 470, 800, 1130, 1440], routes: [[0, 2, 4], [1, 3], [0, 2, 4], [1, 4], [0, 3], [1, 2, 4], [0, 3]] },
  { name: 'Cámaras de decantación', gap: 192, lanes: [180, 500, 820, 1130, 1440], routes: [[0, 1], [2, 4], [1, 2], [3, 4], [0, 2], [2, 3], [0, 4]] },
  { name: 'Pasajes en zigzag', gap: 212, lanes: [150, 470, 790, 1110, 1430], routes: [[0, 3], [1, 4], [0, 2], [1, 3], [2, 4], [0, 3], [1, 4]] },
  { name: 'Líneas de envasado', gap: 224, lanes: [170, 480, 800, 1120, 1430], routes: [[0, 4], [1, 3], [0, 4], [1, 2, 3], [0, 4], [1, 3], [0, 2, 4]] },
  { name: 'Torres de distribución', gap: 188, lanes: [180, 500, 800, 1100, 1420], routes: [[0, 2, 4], [0, 3], [1, 2, 4], [0, 2], [1, 3, 4], [0, 3], [1, 2, 4]] },
  { name: 'Depósitos escalonados', gap: 220, lanes: [160, 460, 780, 1110, 1440], routes: [[0, 1], [1, 2], [2, 3], [3, 4], [1, 4], [0, 2], [2, 4]] },
  { name: 'Celdas de montaje', gap: 200, lanes: [180, 490, 800, 1110, 1420], routes: [[1, 2, 3], [0, 4], [0, 2], [2, 4], [0, 4], [1, 2, 3], [0, 4]] },
  { name: 'Anillos del reactor', gap: 232, lanes: [150, 470, 800, 1130, 1450], routes: [[1, 3], [0, 4], [0, 2, 4], [1, 3], [0, 4], [1, 2, 3], [0, 4]] },
  { name: 'Muelles orbitales', gap: 216, lanes: [170, 480, 810, 1130, 1440], routes: [[0, 4], [0, 1, 3], [1, 2, 4], [0, 3], [1, 4], [0, 2, 3], [1, 4]] },
];
export function mazeOpenings(level: number, tier: number) {
  return [...MAZE_STRUCTURES[level].routes[(tier - 1) % MAZE_TIERS_PER_LEVEL]];
}
export const mazeLaneX = (lane: number, level = 0) => MAZE_STRUCTURES[level].lanes[lane];
export const mazeGap = (level: number) => MAZE_STRUCTURES[level].gap;
// Open chambers replace entire walkways with stepping islands, changing each factory's silhouette.
const openChambers = [[], [2, 4, 6], [], [1, 3, 5], [], [], [2, 5], [], [], [2, 3, 5, 6]];
export const mazeHasSolidFloor = (level: number, tier: number) => !openChambers[level].includes(tier);
export function mazeFloorSegments(level: number, tier: number) {
  const segments: { x: number; w: number }[] = [];
  let left = 0;
  for (const lane of mazeOpenings(level, tier)) {
    const x = mazeLaneX(lane, level), gap = mazeGap(level);
    if (x - gap / 2 > left) segments.push({ x: (left + x - gap / 2) / 2, w: x - gap / 2 - left });
    left = x + gap / 2;
  }
  if (left < MAZE_WIDTH) segments.push({ x: (left + MAZE_WIDTH) / 2, w: MAZE_WIDTH - left });
  return segments;
}
export function mazeWalls() {
  const walls: MazeWall[] = [];
  for (let band = 1; band < MAZE_TIERS_PER_LEVEL * 10; band++) {
    const level = Math.floor(band / MAZE_TIERS_PER_LEVEL), tier = band % MAZE_TIERS_PER_LEVEL + 1;
    if (!mazeHasSolidFloor(level, tier) && [1, 3, 9].includes(level)) continue;
    const lanes = mazeOpenings(level, tier);
    // Hanging partitions leave a walkable doorway below. Low partitions can be cleared with the weakest gas.
    for (let boundary = 0; boundary < 4; boundary++) {
      const dense = [1, 7, 8].includes(level), sparse = [0, 3, 9].includes(level);
      if (!dense && (boundary + band + level) % (sparse ? 3 : 2)) continue;
      const low = !lanes.includes(boundary) && !lanes.includes(boundary + 1) && (band + level) % (level === 4 ? 2 : 3) === 0;
      const door = level === 8 ? 128 : level === 2 ? 140 : 152;
      const x = (mazeLaneX(boundary, level) + mazeLaneX(boundary + 1, level)) / 2;
      walls.push({ x: x - 14, y: band * MAZE_TIER + (low ? 0 : door), w: 28, h: low ? 120 + level % 3 * 5 : 266 - door });
    }
  }
  return walls;
}
