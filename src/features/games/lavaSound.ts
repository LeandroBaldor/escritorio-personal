// Sonidos de ambiente de "¡El piso es de lava!": cuánto se escucha cada cosa según lo cerca que esté del
// personaje (0 = no se escucha, 1 = pegado). La gente prendida fuego suena con su propia grabación y a lo lejos
// suena siempre, bajito, una sirena. Los cortocircuitos solo suenan mientras chispean y el
// ascensor solo mientras se mueve.
import { elevatorAt, HELI_H, HELI_W, heliState, personX, PLAYER_H, sparkActive, type LavaGame } from './lava';

export type LavaChannel = 'lava' | 'fire' | 'burning' | 'electric' | 'heli' | 'elevator' | 'siren';
export const LAVA_CHANNELS: LavaChannel[] = ['lava', 'fire', 'burning', 'electric', 'heli', 'elevator', 'siren'];
// Hasta dónde se escucha cada cosa (en unidades; la pantalla muestra unas 14 de alto).
export const LAVA_HEAR = 12, HEAR = 6.5, HELI_HEAR = 18;

const near = (d: number, radius: number) => Math.max(0, 1 - d / radius);
const boxDist = (x: number, y: number, x1: number, x2: number, y1: number, y2: number) =>
  Math.hypot(Math.max(x1 - x, 0, x - x2), Math.max(y1 - y, 0, y - y2));

export function lavaLevels(g: LavaGame): Record<LavaChannel, number> {
  const x = g.player.x, y = g.player.y + PLAYER_H / 2, t = g.time;
  const levels: Record<LavaChannel, number> = { lava: 0, fire: 0, burning: 0, electric: 0, heli: 0, elevator: 0, siren: 1 };
  const hear = (channel: LavaChannel, d: number, radius = HEAR) => { levels[channel] = Math.max(levels[channel], near(d, radius)); };
  // La lava burbujea siempre un poco (se ve abajo) y ruge cuando está cerca.
  levels.lava = Math.max(0.12, near(Math.max(0, y - g.lava), LAVA_HEAR));
  for (const f of g.fires) if (Math.abs(f.y - y) < HEAR + 2) hear('fire', boxDist(x, y, f.x1, f.x2, f.y, f.y + f.h));
  for (const q of g.people) if (q.torch && q.burnAt === null && Math.abs(q.y - y) < HEAR + 2) { const { x: qx } = personX(q, t); hear('burning', boxDist(x, y, qx - 0.3, qx + 0.3, q.y, q.y + PLAYER_H)); }
  for (const s of g.sparks) if (Math.abs(s.y1 - y) < HEAR + 2 && sparkActive(s, t)) hear('electric', boxDist(x, y, s.x1, s.x2, s.y1, s.y2));
  // El helicóptero se escucha desde lejos (más fuerte en el aire, con el rotor a toda potencia).
  const st = heliState(g, t);
  levels.heli = near(boxDist(x, y, st.x, st.x + HELI_W, st.y, st.y + HELI_H), HELI_HEAR) * (st.phase === 'landed' ? 0.75 : 1);
  for (const e of g.elevators) {
    const at = elevatorAt(e, t);
    if (at.dir !== 0) hear('elevator', boxDist(x, y, e.x, e.x + e.w, at.y, at.y + 2.2));
  }
  return levels;
}
