import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BALLS, CHARS, CHAR_IDS, HALF_TIME, POWERS, POWER_MAX, STAGES, STAMINA, TOURNAMENT, abilityReady, attackDir, clockText, fatalKeys, newMatch, noInput, step, takeEvents,
  type CharId, type Input, type Match, type StageId,
} from './kombat';
import { brickWallURL, drawMatch, drawStageThumb, viewFor } from './kombatArt';
import { drawFighterCard, drawPortrait } from './kombatFighters';
import {
  playExplosion, playGameOver, playGoal, playJump, playKfBlock, playKfBounce, playKfFatal, playKfHit, playKfPickup, playKfPost, playKfPower, playKick, playLaserOn,
  playRefWhistle, playStart, playThunder, playWinFanfare, preloadKombatSounds, setCrowd,
} from './sounds';
import { isTester } from './testerMode';
import { EndBanner } from './EndBanner';
import { Fireworks } from './Fireworks';

// ---------------------------------------------------------------- Récords (en el navegador)
const RECORD_KEY = 'escritorio-personal-juegos:kombat';
export interface KombatRecord { wins: number; losses: number; best: number; cups: number }
export const readKombatRecord = (): KombatRecord => {
  try { const v = JSON.parse(localStorage.getItem(RECORD_KEY) ?? 'null'); return v && typeof v.wins === 'number' ? v : { wins: 0, losses: 0, best: 0, cups: 0 }; } catch { return { wins: 0, losses: 0, best: 0, cups: 0 }; }
};
const saveRecord = (r: KombatRecord) => { try { localStorage.setItem(RECORD_KEY, JSON.stringify(r)); } catch { /* sin almacenamiento */ } };

type Mode = 'cpu' | 'versus' | 'tournament';
type Screen = 'menu' | 'select' | 'stage' | 'howto' | 'playing' | 'paused' | 'result' | 'champion';
const DIFFICULTY = [{ name: 'Fácil', level: 0.2 }, { name: 'Normal', level: 0.55 }, { name: 'Difícil', level: 0.9 }];
const TOURNAMENT_STAGES: StageId[] = ['industrial', 'temple', 'ice', 'factory', 'forest', 'mines', 'storm', 'volcano', 'base', 'moon'];
function tournamentRival(you: CharId, n: number): CharId { const others = CHAR_IDS.filter(c => c !== you); return others[(n * 5 + 3) % others.length]; }
const tournamentLevel = (n: number) => 0.2 + n * 0.08;

// Teclas (por la tecla física): un jugador con las flechas (o WASD) y ESPACIO; dos jugadores: J1 con WASD +
// ESPACIO y J2 con las flechas + ENTER. Mantener la patada carga el tiro, mantener ↑ salta más alto y la
// habilidad sale con adelante, adelante + patada.
type Key = 'left' | 'right' | 'up' | 'down' | 'kick';
const KEYS_SOLO: Record<string, Key> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Space: 'kick', KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down' };
const KEYS_P1: Record<string, Key> = { KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', Space: 'kick' };
const KEYS_P2: Record<string, Key> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Enter: 'kick', NumpadEnter: 'kick' };
interface KeyHelp { move: string[]; jump: string; block: string; kick: string }
const helpFor = (mode: Mode, side: 0 | 1): KeyHelp => mode === 'versus'
  ? side === 0 ? { move: ['A', 'D'], jump: 'W', block: 'S', kick: 'ESPACIO' } : { move: ['←', '→'], jump: '↑', block: '↓', kick: 'ENTER' }
  : { move: ['←', '→'], jump: '↑', block: '↓', kick: 'ESPACIO' };
// Habilidad: dos veces la flecha hacia donde se quiere tirar y la patada.
const abilityCombo = (mode: Mode, side: 0 | 1, dir: 1 | -1) => { const f = mode === 'versus' && side === 0 ? (dir > 0 ? 'D' : 'A') : dir > 0 ? '→' : '←'; return [f, f, helpFor(mode, side).kick]; };
const fatalCombo = (mode: Mode, side: 0 | 1, dir: 1 | -1) => [...fatalKeys(dir).map(k => mode === 'versus' && side === 0 ? (k === '→' ? 'D' : 'A') : k), helpFor(mode, side).kick];

interface Side { stamina: number; power: number; cd: number; ready: boolean; fatal: boolean; dir: 1 | -1; powers: string[] }
interface Hud { score: [number, number]; clock: string; half: string; extra: boolean; sides: [Side, Side]; ball: string | null; intro: boolean }
const hudOf = (m: Match): Hud => ({
  score: [m.fighters[0].goals, m.fighters[1].goals], clock: m.extra ? 'GOL DE ORO' : clockText(m.clock), half: m.extra ? 'EXTRA' : m.half === 1 ? '1T' : '2T', extra: m.extra,
  sides: m.fighters.map(f => ({
    stamina: Math.round(f.stamina), power: Math.floor(f.power), cd: Math.round(f.cd / CHARS[f.char].cd * 10) / 10, ready: abilityReady(f), fatal: f.power >= POWER_MAX, dir: attackDir(m, f.side),
    powers: (Object.keys(f.powers) as (keyof typeof POWERS)[]).map(k => POWERS[k].name),
  })) as [Side, Side],
  ball: m.ball.alive ? m.ball.kind === 'normal' ? null : BALLS[m.ball.kind].name : '💥 Sale otra por el tubo…',
  intro: m.phase === 'intro' && m.half === 1 && !m.extra && m.time < 2.4,
});
const sameHud = (a: Hud, b: Hud) => JSON.stringify(a) === JSON.stringify(b);

