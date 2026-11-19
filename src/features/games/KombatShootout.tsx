import { useCallback, useEffect, useRef, useState } from 'react';
import { pixelRatio } from './fitScreen';
import { CHARS, type CharId, type StageId } from './kombat';
import {
  BALL_FX_NAMES, REGULATION, beginShootout, cpuHand, cpuZone, fxOfTurn, newPenalties, rpsWinner, scoreOf, shooterOf, startKick, stepPenalties, suddenDeath, takePenEvents,
  type Hand, type PenMatch, type Zone,
} from './kombatPenalties';
import { drawPenBackdrop, drawPenalties, drawPenaltyRefereeLayer, keeperBody, kickerBody, onPenaltyArtLoad, penView, preloadPenaltyArt, zoneAt } from './kombatPenaltiesArt';
import { DOUBLE_MS, HAND_KEYS, KickDots, RPS_STEP, RpsBox, ZONE_KEYS, type Rps } from './KombatPenaltiesGame';
import { drawPortrait, setLowFx } from './kombatFighters';
import { setNoGrain } from './gravityMonsters';
import { onBackdropLoad } from './kombatScenery';
import {
  playKfButton, playKfGoal, playPenArm, playPenDeathStart, playPenExplosion, playPenKick, playPenNet, playPenSave, playPenScream, playPenSteps, playPenStomp,
  playRefWhistle, playVampBurn, preloadPenaltySounds, setCrowd, syncPenDeathAudio, syncPenaltySceneAudio,
} from './sounds';

// La tanda de penales de Kombat Football cuando un partido termina empatado: es la de Kombat Penales (el mismo
// arco, los mismos 6 lugares, las mismas muertes), con la misma regla contra la máquina: la máquina elige dónde
// patear o dónde tirarse apenas suena el silbato de cada penal, antes de que elija la persona (setupTurn). Antes,
// piedra, papel o tijera para ver quién patea primero (la máquina elige su mano apenas arranca).

export const HUMAN_REACH = 0.3; // cuánto llega con la punta de los dedos el arquero de una persona
const QUALITY = [1, 0.82, 0.68, 0.55];
interface Aim { role: 'keeper' | 'shooter'; side: 0 | 1 }
interface Hud { kicks: [boolean[], boolean[]]; turn: number; first: 0 | 1; sudden: boolean }

function Face({ char, size, mirror }: { char: CharId; size: number; mirror: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const k = pixelRatio(); c.width = size * k; c.height = size * k;
    const ctx = c.getContext('2d'); if (!ctx) return;
    ctx.setTransform(k, 0, 0, k, 0, 0); drawPortrait(ctx, char, size, 0, mirror, true);
  }, [char, size, mirror]);
  return <canvas ref={ref} className="kf-portrait" style={{ width: size, height: size }} aria-hidden="true" />;
}

