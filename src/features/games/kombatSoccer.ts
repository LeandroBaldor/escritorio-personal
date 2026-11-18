// Kombat Football 5 contra 5: fútbol de verdad, visto desde arriba en diagonal (como los FIFA viejos), con los
// luchadores de siempre. Cada equipo tiene un arquero y cuatro jugadores (dos defensores y dos delanteros); el
// capitán es el luchador que se eligió. La cancha es larga (como en los FIFA de los 90: la cámara la recorre de
// punta a punta) y está cerrada por carteles: la pelota rebota en ellos y nunca sale.
// La pelota se lleva pegada al pie; se pasa, se tira cargando el tiro (y con efecto: con ↑ o ↓ al soltar, la
// pelota hace una curva hacia ese palo) y se le roba al rival con una barrida o un quite. Los jugadores no se
// atacan entre ellos: lo difícil viene del escenario. Aparecen tiburones voladores que se tiran en picada a
// comerse a alguien, lagos de lava que hay que saltar o rodear, un ovni que le dispara a un jugador y meteoritos
// que caen en la cancha y hacen explotar al que agarran.
// Medidas en metros: x a lo largo (0 = arco izquierdo, L = arco derecho), z a lo ancho (0 = el lado de atrás,
// D = el de adelante, cerca de la cámara) e y para arriba.
import { CHARS, HALF_TIME, SIZE, STATS, heightOf, type CharId, type Element, type Fighter, type GibKind, type Person, type ScreenBlood, type StageId } from './kombat';

export const L = 60; // largo de la cancha (antes 42: ahora más larga, como los FIFA de los 90)
export const D = 22; // ancho
export const ZC = D / 2; // el medio a lo ancho (ahí están los arcos)
export const GW = 8.6; // ancho del arco (antes 6,4)
export const GH = 3.5; // alto del travesaño (antes 2,9)
export const GD = 1.9; // hondo de la red
export const BR = 0.42; // radio de la pelota (bien grande, como antes)
export const AREA_X = 7; // el área grande: 7 m de hondo…
export const AREA_W = 16.5; // …y 16,5 de ancho
export const CHARGE_TIME = 1; // segundos para el tiro más fuerte
export const JUMP_T = 0.62; // lo que dura un salto (para pasar por arriba de la lava)
const JUMP_H = 1.15; // la altura del salto
const G = 24; // gravedad de la pelota (pesada: arcade)
const CORNER = 1.6; // las esquinas están cortadas en diagonal (la pelota no se queda trabada ahí)

export type Role = 'gk' | 'def' | 'fwd';
// jump: el salto (con la C, la Z o el botón de la pantalla); direct quedó del botón de poder de antes
export interface SInput { left: boolean; right: boolean; up: boolean; down: boolean; kick: boolean; pass: boolean; jump: boolean }
export const noSInput = (): SInput => ({ left: false, right: false, up: false, down: false, kick: false, pass: false, jump: false });

export interface Player extends Fighter {
  id: number; team: 0 | 1; role: Role; z: number; vz: number;
  hx: number; hz: number; // dónde se para en la formación (medido desde su arco, atacando para +x)
  bdx: number; bdz: number; // hacia dónde lleva la pelota pegada al pie
  slide: number; sdx: number; sdz: number; noTouch: number; protect: number; tackleCd: number;
  dive: number; diveVz: number; diveVx: number; save: boolean; savedShot: number; aimZ: number; aimT: number;
  hold: number; chargeOn: boolean; aiT: number; tx: number; tz: number; run: number; prevIn: SInput; kTimer: number;
  jump: number; // cuánto le falta para volver al piso (0 = en el piso)
  burn: number; // se prendió fuego en la lava: cuando llega a 0 queda hecho cenizas
  gone: boolean; // se lo comió un tiburón, explotó o quedó hecho cenizas: vuelve a entrar en unos segundos (p.stun cuenta el tiempo)
}
export type BallFx = 'none' | Element;
export interface SBall { x: number; y: number; z: number; vx: number; vy: number; vz: number; spin: number; roll: number; owner: number | null; last: 0 | 1 | null; lastId: number | null; fx: BallFx; comet?: boolean; receiver: number | null; shot: number; shooter: 0 | 1 | null }
export interface SFx { kind: 'bolt' | 'boom' | 'ring' | 'beam' | 'nova'; x: number; y: number; z: number; x2: number; y2: number; z2: number; t: number; life: number; color: string }
export interface SParticle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; color: string; kind: 'spark' | 'smoke' | 'shard' }
export interface Team { captain: CharId; goals: number; level: number | null; active: number; switchT: number }
export interface Ref extends Person { z: number; vz: number }
export type SPhase = 'intro' | 'play' | 'goal' | 'halftime' | 'end';

// ---------------------------------------------------------------- Los peligros del escenario
// · shark: un tiburón volador (el de Ciudad Tiburón) entra por un costado, persigue a un jugador desde el aire y se
//   tira en picada adonde va a estar: si lo agarra, se lo come. Se esquiva corriendo.
// · lava: un lago de lava que aparece de la nada (primero se agrieta el piso y brilla). El que lo pisa se prende
//   fuego y queda hecho cenizas; hay que rodearlo o saltarlo.
// · ufo: el ovni de Kombat Penales baja, sigue a un jugador, se frena, carga (marca el piso) y dispara el rayo:
//   el que queda adentro de la marca explota.
// · meteor: un meteorito cae del cielo (la marca roja avisa dónde) y explota al que agarra.
export type HazardKind = 'shark' | 'lava' | 'ufo' | 'meteor';
export const HAZARD_KINDS: HazardKind[] = ['shark', 'lava', 'ufo', 'meteor'];
export interface Hazard {
  id: number; kind: HazardKind; stage: number; t: number; st: number; // st: el tiempo en la etapa
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  tx: number; tz: number; // adónde apunta (fijo desde que se decide)
  target: number | null; r: number; rz: number; seed: number; react: number; caught: number | null; sharkType: 0 | 1 | 2; done: boolean;
}
// Cuánto dura cada etapa.
export const LAVA_T = { warn: 1.1, hot: 8.5, cool: 1.2 };
export const UFO_T = { follow: 2.5, charge: 0.85, beam: 0.55, leave: 1.4 };
export const METEOR_T = 1.8;
export const SHARK_H = 3.3; // a qué altura vuela el tiburón antes de tirarse
export const SHARK_DIVE = 0.55;
export const UFO_H = 4.3;
export const HAZARD_START = 3.5; // segundos de juego antes del primero
const HAZARD_GAP: [number, number] = [3.2, 5.6]; // entre uno y otro
const HAZARD_MAX = 3; // como mucho, a la vez

export type SEvent =
  | { type: 'kick'; power: number } | { type: 'pass' } | { type: 'tackle'; ok: boolean } | { type: 'goal'; side: 0 | 1; scorer: CharId; own: boolean }
  | { type: 'bounce'; power: number } | { type: 'post' } | { type: 'save'; side: 0 | 1 } | { type: 'jump' }
  | { type: 'whistle'; kind: 'kickoff' | 'half' | 'end'; start?: 1 | 2 } | { type: 'halftime' } | { type: 'extra' } | { type: 'header'; side: 0 | 1 } | { type: 'control' }
  | { type: 'explode'; side: 0 | 1; char: CharId; keeper: boolean } | { type: 'hazard'; kind: HazardKind } | { type: 'dive' } | { type: 'eaten'; side: 0 | 1; char: CharId }
  | { type: 'burn'; side: 0 | 1 } | { type: 'ash'; side: 0 | 1 } | { type: 'beam' } | { type: 'impact' };
// La sangre y los huesos del que revienta: gotas que vuelan y manchan la cancha donde caen, y los pedazos del
// esqueleto que rebotan.
export interface SGore { drops: { x: number; y: number; z: number; vx: number; vy: number; vz: number; r: number }[]; gibs: { x: number; y: number; z: number; vx: number; vy: number; vz: number; a: number; va: number; kind: GibKind; life: number; c: string }[]; stains: { x: number; z: number; r: number; t: number; seed: number }[] }

