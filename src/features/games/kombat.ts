// Lógica de Kombat Football: fútbol 1 contra 1 visto de costado, mezclado con peleas al estilo Mortal Kombat.
// Dos jugadores en una cancha horizontal, cada uno defiende su arco (el 0 el de la izquierda, el 1 el de la
// derecha). Se corre, se salta, se patea (a la pelota o al rival), se bloquea, y cada personaje tiene un ataque
// especial y una habilidad defensiva que se recargan. Con la barra de energía llena se tira el FATAL GOAL: un
// disparo espectacular que solo se puede frenar con la habilidad defensiva del rival.
// Los escenarios tienen peligros propios (meteoritos, bola de demolición, hielo, láseres, tormentas…), aparecen
// potenciadores y pelotas especiales. Todo se mide en metros de juego: la cancha mide W de largo, el piso está en
// y = 0 y para arriba es positivo.

export const W = 16; // largo de la cancha
export const H = 8.2; // alto hasta el techo
export const GOAL_DEPTH = 1.4; // qué tan hondo es el arco
export const GOAL_H = 2.7; // alto del travesaño
export const BAR = 0.18; // grosor del travesaño
export const BALL_R = 0.36;
export const PW = 0.9; // ancho de un jugador
export const PH = 1.9; // alto de un jugador
export const MATCH_TIME = 120; // 2 minutos
export const ENERGY_MAX = 100;
export const SPECIAL_CD = 8; // segundos para recargar el ataque especial
export const DEFENSE_CD = 11; // y la habilidad defensiva
export const FATAL_CINE = 1.4; // la presentación del FATAL GOAL (todo se congela)
export const TOURNAMENT = 10;

export type CharId = 'toxic' | 'bull' | 'frost' | 'volt' | 'void';
export type StageId = 'city' | 'factory' | 'volcano' | 'glacier' | 'lab' | 'space' | 'graveyard' | 'storm' | 'desert' | 'arena';
export type PowerKind = 'shield' | 'speed' | 'magnet' | 'power' | 'giant' | 'energy';
export type BallKind = 'normal' | 'toxic' | 'fire' | 'ice' | 'spike' | 'void';

export interface CharDef {
  id: CharId; name: string; element: string; color: string; glow: string;
  special: string; specialText: string; defense: string; defenseText: string; fatal: string; fatalText: string;
  speed: number; jump: number; kick: number;
}
export const CHARS: Record<CharId, CharDef> = {
  toxic: { id: 'toxic', name: 'TÓXICO', element: 'Veneno', color: '#4ade80', glow: '#86efac', speed: 1, jump: 1, kick: 1,
    special: 'Escupitajo ácido', specialText: 'Lanza un chorro tóxico: si toca al rival lo envenena (lo frena); si toca la pelota la manda al arco.',
    defense: 'Nube tóxica', defenseText: 'Una nube de gas frente a su arco: la pelota pierde velocidad y el rival que entra se envenena.',
    fatal: 'BOMBA ÁCIDA', fatalText: 'La pelota se vuelve una calavera de ácido que vuela ondulando hasta el arco.' },
  bull: { id: 'bull', name: 'TORO', element: 'Fuego', color: '#ef4444', glow: '#fb923c', speed: 0.95, jump: 0.95, kick: 1.12,
    special: 'Embestida de fuego', specialText: 'Carga envuelto en llamas: voltea al rival y, si agarra la pelota, la patea con fuego.',
    defense: 'Muro de fuego', defenseText: 'Levanta una pared de llamas frente a su arco que rechaza la pelota.',
    fatal: 'METEORITO', fatalText: 'Patea la pelota al cielo y cae como un meteorito en llamas sobre el arco rival.' },
  frost: { id: 'frost', name: 'ESCARCHA', element: 'Hielo', color: '#60a5fa', glow: '#bae6fd', speed: 1, jump: 1.02, kick: 1,
    special: 'Aliento helado', specialText: 'Sopla hielo hacia adelante: congela al rival y frena la pelota en seco.',
    defense: 'Muro de hielo', defenseText: 'Un bloque de hielo sólido tapa su arco por unos segundos.',
    fatal: 'AVALANCHA', fatalText: 'La pelota se vuelve una bola de hielo gigante que rueda arrasando todo.' },
  volt: { id: 'volt', name: 'RAYO', element: 'Electricidad', color: '#facc15', glow: '#fef08a', speed: 1.1, jump: 1.05, kick: 0.95,
    special: 'Supervelocidad', specialText: 'Corre el doble de rápido un rato, y sus patadas electrocutan.',
    defense: 'Campo magnético', defenseText: 'Un campo eléctrico a su alrededor que repele la pelota.',
    fatal: 'RELÁMPAGO', fatalText: 'La pelota salta en zigzag como un rayo hasta meterse en el arco.' },
  void: { id: 'void', name: 'VACÍO', element: 'Oscuridad', color: '#a855f7', glow: '#d8b4fe', speed: 1, jump: 1, kick: 1.02,
    special: 'Teletransporte', specialText: 'Desaparece y aparece detrás de la pelota, listo para patear.',
    defense: 'Portal', defenseText: 'Abre un portal frente a su arco: la pelota que entra sale por el otro lado de la cancha.',
    fatal: 'AGUJERO NEGRO', fatalText: 'Un agujero negro atrapa al rival mientras la pelota gira en espiral hasta el arco.' },
};
export const CHAR_IDS: CharId[] = ['toxic', 'bull', 'frost', 'volt', 'void'];

export interface StageDef { id: StageId; name: string; hazard: string; gravity: number; friction: number }
export const STAGES: StageDef[] = [
  { id: 'city', name: 'Ciudad Tóxica', hazard: 'Charcos tóxicos que frenan y arcos eléctricos de las torres', gravity: 1, friction: 1 },
  { id: 'factory', name: 'Fábrica Abandonada', hazard: 'Una bola de demolición con pinchos y una cinta transportadora', gravity: 1, friction: 1 },
  { id: 'volcano', name: 'Volcán', hazard: 'Lluvia de meteoritos y pozos de lava', gravity: 1, friction: 1 },
  { id: 'glacier', name: 'Glaciar', hazard: 'Piso que resbala, bloques de hielo y carámbanos que caen', gravity: 1, friction: 0.25 },
  { id: 'lab', name: 'Laboratorio', hazard: 'Láseres que se prenden y una zona antigravedad', gravity: 1, friction: 1 },
  { id: 'space', name: 'Estación Espacial', hazard: 'Gravedad baja y compuertas que chupan todo hacia un lado', gravity: 0.55, friction: 1 },
  { id: 'graveyard', name: 'Cementerio', hazard: 'Manos de zombis que salen del piso y te agarran', gravity: 1, friction: 1 },
  { id: 'storm', name: 'Azotea en Tormenta', hazard: 'Rayos que caen y ráfagas de viento', gravity: 1, friction: 1 },
  { id: 'desert', name: 'Desierto', hazard: 'Un tornado que cruza la cancha y levanta todo', gravity: 1, friction: 1 },
  { id: 'arena', name: 'Coliseo del Vacío', hazard: 'Un agujero negro que atrae la pelota y portales', gravity: 1, friction: 1 },
];
export const stageDef = (id: StageId) => STAGES.find(s => s.id === id) ?? STAGES[0];

export const POWERS: Record<PowerKind, { name: string; text: string; color: string; time: number }> = {
  shield: { name: 'Escudo', text: 'no te pueden voltear', color: '#38bdf8', time: 8 },
  speed: { name: 'Turbo', text: 'corrés y saltás más', color: '#22c55e', time: 8 },
  magnet: { name: 'Imán', text: 'la pelota viene hacia vos', color: '#ec4899', time: 7 },
  power: { name: 'Súper patada', text: 'pateás mucho más fuerte', color: '#a855f7', time: 8 },
  giant: { name: 'Arco gigante', text: 'el arco del rival se agranda', color: '#f97316', time: 10 },
  energy: { name: 'Energía', text: '+50 de energía', color: '#facc15', time: 0 },
};
export const BALLS: Record<Exclude<BallKind, 'normal'>, { name: string; text: string; color: string }> = {
  toxic: { name: 'Pelota tóxica', text: 'se mueve sola, para cualquier lado', color: '#4ade80' },
  fire: { name: 'Pelota de fuego', text: 'más rápida, y quema si te pega', color: '#f97316' },
  ice: { name: 'Pelota de hielo', text: 'resbala y casi no frena', color: '#38bdf8' },
  spike: { name: 'Pelota con pinchos', text: 'si te pega en el cuerpo te voltea', color: '#9ca3af' },
  void: { name: 'Pelota del vacío', text: 'flota como en la Luna', color: '#a855f7' },
};

export interface Input { left: boolean; right: boolean; up: boolean; down: boolean; kick: boolean; block: boolean; special: boolean; defense: boolean; fatal: boolean }
export const noInput = (): Input => ({ left: false, right: false, up: false, down: false, kick: false, block: false, special: false, defense: false, fatal: false });

