// Los grises atacan a los civiles, colocan explosivos y reciben refuerzos de los OVNIs.
// Al final de los diez minutos, la población humana debe superar a los alienígenas.
//
// Todo se mide en "unidades" (una persona mide 1). El piso de la calle es y = 0 y hacia arriba es positivo.
import { ANOMALIES, fitsPlace, shuffledAnomalies, type Anomaly } from './invasionAnomalies';

export const GAME_SECONDS = 600;
export const HUMAN_TOTAL = 600; // (desde las correcciones 17: alcanza para que no quede ningún departamento vacío)
const STREET_PEOPLE = 50; // los que andan por la vereda
export const ALIEN_TOTAL = 300;
export const REVEAL_EVERY = 30, REVEAL_TIME = 5;
export const PERSON_H = 1, PERSON_W = 0.42;
export const ALIEN_SIZE = 1.3; // los grises miden 1,3 veces una persona
export const SIDEWALK_Y = 0, ROAD_Y = -1.6;
// El ovni (la imagen de Kombat Penales) va de 4 m arriba del centro (la cúpula) a 3,7 m abajo (el emisor).
// Zona de impacto de cada ovni (centro `dy` arriba de `u.y`, medio alto y medio ancho).
// 'pen': el de Kombat Penales (desde el principio). 'mother': OVNI.png del usuario, los que larga la nave nodriza;
// `u.y` es el borde del platillo, de la cúpula (3,5 m arriba) a la panza (1,35 m abajo).
const UFO_BOX = { pen: { dy: 0.15, hh: 3.85, hw: 6.4 }, mother: { dy: 1.08, hh: 2.45, hw: 6.2 } };
const onUfo = (u: Ufo, x: number, y: number) => { const b = UFO_BOX[u.kind]; return Math.abs(x - u.x) < b.hw && Math.abs(y - (u.y + b.dy)) < b.hh; };
export const UFO_KILLS = 5; // cada ovni derribado cuenta como 5 grises muertos
// Los ovnis de Kombat Penales: el primero a los 15 s y uno más cada 150 s, hasta 3 (los derribados no vuelven).
export const PEN_UFO_FROM = 15;
export const penUfosAt = (t: number) => t < PEN_UFO_FROM ? 0 : Math.min(3, 1 + Math.floor((t - PEN_UFO_FROM) / 150));
// La nave nodriza: va y viene de punta a punta de la cuadra (una vuelta cada 100 s), siempre en movimiento; cada
// tanto baja mucho (hasta 20 m, detrás de los edificios) y vuelve a subir. Al aparecer baja desde 45 m más arriba.
export const MOTHER_W = 70, MOTHER_IN = 25;
export function motherAt(width: number, t: number) {
  const k = Math.min(1, Math.max(0, (t - MOTHER_FROM) / MOTHER_IN)), ease = 1 - (1 - k) ** 3, u = t - MOTHER_FROM;
  const x = width / 2 - Math.cos(u * Math.PI * 2 / 100) * (width / 2 + 5);
  const dip = 20 * Math.max(0, Math.sin(u * Math.PI * 2 / 47 - 1.2)) ** 3;
  return { x, bottom: CITY_TOP - 8 - dip + (1 - ease) * 45 + Math.sin(t * 0.4) * 0.6, k };
}
export const MOTHER_FROM = 300; // a los 5 minutos aparece la nave nodriza (arriba de los edificios)
export const UFO_FROM = 480; // a los 8 minutos llegan los ovnis
export const RAIN_FROM = 180; // a los 3 minutos empieza a llover
export const MAG = 10, BOLT_TIME = 0.75, RELOAD_TIME = 1.5; // (10 balas: el doble desde las correcciones 6; recarga en 1,5 s, lo que dura el sonido)
export type Outcome = 'won' | 'time';
export const WEAPONS = {
  rifle: { name: 'Rifle de francotirador', mag: MAG, cycle: BOLT_TIME, reload: RELOAD_TIME, zoom: 520, start: 58 },
  machine: { name: 'Ametralladora', mag: 48, cycle: 0.115, reload: 1.5, zoom: 120, start: 43 },
  bazooka: { name: 'Bazooka', mag: 2, cycle: 0.5, reload: 3.1, zoom: 85, start: 36 },
} as const;
export type Weapon = keyof typeof WEAPONS;
export const ALIEN_POINTS = 100;
export const BAZOOKA_RADIUS = 4.2;
// La calle sigue `SIDE_W` metros a cada lado de la cuadra (con edificios de decorado): la gente y los aliens de la
// vereda caminan también por ahí y la vista llega hasta el final.
// Los autos andan por toda la calle que se ve (la cuadra más media pantalla de cada lado) y recién dan la vuelta
// afuera de la pantalla, así no aparecen ni desaparecen en el medio de la calle.
const CAR_OUT = 85;
export const SIDE_W = 0; // (el mapa es solo la cuadra, como al principio)
export const streetLo = () => -SIDE_W + 0.5, streetHi = (g: { width: number }) => g.width + SIDE_W - 0.5;
export const ROCKET_TIME = 5; // el misil de la bazooka tarda 5 s en llegar
// Especies de aliens (mismo orden que `ALIEN_SPECIES` en invasionAliens: la especie es `id % 6`).
// `size`: cuánto más grande que el gris; `hp`: puntos de vida; `points`: lo que suma matarlo; `label`: el nombre en pantalla.
export const ALIEN_KINDS = [
  { name: 'gris', label: 'Gris', size: 1, hp: 1, points: 10 }, { name: 'anfibio', label: 'Anfibio', size: 1.3, hp: 3, points: 50 },
  { name: 'brutox', label: 'Brutox', size: 1.5, hp: 10, points: 60 }, { name: 'esporal', label: 'Esporal', size: 1.1, hp: 2, points: 20 },
  { name: 'mantis', label: 'Mantis', size: 1.25, hp: 5, points: 40 }, { name: 'reptiliano', label: 'Reptiliano', size: 1.1, hp: 2, points: 30 },
] as const;
// La sangre de cada especie (mismo orden que `ALIEN_KINDS`): color principal, claro y oscuro (r, g, b).
// Gris verde, Anfibio celeste, Brutox violeta, Esporal amarillo, Mantis rosa, Reptiliano azul.
export type RGB = [number, number, number];
export const BLOOD: { main: RGB; pale: RGB; dark: RGB }[] = [
  { main: [74, 222, 128], pale: [190, 242, 100], dark: [20, 83, 45] },
  { main: [103, 232, 249], pale: [207, 250, 254], dark: [21, 94, 117] },
  { main: [168, 85, 247], pale: [233, 213, 255], dark: [76, 29, 149] },
  { main: [250, 204, 21], pale: [254, 240, 138], dark: [113, 63, 18] },
  { main: [244, 114, 182], pale: [251, 207, 232], dark: [131, 24, 67] },
  { main: [59, 130, 246], pale: [191, 219, 254], dark: [30, 58, 138] },
];
export const bloodOf = (p: { id: number }) => BLOOD[p.id % BLOOD.length];
const hex = (c: RGB) => '#' + c.map(n => n.toString(16).padStart(2, '0')).join('');
// Daño de cada tiro: el francotirador saca 10 puntos de vida, la ametralladora 1 (la explosión de la bazooka mata siempre).
// Cada humano que matás vos resta estos puntos.
export const HUMAN_PENALTY = 50;
export const DAMAGE: Record<Weapon, number> = { rifle: 10, machine: 1, bazooka: 99 };
export const alienKind = (p: { id: number }) => ALIEN_KINDS[p.id % ALIEN_KINDS.length];
export const WALL_BREAK = 14; // balas de ametralladora que aguanta un departamento antes de derrumbarse
export interface Rocket { x: number; y: number; t0: number; ufo?: number; from?: { x: number; y: number } } // `from`: la boca de la bazooka al disparar (en metros) // si apuntaste a un ovni, el cohete lo sigue

export type Style = 'brick' | 'stucco' | 'glass' | 'office' | 'construction' | 'old' | 'hotel';
export type Theme = 'living' | 'kitchen' | 'bedroom' | 'bath' | 'office' | 'gym' | 'kids' | 'dining' | 'studio' | 'laundry' | 'shop' | 'site' | 'lobby';
export type Shop = 'bar' | 'cafe' | 'kiosco' | 'pizzeria' | 'farmacia' | 'peluqueria' | 'verduleria' | 'gimnasio' | 'lavanderia' | 'ferreteria' | 'libreria' | 'heladeria';
export type Item =
  | 'sofa' | 'tv' | 'armchair' | 'bookshelf' | 'plant' | 'lamp' | 'rug' | 'stove' | 'fridge' | 'kitchenTable' | 'sink' | 'bed' | 'wardrobe'
  | 'desk' | 'mirror' | 'tub' | 'washbasin' | 'computerDesk' | 'whiteboard' | 'cooler' | 'treadmill' | 'weights' | 'mat' | 'toys' | 'bunk'
  | 'diningTable' | 'cabinet' | 'easel' | 'piano' | 'washer' | 'counter' | 'stool' | 'cafeTable' | 'oven' | 'shelves' | 'barberChair'
  | 'crates' | 'freezer' | 'bricks' | 'mixer' | 'scaffold' | 'lobbyDesk' | 'elevator' | 'fishbowl' | 'radio' | 'clock' | 'catBed' | 'dogBed'
  | 'toilet' | 'nightstand' | 'sideTable' | 'filing' | 'printer' | 'bin' | 'coatRack';
export type Activity =
  | 'walk' | 'stand' | 'tv' | 'sleep' | 'cook' | 'work' | 'read' | 'eat' | 'drink' | 'clean' | 'groom' | 'run' | 'lift' | 'yoga' | 'paint'
  | 'play' | 'serve' | 'cut' | 'hammer' | 'carry' | 'talk' | 'phone' | 'dance' | 'fold' | 'jog' | 'flee' | 'sit' | 'piano' | 'shop';