export interface SoccerMatch {
  stage: StageId; players: Player[]; ball: SBall; ref: Ref; teams: [Team, Team];
  phase: SPhase; phaseT: number; introLen: number; time: number; half: 1 | 2; clock: number; extra: boolean; extraT: number; kickoffTeam: 0 | 1; firstKick: 0 | 1;
  winner: 0 | 1 | null; lastGoal: { side: 0 | 1 } | null; events: SEvent[]; shake: number; flash: number; rand: () => number;
  fx: SFx[]; particles: SParticle[]; trail: [number, number, number][]; cam: { x: number; z: number };
  netHit: { left: boolean; t: number } | null; shots: number; stillT: number;
  gore: SGore; screenBlood: ScreenBlood[];
  hazards: Hazard[]; hazardT: number; hazardN: number; lastHazard: HazardKind | null; noHazards: boolean; // noHazards: para las pruebas
  scorch: { x: number; z: number; r: number; t: number; seed: number }[]; // los cráteres de los meteoritos
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
const speedOf = (c: CharId) => 6.6 * (0.72 + STATS[c].speed / 100 * 0.5); // (la cancha es más larga: un poquito más rápidos)
const strengthOf = (c: CharId) => 0.75 + STATS[c].strength / 100 * 0.45;
export const PLAYER_SCALE = 0.75; // los jugadores, un 25% más chicos (la cancha parece más grande)
export const hOf = (p: Player) => heightOf(p) * PLAYER_SCALE;
export const radiusOf = (p: Player) => 0.38 * Math.min(1.25, SIZE[p.char]) * PLAYER_SCALE;
export const isHuman = (m: SoccerMatch, team: 0 | 1) => m.teams[team].level === null;
export const carrier = (m: SoccerMatch) => m.ball.owner === null ? null : m.players[m.ball.owner];
const stunned = (p: Player) => p.stun > 0;
const levelOf = (m: SoccerMatch, team: 0 | 1) => m.teams[team].level ?? 0.65;

// ---------------------------------------------------------------- Armar el partido
function newPlayer(id: number, team: 0 | 1, char: CharId, role: Role, hx: number, hz: number): Player {
  return {
    side: team, char, x: 0, y: 0, vx: 0, vy: 0, facing: 1, ground: true, action: 'idle', actionT: 0,
    kickT: 0, kickKind: 'normal', kickHit: false, slideT: 0, charge: 0, kickPow: 1, jumps: 0, headT: 0, stun: 0, stunKind: 'none', poison: 0, inv: 0, stamina: 100, power: 0, cd: 0,
    abilityT: 0, abilityHit: false, burst: 0, burstT: 0, powers: {}, prev: { left: false, right: false, up: false, down: false, kick: false, ability: false }, taps: [], goals: 0, restT: 0,
    id, team, role, z: hz, vz: 0, hx, hz, bdx: 1, bdz: 0, slide: 0, sdx: 0, sdz: 0, noTouch: 0, protect: 0, tackleCd: 0,
    dive: 0, diveVz: 0, diveVx: 0, save: false, savedShot: -1, aimZ: ZC, aimT: 0, hold: 0, chargeOn: false, aiT: 0, tx: 0, tz: 0, run: 0, prevIn: noSInput(), gone: false, kTimer: 0, jump: 0, burn: 0,
  };
}
// La formación (desde el arco propio, atacando para +x): arquero, dos defensores y dos delanteros.
const FORMATION: [Role, number, number][] = [['gk', 1.5, ZC], ['def', 12.5, D * 0.3], ['def', 12.5, D * 0.7], ['fwd', 24.5, D * 0.36], ['fwd', 24.5, D * 0.64]];

export function newSoccer(stage: StageId, captains: [CharId, CharId], levels: [number | null, number | null], rand: () => number = Math.random): SoccerMatch {
  const players: Player[] = []; // cada equipo: cinco iguales (el luchador elegido)
  for (const team of [0, 1] as const) FORMATION.forEach(([role, hx, hz]) => players.push(newPlayer(players.length, team, captains[team], role, hx, hz)));
  const kick: 0 | 1 = rand() < 0.5 ? 0 : 1;
  const m: SoccerMatch = {
    stage, players,
    ball: { x: L / 2, y: BR, z: ZC, vx: 0, vy: 0, vz: 0, spin: 0, roll: 0, owner: null, last: null, lastId: null, fx: 'none', receiver: null, shot: 0, shooter: null },
    ref: { x: L / 2 - 4, y: 0, z: 2, vx: 0, vy: 0, vz: 0, facing: 1, ground: true, action: 'idle', actionT: 0, stun: 0, stunKind: 'none', away: 0 },
    teams: [0, 1].map(t => ({ captain: captains[t], goals: 0, level: levels[t], active: t * 5 + 3, switchT: 0 })) as [Team, Team],
    phase: 'intro', phaseT: 0, introLen: 2.6, time: 0, half: 1, clock: HALF_TIME, extra: false, extraT: 0, kickoffTeam: kick, firstKick: kick,
    winner: null, lastGoal: null, events: [], shake: 0, flash: 0, rand, fx: [], particles: [], trail: [], cam: { x: L / 2, z: ZC },
    netHit: null, shots: 0, stillT: 0, gore: { drops: [], gibs: [], stains: [] }, screenBlood: [],
    hazards: [], hazardT: HAZARD_START, hazardN: 0, lastHazard: null, noHazards: false, scorch: [],
  };
  resetKickoff(m, kick);
  return m;
}

// Todos a su lugar para el saque del medio: el capitán del que saca, al lado de la pelota. Los peligros que
// quedaban se van (así nadie saca del medio arriba de un lago de lava).
function resetKickoff(m: SoccerMatch, team: 0 | 1) {
  m.kickoffTeam = team;
  const b = m.ball; Object.assign(b, { x: L / 2, y: BR, z: ZC, vx: 0, vy: 0, vz: 0, spin: 0, owner: null, last: null, lastId: null, fx: 'none', receiver: null, shooter: null });
  for (const p of m.players) {
    let rx = p.hx, z = p.hz;
    const k = p.id === team * 5 + 3;
    if (p.role === 'fwd') rx = p.team === team ? (k ? L / 2 - 0.9 : L / 2 - 4) : L / 2 - 6.5;
    if (k) z = ZC;
    Object.assign(p, { gone: false, inv: 0, x: rel(m, p.team, rx), z, vx: 0, vz: 0, y: 0, stun: 0, stunKind: 'none', slide: 0, dive: 0, kickT: 0, charge: 0, chargeOn: false, noTouch: 0, hold: 0, action: 'idle', actionT: 0, facing: attackDir(m, p.team), jump: 0, burn: 0 });
    p.bdx = attackDir(m, p.team); p.bdz = 0;
  }
  m.trail = []; m.stillT = 0;
  m.hazards = []; m.hazardT = Math.max(m.hazardT, 2.2);
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
    case 'goal': {
      const win = m.lastGoal?.side;
      for (const p of m.players) if (!p.gone) settle(m, p, dt, p.team === win ? 'celebrate' : 'sad');
      tickRespawn(m, dt);
      moveBall(m, dt);
      updateHazards(m, dt);
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
  }
  updateGore(m, dt);
  updateRef(m, dt);
  updateFx(m, dt);
  // la cámara sigue a la pelota
  const b = m.ball;
  m.cam.x += (b.x - m.cam.x) * Math.min(1, dt * 2.6); m.cam.z += (b.z - m.cam.z) * Math.min(1, dt * 1.5);
}

// Quieto (o festejando) en su lugar.
function settle(m: SoccerMatch, p: Player, dt: number, action: 'idle' | 'celebrate' | 'sad') {
  p.vx *= Math.max(0, 1 - dt * 6); p.vz *= Math.max(0, 1 - dt * 6);
  p.x += p.vx * dt; p.z += p.vz * dt; p.y = Math.max(0, p.y - dt * 4); p.jump = 0;
  if (p.burn > 0) { p.burn -= dt; if (p.burn <= 0) ash(m, p); }
  if (!p.gone) p.stun = Math.max(0, p.stun - dt);
  p.slide = 0; p.dive = 0; p.chargeOn = false; p.charge = 0; p.kickT = 0;
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
    else {
      if (p.role === 'gk') keeper(m, p, dt);
      else brain(m, p, dt);
      avoidHazards(m, p);
    }
  }
  for (const p of m.players) if (!p.gone) moveP(m, p, dt);
  bump(m);
  for (let k = 0; k < 2; k++) moveBall(m, dt / 2);
  updateHazards(m, dt);
  // si la pelota está quieta mucho tiempo sin nadie cerca (no debería pasar), la levanta el más cercano
  const b = m.ball;
  if (b.owner === null && hyp(b.vx, b.vz) < 0.4) m.stillT += dt; else m.stillT = 0;
}

