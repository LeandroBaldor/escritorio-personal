// Tiro al Blanco 2.050: la lógica del entrenamiento de tiro (sin dibujo).
// Todo se mide en píxeles de la pantalla del juego (W × H, vista de frente). Los carteles tienen el origen
// abajo al medio (la bisagra) y sus partes se miden en "unidades de cartel": a escala 1 un cartel mide 290 de alto.

export const W = 1600;
export const H = 900;
export const ROUND = 180; // cada ronda dura 3 minutos
export const COUNTDOWN = 3; // "3, 2, 1, ¡fuego!" antes de arrancar (el reloj del juego empieza en −3)

// ───────────── Armas ─────────────
export type PrimaryId = 'escopeta' | 'ametralladora' | 'rifle';
export type SidearmId = 'pistola' | 'revolver';
export type WeaponId = PrimaryId | SidearmId;
export interface WeaponSpec {
  id: WeaponId; name: string; model: string; blurb: string;
  mag: number; reserve: number; // balas por cargador y de reserva (las armas cortas tienen reserva infinita)
  rate: number; auto: boolean; reload: number; // segundos entre tiros, automática, segundos de recarga
  pellets: number; spread: number; bloom: number; // perdigones, dispersión (px) y cuánto se abre con cada tiro seguido
  badMult: number; // multiplica los puntos de los malos
  color: string; // color de la energía
}
export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  escopeta: { id: 'escopeta', name: 'Escopeta', model: 'ARC-12 de plasma', blurb: '7 perdigones de plasma por tiro: abre mucho, cuidado con los rehenes.', mag: 8, reserve: 24, rate: 0.55, auto: false, reload: 2.1, pellets: 7, spread: 52, bloom: 0, badMult: 1, color: '#ff7a1a' },
  ametralladora: { id: 'ametralladora', name: 'Ametralladora', model: 'VX-9 de pulsos', blurb: 'Automática: mantené apretado. Cuanto más larga la ráfaga, más se abre.', mag: 40, reserve: 120, rate: 0.085, auto: true, reload: 2.2, pellets: 1, spread: 6, bloom: 2.6, badMult: 1, color: '#22d3ee' },
  rifle: { id: 'rifle', name: 'Rifle', model: 'R-50 Lanza de riel', blurb: 'Exacto y potente (×1,25 puntos), pero lento entre tiro y tiro.', mag: 10, reserve: 30, rate: 0.4, auto: false, reload: 2.4, pellets: 1, spread: 0, bloom: 0, badMult: 1.25, color: '#a78bfa' },
  pistola: { id: 'pistola', name: 'Pistola', model: 'P-7 Halcón láser', blurb: '15 tiros por cargador y recarga rápida.', mag: 15, reserve: Infinity, rate: 0.16, auto: false, reload: 1.1, pellets: 1, spread: 5, bloom: 3, badMult: 1, color: '#f43f5e' },
  revolver: { id: 'revolver', name: 'Revólver', model: 'Toro .50 iónico', blurb: '6 tiros, pero cada malo vale ×1,5.', mag: 6, reserve: Infinity, rate: 0.42, auto: false, reload: 1.6, pellets: 1, spread: 0, bloom: 0, badMult: 1.5, color: '#facc15' },
};
export const PRIMARIES: PrimaryId[] = ['escopeta', 'ametralladora', 'rifle'];
export const SIDEARMS: SidearmId[] = ['pistola', 'revolver'];

