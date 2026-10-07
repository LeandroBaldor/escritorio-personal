// Lógica de "¡Se viene el tsunami!": una ola gigante avanza desde el mar (a la izquierda) y hay que correr
// hacia la derecha por la costa hasta el cerro del final, antes de que la ola te alcance.
//
// - Se arranca en la playa, entre sombrillas (te frenan si las atravesás corriendo) y castillos de arena.
// - Después viene el pueblo: autos, camionetas, quioscos, paredes, bancos, tachos y pilas de cajones que hay
//   que saltar (o subirse arriba), canales que se cruzan por puentes o saltando (si te caés, nadás despacio
//   hasta el otro borde), charcos que resbalan y perros que te persiguen (si te alcanzan te frenan).
// - Ayudas: si agarrás una moto o una tabla de surf vas mucho más rápido unos segundos (con la tabla, además,
//   los canales no te frenan).
// - La ola espera unos segundos y después avanza cada vez más rápido. Ganás al subir al cerro.
//
// Todo se mide en "unidades" (el personaje mide casi una) y en pantalla se muestran metros.

export const M_PER_UNIT = 2;
export const PLAYER_W = 0.6, PLAYER_H = 0.85;
export const RUN = 6.2, SWIM = 2.4, MOTO_SPEED = 10, TABLA_SPEED = 8.5;
export const GRAVITY = 30, JUMP = 12.5, SWIM_JUMP = 10.5;
export const REACH = (JUMP * JUMP) / (2 * GRAVITY); // lo más alto que se llega saltando (unas 2,6 unidades)
const MAX_FALL = 18, STEP_UP = 0.45;
export const WATER_Y = -0.55; // superficie del agua de los canales
const SWIM_Y = WATER_Y - 0.5; // altura de los pies al nadar (la cabeza queda afuera)
export const RIDE_T = 6; // segundos que dura la moto o la tabla
const DOG_SPEED = 5.2, DOG_SEE = 7, DOG_HIT_T = 0.9;
const DIE_T = 1.6;

// La ola: espera unos segundos y después avanza cada vez más rápido (hasta un máximo).
export const WAVE_DELAY = 3, WAVE_X0 = -24;
const WAVE_V0 = 5.2, WAVE_ACC = 0.05, WAVE_VMAX = 8;
export const waveSpeed = (t: number) => t < WAVE_DELAY ? 0 : Math.min(WAVE_VMAX, WAVE_V0 + WAVE_ACC * (t - WAVE_DELAY));
export function waveX(t: number) {
  const u = Math.max(0, t - WAVE_DELAY), tc = (WAVE_VMAX - WAVE_V0) / WAVE_ACC;
  if (u < tc) return WAVE_X0 + WAVE_V0 * u + (WAVE_ACC / 2) * u * u;
  return WAVE_X0 + WAVE_V0 * tc + (WAVE_ACC / 2) * tc * tc + WAVE_VMAX * (u - tc);
}
export const meters = (x: number) => Math.max(0, Math.round(x * M_PER_UNIT));

export type BoxKind = 'car' | 'van' | 'bus' | 'kiosk' | 'wall' | 'bench' | 'bins' | 'crate' | 'castle' | 'boat' | 'step';
export interface Box { id: number; kind: BoxKind; x: number; y: number; w: number; h: number; hue: number }
export interface Ground { x1: number; x2: number } // tramos de piso (y = 0); entre uno y otro hay un canal
export interface Bridge { id: number; x1: number; x2: number }
export interface Zone { id: number; kind: 'umbrella' | 'puddle'; x1: number; x2: number; hue: number }
export interface Dog { id: number; x: number; home1: number; home2: number; dir: 1 | -1; hue: number; bark: number; rest: number }
export interface Pickup { id: number; kind: 'moto' | 'tabla'; x: number; y: number; taken: boolean }
export interface Npc { id: number; x: number; speed: number; hue: number; look: number; sweptAt: number | null }
export interface Decor { id: number; kind: 'house' | 'palm' | 'lamp' | 'sign'; x: number; w: number; h: number; hue: number }
export interface Player { x: number; y: number; vx: number; vy: number; facing: 1 | -1; ground: boolean; swimming: boolean; ride: 'moto' | 'tabla' | null; rideLeft: number; hit: number }
export interface Input { left: boolean; right: boolean; jump: boolean }
export type LoseReason = 'ola';
export type TsuEvent =
  | { type: 'jump' } | { type: 'splash' } | { type: 'dog' } | { type: 'ride'; kind: 'moto' | 'tabla' } | { type: 'rideEnd' }
  | { type: 'faster'; level: number } | { type: 'hill' } | { type: 'lose'; reason: LoseReason } | { type: 'gameover' } | { type: 'win' };
