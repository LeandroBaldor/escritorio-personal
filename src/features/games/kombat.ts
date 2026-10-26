// Lógica de Kombat Football: fútbol 1 contra 1 visto de costado, mezclado con peleas al estilo Mortal Kombat.
// La cancha ocupa toda la pantalla y es larga (cuesta llegar al otro arco). Cada equipo tiene su luchador (lo
// maneja el jugador o la máquina) y un arquero común que ataja solo; hay un árbitro que corre por la cancha.
// Se juegan dos tiempos de 1:30 y en el entretiempo los equipos cambian de lado. Si empatan, gol de oro.
// Barras: la ENERGÍA del luchador (correr, saltar, patear y recibir golpes la gastan; cuanto menos tiene, más
// lento corre y más flojo patea; quieto se recupera) y el PODER (se carga jugando, en 3 niveles): cada nivel
// habilita una jugada especial que se hace con una combinación de flechas + ESPACIO.
// En el piso de cada escenario hay trampas (pinches, fuego, electricidad, láseres…) que afectan a todos.
// Todo se mide en metros: la cancha mide W de largo, el piso está en y = 0 y para arriba es positivo.

export const W = 30; // largo de la cancha
export const H = 14; // techo invisible (arriba de todo de la pantalla)
export const GOAL_DEPTH = 1.6; // qué tan hondo es el arco
export const GOAL_H = 2.7; // alto del travesaño
export const BAR = 0.16; // grosor del travesaño
export const BALL_R = 0.3;
export const PW = 0.8; // ancho de una persona
export const PH = 1.85; // alto de una persona
export const HALF_TIME = 90; // cada tiempo dura 1:30
export const STAMINA = 100; // energía llena
export const POWER_MAX = 300; // poder: 3 niveles de 100
export const FATAL_CINE = 1.4; // la presentación del FATAL GOAL (todo se congela)
export const TOURNAMENT = 10;

export type CharId = 'venox' | 'blazehorn' | 'frostbane' | 'voltrax' | 'nullshade';
export type StageId = 'city' | 'factory' | 'volcano' | 'glacier' | 'lab' | 'space' | 'graveyard' | 'storm' | 'desert' | 'arena';
export type PowerKind = 'shield' | 'speed' | 'magnet' | 'power' | 'giant' | 'energy';
export type BallKind = 'normal' | 'toxic' | 'fire' | 'ice' | 'spike' | 'void';
export type Move = 'shot' | 'defense' | 'attack' | 'fatal'; // las jugadas especiales
// Combinaciones (relativas: F = adelante, hacia el arco rival; B = atrás; D = abajo; U = arriba) + ESPACIO.
export const COMBOS: Record<Move, ('F' | 'B' | 'D' | 'U')[]> = { shot: ['F', 'F'], defense: ['B', 'B'], attack: ['D', 'F'], fatal: ['F', 'B', 'F'] };
export const COST: Record<Move, number> = { shot: 100, defense: 100, attack: 200, fatal: 300 };
export const MOVE_NAME: Record<Move, string> = { shot: 'Tiro especial', defense: 'Defensa especial', attack: 'Golpe especial', fatal: 'FATAL GOAL' };

export interface CharDef {
  id: CharId; name: string; element: string; color: string; glow: string; bio: string;
  speed: number; power: number; jump: number; stamina: number; // 1 = normal
  shot: string; shotText: string; attack: string; attackText: string; defense: string; defenseText: string; fatal: string; fatalText: string;
}
export const CHARS: Record<CharId, CharDef> = {
  venox: { id: 'venox', name: 'VENOX', element: 'Veneno', color: '#4ade80', glow: '#86efac', bio: 'Salió de una fábrica de químicos abandonada. Respira gas tóxico y envenena todo lo que toca.', speed: 1, power: 0.95, jump: 1, stamina: 1.15,
    shot: 'Tiro ácido', shotText: 'La pelota sale envuelta en ácido y zigzaguea: el arquero que la toca queda envenenado.',
    attack: 'Aliento de gas', attackText: 'Escupe una nube venenosa hacia adelante: al rival se le va la energía.',
    defense: 'Nube tóxica', defenseText: 'Una nube de gas frente a su arco que frena la pelota.',
    fatal: 'BOMBA ÁCIDA', fatalText: 'La pelota se vuelve una calavera de ácido que vuela ondulando hasta el arco.' },
  blazehorn: { id: 'blazehorn', name: 'BLAZEHORN', element: 'Fuego', color: '#ef4444', glow: '#fb923c', bio: 'Un toro de pelea forjado en un volcán. Lento, pero cada patada es una bola de fuego.', speed: 0.92, power: 1.22, jump: 0.92, stamina: 1,
    shot: 'Bola de fuego', shotText: 'El tiro más fuerte del juego, prendido fuego: quema al arquero.',
    attack: 'Embestida', attackText: 'Carga con los cuernos en llamas y voltea al rival.',
    defense: 'Muro de fuego', defenseText: 'Una pared de llamas frente a su arco rechaza la pelota.',
    fatal: 'METEORITO', fatalText: 'Patea la pelota al cielo y cae como un meteorito sobre el arco rival.' },
  frostbane: { id: 'frostbane', name: 'FROSTBANE', element: 'Hielo', color: '#60a5fa', glow: '#bae6fd', bio: 'Un guerrero de hielo con cara de calavera. Congela el aire, la pelota y a sus rivales.', speed: 0.98, power: 1, jump: 1.05, stamina: 1.05,
    shot: 'Tiro helado', shotText: 'La pelota sale congelada: el arquero que la ataja queda hecho hielo.',
    attack: 'Aliento helado', attackText: 'Sopla hielo hacia adelante y congela al rival (y la pelota).',
    defense: 'Muro de hielo', defenseText: 'Un bloque de hielo sólido tapa su arco por unos segundos.',
    fatal: 'AVALANCHA', fatalText: 'La pelota se vuelve una bola de hielo gigante que rueda arrasando todo.' },
  voltrax: { id: 'voltrax', name: 'VOLTRAX', element: 'Electricidad', color: '#facc15', glow: '#fef08a', bio: 'Un robot de carreras con un reactor en el pecho. El más rápido de todos, pero se cansa enseguida.', speed: 1.13, power: 0.9, jump: 1.08, stamina: 0.85,
    shot: 'Tiro relámpago', shotText: 'La pelota sale electrificada a toda velocidad: paraliza al arquero.',
    attack: 'Descarga', attackText: 'Supervelocidad un rato y patadas que electrocutan.',
    defense: 'Campo magnético', defenseText: 'Un campo eléctrico a su alrededor que repele la pelota.',
    fatal: 'RELÁMPAGO', fatalText: 'La pelota salta en zigzag como un rayo hasta meterse en el arco.' },
  nullshade: { id: 'nullshade', name: 'NULLSHADE', element: 'Oscuridad', color: '#a855f7', glow: '#d8b4fe', bio: 'Una sombra encapuchada que viene del vacío. Aparece y desaparece donde menos lo esperás.', speed: 1.02, power: 1, jump: 1, stamina: 0.95,
    shot: 'Tiro fantasma', shotText: 'La pelota se vuelve invisible a ratos y atraviesa al arquero.',
    attack: 'Golpe sombra', attackText: 'Desaparece y aparece detrás del rival para voltearlo.',
    defense: 'Portal', defenseText: 'Un portal frente a su arco: la pelota que entra sale por el medio de la cancha.',
    fatal: 'AGUJERO NEGRO', fatalText: 'Un agujero negro atrapa al rival mientras la pelota gira en espiral hasta el arco.' },
};
export const CHAR_IDS: CharId[] = ['venox', 'blazehorn', 'frostbane', 'voltrax', 'nullshade'];

export type TrapKind = 'spikes' | 'flame' | 'shock' | 'laser';
export interface StageDef { id: StageId; name: string; hazard: string; gravity: number; friction: number; traps: TrapKind[] }
export const STAGES: StageDef[] = [
  { id: 'city', name: 'Ciudad Tóxica', hazard: 'Placas eléctricas, un láser en el medio y rayos de las torres', gravity: 1, friction: 1, traps: ['shock', 'laser', 'shock'] },
  { id: 'factory', name: 'Fábrica Abandonada', hazard: 'Pinches, fuego, bola de demolición y cinta transportadora', gravity: 1, friction: 1, traps: ['spikes', 'flame', 'spikes'] },
  { id: 'volcano', name: 'Volcán', hazard: 'Chorros de fuego, pozos de lava y lluvia de meteoritos', gravity: 1, friction: 1, traps: ['flame', 'flame', 'flame'] },
  { id: 'glacier', name: 'Glaciar', hazard: 'Piso que resbala, pinches de hielo y carámbanos que caen', gravity: 1, friction: 0.3, traps: ['spikes', 'spikes'] },
  { id: 'lab', name: 'Laboratorio', hazard: 'Láseres, placas eléctricas y una zona antigravedad', gravity: 1, friction: 1, traps: ['laser', 'shock', 'laser'] },
  { id: 'space', name: 'Estación Espacial', hazard: 'Gravedad baja, láseres y compuertas que chupan todo', gravity: 0.6, friction: 1, traps: ['laser', 'laser'] },
  { id: 'graveyard', name: 'Cementerio', hazard: 'Pinches, braseros y manos de zombis que salen del piso', gravity: 1, friction: 1, traps: ['spikes', 'flame', 'spikes'] },
  { id: 'storm', name: 'Azotea en Tormenta', hazard: 'Placas eléctricas, rayos y ráfagas de viento', gravity: 1, friction: 1, traps: ['shock', 'shock', 'shock'] },
  { id: 'desert', name: 'Desierto', hazard: 'Pinches, fuego y un tornado que cruza la cancha', gravity: 1, friction: 1, traps: ['spikes', 'flame', 'spikes'] },
  { id: 'arena', name: 'Coliseo del Vacío', hazard: 'Fuego, láseres, un agujero negro y portales', gravity: 1, friction: 1, traps: ['flame', 'laser', 'flame'] },
];
export const stageDef = (id: StageId) => STAGES.find(s => s.id === id) ?? STAGES[0];

export const POWERS: Record<PowerKind, { name: string; text: string; color: string; time: number }> = {
  shield: { name: 'Escudo', text: 'no te pueden voltear', color: '#38bdf8', time: 8 },
  speed: { name: 'Turbo', text: 'corrés más y no te cansás', color: '#22c55e', time: 8 },
  magnet: { name: 'Imán', text: 'la pelota viene hacia vos', color: '#ec4899', time: 7 },
  power: { name: 'Súper patada', text: 'pateás mucho más fuerte', color: '#a855f7', time: 8 },
  giant: { name: 'Arco gigante', text: 'el arco del rival se agranda', color: '#f97316', time: 10 },
  energy: { name: 'Energía', text: 'energía llena y +1 de poder', color: '#facc15', time: 0 },
};
export const BALLS: Record<Exclude<BallKind, 'normal'>, { name: string; text: string; color: string }> = {
  toxic: { name: 'Pelota tóxica', text: 'se mueve sola, para cualquier lado', color: '#4ade80' },
  fire: { name: 'Pelota de fuego', text: 'más rápida, y quema si te pega', color: '#f97316' },
  ice: { name: 'Pelota de hielo', text: 'resbala y casi no frena', color: '#38bdf8' },
  spike: { name: 'Pelota con pinchos', text: 'si te pega en el cuerpo te voltea', color: '#9ca3af' },
  void: { name: 'Pelota del vacío', text: 'flota como en la Luna', color: '#a855f7' },
};

export interface Input { left: boolean; right: boolean; up: boolean; down: boolean; kick: boolean; cast?: Move | null }
export const noInput = (): Input => ({ left: false, right: false, up: false, down: false, kick: false, cast: null });

