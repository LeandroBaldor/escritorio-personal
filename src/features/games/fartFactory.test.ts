import { describe, expect, it } from 'vitest';
import { FACTORIES, FACTORY_HEIGHT, FACTORY_TOP, FOODS, hazardActive, hitsFactoryHazard, newFactoryGame, platformX, stepFactory } from './fartFactory';
import { factoryView } from './factoryScene';
import { FACTORY_FART_SOUNDS } from './factorySound';
const idle = { left: false, right: false, boost: false };
describe('Fábrica de Pedos', () => {
  it('has ten environments, ten meals and one supplied recording per meal', () => {
    expect(new Set(FACTORIES.map(f => f.motif)).size).toBe(10);
    expect(FOODS).toHaveLength(10); expect(new Set(FACTORY_FART_SOUNDS).size).toBe(10);
    expect(new Set(newFactoryGame().platforms.map(p => p.food)).size).toBe(10);
  });
  it('only awards victory at the tenth exit', () => {
    for (let level = 1; level < 10; level++) { const g = newFactoryGame(level); g.state = 'playing'; stepFactory(g, idle, 1 / 120); expect(g.state).toBe('playing'); }
    const g = newFactoryGame(9); g.state = 'playing'; g.y = FACTORY_TOP - 1; g.vy = 200;
    stepFactory(g, idle, 1 / 120); expect(g.state).toBe('won');
  });
  it('cannot rise without gas and cannot boost without energy', () => {
    const g = newFactoryGame(); g.state = 'playing'; g.platforms[0].eaten = true;
    for (let i = 0; i < 100; i++) stepFactory(g, idle, 1 / 120);
    expect(g.y).toBe(0); g.energy = 0; stepFactory(g, { ...idle, boost: true }, 1 / 120); expect(g.y).toBe(0);
  });
  it('uses ten distinct impulses and remembers the meal that produced the sound', () => {
    const velocities = FOODS.map((f, i) => {
      const g = newFactoryGame(); g.state = 'playing'; g.food = i; g.platforms[0].eaten = true;
      stepFactory(g, { ...idle, boost: true }, 1 / 120);
      expect(g.energy).toBe(100 - f.cost); expect(g.boostFood).toBe(i); expect(g.event).toBe('boost'); return g.vy;
    });
    expect(new Set(velocities).size).toBe(10);
    const g = newFactoryGame(); g.state = 'playing'; g.energy = 0;
    stepFactory(g, idle, 1 / 120); expect(g.energy).toBe(35);
    stepFactory(g, idle, 1 / 120); expect(g.energy).toBe(35);
  });
  it('keeps the old meal sound when another food is collected during the impulse', () => {
    const g = newFactoryGame(); g.state = 'playing'; g.ground = null; g.food = 1; g.y = 120;
    const p = g.platforms.find(p => p.row === 1 && p.lane === 2)!; g.x = platformX(p, 0);
    stepFactory(g, { ...idle, boost: true }, 1 / 120);
    expect(g.boostFood).toBe(1); expect(g.food).toBe(p.food); expect(g.event).toBe('boost');
  });
  for (const lane of [0, 1, 2, 3, 4]) it(`has a food-fueled route through all ten floors on path ${lane + 1}`, () => {
    const g = newFactoryGame(); g.state = 'playing'; g.hazards = [];
    // All five routes depart from the broad starting walkway.
    g.x = 180 + lane * 310;
    for (let row = 1; row <= 100;) {
      const p = g.platforms.find(p => p.row === row && (row % 10 === 0 || p.lane === lane))!;
      const checkpointX = g.x;
      let landed = false;
      for (let frame = 0; frame < 240; frame++) {
        const delta = (row % 10 === 0 ? checkpointX : platformX(p, g.time)) - g.x;
        stepFactory(g, { left: delta < -3, right: delta > 3, boost: frame === 0 }, 1 / 120);
        if (String(g.state) === 'won' || (g.ground !== null && g.platforms[g.ground].row >= row)) { landed = true; break; }
        expect(g.state, `path ${lane}, row ${row}, height ${g.y}`).toBe('playing');
      }
      expect(landed, `unreachable row ${row}`).toBe(true);
      if (String(g.state) === 'won') break;
      row = g.platforms[g.ground!].row + 1;
    }
    expect(g.state).toBe('won');
  });
  it('can cross to either adjacent route using the weakest impulse', () => {
    for (const lane of [1, 3]) {
      const g = newFactoryGame(); g.state = 'playing'; g.food = 2; g.hazards = []; g.platforms[0].eaten = true;
      const p = g.platforms.find(p => p.row === 1 && p.lane === lane)!;
      for (let frame = 0; frame < 200 && g.ground !== p.id; frame++) {
        const delta = platformX(p, g.time) - g.x;
        stepFactory(g, { left: delta < -3, right: delta > 3, boost: frame === 0 }, 1 / 120);
      }
      expect(g.ground).toBe(p.id);
    }
  });
  it('raises the floor continuously from the first frame without jumps', () => {
    const g = newFactoryGame(); g.state = 'playing';
    const initial = g.spikes; stepFactory(g, idle, 1 / 120); expect(g.spikes).toBeGreaterThan(initial);
    g.y = 800; g.highest = 800; const before = g.spikes; stepFactory(g, idle, 1 / 120);
    expect(g.spikes - before).toBeLessThan(10);
  });
  it('keeps the actual floor and the player visible on portrait, landscape and wide monitors', () => {
    for (const [w, h] of [[393, 851], [851, 393], [1440, 900], [2560, 1080]]) for (const gap of [95, 250, 550, 1000]) {
      const g = newFactoryGame(4); g.y = g.spikes + gap;
      const view = factoryView(g, w, h), spikeY = (view.h - (g.spikes - view.bottom)) * view.scale, heroY = (view.h - (g.y - view.bottom)) * view.scale;
      expect(spikeY).toBeCloseTo(h - 110); expect(heroY).toBeGreaterThan(105); expect(heroY).toBeLessThan(spikeY);
    }
  });
  it('collides with visible hazard areas, leaving the opposite side of the laser safe', () => {
    const g = newFactoryGame(); g.x = 810; g.time = 2;
    for (const kind of ['gear', 'door', 'fire', 'spikes', 'laser'] as const) expect(hitsFactoryHazard(g, { kind, x: 800, y: 50, phase: 0 }), kind).toBe(true);
    g.x = 740; expect(hitsFactoryHazard(g, { kind: 'laser', x: 800, y: 50, phase: 0 })).toBe(false);
    expect(hazardActive({ kind: 'laser', x: 0, y: 0, phase: 0 }, 0)).toBe(false);
    g.state = 'playing'; g.spikes = 0; stepFactory(g, idle, 1 / 120); expect(g.state).toBe('dead');
  });
  it('restarts safely at the reached factory', () => {
    const g = newFactoryGame(6); expect(g.y).toBe(6 * FACTORY_HEIGHT); expect(g.energy).toBe(100);
    expect(g.platforms[g.ground!].row).toBe(60); expect(g.spikes).toBeLessThan(g.y - 50);
  });
});
