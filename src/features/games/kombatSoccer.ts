// Kombat Football 5 contra 5: fútbol de verdad, visto desde arriba en diagonal (como los FIFA viejos), con los
// luchadores de siempre. Cada equipo tiene un arquero y cuatro jugadores (dos defensores y dos delanteros); el
// capitán es el luchador que se eligió. La cancha está cerrada por carteles (como el fútbol indoor de los FIFA de
// Sega y Nintendo): la pelota rebota en ellos y nunca sale, así que no hay laterales ni pelotas trabadas.
// La pelota se lleva pegada al pie; se pasa, se tira cargando el tiro (y con efecto: con ↑ o ↓ al soltar, la
// pelota hace una curva hacia ese palo) y se le roba al rival con una barrida o un quite. Lo divertido: cada
// jugador puede tirarle su PODER al rival que tiene la pelota (lo deja duro y la pelota queda suelta), y con la
// barra del equipo llena sale el FATAL GOAL. Sin trampas: el escenario es la cancha y nada más.
// Medidas en metros: x a lo largo (0 = arco izquierdo, L = arco derecho), z a lo ancho (0 = el lado de atrás,
// D = el de adelante, cerca de la cámara) e y para arriba.
import { CHARS, FATAL_CINE, HALF_TIME, POWER_MAX, SIZE, STATS, heightOf, type CharId, type Element, type Fighter, type GibKind, type Person, type ScreenBlood, type StageId, type StunKind } from './kombat';

export const L = 42; // largo de la cancha
export const D = 22; // ancho
export const ZC = D / 2; // el medio a lo ancho (ahí están los arcos)
export const GW = 6.4; // ancho del arco
export const GH = 2.9; // alto del travesaño
export const GD = 1.7; // hondo de la red
export const BR = 0.42; // radio de la pelota (bien grande, como antes)
export const AREA_X = 6; // el área grande: 6 m de hondo…
export const AREA_W = 13; // …y 13 de ancho
export const CHARGE_TIME = 1; // segundos para el tiro más fuerte
export const POWER_CD = 6;
export const TEAM_CD = 4; // entre poder y poder del mismo equipo (aunque cambie de jugador) // segundos entre poder y poder (más la recarga de cada luchador)
const G = 24; // gravedad de la pelota (pesada: arcade)
const CORNER = 1.6; // las esquinas están cortadas en diagonal (la pelota no se queda trabada ahí)

export type Role = 'gk' | 'def' | 'fwd';
export interface SInput { left: boolean; right: boolean; up: boolean; down: boolean; kick: boolean; pass: boolean; power: boolean; direct?: boolean } // direct: el botón de poder de la pantalla táctil (sin combinación)
export const noSInput = (): SInput => ({ left: false, right: false, up: false, down: false, kick: false, pass: false, power: false });

export interface Player extends Fighter {
  id: number; team: 0 | 1; role: Role; z: number; vz: number;
  hx: number; hz: number; // dónde se para en la formación (medido desde su arco, atacando para +x)
  bdx: number; bdz: number; // hacia dónde lleva la pelota pegada al pie
  cdPow: number; castT: number; slide: number; sdx: number; sdz: number; noTouch: number; protect: number; tackleCd: number; slow: number;
  dive: number; diveVz: number; diveVx: number; save: boolean; savedShot: number; aimZ: number; aimT: number;
  hold: number; chargeOn: boolean; aiT: number; tx: number; tz: number; run: number; prevIn: SInput;
  cTaps: number; cTimer: number; dash: number; dashX: number; dashZ: number; dashHit: number[]; dashShape: AtkShape | null; dashLevel: number; dashCast: number;
  gone: boolean; // reventado por un poder: vuelve a entrar en unos segundos (p.stun cuenta el tiempo)
}
export type BallFx = 'none' | Element;
export interface SBall { x: number; y: number; z: number; vx: number; vy: number; vz: number; spin: number; roll: number; owner: number | null; last: 0 | 1 | null; lastId: number | null; fx: BallFx; fatal: boolean; comet?: boolean; receiver: number | null; shot: number; shooter: 0 | 1 | null }
export interface Proj { cast: number; kind: 'shot' | 'wave' | 'sky'; shape: AtkShape; level: number; big: boolean; team: 0 | 1; from: number; target: number | null; el: Element; x: number; y: number; z: number; vx: number; vz: number; t: number; life: number; done: boolean; hit: number[]; w: number }
export interface SFx { kind: 'bolt' | 'boom' | 'ring' | 'beam' | 'nova'; x: number; y: number; z: number; x2: number; y2: number; z2: number; t: number; life: number; color: string }
export interface SParticle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; color: string; kind: 'spark' | 'smoke' | 'shard' }
export interface Team { captain: CharId; goals: number; power: number; level: number | null; active: number; castT: number; aiCastT: number; switchT: number; atkCd: [number, number, number, number] }
export interface Ref extends Person { z: number; vz: number }
export type SPhase = 'intro' | 'play' | 'goal' | 'fatal' | 'halftime' | 'end' | 'penalty';
export type SEvent =
  | { type: 'kick'; power: number } | { type: 'pass' } | { type: 'hit'; kind: StunKind } | { type: 'tackle'; ok: boolean } | { type: 'goal'; side: 0 | 1; fatal: boolean; scorer: CharId; own: boolean }
  | { type: 'bounce'; power: number } | { type: 'post' } | { type: 'ability'; side: 0 | 1; char: CharId; level: number } | { type: 'fatal'; side: 0 | 1; char: CharId } | { type: 'save'; side: 0 | 1 }
  | { type: 'whistle'; kind: 'kickoff' | 'half' | 'end'; start?: 1 | 2 } | { type: 'halftime' } | { type: 'extra' } | { type: 'header'; side: 0 | 1 } | { type: 'unlock'; side: 0 | 1 } | { type: 'control' }
  | { type: 'explode'; side: 0 | 1; char: CharId; keeper: boolean } | { type: 'penalty'; side: 0 | 1 } | { type: 'notReady'; side: 0 | 1; level: number };
// La sangre y los huesos del que revienta: gotas que vuelan y manchan la cancha donde caen, y los pedazos del
// esqueleto que rebotan.
export interface SGore { drops: { x: number; y: number; z: number; vx: number; vy: number; vz: number; r: number }[]; gibs: { x: number; y: number; z: number; vx: number; vy: number; vz: number; a: number; va: number; kind: GibKind; life: number; c: string }[]; stains: { x: number; z: number; r: number; t: number; seed: number }[] }