export type Action = 'idle' | 'run' | 'jump' | 'kick' | 'slide' | 'block' | 'stun' | 'special' | 'celebrate' | 'sad' | 'fatal' | 'tired';
export type StunKind = 'hit' | 'freeze' | 'poison' | 'burn' | 'zap' | 'grab' | 'none';
export interface Fighter {
  side: 0 | 1; char: CharId;
  x: number; y: number; vx: number; vy: number; facing: 1 | -1; ground: boolean;
  action: Action; actionT: number;
  kickT: number; kickKind: 'normal' | 'lob' | 'low'; kickHit: boolean; slideT: number;
  stun: number; stunKind: StunKind; poison: number; inv: number; // inv: un ratito invulnerable después de levantarse
  stamina: number; power: number; unlocked: number; // poder: hasta qué nivel ya se avisó
  speedT: number; dashT: number; // descarga de VOLTRAX, embestida de BLAZEHORN
  powers: Partial<Record<PowerKind, number>>;
  prev: Input; taps: { d: 'F' | 'B' | 'U' | 'D'; t: number }[];
  goals: number;
}
export interface Person { // arquero o árbitro: corren solos
  role: 'keeper' | 'ref'; team: 0 | 1; x: number; y: number; vx: number; vy: number; facing: 1 | -1; ground: boolean;
  action: 'idle' | 'run' | 'jump' | 'dive' | 'hold' | 'kick' | 'stun' | 'down' | 'gone' | 'celebrate' | 'sad' | 'whistle'; actionT: number;
  stun: number; stunKind: StunKind; hold: number; away: number;
}
export interface Ball { x: number; y: number; vx: number; vy: number; spin: number; kind: BallKind; kindT: number; owner: 0 | 1 | null; fx: 'none' | 'toxic' | 'fire' | 'ice' | 'volt' | 'void'; fxT: number; frozen: number; held: Person | null }
export interface Shield { kind: 'cloud' | 'firewall' | 'icewall' | 'field' | 'portal'; side: 0 | 1; x: number; y: number; w: number; h: number; t: number; life: number }
export interface Shot { kind: 'gas' | 'breath'; side: 0 | 1; x: number; y: number; t: number; life: number; hit: boolean }
export interface Fatal { side: 0 | 1; char: CharId; t: number; x0: number; y0: number; dir: 1 | -1; blocked: boolean; done: boolean }
export interface PowerUp { id: number; kind: PowerKind; x: number; y: number; t: number }
export interface Hazard {
  kind: TrapKind | 'wreck' | 'conveyor' | 'meteor' | 'lava' | 'block' | 'icicle' | 'antigrav' | 'airlock' | 'hand' | 'lightning' | 'arc' | 'gust' | 'tornado' | 'blackhole' | 'portal';
  x: number; y: number; w: number; h: number; t: number; state: number; dir: number; id: number; period: number;
  struck?: number; // a quiénes ya lastimó en este encendido (bits: luchadores 1 y 2, arqueros 4 y 8, árbitro 16)
}
export type KfEvent =
  | { type: 'kick'; power: number } | { type: 'hit'; who: 'fighter' | 'keeper' | 'ref'; kind: StunKind } | { type: 'block' } | { type: 'goal'; side: 0 | 1; fatal: boolean }
  | { type: 'bounce'; power: number } | { type: 'post' } | { type: 'jump' } | { type: 'move'; side: 0 | 1; char: CharId; move: Move }
  | { type: 'fatalBlocked'; side: 0 | 1 } | { type: 'power'; side: 0 | 1; kind: PowerKind } | { type: 'ballKind'; kind: BallKind }
  | { type: 'unlock'; side: 0 | 1; level: number } | { type: 'save'; team: 0 | 1; caught: boolean } | { type: 'refDown' } | { type: 'refBack' }
  | { type: 'trap'; kind: Hazard['kind'] } | { type: 'boom' } | { type: 'thunder' } | { type: 'zap' } | { type: 'whistle'; kind: 'kickoff' | 'half' | 'end' }
  | { type: 'halftime' } | { type: 'extra' } | { type: 'warn' } | { type: 'tired'; side: 0 | 1 } | { type: 'far'; side: 0 | 1 };
export type Phase = 'intro' | 'play' | 'goal' | 'fatal' | 'halftime' | 'end';
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'spark' | 'smoke' | 'shard' | 'bubble' | 'ember' | 'flash' | 'ring' | 'blood' }
export interface CpuState { level: number; think: number; plan: Input; reactFatal: number }

export interface Match {
  stage: StageId; fighters: [Fighter, Fighter]; keepers: [Person, Person]; ref: Person; ball: Ball; trail: [number, number][];
  phase: Phase; phaseT: number; time: number; half: 1 | 2; clock: number; extra: boolean; extraT: number; kickoffTeam: 0 | 1;
  shields: Shield[]; shots: Shot[]; fatal: Fatal | null; powerups: PowerUp[]; hazards: Hazard[]; particles: Particle[];
  nextPower: number; nextBall: number; nextHazard: number; nextId: number;
  lastGoal: { side: 0 | 1; fatal: boolean } | null; winner: 0 | 1 | null;
  events: KfEvent[]; shake: number; flash: number; rand: () => number;
  cpu: [CpuState | null, CpuState | null];
}

export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const emit = (m: Match, e: KfEvent) => { m.events.push(e); };
export function takeEvents(m: Match) { const e = m.events; m.events = []; return e; }
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- Lados de la cancha
// En el primer tiempo el equipo 0 defiende el arco de la izquierda; en el segundo, el de la derecha.
export const defendsLeft = (m: Match, team: 0 | 1) => (team === 0) === (m.half === 1);
export const attackDir = (m: Match, team: 0 | 1): 1 | -1 => defendsLeft(m, team) ? 1 : -1;
export const goalLineX = (left: boolean) => left ? GOAL_DEPTH : W - GOAL_DEPTH;
const ownGoalX = (m: Match, team: 0 | 1) => goalLineX(defendsLeft(m, team));
// El equipo que defiende el arco de un lado.
export const teamAt = (m: Match, left: boolean): 0 | 1 => defendsLeft(m, 0) === left ? 0 : 1;
// Alto del arco que defiende "team" (se agranda con el potenciador del rival y en el tiempo extra).
export function goalHeight(m: Match, team: 0 | 1) {
  const rival = m.fighters[team === 0 ? 1 : 0];
  return Math.min(4.5, GOAL_H + ((rival.powers.giant ?? 0) > 0 ? 1.2 : 0) + (m.extra ? Math.min(1.2, Math.floor(m.extraT / 20) * 0.4) : 0));
}

function newFighter(side: 0 | 1, char: CharId): Fighter {
  return { side, char, x: 0, y: 0, vx: 0, vy: 0, facing: 1, ground: true, action: 'idle', actionT: 0,
    kickT: 0, kickKind: 'normal', kickHit: false, slideT: 0, stun: 0, stunKind: 'none', poison: 0, inv: 0, stamina: STAMINA, power: 0, unlocked: 0,
    speedT: 0, dashT: 0, powers: {}, prev: noInput(), taps: [], goals: 0 };
}
const newPerson = (role: Person['role'], team: 0 | 1): Person => ({ role, team, x: W / 2, y: 0, vx: 0, vy: 0, facing: 1, ground: true, action: 'idle', actionT: 0, stun: 0, stunKind: 'none', hold: 0, away: 0 });

// Trampas del piso (simétricas, así ningún lado tiene ventaja) y los peligros fijos de cada escenario.
function stageHazards(m: Match): Hazard[] {
  const hz = (kind: Hazard['kind'], x: number, y: number, w: number, h: number, extra: Partial<Hazard> = {}): Hazard => ({ kind, x, y, w, h, t: 0, state: 0, dir: 1, id: m.nextId++, period: 6, ...extra });
  const out: Hazard[] = [];
  const traps = stageDef(m.stage).traps;
  const spots = traps.length === 2 ? [0.3, 0.7] : [0.27, 0.5, 0.73];
  traps.forEach((k, i) => {
    const cx = W * spots[i], w = k === 'laser' ? 0.3 : k === 'flame' ? 1.1 : 1.8;
    const phase = spots[i] === 0.5 ? 2.5 : 0; // las de los costados van en espejo (mismo ritmo)
    out.push(hz(k, cx - w / 2, 0, w, k === 'laser' ? 2.4 : 0.1, { t: phase, period: k === 'laser' ? 5.5 : 6.5 }));
  });
  switch (m.stage) {
    case 'factory': out.push(hz('wreck', W / 2, H - 1.5, 0, 6.3), hz('conveyor', W * 0.39, 0, W * 0.22, 0.25, { dir: 1 })); break;
    case 'volcano': out.push(hz('lava', W * 0.38 - 0.6, 0, 1.2, 0.1), hz('lava', W * 0.62 - 0.6, 0, 1.2, 0.1)); break;
    case 'glacier': out.push(hz('block', W * 0.42 - 0.9, 0, 1.8, 0.9), hz('block', W * 0.58 - 0.9, 0, 1.8, 0.9)); break;
    case 'lab': out.push(hz('antigrav', W / 2 - 2, 0, 4, H)); break;
    case 'space': out.push(hz('airlock', 0, 0, 0, 0, { t: -6 })); break;
    case 'arena': out.push(hz('blackhole', W / 2, 8.5, 0, 0), hz('portal', W * 0.2, 5, 0, 0), hz('portal', W * 0.8, 5, 0, 0)); break;
  }
  return out;
}
export function newMatch(stage: StageId, chars: [CharId, CharId], cpuLevels: [number | null, number | null], rand: () => number = Math.random): Match {
  const m: Match = {
    stage, fighters: [newFighter(0, chars[0]), newFighter(1, chars[1])], keepers: [newPerson('keeper', 0), newPerson('keeper', 1)], ref: newPerson('ref', 0),
    ball: { x: W / 2, y: BALL_R, vx: 0, vy: 0, spin: 0, kind: 'normal', kindT: 0, owner: null, fx: 'none', fxT: 0, frozen: 0, held: null }, trail: [],
    phase: 'intro', phaseT: 0, time: 0, half: 1, clock: HALF_TIME, extra: false, extraT: 0, kickoffTeam: 0,
    shields: [], shots: [], fatal: null, powerups: [], hazards: [], particles: [],
    nextPower: 14, nextBall: 30, nextHazard: 4, nextId: 1, lastGoal: null, winner: null,
    events: [], shake: 0, flash: 0, rand,
    cpu: [cpuLevels[0] === null ? null : newCpu(cpuLevels[0]), cpuLevels[1] === null ? null : newCpu(cpuLevels[1])],
  };
  m.hazards = stageHazards(m);
  resetKickoff(m);
  return m;
}
const newCpu = (level: number): CpuState => ({ level, think: 0, plan: noInput(), reactFatal: 0 });

// Todos a su lugar para sacar del medio.
function resetKickoff(m: Match) {
  const b = m.ball;
  b.x = W / 2; b.y = BALL_R; b.vx = 0; b.vy = 0; b.spin = 0; b.owner = null; b.fx = 'none'; b.fxT = 0; b.frozen = 0; b.held = null;
  m.trail = [];
  for (const f of m.fighters) {
    const left = defendsLeft(m, f.side);
    f.x = W / 2 + (left ? -1 : 1) * (f.side === m.kickoffTeam ? 0.9 : 3.5); f.y = 0; f.vx = 0; f.vy = 0; f.ground = true; f.facing = left ? 1 : -1;
    f.action = 'idle'; f.stun = 0; f.stunKind = 'none'; f.kickT = 0; f.dashT = 0; f.slideT = 0; f.taps = [];
  }
  for (const k of m.keepers) { const left = defendsLeft(m, k.team); k.x = goalLineX(left) + (left ? 0.7 : -0.7); k.y = 0; k.vx = 0; k.vy = 0; k.facing = left ? 1 : -1; k.action = 'idle'; k.stun = 0; k.hold = 0; }
  const r = m.ref; if (r.action !== 'gone') { r.x = W / 2; r.y = 0; r.vx = 0; r.vy = 0; r.action = 'idle'; r.stun = 0; }
  m.shields = []; m.shots = [];
}

