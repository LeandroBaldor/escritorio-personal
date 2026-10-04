// Lógica de "Tiki-Taka": un partido de pases. Tu equipo ataca hacia la derecha; tocás a un
// compañero para pasarle la pelota y los rivales presionan al que la tiene. Un pase que pasa cerca
// de un rival se corta. Cerca del arco podés patear. Si perdés la pelota, el rival contraataca y
// atajás eligiendo un lado. La formación importa: más defensores cortan más contraataques y dan más
// tiempo para atajar; más volantes y delanteros dan más opciones de pase arriba.
// Todo se mide en metros de una cancha de 105×68.

export const PITCH = { w: 105, h: 68 };
export const GOAL = { top: 30.3, bottom: 37.7 };
export type FormationId = '4-4-2' | '4-3-3' | '3-5-2' | '5-3-2' | '4-2-3-1';
export const FORMATIONS: Record<FormationId, number[]> = {
  '4-4-2': [4, 4, 2], '4-3-3': [4, 3, 3], '3-5-2': [3, 5, 2], '5-3-2': [5, 3, 2], '4-2-3-1': [4, 2, 3, 1],
};
export type Side = 'izq' | 'medio' | 'der';
export type Risk = 'safe' | 'risky' | 'blocked';
export interface Player { x: number; y: number; bx: number; by: number; n: number; phase: number }
export type MatchEvent =
  | { type: 'pass'; to: number } | { type: 'intercept' } | { type: 'steal' } | { type: 'goal' } | { type: 'saved' } | { type: 'miss' }
  | { type: 'cut' } | { type: 'counterSaved' } | { type: 'counterGoal' } | { type: 'counter' } | { type: 'kickoff' } | { type: 'end' };
export interface Flight { fromX: number; fromY: number; toX: number; toY: number; t: number; dur: number; to: number | 'goal'; scores?: boolean; cutBy?: number }
export interface Counter { t: number; window: number; dir: Side; cut: boolean; chosen: Side | null; result: 'saved' | 'goal' | 'cut' | null }
export interface Match {
  formation: FormationId; mine: Player[]; rivals: Player[]; keeper: { x: number; y: number };
  holder: number | null; ball: { x: number; y: number }; flight: Flight | null;
  phase: 'play' | 'flight' | 'counter' | 'pause' | 'end'; pause: number; after: 'kickoff' | 'counter' | null;
  time: number; duration: number; goals: { mine: number; rival: number }; control: number;
  counter: Counter | null; events: MatchEvent[]; stats: { passes: number; shots: number; lost: number };
}

export const MATCH_SECONDS = 150;
const PASS_SPEED = 40;
const CUT_RADIUS = 1.7;
const STEAL_RADIUS = 1.9;
export const SHOOT_FROM = 72;
const SIDES: Side[] = ['izq', 'medio', 'der'];

const defenders = (f: FormationId) => FORMATIONS[f][0];
export const minute = (m: Match) => Math.min(90, Math.floor(m.time / m.duration * 90));

// Ubica las líneas de una formación entre dos alturas de la cancha.
function lines(counts: number[], fromX: number, toX: number, number = 2) {
  const out: Player[] = [];
  counts.forEach((count, i) => {
    const x = counts.length === 1 ? fromX : fromX + (toX - fromX) * i / (counts.length - 1);
    for (let j = 0; j < count; j++) {
      const y = PITCH.h * (j + 1) / (count + 1);
      out.push({ x, y, bx: x, by: y, n: number++, phase: (out.length * 1.7) % 6.28 });
    }
  });
  return out;
}

export function newMatch(formation: FormationId, duration = MATCH_SECONDS): Match {
  const m: Match = {
    formation, mine: lines(FORMATIONS[formation], 26, 74), rivals: lines([4, 4, 2], 90, 60).map(p => ({ ...p })),
    keeper: { x: 102.5, y: PITCH.h / 2 }, holder: null, ball: { x: 0, y: 0 }, flight: null,
    phase: 'play', pause: 0, after: null, time: 0, duration, goals: { mine: 0, rival: 0 }, control: 0,
    counter: null, events: [], stats: { passes: 0, shots: 0, lost: 0 },
  };
  kickoff(m);
  return m;
}

// Saque: todos a su lugar y la pelota para un volante del medio.
export function kickoff(m: Match) {
  for (const p of [...m.mine, ...m.rivals]) { p.x = p.bx; p.y = p.by; }
  const counts = FORMATIONS[m.formation];
  const start = counts[0] + Math.floor(counts[1] / 2);
  m.holder = start;
  m.ball = { x: m.mine[start].x, y: m.mine[start].y };
  m.flight = null; m.counter = null; m.control = 1.2; m.phase = 'play';
  m.keeper = { x: 102.5, y: PITCH.h / 2 };
  m.events.push({ type: 'kickoff' });
}

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
// Distancia de un punto al segmento que va de a a b.
function toSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return dist(px, py, ax + t * dx, ay + t * dy);
}

