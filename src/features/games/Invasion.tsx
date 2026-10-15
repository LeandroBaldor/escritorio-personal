import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BOLT_TIME, GAME_SECONDS, MAG, newInvasion, RELOAD_TIME, shoot, step, takeEvents, type Invasion as Game } from './invasion';
import { ANOMALIES } from './invasionAnomalies';
import { drawMinimap, paintCity, ZOOMS, type View } from './invasionArt';
import { invasionLevels } from './invasionSound';
import {
  playAlienDeath, playBlast, playBolt, playCivilianHit, playDefuse, playEmpty, playGameOver, playGlass, playLaser, playLighter, playRadioBeep, playRayGun, playReload,
  playRicochet, playRifleShot, playScream, playStart, playUfoArrive, playWinFanfare, preloadInvasionSounds, setInvasionAmbient,
} from './sounds';
import { EndBanner } from './EndBanner';

const RECORD_KEY = 'escritorio-personal-juegos:invasion-record';
export interface InvasionRecord { kills: number }
export const readInvasionRecord = (): InvasionRecord => { try { const v = JSON.parse(localStorage.getItem(RECORD_KEY) ?? 'null'); return v && typeof v.kills === 'number' ? v : { kills: 0 }; } catch { return { kills: 0 }; } };
const saveRecord = (value: InvasionRecord) => { try { localStorage.setItem(RECORD_KEY, JSON.stringify(value)); } catch { /* sin almacenamiento */ } };
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

type Status = 'ready' | 'playing' | 'paused' | 'over';
const MIN_ZOOM = ZOOMS[0], MAX_ZOOM = ZOOMS[ZOOMS.length - 1], START_ZOOM = 58;
const BREATH = 4; // segundos que se puede contener la respiración (Shift)

// La mira: todo negro menos el círculo del lente, con su sombra en el borde, un brillo, la retícula
// (líneas finas en el medio y gruesas afuera, con puntos para medir) y el punto rojo del centro.
function drawScope(ctx: CanvasRenderingContext2D, w: number, h: number, zoom: number, t: number, kick: number) {
  const R = Math.min(w, h) * 0.47, cx = w / 2, cy = h / 2;
  ctx.save();
  ctx.fillStyle = '#020403';
  ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.arc(cx, cy, R, 0, Math.PI * 2, true); ctx.fill('evenodd');
  const edge = ctx.createRadialGradient(cx, cy, R * 0.72, cx, cy, R);
  edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(0.85, 'rgba(0,0,0,0.45)'); edge.addColorStop(1, 'rgba(0,0,0,0.95)');
  ctx.fillStyle = edge; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  // Aro del lente con un reflejo de color.
  ctx.strokeStyle = 'rgba(56,189,248,0.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R - 2, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#111827'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, Math.PI * 2); ctx.stroke();
  const glare = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.5, 0, cx - R * 0.45, cy - R * 0.5, R * 0.6);
  glare.addColorStop(0, 'rgba(255,255,255,0.08)'); glare.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glare; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  // Retícula.
  const thin = Math.max(1, R * 0.003), thick = Math.max(3, R * 0.012), gap = R * 0.32;
  ctx.fillStyle = 'rgba(5,5,5,0.92)';
  ctx.fillRect(cx - R, cy - thick / 2, R - gap, thick); ctx.fillRect(cx + gap, cy - thick / 2, R - gap, thick);
  ctx.fillRect(cx - thick / 2, cy + gap, thick, R - gap); ctx.fillRect(cx - thick / 2, cy - R, thick, R - gap);
  ctx.fillRect(cx - gap, cy - thin / 2, gap * 2, thin); ctx.fillRect(cx - thin / 2, cy - gap, thin, gap * 2);
  for (let i = 1; i <= 4; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.arc(cx + dx * i * gap / 5, cy + dy * i * gap / 5, Math.max(1.4, R * 0.006), 0, Math.PI * 2); ctx.fill(); }
  // Marcas de caída de la bala abajo del centro.
  for (let i = 1; i <= 3; i++) ctx.fillRect(cx - R * 0.02 * (4 - i), cy + gap * (0.25 + i * 0.18), R * 0.04 * (4 - i), thin);
  ctx.fillStyle = `rgba(239,68,68,${0.85 + Math.sin(t * 3) * 0.1})`; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.arc(cx, cy, Math.max(1.8, R * 0.007), 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  // Zoom y el fogonazo del disparo.
  ctx.fillStyle = 'rgba(134,239,172,0.85)'; ctx.font = `800 ${Math.max(11, R * 0.04)}px ui-monospace, monospace`; ctx.textAlign = 'center';
  ctx.fillText(`×${(zoom / 10).toFixed(1)}`, cx + R * 0.78, cy - R * 0.62);
  if (kick > 0.6) { ctx.fillStyle = `rgba(255,220,150,${(kick - 0.6) * 0.5})`; ctx.fillRect(0, 0, w, h); }
  ctx.restore();
}