// ---------------------------------------------------------------- Un paso de la simulación
export function step(m: Match, inputs: [Input, Input], dt: number) {
  m.time += dt; m.phaseT += dt;
  m.shake = Math.max(0, m.shake - dt * 2.5); m.flash = Math.max(0, m.flash - dt * 2);
  updateParticles(m, dt);
  if (m.phase === 'intro') {
    idlePeople(m, dt);
    if (m.phaseT > 2.4) { m.phase = 'play'; m.phaseT = 0; emit(m, { type: 'whistle', kind: 'kickoff' }); }
    return;
  }
  if (m.phase === 'end') { idlePeople(m, dt); return; }
  if (m.phase === 'halftime') {
    idlePeople(m, dt);
    if (m.phaseT > 3.2) { m.half = 2; m.clock = HALF_TIME; m.kickoffTeam = 1; for (const f of m.fighters) f.stamina = STAMINA; resetKickoff(m); m.phase = 'intro'; m.phaseT = 0.8; }
    return;
  }
  if (m.phase === 'goal') {
    idlePeople(m, dt); moveBall(m, dt);
    if (m.phaseT > 2.8) {
      if (m.winner !== null) { m.phase = 'end'; m.phaseT = 0; emit(m, { type: 'whistle', kind: 'end' }); return; }
      m.kickoffTeam = m.lastGoal?.side === 0 ? 1 : 0; resetKickoff(m); m.phase = 'play'; m.phaseT = 0; emit(m, { type: 'whistle', kind: 'kickoff' });
    }
    return;
  }
  if (m.phase === 'fatal') { if (m.phaseT > FATAL_CINE) { m.phase = 'play'; m.phaseT = 0; } return; }
  // --- jugando
  if (!m.extra) {
    m.clock = Math.max(0, m.clock - dt);
    if (m.clock <= 0) {
      if (m.half === 1) { m.phase = 'halftime'; m.phaseT = 0; m.fatal = null; emit(m, { type: 'whistle', kind: 'half' }); emit(m, { type: 'halftime' }); return; }
      const [a, b] = m.fighters;
      if (a.goals !== b.goals) { m.winner = a.goals > b.goals ? 0 : 1; m.phase = 'end'; m.phaseT = 0; emit(m, { type: 'whistle', kind: 'end' }); return; }
      m.extra = true; m.extraT = 0; m.kickoffTeam = 0; m.fatal = null; emit(m, { type: 'extra' }); resetKickoff(m); m.phase = 'intro'; m.phaseT = 0.6;
      return;
    }
  } else m.extraT += dt;
  const ins: [Input, Input] = [inputs[0], inputs[1]];
  for (const s of [0, 1] as const) { const c = m.cpu[s]; if (c) ins[s] = cpuThink(m, s, c, dt); }
  for (const s of [0, 1] as const) updateFighter(m, m.fighters[s], ins[s], dt);
  fighterCollide(m);
  for (const k of m.keepers) updateKeeper(m, k, dt);
  updateRef(m, dt);
  updateShields(m, dt);
  updateShots(m, dt);
  updateFatal(m, dt);
  if (m.phase !== 'play') return;
  updateHazards(m, dt);
  moveBall(m, dt);
  checkGoal(m);
  updatePowerups(m, dt);
}

function gravityOf(m: Match) { return 30 * stageDef(m.stage).gravity; }
function settle(m: Match, p: { x: number; y: number; vx: number; vy: number; ground: boolean }, dt: number) {
  p.vy -= gravityOf(m) * dt; p.y += p.vy * dt; p.x = clamp(p.x + p.vx * dt, 0.4, W - 0.4);
  const fl = floorAt(m, p.x);
  if (p.y <= fl) { p.y = fl; p.vy = 0; p.ground = true; } else if (p.y > fl + 0.01) p.ground = false;
}
function idlePeople(m: Match, dt: number) {
  for (const f of m.fighters) {
    f.actionT += dt; f.vx *= Math.pow(0.02, dt); settle(m, f, dt);
    if (m.phase === 'goal' && m.lastGoal) {
      const scorer = m.lastGoal.side === f.side;
      f.action = scorer ? 'celebrate' : 'sad';
      if (scorer && f.ground && m.phaseT > 0.3 && m.phaseT < 2.2) { f.vy = 7; f.ground = false; }
    } else if (m.phase === 'end' && m.winner !== null) f.action = m.winner === f.side ? 'celebrate' : 'sad';
    else if (m.phase === 'halftime') { f.action = 'run'; const d = defendsLeft(m, f.side) ? 1 : -1; f.facing = d; f.x = clamp(f.x + d * 1.2 * dt, 0.5, W - 0.5); }
    else if (f.action !== 'fatal') f.action = 'idle';
  }
  for (const k of m.keepers) {
    k.actionT += dt; settle(m, k, dt); k.vx *= Math.pow(0.02, dt);
    if (m.phase === 'goal' && m.lastGoal) k.action = m.lastGoal.side === k.team ? 'celebrate' : 'sad'; else if (k.action !== 'stun' && k.action !== 'down') k.action = 'idle';
    if (k.stun > 0) { k.stun -= dt; if (k.stun <= 0) k.action = 'idle'; }
  }
  const r = m.ref; r.actionT += dt;
  if (r.action === 'gone') { r.away -= dt; if (r.away <= 0) { r.action = 'idle'; r.x = W / 2; r.y = 0; } }
  else { settle(m, r, dt); r.vx *= Math.pow(0.02, dt); if (r.action !== 'down') r.action = m.phase === 'goal' || m.phase === 'halftime' || m.phase === 'end' ? 'whistle' : 'idle'; }
}

// Altura del piso en x (los bloques de hielo del glaciar son escalones).
export function floorAt(m: Match, x: number) {
  let y = 0;
  for (const h of m.hazards) if (h.kind === 'block' && x > h.x && x < h.x + h.w) y = Math.max(y, h.h);
  return y;
}

const pressed = (f: Fighter, i: Input, k: 'left' | 'right' | 'up' | 'down' | 'kick') => i[k] && !f.prev[k];
const canAct = (f: Fighter) => f.stun <= 0 && f.action !== 'fatal' && f.dashT <= 0 && f.slideT <= 0;
export const staminaFactor = (f: Fighter) => 0.45 + 0.55 * Math.min(1, f.stamina / STAMINA);
export const powerLevel = (f: Fighter) => Math.floor(f.power / 100);
// Qué jugadas especiales tiene disponibles (por el poder cargado).
export function movesReady(f: Fighter): Move[] { return (['shot', 'defense', 'attack', 'fatal'] as Move[]).filter(mv => f.power >= COST[mv]); }
function gainPower(m: Match, f: Fighter, n: number) {
  f.power = Math.min(POWER_MAX, f.power + n);
  const lvl = powerLevel(f);
  if (lvl > f.unlocked) { f.unlocked = lvl; emit(m, { type: 'unlock', side: f.side, level: lvl }); }
}
function spend(f: Fighter, n: number) { f.stamina = Math.max(0, f.stamina - n); }

function updateFighter(m: Match, f: Fighter, i: Input, dt: number) {
  const def = CHARS[f.char], st = stageDef(m.stage), rival = m.fighters[f.side === 0 ? 1 : 0], dir = attackDir(m, f.side);
  f.actionT += dt;
  f.poison = Math.max(0, f.poison - dt); f.speedT = Math.max(0, f.speedT - dt);
  for (const k of Object.keys(f.powers) as PowerKind[]) { const left = (f.powers[k] ?? 0) - dt; if (left <= 0) delete f.powers[k]; else f.powers[k] = left; }
  gainPower(m, f, dt * 2.2);
  f.inv = Math.max(0, f.inv - dt);
  if (f.stun > 0) { f.stun -= dt; if (f.stun <= 0) { f.stun = 0; f.stunKind = 'none'; f.action = 'idle'; f.inv = 0.8; } }
  const stunned = f.stun > 0;
  // --- combinaciones: se anotan las flechas que se aprietan (relativas al arco rival)
  const tap = (d: 'F' | 'B' | 'U' | 'D') => { f.taps.push({ d, t: m.time }); if (f.taps.length > 6) f.taps.shift(); };
  if (pressed(f, i, 'right')) tap(dir > 0 ? 'F' : 'B');
  if (pressed(f, i, 'left')) tap(dir > 0 ? 'B' : 'F');
  if (pressed(f, i, 'down')) tap('D');
  if (pressed(f, i, 'up')) tap('U');
  f.taps = f.taps.filter(tp => m.time - tp.t < 1.1);
  // --- movimiento
  const turbo = (f.powers.speed ?? 0) > 0;
  let speed = 8.4 * def.speed * staminaFactor(f) * (f.speedT > 0 ? 1.5 : 1) * (turbo ? 1.3 : 1) * (f.poison > 0 ? 0.6 : 1);
  const cpu = m.cpu[f.side];
  if (cpu) speed *= 0.76 + cpu.level * 0.28;
  const blocking = !stunned && i.down && !i.kick && f.ground && f.kickT <= 0 && canAct(f) && Math.abs(f.vx) < 2.5;
  let want = 0;
  if (!stunned && canAct(f)) { if (i.left) want -= 1; if (i.right) want += 1; }
  if (blocking) want *= 0.15;
  const accel = f.ground ? (st.friction < 1 ? 16 : 60) : 24;
  if (f.dashT > 0) { f.dashT -= dt; f.vx = f.facing * 18; if (f.dashT <= 0) f.action = 'idle'; }
  else if (f.slideT > 0) { f.slideT -= dt; f.vx *= Math.pow(0.15, dt); if (f.slideT <= 0) f.action = 'idle'; }
  else if (!stunned) {
    const d = want * speed - f.vx, maxd = accel * dt;
    f.vx += clamp(d, -maxd, maxd);
    if (want !== 0 && f.kickT <= 0) f.facing = want > 0 ? 1 : -1;
  } else f.vx *= Math.pow(f.ground ? 0.05 : 0.6, dt);
  // energía: correr cansa, quieto o caminando se recupera
  const sp = Math.abs(f.vx);
  if (!turbo) { if (sp > 4.5) spend(f, dt * 5.2 / def.stamina); else f.stamina = Math.min(STAMINA, f.stamina + dt * (sp < 1 ? 11 : 6)); }
  else f.stamina = Math.min(STAMINA, f.stamina + dt * 4);
  // salto
  if (!stunned && f.ground && pressed(f, i, 'up') && canAct(f) && !i.kick) {
    f.vy = 12 * def.jump * (0.8 + 0.2 * staminaFactor(f)) * (turbo ? 1.12 : 1) * Math.sqrt(st.gravity); f.ground = false; spend(f, 4); emit(m, { type: 'jump' });
  }
  f.vy -= gravityOf(m) * dt;
  f.x += f.vx * dt; f.y += f.vy * dt;
  f.x = clamp(f.x, 0.5, W - 0.5);
  // no atraviesa bloques ni muros de hielo
  for (const h of m.hazards) if (h.kind === 'block' && f.y < h.h - 0.05 && f.x + PW / 2 > h.x && f.x - PW / 2 < h.x + h.w) { f.x = f.x < h.x + h.w / 2 ? h.x - PW / 2 : h.x + h.w + PW / 2; f.vx = 0; }
  for (const s of m.shields) if (s.kind === 'icewall' && f.side !== s.side && f.x + PW / 2 > s.x && f.x - PW / 2 < s.x + s.w && f.y < s.y + s.h) { f.x = f.x < s.x + s.w / 2 ? s.x - PW / 2 : s.x + s.w + PW / 2; f.vx = 0; }
  const fl = floorAt(m, f.x);
  if (f.y <= fl) { if (!f.ground && f.vy < -6) emit(m, { type: 'bounce', power: 0.3 }); f.y = fl; f.vy = 0; f.ground = true; } else if (f.y > fl + 0.01) f.ground = false;
  if (f.y > H - PH) { f.y = H - PH; f.vy = Math.min(0, f.vy); }
  // --- acciones
  if (f.kickT > 0) {
    f.kickT -= dt;
    const k = 0.3 - f.kickT;
    if (!f.kickHit && k > 0.03 && k < 0.2) doKick(m, f, rival);
    if (f.kickT <= 0) { f.kickT = 0; if (f.action === 'kick') f.action = 'idle'; }
  }
  if (f.slideT > 0 && !f.kickHit) doSlide(m, f, rival);
  if (canAct(f) && !stunned) {
    const wantCast = i.cast ?? (pressed(f, i, 'kick') ? comboOf(f) : null);
    if (wantCast && f.power >= COST[wantCast]) { if (castMove(m, f, rival, wantCast)) { f.power -= COST[wantCast]; f.unlocked = powerLevel(f); f.taps = []; } }
    else if (pressed(f, i, 'kick') && f.kickT <= 0) {
      if (i.down && f.ground && sp > 3.5) { f.slideT = 0.5; f.vx = f.facing * Math.max(sp, 7); f.action = 'slide'; f.actionT = 0; f.kickHit = false; spend(f, 6); }
      else { f.kickT = 0.3; f.kickHit = false; f.kickKind = i.up ? 'lob' : i.down ? 'low' : 'normal'; f.action = 'kick'; f.actionT = 0; spend(f, 2.5); }
    }
  }
  if (!stunned && f.action !== 'fatal' && f.action !== 'special' && f.kickT <= 0 && f.dashT <= 0 && f.slideT <= 0)
    f.action = blocking ? 'block' : !f.ground ? 'jump' : f.stamina < 10 && sp < 1 ? 'tired' : sp > 0.8 ? 'run' : 'idle';
  if (f.action === 'special' && f.actionT > 0.45) f.action = 'idle';
  if (f.action === 'fatal' && m.phase === 'play' && m.fatal === null) f.action = 'idle';
  if (stunned) f.action = 'stun';
  // embestida: voltea al rival (y a cualquiera que se cruce)
  if (f.dashT > 0) {
    if (rival.stun <= 0 && Math.abs(rival.x - f.x) < 1 && Math.abs(rival.y - f.y) < 1.4) hurtFighter(m, rival, f, 'burn', 1.3, 10, 26);
    hitPeopleNear(m, f.x, f.y + 1, 0.8, 'burn');
    const b = m.ball; if (!b.held && Math.abs(b.x - f.x) < 1 && b.y < 2) { b.vx = f.facing * 26; b.vy = 4; b.fx = 'fire'; b.fxT = 1.5; b.owner = f.side; f.dashT = 0; emit(m, { type: 'kick', power: 1.3 }); }
  }
  // imán
  if ((f.powers.magnet ?? 0) > 0 && !m.ball.held) { const b = m.ball, dx = f.x + f.facing * 0.5 - b.x, dy = f.y + 0.5 - b.y, d = Math.hypot(dx, dy); if (d < 5 && d > 0.5) { b.vx += dx / d * 14 * dt; b.vy += dy / d * 14 * dt; } }
  f.prev = { ...i, cast: null };
}
// ¿Qué combinación terminó de apretar? (la más larga primero)
function comboOf(f: Fighter): Move | null {
  const seq = f.taps.map(t => t.d);
  const ends = (c: string[]) => c.length <= seq.length && c.every((d, k) => seq[seq.length - c.length + k] === d);
  for (const mv of ['fatal', 'attack', 'shot', 'defense'] as Move[]) if (ends(COMBOS[mv])) return mv;
  return null;
}

