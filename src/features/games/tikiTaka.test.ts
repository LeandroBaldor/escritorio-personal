import { describe, expect, it } from 'vitest';
import { canShoot, chase, dive, FORMATIONS, minute, newMatch, pass, passRisk, PITCH, shoot, shotChance, startSecondHalf, step, takeEvents, type Match } from './tikiTaka';

const run = (m: Match, seconds: number, rand = () => 0.5) => { for (let t = 0; t < seconds; t += 1 / 60) step(m, 1 / 60, rand); };
const away = (list: Match['rivals']) => { for (const p of list) { p.x = p.bx = 200; p.y = p.by = -50; } };

describe('Tiki-Taka', () => {
  it('cada formación pone 10 jugadores de campo en sus líneas y arranca con la pelota en el medio', () => {
    for (const formation of Object.keys(FORMATIONS) as (keyof typeof FORMATIONS)[]) {
      const m = newMatch(formation);
      expect(m.mine).toHaveLength(10);
      expect(new Set(m.mine.map(p => p.bx)).size).toBe(FORMATIONS[formation].length);
      expect(m.possession).toBe('mine');
      expect(m.holder).not.toBeNull();
    }
  });

  it('un pase sin rivales en el camino llega y cuenta', () => {
    const m = newMatch('4-4-2');
    away(m.rivals);
    const to = m.holder! + 1;
    expect(passRisk(m, to)).toBe('safe');
    expect(pass(m, to)).toBe(true);
    run(m, 1.5);
    expect(m.holder).toBe(to);
    expect(m.stats.passes).toBe(1);
  });

  it('un rival en la línea del pase lo marca en rojo y lo corta: la pelota pasa a ser del rival', () => {
    const m = newMatch('4-4-2');
    away(m.rivals);
    const a = m.mine[m.holder!], to = 9, b = m.mine[to];
    m.rivals[0].x = m.rivals[0].bx = (a.x + b.x) / 2; m.rivals[0].y = m.rivals[0].by = (a.y + b.y) / 2;
    expect(passRisk(m, to)).toBe('blocked');
    pass(m, to);
    run(m, 0.6);
    expect(m.possession).toBe('rival');
    expect(takeEvents(m).some(e => e.type === 'intercept')).toBe(true);
  });

  it('si te quedás quieto con la pelota, te la roban y el rival sigue jugando hacia tu arco', () => {
    const m = newMatch('4-3-3');
    run(m, 6, () => 0.99);
    expect(m.stats.lost).toBeGreaterThan(0);
    expect(m.possession === 'rival' || m.phase === 'save' || m.goals.rival > 0 || m.stats.recovered > 0).toBe(true);
  });

  it('sin la pelota, el jugador que mandás a marcar la recupera', () => {
    const m = newMatch('4-4-2');
    away(m.mine);
    m.possession = 'rival'; m.holder = 9; m.control = 0; m.decide = 99;
    m.rivals[9].x = 60; m.rivals[9].y = 34;
    m.mine[0].x = 40; m.mine[0].y = 34; m.mine[0].bx = 200; m.mine[0].by = -50;
    expect(chase(m, 0)).toBe(true);
    // El rival intenta esquivarlo, pero el marcador es más rápido.
    for (let t = 0; t < 6 && m.possession === 'rival'; t += 1 / 60) step(m, 1 / 60, () => 0.5);
    expect(m.possession).toBe('mine');
    expect(m.holder).toBe(0);
    expect(takeEvents(m).some(e => e.type === 'recover')).toBe(true);
  });

  it('si el rival llega a patear, atajás eligiendo el lado; si no, es gol del rival', () => {
    const m = newMatch('4-4-2');
    away(m.mine);
    m.possession = 'rival'; m.holder = 9; m.control = 0; m.decide = 0;
    m.rivals[9].x = 20; m.rivals[9].y = 34;
    run(m, 0.05, () => 0.9);
    expect(m.phase).toBe('save');
    dive(m, m.save!.dir);
    expect(m.save!.result).toBe('saved');
    run(m, 2);
    expect(m.possession).toBe('mine');
    expect(m.goals.rival).toBe(0);
    away(m.mine);
    m.possession = 'rival'; m.holder = 9; m.control = 0; m.decide = 0; m.phase = 'play';
    m.rivals[9].x = 20; m.rivals[9].y = 34;
    run(m, 4, () => 0.9); // no elige a tiempo
    expect(m.goals.rival).toBe(1);
  });

  it('solo se patea cerca del arco y la chance baja con la distancia', () => {
    const m = newMatch('4-3-3');
    away(m.rivals);
    expect(canShoot(m)).toBe(false);
    m.holder = 9; m.mine[9].x = 95; m.mine[9].y = PITCH.h / 2;
    const close = shotChance(m);
    m.mine[9].x = 75;
    expect(shotChance(m)).toBeLessThan(close);
    m.mine[9].x = 95;
    expect(shoot(m, () => 0)).toBe(true);
    run(m, 1);
    expect(m.goals.mine).toBe(1);
    run(m, 2.4);
    expect(m.possession).toBe('rival'); // después del gol saca el rival
  });

  it('hay dos tiempos: entretiempo a los 45 y final a los 90', () => {
    const m = newMatch('4-4-2', 5);
    away(m.rivals);
    run(m, 6);
    expect(m.phase).toBe('half');
    expect(minute(m)).toBe(45);
    expect(takeEvents(m).some(e => e.type === 'half')).toBe(true);
    expect(startSecondHalf(m)).toBe(true);
    expect(m.half).toBe(2);
    run(m, 6);
    expect(m.phase).toBe('end');
    expect(minute(m)).toBe(90);
  });
});
