import { describe, expect, it } from 'vitest';
import { kickDuration, newPenalties, penaltyScore, resolveKick, shootoutWinner, startKick, stepPenalties, suddenDeath, takePenEvents, type Kicks } from './kombatPenalties';
import { finishRound, newCup } from './kombatVoleyCup';

const k = (a: string, b: string): Kicks => [[...a].map(c => c === 'G'), [...b].map(c => c === 'G')];
describe('Kombat Penales: la tanda', () => {
  it('se corta en los 5 cuando uno ya no puede alcanzar al otro', () => {
    expect(shootoutWinner(k('GGG', 'XX'))).toBe(null); // le quedan 3 al segundo
    expect(shootoutWinner(k('GGGG', 'XXX'))).toBe(0); // 4 a 0 con 2 por patear: ya no llega
    expect(shootoutWinner(k('XXX', 'GGG'))).toBe(1);
    expect(shootoutWinner(k('GGGGX', 'GGGGG'))).toBe(1);
  });
  it('si empatan los 5, uno cada uno hasta que alguno erre', () => {
    expect(shootoutWinner(k('GGGXX', 'GGXGX'))).toBe(null);
    expect(suddenDeath(k('GGGXX', 'GGXGX'))).toBe(true);
    expect(shootoutWinner(k('GGGXXG', 'GGXGX'))).toBe(null); // falta el del segundo
    expect(shootoutWinner(k('GGGXXG', 'GGXGXG'))).toBe(null);
    expect(shootoutWinner(k('GGGXXGX', 'GGXGXGG'))).toBe(1);
    expect(shootoutWinner(k('GGGXXGG', 'GGXGXGX'))).toBe(0);
  });
  it('el arquero ataja si se tira al mismo lugar; mismo lado y otra altura, a veces', () => {
    expect(resolveKick(0, 0, () => 0.99)).toBe('save');
    expect(resolveKick(0, 2, () => 0)).toBe('goal');
    expect(resolveKick(0, 3, () => 0.1, 0.3)).toBe('save');
    expect(resolveKick(0, 3, () => 0.5, 0.3)).toBe('goal');
  });
  it('un penal atajado: se anota errado, el que pateó explota y pasa al siguiente', () => {
    const m = newPenalties('volcano', ['frost', 'thunder'], () => 0.5);
    m.phase = 'aim';
    startKick(m, 2, 2);
    const ev: string[] = [];
    for (let t = 0; t < kickDuration() + 0.2; t += 1 / 60) { stepPenalties(m, 1 / 60, () => ({ x: 0, y: 0, h: 368 })); ev.push(...takePenEvents(m).map(e => e.type)); }
    expect(m.kicks[0]).toEqual([false]);
    expect(ev).toEqual(expect.arrayContaining(['kick', 'save', 'boom', 'whistle']));
    expect(m.gore.gibs.some(g => g.kind === 'skull')).toBe(true);
    expect(m.turn).toBe(1);
  });
  it('el mundial simula resultados de penales sin empates', () => {
    for (let i = 0; i < 50; i++) { const [a, b] = penaltyScore(Math.random); expect(a).toBeGreaterThan(b); }
    const cup = finishRound(newCup('frost', () => 0.3), 0, [5, 4], Math.random, penaltyScore);
    expect(cup.rounds[1]).toHaveLength(4);
    expect(cup.rounds[0].every(m => m.sa !== null && m.sa !== m.sb)).toBe(true);
  });
});
