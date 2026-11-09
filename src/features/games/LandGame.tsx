import {BASE_CAMERA_ZOOM,MIN_CAMERA_ZOOM,MAX_CAMERA_ZOOM,selectedInBox} from './landTactics';
import {CivTraits} from './landCivTraits';
import {ResourceIcon,LandCost,resourceCostText} from './landResource';
import {LandReferenceFrame,LandReferenceCommandIcon} from './landReferenceFrame';
import {LandSelectionStrip} from './landSelectionStrip';
import {nativeAnimationsReady} from './landNativeAnimation';
import {mineralMultiplier,DEFAULT_LAND_OPTIONS,POPULATION_LIMITS,MINERAL_OPTIONS,type PopulationLimit,type MineralAbundance} from './landOptions';
import {affordableTrainingCost,LEVEL_HEALTH} from './landBalance';
import {STRUCTURE_UPGRADES,STRUCTURE_NAMES,MAX_STRUCTURE_LEVEL,structureUpgradeCost,structureUpgradeTime,structureBenefit} from './landBalance';
import './land.css';
import './landHud.css';
import './landInterface.css';
import './landReadable.css';
import './landReferenceHud.css';
import './landVillageHud.css';
import './landResourceHud.css';
import './landTactics.css';
import { BuildingSprite, Sprite } from './landSprite';
import { LandInfographic,LeaderPortrait } from './landInfographic';
import {LandInspector} from './landInspector';
import {evolutionLevel,evolutionCost,evolutionTime,MAX_EVOLUTION,foodPercent,foodRate,FOOD_NAMES,FOOD_CAPACITY,FOOD_WEIGHT,unitFoodRate} from './landProvision';
import {landHudHeight} from './landLayout';
import {previousLandMenu,type LandScreen} from './landNavigation';
import { LandTroops } from './landTroops';
import {LandLeaderPanel} from './landLeaderPanel';
import {LandLeaderReports,missingResources,readySoldiers,type LeaderMessage} from './landLeader';
import { LandIcon, LandEagle } from './LandIcon';
import { worldPropsReady } from './landProps';
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  BUILD_STATS, BKINDS, POWER_MAX, ROLE_STATS, canPay, canPlace, cancelTrain, formatLandTime, hasBuilt, newLandGame, orderMove, orderSmart,
  placeBuilding, popCap, popUsed, researchEvolution,researchInfrastructure, trainingDuration, stepLand, takeLandEvents, train, unitStats, castPower, type BKind, type Building, type Cost, type Difficulty, type LandGame, type Role, type Unit,
} from './land';
import { BUILD_TEXT, CIVS, CIV_IDS, POWER_TEXT, TRAINING_ROLE, attackText, roleText, type CivId } from './landCivs';
import { wallPoint, wallsReady } from './landWalls';
import { MAP_SIZES, THEMES, type MapSize } from './landMap';
import { renderTerrain, terrainMaterialsReady, type TerrainRegion } from './landMapArt';
import { bIdx, drawMinimap, drawSprite, drawWorld, roleIdx, spritesReady, type Cam } from './landArt';
import { useFitScreen } from './fitScreen';
import { playExplosion, playGameOver, playKnock, playVampSword, playWinFanfare } from './sounds';
import { playLandButton, preloadLandSounds, setLandMenuMusic,setLandGameMusic,resetLandGameMusic } from './landAudio';
import { LandCharacterSounds } from './landCharacterSounds';

import posterImg from './assets/land/poster.webp';
const RECORD_KEY = 'escritorio-personal-juegos:land-victorias';
export function readLandRecord(): Record<string, number> { try { return JSON.parse(localStorage.getItem(RECORD_KEY) ?? '{}') ?? {}; } catch { return {}; } }
function saveWin(c: CivId) { try { const r = readLandRecord(); r[c] = (r[c] ?? 0) + 1; localStorage.setItem(RECORD_KEY, JSON.stringify(r)); } catch { /* sin almacenamiento */ } }
const ROLE_ORDER: Role[] = ['worker', 'melee', 'ranged', 'special', 'heavy', 'elite'];
const DIFF: [Difficulty, string][] = [['veryEasy', 'Muy fácil'], ['easy', 'Fácil'], ['normal', 'Normal'], ['hard', 'Difícil']];
const costText=resourceCostText;
type Screen = LandScreen;
const HUD_H = landHudHeight; // (el alto del menú de abajo)
const minZoom = (g: LandGame, w: number, h: number) => Math.max(MIN_CAMERA_ZOOM, w / g.terrain.w, (h - HUD_H(w)) / g.terrain.h);
type Mode = { k: 'none' } | { k: 'place'; kind: BKind } | { k: 'power' } | { k: 'amove' };

