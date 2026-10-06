// Lógica de "¡El piso es de lava!": la ciudad se inunda de lava, que sube cada vez más rápido, y hay que
// trepar de edificio en edificio hasta los helicópteros que esperan arriba de la torre más alta.
//
// - Los edificios se ven cortados de costado (con sus habitaciones adentro) y son todos distintos: de
//   colores, anchos, alturas y altos de piso distintos. Hay edificios bajitos y torres gigantes.
// - Cada piso queda demasiado alto para alcanzarlo de un salto: se sube por escaleras, saltando desde los
//   muebles (sillones, camas, roperos, heladeras…), por escaleras de mano y sogas, en ascensores (que
//   llegan como mucho hasta la terraza) o por escaleras de emergencia de afuera, que siempre están rotas
//   en algún piso.
// - Para pasar de un edificio a otro hay puertas: se cruza por tablones, puentes o saltando el hueco.
// - Peligros: partes incendiadas, cables y charcos con cortocircuitos, pisos rotos y tablones que se
//   caen. La gente que camina por los pisos se prende fuego cuando la llega la lava y queda carbonizada.
// - Ganás cuando llegás a uno de los helicópteros de la torre más alta.
//
// Todo se mide en "unidades" (el personaje mide casi una) y en pantalla se muestran metros.

export const M_PER_UNIT = 3;
export const PLAYER_W = 0.6, PLAYER_H = 0.85;
const RUN = 6, CLIMB = 4, MAX_FALL = 18;
export const GRAVITY = 30, JUMP = 12.5;
export const REACH = (JUMP * JUMP) / (2 * GRAVITY); // lo más alto que se llega saltando (unas 2,6 unidades)
export const WALL = 0.3;
export const BURN_T = 2.5; // segundos que una persona arde antes de quedar carbonizada
const DIE_T = 1.6; // lo que dura la animación de perder antes del GAME OVER

// La lava espera unos segundos, después sube despacio y cada vez más rápido (hasta un máximo).
export const LAVA_DELAY = 5, LAVA0 = -1.5;
const LAVA_V0 = 0.3, LAVA_ACC = 0.0045, LAVA_VMAX = 1.05;
export const lavaSpeed = (t: number) => t < LAVA_DELAY ? 0 : Math.min(LAVA_VMAX, LAVA_V0 + LAVA_ACC * (t - LAVA_DELAY));
export function lavaLevel(t: number) {
  const u = Math.max(0, t - LAVA_DELAY), tc = (LAVA_VMAX - LAVA_V0) / LAVA_ACC;
  if (u < tc) return LAVA0 + LAVA_V0 * u + (LAVA_ACC / 2) * u * u;
  return LAVA0 + LAVA_V0 * tc + (LAVA_ACC / 2) * tc * tc + LAVA_VMAX * (u - tc);
}
export const meters = (y: number) => Math.max(0, Math.round(y * M_PER_UNIT));

export type PlatKind = 'street' | 'floor' | 'roof' | 'furniture' | 'step' | 'bridge' | 'plank' | 'landing' | 'balcony' | 'elevator';
export type FurnitureKind = 'sofa' | 'bed' | 'table' | 'desk' | 'dresser' | 'piano' | 'wardrobe' | 'fridge' | 'bookshelf' | 'washer';
export interface Plat {
  id: number; kind: PlatKind; x: number; y: number; w: number; b: number; floor: number;
  furniture?: FurnitureKind; h?: number; elev?: Elevator; dy: number; crumble: number; gone: number; hue: number;
}
export interface Elevator { id: number; b: number; x: number; w: number; y1: number; y2: number; speed: number; dwell: number; phase: number }
export interface Climb { id: number; x: number; y1: number; y2: number; skin: 'ladder' | 'rope' | 'escape' }
export interface Wall { x: number; y1: number; y2: number }
export interface Fire { id: number; x1: number; x2: number; y: number; h: number }
export interface Spark { id: number; x1: number; x2: number; y1: number; y2: number; period: number; on: number; phase: number; kind: 'cable' | 'puddle' }
export interface Person { id: number; b: number; y: number; x1: number; x2: number; speed: number; phase: number; hue: number; look: number; burnAt: number | null }
export interface Heli { id: number; x: number; y: number; w: number; h: number; hover: boolean; ladder?: { x: number; y1: number; y2: number } }
export interface Escape { id: number; b: number; side: -1 | 1; x: number; floors: number[]; broken: number }
export interface Building {
  id: number; x: number; w: number; fh: number; floors: number; top: number; hue: number; tone: number; tower: boolean;
  doors: { left: Set<number>; right: Set<number> }; holes: { floor: number; x1: number; x2: number }[];
}
export type LinkMode = 'walk' | 'jump' | 'stairs' | 'climb' | 'elevator';
export interface Link { from: number; to: number; mode: LinkMode; dy: number; edge: number; fromX: number; toX: number; fromY: number; toY: number; cost: number }
export interface Player { x: number; y: number; vx: number; vy: number; facing: 1 | -1; ground: Plat | null; climb: Climb | null; climbCooldown: number; coyote: number }
export interface Input { left: boolean; right: boolean; jump: boolean; down: boolean }
export type LoseReason = 'lava' | 'fire' | 'zap';
export type LavaEvent =
  | { type: 'jump' } | { type: 'crumble' } | { type: 'burn' } | { type: 'faster'; level: number } | { type: 'heli' }
  | { type: 'lose'; reason: LoseReason } | { type: 'gameover' } | { type: 'win' };