export interface SoccerMatch {
  stage: StageId; players: Player[]; ball: SBall; ref: Ref; teams: [Team, Team];
  phase: SPhase; phaseT: number; introLen: number; time: number; half: 1 | 2; clock: number; extra: boolean; extraT: number; kickoffTeam: 0 | 1; firstKick: 0 | 1;
  winner: 0 | 1 | null; lastGoal: { side: 0 | 1; fatal: boolean } | null; events: SEvent[]; shake: number; flash: number; rand: () => number;
  projs: Proj[]; fx: SFx[]; particles: SParticle[]; trail: [number, number, number][]; cam: { x: number; z: number };
  fatal: { team: 0 | 1; shooter: number } | null; casts: number; kills: Record<number, number>; // (cuántos reventó cada ataque)
  netHit: { left: boolean; t: number } | null; shots: number; stillT: number;
  gore: SGore; screenBlood: ScreenBlood[]; penKick: number; // (el tiro del penal: si el arquero adivinó, la agarra)
  penalty: { team: 0 | 1; shooter: number; ready: boolean; pick: -1 | 0 | 1 } | null; // pick: adonde ya decidió tirarse el arquero
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const emit = (m: SoccerMatch, e: SEvent) => { m.events.push(e); };
export function takeSoccerEvents(m: SoccerMatch) { const e = m.events; m.events = []; return e; }
const hyp = Math.hypot;

// ---------------------------------------------------------------- Lados
// En el primer tiempo el equipo 0 defiende el arco de la izquierda; en el segundo, el de la derecha.
export const defendsLeft = (m: SoccerMatch, team: 0 | 1) => (team === 0) === (m.half === 1);
export const attackDir = (m: SoccerMatch, team: 0 | 1): 1 | -1 => defendsLeft(m, team) ? 1 : -1;
const ownGoalX = (m: SoccerMatch, team: 0 | 1) => defendsLeft(m, team) ? 0 : L;
const oppGoalX = (m: SoccerMatch, team: 0 | 1) => defendsLeft(m, team) ? L : 0;
const rel = (m: SoccerMatch, team: 0 | 1, x: number) => defendsLeft(m, team) ? x : L - x; // (medido desde su arco; sirve de ida y de vuelta)
const speedOf = (c: CharId) => 6.1 * (0.72 + STATS[c].speed / 100 * 0.5); // (un poco más lentos)
const strengthOf = (c: CharId) => 0.75 + STATS[c].strength / 100 * 0.45;
export const PLAYER_SCALE = 0.75; // los jugadores, un 25% más chicos (la cancha parece más grande)
export const hOf = (p: Player) => heightOf(p) * PLAYER_SCALE;
const radiusOf = (p: Player) => 0.38 * Math.min(1.25, SIZE[p.char]) * PLAYER_SCALE;
export const isHuman = (m: SoccerMatch, team: 0 | 1) => m.teams[team].level === null;
export const carrier = (m: SoccerMatch) => m.ball.owner === null ? null : m.players[m.ball.owner];
const stunned = (p: Player) => p.stun > 0;
const levelOf = (m: SoccerMatch, team: 0 | 1) => m.teams[team].level ?? 0.65;

// ---------------------------------------------------------------- Los cuatro ataques de cada luchador
// C una vez: el ataque principal (voltea al rival y le hace soltar la pelota). C dos, tres y cuatro veces: ataques
// cada vez más fuertes (revientan en sangre: a uno, a varios, a todos los de una zona). Cada uno se recarga aparte.
//  · shot: proyectiles que persiguen (n: a cuántos) · bolt: rayo instantáneo (encadenado si n > 1)
//  · beam: rayo recto que atraviesa a todos · wave: onda por el piso que avanza · nova: explosión alrededor
//  · sky: cae del cielo sobre los rivales (n) · dash: el luchador sale disparado y arrasa con lo que encuentra
export type AtkType = 'shot' | 'bolt' | 'beam' | 'wave' | 'nova' | 'sky' | 'dash';
export type AtkShape = 'fire' | 'ice' | 'plasma' | 'shuriken' | 'bomb' | 'feather' | 'bubble' | 'rock' | 'skull' | 'blade' | 'bolt' | 'laser' | 'spike' | 'missile' | 'meteor' | 'hail';
export interface Attack { name: string; type: AtkType; shape: AtkShape; n?: number; big?: boolean; r?: number }
const A = (name: string, type: AtkType, shape: AtkShape, o: Partial<Attack> = {}): Attack => ({ name, type, shape, ...o });
export const ATTACKS: Record<CharId, [Attack, Attack, Attack, Attack]> = {
  cometa: [A('Disparo de escarcha', 'shot', 'ice'), A('Cometa helado', 'dash', 'ice'), A('Lluvia de granizo', 'sky', 'hail', { n: 3 }), A('Supernova helada', 'nova', 'ice', { r: 6.5 })],
  inferno: [A('Bola de fuego', 'shot', 'fire'), A('Gran bola de fuego', 'shot', 'fire', { big: true }), A('Muro de fuego', 'wave', 'fire'), A('Lluvia de meteoros', 'sky', 'meteor', { n: 5 })],
  frost: [A('Esquirla de hielo', 'shot', 'ice'), A('Lanza de hielo', 'beam', 'ice'), A('Avalancha', 'wave', 'ice', { big: true }), A('Era de hielo', 'nova', 'ice', { r: 6.5 })],
  thunder: [A('Chispa', 'bolt', 'bolt'), A('Rayo', 'bolt', 'bolt', { big: true }), A('Cadena eléctrica', 'bolt', 'bolt', { n: 3 }), A('Tormenta eléctrica', 'sky', 'bolt', { n: 5 })],
  shadow: [A('Estrella ninja', 'shot', 'shuriken'), A('Estrella gigante', 'shot', 'shuriken', { big: true }), A('Abanico de estrellas', 'shot', 'shuriken', { n: 3 }), A('Danza de las sombras', 'dash', 'skull', { big: true })],
  shadowRed: [A('Estrella explosiva', 'shot', 'bomb'), A('Bomba de fuego', 'shot', 'bomb', { big: true }), A('Racimo de bombas', 'sky', 'bomb', { n: 3 }), A('Gran explosión', 'nova', 'fire', { r: 6.5 })],
  orbot: [A('Disparo tóxico', 'shot', 'plasma'), A('Misil tóxico', 'shot', 'missile', { big: true }), A('Ametralladora', 'shot', 'plasma', { n: 3 }), A('Bombardeo', 'sky', 'missile', { n: 5 })],
  orbotBlue: [A('Disparo de energía', 'shot', 'plasma'), A('Rayo de energía', 'beam', 'laser'), A('Ondas de choque', 'wave', 'plasma'), A('Cañón de plasma', 'beam', 'laser', { big: true })],
  bruto: [A('Piedrazo', 'shot', 'rock'), A('Roca gigante', 'shot', 'rock', { big: true }), A('Golpe terrestre', 'wave', 'rock', { big: true }), A('Terremoto', 'nova', 'rock', { r: 6.5 })],
  brutoRed: [A('Puño de fuego', 'shot', 'fire'), A('Embestida', 'dash', 'fire', { big: true }), A('Pisotón de lava', 'nova', 'fire', { r: 5 }), A('Volcán', 'sky', 'meteor', { n: 5 })],
  aguila: [A('Pluma dorada', 'shot', 'feather'), A('Picada', 'dash', 'bolt'), A('Abanico dorado', 'shot', 'feather', { n: 3 }), A('Rayos del cielo', 'sky', 'bolt', { n: 4 })],
  aguilaBlack: [A('Pluma envenenada', 'shot', 'feather'), A('Pluma maldita', 'shot', 'feather', { big: true }), A('Abanico venenoso', 'shot', 'feather', { n: 3 }), A('Noche eterna', 'nova', 'skull', { r: 6.5 })],
  espectro: [A('Orbe fantasma', 'shot', 'skull'), A('Atravesar', 'dash', 'skull'), A('Almas en pena', 'shot', 'skull', { n: 3 }), A('Grito del más allá', 'nova', 'skull', { r: 6.5 })],
  toxic: [A('Burbuja tóxica', 'shot', 'bubble'), A('Escupitajo ácido', 'shot', 'bubble', { big: true }), A('Ola tóxica', 'wave', 'bubble', { big: true }), A('Lluvia ácida', 'sky', 'bubble', { n: 5 })],
  magma: [A('Bola de lava', 'shot', 'rock'), A('Picos de magma', 'wave', 'spike'), A('Géiseres de lava', 'sky', 'meteor', { n: 3 }), A('Erupción', 'nova', 'fire', { r: 6.5 })],
  cyber: [A('Corte láser', 'shot', 'blade'), A('Láser', 'beam', 'laser'), A('Tajos cruzados', 'shot', 'blade', { n: 3 }), A('Lluvia de láseres', 'sky', 'laser', { n: 5 })],
};
export const LEVEL_CD = [2.2, 4.5, 7.5, 11]; // recarga de cada ataque (por equipo)
const TAP_GAP = 0.3; // segundos para la siguiente C (si no, sale el ataque con las C que se apretaron)

// ---------------------------------------------------------------- Armar el partido
function newPlayer(id: number, team: 0 | 1, char: CharId, role: Role, hx: number, hz: number): Player {
  return {
    side: team, char, x: 0, y: 0, vx: 0, vy: 0, facing: 1, ground: true, action: 'idle', actionT: 0,
    kickT: 0, kickKind: 'normal', kickHit: false, slideT: 0, charge: 0, kickPow: 1, jumps: 0, headT: 0, stun: 0, stunKind: 'none', poison: 0, inv: 0, stamina: 100, power: 0, cd: 0,
    abilityT: 0, abilityHit: false, burst: 0, burstT: 0, powers: {}, prev: { left: false, right: false, up: false, down: false, kick: false, ability: false }, taps: [], goals: 0, restT: 0,
    id, team, role, z: hz, vz: 0, hx, hz, bdx: 1, bdz: 0, cdPow: 0, castT: 0, slide: 0, sdx: 0, sdz: 0, noTouch: 0, protect: 0, tackleCd: 0, slow: 0,
    dive: 0, diveVz: 0, diveVx: 0, save: false, savedShot: -1, aimZ: ZC, aimT: 0, hold: 0, chargeOn: false, aiT: 0, tx: 0, tz: 0, run: 0, prevIn: noSInput(), gone: false, cTaps: 0, cTimer: 0, dash: 0, dashX: 0, dashZ: 0, dashHit: [], dashShape: null, dashLevel: 1, dashCast: 0,
  };
}
// La formación (desde el arco propio, atacando para +x): arquero, dos defensores y dos delanteros.
const FORMATION: [Role, number, number][] = [['gk', 1.4, ZC], ['def', 9, D * 0.3], ['def', 9, D * 0.7], ['fwd', 17.5, D * 0.36], ['fwd', 17.5, D * 0.64]];

export function newSoccer(stage: StageId, captains: [CharId, CharId], levels: [number | null, number | null], rand: () => number = Math.random): SoccerMatch {
  const players: Player[] = []; // cada equipo: cinco iguales (el luchador elegido)
  for (const team of [0, 1] as const) FORMATION.forEach(([role, hx, hz]) => players.push(newPlayer(players.length, team, captains[team], role, hx, hz)));
  const kick: 0 | 1 = rand() < 0.5 ? 0 : 1;
  const m: SoccerMatch = {
    stage, players,
    ball: { x: L / 2, y: BR, z: ZC, vx: 0, vy: 0, vz: 0, spin: 0, roll: 0, owner: null, last: null, lastId: null, fx: 'none', fatal: false, receiver: null, shot: 0, shooter: null },
    ref: { x: L / 2 - 4, y: 0, z: 2, vx: 0, vy: 0, vz: 0, facing: 1, ground: true, action: 'idle', actionT: 0, stun: 0, stunKind: 'none', away: 0 },
    teams: [0, 1].map(t => ({ captain: captains[t], goals: 0, power: 0, level: levels[t], active: t * 5 + 3, castT: 0, aiCastT: 4, switchT: 0, atkCd: [1, 2, 3, 4] })) as [Team, Team],
    phase: 'intro', phaseT: 0, introLen: 2.6, time: 0, half: 1, clock: HALF_TIME, extra: false, extraT: 0, kickoffTeam: kick, firstKick: kick,
    winner: null, lastGoal: null, events: [], shake: 0, flash: 0, rand, projs: [], fx: [], particles: [], trail: [], cam: { x: L / 2, z: ZC },
    fatal: null, netHit: null, shots: 0, stillT: 0, casts: 0, kills: {}, gore: { drops: [], gibs: [], stains: [] }, screenBlood: [], penalty: null, penKick: -1,
  };
  resetKickoff(m, kick);
  return m;
}

// Todos a su lugar para el saque del medio: el capitán del que saca, al lado de la pelota.
function resetKickoff(m: SoccerMatch, team: 0 | 1) {
  m.kickoffTeam = team;
  const b = m.ball; Object.assign(b, { x: L / 2, y: BR, z: ZC, vx: 0, vy: 0, vz: 0, spin: 0, owner: null, last: null, lastId: null, fx: 'none', fatal: false, receiver: null, shooter: null });
  for (const p of m.players) {
    let rx = p.hx, z = p.hz;
    const k = p.id === team * 5 + 3;
    if (p.role === 'fwd') rx = p.team === team ? (k ? L / 2 - 0.9 : L / 2 - 4) : L / 2 - 6.5;
    if (k) z = ZC;
    Object.assign(p, { gone: false, inv: 0, x: rel(m, p.team, rx), z, vx: 0, vz: 0, y: 0, stun: 0, stunKind: 'none', slide: 0, dive: 0, kickT: 0, charge: 0, chargeOn: false, noTouch: 0, hold: 0, action: 'idle', actionT: 0, facing: attackDir(m, p.team) });
    p.bdx = attackDir(m, p.team); p.bdz = 0;
  }
  m.projs = []; m.trail = []; m.fatal = null; m.stillT = 0; m.penalty = null; m.kills = {};
  m.teams[team].active = kicker(m, team).id;
  m.ref.x = L / 2 - 3; m.ref.z = 1.6;
}
const kicker = (m: SoccerMatch, team: 0 | 1) => m.players[team * 5 + 3]; // (el primer delantero)

// ---------------------------------------------------------------- El paso del partido
export function stepSoccer(m: SoccerMatch, inputs: [SInput, SInput], dt: number) {
  m.time += dt; m.phaseT += dt;
  m.shake = Math.max(0, m.shake - dt * 3); m.flash = Math.max(0, m.flash - dt * 2.5);
  if (m.netHit) { m.netHit.t += dt; if (m.netHit.t > 2) m.netHit = null; }
  switch (m.phase) {
    case 'intro':
      for (const p of m.players) settle(m, p, dt, 'idle');
      if (m.phaseT >= m.introLen) {
        m.phase = 'play'; m.phaseT = 0;
        const k = kicker(m, m.kickoffTeam); m.ball.owner = k.id; k.protect = 0.8; m.ball.last = k.team; k.hold = 0; k.aiT = 0.35;
        if (!isHuman(m, k.team)) k.hold = -9; // la máquina saca tocando para atrás (ver carrierAI)
        emit(m, { type: 'whistle', kind: 'kickoff', start: m.kickoffTeam === 0 ? 1 : 2 });
      }
      break;
    case 'fatal':
      if (m.phaseT >= FATAL_CINE && m.fatal) launchFatal(m);
      break;
    case 'goal': {
      const win = m.lastGoal?.side;
      for (const p of m.players) settle(m, p, dt, p.team === win ? 'celebrate' : 'sad');
      moveBall(m, dt);
      if (m.phaseT > 3.2) {
        if (m.winner !== null) { m.phase = 'end'; m.phaseT = 0; emit(m, { type: 'whistle', kind: 'end' }); }
        else { resetKickoff(m, win === 0 ? 1 : 0); m.phase = 'intro'; m.phaseT = 0; m.introLen = 1.1; }
      }
      break;
    }
    case 'halftime':
      for (const p of m.players) settle(m, p, dt, 'idle');
      if (m.phaseT > 3.4) { m.half = 2; m.clock = HALF_TIME; resetKickoff(m, m.firstKick === 0 ? 1 : 0); m.phase = 'intro'; m.phaseT = 0; m.introLen = 1.2; }
      break;
    case 'end':
      for (const p of m.players) settle(m, p, dt, m.winner === null ? 'idle' : p.team === m.winner ? 'celebrate' : 'sad');
      break;
    case 'play': play(m, inputs, dt); break;
    case 'penalty': penaltyStep(m, inputs, dt); break;
  }
  updateGore(m, dt);
  updateRef(m, dt);
  updateFx(m, dt);
  // la cámara sigue a la pelota (en el FATAL, al que tira)
  const fs = m.fatal && m.phase === 'fatal' ? m.players[m.fatal.shooter] : null, fx = fs ? fs.x : m.ball.x, fz = fs ? fs.z : m.ball.z;
  m.cam.x += (fx - m.cam.x) * Math.min(1, dt * 2.6); m.cam.z += (fz - m.cam.z) * Math.min(1, dt * 1.5);
}

// Quieto (o festejando) en su lugar.
function settle(m: SoccerMatch, p: Player, dt: number, action: 'idle' | 'celebrate' | 'sad') {
  p.vx *= Math.max(0, 1 - dt * 6); p.vz *= Math.max(0, 1 - dt * 6);
  p.x += p.vx * dt; p.z += p.vz * dt; p.y = Math.max(0, p.y - dt * 4);
  p.stun = Math.max(0, p.stun - dt); p.slide = 0; p.dive = 0; p.chargeOn = false; p.charge = 0; p.kickT = 0;
  setAction(p, action === 'idle' && p.stun > 0 ? 'stun' : action, dt);
  if (action === 'idle') p.facing = (m.ball.x >= p.x ? 1 : -1);
}
function setAction(p: Player, a: Player['action'], dt: number) { if (p.action !== a) { p.action = a; p.actionT = 0; } else p.actionT += dt; }

function play(m: SoccerMatch, inputs: [SInput, SInput], dt: number) {
  // reloj
  if (m.extra) m.extraT += dt;
  else {
    m.clock -= dt;
    if (m.clock <= 0) { m.clock = 0; endOfHalf(m); return; }
  }
  tickPlayers(m, dt);
  for (const p of m.players) {
    if (p.gone) continue;
    const human = isHuman(m, p.team) && m.teams[p.team].active === p.id;
    if (human) control(m, p, inputs[p.team], dt);
    else if (p.role === 'gk') keeper(m, p, dt);
    else brain(m, p, dt);
  }
  for (const p of m.players) if (!p.gone) moveP(m, p, dt);
  bump(m);
  for (let k = 0; k < 2; k++) moveBall(m, dt / 2);
  updateProjs(m, dt);
  // si la pelota está quieta mucho tiempo sin nadie cerca (no debería pasar), la levanta el más cercano
  const b = m.ball;
  if (b.owner === null && hyp(b.vx, b.vz) < 0.4) m.stillT += dt; else m.stillT = 0;
}

function tickPlayers(m: SoccerMatch, dt: number) {
  for (const t of [0, 1] as const) { const T = m.teams[t]; T.castT = Math.max(0, T.castT - dt); T.aiCastT = Math.max(0, T.aiCastT - dt); T.switchT = Math.max(0, T.switchT - dt); for (let k = 0; k < 4; k++) T.atkCd[k] = Math.max(0, T.atkCd[k] - dt); if (isHuman(m, t)) chooseActive(m, t); }
  for (const p of m.players) {
    for (const k of ['cdPow', 'castT', 'noTouch', 'protect', 'tackleCd', 'slow', 'kickT', 'aimT', 'inv'] as const) p[k] = Math.max(0, p[k] - dt);
    if (p.stun > 0) { p.stun -= dt; if (p.stun <= 0) { p.stun = 0; p.stunKind = 'none'; if (p.gone) respawn(m, p); } }
  }
}
// Vuelve a entrar el que reventó: en su lugar de la formación, titilando un ratito (no le pueden pegar).
function respawn(m: SoccerMatch, p: Player) {
  p.gone = false; p.inv = 1.6; p.x = rel(m, p.team, p.role === 'gk' ? 1.2 : Math.max(3, p.hx - 4)); p.z = p.hz; p.vx = 0; p.vz = 0; p.y = 0; p.slide = 0; p.dive = 0;
  p.facing = attackDir(m, p.team); p.action = 'idle'; p.actionT = 0;
  burst(m, p.x, 1.2, p.z, 18, CHARS[p.char].glow, 'spark', 5);
}

function endOfHalf(m: SoccerMatch) {
  const [a, b] = [m.teams[0].goals, m.teams[1].goals];
  emit(m, { type: 'whistle', kind: m.half === 1 ? 'half' : 'end' });
  if (m.half === 1) { m.phase = 'halftime'; m.phaseT = 0; emit(m, { type: 'halftime' }); return; }
  if (a === b) { m.extra = true; m.extraT = 0; emit(m, { type: 'extra' }); return; } // gol de oro
  m.winner = a > b ? 0 : 1; m.phase = 'end'; m.phaseT = 0;
}

// ---------------------------------------------------------------- El que maneja la persona
// El que tiene la pelota es el que se maneja; si la pelota la tiene el rival o está suelta, el más cercano
// (cambia solo, como en los FIFA). Con la pelota en el aire hacia un compañero (un pase), ese compañero.
function chooseActive(m: SoccerMatch, team: 0 | 1) {
  const T = m.teams[team], b = m.ball, c = carrier(m);
  if (c && c.team === team) { T.active = c.id; return; } // (el arquero también, cuando la tiene: la saca con un pase o para arriba)
  if (b.receiver !== null && m.players[b.receiver].team === team && m.players[b.receiver].role !== 'gk' && !m.players[b.receiver].gone) { T.active = b.receiver; return; }
  const cur = m.players[T.active];
  if (T.switchT > 0 && !cur.gone && cur.role !== 'gk') return;
  const tx = c ? c.x : b.x, tz = c ? c.z : b.z;
  let best = cur, bd = cur.gone || cur.role === 'gk' ? 1e9 : cur.chargeOn ? 0 : hyp(cur.x - tx, cur.z - tz) - 2.2; // (para que no cambie a cada rato)
  for (const p of m.players) if (p.team === team && p.role !== 'gk' && p !== cur && !p.gone) { const d = hyp(p.x - tx, p.z - tz); if (d < bd) { bd = d; best = p; } }
  if (best !== cur) { T.active = best.id; T.switchT = 0.35; }
}

const pressed = (p: Player, i: SInput, k: keyof SInput) => i[k] && !p.prevIn[k];
function control(m: SoccerMatch, p: Player, i: SInput, dt: number) {
  const has = m.ball.owner === p.id;
  let dx = (i.right ? 1 : 0) - (i.left ? 1 : 0), dz = (i.down ? 1 : 0) - (i.up ? 1 : 0);
  const n = hyp(dx, dz); if (n > 0) { dx /= n; dz /= n; }
  p.tx = p.x + dx * 3; p.tz = p.z + dz * 3; p.run = n > 0 ? 1 : 0;
  if (n === 0 && m.ball.receiver === p.id) { p.tx = m.ball.x; p.tz = m.ball.z; p.run = hyp(m.ball.x - p.x, m.ball.z - p.z) < 6 ? 0.55 : 0.8; } // sin flechas: va a recibir el pase
  const fwd = attackDir(m, p.team);
  if (p.role === 'gk') { // el arquero con la pelota: pase con X, para arriba bien lejos con ESPACIO
    if (has) {
      const gx = ownGoalX(m, p.team); p.tx = clamp(p.tx, Math.min(gx, gx + fwd * AREA_X), Math.max(gx, gx + fwd * AREA_X)); p.tz = clamp(p.tz, ZC - AREA_W / 2, ZC + AREA_W / 2);
      if (pressed(p, i, 'pass')) pass(m, p, n > 0 ? [dx, dz] : null);
      else if (pressed(p, i, 'kick')) punt(m, p, n > 0 ? [dx, dz] : null);
      else if (p.hold > 6) pass(m, p, null);
    }
    p.prevIn = { ...i };
    return;
  }
  if (!stunned(p) && p.slide <= 0) {
    // patear: con la pelota carga el tiro (al soltar sale); sin la pelota, barrida o quite
    if (pressed(p, i, 'kick')) { if (has) { p.chargeOn = true; p.charge = 0; } else tackle(m, p, dx, dz); }
    if (p.chargeOn) {
      if (i.kick) p.charge = Math.min(CHARGE_TIME, p.charge + dt);
      else { p.chargeOn = false; if (m.ball.owner === p.id) shoot(m, p, p.charge / CHARGE_TIME, i.up ? -1 : i.down ? 1 : 0); p.charge = 0; }
    }
    if (pressed(p, i, 'pass')) { if (has) { p.chargeOn = false; p.charge = 0; pass(m, p, n > 0 ? [dx, dz] : null); } else switchPlayer(m, p.team); }
    // C: una, dos, tres o cuatro veces seguidas (con la pelota y la barra llena: FATAL GOAL)
    if (pressed(p, i, 'power')) {
      if (has && m.teams[p.team].power >= POWER_MAX) { startFatal(m, p); p.cTaps = 0; }
      else { p.cTaps++; p.cTimer = TAP_GAP; }
    }
    if (p.cTaps > 0) { p.cTimer -= dt; if (p.cTimer <= 0 || p.cTaps >= 4) { castLevel(m, p, Math.min(4, p.cTaps), n > 0 ? [dx, dz] : null); p.cTaps = 0; } }
  }
  p.prevIn = { ...i };
}
function switchPlayer(m: SoccerMatch, team: 0 | 1) {
  const T = m.teams[team], b = m.ball, cur = m.players[T.active];
  const list = m.players.filter(p => p.team === team && p.role !== 'gk' && p !== cur && !p.gone).sort((a, c) => hyp(a.x - b.x, a.z - b.z) - hyp(c.x - b.x, c.z - b.z));
  if (list[0]) { T.active = list[0].id; T.switchT = 0.8; list[0].prevIn = { ...cur.prevIn }; }
}

// ---------------------------------------------------------------- Moverse
function moveP(m: SoccerMatch, p: Player, dt: number) {
  const r = radiusOf(p);
  if (p.dash > 0) { // sale disparado (ataque): arrasa con los rivales que encuentra
    p.dash -= dt; p.vx = p.dashX * 17; p.vz = p.dashZ * 17; p.x += p.vx * dt; p.z += p.vz * dt; p.y = Math.sin(Math.max(0, p.dash) / 0.5 * Math.PI) * 0.6;
    if (Math.abs(p.dashX) > 0.2) p.facing = p.dashX > 0 ? 1 : -1;
    setAction(p, 'special', dt);
    for (const q of m.players) if (q.team !== p.team && !p.dashHit.includes(q.id) && hittable(m, q) && hyp(q.x - p.x, q.z - p.z) < radiusOf(p) + radiusOf(q) + 0.7) { p.dashHit.push(q.id); hitBy(m, q, p, p.dashLevel, p.dashCast); }
    if (m.rand() < 0.8) burst(m, p.x, hOf(p) * 0.5, p.z, 2, CHARS[p.char].glow, 'spark', 2);
    if (p.dash <= 0) { p.dash = 0; p.y = 0; p.vx *= 0.3; p.vz *= 0.3; }
  } else if (p.dive > 0) { // el arquero volando
    p.dive -= dt; const k = 1 - Math.max(0, p.dive) / 0.6;
    p.x += p.diveVx * dt; p.z += p.diveVz * dt; p.diveVz *= 1 - dt * 1.5; p.y = Math.sin(Math.min(1, k) * Math.PI) * 0.7;
    if (p.dive <= 0) { p.y = 0; p.stun = Math.max(p.stun, 0.3); p.stunKind = 'none'; } // (queda en el piso un ratito)
    setAction(p, 'jump', dt); p.facing = p.diveVx > 0.2 ? 1 : p.diveVx < -0.2 ? -1 : p.facing;
  } else if (p.slide > 0) {
    p.slide -= dt; const sp = 10.5 * Math.min(1, p.slide / 0.25 + 0.2);
    p.vx = p.sdx * sp; p.vz = p.sdz * sp; p.x += p.vx * dt; p.z += p.vz * dt;
    setAction(p, 'slide', dt); slideHits(m, p);
  } else {
    let tvx = 0, tvz = 0;
    if (!stunned(p) && p.run > 0) {
      const dx = p.tx - p.x, dz = p.tz - p.z, d = hyp(dx, dz);
      let v = speedOf(p.char) * p.run * (m.ball.owner === p.id ? 0.9 : 1) * (p.slow > 0 ? 0.55 : 1) * (p.chargeOn ? 0.55 : 1);
      if (d < 1.2) v *= d / 1.2; // llega frenando
      if (d > 0.05) { tvx = dx / d * v; tvz = dz / d * v; }
    }
    const A = stunned(p) ? 6 : 34, ax = clamp(tvx - p.vx, -A * dt, A * dt), az = clamp(tvz - p.vz, -A * dt, A * dt);
    p.vx += ax; p.vz += az; p.x += p.vx * dt; p.z += p.vz * dt; p.y = Math.max(0, p.y - dt * 5);
    const sp = hyp(p.vx, p.vz);
    if (Math.abs(p.vx) > 0.4) p.facing = p.vx > 0 ? 1 : -1;
    else if (sp < 0.4) p.facing = m.ball.x >= p.x ? 1 : -1;
    setAction(p, stunned(p) ? 'stun' : p.kickT > 0 ? 'kick' : p.castT > 0 ? 'special' : p.chargeOn ? 'charge' : sp > 0.8 ? 'run' : 'idle', dt);
    if (sp > 0.6 && m.ball.owner === p.id) { p.bdx = p.vx / sp; p.bdz = p.vz / sp; }
  }
  p.x = clamp(p.x, r, L - r); p.z = clamp(p.z, r, D - r);
  cornerPush(p, r);
}
function cornerPush(p: { x: number; z: number; vx: number; vz: number }, r: number, bounce = 0) {
  for (const [cx, cz, sx, sz] of [[0, 0, 1, 1], [L, 0, -1, 1], [0, D, 1, -1], [L, D, -1, -1]] as const) {
    const nx = sx * Math.SQRT1_2, nz = sz * Math.SQRT1_2, d = (p.x - cx) * nx + (p.z - cz) * nz - (CORNER * Math.SQRT1_2 + r);
    if (d < 0) { p.x -= nx * d; p.z -= nz * d; const vn = p.vx * nx + p.vz * nz; if (vn < 0) { p.vx -= (1 + bounce) * vn * nx; p.vz -= (1 + bounce) * vn * nz; } }
  }
}
// Que no se encimen (se empujan suave).
function bump(m: SoccerMatch) {
  const P = m.players;
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const a = P[i], b = P[j]; if (a.gone || b.gone) continue;
    const rr = radiusOf(a) + radiusOf(b), dx = b.x - a.x, dz = b.z - a.z, d = hyp(dx, dz);
    if (d > 0.001 && d < rr) { const k = (rr - d) / d * 0.5; a.x -= dx * k; a.z -= dz * k; b.x += dx * k; b.z += dz * k; }
  }
}