export interface Furniture { item: Item; x: number; w: number }
export interface Spot { x: number; act: Activity; facing: 1 | -1 }
export interface Room {
  id: number; b: number; floor: number; x1: number; x2: number; y: number; h: number; theme: Theme; shop?: Shop; seed: number;
  furniture: Furniture[]; spots: Spot[]; fire: number; fireAt: number; burnt: number; destroyed: number; lights: boolean;
  wear?: number; // balas de ametralladora que recibió (con `WALL_BREAK` se derrumba)
}
export interface Building { id: number; x: number; w: number; floors: number; fh: number; ground: number; style: Style; hue: number; tone: number; top: number; roof: 'flat' | 'tank' | 'antenna' | 'garden' | 'sign'; rooms: number[]; sign?: string }
export interface Look { skin: number; hair: number; hat: number; shirt: number; shirt2: number; pattern: number; pants: number; shoes: number; size: number; kid: boolean }
export type SabotageKind = 'lighter' | 'ray' | 'box';
export interface Sabotage { kind: SabotageKind; t0: number; x: number; done: boolean; carryUntil: number; shot?: { x: number; y: number; time: number } }
export interface ActiveAnomaly { id: number; t0: number; until: number; seed: number }
export interface Person {
  id: number; room: number; x: number; y: number; dir: 1 | -1; speed: number; act: Activity; actUntil: number; tx: number; moving: boolean;
  look: Look; alien: boolean; revealPhase: number; anomaly: ActiveAnomaly | null; nextAnomaly: number; sabotage: Sabotage | null; nextSabotage: number;
  dead: { t: number; alien: boolean; head: boolean } | null; panic: number; shelter?: { room: number; x: number }; talk: number; gone: boolean; dog: boolean; jx: number; job: 'resident' | 'worker' | 'walker' | 'jogger';
  // Aliens: se quedan mirando fijo a la mira y hablan por su intercomunicador.
  stareUntil: number; nextStare: number; comm: { t0: number; until: number } | null; nextComm: number;
  hp?: number; hurt?: number; // aliens grandes: disparos que les quedan y cuándo los lastimaron por última vez
}
export interface Box { id: number; room: number; x: number; y: number; explosive: boolean; t0: number; explodeAt: number; defused: boolean; exploded: boolean; hit: boolean; kind: number }
export interface Ufo { id: number; kind: 'pen' | 'mother'; ty: number; x: number; y: number; vx: number; t0: number; beam: { room: number; t0: number; until: number; x: number; y: number } | null; nextBeam: number; wobble: number }
export interface Car { id: number; x: number; dir: 1 | -1; speed: number; hue: number; kind: 'car' | 'taxi' | 'bus' | 'van' | 'police'; lane: number; sprite?: string } // `sprite`: el vehículo de la hoja del usuario (`VEHICLES` en invasionArt)
// Los vehículos que andan y los chocados que quedaron tirados (nombres de la hoja de sprites del usuario).
export const MOVING_VEHICLES = ["blanco", "taxi", "azul", "rojo", "plata", "negro", "policia", "nypd", "ambulancia", "tv", "blindado", "militar", "pickup_roja", "pickup_gris", "suv_azul", "suv_negra", "jeep", "furgon", "bus_azul", "bus_rojo", "escolar", "dos_pisos", "articulado", "micro"];
export const WRECKS = ["choc1", "choc2", "choc3", "choc4", "volcado", "choc5"];
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; kind: 'blood' | 'spark' | 'glass' | 'smoke' | 'debris' | 'ember' | 'goo' | 'wreck'; spin?: number }
export interface Decal { room: number; x: number; y: number; glass: boolean; t: number; goo?: boolean; blood?: boolean; size?: number; crater?: number; tint?: number } // `tint`: especie (color de la baba)
export interface Blast { x: number; y: number; t: number; size: number; green?: boolean; tint?: number; big?: boolean; bazooka?: boolean; ufo?: boolean }
export type InvasionEvent =
  | { type: 'shot'; x: number; y: number } | { type: 'kill'; x: number; y: number; head: boolean; anomaly: number | null }
  | { type: 'civilian'; x: number; y: number } | { type: 'bomb'; x: number; y: number } | { type: 'defused'; x: number; y: number } | { type: 'boxHit'; x: number; y: number }
  | { type: 'ufoPing'; x: number; y: number } | { type: 'explosion'; x: number; y: number; bazooka?: boolean } | { type: 'fire'; x: number; y: number }
  | { type: 'laser'; x: number; y: number } | { type: 'ufoArrive'; kind: Ufo['kind'] } | { type: 'mother' } | { type: 'moreAliens'; count: number } | { type: 'scream'; x: number; y: number; id: number } | { type: 'died'; x: number; y: number; id: number; byPlayer: boolean }
  | { type: 'lighter'; x: number; y: number } | { type: 'ray'; x: number; y: number } | { type: 'glass'; x: number; y: number } | { type: 'miss'; x: number; y: number }
  | { type: 'comm'; x: number; y: number } | { type: 'thunder'; x: number } | { type: 'rain' } | { type: 'end' }
  | { type: 'rocketHit'; x: number; y: number; hit: 'ufoDestroyed' | 'alien' | 'civilian' | 'blast' }
  | { type: 'hurt'; x: number; y: number; left: number } | { type: 'collapse'; x: number; y: number };
export interface Invasion {
  width: number; buildings: Building[]; rooms: Room[]; people: Person[]; boxes: Box[]; ufos: Ufo[]; cars: Car[];
  particles: Particle[]; decals: Decal[]; blasts: Blast[]; rockets: Rocket[];
  time: number; kills: number; points: number; killsBy: number[]; civilians: number; headshots: number; defused: number; shots: number; hits: number; over: boolean; outcome: Outcome | null;
  events: InvasionEvent[]; deck: number[]; deckPos: number; rand: () => number; nextId: number; seen: number[]; killedAnomalies: number[];
  aliensWanted: number; ufosLaunched: number; penLaunched: number; told: { ufo: boolean; rain: boolean; mother: boolean };
  aim: { x: number; y: number }; // dónde está apuntando la mira (los aliens se dan cuenta)
  lightning: { t: number; x: number } | null;
}

