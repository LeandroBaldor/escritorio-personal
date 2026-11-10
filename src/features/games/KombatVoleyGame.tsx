import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TouchGrips } from './TouchGrips';
import { GamePad } from './GamePad';
import { fitViewport, pixelRatio, useFitScreen } from './fitScreen';
import { Link } from 'react-router-dom';
import { CHARS, CHAR_IDS, STAGES, STATS, type CharId, type StageId } from './kombat';
import { BALLS, SET_POINTS, STAGE_BALL, newVoley, noVInput, stepVoley, takeVoleyEvents, touchesOf, type VInput, type VMatch } from './kombatVoley';
import { drawVoley, drawVoleyBackdrop, drawVoleyThumb, noteNetHit } from './kombatVoleyArt';
import { vortexURL } from './kombatArt';
import { drawFighterCard, drawPortrait, setLowFx } from './kombatFighters';
import { setNoGrain } from './gravityMonsters';
import spaceBg from './assets/fondos/kf-espacio.webp';
import menuBg from './assets/fondos/kf-menu.webp';
import { onBackdropLoad, preloadBackdrops } from './kombatScenery';
import {
  playExplosion, playGameOver, playKfBall, playKfButton, playKfGoal, playKfName, playKfPost, playKfSelectVoice, playKfVsSentence,
  playRefWhistle, playStart, playWinFanfare, preloadKombatSounds, preloadKombatUi, setCrowd, setKfMusic,
} from './sounds';
import { EndBanner } from './EndBanner';
import { Fireworks } from './Fireworks';

// Kombat Voley: vóley uno contra uno con los luchadores de Kombat Football. Mismo menú, misma selección y mismos
// sonidos; el partido es un set a 15 visto de costado. Modos: amistoso (elegís contra quién) y mundial (octavos,
// cuartos, semifinal y final).

// ---------------------------------------------------------------- Récords (en el navegador)
const RECORD_KEY = 'escritorio-personal-juegos:kombat-voley';
export interface VoleyRecord { wins: number; losses: number; cups: number }
export const readVoleyRecord = (): VoleyRecord => {
  try { const v = JSON.parse(localStorage.getItem(RECORD_KEY) ?? 'null'); return v && typeof v.wins === 'number' ? v : { wins: 0, losses: 0, cups: 0 }; } catch { return { wins: 0, losses: 0, cups: 0 }; }
};
const saveRecord = (r: VoleyRecord) => { try { localStorage.setItem(RECORD_KEY, JSON.stringify(r)); } catch { /* sin almacenamiento */ } };

type Mode = 'cpu' | 'world';
type Screen = 'menu' | 'select' | 'vs' | 'ladder' | 'stage' | 'howto' | 'playing' | 'paused' | 'result' | 'champion';
const DIFFICULTY = [{ name: 'Fácil', level: 0.25 }, { name: 'Normal', level: 0.55 }, { name: 'Difícil', level: 0.85 }];
// El mundial: cuatro partidos (octavos, cuartos, semifinal y final), cada uno con un rival y un estadio sorteados.
const ROUNDS = ['Octavos de final', 'Cuartos de final', 'Semifinal', 'Final'] as const;
const roundLevel = (n: number) => 0.4 + n * 0.15;
interface Cup { rivals: CharId[]; stages: StageId[] }
function drawCup(you: CharId): Cup {
  const pool = CHAR_IDS.filter(c => c !== you).sort(() => Math.random() - 0.5), st = STAGES.map(s => s.id).sort(() => Math.random() - 0.5);
  return { rivals: pool.slice(0, 4), stages: st.slice(0, 4) };
}

// Teclas: flechas (o WASD) para moverse, ↑ (o ESPACIO) para saltar, V para golpear y X para levantar.
type Key = keyof VInput;
const KEYS: Record<string, Key> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', Space: 'up', KeyV: 'hit', KeyX: 'set', KeyK: 'set', KeyJ: 'hit' };

interface Hud { score: [number, number]; server: 0 | 1; touches: [number, number]; serving: boolean; intro: boolean; setPoint: boolean }
const hudOf = (m: VMatch): Hud => ({
  score: [m.score[0], m.score[1]], server: m.server, touches: [touchesOf(m, 0), touchesOf(m, 1)], serving: m.phase === 'serve', intro: m.phase === 'intro' && m.time < 2.4,
  setPoint: Math.max(...m.score) >= SET_POINTS - 1 && m.score[0] !== m.score[1],
});
const sameHud = (a: Hud, b: Hud) => JSON.stringify(a) === JSON.stringify(b);
const QUALITY = [1, 0.82, 0.68, 0.55];
interface Shout { id: number; text: string; sub?: string; kind: 'goal' | 'fatal' | 'info' | 'block' | 'extra' }

