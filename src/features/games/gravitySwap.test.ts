import { describe, expect, it } from 'vitest';
import { CEIL, CHECKPOINTS, blackholeNear, bombCount, FLOOR, LEVELS, LEVEL_COUNT, LIVES, PLAYER_H, PLAYER_W, ROWS, angleDiff, buildLevel, chooseAngle, flipGravity, freeAngles, levelLength, newGame, step, takeEvents, type Game, type Hazard, type Input } from './gravitySwap';

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

  it('desde el primer escenario hay bombas y puertas, y el tercero tiene mucha densidad de trampas', () => {
    const level1 = buildLevel(1), level3 = buildLevel(3);
    expect(level1.hazards.some(h => h.kind === 'bomb' || h.kind === 'door')).toBe(true);
    // Un túnel angosto se arma con dos bloques (arriba y abajo) más anchos que los bloques sueltos.
    const tunnels = (n: number) => buildLevel(n).solids.filter(s => s.kind === 'block' && s.w >= 4).length;
    expect(tunnels(3) + tunnels(4) + tunnels(6) + tunnels(7)).toBeGreaterThan(0);
    // El nivel 3 tiene bastante más trampas por casillero que el 1: no se pasa de largo.
    const density = (layout: ReturnType<typeof buildLevel>) => layout.hazards.length / layout.portalX;
    expect(density(level3)).toBeGreaterThan(density(level1) * 1.1);
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

  it('la gravedad cambia de golpe, sin aviso, de a 90° (en los primeros escenarios)', () => {
    const game = empty();
    game.gravityIn = 0.2;
    run(game, 0.05);
    expect(game.angle).toBe(0); // todavía no cambió
    expect(takeEvents(game).some(e => e.type === 'flip')).toBe(false);
    run(game, 0.2);
    expect(takeEvents(game).some(e => e.type === 'flip')).toBe(true);
    expect(deg(game.angle) % 90).toBe(0);
    expect(deg(game.angle)).not.toBe(0);
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
  it('caminando apoyado suena un paso por pisada; flotando no', () => {
    const game = empty();
    run(game, 0.5); takeEvents(game);
    run(game, 3.5);
    const steps = takeEvents(game).filter(e => e.type === 'step').length;
    expect(steps).toBeGreaterThanOrEqual(9); // un paso cada π/9 ≈ 0,35 s
    expect(steps).toBeLessThanOrEqual(11);
    flipGravity(game, fixed, Math.PI); game.gravityIn = 999;
    run(game, 0.3); takeEvents(game);
    run(game, 0.3, { ...idle, down: true }); // impulsándose en el aire
    expect(takeEvents(game).some(e => e.type === 'step')).toBe(false);
  });

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

  it('el chorro siempre se nota: cayendo rápido, apretar para abajo (o para un costado) lo acelera más', () => {
    const speedAfter = (input: Input) => {
      const game = empty();
      game.solids = []; game.player.y = 2; game.player.onGround = false; // en el aire, sin piso cerca
      run(game, 0.6); // cae y llega a la velocidad de caída
      run(game, 0.5, input);
      return { vy: game.player.vy, vx: game.player.vx };
    };
    const free = speedAfter(idle), down = speedAfter({ ...idle, down: true }), right = speedAfter({ ...idle, right: true }), up = speedAfter({ ...idle, up: true });
    expect(down.vy).toBeGreaterThan(free.vy + 4);
    expect(right.vx).toBeGreaterThan(free.vx + 3);
    expect(up.vy).toBeLessThan(free.vy - 4);
  });

  it('con la gravedad para adelante (pantalla vertical), la flecha para abajo lo hace caer más rápido y la cámara lo sigue', () => {
    const fall = (input: Input) => {
      const game = empty();
      flipGravity(game, fixed, Math.PI / 2); game.gravityIn = 999;
      run(game, 1.5);
      const x = game.player.x;
      run(game, 1, input);
      return { dist: game.player.x - x, game };
    };
    const free = fall(idle), down = fall({ ...idle, down: true });
    expect(free.dist).toBeGreaterThan(6); // ya cae más rápido que el escenario (que va a 3 por segundo)
    expect(down.dist).toBeGreaterThan(free.dist + 4);
    expect(down.game.phase).toBe('play');
    expect(down.game.player.x - down.game.cam).toBeLessThanOrEqual(down.game.cols); // sigue en la pantalla
  });

  it('con la pantalla vertical, al acelerar para abajo se lo ve bajar por la pantalla (la cámara lo sigue con retraso)', () => {
    const game = empty();
    flipGravity(game, fixed, Math.PI / 2); game.gravityIn = 999;
    run(game, 2);
    const before = game.player.x - game.follow;
    run(game, 0.6, { ...idle, down: true });
    const after = game.player.x - game.follow;
    expect(after).toBeGreaterThan(before + 1); // queda más "abajo" en la pantalla
    expect(after).toBeLessThanOrEqual(4.2); // pero sin irse de la vista
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

describe('Gravity Swap: trampas nuevas', () => {
  it('una bomba explota sola cada tanto y mata si estás cerca', () => {
    const game = empty();
    game.hazards.push(hazard({ kind: 'bomb', x: game.player.x + PLAYER_W / 2, y: game.player.y + PLAYER_H / 2, side: 0, r: 0.42, period: 1, phase: 0 }));
    runUntil(game, () => game.phase === 'dead', 1.5);
    expect(game.death).toBe('blast');
  });

  it('la bomba muestra -- mientras espera, cuenta 3, 2, 1 con un pitido por número y explota', () => {
    const game = empty();
    game.hazards.push(hazard({ kind: 'bomb', x: 12, y: 5, side: 0, r: 0.42, period: 5, phase: 0.5 }));
    const bomb = game.hazards[0];
    expect(bombCount(game, bomb)).toBe(0); // faltan 4,5 s
    const beeps: number[] = [];
    let boom = false;
    for (let i = 0; i < 4.6 * 60 && !boom; i++) {
      game.cam = 0; game.player.x = 4; // que la bomba siga en la pantalla
      step(game, idle, 1 / 60, fixed);
      for (const e of takeEvents(game)) { if (e.type === 'beep') beeps.push(e.count); if (e.type === 'boom') boom = true; }
    }
    expect(beeps).toEqual([3, 2, 1]);
    expect(boom).toBe(true);
    expect(game.smoke.length).toBeGreaterThan(5);
  });

  it('una puerta cerrada bloquea el paso y, cuando se abre, se puede cruzar', () => {
    const game = empty();
    game.hazards.push(hazard({ kind: 'door', x: 9, y: CEIL, w: 1, h: FLOOR - CEIL, side: 0, period: 3, phase: 0 }));
    run(game, 1); // la puerta arranca cerrada: cycle 0..0.5
    expect(game.player.x).toBeLessThan(9);
    run(game, 2.2); // a mitad de ciclo se abre un rato
    expect(game.player.x).toBeGreaterThan(9);
    expect(game.phase).toBe('play');
  });

  it('al morir, la explosión es de sangre (no la de una bomba normal)', () => {
    const game = empty();
    game.hazards.push(hazard({ kind: 'spikes', x: 9, y: FLOOR - 0.55, w: 2, h: 0.55, side: 1 }));
    runUntil(game, () => game.phase === 'dead', 4);
    expect(game.blasts.some(b => !b.lethal)).toBe(true);
    expect(game.particles.length + game.drops.length).toBeGreaterThan(100);
  });
});

describe('Gravity Swap: monstruos, cometas, lásers nuevos y agujeros negros', () => {
  it('los escenarios son por lo menos 5 veces más largos que antes y tienen las trampas nuevas', () => {
    // Antes el primero medía 149 casilleros y la Luna 518.
    expect(levelLength(LEVELS[0])).toBeGreaterThanOrEqual(149 * 5);
    expect(levelLength(LEVELS[9])).toBeGreaterThanOrEqual(518 * 5);
    const all = new Set(Array.from({ length: LEVEL_COUNT }, (_, i) => buildLevel(i + 1).hazards.map(h => h.kind)).flat());
    for (const kind of ['monster', 'worm', 'comet', 'sweeper', 'scanner', 'blackhole', 'bomb', 'door', 'laser'] as const) expect(all.has(kind)).toBe(true);
    // Muchos lásers: en todos los escenarios hay, de los tres tipos, más de 12.
    for (let n = 1; n <= LEVEL_COUNT; n++) expect(buildLevel(n).hazards.filter(h => h.kind === 'laser' || h.kind === 'sweeper' || h.kind === 'scanner').length).toBeGreaterThanOrEqual(10);
  });

  it('hay agujeros negros en todos los escenarios, bastante seguido', () => {
    for (let n = 1; n <= LEVEL_COUNT; n++) expect(buildLevel(n).hazards.filter(h => h.kind === 'blackhole').length).toBeGreaterThanOrEqual(8);
  });

  it('el monstruo se despierta cuando te acercás y te persigue', () => {
    const game = empty();
    game.hazards.push(hazard({ kind: 'monster', x: 20, y: 3, x0: 20, y0: 3, r: 0.48, amp: 0.5, speed: 3.5, aim: Math.PI }));
    run(game, 0.3);
    expect(game.hazards[0].state).toBe(0);
    runUntil(game, () => game.hazards[0].state === 1, 3);
    expect(takeEvents(game).some(e => e.type === 'roar')).toBe(true);
    runUntil(game, () => game.phase === 'dead', 6);
    expect(game.death).toBe('monster');
  });

  it('el gusano sale del piso cada tanto y te traga', () => {
    const game = empty();
    game.hazards.push(hazard({ kind: 'worm', x: 8, y: FLOOR, w: 0.9, side: 1, period: 2, len: 3.5, phase: 0 }));
    run(game, 0.5);
    expect(game.phase).toBe('play'); // todavía no salió
    runUntil(game, () => game.phase === 'dead', 2);
    expect(game.death).toBe('worm');
  });

  it('el cometa avisa por dónde va a pasar, cruza el pasillo en diagonal y explota contra la pared', () => {
    const game = empty();
    game.player.y = CEIL; // lejos de su camino
    game.hazards.push(hazard({ kind: 'comet', x: 12, x0: 12, y: 5, side: 1, r: 0.45, len: 6 }));
    flipGravity(game, fixed, Math.PI); game.gravityIn = 999;
    run(game, 0.1);
    expect(game.hazards[0].state).toBe(1); // aviso
    run(game, 0.9);
    expect(game.hazards[0].state).toBe(2);
    expect(takeEvents(game).some(e => e.type === 'comet')).toBe(true);
    runUntil(game, () => game.hazards[0].dead, 2);
    expect(game.hazards[0].y).toBeGreaterThan(FLOOR - 0.5);
    expect(game.blasts.some(b => b.lethal)).toBe(true);
  });

  it('el láser giratorio y el que sube y baja también matan', () => {
    const a = empty();
    a.hazards.push(hazard({ kind: 'sweeper', x: 9, y: FLOOR - 0.4, len: 3, speed: 0, phase: 0 })); // quieto y acostado, a la altura del astronauta
    runUntil(a, () => a.phase === 'dead', 3);
    expect(a.death).toBe('laser');
    const b = empty();
    b.hazards.push(hazard({ kind: 'scanner', x: 9, y: 5, w: 4, h: 0.2, amp: 3.6, speed: 1, phase: 0 })); // (con amp 3 no llega a tocar a uno apoyado en el piso)
    runUntil(b, () => b.phase === 'dead', 6);
    expect(b.death).toBe('laser');
  });

  it('las puertas suenan al abrirse y al cerrarse, y el agujero negro suena más fuerte cuanto más cerca', () => {
    const game = empty();
    game.hazards.push(hazard({ kind: 'door', x: 12, y: CEIL, w: 1, h: FLOOR - CEIL, side: 0, period: 3, phase: 0 }));
    run(game, 3);
    const doors = takeEvents(game).filter(e => e.type === 'door');
    expect(doors.map(e => e.type === 'door' && e.opening)).toEqual([true, false]);
    const hole = empty();
    expect(blackholeNear(hole)).toBe(0);
    hole.hazards.push(hazard({ kind: 'blackhole', x: hole.player.x + 6, y: 5, r: 0.45, len: 4.5, amp: 0 }));
    const far = blackholeNear(hole);
    hole.hazards[0].x = hole.player.x + 2;
    expect(far).toBeGreaterThan(0);
    expect(blackholeNear(hole)).toBeGreaterThan(far);
  });

  it('el agujero negro te chupa; con los chorros te escapás y si llegás al centro te traga', () => {
    const pulled = empty();
    pulled.hazards.push(hazard({ kind: 'blackhole', x: 9, y: 6.5, r: 0.45, len: 4.5, amp: 25 }));
    runUntil(pulled, () => pulled.phase === 'dead', 5);
    expect(pulled.death).toBe('blackhole');
    // Impulsándose para atrás y para abajo no llega a tragarlo.
    const escape = empty();
    escape.hazards.push(hazard({ kind: 'blackhole', x: 12, y: 6.5, r: 0.45, len: 4.5, amp: 25 }));
    run(escape, 1.5, { ...idle, down: true, left: true });
    expect(escape.death).not.toBe('blackhole');
  });
});

describe('Gravity Swap: banderas', () => {
  it('cada escenario tiene banderas con lugar libre alrededor', () => {
    for (let n = 1; n <= LEVEL_COUNT; n++) {
      const layout = buildLevel(n);
      expect(layout.checkpoints).toHaveLength(CHECKPOINTS.length);
      for (const c of layout.checkpoints) {
        expect(layout.hazards.some(h => h.kind !== 'ufo' && h.x > c - 2 && h.x < c + 9)).toBe(false);
        expect(layout.solids.some(s => s.kind !== 'ground' && s.x < c + 9 && s.x + s.w > c - 2)).toBe(false);
      }
    }
  });

  it('al pasar una bandera, si morís volvés ahí (y no al principio)', () => {
    const game = empty();
    const flag = game.checkpoints[1];
    game.cam = flag - 6; game.player.x = flag - 2;
    run(game, 1);
    expect(game.checkpoint).toBe(flag);
    expect(takeEvents(game).some(e => e.type === 'checkpoint')).toBe(true);
    game.player.y = ROWS + 2;
    run(game, 1.9);
    expect(game.phase).toBe('play');
    expect(game.lives).toBe(LIVES - 1);
    expect(game.player.x).toBeGreaterThan(flag);
    expect(game.player.x).toBeLessThan(flag + 3);
  });
});

describe('Gravity Swap: sangre', () => {
  it('al morir salta mucha sangre, pedazos del traje y quedan manchas pegadas donde cae', () => {
    const game = empty();
    game.hazards.push(hazard({ kind: 'spikes', x: 9, y: FLOOR - 0.55, w: 2, h: 0.55, side: 1 }));
    runUntil(game, () => game.phase === 'dead', 4);
    expect(game.drops.length).toBeGreaterThan(100);
    expect(game.gibs.length).toBeGreaterThan(5);
    expect(game.shake).toBeGreaterThan(0.5);
    expect(game.stains.some(s => s.kind === 'pool')).toBe(true); // el charco en el piso
    run(game, 1.5);
    expect(game.stains.filter(s => s.kind === 'splat').length).toBeGreaterThan(30);
    // Las manchas quedan después de volver a aparecer.
    run(game, 0.5);
    expect(game.phase).toBe('play');
    expect(game.stains.length).toBeGreaterThan(30);
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
    for (let i = 0; i < LIVES; i++) { game.player.y = ROWS + 2; run(game, 1.9); }
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
