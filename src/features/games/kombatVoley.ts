// Kombat Voley: vóley uno contra uno con los luchadores de Kombat Football, visto de costado. Un solo set a 15
// (gana el primero que llega a 15 con dos de diferencia, como en el vóley), punto en cada jugada, saca el que
// ganó el punto, como mucho tres toques de cada lado (uno contra uno: el mismo jugador puede tocarla las tres
// veces, como en el vóley de playa de a uno) y es punto del rival si la pelota pica en tu cancha, si la tirás
// afuera o si la tocás una cuarta vez. Cada estadio tiene su pelota, con su efecto.
// Medidas en metros: x a lo largo (la cancha va de 0 a 16, la red en 8), y para arriba.
import { CHARS, SIZE, STATS, heightOf, type CharId, type Fighter, type Person, type StageId } from './kombat';

export const COURT = 16; // largo de la cancha (dos mitades de 8)
export const NET_X = COURT / 2;
export const NET_H = 2.55; // alto de la red
export const BR = 0.38; // radio de la pelota
export const X0 = -3.5, X1 = COURT + 3.5; // hasta dónde se puede ir (afuera de las líneas)
export const SET_POINTS = 15; // un set a 15 con dos de diferencia
export const CHARGE_T = 0.8; // segundos apretando V para el golpe más largo (más corto = cae cerca de la red)
export const MAX_TOUCHES = 3;
export const P_SCALE = 0.9; // los luchadores un poco más chicos que la red
const GRAV = 13; // gravedad de la pelota (flotada, de arcade)
const PGRAV = 24; // gravedad de los jugadores

// ---------------------------------------------------------------- Las 16 pelotas (una por estadio)
export type BallKind = 'neon' | 'zigzag' | 'plasma' | 'hielo' | 'meteorito' | 'espora' | 'bomba' | 'rayo' | 'piedra' | 'lunar' | 'sakura' | 'fantasma' | 'arena' | 'burbuja' | 'pluma' | 'oro';
export interface BallDef { name: string; text: string; grav: number; speed: number; r: number; color: string; glow: string }
export const BALLS: Record<BallKind, BallDef> = {
  neon: { name: 'Pelota Neón', text: 'Deja una estela de luz', grav: 1, speed: 1, r: BR, color: '#e0f2fe', glow: '#22d3ee' },
  zigzag: { name: 'Pelota Zigzag', text: 'Cambia de dirección en el aire', grav: 1, speed: 1, r: BR, color: '#f5d0fe', glow: '#e879f9' },
  plasma: { name: 'Pelota de Plasma', text: 'Con efecto: cae de golpe', grav: 1, speed: 1.05, r: BR, color: '#bfdbfe', glow: '#60a5fa' },
  hielo: { name: 'Pelota de Hielo', text: 'Congela un ratito al que la recibe', grav: 0.95, speed: 0.92, r: BR, color: '#e0f2fe', glow: '#7dd3fc' },
  meteorito: { name: 'Meteorito', text: 'Pelota de fuego: cae pesada y rápida', grav: 1.3, speed: 1.15, r: BR * 1.05, color: '#7c2d12', glow: '#f97316' },
  espora: { name: 'Pelota Espora', text: 'Se agranda y se achica', grav: 0.95, speed: 1, r: BR, color: '#a7f3d0', glow: '#2dd4bf' },
  bomba: { name: 'Pelota Bomba', text: 'Explota cuando pica', grav: 1.1, speed: 1, r: BR * 1.05, color: '#1f2937', glow: '#f59e0b' },
  rayo: { name: 'Pelota Rayo', text: 'La más rápida, eléctrica', grav: 1.15, speed: 1.3, r: BR, color: '#fef9c3', glow: '#facc15' },
  piedra: { name: 'Pelota de Piedra', text: 'Pesada: cae más rápido', grav: 1.25, speed: 0.95, r: BR * 1.1, color: '#a8a29e', glow: '#84cc16' },
  lunar: { name: 'Pelota Lunar', text: 'Casi sin gravedad: flota', grav: 0.55, speed: 0.9, r: BR, color: '#e5e7eb', glow: '#cbd5e1' },
  sakura: { name: 'Pelota Sakura', text: 'Vuela ondulando entre pétalos', grav: 0.85, speed: 0.95, r: BR, color: '#fbcfe8', glow: '#f472b6' },
  fantasma: { name: 'Pelota Fantasma', text: 'Desaparece y aparece', grav: 1, speed: 1, r: BR, color: '#e9d5ff', glow: '#a78bfa' },
  arena: { name: 'Pelota de Arena', text: 'El viento del desierto la empuja', grav: 1, speed: 1, r: BR, color: '#fde68a', glow: '#f59e0b' },
  burbuja: { name: 'Pelota Burbuja', text: 'Lenta y flotada, como bajo el agua', grav: 0.7, speed: 0.85, r: BR * 1.15, color: '#cffafe', glow: '#22d3ee' },
  pluma: { name: 'Pelota Pluma', text: 'Liviana: el viento la lleva', grav: 0.65, speed: 0.92, r: BR, color: '#fefce8', glow: '#fde68a' },
  oro: { name: 'Pelota de Oro', text: 'Chiquita y veloz', grav: 1.05, speed: 1.18, r: BR * 0.72, color: '#fcd34d', glow: '#fbbf24' },
};
export const STAGE_BALL: Record<StageId, BallKind> = {
  industrial: 'neon', mines: 'zigzag', base: 'plasma', ice: 'hielo', volcano: 'meteorito', forest: 'espora', factory: 'bomba', storm: 'rayo',
  temple: 'piedra', moon: 'lunar', subway: 'sakura', pit: 'fantasma', desert: 'arena', ocean: 'burbuja', sky: 'pluma', coliseum: 'oro',
};

