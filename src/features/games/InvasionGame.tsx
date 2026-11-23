import { preloadGray } from './invasionGray';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TouchGrips } from './TouchGrips';
import { fitScale, pixelRatio, useFitScreen } from './fitScreen';
import { Link } from 'react-router-dom';
import { ALIEN_KINDS, ALIEN_POINTS, DEFUSE_POINTS, HUMAN_PENALTY, UFO_KILLS, ALIEN_TOTAL, aliveAliens, aliveHumans, CITY_TOP, GAME_SECONDS, HUMAN_TOTAL, newInvasion, shoot, step, takeEvents, WEAPONS, type Invasion as Game, type Outcome, type Weapon } from './invasion';
import { ANOMALIES } from './invasionAnomalies';
import { isWoman } from './invasionPeople';
import { drawMinimap, drawRockets, paintCity, type View } from './invasionArt';
import { invasionLevels } from './invasionSound';
import {
  playAlienComm, playAlienDeath, playAlienVoice, ALIEN_VOICE_SECONDS, playBazookaBoom, playBazookaShot, playBlast, playBolt, playDefuse, playEmpty, playGameOver, playGlass, playGooBlast, playLaser, playLighter, playMachineShot, playRayGun, playReload,
  playHumanScream, playRicochet, playRifleShot, playStart, playThunder, playUfoArrive, playWinFanfare, preloadInvasionSounds, setInvasionAmbient,
} from './sounds';
import { EndBanner } from './EndBanner';
import rifleArt from './assets/invasion/armas/menu-rifle.webp';
import machineArt from './assets/invasion/armas/menu-ametralladora.webp';
import bazookaArt from './assets/invasion/armas/menu-bazooka.webp';
import { drawCross, drawHeldWeapon, drawScopeView, hasScope, preloadWeapons, shotFx } from './invasionWeapons';

const RECORD_KEY = 'escritorio-personal-juegos:invasion-record';
// El récord se sigue guardando por cantidad de bajas para conservar los datos de partidas anteriores.
export interface InvasionRecord { kills: number; points?: number; time?: number | null }
// Puntos del récord (los récords viejos, sin `points`, valían 100 por alien).
export const invasionRecordPoints = (r: InvasionRecord) => r.points ?? r.kills * ALIEN_POINTS;
export const readInvasionRecord = (): InvasionRecord => { try { const v = JSON.parse(localStorage.getItem(RECORD_KEY) ?? 'null'); return v && typeof v.kills === 'number' ? v : { kills: 0, time: null }; } catch { return { kills: 0, time: null }; } };
const saveRecord = (value: InvasionRecord) => { try { localStorage.setItem(RECORD_KEY, JSON.stringify(value)); } catch { /* sin almacenamiento */ } };
export const formatInvasionTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// En el panel, las especies de la que más vale a la que menos.
const SPECIES_ORDER = ALIEN_KINDS.map((_, i) => i).sort((a, b) => ALIEN_KINDS[b].points - ALIEN_KINDS[a].points);
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
const EDGE = 0.07; // franja de cada costado (fracción del ancho) donde el mouse suelto corre el escenario
const TOUCH_SPEED = 1.35; // en el celular el escenario se corre un poco más que el dedo (se llega a todos lados sin soltar)
// Lo que entra de alto en el fondo: de la calle a lo más alto de los edificios (la ciudad ocupa casi toda la pantalla).
const FLOOR_Y = -3.4, TOP_Y = CITY_TOP;
const HIP_SPREAD = { rifle: 2.6, machine: 3.2 }; // radio (m) en que cae el tiro sin la mira

const OUTCOME_TEXT: Record<Outcome, string> = {
  won: 'La ciudad resistió. Quedan más humanos que aliens.',
  time: 'La invasión ganó. Los humanos perdieron la mayoría.',
};