function tickPlayers(m: SoccerMatch, dt: number) {
  for (const t of [0, 1] as const) { const T = m.teams[t]; T.switchT = Math.max(0, T.switchT - dt); if (isHuman(m, t)) chooseActive(m, t); }
  for (const p of m.players) {
    for (const k of ['noTouch', 'protect', 'tackleCd', 'kickT', 'aimT', 'inv'] as const) p[k] = Math.max(0, p[k] - dt);
    if (p.burn > 0 && !p.gone) { p.burn -= dt; if (m.rand() < 0.7) burst(m, p.x, hOf(p) * (0.2 + m.rand() * 0.7), p.z, 1, m.rand() < 0.5 ? '#fb923c' : '#fde047', 'spark', 2.5); if (p.burn <= 0) { p.burn = 0; ash(m, p); } }
  }
  tickRespawn(m, dt);
}
function tickRespawn(m: SoccerMatch, dt: number) {
  for (const p of m.players) if (p.stun > 0 && (p.gone || m.phase === 'play')) { p.stun -= dt; if (p.stun <= 0) { p.stun = 0; p.stunKind = 'none'; if (p.gone) respawn(m, p); } }
}
// Vuelve a entrar el que se murió: en su lugar de la formación, titilando un ratito (no le pasa nada).
function respawn(m: SoccerMatch, p: Player) {
  p.gone = false; p.inv = 1.6; p.x = rel(m, p.team, p.role === 'gk' ? 1.2 : Math.max(3, p.hx - 5)); p.z = p.hz; p.vx = 0; p.vz = 0; p.y = 0; p.slide = 0; p.dive = 0; p.jump = 0; p.burn = 0;
  p.facing = attackDir(m, p.team); p.action = 'idle'; p.actionT = 0;
  burst(m, p.x, 1.2, p.z, 18, CHARS[p.char].glow, 'spark', 5);
}

function endOfHalf(m: SoccerMatch) {
  const [a, b] = [m.teams[0].goals, m.teams[1].goals];
  emit(m, { type: 'whistle', kind: m.half === 1 ? 'half' : 'end' });
  if (m.half === 1) { m.phase = 'halftime'; m.phaseT = 0; m.hazards = []; emit(m, { type: 'halftime' }); return; }
  if (a === b) { m.extra = true; m.extraT = 0; emit(m, { type: 'extra' }); return; } // gol de oro
  m.winner = a > b ? 0 : 1; m.phase = 'end'; m.phaseT = 0; m.hazards = [];
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
  if (p.role === 'gk') { // el arquero con la pelota: pase con X, para arriba bien lejos con ESPACIO
    if (has) {
      const fwd = attackDir(m, p.team), gx = ownGoalX(m, p.team); p.tx = clamp(p.tx, Math.min(gx, gx + fwd * AREA_X), Math.max(gx, gx + fwd * AREA_X)); p.tz = clamp(p.tz, ZC - AREA_W / 2, ZC + AREA_W / 2);
      if (pressed(p, i, 'pass')) pass(m, p, n > 0 ? [dx, dz] : null);
      else if (pressed(p, i, 'kick')) punt(m, p, n > 0 ? [dx, dz] : null);
      else if (p.hold > 6) pass(m, p, null);
    }
    if (pressed(p, i, 'jump')) jump(m, p);
    p.prevIn = { ...i };
    return;
  }
  if (!stunned(p) && p.slide <= 0) {
    // V (patear): con la pelota carga el tiro; sin la pelota, una vez = quite (si está pegado al rival), dos veces seguidas = barrida
    if (pressed(p, i, 'kick')) {
      if (has) { p.chargeOn = true; p.charge = 0; p.kTimer = 0; }
      else if (p.kTimer > 0) { p.kTimer = 0; tackle(m, p, dx, dz, true); }
      else { p.kTimer = TAP_GAP; tackle(m, p, dx, dz, false); }
    }
    if (p.kTimer > 0) p.kTimer = Math.max(0, p.kTimer - dt);
    if (p.chargeOn) {
      if (i.kick) p.charge = Math.min(CHARGE_TIME, p.charge + dt);
      else { p.chargeOn = false; if (m.ball.owner === p.id) shoot(m, p, p.charge / CHARGE_TIME, i.up ? -1 : i.down ? 1 : 0); p.charge = 0; }
    }
    if (pressed(p, i, 'pass')) { if (has) { p.chargeOn = false; p.charge = 0; pass(m, p, n > 0 ? [dx, dz] : null); } else switchPlayer(m, p.team); }
    // C: saltar (para pasar por arriba de la lava; con la pelota, salta con ella)
    if (pressed(p, i, 'jump')) jump(m, p);
  }
  p.prevIn = { ...i };
}
const TAP_GAP = 0.3; // segundos para el segundo toque de la V (barrida)
export function jump(m: SoccerMatch, p: Player) {
  if (p.jump > 0 || p.y > 0.05 || stunned(p) || p.gone || p.slide > 0 || p.dive > 0) return false;
  p.jump = JUMP_T; emit(m, { type: 'jump' });
  return true;
}
function switchPlayer(m: SoccerMatch, team: 0 | 1) {
  const T = m.teams[team], b = m.ball, cur = m.players[T.active];
  const list = m.players.filter(p => p.team === team && p.role !== 'gk' && p !== cur && !p.gone).sort((a, c) => hyp(a.x - b.x, a.z - b.z) - hyp(c.x - b.x, c.z - b.z));
  if (list[0]) { T.active = list[0].id; T.switchT = 0.8; list[0].prevIn = { ...cur.prevIn }; }
}

