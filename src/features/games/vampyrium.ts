// Vampyrium: el cazador de vampiros en el puente del castillo. Todo en "unidades" (el cazador mide 1,9), con y
// para arriba y el suelo en GROUND_Y. Este archivo es solo la lógica (sin dibujo) para poder probarla.
//
// Nivel 1: un suelo de piedra partido por dos huecos al vacío, plataformas a tres alturas, trampas de época
// (pinches que salen del piso, un péndulo con hacha y un brasero que larga una llamarada), vampiros que caminan
// (y salen trepando del vacío) y vampiros voladores que se tiran en picada. Espada (ilimitada) y estacas (se
// tiran; caen cajas del cielo con más). Con 50 vampiros muertos se abre la puerta de la derecha.

export const W = 28, H = 15.75;
export const GROUND_Y = 3.2;
export const GOAL = 50;
export const MAX_HP = 100; // la barra de vida del cazador
export const TRAP_DMG = 10, FALL_DMG = 10, HEART_HP = 25;
export const POWER_MAX = 10; // vampiros para cargar una cruz
export const PLAYER_W = 0.8, PLAYER_H = 1.9;
const GRAV = 36, SPEED = 7, JUMP = 16.2, JUMP2 = 14, FALL_MAX = 24;
const VAMP_W = 0.8;

// ---------------------------------------------------------------- Las armas
export type Weapon = 'sword' | 'crossbow' | 'garlic' | 'cross' | 'firesword' | 'pistol';
export const WEAPONS: Weapon[] = ['sword', 'crossbow', 'garlic', 'cross', 'firesword', 'pistol'];
export const WEAPON_NAME: Record<Weapon, string> = { sword: 'Espada', crossbow: 'Ballesta', garlic: 'Bomba de ajo', cross: 'Cruz', firesword: 'Espada de fuego', pistol: 'Pistola de fuego' };
// Cuánta vida le saca a cada vampiro que alcanza.
export const WEAPON_DMG: Record<Weapon, number> = { sword: 1, crossbow: 3, garlic: 5, cross: 10, firesword: 20, pistol: 20 };
// Munición: con cuánto se empieza cada nivel y cuánto se puede llevar (la espada no se gasta).
export const START_AMMO: Record<Weapon, number> = { sword: Infinity, crossbow: 10, garlic: 2, cross: 1, firesword: 3, pistol: 4 };
export const MAX_AMMO: Record<Weapon, number> = { sword: Infinity, crossbow: 30, garlic: 6, cross: 3, firesword: 10, pistol: 12 };
// El tamaño de cada ataque (en metros; un vampiro mide 0,8 de ancho y 1,8 de alto):
export const SWORD_REACH = 2.6, SWORD_H = 2.7; // la espada: un arco de 2,6 adelante y 2,7 de alto
export const FIRE_REACH = 6.5, FIRE_H = 5.4; // la espada de fuego: 2,5 veces más larga y el doble de alta = 5 veces más grande
export const BOLT_PIERCE = 3; // la flecha de la ballesta atraviesa hasta 3 vampiros
export const GARLIC_R = 3; // la onda de la bomba de ajo: 3 metros a cada lado del estallido (6 de punta a punta, unos 7 vampiros en fila)
export const CROSS_TARGETS = 6; // la cruz: rayos sobre los 6 vampiros más cercanos que estén a la vista
export const PISTOL_RANGE = 10; // la pistola de fuego: 10 metros (unos 10 vampiros uno al lado del otro); le pega al primero
// En qué nivel aparece cada arma: se van sumando a medida que se pasan los niveles.
export const WEAPON_LEVEL: Record<Weapon, number> = { sword: 1, crossbow: 2, garlic: 3, cross: 4, firesword: 5, pistol: 6 };
export const weaponUnlocked = (g: { level: number }, w: Weapon) => g.level >= WEAPON_LEVEL[w];
// Las armas que se disparan o se tiran: con ↑ o ↓ + Espacio apuntan en diagonal hacia arriba o hacia abajo.
export const AIMED: Weapon[] = ['crossbow', 'pistol', 'garlic'];
export const AIM_ANGLE = 0.7; // ≈ 40 grados
export const AMMO_PICKUP: Record<Weapon, number> = { sword: 0, crossbow: 8, garlic: 2, cross: 1, firesword: 3, pistol: 4 };

import { CHAPTERS, LEVELS, LEVEL_COUNT, type Chapter, type Goal, type LevelDef, type Surface, type Trap, type TrapKind } from './vampyriumLevels';
export { CHAPTERS, LEVELS, LEVEL_COUNT, type Chapter, type Goal, type LevelDef, type Surface, type Trap, type TrapKind };
// El nivel que se está jugando. Los arreglos se cambian por dentro (no se reemplazan): así SURFACES, GAPS y
// TRAPS siempre apuntan al nivel actual.
export const SURFACES: Surface[] = [];
export const GAPS: [number, number][] = [];
export const TRAPS: Trap[] = [];
export const LV: { def: LevelDef; surfaces: Surface[]; gaps: [number, number][]; traps: Trap[] } = { def: LEVELS[0], surfaces: SURFACES, gaps: GAPS, traps: TRAPS };
export function loadLevel(n: number) {
  const def = LEVELS[Math.max(1, Math.min(LEVEL_COUNT, n)) - 1];
  LV.def = def;
  SURFACES.length = 0; for (const q of def.surfaces) SURFACES.push({ ...q, bx1: q.x1, bx2: q.x2, by: q.y, dx: 0 });
  GAPS.length = 0; GAPS.push(...def.gaps.map(g => [g[0], g[1]] as [number, number]));
  TRAPS.length = 0; TRAPS.push(...def.traps.map(t => ({ ...t })));
  return def;
}
loadLevel(1);
const groundL = () => SURFACES.find(q => q.ground && q.x1 <= 0.01)!, groundR = () => SURFACES.find(q => q.ground && q.x2 >= W - 0.01)!;
// Las plataformas que se mueven (colgadas de cadenas): suben y bajan o van de un lado al otro.
function updateSurfaces(time: number) {
  for (const q of SURFACES) {
    if (!q.mv) { q.dx = 0; continue; }
    const k = Math.sin((time + (q.mv.phase ?? 0)) * Math.PI * 2 / q.mv.period), nx = q.bx1! + q.mv.dx * k;
    q.dx = nx - q.x1; q.x1 = nx; q.x2 = q.bx2! + q.mv.dx * k; q.y = q.by! + q.mv.dy * k;
  }
}
const DOOR_X1 = 26.7;
export const DOOR = { x1: DOOR_X1, x2: 27.9, y: GROUND_Y, h: 3.2 };
export const START_X = 2.6;


export interface Input { left: boolean; right: boolean; up: boolean; down: boolean; attack?: boolean } // attack: Espacio apretado (mantenido 3 s abre las armas)
export const HOLD_MENU = 3;
// Los ataques especiales de Demian (con la espada):
//  · spin:  doble salto + Espacio → una vuelta entera en el aire que corta todo alrededor.
//  · dash:  adelante, adelante + Espacio → atraviesa a los vampiros con una estocada rapidísima.
//  · whirl: adelante, atrás + Espacio → un giro horizontal que corta a los dos lados.
//  · throw: atrás, atrás + Espacio → tira la espada hacia adelante y vuelve como un bumerán.
export type SpecialKind = 'spin' | 'dash' | 'whirl' | 'throw';
export interface Special { kind: SpecialKind; t: number; dir: 1 | -1; hits: Set<number> }
export interface Boomer { x: number; y: number; vx: number; t: number; back: boolean; hits: Set<number>; x0: number }
export const SPECIAL_TIME: Record<SpecialKind, number> = { spin: 0.45, dash: 0.24, whirl: 0.45, throw: 0.25 };
export const SPECIAL_DMG = 2, DASH_SPEED = 26, SPIN_R = 2.6, WHIRL_R = 2.9, BOOMER_RANGE = 8, BOOMER_SPEED = 18;
export interface Player {
  x: number; y: number; vx: number; vy: number; face: 1 | -1; onGround: boolean; surface: Surface | null; jumps: number;
  hp: number; inv: number; attackT: number; attackWeapon: Weapon; hitIds: Set<number>; cool: number; walkT: number;
  dropT: number; coyote: number; safeX: number; prevUp: boolean; prevDown: boolean; hurtT: number; landT: number; spinT: number; aim: -1 | 0 | 1; prevL: boolean; prevR: boolean; special: Special | null; // spinT: la vuelta en el aire del doble salto; aim: apunta arriba (1), adelante (0) o abajo (-1)
}
export type VampKind = 'walker' | 'flyer' | 'giant' | 'mage' | 'hammer' | 'warrior' | 'wolf' | 'dracula' | 'dragon';
export const VAMP_KINDS: VampKind[] = ['walker', 'flyer', 'giant', 'mage', 'hammer', 'warrior', 'wolf', 'dracula', 'dragon'];
// Cuántos golpes del cazador aguanta cada uno (= cuántas veces más fuerte que un vampiro normal) y cuánta vida le saca al cazador.
export const STRENGTH: Record<VampKind, number> = { walker: 1, flyer: 1, giant: 3, mage: 4, hammer: 5, warrior: 6, wolf: 7, dracula: 50, dragon: 50 };
export const DAMAGE: Record<VampKind, number> = { walker: 1, flyer: 1, giant: 3, mage: 4, hammer: 5, warrior: 6, wolf: 7, dracula: 10, dragon: 15 };
export const VAMP_NAME: Record<VampKind, string> = { walker: 'Vampiro', flyer: 'Vampiro volador', giant: 'Vampiro gigante', mage: 'Vampiro mago', hammer: 'Vampiro martillo', warrior: 'Vampiro guerrero', wolf: 'Hombre lobo', dracula: 'Drácula', dragon: 'Drácula dragón' };
// El tamaño de cada uno (caja para los golpes) y la escala del dibujo.
export const VAMP_BIG = 1.25; // los vampiros más grandes (dibujo y caja de golpes)
const BODY0: Record<VampKind, { w: number; h: number; k: number }> = {
  walker: { w: 0.8, h: 1.8, k: 1 }, flyer: { w: 0.8, h: 1.4, k: 1 }, giant: { w: 1.3, h: 2.6, k: 1.42 }, mage: { w: 0.8, h: 1.9, k: 1.03 },
  hammer: { w: 0.95, h: 2.0, k: 1.1 }, warrior: { w: 0.95, h: 2.0, k: 1.08 }, wolf: { w: 1.7, h: 1.8, k: 1.3 }, dracula: { w: 1.0, h: 2.5, k: 1.32 }, dragon: { w: 4.8, h: 3.7, k: 1.35 },
};
export const BODY = Object.fromEntries(Object.entries(BODY0).map(([k, b]) => [k, { w: b.w * VAMP_BIG, h: b.h * VAMP_BIG, k: b.k * VAMP_BIG }])) as Record<VampKind, { w: number; h: number; k: number }>;
const SPECIALS: VampKind[] = ['giant', 'mage', 'hammer', 'warrior', 'wolf'];
// Qué vampiros salen en cada nivel: 1 normales y voladores; 2 + gigante; 3 + mago; 4 + martillo; 5 + guerrero; 6 + hombre lobo;
// 7 a 9 como el nivel 5; 10 solo Drácula.
export function rosterOf(level: number): VampKind[] {
  if (level >= 10) return ['dracula'];
  return ['walker', 'flyer', ...SPECIALS.slice(0, level >= 7 ? 4 : level - 1)];
}
export const isBoss = (k: VampKind) => k === 'dracula' || k === 'dragon';
export const flies = (k: VampKind) => k === 'flyer' || k === 'dragon';
export type VampState = 'walk' | 'claw' | 'hover' | 'dive' | 'rise' | 'cast' | 'leap' | 'mist' | 'breath' | 'land';
export interface Vamp {
  id: number; kind: VampKind; x: number; y: number; vx: number; vy: number; face: 1 | -1; state: VampState; t: number;
  onGround: boolean; surface: Surface | null; walkT: number; cool: number; speed: number; jumpT: number; dropT: number; hit: boolean;
  hp?: number; maxHp?: number; flash?: number; // los fuertes aguantan varios golpes (flash: el destello blanco del golpe)
  hurtT?: number; // golpeado por una trampa: sangra y sale despedido, pero no muere
  special?: number; // Drácula y el dragón: cuenta para el próximo ataque especial
  nav?: Nav; stuckT?: number; bestD?: number; unstuck?: number; waitT?: number; braveT?: number; // cómo se mueve por el nivel (ver navigate)
}
// El plan para llegar hasta el cazador: el próximo salto entre pisos y el lugar desde donde hacerlo.
export type Hop = 'same' | 'gap' | 'up' | 'down';
export interface Nav { t: number; kind: Hop; to: Surface | null; tx: number }
// Caja que ocupa (para los golpes del cazador y las trampas).
export function vampBox(v: Vamp): [number, number, number, number] {
  if (v.kind === 'flyer') return [v.x - 0.5, v.x + 0.5, v.y - 0.75, v.y + 1.0];
  if (v.kind === 'dragon') return [v.x - 3.0, v.x + 3.0, v.y - 2.0, v.y + 2.6];
  const b = BODY[v.kind]; return [v.x - b.w / 2, v.x + b.w / 2, v.y, v.y + b.h];
}
// Lo que tiran: la bola de fuego del mago, los murciélagos de Drácula y el fuego del dragón.
export interface Shot { x: number; y: number; vx: number; vy: number; t: number; life: number; kind: 'orb' | 'bat' | 'flame'; dmg: number }
// Los números que saltan con cada golpe.
// Lo que cae del cielo para juntar (estrellas doradas, almas) y lo que hay que romper (jaulas, ataúdes).
export interface Item { id: number; kind: 'star' | 'soul'; x: number; y: number; vy: number; landed: boolean; t: number }
export interface Breakable { id: number; kind: 'cage' | 'coffin'; x: number; y: number; hp: number; maxHp: number; flash: number; t: number }
export const BREAK_HP = { cage: 4, coffin: 5 };
export interface Pop { x: number; y: number; t: number; text: string; bad: boolean }
export type KillHow = 'sword' | 'bolt' | 'bomb' | 'cross' | 'fire' | 'bullet' | 'trap' | 'void' | 'crate';
export interface Corpse { id: number; kind: VampKind; x: number; y: number; face: 1 | -1; t: number; how: KillHow }
export type BoneKind = 'skull' | 'jaw' | 'ribs' | 'pelvis' | 'arm' | 'leg' | 'spine';
export interface Bone { kind: BoneKind; x: number; y: number; vx: number; vy: number; a: number; va: number; t: number; rest: boolean }
export interface Spark { x: number; y: number; vx: number; vy: number; t: number; life: number; hue: number }
// Sangre que salpica: gotas que vuelan y quedan como manchas en el piso.
export interface Drop { x: number; y: number; vx: number; vy: number; r: number; t: number; stuck: boolean }
export const BURN_AT = 0.25, BLOW_AT = 1.05; // el vampiro se vuelve esqueleto, arde como una antorcha y al segundo revienta
export interface Bolt { x: number; y: number; vx: number; vy: number; t: number; stuck: boolean; hits: number[] } // flecha de la ballesta
export interface Bomb { x: number; y: number; vx: number; vy: number; t: number; landed: number; a: number } // bomba de ajo (landed: tiempo desde que tocó el piso)
export interface Bullet { x: number; y: number; vx: number; vy: number; x0: number; y0: number; t: number } // la bala de fuego de la pistola
// Efectos: la onda de la bomba, los rayos de la cruz, la ola de fuego de la espada y el estallido de la bala.
export interface Fx { kind: 'blast' | 'bolt' | 'wave' | 'burst'; x: number; y: number; t: number; life: number; r: number; face: 1 | -1; seed: number }
export type CrateKind = 'bolts' | 'heart' | 'garlic' | 'fire' | 'bullets';
export interface Crate { id: number; kind: CrateKind; x: number; y: number; vy: number; landed: boolean; t: number; surface: Surface | null }