// ───────────── Personajes ─────────────
export type CharId = 'kira' | 'titan' | 'sombra' | 'nova' | 'brick' | 'r7';
export interface CharSpec { id: CharId; name: string; role: string; perk: string; color: string; accent: string; skin: string; hair: string; visor: string }
export const CHARS: CharSpec[] = [
  { id: 'kira', name: 'Kira Vex', role: 'Asalto', perk: 'Recarga 30% más rápido', color: '#e11d48', accent: '#fda4af', skin: '#e8b48f', hair: '#1f1530', visor: '#38bdf8' },
  { id: 'titan', name: 'Titán Okoro', role: 'Pesado', perk: 'Arma grande con 50% más de balas de reserva', color: '#f59e0b', accent: '#fde68a', skin: '#6b4226', hair: '#111', visor: '#f97316' },
  { id: 'sombra', name: 'Sombra', role: 'Francotiradora', perk: 'Pulso firme: la mira se abre la mitad', color: '#334155', accent: '#94a3b8', skin: '#c99b7a', hair: '#0b0b0b', visor: '#22c55e' },
  { id: 'nova', name: 'Nova Kimura', role: 'Precisión', perk: 'Cada tiro en la cabeza suma +100 extra', color: '#7c3aed', accent: '#c4b5fd', skin: '#f1c9a5', hair: '#e5e7eb', visor: '#e879f9' },
  { id: 'brick', name: 'Brick Malone', role: 'Veterano', perk: 'El arma corta tiene el doble de balas por cargador', color: '#15803d', accent: '#86efac', skin: '#f0b98d', hair: '#b45309', visor: '#facc15' },
  { id: 'r7', name: 'Unidad R-7', role: 'Androide', perk: 'Si le da a un inocente, resta la mitad', color: '#0891b2', accent: '#a5f3fc', skin: '#cbd5e1', hair: '#64748b', visor: '#ef4444' },
];
export const charOf = (id: CharId) => CHARS.find(c => c.id === id) ?? CHARS[0];

// ───────────── Puntos ─────────────
export const PTS = { body: 100, head: 250, hostageHead: 400, innocent: -300, escape: -50, streakEvery: 5, streakBonus: 150 };

// ───────────── Carteles ─────────────
export type TargetKind = 'malo' | 'maloRehen' | 'rehen' | 'civil' | 'municion';
export type Zone = 'head' | 'body';
export const isBad = (k: TargetKind) => k === 'malo' || k === 'maloRehen';
export const isInnocent = (k: TargetKind) => k === 'rehen' || k === 'civil';
export const BOARD = { w: 150, h: 300 }; // el cartel (unidades de cartel)
interface Circle { c: 'circle'; x: number; y: number; r: number }
interface Rect { c: 'rect'; x0: number; x1: number; y0: number; y1: number }
type Shape = Circle | Rect;
export interface HitPart { who: 'bad' | 'innocent' | 'ammo'; zone: Zone; shape: Shape }
const HEAD: Circle = { c: 'circle', x: 0, y: -240, r: 28 };
const PERSON: Omit<HitPart, 'who'>[] = [
  { zone: 'head', shape: HEAD },
  { zone: 'body', shape: { c: 'rect', x0: -46, x1: 46, y0: -210, y1: -112 } },
  { zone: 'body', shape: { c: 'rect', x0: -34, x1: 34, y0: -112, y1: -6 } },
];
// Las partes de cada cartel, de adelante para atrás (la primera que toca es la que cuenta).
export function partsOf(kind: TargetKind): HitPart[] {
  if (kind === 'municion') return [{ who: 'ammo', zone: 'body', shape: { c: 'rect', x0: -58, x1: 58, y0: -190, y1: -60 } }];
  if (kind === 'malo') return PERSON.map(p => ({ ...p, who: 'bad' }));
  if (kind === 'maloRehen') {
    // El rehén adelante (corrido a la izquierda) y el malo atrás: asoma la cabeza y el hombro a la derecha.
    const hostage = PERSON.map(p => ({ ...p, who: 'innocent' as const, shape: shift(p.shape, -16, 0) }));
    return [...hostage,
      { who: 'bad', zone: 'head', shape: { c: 'circle', x: 44, y: -266, r: 24 } },
      { who: 'bad', zone: 'body', shape: { c: 'rect', x0: 34, x1: 66, y0: -236, y1: -120 } }];
  }
  return PERSON.map(p => ({ ...p, who: 'innocent' }));
}
function shift(s: Shape, dx: number, dy: number): Shape {
  return s.c === 'circle' ? { ...s, x: s.x + dx, y: s.y + dy } : { ...s, x0: s.x0 + dx, x1: s.x1 + dx, y0: s.y0 + dy, y1: s.y1 + dy };
}
const inside = (s: Shape, x: number, y: number) => s.c === 'circle' ? (x - s.x) ** 2 + (y - s.y) ** 2 <= s.r * s.r : x >= s.x0 && x <= s.x1 && y >= s.y0 && y <= s.y1;

