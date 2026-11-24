// Sonidos de ambiente de "Invasión": lo que se escucha alrededor de donde apunta la mira (0 = no se escucha,
// 1 = pegado). Con más zoom se escucha más "puntual" (como un micrófono direccional).
import { aliveAliens, aliveHumans, nearby, rainAt, type Invasion } from './invasion';

export type InvasionChannel = 'city' | 'birds' | 'voices' | 'tv' | 'kitchen' | 'work' | 'fire' | 'ufo' | 'ovni' | 'mother' | 'dog' | 'rain' | 'heart';
export const INVASION_CHANNELS: InvasionChannel[] = ['city', 'birds', 'voices', 'tv', 'kitchen', 'work', 'fire', 'ufo', 'ovni', 'mother', 'dog', 'rain', 'heart'];

// `zoom` es cuántos píxeles mide una unidad en la pantalla: con más zoom, el radio de lo que se escucha es menor.
export const HEART_GAP = 10;
export function invasionLevels(g: Invasion, x: number, y: number, zoom: number): Record<InvasionChannel, number> {
  const radius = Math.max(3, Math.min(12, 420 / zoom));
  const n = nearby(g, x, y, radius);
  const rain = rainAt(g.time); // la lluvia se escucha en todos lados (y con tormenta no cantan los pájaros)
  // El corazón late cuando hay más de 10 aliens más que humanos.
  const heart = aliveAliens(g) - aliveHumans(g) > HEART_GAP ? 1 : 0;
  return { rain, heart, city: n.street, birds: n.birds * (1 - rain), voices: n.voices, tv: n.tv, kitchen: n.kitchen, work: n.work, fire: n.fire, ufo: n.ufo, ovni: n.ovni, mother: n.mother, dog: n.dog };
}
