// Kombat Penales: la tanda de penales entre dos luchadores de Kombat Football. Cada uno patea y ataja, alternando.
// Son 5 penales por lado (se corta antes si uno ya no puede alcanzar al otro); si quedan empatados, se patea uno
// cada uno hasta que uno erre. Hay 6 lugares en el arco: tres arriba y tres abajo (a la derecha del arquero, al medio
// y a la izquierda del arquero). Si el arquero se tira al mismo lugar, ataja; si adivina el lado pero no la altura,
// a veces llega con la punta de los dedos. Si ataja, el que pateó explota.
import { SIZE, type CharId, type GibKind, type StageId } from './kombat';

export const REGULATION = 5;
export type Zone = 0 | 1 | 2 | 3 | 4 | 5; // fila * 3 + columna. Fila 0 = arriba. Columna 0 = derecha del arquero (izquierda de la pantalla)
export const ZONES: Zone[] = [0, 1, 2, 3, 4, 5];
export const colOf = (z: Zone) => z % 3;
export const rowOf = (z: Zone) => Math.floor(z / 3);
export const ZONE_NAMES: Record<Zone, string> = {
  0: 'Arriba · derecha del arquero', 1: 'Arriba · al medio', 2: 'Arriba · izquierda del arquero',
  3: 'Abajo · derecha del arquero', 4: 'Abajo · al medio', 5: 'Abajo · izquierda del arquero',
};
export const ZONE_ARROWS: Record<Zone, string> = { 0: '↖', 1: '↑', 2: '↗', 3: '↙', 4: '↓', 5: '↘' };

// ---------------------------------------------------------------- La tanda
export type Kicks = [boolean[], boolean[]];
const goalsOf = (k: boolean[]) => k.filter(Boolean).length;
export const scoreOf = (k: Kicks): [number, number] => [goalsOf(k[0]), goalsOf(k[1])];
// Quién patea en el turno n (first: el que patea primero, lo elige el que gana el piedra, papel o tijera).
export const shooterOf = (n: number, first: 0 | 1 = 0): 0 | 1 => ((n + first) % 2 === 0 ? 0 : 1);

// ---------------------------------------------------------------- Piedra, papel o tijera (para ver quién elige si patea primero o segundo)
export type Hand = 'piedra' | 'papel' | 'tijera';
export const HANDS: Hand[] = ['piedra', 'papel', 'tijera'];
// 0 o 1: quién ganó; null: empate (se vuelve a jugar).
export function rpsWinner(a: Hand, b: Hand): 0 | 1 | null {
  if (a === b) return null;
  return (a === 'piedra' && b === 'tijera') || (a === 'tijera' && b === 'papel') || (a === 'papel' && b === 'piedra') ? 0 : 1;
}
export const cpuHand = (rand: () => number): Hand => HANDS[Math.min(2, Math.floor(rand() * 3))];
// El ganador, si ya lo hay: en los 5 de cada uno, cuando uno ya no puede alcanzar al otro; después (muerte súbita),
// cuando los dos patearon la misma cantidad y uno metió más.
export function shootoutWinner(k: Kicks): 0 | 1 | null {
  const ka = k[0].length, kb = k[1].length, [a, b] = scoreOf(k);
  if (ka <= REGULATION && kb <= REGULATION) {
    if (a + (REGULATION - ka) < b) return 1;
    if (b + (REGULATION - kb) < a) return 0;
    return null;
  }
  if (ka === kb && a !== b) return a > b ? 0 : 1;
  return null;
}
export const suddenDeath = (k: Kicks) => k[0].length >= REGULATION && k[1].length >= REGULATION;