// ───────────── Escenarios (solo la geometría: dónde aparecen los carteles) ─────────────
export type SceneId = 'banco' | 'metro' | 'torre' | 'puerto' | 'mercado';
export interface Row { y: number; scale: number; spots: number[] } // línea de la cobertura, escala y lugares (x)
export interface SceneSpec { id: SceneId; name: string; place: string; brief: string; rows: Row[] }
export const SCENES: SceneSpec[] = [
  { id: 'banco', name: 'Banco Orbital Nexus', place: 'Distrito financiero, nivel 140', brief: 'Una banda tomó el hall del banco con los empleados y los clientes adentro.',
    rows: [{ y: 455, scale: 0.5, spots: [430, 610, 790, 970, 1150] }, { y: 620, scale: 0.74, spots: [250, 560, 1040, 1350] }, { y: 835, scale: 1, spots: [330, 800, 1270] }] },
  { id: 'metro', name: 'Estación Mag-Lev Línea 9', place: 'Andén central, hora pico', brief: 'Secuestraron un tren entero en el andén. Los pasajeros quedaron atrapados.',
    rows: [{ y: 470, scale: 0.52, spots: [330, 520, 710, 890, 1080, 1270] }, { y: 640, scale: 0.76, spots: [400, 800, 1200] }, { y: 840, scale: 1, spots: [260, 640, 960, 1340] }] },
  { id: 'torre', name: 'Torre Helix · Piso 88', place: 'Oficinas corporativas, de noche', brief: 'Tomaron el piso 88 con los oficinistas de rehenes. Afuera, la ciudad no duerme.',
    rows: [{ y: 480, scale: 0.55, spots: [380, 600, 1000, 1220] }, { y: 650, scale: 0.78, spots: [240, 620, 980, 1360] }, { y: 845, scale: 1, spots: [420, 800, 1180] }] },
  { id: 'puerto', name: 'Puerto Espacial Kepler', place: 'Hangar 7, plataforma de carga', brief: 'Piratas espaciales tomaron el hangar y la tripulación de una nave de carga.',
    rows: [{ y: 500, scale: 0.55, spots: [300, 520, 1080, 1300] }, { y: 660, scale: 0.78, spots: [420, 800, 1180] }, { y: 850, scale: 1, spots: [230, 600, 1000, 1370] }] },
  { id: 'mercado', name: 'Neo-Mercado 2050', place: 'Galería de neón, sábado a la noche', brief: 'Una toma de rehenes en plena galería: compradores, vendedores y mucho neón.',
    rows: [{ y: 470, scale: 0.5, spots: [360, 560, 760, 1040, 1240] }, { y: 640, scale: 0.75, spots: [260, 640, 960, 1340] }, { y: 840, scale: 1, spots: [450, 800, 1150] }] },
];
export const sceneOf = (id: SceneId) => SCENES.find(s => s.id === id) ?? SCENES[0];

// ───────────── Estado ─────────────
export type TargetState = 'rising' | 'up' | 'lowering' | 'hit' | 'gone';
export interface Hole { x: number; y: number; color: string }
export interface Target {
  id: number; kind: TargetKind; row: number; spot: number; x: number; y: number; scale: number;
  born: number; stayUntil: number; state: TargetState; changedAt: number; holes: Hole[]; seed: number; mirror: boolean;
}
export interface Weapon { id: WeaponId; mag: number; reserve: number }
export type Event =
  | { type: 'shot'; weapon: WeaponId; impacts: { x: number; y: number }[] }
  | { type: 'hit'; kind: TargetKind; zone: Zone; points: number; x: number; y: number }
  | { type: 'penalty'; kind: TargetKind; points: number; x: number; y: number }
  | { type: 'escape'; points: number; x: number; y: number }
  | { type: 'ammo'; x: number; y: number }
  | { type: 'streak'; bonus: number; count: number }
  | { type: 'pop'; x: number; y: number; scale: number }
  | { type: 'reload'; weapon: WeaponId } | { type: 'reloaded'; weapon: WeaponId }
  | { type: 'dry' } | { type: 'empty' } | { type: 'switch'; weapon: WeaponId }
  | { type: 'go' } | { type: 'count'; n: number } | { type: 'end' };