export type GameEvent =
  | { type: 'slash' } | { type: 'throw' } | { type: 'stakeHit' } | { type: 'empty'; weapon: Weapon } | { type: 'shoot'; weapon: Weapon } | { type: 'blast'; count: number } | { type: 'crossReady' }
  | { type: 'kill'; kind: VampKind; how: KillHow; x: number; y: number } | { type: 'bones'; x: number; y: number }
  | { type: 'hurt'; hp: number; dmg: number } | { type: 'vampHit'; kind: VampKind; hp: number } | { type: 'block' } | { type: 'slam' } | { type: 'cast' } | { type: 'bats' } | { type: 'breath' } | { type: 'mist' }
  | { type: 'collect'; kind: Item['kind']; n: number; of: number } | { type: 'break'; kind: Breakable['kind']; n: number; of: number } | { type: 'objHit' } | { type: 'transform' } | { type: 'dragon' } | { type: 'bossDead' } | { type: 'howl'; kind: VampKind } | { type: 'spawn'; kind: VampKind } | { type: 'fall'; hp: number } | { type: 'jump'; double: boolean } | { type: 'land' } | { type: 'step' }
  | { type: 'crate' } | { type: 'pickup'; kind: CrateKind; amount: number } | { type: 'door' } | { type: 'spikes' } | { type: 'fire' }
  | { type: 'swing' } | { type: 'special'; kind: SpecialKind } | { type: 'catch' } | { type: 'thunder'; near: number } | { type: 'combo'; n: number } | { type: 'holy'; count: number } | { type: 'wave'; n: number } | { type: 'bloodMoon' }
  | { type: 'menu'; open: boolean } | { type: 'choose'; weapon: Weapon } | { type: 'hiss'; x: number } | { type: 'dive' } | { type: 'emerge' }
  | { type: 'vampFall' } | { type: 'burn' } | { type: 'vampHurt'; x: number; trap?: TrapKind } | { type: 'cleared' } | { type: 'over' } | { type: 'won' } | { type: 'powerReady' };

// Un rayo de la tormenta: t = segundos desde que cayó, x = dónde (en metros), near = qué tan cerca (0 lejos, 1 encima).
export interface Storm { next: number; t: number; x: number; near: number; seed: number }
export const STORM_LEVEL = 9;

export type Phase = 'play' | 'menu' | 'dead' | 'cleared' | 'won' | 'over';
export interface Game {
  level: number; time: number; real: number; phase: Phase; phaseT: number;
  player: Player; vamps: Vamp[]; corpses: Corpse[]; bones: Bone[]; sparks: Spark[]; drops: Drop[]; bolts: Bolt[]; bombs: Bomb[]; bullets: Bullet[]; fx: Fx[]; crates: Crate[];
  goal: Goal; progress: number; items: Item[]; objects: Breakable[]; itemT: number;
  kills: Record<VampKind, number>; total: number; shots: Shot[]; pops: Pop[]; transformT: number; bossDeadT: number; bossHits: number; voidKills: number; trapKills: number;
  weapon: Weapon; ammo: Record<Weapon, number>; menu: { sel: number; t: number }; lastTap: number; holdT: number;
  combo: { n: number; t: number; best: number }; power: number; holyT: number; garlicT: number;
  door: { open: boolean; t: number }; spawnT: number; crateT: number; nextId: number; wave: number; bloodMoon: boolean;
  taps: { d: 1 | -1; t: number; f: 1 | -1 }[]; boomer: Boomer | null; // las flechas tocadas (para los especiales) y la espada que vuelve
  storm: Storm | null; // la tormenta de lluvia y rayos (nivel 9)
  flash: number; shake: number; events: GameEvent[]; rand: () => number; stats: { slashes: number; throws: number; hits: number; crates: number; falls: number };
}

export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function newPlayer(): Player {
  return { x: START_X, y: GROUND_Y, vx: 0, vy: 0, face: 1, onGround: true, surface: groundL(), jumps: 0, hp: MAX_HP, inv: 0, attackT: -1, attackWeapon: 'sword', hitIds: new Set(), cool: 0, walkT: 0, dropT: 0, coyote: 0, safeX: START_X, prevUp: false, prevDown: false, hurtT: 0, landT: 0, spinT: 0, aim: 0, prevL: false, prevR: false, special: null };
}
export function newGame(seed = Math.floor(Math.random() * 1e9), level = 1): Game {
  loadLevel(level);
  const g: Game = {
    level: LV.def.n, time: 0, real: 0, phase: 'play', phaseT: 0, player: newPlayer(), vamps: [], corpses: [], bones: [], sparks: [], drops: [], bolts: [], bombs: [], bullets: [], fx: [], crates: [],
    kills: Object.fromEntries(VAMP_KINDS.map(k => [k, 0])) as Record<VampKind, number>, total: 0, shots: [], pops: [], transformT: 0, bossDeadT: -1, bossHits: 0, voidKills: 0, trapKills: 0, weapon: 'sword', ammo: { ...START_AMMO }, menu: { sel: 0, t: 0 }, lastTap: -9, holdT: 0,
    combo: { n: 0, t: 0, best: 0 }, power: 0, holyT: 0, garlicT: 0, goal: CHAPTERS[LV.def.n]?.goal ?? { type: 'kill', n: GOAL }, progress: 0, items: [], objects: [], itemT: 2, door: { open: false, t: 0 }, spawnT: 1.6, crateT: 9, nextId: 1, wave: 1, bloodMoon: false,
    flash: 0, shake: 0, events: [], rand: mulberry(seed), stats: { slashes: 0, throws: 0, hits: 0, crates: 0, falls: 0 },
    taps: [], boomer: null,
    storm: LV.def.n === STORM_LEVEL ? { next: 2.5, t: 99, x: W / 2, near: 0.5, seed: 0 } : null,
  };
  if (g.goal.type === 'break') placeBreakables(g, g.goal.n, g.goal.obj);
  if (rosterOf(g.level)[0] === 'dracula') { // el último nivel: solo Drácula, que espera en el salón del trono
    const s = groundR();
    g.vamps.push(makeVamp(g, 'dracula', { x: Math.min(s.x2 - 3, 22), y: s.y, onGround: true, surface: s, face: -1, state: 'walk', speed: 3.1, cool: 2.5, special: 5 }));
    g.spawnT = 1e9;
  }
  return g;
}
export function makeVamp(g: Game, kind: VampKind, o: Partial<Vamp>): Vamp {
  const hp = STRENGTH[kind];
  return { id: g.nextId++, kind, x: 0, y: GROUND_Y, vx: 0, vy: 0, face: 1, state: 'walk', t: 0, onGround: false, surface: null, walkT: 0, cool: 1, speed: 2.5, jumpT: 0, dropT: 0, hit: false, hp, maxHp: hp, flash: 0, ...o };
}
const emit = (g: Game, e: GameEvent) => { g.events.push(e); };
export function takeEvents(g: Game) { const e = g.events; g.events = []; return e; }

// ---------------------------------------------------------------- Suelo y huecos
export const inGap = (x: number) => GAPS.some(([a, b]) => x > a && x < b);
// Los pisos de los bordes siguen fuera de la pantalla (por ahí entran los vampiros).
const ex1 = (s: Surface) => s.ground && s.x1 <= 0.01 ? -6 : s.x1, ex2 = (s: Surface) => s.ground && s.x2 >= W - 0.01 ? W + 6 : s.x2;
const surfaceUnder = (x: number, halfW: number, prevY: number, y: number, skipPlatforms: boolean) => {
  let best: Surface | null = null;
  for (const s of SURFACES) {
    if (!s.ground && skipPlatforms) continue;
    if (x + halfW * 0.6 < ex1(s) || x - halfW * 0.6 > ex2(s)) continue;
    if (prevY >= s.y - 0.02 && y <= s.y && (!best || s.y > best.y)) best = s;
  }
  return best;
};
// Los costados de los huecos son paredes: abajo del nivel del suelo no se puede entrar en la piedra.
function gapWalls(x: number, y: number, halfW: number) {
  if (y >= GROUND_Y - 0.05) return x;
  for (const [a, b] of GAPS) if (x > a - halfW * 2 && x < b + halfW * 2) return Math.max(a + halfW, Math.min(b - halfW, x));
  return x;
}
const stillOn = (s: Surface | null, x: number, halfW: number) => !!s && x + halfW * 0.6 >= ex1(s) && x - halfW * 0.6 <= ex2(s);

// Mueve un cuerpo (cazador o vampiro caminante) con gravedad y lo apoya en el suelo y las plataformas.
interface Body { x: number; y: number; vx: number; vy: number; onGround: boolean; surface: Surface | null; dropT: number }
function moveBody(b: Body, dt: number, halfW: number, minX: number, maxX: number) {
  b.vy = Math.max(-FALL_MAX, b.vy - GRAV * dt);
  b.x = Math.max(minX, Math.min(maxX, b.x + b.vx * dt));
  const prevY = b.y;
  if (b.onGround && b.surface?.dx) b.x = Math.max(minX, Math.min(maxX, b.x + b.surface.dx)); // la plataforma que se mueve lo lleva
  if (b.onGround && stillOn(b.surface, b.x, halfW) && b.vy <= 0 && !(b.dropT > 0 && b.surface && !b.surface.ground)) { b.vy = 0; b.y = b.surface!.y; }
  else {
    b.onGround = false; b.surface = null;
    b.y += b.vy * dt;
    if (b.vy <= 0) {
      const s = surfaceUnder(b.x, halfW, prevY, b.y, b.dropT > 0);
      if (s) { b.y = s.y; b.vy = 0; b.onGround = true; b.surface = s; return true; }
    }
  }
  b.x = gapWalls(b.x, b.y, halfW);
  return false;
}

// ---------------------------------------------------------------- Trampas
export interface TrapGeo { a: number; tipX: number; tipY: number; warn: number; on: number; cx: number; cy: number; bottom: number; reach: number }
const geo = (o: Partial<TrapGeo>): TrapGeo => ({ a: 0, tipX: 0, tipY: 0, warn: 0, on: 0, cx: 0, cy: 0, bottom: 0, reach: 0, ...o });
const smooth = (k: number) => 0.5 - 0.5 * Math.cos(k * Math.PI * 2);
export const SAW_R = 0.75, ROLL_R = 0.6;
export function trapState(t: Trap, time: number): TrapGeo {
  const ph = ((time + t.offset) % t.period + t.period) % t.period, k = ph / t.period;
  switch (t.kind) {
    case 'pendulum': { const a = t.amp * Math.sin((time + t.offset) * Math.PI * 2 / t.period); return geo({ a, tipX: t.x + Math.sin(a) * t.len, tipY: t.y - Math.cos(a) * t.len, on: 1 }); }
    case 'spikes': { const warn = ph > t.period - 1.8 && ph < t.period - 1.2 ? 1 : 0, up = ph >= t.period - 1.2 ? Math.min(1, (ph - (t.period - 1.2)) / 0.08, (t.period - ph) / 0.15) : 0; return geo({ warn, on: up }); }
    case 'saw': { const cx = t.x + (t.x2 - t.x) * smooth(k); return geo({ cx, cy: t.y + SAW_R * 0.75, a: (time + t.offset) * 14, on: 1 }); }
    case 'roller': { const cx = t.x + (t.x2 - t.x) * smooth(k); return geo({ cx, cy: t.y + ROLL_R, a: cx / ROLL_R, on: 1 }); }
    case 'crusher': { // cuelga, tiembla, cae de golpe, se queda y vuelve a subir despacio
      const top = t.top ?? 12, warn = ph > 1.6 && ph < 2.3 ? 1 : 0;
      const bottom = ph < 2.3 ? top : ph < 2.5 ? top - (top - t.y) * ((ph - 2.3) / 0.2) ** 2 : ph < 3.1 ? t.y : t.y + (top - t.y) * Math.min(1, (ph - 3.1) / (t.period - 3.1));
      return geo({ bottom, warn, on: ph >= 2.3 && ph < 2.55 ? 1 : 0, cx: t.x });
    }
    case 'drip': { // una gota (o calavera, o bola de fuego) se forma arriba y cae
      const top = t.top ?? 16, fall = Math.max(0, ph - 0.7), cy = top - 0.5 * 22 * fall * fall;
      return geo({ cx: t.x, cy: Math.max(t.y, cy), warn: ph < 0.7 ? ph / 0.7 : 0, on: ph >= 0.7 && cy > t.y ? 1 : 0 });
    }
    case 'jet': { const warn = ph > t.period - 2.2 && ph < t.period - 1.6 ? 1 : 0, on = ph >= t.period - 1.6 ? Math.min(1, (ph - (t.period - 1.6)) / 0.15, (t.period - ph) / 0.3) : 0; return geo({ warn, on, reach: t.len * on }); }
    default: { const warn = ph > t.period - 2.4 && ph < t.period - 1.6 ? 1 : 0, on = ph >= t.period - 1.6 ? Math.min(1, (ph - (t.period - 1.6)) / 0.15, (t.period - ph) / 0.3) : 0; return geo({ warn, on }); } // fuego
  }
}
const circleHits = (cx: number, cy: number, r: number, x1: number, x2: number, y1: number, y2: number) => Math.hypot(Math.max(x1, Math.min(x2, cx)) - cx, Math.max(y1, Math.min(y2, cy)) - cy) < r;
// ¿La trampa lastima algo que ocupa esta caja (x1..x2, y1..y2)?
function trapHits(t: Trap, time: number, x1: number, x2: number, y1: number, y2: number) {
  const s = trapState(t, time);
  switch (t.kind) {
    case 'spikes': return s.on > 0.6 && x2 > t.x && x1 < t.x2 && y1 < t.y + 0.75 && y2 > t.y - 0.1;
    case 'fire': return s.on > 0.4 && x2 > t.x - 0.45 && x1 < t.x + 0.45 && y1 < t.y + t.len * s.on && y2 > t.y;
    case 'saw': return circleHits(s.cx, s.cy, SAW_R * 0.92, x1, x2, y1, y2);
    case 'roller': return circleHits(s.cx, s.cy, ROLL_R * 1.05, x1, x2, y1, y2);
    case 'crusher': return s.on > 0 && x2 > t.x - t.len && x1 < t.x + t.len && y1 < s.bottom + 0.2 && y2 > s.bottom - 0.6;
    case 'drip': return s.on > 0 && circleHits(s.cx, s.cy, 0.35, x1, x2, y1, y2);
    case 'jet': { if (s.on < 0.3) return false; const a = Math.min(t.x, t.x + t.amp * s.reach), b = Math.max(t.x, t.x + t.amp * s.reach); return x2 > a && x1 < b && y1 < t.y + 1.3 && y2 > t.y + 0.5; }
    default: return circleHits(s.tipX, s.tipY, 0.85, x1, x2, y1, y2); // péndulo
  }
}

