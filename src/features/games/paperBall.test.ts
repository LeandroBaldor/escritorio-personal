import { describe, expect, it } from 'vitest';
import { aimAt, BREAK, canThrow, launch, MAX_SPEED, newPaper, ORIGIN, preview, QUARTER, quarterLeft, SPOTS, step, takeEvents, throwBall, TIME, windOf, type PaperGame } from './paperBall';

const run = (g: PaperGame, seconds: number) => { for (let t = 0; t < seconds && !g.over; t += 1 / 60) step(g, 1 / 60); };

describe('¡Al cesto!', () => {
  it('arranca con 3 minutos en 4 cuartos, sin viento y con el cesto en el piso, en la zona del 1er cuarto', () => {
    const g = newPaper(1);
    expect(g.left).toBe(TIME);
    expect(TIME).toBe(180);
    expect(QUARTER).toBe(45);
    expect(g.quarter).toBe(0);
    expect(quarterLeft(g)).toBe(45);
    expect(g.fan.power).toBe(0);
    expect(g.bin.y).toBe(0);
    expect(g.bin.x).toBeGreaterThanOrEqual(SPOTS[0][0]);
    expect(g.bin.x).toBeLessThanOrEqual(SPOTS[0][1]);
  });

  it('tirar para atrás lanza para adelante, más fuerte cuanto más tirás (con un máximo)', () => {
    const a = launch(5, 5, 4, 4), b = launch(5, 5, 3, 3), c = launch(5, 5, -20, -20);
    expect(a.vx).toBeGreaterThan(0); expect(a.vy).toBeGreaterThan(0);
    expect(b.vx).toBeGreaterThan(a.vx);
    expect(Math.hypot(c.vx, c.vy)).toBeCloseTo(MAX_SPEED, 5);
    expect(c.power).toBe(1);
    const pts = preview(a.vx, a.vy);
    expect(pts[0][0]).toBeGreaterThan(ORIGIN.x);
  });

  it('un buen tiro entra: suma puntos (limpio vale más) y el cesto cambia de lugar dentro del cuarto', () => {
    const g = newPaper(2);
    const before = g.bin.x;
    const { vx, vy } = aimAt(g);
    expect(throwBall(g, vx, vy)).toBe(true);
    run(g, 1.5);
    const score = takeEvents(g).find(e => e.type === 'score');
    expect(score).toBeTruthy();
    expect(g.score).toBeGreaterThanOrEqual(2); // 1 + limpio
    expect(score && score.type === 'score' && score.swish).toBe(true);
    expect(g.bin.x).not.toBe(before);
    expect(g.bin.x).toBeGreaterThanOrEqual(SPOTS[0][0]);
    expect(g.bin.x).toBeLessThanOrEqual(SPOTS[0][1]);
  });

  it('un tiro flojo cae: no suma y corta la racha', () => {
    const g = newPaper(3);
    g.streak = 4;
    throwBall(g, 2.5, 1);
    run(g, 3);
    expect(g.score).toBe(0);
    expect(g.streak).toBe(0);
    expect(takeEvents(g).some(e => e.type === 'miss')).toBe(true);
  });

  it('el ventilador desvía el bollo', () => {
    const calm = newPaper(4), windy = newPaper(4);
    windy.fan = { dir: -1, power: 3 };
    expect(windOf(windy.fan)).toBeLessThan(0);
    throwBall(calm, 8, 6); throwBall(windy, 8, 6);
    run(calm, 0.5); run(windy, 0.5);
    expect(windy.balls[0].x).toBeLessThan(calm.balls[0].x - 0.5);
  });

  it('hay que esperar un ratito entre tiro y tiro', () => {
    const g = newPaper(5);
    expect(throwBall(g, 8, 6)).toBe(true);
    expect(canThrow(g)).toBe(false);
    expect(throwBall(g, 8, 6)).toBe(false);
    run(g, 0.5);
    expect(canThrow(g)).toBe(true);
  });

  it('en cada cuarto hay un descanso y el cesto se va más lejos (en el último, además, se mueve)', () => {
    const g = newPaper(6);
    const xs = [g.bin.x];
    for (let q = 1; q < 4; q++) {
      run(g, quarterLeft(g) + 0.05);
      expect(g.quarter).toBe(q);
      expect(takeEvents(g).some(e => e.type === 'quarter' && e.quarter === q)).toBe(true);
      // En el descanso el reloj no corre y no se puede tirar.
      const left = g.left;
      expect(canThrow(g)).toBe(false);
      run(g, BREAK - 0.1);
      expect(g.left).toBeCloseTo(left, 5);
      run(g, 0.2);
      expect(canThrow(g)).toBe(true);
      expect(g.bin.x).toBeGreaterThanOrEqual(SPOTS[q][0] - 0.31);
      xs.push(g.bin.x);
    }
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    expect(g.bin.vx).not.toBe(0);
  });

  it('desde el 3er cuarto aparece el jefe (pegarle resta)', () => {
    const g = newPaper(7);
    run(g, QUARTER * 2 + BREAK * 2 + 0.5);
    expect(g.quarter).toBe(2);
    g.score = 5;
    g.nextBoss = g.time; run(g, 0.05);
    expect(g.boss).not.toBeNull();
    const boss = g.boss!;
    boss.speed = 0; boss.x = ORIGIN.x + 5;
    g.fan.power = 0; g.ready = 0; throwBall(g, 12, 0);
    run(g, 0.6);
    expect(takeEvents(g).some(e => e.type === 'boss')).toBe(true);
    expect(g.score).toBeLessThan(5);
  });

  it('se termina el partido a los 3 minutos (más los descansos)', () => {
    const g = newPaper(8);
    run(g, TIME + BREAK * 3 + 1);
    expect(g.over).toBe(true);
    expect(takeEvents(g).some(e => e.type === 'gameover')).toBe(true);
  });
});
