import { describe, expect, it } from 'vitest';
import { CHAR_IDS, COST, GOAL_DEPTH, HALF_TIME, POWER_MAX, STAGES, STAMINA, W, attackDir, comboKeys, defendsLeft, fatalPath, newMatch, noInput, seeded, step, takeEvents, type Input, type Match } from './kombat';

const idle = (): [Input, Input] => [noInput(), noInput()];
function play(m: Match, seconds: number, inputs: (m: Match) => [Input, Input] = idle) {
  for (let t = 0; t < seconds; t += 1 / 60) { step(m, inputs(m), 1 / 60); if (m.phase === 'end') break; }
}
const toPlay = (m: Match) => { play(m, 2.45); expect(m.phase).toBe('play'); };
// Aprieta una secuencia de teclas, una por cuadro (con un cuadro suelto entre medio).
function keys(seq: (keyof Input)[]) {
  let k = 0;
  return (): [Input, Input] => { const i = noInput(); const n = k++; if (n % 2 === 0 && n / 2 < seq.length) (i[seq[n / 2]] as boolean) = true; return [i, noInput()]; };
}

describe('Kombat Football', () => {
  it('dos tiempos de 1:30: en el entretiempo los equipos cambian de lado', () => {
    const m = newMatch('city', ['venox', 'blazehorn'], [null, null], seeded(1));
    toPlay(m);
    expect(defendsLeft(m, 0)).toBe(true);
    expect(attackDir(m, 0)).toBe(1);
    m.clock = 0.05; play(m, 0.2);
    expect(m.phase).toBe('halftime');
    play(m, 6);
    expect(m.half).toBe(2);
    expect(m.clock).toBeLessThanOrEqual(HALF_TIME);
    expect(defendsLeft(m, 0)).toBe(false);
    expect(attackDir(m, 0)).toBe(-1);
    // los arqueros también cambiaron de arco
    expect(m.keepers[0].x).toBeGreaterThan(W / 2);
    expect(m.keepers[1].x).toBeLessThan(W / 2);
  });

  it('una patada fuerte cerca del arco puede ser gol (con el arquero volteado)', () => {
    const m = newMatch('city', ['blazehorn', 'frostbane'], [null, null], seeded(2));
    toPlay(m);
    const f = m.fighters[0], b = m.ball;
    m.fighters[1].x = 3;
    m.keepers[1].stun = 10; m.keepers[1].action = 'down';
    f.x = W - 7; b.x = f.x + 0.6; b.y = 0.5; b.vx = 0; b.vy = 0;
    play(m, 3, keys(['kick']));
    expect(f.goals).toBe(1);
    expect(m.lastGoal?.side).toBe(0);
  });

  it('el arquero ataja un tiro flojo y después la saca', () => {
    const m = newMatch('city', ['venox', 'frostbane'], [null, null], seeded(3));
    toPlay(m);
    m.fighters[0].x = 10; m.fighters[1].x = 20;
    const b = m.ball, k = m.keepers[1];
    b.x = W - 6; b.y = 1; b.vx = 9; b.vy = 1; b.owner = 0;
    let saved = false;
    for (let t = 0; t < 2; t += 1 / 60) { step(m, idle(), 1 / 60); if (takeEvents(m).some(e => e.type === 'save')) saved = true; }
    expect(saved).toBe(true);
    expect(m.fighters[0].goals).toBe(0);
    expect(k.hold).toBe(0); // ya la sacó
  });

  it('correr gasta energía y cansado se corre más lento; quieto se recupera', () => {
    const m = newMatch('city', ['voltrax', 'venox'], [null, null], seeded(4));
    toPlay(m);
    const f = m.fighters[0];
    f.x = 3; m.ball.x = 25;
    play(m, 2.5, () => { const i = noInput(); i.right = true; return [i, noInput()]; });
    expect(f.stamina).toBeLessThan(STAMINA * 0.9);
    const tired = f.stamina;
    play(m, 2);
    expect(f.stamina).toBeGreaterThan(tired);
  });

  it('las combinaciones de flechas + espacio hacen las jugadas especiales y gastan poder', () => {
    const m = newMatch('city', ['frostbane', 'venox'], [null, null], seeded(5));
    toPlay(m);
    const f = m.fighters[0];
    f.power = COST.defense;
    // atrás atrás espacio (ataca a la derecha, así que atrás es ←)
    play(m, 0.3, keys(['left', 'left', 'kick']));
    expect(m.shields.some(s => s.kind === 'icewall')).toBe(true);
    expect(f.power).toBeLessThan(COST.defense);
    expect(comboKeys('fatal', 1)).toEqual(['→', '←', '→']);
    expect(comboKeys('shot', -1)).toEqual(['←', '←']);
  });

  it('el poder se carga y avisa al desbloquear cada nivel', () => {
    const m = newMatch('city', ['venox', 'blazehorn'], [null, null], seeded(6));
    toPlay(m);
    takeEvents(m);
    m.fighters[0].power = 99.9;
    play(m, 0.2);
    expect(takeEvents(m).some(e => e.type === 'unlock' && e.side === 0 && e.level === 1)).toBe(true);
  });

  it('si alguien patea al rival lo voltea, salvo que esté bloqueando (↓)', () => {
    const m = newMatch('city', ['voltrax', 'nullshade'], [null, null], seeded(7));
    toPlay(m);
    const [a, b] = m.fighters;
    m.ball.x = 3; m.ball.y = 5;
    a.x = 10; b.x = 10.9; b.facing = -1;
    play(m, 0.5, keys(['kick']));
    expect(b.stun > 0 || b.action === 'stun').toBe(true);
    const m2 = newMatch('city', ['voltrax', 'nullshade'], [null, null], seeded(7));
    toPlay(m2);
    const [a2, b2] = m2.fighters;
    m2.ball.x = 3; m2.ball.y = 5;
    a2.x = 10; b2.x = 10.9; b2.facing = -1;
    let k = 0;
    play(m2, 0.5, () => { k++; const i = noInput(), j = noInput(); i.kick = k === 4; j.down = true; return [i, j]; });
    expect(b2.stun).toBe(0);
  });

  it('al árbitro se lo puede voltear: desaparece y vuelve a los segundos', () => {
    const m = newMatch('city', ['venox', 'blazehorn'], [null, null], seeded(8));
    toPlay(m);
    const r = m.ref, f = m.fighters[0];
    m.ball.x = 3; m.ball.y = 6;
    play(m, 0.3);
    f.x = r.x - 0.8; f.facing = 1; m.fighters[1].x = 26;
    play(m, 0.4, keys(['kick']));
    expect(['down', 'gone']).toContain(r.action);
    play(m, 2.5);
    expect(r.action).toBe('gone');
    play(m, 3);
    expect(r.action).not.toBe('gone');
  });

  it('el FATAL GOAL necesita los 3 niveles de poder, entra si nadie lo frena, y la defensa del rival lo para', () => {
    for (const char of CHAR_IDS) {
      const m = newMatch('city', [char, 'venox'], [null, null], seeded(9));
      toPlay(m);
      m.fighters[1].x = W - 3;
      const cast = () => { let k = 0; return (): [Input, Input] => { k++; const i = noInput(); i.cast = k === 2 ? 'fatal' : null; return [i, noInput()]; }; };
      play(m, 0.2, cast());
      expect(m.fatal).toBeNull(); // sin poder no sale
      m.fighters[0].power = POWER_MAX;
      play(m, 6, cast());
      expect(m.fighters[0].goals, char).toBe(1);
      expect(m.lastGoal?.fatal).toBe(true);
    }
    for (const defender of CHAR_IDS) {
      const m = newMatch('city', ['blazehorn', defender], [null, null], seeded(10));
      toPlay(m);
      m.fighters[0].power = POWER_MAX;
      m.fighters[1].x = W - GOAL_DEPTH - 1;
      let k = 0;
      play(m, 6, () => { k++; const i = noInput(), j = noInput(); i.cast = k === 2 ? 'fatal' : null; j.cast = k === 95 ? 'defense' : null; return [i, j]; });
      expect(m.fighters[0].goals, defender).toBe(0);
    }
  });

  it('el recorrido de cada FATAL termina en el arco rival', () => {
    for (const char of CHAR_IDS) for (const dir of [1, -1] as const) {
      const fat = { side: 0 as const, char, t: 0, x0: dir === 1 ? 6 : W - 6, y0: 0.8, dir, blocked: false, done: false };
      let p = fatalPath(fat, 0), t = 0;
      while (!p.done && t < 10) { t += 1 / 60; p = fatalPath(fat, t); expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true); }
      expect(p.done).toBe(true);
      expect(dir === 1 ? p.x > W - GOAL_DEPTH : p.x < GOAL_DEPTH).toBe(true);
    }
  });

  it('empate al final: tiempo extra y el primer gol gana (gol de oro)', () => {
    const m = newMatch('city', ['venox', 'blazehorn'], [null, null], seeded(11));
    toPlay(m);
    m.clock = 0.05; play(m, 0.2); play(m, 6); // entretiempo
    expect(m.half).toBe(2);
    toPlay(m);
    m.clock = 0.05; play(m, 0.2);
    expect(m.extra).toBe(true);
    play(m, 3);
    // segundo tiempo: el equipo 0 ataca a la izquierda
    m.keepers[1].stun = 10;
    m.ball.x = 0.6; m.ball.y = 1; m.ball.vx = -3;
    play(m, 4);
    expect(m.winner).toBe(0);
    expect(m.phase).toBe('end');
  });

  it('dos máquinas juegan partidos completos en los 10 escenarios sin romperse', () => {
    let goals = 0, matches = 0;
    STAGES.forEach((stage, i) => {
      const m = newMatch(stage.id, [CHAR_IDS[i % 5], CHAR_IDS[(i + 2) % 5]], [0.6, 0.6], seeded(100 + i));
      play(m, 230);
      for (const f of m.fighters) expect(Number.isFinite(f.x) && Number.isFinite(f.y), stage.id).toBe(true);
      expect(Number.isFinite(m.ball.x) && Number.isFinite(m.ball.y)).toBe(true);
      goals += m.fighters[0].goals + m.fighters[1].goals; matches++;
      if (m.phase === 'end') expect(m.winner === 0 || m.winner === 1).toBe(true);
    });
    // con arqueros y una cancha larga, los goles cuestan: ni 0 ni una lluvia
    expect(goals).toBeGreaterThan(3);
    expect(goals / matches).toBeLessThan(9);
  }, 90000);
});
