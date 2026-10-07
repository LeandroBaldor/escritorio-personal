// Lógica de "Ciudad Tiburón": la ciudad está inundada, llueve, hay relámpagos y viento, y por las calles
// (ahora canales) nadan tiburones. Sos un bombero y tenés que rescatar 20 perritos, gatos y personas que
// flotan en el agua (arriba de gomas, cajones, puertas y colchones) antes de que se termine el tiempo.
//
// - La ciudad es una fila de edificios, casas y locales, con una calle inundada entre cada uno. Se arranca
//   en el medio y hay ciudad para los dos lados.
// - Para moverse: terrazas, escaleras de incendio, balcones, aires acondicionados, sogas y caños para
//   trepar, toldos que hacen rebotar, escalones de las entradas, techos de autos, colectivos, kioscos y
//   paradas, copas de árboles, tanques de agua, carteles, cables entre los postes (los postes se trepan),
//   tirolesas desde los edificios altos y tablas, puertas y colchones que arrastra la corriente.
// - Los rescatados flotan con la corriente. Se rescatan tocándolos (o estirándote desde algo bajito):
//   para eso hay que bajar cerca del agua, que es donde te alcanzan los tiburones.
// - Siempre se ven las aletas. Si estás cerca del agua el tiburón va hasta abajo tuyo, se frena, salen
//   burbujas y salta: si te alcanza, te come (GAME OVER). Si caés al agua nadás despacio y el tiburón va
//   directo a buscarte. Hay tiburones de varios tipos: más rápidos, más lentos, que saltan más alto…
//   También se pueden llevar a los que flotan (después aparecen otros).
// - El agua pasa por delante de los edificios: los tiburones nadan por toda la ciudad y el bombero también
//   puede nadar de una calle a otra por delante de las paredes.
// - Con el tiempo llegan cada vez más tiburones. El viento sopla para un lado, se calma y después sopla
//   para el otro, y te empuja.
//
// Todo se mide en "unidades" (el personaje mide casi una). El agua está en y = 0.

export const PLAYER_W = 0.6, PLAYER_H = 0.85;
export const RUN = 6, CLIMB = 4, SWIM = 2.2, MAX_FALL = 18;
export const GRAVITY = 30, JUMP = 12.5, SWIM_JUMP = 9.5;
export const REACH = (JUMP * JUMP) / (2 * GRAVITY); // lo más alto que se llega saltando (unas 2,6 unidades)
export const BOUNCE = 16; // el toldo te tira para arriba (unas 4,3 unidades)
export const ZIP_SPEED = 7, HANG = 1.05;
export const WATER_Y = -0.45; // nadando, los pies quedan a esta altura
export const FLOAT_Y = 0.15; // arriba de las cosas que flotan
export const TIME_LIMIT = 300, GOAL = 20;
export const WIND = 1.6, WIND_AIR = 2.8; // lo que te empuja el viento fuerte, parado y en el aire (unidades por segundo)
export const WIND_TURN = 7, WIND_CALM = 1.5; // cada 7 s cambia de lado; al cambiar hay un rato de calma
const SHARK_G = 24; // la gravedad del salto del tiburón (un poco más lento que el personaje, para verlo)
const SHARK_REST = 2.4; // después de saltar descansa
export const SHARK_LEN = 2.8; // lo que mide de largo un tiburón de tamaño 1
export const SHARK_DEPTH = -0.9; // a esta altura nada (el centro del cuerpo) y desde acá salta
export const SIGHT = 9; // hasta dónde ve un tiburón al bombero cerca del agua
const ROAM = 16; // cuánto se aleja nadando de la calle donde apareció
export const CHOMP = 0.45; // lo que tarda en cerrar la boca cuando te alcanza
const DIE_T = 2.4;
export const ACTIVE_RESCUES = 8; // los que hay flotando a la vez
export const GRAB_X = 0.95, GRAB_Y = 1.35; // hasta dónde llega el bombero estirándose

export type SharkType = 'gris' | 'martillo' | 'tigre' | 'bebe' | 'blanco' | 'mako';
export interface SharkSpec { name: string; speed: number; chase: number; reach: number; warn: number; size: number }
export const SHARKS: Record<SharkType, SharkSpec> = {
  gris: { name: 'tiburón gris', speed: 2.4, chase: 3.6, reach: 2.0, warn: 0.75, size: 1 },
  martillo: { name: 'tiburón martillo', speed: 1.7, chase: 2.7, reach: 2.9, warn: 0.85, size: 1.05 },
  tigre: { name: 'tiburón tigre', speed: 3.2, chase: 4.6, reach: 2.2, warn: 0.6, size: 1.1 },
  bebe: { name: 'tiburones bebé', speed: 4, chase: 5, reach: 1.2, warn: 0.5, size: 0.55 },
  blanco: { name: 'tiburón blanco', speed: 1.5, chase: 2.4, reach: 3.4, warn: 1, size: 1.6 },
  mako: { name: 'tiburón mako', speed: 4.5, chase: 6, reach: 2.5, warn: 0.5, size: 0.95 },
};
// Cuántos tiburones hay según el tiempo (empieza con 5 y llega uno nuevo cada 20 segundos).
export const sharksAt = (t: number) => Math.min(20, 5 + Math.floor(t / 20));
export const TIGRE_AT = 45, MAKO_AT = 100;

