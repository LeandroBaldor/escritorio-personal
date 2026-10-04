// Lógica de "Tiki-Taka": un partido de pases. Tu equipo ataca hacia la derecha.
// - Con la pelota: tocás a un compañero para pasarle; los rivales presionan al que la tiene y cortan
//   los pases que pasan cerca. Cerca del arco podés patear.
// - Sin la pelota: el rival sigue jugando (toca y avanza hacia tu arco). Tocás a uno de los tuyos para
//   mandarlo a marcar; si llega, la recupera. Si el rival patea, atajás eligiendo un lado.
// La formación importa: más defensores esperan atrás; más volantes y delanteros, más opciones arriba.
// Dos tiempos de 2,5 minutos. Todo se mide en metros de una cancha de 105×68.

export const PITCH = { w: 105, h: 68 };
export const GOAL = { top: 29.5, bottom: 38.5, depth: 2.8 };
export type FormationId = '4-4-2' | '4-3-3' | '3-5-2' | '5-3-2' | '4-2-3-1';
export const FORMATIONS: Record<FormationId, number[]> = {
  '4-4-2': [4, 4, 2], '4-3-3': [4, 3, 3], '3-5-2': [3, 5, 2], '5-3-2': [5, 3, 2], '4-2-3-1': [4, 2, 3, 1],
};
export type Side = 'izq' | 'medio' | 'der';
export type Risk = 'safe' | 'risky' | 'blocked';
export type Team = 'mine' | 'rival';
export interface Player { x: number; y: number; bx: number; by: number; n: number; phase: number }
export type MatchEvent =
  | { type: 'pass'; to: number } | { type: 'intercept' } | { type: 'steal' } | { type: 'goal' } | { type: 'saved' } | { type: 'miss' }
  | { type: 'recover' } | { type: 'dribble' } | { type: 'rivalShot' } | { type: 'keeperSave' } | { type: 'rivalGoal' } | { type: 'kickoff' } | { type: 'half' } | { type: 'end' };
export interface Flight { team: Team; fromX: number; fromY: number; toX: number; toY: number; t: number; dur: number; to: number | 'goal'; scores?: boolean }
export interface Save { t: number; window: number; dir: Side; chosen: Side | null; result: 'saved' | 'goal' | null; fromX: number; fromY: number; autoSave: boolean }
export interface Match {
  formation: FormationId; mine: Player[]; rivals: Player[]; keeper: { x: number; y: number }; myKeeper: { x: number; y: number };
  possession: Team; holder: number | null; ball: { x: number; y: number }; spin: number; flight: Flight | null;
  phase: 'play' | 'flight' | 'save' | 'pause' | 'half' | 'end'; pause: number; after: 'kickoffMine' | 'kickoffRival' | 'keeperMine' | null;
  time: number; half: 1 | 2; halfSeconds: number; goals: { mine: number; rival: number }; control: number;
  chaser: number | null; decide: number; dodge: number; stunned: { team: Team; index: number; t: number } | null; save: Save | null; events: MatchEvent[]; stats: { passes: number; shots: number; lost: number; recovered: number };
}

export const HALF_SECONDS = 150;
const PASS_SPEED = 40, RIVAL_PASS_SPEED = 30;
export const TUNE = { rivalRun: 5.4, shootFrom: 20, autoSpeed: 5, defenderTackle: 0.35 };
const RIVAL_RUN = TUNE.rivalRun;
const CUT_RADIUS = 1.7, RIVAL_CUT_RADIUS = 1.8, STEAL_RADIUS = 1.6, TACKLE_RADIUS = 1.7;
export const SHOOT_FROM = 72;
const SIDES: Side[] = ['izq', 'medio', 'der'];
const GOAL_MID = (GOAL.top + GOAL.bottom) / 2;

const defenders = (f: FormationId) => FORMATIONS[f][0];
export const minute = (m: Match) => Math.min(90, Math.floor(m.time / (m.halfSeconds * 2) * 90));
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const clampY = (y: number) => Math.max(3, Math.min(PITCH.h - 3, y));

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