export function Invasion() {
  const fit = useFitScreen(); // celulares y tablets en horizontal: igual que en la computadora, más chico
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef({ canvas: typeof document === 'undefined' ? null as unknown as HTMLCanvasElement : document.createElement('canvas'), x: NaN, y: NaN, s: 0, at: 0 });
  const [firstGame] = useState(() => newInvasion());
  const gameRef = useRef<Game>(firstGame);
  // `cam`: dónde está la vista (se mueve con las flechas). `mouse`: dónde está la mira en la pantalla.
  const cam = useRef({ x: 60, y: (CITY_TOP + -3.4) / 2, lagX: 0, lagY: 0 }); // lag: cuánto se movió hace poco (el arma se atrasa un poco)
  const mouse = useRef({ x: -1, y: -1 });
  const mouseIn = useRef(false); // el cursor está adentro de la ventana
  const muzzleAt = useRef<{ x: number; y: number } | null>(null); // la boca del arma en la pantalla (de ahí sale el cohete)
  const aim = useRef({ zoom: START_ZOOM, target: START_ZOOM, kick: 0, breath: BREATH, holding: false, swayT: 0, shake: 0, flash: 0, scoped: false, muzzle: 0 }); // muzzle: el fogonazo del último disparo (1 → 0)
  const arsenal = useRef(createArsenal());
  const selected = useRef<Weapon>('rifle');
  const trigger = useRef(false);
  const [weapon, setWeapon] = useState<Weapon>('rifle');
  const drag = useRef<{ x: number; y: number; id: number; moved: number; t: number } | null>(null);
  const fingers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; zoom: number } | null>(null);
  const keys = useRef(new Set<string>());
  const [status, setStatus] = useState<Status>('ready');
  const [hud, setHud] = useState(() => ({ time: GAME_SECONDS, kills: 0, points: 0, civilians: 0, killsBy: ALIEN_KINDS.map(() => 0), humans: aliveHumans(firstGame), aliens: aliveAliens(firstGame), mag: Number(WEAPONS.rifle.mag), reloading: false }));
  const [record, setRecord] = useState(readInvasionRecord);
  const [result, setResult] = useState({ outcome: 'time' as Outcome, kills: 0, points: 0, time: 0, headshots: 0, shots: 0, hits: 0, defused: 0, newRecord: false, clues: [] as string[] });
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

  // La vista, como en el Counter-Strike pero en 2D: el "+" queda fijo en el medio de la pantalla y lo que se
  // mueve es el escenario (con el mouse, el dedo o las flechas). Entra toda la altura de la ciudad; el centro
  // puede ir desde la calle hasta lo más alto y de punta a punta de la cuadra. El temblor del pulso (menos si
  // contenés la respiración) y el retroceso mueven el escenario, así el "+" siempre marca adónde va el tiro.
  const baseView = useCallback((w: number, h: number): Omit<View, 't' | 'dpr'> => {
    const g = gameRef.current, s = h / (TOP_Y - FLOOR_Y), a = aim.current, c = cam.current;
    c.x = Math.max(0, Math.min(g.width, c.x));
    const vx = c.x;
    c.y = Math.max(FLOOR_Y + 2.4, Math.min(TOP_Y, c.y));
    const k = a.holding && a.breath > 0 ? 0.15 : 1, amp = 7 / a.zoom * k, t = a.swayT;
    return {
      w, h, s,
      cx: vx + Math.sin(t * 0.9) * amp + Math.sin(t * 2.3) * amp * 0.4,
      cy: c.y + Math.sin(t * 1.3 + 1) * amp * 0.8 + a.kick * 1.2 * (30 / a.zoom),
    };
  }, []);
  // Adónde apunta el "+" (el medio de la pantalla) en la ciudad.
  const target = useCallback((w: number, h: number) => {
    const b = baseView(w, h);
    return { mx: w / 2, my: h / 2, x: b.cx, y: b.cy };
  }, [baseView]);
  // Mover el escenario: `dx`, `dy` en píxeles de pantalla (con la mira, más fino cuanto más zoom).
  const look = useCallback((dx: number, dy: number) => {
    const stage = stageRef.current, a = aim.current, c = cam.current;
    if (!stage) return;
    const scale = a.scoped && hasScope(selected.current) ? a.zoom : stage.clientHeight / (TOP_Y - FLOOR_Y);
    c.x += dx / scale; c.y -= dy / scale;
    c.lagX = Math.max(-220, Math.min(220, c.lagX + dx)); c.lagY = Math.max(-160, Math.min(160, c.lagY + dy));
  }, []);
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
    const playing = statusRef.current === 'playing', wpn = selected.current, G = arsenal.current[wpn];
    const reloading = G.reload > 0, scoped = playing && a.scoped && hasScope(wpn) && !reloading;
    // Toda la cuadra: sin mira es lo que se ve (se rearma unas 16 veces por segundo en la compu); con la mira queda de
    // fondo, más oscura. Se arma en una imagen más ancha que la pantalla (un margen a cada lado): al mover la
    // vista solo se corre la imagen. En celulares, a menos resolución y de a ratos (así la mira anda fluida).
    const aiming = !!drag.current || fingers.current.size > 0; // con el dedo apuntando no se rearma el fondo (salvo que haga falta): la mira no pega tirones
    const shake = a.shake > 0 ? [Math.sin(g.time * 90) * a.shake * 14, Math.cos(g.time * 77) * a.shake * 10] : [0, 0]; // cuando explota un alien (o una bomba cerca) tiembla todo
    {
      const bg = bgRef.current, now = performance.now(), M = 0.3, MV = 0.25, W = w * (1 + 2 * M), HH = h * (1 + 2 * MV);
      const bs = touch ? 0.55 : 1, bw = Math.round(W * dpr * bs), bh = Math.round(HH * dpr * bs);
      const every = !scoped && playing ? (touch ? (aiming ? 260 : 150) : 60) : !touch ? 120 : aiming ? 3000 : 450; // sin mira la ciudad es lo que se mira: se rearma seguido (el arma y el + se mueven en cada cuadro)
      if (bg.canvas.width !== bw || bg.canvas.height !== bh || bg.s !== b.s || Math.abs(bg.x - b.cx) * b.s > M * w * 0.85 || Math.abs(bg.y - b.cy) * b.s > MV * h * 0.85 || now - bg.at > every) {
        if (bg.canvas.width !== bw || bg.canvas.height !== bh) { bg.canvas.width = bw; bg.canvas.height = bh; }
        const bctx = bg.canvas.getContext('2d');
        if (bctx) { bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.clearRect(0, 0, bw, bh); bctx.setTransform(dpr * bs, 0, 0, dpr * bs, 0, 0); paintCity(bctx, g, { ...b, w: W, h: HH, t: g.time, dpr }, 10, false); } // (los cohetes van aparte, en cada cuadro)
        bg.x = b.cx; bg.y = b.cy; bg.s = b.s; bg.at = now;
      }
      const off = ((bg.x - b.cx) * b.s - M * w) * dpr, offY = ((b.cy - bg.y) * b.s - MV * h) * dpr; // dónde cae la imagen según cuánto se movió la vista
      ctx.setTransform(1, 0, 0, 1, shake[0] * dpr, shake[1] * dpr); ctx.drawImage(bg.canvas, off, offY, W * dpr, HH * dpr); ctx.setTransform(dpr, 0, 0, dpr, shake[0] * dpr, shake[1] * dpr);
      if (g.rockets.length) drawRockets(ctx, g, { ...b, w, h, t: g.time, dpr }); // el cohete de la bazooka, fluido
      if (scoped || !playing) { ctx.fillStyle = scoped ? 'rgba(2,8,4,0.45)' : 'rgba(2,8,4,0.3)'; ctx.fillRect(-20, -20, w + 40, h + 40); }
    }
    // El arma solo se ve jugando: con el cartel abierto (inicio, pausa o fin) se usa la flecha del mouse normal.
    if (playing) {
      if (scoped) {
        // Con la mira: el zoom se ve solo adentro del vidrio (el rifle hace zoom; la ametralladora tiene uno fijo).
        drawScopeView(ctx, wpn, p.mx, p.my, R, a.zoom, a.kick, clip => {
          clip();
          ctx.translate(p.mx - R * 1.4, p.my - R * 1.4);
          paintCity(ctx, g, { w: R * 2.8, h: R * 2.8, s: a.zoom, cx: p.x, cy: p.y, t: g.time, dpr }, touch ? 2 : 6); // (en celulares arma de a pocas habitaciones nuevas por cuadro)
        }, a.muzzle, g.time);
      } else {
        // Sin mira: el arma en la mano (o recargando) y el "+" para apuntar.
        muzzleAt.current = drawHeldWeapon(ctx, wpn, w, h, p.mx - cam.current.lagX * 1.6, p.my - cam.current.lagY * 1.6, g.time, a.kick, reloading ? 1 - G.reload / WEAPONS[wpn].reload : null, a.muzzle);
        if (!reloading || wpn === 'bazooka') drawCross(ctx, p.mx, p.my, wpn, g.time);
      }
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
        if (m) { m.setTransform(dpr, 0, 0, dpr, 0, 0); drawMinimap(m, g, mw, mh, { x1: b.cx - w / 2 / b.s, x2: b.cx + w / 2 / b.s, y1: b.cy - h / 2 / b.s, y2: b.cy + h / 2 / b.s }); }
      }
    }
  }, [baseView, target]);

  // El zoom (la regla de cada arma):
  // - Rifle: con la ruedita (o abriendo los dedos) aparece la mira y se acerca igual que siempre; alejando del
  //   todo se sale de la mira y se ve el arma en la mano.
  // - Ametralladora: la mira tiene un solo zoom, el más lejano; acercar la muestra y alejar la saca.
  // - Bazooka: no tiene mira ni zoom.
  const minZoom = useCallback(() => { const stage = stageRef.current; return stage ? stage.clientHeight / (TOP_Y - FLOOR_Y) * 2 : 20; }, []);
  const setZoom = useCallback((z: number) => {
    const a = aim.current, w = selected.current, min = minZoom();
    if (w === 'bazooka') { a.scoped = false; a.target = min; return; }
    if (w === 'machine') { if (z > min * 1.12) a.scoped = true; else if (z < min * 0.9) a.scoped = false; a.target = min; return; }
    if (z < min * 0.92) { a.scoped = false; a.target = min; return; }
    if (!a.scoped) { a.scoped = true; a.zoom = Math.max(min, Math.min(WEAPONS.rifle.zoom, Math.max(z, WEAPONS.rifle.start))); }
    a.target = Math.max(min, Math.min(WEAPONS.rifle.zoom, z));
  }, [minZoom]);
  // La ruedita y los botones: desde la mano, acercar entra a la mira con el zoom de siempre del rifle.
  const zoomBy = useCallback((factor: number) => {
    const a = aim.current, min = minZoom();
    if (!a.scoped) { if (factor > 1) setZoom(selected.current === 'rifle' ? Math.max(min, WEAPONS.rifle.start) : min * 1.2); return; }
    if (factor < 1 && a.target <= min * 1.001) { setZoom(min * 0.5); return; }
    setZoom(Math.max(min, a.target * factor));
  }, [minZoom, setZoom]);
  const selectWeapon = useCallback((next: Weapon) => {
    const current = statusRef.current;
    if (current !== 'playing' && current !== 'armory') return;
    if (next !== selected.current) {
      selected.current = next;
      setWeapon(next);
      aim.current.scoped = false; aim.current.target = minZoom();
    }
    if (current === 'armory') setStatus('playing');
  }, [minZoom]);

  // Qué pasa en la pantalla según a qué le pegó (el cohete de la bazooka avisa recién cuando explota).
  const reactToHit = useCallback((hit: ReturnType<typeof shoot> | 'ufoDestroyed' | 'blast') => {
    if (hit === 'alien' || hit === 'ufoDestroyed' || hit === 'blast') { aim.current.shake = 1; aim.current.flash = 1; }
    if (hit === 'ufoDestroyed') setToast({ text: 'OVNI derribado · cuenta como 5 grises (+50)', id: performance.now() });
    if (hit === 'civilian') { aim.current.flash = -1; setToast({ text: 'Baja civil', id: performance.now(), bad: true }); }
    if (hit === 'defused') setToast({ text: 'Bomba desactivada · +50 puntos', id: performance.now() });
    if (hit === 'ufo') setToast({ text: 'Usá la bazooka para derribar el OVNI', id: performance.now() });
  }, []);

  const fire = useCallback(() => {
    if (statusRef.current !== 'playing') return;
    const g = gameRef.current, current = selected.current, G = arsenal.current[current], config = WEAPONS[current], stage = stageRef.current;
    if (!stage || g.over || G.reload > 0 || G.cycle > 0) return;
    if (G.mag <= 0) { playEmpty(); G.reload = config.reload; playReload(); return; }
    const p = target(stage.clientWidth, stage.clientHeight);
    G.mag--;
    aim.current.kick = current === 'machine' ? 0.33 : 1;
    aim.current.muzzle = 1;
    if (current === 'bazooka') playBazookaShot(); else if (current === 'machine') playMachineShot(); else playRifleShot();
    shotFx(current, g.time); // la animación del disparo, en cada tiro
    // El cohete sale de la boca de la bazooka: paso ese punto de la pantalla a metros de la ciudad.
    const m = muzzleAt.current, b = baseView(stage.clientWidth, stage.clientHeight);
    const from = current === 'bazooka' && m ? { x: b.cx + (m.x - stage.clientWidth / 2) / b.s, y: b.cy - (m.y - stage.clientHeight / 2) / b.s } : undefined;
    // Sin la mira el tiro es muy impreciso (cae en cualquier lado de un círculo de `HIP_SPREAD` m): obliga a usar la mira.
    let { x: hx, y: hy } = p;
    if (current !== 'bazooka' && !aim.current.scoped) { const r = HIP_SPREAD[current] * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2; hx += Math.cos(a) * r; hy += Math.sin(a) * r; }
    reactToHit(shoot(g, hx, hy, current, from));
    if (G.mag > 0) { G.cycle = config.cycle; if (current === 'rifle') playBolt(); }
    else { G.reload = config.reload; playReload(); }
  }, [target, reactToHit, baseView]);

  const reload = useCallback(() => {
    const G = arsenal.current[selected.current], config = WEAPONS[selected.current];
    if (G.reload > 0 || G.mag === config.mag || statusRef.current !== 'playing') return;
    G.reload = config.reload;
    playReload();
  }, []);

  const start = useCallback(() => {
    playStart(); preloadInvasionSounds(); preloadGray(); preloadWeapons();
    gameRef.current = newInvasion();
    const g = gameRef.current;
    cam.current.x = g.width * (0.3 + Math.random() * 0.4); cam.current.y = (TOP_Y + FLOOR_Y) / 2;
    Object.assign(aim.current, { zoom: minZoom(), target: minZoom(), kick: 0, breath: BREATH, holding: false, swayT: 0, shake: 0, flash: 0, scoped: false, muzzle: 0 });
    arsenal.current = createArsenal();
    selected.current = 'rifle';
    trigger.current = false;
    setWeapon('rifle');
    setHud({ time: GAME_SECONDS, kills: 0, points: 0, civilians: 0, killsBy: ALIEN_KINDS.map(() => 0), humans: aliveHumans(g), aliens: aliveAliens(g), mag: WEAPONS.rifle.mag, reloading: false });
    setToast({ text: 'Protegé a la población durante diez minutos.', id: performance.now(), big: true });
    setStatus('playing');
  }, [minZoom]);

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
    let frame = 0, last = performance.now(), soundAt = 0, talkAt = 0, rayAt = 0;
    const run = (now: number): boolean => {
      const g = gameRef.current, a = aim.current, G = arsenal.current[selected.current], stage = stageRef.current;
      // El reloj del juego va a tiempo real aunque la compu dibuje pocos cuadros por segundo (hasta 4 por segundo):
      // la lógica avanza en pasos de 50 ms como mucho.
      const dt = Math.max(0, Math.min(0.25, (now - last) / 1000));
      last = now;
      for (let left = dt; left > 1e-6 && !g.over; left -= 0.05) step(g, Math.min(0.05, left));
      a.swayT += dt;
      a.kick = Math.max(0, a.kick - dt * (selected.current === 'bazooka' ? 1.6 : 4)); // la bazooka vuelve más despacio del retroceso
      a.muzzle = Math.max(0, a.muzzle - dt * (selected.current === 'bazooka' ? 5 : 10)); // el fogonazo dura un instante (el de la bazooka, un poco más)
      a.shake = Math.max(0, a.shake - dt * 2.2);
      a.flash = a.flash > 0 ? Math.max(0, a.flash - dt * 3) : Math.min(0, a.flash + dt * 2);
      a.zoom += (a.target - a.zoom) * Math.min(1, dt * 10);
      a.holding = keys.current.has('Shift');
      a.breath = a.holding ? Math.max(0, a.breath - dt) : Math.min(BREATH, a.breath + dt * 0.6);
      // Flechas (o W A S D): el escenario se mueve (el "+" queda en el medio).
      const dir = (keys.current.has('ArrowRight') || keys.current.has('d') || keys.current.has('pad-right') ? 1 : 0) - (keys.current.has('ArrowLeft') || keys.current.has('a') || keys.current.has('pad-left') ? 1 : 0);
      // Mouse suelto (sin bloqueo del puntero) en los bordes de la pantalla: corre el escenario como las flechas,
      // más rápido cuanto más al borde (así no se traba cuando el cursor llega al costado).
      const m = mouse.current, edge = stage && mouseIn.current && document.pointerLockElement !== stage && m.y >= 0 && m.y <= stage.clientHeight ? (() => {
        const W = stage.clientWidth, z = W * EDGE;
        return m.x < z ? -Math.min(1, 1 - m.x / z) : m.x <= W && m.x > W - z ? 1 - (W - m.x) / z : 0; // (a la izquierda del juego cuenta como el borde)
      })() : 0;
      if (edge) { const z = a.scoped && hasScope(selected.current) ? Math.max(1, a.zoom / (stage ? stage.clientHeight / (TOP_Y - FLOOR_Y) : 20)) : 1; cam.current.x += Math.sign(edge) * (0.45 + Math.abs(edge) * 0.75) * PAN * dt / z; }
      const vdir = (keys.current.has('ArrowUp') || keys.current.has('w') ? 1 : 0) - (keys.current.has('ArrowDown') || keys.current.has('s') ? 1 : 0);
      if (dir || vdir) { const z = a.scoped && hasScope(selected.current) ? Math.max(1, a.zoom / (stage ? stage.clientHeight / (TOP_Y - FLOOR_Y) : 20)) : 1; cam.current.x += dir * PAN * dt / z; cam.current.y += vdir * PAN * 0.7 * dt / z; }
      const decay = Math.exp(-dt * 7); cam.current.lagX *= decay; cam.current.lagY *= decay;
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
        if (e.type === 'glass') playGlass(0.8);
        if (e.type === 'ufoPing') playRicochet();
        if (e.type === 'defused') playDefuse();
        if (e.type === 'rocketHit') reactToHit(e.hit);
        if (e.type === 'hurt') { playGooBlast(); a.shake = Math.max(a.shake, 0.35); setToast({ text: e.left > 1 ? `Alien herido · le quedan ${e.left} puntos de vida` : 'Alien herido · le queda 1 punto de vida', id: now }); }
        if (e.type === 'explosion') { const k = near(e.x, e.y); if (e.bazooka) playBazookaBoom(); else playBlast(Math.max(0.15, k)); a.shake = Math.max(a.shake, 0.3 + k * 1.2); }
        if (e.type === 'bomb' && near(e.x, e.y) > 0.3) setToast({ text: 'Explosivo cercano. Buscá la caja con la luz roja.', id: now, bad: true });
        if (e.type === 'laser') playLaser(Math.max(0.2, near(e.x, e.y)));
        if (e.type === 'lighter') playLighter(near(e.x, e.y));
        if (e.type === 'ray' && now >= rayAt) {
          const level = near(e.x, e.y);
          if (level > 0.1) { playRayGun(level); rayAt = now + 100; }
        }
        if (e.type === 'died') { const who = g.people.find(o => o.id === e.id); playHumanScream(!!who && isWoman(who), e.byPlayer ? 1 : near(e.x, e.y)); }
        if (e.type === 'scream') { const who = g.people.find(o => o.id === e.id); playHumanScream(!!who && isWoman(who), near(e.x, e.y) * 0.7); } // los gritos son solo los dos del usuario
        if (e.type === 'mother') { playUfoArrive(); setToast({ text: '¡Llegó la nave nodriza! 🛸', id: now, big: true }); }
        if (e.type === 'ufoArrive') { playUfoArrive(e.kind); const first = g.ufos.length === 1 && e.kind === 'pen'; setToast({ text: first ? 'Entraron los OVNIs. Usá la bazooka.' : e.kind === 'mother' ? `¡La nave nodriza larga un ovni! Ya son ${g.ufos.length} 🛸` : `¡Otro ovni! Ya son ${g.ufos.length} 🛸`, id: now, big: first }); }
        if (e.type === 'comm') playAlienComm(near(e.x, e.y) * 0.6);
        if (e.type === 'thunder') { playThunder(Math.max(0.35, 1 - Math.abs(e.x - p.x) / 120)); a.shake = Math.max(a.shake, 0.25); }
        if (e.type === 'rain') setToast({ text: '🌧️ Se largó una tormenta: llueve y hay relámpagos', id: now, big: true });
      }
      if (now - soundAt > 100) { soundAt = now; setInvasionAmbient(invasionLevels(g, p.x, p.y, a.zoom)); }
      // Solo con la mira (rifle o ametralladora) se escucha hablar al alien que está adentro del vidrio, el más
      // cerca del centro, con la voz de su especie. Sin mira, o de lejos, no se escuchan.
      if (now > talkAt) {
        const zoomK = a.scoped && hasScope(selected.current) ? Math.max(0.6, Math.min(1, (a.zoom - 50) / 120)) : 0;
        const view = stage ? Math.min(stage.clientWidth, stage.clientHeight) * 0.5 / a.zoom : 6;
        const radius = Math.max(2, Math.min(14, view));
        let best: { d: number; who: Game['people'][number] } | null = null;
        if (zoomK > 0.1) for (const o of g.people) { if (!o.alien || o.dead || o.gone) continue; const d = Math.hypot(o.x - p.x, (o.y + 0.9 - p.y) * 1.2); if (d < radius && (!best || d < best.d)) best = { d, who: o }; }
        if (best) { const kind = best.who.id % ALIEN_VOICE_SECONDS.length; playAlienVoice(kind, zoomK * (0.5 + 0.5 * (1 - best.d / radius))); best.who.talk = ALIEN_VOICE_SECONDS[kind]; talkAt = now + ALIEN_VOICE_SECONDS[kind] * 1000 + 500 + Math.random() * 1200; } else talkAt = now + 400; // (espera que termine de hablar)
      }
      paint();
      const shown = { time: Math.ceil(GAME_SECONDS - g.time), kills: g.kills, points: g.points, civilians: g.civilians, killsBy: [...g.killsBy], humans: aliveHumans(g), aliens: aliveAliens(g), mag: G.mag, reloading: G.reload > 0 };
      setHud(prev => JSON.stringify(prev) === JSON.stringify(shown) ? prev : shown);
      if (g.over) {
        const outcome = g.outcome ?? 'time', rec = readInvasionRecord(), won = outcome === 'won';
        const isNew = g.points > invasionRecordPoints(rec);
        const next: InvasionRecord = isNew ? { kills: g.kills, points: g.points } : rec;
        saveRecord(next); setRecord(next);
        const clues = [...new Set(g.killedAnomalies)].slice(-8).map(id => ANOMALIES[id].text);
        setResult({ outcome, kills: g.kills, points: g.points, time: g.time, headshots: g.headshots, shots: g.shots, hits: g.hits, defused: g.defused, newRecord: isNew, clues });
        setInvasionAmbient(null);
        if (won) playWinFanfare(); else playGameOver();
        setStatus('over');
        return false;
      }
      return true;
    };
    // Si un cuadro falla por algo raro, el juego sigue con el siguiente (antes el bucle se cortaba y todo, el "+"
    // incluido, quedaba congelado).
    const tick = (now: number) => {
      let go = true;
      try { go = run(now); } catch (err) { console.error('Invasión: falló un cuadro', err); }
      if (go) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hide = () => { if (document.hidden) setStatus('paused'); };
    document.addEventListener('visibilitychange', hide);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', hide); };
  }, [status, paint, target, fire, reactToHit]);

  // Mouse, como en el Counter-Strike: jugando, el mouse queda "atrapado" en el juego (bloqueo del puntero) y
  // moverlo corre el escenario; el "+" queda en el medio. Clic dispara (el primer clic, si el mouse no estaba
  // atrapado, solo lo atrapa) y la ruedita hace zoom. Escape suelta el mouse y pone pausa.
  const lockMouse = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || window.matchMedia?.('(pointer: coarse)').matches || document.pointerLockElement === stage) return;
    // Si el navegador no lo deja (por ejemplo, justo después de soltarlo con Escape no se puede volver a atrapar
    // enseguida), se reintenta una vez al segundo.
    const ask = (retry: boolean) => {
      const again = () => { if (retry) window.setTimeout(() => { if (statusRef.current === 'playing' && document.pointerLockElement !== stage) ask(false); }, 1100); };
      try { const r = stage.requestPointerLock?.() as unknown; if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(again); } catch { again(); }
    };
    ask(true);
  }, []);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const move = (e: MouseEvent) => {
      mouseIn.current = true;
      const r = stage.getBoundingClientRect(), k = fitScale();
      mouse.current = { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
      if (statusRef.current !== 'playing') { paint(); return; }
      look(e.movementX / k, e.movementY / k);
    };
    const down = (e: MouseEvent) => {
      if (e.button !== 0 || statusRef.current !== 'playing') return;
      if (e.target !== canvasRef.current && e.target !== stage) return;
      if (document.pointerLockElement !== stage && !window.matchMedia?.('(pointer: coarse)').matches && 'requestPointerLock' in stage) { lockMouse(); return; }
      trigger.current = true; fire();
    };
    const up = () => { trigger.current = false; };
    // Jugando, el mouse es siempre la mira: no puede quedar suelto. Si se suelta (Escape, cambiar de ventana…), el
    // juego se pone en pausa y recién ahí aparece la flecha. (En el navegador de las pruebas automáticas, que suelta
    // el mouse enseguida de atraparlo, solo si estuvo atrapado un rato.)
    const robot = typeof navigator !== 'undefined' && navigator.webdriver;
    const canLock = 'requestPointerLock' in stage && !window.matchMedia?.('(pointer: coarse)').matches;
    let lockedAt = 0;
    const lockChange = () => {
      if (document.pointerLockElement === stage) { lockedAt = performance.now(); return; }
      if (statusRef.current === 'playing' && lockedAt && (!robot || performance.now() - lockedAt > 500)) setStatus('paused');
      lockedAt = 0;
    };
    // Si el navegador no llegó a atrapar el mouse y la flecha se va del cuadro del juego: pausa.
    const leave = () => { if (canLock && !robot && statusRef.current === 'playing' && document.pointerLockElement !== stage) setStatus('paused'); };
    stage.addEventListener('mouseleave', leave);
    window.addEventListener('mouseup', up);
    window.addEventListener('blur', up);
    const wheel = (e: WheelEvent) => { if (statusRef.current !== 'playing') return; e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.18 : 1 / 1.18); };
    document.addEventListener('mousemove', move);
    const out = (e: MouseEvent) => { if (!e.relatedTarget) mouseIn.current = false; }; // el cursor salió de la ventana
    document.addEventListener('mouseout', out);
    stage.addEventListener('mousedown', down);
    stage.addEventListener('wheel', wheel, { passive: false });
    document.addEventListener('pointerlockchange', lockChange);
    return () => { window.removeEventListener('mouseup', up); window.removeEventListener('blur', up); up(); document.removeEventListener('mousemove', move); document.removeEventListener('mouseout', out); stage.removeEventListener('mousedown', down); stage.removeEventListener('wheel', wheel); stage.removeEventListener('mouseleave', leave); document.removeEventListener('pointerlockchange', lockChange); };
  }, [fire, zoomBy, paint, look, lockMouse]);
  // Fuera de la partida (pausa, arsenal, fin) se suelta el mouse.
  useEffect(() => { if (status !== 'playing' && document.pointerLockElement) document.exitPointerLock?.(); }, [status]);

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
      if (e.key === 'Escape' && current === 'playing') { setStatus('paused'); return; } // (Escape solo pausa: también suelta el mouse)
      if ((e.key === 'p' || e.key === 'P') && (current === 'playing' || current === 'paused')) { if (current === 'paused') lockMouse(); setStatus(s => s === 'playing' ? 'paused' : 'playing'); return; }
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
  }, [fire, reload, selectWeapon, zoomBy, lockMouse]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; setInvasionAmbient(null); };
  }, []);

  // En el celular: arrastrando con el dedo se corre el escenario (el "+" queda en el medio), un toque cortito dispara y con dos dedos se hace zoom: estirando se acerca, cerrando se aleja.
  const spread = () => { const [p1, p2] = [...fingers.current.values()]; return Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1; };
  const touch = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' || e.target !== canvasRef.current) return;
      e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); // sin el clic de mouse que el navegador simula
      fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (fingers.current.size >= 2) { drag.current = null; pinch.current = { d: spread(), zoom: aim.current.scoped ? aim.current.target : minZoom() * 0.95 }; return; } // dos dedos: zoom (y ese toque ya no dispara)
      if (!pinch.current) drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: 0, t: performance.now() };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const f = fingers.current.get(e.pointerId); if (!f) return;
      f.x = e.clientX; f.y = e.clientY;
      const pz = pinch.current;
      if (pz && fingers.current.size >= 2) { setZoom(pz.zoom * spread() / pz.d); aim.current.zoom = aim.current.target; return; } // sigue a los dedos sin demora
      const d = drag.current, stage = stageRef.current; if (!d || d.id !== e.pointerId || !stage) return;
      const k = fitScale() / TOUCH_SPEED;
      look((e.clientX - d.x) / k, (e.clientY - d.y) / k); // como el mouse: deslizar a la derecha mira a la derecha, hacia arriba mira arriba (el "+" queda en el medio)
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
  const recordText = `${invasionRecordPoints(record)} pts`;

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
                <div><dt><kbd>Mouse</kbd> <kbd>←↑↓→</kbd></dt><dd>Mover la vista</dd></div>
                <div><dt><kbd>Ruedita</kbd></dt><dd>Zoom</dd></div>
                <div><dt><kbd>R</kbd></dt><dd>Recargar</dd></div>
                <div><dt><kbd>P</kbd> <kbd>Esc</kbd></dt><dd>Pausa</dd></div>
              </dl>
              <h3 className="inv-points-title">Puntos</h3>
              <ul className="inv-points" data-testid="inv-points">
                {SPECIES_ORDER.map(i => <li key={ALIEN_KINDS[i].name}><span>{ALIEN_KINDS[i].label}</span><b>+{ALIEN_KINDS[i].points}</b></li>)}
                <li className="is-extra"><span>Bomba desactivada</span><b>+{DEFUSE_POINTS}</b></li>
                <li className="is-extra"><span>OVNI derribado <small>(= {UFO_KILLS} grises)</small></span><b>+{UFO_KILLS * ALIEN_KINDS[0].points}</b></li>
                <li className="is-bad"><span>Humano muerto</span><b>−{HUMAN_PENALTY}</b></li>
              </ul>
              <button type="button" onClick={() => { start(); lockMouse(); }} autoFocus>Jugar</button>
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
              <button type="button" className="inv-armory-back" onClick={() => { setStatus('playing'); lockMouse(); }}>Volver a la partida</button>
            </>}
            {status === 'paused' && <>
              <h2 id="inv-message">Pausa</h2>
              <button type="button" onClick={() => { setStatus('playing'); lockMouse(); }} autoFocus>Seguir</button>
            </>}
            {status === 'over' && <>
              <EndBanner win={result.outcome === 'won'} id="inv-message" />
              <p className="end-reason" data-testid="inv-outcome">{OUTCOME_TEXT[result.outcome]}</p>
              <p><strong data-testid="inv-final">{result.points} puntos</strong> ? {result.kills} aliens eliminados ? {hud.humans} humanos y {hud.aliens} aliens en pie.{result.newRecord && ' Nuevo récord.'}</p>
              <p>{result.headshots} tiros a la cabeza · {result.defused} bombas desactivadas · {accuracy}% de puntería</p>
              {result.clues.length > 0 && <div className="inv-clues"><p><strong>Lo raro que hacían los aliens que eliminaste:</strong></p><ul>{result.clues.map(c => <li key={c}>{c}</li>)}</ul></div>}
              <button type="button" onClick={() => { start(); lockMouse(); }} autoFocus>Jugar de nuevo</button>
            </>}
          </div>
        </div>}
      </div>
      <aside className="trepa-side inv-side" aria-label="Marcador y armamento">
        <h2 className="inv-panel-heading">Estado de la ciudad</h2>
        <div className="trepa-stat"><span>Tiempo restante</span><strong data-testid="inv-time">{formatInvasionTime(hud.time)}</strong></div>
        <div className="trepa-stat inv-population"><span>Humanos</span><strong><b data-testid="inv-humans">{hud.humans}</b><small> / {HUMAN_TOTAL}</small></strong><meter aria-label="Humanos vivos" min={0} max={HUMAN_TOTAL} value={hud.humans} /></div>
        <div className="trepa-stat inv-population inv-kills"><span>Aliens</span><strong><b data-testid="inv-aliens">{hud.aliens}</b><small> / {ALIEN_TOTAL}</small></strong><meter aria-label="Aliens vivos" min={0} max={ALIEN_TOTAL} value={hud.aliens} /></div>
        <div className="trepa-stat"><span>Puntos</span><strong data-testid="inv-score">{hud.points}</strong></div>
        <h2 className="inv-panel-heading">Extraterrestres</h2>
        <table className="inv-species" data-testid="inv-species">
          <thead><tr><th scope="col">Especie</th><th scope="col">Matados</th><th scope="col">Puntos</th></tr></thead>
          <tbody>{SPECIES_ORDER.map(i => <tr key={ALIEN_KINDS[i].name}><th scope="row">{ALIEN_KINDS[i].label} <small>{ALIEN_KINDS[i].points}</small></th><td>{hud.killsBy[i]}</td><td>{hud.killsBy[i] * ALIEN_KINDS[i].points}</td></tr>)}<tr className="inv-humans"><th scope="row">Humanos <small>−{HUMAN_PENALTY}</small></th><td>{hud.civilians}</td><td>{hud.civilians ? `−${hud.civilians * HUMAN_PENALTY}` : 0}</td></tr></tbody>
        </table>
        <h2 className="inv-panel-heading">Armamento</h2>
        <button type="button" className="inv-armory-toggle" aria-haspopup="dialog" disabled={status !== 'playing'} onClick={() => setStatus('armory')}>Arsenal <span>{WEAPONS[weapon].name}</span></button>
        <div className="trepa-stat"><span>{hud.reloading ? 'Recargando' : 'Munición'}</span><strong data-testid="inv-ammo">{hud.mag} / {WEAPONS[weapon].mag}</strong></div>
        {status === 'playing' && <button type="button" className="inv-fire" onPointerDown={e => { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); trigger.current = true; fire(); }} onLostPointerCapture={() => { trigger.current = false; }} onClick={e => { if (e.detail === 0) fire(); }}>Disparar</button>}
      </aside>
    </div>
  </section>;
}