interface Shout { id: number; text: string; sub?: string; kind: 'goal' | 'fatal' | 'info' | 'block' | 'extra' }

// La cara (cuadrada para la grilla, redonda para la barra de arriba).
function Portrait({ char, size, mirror = false, square = false }: { char: CharId; size: number; mirror?: boolean; square?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const k = window.devicePixelRatio || 1; c.width = size * k; c.height = size * k;
    const ctx = c.getContext('2d'); if (!ctx) return;
    ctx.setTransform(k, 0, 0, k, 0, 0); drawPortrait(ctx, char, size, 0, mirror, square);
  }, [char, size, mirror, square]);
  return <canvas ref={ref} className="kf-portrait" style={{ width: size, height: size }} aria-hidden="true" />;
}
// El luchador entero, respirando, como en la pantalla de selección de los juegos de pelea.
function FighterCard({ char, w, h, mirror = false }: { char: CharId; w: number; h: number; mirror?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const k = Math.min(2, window.devicePixelRatio || 1); c.width = w * k; c.height = h * k;
    const ctx = c.getContext('2d'); if (!ctx) return;
    let frame = 0; const t0 = performance.now();
    const draw = (now: number) => { ctx.setTransform(k, 0, 0, k, 0, 0); drawFighterCard(ctx, char, w, h, (now - t0) / 1000, mirror); frame = requestAnimationFrame(draw); };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [char, w, h, mirror]);
  return <canvas ref={ref} style={{ width: w, height: h }} aria-hidden="true" />;
}
// Miniatura de un escenario.
function StageThumb({ stage, w, h }: { stage: StageId; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const k = Math.min(2, window.devicePixelRatio || 1); c.width = w * k; c.height = h * k;
    const ctx = c.getContext('2d'); if (!ctx) return;
    ctx.setTransform(k, 0, 0, k, 0, 0); drawStageThumb(ctx, newMatch(stage, ['cometa', 'inferno'], [null, null]), w, h);
  }, [stage, w, h]);
  return <canvas ref={ref} style={{ width: '100%', aspectRatio: `${w}/${h}` }} aria-hidden="true" />;
}
const Keys = ({ keys }: { keys: string[] }) => <span className="kf-combo">{keys.map((k, i) => <span key={i}>{i > 0 && <i>+</i>}<kbd>{k}</kbd></span>)}</span>;

