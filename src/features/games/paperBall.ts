// Lógica de "¡Al cesto!": el T-800 sentado en su oficina de Skynet tira humanos en miniatura al tacho de
// basura, solo con el mouse.
//
// - Hacés clic, tirás para atrás (como una gomera) y soltás: el humano sale para el lado contrario, más
//   fuerte cuanto más tiraste.
// - Cada ronda son 9 tiros: el tacho aparece cerca, después a media distancia y después lejos. Después se
//   repite con el ventilador a la izquierda soplando para la derecha, y otra vez con el ventilador a la
//   derecha soplando para la izquierda. Para pasar al tiro siguiente hay que embocar.
// - El 1er tiro vale 1 punto, el 2° vale 2… y el 9° vale 9. Al terminar la ronda se suman puntos por la
//   velocidad (cuanto más rápido, más) y empieza otra ronda.
// - El partido son 4 cuartos de 2 minutos, como en el básquet, con un descanso entre cuarto y cuarto. En cada
//   cuarto el ventilador sopla más fuerte.
// - Si el humano cae afuera del tacho… sangre.
//
// Todo se mide en unidades (100 píxeles del dibujo de la oficina, que mide 1748 × 899): el piso de adelante,
// donde se apoya el tacho, está en y = 0 y el techo en y = TOP.

export const PX = 100, FLOOR_PX = 860;
export const W = 1748 / PX, TOP = FLOOR_PX / PX, BOTTOM = (FLOOR_PX - 899) / PX, G = 14, BALL_R = 0.2;
export const ORIGIN = { x: 5.1, y: 4.18 }; // de donde sale el humano (la mano del T-800 al tirar)
export const PULL = 5, MAX_SPEED = 17; // velocidad por unidad que tirás para atrás, y el máximo
export const QUARTERS = 4, QUARTER = 120, TIME = QUARTERS * QUARTER;
export const STEPS = 9; // tiros por ronda
export const RELOAD = 0.6; // lo que tarda en agarrar el próximo humano
export const BREAK = 3; // el descanso entre cuartos (el reloj no corre)
export const SPEED_PAR = 60; // la ronda suma 1 punto de velocidad por cada segundo que le sobre a esto
const RIM_R = 0.06, BOUNCE = 0.5, SUBSTEPS = 4;
export const SPOTS = [8.2, 11, 13.8]; // cerca, a media distancia y lejos
export const BIN_W = 1.3, BIN_H = 1.5, BIN_SPEED = 7;
export const FAN_X = { left: 6.7, right: 15.7 };
export const WIND = [1.6, 2.2, 2.8, 3.4]; // lo que empuja el ventilador en cada cuarto (unidades por segundo²)

export interface Bin { x: number; y: number; w: number; h: number; to: number; load: number } // x: centro; y: la base; to: adonde va
export interface Fan { dir: -1 | 0 | 1; power: number } // dir 1: está a la izquierda y sopla para la derecha
export interface Ball {
  id: number; x: number; y: number; vx: number; vy: number; spin: number; angle: number;
  state: 'fly' | 'in' | 'out'; t: number; touched: boolean; done: number; wall: boolean;
}
export type Surface = 'floor' | 'wall' | 'ceiling';
export type PaperEvent =
  | { type: 'throw' } | { type: 'rim' }
  | { type: 'score'; points: number; step: number; x: number; y: number }
  | { type: 'splat'; x: number; y: number; vx: number; vy: number; surface: Surface; hard: number }
  | { type: 'miss' }
  | { type: 'round'; bonus: number; seconds: number; round: number }
  | { type: 'fan'; dir: -1 | 1 }
  | { type: 'quarter'; quarter: number } | { type: 'gameover' };