// La patada: si el pie llega a la pelota, sale hacia donde mira (globo con ↑, rasante con ↓). Si en vez de la
// pelota alcanza al rival (o al arquero, o al árbitro), lo voltea.
function doKick(m: Match, f: Fighter, rival: Fighter) {
  const b = m.ball, def = CHARS[f.char];
  const fx = f.x + f.facing * 0.5, fy = f.y + (f.ground ? 0.4 : 0.7);
  if (Math.hypot(b.x - fx, b.y - fy) < 1.1 && !b.held && !(m.fatal && !m.fatal.done)) {
    let power = 17 * def.power * (0.75 + 0.25 * staminaFactor(f)) * ((f.powers.power ?? 0) > 0 ? 1.4 : 1) * (f.speedT > 0 ? 1.2 : 1);
    let ang = f.kickKind === 'lob' ? 0.9 : f.kickKind === 'low' ? 0.05 : 0.3;
    if (!f.ground) ang = f.kickKind === 'lob' ? 0.55 : b.y > f.y + 1.2 ? -0.2 : 0.12;
    if (b.kind === 'fire') power *= 1.2;
    if (b.frozen > 0) { b.frozen = 0; power *= 1.1; }
    b.vx = Math.cos(ang) * power * f.facing; b.vy = Math.sin(ang) * power + (f.kickKind === 'lob' ? 2 : 0);
    b.spin = f.facing * (f.kickKind === 'low' ? 4 : -8); b.owner = f.side;
    if (f.speedT > 0) { b.fx = 'volt'; b.fxT = 0.8; }
    f.kickHit = true; gainPower(m, f, 8);
    burst(m, b.x, b.y, 6, '#ffffff', 'spark', 3);
    emit(m, { type: 'kick', power: power / 20 });
    return;
  }
  if (Math.abs(rival.x - (f.x + f.facing * 0.6)) < 0.8 && Math.abs(rival.y + PH / 2 - (f.y + 0.9)) < 1.3) {
    f.kickHit = true;
    if (rival.action === 'block' && rival.facing === -f.facing) { rival.vx = f.facing * 3; spend(rival, 3); gainPower(m, rival, 6); emit(m, { type: 'block' }); burst(m, rival.x - f.facing * 0.3, rival.y + 1, 8, '#93c5fd', 'spark', 3); return; }
    hurtFighter(m, rival, f, f.speedT > 0 ? 'zap' : 'hit', 0.6, 7, 12);
    return;
  }
  if (hitPeopleNear(m, f.x + f.facing * 0.6, f.y + 0.9, 0.5, f.speedT > 0 ? 'zap' : 'hit')) f.kickHit = true;
}
// Barrida: le saca la pelota al rival y lo hace caer.
function doSlide(m: Match, f: Fighter, rival: Fighter) {
  const b = m.ball;
  if (!b.held && Math.abs(b.x - (f.x + f.facing * 0.5)) < 0.8 && b.y < 1) { b.vx = f.facing * 9 + f.vx * 0.3; b.vy = 2.5; b.owner = f.side; f.kickHit = true; emit(m, { type: 'kick', power: 0.5 }); gainPower(m, f, 6); }
  if (rival.stun <= 0 && rival.ground && Math.abs(rival.x - (f.x + f.facing * 0.5)) < 0.8) { f.kickHit = true; hurtFighter(m, rival, f, 'hit', 0.9, 4, 14); }
}
// Un luchador recibe un golpe: pierde energía y queda volteado un rato (salvo que tenga escudo).
function hurtFighter(m: Match, f: Fighter, by: Fighter | null, kind: StunKind, time: number, push: number, drain: number) {
  if ((f.powers.shield ?? 0) > 0 && kind !== 'grab') { emit(m, { type: 'block' }); burst(m, f.x, f.y + 1, 10, '#38bdf8', 'ring', 1); return; }
  if (f.action === 'fatal' || (f.inv > 0 && kind !== 'grab')) return;
  f.stun = Math.max(f.stun, time); f.stunKind = kind; f.action = 'stun'; f.kickT = 0; f.dashT = 0; f.slideT = 0;
  if (push) { const d = by ? Math.sign(f.x - by.x) || -by.facing : (f.x < W / 2 ? 1 : -1); f.vx = d * push; if (kind !== 'freeze' && kind !== 'grab') { f.vy = push * 0.55; f.ground = false; } }
  if (kind === 'freeze' || kind === 'grab') f.vx = 0;
  if (kind === 'poison') f.poison = 3;
  spend(f, drain);
  gainPower(m, f, 8); if (by) gainPower(m, by, 14);
  m.shake = Math.max(m.shake, 0.4);
  fxBurst(m, f.x, f.y + 1.1, kind);
  emit(m, { type: 'hit', who: 'fighter', kind });
}
function fxBurst(m: Match, x: number, y: number, kind: StunKind) {
  const color = kind === 'freeze' ? '#bae6fd' : kind === 'poison' ? '#86efac' : kind === 'burn' ? '#fb923c' : kind === 'zap' ? '#fde047' : '#ffffff';
  burst(m, x, y, 12, color, kind === 'freeze' ? 'shard' : kind === 'poison' ? 'bubble' : kind === 'burn' ? 'ember' : 'spark', 5);
  if (kind === 'hit') burst(m, x, y, 6, '#b91c1c', 'blood', 3);
}
// Arquero o árbitro alcanzado (por una patada, un poder o una trampa).
function hurtPerson(m: Match, p: Person, kind: StunKind, time: number) {
  if (p.action === 'gone' || p.stun > 0.3) return;
  p.stun = time; p.stunKind = kind; p.action = kind === 'freeze' ? 'stun' : 'down'; p.actionT = 0; p.vx = 0;
  if (m.ball.held === p) { m.ball.held = null; m.ball.vy = 3; m.ball.vx = (m.rand() - 0.5) * 4; p.hold = 0; }
  fxBurst(m, p.x, p.y + 1, kind);
  emit(m, { type: 'hit', who: p.role === 'ref' ? 'ref' : 'keeper', kind });
  if (p.role === 'ref') emit(m, { type: 'refDown' });
}
function hitPeopleNear(m: Match, x: number, y: number, r: number, kind: StunKind) {
  let any = false;
  for (const p of [...m.keepers, m.ref]) if (p.action !== 'gone' && Math.abs(p.x - x) < r + 0.3 && y > p.y - 0.3 && y < p.y + PH + 0.3) { hurtPerson(m, p, kind, p.role === 'ref' ? 1.4 : 2.4); any = true; }
  return any;
}

// ---------------------------------------------------------------- Jugadas especiales
// Devuelve false si no se pudo hacer (por ejemplo, el tiro especial sin la pelota cerca).
function castMove(m: Match, f: Fighter, rival: Fighter, mv: Move): boolean {
  const b = m.ball, dir = attackDir(m, f.side);
  if (mv === 'fatal') { if (m.fatal) return false; startFatal(m, f); return true; }
  if (mv === 'shot') {
    if (b.held || Math.hypot(b.x - f.x, b.y - f.y - 0.5) > 2.6) { emit(m, { type: 'far', side: f.side }); return false; }
    f.action = 'special'; f.actionT = 0; f.facing = dir;
    const fx: Ball['fx'] = ({ venox: 'toxic', blazehorn: 'fire', frostbane: 'ice', voltrax: 'volt', nullshade: 'void' } as const)[f.char];
    const power = f.char === 'blazehorn' ? 29 : f.char === 'voltrax' ? 27 : 24;
    b.x = clamp(f.x + dir * 0.6, 1, W - 1); b.y = Math.max(b.y, 0.6); b.vx = dir * power; b.vy = f.char === 'frostbane' ? 3 : 4.5; b.fx = fx; b.fxT = 2.4; b.owner = f.side; b.frozen = 0;
    burst(m, b.x, b.y, 18, CHARS[f.char].glow, 'spark', 6); m.shake = 0.4;
    emit(m, { type: 'move', side: f.side, char: f.char, move: mv }); emit(m, { type: 'kick', power: 1.4 });
    return true;
  }
  f.action = 'special'; f.actionT = 0;
  emit(m, { type: 'move', side: f.side, char: f.char, move: mv });
  if (mv === 'defense') {
    const left = defendsLeft(m, f.side), gx = goalLineX(left) + (left ? 0.5 : -0.5);
    switch (f.char) {
      case 'venox': m.shields.push({ kind: 'cloud', side: f.side, x: left ? gx - 0.5 : gx - 3.5, y: 0, w: 4, h: 4.2, t: 0, life: 5 }); break;
      case 'blazehorn': m.shields.push({ kind: 'firewall', side: f.side, x: gx - 0.35, y: 0, w: 0.7, h: 4, t: 0, life: 4 }); break;
      case 'frostbane': m.shields.push({ kind: 'icewall', side: f.side, x: gx - 0.45, y: 0, w: 0.9, h: 3.6, t: 0, life: 5 }); break;
      case 'voltrax': m.shields.push({ kind: 'field', side: f.side, x: f.x, y: f.y + 1, w: 2.8, h: 2.8, t: 0, life: 4 }); break;
      case 'nullshade': m.shields.push({ kind: 'portal', side: f.side, x: gx + (left ? 0.1 : -0.1), y: 0.2, w: 1.2, h: 3.8, t: 0, life: 4.5 }); break;
    }
    return true;
  }
  // golpe especial
  switch (f.char) {
    case 'venox': m.shots.push({ kind: 'gas', side: f.side, x: f.x, y: f.y + 1.3, t: 0, life: 0.8, hit: false }); break;
    case 'blazehorn': f.dashT = 0.55; burst(m, f.x, f.y + 0.9, 14, '#fb923c', 'ember', 4); break;
    case 'frostbane': m.shots.push({ kind: 'breath', side: f.side, x: f.x, y: f.y + 1.3, t: 0, life: 0.6, hit: false }); break;
    case 'voltrax': f.speedT = 4; burst(m, f.x, f.y + 1, 16, '#fde047', 'spark', 5); break;
    case 'nullshade': {
      burst(m, f.x, f.y + 1, 18, '#c084fc', 'smoke', 2);
      const side = rival.facing; // aparece a la espalda del rival
      f.x = clamp(rival.x - side * 0.85, 0.6, W - 0.6); f.y = rival.y; f.vx = 0; f.vy = 0; f.facing = side;
      burst(m, f.x, f.y + 1, 18, '#c084fc', 'smoke', 2);
      hurtFighter(m, rival, f, 'hit', 1.3, 9, 22);
      break;
    }
  }
  return true;
}