export type Action = 'idle' | 'run' | 'jump' | 'kick' | 'block' | 'stun' | 'special' | 'celebrate' | 'sad' | 'fatal';
export interface Fighter {
  side: 0 | 1; char: CharId;
  x: number; y: number; vx: number; vy: number; facing: 1 | -1; ground: boolean;
  action: Action; actionT: number; // qué está haciendo y hace cuánto
  kickT: number; kickUp: number; kickHit: boolean; // la patada en curso (kickUp: -1 rasante, 0 normal, 1 globo)
  stun: number; stunKind: 'hit' | 'freeze' | 'poison' | 'burn' | 'zap' | 'grab' | 'none';
  poison: number; // envenenado: corre más lento
  energy: number; specialCd: number; defenseCd: number;
  speedT: number; // supervelocidad de Rayo
  dashT: number; // embestida de Toro
  powers: Partial<Record<PowerKind, number>>;
  prev: Input; // botones del cuadro anterior (para detectar el momento en que se aprieta)
  goals: number;
}
export interface Ball { x: number; y: number; vx: number; vy: number; spin: number; kind: BallKind; kindT: number; owner: 0 | 1 | null; fx: 'none' | 'toxic' | 'fire' | 'ice' | 'volt'; fxT: number; frozen: number }
// Lo que deja cada habilidad defensiva (y el escupitajo) en la cancha.
export interface Shield { kind: 'cloud' | 'firewall' | 'icewall' | 'field' | 'portal'; side: 0 | 1; x: number; y: number; w: number; h: number; t: number; life: number }
export interface Shot { kind: 'acid' | 'breath'; side: 0 | 1; x: number; y: number; vx: number; t: number; life: number; hit: boolean }
export interface Fatal { side: 0 | 1; char: CharId; t: number; x0: number; y0: number; blocked: boolean; done: boolean }
export interface PowerUp { id: number; kind: PowerKind; x: number; y: number; t: number }
export interface Hazard {
  kind: 'puddle' | 'arc' | 'wreck' | 'conveyor' | 'meteor' | 'lava' | 'block' | 'icicle' | 'laser' | 'antigrav' | 'airlock' | 'hand' | 'lightning' | 'gust' | 'tornado' | 'blackhole' | 'portal';
  x: number; y: number; w: number; h: number; t: number; state: number; dir: number; id: number;
}
export type KfEvent =
  | { type: 'kick'; power: number } | { type: 'hit'; side: 0 | 1; kind: Fighter['stunKind'] } | { type: 'block' } | { type: 'goal'; side: 0 | 1; fatal: boolean }
  | { type: 'bounce'; power: number } | { type: 'post' } | { type: 'jump' } | { type: 'special'; side: 0 | 1; char: CharId } | { type: 'defense'; side: 0 | 1; char: CharId }
  | { type: 'fatal'; side: 0 | 1; char: CharId } | { type: 'fatalBlocked'; side: 0 | 1 } | { type: 'power'; side: 0 | 1; kind: PowerKind } | { type: 'ballKind'; kind: BallKind }
  | { type: 'boom' } | { type: 'thunder' } | { type: 'zap' } | { type: 'whistle'; kind: 'kickoff' | 'end' } | { type: 'extra' } | { type: 'warn' };
export type Phase = 'intro' | 'play' | 'goal' | 'fatal' | 'end';
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'spark' | 'smoke' | 'shard' | 'bubble' | 'ember' | 'flash' | 'ring' }

export interface Match {
  stage: StageId; fighters: [Fighter, Fighter]; ball: Ball; trail: [number, number][];
  phase: Phase; phaseT: number; time: number; clock: number; extra: boolean; extraT: number;
  shields: Shield[]; shots: Shot[]; fatal: Fatal | null; powerups: PowerUp[]; hazards: Hazard[]; particles: Particle[];
  nextPower: number; nextBall: number; nextHazard: number; nextId: number;
  lastGoal: { side: 0 | 1; fatal: boolean } | null; winner: 0 | 1 | null;
  events: KfEvent[]; shake: number; flash: number; rand: () => number;
  cpu: [CpuState | null, CpuState | null];
}
export interface CpuState { level: number; think: number; plan: Input; reactFatal: number }

export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const emit = (m: Match, e: KfEvent) => { m.events.push(e); };
export function takeEvents(m: Match) { const e = m.events; m.events = []; return e; }
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function newFighter(side: 0 | 1, char: CharId): Fighter {
  return { side, char, x: side === 0 ? W * 0.3 : W * 0.7, y: 0, vx: 0, vy: 0, facing: side === 0 ? 1 : -1, ground: true, action: 'idle', actionT: 0,
    kickT: 0, kickUp: 0, kickHit: false, stun: 0, stunKind: 'none', poison: 0, energy: 0, specialCd: 2, defenseCd: 3, speedT: 0, dashT: 0, powers: {}, prev: noInput(), goals: 0 };
}
// Arma los peligros fijos de cada escenario (los que aparecen al azar se agregan durante el partido).
function stageHazards(m: Match): Hazard[] {
  const hz = (kind: Hazard['kind'], x: number, y: number, w: number, h: number, extra: Partial<Hazard> = {}): Hazard => ({ kind, x, y, w, h, t: 0, state: 0, dir: 1, id: m.nextId++, ...extra });
  switch (m.stage) {
    case 'city': return [hz('puddle', W * 0.26, 0, 1.8, 0.1), hz('puddle', W * 0.74 - 1.8, 0, 1.8, 0.1)];
    case 'factory': return [hz('wreck', W / 2, H + 0.6, 0, 5.3), hz('conveyor', W / 2 - 2.5, 0, 5, 0.25, { dir: 1, t: 0 })];
    case 'volcano': return [hz('lava', W * 0.2, 0, 1.2, 0.1), hz('lava', W * 0.8 - 1.2, 0, 1.2, 0.1)];
    case 'glacier': return [hz('block', W * 0.3, 0, 1.8, 0.95), hz('block', W * 0.7 - 1.8, 0, 1.8, 0.95)];
    case 'lab': return [hz('laser', W * 0.33, 0, 0.2, H, { t: 0 }), hz('laser', W * 0.67 - 0.2, 0, 0.2, H, { t: 2.5 }), hz('antigrav', W / 2 - 1.6, 0, 3.2, H)];
    case 'space': return [hz('airlock', 0, 0, 0, 0, { t: -6 })];
    case 'arena': return [hz('blackhole', W / 2, 6.4, 0, 0), hz('portal', W * 0.22, 4.6, 0, 0, { state: 0 }), hz('portal', W * 0.78, 4.6, 0, 0, { state: 1 })];
    default: return [];
  }
}
export function newMatch(stage: StageId, chars: [CharId, CharId], cpuLevels: [number | null, number | null], rand: () => number = Math.random): Match {
  const m: Match = {
    stage, fighters: [newFighter(0, chars[0]), newFighter(1, chars[1])],
    ball: { x: W / 2, y: 5, vx: 0, vy: 0, spin: 0, kind: 'normal', kindT: 0, owner: null, fx: 'none', fxT: 0, frozen: 0 }, trail: [],
    phase: 'intro', phaseT: 0, time: 0, clock: MATCH_TIME, extra: false, extraT: 0,
    shields: [], shots: [], fatal: null, powerups: [], hazards: [], particles: [],
    nextPower: 12, nextBall: 28, nextHazard: 4, nextId: 1, lastGoal: null, winner: null,
    events: [], shake: 0, flash: 0, rand,
    cpu: [cpuLevels[0] === null ? null : newCpu(cpuLevels[0]), cpuLevels[1] === null ? null : newCpu(cpuLevels[1])],
  };
  m.hazards = stageHazards(m);
  return m;
}
const newCpu = (level: number): CpuState => ({ level, think: 0, plan: noInput(), reactFatal: 0 });

// El arco que ataca cada uno: el 0 ataca el de la derecha, el 1 el de la izquierda.
export const attackDir = (side: 0 | 1) => side === 0 ? 1 : -1;
// Alto del arco (crece con el potenciador "Arco gigante" del rival y durante el tiempo extra).
export function goalHeight(m: Match, side: 0 | 1) {
  const rival = m.fighters[side === 0 ? 1 : 0];
  return Math.min(6.5, GOAL_H + ((rival.powers.giant ?? 0) > 0 ? 1.7 : 0) + (m.extra ? Math.min(2, Math.floor(m.extraT / 20) * 0.6) : 0));
}

function resetKickoff(m: Match, toward: 0 | 1 | null) {
  const b = m.ball;
  b.x = toward === null ? W / 2 : W / 2 + (toward === 0 ? -1.2 : 1.2); b.y = 5; b.vx = 0; b.vy = 0; b.spin = 0; b.owner = null; b.fx = 'none'; b.fxT = 0; b.frozen = 0;
  m.trail = [];
  for (const f of m.fighters) {
    f.x = f.side === 0 ? W * 0.3 : W * 0.7; f.y = 0; f.vx = 0; f.vy = 0; f.ground = true; f.facing = f.side === 0 ? 1 : -1;
    f.action = 'idle'; f.stun = 0; f.stunKind = 'none'; f.kickT = 0; f.dashT = 0;
  }
  m.shields = []; m.shots = [];
}

