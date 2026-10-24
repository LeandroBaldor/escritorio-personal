import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LEVELS, LEVEL_COUNT, LIVES, ROWS, loadLevel, newGame, progress, step, takeEvents, type Death, type Game, type Input, type Stats } from './gravitySwap';
import { PX, drawGame } from './gravityArt';
import { playAstronautHit, playAstronautLand, playCrumble, playExplosion, playGameOver, playGravityFlip, playGravityWarn, playGust, playLaserOn, playStart, playTeleport, playThunder, playTramp, playTurretShot, playThrust, playWinFanfare, preloadGravitySounds } from './sounds';
import { EndBanner } from './EndBanner';

const LEVEL_KEY = 'escritorio-personal-juegos:gravedad-nivel';
const RECORD_KEY = 'escritorio-personal-juegos:gravedad-record';
const readNumber = (key: string) => { try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; } };
const saveNumber = (key: string, value: number) => { try { localStorage.setItem(key, String(value)); } catch { /* sin almacenamiento: dura esta partida */ } };
// Hasta qué escenario llegó (para elegir desde dónde jugar) y el mejor tiempo para pasar los 10 seguidos.
export const readGravityRecord = () => ({ unlocked: Math.max(1, Math.min(LEVEL_COUNT, readNumber(LEVEL_KEY))), time: readNumber(RECORD_KEY) || null });
export const formatGravityTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

type Status = 'ready' | 'playing' | 'paused' | 'over' | 'won';

const DEATH_TEXT: Record<Death, string> = {
  spikes: '¡Te pinchaste!', laser: '¡Te alcanzó un láser!', mine: '¡Chocaste una mina!', blast: '¡Te alcanzó una explosión!',
  saw: '¡Te cortó una sierra!', enemy: '¡Te atrapó un enemigo!', void: '¡Te perdiste en el vacío!', edge: '¡Te aplastó el borde de la pantalla!',
  fire: '¡Te quemaste!', bolt: '¡Te dieron un disparo!', lightning: '¡Te partió un rayo!', press: '¡Te aplastó una prensa!',
  icicle: '¡Te cayó una estalactita!', spore: '¡Tocaste una espora venenosa!', rock: '¡Te golpeó una roca espacial!',
};

// El lienzo llena todo el lugar: el pasillo (10 casilleros de alto) entra siempre, con al menos 12 de ancho, y
// arriba y abajo se ven por lo menos 3 casilleros más: el cielo y las capas de la tierra (en el celular parado, muchos más).
function sizeFor(width: number, height: number) {
  const cell = Math.max(1, Math.min(height / (ROWS + 3), width / 12), width / 26);
  return { cols: width / cell, rows: height / cell };
}
const colsFor = (width: number, height: number) => sizeFor(width, height).cols;

interface Hud { level: number; lives: number; progress: number; time: number; phase: Game['phase']; death: Death | null; intro: boolean; warn: boolean; angle: number }
const hudOf = (game: Game): Hud => ({
  level: game.level, lives: game.lives, progress: Math.floor(progress(game) * 100), time: Math.floor(game.stats.time),
  phase: game.phase, death: game.death, intro: game.phase === 'play' && game.time < 2.6, warn: game.warned && game.phase === 'play',
  angle: Math.round(game.angle * 180 / Math.PI) % 360,
});
const sameHud = (a: Hud, b: Hud) => (Object.keys(a) as (keyof Hud)[]).every(k => a[k] === b[k]);