function updateShields(m: Match, dt: number) {
  const b = m.ball;
  for (const s of m.shields) {
    s.t += dt;
    const owner = m.fighters[s.side], rival = m.fighters[s.side === 0 ? 1 : 0];
    if (s.kind === 'field') { s.x = owner.x; s.y = owner.y + 1; }
    const fatalBall = !!m.fatal && !m.fatal.done && m.fatal.side !== s.side;
    const inRect = !b.held && b.x + BALL_R > s.x && b.x - BALL_R < s.x + s.w && b.y - BALL_R < s.y + s.h && b.y + BALL_R > s.y;
    const away = attackDir(m, s.side); // hacia afuera del arco que protege
    switch (s.kind) {
      case 'cloud':
        if (inRect) { b.vx *= Math.pow(0.06, dt); b.vy *= Math.pow(0.3, dt); if (fatalBall) blockFatal(m, s.side); }
        if (rival.x > s.x && rival.x < s.x + s.w && rival.poison <= 0.5) { rival.poison = 2.5; spend(rival, 10); burst(m, rival.x, rival.y + 1, 6, '#86efac', 'bubble', 2); }
        break;
      case 'firewall': case 'icewall': {
        if (inRect && (fatalBall || Math.sign(b.vx) === -away)) {
          if (fatalBall) blockFatal(m, s.side);
          b.vx = away * Math.max(6, Math.abs(b.vx) * (s.kind === 'firewall' ? 0.9 : 0.55)); b.vy = Math.max(b.vy, 3); b.x = away > 0 ? s.x + s.w + BALL_R : s.x - BALL_R;
          burst(m, b.x, b.y, 12, s.kind === 'firewall' ? '#fb923c' : '#bae6fd', s.kind === 'firewall' ? 'ember' : 'shard', 4);
          emit(m, { type: 'block' });
        }
        if (s.kind === 'firewall' && rival.stun <= 0 && rival.x + PW / 2 > s.x && rival.x - PW / 2 < s.x + s.w) hurtFighter(m, rival, null, 'burn', 0.8, 8, 15);
        break;
      }
      case 'field': {
        const dx = b.x - s.x, dy = b.y - s.y, d = Math.hypot(dx, dy);
        if (d < s.w && !b.held) {
          if (fatalBall) blockFatal(m, s.side);
          const k = (1 - d / s.w) * 70 * dt; b.vx += dx / (d || 1) * k + away * k * 0.4; b.vy += dy / (d || 1) * k;
        }
        break;
      }
      case 'portal': {
        const cx = s.x, cy = s.y + s.h / 2;
        if (!b.held && Math.abs(b.x - cx) < 0.6 && Math.abs(b.y - cy) < s.h / 2 + 0.1) {
          if (fatalBall) blockFatal(m, s.side);
          burst(m, b.x, b.y, 14, '#c084fc', 'smoke', 2);
          m.trail = []; b.x = W / 2 + away * 2; b.y = 5; b.vx = away * 6; b.vy = 2; b.owner = s.side;
          burst(m, b.x, b.y, 14, '#c084fc', 'smoke', 2);
          s.life = Math.min(s.life, s.t + 0.3);
          emit(m, { type: 'block' });
        }
        break;
      }
    }
  }
  m.shields = m.shields.filter(s => s.t < s.life);
}

function updateShots(m: Match, dt: number) {
  const b = m.ball;
  for (const s of m.shots) {
    s.t += dt;
    const owner = m.fighters[s.side], rival = m.fighters[s.side === 0 ? 1 : 0], dir = owner.facing;
    const x0 = owner.x + dir * 0.4, y0 = owner.y + 1.3;
    s.x = x0; s.y = y0;
    const reach = Math.min(1, s.t / 0.25) * 3.8;
    const inCone = (px: number, py: number) => { const dx = (px - x0) * dir; return dx > 0 && dx < reach && Math.abs(py - y0) < 0.5 + dx * 0.35; };
    if (!s.hit && inCone(rival.x, rival.y + 1)) { s.hit = true; hurtFighter(m, rival, owner, s.kind === 'gas' ? 'poison' : 'freeze', s.kind === 'gas' ? 1 : 1.8, s.kind === 'gas' ? 2 : 0, s.kind === 'gas' ? 32 : 18); }
    for (const p of [...m.keepers, m.ref]) if (inCone(p.x, p.y + 1)) hurtPerson(m, p, s.kind === 'gas' ? 'poison' : 'freeze', 2);
    if (s.kind === 'breath' && inCone(b.x, b.y) && b.frozen <= 0 && !b.held) { b.vx = 0; b.vy = 0; b.frozen = 1.3; b.fx = 'ice'; b.fxT = 1.3; burst(m, b.x, b.y, 12, '#bae6fd', 'shard', 3); }
    m.particles.push({ x: x0 + dir * reach * Math.random(), y: y0 + (Math.random() - 0.5) * reach * 0.5, vx: dir * 4, vy: (Math.random() - 0.5), life: 0.45, max: 0.45, size: 0.1 + Math.random() * 0.12, color: s.kind === 'gas' ? '#86efac' : '#e0f2fe', kind: s.kind === 'gas' ? 'smoke' : 'shard' });
  }
  m.shots = m.shots.filter(s => s.t < s.life);
}

// ---------------------------------------------------------------- FATAL GOAL
function startFatal(m: Match, f: Fighter) {
  f.action = 'fatal'; f.actionT = 0;
  const rival = m.fighters[f.side === 0 ? 1 : 0];
  rival.power = Math.max(rival.power, COST.defense); // el rival siempre puede intentar frenarlo con su defensa
  const dir = attackDir(m, f.side), b = m.ball;
  b.held = null; b.x = clamp(f.x + dir * 0.7, 1, W - 1); b.y = f.y + 0.6; b.vx = 0; b.vy = 0; b.owner = f.side; b.frozen = 0;
  for (const k of m.keepers) k.hold = 0;
  m.fatal = { side: f.side, char: f.char, t: 0, x0: b.x, y0: b.y, dir, blocked: false, done: false }; m.trail = [];
  m.phase = 'fatal'; m.phaseT = 0; m.flash = 1; m.shake = 0.6;
  emit(m, { type: 'move', side: f.side, char: f.char, move: 'fatal' });
}
function blockFatal(m: Match, side: 0 | 1) {
  const fat = m.fatal; if (!fat || fat.done) return;
  fat.blocked = true; fat.done = true;
  const b = m.ball; b.vx = attackDir(m, side) * 10; b.vy = 6; b.fx = 'none';
  m.shake = 0.8; m.flash = 0.6;
  burst(m, b.x, b.y, 30, '#ffffff', 'ring', 2); burst(m, b.x, b.y, 30, CHARS[fat.char].glow, 'spark', 8);
  m.fighters[fat.side].action = 'idle';
  emit(m, { type: 'fatalBlocked', side });
}
// Dónde va la pelota del FATAL GOAL en el tiempo t (cada personaje con su recorrido), hasta el arco rival.
export function fatalPath(fat: Fatal, t: number): { x: number; y: number; done: boolean; size: number } {
  const dir = fat.dir, gx = dir === 1 ? W - GOAL_DEPTH * 0.4 : GOAL_DEPTH * 0.4, gy = 1.2;
  const dist = Math.abs(gx - fat.x0);
  switch (fat.char) {
    case 'blazehorn': {
      if (t < 0.55) return { x: fat.x0 + dir * t * 2, y: fat.y0 + (H + 3 - fat.y0) * (t / 0.55) ** 1.5, done: false, size: 1 };
      const k = Math.min(1, (t - 0.55) / 0.8), sx = gx - dir * 7, sy = H + 3;
      return { x: sx + (gx - sx) * k, y: sy + (gy - sy) * k, done: k >= 1, size: 2 };
    }
    case 'frostbane': {
      const k = Math.min(1, t * 22 / dist);
      return { x: fat.x0 + dir * dist * k, y: BALL_R * 2.8 + (1 - Math.min(1, t * 4)) * fat.y0, done: k >= 1, size: 2.8 };
    }
    case 'voltrax': {
      const hops = 6, k = Math.min(1, t / 1.1), i = Math.min(hops, Math.floor(k * hops + 1e-6)), hk = (k * hops) % 1;
      const at = (j: number) => ({ x: fat.x0 + dir * dist * j / hops, y: j === hops ? gy : j % 2 ? 5 : j === 0 ? fat.y0 : 1.6 });
      const a = at(i), c = at(Math.min(hops, i + 1)), q = hk < 0.6 ? 0 : (hk - 0.6) / 0.4;
      return { x: a.x + (c.x - a.x) * q, y: a.y + (c.y - a.y) * q, done: k >= 1, size: 1.3 };
    }
    case 'nullshade': {
      const k = Math.min(1, t * 13 / dist), r = (1 - k) * 1.8;
      return { x: fat.x0 + dir * dist * k + Math.cos(t * 14) * r, y: Math.max(BALL_R, fat.y0 + (gy - fat.y0) * k + 2 * Math.sin(k * Math.PI) + Math.sin(t * 14) * r), done: k >= 1, size: 1.5 };
    }
    default: {
      const k = Math.min(1, t * 16 / dist);
      return { x: fat.x0 + dir * dist * k, y: Math.max(BALL_R, fat.y0 + (gy - fat.y0) * k + Math.sin(k * Math.PI * 3) * 1.4 + Math.sin(k * Math.PI) * 2.2), done: k >= 1, size: 1.7 };
    }
  }
}
function updateFatal(m: Match, dt: number) {
  const fat = m.fatal; if (!fat) return;
  if (fat.done) { m.fatal = null; return; }
  fat.t += dt;
  const b = m.ball, px = b.x, py = b.y, p = fatalPath(fat, fat.t);
  b.x = p.x; b.y = p.y; b.vx = (p.x - px) / Math.max(dt, 1e-3); b.vy = (p.y - py) / Math.max(dt, 1e-3); b.owner = fat.side;
  const rival = m.fighters[fat.side === 0 ? 1 : 0], shooter = m.fighters[fat.side];
  if (fat.t > 0.1) shooter.action = 'idle';
  if (fat.char === 'nullshade' && rival.stun <= 0.2) { rival.stun = 0.4; rival.stunKind = 'grab'; rival.vx = (W / 2 - rival.x) * 1.2; }
  const kind: StunKind = fat.char === 'frostbane' ? 'freeze' : fat.char === 'blazehorn' ? 'burn' : fat.char === 'voltrax' ? 'zap' : fat.char === 'venox' ? 'poison' : 'hit';
  if (rival.action !== 'stun' && Math.abs(rival.x - b.x) < 0.5 + BALL_R * p.size && b.y > rival.y - 0.2 && b.y < rival.y + PH + 0.2) hurtFighter(m, rival, shooter, kind, 1.2, fat.char === 'frostbane' ? 0 : 10, 25);
  for (const q of [...m.keepers, m.ref]) if (q.action !== 'gone' && Math.abs(q.x - b.x) < 0.5 + BALL_R * p.size && b.y > q.y - 0.2 && b.y < q.y + PH + 0.4) hurtPerson(m, q, kind, 2.5);
  const glow = CHARS[fat.char].glow;
  for (let k = 0; k < 3; k++) m.particles.push({ x: b.x + (Math.random() - 0.5) * 0.4, y: b.y + (Math.random() - 0.5) * 0.4, vx: -b.vx * 0.05 + (Math.random() - 0.5), vy: -b.vy * 0.05 + (Math.random() - 0.5), life: 0.5, max: 0.5, size: 0.15 * p.size, color: glow, kind: fat.char === 'blazehorn' ? 'ember' : fat.char === 'frostbane' ? 'shard' : fat.char === 'venox' ? 'bubble' : 'spark' });
  if (p.done) { fat.done = true; scoreGoal(m, fat.side, true); }
}

