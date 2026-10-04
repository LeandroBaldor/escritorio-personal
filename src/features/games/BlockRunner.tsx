import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { newGame, PLAYER_H, PLAYER_W, score, step, type Game, type GameOver, type Input } from './blockRunner';

const RECORD_KEY = 'escritorio-personal-juegos:bloques-record';
export const readRecord = () => { try { return Number(localStorage.getItem(RECORD_KEY)) || 0; } catch { return 0; } };
const saveRecord = (value: number) => { try { localStorage.setItem(RECORD_KEY, String(value)); } catch { /* sin almacenamiento: el récord dura esta partida */ } };

type Status = 'ready' | 'playing' | 'paused' | 'over';

// Tamaño de la grilla según la pantalla: celdas de unos 38px, entre 10 y 26 columnas.
function gridFor(width: number, height: number) {
  const cols = Math.max(10, Math.min(26, Math.round(width / 38)));
  const rows = Math.max(10, Math.min(30, Math.floor(height / (width / cols))));
  return { cols, rows };
}

function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#ffffff55';
  ctx.fillRect(x, y, size, size * 0.16);
  ctx.fillRect(x, y, size * 0.16, size);
  ctx.fillStyle = '#00000040';
  ctx.fillRect(x, y + size * 0.84, size, size * 0.16);
  ctx.fillRect(x + size * 0.84, y, size * 0.16, size);
}