export type BlockKind = 'building' | 'house' | 'shop';
export interface Block { id: number; kind: BlockKind; x1: number; x2: number; top: number; floors: number; fh: number; hue: number; tone: number; label: string; escape: -1 | 1 }
export interface Lane { id: number; x1: number; x2: number; cable: number; pole: number }
export type PlatKind =
  | 'roof' | 'landing' | 'balcony' | 'ac' | 'stoop' | 'sill' | 'awning' | 'tank' | 'sign' | 'cable'
  | 'car' | 'van' | 'bus' | 'kiosk' | 'stop' | 'tree' | 'debris' | 'float';
export interface Plat { id: number; kind: PlatKind; x: number; y: number; w: number; dx: number; hue: number }
export interface Climb { id: number; x: number; y1: number; y2: number; skin: 'ladder' | 'rope' | 'pipe' | 'pole' }
export interface Zip { id: number; x1: number; y1: number; x2: number; y2: number } // (x1, y1) es la punta alta
export interface Wall { x: number; y2: number }
export type DebrisKind = 'plank' | 'door' | 'mattress' | 'pallet' | 'fridge';
export interface Mover { plat: Plat; lane: number; speed: number; dir: 1 | -1; min: number; max: number }
export interface Debris extends Mover { kind: DebrisKind }
export type Decor = { kind: 'light' | 'pare' | 'subte' | 'buzon'; x: number; lane: number };

export type RescueKind = 'perro' | 'gato' | 'persona';
export type FloatKind = 'goma' | 'cajon' | 'puerta' | 'colchon' | 'balsa';
export interface Rescue extends Mover { id: number; kind: RescueKind; float: FloatKind; look: number; state: 'drift' | 'saved' | 'taken'; at: number; fromX: number; fromY: number }
export interface Shark {
  id: number; type: SharkType; lane: number; x: number; dir: 1 | -1;
  state: 'patrol' | 'approach' | 'warn' | 'jump' | 'chase' | 'bite';
  t: number; y: number; vy: number; vx: number; target: number; hunger: number; rest: number; turn: number; born: number;
}
export const PLAYER_TARGET = -1;

export interface Player { x: number; y: number; vx: number; vy: number; facing: 1 | -1; ground: Plat | null; climb: Climb | null; zip: Zip | null; swimming: boolean; climbCooldown: number; coyote: number }
export interface Input { left: boolean; right: boolean; jump: boolean; down: boolean; up: boolean }
export type LoseReason = 'shark' | 'time';
export type SharkEvent =
  | { type: 'jump' } | { type: 'splash' } | { type: 'bounce' } | { type: 'zip' }
  | { type: 'saved'; kind: RescueKind; count: number } | { type: 'taken'; kind: RescueKind }
  | { type: 'sharkJump' } | { type: 'more'; count: number } | { type: 'newType'; shark: SharkType }
  | { type: 'wind'; dir: 1 | -1 } | { type: 'hurry'; left: number }
  | { type: 'lose'; reason: LoseReason } | { type: 'gameover' } | { type: 'win' };