// Si el arquero ataja: mismo lugar, siempre; mismo lado pero otra altura, a veces (reach).
export function resolveKick(shot: Zone, dive: Zone, rand: () => number, reach = 0.3): 'goal' | 'save' {
  if (shot === dive) return 'save';
  if (colOf(shot) === colOf(dive) && rand() < reach) return 'save';
  return 'goal';
}
// La máquina elige al azar (los rincones un poco más que el medio).
export function cpuZone(rand: () => number): Zone {
  const w = [1.3, 0.7, 1.3, 1.3, 0.7, 1.3], tot = w.reduce((s, x) => s + x, 0);
  let r = rand() * tot;
  for (let i = 0; i < 6; i++) { r -= w[i]; if (r <= 0) return i as Zone; }
  return 5;
}

// ---------------------------------------------------------------- El estado del partido
export type PenPhase = 'intro' | 'rps' | 'aim' | 'kick' | 'execution' | 'end';
// El efecto de la pelota: cambia en cada ronda de penales (fuego, electricidad, viento, radiación, láser rojo) y
// vuelve a empezar después del quinto.
export type BallFx = 'fuego' | 'electricidad' | 'viento' | 'radiacion' | 'laser';
export const BALL_FX: BallFx[] = ['fuego', 'electricidad', 'viento', 'radiacion', 'laser'];
export const BALL_FX_NAMES: Record<BallFx, string> = { fuego: '🔥 Fuego', electricidad: '⚡ Electricidad', viento: '🌪️ Viento', radiacion: '☢️ Radiación', laser: '🔴 Láser rojo' };
export const fxOfTurn = (turn: number): BallFx => BALL_FX[Math.floor(turn / 2) % BALL_FX.length];
// Todo gol no atajado recibe el disparo, también cuando falla solamente la altura.
export const keeperBlewIt = (shot: Zone, dive: Zone) => shot !== dive;
export const DEATH_TYPES = ['explosion', 'fire', 'violet', 'acid', 'ice', 'head', 'ash'] as const;
export type PenDeathType = typeof DEATH_TYPES[number];
// Más anticipación y tiempo para leer cada transformación antes del estallido.
export const DEATH_LENGTH = 5.2;
// Transformación y restos comparten una secuencia de aproximadamente cinco segundos.
export const DEATH_AT: Record<PenDeathType, number> = { explosion: 0, fire: 3.7, violet: 3.7, acid: 3.6, ice: 3.7, head: 4.1, ash: 4.2 };
export const HEAD_GROWTH = 4.2;
export const ACID_GREEN_T = 0.7, ACID_MELT_T = 3.15;
export const FINAL_SHOT_AT = 2.25;
export const FINAL_END_AT = 5.2;
export const freezeProgress = (t: number) => Math.min(1, Math.max(0, t / (DEATH_AT.ice * 0.8)));
export const ashFront = (t: number) => Math.min(1, Math.max(0, t / DEATH_AT.ash));
export function acidCollapse(t: number) {
  const q = Math.min(1, Math.max(0, (t - ACID_GREEN_T) / (ACID_MELT_T - ACID_GREEN_T))), fall = q * q * (3 - 2 * q);
  return { q, height: Math.max(0.025, 1 - fall * 0.975), width: 1 - fall * 0.18 };
}
export interface PenDeath { type: PenDeathType; side: 0 | 1; keeper: boolean; at: number; clock: number; t: number; finished: boolean; x: number; y: number; h: number }
export interface PenKick { shooter: 0 | 1; shot: Zone; dive: Zone; outcome: 'goal' | 'save'; t: number; scored: boolean; boom: boolean; kboom: boolean; hit: boolean; sounded: boolean; fx: BallFx }
export interface Gib { x: number; y: number; z: number; vx: number; vy: number; vz: number; a: number; va: number; kind: GibKind; c: string; life: number; scale?: number; profile?: boolean }
export interface Drop { x: number; y: number; z: number; vx: number; vy: number; vz: number; r: number }
export interface Stain { x: number; y: number; r: number; seed: number; t: number }
export interface Spark { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; color: string; size: number }
export interface PenMatch {
  stage: StageId; chars: [CharId, CharId];
  kicks: Kicks; turn: number; first: 0 | 1; phase: PenPhase;
  phaseT: number; time: number;
  roll: number; // la suerte del penal (atajada con la punta de los dedos), sorteada con el silbato: nada se decide después de que elige la persona
  kick: PenKick | null; winner: 0 | 1 | null;
  gore: { gibs: Gib[]; drops: Drop[]; stains: Stain[] };
  sparks: Spark[];
  death: PenDeath | null;
  finale: { loser: 0 | 1; fired: boolean } | null;
  lastDeath: PenDeathType | null;
  fragments: { kind: 'ice' | 'ash'; x: number; y: number; vx: number; vy: number; a: number; va: number; size: number; t: number; life: number }[];
  screenBlood: { x: number; y: number; r: number; t: number; seed: number; drips: number }[];
  shake: number; flash: number;
  humans: [boolean, boolean]; // de quién es cada lado (si explota el de una persona, la sangre tapa mucho más la pantalla)
  events: PenEvent[];
  rand: () => number;
}
export type PenEvent = { type: 'whistle' } | { type: 'kick' } | { type: 'goal'; side: 0 | 1 } | { type: 'save'; side: 0 | 1 } | { type: 'boom'; side: 0 | 1; keeper: boolean; death: PenDeathType } | { type: 'deathStart'; death: PenDeathType } | { type: 'burn' } | { type: 'post' } | { type: 'end'; winner: 0 | 1 };

