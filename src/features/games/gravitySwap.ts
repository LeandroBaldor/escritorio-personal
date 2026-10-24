// Lógica de Gravity Swap: un astronauta flota por un pasillo que avanza solo (de derecha a izquierda)
// y la gravedad cambia de dirección sola, cada tanto y al azar: puede tirar hacia el piso, el techo, para
// adelante, para atrás o en diagonal (la pantalla gira para que siempre tire "hacia abajo"). Un segundo antes
// hay un aviso. El astronauta se mueve con chorros del oxígeno de su tanque (que no se termina nunca).
// Son 10 escenarios con trampas distintas; al final de cada uno hay un portal. Todo se mide en casilleros
// (el pasillo tiene 10 de alto).
//
// Cada escenario se arma siempre igual (sale de una semilla fija), pero los cambios de gravedad son al azar.
// La gravedad es un ángulo: 0 tira hacia el piso, 90° hacia adelante, 180° hacia el techo y 270° hacia atrás.

export const ROWS = 10;
export const CEIL = 1; // borde de abajo del techo
export const FLOOR = 9; // borde de arriba del piso
export const PLAYER_W = 0.78; // cuadrado: así el choque es igual mire para donde mire
export const PLAYER_H = 0.78;
export const LIVES = 3;
export const LEVEL_COUNT = 10;
export const WARN_SECONDS = 1;
const G = 14; // gravedad baja: flota
const THRUST = 30; // el chorro de oxígeno le gana a la gravedad
const MAX_SPEED = 9;
const DRAG = 0.6; // lo que va frenando solo en el aire
const EDGE = 0.15; // lo más a la izquierda que puede quedar en la pantalla
const START_SAFE = 18; // casilleros libres al principio de cada escenario
const EPS = 1e-6;

export type ThemeId = 'city' | 'mines' | 'base' | 'ice' | 'volcano' | 'inverse' | 'factory' | 'forest' | 'storm' | 'moon';
export type Kind =
  | 'spikes' | 'block' | 'platform' | 'pit' | 'laser' | 'mine' | 'saw' | 'proxMine' | 'asteroid' | 'turret'
  | 'press' | 'icicle' | 'walker' | 'flyer' | 'fireball' | 'geyser' | 'crumble' | 'pendulum' | 'flipper'
  | 'conveyor' | 'spring' | 'spores' | 'waterfall' | 'plant' | 'lightning' | 'meteor' | 'tracker';

export interface LevelDef {
  name: string; theme: ThemeId; stars: number;
  seconds: number; // cuánto dura más o menos (sin morir)
  speed: [number, number]; // velocidad del escenario al principio y al final (casilleros por segundo)
  flip: [number, number]; // cada cuánto cambia la gravedad (segundos, al azar entre los dos)
  gap: [number, number]; // espacio libre entre trampa y trampa
  pool: Partial<Record<Kind, number>>; // qué trampas aparecen y qué tan seguido
  inverted?: boolean; ice?: boolean; wind?: boolean; dark?: boolean; boss?: boolean;
  spin?: boolean; // la gravedad además gira de a poco todo el tiempo
}
// Hasta el escenario 4 la gravedad cambia de a 90°; después, a cualquier ángulo.
export const freeAngles = (def: LevelDef) => LEVELS.indexOf(def) >= 4;

export const LEVELS: LevelDef[] = [
  { name: 'Ciudad Futurista', theme: 'city', stars: 1, seconds: 40, speed: [3, 4], flip: [6, 10], gap: [7, 10],
    pool: { spikes: 3, block: 2, platform: 2, laser: 1.5, mine: 1.5, pit: 1 } },
  { name: 'Minas Espaciales', theme: 'mines', stars: 2, seconds: 45, speed: [3.2, 4.3], flip: [5.5, 9], gap: [6, 9],
    pool: { spikes: 2, block: 1.5, platform: 2, pit: 1, mine: 1.5, proxMine: 2, asteroid: 2, laser: 1 } },
  { name: 'Base en el Espacio', theme: 'base', stars: 2, seconds: 50, speed: [3.4, 4.6], flip: [5, 8.5], gap: [6, 8.5],
    pool: { spikes: 2, platform: 2, laser: 2.5, turret: 2, press: 1.5, mine: 1, pit: 1, proxMine: 1 } },
  { name: 'Planeta Helado', theme: 'ice', stars: 3, seconds: 55, speed: [3.5, 4.8], flip: [4.5, 8], gap: [5.5, 8], ice: true,
    pool: { spikes: 2, platform: 2, icicle: 2.5, saw: 2, walker: 2, mine: 1, pit: 1.5, laser: 1 } },
  { name: 'Planeta Volcánico', theme: 'volcano', stars: 3, seconds: 60, speed: [3.6, 5], flip: [4.5, 7.5], gap: [5, 7.5],
    pool: { spikes: 2.5, fireball: 2, geyser: 2, crumble: 2, pit: 1.5, platform: 1.5, mine: 1, saw: 1 } },
  { name: 'El Orden Inverso', theme: 'inverse', stars: 4, seconds: 60, speed: [3.8, 5.2], flip: [4, 7], gap: [5, 7], inverted: true,
    pool: { spikes: 2, platform: 2, pendulum: 2, flipper: 1.5, flyer: 2, mine: 1.5, laser: 1.5, icicle: 1 } },
  { name: 'Fábrica Robótica', theme: 'factory', stars: 4, seconds: 65, speed: [4, 5.4], flip: [4, 6.5], gap: [4.5, 7],
    pool: { conveyor: 2, press: 2.5, saw: 2.5, walker: 2, laser: 2, turret: 1.5, spikes: 1.5, block: 1 } },
  { name: 'Bosque Bioluminiscente', theme: 'forest', stars: 4, seconds: 70, speed: [4.1, 5.6], flip: [3.5, 6], gap: [4.5, 6.5],
    pool: { spring: 2, spores: 2, waterfall: 1.5, plant: 2, laser: 1.5, flyer: 1.5, spikes: 1.5, mine: 1 } },
  { name: 'Torres en la Tormenta', theme: 'storm', stars: 5, seconds: 75, speed: [4.3, 5.8], flip: [3, 5.5], gap: [4, 6], wind: true, dark: true,
    pool: { lightning: 2.5, pendulum: 2, spikes: 2, pit: 2, platform: 1.5, laser: 1.5, flyer: 1.5, crumble: 1, turret: 1 } },
  { name: 'La Luna', theme: 'moon', stars: 5, seconds: 90, speed: [4.5, 6.2], flip: [2.5, 5], gap: [3.5, 5.5], boss: true, spin: true,
    pool: { meteor: 2.5, tracker: 2, laser: 1.5, spikes: 1.5, saw: 1.5, press: 1, proxMine: 1, mine: 1, pit: 1, platform: 1, pendulum: 1, asteroid: 1, icicle: 0.5 } },
];

