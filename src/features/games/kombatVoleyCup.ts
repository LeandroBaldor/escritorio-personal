import { CHAR_IDS, STAGES, STATS, type CharId, type StageId } from './kombat';
import { SET_POINTS } from './kombatVoley';

// El Mundial de Kombat Voley (y de Kombat Penales): los 16 luchadores en un cuadro de eliminación directa (octavos,
// cuartos, semifinal y final). Pueden jugar varias personas (hasta MAX_CUP_PLAYERS), cada una con su luchador; los
// cruces se sortean al azar, pero dos personas nunca se cruzan en octavos. Los partidos con alguna persona se juegan
// (de a uno, en orden); los demás de cada fase se simulan cuando terminan los de las personas.

export const CUP_ROUNDS = ['Octavos de final', 'Cuartos de final', 'Semifinal', 'Final'] as const;
export const MAX_CUP_PLAYERS = 8; // (uno por partido de octavos: así nunca se cruzan dos personas en octavos)

export interface CupMatch { a: CharId; b: CharId; sa: number | null; sb: number | null; pa?: number; pb?: number } // pa/pb: los penales (Kombat Football, si empataron)
export interface Cup {
  humans: CharId[]; // los luchadores de las personas (el índice + 1 es el número de jugador)
  seed: Record<CharId, number>; // ranking 1..16 (por estadísticas; en Kombat Penales, al azar)
  rounds: CupMatch[][]; // rounds[0] = 8 partidos de octavos, rounds[1] = 4 de cuartos…
  stages: StageId[]; // el estadio de cada fase
  champion: CharId | null;
}

const power = (c: CharId) => STATS[c].speed + STATS[c].strength + STATS[c].jump;
export const cupWinner = (m: CupMatch): CharId | null => (m.sa === null || m.sb === null ? null : m.sa === m.sb && m.pa !== undefined && m.pb !== undefined ? (m.pa > m.pb ? m.a : m.b) : m.sa > m.sb ? m.a : m.b);
export const isHuman = (cup: Cup, c: CharId) => cup.humans.includes(c);
export const playerNo = (cup: Cup, c: CharId) => cup.humans.indexOf(c) + 1; // 0 = la máquina
const shuffle = <T,>(list: T[], rand: () => number) => list.map(x => [x, rand()] as const).sort((x, y) => x[1] - y[1]).map(x => x[0]);