export function LandOfWarriors() {
  const fit = useFitScreen();
  const [screen, setScreen] = useState<Screen>('title');
  const [musicMuted,setMusicMuted]=useState(false);
  const [commandHelp,setCommandHelp]=useState<{text:string;cost?:Cost}|null>(null);
  const scenarioFrom=useRef<'pick'|'sheet'>('pick');
  const [civ, setCiv] = useState<CivId>('humano');
  const [view, setView] = useState<CivId>('humano'); // la lámina que se está mirando
  const [simple, setSimple] = useState(false);
  const [enemies, setEnemies] = useState<(CivId | 'random')[]>(['random']);
  const [commsOpen, setCommsOpen] = useState(false);
  const [map, setMap] = useState(5);
  const [populationLimit,setPopulationLimit]=useState<PopulationLimit>(DEFAULT_LAND_OPTIONS.populationLimit);
  const [mineralAbundance,setMineralAbundance]=useState<MineralAbundance>(DEFAULT_LAND_OPTIONS.mineralAbundance);
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
  const [leaderMessages,setLeaderMessages]=useState<LeaderMessage[]>([]);
  const leaderReports=useRef(new LandLeaderReports());
  const messageId=useRef(0);
  const camRef = useRef<Cam>({ x: 0, y: 0, w: 1200, h: 700, z: 1 });
  const stageRef = useRef<HTMLDivElement>(null), canvasRef = useRef<HTMLCanvasElement>(null), miniRef = useRef<HTMLCanvasElement>(null);
  const mapImg = useRef<HTMLCanvasElement | null>(null);
  const detailImg = useRef<(TerrainRegion & { canvas: HTMLCanvasElement }) | null>(null);
  const screenRef = useRef(screen);
  useEffect(() => { screenRef.current = screen; }, [screen]);
  const mouse = useRef({ x: 0, y: 0, in: false, wx: 0, wy: 0 });
  const drag = useRef<{ x0: number; y0: number; x1: number; y1: number; pan: boolean; button?:number; id: number; cx: number; cy: number } | null>(null);
  const keys = useRef<Set<string>>(new Set());
  const characterSounds=useRef<LandCharacterSounds|null>(null);
  const leaderWriting=useCallback((on:boolean)=>characterSounds.current?.leaderWriting(on),[]);
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
  useEffect(()=>{if(screen!=='playing'&&screen!=='paused'){resetLandGameMusic();return;}const update=()=>setLandGameMusic(screen==='playing'&&!document.hidden,musicMuted);update();document.addEventListener('visibilitychange',update);const kick=()=>{if(screen==='playing'&&!document.hidden)setLandGameMusic(true,musicMuted);};window.addEventListener('pointerdown',kick);return()=>{document.removeEventListener('visibilitychange',update);window.removeEventListener('pointerdown',kick);setLandGameMusic(false,musicMuted);};},[screen,musicMuted]);
  useEffect(() => () => {setLandMenuMusic(false);resetLandGameMusic();}, []);
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __landGame?: () => LandGame | null; __landCam?: () => Cam }).__landGame = () => gRef.current; (window as unknown as { __landCam?: () => Cam }).__landCam = () => camRef.current; }, []); // (para probar en desarrollo)
  const say = useCallback((text: string, key = text, gap = 0) => { const now = performance.now(); if (gap && now - (lastToast.current[key] ?? -1e9) < gap) return; lastToast.current[key] = now; const message={text,id:++messageId.current,time:gRef.current?.t??0};setLeaderMessages(old=>[...old.slice(-19),message]); }, []);
  const setSelection = useCallback((ids: number[]) => { if(gRef.current&&ids.some(id=>!selRef.current.has(id)))characterSounds.current?.react(gRef.current,ids);selRef.current = new Set(ids); setSel(ids); }, []);

  // ---------------------------------------------------------------- Empezar una partida
  const start = useCallback((civ: CivId) => {
    resetLandGameMusic();
    characterSounds.current?.start(civ);
    setCiv(civ); setLoading(true);
    const available = CIV_IDS.filter(c => c !== civ), foes = enemies.map(e => {
      const selected = e !== 'random' && available.includes(e) ? e : available[Math.floor(Math.random() * available.length)];
      available.splice(available.indexOf(selected), 1); return selected;
    });
    let attempts = 0;
    const prepare = () => {
      if ((!spritesReady() || !terrainMaterialsReady() || !worldPropsReady() || !wallsReady() || !nativeAnimationsReady([civ,...foes])) && attempts++ < 160) { setTimeout(prepare, 50); return; }
      const g = newLandGame(civ, foes, map, diff, Date.now(), size,{populationLimit,mineralAbundance}); gRef.current = g; setGame(g);
      leaderReports.current=new LandLeaderReports();lastToast.current={};setLeaderMessages([{id:++messageId.current,time:0,text:'Ya estamos en posición. Organicemos la recolección y preparemos nuestras defensas. Te informaré los movimientos enemigos y el resultado de cada enfrentamiento.'}]);
      detailImg.current = null; mapImg.current = renderTerrain(g.terrain);
      const base = g.buildings.find(b => b.owner === 0)!;
      camRef.current = { ...camRef.current, z: BASE_CAMERA_ZOOM, x: base.x - 300, y: base.y - 200 };
      setCommsOpen(false); setSelection([]); setMode({ k: 'none' }); setLoading(false); setScreen('playing');
    };
    setTimeout(prepare, 60);
  }, [enemies, map, diff, size, populationLimit, mineralAbundance, setSelection]);

  // ---------------------------------------------------------------- Carteles que guían al jugador (solo cuando hace falta, y cada uno de vez en cuando)
  useEffect(() => {
    if (screen !== 'playing') return;
    const id = setInterval(() => {
      const g = gRef.current; if (!g || g.phase !== 'play') return;
      const side = g.sides[0], civ = CIVS[side.civ], mine = g.units.filter(u => u.owner === 0 && !u.dead), drops = g.buildings.filter(b => b.owner === 0 && !b.dead && (b.kind === 'base' || b.kind === 'depot'));
      const near = (kind: 'stone' | 'gem') => g.nodes.filter(n => n.kind === kind && drops.some(d => Math.hypot(d.x - n.x, d.y - n.y) < 600)).reduce((a, n) => a + n.amount, 0);
      const idle = mine.filter(u => u.role === 'worker' && u.order.k === 'idle').length, army = mine.filter(u => u.role !== 'worker').length;
      const hint = (key: string, text: string, gap = 90000) => say(text, key, gap);
      if(side.food<=0)hint('nofood','Las tropas están detenidas por falta de alimento. Asigná trabajadores a las cosechas y entregá la producción en el Almacén.',30000);
      else if(side.food<100)hint('food','Queda menos del 20% de alimento. Prepará más cosechas y acercá el Almacén.',60000);
      else if (g.t > 20 && idle >= 2) hint('idle', `⛏️ Tenés ${idle} trabajadores sin hacer nada: asigná algunos a piedras y cosechas, y otros a cristales`, 45000);
      else if (g.t > 30 && near('stone') < 900) hint('stone', '🔷 Hay pocos minerales cerca de tu base: buscá otra zona y construí un depósito ahí', 120000);
      else if (g.t > 30 && near('gem') < 300) hint('gem', '🔶 Se están acabando los diamantes cerca: buscá más en el mapa', 120000);
      else if (popUsed(g, 0) >= popCap(g, 0) && popCap(g, 0) < g.populationLimit) hint('pop', `👥 Llegaste al límite de población: construí un ${civ.buildings.depot}`, 60000);
      else if (g.t > 35 && !g.buildings.some(b => b.owner === 0 && b.kind === 'workerBarracks') && side.stone >= 100) hint('workers', `🏗️ Construí ${civ.buildings.workerBarracks} para entrenar más trabajadores`, 70000);
      else if (g.t > 50 && !g.buildings.some(b => b.owner === 0 && b.kind === 'barracks') && side.stone >= 150) hint('barracks', `🏗️ Construí ${civ.buildings.barracks}: entrena únicamente ${civ.units.melee}`, 70000);
      else if (g.t > 150 && army < 3 && g.ai.wave === 0 && g.t > g.ai.waveAt - 40) hint('army', '⚠️ El enemigo está armando un ejército: entrená soldados', 90000);
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
        const sp = 1100 * dt / cam.z, ks = keys.current, m = mouse.current, edge = 22, panelTop = h - HUD_H(w);
        let dx = (ks.has('ArrowRight') || ks.has('d') ? 1 : 0) - (ks.has('ArrowLeft') || ks.has('a') ? 1 : 0), dy = (ks.has('ArrowDown') || ks.has('s') ? 1 : 0) - (ks.has('ArrowUp') || ks.has('w') ? 1 : 0);
        if (m.in && !drag.current) { if (m.x < edge) dx = -1; else if (m.x > w - edge) dx = 1; if (m.y < edge) dy = -1; else if (m.y > panelTop - 4 && m.y < panelTop + 6) dy = 1; }
        cam.x += dx * sp; cam.y += dy * sp;
        stepLand(g, dt);
        for (const e of takeLandEvents(g)) {
          const nearby=('x' in e)&&e.x!==undefined&&e.y!==undefined&&e.x>=cam.x-100&&e.x<=cam.x+w/cam.z+100&&e.y>=cam.y-100&&e.y<=cam.y+(h-HUD_H(w))/cam.z+100;
          leaderReports.current.event(g,e);
          if(nearby)characterSounds.current?.combat(g,e,'x' in e&&e.x!==undefined?((e.x-cam.x)*cam.z/w-.5)*1.3:0);
          if(e.type==='trained'&&e.owner===0)characterSounds.current?.call(g.sides[0].civ,e.role,g.t);
          if((e.type==='built'||e.type==='trained')&&(e.owner===0||nearby))characterSounds.current?.eventSound(g,e.type);
          if (e.type === 'die' && e.building && nearby) playExplosion();
          else if (e.type === 'built' && e.owner === 0) { say(`🏗️ ${CIVS[g.sides[0].civ].buildings[e.kind]} terminado`); }
          else if (e.type === 'trained' && e.owner === 0 && e.role !== 'worker') say(`✅ ${CIVS[g.sides[0].civ].units[e.role]} listo`, 'trained', 2500);
          else if(e.type==='infrastructure'&&e.owner===0)say(STRUCTURE_NAMES[e.kind]+' de construcciones: nivel '+e.level);
          else if(e.type==='upgraded'&&e.owner===0)say('Nueva evolución: '+(e.role?CIVS[g.sides[0].civ].units[e.role]:'')+' nivel '+e.level);
          else if (e.type === 'power') { playExplosion(); say(e.owner === 0 ? `✨ ¡${CIVS[g.sides[0].civ].power.name}!` : `⚠️ El enemigo usó ${CIVS[g.sides[e.owner].civ].power.name}`); }
          else if (e.type === 'attacked') say('⚠️ ¡Te están atacando!', 'attacked', 15000);
          else if (e.type === 'won') { playWinFanfare(); saveWin(g.sides[0].civ); setRecord(readLandRecord()); setScreen('won'); }
          else if (e.type === 'lost') { playGameOver(); setScreen('lost'); }
        }
        characterSounds.current?.tick(g,cam,selRef.current);
        for(const text of leaderReports.current.tick(g))say(text);
        // los elegidos que se murieron salen de la selección
        if ([...selRef.current].some(id => !g.units.some(u => u.id === id && !u.dead) && !g.buildings.some(b => b.id === id && !b.dead))) setSelection([...selRef.current].filter(id => g.units.some(u => u.id === id && !u.dead) || g.buildings.some(b => b.id === id && !b.dead)));
      } else stepLand(g, 0);
      cam.z = Math.max(cam.z, minZoom(g, w, h)); // (nunca se ve afuera del mapa)
      cam.x = Math.max(0, Math.min(g.terrain.w - w / cam.z, cam.x)); cam.y = Math.max(0, Math.min(g.terrain.h - (h - HUD_H(w)) / cam.z, cam.y));
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
      const old = detailImg.current, vw = c.w / c.z, vh = (c.h - HUD_H(c.w)) / c.z;
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
      if ((s === 'pick'||s === 'sheet' || s === 'scenario') && e.key === 'Escape') { setScreen(previousLandMenu(s,scenarioFrom.current)); return; }
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
    const u = [...g.units].reverse().find(q => !q.dead && Math.abs(q.x - wx) < unitStats(g,q.owner,q.role).size * 0.4 && wy < q.y + 10 && wy > q.y - unitStats(g,q.owner,q.role).size);
    if (u) return { u };
    const b = [...g.buildings].reverse().find(q => !q.dead && Math.abs(q.x - wx) < BUILD_STATS[q.kind].size * 0.55 && wy < q.y + 12 && wy > q.y - BUILD_STATS[q.kind].size);
    return b ? { b } : {};
  };
  const myUnits = (ids: number[]) => { const g = gRef.current!; const set=new Set(ids);return g.units.filter(u=>set.has(u.id)&&u.owner===0&&!u.dead); };
  const command = (wx: number, wy: number) => {
    const g = gRef.current!, ids = myUnits([...selRef.current]).map(u => u.id);
    const b = g.buildings.find(q => selRef.current.has(q.id) && q.owner === 0);
    if (!ids.length && b) { b.rally = { x: wx, y: wy }; say('🚩 Los nuevos van a ir ahí'); return; }
    if (!ids.length) return;
    const hit=pickAt(wx,wy),foe=hit.u&&hit.u.owner!==0?hit.u:hit.b&&hit.b.owner!==0?hit.b:null;const r = orderSmart(g, ids, foe?.x??wx, foe?.y??wy); if (r === 'attack') playVampSword();
    characterSounds.current?.react(g,ids);
  };
  const onDown = (e: RPointerEvent<HTMLCanvasElement>) => {
    setCommandHelp(null);
    if (screenRef.current !== 'playing') return;
    if (e.button === 1) e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect(), k = r.width / e.currentTarget.clientWidth || 1, x = (e.clientX - r.left) / k, y = (e.clientY - r.top) / k, w = toWorld(x, y);
    const g = gRef.current!, md = modeRef.current;
    if (e.button === 1) { e.preventDefault(); drag.current = { x0: x, y0: y, x1: x, y1: y, pan: true, id: e.pointerId, cx: camRef.current.x, cy: camRef.current.y }; return; } // (botón del medio: arrastra el mapa, como en Age of Empires)
    if (e.button === 2) { // click derecho: la orden (o cancelar lo que se estaba por hacer)
      if (md.k !== 'none') { setMode({ k: 'none' }); return; }
      drag.current={x0:x,y0:y,x1:x,y1:y,pan:false,button:2,id:e.pointerId,cx:camRef.current.x,cy:camRef.current.y};return;
    }
    if (md.k === 'place') {
      const ws = myUnits([...selRef.current]).filter(u => u.role === 'worker').map(u => u.id);
      const b = placeBuilding(g, 0, md.kind, w.x, w.y, ws);
      if (b) { playKnock(); if (!e.shiftKey && md.kind !== 'wall') setMode({ k: 'none' }); } else say(missingResources(g,BUILD_STATS[md.kind].cost)||'🚫 Ahí no se puede construir', 'place', 800);
      return;
    }
    if (md.k === 'power') { if (castPower(g, 0, w.x, w.y)) setMode({ k: 'none' }); return; }
    if (md.k === 'amove') { orderMove(g, myUnits([...selRef.current]).map(u => u.id), w.x, w.y, true); setMode({ k: 'none' }); return; }
    drag.current = { x0: x, y0: y, x1: x, y1: y, pan: e.pointerType === 'touch' || !e.shiftKey, id: e.pointerId, cx: camRef.current.x, cy: camRef.current.y };
  };
  const onMove = (e: RPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect(), k = r.width / e.currentTarget.clientWidth || 1, x = (e.clientX - r.left) / k, y = (e.clientY - r.top) / k, w = toWorld(x, y);
    mouse.current = { x, y, in: true, wx: w.x, wy: w.y };const hit=pickAt(w.x,w.y);e.currentTarget.dataset.attack=screenRef.current==='playing'&&myUnits([...selRef.current]).length>0&&((hit.u?.owner??0)>0||(hit.b?.owner??0)>0)?'true':'false';
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
      const pick=selectedInBox(g,a,b,u=>unitStats(g,u.owner,u.role).size);
      setSelection(e.shiftKey||e.ctrlKey ? [...new Set([...selRef.current, ...pick])] : pick); setMode({ k: 'none' });
      return;
    }
    if(d.button===2){const w=toWorld(d.x0,d.y0);command(w.x,w.y);return;}
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
    const c = camRef.current, g = gRef.current, old = c.z, z = Math.max(g ? minZoom(g, c.w, c.h) : 0.6, Math.min(MAX_CAMERA_ZOOM, c.z * (e.deltaY > 0 ? 0.9 : 1.1)));
    const m = mouse.current; c.x += m.x / old - m.x / z; c.y += m.y / old - m.y / z; c.z = z;
  };
  const onMini = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (screenRef.current !== 'playing') return;
    if (e.buttons === 0 && e.type !== 'pointerdown') return;
    if (e.type === 'pointerdown') e.currentTarget.setPointerCapture(e.pointerId);
    const g = gRef.current; if (!g) return;
    const r = e.currentTarget.getBoundingClientRect(), wx = (e.clientX - r.left) / r.width * g.terrain.w, wy = (e.clientY - r.top) / r.height * g.terrain.h, c = camRef.current;
    if (e.button === 2 && e.type === 'pointerdown') { command(wx, wy); return; }
    c.x = wx - c.w / c.z / 2; c.y = wy - (c.h - HUD_H(c.w)) / c.z / 2;
  };

  // ---------------------------------------------------------------- Lo que está elegido (para el menú de abajo)
  const g = game;
  const selUnits = g ? sel.map(id => g.units.find(u => u.id === id && !u.dead)).filter(Boolean) as Unit[] : [];
  const selB = g && !selUnits.length ? sel.map(id => g.buildings.find(b => b.id === id && !b.dead)).find(Boolean) as Building | undefined : undefined;
  const mine = selUnits.filter(u => u.owner === 0), workersSel = mine.some(u => u.role === 'worker');
  const side = g?.sides[0];
  const focus = (x: number, y: number) => { const c = camRef.current; c.x = x - c.w / c.z / 2; c.y = y - (c.h - HUD_H(c.w)) / c.z / 2; };
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
      <ul className="land-simple-units">{ROLE_ORDER.map(r => { const s = ROLE_STATS[r], mod = viewD.mod[r] ?? {}, m = { ...s, ...mod, cost: affordableTrainingCost({...s.cost,...mod.cost}) }; return <li key={r}><Sprite civ={view} idx={roleIdx(r)} w={96} h={108} level={1}/><div><b>{viewD.units[r]} Nivel 1</b><span>{roleText(view, r)}</span><strong className="land-attack-type">{attackText(view,r,m.range)}</strong><small>❤ {Math.round(m.hp*LEVEL_HEALTH[1])} · ⚔ {m.dmg} · <LandCost cost={m.cost}/></small></div></li>; })}</ul>
      <h3>Construcciones</h3>
      <ul className="land-simple-builds">{BKINDS.map(k => <li key={k}><BuildingSprite civ={view} kind={k} w={70} h={56} /><div><b>{viewD.buildings[k]}</b><span>{BUILD_TEXT[k]}</span><small><LandCost cost={BUILD_STATS[k].cost}/></small></div></li>)}</ul>
      <h3>Poder especial: {viewD.power.name}</h3><p>{POWER_TEXT[viewD.power.kind]} Se carga peleando.</p>
      <h3>Mejoras</h3><p>Cada personaje tiene cuatro niveles y evoluciona en su cuartel. El centro de mando mejora Producción y Fortificación. El entrenamiento inicial tarda 60 segundos.</p>
    </div>}
    <div className="land-sheet-bar">
      <button type="button" className="land-ghost" onClick={() => { setScreen('pick'); }}>‹ Volver</button>
      <button type="button" className="land-ghost" aria-pressed={simple} onClick={() => { setSimple(s => !s); }}>{simple ? 'Infograma' : 'Resumen'}</button>
      <button type="button" className="land-go" onClick={() => { setCiv(view);scenarioFrom.current='sheet'; setScreen('scenario'); }}>Elegir escenario ▶</button>
    </div>
  </div>;

  const playing = screen === 'playing' || screen === 'paused' || screen === 'won' || screen === 'lost';
  return <section className="land land-v7 land-v9" style={fit} aria-label="Land of Warriors" onClickCapture={e=>{const target=(e.target as HTMLElement).closest('button,a,summary');if(target&&!target.hasAttribute('disabled'))playLandButton();}} onChangeCapture={e=>{if((e.target as HTMLElement).tagName==='SELECT')playLandButton();}} onContextMenu={e => e.preventDefault()}>
    {!playing && <div className="land-bar">
      {screen==='title'?<Link className="runner-back" to="/juegos">‹ Juegos</Link>:<button type="button" className="runner-back land-menu-back" aria-label="Volver al menú anterior" onClick={()=>setScreen(previousLandMenu(screen,scenarioFrom.current))}>‹ Volver</button>}
      <h1 className="land-logo" aria-label="Land of Warriors">{screen === 'pick' || screen === 'sheet' ? 'Civilizaciones' : screen === 'scenario' ? 'Escenarios' : 'Land of Warriors'}</h1>
      <span className="land-record">{Object.values(record).reduce((a, b) => a + b, 0) > 0 && <>Victorias <b>{Object.values(record).reduce((a, b) => a + b, 0)}</b></>}</span>
    </div>}

    {screen === 'pick' && <div className="land-pick">
      <div className="land-civ-list" aria-label="Las 10 civilizaciones">{CIV_IDS.map((c, i) => <button type="button" key={c} className="land-civ-choice" style={{ ['--civ' as string]: CIVS[c].color }} aria-label={CIVS[c].name} aria-pressed={civ===c}
        onClick={() => { setCiv(c); setEnemies(list => list.map(e => e === c ? 'random' : e)); setView(c); setSimple(false); }}>
        <span className="land-civ-number">{String(i + 1).padStart(2, '0')}</span><span className="land-civ-face"><LeaderPortrait civ={c}/></span>
        <span className="land-civ-copy"><b>{CIVS[c].name}</b><small>{CIVS[c].motto}</small><span>{CIVS[c].style}</span></span>
        <Sprite civ={c} idx={bIdx('base')} w={180} h={120} /><span className="land-civ-arrow">{record[c] ? '🏆 ' + record[c] : '↗'}</span>
      </button>)}</div>
      <div className="land-opts">
        <section className="land-chosen-civ" aria-label="Civilización elegida" style={{['--civ' as string]:CIVS[civ].color}}>
          <div className="land-chosen-heading"><LeaderPortrait civ={civ}/><div><small>TU CIVILIZACIÓN</small><h2>{CIVS[civ].name}</h2><p>{CIVS[civ].motto}</p></div></div>
          <p>{CIVS[civ].style}</p><CivTraits civ={civ}/><div className="land-chosen-units">{ROLE_ORDER.map(r=><div key={r}><Sprite civ={civ} idx={roleIdx(r)} w={66} h={72}/><span>{CIVS[civ].units[r]}</span></div>)}</div>
          <button type="button" className="land-ghost" onClick={()=>{setView(civ);setSimple(false);setScreen('sheet');}}>¡VER!</button>
        </section>
        <label>Límite de población por civilización: <select aria-label="Límite de población" value={populationLimit} onChange={e=>setPopulationLimit(Number(e.target.value) as PopulationLimit)}>{POPULATION_LIMITS.map(n=><option key={n} value={n}>{n}</option>)}</select></label>
        <small>Construí depósitos para ampliar las plazas hasta el límite elegido.</small>
        <label>Enemigos: <select aria-label="Enemigos" value={enemies.length} onChange={e => { const n = Number(e.target.value); setEnemies(list => Array.from({ length: n }, (_, i) => list[i] ?? 'random')); }}>
          {Array.from({ length: 9 }, (_, i) => <option key={i} value={i + 1}>{i + 1} {i===0?'enemigo':'enemigos'}</option>)}
        </select></label>
        <p className="land-roster-note">Vos y {enemies.length} {enemies.length === 1 ? 'rival' : 'rivales'} · Todos contra todos</p>
        <div className="land-rival-selectors">{enemies.map((enemy, index) => <label key={index}>Rival {index + 1}<select aria-label={`Civilización del rival ${index + 1}`} value={enemy} onChange={e => { setEnemies(list => list.map((v, i) => i === index ? e.target.value as CivId | 'random' : v)); }}>
          <option value="random">Al azar</option>{CIV_IDS.filter(c => c !== civ && !enemies.some((other, i) => i !== index && other === c)).map(c => <option key={c} value={c}>{CIVS[c].name}</option>)}
        </select></label>)}</div>

        <div className="land-chips" role="group" aria-label="Dificultad"><span>Dificultad</span>{DIFF.map(([d, n]) => <button type="button" key={d} aria-pressed={diff === d} className={diff === d ? 'on' : ''} onClick={() => { setDiff(d); }}>{n}</button>)}</div>
        <button type="button" className="land-go land-pick-continue" onClick={()=>{scenarioFrom.current='pick';setScreen('scenario');}}>Continuar ▶</button>
      </div>
    </div>}
    {screen === 'title' && <div className="land-title" style={{ backgroundImage: `url(${posterImg})` }}>
      <div className="land-title-text"><h2 className="land-metal" data-text="Land of Warriors">Land of Warriors</h2><p>Diez civilizaciones. Una sola tierra.</p>
        <button type="button" className="land-go land-start" onClick={() => { setScreen('pick'); }} autoFocus>⚔️ Iniciar</button></div>
    </div>}
    {screen === 'sheet' && sheetScreen}
    {screen === 'scenario' && <div className="land-scen">
      <h2>Elegí el escenario</h2>
      <label className="land-mineral-options">Cantidad de minerales: <select aria-label="Cantidad de minerales" value={mineralAbundance} onChange={e=>setMineralAbundance(e.target.value as MineralAbundance)}>{MINERAL_OPTIONS.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><small>Reservas por yacimiento: {mineralMultiplier(mineralAbundance)*100}% · cristales azules, dorados, verdes y piedras. Igual para todas las civilizaciones.</small></label>
        <div className="land-chips" role="group" aria-label="Tamaño del mapa"><span>Tamaño</span>{MAP_SIZES.map(([k, n]) => <button type="button" key={k} aria-pressed={size === k} className={size === k ? 'on' : ''} onClick={() => { setSize(k); }}>{n}<small>{MAP_SIZES.find(m => m[0] === k)![2].toLocaleString('es-AR')} × {MAP_SIZES.find(m => m[0] === k)![3].toLocaleString('es-AR')}</small></button>)}</div>
      <ul className="land-scen-list" role="group" aria-label="Elegir escenario">{THEMES.map((m, i) => <li key={i}><button type="button" aria-pressed={map === i + 1} className={map === i + 1 ? 'on' : ''} onClick={() => { setMap(i + 1); }}>
        <MapThumb theme={i} /><b>{m.name}</b><small>{m.text}</small></button></li>)}</ul>
      <div className="land-sheet-bar land-scen-bar">
        <button type="button" className="land-ghost" onClick={() => { setScreen(previousLandMenu('scenario',scenarioFrom.current)); }}>‹ Volver</button>
        <button type="button" className="land-go" onClick={() => { start(civ); }}>⚔️ Iniciar</button>
      </div>
    </div>}
    {loading && <div className="land-overlay" role="status"><div className="land-card"><h2>Armando el escenario…</h2></div></div>}

    {playing && g && side && <div className="land-stage" ref={stageRef} onWheel={onWheel}>
      <canvas ref={canvasRef} className={mode.k === 'place' || mode.k === 'power' || mode.k === 'amove' ? 'land-aim' : ''} aria-label={`Partida en ${THEMES[g.terrain.theme].name}`} role="img"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onPointerLeave={e => { mouse.current.in = false;e.currentTarget.dataset.attack='false'; }} />
      <div className="land-top-left"><button type="button" className="land-exit" aria-label="Volver a elegir civilización" onClick={()=>{keys.current.clear();mouse.current.in=false;drag.current=null;setSelection([]);setMode({k:'none'});setScreen('pick');}}>‹</button><span>Escenario {g.map} — {THEMES[g.terrain.theme].name}</span><time className="land-match-time" aria-label="Tiempo de partida" data-testid="land-match-time">{formatLandTime(g.t)}</time></div>
      <button type="button" className="land-intel-toggle" aria-expanded={commsOpen} onClick={()=>setCommsOpen(open=>!open)}>Tropas y líder</button>
      <aside className={`land-intel land-own-intel${commsOpen?' land-intel-open':''}`} aria-label="Tu civilización y tropas">
        <section className="land-intel-card land-leader-card" style={{['--civ' as string]:CIVS[side.civ].color}}>
          <button type="button" className="land-intel-close" aria-label="Cerrar panel de tropas" onClick={()=>setCommsOpen(false)}>×</button>
          <div className="land-leader-heading"><div><small>TU CIVILIZACIÓN</small><h2>{CIVS[side.civ].name}</h2><span>{CIVS[side.civ].motto}</span></div></div>
          <p>{CIVS[side.civ].style}</p>
        </section>
        <div className="land-intel-card land-troops-card"><LandTroops game={g} selected={sel} onSelect={units=>{setSelection(units.map(u=>u.id));focus(units[0].x,units[0].y);setMode({k:'none'});setCommsOpen(false);}}/></div>
        <LandLeaderPanel civ={side.civ} messages={leaderMessages} ready={readySoldiers(g)} onWriting={leaderWriting}/>
      </aside>
      <div className="land-top-right" aria-label="Recursos">
        <span title="Diamantes (cristales dorados)"><ResourceIcon kind="gem"/><b data-testid="land-gem">{Math.floor(side.gem)}</b></span>
        <span title="Minerales (cristales azules)"><ResourceIcon kind="stone"/><b data-testid="land-stone">{Math.floor(side.stone)}</b></span>
        <span title="Energía verde: mejoras y unidades de élite"><ResourceIcon kind="energy"/><b data-testid="land-energy">{Math.floor(side.energy)}</b></span>
        <span title="Piedras: necesarias para construir estructuras"><ResourceIcon kind="rock"/><b data-testid="land-rock">{Math.floor(side.rock)}</b></span>
        <span className={`land-food-reserve${side.food<=0?' land-food-empty':''}`} title={`${FOOD_NAMES[side.civ]}: ${Math.floor(side.food)} / ${FOOD_CAPACITY}. Consumo ${foodRate(g,0).toFixed(1)} por minuto. Las cosechas se entregan en el Almacén.`}><ResourceIcon kind="food"/><b data-testid="land-food">{foodPercent(g)}%</b><meter aria-label="Reserva de alimento" min={0} max={100} value={foodPercent(g)}/></span>
        <span title="Población"><LandIcon kind="people" /><b>{popUsed(g, 0)} / {popCap(g, 0)}</b></span>
        <button type="button" className="land-sq" title="Ayuda" aria-label="Ayuda" onClick={() => say('Tocá para elegir; tocá el mapa para dar órdenes. Arrastrá con el botón izquierdo para explorar; Shift + arrastre selecciona grupos. Usá la rueda para acercarte y el clic derecho breve para dar órdenes y arrastre derecho para seleccionar tropas.')}>?</button>
        <button type="button" className={`land-sq land-music-toggle${musicMuted?' land-music-muted':''}`} aria-label={musicMuted?'Activar música de la partida':'Silenciar música de la partida'} aria-pressed={musicMuted} title={musicMuted?'Música silenciada':'Silenciar música'} onClick={()=>setMusicMuted(muted=>!muted)}><span aria-hidden="true">♫</span></button>
        <button type="button" className="land-sq" title="Pausa" aria-label={screen === 'paused' ? 'Seguir' : 'Pausa'} onClick={() => setScreen(st => st === 'playing' ? 'paused' : 'playing')}><LandIcon kind="gear" /></button>
      </div>
      {mode.k !== 'none' && <div className="land-mode">{mode.k === 'place' ? `Elegí dónde poner: ${CIVS[side.civ].buildings[mode.kind]}${mode.kind === 'wall' ? ' · Clic para sumar tramos; Escape para terminar' : ''}` : mode.k === 'power' ? 'Elegí dónde cae el poder' : 'Elegí a dónde atacar'} · <button type="button" onClick={() => { setMode({ k: 'none' }); }}>Cancelar</button></div>}
      <div className="land-hud land-hud-native" style={{ ['--civ' as string]: CIVS[side.civ].color }}>
        <LandReferenceFrame/><div className="land-crest" aria-hidden="true"><LandEagle /></div>
        <div className="land-gems" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(i => <i key={i} />)}</div>
        <div className="land-mini"><div className="land-mini-map"><div className="land-tabs"><span><LandIcon kind="layers" /></span><span><LandIcon kind="radar" /></span></div><canvas ref={miniRef} width={220} height={150} onPointerDown={onMini} onPointerMove={onMini} aria-label="Mapa" /></div>
          <div className="land-quick"><button type="button" onClick={goBase} title="Ir a la base" aria-label="Ir a la base"><LandIcon kind="base" /></button><button type="button" onClick={selectArmy} title="Elegir todo el ejército" aria-label="Elegir todo el ejército"><LandIcon kind="army" /></button><button type="button" onClick={selectIdle} title="Un trabajador sin hacer nada" aria-label="Un trabajador sin hacer nada"><LandIcon kind="wrench" /></button></div>
        </div>
        <div className="land-sel land-selection-info">
          <LandSelectionStrip game={g} units={selUnits} onSelect={setSelection}/>
          <LandInspector game={g} unit={selUnits[0]} building={selB??undefined} count={selUnits.length} planned={mode.k==='place'?mode.kind:undefined} key={mode.k==='place'?mode.kind:selB?.id??selUnits[0]?.id??'none'}/>
        </div>
        {/* eslint-disable-next-line react-hooks/refs -- (los botones solo usan las referencias al tocarlos, no al dibujarse) */}
        <div className={`land-cmds${selB||!workersSel?' land-commands-short':''}`} aria-label="Órdenes disponibles">{commandHelp&&<div id="land-order-help" role="tooltip" className="land-order-help">{commandHelp.text}{commandHelp.cost&&<LandCost cost={commandHelp.cost}/>}</div>}{(() => {
          const pad = (els: React.ReactNode[]) => {const live=els.filter(Boolean);return [...live,...Array.from({length:Math.max(0,12-live.length)},(_,i)=><div className="land-command-cell land-command-empty" key={'empty'+i} aria-hidden="true" title="Sin orden disponible para esta selección"><LandReferenceCommandIcon index={live.length+i}/></div>)];};
          const cmd = (key: string, icon: React.ReactNode, title: string, onClick: () => void, o: { disabled?: boolean; cost?: Cost; badge?: string;label?:string } = {}) => {
            const info=title+(o.cost?' · Costo: '+costText(o.cost):'')+(o.disabled&&o.cost&&!canPay(side,o.cost)?' · '+missingResources(g,o.cost):''),label=o.label??(title.startsWith('Mejorar ')?`Mejorar ${title.split(' ')[1]}`:title.split(':')[0]);
            return <div className="land-command-cell" key={key} onMouseEnter={()=>setCommandHelp({text:title+(o.disabled&&o.cost&&!canPay(side,o.cost)?' · '+missingResources(g,o.cost):''),cost:o.cost})} onMouseLeave={()=>setCommandHelp(null)} onFocus={()=>setCommandHelp({text:title+(o.disabled&&o.cost&&!canPay(side,o.cost)?' · '+missingResources(g,o.cost):''),cost:o.cost})} onBlur={()=>setCommandHelp(null)} tabIndex={o.disabled?0:undefined} aria-label={o.disabled?info:undefined}><button type="button" disabled={o.disabled} title={info} aria-label={title} aria-describedby={commandHelp?.text.startsWith(title)?'land-order-help':undefined} onClick={()=>{setCommandHelp(null);onClick();}}>{icon}{({amove:0,move:1,stop:2,all:3,power:9} as Record<string,number>)[key]!==undefined&&<LandReferenceCommandIcon index={({amove:0,move:1,stop:2,all:3,power:9} as Record<string,number>)[key]}/>}<b className="land-command-label">{label}</b>{o.badge&&<em>{o.badge}</em>}{o.cost&&<small><LandCost cost={o.cost}/></small>}</button></div>;
          };
          const ic = (t: string) => <LandIcon kind={({ '🎯': 'target', '➡️': 'move', '⛔': 'stop', '⚔️': 'army', '✨': 'blast', '✋': 'stop', '✖': 'stop', '🛡️': 'shield', '👟': 'move' } as Record<string, string>)[t] ?? 'rifle'} />;
          const evolutionCommands=(b:Building)=>{const role=TRAINING_ROLE[b.kind];if(!role)return [];const level=evolutionLevel(g,b.owner,role),cost=evolutionCost(level,role),before=unitStats(g,b.owner,role),after=unitStats(g,b.owner,role,Math.min(4,level+1));return [cmd('evolve',<Sprite civ={side.civ} idx={roleIdx(role)} level={Math.min(4,level+1)} w={44} h={44}/>,`Evolucionar ${CIVS[side.civ].units[role]}: nivel ${Math.min(4,level+1)} de 4. Vida ${Math.round(before.hp)} a ${Math.round(after.hp)}. Da\u00f1o ${Math.round(before.dmg*10)/10} a ${Math.round(after.dmg*10)/10}. Mejora armadura, arma, velocidad y alcance; mantiene el costo de entrenamiento. ${evolutionTime(level)} s.`,()=>researchEvolution(g,b.id),{disabled:level>=MAX_EVOLUTION||!!b.evolving||!canPay(side,cost),cost:level>=MAX_EVOLUTION?undefined:cost,label:level>=MAX_EVOLUTION?'Nivel máximo':b.evolving?'Evolucionando':'Evolucionar',badge:level>=4?'MAX':String(level+1)})];};
          if (selB && selB.owner === 0) {
            const bs = BUILD_STATS[selB.kind], c = CIVS[side.civ];
            if (selB.built < 1) return <p className="land-cmd-note">En construcción: {Math.round(selB.built * 100)}%. Mandá trabajadores para que termine más rápido.</p>;
            return <>{pad([
              ...bs.makes.map(r => { const st = unitStats(g, 0, r), full = popUsed(g, 0) + st.pop > popCap(g, 0);
                return cmd(r, <Sprite civ={side.civ} idx={roleIdx(r)} level={evolutionLevel(g,0,r)} w={46} h={46} />, `${c.units[r]}: Entrena esta unidad en ${Math.ceil(trainingDuration(g,0,r))} s. Cada clic agrega otra unidad a la fila. ${roleText(side.civ, r)} ${r==='worker'?'Puede recuperar las cosechas incluso sin alimento.':`Consume ${FOOD_WEIGHT[r]*10} de alimento al salir y ${(unitFoodRate(g,0,r)).toFixed(1)} por minuto.`}${full ? ' (falta población: hacé un depósito)' : ''}`, () => { if (!train(g, selB.id, r)) say('No se puede ahora'); }, { disabled: !canPay(side, st.cost) || full, cost: st.cost,badge:selB.queue.length?String(selB.queue.length):undefined,label:'Entrenar Nivel '+evolutionLevel(g,0,r) }); }),
              ...evolutionCommands(selB),
              ...(selB.kind==='base'?STRUCTURE_UPGRADES.map(kind=>{const lv=side.infrastructure[kind],max=lv>=MAX_STRUCTURE_LEVEL,cost=structureUpgradeCost(kind,lv),busy=g.buildings.some(b=>b.owner===0&&!b.dead&&b.infrastructureResearch);return cmd(kind,<LandIcon kind={kind==='production'?'wrench':'shield'}/>,`Mejorar ${STRUCTURE_NAMES[kind]}: ${structureBenefit(kind,lv)} ${structureUpgradeTime(lv)} s.`,()=>researchInfrastructure(g,selB.id,kind),{disabled:max||busy||!canPay(side,cost),cost:max?undefined:cost,label:max?STRUCTURE_NAMES[kind]+' MAX':STRUCTURE_NAMES[kind],badge:lv+'/3'});}):[]),
              selB.queue.length > 0 ? cmd('cancel', ic('✖'), 'Cancelar el último', () => cancelTrain(g, selB.id)) : null])}</>;
          }
          if (workersSel) return <>{pad([...BKINDS.map(k => { const st = BUILD_STATS[k], needs = st.needs && !hasBuilt(g, 0, st.needs);
            return cmd(k, <BuildingSprite civ={side.civ} kind={k} w={54} h={44} />, `${CIVS[side.civ].buildings[k]}: ${BUILD_TEXT[k]}${needs ? ` (necesita ${CIVS[side.civ].buildings[st.needs!]})` : ''}`, () => setMode({ k: 'place', kind: k }), { disabled: !canPay(side, st.cost) || !!needs, cost: st.cost }); })])}</>;
          if (mine.length) return <>{pad([
            cmd('amove', ic('🎯'), 'Atacar a un lugar: caminan y atacan a todo lo que encuentren', () => setMode({ k: 'amove' })),
            cmd('move', ic('➡️'), 'Mover: tocá el mapa para que vayan', () => say('Tocá el mapa para que vayan ahí')),
            cmd('stop', ic('⛔'), 'Parar', () => { for (const u of mine) u.order = { k: 'idle' }; }),
            cmd('all', ic('⚔️'), 'Elegir todo el ejército', () => selectArmy()),
            side.power >= POWER_MAX ? cmd('power', ic('✨'), CIVS[side.civ].power.name+': '+POWER_TEXT[CIVS[side.civ].power.kind], () => { if (CIVS[side.civ].power.kind === 'strike') setMode({ k: 'power' }); else castPower(g, 0); }) : null])}</>;
          return <>{pad([])}</>;
        })()}</div>
      </div>
    </div>}

    {(screen === 'paused' || screen === 'won' || screen === 'lost') && g && side && <div className="land-overlay" role="dialog" aria-labelledby="land-msg">
      <div className="land-card">
        {screen === 'paused' && <><h2 id="land-msg">Pausa</h2>
          <button type="button" className="land-go" onClick={() => { setScreen('playing'); }} autoFocus>Seguir</button>
          <button type="button" className="land-ghost" aria-pressed={musicMuted} onClick={()=>setMusicMuted(muted=>!muted)}>{musicMuted?'Activar música':'Silenciar música'}</button>
          <button type="button" className="land-ghost" onClick={() => { setScreen('title'); }}>Volver al menú</button></>}
        {screen !== 'paused' && <><h2 id="land-msg" className={screen === 'won' ? 'land-win' : 'land-lose'}>{screen === 'won' ? '¡Victoria!' : 'Derrota'}</h2>
          <p>{screen === 'won' ? `${CIVS[side.civ].name} destruyó todas las bases rivales.` : 'Tu base fue destruida.'}</p>
          <ul className="land-stats"><li>Tiempo <b>{formatLandTime(g.t)}</b></li><li>Enemigos vencidos <b>{side.kills}</b></li><li>Perdidos <b>{side.lost}</b></li><li>Cristales juntados <b>{Math.round(side.gathered)}</b></li></ul>
          <button type="button" className="land-go" onClick={() => start(civ)} autoFocus>Jugar de nuevo</button>
          <button type="button" className="land-ghost" onClick={() => { setScreen('title'); }}>Volver al menú</button></>}
      </div>
    </div>}
  </section>;
}

const SCENES = import.meta.glob('./assets/land/scenes/scene-*.webp', { eager: true, import: 'default' }) as Record<string, string>;
function MapThumb({ theme }: { theme: number }) {
  const src = SCENES['./assets/land/scenes/scene-' + theme + '.webp'];
  return src ? <img src={src} alt={'Paisaje de ' + THEMES[theme].name} loading="lazy" /> : <span className="land-thumb-wait" aria-hidden="true" />;
}