// ---------------------------------------------------------------- Ataques del cazador
// Espacio: ataca con el arma que tiene. Mantenido 3 segundos: abre el cartel de las armas (eso lo mira step).
export function pressAttack(g: Game) {
  if (g.phase === 'menu') { chooseWeapon(g, WEAPONS[g.menu.sel]); return; }
  if (g.phase !== 'play') return;
  g.lastTap = g.real;
  attack(g);
}
export function openMenu(g: Game) { if (g.phase !== 'play') return; g.phase = 'menu'; g.menu = { sel: WEAPONS.indexOf(g.weapon), t: 0 }; emit(g, { type: 'menu', open: true }); }
export function closeMenu(g: Game) { if (g.phase !== 'menu') return; g.phase = 'play'; emit(g, { type: 'menu', open: false }); }
export function menuMove(g: Game, step: number) { // salta las armas que todavía no aparecieron
  if (g.phase !== 'menu') return;
  let sel = g.menu.sel;
  for (let i = 0; i < WEAPONS.length; i++) { sel = (sel + step + WEAPONS.length) % WEAPONS.length; if (weaponUnlocked(g, WEAPONS[sel])) break; }
  g.menu.sel = sel; g.menu.t = 0;
}
export function chooseWeapon(g: Game, w: Weapon) {
  if (!weaponUnlocked(g, w)) return;
  g.weapon = w; emit(g, { type: 'choose', weapon: w });
  if (g.phase === 'menu') { g.phase = 'play'; emit(g, { type: 'menu', open: false }); }
}
// ¿Qué especial pide la combinación de flechas recién tocada? (las dos últimas, rápidas, y Espacio enseguida)
function comboSpecial(g: Game): { kind: SpecialKind; dir: 1 | -1 } | null {
  const p = g.player;
  if (!p.onGround && p.jumps === 2) return { kind: 'spin', dir: p.face }; // (una vez por salto)
  const [a, b] = g.taps.slice(-2);
  if (!a || !b || g.real - b.t > 0.4 || b.t - a.t > 0.45) return null;
  const f = a.f; // para dónde miraba antes de la combinación
  if (a.d === f && b.d === f) return { kind: 'dash', dir: f };
  if (a.d === f && b.d === -f) return { kind: 'whirl', dir: f };
  if (a.d === -f && b.d === -f) return { kind: 'throw', dir: f };
  return null;
}
// Una flecha tocada (desde el teclado, al instante: así la combinación funciona aunque Espacio llegue en el mismo cuadro).
export function noteTap(g: Game, d: 1 | -1) {
  const p = g.player; g.taps.push({ d, t: g.real, f: p.face }); if (g.taps.length > 3) g.taps.shift();
  if (d > 0) p.prevR = true; else p.prevL = true;
}
function startSpecial(g: Game, kind: SpecialKind, dir: 1 | -1) {
  const p = g.player;
  if (kind === 'throw' && g.boomer) return false; // la espada todavía no volvió
  g.taps = [];
  p.special = { kind, t: 0, dir, hits: new Set() }; p.face = dir; p.attackT = -1; p.cool = SPECIAL_TIME[kind] + 0.08; g.stats.slashes++;
  if (kind === 'spin') { p.spinT = SPECIAL_TIME.spin; p.vy = Math.max(p.vy, 4); p.jumps = 3; }
  if (kind === 'dash') { p.inv = Math.max(p.inv, SPECIAL_TIME.dash + 0.1); }
  if (kind === 'throw') { p.attackT = 0; p.attackWeapon = 'sword'; p.hitIds = new Set(); }
  if (kind === 'throw') g.boomer = { x: p.x + dir * 0.6, y: p.y + 1.25, vx: dir * BOOMER_SPEED, t: 0, back: false, hits: new Set(), x0: p.x };
  emit(g, { type: 'special', kind });
  return true;
}
// El corte de un especial: todos los vampiros (y ataúdes y tiros) dentro de la caja, una vez cada uno.
function specialHit(g: Game, hits: Set<number>, x1: number, x2: number, y1: number, y2: number) {
  const p = g.player;
  for (const v of [...g.vamps]) { if (hits.has(v.id)) continue; const [a, b, c, d] = vampBox(v); if (b > x1 && a < x2 && d > y1 && c < y2) { hits.add(v.id); g.stats.hits++; hitVamp(g, v, WEAPON_DMG.sword * SPECIAL_DMG, 'sword', p.x); } }
  for (const o of [...g.objects]) if (!hits.has(o.id) && o.x + 0.6 > x1 && o.x - 0.6 < x2 && o.y + 2 > y1 && o.y < y2) { hits.add(o.id); hitObject(g, o, WEAPON_DMG.sword * SPECIAL_DMG); }
  for (const s of [...g.shots]) if (s.kind !== 'flame' && s.x > x1 && s.x < x2 && s.y > y1 && s.y < y2) g.shots.splice(g.shots.indexOf(s), 1);
}
function updateSpecial(g: Game, dt: number) {
  const p = g.player, sp = p.special;
  if (sp) {
    sp.t += dt;
    const cy = p.y + 1.0;
    if (sp.kind === 'spin') specialHit(g, sp.hits, p.x - SPIN_R, p.x + SPIN_R, cy - SPIN_R, cy + SPIN_R);
    else if (sp.kind === 'whirl') specialHit(g, sp.hits, p.x - WHIRL_R, p.x + WHIRL_R, p.y - 0.2, p.y + 2.4);
    else if (sp.kind === 'dash') { const x0 = p.x; p.vx = sp.dir * DASH_SPEED; specialHit(g, sp.hits, Math.min(x0, x0 + sp.dir * 1.6) - 0.4, Math.max(x0, x0 + sp.dir * 1.6) + 0.4, p.y - 0.2, p.y + 2.4); }
    if (sp.t >= SPECIAL_TIME[sp.kind]) { if (sp.kind === 'dash') p.vx = sp.dir * SPEED * 0.4; p.special = null; }
  }
  const bm = g.boomer;
  if (bm) { // la espada que gira hacia adelante y vuelve a la mano
    bm.t += dt;
    if (!bm.back && Math.abs(bm.x - bm.x0) >= BOOMER_RANGE) { bm.back = true; bm.hits = new Set(); }
    if (bm.back) { const tx = p.x, ty = p.y + 1.25, dx = tx - bm.x, dy = ty - bm.y, d = Math.hypot(dx, dy) || 1; bm.x += dx / d * BOOMER_SPEED * dt; bm.y += dy / d * BOOMER_SPEED * dt; if (d < 0.5 || bm.t > 3) { g.boomer = null; emit(g, { type: 'catch' }); return; } }
    else bm.x += bm.vx * dt;
    if (bm.x < -1 || bm.x > W + 1) { bm.back = true; bm.hits = new Set(); }
    specialHit(g, bm.hits, bm.x - 0.7, bm.x + 0.7, bm.y - 0.7, bm.y + 0.7);
  }
}

export function attack(g: Game) {
  const p = g.player;
  if (g.phase !== 'play') return;
  if (g.weapon === 'sword' && !p.special && p.cool <= 0.15) { const c = comboSpecial(g); if (c && startSpecial(g, c.kind, c.dir)) return; }
  if (p.cool > 0) return;
  if (g.weapon === 'sword' && g.boomer) return; // sin espada en la mano hasta que vuelva
  if (g.ammo[g.weapon] <= 0) { emit(g, { type: 'empty', weapon: g.weapon }); g.weapon = 'sword'; }
  const w = g.weapon;
  if (w === 'cross') { stormCross(g); return; }
  p.attackT = 0; p.attackWeapon = w; p.hitIds = new Set();
  if (w !== 'sword') g.ammo[w]--;
  const hy = p.y + 1.3 + p.aim * 0.25, hx = p.x + p.face * 0.6, ca = Math.cos(p.aim * AIM_ANGLE), sa = Math.sin(p.aim * AIM_ANGLE);
  if (w === 'sword') { p.cool = 0.3; g.stats.slashes++; emit(g, { type: 'slash' }); }
  else if (w === 'firesword') { // la ola de fuego: 5 veces más grande que el tajo común
    p.cool = 0.55; g.stats.slashes++; g.shake = Math.max(g.shake, 0.35);
    g.fx.push({ kind: 'wave', x: p.x, y: p.y, t: 0, life: 0.45, r: FIRE_REACH, face: p.face, seed: g.rand() });
    emit(g, { type: 'shoot', weapon: w });
  } else if (w === 'crossbow') { p.cool = 0.45; g.stats.throws++; g.bolts.push({ x: hx + p.face * 0.5 * ca, y: hy + 0.5 * sa, vx: p.face * 24 * ca, vy: 24 * sa + 0.4, t: 0, stuck: false, hits: [] }); emit(g, { type: 'shoot', weapon: w }); }
  else if (w === 'pistol') { p.cool = 0.5; g.stats.throws++; g.bullets.push({ x: hx + p.face * 0.4 * ca, y: hy + 0.05 + 0.4 * sa, vx: p.face * 28 * ca, vy: 28 * sa, x0: hx, y0: hy, t: 0 }); g.fx.push({ kind: 'burst', x: hx + p.face * 0.75 * ca, y: hy + 0.05 + 0.75 * sa, t: 0, life: 0.18, r: 0.5, face: p.face, seed: g.rand() }); emit(g, { type: 'shoot', weapon: w }); }
  else { p.cool = 0.6; g.stats.throws++; g.bombs.push({ x: hx, y: hy + 0.2, vx: p.face * (p.aim > 0 ? 6.5 : p.aim < 0 ? 7 : 8.5) + p.vx * 0.3, vy: p.aim > 0 ? 14 : p.aim < 0 ? 1 : 8.5, t: 0, landed: -1, a: 0 }); emit(g, { type: 'throw' }); } // la bomba de ajo
  if (g.ammo[w] <= 0) { g.weapon = 'sword'; emit(g, { type: 'empty', weapon: w }); } // la última: vuelve la espada
}
// La cruz: una tormenta de rayos sobre los 6 vampiros más cercanos que estén a la vista (10 de daño a cada uno).
export function stormCross(g: Game) {
  const p = g.player;
  if (g.phase !== 'play' || !weaponUnlocked(g, 'cross') || g.ammo.cross <= 0 || p.cool > 0) return false;
  g.ammo.cross--; p.cool = 0.6; p.attackT = 0; p.attackWeapon = 'cross';
  g.holyT = 1.2; g.flash = 0.9; g.shake = 0.6; g.shots = g.shots.filter(s => s.kind === 'flame');
  const before = g.total;
  const targets = g.vamps.filter(v => v.state !== 'mist' && v.x > -0.5 && v.x < W + 0.5).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x)).slice(0, CROSS_TARGETS);
  targets.forEach((v, i) => { const [, , , y2] = vampBox(v); g.fx.push({ kind: 'bolt', x: v.x, y: y2 - 0.3, t: -i * 0.06, life: 0.55, r: 0, face: 1, seed: g.rand() }); hitVamp(g, v, WEAPON_DMG.cross, 'cross', p.x); });
  for (let i = 0; i < 3; i++) g.fx.push({ kind: 'bolt', x: g.rand() * W, y: GROUND_Y, t: -0.1 - i * 0.12, life: 0.45, r: 0, face: 1, seed: g.rand() }); // más rayos de la tormenta
  if (g.weapon === 'cross' && g.ammo.cross <= 0) g.weapon = 'sword';
  emit(g, { type: 'holy', count: g.total - before });
  return true;
}
export const castHoly = stormCross; // (la tecla C y ↓ + Espacio)
// La carga de la cruz: cada 10 vampiros (o 5 golpes a Drácula) suma una cruz.
function chargeCross(g: Game) {
  if (!weaponUnlocked(g, 'cross')) return; // la cruz aparece en el nivel 4
  if (g.ammo.cross >= MAX_AMMO.cross) { g.power = POWER_MAX; return; }
  g.power++;
  if (g.power >= POWER_MAX) { g.power = 0; g.ammo.cross++; emit(g, { type: 'crossReady' }); emit(g, { type: 'powerReady' }); }
}

