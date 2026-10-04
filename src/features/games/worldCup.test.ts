import { describe, expect, it } from 'vitest';
import { cupOutcome, FINAL, penaltyShootout, ROUNDS, SHOUTS } from './worldCup';

describe('Mundial de Tiki-Taka', () => {
  it('arranca en octavos y termina en la final', () => {
    expect(ROUNDS[0]).toBe('Octavos de final');
    expect(ROUNDS[FINAL]).toBe('Final');
  });

  it('ganar avanza de ronda; ganar los cuartos te deja entre los cuatro mejores; ganar la final, campeón', () => {
    expect(cupOutcome(0, 2, 1)).toMatchObject({ won: true, shout: SHOUTS.next, champion: false });
    expect(cupOutcome(1, 3, 0).shout).toBe(SHOUTS.topFour);
    expect(cupOutcome(2, 1, 0).shout).toBe(SHOUTS.next);
    expect(cupOutcome(FINAL, 2, 0)).toMatchObject({ won: true, shout: SHOUTS.champion, champion: true });
  });

  it('perder la final: siempre hay revancha; perder antes no tiene cartel', () => {
    expect(cupOutcome(FINAL, 0, 1)).toMatchObject({ won: false, shout: SHOUTS.rematch, champion: false });
    expect(cupOutcome(0, 0, 1)).toMatchObject({ won: false, shout: null });
  });

  it('el empate se define por penales y nunca termina igualado', () => {
    for (let s = 1; s < 40; s++) {
      let seed = s; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const [a, b] = penaltyShootout(rand);
      expect(a).not.toBe(b);
    }
    expect(penaltyShootout(() => 0.1)[0]).not.toBe(penaltyShootout(() => 0.1)[1]); // aunque todos la metan, termina
    const tie = cupOutcome(0, 1, 1);
    expect(tie.penalties).not.toBeNull();
    expect(tie.won).toBe(tie.penalties![0] > tie.penalties![1]);
  });
});
