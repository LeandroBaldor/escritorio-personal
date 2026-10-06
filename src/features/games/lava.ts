// Lógica de "¡El piso es de lava!": la ciudad se inunda de lava, que sube cada vez más rápido, y hay que
// trepar de edificio en edificio hasta los helicópteros que aterrizan arriba de la torre más alta.
//
// - Los edificios se ven cortados de costado (con sus habitaciones adentro) y son todos distintos: de
//   colores, anchos, alturas y altos de piso distintos. Hay edificios bajitos, torres gigantes, edificios
//   en construcción (sin paredes, con ladrillos y bolsas de cemento) y edificios rotos cuya parte de
//   arriba se cayó y quedó inclinada contra el de al lado (se sube caminando por encima).
// - Cada piso queda demasiado alto para alcanzarlo de un salto: se sube por escaleras, saltando desde los
//   muebles (sillones, camas, roperos, heladeras…), por escaleras de mano y sogas (por las que se sube y
//   se baja), en ascensores (que paran en cada piso y llegan como mucho hasta la terraza) o por escaleras
//   de emergencia de afuera, que siempre están rotas en algún piso.
// - Para pasar de un edificio a otro hay puertas a los costados de los departamentos (algunas con
//   balconcito): se cruza por tablones, puentes, saltando el hueco, rebotando en camas elásticas,
//   colgándose de tirolesas o subiendo por los edificios caídos.
// - Peligros: departamentos incendiados, cables y charcos con cortocircuitos, pisos rotos y tablones que
//   se caen. La gente que camina por los pisos se prende fuego cuando la llega la lava y queda carbonizada.
// - Tres helicópteros aterrizan, esperan 5 segundos, vuelven al aire unos 30 segundos y vuelven a
//   aterrizar. Ganás cuando te subís a uno mientras está aterrizado.
// - Cada partida arranca en un lugar distinto de la cuadra.
//
// Todo se mide en "unidades" (el personaje mide casi una) y en pantalla se muestran metros.

export const M_PER_UNIT = 3;
export const PLAYER_W = 0.6, PLAYER_H = 0.85;
const RUN = 6, CLIMB = 4, MAX_FALL = 18;
export const GRAVITY = 30, JUMP = 12.5;
export const REACH = (JUMP * JUMP) / (2 * GRAVITY); // lo más alto que se llega saltando (unas 2,6 unidades)
export const WALL = 0.3;
export const BURN_T = 3.2; // segundos que una persona arde antes de quedar carbonizada
const DIE_T = 1.6; // lo que dura la animación de perder antes del GAME OVER
export const BOUNCE = 17.5; // la cama elástica te tira para arriba (unas 5 unidades)
export const ZIP_SPEED = 7, HANG = 1.05; // la tirolesa: velocidad y distancia de las manos a los pies
export const ELEV_STOP = 1.6; // lo que el ascensor se queda con las puertas abiertas en cada piso
// Helicópteros: aterrizados 5 segundos, en el aire 30 (3 para despegar y 3 para aterrizar).
export const HELI_WAIT = 5, HELI_AIR = 30, HELI_MOVE = 3, HELI_PERIOD = HELI_WAIT + HELI_AIR;

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

export type PlatKind = 'street' | 'floor' | 'roof' | 'furniture' | 'step' | 'bridge' | 'plank' | 'landing' | 'balcony' | 'elevator' | 'ramp' | 'trampoline' | 'pad';
export type FurnitureKind =
  | 'sofa' | 'bed' | 'table' | 'desk' | 'dresser' | 'piano' | 'wardrobe' | 'fridge' | 'bookshelf' | 'washer'
  | 'armchair' | 'stove' | 'counter' | 'chair' | 'nightstand' | 'coffeetable' | 'tvstand'
  | 'bricks' | 'cement' | 'pallets' | 'barrels';
export interface Plat {
  id: number; kind: PlatKind; x: number; y: number; w: number; b: number; floor: number;
  furniture?: FurnitureKind; h?: number; elev?: Elevator; dy: number; crumble: number; gone: number; hue: number;
}
export interface Elevator { id: number; b: number; x: number; w: number; y1: number; y2: number; stops: number[]; speed: number; dwell: number; phase: number }
export interface Climb { id: number; x: number; y1: number; y2: number; skin: 'ladder' | 'rope' | 'escape' }
export interface Wall { x: number; y1: number; y2: number }
export interface Fire { id: number; x1: number; x2: number; y: number; h: number }
export interface Spark { id: number; x1: number; x2: number; y1: number; y2: number; period: number; on: number; phase: number; kind: 'cable' | 'puddle' }
export interface Person { id: number; b: number; y: number; x1: number; x2: number; speed: number; phase: number; hue: number; look: number; helmet: boolean; burnAt: number | null }
export interface Heli { id: number; x: number; y: number; w: number; h: number; phase: number; drift: -1 | 1 }
export interface Escape { id: number; b: number; side: -1 | 1; x: number; floors: number[]; broken: number }
export interface Zip { id: number; x1: number; y1: number; x2: number; y2: number }
export interface Fallen { id: number; a: number; b: number; x1: number; y1: number; x2: number; y2: number; thick: number }
export interface Building {
  id: number; x: number; w: number; fh: number; floors: number; top: number; hue: number; tone: number; tower: boolean;
  construction: boolean; broken: boolean; roofDecor: boolean;
  doors: { left: Set<number>; right: Set<number> }; holes: { floor: number; x1: number; x2: number }[];
}
export type LinkMode = 'walk' | 'jump' | 'stairs' | 'climb' | 'elevator' | 'zip' | 'bounce' | 'ramp';
export interface Link { from: number; to: number; mode: LinkMode; dy: number; edge: number; fromX: number; toX: number; fromY: number; toY: number; cost: number }
export interface Player { x: number; y: number; vx: number; vy: number; facing: 1 | -1; ground: Plat | null; climb: Climb | null; zip: Zip | null; climbCooldown: number; coyote: number }
export interface Input { left: boolean; right: boolean; jump: boolean; down: boolean; up: boolean }
export type LoseReason = 'lava' | 'fire' | 'zap';
export type LavaEvent =
  | { type: 'jump' } | { type: 'crumble' } | { type: 'burn' } | { type: 'faster'; level: number } | { type: 'heli' } | { type: 'heliLand' }
  | { type: 'bounce' } | { type: 'zip' }
  | { type: 'lose'; reason: LoseReason } | { type: 'gameover' } | { type: 'win' };
