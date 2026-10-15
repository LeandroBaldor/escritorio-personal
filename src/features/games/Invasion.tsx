import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BOLT_TIME, CITY_TOP, GOAL_KILLS, LIVES, MAG, newInvasion, RELOAD_TIME, shoot, step, takeEvents, type Invasion as Game, type Outcome } from './invasion';
import { ANOMALIES } from './invasionAnomalies';
import { drawMinimap, paintCity, type View } from './invasionArt';
import { invasionLevels } from './invasionSound';
import {
  playAlienDeath, playBlast, playBolt, playCivilianHit, playDefuse, playEmpty, playGameOver, playGlass, playGooBlast, playLaser, playLighter, playRadioBeep, playRayGun, playReload,
  playRicochet, playRifleShot, playScream, playStart, playUfoArrive, playWinFanfare, preloadInvasionSounds, setInvasionAmbient,
} from './sounds';
import { EndBanner } from './EndBanner';

const RECORD_KEY = 'escritorio-personal-juegos:invasion-record';
// Récord: el menor tiempo en eliminar a los 10 aliens (o, si todavía no se ganó nunca, la mayor cantidad de aliens).
export interface InvasionRecord { kills: number; time?: number | null }
export const readInvasionRecord = (): InvasionRecord => { try { const v = JSON.parse(localStorage.getItem(RECORD_KEY) ?? 'null'); return v && typeof v.kills === 'number' ? v : { kills: 0, time: null }; } catch { return { kills: 0, time: null }; } };
const saveRecord = (value: InvasionRecord) => { try { localStorage.setItem(RECORD_KEY, JSON.stringify(value)); } catch { /* sin almacenamiento */ } };
export const formatInvasionTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

type Status = 'ready' | 'playing' | 'paused' | 'over';
const MAX_ZOOM = 520, START_ZOOM = 58; // con todo el zoom, la cabeza de una persona llena la mira
const BREATH = 4; // segundos que se puede contener la respiración (Shift)
const PAN = 26; // lo que se mueve la vista con las flechas (unidades por segundo)
// Lo que entra de alto en el fondo: de la calle a lo más alto de los edificios (la ciudad ocupa casi toda la pantalla).
const FLOOR_Y = -3.4, TOP_Y = CITY_TOP;

const OUTCOME_TEXT: Record<Outcome, string> = {
  won: `¡Eliminaste a los ${GOAL_KILLS} aliens y salvaste la ciudad! 👽`,
  civilian: `¡Le disparaste a ${LIVES} personas! Perdiste.`,
  time: 'Se terminaron los 10 minutos y la ciudad cayó.',
};