export function newMatch(formation: FormationId, halfSeconds = HALF_SECONDS): Match {
  const m: Match = {
    formation, mine: lines(FORMATIONS[formation], 26, 74), rivals: lines([4, 4, 2], 90, 60),
    keeper: { x: 102.5, y: PITCH.h / 2 }, myKeeper: { x: 2.5, y: PITCH.h / 2 },
    possession: 'mine', holder: null, ball: { x: 0, y: 0 }, spin: 0, flight: null,
    phase: 'play', pause: 0, after: null, time: 0, half: 1, halfSeconds, goals: { mine: 0, rival: 0 }, control: 0,
    chaser: null, decide: 1, dodge: 0, stunned: null, save: null, events: [], stats: { passes: 0, shots: 0, lost: 0, recovered: 0 },
  };
  kickoff(m, 'mine');
  return m;
}

// Saque del medio: todos a su lugar y la pelota para el equipo que saca.
export function kickoff(m: Match, team: Team) {
  for (const p of [...m.mine, ...m.rivals]) { p.x = p.bx; p.y = p.by; }
  m.keeper = { x: 102.5, y: PITCH.h / 2 }; m.myKeeper = { x: 2.5, y: PITCH.h / 2 };
  m.flight = null; m.save = null; m.chaser = null; m.phase = 'play'; m.possession = team; m.control = 1.2; m.decide = 1.4;
  if (team === 'mine') {
    const counts = FORMATIONS[m.formation];
    m.holder = counts[0] + Math.floor(counts[1] / 2);
    m.ball = { x: m.mine[m.holder].x, y: m.mine[m.holder].y };
  } else {
    m.holder = 9; // un delantero rival saca del medio
    m.rivals[9].x = PITCH.w / 2 + 1; m.rivals[9].y = PITCH.h / 2;
    m.ball = { x: m.rivals[9].x, y: m.rivals[9].y };
  }
  m.events.push({ type: 'kickoff' });
}

function toSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return dist(px, py, ax + t * dx, ay + t * dy);
}

// Radar de pases: qué tan arriesgado es pasarle a un compañero ahora.
export function passRisk(m: Match, to: number): Risk {
  if (m.possession !== 'mine' || m.holder === null || to === m.holder) return 'blocked';
  const a = m.mine[m.holder], b = m.mine[to];
  const near = Math.min(...m.rivals.map(r => toSegment(r.x, r.y, a.x, a.y, b.x, b.y)));
  return near < CUT_RADIUS ? 'blocked' : near < 4.2 ? 'risky' : 'safe';
}

export function pass(m: Match, to: number) {
  if (m.phase !== 'play' || m.possession !== 'mine' || m.holder === null || to === m.holder || !m.mine[to]) return false;
  const a = m.mine[m.holder], b = m.mine[to];
  m.flight = { team: 'mine', fromX: a.x, fromY: a.y, toX: b.x, toY: b.y, t: 0, dur: Math.max(0.25, dist(a.x, a.y, b.x, b.y) / PASS_SPEED), to };
  m.holder = null; m.phase = 'flight';
  return true;
}

// Sin la pelota: mandar a uno de los tuyos a marcar al rival que la tiene.
export function chase(m: Match, who: number) {
  if (m.possession !== 'rival' || !m.mine[who] || m.phase === 'end' || m.phase === 'half') return false;
  m.chaser = who;
  return true;
}

export const canShoot = (m: Match) => m.phase === 'play' && m.possession === 'mine' && m.holder !== null && m.mine[m.holder].x >= SHOOT_FROM;

export function shotChance(m: Match) {
  if (m.possession !== 'mine' || m.holder === null) return 0;
  const p = m.mine[m.holder];
  const d = dist(p.x, p.y, PITCH.w, GOAL_MID);
  const blockers = m.rivals.filter(r => r.x > p.x && toSegment(r.x, r.y, p.x, p.y, PITCH.w, GOAL_MID) < 2.2).length;
  return Math.max(0.05, Math.min(0.9, 0.97 - (d - 11) * 0.028 - blockers * 0.22));
}

