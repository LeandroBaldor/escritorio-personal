// Lógica de "Trepaluna": como un juego de plataformas clásico, pero para arriba. El personaje trepa
// desde la calle hasta la Luna. Internamente todo se mide en "unidades" (el personaje mide una) y en
// pantalla se muestran metros (1 unidad = 10 m). La altura crece hacia arriba (y = 0 es la calle).
//
// - Ciudad (0 a 1.000 m): edificios a los costados, terrazas, balcones enfrentados, vigas de obra,
//   escaleras en zigzag, escaleras de mano, caños que tiran fuego, baldosas que van y vienen,
//   montacargas, cintas transportadoras, bolas de demolición, ladrillos que se desarman y trampolines.
// - Cielo (1.000 a 1.250 m): ya no hay edificios; globos aerostáticos, dirigibles, andamios flotantes,
//   sogas y pájaros que te empujan.
// - Nubes (1.250 a 1.500 m): se pasa a través de las nubes (no se puede pisar una nube).
// - Zona tecnológica (1.500 a 2.300 m, desde la mitad del recorrido): láseres y rayos eléctricos que se
//   prenden y apagan, ventiladores que empujan, imanes que te levantan, engranajes que giran,
//   teletransportadores, plataformas que desaparecen, pistones y drones.
// - Espacio (desde 2.300 m): menos gravedad, satélites, asteroides, ovnis, estaciones, meteoritos y drones.
// - La Luna, con su banderín, es el último salto.
//
// Si te quemás con el fuego o te caés demasiado, perdés: el personaje cae por toda la estructura
// hasta la calle y aparece GAME OVER. Todas las plataformas se atraviesan desde abajo.

export const WORLD_W = 16;
export const M_PER_UNIT = 10;
export const ZONES = { sky: 100, clouds: 125, tech: 150, space: 230, moon: 300 };
export type Zone = 'city' | 'sky' | 'clouds' | 'tech' | 'space';
export type Kind = 'ground' | 'solid' | 'tramp' | 'moving' | 'elevator' | 'crumble' | 'conveyor' | 'blink' | 'moon';
export type Skin =
  | 'ground' | 'beam' | 'scaffold' | 'terrace' | 'tank' | 'billboard' | 'balcony' | 'step' | 'tile' | 'crane' | 'lift'
  | 'bricks' | 'conveyor' | 'spring' | 'basket' | 'zeppelin' | 'cloudBricks' | 'asteroid' | 'station' | 'satellite'
  | 'ufo' | 'rocket' | 'neon' | 'techTile' | 'piston' | 'glass' | 'hologram' | 'moon';
export interface Plat {
  id: number; kind: Kind; skin: Skin; x: number; y: number; w: number; baseX: number; baseY: number;
  amp: number; speed: number; phase: number; dx: number; dy: number; crumble: number; gone: number; belt: number; hue: number;
}
export interface Climb { id: number; x: number; y1: number; y2: number; skin: 'ladder' | 'rope' | 'truss' }
export interface Fire { id: number; x: number; y: number; dir: 'up' | 'left' | 'right'; len: number; period: number; on: number; phase: number }
export interface Ball { id: number; px: number; py: number; len: number; amp: number; speed: number; phase: number }
export interface Bird { id: number; y: number; x0: number; x1: number; speed: number; phase: number; skin: 'bird' | 'plane' | 'meteor' | 'drone' }
// Zona tecnológica.
export interface Laser { id: number; y: number; x1: number; x2: number; period: number; on: number; phase: number; style: 'laser' | 'zap' }
export interface Fan { id: number; side: -1 | 1; y1: number; y2: number; force: number } // ventilador pegado a un costado: sopla hacia el otro
export interface Magnet { id: number; x: number; y1: number; y2: number } // columna que te levanta
export interface Gear { id: number; x: number; y: number; r: number; speed: number }
export interface Portal { id: number; x1: number; y1: number; x2: number; y2: number; hue: number }
export interface Facade { id: number; side: -1 | 1; y1: number; y2: number; w: number; hue: number }
export interface Link { from: number; to: number; mode: 'jump' | 'tramp' | 'climb' | 'walk' | 'magnet' | 'portal'; dy: number; edge: number; fromY: number }
export interface Player {
  x: number; y: number; vx: number; vy: number; facing: 1 | -1; ground: Plat | null; climb: Climb | null;
  climbCooldown: number; coyote: number; stun: number; spin: number; portalCooldown: number;
}
export interface Input { left: boolean; right: boolean; jump: boolean; down: boolean }
export type LoseReason = 'burn' | 'zap' | 'fall';
export type TrepaEvent =
  | { type: 'jump' } | { type: 'tramp' } | { type: 'crumble' } | { type: 'knock' } | { type: 'zone'; zone: Zone } | { type: 'teleport' }
  | { type: 'lose'; reason: LoseReason } | { type: 'gameover' } | { type: 'win' };
