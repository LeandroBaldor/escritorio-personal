import { describe, expect, it } from 'vitest';
import { bestTarget, canFinish, canMove, deal, draw, finishStep, fitsFoundation, fitsTableau, isWon, move, type Card, type Solitaire } from './solitaire';

const card = (suit: Card['suit'], rank: number, up = true): Card => ({ id: `${suit}-${rank}`, suit, rank, up });
const empty = (): Solitaire => ({ stock: [], waste: [], foundations: [[], [], [], []], tableau: [[], [], [], [], [], [], []], moves: 0 });

describe('Solitario de cine', () => {
  it('reparte 28 cartas en 7 columnas con la de arriba boca arriba y deja 24 en el mazo', () => {
    let seed = 9; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const game = deal(rand);
    expect(game.tableau.map(p => p.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const pile of game.tableau) {
      expect(pile[pile.length - 1].up).toBe(true);
      expect(pile.slice(0, -1).every(c => !c.up)).toBe(true);
    }
    expect(game.stock).toHaveLength(24);
    const ids = new Set([...game.stock, ...game.tableau.flat()].map(c => c.id));
    expect(ids.size).toBe(52);
  });

  it('en las columnas se baja de a uno alternando color, y en una vacía solo entra un Rey', () => {
    expect(fitsTableau(card('palomitas', 6), [card('claqueta', 7)])).toBe(true);
    expect(fitsTableau(card('estrella', 6), [card('palomitas', 7)])).toBe(false);
    expect(fitsTableau(card('rollo', 5), [card('estrella', 7)])).toBe(false);
    expect(fitsTableau(card('rollo', 13), [])).toBe(true);
    expect(fitsTableau(card('rollo', 12), [])).toBe(false);
  });

  it('en las bases se junta cada palo del As al Rey', () => {
    expect(fitsFoundation(card('rollo', 1), [])).toBe(true);
    expect(fitsFoundation(card('rollo', 2), [card('rollo', 1)])).toBe(true);
    expect(fitsFoundation(card('claqueta', 2), [card('rollo', 1)])).toBe(false);
  });

  it('mover una escalera desde una columna da vuelta la carta de abajo', () => {
    const game = empty();
    game.tableau[0] = [card('palomitas', 2, false), card('claqueta', 9), card('estrella', 8)];
    game.tableau[1] = [card('rollo', 10)];
    expect(canMove(game, { kind: 'tableau', pile: 0, index: 1 }, { kind: 'tableau', pile: 1 })).toBe(false); // 9 oscuro sobre 10 oscuro
    game.tableau[1] = [card('estrella', 10)];
    const next = move(game, { kind: 'tableau', pile: 0, index: 1 }, { kind: 'tableau', pile: 1 })!;
    expect(next.tableau[1].map(c => c.rank)).toEqual([10, 9, 8]);
    expect(next.tableau[0]).toEqual([card('palomitas', 2, true)]);
    expect(next.moves).toBe(1);
    expect(game.tableau[1]).toHaveLength(1); // no cambia el estado anterior (sirve para deshacer)
  });

  it('el mazo da vuelta de a una y, al terminarse, vuelve a armarse', () => {
    const game = empty();
    game.stock = [card('rollo', 3, false), card('rollo', 4, false)];
    const one = draw(game)!;
    expect(one.waste.map(c => c.rank)).toEqual([4]);
    expect(one.waste[0].up).toBe(true);
    const two = draw(one)!;
    const again = draw(two)!;
    expect(again.stock.map(c => c.rank)).toEqual([3, 4]);
    expect(again.stock.every(c => !c.up)).toBe(true);
    expect(again.waste).toHaveLength(0);
  });

  it('al tocar una carta va primero a su base y si no a una columna', () => {
    const game = empty();
    game.waste = [card('estrella', 1)];
    expect(bestTarget(game, { kind: 'waste' })).toEqual({ kind: 'foundation', pile: 0 });
    game.waste = [card('estrella', 5)];
    game.tableau[3] = [card('rollo', 6)];
    expect(bestTarget(game, { kind: 'waste' })).toEqual({ kind: 'tableau', pile: 3 });
    game.tableau[3] = [];
    expect(bestTarget(game, { kind: 'waste' })).toBeNull();
  });

  it('cuando todo está a la vista se termina solo, y se gana con las 52 en las bases', () => {
    let game = empty();
    const suits = ['palomitas', 'estrella', 'claqueta', 'rollo'] as const;
    suits.forEach((suit, i) => { game.tableau[i] = Array.from({ length: 13 }, (_, r) => card(suit, 13 - r)); });
    expect(canFinish(game)).toBe(true);
    for (let i = 0; i < 52; i++) game = finishStep(game)!;
    expect(isWon(game)).toBe(true);
    expect(canFinish(game)).toBe(false);
  });
});
