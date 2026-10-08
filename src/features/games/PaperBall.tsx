import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  launch, newPaper, ORIGIN, preview, QUARTER, quarterLeft, spotOf, STEPS, step, stepValue, takeEvents, throwBall, TOP, W,
  type PaperGame,
} from './paperBall';
import {
  burst, drawBall, drawBackground, drawBinBack, drawBinFront, drawClock, drawDrops, drawEyes, drawFan, drawHeld, drawLoad, drawRobot, drawStains,
  drawVignette, drawWindow, loadOffice, stepDrops, VIEW_H, X, Y, type Drop, type Stain, type View,
} from './paperArt';

const RECORD_KEY = 'escritorio-personal-juegos:cesto-t800-record';
export const readPaperRecord = () => { try { return Number(localStorage.getItem(RECORD_KEY)) || 0; } catch { return 0; } };
const saveRecord = (value: number) => { try { localStorage.setItem(RECORD_KEY, String(value)); } catch { /* sin almacenamiento */ } };

type Status = 'ready' | 'playing' | 'paused' | 'over';
interface Aim { sx: number; sy: number; x: number; y: number }
interface Pop { text: string; x: number; y: number; at: number; color: string }
interface Gore { drops: Drop[]; stains: Stain[]; shake: number }
const clock = (sec: number) => { const n = Math.ceil(sec); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
const DISTANCE = ['cerca', 'media distancia', 'lejos'];
const THROW_POSE = 0.4; // lo que dura la pose de tiro

// La puntería: los puntitos de por dónde va a ir (sin contar el ventilador) y la fuerza, en un arco alrededor
// de la mano.
function drawAim(ctx: CanvasRenderingContext2D, v: View, aim: Aim) {
  const { vx, vy, power } = launch(aim.sx, aim.sy, aim.x, aim.y), s = v.s;
  ctx.fillStyle = 'rgba(255,80,80,0.95)'; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1;
  preview(vx, vy, 14).forEach(([x, y], i) => { ctx.globalAlpha = 1 - i / 15; ctx.beginPath(); ctx.arc(X(v, x), Y(v, y), s * 0.06, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(X(v, aim.sx), Y(v, aim.sy)); ctx.lineTo(X(v, aim.x), Y(v, aim.y)); ctx.stroke(); ctx.setLineDash([]);
  const cx = X(v, ORIGIN.x), cy = Y(v, ORIGIN.y), r = s * 0.6;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = s * 0.12; ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
  ctx.strokeStyle = `hsl(${120 - power * 120},90%,52%)`; ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * power)); ctx.stroke();
}

// La mira del T-800 sobre el tacho: dice cuánto vale el tiro.
function drawTarget(ctx: CanvasRenderingContext2D, v: View, g: PaperGame) {
  const b = g.bin, s = v.s, x = X(v, b.x), y = Y(v, b.y + b.h + 0.75 + Math.sin(g.time * 4) * 0.05);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,40,40,0.85)'; ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.beginPath(); ctx.moveTo(x, y + s * 0.22); ctx.lineTo(x, Y(v, b.y + b.h + 0.18)); ctx.stroke();
  ctx.font = `800 ${Math.round(s * 0.24)}px "Courier New", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const text = `TIRO ${g.step + 1}/${STEPS} · ${stepValue(g.step)} PTS`, w = ctx.measureText(text).width + s * 0.3;
  ctx.fillStyle = 'rgba(10,0,0,0.75)'; ctx.fillRect(x - w / 2, y - s * 0.2, w, s * 0.4);
  ctx.strokeRect(x - w / 2, y - s * 0.2, w, s * 0.4);
  ctx.fillStyle = '#ff4d4d'; ctx.fillText(text, x, y + 1);
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, g: PaperGame, v: View, aim: Aim | null, pops: Pop[], gore: Gore) {
  ctx.save();
  if (gore.shake > 0) ctx.translate((Math.random() - 0.5) * gore.shake * v.s * 0.2, (Math.random() - 0.5) * gore.shake * v.s * 0.2);
  drawBackground(ctx, v);
  drawWindow(ctx, v);
  drawClock(ctx, v, new Date());
  drawStains(ctx, v, gore.stains, g.time);
  drawFan(ctx, v, g.fan);
  drawBinBack(ctx, v, g.bin);
  drawLoad(ctx, v, g.bin);
  for (const k of g.balls) if (k.state === 'in') drawBall(ctx, v, k, g.time);
  drawBinFront(ctx, v, g.bin);
  for (const k of g.balls) if (k.state === 'out' && k.done) drawBall(ctx, v, k, g.time);
  const throwing = g.time - g.thrown < THROW_POSE;
  if (!throwing && !g.over) drawHeld(ctx, v, g.nextId, g.time); // atrás del puño, así queda agarrado
  drawRobot(ctx, v, throwing);
  drawEyes(ctx, v, throwing, (Math.sin(g.time * 3) + 1) / 2);
  for (const k of g.balls) if (k.state === 'fly' || (k.state === 'out' && !k.done)) drawBall(ctx, v, k, g.time);
  drawDrops(ctx, v, gore.drops);
  drawVignette(ctx, v);
  if (g.pause <= 0 && !g.over) drawTarget(ctx, v, g);
  if (aim) drawAim(ctx, v, aim);
  // Los cartelitos de puntos que suben.
  for (const p of pops) {
    const a = g.time - p.at;
    if (a > 1.6) continue;
    ctx.globalAlpha = Math.min(1, 2 * (1 - a / 1.6)); ctx.fillStyle = p.color; ctx.font = `900 ${Math.round(v.s * 0.45)}px Nunito, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 4; const px = X(v, Math.max(1.4, Math.min(W - 1.4, p.x)));
    ctx.strokeText(p.text, px, Y(v, p.y + a * 0.8)); ctx.fillText(p.text, px, Y(v, p.y + a * 0.8));
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export function PaperBall() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<PaperGame>(newPaper());
  const aimRef = useRef<Aim | null>(null);
  const popsRef = useRef<Pop[]>([]);
  const goreRef = useRef<Gore>({ drops: [], stains: [], shake: 0 });
  const [status, setStatus] = useState<Status>('ready');
  const [hud, setHud] = useState({ left: QUARTER, quarter: 0, pause: false, score: 0, step: 0, round: 0, dir: 0 });
  const [record, setRecord] = useState(readPaperRecord);
  const [result, setResult] = useState({ score: 0, made: 0, shots: 0, rounds: 0, bonus: 0, newRecord: false });
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 2200); return () => clearTimeout(timer); }, [toast]);

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
    draw(ctx, gameRef.current, v, aimRef.current, popsRef.current, goreRef.current);
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
    gameRef.current = newPaper(); aimRef.current = null; popsRef.current = []; goreRef.current = { drops: [], stains: [], shake: 0 };
    setHud({ left: QUARTER, quarter: 0, pause: false, score: 0, step: 0, round: 0, dir: 0 });
    setToast({ text: 'Hacé clic, tirá para atrás y soltá 🗑️', id: Date.now() });
    setStatus('playing');
  }, []);

  useEffect(() => {
    if (status !== 'playing') return;
    let frame = 0, last = performance.now();
    const tick = (now: number) => {
      const g = gameRef.current, gore = goreRef.current, dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      step(g, dt);
      for (const e of takeEvents(g)) {
        if (e.type === 'score') popsRef.current.push({ text: `+${e.points}`, x: e.x, y: e.y + 0.5, at: g.time, color: '#4ade80' });
        if (e.type === 'splat') {
          burst(gore.drops, e.x, e.y, e.vx, e.vy, e.surface, e.hard, Math.random);
          const r = 0.35 + e.hard * 0.45;
          gore.stains.push({ x: e.x, y: e.surface === 'floor' ? 0.02 : e.y, r: e.surface === 'floor' ? r : r * 0.9, at: g.time, kind: e.surface === 'floor' ? 'pool' : 'wall', seed: Math.random() });
          gore.shake = Math.max(gore.shake, 0.4 + e.hard * 0.6);
          popsRef.current.push({ text: '¡Splat!', x: e.x, y: Math.max(0.6, e.y) + 0.4, at: g.time, color: '#ef4444' });
        }
        if (e.type === 'round') {
          popsRef.current.push({ text: `¡Ronda! +${e.bonus} por velocidad`, x: g.bin.x, y: 3.2, at: g.time, color: '#fde047' });
          setToast({ text: `¡Ronda ${e.round} completa en ${Math.round(e.seconds)} s! +${e.bonus} puntos por velocidad ⚡`, id: now });
        }
        if (e.type === 'fan') setToast({ text: e.dir > 0 ? 'Se prende el ventilador: sopla para la derecha →' : 'El ventilador se pasa a la derecha: sopla para la izquierda ←', id: now });
        if (e.type === 'quarter') setToast({ text: `¡Fin del ${e.quarter}° cuarto! Arranca el ${e.quarter + 1}°: el ventilador sopla más fuerte 💨`, id: now });
      }
      gore.drops = stepDrops(gore.drops, gore.stains, dt, g.time);
      gore.stains = gore.stains.filter(st => g.time - st.at < 25).slice(-400);
      gore.shake = Math.max(0, gore.shake - dt * 3);
      popsRef.current = popsRef.current.filter(p => g.time - p.at < 1.7);
      paint();
      setHud(p => {
        const n = { left: Math.ceil(quarterLeft(g)), quarter: g.quarter, pause: g.pause > 0, score: g.score, step: g.step, round: g.round, dir: g.fan.dir };
        return p.left === n.left && p.quarter === n.quarter && p.pause === n.pause && p.score === n.score && p.step === n.step && p.round === n.round && p.dir === n.dir ? p : n;
      });
      if (g.over) {
        const prev = readPaperRecord(), isNew = g.score > prev;
        if (isNew) { saveRecord(g.score); setRecord(g.score); }
        setResult({ score: g.score, made: g.made, shots: g.shots, rounds: g.round, bonus: g.speedBonus, newRecord: isNew && prev > 0 });
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

  const fanText = hud.dir > 0 ? '→ Sopla' : hud.dir < 0 ? '← Sopla' : 'Apagado';
  return <section className="runner bol" aria-label="¡Al cesto!">
    <div className="runner-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1>¡Al cesto!</h1>
      {(status === 'playing' || status === 'paused') && <button type="button" onClick={() => setStatus(s => s === 'playing' ? 'paused' : 'playing')}>{status === 'playing' ? 'Pausa' : 'Seguir'}</button>}
    </div>
    <div className="bol-main">
      <div className="runner-stage" ref={stageRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { aimRef.current = null; }}>
        <canvas ref={canvasRef} role="img" aria-label="Oficina de Skynet: un T-800 tira humanos en miniatura a un tacho de basura" />
        {status === 'playing' && toast && <div key={toast.id} className="bol-toast" role="status">{toast.text}</div>}
        {status !== 'playing' && <div className="runner-overlay" role="dialog" aria-labelledby="bol-message">
          <div>
            {status === 'ready' && <>
              <h2 id="bol-message">¡Al cesto! 🤖</h2>
              <p>Sos el <strong>T-800</strong> en la oficina de Skynet y los humanos en miniatura van al tacho. Hacé <strong>clic</strong>, tirá para atrás como una gomera y <strong>soltá</strong>.</p>
              <p>Cada ronda son <strong>9 tiros</strong>: el tacho aparece cerca, a media distancia y lejos; después lo mismo con el <strong>ventilador</strong> soplando para la derecha, y después soplando para la izquierda. Hay que embocar para pasar al siguiente: el 1° vale <strong>1 punto</strong>, el 2° <strong>2</strong>… y el 9° <strong>9</strong>. Si terminás la ronda rápido, sumás <strong>puntos por velocidad</strong>.</p>
              <p>Son <strong>4 cuartos de 2 minutos</strong>, como en el básquet.</p>
              <p className="runner-keys">Solo con el mouse · <kbd>P</kbd> pausa</p>
              <button type="button" onClick={start} autoFocus>Jugar</button>
            </>}
            {status === 'paused' && <>
              <h2 id="bol-message">Pausa</h2>
              <button type="button" onClick={() => setStatus('playing')} autoFocus>Seguir</button>
            </>}
            {status === 'over' && <>
              <h2 id="bol-message">¡Final del partido! ⏰</h2>
              <p>Hiciste <strong>{result.score}</strong> puntos: embocaste {result.made} de {result.shots} humanos, completaste {result.rounds} {result.rounds === 1 ? 'ronda' : 'rondas'} y sumaste {result.bonus} por velocidad.{result.newRecord && ' ¡Nuevo récord!'}</p>
              <button type="button" onClick={start} autoFocus>Jugar de nuevo</button>
            </>}
          </div>
        </div>}
      </div>
      <aside className="bol-side" aria-label="Cuarto, tiempo, puntos, tiro, ventilador y récord">
        <div className="bol-stat"><span>Cuarto</span><strong data-testid="bol-quarter">{hud.quarter + 1}° de 4</strong></div>
        <div className={`bol-stat${hud.left <= 10 && !hud.pause ? ' bol-hurry' : ''}`}><span>{hud.pause ? 'Descanso' : 'Tiempo'}</span><strong data-testid="bol-time">{clock(hud.left)}</strong></div>
        <div className="bol-stat bol-stat--points"><span>Puntos</span><strong data-testid="bol-points">{hud.score}</strong></div>
        <div className="bol-stat bol-stat--small"><span>Tiro {hud.step + 1} de {STEPS}</span><strong data-testid="bol-step">Vale {stepValue(hud.step)} · {DISTANCE[spotOf(hud.step)]}</strong></div>
        <div className="bol-stat bol-stat--small"><span>Ventilador</span><strong data-testid="bol-fan">{fanText}</strong></div>
        <div className="bol-stat bol-stat--small"><span>Rondas · Récord</span><strong>{hud.round} · {record}</strong></div>
      </aside>
    </div>
  </section>;
}