export interface Course {
  plats: Plat[]; climbs: Climb[]; fires: Fire[]; balls: Ball[]; birds: Bird[]; facades: Facade[]; links: Link[];
  lasers: Laser[]; fans: Fan[]; magnets: Magnet[]; gears: Gear[]; portals: Portal[];
}
export interface Trepa extends Course {
  player: Player; time: number; best: number; bestGround: number; won: boolean;
  dying: { t: number; reason: LoseReason } | null; over: boolean; zone: Zone; events: TrepaEvent[];
}

// Mismo tamaño y movimiento que el personaje de ¡Cuidado, bloques!: corre a 6, salta con 12,5, gravedad
// 30 (menos en el espacio), cae como máximo a 18 y, manteniendo saltar, vuelve a saltar apenas toca el piso.
export const PLAYER_W = 0.6, PLAYER_H = 0.85;
const RUN = 6;
export const JUMP = 12.5;
export const TRAMP = 22;
const CLIMB = 4;
export const FALL_LOSE = 10; // caer más de 100 m por debajo de lo más alto que pisaste es perder
const BALL_R = 0.75, BIRD_R = 0.5;
const MAGNET_LIFT = 6.5, MAGNET_W = 1.4, PORTAL_R = 0.55;
const MAX_FALL = 18;

export const zoneOf = (y: number): Zone => y < ZONES.sky ? 'city' : y < ZONES.clouds ? 'sky' : y < ZONES.tech ? 'clouds' : y < ZONES.space ? 'tech' : 'space';
export const gravityAt = (y: number) => y < ZONES.space ? 30 : 17;
export const meters = (y: number) => Math.max(0, Math.floor(y * M_PER_UNIT));
export const jumpPeak = (v: number, y: number) => (v * v) / (2 * gravityAt(y));
export const center = (p: Plat) => p.x + p.w / 2;

// Lo que se mueve depende solo del tiempo, así el dibujo usa las mismas cuentas.
export const fireActive = (f: Fire, t: number) => ((t + f.phase) % f.period) < f.period * f.on;
export const fireWarning = (f: Fire, t: number) => ((t + f.phase) % f.period) / f.period > 0.82;
export function fireRect(f: Fire) {
  if (f.dir === 'up') return { x1: f.x - 0.35, x2: f.x + 0.35, y1: f.y + 0.5, y2: f.y + 0.5 + f.len };
  return f.dir === 'right' ? { x1: f.x + 0.4, x2: f.x + 0.4 + f.len, y1: f.y - 0.3, y2: f.y + 0.3 } : { x1: f.x - 0.4 - f.len, x2: f.x - 0.4, y1: f.y - 0.3, y2: f.y + 0.3 };
}
export function ballPos(b: Ball, t: number) {
  const a = b.amp * Math.sin(t * b.speed + b.phase);
  return { x: b.px + Math.sin(a) * b.len, y: b.py - Math.cos(a) * b.len, angle: a };
}
export const laserActive = (l: Laser, t: number) => ((t + l.phase) % l.period) < l.period * l.on;
export const laserWarning = (l: Laser, t: number) => ((t + l.phase) % l.period) / l.period > 0.8;
export const laserHalf = (l: Laser) => l.style === 'zap' ? 0.3 : 0.18;
// Plataformas que desaparecen: firmes un rato, titilan y se apagan.
export const blinkOn = (p: Plat, t: number) => ((t + p.phase) % p.speed) < p.speed * 0.6;
export const fanPush = (f: Fan) => -f.side * f.force;

export function birdPos(b: Bird, t: number) {
  const span = b.x1 - b.x0, k = ((t * b.speed / span + b.phase) % 2 + 2) % 2;
  return { x: b.x0 + (k < 1 ? k : 2 - k) * span, y: b.y + Math.sin(t * 3 + b.phase * 5) * 0.3, dir: k < 1 ? 1 : -1 };
}

// ---------- Recorrido ----------
type Seg = 'beams' | 'terrace' | 'ladder' | 'fireLadder' | 'zigzag' | 'balconies' | 'firePipe' | 'tiles' | 'elevator'
  | 'tramp' | 'crumble' | 'conveyor' | 'wreck' | 'crane' | 'birds' | 'zeppelin'
  | 'lasers' | 'zaps' | 'fans' | 'magnet' | 'gears' | 'portal' | 'blink';
