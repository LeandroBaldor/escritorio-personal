import { describe, expect, it } from 'vitest';
import { CEIL, FLOOR, LEVELS, LEVEL_COUNT, LIVES, PLAYER_H, PLAYER_W, ROWS, WARN_SECONDS, angleDiff, buildLevel, chooseAngle, flipGravity, freeAngles, levelLength, newGame, step, takeEvents, type Game, type Hazard, type Input } from './gravitySwap';

const idle: Input = { left: false, right: false, up: false, down: false };
const fixed = () => 0.5;
const run = (game: Game, seconds: number, input = idle) => { for (let t = 0; t < seconds; t += 1 / 60) step(game, input, 1 / 60, fixed); };
const runUntil = (game: Game, done: () => boolean, seconds: number) => { for (let t = 0; t < seconds && !done(); t += 1 / 60) step(game, idle, 1 / 60, fixed); };
// Un escenario sin trampas ni pozos, para probar el movimiento.
const empty = (level = 1) => {
  const game = newGame(level, 16, undefined, fixed);
  game.hazards = [];
  game.solids = [{ x: -40, y: FLOOR, w: 2000, h: 2, kind: 'ground' }, { x: -40, y: CEIL - 2, w: 2000, h: 2, kind: 'ground' }];
  game.gravityIn = 999;
  return game;
};
const hazard = (fields: Partial<Hazard>): Hazard => ({ id: 1, kind: 'spikes', x: 0, y: 0, w: 1, h: 1, side: 0, phase: 0, period: 1, len: 0, amp: 0, speed: 0, r: 0.35, x0: 0, y0: 0, vx: 0, vy: 0, push: 0, active: false, state: 0, timer: 0, dead: false, aim: 0, ...fields });
const deg = (a: number) => Math.round(a * 180 / Math.PI) % 360;

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

  it('cada escenario se arma siempre igual, con el principio libre y todo dentro del pasillo', () => {
    for (let n = 1; n <= LEVEL_COUNT; n++) {
      const a = buildLevel(n), b = buildLevel(n);
      expect(a.hazards.map(h => [h.kind, h.x, h.y])).toEqual(b.hazards.map(h => [h.kind, h.x, h.y]));
      for (const h of a.hazards) {
        if (h.kind === 'ufo') continue;
        expect(h.x).toBeGreaterThanOrEqual(15);
        expect(h.x).toBeLessThan(a.portalX);
        if (h.kind !== 'fireball' && h.kind !== 'meteor') { expect(h.y).toBeGreaterThanOrEqual(CEIL - 0.3); expect(h.y).toBeLessThanOrEqual(FLOOR + 0.1); }
      }
      const ground = a.solids.filter(s => s.kind === 'ground');
      for (const y of [FLOOR, CEIL - 2]) expect(ground.some(s => s.y === y && s.x <= a.portalX - 8 && s.x + s.w >= a.portalX + 4)).toBe(true);
    }
  });

  it('cada escenario tiene sus trampas propias', () => {
    const kinds = (n: number) => new Set(buildLevel(n).hazards.map(h => h.kind));
    expect(kinds(4).has('icicle')).toBe(true);
    expect(kinds(7).has('press')).toBe(true);
    expect(kinds(9).has('lightning')).toBe(true);
    expect(kinds(10).has('ufo')).toBe(true);
  });
});