// ---------------------------------------------------------------- Patear, pasar, robar
function release(m: SoccerMatch, p: Player) {
  const b = m.ball; b.owner = null; b.last = p.team; b.lastId = p.id; b.receiver = null; b.fatal = false; b.fx = 'none'; b.comet = false;
  p.noTouch = 0.3; p.kickT = 0.3; p.hold = 0; p.chargeOn = false; p.charge = 0;
  b.x = p.x + p.bdx * 0.7; b.z = p.z + p.bdz * 0.7; b.y = BR;
}
// La pelota sale desde adelante del que patea, hacia donde va (así no le pega en el cuerpo).
function launchFrom(m: SoccerMatch, p: Player) {
  const b = m.ball, sp = hyp(b.vx, b.vz); if (sp < 0.1) return;
  const off = radiusOf(p) + BR + 0.15; b.x = clamp(p.x + b.vx / sp * off, BR, L - BR); b.z = clamp(p.z + b.vz / sp * off, BR, D - BR); p.noTouch = 0.45;
}
// El tiro al arco: apunta a un palo (el que está lejos del arquero, o el que se eligió con ↑/↓); con efecto
// arranca abierto y la curva lo mete en ese palo. Cuanto más cargado, más fuerte (y si se pasa, se va alto).
export function shoot(m: SoccerMatch, p: Player, charge: number, side: -1 | 0 | 1, wild = 1, center = false) {
  const b = m.ball, gx = oppGoalX(m, p.team), gk = m.players.find(q => q.team !== p.team && q.role === 'gk')!;
  release(m, p);
  const sz = side !== 0 ? side : (gk.z < ZC ? 1 : -1), zt = center && side === 0 ? ZC : ZC + sz * GW * 0.34; // (center: el penal al medio)
  const S = (15 + 15 * charge) * strengthOf(p.char), dx = gx - b.x, dz = zt - b.z, d = Math.max(1, hyp(dx, dz)), T = d / S;
  const px = -dz / d, pz = dx / d; // perpendicular a la dirección del tiro
  const spin = side !== 0 ? side * Math.sign(pz || 1) : 0;
  const dev = 0.5 * 9 * spin * Math.min(1, S / 18) * T * T; // cuánto se va a abrir la curva
  let ax = gx - px * dev - b.x, az = zt - pz * dev - b.z;
  const err = (m.rand() - 0.5) * 2 * (0.025 + 0.07 * charge * charge) * wild, ca = Math.cos(err), sa = Math.sin(err);
  [ax, az] = [ax * ca - az * sa, ax * sa + az * ca];
  const n = hyp(ax, az), ht = Math.min(GH - 0.5, 0.45 + charge * 1.3 + m.rand() * 0.4);
  b.vx = ax / n * S; b.vz = az / n * S;
  b.vy = clamp((ht - BR) / T + 0.5 * G * T * 0.8, 1.2, 8.5) + (charge > 0.92 ? m.rand() * 2.6 : 0);
  b.spin = spin; b.comet = charge >= 0.7; b.fx = b.comet ? 'fire' : 'none'; b.shot = ++m.shots; b.shooter = p.team; // (bien cargado: sale como un cometa de fuego)
  launchFrom(m, p); gain(m, p.team, 3);
  emit(m, { type: 'kick', power: charge });
}
// El arquero la tira para arriba, bien lejos (hacia donde apunta o para adelante).
export function punt(m: SoccerMatch, p: Player, dir: [number, number] | null) {
  const b = m.ball, fwd = attackDir(m, p.team);
  let [dx, dz] = dir ?? [fwd, 0]; if (dx * fwd < 0.2) { dx = fwd * 0.8; dz = Math.sign(dz) * 0.6; }
  const n = hyp(dx, dz); release(m, p);
  b.vx = dx / n * 17; b.vz = dz / n * 17; b.vy = 11; b.y = 1.2; launchFrom(m, p); p.protect = 0;
  emit(m, { type: 'kick', power: 0.8 });
}
// Pase: al compañero hacia donde apuntan las flechas (o al mejor ubicado) y a los pies: la pelota va por el piso
// derecho a él (se acomoda si se mueve) y él va a buscarla.
export function pass(m: SoccerMatch, p: Player, dir: [number, number] | null) {
  const mates = m.players.filter(q => q.team === p.team && q !== p && !stunned(q) && !q.gone);
  let best: Player | null = null, bs = -1e9;
  for (const q of mates) {
    const dx = q.x - p.x, dz = q.z - p.z, d = hyp(dx, dz); if (d < 1.5) continue;
    let s: number;
    if (dir) { const c = (dx * dir[0] + dz * dir[1]) / d; if (c < 0.3) continue; s = c * 4 - d / 30 - laneRisk(m, p, q) * 0.6 - pressure(m, q) * 0.2; }
    else { const c = (dx * p.bdx + dz * p.bdz) / d; s = (rel(m, p.team, q.x) - rel(m, p.team, p.x)) / 8 - d / 30 - (q.role === 'gk' ? 2.5 : 0) + c * 1.2 - laneRisk(m, p, q) * 1.6 - pressure(m, q) * 0.4; }
    if (s > bs) { bs = s; best = q; }
  }
  const b = m.ball;
  if (!best) { // nadie hacia allá: la toca para adelante en esa dirección
    release(m, p); const [dx, dz] = dir ?? [attackDir(m, p.team), 0]; b.vx = dx * 13; b.vz = dz * 13; b.vy = 0; launchFrom(m, p); emit(m, { type: 'pass' }); return;
  }
  const d0 = hyp(best.x - p.x, best.z - p.z), S = clamp(9 + d0 * 0.95, 12, 25), T = d0 / S;
  const lead = isHuman(m, best.team) ? 0.25 : 0.6; // (el de la persona frena y la espera)
  const tx = clamp(best.x + best.vx * T * lead, 1, L - 1), tz = clamp(best.z + best.vz * T * lead, 1, D - 1);
  release(m, p);
  const dx = tx - b.x, dz = tz - b.z, d = Math.max(0.5, hyp(dx, dz));
  const lob = laneRisk(m, p, best) > 0.75 && d > 8; // muy tapado: por arriba
  const s2 = lob ? S * 0.8 : S;
  b.vx = dx / d * s2; b.vz = dz / d * s2; b.vy = lob ? 0.5 * G * (d / s2) * 0.92 : 0;
  b.receiver = best.id; best.tx = tx; best.tz = tz;
  launchFrom(m, p); gain(m, p.team, 1);
  emit(m, { type: 'pass' });
}
// La pelota de un pase se acomoda hacia los pies del compañero (aunque él se mueva) y no se frena antes de llegar.
function passAssist(m: SoccerMatch, dt: number) {
  const b = m.ball; if (b.receiver === null || b.owner !== null) return;
  const r = m.players[b.receiver];
  if (r.gone || r.stun > 0) { b.receiver = null; return; }
  if (b.y > 1.3 && b.vy > -2) return; // (un globo: recién cuando baja)
  const dx = r.x + r.vx * 0.15 - b.x, dz = r.z + r.vz * 0.15 - b.z, d = hyp(dx, dz), sp = hyp(b.vx, b.vz);
  if (d < 0.3 || sp < 0.1) return;
  const want = Math.atan2(dz, dx), cur = Math.atan2(b.vz, b.vx); let da = want - cur;
  while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
  if (Math.abs(da) > 1.9) return; // (ya la pasó)
  const a = cur + clamp(da, -5 * dt, 5 * dt), v = Math.max(sp, Math.min(8, d * 2.4));
  b.vx = Math.cos(a) * v; b.vz = Math.sin(a) * v;
}
// qué tan tapado está el pase (rivales cerca de la línea)
function laneRisk(m: SoccerMatch, a: Player, q: Player) {
  let risk = 0; const dx = q.x - a.x, dz = q.z - a.z, d2 = dx * dx + dz * dz;
  for (const o of m.players) if (o.team !== a.team && !o.gone) {
    const t = clamp(((o.x - a.x) * dx + (o.z - a.z) * dz) / d2, 0, 1), cx = a.x + dx * t, cz = a.z + dz * t, dd = hyp(o.x - cx, o.z - cz);
    if (t > 0.08 && t < 0.95 && dd < 1.6) risk = Math.max(risk, 1 - dd / 1.6);
  }
  return risk;
}
const pressure = (m: SoccerMatch, q: Player) => { let r = 0; for (const o of m.players) if (o.team !== q.team && !o.gone) r = Math.max(r, 1 - hyp(o.x - q.x, o.z - q.z) / 4); return r; };
// Quite (cerca del que tiene la pelota) o barrida (corriendo).
export function tackle(m: SoccerMatch, p: Player, dx = 0, dz = 0) {
  if (p.tackleCd > 0) return;
  const c = carrier(m);
  if (c && c.team !== p.team && c.role !== 'gk' && hyp(c.x - p.x, c.z - p.z) < 1.7 + radiusOf(c)) {
    p.tackleCd = 0.55;
    const ok = c.protect <= 0 && m.rand() < 0.55 + (strengthOf(p.char) - strengthOf(c.char)) * 0.6;
    if (ok) { m.ball.owner = p.id; m.ball.last = p.team; p.protect = 0.7; p.hold = 0; c.noTouch = 0.5; c.stun = 0.3; c.stunKind = 'hit'; c.chargeOn = false; gain(m, p.team, 3); }
    else { p.stun = 0.3; p.stunKind = 'none'; }
    emit(m, { type: 'tackle', ok });
    return;
  }
  const sp = hyp(p.vx, p.vz);
  if (dx === 0 && dz === 0) { if (sp > 1) { dx = p.vx / sp; dz = p.vz / sp; } else { const bx = m.ball.x - p.x, bz = m.ball.z - p.z, bd = hyp(bx, bz) || 1; dx = bx / bd; dz = bz / bd; } }
  p.slide = 0.55; p.sdx = dx; p.sdz = dz; p.tackleCd = 1.1;
}
function slideHits(m: SoccerMatch, p: Player) {
  const b = m.ball, c = carrier(m);
  if (c && c.team !== p.team && c.role !== 'gk' && hyp(c.x - p.x, c.z - p.z) < 1.15 + radiusOf(c)) {
    b.owner = null; b.vx = p.sdx * 7 + (m.rand() - 0.5) * 3; b.vz = p.sdz * 7 + (m.rand() - 0.5) * 3; b.vy = 2.5; b.last = p.team; b.lastId = p.id; b.receiver = null;
    c.stun = 0.9; c.stunKind = 'hit'; c.noTouch = 0.6; c.chargeOn = false; c.vx += p.sdx * 3; c.vz += p.sdz * 3;
    gain(m, p.team, 3); emit(m, { type: 'tackle', ok: true }); m.shake = Math.max(m.shake, 0.3);
  } else if (b.owner === null && b.y < 1 && hyp(b.x - p.x, b.z - p.z) < 1.1) {
    b.vx = p.sdx * 9 + b.vx * 0.2; b.vz = p.sdz * 9 + b.vz * 0.2; b.vy = 1.5; b.last = p.team; b.lastId = p.id; b.receiver = null; p.noTouch = 0.25;
  }
}
export const POWER_RATE = 0.3; // la barra del FATAL se llena despacio (una o dos veces por partido)
const gain = (m: SoccerMatch, team: 0 | 1, n: number) => { const T = m.teams[team], was = T.power; T.power = Math.min(POWER_MAX, T.power + n * POWER_RATE); if (was < POWER_MAX && T.power >= POWER_MAX) emit(m, { type: 'unlock', side: team }); };

