// Lógica de "¡Cuidado, bloques!": piezas de tetris y bombas que caen desde distintos lugares de
// arriba, y un personaje chiquito que corre y salta para que no lo aplasten. Una pieza que cae
// rompe los bloques de su mismo color que encuentra abajo. Todo se mide en celdas (no en
// píxeles), así el juego no cambia si la pantalla cambia de tamaño.

export type Cell = string | null;
export interface Piece { id: number; x: number; y: number; cells: [number, number][]; width: number; height: number; color: string; speed: number }
export interface Bomb { id: number; x: number; y: number; speed: number }
export interface Player { x: number; y: number; vx: number; vy: number; onGround: boolean; facing: 1 | -1 }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
export interface Blast { x: number; y: number; t: number; max: number; size: number }
export type GameOver = 'crushed' | 'bomb' | 'full';
export interface Game {
  cols: number; rows: number; grid: Cell[][]; pieces: Piece[]; bombs: Bomb[]; player: Player;
  particles: Particle[]; blasts: Blast[];
  time: number; spawnIn: number; lines: number; lineScore: number; broken: number; over: GameOver | null; nextId: number;
}
export interface Input { left: boolean; right: boolean; jump: boolean }

export const PLAYER_W = 0.6;
export const PLAYER_H = 0.85;
const RUN = 6;
const GRAVITY = 30;
const JUMP = 12.5; // alcanza para subir unos dos bloques y medio
const MAX_FALL = 18;
const EPS = 1e-6;
export const BREAK_POINTS = 10;

const SHAPES: { cells: [number, number][]; color: string }[] = [
  { cells: [[0, 0], [1, 0], [2, 0], [3, 0]], color: '#38bdf8' }, // I
  { cells: [[0, 0], [1, 0], [0, 1], [1, 1]], color: '#facc15' }, // O
  { cells: [[0, 0], [1, 0], [2, 0], [1, 1]], color: '#a855f7' }, // T
  { cells: [[1, 0], [2, 0], [0, 1], [1, 1]], color: '#22c55e' }, // S
  { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: '#ef4444' }, // Z
  { cells: [[0, 0], [0, 1], [1, 1], [2, 1]], color: '#3b82f6' }, // J
  { cells: [[2, 0], [0, 1], [1, 1], [2, 1]], color: '#f97316' }, // L
];
const BLAST_COLORS = ['#fde047', '#fb923c', '#ef4444', '#78716c'];

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
    pieces: [], bombs: [], particles: [], blasts: [],
    player: { x: (cols - PLAYER_W) / 2, y: rows - PLAYER_H, vx: 0, vy: 0, onGround: true, facing: 1 },
    time: 0, spawnIn: 1, lines: 0, lineScore: 0, broken: 0, over: null, nextId: 1,
  };
}

export const score = (game: Game) => Math.floor(game.time * 10) + game.lineScore + game.broken * BREAK_POINTS;

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

// Los bloques del mismo color no frenan a la pieza: los rompe al pasar.
const pieceFits = (game: Game, piece: Piece, y: number) => piece.cells.every(([cx, cy]) => {
  const r = y + cy, c = piece.x + cx;
  if (r >= game.rows) return false;
  const cell = r < 0 ? null : game.grid[r][c];
  return !cell || cell === piece.color;
});

const overlapsPlayer = (p: Player, x: number, y: number, w: number, h: number, inset = 0.08) =>
  p.x + inset < x + w && p.x + PLAYER_W - inset > x && p.y + inset < y + h && p.y + PLAYER_H > y;

function burst(game: Game, x: number, y: number, colors: string[], count: number, power: number, rand: () => number) {
  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2, speed = power * (0.4 + rand() * 0.8), max = 0.45 + rand() * 0.4;
    game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - power * 0.4, life: max, max, color: colors[Math.floor(rand() * colors.length)], size: 0.12 + rand() * 0.16 });
  }
}

function breakCell(game: Game, r: number, c: number, rand: () => number, points: boolean) {
  const color = game.grid[r][c];
  if (!color) return;
  game.grid[r][c] = null;
  if (points) game.broken++;
  game.blasts.push({ x: c + 0.5, y: r + 0.5, t: 0, max: 0.3, size: 0.45 });
  burst(game, c + 0.5, r + 0.5, [color, color, '#ffffff'], 10, 6, rand);
}

// Columnas libres para que una pieza o bomba nueva no caiga encima de otra que todavía está cayendo.
function freeColumns(game: Game, width: number) {
  const free: number[] = [];
  for (let x = 0; x + width <= game.cols; x++) {
    if (game.pieces.every(p => x + width <= p.x || p.x + p.width <= x) && game.bombs.every(b => x + width <= b.x || b.x + 1 <= x)) free.push(x);
  }
  return free;
}

const fallSpeed = (game: Game, rand: () => number) => Math.min(7, 2.2 + game.time * 0.035) * (0.85 + rand() * 0.3);