export interface City { width: number; blocks: Block[]; lanes: Lane[]; plats: Plat[]; climbs: Climb[]; zips: Zip[]; walls: Wall[]; debris: Debris[]; decor: Decor[]; startX: number; startY: number }
export interface SharkGame extends City {
  time: number; saved: number; savedKinds: RescueKind[]; rescues: Rescue[]; sharks: Shark[]; player: Player;
  dying: { t: number; reason: LoseReason; shark: number } | null; over: boolean; won: boolean; events: SharkEvent[];
  rand: () => number; nextId: number; seen: Set<SharkType>; hurried: number; gust: number; windPower: number;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = <T,>(r: () => number, list: readonly T[]) => list[Math.floor(r() * list.length)];

// El viento: sopla hacia la derecha, se calma, sopla hacia la izquierda, se calma… Cada vez con otra fuerza
// y con rachas. Devuelve de -1 (fuerte a la izquierda) a 1 (fuerte a la derecha).
export function windAt(t: number): number {
  const k = Math.floor(t / WIND_TURN), u = t - k * WIND_TURN;
  if (u < WIND_CALM) return 0;
  const ramp = Math.min(1, (u - WIND_CALM) / 0.8, (WIND_TURN - u) / 0.8);
  const n = Math.sin(k * 91.7 + 12.3) * 43758.5453, strength = 0.7 + 0.3 * (n - Math.floor(n));
  return (k % 2 ? -1 : 1) * ramp * strength * (0.85 + 0.15 * Math.sin(t * 4.3 + k));
}

const SHOPS = ['FARMACIA', 'PANADERÍA', 'KIOSCO', 'PIZZERÍA', 'FERRETERÍA', 'HELADERÍA', 'VERDULERÍA', 'LIBRERÍA'];
const OBJECTS: { kind: PlatKind; w: number; y: number }[] = [
  { kind: 'car', w: 1.9, y: 0.2 }, { kind: 'car', w: 1.9, y: 0.2 }, { kind: 'van', w: 2.3, y: 0.55 }, { kind: 'bus', w: 3.4, y: 0.75 },
  { kind: 'kiosk', w: 1.6, y: 1.15 }, { kind: 'stop', w: 2.4, y: 1.75 }, { kind: 'tree', w: 2.2, y: 2.3 },
];
const DEBRIS: { kind: DebrisKind; w: number }[] = [{ kind: 'plank', w: 1.7 }, { kind: 'door', w: 1.3 }, { kind: 'mattress', w: 1.8 }, { kind: 'pallet', w: 1.3 }, { kind: 'fridge', w: 1 }];
const LAYOUT: BlockKind[] = [
  'building', 'house', 'shop', 'building', 'building', 'shop', 'house', 'building', 'shop',
  'house', 'building', 'shop', 'building', 'house', 'building', 'shop', 'building',
];
export const BLOCKS = LAYOUT.length;

export function buildCity(seed = 20261007): City {
  const r = rng(seed);
  const blocks: Block[] = [], lanes: Lane[] = [], plats: Plat[] = [], climbs: Climb[] = [], zips: Zip[] = [], walls: Wall[] = [], debris: Debris[] = [], decor: Decor[] = [];
  let id = 0;
  const plat = (kind: PlatKind, x: number, y: number, w: number, hue = 0) => { const p: Plat = { id: id++, kind, x, y, w, dx: 0, hue }; plats.push(p); return p; };
  const climb = (x: number, y1: number, y2: number, skin: Climb['skin']) => climbs.push({ id: id++, x, y1, y2, skin });

  // La fila de manzanas (en las puntas, edificios; se arranca arriba del local del medio).
  let x = 0;
  for (let i = 0; i < BLOCKS; i++) {
    const kind = LAYOUT[i];
    const fh = 2.6;
    const floors = kind === 'building' ? 4 + Math.floor(r() * 5) : kind === 'house' ? 2 : 1;
    const top = kind === 'building' ? floors * fh - 1.2 : kind === 'house' ? 5.2 : 3.4;
    const w = kind === 'building' ? 6 + r() * 3 : kind === 'house' ? 5 + r() * 1.5 : 4.5 + r() * 2.5;
    const b: Block = { id: i, kind, x1: x, x2: x + w, top, floors, fh, hue: Math.floor(r() * 360), tone: r(), label: kind === 'shop' ? pick(r, SHOPS) : '', escape: r() < 0.5 ? -1 : 1 };
    blocks.push(b);
    plat('roof', b.x1, top, w);
    walls.push({ x: b.x1, y2: top }, { x: b.x2, y2: top });
    x += w;
    if (i < BLOCKS - 1) { const lw = 8 + r() * 4; lanes.push({ id: i, x1: x, x2: x + lw, cable: 0, pole: x + lw / 2 }); x += lw; }
  }
  const width = x;

  // Lo que hay en cada costado de las manzanas (para trepar y para salir del agua).
  const out = (face: number, side: -1 | 1, w: number, d = 0) => side > 0 ? face + d : face - d - w;
  for (const b of blocks) {
    for (const side of [-1, 1] as const) {
      if ((b.id === 0 && side < 0) || (b.id === BLOCKS - 1 && side > 0)) continue; // los bordes de la ciudad
      const face = side < 0 ? b.x1 : b.x2;
      plat('stoop', out(face, side, 1), 0.45, 1); // el escalón de la entrada, casi tapado por el agua
      if (b.kind === 'building') {
        const yk = (k: number) => k * b.fh - 1.2;
        if (side === b.escape) {
          // Escalera de incendio: descansos en cada piso unidos por escaleras (la de abajo llega al agua).
          for (let k = 1; k < b.floors; k++) plat('landing', out(face, side, 1.6), yk(k), 1.6);
          const cx = face + side * 1.15;
          climb(cx, -0.8, yk(1), 'ladder');
          for (let k = 1; k < b.floors; k++) climb(cx, yk(k), k + 1 < b.floors ? yk(k + 1) : b.top, 'ladder');
        } else {
          // Balcones en cada piso y aires acondicionados en el medio; una soga cuelga de la terraza.
          for (let k = 1; k < b.floors; k++) {
            plat('balcony', out(face, side, 1.2), yk(k), 1.2, b.hue);
            plat('ac', out(face, side, 0.75, 0.15), yk(k) + 1.3, 0.75);
          }
          plat('ac', out(face, side, 0.75, 0.15), 1.6, 0.75);
          climb(face + side * 1.6, -0.6, b.top, 'rope');
        }
      } else if (b.kind === 'house') {
        plat('sill', out(face, side, 1.1), 2.6, 1.1, b.hue); // alero de la ventana de abajo
        plat('sill', out(face, side, 0.7), 3.9, 0.7, b.hue);
        climb(face + side * 0.25, -0.6, b.top, 'pipe'); // caño de lluvia
      } else {
        plat('awning', out(face, side, 1.5), 2, 1.5, b.hue); // toldo: rebota
      }
    }
    if (b.kind === 'house') plat('tank', b.x1 + (b.x2 - b.x1) * (0.25 + r() * 0.4), b.top + 1.3, 1.1);
    if (b.kind === 'shop') plat('sign', (b.x1 + b.x2) / 2 - 1.1, b.top + 1.5, 2.2, b.hue);
    if (b.kind === 'building' && b.x2 - b.x1 > 7) plat('tank', b.x1 + 1 + r() * (b.x2 - b.x1 - 3), b.top + 1.3, 1.2);
  }

  // Las calles inundadas: un cable entre las manzanas (con un poste en el medio que se trepa), a veces una
  // tirolesa, cosas que asoman del agua y cosas que arrastra la corriente.
  for (const lane of lanes) {
    const L = blocks[lane.id], R = blocks[lane.id + 1];
    const lowTop = Math.min(L.top, R.top);
    lane.cable = lowTop <= 9 ? lowTop : 5.6 + Math.floor(r() * 4) * 0.8;
    plat('cable', lane.x1, lane.cable, lane.x2 - lane.x1);
    climb(lane.pole, -0.6, lane.cable, 'pole');
    if (Math.abs(L.top - R.top) >= 4 && r() < 0.7) {
      const hi = L.top > R.top ? L : R, lo = hi === L ? R : L, s = hi === L ? 1 : -1;
      const hf = s > 0 ? hi.x2 : hi.x1, lf = s > 0 ? lo.x1 : lo.x2;
      zips.push({ id: id++, x1: hf - s * 0.6, y1: hi.top + HANG + 0.25, x2: lf + s * 1.6, y2: lo.top + HANG + 0.25 });
    }
    // Cosas que asoman: una a cada lado del poste (entre los escalones de los costados), rotando el tipo
    // para que haya de todo.
    const a = lane.x1 + 1.3, z = lane.x2 - 1.3;
    let turn = lane.id * 2;
    for (const [h1, h2] of [[a, lane.pole - 0.9], [lane.pole + 0.9, z]]) {
      const o = OBJECTS.map((_, j) => OBJECTS[(turn + j) % OBJECTS.length]).find(o => o.w <= h2 - h1);
      turn += 3;
      if (!o) continue;
      plat(o.kind, h1 + r() * (h2 - h1 - o.w), o.y, o.w, Math.floor(r() * 360));
    }
    for (const kind of ['light', 'pare', 'subte', 'buzon'] as const) if (r() < 0.3) decor.push({ kind, x: a + r() * (z - a), lane: lane.id });
    const nd = 1 + (r() < 0.5 ? 1 : 0);
    for (let k = 0; k < nd; k++) {
      const d = pick(r, DEBRIS);
      const min = lane.x1 + 1.1, max = lane.x2 - 1.1 - d.w;
      const p = plat('debris', min + r() * (max - min), FLOAT_Y, d.w, Math.floor(r() * 360));
      debris.push({ plat: p, lane: lane.id, kind: d.kind, speed: 0.5 + r() * 0.7, dir: r() < 0.5 ? -1 : 1, min, max });
    }
  }

  const start = blocks[Math.floor(BLOCKS / 2)];
  return { width, blocks, lanes, plats, climbs, zips, walls, debris, decor, startX: (start.x1 + start.x2) / 2, startY: start.top };
}

const TYPES_AT = (t: number): SharkType[] => [
  'gris', 'gris', 'gris', 'martillo', 'martillo', 'bebe', 'bebe', 'blanco',
  ...(t >= TIGRE_AT ? ['tigre', 'tigre'] as const : []), ...(t >= MAKO_AT ? ['mako', 'mako'] as const : []),
];

export function newShark(seed?: number): SharkGame {
  const city = buildCity();
  const rand = rng(seed ?? Math.floor(Math.random() * 2 ** 31));
  const g: SharkGame = {
    ...city, time: 0, saved: 0, savedKinds: [], rescues: [], sharks: [], dying: null, over: false, won: false, events: [],
    rand, nextId: 10000, seen: new Set(), hurried: 0, gust: 0, windPower: 1,
    player: { x: city.startX, y: city.startY, vx: 0, vy: 0, facing: 1, ground: city.plats.find(p => p.kind === 'roof' && p.y === city.startY && p.x < city.startX && p.x + p.w > city.startX) ?? null, climb: null, zip: null, swimming: false, climbCooldown: 0, coyote: 0 },
  };
  for (const type of ['gris', 'gris', 'martillo', 'bebe', 'blanco'] as const) addShark(g, type);
  for (let i = 0; i < ACTIVE_RESCUES; i++) addRescue(g);
  return g;
}

const laneOf = (g: SharkGame, x: number) => g.lanes.find(l => x >= l.x1 && x <= l.x2);
const laneCenter = (l: Lane) => (l.x1 + l.x2) / 2;

function addShark(g: SharkGame, type: SharkType) {
  // En la calle con menos tiburones, lejos del bombero (máximo dos por calle).
  const far = g.lanes.filter(l => Math.abs(laneCenter(l) - g.player.x) > 10);
  const pool = (far.length ? far : g.lanes).filter(l => g.sharks.filter(s => s.lane === l.id).length < 2);
  if (!pool.length) return;
  const fewest = Math.min(...pool.map(l => g.sharks.filter(s => s.lane === l.id).length));
  const lane = pick(g.rand, pool.filter(l => g.sharks.filter(s => s.lane === l.id).length === fewest));
  g.sharks.push({
    id: g.nextId++, type, lane: lane.id, x: lane.x1 + 1 + g.rand() * (lane.x2 - lane.x1 - 2), dir: g.rand() < 0.5 ? -1 : 1,
    state: 'patrol', t: 0, y: SHARK_DEPTH, vy: 0, vx: 0, target: 0, hunger: 6 + g.rand() * 10, rest: 0, turn: 2 + g.rand() * 3, born: g.time,
  });
  if (!g.seen.has(type)) { g.seen.add(type); if (g.time > 0) g.events.push({ type: 'newType', shark: type }); }
}

const FLOATS: Record<RescueKind, FloatKind[]> = { perro: ['goma', 'cajon', 'puerta', 'balsa'], gato: ['cajon', 'goma', 'colchon'], persona: ['colchon', 'puerta', 'balsa', 'goma'] };
const FLOAT_W: Record<FloatKind, number> = { goma: 0.9, cajon: 0.9, puerta: 1.3, colchon: 1.6, balsa: 1.4 };
function addRescue(g: SharkGame) {
  // En una calle que no tenga ya dos, y no justo abajo del bombero.
  const pool = g.lanes.filter(l => g.rescues.filter(r => r.state === 'drift' && r.lane === l.id).length < 2 && Math.abs(laneCenter(l) - g.player.x) > 3);
  const lane = pick(g.rand, pool.length ? pool : g.lanes);
  const kind = pick(g.rand, ['perro', 'perro', 'gato', 'gato', 'persona', 'persona'] as const), float = pick(g.rand, FLOATS[kind]), w = FLOAT_W[float];
  const min = lane.x1 + 1.2, max = lane.x2 - 1.2 - w;
  const plat: Plat = { id: g.nextId++, kind: 'float', x: min + g.rand() * (max - min), y: FLOAT_Y, w, dx: 0, hue: Math.floor(g.rand() * 360) };
  g.plats.push(plat);
  g.rescues.push({ id: g.nextId++, kind, float, look: g.rand(), state: 'drift', at: g.time, fromX: 0, fromY: 0, plat, lane: lane.id, speed: 0.25 + g.rand() * 0.35, dir: g.rand() < 0.5 ? -1 : 1, min, max });
}
export const rescueX = (r: Rescue) => r.plat.x + r.plat.w / 2;

const overlapsX = (p: Player, pl: Plat) => p.x + PLAYER_W / 2 > pl.x && p.x - PLAYER_W / 2 < pl.x + pl.w;
const removePlat = (g: SharkGame, pl: Plat) => { const i = g.plats.indexOf(pl); if (i >= 0) g.plats.splice(i, 1); if (g.player.ground === pl) g.player.ground = null; };

// Las paredes de las manzanas no se atraviesan de costado (llegan hasta la terraza).
// Nadando (o saltando desde el agua delante de un edificio) se pasa por delante de las paredes.
function moveX(g: SharkGame, p: Player, nx: number) {
  const y1 = p.y + 0.05, half = PLAYER_W / 2;
  const inFront = p.swimming || g.blocks.some(b => p.x > b.x1 && p.x < b.x2 && p.y < b.top - 0.05);
  for (const w of inFront ? [] : g.walls) {
    if (w.y2 <= y1) continue;
    if (p.x <= w.x - half + 1e-6 && nx > w.x - half) nx = w.x - half;
    else if (p.x >= w.x + half - 1e-6 && nx < w.x + half) nx = w.x + half;
  }
  return Math.max(PLAYER_W / 2, Math.min(g.width - PLAYER_W / 2, nx));
}

const zipY = (z: Zip, x: number) => z.y1 + ((z.y2 - z.y1) * (x - z.x1)) / (z.x2 - z.x1);
const zipDir = (z: Zip) => (z.x2 > z.x1 ? 1 : -1) as 1 | -1;
const onZip = (z: Zip, x: number) => (x - z.x1) * zipDir(z) >= -0.6 && (z.x2 - x) * zipDir(z) > 0.5;
const zipNear = (g: SharkGame, p: Player, slack: number) => g.zips.find(z => onZip(z, p.x) && Math.abs(zipY(z, p.x) - (p.y + HANG)) < slack);
function grabClimb(p: Player, c: Climb) { p.climb = c; p.x = c.x; p.vx = 0; p.vy = 0; p.ground = null; p.swimming = false; }
function grabZip(g: SharkGame, p: Player, z: Zip) { p.zip = z; p.y = zipY(z, p.x) - HANG; p.vx = 0; p.vy = 0; p.ground = null; p.climb = null; g.events.push({ type: 'zip' }); }

function lose(g: SharkGame, reason: LoseReason, shark = -1) {
  const p = g.player;
  g.dying = { t: 0, reason, shark };
  p.climb = null; p.zip = null; p.vx = 0; p.ground = null;
  const s = g.sharks.find(k => k.id === shark);
  if (s) {
    // Se da vuelta hacia el bombero con la boca bien abierta (si estaba nadando, sale del agua de un salto).
    s.state = 'bite'; s.t = 0;
    s.dir = p.x >= s.x ? 1 : -1; s.vx = s.dir * 1.2;
    if (s.y < 0) { s.vy = Math.max(s.vy, 12); s.x = p.x - s.dir * 0.3 * sharkLen(s); } // sale de abajo tuyo, para arriba
  }
  g.events.push({ type: 'lose', reason });
}

export function step(g: SharkGame, input: Input, dt: number) {
  if (dt <= 0 || g.won || g.over) return;
  dt = Math.min(dt, 0.05);
  const p = g.player;
  if (g.dying) {
    g.dying.t += dt;
    const s = g.sharks.find(k => k.id === g.dying!.shark);
    if (s) {
      // El tiburón sigue su salto: primero acerca la boca al bombero, la cierra y se lo traga entero; después
      // cae al agua y se hunde.
      const wasUp = s.y > 0;
      if (s.y > SHARK_DEPTH - 0.6 || s.vy > 0) { s.vy -= SHARK_G * dt; s.y += s.vy * dt; s.x += s.vx * dt; }
      else { s.vy = 0; s.vx = 0; }
      // Mientras cierra la boca el bombero queda metido entre las mandíbulas; después va adentro.
      const m = sharkMouth(s), k = g.dying.t < CHOMP ? Math.min(1, dt * 16) : 1;
      p.x += (m.x - p.x) * k; p.y += (m.y - PLAYER_H * 0.5 - p.y) * k; p.swimming = false;
      if (wasUp && s.y <= 0) g.events.push({ type: 'splash' });
    }
    if (g.dying.t > DIE_T) { g.over = true; g.events.push({ type: 'gameover' }); }
    return;
  }
  g.time += dt;
  const t = g.time;
  if (t >= TIME_LIMIT) { g.time = TIME_LIMIT; lose(g, 'time'); return; }
  const left = TIME_LIMIT - t;
  if (left <= 60 && !g.hurried) { g.hurried = 60; g.events.push({ type: 'hurry', left: 60 }); }
  else if (left <= 30 && g.hurried === 60) { g.hurried = 30; g.events.push({ type: 'hurry', left: 30 }); }

  // La corriente mueve las cosas que flotan (y lo que tienen arriba).
  const movers: Mover[] = [...g.debris, ...g.rescues.filter(r => r.state === 'drift')];
  for (const m of movers) {
    let nx = m.plat.x + m.dir * m.speed * dt;
    if (nx < m.min) { nx = m.min; m.dir = 1; } else if (nx > m.max) { nx = m.max; m.dir = -1; }
    m.plat.dx = nx - m.plat.x; m.plat.x = nx;
  }

  movePlayer(g, input, dt, t);
  rescue(g);
  sharks(g, dt);

  // Llegan más tiburones con el tiempo; los rescatados (o los que se llevaron) se reponen.
  const want = sharksAt(t);
  if (g.sharks.length < want) {
    const fresh = t >= MAKO_AT && !g.seen.has('mako') ? 'mako' : t >= TIGRE_AT && !g.seen.has('tigre') ? 'tigre' : null;
    addShark(g, fresh ?? pick(g.rand, TYPES_AT(t)));
    if (g.sharks.length % 3 === 0) g.events.push({ type: 'more', count: g.sharks.length });
  }
  for (const r of g.rescues) if (r.state !== 'drift' && t - r.at > 3) { r.state = 'drift'; r.at = -1; } // marca para reponer
  const gone = g.rescues.filter(r => r.at === -1);
  if (gone.length) { g.rescues = g.rescues.filter(r => r.at !== -1); for (let i = 0; i < gone.length; i++) addRescue(g); }

  const w = windAt(t) * g.windPower, wind = Math.abs(w) > 0.3 ? Math.sign(w) : 0;
  if (wind && wind !== g.gust) g.events.push({ type: 'wind', dir: wind as 1 | -1 });
  if (wind) g.gust = wind;
}

function movePlayer(g: SharkGame, input: Input, dt: number, t: number) {
  const p = g.player;
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir) p.facing = dir > 0 ? 1 : -1;
  p.climbCooldown = Math.max(0, p.climbCooldown - dt);
  const wind = windAt(t) * g.windPower;