export function shoot(m: Match, rand: () => number = Math.random) {
  if (!canShoot(m)) return false;
  const p = m.mine[m.holder!];
  const scores = rand() < shotChance(m);
  const y = scores ? GOAL.top + 0.8 + rand() * (GOAL.bottom - GOAL.top - 1.6) : rand() < 0.5 ? GOAL.top - 1.5 - rand() * 4 : GOAL.bottom + 1.5 + rand() * 4;
  const toY = scores ? y : rand() < 0.55 ? m.keeper.y : y;
  m.flight = { team: 'mine', fromX: p.x, fromY: p.y, toX: PITCH.w + (scores ? 1.5 : 0.3), toY, t: 0, dur: Math.max(0.35, dist(p.x, p.y, PITCH.w, toY) / 55), to: 'goal', scores };
  m.holder = null; m.phase = 'flight'; m.stats.shots++;
  return true;
}

// Cambia la posesión: el que la gana arranca con un ratito de control para que no se la saquen enseguida.
function giveTo(m: Match, team: Team, holder: number, kind?: 'intercept' | 'steal' | 'recover') {
  // El que perdió la pelota queda desacomodado un momento y no puede quitarla de vuelta enseguida.
  const loser = m.possession !== team && m.holder !== null ? m.holder : null;
  m.stunned = loser !== null ? { team: m.possession, index: loser, t: 1.4 } : null;
  m.possession = team; m.holder = holder; m.flight = null; m.phase = 'play'; m.decide = 0.9; m.chaser = null;
  const p = team === 'mine' ? m.mine[holder] : m.rivals[holder];
  // Si la recuperás cerca de tu arco, tenés un respiro más largo para sacarla jugando.
  m.control = team === 'mine' && p.x < 35 ? 2.2 : 1.2;
  m.ball = { x: p.x, y: p.y };
  if (kind) m.events.push({ type: kind });
  if (team === 'rival' && kind) m.stats.lost++;
  if (team === 'mine' && kind) m.stats.recovered++;
}

const nearest = (list: Player[], x: number, y: number) => {
  let best = 0, d = Infinity;
  list.forEach((p, i) => { const k = dist(p.x, p.y, x, y); if (k < d) { d = k; best = i; } });
  return best;
};

// El rival patea: atajás eligiendo un lado antes de que llegue la pelota.
function rivalShoots(m: Match, rand: () => number) {
  const h = m.rivals[m.holder!];
  const far = dist(h.x, h.y, 0, GOAL_MID);
  m.save = { t: 0, window: 1.0 + defenders(m.formation) * 0.1, dir: SIDES[Math.floor(rand() * 3)], chosen: null, result: null, fromX: h.x, fromY: h.y, autoSave: rand() < Math.max(0, Math.min(0.45, (far - 9) * 0.04)) };
  m.holder = null; m.phase = 'save';
  m.events.push({ type: 'rivalShot' });
}

export function dive(m: Match, side: Side) {
  const s = m.save;
  if (m.phase !== 'save' || !s || s.result) return false;
  s.chosen = side;
  finishSave(m, side === s.dir ? 'saved' : 'goal');
  return true;
}

function finishSave(m: Match, result: 'saved' | 'goal') {
  const s = m.save!;
  // Aunque te tires mal, el arquero a veces llega igual a los tiros de lejos.
  if (result === 'goal' && s.autoSave) result = 'saved';
  s.result = result;
  const y = s.dir === 'izq' ? GOAL.top + 1.2 : s.dir === 'der' ? GOAL.bottom - 1.2 : GOAL_MID;
  if (result === 'goal') { m.goals.rival++; m.ball = { x: -1.5, y }; m.events.push({ type: 'rivalGoal' }); wait(m, 1.8, 'kickoffMine'); }
  else { m.ball = { x: 2.5, y }; m.myKeeper.y = y; m.events.push({ type: 'keeperSave' }); wait(m, 1.4, 'keeperMine'); }
}

