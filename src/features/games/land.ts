import {UNIT_TRAINING_SECONDS,formationSpacing,bodyRadius,pairDirection,resourceReach} from './landTactics';
import {LandUnitIndex} from './landSpatial';
import {resolveLandOptions,mineralMultiplier,type LandOptions} from './landOptions';
import {LEVEL_HEALTH,LEVEL_DAMAGE,LEVEL_SPEED,LEVEL_RANGE,LEVEL_CADENCE,levelIndex,unitScale,affordableTrainingCost,PRODUCTION_TIME,CONSTRUCTION_TIME,STRUCTURE_HEALTH,STRUCTURE_PROTECTION,MAX_STRUCTURE_LEVEL,structureUpgradeCost,structureUpgradeTime,type StructureUpgrade} from './landBalance';
// Land of Warriors: un juego de estrategia en tiempo real (al estilo StarCraft, Warcraft o Age of Empires),
// simplificado para que sea fácil de entender y divertido.
//
// - Cristales azules, dorados, energía verde y piedras. Los trabajadores los juntan y los llevan
//   a la base o a un depósito.
// - Seis cuarteles exclusivos, uno por personaje; base, torre, depósito y muros defensivos.
// - Seis guerreros por civilización: trabajador, cuerpo a cuerpo, a distancia, especial (cura o hace daño en área),
//   pesado (rompe edificios) y élite.
// - Cuatro evoluciones por personaje, investigadas en su cuartel; cosechas y Almacén para alimentar tropas.
// - Un poder especial por civilización que se carga peleando.
// - Se gana destruyendo todos los centros de mando rivales.
import {FOOD_CAPACITY,FOOD_WEIGHT,HARVEST_TIME,HARVEST_YIELD,foodRate,foodBlocked,evolutionLevel,evolutionTime,evolutionCost,MAX_EVOLUTION} from './landProvision';
import { CIVS, TRAINING_KIND, TRAINING_ROLE, type CivId } from './landCivs';
import { T, clearLine, findPath, generateTerrain, nearestWalkable, walkable, type MapSize, type Terrain } from './landMap';
import { WALL_SIZE, wallAcross, wallNavigation, wallPoint } from './landWalls';
import {stepGatherPose} from './landGatherPose';

// El tamaño del mundo es el del escenario de la partida (hay una sola partida a la vez).
let MW = 2900, MH = 1800, TER: Terrain | null = null;
export type Owner = number; // 0: jugador; 1…9: civilizaciones controladas por la computadora
export type ResKind = 'stone' | 'gem' | 'energy' | 'rock';
export type Role = 'worker' | 'melee' | 'ranged' | 'special' | 'heavy' | 'elite';
export const ROLES: Role[] = ['worker', 'melee', 'ranged', 'special', 'heavy', 'elite'];
export type BKind = 'base' | 'barracks' | 'workshop' | 'tower' | 'depot' | 'wall' | 'workerBarracks' | 'rangedBarracks' | 'specialBarracks' | 'eliteBarracks' | 'farm' | 'storehouse';
export const BKINDS: BKind[] = ['base', 'workerBarracks', 'barracks', 'rangedBarracks', 'specialBarracks', 'workshop', 'eliteBarracks', 'tower', 'depot', 'wall', 'farm', 'storehouse'];
export type Difficulty = 'veryEasy' | 'easy' | 'normal' | 'hard';

export interface Cost { stone: number; gem: number; energy?: number; rock?:number }
export interface UnitStats { hp: number; dmg: number; range: number; speed: number; cool: number; sight: number; cost: Cost; time: number; pop: number; size: number; splash?: number; heal?: number; vsBuild?: number }
// Los valores base de cada tipo (cada civilización los ajusta un poco en landCivs).
export const ROLE_STATS: Record<Role, UnitStats> = {
  worker: { hp: 60, dmg: 5, range: 26, speed: 82, cool: 1.1, sight: 170, cost: { stone: 50, gem: 0 }, time: 60, pop: 1, size: 76 },
  melee: { hp: 140, dmg: 13, range: 30, speed: 80, cool: 1.0, sight: 230, cost: { stone: 80, gem: 0 }, time: 60, pop: 1, size: 90 },
  ranged: { hp: 90, dmg: 11, range: 160, speed: 74, cool: 1.15, sight: 260, cost: { stone: 70, gem: 25 }, time: 60, pop: 1, size: 90 },
  special: { hp: 90, dmg: 9, range: 140, speed: 72, cool: 1.4, sight: 260, cost: { stone: 90, gem: 60 }, time: 60, pop: 2, size: 92, splash: 60, heal: 14 },
  heavy: { hp: 380, dmg: 32, range: 180, speed: 50, cool: 2.2, sight: 270, cost: { stone: 160, gem: 100 }, time: 60, pop: 3, size: 122, splash: 55, vsBuild: 2.5 },
  elite: { hp: 760, dmg: 46, range: 70, speed: 62, cool: 1.5, sight: 280, cost: { stone: 280, gem: 200, energy: 40 }, time: 60, pop: 5, size: 150, splash: 40 },
};
export interface BuildStats { hp: number; cost: Cost; time: number; size: number; pop: number; makes: Role[]; needs?: BKind; dmg?: number; range?: number; cool?: number }
export const BUILD_STATS: Record<BKind, BuildStats> = {
  base: { hp: 2200, cost: { stone: 400, gem: 0 }, time: 40, size: 240, pop: 24, makes: ['worker'] },
  workerBarracks: { hp: 850, cost: { stone: 100, gem: 0 }, time: 14, size: 170, pop: 0, makes: ['worker'] },
  barracks: { hp: 1000, cost: { stone: 150, gem: 0 }, time: 18, size: 190, pop: 0, makes: ['melee'] },
  rangedBarracks: { hp: 1000, cost: { stone: 150, gem: 25 }, time: 20, size: 190, pop: 0, makes: ['ranged'], needs: 'barracks' },
  specialBarracks: { hp: 1000, cost: { stone: 180, gem: 60 }, time: 22, size: 190, pop: 0, makes: ['special'], needs: 'rangedBarracks' },
  workshop: { hp: 1100, cost: { stone: 200, gem: 100 }, time: 24, size: 200, pop: 0, makes: ['heavy'], needs: 'barracks' },
  eliteBarracks: { hp: 1200, cost: { stone: 240, gem: 120 }, time: 28, size: 200, pop: 0, makes: ['elite'], needs: 'workshop' },
  tower: { hp: 700, cost: { stone: 100, gem: 50 }, time: 14, size: 132, pop: 0, makes: [], dmg: 16, range: 230, cool: 1.0 },
  depot: { hp: 500, cost: { stone: 100, gem: 0 }, time: 12, size: 150, pop: 20, makes: [] },
  farm:{hp:320,cost:{stone:35,gem:0},time:10,size:120,pop:0,makes:[]},
  storehouse:{hp:850,cost:{stone:90,gem:0},time:18,size:160,pop:0,makes:[]},
  wall: { hp: 1400, cost: { stone: 35, gem: 0 }, time: 8, size: WALL_SIZE, pop: 0, makes: [] },
};
for(const kind of BKINDS)BUILD_STATS[kind].cost.rock=Math.ceil(BUILD_STATS[kind].cost.stone*.4);
export const MAX_POP = 3000, POWER_MAX = 100;
export const CARRY = 14, MINE_T = 1.6;