// ---------------------------------------------------------------- Los poderes
export const STUN_OF: Record<Element, [StunKind, number]> = { fire: ['burn', 1.3], ice: ['freeze', 1.6], volt: ['zap', 1.2], dark: ['hit', 1.25], toxic: ['poison', 1.3], rock: ['hit', 1.5] };
export const attackReady = (m: SoccerMatch, team: 0 | 1, level: number) => m.teams[team].atkCd[level - 1] <= 0;
// Si el que pidió no está listo, sale el más fuerte de los que sí (de los de abajo).
function castLevel(m: SoccerMatch, p: Player, level: number, aim: [number, number] | null) {
  for (let lv = level; lv >= 1; lv--) if (attackReady(m, p.team, lv)) { castAttack(m, p, lv, aim); return; }
  emit(m, { type: 'notReady', side: p.team, level });
}
export function castPower(m: SoccerMatch, p: Player, aim: [number, number] | null = null) { return castAttack(m, p, 1, aim); }
export function castAttack(m: SoccerMatch, p: Player, level: number, aim: [number, number] | null = null) {
  const T = m.teams[p.team];
  if (stunned(p) || p.gone || p.dash > 0 || !attackReady(m, p.team, level)) return false;
  const def = CHARS[p.char], atk = ATTACKS[p.char][level - 1], n = atk.n ?? 1;
  const targets = pickTargets(m, p, aim, n), first = targets[0] ?? null, cast = ++m.casts;
  T.atkCd[level - 1] = LEVEL_CD[level - 1]; p.castT = 0.4;
  emit(m, { type: 'ability', side: p.team, char: p.char, level });
  const hy = hOf(p) * 0.55;
  let [ax, az] = aim ?? [p.facing, 0];
  if (first && (!aim || atk.type !== 'dash')) { const dx = first.x - p.x, dz = first.z - p.z, d = hyp(dx, dz) || 1; [ax, az] = [dx / d, dz / d]; }
  const mk = (kind: Proj['kind'], x: number, y: number, z: number, vx: number, vz: number, target: number | null, life: number, w = 1): Proj =>
    ({ cast, kind, shape: atk.shape, level, big: !!atk.big, team: p.team, from: p.id, target, el: def.element, x, y, z, vx, vz, t: 0, life, done: false, hit: [], w });
  switch (atk.type) {
    case 'shot': {
      const list = targets.length ? targets : [null];
      for (let k = 0; k < Math.max(n, 1); k++) {
        const tg = list[k % list.length], spread = (k - (n - 1) / 2) * 0.35, ca = Math.cos(spread), sa = Math.sin(spread);
        const vx = (ax * ca - az * sa) * (atk.big ? 18 : 22), vz = (ax * sa + az * ca) * (atk.big ? 18 : 22);
        m.projs.push(mk('shot', p.x + ax * 0.5, hy, p.z + az * 0.5, vx, vz, tg?.id ?? null, 1.7, atk.big ? 1.6 : 1));
      }
      break;
    }
    case 'bolt': {
      let from: [number, number, number] = [p.x, hy, p.z];
      if (!targets.length) m.fx.push({ kind: 'bolt', x: p.x, y: hy, z: p.z, x2: p.x + ax * 9, y2: hy, z2: p.z + az * 9, t: 0, life: 0.35, color: def.glow });
      for (const q of targets) { const to: [number, number, number] = [q.x, hOf(q) * 0.55, q.z]; m.fx.push({ kind: 'bolt', x: from[0], y: from[1], z: from[2], x2: to[0], y2: to[1], z2: to[2], t: 0, life: atk.big ? 0.5 : 0.35, color: def.glow }); hitBy(m, q, p, level, cast); from = to; }
      break;
    }
    case 'beam': {
      const len = 22, w = atk.big ? 1.7 : 0.9;
      m.fx.push({ kind: 'beam', x: p.x + ax * 0.5, y: hy, z: p.z + az * 0.5, x2: p.x + ax * len, y2: hy, z2: p.z + az * len, t: 0, life: atk.big ? 0.7 : 0.45, color: def.glow });
      for (const q of m.players) if (q.team !== p.team && hittable(m, q)) { const t = (q.x - p.x) * ax + (q.z - p.z) * az; if (t > 0 && t < len && Math.abs(-(q.x - p.x) * az + (q.z - p.z) * ax) < w + radiusOf(q)) hitBy(m, q, p, level, cast); }
      break;
    }
    case 'wave': m.projs.push(mk('wave', p.x + ax * 0.8, 0.2, p.z + az * 0.8, ax * 15, az * 15, null, 1.25, atk.big ? 2.2 : 1.6)); break;
    case 'nova': {
      const r = atk.r ?? 6;
      m.fx.push({ kind: 'nova', x: p.x, y: 0.3, z: p.z, x2: r, y2: 0, z2: 0, t: 0, life: 0.95, color: def.glow });
      for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2, rr = r * (0.3 + m.rand() * 0.7); burst(m, p.x + Math.cos(a) * rr, 0.2, p.z + Math.sin(a) * rr, 1, k % 2 ? def.glow : def.color, 'spark', 6); }
      for (const q of m.players) if (q.team !== p.team && hittable(m, q) && hyp(q.x - p.x, q.z - p.z) < r) hitBy(m, q, p, level, cast);
      m.shake = Math.max(m.shake, 0.6);
      break;
    }
    case 'sky': {
      const list = targets.length ? targets : [null];
      for (let k = 0; k < n; k++) {
        const tg = list[k % list.length], ox = tg ? 0 : ax * (6 + k * 2), oz = tg ? 0 : az * (6 + k * 2);
        const x = tg ? tg.x : p.x + ox, z = tg ? tg.z : p.z + oz;
        m.projs.push(mk('sky', x + (k >= list.length ? (m.rand() - 0.5) * 3 : 0), 14, z + (k >= list.length ? (m.rand() - 0.5) * 3 : 0), 0, 0, tg?.id ?? null, 0.75 + k * 0.08, atk.shape === 'meteor' || atk.shape === 'bomb' ? 2 : 1.5));
      }
      break;
    }
    case 'dash': {
      p.dash = 0.5; p.dashX = ax; p.dashZ = az; p.dashHit = []; p.dashShape = atk.shape; p.dashLevel = level; p.dashCast = cast; p.inv = Math.max(p.inv, 0.5);
      break;
    }
  }
  return true;
}
// ¿A quiénes les tira? A los rivales más a mano hacia donde apunta (o hacia donde mira); el que tiene la pelota suma.
function pickTargets(m: SoccerMatch, p: Player, aim: [number, number] | null, n: number) {
  const [ax, az] = aim ?? [p.facing, 0], list: [number, Player][] = [];
  for (const q of m.players) if (q.team !== p.team && hittable(m, q)) {
    const dx = q.x - p.x, dz = q.z - p.z, d = hyp(dx, dz); if (d > 22) continue;
    const cos = (dx * ax + dz * az) / (d || 1);
    if (cos > -0.2 || !aim) list.push([d - cos * 7 - (m.ball.owner === q.id ? 3 : 0), q]);
  }
  return list.sort((a, b) => a[0] - b[0]).slice(0, n).map(e => e[1]);
}
const hittable = (m: SoccerMatch, q: Player) => !q.gone && q.inv <= 0 && (q.role !== 'gk' || m.ball.owner === q.id);
// Le pega el poder: revienta en sangre y los huesos salen volando (vuelve a entrar en unos segundos). Si tenía
// la pelota dentro del área del rival, es penal.
// Cuántos puede reventar cada ataque como mucho (los demás que agarra quedan volteados): ninguno mata a todo el equipo.
export const KILL_CAP = [0, 1, 2, 2];
function hitBy(m: SoccerMatch, q: Player, by: Player, level = 2, cast = -1) {
  if (!hittable(m, q)) return;
  const downs = m.players.filter(o => o.team === q.team && o.role !== 'gk' && o.gone).length; // (nunca quedan menos de dos de campo)
  if (level >= 2 && ((m.kills[cast] ?? 0) >= KILL_CAP[level - 1] || downs >= 2)) level = 1;
  if (level >= 2) m.kills[cast] = (m.kills[cast] ?? 0) + 1;
  const b = m.ball, had = b.owner === q.id;
  const inArea = had && q.role !== 'gk' && Math.abs(q.x - oppGoalX(m, q.team)) < AREA_X && Math.abs(q.z - ZC) < AREA_W / 2;
  m.fx.push({ kind: 'boom', x: q.x, y: hOf(q) * 0.5, z: q.z, x2: 0, y2: 0, z2: 0, t: 0, life: 0.5, color: CHARS[by.char].glow });
  burst(m, q.x, hOf(q) * 0.5, q.z, 14, CHARS[by.char].color, 'spark', 6);
  if (level <= 1) knock(m, q, by); else explode(m, q, CHARS[by.char].element);
  gain(m, by.team, 2 + level);
  emit(m, { type: 'hit', kind: STUN_OF[CHARS[by.char].element][0] });
  if (inArea && m.phase === 'play') startPenalty(m, q.team);
}
// El ataque principal (C una vez): lo voltea un ratito, suelta la pelota y salpica un poco de sangre.
function knock(m: SoccerMatch, q: Player, by: Player) {
  const b = m.ball;
  if (b.owner === q.id) { b.owner = null; const nearOwn = Math.abs(q.x - ownGoalX(m, q.team)) < 12, a = m.rand() * Math.PI * 2; b.vx = nearOwn ? attackDir(m, q.team) * 3 : Math.cos(a) * 4; b.vz = Math.sin(a) * 4; b.vy = 4; b.last = q.team; b.lastId = q.id; b.receiver = null; q.noTouch = 0.8; }
  const [kind] = STUN_OF[CHARS[by.char].element];
  q.stun = Math.max(q.stun, 1.3); q.stunKind = kind; q.chargeOn = false; q.charge = 0; q.slide = 0; q.dive = 0; q.cTaps = 0;
  const dx = q.x - by.x, dz = q.z - by.z, d = hyp(dx, dz) || 1; q.vx = dx / d * 5; q.vz = dz / d * 5;
  for (let i = 0; i < 12; i++) { const a = m.rand() * Math.PI * 2, sp = 1 + m.rand() * 3; m.gore.drops.push({ x: q.x, y: hOf(q) * 0.6, z: q.z, vx: Math.cos(a) * sp, vy: 2 + m.rand() * 4, vz: Math.sin(a) * sp, r: 0.04 + m.rand() * 0.05 }); }
  m.shake = Math.max(m.shake, 0.3);
}
export function explode(m: SoccerMatch, q: Player, el: Element | null = null, screen = false) {
  const b = m.ball, h = hOf(q), G2 = m.gore;
  if (b.owner === q.id) { // la pelota queda suelta (cerca de su arco, cae para el lado de la cancha)
    b.owner = null; const a = m.rand() * Math.PI * 2, nearOwn = Math.abs(q.x - ownGoalX(m, q.team)) < 12;
    b.vx = nearOwn ? attackDir(m, q.team) * (2.5 + m.rand() * 2) : Math.cos(a) * 4; b.vz = Math.sin(a) * 4; b.vy = 4.5; b.y = Math.max(b.y, 0.8);
    b.last = q.team; b.lastId = q.id; b.receiver = null;
  }
  for (let i = 0; i < 46; i++) { const a = m.rand() * Math.PI * 2, sp = 2 + m.rand() * 8; G2.drops.push({ x: q.x, y: h * (0.3 + m.rand() * 0.6), z: q.z, vx: Math.cos(a) * sp, vy: 3 + m.rand() * 9, vz: Math.sin(a) * sp * 0.8, r: 0.05 + m.rand() * 0.09 }); }
  const kinds: GibKind[] = ['skull', 'ribs', 'pelvis', 'jaw', 'bone', 'bone', 'bone', 'bone', 'chunk', 'chunk', 'plate', 'plate'];
  for (const kind of kinds) { const a = m.rand() * Math.PI * 2, sp = 2.5 + m.rand() * 6; G2.gibs.push({ x: q.x, y: h * (0.3 + m.rand() * 0.5), z: q.z, vx: Math.cos(a) * sp, vy: 4 + m.rand() * 7, vz: Math.sin(a) * sp * 0.8, a: m.rand() * 6, va: (m.rand() - 0.5) * 18, kind, life: 0, c: CHARS[q.char].color }); }
  if (G2.drops.length > 500) G2.drops.splice(0, G2.drops.length - 500);
  if (G2.gibs.length > 90) G2.gibs.splice(0, G2.gibs.length - 90);
  G2.stains.push({ x: q.x, z: q.z, r: 0.9 + m.rand() * 0.4, t: 0, seed: m.rand() * 100 });
  if (el) burst(m, q.x, h * 0.5, q.z, 10, el === 'fire' ? '#fb923c' : el === 'volt' ? '#fde047' : el === 'ice' ? '#bae6fd' : el === 'toxic' ? '#4ade80' : el === 'dark' ? '#c084fc' : '#fbbf24', 'spark', 7);
  if (screen) for (let k = 0; k < 4; k++) m.screenBlood.push({ x: 0.15 + m.rand() * 0.7, y: 0.2 + m.rand() * 0.5, r: 0.05 + m.rand() * 0.07, t: -k * 0.05, seed: m.rand() * 100, drips: 3 + Math.floor(m.rand() * 4) });
  q.gone = true; q.stun = q.role === 'gk' ? 2.4 : 3.2; q.stunKind = 'hit'; q.chargeOn = false; q.charge = 0; q.slide = 0; q.dive = 0; q.vx = 0; q.vz = 0;
  m.shake = Math.max(m.shake, 0.7); m.flash = Math.max(m.flash, 0.25);
  emit(m, { type: 'explode', side: q.team, char: q.char, keeper: q.role === 'gk' });
}
function updateGore(m: SoccerMatch, dt: number) {
  const G2 = m.gore;
  for (const d of G2.drops) { d.vy -= 20 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; if (d.y <= 0) { d.y = -1; if (G2.stains.length < 400) G2.stains.push({ x: d.x, z: d.z, r: d.r * (1.4 + m.rand()), t: 0, seed: m.rand() * 100 }); } }
  G2.drops = G2.drops.filter(d => d.y > -1);
  for (const g of G2.gibs) {
    g.life += dt;
    if (g.y > 0.05 || g.vy > 0) { g.vy -= 20 * dt; g.y += g.vy * dt; g.a += g.va * dt; }
    if (g.y <= 0.05) { g.y = 0.05; if (g.vy < -2) { g.vy = -g.vy * 0.35; g.va *= 0.6; } else { g.vy = 0; g.va *= 0.9; } g.vx *= 1 - dt * 3; g.vz *= 1 - dt * 3; }
    g.x = clamp(g.x + g.vx * dt, -1, L + 1); g.z = clamp(g.z + g.vz * dt, -0.5, D + 0.5);
  }
  G2.gibs = G2.gibs.filter(g => g.life < 9);
  for (const st of G2.stains) st.t += dt; G2.stains = G2.stains.filter(st => st.t < 40);
  for (const sb of m.screenBlood) sb.t += dt; m.screenBlood = m.screenBlood.filter(sb => sb.t < 5);
}
// ---------------------------------------------------------------- Penal
function startPenalty(m: SoccerMatch, team: 0 | 1) {
  m.phase = 'penalty'; m.phaseT = 0; m.projs = [];
  const shooter = m.players.filter(q => q.team === team && q.role === 'fwd' && !q.gone)[0] ?? m.players.find(q => q.team === team && q.role !== 'gk' && !q.gone)!;
  m.penalty = { team, shooter: shooter.id, ready: false, pick: ([-1, 0, 1] as const)[Math.floor(m.rand() * 3)] }; // el arquero decide apenas se cobra
  emit(m, { type: 'penalty', side: team }); emit(m, { type: 'whistle', kind: 'half' });
}
const SPOT = 4.6;
function penaltyStep(m: SoccerMatch, inputs: [SInput, SInput], dt: number) {
  const pen = m.penalty!, sh = m.players[pen.shooter], gx = oppGoalX(m, pen.team), out = gx === 0 ? 1 : -1;
  tickPlayersQuiet(m, dt);
  if (!pen.ready) {
    for (const p of m.players) if (!p.gone) settle(m, p, dt, 'idle');
    moveBall(m, dt);
    if (m.phaseT > 1.6) { // todos a su lugar: la pelota en el punto, el arquero en la línea, los demás afuera del área
      pen.ready = true;
      for (const p of m.players) if (p.gone) { p.gone = false; p.stun = 0; p.inv = 1; }
      let k = 0;
      for (const p of m.players) {
        Object.assign(p, { vx: 0, vz: 0, y: 0, stun: 0, slide: 0, dive: 0, chargeOn: false, charge: 0, action: 'idle' });
        if (p === sh) { p.x = gx + out * (SPOT + 1.1); p.z = ZC; p.facing = -out as 1 | -1; }
        else if (p.role === 'gk' && p.team !== pen.team) { p.x = gx + out * 0.8; p.z = ZC; p.savedShot = -1; p.aimT = 0; }
        else if (p.role === 'gk') { p.x = rel(m, p.team, 1.4); p.z = ZC; }
        else { p.x = gx + out * (AREA_X + 2 + (k % 2) * 2); p.z = ZC - 6 + k * 3.4; k++; }
      }
      const b = m.ball; Object.assign(b, { x: gx + out * SPOT, z: ZC, y: BR, vx: 0, vy: 0, vz: 0, spin: 0, owner: sh.id, last: sh.team, lastId: sh.id, fatal: false, fx: 'none', receiver: null });
      sh.bdx = -out; sh.bdz = 0; sh.hold = 0; m.phaseT = 0;
    }
    return;
  }
  // el que patea: la persona (carga con ESPACIO y elige el palo con ↑/↓) o la máquina
  const i = isHuman(m, sh.team) ? inputs[sh.team] : null;
  if (i) {
    m.teams[sh.team].active = sh.id;
    if (i.kick && !sh.prevIn.kick) { sh.chargeOn = true; sh.charge = 0; }
    if (sh.chargeOn) { if (i.kick) sh.charge = Math.min(CHARGE_TIME, sh.charge + dt); else { sh.chargeOn = false; shoot(m, sh, Math.max(0.25, sh.charge / CHARGE_TIME), i.up ? -1 : i.down ? 1 : 0, 0.5, true); } }
    sh.prevIn = { ...i };
  } else if (m.phaseT > 1.3) shoot(m, sh, 0.45 + m.rand() * 0.35, ([-1, 0, 1] as const)[Math.floor(m.rand() * 3)], 0.5, true);
  if (m.phaseT > 8 && m.ball.owner === sh.id) shoot(m, sh, 0.5, 0, 0.5, true); // (si no patea, patea solo)
  for (const p of m.players) { p.run = 0; p.tx = p.x; p.tz = p.z; } // (todos quietos; el arquero espera en la línea)
  if (m.ball.owner === null) { // patearon: el arquero se tira adonde había decidido (derecha, medio o izquierda)
    const gk = m.players.find(q => q.role === 'gk' && q.team !== pen.team)!, zt = ZC + pen.pick * GW * 0.34;
    gk.savedShot = m.ball.shot; gk.save = true; m.penKick = m.ball.shot; gk.aimZ = zt; gk.aimT = 0.9;
    if (pen.pick !== 0) { gk.dive = 0.6; gk.diveVz = (zt - gk.z) / 0.32; gk.diveVx = 0; }
  }
  for (const p of m.players) moveP(m, p, dt);
  if (m.ball.owner === null) { m.phase = 'play'; m.phaseT = 0; m.penalty = null; }
  else carry(m, dt);
}
function tickPlayersQuiet(m: SoccerMatch, dt: number) { for (const p of m.players) for (const k of ['noTouch', 'kickT', 'aimT', 'inv', 'castT'] as const) p[k] = Math.max(0, p[k] - dt); }
function updateProjs(m: SoccerMatch, dt: number) {
  for (const s of m.projs) {
    s.t += dt;
    const by = m.players[s.from], tg = s.target !== null ? m.players[s.target] : null;
    if (s.kind === 'sky') { // cae del cielo: sigue al rival un rato y después se clava
      if (tg && hittable(m, tg) && s.t < s.life * 0.55) { s.x += (tg.x - s.x) * Math.min(1, dt * 8); s.z += (tg.z - s.z) * Math.min(1, dt * 8); }
      s.y = 14 * Math.max(0, 1 - s.t / s.life);
      if (s.t >= s.life) {
        s.done = true;
        m.fx.push({ kind: 'boom', x: s.x, y: 0.3, z: s.z, x2: 0, y2: 0, z2: 0, t: 0, life: 0.55, color: CHARS[by.char].glow });
        burst(m, s.x, 0.3, s.z, 16, CHARS[by.char].color, 'spark', 7); m.shake = Math.max(m.shake, 0.45);
        for (const q of m.players) if (q.team !== s.team && hittable(m, q) && hyp(q.x - s.x, q.z - s.z) < s.w + radiusOf(q)) hitBy(m, q, by, s.level, s.cast);
      }
      continue;
    }
    if (s.kind === 'shot' && tg && hittable(m, tg)) { // lo persigue (doblando de a poco)
      const dx = tg.x - s.x, dz = tg.z - s.z, d = hyp(dx, dz) || 1, sp = hyp(s.vx, s.vz), k = Math.min(1, dt * 7);
      s.vx += (dx / d * sp - s.vx) * k; s.vz += (dz / d * sp - s.vz) * k;
    }
    s.x += s.vx * dt; s.z += s.vz * dt;
    if (s.kind === 'wave') { // la onda arrasa con todos los que pasa
      if (m.rand() < 0.9) burst(m, s.x + (m.rand() - 0.5) * s.w, 0.1, s.z + (m.rand() - 0.5) * s.w, 1, CHARS[by.char].color, 'spark', 3);
      for (const q of m.players) if (q.team !== s.team && !s.hit.includes(q.id) && hittable(m, q) && hyp(q.x - s.x, q.z - s.z) < s.w + radiusOf(q)) { s.hit.push(q.id); hitBy(m, q, by, s.level, s.cast); }
    } else for (const q of m.players) if (q.team !== s.team && hittable(m, q) && hyp(q.x - s.x, q.z - s.z) < (s.big ? 0.9 : 0.6) + radiusOf(q)) { hitBy(m, q, by, s.level, s.cast); s.done = true; break; }
    if (s.done && m.phase !== 'play') break;
    if (!s.done && (s.t > s.life || s.x < -1 || s.x > L + 1 || s.z < -1 || s.z > D + 1)) { s.done = true; m.fx.push({ kind: 'ring', x: s.x, y: s.y, z: s.z, x2: 0, y2: 0, z2: 0, t: 0, life: 0.35, color: CHARS[by.char].glow }); }
  }
  m.projs = m.projs.filter(s => !s.done);
}
// ---------------------------------------------------------------- FATAL GOAL
export function startFatal(m: SoccerMatch, p: Player) {
  if (m.teams[p.team].power < POWER_MAX || m.ball.owner !== p.id) return false;
  m.teams[p.team].power = 0; m.phase = 'fatal'; m.phaseT = 0; m.fatal = { team: p.team, shooter: p.id };
  p.action = 'fatal'; p.actionT = 0; p.chargeOn = false; p.vx = 0; p.vz = 0;
  m.flash = 0.6; emit(m, { type: 'fatal', side: p.team, char: p.char });
  return true;
}
function launchFatal(m: SoccerMatch) {
  const f = m.fatal!, p = m.players[f.shooter], b = m.ball, gx = oppGoalX(m, p.team), gk = m.players.find(q => q.team !== p.team && q.role === 'gk')!;
  release(m, p);
  // derecho al arquero (revienta) y adentro del arco
  const tx = gx, zt = gk.gone ? ZC : clamp(gk.z, ZC - GW / 2 + 0.6, ZC + GW / 2 - 0.6), dx = tx - b.x, dz = zt - b.z, d = hyp(dx, dz) || 1, S = 26, T = d / S;
  b.vx = dx / d * S; b.vz = dz / d * S; b.vy = clamp((1.2 - BR) / T + 0.5 * G * T, 1, 9); b.spin = 0;
  b.fatal = true; b.fx = CHARS[p.char].element; b.shot = ++m.shots; b.shooter = p.team; launchFrom(m, p);
  m.phase = 'play'; m.phaseT = 0; m.shake = 1; m.flash = 0.8;
  emit(m, { type: 'kick', power: 1.3 });
}

