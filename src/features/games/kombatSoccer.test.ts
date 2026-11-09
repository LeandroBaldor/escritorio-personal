import { describe, expect, it } from 'vitest';
import { ATTACKS, BR, D, GH, GW, L, LEVEL_CD, ZC, attackDir, carrier, castAttack, castPower, newSoccer, noSInput, pass, shoot, stepSoccer, takeSoccerEvents, type SoccerMatch, type SEvent } from './kombatSoccer';
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
    m.teams[shooter.team].atkCd = [0, 0, 0, 0];
    expect(castAttack(m, shooter, 2, [Math.sign(c.x - shooter.x), 0])).toBe(true);
    const ev = run(m, 0.8);
    expect(ev.some(e => e.type === 'explode')).toBe(true);
    expect(c.gone).toBe(true); expect(m.ball.owner).not.toBe(c.id);
    expect(m.gore.gibs.length).toBeGreaterThan(5); expect(m.gore.stains.length).toBeGreaterThan(3);
    expect(castAttack(m, shooter, 2)).toBe(false); // tiene que recargar
    run(m, 4);
    expect(c.gone).toBe(false);
  });
  it('C una, dos, tres o cuatro veces: cuatro ataques distintos (cada uno se recarga aparte)', () => {
    const m = newSoccer('industrial', ['inferno', 'thunder'], [null, null], seeded(15)); toPlay(m);
    m.teams[0].atkCd = [0, 0, 0, 0];
    const tap = () => { const a = noSInput(); a.power = true; stepSoccer(m, [a, noSInput()], 1 / 60); stepSoccer(m, [noSInput(), noSInput()], 1 / 60); stepSoccer(m, [noSInput(), noSInput()], 1 / 60); };
    const levels: number[] = [];
    for (const n of [1, 2, 3, 4]) {
      if (carrier(m)?.team === 0) m.ball.owner = null; // (con la pelota y la barra llena sería FATAL)
      for (let k = 0; k < n; k++) tap();
      for (let t = 0; t < 0.5; t += 1 / 60) stepSoccer(m, [noSInput(), noSInput()], 1 / 60);
      for (const e of takeSoccerEvents(m)) if (e.type === 'ability' && e.side === 0) levels.push(e.level);
      m.players.forEach(p => { p.stun = 0; p.gone = false; p.inv = 0; p.dash = 0; });
    }
    expect(levels).toEqual([1, 2, 3, 4]);
    expect(m.teams[0].atkCd[3]).toBeGreaterThan(LEVEL_CD[3] - 1); expect(m.teams[0].atkCd[2]).toBeGreaterThan(0);
    for (const id of Object.keys(ATTACKS) as (keyof typeof ATTACKS)[]) expect(ATTACKS[id]).toHaveLength(4);
  });
  it('ningún ataque revienta a todo el equipo rival (como mucho dos; los demás quedan volteados)', () => {
    for (const ch of ['frost', 'bruto', 'thunder', 'inferno'] as const) {
      const m = newSoccer('industrial', [ch, 'cyber'], [null, null], seeded(60)); toPlay(m);
      m.ball.owner = null; m.ball.x = 2; m.ball.z = 2;
      const me = m.players[3]; me.x = 20; me.z = 11;
      m.players.filter(q => q.team === 1 && q.role !== 'gk').forEach((q, k) => { q.x = 22 + (k % 2) * 1.2; q.z = 9.5 + k; });
      m.teams[0].atkCd = [0, 0, 0, 0]; castAttack(m, me, 4, [1, 0]); run(m, 1.6);
      const gone = m.players.filter(q => q.team === 1 && q.gone).length;
      expect(gone).toBeLessThanOrEqual(2);
    }
  });
  it('sin la pelota: V una vez no se tira; V dos veces seguidas, barrida', () => {
    const m = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(70)); toPlay(m);
    const me = m.players[4]; m.ball.owner = m.players[8].id; // (la tiene un rival lejos)
    for (const q of m.players) if (q !== me) q.stun = 9;
    m.teams[0].active = me.id; m.teams[0].switchT = 9; me.x = 5; me.z = 3;
    const v = () => { const a = noSInput(); a.kick = true; stepSoccer(m, [a, noSInput()], 1 / 60); stepSoccer(m, [noSInput(), noSInput()], 1 / 60); };
    v(); expect(me.slide).toBe(0);
    for (let t = 0; t < 0.5; t += 1 / 60) stepSoccer(m, [noSInput(), noSInput()], 1 / 60);
    v(); v(); expect(me.slide).toBeGreaterThan(0);
  });
  it('el ataque principal (C) voltea al rival y le hace soltar la pelota (sin reventarlo)', () => {
    const m = newSoccer('industrial', ['inferno', 'thunder'], [null, null], seeded(18)); toPlay(m);
    const c = carrier(m)!, shooter = m.players.find(q => q.team !== c.team && q.role === 'def')!;
    c.x = L / 2; c.z = ZC; shooter.x = c.x - 6 * attackDir(m, c.team); shooter.z = c.z; m.teams[shooter.team].atkCd = [0, 0, 0, 0];
    castPower(m, shooter, [Math.sign(c.x - shooter.x), 0]); run(m, 0.6);
    expect(c.gone).toBe(false); expect(c.stun > 0 || m.ball.owner !== c.id).toBe(true); expect(m.ball.owner).not.toBe(c.id);
  });
  it('poder al que tiene la pelota dentro del área: penal', () => {
    const m = newSoccer('industrial', ['inferno', 'thunder'], [null, null], seeded(16)); toPlay(m);
    const c = carrier(m)!, dir = attackDir(m, c.team), gx = dir > 0 ? L : 0, shooter = m.players.find(q => q.team !== c.team && q.role === 'def')!;
    c.x = gx - dir * 3; c.z = ZC; shooter.x = c.x - dir * 5; shooter.z = ZC + 2; m.teams[shooter.team].atkCd = [0, 0, 0, 0];
    castAttack(m, shooter, 2, [dir, -0.3]);
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
  it('el pase hacia un compañero le llega a los pies (aunque esté quieto o se esté moviendo)', () => {
    for (const seed of [31, 32, 33, 34, 35, 36]) {
      const m = newSoccer('industrial', ['frost', 'thunder'], [null, 0.5], seeded(seed)); toPlay(m);
      for (const q of m.players) if (q.team === 1) { q.stun = 9; q.x = L / 2; q.z = 0.5; }
      const me = m.players[3], mate = m.players[seed % 2 ? 1 : 4];
      me.x = 15; me.z = 8; mate.x = 15 + (seed % 3) * 5 - 2; mate.z = 8 + 6 + (seed % 2) * 4; m.ball.owner = me.id; stepSoccer(m, [noSInput(), noSInput()], 1 / 60);
      m.ball.owner = me.id; me.x = 15; me.z = 8;
      for (const q of m.players) if (q.team === 0 && q !== me && q !== mate && q.role !== 'gk') { q.x = 35; q.z = 2; }
      if (seed > 33) { mate.vx = 3; mate.vz = -2; } // (uno que se mueve)
      const dx = mate.x - me.x, dz = mate.z - me.z, d = Math.hypot(dx, dz);
      pass(m, me, [dx / d, dz / d]);
      let got = null as ReturnType<typeof carrier>;
      for (let t = 0; t < 2.5 && !got; t += 1 / 60) { stepSoccer(m, [noSInput(), noSInput()], 1 / 60); got = carrier(m); }
      expect(got?.id).toBe(mate.id);
    }
  });
  it('el tiro bien cargado sale como un cometa de fuego', () => {
    const m = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(37)); toPlay(m);
    const c = carrier(m)!; shoot(m, c, 0.95, 0);
    expect(m.ball.comet).toBe(true); expect(m.ball.fx).toBe('fire');
    const m2 = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(38)); toPlay(m2);
    shoot(m2, carrier(m2)!, 0.3, 0); expect(m2.ball.comet).toBe(false);
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
  it('el arquero de la máquina con la pelota no se queda quieto: la pasa o la tira para arriba', () => {
    for (const seed of [41, 42, 43, 44]) {
      const m = newSoccer('industrial', ['frost', 'thunder'], [null, 0.5], seeded(seed)); toPlay(m);
      const gk = m.players.find(q => q.team === 1 && q.role === 'gk')!; m.ball.owner = gk.id; gk.hold = 0;
      for (let t = 0; t < 2 && m.ball.owner === gk.id; t += 1 / 60) stepSoccer(m, [noSInput(), noSInput()], 1 / 60);
      expect(m.ball.owner).not.toBe(gk.id);
    }
  });
  it('penal: el arquero decide apenas se cobra (derecha, medio o izquierda); si adivina la ataja, si no es gol', () => {
    const res: string[] = [];
    for (const [pick, side] of [[1, 1], [-1, -1], [0, 0], [1, -1], [-1, 1], [0, 1]] as const) {
      const m = newSoccer('industrial', ['frost', 'thunder'], [0.5, 0.5], seeded(50 + pick * 3 + side)); toPlay(m);
      const c = carrier(m)!, dir = attackDir(m, c.team), gx = dir > 0 ? L : 0, sh = m.players.find(q => q.team !== c.team && q.role === 'def')!;
      c.x = gx - dir * 3; c.z = ZC; sh.x = c.x - dir * 5; sh.z = ZC + 2; m.teams[sh.team].atkCd = [0, 0, 0, 0];
      castAttack(m, sh, 2, [dir, -0.3]); run(m, 0.5);
      expect(m.phase).toBe('penalty'); expect([-1, 0, 1]).toContain(m.penalty!.pick);
      m.penalty!.pick = pick; run(m, 1.7);
      const shooter = m.players[m.penalty!.shooter]; shoot(m, shooter, 0.6, side, 0, true);
      const ev = run(m, 2.5);
      const first = ev.find(e => e.type === 'goal' || e.type === 'save'); // (lo que pasa con el tiro del penal)
      res.push(first?.type === 'goal' ? 'gol' : 'atajó');
    }
    expect(res.slice(0, 3)).toEqual(['atajó', 'atajó', 'atajó']);
    expect(res.slice(3)).toEqual(['gol', 'gol', 'gol']);
  });
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
