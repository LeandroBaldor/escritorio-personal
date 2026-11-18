import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TouchGrips } from './TouchGrips';
import { fitScale, pixelRatio, useFitScreen } from './fitScreen';
import { Link } from 'react-router-dom';
import { ALIEN_POINTS, aliveAliens, aliveHumans, BAZOOKA_RADIUS, CITY_TOP, GAME_SECONDS, newInvasion, shoot, step, takeEvents, WEAPONS, type Invasion as Game, type Outcome, type Weapon } from './invasion';
import { ANOMALIES } from './invasionAnomalies';
import { drawMinimap, paintCity, type View } from './invasionArt';
import { invasionLevels } from './invasionSound';
import {
  playAlienComm, playAlienDeath, playAlienTalk, playBlast, playBolt, playCivilianHit, playDefuse, playEmpty, playGameOver, playGlass, playGooBlast, playLaser, playLighter, playRadioBeep, playRayGun, playReload,
  playRicochet, playRifleShot, playScream, playStart, playThunder, playUfoArrive, playWinFanfare, preloadInvasionSounds, setInvasionAmbient,
} from './sounds';
import { EndBanner } from './EndBanner';
import rifleArt from './assets/invasion-rifle.png';
import machineArt from './assets/invasion-ametralladora.png';
import bazookaArt from './assets/invasion-bazooka.png';

const RECORD_KEY = 'escritorio-personal-juegos:invasion-record';
// El récord se sigue guardando por cantidad de bajas para conservar los datos de partidas anteriores.
export interface InvasionRecord { kills: number; time?: number | null }
export const readInvasionRecord = (): InvasionRecord => { try { const v = JSON.parse(localStorage.getItem(RECORD_KEY) ?? 'null'); return v && typeof v.kills === 'number' ? v : { kills: 0, time: null }; } catch { return { kills: 0, time: null }; } };
const saveRecord = (value: InvasionRecord) => { try { localStorage.setItem(RECORD_KEY, JSON.stringify(value)); } catch { /* sin almacenamiento */ } };
export const formatInvasionTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

type Status = 'ready' | 'playing' | 'armory' | 'paused' | 'over';
const START_ZOOM: number = WEAPONS.rifle.start;
const weaponKeys: readonly Weapon[] = ['rifle', 'machine', 'bazooka'];
const weaponArt: Record<Weapon, { image: string; role: string }> = {
  rifle: { image: rifleArt, role: 'Zoom de largo alcance' },
  machine: { image: machineArt, role: 'Fuego automático' },
  bazooka: { image: bazookaArt, role: 'Explosión de área · Anti-OVNI' },
};
function createArsenal() {
  const load = (weapon: Weapon) => ({ mag: Number(WEAPONS[weapon].mag), cycle: 0, reload: 0 });
  return { rifle: load('rifle'), machine: load('machine'), bazooka: load('bazooka') };
}
const BREATH = 4; // segundos que se puede contener la respiración (Shift)
const PAN = 26; // lo que se mueve la vista con las flechas (unidades por segundo)
const TOUCH_SPEED = 1.35; // en el celular la mira se mueve un poco más que el dedo (se llega a todos lados sin soltar)
const EDGE = 0.1; // con la mira en el último 10 % de cada costado, la vista se corre sola
// Lo que entra de alto en el fondo: de la calle a lo más alto de los edificios (la ciudad ocupa casi toda la pantalla).
const FLOOR_Y = -3.4, TOP_Y = CITY_TOP;

const OUTCOME_TEXT: Record<Outcome, string> = {
  won: 'La ciudad resistió. Quedan más humanos que aliens.',
  time: 'La invasión ganó. Los humanos perdieron la mayoría.',
};

