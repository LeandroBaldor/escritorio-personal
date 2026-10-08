import { describe, expect, it } from 'vitest';
import {
  aimAt, BREAK, canThrow, fanDirOf, launch, MAX_SPEED, newPaper, ORIGIN, preview, QUARTER, quarterLeft, SPEED_PAR, SPOTS, spotOf, STEPS, step,
  stepValue, takeEvents, throwBall, TIME, W, WIND, windOf, type PaperGame,
} from './paperBall';

const run = (g: PaperGame, seconds: number) => { for (let t = 0; t < seconds && !g.over; t += 1 / 60) step(g, 1 / 60); };
// Emboca el tiro que toca (esperando que el tacho llegue a su lugar y que el T-800 agarre otro humano).
const sink = (g: PaperGame) => {
  run(g, 1);
  const { vx, vy } = aimAt(g);
  expect(throwBall(g, vx, vy)).toBe(true);
  run(g, 1.5);
};

describe('¡Al cesto!', () => {
  it('arranca con 4 cuartos de 2 minutos, el tacho cerca y sin viento', () => {
    const g = newPaper(1);
    expect(TIME).toBe(480);
    expect(QUARTER).toBe(120);
    expect(g.left).toBe(TIME);
    expect(quarterLeft(g)).toBe(120);
    expect(g.step).toBe(0);
    expect(g.fan.dir).toBe(0);
    expect(Math.abs(g.bin.x - SPOTS[0])).toBeLessThanOrEqual(0.3);
  });

  it('la ronda: cerca, media y lejos; después con viento a la derecha y después a la izquierda', () => {
    expect(STEPS).toBe(9);
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(spotOf)).toEqual([0, 1, 2, 0, 1, 2, 0, 1, 2]);
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(fanDirOf)).toEqual([0, 0, 0, 1, 1, 1, -1, -1, -1]);
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(stepValue)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(SPOTS[0]).toBeLessThan(SPOTS[1]);
    expect(SPOTS[1]).toBeLessThan(SPOTS[2]);
  });

  it('tirar para atrás lanza para adelante, más fuerte cuanto más tirás (con un máximo)', () => {
    const a = launch(5, 5, 4, 4), b = launch(5, 5, 3, 3), c = launch(5, 5, -20, -20);
    expect(a.vx).toBeGreaterThan(0); expect(a.vy).toBeGreaterThan(0);
    expect(b.vx).toBeGreaterThan(a.vx);
    expect(Math.hypot(c.vx, c.vy)).toBeCloseTo(MAX_SPEED, 5);
    expect(c.power).toBe(1);
    expect(preview(a.vx, a.vy)[0][0]).toBeGreaterThan(ORIGIN.x);
  });

  it('embocar suma lo que vale el tiro y pasa al siguiente: el tacho se va más lejos', () => {
    const g = newPaper(2);
    sink(g);
    expect(takeEvents(g).some(e => e.type === 'score' && e.points === 1)).toBe(true);
    expect(g.score).toBe(1);
    expect(g.step).toBe(1);
    run(g, 1);
    expect(Math.abs(g.bin.x - SPOTS[1])).toBeLessThanOrEqual(0.3);
    sink(g);
    expect(g.score).toBe(3); // 1 + 2
    expect(g.step).toBe(2);
  });

  it('si cae afuera hay sangre, no suma y se pasa igual a la posición siguiente', () => {
    const g = newPaper(3);
    throwBall(g, 2.5, 1);
    run(g, 3);
    const events = takeEvents(g);
    expect(events.some(e => e.type === 'splat' && e.surface === 'floor')).toBe(true);
    expect(events.some(e => e.type === 'miss')).toBe(true);
    expect(g.score).toBe(0);
    expect(g.step).toBe(1);
    expect(g.shots).toBe(1);
  });

  it('no hay límite de tiros: después de la 9ª posición vuelve a empezar el ciclo', () => {
    const g = newPaper(10);
    for (let i = 0; i < STEPS * 2 + 3; i++) { run(g, 0.7); expect(throwBall(g, 2.5, 1)).toBe(true); run(g, 2); }
    expect(g.shots).toBe(STEPS * 2 + 3);
    expect(g.round).toBe(2);
    expect(g.step).toBe(3);
    expect(g.score).toBe(0); // sin embocar no hay puntos por velocidad
  });

  it('un humano por vez: hasta que no cae no se puede tirar el siguiente', () => {
    const g = newPaper(11);
    expect(throwBall(g, 8, 9)).toBe(true);
    run(g, 0.7);
    expect(canThrow(g)).toBe(false);
    run(g, 3);
    expect(canThrow(g)).toBe(true);
  });

  it('contra la pared también salpica', () => {
    const g = newPaper(4);
    throwBall(g, MAX_SPEED, 2);
    run(g, 3);
    expect(takeEvents(g).some(e => e.type === 'splat' && e.surface === 'wall' && e.x > W - 1)).toBe(true);
  });

  it('a partir del 4° tiro se prende el ventilador a la izquierda (sopla para la derecha) y en el 7° se pasa a la derecha', () => {
    const g = newPaper(5);
    for (let i = 0; i < 3; i++) sink(g);
    expect(g.step).toBe(3);
    expect(g.fan.dir).toBe(1);
    expect(windOf(g.fan)).toBeGreaterThan(0);
    expect(takeEvents(g).some(e => e.type === 'fan' && e.dir === 1)).toBe(true);
    for (let i = 0; i < 3; i++) sink(g);
    expect(g.step).toBe(6);
    expect(g.fan.dir).toBe(-1);
    expect(windOf(g.fan)).toBeLessThan(0);
  });

  it('el viento desvía al humano', () => {
    const calm = newPaper(6), windy = newPaper(6);
    windy.fan = { dir: -1, power: WIND[3] };
    throwBall(calm, 8, 6); throwBall(windy, 8, 6);
    run(calm, 0.5); run(windy, 0.5);
    expect(windy.balls[0].x).toBeLessThan(calm.balls[0].x - 0.3);
  });

  it('al completar el ciclo embocando los 9 suma 45 más los puntos por velocidad y vuelve a empezar', () => {
    const g = newPaper(7);
    for (let i = 0; i < STEPS; i++) sink(g);
    const round = takeEvents(g).find(e => e.type === 'round');
    expect(round && round.type === 'round').toBe(true);
    if (round?.type !== 'round') return;
    expect(round.bonus).toBe(Math.max(0, Math.round(SPEED_PAR - round.seconds)));
    expect(round.bonus).toBeGreaterThan(0);
    expect(g.score).toBe(45 + round.bonus);
    expect(g.step).toBe(0);
    expect(g.round).toBe(1);
    expect(g.fan.dir).toBe(0);
  });

  it('hay que esperar un ratito entre tiro y tiro', () => {
    const g = newPaper(8);
    expect(throwBall(g, 2.5, 1)).toBe(true);
    expect(canThrow(g)).toBe(false);
    expect(throwBall(g, 2.5, 1)).toBe(false);
    run(g, 1);
    expect(canThrow(g)).toBe(true);
  });

  it('entre cuartos hay un descanso y el viento sopla más fuerte; a los 8 minutos se termina', () => {
    const g = newPaper(9);
    run(g, QUARTER + 0.05);
    expect(g.quarter).toBe(1);
    expect(takeEvents(g).some(e => e.type === 'quarter' && e.quarter === 1)).toBe(true);
    const left = g.left;
    expect(canThrow(g)).toBe(false);
    run(g, BREAK - 0.1);
    expect(g.left).toBeCloseTo(left, 5);
    run(g, 0.2);
    expect(canThrow(g)).toBe(true);
    expect(WIND[1]).toBeGreaterThan(WIND[0]);
    run(g, TIME + BREAK * 3);
    expect(g.over).toBe(true);
    expect(takeEvents(g).some(e => e.type === 'gameover')).toBe(true);
  });
});