function wait(m: Match, seconds: number, after: Match['after']) { m.pause = seconds; m.after = after; }

function afterPause(m: Match) {
  const after = m.after;
  m.after = null; m.save = null;
  if (after === 'kickoffMine') kickoff(m, 'mine');
  else if (after === 'kickoffRival') kickoff(m, 'rival');
  else if (after === 'keeperMine') {
    // Saque de arco: todos a sus lugares y el arquero se la da a un defensor, sin un rival encima.
    for (const p of [...m.mine, ...m.rivals]) { p.x = p.bx; p.y = p.by; }
    const d = nearest(m.mine.slice(0, defenders(m.formation)), 2.5, m.ball.y);
    m.stunned = null;
    giveTo(m, 'mine', d);
    m.control = 1.5;
  }
}

export function startSecondHalf(m: Match) {
  if (m.phase !== 'half') return false;
  m.half = 2;
  kickoff(m, 'rival');
  return true;
}

const approach = (p: { x: number; y: number }, tx: number, ty: number, speed: number, dt: number) => {
  const d = dist(p.x, p.y, tx, ty);
  if (d < 1e-6) return;
  const k = Math.min(1, speed * dt / d);
  p.x += (tx - p.x) * k; p.y += (ty - p.y) * k;
};

function moveBall(m: Match, x: number, y: number) {
  m.spin += dist(m.ball.x, m.ball.y, x, y) * 0.9;
  m.ball = { x, y };
}

// El reloj corre en juego (no en los festejos). Al llegar a los 45' viene el entretiempo; a los 90', el final.
function clock(m: Match, dt: number) {
  m.time += dt;
  const limit = m.half === 1 ? m.halfSeconds : m.halfSeconds * 2;
  if (m.time < limit) return false;
  m.time = limit;
  m.flight = null; m.holder = null; m.save = null;
  if (m.half === 1) { m.phase = 'half'; m.events.push({ type: 'half' }); }
  else { m.phase = 'end'; m.events.push({ type: 'end' }); }
  return true;
}

export function step(m: Match, dt: number, rand: () => number = Math.random) {
  if (dt <= 0 || m.phase === 'end' || m.phase === 'half') return;
  if (m.pause > 0) {
    m.pause -= dt;
    if (m.pause <= 0) { m.pause = 0; afterPause(m); }
    return;
  }
  if (clock(m, dt)) return;

  if (m.phase === 'save' && m.save) {
    const s = m.save;
    s.t += dt;
    const k = Math.min(1, s.t / s.window);
    const y = s.dir === 'izq' ? GOAL.top + 1.2 : s.dir === 'der' ? GOAL.bottom - 1.2 : GOAL_MID;
    moveBall(m, s.fromX + (-0.5 - s.fromX) * k, s.fromY + (y - s.fromY) * k);
    if (s.t >= s.window && !s.result) finishSave(m, 'goal');
    return;
  }

  if (m.stunned) { m.stunned.t -= dt; if (m.stunned.t <= 0) m.stunned = null; }
  const ballTarget = m.holder !== null ? (m.possession === 'mine' ? m.mine[m.holder] : m.rivals[m.holder]) : m.ball;
  approach(m.keeper, 102.5, Math.max(GOAL.top + 1, Math.min(GOAL.bottom - 1, m.ball.y)), 8, dt);
  approach(m.myKeeper, 2.5, Math.max(GOAL.top + 1, Math.min(GOAL.bottom - 1, m.ball.y)), 8, dt);

  if (m.possession === 'mine') stepAttack(m, dt, rand, ballTarget);
  else stepDefense(m, dt, rand, ballTarget);
}