export function rng(seed: number) {
  let s = (Math.floor(seed) % 2147483646) + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const pick = <T,>(r: () => number, list: readonly T[]) => list[Math.floor(r() * list.length)];
const between = (r: () => number, a: number, b: number) => a + r() * (b - a);

// ---------- La ciudad ----------
const STYLE_FLOORS: Record<Style, [number, number]> = { brick: [14, 17], stucco: [12, 15], glass: [19, 23], office: [17, 21], construction: [13, 16], old: [10, 13], hotel: [15, 19] };
const SHOPS: Shop[] = ['bar', 'cafe', 'kiosco', 'pizzeria', 'farmacia', 'peluqueria', 'verduleria', 'gimnasio', 'lavanderia', 'ferreteria', 'libreria', 'heladeria'];
export const SHOP_NAMES: Record<Shop, string> = {
  bar: 'BAR EL FARO', cafe: 'CAFÉ TORTONI', kiosco: 'KIOSCO 24HS', pizzeria: 'PIZZERÍA', farmacia: 'FARMACIA', peluqueria: 'PELUQUERÍA',
  verduleria: 'VERDULERÍA', gimnasio: 'GIMNASIO', lavanderia: 'LAVADERO', ferreteria: 'FERRETERÍA', libreria: 'LIBRERÍA', heladeria: 'HELADERÍA',
};
const HOME_THEMES: Theme[] = ['living', 'kitchen', 'bedroom', 'living', 'kitchen', 'bedroom', 'bath', 'gym', 'kids', 'dining', 'studio', 'laundry', 'office'];
// Cómo se amueblan las habitaciones: [cosa, ancho, qué se hace ahí (o nada), hacia dónde se mira].
type Layout = [Item, number, Activity | null, (1 | -1)?][];
const LAYOUTS: Record<Theme, Layout[]> = {
  living: [[['tv', 1.1, null], ['rug', 0.1, null], ['sofa', 2, 'tv', -1], ['sideTable', 0.5, null], ['plant', 0.6, null], ['bookshelf', 1.2, 'read'], ['lamp', 0.4, null]], [['armchair', 1, 'read'], ['sideTable', 0.5, null], ['fishbowl', 0.6, null], ['tv', 1.1, null], ['sofa', 2, 'tv', -1], ['radio', 0.6, 'dance']], [['coatRack', 0.4, null], ['tv', 1.1, null], ['rug', 0.1, null], ['sofa', 2, 'tv', -1], ['lamp', 0.4, null], ['bookshelf', 1.2, 'read']]],
  kitchen: [[['fridge', 0.9, 'stand'], ['stove', 1, 'cook'], ['sink', 1.1, 'clean'], ['kitchenTable', 1.6, 'eat'], ['bin', 0.4, null], ['clock', 0.4, null]], [['kitchenTable', 1.6, 'eat'], ['bin', 0.4, null], ['sink', 1.1, 'clean'], ['stove', 1, 'cook'], ['fridge', 0.9, 'stand'], ['plant', 0.5, null]]],
  bedroom: [[['wardrobe', 1.2, 'stand'], ['nightstand', 0.5, null], ['bed', 2.2, 'sleep'], ['nightstand', 0.5, null], ['desk', 1.2, 'work'], ['dogBed', 0.8, null]], [['mirror', 0.8, 'groom'], ['nightstand', 0.5, null], ['bed', 2.2, 'sleep'], ['catBed', 0.6, null], ['wardrobe', 1.2, 'stand']]],
  bath: [[['washbasin', 0.8, 'groom'], ['toilet', 0.6, null], ['tub', 1.8, 'groom'], ['bin', 0.3, null]]],
  office: [[['computerDesk', 1.4, 'work'], ['computerDesk', 1.4, 'work'], ['cooler', 0.5, 'talk'], ['whiteboard', 1.3, 'talk'], ['filing', 0.6, null], ['plant', 0.5, null]], [['computerDesk', 1.4, 'work'], ['printer', 0.6, 'stand'], ['shelves', 1, 'read'], ['computerDesk', 1.4, 'work'], ['filing', 0.6, null], ['clock', 0.4, null]]],
  gym: [[['treadmill', 1.6, 'run'], ['weights', 1.1, 'lift'], ['mat', 1.6, 'yoga'], ['radio', 0.5, null]]],
  kids: [[['bunk', 1.8, 'sleep'], ['toys', 1.4, 'play'], ['desk', 1.1, 'work'], ['lamp', 0.4, null]]],
  dining: [[['cabinet', 1.2, null], ['diningTable', 2.4, 'eat'], ['plant', 0.6, null], ['clock', 0.4, null]]],
  studio: [[['easel', 1, 'paint'], ['piano', 1.6, 'piano'], ['plant', 0.6, null], ['lamp', 0.4, null]]],
  laundry: [[['washer', 0.9, 'fold'], ['washer', 0.9, 'fold'], ['shelves', 1, 'stand'], ['plant', 0.5, null]]],
  shop: [],
  site: [[['bricks', 1.2, 'carry'], ['mixer', 1.3, 'hammer'], ['scaffold', 1.6, 'hammer'], ['bricks', 1, 'carry']]],
  lobby: [[['plant', 0.6, null], ['lobbyDesk', 2, 'work'], ['elevator', 1.4, 'stand'], ['armchair', 1, 'read']]],
};
const SHOP_LAYOUTS: Record<Shop, Layout> = {
  bar: [['counter', 3, 'serve'], ['stool', 0.5, 'drink'], ['stool', 0.5, 'drink'], ['cafeTable', 1.1, 'drink'], ['cafeTable', 1.1, 'talk']],
  cafe: [['counter', 2.4, 'serve'], ['cafeTable', 1.1, 'drink'], ['cafeTable', 1.1, 'read'], ['cafeTable', 1.1, 'eat']],
  kiosco: [['shelves', 1.4, 'stand'], ['counter', 1.8, 'serve'], ['freezer', 1, 'shop']],
  pizzeria: [['oven', 1.6, 'cook'], ['counter', 2, 'serve'], ['cafeTable', 1.1, 'eat'], ['cafeTable', 1.1, 'eat']],
  farmacia: [['shelves', 1.6, 'shop'], ['counter', 2, 'serve'], ['shelves', 1.6, 'shop']],
  peluqueria: [['mirror', 0.8, null], ['barberChair', 1, 'cut'], ['mirror', 0.8, null], ['barberChair', 1, 'cut'], ['plant', 0.5, null]],
  verduleria: [['crates', 1.8, 'shop'], ['counter', 1.6, 'serve'], ['crates', 1.8, 'shop']],
  gimnasio: [['treadmill', 1.6, 'run'], ['treadmill', 1.6, 'run'], ['weights', 1.1, 'lift'], ['mat', 1.6, 'yoga']],
  lavanderia: [['washer', 0.9, 'fold'], ['washer', 0.9, 'fold'], ['washer', 0.9, 'stand'], ['counter', 1.6, 'serve']],
  ferreteria: [['shelves', 1.6, 'shop'], ['counter', 2, 'serve'], ['crates', 1.2, 'shop']],
  libreria: [['shelves', 1.6, 'read'], ['shelves', 1.6, 'shop'], ['counter', 1.6, 'serve']],
  heladeria: [['freezer', 1.4, 'serve'], ['counter', 1.6, 'serve'], ['cafeTable', 1.1, 'eat']],
};
const SIGNS = ['HOTEL ESTRELLA', 'SEGUROS LA ROCA', 'RADIO 9', 'BANCO DEL SUR', 'CINE OPERA', 'TANGO'];

function furnish(r: () => number, room: Room, layout: Layout) {
  const free = room.x2 - room.x1 - 0.8;
  const total = layout.reduce((a, [, w]) => a + w, 0);
  const gap = Math.max(0.2, (free - total) / (layout.length + 1));
  let x = room.x1 + 0.4 + gap * between(r, 0.4, 1);
  for (const [item, w, act, facing] of layout) {
    if (x + w > room.x2 - 0.3) break;
    room.furniture.push({ item, x, w });
    if (act) room.spots.push({ x: x + w / 2, act, facing: facing ?? (r() < 0.5 ? 1 : -1) });
    x += w + gap;
  }
  if (!room.spots.length) room.spots.push({ x: (room.x1 + room.x2) / 2, act: 'stand', facing: 1 });
}

export function buildCity(seed = 20261014) {
  const r = rng(seed);
  const buildings: Building[] = [], rooms: Room[] = [];
  const order: Style[] = ['brick', 'glass', 'stucco', 'construction', 'office', 'old', 'hotel', 'brick', 'glass', 'stucco', 'office', 'old', 'construction', 'brick', 'hotel', 'glass'];
  let x = 2, shopIndex = Math.floor(r() * SHOPS.length);
  order.forEach((style, i) => {
    const [lo, hi] = STYLE_FLOORS[style];
    const floors = lo + Math.floor(r() * (hi - lo + 1));
    const w = style === 'glass' || style === 'office' ? between(r, 11, 14) : style === 'old' ? between(r, 9, 11) : between(r, 10, 13.5);
    const fh = style === 'old' ? between(r, 2.9, 3.1) : style === 'glass' || style === 'office' ? between(r, 2.5, 2.6) : between(r, 2.55, 2.8);
    const ground = style === 'construction' ? fh : 3.1;
    const b: Building = {
      id: i, x, w, floors, fh, ground, style, hue: Math.floor(r() * 360), tone: r(), top: ground + (floors - 1) * fh,
      roof: style === 'construction' ? 'flat' : pick(r, ['flat', 'tank', 'antenna', 'garden', 'sign'] as const), rooms: [],
    };
    if (b.roof === 'sign') b.sign = pick(r, SIGNS);
    buildings.push(b);
    for (let k = 0; k < floors; k++) {
      const y = k === 0 ? 0 : ground + (k - 1) * fh, h = k === 0 ? ground : fh;
      const inner = [x + 0.25, x + w - 0.25] as const;
      const make = (x1: number, x2: number, theme: Theme, shop?: Shop) => {
        const room: Room = { id: rooms.length, b: i, floor: k, x1, x2, y, h, theme, shop, seed: Math.floor(r() * 1e6), furniture: [], spots: [], fire: 0, fireAt: 0, burnt: 0, destroyed: 0, lights: r() < 0.85 };
        rooms.push(room); b.rooms.push(room.id);
        furnish(r, room, shop ? SHOP_LAYOUTS[shop] : pick(r, LAYOUTS[theme]));
      };
      if (style === 'construction') { make(inner[0], inner[1], 'site'); continue; }
      if (k === 0) {
        if (style === 'office' || style === 'hotel') { make(inner[0], inner[1], 'lobby'); continue; }
        const shop = SHOPS[shopIndex++ % SHOPS.length];
        make(inner[0], inner[1], 'shop', shop);
        continue;
      }
      if (style === 'office') { make(inner[0], inner[1], 'office'); continue; }
      // Departamentos: una, dos o tres habitaciones por piso.
      const n = w > 12 ? (r() < 0.5 ? 3 : 2) : r() < 0.25 ? 1 : 2;
      const cuts = Array.from({ length: n - 1 }, (_, j) => inner[0] + ((inner[1] - inner[0]) * (j + 1)) / n + between(r, -0.6, 0.6));
      const edges = [inner[0], ...cuts, inner[1]];
      for (let j = 0; j < n; j++) {
        const theme = style === 'hotel' ? (j === n - 1 && n > 1 ? 'bath' : 'bedroom') : pick(r, HOME_THEMES);
        make(edges[j], edges[j + 1], (edges[j + 1] - edges[j]) < 3.2 && theme !== 'bath' ? 'bath' : theme);
      }
    }
    x += w + (i % 3 === 2 ? between(r, 3.2, 4.2) : between(r, 1.2, 2.2)); // cada tanto, un pasaje más ancho
  });
  return { width: x + 2, buildings, rooms };
}
// Lo más alto de la cuadra (la vista y los ovnis se acomodan a esto).
export const CITY_TOP = Math.max(...buildCity().buildings.map(b => b.top)) + 1.5;

// ---------- La gente ----------
const ROOM_ACTS: Partial<Record<Theme, Activity[]>> = { living: ['tv', 'read', 'phone', 'dance', 'talk', 'walk'], kitchen: ['cook', 'eat', 'clean', 'stand', 'talk'], bedroom: ['sleep', 'groom', 'stand', 'phone', 'work'] };
function newLook(r: () => number, kid = false): Look {
  return { skin: r(), hair: r(), hat: r(), shirt: Math.floor(r() * 360), shirt2: Math.floor(r() * 360), pattern: Math.floor(r() * 3), pants: r(), shoes: r(), size: kid ? between(r, 0.62, 0.72) : between(r, 0.92, 1.08), kid };
}
function addPerson(g: Pick<Invasion, 'people' | 'rand' | 'nextId'>, room: number, x: number, y: number, job: Person['job'], kid = false): Person {
  const r = g.rand;
  const p: Person = {
    id: g.nextId++, room, x, y, dir: r() < 0.5 ? 1 : -1, speed: job === 'jogger' ? between(r, 3, 3.8) : between(r, 0.9, 1.4), act: job === 'jogger' ? 'jog' : 'walk', actUntil: 0, tx: x, moving: false,
    look: newLook(r, kid), alien: false, revealPhase: r() * REVEAL_EVERY, anomaly: null, nextAnomaly: 0, sabotage: null, nextSabotage: 0,
    dead: null, panic: 0, talk: 0, gone: false, dog: job === 'walker' && r() < 0.25, jx: 0, job,
    stareUntil: 0, nextStare: 0, comm: null, nextComm: 0,
  };
  g.people.push(p);
  return p;
}

export function newInvasion(seed?: number): Invasion {
  const s = seed ?? Math.floor(Math.random() * 2 ** 31);
  const city = buildCity();
  const rand = rng(s + 7);
  const g: Invasion = {
    ...city, people: [], boxes: [], ufos: [], cars: [], particles: [], decals: [], blasts: [], rockets: [],
    time: 0, kills: 0, points: 0, killsBy: ALIEN_KINDS.map(() => 0), civilians: 0, headshots: 0, defused: 0, shots: 0, hits: 0, over: false, outcome: null, events: [],
    deck: shuffledAnomalies(rand), deckPos: 0, rand, nextId: 1, seen: [], killedAnomalies: [], aliensWanted: aliensAt(0), ufosLaunched: 0, penLaunched: 0, told: { ufo: false, rain: false, mother: false },
    aim: { x: city.width / 2, y: 10 }, lightning: null,
  };
  // Gente en cada habitación (en las obras, albañiles; en los locales, el que atiende y algún cliente). Ningún lugar
  // queda vacío: primero una persona en cada habitación, después los que sobran (otro cliente, la familia…).
  const extra = g.rooms.map(room => room.theme === 'shop' ? 1 + (rand() < 0.5 ? 1 : 0) : room.theme === 'site' ? (rand() < 0.4 ? 1 : 0) : room.theme === 'office' ? (rand() < 0.45 ? 1 : 0) : rand() < 0.5 ? 1 + (rand() < 0.3 ? 1 : 0) : 0);
  const place = (room: Room, i: number) => {
    const spot = room.spots[i % room.spots.length];
    const p = addPerson(g, room.id, spot.x, room.y, room.theme === 'site' ? 'worker' : 'resident', room.theme === 'kids' && i === 0);
    p.act = spot.act; p.dir = spot.facing; p.actUntil = between(rand, 3, 14);
  };
  for (const room of g.rooms) place(room, 0);
  for (let k = 1; k <= 2; k++) for (const room of g.rooms) if (extra[room.id] >= k && g.people.length < HUMAN_TOTAL - STREET_PEOPLE) place(room, k);
  // Gente en la vereda: paseando (algunos con perro), corriendo, hablando por teléfono.
  while (g.people.length < HUMAN_TOTAL) {
    addPerson(g, -1, between(rand, streetLo(), streetHi(g)), SIDEWALK_Y, g.people.length % 6 === 0 ? 'jogger' : 'walker');
  }
  for (let i = 0; i < 10; i++) g.cars.push({ id: g.nextId++, x: between(rand, -CAR_OUT, g.width + CAR_OUT), dir: i % 2 ? 1 : -1, speed: between(rand, 5, 9), hue: Math.floor(rand() * 360), kind: 'car', lane: i % 2, sprite: MOVING_VEHICLES[Math.floor(rand() * MOVING_VEHICLES.length)] });
  // Autos chocados y quemados, quietos a un costado de la calle.
  for (let i = 0; i < WRECKS.length; i++) g.cars.push({ id: g.nextId++, x: -SIDE_W + (g.width + 2 * SIDE_W) * (i + 0.5) / WRECKS.length + between(rand, -8, 8), dir: rand() < 0.5 ? 1 : -1, speed: 0, hue: 0, kind: 'car', lane: 1, sprite: WRECKS[i] });
  for (const p of g.people) { p.nextAnomaly = between(rand, 3, 14); p.nextSabotage = between(rand, 45, 90); }
  for (let i = 0; i < g.aliensWanted; i++) spawnAlien(g, i);
  return g;
}

export const aliveHumans = (g: Invasion) => g.people.filter(p => !p.alien && !p.dead && !p.gone).length;
export const aliveAliens = (g: Invasion) => g.people.filter(p => p.alien && !p.dead && !p.gone).length;
function spawnAlien(g: Invasion, index: number) {
  const r = g.rand;
  const rooms = index % 4 === 0 ? [] : g.rooms.filter(o => !o.destroyed && o.fire < 0.35 && o.theme !== 'site');
  const room = rooms.length ? pick(r, rooms) : null;
  const x = room ? between(r, room.x1 + 0.35, room.x2 - 0.35) : between(r, streetLo(), streetHi(g));
  const p = addPerson(g, room?.id ?? -1, x, room?.y ?? SIDEWALK_Y, room ? 'resident' : 'walker');
  p.alien = true;
  p.dog = false;
  const kind = alienKind(p);
  p.look = { ...p.look, size: ALIEN_SIZE * kind.size * (0.96 + (p.id % 5) * 0.02), kid: false }; // los grises son más grandes que la gente (y otras especies todavía más)
  p.hp = kind.hp;
  p.revealPhase = g.rand() * REVEAL_EVERY;
  p.nextAnomaly = g.time + between(g.rand, 10, 24);
  p.nextSabotage = g.time + between(g.rand, 2, 11);
  p.nextComm = g.time + between(g.rand, 8, 30);
  p.nextStare = g.time + between(g.rand, 2, 8);
}

export const revealed = (p: Person, t: number) => p.alien && !p.dead && ((t + p.revealPhase) % REVEAL_EVERY) < REVEAL_TIME;
export const roomOf = (g: Invasion, p: Person) => p.room >= 0 ? g.rooms[p.room] : null;
export const anomalyOf = (p: Person): Anomaly | null => p.anomaly ? ANOMALIES[p.anomaly.id] : null;
// Llegadas acumuladas, incluidas las bajas. La última oleada entra antes de terminar la partida.
export const aliensAt = (t: number) => Math.min(ALIEN_TOTAL, 50 + 5 * Math.floor(t / 11));
// Ovnis: desde los 5 minutos, van apareciendo de a uno cada 40 segundos (hasta 5).
export const ufosAt = (t: number) => t < UFO_FROM ? 0 : Math.min(5, 1 + Math.floor((t - UFO_FROM) / 25));
// Cuánto llueve (0 = nada, 1 = tormenta): empieza a los 3 minutos y en medio minuto ya es una tormenta.
export const rainAt = (t: number) => Math.max(0, Math.min(1, (t - RAIN_FROM) / 30));
// Cuánto de la ciudad tiene que estar destruida a cada momento (al final, toda).
export const ruinAt = (t: number) => t < UFO_FROM ? 0 : Math.min(1, ((t - UFO_FROM) / (GAME_SECONDS - UFO_FROM)) ** 1.6);

const emit = (g: Invasion, e: InvasionEvent) => g.events.push(e);
export const takeEvents = (g: Invasion) => g.events.splice(0);

function addDecal(g: Invasion, d: Decal) { g.decals.push(d); if (g.decals.length > 480) g.decals.shift(); }
function burst(g: Invasion, x: number, y: number, n: number, color: string, kind: Particle['kind'], power = 3, size = 0.08) {
  for (let i = 0; i < n; i++) {
    const a = g.rand() * Math.PI * 2, v = power * (0.3 + g.rand() * 0.9), max = 0.5 + g.rand() * 0.8;
    g.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + power * 0.4, life: max, max, color, size: size * (0.6 + g.rand()), kind });
  }
}