describe('Gravity Swap: gravedad que gira', () => {
  it('el escenario avanza solo y el astronauta queda apoyado en el piso', () => {
    const game = empty();
    run(game, 2);
    expect(game.cam).toBeGreaterThan(5);
    expect(game.player.x - game.cam).toBeCloseTo(4, 0);
    expect(game.player.onGround).toBe(true);
    expect(game.player.y + PLAYER_H).toBeCloseTo(FLOOR, 2);
  });

  it('avisa un segundo antes y después la gravedad gira de a 90° (en los primeros escenarios)', () => {
    const game = empty();
    game.gravityIn = 1.5;
    run(game, 0.6);
    expect(takeEvents(game).some(e => e.type === 'warn')).toBe(true);
    expect(game.gravityIn).toBeLessThanOrEqual(WARN_SECONDS);
    const next = game.nextAngle;
    expect(deg(next) % 90).toBe(0);
    expect(deg(next)).not.toBe(0);
    run(game, 1);
    expect(game.angle).toBeCloseTo(next, 5);
  });

  it('desde el escenario 5 puede quedar en cualquier ángulo, siempre bastante distinto del anterior', () => {
    expect(freeAngles(LEVELS[3])).toBe(false);
    expect(freeAngles(LEVELS[4])).toBe(true);
    const game = empty(5);
    const angles = Array.from({ length: 30 }, (_, i) => chooseAngle(game, () => (i * 0.137) % 1));
    expect(angles.some(a => deg(a) % 90 !== 0)).toBe(true);
    for (const a of angles) expect(Math.abs(angleDiff(a, game.angle))).toBeGreaterThanOrEqual(Math.PI / 4 - 1e-6);
  });

  it('la pantalla gira de a poco hasta que la gravedad apunta hacia abajo', () => {
    const game = empty();
    flipGravity(game, fixed, Math.PI / 2); game.gravityIn = 999;
    run(game, 0.1);
    expect(game.view).toBeGreaterThan(0.05);
    expect(game.view).toBeLessThan(Math.PI / 2 - 0.1);
    run(game, 2);
    expect(game.view).toBeCloseTo(Math.PI / 2, 2);
  });

  it('flota hacia donde tira la gravedad: al techo con 180° y para adelante con 90°', () => {
    const game = empty();
    flipGravity(game, fixed, Math.PI); game.gravityIn = 999;
    run(game, 2.5);
    expect(game.player.touch.up).toBe(true);
    expect(game.player.y).toBeCloseTo(CEIL, 2);
    flipGravity(game, fixed, Math.PI / 2); game.gravityIn = 999;
    const before = game.player.x - game.cam;
    run(game, 2.5);
    expect(game.player.x - game.cam).toBeGreaterThan(before + 3);
  });

  it('El Orden Inverso empieza con la gravedad dada vuelta', () => {
    const game = newGame(6, 16, undefined, fixed);
    expect(deg(game.angle)).toBe(180);
    expect(game.player.y).toBe(CEIL);
  });
});

describe('Gravity Swap: chorros de oxígeno', () => {
  it('el chorro lo despega del piso, y el tanque no se termina nunca', () => {
    const game = empty();
    run(game, 0.5);
    run(game, 0.6, { ...idle, up: true });
    expect(game.player.y + PLAYER_H).toBeLessThan(FLOOR - 1);
    // 20 segundos seguidos impulsándose (contra el techo) sin quedarse sin aire.
    run(game, 20, { ...idle, up: true });
    expect(game.phase).toBe('play');
    expect(game.player.touch.up).toBe(true);
  });

  it('las flechas son de la pantalla girada: con la gravedad para adelante, "arriba" lo lleva para atrás', () => {
    const game = empty();
    flipGravity(game, fixed, Math.PI / 2); game.gravityIn = 999;
    run(game, 2.5);
    const before = game.player.x - game.cam;
    run(game, 0.8, { ...idle, up: true });
    expect(game.player.x - game.cam).toBeLessThan(before - 1);
  });
});

describe('Gravity Swap: vidas y portal', () => {
  it('al tocar unos pinchos pierde una vida y vuelve al principio del escenario', () => {
    const game = empty();
    game.hazards.push(hazard({ kind: 'spikes', x: 9, y: FLOOR - 0.55, w: 2, h: 0.55, side: 1 }));
    runUntil(game, () => game.phase === 'dead', 4);
    expect(game.death).toBe('spikes');
    expect(game.lives).toBe(LIVES - 1);
    runUntil(game, () => game.phase === 'play', 2);
    expect(game.cam).toBeLessThan(0.2);
    expect(game.player.x).toBeCloseTo(4, 0);
  });

  it('una pared que no esquiva lo empuja contra el borde de la pantalla y lo aplasta', () => {
    const game = empty();
    game.solids.push({ x: 8, y: CEIL, w: 1, h: FLOOR - CEIL, kind: 'block' });
    runUntil(game, () => game.phase === 'dead', 6);
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
    run(game, 0.3);
    expect(game.phase).toBe('cleared');
    run(game, 2.5);
    expect(game.level).toBe(2);
    expect(game.lives).toBe(LIVES);
    expect(game.stats.levels).toBe(1);
  });

  it('al pasar la Luna se gana la misión', () => {
    const game = newGame(10, 16, undefined, fixed);
    game.hazards = [];
    game.cam = game.portalX - game.cols + 3; game.player.x = game.portalX - PLAYER_W - 0.5; game.player.y = 4.5; game.gravityIn = 999;
    run(game, 0.5);
    run(game, 8);
    expect(game.phase).toBe('won');
    expect(game.stats.levels).toBe(10);
  });
});
