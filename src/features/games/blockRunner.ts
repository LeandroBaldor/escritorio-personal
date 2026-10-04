// Lógica de "¡Cuidado, bloques!": piezas de tetris y bombas que caen desde distintos lugares de
// arriba, y un personaje chiquito que corre y salta para que no lo aplasten. Una pieza que cae
// rompe los bloques de su mismo color que encuentra abajo. Todo se mide en celdas (no en
// píxeles), así el juego no cambia si la pantalla cambia de tamaño.

export type Cell = string | null;
export interface Piece { id: number; x: number; y: number; cells: [number, number][]; width: number; height: number; color: string; speed: number; drilled?: boolean }
export interface Bomb { id: number; x: number; y: number; speed: number }
export interface Player { x: number; y: number; vx: number; vy: number; onGround: boolean; facing: 1 | -1 }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
export interface Blast { x: number; y: number; t: number; max: number; size: number }
export type GameOver = 'crushed' | 'bomb' | 'full' | 'trapped';
export interface Game {
  cols: number; rows: number; grid: Cell[][]; pieces: Piece[]; bombs: Bomb[]; player: Player;
  particles: Particle[]; blasts: Blast[];
  time: number; spawnIn: number; lines: number; lineScore: number; broken: number; over: GameOver | null; nextId: number; trapped: number;
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
    time: 0, spawnIn: 1, lines: 0, lineScore: 0, broken: 0, over: null, nextId: 1, trapped: 0,
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

const MAX_SHOVE = 0.35;

// Corre al personaje hacia el costado libre más cercano (poquito) cuando quedó encimado con un bloque.
function shove(game: Game) {
  const p = game.player;
  const options = [Math.floor(p.x + PLAYER_W - EPS) - PLAYER_W, Math.floor(p.x) + 1].sort((a, b) => Math.abs(a - p.x) - Math.abs(b - p.x));
  for (const x of options) {
    if (Math.abs(x - p.x) <= MAX_SHOVE && !hitsGrid(game, x, p.y, PLAYER_W, PLAYER_H)) { p.x = x; return true; }
  }
  return false;
}

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

// Gravedad: después de romper bloques, los de arriba caen y tapan los huecos de esa columna.
// Nunca atraviesan al personaje: si está abajo, se frenan justo encima de él.
function collapse(game: Game, columns: Iterable<number>) {
  const p = game.player;
  for (const c of new Set(columns)) {
    if (c < 0 || c >= game.cols) continue;
    const underPlayer = p.x < c + 1 && p.x + PLAYER_W > c;
    const playerTop = Math.floor(p.y);
    let w = game.rows - 1;
    for (let r = game.rows - 1; r >= 0; r--) {
      const cell = game.grid[r][c];
      if (!cell) continue;
      let dest = w;
      if (underPlayer && r < playerTop && dest >= playerTop) dest = Math.max(r, playerTop - 1);
      if (dest !== r) { game.grid[dest][c] = cell; game.grid[r][c] = null; }
      w = dest - 1;
    }
  }
  clearRows(game);
}

// Columnas libres para que una pieza o bomba nueva no caiga encima de otra que todavía está cayendo.
function freeColumns(game: Game, width: number) {
  const free: number[] = [];
  for (let x = 0; x + width <= game.cols; x++) {
    if (game.pieces.every(p => x + width <= p.x || p.x + p.width <= x) && game.bombs.every(b => x + width <= b.x || b.x + 1 <= x)) free.push(x);
  }
  return free;
}

// Dificultad: sube de a poco (el nivel que se muestra cambia cada 30 segundos). Las piezas caen más
// rápido, aparecen más seguido y casi la mitad de lo que cae son bombas. La cantidad de piezas depende del tamaño del tablero, así en la compu y en el celular la
// pila tarda parecido en llegar arriba (una ronda dura unos 2 a 3 minutos).
export const LEVEL_SECONDS = 30;
export const level = (game: Game) => 1 + Math.floor(game.time / LEVEL_SECONDS);
const SPAWN_BASE = 1.1;
const spawnInterval = (game: Game, rand: () => number) =>
  SPAWN_BASE * (196 / (game.cols * game.rows)) * rush(game.time) * (0.75 + rand() * 0.5);
// Va apurando de a poco y, pasados los 2 minutos y medio, mucho más: así la ronda termina antes de los 3 minutos.
const rush = (t: number) => t < 150 ? 1 - t / 330 : 0.545 * Math.max(0.25, 1 - (t - 150) / 40);
const bombChance = (game: Game) => game.time < 3 ? 0 : game.time > 150 ? 0.1 : Math.min(0.55, 0.4 + game.time * 0.0012);
const fallSpeed = (game: Game, rand: () => number) => Math.min(8, 2.6 + game.time * 0.03) * (0.85 + rand() * 0.3);

export function spawnPiece(game: Game, rand: () => number) {
  const shape = SHAPES[Math.floor(rand() * SHAPES.length)];
  const cells = rotate(shape.cells, Math.floor(rand() * 4));
  const width = Math.max(...cells.map(([x]) => x)) + 1;
  const height = Math.max(...cells.map(([, y]) => y)) + 1;
  const free = freeColumns(game, width);
  if (!free.length) return;
  // Prefiere los lugares donde la pila está más baja: así crece pareja y no termina por una sola torre.
  const room = (x: number) => Math.min(...Array.from({ length: width }, (_, i) => {
    const r = game.grid.findIndex(row => row[x + i]);
    return r < 0 ? game.rows : r;
  }));
  // Mientras haya lugar en otro lado, no cae donde la pila ya está casi arriba.
  const roomy = free.filter(x => room(x) >= height + 2);
  const spots = roomy.length ? roomy : free;
  const weights = spots.map(x => room(x) ** 3 + 0.01);
  let pick = rand() * weights.reduce((a, w) => a + w, 0), i = 0;
  while (i < spots.length - 1 && (pick -= weights[i]) > 0) i++;
  game.pieces.push({ id: game.nextId++, x: spots[i], y: -height, cells, width, height, color: shape.color, speed: fallSpeed(game, rand) });
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
  collapse(game, [x - 1, x, x + 1]);
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
    if (rand() < bombChance(game)) spawnBomb(game, rand); else spawnPiece(game, rand);
    game.spawnIn = spawnInterval(game, rand);
  }

