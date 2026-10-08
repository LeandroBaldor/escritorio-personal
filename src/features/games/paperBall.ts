// Lógica de "¡Al cesto!": básquet con bollos de papel en la oficina, solo con el mouse.
//
// - Hacés clic, tirás para atrás (como una gomera) y soltás: el bollo sale para el lado contrario, más
//   fuerte cuanto más tiraste.
// - El ventilador sopla para un lado y desvía los bollos. Cambia de lado y de fuerza cada vez que embocás.
// - El cesto cambia de lugar cada vez que embocás: en el piso, arriba de un mueble o en un estante. Con los
//   puntos se va más lejos y más alto, después se mueve (está en una silla con rueditas) y aparece el jefe
//   caminando por la oficina: si le pegás, perdés puntos.
// - Tenés 60 segundos; cada bollo embocado suma 2 segundos. Puntos: 1 por bollo, +1 si es de lejos, +1 si
//   entra limpio (sin tocar el borde) y +1 cada 3 seguidos.
//
// Todo se mide en unidades: la oficina mide 16 × 9 y el piso está en y = 0.

export const W = 16, H = 9, G = 14, BALL_R = 0.17;
export const ORIGIN = { x: 2.3, y: 3.2 }; // de donde sale el bollo (la mano)
export const PULL = 4.5, MAX_SPEED = 17; // velocidad por unidad que tirás para atrás, y el máximo
export const TIME = 60, BONUS_TIME = 2, FAR = 9;
export const RELOAD = 0.45; // lo que tarda en estar listo el próximo bollo
const RIM_R = 0.06, BOUNCE = 0.5, FLOOR_BOUNCE = 0.35;
const SUBSTEPS = 4;

export interface Bin { x: number; y: number; w: number; h: number; vx: number; min: number; max: number } // x: centro; y: la base
export interface Fan { dir: -1 | 1; power: number } // power de 0 (apagado) a 3
export interface Boss { x: number; dir: -1 | 1; speed: number; hit: number }
export interface Ball { id: number; x: number; y: number; vx: number; vy: number; state: 'fly' | 'in' | 'out'; t: number; touched: boolean; done: number }
export type PaperEvent =
  | { type: 'throw' } | { type: 'rim' } | { type: 'bounce' }
  | { type: 'score'; points: number; swish: boolean; far: boolean; streak: number; x: number; y: number } | { type: 'miss' }
  | { type: 'boss'; points: number } | { type: 'bossIn' } | { type: 'level'; level: number } | { type: 'gameover' };

