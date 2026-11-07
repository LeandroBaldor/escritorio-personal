import './land.css';
import './landHud.css';
import './landInterface.css';
import { BuildingSprite, Sprite } from './landSprite';
import { LandInfographic, LeaderPortrait } from './landInfographic';
import { LandTroops } from './landTroops';
import { LandIcon, LandEagle } from './LandIcon';
import { worldPropsReady } from './landProps';
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  BUILD_STATS, BKINDS, MAX_UPGRADE, POWER_MAX, ROLE_STATS, UPGRADES, UPGRADE_COST, UPGRADE_TIME, canPay, canPlace, cancelTrain, formatLandTime, hasBuilt, newLandGame, orderMove, orderSmart,
  placeBuilding, popCap, popUsed, research, stepLand, takeLandEvents, train, unitStats, castPower, type BKind, type Building, type Cost, type Difficulty, type LandGame, type Role, type Unit, type Upgrade,
} from './land';
import { BUILD_TEXT, CIVS, CIV_IDS, POWER_TEXT, attackText, roleText, type CivId } from './landCivs';
import { wallPoint, wallsReady } from './landWalls';
import { MAP_SIZES, THEMES, type MapSize } from './landMap';
import { renderTerrain, terrainMaterialsReady, type TerrainRegion } from './landMapArt';
import { bIdx, drawMinimap, drawSprite, drawWorld, roleIdx, spritesReady, type Cam } from './landArt';
import { useFitScreen } from './fitScreen';
import { playExplosion, playGameOver, playKnock, playRifleShot, playVampSword, playWinFanfare } from './sounds';
import { playLandButton, preloadLandSounds, setLandMenuMusic } from './landAudio';
import { LandCharacterSounds } from './landCharacterSounds';

import posterImg from './assets/land/poster.webp';
const RECORD_KEY = 'escritorio-personal-juegos:land-victorias';
export function readLandRecord(): Record<string, number> { try { return JSON.parse(localStorage.getItem(RECORD_KEY) ?? '{}') ?? {}; } catch { return {}; } }
function saveWin(c: CivId) { try { const r = readLandRecord(); r[c] = (r[c] ?? 0) + 1; localStorage.setItem(RECORD_KEY, JSON.stringify(r)); } catch { /* sin almacenamiento */ } }
const ROLE_ORDER: Role[] = ['worker', 'melee', 'ranged', 'special', 'heavy', 'elite'];
const UP_NAME: Record<Upgrade, string> = { attack: 'Ataque', armor: 'Vida', speed: 'Velocidad' };
const UP_ICON: Record<Upgrade, string> = { attack: '⚔️', armor: '🛡️', speed: '👟' };
const DIFF: [Difficulty, string][] = [['veryEasy', 'Muy fácil'], ['easy', 'Fácil'], ['normal', 'Normal'], ['hard', 'Difícil']];
const costText = (c: Cost) => `${c.stone ? `🔷${c.stone}` : ''}${c.gem ? ` 🔶${c.gem}` : ''}${c.energy ? ` 🟢${c.energy}` : ''}`.trim();
type Screen = 'title' | 'pick' | 'sheet' | 'scenario' | 'playing' | 'paused' | 'won' | 'lost';
const HUD_H = 214; // (el alto del menú de abajo)
const minZoom = (g: LandGame, w: number, h: number) => Math.max(1.6 / 1.1, w / g.terrain.w, (h - HUD_H) / g.terrain.h);
type Mode = { k: 'none' } | { k: 'place'; kind: BKind } | { k: 'power' } | { k: 'amove' };

