// Modo Mundial de Tiki-Taka: arranca en octavos de final y, si vas ganando, sigue hasta la final.
// Si un partido termina empatado se define por penales.

export const ROUNDS = ['Octavos de final', 'Cuartos de final', 'Semifinal', 'Final'] as const;
export const FINAL = ROUNDS.length - 1;

export const SHOUTS = {
  next: '¡Avanzaste a la siguiente ronda!!!',
  topFour: '¡Estás entre los cuatro mejores del mundo!!!',
  champion: '¡Felicitaciones Campeón del mundo!!!!',
  rematch: '¡Siempre hay revancha!!!',
};

export interface CupOutcome { won: boolean; penalties: [number, number] | null; shout: string | null; champion: boolean }

// Penales: cinco por lado y, si siguen iguales, uno y uno hasta que alguien erre.
export function penaltyShootout(rand: () => number = Math.random): [number, number] {
  let mine = 0, rival = 0;
  for (let i = 0; i < 5; i++) { if (rand() < 0.75) mine++; if (rand() < 0.72) rival++; }
  for (let i = 0; mine === rival; i++) {
    if (i > 30) { if (rand() < 0.5) mine++; else rival++; break; } // por las dudas: nunca infinito
    if (rand() < 0.75) mine++; if (rand() < 0.72) rival++;
  }
  return [mine, rival];
}

export function cupOutcome(round: number, mine: number, rival: number, rand: () => number = Math.random): CupOutcome {
  const penalties = mine === rival ? penaltyShootout(rand) : null;
  const won = penalties ? penalties[0] > penalties[1] : mine > rival;
  const final = round >= FINAL;
  // Ganar los cuartos te deja en la semifinal: entre los cuatro mejores.
  const shout = won ? (final ? SHOUTS.champion : round === FINAL - 2 ? SHOUTS.topFour : SHOUTS.next) : final ? SHOUTS.rematch : null;
  return { won, penalties, shout, champion: won && final };
}
