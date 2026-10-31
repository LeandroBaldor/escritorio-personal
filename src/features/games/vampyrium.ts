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
export const MAX_HP = 5;
export const START_STAKES = 8;
export const MAX_STAKES = 30;
export const POWER_MAX = 10;
export const PLAYER_W = 0.8, PLAYER_H = 1.9;
const GRAV = 36, SPEED = 7, JUMP = 16.2, JUMP2 = 14, FALL_MAX = 24;
const VAMP_W = 0.8, VAMP_H = 1.8;

export type Weapon = 'sword' | 'stakes';
export const WEAPONS: Weapon[] = ['sword', 'stakes'];
export const WEAPON_NAME: Record<Weapon, string> = { sword: 'Espada', stakes: 'Estacas' };

export interface Surface { x1: number; x2: number; y: number; ground: boolean }
export const SURFACES: Surface[] = [
  { x1: 0, x2: 8, y: GROUND_Y, ground: true },
  { x1: 10.6, x2: 17.6, y: GROUND_Y, ground: true },
  { x1: 20.2, x2: W, y: GROUND_Y, ground: true },
  { x1: 2, x2: 6.2, y: 6.6, ground: false },
  { x1: 11.2, x2: 16.8, y: 6.6, ground: false },
  { x1: 22.4, x2: 26.2, y: 6.6, ground: false },
  { x1: 6.6, x2: 10.8, y: 9.9, ground: false },
  { x1: 17, x2: 21.6, y: 9.9, ground: false },
  { x1: 11.6, x2: 16.4, y: 13, ground: false },
];
// Los dos huecos al vacío (entre los tramos de suelo).
export const GAPS: [number, number][] = [[8, 10.6], [17.6, 20.2]];
export const DOOR = { x1: 26.7, x2: 27.9, y: GROUND_Y, h: 3.2 };
export const START_X = 2.6;

export type TrapKind = 'spikes' | 'pendulum' | 'fire';
export interface Trap { kind: TrapKind; x: number; x2: number; y: number; period: number; offset: number; len: number; amp: number }
export const TRAPS: Trap[] = [
  { kind: 'spikes', x: 13.2, x2: 14.8, y: GROUND_Y, period: 3.4, offset: 0, len: 0, amp: 0 },
  { kind: 'pendulum', x: 14, x2: 14, y: H + 0.5, period: 3.9, offset: 0.4, len: 8, amp: 0.8 },
  { kind: 'fire', x: 23.6, x2: 23.6, y: GROUND_Y, period: 4.6, offset: 1.7, len: 4.2, amp: 0 },
];

export interface Input { left: boolean; right: boolean; up: boolean; down: boolean }
export interface Player {
  x: number; y: number; vx: number; vy: number; face: 1 | -1; onGround: boolean; surface: Surface | null; jumps: number;
  hp: number; inv: number; attackT: number; attackWeapon: Weapon; hitIds: Set<number>; cool: number; walkT: number;
  dropT: number; coyote: number; safeX: number; prevUp: boolean; prevDown: boolean; hurtT: number; landT: number;
}
export type VampKind = 'walker' | 'flyer';
export type VampState = 'walk' | 'claw' | 'hover' | 'dive' | 'rise';
export interface Vamp {
  id: number; kind: VampKind; x: number; y: number; vx: number; vy: number; face: 1 | -1; state: VampState; t: number;
  onGround: boolean; surface: Surface | null; walkT: number; cool: number; speed: number; jumpT: number; dropT: number; hit: boolean;
}
export type KillHow = 'sword' | 'stake' | 'trap' | 'void' | 'holy' | 'crate';
export interface Corpse { id: number; kind: VampKind; x: number; y: number; face: 1 | -1; t: number; how: KillHow }
export type BoneKind = 'skull' | 'jaw' | 'ribs' | 'pelvis' | 'arm' | 'leg' | 'spine';
export interface Bone { kind: BoneKind; x: number; y: number; vx: number; vy: number; a: number; va: number; t: number; rest: boolean }
export interface Spark { x: number; y: number; vx: number; vy: number; t: number; life: number; hue: number }
// Sangre que salpica: gotas que vuelan y quedan como manchas en el piso.
export interface Drop { x: number; y: number; vx: number; vy: number; r: number; t: number; stuck: boolean }
export const BURN_AT = 0.3, BLOW_AT = 0.85; // el vampiro se vuelve esqueleto, se prende fuego y a los 0,85 s revienta
export interface Stake { x: number; y: number; vx: number; vy: number; t: number; stuck: boolean }
export type CrateKind = 'stakes' | 'heart' | 'garlic';
export interface Crate { id: number; kind: CrateKind; x: number; y: number; vy: number; landed: boolean; t: number; surface: Surface | null }

