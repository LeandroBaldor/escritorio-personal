// Land of Warriors: un juego de estrategia en tiempo real (al estilo StarCraft, Warcraft o Age of Empires),
// simplificado para que sea fácil de entender y divertido.
//
// - Dos recursos: piedras (cristales azules) y diamantes (cristales dorados). Los trabajadores los juntan y los llevan
//   a la base o a un depósito.
// - Cinco construcciones por civilización: la base (hace trabajadores), el cuartel (soldados), el taller (las máquinas),
//   la torre (defiende sola) y el depósito (más población y otro lugar para dejar lo juntado).
// - Seis guerreros por civilización: trabajador, cuerpo a cuerpo, a distancia, especial (cura o hace daño en área),
//   pesado (rompe edificios) y élite.
// - Tres mejoras para todo el ejército (ataque, vida y velocidad), con tres niveles cada una.
// - Un poder especial por civilización que se carga peleando.
// - Se gana destruyendo la base del rival.
import { CIVS, type CivId } from './landCivs';
import { T, clearLine, findPath, generateTerrain, nearestWalkable, walkable, type MapSize, type Terrain } from './landMap';

// El tamaño del mundo es el del escenario de la partida (hay una sola partida a la vez).
let MW = 2900, MH = 1800, TER: Terrain | null = null;
export type Owner = 0 | 1; // 0: el jugador, 1: la computadora
export type ResKind = 'stone' | 'gem';
export type Role = 'worker' | 'melee' | 'ranged' | 'special' | 'heavy' | 'elite';
export const ROLES: Role[] = ['worker', 'melee', 'ranged', 'special', 'heavy', 'elite'];
export type BKind = 'base' | 'barracks' | 'workshop' | 'tower' | 'depot';
export const BKINDS: BKind[] = ['base', 'barracks', 'workshop', 'tower', 'depot'];
export type Upgrade = 'attack' | 'armor' | 'speed';
export const UPGRADES: Upgrade[] = ['attack', 'armor', 'speed'];
export type Difficulty = 'veryEasy' | 'easy' | 'normal' | 'hard';

export interface Cost { stone: number; gem: number }
export interface UnitStats { hp: number; dmg: number; range: number; speed: number; cool: number; sight: number; cost: Cost; time: number; pop: number; size: number; splash?: number; heal?: number; vsBuild?: number }
// Los valores base de cada tipo (cada civilización los ajusta un poco en landCivs).
export const ROLE_STATS: Record<Role, UnitStats> = {
  worker: { hp: 60, dmg: 5, range: 26, speed: 82, cool: 1.1, sight: 170, cost: { stone: 50, gem: 0 }, time: 6, pop: 1, size: 76 },
  melee: { hp: 140, dmg: 13, range: 30, speed: 80, cool: 1.0, sight: 230, cost: { stone: 80, gem: 0 }, time: 8, pop: 1, size: 90 },
  ranged: { hp: 90, dmg: 11, range: 160, speed: 74, cool: 1.15, sight: 260, cost: { stone: 70, gem: 25 }, time: 9, pop: 1, size: 90 },
  special: { hp: 90, dmg: 9, range: 140, speed: 72, cool: 1.4, sight: 260, cost: { stone: 90, gem: 60 }, time: 11, pop: 2, size: 92, splash: 60, heal: 14 },
  heavy: { hp: 380, dmg: 32, range: 180, speed: 50, cool: 2.2, sight: 270, cost: { stone: 160, gem: 100 }, time: 16, pop: 3, size: 122, splash: 55, vsBuild: 2.5 },
  elite: { hp: 760, dmg: 46, range: 70, speed: 62, cool: 1.5, sight: 280, cost: { stone: 280, gem: 200 }, time: 24, pop: 5, size: 150, splash: 40 },
};
export interface BuildStats { hp: number; cost: Cost; time: number; size: number; pop: number; makes: Role[]; needs?: BKind; dmg?: number; range?: number; cool?: number }
export const BUILD_STATS: Record<BKind, BuildStats> = {
  base: { hp: 2200, cost: { stone: 400, gem: 0 }, time: 40, size: 240, pop: 10, makes: ['worker'] },
  barracks: { hp: 1000, cost: { stone: 150, gem: 0 }, time: 18, size: 190, pop: 0, makes: ['melee', 'ranged', 'special'] },
  workshop: { hp: 1100, cost: { stone: 200, gem: 100 }, time: 24, size: 200, pop: 0, makes: ['heavy', 'elite'], needs: 'barracks' },
  tower: { hp: 700, cost: { stone: 100, gem: 50 }, time: 14, size: 132, pop: 0, makes: [], dmg: 16, range: 230, cool: 1.0 },
  depot: { hp: 500, cost: { stone: 100, gem: 0 }, time: 12, size: 150, pop: 8, makes: [] },
};
export const UPGRADE_COST = (lv: number): Cost => ({ stone: 100 * (lv + 1), gem: 60 * (lv + 1) });
export const UPGRADE_TIME = 18, MAX_UPGRADE = 3, MAX_POP = 100, POWER_MAX = 100;
export const CARRY = 8, MINE_T = 1.6;

