// Sonidos de ambiente de Trepaluna: cuánto se escucha cada tipo de objeto según lo cerca que esté del
// personaje (0 = no se escucha, 1 = pegado). El fuego y los láseres solo suenan mientras están prendidos.
import { ballPos, birdPos, fireActive, fireRect, laserActive, laserHalf, PLAYER_H, weatherAt, WORLD_W, type Plat, type Trepa } from './trepaluna';

export type AmbientChannel =
  | 'fire' | 'motor' | 'conveyor' | 'swing' | 'electric' | 'wind' | 'hum'
  | 'bird' | 'plane' | 'drone' | 'meteor'
  | 'balloon' | 'propeller' | 'hover' | 'hydraulic' | 'ufo'
  | 'city' | 'rain' | 'gale';
export const AMBIENT_CHANNELS: AmbientChannel[] = [
  'fire', 'motor', 'conveyor', 'swing', 'electric', 'wind', 'hum',
  'bird', 'plane', 'drone', 'meteor',
  'balloon', 'propeller', 'hover', 'hydraulic', 'ufo',
  'city', 'rain', 'gale',
];
// Se escucha hasta unas 7 unidades (más o menos media pantalla) y sube de volumen al acercarse.
export const HEAR_RADIUS = 7;

// Cada plataforma que se mueve suena según lo que es: el globo aerostático con su quemador, el dirigible
// con su hélice, las baldosas voladoras con sus helicitas, el pistón con su aire comprimido, el ovni…
const PLAT_CHANNEL: Partial<Record<Plat['skin'], AmbientChannel>> = {
  basket: 'balloon', zeppelin: 'propeller', tile: 'hover', lift: 'motor', crane: 'motor',
  piston: 'hydraulic', techTile: 'hydraulic', ufo: 'ufo', satellite: 'ufo',
};

const near = (d: number) => Math.max(0, 1 - d / HEAR_RADIUS);
const boxDist = (x: number, y: number, x1: number, x2: number, y1: number, y2: number) =>
  Math.hypot(Math.max(x1 - x, 0, x - x2), Math.max(y1 - y, 0, y - y2));

const silence = (): Record<AmbientChannel, number> => Object.fromEntries(AMBIENT_CHANNELS.map(c => [c, 0])) as Record<AmbientChannel, number>;

export function ambientLevels(g: Trepa): Record<AmbientChannel, number> {
  const levels = silence();
  const x = g.player.x, y = g.player.y + PLAYER_H / 2, t = g.time;
  // El clima según la altura: la ciudad (hasta los 1.000 m), la lluvia (de 2.000 a 3.000 m) y el viento fuerte
  // (desde los 3.000 m).
  const w = weatherAt(g.player.y);
  levels.city = w.city; levels.rain = w.storm; levels.gale = w.night;
  const hear = (channel: AmbientChannel, d: number, k = 1) => { if (d < HEAR_RADIUS) levels[channel] = Math.max(levels[channel], near(d) * k); };
  const close = (y1: number, y2: number) => y2 > y - HEAR_RADIUS && y1 < y + HEAR_RADIUS;

  for (const f of g.fires) {
    if (!close(f.y - 2, f.y + f.len + 2) || !fireActive(f, t)) continue;
    const r = fireRect(f);
    hear('fire', boxDist(x, y, r.x1, r.x2, r.y1, r.y2));
  }
  for (const p of g.plats) {
    if (!close(p.y - 3, p.y + 3)) continue;
    const d = boxDist(x, y, p.x, p.x + p.w, p.y - 0.4, p.y);
    if (p.kind === 'conveyor') { hear('conveyor', d); continue; }
    if (p.kind !== 'moving' && p.kind !== 'elevator') continue;
    const channel = PLAT_CHANNEL[p.skin] ?? 'motor';
    // El globo prende el quemador cuando sube (ruge fuerte); al bajar apenas cruje y sopla.
    hear(channel, channel === 'balloon' ? boxDist(x, y, p.x, p.x + p.w, p.y - 0.4, p.y + 3) : d, channel === 'balloon' && p.dy <= 0 ? 0.3 : 1);
  }
  for (const gear of g.gears) if (close(gear.y - gear.r, gear.y + gear.r)) hear('motor', Math.max(0, Math.hypot(x - gear.x, y - gear.y) - gear.r), 0.8);
  // La bola de demolición zumba más fuerte cuanto más rápido pasa (en el medio de la hamaca).
  for (const b of g.balls) {
    if (!close(b.py - b.len - 1, b.py + 1)) continue;
    const pos = ballPos(b, t), speed = Math.abs(Math.cos(t * b.speed + b.phase));
    hear('swing', Math.hypot(x - pos.x, y - pos.y), 0.25 + 0.75 * speed);
  }
  // Pájaros (piídos), aviones (motor que pasa; se escuchan desde más lejos), drones y meteoritos.
  for (const b of g.birds) {
    if (!close(b.y - 3, b.y + 3)) continue;
    const pos = birdPos(b, t), d = Math.hypot(x - pos.x, y - pos.y);
    if (b.skin === 'plane') hear('plane', Math.max(0, d - 2));
    else hear(b.skin, d);
  }
  for (const l of g.lasers) {
    if (!close(l.y - 1, l.y + 1) || !laserActive(l, t)) continue;
    const h = laserHalf(l);
    hear('electric', boxDist(x, y, l.x1, l.x2, l.y - h, l.y + h));
  }
  // Los ventiladores soplan de un costado al otro: se escuchan a la altura de su corriente.
  for (const f of g.fans) if (close(f.y1, f.y2)) hear('wind', boxDist(x, y, 0, WORLD_W, f.y1, f.y2));
  for (const m of g.magnets) if (close(m.y1, m.y2)) hear('hum', boxDist(x, y, m.x - 0.7, m.x + 0.7, m.y1, m.y2));
  for (const p of g.portals) hear('hum', Math.min(Math.hypot(x - p.x1, y - p.y1), Math.hypot(x - p.x2, y - p.y2)), 0.7);
  return levels;
}