// ---------------------------------------------------------------- La pelota
function moveBall(m: SoccerMatch, dt: number) {
  const b = m.ball;
  if (b.owner !== null) { carry(m, dt); return; }
  const air = b.y > BR + 0.01 || b.vy > 0;
  if (air) { b.vy -= G * dt; const k = 1 - 0.1 * dt; b.vx *= k; b.vz *= k; }
  else {
    const sp = hyp(b.vx, b.vz), dec = (2.4 + 0.3 * sp) * dt, k = sp > 0 ? Math.max(0, sp - dec) / sp : 0;
    b.vx *= k; b.vz *= k;
  }
  const sp = hyp(b.vx, b.vz);
  if (b.spin !== 0 && sp > 2) { const a = b.spin * 9 * Math.min(1, sp / 18), vx0 = b.vx; b.vx += -b.vz / sp * a * dt; b.vz += vx0 / sp * a * dt; }
  b.spin *= Math.max(0, 1 - dt * (air ? 0.25 : 2));
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.roll += sp * dt / BR;
  if (b.y < BR) { b.y = BR; if (b.vy < -2.6) { emit(m, { type: 'bounce', power: Math.min(1, -b.vy / 14) }); b.vy = -b.vy * 0.5; b.vx *= 0.92; b.vz *= 0.92; } else b.vy = 0; }
  if (b.fatal && sp < 12) b.fatal = false;
  if (b.fatal && m.rand() < 0.7) { const el = b.fx, c = el === 'fire' ? '#fb923c' : el === 'volt' ? '#fde047' : el === 'ice' ? '#bae6fd' : el === 'toxic' ? '#4ade80' : el === 'dark' ? '#e879f9' : '#fbbf24'; burst(m, b.x, b.y, b.z, 2, c, 'spark', 2.5); }
  if (b.receiver !== null && sp < 1) b.receiver = null;
  passAssist(m, dt);
  if (b.comet && sp < 9) { b.comet = false; if (!b.fatal) b.fx = 'none'; }
  if (b.comet && m.rand() < 0.8) burst(m, b.x - b.vx * 0.02, b.y, b.z - b.vz * 0.02, 2, m.rand() < 0.5 ? '#fb923c' : '#fde047', 'spark', 2);
  if (sp > 11 && m.phase === 'play') { m.trail.unshift([b.x, b.y, b.z]); if (m.trail.length > (b.comet || b.fatal ? 26 : 12)) m.trail.pop(); } else if (m.trail.length) m.trail.pop();
  walls(m);
  if (m.phase === 'play') { checkGoal(m); touches(m); }
}
// Pegada al pie, adelante del que la lleva.
function carry(m: SoccerMatch, dt: number) {
  const b = m.ball, p = m.players[b.owner!];
  if (p.role === 'gk') { b.x = p.x + p.facing * 0.35; b.z = p.z + 0.15; b.y = hOf(p) * 0.45; b.vx = p.vx; b.vz = p.vz; b.vy = 0; p.hold += dt; return; } // (cuenta el tiempo: a los segundos la saca)
  const off = 0.45 + radiusOf(p) + Math.abs(Math.sin(m.time * 9)) * 0.08, sp = hyp(p.vx, p.vz);
  const nx = clamp(p.x + p.bdx * off, BR, L - BR), nz = clamp(p.z + p.bdz * off, BR, D - BR);
  b.vx = (nx - b.x) / Math.max(dt, 1e-3); b.vz = (nz - b.z) / Math.max(dt, 1e-3);
  if (hyp(b.vx, b.vz) > 30) { b.vx = p.vx; b.vz = p.vz; }
  b.x = nx; b.z = nz; b.y = BR; b.vy = 0; b.spin = 0; b.roll += sp * dt / BR; b.fx = 'none';
  p.hold += dt;
}
// Los carteles (rebota), las esquinas cortadas, los palos, el travesaño y la red.
function walls(m: SoccerMatch) {
  const b = m.ball, inMouth = Math.abs(b.z - ZC) < GW / 2 - BR * 0.6 && b.y < GH - BR * 0.4;
  for (const left of [true, false]) {
    const gx = left ? 0 : L, out = left ? -1 : 1;
    // dentro del arco (detrás de la línea): la red lo frena
    if ((left ? b.x < BR : b.x > L - BR) && (inMouth || (left ? b.x < 0 : b.x > L))) {
      if (left ? b.x < -GD + BR : b.x > L + GD - BR) { b.x = gx + out * (GD - BR); b.vx *= -0.15; b.vz *= 0.5; netHit(m, left); }
      if (Math.abs(b.z - ZC) > GW / 2 - BR) { b.z = ZC + Math.sign(b.z - ZC) * (GW / 2 - BR); b.vz *= -0.2; b.vx *= 0.6; }
      if (b.y > GH - BR) { b.y = GH - BR; b.vy = -Math.abs(b.vy) * 0.2; }
      continue;
    }
    // los palos
    for (const pz of [ZC - GW / 2, ZC + GW / 2]) {
      const dx = b.x - gx, dz = b.z - pz, d = hyp(dx, dz), R = BR + 0.1;
      if (b.y < GH + 0.1 && d < R && d > 1e-4) { const nx = dx / d, nz = dz / d, vn = b.vx * nx + b.vz * nz; b.x = gx + nx * R; b.z = pz + nz * R; if (vn < 0) { b.vx -= 1.7 * vn * nx; b.vz -= 1.7 * vn * nz; emit(m, { type: 'post' }); } }
    }
    // el travesaño
    if (Math.abs(b.z - ZC) < GW / 2 && Math.abs(b.x - gx) < BR + 0.1) {
      const dy = b.y - GH; if (Math.abs(dy) < BR + 0.08) { b.vy = dy > 0 ? Math.abs(b.vy) * 0.6 + 1 : -Math.abs(b.vy) * 0.5; b.vx *= -0.5; b.y = GH + Math.sign(dy || 1) * (BR + 0.09); emit(m, { type: 'post' }); }
    }
    // el cartel del fondo (al costado del arco, o por arriba del travesaño)
    if (left ? b.x < BR : b.x > L - BR) { b.x = left ? BR : L - BR; if ((left && b.vx < 0) || (!left && b.vx > 0)) { emitBounce(m, Math.abs(b.vx)); b.vx = -b.vx * 0.62; } }
  }
  if (b.z < BR) { b.z = BR; if (b.vz < 0) { emitBounce(m, -b.vz); b.vz = -b.vz * 0.62; } }
  if (b.z > D - BR) { b.z = D - BR; if (b.vz > 0) { emitBounce(m, b.vz); b.vz = -b.vz * 0.62; } }
  if (b.x > 0 && b.x < L) cornerPush(b, BR, 0.62);
}
const emitBounce = (m: SoccerMatch, v: number) => { if (v > 3) emit(m, { type: 'bounce', power: Math.min(1, v / 18) }); };
const netHit = (m: SoccerMatch, left: boolean) => { if (!m.netHit || m.netHit.t > 0.4) m.netHit = { left, t: 0 }; };