export interface Unit {
  id: number; owner: Owner; role: Role; x: number; y: number; hp: number; maxHp: number; face: 1 | -1; path?: [number, number][]; pathFor?: [number, number]; pathT?: number;
  order: Order; cool: number; atkT: number; walk: number; carry: number; carryKind: ResKind | null; mineT: number; dead: number;
}
export type Order =
  | { k: 'idle' } | { k: 'move'; x: number; y: number; attack?: boolean } | { k: 'attack'; id: number }
  | { k: 'gather'; node: number } | { k: 'build'; id: number };
export interface Building {
  id: number; owner: Owner; kind: BKind; x: number; y: number; hp: number; maxHp: number; built: number; // built: 0…1
  queue: Role[]; qT: number; research: Upgrade | null; rT: number; rally: { x: number; y: number } | null; cool: number; dead: number;
}
export interface Node { id: number; kind: ResKind; x: number; y: number; amount: number }
export interface Shot { x: number; y: number; tx: number; ty: number; t: number; life: number; owner: Owner; kind: 'bolt' | 'heal' | 'splash' | 'slash' | 'strike' }
export interface Side { civ: CivId; stone: number; gem: number; up: Record<Upgrade, number>; power: number; buffT: number; kills: number; lost: number; gathered: number }
export interface LandGame {
  t: number; units: Unit[]; buildings: Building[]; nodes: Node[]; shots: Shot[]; sides: [Side, Side]; nextId: number;
  map: number; terrain: Terrain; difficulty: Difficulty; phase: 'play' | 'won' | 'lost'; events: LandEvent[]; ai: { t: number; wave: number; waveAt: number; attacking: boolean };
  rand: () => number;
}
export type LandEvent = { type: 'hit'; role: Role; x: number; y: number; owner: Owner } | { type: 'shot'; role: Role; x: number; y: number; owner: Owner } | { type: 'die'; x: number; y: number; owner: Owner; building: boolean }
  | { type: 'built'; kind: BKind; owner: Owner } | { type: 'trained'; role: Role; owner: Owner } | { type: 'upgraded'; up: Upgrade; owner: Owner } | { type: 'power'; owner: Owner } | { type: 'won' } | { type: 'lost' } | { type: 'attacked' };

// ---------------------------------------------------------------- Los números de cada uno (con la civilización y las mejoras)
export function unitStats(g: LandGame, owner: Owner, role: Role): UnitStats {
  const side = g.sides[owner], civ = CIVS[side.civ], base = ROLE_STATS[role], mod = civ.mod[role] ?? {};
  const s: UnitStats = { ...base, ...mod };
  const buff = side.buffT > 0 && civ.power.kind === 'rage' ? 1.5 : 1;
  return { ...s, dmg: s.dmg * (1 + 0.15 * side.up.attack) * buff, hp: s.hp * (1 + 0.15 * side.up.armor), speed: s.speed * (1 + 0.1 * side.up.speed) * (buff > 1 ? 1.25 : 1) };
}
export const specialHeals = (civ: CivId) => CIVS[civ].special === 'heal';

// ---------------------------------------------------------------- Armar una partida
// El escenario se genera con la semilla: las bases quedan en esquinas opuestas y los cristales al lado de cada base y
// en lugares parejos para los dos (en espejo).
export function newLandGame(civ: CivId, enemy: CivId, map = 1, difficulty: Difficulty = 'normal', seed = Date.now(), size: MapSize = 'medium'): LandGame {
  let s = seed % 2147483647 || 7; const rand = () => (s = (s * 48271) % 2147483647) / 2147483647;
  const terrain = generateTerrain(map - 1, size, seed % 100000); MW = terrain.w; MH = terrain.h; TER = terrain;
  const side = (c: CivId): Side => ({ civ: c, stone: 300, gem: 100, up: { attack: 0, armor: 0, speed: 0 }, power: 0, buffT: 0, kills: 0, lost: 0, gathered: 0 });
  const g: LandGame = { t: 0, units: [], buildings: [], nodes: [], shots: [], sides: [side(civ), side(enemy)], nextId: 1, map, terrain, difficulty, phase: 'play', events: [], ai: { t: 0, wave: 0, waveAt: difficulty === 'veryEasy' ? 360 : difficulty === 'easy' ? 240 : difficulty === 'hard' ? 120 : 170, attacking: false }, rand };
  terrain.bases.forEach(([c, r], o) => {
    const x = (c + 0.5) * T, y = (r + 0.5) * T, b = addBuilding(g, o as Owner, 'base', x, y); b.built = 1; b.hp = b.maxHp;
    const dir = o === 0 ? 1 : -1;
    for (let i = 0; i < 4; i++) { const [ux, uy] = nearestWalkable(terrain, x + dir * (90 + i * 36), y + dir * 120); addUnit(g, o as Owner, 'worker', ux, uy); }
    for (let k = 0; k < 5; k++) { const a = (o === 0 ? Math.PI * 0.72 : -Math.PI * 0.28) + k * 0.2, [nx, ny] = nearestWalkable(terrain, x + Math.cos(a) * 270, y + Math.sin(a) * 230); addNode(g, 'stone', nx, ny, 900); } // piedras de un lado
    for (let k = 0; k < 2; k++) { const [nx, ny] = nearestWalkable(terrain, x + dir * (260 + k * 70), y - dir * (40 - k * 60)); addNode(g, 'gem', nx, ny, 700); } // diamantes del otro
  });
  terrain.spots.forEach(([c, r], i) => {
    const x = (c + 0.5) * T, y = (r + 0.5) * T;
    for (let k = 0; k < 4; k++) { const [nx, ny] = nearestWalkable(terrain, x + (k - 1.5) * 52, y + (k % 2) * 34 - 30); addNode(g, 'stone', nx, ny, 1300); }
    if (i % 2 === 0 || terrain.spots.length < 4) { const [nx, ny] = nearestWalkable(terrain, x, y + 60); addNode(g, 'gem', nx, ny, 1000); }
  });
  return g;
}
export const worldW = () => MW, worldH = () => MH;
const flies = (g: LandGame, u: Unit) => u.role === 'elite' && (g.sides[u.owner].civ === 'elfos' || g.sides[u.owner].civ === 'nomuerta'); // (los dragones vuelan por encima de todo)
export function addUnit(g: LandGame, owner: Owner, role: Role, x: number, y: number): Unit {
  const s = unitStats(g, owner, role);
  const u: Unit = { id: g.nextId++, owner, role, x: clampX(x), y: clampY(y), hp: s.hp, maxHp: s.hp, face: owner === 0 ? 1 : -1, order: { k: 'idle' }, cool: 0, atkT: -1, walk: 0, carry: 0, carryKind: null, mineT: 0, dead: 0 };
  g.units.push(u); return u;
}
export function addBuilding(g: LandGame, owner: Owner, kind: BKind, x: number, y: number): Building {
  const s = BUILD_STATS[kind];
  const b: Building = { id: g.nextId++, owner, kind, x, y, hp: s.hp * 0.1, maxHp: s.hp, built: 0, queue: [], qT: 0, research: null, rT: 0, rally: null, cool: 0, dead: 0 };
  g.buildings.push(b); return b;
}
function addNode(g: LandGame, kind: ResKind, x: number, y: number, amount: number) { g.nodes.push({ id: g.nextId++, kind, x: clampX(x), y: clampY(y), amount }); }
const clampX = (x: number) => Math.max(30, Math.min(MW - 30, x));
const clampY = (y: number) => Math.max(40, Math.min(MH - 30, y));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const emit = (g: LandGame, e: LandEvent) => { g.events.push(e); if (g.events.length > 200) g.events.shift(); };
export function takeLandEvents(g: LandGame) { const e = g.events; g.events = []; return e; }