const bleed = (g: Game, x: number, y: number, n: number, sp = 8) => { for (let i = 0; i < n; i++) { const a = g.rand() * Math.PI * 1.1 - 0.05, v = 2 + g.rand() * sp; g.drops.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 0.05 + g.rand() * 0.1, t: 0, stuck: false }); } };
const pop = (g: Game, x: number, y: number, text: string, bad: boolean) => { g.pops.push({ x, y, t: 0, text, bad }); if (g.pops.length > 30) g.pops.shift(); };
// Un golpe del cazador (espada o estaca = 1 punto, la cruz = 10): le baja la vida y, si llega a 0, se muere.
export function hitVamp(g: Game, v: Vamp, dmg: number, how: KillHow, fromX: number) {
  if (!g.vamps.includes(v) || v.state === 'mist' || g.transformT > 0) return;
  const [, , y1, y2] = vampBox(v);
  v.hp = (v.hp ?? 1) - dmg; v.flash = 0.18;
  if (isBoss(v.kind)) { const before = Math.floor(g.bossHits / 5); g.bossHits += dmg; if (how !== 'cross') for (let k = before; k < Math.floor(g.bossHits / 5); k++) chargeCross(g); }
  if (v.hp <= 0) { kill(g, v, how); return; }
  pop(g, v.x, y2 + 0.2, `−${dmg}`, false);
  bleed(g, v.x, (y1 + y2) / 2, 16 + dmg * 3);
  if (!isBoss(v.kind)) { // sale despedido para atrás (los más pesados, menos)
    const push = STRENGTH[v.kind] >= 5 ? 2.5 : 5;
    v.vx = (v.x >= fromX ? 1 : -1) * push;
    if (STRENGTH[v.kind] < 5 && v.state !== 'cast') { v.state = flies(v.kind) ? v.state : 'walk'; v.cool = Math.max(v.cool, 0.4); }
  }
  emit(g, { type: 'vampHit', kind: v.kind, hp: v.hp });
}

function kill(g: Game, v: Vamp, how: KillHow) {
  const i = g.vamps.indexOf(v); if (i < 0) return;
  g.vamps.splice(i, 1);
  if (v.kind === 'dracula') { // Drácula no se muere: se convierte en dragón
    g.transformT = 2.4; g.flash = 1; g.shake = 1; g.shots = [];
    g.corpses.push({ id: v.id, kind: 'dracula', x: v.x, y: v.y, face: v.face, t: -9, how }); // (el cuerpo que se transforma)
    emit(g, { type: 'transform' });
    return;
  }
  if (how !== 'void') g.corpses.push({ id: v.id, kind: v.kind, x: v.x, y: v.y, face: v.face, t: 0, how });
  emit(g, { type: 'kill', kind: v.kind, how, x: v.x, y: v.y });
  // Solo cuentan los que mata el cazador (no los que se caen al vacío ni los que agarra una trampa).
  if (how === 'void') { g.voidKills++; return; }
  if (how === 'trap') { g.trapKills++; return; }
  g.kills[v.kind]++; g.total++;
  if (v.kind === 'dragon') { g.bossDeadT = 0; g.shots = []; emit(g, { type: 'bossDead' }); return; }
  g.combo.n = g.combo.t > 0 ? g.combo.n + 1 : 1; g.combo.t = 2.4; g.combo.best = Math.max(g.combo.best, g.combo.n);
  if (g.combo.n >= 2) emit(g, { type: 'combo', n: g.combo.n });
  if (how !== 'cross') chargeCross(g);
  if (g.total % 10 === 0 && g.total < GOAL) { g.wave = g.total / 10 + 1; emit(g, { type: 'wave', n: g.wave }); }
  if (g.total >= 35 && !g.bloodMoon) { g.bloodMoon = true; emit(g, { type: 'bloodMoon' }); }
}

// Le sacan vida al cazador (cada vampiro según su fuerza; trampas y caídas, 10).
function hurt(g: Game, fromX: number, dmg = 1) {
  const p = g.player;
  if (p.inv > 0 || g.phase !== 'play') return;
  p.hp = Math.max(0, p.hp - dmg); p.inv = 1.1; p.hurtT = 0.35; g.shake = Math.max(g.shake, Math.min(1, 0.3 + dmg * 0.04));
  p.vx = (p.x >= fromX ? 1 : -1) * (6 + Math.min(6, dmg * 0.5)); p.vy = 8 + Math.min(4, dmg * 0.3); p.onGround = false; p.surface = null;
  pop(g, p.x, p.y + PLAYER_H + 0.3, `−${dmg}`, true);
  emit(g, { type: 'hurt', hp: p.hp, dmg });
  if (p.hp <= 0) { g.phase = 'dead'; g.phaseT = 0; }
}

// ---------------------------------------------------------------- Vampiros
function spawn(g: Game) {
  const r = g.rand, roster = rosterOf(g.level), specials = roster.filter(k => SPECIALS.includes(k));
  const speedK = (g.bloodMoon ? 1.25 : 1) * LV.def.speed;
  // Los fuertes: de a uno o dos por vez, cada tanto (el más nuevo del nivel sale un poco más).
  const strong = g.vamps.filter(v => SPECIALS.includes(v.kind)).length, hunt = g.goal.type === 'hunt' ? g.goal.kind : null;
  if (specials.length && strong < (hunt === 'warrior' ? 3 : 2) && r() < (hunt === 'warrior' ? 0.5 : 0.34)) {
    const pick = hunt === 'warrior' && r() < 0.6 ? 'warrior' : r() < 0.4 ? specials[specials.length - 1] : specials[Math.floor(r() * specials.length)];
    const left = r() < 0.5 && g.player.x > 4, x = left ? -0.6 : W + 0.6;
    const speed = ({ giant: 1.7, mage: 2.0, hammer: 2.1, warrior: 2.5, wolf: 4.6 } as Record<string, number>)[pick] * speedK;
    g.vamps.push(makeVamp(g, pick, { x, y: GROUND_Y, onGround: true, surface: left ? groundL() : groundR(), face: left ? 1 : -1, speed, cool: 1 + r() }));
    emit(g, pick === 'wolf' ? { type: 'howl', kind: pick } : { type: 'spawn', kind: pick });
    return;
  }
  // parejo: sale el tipo del que hay menos (muertos + vivos); si están iguales, al azar
  const count = (k: VampKind) => g.kills[k] + g.vamps.filter(v => v.kind === k).length;
  const flyerChance = hunt === 'flyer' ? 0.7 : count('flyer') < count('walker') ? 1 : count('flyer') > count('walker') ? 0 : 0.5; // (en el jardín salen más voladores)
  if (r() < flyerChance) {
    const left = r() < 0.5;
    g.vamps.push(makeVamp(g, 'flyer', { x: left ? -1 : W + 1, y: H - 2 - r() * 3, face: left ? 1 : -1, state: 'hover', speed: (3.2 + r() * 1.2) * speedK, cool: 2 + r() * 2 }));
    return;
  }
  const from = r();
  if (from < 0.28 && GAPS.length) { // sale trepando del vacío
    const [a, b] = GAPS[Math.floor(r() * GAPS.length)], x = (a + b) / 2;
    g.vamps.push(makeVamp(g, 'walker', { x, y: -1.5, vy: 20, vx: (r() < 0.5 ? -1 : 1) * 3.4, face: g.player.x > x ? 1 : -1, speed: (2.3 + r()) * speedK, cool: 1 + r() }));
    emit(g, { type: 'emerge' });
    return;
  }
  const left = from < 0.64 && g.player.x > 4;
  const x = left ? -0.6 : W + 0.6;
  g.vamps.push(makeVamp(g, 'walker', { x, y: GROUND_Y, onGround: true, surface: left ? groundL() : groundR(), face: left ? 1 : -1, speed: (2.3 + r() * 1.1) * speedK, cool: 1 + r() }));
}

// El ataque de cada uno de los que caminan: alcance, cuándo pega, cuánto dura y cuánto espera después.
const ATTACK: Partial<Record<VampKind, { reach: number; at: number; dur: number; rest: number }>> = {
  walker: { reach: 1.0, at: 0.36, dur: 0.7, rest: 0.6 }, giant: { reach: 1.6, at: 0.55, dur: 1.0, rest: 1.0 }, mage: { reach: 1.2, at: 0.36, dur: 0.7, rest: 1.0 },
  hammer: { reach: 2.0, at: 0.72, dur: 1.2, rest: 1.1 }, warrior: { reach: 1.75, at: 0.38, dur: 0.75, rest: 0.8 }, wolf: { reach: 1.5, at: 0.22, dur: 0.5, rest: 0.6 },
  dracula: { reach: 1.8, at: 0.32, dur: 0.65, rest: 0.5 },
};
function shoot(g: Game, x: number, y: number, tx: number, ty: number, speed: number, kind: Shot['kind'], dmg: number, life = 3, spread = 0) {
  const a = Math.atan2(ty - y, tx - x) + spread;
  g.shots.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, t: 0, life, kind, dmg });
}
// Lugar firme donde pararse cerca de x (para cuando Drácula aparece entre la niebla).
function standAt(x: number, preferY: number): [number, Surface] {
  let best: Surface = groundL(), bd = 1e9;
  for (const q of SURFACES) { if (q.mv) continue; const cx = Math.max(q.x1 + 0.6, Math.min(q.x2 - 0.6, x)), d = Math.abs(cx - x) + Math.abs(q.y - preferY) * 0.8; if (d < bd) { bd = d; best = q; } }
  return [Math.max(best.x1 + 0.6, Math.min(best.x2 - 0.6, x)), best];
}

// ---------------------------------------------------------------- Cómo se mueven por el nivel
const maxJumpV = (v: Vamp) => v.kind === 'giant' ? 17.2 : 17.5;
const maxRise = (v: Vamp) => maxJumpV(v) ** 2 / (2 * GRAV) - 0.45; // lo más alto que llega con un salto (≈ 4 m; el gigante un poco menos)
// El piso que tiene abajo un punto (el más alto que no esté por encima).
function surfaceBelow(x: number, y: number): Surface | null {
  let best: Surface | null = null;
  for (const q of SURFACES) if (x >= q.x1 - 0.15 && x <= q.x2 + 0.15 && q.y <= y + 0.1 && (!best || q.y > best.y)) best = q;
  return best;
}
// Los saltos posibles desde un piso: cruzar un hueco, subir a una plataforma o bajar a otra.
function hopsFrom(a: Surface, rise: number): { to: Surface; kind: Hop; lo: number; hi: number }[] {
  const out: { to: Surface; kind: Hop; lo: number; hi: number }[] = [];
  for (const b of SURFACES) {
    if (b === a) continue;
    if (a.ground && b.ground) { // por encima del hueco
      if (b.x1 >= a.x2 - 0.1 && b.x1 - a.x2 <= 4.5) out.push({ to: b, kind: 'gap', lo: a.x2 - 0.2, hi: a.x2 - 0.2 });
      else if (b.x2 <= a.x1 + 0.1 && a.x1 - b.x2 <= 4.5) out.push({ to: b, kind: 'gap', lo: a.x1 + 0.2, hi: a.x1 + 0.2 });
      continue;
    }
    const lo = Math.max(a.x1 + 0.35, b.x1 + 0.35), hi = Math.min(a.x2 - 0.35, b.x2 - 0.35);
    if (lo <= hi) {
      if (b.y > a.y + 0.4 && b.y - a.y <= rise) out.push({ to: b, kind: 'up', lo, hi }); // se salta desde abajo: las plataformas se atraviesan subiendo
      else if (b.y < a.y - 0.4 && !a.ground) out.push({ to: b, kind: 'down', lo, hi }); // se deja caer atravesando la plataforma
      continue;
    }
    // no están una arriba de la otra: salto en diagonal desde el borde, o bajar caminando por el borde
    const right = b.x1 >= a.x2 - 0.35, edge = right ? a.x2 - 0.3 : a.x1 + 0.3, dist = right ? b.x1 - a.x2 : a.x1 - b.x2;
    if (b.y > a.y + 0.4 && b.y - a.y <= rise - 0.4 && dist <= 2.4) out.push({ to: b, kind: 'up', lo: edge, hi: edge });
    else if (b.y < a.y - 0.4 && !a.ground) { const off = right ? a.x2 + 0.6 : a.x1 - 0.6; if (off >= b.x1 + 0.2 && off <= b.x2 - 0.2) out.push({ to: b, kind: 'down', lo: right ? a.x2 + 0.8 : a.x1 - 0.8, hi: right ? a.x2 + 0.8 : a.x1 - 0.8 }); }
  }
  return out;
}
// Busca el camino más corto (en saltos) desde el piso del vampiro hasta el del cazador y devuelve el primer paso.
// Lo recalcula cada tanto (las plataformas que se mueven cambian el camino).
function navigate(g: Game, v: Vamp, rise = maxRise(v)): Nav {
  if (rise === maxRise(v) && v.nav && (!v.onGround ? g.time - v.nav.t < 1.6 : g.time - v.nav.t < 0.35)) return v.nav; // en el aire sigue el plan con el que saltó
  const p = g.player, from = v.onGround && v.surface ? v.surface : surfaceBelow(v.x, v.y);
  const goal = p.onGround && p.surface ? p.surface : surfaceBelow(p.x, p.y);
  let nav: Nav = { t: g.time, kind: 'same', to: null, tx: p.x };
  if (from && goal && from !== goal) {
    const prev = new Map<Surface, { at: Surface; hop: ReturnType<typeof hopsFrom>[number] }>(), queue = [from], seen = new Set([from]);
    while (queue.length) {
      const a = queue.shift()!; if (a === goal) break;
      for (const h of hopsFrom(a, rise)) if (!seen.has(h.to)) { seen.add(h.to); prev.set(h.to, { at: a, hop: h }); queue.push(h.to); }
    }
    if (!prev.has(goal) && rise === maxRise(v)) return navigate(g, v, 7); // no llega saltando normal: salto de vampiro (más alto)
    if (prev.has(goal)) {
      let step = goal; while (prev.get(step)!.at !== from) step = prev.get(step)!.at;
      const h = prev.get(step)!.hop, aim = (v.x + p.x) / 2; // el lugar del salto: lo más cerca del camino hacia el cazador
      nav = { t: g.time, kind: h.kind, to: h.to, tx: Math.max(h.lo, Math.min(h.hi, h.kind === 'gap' ? h.lo : aim)) };
      if (h.kind === 'gap') nav.tx = h.lo + (h.to.x1 >= from.x2 - 0.1 ? 0.6 : -0.6); // camina hasta pasar el borde: ahí salta
    }
  }
  v.nav = nav;
  return nav;
}
const LOW_TRAPS: TrapKind[] = ['spikes', 'roller', 'saw']; // las que se pueden saltar por encima
// ¿Hay una trampa justo adelante que lo va a lastimar en el próximo segundo?
// (simula el camino que va a hacer caminando: así cruza la sierra o el péndulo cuando no lo van a agarrar)
function trapAhead(g: Game, v: Vamp, dir: number, reach = 3.2): Trap | null {
  const [x1, x2, y1, y2] = vampBox(v), sp = Math.max(1.5, v.speed);
  for (let look = 0.08; look <= 1.5; look += 0.12) {
    const ox = dir * Math.min(reach, 0.3 + sp * look);
    for (const t of TRAPS) if (trapHits(t, g.time + look, x1 + ox - 0.15, x2 + ox + 0.15, y1, y2 + 0.2)) return t;
  }
  return null;
}
// ¿El salto (vx, vy) pasa limpio? Simula la parábola hasta que vuelve a tocar el piso.
function jumpSafe(g: Game, v: Vamp, vx: number, vy: number, landY = v.y) {
  const [x1, x2, y1, y2] = vampBox(v);
  let t = 0.04, dx = 0;
  for (; t < 1.6; t += 0.05) {
    dx = vx * t; const dy = vy * t - 0.5 * GRAV * t * t;
    if (vy - GRAV * t < 0 && v.y + dy < landY - 0.05) break; // (bajando) ya llegó al piso
    for (const tr of TRAPS) if (trapHits(tr, g.time + t, x1 + dx - 0.1, x2 + dx + 0.1, y1 + dy, y2 + dy)) return false;
  }
  for (let k = 0; k <= 0.6; k += 0.15) for (const tr of TRAPS) if (trapHits(tr, g.time + t + k, x1 + dx - 0.1, x2 + dx + 0.1, landY, landY + (y2 - y1))) return false; // y donde cae, que no haya nada
  return true;
}
// ¿Y en este lugar (corrido ox), dentro de poco? (look: hasta cuántos segundos mira; dy: si va a estar en el aire)
function trapAt(g: Game, v: Vamp, ox: number, look: number, dy = 0): Trap | null {
  const [x1, x2, y1, y2] = vampBox(v);
  for (const t of TRAPS) for (let k = 0.05; k <= look; k += 0.15) if (trapHits(t, g.time + k, x1 + ox - 0.1, x2 + ox + 0.1, y1 + dy, y2 + dy)) return t;
  return null;
}
// Si hace rato que no se acerca al cazador, prueba otra cosa: un salto grande hacia él; y si sigue trabado, vuelve a entrar.
function unstick(g: Game, v: Vamp, dt: number) {
  const p = g.player, d = Math.hypot(p.x - v.x, (p.y - v.y) * 1.4);
  v.bestD = Math.min((v.bestD ?? d) + dt * 0.8, d); // (si el cazador se aleja, de a poco se le perdona)
  if (d < 2.5 || v.state !== 'walk' || (v.waitT ?? 0) > 0) { v.stuckT = 0; return; }
  v.stuckT = d > v.bestD + 0.05 || Math.abs(v.vx) < 0.3 ? (v.stuckT ?? 0) + dt : Math.max(0, (v.stuckT ?? 0) - dt * 2);
  if (v.stuckT < 2.8 || !v.onGround) return;
  v.stuckT = 0; v.unstuck = (v.unstuck ?? 0) + 1; v.nav = undefined;
  if (v.unstuck < 3) { v.vy = maxJumpV(v); v.vx = (Math.sign(p.x - v.x) || 1) * v.speed * 1.5; v.onGround = false; v.surface = null; v.jumpT = 1; return; }
  // trabado de verdad: sale por el costado y vuelve a entrar por el lado del cazador
  v.unstuck = 0; const left = p.x > W / 2; const q = left ? groundL() : groundR();
  v.x = left ? -0.6 : W + 0.6; v.y = q.y; v.surface = q; v.onGround = true; v.vx = 0; v.vy = 0; v.bestD = undefined;
}

