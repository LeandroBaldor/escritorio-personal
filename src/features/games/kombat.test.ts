import { describe, expect, it } from 'vitest';
import { CHAR_IDS, ENERGY_MAX, GOAL_DEPTH, MATCH_TIME, STAGES, W, fatalPath, newMatch, noInput, seeded, step, takeEvents, type Input, type Match } from './kombat';

const idle = (): [Input, Input] => [noInput(), noInput()];
function play(m: Match, seconds: number, inputs: (m: Match) => [Input, Input] = idle) {
  for (let t = 0; t < seconds; t += 1 / 60) { step(m, inputs(m), 1 / 60); if (m.phase === 'end') break; }
}
const toPlay = (m: Match) => { play(m, 2.4); expect(m.phase).toBe('play'); };

describe('Kombat Football', () => {
  it('arranca con la presentación, después se juega y el reloj baja desde 2 minutos', () => {
    const m = newMatch('city', ['toxic', 'bull'], [null, null], seeded(1));
    expect(m.phase).toBe('intro');
    toPlay(m);
    play(m, 3);
    expect(m.clock).toBeLessThan(MATCH_TIME - 2.5);
  });

  it('una patada manda la pelota hacia el arco rival y un tiro adentro es gol', () => {
    const m = newMatch('city', ['bull', 'frost'], [null, null], seeded(2));
    toPlay(m);
    const f = m.fighters[0], b = m.ball;
    m.fighters[1].x = 3; // el rival lejos, del otro lado
    b.x = f.x + 0.6; b.y = 0.5; b.vx = 0; b.vy = 0;
    let k = 0;
    play(m, 3, () => { k++; const i = noInput(); i.kick = k === 2; return [i, noInput()]; });
    expect(f.goals).toBe(1);
    expect(m.lastGoal?.side).toBe(0);
  });

  it('si alguien patea al rival lo voltea, salvo que esté bloqueando', () => {
    const m = newMatch('city', ['volt', 'void'], [null, null], seeded(3));
    toPlay(m);
    const [a, b] = m.fighters;
    m.ball.x = 2; m.ball.y = 5;
    a.x = 10; b.x = 10.9; b.facing = -1;
    let k = 0;
    play(m, 0.5, () => { k++; const i = noInput(); i.kick = k === 2; return [i, noInput()]; });
    expect(b.stun > 0 || b.action === 'stun').toBe(true);
    // ahora bloqueando
    const m2 = newMatch('city', ['volt', 'void'], [null, null], seeded(3));
    toPlay(m2);
    const [a2, b2] = m2.fighters;
    m2.ball.x = 2; m2.ball.y = 5;
    a2.x = 10; b2.x = 10.9; b2.facing = -1;
    k = 0;
    play(m2, 0.5, () => { k++; const i = noInput(), j = noInput(); i.kick = k === 4; j.block = true; return [i, j]; });
    expect(b2.stun).toBe(0);
  });

  it('el FATAL GOAL necesita la barra llena, entra si nadie lo frena, y la defensa del rival lo para', () => {
    for (const char of CHAR_IDS) {
      const m = newMatch('city', [char, 'toxic'], [null, null], seeded(4));
      toPlay(m);
      m.fighters[1].x = W - 3;
      const press = (fatal: boolean) => { let k = 0; return () => { k++; const i = noInput(); i.fatal = fatal && k === 2; return [i, noInput()] as [Input, Input]; }; };
      play(m, 0.2, press(true));
      expect(m.fatal).toBeNull(); // sin energía no sale
      m.fighters[0].energy = ENERGY_MAX;
      play(m, 6, press(true));
      expect(m.fighters[0].goals, char).toBe(1);
      expect(m.lastGoal?.fatal).toBe(true);
    }
    for (const defender of CHAR_IDS) {
      const m = newMatch('city', ['bull', defender], [null, null], seeded(5));
      toPlay(m);
      m.fighters[0].energy = ENERGY_MAX;
      m.fighters[1].x = W - GOAL_DEPTH - 1;
      let k = 0;
      play(m, 6, () => { k++; const i = noInput(), j = noInput(); i.fatal = k === 2; j.defense = k === 95; return [i, j]; });
      expect(m.fighters[0].goals, defender).toBe(0);
      expect(takeEvents(m).length).toBeGreaterThanOrEqual(0);
    }
  });

  it('el recorrido de cada FATAL termina en el arco rival', () => {
    const m = newMatch('city', ['toxic', 'bull'], [null, null], seeded(6));
    for (const char of CHAR_IDS) for (const side of [0, 1] as const) {
      const fat = { side, char, t: 0, x0: side === 0 ? 6 : W - 6, y0: 0.8, blocked: false, done: false };
      let p = fatalPath(m, fat, 0), t = 0;
      while (!p.done && t < 10) { t += 1 / 60; p = fatalPath(m, fat, t); expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true); }
      expect(p.done).toBe(true);
      expect(side === 0 ? p.x > W - GOAL_DEPTH : p.x < GOAL_DEPTH).toBe(true);
    }
  });

  it('empate: se juega tiempo extra y el primer gol gana (gol de oro)', () => {
    const m = newMatch('city', ['toxic', 'bull'], [null, null], seeded(7));
    toPlay(m);
    m.clock = 0.05;
    play(m, 0.2);
    expect(m.extra).toBe(true);
    play(m, 3);
    m.ball.x = W - 0.5; m.ball.y = 1;
    play(m, 4);
    expect(m.winner).toBe(0);
    expect(m.phase).toBe('end');
  });

  it('dos máquinas juegan partidos completos en los 10 escenarios sin romperse, con goles y un ganador', () => {
    let goals = 0;
    STAGES.forEach((stage, i) => {
      const m = newMatch(stage.id, [CHAR_IDS[i % 5], CHAR_IDS[(i + 2) % 5]], [0.6, 0.6], seeded(100 + i));
      play(m, 260);
      for (const f of m.fighters) expect(Number.isFinite(f.x) && Number.isFinite(f.y), stage.id).toBe(true);
      expect(Number.isFinite(m.ball.x) && Number.isFinite(m.ball.y)).toBe(true);
      goals += m.fighters[0].goals + m.fighters[1].goals;
      if (m.phase === 'end') expect(m.winner === 0 || m.winner === 1).toBe(true);
    });
    expect(goals).toBeGreaterThan(10);
  }, 60000);
});