export type GameEvent =
  | { type: 'slash' } | { type: 'throw' } | { type: 'stakeHit' } | { type: 'empty' }
  | { type: 'kill'; kind: VampKind; how: KillHow; x: number; y: number } | { type: 'bones'; x: number; y: number }
  | { type: 'hurt'; hp: number } | { type: 'fall'; hp: number } | { type: 'jump'; double: boolean } | { type: 'land' } | { type: 'step' }
  | { type: 'crate' } | { type: 'pickup'; kind: CrateKind; amount: number } | { type: 'door' } | { type: 'spikes' } | { type: 'fire' }
  | { type: 'swing' } | { type: 'combo'; n: number } | { type: 'holy'; count: number } | { type: 'wave'; n: number } | { type: 'bloodMoon' }
  | { type: 'menu'; open: boolean } | { type: 'choose'; weapon: Weapon } | { type: 'hiss'; x: number } | { type: 'dive' } | { type: 'emerge' }
  | { type: 'vampFall' } | { type: 'cleared' } | { type: 'over' } | { type: 'won' } | { type: 'powerReady' };

export type Phase = 'play' | 'menu' | 'dead' | 'cleared' | 'won' | 'over';
export interface Game {
  time: number; real: number; phase: Phase; phaseT: number;
  player: Player; vamps: Vamp[]; corpses: Corpse[]; bones: Bone[]; sparks: Spark[]; drops: Drop[]; stakes: Stake[]; crates: Crate[];
  kills: Record<VampKind, number>; total: number; voidKills: number; trapKills: number;
  weapon: Weapon; ammo: number; menu: { sel: number; t: number }; lastTap: number;
  combo: { n: number; t: number; best: number }; power: number; holyT: number; garlicT: number;
  door: { open: boolean; t: number }; spawnT: number; crateT: number; nextId: number; wave: number; bloodMoon: boolean;
  flash: number; shake: number; events: GameEvent[]; rand: () => number; stats: { slashes: number; throws: number; hits: number; crates: number; falls: number };
}

export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function newPlayer(): Player {
  return { x: START_X, y: GROUND_Y, vx: 0, vy: 0, face: 1, onGround: true, surface: SURFACES[0], jumps: 0, hp: MAX_HP, inv: 0, attackT: -1, attackWeapon: 'sword', hitIds: new Set(), cool: 0, walkT: 0, dropT: 0, coyote: 0, safeX: START_X, prevUp: false, prevDown: false, hurtT: 0, landT: 0 };
}
export function newGame(seed = Math.floor(Math.random() * 1e9)): Game {
  return {
    time: 0, real: 0, phase: 'play', phaseT: 0, player: newPlayer(), vamps: [], corpses: [], bones: [], sparks: [], drops: [], stakes: [], crates: [],
    kills: { walker: 0, flyer: 0 }, total: 0, voidKills: 0, trapKills: 0, weapon: 'sword', ammo: START_STAKES, menu: { sel: 0, t: 0 }, lastTap: -9,
    combo: { n: 0, t: 0, best: 0 }, power: 0, holyT: 0, garlicT: 0, door: { open: false, t: 0 }, spawnT: 1.6, crateT: 9, nextId: 1, wave: 1, bloodMoon: false,
    flash: 0, shake: 0, events: [], rand: mulberry(seed), stats: { slashes: 0, throws: 0, hits: 0, crates: 0, falls: 0 },
  };
}
const emit = (g: Game, e: GameEvent) => { g.events.push(e); };
export function takeEvents(g: Game) { const e = g.events; g.events = []; return e; }