export interface Coast {
  length: number; beachEnd: number; hillX: number; hillTop: number; goalX: number; width: number;
  grounds: Ground[]; bridges: Bridge[]; boxes: Box[]; zones: Zone[]; dogs: Dog[]; pickups: Pickup[]; npcs: Npc[]; decor: Decor[];
}
export interface TsunamiGame extends Coast {
  player: Player; time: number; wave: number; best: number; won: boolean; speedLevel: number; nearHill: boolean;
  dying: { t: number; reason: LoseReason } | null; over: boolean; events: TsuEvent[];
}

const LENGTH = 430; // dónde empieza el cerro
const BEACH = 42;
export const START_X = 6;

// ---------- La costa ----------
export function buildCoast(seed = 20261007): Coast {
  let s = seed;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const between = (a: number, b: number) => a + rand() * (b - a);
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
  let id = 1;
  const coast: Coast = { length: LENGTH, beachEnd: BEACH, hillX: LENGTH, hillTop: 0, goalX: 0, width: 0, grounds: [], bridges: [], boxes: [], zones: [], dogs: [], pickups: [], npcs: [], decor: [] };
  const { grounds, bridges, boxes, zones, dogs, pickups, npcs, decor } = coast;
  const box = (kind: BoxKind, x: number, w: number, h: number, y = 0) => { const b: Box = { id: id++, kind, x, y, w, h, hue: Math.floor(rand() * 360) }; boxes.push(b); return b; };

  // 1) Playa: sombrillas (frenan), castillos de arena y algún bote.
  for (let x = 9; x < BEACH - 4; x += between(4.5, 7)) {
    const r = rand();
    if (r < 0.5) zones.push({ id: id++, kind: 'umbrella', x1: x - 0.8, x2: x + 0.8, hue: Math.floor(rand() * 360) });
    else if (r < 0.8) box('castle', x, between(0.8, 1.2), between(0.45, 0.7));
    else box('boat', x, 3.2, 1.0);
  }

  // 2) Pueblo: obstáculos cada pocos metros, canales con o sin puente, charcos, perros y ayudas.
  let ground = 0, x = BEACH + 2, lastPickup = BEACH;
  const canals: [number, number][] = [];
  while (x < LENGTH - 10) {
    const r = rand();
    if (r < 0.14 && x - (canals.at(-1)?.[1] ?? 0) > 18) { // canal
      const w = between(2.2, 3.4);
      canals.push([x, x + w]);
      grounds.push({ x1: ground, x2: x });
      ground = x + w;
      if (rand() < 0.45) bridges.push({ id: id++, x1: x - 0.2, x2: x + w + 0.2 });
      x += w + between(2.5, 4);
      continue;
    }
    if (r < 0.62) { // un obstáculo
      const kind = pick<BoxKind>(['car', 'car', 'van', 'kiosk', 'wall', 'bench', 'bins', 'crate', 'crate', 'bus']);
      const [w, h] = kind === 'car' ? [3.4, 1.15] : kind === 'van' ? [3.8, 1.7] : kind === 'bus' ? [6, 2.1] : kind === 'kiosk' ? [2.2, 2.1]
        : kind === 'wall' ? [0.5, 0.9] : kind === 'bench' ? [1.6, 0.6] : kind === 'bins' ? [0.8, 0.95] : [1.1, 1.1];
      box(kind, x, w, h);
      if (kind === 'crate' && rand() < 0.6) box('crate', x + 0.1, 0.9, 0.9, h); // pila de cajones
      x += w + between(3, 6.5);
      continue;
    }
    if (r < 0.74) { zones.push({ id: id++, kind: 'puddle', x1: x, x2: x + between(2, 3.5), hue: 0 }); x += between(4, 6); continue; }
    if (r < 0.84) { const span = between(6, 10); dogs.push({ id: id++, x: x + span / 2, home1: x, home2: x + span, dir: 1, hue: Math.floor(rand() * 40), bark: 0, rest: 0 }); x += span + 2; continue; }
    if (x - lastPickup > 70) { // moto o tabla de surf
      pickups.push({ id: id++, kind: rand() < 0.5 ? 'moto' : 'tabla', x, y: 0, taken: false });
      lastPickup = x; x += 4; continue;
    }
    x += between(2, 4);
  }
  grounds.push({ x1: ground, x2: LENGTH + 40 });

  // 3) El cerro: un camino de escalones que se suben caminando, con una explanada arriba (la zona segura).
  const steps = 12, run = 0.9, rise = 0.38;
  for (let i = 0; i < steps; i++) box('step', LENGTH + i * run, LENGTH + 40 - (LENGTH + i * run), (i + 1) * rise);
  coast.hillTop = steps * rise;
  coast.goalX = LENGTH + steps * run + 1;
  coast.width = LENGTH + 40;

  // 4) Gente que también escapa (la ola la arrastra si la alcanza).
  for (let i = 0; i < 9; i++) npcs.push({ id: id++, x: between(14, LENGTH - 30), speed: between(2.4, 4.8), hue: Math.floor(rand() * 360), look: rand(), sweptAt: null });

  // 5) Adornos de fondo: casas, palmeras, faroles y carteles.
  for (let dx = BEACH - 6; dx < LENGTH; dx += between(5, 9)) decor.push({ id: id++, kind: 'house', x: dx, w: between(4, 7), h: between(4, 9), hue: Math.floor(rand() * 360) });
  for (let dx = 2; dx < LENGTH; dx += between(7, 14)) decor.push({ id: id++, kind: rand() < 0.6 ? 'palm' : 'lamp', x: dx, w: 1, h: between(4, 5.5), hue: 0 });
  decor.push({ id: id++, kind: 'sign', x: LENGTH - 6, w: 2.4, h: 2.4, hue: 0 });
  return coast;
}

