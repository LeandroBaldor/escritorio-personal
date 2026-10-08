// Lógica de "¡Al cesto!": básquet con bollos de papel en la oficina, solo con el mouse.
//
// - Hacés clic, tirás para atrás (como una gomera) y soltás: el bollo sale para el lado contrario, más
//   fuerte cuanto más tiraste.
// - El partido dura 3 minutos, en 4 cuartos de 45 segundos como en el básquet. En cada cuarto el cesto se
//   va más lejos; en el último, además, se mueve (está en rueditas).
// - El ventilador sopla para un lado y desvía los bollos: a veces está a la izquierda (sopla para la derecha)
//   y a veces a la derecha (sopla para la izquierda). Cambia de lado y de fuerza cada vez que embocás, y
//   sopla más fuerte en cada cuarto.
// - Puntos: 1 por bollo, +1 si es de lejos, +1 si entra limpio (sin tocar el borde) y +1 cada 3 seguidos.
//
// Todo se mide en unidades (85 píxeles del dibujo de la oficina): la oficina mide 16 de ancho, la pared
// llega al piso en y = 0 y el techo está en y = TOP. El cesto está en primer plano, más cerca: apoyado en
// el piso de adelante (y = FLOOR).

export const W = 16, TOP = 650 / 85, BOTTOM = TOP - 762 / 85, FLOOR = -0.8, G = 14, BALL_R = 0.17;
export const ORIGIN = { x: 4.15, y: 3.85 }; // de donde sale el bollo (la mano levantada)
export const PULL = 4.5, MAX_SPEED = 17; // velocidad por unidad que tirás para atrás, y el máximo
export const TIME = 180, QUARTERS = 4, QUARTER = TIME / QUARTERS, FAR = 8;
export const RELOAD = 0.45; // lo que tarda en estar listo el próximo bollo
export const BREAK = 2.5; // el descanso entre cuartos (el reloj no corre y el cesto se va más lejos)
const RIM_R = 0.06, BOUNCE = 0.5, FLOOR_BOUNCE = 0.35;
const SUBSTEPS = 4;
// Entre qué x puede estar el cesto en cada cuarto (cada vez más lejos).
export const SPOTS: [number, number][] = [[8.7, 10], [10, 11.4], [11.4, 12.8], [12.9, 14.4]];
export const BIN_SCALE = 1.3, BIN_W = 1.12 * BIN_SCALE, BIN_H = 1.35 * BIN_SCALE;

export interface Bin { x: number; y: number; w: number; h: number; vx: number; min: number; max: number } // x: centro; y: la base
export interface Fan { dir: -1 | 1; power: number } // power de 0 (apagado) a 3
export interface Ball { id: number; x: number; y: number; vx: number; vy: number; state: 'fly' | 'in' | 'out'; t: number; touched: boolean; done: number }
export type PaperEvent =
  | { type: 'throw' } | { type: 'rim' } | { type: 'bounce' }
  | { type: 'score'; points: number; swish: boolean; far: boolean; streak: number; x: number; y: number } | { type: 'miss' }
  | { type: 'quarter'; quarter: number } | { type: 'gameover' };

