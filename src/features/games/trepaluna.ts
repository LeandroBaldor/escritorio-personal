// Lógica de "Trepaluna": un personaje trepa estructuras locas hasta la Luna. Todo se mide en metros
// y la altura crece hacia arriba (y = 0 es el suelo). El recorrido siempre es el mismo (se arma con
// una semilla fija) para poder mejorar el tiempo. Tres etapas: ciudad, nubes y espacio (con menos
// gravedad). Todas las plataformas se atraviesan desde abajo y se cae parado arriba.

export const WORLD_W = 16;
export const ZONES = { clouds: 90, space: 170, moon: 250 };
export type Kind = 'ground' | 'beam' | 'bridge' | 'tramp' | 'moving' | 'crumble' | 'cloud' | 'asteroid' | 'flag' | 'moon';
export interface Plat { id: number; kind: Kind; x: number; y: number; w: number; baseX: number; amp: number; speed: number; phase: number; dx: number; crumble: number; gone: number }
export interface Rope { id: number; x: number; y1: number; y2: number }
export interface Player { x: number; y: number; vx: number; vy: number; facing: 1 | -1; ground: Plat | null; rope: Rope | null; ropeCooldown: number; coyote: number }
export interface Input { left: boolean; right: boolean; jump: boolean; down: boolean }
export type TrepaEvent = { type: 'jump' } | { type: 'tramp' } | { type: 'checkpoint'; height: number } | { type: 'respawn' } | { type: 'crumble' } | { type: 'zone'; zone: Zone } | { type: 'win' };
export type Zone = 'city' | 'clouds' | 'space';
export interface Trepa { plats: Plat[]; ropes: Rope[]; player: Player; time: number; checkpoint: Plat; best: number; won: boolean; zone: Zone; prevJump: boolean; events: TrepaEvent[] }

export const PLAYER_W = 0.6, PLAYER_H = 1.05;
const RUN = 6;
export const JUMP = 12.5;
export const TRAMP = 21;
export const CLOUD_JUMP = 15;
const CLIMB = 3.6;
const FALL_LIMIT = 14; // si caés más de esto debajo de la última bandera, volvés a ella

export const zoneOf = (y: number): Zone => y < ZONES.clouds ? 'city' : y < ZONES.space ? 'clouds' : 'space';
export const gravityAt = (y: number) => y < ZONES.space ? 28 : 16; // en el espacio todo flota más

const KINDS: Record<Zone, [Kind | 'rope', number][]> = {
  city: [['beam', 4], ['bridge', 2], ['tramp', 1.2], ['rope', 1.3], ['moving', 1], ['crumble', 0.7]],
  clouds: [['cloud', 3], ['beam', 1.2], ['tramp', 1.4], ['rope', 1.2], ['moving', 1.3], ['crumble', 1]],
  space: [['asteroid', 3], ['moving', 1.4], ['tramp', 1.4], ['crumble', 1], ['rope', 0.8], ['beam', 0.8]],
};