export function newPenalties(stage: StageId, chars: [CharId, CharId], rand: () => number = Math.random): PenMatch {
  return {
    stage, chars, kicks: [[], []], turn: 0, first: 0, roll: 0.5, phase: 'intro', phaseT: 0, time: 0, kick: null, winner: null,
    gore: { gibs: [], drops: [], stains: [] }, sparks: [], death: null, finale: null, lastDeath: null, fragments: [], screenBlood: [], shake: 0, flash: 0, humans: [true, false], events: [], rand,
  };
}
// Después del piedra, papel o tijera: arranca la tanda (first patea primero) con el silbato.
export function beginShootout(m: PenMatch, first: 0 | 1) { m.first = first; m.phase = 'aim'; m.phaseT = 0; m.roll = m.rand(); m.events.push({ type: 'whistle' }); }
export const takePenEvents = (m: PenMatch) => { const e = m.events; m.events = []; return e; };

// Los tiempos de la animación de un penal (segundos desde que arranca la carrera).
export const T = {
  run: 1.0, // corre hasta la pelota (sale de lejos)
  contact: 1.18, // le pega
  dive: 1.11, // el arquero se tira (un poquito antes, como los de verdad)
  diveDur: 0.45,
  flight: 0.42, // lo que tarda la pelota en llegar al arco
  boom: 0.4, // después de la atajada, explota el que pateó
  next: 2.0, // pausa después de que se define el penal (antes del siguiente)
};
export const arriveAt = () => T.contact + T.flight;
export const kickDuration = (death?: PenDeathType) => Math.max(arriveAt() + T.next + 0.25, death ? arriveAt() + T.boom + 0.1 + DEATH_LENGTH : 0);

// Arranca el penal con las dos elecciones.
export function startKick(m: PenMatch, shot: Zone, dive: Zone, reach = 0.3) {
  const shooter = shooterOf(m.turn, m.first);
  m.kick = { shooter, shot, dive, outcome: resolveKick(shot, dive, () => m.roll, reach), t: 0, scored: false, boom: false, kboom: false, hit: false, sounded: false, fx: fxOfTurn(m.turn) };
  m.phase = 'kick'; m.phaseT = 0;
  m.screenBlood = [];
  m.death = null; m.fragments = [];
}

