import { MAZE_TIER, mazeFloorSegments, mazeLaneX, mazeOpenings, mazeWalls, type MazeWall } from './factoryMaze';
export const FACTORY_HEIGHT = 1440;
export const FACTORY_TOP = FACTORY_HEIGHT * 10;
export const FACTORY_WIDTH = 1600;
export const FACTORIES = [
  { name: 'Fundición de hierro', color: '#fb923c', wall: '#30251f', motif: 'furnace' },
  { name: 'Central de vapor', color: '#e2e8f0', wall: '#263742', motif: 'steam' },
  { name: 'Planta química', color: '#a3e635', wall: '#20312c', motif: 'tanks' },
  { name: 'Cámara frigorífica', color: '#67e8f9', wall: '#193951', motif: 'ice' },
  { name: 'Fábrica de conservas', color: '#fbbf24', wall: '#41301d', motif: 'cans' },
  { name: 'Central eléctrica', color: '#c084fc', wall: '#2b2343', motif: 'power' },
  { name: 'Refinería de petróleo', color: '#f87171', wall: '#352326', motif: 'oil' },
  { name: 'Línea de robots', color: '#38bdf8', wall: '#1b3040', motif: 'robots' },
  { name: 'Reactor nuclear', color: '#4ade80', wall: '#172e26', motif: 'reactor' },
  { name: 'Fábrica orbital', color: '#f0abfc', wall: '#24203f', motif: 'space' },
] as const;
export const FOODS = [
  { name: 'Pizza', icon: '🍕', energy: 35, impulse: 640, cost: 20, color: '#fbbf24', effect: 'Equilibrado' },
  { name: 'Porotos', icon: '🫘', energy: 48, impulse: 740, cost: 28, color: '#a3e635', effect: 'Explosivo' },
  { name: 'Manzana', icon: '🍎', energy: 30, impulse: 610, cost: 15, color: '#fb7185', effect: 'Preciso' },
  { name: 'Fideos', icon: '🍝', energy: 42, impulse: 680, cost: 23, color: '#fdba74', effect: 'Prolongado' },
  { name: 'Hamburguesa', icon: '🍔', energy: 44, impulse: 700, cost: 25, color: '#d9a35b', effect: 'Contundente' },
  { name: 'Brócoli', icon: '🥦', energy: 38, impulse: 660, cost: 19, color: '#65a30d', effect: 'Vegetal' },
  { name: 'Banana', icon: '🍌', energy: 32, impulse: 625, cost: 16, color: '#fde047', effect: 'Ágil' },
  { name: 'Tacos', icon: '🌮', energy: 46, impulse: 720, cost: 27, color: '#f97316', effect: 'Picante' },
  { name: 'Huevo', icon: '🥚', energy: 36, impulse: 650, cost: 18, color: '#fef3c7', effect: 'Concentrado' },
  { name: 'Guiso de lentejas', icon: '🥘', energy: 50, impulse: 760, cost: 30, color: '#b45309', effect: 'Turbina' },
] as const;
export type FactoryPlatform = { id: number; row: number; lane: number; x: number; y: number; w: number; moving: boolean; food: number; eaten: boolean; solid: boolean; checkpoint: boolean };
export type FactoryBomb = { x: number; y: number; fuse: number; remaining: number | null; blast: number; spent: boolean; radius: number };
export type FactoryGas = { x: number; y: number; age: number; vx: number; seed: number };
export type FactoryHazard = { kind: 'gear' | 'laser' | 'door' | 'fire' | 'spikes'; x: number; y: number; phase: number };
export type FactoryGame = {
  x: number; y: number; vx: number; vy: number; time: number; energy: number; food: number;
  highest: number; spikes: number; ground: number | null; cooldown: number; puff: number; boostFood: number; landing: number;
  state: 'ready' | 'playing' | 'dead' | 'won'; reason: string;
  platforms: FactoryPlatform[]; hazards: FactoryHazard[]; walls: MazeWall[]; bombs: FactoryBomb[]; gas: FactoryGas[]; event: 'boost' | 'eat' | 'level' | 'bomb' | '';
};
export const factoryLevel = (height: number) => Math.min(9, Math.max(0, Math.floor(height / FACTORY_HEIGHT)));
export function platformX(p: FactoryPlatform, time: number) { return p.x + (p.moving ? Math.sin(time * 1.1 + p.id) * 38 : 0); }
export function hazardActive(h: FactoryHazard, time: number) { return (time + h.phase) % 4.8 > 1.8; }
export function hazardDirection(h: FactoryHazard) { return h.phase % 2 > 1 ? -1 : 1; }
export function hitsFactoryHazard(g: FactoryGame, h: FactoryHazard) {
  const left = g.x - 18, right = g.x + 18, bottom = g.y + 5, top = g.y + 105;
  if (h.kind === 'gear') {
    const dx = h.x - Math.max(left, Math.min(right, h.x)), dy = h.y - Math.max(bottom, Math.min(top, h.y));
    return Math.hypot(dx, dy) < 42;
  }
  const box = (x1: number, x2: number, y1: number, y2: number) => right > x1 && left < x2 && top > y1 && bottom < y2;
  if (h.kind === 'spikes') return box(h.x - 40, h.x + 40, h.y - 8, h.y + 15);
  if (!hazardActive(h, g.time)) return false;
  if (h.kind === 'door') return box(h.x - 52, h.x + 52, h.y - 62, h.y + 68);
  const end = h.x + hazardDirection(h) * 128, radius = h.kind === 'fire' ? 24 : 4;
  return box(Math.min(h.x, end), Math.max(h.x, end), h.y - radius, h.y + radius);
}
export function newFactoryGame(level = 0): FactoryGame {
  const platforms: FactoryPlatform[] = [];
  const hazards: FactoryHazard[] = [];
  const add = (row: number, x: number, w: number, lane: number, solid: boolean, checkpoint = false) => {
    platforms.push({ id: platforms.length, row, lane, x, y: row * 144, w, solid, checkpoint, moving: false,
      food: (row + lane * 3 + 10) % FOODS.length, eaten: false });
  };
  add(0, 800, 1600, 2, true, true); platforms[0].food = 0;
  for (let band = 0; band < 50; band++) {
    const floor = Math.floor(band / 5), tier = band % 5 + 1;
    for (const lane of mazeOpenings(floor, tier)) add(band * 2 + 1, mazeLaneX(lane), 116, lane, false);
    for (const segment of mazeFloorSegments(floor, tier)) add(band * 2 + 2, segment.x, segment.w, Math.round((segment.x - 180) / 310), true);
    if ((band + 1) % 5 === 0 && band < 49) add(band * 2 + 2, 800, 170, 2, false, true);
  }
  const bombs: FactoryBomb[] = [];
  for (let floor = 1; floor < 10; floor++) {
    const row = floor * 10 + 4;
    const ledges = platforms.filter(p => p.row === row && p.solid && p.w > 210);
    const ledge = ledges[(floor * 3) % ledges.length];
    if (ledge) bombs.push({ x: ledge.x, y: ledge.y + 22, fuse: 8 - floor * 0.25, remaining: null, blast: 0, spent: false, radius: 100 + floor * 2 });
  }
  return { x: 800, y: level * FACTORY_HEIGHT, vx: 0, vy: 0, time: 0, energy: 100, food: 0, highest: level * FACTORY_HEIGHT, spikes: level * FACTORY_HEIGHT - 95,
    ground: platforms.findIndex(p => p.row === level * 10 && p.checkpoint), cooldown: 0, puff: 0, boostFood: 0, landing: 0, state: 'ready', reason: '', platforms, hazards, walls: mazeWalls(), bombs, gas: [], event: '' };
}
export function stepFactory(g: FactoryGame, input: { left: boolean; right: boolean; boost: boolean }, dt: number) {
  if (g.state !== 'playing') return;
  g.event = '';
  dt = Math.min(dt, 1 / 30);
  g.time += dt; g.cooldown = Math.max(0, g.cooldown - dt); g.puff = Math.max(0, g.puff - dt); g.landing = Math.max(0, g.landing - dt);
  const oldLevel = factoryLevel(g.highest);
  const oldY = g.y;
  const oldX = g.x;
  if (g.ground !== null) {
    const p = g.platforms[g.ground];
    g.x += platformX(p, g.time) - platformX(p, g.time - dt);
  }
  const targetVx = (Number(input.right) - Number(input.left)) * 400;
  g.vx += (targetVx - g.vx) * Math.min(1, dt * (g.ground !== null ? 22 : 12));
  g.x = Math.max(28, Math.min(FACTORY_WIDTH - 28, g.x + g.vx * dt));
  const solids = [...g.walls, ...g.platforms.filter(p => p.solid).map(p => ({ x: p.x - p.w / 2, y: p.y - 22, w: p.w, h: 22 }))];
  for (const wall of solids) if (g.y + 104 > wall.y + 0.01 && g.y + 1 < wall.y + wall.h && g.x + 18 > wall.x && g.x - 18 < wall.x + wall.w) {
    if (oldX + 18 <= wall.x + 0.1) g.x = wall.x - 18;
    else if (oldX - 18 >= wall.x + wall.w - 0.1) g.x = wall.x + wall.w + 18;
    g.vx = 0;
  }
  if (g.ground !== null) {
    const p = g.platforms[g.ground];
    if (!p.eaten && Math.abs(g.x - platformX(p, g.time)) < 37) {
      p.eaten = true; g.food = p.food; g.energy = Math.min(100, g.energy + FOODS[p.food].energy); g.event = 'eat';
    }
  }
  if (input.boost && g.cooldown === 0 && g.energy >= FOODS[g.food].cost) {
    const food = FOODS[g.food];
    g.energy -= food.cost; g.boostFood = g.food; g.vy = food.impulse; g.ground = null; g.cooldown = 0.42; g.puff = 0.65; g.event = 'boost';
    for (let i = 0; i < 4; i++) g.gas.push({ x: g.x + Math.sin(i * 2.4) * 9, y: g.y + 38, age: -i * 0.018, vx: -g.vx * 0.15 + Math.sin(i * 1.7) * 22, seed: i + g.time });
  }
  g.vy -= 980 * dt;
  g.y += g.vy * dt;
  for (const wall of solids) if (g.x + 18 > wall.x && g.x - 18 < wall.x + wall.w) {
    if (g.vy > 0 && oldY + 105 <= wall.y + 0.01 && g.y + 105 > wall.y) { g.y = wall.y - 105; g.vy = 0; }
    else if (g.vy < 0 && oldY >= wall.y + wall.h - 0.01 && g.y < wall.y + wall.h) { g.y = wall.y + wall.h; g.vy = 0; }
  }
  g.ground = null;
  if (g.vy <= 0) for (let i = g.platforms.length - 1; i >= 0; i--) {
    const p = g.platforms[i];
    if (oldY >= p.y && g.y <= p.y && Math.abs(g.x - platformX(p, g.time)) < p.w / 2 + 12) {
      if (oldY > p.y + 1) g.landing = 0.14;
      g.y = p.y; g.vy = 0; g.ground = p.id; break;
    }
  }
  for (const p of g.platforms) if (!p.eaten && Math.abs(g.y - p.y) < 65 && Math.abs(g.x - platformX(p, g.time)) < 37) {
    p.eaten = true; g.food = p.food; g.energy = Math.min(100, g.energy + FOODS[p.food].energy); if (!g.event) g.event = 'eat';
  }
  g.highest = Math.max(g.highest, g.y);
  if (factoryLevel(g.highest) > oldLevel) g.event = 'level';
  // Continuous pursuit from the first frame; catch-up is speed-limited, never a teleport.
  g.spikes += (24 + factoryLevel(g.highest) * 1.8 + Math.max(0, g.highest - g.spikes - 360) * 1.6) * dt;
  if (g.puff > 0.18 && Math.floor(g.time * 28) !== Math.floor((g.time - dt) * 28)) {
    g.gas.push({ x: g.x, y: g.y + 40, age: 0, vx: -g.vx * 0.15 + Math.sin(g.time * 41) * 16, seed: g.time * 7 });
  }
  for (const puff of g.gas) { puff.age += dt; puff.x += puff.vx * dt; puff.y -= (38 + Math.max(0, puff.age) * 35) * dt; }
  g.gas = g.gas.filter(puff => puff.age < 1.35);
  for (const bomb of g.bombs) {
    bomb.blast = Math.max(0, bomb.blast - dt);
    if (bomb.spent) continue;
    if (bomb.remaining === null && Math.abs(g.x - bomb.x) < 260 && Math.abs(g.y - bomb.y) < MAZE_TIER) bomb.remaining = bomb.fuse;
    if (bomb.remaining !== null) {
      bomb.remaining = Math.max(0, bomb.remaining - dt);
      if (bomb.remaining === 0) { bomb.spent = true; bomb.blast = 0.65; if (!g.event) g.event = 'bomb'; }
    }
  }
  const die = (reason: string) => { g.state = 'dead'; g.reason = reason; };
  if (g.y < g.spikes + 25) die('¡Te alcanzó el piso de pinches!');
  for (const bomb of g.bombs) if (bomb.blast > 0 && Math.hypot(g.x - bomb.x, g.y + 50 - bomb.y) < bomb.radius) {
    // A steel wall between the character and the charge absorbs the blast.
    const blocked = solids.some(wall => Array.from({ length: 9 }, (_, i) => (i + 1) / 10).some(t => {
      const x = bomb.x + (g.x - bomb.x) * t, y = bomb.y + (g.y + 50 - bomb.y) * t;
      return x > wall.x && x < wall.x + wall.w && y > wall.y && y < wall.y + wall.h;
    }));
    if (!blocked) die('¡Te alcanzó una bomba! Mirá el temporizador y buscá otro camino.');
  }
  for (const h of g.hazards) {
    if (hitsFactoryHazard(g, h)) { die({ gear: '¡Cuidado con los engranajes!', spikes: '¡Esos pinches no eran una plataforma!', laser: '¡Te alcanzó un láser!', fire: '¡Te alcanzó el lanzallamas!', door: '¡Te atrapó una compuerta!' }[h.kind]); break; }
  }
  if (g.state === 'playing' && g.y >= FACTORY_TOP) { g.state = 'won'; g.reason = '¡Escapaste de las 10 fábricas!'; }
}