// ---------------------------------------------------------------- Lo que se puede pagar y la población
export const canPay = (side: Side, c: Cost) => side.stone >= c.stone && side.gem >= c.gem;
const pay = (side: Side, c: Cost) => { side.stone -= c.stone; side.gem -= c.gem; };
export function popUsed(g: LandGame, o: Owner) {
  let n = 0; for (const u of g.units) if (u.owner === o && !u.dead) n += ROLE_STATS[u.role].pop;
  for (const b of g.buildings) if (b.owner === o && !b.dead) for (const r of b.queue) n += ROLE_STATS[r].pop;
  return n;
}
export function popCap(g: LandGame, o: Owner) { let n = 0; for (const b of g.buildings) if (b.owner === o && !b.dead && b.built >= 1) n += BUILD_STATS[b.kind].pop; return Math.min(MAX_POP, n); }
export const hasBuilt = (g: LandGame, o: Owner, k: BKind) => g.buildings.some(b => b.owner === o && b.kind === k && !b.dead && b.built >= 1);

// ---------------------------------------------------------------- Órdenes (las da el jugador y la computadora)
export function orderMove(g: LandGame, ids: number[], x: number, y: number, attack = false) {
  const us = g.units.filter(u => ids.includes(u.id) && !u.dead), n = us.length, cols = Math.ceil(Math.sqrt(n));
  us.forEach((u, i) => { const ox = (i % cols - (cols - 1) / 2) * 42, oy = (Math.floor(i / cols) - (cols - 1) / 2) * 36; u.order = { k: 'move', x: clampX(x + ox), y: clampY(y + oy), attack }; }); // (en formación, para que no se amontonen)
}
// Click derecho (o tocar el mapa) con unidades elegidas: según lo que haya ahí, ataca, junta, construye o camina.
export function orderSmart(g: LandGame, ids: number[], x: number, y: number) {
  const owner = g.units.find(u => ids.includes(u.id))?.owner ?? 0;
  const foeU = g.units.find(u => u.owner !== owner && !u.dead && dist(u, { x, y }) < ROLE_STATS[u.role].size * 0.5 + 8);
  const foeB = g.buildings.find(b => b.owner !== owner && !b.dead && Math.abs(b.x - x) < BUILD_STATS[b.kind].size * 0.5 && Math.abs(b.y - y) < BUILD_STATS[b.kind].size * 0.4);
  const node = g.nodes.find(n => n.amount > 0 && dist(n, { x, y }) < 34);
  const mine = g.buildings.find(b => b.owner === owner && !b.dead && b.built < 1 && Math.abs(b.x - x) < BUILD_STATS[b.kind].size * 0.5 && Math.abs(b.y - y) < BUILD_STATS[b.kind].size * 0.4);
  const target = foeU ?? foeB;
  const rest: number[] = [];
  for (const id of ids) {
    const u = g.units.find(q => q.id === id); if (!u || u.dead) continue;
    if (target) u.order = { k: 'attack', id: target.id };
    else if (node && u.role === 'worker') u.order = { k: 'gather', node: node.id };
    else if (mine && u.role === 'worker') u.order = { k: 'build', id: mine.id };
    else rest.push(id);
  }
  if (rest.length) orderMove(g, rest, x, y);
  return target ? 'attack' : node ? 'gather' : 'move';
}
// ¿Se puede poner una construcción ahí? (adentro del mapa y sin pisar otra ni los recursos)
export function canPlace(g: LandGame, kind: BKind, x: number, y: number) {
  const s = BUILD_STATS[kind].size;
  if (x < s / 2 + 10 || x > MW - s / 2 - 10 || y < s * 0.45 + 30 || y > MH - 20) return false;
  for (let px = x - s * 0.45; px <= x + s * 0.45; px += T / 2) for (let py = y - s * 0.3; py <= y + s * 0.12; py += T / 2) if (!walkable(g.terrain, px, py)) return false; // (no sobre el agua ni las rocas)
  if (g.buildings.some(b => !b.dead && Math.abs(b.x - x) < (BUILD_STATS[b.kind].size + s) * 0.5 && Math.abs(b.y - y) < (BUILD_STATS[b.kind].size + s) * 0.36)) return false;
  return !g.nodes.some(n => n.amount > 0 && Math.abs(n.x - x) < s * 0.5 + 18 && Math.abs(n.y - y) < s * 0.36 + 16);
}
export function placeBuilding(g: LandGame, owner: Owner, kind: BKind, x: number, y: number, workers: number[]): Building | null {
  const s = BUILD_STATS[kind], side = g.sides[owner];
  if (!canPay(side, s.cost) || !canPlace(g, kind, x, y) || (s.needs && !hasBuilt(g, owner, s.needs))) return null;
  pay(side, s.cost);
  const b = addBuilding(g, owner, kind, x, y);
  for (const id of workers) { const u = g.units.find(q => q.id === id && q.role === 'worker'); if (u) u.order = { k: 'build', id: b.id }; }
  return b;
}
export function train(g: LandGame, bid: number, role: Role): boolean {
  const b = g.buildings.find(q => q.id === bid); if (!b || b.dead || b.built < 1 || !BUILD_STATS[b.kind].makes.includes(role) || b.queue.length >= 5) return false;
  const side = g.sides[b.owner], s = ROLE_STATS[role];
  if (!canPay(side, s.cost) || popUsed(g, b.owner) + s.pop > popCap(g, b.owner)) return false;
  pay(side, s.cost); b.queue.push(role); if (b.queue.length === 1) b.qT = 0;
  return true;
}
export function cancelTrain(g: LandGame, bid: number) {
  const b = g.buildings.find(q => q.id === bid); if (!b || !b.queue.length) return;
  const r = b.queue.pop()!, c = ROLE_STATS[r].cost, side = g.sides[b.owner]; side.stone += c.stone; side.gem += c.gem; if (!b.queue.length) b.qT = 0;
}
// Las mejoras se investigan en la base (y valen para todo el ejército).
export function research(g: LandGame, bid: number, up: Upgrade): boolean {
  const b = g.buildings.find(q => q.id === bid); if (!b || b.dead || b.built < 1 || b.kind !== 'base' || b.research) return false;
  const side = g.sides[b.owner], lv = side.up[up];
  if (lv >= MAX_UPGRADE || g.buildings.some(q => q.owner === b.owner && q.research === up)) return false;
  const c = UPGRADE_COST(lv); if (!canPay(side, c)) return false;
  pay(side, c); b.research = up; b.rT = 0; return true;
}
// El poder especial (cuando la barra está llena). Algunos se apuntan (x, y): una explosión en un lugar del mapa.
export function castPower(g: LandGame, owner: Owner, x?: number, y?: number): boolean {
  const side = g.sides[owner]; if (side.power < POWER_MAX) return false;
  const p = CIVS[side.civ].power;
  if (p.kind === 'strike') {
    if (x === undefined || y === undefined) return false;
    for (const u of g.units) if (u.owner !== owner && !u.dead && dist(u, { x, y }) < 170) damageUnit(g, u, 140, owner);
    for (const b of g.buildings) if (b.owner !== owner && !b.dead && dist(b, { x, y }) < 190) damageBuilding(g, b, 260, owner);
    for (let i = 0; i < 6; i++) g.shots.push({ x: x + (g.rand() - 0.5) * 220, y: y + (g.rand() - 0.5) * 160, tx: 0, ty: 0, t: -i * 0.08, life: 0.7, owner, kind: 'strike' });
  } else if (p.kind === 'heal') { for (const u of g.units) if (u.owner === owner && !u.dead) u.hp = u.maxHp; side.buffT = 1.5; }
  else side.buffT = 12; // furia (más daño y velocidad) o escudo (la mitad del daño)
  side.power = 0; emit(g, { type: 'power', owner });
  return true;
}

