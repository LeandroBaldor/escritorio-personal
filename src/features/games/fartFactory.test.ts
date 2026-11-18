import { describe, expect, it } from 'vitest';
import { FACTORIES, FACTORY_HEIGHT, FACTORY_TOP, FOODS, factoryPoints, newFactoryGame, stepFactory } from './fartFactory';
import { MAZE_TIERS_PER_LEVEL, MAZE_STRUCTURES, mazeGap, mazeFloorSegments, mazeLaneX, mazeOpenings } from './factoryMaze';
import { factoryView } from './factoryScene';
import { FACTORY_FART_SOUNDS } from './factorySound';
const idle = { left: false, right: false, boost: false };
describe('Fábrica de Pedos: laberinto frontal', () => {
  it('gives all ten factories longer, visibly different connected structures', () => {
    expect(FACTORY_HEIGHT).toBe(4032); expect(MAZE_TIERS_PER_LEVEL).toBe(14);
    expect(new Set(MAZE_STRUCTURES.map(s => s.name)).size).toBe(10);
    const signatures = FACTORIES.map((_, level) => Array.from({ length: MAZE_TIERS_PER_LEVEL }, (_, tier) => mazeOpenings(level, tier + 1).join(',')).join('|'));
    expect(new Set(signatures).size).toBe(10);
    const game = newFactoryGame();
    const solidCounts = FACTORIES.map((_, level) => new Set(game.platforms.filter(p => p.solid && p.y > level * FACTORY_HEIGHT && p.y <= (level + 1) * FACTORY_HEIGHT).map(p => p.row)).size);
    expect(new Set(solidCounts).size).toBeGreaterThanOrEqual(4);
    for (let level = 0; level < 10; level++) for (let tier = 1; tier <= MAZE_TIERS_PER_LEVEL; tier++) {
      const openings = mazeOpenings(level, tier), segments = mazeFloorSegments(level, tier);
      expect(new Set(openings).size).toBeGreaterThanOrEqual(2);
      expect(segments.reduce((sum, p) => sum + p.w, 0) + mazeGap(level) * openings.length).toBe(1600);
      for (const lane of openings) expect(segments.some(p => Math.abs(mazeLaneX(lane, level) - p.x) < p.w / 2)).toBe(false);
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
    const g = newFactoryGame(); g.state = 'playing'; g.x = 790; g.walls = [{ x: 820, y: 0, w: 28, h: 180 }];
    for (let i = 0; i < 30; i++) stepFactory(g, { ...idle, right: true }, 1 / 120);
    expect(g.x).toBeLessThanOrEqual(798);
    g.walls = []; g.x = 800; g.y = 138; g.ground = null; g.vy = 600;
    stepFactory(g, idle, 1 / 30); expect(g.y).toBeLessThanOrEqual(140.01); expect(g.vy).toBe(0);
  });
  for (const lane of [1, 3]) it('blocks the underside of floating platforms and leaves a bypass beside them', () => {
    const g = newFactoryGame(); g.state = 'playing'; g.x = mazeLaneX(lane); g.platforms[0].eaten = true;
    stepFactory(g, { ...idle, boost: true }, 1 / 120);
    for (let i = 0; i < 25; i++) stepFactory(g, idle, 1 / 120);
    expect(g.highest).toBeLessThanOrEqual(2.01);
    const bypass = newFactoryGame(); bypass.state = 'playing'; bypass.x = mazeLaneX(lane) + 80;
    stepFactory(bypass, { ...idle, boost: true }, 1 / 120);
    for (let i = 0; i < 42; i++) stepFactory(bypass, idle, 1 / 120);
    expect(bypass.highest).toBeGreaterThan(144);
  });
  it('freezes level one and the spikes during the countdown', () => {
    const g = newFactoryGame(); g.state = 'playing'; g.countdown = 3.7;
    for (let i = 0; i < 360; i++) stepFactory(g, { ...idle, right: true, boost: true }, 1 / 120);
    expect(g.highest).toBe(0); expect(g.x).toBe(800); expect(g.spikes).toBe(-260); expect(g.energy).toBe(100);
  });
  it('walks without gas or energy and gains lateral speed with a fart', () => {
    const g = newFactoryGame(); g.state = 'playing'; g.platforms[0].eaten = true; g.energy = 0;
    for (let i = 0; i < 30; i++) stepFactory(g, { ...idle, right: true }, 1 / 120);
    expect(g.x).toBeGreaterThan(850); expect(g.energy).toBe(0); expect(g.gas).toHaveLength(0); expect(g.events).toHaveLength(0);
    const walkingSpeed = g.vx; g.energy = 100;
    stepFactory(g, { ...idle, right: true, boost: true }, 1 / 120);
    expect(g.vx).toBeGreaterThan(walkingSpeed * 1.5); expect(g.events.some(e => e.type === 'boost')).toBe(true); expect(g.energy).toBeLessThan(100);
    g.y = g.spikes; stepFactory(g, idle, 1 / 120); expect(g.events.filter(e => e.type === 'death')).toHaveLength(1);
    stepFactory(g, idle, 1 / 120); expect(g.events).toHaveLength(0); expect(g.deathTime).toBeGreaterThan(0);
  });
  it('starts every checkpoint safely above the rising spikes', () => {
    for (let level = 0; level < 10; level++) {
      const g = newFactoryGame(level); expect(g.y - g.spikes).toBe(260); expect(g.ground).not.toBeNull();
    }
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
    for (let i = 0; i < 265; i++) stepFactory(g, idle, 1 / 120);
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
    const g = newFactoryGame(9); g.state = 'playing'; g.x = mazeLaneX(mazeOpenings(9, MAZE_TIERS_PER_LEVEL)[0], 9); g.y = FACTORY_TOP - 1; g.vy = 200;
    stepFactory(g, idle, 1 / 120); expect(g.state).toBe('won');
  });
  it('leans smoothly toward travel direction on the ground and relaxes when stopped', () => {
    const g = newFactoryGame(); g.state = 'playing';
    for (let i = 0; i < 30; i++) stepFactory(g, { ...idle, right: true }, 1 / 120);
    expect(g.lean).toBeGreaterThan(0.08);
    for (let i = 0; i < 60; i++) stepFactory(g, { ...idle, left: true }, 1 / 120);
    expect(g.lean).toBeLessThan(-0.08);
    for (let i = 0; i < 70; i++) stepFactory(g, idle, 1 / 120);
    expect(Math.abs(g.lean)).toBeLessThan(0.01);
  });
  it('drops poop only on long fart recordings and emits one impact when it reaches rising spikes', () => {
    const short = newFactoryGame(); short.state = 'playing';
    stepFactory(short, { ...idle, boost: true }, 1 / 120); expect(short.drops).toHaveLength(0);
    const g = newFactoryGame(); g.state = 'playing'; g.food = 2; g.platforms[0].eaten = true; g.x = mazeLaneX(1);
    stepFactory(g, { ...idle, boost: true }, 1 / 120); expect(g.drops).toHaveLength(6); expect(g.events.some(e => e.type === 'splat')).toBe(false);
    let impacts = 0;
    for (let i = 0; i < 240; i++) { stepFactory(g, idle, 1 / 120); impacts += g.events.filter(e => e.type === 'splat').length; }
    expect(impacts).toBe(6); expect(g.drops).toHaveLength(0);
  });
  it('announces each reached level once without losing the boost event and scores maximum ascent', () => {
    const g = newFactoryGame(); g.state = 'playing'; g.x = mazeLaneX(mazeOpenings(0, MAZE_TIERS_PER_LEVEL)[0]); g.y = FACTORY_HEIGHT - 1; g.ground = null;
    stepFactory(g, { ...idle, boost: true }, 1 / 120);
    expect(g.noticeLevel).toBe(1); expect(g.levelNotice).toBe(3.5); expect(g.events.map(e => e.type)).toEqual(['boost', 'level']);
    const points = factoryPoints(g); g.y = FACTORY_HEIGHT - 20;
    stepFactory(g, idle, 1 / 120); expect(g.levelNotice).toBeLessThan(3.5); expect(g.events.some(e => e.type === 'level')).toBe(false); expect(factoryPoints(g)).toBe(points);
  });
  it('emits the countdown sounds once at the same boundaries as the displayed digits', () => {
    const g = newFactoryGame(); g.state = 'playing'; g.countdown = 3.7;
    const beats: number[] = [];
    for (let i = 0; i < 444; i++) {
      stepFactory(g, idle, 1 / 120);
      for (const event of g.events) if (event.type === 'countdown') beats.push(event.beat!);
    }
    expect(beats).toEqual([2, 1, 0]); expect(g.highest).toBe(0); expect(g.energy).toBe(100);
  });

});
