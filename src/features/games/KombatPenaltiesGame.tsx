import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fitViewport, pixelRatio, useFitScreen } from './fitScreen';
import { CHARS, CHAR_IDS, STAGES, STATS, type CharId, type StageId } from './kombat';
import {
  BALL_FX_NAMES, REGULATION, cpuZone, fxOfTurn, newPenalties, scoreOf, shooterOf, startKick, stepPenalties, suddenDeath, takePenEvents,
  penaltyScore, type PenMatch, type Zone,
} from './kombatPenalties';
import { drawPenBackdrop, drawPenThumb, drawPenalties, keeperBody, kickerBody, onPenaltyArtLoad, penView, preloadPenaltyArt, zoneAt } from './kombatPenaltiesArt';
import { CUP_ROUNDS, cupSlot, finishRound, newCup, yourMatch, type Cup } from './kombatVoleyCup';
import { drawFighterCard, drawPortrait, setLowFx } from './kombatFighters';
import { setNoGrain } from './gravityMonsters';
import spaceBg from './assets/fondos/kf-espacio.webp';
import menuBg from './assets/fondos/kf-menu.webp';
import menuBall from './assets/penales/pelota.webp';
import { onBackdropLoad, preloadBackdrops } from './kombatScenery';
import {
  playGameOver, playKfButton, playKfGoal, playKfName, playKfSelectVoice, playKfVsSentence,
  playPenExplosion, playPenKick, playPenNet, playPenSave, playPenSteps, playRefWhistle, playStart, preloadPenaltySounds, playWinFanfare, preloadKombatSounds, preloadKombatUi, setCrowd, setKfMusic,
} from './sounds';
import { EndBanner } from './EndBanner';
import { Fireworks } from './Fireworks';

// Kombat Penales: tanda de penales entre dos luchadores de Kombat Football, en sus mismos 16 estadios. Cinco penales
// por lado y, si empatan, uno cada uno hasta que alguno erre. Contra la máquina (amistoso o mundial, que elige dónde
// tirarse antes de que patees) o entre dos personas en la misma compu (primero elige el arquero y después el que patea).

// ---------------------------------------------------------------- Récords (en el navegador)
const RECORD_KEY = 'escritorio-personal-juegos:kombat-penales';
export interface PenRecord { wins: number; losses: number; cups: number }
export const readPenRecord = (): PenRecord => {
  try { const v = JSON.parse(localStorage.getItem(RECORD_KEY) ?? 'null'); return v && typeof v.wins === 'number' ? v : { wins: 0, losses: 0, cups: 0 }; } catch { return { wins: 0, losses: 0, cups: 0 }; }
};
const saveRecord = (r: PenRecord) => { try { localStorage.setItem(RECORD_KEY, JSON.stringify(r)); } catch { /* sin almacenamiento */ } };