export interface Stats { shots: number; hits: number; heads: number; bad: number; innocents: number; escaped: number; ammo: number }
export interface Game {
  scene: SceneSpec; char: CharSpec; time: number; score: number; over: boolean;
  primary: Weapon; sidearm: Weapon | null; current: 'primary' | 'sidearm'; needSidearm: boolean;
  aim: { x: number; y: number }; trigger: boolean; pulled: boolean; cooldown: number; bloom: number;
  reloading: number; // segundos que faltan para terminar de recargar (0 = no recarga)
  targets: Target[]; nextId: number; nextSpawn: number; nextAmmo: number; streak: number; stats: Stats; events: Event[];
}

export function newGame(scene: SceneId, char: CharId, primary: PrimaryId): Game {
  const c = charOf(char), spec = WEAPONS[primary];
  return {
    scene: sceneOf(scene), char: c, time: -COUNTDOWN, score: 0, over: false,
    primary: { id: primary, mag: spec.mag, reserve: Math.round(spec.reserve * (c.id === 'titan' ? 1.5 : 1)) }, sidearm: null, current: 'primary', needSidearm: false,
    aim: { x: W / 2, y: H / 2 }, trigger: false, pulled: false, cooldown: 0, bloom: 0, reloading: 0,
    targets: [], nextId: 1, nextSpawn: 0.4, nextAmmo: 35, streak: 0,
    stats: { shots: 0, hits: 0, heads: 0, bad: 0, innocents: 0, escaped: 0, ammo: 0 }, events: [],
  };
}

export const weaponOf = (g: Game): Weapon => g.current === 'sidearm' && g.sidearm ? g.sidearm : g.primary;
export const specOf = (g: Game): WeaponSpec => WEAPONS[weaponOf(g).id];
export const magSize = (g: Game, w: Weapon) => WEAPONS[w.id].mag * (g.char.id === 'brick' && (w.id === 'pistola' || w.id === 'revolver') ? 2 : 1);
export const reloadTime = (g: Game) => specOf(g).reload * (g.char.id === 'kira' ? 0.7 : 1);
export const timeLeft = (g: Game) => Math.max(0, ROUND - Math.max(0, g.time));
export const progress = (g: Game) => Math.min(1, Math.max(0, g.time) / ROUND);
// Lo que se abre la mira (radio en px): dispersión del arma + lo que se abrió por los tiros seguidos.
export const spreadOf = (g: Game) => (specOf(g).spread + g.bloom) * (g.char.id === 'sombra' ? 0.5 : 1);
export const takeEvents = (g: Game) => { const e = g.events; g.events = []; return e; };

