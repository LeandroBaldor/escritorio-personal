// Lógica de "¡Cuidado, bloques!": piezas de tetris que caen desde distintos lugares de arriba
// y un personaje chiquito que corre y salta para que no lo aplasten. Todo se mide en celdas
// (no en píxeles), así el juego no cambia si la pantalla cambia de tamaño.

export type Cell = string | null;
export interface Piece { id: number; x: number; y: number; cells: [number, number][]; width: number; height: number; color: string; speed: number }
export interface Player { x: number; y: number; vx: number; vy: number; onGround: boolean; facing: 1 | -1 }
export type GameOver = 'crushed';
export interface Game {
  cols: number; rows: number; grid: Cell[][]; pieces: Piece[]; player: Player;
  time: number; spawnIn: number; lines: number; lineScore: number; over: GameOver | null; nextId: number;
}
export interface Input { left: boolean; right: boolean; jump: boolean }

export const PLAYER_W = 0.6;
export const PLAYER_H = 0.85;
const RUN = 6;
const GRAVITY = 30;
const JUMP = 12.5; // alcanza para subir unos dos bloques y medio
const MAX_FALL = 18;
const EPS = 1e-6;

const SHAPES: { cells: [number, number][]; color: string }[] = [
  { cells: [[0, 0], [1, 0], [2, 0], [3, 0]], color: '#38bdf8' }, // I
  { cells: [[0, 0], [1, 0], [0, 1], [1, 1]], color: '#facc15' }, // O
  { cells: [[0, 0], [1, 0], [2, 0], [1, 1]], color: '#a855f7' }, // T
  { cells: [[1, 0], [2, 0], [0, 1], [1, 1]], color: '#22c55e' }, // S
  { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: '#ef4444' }, // Z
  { cells: [[0, 0], [0, 1], [1, 1], [2, 1]], color: '#3b82f6' }, // J
  { cells: [[2, 0], [0, 1], [1, 1], [2, 1]], color: '#f97316' }, // L
];

const rotate = (cells: [number, number][], turns: number) => {
  let out = cells;
  for (let i = 0; i < turns; i++) out = out.map(([x, y]) => [-y, x] as [number, number]);
  const minX = Math.min(...out.map(([x]) => x));
  const minY = Math.min(...out.map(([, y]) => y));
  return out.map(([x, y]) => [x - minX, y - minY] as [number, number]);
};

export function newGame(cols: number, rows: number): Game {
  return {
    cols, rows,
    grid: Array.from({ length: rows }, () => Array<Cell>(cols).fill(null)),
    pieces: [],
    player: { x: (cols - PLAYER_W) / 2, y: rows - PLAYER_H, vx: 0, vy: 0, onGround: true, facing: 1 },
    time: 0, spawnIn: 1, lines: 0, lineScore: 0, over: null, nextId: 1,
  };
}

export const score = (game: Game) => Math.floor(game.time * 10) + game.lineScore;

// ¿El rectángulo (en celdas) toca un bloque apoyado, una pared o el piso?
export function hitsGrid(game: Game, x: number, y: number, w: number, h: number) {
  for (let r = Math.floor(y); r <= Math.floor(y + h - EPS); r++) {
    for (let c = Math.floor(x); c <= Math.floor(x + w - EPS); c++) {
      if (c < 0 || c >= game.cols || r >= game.rows) return true;
      if (r >= 0 && game.grid[r][c]) return true;
    }
  }
  return false;
}

const pieceFits = (game: Game, piece: Piece, y: number) => piece.cells.every(([cx, cy]) => {
  const r = y + cy, c = piece.x + cx;
  return r < game.rows && (r < 0 || !game.grid[r][c]);
});