type Mode = 'cpu' | 'world' | 'two';
type Screen = 'menu' | 'select' | 'vs' | 'ladder' | 'stage' | 'howto' | 'playing' | 'paused' | 'result' | 'champion';
// La dificultad: cuánto llega el arquero de la máquina cuando adivina el lado pero no la altura.
const DIFFICULTY = [{ name: 'Fácil', reach: 0.12 }, { name: 'Normal', reach: 0.3 }, { name: 'Difícil', reach: 0.5 }];
const HUMAN_REACH = 0.3;
const ROUNDS = CUP_ROUNDS;
const roundReach = (n: number) => 0.18 + n * 0.1;
const rivalOf = (cup: Cup, n: number): CharId => yourMatch(cup, n)?.rival ?? CHAR_IDS.find(c => c !== cup.you)!;
const QUALITY = [1, 0.82, 0.68, 0.55];
const ZONE_KEYS: Record<string, Zone> = { KeyQ: 0, KeyW: 1, KeyE: 2, KeyA: 3, KeyS: 4, KeyD: 5, Numpad7: 0, Numpad8: 1, Numpad9: 2, Numpad1: 3, Numpad2: 4, Numpad3: 5, Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5 };
// Con las flechas: ↑ arriba al medio, ↓ abajo al medio; ← una vez abajo a la izquierda y dos veces (seguidas)
// arriba a la izquierda; → igual a la derecha. DOUBLE_MS: cuánto se espera la segunda vez.
const DOUBLE_MS = 380;
interface Shout { id: number; text: string; sub?: string; kind: 'goal' | 'fatal' | 'info' | 'block' | 'extra' }
// Quién tiene que elegir ahora: el arquero o el que patea (y de qué lado es).
interface Aim { role: 'keeper' | 'shooter'; side: 0 | 1 }
interface Hud { kicks: [boolean[], boolean[]]; turn: number; sudden: boolean }

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
function StatBars({ char, right = false }: { char: CharId; right?: boolean }) {
  return <div className={`kf-stats${right ? ' kf-stats--r' : ''}`}>
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
// La copa del mundial de penales y el cuadro (igual que el de Kombat Voley).
const Trophy = ({ size }: { size: number }) => <svg className="kv-trophy" width={size} height={size * 1.25} viewBox="0 0 100 125" aria-hidden="true">
  <defs>
    <linearGradient id="kp-gold" x1="0" x2="1"><stop offset="0" stopColor="#7c4a03" /><stop offset=".3" stopColor="#fde68a" /><stop offset=".55" stopColor="#f59e0b" /><stop offset="1" stopColor="#78350f" /></linearGradient>
    <radialGradient id="kp-ballg" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#fff" /><stop offset=".7" stopColor="#e5e7eb" /><stop offset="1" stopColor="#6b7280" /></radialGradient>
  </defs>
  <circle cx="50" cy="20" r="17" fill="url(#kp-ballg)" stroke="#111" strokeWidth="1.5" />
  <polygon points="50,13 57,18 54,26 46,26 43,18" fill="#111" />
  <path d="M50 13 V4 M57 18 L66 15 M54 26 L59 33 M46 26 L41 33 M43 18 L34 15" stroke="#111" strokeWidth="1.5" />
  <path d="M22 38 H78 C78 62 66 74 56 78 V90 H44 V78 C34 74 22 62 22 38 Z" fill="url(#kp-gold)" stroke="#451a03" strokeWidth="1.5" />
  <path d="M22 44 C8 44 8 62 26 64 M78 44 C92 44 92 62 74 64" fill="none" stroke="url(#kp-gold)" strokeWidth="5" />
  <path d="M30 98 H70 L74 112 H26 Z" fill="url(#kp-gold)" stroke="#451a03" strokeWidth="1.5" />
  <rect x="38" y="88" width="24" height="11" rx="2" fill="#92400e" />
  <rect x="20" y="111" width="60" height="10" rx="2" fill="#1c1917" stroke="#a16207" strokeWidth="1.5" />
  <text x="50" y="119" textAnchor="middle" fontSize="7" fontWeight="900" fill="#fcd34d" fontFamily="system-ui">KOMBAT PENALES</text>
  <path d="M34 44 C34 58 40 66 46 70" fill="none" stroke="#fff8" strokeWidth="3" strokeLinecap="round" />
</svg>;
function WorldBracket({ cup, round, reveal, width, height }: { cup: Cup; round: number; reveal: number; width: number; height: number }) {
  const W = width, H = height, col = W / 10, S = Math.round(Math.max(26, Math.min(col * 0.74, (H / 8) * 0.78))), top = 22, ph = H - top;
  const pos = (c: number, k: number) => {
    const half = (16 >> c) / 2, left = k < half, j = left ? k : k - half;
    return { x: left ? (c + 0.5) * col : W - (c + 0.5) * col, y: top + (j + 0.5) * ph / half, left };
  };
  const mine = yourMatch(cup, round), champ = cup.champion;
  const lines: React.ReactNode[] = [], slots: React.ReactNode[] = [];
  for (let c = 0; c < 4; c++) for (let k = 0; k < (16 >> c); k++) {
    const p = pos(c, k), sl = cupSlot(cup, c, k), sgn = p.left ? 1 : -1, xin = p.x + sgn * S / 2;
    const n = c < 3 ? pos(c + 1, Math.floor(k / 2)) : { x: W / 2, y: top + ph / 2 }, nS = c < 3 ? S : S * 1.3, xout = n.x - sgn * nS / 2, xm = (xin + xout) / 2;
    const you = sl?.char === cup.you, fresh = c === reveal - 1 && sl?.won;
    const color = sl?.won ? (you ? '#fbbf24' : '#e2e8f0') : sl?.lost ? '#33415588' : '#64748b88';
    lines.push(<path key={`l${c}-${k}`} className={fresh ? 'kv-line-new' : undefined} d={`M${xin} ${p.y} H${xm} V${n.y} H${xout}`} fill="none" stroke={color} strokeWidth={sl?.won ? (you ? 4 : 3) : 2} strokeLinejoin="round" pathLength={1} />);
    const current = !!mine && c === round && !champ && Math.floor(k / 2) === mine.index;
    slots.push(<div key={`s${c}-${k}-${sl?.char ?? ''}`} data-testid={`kp-slot-${c}-${k}`} title={sl ? CHARS[sl.char].name : undefined}
      className={`kv-slot${sl ? '' : ' kv-slot--empty'}${you ? ' kv-slot--you' : ''}${sl?.lost ? ' kv-slot--out' : ''}${current ? ' kv-slot--now' : ''}${c === reveal && c > 0 ? ' kv-slot--new' : ''}`}
      style={{ left: p.x - S / 2, top: p.y - S / 2, width: S, height: S, ['--d' as string]: `${0.15 + (k % (8 >> c)) * 0.05}s` }}>
      {sl ? <Portrait char={sl.char} size={S - 6} mirror={!p.left} square /> : <span>?</span>}
      {c === 0 && sl && <i className="kv-seed" style={{ [p.left ? 'right' : 'left']: S + 4 }}>{cup.seed[sl.char]}</i>}
      {sl && sl.score !== null && <b className={`kv-score${sl.won ? ' kv-score--won' : ''}`} style={{ [p.left ? 'left' : 'right']: S + 3 }}>{sl.score}</b>}
    </div>);
  }
  const cS = Math.round(S * 1.3);
  return <div className="kv-bracket" data-testid="kp-bracket" style={{ width: W, height: H }}>
    {(['OCTAVOS', 'CUARTOS', 'SEMIS', 'FINAL'] as const).map((t, c) => <span key={t} className={`kv-col${c === round && !champ ? ' kv-col--now' : ''}`} style={{ left: (c + 0.5) * col, ['--w' as string]: `${col}px` }}>{t}</span>)}
    {(['OCTAVOS', 'CUARTOS', 'SEMIS', 'FINAL'] as const).map((t, c) => <span key={`r${t}`} className={`kv-col${c === round && !champ ? ' kv-col--now' : ''}`} style={{ left: W - (c + 0.5) * col, ['--w' as string]: `${col}px` }}>{t}</span>)}
    <svg className="kv-lines" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">{lines}</svg>
    {slots}
    <div className="kv-cup" style={{ left: W / 2, top: top + ph / 2 - cS / 2 - Math.min(ph * 0.42, col * 2.3) - 4 }}><Trophy size={Math.min(ph * 0.34, col * 1.85)} /></div>
    <div data-testid="kp-champion" className={`kv-slot kv-slot--champ${champ ? (champ === cup.you ? ' kv-slot--you' : '') : ' kv-slot--empty'}${reveal === 4 ? ' kv-slot--new' : ''}`} title={champ ? CHARS[champ].name : 'Campeón'}
      style={{ left: W / 2 - cS / 2, top: top + ph / 2 - cS / 2, width: cS, height: cS, ['--d' as string]: '0.4s' }}>
      {champ ? <Portrait char={champ} size={cS - 6} square /> : <span>🏆</span>}
    </div>
    <small className="kv-note" style={{ top: top + ph / 2 + cS / 2 + 8 }}>{champ ? `CAMPEÓN: ${CHARS[champ].name}` : 'Rivales sorteados al azar'}</small>
  </div>;
}
function StageThumb({ stage, w, h }: { stage: StageId; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(0);
  useEffect(() => onBackdropLoad(() => setLoaded(n => n + 1)), []);
  useEffect(() => onPenaltyArtLoad(() => setLoaded(n => n + 1)), []);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const k = pixelRatio(2); c.width = Math.round(w * k); c.height = Math.round(h * k);
    const ctx = c.getContext('2d'); if (!ctx) return;
    drawPenThumb(ctx, stage, c.width, c.height);
  }, [stage, w, h, loaded]);
  return <canvas ref={ref} style={{ width: '100%', aspectRatio: `${w}/${h}` }} aria-hidden="true" />;
}
const Keys = ({ keys }: { keys: string[] }) => <span className="kf-combo">{keys.map((k, i) => <span key={i}>{i > 0 && <i>+</i>}<kbd>{k}</kbd></span>)}</span>;
// Los penales de cada uno: ✓ gol, ✗ errado, ○ los que faltan (5, o más en la muerte súbita).
function KickDots({ kicks, total, testId }: { kicks: boolean[]; total: number; testId: string }) {
  return <span className="kp-dots" data-testid={testId} aria-label={`${kicks.filter(Boolean).length} goles en ${kicks.length} penales`}>
    {Array.from({ length: total }, (_, i) => <i key={i} className={i < kicks.length ? (kicks[i] ? 'kp-dot kp-dot--goal' : 'kp-dot kp-dot--miss') : 'kp-dot'} />)}
  </span>;
}