export function chooseSidearm(g: Game, id: SidearmId) {
  if (!g.sidearm) g.sidearm = { id, mag: 0, reserve: Infinity };
  g.sidearm.id = id; g.sidearm.mag = magSize(g, g.sidearm);
  g.current = 'sidearm'; g.needSidearm = false; g.reloading = 0; g.cooldown = 0.25; g.bloom = 0;
  g.events.push({ type: 'switch', weapon: id });
}
// Cambiar de arma (Q): solo si el arma grande todavía tiene balas.
export function switchWeapon(g: Game) {
  if (g.over || g.needSidearm) return;
  if (g.current === 'primary') { if (!g.sidearm) return; g.current = 'sidearm'; } else {
    if (g.primary.mag + g.primary.reserve <= 0) return;
    g.current = 'primary';
  }
  g.reloading = 0; g.cooldown = 0.25; g.bloom = 0;
  g.events.push({ type: 'switch', weapon: weaponOf(g).id });
}
export function reload(g: Game) {
  const w = weaponOf(g);
  if (g.over || g.reloading > 0 || g.needSidearm || w.mag >= magSize(g, w) || w.reserve <= 0) return false;
  g.reloading = reloadTime(g);
  g.events.push({ type: 'reload', weapon: w.id });
  return true;
}
function finishReload(g: Game) {
  const w = weaponOf(g), take = Math.min(magSize(g, w) - w.mag, w.reserve);
  w.mag += take; if (w.reserve !== Infinity) w.reserve -= take;
  g.events.push({ type: 'reloaded', weapon: w.id });
}
export function setTrigger(g: Game, down: boolean) { if (down && !g.trigger) g.pulled = true; g.trigger = down; }
export function aimAt(g: Game, x: number, y: number) { g.aim.x = Math.max(0, Math.min(W, x)); g.aim.y = Math.max(0, Math.min(H, y)); }

// Cuánto sube el cartel (0 escondido, 1 parado) y cuánto se inclinó para atrás al recibir el tiro (0..1).
export const RISE = 0.18, LOWER = 0.22, FALL = 0.32;
export function poseOf(t: Target, now: number) {
  const a = now - t.changedAt;
  if (t.state === 'rising') return { up: Math.min(1, a / RISE), fall: 0 };
  if (t.state === 'lowering') return { up: Math.max(0, 1 - a / LOWER), fall: 0 };
  if (t.state === 'hit') return { up: 1, fall: Math.min(1, a / FALL) };
  if (t.state === 'gone') return { up: 0, fall: 1 };
  return { up: 1, fall: 0 };
}
const active = (t: Target) => t.state === 'rising' || t.state === 'up';

// Qué parte de qué cartel toca un tiro en (x, y) de la pantalla. Los de adelante tapan a los de atrás.
export function hitTest(g: Game, x: number, y: number): { t: Target; part: HitPart | null; lx: number; ly: number } | null {
  const order = [...g.targets].filter(active).sort((a, b) => b.scale - a.scale || b.y - a.y);
  for (const t of order) {
    const { up } = poseOf(t, g.time);
    if (up < 0.6 || y > t.y) continue; // todavía está detrás de la cobertura
    const lx = ((x - t.x) / t.scale) * (t.mirror ? -1 : 1), ly = (y - t.y) / t.scale + BOARD.h * (1 - up);
    if (Math.abs(lx) > BOARD.w / 2 || ly < -BOARD.h || ly > 0) continue;
    return { t, part: partsOf(t.kind).find(p => inside(p.shape, lx, ly)) ?? null, lx, ly }; // part null: pegó en el cartel, fuera de la figura
  }
  return null;
}

