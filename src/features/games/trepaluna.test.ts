import { describe, expect, it } from 'vitest';
import { ballPos, buildCourse, FALL_LOSE, fireActive, fireRect, gravityAt, JUMP, jumpPeak, meters, moonOf, newTrepa, step, takeEvents, TRAMP, ZONES, type Input, type Plat, type Trepa } from './trepaluna';

const idle: Input = { left: false, right: false, jump: false, down: false };
const run = (g: Trepa, seconds: number, input: Partial<Input> = {}) => {
  for (let t = 0; t < seconds; t += 1 / 60) step(g, { ...idle, ...input }, 1 / 60);
};
// Deja solo el piso y las plataformas que se pasan, para probar una cosa por vez.
const only = (g: Trepa, ...plats: Partial<Plat>[]) => {
  const ground = g.plats[0];
  g.plats = [ground, ...plats.map((p, i) => ({ ...ground, id: 900 + i, kind: 'solid' as const, skin: 'beam' as const, baseX: p.x ?? 0, baseY: p.y ?? 0, ...p }))];
  g.climbs = []; g.fires = []; g.balls = []; g.birds = [];
  return g.plats.slice(1);
};

describe('Trepaluna: recorrido', () => {
  const course = buildCourse();

  it('siempre es el mismo y va de la calle a la Luna a 6.000 m', () => {
    const again = buildCourse();
    expect(again.plats.map(p => [p.skin, p.x, p.y])).toEqual(course.plats.map(p => [p.skin, p.x, p.y]));
    const moon = moonOf(course);
    expect(moon.kind).toBe('moon');
    expect(meters(moon.y)).toBeGreaterThan(5950);
    expect(meters(moon.y)).toBeLessThan(6150);
    expect(ZONES.tech).toBe(ZONES.moon / 2); // lo tecnológico arranca en la mitad
  });

  it('tiene muchas estructuras distintas en cada etapa', () => {
    const skins = new Set(course.plats.map(p => p.skin));
    for (const s of ['terrace', 'balcony', 'step', 'beam', 'tile', 'spring', 'bricks', 'basket', 'zeppelin', 'asteroid', 'ufo', 'rocket']) expect(skins.has(s as Plat['skin']), s).toBe(true);
    expect(new Set(course.climbs.map(c => c.skin))).toEqual(new Set(['ladder', 'rope', 'truss']));
    expect(course.fires.filter(f => f.dir === 'up').length).toBeGreaterThanOrEqual(2);
    expect(course.fires.filter(f => f.dir !== 'up').length).toBeGreaterThan(3);
    expect(course.balls.length).toBeGreaterThan(0);
    // Desde la mitad del recorrido (3.000 m) todo se vuelve tecnológico.
    for (const s of ['neon', 'hologram', 'glass', 'techTile']) expect(skins.has(s as Plat['skin']), s).toBe(true);
    for (const list of [course.lasers, course.fans, course.magnets, course.gears, course.portals]) expect(list.length).toBeGreaterThan(0);
    expect(course.lasers.some(l => l.style === 'zap')).toBe(true);
    expect([...course.lasers.map(l => l.y), ...course.fans.map(f => f.y1), ...course.magnets.map(m => m.y1), ...course.gears.map(g => g.y), ...course.portals.map(o => o.y1)].every(y => y >= ZONES.tech)).toBe(true);
    expect(course.plats.filter(p => p.y < ZONES.tech).some(p => ['neon', 'hologram', 'glass', 'techTile', 'piston'].includes(p.skin))).toBe(false);
    expect(course.birds.length).toBeGreaterThan(0);
    expect(course.facades.length).toBeGreaterThan(0);
    // En la ciudad hay edificios enfrentados; arriba de los 1.000 m ya no.
    expect(course.facades.every(f => f.y2 < ZONES.sky)).toBe(true);
    expect(course.plats.filter(p => p.y > ZONES.sky + 3).some(p => ['terrace', 'balcony'].includes(p.skin))).toBe(false);
  });

  it('cada estructura se alcanza desde la anterior: saltando, con trampolín, trepando o caminando', () => {
    const reached = new Set(course.links.map(l => l.to));
    for (const p of course.plats.slice(1)) expect(reached.has(p.id), `plataforma ${p.id} (${p.skin})`).toBe(true);
    for (const l of course.links) {
      const where = `${l.mode} ${l.from}→${l.to} a ${meters(l.fromY)} m`;
      expect(l.dy, where).toBeGreaterThan(0);
      if (l.mode === 'jump') { expect(l.dy, where).toBeLessThan(jumpPeak(JUMP, l.fromY) - 0.15); expect(l.edge, where).toBeLessThanOrEqual(3); }
      if (l.mode === 'tramp') { expect(l.dy, where).toBeLessThan(jumpPeak(TRAMP, l.fromY) - 0.4); expect(l.edge, where).toBeLessThanOrEqual(2.5); }
      if (l.mode === 'walk') { expect(l.dy, where).toBeLessThanOrEqual(0.6); expect(l.edge, where).toBeLessThan(0.05); }
    }
  });

  it('los caños de fuego se apagan un rato largo para poder pasar', () => {
    for (const f of course.fires) {
      expect(f.on).toBeLessThan(0.5);
      expect(f.period * (1 - f.on)).toBeGreaterThan(1);
    }
  });
});