// Paredes, piso, techo y plataformas. Las que se desarman ("crumble") caen un ratito después de pisarlas.
export interface Solid { x: number; y: number; w: number; h: number; kind: 'ground' | 'block' | 'platform' | 'crumble' | 'base'; crumble?: number; gone?: boolean }

// Las trampas. "side" dice dónde está apoyada: 1 sobre el piso, -1 colgada del techo, 0 en el aire.
export interface Hazard {
  id: number; kind: Kind | 'ufo'; x: number; y: number; w: number; h: number; side: -1 | 0 | 1;
  phase: number; period: number; // para las que van y vienen (láser, prensa, rayo, géiser, planta...)
  len: number; // largo del láser, de la cadena del péndulo o del recorrido
  amp: number; speed: number; // movimiento
  r: number; // radio de lo que es redondo
  x0: number; y0: number; vx: number; vy: number;
  push: number; // cinta transportadora
  active: boolean; state: number; timer: number; dead: boolean;
  aim: number; // hacia dónde apunta la torreta que sigue al astronauta
}
export interface Bolt { x: number; y: number; vx: number; vy: number; r: number; color: string }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; gravity: number }
export interface Blast { x: number; y: number; r: number; t: number; max: number; lethal: boolean }

export interface Player {
  x: number; y: number;
  vx: number; vy: number; // velocidad propia (aparte de lo que lo lleva el escenario)
  tx: number; ty: number; // hacia dónde empuja el chorro de oxígeno (0, 0 si no lo usa)
  facing: 1 | -1;
  onGround: boolean; // apoyado del lado hacia donde tira la gravedad
  touch: { down: boolean; up: boolean; left: boolean; right: boolean }; // contra qué está apoyado
  landT: number; // tiempo desde que se apoyó
}

export type Death = 'spikes' | 'laser' | 'mine' | 'blast' | 'saw' | 'enemy' | 'void' | 'edge' | 'fire' | 'bolt' | 'lightning' | 'press' | 'icicle' | 'spore' | 'rock';
export type Phase = 'play' | 'dead' | 'cleared' | 'ending' | 'over' | 'won';
export type GravityEvent =
  | { type: 'land' } | { type: 'warn' } | { type: 'flip' } | { type: 'death'; reason: Death }
  | { type: 'boom' } | { type: 'shot' } | { type: 'zap' } | { type: 'spring' } | { type: 'crumble' } | { type: 'cleared'; level: number }
  | { type: 'thunder' } | { type: 'gust' } | { type: 'respawn' } | { type: 'won' };

export interface Stats { time: number; deaths: number; flips: number; levels: number }

export interface Game {
  level: number; def: LevelDef; cols: number;
  length: number; portalX: number;
  solids: Solid[]; hazards: Hazard[]; bolts: Bolt[]; particles: Particle[]; blasts: Blast[];
  player: Player;
  cam: number; speed: number; time: number;
  angle: number; // hacia dónde tira la gravedad (radianes; 0 = hacia el piso)
  view: number; // hacia dónde está girada la pantalla (sigue a "angle" de a poco)
  nextAngle: number; // el próximo ángulo (se muestra en el aviso)
  gravityIn: number; warned: boolean; flipCooldown: number;
  gust: number; gustIn: number; // ráfagas de viento (Torres en la Tormenta)
  flash: number; // relámpago que ilumina todo
  lives: number; phase: Phase; phaseT: number; death: Death | null;
  stats: Stats; pendingFlips: number[];
  nextId: number; events: GravityEvent[];
}
// Las flechas son de la pantalla (que está girada): "arriba" siempre es contra la gravedad.
export interface Input { left: boolean; right: boolean; up: boolean; down: boolean }

// Números al azar que salen siempre iguales con la misma semilla (así cada escenario se arma igual).
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const emit = (game: Game, event: GravityEvent) => { game.events.push(event); };
export function takeEvents(game: Game) { const events = game.events; game.events = []; return events; }

const between = (rand: () => number, [a, b]: [number, number]) => a + rand() * (b - a);
const pick = <T extends string>(weights: Partial<Record<T, number>>, rand: () => number): T => {
  const entries = Object.entries(weights) as [T, number][];
  let left = rand() * entries.reduce((n, [, w]) => n + w, 0);
  for (const [kind, w] of entries) { left -= w; if (left <= 0) return kind; }
  return entries[entries.length - 1][0];
};

export const levelLength = (def: LevelDef) => Math.round(def.seconds * (def.speed[0] + def.speed[1]) / 2);

// ---------- Armado del escenario ----------

interface Layout { solids: Solid[]; hazards: Hazard[]; length: number; portalX: number }