// Un disparo: puede ser un solo tiro o los perdigones de la escopeta.
function fire(g: Game, rand: () => number) {
  const w = weaponOf(g), spec = WEAPONS[w.id];
  if (w.mag <= 0) { g.events.push({ type: 'dry' }); if (!reload(g)) outOfAmmo(g); g.cooldown = 0.25; return; }
  w.mag -= 1; g.cooldown = spec.rate; g.stats.shots += 1;
  const r = spreadOf(g), impacts: { x: number; y: number }[] = [];
  for (let i = 0; i < spec.pellets; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * r;
    impacts.push({ x: g.aim.x + Math.cos(a) * d, y: g.aim.y + Math.sin(a) * d });
  }
  g.bloom = Math.min(34, g.bloom + spec.bloom);
  g.events.push({ type: 'shot', weapon: w.id, impacts });
  // Cada cartel cuenta una vez por disparo (con la escopeta: cabeza si algún perdigón le dio en la cabeza).
  const best = new Map<Target, { part: HitPart; lx: number; ly: number; x: number; y: number }>();
  for (const p of impacts) {
    const h = hitTest(g, p.x, p.y);
    if (!h) continue;
    h.t.holes.push({ x: h.lx, y: h.ly, color: spec.color });
    const part = h.part;
    if (!part) continue;
    const prev = best.get(h.t), rank = (q: HitPart) => (q.who === 'innocent' ? 3 : 0) + (q.zone === 'head' ? 1 : 0);
    if (!prev || rank(part) > rank(prev.part)) best.set(h.t, { part, lx: h.lx, ly: h.ly, x: p.x, y: p.y });
  }
  let hitAny = false;
  for (const [t, h] of best) {
    hitAny = true; t.state = 'hit'; t.changedAt = g.time;
    if (h.part.who === 'ammo') { g.stats.ammo += 1; refill(g); g.events.push({ type: 'ammo', x: h.x, y: h.y }); continue; }
    if (h.part.who === 'innocent') {
      const pts = Math.round(PTS.innocent * (g.char.id === 'r7' ? 0.5 : 1));
      g.score += pts; g.streak = 0; g.stats.innocents += 1;
      g.events.push({ type: 'penalty', kind: t.kind, points: pts, x: h.x, y: h.y });
      continue;
    }
    const head = h.part.zone === 'head';
    let pts = head ? (t.kind === 'maloRehen' ? PTS.hostageHead : PTS.head) : PTS.body;
    pts = Math.round(pts * spec.badMult) + (head && g.char.id === 'nova' ? 100 : 0);
    g.score += pts; g.stats.bad += 1; if (head) g.stats.heads += 1;
    g.events.push({ type: 'hit', kind: t.kind, zone: h.part.zone, points: pts, x: h.x, y: h.y });
    g.streak += 1;
    if (g.streak % PTS.streakEvery === 0) { g.score += PTS.streakBonus; g.events.push({ type: 'streak', bonus: PTS.streakBonus, count: g.streak }); }
  }
  if (hitAny) g.stats.hits += 1;
  if (w.mag <= 0 && !reload(g)) outOfAmmo(g);
}
function outOfAmmo(g: Game) {
  if (g.current === 'primary' && g.primary.mag + g.primary.reserve <= 0) {
    if (g.sidearm) { g.current = 'sidearm'; g.cooldown = 0.25; g.events.push({ type: 'switch', weapon: g.sidearm.id }); if (g.sidearm.mag <= 0) reload(g); }
    else { g.needSidearm = true; g.trigger = false; g.events.push({ type: 'empty' }); }
  }
}
// La caja de munición: un cargador más para el arma grande, y si estaba con el arma corta vuelve a la grande.
function refill(g: Game) {
  const spec = WEAPONS[g.primary.id];
  g.primary.reserve += spec.mag * 2;
  if (g.current === 'sidearm') { g.current = 'primary'; g.reloading = 0; g.bloom = 0; g.events.push({ type: 'switch', weapon: g.primary.id }); }
  if (g.primary.mag <= 0 && g.current === 'primary') reload(g);
}

// Elegir qué cartel sale y dónde.
function pickKind(g: Game, rand: () => number): TargetKind {
  const p = progress(g), r = rand();
  const hostageTake = g.time > 15 ? 0.08 + 0.08 * p : 0;
  if (r < hostageTake) return 'maloRehen';
  if (r < hostageTake + 0.5) return 'malo';
  if (r < hostageTake + 0.72) return 'civil';
  return 'rehen';
}
const ammoLow = (g: Game) => g.primary.reserve + g.primary.mag <= WEAPONS[g.primary.id].mag * 1.2;
export function spawn(g: Game, rand: () => number, kind?: TargetKind) {
  const free: { row: number; spot: number }[] = [];
  g.scene.rows.forEach((row, ri) => row.spots.forEach((_, si) => {
    if (!g.targets.some(t => t.row === ri && t.spot === si && t.state !== 'gone')) free.push({ row: ri, spot: si });
  }));
  if (!free.length) return null;
  const { row, spot } = free[Math.floor(rand() * free.length)];
  const k = kind ?? pickKind(g, rand), r = g.scene.rows[row], p = progress(g);
  const stay = (2.9 - 1.5 * p) * (k === 'maloRehen' ? 1.35 : k === 'municion' ? 1.4 : 1) * (0.85 + rand() * 0.3);
  const t: Target = {
    id: g.nextId++, kind: k, row, spot, x: r.spots[spot], y: r.y, scale: r.scale, born: g.time, stayUntil: g.time + RISE + stay,
    state: 'rising', changedAt: g.time, holes: [], seed: rand(), mirror: rand() < 0.5 && k !== 'maloRehen',
  };
  g.targets.push(t);
  g.events.push({ type: 'pop', x: t.x, y: t.y, scale: t.scale });
  return t;
}

