import { describe, expect, it } from 'vitest';
import { FACTORIES, FACTORY_HEIGHT, FACTORY_TOP, FOODS, newFactoryGame, stepFactory } from './fartFactory';
import { MAZE_GAP, mazeFloorSegments, mazeLaneX, mazeOpenings } from './factoryMaze';
import { factoryView } from './factoryScene';
import { FACTORY_FART_SOUNDS } from './factorySound';
const idle = { left: false, right: false, boost: false };
describe('Fábrica de Pedos: laberinto frontal', () => {
  it('gives all ten factories different connected layouts with two openings per tier', () => {
    const signatures = FACTORIES.map((_, level) => Array.from({ length: 5 }, (_, tier) => mazeOpenings(level, tier + 1).join(',')).join('|'));
    expect(new Set(signatures).size).toBe(10);
    for (let level = 0; level < 10; level++) for (let tier = 1; tier <= 5; tier++) {
      const openings = mazeOpenings(level, tier), segments = mazeFloorSegments(level, tier);
      expect(new Set(openings).size).toBe(2);
      expect(segments.reduce((sum, p) => sum + p.w, 0) + MAZE_GAP * 2).toBe(1600);
      for (const lane of openings) expect(segments.some(p => Math.abs(mazeLaneX(lane) - p.x) < p.w / 2)).toBe(false);
    }
  });
  it('removes the dense traps and limits bombs to one per factory after the first', () => {
    const g = newFactoryGame(); expect(g.hazards).toHaveLength(0); expect(g.bombs).toHaveLength(9);
    expect(g.walls.length).toBeGreaterThan(40);
    expect(g.bombs.every(b => b.fuse >= 5 && b.remaining === null && !b.spent)).toBe(true);
  });
  it('keeps ten meals and ten supplied recordings', () => {
    expect(FOODS).toHaveLength(10); expect(new Set(FACTORY_FART_SOUNDS).size).toBe(10);
    expect(new Set(newFactoryGame().platforms.map(p => p.food)).size).toBe(10);
    const speeds = FOODS.map((f, i) => {
      const g = newFactoryGame(); g.state = 'playing'; g.food = i; g.platforms[0].eaten = true;
      stepFactory(g, { ...idle, boost: true }, 1 / 120); expect(g.boostFood).toBe(i); expect(g.energy).toBe(100 - f.cost); return g.vy;
    });
    expect(new Set(speeds).size).toBe(10);
  });
  it('requires gas to rise and does not eat a meal twice', () => {
    const g = newFactoryGame(); g.state = 'playing'; g.energy = 0;
    stepFactory(g, idle, 1 / 120); expect(g.energy).toBe(35); expect(g.y).toBe(0);
    stepFactory(g, idle, 1 / 120); expect(g.energy).toBe(35);
    g.energy = 0; stepFactory(g, { ...idle, boost: true }, 1 / 120); expect(g.y).toBe(0);
  });
  it('blocks movement through metal walls and solid ceilings', () => {
    const g = newFactoryGame(); g.state = 'playing'; g.walls = [{ x: 820, y: 0, w: 28, h: 180 }];
    for (let i = 0; i < 30; i++) stepFactory(g, { ...idle, right: true }, 1 / 120);
    expect(g.x).toBeLessThanOrEqual(802);
    g.walls = []; g.x = 800; g.y = 160; g.ground = null; g.vy = 600;
    stepFactory(g, idle, 1 / 30); expect(g.y).toBeLessThanOrEqual(161.01); expect(g.vy).toBe(0);
  });
  for (const lane of [1, 3]) it(`can climb through the ${lane === 1 ? 'left' : 'right'} opening and land in the next corridor`, () => {
    const g = newFactoryGame(); g.state = 'playing'; g.x = mazeLaneX(lane);
    const ledge = g.platforms.find(p => p.row === 1 && p.lane === lane)!;
    for (let frame = 0; frame < 240; frame++) {
      stepFactory(g, { ...idle, boost: frame === 0 }, 1 / 120);
      if (g.ground === ledge.id) break;
    }
    expect(g.ground).toBe(ledge.id);
    const direction = lane === 1 ? 1 : -1;
    let landed = false;
    for (let frame = 0; frame < 260; frame++) {
      const steer = g.y > 289 && Math.abs(g.x - mazeLaneX(lane)) < 133;
      stepFactory(g, { boost: frame === 0, left: steer && direction < 0, right: steer && direction > 0 }, 1 / 120);
      expect(g.state).toBe('playing');
      if (g.ground !== null && g.platforms[g.ground].row === 2) { landed = true; break; }
    }
    expect(landed).toBe(true); expect(g.y).toBe(288);
  });
  it('arms bombs only nearby, counts down and explodes only once', () => {
    const g = newFactoryGame(); g.state = 'playing';
    g.bombs = [{ x: 1100, y: 30, fuse: 0.2, remaining: null, blast: 0, spent: false, radius: 100 }];
    stepFactory(g, idle, 1 / 120); expect(g.bombs[0].remaining).toBeNull();
    g.x = 1000; stepFactory(g, idle, 1 / 120); expect(g.bombs[0].remaining).toBeLessThan(0.2);
    g.x = 700;
    for (let i = 0; i < 40; i++) stepFactory(g, idle, 1 / 120);
    expect(g.bombs[0].spent).toBe(true); expect(g.bombs[0].blast).toBeGreaterThan(0); expect(g.state).toBe('playing');
    for (let i = 0; i < 100; i++) stepFactory(g, idle, 1 / 120);
    expect(g.bombs[0].blast).toBe(0);
  });
  it('lets solid metal protect the player from an explosion', () => {
    const g = newFactoryGame(); g.state = 'playing'; g.walls = [{ x: 825, y: 0, w: 20, h: 120 }];
    g.bombs = [{ x: 860, y: 50, fuse: 0, remaining: 0, blast: 0.6, spent: true, radius: 110 }];
    stepFactory(g, idle, 1 / 120); expect(g.state).toBe('playing');
    g.walls = []; stepFactory(g, idle, 1 / 120); expect(g.state).toBe('dead'); expect(g.reason).toContain('bomba');
  });
  it('emits persistent world-space gas which disperses instead of following the character', () => {
    const g = newFactoryGame(); g.state = 'playing'; stepFactory(g, { ...idle, boost: true }, 1 / 120);
    expect(g.gas.length).toBeGreaterThan(2); const y = g.gas[0].y;
    for (let i = 0; i < 20; i++) stepFactory(g, idle, 1 / 120);
    expect(g.gas[0].y).toBeLessThan(y); expect(g.y).toBeGreaterThan(g.gas[0].y);
    for (let i = 0; i < 240; i++) stepFactory(g, idle, 1 / 120);
    expect(g.gas).toHaveLength(0);
  });
  it('keeps the continuously rising floor visible on phones and monitors', () => {
    const g = newFactoryGame(); g.state = 'playing'; const initial = g.spikes; stepFactory(g, idle, 1 / 120); expect(g.spikes).toBeGreaterThan(initial);
    for (const [w, h] of [[393, 851], [851, 393], [1440, 900], [2560, 1080]]) for (const gap of [95, 250, 550, 1000]) {
      g.y = g.spikes + gap; const v = factoryView(g, w, h);
      expect((v.h - (g.spikes - v.bottom)) * v.scale).toBeCloseTo(h - 110);
      expect((v.h - (g.y - v.bottom)) * v.scale).toBeGreaterThan(105);
    }
  });
  it('restarts at a safe checkpoint and only wins at the tenth exit', () => {
    for (let level = 0; level < 10; level++) { const g = newFactoryGame(level); g.state = 'playing'; stepFactory(g, idle, 1 / 120); expect(g.state).toBe('playing'); expect(g.y).toBe(level * FACTORY_HEIGHT); }
    const g = newFactoryGame(9); g.state = 'playing'; g.x = mazeLaneX(mazeOpenings(9, 5)[0]); g.y = FACTORY_TOP - 1; g.vy = 200;
    stepFactory(g, idle, 1 / 120); expect(g.state).toBe('won');
  });
});