export interface City {
  width: number; buildings: Building[]; plats: Plat[]; climbs: Climb[]; walls: Wall[]; fires: Fire[]; sparks: Spark[];
  people: Person[]; helis: Heli[]; elevators: Elevator[]; escapes: Escape[]; links: Link[]; start: { x: number; plat: number };
}
export interface LavaGame extends City {
  player: Player; time: number; lava: number; bestGround: number; won: boolean; nearHeli: boolean; speedLevel: number;
  dying: { t: number; reason: LoseReason } | null; over: boolean; events: LavaEvent[];
}

export const sparkActive = (s: Spark, t: number) => ((t + s.phase) % s.period) < s.period * s.on;
export const sparkWarning = (s: Spark, t: number) => ((t + s.phase) % s.period) / s.period > 0.8;
export function elevatorY(e: Elevator, t: number) {
  const travel = (e.y2 - e.y1) / e.speed, P = 2 * (travel + e.dwell);
  let u = (((t + e.phase) % P) + P) % P;
  if (u < e.dwell) return e.y1;
  u -= e.dwell;
  if (u < travel) return e.y1 + u * e.speed;
  u -= travel;
  if (u < e.dwell) return e.y2;
  return e.y2 - (u - e.dwell) * e.speed;
}
// La gente camina de un lado al otro; cuando la lava la alcanza corre desesperada, arde y queda carbonizada.
export function personX(p: Person, t: number) {
  const until = p.burnAt === null ? t : Math.min(t, p.burnAt + BURN_T);
  const fast = p.burnAt === null ? 0 : Math.max(0, until - p.burnAt) * 1.8; // al prenderse fuego corre
  const span = p.x2 - p.x1, k = ((((until * p.speed + fast) / span + p.phase) % 2) + 2) % 2;
  return { x: p.x1 + (k < 1 ? k : 2 - k) * span, dir: (k < 1 ? 1 : -1) as 1 | -1 };
}
export const personState = (p: Person, t: number) => p.burnAt === null ? 'calm' : t - p.burnAt < BURN_T ? 'burning' : 'charred';
export const floorY = (b: Building, k: number) => k * b.fh;

// ---------- La ciudad ----------
// Pisos de cada edificio, de izquierda a derecha: el último es la torre más alta (la de los helicópteros).
const FLOORS = [6, 9, 5, 12, 8, 15, 10, 18, 13, 21, 16, 26];
const FURNITURE: { kind: FurnitureKind; h: number }[] = [
  { kind: 'sofa', h: 0.95 }, { kind: 'bed', h: 0.85 }, { kind: 'table', h: 1 }, { kind: 'desk', h: 1.05 }, { kind: 'dresser', h: 1.2 },
  { kind: 'piano', h: 1.25 }, { kind: 'washer', h: 1.1 }, { kind: 'wardrobe', h: 1.6 }, { kind: 'fridge', h: 1.55 }, { kind: 'bookshelf', h: 1.45 },
];