// Avanza el tiempo. La parte visual (dónde está cada uno) se calcula en el dibujo a partir de kick.t; acá van los
// momentos que importan (el gol, la atajada, la explosión) y la física de los pedazos y la sangre.
type BodyAt = (side: 0 | 1) => { x: number; y: number; h: number };
export function stepPenalties(m: PenMatch, dt: number, kickPos: BodyAt, keeperPos: BodyAt = kickPos) {
  m.time += dt; m.phaseT += dt;
  m.shake = Math.max(0, m.shake - dt * 2.2); m.flash = Math.max(0, m.flash - dt * 2);
  if (m.phase === 'intro' && m.phaseT > 1.6) { m.phase = 'rps'; m.phaseT = 0; }
  const k = m.kick;
  if (m.phase === 'kick' && k) {
    k.t += dt;
    if (!k.sounded && k.t >= T.contact) { k.sounded = true; m.events.push({ type: 'kick' }); }
    if (!k.hit && k.t >= arriveAt()) {
      k.hit = true;
      m.kicks[k.shooter].push(k.outcome === 'goal');
      m.events.push(k.outcome === 'goal' ? { type: 'goal', side: k.shooter } : { type: 'save', side: k.shooter === 0 ? 1 : 0 });
      if (k.outcome === 'goal') m.shake = Math.max(m.shake, 0.35);
    }
    if (k.outcome === 'save' && !k.boom && k.t >= arriveAt() + T.boom) {
      k.boom = true; beginDeath(m, k.shooter, false, kickPos(k.shooter), arriveAt() + T.boom);
    }
    // El fallo de altura también recibe el castigo del árbitro.
    if (k.outcome === 'goal' && !k.kboom && keeperBlewIt(k.shot, k.dive) && k.t >= arriveAt() + T.boom + 0.1) {
      const ks: 0 | 1 = k.shooter === 0 ? 1 : 0; k.kboom = true; beginDeath(m, ks, true, keeperPos(ks), arriveAt() + T.boom + 0.1);
    }
    updateDeath(m);
    if (k.t >= (m.death ? m.death.at + DEATH_LENGTH : kickDuration())) {
      const w = shootoutWinner(m.kicks);
      if (w !== null) {
        m.winner = w; m.phase = 'execution'; m.phaseT = 0;
        m.finale = { loser: w === 0 ? 1 : 0, fired: false };
        m.death = null; m.gore = { gibs: [], drops: [], stains: [] }; m.sparks = []; m.fragments = []; m.screenBlood = [];
      }
      else { m.turn++; m.phase = 'aim'; m.phaseT = 0; m.kick = null; m.roll = m.rand(); m.events.push({ type: 'whistle' }); m.gore = { gibs: [], drops: [], stains: [] }; m.sparks = []; m.screenBlood = []; m.death = null; m.fragments = []; } // (el siguiente penal empieza limpio)
    }
  }
  if (m.phase === 'execution' && m.finale) {
    if (!m.finale.fired && m.phaseT >= FINAL_SHOT_AT) {
      m.finale.fired = true;
      beginDeath(m, m.finale.loser, false, kickPos(m.finale.loser), FINAL_SHOT_AT, 'explosion');
    }
    updateDeath(m);
    if (m.death?.finished && m.phaseT >= FINAL_END_AT) {
      m.phase = 'end'; m.phaseT = 0; m.events.push({ type: 'end', winner: m.winner! });
    }
  }
  updateGore(m, dt);
}