export function LandOfWarriors() {
  const fit = useFitScreen();
  const [screen, setScreen] = useState<Screen>('title');
  const [civ, setCiv] = useState<CivId>('humano');
  const [view, setView] = useState<CivId>('humano'); // la lámina que se está mirando
  const [simple, setSimple] = useState(false);
  const [enemies, setEnemies] = useState<(CivId | 'random')[]>(['random']);
  const [commsOpen, setCommsOpen] = useState(false);
  const [map, setMap] = useState(5);
  const [size, setSize] = useState<MapSize>('medium');
  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState<Difficulty>('normal');
  const [record, setRecord] = useState(readLandRecord);
  const gRef = useRef<LandGame | null>(null);
  const [game, setGame] = useState<LandGame | null>(null); // (la misma partida, para dibujar el menú)
  const [, setTick] = useState(0); // (para refrescar el menú de abajo unas veces por segundo)
  const [sel, setSel] = useState<number[]>([]);
  const selRef = useRef<Set<number>>(new Set());
  const [mode, setMode] = useState<Mode>({ k: 'none' });
  const modeRef = useRef<Mode>(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const camRef = useRef<Cam>({ x: 0, y: 0, w: 1200, h: 700, z: 1 });
  const stageRef = useRef<HTMLDivElement>(null), canvasRef = useRef<HTMLCanvasElement>(null), miniRef = useRef<HTMLCanvasElement>(null);
  const mapImg = useRef<HTMLCanvasElement | null>(null);
  const detailImg = useRef<(TerrainRegion & { canvas: HTMLCanvasElement }) | null>(null);
  const screenRef = useRef(screen);
  useEffect(() => { screenRef.current = screen; }, [screen]);
  const mouse = useRef({ x: 0, y: 0, in: false, wx: 0, wy: 0 });
  const drag = useRef<{ x0: number; y0: number; x1: number; y1: number; pan: boolean; id: number; cx: number; cy: number } | null>(null);
  const keys = useRef<Set<string>>(new Set());
  const characterSounds=useRef<LandCharacterSounds|null>(null);
  const lastToast = useRef<Record<string, number>>({});

  useEffect(() => { spritesReady(); terrainMaterialsReady(); worldPropsReady(); wallsReady(); }, []);
  useEffect(()=>{
    const sounds=new LandCharacterSounds();characterSounds.current=sounds;
    return ()=>{sounds.dispose();characterSounds.current=null;};
  },[]);
  useEffect(()=>{
    const update=()=>characterSounds.current?.setActive(screen==='playing'&&!document.hidden);
    update();document.addEventListener('visibilitychange',update);return ()=>document.removeEventListener('visibilitychange',update);
  },[screen]);
  // la música del menú: suena en la elección de civilización y en su lámina (los navegadores la dejan sonar después del primer toque)
  useEffect(() => { preloadLandSounds(); }, []);
  useEffect(() => {
    const on = screen === 'title' || screen === 'pick' || screen === 'sheet' || screen === 'scenario';
    setLandMenuMusic(on); if (!on) return;
    const kick = () => setLandMenuMusic(true), id = setInterval(kick, 1500);
    window.addEventListener('pointerdown', kick); window.addEventListener('keydown', kick);
    return () => { clearInterval(id); window.removeEventListener('pointerdown', kick); window.removeEventListener('keydown', kick); };
  }, [screen]);
  useEffect(() => () => setLandMenuMusic(false), []);
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __landGame?: () => LandGame | null; __landCam?: () => Cam }).__landGame = () => gRef.current; (window as unknown as { __landCam?: () => Cam }).__landCam = () => camRef.current; }, []); // (para probar en desarrollo)
  const say = useCallback((text: string, key = text, gap = 0) => { const now = performance.now(); if (gap && now - (lastToast.current[key] ?? -1e9) < gap) return; lastToast.current[key] = now; setToast({ text, id: now }); }, []);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 5000); return () => clearTimeout(id); }, [toast]);
  const setSelection = useCallback((ids: number[]) => { if(gRef.current&&ids.some(id=>!selRef.current.has(id)))characterSounds.current?.react(gRef.current,ids);selRef.current = new Set(ids); setSel(ids); }, []);

  // ---------------------------------------------------------------- Empezar una partida
  const start = useCallback((civ: CivId) => {
    characterSounds.current?.start(civ);
    setCiv(civ); setLoading(true);
    let attempts = 0;
    const prepare = () => {
      if ((!spritesReady() || !terrainMaterialsReady() || !worldPropsReady() || !wallsReady()) && attempts++ < 160) { setTimeout(prepare, 50); return; }
      const available = CIV_IDS.filter(c => c !== civ), foes = enemies.map(e => {
        const selected = e !== 'random' && available.includes(e) ? e : available[Math.floor(Math.random() * available.length)];
        available.splice(available.indexOf(selected), 1); return selected;
      });
      const g = newLandGame(civ, foes, map, diff, Date.now(), size); gRef.current = g; setGame(g);
      detailImg.current = null; mapImg.current = renderTerrain(g.terrain);
      const base = g.buildings.find(b => b.owner === 0)!;
      camRef.current = { ...camRef.current, z: 1.6, x: base.x - 300, y: base.y - 200 };
      setCommsOpen(false); setSelection([]); setMode({ k: 'none' }); setLoading(false); setScreen('playing');
    };
    setTimeout(prepare, 60);
  }, [enemies, map, diff, size, setSelection]);

  // ---------------------------------------------------------------- Carteles que guían al jugador (solo cuando hace falta, y cada uno de vez en cuando)
  useEffect(() => {
    if (screen !== 'playing') return;
    const id = setInterval(() => {
      const g = gRef.current; if (!g || g.phase !== 'play') return;
      const side = g.sides[0], civ = CIVS[side.civ], mine = g.units.filter(u => u.owner === 0 && !u.dead), drops = g.buildings.filter(b => b.owner === 0 && !b.dead && (b.kind === 'base' || b.kind === 'depot'));
      const near = (kind: 'stone' | 'gem') => g.nodes.filter(n => n.kind === kind && drops.some(d => Math.hypot(d.x - n.x, d.y - n.y) < 600)).reduce((a, n) => a + n.amount, 0);
      const idle = mine.filter(u => u.role === 'worker' && u.order.k === 'idle').length, army = mine.filter(u => u.role !== 'worker').length;
      const hint = (key: string, text: string, gap = 90000) => say(text, key, gap);
      if (g.t > 20 && idle >= 2) hint('idle', `⛏️ Tenés ${idle} trabajadores sin hacer nada: mandalos a juntar cristales`, 45000);
      else if (g.t > 30 && near('stone') < 900) hint('stone', '🔷 Hay pocos minerales cerca de tu base: buscá otra zona y construí un depósito ahí', 120000);
      else if (g.t > 30 && near('gem') < 300) hint('gem', '🔶 Se están acabando los diamantes cerca: buscá más en el mapa', 120000);
      else if (popUsed(g, 0) >= popCap(g, 0) && popCap(g, 0) < 100) hint('pop', `👥 Llegaste al límite de población: construí un ${civ.buildings.depot}`, 60000);
      else if (g.t > 35 && !g.buildings.some(b => b.owner === 0 && b.kind === 'workerBarracks') && side.stone >= 100) hint('workers', `🏗️ Construí ${civ.buildings.workerBarracks} para entrenar más trabajadores`, 70000);
      else if (g.t > 50 && !g.buildings.some(b => b.owner === 0 && b.kind === 'barracks') && side.stone >= 150) hint('barracks', `🏗️ Construí ${civ.buildings.barracks}: entrena únicamente ${civ.units.melee}`, 70000);
      else if (g.t > 150 && army < 3 && g.ai.wave === 0 && g.t > g.ai.waveAt - 40) hint('army', '⚠️ El enemigo está armando un ejército: entrená soldados', 90000);
      else if (g.t > 200 && side.stone > 450 && side.gem > 250 && side.up.attack + side.up.armor + side.up.speed === 0) hint('upgrade', `⬆️ Mejorá la milicia: tocá tu ${civ.buildings.base} y elegí Ataque, Vida o Velocidad`, 150000);
      else if (g.t > 240 && side.stone > 400 && side.gem > 200 && !g.buildings.some(b => b.owner === 0 && b.kind === 'workshop') && hasBuilt(g, 0, 'barracks')) hint('workshop', `🏭 Construí ${civ.buildings.workshop}: entrena únicamente ${civ.units.heavy}`, 150000);
      else if (side.power >= POWER_MAX) hint('power', `✨ Tu poder ${civ.power.name} está listo (arriba a la derecha)`, 90000);
    }, 4000);
    return () => clearInterval(id);
  }, [screen, say]);

  // ---------------------------------------------------------------- El cuadro (dibujo y paso del juego)
  useEffect(() => {
    if (screen !== 'playing' && screen !== 'paused' && screen !== 'won' && screen !== 'lost') return;
    let frame = 0, last = performance.now(), hud = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const g = gRef.current, c = canvasRef.current, st = stageRef.current;
      if (!g || !c || !st) { frame = requestAnimationFrame(loop); return; }
      const w = st.clientWidth, h = st.clientHeight, k = Math.min(2, window.devicePixelRatio || 1);
      if (c.width !== Math.round(w * k) || c.height !== Math.round(h * k)) { c.width = Math.round(w * k); c.height = Math.round(h * k); }
      const cam = camRef.current; cam.w = w; cam.h = h;
      if (screenRef.current === 'playing') {
        // la cámara: flechas / WASD y los bordes de la pantalla
        const sp = 1100 * dt / cam.z, ks = keys.current, m = mouse.current, edge = 22, panelTop = h - HUD_H;
        let dx = (ks.has('ArrowRight') || ks.has('d') ? 1 : 0) - (ks.has('ArrowLeft') || ks.has('a') ? 1 : 0), dy = (ks.has('ArrowDown') || ks.has('s') ? 1 : 0) - (ks.has('ArrowUp') || ks.has('w') ? 1 : 0);
        if (m.in && !drag.current) { if (m.x < edge) dx = -1; else if (m.x > w - edge) dx = 1; if (m.y < edge) dy = -1; else if (m.y > panelTop - 4 && m.y < panelTop + 6) dy = 1; }
        cam.x += dx * sp; cam.y += dy * sp;
        stepLand(g, dt);
        for (const e of takeLandEvents(g)) {
          const nearby=('x' in e)&&e.x>=cam.x-100&&e.x<=cam.x+w/cam.z+100&&e.y>=cam.y-100&&e.y<=cam.y+(h-HUD_H)/cam.z+100;
          const customShot=(e.type==='hit'||e.type==='shot')&&nearby?characterSounds.current?.attack(g,e.owner,e.role):false;
          if(e.type==='trained'&&e.owner===0)characterSounds.current?.call(g.sides[0].civ,e.role,g.t);
          if (e.type === 'hit' && Math.random() < 0.25) playVampSword();
          else if (e.type === 'shot' && !customShot && Math.random() < 0.18) playRifleShot();
          else if (e.type === 'die' && e.building) playExplosion();
          else if (e.type === 'built' && e.owner === 0) { playKnock(); say(`🏗️ ${CIVS[g.sides[0].civ].buildings[e.kind]} terminado`); }
          else if (e.type === 'trained' && e.owner === 0 && e.role !== 'worker') say(`✅ ${CIVS[g.sides[0].civ].units[e.role]} listo`, 'trained', 2500);
          else if (e.type === 'upgraded' && e.owner === 0) say(`⬆️ Mejora de ${UP_NAME[e.up]} lista (nivel ${g.sides[0].up[e.up]})`);
          else if (e.type === 'power') { playExplosion(); say(e.owner === 0 ? `✨ ¡${CIVS[g.sides[0].civ].power.name}!` : `⚠️ El enemigo usó ${CIVS[g.sides[1].civ].power.name}`); }
          else if (e.type === 'attacked') say('⚠️ ¡Te están atacando!', 'attacked', 15000);
          else if (e.type === 'won') { playWinFanfare(); saveWin(g.sides[0].civ); setRecord(readLandRecord()); setScreen('won'); }
          else if (e.type === 'lost') { playGameOver(); setScreen('lost'); }
        }
        characterSounds.current?.tick(g,cam,selRef.current);
        // los elegidos que se murieron salen de la selección
        if ([...selRef.current].some(id => !g.units.some(u => u.id === id && !u.dead) && !g.buildings.some(b => b.id === id && !b.dead))) setSelection([...selRef.current].filter(id => g.units.some(u => u.id === id && !u.dead) || g.buildings.some(b => b.id === id && !b.dead)));
      } else stepLand(g, 0);
      cam.z = Math.max(cam.z, minZoom(g, w, h)); // (nunca se ve afuera del mapa)
      cam.x = Math.max(0, Math.min(g.terrain.w - w / cam.z, cam.x)); cam.y = Math.max(0, Math.min(g.terrain.h - (h - HUD_H) / cam.z, cam.y));
      const ctx = c.getContext('2d')!; ctx.setTransform(k, 0, 0, k, 0, 0); ctx.clearRect(0, 0, w, h);
      drawWorld(ctx, g, mapImg.current, cam, now / 1000, selRef.current, cx => {
        const m = mouse.current, md = modeRef.current;
        if (md.k === 'place' && m.in) { // la construcción que se va a poner (verde si se puede, roja si no)
          const p = md.kind === 'wall' ? wallPoint(m.wx,m.wy) : {x:m.wx,y:m.wy};
          const ok = canPlace(g, md.kind, p.x, p.y), s = BUILD_STATS[md.kind];
          cx.save(); cx.globalAlpha = 0.6; drawSprite(cx, g.sides[0].civ, bIdx(md.kind), p.x, p.y + 6, s.size * 0.95, false, s.size * 1.15);
          cx.globalAlpha = 0.9; cx.strokeStyle = ok ? '#4ade80' : '#ef4444'; cx.lineWidth = 3; cx.beginPath(); cx.ellipse(p.x, p.y + 4, s.size * 0.55, s.size * 0.19, 0, 0, Math.PI * 2); cx.stroke(); cx.restore();
        }
        if (md.k === 'power' && m.in) { cx.save(); cx.strokeStyle = '#fbbf24'; cx.lineWidth = 3; cx.setLineDash([10, 8]); cx.beginPath(); cx.arc(m.wx, m.wy, 170, 0, Math.PI * 2); cx.stroke(); cx.restore(); }
        for (const id of selRef.current) { const b = g.buildings.find(q => q.id === id && q.owner === 0); if (b?.rally) { cx.save(); cx.strokeStyle = '#fef08a'; cx.setLineDash([6, 6]); cx.lineWidth = 2; cx.beginPath(); cx.moveTo(b.x, b.y); cx.lineTo(b.rally.x, b.rally.y); cx.stroke(); cx.fillStyle = '#fef08a'; cx.fillRect(b.rally.x - 2, b.rally.y - 22, 3, 22); cx.fillRect(b.rally.x, b.rally.y - 22, 12, 8); cx.restore(); } }
      }, detailImg.current);
      const d = drag.current; if (d && !d.pan) { ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 1.5; ctx.fillStyle = 'rgba(74,222,128,0.12)'; const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1); ctx.fillRect(x, y, Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0)); ctx.strokeRect(x, y, Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0)); }
      const mc = miniRef.current; if (mc) { const mctx = mc.getContext('2d'); if (mctx) drawMinimap(mctx, g, mapImg.current, mc.width, mc.height, cam); }
      if (now - hud > 160) { hud = now; setTick(x => x + 1); }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [screen, say, setSelection]);

  // Primer plano a resolución de pantalla; nunca se reserva una imagen gigante a zoom máximo.
  useEffect(() => {
    if (screen !== 'playing' && screen !== 'paused') return;
    let previous = '', settled = false;
    const id = setInterval(() => {
      const g = gRef.current, c = camRef.current; if (!g) return;
      const key = [Math.round(c.x), Math.round(c.y), c.z, c.w, c.h].join(':');
      if (key !== previous) { previous = key; settled = false; return; }
      if (settled) return; settled = true;
      const old = detailImg.current, vw = c.w / c.z, vh = (c.h - HUD_H) / c.z;
      if (old && old.x <= c.x && old.y <= c.y && old.x + old.w >= c.x + vw && old.y + old.h >= c.y + vh && old.canvas.width / old.w >= Math.min(3, c.z * (window.devicePixelRatio || 1)) - 0.1) return;
      const region = { x: Math.max(0, c.x - 160), y: Math.max(0, c.y - 160), w: Math.min(g.terrain.w - Math.max(0, c.x - 160), vw + 320), h: Math.min(g.terrain.h - Math.max(0, c.y - 160), vh + 320) };
      const scale = Math.min(3, c.z * (window.devicePixelRatio || 1), Math.sqrt(6e6 / (region.w * region.h)));
      detailImg.current = { ...region, canvas: renderTerrain(g.terrain, scale, region) };
    }, 180);
    return () => clearInterval(id);
  }, [screen]);

  // ---------------------------------------------------------------- Teclado
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && (e.target.closest('input,textarea,select') || e.target.isContentEditable)) { keys.current.clear(); return; }
      const s = screenRef.current;
      if ((e.key === 'p' || e.key === 'P') && (s === 'playing' || s === 'paused')) { playLandButton(); setScreen(s === 'playing' ? 'paused' : 'playing'); return; }
      if ((s === 'sheet' || s === 'scenario') && e.key === 'Escape') { setScreen(s === 'scenario' ? 'sheet' : 'pick'); return; }
      if (s !== 'playing') return;
      if (e.key === 'Escape') { if (modeRef.current.k !== 'none') setMode({ k: 'none' }); else setSelection([]); return; }
      if (e.key.startsWith('Arrow')) e.preventDefault();
      keys.current.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    };
    const up = (e: KeyboardEvent) => { keys.current.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key); };
    const blur = () => { keys.current.clear(); drag.current = null; mouse.current.in = false; };
    window.addEventListener('blur', blur);
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('blur', blur); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [setSelection]);

  // ---------------------------------------------------------------- El mouse (o el dedo) sobre el mapa
  const toWorld = (x: number, y: number) => { const c = camRef.current; return { x: c.x + x / c.z, y: c.y + y / c.z }; };
  const pickAt = (wx: number, wy: number) => {
    const g = gRef.current!;
    const u = [...g.units].reverse().find(q => !q.dead && Math.abs(q.x - wx) < ROLE_STATS[q.role].size * 0.4 && wy < q.y + 10 && wy > q.y - ROLE_STATS[q.role].size);
    if (u) return { u };
    const b = [...g.buildings].reverse().find(q => !q.dead && Math.abs(q.x - wx) < BUILD_STATS[q.kind].size * 0.55 && wy < q.y + 12 && wy > q.y - BUILD_STATS[q.kind].size);
    return b ? { b } : {};
  };
  const myUnits = (ids: number[]) => { const g = gRef.current!; return ids.map(id => g.units.find(u => u.id === id && u.owner === 0 && !u.dead)).filter(Boolean) as Unit[]; };
  const command = (wx: number, wy: number) => {
    const g = gRef.current!, ids = myUnits([...selRef.current]).map(u => u.id);
    const b = g.buildings.find(q => selRef.current.has(q.id) && q.owner === 0);
    if (!ids.length && b) { b.rally = { x: wx, y: wy }; say('🚩 Los nuevos van a ir ahí'); return; }
    if (!ids.length) return;
    const r = orderSmart(g, ids, wx, wy); if (r === 'attack') playVampSword();
    characterSounds.current?.react(g,ids);
  };
  const onDown = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (screenRef.current !== 'playing') return;
    if (e.button === 1) e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect(), k = r.width / e.currentTarget.clientWidth || 1, x = (e.clientX - r.left) / k, y = (e.clientY - r.top) / k, w = toWorld(x, y);
    const g = gRef.current!, md = modeRef.current;
    if (e.button === 1) { e.preventDefault(); drag.current = { x0: x, y0: y, x1: x, y1: y, pan: true, id: e.pointerId, cx: camRef.current.x, cy: camRef.current.y }; return; } // (botón del medio: arrastra el mapa, como en Age of Empires)
    if (e.button === 2) { // click derecho: la orden (o cancelar lo que se estaba por hacer)
      if (md.k !== 'none') { setMode({ k: 'none' }); return; }
      command(w.x, w.y); return;
    }
    if (md.k === 'place') {
      const ws = myUnits([...selRef.current]).filter(u => u.role === 'worker').map(u => u.id);
      const b = placeBuilding(g, 0, md.kind, w.x, w.y, ws);
      if (b) { playKnock(); if (!e.shiftKey && md.kind !== 'wall') setMode({ k: 'none' }); } else say(!canPay(g.sides[0], BUILD_STATS[md.kind].cost) ? '💎 No te alcanzan los recursos' : '🚫 Ahí no se puede construir', 'place', 800);
      return;
    }
    if (md.k === 'power') { if (castPower(g, 0, w.x, w.y)) setMode({ k: 'none' }); return; }
    if (md.k === 'amove') { orderMove(g, myUnits([...selRef.current]).map(u => u.id), w.x, w.y, true); setMode({ k: 'none' }); return; }
    drag.current = { x0: x, y0: y, x1: x, y1: y, pan: e.pointerType === 'touch' || !e.shiftKey, id: e.pointerId, cx: camRef.current.x, cy: camRef.current.y };
  };
  const onMove = (e: RPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect(), k = r.width / e.currentTarget.clientWidth || 1, x = (e.clientX - r.left) / k, y = (e.clientY - r.top) / k, w = toWorld(x, y);
    mouse.current = { x, y, in: true, wx: w.x, wy: w.y };
    const d = drag.current; if (!d) return;
    d.x1 = x; d.y1 = y;
    if (d.pan) { const c = camRef.current; c.x = d.cx - (x - d.x0) / c.z; c.y = d.cy - (y - d.y0) / c.z; }
  };
  const lastClick = useRef({ t: 0, id: 0 });
  const onUp = (e: RPointerEvent<HTMLCanvasElement>) => {
    const d = drag.current; drag.current = null; if (!d || screenRef.current !== 'playing') return;
    const g = gRef.current!, moved = Math.hypot(d.x1 - d.x0, d.y1 - d.y0) > 8;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (d.pan && moved) return;
    if (moved) { // recuadro: elige a tus guerreros de adentro (si hay soldados, solo los soldados)
      const a = toWorld(Math.min(d.x0, d.x1), Math.min(d.y0, d.y1)), b = toWorld(Math.max(d.x0, d.x1), Math.max(d.y0, d.y1));
      const inside = g.units.filter(u => u.owner === 0 && !u.dead && u.x >= a.x && u.x <= b.x && u.y >= a.y && u.y - ROLE_STATS[u.role].size * 0.5 <= b.y);
      const army = inside.filter(u => u.role !== 'worker'), pick = (army.length ? army : inside).map(u => u.id);
      setSelection(e.shiftKey ? [...new Set([...selRef.current, ...pick])] : pick); setMode({ k: 'none' });
      return;
    }
    const w = toWorld(d.x0, d.y0), hit = pickAt(w.x, w.y), mineSel = myUnits([...selRef.current]).length > 0;
    const own = hit.u?.owner === 0 ? hit.u : hit.b?.owner === 0 ? hit.b : null;
    if (own && !(mineSel && hit.b && hit.b.built < 1)) {
      playLandButton();
      const now = performance.now();
      if (hit.u && lastClick.current.id === own.id && now - lastClick.current.t < 350) { // doble click: todos los de ese tipo que se ven
        const c = camRef.current, role = hit.u.role;
        setSelection(g.units.filter(u => u.owner === 0 && !u.dead && u.role === role && u.x > c.x && u.x < c.x + c.w / c.z && u.y > c.y && u.y < c.y + c.h / c.z).map(u => u.id));
      } else if (e.shiftKey && hit.u) setSelection([...new Set([...selRef.current, own.id])]);
      else setSelection([own.id]);
      lastClick.current = { t: now, id: own.id };
      return;
    }
    if (mineSel || g.buildings.some(b => selRef.current.has(b.id) && b.owner === 0)) { command(w.x, w.y); return; } // con tus guerreros elegidos: tocar el mapa es dar la orden
    if (hit.u || hit.b) setSelection([(hit.u ?? hit.b)!.id]); // (mirar a un enemigo)
    else setSelection([]);
  };
  const onWheel = (e: React.WheelEvent) => {
    if (!(e.target instanceof HTMLCanvasElement)) return;
    if (screenRef.current !== 'playing') return;
    const c = camRef.current, g = gRef.current, old = c.z, z = Math.max(g ? minZoom(g, c.w, c.h) : 0.6, Math.min(2.8, c.z * (e.deltaY > 0 ? 0.9 : 1.1)));
    const m = mouse.current; c.x += m.x / old - m.x / z; c.y += m.y / old - m.y / z; c.z = z;
  };
  const onMini = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (screenRef.current !== 'playing') return;
    if (e.buttons === 0 && e.type !== 'pointerdown') return;
    if (e.type === 'pointerdown') e.currentTarget.setPointerCapture(e.pointerId);
    const g = gRef.current; if (!g) return;
    const r = e.currentTarget.getBoundingClientRect(), wx = (e.clientX - r.left) / r.width * g.terrain.w, wy = (e.clientY - r.top) / r.height * g.terrain.h, c = camRef.current;
    if (e.button === 2 && e.type === 'pointerdown') { command(wx, wy); return; }
    c.x = wx - c.w / c.z / 2; c.y = wy - (c.h - HUD_H) / c.z / 2;
  };

  // ---------------------------------------------------------------- Lo que está elegido (para el menú de abajo)
  const g = game;
  const selUnits = g ? sel.map(id => g.units.find(u => u.id === id && !u.dead)).filter(Boolean) as Unit[] : [];
  const selB = g && !selUnits.length ? sel.map(id => g.buildings.find(b => b.id === id && !b.dead)).find(Boolean) as Building | undefined : undefined;
  const mine = selUnits.filter(u => u.owner === 0), workersSel = mine.some(u => u.role === 'worker');
  const side = g?.sides[0];
  const previewKind = mode.k === 'place' ? mode.kind : selB?.owner === 0 ? selB.kind : undefined;
  const focus = (x: number, y: number) => { const c = camRef.current; c.x = x - c.w / c.z / 2; c.y = y - (c.h - HUD_H) / c.z / 2; };
  const selectArmy = () => { if (!g) return; const a = g.units.filter(u => u.owner === 0 && !u.dead && u.role !== 'worker'); setSelection(a.map(u => u.id)); if (!a.length) say('Todavía no tenés soldados: hacé un cuartel'); };
  const selectIdle = () => { if (!g) return; const w = g.units.find(u => u.owner === 0 && !u.dead && u.role === 'worker' && u.order.k === 'idle'); if (w) { setSelection([w.id]); focus(w.x, w.y); } else say('No hay trabajadores sin hacer nada 👍'); };
  const goBase = () => { if (!g) return; const b = g.buildings.find(q => q.owner === 0 && q.kind === 'base' && !q.dead); if (b) { focus(b.x, b.y); setSelection([b.id]); } };

  // ---------------------------------------------------------------- Pantallas
  const viewD = CIVS[view];
  const sheetScreen = <div className="land-sheet" role="dialog" aria-label={`Lámina de ${viewD.name}`}>
    <div className="land-sheet-scroll"><LandInfographic civ={view}/></div>
    {simple && <div className="land-simple" style={{ ['--civ' as string]: viewD.color }}>
      <h2>{viewD.name}</h2><p className="land-simple-style">{viewD.style}</p>
      <h3>Guerreros</h3>
      <ul className="land-simple-units">{ROLE_ORDER.map(r => { const s = ROLE_STATS[r], mod = viewD.mod[r] ?? {}, m = { ...s, ...mod, cost: {...s.cost,...mod.cost} }; return <li key={r}><Sprite civ={view} idx={roleIdx(r)} w={96} h={108} /><div><b>{viewD.units[r]}</b><span>{roleText(view, r)}</span><strong className="land-attack-type">{attackText(view,r,m.range)}</strong><small>❤ {m.hp} · ⚔ {m.dmg} · {costText(m.cost)}</small></div></li>; })}</ul>
      <h3>Construcciones</h3>
      <ul className="land-simple-builds">{BKINDS.map(k => <li key={k}><BuildingSprite civ={view} kind={k} w={70} h={56} /><div><b>{viewD.buildings[k]}</b><span>{BUILD_TEXT[k]}</span><small>{costText(BUILD_STATS[k].cost)}</small></div></li>)}</ul>
      <h3>Poder especial: {viewD.power.name}</h3><p>{POWER_TEXT[viewD.power.kind]} Se carga peleando.</p>
      <h3>Mejoras (en la base)</h3><p>⚔️ Ataque, 🛡️ Vida y 👟 Velocidad: tres niveles cada una, para todo tu ejército.</p>
    </div>}
    <div className="land-sheet-bar">
      <button type="button" className="land-ghost" onClick={() => { playLandButton(); setScreen('pick'); }}>‹ Volver</button>
      <button type="button" className="land-ghost" aria-pressed={simple} onClick={() => { playLandButton(); setSimple(s => !s); }}>{simple ? 'Infograma' : 'Resumen'}</button>
      <button type="button" className="land-go" onClick={() => { playLandButton(); setCiv(view); setScreen('scenario'); }}>Elegir escenario ▶</button>
    </div>
  </div>;

  const playing = screen === 'playing' || screen === 'paused' || screen === 'won' || screen === 'lost';
  return <section className="land land-v7 land-v9" style={fit} aria-label="Land of Warriors" onContextMenu={e => e.preventDefault()}>
    {!playing && <div className="land-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1 className="land-logo" aria-label="Land of Warriors">{screen === 'pick' || screen === 'sheet' ? 'Civilizaciones' : screen === 'scenario' ? 'Escenarios' : 'Land of Warriors'}</h1>
      <span className="land-record">{Object.values(record).reduce((a, b) => a + b, 0) > 0 && <>Victorias <b>{Object.values(record).reduce((a, b) => a + b, 0)}</b></>}</span>
    </div>}

    {screen === 'pick' && <div className="land-pick">
      <div className="land-civ-list" aria-label="Las 10 civilizaciones">{CIV_IDS.map((c, i) => <button type="button" key={c} className="land-civ-choice" style={{ ['--civ' as string]: CIVS[c].color }} aria-label={CIVS[c].name}
        onClick={() => { playLandButton(); setCiv(c); setEnemies(list => list.map(e => e === c ? 'random' : e)); setView(c); setSimple(false); setScreen('sheet'); }}>
        <span className="land-civ-number">{String(i + 1).padStart(2, '0')}</span><Sprite civ={c} idx={roleIdx('elite')} w={150} h={138} />
        <span className="land-civ-copy"><b>{CIVS[c].name}</b><small>{CIVS[c].motto}</small><span>{CIVS[c].style}</span></span>
        <Sprite civ={c} idx={bIdx('base')} w={180} h={120} /><span className="land-civ-arrow">{record[c] ? '🏆 ' + record[c] : '↗'}</span>
      </button>)}</div>
      <div className="land-opts">
        <label>Cantidad de civilizaciones <select aria-label="Cantidad de civilizaciones" value={enemies.length + 1} onChange={e => { playLandButton(); const n = Number(e.target.value) - 1; setEnemies(list => Array.from({ length: n }, (_, i) => list[i] ?? 'random')); }}>
          {Array.from({ length: 9 }, (_, i) => <option key={i} value={i + 2}>{i + 2} civilizaciones</option>)}
        </select></label>
        <p className="land-roster-note">Vos y {enemies.length} {enemies.length === 1 ? 'rival' : 'rivales'} · Todos contra todos</p>
        <div className="land-rival-selectors">{enemies.map((enemy, index) => <label key={index}>Rival {index + 1}<select aria-label={`Civilización del rival ${index + 1}`} value={enemy} onChange={e => { playLandButton(); setEnemies(list => list.map((v, i) => i === index ? e.target.value as CivId | 'random' : v)); }}>
          <option value="random">Al azar</option>{CIV_IDS.filter(c => c !== civ && !enemies.some((other, i) => i !== index && other === c)).map(c => <option key={c} value={c}>{CIVS[c].name}</option>)}
        </select></label>)}</div>

        <div className="land-chips" role="group" aria-label="Dificultad"><span>Dificultad</span>{DIFF.map(([d, n]) => <button type="button" key={d} aria-pressed={diff === d} className={diff === d ? 'on' : ''} onClick={() => { playLandButton(); setDiff(d); }}>{n}</button>)}</div>
      </div>
    </div>}
    {screen === 'title' && <div className="land-title" style={{ backgroundImage: `url(${posterImg})` }}>
      <div className="land-title-text"><h2 className="land-metal" data-text="Land of Warriors">Land of Warriors</h2><p>Diez civilizaciones. Una sola tierra.</p>
        <button type="button" className="land-go land-start" onClick={() => { playLandButton(); setScreen('pick'); }} autoFocus>⚔️ Iniciar</button></div>
    </div>}
    {screen === 'sheet' && sheetScreen}
    {screen === 'scenario' && <div className="land-scen">
      <h2>Elegí el escenario</h2>
        <div className="land-chips" role="group" aria-label="Tamaño del mapa"><span>Tamaño</span>{MAP_SIZES.map(([k, n]) => <button type="button" key={k} aria-pressed={size === k} className={size === k ? 'on' : ''} onClick={() => { playLandButton(); setSize(k); }}>{n}<small>{MAP_SIZES.find(m => m[0] === k)![2].toLocaleString('es-AR')} × {MAP_SIZES.find(m => m[0] === k)![3].toLocaleString('es-AR')}</small></button>)}</div>
      <ul className="land-scen-list" role="group" aria-label="Elegir escenario">{THEMES.map((m, i) => <li key={i}><button type="button" aria-pressed={map === i + 1} className={map === i + 1 ? 'on' : ''} onClick={() => { playLandButton(); setMap(i + 1); }}>
        <MapThumb theme={i} /><b>{m.name}</b><small>{m.text}</small></button></li>)}</ul>
      <div className="land-sheet-bar land-scen-bar">
        <button type="button" className="land-ghost" onClick={() => { playLandButton(); setScreen('sheet'); }}>‹ Volver</button>
        <button type="button" className="land-go" onClick={() => { playLandButton(); start(civ); }}>⚔️ Iniciar</button>
      </div>
    </div>}
    {loading && <div className="land-overlay" role="status"><div className="land-card"><h2>Armando el escenario…</h2></div></div>}

    {playing && g && side && <div className="land-stage" ref={stageRef} onWheel={onWheel}>
      <canvas ref={canvasRef} className={mode.k === 'place' || mode.k === 'power' || mode.k === 'amove' ? 'land-aim' : ''} aria-label={`Partida en ${THEMES[g.terrain.theme].name}`} role="img"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onPointerLeave={() => { mouse.current.in = false; }} />
      <div className="land-top-left"><Link className="land-exit" to="/juegos" aria-label="Volver a Juegos">‹</Link><span>Escenario {g.map} — {THEMES[g.terrain.theme].name}</span></div>
      <button type="button" className="land-intel-toggle" aria-expanded={commsOpen} onClick={()=>setCommsOpen(open=>!open)}>Tropas y líder</button>
      <aside className={`land-intel land-own-intel${commsOpen?' land-intel-open':''}`} aria-label="Tu civilización y tropas">
        <section className="land-intel-card land-leader-card" style={{['--civ' as string]:CIVS[side.civ].color}}>
          <button type="button" className="land-intel-close" aria-label="Cerrar panel de tropas" onClick={()=>setCommsOpen(false)}>×</button>
          <div className="land-leader-heading"><LeaderPortrait civ={side.civ}/><div><small>TU LÍDER</small><h2>{CIVS[side.civ].name}</h2><span>{CIVS[side.civ].motto}</span></div></div>
          <p>{CIVS[side.civ].style}</p>
        </section>
        <section className="land-intel-card land-colony-card"><h3>TU ALDEA</h3>
          <dl><div><dt>Trabajadores</dt><dd>{g.units.filter(u=>u.owner===0&&!u.dead&&u.role==='worker').length}</dd></div><div><dt>Ejército</dt><dd>{g.units.filter(u=>u.owner===0&&!u.dead&&u.role!=='worker').length}</dd></div><div><dt>Población</dt><dd>{popUsed(g,0)} / {popCap(g,0)}</dd></div></dl>
          <p><strong>{CIVS[side.civ].power.name}</strong><br/>{POWER_TEXT[CIVS[side.civ].power.kind]}</p>
          <details><summary>Economía y defensas</summary><p>Azules para construir; dorados para tropas avanzadas; verdes para mejoras y élite. Protegé la aldea con {CIVS[side.civ].buildings.wall} y {CIVS[side.civ].buildings.tower}.</p></details>
          <time>Tiempo de partida {formatLandTime(g.t)}</time>
        </section>
        <div className="land-intel-card land-troops-card"><LandTroops game={g} selected={sel} onSelect={units=>{setSelection(units.map(u=>u.id));focus(units[0].x,units[0].y);setMode({k:'none'});setCommsOpen(false);}}/></div>
      </aside>
      {previewKind && <section className="land-build-preview" aria-label="Vista ampliada de construcción"><div><small>{mode.k==='place'?'A CONSTRUIR':'ESTRUCTURA SELECCIONADA'}</small><h3>{CIVS[side.civ].buildings[previewKind]}</h3></div><BuildingSprite civ={side.civ} kind={previewKind} w={260} h={175}/><p>{BUILD_TEXT[previewKind]}</p><span>{costText(BUILD_STATS[previewKind].cost)} · {BUILD_STATS[previewKind].time} s</span></section>}
      <div className="land-top-right" aria-label="Recursos">
        <span title="Diamantes (cristales dorados)"><i className="land-r-gem" /><b data-testid="land-gem">{Math.floor(side.gem)}</b></span>
        <span title="Minerales (cristales azules)"><i className="land-r-stone" /><b data-testid="land-stone">{Math.floor(side.stone)}</b></span>
        <span title="Energía verde: mejoras y unidades de élite"><i className="land-r-energy" /><b data-testid="land-energy">{Math.floor(side.energy)}</b></span>
        <span title="Población"><LandIcon kind="people" /><b>{popUsed(g, 0)} / {popCap(g, 0)}</b></span>
        <button type="button" className="land-sq" title="Ayuda" aria-label="Ayuda" onClick={() => say('Tocá para elegir; tocá el mapa para dar órdenes. Arrastrá con el botón izquierdo para explorar; Shift + arrastre selecciona grupos. Usá la rueda para acercarte y el botón derecho para dar órdenes.')}>?</button>
        <button type="button" className="land-sq" title="Pausa" aria-label={screen === 'paused' ? 'Seguir' : 'Pausa'} onClick={() => setScreen(st => st === 'playing' ? 'paused' : 'playing')}><LandIcon kind="gear" /></button>
      </div>
      {toast && <div key={toast.id} className="land-toast" role="status">{toast.text}</div>}
      {mode.k !== 'none' && <div className="land-mode">{mode.k === 'place' ? `Elegí dónde poner: ${CIVS[side.civ].buildings[mode.kind]}${mode.kind === 'wall' ? ' · Clic para sumar tramos; Escape para terminar' : ''}` : mode.k === 'power' ? 'Elegí dónde cae el poder' : 'Elegí a dónde atacar'} · <button type="button" onClick={() => { setMode({ k: 'none' }); }}>Cancelar</button></div>}
      <div className="land-hud" style={{ ['--civ' as string]: CIVS[side.civ].color }}>
        <div className="land-crest" aria-hidden="true"><LandEagle /></div>
        <div className="land-gems" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(i => <i key={i} />)}</div>
        <div className="land-mini"><div className="land-mini-map"><div className="land-tabs"><span><LandIcon kind="layers" /></span><span><LandIcon kind="radar" /></span></div><canvas ref={miniRef} width={220} height={150} onPointerDown={onMini} onPointerMove={onMini} aria-label="Mapa" /></div>
          <div className="land-quick"><button type="button" onClick={goBase} title="Ir a la base" aria-label="Ir a la base"><LandIcon kind="base" /></button><button type="button" onClick={selectArmy} title="Elegir todo el ejército" aria-label="Elegir todo el ejército"><LandIcon kind="army" /></button><button type="button" onClick={selectIdle} title="Un trabajador sin hacer nada" aria-label="Un trabajador sin hacer nada"><LandIcon kind="wrench" /></button></div>
        </div>
        <div className="land-sel">
          <ul className="land-group">{selUnits.slice(0, 10).map(u => <li key={u.id}><button type="button" onClick={() => setSelection([u.id])} title={CIVS[g.sides[u.owner].civ].units[u.role]} className={u.owner === 0 ? '' : 'foe'}><Sprite civ={g.sides[u.owner].civ} idx={roleIdx(u.role)} w={62} h={62} /><i style={{ width: `${u.hp / u.maxHp * 100}%` }} /></button></li>)}
            {selUnits.length > 10 && <li className="land-more">+{selUnits.length - 10}</li>}{selUnits.length > 0 && selUnits.length < 10 && Array.from({ length: 10 - selUnits.length }, (_, i) => <li key={'e' + i} className="land-slot" />)}
            {!selUnits.length && selB && <li className="land-group-b"><BuildingSprite civ={g.sides[selB.owner].civ} kind={selB.kind} w={150} h={110} /></li>}
            {!selUnits.length && !selB && <li className="land-help"><span>Arrastrá el terreno para explorar. Clic: seleccionar. Shift + arrastre: seleccionar grupo. Clic derecho: mover, recolectar o atacar. Rueda: acercar.</span></li>}</ul>
          {selUnits.length ? <UnitCard g={g} u={selUnits[0]} n={selUnits.length} /> : selB ? <BuildingCard g={g} b={selB} /> : <div className="land-card-unit land-card-empty"><b>{CIVS[side.civ].name}</b><small>{CIVS[side.civ].style}</small></div>}
        </div>
        {/* eslint-disable-next-line react-hooks/refs -- (los botones solo usan las referencias al tocarlos, no al dibujarse) */}
        <div className="land-cmds">{(() => {
          const pad = (els: React.ReactNode[]) => [...els, ...Array.from({ length: Math.max(0, 12 - els.filter(Boolean).length) }, (_, i) => <button type="button" key={'p' + i} className="land-slot land-command-inactive" disabled title="Seleccioná una unidad para habilitar esta orden"><LandIcon kind={['target', 'move', 'stop', 'army', 'rifle', 'shield', 'heal', 'wrench', 'rocket', 'blast', 'radar', 'layers'][(els.filter(Boolean).length + i) % 12]} /></button>)];
          const cmd = (key: string, icon: React.ReactNode, title: string, onClick: () => void, o: { disabled?: boolean; cost?: Cost; badge?: string } = {}) =>
            <button type="button" key={key} disabled={o.disabled} title={title} aria-label={title} onClick={onClick}>{icon}{o.badge && <em>{o.badge}</em>}{o.cost && <small>{costText(o.cost)}</small>}</button>;
          const ic = (t: string) => <LandIcon kind={({ '🎯': 'target', '➡️': 'move', '⛔': 'stop', '⚔️': 'army', '✨': 'blast', '✋': 'stop', '✖': 'stop', '🛡️': 'shield', '👟': 'move' } as Record<string, string>)[t] ?? 'rifle'} />;
          if (selB && selB.owner === 0) {
            const bs = BUILD_STATS[selB.kind], c = CIVS[side.civ];
            if (selB.built < 1) return <p className="land-cmd-note">En construcción: {Math.round(selB.built * 100)}%. Mandá trabajadores para que termine más rápido.</p>;
            return <>{pad([
              ...bs.makes.map(r => { const st = unitStats(g, 0, r), full = popUsed(g, 0) + st.pop > popCap(g, 0);
                return cmd(r, <Sprite civ={side.civ} idx={roleIdx(r)} w={46} h={46} />, `${c.units[r]}: ${roleText(side.civ, r)}${full ? ' (falta población: hacé un depósito)' : ''}`, () => { if (!train(g, selB.id, r)) say('No se puede ahora'); }, { disabled: !canPay(side, st.cost) || full, cost: st.cost }); }),
              ...(selB.kind === 'base' ? UPGRADES.map(up => { const lv = side.up[up], cost = UPGRADE_COST(lv);
                return cmd(up, ic(UP_ICON[up]), `Mejorar ${UP_NAME[up]} de todo el ejército (nivel ${lv + 1}, ${UPGRADE_TIME} s)`, () => research(g, selB.id, up), { disabled: lv >= MAX_UPGRADE || !!selB.research || !canPay(side, cost), cost: lv >= MAX_UPGRADE ? undefined : cost, badge: lv >= MAX_UPGRADE ? 'MÁX' : 'I'.repeat(lv + 1) }); }) : []),
              selB.queue.length > 0 ? cmd('cancel', ic('✖'), 'Cancelar el último', () => cancelTrain(g, selB.id)) : null])}</>;
          }
          if (workersSel) return <>{pad([...BKINDS.map(k => { const st = BUILD_STATS[k], needs = st.needs && !hasBuilt(g, 0, st.needs);
            return cmd(k, <BuildingSprite civ={side.civ} kind={k} w={54} h={44} />, `${CIVS[side.civ].buildings[k]}: ${BUILD_TEXT[k]}${needs ? ` (necesita ${CIVS[side.civ].buildings[st.needs!]})` : ''}`, () => setMode({ k: 'place', kind: k }), { disabled: !canPay(side, st.cost) || !!needs, cost: st.cost }); }),
            cmd('stop', ic('✋'), 'Parar', () => { for (const u of mine) u.order = { k: 'idle' }; })])}</>;
          if (mine.length) return <>{pad([
            cmd('amove', ic('🎯'), 'Atacar a un lugar: caminan y atacan a todo lo que encuentren', () => setMode({ k: 'amove' })),
            cmd('move', ic('➡️'), 'Mover: tocá el mapa para que vayan', () => say('Tocá el mapa para que vayan ahí')),
            cmd('stop', ic('⛔'), 'Parar', () => { for (const u of mine) u.order = { k: 'idle' }; }),
            cmd('all', ic('⚔️'), 'Elegir todo el ejército', () => selectArmy()),
            side.power >= POWER_MAX ? cmd('power', ic('✨'), CIVS[side.civ].power.name, () => { if (CIVS[side.civ].power.kind === 'strike') setMode({ k: 'power' }); else castPower(g, 0); }) : null])}</>;
          return <>{pad([])}</>;
        })()}</div>
      </div>
    </div>}

    {(screen === 'paused' || screen === 'won' || screen === 'lost') && g && side && <div className="land-overlay" role="dialog" aria-labelledby="land-msg">
      <div className="land-card">
        {screen === 'paused' && <><h2 id="land-msg">Pausa</h2>
          <button type="button" className="land-go" onClick={() => { setScreen('playing'); }} autoFocus>Seguir</button>
          <button type="button" className="land-ghost" onClick={() => { setScreen('pick'); }}>Volver al menú</button></>}
        {screen !== 'paused' && <><h2 id="land-msg" className={screen === 'won' ? 'land-win' : 'land-lose'}>{screen === 'won' ? '¡Victoria!' : 'Derrota'}</h2>
          <p>{screen === 'won' ? `${CIVS[side.civ].name} destruyó todas las bases rivales.` : 'Tu base fue destruida.'}</p>
          <ul className="land-stats"><li>Tiempo <b>{formatLandTime(g.t)}</b></li><li>Enemigos vencidos <b>{side.kills}</b></li><li>Perdidos <b>{side.lost}</b></li><li>Cristales juntados <b>{Math.round(side.gathered)}</b></li></ul>
          <button type="button" className="land-go" onClick={() => start(civ)} autoFocus>Jugar de nuevo</button>
          <button type="button" className="land-ghost" onClick={() => { setScreen('pick'); }}>Volver al menú</button></>}
      </div>
    </div>}
  </section>;
}