export interface City {
  width: number; buildings: Building[]; plats: Plat[]; climbs: Climb[]; walls: Wall[]; fires: Fire[]; sparks: Spark[];
  people: Person[]; helis: Heli[]; elevators: Elevator[]; escapes: Escape[]; zips: Zip[]; fallens: Fallen[]; links: Link[];
  street: number; starts: { b: number; x1: number; x2: number }[];
}
export interface LavaGame extends City {
  player: Player; start: number; time: number; lava: number; bestGround: number; won: boolean; nearHeli: boolean; speedLevel: number;
  heliLanded: boolean[]; dying: { t: number; reason: LoseReason } | null; over: boolean; events: LavaEvent[];
}

export const sparkActive = (s: Spark, t: number) => ((t + s.phase) % s.period) < s.period * s.on;
export const sparkWarning = (s: Spark, t: number) => ((t + s.phase) % s.period) / s.period > 0.8;

// El ascensor sube parando en cada piso (abre las puertas) hasta la terraza y vuelve a bajar igual.
type Leg = { d: number; y0: number; y1: number; open: boolean };
const legsCache = new WeakMap<Elevator, { legs: Leg[]; period: number }>();
function elevatorLegs(e: Elevator) {
  let cached = legsCache.get(e);
  if (cached) return cached;
  const legs: Leg[] = [], n = e.stops.length;
  for (let i = 0; i < n; i++) {
    legs.push({ d: i === 0 || i === n - 1 ? e.dwell : ELEV_STOP, y0: e.stops[i], y1: e.stops[i], open: true });
    if (i < n - 1) legs.push({ d: (e.stops[i + 1] - e.stops[i]) / e.speed, y0: e.stops[i], y1: e.stops[i + 1], open: false });
  }
  for (let i = n - 1; i > 0; i--) {
    legs.push({ d: (e.stops[i] - e.stops[i - 1]) / e.speed, y0: e.stops[i], y1: e.stops[i - 1], open: false });
    if (i - 1 > 0) legs.push({ d: ELEV_STOP, y0: e.stops[i - 1], y1: e.stops[i - 1], open: true });
  }
  cached = { legs, period: legs.reduce((a, l) => a + l.d, 0) };
  legsCache.set(e, cached);
  return cached;
}
export function elevatorAt(e: Elevator, t: number) {
  const { legs, period } = elevatorLegs(e);
  let u = (((t + e.phase) % period) + period) % period;
  for (const l of legs) {
    if (u < l.d) return { y: l.y0 + (l.y1 - l.y0) * (u / l.d), open: l.open, dir: Math.sign(l.y1 - l.y0) };
    u -= l.d;
  }
  return { y: e.stops[0], open: true, dir: 0 };
}
export const elevatorY = (e: Elevator, t: number) => elevatorAt(e, t).y;
export const elevatorPeriod = (e: Elevator) => elevatorLegs(e).period;

// Helicópteros: aterrizados, despegando, en el aire o aterrizando.
export type HeliPhase = 'landed' | 'up' | 'air' | 'down';
const ease = (k: number) => k * k * (3 - 2 * k);
export function heliState(h: Heli, t: number): { x: number; y: number; phase: HeliPhase; left: number; back: number } {
  const u = (((t + h.phase) % HELI_PERIOD) + HELI_PERIOD) % HELI_PERIOD;
  if (u < HELI_WAIT) return { x: h.x, y: h.y, phase: 'landed', left: HELI_WAIT - u, back: 0 };
  const a = u - HELI_WAIT, back = HELI_AIR - a;
  const lift = a < HELI_MOVE ? ease(a / HELI_MOVE) : back < HELI_MOVE ? ease(back / HELI_MOVE) : 1;
  const x = h.x + h.drift * 4 * lift + Math.sin(t * 0.5 + h.id) * 1.2 * lift;
  const y = h.y + 6.5 * lift + Math.sin(t * 1.7 + h.id) * 0.25 * lift;
  return { x, y, phase: a < HELI_MOVE ? 'up' : back < HELI_MOVE ? 'down' : 'air', left: 0, back };
}
// Segundos que faltan para que el helicóptero esté aterrizado (0 si ya lo está).
export const nextLanding = (h: Heli, t: number) => { const s = heliState(h, t); return s.phase === 'landed' ? 0 : s.back; };

