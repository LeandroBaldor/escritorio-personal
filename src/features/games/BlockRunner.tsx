import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { level, newGame, WIN_LEVEL, TRAP_SECONDS, PLAYER_H, PLAYER_W, score, step, type Game, type GameOver, type Input } from './blockRunner';

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

  // Bombas: franja roja de aviso, cuerpo negro con brillo y mecha con chispa.
  for (const bomb of game.bombs) {
    ctx.fillStyle = '#ef444426';
    ctx.fillRect(bomb.x * cell, Math.max(0, bomb.y * cell), cell, h);
    const cx = (bomb.x + 0.5) * cell, cy = (bomb.y + 0.55) * cell, br = cell * 0.36;
    if (bomb.y < 0) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.moveTo(cx - cell * 0.3, 2); ctx.lineTo(cx + cell * 0.3, 2); ctx.lineTo(cx, cell * 0.4); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = Math.max(1.5, cell * 0.07);
    ctx.beginPath(); ctx.moveTo(cx + br * 0.4, cy - br * 0.8); ctx.quadraticCurveTo(cx + br * 0.9, cy - br * 1.5, cx + br * 0.5, cy - br * 1.7); ctx.stroke();
    ctx.fillStyle = '#111827';
    ctx.beginPath(); ctx.arc(cx, cy, br, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff55';
    ctx.beginPath(); ctx.arc(cx - br * 0.35, cy - br * 0.35, br * 0.28, 0, Math.PI * 2); ctx.fill();
    const flicker = 0.6 + 0.4 * Math.sin(game.time * 40 + bomb.id);
    ctx.fillStyle = '#fde047';
    ctx.beginPath(); ctx.arc(cx + br * 0.5, cy - br * 1.75, cell * 0.09 * (1 + flicker), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f97316';
    ctx.beginPath(); ctx.arc(cx + br * 0.5, cy - br * 1.75, cell * 0.05 * (1 + flicker), 0, Math.PI * 2); ctx.fill();
  }

  // Personaje de perfil: brazos separados del cuerpo, piernas que se mueven al correr,
  // y nariz, ojo y oreja para que se vea hacia qué lado mira.
  const p = game.player, f = p.facing;
  const px = p.x * cell, py = p.y * cell, pw = PLAYER_W * cell, ph = PLAYER_H * cell;
  const running = p.vx !== 0 && p.onGround;
  const swing = running ? Math.sin(game.time * 22) : 0;
  const skin = '#fcd9b6';
  ctx.lineCap = 'round';
  const arm = (side: 1 | -1, phase: number) => {
    const sx = px + pw / 2 + side * pw * 0.4, sy = py + ph * 0.44;
    const hx = sx + side * pw * 0.2 + phase * pw * 0.18;
    const hy = p.onGround ? sy + ph * 0.24 : sy - ph * 0.16; // en el aire levanta los brazos
    ctx.strokeStyle = skin;
    ctx.lineWidth = Math.max(2, pw * 0.13);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(hx, hy, Math.max(1.5, pw * 0.09), 0, Math.PI * 2); ctx.fill();
  };
  arm(-f as 1 | -1, -swing); // el brazo de atrás va detrás del cuerpo
  // Pantalón blanco (con borde suave para que se vea sobre los bloques claros) y zapatillas oscuras.
  const footL = px + pw * 0.38 + swing * pw * 0.22, footR = px + pw * 0.62 - swing * pw * 0.22;
  const leg = (color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(px + pw * 0.38, py + ph * 0.7); ctx.lineTo(footL, py + ph * 0.96);
    ctx.moveTo(px + pw * 0.62, py + ph * 0.7); ctx.lineTo(footR, py + ph * 0.96);
    ctx.stroke();
  };
  leg('#94a3b8', Math.max(3, pw * 0.22));
  leg('#f8fafc', Math.max(2, pw * 0.16));
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(px + pw * 0.27, py + ph * 0.66, pw * 0.46, ph * 0.08);
  ctx.fillStyle = '#1f2937';
  for (const fx of [footL, footR]) { ctx.beginPath(); ctx.ellipse(fx + f * pw * 0.04, py + ph * 0.97, pw * 0.11, pw * 0.06, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#ef4444';
  ctx.beginPath(); ctx.roundRect(px + pw * 0.22, py + ph * 0.38, pw * 0.56, ph * 0.38, pw * 0.12); ctx.fill();
  const hx = px + pw / 2, hy = py + ph * 0.22, r = pw * 0.3;
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(hx + f * r * 0.95, hy + r * 0.15, r * 0.26, 0, Math.PI * 2); ctx.fill(); // nariz
  ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3b2412'; // pelo que asoma atrás de la gorra
  ctx.beginPath(); ctx.ellipse(hx - f * r * 0.55, hy + r * 0.05, r * 0.48, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2b48c'; // oreja
  ctx.beginPath(); ctx.arc(hx - f * r * 0.12, hy + r * 0.12, r * 0.26, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#c98a66';
  ctx.lineWidth = Math.max(0.8, r * 0.08);
  ctx.beginPath(); ctx.arc(hx - f * r * 0.12, hy + r * 0.12, r * 0.13, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#111'; // ojo
  ctx.beginPath(); ctx.arc(hx + f * r * 0.5, hy - r * 0.05, Math.max(1.2, r * 0.15), 0, Math.PI * 2); ctx.fill();
  // Gorra azul con visera hacia donde mira.
  ctx.fillStyle = '#2563eb';
  ctx.beginPath(); ctx.arc(hx, hy - r * 0.2, r * 1.04, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillRect(hx - r * 1.04, hy - r * 0.32, r * 2.08, r * 0.14);
  ctx.fillStyle = '#1d4ed8';
  ctx.beginPath(); ctx.roundRect(f > 0 ? hx + r * 0.3 : hx - r * 1.55, hy - r * 0.32, r * 1.25, r * 0.22, r * 0.1); ctx.fill();
  ctx.fillStyle = '#facc15';
  ctx.beginPath(); ctx.arc(hx, hy - r * 1.22, r * 0.14, 0, Math.PI * 2); ctx.fill();
  arm(f, swing); // el brazo de adelante va delante del cuerpo

  // Explosiones: un fogonazo que crece y se apaga, y chispas de los bloques que se rompen.
  for (const b of game.blasts) {
    const k = b.t / b.max, radius = (0.8 + k * 1.6) * b.size * cell;
    const glow = ctx.createRadialGradient(b.x * cell, b.y * cell, 0, b.x * cell, b.y * cell, radius);
    glow.addColorStop(0, `rgba(255,255,220,${0.95 * (1 - k)})`);
    glow.addColorStop(0.45, `rgba(251,146,60,${0.8 * (1 - k)})`);
    glow.addColorStop(1, 'rgba(239,68,68,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(b.x * cell, b.y * cell, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(253,224,71,${1 - k})`;
    ctx.lineWidth = Math.max(1.5, cell * 0.08);
    ctx.beginPath(); ctx.arc(b.x * cell, b.y * cell, radius * 0.9, 0, Math.PI * 2); ctx.stroke();
  }
  for (const s of game.particles) {
    ctx.globalAlpha = Math.max(0, s.life / s.max);
    ctx.fillStyle = s.color;
    const size = s.size * cell;
    ctx.fillRect(s.x * cell - size / 2, s.y * cell - size / 2, size, size);
  }
  ctx.globalAlpha = 1;
}

const OVER_TEXT: Record<GameOver, string> = { crushed: '¡Te aplastaron!', bomb: '¡Te alcanzó una bomba!', full: '¡Los bloques llegaron arriba!', trapped: '¡Quedaste atrapado!', won: '¡Ganaste! 🏆' };

export function BlockRunner() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const input = useRef<Input>({ left: false, right: false, jump: false });
  const [status, setStatus] = useState<Status>('ready');
  const [points, setPoints] = useState(0);
  const [trap, setTrap] = useState(0);
  const [stage, setStage] = useState({ level: 1, seconds: 0 });
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
    setStage({ level: 1, seconds: 0 });
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
    let frame = 0, last = performance.now(), afterOver = 0;
    const tick = (now: number) => {
      const game = gameRef.current;
      if (!game) return;
      // El primer cuadro puede traer una hora anterior a "last": nunca avanzar con tiempo negativo.
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      step(game, input.current, dt);
      last = now;
      paint();
      const current = score(game);
      setPoints(prev => prev === current ? prev : current);
      const left = game.trapped > 0 && !game.over ? Math.ceil(TRAP_SECONDS - game.trapped) : 0;
      setTrap(prev => prev === left ? prev : left);
      const shown = { level: level(game), seconds: Math.floor(game.time) };
      setStage(prev => prev.seconds === shown.seconds ? prev : shown);
      if (game.over) afterOver += dt;
      // Al perder, la explosión se sigue viendo un momento antes del cartel.
      if (game.over && (afterOver > 0.8 || game.over === 'won')) {
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
        <span>Nivel <strong>{stage.level}/{WIN_LEVEL}</strong></span>
        <span>Tiempo <strong>{Math.floor(stage.seconds / 60)}:{String(stage.seconds % 60).padStart(2, '0')}</strong></span>
        <span>Puntos <strong data-testid="runner-points">{points}</strong></span>
        <span>Récord <strong>{record}</strong></span>
      </div>
      {(status === 'playing' || status === 'paused') && <button type="button" onClick={() => setStatus(s => s === 'playing' ? 'paused' : 'playing')}>{status === 'playing' ? 'Pausa' : 'Seguir'}</button>}
    </div>
    <div className="runner-stage" ref={stageRef}>
      <canvas ref={canvasRef} role="img" aria-label="Tablero del juego" />
      {status === 'playing' && trap > 0 && <div className="runner-trap" role="alert">¡Encerrado! Salí en <strong>{trap}</strong></div>}
      {status !== 'playing' && <div className="runner-overlay" role="dialog" aria-labelledby="runner-message">
        <div>
          {status === 'ready' && <>
            <h2 id="runner-message">¡Cuidado, bloques!</h2>
            <p>Caen piezas de tetris y bombas desde arriba. Corré y saltá para que no te aplasten. Cada pieza rompe los bloques de su mismo color que encuentra abajo; las demás se apilan y te sirven de escalones. Las bombas explotan al llegar: alejate. Si quedás encerrado tenés 10 segundos para salir. Si los bloques llegan arriba, se termina. Llegá al nivel 10 para ganar.</p>
            <p className="runner-keys"><kbd>←</kbd> <kbd>→</kbd> correr · <kbd>↑</kbd> o <kbd>Espacio</kbd> saltar · <kbd>P</kbd> pausa</p>
            <button type="button" onClick={start} autoFocus>Jugar</button>
          </>}
          {status === 'paused' && <>
            <h2 id="runner-message">Pausa</h2>
            <button type="button" onClick={() => setStatus('playing')} autoFocus>Seguir</button>
          </>}
          {status === 'over' && <>
            <h2 id="runner-message">{OVER_TEXT[overReason]}</h2>
            <p>{overReason === 'won' && 'Llegaste al nivel 10. '}Hiciste <strong>{points}</strong> puntos.{newRecord && ' ¡Nuevo récord!'}</p>
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