const SEGMENTS: Record<Zone, [Seg, number][]> = {
  city: [['beams', 2], ['terrace', 1.4], ['ladder', 1.2], ['fireLadder', 1], ['zigzag', 1.3], ['balconies', 1.3], ['firePipe', 1.5],
    ['tiles', 1.2], ['elevator', 1], ['tramp', 1], ['crumble', 1], ['conveyor', 0.9], ['wreck', 1], ['crane', 0.9]],
  sky: [['beams', 1.2], ['ladder', 1.2], ['firePipe', 1], ['tiles', 1], ['elevator', 1.4], ['tramp', 1], ['birds', 1.4], ['zeppelin', 1.3]],
  clouds: [['beams', 1.2], ['ladder', 1], ['tiles', 1.2], ['elevator', 1.3], ['crumble', 1], ['birds', 1.3], ['zeppelin', 1.1]],
  tech: [['lasers', 1.6], ['zaps', 1.5], ['fans', 1.5], ['magnet', 1.5], ['gears', 1.5], ['portal', 1.5], ['blink', 1.6], ['elevator', 1.1],
    ['conveyor', 1], ['tiles', 1], ['tramp', 1], ['crumble', 1], ['birds', 1.1], ['fireLadder', 1], ['zigzag', 0.8]],
  space: [['beams', 1.6], ['ladder', 1.2], ['fireLadder', 1], ['firePipe', 1.5], ['tiles', 1.4], ['elevator', 1.2], ['tramp', 1.2], ['crumble', 1],
    ['birds', 1.2], ['lasers', 1], ['portal', 1], ['blink', 1], ['magnet', 0.9]],
};
const SIGNATURE: Record<Zone, Seg[]> = {
  city: ['terrace', 'firePipe', 'zigzag', 'balconies'], sky: ['birds', 'zeppelin', 'elevator'], clouds: ['tiles', 'elevator'],
  tech: ['fireLadder', 'gears', 'fans', 'portal', 'magnet', 'blink', 'zaps', 'lasers'], space: ['birds', 'tramp', 'tiles', 'elevator'],
};
const BEAM_SKINS: Record<Zone, Skin[]> = { city: ['beam', 'scaffold', 'billboard'], sky: ['scaffold', 'beam'], clouds: ['scaffold', 'cloudBricks'], tech: ['neon', 'hologram', 'neon'], space: ['asteroid', 'station'] };
const TILE_SKIN: Record<Zone, Skin> = { city: 'tile', sky: 'tile', clouds: 'tile', tech: 'techTile', space: 'ufo' };
const LIFT_SKIN: Record<Zone, Skin> = { city: 'lift', sky: 'basket', clouds: 'basket', tech: 'piston', space: 'ufo' };
const MOVER_SKIN: Record<Zone, Skin> = { city: 'crane', sky: 'zeppelin', clouds: 'zeppelin', tech: 'techTile', space: 'satellite' };
const CLIMB_SKIN: Record<Zone, Climb['skin']> = { city: 'ladder', sky: 'rope', clouds: 'rope', tech: 'truss', space: 'truss' };
const TECH_SEGS: Seg[] = ['lasers', 'zaps', 'fans', 'magnet', 'gears', 'portal', 'blink'];
const CRUMBLE_SKIN: Record<Zone, Skin> = { city: 'bricks', sky: 'bricks', clouds: 'bricks', tech: 'glass', space: 'glass' };