// ---------- Fuego ----------
export function ignite(g: Invasion, room: Room, x: number) {
  if (room.destroyed >= 1 || room.fire > 0.05) return;
  room.fire = 0.08; room.fireAt = Math.max(room.x1 + 0.3, Math.min(room.x2 - 0.3, x));
  emit(g, { type: 'fire', x, y: room.y + 0.5 });
}
const neighbors = (g: Invasion, room: Room) => g.rooms.filter(o => o !== room && o.b === room.b && (
  (o.floor === room.floor && (Math.abs(o.x1 - room.x2) < 0.01 || Math.abs(o.x2 - room.x1) < 0.01)) || (o.floor === room.floor + 1 && o.x1 < room.x2 && o.x2 > room.x1)));
export function destroyRoom(g: Invasion, room: Room) {
  if (room.destroyed >= 1) return;
  room.destroyed = 1; room.fire = Math.max(room.fire, 0.6); room.burnt = 1;
  const cx = (room.x1 + room.x2) / 2, cy = room.y + room.h / 2;
  g.blasts.push({ x: cx, y: cy, t: 0, size: Math.min(4.5, (room.x2 - room.x1) * 0.8), big: true });
  burst(g, cx, cy, 30, '#78716c', 'debris', 6, 0.14);
  burst(g, cx, cy, 20, '#fb923c', 'ember', 5, 0.06);
  emit(g, { type: 'explosion', x: cx, y: cy });
  for (const p of g.people) if (p.room === room.id && !p.dead) p.gone = true; // los que estaban adentro ya no se ven
  for (const b of g.boxes) if (b.room === room.id) b.exploded = true;
}

// ---------- Paso del tiempo ----------
export function step(g: Invasion, dt: number) {
  if (dt <= 0 || g.over) return;
  dt = Math.min(dt, 0.05);
  g.time += dt;
  const t = g.time;
  if (t >= GAME_SECONDS - 1e-8) {
    g.time = GAME_SECONDS;
    g.over = true;
    g.outcome = aliveHumans(g) > aliveAliens(g) ? 'won' : 'time';
    emit(g, { type: 'end' });
    return;
  }

  // Más aliens con el tiempo.
  const want = aliensAt(t);
  if (want > g.aliensWanted) {
    for (let i = g.aliensWanted; i < want; i++) spawnAlien(g, i);
    g.aliensWanted = want;
    emit(g, { type: 'moreAliens', count: aliveAliens(g) });
  }

  // Lluvia y relámpagos.
  if (t >= RAIN_FROM && !g.told.rain) { g.told.rain = true; emit(g, { type: 'rain' }); }
  if (t >= MOTHER_FROM && !g.told.mother) { g.told.mother = true; emit(g, { type: 'mother' }); }
  if (g.lightning && t - g.lightning.t > 0.6) g.lightning = null;
  if (!g.lightning && g.rand() < dt * 0.13 * rainAt(t)) { g.lightning = { t, x: between(g.rand, 0, g.width) }; emit(g, { type: 'thunder', x: g.lightning.x }); }

  for (const p of g.people) if (!p.dead && !p.gone) stepPerson(g, p, dt);
  stepFires(g, dt);
  stepBoxes(g);
  stepUfos(g, dt);
  for (const rk of g.rockets) { const ship = g.ufos.find(u => u.id === rk.ufo); if (ship) { rk.x = ship.x; rk.y = ship.y + UFO_BOX[ship.kind].dy; } } // sigue al ovni
  for (const rk of g.rockets.filter(o => g.time - o.t0 >= ROCKET_TIME)) explodeRocket(g, rk.x, rk.y);
  g.rockets = g.rockets.filter(o => g.time - o.t0 < ROCKET_TIME);
  for (const c of g.cars) {
    const scared = ruinAt(t) > 0.3 ? 1.6 : 1;
    c.x += c.dir * c.speed * scared * dt;
    if (c.x > g.width + CAR_OUT) c.x = -CAR_OUT; else if (c.x < -CAR_OUT) c.x = g.width + CAR_OUT; // cruzan toda la calle, hasta afuera de la pantalla
  }
  const trail: Particle[] = [];
  for (const s of g.particles) {
    s.x += s.vx * dt; s.y += s.vy * dt; s.vy -= (s.kind === 'smoke' || s.kind === 'ember' ? -0.6 : s.kind === 'wreck' ? 9 : 14) * dt; s.life -= dt;
    if (s.kind === 'wreck') { // pedazo del ovni incendiado: rebota en el piso y va dejando fuego y humo
      if (s.y < 0) { s.y = 0; s.vy = Math.abs(s.vy) * 0.3; s.vx *= 0.55; }
      if (g.rand() < dt * 30) trail.push({ x: s.x, y: s.y, vx: (g.rand() - 0.5) * 0.6, vy: 0.4, life: 0.5, max: 0.5, color: g.rand() < 0.5 ? '#f97316' : '#fde047', size: s.size * 0.35, kind: 'ember' });
      if (g.rand() < dt * 14) trail.push({ x: s.x, y: s.y, vx: 0, vy: 0.6, life: 1.4, max: 1.4, color: '#292524', size: s.size * 0.8, kind: 'smoke' });
    }
  }
  if (trail.length) g.particles.push(...trail);
  g.particles = g.particles.filter(s => s.life > 0).slice(-1400);
  for (const b of g.blasts) b.t += dt;
  g.blasts = g.blasts.filter(b => b.t < (b.big ? 2.6 : 1.2));
}

function chooseActivity(g: Invasion, p: Person, room: Room | null) {
  const r = g.rand;
  if (!room) { p.act = p.job === 'jogger' ? 'jog' : r() < 0.15 ? 'phone' : r() < 0.15 ? 'stand' : 'walk'; p.actUntil = g.time + between(r, 4, 14); p.tx = p.x + p.dir * between(r, 6, 30); return; }
  const spot = pick(r, room.spots);
  const extra = ROOM_ACTS[room.theme];
  p.act = extra && r() < 0.3 ? pick(r, extra) : spot.act;
  p.tx = p.act === spot.act ? spot.x : between(r, room.x1 + 0.4, room.x2 - 0.4);
  p.actUntil = g.time + between(r, 5, 16);
  if (p.act === 'walk') p.actUntil = g.time + between(r, 2, 5);
}

