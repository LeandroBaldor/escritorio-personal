// Lógica de "Serpiente al Revés": el viborita de siempre, pero vos sos la manzana. La serpiente te
// persigue por el jardín buscando el camino más corto; cada pocos segundos crece y va más rápido, así
// que cada vez queda menos lugar para escapar. Su propio cuerpo es una pared: si la hacés enredarse
// (que no tenga por dónde seguir), se marea, te da puntos extra y vuelve a empezar cortita.
// Por el camino hay semillas doradas (puntos), tijeras (le cortan la cola) y relojes (la congelan).

export type Dir = 'up' | 'down' | 'left' | 'right';
export interface Cell { x: number; y: number }
export type PowerKind = 'scissors' | 'clock';
export interface Power extends Cell { kind: PowerKind; life: number }
export interface Snake { body: Cell[]; dir: Dir; stepIn: number; grow: number; freeze: number; dizzy: number }
export interface Apple extends Cell { moveIn: number; facing: 1 | -1; hop: number }
export type SnakeEvent = { type: 'seed' } | { type: 'power'; kind: PowerKind } | { type: 'tangled' } | { type: 'grow' } | { type: 'caught' };
export interface Game {
  cols: number; rows: number; apple: Apple; snake: Snake; seeds: Cell[]; powers: Power[];
  time: number; bonus: number; tangles: number; nextGrow: number; nextPower: number; over: boolean; events: SnakeEvent[];
}
export interface Input { dir: Dir | null }

export const APPLE_STEP = 0.12; // segundos por casillero de la manzana
export const GROW_EVERY = 6;
export const SEED_POINTS = 50, TANGLE_POINTS = 300;
const START_LEN = 4, SEEDS = 3, POWER_LIFE = 9;
export const DIRS: Record<Dir, Cell> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const ORDER: Dir[] = ['up', 'right', 'down', 'left'];

export const snakeInterval = (time: number) => Math.max(0.13, 0.34 - time * 0.0022);
export const level = (g: Game) => 1 + Math.floor(g.time / 20);
export const score = (g: Game) => Math.floor(g.time * 10) + g.bonus;
const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
const key = (c: Cell, cols: number) => c.y * cols + c.x;
const inside = (g: Game, c: Cell) => c.x >= 0 && c.y >= 0 && c.x < g.cols && c.y < g.rows;
export const onSnake = (g: Game, c: Cell) => g.snake.body.some(b => same(b, c));

// La serpiente arranca en la esquina más lejos de la manzana, estirada.
function freshSnake(g: Pick<Game, 'cols' | 'rows' | 'apple'>): Snake {
  const left = g.apple.x >= g.cols / 2, top = g.apple.y >= g.rows / 2;
  const y = top ? 1 : g.rows - 2, x0 = left ? START_LEN : g.cols - 1 - START_LEN;
  const body = Array.from({ length: START_LEN }, (_, i) => ({ x: left ? x0 - i : x0 + i, y }));
  return { body, dir: left ? 'right' : 'left', stepIn: 1.2, grow: 0, freeze: 0, dizzy: 0 };
}

export function newGame(cols: number, rows: number, rand: () => number = Math.random): Game {
  const apple: Apple = { x: Math.floor(cols / 2), y: Math.floor(rows / 2), moveIn: 0, facing: 1, hop: 0 };
  const g: Game = { cols, rows, apple, snake: freshSnake({ cols, rows, apple }), seeds: [], powers: [], time: 0, bonus: 0, tangles: 0, nextGrow: GROW_EVERY, nextPower: 12, over: false, events: [] };
  for (let i = 0; i < SEEDS; i++) placeSeed(g, rand);
  return g;
}

function freeCell(g: Game, rand: () => number): Cell | null {
  for (let tries = 0; tries < 200; tries++) {
    const c = { x: Math.floor(rand() * g.cols), y: Math.floor(rand() * g.rows) };
    if (onSnake(g, c) || same(c, g.apple) || g.seeds.some(s => same(s, c)) || g.powers.some(p => same(p, c))) continue;
    // Nada pegado a la cabeza, así no aparece algo justo donde está por pasar.
    if (Math.abs(c.x - g.snake.body[0].x) + Math.abs(c.y - g.snake.body[0].y) < 3) continue;
    return c;
  }
  return null;
}
function placeSeed(g: Game, rand: () => number) { const c = freeCell(g, rand); if (c) g.seeds.push(c); }

// Camino más corto de la cabeza a la manzana (sin pasar por su cuerpo; la cola se corre, así que no cuenta).
export function chaseStep(g: Game): Dir | null {
  const { body } = g.snake, head = body[0];
  const blocked = new Set(body.slice(0, g.snake.grow > 0 ? body.length : body.length - 1).map(c => key(c, g.cols)));
  const target = key(g.apple, g.cols);
  const first = new Map<number, Dir>();
  const queue: Cell[] = [];
  for (const d of ORDER) {
    const n = { x: head.x + DIRS[d].x, y: head.y + DIRS[d].y };
    const k = key(n, g.cols);
    if (!inside(g, n) || blocked.has(k) || first.has(k)) continue;
    if (k === target) return d;
    first.set(k, d); queue.push(n);
  }
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i], d0 = first.get(key(c, g.cols))!;
    for (const d of ORDER) {
      const n = { x: c.x + DIRS[d].x, y: c.y + DIRS[d].y };
      const k = key(n, g.cols);
      if (!inside(g, n) || blocked.has(k) || first.has(k)) continue;
      if (k === target) return d0;
      first.set(k, d0); queue.push(n);
    }
  }
  return null;
}