describe('Trepaluna: movimiento', () => {
  it('salta, atraviesa una plataforma desde abajo y cae parado arriba', () => {
    const g = newTrepa();
    only(g, { x: 6, y: 2, w: 4 });
    g.player.x = 8;
    run(g, 0.05, { jump: true });
    run(g, 1.2);
    expect(g.player.ground?.id).toBe(900);
    expect(g.player.y).toBe(2);
    expect(takeEvents(g).some(e => e.type === 'jump')).toBe(true);
  });

  it('los escalones bajitos de la escalera en zigzag se suben caminando', () => {
    const g = newTrepa();
    only(g, { x: 8.5, y: 0.45, w: 0.85, skin: 'step' }, { x: 9.2, y: 0.9, w: 0.85, skin: 'step' }, { x: 9.9, y: 1.35, w: 1.8, skin: 'step' });
    g.player.x = 7.5;
    run(g, 0.55, { right: true });
    expect(g.player.ground?.id).toBe(902);
    expect(g.player.y).toBeCloseTo(1.35);
  });

  it('el trampolín lo tira mucho más alto', () => {
    const g = newTrepa();
    const [tramp] = only(g, { x: 7, y: 2, w: 2, kind: 'tramp', skin: 'spring' });
    Object.assign(g.player, { x: 8, y: 3, ground: null, vy: 0 });
    let top = 0;
    for (let i = 0; i < 90; i++) { step(g, idle, 1 / 60); top = Math.max(top, g.player.y); }
    expect(top - tramp.y).toBeGreaterThan(6);
  });

  it('se agarra de la escalera, la trepa manteniendo saltar y se suelta con un costado', () => {
    const g = newTrepa();
    only(g);
    g.climbs = [{ id: 1, x: 8, y1: 0.1, y2: 9, skin: 'ladder' }];
    Object.assign(g.player, { x: 8, y: 1, ground: null, vy: 0 });
    step(g, { ...idle, jump: true }, 1 / 60);
    expect(g.player.climb).not.toBeNull();
    run(g, 0.5, { jump: true });
    expect(g.player.y).toBeGreaterThan(2.5);
    step(g, { ...idle, right: true }, 1 / 60);
    expect(g.player.climb).toBeNull();
    expect(g.player.vx).toBeGreaterThan(0);
  });

  it('las baldosas que se mueven lo llevan y el montacargas lo sube', () => {
    const g = newTrepa();
    const [tile, lift] = only(g, { x: 6, y: 2, w: 2.5, kind: 'moving', skin: 'tile', amp: 3, speed: 1 }, { x: 1, y: 6, w: 2.6, kind: 'elevator', skin: 'lift', amp: 2, speed: 1, baseY: 6 });
    Object.assign(g.player, { x: 7.2, y: 2, ground: tile });
    const x0 = g.player.x;
    run(g, 0.6);
    expect(g.player.ground).toBe(tile);
    expect(Math.abs(g.player.x - x0)).toBeGreaterThan(0.5);
    Object.assign(g.player, { x: lift.x + 1.3, y: lift.y, ground: lift });
    const ys: number[] = [];
    for (let i = 0; i < 200; i++) { step(g, idle, 1 / 60); ys.push(g.player.y); }
    expect(g.player.ground).toBe(lift);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(2);
  });

  it('la cinta transportadora lo arrastra', () => {
    const g = newTrepa();
    const [belt] = only(g, { x: 4, y: 2, w: 6, kind: 'conveyor', skin: 'conveyor', belt: 3 });
    Object.assign(g.player, { x: 6, y: 2, ground: belt });
    run(g, 0.5);
    expect(g.player.x).toBeGreaterThan(7);
  });

  it('los ladrillos se desarman un rato y vuelven', () => {
    const g = newTrepa();
    const [c] = only(g, { x: 6, y: 2, w: 3, kind: 'crumble', skin: 'bricks' });
    Object.assign(g.player, { x: 7.5, y: 2.3, ground: null, vy: 0 });
    run(g, 0.2);
    expect(g.player.ground).toBe(c);
    run(g, 1);
    expect(c.gone).toBeGreaterThan(0);
    run(g, 3.6);
    expect(c.gone).toBe(0);
  });

  it('en el espacio la gravedad es menor y se salta más alto', () => {
    expect(gravityAt(ZONES.space + 1)).toBeLessThan(gravityAt(10));
    expect(jumpPeak(JUMP, ZONES.space + 1)).toBeGreaterThan(jumpPeak(JUMP, 10) + 1.5);
  });
});