export function spawnPiece(game: Game, rand: () => number) {
  const shape = SHAPES[Math.floor(rand() * SHAPES.length)];
  const cells = rotate(shape.cells, Math.floor(rand() * 4));
  const width = Math.max(...cells.map(([x]) => x)) + 1;
  const height = Math.max(...cells.map(([, y]) => y)) + 1;
  const free = freeColumns(game, width);
  if (!free.length) return;
  game.pieces.push({ id: game.nextId++, x: free[Math.floor(rand() * free.length)], y: -height, cells, width, height, color: shape.color, speed: fallSpeed(game, rand) });
}

export function spawnBomb(game: Game, rand: () => number) {
  const free = freeColumns(game, 1);
  if (!free.length) return;
  game.bombs.push({ id: game.nextId++, x: free[Math.floor(rand() * free.length)], y: -1, speed: fallSpeed(game, rand) * 1.15 });
}

// Explota en la celda (x, y): rompe los bloques de alrededor (3×3) y, si el personaje está ahí, pierde.
export function explode(game: Game, x: number, y: number, rand: () => number) {
  for (let r = y - 1; r <= y + 1; r++) for (let c = x - 1; c <= x + 1; c++) {
    if (r >= 0 && r < game.rows && c >= 0 && c < game.cols) breakCell(game, r, c, rand, false);
  }
  game.blasts.push({ x: x + 0.5, y: y + 0.5, t: 0, max: 0.7, size: 1 });
  burst(game, x + 0.5, y + 0.5, BLAST_COLORS, 40, 10, rand);
  if (!game.over && overlapsPlayer(game.player, x - 1, y - 1, 3, 3, 0.12)) game.over = 'bomb';
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
    if (r < 0) { game.over = 'full'; continue; } // los bloques llegaron arriba
    game.grid[r][piece.x + cx] = piece.color;
  }
  clearRows(game);
}

function updateEffects(game: Game, dt: number) {
  for (const s of game.particles) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 22 * dt; s.life -= dt; }
  game.particles = game.particles.filter(s => s.life > 0);
  for (const b of game.blasts) b.t += dt;
  game.blasts = game.blasts.filter(b => b.t < b.max);
}

export function step(game: Game, input: Input, dt: number, rand: () => number = Math.random) {
  if (dt <= 0) return;
  updateEffects(game, dt); // las explosiones se siguen viendo un momento después de perder
  if (game.over) return;
  game.time += dt;

  game.spawnIn -= dt;
  if (game.spawnIn <= 0) {
    const bombChance = game.time < 5 ? 0 : Math.min(0.3, 0.12 + game.time * 0.002);
    if (rand() < bombChance) spawnBomb(game, rand); else spawnPiece(game, rand);
    game.spawnIn = Math.max(0.4, 1.4 - game.time * 0.012) * (0.7 + rand() * 0.6);
  }

  for (const piece of [...game.pieces]) {
    const next = piece.y + piece.speed * dt;
    if (pieceFits(game, piece, Math.ceil(next))) {
      piece.y = next;
      for (const [cx, cy] of piece.cells) {
        for (const r of new Set([Math.floor(next + cy), Math.ceil(next + cy)])) {
          if (r >= 0 && r < game.rows && game.grid[r][piece.x + cx] === piece.color) breakCell(game, r, piece.x + cx, rand, true);
        }
      }
      continue;
    }
    let landing = Math.floor(next);
    while (landing > -piece.height && !pieceFits(game, piece, landing)) landing--;
    for (const [cx, cy] of piece.cells) {
      const r = landing + cy;
      if (r >= 0 && game.grid[r][piece.x + cx] === piece.color) breakCell(game, r, piece.x + cx, rand, true);
    }
    game.pieces = game.pieces.filter(p => p !== piece);
    lock(game, piece, landing);
  }

  for (const bomb of [...game.bombs]) {
    const next = bomb.y + bomb.speed * dt;
    const below = Math.ceil(next);
    const lands = below >= game.rows || (below >= 0 && !!game.grid[below][bomb.x]);
    const touches = overlapsPlayer(game.player, bomb.x + 0.15, next + 0.15, 0.7, 0.7, 0);
    if (!lands && !touches) { bomb.y = next; continue; }
    game.bombs = game.bombs.filter(b => b !== bomb);
    explode(game, bomb.x, lands ? Math.floor(next) : Math.round(next), rand);
  }
  if (game.over) return;

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
  if (p.y < 0) { p.y = 0; p.vy = Math.max(0, p.vy); }
  if (hitsGrid(game, p.x, p.y, PLAYER_W, PLAYER_H)) {
    if (p.vy > 0) { p.y = Math.floor(p.y + PLAYER_H - EPS) - PLAYER_H; p.onGround = true; }
    else p.y = Math.floor(p.y) + 1;
    p.vy = 0;
  }

  // Aplastado: un bloque apoyado le quedó encima (por ejemplo al borrarse una fila) o lo toca una pieza que cae.
  if (hitsGrid(game, p.x, p.y, PLAYER_W, PLAYER_H)) { game.over = 'crushed'; return; }
  for (const piece of game.pieces) {
    for (const [cx, cy] of piece.cells) {
      if (overlapsPlayer(p, piece.x + cx, piece.y + cy, 1, 1)) { game.over = 'crushed'; return; }
    }
  }
}