  // Colgado de la tirolesa: baja solo hasta la otra punta (con ↓ te soltás antes).
  if (p.zip) {
    const z = p.zip, zd = zipDir(z);
    p.facing = zd;
    p.x = zd > 0 ? Math.min(z.x2, p.x + ZIP_SPEED * dt) : Math.max(z.x2, p.x - ZIP_SPEED * dt);
    p.y = zipY(z, p.x) - HANG;
    if (p.x === z.x2 || input.down) { p.zip = null; p.vy = 0; p.climbCooldown = 0.4; }
    return;
  }

  // En una escalera, soga, caño o poste: ↑ sube, ↓ baja, de costado se salta.
  if (p.climb) {
    const c = p.climb, vertical = (input.up || input.jump ? 1 : 0) - (input.down ? 1 : 0);
    if (dir) { p.vx = dir * 5; p.vy = 8; p.climb = null; p.climbCooldown = 0.4; g.events.push({ type: 'jump' }); }
    else {
      p.y += vertical * CLIMB * dt;
      if (p.y >= c.y2 && vertical > 0) { p.y = c.y2; p.vy = 10; p.vx = 0; p.climb = null; p.climbCooldown = 0.5; }
      else if (p.y <= Math.max(c.y1, WATER_Y) && vertical < 0) { p.y = Math.max(c.y1, WATER_Y); p.vy = 0; p.climb = null; p.climbCooldown = 0.5; }
      else { p.y = Math.max(c.y1, Math.min(c.y2, p.y)); return; }
    }
  }