export interface PaperGame {
  time: number; left: number; score: number; streak: number; bestStreak: number; made: number; shots: number;
  level: number; bin: Bin; fan: Fan; boss: Boss | null; balls: Ball[]; ready: number; over: boolean;
  events: PaperEvent[]; rand: () => number; nextId: number; nextBoss: number;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const levelFor = (score: number) => Math.min(8, Math.floor(score / 5));
// Los muebles donde puede estar el cesto (la altura de arriba): el piso, un mueble bajo y un estante.
export const STANDS = [0, 1.6, 3.4];

// El cesto en un lugar nuevo, según el nivel (y no muy cerca del lugar anterior).
function placeBin(g: PaperGame) {
  const lv = g.level, r = g.rand;
  const near = 6.5, far = Math.min(14.6, 10 + lv * 0.7);
  let x = near + r() * (far - near);
  if (Math.abs(x - g.bin.x) < 1.2) x = x > (near + far) / 2 ? x - 1.5 : x + 1.5;
  const stand = lv < 1 ? 0 : lv < 3 ? (r() < 0.5 ? 0 : 1) : Math.floor(r() * 3);
  const moving = lv >= 4 && stand === 0 && r() < 0.7;
  const w = lv >= 6 ? 1 : 1.15, h = 1.15;
  g.bin = { x, y: STANDS[stand], w, h, vx: moving ? (r() < 0.5 ? -1 : 1) * (0.8 + lv * 0.25) : 0, min: Math.max(6, x - 2), max: Math.min(15.2, x + 2) };
}
function changeFan(g: PaperGame) {
  const max = Math.min(3, 1 + Math.floor(g.level / 2));
  g.fan = { dir: g.rand() < 0.5 ? -1 : 1, power: g.level === 0 ? (g.rand() < 0.5 ? 0 : 1) : 1 + Math.floor(g.rand() * max) };
}
export const windOf = (f: Fan) => f.dir * f.power * 2.4; // aceleración de costado (unidades por segundo²)

export function newPaper(seed?: number): PaperGame {
  const g: PaperGame = {
    time: 0, left: TIME, score: 0, streak: 0, bestStreak: 0, made: 0, shots: 0, level: 0,
    bin: { x: 9, y: 0, w: 1.15, h: 1.15, vx: 0, min: 6, max: 14 }, fan: { dir: 1, power: 0 }, boss: null, balls: [], ready: 0,
    over: false, events: [], rand: rng(seed ?? Math.floor(Math.random() * 2 ** 31)), nextId: 1, nextBoss: 25,
  };
  placeBin(g); changeFan(g); g.fan.power = 0; // el primero, sin viento
  return g;
}

// La velocidad con que sale el bollo si tirás desde (sx, sy) hasta (x, y) (en unidades del juego).
export function launch(sx: number, sy: number, x: number, y: number) {
  let vx = (sx - x) * PULL, vy = (sy - y) * PULL;
  const sp = Math.hypot(vx, vy);
  if (sp > MAX_SPEED) { vx *= MAX_SPEED / sp; vy *= MAX_SPEED / sp; }
  return { vx, vy, power: Math.min(1, sp / MAX_SPEED) };
}
export const canThrow = (g: PaperGame) => !g.over && g.time >= g.ready;

export function throwBall(g: PaperGame, vx: number, vy: number) {
  if (!canThrow(g) || Math.hypot(vx, vy) < 2) return false;
  g.balls.push({ id: g.nextId++, x: ORIGIN.x, y: ORIGIN.y, vx, vy, state: 'fly', t: 0, touched: false, done: 0 });
  g.shots++; g.ready = g.time + RELOAD;
  g.events.push({ type: 'throw' });
  return true;
}

// Dónde va a estar el bollo (sin viento): para dibujar la puntería.
export function preview(vx: number, vy: number, steps = 12, dt = 0.045) {
  const pts: [number, number][] = [];
  for (let i = 1; i <= steps; i++) { const t = i * dt; pts.push([ORIGIN.x + vx * t, ORIGIN.y + vy * t - (G * t * t) / 2]); }
  return pts;
}

// Lo que hay para rebotar: el escritorio de uno, el mueble o el estante del cesto, el piso, paredes y techo.
export const DESK = { x1: 0, x2: 3.4, y: 2.2 };
export function standOf(b: Bin) { return b.y > 0 ? { x1: b.x - 1, x2: b.x + 1, y: b.y } : null; }
export const BOSS_W = 0.7, BOSS_H = 2.6;

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
  // Muebles: el escritorio, el mueble o estante del cesto, y el jefe.
  const surfaces = [DESK, standOf(b)].filter(Boolean) as { x1: number; x2: number; y: number }[];
  for (const s of surfaces) {
    if (k.x > s.x1 && k.x < s.x2 && prevY - BALL_R >= s.y - 0.01 && k.y - BALL_R < s.y && k.vy < 0) {
      k.y = s.y + BALL_R; k.vy = -k.vy * FLOOR_BOUNCE; k.vx *= 0.7; if (Math.abs(k.vy) > 1.5) g.events.push({ type: 'bounce' });
    }
  }
  if (g.boss && k.state === 'fly') {
    const p = g.boss;
    if (Math.abs(k.x - p.x) < BOSS_W / 2 + BALL_R && k.y < BOSS_H) {
      k.vx = -k.vx * 0.4 + p.dir * 1.5; k.vy = Math.max(2, Math.abs(k.vy) * 0.3); k.x = p.x + Math.sign(k.x - p.x || 1) * (BOSS_W / 2 + BALL_R);
      if (!k.touched || p.hit < g.time) { p.hit = g.time + 1.2; const lost = Math.min(2, g.score); g.score -= lost; g.streak = 0; g.events.push({ type: 'boss', points: lost }); }
      k.touched = true;
    }
  }
  // Piso, paredes y techo.
  if (k.y < BALL_R) { k.y = BALL_R; k.vy = -k.vy * FLOOR_BOUNCE; k.vx *= 0.6; if (k.state === 'fly' && Math.abs(k.vy) < 0.8) k.state = 'out'; }
  if (k.x < BALL_R) { k.x = BALL_R; k.vx = -k.vx * BOUNCE; }
  if (k.x > W - BALL_R) { k.x = W - BALL_R; k.vx = -k.vx * BOUNCE; }
  if (k.y > H - BALL_R) { k.y = H - BALL_R; k.vy = -k.vy * BOUNCE; }
}

function scored(g: PaperGame, k: Ball) {
  const far = g.bin.x - ORIGIN.x > FAR, swish = !k.touched;
  g.streak++; g.bestStreak = Math.max(g.bestStreak, g.streak); g.made++;
  const points = 1 + (far ? 1 : 0) + (swish ? 1 : 0) + Math.floor(g.streak / 3);
  g.score += points; g.left += BONUS_TIME;
  g.events.push({ type: 'score', points, swish, far, streak: g.streak, x: g.bin.x, y: g.bin.y + g.bin.h });
  const lv = levelFor(g.score);
  if (lv > g.level) { g.level = lv; g.events.push({ type: 'level', level: lv }); }
  placeBin(g); changeFan(g);
}

export function step(g: PaperGame, dt: number) {
  if (g.over || dt <= 0) return;
  dt = Math.min(dt, 0.05);
  g.time += dt; g.left -= dt;
  if (g.left <= 0) { g.left = 0; g.over = true; g.events.push({ type: 'gameover' }); return; }
  // El cesto en la silla con rueditas va y viene.
  const b = g.bin;
  if (b.vx) { b.x += b.vx * dt; if (b.x < b.min) { b.x = b.min; b.vx = Math.abs(b.vx); } else if (b.x > b.max) { b.x = b.max; b.vx = -Math.abs(b.vx); } }
  // El jefe cruza la oficina cada tanto (desde el nivel 3).
  if (!g.boss && g.level >= 3 && g.time >= g.nextBoss) {
    const dir = g.rand() < 0.5 ? -1 : 1;
    g.boss = { x: dir > 0 ? 4 : W + 0.5, dir, speed: 1.4 + g.rand() * 0.8, hit: 0 };
    g.events.push({ type: 'bossIn' });
  }
  if (g.boss) {
    g.boss.x += g.boss.dir * g.boss.speed * dt;
    if (g.boss.x > W + 1 || g.boss.x < 3.5) { g.boss = null; g.nextBoss = g.time + 8 + g.rand() * 10; }
  }
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