export function buildCity(seed = 20261006): City {
  let s = seed;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const between = (a: number, b: number) => a + rand() * (b - a);
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
  let id = 1;
  const city: City = { width: 0, buildings: [], plats: [], climbs: [], walls: [], fires: [], sparks: [], people: [], helis: [], elevators: [], escapes: [], links: [], start: { x: 0, plat: 0 } };
  const { buildings, plats, climbs, walls, fires, sparks, people, helis, elevators, escapes, links } = city;

  // 1) Edificios y huecos entre ellos (callecitas angostas o pasillos con escalera de emergencia).
  let x = 3;
  const gaps: { kind: 'narrow' | 'alley'; w: number; escapeSide: -1 | 1 }[] = [];
  FLOORS.forEach((floors, i) => {
    const tower = i === FLOORS.length - 1;
    const w = tower ? 13 : between(7.6, 11.2);
    const fh = tower ? 3.1 : between(2.95, 3.3);
    buildings.push({ id: i, x, w, fh, floors, top: floors * fh, hue: Math.floor(rand() * 360), tone: rand(), tower, doors: { left: new Set([0]), right: new Set([0]) }, holes: [] });
    if (tower) return;
    const alley = rand() < 0.45;
    const gap = alley ? between(3, 3.35) : between(1.5, 2.05);
    gaps.push({ kind: alley ? 'alley' : 'narrow', w: gap, escapeSide: rand() < 0.5 ? -1 : 1 });
    x += w + gap;
  });
  const last = buildings[buildings.length - 1];
  city.width = last.x + last.w + 4;
  const street: Plat = { id: id++, kind: 'street', x: 0, y: 0, w: city.width, b: -1, floor: 0, dy: 0, crumble: 0, gone: 0, hue: 0 };
  plats.push(street);
  city.start = { x: buildings[0].x + 1.4, plat: street.id };

  // Lugares ocupados de cada piso (para que no se pisen las cosas entre sí).
  const used = new Map<string, [number, number][]>();
  const key = (b: number, k: number) => `${b}:${k}`;
  const reserve = (b: number, k: number, x1: number, x2: number) => { const l = used.get(key(b, k)) ?? []; l.push([x1, x2]); used.set(key(b, k), l); };
  const free = (b: number, k: number, x1: number, x2: number) => !(used.get(key(b, k)) ?? []).some(([a, c]) => x2 > a && x1 < c);
  const inner = (b: Building) => [b.x + WALL + 0.2, b.x + b.w - WALL - 0.2] as const;
  // Junto a las paredes queda libre (puertas): las cosas van del medio para adentro.
  for (const b of buildings) for (let k = 0; k <= b.floors; k++) { const [a, c] = inner(b); reserve(b.id, k, a - 1, a + 0.9); reserve(b.id, k, c - 0.9, c + 1); }
  const spot = (b: Building, ks: number[], span: number, tries = 40) => {
    const [a, c] = inner(b);
    for (let i = 0; i < tries; i++) {
      const x1 = between(a, c - span);
      if (ks.every(k => free(b.id, k, x1 - 0.25, x1 + span + 0.25))) return x1;
    }
    return null;
  };

  // Lo que se crea mientras se arma (después se convierte en uniones entre plataformas).
  type Proto = { mode: LinkMode; b: number; fromK: number; toK: number; fromX: number; toX: number; fromPlat?: Plat; toPlat?: Plat; cost: number; edge: number };
  const protos: Proto[] = [];

  // 2) Ascensores: suben desde algún piso hasta la terraza (y no más).
  for (const b of buildings) {
    if (b.floors < 7 || rand() > 0.7) continue;
    const from = Math.floor(rand() * Math.max(1, Math.floor(b.floors * 0.35)));
    const ks = Array.from({ length: b.floors - from + 1 }, (_, i) => from + i);
    const ex = spot(b, ks, 1.8);
    if (ex === null) continue;
    for (const k of ks) reserve(b.id, k, ex - 0.4, ex + 2.2);
    const e: Elevator = { id: id++, b: b.id, x: ex, w: 1.8, y1: floorY(b, from), y2: b.top, speed: between(1.9, 2.5), dwell: between(1, 1.6), phase: rand() * 20 };
    elevators.push(e);
    plats.push({ id: id++, kind: 'elevator', x: ex, y: e.y1, w: e.w, b: b.id, floor: from, elev: e, dy: 0, crumble: 0, gone: 0, hue: b.hue });
    const travel = (e.y2 - e.y1) / e.speed;
    for (const k of ks) for (const k2 of ks) if (k2 > k) protos.push({ mode: 'elevator', b: b.id, fromK: k, toK: k2, fromX: ex + 0.9, toX: ex + 0.9, cost: travel + e.dwell * 2 + (floorY(b, k2) - floorY(b, k)) / e.speed, edge: 0 });
  }

  // 3) Cómo se sube de cada piso al siguiente adentro de cada edificio (siempre hay al menos una forma).
  for (const b of buildings) {
    for (let k = 0; k < b.floors; k++) {
      const y0 = floorY(b, k), y1 = floorY(b, k + 1);
      const ways: string[] = [];
      const want = 1 + (rand() < 0.4 ? 1 : 0);
      const order = [...(b.w > 8.6 ? ['stairs', 'stairs'] : []), 'furniture', 'furniture', 'ladder', 'rope'];
      for (let tries = 0; ways.length < want && tries < 12; tries++) {
        const way = pick(order);
        if (way === 'stairs') {
          const n = Math.ceil(b.fh / 0.42), rise = b.fh / n, run = 0.62, span = n * run;
          const x1 = spot(b, [k], span + 0.6);
          if (x1 === null || !free(b.id, k + 1, x1 + span - 0.8, x1 + span + 1.4)) continue;
          const dir = rand() < 0.5 ? 1 : -1;
          const start = dir > 0 ? x1 + 0.3 : x1 + span + 0.3;
          for (let i = 1; i < n; i++) {
            const left = dir > 0 ? start + i * run - 0.33 : start - i * run - 0.33;
            plats.push({ id: id++, kind: 'step', x: left, y: y0 + i * rise, w: 0.66, b: b.id, floor: k, dy: 0, crumble: 0, gone: 0, hue: b.hue });
          }
          reserve(b.id, k, x1, x1 + span + 0.6);
          const endX = dir > 0 ? start + n * run : start - n * run;
          reserve(b.id, k + 1, endX - 1, endX + 1);
          protos.push({ mode: 'stairs', b: b.id, fromK: k, toK: k + 1, fromX: start, toX: endX, cost: span / RUN + 0.3, edge: 0 });
        } else if (way === 'furniture') {
          const need = b.fh - (REACH - 0.25); // tiene que ser bastante alto para llegar al piso de arriba
          const options = FURNITURE.filter(f => f.h >= need);
          const f = pick(options.length ? options : FURNITURE.slice(-3));
          const fw = f.kind === 'bed' || f.kind === 'sofa' || f.kind === 'piano' ? between(1.8, 2.3) : between(1.2, 1.6);
          const x1 = spot(b, [k], fw + 0.5);
          if (x1 === null || !free(b.id, k + 1, x1 - 0.6, x1 + fw + 0.6)) continue;
          const p: Plat = { id: id++, kind: 'furniture', furniture: f.kind, h: f.h, x: x1 + 0.25, y: y0 + f.h, w: fw, b: b.id, floor: k, dy: 0, crumble: 0, gone: 0, hue: Math.floor(rand() * 360) };
          plats.push(p);
          reserve(b.id, k, x1, x1 + fw + 0.5); reserve(b.id, k + 1, x1 - 0.6, x1 + fw + 0.6);
          protos.push({ mode: 'jump', b: b.id, fromK: k, toK: k, fromX: p.x - 0.3, toX: p.x + 0.3, toPlat: p, cost: 0.6, edge: 0 });
          protos.push({ mode: 'jump', b: b.id, fromK: k + 1, toK: k + 1, fromX: p.x + p.w / 2, toX: p.x + p.w / 2, fromPlat: p, cost: 0.6, edge: 0 });
        } else {
          const lx = spot(b, [k], 1.2);
          if (lx === null || !free(b.id, k + 1, lx - 0.7, lx + 1.9)) continue;
          climbs.push({ id: id++, x: lx + 0.6, y1: y0 + 0.05, y2: y1 + 0.3, skin: way === 'rope' ? 'rope' : 'ladder' });
          reserve(b.id, k, lx, lx + 1.2); reserve(b.id, k + 1, lx - 0.7, lx + 1.9);
          protos.push({ mode: 'climb', b: b.id, fromK: k, toK: k + 1, fromX: lx + 0.6, toX: lx + 0.6, cost: b.fh / CLIMB + 0.5, edge: 0 });
        }
        ways.push(way);
      }
      if (!ways.length) { // si no entró nada, una soga en cualquier lado libre
        const [a, c] = inner(b);
        const lx = (a + c) / 2 + between(-1, 1);
        climbs.push({ id: id++, x: lx, y1: y0 + 0.05, y2: y1 + 0.3, skin: 'rope' });
        protos.push({ mode: 'climb', b: b.id, fromK: k, toK: k + 1, fromX: lx, toX: lx, cost: b.fh / CLIMB + 0.5, edge: 0 });
      }
    }
  }

  // 4) Escaleras de emergencia en los pasillos: descansos en cada piso unidos por escaleras de mano,
  //    rotas en algún piso (nunca llegan hasta arriba).
  const landingsOf = new Map<number, { k: number; plat: Plat; edge: number }[]>(); // edificio → descansos
  gaps.forEach((gap, i) => {
    if (gap.kind !== 'alley') return;
    const b = gap.escapeSide < 0 ? buildings[i] : buildings[i + 1];
    const side: -1 | 1 = gap.escapeSide < 0 ? 1 : -1; // del lado del pasillo
    const broken = Math.max(2, Math.min(b.floors - 1, Math.floor(b.floors * between(0.45, 0.85))));
    const lw = 1.3;
    const lx = side > 0 ? b.x + b.w : b.x - lw;
    const esc: Escape = { id: id++, b: b.id, side, x: lx, floors: [], broken };
    const list: { k: number; plat: Plat; edge: number }[] = [];
    for (let k = 1; k <= broken; k++) {
      const p: Plat = { id: id++, kind: 'landing', x: lx, y: floorY(b, k), w: lw, b: b.id, floor: k, dy: 0, crumble: 0, gone: 0, hue: b.hue };
      plats.push(p); esc.floors.push(k);
      list.push({ k, plat: p, edge: side > 0 ? lx + lw : lx });
      (side > 0 ? b.doors.right : b.doors.left).add(k);
      protos.push({ mode: 'walk', b: b.id, fromK: k, toK: k, fromX: side > 0 ? b.x + b.w - 0.5 : b.x + 0.5, toX: lx + lw / 2, toPlat: p, cost: 0.3, edge: 0 });
      protos.push({ mode: 'walk', b: b.id, fromK: k, toK: k, fromPlat: p, fromX: lx + lw / 2, toX: side > 0 ? b.x + b.w - 0.5 : b.x + 0.5, cost: 0.3, edge: 0 });
    }
    const cx = side > 0 ? lx + lw - 0.35 : lx + 0.35;
    climbs.push({ id: id++, x: cx, y1: 0.05, y2: floorY(b, 1) + 0.3, skin: 'escape' });
    for (let j = 0; j + 1 < list.length; j++) {
      climbs.push({ id: id++, x: cx, y1: list[j].plat.y + 0.05, y2: list[j + 1].plat.y + 0.3, skin: 'escape' });
      protos.push({ mode: 'climb', b: b.id, fromK: list[j].k, toK: list[j + 1].k, fromPlat: list[j].plat, toPlat: list[j + 1].plat, fromX: cx, toX: cx, cost: b.fh / CLIMB + 0.5, edge: 0 });
    }
    escapes.push(esc);
    landingsOf.set(i, list);
  });

  // 5) Uniones entre edificios vecinos: puertas enfrentadas (aberturas de todo el alto del piso), tablones,
  //    puentes y saltos. Siempre hay varias, a distintas alturas, y al menos una bien arriba.
  type Exit = { k: number; y: number; edge: number; landing?: Plat };
  type Crossing = { a: Building; b: Building; from: Exit; to: Exit; kind: 'jump' | 'bridge' | 'plank' };
  const crossings: Crossing[] = [];
  const canJump = (ea: Exit, eb: Exit) => { const dy = eb.y - ea.y; return eb.edge - ea.edge <= 2.15 && dy >= -1.2 && dy <= 1.5; };
  const canBridge = (ea: Exit, eb: Exit) => !ea.landing && !eb.landing && Math.abs(eb.y - ea.y) <= 0.45;
  gaps.forEach((gap, i) => {
    const A = buildings[i], B = buildings[i + 1];
    const landings = landingsOf.get(i) ?? [];
    const escOnA = gap.kind === 'alley' && gap.escapeSide < 0, escOnB = gap.kind === 'alley' && gap.escapeSide > 0;
    const exitsA: Exit[] = [], entriesB: Exit[] = [];
    for (let k = 1; k <= A.floors; k++) exitsA.push({ k, y: floorY(A, k), edge: A.x + A.w });
    if (escOnA) for (const l of landings) exitsA.push({ k: l.k, y: l.plat.y, edge: l.edge, landing: l.plat });
    for (let k = 1; k <= B.floors; k++) entriesB.push({ k, y: floorY(B, k), edge: B.x });
    if (escOnB) for (const l of landings) entriesB.push({ k: l.k, y: l.plat.y, edge: l.edge, landing: l.plat });
    const chosen: Crossing[] = [];
    const tryExit = (ea: Exit, force: boolean) => {
      const bridges = entriesB.filter(eb => canBridge(ea, eb)), jumps = entriesB.filter(eb => canJump(ea, eb));
      const r = force ? (bridges.length ? 0 : 0.5) : rand();
      if (bridges.length && r < 0.32) { chosen.push({ a: A, b: B, from: ea, to: bridges[0], kind: rand() < 0.35 ? 'plank' : 'bridge' }); return true; }
      if (jumps.length && r < 0.75) {
        const eb = jumps.reduce((best, o) => Math.abs(o.y - ea.y - 0.5) < Math.abs(best.y - ea.y - 0.5) ? o : best);
        chosen.push({ a: A, b: B, from: ea, to: eb, kind: 'jump' }); return true;
      }
      if (force && !ea.landing) { // puente en pendiente hasta el piso más parecido
        const eb = entriesB.filter(o => !o.landing && o.y - ea.y <= 1.5 && o.y - ea.y >= -1.2)[0];
        if (eb) { chosen.push({ a: A, b: B, from: ea, to: eb, kind: 'bridge' }); return true; }
      }
      return false;
    };
    for (const ea of exitsA) tryExit(ea, false);
    // Garantías: una unión en la parte de arriba del más bajito de los dos y al menos tres en total.
    const high = Math.min(A.top, B.top) * 0.62;
    if (!chosen.some(c => c.from.y >= high)) for (const ea of [...exitsA].filter(e => e.y >= high).reverse()) if (tryExit(ea, true)) break;
    for (const ea of [...exitsA].reverse()) { if (chosen.length >= 3) break; if (!chosen.some(c => c.from === ea)) tryExit(ea, true); }
    crossings.push(...chosen);
  });
  for (const c of crossings) {
    const ya = c.from.y, yb = c.to.y;
    if (!c.from.landing && c.from.k < c.a.floors) c.a.doors.right.add(c.from.k);
    if (!c.to.landing && c.to.k < c.b.floors) c.b.doors.left.add(c.to.k);
    const gapW = c.to.edge - c.from.edge;
    type P2 = Proto & { bTo: number };
    if (c.kind === 'jump') {
      protos.push({ mode: 'jump', b: c.a.id, bTo: c.b.id, fromK: c.from.k, toK: c.to.k, fromPlat: c.from.landing, toPlat: c.to.landing, fromX: c.from.edge - 0.3, toX: c.to.edge + 0.4, cost: 0.7, edge: gapW } as P2);
      if (ya - yb <= 1.5) protos.push({ mode: 'jump', b: c.b.id, bTo: c.a.id, fromK: c.to.k, toK: c.from.k, fromPlat: c.to.landing, toPlat: c.from.landing, fromX: c.to.edge + 0.3, toX: c.from.edge - 0.4, cost: 0.7, edge: gapW } as P2);
    } else {
      // El tablón queda a la altura del más alto de los dos pisos (al otro se sube o se baja de un paso o un salto).
      const y = Math.max(ya, yb);
      const p: Plat = { id: id++, kind: c.kind, x: c.from.edge - 0.15, y, w: gapW + 0.3, b: -1, floor: c.from.k, dy: 0, crumble: 0, gone: 0, hue: Math.floor(rand() * 360) };
      plats.push(p);
      protos.push({ mode: y - ya > 0.6 ? 'jump' : 'walk', b: c.a.id, fromK: c.from.k, toK: c.from.k, toPlat: p, fromX: c.from.edge - 0.4, toX: p.x + 0.3, cost: 0.3, edge: 0 });
      protos.push({ mode: y - yb > 0.6 ? 'jump' : 'walk', b: c.b.id, fromK: c.to.k, toK: c.to.k, fromPlat: p, fromX: p.x + p.w - 0.3, toX: c.to.edge + 0.5, cost: 0.3, edge: 0 });
      protos.push({ mode: y - yb > 0.6 ? 'jump' : 'walk', b: c.b.id, fromK: c.to.k, toK: c.to.k, toPlat: p, fromX: c.to.edge + 0.5, toX: p.x + p.w - 0.3, cost: 0.3, edge: 0 });
      protos.push({ mode: 'walk', b: c.a.id, fromK: c.from.k, toK: c.from.k, fromPlat: p, fromX: p.x + 0.3, toX: c.from.edge - 0.4, cost: 0.3, edge: 0 });
    }
  }

  // 6) Peligros adentro: partes incendiadas, cables pelados y charcos con cortocircuitos (nunca en la
  //    planta baja, donde arrancás).
  for (const b of buildings) {
    for (let k = 1; k < b.floors; k++) {
      const y0 = floorY(b, k), y1 = floorY(b, k + 1);
      if (rand() < 0.3) {
        const fw = between(0.7, 1.3), fx = spot(b, [k], fw + 0.4, 12);
        if (fx !== null) { fires.push({ id: id++, x1: fx + 0.2, x2: fx + 0.2 + fw, y: y0, h: between(0.9, 1.3) }); reserve(b.id, k, fx, fx + fw + 0.4); }
      }
      if (rand() < 0.2) {
        const fx = spot(b, [k], 0.9, 12);
        if (fx !== null) { sparks.push({ id: id++, kind: 'cable', x1: fx + 0.2, x2: fx + 0.7, y1: y1 - 1.75, y2: y1, period: between(1.6, 2.4), on: 0.45, phase: rand() * 3 }); reserve(b.id, k, fx, fx + 0.9); }
      } else if (rand() < 0.16) {
        const pw = between(1, 1.5), fx = spot(b, [k], pw + 0.4, 12);
        if (fx !== null) { sparks.push({ id: id++, kind: 'puddle', x1: fx + 0.2, x2: fx + 0.2 + pw, y1: y0, y2: y0 + 0.35, period: between(1.8, 2.6), on: 0.4, phase: rand() * 3 }); reserve(b.id, k, fx, fx + pw + 0.4); }
      }
    }
  }

  // 7) Pisos rotos: agujeros en el piso (no donde se llega ni de donde se sale).
  for (const b of buildings) {
    for (let k = 1; k < b.floors; k++) {
      if (rand() > 0.2) continue;
      const hw = between(1.1, 1.5), hx = spot(b, [k, k - 1], hw, 10);
      if (hx !== null) { b.holes.push({ floor: k, x1: hx, x2: hx + hw }); reserve(b.id, k, hx - 0.2, hx + hw + 0.2); }
    }
  }

  // 8) Losas de cada piso (partidas donde hay agujeros) y terrazas.
  const floorPlats = new Map<string, Plat[]>();
  floorPlats.set('street', [street]);
  for (const b of buildings) {
    floorPlats.set(key(b.id, 0), [street]);
    for (let k = 1; k <= b.floors; k++) {
      const roof = k === b.floors;
      const x1 = roof ? b.x - 0.15 : b.x, x2 = roof ? b.x + b.w + 0.15 : b.x + b.w;
      const holes = b.holes.filter(h => h.floor === k).sort((p, q) => p.x1 - q.x1);
      const parts: Plat[] = [];
      let from = x1;
      for (const h of [...holes, { x1: x2, x2: x2 }]) {
        if (h.x1 - from > 0.2) parts.push({ id: id++, kind: roof ? 'roof' : 'floor', x: from, y: floorY(b, k), w: h.x1 - from, b: b.id, floor: k, dy: 0, crumble: 0, gone: 0, hue: b.hue });
        from = h.x2;
      }
      plats.push(...parts);
      floorPlats.set(key(b.id, k), parts);
      for (let j = 0; j + 1 < parts.length; j++) { // los agujeros se cruzan saltando
        const p = parts[j], q = parts[j + 1], edge = q.x - (p.x + p.w);
        links.push({ from: p.id, to: q.id, mode: 'jump', dy: 0, edge, fromX: p.x + p.w - 0.3, toX: q.x + 0.3, fromY: p.y, toY: q.y, cost: 0.6 });
        links.push({ from: q.id, to: p.id, mode: 'jump', dy: 0, edge, fromX: q.x + 0.3, toX: p.x + p.w - 0.3, fromY: q.y, toY: p.y, cost: 0.6 });
      }
    }
  }
  const platAt = (b: number, k: number, x: number) => {
    const list = floorPlats.get(key(b, k)) ?? [];
    return list.find(p => x >= p.x - 0.05 && x <= p.x + p.w + 0.05) ?? list.reduce((best, p) => Math.abs(p.x + p.w / 2 - x) < Math.abs(best.x + best.w / 2 - x) ? p : best, list[0]);
  };
  for (const pr of protos) {
    const bTo = (pr as Proto & { bTo?: number }).bTo ?? pr.b;
    const from = pr.fromPlat ?? platAt(pr.b, pr.fromK, pr.fromX);
    const to = pr.toPlat ?? platAt(bTo, pr.toK, pr.toX);
    if (!from || !to || from === to) continue;
    const fromY = from.kind === 'elevator' ? floorY(buildings[pr.b], pr.fromK) : from.y;
    const toY = to.kind === 'elevator' ? floorY(buildings[pr.b], pr.toK) : to.y;
    links.push({ from: from.id, to: to.id, mode: pr.mode, dy: toY - fromY, edge: pr.edge, fromX: pr.fromX, toX: pr.toX, fromY, toY, cost: pr.cost });
  }

  // 9) Paredes de cada piso, con las puertas abiertas (la terraza no tiene paredes).
  for (const b of buildings) {
    for (const [side, xw] of [['left', b.x + WALL / 2], ['right', b.x + b.w - WALL / 2]] as const) {
      for (let k = 0; k < b.floors; k++) {
        const y0 = floorY(b, k), y1 = floorY(b, k + 1);
        if (!b.doors[side].has(k)) walls.push({ x: xw, y1: y0, y2: y1 }); // con puerta, ese piso queda abierto
      }
    }
  }

  // 10) Gente caminando por los pisos.
  for (const b of buildings) {
    const [a, c] = inner(b);
    for (let k = 0; k < b.floors; k++) {
      if (rand() > (k === 0 ? 0.7 : 0.4)) continue;
      const x1 = a + 0.3, x2 = c - 0.3;
      people.push({ id: id++, b: b.id, y: floorY(b, k), x1, x2, speed: between(0.6, 1.3), phase: rand() * 2, hue: Math.floor(rand() * 360), look: rand(), burnAt: null });
    }
    // y alguno en la terraza
    if (rand() < 0.5) people.push({ id: id++, b: b.id, y: b.top, x1: b.x + 0.5, x2: b.x + b.w - 0.5, speed: between(0.6, 1.1), phase: rand() * 2, hue: Math.floor(rand() * 360), look: rand(), burnAt: null });
  }

  // 11) Helicópteros: uno aterrizado en la terraza de la torre y otro volando al costado con una escalera
  //     colgante que llega hasta un balcón tres pisos más abajo.
  const tower = last;
  helis.push({ id: id++, x: tower.x + tower.w * 0.5 - 1.9, y: tower.top, w: 3.8, h: 1.6, hover: false });
  const kb = tower.floors - 3, by = floorY(tower, kb);
  const balcony: Plat = { id: id++, kind: 'balcony', x: tower.x + tower.w, y: by, w: 1.4, b: tower.id, floor: kb, dy: 0, crumble: 0, gone: 0, hue: tower.hue };
  plats.push(balcony);
  tower.doors.right.add(kb);
  links.push({ from: platAt(tower.id, kb, tower.x + tower.w - 0.5).id, to: balcony.id, mode: 'walk', dy: 0, edge: 0, fromX: tower.x + tower.w - 0.5, toX: balcony.x + 0.5, fromY: by, toY: by, cost: 0.3 });
  helis.push({ id: id++, x: tower.x + tower.w + 0.4, y: tower.top + 2.2, w: 3.6, h: 1.5, hover: true, ladder: { x: tower.x + tower.w + 1.1, y1: by + 0.3, y2: tower.top + 2.2 } });
  // Las paredes ya se armaron antes: se saca la de ese piso para que quede la puerta al balcón.
  const idx = walls.findIndex(w => Math.abs(w.x - (tower.x + tower.w - WALL / 2)) < 1e-6 && Math.abs(w.y1 - by) < 1e-6);
  if (idx >= 0) walls.splice(idx, 1);
  return city;
}

