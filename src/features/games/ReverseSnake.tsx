import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { level, newGame, score, step, takeEvents, type Dir, type Game } from './reverseSnake';

const RECORD_KEY = 'escritorio-personal-juegos:serpiente-record';
export const readSnakeRecord = () => { try { return Number(localStorage.getItem(RECORD_KEY)) || 0; } catch { return 0; } };
const saveRecord = (value: number) => { try { localStorage.setItem(RECORD_KEY, String(value)); } catch { /* sin almacenamiento */ } };
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

type Status = 'ready' | 'playing' | 'paused' | 'over';

// Tamaño del jardín según la pantalla: casilleros de unos 34px.
function gridFor(width: number, height: number) {
  const cell = width < 600 ? 26 : 34;
  return { cols: Math.max(12, Math.min(30, Math.floor(width / cell))), rows: Math.max(10, Math.min(20, Math.floor(height / cell))) };
}

// ---------- Dibujo ----------
function drawGarden(ctx: CanvasRenderingContext2D, g: Game, c: number) {
  for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
    ctx.fillStyle = (x + y) % 2 ? '#4ade80' : '#22c55e';
    ctx.fillRect(x * c, y * c, c, c);
  }
  // pastitos y florcitas siempre en el mismo lugar
  for (let i = 0; i < g.cols * g.rows / 6; i++) {
    const h = Math.sin(i * 91.7) * 43758.5453, r = h - Math.floor(h), r2 = (r * 7.3) % 1;
    const x = Math.floor(r * g.cols) * c + c * (0.2 + r2 * 0.6), y = Math.floor(r2 * g.rows) * c + c * (0.25 + r * 0.5);
    if (i % 7 === 0) { ctx.fillStyle = ['#fde047', '#f9a8d4', '#ffffff'][i % 3]; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x + Math.cos(k * 1.57) * c * 0.07, y + Math.sin(k * 1.57) * c * 0.07, c * 0.06, 0, Math.PI * 2); ctx.fill(); } ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(x, y, c * 0.04, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.strokeStyle = '#15803d'; ctx.lineWidth = Math.max(1, c * 0.04); ctx.beginPath(); ctx.moveTo(x, y + c * 0.08); ctx.lineTo(x - c * 0.04, y - c * 0.06); ctx.moveTo(x, y + c * 0.08); ctx.lineTo(x + c * 0.05, y - c * 0.05); ctx.stroke(); }
  }
}

function drawSeed(ctx: CanvasRenderingContext2D, x: number, y: number, c: number, t: number) {
  const cx = (x + 0.5) * c, cy = (y + 0.5) * c + Math.sin(t * 4 + x) * c * 0.04;
  ctx.fillStyle = '#00000022'; ctx.beginPath(); ctx.ellipse(cx, (y + 0.78) * c, c * 0.18, c * 0.06, 0, 0, Math.PI * 2); ctx.fill();
  const grad = ctx.createRadialGradient(cx - c * 0.06, cy - c * 0.08, c * 0.02, cx, cy, c * 0.22);
  grad.addColorStop(0, '#fff7c2'); grad.addColorStop(0.5, '#facc15'); grad.addColorStop(1, '#b45309');
  ctx.fillStyle = grad; ctx.beginPath(); ctx.ellipse(cx, cy, c * 0.15, c * 0.22, 0.3, 0, Math.PI * 2); ctx.fill();
}

