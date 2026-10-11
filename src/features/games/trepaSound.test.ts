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

  it('cada objeto que se mueve suena según lo que es; los fijos no suenan', () => {
    const g = empty();
    const plat = { id: 2, kind: 'moving' as const, skin: 'tile' as const, x: 9, y: 50, w: 2, baseX: 9, baseY: 50, amp: 2, speed: 1, phase: 0, dx: 0, dy: 0, crumble: 0, gone: 0, belt: 0, hue: 0 };
    const heard = (p: Partial<typeof plat>) => { g.plats = [{ ...plat, ...p } as typeof plat]; const l = ambientLevels(g); return Object.entries(l).filter(([, v]) => v > 0.5).map(([k]) => k); };
    expect(heard({})).toEqual(['hover']);
    expect(heard({ kind: 'elevator', skin: 'lift' } as never)).toEqual(['motor']);
    expect(heard({ skin: 'zeppelin' } as never)).toEqual(['propeller']);
    expect(heard({ kind: 'elevator', skin: 'piston' } as never)).toEqual(['hydraulic']);
    expect(heard({ kind: 'elevator', skin: 'ufo' } as never)).toEqual(['ufo']);
    g.plats = [{ ...plat, kind: 'solid' } as never];
    expect(Object.values(ambientLevels(g)).every(v => v === 0)).toBe(true);
  });

  it('el globo aerostático ruge con el quemador cuando sube y apenas suena cuando baja', () => {
    const g = empty();
    const balloon = { id: 3, kind: 'elevator' as const, skin: 'basket' as const, x: 9, y: 50, w: 2, baseX: 9, baseY: 50, amp: 2, speed: 1, phase: 0, dx: 0, dy: 0.02, crumble: 0, gone: 0, belt: 0, hue: 0 };
    g.plats = [balloon];
    const up = ambientLevels(g).balloon;
    g.plats = [{ ...balloon, dy: -0.02 }];
    const down = ambientLevels(g).balloon;
    expect(up).toBeGreaterThan(0.5);
    expect(down).toBeGreaterThan(0);
    expect(down).toBeLessThan(up / 2);
  });

  it('los pájaros pían y los aviones rugen (y se escuchan desde más lejos)', () => {
    const g = empty();
    const bird = { id: 4, y: 50.4, x0: 11, x1: 11.001, speed: 0, phase: 0, skin: 'bird' as const };
    g.birds = [bird];
    expect(ambientLevels(g).bird).toBeGreaterThan(0.4);
    expect(ambientLevels(g).plane).toBe(0);
    g.birds = [{ ...bird, x0: 14.5, x1: 14.501, skin: 'plane' }];
    const plane = ambientLevels(g).plane;
    g.birds = [{ ...bird, x0: 14.5, x1: 14.501 }];
    expect(plane).toBeGreaterThan(ambientLevels(g).bird);
  });

  it('lo que está más lejos que media pantalla no se escucha', () => {
    const g = empty();
    g.fires = [{ ...fire, y: 50 + HEAR_RADIUS + 1 }];
    g.time = 0.1;
    expect(ambientLevels(g).fire).toBe(0);
  });
});