  for (const piece of [...game.pieces]) {
    const next = piece.y + piece.speed * dt;
    if (pieceFits(game, piece, Math.ceil(next))) {
      piece.y = next;
      const broken = game.broken;
      for (const [cx, cy] of piece.cells) {
        for (const r of new Set([Math.floor(next + cy), Math.ceil(next + cy)])) {
          if (r >= 0 && r < game.rows && game.grid[r][piece.x + cx] === piece.color) breakCell(game, r, piece.x + cx, rand, true);
        }
      }
      if (game.broken !== broken) piece.drilled = true;
      continue;
    }
    let landing = Math.floor(next);
    while (landing > -piece.height && !pieceFits(game, piece, landing)) landing--;
    for (const [cx, cy] of piece.cells) {
      const r = landing + cy;
      if (r >= 0 && game.grid[r][piece.x + cx] === piece.color) { breakCell(game, r, piece.x + cx, rand, true); piece.drilled = true; }
    }
    game.pieces = game.pieces.filter(p => p !== piece);
    lock(game, piece, landing);
    // Si rompió bloques en el camino, al apoyarse cae lo que quedó flotando en sus columnas.
    if (piece.drilled && !game.over) collapse(game, piece.cells.map(([cx]) => piece.x + cx));
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
  const oldY = p.y;
  p.y += p.vy * dt;
  p.onGround = false;
  if (p.y < 0) { p.y = 0; p.vy = Math.max(0, p.vy); }
  if (hitsGrid(game, p.x, p.y, PLAYER_W, PLAYER_H)) {
    // Se apoya (o choca la cabeza) en el borde libre más cercano. Si pasó en diagonal por la esquina
    // de una torre, puede hacer falta subir o bajar otra fila; si no hay lugar, vuelve adonde estaba.
    const down = p.vy > 0;
    let y = down ? Math.floor(p.y + PLAYER_H - EPS) - PLAYER_H : Math.floor(p.y) + 1;
    while (hitsGrid(game, p.x, y, PLAYER_W, PLAYER_H) && Math.abs(y - oldY) < 1.5) y += down ? -1 : 1;
    p.y = hitsGrid(game, p.x, y, PLAYER_W, PLAYER_H) ? oldY : y;
    p.onGround = down;
    p.vy = 0;
  }

  // Si una pieza lo roza de costado (al caer o al apoyarse al lado) lo empuja; solo lo aplasta si le cae encima.
  if (hitsGrid(game, p.x, p.y, PLAYER_W, PLAYER_H) && !shove(game)) { game.over = 'crushed'; return; }
  for (const piece of game.pieces) {
    const touching = piece.cells.map(([cx, cy]) => [piece.x + cx, piece.y + cy]).filter(([bx, by]) => overlapsPlayer(p, bx, by, 1, 1, 0));
    if (!touching.length) continue;
    // Si la pieza le tapa más que un costadito, le cayó encima.
    if (touching.some(([bx]) => Math.min(p.x + PLAYER_W - bx, bx + 1 - p.x) > MAX_SHOVE)) { game.over = 'crushed'; return; }
    const [bx] = touching[0];
    p.x = p.x + PLAYER_W / 2 < bx + 0.5 ? bx - PLAYER_W : bx + 1;
    if (hitsGrid(game, p.x, p.y, PLAYER_W, PLAYER_H)) { game.over = 'crushed'; return; }
  }

  // Encerrado: si los bloques lo dejan en un hueco sin salida hacia arriba, tiene 10 segundos para
  // salir (una bomba o una pieza de su color pueden abrirle camino). Si no, queda atrapado.
  game.trapped = isEnclosed(game) ? game.trapped + dt : 0;
  if (game.trapped >= TRAP_SECONDS) game.over = 'trapped';
}

export const TRAP_SECONDS = 10;

// ¿El hueco donde está el personaje está cerrado? Recorre las celdas vacías conectadas (arriba,
// abajo y a los costados) y se fija si alguna llega a la fila de arriba de todo.
export function isEnclosed(game: Game) {
  const p = game.player;
  const sc = Math.floor(p.x + PLAYER_W / 2), sr = Math.floor(p.y + PLAYER_H / 2);
  if (sr <= 0) return false;
  const seen = new Set<number>([sr * game.cols + sc]);
  const queue = [[sr, sc]];
  while (queue.length) {
    const [r, c] = queue.pop()!;
    if (r === 0) return false;
    for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
      if (nr < 0 || nr >= game.rows || nc < 0 || nc >= game.cols || game.grid[nr][nc]) continue;
      const key = nr * game.cols + nc;
      if (!seen.has(key)) { seen.add(key); queue.push([nr, nc]); }
    }
  }
  return true;
}