function checkGoal(m: SoccerMatch) {
  const b = m.ball;
  for (const left of [true, false]) {
    if ((left ? b.x < -BR * 0.9 : b.x > L + BR * 0.9) && Math.abs(b.z - ZC) < GW / 2 && b.y < GH) {
      const conceded: 0 | 1 = defendsLeft(m, 0) === left ? 0 : 1, side: 0 | 1 = conceded === 0 ? 1 : 0;
      const scorerP = b.lastId !== null ? m.players[b.lastId] : null, own = !!scorerP && scorerP.team === conceded && b.shooter !== side; // (un tiro desviado es gol del que tiró)
      m.teams[side].goals++; m.lastGoal = { side, fatal: b.fatal };
      netHit(m, left); m.shake = b.fatal ? 1.2 : 0.6; m.flash = b.fatal ? 1 : 0.4;
      emit(m, { type: 'goal', side, fatal: b.fatal, scorer: scorerP ? scorerP.char : m.teams[side].captain, own });
      gain(m, conceded, 8); // (el que recibe el gol carga más: para dar vuelta el partido)
      m.phase = 'goal'; m.phaseT = 0; m.projs = [];
      if (m.extra) m.winner = side;
      return;
    }
  }
}
// Quién la agarra: el más cercano que llega (al pie, o de pecho/cabeza si viene alta). El arquero la ataja.
function touches(m: SoccerMatch) {
  const b = m.ball, sp = hyp(b.vx, b.vz);
  let best: Player | null = null, bd = 1e9;
  for (const p of m.players) {
    if (p.gone || p.noTouch > 0 || p.stun > 0 || p.slide > 0) continue;
    const d = hyp(p.x - b.x, p.z - b.z), h = hOf(p);
    if (b.fatal) { // el FATAL arrasa con el que se cruza; el arquero revienta en sangre
      if (p.team !== b.shooter && p.role === 'gk' && d < radiusOf(p) + BR + 0.6 && b.y < h * 1.2) { explode(m, p, b.fx === 'none' ? null : b.fx, true); m.shake = 1.4; continue; }
      if (p.team !== b.shooter && d < radiusOf(p) + BR && b.y < h) { p.stun = 1.6; p.stunKind = 'burn'; p.dive = 0; p.vx = b.vx * 0.3; p.vz = b.vz * 0.3; m.shake = 0.8; emit(m, { type: 'hit', kind: 'burn' }); burst(m, p.x, h * 0.5, p.z, 16, '#fb923c', 'spark', 7); }
      continue;
    }
    if (p.role === 'gk') { if (keeperTouch(m, p, d)) return; continue; }
    const reach = 0.55 + radiusOf(p) + Math.min(0.3, sp * 0.015);
    if (d < reach && b.y < h * 1.05 && d < bd) { bd = d; best = p; }
  }
  if (!best) return;
  const p = best, relv = hyp(b.vx - p.vx, b.vz - p.vz), h = hOf(p);
  const mine = b.receiver === p.id; // (el pase era para él: la recibe siempre)
  if (b.y < 1.05 || relv < 7 || mine) { // la controla
    if (relv < 17 || mine || m.rand() < 0.4) {
      b.owner = p.id; b.receiver = null; b.spin = 0; b.fatal = false; b.fx = 'none'; b.comet = false; b.last = p.team; b.lastId = p.id; p.hold = 0; p.protect = 0.25;
      const dx = b.x - p.x, dz = b.z - p.z, d = hyp(dx, dz); if (d > 0.1) { p.bdx = dx / d; p.bdz = dz / d; }
      if (relv > 8) emit(m, { type: 'control' });
    } else { b.vx = b.vx * -0.25 + p.vx; b.vz = b.vz * -0.25 + p.vz; b.vy = 2; p.noTouch = 0.3; b.last = p.team; b.lastId = p.id; emit(m, { type: 'bounce', power: 0.5 }); }
  } else if (b.y > h * 0.55) { // cabezazo: al arco si está cerca, si no para adelante
    const gx = oppGoalX(m, p.team), dg = hyp(gx - b.x, ZC - b.z), at = dg < 16;
    const tx = at ? gx : b.x + attackDir(m, p.team) * 10, tz = at ? ZC + (m.rand() - 0.5) * GW * 0.7 : b.z + (m.rand() - 0.5) * 6;
    const dx = tx - b.x, dz = tz - b.z, d = hyp(dx, dz) || 1, S = at ? 15 : 11;
    b.vx = dx / d * S; b.vz = dz / d * S; b.vy = at ? 1 : 4; b.spin = 0; b.last = p.team; b.lastId = p.id; b.receiver = null; p.noTouch = 0.35;
    if (at) { b.shot = ++m.shots; b.shooter = p.team; }
    p.action = 'header'; p.actionT = 0;
    emit(m, { type: 'header', side: p.team });
  } else { b.vy = Math.abs(b.vy) * 0.3 + 1; b.vx = b.vx * 0.3 + p.vx; b.vz = b.vz * 0.3 + p.vz; p.noTouch = 0.2; b.last = p.team; b.lastId = p.id; } // de pecho: le cae adelante
}
function keeperTouch(m: SoccerMatch, p: Player, d: number) {
  const b = m.ball, h = hOf(p), sp = hyp(b.vx, b.vz), diving = p.dive > 0;
  const reach = (diving ? 1.5 : 0.8) + radiusOf(p);
  if (d > reach || b.y > h * 1.2 + (diving ? 0.4 : 0)) return false;
  if (diving && !p.save && d > 0.45) return false; // se tiró pero no llegó
  if (b.last === p.team && sp < 6) { b.owner = p.id; b.last = p.team; b.lastId = p.id; b.receiver = null; p.hold = 0; return true; } // un pase atrás de un compañero
  const lv = levelOf(m, p.team), catchP = b.shot === m.penKick ? 1 : clamp(1.25 - sp / 26 + lv * 0.1, 0.25, 0.97);
  if (m.rand() < catchP) { b.owner = p.id; b.last = p.team; b.lastId = p.id; b.receiver = null; b.spin = 0; b.fx = 'none'; p.hold = 0; p.protect = 9; }
  else { // la rechaza al costado
    const side = Math.sign(b.z - ZC) || (m.rand() < 0.5 ? -1 : 1), out = attackDir(m, p.team);
    b.vx = out * (5 + m.rand() * 4); b.vz = side * (6 + m.rand() * 4); b.vy = 3 + m.rand() * 2; b.spin = 0; b.last = p.team; b.lastId = p.id; b.receiver = null; p.noTouch = 0.5;
  }
  if (sp > 8) { emit(m, { type: 'save', side: p.team }); gain(m, p.team, 5); }
  return true;
}

