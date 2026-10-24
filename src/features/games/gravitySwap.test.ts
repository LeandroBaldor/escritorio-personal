import { describe, expect, it } from 'vitest';
import { CEIL, FLOOR, LEVELS, LEVEL_COUNT, LIVES, PLAYER_H, ROWS, WARN_SECONDS, buildLevel, flipGravity, levelLength, newGame, step, takeEvents, type Game, type Input } from './gravitySwap';

const idle: Input = { left: false, right: false, jump: false };
const fixed = () => 0.5;
const run = (game: Game, seconds: number, input = idle) => { for (let t = 0; t < seconds; t += 1 / 60) step(game, input, 1 / 60, fixed); };
const runUntil = (game: Game, done: () => boolean, seconds: number) => { for (let t = 0; t < seconds && !done(); t += 1 / 60) step(game, idle, 1 / 60, fixed); };
// Un escenario sin trampas ni pozos, para probar el movimiento.
const empty = (level = 1) => {
  const game = newGame(level, 16, undefined, fixed);
  game.hazards = [];
  game.solids = game.solids.filter(s => s.kind === 'ground');
  game.solids = [{ x: -40, y: FLOOR, w: 2000, h: 2, kind: 'ground' }, { x: -40, y: CEIL - 2, w: 2000, h: 2, kind: 'ground' }];
  game.gravityIn = 999;
  return game;
};

describe('Gravity Swap: escenarios', () => {
  it('hay 10 escenarios, cada vez más largos, más rápidos y con cambios de gravedad más seguidos', () => {
    expect(LEVELS).toHaveLength(LEVEL_COUNT);
    for (let i = 1; i < LEVELS.length; i++) {
      expect(levelLength(LEVELS[i])).toBeGreaterThanOrEqual(levelLength(LEVELS[i - 1]));
      expect(LEVELS[i].speed[1]).toBeGreaterThan(LEVELS[i - 1].speed[1]);
      expect(LEVELS[i].flip[1]).toBeLessThanOrEqual(LEVELS[i - 1].flip[1]);
    }
    expect(LEVELS.map(l => l.name)).toEqual(['Ciudad Futurista', 'Minas Espaciales', 'Base en el Espacio', 'Planeta Helado', 'Planeta Volcánico', 'El Orden Inverso', 'Fábrica Robótica', 'Bosque Bioluminiscente', 'Torres en la Tormenta', 'La Luna']);
  });

  it('cada escenario se arma siempre igual, con el principio libre y todo dentro de la pantalla', () => {
    for (let n = 1; n <= LEVEL_COUNT; n++) {
      const a = buildLevel(n), b = buildLevel(n);
      expect(a.hazards.map(h => [h.kind, h.x, h.y])).toEqual(b.hazards.map(h => [h.kind, h.x, h.y]));
      expect(a.hazards.length).toBeGreaterThan(5);
      for (const h of a.hazards) {
        if (h.kind === 'ufo') continue;
        expect(h.x).toBeGreaterThanOrEqual(15);
        expect(h.x).toBeLessThan(a.portalX);
        if (h.kind !== 'fireball' && h.kind !== 'meteor') { expect(h.y).toBeGreaterThanOrEqual(CEIL - 0.3); expect(h.y).toBeLessThanOrEqual(FLOOR + 0.1); }
      }
      // Ningún pozo es tan ancho que no se pueda saltar, y el final (hasta el portal) está libre.
      const ground = a.solids.filter(s => s.kind === 'ground');
      for (const y of [FLOOR, CEIL - 2]) {
        const row = ground.filter(s => s.y === y).sort((p, q) => p.x - q.x);
        for (let i = 1; i < row.length; i++) expect(row[i].x - (row[i - 1].x + row[i - 1].w)).toBeLessThan(3.2);
        expect(row.some(s => s.x <= a.portalX - 8 && s.x + s.w >= a.portalX + 4)).toBe(true);
      }
    }
  });

  it('cada escenario tiene sus trampas propias', () => {
    const kinds = (n: number) => new Set(buildLevel(n).hazards.map(h => h.kind));
    expect(kinds(2).has('asteroid') || kinds(2).has('proxMine')).toBe(true);
    expect(kinds(4).has('icicle')).toBe(true);
    expect(kinds(5).has('fireball') || kinds(5).has('geyser')).toBe(true);
    expect(kinds(7).has('press')).toBe(true);
    expect(kinds(9).has('lightning')).toBe(true);
    expect(kinds(10).has('ufo')).toBe(true);
  });
});