export function KombatFootball() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const matchRef = useRef<Match | null>(null);
  const inputs = useRef<[Input, Input]>([noInput(), noInput()]);
  const [screen, setScreen] = useState<Screen>('menu');
  const [mode, setMode] = useState<Mode>('cpu');
  const [p1, setP1] = useState<CharId>('cometa');
  const [p2, setP2] = useState<CharId>('inferno');
  const [pick, setPick] = useState<0 | 1>(0); // a quién se está eligiendo
  const [cursor, setCursor] = useState(0);
  const [stage, setStage] = useState<StageId>('industrial');
  const [difficulty, setDifficulty] = useState(1);
  const [round, setRound] = useState(0);
  const [hud, setHud] = useState<Hud | null>(null);
  const [shouts, setShouts] = useState<Shout[]>([]);
  const [banner, setBanner] = useState<{ id: number; side: 0 | 1; dir: 1 | -1 } | null>(null);
  const [record, setRecord] = useState(readKombatRecord);
  const [result, setResult] = useState<{ winner: 0 | 1; score: [number, number] } | null>(null);
  const [fighting, setFighting] = useState<[CharId, CharId]>(['cometa', 'inferno']);
  const [stageName, setStageName] = useState('');
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 700);
  const [vp, setVp] = useState(() => typeof window !== 'undefined' ? { w: window.innerWidth, h: window.innerHeight } : { w: 1280, h: 720 });
  const screenRef = useRef(screen); useEffect(() => { screenRef.current = screen; }, [screen]);
  const modeRef = useRef(mode); useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { const on = () => { setNarrow(window.innerWidth < 700); setVp({ w: window.innerWidth, h: window.innerHeight }); }; window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  const shoutId = useRef(0);
  const shout = useCallback((text: string, kind: Shout['kind'], sub?: string, ms = 1800) => {
    const id = ++shoutId.current;
    setShouts(list => [...list.filter(s => kind === 'info' ? s.kind !== 'info' : s.kind === 'info'), { id, text, sub, kind }].slice(-3));
    setTimeout(() => setShouts(list => list.filter(s => s.id !== id)), ms);
  }, []);

  const paint = useCallback(() => {
    const el = stageRef.current, canvas = canvasRef.current, m = matchRef.current;
    if (!el || !canvas || !m) return;
    const k = Math.min(2, window.devicePixelRatio || 1), w = Math.round(el.clientWidth * k), h = Math.round(el.clientHeight * k);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawMatch(ctx, m, viewFor(w, h));
  }, []);

  // El partido que se ve de fondo en los menús (dos máquinas jugando).
  const menuish = screen === 'menu' || screen === 'select' || screen === 'stage' || screen === 'howto';
  const demoStage = screen === 'stage' || screen === 'howto' ? stage : 'industrial';
  useLayoutEffect(() => {
    if (!menuish) return;
    const m = newMatch(demoStage, [p1, p2], [0.6, 0.6]);
    m.phase = 'play';
    matchRef.current = m;
    let frame = 0, last = performance.now();
    const tick = (now: number) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; step(m, [noInput(), noInput()], dt); takeEvents(m); if (m.phase === 'end' || m.phase === 'halftime' || (m.phase === 'goal' && m.phaseT > 2)) { m.phase = 'play'; m.clock = HALF_TIME; } paint(); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    const observer = new ResizeObserver(paint); if (stageRef.current) observer.observe(stageRef.current);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [menuish, demoStage, p1, p2, paint]);

  const begin = useCallback((n = round) => {
    playStart(); preloadKombatSounds();
    const st = mode === 'tournament' ? TOURNAMENT_STAGES[n] : stage;
    const rival = mode === 'tournament' ? tournamentRival(p1, n) : p2;
    const level = mode === 'tournament' ? tournamentLevel(n) : DIFFICULTY[difficulty].level;
    const m = newMatch(st, [p1, rival], [null, mode === 'versus' ? null : level]);
    matchRef.current = m; setFighting([p1, rival]);
    inputs.current = [noInput(), noInput()];
    setHud(hudOf(m)); setResult(null); setShouts([]); setBanner(null);
    const def = STAGES.find(s => s.id === st)!;
    setStageName(`${mode === 'tournament' ? `Torneo · Partido ${n + 1}/${TOURNAMENT} · ` : ''}${def.name}`);
    setScreen('playing');
  }, [mode, stage, p1, p2, difficulty, round]);

  // ---------------------------------------------------------------- La selección (estilo juego de pelea)
  const chooseChar = useCallback((idx: number) => {
    const id = CHAR_IDS[idx];
    playKfPickup();
    if (pick === 0) {
      setP1(id);
      if (mode === 'tournament') { setScreen('howto'); return; }
      setPick(1); const other = CHAR_IDS.indexOf(p2 === id ? CHAR_IDS[(idx + 1) % 16] : p2); setCursor(other); if (p2 === id) setP2(CHAR_IDS[other]);
    } else { setP2(id); setScreen('stage'); }
  }, [pick, mode, p2]);
  const cols = 4; // la grilla es un cuadrado de 4 × 4
  // teclado de las pantallas de elegir
  useEffect(() => {
    if (screen !== 'select' && screen !== 'stage' && screen !== 'howto') return;
    const down = (e: KeyboardEvent) => {
      const k = e.code;
      if (screen === 'howto') { if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') { e.preventDefault(); begin(mode === 'tournament' ? round : 0); } else if (k === 'Escape') setScreen(mode === 'tournament' ? 'select' : 'stage'); return; }
      const n = screen === 'select' ? 16 : STAGES.length, c = screen === 'select' ? cols : narrow ? 2 : 5;
      const cur = screen === 'select' ? cursor : STAGES.findIndex(s => s.id === stage);
      let next: number;
      if (k === 'ArrowLeft' || k === 'KeyA') next = (cur + n - 1) % n;
      else if (k === 'ArrowRight' || k === 'KeyD') next = (cur + 1) % n;
      else if (k === 'ArrowUp' || k === 'KeyW') next = (cur - c + n) % n;
      else if (k === 'ArrowDown' || k === 'KeyS') next = (cur + c) % n;
      else if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') { e.preventDefault(); if (screen === 'select') chooseChar(cursor); else { playKfPickup(); setScreen('howto'); } return; }
      else if (k === 'Escape' || k === 'Backspace') { if (screen === 'stage') { setPick(1); setCursor(CHAR_IDS.indexOf(p2)); setScreen('select'); } else if (pick === 1) { setPick(0); setCursor(CHAR_IDS.indexOf(p1)); } else setScreen('menu'); return; }
      else return;
      e.preventDefault();
      if (screen === 'select') { setCursor(next); if (pick === 0) setP1(CHAR_IDS[next]); else setP2(CHAR_IDS[next]); } else setStage(STAGES[next].id);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [screen, cursor, cols, narrow, stage, pick, p1, p2, mode, round, begin, chooseChar]);

  // ---------------------------------------------------------------- El partido
  useEffect(() => {
    if (screen !== 'playing') { setCrowd(0); return; }
    setCrowd(0.6);
    let frame = 0, last = performance.now(), bounceT = 0, tiredT = 0, bannerId = 0;
    const human = (side: 0 | 1) => modeRef.current === 'versus' || side === 0;
    const who = (side: 0 | 1) => modeRef.current === 'versus' ? `J${side + 1}` : side === 0 ? 'Vos' : 'Rival';
    const tick = (now: number) => {
      const m = matchRef.current; if (!m) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      step(m, inputs.current, dt);
      inputs.current[0].cast = null; inputs.current[1].cast = null;
      bounceT -= dt; tiredT -= dt;
      for (const e of takeEvents(m)) {
        switch (e.type) {
          case 'kick': playKick(Math.min(1.2, 0.5 + e.power * 0.6)); break;
          case 'hit': playKfHit(e.who === 'fighter' ? 1 : 0.7); break;
          case 'block': playKfBlock(); break;
          case 'bounce': if (bounceT <= 0) { playKfBounce(e.power); bounceT = 0.08; } break;
          case 'post': playKfPost(); break;
          case 'jump': playJump(0.15); break;
          case 'ability': playKfPower(CHARS[e.char].element); break;
          case 'fatal': playKfFatal(); shout('FATAL GOAL', 'fatal', `${CHARS[e.char].name}: ${CHARS[e.char].fatalName}`, 1700); break;
          case 'fatalBlocked': playExplosion(); shout('¡BLOQUEADO!', 'block', 'Frenó el FATAL GOAL', 1500); break;
          case 'goal': playGoal(); shout(e.fatal ? '☠ FATAL GOAL ☠' : '¡GOL!', e.fatal ? 'fatal' : 'goal', `${CHARS[m.fighters[e.side].char].name} ${m.fighters[0].goals} - ${m.fighters[1].goals}`, 2400); break;
          case 'save': playKfBlock(); shout('¡SALVADA!', 'block', `${CHARS[m.fighters[e.side].char].name} la sacó del arco`, 1000); break;
          case 'ballDrop': playKfPickup(); break;
          case 'refDown': shout('¡ÁRBITRO KO!', 'block', 'Vuelve en unos segundos', 1300); break;
          case 'power': playKfPickup(); shout(`${who(e.side)}: ${POWERS[e.kind].name}`, 'info', POWERS[e.kind].text, 2200); break;
          case 'ballKind': if (e.kind !== 'normal') { playKfPickup(); shout(BALLS[e.kind].name, 'info', BALLS[e.kind].text, 2600); } break;
          case 'unlock':
            if (human(e.side)) { playKfPickup(); const id = ++bannerId; setBanner({ id, side: e.side, dir: attackDir(m, e.side) }); setTimeout(() => setBanner(b => b && b.id === id ? null : b), 4000); }
            break;
          case 'noEnergy': case 'tired': if (human(e.side) && tiredT <= 0) { tiredT = 6; shout('¡Sin energía!', 'info', 'Quedate quieto un momento para recuperarla', 2200); } break;
          case 'trap': if (e.kind === 'laser') playLaserOn(); break;
          case 'boom': playExplosion(); break;
          case 'thunder': playThunder(0.7); break;
          case 'zap': playLaserOn(); break;
          case 'whistle': playRefWhistle(e.kind); if (e.kind === 'kickoff' && m.fighters[0].goals + m.fighters[1].goals === 0 && !m.extra) shout(m.half === 1 ? '¡A JUGAR!' : 'SEGUNDO TIEMPO', 'extra', undefined, 1100); break;
          case 'halftime': { const d = -attackDir(m, 0); shout('ENTRETIEMPO', 'extra', `Cambio de lado: ${modeRef.current === 'versus' ? 'J1 ataca' : 'ahora atacás'} hacia la ${d > 0 ? 'derecha ▶' : '◀ izquierda'}`, 3000); break; }
          case 'extra': playRefWhistle('half'); shout('TIEMPO EXTRA', 'extra', 'Gol de oro: el primero que mete gana', 2600); break;
        }
      }
      paint();
      const next = hudOf(m);
      setHud(prev => prev && sameHud(prev, next) ? prev : next);
      if (m.phase === 'end' && m.phaseT > 1.6 && m.winner !== null) {
        const win = m.winner === 0, rec = readKombatRecord();
        if (modeRef.current !== 'versus') { if (win) rec.wins++; else rec.losses++; }
        let champion = false;
        if (modeRef.current === 'tournament' && win) { rec.best = Math.max(rec.best, round + 1); if (round + 1 >= TOURNAMENT) { rec.cups++; champion = true; } }
        saveRecord(rec); setRecord(rec);
        setResult({ winner: m.winner, score: [m.fighters[0].goals, m.fighters[1].goals] });
        if (win || modeRef.current === 'versus') playWinFanfare(); else playGameOver();
        setScreen(champion ? 'champion' : 'result');
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hide = () => { if (document.hidden) setScreen('paused'); };
    document.addEventListener('visibilitychange', hide);
    const observer = new ResizeObserver(paint); if (stageRef.current) observer.observe(stageRef.current);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', hide); observer.disconnect(); };
  }, [screen, paint, shout, round]);
  useEffect(() => () => setCrowd(0), []);

  // Teclado del partido.
  useEffect(() => {
    const map = (code: string): [0 | 1, Key] | null => {
      if (modeRef.current === 'versus') { if (KEYS_P1[code]) return [0, KEYS_P1[code]]; if (KEYS_P2[code]) return [1, KEYS_P2[code]]; return null; }
      return KEYS_SOLO[code] ? [0, KEYS_SOLO[code]] : null;
    };
    const down = (e: KeyboardEvent) => {
      const s = screenRef.current;
      if ((e.code === 'Escape' || e.code === 'KeyP') && (s === 'playing' || s === 'paused')) { setScreen(s === 'playing' ? 'paused' : 'playing'); return; }
      const hit = map(e.code);
      if (!hit || s !== 'playing') return;
      e.preventDefault();
      inputs.current[hit[0]][hit[1]] = true;
    };
    const up = (e: KeyboardEvent) => { const hit = map(e.code); if (hit) inputs.current[hit[0]][hit[1]] = false; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);
  useEffect(() => { const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prev; }; }, []);

  const hold = (key: Key) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); inputs.current[0][key] = true; },
    onPointerUp: () => { inputs.current[0][key] = false; },
    onPointerLeave: () => { inputs.current[0][key] = false; },
    onPointerCancel: () => { inputs.current[0][key] = false; },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const chars: [CharId, CharId] = screen === 'playing' || screen === 'paused' || screen === 'result' || screen === 'champion' ? fighting : [p1, mode === 'tournament' ? tournamentRival(p1, round) : p2];
  const tester = isTester();
  const isHuman = (i: 0 | 1) => mode === 'versus' || i === 0;
  // La barra de arriba de cada lado: retrato, nombre y la energía (con el poder y la habilidad abajo).
  const sideBar = (i: 0 | 1) => {
    const s = hud?.sides[i], c = CHARS[chars[i]], stamina = s?.stamina ?? STAMINA, power = s?.power ?? 0;
    const color = stamina > 55 ? '#22c55e' : stamina > 25 ? '#facc15' : '#ef4444';
    return <div className={`kf-side kf-side--${i}`} data-testid={`kf-side-${i}`}>
      <Portrait char={chars[i]} size={64} mirror={i === 1} square />
      <div className="kf-bars">
        <div className={`kf-energy${stamina < 20 ? ' kf-energy--low' : ''}`} role="meter" aria-valuemin={0} aria-valuemax={STAMINA} aria-valuenow={stamina} aria-label={`Energía de ${c.name}: ${stamina} de ${STAMINA}`}>
          <i style={{ width: `${stamina}%`, background: `linear-gradient(180deg, ${color}, ${color}aa 60%, ${color}77)` }} />
          <b>{c.name}{mode === 'versus' ? ` · J${i + 1}` : i === 0 ? '' : ' · CPU'}</b>
        </div>
        <div className="kf-sub">
          <span className={`kf-power${s?.fatal ? ' kf-power--full' : ''}`} title="Poder: lleno habilita el FATAL GOAL"><u style={{ width: `${power}%` }} /><em>{s?.fatal ? 'FATAL ☠' : 'PODER'}</em></span>
          {isHuman(i) && <span className={`kf-skill${s?.ready ? ' kf-ready' : ''}`} title={`${c.abilityText} (${abilityCombo(mode, i, s?.dir ?? 1).join(' ')})`}>✦ {c.abilityName} <small>{abilityCombo(mode, i, s?.dir ?? 1).join(' ')}</small>{s && !s.ready && s.cd > 0 ? '…' : ''}</span>}
          {s?.powers.map(p => <em key={p} className="kf-pw">{p}</em>)}
        </div>
      </div>
    </div>;
  };

  const howto = (side: 0 | 1) => { const c = CHARS[chars[side]], k = helpFor(mode, side); return <div className="kf-howto-card" style={{ ['--kf-c' as string]: c.color }}>
    <div className="kf-howto-head"><Portrait char={chars[side]} size={56} square mirror={side === 1} /><div><b>{c.name}</b><small>{mode === 'versus' ? `Jugador ${side + 1}` : 'Vos'}</small></div></div>
    <ul>
      <li><Keys keys={k.move} /> correr</li>
      <li><Keys keys={[k.jump]} /> saltar (apretalo de nuevo en el aire: dos veces salta el doble, tres veces el triple) · <Keys keys={[k.block]} /> bloquear</li>
      <li><Keys keys={[k.kick]} /> patear: <b>mantenelo para cargar el tiro</b>, cuanto más tiempo, más fuerte sale la pelota (al soltar con {k.jump} globo, con {k.block} rasante; corriendo con {k.block} barrida)</li>
      <li className="kf-howto-ab"><Keys keys={abilityCombo(mode, side, 1)} /> <b>{c.abilityName}:</b> {c.abilityText} Adelante, adelante + patada (o para el otro lado). <em>Gasta energía.</em></li>
      <li className="kf-howto-fatal"><Keys keys={fatalCombo(mode, side, 1)} /> <b>FATAL GOAL</b> ({c.fatalName}) cuando la barra de poder está llena. Las flechas son hacia el arco rival.</li>
    </ul>
  </div>; };

  const playing = screen === 'playing' || screen === 'paused';
  const selecting = screen === 'select';
  const shown = selecting ? CHAR_IDS[cursor] : p1;
  // La selección ocupa toda la pantalla, centrada: los cuadrados 50% más grandes (156 px) si entran, y el
  // luchador elegido del alto de la grilla.
  const cell = narrow ? Math.max(56, Math.min(99, Math.floor((vp.w - 40) / 4))) : Math.max(70, Math.min(156, Math.floor((vp.h - 230) / 4)));
  const cardH = narrow ? 225 : Math.round(Math.min(375, cell * 4 * 0.98)), cardW = Math.round(cardH * 0.76);
  return <section className="runner kf" aria-label="Kombat Football">
    <div className="runner-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1>Kombat Football</h1>
      <div className="runner-scores">
        {mode === 'tournament' && playing && <span>Torneo <strong data-testid="kf-round">{round + 1}/{TOURNAMENT}</strong></span>}
        {record.wins + record.losses > 0 && <span>Récord <strong>{record.wins}G {record.losses}P{record.cups ? ` · 🏆 ${record.cups}` : ''}</strong></span>}
      </div>
      {playing && <button type="button" onClick={() => setScreen(s => s === 'playing' ? 'paused' : 'playing')}>{screen === 'playing' ? 'Pausa' : 'Seguir'}</button>}
    </div>
    <div className="runner-stage kf-stage" ref={stageRef}>
      <canvas ref={canvasRef} role="img" aria-label="Cancha de Kombat Football" />
      {playing && hud && <div className="kf-hud">
        {sideBar(0)}
        <div className="kf-score" aria-live="polite">
          <div className="kf-score-main" data-testid="kf-score">
            <span className="kf-goals" style={{ ['--kf-c' as string]: CHARS[chars[0]].color }}>{hud.score[0]}</span><i> - </i><span className="kf-goals" style={{ ['--kf-c' as string]: CHARS[chars[1]].color }}>{hud.score[1]}</span>
          </div>
          <small data-testid="kf-clock" className={hud.extra ? 'kf-golden' : ''}>{hud.extra ? '' : <b>{hud.half}</b>}{hud.clock}</small>
          {hud.ball && <em>{hud.ball}</em>}
        </div>
        {sideBar(1)}
      </div>}
      {playing && hud?.intro && <div className="kf-vs" aria-hidden="true">
        <div className="kf-vs-side" style={{ ['--kf-c' as string]: CHARS[chars[0]].color }}><FighterCard char={chars[0]} w={150} h={190} /><b>{CHARS[chars[0]].name}</b></div>
        <div className="kf-vs-mid"><strong>VS</strong><small>{stageName}</small></div>
        <div className="kf-vs-side" style={{ ['--kf-c' as string]: CHARS[chars[1]].color }}><FighterCard char={chars[1]} w={150} h={190} mirror /><b>{CHARS[chars[1]].name}</b></div>
      </div>}
      {playing && banner && <div key={banner.id} className="kf-unlock" role="status" style={{ ['--kf-c' as string]: CHARS[chars[banner.side]].color }}>
        <b>{mode === 'versus' ? `J${banner.side + 1} · ` : ''}PODER ESPECIAL</b>
        <div><span>☠ FATAL GOAL · {CHARS[chars[banner.side]].fatalName}</span><Keys keys={fatalCombo(mode, banner.side, banner.dir)} /></div>
      </div>}
      {playing && <p className="kf-rotate">📱 Girá el celular para ver la cancha más grande</p>}
      <div className="kf-shouts" aria-live="assertive">
        {shouts.map(s => <div key={s.id} className={`kf-shout kf-shout--${s.kind}`} role="status">{s.text}{s.sub && <small>{s.sub}</small>}</div>)}
      </div>
      {selecting && <div className="kf-select" role="dialog" aria-labelledby="kf-title" style={{ backgroundImage: `radial-gradient(ellipse at 50% 45%, #0000 55%, #00000080 100%), url(${brickWallURL() ?? ''})`, backgroundSize: 'auto, 448px 336px', backgroundColor: '#151614' }}>
        <h2 id="kf-title">{mode === 'versus' ? `JUGADOR ${pick + 1}: ELEGÍ TU LUCHADOR` : pick === 0 ? 'ELEGÍ TU LUCHADOR' : 'ELEGÍ AL RIVAL'}</h2>
        <div className="kf-select-row">
          <div className={`kf-pick kf-pick--1${pick === 0 ? ' kf-pick--active' : ''}`} style={{ ['--kf-c' as string]: CHARS[pick === 0 ? shown : p1].color }}>
            <FighterCard char={pick === 0 ? shown : p1} w={cardW} h={cardH} />
            <b data-testid="kf-pick-1">{CHARS[pick === 0 ? shown : p1].name}</b>
            <small>{mode === 'versus' ? 'J1' : 'VOS'}</small>
          </div>
          <div className="kf-grid" role="group" aria-label={pick === 0 ? 'Tu luchador' : 'Rival'} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {CHAR_IDS.map((id, i) => {
              const sel1 = pick === 0 ? cursor === i : id === p1, sel2 = pick === 1 && cursor === i;
              return <button key={id} type="button" className={`kf-cell${sel1 ? ' kf-cell--1' : ''}${sel2 ? ' kf-cell--2' : ''}`} aria-label={CHARS[id].name} aria-pressed={cursor === i}
                onClick={() => { if (cursor === i) chooseChar(i); else { setCursor(i); if (pick === 0) setP1(id); else setP2(id); } }}
                onDoubleClick={() => chooseChar(i)}>
                <Portrait char={id} size={cell} square />
                {sel1 && <i className="kf-tag kf-tag--1">1</i>}{sel2 && <i className="kf-tag kf-tag--2">{mode === 'versus' ? '2' : 'CPU'}</i>}
              </button>;
            })}
          </div>
          <div className={`kf-pick kf-pick--2${pick === 1 ? ' kf-pick--active' : ''}`} style={{ ['--kf-c' as string]: CHARS[chars[1]].color }}>
            {pick === 1 || mode === 'tournament' ? <FighterCard char={pick === 1 ? CHAR_IDS[cursor] : chars[1]} w={cardW} h={cardH} mirror /> : <div className="kf-pick-empty" style={{ width: cardW, height: cardH }}>?</div>}
            <b data-testid="kf-pick-2">{pick === 1 || mode === 'tournament' ? CHARS[pick === 1 ? CHAR_IDS[cursor] : chars[1]].name : '—'}</b>
            <small>{mode === 'versus' ? 'J2' : 'CPU'}</small>
          </div>
        </div>
        <p className="kf-zone"><b>{CHARS[CHAR_IDS[cursor]].name}</b> · ✦ {CHARS[CHAR_IDS[cursor]].abilityName}: {CHARS[CHAR_IDS[cursor]].abilityText}</p>
        <div className="kf-actions">
          <button type="button" className="kf-secondary" onClick={() => { if (pick === 1) { setPick(0); setCursor(CHAR_IDS.indexOf(p1)); } else setScreen('menu'); }}>‹ Volver</button>
          {pick === 1 && mode === 'cpu' && <button type="button" className="kf-secondary" onClick={() => chooseChar(CHAR_IDS.indexOf(CHAR_IDS.filter(c => c !== p1)[Math.floor(Math.random() * 15)]))}>🎲 Al azar</button>}
          <button type="button" onClick={() => chooseChar(cursor)}>Elegir {CHARS[CHAR_IDS[cursor]].name} ▶</button>
        </div>
        <p className="kf-hint">Flechas para moverte · ENTER para elegir · o tocá la cara (dos veces para elegir)</p>
        {mode === 'tournament' && (tester || record.best > 0) && <div className="kf-stages kf-rounds" role="group" aria-label="Partido del torneo">
          {TOURNAMENT_STAGES.map((st, n) => { const locked = !tester && n > Math.min(record.best, TOURNAMENT - 1); return <button key={st} type="button" disabled={locked} className={round === n ? 'kf-chosen' : ''} aria-pressed={round === n} onClick={() => setRound(n)}><b>{locked ? '🔒' : n + 1}</b><small>{STAGES.find(s => s.id === st)!.name}</small></button>; })}
        </div>}
      </div>}
      {screen !== 'playing' && !selecting && <div className="runner-overlay kf-overlay" role="dialog" aria-labelledby="kf-title">
        <div>
          {screen === 'menu' && <>
            <h2 id="kf-title" className="kf-logo">KOMBAT<br /><span>FOOTBALL</span></h2>
            <p>Fútbol 1 contra 1 con poderes, golpes y trampas. No hay arqueros: cada luchador defiende su arco con su habilidad. Dos tiempos de 1:30 y gol de oro si empatan.</p>
            <div className="kf-modes">
              <button type="button" onClick={() => { setMode('cpu'); setPick(0); setCursor(CHAR_IDS.indexOf(p1)); setScreen('select'); }} autoFocus>⚔️ Partido contra la máquina</button>
              <button type="button" onClick={() => { setMode('versus'); setPick(0); setCursor(CHAR_IDS.indexOf(p1)); setScreen('select'); }}>👥 2 jugadores</button>
              <button type="button" onClick={() => { setMode('tournament'); setRound(0); setPick(0); setCursor(CHAR_IDS.indexOf(p1)); setScreen('select'); }}>🏆 Torneo: 10 partidos</button>
            </div>
          </>}
          {screen === 'stage' && <>
            <h2 id="kf-title" className="kf-title-mk">ELEGÍ EL ESCENARIO</h2>
            <div className="kf-stagegrid" role="group" aria-label="Escenario">
              {STAGES.map(s => <button key={s.id} type="button" className={stage === s.id ? 'kf-chosen' : ''} aria-pressed={stage === s.id} onClick={() => { if (stage === s.id) setScreen('howto'); else setStage(s.id); }} title={s.hazard}>
                <StageThumb stage={s.id} w={180} h={84} /><b>{s.name}</b><small>{s.hazard}</small>
              </button>)}
            </div>
            {mode === 'cpu' && <div className="kf-diff" role="group" aria-label="Dificultad">{DIFFICULTY.map((d, i) => <button key={d.name} type="button" className={difficulty === i ? 'kf-chosen' : ''} aria-pressed={difficulty === i} onClick={() => setDifficulty(i)}>{d.name}</button>)}</div>}
            <div className="kf-actions">
              <button type="button" className="kf-secondary" onClick={() => { setPick(1); setCursor(CHAR_IDS.indexOf(p2)); setScreen('select'); }}>‹ Volver</button>
              <button type="button" onClick={() => setScreen('howto')}>Siguiente ▶</button>
            </div>
          </>}
          {screen === 'howto' && <>
            <h2 id="kf-title" className="kf-title-mk">CONTROLES</h2>
            <p className="kf-note">{CHARS[chars[0]].name} vs {CHARS[chars[1]].name} · {STAGES.find(s => s.id === (mode === 'tournament' ? TOURNAMENT_STAGES[round] : stage))!.name}</p>
            <div className="kf-howto">{howto(0)}{mode === 'versus' && howto(1)}</div>
            <p className="kf-note">La barra de arriba es tu <b>energía</b>: la bajan las trampas, los poderes del rival y usar tu habilidad; se recupera descansando. Con poca energía corrés más lento. Las trampas no rompen la pelota: el fuego y la lava la despiden prendida fuego (quema al rival que toca).</p>
            <div className="kf-actions">
              <button type="button" className="kf-secondary" onClick={() => setScreen(mode === 'tournament' ? 'select' : 'stage')}>‹ Volver</button>
              <button type="button" onClick={() => begin(mode === 'tournament' ? round : 0)} autoFocus>¡A jugar!</button>
            </div>
          </>}
          {screen === 'paused' && <>
            <h2 id="kf-title">Pausa</h2>
            <div className="kf-howto">{howto(0)}{mode === 'versus' && howto(1)}</div>
            <div className="kf-actions">
              <button type="button" className="kf-secondary" onClick={() => setScreen('menu')}>Abandonar</button>
              <button type="button" onClick={() => setScreen('playing')} autoFocus>Seguir</button>
            </div>
          </>}
          {screen === 'result' && result && <>
            {mode === 'versus' ? <h2 id="kf-title" className="end-banner end-banner--win">¡GANÓ {CHARS[chars[result.winner]].name}!</h2> : <EndBanner win={result.winner === 0} id="kf-title" />}
            <p className="kf-final">{CHARS[chars[0]].name} <b>{result.score[0]} - {result.score[1]}</b> {CHARS[chars[1]].name}</p>
            {mode === 'tournament' && <p>{result.winner === 0 ? `¡Pasaste al partido ${round + 2} de ${TOURNAMENT}!` : `Quedaste afuera en el partido ${round + 1} de ${TOURNAMENT}.`}</p>}
            <div className="kf-actions">
              <button type="button" className="kf-secondary" onClick={() => setScreen('menu')}>Menú</button>
              {mode === 'tournament' && result.winner === 0
                ? <button type="button" onClick={() => { const n = round + 1; setRound(n); begin(n); }} autoFocus>Siguiente partido ▶</button>
                : <button type="button" onClick={() => begin(round)} autoFocus>{mode === 'tournament' ? 'Reintentar el partido' : 'Revancha'}</button>}
            </div>
          </>}
          {screen === 'champion' && <>
            <Fireworks />
            <h2 id="kf-title" className="end-banner end-banner--win">🏆 ¡CAMPEÓN!</h2>
            <p>Ganaste los 10 partidos del torneo con {CHARS[chars[0]].name}.</p>
            <div className="kf-actions"><button type="button" onClick={() => { setRound(0); setScreen('menu'); }} autoFocus>VOLVER A JUGAR</button></div>
          </>}
        </div>
      </div>}
    </div>
    {playing && mode !== 'versus' && <div className="runner-pad kf-pad" aria-label="Controles">
      <button type="button" aria-label="Izquierda" {...hold('left')}>◀</button>
      <button type="button" aria-label="Derecha" {...hold('right')}>▶</button>
      <button type="button" aria-label="Saltar" {...hold('up')}>▲</button>
      <button type="button" aria-label="Bloquear" {...hold('down')}>▼</button>
      <button type="button" className="kf-kick" aria-label="Patear" {...hold('kick')}>⚽</button>
      <button type="button" className={`kf-cast${hud?.sides[0].ready ? '' : ' kf-cast--off'}`} aria-label={CHARS[chars[0]].abilityName} onPointerDown={e => { e.preventDefault(); inputs.current[0].cast = 'ability'; }}>✦</button>
      {hud?.sides[0].fatal && <button type="button" className="kf-cast kf-cast--fatal" aria-label="FATAL GOAL" onPointerDown={e => { e.preventDefault(); inputs.current[0].cast = 'fatal'; }}>☠</button>}
    </div>}
  </section>;
}