// La gente camina de un lado al otro; cuando la lava la alcanza corre desesperada, arde y queda carbonizada.
export function personX(p: Person, t: number) {
  const until = p.burnAt === null ? t : Math.min(t, p.burnAt + BURN_T);
  const fast = p.burnAt === null ? 0 : Math.max(0, until - p.burnAt) * 1.8; // al prenderse fuego corre
  const span = p.x2 - p.x1, k = ((((until * p.speed + fast) / span + p.phase) % 2) + 2) % 2;
  return { x: p.x1 + (k < 1 ? k : 2 - k) * span, dir: (k < 1 ? 1 : -1) as 1 | -1 };
}
export const personState = (p: Person, t: number) => p.burnAt === null ? 'calm' : t - p.burnAt < BURN_T ? 'burning' : 'charred';
export const floorY = (b: Building, k: number) => k * b.fh;
export const zipY = (z: Zip, x: number) => z.y1 + ((z.y2 - z.y1) * (x - z.x1)) / (z.x2 - z.x1);

// ---------- La ciudad ----------
// Pisos de cada edificio, de izquierda a derecha: el último es la torre más alta (la de los helicópteros).
const FLOORS = [6, 9, 5, 12, 8, 15, 10, 18, 13, 21, 16, 26];
const CONSTRUCTION = new Set([3, 7]); // edificios en construcción
const TRAMPOLINES = [0, 4, 8]; // cama elástica en la terraza, para rebotar hasta el edificio de al lado
const FALLEN = [2, 6, 10]; // la parte de arriba se cayó y quedó apoyada en el edificio de al lado
const ZIPS = [1, 5, 9]; // tirolesa desde la terraza, por encima del vecino, hasta el siguiente
export const START_BUILDINGS = 8; // se arranca en la vereda de alguno de los primeros edificios
const FURNITURE: { kind: FurnitureKind; h: number }[] = [
  { kind: 'sofa', h: 0.95 }, { kind: 'bed', h: 0.85 }, { kind: 'table', h: 1 }, { kind: 'desk', h: 1.05 }, { kind: 'dresser', h: 1.2 },
  { kind: 'piano', h: 1.25 }, { kind: 'washer', h: 1.1 }, { kind: 'armchair', h: 0.95 }, { kind: 'stove', h: 1 }, { kind: 'counter', h: 1.05 },
  { kind: 'wardrobe', h: 1.6 }, { kind: 'fridge', h: 1.55 }, { kind: 'bookshelf', h: 1.45 },
];
const BUILDING_STUFF: { kind: FurnitureKind; h: number }[] = [{ kind: 'bricks', h: 1.05 }, { kind: 'cement', h: 0.95 }, { kind: 'pallets', h: 1.2 }, { kind: 'barrels', h: 1.15 }];
// Muebles bajitos de más, para que los departamentos se vean habitados (no hacen falta para subir).
const SMALL: { kind: FurnitureKind; h: number; w: [number, number] }[] = [
  { kind: 'chair', h: 0.55, w: [0.5, 0.6] }, { kind: 'nightstand', h: 0.6, w: [0.6, 0.75] }, { kind: 'coffeetable', h: 0.42, w: [1, 1.3] },
  { kind: 'tvstand', h: 0.55, w: [1.2, 1.5] }, { kind: 'armchair', h: 0.75, w: [0.9, 1.1] }, { kind: 'stove', h: 0.95, w: [0.8, 0.9] }, { kind: 'counter', h: 1, w: [1.4, 1.8] },
];