export function buildCourse(seed = 20261004): Course {
  let s = seed;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const between = (a: number, b: number) => a + rand() * (b - a);
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
  const course: Course = { plats: [], climbs: [], fires: [], balls: [], birds: [], facades: [], links: [], lasers: [], fans: [], magnets: [], gears: [], portals: [] };
  const { plats, climbs, fires, balls, birds, facades, links, lasers, fans, magnets, gears, portals } = course;
  let id = 1;
  const add = (kind: Kind, skin: Skin, cx: number, y: number, w: number, extra: Partial<Plat> = {}) => {
    const x = Math.max(0.3, Math.min(WORLD_W - w - 0.3, cx - w / 2));
    const p: Plat = { id: id++, kind, skin, x, y, w, baseX: x, baseY: y, amp: 0, speed: 0, phase: 0, dx: 0, dy: 0, crumble: 0, gone: 0, belt: 0, hue: Math.floor(rand() * 360), ...extra };
    plats.push(p);
    return p;
  };
  const edgeGap = (a: Plat, b: Plat) => Math.max(0, Math.abs(center(a) - center(b)) - (a.w + b.w) / 2);
  const link = (a: Plat, b: Plat, mode: Link['mode'], fromY = a.y, toY = b.y) => links.push({ from: a.id, to: b.id, mode, dy: toY - fromY, edge: edgeGap(a, b), fromY });

  let top = add('ground', 'ground', WORLD_W / 2, 0, WORLD_W - 0.6);
  const zone = () => zoneOf(top.y);
  const diff = () => Math.min(1, top.y / ZONES.moon);
  const reach = () => zone() === 'space' ? 3.9 : 2.3;
  const gapY = () => reach() * between(0.68, 0.78 + 0.18 * diff());
  const width = (big: number, small: number) => Math.max(small, big - (big - small) * diff());
  // Próxima x: cerca de la anterior, sin que el hueco entre los bordes pase de 2,3.
  const nearX = (w: number, want?: number, spread = 4) => {
    const c = center(top), lim = (top.w + w) / 2 + 2.3;
    const x = want ?? c + between(-spread, spread);
    return Math.max(w / 2 + 0.4, Math.min(WORLD_W - w / 2 - 0.4, Math.max(c - lim, Math.min(c + lim, x))));
  };
  const jumpTo = (kind: Kind, skin: Skin, w: number, extra: Partial<Plat> = {}, dy = gapY(), want?: number) => {
    const p = add(kind, skin, nearX(w, want), top.y + dy, w, extra);
    link(top, p, 'jump');
    top = p;
    return p;
  };
  const beamSkin = () => pick(BEAM_SKINS[zone()]);

  function climbUp(withFire: boolean) {
    const base = jumpTo('solid', zone() === 'city' ? pick(['terrace', 'beam', 'scaffold'] as Skin[]) : beamSkin(), 3.4);
    const side = rand() < 0.5 ? -1 : 1;
    const x = center(base) + side * (base.w / 2 - 0.6);
    const h = between(6, 9), topY = base.y + h;
    climbs.push({ id: id++, x, y1: base.y + 0.1, y2: topY + 0.3, skin: CLIMB_SKIN[zone()] });
    if (withFire) { // caños a los costados que cruzan la escalera con fuego: hay que esperar el momento
      for (let fy = base.y + 2.2, k = 0; fy < topY - 1.2; fy += 2.4, k++) {
        const s = k % 2 ? 1 : -1;
        fires.push({ id: id++, x: x + s * 2.4, y: fy, dir: s > 0 ? 'left' : 'right', len: 3.8, period: between(2, 2.6), on: 0.42, phase: rand() * 3 });
      }
    }
    const w = 3;
    const t = add('solid', beamSkin(), x + side * (w / 2 - 0.7), topY, w);
    link(base, t, 'climb'); top = t;
  }

  const segments: Record<Seg, () => void> = {
    beams: () => { for (let i = 0, n = 3 + Math.floor(rand() * 3); i < n; i++) jumpTo('solid', beamSkin(), width(3.6, 2.2)); },
    terrace: () => {
      const t = jumpTo('solid', 'terrace', between(5.5, 7));
      if (rand() < 0.7) { // un tanque de agua arriba de la terraza sirve de escalón
        const tank = add('solid', 'tank', t.x + (rand() < 0.5 ? 1.2 : t.w - 1.2), t.y + 1.7, 1.8);
        link(t, tank, 'jump'); top = tank;
      }
    },
    ladder: () => climbUp(false),
    fireLadder: () => climbUp(true),
    zigzag: () => {
      // Escalera en zigzag: se sube caminando (cada escalón es bajito) y en los descansos se da la vuelta.
      const rise = 0.45, run = 0.72;
      let d: 1 | -1 = center(top) < WORLD_W / 2 ? 1 : -1;
      let from = top;
      for (let flight = 0, flights = 2 + Math.floor(rand() * 2); flight < flights; flight++) {
        const edge = d > 0 ? from.x + from.w : from.x;
        const room = d > 0 ? WORLD_W - 0.5 - edge : edge - 0.5;
        const n = Math.max(3, Math.min(7, Math.floor((room - 1.8) / run)));
        let y = from.y;
        for (let i = 0; i < n; i++) {
          y += rise;
          const left = d > 0 ? edge + i * run - 0.05 : edge - (i + 1) * run + 0.05;
          const step = add('solid', 'step', left + 0.425, y, 0.85);
          link(from, step, 'walk'); from = step;
        }
        const landX = d > 0 ? edge + n * run + 0.85 : edge - n * run - 0.85;
        const landing = add('solid', 'step', landX, y + rise, 1.8);
        link(from, landing, 'walk'); from = landing;
        d = d > 0 ? -1 : 1;
      }
      top = from;
    },
    balconies: () => {
      // Dos edificios enfrentados: se trepa saltando de balcón en balcón, de un lado al otro.
      const beam = jumpTo('solid', 'beam', 3, {}, gapY(), WORLD_W / 2);
      let side: -1 | 1 = center(beam) <= 10.5 ? -1 : 1;
      const n = 4 + Math.floor(rand() * 3), y0 = beam.y;
      for (let i = 0; i < n; i++) {
        const b = add('solid', 'balcony', side < 0 ? 3.6 + 1.5 : 12.4 - 1.5, top.y + between(1.8, 2.1), 3);
        link(top, b, 'jump'); top = b; side = side < 0 ? 1 : -1;
      }
      const hue = Math.floor(rand() * 360);
      const y2 = Math.min(top.y + 3.5, ZONES.sky - 1);
      facades.push({ id: id++, side: -1, y1: y0 - 3, y2, w: 3.6, hue }, { id: id++, side: 1, y1: y0 - 3, y2, w: 3.6, hue: (hue + 40) % 360 });
    },
    firePipe: () => {
      // Plataforma ancha con un caño en el medio que tira fuego para arriba: hay que cruzarlo cuando se apaga.
      const prev = top;
      const p = jumpTo('solid', zone() === 'space' ? 'station' : zone() === 'city' ? pick(['terrace', 'beam'] as Skin[]) : pick(['scaffold', 'cloudBricks'] as Skin[]), 6.2);
      fires.push({ id: id++, x: center(p), y: p.y, dir: 'up', len: 3.4, period: between(2.2, 2.8), on: 0.42, phase: rand() * 3 });
      const sideNext = center(p) >= center(prev) ? 1 : -1;
      const next = add('solid', beamSkin(), sideNext > 0 ? p.x + p.w - 0.6 : p.x + 0.6, p.y + gapY(), width(3, 2.2));
      link(p, next, 'jump'); top = next;
    },
    tiles: () => {
      for (let i = 0, n = 2 + Math.floor(rand() * 2); i < n; i++) {
        jumpTo('moving', TILE_SKIN[zone()], width(2.8, 2.2), { amp: between(2, 3.5), speed: between(0.8, 1.3) + diff() * 0.6, phase: rand() * 6.28 });
      }
    },
    elevator: () => {
      const amp = between(1.8, 2.6), low = top.y + between(0.9, 1.4);
      const e = add('elevator', LIFT_SKIN[zone()], nearX(2.6), low + amp, 2.6, { amp, speed: between(0.7, 1.1), phase: rand() * 6.28 });
      link(top, e, 'jump', top.y, low);
      const high = low + 2 * amp;
      const next = add('solid', beamSkin(), center(e) + (rand() < 0.5 ? -1 : 1) * between(2.4, 3.2), high + gapY() * 0.8, width(3, 2.2));
      link(e, next, 'jump', high, next.y); top = next;
    },
    tramp: () => {
      const t = jumpTo('tramp', zone() === 'space' || zone() === 'tech' ? 'rocket' : 'spring', 2);
      const next = add('solid', beamSkin(), nearX(3.4, undefined, 2.5), t.y + (zone() === 'space' ? between(9, 11) : between(6, 7)), 3.4);
      link(t, next, 'tramp'); top = next;
    },
    crumble: () => { for (let i = 0, n = 2 + Math.floor(rand() * 2); i < n; i++) jumpTo('crumble', CRUMBLE_SKIN[zone()], width(3, 2.4)); },
    conveyor: () => {
      const c = jumpTo('conveyor', 'conveyor', 5.5, { belt: rand() < 0.5 ? -3 : 3 });
      const next = add('solid', beamSkin(), c.belt > 0 ? c.x + 0.8 : c.x + c.w - 0.8, c.y + gapY(), 2.6); // hay que caminar contra la cinta
      link(c, next, 'jump'); top = next;
    },
    wreck: () => {
      const a = top, b = jumpTo('solid', 'beam', width(3.4, 2.6));
      balls.push({ id: id++, px: (center(a) + center(b)) / 2, py: b.y + 4.6, len: 4.2, amp: 0.85, speed: between(1.4, 1.9), phase: rand() * 6.28 });
      jumpTo('solid', beamSkin(), width(3.2, 2.4));
    },
    crane: () => { jumpTo('moving', MOVER_SKIN[zone()], 3, { amp: between(2.5, 4), speed: between(0.5, 0.8), phase: rand() * 6.28 }); jumpTo('solid', beamSkin(), 3); },
    zeppelin: () => { jumpTo('moving', MOVER_SKIN[zone()], 4.4, { amp: between(2, 3.5), speed: between(0.4, 0.7), phase: rand() * 6.28 }); jumpTo('solid', beamSkin(), 3); },
    birds: () => {
      // Pájaros (o meteoritos en el espacio) que cruzan entre las plataformas y te empujan.
      for (let i = 0; i < 3; i++) {
        const p = jumpTo('solid', beamSkin(), width(3.4, 2.4));
        if (i < 2) birds.push({ id: id++, y: p.y + between(1, 1.6), x0: 0.8, x1: WORLD_W - 0.8, speed: between(2.5, 4), phase: rand() * 2, skin: zone() === 'tech' ? 'drone' : zone() === 'space' ? (rand() < 0.5 ? 'meteor' : 'drone') : rand() < 0.3 ? 'plane' : 'bird' });
      }
    },
    // ---- Zona tecnológica ----
    lasers: () => {
      // Rayos láser que cruzan toda la pantalla entre plataforma y plataforma: se prenden y se apagan.
      for (let i = 0, n = 3 + Math.floor(rand() * 2); i < n; i++) {
        const prev = top, p = jumpTo('solid', beamSkin(), width(3.4, 2.4), {}, Math.max(1.75, gapY()));
        lasers.push({ id: id++, y: prev.y + Math.min(1.3, p.y - prev.y - 0.4), x1: 0.15, x2: WORLD_W - 0.15, period: between(2.2, 2.9), on: 0.4, phase: rand() * 3, style: 'laser' });
      }
    },
    zaps: () => {
      // Rayos eléctricos entre dos postes, arriba de una plataforma ancha: se pasa cuando se cortan.
      for (let i = 0; i < 2; i++) {
        const prev = top, p = jumpTo('solid', 'neon', 6.2);
        lasers.push({ id: id++, y: p.y + 0.45, x1: center(p) - 0.8, x2: center(p) + 0.8, period: between(2, 2.6), on: 0.45, phase: rand() * 3, style: 'zap' });
        const far = center(p) >= center(prev) ? 1 : -1; // la próxima queda del otro lado de los postes
        const next = add('solid', beamSkin(), far > 0 ? p.x + p.w - 0.7 : p.x + 0.7, p.y + gapY(), width(3, 2.4));
        link(p, next, 'jump'); top = next;
      }
    },
    fans: () => {
      // Ventiladores a un costado que soplan y te empujan mientras saltás.
      const side: -1 | 1 = rand() < 0.5 ? -1 : 1, y1 = top.y + 0.3;
      for (let i = 0, n = 3 + Math.floor(rand() * 2); i < n; i++) jumpTo('solid', beamSkin(), width(3.4, 2.6));
      fans.push({ id: id++, side, y1, y2: top.y + 0.2, force: between(3, 4.2) });
    },
    magnet: () => {
      // Imán gigante: te parás debajo y te levanta hasta la plataforma de arriba.
      const base = jumpTo('solid', beamSkin(), 3.2);
      const x = center(base) + (rand() < 0.5 ? -1 : 1) * 0.6, h = between(7, 10);
      magnets.push({ id: id++, x, y1: base.y + 0.05, y2: base.y + h + 0.6 });
      const t = add('solid', beamSkin(), x + (rand() < 0.5 ? -1 : 1) * 0.7, base.y + h, 3);
      link(base, t, 'magnet'); top = t;
    },
    gears: () => {
      // Engranajes gigantes que giran al costado del camino: si te tocan, te empujan.
      for (let i = 0; i < 3; i++) {
        const prev = top, p = jumpTo('solid', beamSkin(), width(3.2, 2.4));
        const mx = (center(prev) + center(p)) / 2, gx = mx + (mx < WORLD_W / 2 ? 2.6 : -2.6);
        gears.push({ id: id++, x: Math.max(1.4, Math.min(WORLD_W - 1.4, gx)), y: (prev.y + p.y) / 2 + 0.8, r: between(1.1, 1.5), speed: (rand() < 0.5 ? -1 : 1) * between(1.5, 2.5) });
      }
    },
    portal: () => {
      // Teletransportador: entrás en el portal de abajo y salís por el de arriba.
      const a = jumpTo('solid', 'neon', 3.4);
      const ex = between(2.5, WORLD_W - 2.5), ey = a.y + between(8, 11);
      const b = add('solid', 'neon', ex, ey, 3.4);
      portals.push({ id: id++, x1: center(a), y1: a.y, x2: center(b), y2: b.y, hue: Math.floor(rand() * 360) });
      link(a, b, 'portal'); top = b;
    },
    blink: () => {
      // Plataformas que desaparecen y vuelven: hay que saltar en el momento justo.
      const period = between(2.4, 3);
      for (let i = 0, n = 3 + Math.floor(rand() * 2); i < n; i++) jumpTo('blink', 'hologram', width(3, 2.4), { speed: period, phase: (i * period * 0.35) % period });
    },
  };

  // Cada etapa reparte sus estructuras como un mazo mezclado: así aparecen todas y no se repiten seguidas.
  const decks: Partial<Record<Zone, Seg[]>> = {};
  let last: Seg | null = null;
  while (top.y < ZONES.moon - 6) {
    const z = zone();
    if (!decks[z]?.length) {
      const deck = SEGMENTS[z].flatMap(([k, wgt]) => wgt >= 1.5 ? [k, k] : [k]);
      for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
      // Las estructuras típicas de cada etapa salen primero (se reparten desde el final del mazo).
      for (const k of SIGNATURE[z]) { const i = deck.lastIndexOf(k); if (i >= 0) deck.push(...deck.splice(i, 1)); }
      if (deck[deck.length - 1] === last) deck.unshift(deck.pop()!);
      decks[z] = deck;
    }
    let seg = decks[z]!.pop()!;
    // Los edificios (balcones y terrazas) terminan antes de los 1.000 m.
    if ((seg === 'balconies' || seg === 'terrace') && top.y > ZONES.sky - 16) seg = 'beams';
    // Lo tecnológico arranca recién en la mitad del recorrido (1.500 m).
    if (TECH_SEGS.includes(seg) && top.y < ZONES.tech) seg = 'beams';
    segments[seg]();
    last = seg;
  }
  const moon = add('moon', 'moon', nearX(4, WORLD_W / 2), top.y + gapY(), 4);
  link(top, moon, 'jump');
  return course;
}