// ---------------------------------------------------------------- Un paso de la simulación
export function step(m: Match, inputs: [Input, Input], dt: number) {
  m.time += dt; m.phaseT += dt;
  m.shake = Math.max(0, m.shake - dt * 2.5); m.flash = Math.max(0, m.flash - dt * 2);
  updateParticles(m, dt);
  if (m.phase === 'intro') {
    idleFighters(m, dt);
    if (m.phaseT > 2.2) { m.phase = 'play'; m.phaseT = 0; emit(m, { type: 'whistle', kind: 'kickoff' }); }
    return;
  }
  if (m.phase === 'end') { idleFighters(m, dt); return; }
  if (m.phase === 'goal') {
    // festejo: el que hizo el gol salta, el otro se agarra la cabeza; la pelota sigue rebotando en la red
    idleFighters(m, dt); moveBall(m, dt);
    if (m.phaseT > 2.6) {
      if (m.winner !== null) { m.phase = 'end'; m.phaseT = 0; emit(m, { type: 'whistle', kind: 'end' }); return; }
      resetKickoff(m, m.lastGoal?.side === 0 ? 1 : 0); m.phase = 'play'; m.phaseT = 0; emit(m, { type: 'whistle', kind: 'kickoff' });
    }
    return;
  }
  if (m.phase === 'fatal') { // la presentación del FATAL GOAL: todo quieto salvo los efectos
    if (m.phaseT > FATAL_CINE) { m.phase = 'play'; m.phaseT = 0; }
    return;
  }
  // --- jugando
  if (!m.extra) {
    m.clock = Math.max(0, m.clock - dt);
    if (m.clock <= 0) {
      const [a, b] = m.fighters;
      if (a.goals !== b.goals) { m.winner = a.goals > b.goals ? 0 : 1; m.phase = 'end'; m.phaseT = 0; emit(m, { type: 'whistle', kind: 'end' }); return; }
      m.extra = true; m.extraT = 0; emit(m, { type: 'extra' }); resetKickoff(m, null); m.phase = 'intro'; m.phaseT = 0.6;
      return;
    }
  } else m.extraT += dt;
  for (const f of m.fighters) f.energy = Math.min(ENERGY_MAX, f.energy + dt * 0.35);
  const cpuInputs: [Input, Input] = [inputs[0], inputs[1]];
  for (const s of [0, 1] as const) { const c = m.cpu[s]; if (c) cpuInputs[s] = cpuThink(m, s, c, dt); }
  for (const s of [0, 1] as const) updateFighter(m, m.fighters[s], cpuInputs[s], dt);
  fighterCollide(m);
  updateShields(m, dt);
  updateShots(m, dt);
  updateFatal(m, dt);
  if (m.phase !== 'play') return;
  updateHazards(m, dt);
  moveBall(m, dt);
  checkGoal(m);
  updatePowerups(m, dt);
}

function idleFighters(m: Match, dt: number) {
  for (const f of m.fighters) {
    f.actionT += dt;
    if (!f.ground) { f.vy -= 30 * stageDef(m.stage).gravity * dt; f.y += f.vy * dt; if (f.y <= floorAt(m, f.x)) { f.y = floorAt(m, f.x); f.vy = 0; f.ground = true; } }
    f.vx *= Math.pow(0.02, dt); f.x = clamp(f.x + f.vx * dt, 0.6, W - 0.6);
    if (m.phase === 'goal' && m.lastGoal) {
      const scorer = m.lastGoal.side === f.side;
      f.action = scorer ? 'celebrate' : 'sad';
      if (scorer && f.ground && m.phaseT > 0.3 && m.phaseT < 2) { f.vy = 7; f.ground = false; }
    } else if (m.phase === 'end' && m.winner !== null) f.action = m.winner === f.side ? 'celebrate' : 'sad';
    else if (f.action !== 'fatal') f.action = 'idle';
  }
}

// Altura del piso en x (los bloques de hielo del glaciar son escalones).
export function floorAt(m: Match, x: number) {
  let y = 0;
  for (const h of m.hazards) if (h.kind === 'block' && x > h.x && x < h.x + h.w) y = Math.max(y, h.h);
  return y;
}

const pressed = (f: Fighter, i: Input, k: keyof Input) => i[k] && !f.prev[k];
function canAct(f: Fighter) { return f.stun <= 0 && f.action !== 'fatal'; }

function updateFighter(m: Match, f: Fighter, i: Input, dt: number) {
  const def = CHARS[f.char], st = stageDef(m.stage), rival = m.fighters[f.side === 0 ? 1 : 0];
  f.actionT += dt;
  f.specialCd = Math.max(0, f.specialCd - dt); f.defenseCd = Math.max(0, f.defenseCd - dt);
  f.poison = Math.max(0, f.poison - dt); f.speedT = Math.max(0, f.speedT - dt);
  for (const k of Object.keys(f.powers) as PowerKind[]) { const left = (f.powers[k] ?? 0) - dt; if (left <= 0) delete f.powers[k]; else f.powers[k] = left; }
  if (f.stun > 0) {
    f.stun -= dt;
    if (f.stun <= 0) { f.stun = 0; f.stunKind = 'none'; f.action = 'idle'; }
  }
  const stunned = f.stun > 0;
  // --- movimiento
  const cpu = m.cpu[f.side];
  let speed = 7.4 * def.speed * (cpu ? 0.7 + cpu.level * 0.32 : 1) * (f.speedT > 0 ? 1.75 : 1) * ((f.powers.speed ?? 0) > 0 ? 1.4 : 1) * (f.poison > 0 ? 0.55 : 1);
  if (m.hazards.some(h => h.kind === 'puddle' && f.ground && f.x > h.x && f.x < h.x + h.w)) speed *= 0.6;
  const blocking = !stunned && i.block && f.ground && f.kickT <= 0 && f.dashT <= 0;
  let want = 0;
  if (!stunned && f.dashT <= 0 && f.action !== 'fatal') { if (i.left) want -= 1; if (i.right) want += 1; }
  if (blocking) want *= 0.25;
  const accel = f.ground ? (st.friction < 1 ? 14 : 55) : 22;
  if (f.dashT > 0) { f.dashT -= dt; f.vx = f.facing * 17; if (f.dashT <= 0) f.action = 'idle'; }
  else if (!stunned) {
    const target = want * speed;
    const d = target - f.vx, maxd = accel * dt;
    f.vx += clamp(d, -maxd, maxd);
    if (want !== 0 && f.kickT <= 0) f.facing = want > 0 ? 1 : -1;
  } else f.vx *= Math.pow(f.ground ? 0.05 : 0.6, dt);
  // salto
  if (!stunned && f.ground && pressed(f, i, 'up') && f.action !== 'fatal') {
    f.vy = 12.6 * def.jump * ((f.powers.speed ?? 0) > 0 ? 1.15 : 1) * (f.poison > 0 ? 0.8 : 1) * Math.sqrt(st.gravity) ; f.ground = false; emit(m, { type: 'jump' });
  }
  // gravedad
  f.vy -= 30 * st.gravity * dt;
  f.x += f.vx * dt; f.y += f.vy * dt;
  f.x = clamp(f.x, 0.55, W - 0.55);
  // bloques (escalones de hielo): de costado no se atraviesan
  for (const h of m.hazards) if (h.kind === 'block') {
    if (f.y < h.h - 0.05 && f.x + PW / 2 > h.x && f.x - PW / 2 < h.x + h.w) { f.x = f.x < h.x + h.w / 2 ? h.x - PW / 2 : h.x + h.w + PW / 2; f.vx = 0; }
  }
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
  if (canAct(f) && f.dashT <= 0) {
    if (pressed(f, i, 'fatal') && f.energy >= ENERGY_MAX && !m.fatal) startFatal(m, f);
    else if (pressed(f, i, 'defense') && f.defenseCd <= 0) castDefense(m, f);
    else if (pressed(f, i, 'special') && f.specialCd <= 0) castSpecial(m, f, rival);
    else if (pressed(f, i, 'kick') && f.kickT <= 0) {
      f.kickT = 0.3; f.kickHit = false; f.kickUp = i.up ? 1 : i.down ? -1 : 0; f.action = 'kick'; f.actionT = 0;
    }
  }
  if (!stunned && f.action !== 'fatal' && f.action !== 'special' && f.kickT <= 0 && f.dashT <= 0) f.action = blocking ? 'block' : !f.ground ? 'jump' : Math.abs(f.vx) > 0.8 ? 'run' : 'idle';
  if (f.action === 'special' && f.actionT > 0.45) f.action = 'idle';
  if (f.action === 'fatal' && m.phase === 'play' && m.fatal === null) f.action = 'idle';
  if (stunned) f.action = 'stun';
  // embestida: voltea al rival
  if (f.dashT > 0 && rival.stun <= 0 && Math.abs(rival.x - f.x) < 1 && Math.abs(rival.y - f.y) < 1.4) hurt(m, rival, f, 'burn', 1.1, 9);
  // magnetismo de Rayo / potenciador imán
  if ((f.powers.magnet ?? 0) > 0) { const b = m.ball, dx = f.x + f.facing * 0.5 - b.x, dy = f.y + 0.6 - b.y, d = Math.hypot(dx, dy); if (d < 4.5 && d > 0.5) { b.vx += dx / d * 14 * dt; b.vy += dy / d * 14 * dt; } }
  f.prev = { ...i };
}