describe('Gravity Swap: gravedad y movimiento', () => {
  it('el escenario avanza solo y el astronauta corre en el piso con él', () => {
    const game = empty();
    run(game, 2);
    expect(game.cam).toBeGreaterThan(5);
    expect(game.player.x - game.cam).toBeCloseTo(4, 0);
    expect(game.player.onGround).toBe(true);
    expect(game.player.y + PLAYER_H).toBeCloseTo(FLOOR, 2);
  });

  it('avisa un segundo antes de cambiar la gravedad y después cae hacia el techo', () => {
    const game = empty();
    game.gravityIn = 1.5;
    run(game, 0.6);
    expect(takeEvents(game).some(e => e.type === 'warn')).toBe(true);
    expect(game.gravityIn).toBeLessThanOrEqual(WARN_SECONDS);
    expect(game.player.grav).toBe(1);
    run(game, 1);
    expect(game.player.grav).toBe(-1);
    game.gravityIn = 999;
    run(game, 1.5);
    expect(game.player.onGround).toBe(true);
    expect(game.player.y).toBeCloseTo(CEIL, 2);
  });

  it('salta desde el techo (hacia abajo) y vuelve a pegarse al techo', () => {
    const game = empty();
    flipGravity(game, fixed); game.gravityIn = 999;
    run(game, 1.5);
    run(game, 0.15, { ...idle, jump: true });
    expect(game.player.y).toBeGreaterThan(CEIL + 0.8);
    run(game, 1.5);
    expect(game.player.y).toBeCloseTo(CEIL, 2);
  });

  it('se mueve para adelante o para atrás, pero solo dentro de la pantalla', () => {
    const game = empty();
    run(game, 3, { ...idle, right: true });
    expect(game.player.x - game.cam).toBeLessThanOrEqual(game.cols * 0.62);
    run(game, 3, { ...idle, left: true });
    expect(game.player.x - game.cam).toBeGreaterThanOrEqual(0.1);
    expect(game.phase).toBe('play');
  });

  it('El Orden Inverso empieza con la gravedad dada vuelta', () => {
    const game = newGame(6, 16, undefined, fixed);
    expect(game.player.grav).toBe(-1);
    expect(game.player.y).toBe(CEIL);
  });
});

describe('Gravity Swap: vidas y portal', () => {
  it('al tocar unos pinchos pierde una vida y vuelve al principio del escenario', () => {
    const game = empty();
    game.hazards.push({ id: 1, kind: 'spikes', x: 9, y: FLOOR - 0.55, w: 2, h: 0.55, side: 1, phase: 0, period: 1, len: 0, amp: 0, speed: 0, r: 0, x0: 9, y0: 0, vx: 0, vy: 0, push: 0, active: false, state: 0, timer: 0, dead: false, aim: 0 });
    runUntil(game, () => game.phase === 'dead', 4);
    expect(game.death).toBe('spikes');
    expect(game.stats.deaths).toBe(1);
    expect(game.lives).toBe(LIVES - 1);
    runUntil(game, () => game.phase === 'play', 2);
    expect(game.cam).toBeLessThan(0.2);
    expect(game.player.x).toBeCloseTo(4, 0);
  });

  it('una pared que no salta lo empuja contra el borde de la pantalla y lo aplasta', () => {
    const game = empty();
    game.solids.push({ x: 8, y: FLOOR - 2, w: 1, h: 2, kind: 'block' });
    runUntil(game, () => game.phase === 'dead', 5);
    expect(game.death).toBe('edge');
  });

  it('con 3 muertes se termina la partida', () => {
    const game = empty();
    for (let i = 0; i < LIVES; i++) { game.player.y = ROWS + 2; run(game, 1.4); }
    expect(game.phase).toBe('over');
    expect(game.lives).toBe(0);
  });

  it('al llegar al portal pasa al escenario siguiente con las vidas completas', () => {
    const game = empty();
    game.lives = 1;
    game.cam = game.portalX - game.cols + 3; game.player.x = game.portalX - 1;
    run(game, 0.2);
    expect(game.phase).toBe('cleared');
    expect(takeEvents(game).some(e => e.type === 'cleared')).toBe(true);
    run(game, 2.5);
    expect(game.level).toBe(2);
    expect(game.lives).toBe(LIVES);
    expect(game.stats.levels).toBe(1);
  });

  it('al pasar la Luna se gana la misión', () => {
    const game = newGame(10, 16, undefined, fixed);
    game.hazards = [];
    game.cam = game.portalX - game.cols + 3; game.player.x = game.portalX - 1; game.gravityIn = 999;
    run(game, 0.3);
    run(game, 8);
    expect(game.phase).toBe('won');
    expect(game.stats.levels).toBe(10);
  });
});
