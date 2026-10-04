import { describe, expect, it } from 'vitest';
import { buildCourse, CLOUD_JUMP, gravityAt, JUMP, moonOf, newTrepa, step, takeEvents, TRAMP, ZONES, type Input, type Trepa } from './trepaluna';

const idle: Input = { left: false, right: false, jump: false, down: false };
const run = (g: Trepa, seconds: number, input: Partial<Input> = {}) => {
  for (let t = 0; t < seconds; t += 1 / 60) step(g, { ...idle, ...input }, 1 / 60);
};
const peak = (v: number, y: number) => (v * v) / (2 * gravityAt(y));

describe('Trepaluna: recorrido', () => {
  it('siempre es el mismo y llega hasta la Luna pasando por las nubes y el espacio', () => {
    const a = buildCourse(), b = buildCourse();
    expect(a.plats.map(p => [p.kind, p.x, p.y])).toEqual(b.plats.map(p => [p.kind, p.x, p.y]));
    const moon = a.plats[a.plats.length - 1];
    expect(moon.kind).toBe('moon');
    expect(moon.y).toBeGreaterThan(ZONES.moon - 8);
    const flags = a.plats.filter(p => p.kind === 'flag');
    expect(flags).toHaveLength(2);
    flags.forEach((f, i) => expect(Math.abs(f.y - [ZONES.clouds, ZONES.space][i])).toBeLessThan(2.5));
    for (const kind of ['beam', 'bridge', 'tramp', 'moving', 'crumble', 'cloud', 'asteroid']) expect(a.plats.some(p => p.kind === kind), kind).toBe(true);
    expect(a.ropes.length).toBeGreaterThan(3);
  });

  it('cada estructura se alcanza desde la anterior (saltando, con trampolín o con la soga)', () => {
    const { plats, ropes } = buildCourse();
    for (let i = 1; i < plats.length; i++) {
      const from = plats[i - 1], to = plats[i];
      const dy = to.y - from.y;
      expect(dy, `${from.kind}→${to.kind} a ${from.y.toFixed(1)} m`).toBeGreaterThan(0);
      if (ropes.some(r => Math.abs(r.y1 - from.y - 0.2) < 1e-9 && Math.abs(r.y2 - to.y - 0.3) < 1e-9)) continue;
      const v = from.kind === 'tramp' ? TRAMP : from.kind === 'cloud' ? CLOUD_JUMP : JUMP;
      expect(dy, `${from.kind}→${to.kind} a ${from.y.toFixed(1)} m`).toBeLessThan(peak(v, from.y) - 0.15);
    }
  });
});

describe('Trepaluna: movimiento', () => {
  it('salta, atraviesa una plataforma desde abajo y cae parado arriba', () => {
    const g = newTrepa();
    g.plats.splice(1, g.plats.length - 2); g.ropes = [];
    g.plats.push({ ...g.plats[0], id: 500, kind: 'beam', x: 6, y: 2, w: 4, baseX: 6 });
    g.player.x = 8;
    run(g, 0.05, { jump: true });
    run(g, 1.2);
    expect(g.player.ground?.id).toBe(500);
    expect(g.player.y).toBe(2);
    expect(takeEvents(g).some(e => e.type === 'jump')).toBe(true);
  });

  it('el trampolín lo tira mucho más alto', () => {
    const g = newTrepa();
    const tramp = g.plats.find(p => p.kind === 'tramp')!;
    Object.assign(g.player, { x: tramp.x + tramp.w / 2, y: tramp.y + 1, ground: null, vy: 0 });
    let top = 0;
    for (let i = 0; i < 90; i++) { step(g, idle, 1 / 60); top = Math.max(top, g.player.y); }
    expect(top - tramp.y).toBeGreaterThan(6);
  });

  it('se agarra de la soga, la trepa manteniendo saltar y se suelta con un costado', () => {
    const g = newTrepa();
    const rope = g.ropes[0];
    Object.assign(g.player, { x: rope.x, y: rope.y1 + 1, ground: null, vy: 0 });
    step(g, { ...idle, jump: true }, 1 / 60);
    expect(g.player.rope).toBe(rope);
    const y0 = g.player.y;
    run(g, 0.5, { jump: true });
    expect(g.player.y).toBeGreaterThan(y0 + 1.5);
    step(g, { ...idle, right: true }, 1 / 60);
    expect(g.player.rope).toBeNull();
    expect(g.player.vx).toBeGreaterThan(0);
  });

  it('la plataforma que se desarma desaparece un rato y vuelve', () => {
    const g = newTrepa();
    const c = g.plats.find(p => p.kind === 'crumble')!;
    Object.assign(g.player, { x: c.x + c.w / 2, y: c.y + 0.3, ground: null, vy: 0 });
    run(g, 0.2);
    expect(g.player.ground).toBe(c);
    run(g, 1);
    expect(c.gone).toBeGreaterThan(0);
    expect(g.player.ground).not.toBe(c);
    run(g, 3.5);
    expect(c.gone).toBe(0);
  });

  it('en el espacio la gravedad es menor', () => {
    expect(gravityAt(ZONES.space + 1)).toBeLessThan(gravityAt(10));
  });

  it('la bandera guarda el lugar: si cae muy abajo vuelve a ella', () => {
    const g = newTrepa();
    const flag = g.plats.find(p => p.kind === 'flag')!;
    Object.assign(g.player, { x: flag.x + flag.w / 2, y: flag.y + 0.5, ground: null, vy: 0 });
    run(g, 0.3);
    expect(g.checkpoint).toBe(flag);
    Object.assign(g.player, { x: 0.4, y: flag.y - 20, ground: null, vy: -5 });
    step(g, idle, 1 / 60);
    expect(g.player.y).toBe(flag.y);
    expect(takeEvents(g).map(e => e.type)).toEqual(expect.arrayContaining(['checkpoint', 'respawn']));
  });

  it('al llegar a la Luna gana y el tiempo se frena', () => {
    const g = newTrepa();
    const moon = moonOf(g);
    Object.assign(g.player, { x: moon.x + moon.w / 2, y: moon.y + 0.4, ground: null, vy: 0 });
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