export interface PaperGame {
  time: number; left: number; play: number; score: number; made: number; shots: number;
  step: number; round: number; roundStart: number; speedBonus: number;
  quarter: number; pause: number; bin: Bin; fan: Fan; balls: Ball[]; ready: number; over: boolean;
  events: PaperEvent[]; rand: () => number; nextId: number; thrown: number;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// El cuarto que se está jugando según el tiempo que queda (0 a 3) y lo que le queda.
export const quarterOf = (left: number) => Math.min(QUARTERS - 1, Math.floor((TIME - left) / QUARTER));
export const quarterLeft = (g: PaperGame) => Math.max(0, g.left - (QUARTERS - 1 - g.quarter) * QUARTER);
// Cuánto vale el tiro que toca (1 a 9).
export const stepValue = (step: number) => step + 1;
// Dónde va el tacho (0 cerca, 1 a media distancia, 2 lejos) y cómo está el ventilador en cada tiro.
export const spotOf = (step: number) => step % 3;
export const fanDirOf = (step: number): -1 | 0 | 1 => [0, 1, -1][Math.floor(step / 3)] as -1 | 0 | 1;
export const fanX = (f: Fan) => (f.dir > 0 ? FAN_X.left : FAN_X.right);

function spotX(g: PaperGame, step: number) { return SPOTS[spotOf(step)] + (g.rand() - 0.5) * 0.6; }
function setFan(g: PaperGame) {
  const dir = fanDirOf(g.step), was = g.fan.dir;
  g.fan = { dir, power: dir ? WIND[g.quarter] : 0 };
  if (dir && dir !== was) g.events.push({ type: 'fan', dir });
}
export const windOf = (f: Fan) => f.dir * f.power; // aceleración de costado

export function newPaper(seed?: number): PaperGame {
  const g: PaperGame = {
    time: 0, left: TIME, play: 0, score: 0, made: 0, shots: 0, step: 0, round: 0, roundStart: 0, speedBonus: 0,
    quarter: 0, pause: 0, bin: { x: SPOTS[0], y: 0, w: BIN_W, h: BIN_H, to: SPOTS[0], load: 0 }, fan: { dir: 0, power: 0 },
    balls: [], ready: 0, over: false, events: [], rand: rng(seed ?? Math.floor(Math.random() * 2 ** 31)), nextId: 1, thrown: -9,
  };
  g.bin.x = g.bin.to = spotX(g, 0);
  return g;
}

// La velocidad con que sale el humano si tirás desde (sx, sy) hasta (x, y) (en unidades del juego).
export function launch(sx: number, sy: number, x: number, y: number) {
  let vx = (sx - x) * PULL, vy = (sy - y) * PULL;
  const sp = Math.hypot(vx, vy);
  if (sp > MAX_SPEED) { vx *= MAX_SPEED / sp; vy *= MAX_SPEED / sp; }
  return { vx, vy, power: Math.min(1, sp / MAX_SPEED) };
}
export const canThrow = (g: PaperGame) => !g.over && g.pause <= 0 && g.time >= g.ready;

export function throwBall(g: PaperGame, vx: number, vy: number) {
  if (!canThrow(g) || Math.hypot(vx, vy) < 2) return false;
  g.balls.push({ id: g.nextId++, x: ORIGIN.x, y: ORIGIN.y, vx, vy, spin: (vx >= 0 ? 1 : -1) * (5 + Math.hypot(vx, vy) * 0.4), angle: 0, state: 'fly', t: 0, touched: false, done: 0, wall: false });
  g.shots++; g.ready = g.time + RELOAD; g.thrown = g.time;
  g.events.push({ type: 'throw' });
  return true;
}

// Dónde va a estar el humano (sin viento): para dibujar la puntería.
export function preview(vx: number, vy: number, steps = 12, dt = 0.045) {
  const pts: [number, number][] = [];
  for (let i = 1; i <= steps; i++) { const t = i * dt; pts.push([ORIGIN.x + vx * t, ORIGIN.y + vy * t - (G * t * t) / 2]); }
  return pts;
}

function splat(g: PaperGame, k: Ball, surface: Surface, x: number, y: number) {
  g.events.push({ type: 'splat', x, y, vx: k.vx, vy: k.vy, surface, hard: Math.min(1, Math.hypot(k.vx, k.vy) / 12) });
}
function missed(g: PaperGame, k: Ball) {
  if (k.state !== 'fly') return;
  k.state = 'out'; g.events.push({ type: 'miss' });
}

function collideBall(g: PaperGame, k: Ball, prevX: number, prevY: number) {
  const b = g.bin, half = b.w / 2, top = b.y + b.h;
  if (k.state !== 'out') {
    // Los bordes del tacho (dos puntitos redondos arriba).
    for (const rx of [b.x - half, b.x + half]) {
      const dx = k.x - rx, dy = k.y - top, d = Math.hypot(dx, dy);
      if (d < BALL_R + RIM_R && d > 0) {
        const nx = dx / d, ny = dy / d, dot = k.vx * nx + k.vy * ny;
        if (dot < 0) { k.vx -= (1 + BOUNCE) * dot * nx; k.vy -= (1 + BOUNCE) * dot * ny; k.touched = true; g.events.push({ type: 'rim' }); }
        k.x = rx + nx * (BALL_R + RIM_R); k.y = top + ny * (BALL_R + RIM_R);
      }
    }
    // Las paredes del tacho (de afuera y de adentro).
    if (k.y < top && k.y > b.y) {
      for (const wx of [b.x - half, b.x + half]) {
        if (Math.abs(k.x - wx) < BALL_R) {
          const from = prevX < wx ? -1 : 1;
          k.x = wx + from * BALL_R; k.vx = -k.vx * BOUNCE; k.touched = true;
        }
      }
    }
    // ¿Entró? Cruzó la boca del tacho bajando, entre los bordes.
    if (k.state === 'fly' && prevY >= top && k.y < top && k.vy < 0 && Math.abs(k.x - b.x) < half - RIM_R) k.state = 'in';
  }
  // El piso: si cae afuera del tacho, se hace puré.
  if (k.y < BALL_R) {
    k.y = BALL_R;
    if (k.state === 'in') { k.vy = 0; k.vx = 0; return; }
    if (!k.done) { splat(g, k, 'floor', k.x, 0); missed(g, k); k.done = g.time; }
    k.vx = 0; k.vy = 0; k.spin = 0;
  }
  // La pared del fondo a la derecha y la de la izquierda: queda la mancha y el humano se cae.
  const wallHit = (x: number, side: number) => {
    k.x = x; if (!k.wall) { k.wall = true; splat(g, k, 'wall', x + side * BALL_R, k.y); missed(g, k); }
    k.vx = -k.vx * 0.1; k.vy = Math.min(k.vy, 0) * 0.3; k.spin *= 0.3;
  };
  if (k.x < BALL_R) wallHit(BALL_R, -1);
  if (k.x > W - BALL_R) wallHit(W - BALL_R, 1);
  if (k.y > TOP - BALL_R) { k.y = TOP - BALL_R; if (k.vy > 6) splat(g, k, 'ceiling', k.x, TOP); k.vy = -k.vy * 0.2; }
}

function scored(g: PaperGame) {
  const step = g.step, points = stepValue(step);
  g.made++; g.score += points; g.bin.load++;
  g.events.push({ type: 'score', points, step, x: g.bin.x, y: g.bin.y + g.bin.h });
  if (step === STEPS - 1) {
    const seconds = g.play - g.roundStart, bonus = Math.max(0, Math.round(SPEED_PAR - seconds));
    g.score += bonus; g.speedBonus += bonus; g.round++; g.roundStart = g.play; g.step = 0;
    g.events.push({ type: 'round', bonus, seconds, round: g.round });
  } else g.step++;
  g.bin.to = spotX(g, g.step);
  setFan(g);
}

export function step(g: PaperGame, dt: number) {
  if (g.over || dt <= 0) return;
  dt = Math.min(dt, 0.05);
  g.time += dt;
  if (g.pause > 0) g.pause -= dt; // descanso entre cuartos: el reloj no corre
  else {
    g.left -= dt; g.play += dt;
    if (g.left <= 0) { g.left = 0; g.over = true; g.events.push({ type: 'gameover' }); return; }
    const q = quarterOf(g.left);
    if (q > g.quarter) {
      g.quarter = q; g.pause = BREAK; g.fan.power = g.fan.dir ? WIND[q] : 0;
      g.events.push({ type: 'quarter', quarter: q });
    }
  }
  // El tacho se va arrastrando hasta su lugar nuevo.
  const b = g.bin, d = b.to - b.x;
  if (d) b.x += Math.sign(d) * Math.min(Math.abs(d), BIN_SPEED * dt);
  const ax = windOf(g.fan), h = dt / SUBSTEPS;
  for (const k of g.balls) {
    k.t += dt;
    if (k.state === 'in') { k.x = b.x; } // va adentro del tacho
    if (k.done) continue;
    for (let i = 0; i < SUBSTEPS; i++) {
      const px = k.x, py = k.y;
      k.vy -= G * h; k.vx += ax * h * (k.state === 'fly' ? 1 : 0);
      k.x += k.vx * h; k.y += k.vy * h; k.angle += k.spin * h;
      collideBall(g, k, px, py);
      if (k.done) break;
    }
    if (k.state === 'in' && k.y < b.y + b.h - 0.35) { k.done = g.time; scored(g); }
    else if (k.state === 'fly' && k.t > 6) { k.done = g.time; missed(g, k); }
  }
  g.balls = g.balls.filter(k => !k.done || (k.state === 'out' ? g.time - k.done < 4 : g.time - k.done < 0.6));
}

export const takeEvents = (g: PaperGame) => g.events.splice(0);

// Para las pruebas (y para ayudar): con qué velocidad hay que tirar para embocar desde la mano, con el
// viento que haya, llegando a la boca del tacho en `t` segundos.
export function aimAt(g: PaperGame, t = 0.9) {
  const tx = g.bin.to, ty = g.bin.y + g.bin.h + 0.02, a = windOf(g.fan);
  return { vx: (tx - ORIGIN.x - (a * t * t) / 2) / t, vy: (ty - ORIGIN.y + (G * t * t) / 2) / t };
}
