// Sonidos de ambiente de "Invasión": lo que se escucha alrededor de donde apunta la mira (0 = no se escucha,
// 1 = pegado). Con más zoom se escucha más "puntual" (como un micrófono direccional).
import { nearby, type Invasion } from './invasion';

export type InvasionChannel = 'city' | 'birds' | 'voices' | 'tv' | 'kitchen' | 'music' | 'work' | 'gym' | 'fire' | 'ufo' | 'tick' | 'dog';
export const INVASION_CHANNELS: InvasionChannel[] = ['city', 'birds', 'voices', 'tv', 'kitchen', 'music', 'work', 'gym', 'fire', 'ufo', 'tick', 'dog'];

// `zoom` es cuántos píxeles mide una unidad en la pantalla: con más zoom, el radio de lo que se escucha es menor.
export function invasionLevels(g: Invasion, x: number, y: number, zoom: number): Record<InvasionChannel, number> {
  const radius = Math.max(3, Math.min(12, 420 / zoom));
  const n = nearby(g, x, y, radius);
  return { city: n.street, birds: n.birds, voices: n.voices, tv: n.tv, kitchen: n.kitchen, music: n.music, work: n.work, gym: n.gym, fire: n.fire, ufo: n.ufo, tick: n.tick, dog: n.dog };
}
