// Tanda de penales del Mundial de Tiki-Taka (cuando un partido termina empatado). Hay tres lugares: 1
// izquierda, 2 medio y 3 derecha. Pateás vos y atajás vos, intercalados: cuando pateás elegís adónde
// patear y cuando patea el rival elegís adónde tirarte. La compu (su arquero o su pateador) ya tiene
// elegido su número al azar antes de que elijas vos: si coinciden, el arquero ataja; si no, es gol.
// Cinco por lado y, si siguen iguales, uno y uno hasta que uno meta y el otro no.

export type Spot = 1 | 2 | 3;
export const SPOTS: Spot[] = [1, 2, 3];
export const SPOT_NAMES: Record<Spot, string> = { 1: 'izquierda', 2: 'medio', 3: 'derecha' };
export type Taker = 'mine' | 'rival';
// `aim`: adónde pateó el que patea; `dive`: adónde se tiró el arquero.
export interface Kick { team: Taker; aim: Spot; dive: Spot; goal: boolean }
export interface Shootout { kicks: Kick[]; cpu: Spot; winner: Taker | null }

export const SERIES = 5;
export const randomSpot = (rand: () => number = Math.random) => SPOTS[Math.min(2, Math.floor(rand() * 3))];

export const newShootout = (rand: () => number = Math.random): Shootout => ({ kicks: [], cpu: randomSpot(rand), winner: null });
// Empezás pateando vos y después se van turnando.
export const turnOf = (s: Shootout): Taker => s.kicks.length % 2 === 0 ? 'mine' : 'rival';
export const goalsOf = (s: Shootout, team: Taker) => s.kicks.filter(k => k.team === team && k.goal).length;
export const score = (s: Shootout): [number, number] => [goalsOf(s, 'mine'), goalsOf(s, 'rival')];

function decide(s: Shootout): Taker | null {
  const [mine, rival] = score(s);
  const tm = s.kicks.filter(k => k.team === 'mine').length, tr = s.kicks.length - tm;
  if (tm >= SERIES && tm === tr) return mine === rival ? null : mine > rival ? 'mine' : 'rival';
  // En los cinco primeros se termina antes si a uno ya no le alcanzan los que le quedan.
  if (tm <= SERIES) {
    if (mine > rival + (SERIES - tr)) return 'mine';
    if (rival > mine + (SERIES - tm)) return 'rival';
  }
  return null;
}

// Patea el que le toca: `choice` es lo que elegiste vos (adónde patear o adónde tirarte).
export function kick(s: Shootout, choice: Spot, rand: () => number = Math.random): Kick | null {
  if (s.winner) return null;
  const team = turnOf(s);
  const k: Kick = team === 'mine' ? { team, aim: choice, dive: s.cpu, goal: choice !== s.cpu } : { team, aim: s.cpu, dive: choice, goal: choice !== s.cpu };
  s.kicks.push(k);
  s.winner = decide(s);
  s.cpu = randomSpot(rand); // la compu ya elige lo del próximo penal (antes de que elijas vos)
  return k;
}