export function buildLevel(level: number): Layout {
  const def = LEVELS[level - 1];
  const rand = seeded(level * 7919 + 2026);
  const length = levelLength(def);
  const portalX = length;
  const solids: Solid[] = [];
  const hazards: Hazard[] = [];
  const gaps: Record<1 | -1, [number, number][]> = { 1: [], [-1]: [] };
  let id = 1;
  const hazard = (kind: Hazard['kind'], fields: Partial<Hazard>): Hazard => {
    const h: Hazard = { id: id++, kind, x: 0, y: 0, w: 1, h: 1, side: 0, phase: rand() * 10, period: 3, len: 0, amp: 0, speed: 0, r: 0.45, x0: 0, y0: 0, vx: 0, vy: 0, push: 0, active: false, state: 0, timer: 0, dead: false, aim: Math.PI, ...fields };
    h.x0 ||= h.x; h.y0 ||= h.y;
    hazards.push(h);
    return h;
  };
  const surface = (side: 1 | -1) => side === 1 ? FLOOR : CEIL;
  // Algo apoyado de alto "h": devuelve el "y" de arriba (en el piso crece para arriba; en el techo, para abajo).
  const top = (side: 1 | -1, h: number) => side === 1 ? FLOOR - h : CEIL;
  const randomSide = (): 1 | -1 => rand() < 0.5 ? 1 : -1;
  const hard = def.stars;

  // Una trampa de cada tipo. Devuelve el ancho que ocupa.
  const place = (kind: Kind, x: number): number => {
    const side = randomSide();
    switch (kind) {
      case 'spikes': {
        const w = 1 + Math.floor(rand() * (hard >= 3 ? 3 : 2));
        hazard('spikes', { x, y: top(side, 0.55), w, h: 0.55, side });
        return w;
      }
      case 'block': {
        const w = 1 + Math.floor(rand() * 2);
        solids.push({ x, y: top(side, 1), w, h: 1, kind: 'block' });
        // Desde el nivel 2, a veces con pinchos del lado de afuera.
        if (hard >= 2 && rand() < 0.45) hazard('spikes', { x, y: side === 1 ? FLOOR - 1.5 : CEIL + 1, w, h: 0.5, side });
        return w;
      }
      case 'platform': {
        const w = 3 + Math.floor(rand() * 3), y = 3.4 + rand() * 2.2;
        solids.push({ x, y, w, h: 0.8, kind: 'platform' });
        const sw = Math.min(w, 1 + Math.floor(rand() * 3)), sx = x + Math.floor(rand() * (w - sw + 1));
        if (rand() < 0.5) hazard('spikes', { x: sx, y: y - 0.5, w: sw, h: 0.5, side: 1 });
        else hazard('spikes', { x: sx, y: y + 0.8, w: sw, h: 0.5, side: -1 });
        return w;
      }
      case 'pit': {
        const w = 1.5 + rand() * (hard >= 3 ? 1.3 : 0.8);
        gaps[side].push([x, x + w]);
        return w;
      }
      case 'laser': {
        // Láser que se prende y se apaga. Desde el nivel 3 puede cruzar de punta a punta.
        const full = hard >= 2 && rand() < 0.35;
        const len = full ? FLOOR - CEIL : 3 + rand() * (hard >= 3 ? 3.5 : 2);
        const period = 2.2 + rand() * 0.8;
        // El que cruza de punta a punta queda prendido menos tiempo, para que se pueda pasar.
        hazard('laser', { x: x + 0.35, y: side === 1 ? FLOOR - len : CEIL, w: 0.3, h: len, side, len, period, amp: full ? 0.32 : 0.45 });
        return 1;
      }
      case 'mine': {
        hazard('mine', { x: x + 0.5, y: 5, side: 0, amp: 1.4 + rand() * 1.8, speed: 1.1 + rand() * 0.9, r: 0.45 });
        return 1;
      }
      case 'saw': {
        const r = 0.85 + rand() * 0.3, range = rand() < 0.5 ? 0 : 2.5;
        hazard('saw', { x: x + r, y: surface(side), side, r, len: range, speed: 1.6 });
        return r * 2 + range;
      }
      case 'proxMine': {
        const onSurface = rand() < 0.6;
        hazard('proxMine', { x: x + 0.5, y: onSurface ? (side === 1 ? FLOOR - 0.4 : CEIL + 0.4) : 3 + rand() * 4, side: onSurface ? side : 0, r: 0.4 });
        return 1;
      }
      case 'asteroid': {
        hazard('asteroid', { x: x + 6, y: 2.4 + rand() * 5.2, side: 0, r: 0.5 + rand() * 0.35, vx: -(1.8 + rand() * 2.2), speed: rand() * 4 - 2 });
        return 1;
      }
      case 'turret': case 'tracker': {
        solids.push({ x, y: top(side, 0.8), w: 0.9, h: 0.8, kind: 'base' });
        hazard(kind, { x, y: top(side, 0.8), w: 0.9, h: 0.8, side, period: kind === 'turret' ? 1.9 + rand() * 0.6 : 2.5, timer: rand() * 1.5 });
        return 1;
      }
      case 'press': {
        hazard('press', { x, y: CEIL, w: 1.6, h: 0, side, period: 2.6 + rand() * 0.6 });
        return 1.6;
      }
      case 'icicle': {
        hazard('icicle', { x: x + 0.2, y: CEIL, w: 0.6, h: 1.1, side: -1 });
        return 1;
      }
      case 'walker': {
        const len = 2.5 + rand() * 2.5;
        hazard('walker', { x, y: top(side, 0.9), w: 0.8, h: 0.9, side, len, speed: 1.3 + rand() * 0.6 });
        return len + 0.8;
      }
      case 'flyer': {
        hazard('flyer', { x: x + 1, y: 5, side: 0, r: 0.42, amp: 2 + rand() * 1.2, speed: 1.2 + rand() * 0.8, len: 1.3 });
        return 2;
      }
      case 'fireball': {
        // Pozo de lava en el piso del que saltan bolas de fuego.
        const w = 2;
        gaps[1].push([x, x + w]);
        hazard('fireball', { x: x + w / 2, y: ROWS + 1, side: 1, r: 0.42, period: 2 + rand() * 0.6, len: 4.5 + rand() * 1.5 });
        return w;
      }
      case 'geyser': {
        hazard('geyser', { x: x + 0.1, y: FLOOR, w: 0.9, h: 0, side: 1, period: 2.8 + rand() * 0.8, len: 5 + rand() * 2.5 });
        return 1;
      }
      case 'crumble': {
        const w = 3;
        gaps[side].push([x, x + w]);
        solids.push({ x, y: side === 1 ? FLOOR : CEIL - 1, w, h: 1, kind: 'crumble' });
        return w;
      }
      case 'pendulum': {
        const len = 3 + rand() * 1.4;
        hazard('pendulum', { x: x + 1, y: surface(side), side, len, r: 0.55, amp: 0.9 + rand() * 0.25, speed: 1.6 + rand() * 0.5 });
        return 2;
      }
      case 'flipper': {
        hazard('flipper', { x, y: side === 1 ? FLOOR - 0.35 : CEIL, w: 1, h: 0.35, side });
        return 1;
      }
      case 'conveyor': {
        const w = 4 + Math.floor(rand() * 3);
        hazard('conveyor', { x, y: side === 1 ? FLOOR : CEIL - 0.25, w, h: 0.25, side, push: rand() < 0.75 ? -2.4 : 2.2 });
        return w;
      }
      case 'spring': {
        hazard('spring', { x, y: side === 1 ? FLOOR - 0.45 : CEIL, w: 1, h: 0.45, side });
        return 1;
      }
      case 'spores': {
        const n = 3 + Math.floor(rand() * 3);
        for (let i = 0; i < n; i++) hazard('spores', { x: x + i * 0.9, y: 3 + rand() * 4, side: 0, r: 0.24, amp: 0.4 + rand() * 0.4, speed: 1 + rand() });
        return n * 0.9;
      }
      case 'waterfall': {
        const w = 2 + rand();
        hazard('waterfall', { x, y: CEIL, w, h: FLOOR - CEIL, side: 0 });
        return w;
      }
      case 'plant': {
        hazard('plant', { x, y: top(side, 0.6), w: 0.9, h: 0.6, side, period: 2 + rand() * 0.6 });
        return 1;
      }
      case 'lightning': {
        hazard('lightning', { x, y: CEIL, w: 1, h: FLOOR - CEIL, side: 0, period: 3 + rand() * 0.8 });
        return 1;
      }
      case 'meteor': {
        hazard('meteor', { x, y: -1.5, side: 0, r: 0.55, x0: x });
        return 1;
      }
    }
  };

  let x = START_SAFE;
  const end = portalX - 12;
  while (x < end) {
    const kind = pick(def.pool, rand);
    const used = place(kind, x);
    x += used + between(rand, def.gap) * (1 - 0.15 * x / length);
  }
  // El jefe de la Luna: un ovni que persigue en el último tramo.
  if (def.boss) hazard('ufo', { x: length * 0.72, y: 5, side: 0, w: 1.8, h: 0.8, period: 1.7 });

  // Piso y techo, con los pozos.
  for (const side of [1, -1] as const) {
    const holes = gaps[side].sort((a, b) => a[0] - b[0]);
    let from = -40;
    for (const [a, b] of [...holes, [portalX + 60, portalX + 60] as [number, number]]) {
      if (a > from) solids.push({ x: from, y: side === 1 ? FLOOR : CEIL - 2, w: a - from, h: 2, kind: 'ground' });
      from = Math.max(from, b);
    }
  }
  return { solids, hazards, length, portalX };
}