// Arma el recorrido: cada estructura queda a una altura y distancia que se puede alcanzar desde la
// anterior (saltando, con el trampolín o trepando la soga).
export function buildCourse(seed = 20261004) {
  let s = seed;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const between = (a: number, b: number) => a + rand() * (b - a);
  const plats: Plat[] = [];
  const ropes: Rope[] = [];
  let id = 1;
  let last = 'ground' as Kind;
  const plat = (kind: Kind, cx: number, y: number, w: number, extra: Partial<Plat> = {}) => {
    last = kind;
    const x = Math.max(0.3, Math.min(WORLD_W - w - 0.3, cx - w / 2));
    const p: Plat = { id: id++, kind, x, y, w, baseX: x, amp: 0, speed: 0, phase: 0, dx: 0, crumble: 0, gone: 0, ...extra };
    plats.push(p);
    return p;
  };
  plat('ground', WORLD_W / 2, 0, WORLD_W - 0.6);
  let y = 0, cx = WORLD_W / 2;
  const flags = [ZONES.clouds, ZONES.space];
  while (y < ZONES.moon - 7) {
    // Bandera de control al empezar las nubes y el espacio.
    if (flags.length && y >= flags[0] - 2.3) {
      y = Math.max(y + 2.2, flags.shift()!);
      cx = WORLD_W / 2;
      plat('flag', cx, y, 6);
      continue;
    }
    const zone = zoneOf(y);
    const diff = y / ZONES.moon;
    const space = zone === 'space';
    const reach = space ? 3.8 : zone === 'clouds' ? 2.45 : 2.4;
    const table = KINDS[zone];
    let pick = rand() * table.reduce((a, [, wgt]) => a + wgt, 0), kind: Kind | 'rope' = table[0][0];
    for (const [k, wgt] of table) { if ((pick -= wgt) <= 0) { kind = k; break; } }
    // Cerca de una bandera no hay sogas ni trampolines, así la bandera queda en su altura.
    if ((kind === 'rope' || kind === 'tramp') && flags.length && y + 12 > flags[0]) kind = table[0][0];
    const gap = reach * between(0.72, 0.8 + 0.18 * diff);
    const nextX = (w: number, spread = 4) => Math.max(w / 2 + 0.4, Math.min(WORLD_W - w / 2 - 0.4, cx + between(-spread, spread)));
    const width = (big: number, small: number) => Math.max(small, big - (big - small) * diff);
    if (kind === 'rope') {
      // Viga con una soga que sube; arriba de la soga, otra viga.
      const w = width(3.4, 2.4);
      cx = nextX(w); y += gap;
      plat('beam', cx, y, w);
      const top = y + between(6, 8);
      ropes.push({ id: id++, x: cx, y1: y + 0.2, y2: top + 0.3 });
      y = top; cx = Math.max(1.8, Math.min(WORLD_W - 1.8, cx + (rand() < 0.5 ? -1.8 : 1.8)));
      plat('beam', cx, y, width(3.2, 2.2));
    } else if (kind === 'tramp') {
      cx = nextX(2); y += gap;
      plat('tramp', cx, y, 2);
      y += space ? between(9, 11) : between(6, 7); // el trampolín te tira mucho más alto
      const w = width(4, 2.6);
      cx = nextX(w, 2.5);
      plat(space ? 'asteroid' : zone === 'clouds' ? 'cloud' : 'beam', cx, y, w);
    } else if (kind === 'moving' || kind === 'asteroid') {
      const w = kind === 'asteroid' ? width(3, 2.2) : width(3.4, 2.4);
      cx = nextX(w, 3); y += gap;
      plat(kind, cx, y, w, { amp: between(2, 3.5), speed: between(0.7, 1.3) + diff * 0.5, phase: rand() * 6.28 });
    } else {
      const w = kind === 'bridge' ? width(8, 6) : kind === 'cloud' ? width(4.2, 3) : width(4.5, 2.2);
      const extra = kind === 'cloud' && last === 'cloud' ? 0.6 : 0; // desde una nube se salta más alto
      cx = nextX(w); y += gap + extra;
      plat(kind, cx, y, w);
    }
  }
  // La Luna: el último salto.
  plat('moon', WORLD_W / 2, y + (zoneOf(y) === 'space' ? 3.4 : 2.3), 4);
  return { plats, ropes };
}

export function newTrepa(seed?: number): Trepa {
  const { plats, ropes } = buildCourse(seed);
  return {
    plats, ropes, time: 0, checkpoint: plats[0], best: 0, won: false, zone: 'city', prevJump: false, events: [],
    player: { x: WORLD_W / 2, y: 0, vx: 0, vy: 0, facing: 1, ground: plats[0], rope: null, ropeCooldown: 0, coyote: 0 },
  };
}

export const moonOf = (g: Trepa) => g.plats[g.plats.length - 1];

function respawn(g: Trepa) {
  const c = g.checkpoint;
  Object.assign(g.player, { x: c.x + c.w / 2, y: c.y, vx: 0, vy: 0, ground: c, rope: null, ropeCooldown: 0.3 });
  g.events.push({ type: 'respawn' });
}

const overlapsX = (p: Player, plat: Plat) => p.x + PLAYER_W / 2 > plat.x && p.x - PLAYER_W / 2 < plat.x + plat.w;