export interface ShootoutProps {
  stage: StageId; chars: [CharId, CharId];
  two: boolean; // las dos son personas (si no, el lado 1 es la máquina)
  reach: number; // cuánto llega el arquero de la máquina cuando adivina el lado pero no la altura
  labels: [string, string]; paused: boolean;
  onEnd: (winner: 0 | 1, score: [number, number]) => void;
}
export function KombatShootout({ stage, chars, two, reach, labels, paused, onEnd }: ShootoutProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const refereeRef = useRef<HTMLCanvasElement>(null);
  const bgKey = useRef('');
  const [first] = useState(() => { const m = newPenalties(stage, chars); m.humans = [true, two]; return m; }); // (la tanda arranca una sola vez)
  const matchRef = useRef<PenMatch | null>(first);
  const picks = useRef<{ shot: Zone | null; dive: Zone | null }>({ shot: null, dive: null });
  const [hud, setHud] = useState<Hud>({ kicks: [[], []], turn: 0, first: 0, sudden: false });
  const [aim, setAimState] = useState<Aim | null>(null);
  const aimRef = useRef<Aim | null>(null);
  const setAim = useCallback((a: Aim | null) => { aimRef.current = a; setAimState(a); }, []);
  const zoneRef = useRef<Zone | null>(1);
  const pausedRef = useRef(paused); useEffect(() => { pausedRef.current = paused; }, [paused]);
  const endRef = useRef(onEnd); useEffect(() => { endRef.current = onEnd; }, [onEnd]);
  const ended = useRef(false);
  const quality = useRef(0);
  const backdropTick = useRef(0);
  useEffect(() => onBackdropLoad(() => { backdropTick.current++; }), []);
  useEffect(() => onPenaltyArtLoad(() => { backdropTick.current++; }), []);
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __kfPens?: () => PenMatch | null }).__kfPens = () => matchRef.current; }, []); // (para probar en desarrollo)

  useEffect(() => { preloadPenaltyArt(); preloadPenaltySounds(); }, []);

  const paint = useCallback(() => {
    const el = boxRef.current, canvas = canvasRef.current, m = matchRef.current;
    if (!el || !canvas || !m) return;
    const touch = !!window.matchMedia?.('(pointer: coarse)').matches;
    const finale = m.phase === 'execution';
    const k = finale ? Math.min(pixelRatio(2), 2560 / Math.max(1, el.clientWidth), 1500 / Math.max(1, el.clientHeight)) : Math.min(pixelRatio(touch ? 1.5 : 2), (touch ? 1280 : 1920) / Math.max(1, el.clientWidth), (touch ? 760 : 1100) / Math.max(1, el.clientHeight)) * QUALITY[quality.current];
    const w = Math.round(el.clientWidth * k), h = Math.round(el.clientHeight * k);
    if (!w || !h) return;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const low = touch || quality.current > 0; setLowFx(low); setNoGrain(low);
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
    const referee = refereeRef.current;
    drawPenalties(ctx, m, w, h, { referee: !referee });
    if (referee) {
      const ratio = Math.min(pixelRatio(3), 3840 / Math.max(1, el.clientWidth), 2160 / Math.max(1, el.clientHeight));
      const rw = Math.round(el.clientWidth * ratio), rh = Math.round(el.clientHeight * ratio);
      if (referee.width !== rw || referee.height !== rh) { referee.width = rw; referee.height = rh; }
      const rctx = referee.getContext('2d'); if (rctx) drawPenaltyRefereeLayer(rctx, m, rw, rh);
    }
    const bg = bgRef.current;
    if (bg) {
      const kb = Math.min(pixelRatio(2), 2560 / Math.max(1, el.clientWidth), 1500 / Math.max(1, el.clientHeight)), bw = Math.round(el.clientWidth * kb), bh = Math.round(el.clientHeight * kb);
      if (bg.width !== bw || bg.height !== bh) { bg.width = bw; bg.height = bh; bgKey.current = ''; }
      const key = `${m.stage}|${backdropTick.current}|${bw}x${bh}`, bctx = bg.getContext('2d');
      if (bctx && key !== bgKey.current) { bgKey.current = key; bctx.setTransform(1, 0, 0, 1, 0, 0); drawPenBackdrop(bctx, m.stage, bw, bh); }
    }
    setNoGrain(false);
  }, []);

  // Cada penal: la máquina elige primero (escondido), apenas suena el silbato, y después le toca a la persona.
  const setupTurn = useCallback((m: PenMatch) => {
    picks.current = { shot: null, dive: null };
    const shooter = shooterOf(m.turn, m.first);
    let next: Aim;
    if (two) next = { role: 'shooter', side: shooter }; // entre dos: primero el que patea, después el arquero
    else if (shooter === 0) { picks.current.dive = cpuZone(m.rand); next = { role: 'shooter', side: 0 }; }
    else { picks.current.shot = cpuZone(m.rand); next = { role: 'keeper', side: 0 }; }
    zoneRef.current = 1; setAim(next);
  }, [setAim, two]);

  // ---------------------------------------------------------------- Piedra, papel o tijera (quién patea primero)
  const [rps, setRpsState] = useState<Rps | null>(null);
  const rpsRef = useRef<Rps | null>(null);
  const setRps = useCallback((r: Rps | null) => { rpsRef.current = r; setRpsState(r); }, []);
  const timers = useRef<number[]>([]);
  const later = (ms: number, f: () => void) => { timers.current.push(window.setTimeout(f, ms)); };
  useEffect(() => () => { timers.current.forEach(t => clearTimeout(t)); }, []);
  const startRps = useCallback(() => { setRps({ stage: 'pick', picker: 0, hands: [null, two ? null : cpuHand(Math.random)], frame: 0, winner: null, cpuOrder: null }); }, [setRps, two]);
  const finishOrder = useCallback((winner: 0 | 1, order: 'first' | 'second') => {
    const m = matchRef.current; if (!m) return;
    rpsRef.current = null; setRpsState(null); beginShootout(m, order === 'first' ? winner : winner === 0 ? 1 : 0);
  }, []);
  const pickHand = useCallback((h: Hand) => {
    const r = rpsRef.current; if (!r || r.stage !== 'pick' || pausedRef.current) return;
    playKfButton(0.7);
    const hands: [Hand | null, Hand | null] = [...r.hands]; hands[r.picker] = h;
    if (two && r.picker === 0) { setRps({ ...r, hands, picker: 1 }); return; }
    setRps({ ...r, hands, stage: 'anim', frame: 0 });
    for (let f = 1; f <= 5; f++) later(f * RPS_STEP, () => { const cur = rpsRef.current; if (!cur) return; setRps({ ...cur, frame: f }); playPenArm(f === 5); });
    later(5 * RPS_STEP + 1400, () => {
      const cur = rpsRef.current; if (!cur) return;
      const w = rpsWinner(hands[0]!, hands[1]!);
      if (w === null) { startRps(); return; }
      const cpuWins = !two && w === 1, cpuOrder = cpuWins ? (Math.random() < 0.5 ? 'first' : 'second') : null;
      setRps({ ...cur, stage: 'order', winner: w, cpuOrder });
      if (cpuWins && cpuOrder) later(1600, () => finishOrder(1, cpuOrder));
    });
  }, [setRps, startRps, finishOrder, two]);
  const chooseOrder = useCallback((o: 'first' | 'second') => {
    const r = rpsRef.current; if (!r || r.stage !== 'order' || r.winner === null || r.cpuOrder) return;
    playKfButton(0.7); finishOrder(r.winner, o);
  }, [finishOrder]);

  // La elección de un lugar del arco.
  const choose = useCallback((z: Zone) => {
    const m = matchRef.current, a = aimRef.current;
    if (!m || !a || m.phase !== 'aim' || pausedRef.current) return;
    playKfButton(0.7);
    if (a.role === 'keeper') picks.current.dive = z; else picks.current.shot = z;
    if (two && a.role === 'shooter') { setAim({ role: 'keeper', side: a.side === 0 ? 1 : 0 }); zoneRef.current = 1; return; }
    const { shot, dive } = picks.current;
    if (shot === null || dive === null) return;
    const cpuKeeps = !two && shooterOf(m.turn, m.first) === 0;
    startKick(m, shot, dive, cpuKeeps ? reach : HUMAN_REACH);
    playPenSteps();
    setAim(null);
  }, [setAim, two, reach]);
  const tap = useRef<{ dir: 'left' | 'right'; timer: number } | null>(null);
  const arrowSide = useCallback((dir: 'left' | 'right') => {
    const low: Zone = dir === 'left' ? 3 : 5, high: Zone = dir === 'left' ? 0 : 2, prev = tap.current;
    if (prev) { clearTimeout(prev.timer); tap.current = null; if (prev.dir === dir) { zoneRef.current = high; choose(high); return; } }
    zoneRef.current = low;
    tap.current = { dir, timer: window.setTimeout(() => { tap.current = null; choose(low); }, DOUBLE_MS) };
  }, [choose]);
  useEffect(() => () => { if (tap.current) clearTimeout(tap.current.timer); }, []);

  // ---------------------------------------------------------------- El paso de la tanda
  useEffect(() => {
    if (paused) { setCrowd(0); return; }
    setCrowd(0.55);
    let slow = 1 / 60, checkT = 0, frame = 0, last = performance.now();
    const tick = (now: number) => {
      const m = matchRef.current; if (!m) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      slow = slow * 0.95 + dt * 0.05; checkT += dt;
      if (checkT > 1.5) {
        if (slow > 1 / 45 && quality.current < QUALITY.length - 1) { quality.current++; checkT = 0; }
        else if (slow < 1 / 57 && quality.current > 0 && checkT > 6) { quality.current--; checkT = 0; }
      }
      stepPenalties(m, dt, side => kickerBody(m.chars[side]), side => keeperBody(m, m.chars[side]));
      if (m.phase === 'rps' && !rpsRef.current) startRps();
      const k = m.kick;
      for (const e of takePenEvents(m)) {
        switch (e.type) {
          case 'whistle': playRefWhistle('penalty'); setupTurn(m); break;
          case 'kick': playPenKick(); break;
          case 'goal': playPenNet(); playKfGoal(); setCrowd(1); setTimeout(() => { if (!pausedRef.current) setCrowd(0.55); }, 1800); break;
          case 'save': playPenSave(); break;
          case 'deathStart': playPenDeathStart(e.death); break;
          case 'burn': playVampBurn(); break;
          case 'scream': playPenScream(); break;
          case 'boom': if (e.death === 'stomp') playPenStomp(); else if (e.death !== 'acid' && e.death !== 'ash') playPenExplosion(); break;
          case 'end': playRefWhistle('end'); break;
          case 'post': break;
        }
      }
      syncPenDeathAudio(m.death?.type ?? null, m.death?.t ?? 0);
      syncPenaltySceneAudio(m.phase === 'execution' ? m.phaseT : null);
      paint();
      setHud(prev => {
        const next: Hud = { kicks: [[...m.kicks[0]], [...m.kicks[1]]], turn: m.turn, first: m.first, sudden: suddenDeath(m.kicks) && !(k && !k.hit) };
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
      if (m.phase === 'end' && m.phaseT > 2.4 && m.winner !== null && !ended.current) { ended.current = true; endRef.current(m.winner, scoreOf(m.kicks)); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const observer = new ResizeObserver(paint); if (boxRef.current) observer.observe(boxRef.current);
    return () => { cancelAnimationFrame(frame); syncPenDeathAudio(null); syncPenaltySceneAudio(null); observer.disconnect(); };
  }, [paused, paint, setupTurn, startRps]);
  useEffect(() => () => setCrowd(0), []);

  // Teclado: flechas para el lugar (o Q W E / A S D directo); en el piedra, papel o tijera, ← ↓ →.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (pausedRef.current) return;
      const r = rpsRef.current;
      if (r) {
        if (e.repeat) return;
        if (r.stage === 'pick' && HAND_KEYS[e.code]) { e.preventDefault(); pickHand(HAND_KEYS[e.code]); }
        else if (r.stage === 'order' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) { e.preventDefault(); chooseOrder(e.code === 'ArrowLeft' ? 'first' : 'second'); }
        return;
      }
      if (!aimRef.current) return;
      const z = ZONE_KEYS[e.code];
      if (z !== undefined) { e.preventDefault(); choose(z); return; }
      if (e.repeat) return;
      if (e.code === 'ArrowLeft') { e.preventDefault(); arrowSide('left'); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); arrowSide('right'); }
      else if (e.code === 'ArrowUp') { e.preventDefault(); if (tap.current) { clearTimeout(tap.current.timer); tap.current = null; } choose(1); }
      else if (e.code === 'ArrowDown') { e.preventDefault(); if (tap.current) { clearTimeout(tap.current.timer); tap.current = null; } choose(4); }
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); if (zoneRef.current !== null) choose(zoneRef.current); }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [choose, arrowSide, pickHand, chooseOrder]);
  const zoneFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget, r = c.getBoundingClientRect(); if (!r.width) return null;
    return zoneAt(penView(r.width, r.height), e.clientX - r.left, e.clientY - r.top);
  };

  const fill: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' };
  const block = Math.floor(Math.floor(hud.turn / 2) / REGULATION) * REGULATION, shownKicks = (i: 0 | 1) => hud.kicks[i].slice(block, block + REGULATION);
  const shooterNow = shooterOf(hud.turn, hud.first);
  const side = (i: 0 | 1) => <div className={`kp-board-side kp-board-side--${i}${aim && aim.side === i ? ' kp-board-side--now' : ''}`} data-testid={`kf-pen-side-${i}`}>
    <span className="kp-board-face" style={{ ['--kf-c' as string]: CHARS[chars[i]].color }}><Face char={chars[i]} size={40} mirror={i === 1} /></span>
    <b>{CHARS[chars[i]].name}</b>
    <i className="kp-board-role" aria-label={shooterNow === i ? 'patea' : 'ataja'}>{shooterNow === i ? '⚽' : '🧤'}</i>
  </div>;
  const aimTitle = aim ? (two
    ? `${labels[aim.side]} · ${CHARS[chars[aim.side]].name}: ${aim.role === 'keeper' ? '🧤 elegí dónde te tirás (que no mire el otro)' : '⚽ elegí dónde patear'}`
    : aim.role === 'shooter' ? '⚽ Elegí dónde patear' : '🧤 Sos el arquero: elegí dónde te tirás') : '';
  const aimSub = aim ? (two ? (aim.role === 'shooter' ? 'Primero elige el que patea, después el arquero' : 'El que patea ya eligió 🤫') : aim.role === 'shooter' ? 'La máquina ya eligió dónde se tira 🤫' : `${CHARS[chars[1]].name} ya eligió dónde patea 🤫`) : '';
  return <div className="kp kf-shootout" ref={boxRef} style={{ ...fill, zIndex: 4 }} data-testid="kf-shootout">
    <canvas ref={bgRef} aria-hidden="true" style={fill} />
    <canvas ref={refereeRef} aria-hidden="true" style={{ ...fill, pointerEvents: 'none' }} /> {/* (el árbitro atrás, como en Kombat Penales: el ovni y los jugadores pasan por delante) */}
    <canvas ref={canvasRef} role="img" aria-label="Penales" style={{ ...fill, zIndex: 1 }}
      onPointerMove={e => { if (!aimRef.current) return; const z = zoneFromEvent(e); if (z !== null) zoneRef.current = z; }}
      onPointerDown={e => { if (!aimRef.current) return; const z = zoneFromEvent(e); if (z !== null) { zoneRef.current = z; choose(z); } }} />
    <div className="kp-board" aria-live="polite">
      <div className="kp-board-top">
        {side(0)}
        <div className="kp-board-score" data-testid="kf-pen-score">{scoreOf(hud.kicks)[0]} : {scoreOf(hud.kicks)[1]}</div>
        {side(1)}
      </div>
      <div className="kp-board-dots">
        <KickDots kicks={shownKicks(0)} total={REGULATION} testId="kf-pen-dots-0" />
        <span className={`kp-fx kp-fx--${fxOfTurn(hud.turn)}`}>{hud.sudden ? 'MUERTE SÚBITA · ' : 'PENALES · '}{BALL_FX_NAMES[fxOfTurn(hud.turn)]}</span>
        <KickDots kicks={shownKicks(1)} total={REGULATION} testId="kf-pen-dots-1" />
      </div>
    </div>
    {aim && <p className="sr-only" data-testid="kf-pen-aim">{aimTitle} · {aimSub}</p>}
    {rps && <RpsBox rps={rps} two={two} chars={chars} labels={labels} onHand={pickHand} onOrder={chooseOrder} />}
  </div>;
}
