export const FACTORY_HEIGHT = 1440;
export const FACTORY_TOP = FACTORY_HEIGHT * 10;
export const FACTORY_WIDTH = 640;
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
  { name: 'Frutas', icon: '🍎', energy: 30, impulse: 590, cost: 15, color: '#fb7185', effect: 'Preciso' },
  { name: 'Fideos', icon: '🍝', energy: 42, impulse: 680, cost: 23, color: '#fdba74', effect: 'Prolongado' },
] as const;
export type FactoryPlatform = { id: number; x: number; y: number; w: number; moving: boolean; food: number; eaten: boolean };
export type FactoryHazard = { kind: 'gear' | 'laser' | 'door' | 'fire' | 'spikes'; x: number; y: number; phase: number };
export type FactoryGame = {
  x: number; y: number; vx: number; vy: number; time: number; energy: number; food: number;
  highest: number; spikes: number; ground: number | null; cooldown: number; puff: number;
  state: 'ready' | 'playing' | 'dead' | 'won'; reason: string;
  platforms: FactoryPlatform[]; hazards: FactoryHazard[]; event: 'boost' | 'eat' | 'level' | '';
};
export const factoryLevel = (height: number) => Math.min(9, Math.max(0, Math.floor(height / FACTORY_HEIGHT)));
export function platformX(p: FactoryPlatform, time: number) { return p.x + (p.moving ? Math.sin(time * 1.1 + p.id) * 38 : 0); }
export function hazardActive(h: FactoryHazard, time: number) { return (time + h.phase) % 4.8 > 1.8; }
export function newFactoryGame(level = 0): FactoryGame {
  const platforms: FactoryPlatform[] = [];
  const hazards: FactoryHazard[] = [];
  for (let i = 0; i <= 100; i++) {
    const floor = Math.min(9, Math.floor(i / 10));
    platforms.push({ id: i, x: i % 10 === 0 ? 320 : [130, 260, 390, 260][i % 4], y: i * 144, w: i % 10 === 0 ? 220 : 134 - floor * 2, moving: i % 4 === 2, food: i % 4, eaten: false });
    if (i > 0 && i < 100) hazards.push({ kind: (['gear', 'laser', 'door', 'fire', 'spikes'] as const)[i % 5], x: i % 2 ? 70 : 570, y: i * 144 + 65, phase: i * 0.7 });
  }
  return { x: 320, y: level * FACTORY_HEIGHT, vx: 0, vy: 0, time: 0, energy: 100, food: 0, highest: level * FACTORY_HEIGHT, spikes: level * FACTORY_HEIGHT - 230, ground: level * 10, cooldown: 0, puff: 0, state: 'ready', reason: '', platforms, hazards, event: '' };
}
export function stepFactory(g: FactoryGame, input: { left: boolean; right: boolean; boost: boolean }, dt: number) {
  if (g.state !== 'playing') return;
  g.event = '';
  dt = Math.min(dt, 1 / 30);
  g.time += dt; g.cooldown = Math.max(0, g.cooldown - dt); g.puff = Math.max(0, g.puff - dt);
  const oldLevel = factoryLevel(g.highest);
  const oldY = g.y;
  if (g.ground !== null) {
    const p = g.platforms[g.ground];
    g.x += platformX(p, g.time) - platformX(p, g.time - dt);
  }
  g.vx = (Number(input.right) - Number(input.left)) * 245;
  g.x = Math.max(28, Math.min(612, g.x + g.vx * dt));
  if (input.boost && g.cooldown === 0 && g.energy >= FOODS[g.food].cost) {
    const food = FOODS[g.food];
    g.energy -= food.cost; g.vy = food.impulse; g.ground = null; g.cooldown = 0.34; g.puff = 0.32; g.event = 'boost';
  }
  g.vy -= 980 * dt;
  g.y += g.vy * dt;
  g.ground = null;
  if (g.vy <= 0) for (const p of g.platforms) {
    if (oldY >= p.y && g.y <= p.y && Math.abs(g.x - platformX(p, g.time)) < p.w / 2 + 12) {
      g.y = p.y; g.vy = 0; g.ground = p.id; break;
    }
  }
  for (const p of g.platforms) if (!p.eaten && Math.abs(g.y - p.y) < 65 && Math.abs(g.x - platformX(p, g.time)) < 37) {
    p.eaten = true; g.food = p.food; g.energy = Math.min(100, g.energy + FOODS[p.food].energy); g.event = 'eat';
  }
  g.highest = Math.max(g.highest, g.y);
  if (factoryLevel(g.highest) > oldLevel) g.event = 'level';
  if (g.time > 5) g.spikes += (22 + factoryLevel(g.highest) * 1.8) * dt;
  // The pursuing floor stays within sight, without teleporting onto the player.
  g.spikes = Math.max(g.spikes, g.highest - 650);
  const die = (reason: string) => { g.state = 'dead'; g.reason = reason; };
  if (g.y < g.spikes + 14) die('¡Te alcanzó el piso de pinches!');
  for (const h of g.hazards) {
    const active = hazardActive(h, g.time);
    const dx = Math.abs(g.x - h.x), dy = Math.abs(g.y + 30 - h.y);
    if (h.kind === 'gear' && Math.hypot(dx, dy) < 58) die('¡Cuidado con los engranajes!');
    if (h.kind === 'spikes' && dx < 52 && dy < 29) die('¡Esos pinches no eran una plataforma!');
    if (active && h.kind === 'laser' && dx < 155 && dy < 23) die('¡Te alcanzó un láser!');
    if (active && h.kind === 'fire' && dx < 140 && dy < 34) die('¡Te alcanzó el lanzallamas!');
    if (active && h.kind === 'door' && dx < 68 && dy < 72) die('¡Te atrapó una compuerta!');
  }
  if (g.state === 'playing' && g.y >= FACTORY_TOP) { g.state = 'won'; g.reason = '¡Escapaste de las 10 fábricas!'; }
}