export function step(g: Trepa, input: Input, dt: number) {
  if (dt <= 0 || g.won) return;
  dt = Math.min(dt, 0.05);
  g.time += dt;
  const p = g.player;
  const jumpPressed = input.jump && !g.prevJump;
  g.prevJump = input.jump;

  // Plataformas que se mueven y las que se desarman.
  for (const pl of g.plats) {
    if (pl.amp) { const x = pl.baseX + Math.sin(g.time * pl.speed + pl.phase) * pl.amp; pl.dx = Math.max(0.3, Math.min(WORLD_W - pl.w - 0.3, x)) - pl.x; pl.x += pl.dx; }
    if (pl.gone > 0) { pl.gone -= dt; if (pl.gone <= 0) { pl.gone = 0; pl.crumble = 0; } }
    else if (pl.crumble > 0) { pl.crumble += dt; if (pl.crumble > 0.7) { pl.gone = 3; if (p.ground === pl) p.ground = null; } }
  }

  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir) p.facing = dir > 0 ? 1 : -1;
  p.ropeCooldown = Math.max(0, p.ropeCooldown - dt);

  // En la soga: mantener "saltar" sube, "abajo" baja; con izquierda o derecha se suelta de un salto.
  if (p.rope) {
    const r = p.rope;
    if (dir) { p.vx = dir * 5; p.vy = 9; p.rope = null; p.ropeCooldown = 0.4; g.events.push({ type: 'jump' }); }
    else {
      p.y += (input.jump ? CLIMB : input.down ? -CLIMB : 0) * dt;
      if (p.y >= r.y2 && input.jump) { p.y = r.y2; p.vy = 10; p.vx = 0; p.rope = null; p.ropeCooldown = 0.5; }
      else if (p.y <= r.y1 - 0.1 && input.down) { p.rope = null; p.ropeCooldown = 0.5; }
      else { p.y = Math.max(r.y1 - 0.1, Math.min(r.y2, p.y)); finish(g); return; }
    }
  }

  // Caminar (sobre una plataforma que se mueve, te lleva).
  p.vx = dir * RUN;
  if (p.ground?.amp) p.x += p.ground.dx;
  p.x = Math.max(PLAYER_W / 2, Math.min(WORLD_W - PLAYER_W / 2, p.x + p.vx * dt));

  if (p.ground && (!overlapsX(p, p.ground) || p.ground.gone > 0)) { p.ground = null; p.coyote = 0.1; }
  p.coyote = Math.max(0, p.coyote - dt);
  if (jumpPressed && (p.ground || p.coyote > 0)) {
    p.vy = p.ground?.kind === 'cloud' ? CLOUD_JUMP : JUMP;
    p.ground = null; p.coyote = 0;
    g.events.push({ type: 'jump' });
  }

  // Agarrarse de una soga (en el aire, manteniendo saltar).
  if (!p.ground && input.jump && !p.ropeCooldown) {
    const r = g.ropes.find(r => Math.abs(p.x - r.x) < 0.5 && p.y + PLAYER_H * 0.6 > r.y1 && p.y < r.y2);
    if (r) { p.rope = r; p.x = r.x; p.vx = 0; p.vy = 0; finish(g); return; }
  }

  if (!p.ground) {
    const prev = p.y;
    p.vy = Math.max(-26, p.vy - gravityAt(p.y) * dt);
    p.y += p.vy * dt;
    if (p.vy <= 0) {
      const land = g.plats.find(pl => !pl.gone && overlapsX(p, pl) && prev >= pl.y - 0.02 && p.y <= pl.y);
      if (land) landOn(g, land);
    }
    if (p.y < 0) { p.y = 0; p.vy = 0; p.ground = g.plats[0]; }
  }
  finish(g);
}

function landOn(g: Trepa, pl: Plat) {
  const p = g.player;
  p.y = pl.y;
  if (pl.kind === 'tramp') { p.vy = TRAMP; p.ground = null; g.events.push({ type: 'tramp' }); return; }
  p.vy = 0; p.ground = pl;
  if (pl.kind === 'crumble' && !pl.crumble) { pl.crumble = 0.001; g.events.push({ type: 'crumble' }); }
  if ((pl.kind === 'flag') && pl.y > g.checkpoint.y) { g.checkpoint = pl; g.events.push({ type: 'checkpoint', height: Math.round(pl.y) }); }
  if (pl.kind === 'moon') { g.won = true; g.events.push({ type: 'win' }); }
}

function finish(g: Trepa) {
  const p = g.player;
  g.best = Math.max(g.best, p.y);
  const zone = zoneOf(p.y);
  if (zone !== g.zone && zone !== 'city' && (zone === 'space' || g.zone === 'city')) { g.zone = zone; g.events.push({ type: 'zone', zone }); }
  if (p.y < g.checkpoint.y - FALL_LIMIT) respawn(g);
}

export const takeEvents = (g: Trepa) => g.events.splice(0);
