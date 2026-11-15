import { CHAR_IDS, STAGES, STATS, type CharId, type StageId } from './kombat';
import { SET_POINTS } from './kombatVoley';

// El Mundial de Kombat Voley: los 16 luchadores en un cuadro de eliminación directa (octavos, cuartos, semifinal y
// final), ordenado por ranking (las estadísticas de cada uno) como un cuadro de mundial: 1 contra 16, 8 contra 9…
// El partido del jugador se juega; los demás de cada fase se simulan cuando él gana el suyo.

export const CUP_ROUNDS = ['Octavos de final', 'Cuartos de final', 'Semifinal', 'Final'] as const;
// Qué cabeza de serie va en cada lugar del cuadro (de arriba a abajo: los 8 de la izquierda y los 8 de la derecha).
export const SLOT_SEEDS = [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11] as const;

export interface CupMatch { a: CharId; b: CharId; sa: number | null; sb: number | null }
export interface Cup {
  you: CharId;
  seed: Record<CharId, number>; // ranking 1..16
  rounds: CupMatch[][]; // rounds[0] = 8 partidos de octavos, rounds[1] = 4 de cuartos…
  stages: StageId[]; // el estadio del partido del jugador en cada fase
  champion: CharId | null;
}

const power = (c: CharId) => STATS[c].speed + STATS[c].strength + STATS[c].jump;
export const cupWinner = (m: CupMatch): CharId | null => (m.sa === null || m.sb === null ? null : m.sa > m.sb ? m.a : m.b);

export function newCup(you: CharId, rand: () => number = Math.random): Cup {
  const ranked = [...CHAR_IDS].map(c => [c, power(c) + rand() * 30] as const).sort((x, y) => y[1] - x[1]).map(x => x[0]);
  const seed = Object.fromEntries(ranked.map((c, i) => [c, i + 1])) as Record<CharId, number>;
  const slots = SLOT_SEEDS.map(s => ranked[s - 1]);
  const first: CupMatch[] = [];
  for (let i = 0; i < 16; i += 2) first.push({ a: slots[i], b: slots[i + 1], sa: null, sb: null });
  const st = STAGES.map(s => s.id).map(id => [id, rand()] as const).sort((x, y) => x[1] - y[1]).map(x => x[0]);
  return { you, seed, rounds: [first], stages: st.slice(0, 4), champion: null };
}
// El partido del jugador en esa fase (y contra quién).
export function yourMatch(cup: Cup, round: number) {
  const list = cup.rounds[round] ?? [], i = list.findIndex(m => m.a === cup.you || m.b === cup.you);
  if (i < 0) return null;
  const m = list[i];
  return { index: i, match: m, rival: m.a === cup.you ? m.b : m.a };
}
// Un resultado de vóley a un set: el ganador llega a 15 (o pasa al perdedor por dos si hubo empate en 14).
export function volleyScore(rand: () => number): [number, number] {
  if (rand() < 0.18) { const l = SET_POINTS - 1 + Math.floor(rand() * 4); return [l + 2, l]; }
  return [SET_POINTS, 4 + Math.floor(rand() * (SET_POINTS - 5))];
}
// Cierra la fase: anota el resultado del jugador (yours = [sus puntos, los del rival]), simula los otros partidos y
// arma la fase siguiente con los que pasaron (o corona al campeón después de la final).
// (score: cómo se simula el resultado de los otros partidos; por defecto, uno de vóley)
export function finishRound(cup: Cup, round: number, yours: [number, number], rand: () => number = Math.random, score: (rand: () => number) => [number, number] = volleyScore): Cup {
  const next: Cup = { ...cup, rounds: cup.rounds.map(r => r.map(m => ({ ...m }))) };
  const list = next.rounds[round];
  for (const m of list) {
    if (m.a === cup.you || m.b === cup.you) { [m.sa, m.sb] = m.a === cup.you ? yours : [yours[1], yours[0]]; continue; }
    const pa = 1 / (1 + Math.exp(-(power(m.a) - power(m.b)) / 45)), [w, l] = score(rand);
    if (rand() < pa) { m.sa = w; m.sb = l; } else { m.sa = l; m.sb = w; }
  }
  const winners = list.map(m => cupWinner(m)!);
  if (round + 1 < CUP_ROUNDS.length) {
    const nr: CupMatch[] = [];
    for (let i = 0; i < winners.length; i += 2) nr.push({ a: winners[i], b: winners[i + 1], sa: null, sb: null });
    next.rounds = [...next.rounds.slice(0, round + 1), nr];
  } else next.champion = winners[0];
  return next;
}
// Quién ocupa cada lugar del cuadro: fase c, posición k (de arriba a abajo; la primera mitad es el lado izquierdo).
export function cupSlot(cup: Cup, c: number, k: number) {
  const m = cup.rounds[c]?.[Math.floor(k / 2)];
  if (!m) return null;
  const side = k % 2, char = side ? m.b : m.a, score = side ? m.sb : m.sa, w = cupWinner(m);
  return { char, score, won: w === char, lost: w !== null && w !== char };
}
