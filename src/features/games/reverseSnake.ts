// Lógica de "¡Huye de la serpiente!": el viborita de siempre, pero vos sos la manzana. La serpiente te
// persigue por el jardín buscando el camino más corto y cada vez va más rápido. El piso está lleno de
// bolitas blancas: los puntos se ganan agarrándolas (si limpiás todo el jardín, se vuelve a llenar y
// ganás un premio). Cada tanto aparecen manzanas verdes: si la serpiente se come una, crece; por eso a
// veces deja de perseguirte para ir a buscarlas. Su propio cuerpo es una pared: si la hacés enredarse
// (que no tenga por dónde seguir), se marea, te da puntos extra y vuelve a empezar cortita.
// También aparecen tijeras (le cortan la cola) y relojes (la congelan).

export type Dir = 'up' | 'down' | 'left' | 'right';
export interface Cell { x: number; y: number }
export type PowerKind = 'scissors' | 'clock';
export interface Power extends Cell { kind: PowerKind; life: number }
export interface Snake { body: Cell[]; dir: Dir; stepIn: number; grow: number; freeze: number; dizzy: number }
export interface Apple extends Cell { moveIn: number; facing: 1 | -1; hop: number }
export type SnakeEvent =
  | { type: 'pellet' } | { type: 'cleared' } | { type: 'power'; kind: PowerKind } | { type: 'tangled' } | { type: 'ate' } | { type: 'caught' };
export interface Game {
  cols: number; rows: number; apple: Apple; snake: Snake; pellets: Set<number>; greens: Cell[]; powers: Power[];
  time: number; bonus: number; tangles: number; nextGreen: number; nextPower: number; over: boolean; events: SnakeEvent[];
}
export interface Input { dir: Dir | null }

export const APPLE_STEP = 0.12; // segundos por casillero de la manzana
export const PELLET_POINTS = 10, CLEAR_POINTS = 200, TANGLE_POINTS = 300;
export const GREEN_GROW = 2; // casilleros que crece por cada manzana verde
export const GREEN_EVERY = 4, MAX_GREENS = 3;
const START_LEN = 4, POWER_LIFE = 9;
export const DIRS: Record<Dir, Cell> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const ORDER: Dir[] = ['up', 'right', 'down', 'left'];

export const snakeInterval = (time: number) => Math.max(0.13, 0.34 - time * 0.0022);
export const level = (g: Game) => 1 + Math.floor(g.time / 20);
// Los puntos salen solo de lo que hace la manzana: bolitas, limpiar el jardín y enredar a la serpiente.
export const score = (g: Game) => g.bonus;
const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
export const cellKey = (c: Cell, cols: number) => c.y * cols + c.x;
const inside = (g: Game, c: Cell) => c.x >= 0 && c.y >= 0 && c.x < g.cols && c.y < g.rows;
export const onSnake = (g: Game, c: Cell) => g.snake.body.some(b => same(b, c));

// La serpiente arranca en la esquina más lejos de la manzana, estirada.
function freshSnake(g: Pick<Game, 'cols' | 'rows' | 'apple'>): Snake {
  const left = g.apple.x >= g.cols / 2, top = g.apple.y >= g.rows / 2;
  const y = top ? 1 : g.rows - 2, x0 = left ? START_LEN : g.cols - 1 - START_LEN;
  const body = Array.from({ length: START_LEN }, (_, i) => ({ x: left ? x0 - i : x0 + i, y }));
  return { body, dir: left ? 'right' : 'left', stepIn: 1.2, grow: 0, freeze: 0, dizzy: 0 };
}

// Bolitas blancas en todos los casilleros libres.
function fillPellets(g: Game) {
  g.pellets.clear();
  for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
    const c = { x, y };
    if (!same(c, g.apple) && !onSnake(g, c)) g.pellets.add(cellKey(c, g.cols));
  }
}

export function newGame(cols: number, rows: number): Game {
  const apple: Apple = { x: Math.floor(cols / 2), y: Math.floor(rows / 2), moveIn: 0, facing: 1, hop: 0 };
  const g: Game = {
    cols, rows, apple, snake: freshSnake({ cols, rows, apple }), pellets: new Set(), greens: [], powers: [],
    time: 0, bonus: 0, tangles: 0, nextGreen: 3, nextPower: 12, over: false, events: [],
  };
  fillPellets(g);
  return g;
}

function freeCell(g: Game, rand: () => number): Cell | null {
  for (let tries = 0; tries < 200; tries++) {
    const c = { x: Math.floor(rand() * g.cols), y: Math.floor(rand() * g.rows) };
    if (onSnake(g, c) || same(c, g.apple) || g.greens.some(s => same(s, c)) || g.powers.some(p => same(p, c))) continue;
    // Nada pegado a la cabeza ni a la manzana, así no aparece algo justo donde están por pasar.
    if (Math.abs(c.x - g.snake.body[0].x) + Math.abs(c.y - g.snake.body[0].y) < 3) continue;
    if (Math.abs(c.x - g.apple.x) + Math.abs(c.y - g.apple.y) < 2) continue;
    return c;
  }
  return null;
}