// ---------- Partida ----------

export function newStats(): Stats { return { time: 0, deaths: 0, flips: 0, levels: 0 }; }

export function newGame(level: number, cols: number, stats: Stats = newStats(), rand: () => number = Math.random): Game {
  const game = { level, cols, lives: LIVES, stats, nextId: 1000, events: [] as GravityEvent[] } as Game;
  loadLevel(game, level, rand);
  return game;
}

// Arranca (o vuelve a arrancar) el escenario desde el principio.
export function loadLevel(game: Game, level: number, rand: () => number = Math.random) {
  const def = LEVELS[level - 1];
  const layout = buildLevel(level);
  const angle = def.inverted ? Math.PI : 0;
  Object.assign(game, {
    level, def, ...layout,
    bolts: [], particles: [], blasts: [],
    player: {
      x: 4, y: angle ? CEIL : FLOOR - PLAYER_H, vx: 0, vy: 0, tx: 0, ty: 0, facing: 1,
      onGround: true, touch: { down: !angle, up: !!angle, left: false, right: false }, landT: 9,
    },
    cam: 0, speed: def.speed[0], time: 0,
    angle, view: angle, nextAngle: angle,
    gravityIn: Math.max(3.5, between(rand, def.flip)), warned: false, flipCooldown: 0,
    gust: 0, gustIn: 5, flash: 0,
    phase: 'play' as Phase, phaseT: 0, death: null, pendingFlips: [],
  });
}

export const progress = (game: Game) => Math.max(0, Math.min(1, (game.player.x + PLAYER_W) / game.portalX));

// Lo que se puede ver (con un poco de margen).
const visible = (game: Game, x: number, margin = 1) => x > game.cam - margin && x < game.cam + game.cols + margin;
const camStop = (game: Game) => game.portalX + 3 - game.cols;

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const circleHits = (r: { x: number; y: number; w: number; h: number }, cx: number, cy: number, radius: number) => {
  const nx = Math.max(r.x, Math.min(cx, r.x + r.w)), ny = Math.max(r.y, Math.min(cy, r.y + r.h));
  return (nx - cx) ** 2 + (ny - cy) ** 2 < radius * radius;
};
// El cuerpo del astronauta, un poco más chico que el dibujo (así un roce no mata).
const body = (p: Player) => ({ x: p.x + 0.1, y: p.y + 0.1, w: PLAYER_W - 0.2, h: PLAYER_H - 0.2 });

const liveSolids = (game: Game) => game.solids.filter(s => !s.gone && s.x < game.player.x + 3 && s.x + s.w > game.player.x - 3);
const hitsSolid = (solids: Solid[], x: number, y: number) => solids.find(s => overlaps({ x, y, w: PLAYER_W, h: PLAYER_H }, s));

