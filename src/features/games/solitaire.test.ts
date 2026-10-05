import { describe, expect, it } from 'vitest';
import { bestTarget, canFinish, canMove, cardName, deal, draw, finishStep, fitsFoundation, fitsTableau, finalScore, isWon, liveScore, move, POINTS, SUITS, timeBonus, type Card, type Solitaire } from './solitaire';

const card = (suit: Card['suit'], rank: number, up = true): Card => ({ id: `${suit}-${rank}`, suit, rank, up });
const empty = (): Solitaire => ({ stock: [], waste: [], foundations: [[], [], [], []], tableau: [[], [], [], [], [], [], []], moves: 0, score: 0 });

describe('Solitario 3.000', () => {
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

  it('en las columnas se baja de a uno alternando rojo y negro, y en una vacía solo entra un Rey', () => {
    expect(fitsTableau(card('corazon', 6), [card('pica', 7)])).toBe(true);
    expect(fitsTableau(card('diamante', 6), [card('corazon', 7)])).toBe(false);
    expect(fitsTableau(card('trebol', 5), [card('diamante', 7)])).toBe(false);
    expect(fitsTableau(card('trebol', 13), [])).toBe(true);
    expect(fitsTableau(card('trebol', 12), [])).toBe(false);
  });

  it('en las bases se junta cada palo del As al Rey', () => {
    expect(fitsFoundation(card('trebol', 1), [])).toBe(true);
    expect(fitsFoundation(card('trebol', 2), [card('trebol', 1)])).toBe(true);
    expect(fitsFoundation(card('pica', 2), [card('trebol', 1)])).toBe(false);
  });

  it('mover una escalera desde una columna da vuelta la carta de abajo', () => {
    const game = empty();
    game.tableau[0] = [card('corazon', 2, false), card('pica', 9), card('diamante', 8)];
    game.tableau[1] = [card('trebol', 10)];
    expect(canMove(game, { kind: 'tableau', pile: 0, index: 1 }, { kind: 'tableau', pile: 1 })).toBe(false); // 9 negro sobre 10 negro
    game.tableau[1] = [card('diamante', 10)];
    const next = move(game, { kind: 'tableau', pile: 0, index: 1 }, { kind: 'tableau', pile: 1 })!;
    expect(next.tableau[1].map(c => c.rank)).toEqual([10, 9, 8]);
    expect(next.tableau[0]).toEqual([card('corazon', 2, true)]);
    expect(next.moves).toBe(1);
    expect(game.tableau[1]).toHaveLength(1); // no cambia el estado anterior (sirve para deshacer)
  });

  it('el mazo da vuelta de a una y, al terminarse, vuelve a armarse', () => {
    const game = empty();
    game.stock = [card('trebol', 3, false), card('trebol', 4, false)];
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
    game.waste = [card('diamante', 1)];
    expect(bestTarget(game, { kind: 'waste' })).toEqual({ kind: 'foundation', pile: 0 });
    game.waste = [card('diamante', 5)];
    game.tableau[3] = [card('trebol', 6)];
    expect(bestTarget(game, { kind: 'waste' })).toEqual({ kind: 'tableau', pile: 3 });
    game.tableau[3] = [];
    expect(bestTarget(game, { kind: 'waste' })).toBeNull();
  });

  it('cuando todo está a la vista se termina solo, y se gana con las 52 en las bases', () => {
    let game = empty();
    const suits = ['corazon', 'diamante', 'pica', 'trebol'] as const;
    suits.forEach((suit, i) => { game.tableau[i] = Array.from({ length: 13 }, (_, r) => card(suit, 13 - r)); });
    expect(canFinish(game)).toBe(true);
    for (let i = 0; i < 52; i++) game = finishStep(game)!;
    expect(isWon(game)).toBe(true);
    expect(canFinish(game)).toBe(false);
  });
});

describe('nombres de las cartas', () => {
  it('cada carta se nombra con su número y su palo', () => {
    expect(cardName(card('corazon', 1))).toBe('As de corazones');
    expect(cardName(card('trebol', 13))).toBe('K de tréboles');
    expect(SUITS).toHaveLength(4);
  });
});

describe('puntaje', () => {
  const c = (suit: Card['suit'], rank: number, up = true): Card => ({ id: `${suit}-${rank}`, suit, rank, up });
  it('suma al subir a las bases, al destapar y al completar un palo; resta al bajar y al rearmar el mazo', () => {
    const s = empty();
    s.foundations[0] = Array.from({ length: 12 }, (_, i) => c('pica', i + 1));
    s.tableau[0] = [c('corazon', 5, false), c('pica', 13)];
    const a = move(s, { kind: 'tableau', pile: 0, index: 1 }, { kind: 'foundation', pile: 0 })!;
    expect(a.score).toBe(POINTS.foundation + POINTS.suit + POINTS.reveal);
    const b = move(a, { kind: 'foundation', pile: 0 }, { kind: 'tableau', pile: 1 })!;
    expect(b.score).toBe(a.score + POINTS.backFromFoundation);
    const w = { ...empty(), waste: [c('trebol', 2)], score: 50 };
    expect(draw(w)!.score).toBe(50 + POINTS.recycle);
  });

  it('el reloj resta y al ganar rápido el premio es más grande', () => {
    const s = { ...empty(), score: 300 };
    expect(liveScore(s, 0)).toBe(300);
    expect(liveScore(s, 60)).toBe(288);
    expect(liveScore({ ...s, score: 5 }, 600)).toBe(0);
    expect(finalScore(s, 120)).toBeGreaterThan(finalScore(s, 400));
    expect(timeBonus(10000)).toBe(0);
  });
});