// Atacás vos: tu equipo acompaña y abre líneas; el rival se cierra y presiona.
function stepAttack(m: Match, dt: number, rand: () => number, target: { x: number; y: number }) {
  const advance = Math.max(0, Math.min(14, (m.ball.x - 50) * 0.35));
  m.mine.forEach((p, i) => {
    if (i === m.holder) return;
    p.phase += dt * 1.3;
    approach(p, Math.min(97, p.bx + advance + Math.sin(p.phase) * 3), clampY(p.by + Math.cos(p.phase * 0.8) * 3.5), 9, dt);
  });
  const press = Math.min(9, 5 + m.time * 0.012);
  const stunnedRival = m.stunned?.team === 'rival' ? m.stunned.index : -1;
  const presser = nearest(m.rivals.map((r, i) => i === stunnedRival ? { ...r, x: 1e4 } : r), target.x, target.y);
  m.rivals.forEach((r, i) => {
    if (i === stunnedRival) return;
    if (i === presser) approach(r, target.x, target.y, press, dt);
    else approach(r, Math.min(97, r.bx + (m.ball.x - 60) * 0.3), clampY(r.by + (m.ball.y - PITCH.h / 2) * 0.35), 7.5, dt);
  });

  if (m.phase === 'play' && m.holder !== null) {
    const h = m.mine[m.holder];
    moveBall(m, h.x, h.y);
    m.control = Math.max(0, m.control - dt);
    if (m.control === 0 && dist(m.rivals[presser].x, m.rivals[presser].y, h.x, h.y) < STEAL_RADIUS) giveTo(m, 'rival', presser, 'steal');
    return;
  }
  const f = m.flight;
  if (m.phase !== 'flight' || !f) return;
  f.t += dt;
  const k = Math.min(1, f.t / f.dur);
  moveBall(m, f.fromX + (f.toX - f.fromX) * k, f.fromY + (f.toY - f.fromY) * k);
  if (f.to !== 'goal') {
    const cut = m.rivals.findIndex(r => dist(r.x, r.y, m.ball.x, m.ball.y) < CUT_RADIUS);
    if (cut >= 0 && k > 0.08) { giveTo(m, 'rival', cut, 'intercept'); return; }
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
    if (f.scores) { m.goals.mine++; m.events.push({ type: 'goal' }); m.phase = 'pause'; wait(m, 2.2, 'kickoffRival'); }
    else {
      // Tiro errado o atajado: la pelota es del rival y arranca desde atrás.
      m.events.push({ type: rand() < 0.55 ? 'saved' : 'miss' });
      const d = nearest(m.rivals.slice(0, 4), 95, m.ball.y);
      m.rivals[d].x = 92; m.rivals[d].y = clampY(m.ball.y);
      giveTo(m, 'rival', d);
      m.stats.lost++;
    }
  }
}