// Radar de pases: qué tan arriesgado es pasarle a un compañero ahora.
export function passRisk(m: Match, to: number): Risk {
  if (m.holder === null || to === m.holder) return 'blocked';
  const a = m.mine[m.holder], b = m.mine[to];
  const near = Math.min(...m.rivals.map(r => toSegment(r.x, r.y, a.x, a.y, b.x, b.y)));
  return near < CUT_RADIUS ? 'blocked' : near < 4.2 ? 'risky' : 'safe';
}

export function pass(m: Match, to: number) {
  if (m.phase !== 'play' || m.holder === null || to === m.holder || !m.mine[to]) return false;
  const a = m.mine[m.holder], b = m.mine[to];
  m.flight = { fromX: a.x, fromY: a.y, toX: b.x, toY: b.y, t: 0, dur: Math.max(0.25, dist(a.x, a.y, b.x, b.y) / PASS_SPEED), to };
  m.holder = null; m.phase = 'flight';
  return true;
}

export const canShoot = (m: Match) => m.phase === 'play' && m.holder !== null && m.mine[m.holder].x >= SHOOT_FROM;

// Chance de gol: más cerca y con menos rivales en el camino, mejor.
export function shotChance(m: Match) {
  if (m.holder === null) return 0;
  const p = m.mine[m.holder];
  const d = dist(p.x, p.y, PITCH.w, PITCH.h / 2);
  const blockers = m.rivals.filter(r => r.x > p.x && toSegment(r.x, r.y, p.x, p.y, PITCH.w, PITCH.h / 2) < 2.2).length;
  return Math.max(0.05, Math.min(0.9, 0.95 - (d - 11) * 0.028 - blockers * 0.22));
}

export function shoot(m: Match, rand: () => number = Math.random) {
  if (!canShoot(m)) return false;
  const p = m.mine[m.holder!];
  const scores = rand() < shotChance(m);
  const y = scores ? GOAL.top + 0.8 + rand() * (GOAL.bottom - GOAL.top - 1.6) : rand() < 0.5 ? GOAL.top - 2 - rand() * 4 : GOAL.bottom + 2 + rand() * 4;
  m.flight = { fromX: p.x, fromY: p.y, toX: PITCH.w + 0.5, toY: scores ? y : rand() < 0.5 ? m.keeper.y : y, t: 0, dur: Math.max(0.35, dist(p.x, p.y, PITCH.w, y) / 55), to: 'goal', scores };
  m.holder = null; m.phase = 'flight'; m.stats.shots++;
  return true;
}

function loseBall(m: Match, kind: 'intercept' | 'steal', rand: () => number) {
  m.events.push({ type: kind });
  m.stats.lost++;
  startCounter(m, rand);
}

// Contraataque del rival: la defensa puede cortarlo; si no, hay que adivinar el lado para atajar.
export function startCounter(m: Match, rand: () => number) {
  const d = defenders(m.formation);
  const cut = rand() < 0.05 + d * 0.07;
  m.holder = null; m.flight = null;
  m.counter = { t: 0, window: 1.1 + d * 0.12, dir: SIDES[Math.floor(rand() * 3)], cut, chosen: null, result: cut ? 'cut' : null };
  m.phase = 'counter';
  m.events.push({ type: cut ? 'cut' : 'counter' });
  if (cut) pauseThen(m, 1.3, 'kickoff');
}

export function dive(m: Match, side: Side) {
  const c = m.counter;
  if (m.phase !== 'counter' || !c || c.result) return false;
  c.chosen = side;
  c.result = side === c.dir ? 'saved' : 'goal';
  if (c.result === 'goal') m.goals.rival++;
  m.events.push({ type: c.result === 'saved' ? 'counterSaved' : 'counterGoal' });
  pauseThen(m, 1.6, 'kickoff');
  return true;
}

function pauseThen(m: Match, seconds: number, after: 'kickoff') {
  m.pause = seconds; m.after = after;
}

function endIfOver(m: Match) {
  if (m.time >= m.duration && m.phase !== 'end' && !m.pause) { m.phase = 'end'; m.events.push({ type: 'end' }); return true; }
  return false;
}

const approach = (p: { x: number; y: number }, tx: number, ty: number, speed: number, dt: number) => {
  const d = dist(p.x, p.y, tx, ty);
  if (d < 1e-6) return;
  const k = Math.min(1, speed * dt / d);
  p.x += (tx - p.x) * k; p.y += (ty - p.y) * k;
};

