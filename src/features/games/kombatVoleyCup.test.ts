import { describe, expect, it } from 'vitest';
import { CHAR_IDS, seeded } from './kombat';
import { SET_POINTS } from './kombatVoley';
import { advanceCup, cupSlot, cupWinner, humansIn, isHuman, newCup, nextHumanMatch, setMatchScore, volleyScore } from './kombatVoleyCup';

describe('Mundial de Kombat Voley', () => {
  it('arma un cuadro de 16 con los 16 luchadores y cruces al azar', () => {
    const cup = newCup('cometa', seeded(3));
    expect(cup.rounds[0]).toHaveLength(8);
    expect(new Set(cup.rounds[0].flatMap(m => [m.a, m.b]))).toEqual(new Set(CHAR_IDS));
    expect(cup.stages).toHaveLength(4);
    const orders = new Set([1, 2, 3, 4, 5].map(n => newCup('cometa', seeded(n)).rounds[0].map(m => m.a + m.b).join()));
    expect(orders.size).toBeGreaterThan(1);
  });
  it('varias personas: nunca se cruzan en octavos', () => {
    for (let n = 0; n < 60; n++) {
      const cup = newCup(['cometa', 'frost', 'inferno', 'toxic'], seeded(n));
      expect(cup.humans).toHaveLength(4);
      for (const m of cup.rounds[0]) expect(isHuman(cup, m.a) && isHuman(cup, m.b)).toBe(false);
      expect(new Set(cup.rounds[0].flatMap(m => [m.a, m.b]))).toEqual(new Set(CHAR_IDS));
    }
  });
  it('hasta 8 personas: una en cada partido de octavos', () => {
    const eight = CHAR_IDS.slice(0, 8);
    for (let n = 0; n < 30; n++) {
      const cup = newCup(eight, seeded(n));
      expect(cup.humans).toHaveLength(8);
      for (const m of cup.rounds[0]) expect(Number(isHuman(cup, m.a)) + Number(isHuman(cup, m.b))).toBe(1);
    }
    expect(newCup(CHAR_IDS.slice(0, 10), seeded(1)).humans).toHaveLength(8);
  });
  it('se juegan los partidos de las personas de a uno y después se simulan los demás, hasta el campeón', () => {
    let cup = newCup('frost', seeded(5)), round = 0;
    for (let r = 0; r < 4; r++) {
      const mine = nextHumanMatch(cup, round)!;
      expect(mine.chars[0]).toBe('frost'); expect(mine.chars[1]).not.toBe('frost');
      cup = setMatchScore(cup, round, mine.index, mine.flipped ? [11, 15] : [15, 11]);
      const adv = advanceCup(cup, round, seeded(10 + r));
      cup = adv.cup;
      for (const m of cup.rounds[r]) { expect(cupWinner(m)).not.toBeNull(); expect(Math.max(m.sa!, m.sb!)).toBeGreaterThanOrEqual(SET_POINTS); expect(Math.abs(m.sa! - m.sb!)).toBeGreaterThanOrEqual(2); }
      if (r < 3) { expect(adv.done).toBeNull(); expect(adv.round).toBe(r + 1); expect(cup.rounds[r + 1]).toHaveLength(4 >> r); round = adv.round; } else expect(adv.done).toBe('champion');
    }
    expect(cup.champion).toBe('frost');
    const s = cupSlot(cup, 3, 0)!, t = cupSlot(cup, 3, 1)!;
    expect([s.char, t.char]).toContain('frost');
    expect(s.won !== t.won).toBe(true);
  });
  it('con dos personas: si una pierde sigue la otra; si pierden todas se simula hasta el campeón', () => {
    let cup = newCup(['frost', 'cometa'], seeded(7));
    const first = nextHumanMatch(cup, 0)!;
    cup = setMatchScore(cup, 0, first.index, first.flipped ? [15, 3] : [3, 15]); // la primera pierde
    let adv = advanceCup(cup, 0, seeded(1));
    expect(adv.round).toBe(0); expect(adv.done).toBeNull();
    const second = nextHumanMatch(adv.cup, 0)!;
    expect(second.index).not.toBe(first.index);
    cup = setMatchScore(adv.cup, 0, second.index, second.flipped ? [15, 3] : [3, 15]); // la segunda también
    adv = advanceCup(cup, 0, seeded(2));
    expect(adv.done).toBe('out'); expect(adv.cup.champion).not.toBeNull(); expect(isHuman(adv.cup, adv.cup.champion!)).toBe(false);
    expect(humansIn(adv.cup, 1)).toHaveLength(0);
  });
  it('los resultados simulados son de vóley a 15 con dos de diferencia', () => {
    const r = seeded(1);
    for (let i = 0; i < 200; i++) { const [w, l] = volleyScore(r); expect(w - l).toBeGreaterThanOrEqual(2); expect(w >= SET_POINTS && (w === SET_POINTS || w - l === 2)).toBe(true); }
  });
  it('Kombat Football: si empataron, pasa el que ganó los penales (y el cuadro los muestra)', () => {
    const cup = newCup('frost', seeded(3));
    const m0 = cup.rounds[0][0];
    const c2 = setMatchScore(cup, 0, 0, [1, 1], [3, 4]);
    expect(cupWinner(c2.rounds[0][0])).toBe(m0.b);
    expect(cupSlot(c2, 0, 0)).toMatchObject({ score: 1, pen: 3, lost: true });
    expect(cupSlot(c2, 0, 1)).toMatchObject({ score: 1, pen: 4, won: true });
    expect(cupSlot(setMatchScore(cup, 0, 0, [2, 1]), 0, 0)).toMatchObject({ pen: null, won: true });
  });
});