  // Nadando: despacio, se sale saltando o agarrándose de una escalera, soga o poste.
  if (p.swimming) {
    p.vx = dir * SWIM;
    p.x = moveX(g, p, p.x + (p.vx + wind * WIND * 0.5) * dt);
    p.y = WATER_Y;
    if (input.up && !p.climbCooldown) {
      const c = g.climbs.find(c => Math.abs(p.x - c.x) < 0.5 && c.y1 <= p.y + 0.3 && c.y2 > p.y + 0.6);
      if (c) { grabClimb(p, c); p.y = Math.max(p.y, c.y1); return; }
    }
    if (input.jump) { p.swimming = false; p.vy = SWIM_JUMP; g.events.push({ type: 'jump' }); }
    else return;
  }

  p.vx = dir * RUN;
  const ride = p.ground?.dx ?? 0;
  p.x = moveX(g, p, p.x + (p.vx + wind * (p.ground ? WIND : WIND_AIR)) * dt + ride);
  if (p.ground) p.y = p.ground.y;
  if (p.ground && !overlapsX(p, p.ground)) { p.ground = null; p.coyote = 0.1; p.vy = 0; }
  p.coyote = Math.max(0, p.coyote - dt);

  // Parado al lado de una escalera: ↑ te agarrás para subir, ↓ (desde arriba) para bajar; abajo de una tirolesa, ↑ te colgás.
  if (p.ground && !p.climbCooldown) {
    if (input.up) {
      const c = g.climbs.find(c => Math.abs(p.x - c.x) < 0.45 && c.y1 <= p.y + 0.35 && c.y2 > p.y + 0.6);
      if (c) { grabClimb(p, c); p.y = Math.max(p.y, c.y1); return; }
      const z = zipNear(g, p, 0.6);
      if (z) { grabZip(g, p, z); return; }
    } else if (input.down) {
      const c = g.climbs.find(c => Math.abs(p.x - c.x) < 0.45 && c.y2 >= p.y - 0.05 && c.y2 <= p.y + 0.7 && c.y1 < p.y - 0.5);
      if (c) { grabClimb(p, c); p.y = Math.min(p.y - 0.2, c.y2 - 0.4); return; }
    }
  }