// (shuffled: el ranking también se sortea, sin mirar las estadísticas; lo usa Kombat Penales)
export function newCup(players: CharId | CharId[], rand: () => number = Math.random, shuffled = false): Cup {
  const humans = [...new Set(Array.isArray(players) ? players : [players])].slice(0, MAX_CUP_PLAYERS);
  const ranked = [...CHAR_IDS].map(c => [c, shuffled ? rand() : power(c) + rand() * 30] as const).sort((x, y) => y[1] - x[1]).map(x => x[0]);
  const seed = Object.fromEntries(ranked.map((c, i) => [c, i + 1])) as Record<CharId, number>;
  // cruces al azar: cada persona en un partido distinto de octavos (y de un lado al azar); el resto, máquinas mezcladas
  const slots: (CharId | null)[] = Array(16).fill(null), games = shuffle([0, 1, 2, 3, 4, 5, 6, 7], rand);
  humans.forEach((h, i) => { slots[games[i] * 2 + (rand() < 0.5 ? 0 : 1)] = h; });
  const cpus = shuffle(CHAR_IDS.filter(c => !humans.includes(c)), rand);
  for (let i = 0; i < 16; i++) if (!slots[i]) slots[i] = cpus.pop()!;
  const first: CupMatch[] = [];
  for (let i = 0; i < 16; i += 2) first.push({ a: slots[i]!, b: slots[i + 1]!, sa: null, sb: null });
  const st = shuffle(STAGES.map(s => s.id), rand);
  return { humans, seed, rounds: [first], stages: st.slice(0, 4), champion: null };
}
// El próximo partido de personas que falta jugar en esa fase (de arriba a abajo), con los lados para jugarlo: la persona
// va a la izquierda (lado 0); si son dos personas, la de arriba del cuadro va a la izquierda.
export function nextHumanMatch(cup: Cup, round: number) {
  const list = cup.rounds[round] ?? [], index = list.findIndex(m => m.sa === null && (isHuman(cup, m.a) || isHuman(cup, m.b)));
  if (index < 0) return null;
  const match = list[index], flipped = !isHuman(cup, match.a);
  const chars: [CharId, CharId] = flipped ? [match.b, match.a] : [match.a, match.b];
  return { index, match, flipped, chars, humans: [true, isHuman(cup, chars[1])] as [boolean, boolean] };
}
// Las personas que siguen en carrera en esa fase.
export const humansIn = (cup: Cup, round: number) => (cup.rounds[round] ?? []).flatMap(m => [m.a, m.b]).filter(c => isHuman(cup, c));
// Anota el resultado de un partido (score = [puntos de a, puntos de b]).
// (pens: el resultado de los penales, si empataron; lo usa Kombat Football)
export function setMatchScore(cup: Cup, round: number, index: number, score: [number, number], pens?: [number, number]): Cup {
  return { ...cup, rounds: cup.rounds.map((r, i) => i !== round ? r : r.map((m, j) => j !== index ? m : { ...m, sa: score[0], sb: score[1], ...(pens ? { pa: pens[0], pb: pens[1] } : {}) })) };
}
// Un resultado de vóley a un set: el ganador llega a 15 (o pasa al perdedor por dos si hubo empate en 14).
export function volleyScore(rand: () => number): [number, number] {
  if (rand() < 0.18) { const l = SET_POINTS - 1 + Math.floor(rand() * 4); return [l + 2, l]; }
  return [SET_POINTS, 4 + Math.floor(rand() * (SET_POINTS - 5))];
}
// Cierra la fase: simula los partidos que no se jugaron y arma la fase siguiente con los que pasaron (o corona al
// campeón después de la final).
// (score: cómo se simula el resultado de los otros partidos; por defecto, uno de vóley)
export function finishRound(cup: Cup, round: number, rand: () => number = Math.random, score: (rand: () => number) => [number, number] = volleyScore): Cup {
  const next: Cup = { ...cup, rounds: cup.rounds.map(r => r.map(m => ({ ...m }))) };
  const list = next.rounds[round];
  for (const m of list) {
    if (m.sa !== null && m.sb !== null) continue;
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
// Después de anotar un partido de personas: si quedan otros de personas en la fase, se sigue en la misma; si no, se
// cierra la fase. Si ya no queda ninguna persona, se simula el resto hasta el campeón ('out'); si ganó una persona la
// final, 'champion'. reveal = la fase que se acaba de completar (para la animación del cuadro).
export function advanceCup(cup: Cup, round: number, rand: () => number = Math.random, score: (rand: () => number) => [number, number] = volleyScore) {
  if (nextHumanMatch(cup, round)) return { cup, round, reveal: 0, done: null as 'champion' | 'out' | null }; // (reveal 0: sin animación)
  let c = finishRound(cup, round, rand, score), r = round;
  if (c.champion) return { cup: c, round: r, reveal: 4, done: isHuman(c, c.champion) ? 'champion' as const : 'out' as const };
  r++;
  if (humansIn(c, r).length) return { cup: c, round: r, reveal: r, done: null };
  while (!c.champion) { c = finishRound(c, r, rand, score); if (!c.champion) r++; }
  return { cup: c, round: r, reveal: 4, done: 'out' as const };
}
// Quién ocupa cada lugar del cuadro: fase c, posición k (de arriba a abajo; la primera mitad es el lado izquierdo).
export function cupSlot(cup: Cup, c: number, k: number) {
  const m = cup.rounds[c]?.[Math.floor(k / 2)];
  if (!m) return null;
  const side = k % 2, char = side ? m.b : m.a, score = side ? m.sb : m.sa, w = cupWinner(m), pen = (side ? m.pb : m.pa) ?? null;
  return { char, score, pen, won: w === char, lost: w !== null && w !== char };
}