export function GravitySwap() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const input = useRef<Input>({ left: false, right: false, up: false, down: false });
  const startLevel = useRef(1);
  const [status, setStatus] = useState<Status>('ready');
  const [record, setRecord] = useState(readGravityRecord);
  const [chosen, setChosen] = useState(() => readGravityRecord().unlocked);
  const [hud, setHud] = useState<Hud>({ level: 1, lives: LIVES, progress: 0, time: 0, phase: 'play', death: null, intro: false, warn: false, angle: 0 });
  const [newRecord, setNewRecord] = useState(false);
  const [mission, setMission] = useState<Stats | null>(null);
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  const paint = useCallback(() => {
    const stage = stageRef.current, canvas = canvasRef.current, game = gameRef.current;
    if (!stage || !canvas || !game) return;
    const { cols, rows } = sizeFor(stage.clientWidth, stage.clientHeight);
    game.cols = cols;
    const w = Math.round(cols * PX), h = Math.round(rows * PX);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(w / cols, 0, 0, h / rows, 0, 0);
    drawGame(ctx, game, rows);
  }, []);

  const begin = useCallback((level: number, keepRun = false) => {
    playStart();
    preloadGravitySounds();
    const stage = stageRef.current;
    if (!stage) return;
    const cols = colsFor(stage.clientWidth, stage.clientHeight);
    const previous = gameRef.current;
    if (keepRun && previous) { previous.lives = LIVES; loadLevel(previous, level); previous.phase = 'play'; }
    else { startLevel.current = level; gameRef.current = newGame(level, cols); }
    input.current = { left: false, right: false, up: false, down: false };
    setNewRecord(false);
    setHud(hudOf(gameRef.current!));
    setStatus('playing');
    paint();
  }, [paint]);

  // Primera pantalla: el escenario elegido de fondo, con el astronauta esperando.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (status === 'ready') gameRef.current = newGame(chosen, colsFor(stage.clientWidth, stage.clientHeight));
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [paint, chosen, status]);

  useEffect(() => {
    if (status !== 'playing') return;
    let frame = 0, last = performance.now(), puff = 0;
    const tick = (now: number) => {
      const game = gameRef.current;
      if (!game) return;
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      step(game, input.current, dt);
      // Mientras usa el chorro de oxígeno, un soplido seguido.
      const thrusting = game.phase === 'play' && (game.player.tx !== 0 || game.player.ty !== 0);
      puff = thrusting ? puff - dt : 0;
      if (thrusting && puff <= 0) { playThrust(); puff = 0.12; }
      for (const e of takeEvents(game)) {
        switch (e.type) {
          case 'land': playAstronautLand(); break;
          case 'warn': playGravityWarn(); break;
          case 'flip': playGravityFlip(); break;
          case 'death': playAstronautHit(); break;
          case 'boom': playExplosion(); break;
          case 'shot': playTurretShot(); break;
          case 'zap': playLaserOn(); break;
          case 'spring': playTramp(); break;
          case 'crumble': playCrumble(); break;
          case 'thunder': playThunder(0.8); break;
          case 'gust': playGust(); break;
          case 'cleared': {
            playTeleport();
            const unlocked = Math.min(LEVEL_COUNT, e.level + 1);
            if (unlocked > readGravityRecord().unlocked) saveNumber(LEVEL_KEY, unlocked);
            setRecord(readGravityRecord());
            break;
          }
          case 'won': {
            playWinFanfare();
            // El récord cuenta solo si se jugaron los 10 escenarios seguidos, desde el primero.
            const best = readGravityRecord().time;
            if (startLevel.current === 1 && (best === null || game.stats.time < best)) { saveNumber(RECORD_KEY, Math.ceil(game.stats.time)); setNewRecord(true); }
            setRecord(readGravityRecord());
            setMission({ ...game.stats, levels: game.stats.levels - startLevel.current + 1 });
            break;
          }
        }
      }
      paint();
      const next = hudOf(game);
      setHud(prev => sameHud(prev, next) ? prev : next);
      if (game.phase === 'over') { playGameOver(); setStatus('over'); return; }
      if (game.phase === 'won') { setStatus('won'); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hide = () => { if (document.hidden) setStatus('paused'); };
    document.addEventListener('visibilitychange', hide);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', hide); };
  }, [status, paint]);

  useEffect(() => {
    const keys: Record<string, keyof Input> = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ' ': 'up', ArrowDown: 'down', s: 'down', S: 'down' };
    const down = (event: KeyboardEvent) => {
      const s = statusRef.current;
      if ((event.key === 'p' || event.key === 'P' || event.key === 'Escape') && (s === 'playing' || s === 'paused')) {
        setStatus(s === 'playing' ? 'paused' : 'playing');
        return;
      }
      if ((event.key === 'r' || event.key === 'R') && s === 'playing' && gameRef.current?.phase === 'play') {
        loadLevel(gameRef.current, gameRef.current.level); // reinicia el escenario (con las vidas que le quedan)
        return;
      }
      const key = keys[event.key];
      if (!key || s !== 'playing') return;
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

  const def = LEVELS[hud.level - 1];
  return <section className="runner grav" aria-label="Gravity Swap">
    <div className="runner-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1>Gravity Swap</h1>
      <div className="runner-scores">
        <span>Nivel <strong data-testid="grav-level">{status === 'ready' ? chosen : hud.level}/{LEVEL_COUNT}</strong></span>
        <span className="grav-lives" aria-label={`Vidas: ${hud.lives}`}>{Array.from({ length: LIVES }, (_, i) => <b key={i} className={i < hud.lives ? '' : 'grav-lost'}>♥</b>)}</span>
        <span>Gravedad <strong data-testid="grav-angle">{hud.angle}°</strong></span>
        <span>Avance <strong data-testid="grav-progress">{hud.progress}%</strong></span>
        <span>Tiempo <strong data-testid="grav-time">{formatGravityTime(hud.time)}</strong></span>
        {record.time !== null && <span>Récord <strong>{formatGravityTime(record.time)}</strong></span>}
      </div>
      {(status === 'playing' || status === 'paused') && <button type="button" onClick={() => setStatus(s => s === 'playing' ? 'paused' : 'playing')}>{status === 'playing' ? 'Pausa' : 'Seguir'}</button>}
    </div>
    <div className="runner-stage" ref={stageRef}>
      <canvas ref={canvasRef} role="img" aria-label="Escenario del juego" />
      {status === 'playing' && hud.intro && <div key={hud.level} className="runner-level grav-intro" role="status">
        Nivel <strong>{hud.level}</strong><small>{def.name} {'⭐'.repeat(def.stars)}</small>
      </div>}
      {status === 'playing' && hud.warn && <div className="grav-warn" role="alert">⇅ ¡Cambia la gravedad!</div>}
      {status === 'playing' && hud.phase === 'dead' && hud.death && <div className="runner-trap" role="alert">{DEATH_TEXT[hud.death]}</div>}
      {status === 'playing' && hud.phase === 'cleared' && <div className="runner-level grav-intro" role="status">¡Escenario<strong>superado!</strong></div>}
      {status !== 'playing' && <div className="runner-overlay" role="dialog" aria-labelledby="grav-message">
        <div>
          {status === 'ready' && <>
            <h2 id="grav-message">Gravity Swap 🚀</h2>
            <p className="runner-keys"><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> o flechas: chorros de oxígeno · <kbd>R</kbd> reiniciar · <kbd>Esc</kbd> pausa</p>
            <p className="runner-tip">💡 Flotás y la gravedad gira sola: cuando titila la pantalla, mirá la flecha. Tu tanque de oxígeno no se termina: impulsate todo lo que quieras.</p>
            <div className="grav-levels" role="group" aria-label="Escenarios">
              {LEVELS.map((level, i) => {
                const n = i + 1, locked = n > record.unlocked;
                return <button key={n} type="button" disabled={locked} aria-pressed={chosen === n} className={chosen === n ? 'grav-chosen' : ''} onClick={() => setChosen(n)} title={level.name} aria-label={`${n}. ${level.name}${locked ? ' (bloqueado)' : ''}`}>
                  <b>{locked ? '🔒' : n}</b><span>{level.name}</span>
                </button>;
              })}
            </div>
            <button type="button" onClick={() => begin(chosen)} autoFocus>Jugar</button>
          </>}
          {status === 'paused' && <>
            <h2 id="grav-message">Pausa</h2>
            <button type="button" onClick={() => setStatus('playing')} autoFocus>Seguir</button>
          </>}
          {status === 'over' && <>
            <EndBanner win={false} id="grav-message" />
            <p className="end-reason">{hud.death ? DEATH_TEXT[hud.death] : ''} Te quedaste sin vidas en {def.name}.</p>
            <div className="grav-actions">
              <button type="button" onClick={() => begin(hud.level, true)} autoFocus>Reintentar escenario</button>
              <button type="button" className="grav-secondary" onClick={() => { setChosen(hud.level); setStatus('ready'); }}>Elegir escenario</button>
            </div>
          </>}
          {status === 'won' && mission && <>
            <h2 id="grav-message" className="end-banner end-banner--win grav-mission">🏆 ¡MISIÓN COMPLETADA!</h2>
            <ul className="grav-stats">
              <li>Tiempo total <strong>{formatGravityTime(mission.time)}</strong></li>
              <li>Muertes <strong>{mission.deaths}</strong></li>
              <li>Cambios de gravedad sobrevividos <strong>{mission.flips}</strong></li>
              <li>Escenarios completados <strong>{mission.levels}/{LEVEL_COUNT}</strong></li>
            </ul>
            {newRecord && <p>¡Nuevo récord!</p>}
            <button type="button" onClick={() => { setChosen(1); begin(1); }} autoFocus>VOLVER A JUGAR</button>
          </>}
        </div>
      </div>}
    </div>
    <div className="runner-pad" aria-label="Controles">
      <button type="button" aria-label="Impulso a la izquierda" {...hold('left')}>◀</button>
      <button type="button" aria-label="Impulso hacia arriba" {...hold('up')}>▲</button>
      <button type="button" aria-label="Impulso hacia abajo" {...hold('down')}>▼</button>
      <button type="button" aria-label="Impulso a la derecha" {...hold('right')}>▶</button>
    </div>
  </section>;
}