// La mira: el círculo que agranda lo que hay abajo, con su aro, la sombra del borde, un brillo, la retícula
// (líneas finas en el medio y gruesas afuera, con puntos para medir) y el punto rojo del centro.
function drawScope(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, zoom: number, t: number, kick: number, weapon: Weapon) {
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
  if (weapon === 'rifle') {
    ctx.fillStyle = 'rgba(5,5,5,0.92)';
    ctx.fillRect(cx - R, cy - thick / 2, R - gap, thick); ctx.fillRect(cx + gap, cy - thick / 2, R - gap, thick);
    ctx.fillRect(cx - thick / 2, cy + gap, thick, R - gap); ctx.fillRect(cx - thick / 2, cy - R, thick, R - gap);
    ctx.fillRect(cx - gap, cy - thin / 2, gap * 2, thin); ctx.fillRect(cx - thin / 2, cy - gap, thin, gap * 2);
    for (let i = 1; i <= 4; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.arc(cx + dx * i * gap / 5, cy + dy * i * gap / 5, Math.max(1.4, R * 0.008), 0, Math.PI * 2); ctx.fill(); }
    for (let i = 1; i <= 3; i++) ctx.fillRect(cx - R * 0.02 * (4 - i), cy + gap * (0.25 + i * 0.18), R * 0.04 * (4 - i), thin);
  } else {
    const radius = weapon === 'bazooka' ? BAZOOKA_RADIUS * zoom : R * 0.16;
    ctx.strokeStyle = weapon === 'bazooka' ? '#fed18c' : '#e1f0ed';
    ctx.lineWidth = 1.5;
    if (radius < R * 0.92) {
      if (weapon === 'bazooka') ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const d of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(cx + d * 8, cy); ctx.lineTo(cx + d * 18, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy + d * 8); ctx.lineTo(cx, cy + d * 18); ctx.stroke();
    }
  }
  ctx.fillStyle = `rgba(239,68,68,${0.85 + Math.sin(t * 3) * 0.1})`; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.arc(cx, cy, Math.max(1.8, R * 0.01), 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(134,239,172,0.9)'; ctx.font = `800 ${Math.max(11, R * 0.06)}px ui-monospace, monospace`; ctx.textAlign = 'center';
  ctx.fillText(`×${(zoom / 10).toFixed(1)}`, cx + R * 0.7, cy - R * 0.72);
  if (kick > 0.6) { ctx.fillStyle = `rgba(255,220,150,${(kick - 0.6) * 0.5})`; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

export function Invasion() {
  const fit = useFitScreen(); // celulares y tablets en horizontal: igual que en la computadora, más chico
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef({ canvas: typeof document === 'undefined' ? null as unknown as HTMLCanvasElement : document.createElement('canvas'), x: NaN, s: 0, at: 0 });
  const [firstGame] = useState(() => newInvasion());
  const gameRef = useRef<Game>(firstGame);
  // `cam`: dónde está la vista (se mueve con las flechas). `mouse`: dónde está la mira en la pantalla.
  const cam = useRef({ x: 60 });
  const mouse = useRef({ x: -1, y: -1 });
  const aim = useRef({ zoom: START_ZOOM, target: START_ZOOM, kick: 0, breath: BREATH, holding: false, swayT: 0, shake: 0, flash: 0 });
  const arsenal = useRef(createArsenal());
  const selected = useRef<Weapon>('rifle');
  const trigger = useRef(false);
  const [weapon, setWeapon] = useState<Weapon>('rifle');
  const drag = useRef<{ x: number; y: number; id: number; moved: number; t: number } | null>(null);
  const fingers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; zoom: number } | null>(null);
  const keys = useRef(new Set<string>());
  const [status, setStatus] = useState<Status>('ready');
  const [hud, setHud] = useState(() => ({ time: GAME_SECONDS, kills: 0, humans: aliveHumans(firstGame), aliens: aliveAliens(firstGame), mag: Number(WEAPONS.rifle.mag), reloading: false }));
  const [record, setRecord] = useState(readInvasionRecord);
  const [result, setResult] = useState({ outcome: 'time' as Outcome, kills: 0, time: 0, headshots: 0, shots: 0, hits: 0, defused: 0, newRecord: false, clues: [] as string[] });
  const [toast, setToast] = useState<{ text: string; id: number; big?: boolean; bad?: boolean } | null>(null);
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
    if (status !== 'playing') { trigger.current = false; keys.current.clear(); }
  }, [status]);
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
    const touch = !!window.matchMedia?.('(pointer: coarse)').matches; // celulares y tablets: menos píxeles
    const dpr = pixelRatio(touch ? 1.5 : 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = `${w}px`; canvas.style.height = `${h}px`; }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const a = aim.current, b = baseView(w, h), p = target(w, h), R = scopeRadius(w, h);
    // Toda la cuadra de fondo, más oscura. Se arma en una imagen más ancha que la pantalla (un margen a cada lado):
    // al mover la vista solo se corre la imagen, y se vuelve a armar cuando se acaba el margen o cada tanto (la
    // gente de fondo se mueve). En celulares, a menos resolución y menos seguido: es lo que más tarda y está
    // oscuro detrás de la mira, así la mira anda fluida.
    const aiming = !!drag.current || fingers.current.size > 0; // con el dedo apuntando no se rearma el fondo (salvo que haga falta): la mira no pega tirones
    const bg = bgRef.current, now = performance.now(), M = 0.3, W = w * (1 + 2 * M);
    const bs = touch ? 0.55 : 1, bw = Math.round(W * dpr * bs), bh = Math.round(h * dpr * bs);
    if (bg.canvas.width !== bw || bg.canvas.height !== bh || bg.s !== b.s || Math.abs(bg.x - b.cx) * b.s > M * w * 0.85 || now - bg.at > (!touch ? 120 : aiming ? 3000 : 450)) {
      if (bg.canvas.width !== bw || bg.canvas.height !== bh) { bg.canvas.width = bw; bg.canvas.height = bh; }
      const bctx = bg.canvas.getContext('2d');
      if (bctx) { bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.clearRect(0, 0, bw, bh); bctx.setTransform(dpr * bs, 0, 0, dpr * bs, 0, 0); paintCity(bctx, g, { ...b, w: W, t: g.time, dpr }, 10); bctx.fillStyle = 'rgba(2,8,4,0.3)'; bctx.fillRect(0, 0, W, h); }
      bg.x = b.cx; bg.s = b.s; bg.at = now;
    }
    const off = ((bg.x - b.cx) * b.s - M * w) * dpr; // dónde cae la imagen según cuánto se movió la vista
    // Cuando explota un alien (o una bomba cerca) tiembla todo.
    const shake = a.shake > 0 ? [Math.sin(g.time * 90) * a.shake * 14, Math.cos(g.time * 77) * a.shake * 10] : [0, 0];
    ctx.setTransform(1, 0, 0, 1, shake[0] * dpr, shake[1] * dpr); ctx.drawImage(bg.canvas, off, 0, W * dpr, canvas.height); ctx.setTransform(dpr, 0, 0, dpr, shake[0] * dpr, shake[1] * dpr);
    // La mira solo se ve jugando: con el cartel abierto (inicio, pausa o fin) se usa la flecha del mouse
    // normal, que pasa por delante del cartel y deja ver bien el botón.
    if (statusRef.current === 'playing') {
      ctx.save();
      ctx.beginPath(); ctx.arc(p.mx, p.my, R, 0, Math.PI * 2); ctx.clip();
      ctx.translate(p.mx - R, p.my - R);
      paintCity(ctx, g, { w: R * 2, h: R * 2, s: a.zoom, cx: p.x, cy: p.y, t: g.time, dpr }, touch ? 2 : 6); // (en celulares arma de a pocas habitaciones nuevas por cuadro)
      ctx.restore();
      drawScope(ctx, p.mx, p.my, R, a.zoom, g.time, a.kick, selected.current);
    }
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

  const setZoom = useCallback((z: number) => {
    const a = aim.current, stage = stageRef.current, min = stage ? stage.clientHeight / (TOP_Y - FLOOR_Y) * 2 : 20;
    a.target = Math.min(WEAPONS[selected.current].zoom, Math.max(min, z));
  }, []);
  const zoomBy = useCallback((factor: number) => setZoom(aim.current.target * factor), [setZoom]);
  const selectWeapon = useCallback((next: Weapon) => {
    const current = statusRef.current;
    if (current !== 'playing' && current !== 'armory') return;
    if (next !== selected.current) {
      selected.current = next;
      setWeapon(next);
      setZoom(WEAPONS[next].start);
    }
    if (current === 'armory') setStatus('playing');
  }, [setZoom]);

  const fire = useCallback(() => {
    if (statusRef.current !== 'playing') return;
    const g = gameRef.current, current = selected.current, G = arsenal.current[current], config = WEAPONS[current], stage = stageRef.current;
    if (!stage || g.over || G.reload > 0 || G.cycle > 0) return;
    if (G.mag <= 0) { playEmpty(); G.reload = config.reload; playReload(); return; }
    const p = target(stage.clientWidth, stage.clientHeight);
    G.mag--;
    aim.current.kick = current === 'machine' ? 0.33 : 1;
    if (current !== 'bazooka') playRifleShot();
    const hit = shoot(g, p.x, p.y, current);
    if (hit === 'alien' || hit === 'ufoDestroyed' || hit === 'blast') { aim.current.shake = 1; aim.current.flash = 1; }
    if (hit === 'ufoDestroyed') setToast({ text: 'OVNI derribado', id: performance.now() });
    if (hit === 'civilian') { aim.current.flash = -1; setToast({ text: 'Baja civil', id: performance.now(), bad: true }); }
    if (hit === 'defused') setToast({ text: 'Bomba desactivada', id: performance.now() });
    if (hit === 'ufo') setToast({ text: 'Usá la bazooka para derribar el OVNI', id: performance.now() });
    if (G.mag > 0) { G.cycle = config.cycle; if (current === 'rifle') playBolt(); }
    else { G.reload = config.reload; playReload(); }
  }, [target]);

  const reload = useCallback(() => {
    const G = arsenal.current[selected.current], config = WEAPONS[selected.current];
    if (G.reload > 0 || G.mag === config.mag || statusRef.current !== 'playing') return;
    G.reload = config.reload;
    playReload();
  }, []);

  const start = useCallback(() => {
    playStart(); preloadInvasionSounds();
    gameRef.current = newInvasion();
    const g = gameRef.current;
    cam.current.x = g.width * (0.3 + Math.random() * 0.4);
    Object.assign(aim.current, { zoom: START_ZOOM, target: START_ZOOM, kick: 0, breath: BREATH, holding: false, swayT: 0, shake: 0, flash: 0 });
    arsenal.current = createArsenal();
    selected.current = 'rifle';
    trigger.current = false;
    setWeapon('rifle');
    setHud({ time: GAME_SECONDS, kills: 0, humans: aliveHumans(g), aliens: aliveAliens(g), mag: WEAPONS.rifle.mag, reloading: false });
    setToast({ text: 'Protegé a la población durante diez minutos.', id: performance.now(), big: true });
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

  // Al abrirse un cartel (pausa o fin) se vuelve a dibujar sin la mira.
  useEffect(() => { if (status !== 'playing') paint(); }, [status, paint]);

  // Bucle del juego.
  useEffect(() => {
    if (status !== 'playing') { setInvasionAmbient(null); return; }
    let frame = 0, last = performance.now(), soundAt = 0, talkAt = 0;
    const tick = (now: number) => {
      const g = gameRef.current, a = aim.current, G = arsenal.current[selected.current], stage = stageRef.current;
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
      if (drag.current && stage) { // celular: la mira contra un costado corre la vista para ese lado (más rápido cuanto más al borde)
        const w = stage.clientWidth, mx = mouse.current.x / w;
        if (mx < EDGE) cam.current.x -= PAN * 1.4 * (1 - mx / EDGE) * dt; else if (mx > 1 - EDGE) cam.current.x += PAN * 1.4 * (1 - (1 - mx) / EDGE) * dt;
      }
      for (const id of weaponKeys) {
        const state = arsenal.current[id];
        state.cycle = Math.max(0, state.cycle - dt);
        if (state.reload > 0) {
          state.reload = Math.max(0, state.reload - dt);
          if (state.reload === 0) state.mag = WEAPONS[id].mag;
        }
      }
      if (selected.current === 'machine' && trigger.current) fire();
      const p = stage ? target(stage.clientWidth, stage.clientHeight) : { x: 0, y: 0 };
      g.aim.x = p.x; g.aim.y = p.y; // los aliens se dan cuenta de dónde está la mira
      const near = (x: number, y: number) => Math.max(0, 1 - Math.hypot(x - p.x, y - p.y) / (600 / a.zoom));
      for (const e of takeEvents(g)) {
        if (e.type === 'kill') { playGooBlast(); playAlienDeath(0.45); }
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
        if (e.type === 'ufoArrive') { playUfoArrive(); setToast({ text: g.ufos.length === 1 ? 'Entraron los OVNIs. Usá la bazooka.' : `¡Otro ovni! Ya son ${g.ufos.length} 🛸`, id: now, big: g.ufos.length === 1 }); }
        if (e.type === 'comm') { playAlienComm(near(e.x, e.y) * 0.6); playAlienTalk(near(e.x, e.y)); }
        if (e.type === 'thunder') { playThunder(Math.max(0.35, 1 - Math.abs(e.x - p.x) / 120)); a.shake = Math.max(a.shake, 0.25); }
        if (e.type === 'rain') setToast({ text: '🌧️ Se largó una tormenta: llueve y hay relámpagos', id: now, big: true });
        if (e.type === 'moreAliens') { playRadioBeep(); setToast({ text: `📻 Radio: hay más aliens en la ciudad (${e.count})`, id: now }); }
      }
      if (now - soundAt > 100) { soundAt = now; setInvasionAmbient(invasionLevels(g, p.x, p.y, a.zoom)); }
      // Cada tanto habla (en su idioma) el alien más cercano a la mira: si escuchás esa voz, hay uno cerca.
      if (now > talkAt) {
        const radius = Math.max(3, Math.min(12, 420 / a.zoom));
        let best: { d: number; who: Game['people'][number] } | null = null;
        for (const o of g.people) { if (!o.alien || o.dead || o.gone) continue; const d = Math.hypot(o.x - p.x, (o.y + 0.8 - p.y) * 1.3); if (d < radius && (!best || d < best.d)) best = { d, who: o }; }
        if (best) { playAlienTalk(1 - best.d / radius); best.who.talk = 1.6; talkAt = now + 2500 + Math.random() * 3500; } else talkAt = now + 800;
      }
      paint();
      const shown = { time: Math.ceil(GAME_SECONDS - g.time), kills: g.kills, humans: aliveHumans(g), aliens: aliveAliens(g), mag: G.mag, reloading: G.reload > 0 };
      setHud(prev => JSON.stringify(prev) === JSON.stringify(shown) ? prev : shown);
      if (g.over) {
        const outcome = g.outcome ?? 'time', rec = readInvasionRecord(), won = outcome === 'won';
        const isNew = g.kills > rec.kills;
        const next: InvasionRecord = { kills: Math.max(rec.kills, g.kills) };
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
  }, [status, paint, target, fire]);

  // Mouse: la mira va adonde está el mouse, clic dispara y la ruedita hace zoom.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const move = (e: MouseEvent) => { const r = stage.getBoundingClientRect(); const k = fitScale(); mouse.current = { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k }; if (statusRef.current !== 'playing') paint(); };
    const down = (e: MouseEvent) => { if (e.button === 0 && e.target === canvasRef.current) { trigger.current = true; fire(); } };
    const up = () => { trigger.current = false; };
    window.addEventListener('mouseup', up);
    window.addEventListener('blur', up);
    const wheel = (e: WheelEvent) => { if (statusRef.current !== 'playing') return; e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.18 : 1 / 1.18); };
    stage.addEventListener('mousemove', move);
    stage.addEventListener('mousedown', down);
    stage.addEventListener('wheel', wheel, { passive: false });
    return () => { window.removeEventListener('mouseup', up); window.removeEventListener('blur', up); up(); stage.removeEventListener('mousemove', move); stage.removeEventListener('mousedown', down); stage.removeEventListener('wheel', wheel); };
  }, [fire, zoomBy, paint]);

  // Teclado: ← → (o A y D) mueven la vista, Shift contiene la respiración, R recarga, + y − zoom, P pausa.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const current = statusRef.current;
      if ((e.code === 'Space' || e.key === ' ') && (current === 'playing' || current === 'armory')) {
        e.preventDefault();
        if (!e.repeat) setStatus(current === 'playing' ? 'armory' : 'playing');
        return;
      }
      if (e.key === 'Escape' && current === 'armory') { setStatus('playing'); return; }
      if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && (current === 'playing' || current === 'paused')) { setStatus(s => s === 'playing' ? 'paused' : 'playing'); return; }
      if ((current === 'playing' || current === 'armory') && /^[123]$/.test(e.key)) {
        selectWeapon(weaponKeys[Number(e.key) - 1]);
        return;
      }
      if (current !== 'playing') return;
      if (e.key === 'r' || e.key === 'R') reload();
      if (e.key === '+' || e.key === '=') zoomBy(1.3);
      if (e.key === '-') zoomBy(1 / 1.3);
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); fire(); }
      if (e.key.startsWith('Arrow')) e.preventDefault();
      keys.current.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [fire, reload, selectWeapon, zoomBy]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; setInvasionAmbient(null); };
  }, []);

  // En el celular: arrastrando con el dedo se mueve la mira (si llega al borde, la vista se corre sola para ese
  // lado), un toque cortito dispara y con dos dedos se hace zoom: estirando se acerca, cerrando se aleja.
  const spread = () => { const [p1, p2] = [...fingers.current.values()]; return Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1; };
  const touch = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' || e.target !== canvasRef.current) return;
      e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); // sin el clic de mouse que el navegador simula
      fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (fingers.current.size >= 2) { drag.current = null; pinch.current = { d: spread(), zoom: aim.current.target }; return; } // dos dedos: zoom (y ese toque ya no dispara)
      if (!pinch.current) drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: 0, t: performance.now() };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const f = fingers.current.get(e.pointerId); if (!f) return;
      f.x = e.clientX; f.y = e.clientY;
      const pz = pinch.current;
      if (pz && fingers.current.size >= 2) { setZoom(pz.zoom * spread() / pz.d); aim.current.zoom = aim.current.target; return; } // sigue a los dedos sin demora
      const d = drag.current, stage = stageRef.current; if (!d || d.id !== e.pointerId || !stage) return;
      const m = mouse.current, w = stage.clientWidth, h = stage.clientHeight, k = fitScale() / TOUCH_SPEED;
      mouse.current = { x: Math.max(0, Math.min(w, (m.x < 0 ? w / 2 : m.x) + (e.clientX - d.x) / k)), y: Math.max(0, Math.min(h, (m.y < 0 ? h * 0.55 : m.y) + (e.clientY - d.y) / k)) };
      d.moved += Math.hypot(e.clientX - d.x, e.clientY - d.y); d.x = e.clientX; d.y = e.clientY;
    },
    onPointerUp: (e: React.PointerEvent) => {
      fingers.current.delete(e.pointerId);
      if (pinch.current) { if (!fingers.current.size) pinch.current = null; return; }
      const d = drag.current; drag.current = null; if (d && d.id === e.pointerId && d.moved < 10 && performance.now() - d.t < 350) fire();
    },
    onPointerCancel: (e: React.PointerEvent) => { fingers.current.delete(e.pointerId); if (!fingers.current.size) pinch.current = null; drag.current = null; },
  };
  // Botones ◀ ▶ del celular: mientras se mantienen apretados, la vista se mueve.
  const press = useCallback((key: string, on: boolean) => { if (on) keys.current.add(key); else keys.current.delete(key); }, []);
  const accuracy = result.shots ? Math.round((result.hits / result.shots) * 100) : 0;
  const recordText = `${record.kills * ALIEN_POINTS} pts`;

  return <section className="runner trepa invasion" style={fit} aria-label="Invasión">
    <TouchGrips actionLabel={'Disparar'} />
    <div className="runner-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1>Invasión</h1>
      <div className="runner-scores"><span>Récord <strong>{recordText}</strong></span></div>
      {(status === 'playing' || status === 'paused') && <button type="button" onClick={() => setStatus(s => s === 'playing' ? 'paused' : 'playing')}>{status === 'playing' ? 'Pausa' : 'Seguir'}</button>}
    </div>
    <div className="trepa-main">
      <div className="runner-stage inv-stage" ref={stageRef} {...touch}>
        <canvas ref={canvasRef} role="img" aria-label="La ciudad vista desde el puesto de defensa" />
        <canvas ref={mapRef} className="inv-map" aria-hidden="true" />
        {status === 'playing' && <div className="inv-touch" aria-label="Moverse, zoom y recarga">
          <button type="button" aria-label="Mover la vista a la izquierda" onPointerDown={e => { e.preventDefault(); press('pad-left', true); }} onPointerUp={() => press('pad-left', false)} onPointerLeave={() => press('pad-left', false)} onPointerCancel={() => press('pad-left', false)} onContextMenu={e => e.preventDefault()}>◀</button>
          <button type="button" aria-label="Mover la vista a la derecha" onPointerDown={e => { e.preventDefault(); press('pad-right', true); }} onPointerUp={() => press('pad-right', false)} onPointerLeave={() => press('pad-right', false)} onPointerCancel={() => press('pad-right', false)} onContextMenu={e => e.preventDefault()}>▶</button>
          <button type="button" aria-label="Alejar la mira" onClick={() => zoomBy(1 / 1.35)}>−</button>
          <button type="button" aria-label="Acercar la mira" onClick={() => zoomBy(1.35)}>+</button>
          <button type="button" aria-label="Recargar el arma" onClick={reload}>⟳</button>
        </div>}
        {status === 'playing' && toast && <div key={toast.id} className={`trepa-toast inv-toast${toast.bad ? ' is-bad' : ''}${toast.big ? ' is-big' : ''}`} role="status">{toast.text}</div>}
        {status !== 'playing' && <div className="runner-overlay" role="dialog" aria-labelledby="inv-message">
          <div className={`inv-card${status === 'ready' ? ' inv-command' : status === 'armory' ? ' inv-armory' : ''}`}>
            {status === 'ready' && <>
              <h2 id="inv-message" className="inv-title">Invasión</h2>
              <p className="inv-mission">Defendé la ciudad durante 10 minutos. La población humana debe superar a los alienígenas.</p>
              <dl className="inv-controls">
                <div><dt><kbd>Espacio</kbd></dt><dd>Abrir arsenal</dd></div>
                <div><dt><kbd>Clic</kbd> <kbd>Enter</kbd></dt><dd>Disparar</dd></div>
                <div><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>Mover la vista</dd></div>
                <div><dt><kbd>Ruedita</kbd></dt><dd>Zoom</dd></div>
                <div><dt><kbd>R</kbd></dt><dd>Recargar</dd></div>
                <div><dt><kbd>P</kbd></dt><dd>Pausa</dd></div>
              </dl>
              <button type="button" onClick={start} autoFocus>Jugar</button>
            </>}
            {status === 'armory' && <>
              <h2 id="inv-message">Seleccioná un arma</h2>
              <div className="inv-weapon-grid">
                {weaponKeys.map((id, i) => <button key={id} type="button" className="inv-weapon-card" aria-pressed={weapon === id} autoFocus={i === 0} onClick={() => selectWeapon(id)}>
                  <kbd>{i + 1}</kbd>
                  <img src={weaponArt[id].image} alt="" draggable={false} />
                  <strong>{WEAPONS[id].name}</strong>
                  <span>{weaponArt[id].role}</span>
                </button>)}
              </div>
              <button type="button" className="inv-armory-back" onClick={() => setStatus('playing')}>Volver a la partida</button>
            </>}
            {status === 'paused' && <>
              <h2 id="inv-message">Pausa</h2>
              <button type="button" onClick={() => setStatus('playing')} autoFocus>Seguir</button>
            </>}
            {status === 'over' && <>
              <EndBanner win={result.outcome === 'won'} id="inv-message" />
              <p className="end-reason" data-testid="inv-outcome">{OUTCOME_TEXT[result.outcome]}</p>
              <p><strong data-testid="inv-final">{result.kills * ALIEN_POINTS} puntos</strong> ? {result.kills} aliens eliminados ? {hud.humans} humanos y {hud.aliens} aliens en pie.{result.newRecord && ' Nuevo récord.'}</p>
              <p>{result.headshots} tiros a la cabeza · {result.defused} bombas desactivadas · {accuracy}% de puntería</p>
              {result.clues.length > 0 && <div className="inv-clues"><p><strong>Lo raro que hacían los aliens que eliminaste:</strong></p><ul>{result.clues.map(c => <li key={c}>{c}</li>)}</ul></div>}
              <button type="button" onClick={start} autoFocus>Jugar de nuevo</button>
            </>}
          </div>
        </div>}
      </div>
      <aside className="trepa-side inv-side" aria-label="Marcador y armamento">
        <div className="trepa-stat"><span>Tiempo restante</span><strong data-testid="inv-time">{formatInvasionTime(hud.time)}</strong></div>
        <div className="trepa-stat"><span>Humanos</span><strong data-testid="inv-humans">{hud.humans}</strong></div>
        <div className="trepa-stat inv-kills"><span>Aliens</span><strong data-testid="inv-aliens">{hud.aliens}</strong></div>
        <div className="trepa-stat"><span>Puntos</span><strong data-testid="inv-score">{hud.kills * ALIEN_POINTS}</strong></div>
        <button type="button" className="inv-armory-toggle" aria-haspopup="dialog" disabled={status !== 'playing'} onClick={() => setStatus('armory')}>Arsenal <span>{WEAPONS[weapon].name}</span></button>
        <div className="trepa-stat"><span>{hud.reloading ? 'Recargando' : 'Munición'}</span><strong data-testid="inv-ammo">{hud.mag} / {WEAPONS[weapon].mag}</strong></div>
        {status === 'playing' && <button type="button" className="inv-fire" onPointerDown={e => { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); trigger.current = true; fire(); }} onLostPointerCapture={() => { trigger.current = false; }} onClick={e => { if (e.detail === 0) fire(); }}>Disparar</button>}
      </aside>
    </div>
  </section>;
}