  if (input.jump && (p.ground || p.coyote > 0)) {
    p.vy = JUMP; p.ground = null; p.coyote = 0;
    g.events.push({ type: 'jump' });
  }

  if (!p.ground && (input.jump || input.up) && !p.climbCooldown) {
    const c = g.climbs.find(c => Math.abs(p.x - c.x) < 0.5 && p.y + PLAYER_H * 0.6 > c.y1 && p.y < c.y2 && p.y > WATER_Y + 0.2);
    if (c) { grabClimb(p, c); return; }
    const z = zipNear(g, p, 0.35);
    if (z) { grabZip(g, p, z); return; }
  }

  if (!p.ground) {
    const prev = p.y;
    p.vy = Math.max(-MAX_FALL, p.vy - GRAVITY * dt);
    p.y += p.vy * dt;
    if (p.vy <= 0) {
      const land = g.plats.find(pl => overlapsX(p, pl) && prev >= pl.y - 0.02 && p.y <= pl.y);
      if (land) {
        p.y = land.y; p.vy = 0; p.ground = land;
        if (land.kind === 'awning') { p.vy = BOUNCE; p.ground = null; g.events.push({ type: 'bounce' }); }
      } else if (p.y <= WATER_Y) { p.y = WATER_Y; p.vy = 0; p.swimming = true; g.events.push({ type: 'splash' }); }
    }
  }
}