// Distancias desde la cabeza (sin pasar por su cuerpo; la cola se corre, así que no cuenta) y la
// primera dirección de cada camino.
function explore(g: Game) {
  const { body } = g.snake, head = body[0];
  const blocked = new Set(body.slice(0, g.snake.grow > 0 ? body.length : body.length - 1).map(c => cellKey(c, g.cols)));
  const info = new Map<number, { d: number; first: Dir }>();
  const queue: Cell[] = [];
  for (const d of ORDER) {
    const n = { x: head.x + DIRS[d].x, y: head.y + DIRS[d].y }, k = cellKey(n, g.cols);
    if (!inside(g, n) || blocked.has(k) || info.has(k)) continue;
    info.set(k, { d: 1, first: d }); queue.push(n);
  }
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i], ci = info.get(cellKey(c, g.cols))!;
    for (const d of ORDER) {
      const n = { x: c.x + DIRS[d].x, y: c.y + DIRS[d].y }, k = cellKey(n, g.cols);
      if (!inside(g, n) || blocked.has(k) || info.has(k)) continue;
      info.set(k, { d: ci.d + 1, first: ci.first }); queue.push(n);
    }
  }
  return info;
}

// Hacia dónde va: persigue a la manzana, salvo que tenga una manzana verde bastante más cerca.
export function chaseStep(g: Game): Dir | null {
  const info = explore(g);
  const toApple = info.get(cellKey(g.apple, g.cols));
  let best: { d: number; first: Dir } | undefined;
  for (const gr of g.greens) { const i = info.get(cellKey(gr, g.cols)); if (i && (!best || i.d < best.d)) best = i; }
  if (best && (!toApple || best.d * 1.6 < toApple.d)) return best.first;
  return toApple?.first ?? null;
}

// Si no llega a nada, va hacia donde tenga más lugar libre.
function roomiestStep(g: Game): Dir | null {
  const { body } = g.snake, head = body[0];
  const blocked = new Set(body.slice(0, body.length - 1).map(c => cellKey(c, g.cols)));
  let best: Dir | null = null, bestRoom = -1;
  for (const d of ORDER) {
    const n = { x: head.x + DIRS[d].x, y: head.y + DIRS[d].y };
    if (!inside(g, n) || blocked.has(cellKey(n, g.cols))) continue;
    const seen = new Set([cellKey(n, g.cols)]), queue = [n];
    for (let i = 0; i < queue.length && seen.size < 400; i++) {
      for (const dd of ORDER) {
        const m = { x: queue[i].x + DIRS[dd].x, y: queue[i].y + DIRS[dd].y }, k = cellKey(m, g.cols);
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
  const green = g.greens.findIndex(c => same(c, next));
  if (green >= 0) { g.greens.splice(green, 1); s.grow += GREEN_GROW; g.events.push({ type: 'ate' }); }
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

  // Bolitas blancas: puntos. Si no queda ninguna, se vuelve a llenar el jardín.
  const k = cellKey(a, g.cols);
  if (g.pellets.delete(k)) {
    g.bonus += PELLET_POINTS; g.events.push({ type: 'pellet' });
    if (g.pellets.size === 0) { g.bonus += CLEAR_POINTS; fillPellets(g); g.events.push({ type: 'cleared' }); }
  }
  for (const p of g.powers) p.life -= dt;
  const power = g.powers.find(p => same(p, a));
  if (power) {
    if (power.kind === 'scissors') { s.body.splice(Math.max(START_LEN, Math.ceil(s.body.length / 2))); s.grow = 0; }
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
  // Manzanas verdes: aparecen cada tanto; la serpiente crece si se come una.
  g.nextGreen -= dt;
  if (g.nextGreen <= 0) {
    g.nextGreen = GREEN_EVERY * (0.75 + rand() * 0.5);
    if (g.greens.length < MAX_GREENS) { const c = freeCell(g, rand); if (c) g.greens.push(c); }
  }

  // La serpiente se mueve cada vez más rápido.
  if (s.dizzy > 0) { s.dizzy -= dt; return; }
  if (s.freeze > 0) { s.freeze -= dt; return; }
  s.stepIn -= dt;
  while (s.stepIn <= 0 && !g.over && g.snake === s) {
    s.stepIn += snakeInterval(g.time);
    moveSnake(g);
  }
}

export const takeEvents = (g: Game) => g.events.splice(0);