function burst(game: Game, x: number, y: number, colors: string[], count: number, power: number, gravity = 18) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, v = power * (0.3 + Math.random() * 0.8), max = 0.4 + Math.random() * 0.5;
    game.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: max, max, color: colors[i % colors.length], size: 0.1 + Math.random() * 0.14, gravity });
  }
}
const BOOM = ['#fde047', '#fb923c', '#ef4444', '#f8fafc'];

function explode(game: Game, x: number, y: number, r: number) {
  game.blasts.push({ x, y, r, t: 0, max: 0.55, lethal: true });
  burst(game, x, y, BOOM, 28, 7);
  emit(game, { type: 'boom' });
}

// ---------- Cada trampa en cada momento ----------

// Ciclos: fracción del período (0 a 1) en que está cada trampa que va y viene.
const cycle = (game: Game, h: Hazard) => (((game.time + h.phase) % h.period) + h.period) % h.period / h.period;
export const laserOn = (game: Game, h: Hazard) => cycle(game, h) < (h.amp || 0.45);
export const laserWarn = (game: Game, h: Hazard) => cycle(game, h) > 0.85;
// Prensa: cuánto bajó (0 guardada, 1 hasta el otro lado) y si tiembla porque está por bajar.
export function pressState(game: Game, h: Hazard) {
  const t = cycle(game, h) * h.period, rest = h.period - 0.9;
  if (t < rest) return { ext: 0, shake: t > rest - 0.45 };
  const u = t - rest;
  if (u < 0.13) return { ext: u / 0.13, shake: false };
  if (u < 0.4) return { ext: 1, shake: false };
  return { ext: Math.max(0, 1 - (u - 0.4) / 0.5), shake: false };
}
export const pressRect = (game: Game, h: Hazard) => {
  const ext = pressState(game, h).ext * (FLOOR - CEIL);
  return { x: h.x, y: h.side === 1 ? FLOOR - ext : CEIL, w: h.w, h: ext };
};
export const geyserHeight = (game: Game, h: Hazard) => {
  const c = cycle(game, h);
  if (c < 0.62) return 0;
  if (c < 0.7) return h.len * (c - 0.62) / 0.08;
  if (c < 0.92) return h.len;
  return h.len * (1 - (c - 0.92) / 0.08);
};
export const geyserWarn = (game: Game, h: Hazard) => { const c = cycle(game, h); return c > 0.42 && c < 0.62; };
export const plantBite = (game: Game, h: Hazard) => cycle(game, h) > 0.7;
export const lightningState = (game: Game, h: Hazard) => { const c = cycle(game, h); return c > 0.9 ? 'strike' : c > 0.62 ? 'warn' : 'idle'; };
export function pendulumBall(game: Game, h: Hazard) {
  const a = h.amp * Math.sin((game.time + h.phase) * h.speed);
  return { x: h.x + Math.sin(a) * h.len, y: h.y - h.side * Math.cos(a) * h.len, angle: a };
}
export const sawCenter = (game: Game, h: Hazard) => ({ x: h.x + (h.len ? (Math.sin((game.time + h.phase) * h.speed) + 1) / 2 * h.len : 0), y: h.y });
export const mineCenter = (game: Game, h: Hazard) => ({ x: h.x, y: h.y + Math.sin((game.time + h.phase) * h.speed) * h.amp });
export const flyerCenter = (game: Game, h: Hazard) => ({ x: h.x + Math.sin((game.time + h.phase) * h.speed * 0.7) * h.len, y: h.y + Math.sin((game.time + h.phase) * h.speed) * h.amp });
export const sporeCenter = (game: Game, h: Hazard) => ({ x: h.x + Math.cos((game.time + h.phase) * h.speed) * h.amp, y: h.y + Math.sin((game.time + h.phase) * h.speed * 1.3) * h.amp });
export const walkerX = (game: Game, h: Hazard) => h.x0 + (1 - Math.cos((game.time + h.phase) * h.speed / Math.max(1, h.len) * 2)) / 2 * h.len;