// La patada: si el pie llega a la pelota, sale hacia donde mira (más alta con arriba, rasante con abajo).
// Si en vez de la pelota alcanza al rival, lo voltea (a menos que esté bloqueando).
function doKick(m: Match, f: Fighter, rival: Fighter) {
  const b = m.ball, def = CHARS[f.char];
  const fx = f.x + f.facing * 0.55, fy = f.y + (f.ground ? 0.45 : 0.7);
  const d = Math.hypot(b.x - fx, b.y - fy);
  if (d < 1.25 && !(m.fatal && !m.fatal.done)) {
    let power = 15.5 * def.kick * ((f.powers.power ?? 0) > 0 ? 1.45 : 1) * (f.speedT > 0 ? 1.25 : 1);
    let ang = f.kickUp === 1 ? 0.95 : f.kickUp === -1 ? 0.06 : 0.36;
    if (!f.ground) ang = f.kickUp === 1 ? 0.6 : b.y > f.y + 1.2 ? -0.25 : 0.15; // de volea / chilena
    if (b.kind === 'fire') power *= 1.2;
    if (b.frozen > 0) { b.frozen = 0; power *= 1.1; }
    b.vx = Math.cos(ang) * power * f.facing; b.vy = Math.sin(ang) * power + (f.kickUp === 1 ? 2 : 0);
    b.spin = f.facing * (f.kickUp === -1 ? 4 : -8); b.owner = f.side;
    if (f.speedT > 0) { b.fx = 'volt'; b.fxT = 0.8; }
    f.kickHit = true; f.energy = Math.min(ENERGY_MAX, f.energy + 3);
    burst(m, b.x, b.y, 6, '#ffffff', 'spark', 3);
    emit(m, { type: 'kick', power: power / 20 });
    return;
  }
  const rx = rival.x, ry = rival.y + PH / 2;
  if (Math.abs(rx - (f.x + f.facing * 0.7)) < 0.85 && Math.abs(ry - (f.y + 0.9)) < 1.3) {
    f.kickHit = true;
    if (rival.action === 'block' && Math.sign(rival.facing) === -f.facing) { rival.vx = f.facing * 3; rival.energy = Math.min(ENERGY_MAX, rival.energy + 3); emit(m, { type: 'block' }); burst(m, rx - f.facing * 0.3, ry, 8, '#93c5fd', 'spark', 3); return; }
    hurt(m, rival, f, f.speedT > 0 ? 'zap' : 'hit', 0.65, 7);
  }
}
// El rival queda volteado (stun) un rato: golpe, congelado, envenenado, quemado, electrocutado o agarrado.
function hurt(m: Match, f: Fighter, by: Fighter | null, kind: Fighter['stunKind'], time: number, push: number) {
  if ((f.powers.shield ?? 0) > 0 && kind !== 'grab') { emit(m, { type: 'block' }); burst(m, f.x, f.y + 1, 10, '#38bdf8', 'ring', 1); return; }
  if (f.action === 'fatal') return;
  f.stun = Math.max(f.stun, time); f.stunKind = kind; f.action = 'stun'; f.kickT = 0; f.dashT = 0;
  if (push) { const dir = by ? Math.sign(f.x - by.x) || -by.facing : (f.side === 0 ? 1 : -1); f.vx = dir * push; if (kind !== 'freeze' && kind !== 'grab') { f.vy = push * 0.55; f.ground = false; } }
  if (kind === 'freeze' || kind === 'grab') f.vx = 0;
  if (kind === 'poison') f.poison = 3;
  f.energy = Math.min(ENERGY_MAX, f.energy + 1);
  if (by) by.energy = Math.min(ENERGY_MAX, by.energy + 2.5);
  m.shake = Math.max(m.shake, 0.4);
  const color = kind === 'freeze' ? '#bae6fd' : kind === 'poison' ? '#86efac' : kind === 'burn' ? '#fb923c' : kind === 'zap' ? '#fde047' : '#ffffff';
  burst(m, f.x, f.y + 1.1, 12, color, kind === 'freeze' ? 'shard' : kind === 'poison' ? 'bubble' : kind === 'burn' ? 'ember' : 'spark', 5);
  emit(m, { type: 'hit', side: f.side, kind });
}

// ---------------------------------------------------------------- Habilidades
function castSpecial(m: Match, f: Fighter, rival: Fighter) {
  f.specialCd = SPECIAL_CD; f.action = 'special'; f.actionT = 0;
  const b = m.ball;
  emit(m, { type: 'special', side: f.side, char: f.char });
  switch (f.char) {
    case 'toxic': m.shots.push({ kind: 'acid', side: f.side, x: f.x + f.facing * 0.6, y: f.y + 1.35, vx: f.facing * 15, t: 0, life: 1.4, hit: false }); break;
    case 'bull': f.dashT = 0.42; f.action = 'special'; burst(m, f.x, f.y + 0.9, 12, '#fb923c', 'ember', 4); break;
    case 'frost': m.shots.push({ kind: 'breath', side: f.side, x: f.x + f.facing * 0.5, y: f.y + 1.4, vx: f.facing, t: 0, life: 0.55, hit: false }); break;
    case 'volt': f.speedT = 3; burst(m, f.x, f.y + 1, 14, '#fde047', 'spark', 5); break;
    case 'void': {
      burst(m, f.x, f.y + 1, 18, '#c084fc', 'smoke', 2);
      const dir = attackDir(f.side);
      f.x = clamp(b.x - dir * 0.75, 0.6, W - 0.6); f.y = Math.max(floorAt(m, f.x), b.y - 0.6); f.vx = 0; f.vy = 0; f.ground = f.y <= floorAt(m, f.x) + 0.01; f.facing = dir as 1 | -1;
      burst(m, f.x, f.y + 1, 18, '#c084fc', 'smoke', 2);
      break;
    }
  }
  void rival;
}
function castDefense(m: Match, f: Fighter) {
  f.defenseCd = DEFENSE_CD; f.action = 'special'; f.actionT = 0;
  const left = f.side === 0, gx = left ? GOAL_DEPTH + 0.35 : W - GOAL_DEPTH - 0.35;
  emit(m, { type: 'defense', side: f.side, char: f.char });
  switch (f.char) {
    case 'toxic': m.shields.push({ kind: 'cloud', side: f.side, x: left ? GOAL_DEPTH - 0.4 : W - GOAL_DEPTH - 3.1, y: 0, w: 3.5, h: 5, t: 0, life: 4.5 }); break;
    case 'bull': m.shields.push({ kind: 'firewall', side: f.side, x: gx - 0.35, y: 0, w: 0.7, h: 5, t: 0, life: 3.4 }); break;
    case 'frost': m.shields.push({ kind: 'icewall', side: f.side, x: gx - 0.45, y: 0, w: 0.9, h: 4.4, t: 0, life: 4.5 }); break;
    case 'volt': m.shields.push({ kind: 'field', side: f.side, x: f.x, y: f.y + 1, w: 2.9, h: 2.9, t: 0, life: 3.2 }); break;
    case 'void': m.shields.push({ kind: 'portal', side: f.side, x: gx, y: 2.2, w: 1.2, h: 2.6, t: 0, life: 4 }); break;
  }
}

