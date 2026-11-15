import { describe, expect, it } from 'vitest';
import { beginShootout, fxOfTurn, rpsWinner, shooterOf, keeperBlewIt, kickDuration, newPenalties, penaltyScore, resolveKick, shootoutWinner, startKick, stepPenalties, suddenDeath, takePenEvents, type Kicks } from './kombatPenalties';
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
    const ev: string[] = []; let skull = false;
    for (let t = 0; t < kickDuration() + 0.2; t += 1 / 60) { stepPenalties(m, 1 / 60, () => ({ x: 0, y: 0, h: 368 })); ev.push(...takePenEvents(m).map(e => e.type)); skull ||= m.gore.gibs.some(g => g.kind === 'skull'); }
    expect(m.kicks[0]).toEqual([false]);
    expect(ev).toEqual(expect.arrayContaining(['kick', 'save', 'boom', 'whistle']));
    expect(skull).toBe(true);
    expect(m.turn).toBe(1);
    // el siguiente penal empieza limpio: sin huesos, sangre ni manchas
    expect(m.gore.gibs.length + m.gore.drops.length + m.gore.stains.length + m.screenBlood.length).toBe(0);
  });
  it('si es gol y el arquero se tiró para el otro lado, explota el arquero', () => {
    expect(keeperBlewIt(0, 5)).toBe(true); expect(keeperBlewIt(0, 3)).toBe(false); expect(keeperBlewIt(1, 0)).toBe(true);
    const m = newPenalties('ice', ['frost', 'thunder'], () => 0.5); m.phase = 'aim';
    startKick(m, 0, 2);
    const booms: boolean[] = [];
    for (let t = 0; t < kickDuration() + 0.2; t += 1 / 60) { stepPenalties(m, 1 / 60, () => ({ x: 0, y: 0, h: 300 }), () => ({ x: 600, y: 700, h: 200 })); for (const e of takePenEvents(m)) if (e.type === 'boom') booms.push(e.keeper); }
    expect(m.kicks[0]).toEqual([true]);
    expect(booms).toEqual([true]);
  });
  it('la pelota cambia de efecto en cada ronda y vuelve a empezar después del quinto', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(fxOfTurn)).toEqual(['fuego', 'fuego', 'electricidad', 'electricidad', 'viento', 'viento', 'radiacion', 'radiacion', 'laser', 'laser', 'fuego', 'fuego']);
  });
  it('la suerte del penal se sortea con el silbato, antes de que elija la persona', () => {
    let n = 0; const seq = [0.1, 0.9, 0.9, 0.9];
    const m = newPenalties('ice', ['frost', 'thunder'], () => seq[n++ % seq.length]);
    beginShootout(m, 0);
    expect(m.roll).toBe(0.1);
    startKick(m, 0, 3, 0.3); // mismo lado, otra altura: con la suerte del silbato (0,1 < 0,3) llega con la punta de los dedos
    expect(m.kick?.outcome).toBe('save');
  });
  it('piedra, papel o tijera y quién patea primero', () => {
    expect(rpsWinner('piedra', 'tijera')).toBe(0); expect(rpsWinner('tijera', 'papel')).toBe(0); expect(rpsWinner('papel', 'piedra')).toBe(0);
    expect(rpsWinner('piedra', 'papel')).toBe(1); expect(rpsWinner('papel', 'papel')).toBe(null);
    expect([0, 1, 2, 3].map(n => shooterOf(n, 1))).toEqual([1, 0, 1, 0]);
    expect([0, 1, 2, 3].map(n => shooterOf(n))).toEqual([0, 1, 0, 1]);
  });
  it('el mundial de penales sortea los rivales al azar', () => {
    const firsts = new Set<string>();
    for (let i = 0; i < 20; i++) { const c = newCup('frost', Math.random, true); firsts.add(c.rounds[0].map(m => m.a + m.b).join()); expect(c.rounds[0].flatMap(m => [m.a, m.b]).sort()).toHaveLength(16); }
    expect(firsts.size).toBeGreaterThan(10);
  });
  it('el mundial simula resultados de penales sin empates', () => {
    for (let i = 0; i < 50; i++) { const [a, b] = penaltyScore(Math.random); expect(a).toBeGreaterThan(b); }
    const cup = finishRound(newCup('frost', () => 0.3), 0, [5, 4], Math.random, penaltyScore);
    expect(cup.rounds[1]).toHaveLength(4);
    expect(cup.rounds[0].every(m => m.sa !== null && m.sa !== m.sb)).toBe(true);
  });
});