export function KombatPenalties() {
  const fit = useFitScreen();
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const bgKey = useRef('');
  const matchRef = useRef<PenMatch | null>(null);
  const picks = useRef<{ shot: Zone | null; dive: Zone | null }>({ shot: null, dive: null });
  const [screen, setScreen] = useState<Screen>('menu');
  const [mode, setMode] = useState<Mode>('cpu');
  const [p1, setP1] = useState<CharId>('cometa');
  const [p2, setP2] = useState<CharId>('inferno');
  const [pick, setPick] = useState<0 | 1>(0);
  const [cursor, setCursor] = useState(0);
  const [stage, setStage] = useState<StageId>('industrial');
  const [difficulty, setDifficulty] = useState(1);
  const [round, setRound] = useState(0);
  const [reveal, setReveal] = useState(0);
  const [cup, setCup] = useState<Cup>(() => newCup('cometa'));
  const [hud, setHud] = useState<Hud | null>(null);
  const [aim, setAim] = useState<Aim | null>(null);
  const aimRef = useRef<Aim | null>(null); useEffect(() => { aimRef.current = aim; }, [aim]);
  const [, setZoneCursor] = useState<Zone>(1);
  const zoneRef = useRef<Zone | null>(1);
  const [shouts, setShouts] = useState<Shout[]>([]);
  const [record, setRecord] = useState(readPenRecord);
  const [result, setResult] = useState<{ winner: 0 | 1; score: [number, number] } | null>(null);
  const [fighting, setFighting] = useState<[CharId, CharId]>(['cometa', 'inferno']);
  const [stageName, setStageName] = useState('');
  const [intro, setIntro] = useState(false);
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && fitViewport().w < 700);
  const [vp, setVp] = useState(() => typeof window !== 'undefined' ? fitViewport() : { w: 1280, h: 720 });
  const screenRef = useRef(screen); useEffect(() => { screenRef.current = screen; }, [screen]);
  const modeRef = useRef(mode); useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { const on = () => { setNarrow(fitViewport().w < 700); setVp(fitViewport()); }; window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  const shoutId = useRef(0);
  const shout = useCallback((text: string, kind: Shout['kind'], sub?: string, ms = 1800) => {
    const id = ++shoutId.current;
    setShouts(list => [...list.filter(s => kind === 'info' ? s.kind !== 'info' : s.kind === 'info'), { id, text, sub, kind }].slice(-3));
    setTimeout(() => setShouts(list => list.filter(s => s.id !== id)), ms);
  }, []);
  const reachRef = useRef(DIFFICULTY[1].reach);
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __kpMatch?: () => PenMatch | null }).__kpMatch = () => matchRef.current; }, []); // (para probar en desarrollo)

  const quality = useRef(0);
  const backdropTick = useRef(0);
  useEffect(() => onBackdropLoad(() => { backdropTick.current++; }), []);
  useEffect(() => onPenaltyArtLoad(() => { backdropTick.current++; }), []);
  const paint = useCallback(() => {
    const el = stageRef.current, canvas = canvasRef.current, m = matchRef.current;
    if (!el || !canvas || !m) return;
    const touch = !!window.matchMedia?.('(pointer: coarse)').matches;
    const k = Math.min(pixelRatio(touch ? 1.5 : 2), (touch ? 1280 : 1920) / Math.max(1, el.clientWidth), (touch ? 760 : 1100) / Math.max(1, el.clientHeight)) * QUALITY[quality.current], w = Math.round(el.clientWidth * k), h = Math.round(el.clientHeight * k);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const low = touch || quality.current > 0; setLowFx(low); setNoGrain(low);
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
    drawPenalties(ctx, m, w, h);
    const bg = bgRef.current;
    if (bg) { // el fondo y la cancha en su propia capa, siempre con toda la resolución
      const kb = Math.min(pixelRatio(2), 2560 / Math.max(1, el.clientWidth), 1500 / Math.max(1, el.clientHeight)), bw = Math.round(el.clientWidth * kb), bh = Math.round(el.clientHeight * kb);
      if (bg.width !== bw || bg.height !== bh) { bg.width = bw; bg.height = bh; bgKey.current = ''; }
      const key = `${m.stage}|${backdropTick.current}|${bw}x${bh}`, bctx = bg.getContext('2d');
      if (bctx && key !== bgKey.current) { bgKey.current = key; bctx.setTransform(1, 0, 0, 1, 0, 0); drawPenBackdrop(bctx, m.stage, bw, bh); }
    }
    setNoGrain(false);
  }, []);

  // Detrás de los menús: el estadio con el arco esperando.
  const menuish = screen === 'menu' || screen === 'select' || screen === 'vs' || screen === 'ladder' || screen === 'stage' || screen === 'howto';
  const demoStage = screen === 'stage' || screen === 'howto' ? (mode === 'world' ? cup.stages[round] : stage) : 'industrial';
  useLayoutEffect(() => {
    if (!menuish) return;
    const m = newPenalties(demoStage, [p1, mode === 'world' ? rivalOf(cup, round) : p2]); m.phase = 'aim';
    matchRef.current = m;
    let frame = 0, last = performance.now();
    const tick = (now: number) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; m.time += dt; if (screenRef.current === 'stage' || screenRef.current === 'howto' || screenRef.current === 'vs') paint(); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    const observer = new ResizeObserver(paint); if (stageRef.current) observer.observe(stageRef.current);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [menuish, demoStage, p1, p2, paint, mode, cup, round]);

  // Arranca cada penal: la máquina elige primero (escondido) y después le toca a la persona.
  const setupTurn = useCallback((m: PenMatch) => {
    picks.current = { shot: null, dive: null };
    const shooter = shooterOf(m.turn), keeper: 0 | 1 = shooter === 0 ? 1 : 0;
    let next: Aim;
    if (modeRef.current === 'two') next = { role: 'keeper', side: keeper };
    else if (shooter === 0) { picks.current.dive = cpuZone(m.rand); next = { role: 'shooter', side: 0 }; }
    else { picks.current.shot = cpuZone(m.rand); next = { role: 'keeper', side: 0 }; }
    zoneRef.current = 1; setZoneCursor(1); setAim(next);
  }, []);

  const begin = useCallback((n = round) => {
    playStart(); preloadKombatSounds(); preloadPenaltySounds(); preloadPenaltyArt();
    const st = mode === 'world' ? cup.stages[n] : stage, rival = mode === 'world' ? rivalOf(cup, n) : p2;
    reachRef.current = mode === 'world' ? roundReach(n) : DIFFICULTY[difficulty].reach;
    const m = newPenalties(st, [p1, rival]); m.humans = [true, mode === 'two'];
    matchRef.current = m; setFighting([p1, rival]);
    setHud({ kicks: [[], []], turn: 0, sudden: false }); setResult(null); setShouts([]); setAim(null); setIntro(true);
    const def = STAGES.find(s => s.id === st)!;
    setStageName(`${mode === 'world' ? `Mundial · ${ROUNDS[n]} · ` : ''}${def.name}`);
    setScreen('playing');
  }, [mode, stage, p1, p2, difficulty, round, cup]);

  // La elección de un lugar del arco (con el mouse, tocando, o con el teclado).
  const choose = useCallback((z: Zone) => {
    const m = matchRef.current, a = aimRef.current;
    if (!m || !a || m.phase !== 'aim' || screenRef.current !== 'playing') return;
    playKfButton(0.7);
    if (a.role === 'keeper') picks.current.dive = z; else picks.current.shot = z;
    if (modeRef.current === 'two' && a.role === 'keeper') { const s = shooterOf(m.turn); setAim({ role: 'shooter', side: s }); zoneRef.current = 1; setZoneCursor(1); return; }
    const { shot, dive } = picks.current;
    if (shot === null || dive === null) return;
    // el arquero de la máquina llega según la dificultad; el de una persona, siempre igual
    const cpuKeeps = modeRef.current !== 'two' && shooterOf(m.turn) === 0;
    startKick(m, shot, dive, cpuKeeps ? reachRef.current : HUMAN_REACH);
    playPenSteps(); // corre a la pelota
    setAim(null);
  }, []);
  // las flechas a la izquierda o a la derecha: una vez abajo, dos veces seguidas arriba
  const tap = useRef<{ dir: 'left' | 'right'; timer: number } | null>(null);
  const arrowSide = useCallback((dir: 'left' | 'right') => {
    const low: Zone = dir === 'left' ? 3 : 5, high: Zone = dir === 'left' ? 0 : 2, prev = tap.current;
    if (prev) { clearTimeout(prev.timer); tap.current = null; if (prev.dir === dir) { zoneRef.current = high; setZoneCursor(high); choose(high); return; } }
    zoneRef.current = low; setZoneCursor(low); playKfButton(0.35);
    tap.current = { dir, timer: window.setTimeout(() => { tap.current = null; choose(low); }, DOUBLE_MS) };
  }, [choose]);
  useEffect(() => () => { if (tap.current) clearTimeout(tap.current.timer); }, []);

  // ---------------------------------------------------------------- La selección (igual que en Kombat Football)
  const chooseChar = useCallback((idx: number) => {
    const id = CHAR_IDS[idx];
    playKfName(id, 0.12);
    if (pick === 0) {
      setP1(id);
      if (mode === 'world') { setCup(newCup(id, Math.random, true)); setRound(0); setReveal(0); setScreen('ladder'); return; }
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
  useEffect(() => { preloadKombatUi(); preloadPenaltyArt(); preloadBackdrops(STAGES.map(st => st.id)); const img = new Image(); img.src = spaceBg; }, []);
  useEffect(() => {
    setKfMusic(menuish);
    if (!menuish) return;
    const first = () => setKfMusic(true);
    window.addEventListener('pointerdown', first, { once: true }); window.addEventListener('keydown', first, { once: true });
    return () => { window.removeEventListener('pointerdown', first); window.removeEventListener('keydown', first); };
  }, [menuish]);
  useEffect(() => () => setKfMusic(false), []);

  // ---------------------------------------------------------------- La tanda
  useEffect(() => {
    if (screen !== 'playing') { setCrowd(0); return; }
    setCrowd(0.55);
    let slow = 1 / 60, checkT = 0, frame = 0, last = performance.now();
    const tick = (now: number) => {
      const m = matchRef.current; if (!m) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      slow = slow * 0.95 + dt * 0.05; checkT += dt;
      if (checkT > 1.5) {
        if (slow > 1 / 45 && quality.current < QUALITY.length - 1) { quality.current++; checkT = 0; }
        else if (slow < 1 / 57 && quality.current > 0 && checkT > 6) { quality.current--; checkT = 0; }
      }
      stepPenalties(m, dt, side => kickerBody(m.chars[side]), side => keeperBody(m, m.chars[side]));
      if (m.phase !== 'intro') setIntro(false);
      const k = m.kick;
      for (const e of takePenEvents(m)) {
        switch (e.type) {
          case 'whistle': playRefWhistle('penalty'); setupTurn(m); break;
          case 'kick': playPenKick(); break;
          case 'goal': {
            playPenNet(); playKfGoal(); setCrowd(1); setTimeout(() => { if (screenRef.current === 'playing') setCrowd(0.55); }, 1800);
            break;
          }
          case 'save': playPenSave(); break;
          case 'boom': playPenExplosion(); break;
          case 'end': playRefWhistle('end'); break;
          case 'post': break;
        }
      }
      paint();
      setHud(prev => {
        const next: Hud = { kicks: [[...m.kicks[0]], [...m.kicks[1]]], turn: m.turn, sudden: suddenDeath(m.kicks) && !(k && !k.hit) };
        return prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
      if (m.phase === 'end' && m.phaseT > 2.4 && m.winner !== null) {
        const md = modeRef.current, win = m.winner === 0, sc = scoreOf(m.kicks), rec = readPenRecord();
        let champion = false;
        if (md !== 'two') {
          if (win) rec.wins++; else rec.losses++;
          if (md === 'world' && win) setCup(c => finishRound(c, round, sc, Math.random, penaltyScore));
          if (md === 'world' && win && round + 1 >= ROUNDS.length) { rec.cups++; champion = true; setReveal(4); }
          saveRecord(rec); setRecord(rec);
        }
        setResult({ winner: m.winner, score: sc });
        if (win || md === 'two') playWinFanfare(); else playGameOver();
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
  }, [screen, paint, shout, round, setupTurn]);
  useEffect(() => () => setCrowd(0), []);

  // Teclado de la tanda: flechas para marcar el lugar y ENTER para elegir (o Q W E / A S D directo).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const s = screenRef.current;
      if ((e.code === 'Escape' || e.code === 'KeyP') && (s === 'playing' || s === 'paused')) { setScreen(s === 'playing' ? 'paused' : 'playing'); return; }
      if (s !== 'playing' || !aimRef.current) return;
      const z = ZONE_KEYS[e.code];
      if (z !== undefined) { e.preventDefault(); choose(z); return; }
      if (e.repeat) return;
      if (e.code === 'ArrowLeft') { e.preventDefault(); arrowSide('left'); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); arrowSide('right'); }
      else if (e.code === 'ArrowUp') { e.preventDefault(); if (tap.current) { clearTimeout(tap.current.timer); tap.current = null; } choose(1); }
      else if (e.code === 'ArrowDown') { e.preventDefault(); if (tap.current) { clearTimeout(tap.current.timer); tap.current = null; } choose(4); }
      else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') { e.preventDefault(); if (zoneRef.current !== null) choose(zoneRef.current); }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [choose, arrowSide]);
  useEffect(() => { const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prev; }; }, []);
  // Tocando o haciendo clic en el arco.
  const zoneFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget, r = c.getBoundingClientRect(); if (!r.width) return null;
    return zoneAt(penView(r.width, r.height), e.clientX - r.left, e.clientY - r.top);
  };

  const two = mode === 'two';
  const chars: [CharId, CharId] = screen === 'playing' || screen === 'paused' || screen === 'result' || screen === 'champion' ? fighting : [p1, mode === 'world' ? rivalOf(cup, round) : p2];
  const curStage: StageId = mode === 'world' ? cup.stages[round] : stage;
  const label = (i: 0 | 1) => two ? `JUGADOR ${i + 1}` : i === 0 ? 'VOS' : 'CPU';
  // los círculos: de a 5; si empatan los 5, se vacían para los penales siguientes (y otra vez cada 5)
  const block = hud ? Math.floor(Math.floor(hud.turn / 2) / REGULATION) * REGULATION : 0, shownKicks = (i: 0 | 1) => hud ? hud.kicks[i].slice(block, block + REGULATION) : [];
  const shooterNow: 0 | 1 = hud ? shooterOf(hud.turn) : 0;
  // Un lado del marcador: el cuadrado con el personaje, el nombre (con ⚽ si patea o 🧤 si ataja) y abajo sus penales.
  const boardName = (i: 0 | 1) => <div className={`kp-board-side kp-board-side--${i}${aim && aim.side === i && screen === 'playing' ? ' kp-board-side--now' : ''}`} data-testid={`kp-side-${i}`}>
    <span className="kp-board-face" style={{ ['--kf-c' as string]: CHARS[chars[i]].color }}><Portrait char={chars[i]} size={40} mirror={i === 1} square /></span>
    <b>{CHARS[chars[i]].name}</b>
    <i className="kp-board-role" aria-label={shooterNow === i ? 'patea' : 'ataja'}>{shooterNow === i ? '⚽' : '🧤'}</i>
  </div>;
  const howto = () => <div className="kf-howto-card" style={{ ['--kf-c' as string]: CHARS[chars[0]].color }}>
    <div className="kf-howto-head"><Portrait char={chars[0]} size={56} square /><div><b>{CHARS[chars[0]].name}</b><small>{two ? 'Jugador 1 · patea primero' : 'Vos · pateás primero'}</small></div></div>
    <ul>
      <li>Hay <b>6 lugares</b>: tres arriba y tres abajo (a la <b>derecha del arquero</b>, <b>al medio</b> y a la <b>izquierda del arquero</b>).</li>
      <li>Con las flechas: <Keys keys={['←', '←']} /> arriba a la izquierda · <Keys keys={['→', '→']} /> arriba a la derecha · <Keys keys={['←']} /> abajo a la izquierda · <Keys keys={['→']} /> abajo a la derecha · <Keys keys={['↑']} /> al medio arriba · <Keys keys={['↓']} /> al medio abajo. También tocando el lugar en el arco.</li>
      <li>La pelota cambia de efecto en cada ronda: fuego, electricidad, viento, radiación y láser rojo (y vuelve a empezar).</li>
      {two
        ? <li><b>Dos jugadores:</b> en cada penal elige <b>primero el arquero</b> (que el otro no mire) y <b>después el que patea</b>.</li>
        : <li>Cuando pateás, <b>la máquina ya eligió dónde tirarse</b>. Cuando ataja, elegís vos dónde te tirás.</li>}
      <li>Si el arquero se tira al mismo lugar, <b>ataja</b> (y el que pateó <b>explota</b>). Si adivina el lado pero no la altura, a veces llega con la punta de los dedos. Si se tira para el otro lado y es gol, <b>explota el arquero</b>.</li>
    </ul>
  </div>;

  const playing = screen === 'playing' || screen === 'paused';
  const selecting = screen === 'select';
  const shown = selecting ? CHAR_IDS[cursor] : p1;
  const cell = narrow ? Math.max(56, Math.min(99, Math.floor((vp.w - 40) / 4))) : Math.max(70, Math.min(156, Math.floor((vp.h - 230) / 4)));
  const cardH = narrow ? 225 : Math.round(Math.min(375, cell * 4 * 0.98, Math.max(150, vp.h - 360))), cardW = Math.round(cardH * 0.76);
  const pickTitle = (n: 0 | 1) => two ? `JUGADOR ${n + 1}` : n === 0 ? 'VOS' : 'CPU';
  const aimTitle = aim ? (two
    ? `${label(aim.side)} · ${CHARS[chars[aim.side]].name}: ${aim.role === 'keeper' ? '🧤 elegí dónde te tirás (que no mire el otro)' : '⚽ elegí dónde patear'}`
    : aim.role === 'shooter' ? '⚽ Elegí dónde patear' : '🧤 Sos el arquero: elegí dónde te tirás') : '';
  const aimSub = aim ? (two ? (aim.role === 'keeper' ? 'Primero elige el arquero, después el que patea' : 'El arquero ya eligió 🤫') : aim.role === 'shooter' ? 'La máquina ya eligió dónde se tira 🤫' : `${CHARS[chars[1]].name} ya eligió dónde patea 🤫`) : '';
  const winnerName = result ? CHARS[chars[result.winner]].name : '';
  return <section className="runner kf kv kp" style={fit} aria-label="Kombat Penales" onClickCapture={e => { if ((e.target as Element).closest('button, a')) playKfButton(); }}>
    <div className="runner-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1>Kombat Penales</h1>
      <div className="runner-scores">
        {mode === 'world' && playing && <span>Mundial <strong data-testid="kp-round">{ROUNDS[round]}</strong></span>}
        {record.wins + record.losses > 0 && <span>Récord <strong>{record.wins}G {record.losses}P{record.cups ? ` · 🏆 ${record.cups}` : ''}</strong></span>}
      </div>
      {playing && <button type="button" onClick={() => setScreen(s => s === 'playing' ? 'paused' : 'playing')}>{screen === 'playing' ? 'Pausa' : 'Seguir'}</button>}
    </div>
    <div className="runner-stage kf-stage" ref={stageRef}>
      <canvas ref={bgRef} className="kf-bg" aria-hidden="true" />
      <canvas ref={canvasRef} role="img" aria-label="Arco de Kombat Penales"
        onPointerMove={e => { if (!aimRef.current) return; const z = zoneFromEvent(e); if (z !== null && z !== zoneRef.current) { zoneRef.current = z; setZoneCursor(z); } }}
        onPointerDown={e => { if (!aimRef.current) return; const z = zoneFromEvent(e); if (z !== null) { zoneRef.current = z; setZoneCursor(z); choose(z); } }} />
      {playing && hud && <div className="kp-board" aria-live="polite">
        <div className="kp-board-top">
          {boardName(0)}
          <div className="kp-board-score" data-testid="kp-score">{scoreOf(hud.kicks)[0]} : {scoreOf(hud.kicks)[1]}</div>
          {boardName(1)}
        </div>
        <div className="kp-board-dots">
          <KickDots kicks={shownKicks(0)} total={REGULATION} testId="kp-dots-0" />
          <span className={`kp-fx kp-fx--${fxOfTurn(hud.turn)}`} data-testid="kp-fx">{hud.sudden ? 'MUERTE SÚBITA · ' : ''}{BALL_FX_NAMES[fxOfTurn(hud.turn)]}</span>
          <KickDots kicks={shownKicks(1)} total={REGULATION} testId="kp-dots-1" />
        </div>
      </div>}
      {playing && aim && <p className="sr-only" data-testid="kp-aim-title">{aimTitle} · {aimSub}</p>}
      {playing && intro && <div className="kf-vs" aria-hidden="true">
        <div className="kf-vs-side" style={{ ['--kf-c' as string]: CHARS[chars[0]].color }}><FighterCard char={chars[0]} w={150} h={190} /><b>{CHARS[chars[0]].name}</b></div>
        <div className="kf-vs-mid"><strong>VS</strong><small>{stageName}</small></div>
        <div className="kf-vs-side" style={{ ['--kf-c' as string]: CHARS[chars[1]].color }}><FighterCard char={chars[1]} w={150} h={190} mirror /><b>{CHARS[chars[1]].name}</b></div>
      </div>}
      {playing && <p className="kf-rotate">📱 Girá el celular para ver el arco más grande</p>}
      <div className="kf-shouts" aria-live="assertive">
        {shouts.map(s => <div key={s.id} className={`kf-shout kf-shout--${s.kind}`} role="status">{s.text}{s.sub && <small>{s.sub}</small>}</div>)}
      </div>
      {(screen === 'ladder' || screen === 'champion') && <div className="kf-select kv-world" role="dialog" aria-labelledby="kf-title">
        {screen === 'champion' && <Fireworks />}
        <h2 id="kf-title" className={screen === 'champion' ? 'end-banner end-banner--win' : undefined}>{screen === 'champion' ? '🏆 ¡CAMPEÓN DEL MUNDO!' : 'MUNDIAL DE KOMBAT PENALES'}</h2>
        <WorldBracket cup={cup} round={round} reveal={reveal} width={Math.max(300, Math.min(1180, vp.w - 24))} height={Math.max(250, Math.min(620, vp.h - (narrow ? 200 : 215)))} />
        {screen === 'ladder'
          ? <p className="kf-zone" data-testid="kp-ladder-next"><b>{ROUNDS[round]}</b> · <b>{CHARS[p1].name}</b> vs <b>{CHARS[rivalOf(cup, round)].name}</b> · {STAGES.find(s => s.id === cup.stages[round])!.name}</p>
          : <p className="kf-zone">Ganaste octavos, cuartos, semifinal y la final con <b>{CHARS[cup.you].name}</b>.</p>}
        <div className="kf-actions">
          {screen === 'ladder'
            ? <><button type="button" className="kf-secondary" onClick={() => setScreen(round === 0 ? 'select' : 'menu')}>{round === 0 ? '‹ Volver' : 'Abandonar'}</button>
              <button type="button" onClick={() => setScreen('howto')} autoFocus>¡A patear! ▶</button></>
            : <button type="button" onClick={() => { setRound(0); setReveal(0); setScreen('menu'); }} autoFocus>VOLVER A JUGAR</button>}
        </div>
      </div>}
      {screen === 'vs' && <div className="kf-select kf-versus" role="dialog" aria-labelledby="kf-title" style={{ backgroundImage: `linear-gradient(90deg, ${CHARS[p1].color}38, #0000 38%, #0000 62%, ${CHARS[p2].color}38), radial-gradient(ellipse at 50% 50%, #0000 30%, #000000c0 100%), url(${spaceBg})`, backgroundSize: 'auto, auto, cover', backgroundPosition: 'center', backgroundColor: '#03020c' }}>
        <h2 id="kf-title" className="sr-only">{CHARS[p1].name} contra {CHARS[p2].name}</h2>
        <div className="kf-versus-row">
          {([0, 1] as const).map(side => { const id = side === 0 ? p1 : p2, h = narrow ? Math.min(250, vp.h * 0.36, (vp.w - 50) / 2 / 0.76) : Math.min(560, vp.h * 0.62); return <div key={side} className={`kf-versus-side kf-versus-side--${side + 1}`} style={{ ['--kf-c' as string]: CHARS[id].color }}>
            <small>{pickTitle(side)}</small>
            <FighterCard char={id} w={Math.round(h * 0.76)} h={Math.round(h)} mirror={side === 1} />
            <b data-testid={`kp-vs-${side + 1}`}>{CHARS[id].name}</b>
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
        <h2 id="kf-title">{two ? `JUGADOR ${pick + 1}: ELEGÍ TU LUCHADOR` : pick === 0 ? 'ELEGÍ TU JUGADOR' : 'ELEGÍ AL RIVAL'}</h2>
        <div className="kf-select-row">
          <div className={`kf-pick kf-pick--1${pick === 0 ? ' kf-pick--active' : ''}`} style={{ ['--kf-c' as string]: CHARS[pick === 0 ? shown : p1].color }}>
            <FighterCard char={pick === 0 ? shown : p1} w={cardW} h={cardH} />
            <b data-testid="kp-pick-1">{CHARS[pick === 0 ? shown : p1].name}</b>
            <small>{pickTitle(0)}</small>
            <StatBars char={pick === 0 ? shown : p1} />
          </div>
          <div className="kf-grid" role="group" aria-label={pick === 0 ? 'Tu jugador' : 'Rival'} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {CHAR_IDS.map((id, i) => {
              const sel1 = pick === 0 ? cursor === i : id === p1, sel2 = pick === 1 && cursor === i;
              return <button key={id} type="button" className={`kf-cell${sel1 ? ' kf-cell--1' : ''}${sel2 ? ' kf-cell--2' : ''}`} aria-label={CHARS[id].name} aria-pressed={cursor === i}
                onClick={() => { if (cursor === i) chooseChar(i); else { setCursor(i); playKfName(id); if (pick === 0) setP1(id); else setP2(id); } }}
                onDoubleClick={() => chooseChar(i)}>
                <Portrait char={id} size={cell} square />
                {sel1 && <i className="kf-tag kf-tag--1">1</i>}{sel2 && <i className="kf-tag kf-tag--2">{two ? '2' : 'CPU'}</i>}
              </button>;
            })}
          </div>
          <div className={`kf-pick kf-pick--2${pick === 1 ? ' kf-pick--active' : ''}`} style={{ ['--kf-c' as string]: CHARS[pick === 1 ? CHAR_IDS[cursor] : p2].color }}>
            {pick === 1 ? <FighterCard char={CHAR_IDS[cursor]} w={cardW} h={cardH} mirror /> : <div className="kf-pick-empty" style={{ width: cardW, height: cardH }}>?</div>}
            <b data-testid="kp-pick-2">{pick === 1 ? CHARS[CHAR_IDS[cursor]].name : '—'}</b>
            <small>{pickTitle(1)}</small>
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
      {screen !== 'playing' && !selecting && screen !== 'vs' && screen !== 'ladder' && screen !== 'champion' && <div className={`runner-overlay kf-overlay${screen === 'menu' ? ' kf-menu-wall' : ''}`} role="dialog" aria-labelledby="kf-title" style={screen === 'menu' ? { backgroundImage: `radial-gradient(ellipse at 50% 45%, #0000 40%, #000000b3 100%), url(${menuBg})`, backgroundSize: 'auto, cover', backgroundPosition: 'center', backgroundColor: '#1a0503' } : undefined}>
        <div>
          {screen === 'menu' && <>
            <h2 id="kf-title" className="kf-logo">KOMBAT<br /><span>PENALES</span></h2>
            <img className="kp-menu-ball" src={menuBall} alt="" aria-hidden="true" width={86} height={86} />
            <p>Tanda de penales con los luchadores de Kombat Football: 5 penales cada uno y, si empatan, uno cada uno hasta que alguno erre. Seis lugares para patear o tirarse… y si el arquero ataja, el que pateó explota.</p>
            <div className="kf-modes">
              <button type="button" onClick={() => { playKfSelectVoice(); setMode('cpu'); setPick(0); setCursor(CHAR_IDS.indexOf(p1)); setScreen('select'); }} autoFocus>Amistoso</button>
              <button type="button" onClick={() => { playKfSelectVoice(); setMode('world'); setRound(0); setReveal(0); setPick(0); setCursor(CHAR_IDS.indexOf(p1)); setScreen('select'); }}>Mundial</button>
              <button type="button" onClick={() => { playKfSelectVoice(); setMode('two'); setPick(0); setCursor(CHAR_IDS.indexOf(p1)); setScreen('select'); }}>2 Jugadores</button>
            </div>
          </>}
          {screen === 'stage' && <>
            <h2 id="kf-title" className="kf-title-mk">ELEGÍ EL ESTADIO</h2>
            <div className="kf-stagegrid" role="group" aria-label="Estadio">
              {STAGES.map(s => <button key={s.id} type="button" className={stage === s.id ? 'kf-chosen' : ''} aria-pressed={stage === s.id} onClick={() => { if (stage === s.id) setScreen('howto'); else setStage(s.id); }}>
                <StageThumb stage={s.id} w={180} h={84} /><b>{s.name}</b>
              </button>)}
            </div>
            {!two && <div className="kf-diff" role="group" aria-label="Dificultad">{DIFFICULTY.map((d, i) => <button key={d.name} type="button" className={difficulty === i ? 'kf-chosen' : ''} aria-pressed={difficulty === i} onClick={() => setDifficulty(i)}>{d.name}</button>)}</div>}
            <div className="kf-actions">
              <button type="button" className="kf-secondary" onClick={() => setScreen('vs')}>‹ Volver</button>
              <button type="button" onClick={() => setScreen('howto')}>Siguiente ▶</button>
            </div>
          </>}
          {screen === 'howto' && <>
            <h2 id="kf-title" className="kf-title-mk">CONTROLES</h2>
            <p className="kf-note">{CHARS[chars[0]].name} vs {CHARS[chars[1]].name} · {STAGES.find(s => s.id === curStage)!.name}</p>
            <div className="kf-howto">{howto()}</div>
            <p className="kf-note">Patean 5 penales cada uno, alternando. Si quedan empatados, se patea uno cada uno hasta que alguno erre.</p>
            <div className="kf-actions">
              <button type="button" className="kf-secondary" onClick={() => setScreen(mode === 'world' ? 'ladder' : 'stage')}>‹ Volver</button>
              <button type="button" onClick={() => begin(mode === 'world' ? round : 0)} autoFocus>¡A patear!</button>
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
            {two ? <h2 id="kf-title" className="end-banner end-banner--win">¡GANÓ {winnerName}!</h2> : <EndBanner win={result.winner === 0} id="kf-title" />}
            <p className="kf-final" data-testid="kp-final">{CHARS[chars[0]].name} <b>{result.score[0]} - {result.score[1]}</b> {CHARS[chars[1]].name}</p>
            {two && <p>Ganó el <b>jugador {result.winner + 1}</b> en los penales.</p>}
            {mode === 'world' && <p>{result.winner === 0 ? `¡Ganaste ${ROUNDS[round].toLowerCase()}! Pasás a ${ROUNDS[round + 1].toLowerCase()}.` : `Quedaste afuera en ${ROUNDS[round].toLowerCase()}.`}</p>}
            <div className="kf-actions">
              <button type="button" className="kf-secondary" onClick={() => setScreen('menu')}>Menú</button>
              {mode === 'world'
                ? result.winner === 0 && <button type="button" onClick={() => { const n = round + 1; setReveal(n); setRound(n); setScreen('ladder'); }} autoFocus>Ver el cuadro ▶</button>
                : <button type="button" onClick={() => begin(round)} autoFocus>Revancha</button>}
            </div>
          </>}
        </div>
      </div>}
    </div>
  </section>;
}
