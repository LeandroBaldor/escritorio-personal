import { describe, expect, it } from 'vitest';
import { canShoot, dive, FORMATIONS, minute, newMatch, pass, passRisk, PITCH, shoot, shotChance, startCounter, step, takeEvents, type Match } from './tikiTaka';

const run = (m: Match, seconds: number, rand = () => 0.5) => { for (let t = 0; t < seconds; t += 1 / 60) step(m, 1 / 60, rand); };
const freeze = (m: Match) => { for (const r of m.rivals) { r.x = r.bx = 200; r.y = r.by = -50; } };

describe('Tiki-Taka', () => {
  it('cada formación pone 10 jugadores de campo en sus líneas y arranca con la pelota en el medio', () => {
    for (const formation of Object.keys(FORMATIONS) as (keyof typeof FORMATIONS)[]) {
      const m = newMatch(formation);
      expect(m.mine).toHaveLength(10);
      expect(new Set(m.mine.map(p => p.bx)).size).toBe(FORMATIONS[formation].length);
      expect(m.holder).not.toBeNull();
      expect(m.rivals).toHaveLength(10);
    }
  });

  it('un pase sin rivales en el camino llega y cuenta', () => {
    const m = newMatch('4-4-2');
    freeze(m);
    const to = m.holder! + 1;
    expect(passRisk(m, to)).toBe('safe');
    expect(pass(m, to)).toBe(true);
    run(m, 1.5);
    expect(m.holder).toBe(to);
    expect(m.stats.passes).toBe(1);
  });

  it('un rival en la línea del pase lo marca en rojo y lo corta: viene el contraataque', () => {
    const m = newMatch('4-4-2');
    freeze(m);
    const a = m.mine[m.holder!], to = 9, b = m.mine[to];
    m.rivals[0].x = m.rivals[0].bx = (a.x + b.x) / 2; m.rivals[0].y = m.rivals[0].by = (a.y + b.y) / 2;
    expect(passRisk(m, to)).toBe('blocked');
    pass(m, to);
    run(m, 1.5, () => 0.99);
    expect(m.phase).toBe('counter');
    expect(takeEvents(m).some(e => e.type === 'intercept')).toBe(true);
  });

  it('si te quedás quieto con la pelota, te la roban', () => {
    const m = newMatch('4-3-3');
    run(m, 6, () => 0.99);
    expect(m.stats.lost).toBeGreaterThan(0);
  });

  it('solo se patea cerca del arco y la chance baja con la distancia', () => {
    const m = newMatch('4-3-3');
    freeze(m);
    expect(canShoot(m)).toBe(false);
    m.holder = 9; m.mine[9].x = 95; m.mine[9].y = PITCH.h / 2;
    const close = shotChance(m);
    m.mine[9].x = 75;
    expect(shotChance(m)).toBeLessThan(close);
    m.mine[9].x = 95;
    expect(shoot(m, () => 0)).toBe(true); // rand 0: entra
    run(m, 1);
    expect(m.goals.mine).toBe(1);
  });

  it('en el contraataque, adivinar el lado ataja y no adivinar es gol del rival', () => {
    const m = newMatch('4-4-2');
    startCounter(m, () => 0.9); // 0.9: la defensa no corta; lado der
    expect(m.counter?.cut).toBe(false);
    dive(m, m.counter!.dir);
    expect(m.counter!.result).toBe('saved');
    expect(m.goals.rival).toBe(0);
    run(m, 2);
    startCounter(m, () => 0.9);
    run(m, 3); // no elige a tiempo
    expect(m.goals.rival).toBe(1);
  });

  it('con más defensores hay más tiempo para atajar', () => {
    const five = newMatch('5-3-2'), three = newMatch('3-5-2');
    startCounter(five, () => 0.95); startCounter(three, () => 0.95);
    expect(five.counter!.window).toBeGreaterThan(three.counter!.window);
  });

  it('el partido dura 90 minutos de juego y termina', () => {
    const m = newMatch('4-4-2', 10);
    freeze(m);
    run(m, 12);
    expect(minute(m)).toBe(90);
    expect(m.phase).toBe('end');
  });
});