function Portrait({ char, size, mirror = false, square = false }: { char: CharId; size: number; mirror?: boolean; square?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const k = pixelRatio(); c.width = size * k; c.height = size * k;
    const ctx = c.getContext('2d'); if (!ctx) return;
    ctx.setTransform(k, 0, 0, k, 0, 0); drawPortrait(ctx, char, size, 0, mirror, square);
  }, [char, size, mirror, square]);
  return <canvas ref={ref} className="kf-portrait" style={{ width: size, height: size }} aria-hidden="true" />;
}
const STAT_ROWS = [['Velocidad', 'speed'], ['Fuerza', 'strength'], ['Salto', 'jump']] as const;
function StatBars({ char, right = false, testId }: { char: CharId; right?: boolean; testId?: string }) {
  return <div className={`kf-stats${right ? ' kf-stats--r' : ''}`} data-testid={testId}>
    {STAT_ROWS.map(([label, k]) => { const v = STATS[char][k]; return <div key={k} className="kf-stat" aria-label={`${label} ${v}`}>
      <span>{label}</span><i style={{ ['--v' as string]: `${v}%`, ['--c' as string]: `hsl(${Math.round(v * 1.2)} 85% 48%)` }}><b /></i><em>{v}</em>
    </div>; })}
  </div>;
}
function FighterCard({ char, w, h, mirror = false }: { char: CharId; w: number; h: number; mirror?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const k = pixelRatio(2); c.width = w * k; c.height = h * k;
    const ctx = c.getContext('2d'); if (!ctx) return;
    let frame = 0; const t0 = performance.now();
    const draw = (now: number) => { ctx.setTransform(k, 0, 0, k, 0, 0); drawFighterCard(ctx, char, w, h, (now - t0) / 1000, mirror); frame = requestAnimationFrame(draw); };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [char, w, h, mirror]);
  return <canvas ref={ref} style={{ width: w, height: h }} aria-hidden="true" />;
}
// El cuadro del mundial: los cuatro rivales en una columna (octavos abajo, la final arriba) y el luchador del
// jugador al lado del que le toca.
function Bracket({ you, cup, round, from, height }: { you: CharId; cup: Cup; round: number; from: number; height: number }) {
  const [pos, setPos] = useState(from);
  useEffect(() => { const id = window.setTimeout(() => setPos(round), 450); return () => window.clearTimeout(id); }, [round]);
  const B = Math.max(48, Math.min(84, Math.floor(height / 5.4))), step = B + 10, total = 4 * step;
  const block = (char: CharId, cls: string, mirror = false) => <div className={`kf-ladder-block ${cls}`} style={{ width: Math.round(B * 1.55), height: B }}><Portrait char={char} size={B - 12} mirror={mirror} square /></div>;
  return <div className="kf-tower" style={{ height: total }}>
    <div className="kf-tower-inner" style={{ height: total }}>
      {cup.rivals.map((c, n) => <div key={c} className="kf-ladder-row" style={{ bottom: n * step }}>
        {block(c, `${n < round ? 'kf-beaten' : ''}${n === round ? ' kf-current' : ''}${n === 3 ? ' kf-boss' : ''}`)}
        <b className="kf-ladder-n">{ROUNDS[n].replace(' de final', '').toUpperCase()}</b>
      </div>)}
      <div className="kf-ladder-you" style={{ bottom: pos * step, left: -Math.round(B * 1.55 * 1.5) - 18 }}>{block(you, 'kf-you', true)}</div>
    </div>
  </div>;
}
function StageThumb({ stage, w, h }: { stage: StageId; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(0);
  useEffect(() => onBackdropLoad(() => setLoaded(n => n + 1)), []);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const k = pixelRatio(2); c.width = w * k; c.height = h * k;
    const ctx = c.getContext('2d'); if (!ctx) return;
    ctx.setTransform(k, 0, 0, k, 0, 0); drawVoleyThumb(ctx, stage, w, h);
  }, [stage, w, h, loaded]);
  return <canvas ref={ref} style={{ width: '100%', aspectRatio: `${w}/${h}` }} aria-hidden="true" />;
}
const Keys = ({ keys }: { keys: string[] }) => <span className="kf-combo">{keys.map((k, i) => <span key={i}>{i > 0 && <i>+</i>}<kbd>{k}</kbd></span>)}</span>;