function drawPower(ctx: CanvasRenderingContext2D, x: number, y: number, kind: 'scissors' | 'clock', c: number, t: number, life: number) {
  if (life < 2.5 && Math.floor(t * 8) % 2) return; // titila antes de desaparecer
  const cx = (x + 0.5) * c, cy = (y + 0.5) * c;
  ctx.fillStyle = '#ffffffcc'; ctx.beginPath(); ctx.arc(cx, cy, c * 0.42, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = kind === 'clock' ? '#0ea5e9' : '#e11d48'; ctx.lineWidth = Math.max(2, c * 0.07); ctx.stroke();
  ctx.font = `${Math.round(c * 0.5)}px system-ui, "Segoe UI Emoji"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(kind === 'clock' ? '⏱️' : '✂️', cx, cy + c * 0.03);
}

function drawSnake(ctx: CanvasRenderingContext2D, g: Game, c: number, t: number) {
  const { body, dir } = g.snake;
  const dizzy = g.snake.dizzy > 0, frozen = g.snake.freeze > 0;
  const base = frozen ? '#7dd3fc' : '#7c3aed', light = frozen ? '#e0f2fe' : '#a78bfa', belly = frozen ? '#bae6fd' : '#fde047';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const pts = body.map(b => [(b.x + 0.5) * c, (b.y + 0.5) * c] as const);
  // sombra, cuerpo, rayas y brillo
  for (const [color, w, dx] of [['#00000033', 0.78, 0.06], [base, 0.74, 0], [light, 0.3, 0]] as const) {
    ctx.strokeStyle = color; ctx.lineWidth = c * w;
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x + dx * c, y + dx * c) : ctx.moveTo(x + dx * c, y + dx * c)); ctx.stroke();
  }
  ctx.fillStyle = belly;
  for (let i = 1; i < pts.length; i += 2) { ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], c * 0.12, 0, Math.PI * 2); ctx.fill(); }
  // cabeza
  const [hx, hy] = pts[0], d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
  ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(hx, hy, c * 0.5, c * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  // lengua que sale y entra
  if (!dizzy && Math.sin(t * 9) > 0) {
    const tx = hx + d[0] * c * 0.5, ty = hy + d[1] * c * 0.5, len = c * 0.35;
    ctx.strokeStyle = '#e11d48'; ctx.lineWidth = Math.max(1.5, c * 0.06);
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + d[0] * len, ty + d[1] * len);
    ctx.lineTo(tx + d[0] * len * 1.3 - d[1] * len * 0.25, ty + d[1] * len * 1.3 + d[0] * len * 0.25);
    ctx.moveTo(tx + d[0] * len, ty + d[1] * len); ctx.lineTo(tx + d[0] * len * 1.3 + d[1] * len * 0.25, ty + d[1] * len * 1.3 - d[0] * len * 0.25); ctx.stroke();
  }
  // ojos que miran a la manzana (o espirales si está mareada)
  const ax = (g.apple.x + 0.5) * c - hx, ay = (g.apple.y + 0.5) * c - hy, al = Math.hypot(ax, ay) || 1;
  for (const side of [-1, 1]) {
    const ex = hx + d[0] * c * 0.12 + -d[1] * side * c * 0.22, ey = hy + d[1] * c * 0.12 + d[0] * side * c * 0.22;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, c * 0.15, 0, Math.PI * 2); ctx.fill();
    if (dizzy) {
      ctx.strokeStyle = '#111'; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let k = 0; k < 14; k++) { const a = k * 0.8 + t * 10, r = c * 0.012 * k * 0.9; const px = ex + Math.cos(a) * r, py = ey + Math.sin(a) * r; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.stroke();
    } else { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(ex + ax / al * c * 0.06, ey + ay / al * c * 0.06, c * 0.07, 0, Math.PI * 2); ctx.fill(); }
  }
  if (dizzy) { // estrellitas girando
    ctx.font = `${Math.round(c * 0.35)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let k = 0; k < 3; k++) { const a = t * 5 + k * 2.1; ctx.fillText('⭐', hx + Math.cos(a) * c * 0.6, hy - c * 0.55 + Math.sin(a) * c * 0.2); }
  }
}

