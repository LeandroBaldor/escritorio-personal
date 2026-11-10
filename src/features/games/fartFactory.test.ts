import { describe, expect, it } from 'vitest';
import { FACTORIES, FACTORY_HEIGHT, FACTORY_TOP, FOODS, hazardActive, newFactoryGame, platformX, stepFactory } from './fartFactory';

const idle = { left: false, right: false, boost: false };
describe('Fábrica de Pedos', () => {
  it('has ten different factories and only awards victory at the last exit', () => {
    expect(new Set(FACTORIES.map(f => f.motif)).size).toBe(10);
    for (let level = 1; level < 10; level++) {
      const g = newFactoryGame(level); g.state = 'playing';
      stepFactory(g, idle, 1 / 120); expect(g.state).toBe('playing');
    }
    const g = newFactoryGame(9); g.state = 'playing'; g.y = FACTORY_TOP - 1; g.vy = 200;
    stepFactory(g, idle, 1 / 120); expect(g.state).toBe('won');
  });
  it('cannot gain height without gas, and cannot boost without energy', () => {
    const g = newFactoryGame(); g.state = 'playing'; g.platforms[0].eaten = true;
    for (let i = 0; i < 100; i++) stepFactory(g, idle, 1 / 120);
    expect(g.y).toBe(0);
    g.energy = 0; stepFactory(g, { ...idle, boost: true }, 1 / 120); expect(g.y).toBe(0);
  });
  it('uses different impulse and energy for each meal; food cannot be eaten twice', () => {
    const velocities = FOODS.map((f, i) => {
      const g = newFactoryGame(); g.state = 'playing'; g.food = i; g.platforms[0].eaten = true;
      stepFactory(g, { ...idle, boost: true }, 1 / 120);
      expect(g.energy).toBe(100 - f.cost); return g.vy;
    });
    expect(new Set(velocities).size).toBe(4);
    const g = newFactoryGame(); g.state = 'playing'; g.energy = 0;
    stepFactory(g, idle, 1 / 120); expect(g.energy).toBe(35);
    stepFactory(g, idle, 1 / 120); expect(g.energy).toBe(35);
  });
  it('allows a food-fueled route through all 100 platforms without extra energy', () => {
    const g = newFactoryGame(); g.state = 'playing';
    // Test the platform route independently of traps, which have their own collision tests.
    g.hazards = [];
    for (let target = 1; target <= 100; target++) {
      const p = g.platforms[target];
      let landed = false;
      for (let frame = 0; frame < 240; frame++) {
        const delta = platformX(p, g.time) - g.x;
        stepFactory(g, { left: delta < -2, right: delta > 2, boost: frame === 0 }, 1 / 120);
        if (String(g.state) === 'won' || g.ground === target) { landed = true; break; }
        expect(g.state, `target ${target}, height ${g.y}`).toBe('playing');
      }
      expect(landed, `unreachable platform ${target}`).toBe(true);
      if (String(g.state) === 'won') break;
    }
    expect(g.state).toBe('won'); expect(g.energy).toBeGreaterThan(0);
  });
  it('kills on the rising spikes and on each active hazard', () => {
    const g = newFactoryGame(); g.state = 'playing'; g.spikes = 0;
    stepFactory(g, idle, 1 / 120); expect(g.state).toBe('dead');
    for (const kind of ['gear', 'laser', 'door', 'fire', 'spikes'] as const) {
      const s = newFactoryGame(); s.state = 'playing'; s.hazards = [{ kind, x: 320, y: 30, phase: 2 }];
      stepFactory(s, idle, 1 / 120); expect(s.state, kind).toBe('dead');
    }
    expect(hazardActive({ kind: 'laser', x: 0, y: 0, phase: 0 }, 0)).toBe(false);
  });
  it('restarts at the requested sector with a fresh supply and a safe floor', () => {
    const g = newFactoryGame(6); expect(g.y).toBe(6 * FACTORY_HEIGHT); expect(g.energy).toBe(100);
    expect(g.spikes).toBeLessThan(g.y - 100); expect(g.ground).toBe(60);
  });
});