// ---------------------------------------------------------------- Tipos
export interface VInput { left: boolean; right: boolean; up: boolean; down: boolean; hit: boolean; set: boolean }
export const noVInput = (): VInput => ({ left: false, right: false, up: false, down: false, hit: false, set: false });
export interface VPlayer extends Fighter { team: 0 | 1; hitBuf: number; setBuf: number; touchCd: number; slow: number; level: number | null; aiT: number; plan: 'none' | 'set' | 'spike'; tx: number; react: number; prevIn: VInput; points: number;
  hold: number; pow: number; // cuánto lleva apretando V (−1 = suelto) y la fuerza del golpe (0 = corto, junto a la red; 1 = al fondo)
  base: number; // (la máquina) dónde espera cuando la pelota está del otro lado
}
export interface VBall { x: number; y: number; vx: number; vy: number; r: number; roll: number; held: boolean; t: number; zig: number }
export interface VParticle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string }
export type VPhase = 'intro' | 'serve' | 'rally' | 'point' | 'end';
export type VEvent =
  | { type: 'serve'; side: 0 | 1 } | { type: 'touch'; side: 0 | 1; kind: 'bump' | 'set' | 'attack' | 'spike'; n: number } | { type: 'net' } | { type: 'land'; inside: boolean }
  | { type: 'point'; side: 0 | 1; why: 'floor' | 'out' | 'touches' | 'net' | 'serve' } | { type: 'boom' } | { type: 'whistle' } | { type: 'setPoint'; side: 0 | 1 } | { type: 'end'; winner: 0 | 1 };