function stepPerson(g: Invasion, p: Person, dt: number) {
  const t = g.time, r = g.rand, room = roomOf(g, p);
  p.talk = Math.max(0, p.talk - dt);
  // Un ataque o un incendio cerca: la gente corre desesperada.
  const fireNear = room ? room.fire > 0.15 : false;
  const panicCity = t > 6 && !p.alien && !p.shelter && r() < dt * 0.035;
  if ((fireNear || panicCity) && !p.alien) p.panic = Math.max(p.panic, 6);
  if (!p.alien && (p.panic > 0 || p.shelter)) {
    p.panic = Math.max(0, p.panic - dt);
    const reservedRoom = p.shelter && g.rooms[p.shelter.room];
    if (reservedRoom && (reservedRoom.destroyed || reservedRoom.fire > 0.35)) p.shelter = undefined;
    if (!p.shelter) {
      let refuge = room && room.fire < 0.35 ? room : null;
      if (!refuge && (!room || room.floor === 0)) {
        refuge = g.rooms.reduce<Room | null>((best, candidate) => {
          if (candidate.floor !== 0 || candidate.destroyed || candidate.fire > 0.25 || candidate.theme === 'site') return best;
          const distance = (o: Room) => Math.abs((o.x1 + o.x2) / 2 - p.x);
          return !best || distance(candidate) < distance(best) ? candidate : best;
        }, null);
      }
      if (refuge) {
        const inset = 0.35 + (p.id % 5) * 0.085;
        p.shelter = { room: refuge.id, x: p.x > (refuge.x1 + refuge.x2) / 2 ? refuge.x1 + inset : refuge.x2 - inset };
      }
    }
    const shelter = p.shelter;
    if (shelter) {
      p.tx = shelter.x;
      if (Math.abs(p.tx - p.x) < 0.12) {
        p.room = shelter.room;
        p.y = g.rooms[shelter.room].y;
        p.moving = false;
        return;
      }
    }
    p.act = 'flee';
    const lo = room ? room.x1 + 0.3 : streetLo(), hi = room ? room.x2 - 0.3 : streetHi(g);
    if (!shelter && (Math.abs(p.tx - p.x) < 0.2 || p.tx < lo || p.tx > hi)) p.tx = between(r, lo, hi);
    move(p, 3.6, dt);
    // El fuego de pisos altos puede alcanzar a quienes no tienen salida por la calle.
    if (room && room.fire > 0.7 && r() < dt * 0.2) p.gone = true;
    if (r() < dt * 0.15) { p.talk = 0.8; if (r() < 0.3) emit(g, { type: 'scream', x: p.x, y: p.y + 0.8, id: p.id }); }
    return;
  }
  // Aliens: anomalías y sabotajes.
  if (p.alien) {
    if (p.anomaly && t > p.anomaly.until) { p.anomaly = null; p.nextAnomaly = t + between(r, 6, 16) * (1 - ruinAt(t) * 0.5); }
    if (p.comm && t > p.comm.until) { p.comm = null; p.nextComm = t + between(r, 25, 50); }
    const busy = () => !!(p.anomaly || p.sabotage || p.comm || t < p.stareUntil);
    // Se quedan mirando fijo a la cámara (a vos), con los ojos verdes: seguido si la mira les pasa cerca, y
    // cada tanto aunque no los estés mirando.
    const aimNear = Math.hypot(g.aim.x - p.x, g.aim.y - (p.y + 0.8)) < 9;
    if (!busy() && t > p.nextStare && r() < dt * (aimNear ? 1.6 : 0.15)) {
      p.stareUntil = t + between(r, 3, 5); p.nextStare = p.stareUntil + between(r, 4, 10); p.moving = false;
    }
    if (!busy() && t > p.nextComm) { p.comm = { t0: t, until: t + between(r, 4, 6.5) }; p.moving = false; emit(g, { type: 'comm', x: p.x, y: p.y + 0.8 }); }
    if (!busy() && t > p.nextSabotage) startSabotage(g, p, room);
    if (!busy() && t > p.nextAnomaly) startAnomaly(g, p, room);
    if (p.sabotage) { stepSabotage(g, p, room, dt); return; }
    if (t < p.stareUntil) { p.moving = false; p.dir = g.aim.x >= p.x ? 1 : -1; return; }
    if (p.comm) { p.moving = false; if (r() < dt * 2) p.talk = 0.5; return; }
    if (p.anomaly) { stepAnomaly(g, p, room, dt); return; }
  }
  // Gente normal (y aliens disimulando): van a hacer algo, lo hacen un rato y cambian.
  if (t > p.actUntil) {
    chooseActivity(g, p, room);
    // A veces la gente también deja una caja (un paquete, una pizza): no todas las cajas son de los aliens.
    if (!p.alien && r() < 0.012 && t > 20) dropBox(g, p, room, false);
  }
  if (!room) {
    const speed = p.act === 'jog' ? p.speed : p.act === 'walk' ? p.speed : 0;
    if (speed) { p.dir = p.tx > p.x ? 1 : -1; move(p, speed, dt); if (p.x < streetLo() - 2) p.x = streetHi(g) + 1; if (p.x > streetHi(g) + 2) p.x = streetLo() - 1; } else p.moving = false;
    if (p.act === 'phone') p.talk = 0.5;
    return;
  }
  if (Math.abs(p.tx - p.x) > 0.08) move(p, p.speed, dt);
  else {
    p.moving = false;
    const spot = room.spots.find(s => Math.abs(s.x - p.x) < 0.3);
    if (spot && spot.act === p.act) p.dir = spot.facing;
    if (p.act === 'talk' || p.act === 'phone' || (p.act === 'eat' && r() < 0.01)) p.talk = 0.5;
  }
}
function move(p: Person, speed: number, dt: number) {
  const d = p.tx - p.x;
  p.dir = d >= 0 ? 1 : -1;
  p.x += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
  p.moving = Math.abs(d) > 0.01;
}

const WALLWALK = ANOMALIES.find(a => a.fx.t === 'move' && a.fx.mode === 'wallwalk')!;
// Recorrido de un alien que camina por las paredes: el piso, la pared de la derecha, el techo (cabeza abajo) y
// la pared de la izquierda, hasta volver a donde empezó. `wall` es cuánto está girado (sobre los pies).
const WALL_SPEED = 1.3;
export function wallPath(room: Room, x0: number, d: number) {
  const xa = room.x1 + 0.3, xb = room.x2 - 0.3, ya = room.y, yb = room.y + room.h - 0.04, W = xb - xa, Hh = yb - ya, L = 2 * (W + Hh);
  let k = ((x0 - xa + d) % L + L) % L;
  if (k < W) return { x: xa + k, y: ya, wall: 0, L };
  k -= W; if (k < Hh) return { x: room.x2 - 0.03, y: ya + k, wall: -Math.PI / 2, L };
  k -= Hh; if (k < W) return { x: xb - k, y: yb, wall: Math.PI, L };
  k -= W; return { x: room.x1 + 0.03, y: yb - k, wall: Math.PI / 2, L };
}
function startAnomaly(g: Invasion, p: Person, room: Room | null) {
  const theme = room ? room.theme : null;
  // Bastante seguido se ponen a caminar por las paredes y el techo (es de lo más raro que hacen).
  if (room && room.h > 2 && g.rand() < 0.45) {
    p.anomaly = { id: WALLWALK.id, t0: g.time, until: g.time + wallPath(room, p.x, 0).L / WALL_SPEED, seed: g.rand() };
    p.act = 'stand'; p.y = room.y; p.tx = p.x;
    if (!g.seen.includes(WALLWALK.id)) g.seen.push(WALLWALK.id);
    return;
  }
  for (let i = 0; i < g.deck.length; i++) {
    const a = ANOMALIES[g.deck[(g.deckPos + i) % g.deck.length]];
    if (!fitsPlace(a, theme)) continue;
    // Saca esa del mazo (la pone donde estaba la que tocaba) para no repetirla hasta dar la vuelta.
    const j = (g.deckPos + i) % g.deck.length, k = g.deckPos % g.deck.length;
    [g.deck[j], g.deck[k]] = [g.deck[k], g.deck[j]];
    g.deckPos++;
    const quick = a.fx.t === 'move' && (a.fx.mode === 'teleport' || a.fx.mode === 'jitter') ? 3 : 0;
    p.anomaly = { id: a.id, t0: g.time, until: g.time + between(g.rand, 4, 8) - quick, seed: g.rand() };
    p.act = 'stand'; // se levanta (si estaba sentado o acostado), así se lo ve bien
    if (room && room.theme !== 'kids' && p.y !== room.y) p.y = room.y;
    if (!g.seen.includes(a.id)) g.seen.push(a.id);
    if (a.fx.t === 'move' && a.fx.mode === 'teleport') {
      const lo = room ? room.x1 + 0.4 : p.x - 8, hi = room ? room.x2 - 0.4 : p.x + 8;
      p.x = Math.max(streetLo(), Math.min(streetHi(g), p.x < (lo + hi) / 2 ? hi - 0.2 : lo + 0.2));
    }
    return;
  }
}
function stepAnomaly(g: Invasion, p: Person, room: Room | null, dt: number) {
  const a = ANOMALIES[p.anomaly!.id], t = g.time, lo = room ? room.x1 + 0.35 : p.x - 6, hi = room ? room.x2 - 0.35 : p.x + 6;
  const walk = (speed: number) => { if (Math.abs(p.tx - p.x) < 0.1 || p.tx < lo || p.tx > hi) p.tx = between(g.rand, lo, hi); move(p, speed, dt); };
  if (a.fx.t === 'move') {
    switch (a.fx.mode) {
      case 'wallwalk': {
        if (!room) { p.moving = false; return; }
        p.moving = true;
        p.x = wallPath(room, p.tx, (t - p.anomaly!.t0) * WALL_SPEED).x; // `tx` guarda dónde empezó
        return;
      }
      case 'freeze': case 'ceiling': case 'float': case 'spin': case 'tilt': p.moving = a.fx.mode === 'float'; return;
      case 'speedy': if (Math.floor((t - p.anomaly!.t0) * 0.8) % 2 === 0) walk(4.5); else p.moving = false; return;
      case 'wallbump': p.tx = (room?.x2 ?? hi) - 0.3; move(p, 1.2, dt); if (Math.abs(p.tx - p.x) < 0.05) p.x -= 0.25; return;
      case 'jitter': if (g.rand() < dt * 3) p.x = Math.max(lo, Math.min(hi, p.x + between(g.rand, -0.5, 0.5))); return;
      case 'runInPlace': p.moving = true; return;
      case 'stopmotion': if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) { walk(0); p.x += p.dir * 0.25; p.x = Math.max(lo, Math.min(hi, p.x)); } return;
      case 'teleport': p.moving = false; return;
      default: walk(a.fx.mode === 'zigzag' ? 2 : 1); return;
    }
  }
  if (a.fx.t === 'face' || a.fx.t === 'pose' || a.fx.t === 'prop' || a.fx.t === 'say') { p.moving = false; if (a.fx.t === 'say') p.talk = 0.4; return; }
  walk(0.8);
}