function updateWalker(g: Game, v: Vamp, dt: number) {
  const p = g.player, r = g.rand, atk = ATTACK[v.kind]!, boss = v.kind === 'dracula';
  const dx = p.x - v.x, dy = p.y - v.y;
  const scared = !boss && g.garlicT > 0 && Math.abs(dx) < 4.5 && Math.abs(dy) < 3;
  v.cool -= dt; v.jumpT -= dt; v.dropT -= dt; v.flash = Math.max(0, (v.flash ?? 0) - dt);
  if (v.special !== undefined) v.special -= dt;
  if (v.state === 'mist') { // Drácula se hace niebla de murciélagos y aparece atrás del cazador
    v.t += dt;
    if (v.t >= 0.75 && !v.hit) { v.hit = true; const [x, q] = standAt(p.x - p.face * 2.4, p.y); v.x = x; v.y = q.y; v.surface = q; v.onGround = true; v.vx = 0; v.vy = 0; v.face = p.x > v.x ? 1 : -1; }
    if (v.t >= 1.15) { v.state = 'claw'; v.t = 0; v.hit = false; emit(g, { type: 'hiss', x: v.x }); }
    return;
  }
  if (v.state === 'claw') {
    v.vx *= Math.max(0, 1 - dt * 12);
    v.t += dt;
    if (v.t >= atk.at && !v.hit) {
      v.hit = true;
      const front = Math.sign(dx) === v.face || Math.abs(dx) < 0.6, h = BODY[v.kind].h;
      if (v.kind === 'hammer') { g.shake = Math.max(g.shake, 0.6); emit(g, { type: 'slam' }); for (let i = 0; i < 14; i++) { const a = Math.PI * (0.15 + g.rand() * 0.7); g.sparks.push({ x: v.x + v.face * 1.6, y: v.y + 0.1, vx: Math.cos(a) * 6 * (g.rand() < 0.5 ? -1 : 1), vy: Math.sin(a) * 7, t: 0, life: 0.4 + g.rand() * 0.3, hue: 30 }); } }
      if (front && Math.abs(dx) < atk.reach + 0.25 && dy > -1.4 && dy < h) hurt(g, v.x, DAMAGE[v.kind]);
    }
    if (v.t >= atk.dur) { v.state = 'walk'; v.cool = atk.rest + r() * 0.5; }
  } else if (v.state === 'cast') { // el mago levanta el báculo y tira una bola de fuego; Drácula larga murciélagos
    v.vx *= Math.max(0, 1 - dt * 10); v.t += dt; v.face = dx >= 0 ? 1 : -1;
    if (v.t >= 0.55 && !v.hit) {
      v.hit = true;
      if (v.kind === 'mage') { shoot(g, v.x + v.face * 0.9, v.y + 2.2, p.x, p.y + 1, 8.5, 'orb', DAMAGE.mage, 3); }
      else { for (const k of [-0.35, 0, 0.35]) shoot(g, v.x + v.face * 0.6, v.y + 1.9, p.x, p.y + 1, 6.5, 'bat', DAMAGE.dracula, 3.2, k); emit(g, { type: 'bats' }); }
    }
    if (v.t >= 0.95) { v.state = 'walk'; v.cool = (v.kind === 'mage' ? 2.4 : 1) + r() * 0.8; }
  } else if (v.state === 'leap') { // el hombre lobo salta encima del cazador
    v.t += dt;
    const [x1, x2, y1, y2] = vampBox(v);
    if (!v.hit && x2 > p.x - 0.3 && x1 < p.x + 0.3 && y1 < p.y + PLAYER_H && y2 > p.y) { v.hit = true; hurt(g, v.x, DAMAGE.wolf); }
    if (v.onGround && v.t > 0.2) { v.state = 'walk'; v.cool = 0.5 + r() * 0.4; v.vx *= 0.3; }
  } else {
    // Hacia dónde ir: si el cazador está en otro piso, el plan dice a qué plataforma saltar (o bajar) y desde dónde.
    const nav = navigate(g, v);
    let dir = nav.kind === 'same' ? (Math.sign(dx) || v.face) : (Math.sign(nav.tx - v.x) || v.face);
    if (scared) dir = -Math.sign(dx) || 1; // el ajo: se escapa
    // el mago se queda lejos (a 5 o 6 metros) para tirar sus bolas de fuego
    let want = 1;
    if (v.kind === 'mage' && !scared && nav.kind === 'same') { const d = Math.abs(dx); want = d < 4.2 ? -1 : d < 6.5 ? 0 : 1; }
    if (nav.kind !== 'same' && !scared && Math.abs(nav.tx - v.x) < 0.3) want = 0; // llegó al lugar del salto
    v.face = (nav.kind === 'same' || scared ? (scared ? dir : Math.sign(dx) || v.face) : dir) as 1 | -1;
    let target = dir * v.speed * (scared ? 1.3 : 1) * want;
    if (v.onGround) {
      // Las trampas: mira un poco adelante; si va a lastimarlo, las salta (las bajas) o espera a que pasen.
      v.braveT = Math.max(0, (v.braveT ?? 0) - dt);
      const tdir = Math.sign(target) || v.face;
      const here = !v.braveT ? trapAt(g, v, 0, 0.7) : null, danger = target !== 0 && !v.braveT ? trapAhead(g, v, tdir) : null;
      // un salto que no choque con ninguna trampa en todo el recorrido (adelante, en el lugar o para atrás)
      let safeJump: [number, number] | undefined;
      if ((here || danger) && v.jumpT <= 0 && LOW_TRAPS.includes((here ?? danger)!.kind))
        for (const jy of [13.5, 16.5]) { const jx = [tdir * Math.max(5, v.speed * 1.6), tdir * 2.5, 0, -tdir * 3.5, -tdir * 6].find(x => jumpSafe(g, v, x, jy)); if (jx !== undefined) { safeJump = [jx, jy]; break; } }
      if (safeJump) { v.vx = safeJump[0]; v.vy = safeJump[1]; v.onGround = false; v.surface = null; v.jumpT = 0.9; v.waitT = 0; } // salta por encima
      else if (here && !danger && target !== 0) target = tdir * v.speed * 1.6; // está debajo de una trampa: sale corriendo hacia adelante
      else if (here) target = -tdir * v.speed * 1.4; // adelante y acá es peligroso: retrocede rápido
      else if (danger) {
        v.waitT = (v.waitT ?? 0) + dt; target = -tdir * 0.8; // se para y retrocede un poquito hasta que pase
        if (v.waitT > 3.5) { v.braveT = 1.2; v.waitT = 0; } // no espera para siempre
      } else v.waitT = 0;
      if (v.onGround) {
        v.vx += (target - v.vx) * Math.min(1, dt * 8);
        v.walkT += dt * Math.abs(v.vx);
        const s = v.surface, mdir = Math.sign(v.vx) || dir, ahead = v.x + mdir * 0.7;
        // ¿Se termina el piso adelante? Si el plan es cruzar el hueco, salta; si no, espera en el borde (nunca se cae al vacío).
        if (s && s.ground && (ahead < s.x1 || ahead > s.x2) && ahead > 0.2 && ahead < W - 0.2) {
          const across = nav.kind === 'gap' && nav.to && (mdir > 0 ? nav.to.x1 >= s.x2 - 0.1 : nav.to.x2 <= s.x1 + 0.1);
          const gw = across ? (mdir > 0 ? nav.to!.x1 - s.x2 : s.x1 - nav.to!.x2) : 0, jvx = mdir * Math.max(4.8, v.speed * 1.7, gw * 1.6 + 1);
          if (across && v.jumpT <= 0 && (v.braveT || jumpSafe(g, v, jvx, 14.5, nav.to!.y))) { v.vy = 14.5; v.vx = jvx; v.onGround = false; v.surface = null; v.jumpT = 1; v.waitT = 0; }
          else { v.vx = 0; if (across) { v.waitT = (v.waitT ?? 0) + dt; if (v.waitT > 3.5) { v.braveT = 1.2; v.waitT = 0; } } } // espera a que pase la trampa del otro lado
        }
        // Llegó al lugar: salta a la plataforma de arriba o se deja caer a la de abajo.
        if (v.onGround && nav.to && Math.abs(nav.tx - v.x) < 0.45 && v.jumpT <= 0) {
          if (nav.kind === 'up') {
            const rise = nav.to.y - v.y, land = Math.max(nav.to.x1 + 0.6, Math.min(nav.to.x2 - 0.6, v.x)), far = Math.abs(land - v.x);
            const jvy = Math.min(rise > maxRise(v) ? 24 : maxJumpV(v), Math.sqrt(2 * GRAV * (rise + 0.8) + (far > 0.3 ? 30 : 0))), jvx = Math.sign(land - v.x) * Math.min(6.5, far * 2.2 + 0.5);
            if (v.braveT || jumpSafe(g, v, jvx, jvy, nav.to.y)) { v.vy = jvy; v.vx = jvx; v.onGround = false; v.surface = null; v.jumpT = 0.8; v.waitT = 0; }
            else { v.vx = 0; v.waitT = (v.waitT ?? 0) + dt; if (v.waitT > 3.5) { v.braveT = 1.2; v.waitT = 0; } } // arriba hay una trampa: espera
          }
          else if (nav.kind === 'down' && s && !s.ground) {
            if (v.braveT || jumpSafe(g, v, 0, -1, nav.to.y)) { v.dropT = 0.3; v.onGround = false; v.surface = null; v.vy = -1; v.waitT = 0; }
            else { v.vx = 0; v.waitT = (v.waitT ?? 0) + dt; if (v.waitT > 3.5) { v.braveT = 1.2; v.waitT = 0; } }
          }
        }
      }
      if (!scared && v.onGround) {
        if (Math.abs(dx) < atk.reach && Math.abs(dy) < 1.3 && v.cool <= 0) { v.state = 'claw'; v.t = 0; v.hit = false; v.vx = 0; emit(g, { type: 'hiss', x: v.x }); }
        else if (v.kind === 'mage' && v.cool <= 0 && Math.abs(dx) < 11 && Math.abs(dy) < 4) { v.state = 'cast'; v.t = 0; v.hit = false; emit(g, { type: 'cast' }); }
        else if (v.kind === 'wolf' && v.cool <= 0 && Math.abs(dx) > 2.2 && Math.abs(dx) < 5.5 && Math.abs(dy) < 2.5 && !trapAhead(g, v, Math.sign(dx), 1.8) && r() < dt * 3) { v.state = 'leap'; v.t = 0; v.hit = false; v.vy = 11.5; v.vx = Math.sign(dx) * Math.min(9.5, Math.abs(dx) * 2.2); v.onGround = false; v.surface = null; emit(g, { type: 'hiss', x: v.x }); }
        else if (boss && (v.special ?? 0) <= 0 && Math.abs(dx) > 2.5) { // Drácula: niebla de murciélagos o murciélagos que vuelan
          v.special = 4.5 + r() * 2; v.t = 0; v.hit = false;
          if (r() < 0.5) { v.state = 'mist'; emit(g, { type: 'mist' }); } else { v.state = 'cast'; emit(g, { type: 'cast' }); }
        }
      }
    } else {
      // en el aire: si saltó a una plataforma, se acomoda encima; si no, sigue hacia el cazador
      const to = nav.to, airTx = to && (nav.kind === 'up' || nav.kind === 'gap') ? Math.max(to.x1 + 0.5, Math.min(to.x2 - 0.5, v.x + v.vx * 0.3)) : null;
      const airTarget = airTx !== null ? Math.sign(airTx - v.x) * Math.min(v.speed * 1.4, Math.abs(airTx - v.x) * 4) : target;
      v.vx += (airTarget - v.vx) * Math.min(1, dt * (airTx !== null ? 3 : 1.5));
    }
    unstick(g, v, dt);
  }
  const was = v.onGround;
  moveBody(v, dt, VAMP_W / 2, -1.2, W + 1.2);
  if (!was && v.onGround) v.walkT = 0;
  // Si cae en un hueco, salta y sale (saltan bien: nunca se caen al vacío).
  if (v.y < GROUND_Y - 0.9 && v.vy < 0) {
    // sale del lado del hueco que queda para el cazador
    const gap = GAPS.find(([a, b]) => v.x > a - 0.5 && v.x < b + 0.5), toward = gap ? (g.player.x < (gap[0] + gap[1]) / 2 ? -1 : 1) : Math.sign(g.player.x - v.x) || 1;
    v.vy = 20; v.vx = toward * (gap ? Math.max(3.6, (gap[1] - gap[0]) / 2 + 1.5) : 3.6); v.onGround = false; v.surface = null; v.jumpT = 1;
    if (v.state === 'leap') v.state = 'walk';
    if (v.y < -2.5) v.y = -1.5;
    emit(g, { type: 'emerge' });
  }
}

