// Sonidos de ambiente de "Ciudad Tiburón": cuánto se escucha la lluvia, el viento y el agua de las calles
// (0 = nada, 1 = al máximo). Adentro de un departamento la lluvia y el viento se escuchan apagados.
import { galeAt, windAt, type SharkGame } from './shark';

export type StormChannel = 'rain' | 'wind' | 'water' | 'rotor';
export const STORM_CHANNELS: StormChannel[] = ['rain', 'wind', 'water', 'rotor'];
export const ROTOR_HEAR = 14; // hasta dónde se escucha la hélice de un tiburón volador
export const WATER_HEAR = 6; // a cuántas unidades del agua se deja de escuchar la corriente de cerca

export function stormLevels(g: SharkGame): Record<StormChannel, number> {
  const p = g.player, inside = p.inside !== null ? 0.45 : 1;
  const wind = Math.min(1, 0.2 + Math.abs(windAt(g.time)) * 0.6 + Math.abs(galeAt(g)));
  const water = p.swimming ? 1 : 0.25 + 0.75 * Math.max(0, 1 - Math.max(0, p.y) / WATER_HEAR);
  // La hélice del tiburón volador más cercano (más fuerte cuando acelera para tirarse en picada).
  let rotor = 0;
  for (const f of g.flyers) {
    const d = Math.hypot(f.x - p.x, f.y - p.y), k = Math.max(0, 1 - d / ROTOR_HEAR) * (f.state === 'warn' || f.state === 'dive' ? 1 : 0.7);
    rotor = Math.max(rotor, k);
  }
  return { rain: 0.85 * inside, wind: wind * inside, water: water * (p.inside !== null ? 0.6 : 1), rotor: rotor * inside };
}
