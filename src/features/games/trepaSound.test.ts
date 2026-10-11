import { describe, expect, it } from 'vitest';
import { fireActive, newTrepa, type Trepa } from './trepaluna';
import { ambientLevels, HEAR_RADIUS } from './trepaSound';

// Un juego sin objetos, con el personaje parado en (8, 50), para probar un objeto por vez.
const empty = (): Trepa => {
  const g = newTrepa();
  Object.assign(g, { plats: [], fires: [], balls: [], birds: [], lasers: [], fans: [], magnets: [], gears: [], portals: [] });
  g.player.x = 8; g.player.y = 50;
  return g;
};
const fire = { id: 1, x: 8, y: 50, dir: 'up' as const, len: 2, period: 2, on: 0.5, phase: 0 };

describe('Trepaluna: sonidos de los objetos', () => {
  it('sin objetos cerca no suena nada', () => {
    expect(Object.values(ambientLevels(empty())).every(v => v === 0)).toBe(true);
  });

  it('el fuego suena solo mientras está prendido y más fuerte cuanto más cerca', () => {
    const g = empty();
    g.fires = [{ ...fire, x: 10 }];
    g.time = 0.1; expect(fireActive(g.fires[0], g.time)).toBe(true);
    const near = ambientLevels(g).fire;
    expect(near).toBeGreaterThan(0.4);
    g.fires = [{ ...fire, x: 13 }];
    const farther = ambientLevels(g).fire;
    expect(farther).toBeGreaterThan(0);
    expect(farther).toBeLessThan(near);
    g.time = 1.5; expect(fireActive(g.fires[0], g.time)).toBe(false);
    expect(ambientLevels(g).fire).toBe(0);
  });

  it('los pisos que se mueven y los montacargas suenan a motor; los fijos no suenan', () => {
    const g = empty();
    const plat = { id: 2, kind: 'moving' as const, skin: 'tile' as const, x: 9, y: 50, w: 2, baseX: 9, baseY: 50, amp: 2, speed: 1, phase: 0, dx: 0, dy: 0, crumble: 0, gone: 0, belt: 0, hue: 0 };
    g.plats = [plat];
    expect(ambientLevels(g).motor).toBeGreaterThan(0.5);
    g.plats = [{ ...plat, kind: 'elevator' }];
    expect(ambientLevels(g).motor).toBeGreaterThan(0.5);
    g.plats = [{ ...plat, kind: 'solid' }];
    expect(ambientLevels(g).motor).toBe(0);
  });

  it('lo que está más lejos que media pantalla no se escucha', () => {
    const g = empty();
    g.fires = [{ ...fire, y: 50 + HEAR_RADIUS + 1 }];
    g.time = 0.1;
    expect(ambientLevels(g).fire).toBe(0);
  });
});