// Si no llega a la manzana, va hacia donde tenga más lugar libre.
function roomiestStep(g: Game): Dir | null {
  const { body } = g.snake, head = body[0];
  const blocked = new Set(body.slice(0, body.length - 1).map(c => key(c, g.cols)));
  let best: Dir | null = null, bestRoom = -1;
  for (const d of ORDER) {
    const n = { x: head.x + DIRS[d].x, y: head.y + DIRS[d].y };
    if (!inside(g, n) || blocked.has(key(n, g.cols))) continue;
    const seen = new Set([key(n, g.cols)]), queue = [n];
    for (let i = 0; i < queue.length && seen.size < 400; i++) {
      for (const dd of ORDER) {
        const m = { x: queue[i].x + DIRS[dd].x, y: queue[i].y + DIRS[dd].y }, k = key(m, g.cols);
        if (inside(g, m) && !blocked.has(k) && !seen.has(k)) { seen.add(k); queue.push(m); }
      }
    }
    if (seen.size > bestRoom) { bestRoom = seen.size; best = d; }
  }
  return best;
}

function moveSnake(g: Game) {
  const s = g.snake;
  const dir = chaseStep(g) ?? roomiestStep(g);
  if (!dir) { // ¡se enredó! se marea y vuelve a empezar cortita, lejos de la manzana
    g.tangles++; g.bonus += TANGLE_POINTS;
    g.snake = freshSnake(g);
    g.snake.dizzy = 1.2;
    g.events.push({ type: 'tangled' });
    return;
  }
  const head = s.body[0], next = { x: head.x + DIRS[dir].x, y: head.y + DIRS[dir].y };
  s.dir = dir;
  s.body.unshift(next);
  if (s.grow > 0) s.grow--; else s.body.pop();
  g.seeds = g.seeds.filter(c => !same(c, next)); // se come las semillas que pisa
  if (same(next, g.apple)) { g.over = true; g.events.push({ type: 'caught' }); }
}

export function step(g: Game, input: Input, dt: number, rand: () => number = Math.random) {
  if (dt <= 0 || g.over) return;
  dt = Math.min(dt, 0.05);
  g.time += dt;
  const a = g.apple, s = g.snake;
  a.hop = Math.max(0, a.hop - dt);

  // La manzana: un casillero por vez mientras se mantiene una dirección. El cuerpo de la serpiente es pared.
  a.moveIn = Math.max(0, a.moveIn - dt);
  if (input.dir && a.moveIn === 0) {
    const n = { x: a.x + DIRS[input.dir].x, y: a.y + DIRS[input.dir].y };
    if (input.dir === 'left') a.facing = -1;
    if (input.dir === 'right') a.facing = 1;
    if (inside(g, n) && !s.body.slice(1).some(b => same(b, n))) {
      a.x = n.x; a.y = n.y; a.moveIn = APPLE_STEP; a.hop = APPLE_STEP;
      if (same(n, s.body[0])) { g.over = true; g.events.push({ type: 'caught' }); return; }
    }
  }

  // Lo que hay en el piso.
  const seed = g.seeds.findIndex(c => same(c, a));
  if (seed >= 0) { g.seeds.splice(seed, 1); g.bonus += SEED_POINTS; g.events.push({ type: 'seed' }); }
  while (g.seeds.length < SEEDS) { const before = g.seeds.length; placeSeed(g, rand); if (g.seeds.length === before) break; }
  for (const p of g.powers) p.life -= dt;
  const power = g.powers.find(p => same(p, a));
  if (power) {
    if (power.kind === 'scissors') s.body.splice(Math.max(START_LEN, Math.ceil(s.body.length / 2)));
    else s.freeze = 3.5;
    g.events.push({ type: 'power', kind: power.kind });
  }
  g.powers = g.powers.filter(p => p !== power && p.life > 0);
  g.nextPower -= dt;
  if (g.nextPower <= 0) {
    g.nextPower = 14 + rand() * 6;
    const c = freeCell(g, rand);
    if (c) g.powers.push({ ...c, kind: rand() < 0.5 ? 'scissors' : 'clock', life: POWER_LIFE });
  }

  // La serpiente crece cada tanto y se mueve cada vez más rápido.
  if (g.time >= g.nextGrow) { g.nextGrow += GROW_EVERY; s.grow += 1; g.events.push({ type: 'grow' }); }
  if (s.dizzy > 0) { s.dizzy -= dt; return; }
  if (s.freeze > 0) { s.freeze -= dt; return; }
  s.stepIn -= dt;
  while (s.stepIn <= 0 && !g.over && g.snake === s) {
    s.stepIn += snakeInterval(g.time);
    moveSnake(g);
  }
}

export const takeEvents = (g: Game) => g.events.splice(0);