function updateShields(m: Match, dt: number) {
  const b = m.ball;
  for (const s of m.shields) {
    s.t += dt;
    const owner = m.fighters[s.side], rival = m.fighters[s.side === 0 ? 1 : 0];
    if (s.kind === 'field') { s.x = owner.x; s.y = owner.y + 1; }
    const fatalBall = m.fatal && !m.fatal.done && m.fatal.side !== s.side;
    const inRect = b.x + BALL_R > s.x && b.x - BALL_R < s.x + s.w && b.y - BALL_R < s.y + s.h && b.y + BALL_R > s.y;
    switch (s.kind) {
      case 'cloud':
        if (inRect) { b.vx *= Math.pow(0.08, dt); b.vy *= Math.pow(0.3, dt); if (fatalBall) blockFatal(m, s.side); }
        if (rival.x > s.x && rival.x < s.x + s.w && rival.poison <= 0.5) { rival.poison = 2.5; burst(m, rival.x, rival.y + 1, 6, '#86efac', 'bubble', 2); }
        break;
      case 'firewall': case 'icewall': {
        if (inRect && Math.sign(b.vx) === (s.side === 0 ? -1 : 1)) {
          if (fatalBall) blockFatal(m, s.side);
          b.vx = -b.vx * (s.kind === 'firewall' ? 0.9 : 0.55) + (s.side === 0 ? 3 : -3); b.vy = Math.max(b.vy, 3); b.x = s.side === 0 ? s.x + s.w + BALL_R : s.x - BALL_R;
          burst(m, b.x, b.y, 12, s.kind === 'firewall' ? '#fb923c' : '#bae6fd', s.kind === 'firewall' ? 'ember' : 'shard', 4);
          emit(m, { type: 'block' });
        }
        if (s.kind === 'firewall' && rival.stun <= 0 && rival.x + PW / 2 > s.x && rival.x - PW / 2 < s.x + s.w) hurt(m, rival, null, 'burn', 0.8, 8);
        break;
      }
      case 'field': {
        const dx = b.x - s.x, dy = b.y - s.y, d = Math.hypot(dx, dy);
        if (d < s.w) {
          if (fatalBall) blockFatal(m, s.side);
          const k = (1 - d / s.w) * 70 * dt; b.vx += dx / (d || 1) * k + attackDir(s.side) * k * 0.4; b.vy += dy / (d || 1) * k;
          if (Math.random() < 0.3) burst(m, b.x, b.y, 1, '#fde047', 'spark', 2);
        }
        break;
      }
      case 'portal': {
        const cx = s.x, cy = s.y + s.h / 2;
        if (Math.abs(b.x - cx) < 0.55 && Math.abs(b.y - cy) < s.h / 2 + 0.1) {
          if (fatalBall) blockFatal(m, s.side);
          burst(m, b.x, b.y, 14, '#c084fc', 'smoke', 2);
          m.trail = []; b.x = W / 2 + attackDir(s.side) * 1.5; b.y = 6; b.vx = attackDir(s.side) * 7; b.vy = 2; b.owner = s.side;
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
    const owner = m.fighters[s.side], rival = m.fighters[s.side === 0 ? 1 : 0];
    if (s.kind === 'acid') {
      s.x += s.vx * dt; s.y -= dt * 1.2;
      if (!s.hit && Math.abs(b.x - s.x) < BALL_R + 0.3 && Math.abs(b.y - s.y) < BALL_R + 0.3) {
        s.hit = true; s.life = s.t; b.fx = 'toxic'; b.fxT = 1.6; b.owner = s.side;
        b.vx = attackDir(s.side) * 18; b.vy = 4; burst(m, b.x, b.y, 14, '#4ade80', 'bubble', 4); emit(m, { type: 'kick', power: 1 });
      } else if (!s.hit && Math.abs(rival.x - s.x) < 0.6 && s.y > rival.y && s.y < rival.y + PH) { s.hit = true; s.life = s.t; hurt(m, rival, owner, 'poison', 0.9, 3); }
      if (s.x < 0 || s.x > W) s.life = s.t;
    } else { // aliento helado: un cono adelante
      const dir = owner.facing, x0 = owner.x + dir * 0.4, y0 = owner.y + 1.35;
      s.x = x0; s.y = y0;
      const reach = Math.min(1, s.t / 0.25) * 3.6;
      const inCone = (px: number, py: number) => { const dx = (px - x0) * dir; return dx > 0 && dx < reach && Math.abs(py - y0) < 0.5 + dx * 0.35; };
      if (inCone(b.x, b.y) && b.frozen <= 0) { b.vx = 0; b.vy = 0; b.frozen = 1.3; b.fx = 'ice'; b.fxT = 1.3; burst(m, b.x, b.y, 12, '#bae6fd', 'shard', 3); }
      if (!s.hit && inCone(rival.x, rival.y + 1)) { s.hit = true; hurt(m, rival, owner, 'freeze', 1.6, 0); }
      if (Math.random() < 0.8) m.particles.push({ x: x0 + dir * reach * Math.random(), y: y0 + (Math.random() - 0.5) * reach * 0.5, vx: dir * 4, vy: (Math.random() - 0.5), life: 0.4, max: 0.4, size: 0.08 + Math.random() * 0.1, color: '#e0f2fe', kind: 'shard' });
    }
  }
  m.shots = m.shots.filter(s => s.t < s.life);
}

// ---------------------------------------------------------------- FATAL GOAL
function startFatal(m: Match, f: Fighter) {
  f.energy = 0; f.action = 'fatal'; f.actionT = 0;
  const rival = m.fighters[f.side === 0 ? 1 : 0];
  rival.defenseCd = 0; // el rival siempre tiene su defensa lista para intentar frenarlo
  // la pelota viene a los pies del que tira
  const b = m.ball; b.x = clamp(f.x + f.facing * 0.7, 1, W - 1); b.y = f.y + 0.6; b.vx = 0; b.vy = 0; b.owner = f.side; b.frozen = 0;
  m.fatal = { side: f.side, char: f.char, t: 0, x0: b.x, y0: b.y, blocked: false, done: false }; m.trail = [];
  m.phase = 'fatal'; m.phaseT = 0; m.flash = 1; m.shake = 0.6;
  emit(m, { type: 'fatal', side: f.side, char: f.char });
}
function blockFatal(m: Match, side: 0 | 1) {
  const fat = m.fatal; if (!fat || fat.done) return;
  fat.blocked = true; fat.done = true;
  const b = m.ball; b.vx = attackDir(side) * 10; b.vy = 6; b.fx = 'none';
  m.shake = 0.8; m.flash = 0.6;
  burst(m, b.x, b.y, 30, '#ffffff', 'ring', 2); burst(m, b.x, b.y, 30, CHARS[fat.char].glow, 'spark', 8);
  m.fighters[fat.side].action = 'idle';
  emit(m, { type: 'fatalBlocked', side });
}
// Dónde va la pelota del FATAL GOAL en el tiempo t (cada personaje con su recorrido), hasta el arco rival.
export function fatalPath(m: Match, fat: Fatal, t: number): { x: number; y: number; done: boolean; size: number } {
  const dir = attackDir(fat.side), gx = dir === 1 ? W - GOAL_DEPTH * 0.4 : GOAL_DEPTH * 0.4, gy = 1.4;
  const dist = Math.abs(gx - fat.x0);
  switch (fat.char) {
    case 'bull': { // sube al cielo y baja en diagonal como meteorito
      if (t < 0.55) return { x: fat.x0 + dir * t * 1.5, y: fat.y0 + (H + 3 - fat.y0) * (t / 0.55) ** 1.5, done: false, size: 1 };
      const k = Math.min(1, (t - 0.55) / 0.75), sx = gx - dir * 5.5, sy = H + 3;
      return { x: sx + (gx - sx) * k, y: sy + (gy - sy) * k, done: k >= 1, size: 1.8 };
    }
    case 'frost': { // avalancha rodando por el piso
      const k = Math.min(1, t * 18 / dist);
      return { x: fat.x0 + dir * dist * k, y: BALL_R * 2.6 + (1 - Math.min(1, t * 4)) * fat.y0, done: k >= 1, size: 2.6 };
    }
    case 'volt': { // zigzag de rayo: cinco saltos
      const hops = 5, k = Math.min(1, t / 0.9), i = Math.min(hops, Math.floor(k * hops + 1e-6)), hk = (k * hops) % 1;
      const at = (j: number) => ({ x: fat.x0 + dir * dist * j / hops, y: j === hops ? gy : j % 2 ? 5.5 : 1.8 + (j === 0 ? fat.y0 - 1.8 : 0) });
      const a = at(i), c = at(Math.min(hops, i + 1)), q = hk < 0.6 ? 0 : (hk - 0.6) / 0.4;
      return { x: a.x + (c.x - a.x) * q, y: Math.min(H - 0.6, a.y + (c.y - a.y) * q), done: k >= 1, size: 1.2 };
    }
    case 'void': { // espiral hasta el arco
      const k = Math.min(1, t * 11 / dist), r = (1 - k) * 1.8;
      return { x: fat.x0 + dir * dist * k + Math.cos(t * 14) * r, y: fat.y0 + (gy - fat.y0) * k + 1.8 * Math.sin(k * Math.PI) + Math.sin(t * 14) * r, done: k >= 1, size: 1.4 };
    }
    default: { // bomba ácida: vuela ondulando
      const k = Math.min(1, t * 14 / dist);
      return { x: fat.x0 + dir * dist * k, y: fat.y0 + (gy - fat.y0) * k + Math.sin(k * Math.PI * 3) * 1.6 + Math.sin(k * Math.PI) * 2, done: k >= 1, size: 1.6 };
    }
  }
}
function updateFatal(m: Match, dt: number) {
  const fat = m.fatal; if (!fat) return;
  if (fat.done) { m.fatal = null; return; }
  fat.t += dt;
  const b = m.ball, prevX = b.x, prevY = b.y, p = fatalPath(m, fat, fat.t);
  b.x = p.x; b.y = p.y; b.vx = (p.x - prevX) / Math.max(dt, 1e-3); b.vy = (p.y - prevY) / Math.max(dt, 1e-3); b.owner = fat.side;
  const rival = m.fighters[fat.side === 0 ? 1 : 0], shooter = m.fighters[fat.side];
  if (fat.t > 0.1) shooter.action = 'idle';
  // el agujero negro chupa al rival hacia el medio
  if (fat.char === 'void' && rival.stun <= 0.2) { rival.stun = 0.4; rival.stunKind = 'grab'; rival.vx = (W / 2 - rival.x) * 1.5; }
  // la pelota del fatal arrasa: atraviesa al rival y lo voltea
  if (rival.action !== 'stun' && Math.abs(rival.x - b.x) < 0.5 + BALL_R * p.size && b.y > rival.y - 0.2 && b.y < rival.y + PH + 0.2) hurt(m, rival, shooter, fat.char === 'frost' ? 'freeze' : fat.char === 'bull' ? 'burn' : fat.char === 'volt' ? 'zap' : 'poison', 1.2, fat.char === 'frost' ? 0 : 10);
  const glow = CHARS[fat.char].glow;
  for (let k = 0; k < 3; k++) m.particles.push({ x: b.x + (Math.random() - 0.5) * 0.4, y: b.y + (Math.random() - 0.5) * 0.4, vx: -b.vx * 0.05 + (Math.random() - 0.5), vy: -b.vy * 0.05 + (Math.random() - 0.5), life: 0.5, max: 0.5, size: 0.15 * p.size, color: glow, kind: fat.char === 'bull' ? 'ember' : fat.char === 'frost' ? 'shard' : fat.char === 'toxic' ? 'bubble' : 'spark' });
  if (p.done) { // ¡adentro!
    fat.done = true;
    const side = fat.side; scoreGoal(m, side, true);
  }
}

// ---------------------------------------------------------------- La pelota
function moveBall(m: Match, dt: number) {
  const b = m.ball, st = stageDef(m.stage);
  if (m.fatal && !m.fatal.done && m.phase === 'play') return;
  const steps = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 0.15) || 1, h = dt / steps;
  b.kindT = Math.max(0, b.kindT - dt); if (b.kindT <= 0 && b.kind !== 'normal') { b.kind = 'normal'; emit(m, { type: 'ballKind', kind: 'normal' }); }
  b.fxT = Math.max(0, b.fxT - dt); if (b.fxT <= 0) b.fx = 'none';
  if (b.frozen > 0) { b.frozen -= dt; b.vx *= Math.pow(0.001, dt); b.vy = Math.min(b.vy, 0); }
  for (let s = 0; s < steps; s++) {
    let g = 20 * st.gravity * (b.kind === 'void' ? 0.45 : 1);
    for (const hz of m.hazards) if (hz.kind === 'antigrav' && hz.state === 1 && b.x > hz.x && b.x < hz.x + hz.w) g = 2.5;
    b.vy -= g * h;
    if (b.kind === 'toxic') { b.vx += Math.sin(m.time * 3.1) * 9 * h; b.vy += Math.cos(m.time * 2.3) * 6 * h; }
    const drag = b.kind === 'ice' ? 0.9 : 0.8;
    b.vx *= Math.pow(drag, h); b.vy *= Math.pow(0.95, h);
    b.x += b.vx * h; b.y += b.vy * h;
    collideBallWorld(m, b, h);
    for (const f of m.fighters) collideBallFighter(m, b, f);
  }
  b.spin += b.vx * dt * 1.6;
  m.trail.unshift([b.x, b.y]); if (m.trail.length > 14) m.trail.length = 14;
}
function collideBallWorld(m: Match, b: Ball, dt: number) {
  const st = stageDef(m.stage), fl = floorAt(m, b.x);
  // piso
  if (b.y - BALL_R < fl) {
    b.y = fl + BALL_R;
    if (b.vy < -2) { emit(m, { type: 'bounce', power: Math.min(1, -b.vy / 15) }); b.vy = -b.vy * (b.kind === 'ice' ? 0.5 : 0.62); }
    else b.vy = 0;
    const fr = b.kind === 'ice' ? 0.05 : st.friction;
    b.vx *= Math.pow(0.3, fr * dt);
    b.vx -= Math.sign(b.vx) * Math.min(Math.abs(b.vx), 4 * fr * dt);
    // la cinta transportadora la lleva
    for (const h of m.hazards) if (h.kind === 'conveyor' && b.x > h.x && b.x < h.x + h.w) b.vx += h.dir * 5 * dt;
  }
  // costados de los bloques
  for (const h of m.hazards) if (h.kind === 'block' && b.y < h.h && b.x + BALL_R > h.x && b.x - BALL_R < h.x + h.w) {
    if (b.y > h.h - 0.1) continue;
    if (b.x < h.x + h.w / 2) { b.x = h.x - BALL_R; b.vx = -Math.abs(b.vx) * 0.6; } else { b.x = h.x + h.w + BALL_R; b.vx = Math.abs(b.vx) * 0.6; }
  }
  // techo y paredes del fondo
  if (b.y + BALL_R > H) { b.y = H - BALL_R; b.vy = -Math.abs(b.vy) * 0.6; }
  if (b.x - BALL_R < 0) { b.x = BALL_R; b.vx = Math.abs(b.vx) * 0.5; }
  if (b.x + BALL_R > W) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx) * 0.5; }
  // travesaños (encima rebota, de abajo también) y la red del fondo del arco
  for (const side of [0, 1] as const) {
    const gh = goalHeight(m, side), x0 = side === 0 ? 0 : W - GOAL_DEPTH, x1 = side === 0 ? GOAL_DEPTH : W;
    if (b.x + BALL_R > x0 && b.x - BALL_R < x1 && b.y + BALL_R > gh && b.y - BALL_R < gh + BAR) {
      if (b.y > gh + BAR / 2) { b.y = gh + BAR + BALL_R; b.vy = Math.abs(b.vy) * 0.55; } else { b.y = gh - BALL_R; b.vy = -Math.abs(b.vy) * 0.55; }
      const front = side === 0 ? x1 : x0;
      if (Math.abs(b.x - front) < BALL_R + 0.1) { b.vx = -b.vx * 0.7; }
      if (Math.abs(b.vy) > 2) emit(m, { type: 'post' });
    }
  }
}
function collideBallFighter(m: Match, b: Ball, f: Fighter) {
  if (m.phase !== 'play' && m.phase !== 'goal') return;
  const x0 = f.x - PW / 2, x1 = f.x + PW / 2, y0 = f.y, y1 = f.y + PH;
  const cx = clamp(b.x, x0, x1), cy = clamp(b.y, y0, y1), dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy);
  if (d >= BALL_R) return;
  // bloqueando de frente: el escudo la frena y la devuelve suave
  const blocking = f.action === 'block' && Math.sign(b.x - f.x) === f.facing;
  let nx = dx / (d || 1), ny = dy / (d || 1);
  if (d === 0) { nx = Math.sign(b.x - f.x) || 1; ny = 0; }
  b.x = cx + nx * BALL_R; b.y = cy + ny * BALL_R;
  const rvx = b.vx - f.vx, rvy = b.vy - f.vy, vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    const e = blocking ? 0.25 : ny > 0.6 ? 0.75 : 0.45; // de cabeza rebota más
    b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
    if (ny > 0.6 && !f.ground && f.vy > 0) b.vy += 3; // cabezazo
    if (blocking && Math.abs(vn) > 6) { emit(m, { type: 'block' }); f.energy = Math.min(ENERGY_MAX, f.energy + 3); burst(m, b.x, b.y, 8, '#93c5fd', 'spark', 3); }
    // pelota con pinchos / de fuego: te voltea si te pega fuerte en el cuerpo
    if (!blocking && Math.abs(vn) > 7 && b.owner !== f.side && (b.kind === 'spike' || b.kind === 'fire' || b.fx === 'fire')) hurt(m, f, null, b.kind === 'spike' ? 'hit' : 'burn', 0.6, 5);
    if (!blocking && Math.abs(vn) > 6 && b.owner !== f.side && b.fx === 'toxic') hurt(m, f, null, 'poison', 0.5, 2);
    if (!blocking && Math.abs(vn) > 6 && b.owner !== f.side && b.fx === 'volt') hurt(m, f, null, 'zap', 0.5, 3);
  }
  if (Math.abs(b.vx - f.vx) < 1) b.owner = f.side;
}

