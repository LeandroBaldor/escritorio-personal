import { describe, expect, it } from 'vitest';
import { BR, D, GH, GW, JUMP_T, L, LAVA_T, METEOR_T, UFO_T, ZC, attackDir, carrier, jump, newSoccer, noSInput, pass, shoot, spawnHazard, stepSoccer, takeSoccerEvents, type SoccerMatch, type SEvent } from './kombatSoccer';
import { CHAR_IDS, seeded } from './kombat';

const run = (m: SoccerMatch, s: number, ev: SEvent[] = []) => { for (let t = 0; t < s; t += 1 / 60) { stepSoccer(m, [noSInput(), noSInput()], 1 / 60); ev.push(...takeSoccerEvents(m)); } return ev; };
const toPlay = (m: SoccerMatch, hazards = false) => { m.noHazards = !hazards; run(m, m.introLen + 0.05); expect(m.phase).toBe('play'); };

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
  it('el arquero con la pelota la saca: pase con X o para arriba con ESPACIO', () => {
    const m = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(17)); toPlay(m);
    const gk = m.players.find(q => q.team === 0 && q.role === 'gk')!; m.ball.owner = gk.id; gk.hold = 0;
    stepSoccer(m, [noSInput(), noSInput()], 1 / 60);
    expect(m.teams[0].active).toBe(gk.id);
    const a = noSInput(); a.kick = true; stepSoccer(m, [a, noSInput()], 1 / 60);
    expect(m.ball.owner).toBeNull(); expect(m.ball.vy).toBeGreaterThan(5);
  });
  // ------------------------------------------------ sin ataques: lo difícil viene del escenario
  it('la cancha es más larga y los arcos más grandes', () => {
    expect(L).toBeGreaterThanOrEqual(58); expect(L / D).toBeGreaterThan(2.5); // (bien horizontal)
    expect(GW).toBeGreaterThanOrEqual(8); expect(GH).toBeGreaterThanOrEqual(3.3);
  });
  it('los jugadores no se atacan: la C es para saltar y no le hace nada al rival', () => {
    const m = newSoccer('industrial', ['inferno', 'thunder'], [null, null], seeded(5)); toPlay(m);
    const c = carrier(m)!, me = m.players.find(q => q.team !== c.team && q.role === 'fwd')!;
    m.teams[me.team].active = me.id; m.teams[me.team].switchT = 9; me.x = c.x - 2; me.z = c.z;
    const i = noSInput(); i.jump = true; const inp: [typeof i, typeof i] = [noSInput(), noSInput()]; inp[me.team] = i;
    const ev: SEvent[] = []; stepSoccer(m, inp, 1 / 60); ev.push(...takeSoccerEvents(m));
    expect(ev.some(e => e.type === 'jump')).toBe(true); expect(me.jump).toBeGreaterThan(0);
    run(m, 0.2, ev); expect(me.y).toBeGreaterThan(0.5); // en el aire
    run(m, 1.5, ev);
    expect(ev.some(e => e.type === 'explode' || e.type === 'eaten' || e.type === 'burn')).toBe(false);
    expect(m.players.every(p => !p.gone)).toBe(true);
  });
  it('aparecen peligros solos durante el partido (de los cuatro tipos)', () => {
    const kinds = new Set<string>();
    for (const seed of [21, 22]) {
      const m = newSoccer('volcano', ['frost', 'thunder'], [0.6, 0.6], seeded(seed)); toPlay(m, true);
      const ev = run(m, 60);
      for (const e of ev) if (e.type === 'hazard') kinds.add(e.kind);
      expect(ev.filter(e => e.type === 'hazard').length).toBeGreaterThan(6);
    }
    expect([...kinds].sort()).toEqual(['lava', 'meteor', 'shark', 'ufo']);
  });
  const still = (m: SoccerMatch, keep: number) => { for (const q of m.players) if (q.id !== keep) { q.stun = 99; q.x = 2 + q.id; q.z = 0.6; } };
  it('el tiburón volador se tira en picada y se come al que no se mueve', () => {
    const m = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(9)); toPlay(m);
    const v = m.players[3]; v.x = L / 2 + 6; v.z = ZC; m.ball.owner = null; m.ball.x = 5; still(m, v.id);
    const h = spawnHazard(m, 'shark')!; h.target = v.id; h.x = v.x + 22; h.z = v.z; v.stun = 99; m.teams[0].active = 1;
    const ev = run(m, 7);
    expect(ev.some(e => e.type === 'dive')).toBe(true);
    expect(ev.some(e => e.type === 'eaten')).toBe(true);
    expect(ev.find(e => e.type === 'eaten')).toMatchObject({ side: v.team, char: v.char }); expect(m.gore.stains.length).toBeGreaterThan(3);
  });
  it('la lava: primero avisa (no quema), después prende fuego al que la pisa y queda hecho cenizas; saltando se pasa por arriba', () => {
    const m = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(10)); toPlay(m);
    m.ball.owner = null; m.ball.x = 3; m.ball.z = 2;
    const v = m.players[3]; still(m, v.id); m.teams[0].active = 1;
    const h = spawnHazard(m, 'lava')!; v.x = h.x; v.z = h.z; v.stun = 99;
    run(m, LAVA_T.warn * 0.8); expect(v.burn).toBe(0); // todavía avisa
    const ev = run(m, LAVA_T.warn * 0.4 + 0.1);
    expect(ev.some(e => e.type === 'burn')).toBe(true); expect(v.burn).toBeGreaterThan(0);
    run(m, 1.5, ev); expect(ev.some(e => e.type === 'ash')).toBe(true); expect(v.gone).toBe(true);
    // otro, saltando por arriba del lago: no se quema
    const m2 = newSoccer('industrial', ['frost', 'thunder'], [null, null], seeded(11)); toPlay(m2);
    m2.ball.owner = null; m2.ball.x = 3; m2.ball.z = 2;
    const j = m2.players[3]; still(m2, j.id); m2.teams[0].active = 1;
    const h2 = spawnHazard(m2, 'lava')!; h2.r = 1.2; h2.rz = 1; run(m2, LAVA_T.warn + 0.1);
    j.x = h2.x - h2.r - 0.6; j.z = h2.z; j.stun = 0; j.vx = 7; j.vz = 0; j.tx = j.x + 40; j.tz = j.z; j.run = 1;
    expect(jump(m2, j)).toBe(true);
    const ev2 = run(m2, JUMP_T + 0.1);
    expect(j.x).toBeGreaterThan(h2.x + h2.r); expect(ev2.some(e => e.type === 'burn')).toBe(false);
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
    expect(v.gone).toBe(true); expect(m.scorch.length).toBe(1);
    run(m, 3.5); expect(v.gone).toBe(false); // y vuelve a entrar
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
});