function updateHazards(game: Game, dt: number) {
  const p = game.player;
  const px = p.x + PLAYER_W / 2, py = p.y + PLAYER_H / 2;
  for (const h of game.hazards) {
    if (h.dead) continue;
    switch (h.kind) {
      case 'laser':
        if (visible(game, h.x) && laserOn(game, h) && cycle(game, h) * h.period < dt * 1.5) emit(game, { type: 'zap' });
        break;
      case 'walker': h.x = walkerX(game, h); break;
      case 'proxMine':
        if (h.state === 0 && Math.hypot(px - h.x, py - h.y) < 2.4) { h.state = 1; h.timer = 0.55; }
        if (h.state === 1 && (h.timer -= dt) <= 0) { h.dead = true; explode(game, h.x, h.y, 1.8); }
        break;
      case 'asteroid':
        if (!h.active && h.x < game.cam + game.cols + 1) h.active = true;
        if (h.active) { h.x += h.vx * dt; h.y += Math.sin(game.time * 1.3 + h.phase) * 0.3 * dt; }
        if (h.x < game.cam - 3) h.dead = true;
        break;
      case 'turret': case 'tracker': {
        if (!visible(game, h.x, -0.5) || h.x < game.cam + 1) break;
        const gx = h.x + h.w / 2, gy = h.side === 1 ? h.y + 0.25 : h.y + h.h - 0.25;
        if (h.kind === 'tracker') {
          h.timer -= dt;
          // Apunta al astronauta mientras carga y el último cuarto de segundo se queda quieta.
          if (h.timer > 0.25 || h.timer < -0.01) h.aim = Math.atan2(py - gy, px - gx);
          if (h.timer <= 0) {
            game.bolts.push({ x: gx, y: gy, vx: Math.cos(h.aim) * 10, vy: Math.sin(h.aim) * 10, r: 0.2, color: '#f43f5e' });
            emit(game, { type: 'shot' });
            h.timer = h.period;
          }
        } else if ((h.timer -= dt) <= 0) {
          const by = h.side === 1 ? FLOOR - 0.45 : CEIL + 0.45;
          game.bolts.push({ x: h.x - 0.1, y: by, vx: -4, vy: 0, r: 0.18, color: '#fbbf24' });
          emit(game, { type: 'shot' });
          h.timer = h.period;
        }
        break;
      }
      case 'icicle':
        if (h.state === 0 && px > h.x - 3.2 && Math.abs(px - h.x) < 4) { h.state = 1; h.vy = 0; }
        if (h.state === 1) {
          h.vy += 30 * dt; h.y += h.vy * dt;
          if (h.y + h.h > FLOOR) { h.dead = true; burst(game, h.x + h.w / 2, FLOOR - 0.2, ['#e0f2fe', '#93c5fd', '#ffffff'], 14, 4); }
        }
        break;
      case 'fireball': {
        // Salta desde el pozo de lava (abajo de todo), sube y vuelve a caer.
        const t = cycle(game, h) * h.period, flight = 2 * Math.sqrt(2 * h.len / 20);
        if (t < flight) { const v = Math.sqrt(2 * 20 * h.len); h.y = ROWS + 0.5 - (v * t - 10 * t * t); h.active = true; }
        else { h.y = ROWS + 1.5; h.active = false; }
        break;
      }
      case 'meteor':
        if (!h.active && h.x0 < game.cam + game.cols + 2) { h.active = true; h.timer = 0; }
        if (h.active) {
          h.timer += dt;
          const k = Math.min(1, h.timer / 1.4);
          h.x = h.x0 + 4 * (1 - k); h.y = -1.5 + (FLOOR + 1.5) * k;
          if (k >= 1) { h.dead = true; explode(game, h.x0, FLOOR - 0.3, 1.4); }
        }
        break;
      case 'ufo': {
        if (!h.active && game.cam > h.x - game.cols) { h.active = true; h.timer = 2; }
        if (!h.active) break;
        const leaving = game.cam >= camStop(game) - 0.5;
        h.x = game.cam + game.cols * (leaving ? 1.3 : 0.74) + Math.sin(game.time * 0.9) * 1.2;
        h.y = 4.8 + Math.sin(game.time * 1.4) * 1.9;
        if (!leaving && (h.timer -= dt) <= 0) {
          const a = Math.atan2(py - h.y, px - h.x);
          game.bolts.push({ x: h.x, y: h.y + 0.3, vx: Math.cos(a) * 7, vy: Math.sin(a) * 7, r: 0.22, color: '#4ade80' });
          emit(game, { type: 'shot' });
          h.timer = h.period;
        }
        break;
      }
      case 'lightning':
        if (visible(game, h.x) && lightningState(game, h) === 'strike' && (cycle(game, h) - 0.9) * h.period < dt * 1.5) { game.flash = 0.25; emit(game, { type: 'thunder' }); }
        break;
    }
  }

  for (const b of game.bolts) { b.x += b.vx * dt; b.y += b.vy * dt; }
  const near = game.solids.filter(s => !s.gone && s.x < game.cam + game.cols + 3 && s.x + s.w > game.cam - 2);
  game.bolts = game.bolts.filter(b => b.x > game.cam - 2 && b.x < game.cam + game.cols + 3 && b.y > -1 && b.y < ROWS + 1
    && !near.some(s => s.kind !== 'base' && circleHits(s, b.x, b.y, b.r * 0.5)));
}

// ¿Lo mató algo? Devuelve el motivo.
function lethal(game: Game): Death | null {
  const p = game.player, r = body(p);
  for (const b of game.blasts) if (b.lethal && b.t < 0.22 && circleHits(r, b.x, b.y, b.r)) return 'blast';
  for (const b of game.bolts) if (circleHits(r, b.x, b.y, b.r)) return 'bolt';
  for (const h of game.hazards) {
    if (h.dead || !visible(game, h.x, 4)) continue;
    switch (h.kind) {
      case 'spikes': if (overlaps(r, { x: h.x + 0.08, y: h.y + (h.side === 1 ? 0.15 : 0), w: h.w - 0.16, h: h.h - 0.15 })) return 'spikes'; break;
      case 'laser': if (laserOn(game, h) && overlaps(r, h)) return 'laser'; break;
      case 'mine': { const c = mineCenter(game, h); if (circleHits(r, c.x, c.y, h.r)) return 'mine'; break; }
      case 'saw': { const c = sawCenter(game, h); if (circleHits(r, c.x, c.y, h.r * 0.92)) return 'saw'; break; }
      case 'proxMine': if (circleHits(r, h.x, h.y, h.r)) return 'mine'; break;
      case 'asteroid': if (h.active && circleHits(r, h.x, h.y, h.r * 0.9)) return 'rock'; break;
      case 'press': if (overlaps(r, pressRect(game, h))) return 'press'; break;
      case 'icicle': if (overlaps(r, { x: h.x + 0.1, y: h.y, w: h.w - 0.2, h: h.h })) return 'icicle'; break;
      case 'walker': if (overlaps(r, { x: h.x + 0.08, y: h.y + 0.1, w: h.w - 0.16, h: h.h - 0.1 })) return 'enemy'; break;
      case 'flyer': { const c = flyerCenter(game, h); if (circleHits(r, c.x, c.y, h.r)) return 'enemy'; break; }
      case 'fireball': if (h.active && circleHits(r, h.x, h.y, h.r)) return 'fire'; break;
      case 'geyser': { const gh = geyserHeight(game, h); if (gh > 0 && overlaps(r, { x: h.x, y: FLOOR - gh, w: h.w, h: gh })) return 'fire'; break; }
      case 'pendulum': { const c = pendulumBall(game, h); if (circleHits(r, c.x, c.y, h.r)) return 'spikes'; break; }
      case 'spores': { const c = sporeCenter(game, h); if (circleHits(r, c.x, c.y, h.r)) return 'spore'; break; }
      case 'plant': {
        const bite = plantBite(game, h) ? 1.5 : h.h;
        if (overlaps(r, { x: h.x + 0.1, y: h.side === 1 ? FLOOR - bite : CEIL, w: h.w - 0.2, h: bite })) return 'enemy';
        break;
      }
      case 'lightning': if (lightningState(game, h) === 'strike' && overlaps(r, { x: h.x + 0.2, y: h.y, w: h.w - 0.4, h: h.h })) return 'lightning'; break;
      case 'meteor': if (h.active && circleHits(r, h.x, h.y, h.r)) return 'rock'; break;
      case 'ufo': if (h.active && overlaps(r, { x: h.x - h.w / 2, y: h.y - h.h / 2, w: h.w, h: h.h })) return 'enemy'; break;
    }
  }
  return null;
}