export function KombatVoley() {
  const fit = useFitScreen();
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const bgKey = useRef('');
  const matchRef = useRef<VMatch | null>(null);
  const inputs = useRef<[VInput, VInput]>([noVInput(), noVInput()]);
  const latch = useRef<Partial<VInput>>({});
  const [screen, setScreen] = useState<Screen>('menu');
  const [mode, setMode] = useState<Mode>('cpu');
  const [p1, setP1] = useState<CharId>('cometa');
  const [p2, setP2] = useState<CharId>('inferno');
  const [pick, setPick] = useState<0 | 1>(0);
  const [cursor, setCursor] = useState(0);
  const [stage, setStage] = useState<StageId>('industrial');
  const [difficulty, setDifficulty] = useState(1);
  const [round, setRound] = useState(0);
  const [ladderFrom, setLadderFrom] = useState(0);
  const [cup, setCup] = useState<Cup>(() => drawCup('cometa'));
  const [hud, setHud] = useState<Hud | null>(null);
  const [shouts, setShouts] = useState<Shout[]>([]);
  const [record, setRecord] = useState(readVoleyRecord);
  const [result, setResult] = useState<{ winner: 0 | 1; score: [number, number] } | null>(null);
  const [fighting, setFighting] = useState<[CharId, CharId]>(['cometa', 'inferno']);
  const [stageName, setStageName] = useState('');
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && fitViewport().w < 700);
  const [vp, setVp] = useState(() => typeof window !== 'undefined' ? fitViewport() : { w: 1280, h: 720 });
  const screenRef = useRef(screen); useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => { const on = () => { setNarrow(fitViewport().w < 700); setVp(fitViewport()); }; window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  const shoutId = useRef(0);
  const shout = useCallback((text: string, kind: Shout['kind'], sub?: string, ms = 1800) => {
    const id = ++shoutId.current;
    setShouts(list => [...list.filter(s => kind === 'info' ? s.kind !== 'info' : s.kind === 'info'), { id, text, sub, kind }].slice(-3));
    setTimeout(() => setShouts(list => list.filter(s => s.id !== id)), ms);
  }, []);

  const quality = useRef(0);
  const backdropTick = useRef(0);
  useEffect(() => onBackdropLoad(() => { backdropTick.current++; }), []);
  const paint = useCallback(() => {
    const el = stageRef.current, canvas = canvasRef.current, m = matchRef.current;
    if (!el || !canvas || !m) return;
    const touch = !!window.matchMedia?.('(pointer: coarse)').matches;
    const k = Math.min(pixelRatio(touch ? 1.5 : 2), (touch ? 1280 : 1920) / Math.max(1, el.clientWidth), (touch ? 760 : 1100) / Math.max(1, el.clientHeight)) * QUALITY[quality.current], w = Math.round(el.clientWidth * k), h = Math.round(el.clientHeight * k);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const low = touch || quality.current > 0; setLowFx(low); setNoGrain(low);
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
    drawVoley(ctx, m, w, h);
    const bg = bgRef.current;
    if (bg) { // el fondo en su propia capa, siempre con toda la resolución
      const kb = Math.min(pixelRatio(2), 2560 / Math.max(1, el.clientWidth), 1500 / Math.max(1, el.clientHeight)), bw = Math.round(el.clientWidth * kb), bh = Math.round(el.clientHeight * kb);
      if (bg.width !== bw || bg.height !== bh) { bg.width = bw; bg.height = bh; bgKey.current = ''; }
      const key = `${m.stage}|${backdropTick.current}|${bw}x${bh}`, bctx = bg.getContext('2d');
      if (bctx && key !== bgKey.current) { bgKey.current = key; bctx.setTransform(1, 0, 0, 1, 0, 0); drawVoleyBackdrop(bctx, m.stage, bw, bh); }
    }
    setNoGrain(false);
  }, []);

  // El partido de muestra detrás de los menús (dos máquinas jugando).
  const menuish = screen === 'menu' || screen === 'select' || screen === 'vs' || screen === 'ladder' || screen === 'stage' || screen === 'howto';
  const demoStage = screen === 'stage' || screen === 'howto' ? (mode === 'world' ? cup.stages[round] : stage) : 'industrial';
  useLayoutEffect(() => {
    if (!menuish) return;
    const m = newVoley(demoStage, [p1, p2], [0.6, 0.6]);
    matchRef.current = m;
    let frame = 0, last = performance.now();
    const tick = (now: number) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; stepVoley(m, [noVInput(), noVInput()], dt); takeVoleyEvents(m); if (m.phase === 'end' || Math.max(...m.score) > 20) { m.score = [0, 0]; m.winner = null; if (m.phase === 'end') m.phase = 'serve'; } if (screenRef.current === 'stage' || screenRef.current === 'howto' || screenRef.current === 'vs') paint(); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    const observer = new ResizeObserver(paint); if (stageRef.current) observer.observe(stageRef.current);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [menuish, demoStage, p1, p2, paint]);

  const begin = useCallback((n = round) => {
    playStart(); preloadKombatSounds();
    const st = mode === 'world' ? cup.stages[n] : stage, rival = mode === 'world' ? cup.rivals[n] : p2;
    const level = mode === 'world' ? roundLevel(n) : DIFFICULTY[difficulty].level;
    const m = newVoley(st, [p1, rival], [null, level]);
    matchRef.current = m; setFighting([p1, rival]);
    inputs.current = [noVInput(), noVInput()];
    setHud(hudOf(m)); setResult(null); setShouts([]);
    const def = STAGES.find(s => s.id === st)!;
    setStageName(`${mode === 'world' ? `Mundial · ${ROUNDS[n]} · ` : ''}${def.name}`);
    setScreen('playing');
  }, [mode, stage, p1, p2, difficulty, round, cup]);

  // ---------------------------------------------------------------- La selección (igual que en Kombat Football)
  const chooseChar = useCallback((idx: number) => {
    const id = CHAR_IDS[idx];
    playKfName(id, 0.12);
    if (pick === 0) {
      setP1(id);
      if (mode === 'world') { setCup(drawCup(id)); setRound(0); setLadderFrom(0); setScreen('ladder'); return; }
      setPick(1); const other = CHAR_IDS.indexOf(p2 === id ? CHAR_IDS[(idx + 1) % 16] : p2); setCursor(other); if (p2 === id) setP2(CHAR_IDS[other]);
    } else { setP2(id); setScreen('vs'); playKfVsSentence(p1, id); }
  }, [pick, mode, p1, p2]);
  const cols = 4;
  useEffect(() => {
    if (screen !== 'select' && screen !== 'vs' && screen !== 'stage' && screen !== 'howto' && screen !== 'ladder') return;
    const down = (e: KeyboardEvent) => {
      const k = e.code;
      if (screen === 'vs') { if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') { e.preventDefault(); playKfButton(); setScreen('stage'); } else if (k === 'Escape' || k === 'Backspace') { setPick(1); setCursor(CHAR_IDS.indexOf(p2)); setScreen('select'); } return; }
      if (screen === 'ladder') { if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') { e.preventDefault(); playKfButton(); setScreen('howto'); } else if (k === 'Escape' || k === 'Backspace') setScreen('select'); return; }
      if (screen === 'howto') { if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') { e.preventDefault(); playKfButton(); begin(mode === 'world' ? round : 0); } else if (k === 'Escape') setScreen(mode === 'world' ? 'ladder' : 'stage'); return; }
      const n = screen === 'select' ? 16 : STAGES.length, c = screen === 'select' ? cols : narrow ? 2 : 4;
      const cur = screen === 'select' ? cursor : STAGES.findIndex(s => s.id === stage);
      let next: number;
      if (k === 'ArrowLeft' || k === 'KeyA') next = (cur + n - 1) % n;
      else if (k === 'ArrowRight' || k === 'KeyD') next = (cur + 1) % n;
      else if (k === 'ArrowUp' || k === 'KeyW') next = (cur - c + n) % n;
      else if (k === 'ArrowDown' || k === 'KeyS') next = (cur + c) % n;
      else if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') { e.preventDefault(); playKfButton(); if (screen === 'select') chooseChar(cursor); else setScreen('howto'); return; }
      else if (k === 'Escape' || k === 'Backspace') { if (screen === 'stage') setScreen('vs'); else if (pick === 1) { setPick(0); setCursor(CHAR_IDS.indexOf(p1)); } else setScreen('menu'); return; }
      else return;
      e.preventDefault(); playKfButton(0.45);
      if (screen === 'select') { setCursor(next); playKfName(CHAR_IDS[next], 0.05); if (pick === 0) setP1(CHAR_IDS[next]); else setP2(CHAR_IDS[next]); } else setStage(STAGES[next].id);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [screen, cursor, cols, narrow, stage, pick, p1, p2, mode, round, begin, chooseChar]);

  // La música del menú.
  useEffect(() => { preloadKombatUi(); preloadBackdrops(STAGES.map(st => st.id)); const img = new Image(); img.src = spaceBg; }, []);
  useEffect(() => {
    setKfMusic(menuish);
    if (!menuish) return;
    const first = () => setKfMusic(true);
    window.addEventListener('pointerdown', first, { once: true }); window.addEventListener('keydown', first, { once: true });
    return () => { window.removeEventListener('pointerdown', first); window.removeEventListener('keydown', first); };
  }, [menuish]);
  useEffect(() => () => setKfMusic(false), []);

  // ---------------------------------------------------------------- El partido
  useEffect(() => {
    if (screen !== 'playing') { setCrowd(0); return; }
    setCrowd(0.6);
    let slow = 1 / 60, checkT = 0, frame = 0, last = performance.now(), acc = 0, netT = 0;
    const tick = (now: number) => {
      const m = matchRef.current; if (!m) return;
      const dt = Math.min(0.2, (now - last) / 1000); last = now; acc += dt;
      slow = slow * 0.95 + dt * 0.05; checkT += dt;
      if (checkT > 1.5) {
        if (slow > 1 / 45 && quality.current < QUALITY.length - 1) { quality.current++; checkT = 0; }
        else if (slow < 1 / 57 && quality.current > 0 && checkT > 6) { quality.current--; checkT = 0; }
      }
      for (let n = 0; acc >= 1 / 60 && n < 6; n++) {
        acc -= 1 / 60;
        stepVoley(m, [n === 0 ? { ...inputs.current[0], ...latch.current } : inputs.current[0], noVInput()], 1 / 60);
        if (n === 0) latch.current = {};
      }
      if (acc > 1 / 60) acc = 0;
      netT -= dt;
      for (const e of takeVoleyEvents(m)) {
        switch (e.type) {
          case 'serve': playKfBall(0.9, 0.95); break;
          case 'touch': playKfBall(e.kind === 'spike' ? 1.3 : e.kind === 'attack' ? 0.9 : 0.6, e.kind === 'spike' ? 0.85 : e.kind === 'set' ? 1.25 : 1.1); if (e.kind === 'spike' && e.side === 0) shout('¡REMATE!', 'info', undefined, 700); break;
          case 'net': if (netT <= 0) { playKfPost(); netT = 0.3; noteNetHit(m); } break;
          case 'land': playKfBall(0.5, 0.8); break;
          case 'boom': playExplosion(); break;
          case 'whistle': playRefWhistle('kickoff'); if (m.score[0] + m.score[1] === 0) shout('¡A JUGAR!', 'extra', `Un set a ${SET_POINTS} · ${BALLS[m.kind].name}`, 1400); break;
          case 'point': {
            playRefWhistle('half'); if (e.side === 0) playKfGoal();
            const why = e.why === 'floor' ? 'Picó en la cancha' : e.why === 'out' ? '¡Afuera!' : e.why === 'touches' ? 'Más de tres toques' : e.why === 'serve' ? 'Saque fallado' : 'Red';
            shout(`PUNTO ${CHARS[m.players[e.side].char].name}`, e.side === 0 ? 'goal' : 'block', `${why} · ${m.score[0]} - ${m.score[1]}`, 1700);
            break;
          }
          case 'setPoint': shout('¡PUNTO DE SET!', 'extra', undefined, 1200); break;
          case 'end': playRefWhistle('end'); break;
        }
      }
      paint();
      const next = hudOf(m);
      setHud(prev => prev && sameHud(prev, next) ? prev : next);
      if (m.phase === 'end' && m.phaseT > 2.6 && m.winner !== null) {
        const win = m.winner === 0, rec = readVoleyRecord();
        if (win) rec.wins++; else rec.losses++;
        let champion = false;
        if (mode === 'world' && win && round + 1 >= ROUNDS.length) { rec.cups++; champion = true; }
        saveRecord(rec); setRecord(rec);
        setResult({ winner: m.winner, score: [m.score[0], m.score[1]] });
        if (win) playWinFanfare(); else playGameOver();
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
  }, [screen, paint, shout, round, mode]);
  useEffect(() => () => setCrowd(0), []);

  // Teclado del partido.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const s = screenRef.current;
      if ((e.code === 'Escape' || e.code === 'KeyP') && (s === 'playing' || s === 'paused')) { setScreen(s === 'playing' ? 'paused' : 'playing'); return; }
      const k = KEYS[e.code];
      if (!k || s !== 'playing') return;
      e.preventDefault(); inputs.current[0][k] = true; latch.current[k] = true;
    };
    const up = (e: KeyboardEvent) => { const k = KEYS[e.code]; if (k) inputs.current[0][k] = false; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);
  useEffect(() => { const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prev; }; }, []);

  const hold = (key: Key) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); inputs.current[0][key] = true; latch.current[key] = true; },
    onPointerUp: () => { inputs.current[0][key] = false; },
    onPointerLeave: () => { inputs.current[0][key] = false; },
    onPointerCancel: () => { inputs.current[0][key] = false; },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const chars: [CharId, CharId] = screen === 'playing' || screen === 'paused' || screen === 'result' || screen === 'champion' ? fighting : [p1, mode === 'world' ? cup.rivals[round] : p2];
  const curStage: StageId = mode === 'world' ? cup.stages[round] : stage;
  const sideBar = (i: 0 | 1) => {
    const c = CHARS[chars[i]], serving = hud?.server === i, touches = hud ? hud.touches[i] : 0;
    return <div className={`kf-side kf-side--${i}`} data-testid={`kf-side-${i}`}>
      <Portrait char={chars[i]} size={64} mirror={i === 1} square />
      <div className="kf-bars">
        <div className="kf-energy" aria-label={c.name}><i style={{ width: '100%', background: `linear-gradient(180deg, ${c.color}, ${c.color}aa 60%, ${c.color}77)` }} /><b>{c.name}{i === 1 ? ' · CPU' : ''}</b></div>
        <div className="kf-sub">
          {serving && <em className="kf-pw">🏐 SAQUE</em>}
          <span className="kv-touches" aria-label={`${touches} toques`}>{[1, 2, 3].map(n => <i key={n} className={n <= touches ? 'on' : ''} />)}</span>
        </div>
      </div>
    </div>;
  };
  const howto = () => { const c = CHARS[chars[0]]; return <div className="kf-howto-card" style={{ ['--kf-c' as string]: c.color }}>
    <div className="kf-howto-head"><Portrait char={chars[0]} size={56} square /><div><b>{c.name}</b><small>Vos · lado izquierdo</small></div></div>
    <ul>
      <li><Keys keys={['←', '→']} /> moverte · <Keys keys={['↑']} /> o <Keys keys={['ESPACIO']} /> <b>saltar</b></li>
      <li>Si la pelota te toca sin apretar nada, <b>la recibís</b>: sube en tu cancha (en el tercer toque pasa sola al otro lado).</li>
      <li><Keys keys={['X']} /> <b>levantar</b>: la pelota sube alto cerca de la red, para rematarla.</li>
      <li><Keys keys={['V']} /> <b>golpear</b>: la pasás al otro lado. <b>Más tiempo apretada = más largo</b> (toquecito: junto a la red). Con → más fuerte, con ← globo. <b>Saltando junto a la red: REMATE</b>.</li>
      <li><Keys keys={['V']} /> <b>saque</b>: mantenela para cargarlo y soltala.</li>
    </ul>
  </div>; };

  const playing = screen === 'playing' || screen === 'paused';
  const selecting = screen === 'select';
  const shown = selecting ? CHAR_IDS[cursor] : p1;
  const cell = narrow ? Math.max(56, Math.min(99, Math.floor((vp.w - 40) / 4))) : Math.max(70, Math.min(156, Math.floor((vp.h - 230) / 4)));
  const cardH = narrow ? 225 : Math.round(Math.min(375, cell * 4 * 0.98, Math.max(150, vp.h - 360))), cardW = Math.round(cardH * 0.76);
  const ball = BALLS[STAGE_BALL[curStage]];
  return <section className="runner kf kv" style={fit} aria-label="Kombat Voley" onClickCapture={e => { if ((e.target as Element).closest('button, a')) playKfButton(); }}>
    <TouchGrips actionLabel={screen === 'playing' ? '🏐' : 'Elegir'} extra={playing ? <button type="button" className="kf-cast" aria-label="Levantar" {...hold('set')}>⇧</button> : undefined} />
    <div className="runner-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1>Kombat Voley</h1>
      <div className="runner-scores">
        {mode === 'world' && playing && <span>Mundial <strong data-testid="kv-round">{ROUNDS[round]}</strong></span>}
        {record.wins + record.losses > 0 && <span>Récord <strong>{record.wins}G {record.losses}P{record.cups ? ` · 🏆 ${record.cups}` : ''}</strong></span>}
      </div>
      {playing && <button type="button" onClick={() => setScreen(s => s === 'playing' ? 'paused' : 'playing')}>{screen === 'playing' ? 'Pausa' : 'Seguir'}</button>}
    </div>
    <div className="runner-stage kf-stage" ref={stageRef}>
      <canvas ref={bgRef} className="kf-bg" aria-hidden="true" />
      <canvas ref={canvasRef} role="img" aria-label="Cancha de Kombat Voley" />
      {playing && hud && <div className="kf-hud">
        {sideBar(0)}
        <div className="kf-center">
          <div className="kf-score" aria-live="polite">
            <div className="kf-score-main" data-testid="kv-score">
              <span className="kf-goals" style={{ ['--kf-c' as string]: CHARS[chars[0]].color }}>{hud.score[0]}</span><i> - </i><span className="kf-goals" style={{ ['--kf-c' as string]: CHARS[chars[1]].color }}>{hud.score[1]}</span>
            </div>
            <small className={hud.setPoint ? 'kf-golden' : ''}><b>SET</b>{hud.setPoint ? 'PUNTO DE SET' : `a ${SET_POINTS}`}</small>
          </div>
          <div className="kf-specials"><span className="kf-special kv-ball" style={{ ['--kf-c' as string]: ball.glow }}><b>🏐 {ball.name}</b><small>{ball.text}</small></span></div>
        </div>
        {sideBar(1)}
      </div>}
      {playing && hud?.intro && <div className="kf-vs" aria-hidden="true">
        <div className="kf-vs-side" style={{ ['--kf-c' as string]: CHARS[chars[0]].color }}><FighterCard char={chars[0]} w={150} h={190} /><b>{CHARS[chars[0]].name}</b></div>
        <div className="kf-vs-mid"><strong>VS</strong><small>{stageName}</small></div>
        <div className="kf-vs-side" style={{ ['--kf-c' as string]: CHARS[chars[1]].color }}><FighterCard char={chars[1]} w={150} h={190} mirror /><b>{CHARS[chars[1]].name}</b></div>
      </div>}
      {playing && hud?.serving && hud.server === 0 && <p className="kv-serve-hint">Tu saque: mantené <Keys keys={['V']} /> (más tiempo = más al fondo) y soltá</p>}
      {playing && <p className="kf-rotate">📱 Girá el celular para ver la cancha más grande</p>}
      <div className="kf-shouts" aria-live="assertive">
        {shouts.map(s => <div key={s.id} className={`kf-shout kf-shout--${s.kind}`} role="status">{s.text}{s.sub && <small>{s.sub}</small>}</div>)}
      </div>
      {screen === 'ladder' && <div className="kf-select kf-ladder" role="dialog" aria-labelledby="kf-title" style={{ backgroundImage: `radial-gradient(ellipse at 50% 42%, #0000 40%, #000000b0 100%), url(${vortexURL() ?? ''})`, backgroundSize: 'auto, cover', backgroundPosition: 'center', backgroundColor: '#0b0518' }}>
        <h2 id="kf-title">MUNDIAL DE KOMBAT VOLEY</h2>
        <Bracket key={`${p1}-${round}`} you={p1} cup={cup} round={round} from={ladderFrom} height={Math.max(260, vp.h - 230)} />
        <p className="kf-zone" data-testid="kv-ladder-next"><b>{ROUNDS[round]}</b> · <b>{CHARS[p1].name}</b> vs <b>{CHARS[cup.rivals[round]].name}</b> · {STAGES.find(s => s.id === cup.stages[round])!.name}</p>
        <div className="kf-actions">
          <button type="button" className="kf-secondary" onClick={() => setScreen('select')}>‹ Volver</button>
          <button type="button" onClick={() => setScreen('howto')} autoFocus>¡A jugar! ▶</button>
        </div>
      </div>}
      {screen === 'vs' && <div className="kf-select kf-versus" role="dialog" aria-labelledby="kf-title" style={{ backgroundImage: `linear-gradient(90deg, ${CHARS[p1].color}38, #0000 38%, #0000 62%, ${CHARS[p2].color}38), radial-gradient(ellipse at 50% 50%, #0000 30%, #000000c0 100%), url(${spaceBg})`, backgroundSize: 'auto, auto, cover', backgroundPosition: 'center', backgroundColor: '#03020c' }}>
        <h2 id="kf-title" className="sr-only">{CHARS[p1].name} contra {CHARS[p2].name}</h2>
        <div className="kf-versus-row">
          {([0, 1] as const).map(side => { const id = side === 0 ? p1 : p2, h = narrow ? Math.min(250, vp.h * 0.36, (vp.w - 50) / 2 / 0.76) : Math.min(560, vp.h * 0.62); return <div key={side} className={`kf-versus-side kf-versus-side--${side + 1}`} style={{ ['--kf-c' as string]: CHARS[id].color }}>
            <small>{side === 0 ? 'VOS' : 'CPU'}</small>
            <FighterCard char={id} w={Math.round(h * 0.76)} h={Math.round(h)} mirror={side === 1} />
            <b data-testid={`kv-vs-${side + 1}`}>{CHARS[id].name}</b>
            <StatBars char={id} right={side === 1} />
          </div>; })}
          <div className="kf-versus-mid" aria-hidden="true"><strong>VS</strong></div>
        </div>
        <div className="kf-actions">
          <button type="button" className="kf-secondary" onClick={() => { setPick(1); setCursor(CHAR_IDS.indexOf(p2)); setScreen('select'); }}>‹ Volver</button>
          <button type="button" onClick={() => setScreen('stage')} autoFocus>Elegir el estadio ▶</button>
        </div>
      </div>}
      {selecting && <div className="kf-select" role="dialog" aria-labelledby="kf-title" style={{ backgroundImage: `radial-gradient(ellipse at 50% 45%, #0000 55%, #00000080 100%), url(${spaceBg})`, backgroundSize: 'auto, cover', backgroundPosition: 'center', backgroundColor: '#03020c' }}>
        <h2 id="kf-title">{pick === 0 ? 'ELEGÍ TU JUGADOR' : 'ELEGÍ AL RIVAL'}</h2>
        <div className="kf-select-row">
          <div className={`kf-pick kf-pick--1${pick === 0 ? ' kf-pick--active' : ''}`} style={{ ['--kf-c' as string]: CHARS[pick === 0 ? shown : p1].color }}>
            <FighterCard char={pick === 0 ? shown : p1} w={cardW} h={cardH} />
            <b data-testid="kv-pick-1">{CHARS[pick === 0 ? shown : p1].name}</b>
            <small>VOS</small>
            <StatBars char={pick === 0 ? shown : p1} />
          </div>
          <div className="kf-grid" role="group" aria-label={pick === 0 ? 'Tu jugador' : 'Rival'} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {CHAR_IDS.map((id, i) => {
              const sel1 = pick === 0 ? cursor === i : id === p1, sel2 = pick === 1 && cursor === i;
              return <button key={id} type="button" className={`kf-cell${sel1 ? ' kf-cell--1' : ''}${sel2 ? ' kf-cell--2' : ''}`} aria-label={CHARS[id].name} aria-pressed={cursor === i}
                onClick={() => { if (cursor === i) chooseChar(i); else { setCursor(i); playKfName(id); if (pick === 0) setP1(id); else setP2(id); } }}
                onDoubleClick={() => chooseChar(i)}>
                <Portrait char={id} size={cell} square />
                {sel1 && <i className="kf-tag kf-tag--1">1</i>}{sel2 && <i className="kf-tag kf-tag--2">CPU</i>}
              </button>;
            })}
          </div>
          <div className={`kf-pick kf-pick--2${pick === 1 ? ' kf-pick--active' : ''}`} style={{ ['--kf-c' as string]: CHARS[pick === 1 ? CHAR_IDS[cursor] : p2].color }}>
            {pick === 1 ? <FighterCard char={CHAR_IDS[cursor]} w={cardW} h={cardH} mirror /> : <div className="kf-pick-empty" style={{ width: cardW, height: cardH }}>?</div>}
            <b data-testid="kv-pick-2">{pick === 1 ? CHARS[CHAR_IDS[cursor]].name : '—'}</b>
            <small>CPU</small>
            {pick === 1 && <StatBars char={CHAR_IDS[cursor]} right />}
          </div>
        </div>
        <div className="kf-actions">
          <button type="button" className="kf-secondary" onClick={() => { if (pick === 1) { setPick(0); setCursor(CHAR_IDS.indexOf(p1)); } else setScreen('menu'); }}>‹ Volver</button>
          {pick === 1 && <button type="button" className="kf-secondary" onClick={() => chooseChar(CHAR_IDS.indexOf(CHAR_IDS.filter(c => c !== p1)[Math.floor(Math.random() * 15)]))}>🎲 Al azar</button>}
          <button type="button" onClick={() => chooseChar(cursor)}>Elegir {CHARS[CHAR_IDS[cursor]].name} ▶</button>
        </div>
        <p className="kf-hint">Flechas para moverte · ENTER para elegir · o tocá la cara (dos veces para elegir)</p>
      </div>}
      {screen !== 'playing' && !selecting && screen !== 'vs' && <div className={`runner-overlay kf-overlay${screen === 'menu' ? ' kf-menu-wall' : ''}`} role="dialog" aria-labelledby="kf-title" style={screen === 'menu' ? { backgroundImage: `radial-gradient(ellipse at 50% 45%, #0000 40%, #000000b3 100%), url(${menuBg})`, backgroundSize: 'auto, cover', backgroundPosition: 'center', backgroundColor: '#1a0503' } : undefined}>
        <div>
          {screen === 'menu' && <>
            <h2 id="kf-title" className="kf-logo">KOMBAT<br /><span>VOLEY</span></h2>
            <p>Vóley uno contra uno con los luchadores de Kombat Football: un set a {SET_POINTS} (con dos de diferencia), tres toques por lado y remates saltando junto a la red. 16 estadios, cada uno con su pelota: meteorito de fuego, bomba, rayo, fantasma, lunar…</p>
            <div className="kf-modes">
              <button type="button" onClick={() => { playKfSelectVoice(); setMode('cpu'); setPick(0); setCursor(CHAR_IDS.indexOf(p1)); setScreen('select'); }} autoFocus>Amistoso</button>
              <button type="button" onClick={() => { playKfSelectVoice(); setMode('world'); setRound(0); setLadderFrom(0); setPick(0); setCursor(CHAR_IDS.indexOf(p1)); setScreen('select'); }}>Mundial</button>
            </div>
          </>}
          {screen === 'stage' && <>
            <h2 id="kf-title" className="kf-title-mk">ELEGÍ EL ESTADIO</h2>
            <div className="kf-stagegrid" role="group" aria-label="Estadio">
              {STAGES.map(s => <button key={s.id} type="button" className={stage === s.id ? 'kf-chosen' : ''} aria-pressed={stage === s.id} onClick={() => { if (stage === s.id) setScreen('howto'); else setStage(s.id); }} title={BALLS[STAGE_BALL[s.id]].text}>
                <StageThumb stage={s.id} w={180} h={84} /><b>{s.name}</b><small>🏐 {BALLS[STAGE_BALL[s.id]].name}</small>
              </button>)}
            </div>
            <div className="kf-diff" role="group" aria-label="Dificultad">{DIFFICULTY.map((d, i) => <button key={d.name} type="button" className={difficulty === i ? 'kf-chosen' : ''} aria-pressed={difficulty === i} onClick={() => setDifficulty(i)}>{d.name}</button>)}</div>
            <div className="kf-actions">
              <button type="button" className="kf-secondary" onClick={() => setScreen('vs')}>‹ Volver</button>
              <button type="button" onClick={() => setScreen('howto')}>Siguiente ▶</button>
            </div>
          </>}
          {screen === 'howto' && <>
            <h2 id="kf-title" className="kf-title-mk">CONTROLES</h2>
            <p className="kf-note">{CHARS[chars[0]].name} vs {CHARS[chars[1]].name} · {STAGES.find(s => s.id === curStage)!.name} · 🏐 {ball.name}: {ball.text}</p>
            <div className="kf-howto">{howto()}</div>
            <p className="kf-note">Un solo set a {SET_POINTS}: hay que llegar con dos puntos de diferencia. Punto del rival si la pelota pica en tu cancha, si la tirás afuera o si la tocás más de tres veces. Saca el que ganó el punto.</p>
            <div className="kf-actions">
              <button type="button" className="kf-secondary" onClick={() => setScreen(mode === 'world' ? 'ladder' : 'stage')}>‹ Volver</button>
              <button type="button" onClick={() => begin(mode === 'world' ? round : 0)} autoFocus>¡A jugar!</button>
            </div>
          </>}
          {screen === 'paused' && <>
            <h2 id="kf-title">Pausa</h2>
            <div className="kf-howto">{howto()}</div>
            <div className="kf-actions">
              <button type="button" className="kf-secondary" onClick={() => setScreen('menu')}>Abandonar</button>
              <button type="button" onClick={() => setScreen('playing')} autoFocus>Seguir</button>
            </div>
          </>}
          {screen === 'result' && result && <>
            <EndBanner win={result.winner === 0} id="kf-title" />
            <p className="kf-final">{CHARS[chars[0]].name} <b>{result.score[0]} - {result.score[1]}</b> {CHARS[chars[1]].name}</p>
            {mode === 'world' && <p>{result.winner === 0 ? `¡Ganaste ${ROUNDS[round].toLowerCase()}! Pasás a ${ROUNDS[round + 1].toLowerCase()}.` : `Quedaste afuera en ${ROUNDS[round].toLowerCase()}.`}</p>}
            <div className="kf-actions">
              <button type="button" className="kf-secondary" onClick={() => setScreen('menu')}>Menú</button>
              {mode === 'world' && result.winner === 0
                ? <button type="button" onClick={() => { const n = round + 1; setLadderFrom(round); setRound(n); setScreen('ladder'); }} autoFocus>Siguiente partido ▶</button>
                : <button type="button" onClick={() => begin(round)} autoFocus>{mode === 'world' ? 'Reintentar el partido' : 'Revancha'}</button>}
            </div>
          </>}
          {screen === 'champion' && <>
            <Fireworks />
            <h2 id="kf-title" className="end-banner end-banner--win">🏆 ¡CAMPEÓN DEL MUNDO!</h2>
            <p>Ganaste octavos, cuartos, semifinal y la final con {CHARS[chars[0]].name}.</p>
            <div className="kf-actions"><button type="button" onClick={() => { setRound(0); setScreen('menu'); }} autoFocus>VOLVER A JUGAR</button></div>
          </>}
        </div>
      </div>}
    </div>
    {screen === 'playing' && <GamePad className="kf-pad" action={{ hold: hold('hit'), label: 'Golpear' }} actionLabel="🏐" dirs={{ left: { hold: hold('left'), aria: 'Izquierda' }, right: { hold: hold('right'), aria: 'Derecha' }, up: { hold: hold('up'), aria: 'Saltar' }, down: { hold: hold('down'), aria: 'Abajo' } }} extra={<button type="button" className="kf-cast" aria-label="Levantar" {...hold('set')}>⇧</button>} />}
  </section>;
}
