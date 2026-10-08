import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BOSS_H, canThrow, launch, newPaper, ORIGIN, preview, QUARTER, quarterLeft, step, takeEvents, throwBall, TOP, W,
  type Ball, type PaperGame,
} from './paperBall';
import {
  drawArms, drawBackground, drawBin, drawBoss, drawClock, drawDeskExtras, drawFan, drawFingers, drawLegs, drawPaper, drawVignette,
  drawWindow, drawWorker, loadOffice, VIEW_H, WORKER_X, X, Y, type Mood, type View,
} from './paperArt';

const RECORD_KEY = 'escritorio-personal-juegos:cesto-record';
export const readPaperRecord = () => { try { return Number(localStorage.getItem(RECORD_KEY)) || 0; } catch { return 0; } };
const saveRecord = (value: number) => { try { localStorage.setItem(RECORD_KEY, String(value)); } catch { /* sin almacenamiento */ } };

type Status = 'ready' | 'playing' | 'paused' | 'over';
interface Aim { sx: number; sy: number; x: number; y: number }
interface Pop { text: string; x: number; y: number; at: number; color: string }
interface Face { mood: Mood; at: number }
const clock = (sec: number) => { const n = Math.ceil(sec); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };

function drawBalls(ctx: CanvasRenderingContext2D, v: View, balls: Ball[]) {
  for (const k of balls) drawPaper(ctx, v, k.x, k.y, k.t * (6 + Math.hypot(k.vx, k.vy) * 0.3), k.id);
}

// Dónde está la mano que tira: levantada con el bollo, para atrás mientras apuntás y estirada después de tirar.
function handOf(g: PaperGame, aim: Aim | null) {
  if (aim) {
    let dx = (aim.x - aim.sx) * 0.25, dy = (aim.y - aim.sy) * 0.25;
    const d = Math.hypot(dx, dy);
    if (d > 0.45) { dx *= 0.45 / d; dy *= 0.45 / d; }
    return { x: ORIGIN.x + dx, y: ORIGIN.y + dy };
  }
  const k = g.time - g.thrown;
  if (k < 0.3) { const e = Math.sin((k / 0.3) * Math.PI); return { x: ORIGIN.x + 0.4 * e, y: ORIGIN.y - 0.12 * e }; }
  return ORIGIN;
}