// La manzana: roja y brillante, con hojita, cara (asustada si la serpiente está cerca) y patitas que saltan.
function drawApple(ctx: CanvasRenderingContext2D, g: Game, c: number, t: number) {
  const a = g.apple, head = g.snake.body[0];
  const near = Math.abs(head.x - a.x) + Math.abs(head.y - a.y) <= 3;
  const hop = Math.sin((a.hop / 0.12) * Math.PI) * c * 0.15;
  const cx = (a.x + 0.5) * c, cy = (a.y + 0.48) * c - hop, r = c * 0.36;
  ctx.fillStyle = '#00000033'; ctx.beginPath(); ctx.ellipse(cx, (a.y + 0.88) * c, r * 0.8, r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  // patitas
  ctx.strokeStyle = '#7c2d12'; ctx.lineWidth = Math.max(1.5, c * 0.06); ctx.lineCap = 'round';
  const step = a.hop > 0 ? Math.sin(t * 30) * c * 0.06 : 0;
  ctx.beginPath(); ctx.moveTo(cx - r * 0.35, cy + r * 0.8); ctx.lineTo(cx - r * 0.45 + step, cy + r * 1.15); ctx.moveTo(cx + r * 0.35, cy + r * 0.8); ctx.lineTo(cx + r * 0.45 - step, cy + r * 1.15); ctx.stroke();
  // cuerpo con dos lóbulos
  const grad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r * 1.2);
  grad.addColorStop(0, '#ff8a8a'); grad.addColorStop(0.45, '#ef4444'); grad.addColorStop(1, '#991b1b');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.ellipse(cx - r * 0.32, cy, r * 0.72, r * 0.9, 0, 0, Math.PI * 2); ctx.ellipse(cx + r * 0.32, cy, r * 0.72, r * 0.9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff99'; ctx.beginPath(); ctx.ellipse(cx - r * 0.5, cy - r * 0.4, r * 0.16, r * 0.26, -0.5, 0, Math.PI * 2); ctx.fill();
  // cabito y hoja
  ctx.strokeStyle = '#78350f'; ctx.lineWidth = Math.max(1.5, c * 0.06);
  ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.75); ctx.quadraticCurveTo(cx + r * 0.05, cy - r * 1.05, cx + r * 0.2, cy - r * 1.2); ctx.stroke();
  ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.ellipse(cx + a.facing * r * 0.45, cy - r * 1.05, r * 0.38, r * 0.17, a.facing * -0.5, 0, Math.PI * 2); ctx.fill();
  // cara mirando hacia donde camina
  const f = a.facing * r * 0.15;
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(cx + side * r * 0.3 + f, cy - r * 0.1, r * 0.17, r * (near ? 0.24 : 0.2), 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(cx + side * r * 0.3 + f * 1.5, cy - r * 0.08, r * (near ? 0.07 : 0.09), 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#450a0a'; ctx.lineWidth = Math.max(1.2, c * 0.04);
  ctx.beginPath();
  if (near) { ctx.ellipse(cx + f, cy + r * 0.38, r * 0.14, r * 0.12, 0, 0, Math.PI * 2); ctx.fillStyle = '#450a0a'; ctx.fill(); } // ¡ay!
  else { ctx.arc(cx + f, cy + r * 0.2, r * 0.22, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); } // sonrisa
  if (near) { // gotitas de susto
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath(); ctx.ellipse(cx - a.facing * r * 0.95, cy - r * 0.6 + Math.sin(t * 12) * 2, r * 0.1, r * 0.16, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function draw(ctx: CanvasRenderingContext2D, g: Game, c: number) {
  const t = g.time;
  drawGarden(ctx, g, c);
  for (const s of g.seeds) drawSeed(ctx, s.x, s.y, c, t);
  for (const p of g.powers) drawPower(ctx, p.x, p.y, p.kind, c, t, p.life);
  drawSnake(ctx, g, c, t);
  drawApple(ctx, g, c, t);
}

const KEYS: Record<string, Dir> = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };

export function ReverseSnake() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const held = useRef<Dir[]>([]); // direcciones apretadas (la última manda)
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const [status, setStatus] = useState<Status>('ready');
  const [hud, setHud] = useState({ points: 0, seconds: 0, length: 4, level: 1 });
  const [record, setRecord] = useState(readSnakeRecord);
  const [newRecord, setNewRecord] = useState(false);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(id);
  }, [toast]);

  const paint = useCallback(() => {
    const stage = stageRef.current, canvas = canvasRef.current, g = gameRef.current;
    if (!stage || !canvas || !g) return;
    const c = Math.floor(Math.min(stage.clientWidth / g.cols, stage.clientHeight / g.rows));
    const dpr = window.devicePixelRatio || 1, w = g.cols * c, h = g.rows * c;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, g, c);
  }, []);

  const start = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const { cols, rows } = gridFor(stage.clientWidth, stage.clientHeight);
    gameRef.current = newGame(cols, rows);
    held.current = [];
    setHud({ points: 0, seconds: 0, length: 4, level: 1 });
    setNewRecord(false);
    setToast(null);
    setStatus('playing');
    paint();
  }, [paint]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const { cols, rows } = gridFor(stage.clientWidth, stage.clientHeight);
    gameRef.current = newGame(cols, rows);
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [paint]);

  useEffect(() => {
    if (status !== 'playing') return;
    let frame = 0, last = performance.now();
    const tick = (now: number) => {
      const g = gameRef.current;
      if (!g) return;
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      step(g, { dir: held.current[held.current.length - 1] ?? null }, dt);
      for (const e of takeEvents(g)) {
        if (e.type === 'tangled') setToast({ text: '¡La serpiente se enredó! +300', id: now });
        if (e.type === 'power') setToast({ text: e.kind === 'scissors' ? '✂️ ¡Tijeretazo! Le cortaste la cola' : '⏱️ ¡Serpiente congelada!', id: now });
      }
      paint();
      const shown = { points: score(g), seconds: Math.floor(g.time), length: g.snake.body.length + g.snake.grow, level: level(g) };
      setHud(p => p.points === shown.points && p.length === shown.length && p.seconds === shown.seconds ? p : shown);
      if (g.over) {
        if (shown.points > readSnakeRecord()) { saveRecord(shown.points); setRecord(shown.points); setNewRecord(true); }
        setStatus('over');
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hide = () => { if (document.hidden) setStatus('paused'); };
    document.addEventListener('visibilitychange', hide);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', hide); };
  }, [status, paint]);

  const press = (dir: Dir) => { held.current = [...held.current.filter(d => d !== dir), dir]; };
  const release = (dir: Dir) => { held.current = held.current.filter(d => d !== dir); };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && (statusRef.current === 'playing' || statusRef.current === 'paused')) { setStatus(s => s === 'playing' ? 'paused' : 'playing'); return; }
      const dir = KEYS[e.key];
      if (!dir || statusRef.current !== 'playing') return;
      e.preventDefault();
      press(dir);
    };
    const up = (e: KeyboardEvent) => { const dir = KEYS[e.key]; if (dir) release(dir); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  // Deslizar el dedo sobre el jardín también mueve la manzana (mientras el dedo siga apoyado).
  const onPointerDown = (e: React.PointerEvent) => { swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = swipe.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.hypot(dx, dy) < 18) return;
    held.current = [Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')];
    swipe.current = { ...s, x: e.clientX, y: e.clientY };
  };
  const endSwipe = () => { swipe.current = null; held.current = []; };

  const hold = (dir: Dir) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); press(dir); },
    onPointerUp: () => release(dir), onPointerLeave: () => release(dir), onPointerCancel: () => release(dir),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return <section className="runner snk" aria-label="Serpiente al Revés">
    <div className="runner-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1>Serpiente al Revés</h1>
      <div className="runner-scores">
        <span>Tiempo <strong>{clock(hud.seconds)}</strong></span>
        <span>Largo <strong data-testid="snake-length">{hud.length}</strong></span>
        <span>Puntos <strong data-testid="snake-points">{hud.points}</strong></span>
        <span>Récord <strong>{record}</strong></span>
      </div>
      {(status === 'playing' || status === 'paused') && <button type="button" onClick={() => setStatus(s => s === 'playing' ? 'paused' : 'playing')}>{status === 'playing' ? 'Pausa' : 'Seguir'}</button>}
    </div>
    <div className="runner-stage" ref={stageRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endSwipe} onPointerCancel={endSwipe}>
      <canvas ref={canvasRef} role="img" aria-label="Jardín" />
      {status === 'playing' && toast && <div key={toast.id} className="snk-toast" role="status">{toast.text}</div>}
      {status !== 'playing' && <div className="runner-overlay" role="dialog" aria-labelledby="snk-message">
        <div>
          {status === 'ready' && <>
            <h2 id="snk-message">Serpiente al Revés 🍎</h2>
            <p>El viborita de siempre, pero esta vez sos la manzana. La serpiente te persigue y cada pocos segundos crece y va más rápido. Su cuerpo es una pared: si la hacés enredarse, se marea y ganás puntos. Juntá semillas doradas, usá la tijera para cortarle la cola y el reloj para congelarla.</p>
            <p className="runner-keys"><kbd>←</kbd> <kbd>↑</kbd> <kbd>↓</kbd> <kbd>→</kbd> moverse · <kbd>P</kbd> pausa</p>
            <button type="button" onClick={start} autoFocus>Jugar</button>
          </>}
          {status === 'paused' && <>
            <h2 id="snk-message">Pausa</h2>
            <button type="button" onClick={() => setStatus('playing')} autoFocus>Seguir</button>
          </>}
          {status === 'over' && <>
            <h2 id="snk-message">¡Te comieron! 🐍</h2>
            <p>Aguantaste <strong>{clock(hud.seconds)}</strong> e hiciste <strong>{hud.points}</strong> puntos. La serpiente llegó a medir {hud.length}.{newRecord && ' ¡Nuevo récord!'}</p>
            <button type="button" onClick={start} autoFocus>Jugar de nuevo</button>
          </>}
        </div>
      </div>}
    </div>
    <div className="runner-pad snk-pad" aria-label="Controles">
      <button type="button" aria-label="Izquierda" {...hold('left')}>◀</button>
      <button type="button" aria-label="Arriba" {...hold('up')}>▲</button>
      <button type="button" aria-label="Abajo" {...hold('down')}>▼</button>
      <button type="button" aria-label="Derecha" {...hold('right')}>▶</button>
    </div>
  </section>;
}