// ---------- Sabotajes ----------
function startSabotage(g: Invasion, p: Person, room: Room | null) {
  const r = g.rand;
  const kind: SabotageKind = r() < 0.78 ? 'ray' : room && r() < 0.15 ? 'lighter' : 'box';
  const lo = room ? room.x1 + 0.5 : p.x - 4, hi = room ? room.x2 - 0.5 : p.x + 4;
  // La bomba (una caja roja grande) la pasea un rato antes de dejarla.
  p.sabotage = { kind, t0: g.time, x: kind === 'ray' ? p.x : between(r, lo, hi), done: false, carryUntil: kind === 'box' ? g.time + between(r, 8, 15) : 0 };
  p.tx = p.sabotage.x;
  p.nextSabotage = g.time + between(r, 9, 20);
  if (kind === 'ray') {
    for (const human of g.people) {
      if (!human.alien && !human.dead && !human.gone && human.room === p.room && Math.abs(human.x - p.x) < 5) {
        human.panic = Math.max(human.panic, 6);
      }
    }
  }
}
function stepSabotage(g: Invasion, p: Person, room: Room | null, dt: number) {
  const s = p.sabotage!, t = g.time;
  if (s.kind === 'box' && !s.done && t < s.carryUntil) {
    const lo = room ? room.x1 + 0.5 : p.x - 4, hi = room ? room.x2 - 0.5 : p.x + 4;
    if (Math.abs(p.tx - p.x) < 0.1) p.tx = between(g.rand, lo, hi);
    move(p, 1.1, dt); s.t0 = t;
    return;
  }
  if (Math.abs(p.tx - p.x) > 0.08 && !s.done) { move(p, 1.3, dt); s.t0 = t; return; }
  p.moving = false;
  const k = t - s.t0;
  if (s.kind === 'lighter' && !s.done && k > 2.2) {
    s.done = true;
    if (room) ignite(g, room, p.x + p.dir * 0.4);
    emit(g, { type: 'lighter', x: p.x, y: p.y + 0.6 });
  }
  if (s.kind === 'ray' && !s.done && k > 1.6) {
    s.done = true;
    let victim: Person | undefined;
    let distance = 9;
    for (const candidate of g.people) {
      if (candidate.alien || candidate.dead || candidate.gone || candidate.room !== p.room) continue;
      const dx = Math.abs(candidate.x - p.x);
      // Agacharse tras una pared o un mueble protege salvo que un gris se acerque.
      if (candidate.shelter && !candidate.moving && dx > 0.72) continue;
      if (dx < distance) { distance = dx; victim = candidate; }
    }
    if (victim) {
      p.dir = victim.x < p.x ? -1 : 1;
      const target = hitbox(g, victim);
      s.shot = { x: (target.x1 + target.x2) / 2, y: (target.y1 + target.y2) / 2, time: t };
      defeatPerson(g, victim, false, false);
    } else {
      const x = Math.max(room?.x1 ?? streetLo(), Math.min(room?.x2 ?? streetHi(g), p.x + p.dir * 4));
      s.shot = { x, y: p.y + 0.48, time: t };
    }
    emit(g, { type: 'ray', x: p.x, y: p.y + 0.6 });
  }
  if (s.kind === 'box' && !s.done && k > 1) { s.done = true; dropBox(g, p, room, true); }
  if (s.done && k > 3.2) { p.sabotage = null; p.actUntil = 0; }
}
function dropBox(g: Invasion, p: Person, room: Room | null, explosive: boolean) {
  if (g.boxes.filter(b => b.explosive === explosive && !b.exploded && !b.defused).length > (explosive ? 30 : 12)) return;
  const x = p.x + p.dir * 0.35;
  g.boxes.push({ id: g.nextId++, room: room?.id ?? -1, x, y: p.y, explosive, t0: g.time, explodeAt: g.time + between(g.rand, 22, 32), defused: false, exploded: false, hit: false, kind: Math.floor(g.rand() * 4) });
  if (explosive) emit(g, { type: 'bomb', x, y: p.y });
}
function stepBoxes(g: Invasion) {
  for (const b of g.boxes) {
    if (!b.explosive || b.defused || b.exploded || g.time < b.explodeAt) continue;
    b.exploded = true;
    const room = b.room >= 0 ? g.rooms[b.room] : g.rooms.find(o => o.floor === 0 && b.x >= o.x1 && b.x <= o.x2);
    g.blasts.push({ x: b.x, y: b.y + 0.6, t: 0, size: 4.2, big: true });
    burst(g, b.x, b.y + 0.3, 50, '#fbbf24', 'spark', 9, 0.08);
    burst(g, b.x, b.y + 0.3, 24, '#57534e', 'debris', 6, 0.14);
    burst(g, b.x, b.y + 0.3, 16, '#fb923c', 'ember', 5, 0.06);
    emit(g, { type: 'explosion', x: b.x, y: b.y });
    if (room) { if (room.fire < 0.05) ignite(g, room, b.x); room.fire = Math.max(room.fire, 0.6); room.burnt = Math.max(room.burnt, 0.5); }
    // La bomba mata a los que están pegados y los demás salen corriendo.
    for (const p of g.people) {
      if (p.dead || p.gone || Math.abs(p.y - b.y) > 1.5) continue;
      const d = Math.abs(p.x - b.x);
      if (d < 1.3) { p.dead = { t: g.time, alien: p.alien, head: false }; p.sabotage = null; p.anomaly = null; }
      else if (d < 4) p.panic = 8;
    }
  }
  // Las cajas comunes (un paquete, una pizza) alguien las levanta al rato; las desactivadas quedan un poco más.
  g.boxes = g.boxes.filter(b => b.explosive ? (!b.exploded || g.time - b.explodeAt < 1) && (!b.defused || g.time - b.explodeAt < 30) : g.time < b.explodeAt + 15);
}

function stepFires(g: Invasion, dt: number) {
  const r = g.rand;
  for (const room of g.rooms) {
    if (room.fire <= 0) continue;
    const grow = room.destroyed ? -0.004 : room.burnt >= 1 ? -0.01 : 0.035;
    room.fire = Math.max(0, Math.min(1, room.fire + grow * dt));
    if (room.fire > 0.5) room.burnt = Math.min(1, room.burnt + dt / 40);
    if (room.fire > 0.55 && !room.destroyed) for (const o of neighbors(g, room)) if (o.fire < 0.05 && !o.destroyed && r() < dt * 0.025) ignite(g, o, (o.x1 + o.x2) / 2);
    if (r() < dt * room.fire * 6) g.particles.push({ x: between(r, room.x1, room.x2), y: room.y + room.h * between(r, 0.4, 0.95), vx: between(r, -0.3, 0.3), vy: between(r, 0.4, 1.2), life: 3, max: 3, color: '#292524', size: between(r, 0.3, 0.7), kind: 'smoke' });
  }
}

function stepUfos(g: Invasion, dt: number) {
  const r = g.rand, t = g.time;
  if (g.penLaunched < penUfosAt(t)) { // los de Kombat Penales entran por un costado
    g.penLaunched++;
    const y = between(r, CITY_TOP - 9, CITY_TOP - 2);
    g.ufos.push({ id: g.nextId++, kind: 'pen', ty: y, x: r() < 0.5 ? -SIDE_W - 10 : g.width + SIDE_W + 10, y, vx: 0, t0: t, beam: null, nextBeam: t + between(r, 4, 8), wobble: r() * 10 });
    emit(g, { type: 'ufoArrive', kind: 'pen' });
  }
  if (g.ufosLaunched < ufosAt(t)) { // los de la nave nodriza salen de abajo de la nave y bajan
    g.ufosLaunched++;
    const m = motherAt(g.width, t);
    g.ufos.push({ id: g.nextId++, kind: 'mother', ty: between(r, CITY_TOP - 9, CITY_TOP - 2), x: m.x, y: m.bottom + 3, vx: 0, t0: t, beam: null, nextBeam: t + between(r, 3, 6), wobble: r() * 10 });
    emit(g, { type: 'ufoArrive', kind: 'mother' });
  }
  const behind = ruinAt(t) - g.rooms.filter(o => o.destroyed).length / g.rooms.length; // cuánto les falta destruir
  for (const u of g.ufos) {
    const goal = (u.id * 37.7 + t * 4) % g.width;
    u.vx += ((goal - u.x) * 0.05 - u.vx) * Math.min(1, dt * 0.6);
    u.x += u.vx * dt;
    u.y += (u.ty - u.y) * Math.min(1, dt * 0.7) + Math.sin(t * 0.8 + u.wobble) * 0.3 * dt;
    if (u.beam && t > u.beam.until) {
      const room = g.rooms[u.beam.room];
      destroyRoom(g, room);
      // Si les falta destruir mucho, el rayo se lleva también las habitaciones de al lado.
      // (los de Kombat Penales, que andan desde el principio, solo prenden fuego alguna de al lado)
      for (const o of neighbors(g, room)) if (!o.destroyed) { if (u.kind === 'mother' && behind > 0.03) destroyRoom(g, o); else if (r() < (u.kind === 'pen' ? 0.25 : 0.5)) ignite(g, o, (o.x1 + o.x2) / 2); }
      u.beam = null;
    }
    if (!u.beam && t > u.nextBeam) {
      const near = g.rooms.filter(o => !o.destroyed && Math.abs((o.x1 + o.x2) / 2 - u.x) < 22);
      const target = near.length ? pick(r, near) : g.rooms.find(o => !o.destroyed);
      if (target) {
        const x = between(r, target.x1 + 0.3, target.x2 - 0.3), y = target.y + target.h * 0.5;
        u.beam = { room: target.id, t0: t, until: t + 1.6, x, y };
        ignite(g, target, x);
        emit(g, { type: 'laser', x, y });
      }
      u.nextBeam = t + (u.kind === 'pen' ? between(r, 10, 18) : behind > 0.02 ? between(r, 0.6, 1.4) : between(r, 3, 7));
    }
  }
}

