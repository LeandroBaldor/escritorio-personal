import { describe, expect, it } from 'vitest';
import { newShark } from './shark';
import { stormLevels } from './sharkSound';

describe('Ciudad Tiburón: sonidos de la tormenta', () => {
  it('la lluvia y el viento suenan siempre y adentro de un departamento se escuchan más bajo', () => {
    const g = newShark(1);
    const out = stormLevels(g);
    expect(out.rain).toBeGreaterThan(0.5);
    expect(out.wind).toBeGreaterThan(0);
    g.player.inside = g.blocks[0].id;
    const inside = stormLevels(g);
    expect(inside.rain).toBeLessThan(out.rain);
    expect(inside.wind).toBeLessThan(out.wind);
  });

  it('el agua de la calle suena más fuerte cuanto más cerca está el bombero (y al máximo nadando)', () => {
    const g = newShark(1);
    g.player.inside = null; g.player.swimming = false;
    g.player.y = 12;
    const high = stormLevels(g).water;
    g.player.y = 0.5;
    const low = stormLevels(g).water;
    expect(low).toBeGreaterThan(high);
    g.player.swimming = true;
    expect(stormLevels(g).water).toBe(1);
  });

  it('la hélice de un tiburón volador se escucha desde lejos y más fuerte cuanto más cerca (al máximo cuando se tira)', () => {
    const g = newShark(1), p = g.player;
    expect(stormLevels(g).rotor).toBe(0); // todavía no hay voladores
    const f = { id: 1, type: 'blanco' as const, x: p.x + 18, y: p.y + 4.3, dir: -1 as const, state: 'cruise' as const, t: 0, vx: 0, vy: 0, cool: 0, dist: 0 };
    g.flyers = [f];
    const far = stormLevels(g).rotor;
    expect(far).toBeGreaterThan(0.2);
    f.x = p.x + 2;
    const near = stormLevels(g).rotor;
    expect(near).toBeGreaterThan(far);
    Object.assign(f, { state: 'dive' });
    expect(stormLevels(g).rotor).toBeGreaterThan(near);
  });
});