function checkGoal(m: Match) {
  const b = m.ball;
  if (m.phase !== 'play') return;
  const viaFatal = (side: 0 | 1) => !!m.fatal && !m.fatal.done && m.fatal.side === side;
  if (b.x < GOAL_DEPTH - BALL_R * 0.3 && b.y < goalHeight(m, 0)) scoreGoal(m, 1, viaFatal(1));
  else if (b.x > W - GOAL_DEPTH + BALL_R * 0.3 && b.y < goalHeight(m, 1)) scoreGoal(m, 0, viaFatal(0));
}
function scoreGoal(m: Match, side: 0 | 1, fatal: boolean) {
  const f = m.fighters[side], rival = m.fighters[side === 0 ? 1 : 0];
  f.goals++; rival.energy = Math.min(ENERGY_MAX, rival.energy + 15);
  m.lastGoal = { side, fatal }; m.phase = 'goal'; m.phaseT = 0; m.shake = fatal ? 1 : 0.5; m.flash = fatal ? 1 : 0.4;
  if (m.fatal) m.fatal.done = true;
  const b = m.ball; b.vx *= 0.25; b.vy = Math.min(b.vy, 2); b.fx = 'none';
  burst(m, b.x, b.y, fatal ? 50 : 26, fatal ? CHARS[f.char].glow : '#ffffff', 'spark', fatal ? 9 : 6);
  if (m.extra) m.winner = side; // gol de oro
  emit(m, { type: 'goal', side, fatal });
}

// ---------------------------------------------------------------- Potenciadores y pelotas especiales
function updatePowerups(m: Match, dt: number) {
  m.nextPower -= dt;
  if (m.nextPower <= 0 && m.powerups.length < 2) {
    const kinds: PowerKind[] = ['shield', 'speed', 'magnet', 'power', 'giant', 'energy'];
    m.powerups.push({ id: m.nextId++, kind: kinds[Math.floor(m.rand() * kinds.length)], x: 3.5 + m.rand() * (W - 7), y: 2.4 + m.rand() * 1.8, t: 0 });
    m.nextPower = 14 + m.rand() * 8;
  }
  for (const p of m.powerups) {
    p.t += dt;
    for (const f of m.fighters) if (Math.abs(f.x - p.x) < 0.75 && p.y > f.y - 0.3 && p.y < f.y + PH + 0.4) {
      p.t = 99;
      if (p.kind === 'energy') f.energy = Math.min(ENERGY_MAX, f.energy + 50); else f.powers[p.kind] = POWERS[p.kind].time;
      burst(m, p.x, p.y, 20, POWERS[p.kind].color, 'ring', 2);
      emit(m, { type: 'power', side: f.side, kind: p.kind });
      break;
    }
  }
  m.powerups = m.powerups.filter(p => p.t < 11);
  m.nextBall -= dt;
  if (m.nextBall <= 0) {
    const kinds: Exclude<BallKind, 'normal'>[] = ['toxic', 'fire', 'ice', 'spike', 'void'];
    m.ball.kind = kinds[Math.floor(m.rand() * kinds.length)]; m.ball.kindT = 12;
    burst(m, m.ball.x, m.ball.y, 20, BALLS[m.ball.kind].color, 'ring', 2);
    emit(m, { type: 'ballKind', kind: m.ball.kind });
    m.nextBall = 26 + m.rand() * 10;
  }
}