// La mira: el círculo que agranda lo que hay abajo, con su aro, la sombra del borde, un brillo, la retícula
// (líneas finas en el medio y gruesas afuera, con puntos para medir) y el punto rojo del centro.
function drawScope(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, zoom: number, t: number, kick: number) {
  ctx.save();
  const edge = ctx.createRadialGradient(cx, cy, R * 0.72, cx, cy, R);
  edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(0.85, 'rgba(0,0,0,0.4)'); edge.addColorStop(1, 'rgba(0,0,0,0.92)');
  ctx.fillStyle = edge; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(56,189,248,0.3)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R - 2, 0, Math.PI * 2); ctx.stroke();
  const ring = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R); ring.addColorStop(0, '#374151'); ring.addColorStop(0.5, '#0b0f14'); ring.addColorStop(1, '#1f2937');
  ctx.strokeStyle = ring; ctx.lineWidth = Math.max(8, R * 0.06); ctx.beginPath(); ctx.arc(cx, cy, R + Math.max(4, R * 0.03), 0, Math.PI * 2); ctx.stroke();
  const glare = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.5, 0, cx - R * 0.45, cy - R * 0.5, R * 0.6);
  glare.addColorStop(0, 'rgba(255,255,255,0.08)'); glare.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glare; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  // Retícula.
  const thin = Math.max(1, R * 0.004), thick = Math.max(3, R * 0.016), gap = R * 0.32;
  ctx.fillStyle = 'rgba(5,5,5,0.92)';
  ctx.fillRect(cx - R, cy - thick / 2, R - gap, thick); ctx.fillRect(cx + gap, cy - thick / 2, R - gap, thick);
  ctx.fillRect(cx - thick / 2, cy + gap, thick, R - gap); ctx.fillRect(cx - thick / 2, cy - R, thick, R - gap);
  ctx.fillRect(cx - gap, cy - thin / 2, gap * 2, thin); ctx.fillRect(cx - thin / 2, cy - gap, thin, gap * 2);
  for (let i = 1; i <= 4; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.arc(cx + dx * i * gap / 5, cy + dy * i * gap / 5, Math.max(1.4, R * 0.008), 0, Math.PI * 2); ctx.fill(); }
  for (let i = 1; i <= 3; i++) ctx.fillRect(cx - R * 0.02 * (4 - i), cy + gap * (0.25 + i * 0.18), R * 0.04 * (4 - i), thin);
  ctx.fillStyle = `rgba(239,68,68,${0.85 + Math.sin(t * 3) * 0.1})`; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.arc(cx, cy, Math.max(1.8, R * 0.01), 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(134,239,172,0.9)'; ctx.font = `800 ${Math.max(11, R * 0.06)}px ui-monospace, monospace`; ctx.textAlign = 'center';
  ctx.fillText(`×${(zoom / 10).toFixed(1)}`, cx + R * 0.7, cy - R * 0.72);
  if (kick > 0.6) { ctx.fillStyle = `rgba(255,220,150,${(kick - 0.6) * 0.5})`; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

export function Invasion() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  // La mira se dibuja acá (por encima del cartel) mientras el cartel de inicio, pausa o fin está abierto.
  const scopeRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef({ canvas: typeof document === 'undefined' ? null as unknown as HTMLCanvasElement : document.createElement('canvas'), x: NaN, at: 0 });
  const [firstGame] = useState(() => newInvasion());
  const gameRef = useRef<Game>(firstGame);
  // `cam`: dónde está la vista (se mueve con las flechas). `mouse`: dónde está la mira en la pantalla.
  const cam = useRef({ x: 60 });
  const mouse = useRef({ x: -1, y: -1 });
  const aim = useRef({ zoom: START_ZOOM, target: START_ZOOM, kick: 0, breath: BREATH, holding: false, swayT: 0, shake: 0, flash: 0 });
  const gun = useRef({ mag: MAG, cycle: 0, reload: 0 });
  const drag = useRef<{ x: number; y: number; id: number; moved: number; t: number } | null>(null);
  const keys = useRef(new Set<string>());
  const [status, setStatus] = useState<Status>('ready');
  const [hud, setHud] = useState({ time: 0, kills: 0, lives: LIVES, mag: MAG, reloading: false, breath: 1 });
  const [record, setRecord] = useState(readInvasionRecord);
  const [result, setResult] = useState({ outcome: 'time' as Outcome, kills: 0, time: 0, headshots: 0, shots: 0, hits: 0, defused: 0, newRecord: false, clues: [] as string[] });
  const [toast, setToast] = useState<{ text: string; id: number; big?: boolean; bad?: boolean } | null>(null);
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.big ? 2600 : 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  // La vista de fondo: entra toda la altura de la ciudad y con las flechas se recorre la cuadra.
  const baseView = useCallback((w: number, h: number): Omit<View, 't' | 'dpr'> => {
    const g = gameRef.current, s = h / (TOP_Y - FLOOR_Y), half = w / 2 / s;
    cam.current.x = g.width < half * 2 ? g.width / 2 : Math.max(half, Math.min(g.width - half, cam.current.x));
    return { w, h, s, cx: cam.current.x, cy: (TOP_Y + FLOOR_Y) / 2 };
  }, []);
  // Dónde apunta la mira (en la ciudad), con el temblor del pulso (menos si contenés la respiración) y el retroceso.
  const target = useCallback((w: number, h: number) => {
    const b = baseView(w, h), a = aim.current, m = mouse.current;
    const mx = m.x < 0 ? w / 2 : m.x, my = m.y < 0 ? h * 0.55 : m.y;
    const k = a.holding && a.breath > 0 ? 0.15 : 1, amp = 7 / a.zoom * k, t = a.swayT;
    return {
      mx, my,
      x: b.cx + (mx - w / 2) / b.s + Math.sin(t * 0.9) * amp + Math.sin(t * 2.3) * amp * 0.4,
      y: b.cy + (h / 2 - my) / b.s + Math.sin(t * 1.3 + 1) * amp * 0.8 + a.kick * 1.2 * (30 / a.zoom),
    };
  }, [baseView]);
  const scopeRadius = (w: number, h: number) => Math.min(w, h) * (w < 700 ? 0.36 : 0.3);

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
    const a = aim.current, b = baseView(w, h), p = target(w, h), R = scopeRadius(w, h);
    // Toda la cuadra de fondo, más oscura. Se vuelve a dibujar como mucho 10 veces por segundo (o si se movió
    // la vista): está de fondo y así la mira anda fluida en las compus y celulares lentos.
    const bg = bgRef.current, now = performance.now();
    if (bg.canvas.width !== canvas.width || bg.canvas.height !== canvas.height || Math.abs(bg.x - b.cx) > 0.01 || now - bg.at > 100) {
      bg.canvas.width = canvas.width; bg.canvas.height = canvas.height;
      const bctx = bg.canvas.getContext('2d');
      if (bctx) { bctx.setTransform(dpr, 0, 0, dpr, 0, 0); paintCity(bctx, g, { ...b, t: g.time, dpr }, 10); bctx.fillStyle = 'rgba(2,8,4,0.3)'; bctx.fillRect(0, 0, w, h); }
      bg.x = b.cx; bg.at = now;
    }
    // Cuando explota un alien (o una bomba cerca) tiembla todo.
    const shake = a.shake > 0 ? [Math.sin(g.time * 90) * a.shake * 14, Math.cos(g.time * 77) * a.shake * 10] : [0, 0];
    ctx.setTransform(1, 0, 0, 1, shake[0] * dpr, shake[1] * dpr); ctx.drawImage(bg.canvas, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, shake[0] * dpr, shake[1] * dpr);
    // Con el cartel abierto, la mira va en la capa de arriba (así pasa por encima del cartel y no por detrás).
    const top = scopeRef.current, onTop = statusRef.current !== 'playing' && !!top;
    let sctx = ctx;
    if (top) {
      if (top.width !== canvas.width || top.height !== canvas.height) { top.width = canvas.width; top.height = canvas.height; }
      const tctx = top.getContext('2d');
      if (tctx) { tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.clearRect(0, 0, top.width, top.height); if (onTop) { tctx.setTransform(dpr, 0, 0, dpr, 0, 0); sctx = tctx; } }
    }
    // Adentro del círculo, agrandado.
    sctx.save();
    sctx.beginPath(); sctx.arc(p.mx, p.my, R, 0, Math.PI * 2); sctx.clip();
    sctx.translate(p.mx - R, p.my - R);
    paintCity(sctx, g, { w: R * 2, h: R * 2, s: a.zoom, cx: p.x, cy: p.y, t: g.time, dpr });
    sctx.restore();
    drawScope(sctx, p.mx, p.my, R, a.zoom, g.time, a.kick);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Destello de la pantalla: verde si explotó un alien, rojo si le diste a una persona.
    if (a.flash) { const k = Math.abs(a.flash); ctx.fillStyle = a.flash > 0 ? `rgba(163,230,53,${k * 0.35})` : `rgba(185,28,28,${k * 0.4})`; ctx.fillRect(0, 0, w, h); }
    const map = mapRef.current;
    if (map) {
      const mw = map.clientWidth, mh = map.clientHeight;
      if (mw && mh) {
        if (map.width !== Math.round(mw * dpr)) { map.width = Math.round(mw * dpr); map.height = Math.round(mh * dpr); }
        const m = map.getContext('2d');
        if (m) { m.setTransform(dpr, 0, 0, dpr, 0, 0); drawMinimap(m, g, mw, mh, { x1: b.cx - w / 2 / b.s, x2: b.cx + w / 2 / b.s, y1: FLOOR_Y, y2: TOP_Y }); }
      }
    }
  }, [baseView, target]);

  const zoomBy = useCallback((factor: number) => {
    const a = aim.current, stage = stageRef.current, min = stage ? stage.clientHeight / (TOP_Y - FLOOR_Y) * 2 : 20;
    a.target = Math.max(min, Math.min(MAX_ZOOM, a.target * factor));
  }, []);

  const fire = useCallback(() => {
    if (statusRef.current !== 'playing') return;
    const g = gameRef.current, G = gun.current, stage = stageRef.current;
    if (!stage || G.reload > 0 || G.cycle > 0) return;
    if (G.mag <= 0) { playEmpty(); G.reload = RELOAD_TIME; playReload(); return; }
    const p = target(stage.clientWidth, stage.clientHeight);
    G.mag--; aim.current.kick = 1;
    playRifleShot();
    const hit = shoot(g, p.x, p.y);
    if (hit === 'alien') { aim.current.shake = 1; aim.current.flash = 1; if (!g.over) setToast({ text: `¡Alien eliminado! ${g.kills} de ${GOAL_KILLS} 👽`, id: performance.now() }); }
    if (hit === 'civilian') { aim.current.shake = 0.5; aim.current.flash = -1; if (!g.over) { const left = LIVES - g.civilians; setToast({ text: `¡Era una persona! ${left === 1 ? 'Te queda 1 vida' : `Te quedan ${left} vidas`} ❤️`, id: performance.now(), big: true, bad: true }); } }
    if (hit === 'defused') setToast({ text: '¡Bomba desactivada! 💣', id: performance.now() });
    if (hit === 'ufo') setToast({ text: 'Las balas no le hacen nada al ovni', id: performance.now(), bad: true });
    if (G.mag > 0) { G.cycle = BOLT_TIME; playBolt(); } else { G.reload = RELOAD_TIME; playReload(); }
  }, [target]);
  const reload = useCallback(() => { const G = gun.current; if (G.reload > 0 || G.mag === MAG || statusRef.current !== 'playing') return; G.reload = RELOAD_TIME; playReload(); }, []);

  const start = useCallback(() => {
    playStart(); preloadInvasionSounds();
    gameRef.current = newInvasion();
    const g = gameRef.current;
    cam.current.x = g.width * (0.3 + Math.random() * 0.4);
    Object.assign(aim.current, { zoom: START_ZOOM, target: START_ZOOM, kick: 0, breath: BREATH, holding: false, swayT: 0, shake: 0, flash: 0 });
    gun.current = { mag: MAG, cycle: 0, reload: 0 };
    setHud({ time: 0, kills: 0, lives: LIVES, mag: MAG, reloading: false, breath: 1 });
    setToast({ text: `Hay aliens disfrazados de personas: eliminá a ${GOAL_KILLS}. ¡Cuidado con la gente: tenés ${LIVES} vidas!`, id: performance.now(), big: true });
    setStatus('playing');
  }, []);

  // Primera pantalla: la ciudad de fondo.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [paint]);

  // Bucle del juego.
  useEffect(() => {
    if (status !== 'playing') { setInvasionAmbient(null); return; }
    let frame = 0, last = performance.now(), soundAt = 0;
    const tick = (now: number) => {
      const g = gameRef.current, a = aim.current, G = gun.current, stage = stageRef.current;
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      step(g, dt);
      a.swayT += dt;
      a.kick = Math.max(0, a.kick - dt * 4);
      a.shake = Math.max(0, a.shake - dt * 2.2);
      a.flash = a.flash > 0 ? Math.max(0, a.flash - dt * 3) : Math.min(0, a.flash + dt * 2);
      a.zoom += (a.target - a.zoom) * Math.min(1, dt * 10);
      a.holding = keys.current.has('Shift');
      a.breath = a.holding ? Math.max(0, a.breath - dt) : Math.min(BREATH, a.breath + dt * 0.6);
      // Flechas (o A y D): la vista se mueve para los costados.
      const dir = (keys.current.has('ArrowRight') || keys.current.has('d') || keys.current.has('pad-right') ? 1 : 0) - (keys.current.has('ArrowLeft') || keys.current.has('a') || keys.current.has('pad-left') ? 1 : 0);
      cam.current.x += dir * PAN * dt;
      if (G.cycle > 0) G.cycle = Math.max(0, G.cycle - dt);
      if (G.reload > 0) { G.reload = Math.max(0, G.reload - dt); if (G.reload === 0) G.mag = MAG; }
      const p = stage ? target(stage.clientWidth, stage.clientHeight) : { x: 0, y: 0 };
      const near = (x: number, y: number) => Math.max(0, 1 - Math.hypot(x - p.x, y - p.y) / (600 / a.zoom));
      for (const e of takeEvents(g)) {
        if (e.type === 'kill') { playGooBlast(); playAlienDeath(0.45); if (e.head && !g.over) setToast({ text: `¡Tiro a la cabeza! ${g.kills} de ${GOAL_KILLS} 👽`, id: now }); }
        if (e.type === 'civilian') playCivilianHit();
        if (e.type === 'glass') playGlass(0.8);
        if (e.type === 'ufoPing') playRicochet();
        if (e.type === 'defused') playDefuse();
        if (e.type === 'explosion') { const k = near(e.x, e.y); playBlast(Math.max(0.15, k)); a.shake = Math.max(a.shake, 0.3 + k * 1.2); }
        if (e.type === 'bomb') { playRadioBeep(); setToast({ text: '📻 Radio: un alien dejó una bomba 💣 Buscá la caja con la luz roja y dispárale', id: now, bad: true }); }
        if (e.type === 'laser') playLaser(Math.max(0.2, near(e.x, e.y)));
        if (e.type === 'lighter') playLighter(near(e.x, e.y));
        if (e.type === 'ray') playRayGun(near(e.x, e.y));
        if (e.type === 'scream') playScream(near(e.x, e.y), 0.8 + Math.random() * 0.6);
        if (e.type === 'ufoArrive') { playUfoArrive(); setToast({ text: g.ufos.length === 1 ? '¡Llegaron los ovnis! Las balas no les hacen nada 🛸' : `¡Otro ovni! Ya son ${g.ufos.length} 🛸`, id: now, big: g.ufos.length === 1 }); }
        if (e.type === 'moreAliens') { playRadioBeep(); setToast({ text: `📻 Radio: hay más aliens en la ciudad (${e.count})`, id: now }); }
      }
      if (now - soundAt > 100) { soundAt = now; setInvasionAmbient(invasionLevels(g, p.x, p.y, a.zoom)); }
      paint();
      const shown = { time: Math.floor(g.time), kills: g.kills, lives: LIVES - g.civilians, mag: G.mag, reloading: G.reload > 0, breath: Math.round((a.breath / BREATH) * 10) / 10 };
      setHud(prev => JSON.stringify(prev) === JSON.stringify(shown) ? prev : shown);
      if (g.over) {
        const outcome = g.outcome ?? 'time', rec = readInvasionRecord(), won = outcome === 'won';
        const isNew = won ? rec.time === null || rec.time === undefined || g.time < rec.time : !rec.time && g.kills > rec.kills;
        const next: InvasionRecord = { kills: Math.max(rec.kills, g.kills), time: won ? Math.min(rec.time ?? Infinity, g.time) : rec.time ?? null };
        saveRecord(next); setRecord(next);
        const clues = [...new Set(g.killedAnomalies)].slice(-8).map(id => ANOMALIES[id].text);
        setResult({ outcome, kills: g.kills, time: g.time, headshots: g.headshots, shots: g.shots, hits: g.hits, defused: g.defused, newRecord: isNew, clues });
        setInvasionAmbient(null);
        if (won) playWinFanfare(); else playGameOver();
        setStatus('over');
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hide = () => { if (document.hidden) setStatus('paused'); };
    document.addEventListener('visibilitychange', hide);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', hide); };
  }, [status, paint, target]);

  // Mouse: la mira va adonde está el mouse, clic dispara y la ruedita hace zoom.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const move = (e: MouseEvent) => { const r = stage.getBoundingClientRect(); mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top }; if (statusRef.current !== 'playing') paint(); };
    const down = (e: MouseEvent) => { if (e.button === 0 && e.target === canvasRef.current) fire(); };
    const wheel = (e: WheelEvent) => { if (statusRef.current !== 'playing') return; e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.18 : 1 / 1.18); };
    stage.addEventListener('mousemove', move);
    stage.addEventListener('mousedown', down);
    stage.addEventListener('wheel', wheel, { passive: false });
    return () => { stage.removeEventListener('mousemove', move); stage.removeEventListener('mousedown', down); stage.removeEventListener('wheel', wheel); };
  }, [fire, zoomBy, paint]);

  // Teclado: ← → (o A y D) mueven la vista, Shift contiene la respiración, R recarga, + y − zoom, P pausa.
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
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [fire, reload, zoomBy]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; setInvasionAmbient(null); };
  }, []);

  // En el celular: arrastrando con el dedo se mueve la mira y un toque cortito dispara.
  const touch = {
    onPointerDown: (e: React.PointerEvent) => { if (e.pointerType !== 'mouse' && e.target === canvasRef.current) { e.preventDefault(); drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: 0, t: performance.now() }; } }, // sin el clic de mouse que el navegador simula después
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current, stage = stageRef.current; if (!d || d.id !== e.pointerId || !stage) return;
      const m = mouse.current, w = stage.clientWidth, h = stage.clientHeight;
      mouse.current = { x: Math.max(0, Math.min(w, (m.x < 0 ? w / 2 : m.x) + e.clientX - d.x)), y: Math.max(0, Math.min(h, (m.y < 0 ? h * 0.55 : m.y) + e.clientY - d.y)) };
      d.moved += Math.hypot(e.clientX - d.x, e.clientY - d.y); d.x = e.clientX; d.y = e.clientY;
    },
    onPointerUp: () => { const d = drag.current; drag.current = null; if (d && d.moved < 10 && performance.now() - d.t < 350) fire(); },
    onPointerCancel: () => { drag.current = null; },
  };
  // Botones ◀ ▶ del celular: mientras se mantienen apretados, la vista se mueve.
  const press = useCallback((key: string, on: boolean) => { if (on) keys.current.add(key); else keys.current.delete(key); }, []);
  const accuracy = result.shots ? Math.round((result.hits / result.shots) * 100) : 0;
  const recordText = record.time ? `🏆 ${formatInvasionTime(record.time)}` : `${record.kills} 👽`;

  return <section className="runner trepa invasion" aria-label="Invasión">
    <div className="runner-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1>Invasión</h1>
      <div className="runner-scores"><span>Récord <strong>{recordText}</strong></span></div>
      {(status === 'playing' || status === 'paused') && <button type="button" onClick={() => setStatus(s => s === 'playing' ? 'paused' : 'playing')}>{status === 'playing' ? 'Pausa' : 'Seguir'}</button>}
    </div>
    <div className="trepa-main">
      <div className="runner-stage inv-stage" ref={stageRef} {...touch}>
        <canvas ref={canvasRef} role="img" aria-label="La ciudad vista con la mira del rifle" />
        <canvas ref={mapRef} className="inv-map" aria-hidden="true" />
        <canvas ref={scopeRef} className="inv-scope" aria-hidden="true" />
        {status === 'playing' && <div className="inv-touch" aria-label="Moverse, zoom y recarga">
          <button type="button" aria-label="Mover la vista a la izquierda" onPointerDown={e => { e.preventDefault(); press('pad-left', true); }} onPointerUp={() => press('pad-left', false)} onPointerLeave={() => press('pad-left', false)} onPointerCancel={() => press('pad-left', false)} onContextMenu={e => e.preventDefault()}>◀</button>
          <button type="button" aria-label="Mover la vista a la derecha" onPointerDown={e => { e.preventDefault(); press('pad-right', true); }} onPointerUp={() => press('pad-right', false)} onPointerLeave={() => press('pad-right', false)} onPointerCancel={() => press('pad-right', false)} onContextMenu={e => e.preventDefault()}>▶</button>
          <button type="button" aria-label="Alejar la mira" onClick={() => zoomBy(1 / 1.35)}>−</button>
          <button type="button" aria-label="Acercar la mira" onClick={() => zoomBy(1.35)}>+</button>
          <button type="button" aria-label="Recargar el rifle" onClick={reload}>⟳</button>
        </div>}
        {status === 'playing' && toast && <div key={toast.id} className={`trepa-toast inv-toast${toast.bad ? ' is-bad' : ''}${toast.big ? ' is-big' : ''}`} role="status">{toast.text}</div>}
        {status !== 'playing' && <div className="runner-overlay" role="dialog" aria-labelledby="inv-message">
          <div className="inv-card">
            {status === 'ready' && <>
              <h2 id="inv-message" className="inv-title">Invasión 👽</h2>
              <p>Los aliens se metieron en la ciudad disfrazados de personas y quieren prenderla fuego. Sos francotirador: recorré la cuadra y mirá con la mira cada departamento, cada local y la vereda. <strong>Cada alien se ve como un alien gris solo 1 segundo cada 30</strong>, así que prestá atención a lo raro: gente que camina para atrás, que come plantas, que te mira fijo, que flota, que habla en símbolos… Hay más de 100 cosas raras distintas.</p>
              <p><strong>Eliminá a {GOAL_KILLS} aliens para ganar. Tenés {LIVES} vidas: cada persona a la que le disparás te saca una.</strong> Los aliens prenden fuego y dejan bombas en cajas (las que tienen una lucecita roja que titila y el reloj corriendo): si nadie les dispara, explotan y matan a los que están al lado. A los 5 minutos llegan ovnis a los que las balas no les hacen nada, y a los 10 minutos la ciudad cae.</p>
              <p className="runner-keys"><kbd>←</kbd> <kbd>→</kbd> moverse por la cuadra · <kbd>Mouse</kbd> apuntar · <kbd>Clic</kbd> disparar · <kbd>Ruedita</kbd> zoom · <kbd>Shift</kbd> contener la respiración · <kbd>R</kbd> recargar · <kbd>P</kbd> pausa</p>
              <button type="button" onClick={start} autoFocus>Jugar</button>
            </>}
            {status === 'paused' && <>
              <h2 id="inv-message">Pausa</h2>
              <button type="button" onClick={() => setStatus('playing')} autoFocus>Seguir</button>
            </>}
            {status === 'over' && <>
              <EndBanner win={result.outcome === 'won'} id="inv-message" />
              <p className="end-reason" data-testid="inv-outcome">{OUTCOME_TEXT[result.outcome]}</p>
              <p>{result.outcome === 'won' ? <>Lo lograste en <strong>{formatInvasionTime(result.time)}</strong>.</> : <>Eliminaste <strong data-testid="inv-final">{result.kills}</strong> de {GOAL_KILLS} aliens.</>}{result.newRecord && ' ¡Nuevo récord!'}</p>
              <p>{result.headshots} tiros a la cabeza · {result.defused} bombas desactivadas · {accuracy}% de puntería</p>
              {result.clues.length > 0 && <div className="inv-clues"><p><strong>Lo raro que hacían los aliens que eliminaste:</strong></p><ul>{result.clues.map(c => <li key={c}>{c}</li>)}</ul></div>}
              <button type="button" onClick={start} autoFocus>Jugar de nuevo</button>
            </>}
          </div>
        </div>}
      </div>
      <aside className="trepa-side inv-side" aria-label="Tiempo, aliens, vidas, balas y respiración">
        <div className="trepa-stat"><span>Tiempo</span><strong data-testid="inv-time">{formatInvasionTime(hud.time)}</strong></div>
        <div className="trepa-stat inv-kills"><span>Aliens</span><strong data-testid="inv-kills">{hud.kills} / {GOAL_KILLS}</strong></div>
        <div className="trepa-stat inv-lives"><span>Vidas</span><strong data-testid="inv-lives" aria-label={`${hud.lives} vidas`}>{Array.from({ length: LIVES }, (_, i) => <i key={i} className={i < hud.lives ? 'is-full' : ''}>{i < hud.lives ? '❤️' : '🖤'}</i>)}</strong></div>
        <div className="trepa-stat"><span>Récord</span><strong>{recordText}</strong></div>
        <div className="trepa-stat inv-ammo"><span>{hud.reloading ? 'Recargando…' : 'Balas'}</span><strong data-testid="inv-ammo" aria-label={`${hud.mag} balas`}>{Array.from({ length: MAG }, (_, i) => <i key={i} className={i < hud.mag && !hud.reloading ? 'is-full' : ''} />)}</strong></div>
        <div className="trepa-stat"><span>Respiración</span><strong className="inv-breath"><i style={{ width: `${hud.breath * 100}%` }} /></strong></div>
      </aside>
    </div>
  </section>;
}