// ---------------------------------------------------------------- Arqueros
// Se quedan en su arco, se mueven con la pelota, saltan o se tiran a atajar. Atajan los tiros flojos y medianos;
// los muy fuertes y los especiales les cuestan (y los poderes los voltean). Si la agarran, la sacan al rato.
function updateKeeper(m: Match, k: Person, dt: number) {
  k.actionT += dt;
  const left = defendsLeft(m, k.team), gx = goalLineX(left), out: 1 | -1 = left ? 1 : -1, b = m.ball;
  k.facing = out;
  if (k.stun > 0) {
    k.stun -= dt; k.vx *= Math.pow(0.05, dt); settle(m, k, dt);
    if (k.stun <= 0) { k.action = 'idle'; k.stunKind = 'none'; }
    return;
  }
  if (b.held === k) { // la tiene: espera y la saca jugando hacia adelante
    k.hold += dt; k.action = 'hold'; k.vx = 0; settle(m, k, dt);
    b.x = k.x + out * 0.35; b.y = k.y + 1.1; b.vx = 0; b.vy = 0;
    if (k.hold > 1.1) { b.held = null; b.vx = out * (13 + m.rand() * 4); b.vy = 9 + m.rand() * 3; b.owner = k.team; k.hold = 0; k.action = 'kick'; k.actionT = 0; emit(m, { type: 'kick', power: 0.9 }); }
    return;
  }
  const home = gx + out * 0.7;
  let target = home + out * clamp(Math.abs(b.x - gx) * 0.04, 0, 1);
  // pelota suelta cerca del arco y sin rival encima: sale a buscarla
  const rivalF = m.fighters[k.team === 0 ? 1 : 0];
  const loose = Math.abs(b.x - gx) < 4.5 && Math.hypot(b.vx, b.vy) < 7 && b.y < 2.2 && Math.abs(rivalF.x - b.x) > Math.abs(k.x - b.x) + 0.4;
  if (loose) target = b.x - out * 0.3;
  // tiro que viene al arco: calcula a qué altura pasa por donde está parado y salta o se tira
  const coming = Math.sign(b.vx) === -out && Math.abs(b.vx) > 2 && (b.x - k.x) * out > 0 && Math.abs(b.x - k.x) < 14;
  if (coming && k.ground && k.action !== 'dive' && !b.held) {
    const t = Math.abs((k.x - b.x) / b.vx), yAt = b.y + b.vy * t - 10 * stageDef(m.stage).gravity * t * t;
    if (t < 0.5 && yAt > 1.75 && yAt < goalHeight(m, k.team) + 1.2) { k.vy = Math.min(11, Math.sqrt(2 * gravityOf(m) * Math.max(0.3, yAt - 1.3))); k.ground = false; k.action = 'jump'; k.actionT = 0; }
    else if (t < 0.35 && yAt < 0.7) { k.action = 'dive'; k.actionT = 0; }
  }
  if (k.action === 'dive' && k.actionT > 0.7) k.action = 'idle';
  const d = target - k.x;
  k.vx = k.action === 'dive' ? 0 : Math.abs(d) > 0.08 ? Math.sign(d) * Math.min(6.5, Math.abs(d) * 6) : 0;
  settle(m, k, dt);
  const lo = Math.min(gx - out * 0.9, gx + out * 4.8), hi = Math.max(gx - out * 0.9, gx + out * 4.8);
  k.x = clamp(k.x, lo, hi);
  if (k.action !== 'dive' && !(k.action === 'kick' && k.actionT < 0.4)) k.action = !k.ground ? 'jump' : Math.abs(k.vx) > 0.5 ? 'run' : 'idle';
  // la atajada: alcance del cuerpo (más alto saltando, y acostado si se tira abajo)
  if (b.held || (m.fatal && !m.fatal.done)) return;
  const reachTop = k.y + PH + (k.ground ? 0.25 : 0.45), reachBot = k.action === 'dive' ? 0 : k.y - 0.1;
  const halfW = k.action === 'dive' ? 0.95 : 0.55;
  if (b.x + BALL_R > k.x - halfW && b.x - BALL_R < k.x + halfW && b.y - BALL_R < reachTop && b.y + BALL_R > reachBot) {
    const speedB = Math.hypot(b.vx, b.vy), shooter = b.owner !== null && b.owner !== k.team;
    if (shooter && b.fx !== 'none' && b.fxT > 0 && m.rand() < 0.75) { // tiro especial: lo voltea casi siempre
      hurtPerson(m, k, b.fx === 'fire' ? 'burn' : b.fx === 'ice' ? 'freeze' : b.fx === 'toxic' ? 'poison' : b.fx === 'volt' ? 'zap' : 'hit', 2.2); return;
    }
    if (shooter && speedB > 15 && m.rand() < (speedB - 15) / 25) return; // se le escapó
    if (speedB < 13 && Math.sign(b.vx) !== out) { // la agarra
      if (speedB > 7 && shooter) emit(m, { type: 'save', team: k.team, caught: true });
      b.held = k; k.hold = 0; b.vx = 0; b.vy = 0; b.fx = 'none'; b.owner = k.team; m.trail = [];
    } else if (Math.sign(b.vx) !== out || speedB > 4) { // la rechaza
      b.vx = out * Math.max(5, Math.abs(b.vx) * 0.45); b.vy = 5 + m.rand() * 4; b.x = k.x + out * (halfW + BALL_R + 0.05); b.owner = k.team; b.fx = 'none';
      emit(m, { type: 'save', team: k.team, caught: false });
      burst(m, b.x, b.y, 8, '#ffffff', 'spark', 3);
    }
  }
}

// ---------------------------------------------------------------- Árbitro
// Corre detrás de la jugada sin meterse en el medio. Si lo voltean, se cae, desaparece y vuelve a los segundos.
function updateRef(m: Match, dt: number) {
  const r = m.ref, b = m.ball;
  r.actionT += dt;
  if (r.action === 'gone') { r.away -= dt; if (r.away <= 0) { r.action = 'idle'; r.x = W / 2; r.y = 0; r.vx = 0; r.vy = 0; r.stun = 0; burst(m, r.x, 1, 16, '#ffffff', 'smoke', 2); emit(m, { type: 'refBack' }); } return; }
  if (r.stun > 0) {
    r.stun -= dt; settle(m, r, dt); r.vx *= Math.pow(0.05, dt);
    if (r.stun <= 0) { if (r.action === 'down') { r.action = 'gone'; r.away = 2.5; burst(m, r.x, 0.8, 14, '#d4d4d8', 'smoke', 2); } else r.action = 'idle'; }
    return;
  }
  const side = b.x < W / 2 ? 1 : -1, target = clamp(b.x + side * 3.2, 4, W - 4);
  let d = target - r.x;
  // no pisa trampas encendidas (ni las que avisan): si está encima se corre, si va hacia una se frena
  for (const h of m.hazards) if ((trapLike(h) && h.state >= 1) || h.kind === 'lava') {
    const c = h.x + h.w / 2, gap = h.w / 2 + 0.7;
    if (Math.abs(c - r.x) < gap) { d = (r.x < c ? -1 : 1) * 3; break; }
    if (Math.abs(c - (r.x + Math.sign(d) * 1.2)) < gap) d = 0;
  }
  r.vx = Math.abs(d) > 0.4 ? Math.sign(d) * Math.min(6, Math.abs(d) * 2) : 0;
  if (Math.abs(r.vx) > 0.2) r.facing = r.vx > 0 ? 1 : -1;
  settle(m, r, dt);
  r.action = Math.abs(r.vx) > 0.5 ? 'run' : 'idle';
  // la pelota le pega
  if (!b.held && Math.abs(b.x - r.x) < 0.4 + BALL_R && b.y < r.y + PH && b.y > r.y) {
    const s = Math.hypot(b.vx, b.vy);
    if (s > 16) hurtPerson(m, r, 'hit', 1.2);
    if (Math.sign(b.vx) === Math.sign(r.x - b.x)) { b.vx = -b.vx * 0.4; b.x = r.x + Math.sign(b.x - r.x || 1) * (0.4 + BALL_R); emit(m, { type: 'bounce', power: 0.4 }); }
  }
}
const trapLike = (h: Hazard) => h.kind === 'spikes' || h.kind === 'flame' || h.kind === 'shock' || h.kind === 'laser';
// Una trampa que en este momento lastima.
export function isDanger(h: Hazard) { return trapLike(h) && h.state === 2; }

// ---------------------------------------------------------------- La pelota
function moveBall(m: Match, dt: number) {
  const b = m.ball, st = stageDef(m.stage);
  if (b.held) return;
  if (m.fatal && !m.fatal.done && m.phase === 'play') return;
  const steps = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 0.12) || 1, h = dt / steps;
  b.kindT = Math.max(0, b.kindT - dt); if (b.kindT <= 0 && b.kind !== 'normal') { b.kind = 'normal'; emit(m, { type: 'ballKind', kind: 'normal' }); }
  b.fxT = Math.max(0, b.fxT - dt); if (b.fxT <= 0) b.fx = 'none';
  if (b.frozen > 0) { b.frozen -= dt; b.vx *= Math.pow(0.001, dt); b.vy = Math.min(b.vy, 0); }
  for (let s = 0; s < steps; s++) {
    let g = 20 * st.gravity * (b.kind === 'void' ? 0.45 : 1);
    for (const hz of m.hazards) if (hz.kind === 'antigrav' && hz.state === 1 && b.x > hz.x && b.x < hz.x + hz.w) g = 2.5 + Math.sin(m.time * 3) * 2;
    b.vy -= g * h;
    if (b.kind === 'toxic' || b.fx === 'toxic') b.vy += Math.cos(m.time * 9) * 14 * h;
    b.vx *= Math.pow(b.kind === 'ice' ? 0.92 : 0.86, h); b.vy *= Math.pow(0.95, h);
    b.x += b.vx * h; b.y += b.vy * h;
    collideBallWorld(m, b, h);
    if (m.phase === 'play') for (const f of m.fighters) collideBallFighter(m, b, f);
  }
  b.spin += b.vx * dt * 2;
  m.trail.unshift([b.x, b.y]); if (m.trail.length > 14) m.trail.length = 14;
}
function collideBallWorld(m: Match, b: Ball, dt: number) {
  const st = stageDef(m.stage), fl = floorAt(m, b.x);
  if (b.y - BALL_R < fl) {
    b.y = fl + BALL_R;
    if (b.vy < -2) { emit(m, { type: 'bounce', power: Math.min(1, -b.vy / 15) }); b.vy = -b.vy * (b.kind === 'ice' ? 0.5 : 0.6); } else b.vy = 0;
    const fr = b.kind === 'ice' ? 0.05 : st.friction;
    b.vx *= Math.pow(0.35, fr * dt); b.vx -= Math.sign(b.vx) * Math.min(Math.abs(b.vx), 2.2 * fr * dt);
    for (const h of m.hazards) if (h.kind === 'conveyor' && b.x > h.x && b.x < h.x + h.w) b.vx += h.dir * 5 * dt;
  }
  for (const h of m.hazards) if (h.kind === 'block' && b.y < h.h - 0.1 && b.x + BALL_R > h.x && b.x - BALL_R < h.x + h.w) {
    if (b.x < h.x + h.w / 2) { b.x = h.x - BALL_R; b.vx = -Math.abs(b.vx) * 0.6; } else { b.x = h.x + h.w + BALL_R; b.vx = Math.abs(b.vx) * 0.6; }
  }
  if (b.y + BALL_R > H) { b.y = H - BALL_R; b.vy = -Math.abs(b.vy) * 0.6; }
  if (b.x - BALL_R < 0) { b.x = BALL_R; b.vx = Math.abs(b.vx) * 0.5; }
  if (b.x + BALL_R > W) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx) * 0.5; }
  for (const left of [true, false]) {
    const gh = goalHeight(m, teamAt(m, left)), x0 = left ? 0 : W - GOAL_DEPTH, x1 = left ? GOAL_DEPTH : W;
    if (b.x + BALL_R > x0 && b.x - BALL_R < x1 && b.y + BALL_R > gh && b.y - BALL_R < gh + BAR) {
      if (b.y > gh + BAR / 2) { b.y = gh + BAR + BALL_R; b.vy = Math.abs(b.vy) * 0.55; } else { b.y = gh - BALL_R; b.vy = -Math.abs(b.vy) * 0.55; }
      const front = left ? x1 : x0;
      if (Math.abs(b.x - front) < BALL_R + 0.1) b.vx = -b.vx * 0.7;
      if (Math.abs(b.vy) > 2) emit(m, { type: 'post' });
    }
  }
}
function collideBallFighter(m: Match, b: Ball, f: Fighter) {
  if (b.held) return;
  const x0 = f.x - PW / 2, x1 = f.x + PW / 2, y0 = f.y, y1 = f.y + PH * (f.slideT > 0 ? 0.35 : 1);
  const cx = clamp(b.x, x0, x1), cy = clamp(b.y, y0, y1), dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy);
  if (d >= BALL_R) return;
  const blocking = f.action === 'block' && Math.sign(b.x - f.x) === f.facing;
  let nx = dx / (d || 1), ny = dy / (d || 1);
  if (d === 0) { nx = Math.sign(b.x - f.x) || 1; ny = 0; }
  b.x = cx + nx * BALL_R; b.y = cy + ny * BALL_R;
  const rvx = b.vx - f.vx, rvy = b.vy - f.vy, vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    const e = blocking ? 0.2 : ny > 0.6 ? 0.75 : 0.35;
    b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
    if (ny > 0.6 && !f.ground && f.vy > 0) b.vy += 3; // cabezazo
    if (blocking && Math.abs(vn) > 6) { emit(m, { type: 'block' }); gainPower(m, f, 5); burst(m, b.x, b.y, 8, '#93c5fd', 'spark', 3); }
    const hard = !blocking && Math.abs(vn) > 7 && b.owner !== null && b.owner !== f.side;
    if (hard && (b.kind === 'spike' || b.kind === 'fire' || b.fx === 'fire')) hurtFighter(m, f, null, b.kind === 'spike' ? 'hit' : 'burn', 0.6, 5, 10);
    else if (hard && b.fx === 'toxic') hurtFighter(m, f, null, 'poison', 0.5, 2, 12);
    else if (hard && b.fx === 'volt') hurtFighter(m, f, null, 'zap', 0.5, 3, 10);
    else if (hard && b.fx === 'ice') hurtFighter(m, f, null, 'freeze', 0.9, 0, 8);
    if (hard && b.fx !== 'none') { b.fx = 'none'; b.fxT = 0; } // el efecto se gasta en el primer golpe
  }
  if (Math.abs(b.vx - f.vx) < 1) b.owner = f.side;
}