// ---------------------------------------------------------------- La computadora (y los compañeros)
// El arquero: se para entre la pelota y el medio del arco, sale a buscarla si queda suelta cerca, se tira a los
// tiros (llega más o menos según la dificultad y lo fuerte del tiro) y después la pasa a un compañero.
function keeper(m: SoccerMatch, p: Player, dt: number) {
  const b = m.ball, gx = ownGoalX(m, p.team), out = attackDir(m, p.team), lv = levelOf(m, p.team);
  if (p.dive > 0 || stunned(p)) { p.run = 0; return; }
  if (b.owner === p.id) { // la tiene: la pasa
    p.run = 0; p.tx = p.x; p.tz = p.z;
    if (p.hold > 0.9) { p.protect = 0; if (m.rand() < 0.35) punt(m, p, null); else pass(m, p, null); } // la saca: un pase o para arriba
    return;
  }
  let tx = gx + out * 1.1, tz = ZC + clamp((b.z - ZC) * 0.5, -GW / 2 + 0.5, GW / 2 - 0.5);
  const free = b.owner === null, dBall = hyp(b.x - gx, b.z - ZC);
  if (free && dBall < 7.5 && Math.abs(b.z - ZC) < AREA_W / 2 && hyp(b.vx, b.vz) < 9 && b.last !== null) { // sale a buscarla
    const near = Math.min(99, ...m.players.filter(q => q.team !== p.team && !q.gone).map(q => hyp(q.x - b.x, q.z - b.z)));
    if (hyp(p.x - b.x, p.z - b.z) < near * 1.4) { tx = b.x; tz = b.z; }
  }
  // un tiro que viene al arco: decide si se tira
  if (free && b.shot !== p.savedShot && b.shooter !== p.team && (b.vx * out) < -6) {
    const t = (p.x - b.x) / b.vx;
    if (t > 0 && t < 0.85) {
      p.savedShot = b.shot;
      const sp0 = Math.hypot(b.vx, b.vz), az = b.spin * 9 * Math.min(1, sp0 / 18) * (b.vx / sp0); // (la curva del efecto)
      const zp = b.z + b.vz * t + 0.5 * az * t * t, yp = b.y + b.vy * t - 0.5 * G * t * t, dz = zp - p.z, sp = hyp(b.vx, b.vz);
      const onTarget = Math.abs(zp - ZC) < GW / 2 + 0.3 && yp < GH + 0.3;
      if (onTarget && !b.fatal) {
        const prob = clamp(1.2 - (sp - 14) / 45 - Math.abs(dz) * 0.07 + (lv - 0.5) * 0.35 - (b.spin !== 0 ? 0.08 : 0), 0.15, 0.95);
        p.save = Math.abs(dz) < 0.6 && yp < hOf(p) ? true : m.rand() < prob; p.aimZ = clamp(zp, ZC - GW / 2 - 0.3, ZC + GW / 2 + 0.3); p.aimT = t + 0.3;
      }
    }
  }
  // se tira a último momento (si no llega caminando)
  if (free && p.aimT > 0 && p.dive <= 0 && b.vx * out < -4) {
    const t = (p.x - b.x) / b.vx, dz = p.aimZ - p.z;
    if (t > 0 && t < 0.42 && Math.abs(dz) > 0.5 + radiusOf(p) * 0.5) { p.dive = 0.6; p.diveVz = clamp(dz / Math.max(0.18, t), -10, 10) * (p.save ? 1 : 0.5); p.diveVx = 0; }
  }
  if (p.aimT > 0) tz = p.aimZ; // se para donde va a llegar el tiro
  p.tx = tx; p.tz = tz; p.run = hyp(tx - p.x, tz - p.z) > 0.3 ? 1 : 0;
  void dt;
}
// Los de campo: con la pelota encara, pasa o tira; los compañeros se desmarcan; sin la pelota, el más cercano
// presiona, otro cubre y el resto se acomoda. La computadora también tira poderes al que tiene la pelota.
function brain(m: SoccerMatch, p: Player, dt: number) {
  const b = m.ball, c = carrier(m), lv = levelOf(m, p.team), cpu = !isHuman(m, p.team);
  if (stunned(p) || p.slide > 0) { p.run = 0; return; }
  p.aiT -= dt;
  if (c === p) { carrierAI(m, p, lv, cpu); return; }
  const dir = attackDir(m, p.team), bxr = rel(m, p.team, b.x);
  const home = (shift: number) => { const rx = clamp(p.hx + shift + (bxr - L / 2) * 0.35, 3, L - 4); return [rel(m, p.team, rx), p.hz + (b.z - ZC) * 0.25] as const; };
  let tx: number, tz: number, run = 1;
  if (c && c.team === p.team) { // atacamos: a los espacios, adelante de la pelota
    [tx, tz] = home(p.role === 'fwd' ? 7 : 5);
    if (p.role === 'fwd') { tx = clamp(rel(m, p.team, Math.max(rel(m, p.team, c.x) + 5, p.hx + 6)), 2, L - 2); }
    if (hyp(tx - c.x, tz - c.z) < 5) tz += tz > c.z ? 3 : -3;
    if (b.receiver === p.id) { tx = b.x; tz = b.z; } // va a buscar el pase
    run = 0.85;
  } else if (c) { // defendemos
    const mates = m.players.filter(q => q.team === p.team && q.role !== 'gk' && !q.gone).sort((a, q) => hyp(a.x - c.x, a.z - c.z) - hyp(q.x - c.x, q.z - c.z));
    const rank = mates.indexOf(p), humanActive = isHuman(m, p.team) ? m.players[m.teams[p.team].active] : null;
    const presser = humanActive && mates[0] === humanActive ? mates[1] : mates[0];
    if (p === presser || (rank === 0 && !humanActive)) {
      tx = c.x + c.vx * 0.3 - dir * 0.6; tz = c.z + c.vz * 0.3;
      const d = hyp(c.x - p.x, c.z - p.z);
      if (d < 1.5 + radiusOf(c) && p.tackleCd <= 0 && p.aiT <= 0) { p.aiT = 0.35; if (m.rand() < (cpu ? 0.35 + 0.5 * lv : 0.5)) tackle(m, p); }
    } else if (rank <= 1 || (humanActive && rank === 2 && mates[1] === presser)) { // cubre: entre la pelota y el arco
      const gx = ownGoalX(m, p.team); tx = c.x + (gx - c.x) * 0.38; tz = c.z + (ZC - c.z) * 0.38;
    } else { [tx, tz] = home(-3); }
  } else { // pelota suelta: el más cercano de cada equipo va a buscarla
    const mates = m.players.filter(q => q.team === p.team && q.role !== 'gk' && !q.gone);
    const eta = (q: Player) => hyp(q.x - b.x, q.z - b.z) / speedOf(q.char);
    const humanActive = isHuman(m, p.team) ? m.teams[p.team].active : -1;
    const first = mates.filter(q => q.id !== humanActive).sort((a, q) => eta(a) - eta(q))[0];
    const chase = b.receiver === p.id || (first === p && (humanActive < 0 || eta(p) < eta(m.players[humanActive]) * 0.7));
    if (chase) { const t = Math.min(1.1, eta(p)); tx = clamp(b.x + b.vx * t * 0.7, 0.5, L - 0.5); tz = clamp(b.z + b.vz * t * 0.7, 0.5, D - 0.5); }
    else { [tx, tz] = home(b.last === p.team ? 3 : -1); run = 0.8; }
  }
  p.tx = tx; p.tz = tz; p.run = hyp(tx - p.x, tz - p.z) > 0.4 ? run : 0;
  aiCast(m, p, lv, cpu);
}
// Los de la máquina (y los compañeros) también se tiran poderes: al que tiene la pelota o a cualquier rival cerca.
function aiCast(m: SoccerMatch, p: Player, lv: number, cpu: boolean) {
  const T = m.teams[p.team];
  if (T.aiCastT > 0 || p.castT > 0 || m.phase !== 'play' || p.dash > 0) return;
  if (m.rand() > (cpu ? 0.02 + 0.03 * lv : 0.015)) return; // (cada tanto, no todos a la vez)
  const t = pickTargets(m, p, null, 1)[0];
  if (!t || hyp(t.x - p.x, t.z - p.z) > 15) return;
  // elige el ataque: los fuertes cuando están listos (más seguido si la máquina es difícil)
  const ready = [1, 2, 3, 4].filter(l => attackReady(m, p.team, l));
  if (!ready.length) return;
  let level = ready[0];
  for (const l of ready) if (m.rand() < (cpu ? 0.25 + lv * 0.35 : 0.35)) level = l;
  const dx = t.x - p.x, dz = t.z - p.z, d = hyp(dx, dz) || 1;
  if (castAttack(m, p, level, [dx / d, dz / d])) T.aiCastT = cpu ? 6 - lv * 2.5 : 8;
}
// ¿hay un rival (que no sea el arquero) tapando el tiro?
function shotLaneBlocked(m: SoccerMatch, p: Player, gx: number) {
  const dx = gx - p.x, dz = ZC - p.z, d2 = dx * dx + dz * dz;
  return m.players.some(o => { if (o.team === p.team || o.role === 'gk' || o.gone) return false; const t = ((o.x - p.x) * dx + (o.z - p.z) * dz) / d2; if (t < 0.03 || t > 0.9) return false; return hyp(o.x - (p.x + dx * t), o.z - (p.z + dz * t)) < 1.3; });
}
function carrierAI(m: SoccerMatch, p: Player, lv: number, cpu: boolean) {
  const gx = oppGoalX(m, p.team), dir = attackDir(m, p.team), dg = hyp(gx - p.x, ZC - p.z);
  let near: Player | null = null, nd = 1e9;
  for (const o of m.players) if (o.team !== p.team && o.role !== 'gk' && !o.gone) { const d = hyp(o.x - p.x, o.z - p.z); if (d < nd) { nd = d; near = o; } }
  const front = !!near && (near.x - p.x) * dir > -0.5;
  if (p.hold < -5 && p.aiT <= 0) { // el saque del medio: la toca para atrás, a un defensor
    const back = m.players.filter(q => q.team === p.team && q.role === 'def' && !q.gone).sort((a, q) => hyp(a.x - p.x, a.z - p.z) - hyp(q.x - p.x, q.z - p.z))[0];
    if (back) { pass(m, p, [back.x - p.x, back.z - p.z].map(v => v / (hyp(back.x - p.x, back.z - p.z) || 1)) as [number, number]); return; }
  }
  if (p.aiT <= 0) {
    p.aiT = 0.18;
    if (cpu && m.teams[p.team].power >= POWER_MAX && dg < 25 && p.hold > 0.3) { startFatal(m, p); return; }
    const range = 11 + STATS[p.char].strength / 100 * 6, lane = shotLaneBlocked(m, p, gx);
    if (dg < range && Math.abs(p.z - ZC) < 8.5 && p.hold > 0.3 && (!lane || dg < 7 || m.rand() < 0.25)) {
      const ch = clamp(0.3 + (dg - 5) / 22 + m.rand() * 0.15, 0.3, 0.9), side = m.rand() < 0.45 ? 0 : (m.rand() < 0.5 ? -1 : 1);
      shoot(m, p, ch, side as -1 | 0 | 1, cpu ? 1.35 - lv * 0.55 : 1); return;
    }
    if (nd < 2.6 && front && p.hold > 0.25 && m.rand() < (cpu ? 0.35 + 0.35 * lv : 0.6)) { pass(m, p, null); return; }
    if (p.hold > 1.4 && m.rand() < 0.25) {
      const ahead = m.players.some(q => q.team === p.team && q !== p && q.role !== 'gk' && !q.gone && (q.x - p.x) * dir > 4 && laneRisk(m, p, q) < 0.4);
      if (ahead) { pass(m, p, null); return; }
    }
  }
  let tz = ZC + (p.z - ZC) * 0.5;
  if (near && nd < 4 && front) tz = p.z + (p.z > near.z ? 3 : -3); // lo esquiva
  p.tx = clamp(gx - dir * 3, 1, L - 1); p.tz = clamp(tz, 1.2, D - 1.2); p.run = 1;
}