// ---------- Cómo está cada persona (para dibujarla y para saber si el tiro le pega) ----------
export type PoseKind = 'stand' | 'walk' | 'run' | 'sit' | 'lie' | 'crawl' | 'squat' | 'armsUp' | 'reach' | 'dead';
export interface Pose { x: number; y: number; h: number; kind: PoseKind; dir: 1 | -1; rot: number; upside: boolean; lift: number; sx: number; wall: number }
const SIT: Activity[] = ['tv', 'read', 'eat', 'work', 'drink', 'piano'];
export function poseOf(g: Invasion, p: Person): Pose {
  const room = roomOf(g, p), h = PERSON_H * p.look.size;
  const base: Pose = { x: p.x, y: p.y, h, kind: 'stand', dir: p.dir, rot: 0, upside: false, lift: 0, sx: 1, wall: 0 };
  if (p.dead) return { ...base, kind: 'dead' };
  if (p.shelter && !p.moving && Math.abs(p.shelter.x - p.x) < 0.12) return { ...base, kind: 'squat' };
  if (p.act === 'flee') return { ...base, kind: 'run' };
  if (p.alien && !p.sabotage && (g.time < p.stareUntil || p.comm)) return base; // parado, mirando fijo o hablando por el aparato
  const a = anomalyOf(p);
  if (a) {
    const k = (g.time - p.anomaly!.t0);
    if (a.fx.t === 'move' && a.fx.mode === 'wallwalk' && room) {
      const w = wallPath(room, p.tx, k * WALL_SPEED);
      return { ...base, x: w.x, y: w.y, wall: w.wall, kind: 'walk', dir: 1 };
    }
    if (a.fx.t === 'move') {
      if (a.fx.mode === 'ceiling' && room) return { ...base, y: room.y + room.h - 0.05, upside: true };
      if (a.fx.mode === 'float') return { ...base, kind: 'stand', lift: 0.25 + Math.sin(k * 2) * 0.05 };
      if (a.fx.mode === 'crawl') return { ...base, kind: 'crawl' };
      if (a.fx.mode === 'hop') return { ...base, kind: 'stand', lift: Math.abs(Math.sin(k * 6)) * 0.45 };
      if (a.fx.mode === 'spin') return { ...base, rot: k * 6 };
      if (a.fx.mode === 'tilt') return { ...base, rot: 0.5 * p.dir };
      if (a.fx.mode === 'sway') return { ...base, rot: Math.sin(k * 2.5) * 0.35 };
      if (a.fx.mode === 'backwards' || a.fx.mode === 'moonwalk') return { ...base, kind: 'walk', dir: (p.moving ? -p.dir : p.dir) as 1 | -1 };
      if (a.fx.mode === 'runInPlace') return { ...base, kind: 'run' };
      if (a.fx.mode === 'sidestep') return { ...base, kind: 'walk', dir: 1 };
    }
    if (a.fx.t === 'body' && a.fx.mode === 'stretch') return { ...base, h: h * (1 + Math.min(1, k) * 0.45), kind: p.moving ? 'walk' : 'stand' };
    if (a.fx.t === 'body' && a.fx.mode === 'shrink') return { ...base, h: h * (1 - Math.min(1, k) * 0.4), kind: p.moving ? 'walk' : 'stand' };
    if (a.fx.t === 'body' && a.fx.mode === 'thin') return { ...base, sx: 0.45, kind: p.moving ? 'walk' : 'stand' };
    if (a.fx.t === 'pose') {
      const m = a.fx.mode;
      if (m === 'lieFloor') return { ...base, kind: 'lie' };
      if (m === 'sitAir') return { ...base, kind: 'sit' };
      if (m === 'kneel') return { ...base, kind: 'squat' };
      if (m === 'sky' || m === 'signal' || m === 'phoneSky') return { ...base, kind: 'armsUp' };
      if (m === 'armsOut' || m === 'tpose' || m === 'measure') return { ...base, kind: 'reach' };
      if ((m === 'corner' || m === 'hugWall' || m === 'headWall' || m === 'window') && room) {
        const right = p.x > (room.x1 + room.x2) / 2;
        return { ...base, x: right ? room.x2 - 0.3 : room.x1 + 0.3, dir: right ? 1 : -1 };
      }
    }
    if (a.fx.t === 'face' && a.fx.mode === 'bow') return { ...base, rot: 0.6 * p.dir };
  }
  if (p.sabotage && !p.moving) return { ...base, kind: p.sabotage.kind === 'box' || p.sabotage.kind === 'lighter' ? 'squat' : 'reach' };
  if (p.moving) return { ...base, kind: p.act === 'jog' || p.act === 'run' ? 'run' : 'walk' };
  if (SIT.includes(p.act)) return { ...base, kind: 'sit' };
  if (p.act === 'sleep' || p.act === 'yoga') return { ...base, kind: 'lie', y: p.act === 'sleep' && room?.theme !== 'kids' ? p.y + 0.45 : p.y };
  if (p.act === 'run') return { ...base, kind: 'run' };
  if (p.act === 'lift' || p.act === 'dance') return { ...base, kind: Math.floor(g.time * 1.2 + p.id) % 2 ? 'armsUp' : 'stand' };
  if (p.act === 'cook' || p.act === 'clean' || p.act === 'serve' || p.act === 'cut' || p.act === 'paint' || p.act === 'fold' || p.act === 'hammer' || p.act === 'shop') return { ...base, kind: 'reach' };
  if (p.act === 'play' || p.act === 'carry') return { ...base, kind: 'squat' };
  return base;
}

// El rectángulo de una persona (y dónde empieza la cabeza), según cómo está.
export function hitbox(g: Invasion, p: Person) {
  const s = poseOf(g, p), w = PERSON_W * (s.kind === 'reach' ? 1.3 : 1) * s.sx * (p.alien ? 1.35 : 1);
  if (s.wall) { // caminando por la pared o por el techo
    if (Math.abs(Math.abs(s.wall) - Math.PI) < 0.01) return { x1: s.x - w / 2, x2: s.x + w / 2, y1: s.y - s.h, y2: s.y, headX: s.x, headY: s.y - s.h * 0.82 };
    const d = s.wall < 0 ? -1 : 1;
    return { x1: Math.min(s.x, s.x + d * s.h), x2: Math.max(s.x, s.x + d * s.h), y1: s.y - w / 2, y2: s.y + w / 2, headX: s.x + d * s.h * 0.82, headY: s.y };
  }
  if (s.kind === 'dead' || s.kind === 'lie' || s.kind === 'crawl') return { x1: s.x - s.h * 0.5, x2: s.x + s.h * 0.5, y1: s.y, y2: s.y + s.h * (s.kind === 'crawl' ? 0.45 : 0.3), headX: s.x + s.dir * s.h * 0.38, headY: s.y + s.h * 0.15 };
  const h = s.kind === 'sit' || s.kind === 'squat' ? s.h * 0.72 : s.h;
  if (s.upside) return { x1: s.x - w / 2, x2: s.x + w / 2, y1: s.y - h, y2: s.y, headX: s.x, headY: s.y - h * 0.82 };
  const y = s.y + s.lift;
  return { x1: s.x - w / 2, x2: s.x + w / 2, y1: y, y2: y + h, headX: s.x, headY: y + h * 0.82 };
}

// ---------- El disparo ----------
// Pega en lo primero que encuentra en (x, y): la gente de la vereda (que está adelante), la de los
// departamentos, una caja o un ovni. Si no, deja un agujero (y si es una ventana, la rompe).
function defeatPerson(g: Invasion, p: Person, head: boolean, byPlayer: boolean) {
  const box = hitbox(g, p), cx = (box.x1 + box.x2) / 2, cy = (box.y1 + box.y2) / 2;
  p.dead = { t: g.time, alien: p.alien, head };
  p.sabotage = null;
  if (!p.alien) emit(g, { type: 'died', x: cx, y: cy, id: p.id, byPlayer }); // grita (hombre o mujer)
  if (p.alien) {
    // El alien explota en una nube verde (no queda el cuerpo, queda la mancha).
    p.gone = true;
    // Exagerada: una bola verde enorme, otra que llega un instante después, chorros de baba para todos
    // lados y la pared salpicada.
    const tint = p.id % BLOOD.length, B = BLOOD[tint]; // cada especie con su color de sangre
    g.blasts.push({ x: cx, y: cy, t: 0, size: 2.4, green: true, tint }, { x: cx, y: cy + 0.3, t: -0.12, size: 1.6, green: true, tint });
    burst(g, cx, cy, 140, hex(B.main), 'goo', 8, 0.08);
    burst(g, cx, cy, 60, hex(B.main.map((n, i) => Math.round((n + B.pale[i]) / 2)) as RGB), 'goo', 11, 0.05);
    burst(g, cx, cy, 40, hex(B.pale), 'spark', 9, 0.05);
    burst(g, cx, cy, 30, hex(B.dark), 'goo', 4, 0.13);
    const room = roomOf(g, p);
    addDecal(g, { room: p.room, x: cx, y: p.y + 0.02, glass: false, t: g.time, goo: true, size: 1.6, tint });
    for (let i = 0; i < 9; i++) {
      let sx = cx + between(g.rand, -2.4, 2.4), sy = cy + between(g.rand, -0.5, 1.6);
      if (room) { sx = Math.max(room.x1 + 0.15, Math.min(room.x2 - 0.15, sx)); sy = Math.max(room.y + 0.2, Math.min(room.y + room.h - 0.15, sy)); }
      addDecal(g, { room: p.room, x: sx, y: sy, glass: false, t: g.time, goo: true, size: between(g.rand, 0.5, 1.2), tint });
    }
    g.kills++; if (head) g.headshots++;
    const kind = p.id % ALIEN_KINDS.length; g.killsBy[kind]++; g.points += ALIEN_KINDS[kind].points;
    if (p.anomaly) g.killedAnomalies.push(p.anomaly.id);
    emit(g, { type: 'kill', x: cx, y: cy, head, anomaly: p.anomaly?.id ?? null });
  } else {
    // Impacto rojo para las bajas humanas.
    burst(g, cx, cy, head ? 90 : 70, '#b91c1c', 'blood', 5, 0.06);
    burst(g, cx, cy, 40, '#7f1d1d', 'blood', 2.5, 0.09);
    burst(g, cx, cy, 30, '#dc2626', 'blood', 8, 0.035);
    const room = roomOf(g, p);
    for (let i = 0; i < 6; i++) {
      let sx = cx + between(g.rand, -1.2, 1.2) + p.dir * -0.4, sy = cy + between(g.rand, -0.4, 0.6);
      if (room) { sx = Math.max(room.x1 + 0.15, Math.min(room.x2 - 0.15, sx)); sy = Math.max(room.y + 0.15, Math.min(room.y + room.h - 0.15, sy)); }
      addDecal(g, { room: p.room, x: sx, y: sy, glass: false, t: g.time, blood: true, size: between(g.rand, 0.5, 1.1) });
    }
    addDecal(g, { room: p.room, x: p.x, y: p.y + 0.02, glass: false, t: g.time, blood: true, size: 1.4 });
    p.gone = true;
    if (byPlayer) { g.civilians++; g.points -= HUMAN_PENALTY; } // matar a un humano resta puntos
    emit(g, { type: 'civilian', x: cx, y: cy });
  }
  p.anomaly = null;
  // Los que estaban cerca se asustan y corren.
  for (const o of g.people) if (o !== p && !o.dead && !o.gone && o.room === p.room && Math.abs(o.x - p.x) < 8 && !o.alien) { o.panic = 5; o.talk = 1; }
}