export function step(m: Match, dt: number, rand: () => number = Math.random) {
  if (dt <= 0 || m.phase === 'end') return;
  if (m.pause > 0) {
    m.pause -= dt;
    if (m.pause <= 0) { m.pause = 0; if (endIfOver(m)) return; if (m.after === 'kickoff') kickoff(m); m.after = null; }
    if (m.phase !== 'counter') return;
  }
  // El reloj corre mientras se juega (también durante los pases).
  if (m.phase === 'play' || m.phase === 'flight') { m.time += dt; if (m.time >= m.duration && endIfOver(m)) return; }

  if (m.phase === 'counter' && m.counter && !m.counter.result) {
    m.counter.t += dt;
    if (m.counter.t >= m.counter.window) { m.counter.result = 'goal'; m.goals.rival++; m.events.push({ type: 'counterGoal' }); pauseThen(m, 1.6, 'kickoff'); }
    return;
  }
  if (m.phase === 'counter') return;

  // Mi equipo: acompaña la pelota hacia adelante y se mueve un poco para abrir líneas de pase.
  const advance = Math.max(0, Math.min(14, (m.ball.x - 50) * 0.35));
  m.mine.forEach((p, i) => {
    if (i === m.holder) return;
    p.phase += dt * 1.3;
    approach(p, Math.min(97, p.bx + advance + Math.sin(p.phase) * 3), Math.max(3, Math.min(PITCH.h - 3, p.by + Math.cos(p.phase * 0.8) * 3.5)), 9, dt);
  });

  // Rivales: el bloque se corre hacia la pelota y el más cercano presiona.
  const press = Math.min(9.5, 5.4 + m.time * 0.03); // la presión sube con el partido
  const target = m.holder !== null ? m.mine[m.holder] : m.ball;
  let presser = -1, best = Infinity;
  m.rivals.forEach((r, i) => { const d = dist(r.x, r.y, target.x, target.y); if (d < best) { best = d; presser = i; } });
  m.rivals.forEach((r, i) => {
    if (i === presser) approach(r, target.x, target.y, press, dt); // el más cercano presiona o sale a cortar el pase
    else approach(r, Math.min(97, r.bx + (m.ball.x - 60) * 0.3), Math.max(3, Math.min(PITCH.h - 3, r.by + (m.ball.y - PITCH.h / 2) * 0.35)), 7.5, dt);
  });
  approach(m.keeper, 102.5, Math.max(GOAL.top + 1, Math.min(GOAL.bottom - 1, m.ball.y)), 8, dt);

  if (m.phase === 'play' && m.holder !== null) {
    const h = m.mine[m.holder];
    m.ball = { x: h.x, y: h.y };
    m.control = Math.max(0, m.control - dt);
    if (m.control === 0 && dist(m.rivals[presser].x, m.rivals[presser].y, h.x, h.y) < STEAL_RADIUS) loseBall(m, 'steal', rand);
    return;
  }

  if (m.phase === 'flight' && m.flight) {
    const f = m.flight;
    f.t += dt;
    const k = Math.min(1, f.t / f.dur);
    m.ball = { x: f.fromX + (f.toX - f.fromX) * k, y: f.fromY + (f.toY - f.fromY) * k };
    if (f.to !== 'goal') {
      // El receptor va a buscar la pelota; si pasa cerca de un rival, la corta.
      const cut = m.rivals.findIndex(r => dist(r.x, r.y, m.ball.x, m.ball.y) < CUT_RADIUS);
      if (cut >= 0 && k > 0.08) { loseBall(m, 'intercept', rand); return; }
      if (k >= 1) {
        const r = m.mine[f.to];
        r.x = f.toX; r.y = f.toY;
        m.holder = f.to; m.flight = null; m.phase = 'play'; m.control = 0.7; m.stats.passes++;
        m.events.push({ type: 'pass', to: f.to });
      }
      return;
    }
    if (k >= 1) {
      m.flight = null;
      if (f.scores) { m.goals.mine++; m.events.push({ type: 'goal' }); pauseThen(m, 2.2, 'kickoff'); m.phase = 'pause'; }
      else {
        // Después de un tiro errado o atajado, la pelota es del rival y viene su contraataque.
        m.events.push({ type: rand() < 0.55 ? 'saved' : 'miss' });
        m.stats.lost++;
        startCounter(m, rand);
        if (m.counter && !m.counter.cut) m.counter.t = -0.9; // un respiro para ver qué pasó con el tiro
      }
    }
  }
}

export const takeEvents = (m: Match) => m.events.splice(0);
