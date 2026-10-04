// Lógica del "Solitario de Superhéroes" (Klondike, de a una carta). Corazones son héroes de
// Marvel, diamantes villanos de Marvel, picas héroes de DC y tréboles villanos de DC. En las
// columnas se apila bajando de a uno y alternando Marvel y DC (como rojo y negro en el solitario
// de siempre); arriba (en las bases) se junta cada palo del As al Rey.

import { heroOf } from './heroes';

export type Suit = 'corazon' | 'diamante' | 'pica' | 'trebol';
export const SUITS: Suit[] = ['corazon', 'diamante', 'pica', 'trebol'];
export const SUIT_NAMES: Record<Suit, string> = { corazon: 'corazones', diamante: 'diamantes', pica: 'picas', trebol: 'tréboles' };
export const RANK_NAMES = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const isMarvel = (suit: Suit) => suit === 'corazon' || suit === 'diamante';

export interface Card { id: string; suit: Suit; rank: number; up: boolean }
export interface Solitaire { stock: Card[]; waste: Card[]; foundations: Card[][]; tableau: Card[][]; moves: number }
export type From = { kind: 'waste' } | { kind: 'foundation'; pile: number } | { kind: 'tableau'; pile: number; index: number };
export type To = { kind: 'foundation'; pile: number } | { kind: 'tableau'; pile: number };

export const cardName = (card: Card) => `${heroOf(card.suit, card.rank).name}, ${({ 1: 'As', 11: 'J', 12: 'Q', 13: 'K' } as Record<number, string>)[card.rank] ?? card.rank} de ${SUIT_NAMES[card.suit]}`;

export function deal(rand: () => number = Math.random): Solitaire {
  const deck: Card[] = SUITS.flatMap(suit => Array.from({ length: 13 }, (_, i) => ({ id: `${suit}-${i + 1}`, suit, rank: i + 1, up: false })));
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const tableau = Array.from({ length: 7 }, (_, col) => deck.splice(0, col + 1).map((card, i) => ({ ...card, up: i === col })));
  return { stock: deck, waste: [], foundations: [[], [], [], []], tableau, moves: 0 };
}

const top = <T,>(list: T[]) => list[list.length - 1];

export const fitsFoundation = (card: Card, pile: Card[]) =>
  pile.length === 0 ? card.rank === 1 : top(pile).suit === card.suit && top(pile).rank + 1 === card.rank;

export const fitsTableau = (card: Card, pile: Card[]) => {
  const under = top(pile);
  if (!under) return card.rank === 13;
  return under.up && isMarvel(under.suit) !== isMarvel(card.suit) && under.rank === card.rank + 1;
};

// Las cartas que se levantan desde un lugar (en una columna, la carta y todas las de encima).
export function picked(state: Solitaire, from: From): Card[] {
  if (from.kind === 'waste') return state.waste.length ? [top(state.waste)] : [];
  if (from.kind === 'foundation') { const pile = state.foundations[from.pile]; return pile.length ? [top(pile)] : []; }
  const pile = state.tableau[from.pile];
  const cards = pile.slice(from.index);
  return cards.length && cards.every(card => card.up) ? cards : [];
}

export function canMove(state: Solitaire, from: From, to: To) {
  const cards = picked(state, from);
  if (!cards.length) return false;
  if (to.kind === 'foundation') return cards.length === 1 && !(from.kind === 'foundation' && from.pile === to.pile) && fitsFoundation(cards[0], state.foundations[to.pile]);
  if (from.kind === 'tableau' && from.pile === to.pile) return false;
  return fitsTableau(cards[0], state.tableau[to.pile]);
}

const clone = (state: Solitaire): Solitaire => ({
  stock: [...state.stock], waste: [...state.waste], moves: state.moves,
  foundations: state.foundations.map(p => [...p]), tableau: state.tableau.map(p => [...p]),
});

export function move(state: Solitaire, from: From, to: To): Solitaire | null {
  if (!canMove(state, from, to)) return null;
  const next = clone(state);
  const count = picked(state, from).length;
  let cards: Card[];
  if (from.kind === 'waste') cards = next.waste.splice(-1);
  else if (from.kind === 'foundation') cards = next.foundations[from.pile].splice(-1);
  else {
    cards = next.tableau[from.pile].splice(-count);
    const left = next.tableau[from.pile];
    if (left.length && !top(left).up) left[left.length - 1] = { ...top(left), up: true }; // se da vuelta la de abajo
  }
  if (to.kind === 'foundation') next.foundations[to.pile].push(...cards);
  else next.tableau[to.pile].push(...cards);
  next.moves++;
  return next;
}

// Tocar el mazo: da vuelta una carta; si ya no quedan, vuelven todas las de la pila al mazo.
export function draw(state: Solitaire): Solitaire | null {
  if (!state.stock.length && !state.waste.length) return null;
  const next = clone(state);
  if (next.stock.length) next.waste.push({ ...next.stock.pop()!, up: true });
  else { next.stock = next.waste.reverse().map(card => ({ ...card, up: false })); next.waste = []; }
  next.moves++;
  return next;
}

// Adónde va una carta al tocarla: primero a su base y, si no, a la primera columna donde entra.
export function bestTarget(state: Solitaire, from: From): To | null {
  const cards = picked(state, from);
  if (!cards.length) return null;
  if (cards.length === 1 && from.kind !== 'foundation') {
    for (let pile = 0; pile < 4; pile++) if (canMove(state, from, { kind: 'foundation', pile })) return { kind: 'foundation', pile };
  }
  // Un Rey que ya está solo al fondo de una columna no tiene sentido moverlo a otra vacía.
  if (from.kind === 'tableau' && from.index === 0 && cards[0].rank === 13) return null;
  const order = [...state.tableau.keys()].sort((a, b) => Number(state.tableau[a].length === 0) - Number(state.tableau[b].length === 0));
  for (const pile of order) if (canMove(state, from, { kind: 'tableau', pile })) return { kind: 'tableau', pile };
  return null;
}

export const isWon = (state: Solitaire) => state.foundations.every(pile => pile.length === 13);

// Con todas las cartas a la vista y el mazo vacío, el juego se puede terminar solo.
export const canFinish = (state: Solitaire) =>
  !isWon(state) && !state.stock.length && !state.waste.length && state.tableau.every(pile => pile.every(card => card.up));

export function finishStep(state: Solitaire): Solitaire | null {
  for (let pile = 0; pile < 7; pile++) {
    const cards = state.tableau[pile];
    if (!cards.length) continue;
    const from: From = { kind: 'tableau', pile, index: cards.length - 1 };
    for (let f = 0; f < 4; f++) {
      const next = move(state, from, { kind: 'foundation', pile: f });
      if (next) return next;
    }
  }
  return null;
}