// Daño a un departamento (balas de ametralladora o un cohete): a la mitad se revientan todos los vidrios y
// los muebles se caen a pedazos; con `WALL_BREAK` se derrumba (y se lleva a los que estaban adentro).
function wearRoom(g: Invasion, room: Room, x: number, y: number, amount: number) {
  const before = room.wear ?? 0, after = before + amount;
  room.wear = after;
  if (before < WALL_BREAK / 2 && after >= WALL_BREAK / 2) {
    for (let i = 0; i < 6; i++) {
      const wx = room.x1 + (i + 0.5) * (room.x2 - room.x1) / 6, wy = room.y + room.h * (0.45 + g.rand() * 0.3);
      addDecal(g, { room: room.id, x: wx, y: wy, glass: room.floor > 0, t: g.time, crater: 0.6 + g.rand() * 0.5 });
      if (room.floor > 0) burst(g, wx, wy, 10, '#e0f2fe', 'glass', 3, 0.05);
    }
    emit(g, { type: 'glass', x, y });
    for (const p of g.people) if (p.room === room.id && !p.dead && !p.gone && !p.alien) { p.panic = Math.max(p.panic, 6); p.talk = 1; }
  }
  if (after >= WALL_BREAK) {
    for (const p of g.people) if (p.room === room.id && !p.dead && !p.gone) defeatPerson(g, p, false, true);
    destroyRoom(g, room);
    emit(g, { type: 'collapse', x: (room.x1 + room.x2) / 2, y: room.y + room.h / 2 });
  }
}

// El cohete de la bazooka llega: explota donde apuntaste al disparar (lo que esté ahí en ese momento).
function explodeRocket(g: Invasion, x: number, y: number) {
  const radius = BAZOOKA_RADIUS;
  const targets = g.people.filter(p => !p.dead && !p.gone && Math.hypot(p.x - x, p.y + 0.5 - y) <= radius);
  const ships = g.ufos.filter(u => { const b = UFO_BOX[u.kind]; return Math.hypot(Math.max(0, Math.abs(u.x - x) - b.hw), Math.max(0, Math.abs(u.y + b.dy - y) - b.hh)) <= radius; });
  const impact = (px: number, py: number, size: number, ufo = false) => {
    g.blasts.push({ x: px, y: py, t: 0, size, big: true, bazooka: true, ufo }); // `ufo`: la explosión del ovni (otra secuencia)
    burst(g, px, py, 44, '#f59e0b', 'spark', 8, 0.09);
    emit(g, { type: 'explosion', x: px, y: py, bazooka: true }); // suena la explosión de la bazooka (no la de las bombas)
  };
  if (!ships.length) impact(x, y, 5);
  for (const u of ships) {
    impact(u.x, u.y, 7, true);
    // Salen volando para todos lados las partes del ovni, incendiadas.
    for (let i = 0; i < 16; i++) {
      const a = g.rand() * Math.PI * 2, sp = 7 + g.rand() * 15, max = 2.4 + g.rand() * 1.4;
      g.particles.push({ x: u.x + Math.cos(a) * 2, y: u.y + Math.sin(a) * 1.2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 5, life: max, max, color: '#4b5563', size: 0.45 + g.rand() * 0.8, kind: 'wreck', spin: (g.rand() - 0.5) * 14 });
    }
  }
  g.ufos = g.ufos.filter(u => !ships.includes(u));
  // Cada ovni derribado cuenta como 5 grises muertos (matados y puntos).
  for (let i = 0; i < ships.length; i++) { g.kills += UFO_KILLS; g.killsBy[0] += UFO_KILLS; g.points += UFO_KILLS * ALIEN_KINDS[0].points; }
  for (const p of targets) defeatPerson(g, p, false, true);
  if (ships.length || targets.length) g.hits++;
  const hit = ships.length ? 'ufoDestroyed' as const : targets.some(p => p.alien) ? 'alien' as const : targets.length ? 'civilian' as const : 'blast' as const;
  const room = g.rooms.find(o => x >= o.x1 && x <= o.x2 && y >= o.y && y <= o.y + o.h);
  if (room && !room.destroyed) wearRoom(g, room, x, y, WALL_BREAK * 0.6);
  emit(g, { type: 'rocketHit', x, y, hit });
  return hit;
}

export function shoot(g: Invasion, x: number, y: number, weapon: Weapon = 'rifle', from?: { x: number; y: number }) {
  if (g.over) return 'none' as const;
  g.shots++;
  emit(g, { type: 'shot', x, y });
  if (weapon === 'bazooka') { // sale el cohete: explota recién cuando llega (`ROCKET_TIME`)
    const ship = g.ufos.find(u => onUfo(u, x, y));
    g.rockets.push({ x, y, t0: g.time, ufo: ship?.id, from });
    return 'launched' as const;
  }
  for (const u of g.ufos) if (onUfo(u, x, y)) {
    burst(g, x, y, 12, '#a5f3fc', 'spark', 4, 0.05);
    emit(g, { type: 'ufoPing', x, y });
    return 'ufo' as const;
  }
  const alive = g.people.filter(p => !p.dead && !p.gone);
  const order = [...alive.filter(p => p.room < 0), ...alive.filter(p => p.room >= 0)];
  for (const p of order) {
    const box = hitbox(g, p);
    if (x < box.x1 || x > box.x2 || y < box.y1 || y > box.y2) continue;
    const head = Math.hypot(x - box.headX, y - box.headY) < PERSON_H * p.look.size * 0.17;
    g.hits++;
    if (p.alien && (p.hp ?? 1) > DAMAGE[weapon]) { // si el tiro no le alcanza para matarlo, lo lastima
      p.hp = (p.hp ?? 1) - DAMAGE[weapon]; p.hurt = g.time;
      const B = bloodOf(p);
      burst(g, x, y, 26, hex(B.main), 'goo', 5, 0.06);
      burst(g, x, y, 8, hex(B.pale), 'spark', 5, 0.04);
      addDecal(g, { room: p.room, x: x + between(g.rand, -0.6, 0.6), y, glass: false, t: g.time, goo: true, size: 0.5, tint: p.id % BLOOD.length });
      emit(g, { type: 'hurt', x, y, left: p.hp });
      return 'hurt' as const;
    }
    defeatPerson(g, p, head, true);
    return p.alien ? 'alien' as const : 'civilian' as const;
  }
  for (const b of g.boxes) {
    if (b.exploded || b.defused || Math.abs(x - b.x) > (b.explosive ? 0.32 : 0.25) || y < b.y || y > b.y + (b.explosive ? 0.48 : 0.4)) continue;
    b.hit = true;
    burst(g, x, y, 10, '#d6a35c', 'debris', 2.5, 0.05);
    if (b.explosive) { b.defused = true; g.defused++; emit(g, { type: 'defused', x, y }); return 'defused' as const; }
    emit(g, { type: 'boxHit', x, y });
    return 'box' as const;
  }
  const room = g.rooms.find(o => x >= o.x1 - 0.25 && x <= o.x2 + 0.25 && y >= o.y && y <= o.y + o.h);
  const glass = !!room && room.floor > 0 && (y - room.y) > 0.9 && (y - room.y) < room.h - 0.5 && !room.destroyed;
  if (weapon === 'machine') { // la ametralladora rompe todo: arranca pedazos de pared, revienta vidrios y termina derrumbando el departamento
    addDecal(g, { room: room?.id ?? -1, x, y, glass, t: g.time, crater: 0.7 + g.rand() * 0.6 });
    burst(g, x, y, 18, '#a8a29e', 'debris', 4.5, 0.09);
    burst(g, x, y, 6, '#57534e', 'debris', 3, 0.16);
    if (glass) burst(g, x, y, 16, '#e0f2fe', 'glass', 3.5, 0.05);
    if (room && !room.destroyed) wearRoom(g, room, x, y, 1);
    emit(g, { type: glass ? 'glass' : 'miss', x, y });
    return 'miss' as const;
  }
  addDecal(g, { room: room?.id ?? -1, x, y, glass, t: g.time });
  burst(g, x, y, glass ? 14 : 8, glass ? '#e0f2fe' : '#a8a29e', glass ? 'glass' : 'debris', 2.5, 0.04);
  emit(g, { type: glass ? 'glass' : 'miss', x, y });
  return 'miss' as const;
}

// Para los sonidos: qué se escucha cerca de donde apunta la mira (gente hablando, la tele, la cocina…).
export function nearby(g: Invasion, x: number, y: number, radius: number) {
  const near = (px: number, py: number) => Math.max(0, 1 - Math.hypot(px - x, (py - y) * 1.3) / radius);
  const out = { voices: 0, tv: 0, kitchen: 0, work: 0, fire: 0, ufo: 0, ovni: 0, mother: 0, street: 0, birds: 0, dog: 0 };
  for (const p of g.people) {
    if (p.dead || p.gone) continue;
    const k = near(p.x, p.y + 0.6);
    if (!k) continue;
    // El murmullo de la gente se escucha donde hay gente (y más fuerte si están hablando).
    out.voices = Math.max(out.voices, p.talk > 0 ? k * (p.act === 'flee' ? 1 : 0.8) : k * 0.45);
    if (p.act === 'tv' && !p.moving) out.tv = Math.max(out.tv, k);
    if (p.act === 'cook' && !p.moving) out.kitchen = Math.max(out.kitchen, k);
    if ((p.act === 'hammer' || p.act === 'carry') && !p.moving) out.work = Math.max(out.work, k);
    if (p.dog && p.room < 0) out.dog = Math.max(out.dog, k * 0.6);
  }
  for (const room of g.rooms) if (room.fire > 0.05) out.fire = Math.max(out.fire, near(room.fireAt, room.y + 0.6) * Math.min(1, room.fire * 2));
  // Los ovnis se escuchan fuerte y desde lejos (y algo en toda la ciudad mientras haya alguno).
  for (const u of g.ufos) { const k = u.kind === 'pen' ? 'ufo' : 'ovni'; out[k] = Math.max(out[k], 0.35, 1 - Math.hypot(u.x - x, u.y - y) / (radius * 6)); }
  if (g.time >= MOTHER_FROM) { const m = motherAt(g.width, g.time); out.mother = m.k * Math.max(0.35, 1 - Math.abs(m.x - x) / 150); } // la nave es enorme: se escucha en todos lados, más cerca más fuerte
  const calm = 1 - ruinAt(g.time);
  out.street = Math.max(0.15, near(x, 0) * 1.2) * calm + (1 - calm) * 0.3;
  out.birds = Math.max(0.1, near(x, 30)) * calm * calm;
  return out;
}