export function newTrepa(seed?: number): Trepa {
  const course = buildCourse(seed);
  return {
    ...course, time: 0, best: 0, bestGround: 0, won: false, dying: null, over: false, zone: 'city', events: [],
    player: { x: WORLD_W / 2, y: 0, vx: 0, vy: 0, facing: 1, ground: course.plats[0], climb: null, climbCooldown: 0, coyote: 0, stun: 0, spin: 0, portalCooldown: 0 },
  };
}

export const moonOf = (g: Course) => g.plats[g.plats.length - 1];
const overlapsX = (p: Player, plat: Plat) => p.x + PLAYER_W / 2 > plat.x && p.x - PLAYER_W / 2 < plat.x + plat.w;
const hitsBox = (p: Player, x1: number, x2: number, y1: number, y2: number) => p.x + PLAYER_W / 2 > x1 && p.x - PLAYER_W / 2 < x2 && p.y + PLAYER_H > y1 && p.y < y2;
const hitsCircle = (p: Player, cx: number, cy: number, r: number) => {
  const nx = Math.max(p.x - PLAYER_W / 2, Math.min(p.x + PLAYER_W / 2, cx)), ny = Math.max(p.y, Math.min(p.y + PLAYER_H, cy));
  return Math.hypot(nx - cx, ny - cy) < r;
};