export interface VMatch {
  stage: StageId; kind: BallKind; players: [VPlayer, VPlayer]; ball: VBall; ref: Person;
  phase: VPhase; phaseT: number; time: number; score: [number, number]; server: 0 | 1; lastTeam: 0 | 1 | null; touches: number; lastPoint: 0 | 1 | null; why: string;
  winner: 0 | 1 | null; events: VEvent[]; rand: () => number; particles: VParticle[]; trail: [number, number][]; shake: number; wind: number; serveT: number; servedOver: boolean;
  // de qué lado de la red está la pelota: los tres toques son solo mientras está de tu lado (al pasar, se cuentan de nuevo)
  ballSide: 0 | 1;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const emit = (m: VMatch, e: VEvent) => { m.events.push(e); };
export function takeVoleyEvents(m: VMatch) { const e = m.events; m.events = []; return e; }
export const dirOf = (team: 0 | 1) => (team === 0 ? 1 : -1); // hacia dónde está la cancha rival
export const hOf = (p: VPlayer) => heightOf(p) * P_SCALE;
const rOf = (p: VPlayer) => 0.42 * Math.min(1.3, SIZE[p.char]) * P_SCALE;
const speedOf = (c: CharId) => 4.6 + STATS[c].speed / 100 * 3.2;
const jumpOf = (c: CharId) => 8 + STATS[c].jump / 100 * 2.6;
export const isHuman = (p: VPlayer) => p.level === null;

function newPlayer(team: 0 | 1, char: CharId, level: number | null): VPlayer {
  return {
    side: team, char, x: team === 0 ? 4 : 12, y: 0, vx: 0, vy: 0, facing: team === 0 ? 1 : -1, ground: true, action: 'idle', actionT: 0,
    kickT: 0, kickKind: 'normal', kickHit: false, slideT: 0, charge: 0, kickPow: 1, jumps: 0, headT: 0, stun: 0, stunKind: 'none', poison: 0, inv: 0, stamina: 100, power: 0, cd: 0,
    abilityT: 0, abilityHit: false, burst: 0, burstT: 0, powers: {}, prev: { left: false, right: false, up: false, down: false, kick: false, ability: false }, taps: [], goals: 0, restT: 0,
    team, hitBuf: 0, setBuf: 0, touchCd: 0, slow: 0, level, aiT: 0, plan: 'none', tx: team === 0 ? 4 : 12, react: 0, prevIn: noVInput(), points: 0, hold: -1, pow: 0.5, base: 4.2,
  };
}
export function newVoley(stage: StageId, chars: [CharId, CharId], levels: [number | null, number | null], rand: () => number = Math.random): VMatch {
  const kind = STAGE_BALL[stage];
  const m: VMatch = {
    stage, kind, players: [newPlayer(0, chars[0], levels[0]), newPlayer(1, chars[1], levels[1])],
    ball: { x: 0, y: 0, vx: 0, vy: 0, r: BALLS[kind].r, roll: 0, held: true, t: 0, zig: 0 },
    ref: { x: NET_X, y: 0, vx: 0, vy: 0, facing: 1, ground: true, action: 'idle', actionT: 0, stun: 0, stunKind: 'none', away: 0 },
    phase: 'intro', phaseT: 0, time: 0, score: [0, 0], server: rand() < 0.5 ? 0 : 1, lastTeam: null, touches: 0, lastPoint: null, why: '',
    winner: null, events: [], rand, particles: [], trail: [], shake: 0, wind: 0, serveT: 0, servedOver: false, ballSide: 0,
  };
  setupServe(m);
  return m;
}
// Cada uno a su lugar: el que saca detrás de su línea de fondo, con la pelota en la mano.
function setupServe(m: VMatch) {
  const s = m.players[m.server], o = m.players[1 - m.server];
  s.x = m.server === 0 ? -1.4 : COURT + 1.4; o.x = m.server === 0 ? 12 : 4;
  for (const p of m.players) { p.y = 0; p.vx = 0; p.vy = 0; p.ground = true; p.facing = dirOf(p.team); p.plan = 'none'; p.tx = p.x; p.slow = 0; p.hitBuf = 0; p.setBuf = 0; p.hold = -1; p.pow = 0.5; }
  m.lastTeam = null; m.touches = 0; m.trail = []; m.serveT = 0; m.servedOver = false; m.ballSide = m.server;
  s.aiT = 0.9 + m.rand() * 1.1; // (la máquina se toma su tiempo para sacar, no siempre el mismo)
  const b = m.ball; b.held = true; b.vx = 0; b.vy = 0; b.t = 0; b.r = BALLS[m.kind].r;
  m.wind = m.kind === 'arena' ? (m.rand() < 0.5 ? -1 : 1) * (1 + m.rand()) : 0;
  holdBall(m);
}
function holdBall(m: VMatch) { const s = m.players[m.server], b = m.ball; b.x = s.x + dirOf(s.team) * 0.45; b.y = s.y + hOf(s) * 0.95; }

// ---------------------------------------------------------------- El paso
export function stepVoley(m: VMatch, inputs: [VInput, VInput], dt: number) {
  m.time += dt; m.phaseT += dt; m.shake = Math.max(0, m.shake - dt * 3);
  for (const pt of m.particles) { pt.life += dt; pt.vy -= 6 * dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; }
  m.particles = m.particles.filter(pt => pt.life < pt.max);
  switch (m.phase) {
    case 'intro':
      for (const p of m.players) idle(p, dt);
      holdBall(m);
      if (m.phaseT > 2.4) { m.phase = 'serve'; m.phaseT = 0; emit(m, { type: 'whistle' }); }
      break;
    case 'serve': {
      const s = m.players[m.server];
      for (const p of m.players) { const ai = !isHuman(p); if (p === s) { idle(p, dt); } else if (ai) aiMove(m, p, dt); else control(m, p, inputs[p.team], dt); }
      holdBall(m);
      const i = inputs[s.team];
      if (isHuman(s)) { // mantené V para cargar el saque (más tiempo = más al fondo) y soltá para sacar
        if (i.hit) { if (s.hold < 0) s.hold = 0; s.hold += dt; s.pow = Math.min(1, s.hold / CHARGE_T); }
        if ((!i.hit && s.prevIn.hit && s.hold >= 0) || (i.set && !s.prevIn.set) || (i.up && !s.prevIn.up) || m.phaseT > 8) { if (s.hold < 0) s.pow = 0.5; serve(m, s); s.hold = -1; }
      } else if (m.phaseT > s.aiT) serve(m, s);
      s.prevIn = { ...i };
      break;
    }
    case 'rally':
      for (const p of m.players) { if (isHuman(p)) control(m, p, inputs[p.team], dt); else aiMove(m, p, dt); }
      for (let k = 0; k < 3; k++) moveBall(m, dt / 3);
      break;
    case 'point':
      for (const p of m.players) { idle(p, dt); p.action = m.lastPoint === p.team ? 'celebrate' : 'sad'; }
      if (!m.ball.held) for (let k = 0; k < 2; k++) moveBall(m, dt / 2, true);
      if (m.phaseT > 2) {
        if (m.winner !== null) { m.phase = 'end'; m.phaseT = 0; emit(m, { type: 'end', winner: m.winner }); }
        else { m.phase = 'serve'; m.phaseT = 0; setupServe(m); emit(m, { type: 'whistle' }); }
      }
      break;
    case 'end':
      for (const p of m.players) { idle(p, dt); p.action = p.team === m.winner ? 'celebrate' : 'sad'; }
      break;
  }
  // el árbitro en su silla, mirando la pelota
  m.ref.facing = m.ball.x > NET_X ? 1 : -1; m.ref.actionT += dt;
}
function idle(p: VPlayer, dt: number) {
  p.vx *= Math.max(0, 1 - dt * 10); p.x += p.vx * dt; gravityP(p, dt);
  if (p.ground && p.action !== 'celebrate' && p.action !== 'sad') setAction(p, 'idle', dt);
}
function setAction(p: VPlayer, a: VPlayer['action'], dt: number) { if (p.action !== a) { p.action = a; p.actionT = 0; } else p.actionT += dt; }
function gravityP(p: VPlayer, dt: number) {
  if (!p.ground || p.vy > 0) { p.vy -= PGRAV * dt; p.y += p.vy * dt; if (p.y <= 0) { p.y = 0; p.vy = 0; p.ground = true; } else p.ground = false; }
}
function bounds(p: VPlayer) {
  const r = rOf(p);
  if (p.team === 0) p.x = clamp(p.x, X0, NET_X - r - 0.1); else p.x = clamp(p.x, NET_X + r + 0.1, X1);
}

// ---------------------------------------------------------------- La persona
const edge = (p: VPlayer, i: VInput, k: keyof VInput) => i[k] && !p.prevIn[k];
function control(m: VMatch, p: VPlayer, i: VInput, dt: number) {
  const dx = (i.right ? 1 : 0) - (i.left ? 1 : 0);
  movePlayer(p, dx, dt);
  if (edge(p, i, 'up') && p.ground) jump(p);
  // V: mientras la mantenés apretada se carga el golpe (corto → cae cerca de la red; largo → al fondo); pega cuando llega la pelota
  if (i.hit) { if (p.hold < 0) p.hold = 0; p.hold += dt; p.pow = Math.min(1, p.hold / CHARGE_T); p.hitBuf = 0.28; }
  else { p.hold = -1; p.hitBuf = Math.max(0, p.hitBuf - dt); }
  if (i.set) p.setBuf = 0.28; else p.setBuf = Math.max(0, p.setBuf - dt);
  p.prevIn = { ...i };
  void m;
}
function movePlayer(p: VPlayer, dx: number, dt: number) {
  const v = speedOf(p.char) * (p.slow > 0 ? 0.45 : 1) * (p.ground ? 1 : 0.85);
  p.vx += (dx * v - p.vx) * Math.min(1, dt * (p.ground ? 16 : 6));
  p.x += p.vx * dt; bounds(p); gravityP(p, dt);
  p.slow = Math.max(0, p.slow - dt); p.touchCd = Math.max(0, p.touchCd - dt); p.kickT = Math.max(0, p.kickT - dt);
  if (Math.abs(p.vx) > 0.4) p.facing = p.vx > 0 ? 1 : -1; else p.facing = dirOf(p.team);
  setAction(p, p.kickT > 0 ? (p.ground ? 'kick' : 'header') : !p.ground ? 'jump' : Math.abs(p.vx) > 0.6 ? 'run' : 'idle', dt);
}
function jump(p: VPlayer) { p.vy = jumpOf(p.char) * (p.slow > 0 ? 0.7 : 1); p.ground = false; }

// ---------------------------------------------------------------- El saque
function serve(m: VMatch, s: VPlayer) {
  const b = m.ball, d = dirOf(s.team), sp = BALLS[m.kind].speed, lv = s.level ?? 0.7;
  b.held = false; b.x = s.x + d * 0.5; b.y = hOf(s) + 0.4;
  // la persona elige qué tan largo con el tiempo que mantuvo V; la máquina varía: cortito, al fondo, flotado o fuerte
  // (y cada tanto lo tira afuera)
  let depth: number, T0: number;
  if (isHuman(s)) { depth = 1.8 + s.pow * 5.6; T0 = 1.05; }
  else {
    const r = m.rand();
    if (r < 0.25) { depth = 1.6 + m.rand() * 1.6; T0 = 1.25; } // cortito, cae junto a la red
    else if (r < 0.6) { depth = 5.8 + m.rand() * 1.8; T0 = 1.0; } // al fondo
    else if (r < 0.8) { depth = 3 + m.rand() * 4; T0 = 1.6; } // flotado, alto
    else { depth = 4.5 + m.rand() * 3; T0 = 0.75; } // fuerte y bajo
    depth += (m.rand() - 0.5) * (2.6 - lv * 2); // (el error)
  }
  const shot = aimAt(m, NET_X + d * depth, T0 / sp, 0.3); b.vx = shot.vx; b.vy = shot.vy;
  m.lastTeam = s.team; m.touches = 0; m.servedOver = false;
  s.kickT = 0.3; s.touchCd = 0.4;
  m.phase = 'rally'; m.phaseT = 0;
  emit(m, { type: 'serve', side: s.team });
}

// Calcula el tiro para que la pelota caiga en tx: prueba desde el tiempo de vuelo T0 (más chico = más fuerte y
// bajo) y lo alarga hasta que pase por arriba de la red con margen.
function aimAt(m: VMatch, tx: number, T0: number, margin = 0.35, vmax = 14) {
  const b = m.ball, g = GRAV * BALLS[m.kind].grav * (m.kind === 'plasma' ? 1.2 : 1);
  let vx = 0, vy = 0;
  for (let T = Math.max(0.2, T0, Math.abs(tx - b.x) / (vmax * BALLS[m.kind].speed)); T < 3.2; T += 0.025) {
    vx = (tx - b.x) / T; vy = (b.r - b.y + 0.5 * g * T * T) / T;
    const tn = (NET_X - b.x) / vx;
    if (!(tn > 0 && tn < T)) break;
    if (b.y + vy * tn - 0.5 * g * tn * tn >= NET_H + b.r + margin) break;
  }
  return { vx, vy };
}

// ---------------------------------------------------------------- La pelota
function moveBall(m: VMatch, dt: number, dead = false) {
  const b = m.ball, def = BALLS[m.kind];
  b.t += dt;
  let g = GRAV * def.grav;
  if (m.kind === 'plasma' && b.vy < 0) g *= 1.45; // el efecto: cuando baja, cae de golpe
  b.vy -= g * dt;
  if (m.kind === 'burbuja') { b.vx *= 1 - dt * 0.35; }
  if (m.kind === 'arena' || m.kind === 'pluma') b.vx += (m.kind === 'pluma' ? Math.sin(m.time * 1.3) * 1.6 : m.wind) * dt;
  if (m.kind === 'sakura') b.vx += Math.sin(b.t * 6) * 3 * dt;
  if (m.kind === 'zigzag' && !dead) { b.zig -= dt; if (b.zig <= 0) { b.zig = 0.32; b.vx += (m.rand() - 0.5) * 3.2; } }
  if (m.kind === 'espora') b.r = BR * (1 + 0.38 * Math.sin(b.t * 4));
  b.x += b.vx * dt; b.y += b.vy * dt; b.roll += b.vx * dt / Math.max(0.2, b.r);
  if (Math.hypot(b.vx, b.vy) > 7 && !dead) { m.trail.unshift([b.x, b.y]); if (m.trail.length > 14) m.trail.pop(); } else if (m.trail.length) m.trail.pop();
  if ((m.kind === 'meteorito' || m.kind === 'rayo' || m.kind === 'bomba') && m.rand() < 0.6) spark(m, b.x, b.y, m.kind === 'rayo' ? '#fde047' : m.kind === 'bomba' ? '#fbbf24' : '#fb923c', 1);
  net(m);
  if (b.x < X0 - 1 && b.vx < 0) { b.x = X0 - 1; b.vx = -b.vx * 0.4; }
  if (b.x > X1 + 1 && b.vx > 0) { b.x = X1 + 1; b.vx = -b.vx * 0.4; }
  if (dead) { if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * 0.35; b.vx *= 0.7; } return; }
  if (!m.servedOver && (m.lastTeam === 0 ? b.x > NET_X : b.x < NET_X)) m.servedOver = true;
  crossNet(m);
  touches(m);
  if (b.y <= b.r) land(m);
}
// Cuando la pelota pasa del todo al otro lado de la red, ese lado empieza a contar sus tres toques desde cero.
function crossNet(m: VMatch) {
  const b = m.ball, side: 0 | 1 | null = b.x < NET_X - b.r ? 0 : b.x > NET_X + b.r ? 1 : null;
  if (side === null || side === m.ballSide) return;
  m.ballSide = side; m.touches = 0;
}
// Cuántos toques lleva el equipo de ese lado (0 si la pelota no está de su lado).
export const touchesOf = (m: VMatch, team: 0 | 1) => (m.ballSide === team && m.lastTeam === team ? m.touches : 0);
// La red: rebota en la faja de arriba o en la malla.
function net(m: VMatch) {
  const b = m.ball, r = b.r;
  if (Math.abs(b.x - NET_X) < r + 0.05 && b.y < NET_H + r * 0.3) {
    if (b.y > NET_H - r * 0.5 && b.vy < 0) { b.vy = Math.abs(b.vy) * 0.45 + 1.4; b.vx *= 0.55; } // pegó en la faja: sigue, flojita
    else { const side = b.vx > 0 ? -1 : 1; b.x = NET_X + side * (r + 0.06); b.vx = side * Math.abs(b.vx) * 0.3; b.vy *= 0.6; }
    emit(m, { type: 'net' });
  }
}
// Quién la toca: el que llega (con la mano o el cuerpo). V = golpe (remate si salta junto a la red), X = levantar,
// sin nada = recepción (la levanta en su cancha; en el tercer toque la pasa sola por arriba de la red).
function touches(m: VMatch) {
  const b = m.ball;
  for (const p of m.players) {
    if (p.touchCd > 0) continue;
    const h = hOf(p), hx = p.x + p.facing * 0.15, top = p.y + h + 0.35, bot = p.y + h * 0.25;
    const cy = clamp(b.y, bot, top), dist = Math.hypot(b.x - hx, b.y - cy);
    if (dist > b.r + 0.5 + rOf(p) * 0.4) continue;
    if (m.ballSide !== p.team || (p.team === 0 ? b.x > NET_X : b.x < NET_X)) continue; // (solo se toca de tu lado de la red)
    hitBall(m, p);
    return;
  }
}
function hitBall(m: VMatch, p: VPlayer) {
  const b = m.ball, d = dirOf(p.team), sp = BALLS[m.kind].speed;
  const n = m.lastTeam === p.team && m.ballSide === p.team ? m.touches + 1 : 1; // (los toques de este lado)
  m.lastTeam = p.team; m.touches = n; p.touchCd = 0.32; p.kickT = 0.28;
  if (n > MAX_TOUCHES) { point(m, p.team === 0 ? 1 : 0, 'touches'); return; }
  const ai = !isHuman(p), toNet = Math.abs(p.x - NET_X);
  let kind: 'bump' | 'set' | 'attack' | 'spike';
  if (ai) kind = aiChoose(m, p, n);
  else if (p.hitBuf > 0) kind = !p.ground && b.y > NET_H + 0.15 && toNet < 3.6 ? 'spike' : 'attack';
  else if (p.setBuf > 0) kind = 'set';
  else kind = n >= MAX_TOUCHES ? 'attack' : 'bump';
  const fwd = p.prevIn.right ? 1 : p.prevIn.left ? -1 : 0, push = ai ? 0 : fwd * d; // flecha hacia la red (+1) o para atrás (−1)
  const lv = p.level ?? 0.7, wild = ai ? (m.rand() - 0.5) * (1.4 - lv) * 2.2 : 0;
  const hard = Math.hypot(b.vx, b.vy) > 11; // venía un remate
  if (ai && m.rand() < (1 - lv) * 0.14 + (hard ? 0.16 + (1 - lv) * 0.3 : 0)) { // la máquina también se equivoca (más con los remates)
    if (hard && m.rand() < 0.55) { b.vx = -d * (6 + m.rand() * 5); b.vy = 2.5 + m.rand() * 3; } // no la pudo controlar: sale disparada para atrás
    else if (hard) { b.vx = (m.rand() - 0.5) * 4; b.vy = 3 + m.rand() * 3; } // la frenó pero queda fea, picando en su cancha
    else { b.vx = n >= MAX_TOUCHES ? d * (4 + m.rand() * 6) : (m.rand() - 0.5) * 9; b.vy = 4 + m.rand() * 5; }
    emit(m, { type: 'touch', side: p.team, kind: 'bump', n }); return;
  }
  const opp = m.players[1 - p.team];
  switch (kind) {
    case 'bump': b.vy = 9.2; b.vx = d * 1.2 + (NET_X - d * 2.2 - b.x) * 0.25; break;
    case 'set': { const tx = NET_X - d * 1.4; b.vy = 10.4; b.vx = (tx - b.x) * GRAV * BALLS[m.kind].grav / (2 * b.vy); break; }
    case 'attack': {
      // la persona: el tiempo que mantuvo V decide qué tan largo (con → más fuerte y bajo, con ← un globo alto)
      // la máquina: elige entre dejarla corta, mandarla al fondo, un globo por arriba o un tiro fuerte lejos del rival
      let depth: number, T0: number;
      if (ai) ({ depth, T0 } = aiShot(m, p, false)); else { depth = 1.3 + (p.hitBuf > 0 ? p.pow : 0.5) * 6.1; T0 = push > 0 ? 0.7 : push < 0 ? 1.5 : 1.0; }
      const shot = aimAt(m, NET_X + d * (depth + wild), T0 / sp); b.vx = shot.vx; b.vy = shot.vy;
      break;
    }
    case 'spike': { // remate: hacia abajo, siempre pasando por arriba de la red; corto (junto a la red) o largo (al fondo)
      let depth: number, T0: number;
      if (ai) ({ depth, T0 } = aiShot(m, p, true)); else { depth = 1.2 + p.pow * 6.2; T0 = 0.24 - push * 0.03; }
      const shot = aimAt(m, NET_X + d * (depth + wild * 0.6), T0 / sp, 0.12, 17.5); b.vx = shot.vx; b.vy = shot.vy; p.vy = Math.min(p.vy, 2); break;
    }
  }
  if (ai && (kind === 'attack' || kind === 'spike')) p.base = NET_X - d * (2.8 + m.rand() * 3.6); // (después de atacar, espera en un lugar distinto cada vez)
  if (m.kind === 'hielo') p.slow = 0.9; // la pelota de hielo congela al que la recibe
  const fast = Math.abs(b.vx) > 11;
  if (kind === 'spike' && fast) { m.shake = 0.35; for (let k = 0; k < 10; k++) spark(m, b.x, b.y, BALLS[m.kind].glow, 1); }
  opp.react = kind === 'spike' && fast ? 0.3 + (1 - (opp.level ?? 0.7)) * 0.45 : 0.1 + (1 - (opp.level ?? 0.7)) * 0.2; // (el rival tarda en reaccionar)
  emit(m, { type: 'touch', side: p.team, kind, n });
}
// Picó: adentro de una cancha es punto del otro; afuera, punto del que no la tocó última.
function land(m: VMatch) {
  const b = m.ball, inside = b.x >= -b.r * 0.5 && b.x <= COURT + b.r * 0.5;
  b.y = b.r; emit(m, { type: 'land', inside });
  if (m.kind === 'bomba') { m.shake = 1; emit(m, { type: 'boom' }); for (let k = 0; k < 40; k++) spark(m, b.x, 0.3, k % 2 ? '#fb923c' : '#fde047', 3); }
  if (inside) point(m, b.x < NET_X ? 1 : 0, 'floor');
  else point(m, m.lastTeam === null ? (m.server === 0 ? 1 : 0) : m.lastTeam === 0 ? 1 : 0, m.touches === 0 && m.lastTeam === m.server && !m.servedOver ? 'serve' : 'out');
}
function point(m: VMatch, side: 0 | 1, why: 'floor' | 'out' | 'touches' | 'net' | 'serve') {
  if (m.phase !== 'rally') return;
  m.score[side]++; m.players[side].points = m.score[side]; m.lastPoint = side; m.server = side; m.why = why;
  m.phase = 'point'; m.phaseT = 0;
  emit(m, { type: 'point', side, why });
  const [a, c] = m.score;
  if ((a >= SET_POINTS || c >= SET_POINTS) && Math.abs(a - c) >= 2) m.winner = a > c ? 0 : 1;
  else if (Math.max(a, c) >= SET_POINTS - 1 && m.score[side] > m.score[1 - side]) emit(m, { type: 'setPoint', side });
  const b = m.ball; b.vy = Math.abs(b.vy) * 0.35; b.vx *= 0.5; // (la pelota rebota y queda)
}
function spark(m: VMatch, x: number, y: number, color: string, speed: number) {
  const a = m.rand() * Math.PI * 2, s = speed * (0.5 + m.rand());
  m.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + 1, life: 0, max: 0.35 + m.rand() * 0.35, size: 0.06 + m.rand() * 0.07, color });
  if (m.particles.length > 220) m.particles.splice(0, m.particles.length - 220);
}

