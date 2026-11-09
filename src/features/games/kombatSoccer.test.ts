import { describe, expect, it } from 'vitest';
import { BR, D, GH, GW, L, ZC, attackDir, carrier, castPower, newSoccer, noSInput, pass, shoot, stepSoccer, takeSoccerEvents, type SoccerMatch, type SEvent } from './kombatSoccer';
import { CHAR_IDS, POWER_MAX, seeded } from './kombat';

const run = (m: SoccerMatch, s: number, ev: SEvent[] = []) => { for (let t = 0; t < s; t += 1 / 60) { stepSoccer(m, [noSInput(), noSInput()], 1 / 60); ev.push(...takeSoccerEvents(m)); } return ev; };
const toPlay = (m: SoccerMatch) => { run(m, m.introLen + 0.05); expect(m.phase).toBe('play'); };

describe('Kombat Football 5 contra 5', () => {
  it('cada equipo tiene cinco iguales (el luchador elegido): arquero, dos defensores y dos delanteros', () => {
    const m = newSoccer('industrial', ['frost', 'thunder'], [null, 0.5], seeded(1));
    expect(m.players).toHaveLength(10);
    for (const t of [0, 1] as const) {
      const mine = m.players.filter(p => p.team === t);
      expect(mine.map(p => p.role)).toEqual(['gk', 'def', 'def', 'fwd', 'fwd']);
      expect(mine.every(p => p.char === (t === 0 ? 'frost' : 'thunder'))).toBe(true);
    }
  });
  it('arranca con el saque del medio: un delantero del que saca tiene la pelota', () => {
    const m = newSoccer('industrial', ['frost', 'thunder'], [null, 0.5], seeded(2));
    toPlay(m);
    expect(carrier(m)?.team).toBe(m.kickoffTeam); expect(carrier(m)?.role).toBe('fwd');
  });
  it('un tiro fuerte y derecho al arco vacío es gol', () => {
    const m = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(3)); toPlay(m);
    const p = m.players.find(q => q.team === 0 && q.role === 'fwd')!, gk = m.players.find(q => q.team === 1 && q.role === 'gk')!;
    gk.x = gk.x < L / 2 ? 0.5 : L - 0.5; gk.z = 1; gk.stun = 9;
    const dir = attackDir(m, 0); p.x = dir > 0 ? L - 9 : 9; p.z = ZC; m.ball.owner = p.id; stepSoccer(m, [noSInput(), noSInput()], 1 / 60);
    for (const q of m.players) if (q !== p && q.role !== 'gk') q.stun = 9;
    shoot(m, p, 0.6, 0);
    const ev = run(m, 2.5);
    expect(ev.some(e => e.type === 'goal' && e.side === 0)).toBe(true);
    expect(m.teams[0].goals).toBe(1);
  });
  it('el tiro con efecto hace una curva (y entra igual)', () => {
    const m = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(4)); toPlay(m);
    const p = m.players.find(q => q.team === 0 && q.role === 'fwd')!, gk = m.players.find(q => q.team === 1 && q.role === 'gk')!;
    gk.stun = 9; gk.z = 1; for (const q of m.players) if (q !== p && q.role !== 'gk') q.stun = 9;
    const dir = attackDir(m, 0); p.x = dir > 0 ? L - 13 : 13; p.z = ZC; m.ball.owner = p.id; stepSoccer(m, [noSInput(), noSInput()], 1 / 60);
    shoot(m, p, 0.5, 1);
    const b = m.ball, z0 = b.z, vz0 = b.vz; let maxBend = 0;
    for (let t = 0; t < 0.6; t += 1 / 60) { stepSoccer(m, [noSInput(), noSInput()], 1 / 60); maxBend = Math.max(maxBend, Math.abs(b.vz - vz0)); }
    expect(maxBend).toBeGreaterThan(1.5);
    run(m, 2);
    expect(m.teams[0].goals).toBe(1); // …y la curva la mete
    void z0;
  });
  it('el poder revienta al que le pega (sangre y huesos), suelta la pelota y después vuelve a entrar', () => {
    const m = newSoccer('industrial', ['inferno', 'thunder'], [null, null], seeded(5)); toPlay(m);
    const c = carrier(m)!, shooter = m.players.find(q => q.team !== c.team && q.role === 'def')!;
    c.x = L / 2; c.z = ZC; shooter.x = c.x - 6 * attackDir(m, c.team); shooter.z = c.z; m.teams[shooter.team].castT = 0;
    expect(castPower(m, shooter, [Math.sign(c.x - shooter.x), 0])).toBe(true);
    const ev = run(m, 0.8);
    expect(ev.some(e => e.type === 'explode')).toBe(true);
    expect(c.gone).toBe(true); expect(m.ball.owner).not.toBe(c.id);
    expect(m.gore.gibs.length).toBeGreaterThan(5); expect(m.gore.stains.length).toBeGreaterThan(3);
    expect(castPower(m, shooter)).toBe(false); // tiene que recargar
    run(m, 4);
    expect(c.gone).toBe(false);
  });
  it('los poderes salen con la combinación de cada luchador (adelante, adelante + PODER)', () => {
    const m = newSoccer('industrial', ['inferno', 'thunder'], [null, null], seeded(15)); toPlay(m);
    m.teams[0].castT = 0;
    const me = m.players[m.teams[0].active], dir = attackDir(m, 0), fwdKey = dir > 0 ? 'right' : 'left';
    const tap = (k: 'right' | 'left' | 'power' | 'up') => { const a = noSInput(); a[k] = true; stepSoccer(m, [a, noSInput()], 1 / 60); stepSoccer(m, [noSInput(), noSInput()], 1 / 60); };
    const ev: SEvent[] = [];
    tap('power'); ev.push(...takeSoccerEvents(m));
    expect(ev.some(e => e.type === 'comboMiss')).toBe(true); // sin la combinación no sale
    expect(me.cdPow).toBe(0);
    tap(fwdKey); tap(fwdKey); tap('power'); ev.push(...takeSoccerEvents(m));
    expect(ev.some(e => e.type === 'ability')).toBe(true);
  });
  it('poder al que tiene la pelota dentro del área: penal', () => {
    const m = newSoccer('industrial', ['inferno', 'thunder'], [null, null], seeded(16)); toPlay(m);
    const c = carrier(m)!, dir = attackDir(m, c.team), gx = dir > 0 ? L : 0, shooter = m.players.find(q => q.team !== c.team && q.role === 'def')!;
    c.x = gx - dir * 3; c.z = ZC; shooter.x = c.x - dir * 5; shooter.z = ZC + 2; m.teams[shooter.team].castT = 0;
    castPower(m, shooter, [dir, -0.3]);
    const ev = run(m, 0.6);
    expect(ev.some(e => e.type === 'penalty' && e.side === c.team)).toBe(true);
    expect(m.phase).toBe('penalty');
    run(m, 10);
    expect(['play', 'goal', 'intro']).toContain(m.phase); // patearon el penal (si no patea, a los 8 s patea solo)
  });
  it('los pases llegan a un compañero', () => {
    const m = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(6)); toPlay(m);
    const c = carrier(m)!; for (const q of m.players) if (q.team !== c.team) q.stun = 9;
    pass(m, c, null);
    let got = null as ReturnType<typeof carrier>;
    for (let t = 0; t < 2 && !got; t += 1 / 60) { stepSoccer(m, [noSInput(), noSInput()], 1 / 60); got = carrier(m); }
    expect(got?.team).toBe(c.team);
    expect(got).not.toBe(c);
  });
  it('la pelota nunca sale de la cancha ni se queda trabada, y casi no hay goles en contra', () => {
    let goals = 0, own = 0, maxStill = 0;
    for (const seed of [11, 12, 13, 14]) {
      const caps = [CHAR_IDS[seed % 16], CHAR_IDS[(seed * 5 + 3) % 16]] as const;
      const m = newSoccer('volcano', [caps[0], caps[1] === caps[0] ? 'bruto' : caps[1]], [0.6, 0.6], seeded(seed));
      for (let t = 0; t < 180; t += 1 / 60) {
        stepSoccer(m, [noSInput(), noSInput()], 1 / 60);
        for (const e of takeSoccerEvents(m)) if (e.type === 'goal') { goals++; if (e.own) own++; }
        const b = m.ball;
        if (m.phase === 'play') { expect(b.x).toBeGreaterThan(-2); expect(b.x).toBeLessThan(L + 2); expect(b.z).toBeGreaterThanOrEqual(BR - 0.01); expect(b.z).toBeLessThanOrEqual(D - BR + 0.01); expect(b.y).toBeLessThan(GH * 6); }
        maxStill = Math.max(maxStill, m.stillT);
        if (m.phase === 'end') break;
      }
    }
    expect(maxStill).toBeLessThan(4);
    expect(goals).toBeGreaterThan(3); // se hacen goles
    expect(own).toBeLessThanOrEqual(1);
  }, 15000); // Cuatro partidos simulados: dar margen a los equipos de CI.
  it('el arquero con la pelota la saca: pase con X o para arriba con ESPACIO', () => {
    const m = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(17)); toPlay(m);
    const gk = m.players.find(q => q.team === 0 && q.role === 'gk')!; m.ball.owner = gk.id; gk.hold = 0;
    stepSoccer(m, [noSInput(), noSInput()], 1 / 60);
    expect(m.teams[0].active).toBe(gk.id);
    const a = noSInput(); a.kick = true; stepSoccer(m, [a, noSInput()], 1 / 60);
    expect(m.ball.owner).toBeNull(); expect(m.ball.vy).toBeGreaterThan(5);
  });
  it('con la barra llena sale el FATAL GOAL y entra', () => {
    const m = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(8)); toPlay(m);
    const c = carrier(m)!; m.teams[c.team].power = POWER_MAX;
    const i = noSInput(); i.power = true; const inp: [typeof i, typeof i] = [noSInput(), noSInput()]; inp[c.team] = i;
    stepSoccer(m, inp, 1 / 60);
    expect(m.phase).toBe('fatal');
    const ev = run(m, 4);
    expect(ev.some(e => e.type === 'goal' && e.fatal)).toBe(true);
    expect(ev.some(e => e.type === 'explode' && e.keeper)).toBe(true); // el arquero revienta
  });
  void GW;
});