export function newTsunami(seed?: number): TsunamiGame {
  const coast = buildCoast(seed);
  return {
    ...coast, time: 0, wave: WAVE_X0, best: START_X, won: false, speedLevel: 0, nearHill: false, dying: null, over: false, events: [],
    player: { x: START_X, y: 0, vx: 0, vy: 0, facing: 1, ground: true, swimming: false, ride: null, rideLeft: 0, hit: 0 },
  };
}

// Hay agua donde no hay piso (los puentes pasan por arriba del agua).
export const inCanal = (g: Coast, x: number) => !g.grounds.some(gr => x >= gr.x1 && x <= gr.x2);
const boxTop = (b: Box) => b.y + b.h;
const overlapX = (p: Player, x1: number, x2: number) => p.x + PLAYER_W / 2 > x1 && p.x - PLAYER_W / 2 < x2;
// Altura del piso que hay debajo de los pies (la de arriba de todo lo que está debajo).
function supportBelow(g: TsunamiGame, p: Player, fromY: number) {
  let best = -Infinity;
  const feet = (x1: number, x2: number) => overlapX(p, x1, x2);
  if (g.grounds.some(gr => feet(gr.x1, gr.x2)) && fromY >= -0.02) best = 0;
  for (const b of g.bridges) if (feet(b.x1, b.x2) && fromY >= -0.02) best = Math.max(best, 0);
  for (const b of g.boxes) if (feet(b.x, b.x + b.w) && fromY >= boxTop(b) - 0.02) best = Math.max(best, boxTop(b));
  return best;
}