function lose(g: Trepa, reason: LoseReason) {
  const p = g.player;
  g.dying = { t: 0, reason };
  p.ground = null; p.climb = null;
  p.vy = reason === 'fall' ? Math.min(p.vy, 0) : 9; p.vx = -p.facing * 1.5;
  g.events.push({ type: 'lose', reason });
}

export function step(g: Trepa, input: Input, dt: number) {
  if (dt <= 0 || g.won || g.over) return;
  dt = Math.min(dt, 0.05);
  const p = g.player;

  // Perdiste: cae por toda la estructura (sin poder agarrarse) hasta la calle.
  if (g.dying) {
    g.dying.t += dt;
    p.vy = Math.max(-70, p.vy - 50 * dt);
    p.y += p.vy * dt; p.x = Math.max(0.3, Math.min(WORLD_W - 0.3, p.x + p.vx * dt));
    p.spin += dt * 9;
    if (p.y <= 0) { p.y = 0; g.over = true; g.events.push({ type: 'gameover' }); }
    return;
  }

  g.time += dt;
  const t = g.time;

  for (const pl of g.plats) {
    if (pl.kind === 'moving') { const x = pl.baseX + Math.sin(t * pl.speed + pl.phase) * pl.amp; const nx = Math.max(0.3, Math.min(WORLD_W - pl.w - 0.3, x)); pl.dx = nx - pl.x; pl.x = nx; }
    if (pl.kind === 'elevator') { const y = pl.baseY + Math.sin(t * pl.speed + pl.phase) * pl.amp; pl.dy = y - pl.y; pl.y = y; }
    if (pl.kind === 'blink') { pl.gone = blinkOn(pl, t) ? 0 : 1; if (pl.gone && p.ground === pl) p.ground = null; continue; }
    if (pl.gone > 0) { pl.gone -= dt; if (pl.gone <= 0) { pl.gone = 0; pl.crumble = 0; } }
    else if (pl.crumble > 0) { pl.crumble += dt; if (pl.crumble > 0.6) { pl.gone = 3.2; if (p.ground === pl) p.ground = null; } }
  }

  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir && p.stun <= 0) p.facing = dir > 0 ? 1 : -1;
  p.climbCooldown = Math.max(0, p.climbCooldown - dt);
  p.stun = Math.max(0, p.stun - dt);
  p.portalCooldown = Math.max(0, p.portalCooldown - dt);

  if (p.climb) {
    const c = p.climb;
    if (dir) { p.vx = dir * 5; p.vy = 8; p.climb = null; p.climbCooldown = 0.4; g.events.push({ type: 'jump' }); }
    else {
      p.y += (input.jump ? CLIMB : input.down ? -CLIMB : 0) * dt;
      if (p.y >= c.y2 && input.jump) { p.y = c.y2; p.vy = 10; p.vx = 0; p.climb = null; p.climbCooldown = 0.5; }
      else if (p.y <= c.y1 - 0.1 && input.down) { p.climb = null; p.climbCooldown = 0.5; }
      else { p.y = Math.max(c.y1 - 0.1, Math.min(c.y2, p.y)); hazards(g, t); finish(g); return; }
    }
  }

  // Caminar (o volar empujado). Lo que se mueve te lleva; la cinta te arrastra.
  if (p.stun > 0) p.vx *= Math.pow(0.2, dt); else p.vx = dir * RUN;
  if (p.ground) {
    if (p.ground.kind === 'moving') p.x += p.ground.dx;
    if (p.ground.kind === 'conveyor') p.x += p.ground.belt * dt;
  }
  p.x = Math.max(PLAYER_W / 2, Math.min(WORLD_W - PLAYER_W / 2, p.x + p.vx * dt));
  if (p.ground) p.y = p.ground.y;

  // Escalones bajitos: se suben caminando.
  if (p.ground && dir) {
    const stepUp = g.plats.find(pl => !pl.gone && pl !== p.ground && pl.y > p.y + 0.01 && pl.y <= p.y + 0.6 && overlapsX(p, pl));
    if (stepUp) landOn(g, stepUp);
  }

  if (p.ground && (!overlapsX(p, p.ground) || p.ground.gone > 0)) { p.ground = null; p.coyote = 0.1; p.vy = 0; }
  p.coyote = Math.max(0, p.coyote - dt);
  if (input.jump && (p.ground || p.coyote > 0) && p.stun <= 0) {
    p.vy = JUMP; p.ground = null; p.coyote = 0;
    g.events.push({ type: 'jump' });
  }

  // Agarrarse de una escalera o soga (en el aire, manteniendo saltar).
  if (!p.ground && input.jump && !p.climbCooldown && p.stun <= 0) {
    const c = g.climbs.find(c => Math.abs(p.x - c.x) < 0.5 && p.y + PLAYER_H * 0.6 > c.y1 && p.y < c.y2);
    if (c) { p.climb = c; p.x = c.x; p.vx = 0; p.vy = 0; hazards(g, t); finish(g); return; }
  }

  // Viento de los ventiladores (empuja de costado) e imanes (levantan).
  for (const f of g.fans) if (p.y + PLAYER_H > f.y1 && p.y < f.y2) p.x = Math.max(PLAYER_W / 2, Math.min(WORLD_W - PLAYER_W / 2, p.x + fanPush(f) * dt));
  // (no agarra al que ya está parado arriba de todo ni al que viene cayendo después de salir por arriba)
  const magnet = g.magnets.find(m => Math.abs(p.x - m.x) < MAGNET_W / 2 && p.y >= m.y1 - 0.1 && p.y < m.y2 && (p.ground ? p.ground.y < m.y2 - 1 : p.vy > -1));
  if (magnet && !p.climb) { p.ground = null; p.vy = Math.min(MAGNET_LIFT, p.vy + 40 * dt); }

  if (!p.ground) {
    const prev = p.y;
    p.vy = magnet ? p.vy : Math.max(-MAX_FALL, p.vy - gravityAt(p.y) * dt);
    p.y += p.vy * dt;
    if (p.vy <= 0) {
      const land = g.plats.find(pl => !pl.gone && overlapsX(p, pl) && prev >= pl.y - pl.dy - 0.02 && p.y <= pl.y);
      if (land && !magnet) landOn(g, land);
    }
    if (p.y < 0) { p.y = 0; p.vy = 0; p.ground = g.plats[0]; }
  }
  // Teletransportadores.
  if (!p.portalCooldown) {
    const portal = g.portals.find(o => Math.abs(p.x - o.x1) < PORTAL_R && p.y < o.y1 + 0.9 && p.y + PLAYER_H > o.y1 + 0.2);
    if (portal) {
      const exit = g.plats.find(pl => Math.abs(pl.y - portal.y2) < 1e-6 && Math.abs(center(pl) - portal.x2) < 1e-6) ?? null;
      Object.assign(p, { x: portal.x2, y: portal.y2, vx: 0, vy: 0, ground: exit, portalCooldown: 1 });
      if (exit) g.bestGround = Math.max(g.bestGround, exit.y);
      g.events.push({ type: 'teleport' });
    }
  }
  hazards(g, t);
  finish(g);
}

