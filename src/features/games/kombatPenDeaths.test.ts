import { describe, expect, it } from 'vitest';
import { ACID_GREEN_T, ACID_MELT_T, DEATH_AT, DEATH_LENGTH, DEATH_TYPES, HEAD_GROWTH, acidCollapse, ashFront, arriveAt, freezeProgress, kickDuration, newPenalties, startKick, stepPenalties, takePenEvents, type Zone } from './kombatPenalties';
import { kickerBody, penaltyRefTarget, refPose } from './kombatPenaltiesArt';
import { CHAR_IDS, SIZE } from './kombat';
import { opaqueStompAlpha, stompHeight } from './kombatPenStomp';

const body = () => ({ x: 100, y: 500, h: 300 });
describe('muertes de Kombat Penales', () => {
  it('el eje del cañón pasa por el pateador para todos los luchadores', () => {
    for (const char of CHAR_IDS) {
      const m = newPenalties('ice', [char, 'thunder'], () => 0); startKick(m, 0, 0);
      for (let i = 0; i < 111; i++) stepPenalties(m, 1 / 60, side => kickerBody(m.chars[side]));
      const shot = refPose(m).shot; expect(shot).not.toBeNull();
      if (!shot) continue;
      const dx = shot.to[0] - shot.from[0], dy = shot.to[1] - shot.from[1], length = Math.hypot(dx, dy);
      expect(Math.abs(dx * Math.sin(shot.angle) - dy * Math.cos(shot.angle)) / length).toBeLessThan(1e-6);
      expect(dx * Math.cos(shot.angle) + dy * Math.sin(shot.angle)).toBeGreaterThan(0);
    }
  });
  it('la pierna conserva el fondo transparente y hace opaco el interior del recorte', () => {
    const data = new Uint8ClampedArray([50, 60, 70, 0, 50, 60, 70, 20, 50, 60, 70, 120, 50, 60, 70, 253]);
    opaqueStompAlpha(data); expect([data[3], data[7], data[11], data[15]]).toEqual([0, 0, 255, 255]);
  });
  it('el pisotón emite un solo grito antes de impactar y triplica la sangre', () => {
    const m = newPenalties('ice', ['frost', 'thunder'], () => 7.1 / DEATH_TYPES.length);
    startKick(m, 0, 0); let screams = 0, sawImpact = false;
    for (let t = 0; t < 7; t += 1 / 120) {
      stepPenalties(m, 1 / 120, body);
      for (const e of takePenEvents(m)) {
        if (e.type === 'scream') { screams++; expect(m.death?.finished).toBe(false); }
        if (e.type === 'boom') { sawImpact = true; expect(screams).toBe(1); expect(m.gore.drops.length).toBeGreaterThanOrEqual(750); }
      }
    }
    expect(sawImpact).toBe(true); expect(screams).toBe(1);
  });
  it('el pie baja desde arriba, impacta en el piso y se levanta después', () => {
    expect(stompHeight(0)).toBeGreaterThan(3);
    expect(stompHeight(2)).toBeGreaterThan(stompHeight(2.4));
    expect(stompHeight(DEATH_AT.stomp)).toBe(0); expect(stompHeight(3.4)).toBe(0);
    expect(stompHeight(4.8)).toBeGreaterThan(2);
  });
  it('el hielo se rompe en bloques grandes con sangre', () => {
    const m = newPenalties('ice', ['frost', 'thunder'], () => 4.1 / DEATH_TYPES.length);
    startKick(m, 0, 0);
    for (let t = 0; t < 6; t += 1 / 120) { stepPenalties(m, 1 / 120, body); if (m.fragments.length) break; }
    expect(m.fragments.filter(f => f.size >= 300 * 0.16).length).toBeGreaterThanOrEqual(14);
    expect(m.gore.drops.length).toBeGreaterThan(100);
  });
  it('el ácido colapsa hacia el piso sin ensanchar horizontalmente el cuerpo', () => {
    let previousHeight = 1;
    for (let t = 0; t <= ACID_MELT_T + 0.2; t += 0.05) {
      const pose = acidCollapse(t);
      expect(pose.width).toBeLessThanOrEqual(1);
      expect(pose.height).toBeLessThanOrEqual(previousHeight);
      expect(pose.height).toBeGreaterThan(0);
      previousHeight = pose.height;
    }
    expect(acidCollapse(ACID_GREEN_T).height).toBe(1);
    const middle = ACID_GREEN_T + (ACID_MELT_T - ACID_GREEN_T) / 2;
    expect(acidCollapse(middle).height).toBeLessThan(0.6);
    expect(acidCollapse(middle).width).toBeGreaterThan(0.85);
  });
  it('el hielo progresa desde los pies y queda completo antes de estallar en bloques grandes', () => {
    expect(freezeProgress(0)).toBe(0); expect(freezeProgress(DEATH_AT.ice * 0.4)).toBeCloseTo(0.5);
    expect(freezeProgress(DEATH_AT.ice * 0.85)).toBe(1);
    const m = newPenalties('ice', ['frost', 'thunder'], () => 4.1 / DEATH_TYPES.length); startKick(m, 0, 0);
    for (let t = 0; t < 2 + DEATH_AT.ice + 0.05; t += 1 / 60) stepPenalties(m, 1 / 60, body);
    expect(m.fragments.filter(f => f.kind === 'ice' && f.size >= 300 * 0.08).length).toBeGreaterThanOrEqual(18);
  });
  it('el árbitro tiene un blanco y un castigo en las 36 combinaciones, incluyendo el fallo de altura', () => {
    for (let shot = 0; shot < 6; shot++) for (let dive = 0; dive < 6; dive++) {
      const m = newPenalties('ice', ['frost', 'thunder'], () => 0); startKick(m, shot as Zone, dive as Zone, 0);
      for (let t = 0; t < 2.2; t += 1 / 60) stepPenalties(m, 1 / 60, body);
      expect(penaltyRefTarget(m)).not.toBeNull();
      expect(m.death?.side).toBe(shot === dive ? 0 : 1);
      expect(takePenEvents(m).filter(e => e.type === 'deathStart')).toHaveLength(1);
    }
  });
  it('el reloj continúa después de explotar para que humo y ondas se desvanezcan', () => {
    const m = newPenalties('ice', ['frost', 'thunder'], () => 0);
    startKick(m, 0, 0);
    for (let t = 0; t < 3.1; t += 1 / 60) stepPenalties(m, 1 / 60, body);
    expect(m.death?.finished).toBe(true);
    expect(m.death?.t).toBeGreaterThan(1);
    expect(m.phase).toBe('kick');
  });
  for (const [i, type] of DEATH_TYPES.entries()) for (const keeper of [false, true]) {
    it(`${type}: víctima ${keeper ? 'arquero' : 'pateador'}, secuencia completa y limpieza`, () => {
      const m = newPenalties('ice', ['frost', 'thunder'], () => (i + 0.1) / DEATH_TYPES.length);
      m.phase = 'aim'; startKick(m, 0, keeper ? 2 : 0);
      let starts = 0, ends = 0, sawRemains = false, ashRight = true, skullScale = 0;
      for (let t = 0; t < kickDuration(type) + 0.1; t += 1 / 60) {
        stepPenalties(m, 1 / 60, body, body);
        for (const e of takePenEvents(m)) {
          if (e.type === 'deathStart') { starts++; expect(e.death).toBe(type); }
          if (e.type === 'boom') { ends++; expect(e.death).toBe(type); expect(e.keeper).toBe(keeper); }
        }
        if (m.death && !m.death.finished) { expect(m.phase).toBe('kick'); expect(m.turn).toBe(0); }
        sawRemains ||= m.gore.gibs.length > 0 || m.fragments.length > 0;
        for (const f of m.fragments) if (f.kind === 'ash') ashRight &&= f.vx > 0;
        skullScale = Math.max(skullScale, m.gore.gibs.find(g => g.kind === 'skull')?.scale ?? 0);
        if (type === 'acid' || type === 'ash') expect(m.gore.gibs.length + m.gore.drops.length + m.screenBlood.length).toBe(0);
        if (type === 'violet' && m.gore.gibs.length) { expect(m.gore.gibs.every(g => (g.scale ?? 1) < 0.3)).toBe(true); expect(m.gore.drops.length + m.gore.stains.length).toBeGreaterThan(0); }
        if (type === 'ice' && m.fragments.length) expect(m.gore.drops.length + m.gore.stains.length).toBeGreaterThan(0);
      }
      expect(starts).toBe(1); expect(ends).toBe(1);
      expect(m.kicks[0]).toEqual([keeper]); expect(m.turn).toBe(1); expect(m.phase).toBe('aim');
      expect(sawRemains).toBe(type !== 'acid'); expect(ashRight).toBe(true);
      if (type === 'head') expect(skullScale * 1.6 * 0.4).toBeCloseTo(0.74 * 1.12 * HEAD_GROWTH * (2.3 / 1.85) * SIZE[m.chars[keeper ? 1 : 0]]);
      expect(m.death).toBeNull(); expect(m.fragments).toHaveLength(0); expect(m.gore.gibs).toHaveLength(0);
    });
  }
  it('evita repetir la muerte anterior aunque el azar elija siempre el mismo índice', () => {
    const m = newPenalties('ice', ['frost', 'thunder'], () => 0);
    const deaths: string[] = [];
    for (let n = 0; n < 3; n++) {
      startKick(m, 0, 0);
      for (let t = 0; t < kickDuration('explosion') + 0.1; t += 1 / 60) { stepPenalties(m, 1 / 60, body); for (const e of takePenEvents(m)) if (e.type === 'deathStart') deaths.push(e.death); }
    }
    expect(deaths).toEqual(['explosion', 'fire', 'explosion']);
  });
  it('el gol que pasa por la otra altura del mismo lado también recibe el disparo', () => {
    const m = newPenalties('ice', ['frost', 'thunder'], () => 0); m.phase = 'aim'; m.roll = 0.9;
    startKick(m, 0, 3);
    for (let t = 0; t < 2.3; t += 1 / 60) stepPenalties(m, 1 / 60, body);
    expect(m.death?.keeper).toBe(true); expect(m.kicks[0]).toEqual([true]);
  });
  it('la última muerte termina antes de anunciar al ganador', () => {
    const m = newPenalties('ice', ['frost', 'thunder'], () => 3.1 / DEATH_TYPES.length);
    m.kicks = [[true, true, true], [false, false]]; m.turn = 5; m.phase = 'aim';
    startKick(m, 0, 0);
    for (let t = 0; t < arriveAt() + 0.5 + DEATH_AT.acid - 0.1; t += 1 / 60) stepPenalties(m, 1 / 60, body);
    expect(m.phase).toBe('kick'); expect(m.winner).toBeNull();
    for (let t = 0; t < 10; t += 1 / 60) { stepPenalties(m, 1 / 60, body); if (m.finale) break; }
    expect(m.phase).toBe('execution'); expect(m.winner).toBe(0); expect(m.finale?.loser).toBe(1);
    let finalDeath = false, prematureEnd = false, endings = 0;
    for (let t = 0; t < 20; t += 1 / 60) {
      stepPenalties(m, 1 / 60, body);
      finalDeath ||= !!m.finale && m.death?.side === 1;
      for (const e of takePenEvents(m)) if (e.type === 'end') { endings++; prematureEnd ||= !m.death?.finished; }
    }
    expect(finalDeath).toBe(true); expect(prematureEnd).toBe(false); expect(endings).toBe(1); expect(m.phase).toBe('end');
  });
  it('las cenizas nacen en los pies y ascienden hasta la cabeza, manteniendo viento a la derecha', () => {
    expect(ashFront(0)).toBe(0); expect(ashFront(DEATH_AT.ash)).toBe(1);
    const m = newPenalties('ice', ['frost', 'thunder'], () => 6.1 / DEATH_TYPES.length); startKick(m, 0, 0);
    for (let t = 0; t < 2.15; t += 1 / 60) stepPenalties(m, 1 / 60, body);
    const first = m.fragments.map(f => f.y); expect(first.length).toBeGreaterThan(0);
    expect(Math.min(...first)).toBeGreaterThan(450);
    for (let t = 0; t < DEATH_AT.ash * 0.8; t += 1 / 60) stepPenalties(m, 1 / 60, body);
    expect(Math.max(...m.fragments.map(f => f.y))).toBeLessThan(Math.min(...first));
    expect(m.fragments.every(f => f.vx > 0)).toBe(true);
  });
  for (const [i, type] of DEATH_TYPES.entries()) it(`${type}: la secuencia completa dura unos cinco segundos`, () => {
    const m = newPenalties('ice', ['frost', 'thunder'], () => (i + 0.1) / DEATH_TYPES.length); startKick(m, 0, 0);
    let started = -1, finished = -1;
    for (let t = 0; t < 10; t += 1 / 120) { stepPenalties(m, 1 / 120, body); if (m.death && started < 0) started = m.time; if (m.phase === 'aim' && started >= 0) { finished = m.time; break; } }
    expect(DEATH_LENGTH).toBeGreaterThanOrEqual(5); expect(finished - started).toBeGreaterThanOrEqual(5); expect(finished - started).toBeLessThan(5.3);
  });
  for (const winner of [0, 1] as const) for (const last of ['goal', 'save'] as const) {
    it(`la ejecución final mata al perdedor con ganador ${winner}, último penal ${last}`, () => {
      const m = newPenalties('ice', ['frost', 'thunder'], () => 0), loser = winner === 0 ? 1 : 0;
      m.kicks[winner] = [true, true, true]; m.kicks[loser] = Array(last === 'goal' ? 3 : 2).fill(false);
      m.turn = last === 'goal' ? (winner === 0 ? 6 : 7) : (loser === 0 ? 4 : 5);
      startKick(m, 0, last === 'goal' ? 2 : 0);
      let sawExecution = false, sawFinalDeath = false;
      for (let t = 0; t < 25; t += 1 / 60) {
        stepPenalties(m, 1 / 60, body); takePenEvents(m);
        if (m.phase === 'execution') { sawExecution = true; expect(m.finale?.loser).toBe(loser); expect(penaltyRefTarget(m)).toBeNull(); if (m.death) { sawFinalDeath = true; expect(m.death.side).toBe(loser); expect(m.death.type).toBe('explosion'); } }
      }
      expect(sawExecution && sawFinalDeath).toBe(true); expect(m.phase).toBe('end'); expect(m.winner).toBe(winner);
    });
  }
});