// ---------------------------------------------------------------- Moverse
function moveP(m: SoccerMatch, p: Player, dt: number) {
  const r = radiusOf(p);
  if (p.dive > 0) { // el arquero volando
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
    const air = p.jump > 0;
    if (!stunned(p) && p.run > 0) {
      const dx = p.tx - p.x, dz = p.tz - p.z, d = hyp(dx, dz);
      let v = speedOf(p.char) * p.run * (m.ball.owner === p.id ? 0.9 : 1) * (p.chargeOn ? 0.55 : 1);
      if (d < 1.2 && !air) v *= d / 1.2; // llega frenando
      if (d > 0.05) { tvx = dx / d * v; tvz = dz / d * v; }
    }
    if (p.burn > 0) { tvx = p.vx; tvz = p.vz; } // (prendido fuego: corre sin control)
    const A = stunned(p) ? 6 : air ? 9 : 34, ax = clamp(tvx - p.vx, -A * dt, A * dt), az = clamp(tvz - p.vz, -A * dt, A * dt);
    p.vx += ax; p.vz += az; p.x += p.vx * dt; p.z += p.vz * dt;
    if (air) { p.jump = Math.max(0, p.jump - dt); p.y = Math.sin((1 - p.jump / JUMP_T) * Math.PI) * JUMP_H; if (p.jump <= 0) p.y = 0; }
    else p.y = Math.max(0, p.y - dt * 5);
    const sp = hyp(p.vx, p.vz);
    if (Math.abs(p.vx) > 0.4) p.facing = p.vx > 0 ? 1 : -1;
    else if (sp < 0.4) p.facing = m.ball.x >= p.x ? 1 : -1;
    setAction(p, stunned(p) ? 'stun' : air ? 'jump' : p.kickT > 0 ? 'kick' : p.chargeOn ? 'charge' : sp > 0.8 ? 'run' : 'idle', dt);
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
  const b = m.ball; b.owner = null; b.last = p.team; b.lastId = p.id; b.receiver = null; b.fx = 'none'; b.comet = false;
  p.noTouch = 0.3; p.kickT = 0.3; p.hold = 0; p.chargeOn = false; p.charge = 0;
  b.x = p.x + p.bdx * 0.7; b.z = p.z + p.bdz * 0.7; b.y = BR + p.y * 0.8;
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
  const sz = side !== 0 ? side : (gk.z < ZC ? 1 : -1), zt = center && side === 0 ? ZC : ZC + sz * GW * 0.34;
  const S = (15 + 15 * charge) * strengthOf(p.char), dx = gx - b.x, dz = zt - b.z, d = Math.max(1, hyp(dx, dz)), T = d / S;
  const px = -dz / d, pz = dx / d; // perpendicular a la dirección del tiro
  const spin = side !== 0 ? side * Math.sign(pz || 1) : 0;
  const dev = 0.5 * 9 * spin * Math.min(1, S / 18) * T * T; // cuánto se va a abrir la curva
  let ax = gx - px * dev - b.x, az = zt - pz * dev - b.z;
  const err = (m.rand() - 0.5) * 2 * (0.025 + 0.07 * charge * charge) * wild, ca = Math.cos(err), sa = Math.sin(err);
  [ax, az] = [ax * ca - az * sa, ax * sa + az * ca];
  const n = hyp(ax, az), ht = Math.min(GH - 0.5, 0.45 + charge * 1.5 + m.rand() * 0.4);
  b.vx = ax / n * S; b.vz = az / n * S;
  b.vy = clamp((ht - b.y) / T + 0.5 * G * T * 0.8, 1.2, 8.5) + (charge > 0.92 ? m.rand() * 2.6 : 0);
  b.spin = spin; b.comet = charge >= 0.7; b.fx = b.comet ? 'fire' : 'none'; b.shot = ++m.shots; b.shooter = p.team; // (bien cargado: sale como un cometa de fuego)
  launchFrom(m, p);
  emit(m, { type: 'kick', power: charge });
}
// El arquero la tira para arriba, bien lejos (hacia donde apunta o para adelante).
export function punt(m: SoccerMatch, p: Player, dir: [number, number] | null) {
  const b = m.ball, fwd = attackDir(m, p.team);
  let [dx, dz] = dir ?? [fwd, 0]; if (dx * fwd < 0.2) { dx = fwd * 0.8; dz = Math.sign(dz) * 0.6; }
  const n = hyp(dx, dz); release(m, p);
  b.vx = dx / n * 19; b.vz = dz / n * 19; b.vy = 11.5; b.y = 1.2; launchFrom(m, p); p.protect = 0;
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
  const d0 = hyp(best.x - p.x, best.z - p.z), S = clamp(9 + d0 * 0.95, 12, 26), T = d0 / S;
  const lead = isHuman(m, best.team) ? 0.25 : 0.6; // (el de la persona frena y la espera)
  const tx = clamp(best.x + best.vx * T * lead, 1, L - 1), tz = clamp(best.z + best.vz * T * lead, 1, D - 1);
  release(m, p);
  const dx = tx - b.x, dz = tz - b.z, d = Math.max(0.5, hyp(dx, dz));
  const lob = laneRisk(m, p, best) > 0.75 && d > 8; // muy tapado: por arriba
  const s2 = lob ? S * 0.8 : S;
  b.vx = dx / d * s2; b.vz = dz / d * s2; b.vy = lob ? 0.5 * G * (d / s2) * 0.92 : 0;
  b.receiver = best.id; best.tx = tx; best.tz = tz;
  launchFrom(m, p);
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
// Quite (cerca del que tiene la pelota) o barrida (corriendo). A uno que está saltando no se le puede sacar.
export function tackle(m: SoccerMatch, p: Player, dx = 0, dz = 0, slide = true) {
  if (p.tackleCd > 0 && !slide) return;
  if (slide && p.slide > 0) return;
  if (p.jump > 0) return;
  const c = carrier(m);
  if (c && c.team !== p.team && c.role !== 'gk' && c.y < 0.4 && hyp(c.x - p.x, c.z - p.z) < 1.7 + radiusOf(c)) {
    p.tackleCd = 0.55;
    const ok = c.protect <= 0 && m.rand() < 0.55 + (strengthOf(p.char) - strengthOf(c.char)) * 0.6;
    if (ok) { m.ball.owner = p.id; m.ball.last = p.team; p.protect = 0.7; p.hold = 0; c.noTouch = 0.5; c.stun = 0.3; c.stunKind = 'hit'; c.chargeOn = false; }
    else { p.stun = 0.3; p.stunKind = 'none'; }
    emit(m, { type: 'tackle', ok });
    return;
  }
  if (!slide) return; // (la barrida sale con dos toques)
  const sp = hyp(p.vx, p.vz);
  if (dx === 0 && dz === 0) { if (sp > 1) { dx = p.vx / sp; dz = p.vz / sp; } else { const bx = m.ball.x - p.x, bz = m.ball.z - p.z, bd = hyp(bx, bz) || 1; dx = bx / bd; dz = bz / bd; } }
  p.slide = 0.55; p.sdx = dx; p.sdz = dz; p.tackleCd = 1.1;
}
function slideHits(m: SoccerMatch, p: Player) {
  const b = m.ball, c = carrier(m);
  if (c && c.team !== p.team && c.role !== 'gk' && c.y < 0.4 && hyp(c.x - p.x, c.z - p.z) < 1.15 + radiusOf(c)) {
    b.owner = null; b.vx = p.sdx * 7 + (m.rand() - 0.5) * 3; b.vz = p.sdz * 7 + (m.rand() - 0.5) * 3; b.vy = 2.5; b.last = p.team; b.lastId = p.id; b.receiver = null;
    c.stun = 0.9; c.stunKind = 'hit'; c.noTouch = 0.6; c.chargeOn = false; c.vx += p.sdx * 3; c.vz += p.sdz * 3;
    emit(m, { type: 'tackle', ok: true }); m.shake = Math.max(m.shake, 0.3);
  } else if (b.owner === null && b.y < 1 && hyp(b.x - p.x, b.z - p.z) < 1.1) {
    b.vx = p.sdx * 9 + b.vx * 0.2; b.vz = p.sdz * 9 + b.vz * 0.2; b.vy = 1.5; b.last = p.team; b.lastId = p.id; b.receiver = null; p.noTouch = 0.25;
  }
}

// ---------------------------------------------------------------- Morirse (por el escenario)
// Si tenía la pelota, la suelta (cerca de su arco, cae para el lado de la cancha).
function dropBall(m: SoccerMatch, q: Player) {
  const b = m.ball; if (b.owner !== q.id) return;
  b.owner = null; const a = m.rand() * Math.PI * 2, nearOwn = Math.abs(q.x - ownGoalX(m, q.team)) < 12;
  b.vx = nearOwn ? attackDir(m, q.team) * (2.5 + m.rand() * 2) : Math.cos(a) * 4; b.vz = Math.sin(a) * 4; b.vy = 4.5; b.y = Math.max(b.y, 0.8);
  b.last = q.team; b.lastId = q.id; b.receiver = null;
}
function goneFor(q: Player) { q.gone = true; q.stun = q.role === 'gk' ? 2.4 : 3.2; q.stunKind = 'hit'; q.chargeOn = false; q.charge = 0; q.slide = 0; q.dive = 0; q.vx = 0; q.vz = 0; q.jump = 0; q.burn = 0; q.y = 0; }
const humanActive = (m: SoccerMatch, q: Player) => isHuman(m, q.team) && m.teams[q.team].active === q.id;
// Explota en sangre y huesos (el ovni y los meteoritos).
export function explode(m: SoccerMatch, q: Player, el: Element | null = null, screen = false) {
  const h = hOf(q), G2 = m.gore;
  dropBall(m, q);
  for (let i = 0; i < 46; i++) { const a = m.rand() * Math.PI * 2, sp = 2 + m.rand() * 8; G2.drops.push({ x: q.x, y: h * (0.3 + m.rand() * 0.6), z: q.z, vx: Math.cos(a) * sp, vy: 3 + m.rand() * 9, vz: Math.sin(a) * sp * 0.8, r: 0.05 + m.rand() * 0.09 }); }
  const kinds: GibKind[] = ['skull', 'ribs', 'pelvis', 'jaw', 'bone', 'bone', 'bone', 'bone', 'chunk', 'chunk', 'plate', 'plate'];
  for (const kind of kinds) { const a = m.rand() * Math.PI * 2, sp = 2.5 + m.rand() * 6; G2.gibs.push({ x: q.x, y: h * (0.3 + m.rand() * 0.5), z: q.z, vx: Math.cos(a) * sp, vy: 4 + m.rand() * 7, vz: Math.sin(a) * sp * 0.8, a: m.rand() * 6, va: (m.rand() - 0.5) * 18, kind, life: 0, c: CHARS[q.char].color }); }
  trimGore(m);
  G2.stains.push({ x: q.x, z: q.z, r: 0.9 + m.rand() * 0.4, t: 0, seed: m.rand() * 100 });
  if (el) burst(m, q.x, h * 0.5, q.z, 10, el === 'fire' ? '#fb923c' : el === 'volt' ? '#fde047' : el === 'ice' ? '#bae6fd' : el === 'toxic' ? '#4ade80' : el === 'dark' ? '#c084fc' : '#fbbf24', 'spark', 7);
  if (screen || humanActive(m, q)) splatScreen(m);
  goneFor(q);
  m.shake = Math.max(m.shake, 0.7); m.flash = Math.max(m.flash, 0.25);
  emit(m, { type: 'explode', side: q.team, char: q.char, keeper: q.role === 'gk' });
}
// (al que maneja la persona: unas gotas en la pantalla, en los bordes para que se siga viendo la cancha)
function splatScreen(m: SoccerMatch) { for (let k = 0; k < 3; k++) { const left = m.rand() < 0.5; m.screenBlood.push({ x: left ? 0.04 + m.rand() * 0.16 : 0.8 + m.rand() * 0.16, y: 0.25 + m.rand() * 0.55, r: 0.025 + m.rand() * 0.03, t: -k * 0.05, seed: m.rand() * 100, drips: 2 + Math.floor(m.rand() * 3) }); } }
function trimGore(m: SoccerMatch) {
  const G2 = m.gore;
  if (G2.drops.length > 500) G2.drops.splice(0, G2.drops.length - 500);
  if (G2.gibs.length > 90) G2.gibs.splice(0, G2.gibs.length - 90);
}
// Se lo come el tiburón: desaparece entre los dientes y salpica sangre.
function eaten(m: SoccerMatch, q: Player, h: Hazard) {
  dropBall(m, q);
  const G2 = m.gore, y = Math.max(0.6, h.y);
  for (let i = 0; i < 36; i++) { const a = m.rand() * Math.PI * 2, sp = 1.5 + m.rand() * 5; G2.drops.push({ x: q.x, y: y * (0.6 + m.rand() * 0.6), z: q.z, vx: Math.cos(a) * sp + h.vx * 0.3, vy: 1 + m.rand() * 5, vz: Math.sin(a) * sp * 0.8 + h.vz * 0.3, r: 0.05 + m.rand() * 0.08 }); }
  trimGore(m);
  G2.stains.push({ x: q.x, z: q.z, r: 0.7 + m.rand() * 0.3, t: 0, seed: m.rand() * 100 });
  if (humanActive(m, q)) splatScreen(m);
  goneFor(q);
  m.shake = Math.max(m.shake, 0.5);
  emit(m, { type: 'eaten', side: q.team, char: q.char });
}
// Pisó la lava: se prende fuego (corre sin control un ratito) y después queda hecho cenizas.
function ignite(m: SoccerMatch, q: Player) {
  if (q.burn > 0 || q.gone) return;
  dropBall(m, q);
  q.burn = 1.25; q.stun = 1.25; q.stunKind = 'burn'; q.chargeOn = false; q.charge = 0; q.slide = 0; q.dive = 0;
  burst(m, q.x, 0.4, q.z, 16, '#fb923c', 'spark', 5);
  emit(m, { type: 'burn', side: q.team });
}
function ash(m: SoccerMatch, q: Player) {
  const h = hOf(q), G2 = m.gore;
  for (let k = 0; k < 18; k++) { const a = m.rand() * Math.PI * 2, s = 0.6 + m.rand() * 1.6; m.particles.push({ x: q.x, y: h * m.rand(), z: q.z, vx: Math.cos(a) * s, vy: 0.5 + m.rand() * 1.5, vz: Math.sin(a) * s * 0.6, life: 0, max: 1 + m.rand() * 0.8, size: 0.25 + m.rand() * 0.3, color: '#3f3f46', kind: 'smoke' }); }
  burst(m, q.x, h * 0.5, q.z, 14, '#f97316', 'spark', 4);
  for (const kind of ['skull', 'bone', 'bone', 'ribs'] as GibKind[]) { const a = m.rand() * Math.PI * 2, sp = 0.8 + m.rand() * 1.5; G2.gibs.push({ x: q.x, y: h * 0.4, z: q.z, vx: Math.cos(a) * sp, vy: 1.5 + m.rand() * 2, vz: Math.sin(a) * sp * 0.8, a: m.rand() * 6, va: (m.rand() - 0.5) * 8, kind, life: 0, c: '#27272a' }); }
  trimGore(m);
  goneFor(q);
  emit(m, { type: 'ash', side: q.team });
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
  for (const c of m.scorch) c.t += dt; m.scorch = m.scorch.filter(c => c.t < 14);
}

// ---------------------------------------------------------------- Los peligros
const canDie = (p: Player) => !p.gone && p.inv <= 0;
// A quién va: a uno de campo al azar (cada tanto, al arquero); si se puede, a uno que no esté ya perseguido.
// Siempre uno que se vea en la pantalla (cerca de donde está la cámara), así se ve lo que le pasa.
function pickVictim(m: SoccerMatch): Player | null {
  const taken = new Set(m.hazards.map(h => h.target)), seen = (p: Player) => Math.abs(p.x - m.cam.x) < 11;
  let list = m.players.filter(p => canDie(p) && p.role !== 'gk' && !taken.has(p.id) && seen(p));
  if (m.rand() < 0.12 || !list.length) list = m.players.filter(p => canDie(p) && !taken.has(p.id) && seen(p));
  if (!list.length) list = m.players.filter(p => canDie(p) && !taken.has(p.id));
  return list.length ? list[Math.floor(m.rand() * list.length)] : null;
}
const inLava = (h: Hazard, x: number, z: number, grow = 0) => ((x - h.x) / (h.r + grow)) ** 2 + ((z - h.z) / (h.rz + grow)) ** 2 < 1;
export function spawnHazard(m: SoccerMatch, kind?: HazardKind): Hazard | null {
  if (!kind) {
    const lavas = m.hazards.filter(h => h.kind === 'lava').length, ufos = m.hazards.filter(h => h.kind === 'ufo').length;
    const opts = HAZARD_KINDS.filter(k => k !== m.lastHazard && !(k === 'lava' && lavas >= 2) && !(k === 'ufo' && ufos >= 1));
    kind = opts[Math.floor(m.rand() * opts.length)] ?? 'meteor';
  }
  const v = kind === 'lava' ? null : pickVictim(m);
  if (kind !== 'lava' && !v) return null;
  const h: Hazard = { id: ++m.hazardN, kind, stage: 0, t: 0, st: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, tx: 0, tz: 0, target: v?.id ?? null, r: 1, rz: 1, seed: m.rand() * 100, react: 0.25 + m.rand() * 0.9, caught: null, sharkType: 0, done: false };
  if (kind === 'shark') { // entra volando por el costado de la pantalla más lejano
    const side = v!.x < m.cam.x ? 1 : -1;
    h.x = v!.x + side * 26; h.y = SHARK_H + 1.5; h.z = clamp(v!.z + (m.rand() - 0.5) * 8, 2, D - 2); h.vx = -side * 12; h.sharkType = Math.floor(m.rand() * 3) as 0 | 1 | 2;
  } else if (kind === 'lava') { // en un lugar libre de la cancha (lejos de los arcos y de otros lagos)
    h.r = 2.4 + m.rand() * 1.4; h.rz = h.r * (0.62 + m.rand() * 0.2);
    let ok = false;
    for (let k = 0; k < 14 && !ok; k++) {
      h.x = clamp(m.cam.x + (m.rand() - 0.5) * 30, 6 + h.r, L - 6 - h.r); h.z = 2 + h.rz + m.rand() * (D - 4 - h.rz * 2);
      ok = !m.hazards.some(o => o.kind === 'lava' && hyp(o.x - h.x, o.z - h.z) < o.r + h.r + 1.5) && hyp(m.ball.x - h.x, m.ball.z - h.z) > h.r + 1.5;
    }
    if (!ok) return null;
  } else if (kind === 'ufo') {
    h.x = v!.x; h.y = UFO_H + 9; h.z = v!.z; h.r = 1.45;
  } else { // meteorito: cerca del elegido (un poco adelante de donde corre)
    h.r = 1.9; h.tx = clamp(v!.x + v!.vx * 0.6 + (m.rand() - 0.5) * 2, 1, L - 1); h.tz = clamp(v!.z + v!.vz * 0.6 + (m.rand() - 0.5) * 2, 1, D - 1);
    const side = m.rand() < 0.5 ? -1 : 1; h.x = h.tx + side * 8; h.y = 13; h.z = h.tz - 3;
  }
  m.hazards.push(h); m.lastHazard = kind;
  emit(m, { type: 'hazard', kind });
  return h;
}
function updateHazards(m: SoccerMatch, dt: number) {
  if (m.phase === 'play' && !m.noHazards) {
    m.hazardT -= dt;
    if (m.hazardT <= 0) {
      m.hazardT = HAZARD_GAP[0] + m.rand() * (HAZARD_GAP[1] - HAZARD_GAP[0]);
      if (m.hazards.length < HAZARD_MAX) spawnHazard(m);
    }
  }
  for (const h of m.hazards) {
    h.t += dt; h.st += dt;
    if (h.kind === 'shark') sharkStep(m, h, dt);
    else if (h.kind === 'lava') lavaStep(m, h);
    else if (h.kind === 'ufo') ufoStep(m, h, dt);
    else meteorStep(m, h);
  }
  m.hazards = m.hazards.filter(h => !h.done);
}
const next = (h: Hazard) => { h.stage++; h.st = 0; };
// El tiburón: persigue desde arriba, se tira en picada adonde va a estar y pasa rozando el piso con la boca abierta.
function sharkStep(m: SoccerMatch, h: Hazard, dt: number) {
  const v = h.target !== null ? m.players[h.target] : null;
  if (h.stage === 0) { // persigue
    if (!v || v.gone) { h.target = pickVictim(m)?.id ?? null; if (h.target === null) { h.stage = 2; h.st = 0; } return; }
    const want = Math.min(15, 6 + h.t * 6), dx = v.x - h.x, dz = v.z - h.z, d = hyp(dx, dz) || 1;
    h.vx += (dx / d * want - h.vx) * Math.min(1, dt * 2.2); h.vz += (dz / d * want - h.vz) * Math.min(1, dt * 2.2);
    h.x += h.vx * dt; h.z += h.vz * dt; h.y += (SHARK_H - h.y) * Math.min(1, dt * 2);
    if (h.t > 7) { h.stage = 2; h.st = 0; h.vy = 3; return; } // (no lo alcanzó: se va)
    if (h.t > 1.5 && d < 7) { // se tira: apunta adonde va a estar el jugador
      h.tx = v.x + v.vx * SHARK_DIVE * 0.8; h.tz = v.z + v.vz * SHARK_DIVE * 0.8;
      const ex = h.tx - h.x, ez = h.tz - h.z, e = hyp(ex, ez) || 1, sp = Math.max(9, e / SHARK_DIVE);
      h.vx = ex / e * sp; h.vz = ez / e * sp; h.vy = (0.85 - h.y) / SHARK_DIVE;
      next(h); emit(m, { type: 'dive' });
    }
    return;
  }
  h.x += h.vx * dt; h.z += h.vz * dt; h.y += h.vy * dt;
  if (h.stage === 1) { // en picada y rozando el piso: se come al primero que agarra con la boca
    if (h.y <= 0.85) { h.y = 0.85; h.vy = 0; }
    if (h.caught === null) {
      const sp = hyp(h.vx, h.vz) || 1, hx = h.x + h.vx / sp * 1.3, hz = h.z + h.vz / sp * 1.3;
      for (const p of m.players) if (canDie(p) && p.y < 1.7 && h.y < 2.6 && hyp(p.x - hx, p.z - hz) < 0.95 + radiusOf(p)) { h.caught = p.id; eaten(m, p, h); break; }
    }
    if (h.st > SHARK_DIVE + 0.4) { next(h); h.vy = 7; }
    return;
  }
  h.vy += 4 * dt; // se va para arriba y afuera
  if (h.y > 16 || h.x < -30 || h.x > L + 30) h.done = true;
}
function lavaStep(m: SoccerMatch, h: Hazard) {
  if (h.stage === 0 && h.st >= LAVA_T.warn) { next(h); m.shake = Math.max(m.shake, 0.25); }
  else if (h.stage === 1) {
    for (const p of m.players) if (canDie(p) && p.y < 0.3 && p.burn <= 0 && inLava(h, p.x, p.z, -0.15)) ignite(m, p);
    if (h.st >= LAVA_T.hot) next(h);
  } else if (h.stage === 2 && h.st >= LAVA_T.cool) h.done = true;
}
function ufoStep(m: SoccerMatch, h: Hazard, dt: number) {
  const v = h.target !== null ? m.players[h.target] : null;
  if (h.stage === 0) { // baja y lo sigue desde arriba (un poco atrasado)
    if (!v || v.gone) { const nv = pickVictim(m); h.target = nv?.id ?? null; if (!nv) { h.stage = 3; h.st = 0; } return; }
    const dx = v.x - h.x, dz = v.z - h.z, d = hyp(dx, dz), sp = Math.min(7.5, d * 2.5);
    if (d > 0.01) { h.x += dx / d * sp * dt; h.z += dz / d * sp * dt; }
    h.y += (UFO_H - h.y) * Math.min(1, dt * 2.4);
    if (h.st >= UFO_T.follow) { next(h); h.tx = h.x; h.tz = h.z; }
  } else if (h.stage === 1) { // se frena y carga: la marca en el piso
    if (h.st >= UFO_T.charge) {
      next(h); emit(m, { type: 'beam' });
      for (const p of m.players) if (canDie(p) && p.y < 2 && hyp(p.x - h.tx, p.z - h.tz) < h.r + radiusOf(p)) explode(m, p, 'volt');
      m.fx.push({ kind: 'nova', x: h.tx, y: 0.3, z: h.tz, x2: h.r * 1.6, y2: 0, z2: 0, t: 0, life: 0.6, color: '#5ef3ff' });
      burst(m, h.tx, 0.4, h.tz, 22, '#7dfcff', 'spark', 6); m.shake = Math.max(m.shake, 0.5);
    }
  } else if (h.stage === 2) { if (h.st >= UFO_T.beam) next(h); }
  else { h.y += (4 + h.st * 14) * dt; h.x += 6 * dt; if (h.st >= UFO_T.leave) h.done = true; }
}
function meteorStep(m: SoccerMatch, h: Hazard) {
  if (h.stage !== 0) return;
  if (h.st >= METEOR_T) { // ¡impacto!
    h.done = true;
    for (const p of m.players) if (canDie(p) && hyp(p.x - h.tx, p.z - h.tz) < h.r + radiusOf(p)) explode(m, p, 'fire');
    const b = m.ball, bd = hyp(b.x - h.tx, b.z - h.tz);
    if (b.owner === null && bd < 3.5) { const k2 = (3.5 - bd) / 3.5 * 12, nx = (b.x - h.tx) / (bd || 1), nz = (b.z - h.tz) / (bd || 1); b.vx += nx * k2; b.vz += nz * k2; b.vy = Math.max(b.vy, 5 * k2 / 12 + 2); b.receiver = null; }
    m.fx.push({ kind: 'boom', x: h.tx, y: 0.4, z: h.tz, x2: 0, y2: 0, z2: 0, t: 0, life: 0.7, color: '#fb923c' });
    m.fx.push({ kind: 'nova', x: h.tx, y: 0.3, z: h.tz, x2: h.r * 2.1, y2: 0, z2: 0, t: 0, life: 0.8, color: '#f97316' });
    burst(m, h.tx, 0.4, h.tz, 30, '#fb923c', 'spark', 9); burst(m, h.tx, 0.3, h.tz, 12, '#78716c', 'shard', 7);
    for (let k3 = 0; k3 < 10; k3++) { const a = m.rand() * Math.PI * 2, s = 0.8 + m.rand() * 1.8; m.particles.push({ x: h.tx, y: 0.3, z: h.tz, vx: Math.cos(a) * s, vy: 1 + m.rand() * 2, vz: Math.sin(a) * s * 0.6, life: 0, max: 1.2 + m.rand(), size: 0.35 + m.rand() * 0.35, color: '#57534e', kind: 'smoke' }); }
    m.scorch.push({ x: h.tx, z: h.tz, r: h.r * 0.95, t: 0, seed: h.seed });
    m.shake = Math.max(m.shake, 0.9); m.flash = Math.max(m.flash, 0.3);
    emit(m, { type: 'impact' });
  }
}
// Dónde está el meteorito mientras cae (en línea recta desde el cielo hasta la marca).
export function meteorPos(h: Hazard): [number, number, number] {
  const k = Math.min(1, h.st / METEOR_T), e = Math.pow(k, 1.6); // (acelera al caer)
  return [h.x + (h.tx - h.x) * e, h.y * (1 - e), h.z + (h.tz - h.z) * e];
}
// Los de la máquina (y los compañeros de la persona) esquivan: rodean la lava (o la saltan si ya están en el
// borde) y salen corriendo de las marcas del ovni y del meteorito y de abajo del tiburón (con un poco de demora,
// así a veces no llegan).
function avoidHazards(m: SoccerMatch, p: Player) {
  if (p.gone || p.dive > 0 || p.burn > 0) return;
  for (const h of m.hazards) {
    if (h.kind === 'lava' && h.stage < 2) {
      if (inLava(h, p.x, p.z, 0.9)) { // adentro o en el borde: para afuera (y si la lava ya quema y está en el borde, salta)
        const dx = p.x - h.x, dz = p.z - h.z, d = hyp(dx / h.r, dz / h.rz) || 1;
        p.tx = h.x + dx / d * (1 + 2.6 / h.r); p.tz = h.z + dz / d * (1 + 2.6 / h.rz); p.run = 1;
        if (h.stage === 1 && inLava(h, p.x + p.vx * 0.2, p.z + p.vz * 0.2, 0.1) && p.jump <= 0 && h.t > h.react) jump(m, p);
        continue;
      }
      const dx = p.tx - p.x, dz = p.tz - p.z, d = hyp(dx, dz);
      if (d < 0.3) continue;
      const look = Math.min(d, 3.2), ax = p.x + dx / d * look, az = p.z + dz / d * look;
      if (inLava(h, ax, az, 0.9)) { // la rodea: gira para el lado que queda más lejos del centro
        const side = (dx * (h.z - p.z) - dz * (h.x - p.x)) > 0 ? -1 : 1;
        p.tx = p.x + (dx / d * 0.35 - dz / d * side) * 3; p.tz = p.z + (dz / d * 0.35 + dx / d * side) * 3; p.run = Math.max(p.run, 0.9);
      }
    } else if ((h.kind === 'meteor' && h.stage === 0) || (h.kind === 'ufo' && (h.stage === 1 || (h.stage === 0 && h.target === p.id && h.st > UFO_T.follow - 0.4)))) {
      const cx = h.kind === 'meteor' ? h.tx : h.stage === 1 ? h.tx : h.x, cz = h.kind === 'meteor' ? h.tz : h.stage === 1 ? h.tz : h.z;
      const d = hyp(p.x - cx, p.z - cz);
      if (h.st > h.react && d < h.r + 1.4) { const k = d || 1; p.tx = p.x + (p.x - cx) / k * 4; p.tz = p.z + (p.z - cz) / k * 4; if (d < 0.01) p.tz = p.z + 4; p.run = 1; }
    } else if (h.kind === 'shark' && h.stage < 2 && (h.target === p.id || h.stage === 1)) {
      const d = hyp(p.x - h.x, p.z - h.z);
      if (d < 7 && h.t > 1 + h.react) { const sp = hyp(h.vx, h.vz) || 1, side = ((p.x - h.x) * -h.vz + (p.z - h.z) * h.vx) > 0 ? 1 : -1; p.tx = p.x - h.vz / sp * side * 4; p.tz = p.z + h.vx / sp * side * 4; p.run = 1; }
    }
  }
  p.tx = clamp(p.tx, 0.5, L - 0.5); p.tz = clamp(p.tz, 0.5, D - 0.5);
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
  if (b.receiver !== null && sp < 1) b.receiver = null;
  passAssist(m, dt);
  if (b.comet && sp < 9) { b.comet = false; b.fx = 'none'; }
  if (b.comet && m.rand() < 0.8) burst(m, b.x - b.vx * 0.02, b.y, b.z - b.vz * 0.02, 2, m.rand() < 0.5 ? '#fb923c' : '#fde047', 'spark', 2);
  if (sp > 11 && m.phase === 'play') { m.trail.unshift([b.x, b.y, b.z]); if (m.trail.length > (b.comet ? 26 : 12)) m.trail.pop(); } else if (m.trail.length) m.trail.pop();
  walls(m);
  if (m.phase === 'play') { checkGoal(m); touches(m); }
}
// Pegada al pie, adelante del que la lleva (si salta, salta con ella).
function carry(m: SoccerMatch, dt: number) {
  const b = m.ball, p = m.players[b.owner!];
  b.comet = false; if (m.trail.length) m.trail.pop();
  if (p.role === 'gk') { b.x = p.x + p.facing * 0.35; b.z = p.z + 0.15; b.y = hOf(p) * 0.45 + p.y; b.vx = p.vx; b.vz = p.vz; b.vy = 0; p.hold += dt; return; } // (cuenta el tiempo: a los segundos la saca)
  const off = 0.45 + radiusOf(p) + Math.abs(Math.sin(m.time * 9)) * 0.08, sp = hyp(p.vx, p.vz);
  const nx = clamp(p.x + p.bdx * off, BR, L - BR), nz = clamp(p.z + p.bdz * off, BR, D - BR);
  b.vx = (nx - b.x) / Math.max(dt, 1e-3); b.vz = (nz - b.z) / Math.max(dt, 1e-3);
  if (hyp(b.vx, b.vz) > 30) { b.vx = p.vx; b.vz = p.vz; }
  b.x = nx; b.z = nz; b.y = BR + p.y * 0.85; b.vy = 0; b.spin = 0; b.roll += sp * dt / BR; b.fx = 'none';
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
      m.teams[side].goals++; m.lastGoal = { side };
      netHit(m, left); m.shake = 0.6; m.flash = 0.4;
      emit(m, { type: 'goal', side, scorer: scorerP ? scorerP.char : m.teams[side].captain, own });
      m.phase = 'goal'; m.phaseT = 0;
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
    if (p.gone || p.noTouch > 0 || p.stun > 0 || p.slide > 0 || p.burn > 0) continue;
    const d = hyp(p.x - b.x, p.z - b.z), h = hOf(p);
    if (p.role === 'gk') { if (keeperTouch(m, p, d)) return; continue; }
    const reach = 0.55 + radiusOf(p) + Math.min(0.3, sp * 0.015);
    if (d < reach && b.y - p.y < h * 1.05 && b.y > p.y - 0.3 && d < bd) { bd = d; best = p; }
  }
  if (!best) return;
  const p = best, relv = hyp(b.vx - p.vx, b.vz - p.vz), h = hOf(p), by = b.y - p.y;
  const mine = b.receiver === p.id; // (el pase era para él: la recibe siempre)
  if (by < 1.05 || relv < 7 || mine) { // la controla
    if (relv < 17 || mine || m.rand() < 0.4) {
      b.owner = p.id; b.receiver = null; b.spin = 0; b.fx = 'none'; b.comet = false; b.last = p.team; b.lastId = p.id; p.hold = 0; p.protect = 0.25;
      const dx = b.x - p.x, dz = b.z - p.z, d = hyp(dx, dz); if (d > 0.1) { p.bdx = dx / d; p.bdz = dz / d; }
      if (relv > 8) emit(m, { type: 'control' });
    } else { b.vx = b.vx * -0.25 + p.vx; b.vz = b.vz * -0.25 + p.vz; b.vy = 2; p.noTouch = 0.3; b.last = p.team; b.lastId = p.id; emit(m, { type: 'bounce', power: 0.5 }); }
  } else if (by > h * 0.55) { // cabezazo: al arco si está cerca, si no para adelante
    const gx = oppGoalX(m, p.team), dg = hyp(gx - b.x, ZC - b.z), at = dg < 18;
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
  if (d > reach || b.y > h * 1.2 + p.y + (diving ? 0.4 : 0)) return false;
  if (diving && !p.save && d > 0.45) return false; // se tiró pero no llegó
  if (b.last === p.team && sp < 6) { b.owner = p.id; b.last = p.team; b.lastId = p.id; b.receiver = null; p.hold = 0; return true; } // un pase atrás de un compañero
  const lv = levelOf(m, p.team), catchP = clamp(1.25 - sp / 26 + lv * 0.1, 0.25, 0.97);
  if (m.rand() < catchP) { b.owner = p.id; b.last = p.team; b.lastId = p.id; b.receiver = null; b.spin = 0; b.fx = 'none'; p.hold = 0; p.protect = 9; }
  else { // la rechaza al costado
    const side = Math.sign(b.z - ZC) || (m.rand() < 0.5 ? -1 : 1), out = attackDir(m, p.team);
    b.vx = out * (5 + m.rand() * 4); b.vz = side * (6 + m.rand() * 4); b.vy = 3 + m.rand() * 2; b.spin = 0; b.last = p.team; b.lastId = p.id; b.receiver = null; p.noTouch = 0.5;
  }
  if (sp > 8) emit(m, { type: 'save', side: p.team });
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
  if (free && dBall < 8.5 && Math.abs(b.z - ZC) < AREA_W / 2 && hyp(b.vx, b.vz) < 9 && b.last !== null) { // sale a buscarla
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
      if (onTarget) {
        const prob = clamp(1.2 - (sp - 14) / 45 - Math.abs(dz) * 0.07 + (lv - 0.5) * 0.35 - (b.spin !== 0 ? 0.08 : 0), 0.15, 0.95);
        p.save = Math.abs(dz) < 0.6 && yp < hOf(p) ? true : m.rand() < prob; p.aimZ = clamp(zp, ZC - GW / 2 - 0.3, ZC + GW / 2 + 0.3); p.aimT = t + 0.3;
      }
    }
  }
  // se tira a último momento (si no llega caminando)
  if (free && p.aimT > 0 && p.dive <= 0 && b.vx * out < -4) {
    const t = (p.x - b.x) / b.vx, dz = p.aimZ - p.z;
    if (t > 0 && t < 0.42 && Math.abs(dz) > 0.5 + radiusOf(p) * 0.5) { p.dive = 0.6; p.diveVz = clamp(dz / Math.max(0.18, t), -11, 11) * (p.save ? 1 : 0.5); p.diveVx = 0; }
  }
  if (p.aimT > 0) tz = p.aimZ; // se para donde va a llegar el tiro
  p.tx = tx; p.tz = tz; p.run = hyp(tx - p.x, tz - p.z) > 0.3 ? 1 : 0;
  void dt;
}
// Los de campo: con la pelota encara, pasa o tira; los compañeros se desmarcan; sin la pelota, el más cercano
// presiona, otro cubre y el resto se acomoda.
function brain(m: SoccerMatch, p: Player, dt: number) {
  const b = m.ball, c = carrier(m), lv = levelOf(m, p.team), cpu = !isHuman(m, p.team);
  if (stunned(p) || p.slide > 0) { p.run = 0; return; }
  p.aiT -= dt;
  if (c === p) { carrierAI(m, p, lv, cpu); return; }
  const dir = attackDir(m, p.team), bxr = rel(m, p.team, b.x);
  const home = (shift: number) => { const rx = clamp(p.hx + shift + (bxr - L / 2) * 0.5, 3, L - 4); return [rel(m, p.team, rx), p.hz + (b.z - ZC) * 0.25] as const; };
  let tx: number, tz: number, run = 1;
  if (c && c.team === p.team) { // atacamos: a los espacios, adelante de la pelota
    [tx, tz] = home(p.role === 'fwd' ? 7 : 5);
    if (p.role === 'fwd') { tx = clamp(rel(m, p.team, Math.max(rel(m, p.team, c.x) + 6, p.hx + 6)), 2, L - 2); }
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
    const range = 12 + STATS[p.char].strength / 100 * 6, lane = shotLaneBlocked(m, p, gx);
    if (dg < range && Math.abs(p.z - ZC) < 9 && p.hold > 0.3 && (!lane || dg < 7 || m.rand() < 0.25)) {
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
  const dx = tx - r.x, dz = tz - r.z, d = hyp(dx, dz), v = d > 1.5 ? 6.6 : 0;
  r.vx += ((d ? dx / d * v : 0) - r.vx) * Math.min(1, dt * 5); r.vz += ((d ? dz / d * v : 0) - r.vz) * Math.min(1, dt * 5);
  r.x += r.vx * dt; r.z += r.vz * dt;
  const sp = hyp(r.vx, r.vz), a = sp > 0.6 ? 'run' : m.phase === 'goal' || (m.phase === 'intro' && m.phaseT > m.introLen - 0.6) ? 'whistle' : 'idle';
  if (r.action !== a) { r.action = a; r.actionT = 0; } else r.actionT += dt;
  if (Math.abs(r.vx) > 0.3) r.facing = r.vx > 0 ? 1 : -1; else r.facing = b.x > r.x ? 1 : -1;
}
export function burst(m: SoccerMatch, x: number, y: number, z: number, n: number, color: string, kind: SParticle['kind'], speed: number) {
  for (let i = 0; i < n; i++) { const a = m.rand() * Math.PI * 2, s = speed * (0.4 + m.rand() * 0.6); m.particles.push({ x, y, z, vx: Math.cos(a) * s, vy: m.rand() * speed, vz: Math.sin(a) * s * 0.6, life: 0, max: 0.4 + m.rand() * 0.4, size: 0.08 + m.rand() * 0.1, color, kind }); }
  if (m.particles.length > 320) m.particles.splice(0, m.particles.length - 320);
}
function updateFx(m: SoccerMatch, dt: number) {
  for (const e of m.fx) e.t += dt; m.fx = m.fx.filter(e => e.t < e.life);
  for (const p of m.particles) { p.life += dt; p.vy -= (p.kind === 'smoke' ? -1 : 9) * dt; p.x += p.vx * dt; p.y = Math.max(0, p.y + p.vy * dt); p.z += p.vz * dt; }
  m.particles = m.particles.filter(p => p.life < p.max);
}
export const soccerClock = (s: number) => `${String(Math.floor(Math.ceil(s) / 60)).padStart(2, '0')}:${String(Math.ceil(s) % 60).padStart(2, '0')}`;