// ---------- Gravedad ----------

const TAU = Math.PI * 2;
export const wrapAngle = (a: number) => ((a % TAU) + TAU) % TAU;
// Diferencia entre dos ángulos por el camino más corto (con signo).
export const angleDiff = (to: number, from: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

// El próximo ángulo de la gravedad: de a 90° al principio y después cualquiera (de a 15°), siempre
// bastante distinto del actual para que se note el cambio.
export function chooseAngle(game: Game, rand: () => number = Math.random) {
  if (!freeAngles(game.def)) {
    const options = [0, 1, 2, 3].map(k => k * Math.PI / 2).filter(a => Math.abs(angleDiff(a, game.angle)) > 0.3);
    return options[Math.floor(rand() * options.length)];
  }
  // Gira entre 45° y 315° desde el ángulo actual, de a 15°.
  const turn = (3 + Math.floor(rand() * 19)) * Math.PI / 12;
  return wrapAngle(Math.round((game.angle + turn) / (Math.PI / 12)) * Math.PI / 12);
}

export function flipGravity(game: Game, rand: () => number = Math.random, to = chooseAngle(game, rand)) {
  game.angle = wrapAngle(to); game.nextAngle = game.angle;
  game.player.onGround = false;
  game.warned = false;
  game.gravityIn = between(rand, game.def.flip);
  game.pendingFlips.push(game.time);
  emit(game, { type: 'flip' });
}

function die(game: Game, reason: Death) {
  const p = game.player;
  game.phase = 'dead'; game.phaseT = 0; game.death = reason;
  game.lives--; game.stats.deaths++;
  game.pendingFlips = [];
  burst(game, p.x + PLAYER_W / 2, p.y + PLAYER_H / 2, ['#f8fafc', '#60a5fa', '#1d4ed8', '#fde047'], 34, 8, 6);
  emit(game, { type: 'death', reason });
}

function updateEffects(game: Game, dt: number) {
  for (const s of game.particles) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += s.gravity * dt; s.life -= dt; }
  game.particles = game.particles.filter(s => s.life > 0);
  for (const b of game.blasts) b.t += dt;
  game.blasts = game.blasts.filter(b => b.t < b.max);
  game.flash = Math.max(0, game.flash - dt);
}

// ---------- Un paso del juego ----------