export function newLava(seed?: number): LavaGame {
  const city = buildCity(seed);
  const street = city.plats.find(p => p.id === city.start.plat)!;
  return {
    ...city, time: 0, lava: LAVA0, bestGround: 0, won: false, nearHeli: false, speedLevel: 0, dying: null, over: false, events: [],
    player: { x: city.start.x, y: 0, vx: 0, vy: 0, facing: 1, ground: street, climb: null, climbCooldown: 0, coyote: 0 },
  };
}

export const towerOf = (c: City) => c.buildings[c.buildings.length - 1];
const overlapsX = (p: Player, pl: Plat) => p.x + PLAYER_W / 2 > pl.x && p.x - PLAYER_W / 2 < pl.x + pl.w;
const hitsBox = (p: Player, x1: number, x2: number, y1: number, y2: number) => p.x + PLAYER_W / 2 > x1 && p.x - PLAYER_W / 2 < x2 && p.y + PLAYER_H > y1 && p.y < y2;

function lose(g: LavaGame, reason: LoseReason) {
  const p = g.player;
  g.dying = { t: 0, reason };
  p.climb = null; p.vx = 0;
  if (reason !== 'lava') { p.vy = 6; p.ground = null; }
  g.events.push({ type: 'lose', reason });
}

// Paredes: no se pueden atravesar de costado (solo por las puertas).
function moveX(g: LavaGame, p: Player, nx: number) {
  const y1 = p.y + 0.05, y2 = p.y + PLAYER_H - 0.05, half = PLAYER_W / 2 + WALL / 2;
  for (const w of g.walls) {
    if (w.y2 <= y1 || w.y1 >= y2) continue;
    if (p.x <= w.x - half + 1e-6 && nx > w.x - half) nx = w.x - half;
    else if (p.x >= w.x + half - 1e-6 && nx < w.x + half) nx = w.x + half;
  }
  return Math.max(PLAYER_W / 2, Math.min(g.width - PLAYER_W / 2, nx));
}

