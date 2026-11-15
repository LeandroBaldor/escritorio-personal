import { describe, expect, it } from 'vitest';
import { CHAR_IDS, seeded } from './kombat';
import { SET_POINTS } from './kombatVoley';
import { cupSlot, cupWinner, finishRound, newCup, volleyScore, yourMatch } from './kombatVoleyCup';

describe('Mundial de Kombat Voley', () => {
  it('arma un cuadro de 16 con los 16 luchadores, 1 contra 16, 8 contra 9…', () => {
    const cup = newCup('cometa', seeded(3));
    expect(cup.rounds[0]).toHaveLength(8);
    expect(new Set(cup.rounds[0].flatMap(m => [m.a, m.b]))).toEqual(new Set(CHAR_IDS));
    expect(cup.rounds[0].map(m => [cup.seed[m.a], cup.seed[m.b]])).toEqual([[1, 16], [8, 9], [4, 13], [5, 12], [2, 15], [7, 10], [3, 14], [6, 11]]);
    expect(cup.stages).toHaveLength(4);
  });
  it('cada fase anota el resultado del jugador, simula las demás y pasan los ganadores hasta el campeón', () => {
    let cup = newCup('frost', seeded(5));
    for (let r = 0; r < 4; r++) {
      const mine = yourMatch(cup, r)!;
      expect(mine.rival).not.toBe('frost');
      cup = finishRound(cup, r, [15, 11], seeded(10 + r));
      for (const m of cup.rounds[r]) { expect(cupWinner(m)).not.toBeNull(); expect(Math.max(m.sa!, m.sb!)).toBeGreaterThanOrEqual(SET_POINTS); expect(Math.abs(m.sa! - m.sb!)).toBeGreaterThanOrEqual(2); }
      if (r < 3) { expect(cup.rounds[r + 1]).toHaveLength(4 >> r); expect(cup.rounds[r + 1].some(m => m.a === 'frost' || m.b === 'frost')).toBe(true); }
    }
    expect(cup.champion).toBe('frost');
    const s = cupSlot(cup, 3, 0)!, t = cupSlot(cup, 3, 1)!;
    expect([s.char, t.char]).toContain('frost');
    expect(s.won !== t.won).toBe(true);
  });
  it('los resultados simulados son de vóley a 15 con dos de diferencia', () => {
    const r = seeded(1);
    for (let i = 0; i < 200; i++) { const [w, l] = volleyScore(r); expect(w - l).toBeGreaterThanOrEqual(2); expect(w >= SET_POINTS && (w === SET_POINTS || w - l === 2)).toBe(true); }
  });
});