// ---------------------------------------------------------------- Árbitro, efectos
function updateRef(m: SoccerMatch, dt: number) {
  const r = m.ref, b = m.ball, tx = clamp(b.x - 3 * Math.sign(b.x - L / 2 || 1), 3, L - 3), tz = clamp(b.z - 6.5, 0.8, D * 0.35);
  const dx = tx - r.x, dz = tz - r.z, d = hyp(dx, dz), v = d > 1.5 ? 6.2 : 0;
  r.vx += ((d ? dx / d * v : 0) - r.vx) * Math.min(1, dt * 5); r.vz += ((d ? dz / d * v : 0) - r.vz) * Math.min(1, dt * 5);
  if (m.phase === 'fatal') { r.vx = 0; r.vz = 0; }
  r.x += r.vx * dt; r.z += r.vz * dt;
  const sp = hyp(r.vx, r.vz), a = sp > 0.6 ? 'run' : m.phase === 'goal' || (m.phase === 'intro' && m.phaseT > m.introLen - 0.6) ? 'whistle' : 'idle';
  if (r.action !== a) { r.action = a; r.actionT = 0; } else r.actionT += dt;
  if (Math.abs(r.vx) > 0.3) r.facing = r.vx > 0 ? 1 : -1; else r.facing = b.x > r.x ? 1 : -1;
}
export function burst(m: SoccerMatch, x: number, y: number, z: number, n: number, color: string, kind: SParticle['kind'], speed: number) {
  for (let i = 0; i < n; i++) { const a = m.rand() * Math.PI * 2, s = speed * (0.4 + m.rand() * 0.6); m.particles.push({ x, y, z, vx: Math.cos(a) * s, vy: m.rand() * speed, vz: Math.sin(a) * s * 0.6, life: 0, max: 0.4 + m.rand() * 0.4, size: 0.08 + m.rand() * 0.1, color, kind }); }
  if (m.particles.length > 260) m.particles.splice(0, m.particles.length - 260);
}
function updateFx(m: SoccerMatch, dt: number) {
  for (const e of m.fx) e.t += dt; m.fx = m.fx.filter(e => e.t < e.life);
  for (const p of m.particles) { p.life += dt; p.vy -= (p.kind === 'smoke' ? -1 : 9) * dt; p.x += p.vx * dt; p.y = Math.max(0, p.y + p.vy * dt); p.z += p.vz * dt; }
  m.particles = m.particles.filter(p => p.life < p.max);
}
export const soccerClock = (s: number) => `${String(Math.floor(Math.ceil(s) / 60)).padStart(2, '0')}:${String(Math.ceil(s) % 60).padStart(2, '0')}`;