export function spawnPiece(game: Game, rand: () => number) {
  const shape = SHAPES[Math.floor(rand() * SHAPES.length)];
  const cells = rotate(shape.cells, Math.floor(rand() * 4));
  const width = Math.max(...cells.map(([x]) => x)) + 1;
  const height = Math.max(...cells.map(([, y]) => y)) + 1;
  // Cada pieza cae por columnas libres, así nunca choca con otra que todavía está cayendo.
  const free: number[] = [];
  for (let x = 0; x + width <= game.cols; x++) {
    if (game.pieces.every(p => x + width <= p.x || p.x + p.width <= x)) free.push(x);
  }
  if (!free.length) return;
  const speed = Math.min(7, 2.2 + game.time * 0.035) * (0.85 + rand() * 0.3);
  game.pieces.push({ id: game.nextId++, x: free[Math.floor(rand() * free.length)], y: -height, cells, width, height, color: shape.color, speed });
}

function clearRows(game: Game) {
  const kept = game.grid.filter(row => row.some(cell => !cell));
  const cleared = game.rows - kept.length;
  if (!cleared) return;
  game.grid = [...Array.from({ length: cleared }, () => Array<Cell>(game.cols).fill(null)), ...kept];
  game.lines += cleared;
  game.lineScore += [0, 100, 300, 600, 1000][Math.min(cleared, 4)];
}

function lock(game: Game, piece: Piece, y: number) {
  for (const [cx, cy] of piece.cells) {
    const r = y + cy;
    if (r < 0) continue; // lo que queda por encima de la pantalla se pierde y siguen cayendo piezas
    game.grid[r][piece.x + cx] = piece.color;
  }
  clearRows(game);
}

export function step(game: Game, input: Input, dt: number, rand: () => number = Math.random) {
  if (game.over || dt <= 0) return;
  game.time += dt;

  game.spawnIn -= dt;
  if (game.spawnIn <= 0) {
    spawnPiece(game, rand);
    game.spawnIn = Math.max(0.4, 1.4 - game.time * 0.012) * (0.7 + rand() * 0.6);
  }

  for (const piece of [...game.pieces]) {
    const next = piece.y + piece.speed * dt;
    if (pieceFits(game, piece, Math.ceil(next))) { piece.y = next; continue; }
    let landing = Math.floor(next);
    while (landing > -piece.height && !pieceFits(game, piece, landing)) landing--;
    game.pieces = game.pieces.filter(p => p !== piece);
    lock(game, piece, landing);
  }

  const p = game.player;
  p.vx = ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * RUN;
  if (p.vx) p.facing = p.vx > 0 ? 1 : -1;
  if (input.jump && p.onGround) { p.vy = -JUMP; p.onGround = false; }

  const oldX = p.x;
  p.x += p.vx * dt;
  if (p.vx && hitsGrid(game, p.x, p.y, PLAYER_W, PLAYER_H)) {
    p.x = p.vx > 0 ? Math.floor(p.x + PLAYER_W - EPS) - PLAYER_W : Math.floor(p.x) + 1;
    if (hitsGrid(game, p.x, p.y, PLAYER_W, PLAYER_H)) p.x = oldX;
  }

  p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt);
  p.y += p.vy * dt;
  p.onGround = false;
  // Puede asomarse por arriba si la pila llega al techo.
  if (p.y < -1) { p.y = -1; p.vy = Math.max(0, p.vy); }
  if (hitsGrid(game, p.x, p.y, PLAYER_W, PLAYER_H)) {
    if (p.vy > 0) { p.y = Math.floor(p.y + PLAYER_H - EPS) - PLAYER_H; p.onGround = true; }
    else p.y = Math.floor(p.y) + 1;
    p.vy = 0;
  }

  // Aplastado: un bloque apoyado le quedó encima (por ejemplo al borrarse una fila) o lo toca una pieza que cae.
  if (hitsGrid(game, p.x, p.y, PLAYER_W, PLAYER_H)) { game.over = 'crushed'; return; }
  const inset = 0.08;
  for (const piece of game.pieces) {
    for (const [cx, cy] of piece.cells) {
      const bx = piece.x + cx, by = piece.y + cy;
      if (p.x + inset < bx + 1 && p.x + PLAYER_W - inset > bx && p.y + inset < by + 1 && p.y + PLAYER_H > by) { game.over = 'crushed'; return; }
    }
  }
}