describe('Trepaluna: peligros, perder y ganar', () => {
  it('el fuego quema: pierde, cae por toda la estructura hasta la calle y termina en GAME OVER', () => {
    const g = newTrepa();
    only(g, { x: 5, y: 40, w: 6 });
    g.fires = [{ id: 1, x: 8, y: 40, dir: 'up', len: 3, period: 2, on: 0.5, phase: 0 }];
    g.bestGround = 40;
    Object.assign(g.player, { x: 8, y: 40, ground: g.plats[1] });
    step(g, idle, 1 / 60);
    expect(g.dying?.reason).toBe('burn');
    run(g, 0.5, { jump: true, right: true }); // ya no se puede hacer nada
    expect(g.player.ground).toBeNull();
    run(g, 6);
    expect(g.over).toBe(true);
    expect(g.player.y).toBe(0);
    expect(takeEvents(g).map(e => e.type)).toEqual(expect.arrayContaining(['lose', 'gameover']));
  });

  it('cuando el fuego está apagado se puede pasar', () => {
    const g = newTrepa();
    only(g, { x: 5, y: 40, w: 6 });
    const f = { id: 1, x: 8, y: 40, dir: 'up' as const, len: 3, period: 2, on: 0.4, phase: 1.2 };
    g.fires = [f];
    expect(fireActive(f, 0)).toBe(false);
    Object.assign(g.player, { x: 8, y: 40, ground: g.plats[1] });
    step(g, idle, 1 / 60);
    expect(g.dying).toBeNull();
    expect(fireRect(f).y2).toBeGreaterThan(42);
  });

  it('caer más de 100 m desde lo más alto que pisó es perder', () => {
    const g = newTrepa();
    only(g, { x: 0.3, y: 60, w: 3 });
    g.bestGround = 60;
    Object.assign(g.player, { x: 8, y: 60, ground: null, vy: 0 });
    run(g, 2);
    expect(g.dying?.reason).toBe('fall');
    expect(60 - FALL_LOSE).toBeGreaterThan(0);
  });

  it('la bola de demolición lo empuja (no lo mata)', () => {
    const g = newTrepa();
    only(g, { x: 2, y: 10, w: 12 });
    const ball = { id: 1, px: 8, py: 15, len: 4.2, amp: 0, speed: 1, phase: 0 };
    g.balls = [ball];
    const c = ballPos(ball, 0);
    Object.assign(g.player, { x: c.x - 0.5, y: 10, ground: g.plats[1] });
    step(g, idle, 1 / 60);
    expect(g.player.stun).toBeGreaterThan(0);
    expect(g.player.vx).toBeLessThan(0);
    expect(g.dying).toBeNull();
  });

  it('al llegar a la Luna gana y el tiempo se frena', () => {
    const g = newTrepa();
    const moon = moonOf(g);
    Object.assign(g.player, { x: moon.x + moon.w / 2, y: moon.y + 0.4, ground: null, vy: 0 });
    g.bestGround = moon.y - 2;
    run(g, 0.5);
    expect(g.won).toBe(true);
    const t = g.time;
    run(g, 1);
    expect(g.time).toBe(t);
  });

  it('un cuadro con tiempo cero o negativo no mueve nada', () => {
    const g = newTrepa();
    step(g, idle, -0.01); step(g, idle, 0);
    expect(g.time).toBe(0);
    expect(g.player.y).toBe(0);
  });
});