function beginDeath(m: PenMatch, side: 0 | 1, keeper: boolean, p: { x: number; y: number; h: number }, at: number, forced?: PenDeathType) {
  const choices = DEATH_TYPES.filter(type => type !== m.lastDeath);
  const type = forced ?? choices[Math.min(choices.length - 1, Math.floor(m.rand() * choices.length))];
  m.lastDeath = type;
  m.death = { type, side, keeper, at, clock: m.time, t: 0, finished: false, ...p };
  m.events.push({ type: 'deathStart', death: type });
}
function updateDeath(m: PenMatch) {
  const d = m.death; if (!d || (!m.kick && m.phase !== 'execution')) return;
  const prev = d.t; d.t = Math.max(0, (m.phase === 'execution' ? m.phaseT : m.kick!.t) - d.at);
  if (d.finished) return;
  if (d.type === 'fire' && prev < 0.25 && d.t >= 0.25) m.events.push({ type: 'burn' });
  if (d.type === 'ash') {
    // Emisión por intervalos: igual cantidad de cenizas a 30, 60 o 120 fps.
    for (let i = Math.floor(prev * 220); i < Math.floor(Math.min(d.t, DEATH_AT.ash) * 220); i++) {
      const r = m.rand;
      m.fragments.push({ kind: 'ash', x: d.x + (r() - 0.5) * d.h * 0.65, y: d.y - d.h * ashFront(i / 220), vx: 170 + r() * 400, vy: -25 - r() * 110, a: r() * 6, va: (r() - 0.5) * 5, size: 1 + r() * 9, t: 0, life: 1 });
    }
  }
  if (d.t < DEATH_AT[d.type]) return;
  d.finished = true;
  if (d.type === 'ice') {
    const r = m.rand;
    for (let i = 0; i < 38; i++) m.fragments.push({ kind: 'ice', x: d.x + (r() - 0.5) * d.h * 0.5, y: d.y - r() * d.h, vx: (r() - 0.5) * 1200, vy: -180 - r() * 850, a: r() * 6, va: (r() - 0.5) * 15, size: d.h * (i < 18 ? 0.08 + r() * 0.09 : 0.02 + r() * 0.04), t: 0, life: 1.75 });
    sprayBlood(m, d.x, d.y, d.h, 110);
    m.gore.stains.push({ x: d.x, y: d.y, r: 70 + r() * 30, seed: r() * 100, t: 0 });
    m.shake = 0.85;
  } else if (d.type !== 'acid' && d.type !== 'ash') {
    explode(m, d.x, d.y, d.h, m.chars[d.side], undefined, m.humans[d.side]);
    if (d.type === 'head') {
      // drawGib skull: diámetro 0.4; cabeza original: diámetro 0.74 * 1.12.
      const skull = m.gore.gibs.find(g => g.kind === 'skull');
      if (skull) { skull.scale = (0.74 * 1.12 * HEAD_GROWTH * (2.3 / 1.85) * SIZE[m.chars[d.side]]) / (1.6 * 0.4); skull.profile = true; }
    }
    if (d.type === 'violet') {
      for (const g of m.gore.gibs) { g.scale = 0.24; g.vx *= 0.55; g.vy *= 0.55; g.vz *= 0.55; }
      for (const s of m.sparks) s.color = '#c86eff';
    }
  }
  m.events.push({ type: 'boom', side: d.side, keeper: d.keeper, death: d.type });
}