export interface Unit {
  id: number; owner: Owner; role: Role; x: number; y: number; hp: number; maxHp: number; face: 1 | -1; path?: [number, number][]; pathFor?: [number, number]; pathT?: number;
  order: Order; cool: number; atkT: number; walk: number; moving?: boolean;kneel?:number; carry: number; carryKind: ResKind | 'food' | null; mineT: number; dead: number; defensive?: boolean; buildQueue?: number[];
}
export type Order =
  | { k: 'idle' } | { k: 'move'; x: number; y: number; attack?: boolean } | { k: 'attack'; id: number }
  | {k:'farm';id:number} | { k: 'gather'; node: number } | { k: 'build'; id: number };
export interface Building {
  id: number; owner: Owner; kind: BKind; x: number; y: number; hp: number; maxHp: number; built: number; // built: 0…1
  infrastructureResearch:{kind:StructureUpgrade;elapsed:number}|null; evolving?:boolean; queue: Role[]; qT: number; rT: number; rally: { x: number; y: number } | null; cool: number; dead: number;lastHitBy?:Owner;
}
export interface Node { id: number; kind: ResKind; x: number; y: number; amount: number }
export interface Shot { x: number; y: number; tx: number; ty: number; t: number; life: number; owner: Owner; kind: 'bolt' | 'heal' | 'splash' | 'slash' | 'strike' }
export interface Side { civ: CivId; rock:number; food:number; levels:Record<Role,number>; infrastructure:Record<StructureUpgrade,number>; stone: number; gem: number; energy: number; power: number; buffT: number; kills: number; lost: number; gathered: number }
export interface AIState { t: number; wave: number; waveAt: number; attacking: boolean }
export const AI_PREPARE: Record<Difficulty, number> = { veryEasy: 660, easy: 600, normal: 540, hard: 480 };
export interface LandGame {
  populationLimit:LandOptions['populationLimit'];mineralAbundance:LandOptions['mineralAbundance']; t: number; units: Unit[]; buildings: Building[]; nodes: Node[]; shots: Shot[]; sides: Side[]; nextId: number;
  map: number; terrain: Terrain; difficulty: Difficulty; phase: 'play' | 'won' | 'lost'; events: LandEvent[]; ai: AIState; ais: AIState[];
  rand: () => number;
}
export type LandEvent = { type: 'hit'; role: Role; x: number; y: number; owner: Owner } | { type: 'shot'|'spell'; role: Role; x: number; y: number; owner: Owner } | { type: 'impact'; x:number;y:number;owner:Owner } | { type: 'die'; x: number; y: number; owner: Owner; building: boolean; by?:Owner }
  | { type: 'built'; kind: BKind; owner: Owner;x?:number;y?:number } | { type: 'trained'; role: Role; owner: Owner;x?:number;y?:number } | { type: 'upgraded'; owner: Owner; role:Role;level:number } | {type:'infrastructure';owner:Owner;kind:StructureUpgrade;level:number} | { type: 'power'; owner: Owner } | { type: 'won' } | { type: 'lost' } | { type: 'attacked' };

// ---------------------------------------------------------------- Los números de cada uno (con la civilización y las mejoras)
export function unitStats(g: LandGame, owner: Owner, role: Role,levelOverride?:number): UnitStats {
  const side = g.sides[owner], civ = CIVS[side.civ], base = ROLE_STATS[role], mod = civ.mod[role] ?? {};
  const s: UnitStats = { ...base, ...mod, cost: { ...base.cost, ...mod.cost } };
  const level=levelIndex(levelOverride??evolutionLevel(g,owner,role));
  const buff = side.buffT > 0 && civ.power.kind === 'rage' ? 1.5 : 1;
  return {...s,time:UNIT_TRAINING_SECONDS,cost:affordableTrainingCost(s.cost),dmg:s.dmg*LEVEL_DAMAGE[level]*buff,hp:s.hp*LEVEL_HEALTH[level],cool:s.cool/LEVEL_CADENCE[level],heal:s.heal?s.heal*LEVEL_DAMAGE[level]:undefined,size:s.size*unitScale(side.civ,role,level),range:s.range*LEVEL_RANGE[level],speed:s.speed*LEVEL_SPEED[level]*(buff>1?1.25:1)};
}
export const specialHeals = (civ: CivId) => CIVS[civ].special === 'heal';