function updateFlyer(g: Game, v: Vamp, dt: number) {
  const p = g.player, r = g.rand;
  v.t += dt; v.cool -= dt; v.walkT += dt; v.flash = Math.max(0, (v.flash ?? 0) - dt);
  const scared = g.garlicT > 0 && Math.hypot(p.x - v.x, p.y - v.y) < 5;
  if (v.state === 'hover' || scared) {
    const side = v.x < p.x ? -1 : 1;
    const tx = scared ? v.x + side * 4 : p.x + side * 3.2, ty = Math.min(H - 1.6, p.y + 4.2 + Math.sin(v.t * 1.7) * 0.8);
    v.vx += ((tx - v.x) * 1.6 - v.vx) * Math.min(1, dt * 2.5);
    v.vy += ((ty - v.y) * 1.6 - v.vy) * Math.min(1, dt * 2.5);
    const sp = Math.hypot(v.vx, v.vy); if (sp > v.speed) { v.vx *= v.speed / sp; v.vy *= v.speed / sp; }
    v.face = (p.x > v.x ? 1 : -1);
    if (!scared && v.state === 'hover' && v.cool <= 0 && Math.abs(p.x - v.x) < 7.5) {
      const ax = p.x - v.x, ay = p.y + 0.9 - v.y, L = Math.hypot(ax, ay) || 1, sp2 = 10.5 * (g.bloodMoon ? 1.15 : 1);
      v.state = 'dive'; v.t = 0; v.vx = ax / L * sp2; v.vy = ay / L * sp2; v.hit = false; emit(g, { type: 'dive' });
    }
  } else if (v.state === 'dive') {
    if (!v.hit && Math.abs(p.x - v.x) < 0.95 && p.y + 0.2 < v.y + 0.6 && p.y + PLAYER_H > v.y - 0.3) { v.hit = true; hurt(g, v.x, DAMAGE.flyer); }
    if (v.t > 1.1 || v.y < GROUND_Y + 0.4) { v.state = 'rise'; v.t = 0; }
  } else { // rise
    v.vy += (6 - v.vy) * Math.min(1, dt * 4); v.vx *= Math.max(0, 1 - dt * 2);
    if (v.t > 0.9) { v.state = 'hover'; v.cool = 2.2 + r() * 2.2; }
  }
  v.x += v.vx * dt; v.y += v.vy * dt;
  v.y = Math.max(GROUND_Y + 0.3, Math.min(H + 1, v.y));
  if (v.state === 'hover') v.x = Math.max(-1.5, Math.min(W + 1.5, v.x));
}

// El dragón: vuela a un costado del cazador, escupe fuego, se tira en picada y a veces baja a pisotear.
// (Su posición y es el centro del cuerpo; las patas tocan el piso cuando y = piso + 1.25.)
export const DRAGON_FEET = 1.75;
function updateDragon(g: Game, v: Vamp, dt: number) {
  const p = g.player, r = g.rand;
  v.t += dt; v.cool -= dt; v.walkT += dt; v.flash = Math.max(0, (v.flash ?? 0) - dt);
  const dx = p.x - v.x, [x1, x2, y1, y2] = vampBox(v);
  const touching = x2 > p.x - 0.3 && x1 < p.x + 0.3 && y1 < p.y + PLAYER_H && y2 > p.y;
  if (v.state === 'hover') {
    const side = v.x < p.x ? -1 : 1, tx = Math.max(3, Math.min(W - 3, p.x + side * 6)), ty = Math.min(H - 3.5, Math.max(GROUND_Y + 3.6, p.y + 3.6)) + Math.sin(v.t * 2) * 0.4;
    v.vx += ((tx - v.x) * 1.4 - v.vx) * Math.min(1, dt * 2); v.vy += ((ty - v.y) * 1.6 - v.vy) * Math.min(1, dt * 2.5);
    v.face = dx >= 0 ? 1 : -1;
    if (v.cool <= 0) {
      const roll = r(); v.t = 0; v.hit = false;
      if (roll < 0.5) { v.state = 'breath'; emit(g, { type: 'breath' }); }
      else if (roll < 0.75) { v.state = 'dive'; const ax = p.x - v.x, ay = p.y + 1 - v.y, L = Math.hypot(ax, ay) || 1; v.vx = ax / L * 12; v.vy = ay / L * 12; emit(g, { type: 'dive' }); }
      else { v.state = 'land'; }
    }
  } else if (v.state === 'breath') { // fuego por la boca hacia el cazador
    v.vx *= Math.max(0, 1 - dt * 3); v.vy *= Math.max(0, 1 - dt * 3); v.face = dx >= 0 ? 1 : -1;
    if (v.t > 0.35 && v.t < 1.9 && Math.floor(v.t / 0.05) !== Math.floor((v.t - dt) / 0.05)) shoot(g, v.x + v.face * 2.7, v.y + 2.1, p.x, p.y + 0.9, 11, 'flame', DAMAGE.dragon, 1.1, (r() - 0.5) * 0.25);
    if (v.t > 2.2) { v.state = 'hover'; v.cool = 1.6 + r(); }
  } else if (v.state === 'dive') { // picada
    if (!v.hit && touching) { v.hit = true; hurt(g, v.x, DAMAGE.dragon); }
    if (v.t > 1.0 || v.y < GROUND_Y + DRAGON_FEET + 0.1) { v.state = 'rise'; v.t = 0; }
  } else if (v.state === 'rise') {
    v.vy += (5 - v.vy) * Math.min(1, dt * 3); v.vx *= Math.max(0, 1 - dt * 2);
    if (v.t > 1) { v.state = 'hover'; v.cool = 1.4 + r() * 1.2; }
  } else if (v.state === 'land') { // baja al piso y pisotea dos veces (ahí es cuando más fácil se le pega)
    const [lx, q] = standAt(v.x, GROUND_Y), gy = q.y + DRAGON_FEET;
    v.vx += ((lx - v.x) * 2 - v.vx) * Math.min(1, dt * 3);
    if (v.y > gy + 0.05) v.vy = Math.max(-9, (gy - v.y) * 4); else { v.y = gy; v.vy = 0; }
    v.face = dx >= 0 ? 1 : -1;
    const stomp = (k: number) => v.t >= k && v.t - dt < k;
    if (stomp(1.2) || stomp(2.2)) { g.shake = Math.max(g.shake, 0.8); emit(g, { type: 'slam' }); if (Math.abs(dx) < 3.6 && p.y < gy + 0.5) hurt(g, v.x, DAMAGE.dragon); }
    if (v.t > 3.2) { v.state = 'rise'; v.t = 0; }
  }
  if (v.state !== 'dive' && v.state !== 'land' && !v.hit && touching && v.state !== 'breath') { /* rozarlo volando no lastima */ }
  v.x += v.vx * dt; v.y += v.vy * dt;
  v.x = Math.max(2.4, Math.min(W - 2.4, v.x)); v.y = Math.max(GROUND_Y + DRAGON_FEET - 0.05, Math.min(H - 2, v.y));
}

// Lo que tiran los vampiros: vuela, y si toca al cazador le saca vida.
function updateShots(g: Game, dt: number) {
  const p = g.player;
  for (const s of [...g.shots]) {
    s.t += dt;
    if (s.kind === 'bat') { const a = Math.atan2(p.y + 1 - s.y, p.x - s.x), sp = Math.hypot(s.vx, s.vy); s.vx += (Math.cos(a) * sp - s.vx) * Math.min(1, dt * 1.2); s.vy += (Math.sin(a) * sp - s.vy) * Math.min(1, dt * 1.2); } // los murciélagos lo persiguen un poco
    if (s.kind === 'flame') { s.vy += 2 * dt; }
    s.x += s.vx * dt; s.y += s.vy * dt;
    const r = s.kind === 'flame' ? 0.25 + s.t * 0.4 : 0.35;
    if (Math.abs(s.x - p.x) < 0.35 + r && s.y > p.y - r && s.y < p.y + PLAYER_H + r) { hurt(g, s.x, s.dmg); if (s.kind !== 'flame') { g.shots.splice(g.shots.indexOf(s), 1); continue; } }
    if (s.t > s.life || s.x < -2 || s.x > W + 2 || s.y < -2 || (s.kind !== 'bat' && s.y < GROUND_Y - 0.2 && !inGap(s.x))) g.shots.splice(g.shots.indexOf(s), 1);
  }
}

// ---------------------------------------------------------------- La meta del nivel
// Cuánto lleva de la meta (vampiros, estrellas, jaulas, segundos...).
export function goalProgress(g: Game) {
  switch (g.goal.type) {
    case 'kill': return g.total;
    case 'hunt': return g.kills[g.goal.kind];
    case 'survive': return Math.floor(g.time);
    case 'boss': return g.bossDeadT >= 0 ? 1 : 0;
    default: return g.progress;
  }
}
// Pone las jaulas o los ataúdes repartidos por el nivel, lejos de las trampas, de los huecos y de la puerta.
function placeBreakables(g: Game, n: number, kind: Breakable['kind']) {
  const spots: [number, number][] = [];
  for (const s of SURFACES) { if (s.mv) continue; for (let x = s.x1 + 0.9; x <= s.x2 - 0.9; x += 1.6) spots.push([x, s.y]); }
  const ok = (x: number, y: number) => x > START_X + 2 && x < DOOR.x1 - 1.2 && !TRAPS.some(t => Math.abs(t.y - y) < 2.5 && x > Math.min(t.x, t.x2) - 1.6 && x < Math.max(t.x, t.x2) + 1.6);
  const free = spots.filter(([x, y]) => ok(x, y));
  const pool = free.length >= n ? free : spots.filter(([x]) => x > START_X + 2 && x < DOOR.x1 - 1.2);
  for (let i = 0; i < n && pool.length; i++) {
    const k = Math.floor((i + 0.5) / n * pool.length + (g.rand() - 0.5) * 2), [x, y] = pool.splice(Math.max(0, Math.min(pool.length - 1, k)), 1)[0];
    for (let j = pool.length - 1; j >= 0; j--) if (Math.abs(pool[j][0] - x) < 2.2 && pool[j][1] === y) pool.splice(j, 1); // no dos pegadas
    g.objects.push({ id: g.nextId++, kind, x, y, hp: BREAK_HP[kind], maxHp: BREAK_HP[kind], flash: 0, t: 0 });
  }
}
// Un golpe a una jaula o un ataúd; si se rompe, suma a la meta (la jaula libera al prisionero, del ataúd sale un vampiro).
export function hitObject(g: Game, o: Breakable, dmg: number) {
  if (!g.objects.includes(o)) return;
  o.hp -= dmg; o.flash = 0.18;
  for (let i = 0; i < 8; i++) { const a = g.rand() * Math.PI, sp = 2 + g.rand() * 5; g.sparks.push({ x: o.x, y: o.y + 1, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: 0.35, hue: o.kind === 'cage' ? 40 : 25 }); }
  if (o.hp > 0) { emit(g, { type: 'objHit' }); return; }
  g.objects.splice(g.objects.indexOf(o), 1); g.progress++; g.shake = Math.max(g.shake, 0.4);
  const of = g.goal.type === 'break' ? g.goal.n : 0;
  if (o.kind === 'cage') pop(g, o.x, o.y + 2.4, '¡Libre!', false);
  else { // del ataúd sale un vampiro antiguo
    for (let i = 0; i < 6; i++) g.bones.push({ kind: (['skull', 'ribs', 'arm', 'leg', 'spine', 'jaw'] as BoneKind[])[i], x: o.x, y: o.y + 1, vx: (g.rand() - 0.5) * 10, vy: 6 + g.rand() * 6, a: 0, va: (g.rand() - 0.5) * 20, t: 0, rest: false });
    const q = surfaceBelow(o.x, o.y + 0.1);
    g.vamps.push(makeVamp(g, 'walker', { x: o.x, y: o.y + 0.2, vy: 9, face: g.player.x > o.x ? 1 : -1, speed: 2.6 * LV.def.speed, cool: 1.2, surface: q, onGround: false }));
    emit(g, { type: 'emerge' });
  }
  g.fx.push({ kind: 'burst', x: o.x, y: o.y + 1, t: 0, life: 0.4, r: 1.3, face: 1, seed: g.rand() });
  emit(g, { type: 'break', kind: o.kind, n: g.progress, of });
}
function updateGoal(g: Game, dt: number) {
  const p = g.player, goal = g.goal;
  for (const o of g.objects) { o.t += dt; o.flash = Math.max(0, o.flash - dt); }
  // lo que cae del cielo para juntar
  if (goal.type === 'collect' && !g.door.open) {
    g.itemT -= dt;
    if (g.itemT <= 0 && g.items.length < 3) {
      const spots = SURFACES.filter(s => s.x2 - s.x1 > 1.6 && !s.mv), s = spots[Math.floor(g.rand() * spots.length)];
      g.items.push({ id: g.nextId++, kind: goal.item, x: Math.min(DOOR.x1 - 1, Math.max(1, s.x1 + 0.6 + g.rand() * (s.x2 - s.x1 - 1.2))), y: H + 1, vy: goal.item === 'soul' ? -1.6 : -2.6, landed: false, t: 0 });
      g.itemT = 2 + g.rand() * 1.4;
    }
  }
  for (const it of [...g.items]) {
    it.t += dt;
    if (!it.landed) { const prev = it.y; it.y += it.vy * dt; const q = surfaceUnder(it.x, 0.3, prev, it.y, false); if (q) { it.y = q.y; it.landed = true; it.t = 0; } if (it.y < -2) { g.items.splice(g.items.indexOf(it), 1); continue; } }
    if (Math.abs(p.x - it.x) < 0.8 && it.y + 0.5 > p.y - 0.3 && it.y < p.y + PLAYER_H + 0.3) {
      g.items.splice(g.items.indexOf(it), 1); g.progress++;
      for (let i = 0; i < 14; i++) { const a = g.rand() * Math.PI * 2, sp = 2 + g.rand() * 5; g.sparks.push({ x: it.x, y: it.y + 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 2, t: 0, life: 0.5, hue: it.kind === 'star' ? 50 : 200 }); }
      emit(g, { type: 'collect', kind: it.kind, n: g.progress, of: goal.type === 'collect' ? goal.n : 0 });
      continue;
    }
    if (it.landed && it.t > 14) g.items.splice(g.items.indexOf(it), 1);
  }
  // ¿Cumplió la meta? Se abre la puerta al siguiente nivel.
  if (!g.door.open && goal.type !== 'boss' && goalProgress(g) >= goal.n) {
    g.door.open = true; g.items = []; emit(g, { type: 'door' });
    if (goal.type === 'survive') g.flash = Math.max(g.flash, 0.5);
  }
}