// ---------------------------------------------------------------- Peligros de cada escenario
function updateHazards(m: Match, dt: number) {
  const b = m.ball, r = m.rand;
  m.nextHazard -= dt;
  const spawn = (kind: Hazard['kind'], x: number, w: number, h: number, warn: number) => { m.hazards.push({ kind, x, y: H, w, h, t: -warn, state: 0, dir: 1, id: m.nextId++ }); emit(m, { type: 'warn' }); };
  if (m.nextHazard <= 0) {
    const x = 3 + r() * (W - 6);
    switch (m.stage) {
      case 'city': spawn('arc', x, 1.2, 0, 1.1); m.nextHazard = 5 + r() * 4; break;
      case 'volcano': spawn('meteor', x, 1.7, 0, 1.3); m.nextHazard = 3.5 + r() * 3; break;
      case 'glacier': spawn('icicle', x, 0.9, 0, 1); m.nextHazard = 4 + r() * 4; break;
      case 'graveyard': spawn('hand', x, 0.9, 0, 1); m.nextHazard = 3 + r() * 3; break;
      case 'storm': if (r() < 0.6) spawn('lightning', x, 1.3, 0, 1.1); else { m.hazards.push({ kind: 'gust', x: 0, y: 0, w: 0, h: 0, t: -1, state: 0, dir: r() < 0.5 ? -1 : 1, id: m.nextId++ }); emit(m, { type: 'warn' }); } m.nextHazard = 4 + r() * 3; break;
      case 'desert': if (!m.hazards.some(h => h.kind === 'tornado')) m.hazards.push({ kind: 'tornado', x: r() < 0.5 ? 2 : W - 2, y: 0, w: 1.8, h: 7, t: 0, state: 0, dir: 0, id: m.nextId++ }); m.nextHazard = 10 + r() * 6; break;
      default: m.nextHazard = 99;
    }
  }
  for (const h of m.hazards) {
    h.t += dt;
    const fightersIn = (x0: number, x1: number) => m.fighters.filter(f => f.x + PW / 2 > x0 && f.x - PW / 2 < x1);
    switch (h.kind) {
      case 'wreck': { // péndulo con pinchos
        const a = Math.sin(m.time * 0.9) * 0.95, bx = h.x + Math.sin(a) * h.h, by = h.y - Math.cos(a) * h.h, R = 0.95;
        h.state = a;
        const dx = b.x - bx, dy = b.y - by, d = Math.hypot(dx, dy);
        if (d < R + BALL_R) { const nx = dx / d, ny = dy / d, vx = Math.cos(a) * 0.9 * Math.cos(m.time * 0.9) * h.h; b.x = bx + nx * (R + BALL_R); b.y = by + ny * (R + BALL_R); const vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 1.8 * vn * nx; b.vy -= 1.8 * vn * ny; } b.vx += vx * 0.6; emit(m, { type: 'post' }); }
        for (const f of m.fighters) if (f.stun <= 0 && Math.hypot(f.x - bx, f.y + 1 - by) < R + 0.6) hurt(m, f, null, 'hit', 0.9, 10);
        break;
      }
      case 'conveyor': {
        if (Math.floor(m.time / 8) % 2 !== h.state) { h.state = Math.floor(m.time / 8) % 2; h.dir = h.state ? -1 : 1; }
        for (const f of fightersIn(h.x, h.x + h.w)) if (f.ground) f.x = clamp(f.x + h.dir * 2.4 * dt, 0.55, W - 0.55);
        break;
      }
      case 'lava': for (const f of fightersIn(h.x + 0.2, h.x + h.w - 0.2)) if (f.ground && f.stun <= 0) { hurt(m, f, null, 'burn', 1.1, 0); f.vy = 9; f.ground = false; f.vx = (f.x < W / 2 ? 1 : -1) * 6; } break;
      case 'antigrav': h.state = (m.time % 12) > 6 ? 1 : 0; break;
      case 'puddle': if (Math.random() < dt * 3) m.particles.push({ x: h.x + Math.random() * h.w, y: 0.1, vx: 0, vy: 0.6, life: 0.8, max: 0.8, size: 0.06, color: '#86efac', kind: 'bubble' }); break;
      case 'laser': {
        const cyc = (h.t % 5.5); h.state = cyc < 1 ? 1 : cyc < 3 ? 2 : 0; // 1 aviso, 2 prendido
        if (h.state === 2) for (const f of fightersIn(h.x - 0.1, h.x + h.w + 0.1)) if (f.stun <= 0) hurt(m, f, null, 'zap', 0.8, 6);
        break;
      }
      case 'airlock': { // cada tanto se abre una compuerta y chupa hacia ese lado
        const cyc = ((h.t % 13) + 13) % 13; h.dir = Math.floor(h.t / 13) % 2 ? 1 : -1;
        h.state = cyc > 8 && cyc < 9.5 ? 1 : cyc >= 9.5 && cyc < 12.5 ? 2 : 0;
        if (h.state === 2) { b.vx += h.dir * 8 * dt; for (const f of m.fighters) f.x = clamp(f.x + h.dir * 1.4 * dt, 0.55, W - 0.55); }
        break;
      }
      case 'arc': case 'lightning': case 'meteor': case 'icicle': case 'hand': {
        if (h.t >= 0 && h.state === 0) {
          h.state = 1;
          const x0 = h.x - h.w / 2, x1 = h.x + h.w / 2;
          if (h.kind === 'hand') { for (const f of fightersIn(x0, x1)) if (f.ground) hurt(m, f, null, 'grab', 1.3, 0); }
          else {
            const kind: Fighter['stunKind'] = h.kind === 'icicle' ? 'freeze' : h.kind === 'meteor' ? 'burn' : 'zap';
            for (const f of fightersIn(x0 - 0.3, x1 + 0.3)) hurt(m, f, null, kind, h.kind === 'icicle' ? 1.1 : 0.9, h.kind === 'icicle' ? 0 : 8);
            if (Math.abs(b.x - h.x) < h.w / 2 + 0.6 && (h.kind !== 'icicle' || b.y < 3)) { b.vy = 12 + Math.random() * 4; b.vx += (b.x - h.x) * 6; }
            m.shake = Math.max(m.shake, h.kind === 'meteor' ? 0.7 : 0.4);
            if (h.kind !== 'icicle') m.flash = Math.max(m.flash, 0.3);
            burst(m, h.x, 0.2, h.kind === 'meteor' ? 30 : 16, h.kind === 'meteor' ? '#fb923c' : h.kind === 'icicle' ? '#e0f2fe' : '#fde047', h.kind === 'meteor' ? 'ember' : h.kind === 'icicle' ? 'shard' : 'spark', 6);
            emit(m, { type: h.kind === 'meteor' ? 'boom' : h.kind === 'icicle' ? 'block' : 'thunder' });
          }
        }
        break;
      }
      case 'gust': if (h.t > 0) { b.vx += h.dir * 10 * dt; for (const f of m.fighters) if (!f.ground) f.vx += h.dir * 6 * dt; } break;
      case 'tornado': {
        h.x += (h.dir || (h.x < W / 2 ? 1 : -1)) * 2.2 * dt; if (!h.dir) h.dir = h.x < W / 2 ? 1 : -1;
        if (Math.abs(b.x - h.x) < h.w / 2 + BALL_R && b.y < h.h) { b.vy += 34 * dt; b.vx += (h.x - b.x) * 6 * dt + h.dir * 3 * dt; }
        for (const f of m.fighters) if (Math.abs(f.x - h.x) < h.w / 2 && f.stun <= 0) { hurt(m, f, null, 'hit', 0.9, 0); f.vy = 13; f.ground = false; f.vx = h.dir * 5; }
        break;
      }
      case 'blackhole': { const dx = h.x - b.x, dy = h.y - b.y, d = Math.max(1.2, Math.hypot(dx, dy)); b.vx += dx / d * 26 / d * dt; b.vy += dy / d * 26 / d * dt; break; }
      case 'portal': {
        const other = m.hazards.find(o => o.kind === 'portal' && o !== h)!;
        if (Math.hypot(b.x - h.x, b.y - h.y) < 0.65 && m.time - h.w > 1) { m.trail = []; b.x = other.x + Math.sign(b.vx || 1) * 0.8; b.y = other.y; other.w = m.time; h.w = m.time; burst(m, other.x, other.y, 14, '#c084fc', 'smoke', 2); emit(m, { type: 'zap' }); }
        break;
      }
    }
  }
  m.hazards = m.hazards.filter(h => !((h.kind === 'arc' || h.kind === 'lightning' || h.kind === 'meteor' || h.kind === 'icicle' || h.kind === 'hand') && h.t > 1.3) && !(h.kind === 'gust' && h.t > 3) && !(h.kind === 'tornado' && (h.x < -1 || h.x > W + 1)));
}

// Dos jugadores que se chocan: no se atraviesan (se empujan).
function fighterCollide(m: Match) {
  const [a, b] = m.fighters, dx = b.x - a.x, overlap = PW - Math.abs(dx);
  if (overlap > 0 && Math.abs(a.y - b.y) < PH * 0.8) {
    const s = Math.sign(dx) || 1;
    a.x = clamp(a.x - s * overlap / 2, 0.55, W - 0.55); b.x = clamp(b.x + s * overlap / 2, 0.55, W - 0.55);
  }
}