function checkGoal(m: Match) {
  const b = m.ball;
  if (m.phase !== 'play' || b.held) return;
  const viaFatal = (side: 0 | 1) => !!m.fatal && !m.fatal.done && m.fatal.side === side;
  for (const left of [true, false]) {
    const def = teamAt(m, left), inside = left ? b.x < GOAL_DEPTH - BALL_R * 0.3 : b.x > W - GOAL_DEPTH + BALL_R * 0.3;
    if (inside && b.y < goalHeight(m, def)) { const s = def === 0 ? 1 : 0; scoreGoal(m, s, viaFatal(s)); return; }
  }
}
function scoreGoal(m: Match, side: 0 | 1, fatal: boolean) {
  const f = m.fighters[side], rival = m.fighters[side === 0 ? 1 : 0];
  f.goals++; gainPower(m, rival, 50);
  m.lastGoal = { side, fatal }; m.phase = 'goal'; m.phaseT = 0; m.shake = fatal ? 1 : 0.5; m.flash = fatal ? 1 : 0.4;
  if (m.fatal) m.fatal.done = true;
  const b = m.ball; b.vx *= 0.25; b.vy = Math.min(b.vy, 2); b.fx = 'none'; b.held = null;
  burst(m, b.x, b.y, fatal ? 50 : 26, fatal ? CHARS[f.char].glow : '#ffffff', 'spark', fatal ? 9 : 6);
  if (m.extra) m.winner = side;
  emit(m, { type: 'goal', side, fatal });
}

// ---------------------------------------------------------------- Potenciadores y pelotas especiales
function updatePowerups(m: Match, dt: number) {
  m.nextPower -= dt;
  if (m.nextPower <= 0 && m.powerups.length < 2) {
    const kinds: PowerKind[] = ['shield', 'speed', 'magnet', 'power', 'giant', 'energy'];
    m.powerups.push({ id: m.nextId++, kind: kinds[Math.floor(m.rand() * kinds.length)], x: 5 + m.rand() * (W - 10), y: 2.2 + m.rand() * 1.8, t: 0 });
    m.nextPower = 16 + m.rand() * 8;
  }
  for (const p of m.powerups) {
    p.t += dt;
    for (const f of m.fighters) if (Math.abs(f.x - p.x) < 0.7 && p.y > f.y - 0.3 && p.y < f.y + PH + 0.4) {
      p.t = 99;
      if (p.kind === 'energy') { f.stamina = STAMINA; gainPower(m, f, 100); } else f.powers[p.kind] = POWERS[p.kind].time;
      burst(m, p.x, p.y, 20, POWERS[p.kind].color, 'ring', 2);
      emit(m, { type: 'power', side: f.side, kind: p.kind });
      break;
    }
  }
  m.powerups = m.powerups.filter(p => p.t < 12);
  m.nextBall -= dt;
  if (m.nextBall <= 0 && !m.ball.held) {
    const kinds: Exclude<BallKind, 'normal'>[] = ['toxic', 'fire', 'ice', 'spike', 'void'];
    m.ball.kind = kinds[Math.floor(m.rand() * kinds.length)]; m.ball.kindT = 12;
    burst(m, m.ball.x, m.ball.y, 20, BALLS[m.ball.kind].color, 'ring', 2);
    emit(m, { type: 'ballKind', kind: m.ball.kind });
    m.nextBall = 28 + m.rand() * 12;
  }
}

// ---------------------------------------------------------------- Trampas y peligros
// Ciclo de las trampas del piso: apagada → aviso (0,9 s) → encendida (1,6 s).
function trapCycle(h: Hazard) { const c = ((h.t % h.period) + h.period) % h.period; return c < h.period - 2.5 ? 0 : c < h.period - 1.6 ? 1 : 2; }
function updateHazards(m: Match, dt: number) {
  const b = m.ball, r = m.rand;
  m.nextHazard -= dt;
  const spawn = (kind: Hazard['kind'], x: number, w: number, warn: number) => { m.hazards.push({ kind, x, y: H, w, h: 0, t: -warn, state: 0, dir: 1, id: m.nextId++, period: 0 }); emit(m, { type: 'warn' }); };
  if (m.nextHazard <= 0) {
    const x = 5 + r() * (W - 10);
    switch (m.stage) {
      case 'city': spawn('arc', x, 1.2, 1.1); m.nextHazard = 7 + r() * 4; break;
      case 'volcano': spawn('meteor', x, 1.8, 1.3); m.nextHazard = 4.5 + r() * 3; break;
      case 'glacier': spawn('icicle', x, 0.9, 1); m.nextHazard = 4.5 + r() * 4; break;
      case 'graveyard': spawn('hand', x, 0.9, 1); m.nextHazard = 4 + r() * 3; break;
      case 'storm':
        if (r() < 0.6) spawn('lightning', x, 1.3, 1.1);
        else { m.hazards.push({ kind: 'gust', x: 0, y: 0, w: 0, h: 0, t: -1, state: 0, dir: r() < 0.5 ? -1 : 1, id: m.nextId++, period: 0 }); emit(m, { type: 'warn' }); }
        m.nextHazard = 5 + r() * 3; break;
      case 'desert': if (!m.hazards.some(h => h.kind === 'tornado')) m.hazards.push({ kind: 'tornado', x: r() < 0.5 ? 3 : W - 3, y: 0, w: 2, h: 8, t: 0, state: 0, dir: 0, id: m.nextId++, period: 0 }); m.nextHazard = 12 + r() * 6; break;
      default: m.nextHazard = 99;
    }
  }
  const hit = (x0: number, x1: number, y0: number, y1: number, kind: StunKind, time: number, push: number, drain: number, h?: Hazard) => {
    const ok = (bit: number) => { if (!h) return true; if ((h.struck ?? 0) & bit) return false; h.struck = (h.struck ?? 0) | bit; return true; };
    const inside = (x: number, y: number) => x + PW / 2 > x0 && x - PW / 2 < x1 && y < y1 && y + PH > y0;
    m.fighters.forEach((f, i) => { if (f.stun <= 0 && inside(f.x, f.y) && ok(1 << i)) hurtFighter(m, f, null, kind, time, push, drain); });
    [...m.keepers, m.ref].forEach((p, i) => { if (p.action !== 'gone' && inside(p.x, p.y) && ok(4 << i)) hurtPerson(m, p, kind, p.role === 'ref' ? 1.2 : 2); });
  };
  for (const h of m.hazards) {
    h.t += dt;
    switch (h.kind) {
      case 'spikes': case 'flame': case 'shock': case 'laser': {
        const before = h.state; h.state = trapCycle(h);
        if (h.state === 2 && before !== 2) emit(m, { type: 'trap', kind: h.kind });
        if (h.state !== 2) { h.struck = 0; break; }
        const top = h.kind === 'flame' ? 3.2 : h.kind === 'laser' ? h.h : 0.7;
        hit(h.x, h.x + h.w, 0, top, h.kind === 'flame' ? 'burn' : h.kind === 'spikes' ? 'hit' : 'zap', 0.9, h.kind === 'spikes' ? 6 : 5, h.kind === 'spikes' ? 18 : 15, h);
        // la pelota: rebota en los pinches, se prende fuego o se electrifica
        if (!b.held && b.x > h.x - BALL_R && b.x < h.x + h.w + BALL_R && b.y < top + BALL_R) {
          if (h.kind === 'spikes' && b.y < 0.8) { b.vy = Math.max(b.vy, 9); b.vx += (b.x - (h.x + h.w / 2)) * 4; }
          if (h.kind === 'flame') { b.fx = 'fire'; b.fxT = 1.2; b.vy = Math.max(b.vy, 6); b.owner = null; }
          if (h.kind === 'shock' || h.kind === 'laser') { b.fx = 'volt'; b.fxT = 0.8; b.owner = null; }
        }
        break;
      }
      case 'wreck': {
        const a = Math.sin(m.time * 0.8) * 0.95, bx = h.x + Math.sin(a) * h.h, by = h.y - Math.cos(a) * h.h, R = 0.95;
        h.dir = a;
        const dx = b.x - bx, dy = b.y - by, d = Math.hypot(dx, dy);
        if (!b.held && d < R + BALL_R) { const nx = dx / d, ny = dy / d; b.x = bx + nx * (R + BALL_R); b.y = by + ny * (R + BALL_R); const vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 1.8 * vn * nx; b.vy -= 1.8 * vn * ny; } emit(m, { type: 'post' }); }
        if (Math.abs(a) > 0.9) h.struck = 0;
        hit(bx - R, bx + R, by - R, by + R, 'hit', 0.9, 10, 20, h);
        break;
      }
      case 'conveyor': {
        const s = Math.floor(m.time / 8) % 2; if (s !== h.state) { h.state = s; h.dir = s ? -1 : 1; }
        for (const f of m.fighters) if (f.ground && f.x > h.x && f.x < h.x + h.w) f.x = clamp(f.x + h.dir * 2.4 * dt, 0.5, W - 0.5);
        break;
      }
      case 'lava':
        if (Math.floor(h.t * 0.8) !== h.state) { h.state = Math.floor(h.t * 0.8); h.struck = 0; }
        hit(h.x + 0.2, h.x + h.w - 0.2, 0, 0.3, 'burn', 1.1, 0, 20, h);
        for (const f of m.fighters) if (f.stun > 0 && f.stunKind === 'burn' && f.ground && f.x > h.x && f.x < h.x + h.w) { f.vy = 9; f.ground = false; f.vx = (f.x < W / 2 ? 1 : -1) * 6; }
        break;
      case 'antigrav': h.state = (m.time % 12) > 6 ? 1 : 0; break;
      case 'airlock': {
        const cyc = ((h.t % 14) + 14) % 14; h.dir = Math.floor(h.t / 14) % 2 ? 1 : -1;
        h.state = cyc > 9 && cyc < 10.5 ? 1 : cyc >= 10.5 && cyc < 13.5 ? 2 : 0;
        if (h.state === 2) { if (!b.held) b.vx += h.dir * 7 * dt; for (const f of m.fighters) f.x = clamp(f.x + h.dir * 1.3 * dt, 0.5, W - 0.5); }
        break;
      }
      case 'arc': case 'lightning': case 'meteor': case 'icicle': case 'hand': {
        if (h.t >= 0 && h.state === 0) {
          h.state = 1;
          const x0 = h.x - h.w / 2, x1 = h.x + h.w / 2;
          if (h.kind === 'hand') { for (const f of m.fighters) if (f.ground && f.x > x0 - 0.3 && f.x < x1 + 0.3) hurtFighter(m, f, null, 'grab', 1.3, 0, 8); emit(m, { type: 'trap', kind: 'hand' }); }
          else {
            const kind: StunKind = h.kind === 'icicle' ? 'freeze' : h.kind === 'meteor' ? 'burn' : 'zap';
            hit(x0 - 0.3, x1 + 0.3, 0, H, kind, h.kind === 'icicle' ? 1.1 : 0.9, h.kind === 'icicle' ? 0 : 8, 18);
            if (!b.held && Math.abs(b.x - h.x) < h.w / 2 + 0.6 && (h.kind !== 'icicle' || b.y < 3)) { b.vy = 12 + r() * 4; b.vx += (b.x - h.x) * 6; }
            m.shake = Math.max(m.shake, h.kind === 'meteor' ? 0.7 : 0.4);
            if (h.kind !== 'icicle') m.flash = Math.max(m.flash, 0.3);
            burst(m, h.x, 0.2, h.kind === 'meteor' ? 30 : 16, h.kind === 'meteor' ? '#fb923c' : h.kind === 'icicle' ? '#e0f2fe' : '#fde047', h.kind === 'meteor' ? 'ember' : h.kind === 'icicle' ? 'shard' : 'spark', 6);
            emit(m, { type: h.kind === 'meteor' ? 'boom' : h.kind === 'icicle' ? 'block' : 'thunder' });
          }
        }
        break;
      }
      case 'gust': if (h.t > 0) { if (!b.held) b.vx += h.dir * 9 * dt; for (const f of m.fighters) if (!f.ground) f.vx += h.dir * 6 * dt; } break;
      case 'tornado': {
        if (!h.dir) h.dir = h.x < W / 2 ? 1 : -1;
        h.x += h.dir * 2.2 * dt;
        if (!b.held && Math.abs(b.x - h.x) < h.w / 2 + BALL_R && b.y < h.h) { b.vy += 34 * dt; b.vx += (h.x - b.x) * 6 * dt + h.dir * 3 * dt; }
        m.fighters.forEach((f, i) => { if (Math.abs(f.x - h.x) < h.w / 2 && f.stun <= 0 && !((h.struck ?? 0) & (1 << i))) { h.struck = (h.struck ?? 0) | (1 << i); hurtFighter(m, f, null, 'hit', 0.9, 0, 10); f.vy = 13; f.ground = false; f.vx = h.dir * 5; } });
        if (Math.abs(m.ref.x - h.x) < h.w / 2) hurtPerson(m, m.ref, 'hit', 1.2);
        break;
      }
      case 'blackhole': if (!b.held) { const dx = h.x - b.x, dy = h.y - b.y, d = Math.max(1.2, Math.hypot(dx, dy)); b.vx += dx / d * 30 / d * dt; b.vy += dy / d * 30 / d * dt; } break;
      case 'portal': {
        const other = m.hazards.find(o => o.kind === 'portal' && o !== h);
        if (other && !b.held && Math.hypot(b.x - h.x, b.y - h.y) < 0.65 && m.time - h.w > 1) { m.trail = []; b.x = other.x + Math.sign(b.vx || 1) * 0.8; b.y = other.y; other.w = m.time; h.w = m.time; burst(m, other.x, other.y, 14, '#c084fc', 'smoke', 2); emit(m, { type: 'zap' }); }
        break;
      }
    }
  }
  m.hazards = m.hazards.filter(h => !((h.kind === 'arc' || h.kind === 'lightning' || h.kind === 'meteor' || h.kind === 'icicle' || h.kind === 'hand') && h.t > 1.3) && !(h.kind === 'gust' && h.t > 3) && !(h.kind === 'tornado' && (h.x < -1 || h.x > W + 1)));
}