// ---------------------------------------------------------------- Daño
function damageUnit(g: LandGame, u: Unit, dmg: number, by: Owner) {
  const side = g.sides[u.owner];
  if (side.buffT > 0 && CIVS[side.civ].power.kind === 'shield') dmg *= 0.5;
  u.hp -= dmg; g.sides[by].power = Math.min(POWER_MAX, g.sides[by].power + dmg * 0.02);
  if (u.owner === 0 && by === 1) emit(g, { type: 'attacked' });
  if (u.hp <= 0 && !u.dead) { u.dead = 0.001; g.sides[by].kills++; side.lost++; g.sides[by].power = Math.min(POWER_MAX, g.sides[by].power + 3 + ROLE_STATS[u.role].pop * 2); emit(g, { type: 'die', x: u.x, y: u.y, owner: u.owner, building: false }); }
}
function damageBuilding(g: LandGame, b: Building, dmg: number, by: Owner) {
  b.hp -= dmg; g.sides[by].power = Math.min(POWER_MAX, g.sides[by].power + dmg * 0.01);
  if (b.owner === 0 && by === 1) emit(g, { type: 'attacked' });
  if (b.hp <= 0 && !b.dead) {
    b.dead = 0.001; b.queue = []; emit(g, { type: 'die', x: b.x, y: b.y, owner: b.owner, building: true });
    if (b.kind === 'base' && !g.buildings.some(q => q.owner === b.owner && q.kind === 'base' && !q.dead)) { g.phase = b.owner === 1 ? 'won' : 'lost'; emit(g, { type: b.owner === 1 ? 'won' : 'lost' }); }
  }
}
type Target = { kind: 'u'; u: Unit } | { kind: 'b'; b: Building };
function findTarget(g: LandGame, id: number): Target | null {
  const u = g.units.find(q => q.id === id && !q.dead); if (u) return { kind: 'u', u };
  const b = g.buildings.find(q => q.id === id && !q.dead); return b ? { kind: 'b', b } : null;
}
const tPos = (t: Target) => t.kind === 'u' ? t.u : t.b;
const tReach = (t: Target) => t.kind === 'u' ? ROLE_STATS[t.u.role].size * 0.3 : BUILD_STATS[t.b.kind].size * 0.42;
// El enemigo más cercano a la vista (primero los soldados; los edificios si no hay soldados cerca).
function nearestFoe(g: LandGame, u: { x: number; y: number }, owner: Owner, r: number): Target | null {
  let best: Target | null = null, bd = r;
  for (const q of g.units) if (q.owner !== owner && !q.dead) { const d = dist(u, q); if (d < bd) { bd = d; best = { kind: 'u', u: q }; } }
  if (best) return best;
  bd = r;
  for (const b of g.buildings) if (b.owner !== owner && !b.dead) { const d = dist(u, b) - BUILD_STATS[b.kind].size * 0.4; if (d < bd) { bd = d; best = { kind: 'b', b }; } }
  return best;
}