// ---------------------------------------------------------------- La explosión (en px del arco: x, y en el piso; z para arriba)
const GRAV = 2300;
function sprayBlood(m: PenMatch, x: number, y: number, h: number, count: number) {
  const r = m.rand;
  for (let i = 0; i < count; i++) { const a = r() * Math.PI * 2, sp = 140 + r() * 1250; m.gore.drops.push({ x, y, z: h * (0.25 + r() * 0.65), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.55, vz: 300 + r() * 1400, r: 1.2 + Math.pow(r(), 2) * 8 }); }
}
export function explode(m: PenMatch, x: number, y: number, h: number, char: CharId, color = '#9ca3af', heavy = false) {
  const r = m.rand, G = m.gore;
  sprayBlood(m, x, y, h, 260);
  const kinds: GibKind[] = ['skull', 'jaw', 'ribs', 'ribs', 'pelvis', 'bone', 'bone', 'bone', 'bone', 'bone', 'bone', 'chunk', 'chunk', 'chunk', 'chunk', 'plate', 'plate', 'plate', 'plate'];
  kinds.push('bone', 'bone', 'bone', 'bone', 'bone', 'bone', 'chunk', 'chunk', 'chunk', 'chunk', 'chunk', 'chunk', 'chunk', 'chunk');
  kinds.forEach((kind, i) => {
    const a = (i / kinds.length) * Math.PI * 2 + r() * 0.5, sp = 350 + r() * 750;
    G.gibs.push({ x, y, z: h * (kind === 'skull' || kind === 'jaw' ? 0.85 : kind === 'pelvis' ? 0.4 : 0.3 + r() * 0.5), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.55, vz: 500 + r() * 1000, a: r() * 6, va: (r() - 0.5) * 22, kind, c: color, life: 0 });
  });
  const cols = ['#fde68a', '#fb923c', '#ef4444', '#ffffff'];
  for (let i = 0; i < 70; i++) { const a = r() * Math.PI * 2, sp = 300 + r() * 1100; m.sparks.push({ x, y, z: h * 0.55, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: (r() - 0.3) * 900, life: 0, max: 0.45 + r() * 0.5, color: cols[i % 4], size: 2 + r() * 7 }); }
  G.stains.push({ x, y, r: 100 + r() * 55, seed: r() * 100, t: 0 });
  for (let k = 0; k < 4; k++) m.screenBlood.push({ x: 0.08 + r() * 0.84, y: 0.2 + r() * 0.6, r: 0.016 + r() * 0.026, t: -k * 0.06, seed: r() * 100, drips: 3 + Math.floor(r() * 4) });
  // si el que explota es el de la persona (perdió el penal): la pantalla queda salpicada de sangre por todos lados
  if (heavy) for (let k = 0; k < 26; k++) m.screenBlood.push({ x: 0.03 + r() * 0.94, y: 0.05 + r() * 0.85, r: (k < 5 ? 0.05 : 0.022) + r() * (k < 5 ? 0.05 : 0.035), t: -0.05 - k * 0.025, seed: r() * 100, drips: 4 + Math.floor(r() * 6) });
  m.shake = 1.75; m.flash = 0.45;
  void char;
}
function updateGore(m: PenMatch, dt: number) {
  for (const f of m.fragments) { f.t += dt; if (f.kind === 'ice') f.vy += 900 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.a += f.va * dt; }
  m.fragments = m.fragments.filter(f => f.t < f.life);
  const G = m.gore;
  for (const d of G.drops) {
    d.vz -= GRAV * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
    if (d.z <= 0) { d.z = -1; if (G.stains.length < 260) G.stains.push({ x: d.x, y: d.y, r: d.r * (1.3 + m.rand()), seed: m.rand() * 100, t: 0 }); }
  }
  G.drops = G.drops.filter(d => d.z > -1);
  for (const g of G.gibs) {
    g.life += dt;
    if (g.z > 0 || g.vz > 0) { g.vz -= GRAV * dt; g.z += g.vz * dt; g.a += g.va * dt; }
    if (g.z <= 0) { g.z = 0; if (g.vz < -250) { g.vz = -g.vz * 0.35; g.va *= 0.6; } else { g.vz = 0; g.va *= 0.85; } g.vx *= 1 - Math.min(1, dt * 4); g.vy *= 1 - Math.min(1, dt * 4); }
    g.x += g.vx * dt; g.y += g.vy * dt;
  }
  for (const s of m.sparks) { s.life += dt; s.vz -= GRAV * 0.4 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; }
  m.sparks = m.sparks.filter(s => s.life < s.max);
  for (const st of G.stains) st.t += dt;
  for (const sb of m.screenBlood) sb.t += dt;
  m.screenBlood = m.screenBlood.filter(sb => sb.t < 5);
}

// ---------------------------------------------------------------- Resultados simulados (para el mundial)
export function penaltyScore(rand: () => number): [number, number] {
  if (rand() < 0.3) { const t = 3 + Math.floor(rand() * 3); return [t + 1, t]; } // muerte súbita
  const w = 3 + Math.floor(rand() * 3); return [w, Math.max(0, w - 1 - Math.floor(rand() * 2))];
}