// Ataca el rival: toca y avanza hacia tu arco. Tus jugadores vuelven a su campo; el que mandes a marcar
// (y el más cercano, más despacio) van a la pelota.
function stepDefense(m: Match, dt: number, rand: () => number, target: { x: number; y: number }) {
  m.rivals.forEach((r, i) => {
    if (i === m.holder) return;
    r.phase += dt * 1.2;
    approach(r, Math.max(8, r.bx - 30 + Math.sin(r.phase) * 3), clampY(r.by + Math.cos(r.phase * 0.9) * 4 + (m.ball.y - PITCH.h / 2) * 0.2), 8, dt);
  });
  const stunnedMine = m.stunned?.team === 'mine' ? m.stunned.index : -1;
  const auto = nearest(m.mine.map((p, i) => i === stunnedMine ? { ...p, x: 1e4 } : p), target.x, target.y);
  // Un defensor sale a cerrar el camino entre la pelota y tu arco.
  const backs = defenders(m.formation);
  const cover = nearest(m.mine.slice(0, backs).map((p, i) => i === auto || i === stunnedMine || i === m.chaser ? { ...p, x: 1e4 } : p), target.x, target.y);
  m.mine.forEach((p, i) => {
    if (i === stunnedMine) return;
    if (i === m.chaser) approach(p, target.x, target.y, 9, dt);
    else if (i === auto) approach(p, target.x, target.y, TUNE.autoSpeed, dt);
    else if (i === cover) approach(p, Math.max(14, (target.x + 14) / 2), clampY(target.y), 6, dt);
    else approach(p, Math.max(17, p.bx - 14), clampY(p.by + (m.ball.y - PITCH.h / 2) * 0.3), 7.5, dt);
  });
  m.dodge = Math.max(0, m.dodge - dt);

  if (m.phase === 'play' && m.holder !== null) {
    const h = m.rivals[m.holder];
    // Conduce hacia tu arco y esquiva al defensor que tiene adelante.
    const blocker = m.mine.filter(p => p.x < h.x && p.x > h.x - 7 && Math.abs(p.y - h.y) < 4).sort((a, b) => b.x - a.x)[0];
    const ty = blocker ? clampY(h.y + (h.y >= blocker.y ? 7 : -7)) : h.y + (GOAL_MID - h.y) * 0.5;
    approach(h, 6, ty, RIVAL_RUN, dt);
    moveBall(m, h.x, h.y);
    m.control = Math.max(0, m.control - dt);
    // Solo quitan el que mandaste a marcar (más seguro) y el más cercano; a veces el rival gambetea.
    if (m.control === 0 && m.dodge === 0) {
      const tackler = m.mine.findIndex((p, i) => i !== stunnedMine && dist(p.x, p.y, h.x, h.y) < TACKLE_RADIUS);
      if (tackler >= 0) {
        const chance = tackler === m.chaser ? 0.75 : tackler === auto ? 0.4 : TUNE.defenderTackle;
        if (rand() < chance) { giveTo(m, 'mine', tackler, 'recover'); return; }
        m.dodge = 0.8; m.events.push({ type: 'dribble' });
      }
    }
    m.decide -= dt;
    if (m.decide > 0) return;
    m.decide = 0.6 + rand() * 0.7;
    if (h.x < TUNE.shootFrom) { rivalShoots(m, rand); return; }
    // Pasa a uno de los compañeros más adelantados con la línea libre (a veces sigue gambeteando).
    const options = m.rivals.map((r, i) => ({ i, r, room: Math.min(...m.mine.map(p => toSegment(p.x, p.y, h.x, h.y, r.x, r.y))) }))
      .filter(o => o.i !== m.holder && o.r.x < h.x - 4 && o.room > 2.4)
      .sort((a, b) => a.r.x - b.r.x);
    const choice = options[Math.floor(rand() * Math.min(2, options.length))];
    if (!choice || rand() < 0.2) return;
    m.flight = { team: 'rival', fromX: h.x, fromY: h.y, toX: choice.r.x, toY: choice.r.y, t: 0, dur: Math.max(0.3, dist(h.x, h.y, choice.r.x, choice.r.y) / RIVAL_PASS_SPEED), to: choice.i };
    m.holder = null; m.phase = 'flight';
    return;
  }
  const f = m.flight;
  if (m.phase !== 'flight' || !f || f.to === 'goal') return;
  f.t += dt;
  const k = Math.min(1, f.t / f.dur);
  moveBall(m, f.fromX + (f.toX - f.fromX) * k, f.fromY + (f.toY - f.fromY) * k);
  const cut = m.mine.findIndex(p => dist(p.x, p.y, m.ball.x, m.ball.y) < RIVAL_CUT_RADIUS);
  if (cut >= 0 && k > 0.12) { giveTo(m, 'mine', cut, 'recover'); return; }
  if (k >= 1) {
    const r = m.rivals[f.to];
    r.x = f.toX; r.y = f.toY;
    m.holder = f.to; m.flight = null; m.phase = 'play'; m.control = 0.5;
  }
}

export const takeEvents = (m: Match) => m.events.splice(0);