// La puntería: los puntitos de por dónde va a ir (sin contar el ventilador) y la fuerza, en un arco alrededor
// de la mano.
function drawAim(ctx: CanvasRenderingContext2D, v: View, aim: Aim) {
  const { vx, vy, power } = launch(aim.sx, aim.sy, aim.x, aim.y), s = v.s;
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.strokeStyle = 'rgba(15,23,42,0.6)'; ctx.lineWidth = 1;
  preview(vx, vy, 14).forEach(([x, y], i) => { ctx.globalAlpha = 1 - i / 15; ctx.beginPath(); ctx.arc(X(v, x), Y(v, y), s * 0.06, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(X(v, aim.sx), Y(v, aim.sy)); ctx.lineTo(X(v, aim.x), Y(v, aim.y)); ctx.stroke(); ctx.setLineDash([]);
  const cx = X(v, ORIGIN.x), cy = Y(v, ORIGIN.y), r = s * 0.55;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(15,23,42,0.55)'; ctx.lineWidth = s * 0.12; ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
  ctx.strokeStyle = `hsl(${120 - power * 120},85%,52%)`; ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * power)); ctx.stroke();
}

function draw(ctx: CanvasRenderingContext2D, g: PaperGame, v: View, aim: Aim | null, pops: Pop[], face: Face) {
  drawBackground(ctx, v);
  drawWindow(ctx, v);
  drawClock(ctx, v, new Date());
  drawFan(ctx, v, g.fan);
  drawLegs(ctx, v);
  const mood = face.at > g.time - 1.2 ? face.mood : 'normal';
  const lookX = aim ? 1 : Math.max(-1, Math.min(1, (g.bin.x - WORKER_X) / 6)), lookY = aim ? 0.6 : -0.4;
  drawWorker(ctx, v, mood, { x: lookX, y: lookY });
  drawDeskExtras(ctx, v);
  drawBalls(ctx, v, g.balls.filter(k => k.state === 'in'));
  drawBin(ctx, v, g.bin);
  if (g.boss) drawBoss(ctx, v, g.boss, g.time);
  const hand = drawArms(ctx, v, handOf(g, aim));
  if (canThrow(g)) { drawPaper(ctx, v, hand.x, hand.y + 0.1, 0.3, 0); drawFingers(ctx, v, hand); }
  drawBalls(ctx, v, g.balls.filter(k => k.state !== 'in'));
  drawVignette(ctx, v);
  if (aim) drawAim(ctx, v, aim);
  // Los cartelitos de puntos que suben.
  for (const p of pops) {
    const a = g.time - p.at;
    if (a > 1.3) continue;
    ctx.globalAlpha = 1 - a / 1.3; ctx.fillStyle = p.color; ctx.font = `900 ${Math.round(v.s * 0.5)}px Nunito, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 4; ctx.strokeText(p.text, X(v, p.x), Y(v, p.y + a * 0.8)); ctx.fillText(p.text, X(v, p.x), Y(v, p.y + a * 0.8));
    ctx.globalAlpha = 1;
  }
}

export function PaperBall() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<PaperGame>(newPaper());
  const aimRef = useRef<Aim | null>(null);
  const popsRef = useRef<Pop[]>([]);
  const faceRef = useRef<Face>({ mood: 'normal', at: -9 });
  const [status, setStatus] = useState<Status>('ready');
  const [hud, setHud] = useState({ left: QUARTER, quarter: 0, pause: false, score: 0, streak: 0, fan: 0, dir: 1 });
  const [record, setRecord] = useState(readPaperRecord);
  const [result, setResult] = useState({ score: 0, made: 0, shots: 0, best: 0, newRecord: false });
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 1800); return () => clearTimeout(timer); }, [toast]);

  const view = useCallback((): View | null => {
    const stage = stageRef.current;
    if (!stage || !stage.clientWidth || !stage.clientHeight) return null;
    // El lienzo mide justo lo que la oficina (sin franjas), centrado en el escenario.
    const s = Math.min(stage.clientWidth / W, stage.clientHeight / VIEW_H);
    return { w: Math.floor(W * s), h: Math.floor(VIEW_H * s), s, ox: 0, oy: 0, t: gameRef.current.time };
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current, v = view();
    if (!canvas || !v) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(v.w * dpr) || canvas.height !== Math.round(v.h * dpr)) {
      canvas.width = Math.round(v.w * dpr); canvas.height = Math.round(v.h * dpr);
      canvas.style.width = `${v.w}px`; canvas.style.height = `${v.h}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, gameRef.current, v, aimRef.current, popsRef.current, faceRef.current);
  }, [view]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(stage);
    loadOffice(paint);
    return () => observer.disconnect();
  }, [paint]);

  // Fuera del partido, el reloj de la pared sigue andando.
  useEffect(() => {
    if (status === 'playing') return;
    const timer = setInterval(paint, 1000);
    return () => clearInterval(timer);
  }, [status, paint]);

  const start = useCallback(() => {
    gameRef.current = newPaper(); aimRef.current = null; popsRef.current = []; faceRef.current = { mood: 'normal', at: -9 };
    setHud({ left: QUARTER, quarter: 0, pause: false, score: 0, streak: 0, fan: 0, dir: 1 });
    setToast({ text: 'Hacé clic, tirá para atrás y soltá 🗑️', id: Date.now() });
    setStatus('playing');
  }, []);

  useEffect(() => {
    if (status !== 'playing') return;
    let frame = 0, last = performance.now();
    const tick = (now: number) => {
      const g = gameRef.current, dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      step(g, dt);
      for (const e of takeEvents(g)) {
        if (e.type === 'score') {
          const extra = [e.swish && '¡Limpia!', e.far && '¡De lejos!', e.streak >= 3 && `¡Racha x${e.streak}!`].filter(Boolean).join(' ');
          popsRef.current.push({ text: `+${e.points} ${extra}`.trim(), x: e.x, y: e.y + 0.5, at: g.time, color: '#4ade80' });
          faceRef.current = { mood: 'happy', at: g.time };
        }
        if (e.type === 'miss') faceRef.current = { mood: 'sad', at: g.time };
        if (e.type === 'boss') { popsRef.current.push({ text: e.points ? `-${e.points} ¡Al jefe no!` : '¡Al jefe no!', x: g.boss?.x ?? 8, y: BOSS_H + 0.6, at: g.time, color: '#f87171' }); faceRef.current = { mood: 'sad', at: g.time }; setToast({ text: '¡Le pegaste al jefe! 😠', id: now }); }
        if (e.type === 'bossIn') setToast({ text: '¡Cuidado, viene el jefe! 👔', id: now });
        if (e.type === 'quarter') setToast({ text: e.quarter === 3 ? '¡Último cuarto! El cesto se aleja… y tiene rueditas 🛞' : `¡Fin del ${e.quarter}° cuarto! El cesto se aleja 🏀`, id: now });
      }
      popsRef.current = popsRef.current.filter(p => g.time - p.at < 1.4);
      paint();
      setHud(p => {
        const n = { left: Math.ceil(quarterLeft(g)), quarter: g.quarter, pause: g.pause > 0, score: g.score, streak: g.streak, fan: g.fan.power, dir: g.fan.dir };
        return p.left === n.left && p.quarter === n.quarter && p.pause === n.pause && p.score === n.score && p.streak === n.streak && p.fan === n.fan && p.dir === n.dir ? p : n;
      });
      if (g.over) {
        const prev = readPaperRecord(), isNew = g.score > prev;
        if (isNew) { saveRecord(g.score); setRecord(g.score); }
        setResult({ score: g.score, made: g.made, shots: g.shots, best: g.bestStreak, newRecord: isNew && prev > 0 });
        aimRef.current = null; setToast(null); setStatus('over');
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hide = () => { if (document.hidden) setStatus('paused'); };
    document.addEventListener('visibilitychange', hide);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', hide); };
  }, [status, paint]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.key === 'p' || event.key === 'P' || event.key === 'Escape') && (statusRef.current === 'playing' || statusRef.current === 'paused')) setStatus(s => s === 'playing' ? 'paused' : 'playing');
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  // El mouse (o el dedo) en coordenadas de la oficina.
  const toWorld = (event: React.PointerEvent) => {
    const v = view(), r = canvasRef.current?.getBoundingClientRect();
    if (!v || !r) return null;
    return { x: (event.clientX - r.left - v.ox) / v.s, y: TOP - (event.clientY - r.top - v.oy) / v.s };
  };
  const onDown = (event: React.PointerEvent) => {
    if (statusRef.current !== 'playing') return;
    const p = toWorld(event);
    if (!p) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    aimRef.current = { sx: p.x, sy: p.y, x: p.x, y: p.y };
  };
  const onMove = (event: React.PointerEvent) => {
    const a = aimRef.current, p = a && toWorld(event);
    if (a && p) { a.x = p.x; a.y = p.y; }
  };
  const onUp = () => {
    const a = aimRef.current;
    aimRef.current = null;
    if (!a || statusRef.current !== 'playing') return;
    const { vx, vy } = launch(a.sx, a.sy, a.x, a.y);
    throwBall(gameRef.current, vx, vy);
  };

  const fanText = hud.fan ? `${hud.dir > 0 ? '→' : '←'} ${'💨'.repeat(hud.fan)}` : 'Apagado';
  return <section className="runner bol" aria-label="¡Al cesto!">
    <div className="runner-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1>¡Al cesto!</h1>
      {(status === 'playing' || status === 'paused') && <button type="button" onClick={() => setStatus(s => s === 'playing' ? 'paused' : 'playing')}>{status === 'playing' ? 'Pausa' : 'Seguir'}</button>}
    </div>
    <div className="bol-main">
      <div className="runner-stage" ref={stageRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { aimRef.current = null; }}>
        <canvas ref={canvasRef} role="img" aria-label="Oficina con un cesto de papeles" />
        {status === 'playing' && toast && <div key={toast.id} className="bol-toast" role="status">{toast.text}</div>}
        {status !== 'playing' && <div className="runner-overlay" role="dialog" aria-labelledby="bol-message">
          <div>
            {status === 'ready' && <>
              <h2 id="bol-message">¡Al cesto! 🗑️</h2>
              <p>Es viernes a la tarde y en la oficina no hay nada que hacer: embocá bollos de papel en el cesto. Hacé <strong>clic</strong>, tirá para atrás como una gomera y <strong>soltá</strong>. Ojo con el <strong>ventilador</strong>, que desvía los bollos. El partido dura <strong>3 minutos</strong> en <strong>4 cuartos</strong>, como en el básquet, y en cada cuarto el cesto se va más lejos. Suman más los tiros de lejos, los limpios y las rachas. Y cuidado con el jefe…</p>
              <p className="runner-keys">Solo con el mouse · <kbd>P</kbd> pausa</p>
              <button type="button" onClick={start} autoFocus>Jugar</button>
            </>}
            {status === 'paused' && <>
              <h2 id="bol-message">Pausa</h2>
              <button type="button" onClick={() => setStatus('playing')} autoFocus>Seguir</button>
            </>}
            {status === 'over' && <>
              <h2 id="bol-message">¡Final del partido! ⏰</h2>
              <p>Hiciste <strong>{result.score}</strong> puntos: embocaste {result.made} de {result.shots} bollos y tu mejor racha fue de {result.best}.{result.newRecord && ' ¡Nuevo récord!'}</p>
              <button type="button" onClick={start} autoFocus>Jugar de nuevo</button>
            </>}
          </div>
        </div>}
      </div>
      <aside className="bol-side" aria-label="Cuarto, tiempo, puntos, racha, viento y récord">
        <div className="bol-stat"><span>Cuarto</span><strong data-testid="bol-quarter">{hud.quarter + 1}° de 4</strong></div>
        <div className={`bol-stat${hud.left <= 10 && !hud.pause ? ' bol-hurry' : ''}`}><span>{hud.pause ? 'Descanso' : 'Tiempo'}</span><strong data-testid="bol-time">{clock(hud.left)}</strong></div>
        <div className="bol-stat bol-stat--points"><span>Puntos</span><strong data-testid="bol-points">{hud.score}</strong></div>
        <div className="bol-stat"><span>Racha</span><strong>{hud.streak}</strong></div>
        <div className="bol-stat bol-stat--fan"><span>Ventilador</span><strong data-testid="bol-fan">{fanText}</strong></div>
        <div className="bol-stat"><span>Récord</span><strong>{record}</strong></div>
      </aside>
    </div>
  </section>;
}