export function step(g: LavaGame, input: Input, dt: number) {
  if (dt <= 0 || g.won || g.over) return;
  dt = Math.min(dt, 0.05);
  g.time += dt;
  const t = g.time;
  g.lava = lavaLevel(t);
  const level = Math.floor(lavaSpeed(t) / 0.25);
  if (level > g.speedLevel) { g.speedLevel = level; if (level >= 2) g.events.push({ type: 'faster', level }); }

  // La gente que alcanza la lava se prende fuego.
  for (const person of g.people) if (person.burnAt === null && g.lava >= person.y + 0.15) { person.burnAt = t; g.events.push({ type: 'burn' }); }
  // Ascensores y tablones que se caen.
  for (const pl of g.plats) {
    if (pl.elev) { const y = elevatorY(pl.elev, t); pl.dy = y - pl.y; pl.y = y; continue; }
    if (pl.gone > 0) { pl.gone -= dt; if (pl.gone <= 0) { pl.gone = 0; pl.crumble = 0; } }
    else if (pl.crumble > 0) { pl.crumble += dt; if (pl.crumble > 0.7) { pl.gone = 3.5; if (g.player.ground === pl) g.player.ground = null; } }
  }

  const p = g.player;
  if (g.dying) {
    g.dying.t += dt;
    if (g.dying.reason === 'lava') p.y = Math.max(g.lava - PLAYER_H * 0.7, p.y - dt * 0.6); // se hunde en la lava
    else { p.vy = Math.max(-MAX_FALL, p.vy - GRAVITY * dt); p.y = Math.max(g.lava - PLAYER_H * 0.7, p.y + p.vy * dt); }
    if (g.dying.t > DIE_T) { g.over = true; g.events.push({ type: 'gameover' }); }
    return;
  }

  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir) p.facing = dir > 0 ? 1 : -1;
  p.climbCooldown = Math.max(0, p.climbCooldown - dt);

  if (p.climb) {
    const c = p.climb;
    if (dir) { p.vx = dir * 5; p.vy = 8; p.climb = null; p.climbCooldown = 0.4; g.events.push({ type: 'jump' }); }
    else {
      p.y += (input.jump ? CLIMB : input.down ? -CLIMB : 0) * dt;
      if (p.y >= c.y2 && input.jump) { p.y = c.y2; p.vy = 10; p.vx = 0; p.climb = null; p.climbCooldown = 0.5; }
      else if (p.y <= c.y1 - 0.1 && input.down) { p.climb = null; p.climbCooldown = 0.5; }
      else { p.y = Math.max(c.y1 - 0.1, Math.min(c.y2, p.y)); hazards(g, t); finish(g); return; }
    }
  }

  p.vx = dir * RUN;
  p.x = moveX(g, p, p.x + p.vx * dt);
  if (p.ground) p.y = p.ground.y;

  // Escalones bajitos (y bajar de un tablón al piso de al lado): se suben caminando.
  if (p.ground && dir) {
    const stepUp = g.plats.find(pl => !pl.gone && pl !== p.ground && pl.y > p.y + 0.01 && pl.y <= p.y + 0.6 && overlapsX(p, pl));
    if (stepUp) landOn(g, stepUp);
  }
  // El ascensor que sube te levanta si estás parado donde pasa.
  if (p.ground && !p.ground.elev) {
    const car = g.plats.find(pl => pl.elev && overlapsX(p, pl) && pl.y >= p.y - 0.01 && pl.y - pl.dy <= p.y + 0.02 && pl.dy > 0);
    if (car) { p.ground = car; p.y = car.y; }
  }

  if (p.ground && (!overlapsX(p, p.ground) || p.ground.gone > 0)) { p.ground = null; p.coyote = 0.1; p.vy = 0; }
  p.coyote = Math.max(0, p.coyote - dt);
  if (input.jump && (p.ground || p.coyote > 0)) {
    p.vy = JUMP; p.ground = null; p.coyote = 0;
    g.events.push({ type: 'jump' });
  }

  // Agarrarse de una escalera o soga (en el aire, manteniendo saltar).
  if (!p.ground && input.jump && !p.climbCooldown) {
    const c = g.climbs.find(c => Math.abs(p.x - c.x) < 0.5 && p.y + PLAYER_H * 0.6 > c.y1 && p.y < c.y2);
    if (c) { p.climb = c; p.x = c.x; p.vx = 0; p.vy = 0; hazards(g, t); finish(g); return; }
  }

  if (!p.ground) {
    const prev = p.y;
    p.vy = Math.max(-MAX_FALL, p.vy - GRAVITY * dt);
    p.y += p.vy * dt;
    if (p.vy <= 0) {
      const land = g.plats.find(pl => !pl.gone && overlapsX(p, pl) && prev >= pl.y - Math.max(0, pl.dy) - 0.02 && p.y <= pl.y);
      if (land) landOn(g, land);
    }
  }
  hazards(g, t);
  finish(g);
}