// ---------------------------------------------------------------- Suelo y huecos
export const inGap = (x: number) => GAPS.some(([a, b]) => x > a && x < b);
const surfaceUnder = (x: number, halfW: number, prevY: number, y: number, skipPlatforms: boolean) => {
  let best: Surface | null = null;
  for (const s of SURFACES) {
    if (!s.ground && skipPlatforms) continue;
    if (x + halfW * 0.6 < s.x1 || x - halfW * 0.6 > s.x2) continue;
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
const stillOn = (s: Surface | null, x: number, halfW: number) => !!s && x + halfW * 0.6 >= s.x1 && x - halfW * 0.6 <= s.x2;

// Mueve un cuerpo (cazador o vampiro caminante) con gravedad y lo apoya en el suelo y las plataformas.
interface Body { x: number; y: number; vx: number; vy: number; onGround: boolean; surface: Surface | null; dropT: number }
function moveBody(b: Body, dt: number, halfW: number, minX: number, maxX: number) {
  b.vy = Math.max(-FALL_MAX, b.vy - GRAV * dt);
  b.x = Math.max(minX, Math.min(maxX, b.x + b.vx * dt));
  const prevY = b.y;
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
export function trapState(t: Trap, time: number) {
  const ph = ((time + t.offset) % t.period + t.period) % t.period;
  if (t.kind === 'pendulum') { const a = t.amp * Math.sin((time + t.offset) * Math.PI * 2 / t.period); return { a, tipX: t.x + Math.sin(a) * t.len, tipY: t.y - Math.cos(a) * t.len, warn: 0, on: 1 }; }
  if (t.kind === 'spikes') { const warn = ph > 1.6 && ph < 2.2 ? 1 : 0, up = ph >= 2.2 ? Math.min(1, (ph - 2.2) / 0.08, (t.period - ph) / 0.15) : 0; return { a: 0, tipX: 0, tipY: 0, warn, on: up }; }
  const warn = ph > 2.2 && ph < 3 ? 1 : 0, on = ph >= 3 ? Math.min(1, (ph - 3) / 0.15, (t.period - ph) / 0.3) : 0; // fuego
  return { a: 0, tipX: 0, tipY: 0, warn, on };
}
// ¿La trampa lastima algo que ocupa esta caja (x1..x2, y1..y2)?
function trapHits(t: Trap, time: number, x1: number, x2: number, y1: number, y2: number) {
  const s = trapState(t, time);
  if (t.kind === 'spikes') return s.on > 0.6 && x2 > t.x && x1 < t.x2 && y1 < t.y + 0.75;
  if (t.kind === 'fire') return s.on > 0.4 && x2 > t.x - 0.45 && x1 < t.x + 0.45 && y1 < t.y + t.len * s.on && y2 > t.y;
  const cx = Math.max(x1, Math.min(x2, s.tipX)), cy = Math.max(y1, Math.min(y2, s.tipY));
  return Math.hypot(cx - s.tipX, cy - s.tipY) < 0.85;
}

// ---------------------------------------------------------------- Ataques del cazador
// Espacio: ataca con el arma que tiene. Dos veces seguidas rápido: abre el cartel de las armas.
export function pressAttack(g: Game) {
  if (g.phase === 'menu') { chooseWeapon(g, WEAPONS[g.menu.sel]); return; }
  if (g.phase !== 'play') return;
  if (g.real - g.lastTap < 0.3) { g.lastTap = -9; openMenu(g); return; }
  g.lastTap = g.real;
  attack(g);
}
export function openMenu(g: Game) { if (g.phase !== 'play') return; g.phase = 'menu'; g.menu = { sel: WEAPONS.indexOf(g.weapon), t: 0 }; emit(g, { type: 'menu', open: true }); }
export function closeMenu(g: Game) { if (g.phase !== 'menu') return; g.phase = 'play'; emit(g, { type: 'menu', open: false }); }
export function menuMove(g: Game, step: number) { if (g.phase !== 'menu') return; g.menu.sel = (g.menu.sel + step + WEAPONS.length) % WEAPONS.length; g.menu.t = 0; }
export function chooseWeapon(g: Game, w: Weapon) {
  g.weapon = w; emit(g, { type: 'choose', weapon: w });
  if (g.phase === 'menu') { g.phase = 'play'; emit(g, { type: 'menu', open: false }); }
}
export function attack(g: Game) {
  const p = g.player;
  if (p.cool > 0 || g.phase !== 'play') return;
  if (g.weapon === 'stakes' && g.ammo <= 0) { g.weapon = 'sword'; emit(g, { type: 'empty' }); }
  p.attackT = 0; p.attackWeapon = g.weapon; p.hitIds = new Set();
  if (g.weapon === 'sword') { p.cool = 0.3; g.stats.slashes++; emit(g, { type: 'slash' }); }
  else {
    p.cool = 0.34; g.ammo--; g.stats.throws++;
    g.stakes.push({ x: p.x + p.face * 0.5, y: p.y + 1.25, vx: p.face * 19 + p.vx * 0.3, vy: 1.2, t: 0, stuck: false });
    emit(g, { type: 'throw' });
    if (g.ammo <= 0) { g.weapon = 'sword'; emit(g, { type: 'empty' }); } // la última: vuelve la espada
  }
}
// El poder de la cruz: con 10 vampiros cargado, una luz sagrada revienta a todos los que están a la vista.
export function castHoly(g: Game) {
  if (g.phase !== 'play' || g.power < POWER_MAX) return false;
  g.power = 0; g.holyT = 1.4; g.flash = 1; g.shake = 0.6;
  const n = g.vamps.length;
  for (const v of [...g.vamps]) kill(g, v, 'holy');
  emit(g, { type: 'holy', count: n });
  return true;
}

function kill(g: Game, v: Vamp, how: KillHow) {
  const i = g.vamps.indexOf(v); if (i < 0) return;
  g.vamps.splice(i, 1);
  g.kills[v.kind]++; g.total++;
  if (how === 'void') g.voidKills++;
  if (how === 'trap') g.trapKills++;
  if (how !== 'void') g.corpses.push({ id: v.id, kind: v.kind, x: v.x, y: v.y, face: v.face, t: 0, how });
  emit(g, { type: 'kill', kind: v.kind, how, x: v.x, y: v.y });
  g.combo.n = g.combo.t > 0 ? g.combo.n + 1 : 1; g.combo.t = 2.4; g.combo.best = Math.max(g.combo.best, g.combo.n);
  if (g.combo.n >= 2) emit(g, { type: 'combo', n: g.combo.n });
  if (how !== 'holy') { const was = g.power; g.power = Math.min(POWER_MAX, g.power + 1); if (was < POWER_MAX && g.power === POWER_MAX) emit(g, { type: 'powerReady' }); }
  if (g.total % 10 === 0 && g.total < GOAL) { g.wave = g.total / 10 + 1; emit(g, { type: 'wave', n: g.wave }); }
  if (g.total >= 35 && !g.bloodMoon) { g.bloodMoon = true; emit(g, { type: 'bloodMoon' }); }
  if (g.total >= GOAL && !g.door.open) { g.door.open = true; emit(g, { type: 'door' }); }
}

function hurt(g: Game, fromX: number) {
  const p = g.player;
  if (p.inv > 0 || g.phase !== 'play') return;
  p.hp--; p.inv = 1.3; p.hurtT = 0.35; g.shake = Math.max(g.shake, 0.4);
  p.vx = (p.x >= fromX ? 1 : -1) * 8; p.vy = 9; p.onGround = false; p.surface = null;
  emit(g, { type: 'hurt', hp: p.hp });
  if (p.hp <= 0) { g.phase = 'dead'; g.phaseT = 0; }
}

// ---------------------------------------------------------------- Vampiros
function spawn(g: Game) {
  // parejo: sale el tipo del que hay menos (muertos + vivos); si están iguales, al azar
  const r = g.rand, count = (k: VampKind) => g.kills[k] + g.vamps.filter(v => v.kind === k).length;
  const flyerChance = count('flyer') < count('walker') ? 1 : count('flyer') > count('walker') ? 0 : 0.5;
  const speedK = g.bloodMoon ? 1.25 : 1;
  const base = { id: g.nextId++, vx: 0, vy: 0, t: 0, onGround: false, surface: null, walkT: 0, cool: 1 + r(), jumpT: 0, dropT: 0, hit: false };
  if (r() < flyerChance) {
    const left = r() < 0.5;
    g.vamps.push({ ...base, kind: 'flyer', x: left ? -1 : W + 1, y: H - 2 - r() * 3, face: left ? 1 : -1, state: 'hover', speed: (3.2 + r() * 1.2) * speedK, cool: 2 + r() * 2 });
    return;
  }
  const from = r();
  if (from < 0.28) { // sale trepando del vacío
    const [a, b] = GAPS[Math.floor(r() * GAPS.length)], x = (a + b) / 2;
    g.vamps.push({ ...base, kind: 'walker', x, y: -1.5, vy: 20, vx: (r() < 0.5 ? -1 : 1) * 3.4, face: g.player.x > x ? 1 : -1, state: 'walk', speed: (2.3 + r()) * speedK });
    emit(g, { type: 'emerge' });
    return;
  }
  const left = from < 0.64 && g.player.x > 4;
  const x = left ? -0.6 : W + 0.6;
  g.vamps.push({ ...base, kind: 'walker', x, y: GROUND_Y, onGround: true, surface: left ? SURFACES[0] : SURFACES[2], face: left ? 1 : -1, state: 'walk', speed: (2.3 + r() * 1.1) * speedK });
}

function updateWalker(g: Game, v: Vamp, dt: number) {
  const p = g.player, r = g.rand;
  const dx = p.x - v.x, dy = p.y - v.y;
  const scared = g.garlicT > 0 && Math.abs(dx) < 4.5 && Math.abs(dy) < 3;
  v.cool -= dt; v.jumpT -= dt; v.dropT -= dt;
  if (v.state === 'claw') {
    v.vx *= Math.max(0, 1 - dt * 12);
    v.t += dt;
    if (v.t >= 0.36 && !v.hit) { v.hit = true; if (Math.abs(dx) < 1.25 && dy > -1.4 && dy < 1.6) hurt(g, v.x); }
    if (v.t >= 0.7) { v.state = 'walk'; v.cool = 0.6 + r() * 0.5; }
  } else {
    let dir = Math.sign(dx) || v.face;
    if (scared) dir = -Math.sign(dx) || 1; // el ajo: se escapa
    v.face = dir as 1 | -1;
    const target = dir * v.speed * (scared ? 1.3 : 1);
    if (v.onGround) {
      v.vx += (target - v.vx) * Math.min(1, dt * 8);
      v.walkT += dt * Math.abs(v.vx);
      // ¿Se termina el piso adelante?
      const ahead = v.x + dir * 0.7, s = v.surface;
      if (s && (ahead < s.x1 || ahead > s.x2) && ahead > 0.2 && ahead < W - 0.2) {
        const otherSide = s.ground ? (dir > 0 ? p.x > s.x2 + 1 : p.x < s.x1 - 1) : false;
        if (s.ground && otherSide && v.jumpT <= 0) { v.vy = 14.5; v.vx = dir * Math.max(4.8, v.speed * 1.7); v.onGround = false; v.surface = null; v.jumpT = 1; }
        else if (s.ground && r() > dt * 0.3) v.vx = 0; // espera en el borde (de vez en cuando se distrae y se cae al vacío)
      }
      // El cazador está arriba: salta a buscarlo.
      if (v.onGround && dy > 2.2 && Math.abs(dx) < 4 && v.jumpT <= 0 && r() < dt * 2.2) { v.vy = 17.5; v.onGround = false; v.surface = null; v.jumpT = 1.6; }
      // Está abajo: baja de la plataforma.
      if (v.onGround && v.surface && !v.surface.ground && dy < -1.5 && Math.abs(dx) < 3 && r() < dt * 1.5) { v.dropT = 0.3; v.onGround = false; v.surface = null; }
      if (!scared && Math.abs(dx) < 1 && Math.abs(dy) < 1.3 && v.cool <= 0) { v.state = 'claw'; v.t = 0; v.hit = false; v.vx = 0; emit(g, { type: 'hiss', x: v.x }); }
    } else v.vx += (target - v.vx) * Math.min(1, dt * 1.5);
  }
  const was = v.onGround;
  moveBody(v, dt, VAMP_W / 2, -1.2, W + 1.2);
  if (!was && v.onGround) v.walkT = 0;
  if (v.y < -2.5) { emit(g, { type: 'vampFall' }); kill(g, v, 'void'); }
}

function updateFlyer(g: Game, v: Vamp, dt: number) {
  const p = g.player, r = g.rand;
  v.t += dt; v.cool -= dt; v.walkT += dt;
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
    if (!v.hit && Math.abs(p.x - v.x) < 0.95 && p.y + 0.2 < v.y + 0.6 && p.y + PLAYER_H > v.y - 0.3) { v.hit = true; hurt(g, v.x); }
    if (v.t > 1.1 || v.y < GROUND_Y + 0.4) { v.state = 'rise'; v.t = 0; }
  } else { // rise
    v.vy += (6 - v.vy) * Math.min(1, dt * 4); v.vx *= Math.max(0, 1 - dt * 2);
    if (v.t > 0.9) { v.state = 'hover'; v.cool = 2.2 + r() * 2.2; }
  }
  v.x += v.vx * dt; v.y += v.vy * dt;
  v.y = Math.max(GROUND_Y + 0.3, Math.min(H + 1, v.y));
  if (v.state === 'hover') v.x = Math.max(-1.5, Math.min(W + 1.5, v.x));
}

// ---------------------------------------------------------------- Cajas del cielo
function dropCrate(g: Game) {
  const r = g.rand, roll = r();
  const kind: CrateKind = roll < 0.66 ? 'stakes' : roll < 0.86 ? 'heart' : 'garlic';
  const spots = SURFACES.filter(s => s.x2 - s.x1 > 2);
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
      if (c.kind === 'stakes') { const before = g.ammo; g.ammo = Math.min(MAX_STAKES, g.ammo + 6); emit(g, { type: 'pickup', kind: 'stakes', amount: g.ammo - before }); }
      else if (c.kind === 'heart') { const before = p.hp; p.hp = Math.min(MAX_HP, p.hp + 2); emit(g, { type: 'pickup', kind: 'heart', amount: p.hp - before }); }
      else { g.garlicT = 8; emit(g, { type: 'pickup', kind: 'garlic', amount: 8 }); }
      continue;
    }
    if (c.landed && c.t > 16) g.crates.splice(g.crates.indexOf(c), 1);
  }
}