function UnitCard({ g, u, n }: { g: LandGame; u: Unit; n: number }) {
  const civ = g.sides[u.owner].civ, s = unitStats(g, u.owner, u.role), c = CIVS[civ];
  return <div className="land-card-unit"><div className="land-portrait"><Sprite civ={civ} idx={roleIdx(u.role)} w={104} h={132} portrait /></div>
    <div><b>{c.units[u.role]}{n > 1 ? ` ×${n}` : ''}</b><small>{u.owner === 0 ? ROLE_KIND[u.role] : `Enemigo · ${c.name}`}</small>
      <span className="land-hp"><i style={{ width: `${u.hp / u.maxHp * 100}%` }} /><em>💚 {Math.ceil(u.hp)} / {Math.round(u.maxHp)}</em></span>
      <ul><li>⚔️ Daño: {Math.round(s.dmg)}</li><li>🛡️ Armadura: {g.sides[u.owner].up.armor}</li><li>🎯 Alcance: {Math.max(1, Math.round(s.range / 30))}</li></ul>
      {u.carry > 0 && <small>Lleva {u.carry} {u.carryKind === 'energy' ? 'energía 🟢' : u.carryKind === 'gem' ? 'diamantes 🔶' : 'minerales 🔷'}</small>}</div></div>;
}
function BuildingCard({ g, b }: { g: LandGame; b: Building }) {
  const civ = g.sides[b.owner].civ, c = CIVS[civ];
  return <div className="land-card-unit"><div><b>{c.buildings[b.kind]}</b><small>{b.owner === 0 ? BUILD_TEXT[b.kind] : `Enemigo · ${c.name}`}</small>
    <span className="land-hp"><i style={{ width: `${b.hp / b.maxHp * 100}%` }} /><em>💚 {Math.ceil(b.hp)} / {b.maxHp}</em></span>
    <ul>{b.queue.length > 0 && <li>Haciendo: {c.units[b.queue[0]]} ({Math.round(b.qT / ROLE_STATS[b.queue[0]].time * 100)}%){b.queue.length > 1 ? ` +${b.queue.length - 1}` : ''}</li>}{b.research && <li>Mejora: {UP_NAME[b.research]} ({Math.round(b.rT / UPGRADE_TIME * 100)}%)</li>}</ul></div></div>;
}
const ROLE_KIND: Record<Role, string> = { worker: 'Trabajador', melee: 'Infantería · Principal', ranged: 'Infantería · A distancia', special: 'Apoyo', heavy: 'Máquina pesada', elite: 'Élite' };
const SCENES = import.meta.glob('./assets/land/scenes/scene-*.webp', { eager: true, import: 'default' }) as Record<string, string>;
function MapThumb({ theme }: { theme: number }) {
  const src = SCENES['./assets/land/scenes/scene-' + theme + '.webp'];
  return src ? <img src={src} alt={'Paisaje de ' + THEMES[theme].name} loading="lazy" /> : <span className="land-thumb-wait" aria-hidden="true" />;
}