export function Invasion() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const [firstGame] = useState(() => newInvasion());
  const gameRef = useRef<Game>(firstGame);
  const aim = useRef({ x: 60, y: 8, zoom: START_ZOOM, target: START_ZOOM, kick: 0, breath: BREATH, holding: false, swayT: 0 });
  const gun = useRef({ mag: MAG, cycle: 0, reload: 0 });
  const lock = useRef({ failed: false });
  const drag = useRef<{ x: number; y: number; id: number; moved: number; t: number } | null>(null);
  const keys = useRef(new Set<string>());
  const [status, setStatus] = useState<Status>('ready');
  const [hud, setHud] = useState({ left: GAME_SECONDS, kills: 0, civilians: 0, mag: MAG, reloading: false, zoom: START_ZOOM, breath: 1, aliens: 5 });
  const [record, setRecord] = useState(readInvasionRecord);
  const [result, setResult] = useState({ kills: 0, headshots: 0, civilians: 0, shots: 0, hits: 0, defused: 0, newRecord: false, clues: [] as string[] });
  const [toast, setToast] = useState<{ text: string; id: number; big?: boolean; bad?: boolean } | null>(null);
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.big ? 2600 : 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  // Dónde está la mira de verdad: donde apuntás más el temblor del pulso (menos si contenés la respiración) y el retroceso.
  const sway = useCallback(() => {
    const a = aim.current, k = a.holding && a.breath > 0 ? 0.15 : 1, amp = 7 / a.zoom * k, t = a.swayT;
    return { x: a.x + Math.sin(t * 0.9) * amp + Math.sin(t * 2.3) * amp * 0.4, y: a.y + Math.sin(t * 1.3 + 1) * amp * 0.8 + a.kick * 1.2 * (30 / a.zoom) };
  }, []);

  const paint = useCallback(() => {
    const stage = stageRef.current, canvas = canvasRef.current, g = gameRef.current;
    if (!stage || !canvas) return;
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = `${w}px`; canvas.style.height = `${h}px`; }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const a = aim.current, p = sway();
    const v: View = { w, h, s: a.zoom, cx: p.x, cy: p.y, t: g.time, dpr };
    paintCity(ctx, g, v);
    drawScope(ctx, w, h, a.zoom, g.time, a.kick);
    const map = mapRef.current;
    if (map) {
      const mw = map.clientWidth, mh = map.clientHeight;
      if (mw && mh) {
        if (map.width !== Math.round(mw * dpr)) { map.width = Math.round(mw * dpr); map.height = Math.round(mh * dpr); }
        const m = map.getContext('2d');
        if (m) { m.setTransform(dpr, 0, 0, dpr, 0, 0); drawMinimap(m, g, mw, mh, { x1: p.x - w / 2 / a.zoom, x2: p.x + w / 2 / a.zoom, y1: p.y - h / 2 / a.zoom, y2: p.y + h / 2 / a.zoom }); }
      }
    }
  }, [sway]);

  const clamp = (g: Game) => { const a = aim.current; a.x = Math.max(0, Math.min(g.width, a.x)); a.y = Math.max(-1.2, Math.min(46, a.y)); };
  const moveAim = useCallback((dx: number, dy: number) => { const a = aim.current; a.x += dx / a.zoom; a.y -= dy / a.zoom; clamp(gameRef.current); }, []);
  const zoomBy = useCallback((factor: number) => { const a = aim.current; a.target = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, a.target * factor)); }, []);

  const fire = useCallback(() => {
    if (statusRef.current !== 'playing') return;
    const g = gameRef.current, G = gun.current;
    if (G.reload > 0 || G.cycle > 0) return;
    if (G.mag <= 0) { playEmpty(); G.reload = RELOAD_TIME; playReload(); return; }
    const p = sway();
    G.mag--; aim.current.kick = 1;
    playRifleShot();
    const hit = shoot(g, p.x, p.y);
    if (hit === 'alien') setToast({ text: '¡Alien eliminado! 👽', id: performance.now() });
    if (hit === 'civilian') setToast({ text: '¡Era una persona! −1', id: performance.now(), bad: true });
    if (hit === 'defused') setToast({ text: '¡Bomba desactivada! 💣', id: performance.now() });
    if (hit === 'ufo') setToast({ text: 'Las balas no le hacen nada al ovni', id: performance.now(), bad: true });
    if (G.mag > 0) { G.cycle = BOLT_TIME; playBolt(); } else { G.reload = RELOAD_TIME; playReload(); }
  }, [sway]);
  const reload = useCallback(() => { const G = gun.current; if (G.reload > 0 || G.mag === MAG || statusRef.current !== 'playing') return; G.reload = RELOAD_TIME; playReload(); }, []);

  // Agarra el mouse (así se mueve el arma sin que la flecha se salga de la pantalla).
  const grab = useCallback(() => {
    if (lock.current.failed) return;
    try { const c = canvasRef.current as HTMLCanvasElement & { requestPointerLock?: () => Promise<void> | void }; const r = c?.requestPointerLock?.(); if (r instanceof Promise) r.catch(() => { lock.current.failed = true; }); if (!c?.requestPointerLock) lock.current.failed = true; } catch { lock.current.failed = true; }
  }, []);
  const resume = useCallback(() => { setStatus('playing'); grab(); }, [grab]);

  const start = useCallback(() => {
    playStart(); preloadInvasionSounds();
    gameRef.current = newInvasion();
    const g = gameRef.current;
    Object.assign(aim.current, { x: g.width * (0.3 + Math.random() * 0.4), y: 8, zoom: START_ZOOM, target: START_ZOOM, kick: 0, breath: BREATH, holding: false, swayT: 0 });
    gun.current = { mag: MAG, cycle: 0, reload: 0 };
    setHud({ left: GAME_SECONDS, kills: 0, civilians: 0, mag: MAG, reloading: false, zoom: START_ZOOM, breath: 1, aliens: 5 });
    setToast({ text: 'Hay aliens disfrazados de personas. ¡Encontralos antes de que quemen la ciudad!', id: performance.now(), big: true });
    setStatus('playing');
    grab();
  }, [grab]);

  // Primera pantalla: la ciudad de fondo.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [paint]);

  // Fuera del juego (pausa, final) se suelta el mouse, así se pueden tocar los botones.
  useEffect(() => {
    if (status !== 'playing' && document.pointerLockElement === canvasRef.current) { try { document.exitPointerLock?.(); } catch { /* nada */ } }
  }, [status]);

  // Bucle del juego.
  useEffect(() => {
    if (status !== 'playing') { setInvasionAmbient(null); return; }
    let frame = 0, last = performance.now(), soundAt = 0;
    const tick = (now: number) => {
      const g = gameRef.current, a = aim.current, G = gun.current;
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      step(g, dt);
      a.swayT += dt;
      a.kick = Math.max(0, a.kick - dt * 4);
      a.zoom += (a.target - a.zoom) * Math.min(1, dt * 10);
      a.holding = keys.current.has('Shift');
      a.breath = a.holding ? Math.max(0, a.breath - dt) : Math.min(BREATH, a.breath + dt * 0.6);
      const pan = 26 / a.zoom * 60 * dt;
      if (keys.current.has('ArrowLeft') || keys.current.has('a')) moveAim(-pan * a.zoom, 0);
      if (keys.current.has('ArrowRight') || keys.current.has('d')) moveAim(pan * a.zoom, 0);
      if (keys.current.has('ArrowUp') || keys.current.has('w')) moveAim(0, -pan * a.zoom);
      if (keys.current.has('ArrowDown') || keys.current.has('s')) moveAim(0, pan * a.zoom);
      if (G.cycle > 0) G.cycle = Math.max(0, G.cycle - dt);
      if (G.reload > 0) { G.reload = Math.max(0, G.reload - dt); if (G.reload === 0) G.mag = MAG; }
      const p = sway();
      const near = (x: number, y: number) => Math.max(0, 1 - Math.hypot(x - p.x, y - p.y) / (600 / a.zoom));
      for (const e of takeEvents(g)) {
        if (e.type === 'kill') { playAlienDeath(); if (e.head) setToast({ text: '¡Tiro a la cabeza! 👽', id: now }); }
        if (e.type === 'civilian') playCivilianHit();
        if (e.type === 'glass') playGlass(0.8);
        if (e.type === 'ufoPing') playRicochet();
        if (e.type === 'defused') playDefuse();
        if (e.type === 'explosion') playBlast(Math.max(0.15, near(e.x, e.y)));
        if (e.type === 'laser') playLaser(Math.max(0.2, near(e.x, e.y)));
        if (e.type === 'lighter') playLighter(near(e.x, e.y));
        if (e.type === 'ray') playRayGun(near(e.x, e.y));
        if (e.type === 'scream') playScream(near(e.x, e.y), 0.8 + Math.random() * 0.6);
        if (e.type === 'ufoArrive') { playUfoArrive(); setToast({ text: g.ufos.length === 1 ? '¡Llegaron los ovnis! Las balas no les hacen nada 🛸' : `¡Otro ovni! Ya son ${g.ufos.length} 🛸`, id: now, big: g.ufos.length === 1 }); }
        if (e.type === 'moreAliens') { playRadioBeep(); setToast({ text: `📻 Radio: hay más aliens en la ciudad (${e.count})`, id: now }); }
      }
      if (now - soundAt > 100) { soundAt = now; setInvasionAmbient(invasionLevels(g, p.x, p.y, a.zoom)); }
      paint();
      const shown = { left: Math.max(0, Math.ceil(GAME_SECONDS - g.time)), kills: g.kills, civilians: g.civilians, mag: G.mag, reloading: G.reload > 0, zoom: Math.round(a.zoom), breath: Math.round((a.breath / BREATH) * 10) / 10, aliens: g.aliensWanted };
      setHud(prev => JSON.stringify(prev) === JSON.stringify(shown) ? prev : shown);
      if (g.over) {
        const rec = readInvasionRecord(), isNew = g.kills > rec.kills;
        if (isNew) { saveRecord({ kills: g.kills }); setRecord({ kills: g.kills }); }
        const clues = [...new Set(g.killedAnomalies)].slice(-8).map(id => ANOMALIES[id].text);
        setResult({ kills: g.kills, headshots: g.headshots, civilians: g.civilians, shots: g.shots, hits: g.hits, defused: g.defused, newRecord: isNew, clues });
        setInvasionAmbient(null);
        if (isNew) playWinFanfare(); else playGameOver();
        statusRef.current = 'over'; // antes de soltar el mouse, así no se toma como una pausa
        setStatus('over');
        try { document.exitPointerLock?.(); } catch { /* nada */ }
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hide = () => { if (document.hidden) setStatus('paused'); };
    document.addEventListener('visibilitychange', hide);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', hide); };
  }, [status, paint, sway, moveAim]);

  // Mouse: con la captura del puntero el mouse mueve el arma sin salirse de la pantalla. Si se suelta
  // (Escape), se pausa.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const move = (e: MouseEvent) => { if (statusRef.current === 'playing' && (document.pointerLockElement === canvas || lock.current.failed || e.buttons === 0)) moveAim(e.movementX, e.movementY); };
    const down = (e: MouseEvent) => {
      if (e.button !== 0 || statusRef.current !== 'playing') return;
      if (document.pointerLockElement !== canvas && !lock.current.failed) {
        // Este clic solo agarra el mouse (no dispara).
        try { const c = canvas as HTMLCanvasElement & { requestPointerLock?: () => Promise<void> | void }; const r = c.requestPointerLock?.(); if (r instanceof Promise) r.catch(() => { lock.current.failed = true; }); if (!c.requestPointerLock) { lock.current.failed = true; fire(); } } catch { lock.current.failed = true; fire(); }
        return;
      }
      fire();
    };
    const wheel = (e: WheelEvent) => { e.preventDefault(); if (statusRef.current === 'playing') zoomBy(e.deltaY < 0 ? 1.18 : 1 / 1.18); };
    const lockChange = () => { if (document.pointerLockElement !== canvas && statusRef.current === 'playing' && !lock.current.failed && !gameRef.current.over) setStatus('paused'); };
    const lockError = () => { lock.current.failed = true; };
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('wheel', wheel, { passive: false });
    document.addEventListener('pointerlockchange', lockChange);
    document.addEventListener('pointerlockerror', lockError);
    return () => { canvas.removeEventListener('mousemove', move); canvas.removeEventListener('mousedown', down); canvas.removeEventListener('wheel', wheel); document.removeEventListener('pointerlockchange', lockChange); document.removeEventListener('pointerlockerror', lockError); };
  }, [fire, moveAim, zoomBy]);

  // Teclado: flechas o WASD para mover la mira, Shift para contener la respiración, R recarga, + y − zoom, P pausa.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && (statusRef.current === 'playing' || statusRef.current === 'paused')) { setStatus(s => s === 'playing' ? 'paused' : 'playing'); return; }
      if (statusRef.current !== 'playing') return;
      if (e.key === 'r' || e.key === 'R') reload();
      if (e.key === '+' || e.key === '=') zoomBy(1.3);
      if (e.key === '-') zoomBy(1 / 1.3);
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); fire(); }
      if (e.key.startsWith('Arrow')) e.preventDefault();
      keys.current.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [fire, reload, zoomBy]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; setInvasionAmbient(null); };
  }, []);

  // En el celular: arrastrando con el dedo se mueve la mira y un toque cortito dispara.
  const touch = {
    onPointerDown: (e: React.PointerEvent) => { if (e.pointerType !== 'mouse' && e.target === canvasRef.current) { e.preventDefault(); drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: 0, t: performance.now() }; } }, // sin el clic de mouse que el navegador simula después
    onPointerMove: (e: React.PointerEvent) => { const d = drag.current; if (!d || d.id !== e.pointerId) return; moveAim((e.clientX - d.x) * -1, (e.clientY - d.y) * -1); d.moved += Math.hypot(e.clientX - d.x, e.clientY - d.y); d.x = e.clientX; d.y = e.clientY; },
    onPointerUp: () => { const d = drag.current; drag.current = null; if (d && d.moved < 10 && performance.now() - d.t < 350) fire(); },
    onPointerCancel: () => { drag.current = null; },
  };
  const accuracy = result.shots ? Math.round((result.hits / result.shots) * 100) : 0;

  return <section className="runner trepa invasion" aria-label="Invasión">
    <div className="runner-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1>Invasión</h1>
      <div className="runner-scores"><span>Récord <strong>{record.kills} 👽</strong></span></div>
      {(status === 'playing' || status === 'paused') && <button type="button" onClick={() => status === 'playing' ? setStatus('paused') : resume()}>{status === 'playing' ? 'Pausa' : 'Seguir'}</button>}
    </div>
    <div className="trepa-main">
      <div className="runner-stage inv-stage" ref={stageRef} {...touch}>
        <canvas ref={canvasRef} role="img" aria-label="Mira del rifle apuntando a la ciudad" />
        <canvas ref={mapRef} className="inv-map" aria-hidden="true" />
        {status === 'playing' && <div className="inv-touch" aria-label="Zoom y recarga">
          <button type="button" aria-label="Alejar la mira" onClick={() => zoomBy(1 / 1.35)}>−</button>
          <button type="button" aria-label="Acercar la mira" onClick={() => zoomBy(1.35)}>+</button>
          <button type="button" aria-label="Recargar el rifle" onClick={reload}>⟳</button>
        </div>}
        {status === 'playing' && toast && <div key={toast.id} className={`trepa-toast inv-toast${toast.bad ? ' is-bad' : ''}${toast.big ? ' is-big' : ''}`} role="status">{toast.text}</div>}
        {status !== 'playing' && <div className="runner-overlay" role="dialog" aria-labelledby="inv-message">
          <div className="inv-card">
            {status === 'ready' && <>
              <h2 id="inv-message" className="inv-title">Invasión 👽</h2>
              <p>Los aliens se metieron en la ciudad disfrazados de personas y quieren prenderla fuego. Sos francotirador: mirá cada departamento, cada local y la vereda, y encontralos. <strong>Cada alien se ve como un alien gris solo 1 segundo cada 30</strong>, así que prestá atención a lo raro: gente que camina para atrás, que come plantas, que te mira fijo, que flota, que habla en símbolos… Hay más de 100 cosas raras distintas.</p>
              <p>Ojo: si le disparás a una persona, te resta. Los aliens prenden fuego con encendedores y armas raras, y dejan cajas con explosivos (las que tienen una lucecita roja que titila): dispárale a la caja para desactivarla. Con el tiempo llegan más aliens y, a los 5 minutos, ovnis a los que las balas no les hacen nada. A los 10 minutos la ciudad queda destruida.</p>
              <p className="runner-keys"><kbd>Mouse</kbd> apuntar · <kbd>Clic</kbd> disparar · <kbd>Ruedita</kbd> zoom · <kbd>Shift</kbd> contener la respiración · <kbd>R</kbd> recargar · <kbd>P</kbd> pausa</p>
              <button type="button" onClick={start} autoFocus>Jugar</button>
            </>}
            {status === 'paused' && <>
              <h2 id="inv-message">Pausa</h2>
              <button type="button" onClick={resume} autoFocus>Seguir</button>
            </>}
            {status === 'over' && <>
              <EndBanner win={result.newRecord} id="inv-message" />
              <p className="end-reason">La ciudad cayó. Eliminaste <strong data-testid="inv-final">{result.kills}</strong> {result.kills === 1 ? 'alien' : 'aliens'}.{result.newRecord && ' ¡Nuevo récord!'}</p>
              <p>{result.headshots} tiros a la cabeza · {result.defused} bombas desactivadas · {result.civilians} {result.civilians === 1 ? 'persona' : 'personas'} por error · {accuracy}% de puntería</p>
              {result.clues.length > 0 && <div className="inv-clues"><p><strong>Lo raro que hacían los aliens que eliminaste:</strong></p><ul>{result.clues.map(c => <li key={c}>{c}</li>)}</ul></div>}
              <button type="button" onClick={start} autoFocus>Jugar de nuevo</button>
            </>}
          </div>
        </div>}
      </div>
      <aside className="trepa-side inv-side" aria-label="Tiempo, aliens, balas y zoom">
        <div className="trepa-stat"><span>Quedan</span><strong data-testid="inv-time">{clock(hud.left)}</strong></div>
        <div className="trepa-stat inv-kills"><span>Eliminados</span><strong data-testid="inv-kills">{hud.kills} 👽</strong></div>
        <div className="trepa-stat"><span>Récord</span><strong>{record.kills}</strong></div>
        <div className="trepa-stat inv-ammo"><span>{hud.reloading ? 'Recargando…' : 'Balas'}</span><strong data-testid="inv-ammo" aria-label={`${hud.mag} balas`}>{Array.from({ length: MAG }, (_, i) => <i key={i} className={i < hud.mag && !hud.reloading ? 'is-full' : ''} />)}</strong></div>
        <div className="trepa-stat"><span>Respiración</span><strong className="inv-breath"><i style={{ width: `${hud.breath * 100}%` }} /></strong></div>
        {hud.civilians > 0 && <div className="trepa-stat inv-bad"><span>Personas</span><strong>{hud.civilians}</strong></div>}
      </aside>
    </div>
    <div className="runner-pad inv-pad" aria-label="Controles">
      <button type="button" aria-label="Alejar" onClick={() => zoomBy(1 / 1.35)}>−</button>
      <button type="button" aria-label="Acercar" onClick={() => zoomBy(1.35)}>+</button>
      <button type="button" aria-label="Recargar" onClick={reload}>⟳</button>
      <button type="button" className="runner-jump" aria-label="Disparar" onClick={fire}>Disparar</button>
    </div>
  </section>;
}