export function step(g: Game, dt: number, rand: () => number = Math.random) {
  if (g.over) return;
  const before = g.time;
  g.time += dt;
  if (g.time < 0) { if (Math.ceil(-before) !== Math.ceil(-g.time)) g.events.push({ type: 'count', n: Math.ceil(-g.time) }); return; }
  if (before < 0) g.events.push({ type: 'go' });
  // Armas
  g.cooldown = Math.max(0, g.cooldown - dt);
  if (!g.trigger) g.bloom = Math.max(0, g.bloom - dt * 60);
  if (g.reloading > 0) { g.reloading -= dt; if (g.reloading <= 0) { g.reloading = 0; finishReload(g); } }
  const spec = specOf(g);
  if (!g.needSidearm && g.reloading <= 0 && g.cooldown <= 0 && (g.pulled || (spec.auto && g.trigger))) fire(g, rand);
  g.pulled = false;
  // Carteles
  for (const t of g.targets) {
    if (t.state === 'rising' && g.time - t.changedAt >= RISE) { t.state = 'up'; }
    if (t.state === 'up' && g.time >= t.stayUntil) {
      t.state = 'lowering'; t.changedAt = g.time;
      if (isBad(t.kind)) { g.score += PTS.escape; g.streak = 0; g.stats.escaped += 1; g.events.push({ type: 'escape', points: PTS.escape, x: t.x, y: t.y - 200 * t.scale }); }
    }
    if (t.state === 'lowering' && g.time - t.changedAt >= LOWER) t.state = 'gone';
    if (t.state === 'hit' && g.time - t.changedAt >= FALL + 0.7) t.state = 'gone';
  }
  g.targets = g.targets.filter(t => t.state !== 'gone');
  // Aparecen más carteles a medida que avanza la ronda.
  const p = progress(g), want = 1 + Math.floor(p * 3.5), live = g.targets.filter(active).length;
  g.nextSpawn -= dt;
  if (g.nextSpawn <= 0 || live < Math.min(1, want)) {
    if (live < want + 1) spawn(g, rand);
    g.nextSpawn = (1.25 - 0.75 * p) * (0.7 + rand() * 0.6);
  }
  g.nextAmmo -= dt;
  if (g.nextAmmo <= 0 && (ammoLow(g) || g.current === 'sidearm')) { spawn(g, rand, 'municion'); g.nextAmmo = 22 + rand() * 10; }
  if (g.time >= ROUND) { g.over = true; g.trigger = false; g.events.push({ type: 'end' }); }
}

export const accuracy = (s: Stats) => s.shots ? Math.round((s.hits / s.shots) * 100) : 0;

// ───────────── Récord ─────────────
const RECORD_KEY = 'escritorio-personal-juegos:tiro-al-blanco';
export interface TiroRecord { score: number; heads: number }
export function readTiroRecord(): TiroRecord {
  try { const r = JSON.parse(localStorage.getItem(RECORD_KEY) || 'null'); return { score: Number(r?.score) || 0, heads: Number(r?.heads) || 0 }; } catch { return { score: 0, heads: 0 }; }
}
export function saveTiroRecord(r: TiroRecord) { try { localStorage.setItem(RECORD_KEY, JSON.stringify(r)); } catch { /* sin almacenamiento */ } }