// ---------------------------------------------------------------- Un paso del juego
export function stepLand(g: LandGame, dt: number) {
  if (g.phase !== 'play') { for (const s of g.shots) s.t += dt; g.shots = g.shots.filter(s => s.t < s.life); return; }
  g.t += dt;
  for (const side of g.sides) { side.buffT = Math.max(0, side.buffT - dt); side.power = Math.min(POWER_MAX, side.power + dt * 0.35); } // (se carga sola despacio, y rápido peleando)
  for (const b of g.buildings) if (!b.dead) stepBuilding(g, b, dt);
  for (const u of g.units) if (!u.dead) stepUnit(g, u, dt);
  separate(g, dt);
  for (const u of g.units) if (u.dead) u.dead += dt;
  for (const b of g.buildings) if (b.dead) b.dead += dt;
  g.units = g.units.filter(u => !u.dead || u.dead < 1.2);
  g.buildings = g.buildings.filter(b => !b.dead || b.dead < 2);
  g.nodes = g.nodes.filter(n => n.amount > 0);
  for (const s of g.shots) s.t += dt; g.shots = g.shots.filter(s => s.t < s.life);
  stepAI(g, dt);
}
function stepBuilding(g: LandGame, b: Building, dt: number) {
  const s = BUILD_STATS[b.kind];
  if (b.built < 1) return; // (la levantan los trabajadores)
  if (b.queue.length) {
    b.qT += dt;
    const r = b.queue[0];
    if (b.qT >= ROLE_STATS[r].time * (b.owner === 1 ? AI_SPEED[g.difficulty] : 1)) {
      b.queue.shift(); b.qT = 0;
      const ang = g.rand() * Math.PI, [sx, sy] = nearestWalkable(g.terrain, b.x + Math.cos(ang) * s.size * 0.55, b.y + s.size * 0.3 + Math.sin(ang) * 20), u = addUnit(g, b.owner, r, sx, sy);
      if (b.rally) { const n = g.nodes.find(q => dist(q, b.rally!) < 34); u.order = n && r === 'worker' ? { k: 'gather', node: n.id } : { k: 'move', x: b.rally.x, y: b.rally.y }; }
      else if (r === 'worker') { const n = nearestNode(g, u, null); if (n) u.order = { k: 'gather', node: n.id }; }
      emit(g, { type: 'trained', role: r, owner: b.owner });
    }
  }
  if (b.research) {
    b.rT += dt;
    if (b.rT >= UPGRADE_TIME) {
      const side = g.sides[b.owner], up = b.research; side.up[up]++; b.research = null; b.rT = 0;
      if (up === 'armor') for (const u of g.units) if (u.owner === b.owner && !u.dead) { const k = (1 + 0.15 * side.up.armor) / (1 + 0.15 * (side.up.armor - 1)); u.maxHp *= k; u.hp *= k; }
      emit(g, { type: 'upgraded', up, owner: b.owner });
    }
  }
  if (b.kind === 'tower') { // la torre le tira al enemigo más cercano
    b.cool -= dt; const foe = nearestFoe(g, b, b.owner, s.range!);
    if (foe && foe.kind === 'u' && b.cool <= 0) {
      b.cool = s.cool!; const p = foe.u; g.shots.push({ x: b.x, y: b.y - s.size * 0.6, tx: p.x, ty: p.y - 20, t: 0, life: 0.25, owner: b.owner, kind: 'bolt' });
      damageUnit(g, p, s.dmg! * (1 + 0.15 * g.sides[b.owner].up.attack), b.owner); emit(g, { type: 'shot', role: 'ranged', x: b.x, y: b.y, owner: b.owner });
    }
  }
}
function nearestNode(g: LandGame, u: { x: number; y: number }, kind: ResKind | null) {
  let best: Node | null = null, bd = 1e9;
  for (const n of g.nodes) if (n.amount > 0 && (!kind || n.kind === kind)) { const d = dist(u, n) + g.units.filter(q => q.order.k === 'gather' && q.order.node === n.id).length * 60; if (d < bd) { bd = d; best = n; } } // (reparte a los trabajadores)
  return best;
}
function nearestDrop(g: LandGame, u: Unit) {
  let best: Building | null = null, bd = 1e9;
  for (const b of g.buildings) if (b.owner === u.owner && !b.dead && b.built >= 1 && (b.kind === 'base' || b.kind === 'depot')) { const d = dist(u, b); if (d < bd) { bd = d; best = b; } }
  return best;
}
function moveTo(u: Unit, x: number, y: number, speed: number, dt: number, stop = 4, fly = false) {
  const dx = x - u.x, dy = y - u.y, d = Math.hypot(dx, dy);
  if (d <= stop) return true;
  const st = Math.min(d, speed * dt), nx = clampX(u.x + dx / d * st), ny = clampY(u.y + dy / d * st);
  const ok = (a: number, b: number) => fly || !TER || walkable(TER, a, b);
  if (ok(nx, ny)) { u.x = nx; u.y = ny; } else if (ok(nx, u.y)) u.x = nx; else if (ok(u.x, ny)) u.y = ny; // (se desliza por la orilla)
  u.walk += st;
  if (Math.abs(dx) > 2) u.face = dx > 0 ? 1 : -1;
  return d - st <= stop;
}
// Ir hacia un lugar esquivando el agua y las rocas: en línea recta si se puede; si no, por el camino más corto.
function steer(g: LandGame, u: Unit, tx: number, ty: number, speed: number, dt: number, stop = 4) {
  if (dist(u, { x: tx, y: ty }) <= stop) { u.path = undefined; return true; }
  const fly = flies(g, u);
  if (fly || clearLine(g.terrain, u.x, u.y, tx, ty)) { u.path = undefined; return moveTo(u, tx, ty, speed, dt, stop, fly); }
  if (!u.path || !u.pathFor || Math.hypot(u.pathFor[0] - tx, u.pathFor[1] - ty) > T * 2 || g.t - (u.pathT ?? 0) > 3) { u.path = findPath(g.terrain, u.x, u.y, tx, ty); u.pathFor = [tx, ty]; u.pathT = g.t; }
  if (!u.path.length) return false; // Un destino aislado nunca permite atravesar obstáculos.
  while (u.path.length > 1 && (dist(u, { x: u.path[0][0], y: u.path[0][1] }) < 14 || clearLine(g.terrain, u.x, u.y, u.path[1][0], u.path[1][1]))) u.path.shift();
  moveTo(u, u.path[0][0], u.path[0][1], speed, dt, 2);
  return dist(u, { x: tx, y: ty }) <= stop;
}
function stepUnit(g: LandGame, u: Unit, dt: number) {
  const s = unitStats(g, u.owner, u.role); u.cool -= dt; if (u.atkT >= 0) { u.atkT += dt; if (u.atkT > 0.35) u.atkT = -1; }
  const o = u.order;
  // el especial que cura: si hay un amigo lastimado cerca, lo cura
  if (s.heal && specialHeals(g.sides[u.owner].civ) && u.role === 'special' && (o.k === 'idle' || (o.k === 'move' && o.attack))) {
    const hurt = g.units.filter(q => q.owner === u.owner && !q.dead && q !== u && q.hp < q.maxHp && dist(q, u) < s.sight).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (hurt) {
      if (dist(hurt, u) > s.range) steer(g, u, hurt.x, hurt.y, s.speed, dt, s.range * 0.9);
      else if (u.cool <= 0) { u.cool = s.cool; u.atkT = 0; hurt.hp = Math.min(hurt.maxHp, hurt.hp + s.heal * (1 + 0.15 * g.sides[u.owner].up.attack)); g.shots.push({ x: u.x, y: u.y - 30, tx: hurt.x, ty: hurt.y - 25, t: 0, life: 0.45, owner: u.owner, kind: 'heal' }); }
      return;
    }
  }
  if (o.k === 'idle' || (o.k === 'move' && o.attack)) { // atacan solos a lo que se acerque
    const foe = nearestFoe(g, u, u.owner, u.role === 'worker' ? 60 : s.sight);
    if (foe && !(u.role === 'worker' && foe.kind === 'b')) { u.order = { k: 'attack', id: tPos(foe).id }; if (o.k === 'move') pendingMove.set(u.id, { x: o.x, y: o.y }); return; }
    if (o.k === 'move' && steer(g, u, o.x, o.y, s.speed, dt, 6)) u.order = { k: 'idle' };
    return;
  }
  if (o.k === 'move') { if (steer(g, u, o.x, o.y, s.speed, dt, 6)) u.order = { k: 'idle' }; return; }
  if (o.k === 'attack') {
    const t = findTarget(g, o.id);
    if (!t || (t.kind === 'u' ? t.u.owner : t.b.owner) === u.owner) { const pm = pendingMove.get(u.id); pendingMove.delete(u.id); u.order = pm ? { k: 'move', ...pm, attack: true } : { k: 'idle' }; return; }
    const p = tPos(t), reach = s.range + tReach(t), d = dist(u, p);
    if (d > reach) { steer(g, u, p.x, p.y, s.speed, dt, reach * 0.92); return; }
    if (Math.abs(p.x - u.x) > 2) u.face = p.x > u.x ? 1 : -1;
    if (u.cool > 0) return;
    u.cool = s.cool; u.atkT = 0;
    const ranged = s.range > 60, dmg = s.dmg * (t.kind === 'b' ? (s.vsBuild ?? 1) * (u.role === 'worker' ? 0.3 : 1) : 1);
    const hit = (q: Target, k = 1) => q.kind === 'u' ? damageUnit(g, q.u, dmg * k, u.owner) : damageBuilding(g, q.b, dmg * k, u.owner);
    hit(t);
    const splash = u.role === 'special' && !specialHeals(g.sides[u.owner].civ) ? s.splash : u.role === 'heavy' || u.role === 'elite' ? s.splash : 0;
    if (splash) for (const q of g.units) if (q.owner !== u.owner && !q.dead && q !== (t.kind === 'u' ? t.u : null) && dist(q, p) < splash) damageUnit(g, q, dmg * 0.5, u.owner);
    g.shots.push(ranged ? { x: u.x + u.face * 14, y: u.y - ROLE_STATS[u.role].size * 0.55, tx: p.x, ty: p.y - (t.kind === 'u' ? 20 : 40), t: 0, life: 0.28, owner: u.owner, kind: splash ? 'splash' : 'bolt' } : { x: p.x, y: p.y - 20, tx: p.x, ty: p.y, t: 0, life: 0.22, owner: u.owner, kind: 'slash' });
    emit(g, { type: ranged ? 'shot' : 'hit', role: u.role, x: u.x, y: u.y, owner: u.owner });
    return;
  }
  if (o.k === 'gather') {
    if (u.carry >= CARRY) { // lleva lo juntado a la base o al depósito más cercano
      const d = nearestDrop(g, u); if (!d) { u.order = { k: 'idle' }; return; }
      if (steer(g, u, d.x, d.y, s.speed, dt, BUILD_STATS[d.kind].size * 0.45)) {
        const side = g.sides[u.owner], k = u.owner === 1 ? AI_INCOME[g.difficulty] : 1;
        if (u.carryKind === 'gem') side.gem += Math.round(u.carry * k); else side.stone += Math.round(u.carry * k);
        side.gathered += u.carry; u.carry = 0; u.carryKind = null;
      }
      return;
    }
    let n = g.nodes.find(q => q.id === o.node && q.amount > 0);
    if (!n) { n = nearestNode(g, u, u.carryKind) ?? undefined; if (!n) { u.order = { k: 'idle' }; return; } u.order = { k: 'gather', node: n.id }; }
    if (steer(g, u, n.x, n.y, s.speed, dt, 26)) {
      u.mineT += dt; u.atkT = u.mineT % 0.6 < 0.3 ? 0.1 : -1;
      if (u.mineT >= MINE_T) { const take = Math.min(CARRY, n.amount); n.amount -= take; u.carry = take; u.carryKind = n.kind; u.mineT = 0; u.atkT = -1; }
    }
    return;
  }
  if (o.k === 'build') {
    const b = g.buildings.find(q => q.id === o.id && !q.dead);
    if (!b || b.built >= 1) { u.order = { k: 'idle' }; const n = nearestNode(g, u, null); if (n && b) u.order = { k: 'gather', node: n.id }; return; }
    if (steer(g, u, b.x, b.y, s.speed, dt, BUILD_STATS[b.kind].size * 0.45)) {
      const bs = BUILD_STATS[b.kind], k = dt / (bs.time * (u.owner === 1 ? AI_SPEED[g.difficulty] : 1));
      b.built = Math.min(1, b.built + k); b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.9 * k); u.atkT = (g.t % 0.6) < 0.3 ? 0.1 : -1;
      if (b.built >= 1) { emit(g, { type: 'built', kind: b.kind, owner: b.owner }); }
    }
  }
}
const pendingMove = new Map<number, { x: number; y: number }>(); // (a dónde iban antes de pararse a pelear)
// Que no se encimen: se empujan un poquito entre ellos.
function separate(g: LandGame, dt: number) {
  const us = g.units.filter(u => !u.dead);
  for (let i = 0; i < us.length; i++) for (let j = i + 1; j < us.length; j++) {
    const a = us[i], b = us[j], r = (ROLE_STATS[a.role].size + ROLE_STATS[b.role].size) * 0.28, dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d < r && d > 0.01) { const push = (r - d) * Math.min(1, dt * 6) * 0.5, nx = dx / d, ny = dy / d, ax = clampX(a.x - nx * push), ay = clampY(a.y - ny * push), bx = clampX(b.x + nx * push), by = clampY(b.y + ny * push);
      if (flies(g, a) || walkable(g.terrain, ax, ay)) { a.x = ax; a.y = ay; } if (flies(g, b) || walkable(g.terrain, bx, by)) { b.x = bx; b.y = by; } } // (no los empuja al agua ni a las rocas)
  }
}