// Se rescata tocando al que flota (o estirándote desde algo bajito o desde el agua).
function rescue(g: SharkGame) {
  const p = g.player;
  for (const r of g.rescues) {
    if (r.state !== 'drift') continue;
    const dy = p.y - FLOAT_Y;
    if (Math.abs(rescueX(r) - p.x) <= GRAB_X + r.plat.w / 2 - 0.2 && dy <= GRAB_Y && dy >= -0.8) {
      r.state = 'saved'; r.at = g.time; r.fromX = rescueX(r); r.fromY = FLOAT_Y;
      removePlat(g, r.plat);
      g.saved++; g.savedKinds.push(r.kind);
      g.events.push({ type: 'saved', kind: r.kind, count: g.saved });
      if (g.saved >= GOAL) { g.won = true; g.events.push({ type: 'win' }); return; }
    }
  }
}

export const sharkLen = (s: Shark) => SHARK_LEN * SHARKS[s.type].size;
// La caja del tiburón cuando salta (centro en x, y).
export const sharkBox = (s: Shark) => { const L = sharkLen(s); return { x1: s.x - 0.32 * L, x2: s.x + 0.32 * L, y1: s.y - 0.1 * L, y2: s.y + 0.1 * L }; };
// Para dónde mira y cuánto levanta la trompa (en radianes, para arriba) según cómo se mueve.
export function sharkPose(s: Shark) {
  const out = s.state === 'jump' || s.state === 'bite';
  const dir: 1 | -1 = out ? (s.vx > 0.05 ? 1 : s.vx < -0.05 ? -1 : s.dir) : s.dir;
  return { dir, a: out ? Math.atan2(s.vy, 4) * 0.9 : 0 };
}
// Dónde está la boca (en el medio de las mandíbulas).
export function sharkMouth(s: Shark) {
  const L = sharkLen(s), { dir, a } = sharkPose(s), along = 0.4 * L, down = 0.07 * L;
  return { x: s.x + dir * (Math.cos(a) * along + Math.sin(a) * down), y: s.y + Math.sin(a) * along - Math.cos(a) * down };
}
// ¿El bombero está al alcance de este tiburón? (cerca y bajito, o nadando)
export function exposed(g: SharkGame, s: Shark, reach: number) {
  const p = g.player;
  if (g.dying || Math.abs(p.x - s.x) > SIGHT) return false;
  return p.swimming || p.y < reach - 0.05;
}