function hazards(g: LavaGame, t: number) {
  const p = g.player;
  if (g.dying) return;
  if (p.y < g.lava + 0.1) { lose(g, 'lava'); return; }
  for (const f of g.fires) if (hitsBox(p, f.x1 + 0.1, f.x2 - 0.1, f.y, f.y + f.h)) { lose(g, 'fire'); return; }
  for (const s of g.sparks) if (sparkActive(s, t) && hitsBox(p, s.x1, s.x2, s.y1, s.y2)) { lose(g, 'zap'); return; }
}

function landOn(g: LavaGame, pl: Plat) {
  const p = g.player;
  p.y = pl.y; p.vy = 0; p.ground = pl;
  g.bestGround = Math.max(g.bestGround, pl.kind === 'elevator' ? 0 : pl.y);
  if (pl.kind === 'plank' && !pl.crumble) { pl.crumble = 0.001; g.events.push({ type: 'crumble' }); }
}

function finish(g: LavaGame) {
  const p = g.player;
  if (g.dying) return;
  if (p.ground?.elev) g.bestGround = Math.max(g.bestGround, p.y);
  // ¿Llegó a un helicóptero (o a su escalera colgante)?
  for (const h of g.helis) {
    const touch = hitsBox(p, h.x, h.x + h.w, h.y, h.y + h.h) || (h.ladder && hitsBox(p, h.ladder.x - 0.3, h.ladder.x + 0.3, h.ladder.y1, h.ladder.y2));
    if (touch) { g.won = true; g.events.push({ type: 'win' }); return; }
  }
  const tower = towerOf(g);
  if (!g.nearHeli && p.x > tower.x - 2 && p.y > tower.top - 4 * tower.fh) { g.nearHeli = true; g.events.push({ type: 'heli' }); }
}

export const takeEvents = (g: LavaGame) => g.events.splice(0);