// ---------------------------------------------------------------- La computadora
const AI_INCOME: Record<Difficulty, number> = { veryEasy: 0.5, easy: 0.75, normal: 1, hard: 1.35 };
const AI_SPEED: Record<Difficulty, number> = { veryEasy: 1.8, easy: 1.3, normal: 1, hard: 0.8 }; // (tiempos de producción)
function stepAI(g: LandGame, dt: number) {
  const ai = g.ai; ai.t -= dt; if (ai.t > 0) return; ai.t = 1;
  const o: Owner = 1, side = g.sides[1], base = g.buildings.find(b => b.owner === o && b.kind === 'base' && !b.dead);
  if (!base) return;
  const mine = g.units.filter(u => u.owner === o && !u.dead), workers = mine.filter(u => u.role === 'worker'), army = mine.filter(u => u.role !== 'worker');
  const bs = (k: BKind) => g.buildings.filter(b => b.owner === o && b.kind === k && !b.dead);
  // trabajadores ociosos: a juntar
  for (const w of workers) if (w.order.k === 'idle') { const n = nearestNode(g, w, workers.indexOf(w) % 4 === 0 ? 'gem' : 'stone'); if (n) w.order = { k: 'gather', node: n.id }; }
  if (workers.length < 10 && base.queue.length < 2) train(g, base.id, 'worker');
  const place = (k: BKind) => { // al lado de la base, buscando un lugar libre
    for (let tries = 0; tries < 30; tries++) {
      const a = g.rand() * Math.PI * 2, r = 180 + g.rand() * 200, x = base.x + Math.cos(a) * r, y = base.y + Math.sin(a) * r * 0.8;
      if (canPlace(g, k, x, y)) { const w = workers.find(q => q.carry === 0) ?? workers[0]; if (w) placeBuilding(g, o, k, x, y, [w.id]); return; }
    }
  };
  const building = g.buildings.some(b => b.owner === o && !b.dead && b.built < 1);
  if (!building) {
    if (popUsed(g, o) + 4 >= popCap(g, o) && popCap(g, o) < MAX_POP && canPay(side, BUILD_STATS.depot.cost)) place('depot');
    else if (!bs('barracks').length && g.t > 25 && canPay(side, BUILD_STATS.barracks.cost)) place('barracks');
    else if (bs('barracks').length && !bs('workshop').length && g.t > 140 && canPay(side, BUILD_STATS.workshop.cost)) place('workshop');
    else if (bs('tower').length < (g.difficulty === 'veryEasy' ? 0 : g.difficulty === 'easy' ? 1 : 2) && g.t > 90 && canPay(side, BUILD_STATS.tower.cost)) place('tower');
    else if (bs('barracks').length < 2 && g.t > 260 && canPay(side, BUILD_STATS.barracks.cost)) place('barracks');
  }
  for (const b of bs('barracks')) if (b.queue.length < 2) { const r: Role = g.rand() < 0.45 ? 'melee' : g.rand() < 0.7 ? 'ranged' : 'special'; train(g, b.id, r); }
  for (const b of bs('workshop')) if (b.queue.length < 1) train(g, b.id, g.rand() < 0.75 || g.t < 400 ? 'heavy' : 'elite');
  if (!base.research && g.t > 200) { const up = UPGRADES[Math.floor(g.rand() * 3)]; research(g, base.id, up); }
  // defenderse: si hay enemigos cerca de la base, todo el ejército va
  const intruder = g.units.find(u => u.owner === 0 && !u.dead && dist(u, base) < 520);
  if (intruder) { for (const u of army) if (u.order.k !== 'attack') u.order = { k: 'attack', id: intruder.id }; }
  // las oleadas: cada vez con más soldados
  const need = (g.difficulty === 'veryEasy' ? 3 : 4) + ai.wave * 3;
  if (g.t >= ai.waveAt && army.length >= need) {
    const target = g.buildings.find(b => b.owner === 0 && b.kind === 'base' && !b.dead) ?? g.buildings.find(b => b.owner === 0 && !b.dead);
    if (target) orderMove(g, army.map(u => u.id), target.x, target.y, true);
    ai.wave++; ai.waveAt = g.t + (g.difficulty === 'veryEasy' ? 190 : g.difficulty === 'hard' ? 70 : g.difficulty === 'easy' ? 130 : 95);
  }
  if (side.power >= POWER_MAX) { // usa su poder cuando le conviene
    const kind = CIVS[side.civ].power.kind, fight = army.some(u => u.order.k === 'attack');
    if (kind === 'strike') { const foe = g.units.find(u => u.owner === 0 && !u.dead && army.some(a => dist(a, u) < 300)); if (foe) castPower(g, o, foe.x, foe.y); }
    else if (fight) castPower(g, o);
  }
}
export function formatLandTime(s: number) { const m = Math.floor(s / 60), r = Math.floor(s % 60); return `${m}:${r.toString().padStart(2, '0')}`; }