// ---------------------------------------------------------------- Restos: esqueleto, chispas y huesos
const BONES: BoneKind[] = ['skull', 'jaw', 'ribs', 'spine', 'pelvis', 'arm', 'arm', 'leg', 'leg'];
function updateRemains(g: Game, dt: number) {
  const r = g.rand;
  for (const c of [...g.corpses]) {
    c.t += dt;
    const fly = c.kind === 'flyer' ? -0.6 : 0;
    if (r() < dt * (c.t > BURN_AT ? 90 : 40)) g.sparks.push({ x: c.x + (r() - 0.5) * 0.9, y: c.y + fly + 0.3 + r() * 1.6, vx: (r() - 0.5) * 3, vy: 1 + r() * 4, t: 0, life: 0.4 + r() * 0.4, hue: 20 + r() * 35 });
    if (c.t >= BLOW_AT) {
      g.corpses.splice(g.corpses.indexOf(c), 1);
      const hs: Record<BoneKind, number> = { skull: 1.55, jaw: 1.35, ribs: 1.05, spine: 0.9, pelvis: 0.7, arm: 1.1, leg: 0.4 };
      for (const k of BONES) {
        const a = (r() - 0.5) * 2.8 + Math.PI / 2, sp = 9 + r() * 9;
        g.bones.push({ kind: k, x: c.x + (r() - 0.5) * 0.4, y: c.y + fly + hs[k], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 3, a: r() * 6, va: (r() - 0.5) * 30, t: 0, rest: false });
      }
      for (let i = 0; i < 34; i++) { const a = r() * Math.PI, sp = 3 + r() * 10; g.drops.push({ x: c.x + (r() - 0.5) * 0.5, y: c.y + fly + 0.6 + r() * 1.2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 0.05 + r() * 0.1, t: 0, stuck: false }); }
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
    if ((d.stuck && d.t > 7) || d.y < -6) g.drops.splice(g.drops.indexOf(d), 1);
  }
  if (g.drops.length > 500) g.drops.splice(0, g.drops.length - 500);
}

// ---------------------------------------------------------------- Un paso del juego
export function aliveCap(g: Game) { return g.door.open ? 2 : Math.min(8, 3 + Math.floor(g.total / 8)); }

export function step(g: Game, input: Input, dt: number) {
  g.real += dt;
  if (g.phase === 'menu') { g.menu.t += dt; if (g.menu.t > 5) chooseWeapon(g, WEAPONS[g.menu.sel]); return; } // el cartel de armas frena todo
  g.time += dt; g.phaseT += dt;
  g.flash = Math.max(0, g.flash - dt * 1.8); g.shake = Math.max(0, g.shake - dt * 2);
  g.holyT = Math.max(0, g.holyT - dt); g.garlicT = Math.max(0, g.garlicT - dt); g.combo.t = Math.max(0, g.combo.t - dt);
  if (g.door.open) g.door.t += dt;
  const p = g.player;
  if (g.phase === 'dead') { if (g.phaseT > 1.6) { g.phase = 'over'; emit(g, { type: 'over' }); } updateRemains(g, dt); return; }
  if (g.phase === 'over' || g.phase === 'won') return;
  if (g.phase === 'cleared') { updateRemains(g, dt); p.x += dt * 2; p.walkT += dt * 2; if (g.phaseT > 2.4) { g.phase = 'won'; emit(g, { type: 'won' }); } return; }

  // El cazador
  p.inv = Math.max(0, p.inv - dt); p.cool = Math.max(0, p.cool - dt); p.dropT -= dt; p.coyote -= dt; p.hurtT = Math.max(0, p.hurtT - dt); p.landT = Math.max(0, p.landT - dt);
  if (p.attackT >= 0) { p.attackT += dt; if (p.attackT > 0.3) p.attackT = -1; }
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir) p.face = dir as 1 | -1;
  const slow = p.attackT >= 0 && p.onGround && p.attackWeapon === 'sword' ? 0.45 : 1;
  const ctrl = p.hurtT > 0 ? 0 : p.onGround ? 14 : 6;
  p.vx += (dir * SPEED * slow - p.vx) * Math.min(1, dt * ctrl);
  const upPress = input.up && !p.prevUp, downPress = input.down && !p.prevDown;
  p.prevUp = input.up; p.prevDown = input.down;
  if (upPress) {
    if (p.onGround || p.coyote > 0) { p.vy = JUMP; p.jumps = 1; p.onGround = false; p.surface = null; p.coyote = 0; emit(g, { type: 'jump', double: false }); }
    else if (p.jumps < 2) { p.vy = JUMP2; p.jumps = 2; emit(g, { type: 'jump', double: true }); }
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
  // Se cayó al vacío: pierde un corazón y vuelve al último lugar firme.
  if (p.y < -2) {
    p.hp--; g.stats.falls++; emit(g, { type: 'fall', hp: p.hp });
    if (p.hp <= 0) { g.phase = 'dead'; g.phaseT = 0; return; }
    Object.assign(p, { x: p.safeX, y: GROUND_Y + 2.5, vx: 0, vy: 0, onGround: false, surface: null, inv: 1.6, jumps: 1 });
  }
  // La puerta abierta: entra y pasa de nivel.
  if (g.door.open && g.door.t > 0.8 && p.x > DOOR.x1 + 0.3 && p.y < DOOR.y + 1) { g.phase = 'cleared'; g.phaseT = 0; emit(g, { type: 'cleared' }); return; }

  // El golpe de la espada: un arco adelante del cazador.
  if (p.attackT >= 0.04 && p.attackT <= 0.2 && p.attackWeapon === 'sword') {
    const x1 = p.face > 0 ? p.x - 0.3 : p.x - 2.1, x2 = p.face > 0 ? p.x + 2.1 : p.x + 0.3;
    for (const v of [...g.vamps]) {
      if (p.hitIds.has(v.id)) continue;
      const vy1 = v.kind === 'flyer' ? v.y - 0.6 : v.y, vy2 = v.kind === 'flyer' ? v.y + 0.8 : v.y + VAMP_H;
      if (v.x + 0.4 > x1 && v.x - 0.4 < x2 && vy2 > p.y - 0.2 && vy1 < p.y + 2.5) { p.hitIds.add(v.id); g.stats.hits++; kill(g, v, 'sword'); }
    }
  }
  // Las estacas que vuelan
  for (const s of [...g.stakes]) {
    s.t += dt;
    if (s.stuck) { if (s.t > 1.5) g.stakes.splice(g.stakes.indexOf(s), 1); continue; }
    s.vy -= 7 * dt; const prev = s.y; s.x += s.vx * dt; s.y += s.vy * dt;
    const victim = g.vamps.find(v => Math.abs(v.x - s.x) < 0.55 && (v.kind === 'flyer' ? Math.abs(v.y - s.y) < 0.8 : s.y > v.y - 0.1 && s.y < v.y + VAMP_H + 0.1));
    if (victim) { g.stakes.splice(g.stakes.indexOf(s), 1); g.stats.hits++; kill(g, victim, 'stake'); continue; }
    if (surfaceUnder(s.x, 0.1, prev, s.y, false) || s.x < -1 || s.x > W + 1 || s.y < -3) { s.stuck = s.x > 0 && s.x < W && s.y > -1; s.t = 0; if (s.stuck) emit(g, { type: 'stakeHit' }); else g.stakes.splice(g.stakes.indexOf(s), 1); }
  }

  // Vampiros
  for (const v of [...g.vamps]) {
    if (v.kind === 'walker') updateWalker(g, v, dt); else updateFlyer(g, v, dt);
    if (!g.vamps.includes(v)) continue;
    const y1 = v.kind === 'flyer' ? v.y - 0.6 : v.y, y2 = v.kind === 'flyer' ? v.y + 0.8 : v.y + VAMP_H;
    for (const t of TRAPS) if (trapHits(t, g.time, v.x - 0.35, v.x + 0.35, y1, y2)) { kill(g, v, 'trap'); break; }
  }
  // Trampas contra el cazador
  for (const t of TRAPS) {
    const st = trapState(t, g.time), prevSt = trapState(t, g.time - dt);
    if (t.kind === 'spikes' && st.on > 0 && prevSt.on === 0) emit(g, { type: 'spikes' });
    if (t.kind === 'fire' && st.on > 0 && prevSt.on === 0) emit(g, { type: 'fire' });
    if (t.kind === 'pendulum' && Math.sign(st.a) !== Math.sign(prevSt.a)) emit(g, { type: 'swing' });
    if (trapHits(t, g.time, p.x - 0.32, p.x + 0.32, p.y, p.y + PLAYER_H)) hurt(g, t.kind === 'pendulum' ? st.tipX - (st.a > prevSt.a ? 1 : -1) : t.x); // el péndulo empuja para donde va
  }

  // Aparecen vampiros y caen cajas
  g.spawnT -= dt;
  if (g.spawnT <= 0) {
    if (g.vamps.length < aliveCap(g)) spawn(g);
    g.spawnT = Math.max(0.8, 2.5 - g.total * 0.03) * (g.bloodMoon ? 0.8 : 1) * (0.7 + g.rand() * 0.6);
  }
  g.crateT -= dt;
  if (g.crateT <= 0) { dropCrate(g); g.crateT = 11 + g.rand() * 5 - (g.ammo === 0 ? 5 : 0); }
  updateCrates(g, dt);
  updateRemains(g, dt);
}

export const formatVampTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