export function step(game: Game, input: Input, dt: number, rand: () => number = Math.random) {
  if (dt <= 0) return;
  updateEffects(game, dt);
  game.phaseT += dt;
  const p = game.player;

  if (game.phase === 'dead') {
    if (game.phaseT >= 1.3) {
      if (game.lives > 0) { loadLevel(game, game.level, rand); emit(game, { type: 'respawn' }); }
      else game.phase = 'over';
    }
    return;
  }
  if (game.phase === 'cleared') {
    // Entra al portal y, después de un momento, arranca el escenario que sigue.
    p.x += 1.5 * dt;
    if (game.phaseT >= 2.4) {
      if (game.level < LEVEL_COUNT) { game.lives = LIVES; loadLevel(game, game.level + 1, rand); }
      else { game.phase = 'ending'; game.phaseT = 0; }
    }
    return;
  }
  if (game.phase === 'ending') {
    if (game.phaseT >= 5) { game.phase = 'won'; emit(game, { type: 'won' }); }
    return;
  }
  if (game.phase !== 'play') return;

  game.time += dt;
  game.stats.time += dt;
  const def = game.def;
  game.speed = def.speed[0] + (def.speed[1] - def.speed[0]) * Math.min(1, game.cam / game.portalX);
  const stop = camStop(game);
  const scroll = game.cam < stop ? game.speed : 0;
  game.cam = Math.min(stop, game.cam + scroll * dt);

  updateHazards(game, dt);

  // Los cambios de gravedad que pasaron hace un rato sin morir cuentan como "sobrevividos".
  while (game.pendingFlips.length && game.time - game.pendingFlips[0] > 2) { game.pendingFlips.shift(); game.stats.flips++; }

  // Cambio de gravedad: un segundo antes, aviso.
  game.gravityIn -= dt;
  game.flipCooldown -= dt;
  if (!game.warned && game.gravityIn <= WARN_SECONDS) { game.warned = true; game.nextAngle = chooseAngle(game, rand); emit(game, { type: 'warn' }); }
  if (game.gravityIn <= 0) flipGravity(game, rand, game.nextAngle);
  // En la Luna, además, la gravedad gira de a poco todo el tiempo.
  if (def.spin) { game.angle = wrapAngle(game.angle + (0.22 + 0.12 * Math.sin(game.time * 0.4)) * dt); if (!game.warned) game.nextAngle = game.angle; }
  // La pantalla gira de a poco hasta que la gravedad quede apuntando hacia abajo.
  game.view = wrapAngle(game.view + angleDiff(game.angle, game.view) * Math.min(1, 4.5 * dt));

  // Ráfagas de viento (empujan para atrás).
  if (def.wind) {
    game.gustIn -= dt;
    if (game.gust > 0) game.gust -= dt;
    if (game.gustIn <= 0) { game.gust = 1.6; game.gustIn = 4 + rand() * 3; emit(game, { type: 'gust' }); }
  }

  // Fuerzas: la gravedad (para donde apunte), el chorro de oxígeno, el viento y las cascadas.
  const gx = Math.sin(game.angle) * G, gy = Math.cos(game.angle) * G;
  const sx = (input.right ? 1 : 0) - (input.left ? 1 : 0), sy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  p.tx = 0; p.ty = 0;
  if (sx || sy) {
    // Las flechas son de la pantalla girada: se pasan a la dirección del pasillo.
    const len = Math.hypot(sx, sy), ux = sx / len, uy = sy / len, c = Math.cos(game.view), s = Math.sin(game.view);
    p.tx = ux * c + uy * s; p.ty = -ux * s + uy * c;
    if (ux) p.facing = ux > 0 ? 1 : -1;
  }
  let ax = gx + p.tx * THRUST, ay = gy + p.ty * THRUST;
  if (game.gust > 0) ax -= 6;
  for (const h of game.hazards) if (h.kind === 'waterfall' && p.x + PLAYER_W > h.x && p.x < h.x + h.w) ay += 20;
  p.vx += ax * dt; p.vy += ay * dt;
  const drag = 1 - Math.min(1, DRAG * dt);
  p.vx *= drag; p.vy *= drag;
  // Apoyado contra algo, frena lo que se desliza (en el hielo, casi nada).
  const grip = 1 - Math.min(1, (def.ice ? 0.6 : 5) * dt);
  if (p.touch.down || p.touch.up) p.vx *= grip;
  if (p.touch.left || p.touch.right) p.vy *= grip;
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > MAX_SPEED) { p.vx *= MAX_SPEED / speed; p.vy *= MAX_SPEED / speed; }

  const solids = liveSolids(game);
  // Cinta transportadora: lo lleva mientras está apoyado en ella.
  let push = 0;
  for (const h of game.hazards) if (h.kind === 'conveyor' && p.x + PLAYER_W > h.x && p.x < h.x + h.w && (h.side === 1 ? p.touch.down : p.touch.up)) push = h.push;
  // Horizontal: el escenario lo lleva; las paredes lo frenan y el borde de la pantalla lo empuja.
  const dx = (game.speed + p.vx + push) * dt;
  p.x += dx;
  const wall = hitsSolid(solids, p.x, p.y);
  if (wall) {
    if (dx > 0) { p.x = wall.x - PLAYER_W - EPS; p.vx = Math.min(p.vx, 0); }
    else { p.x = wall.x + wall.w + EPS; p.vx = Math.max(p.vx, -game.speed); }
  }
  const maxX = game.cam + (game.cam >= stop ? game.cols : game.cols - 1.5) - PLAYER_W;
  if (p.x > maxX) { p.x = maxX; p.vx = Math.min(p.vx, 0); }
  if (p.x < game.cam + EDGE) {
    p.x = game.cam + EDGE; p.vx = Math.max(p.vx, 0);
    if (hitsSolid(solids, p.x, p.y)) { die(game, 'edge'); return; }
  }
  // Vertical.
  p.y += p.vy * dt;
  const hit = hitsSolid(solids, p.x, p.y);
  if (hit) { p.y = p.vy > 0 ? hit.y - PLAYER_H - EPS : hit.y + hit.h + EPS; p.vy = 0; }

  // Contra qué quedó apoyado, y si es del lado hacia donde tira la gravedad.
  const probe = 0.03, wasGround = p.onGround;
  p.touch = { down: !!hitsSolid(solids, p.x, p.y + probe), up: !!hitsSolid(solids, p.x, p.y - probe), left: !!hitsSolid(solids, p.x - probe, p.y), right: !!hitsSolid(solids, p.x + probe, p.y) };
  p.onGround = p.touch[Math.abs(gy) >= Math.abs(gx) ? (gy > 0 ? 'down' : 'up') : (gx > 0 ? 'right' : 'left')];
  if (p.onGround && !wasGround) { p.landT = 0; emit(game, { type: 'land' }); }
  p.landT += dt;

  // Plataformas que se desarman: empiezan a caerse al tocarlas.
  const around = { x: p.x - probe, y: p.y - probe, w: PLAYER_W + probe * 2, h: PLAYER_H + probe * 2 };
  for (const s of game.solids) {
    if (s.kind !== 'crumble' || s.gone) continue;
    if (s.crumble === undefined && overlaps(around, s)) { s.crumble = 0.5; emit(game, { type: 'crumble' }); }
    if (s.crumble === undefined) continue;
    s.crumble -= dt;
    if (s.crumble <= 0) { s.gone = true; burst(game, s.x + s.w / 2, s.y + s.h / 2, ['#57534e', '#78716c', '#f97316'], 20, 4); }
  }

  // Hongo que rebota y flecha que cambia la gravedad.
  const r = body(p);
  for (const h of game.hazards) {
    if (h.dead) continue;
    if (h.kind !== 'spring' && h.kind !== 'flipper') continue;
    if (p.x + PLAYER_W < h.x || p.x > h.x + h.w) continue;
    if (h.kind === 'spring' && (h.side === 1 ? p.touch.down : p.touch.up)) { p.vy = h.side === 1 ? -13 : 13; emit(game, { type: 'spring' }); }
    if (h.kind === 'flipper' && game.flipCooldown <= 0 && overlaps(r, h)) {
      flipGravity(game, rand);
      game.gravityIn = Math.max(game.gravityIn, 2.5);
      game.flipCooldown = 1.2;
    }
  }

  if (p.y > ROWS + 0.5 || p.y + PLAYER_H < -0.5) { die(game, 'void'); return; }
  const reason = lethal(game);
  if (reason) { die(game, reason); return; }

  if (p.x + PLAYER_W >= game.portalX + 0.4) {
    game.phase = 'cleared'; game.phaseT = 0;
    game.stats.levels = Math.max(game.stats.levels, game.level);
    game.stats.flips += game.pendingFlips.length; game.pendingFlips = [];
    emit(game, { type: 'cleared', level: game.level });
  }
}