describe('Trepaluna: zona tecnológica', () => {
  it('el láser prendido electrocuta y apagado se puede pasar', () => {
    const g = newTrepa();
    only(g, { x: 2, y: 160, w: 12 });
    g.bestGround = 160;
    const laser = { id: 1, y: 160.5, x1: 0, x2: 16, period: 2, on: 0.5, phase: 1.5, style: 'laser' as const };
    g.lasers = [laser];
    Object.assign(g.player, { x: 8, y: 160, ground: g.plats[1] });
    step(g, idle, 1 / 60); // apagado
    expect(g.dying).toBeNull();
    laser.phase = 0;
    step(g, idle, 1 / 60);
    expect(g.dying?.reason).toBe('zap');
  });

  it('el imán lo levanta hasta la plataforma de arriba', () => {
    const g = newTrepa();
    const [, top] = only(g, { x: 6, y: 160, w: 4 }, { x: 6.5, y: 168, w: 3 });
    g.magnets = [{ id: 1, x: 8, y1: 160.05, y2: 168.6 }];
    g.bestGround = 160;
    Object.assign(g.player, { x: 8, y: 160, ground: g.plats[1] });
    run(g, 2.5);
    expect(g.player.ground).toBe(top);
  });

  it('el teletransportador lo lleva al portal de arriba', () => {
    const g = newTrepa();
    const [a, b] = only(g, { x: 6, y: 160, w: 4 }, { x: 2, y: 170, w: 4 });
    g.portals = [{ id: 1, x1: 8, y1: a.y, x2: 4, y2: b.y, hue: 200 }];
    g.bestGround = 160;
    Object.assign(g.player, { x: 7, y: 160, ground: a });
    run(g, 0.4, { right: true });
    expect(g.player.y).toBe(170);
    expect(g.player.ground).toBe(b);
    expect(takeEvents(g).some(e => e.type === 'teleport')).toBe(true);
  });

  it('las plataformas holográficas desaparecen y vuelven', () => {
    const g = newTrepa();
    const [h] = only(g, { x: 6, y: 2, w: 3, kind: 'blink', skin: 'hologram', speed: 2, phase: 0 });
    Object.assign(g.player, { x: 7.5, y: 2, ground: h });
    run(g, 0.5);
    expect(g.player.ground).toBe(h);
    run(g, 1);
    expect(h.gone).toBe(1);
    expect(g.player.ground).not.toBe(h);
    run(g, 0.8);
    expect(h.gone).toBe(0);
  });

  it('el ventilador empuja de costado y el engranaje lo empuja', () => {
    const g = newTrepa();
    const [p] = only(g, { x: 1, y: 160, w: 14 });
    g.fans = [{ id: 1, side: -1, y1: 159, y2: 163, force: 4 }];
    g.bestGround = 160;
    Object.assign(g.player, { x: 5, y: 160, ground: p });
    run(g, 0.5);
    expect(g.player.x).toBeGreaterThan(6.5);
    g.fans = [];
    g.gears = [{ id: 1, x: g.player.x + 1, y: 160.5, r: 1.2, speed: 2 }];
    step(g, idle, 1 / 60);
    expect(g.player.stun).toBeGreaterThan(0);
    expect(g.dying).toBeNull();
  });
});
