import { describe, expect, it } from 'vitest';
import { kick, newShootout, score, SPOT_NAMES, turnOf, type Spot } from './penalties';

describe('Penales del Mundial', () => {
  it('hay tres lugares: 1 izquierda, 2 medio y 3 derecha', () => {
    expect(SPOT_NAMES).toEqual({ 1: 'izquierda', 2: 'medio', 3: 'derecha' });
  });

  it('la compu ya tiene elegido su número antes de que elijas: si coincide ataja, si no es gol', () => {
    const s = newShootout(() => 0.5); // la compu eligió el 2
    expect(s.cpu).toBe(2);
    expect(turnOf(s)).toBe('mine');
    const mine = kick(s, 3, () => 0.1)!; // pateás al 3 y el arquero se tira al 2
    expect(mine).toEqual({ team: 'mine', aim: 3, dive: 2, goal: true });
    expect(s.cpu).toBe(1); // para el próximo ya eligió el 1
    expect(turnOf(s)).toBe('rival');
    const rival = kick(s, 1)!; // te tirás al 1, justo donde patea el rival
    expect(rival).toEqual({ team: 'rival', aim: 1, dive: 1, goal: false });
    expect(score(s)).toEqual([1, 0]);
  });

  it('la compu elige al azar entre los tres', () => {
    const seen = new Set<Spot>();
    for (let i = 0; i < 60; i++) seen.add(newShootout().cpu);
    expect(seen).toEqual(new Set([1, 2, 3]));
  });

  it('son cinco por lado y se termina antes si a uno ya no le alcanza', () => {
    const s = newShootout(() => 0.5);
    // Vos metés todos (pateás al 1, el arquero siempre al 2) y el rival erra todos (te tirás donde patea).
    for (let i = 0; i < 6; i++) kick(s, turnOf(s) === 'mine' ? 1 : s.cpu, () => 0.5);
    expect(score(s)).toEqual([3, 0]);
    expect(s.winner).toBe('mine'); // 3 a 0 con dos por patear: ya no lo alcanzan
    expect(kick(s, 1)).toBeNull();
  });

  it('si después de cinco siguen iguales, uno y uno hasta que uno meta y el otro no', () => {
    const s = newShootout(() => 0.5);
    for (let i = 0; i < 10; i++) kick(s, turnOf(s) === 'mine' ? 1 : 3, () => 0.5); // todos goles
    expect(score(s)).toEqual([5, 5]);
    expect(s.winner).toBeNull();
    kick(s, 2, () => 0.5); // atajan el tuyo
    expect(s.winner).toBeNull(); // falta el del rival
    kick(s, 1, () => 0.5); // el rival la mete
    expect(s.winner).toBe('rival');
    expect(score(s)).toEqual([5, 6]);
  });
});