function hazards(g: Trepa, t: number) {
  const p = g.player;
  if (g.dying) return;
  for (const f of g.fires) {
    if (!fireActive(f, t)) continue;
    const r = fireRect(f);
    if (hitsBox(p, r.x1, r.x2, r.y1, r.y2)) { lose(g, 'burn'); return; }
  }
  for (const l of g.lasers) {
    if (!laserActive(l, t)) continue;
    if (hitsBox(p, l.x1, l.x2, l.y - laserHalf(l), l.y + laserHalf(l))) { lose(g, 'zap'); return; }
  }
  if (p.stun > 0) return;
  const knock = (fromX: number) => {
    p.vx = (p.x >= fromX ? 1 : -1) * 9; p.vy = 6; p.ground = null; p.climb = null; p.stun = 0.55; p.climbCooldown = 0.6;
    g.events.push({ type: 'knock' });
  };
  for (const b of g.balls) { const c = ballPos(b, t); if (hitsCircle(p, c.x, c.y, BALL_R)) { knock(c.x); return; } }
  for (const b of g.birds) { const c = birdPos(b, t); if (hitsCircle(p, c.x, c.y, BIRD_R)) { knock(c.x); return; } }
  for (const gr of g.gears) if (hitsCircle(p, gr.x, gr.y, gr.r)) { knock(gr.x); return; }
}

function landOn(g: Trepa, pl: Plat) {
  const p = g.player;
  p.y = pl.y;
  if (pl.kind === 'tramp') { p.vy = TRAMP; p.ground = null; g.events.push({ type: 'tramp' }); return; }
  p.vy = 0; p.ground = pl; p.stun = 0;
  g.bestGround = Math.max(g.bestGround, pl.y);
  if (pl.kind === 'crumble' && !pl.crumble) { pl.crumble = 0.001; g.events.push({ type: 'crumble' }); }
  if (pl.kind === 'moon') { g.won = true; g.events.push({ type: 'win' }); }
}

function finish(g: Trepa) {
  const p = g.player;
  if (g.dying) return;
  g.best = Math.max(g.best, p.y);
  const zone = zoneOf(p.y);
  const order: Zone[] = ['city', 'sky', 'clouds', 'tech', 'space'];
  if (order.indexOf(zone) > order.indexOf(g.zone)) { g.zone = zone; g.events.push({ type: 'zone', zone }); }
  if (!p.ground && !p.climb && p.y < g.bestGround - FALL_LOSE) lose(g, 'fall');
}

export const takeEvents = (g: Trepa) => g.events.splice(0);
