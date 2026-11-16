import { describe, expect, it } from 'vitest';
import { DEATH_AT, DEATH_TYPES, HEAD_GROWTH, arriveAt, kickDuration, newPenalties, startKick, stepPenalties, takePenEvents } from './kombatPenalties';
import { SIZE } from './kombat';

const body = () => ({ x: 100, y: 500, h: 300 });
describe('muertes de Kombat Penales', () => {
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
        if (type === 'ice' || type === 'acid' || type === 'ash') expect(m.gore.gibs.length + m.gore.drops.length + m.screenBlood.length).toBe(0);
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
      for (let t = 0; t < 7; t += 1 / 60) { stepPenalties(m, 1 / 60, body); for (const e of takePenEvents(m)) if (e.type === 'deathStart') deaths.push(e.death); }
    }
    expect(deaths).toEqual(['explosion', 'fire', 'explosion']);
  });
  it('el gol que pasa por la otra altura del mismo lado no mata al arquero', () => {
    const m = newPenalties('ice', ['frost', 'thunder']); m.phase = 'aim'; m.roll = 0.9;
    startKick(m, 0, 3);
    for (let t = 0; t < 5; t += 1 / 60) stepPenalties(m, 1 / 60, body);
    expect(m.lastDeath).toBeNull(); expect(m.kicks[0]).toEqual([true]);
  });
  it('la última muerte termina antes de anunciar al ganador', () => {
    const m = newPenalties('ice', ['frost', 'thunder'], () => 3.1 / 7);
    m.kicks = [[true, true, true], [false, false]]; m.turn = 5; m.phase = 'aim';
    startKick(m, 0, 0);
    for (let t = 0; t < arriveAt() + 0.5 + DEATH_AT.acid - 0.1; t += 1 / 60) stepPenalties(m, 1 / 60, body);
    expect(m.phase).toBe('kick'); expect(m.winner).toBeNull();
    for (let t = 0; t < 2; t += 1 / 60) stepPenalties(m, 1 / 60, body);
    expect(m.phase).toBe('end'); expect(m.winner).toBe(0);
  });
});