// ---------------------------------------------------------------- Partículas (efectos)
export function burst(m: Match, x: number, y: number, n: number, color: string, kind: Particle['kind'], speed: number) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
    m.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + (kind === 'ember' || kind === 'smoke' || kind === 'bubble' ? 1.5 : 0), life: kind === 'ring' ? 0.5 : 0.4 + Math.random() * 0.6, max: 1, size: kind === 'smoke' ? 0.25 + Math.random() * 0.3 : kind === 'ring' ? 0.2 : 0.05 + Math.random() * 0.08, color, kind });
    if (kind === 'ring') break;
  }
  if (m.particles.length > 500) m.particles.splice(0, m.particles.length - 500);
}
function updateParticles(m: Match, dt: number) {
  for (const p of m.particles) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.kind === 'spark' || p.kind === 'shard') p.vy -= 12 * dt;
    if (p.kind === 'smoke') { p.size += dt * 0.6; p.vx *= Math.pow(0.3, dt); p.vy *= Math.pow(0.5, dt); }
    if (p.kind === 'ring') p.size += dt * 6;
  }
  m.particles = m.particles.filter(p => p.life > 0);
}

// ---------------------------------------------------------------- La máquina (CPU)
// Decide qué botones aprieta, con un tiempito de reacción según la dificultad (level 0 fácil, 1 difícil).
function cpuThink(m: Match, side: 0 | 1, c: CpuState, dt: number): Input {
  const f = m.fighters[side], rival = m.fighters[side === 0 ? 1 : 0], b = m.ball, dir = attackDir(side);
  const ownGoalX = side === 0 ? 0 : W;
  c.think -= dt;
  const plan = c.plan;
  // botones de un solo toque: se sueltan al cuadro siguiente
  plan.kick = false; plan.special = false; plan.defense = false; plan.fatal = false; plan.up = false;
  // FATAL del rival en camino: intenta defenderse (si tiene con qué)
  if (m.fatal && !m.fatal.done && m.fatal.side !== side) {
    c.reactFatal += dt;
    if (c.reactFatal > 0.55 - c.level * 0.35 && f.defenseCd <= 0 && m.rand() < 0.4 + c.level * 0.5) plan.defense = true;
    return { ...plan };
  }
  c.reactFatal = 0;
  if (c.think > 0) return { ...plan };
  c.think = 0.18 - c.level * 0.1 + m.rand() * 0.08;
  plan.left = false; plan.right = false; plan.down = false; plan.block = false;
  const behind = (b.x - f.x) * dir; // >0: la pelota está adelante (hacia el arco rival)
  const ballToOwn = (b.x - ownGoalX) * -dir; // qué tan lejos del propio arco
  const threat = Math.sign(b.vx) === -dir && Math.abs(b.vx) > 6 && Math.abs(b.x - ownGoalX) < 12;
  let targetX: number;
  const rivalCloser = Math.abs(rival.x - b.x) + 0.5 < Math.abs(f.x - b.x) && rival.stun <= 0;
  const ownHalf = Math.abs(b.x - ownGoalX) < W * 0.55;
  if (rivalCloser && ownHalf && behind < 0.5) { // el rival llega antes: se para entre la pelota y su arco
    targetX = ownGoalX - dir * -(GOAL_DEPTH + 0.8 + Math.min(4.5, Math.abs(b.x - ownGoalX) * 0.35));
    if (b.y > 2 && Math.abs(b.x - f.x) < 2.5 && f.ground && m.rand() < 0.4) plan.up = true;
  } else if (threat && (b.x - f.x) * dir > 0) { // le tiran al arco y está entre la pelota y el arco: ataja
    const tHit = Math.abs((f.x - b.x) / (b.vx || 1)), yAt = b.y + b.vy * tHit - 10 * tHit * tHit;
    targetX = f.x;
    if (Math.abs(b.x - f.x) < 4) plan.block = yAt < 2 && m.rand() < 0.3 + c.level * 0.6;
    if (yAt > 1.9 && yAt < 4.6 && tHit < 0.45 && f.ground) plan.up = true;
  } else if (threat && m.rand() < 0.3 + c.level * 0.5) targetX = ownGoalX + dir * (GOAL_DEPTH + 0.7); // vuelve corriendo al arco
  else if (behind > -0.3) targetX = b.x - dir * 0.55; // detrás de la pelota, mirando al arco rival
  else targetX = b.x - dir * (Math.abs(b.x - ownGoalX) < 4 ? 0.4 : 1.4); // está del lado equivocado: vuelve
  // si está del lado equivocado y la pelota cerca, la salta
  if (behind < -0.2 && Math.abs(b.x - f.x) < 1.6 && b.y < 1.5 && f.ground && m.rand() < 0.5) plan.up = true;
  const dx = targetX - f.x;
  if (Math.abs(dx) > 0.15) { if (dx > 0) plan.right = true; else plan.left = true; }
  // peligros del escenario: no se mete en un láser prendido, salta los pozos de lava y los bloques de hielo
  const go = Math.sign(dx);
  for (const h of m.hazards) {
    const ahead = go > 0 ? h.x - (f.x + PW / 2) : f.x - PW / 2 - (h.x + h.w);
    if (h.kind === 'laser' && h.state !== 0 && ahead > -0.2 && ahead < 1) { plan.left = false; plan.right = false; }
    if ((h.kind === 'lava' || h.kind === 'block') && ahead > 0 && ahead < 0.9 && f.ground && go !== 0) plan.up = true;
    if (h.kind === 'hand' || h.kind === 'meteor' || h.kind === 'lightning' || h.kind === 'icicle' || h.kind === 'arc') {
      if (h.t < 0 && Math.abs(f.x - h.x) < h.w / 2 + 0.7 && m.rand() < 0.3 + c.level * 0.5) { plan.left = f.x < h.x; plan.right = f.x >= h.x; }
    }
  }
  // va a cabecear si la pelota viene alta
  if (b.y > 2.2 && b.y < 4.2 && Math.abs(b.x - f.x) < 1.6 && f.ground && m.rand() < 0.35 + c.level * 0.3) plan.up = true;
  // patea si la tiene adelante
  const near = Math.hypot(b.x - (f.x + dir * 0.55), b.y - (f.y + 0.5));
  const ahead = (b.x - f.x) * dir;
  if ((near < 1.25 || (ahead > 0.2 && ahead < 1.9 && Math.abs(b.y - f.y - 0.5) < 0.9)) && behind > -0.1 && f.kickT <= 0 && m.rand() < 0.6 + c.level * 0.4) {
    if (f.facing !== dir) { if (dir > 0) plan.right = true; else plan.left = true; }
    else {
      plan.kick = true;
      const rivalInWay = (rival.x - f.x) * dir > 0 && (rival.x - f.x) * dir < 4, ownHalfNow = Math.abs(f.x - ownGoalX) < W / 2;
      if ((rivalInWay && m.rand() < 0.6) || (ownHalfNow && m.rand() < 0.5)) plan.up = true; else if (m.rand() < 0.3) plan.down = true;
    }
  }
  // patea al rival si lo tiene encima y la pelota lejos
  if (Math.abs(rival.x - f.x) < 1.2 && Math.abs(b.x - f.x) > 2.5 && m.rand() < 0.08 + c.level * 0.15 && f.facing === Math.sign(rival.x - f.x)) plan.kick = true;
  // especiales
  if (f.specialCd <= 0 && m.rand() < 0.25 + c.level * 0.4) {
    const ballAhead = behind > 0 && behind < 4 && Math.abs(b.y - f.y - 1) < 1.5;
    switch (f.char) {
      case 'toxic': if ((ballAhead || (Math.abs(rival.x - f.x) < 6 && Math.sign(rival.x - f.x) === f.facing)) && f.facing === dir) plan.special = true; break;
      case 'bull': if (ballAhead && f.facing === dir && behind < 3) plan.special = true; break;
      case 'frost': if ((Math.abs(rival.x - f.x) < 3 && Math.sign(rival.x - f.x) === f.facing) || (ballAhead && behind < 2.5 && b.vx * dir < -4)) plan.special = true; break;
      case 'volt': if (Math.abs(b.x - f.x) > 5) plan.special = true; break;
      case 'void': if (Math.abs(b.x - f.x) > 6 && ballToOwn > 6) plan.special = true; break;
    }
  }
  if (f.defenseCd <= 0 && threat && Math.abs(b.x - ownGoalX) < 7 && Math.abs(b.vx) > 9 && m.rand() < 0.3 + c.level * 0.4) plan.defense = true;
  if (f.energy >= ENERGY_MAX && !m.fatal && m.rand() < 0.15 + c.level * 0.2) plan.fatal = true;
  // potenciador cerca: lo va a buscar
  const pu = m.powerups.find(p => Math.abs(p.x - f.x) < 3);
  if (pu && Math.abs(b.x - f.x) > 3) { plan.left = pu.x < f.x; plan.right = pu.x > f.x; if (pu.y > 3 && Math.abs(pu.x - f.x) < 1.2 && f.ground) plan.up = true; }
  return { ...plan };
}

// Puntaje del torneo y quién gana: para tests y para la pantalla.
export const scoreOf = (m: Match) => [m.fighters[0].goals, m.fighters[1].goals] as const;
export const clockText = (s: number) => `${String(Math.floor(Math.ceil(s) / 60)).padStart(2, '0')}:${String(Math.ceil(s) % 60).padStart(2, '0')}`;