export interface PaperGame {
  time: number; left: number; score: number; streak: number; bestStreak: number; made: number; shots: number;
  quarter: number; pause: number; bin: Bin; nextBin: Bin | null; fan: Fan; balls: Ball[]; ready: number; over: boolean;
  events: PaperEvent[]; rand: () => number; nextId: number; thrown: number;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// El cuarto que se está jugando según el tiempo que queda (0 a 3).
export const quarterOf = (left: number) => Math.min(QUARTERS - 1, Math.floor((TIME - left) / QUARTER));
// Lo que le queda al cuarto.
export const quarterLeft = (g: PaperGame) => Math.max(0, g.left - (QUARTERS - 1 - g.quarter) * QUARTER);

// El cesto en un lugar nuevo dentro de la zona del cuarto (y no muy cerca del lugar anterior).
function spotFor(g: PaperGame, quarter: number, from: number): Bin {
  const [near, far] = SPOTS[quarter], r = g.rand;
  let x = near + r() * (far - near);
  if (Math.abs(x - from) < 0.5) x = x > (near + far) / 2 ? Math.max(near, x - 0.8) : Math.min(far, x + 0.8);
  const moving = quarter === QUARTERS - 1;
  return { x, y: FLOOR, w: BIN_W, h: BIN_H, vx: moving ? (r() < 0.5 ? -1 : 1) * (0.7 + r() * 0.5) : 0, min: near - 0.3, max: Math.min(14.7, far + 0.3) };
}
function changeFan(g: PaperGame) {
  const max = g.quarter + 1; // 1° cuarto: hasta 1; 4° cuarto: hasta 3 (y nunca apagado)
  const power = g.quarter === 0 ? (g.rand() < 0.5 ? 0 : 1) : Math.min(3, 1 + Math.floor(g.rand() * Math.min(3, max)));
  g.fan = { dir: g.rand() < 0.5 ? -1 : 1, power };
}
export const windOf = (f: Fan) => f.dir * f.power * 2.4; // aceleración de costado (unidades por segundo²)

export function newPaper(seed?: number): PaperGame {
  const g: PaperGame = {
    time: 0, left: TIME, score: 0, streak: 0, bestStreak: 0, made: 0, shots: 0, quarter: 0, pause: 0,
    bin: { x: 9, y: FLOOR, w: BIN_W, h: BIN_H, vx: 0, min: 8, max: 10 }, nextBin: null, fan: { dir: 1, power: 0 }, balls: [], ready: 0,
    over: false, events: [], rand: rng(seed ?? Math.floor(Math.random() * 2 ** 31)), nextId: 1, thrown: -9,
  };
  g.bin = spotFor(g, 0, 0); g.fan.power = 0; // el primero, sin viento
  return g;
}

// La velocidad con que sale el bollo si tirás desde (sx, sy) hasta (x, y) (en unidades del juego).
export function launch(sx: number, sy: number, x: number, y: number) {
  let vx = (sx - x) * PULL, vy = (sy - y) * PULL;
  const sp = Math.hypot(vx, vy);
  if (sp > MAX_SPEED) { vx *= MAX_SPEED / sp; vy *= MAX_SPEED / sp; }
  return { vx, vy, power: Math.min(1, sp / MAX_SPEED) };
}
export const canThrow = (g: PaperGame) => !g.over && g.pause <= 0 && g.time >= g.ready;

export function throwBall(g: PaperGame, vx: number, vy: number) {
  if (!canThrow(g) || Math.hypot(vx, vy) < 2) return false;
  g.balls.push({ id: g.nextId++, x: ORIGIN.x, y: ORIGIN.y, vx, vy, state: 'fly', t: 0, touched: false, done: 0 });
  g.shots++; g.ready = g.time + RELOAD; g.thrown = g.time;
  g.events.push({ type: 'throw' });
  return true;
}

// Dónde va a estar el bollo (sin viento): para dibujar la puntería.
export function preview(vx: number, vy: number, steps = 12, dt = 0.045) {
  const pts: [number, number][] = [];
  for (let i = 1; i <= steps; i++) { const t = i * dt; pts.push([ORIGIN.x + vx * t, ORIGIN.y + vy * t - (G * t * t) / 2]); }
  return pts;
}

// Lo que hay para rebotar: el escritorio, el piso de adelante, paredes y techo.
export const DESK = { x1: 0.45, x2: 8, y: 1.88 };

function collideBall(g: PaperGame, k: Ball, prevX: number, prevY: number) {
  const b = g.bin, half = b.w / 2, top = b.y + b.h;
  // Los bordes del cesto (dos puntitos redondos arriba).
  for (const rx of [b.x - half, b.x + half]) {
    const dx = k.x - rx, dy = k.y - top, d = Math.hypot(dx, dy);
    if (d < BALL_R + RIM_R && d > 0) {
      const nx = dx / d, ny = dy / d, dot = k.vx * nx + k.vy * ny;
      if (dot < 0) { k.vx -= (1 + BOUNCE) * dot * nx; k.vy -= (1 + BOUNCE) * dot * ny; k.touched = true; g.events.push({ type: 'rim' }); }
      k.x = rx + nx * (BALL_R + RIM_R); k.y = top + ny * (BALL_R + RIM_R);
    }
  }
  // Las paredes del cesto (de afuera y de adentro).
  if (k.y < top && k.y > b.y) {
    for (const wx of [b.x - half, b.x + half]) {
      if (Math.abs(k.x - wx) < BALL_R) {
        const from = prevX < wx ? -1 : 1;
        k.x = wx + from * BALL_R; k.vx = -k.vx * BOUNCE; k.touched = true;
      }
    }
  }
  // ¿Entró? Cruzó la boca del cesto bajando, entre los bordes.
  if (k.state === 'fly' && prevY >= top && k.y < top && k.vy < 0 && Math.abs(k.x - b.x) < half - RIM_R) k.state = 'in';
  // El escritorio.
  if (k.x > DESK.x1 && k.x < DESK.x2 && prevY - BALL_R >= DESK.y - 0.01 && k.y - BALL_R < DESK.y && k.vy < 0) {
    k.y = DESK.y + BALL_R; k.vy = -k.vy * FLOOR_BOUNCE; k.vx *= 0.7; if (Math.abs(k.vy) > 1.5) g.events.push({ type: 'bounce' });
    if (k.state === 'fly' && Math.abs(k.vy) < 0.8) k.state = 'out'; // se quedó en el escritorio
  }
  // Piso, paredes y techo.
  if (k.y < FLOOR + BALL_R) { k.y = FLOOR + BALL_R; k.vy = -k.vy * FLOOR_BOUNCE; k.vx *= 0.6; if (k.state === 'fly' && Math.abs(k.vy) < 0.8) k.state = 'out'; }
  if (k.x < BALL_R) { k.x = BALL_R; k.vx = -k.vx * BOUNCE; }
  if (k.x > W - BALL_R) { k.x = W - BALL_R; k.vx = -k.vx * BOUNCE; }
  if (k.y > TOP - BALL_R) { k.y = TOP - BALL_R; k.vy = -k.vy * BOUNCE; }
}

function scored(g: PaperGame, k: Ball) {
  const far = g.bin.x - ORIGIN.x > FAR, swish = !k.touched;
  g.streak++; g.bestStreak = Math.max(g.bestStreak, g.streak); g.made++;
  const points = 1 + (far ? 1 : 0) + (swish ? 1 : 0) + Math.floor(g.streak / 3);
  g.score += points;
  g.events.push({ type: 'score', points, swish, far, streak: g.streak, x: g.bin.x, y: g.bin.y + g.bin.h });
  if (!g.nextBin) g.bin = spotFor(g, g.quarter, g.bin.x);
  changeFan(g);
}

export function step(g: PaperGame, dt: number) {
  if (g.over || dt <= 0) return;
  dt = Math.min(dt, 0.05);
  g.time += dt;
  if (g.pause > 0) {
    // Descanso entre cuartos: el reloj no corre y el cesto se va arrastrando hasta su lugar nuevo.
    g.pause -= dt;
    const n = g.nextBin;
    if (n) {
      const d = n.x - g.bin.x;
      g.bin.x += Math.sign(d) * Math.min(Math.abs(d), 3 * dt);
      if (g.pause <= 0) { g.bin = n; g.nextBin = null; }
    }
  } else {
    g.left -= dt;
    if (g.left <= 0) { g.left = 0; g.over = true; g.events.push({ type: 'gameover' }); return; }
    const q = quarterOf(g.left);
    if (q > g.quarter) {
      g.quarter = q; g.pause = BREAK; g.streak = 0;
      g.nextBin = spotFor(g, q, g.bin.x); g.bin.vx = 0;
      changeFan(g);
      g.events.push({ type: 'quarter', quarter: q });
    }
  }
  // En el último cuarto el cesto va y viene en rueditas.
  const b = g.bin;
  if (b.vx) { b.x += b.vx * dt; if (b.x < b.min) { b.x = b.min; b.vx = Math.abs(b.vx); } else if (b.x > b.max) { b.x = b.max; b.vx = -Math.abs(b.vx); } }
  const ax = windOf(g.fan), h = dt / SUBSTEPS;
  for (const k of g.balls) {
    k.t += dt;
    if (k.done) continue;
    for (let i = 0; i < SUBSTEPS; i++) {
      const px = k.x, py = k.y;
      k.vy -= G * h; k.vx += ax * h * (k.state === 'fly' ? 1 : 0);
      k.x += k.vx * h; k.y += k.vy * h;
      collideBall(g, k, px, py);
    }
    if (k.state === 'in' && k.y < g.bin.y + g.bin.h - 0.35) { k.done = g.time; scored(g, k); }
    else if (k.state === 'out' || (k.state === 'fly' && k.t > 6)) { k.done = g.time; g.streak = 0; g.events.push({ type: 'miss' }); }
  }
  g.balls = g.balls.filter(k => !k.done || g.time - k.done < 2.5);
}

export const takeEvents = (g: PaperGame) => g.events.splice(0);

// Para las pruebas (y para ayudar): con qué velocidad hay que tirar para embocar desde la mano, sin viento,
// llegando a la boca del cesto en `t` segundos.
export function aimAt(g: PaperGame, t = 0.9) {
  const tx = g.bin.x, ty = g.bin.y + g.bin.h + 0.02, a = windOf(g.fan);
  return { vx: (tx - ORIGIN.x - (a * t * t) / 2) / t, vy: (ty - ORIGIN.y + (G * t * t) / 2) / t };
}