function sharks(g: SharkGame, dt: number) {
  const p = g.player;
  for (const s of g.sharks) {
    const spec = SHARKS[s.type], lane = g.lanes[s.lane], home = laneCenter(lane), L = sharkLen(s);
    // Nada por toda la ciudad (también por delante de los edificios); para buscarte va a cualquier lado.
    const a = 0.8, b = g.width - 0.8, ra = Math.max(a, home - ROAM), rb = Math.min(b, home + ROAM);
    const toward = (x: number, v: number) => { const d = Math.max(a, Math.min(b, x)) - s.x; if (d) s.dir = d > 0 ? 1 : -1; s.x += Math.sign(d) * Math.min(Math.abs(d), v * dt); return Math.abs(d); };
    const swimmer = p.swimming && Math.abs(p.x - s.x) < SIGHT * 1.5;
    if (s.state === 'jump') {
      s.vy -= SHARK_G * dt; s.y += s.vy * dt; s.x = Math.max(a, Math.min(b, s.x + s.vx * dt));
      const box = sharkBox(s);
      if (!g.dying && p.x + PLAYER_W / 2 > box.x1 && p.x - PLAYER_W / 2 < box.x2 && p.y < box.y2 && p.y + PLAYER_H > box.y1) { s.state = 'bite'; lose(g, 'shark', s.id); return; }
      for (const r of g.rescues) {
        if (r.state !== 'drift') continue;
        if (Math.abs(rescueX(r) - s.x) < 0.3 * L && box.y2 > FLOAT_Y) { r.state = 'taken'; r.at = g.time; r.fromX = rescueX(r); r.fromY = FLOAT_Y; removePlat(g, r.plat); g.events.push({ type: 'taken', kind: r.kind }); }
      }
      if (s.y <= SHARK_DEPTH && s.vy < 0) { s.y = SHARK_DEPTH; s.vy = 0; s.state = 'patrol'; s.rest = SHARK_REST; s.target = 0; g.events.push({ type: 'splash' }); }
      continue;
    }
    const prey = s.target === PLAYER_TARGET ? null : g.rescues.find(r => r.id === s.target && r.state === 'drift');
    if (s.state === 'warn') {
      s.t -= dt;
      if (s.t <= 0) {
        const tx = s.target === PLAYER_TARGET ? p.x : prey ? rescueX(prey) : s.x;
        const apex = spec.reach - 0.1 * L;
        s.state = 'jump'; s.y = SHARK_DEPTH; s.vy = Math.sqrt(2 * SHARK_G * (apex - SHARK_DEPTH)); s.vx = Math.max(-1.5, Math.min(1.5, (tx - s.x) * 1.2));
        g.events.push({ type: 'sharkJump' });
      }
      continue;
    }
    if (swimmer) {
      // Si te caés al agua, va derecho a buscarte.
      s.state = 'chase';
      const d = toward(p.x, spec.chase);
      if (d < 0.35 + 0.4 * spec.size) { s.y = SHARK_DEPTH; s.vy = 0; lose(g, 'shark', s.id); return; }
      continue;
    }
    s.rest = Math.max(0, s.rest - dt);
    s.hunger -= dt;
    if (s.state === 'chase') s.state = 'patrol';
    if (s.state === 'patrol' && !s.rest) {
      if (exposed(g, s, spec.reach)) { s.state = 'approach'; s.target = PLAYER_TARGET; }
      else if (s.hunger <= 0) {
        const r = g.rescues.find(r => r.state === 'drift' && Math.abs(rescueX(r) - s.x) < SIGHT + 2);
        if (r) { s.state = 'approach'; s.target = r.id; }
      }
    }
    if (s.state === 'approach') {
      const chasingPlayer = s.target === PLAYER_TARGET;
      const food = chasingPlayer ? null : g.rescues.find(r => r.id === s.target && r.state === 'drift');
      if (chasingPlayer ? !exposed(g, s, spec.reach) : !food) { s.state = 'patrol'; s.target = 0; }
      else {
        const d = toward(food ? rescueX(food) : p.x, chasingPlayer ? spec.chase : spec.chase * 0.7);
        if (d < 0.35) { s.state = 'warn'; s.t = spec.warn; if (!chasingPlayer) s.hunger = 10 + g.rand() * 12; }
        continue;
      }
    }
    // Patrulla de un lado a otro, pasando por delante de los edificios; a veces se da vuelta (el tigre de golpe
    // y muy seguido).
    s.x += s.dir * spec.speed * dt;
    if (s.x < ra) { s.x = Math.max(s.x, a); s.dir = 1; } else if (s.x > rb) { s.x = Math.min(s.x, b); s.dir = -1; }
    s.turn -= dt;
    if (s.turn <= 0) { s.dir = -s.dir as 1 | -1; s.turn = s.type === 'tigre' ? 1.2 + g.rand() * 2.5 : 4 + g.rand() * 6; }
  }
}

export const takeEvents = (g: SharkGame) => g.events.splice(0);
export const timeLeft = (g: SharkGame) => Math.max(0, TIME_LIMIT - g.time);
export { laneOf };