export function buildCity(seed = 20261006): City {
  let s = seed;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const between = (a: number, b: number) => a + rand() * (b - a);
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
  let id = 1;
  const city: City = { width: 0, buildings: [], plats: [], climbs: [], walls: [], fires: [], sparks: [], people: [], helis: [], elevators: [], escapes: [], zips: [], fallens: [], links: [], street: 0, starts: [] };
  const { buildings, plats, climbs, walls, fires, sparks, people, helis, elevators, escapes, zips, fallens, links } = city;

  // 1) Edificios y huecos entre ellos (callecitas angostas o pasillos con escalera de emergencia).
  let x = 3;
  const gaps: { kind: 'narrow' | 'alley'; w: number; escapeSide: -1 | 1 }[] = [];
  FLOORS.forEach((floors, i) => {
    const tower = i === FLOORS.length - 1;
    const w = tower ? 15 : between(10, 13.5);
    const fh = tower ? 3.1 : between(2.95, 3.3);
    buildings.push({
      id: i, x, w, fh, floors, top: floors * fh, hue: Math.floor(rand() * 360), tone: rand(), tower,
      construction: CONSTRUCTION.has(i), broken: FALLEN.includes(i), roofDecor: true,
      doors: { left: new Set([0]), right: new Set([0]) }, holes: [],
    });
    if (tower) return;
    const alley = rand() < 0.45;
    const gap = alley ? between(3, 3.35) : between(1.5, 2.05);
    // Donde hay un edificio caído, la escalera de emergencia queda del lado de abajo.
    gaps.push({ kind: alley ? 'alley' : 'narrow', w: gap, escapeSide: FALLEN.includes(i) ? -1 : rand() < 0.5 ? -1 : 1 });
    x += w + gap;
  });
  const last = buildings[buildings.length - 1];
  city.width = last.x + last.w + 9;
  const street: Plat = { id: id++, kind: 'street', x: 0, y: 0, w: city.width, b: -1, floor: 0, dy: 0, crumble: 0, gone: 0, hue: 0 };
  plats.push(street);
  city.street = street.id;
  for (const b of buildings.slice(0, START_BUILDINGS)) city.starts.push({ b: b.id, x1: b.x + 1, x2: b.x + b.w - 1 });

  // Lugares ocupados de cada piso (para que no se pisen las cosas entre sí).
  const used = new Map<string, [number, number][]>();
  const key = (b: number, k: number) => `${b}:${k}`;
  const reserve = (b: number, k: number, x1: number, x2: number) => { const l = used.get(key(b, k)) ?? []; l.push([x1, x2]); used.set(key(b, k), l); };
  const free = (b: number, k: number, x1: number, x2: number) => !(used.get(key(b, k)) ?? []).some(([a, c]) => x2 > a && x1 < c);
  const inner = (b: Building) => [b.x + WALL + 0.2, b.x + b.w - WALL - 0.2] as const;
  // Junto a las paredes queda libre (puertas): las cosas van del medio para adentro.
  for (const b of buildings) for (let k = 0; k <= b.floors; k++) { const [a, c] = inner(b); reserve(b.id, k, a - 1, a + 0.6); reserve(b.id, k, c - 0.6, c + 1); }
  const spot = (b: Building, ks: number[], span: number, tries = 40) => {
    const [a, c] = inner(b);
    for (let i = 0; i < tries; i++) {
      const x1 = between(a, c - span);
      if (ks.every(k => free(b.id, k, x1 - 0.25, x1 + span + 0.25))) return x1;
    }
    return null;
  };

  // Lo que se crea mientras se arma (después se convierte en uniones entre plataformas).
  type Proto = { mode: LinkMode; b: number; bTo?: number; fromK: number; toK: number; fromX: number; toX: number; fromPlat?: Plat; toPlat?: Plat; cost: number; edge: number };
  const protos: Proto[] = [];

  // 2) Formas especiales de pasar de edificio en edificio (se reservan primero sus lugares en las terrazas).
  //    Camas elásticas: rebotás desde la terraza y entrás por una puerta del edificio de al lado, más arriba.
  for (const i of TRAMPOLINES) {
    const A = buildings[i], B = buildings[i + 1];
    const y = A.top + 0.45, tw = 1.6, tx = A.x + A.w - 2.3;
    let k = Math.floor((y + 4.3) / B.fh);
    if (floorY(B, k) < y + 1.2) k++;
    if (k >= B.floors) continue;
    const p: Plat = { id: id++, kind: 'trampoline', x: tx, y, w: tw, b: A.id, floor: A.floors, dy: 0, crumble: 0, gone: 0, hue: 200 };
    plats.push(p);
    reserve(A.id, A.floors, tx - 0.3, tx + tw + 0.3);
    B.doors.left.add(k); if (k + 1 < B.floors) B.doors.left.add(k + 1);
    protos.push({ mode: 'bounce', b: A.id, bTo: B.id, fromK: A.floors, toK: k, fromX: tx + tw / 2, toX: B.x + 0.8, fromPlat: p, cost: 1.2, edge: 0 });
    protos.push({ mode: 'walk', b: A.id, fromK: A.floors, toK: A.floors, toPlat: p, fromX: tx - 0.3, toX: tx + 0.3, cost: 0.2, edge: 0 });
  }
  //    Edificios caídos: la parte de arriba quedó inclinada desde su terraza hasta un piso del de al lado.
  const rampFloor = new Map<number, number>();
  for (const i of FALLEN) {
    const A = buildings[i], B = buildings[i + 1];
    const y1 = A.top + 0.02, x1 = A.x + A.w * 0.45, x2 = B.x;
    let best = -1;
    for (let k = 1; k < B.floors; k++) { const dy = floorY(B, k) - y1; if (dy >= 2.5 && dy <= 6.5 && (best < 0 || Math.abs(dy - 4.5) < Math.abs(floorY(B, best) - y1 - 4.5))) best = k; }
    if (best < 0) { A.broken = false; continue; }
    const y2 = floorY(B, best) - 0.04, L = x2 - x1, n = Math.ceil(L / 0.3);
    for (let j = 0; j < n; j++) plats.push({ id: id++, kind: 'ramp', x: x1 + (j * L) / n - 0.02, y: y1 + ((j + 1) * (y2 - y1)) / n, w: L / n + 0.04, b: -1, floor: A.floors, dy: 0, crumble: 0, gone: 0, hue: A.hue });
    fallens.push({ id: id++, a: A.id, b: B.id, x1, y1, x2, y2, thick: 3.2 });
    reserve(A.id, A.floors, x1 - 0.5, A.x + A.w + 1);
    B.doors.left.add(best); B.doors.left.add(best - 1); // al llegar arriba la rampa pasa justo por el piso de abajo
    rampFloor.set(B.id, best);
    protos.push({ mode: 'ramp', b: A.id, bTo: B.id, fromK: A.floors, toK: best, fromX: x1, toX: B.x + 0.5, cost: L / RUN + 0.6, edge: 0 });
    protos.push({ mode: 'ramp', b: B.id, bTo: A.id, fromK: best, toK: A.floors, fromX: B.x + 0.5, toX: x1, cost: L / RUN + 0.6, edge: 0 });
  }
  //    Tirolesas: desde la terraza, por encima del edificio de al lado (más bajo), hasta el siguiente.
  for (const i of ZIPS) {
    const A = buildings[i], M = buildings[i + 1], C = buildings[i + 2];
    if (!C) continue;
    const x1 = A.x + A.w - 1.2, y1 = A.top + 1.25, x2 = C.x + 1.2;
    let k = -1;
    for (let j = 1; j < C.floors; j++) if (floorY(C, j) + 1.5 <= y1 - 1.2 && j !== rampFloor.get(C.id)) k = j;
    if (k < 0) continue;
    const z: Zip = { id: id++, x1, y1, x2, y2: floorY(C, k) + 1.5 };
    if (zipY(z, M.x + M.w) - HANG < M.top + 0.6) continue; // tiene que pasar por arriba del vecino
    zips.push(z);
    A.roofDecor = false; M.roofDecor = false;
    reserve(A.id, A.floors, x1 - 1, x1 + 1);
    C.doors.left.add(k);
    protos.push({ mode: 'zip', b: A.id, bTo: C.id, fromK: A.floors, toK: k, fromX: x1, toX: x2, cost: (x2 - x1) / ZIP_SPEED + 0.5, edge: 0 });
  }
  //    Helipuertos: dos en la terraza de la torre y una plataforma que sale de su costado, tres pisos abajo.
  const tower = last, kb = tower.floors - 3;
  const padX = [tower.x + 0.9, tower.x + tower.w - 0.9 - 3.8];
  for (const px of padX) reserve(tower.id, tower.floors, px - 0.3, px + 4.1);

  // 3) Ascensores: suben desde algún piso hasta la terraza (y no más), parando en cada piso.
  for (const b of buildings) {
    if (b.construction || b.floors < 7 || rand() > 0.75) continue;
    const from = rand() < 0.5 ? 0 : Math.floor(rand() * Math.max(1, Math.floor(b.floors * 0.35)));
    const ks = Array.from({ length: b.floors - from + 1 }, (_, i) => from + i);
    const ex = spot(b, ks, 1.8);
    if (ex === null) continue;
    for (const k of ks) reserve(b.id, k, ex - 0.4, ex + 2.2);
    const stops = ks.map(k => floorY(b, k));
    const e: Elevator = { id: id++, b: b.id, x: ex, w: 1.8, y1: stops[0], y2: b.top, stops, speed: between(2.2, 2.8), dwell: between(1.6, 2.2), phase: rand() * 30 };
    elevators.push(e);
    plats.push({ id: id++, kind: 'elevator', x: ex, y: e.y1, w: e.w, b: b.id, floor: from, elev: e, dy: 0, crumble: 0, gone: 0, hue: b.hue });
    const wait = elevatorPeriod(e) / 2;
    for (const k of ks) for (const k2 of ks) if (k2 > k) protos.push({ mode: 'elevator', b: b.id, fromK: k, toK: k2, fromX: ex + 0.9, toX: ex + 0.9, cost: wait + (floorY(b, k2) - floorY(b, k)) / e.speed + ELEV_STOP * (k2 - k), edge: 0 });
  }

  // 4) Cómo se sube de cada piso al siguiente adentro de cada edificio (siempre hay al menos una forma).
  for (const b of buildings) {
    for (let k = 0; k < b.floors; k++) {
      const y0 = floorY(b, k), y1 = floorY(b, k + 1);
      const ways: string[] = [];
      const want = 1 + (rand() < 0.3 ? 1 : 0);
      const order = ['stairs', 'furniture', 'furniture', 'ladder', 'rope'];
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
          const list = b.construction ? BUILDING_STUFF : FURNITURE;
          const options = list.filter(f => f.h >= need);
          const f = pick(options.length ? options : FURNITURE.slice(-3));
          const fw = f.kind === 'bed' || f.kind === 'sofa' || f.kind === 'piano' || f.kind === 'counter' || f.kind === 'pallets' ? between(1.8, 2.3) : between(1.2, 1.6);
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

  // 6) Escaleras de emergencia en los pasillos: descansos en cada piso unidos por escaleras de mano,
  //    rotas en algún piso (nunca llegan hasta arriba).
  const landingsOf = new Map<number, { k: number; plat: Plat; edge: number }[]>(); // hueco → descansos
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

  // 7) Uniones entre edificios vecinos: puertas enfrentadas (aberturas de todo el alto del piso), tablones,
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
    if (c.kind === 'jump') {
      protos.push({ mode: 'jump', b: c.a.id, bTo: c.b.id, fromK: c.from.k, toK: c.to.k, fromPlat: c.from.landing, toPlat: c.to.landing, fromX: c.from.edge - 0.3, toX: c.to.edge + 0.4, cost: 0.7, edge: gapW });
      if (ya - yb <= 1.5) protos.push({ mode: 'jump', b: c.b.id, bTo: c.a.id, fromK: c.to.k, toK: c.from.k, fromPlat: c.to.landing, toPlat: c.from.landing, fromX: c.to.edge + 0.3, toX: c.from.edge - 0.4, cost: 0.7, edge: gapW });
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

  // 8) Puertas a los costados de los departamentos, con un balconcito afuera para salir.
  const hasRamp = new Set(fallens.map(f => f.a));
  buildings.forEach((b, i) => {
    if (b.construction) return;
    for (const side of [-1, 1] as const) {
      if (side > 0 && b.tower) continue;
      const gapIndex = side < 0 ? i - 1 : i;
      if (gapIndex >= 0 && hasRamp.has(gapIndex)) continue;
      const gapW = gapIndex < 0 ? b.x : gaps[gapIndex].w;
      const set = side < 0 ? b.doors.left : b.doors.right;
      const bw = Math.min(1.05, gapW * 0.4);
      for (let k = 1; k < b.floors; k++) {
        if (set.has(k) || rand() > 0.28) continue;
        set.add(k);
        const p: Plat = { id: id++, kind: 'balcony', x: side < 0 ? b.x - bw : b.x + b.w, y: floorY(b, k), w: bw, b: b.id, floor: k, dy: 0, crumble: 0, gone: 0, hue: b.hue };
        plats.push(p);
        const inX = side < 0 ? b.x + 0.5 : b.x + b.w - 0.5, outX = p.x + bw / 2;
        protos.push({ mode: 'walk', b: b.id, fromK: k, toK: k, fromX: inX, toX: outX, toPlat: p, cost: 0.3, edge: 0 });
        protos.push({ mode: 'walk', b: b.id, fromK: k, toK: k, fromPlat: p, fromX: outX, toX: inX, cost: 0.3, edge: 0 });
      }
    }
  });

  // 9) Peligros adentro (nunca en la planta baja, donde arrancás): departamentos incendiados, pisos rotos
  //    y cortocircuitos.
  for (const b of buildings) {
    for (let k = 1; k < b.floors; k++) {
      const y0 = floorY(b, k);
      for (const chance of [0.48, 0.18]) {
        if (rand() > chance) continue;
        const fw = between(0.7, 1.4), fx = spot(b, [k], fw + 0.4, 12);
        if (fx !== null) { fires.push({ id: id++, x1: fx + 0.2, x2: fx + 0.2 + fw, y: y0, h: between(0.9, 1.4) }); reserve(b.id, k, fx, fx + fw + 0.4); }
      }
    }
  }

  // 10) Pisos rotos: agujeros en el piso (no donde se llega ni de donde se sale, ni arriba de un incendio).
  const below = (y: number, x1: number, x2: number) => fires.some(f => Math.abs(f.y - y) < 0.01 && f.x2 > x1 - 0.3 && f.x1 < x2 + 0.3)
    || sparks.some(s => s.kind === 'puddle' && Math.abs(s.y1 - y) < 0.01 && s.x2 > x1 - 0.3 && s.x1 < x2 + 0.3);
  for (const b of buildings) {
    for (let k = 1; k < b.floors; k++) {
      if (rand() > 0.4) continue;
      const hw = between(1.1, 1.5), hx = spot(b, [k], hw, 12);
      if (hx === null || below(floorY(b, k - 1), hx, hx + hw)) continue;
      b.holes.push({ floor: k, x1: hx, x2: hx + hw }); reserve(b.id, k, hx - 0.2, hx + hw + 0.2);
    }
  }

  // 10a) Cables pelados y charcos con cortocircuitos.
  for (const b of buildings) {
    for (let k = 1; k < b.floors; k++) {
      const y0 = floorY(b, k), y1 = floorY(b, k + 1);
      if (rand() < 0.32) {
        const fx = spot(b, [k], 0.9, 12);
        if (fx !== null) { sparks.push({ id: id++, kind: 'cable', x1: fx + 0.2, x2: fx + 0.7, y1: y1 - 1.75, y2: y1, period: between(1.6, 2.4), on: 0.45, phase: rand() * 3 }); reserve(b.id, k, fx, fx + 0.9); }
      }
      if (rand() < 0.22) {
        const pw = between(1, 1.5), fx = spot(b, [k], pw + 0.4, 12);
        if (fx !== null) { sparks.push({ id: id++, kind: 'puddle', x1: fx + 0.2, x2: fx + 0.2 + pw, y1: y0, y2: y0 + 0.35, period: between(1.8, 2.6), on: 0.4, phase: rand() * 3 }); reserve(b.id, k, fx, fx + pw + 0.4); }
      }
    }
  }

  // 10b) Más muebles en lo que quedó libre de los departamentos: sillas, mesitas de luz, mesas ratonas,
  //      cocinas, mesadas…
  for (const b of buildings) {
    if (b.construction) continue;
    for (let k = 0; k < b.floors; k++) {
      const n = 1 + (rand() < 0.55 ? 1 : 0) + (rand() < 0.25 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const f = pick(SMALL), fw = between(f.w[0], f.w[1]);
        const fx = spot(b, [k], fw + 0.2, 30);
        if (fx === null) continue;
        plats.push({ id: id++, kind: 'furniture', furniture: f.kind, h: f.h, x: fx + 0.1, y: floorY(b, k) + f.h, w: fw, b: b.id, floor: k, dy: 0, crumble: 0, gone: 0, hue: Math.floor(rand() * 360) });
        reserve(b.id, k, fx, fx + fw + 0.2);
      }
    }
  }

  // 11) Losas de cada piso (partidas donde hay agujeros) y terrazas.
  const floorPlats = new Map<string, Plat[]>();
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

  // 12) Helicópteros: aterrizan por turnos (dos en la terraza de la torre y uno en la plataforma del costado).
  const by = floorY(tower, kb);
  const deck: Plat = { id: id++, kind: 'pad', x: tower.x + tower.w, y: by, w: 4.8, b: tower.id, floor: kb, dy: 0, crumble: 0, gone: 0, hue: tower.hue };
  plats.push(deck);
  tower.doors.right.add(kb);
  protos.push({ mode: 'walk', b: tower.id, fromK: kb, toK: kb, fromX: tower.x + tower.w - 0.5, toX: deck.x + 0.5, toPlat: deck, cost: 0.3, edge: 0 });
  helis.push({ id: id++, x: padX[0], y: tower.top, w: 3.8, h: 1.6, phase: 0, drift: -1 });
  helis.push({ id: id++, x: padX[1], y: tower.top, w: 3.8, h: 1.6, phase: HELI_PERIOD / 3, drift: 1 });
  helis.push({ id: id++, x: deck.x + 0.5, y: by, w: 3.8, h: 1.6, phase: (HELI_PERIOD * 2) / 3, drift: 1 });

  for (const pr of protos) {
    const bTo = pr.bTo ?? pr.b;
    const from = pr.fromPlat ?? platAt(pr.b, pr.fromK, pr.fromX);
    const to = pr.toPlat ?? platAt(bTo, pr.toK, pr.toX);
    if (!from || !to || from === to) continue;
    const fromY = from.kind === 'elevator' ? floorY(buildings[pr.b], pr.fromK) : from.y;
    const toY = to.kind === 'elevator' ? floorY(buildings[pr.b], pr.toK) : to.y;
    links.push({ from: from.id, to: to.id, mode: pr.mode, dy: toY - fromY, edge: pr.edge, fromX: pr.fromX, toX: pr.toX, fromY, toY, cost: pr.cost });
  }

  // 13) Paredes de cada piso, con las puertas abiertas (la terraza no tiene paredes y los edificios en
  //     construcción tampoco).
  for (const b of buildings) {
    if (b.construction) continue;
    for (const [side, xw] of [['left', b.x + WALL / 2], ['right', b.x + b.w - WALL / 2]] as const) {
      for (let k = 0; k < b.floors; k++) {
        const y0 = floorY(b, k), y1 = floorY(b, k + 1);
        if (!b.doors[side].has(k)) walls.push({ x: xw, y1: y0, y2: y1 }); // con puerta, ese piso queda abierto
      }
    }
  }

  // 14) Gente caminando por los pisos (en las obras, albañiles con casco).
  for (const b of buildings) {
    const [a, c] = inner(b);
    for (let k = 0; k < b.floors; k++) {
      if (rand() > (k === 0 ? 0.7 : 0.4)) continue;
      people.push({ id: id++, b: b.id, y: floorY(b, k), x1: a + 0.3, x2: c - 0.3, speed: between(0.6, 1.3), phase: rand() * 2, hue: Math.floor(rand() * 360), look: rand(), helmet: b.construction, burnAt: null });
    }
    // y alguno en la terraza
    if (rand() < 0.5) people.push({ id: id++, b: b.id, y: b.top, x1: b.x + 0.5, x2: b.x + b.w - 0.5, speed: between(0.6, 1.1), phase: rand() * 2, hue: Math.floor(rand() * 360), look: rand(), helmet: b.construction, burnAt: null });
  }
  return city;
}

// Cada partida arranca en un lugar distinto de la vereda (o en el edificio que se pida).
export function newLava(start?: number, seed?: number): LavaGame {
  const city = buildCity(seed);
  const i = start ?? Math.floor(Math.random() * city.starts.length);
  const where = city.starts[Math.max(0, Math.min(city.starts.length - 1, i))];
  // Nunca adentro de un ascensor de planta baja (te llevaría para arriba apenas arranca).
  const inElevator = (x: number) => city.elevators.some(e => e.y1 === 0 && x > e.x - PLAYER_W && x < e.x + e.w + PLAYER_W);
  const anywhere = () => where.x1 + Math.random() * (where.x2 - where.x1);
  let x = start === undefined ? anywhere() : where.x1 + 0.3 * (where.x2 - where.x1);
  for (let tries = 0; tries < 30 && inElevator(x); tries++) x = anywhere();
  const street = city.plats.find(p => p.id === city.street)!;
  return {
    ...city, start: where.b, time: 0, lava: LAVA0, bestGround: 0, won: false, nearHeli: false, speedLevel: 0, heliLanded: city.helis.map(() => false),
    dying: null, over: false, events: [],
    player: { x, y: 0, vx: 0, vy: 0, facing: Math.random() < 0.5 ? -1 : 1, ground: street, climb: null, zip: null, climbCooldown: 0, coyote: 0 },
  };
}

export const towerOf = (c: City) => c.buildings[c.buildings.length - 1];
const overlapsX = (p: Player, pl: Plat) => p.x + PLAYER_W / 2 > pl.x && p.x - PLAYER_W / 2 < pl.x + pl.w;
const hitsBox = (p: Player, x1: number, x2: number, y1: number, y2: number) => p.x + PLAYER_W / 2 > x1 && p.x - PLAYER_W / 2 < x2 && p.y + PLAYER_H > y1 && p.y < y2;

function lose(g: LavaGame, reason: LoseReason) {
  const p = g.player;
  g.dying = { t: 0, reason };
  p.climb = null; p.zip = null; p.vx = 0;
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

function grabClimb(p: Player, c: Climb) { p.climb = c; p.x = c.x; p.vx = 0; p.vy = 0; p.ground = null; }
function grabZip(g: LavaGame, p: Player, z: Zip) {
  p.zip = z; p.x = Math.max(p.x, z.x1); p.y = zipY(z, p.x) - HANG; p.vx = 0; p.vy = 0; p.ground = null; p.climb = null;
  g.events.push({ type: 'zip' });
}
// Una tirolesa al alcance de las manos (parado, hace falta menos puntería que en el aire).
const zipNear = (g: LavaGame, p: Player, slack: number) =>
  g.zips.find(z => p.x >= z.x1 - 0.6 && p.x < z.x2 - 0.5 && Math.abs(zipY(z, Math.max(p.x, z.x1)) - (p.y + HANG)) < slack);

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
  // Avisa cuando aterriza un helicóptero (si ya estás cerca).
  g.helis.forEach((h, i) => {
    const landed = heliState(h, t).phase === 'landed';
    if (landed && !g.heliLanded[i] && g.nearHeli) g.events.push({ type: 'heliLand' });
    g.heliLanded[i] = landed;
  });

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

  // Colgado de la tirolesa: baja solo hasta la otra punta (con ↓ te soltás antes).
  if (p.zip) {
    const z = p.zip;
    p.facing = 1;
    p.x = Math.min(z.x2, p.x + ZIP_SPEED * dt);
    p.y = zipY(z, p.x) - HANG;
    if (p.x >= z.x2 || input.down) { p.zip = null; p.vy = 0; p.climbCooldown = 0.4; }
    hazards(g, t); finish(g); return;
  }

  // En una escalera o soga: ↑ sube, ↓ baja, de costado se salta.
  if (p.climb) {
    const c = p.climb, vertical = (input.up || input.jump ? 1 : 0) - (input.down ? 1 : 0);
    if (dir) { p.vx = dir * 5; p.vy = 8; p.climb = null; p.climbCooldown = 0.4; g.events.push({ type: 'jump' }); }
    else {
      p.y += vertical * CLIMB * dt;
      if (p.y >= c.y2 && vertical > 0) { p.y = c.y2; p.vy = 10; p.vx = 0; p.climb = null; p.climbCooldown = 0.5; }
      else if (p.y <= c.y1 && vertical < 0) { p.y = c.y1; p.vy = 0; p.climb = null; p.climbCooldown = 0.5; } // abajo de todo: se suelta y apoya los pies
      else { p.y = Math.max(c.y1, Math.min(c.y2, p.y)); hazards(g, t); finish(g); return; }
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
  // El ascensor que sube te levanta si estás parado adentro (las puertas se abren en cada piso).
  if (p.ground && !p.ground.elev) {
    const car = g.plats.find(pl => pl.elev && overlapsX(p, pl) && pl.y >= p.y - 0.01 && pl.y - pl.dy <= p.y + 0.02 && pl.dy > 0);
    if (car) { p.ground = car; p.y = car.y; }
  }

  if (p.ground && (!overlapsX(p, p.ground) || p.ground.gone > 0)) { p.ground = null; p.coyote = 0.1; p.vy = 0; }
  p.coyote = Math.max(0, p.coyote - dt);

  // Parado al lado de una escalera o soga: ↑ te agarrás para subir, ↓ (desde arriba) para bajar.
  // Parado debajo de una tirolesa: ↑ te colgás.
  if (p.ground && !p.climbCooldown) {
    if (input.up) {
      const c = g.climbs.find(c => Math.abs(p.x - c.x) < 0.45 && c.y1 <= p.y + 0.35 && c.y2 > p.y + 0.6);
      if (c) { grabClimb(p, c); p.y = Math.max(p.y, c.y1); hazards(g, t); finish(g); return; }
      const z = zipNear(g, p, 0.6);
      if (z) { grabZip(g, p, z); hazards(g, t); finish(g); return; }
    } else if (input.down) {
      const c = g.climbs.find(c => Math.abs(p.x - c.x) < 0.45 && c.y2 >= p.y - 0.05 && c.y2 <= p.y + 0.7 && c.y1 < p.y - 0.5);
      if (c) { grabClimb(p, c); p.y = Math.min(p.y - 0.2, c.y2 - 0.4); hazards(g, t); finish(g); return; }
    }
  }

  if (input.jump && (p.ground || p.coyote > 0)) {
    p.vy = JUMP; p.ground = null; p.coyote = 0;
    g.events.push({ type: 'jump' });
  }

  // Agarrarse de una escalera, soga o tirolesa en el aire (manteniendo ↑ o saltar).
  if (!p.ground && (input.jump || input.up) && !p.climbCooldown) {
    const c = g.climbs.find(c => Math.abs(p.x - c.x) < 0.5 && p.y + PLAYER_H * 0.6 > c.y1 && p.y < c.y2);
    if (c) { grabClimb(p, c); hazards(g, t); finish(g); return; }
    const z = zipNear(g, p, 0.35);
    if (z) { grabZip(g, p, z); hazards(g, t); finish(g); return; }
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
  if (pl.kind === 'trampoline') { p.vy = BOUNCE; p.ground = null; p.coyote = 0; g.events.push({ type: 'bounce' }); }
}

function finish(g: LavaGame) {
  const p = g.player;
  if (g.dying) return;
  if (p.ground?.elev) g.bestGround = Math.max(g.bestGround, p.y);
  // ¿Se subió a un helicóptero aterrizado?
  for (const h of g.helis) {
    if (heliState(h, g.time).phase !== 'landed') continue;
    if (hitsBox(p, h.x, h.x + h.w, h.y, h.y + h.h)) { g.won = true; g.events.push({ type: 'win' }); return; }
  }
  const tower = towerOf(g);
  if (!g.nearHeli && p.x > tower.x - 2 && p.y > tower.top - 5 * tower.fh) { g.nearHeli = true; g.events.push({ type: 'heli' }); }
}

export const takeEvents = (g: LavaGame) => g.events.splice(0);
