import { describe, expect, it } from 'vitest';
import { aimAt, BONUS_TIME, canThrow, launch, MAX_SPEED, newPaper, ORIGIN, preview, step, takeEvents, throwBall, TIME, windOf, type PaperGame } from './paperBall';

const run = (g: PaperGame, seconds: number) => { for (let t = 0; t < seconds && !g.over; t += 1 / 60) step(g, 1 / 60); };

describe('¡Al cesto!', () => {
  it('arranca con 60 segundos, sin viento y con el cesto en el piso', () => {
    const g = newPaper(1);
    expect(g.left).toBe(TIME);
    expect(g.fan.power).toBe(0);
    expect(g.bin.y).toBe(0);
    expect(g.bin.x).toBeGreaterThan(ORIGIN.x + 3);
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

  it('un buen tiro entra: suma puntos (limpio vale más), segundos, y el cesto cambia de lugar', () => {
    const g = newPaper(2);
    const before = { x: g.bin.x, left: g.left };
    const { vx, vy } = aimAt(g);
    expect(throwBall(g, vx, vy)).toBe(true);
    run(g, 1.5);
    const ev = takeEvents(g);
    const score = ev.find(e => e.type === 'score');
    expect(score).toBeTruthy();
    expect(g.score).toBeGreaterThanOrEqual(2); // 1 + limpio
    expect(score && score.type === 'score' && score.swish).toBe(true);
    expect(g.left).toBeGreaterThan(before.left - 1.5 + BONUS_TIME - 0.1);
    expect(g.bin.x).not.toBe(before.x);
  });

  it('un tiro flojo cae al piso: no suma y corta la racha', () => {
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

  it('con los puntos sube el nivel, el cesto se va más lejos y aparece el jefe (pegarle resta)', () => {
    const g = newPaper(6);
    for (let i = 0; i < 30 && g.level < 3; i++) { g.fan.power = 0; const { vx, vy } = aimAt(g); throwBall(g, vx, vy); run(g, 1.5); }
    expect(g.level).toBeGreaterThanOrEqual(3);
    g.nextBoss = g.time; run(g, 0.05);
    expect(g.boss).not.toBeNull();
    // Un bollo directo al jefe.
    const boss = g.boss!;
    boss.speed = 0; boss.x = ORIGIN.x + 3;
    const score = g.score;
    g.ready = 0; throwBall(g, 10, -2);
    run(g, 0.6);
    expect(takeEvents(g).some(e => e.type === 'boss')).toBe(true);
    expect(g.score).toBeLessThan(score);
  });

  it('se termina el tiempo', () => {
    const g = newPaper(7);
    run(g, TIME + 1);
    expect(g.over).toBe(true);
    expect(takeEvents(g).some(e => e.type === 'gameover')).toBe(true);
  });
});