// ---------------------------------------------------------------- La máquina
// Calcula dónde va a picar la pelota (simulando la jugada) y se para ahí; recibe, levanta para ella misma y
// remata saltando junto a la red (más seguido y con más puntería en Difícil).
export function predictLanding(m: VMatch): { x: number; t: number } {
  const b = m.ball, g = GRAV * BALLS[m.kind].grav;
  const vx = b.vx;
  let x = b.x, y = b.y, vy = b.vy, t = 0;
  for (; t < 4 && y > b.r; t += 1 / 60) { vy -= (m.kind === 'plasma' && vy < 0 ? g * 1.45 : g) / 60; x += vx / 60; y += vy / 60; }
  return { x, t };
}
function aiMove(m: VMatch, p: VPlayer, dt: number) {
  const b = m.ball, d = dirOf(p.team), lv = p.level ?? 0.6, mine = (x: number) => (p.team === 0 ? x < NET_X : x > NET_X);
  const lo = p.team === 0 ? X0 + 1 : NET_X + 0.6, hi = p.team === 0 ? NET_X - 0.6 : X1 - 1;
  p.aiT -= dt; p.react = Math.max(0, p.react - dt);
  if (p.react > 0) { movePlayer(p, 0, dt); return; }
  if (p.aiT <= 0 && m.phase === 'rally') {
    p.aiT = 0.12 + (1 - lv) * 0.12;
    const land = predictLanding(m), coming = m.ballSide === p.team || mine(land.x);
    if (coming) {
      const first = m.lastTeam !== p.team || m.ballSide !== p.team;
      // si viene alta y cerca de la red, a veces la remata de una (sin levantarla)
      if (first && p.plan === 'none' && Math.abs(land.x - NET_X) < 2.4 && b.vy > -2 && b.y > NET_H && m.rand() < 0.15 + lv * 0.5) p.plan = 'spike';
      // se para un poquito detrás de donde cae (del lado de su fondo)
      p.tx = clamp(land.x - d * (0.25 + (m.touches > 0 && !first ? 0.1 : 0.35)), lo, hi);
      if (p.plan === 'spike') p.tx = clamp(first ? land.x - d * 0.55 : NET_X - d * (1.3 + m.rand() * 0.6), lo, hi);
    } else { p.plan = 'none'; p.tx = clamp(p.base + (m.players[1 - p.team].x - (NET_X + d * 4)) * 0.15, lo, hi); } // espera, leyendo dónde está el rival
  }
  const dx = p.tx - p.x;
  movePlayer(p, Math.abs(dx) > 0.15 ? Math.sign(dx) : 0, dt);
  // salta para rematar cuando la pelota baja cerca de la red
  if (p.plan === 'spike' && p.ground && mine(b.x) && Math.abs(b.x - p.x) < 1.4 && b.vy < 1 && b.y < hOf(p) + 3.2 && b.y > hOf(p) + 0.6) jump(p);
}
function aiChoose(m: VMatch, p: VPlayer, n: number): 'bump' | 'set' | 'attack' | 'spike' {
  const lv = p.level ?? 0.6, b = m.ball, near = Math.abs(p.x - NET_X) < 3.6, r = m.rand();
  if (!p.ground && b.y > NET_H + 0.15 && near && p.plan === 'spike') { p.plan = 'none'; return 'spike'; }
  if (n >= MAX_TOUCHES) { p.plan = 'none'; return 'attack'; }
  if (p.plan === 'spike') return 'set';
  // variado: levantar para rematar, recibir y después decidir, o pasarla de una (sorpresa)
  if (n === 1) { if (r < 0.3 + lv * 0.35) { p.plan = 'spike'; return 'set'; } if (r < 0.85) return 'bump'; return 'attack'; }
  if (r < 0.25 + lv * 0.4) { p.plan = 'spike'; return 'set'; }
  return 'attack';
}
// A dónde tira la máquina: lejos del rival y variando (corta junto a la red, al fondo, globo, fuerte, o un toque suave
// cuando amaga remate). depth = metros desde la red; T0 = tiempo de vuelo pedido (más chico = más fuerte).
function aiShot(m: VMatch, p: VPlayer, spike: boolean): { depth: number; T0: number } {
  const opp = m.players[1 - p.team], oppDepth = Math.abs(opp.x - NET_X), r = m.rand(), lv = p.level ?? 0.6;
  const deep = 5.5 + m.rand() * 1.7, short = 1.2 + m.rand() * 1.4;
  if (spike) {
    if (r < 0.18) return { depth: 1 + m.rand() * 0.9, T0: 0.75 }; // amaga y la deja caer suave atrás de la red
    if (r < 0.3 + lv * 0.4) return { depth: oppDepth > 4 ? short + 0.8 : deep, T0: 0.22 }; // al hueco, fuerte
    return { depth: 2.5 + m.rand() * 5, T0: 0.26 + m.rand() * 0.08 }; // a cualquier lado
  }
  if (r < 0.2) return { depth: oppDepth > 4.5 ? short : deep, T0: 1.6 + m.rand() * 0.4 }; // globo
  if (r < 0.2 + lv * 0.55) return oppDepth > 4 ? { depth: short, T0: 1.1 } : { depth: deep, T0: 0.75 }; // lejos del rival
  return { depth: 1.5 + m.rand() * 6, T0: 0.75 + m.rand() * 0.6 };
}
export const voleyCharName = (c: CharId) => CHARS[c].name;