// ---------------------------------------------------------------- Cajas del cielo
function dropCrate(g: Game) {
  // solo caen cajas de las armas que ya aparecieron (el ajo siempre: espanta a los vampiros)
  const r = g.rand, pool = ([['bolts', 0.36, 'crossbow'], ['heart', 0.2, 'sword'], ['garlic', 0.16, 'sword'], ['fire', 0.14, 'firesword'], ['bullets', 0.14, 'pistol']] as const).filter(([, , w]) => weaponUnlocked(g, w));
  let roll = r() * pool.reduce((a, [, k]) => a + k, 0), kind: CrateKind = 'heart';
  for (const [k, wgt] of pool) { if (roll < wgt) { kind = k; break; } roll -= wgt; }
  const spots = SURFACES.filter(s => s.x2 - s.x1 > 2 && !s.mv);
  const s = spots[Math.floor(r() * spots.length)];
  const x = s.x1 + 0.8 + r() * (s.x2 - s.x1 - 1.6);
  g.crates.push({ id: g.nextId++, kind, x: Math.min(W - 2, x), y: H + 1.5, vy: -2.6, landed: false, t: 0, surface: null });
}
function updateCrates(g: Game, dt: number) {
  const p = g.player;
  for (const c of [...g.crates]) {
    c.t += dt;
    if (!c.landed) {
      const prev = c.y; c.y += c.vy * dt;
      const s = surfaceUnder(c.x, 0.8, prev, c.y, false);
      if (s) { c.y = s.y; c.landed = true; c.surface = s; c.t = 0; emit(g, { type: 'crate' }); }
      if (c.y < -3) { g.crates.splice(g.crates.indexOf(c), 1); continue; }
    }
    if (Math.abs(p.x - c.x) < 0.95 && p.y < c.y + 1 && p.y + PLAYER_H > c.y) {
      g.crates.splice(g.crates.indexOf(c), 1); g.stats.crates++;
      const give = (w: Weapon) => { const before = g.ammo[w]; g.ammo[w] = Math.min(MAX_AMMO[w], g.ammo[w] + AMMO_PICKUP[w]); emit(g, { type: 'pickup', kind: c.kind, amount: g.ammo[w] - before }); };
      if (c.kind === 'bolts') give('crossbow');
      else if (c.kind === 'fire') give('firesword');
      else if (c.kind === 'bullets') give('pistol');
      else if (c.kind === 'garlic') { g.garlicT = 8; if (weaponUnlocked(g, 'garlic')) give('garlic'); else emit(g, { type: 'pickup', kind: 'garlic', amount: 0 }); } // ajo: espanta a los vampiros 8 segundos y trae 2 bombas
      else if (c.kind === 'heart') { const before = p.hp; p.hp = Math.min(MAX_HP, p.hp + HEART_HP); emit(g, { type: 'pickup', kind: 'heart', amount: p.hp - before }); }
      continue;
    }
    if (c.landed && c.t > 16) g.crates.splice(g.crates.indexOf(c), 1);
  }
}

// ---------------------------------------------------------------- Restos: esqueleto, chispas y huesos
const BONES: BoneKind[] = ['skull', 'jaw', 'ribs', 'spine', 'pelvis', 'arm', 'arm', 'arm', 'arm', 'leg', 'leg', 'leg', 'leg', 'spine'];
function updateRemains(g: Game, dt: number) {
  const r = g.rand;
  for (const c of [...g.corpses]) {
    c.t += dt;
    if (c.kind === 'dracula') continue; // (se está transformando)
    const fly = c.kind === 'flyer' ? -0.6 : c.kind === 'dragon' ? -1.2 : 0, big = Math.max(1, Math.round(BODY[c.kind].k * (c.kind === 'dragon' ? 3 : 1)));
    if (r() < dt * (c.t > BURN_AT ? 90 : 40)) g.sparks.push({ x: c.x + (r() - 0.5) * 0.9, y: c.y + fly + 0.3 + r() * 1.6, vx: (r() - 0.5) * 3, vy: 1 + r() * 4, t: 0, life: 0.4 + r() * 0.4, hue: 20 + r() * 35 });
    if (c.t >= BURN_AT && c.t - dt < BURN_AT) emit(g, { type: 'burn' }); // se prende fuego
    if (c.t >= BLOW_AT) {
      g.corpses.splice(g.corpses.indexOf(c), 1);
      const hs: Record<BoneKind, number> = { skull: 1.55, jaw: 1.35, ribs: 1.05, spine: 0.9, pelvis: 0.7, arm: 1.1, leg: 0.4 };
      for (let n = 0; n < big; n++) for (const k of BONES) {
        const a = (r() - 0.5) * 3.4 + Math.PI / 2, sp = 11 + r() * 13;
        g.bones.push({ kind: k, x: c.x + (r() - 0.5) * 0.4, y: c.y + fly + hs[k], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 3, a: r() * 6, va: (r() - 0.5) * 30, t: 0, rest: false });
      }
      for (let i = 0; i < 110 * big; i++) { const a = r() * Math.PI * 1.15 - 0.08, sp = 2 + r() * 15; g.drops.push({ x: c.x + (r() - 0.5) * 0.6, y: c.y + fly + 0.5 + r() * 1.4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 0.05 + r() * 0.14, t: 0, stuck: false }); } // mucha sangre
      g.shake = Math.max(g.shake, 0.55); g.flash = Math.max(g.flash, 0.25);
      for (let i = 0; i < 26; i++) { const a = r() * Math.PI * 2, sp = 3 + r() * 9; g.sparks.push({ x: c.x, y: c.y + 1, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 2, t: 0, life: 0.5 + r() * 0.6, hue: r() < 0.3 ? 0 : 35 + r() * 25 }); }
      emit(g, { type: 'bones', x: c.x, y: c.y });
    }
  }
  for (const b of [...g.bones]) {
    b.t += dt;
    if (!b.rest) {
      b.vy -= GRAV * 0.8 * dt; const prev = b.y; b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.va * dt;
      if (b.vy < 0) { const s = surfaceUnder(b.x, 0.2, prev, b.y, false); if (s) { b.y = s.y + 0.06; if (Math.abs(b.vy) > 4) { b.vy = -b.vy * 0.35; b.vx *= 0.6; b.va *= 0.5; } else { b.vy = 0; b.vx = 0; b.va = 0; b.rest = true; } } }
    }
    if (b.t > 3.4 || b.y < -6) g.bones.splice(g.bones.indexOf(b), 1);
  }
  for (const s of [...g.sparks]) { s.t += dt; s.vy -= 9 * dt; s.x += s.vx * dt; s.y += s.vy * dt; if (s.t > s.life) g.sparks.splice(g.sparks.indexOf(s), 1); }
  if (g.sparks.length > 400) g.sparks.splice(0, g.sparks.length - 400);
  for (const d of [...g.drops]) {
    d.t += dt;
    if (!d.stuck) { d.vy -= GRAV * 0.7 * dt; const prev = d.y; d.x += d.vx * dt; d.y += d.vy * dt; if (d.vy < 0) { const s = surfaceUnder(d.x, 0.05, prev, d.y, false); if (s) { d.y = s.y; d.stuck = true; d.t = 0; d.r *= 1.8; } } }
    if ((d.stuck && d.t > 9) || d.y < -6) g.drops.splice(g.drops.indexOf(d), 1);
  }
  if (g.drops.length > 900) g.drops.splice(0, g.drops.length - 900);
}

// ---------------------------------------------------------------- Un paso del juego
export function aliveCap(g: Game) { return g.door.open ? 2 : Math.min(8, 3 + Math.floor(g.total / 8)); }

// La tormenta: cada tanto cae un rayo (un fogonazo que ilumina todo) y después suena el trueno.
function updateStorm(g: Game, dt: number) {
  const st = g.storm; if (!st) return;
  st.t += dt; st.next -= dt;
  if (st.next > 0) return;
  st.t = 0; st.x = 2 + g.rand() * (W - 4); st.near = 0.25 + g.rand() * 0.75; st.seed = g.rand();
  st.next = 4 + g.rand() * 8 * (g.rand() < 0.2 ? 0.15 : 1); // a veces dos rayos seguidos
  emit(g, { type: 'thunder', near: st.near });
}