function fighterCollide(m: Match) {
  const [a, b] = m.fighters, dx = b.x - a.x, overlap = PW - Math.abs(dx);
  if (overlap > 0 && Math.abs(a.y - b.y) < PH * 0.8) { const s = Math.sign(dx) || 1; a.x = clamp(a.x - s * overlap / 2, 0.5, W - 0.5); b.x = clamp(b.x + s * overlap / 2, 0.5, W - 0.5); }
}

// ---------------------------------------------------------------- Partículas
export function burst(m: Match, x: number, y: number, n: number, color: string, kind: Particle['kind'], speed: number) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
    m.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + (kind === 'ember' || kind === 'smoke' || kind === 'bubble' ? 1.5 : 0), life: kind === 'ring' ? 0.5 : 0.4 + Math.random() * 0.6, max: 1, size: kind === 'smoke' ? 0.25 + Math.random() * 0.3 : kind === 'ring' ? 0.2 : 0.05 + Math.random() * 0.08, color, kind });
    if (kind === 'ring') break;
  }
  if (m.particles.length > 600) m.particles.splice(0, m.particles.length - 600);
}
function updateParticles(m: Match, dt: number) {
  for (const p of m.particles) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.kind === 'spark' || p.kind === 'shard' || p.kind === 'blood') p.vy -= 12 * dt;
    if (p.kind === 'blood' && p.y < 0.02) { p.y = 0.02; p.vy = 0; p.vx = 0; }
    if (p.kind === 'smoke') { p.size += dt * 0.6; p.vx *= Math.pow(0.3, dt); p.vy *= Math.pow(0.5, dt); }
    if (p.kind === 'ring') p.size += dt * 6;
  }
  m.particles = m.particles.filter(p => p.life > 0);
}

// ---------------------------------------------------------------- La máquina
function cpuThink(m: Match, side: 0 | 1, c: CpuState, dt: number): Input {
  const f = m.fighters[side], rival = m.fighters[side === 0 ? 1 : 0], b = m.ball, dir = attackDir(m, side);
  const ownX = ownGoalX(m, side), goalX = ownGoalX(m, side === 0 ? 1 : 0);
  c.think -= dt;
  const plan = c.plan;
  plan.kick = false; plan.cast = null; plan.up = false;
  if (m.fatal && !m.fatal.done && m.fatal.side !== side) {
    // decide una sola vez si llega a reaccionar (cuanto mejor la máquina, más seguido)
    const before = c.reactFatal; c.reactFatal += dt;
    const at = 0.55 - c.level * 0.35;
    if (before < at && c.reactFatal >= at && f.power >= COST.defense && m.rand() < 0.2 + c.level * 0.45) plan.cast = 'defense';
    return { ...plan };
  }
  c.reactFatal = 0;
  if (c.think > 0) return { ...plan };
  c.think = 0.3 - c.level * 0.22 + m.rand() * 0.08;
  plan.left = false; plan.right = false; plan.down = false;
  const ahead = (b.x - f.x) * dir; // >0: la pelota está entre él y el arco rival
  const toGoal = Math.abs(goalX - f.x);
  let targetX: number;
  if (b.held) targetX = b.held.team === side ? f.x + dir * 3 : W / 2 - dir * 3; // el arquero la tiene: se acomoda
  else if (ahead > -0.3) targetX = b.x - dir * 0.5;
  else targetX = b.x - dir * 1.2; // del lado equivocado: rodea
  // cansado y lejos de la pelota: camina para recuperar energía
  const tiredWalk = f.stamina < 25 + (1 - c.level) * 15 && Math.abs(b.x - f.x) > 6;
  const dx = targetX - f.x;
  if (Math.abs(dx) > 0.15) { if (dx > 0) plan.right = true; else plan.left = true; }
  if (tiredWalk && m.rand() < 0.6) { plan.left = false; plan.right = false; }
  if (ahead < -0.2 && Math.abs(b.x - f.x) < 1.4 && b.y < 1.2 && f.ground && m.rand() < 0.5) plan.up = true; // salta la pelota para ponerse detrás
  if (b.y > 2 && b.y < 4 && Math.abs(b.x - f.x) < 1.5 && f.ground && m.rand() < 0.3 + c.level * 0.3) plan.up = true; // cabezazo
  // trampas encendidas o por encenderse adelante: frena (o salta los pinches)
  const go = Math.sign(dx);
  for (const h of m.hazards) {
    if (!trapLike(h) && h.kind !== 'lava') continue;
    const dist = go > 0 ? h.x - (f.x + PW / 2) : f.x - PW / 2 - (h.x + h.w);
    const on = f.x + PW / 2 > h.x && f.x - PW / 2 < h.x + h.w;
    if (on && h.kind !== 'lava' && h.state === 1 && m.rand() < 0.3 + c.level * 0.65) { const out = f.x < h.x + h.w / 2 ? -1 : 1; plan.left = out < 0; plan.right = out > 0; break; } // salir antes de que se encienda
    if (dist < -0.1 || dist > 0.6 + c.level * 1.4) continue;
    if (h.kind === 'lava') { if (f.ground && dist < 0.7 && m.rand() < 0.5 + c.level * 0.5) plan.up = true; }
    else if (h.state !== 0 && m.rand() < 0.3 + c.level * 0.65) { plan.left = false; plan.right = false; }
    else if (h.kind === 'spikes' && f.ground && dist < 0.6) plan.up = true;
  }
  const near = Math.hypot(b.x - (f.x + dir * 0.5), b.y - (f.y + 0.5));
  // patear: con la pelota adelante
  if (!b.held && (near < 1.2 || (ahead > 0.2 && ahead < 1.8 && Math.abs(b.y - f.y - 0.5) < 0.9)) && ahead > -0.1 && f.kickT <= 0 && m.rand() < 0.45 + c.level * 0.55) {
    if (f.facing !== dir) { if (dir > 0) plan.right = true; else plan.left = true; }
    else if (f.power >= COST.shot && toGoal < 12 && m.rand() < 0.2 + c.level * 0.45) plan.cast = 'shot'; // tiro especial cerca del arco
    else if (toGoal < 15 || m.rand() < 0.3) {
      plan.kick = true;
      const keeper = m.keepers[side === 0 ? 1 : 0];
      if (toGoal < 9 && keeper.action !== 'down' && keeper.action !== 'stun' && m.rand() < 0.45) plan.up = true; // globo por arriba del arquero
      else if (Math.abs(rival.x - f.x) < 3 && (rival.x - f.x) * dir > 0 && m.rand() < 0.5) plan.up = true;
    }
  }
  // barrida si el rival tiene la pelota cerca
  const rivalHas = Math.abs(rival.x - b.x) < 1 && Math.abs(f.x - rival.x) < 2.2 && Math.abs(f.vx) > 3.5;
  if (rivalHas && m.rand() < 0.15 + c.level * 0.3) { plan.down = true; plan.kick = true; }
  // golpe especial y FATAL
  if (f.power >= COST.fatal && !m.fatal && m.rand() < 0.1 + c.level * 0.25) plan.cast = 'fatal';
  else if (f.power >= COST.attack && Math.abs(rival.x - f.x) < 3.5 && m.rand() < 0.08 + c.level * 0.2) plan.cast = 'attack';
  // defensa: tiro fuerte que viene a su arco
  if (f.power >= COST.defense && Math.sign(b.vx) === -dir && Math.abs(b.vx) > 13 && Math.abs(b.x - ownX) < 9 && m.rand() < 0.2 + c.level * 0.4) plan.cast = 'defense';
  // potenciador cerca
  const pu = m.powerups.find(p => Math.abs(p.x - f.x) < 3);
  if (pu && Math.abs(b.x - f.x) > 3) { plan.left = pu.x < f.x; plan.right = pu.x > f.x; if (pu.y > 3 && Math.abs(pu.x - f.x) < 1.2 && f.ground) plan.up = true; }
  return { ...plan };
}

export const clockText = (s: number) => `${String(Math.floor(Math.ceil(s) / 60)).padStart(2, '0')}:${String(Math.ceil(s) % 60).padStart(2, '0')}`;
// Las flechas de una combinación para quien ataca hacia "dir" (1: a la derecha).
export function comboKeys(mv: Move, dir: 1 | -1): string[] { return COMBOS[mv].map(d => d === 'U' ? '↑' : d === 'D' ? '↓' : (d === 'F') === (dir > 0) ? '→' : '←'); }