// ---------------------------------------------------------------- Armar una partida
// El escenario se genera con la semilla: las bases quedan en esquinas opuestas y los cristales al lado de cada base y
// en lugares parejos para los dos (en espejo).
export function newLandGame(civ: CivId, enemy: CivId | CivId[], map = 1, difficulty: Difficulty = 'normal', seed = Date.now(), size: MapSize = 'medium', options:Partial<LandOptions>={}): LandGame {
  let s = seed % 2147483647 || 7; const rand = () => (s = (s * 48271) % 2147483647) / 2147483647;
  const enemies = (Array.isArray(enemy) ? enemy : [enemy]).slice(0, 9);
  if (!enemies.length) enemies.push(civ === 'orcos' ? 'humano' : 'orcos');
  const roster = [civ, ...enemies];
  const terrain = generateTerrain(map - 1, size, seed % 100000, roster.length); MW = terrain.w; MH = terrain.h; TER = terrain;
  const side = (c: CivId): Side => ({ civ: c,rock:350,food:FOOD_CAPACITY,levels:{worker:1,melee:1,ranged:1,special:1,heavy:1,elite:1},infrastructure:{production:0,fortification:0}, stone: 500, gem: 200, energy: 0, power: 0, buffT: 0, kills: 0, lost: 0, gathered: 0 });
  const ais = enemies.map(() => ({ t: 0, wave: 0, waveAt: AI_PREPARE[difficulty], attacking: false }));
  const g: LandGame = { ...resolveLandOptions(options), t: 0, units: [], buildings: [], nodes: [], shots: [], sides: roster.map(side), nextId: 1, map, terrain, difficulty, phase: 'play', events: [], ai: ais[0], ais, rand };
  terrain.bases.forEach(([c, r], o) => {
    const x = (c + 0.5) * T, y = (r + 0.5) * T, b = addBuilding(g, o as Owner, 'base', x, y); b.built = 1; b.hp = b.maxHp;
    const dir = x < terrain.w / 2 ? 1 : -1;
    for (let i = 0; i < 4; i++) { const [ux, uy] = nearestWalkable(terrain, x + dir * (145 + i%2*80), y + dir * (130 + Math.floor(i/2)*75)); addUnit(g, o as Owner, 'worker', ux, uy); }
    for (let k = 0; k < 5; k++) { const a = (o === 0 ? Math.PI * 0.72 : -Math.PI * 0.28) + k * 0.2, [nx, ny] = nearestWalkable(terrain, x + Math.cos(a) * 270, y + Math.sin(a) * 230); addNode(g, 'stone', nx, ny, 900); } // piedras de un lado
    for (let k = 0; k < 2; k++) { const [nx, ny] = nearestWalkable(terrain, x + dir * (260 + k * 70), y - dir * (40 - k * 60)); addNode(g, 'gem', nx, ny, 700); } // diamantes del otro
    for(let k=0;k<3;k++){const [rx,ry]=nearestWalkable(terrain,x-dir*(180+k*65),y+dir*180);addNode(g,'rock',rx,ry,1500);}
    const [ex, ey] = nearestWalkable(terrain, x - dir * 220, y - 80); addNode(g, 'energy', ex, ey, 800);
  });
  terrain.spots.forEach(([c, r], i) => {
    const x = (c + 0.5) * T, y = (r + 0.5) * T;
    const [rx,ry]=nearestWalkable(terrain,x-110,y+110);addNode(g,'rock',rx,ry,2000);
    for (let k = 0; k < 4; k++) { const [nx, ny] = nearestWalkable(terrain, x + (k - 1.5) * 52, y + (k % 2) * 34 - 30); addNode(g, 'stone', nx, ny, 1300); }
    const [ex, ey] = nearestWalkable(terrain, x + 90, y + 90); addNode(g, 'energy', ex, ey, 1200);
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
  const s = buildingStats(g,owner,kind);
  const b: Building = { id: g.nextId++, owner, kind, x, y, hp: s.hp * 0.1, maxHp: s.hp, built: 0,infrastructureResearch:null, queue: [], qT: 0, rT: 0, rally: null, cool: 0, dead: 0 };
  g.buildings.push(b); return b;
}
function addNode(g: LandGame, kind: ResKind, x: number, y: number, amount: number) { g.nodes.push({ id: g.nextId++, kind, x: clampX(x), y: clampY(y), amount:Math.round(amount*mineralMultiplier(g.mineralAbundance)) }); }
const clampX = (x: number) => Math.max(30, Math.min(MW - 30, x));
const clampY = (y: number) => Math.max(40, Math.min(MH - 30, y));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const emit = (g: LandGame, e: LandEvent) => { g.events.push(e); if (g.events.length > 200) g.events.shift(); };
export function takeLandEvents(g: LandGame) { const e = g.events; g.events = []; return e; }

// ---------------------------------------------------------------- Lo que se puede pagar y la población
export const canPay = (side: Side, c: Cost) => side.stone >= c.stone && side.gem >= c.gem && side.energy >= (c.energy ?? 0) && side.rock >= (c.rock??0);
const pay = (side: Side, c: Cost) => { side.stone -= c.stone; side.gem -= c.gem; side.energy -= c.energy ?? 0; side.rock-=c.rock??0; };
export function popUsed(g: LandGame, o: Owner) {
  let n = 0; for (const u of g.units) if (u.owner === o && !u.dead) n += ROLE_STATS[u.role].pop;
  for (const b of g.buildings) if (b.owner === o && !b.dead) for (const r of b.queue) n += ROLE_STATS[r].pop;
  return n;
}
export function popCap(g: LandGame, o: Owner) { let n = 0; for (const b of g.buildings) if (b.owner === o && !b.dead && b.built >= 1) n += BUILD_STATS[b.kind].pop; return Math.min(g.populationLimit, n); }
export const hasBuilt = (g: LandGame, o: Owner, k: BKind) => g.buildings.some(b => b.owner === o && b.kind === k && !b.dead && b.built >= 1);

// ---------------------------------------------------------------- Órdenes (las da el jugador y la computadora)
export function orderMove(g: LandGame, ids: number[], x: number, y: number, attack = false) {
  const selected=new Set(ids),us=g.units.filter(u=>selected.has(u.id)&&!u.dead);if(!us.length)return;const n = us.length, cols = Math.ceil(Math.sqrt(n)),spacing=Math.min(Math.max(64,...us.map(u=>formationSpacing(unitStats(g,u.owner,u.role).size))), (MW-80)/Math.max(1,cols-1),(MH-80)/Math.max(1,(Math.ceil(n/cols)-1)*.92));
  const rows=Math.ceil(n/cols),hx=(cols-1)*spacing/2,hy=(rows-1)*spacing*.92/2;x=Math.max(hx+30,Math.min(MW-hx-30,x));y=Math.max(hy+30,Math.min(MH-hy-30,y));
  us.forEach((u, i) => { const ox = (i % cols - (cols - 1) / 2) * spacing, oy = (Math.floor(i / cols) - (rows - 1) / 2) * spacing*.92; u.order = { k: 'move', x: clampX(x + ox), y: clampY(y + oy), attack }; }); // (en formación, para que no se amontonen)
}
// Click derecho (o tocar el mapa) con unidades elegidas: según lo que haya ahí, ataca, junta, construye o camina.
export function orderSmart(g: LandGame, ids: number[], x: number, y: number) {
  const owner = g.units.find(u => ids.includes(u.id))?.owner ?? 0;
  const foeU = g.units.find(u => u.owner !== owner && !u.dead && dist(u, { x, y }) < unitStats(g,u.owner,u.role).size * 0.5 + 8);
  const foeB = g.buildings.find(b => b.owner !== owner && !b.dead && Math.abs(b.x - x) < BUILD_STATS[b.kind].size * 0.5 && Math.abs(b.y - y) < BUILD_STATS[b.kind].size * 0.4);
  const node = g.nodes.find(n => n.amount > 0 && dist(n, { x, y }) < 34);
  const mine = g.buildings.find(b => b.owner === owner && !b.dead && b.built < 1 && Math.abs(b.x - x) < BUILD_STATS[b.kind].size * 0.5 && Math.abs(b.y - y) < BUILD_STATS[b.kind].size * 0.4);
  const farm=g.buildings.find(b=>b.owner===owner&&!b.dead&&b.built>=1&&b.kind==='farm'&&dist(b,{x,y})<65);
  const target = foeU ?? foeB;
  const rest: number[] = [];
  for (const id of ids) {
    const u = g.units.find(q => q.id === id); if (!u || u.dead) continue;
    if (target) u.order = { k: 'attack', id: target.id };
    else if(farm&&u.role==='worker'){assignFarm(g,u.id,farm.id);}
    else if (node && u.role === 'worker') u.order = { k: 'gather', node: node.id };
    else if (mine && u.role === 'worker') u.order = { k: 'build', id: mine.id };
    else rest.push(id);
  }
  if (rest.length) orderMove(g, rest, x, y);
  return target ? 'attack' : node ? 'gather' : 'move';
}
// ¿Se puede poner una construcción ahí? (adentro del mapa y sin pisar otra ni los recursos)
export function canPlace(g: LandGame, kind: BKind, x: number, y: number) {
  if (kind === 'wall') ({ x, y } = wallPoint(x, y));
  const s = BUILD_STATS[kind].size;
  if (x < s / 2 + 10 || x > MW - s / 2 - 10 || y < s * 0.45 + 30 || y > MH - 20) return false;
  for (let px = x - s * 0.45; px <= x + s * 0.45; px += T / 2) for (let py = y - s * 0.3; py <= y + s * 0.12; py += T / 2) if (!walkable(g.terrain, px, py)) return false; // (no sobre el agua ni las rocas)
  if (kind === 'wall') {
    for (const dx of [-T/2,T/2]) for (const dy of [-T/2,T/2]) if (!walkable(g.terrain,x+dx,y+dy)) return false;
    if (g.units.some(u => !u.dead && Math.abs(u.x-x)<WALL_SIZE/2 && Math.abs(u.y-y)<WALL_SIZE/2)) return false;
  }
  if (g.buildings.some(b => !b.dead && Math.abs(b.x - x) < (BUILD_STATS[b.kind].size + s) * 0.5 && Math.abs(b.y - y) < (BUILD_STATS[b.kind].size + s) * 0.36)) return false;
  return !g.nodes.some(n => n.amount > 0 && Math.abs(n.x - x) < s * 0.5 + 18 && Math.abs(n.y - y) < s * 0.36 + 16);
}
export function placeBuilding(g: LandGame, owner: Owner, kind: BKind, x: number, y: number, workers: number[]): Building | null {
  if (kind === 'wall') ({ x, y } = wallPoint(x, y));
  const builders = g.units.filter(u => workers.includes(u.id) && u.owner === owner && u.role === 'worker' && !u.dead);
  if (!builders.length) return null;
  const s = BUILD_STATS[kind], side = g.sides[owner];
  if (!canPay(side, s.cost) || !canPlace(g, kind, x, y) || (s.needs && !hasBuilt(g, owner, s.needs))) return null;
  pay(side, s.cost);
  const b = addBuilding(g, owner, kind, x, y);
  for (const u of builders) {
    if (kind === 'wall' && u.order.k === 'build') (u.buildQueue ??= []).push(b.id);
    else { u.buildQueue = []; u.order = { k: 'build', id: b.id }; }
  }
  return b;
}
export function train(g: LandGame, bid: number, role: Role): boolean {
  const b = g.buildings.find(q => q.id === bid); if (!b || b.dead || b.built < 1 || !BUILD_STATS[b.kind].makes.includes(role) || b.queue.length >= 5) return false;
  const side = g.sides[b.owner], s = unitStats(g, b.owner, role);
  if (!canPay(side, s.cost) || popUsed(g, b.owner) + s.pop > popCap(g, b.owner)) return false;
  pay(side, s.cost); b.queue.push(role); if (b.queue.length === 1) b.qT = 0;
  return true;
}
export function cancelTrain(g: LandGame, bid: number) {
  const b = g.buildings.find(q => q.id === bid); if (!b || !b.queue.length) return;
  const r = b.queue.pop()!, c = unitStats(g, b.owner, r).cost, side = g.sides[b.owner]; side.stone += c.stone; side.gem += c.gem; side.energy += c.energy ?? 0;side.rock+=c.rock??0; if (!b.queue.length) b.qT = 0;
}
// Cada cuartel investiga las cuatro evoluciones de su propio personaje.
export function researchEvolution(g:LandGame,bid:number):boolean{
 const b=g.buildings.find(q=>q.id===bid&&!q.dead);if(!b||b.built<1||b.evolving)return false;
 const role=TRAINING_ROLE[b.kind];if(!role)return false;
 const level=evolutionLevel(g,b.owner,role);if(level>=MAX_EVOLUTION||g.buildings.some(q=>q.owner===b.owner&&!q.dead&&q.kind===b.kind&&q.evolving))return false;
 const cost=evolutionCost(level,role);if(!canPay(g.sides[b.owner],cost))return false;
 pay(g.sides[b.owner],cost);b.evolving=true;b.rT=0;return true;
}
export function buildingStats(g:LandGame,owner:Owner,kind:BKind):BuildStats{const up=g.sides[owner].infrastructure,s=BUILD_STATS[kind];return {...s,hp:s.hp*STRUCTURE_HEALTH[up.fortification],time:s.time*CONSTRUCTION_TIME[up.production]};}
export function trainingDuration(g:LandGame,owner:Owner,role:Role){return unitStats(g,owner,role).time*PRODUCTION_TIME[g.sides[owner].infrastructure.production];}
export function researchInfrastructure(g:LandGame,bid:number,kind:StructureUpgrade){const b=g.buildings.find(q=>q.id===bid&&!q.dead&&q.built>=1&&q.kind==='base');if(!b||g.buildings.some(q=>q.owner===b.owner&&!q.dead&&q.infrastructureResearch))return false;const side=g.sides[b.owner],level=side.infrastructure[kind];if(level>=MAX_STRUCTURE_LEVEL)return false;const cost=structureUpgradeCost(kind,level);if(!canPay(side,cost))return false;pay(side,cost);b.infrastructureResearch={kind,elapsed:0};return true;}
export function assignFarm(g:LandGame,uid:number,bid:number){
 const u=g.units.find(q=>q.id===uid&&!q.dead&&q.role==='worker'),b=g.buildings.find(q=>q.id===bid&&!q.dead&&q.built>=1&&q.kind==='farm');
 if(!u||!b||u.owner!==b.owner||g.units.some(q=>!q.dead&&q.id!==uid&&q.order.k==='farm'&&q.order.id===bid))return false;
 u.order={k:'farm',id:bid};u.mineT=0;return true;
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
  if (u.owner === 0 && by > 0) emit(g, { type: 'attacked' });
  if (u.hp <= 0 && !u.dead) { u.dead = 0.001; g.sides[by].kills++; side.lost++; g.sides[by].power = Math.min(POWER_MAX, g.sides[by].power + 3 + ROLE_STATS[u.role].pop * 2); emit(g, { type: 'die', x: u.x, y: u.y, owner: u.owner, building: false,by }); }
}
function damageBuilding(g: LandGame, b: Building, dmg: number, by: Owner) {
  b.lastHitBy=by;
  emit(g,{type:'impact',x:b.x,y:b.y,owner:by});
  dmg*=1-STRUCTURE_PROTECTION[g.sides[b.owner].infrastructure.fortification];
  b.hp -= dmg; g.sides[by].power = Math.min(POWER_MAX, g.sides[by].power + dmg * 0.01);
  if (b.owner === 0 && by > 0) emit(g, { type: 'attacked' });
  if (b.hp <= 0 && !b.dead) {
    b.dead = 0.001; b.queue = []; emit(g, { type: 'die', x: b.x, y: b.y, owner: b.owner, building: true });
    if (b.kind === 'base') {
      const alive = g.buildings.filter(q => q.kind === 'base' && !q.dead);
      if (!alive.some(q => q.owner === 0)) { g.phase = 'lost'; emit(g, { type: 'lost' }); }
      else if (!alive.some(q => q.owner !== 0)) { g.phase = 'won'; emit(g, { type: 'won' }); }
    }
  }
}
type Target = { kind: 'u'; u: Unit } | { kind: 'b'; b: Building };
const stepIndexes=new WeakMap<LandGame,LandUnitIndex>();
function nearbyUnits(g:LandGame,p:{x:number;y:number},r:number){return stepIndexes.get(g)?.near(p.x,p.y,r)??g.units;}
function findTarget(g: LandGame, id: number): Target | null {
  const u = stepIndexes.get(g)?.byId.get(id)??g.units.find(q => q.id === id && !q.dead); if (u&&!u.dead) return { kind: 'u', u };
  const b = g.buildings.find(q => q.id === id && !q.dead); return b ? { kind: 'b', b } : null;
}
const tPos = (t: Target) => t.kind === 'u' ? t.u : t.b;
const tReach = (g:LandGame,t: Target) => t.kind === 'u' ? unitStats(g,t.u.owner,t.u.role).size * 0.3 : BUILD_STATS[t.b.kind].size * 0.42;
// El enemigo más cercano a la vista (primero los soldados; los edificios si no hay soldados cerca).
function nearestFoe(g: LandGame, u: { x: number; y: number }, owner: Owner, r: number): Target | null {
  let best: Target | null = null, bd = r;
  for (const q of nearbyUnits(g,u,r)) if (q.owner !== owner && !q.dead) { const d = dist(u, q); if (d < bd) { bd = d; best = { kind: 'u', u: q }; } }
  if (best) return best;
  bd = r;
  for (const b of g.buildings) if (b.owner !== owner && !b.dead) { const d = dist(u, b) - BUILD_STATS[b.kind].size * 0.4; if (d < bd) { bd = d; best = { kind: 'b', b }; } }
  return best;
}

// ---------------------------------------------------------------- Un paso del juego
export function stepLand(g: LandGame, dt: number) {
  if (g.phase !== 'play') { advanceDeaths(g,dt); for (const s of g.shots) s.t += dt; g.shots = g.shots.filter(s => s.t < s.life); return; }
  TER = wallNavigation(g);
  g.t += dt;
  for (const side of g.sides) { side.food=Math.max(0,side.food-foodRate(g,g.sides.indexOf(side))*dt/60);side.buffT = Math.max(0, side.buffT - dt); side.power = Math.min(POWER_MAX, side.power + dt * 0.35); } // (se carga sola despacio, y rápido peleando)
  for (const b of g.buildings) if (!b.dead) stepBuilding(g, b, dt);
  const unitIndex=new LandUnitIndex(g.units);stepIndexes.set(g,unitIndex);
  for (const u of g.units) if (!u.dead){stepUnit(g, u, dt);stepGatherPose(g,u,dt);unitIndex.move(u);}
  stepIndexes.delete(g);
  separate(g, dt);
  advanceDeaths(g,dt);
  g.nodes = g.nodes.filter(n => n.amount > 0);
  for (const s of g.shots) s.t += dt; g.shots = g.shots.filter(s => s.t < s.life);
  for (let owner = 1; owner < g.sides.length; owner++) stepAI(g, dt, owner);
}
function advanceDeaths(g: LandGame, dt: number) {
  for (const u of g.units) if (u.dead) u.dead += dt;
  for (const b of g.buildings) if (b.dead) b.dead += dt;
  g.units = g.units.filter(u => !u.dead || u.dead < 2.4);
  g.buildings = g.buildings.filter(b => !b.dead || b.dead < 2);
}
function stepBuilding(g: LandGame, b: Building, dt: number) {
  const s = buildingStats(g,b.owner,b.kind);
  if (b.built < 1) return; // (la levantan los trabajadores)
  if (b.queue.length) {
    b.qT += dt;
    const r = b.queue[0];
    if (b.qT >= trainingDuration(g,b.owner,r)) {
      b.queue.shift(); b.qT = 0;g.sides[b.owner].food=Math.max(0,g.sides[b.owner].food-FOOD_WEIGHT[r]*10);
      const ang = g.rand() * Math.PI, [sx, sy] = nearestWalkable(g.terrain, b.x + Math.cos(ang) * s.size * 0.55, b.y + s.size * 0.3 + Math.sin(ang) * 20), u = addUnit(g, b.owner, r, sx, sy);
      u.defensive = b.owner > 0 && r !== 'worker';
      if (b.rally) { const n = g.nodes.find(q => dist(q, b.rally!) < 34); u.order = n && r === 'worker' ? { k: 'gather', node: n.id } : { k: 'move', x: b.rally.x, y: b.rally.y }; }
      else if (r === 'worker') { const n = nearestNode(g, u, null); if (n) u.order = { k: 'gather', node: n.id }; }
      emit(g, { type: 'trained', role: r, owner: b.owner,x:b.x,y:b.y });
    }
  }
  if(b.infrastructureResearch){const research=b.infrastructureResearch;research.elapsed+=dt;if(research.elapsed>=structureUpgradeTime(g.sides[b.owner].infrastructure[research.kind])){const side=g.sides[b.owner];side.infrastructure[research.kind]++;b.infrastructureResearch=null;if(research.kind==='fortification')for(const q of g.buildings)if(q.owner===b.owner&&!q.dead){const ratio=q.hp/q.maxHp;q.maxHp=buildingStats(g,q.owner,q.kind).hp;q.hp=q.maxHp*ratio;}emit(g,{type:'infrastructure',owner:b.owner,kind:research.kind,level:side.infrastructure[research.kind]});}}
  if(b.evolving){
    const role=TRAINING_ROLE[b.kind]!;b.rT+=dt;const level=evolutionLevel(g,b.owner,role);
    if(b.rT>=evolutionTime(level)){
      g.sides[b.owner].levels[role]=Math.min(MAX_EVOLUTION,level+1);b.evolving=false;b.rT=0;
      for(const u of g.units)if(u.owner===b.owner&&u.role===role&&!u.dead){const health=u.hp/u.maxHp;u.maxHp=unitStats(g,u.owner,u.role).hp;u.hp=u.maxHp*health;}
      emit(g,{type:'upgraded',owner:b.owner,role,level:level+1});
    }
  }
  if (b.kind === 'tower') { // la torre le tira al enemigo más cercano
    b.cool -= dt; const foe = nearestFoe(g, b, b.owner, s.range!);
    if (foe && foe.kind === 'u' && b.cool <= 0) {
      b.cool = s.cool!; const p = foe.u; g.shots.push({ x: b.x, y: b.y - s.size * 0.6, tx: p.x, ty: p.y - 20, t: 0, life: 0.25, owner: b.owner, kind: 'bolt' });
      for (let i = 1; i < 3; i++) g.shots.push({ ...g.shots[g.shots.length - 1], t: -i * 0.065 });
      damageUnit(g, p, s.dmg!, b.owner); emit(g, { type: 'shot', role: 'ranged', x: b.x, y: b.y, owner: b.owner });
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
  const beforeX=u.x,beforeY=u.y;
  const dx = x - u.x, dy = y - u.y, d = Math.hypot(dx, dy);
  if (d <= stop) return true;
  const st = Math.min(d, speed * dt), nx = clampX(u.x + dx / d * st), ny = clampY(u.y + dy / d * st);
  const ok = (a: number, b: number) => fly || !TER || walkable(TER, a, b);
  if (ok(nx, ny)) { u.x = nx; u.y = ny; } else if (ok(nx, u.y)) u.x = nx; else if (ok(u.x, ny)) u.y = ny; // (se desliza por la orilla)
  const moved=Math.hypot(u.x-beforeX,u.y-beforeY);u.walk+=moved;if(moved>.001)u.moving=true;
  if (Math.abs(dx) > 2) u.face = dx > 0 ? 1 : -1;
  return Math.hypot(x-u.x,y-u.y)<=stop;
}
// Ir hacia un lugar esquivando el agua y las rocas: en línea recta si se puede; si no, por el camino más corto.
function steer(g: LandGame, u: Unit, tx: number, ty: number, speed: number, dt: number, stop = 4) {
  if (dist(u, { x: tx, y: ty }) <= stop) { u.path = undefined; return true; }
  const fly = flies(g, u);
  const nav = TER ?? g.terrain;
  if (fly || clearLine(nav, u.x, u.y, tx, ty)) { u.path = undefined; return moveTo(u, tx, ty, speed, dt, stop, fly); }
  if (!u.path || !u.pathFor || Math.hypot(u.pathFor[0] - tx, u.pathFor[1] - ty) > T * 2 || g.t - (u.pathT ?? 0) > 3) { u.path = findPath(nav, u.x, u.y, tx, ty); u.pathFor = [tx, ty]; u.pathT = g.t; }
  if (!u.path.length) return false; // Un destino aislado nunca permite atravesar obstáculos.
  while (u.path.length > 1 && (dist(u, { x: u.path[0][0], y: u.path[0][1] }) < 14 || clearLine(nav, u.x, u.y, u.path[1][0], u.path[1][1]))) u.path.shift();
  moveTo(u, u.path[0][0], u.path[0][1], speed, dt, 2);
  return dist(u, { x: tx, y: ty }) <= stop;
}
function stepUnit(g: LandGame, u: Unit, dt: number) {
  u.moving=false;
  const s = unitStats(g, u.owner, u.role); u.cool -= dt; if (u.atkT >= 0) { u.atkT += dt; if (u.atkT > 0.35) u.atkT = -1; }
  const o = u.order;
  if(foodBlocked(g,u.owner,u.role)){u.atkT=-1;return;}
  if(o.k==='farm'){stepFarm(g,u,o.id,dt);return;}
  if(u.carryKind==='food'&&u.carry>0){stepFarm(g,u,-1,dt);return;}
  // el especial que cura: si hay un amigo lastimado cerca, lo cura
  if (s.heal && specialHeals(g.sides[u.owner].civ) && u.role === 'special' && (o.k === 'idle' || (o.k === 'move' && o.attack))) {
    const hurt = [...nearbyUnits(g,u,s.sight)].filter(q => q.owner === u.owner && !q.dead && q !== u && q.hp < q.maxHp && dist(q, u) < s.sight).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (hurt) {
      if (dist(hurt, u) > s.range) steer(g, u, hurt.x, hurt.y, s.speed, dt, s.range * 0.9);
      else if (u.cool <= 0) { u.cool = s.cool; u.atkT = 0; hurt.hp = Math.min(hurt.maxHp, hurt.hp + s.heal); g.shots.push({ x: u.x, y: u.y - 30, tx: hurt.x, ty: hurt.y - 25, t: 0, life: 0.45, owner: u.owner, kind: 'heal' });if(['elfos','enanos','nomuerta','sauriano'].includes(g.sides[u.owner].civ))emit(g,{type:'spell',owner:u.owner,role:u.role,x:u.x,y:u.y}); }
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
    const p = tPos(t), reach = s.range<=60&&t.kind==='u'?Math.max(s.range+tReach(g,t),bodyRadius(s.size)+bodyRadius(unitStats(g,t.u.owner,t.u.role).size)+8):s.range+tReach(g,t), d = dist(u, p);
    if (s.range <= 60 && !flies(g,u)) {
      const wall = wallAcross(g,u,p);
      if (wall && wall.id !== o.id) { u.order = {k:'attack',id:wall.id}; return; }
    }
    if (u.defensive && !g.ais[u.owner - 1].attacking) {
      const home = g.buildings.find(b => b.owner === u.owner && b.kind === 'base' && !b.dead);
      if (home && dist(home, p) > 600) { u.order = { k: 'move', x: home.x, y: home.y + 100 }; return; }
    }
    if (d > reach) { steer(g, u, p.x, p.y, s.speed, dt, reach * 0.92); return; }
    if (Math.abs(p.x - u.x) > 2) u.face = p.x > u.x ? 1 : -1;
    if (u.cool > 0) return;
    u.cool = s.cool; u.atkT = 0;
    const ranged = s.range > 60, dmg = s.dmg * (t.kind === 'b' ? (s.vsBuild ?? 1) * (u.role === 'worker' ? 0.3 : 1) : 1);
    const hit = (q: Target, k = 1) => q.kind === 'u' ? damageUnit(g, q.u, dmg * k, u.owner) : damageBuilding(g, q.b, dmg * k, u.owner);
    hit(t);
    const splash = u.role === 'special' && !specialHeals(g.sides[u.owner].civ) ? s.splash : u.role === 'heavy' || u.role === 'elite' ? s.splash : 0;
    if (splash) for (const q of nearbyUnits(g,p,splash)) if (q.owner !== u.owner && !q.dead && q !== (t.kind === 'u' ? t.u : null) && dist(q, p) < splash) damageUnit(g, q, dmg * 0.5, u.owner);
    g.shots.push(ranged ? { x: u.x + u.face * 14, y: u.y - s.size * 0.55, tx: p.x, ty: p.y - (t.kind === 'u' ? 20 : 40), t: 0, life: 0.28, owner: u.owner, kind: splash ? 'splash' : 'bolt' } : { x: p.x, y: p.y - 20, tx: p.x, ty: p.y, t: 0, life: 0.22, owner: u.owner, kind: 'slash' });
    if (ranged) { const shot = g.shots[g.shots.length - 1]; for (let i = 1; i < 3; i++) g.shots.push({ ...shot, t: -i * 0.065 }); }
    emit(g, { type: ranged ? 'shot' : 'hit', role: u.role, x: u.x, y: u.y, owner: u.owner });
    return;
  }
  if (o.k === 'gather') {
    if (u.carry > 0) { // Entrega también una veta parcial antes de cambiar de recurso.
      const d = nearestDrop(g, u); if (!d) return;
      if (steer(g, u, d.x, d.y, s.speed, dt, BUILD_STATS[d.kind].size * 0.45)) {
        const side = g.sides[u.owner], k = u.owner > 0 ? AI_INCOME[g.difficulty] : 1;
        side[u.carryKind ?? 'stone'] += Math.round(u.carry * k);
        side.gathered += u.carry; u.carry = 0; u.carryKind = null;
      }
      return;
    }
    let n = g.nodes.find(q => q.id === o.node && q.amount > 0);
    if (!n) { n = nearestNode(g, u, u.carryKind==='food'?null:u.carryKind) ?? undefined; if (!n) { u.order = { k: 'idle' }; return; } u.order = { k: 'gather', node: n.id }; }
    if (steer(g, u, n.x, n.y, s.speed, dt, resourceReach(s.size)-2)) {
      u.mineT += dt; u.atkT = u.mineT % 0.6 < 0.3 ? 0.1 : -1;
      if (u.mineT >= MINE_T) { const take = Math.min(CARRY, n.amount); n.amount -= take; u.carry = take; u.carryKind = n.kind; u.mineT = 0; u.atkT = -1; }
    }
    return;
  }
  if (o.k === 'build') {
    const b = g.buildings.find(q => q.id === o.id && !q.dead);
    if (!b || b.built >= 1) {
      const next = u.buildQueue?.map(id => g.buildings.find(q => q.id === id && !q.dead && q.built < 1)).find(Boolean);
      if (next) { u.buildQueue = u.buildQueue!.filter(id => id !== next.id); u.order = { k: 'build', id: next.id }; }
      else if(b?.kind==='farm'&&assignFarm(g,u.id,b.id)){return;}
      else { u.buildQueue = []; u.order = { k: 'idle' }; const n = nearestNode(g, u, null); if (n && b) u.order = { k: 'gather', node: n.id }; }
      return;
    }
    if (steer(g, u, b.x, b.y, s.speed, dt, BUILD_STATS[b.kind].size * 0.45)) {
      const bs = buildingStats(g,b.owner,b.kind), k = dt / (bs.time * (u.owner > 0 ? AI_SPEED[g.difficulty] : 1));
      b.built = Math.min(1, b.built + k); b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.9 * k); u.atkT = (g.t % 0.6) < 0.3 ? 0.1 : -1;
      if (b.built >= 1) {
        if (b.kind === 'wall') {
          TER = wallNavigation(g);
          for (const q of g.units) if (!q.dead && !flies(g,q) && !walkable(TER,q.x,q.y)) { [q.x,q.y] = nearestWalkable(TER,q.x,q.y); q.path = undefined; }
        }
        emit(g, { type: 'built', kind: b.kind, owner: b.owner,x:b.x,y:b.y });
      }
    }
  }
}
function stepFarm(g:LandGame,u:Unit,id:number,dt:number){
 const farm=g.buildings.find(b=>b.id===id&&!b.dead&&b.built>=1&&b.kind==='farm'&&b.owner===u.owner),s=unitStats(g,u.owner,u.role);
 if(u.carry>0){
   const kind=u.carryKind==='food'?'storehouse':null;
   const drop=g.buildings.filter(b=>b.owner===u.owner&&!b.dead&&b.built>=1&&(kind?b.kind===kind:b.kind==='base'||b.kind==='depot')).sort((a,b)=>dist(a,u)-dist(b,u))[0];
   if(!drop)return;
   if(steer(g,u,drop.x,drop.y,s.speed,dt,BUILD_STATS[drop.kind].size*.45)){
     const side=g.sides[u.owner];if(u.carryKind==='food')side.food=Math.min(FOOD_CAPACITY,side.food+u.carry);else side[u.carryKind??'stone']+=u.carry;
     u.carry=0;u.carryKind=null;
   }return;
 }
 if(!farm){u.order={k:'idle'};u.mineT=0;return;}
 if(steer(g,u,farm.x,farm.y,s.speed,dt,32)){
   u.mineT+=dt;u.atkT=(g.t%.8)<.4?.12:-1;
   if(u.mineT>=HARVEST_TIME){u.mineT=0;u.carry=HARVEST_YIELD;u.carryKind='food';u.atkT=-1;}
 }
}
const pendingMove = new Map<number, { x: number; y: number }>(); // (a dónde iban antes de pararse a pelear)
// Que no se encimen: se empujan un poquito entre ellos.
function separate(g:LandGame,dt:number){
 const us=g.units.filter(u=>!u.dead),radii=new Map(us.map(u=>[u.id,bodyRadius(unitStats(g,u.owner,u.role).size)])),cell=Math.max(50,...radii.values())*2,buckets=new Map<string,Unit[]>();
 for(const u of us){const key=`${Math.floor(u.x/cell)}:${Math.floor(u.y/cell)}`,bucket=buckets.get(key)??[];bucket.push(u);buckets.set(key,bucket);}
 for(const a of us){const cx=Math.floor(a.x/cell),cy=Math.floor(a.y/cell);for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++)for(const b of buckets.get(`${cx+xx}:${cy+yy}`)??[]){
   if(a.id>=b.id)continue;const r=radii.get(a.id)!+radii.get(b.id)!+6,{d,nx,ny}=pairDirection(a,b);if(d>=r)continue;
   const push=(r-d)*Math.min(1,dt*12)*.5,ax=clampX(a.x-nx*push),ay=clampY(a.y-ny*push),bx=clampX(b.x+nx*push),by=clampY(b.y+ny*push);
   if(!foodBlocked(g,a.owner,a.role)&&(flies(g,a)||walkable(TER??g.terrain,ax,ay))){const moved=Math.hypot(ax-a.x,ay-a.y);a.x=ax;a.y=ay;if(moved>.12){a.walk+=moved;a.moving=true;}}if(!foodBlocked(g,b.owner,b.role)&&(flies(g,b)||walkable(TER??g.terrain,bx,by))){const moved=Math.hypot(bx-b.x,by-b.y);b.x=bx;b.y=by;if(moved>.12){b.walk+=moved;b.moving=true;}}
 }}
}

// ---------------------------------------------------------------- La computadora
const AI_INCOME: Record<Difficulty, number> = { veryEasy: 0.5, easy: 0.75, normal: 1, hard: 1.35 };
const AI_SPEED: Record<Difficulty, number> = { veryEasy: 1.8, easy: 1.3, normal: 1, hard: 0.8 }; // (tiempos de producción)
function stepAI(g: LandGame, dt: number, o: Owner) {
  const ai = g.ais[o - 1]; ai.t -= dt; if (ai.t > 0) return; ai.t = 1;
  const side = g.sides[o], base = g.buildings.find(b => b.owner === o && b.kind === 'base' && !b.dead);
  if (!base) return;
  const mine = g.units.filter(u => u.owner === o && !u.dead), workers = mine.filter(u => u.role === 'worker'), army = mine.filter(u => u.role !== 'worker');
  const bs = (k: BKind) => g.buildings.filter(b => b.owner === o && b.kind === k && !b.dead);
  const complete = (k: BKind) => bs(k).some(b => b.built >= 1);
  const miners=workers.filter(w=>w.order.k!=='farm'&&w.order.k!=='build');
  for (const [i,w] of miners.entries()) if (!w.carry) {
    const kind:ResKind=(['rock','stone','stone','gem','rock','energy','stone','gem'] as ResKind[])[i%8];
    const order=w.order,current=order.k==='gather'?g.nodes.find(n=>n.id===order.node):null;
    if(current?.kind===kind&&current.amount>0)continue;
    const n = nearestNode(g, w, kind) ?? nearestNode(g, w, null); if (n) w.order = { k: 'gather', node: n.id };
  }
  if (workers.length+g.buildings.filter(b=>b.owner===o&&!b.dead).reduce((n,b)=>n+b.queue.filter(r=>r==='worker').length,0) < 14 && side.stone >= 90) for (const b of [base,...bs('workerBarracks')]) if (b.queue.length < 1) train(g,b.id,'worker');
  const place = (kind: BKind) => {
    if (!canPay(side, BUILD_STATS[kind].cost)) return;
    for (let tries = 0; tries < 48; tries++) {
      const a = g.rand() * Math.PI * 2, r = 240 + g.rand() * 340, x = base.x + Math.cos(a) * r, y = base.y + Math.sin(a) * r * 0.8;
      const w = workers.find(q => q.order.k !== 'build' && q.order.k!=='farm' && q.carry === 0) ?? workers.find(q => q.order.k !== 'build'&&q.order.k!=='farm');
      if (w && canPlace(g, kind, x, y) && placeBuilding(g, o, kind, x, y, [w.id])) return;
    }
  };
  const building = g.buildings.some(b => b.owner === o && !b.dead && b.built < 1);
  if (!building) {
    if (!bs('storehouse').length) place('storehouse');
    else if(bs('farm').length<Math.max(2,Math.ceil(foodRate(g,o)/45))&&complete('storehouse'))place('farm');
    else if (!bs('workerBarracks').length) place('workerBarracks');
    else if ((popUsed(g, o) + 4 >= popCap(g, o) || (!bs('depot').length && g.t > 65)) && popCap(g, o) < g.populationLimit) place('depot');
    else if (!bs('barracks').length && g.t > 45) place('barracks');
    else if (complete('barracks') && !bs('rangedBarracks').length && g.t > 90) place('rangedBarracks');
    else if (complete('rangedBarracks') && !bs('workshop').length && g.t > 150) place('workshop');
    else if (!bs('tower').length && g.t > 180) place('tower');
    else if (complete('rangedBarracks') && !bs('specialBarracks').length && g.t > 240) place('specialBarracks');
    else if (complete('workshop') && !bs('eliteBarracks').length && g.t > 330) place('eliteBarracks');
    else if (bs('barracks').length < 2 && complete('eliteBarracks') && g.t > 420) place('barracks');
  }
  const militaryKinds = ROLES.filter(r=>r!=='worker').map(r=>TRAINING_KIND[r]);
  const infrastructure = Object.values(TRAINING_KIND).every(complete) && complete('depot') && complete('tower');
  for (const kind of militaryKinds) for (const b of bs(kind)) b.rally = { x: base.x, y: base.y + 140 };
  const queued = g.buildings.filter(b => b.owner === o && !b.dead).reduce((n, b) => n + b.queue.filter(r => r !== 'worker').length, 0);
  const need = (g.difficulty === 'veryEasy' ? 16 : g.difficulty === 'easy' ? 20 : g.difficulty === 'hard' ? 30 : 24) + Math.min(12, ai.wave * 2);
  if (infrastructure && army.length + queued < need + 2) {
    const heavyReady=army.some(u=>u.role==='heavy'||u.role==='elite')||g.buildings.some(b=>b.owner===o&&!b.dead&&b.queue.some(r=>r==='heavy'||r==='elite'));
    const priorities=heavyReady?['workshop','eliteBarracks','specialBarracks','rangedBarracks','barracks'] as BKind[]:['workshop'] as BKind[];
    for (const kind of priorities) for (const b of bs(kind)) if (b.built >= 1 && !b.queue.length) train(g,b.id,BUILD_STATS[kind].makes[0]);
  }
  if(infrastructure&&army.length>=12&&g.rand()<.1){const tech:StructureUpgrade=side.infrastructure.production<=side.infrastructure.fortification?'production':'fortification';researchInfrastructure(g,base.id,tech);}
  if(infrastructure&&army.length>=12)for(const kind of militaryKinds){const b=bs(kind).find(q=>q.built>=1&&!q.evolving);if(b&&g.rand()<.15)researchEvolution(g,b.id);}
  for(const farm of bs('farm').filter(b=>b.built>=1)){if(!workers.some(w=>w.order.k==='farm'&&w.order.id===farm.id)){const w=workers.find(w=>w.order.k!=='build'&&w.order.k!=='farm');if(w)assignFarm(g,w.id,farm.id);}}
  const intruder = g.units.find(u => u.owner !== o && !u.dead && dist(u, base) < 500);
  if (intruder) { for (const u of army) if (u.order.k !== 'attack') u.order = { k: 'attack', id: intruder.id }; }
  // La ofensiva depende de economía, tecnología y tropas; nunca sale a los tres minutos.
  if (!intruder && g.t >= ai.waveAt && infrastructure && workers.length >= 8 && army.length >= need && army.some(u => u.role === 'heavy' || u.role === 'elite')) {
    const target = g.buildings.filter(b => b.owner !== o && b.kind === 'base' && !b.dead).sort((a, b) => dist(a, base) - dist(b, base))[0];
    if (target) { orderMove(g, army.map(u => u.id), target.x, target.y, true); ai.wave++; ai.attacking = true; ai.waveAt = g.t + (g.difficulty === 'hard' ? 150 : 210); }
  }
  if (side.power >= POWER_MAX && army.some(u => u.order.k === 'attack')) {
    if (CIVS[side.civ].power.kind === 'strike') { const foe = g.units.find(u => u.owner !== o && !u.dead && army.some(a => dist(a, u) < 300)); if (foe) castPower(g, o, foe.x, foe.y); }
    else castPower(g, o);
  }
}
export function formatLandTime(s: number) { const m = Math.floor(s / 60), r = Math.floor(s % 60); return `${m}:${r.toString().padStart(2, '0')}`; }