function draw(ctx: CanvasRenderingContext2D, game: Game, cell: number) {
  const w = game.cols * cell, h = game.rows * cell;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#16163a');
  bg.addColorStop(1, '#2b1d4d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#ffffff0d';
  ctx.lineWidth = 1;
  for (let c = 1; c < game.cols; c++) { ctx.beginPath(); ctx.moveTo(c * cell + 0.5, 0); ctx.lineTo(c * cell + 0.5, h); ctx.stroke(); }

  // Sombra de cada pieza que cae, para ver dónde va a caer.
  for (const piece of game.pieces) {
    ctx.fillStyle = `${piece.color}1f`;
    const cols = new Set(piece.cells.map(([cx]) => piece.x + cx));
    for (const c of cols) ctx.fillRect(c * cell, Math.max(0, piece.y * cell), cell, h);
    if (piece.y < 0) {
      ctx.fillStyle = piece.color;
      const mid = (piece.x + piece.width / 2) * cell;
      ctx.beginPath(); ctx.moveTo(mid - cell * 0.35, 2); ctx.lineTo(mid + cell * 0.35, 2); ctx.lineTo(mid, cell * 0.45); ctx.closePath(); ctx.fill();
    }
  }
  game.grid.forEach((row, r) => row.forEach((color, c) => { if (color) drawBlock(ctx, c * cell, r * cell, cell, color); }));
  for (const piece of game.pieces) for (const [cx, cy] of piece.cells) drawBlock(ctx, (piece.x + cx) * cell, (piece.y + cy) * cell, cell, piece.color);

  // Personaje: cabeza, cuerpo con remera roja y piernas que se mueven al correr.
  const p = game.player;
  const px = p.x * cell, py = p.y * cell, pw = PLAYER_W * cell, ph = PLAYER_H * cell;
  const legSwing = p.vx && p.onGround ? Math.sin(game.time * 22) * pw * 0.22 : 0;
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = Math.max(2, pw * 0.16);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(px + pw * 0.38, py + ph * 0.72); ctx.lineTo(px + pw * 0.38 + legSwing, py + ph);
  ctx.moveTo(px + pw * 0.62, py + ph * 0.72); ctx.lineTo(px + pw * 0.62 - legSwing, py + ph);
  ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath(); ctx.roundRect(px + pw * 0.18, py + ph * 0.38, pw * 0.64, ph * 0.38, pw * 0.12); ctx.fill();
  ctx.fillStyle = '#fcd9b6';
  ctx.beginPath(); ctx.arc(px + pw / 2, py + ph * 0.22, pw * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3b2412';
  ctx.beginPath(); ctx.arc(px + pw / 2, py + ph * 0.17, pw * 0.3, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(px + pw / 2 + p.facing * pw * 0.13, py + ph * 0.24, Math.max(1.2, pw * 0.05), 0, Math.PI * 2); ctx.fill();
}

const OVER_TEXT: Record<GameOver, string> = { crushed: '¡Te aplastaron!', full: '¡Se llenó la pantalla!' };

export function BlockRunner() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const input = useRef<Input>({ left: false, right: false, jump: false });
  const [status, setStatus] = useState<Status>('ready');
  const [points, setPoints] = useState(0);
  const [record, setRecord] = useState(readRecord);
  const [overReason, setOverReason] = useState<GameOver>('crushed');
  const [newRecord, setNewRecord] = useState(false);
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  const paint = useCallback(() => {
    const stage = stageRef.current, canvas = canvasRef.current, game = gameRef.current;
    if (!stage || !canvas || !game) return;
    const cell = Math.min(stage.clientWidth / game.cols, stage.clientHeight / game.rows);
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.floor(game.cols * cell), cssH = Math.floor(game.rows * cell);
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`; canvas.style.height = `${cssH}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, game, cell);
  }, []);

  const start = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const { cols, rows } = gridFor(stage.clientWidth, stage.clientHeight);
    gameRef.current = newGame(cols, rows);
    input.current = { left: false, right: false, jump: false };
    setPoints(0);
    setNewRecord(false);
    setStatus('playing');
    paint();
  }, [paint]);

  // Primera pantalla: una grilla vacía de fondo con el personaje esperando.
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
      const game = gameRef.current;
      if (!game) return;
      step(game, input.current, Math.min(0.05, (now - last) / 1000));
      last = now;
      paint();
      const current = score(game);
      setPoints(prev => prev === current ? prev : current);
      if (game.over) {
        setOverReason(game.over);
        if (current > readRecord()) { saveRecord(current); setRecord(current); setNewRecord(true); }
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

  useEffect(() => {
    const keys: Record<string, keyof Input> = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'jump', w: 'jump', W: 'jump', ' ': 'jump' };
    const down = (event: KeyboardEvent) => {
      if ((event.key === 'p' || event.key === 'P' || event.key === 'Escape') && (statusRef.current === 'playing' || statusRef.current === 'paused')) {
        setStatus(s => s === 'playing' ? 'paused' : 'playing');
        return;
      }
      const key = keys[event.key];
      if (!key || statusRef.current !== 'playing') return;
      event.preventDefault();
      input.current[key] = true;
    };
    const up = (event: KeyboardEvent) => { const key = keys[event.key]; if (key) input.current[key] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // Mientras se juega, la página de atrás no se mueve.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const hold = (key: keyof Input) => ({
    onPointerDown: (event: React.PointerEvent) => { event.preventDefault(); input.current[key] = true; },
    onPointerUp: () => { input.current[key] = false; },
    onPointerLeave: () => { input.current[key] = false; },
    onPointerCancel: () => { input.current[key] = false; },
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
  });

  return <section className="runner" aria-label="¡Cuidado, bloques!">
    <div className="runner-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1>¡Cuidado, bloques!</h1>
      <div className="runner-scores">
        <span>Puntos <strong data-testid="runner-points">{points}</strong></span>
        <span>Récord <strong>{record}</strong></span>
      </div>
      {(status === 'playing' || status === 'paused') && <button type="button" onClick={() => setStatus(s => s === 'playing' ? 'paused' : 'playing')}>{status === 'playing' ? 'Pausa' : 'Seguir'}</button>}
    </div>
    <div className="runner-stage" ref={stageRef}>
      <canvas ref={canvasRef} role="img" aria-label="Tablero del juego" />
      {status !== 'playing' && <div className="runner-overlay" role="dialog" aria-labelledby="runner-message">
        <div>
          {status === 'ready' && <>
            <h2 id="runner-message">¡Cuidado, bloques!</h2>
            <p>Caen piezas de tetris desde arriba. Corré y saltá para que no te aplasten. Las piezas se van apilando y te sirven de escalones; si se completa una fila, desaparece y sumás puntos.</p>
            <p className="runner-keys"><kbd>←</kbd> <kbd>→</kbd> correr · <kbd>↑</kbd> o <kbd>Espacio</kbd> saltar · <kbd>P</kbd> pausa</p>
            <button type="button" onClick={start} autoFocus>Jugar</button>
          </>}
          {status === 'paused' && <>
            <h2 id="runner-message">Pausa</h2>
            <button type="button" onClick={() => setStatus('playing')} autoFocus>Seguir</button>
          </>}
          {status === 'over' && <>
            <h2 id="runner-message">{OVER_TEXT[overReason]}</h2>
            <p>Hiciste <strong>{points}</strong> puntos.{newRecord && ' ¡Nuevo récord!'}</p>
            <button type="button" onClick={start} autoFocus>Jugar de nuevo</button>
          </>}
        </div>
      </div>}
    </div>
    <div className="runner-pad" aria-label="Controles">
      <button type="button" aria-label="Izquierda" {...hold('left')}>◀</button>
      <button type="button" aria-label="Derecha" {...hold('right')}>▶</button>
      <button type="button" className="runner-jump" aria-label="Saltar" {...hold('jump')}>Saltar</button>
    </div>
  </section>;
}