export function step(g: Game, input: Input, dt: number) {
  g.real += dt;
  if (g.phase === 'menu') { g.menu.t += dt; g.holdT = input.attack ? -1 : 0; return; } // el cartel de armas pone el juego en pausa
  // Espacio mantenido: se llena la barra y a los 3 segundos aparece el cartel de las armas
  if (input.attack && g.phase === 'play') { if (g.holdT >= 0) { g.holdT += dt; if (g.holdT >= HOLD_MENU) { g.holdT = -1; openMenu(g); return; } } }
  else if (!input.attack) g.holdT = 0;
  g.time += dt; g.phaseT += dt;
  updateSurfaces(g.time);
  g.flash = Math.max(0, g.flash - dt * 1.8); g.shake = Math.max(0, g.shake - dt * 2);
  g.holyT = Math.max(0, g.holyT - dt); g.garlicT = Math.max(0, g.garlicT - dt); g.combo.t = Math.max(0, g.combo.t - dt);
  if (g.door.open) g.door.t += dt;
  if (g.storm) updateStorm(g, dt);
  const p = g.player;
  if (g.phase === 'dead') { if (g.phaseT > 1.6) { g.phase = 'over'; emit(g, { type: 'over' }); } updateRemains(g, dt); return; }
  if (g.phase === 'over' || g.phase === 'won') return;
  if (g.phase === 'cleared') { updateRemains(g, dt); p.x += dt * 2; p.walkT += dt * 2; if (g.phaseT > 2.4) { g.phase = 'won'; emit(g, { type: 'won' }); } return; }

  // El cazador
  p.inv = Math.max(0, p.inv - dt); p.cool = Math.max(0, p.cool - dt); p.dropT -= dt; p.coyote -= dt; p.hurtT = Math.max(0, p.hurtT - dt); p.landT = Math.max(0, p.landT - dt); p.spinT = Math.max(0, p.spinT - dt);
  if (p.attackT >= 0) { p.attackT += dt; if (p.attackT > 0.3) p.attackT = -1; }
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  // las flechas tocadas (para los ataques especiales): cada toque nuevo, con hacia dónde miraba antes
  for (const [on, prev, d] of [[input.right, p.prevR, 1], [input.left, p.prevL, -1]] as const) if (on && !prev) { g.taps.push({ d: d as 1 | -1, t: g.real, f: p.face }); if (g.taps.length > 3) g.taps.shift(); }
  p.prevR = input.right; p.prevL = input.left;
  if (dir && !p.special) p.face = dir as 1 | -1;
  const slow = p.attackT >= 0 && p.onGround && p.attackWeapon === 'sword' ? 0.45 : 1;
  const ctrl = p.hurtT > 0 || p.special?.kind === 'dash' ? 0 : p.onGround ? 14 : 6;
  p.vx += (dir * SPEED * slow * (p.special?.kind === 'whirl' ? 0.3 : 1) - p.vx) * Math.min(1, dt * ctrl);
  const aiming = !!input.attack && AIMED.includes(g.weapon); // con Espacio apretado las flechas apuntan (no saltan ni bajan)
  const prevAim = p.aim;
  p.aim = AIMED.includes(g.weapon) ? (input.up ? 1 : input.down ? -1 : 0) : 0;
  if (aiming && p.aim !== 0 && prevAim !== p.aim) attack(g); // Espacio apretado y después ↑ o ↓: dispara para ese lado
  const upPress = input.up && !p.prevUp && !aiming, downPress = input.down && !p.prevDown && !aiming;
  p.prevUp = input.up; p.prevDown = input.down;
  if (upPress) {
    if (p.onGround || p.coyote > 0) { p.vy = JUMP; p.jumps = 1; p.onGround = false; p.surface = null; p.coyote = 0; emit(g, { type: 'jump', double: false }); }
    else if (p.jumps < 2) { p.vy = JUMP2; p.jumps = 2; p.spinT = 0.42; emit(g, { type: 'jump', double: true }); }
  }
  if (downPress && p.onGround && p.surface && !p.surface.ground) { p.dropT = 0.28; p.onGround = false; p.surface = null; p.vy = -1; }
  const wasGround = p.onGround;
  const landed = moveBody(p, dt, PLAYER_W / 2, 0.45, g.door.open ? W + 1 : DOOR.x1 - PLAYER_W / 2);
  if (wasGround && !p.onGround && p.vy <= 0) { p.coyote = 0.1; p.jumps = 1; }
  if (landed) { p.jumps = 0; p.landT = 0.15; emit(g, { type: 'land' }); }
  if (p.onGround) {
    const before = Math.floor(p.walkT / 0.5);
    p.walkT += dt * Math.abs(p.vx) / SPEED * 2.4;
    if (Math.abs(p.vx) > 1 && Math.floor(p.walkT / 0.5) !== before) emit(g, { type: 'step' });
    if (p.surface?.ground && !GAPS.some(([a, b]) => p.x > a - 1.2 && p.x < b + 1.2)) p.safeX = p.x;
  }
  // Se cayó al vacío: pierde 10 de vida y vuelve al último lugar firme.
  if (p.y < -2) {
    p.hp = Math.max(0, p.hp - FALL_DMG); g.stats.falls++; pop(g, p.safeX, GROUND_Y + 2.5, `−${FALL_DMG}`, true); emit(g, { type: 'fall', hp: p.hp });
    if (p.hp <= 0) { g.phase = 'dead'; g.phaseT = 0; return; }
    Object.assign(p, { x: p.safeX, y: GROUND_Y + 2.5, vx: 0, vy: 0, onGround: false, surface: null, inv: 1.6, jumps: 1 });
  }
  // La puerta abierta: entra y pasa de nivel.
  if (g.door.open && g.door.t > 0.8 && p.x > DOOR.x1 + 0.3 && p.y < DOOR.y + 1) { g.phase = 'cleared'; g.phaseT = 0; emit(g, { type: 'cleared' }); return; }

  updateSpecial(g, dt);
  // El golpe de la espada (o la ola de la espada de fuego): todo lo que está adelante del cazador.
  if (p.attackT >= 0.04 && p.attackT <= 0.22 && (p.attackWeapon === 'sword' || p.attackWeapon === 'firesword')) {
    const fire = p.attackWeapon === 'firesword', reach = fire ? FIRE_REACH : SWORD_REACH, hgt = fire ? FIRE_H : SWORD_H;
    const x1 = p.face > 0 ? p.x - 0.3 : p.x - reach, x2 = p.face > 0 ? p.x + reach : p.x + 0.3, ya = p.y - (fire ? 1.2 : 0.2), yb = ya + hgt;
    for (const v of [...g.vamps]) {
      if (p.hitIds.has(v.id)) continue;
      const [bx1, bx2, vy1, vy2] = vampBox(v);
      if (bx2 > x1 && bx1 < x2 && vy2 > ya && vy1 < yb) { p.hitIds.add(v.id); g.stats.hits++; hitVamp(g, v, WEAPON_DMG[p.attackWeapon], fire ? 'fire' : 'sword', p.x); }
    }
    for (const o of [...g.objects]) if (!p.hitIds.has(o.id) && o.x + 0.6 > x1 && o.x - 0.6 < x2 && o.y + 2 > ya && o.y < yb) { p.hitIds.add(o.id); hitObject(g, o, WEAPON_DMG[p.attackWeapon]); }
    // también corta las bolas de fuego y los murciélagos (la de fuego, también el fuego del dragón)
    for (const s of [...g.shots]) if ((fire || s.kind !== 'flame') && s.x > x1 && s.x < x2 && s.y > ya && s.y < yb) { g.shots.splice(g.shots.indexOf(s), 1); for (let i = 0; i < 8; i++) { const a = g.rand() * Math.PI * 2; g.sparks.push({ x: s.x, y: s.y, vx: Math.cos(a) * 5, vy: Math.sin(a) * 5, t: 0, life: 0.35, hue: s.kind === 'orb' ? 10 : 0 }); } }
  }
  const hitBy = (x: number, y: number, pad: number) => g.vamps.find(v => { const [a, b, c, d] = vampBox(v); return v.state !== 'mist' && x > a - pad && x < b + pad && y > c - 0.1 && y < d + 0.1; });
  const shield = (v: Vamp, vx: number, y: number) => { // el guerrero ataja de frente con el escudo
    if (v.kind !== 'warrior' || Math.sign(vx) !== -v.face || v.state === 'claw') return false;
    emit(g, { type: 'block' }); for (let i = 0; i < 10; i++) { const a = g.rand() * Math.PI * 2; g.sparks.push({ x: v.x + v.face * 0.5, y, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, t: 0, life: 0.3, hue: 45 }); }
    return true;
  };
  // Las flechas de la ballesta: atraviesan hasta 3 vampiros
  for (const s of [...g.bolts]) {
    s.t += dt;
    if (s.stuck) { if (s.t > 1.2) g.bolts.splice(g.bolts.indexOf(s), 1); continue; }
    s.vy -= 3 * dt; const prev = s.y; s.x += s.vx * dt; s.y += s.vy * dt;
    const ob = g.objects.find(o => Math.abs(o.x - s.x) < 0.6 && s.y > o.y && s.y < o.y + 2);
    if (ob) { hitObject(g, ob, WEAPON_DMG.crossbow); g.bolts.splice(g.bolts.indexOf(s), 1); continue; }
    const v = g.vamps.find(q => !s.hits.includes(q.id) && q.state !== 'mist' && (() => { const [a, b, c, d] = vampBox(q); return s.x > a - 0.15 && s.x < b + 0.15 && s.y > c - 0.1 && s.y < d + 0.1; })());
    if (v) {
      if (shield(v, s.vx, s.y)) { g.bolts.splice(g.bolts.indexOf(s), 1); continue; }
      s.hits.push(v.id); g.stats.hits++; hitVamp(g, v, WEAPON_DMG.crossbow, 'bolt', s.x - s.vx);
      if (s.hits.length >= BOLT_PIERCE) { g.bolts.splice(g.bolts.indexOf(s), 1); continue; }
    }
    if (surfaceUnder(s.x, 0.1, prev, s.y, false) || s.x < -1 || s.x > W + 1 || s.y < -3) { s.stuck = s.x > 0 && s.x < W && s.y > -1; s.t = 0; if (s.stuck) emit(g, { type: 'stakeHit' }); else g.bolts.splice(g.bolts.indexOf(s), 1); }
  }
  // Las balas de fuego de la pistola: le pegan al primero que tocan, hasta 10 metros
  for (const b of [...g.bullets]) {
    b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt;
    const ob = g.objects.find(o => Math.abs(o.x - b.x) < 0.6 && b.y > o.y && b.y < o.y + 2);
    if (ob) { hitObject(g, ob, WEAPON_DMG.pistol); g.bullets.splice(g.bullets.indexOf(b), 1); g.fx.push({ kind: 'burst', x: b.x, y: b.y, t: 0, life: 0.35, r: 1, face: 1, seed: g.rand() }); continue; }
    const v = hitBy(b.x, b.y, 0.2);
    const done = Math.hypot(b.x - b.x0, b.y - b.y0) > PISTOL_RANGE || b.x < -1 || b.x > W + 1 || b.y > H + 1 || (b.vy < 0 && !!surfaceUnder(b.x, 0.05, b.y - b.vy * dt, b.y, false));
    if (v || done) {
      g.bullets.splice(g.bullets.indexOf(b), 1);
      g.fx.push({ kind: 'burst', x: b.x, y: b.y, t: 0, life: 0.35, r: v ? 1.1 : 0.6, face: 1, seed: g.rand() });
      if (v) { g.stats.hits++; hitVamp(g, v, WEAPON_DMG.pistol, 'bullet', b.x - b.vx); }
    }
  }
  // Las bombas de ajo: vuelan, rebotan una vez y explotan; la onda le saca 5 a todos los que están a 3 metros
  for (const b of [...g.bombs]) {
    b.t += dt; b.a += dt * 8 * Math.sign(b.vx || 1);
    let boom = b.t > 2.4 || b.y < -2;
    if (b.landed < 0) {
      b.vy -= 22 * dt; const prev = b.y; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.vy < 0) { const q = surfaceUnder(b.x, 0.2, prev, b.y, false); if (q) { b.y = q.y; if (Math.abs(b.vy) > 6) { b.vy = -b.vy * 0.3; b.vx *= 0.5; } else { b.landed = 0; b.vx = 0; b.vy = 0; } } }
      if (b.x < 0.3 || b.x > W - 0.3) { b.vx = -b.vx * 0.5; b.x = Math.max(0.3, Math.min(W - 0.3, b.x)); }
      if (hitBy(b.x, b.y, 0.1)) boom = true; // si le pega a un vampiro, explota ahí
    } else { b.landed += dt; if (b.landed > 0.45) boom = true; }
    if (boom) {
      g.bombs.splice(g.bombs.indexOf(b), 1);
      const cy = b.y + 0.4; let count = 0;
      for (const v of [...g.vamps]) {
        const [a, c, d, e] = vampBox(v), nx = Math.max(a, Math.min(c, b.x)), ny = Math.max(d, Math.min(e, cy));
        if (v.state !== 'mist' && Math.hypot(nx - b.x, ny - cy) <= GARLIC_R) { count++; hitVamp(g, v, WEAPON_DMG.garlic, 'bomb', b.x); }
      }
      for (const o of [...g.objects]) if (Math.hypot(o.x - b.x, Math.max(o.y, Math.min(o.y + 2, cy)) - cy) <= GARLIC_R) hitObject(g, o, WEAPON_DMG.garlic);
      g.fx.push({ kind: 'blast', x: b.x, y: cy, t: 0, life: 0.6, r: GARLIC_R, face: 1, seed: g.rand() });
      g.garlicT = Math.max(g.garlicT, 2); g.shake = Math.max(g.shake, 0.6); g.flash = Math.max(g.flash, 0.2);
      for (let i = 0; i < 30; i++) { const a = g.rand() * Math.PI * 2, sp = 3 + g.rand() * 9; g.sparks.push({ x: b.x, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 2, t: 0, life: 0.4 + g.rand() * 0.4, hue: g.rand() < 0.5 ? 90 : 45 }); }
      emit(g, { type: 'blast', count });
    }
  }
  for (const f of [...g.fx]) { f.t += dt; if (f.t > f.life) g.fx.splice(g.fx.indexOf(f), 1); }

  // Vampiros
  for (const v of [...g.vamps]) {
    if (v.kind === 'flyer') updateFlyer(g, v, dt); else if (v.kind === 'dragon') updateDragon(g, v, dt); else updateWalker(g, v, dt);
    if (!g.vamps.includes(v) || isBoss(v.kind)) continue; // a Drácula y al dragón no les hacen nada las trampas
    const [, , y1, y2] = vampBox(v);
    // Las trampas no los matan: salta sangre y salen despedidos.
    v.hurtT = Math.max(0, (v.hurtT ?? 0) - dt);
    if (!v.hurtT) for (const t of TRAPS) if (trapHits(t, g.time, v.x - 0.35, v.x + 0.35, y1, y2)) {
      const st = trapState(t, g.time), from = t.kind === 'pendulum' ? st.tipX - (st.a > trapState(t, g.time - dt).a ? 1 : -1) : t.x;
      v.hurtT = 0.9; v.vx = (v.x >= from ? 1 : -1) * 6.5;
      if (v.kind !== 'flyer') { v.vy = 9; v.onGround = false; v.surface = null; v.state = 'walk'; } else v.vy = 5;
      for (let i = 0; i < 28; i++) { const a = g.rand() * Math.PI, sp = 2 + g.rand() * 8; g.drops.push({ x: v.x, y: (y1 + y2) / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 0.05 + g.rand() * 0.09, t: 0, stuck: false }); }
      emit(g, { type: 'vampHurt', x: v.x, trap: t.kind });
      break;
    }
  }
  // Trampas contra el cazador
  for (const t of TRAPS) {
    const st = trapState(t, g.time), prevSt = trapState(t, g.time - dt);
    if (t.kind === 'spikes' && st.on > 0 && prevSt.on === 0) emit(g, { type: 'spikes' });
    if (t.kind === 'fire' && st.on > 0 && prevSt.on === 0) emit(g, { type: 'fire' });
    if (t.kind === 'pendulum' && Math.sign(st.a) !== Math.sign(prevSt.a)) emit(g, { type: 'swing' });
    if (trapHits(t, g.time, p.x - 0.32, p.x + 0.32, p.y, p.y + PLAYER_H)) hurt(g, t.kind === 'pendulum' ? st.tipX - (st.a > prevSt.a ? 1 : -1) : t.x, TRAP_DMG); // el péndulo empuja para donde va
  }
  updateShots(g, dt);
  for (const q of [...g.pops]) { q.t += dt; q.y += dt * 1.4; if (q.t > 1) g.pops.splice(g.pops.indexOf(q), 1); }
  // Drácula se convierte en dragón
  if (g.transformT > 0) {
    g.transformT -= dt;
    const c = g.corpses.find(q => q.kind === 'dracula');
    if (g.transformT <= 0) {
      const x = Math.max(3, Math.min(W - 3, c?.x ?? 14)); if (c) g.corpses.splice(g.corpses.indexOf(c), 1);
      g.vamps.push(makeVamp(g, 'dragon', { x, y: GROUND_Y + 4.5, face: p.x > x ? 1 : -1, state: 'rise', speed: 6, cool: 1.5 }));
      g.flash = 1; g.shake = 1; emit(g, { type: 'dragon' });
    }
  }
  // El dragón cayó: se gana el juego
  if (g.bossDeadT >= 0) { g.bossDeadT += dt; if (g.bossDeadT > 3) { g.phase = 'cleared'; g.phaseT = 0; emit(g, { type: 'cleared' }); return; } }

  updateGoal(g, dt);

  // Aparecen vampiros y caen cajas
  g.spawnT -= dt;
  if (g.spawnT <= 0) {
    if (g.vamps.length < aliveCap(g)) spawn(g);
    g.spawnT = Math.max(0.8, 2.5 - g.total * 0.03) * (g.bloodMoon ? 0.8 : 1) * (0.7 + g.rand() * 0.6);
  }
  g.crateT -= dt;
  if (g.crateT <= 0) { dropCrate(g); g.crateT = 11 + g.rand() * 5; }
  updateCrates(g, dt);
  updateRemains(g, dt);
}

export const formatVampTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
