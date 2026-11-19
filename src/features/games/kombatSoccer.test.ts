import { describe, expect, it } from 'vitest';
import { ACID_DEATH, ACID_T, BOMB_FIRST, BOMB_FUSE, BR, SOCCER_HALF, footballScore, FORMATIONS, TEAM_N, paceOf, D, GH, GW, L, METEOR_T, SHARK_LEN, UFO_T, ZC, attackDir, carrier, newSoccer, noSInput, pass, shoot, spawnHazard, stepSoccer, takeSoccerEvents, type SInput, type SoccerMatch, type SEvent } from './kombatSoccer';
import { CHAR_IDS, seeded } from './kombat';

const run = (m: SoccerMatch, s: number, ev: SEvent[] = []) => { for (let t = 0; t < s; t += 1 / 60) { stepSoccer(m, [noSInput(), noSInput()], 1 / 60); ev.push(...takeSoccerEvents(m)); } return ev; };
const toPlay = (m: SoccerMatch, hazards = false) => { m.noHazards = !hazards; run(m, m.introLen + 0.05); expect(m.phase).toBe('play'); };

describe('Kombat Football 5 contra 5', () => {
  it('cada equipo tiene seis iguales (el luchador elegido): el arquero y 5 jugadores', () => {
    const m = newSoccer('industrial', ['frost', 'thunder'], [null, 0.5], seeded(1));
    expect(m.players).toHaveLength(12);
    for (const t of [0, 1] as const) {
      const mine = m.players.filter(p => p.team === t);
      expect(mine.map(p => p.role)).toEqual(['gk', 'def', 'def', 'def', 'fwd', 'fwd']); // (3 + 2, la de siempre)
      expect(mine.every(p => p.char === (t === 0 ? 'frost' : 'thunder'))).toBe(true);
    }
  });
  it('las cuatro formaciones: arquero + defensores + delanteros (y en el saque saca un delantero)', () => {
    for (const f of FORMATIONS) {
      const m = newSoccer('industrial', ['frost', 'thunder'], [null, 0.5], seeded(3), { formations: [f.id, '3-2'], styles: ['bal', 'bal'] });
      const mine = m.players.filter(p => p.team === 0);
      expect(mine.filter(p => p.role === 'gk')).toHaveLength(1);
      expect(mine.filter(p => p.role === 'def')).toHaveLength(f.defs);
      expect(mine.filter(p => p.role === 'fwd')).toHaveLength(f.fwds);
      expect(f.defs + f.fwds).toBe(TEAM_N - 1);
      m.kickoffTeam = 0; toPlay(m); if (carrier(m)!.team === 0) expect(carrier(m)!.role).toBe('fwd');
    }
    expect(FORMATIONS.map(f => f.id)).toEqual(['3-2', '4-1', '2-3', '1-4']);
  });
  it('los modos: defensivo marca a los delanteros rivales con todos, equilibrado solo con los defensores, ofensivo no marca', () => {
    const marksOf = (style: 'def' | 'bal' | 'off') => {
      const m = newSoccer('industrial', ['frost', 'thunder'], [0.6, 0.6], seeded(4), { formations: ['3-2', '3-2'], styles: [style, 'bal'] });
      toPlay(m);
      const c = m.players.find(q => q.team === 1 && q.role === 'fwd')!; m.ball.owner = c.id; // la tiene el rival
      stepSoccer(m, [noSInput(), noSInput()], 1 / 60);
      return Object.entries(m.marks).map(([a, b]) => [m.players[+a], m.players[b]] as const).filter(([a]) => a.team === 0);
    };
    const d = marksOf('def'), b = marksOf('bal'), o = marksOf('off');
    expect(d.length).toBeGreaterThanOrEqual(3); expect(d.some(([a]) => a.role === 'fwd')).toBe(true);
    expect(b.length).toBeGreaterThanOrEqual(1); expect(b.every(([a, r]) => a.role === 'def' && r.role === 'fwd')).toBe(true);
    expect(o).toHaveLength(0);
  });
  it('dificultad: en Fácil la máquina es más lenta, nunca usa la C y los peligros no van contra el que maneja la persona', () => {
    const pace = (lv: number) => paceOf(newSoccer('industrial', ['frost', 'frost'], [null, lv], seeded(5)), 1);
    expect(pace(0.2)).toBeLessThan(0.8); expect(pace(0.55)).toBeGreaterThan(pace(0.2)); expect(pace(0.9)).toBeGreaterThan(pace(0.55));
    expect(paceOf(newSoccer('industrial', ['frost', 'frost'], [null, 0.2], seeded(5)), 0)).toBe(1); // (la persona, siempre igual)
    let steals = 0, onMe = 0;
    for (const seed of [41, 42]) {
      const m = newSoccer('volcano', ['frost', 'thunder'], [null, 0.2], seeded(seed));
      for (let t = 0; t < 90; t += 1 / 60) {
        stepSoccer(m, [noSInput(), noSInput()], 1 / 60);
        for (const e of takeSoccerEvents(m)) if (e.type === 'steal' && e.side === 1) steals++;
        for (const h of m.hazards) if (h.target === m.teams[0].active && h.t < 0.02) onMe++;
      }
    }
    expect(steals).toBe(0); expect(onMe).toBe(0);
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
  const press = (m: SoccerMatch, team: 0 | 1, k: keyof SInput) => { const i = noSInput(); i[k] = true; const inp: [SInput, SInput] = [noSInput(), noSInput()]; inp[team] = i; stepSoccer(m, inp, 1 / 60); stepSoccer(m, [noSInput(), noSInput()], 1 / 60); };
  it('X sin la pelota cambia al compañero más cercano a la pelota', () => {
    const m = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(70)); toPlay(m);
    m.ball.owner = null; m.ball.x = 40; m.ball.z = 5; m.ball.vx = 0; m.ball.vz = 0;
    const near = m.players[2]; near.x = 41; near.z = 6; m.players[3].x = 10; m.players[4].x = 12; m.players[1].x = 15;
    m.teams[0].active = 3; m.teams[0].switchT = 9; for (const q of m.players) q.stun = q.team === 1 ? 9 : 0;
    press(m, 0, 'pass');
    expect(m.teams[0].active).toBe(near.id);
  });
  it('los jugadores van más despacio (y no hay tecla para correr)', () => {
    const m = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(71)); toPlay(m);
    const me = m.players[3]; m.ball.owner = m.players[8].id; for (const q of m.players) if (q !== me) q.stun = 9;
    m.teams[0].active = me.id; m.teams[0].switchT = 9; me.x = 10; me.z = 5;
    const i = noSInput(); i.right = true;
    for (let t = 0; t < 1; t += 1 / 60) stepSoccer(m, [i, noSInput()], 1 / 60);
    expect(me.x - 10).toBeLessThan(5.2); expect(me.x - 10).toBeGreaterThan(2.5);
    expect('sprint' in noSInput()).toBe(false);
  });
  it('C le saca la pelota al rival: sale volando para arriba y explota en sangre y huesos', () => {
    const m = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(72)); toPlay(m);
    const c = carrier(m)!, me = m.players.find(q => q.team !== c.team && q.role === 'fwd')!;
    m.teams[me.team].active = me.id; m.teams[me.team].switchT = 9; me.x = c.x - 1.2; me.z = c.z; c.protect = 0;
    const ev: SEvent[] = [];
    press(m, me.team, 'steal'); ev.push(...takeSoccerEvents(m));
    expect(ev.some(e => e.type === 'steal')).toBe(true);
    expect(m.ball.owner).toBe(me.id); expect(c.fly).toBe(true);
    run(m, 0.2, ev); expect(c.y).toBeGreaterThan(1); // vuela para arriba
    run(m, 0.8, ev);
    expect(ev.some(e => e.type === 'explode' && e.side === c.team)).toBe(true);
    expect(c.gone).toBe(true); expect(m.gore.gibs.length).toBeGreaterThan(12); expect(m.gore.drops.length).toBeGreaterThan(40);
    // de lejos: se tira hacia él
    const m2 = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(73)); toPlay(m2);
    const c2 = carrier(m2)!, me2 = m2.players.find(q => q.team !== c2.team && q.role === 'fwd')!;
    m2.teams[me2.team].active = me2.id; m2.teams[me2.team].switchT = 9; me2.x = c2.x - 4; me2.z = c2.z; c2.stun = 9; c2.protect = 0;
    press(m2, me2.team, 'steal'); expect(me2.slide).toBeGreaterThan(0);
  });
  it('el arquero ataja los tiros flojos y no llega al tiro con la barra llena (gol)', () => {
    const res: string[] = [];
    for (const [charge, side, seed] of [[0.4, 1, 80], [0.6, -1, 81], [0.85, 1, 82], [0.5, 0, 83], [1, 1, 84], [1, -1, 85], [1, 0, 86]] as const) {
      const m = newSoccer('industrial', ['frost', 'thunder'], [0.5, 0.5], seeded(seed)); toPlay(m);
      const p = m.players.find(q => q.team === 0 && q.role === 'fwd')!;
      for (const q of m.players) if (q !== p && q.role !== 'gk') { q.stun = 99; q.z = 0.6; }
      const dir = attackDir(m, 0); p.x = dir > 0 ? L - 14 : 14; p.z = ZC + 2; m.ball.owner = p.id; stepSoccer(m, [noSInput(), noSInput()], 1 / 60);
      shoot(m, p, charge, side); p.stun = 99; // (después no juega más: solo cuenta ese tiro)
      const ev = run(m, 2.5);
      res.push(ev.some(e => e.type === 'goal' && e.side === 0) ? 'gol' : 'atajó');
    }
    expect(res).toEqual(['atajó', 'atajó', 'atajó', 'atajó', 'gol', 'gol', 'gol']);
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
  it('el arquero con la pelota la saca: pase con X o para arriba con V', () => {
    const m = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(17)); toPlay(m);
    const gk = m.players.find(q => q.team === 0 && q.role === 'gk')!; m.ball.owner = gk.id; gk.hold = 0;
    stepSoccer(m, [noSInput(), noSInput()], 1 / 60);
    expect(m.teams[0].active).toBe(gk.id);
    const a = noSInput(); a.kick = true; stepSoccer(m, [a, noSInput()], 1 / 60);
    expect(m.ball.owner).toBeNull(); expect(m.ball.vy).toBeGreaterThan(5);
  });
  // ------------------------------------------------ los peligros del escenario
  it('la cancha es más larga y los arcos más grandes', () => {
    expect(L).toBeGreaterThanOrEqual(95); expect(L / D).toBeGreaterThan(4); // (mucho más larga)
    expect(GW).toBeGreaterThanOrEqual(8); expect(GH).toBeGreaterThanOrEqual(3.3);
  });
  it('aparecen peligros solos durante el partido (de los cuatro tipos), de a uno por vez', () => {
    const kinds = new Set<string>();
    for (const seed of [21, 22]) {
      const m = newSoccer('volcano', ['frost', 'thunder'], [0.6, 0.6], seeded(seed)); toPlay(m, true);
      let maxAtOnce = 0;
      const ev: SEvent[] = [];
      for (let t = 0; t < 80; t += 1 / 60) { stepSoccer(m, [noSInput(), noSInput()], 1 / 60); ev.push(...takeSoccerEvents(m)); maxAtOnce = Math.max(maxAtOnce, m.hazards.length); }
      for (const e of ev) if (e.type === 'hazard') kinds.add(e.kind);
      expect(ev.filter(e => e.type === 'hazard').length).toBeGreaterThan(5);
      expect(maxAtOnce).toBe(1); // de a uno por vez
    }
    expect([...kinds].sort()).toEqual(['acid', 'meteor', 'shark', 'ufo']);
  });
  const still = (m: SoccerMatch, keep: number) => { for (const q of m.players) if (q.id !== keep) { q.stun = 99; q.x = 2 + q.id; q.z = 0.6; } };
  it('el tiburón volador se tira en picada y se come al que no se mueve', () => {
    const m = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(9)); toPlay(m);
    expect(SHARK_LEN).toBeGreaterThan(5); // (bien grande)
    const v = m.players[3]; v.x = L / 2 + 6; v.z = ZC; m.ball.owner = null; m.ball.x = 5; still(m, v.id);
    const h = spawnHazard(m, 'shark')!; h.target = v.id; h.x = v.x + 22; h.z = v.z; v.stun = 99; m.teams[0].active = 1;
    const ev = run(m, 7);
    expect(ev.some(e => e.type === 'dive')).toBe(true);
    expect(ev.some(e => e.type === 'eaten')).toBe(true);
    expect(ev.find(e => e.type === 'eaten')).toMatchObject({ side: v.team, char: v.char }); expect(m.gore.stains.length).toBeGreaterThan(3);
  });
  it('el ácido: primero avisa, después derrite al que lo pisa (la muerte con ácido) y el charco se seca', () => {
    const m = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(10)); toPlay(m);
    m.ball.owner = null; m.ball.x = 3; m.ball.z = 2;
    const v = m.players[3]; still(m, v.id); m.teams[0].active = 1;
    const h = spawnHazard(m, 'acid')!; v.x = h.x; v.z = h.z; v.stun = 99;
    run(m, ACID_T.warn * 0.8); expect(v.acid).toBe(0); // todavía avisa
    const ev = run(m, ACID_T.warn * 0.4 + 0.1);
    expect(ev.some(e => e.type === 'acid')).toBe(true); expect(v.acid).toBeGreaterThan(0);
    expect(h.stage).toBe(2); // el charco se seca (mata a uno solo)
    run(m, ACID_DEATH, ev); expect(ev.some(e => e.type === 'melted')).toBe(true); expect(v.gone).toBe(true);
  });
  it('el ovni sigue a un jugador, marca el piso y dispara: el que se queda adentro explota y el que sale se salva', () => {
    const m = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(12)); toPlay(m);
    m.ball.owner = null; m.ball.x = 3; m.ball.z = 2;
    const v = m.players[3]; v.x = 30; v.z = ZC; still(m, v.id); v.stun = 99; m.teams[0].active = 1;
    const h = spawnHazard(m, 'ufo')!; h.target = v.id; h.x = v.x; h.z = v.z;
    const ev = run(m, UFO_T.follow + UFO_T.charge + 0.2);
    expect(ev.some(e => e.type === 'beam')).toBe(true); expect(v.gone).toBe(true);
    const m2 = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(13)); toPlay(m2);
    m2.ball.owner = null; m2.ball.x = 3; m2.ball.z = 2;
    const w = m2.players[3]; w.x = 30; w.z = ZC; still(m2, w.id); w.stun = 99; m2.teams[0].active = 1;
    const h2 = spawnHazard(m2, 'ufo')!; h2.target = w.id; h2.x = w.x; h2.z = w.z;
    run(m2, UFO_T.follow + 0.2); w.z = ZC + 4; // se corrió de la marca
    run(m2, UFO_T.charge + 0.2);
    expect(w.gone).toBe(false);
  });
  it('el meteorito cae donde marcó y explota al que agarra (y deja el cráter)', () => {
    const m = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(14)); toPlay(m);
    m.ball.owner = null; m.ball.x = 3; m.ball.z = 2;
    const v = m.players[3]; v.x = 30; v.z = ZC; still(m, v.id); v.stun = 99; m.teams[0].active = 1;
    const h = spawnHazard(m, 'meteor')!; h.tx = v.x; h.tz = v.z;
    const ev = run(m, METEOR_T + 0.1);
    expect(ev.some(e => e.type === 'impact')).toBe(true); expect(ev.some(e => e.type === 'explode')).toBe(true);
    expect(v.gone).toBe(true); expect(m.scorch.length).toBe(1); expect(m.blasts.length).toBe(1);
    run(m, 3.5); expect(v.gone).toBe(false); // y vuelve a entrar
    // uno solo: aunque haya dos adentro de la marca, explota uno
    const m2 = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(15)); toPlay(m2);
    m2.ball.owner = null; m2.ball.x = 3; m2.ball.z = 2; still(m2, -1);
    const a = m2.players[3], b = m2.players[4]; a.x = 30; a.z = ZC; b.x = 30.8; b.z = ZC + 0.5; m2.teams[0].active = 1;
    const h2 = spawnHazard(m2, 'meteor')!; h2.tx = 30.2; h2.tz = ZC;
    const ev2 = run(m2, METEOR_T + 0.1);
    expect(ev2.filter(e => e.type === 'explode').length).toBe(1);
  });
  it('la máquina esquiva: sale de la marca del meteorito si la ve a tiempo', () => {
    let saved = 0;
    for (const seed of [61, 62, 63, 64, 65, 66]) {
      const m = newSoccer('industrial', ['frost', 'thunder'], [0.6, 0.6], seeded(seed)); toPlay(m);
      const v = m.players.find(q => q.team === 1 && q.role === 'def')!;
      const h = spawnHazard(m, 'meteor')!; h.tx = v.x; h.tz = v.z; h.react = 0.3;
      run(m, METEOR_T + 0.1); if (!v.gone) saved++;
    }
    expect(saved).toBeGreaterThanOrEqual(4);
  });
  // ------------------------------------------------ la pelota bomba
  it('la pelota bomba: aparece sola, cuenta para atrás y le explota encima al que la tiene', () => {
    const m = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(90)); toPlay(m, true);
    m.bombT = 0.1; m.hazards = []; m.hazardT = 99;
    const ev = run(m, 0.2);
    expect(ev.some(e => e.type === 'bomb')).toBe(true); expect(m.bomb).not.toBeNull();
    const c = m.players[3]; for (const q of m.players) q.stun = 99; c.stun = 0; m.ball.owner = c.id; c.x = 30; c.z = 11;
    run(m, BOMB_FUSE - 1, ev);
    expect(ev.filter(e => e.type === 'bombTick').length).toBeGreaterThanOrEqual(BOMB_FUSE - 3);
    m.ball.owner = c.id; run(m, 1.2, ev);
    expect(ev.some(e => e.type === 'bombBoom' && e.side === c.team)).toBe(true);
    expect(c.gone).toBe(true); expect(m.bomb).toBeNull(); expect(m.blasts.length).toBe(1);
    expect(BOMB_FIRST).toBeGreaterThan(10);
  });
  it('gol con la pelota bomba: vale doble y el arco vuela con el arquero', () => {
    const m = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(91)); toPlay(m);
    const p = m.players.find(q => q.team === 0 && q.role === 'fwd')!;
    for (const q of m.players) if (q !== p && q.role !== 'gk') q.stun = 99;
    const dir = attackDir(m, 0); p.x = dir > 0 ? L - 12 : 12; p.z = ZC; m.ball.owner = p.id; stepSoccer(m, [noSInput(), noSInput()], 1 / 60);
    m.bomb = 8; shoot(m, p, 1, 1); p.stun = 99;
    const ev = run(m, 2);
    expect(ev.find(e => e.type === 'goal')).toMatchObject({ side: 0, bomb: true });
    expect(m.teams[0].goals).toBe(2);
    expect(m.goalFx).not.toBeNull(); expect(ev.some(e => e.type === 'explode' && e.keeper)).toBe(true);
  });
  // ------------------------------------------------ tiempos de 2:30 y penales si empatan
  it('cada tiempo dura 2:30; si termina empatado no hay gol de oro: se define por penales', () => {
    expect(SOCCER_HALF).toBe(150);
    const m = newSoccer('industrial', ['frost', 'thunder'], [null, 0.5], seeded(95)); toPlay(m);
    expect(m.clock).toBeCloseTo(150, 0);
    m.half = 2; m.clock = 0.05; m.teams[0].goals = 1; m.teams[1].goals = 1;
    const ev = run(m, 0.2);
    expect(ev.some(e => e.type === 'penalties')).toBe(true);
    expect(m.phase).toBe('end'); expect(m.penalties).toBe(true); expect(m.winner).toBeNull(); expect(m.extra).toBe(false);
    // sin empate: gana el que hizo más goles
    const m2 = newSoccer('industrial', ['frost', 'thunder'], [null, 0.5], seeded(96)); toPlay(m2);
    m2.half = 2; m2.clock = 0.05; m2.teams[0].goals = 2; m2.teams[1].goals = 1;
    run(m2, 0.2); expect(m2.winner).toBe(0); expect(m2.penalties).toBe(false);
  });
  it('el resultado simulado del mundial: sin empates y con goles de fútbol', () => {
    const r = seeded(7);
    for (let i = 0; i < 200; i++) { const [w, l] = footballScore(r); expect(w).toBeGreaterThan(l); expect(w).toBeLessThanOrEqual(4); expect(l).toBeGreaterThanOrEqual(0); }
  });
});