function lose(g: TsunamiGame, reason: LoseReason) {
  g.dying = { t: 0, reason };
  g.player.vx = 0; g.player.ride = null;
  g.events.push({ type: 'lose', reason });
}

export function step(g: TsunamiGame, input: Input, dt: number) {
  if (dt <= 0 || g.won || g.over) return;
  dt = Math.min(dt, 0.05);
  g.time += dt;
  const t = g.time, p = g.player;
  g.wave = waveX(t);
  const level = Math.floor(waveSpeed(t) / 1.2);
  if (level > g.speedLevel) { g.speedLevel = level; if (level >= 5) g.events.push({ type: 'faster', level }); }

  // La gente corre y la ola la arrastra.
  for (const n of g.npcs) {
    if (n.sweptAt === null) { n.x += n.speed * dt; if (g.wave >= n.x) n.sweptAt = t; }
    else n.x = g.wave - 1 - (t - n.sweptAt) * 0.6;
  }

  if (g.dying) {
    g.dying.t += dt;
    p.x = Math.max(p.x, g.wave - 0.5); p.y += dt * 2.5; // la ola lo levanta y lo arrastra
    if (g.dying.t > DIE_T) { g.over = true; g.events.push({ type: 'gameover' }); }
    return;
  }

  // Perros: si te ven te persiguen; si te alcanzan te frenan un rato (y se quedan ladrando, sin perseguirte).
  // Se los puede saltar por arriba.
  for (const d of g.dogs) {
    d.rest = Math.max(0, d.rest - dt);
    const sees = !d.rest && Math.abs(p.x - d.x) < DOG_SEE && p.y < 1.2 && !inCanal(g, p.x);
    if (sees) { d.dir = p.x > d.x ? 1 : -1; d.x += d.dir * DOG_SPEED * dt; d.bark = t; }
    else {
      d.x += d.dir * 2 * dt;
      if (d.x > d.home2) d.dir = -1; else if (d.x < d.home1) d.dir = 1;
    }
    if (inCanal(g, d.x)) d.x -= d.dir * DOG_SPEED * dt; // no se tiran al agua
    if (!p.hit && !d.rest && Math.abs(p.x - d.x) < 0.7 && p.y < 0.5 && p.ride !== 'moto') { p.hit = DOG_HIT_T; p.vx = -3; d.rest = 3.5; d.bark = t; g.events.push({ type: 'dog' }); }
  }
  p.hit = Math.max(0, p.hit - dt);

  // Moto o tabla de surf.
  for (const k of g.pickups) {
    if (k.taken || Math.abs(p.x - k.x) > 0.8 || p.y > 1.6) continue;
    k.taken = true; p.ride = k.kind; p.rideLeft = RIDE_T; g.events.push({ type: 'ride', kind: k.kind });
  }
  if (p.ride) { p.rideLeft -= dt; if (p.rideLeft <= 0) { p.ride = null; p.rideLeft = 0; g.events.push({ type: 'rideEnd' }); } }

  // Velocidad: corriendo, nadando, en moto o tabla; las sombrillas frenan y los charcos resbalan.
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir) p.facing = dir > 0 ? 1 : -1;
  const surfing = p.ride === 'tabla' && p.swimming;
  let top = p.swimming && !surfing ? SWIM : p.ride === 'moto' ? MOTO_SPEED : p.ride === 'tabla' ? TABLA_SPEED : RUN;
  if (p.ground && !p.ride && g.zones.some(z => z.kind === 'umbrella' && overlapX(p, z.x1, z.x2))) top *= 0.5;
  if (p.hit) top *= 0.45;
  const slippery = p.ground && g.zones.some(z => z.kind === 'puddle' && overlapX(p, z.x1, z.x2));
  const accel = slippery ? 5 : p.ground || p.swimming ? 45 : 22;
  const target = dir * top;
  p.vx += Math.max(-accel * dt, Math.min(accel * dt, target - p.vx));

  // Movimiento de costado: los obstáculos no se atraviesan (los escalones bajitos se suben caminando).
  let nx = p.x + p.vx * dt;
  const y1 = p.y + 0.02, y2 = p.y + PLAYER_H;
  const solids: { x1: number; x2: number; top: number; bottom: number }[] = [
    ...g.boxes.map(b => ({ x1: b.x, x2: b.x + b.w, top: boxTop(b), bottom: b.y })),
    ...g.grounds.map(gr => ({ x1: gr.x1, x2: gr.x2, top: 0, bottom: -6 })), // paredes de los canales
  ];
  for (const sld of solids) {
    if (sld.top <= y1 || sld.bottom >= y2) continue;
    if (p.ground && sld.top - p.y <= STEP_UP && nx + PLAYER_W / 2 > sld.x1 && nx - PLAYER_W / 2 < sld.x2) { p.y = sld.top; continue; } // escalón bajito
    if (p.x + PLAYER_W / 2 <= sld.x1 + 1e-6 && nx + PLAYER_W / 2 > sld.x1) { nx = sld.x1 - PLAYER_W / 2; p.vx = Math.min(p.vx, 0); }
    else if (p.x - PLAYER_W / 2 >= sld.x2 - 1e-6 && nx - PLAYER_W / 2 < sld.x2) { nx = sld.x2 + PLAYER_W / 2; p.vx = Math.max(p.vx, 0); }
  }
  p.x = Math.max(PLAYER_W / 2, Math.min(g.width - 1, nx));

  // Salto (también desde el agua, un poco más bajo).
  if (input.jump && (p.ground || p.swimming) && !surfing) {
    p.vy = p.swimming ? SWIM_JUMP : JUMP; p.ground = false; p.swimming = false;
    g.events.push({ type: 'jump' });
  }

  // Vertical: gravedad, apoyarse arriba de las cosas, caer al canal y nadar.
  const prev = p.y;
  if (!p.swimming) {
    if (p.ground) {
      const sup = supportBelow(g, p, p.y);
      if (sup < p.y - 0.01) p.ground = false; // se terminó el piso (borde de un auto o de un canal)
    }
    if (!p.ground) {
      p.vy = Math.max(-MAX_FALL, p.vy - GRAVITY * dt);
      p.y += p.vy * dt;
      if (p.vy <= 0) {
        const sup = supportBelow(g, p, prev);
        if (sup > -Infinity && p.y <= sup) { p.y = sup; p.vy = 0; p.ground = true; }
        else if (p.y <= SWIM_Y && inCanal(g, p.x)) { p.y = SWIM_Y; p.vy = 0; p.swimming = true; g.events.push({ type: 'splash' }); }
      }
    }
  } else {
    p.y = p.ride === 'tabla' ? WATER_Y : SWIM_Y; // con la tabla, va por arriba del agua
    if (!inCanal(g, p.x)) { p.swimming = false; p.ground = false; }
  }
  if (surfing) p.y = WATER_Y;

  g.best = Math.max(g.best, p.x);
  if (!g.nearHill && p.x > g.hillX - 25) { g.nearHill = true; g.events.push({ type: 'hill' }); }
  if (p.x >= g.goalX && p.ground) { g.won = true; g.events.push({ type: 'win' }); return; }
  if (g.wave >= p.x - 0.2) lose(g, 'ola');
}

export const takeEvents = (g: TsunamiGame) => g.events.splice(0);
