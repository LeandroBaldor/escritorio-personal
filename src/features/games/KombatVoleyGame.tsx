import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TouchGrips } from './TouchGrips';
import { GamePad } from './GamePad';
import { fitViewport, pixelRatio, useFitScreen } from './fitScreen';
import { Link } from 'react-router-dom';
import { CHARS, CHAR_IDS, STAGES, STATS, type CharId, type StageId } from './kombat';
import { BALLS, SET_POINTS, STAGE_BALL, newVoley, noVInput, stepVoley, takeVoleyEvents, touchesOf, type VInput, type VMatch } from './kombatVoley';
import { drawVoley, drawVoleyBackdrop, drawVoleyThumb, noteNetHit } from './kombatVoleyArt';
import { CUP_ROUNDS, MAX_CUP_PLAYERS, advanceCup, cupSlot, isHuman, newCup, nextHumanMatch, playerNo, setMatchScore, type Cup } from './kombatVoleyCup';
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
// El mundial: un cuadro de 16 (octavos, cuartos, semifinal y final); ver kombatVoleyCup.ts.
const ROUNDS = CUP_ROUNDS;
const roundLevel = (n: number) => 0.4 + n * 0.15;
// El partido de personas que toca en el mundial (y los dos luchadores, la persona a la izquierda).
const cupChars = (cup: Cup, n: number): [CharId, CharId] => nextHumanMatch(cup, n)?.chars ?? [cup.humans[0], CHAR_IDS.find(c => !isHuman(cup, c))!];

// Teclas: flechas (o WASD) para moverse, ↑ (o ESPACIO) para saltar, V para golpear y X para levantar.
type Key = keyof VInput;
const KEYS: Record<string, Key> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', Space: 'up', KeyV: 'hit', KeyX: 'set', KeyK: 'set', KeyJ: 'hit' };
// Entre dos personas (en el mundial, desde cuartos): el de la izquierda con WASD (ESPACIO también salta), V y X; el de
// la derecha con las flechas, ENTER para golpear y SHIFT derecho para levantar (o 0 y . del teclado numérico).
const KEYS_PVP: [Record<string, Key>, Record<string, Key>] = [
  { KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', Space: 'up', KeyV: 'hit', KeyX: 'set' },
  { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Enter: 'hit', NumpadEnter: 'hit', Numpad0: 'hit', ShiftRight: 'set', NumpadDecimal: 'set' },
];
let pvpKeys = false; // (lo actualiza el partido)
const keySide = (code: string): [0 | 1, Key] | null => {
  if (!pvpKeys) return KEYS[code] ? [0, KEYS[code]] : null;
  if (KEYS_PVP[0][code]) return [0, KEYS_PVP[0][code]];
  return KEYS_PVP[1][code] ? [1, KEYS_PVP[1][code]] : null;
};

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
// El cuadro del mundial, como el de un mundial de verdad: los 8 de la izquierda y los 8 de la derecha, que se van
// juntando hacia la copa del centro. Cada partido jugado muestra los puntos; el camino del jugador va en dorado.
// reveal = la fase que se acaba de completar (se dibujan sus líneas y aparecen los que pasaron).
const Trophy = ({ size }: { size: number }) => <svg className="kv-trophy" width={size} height={size * 1.25} viewBox="0 0 100 125" aria-hidden="true">
  <defs>
    <linearGradient id="kv-gold" x1="0" x2="1"><stop offset="0" stopColor="#7c4a03" /><stop offset=".3" stopColor="#fde68a" /><stop offset=".55" stopColor="#f59e0b" /><stop offset="1" stopColor="#78350f" /></linearGradient>
    <radialGradient id="kv-ballg" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#fff" /><stop offset=".7" stopColor="#e2e8f0" /><stop offset="1" stopColor="#64748b" /></radialGradient>
  </defs>
  <circle cx="50" cy="20" r="17" fill="url(#kv-ballg)" stroke="#1e293b" strokeWidth="1.5" />
  <path d="M50 20 C50 10 56 5 63 4 M50 20 C40 26 33 25 34 36 M50 20 C60 26 66 33 64 37" fill="none" stroke="#2563eb" strokeWidth="3" />
  <path d="M22 38 H78 C78 62 66 74 56 78 V90 H44 V78 C34 74 22 62 22 38 Z" fill="url(#kv-gold)" stroke="#451a03" strokeWidth="1.5" />
  <path d="M22 44 C8 44 8 62 26 64 M78 44 C92 44 92 62 74 64" fill="none" stroke="url(#kv-gold)" strokeWidth="5" />
  <path d="M30 98 H70 L74 112 H26 Z" fill="url(#kv-gold)" stroke="#451a03" strokeWidth="1.5" />
  <rect x="38" y="88" width="24" height="11" rx="2" fill="#92400e" />
  <rect x="20" y="111" width="60" height="10" rx="2" fill="#1c1917" stroke="#a16207" strokeWidth="1.5" />
  <text x="50" y="119" textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#fcd34d" fontFamily="system-ui">KOMBAT VOLEY</text>
  <path d="M34 44 C34 58 40 66 46 70" fill="none" stroke="#fff8" strokeWidth="3" strokeLinecap="round" />
</svg>;
function WorldBracket({ cup, round, reveal, width, height }: { cup: Cup; round: number; reveal: number; width: number; height: number }) {
  const W = width, H = height, col = W / 10, S = Math.round(Math.max(26, Math.min(col * 0.74, (H / 8) * 0.78))), top = 22, ph = H - top;
  const pos = (c: number, k: number) => {
    const half = (16 >> c) / 2, left = k < half, j = left ? k : k - half;
    return { x: left ? (c + 0.5) * col : W - (c + 0.5) * col, y: top + (j + 0.5) * ph / half, left };
  };
  const mine = nextHumanMatch(cup, round), champ = cup.champion;
  const lines: React.ReactNode[] = [], slots: React.ReactNode[] = [];
  for (let c = 0; c < 4; c++) for (let k = 0; k < (16 >> c); k++) {
    const p = pos(c, k), sl = cupSlot(cup, c, k), sgn = p.left ? 1 : -1, xin = p.x + sgn * S / 2;
    // la línea hasta el lugar de la fase siguiente (o hasta la copa, desde la final)
    const n = c < 3 ? pos(c + 1, Math.floor(k / 2)) : { x: W / 2, y: top + ph / 2 }, nS = c < 3 ? S : S * 1.3, xout = n.x - sgn * nS / 2, xm = (xin + xout) / 2;
    const you = !!sl && isHuman(cup, sl.char), fresh = c === reveal - 1 && sl?.won;
    const color = sl?.won ? (you ? '#fbbf24' : '#e2e8f0') : sl?.lost ? '#33415588' : '#64748b88';
    lines.push(<path key={`l${c}-${k}`} className={fresh ? 'kv-line-new' : undefined} d={`M${xin} ${p.y} H${xm} V${n.y} H${xout}`} fill="none" stroke={color} strokeWidth={sl?.won ? (you ? 4 : 3) : 2} strokeLinejoin="round" pathLength={1} />);
    const current = !!mine && c === round && !champ && Math.floor(k / 2) === mine.index;
    slots.push(<div key={`s${c}-${k}-${sl?.char ?? ''}`} data-testid={`kv-slot-${c}-${k}`} title={sl ? CHARS[sl.char].name : undefined}
      className={`kv-slot${sl ? '' : ' kv-slot--empty'}${you ? ' kv-slot--you' : ''}${sl?.lost ? ' kv-slot--out' : ''}${current ? ' kv-slot--now' : ''}${c === reveal && c > 0 ? ' kv-slot--new' : ''}`}
      style={{ left: p.x - S / 2, top: p.y - S / 2, width: S, height: S, ['--d' as string]: `${0.15 + (k % (8 >> c)) * 0.05}s` }}>
      {sl ? <Portrait char={sl.char} size={S - 6} mirror={!p.left} square /> : <span>?</span>}
      {c === 0 && sl && (you ? cup.humans.length > 1 && <i className="kv-seed kv-seed--you" style={{ [p.left ? 'right' : 'left']: S + 4 }}>J{playerNo(cup, sl.char)}</i> : <i className="kv-seed" style={{ [p.left ? 'right' : 'left']: S + 4 }}>{cup.seed[sl.char]}</i>)}
      {sl && sl.score !== null && <b className={`kv-score${sl.won ? ' kv-score--won' : ''}`} style={{ [p.left ? 'left' : 'right']: S + 3 }}>{sl.score}</b>}
    </div>);
  }
  const cS = Math.round(S * 1.3);
  return <div className="kv-bracket" data-testid="kv-bracket" style={{ width: W, height: H }}>
    {(['OCTAVOS', 'CUARTOS', 'SEMIS', 'FINAL'] as const).map((t, c) => <span key={t} className={`kv-col${c === round && !champ ? ' kv-col--now' : ''}`} style={{ left: (c + 0.5) * col, ['--w' as string]: `${col}px` }}>{t}</span>)}
    {(['OCTAVOS', 'CUARTOS', 'SEMIS', 'FINAL'] as const).map((t, c) => <span key={`r${t}`} className={`kv-col${c === round && !champ ? ' kv-col--now' : ''}`} style={{ left: W - (c + 0.5) * col, ['--w' as string]: `${col}px` }}>{t}</span>)}
    <svg className="kv-lines" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">{lines}</svg>
    {slots}
    <div className="kv-cup" style={{ left: W / 2, top: top + ph / 2 - cS / 2 - Math.min(ph * 0.42, col * 2.3) - 4 }}><Trophy size={Math.min(ph * 0.34, col * 1.85)} /></div>
    <div data-testid="kv-champion" className={`kv-slot kv-slot--champ${champ ? (isHuman(cup, champ) ? ' kv-slot--you' : '') : ' kv-slot--empty'}${reveal === 4 ? ' kv-slot--new' : ''}`} title={champ ? CHARS[champ].name : 'Campeón'}
      style={{ left: W / 2 - cS / 2, top: top + ph / 2 - cS / 2, width: cS, height: cS, ['--d' as string]: '0.4s' }}>
      {champ ? <Portrait char={champ} size={cS - 6} square /> : <span>🏆</span>}
    </div>
    <small className="kv-note" style={{ top: top + ph / 2 + cS / 2 + 8 }}>{champ ? `CAMPEÓN: ${CHARS[champ].name}` : 'Cruces sorteados al azar · el número es el ranking'}</small>
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

// Las personas elegidas para el mundial (a la derecha de la selección).
function CupPlayers({ players, w, h }: { players: CharId[]; w: number; h: number }) {
  return <div className="kf-pick kf-pick--2 kv-players" style={{ width: w, minHeight: h }} data-testid="kv-cup-players">
    <b>JUGADORES</b>
    {players.length ? <ol>{players.map((c, i) => <li key={c} style={{ ['--kf-c' as string]: CHARS[c].color }}><Portrait char={c} size={Math.min(56, Math.floor(h / 5))} square /><span><small>JUGADOR {i + 1}</small>{CHARS[c].name}</span></li>)}</ol>
      : <p>Elegí uno o más luchadores (hasta {MAX_CUP_PLAYERS}). Los demás los maneja la máquina.</p>}
    <small>{players.length > 1 ? 'No se cruzan en octavos' : 'Cruces sorteados al azar'}</small>
  </div>;
}
export function KombatVoley() {
  const fit = useFitScreen();
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const bgKey = useRef('');
  const matchRef = useRef<VMatch | null>(null);
  const inputs = useRef<[VInput, VInput]>([noVInput(), noVInput()]);
  const latch = useRef<[Partial<VInput>, Partial<VInput>]>([{}, {}]);
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
  const [players, setPlayers] = useState<CharId[]>([]); // las personas del mundial (en orden: jugador 1, 2…)
  const [cupOut, setCupOut] = useState(false); // ya no queda ninguna persona en el mundial
  const cupMatch = useRef<{ index: number; flipped: boolean } | null>(null);
  const pendingScore = useRef<[number, number] | null>(null); // el resultado del último partido del mundial (se anota con "Ver el cuadro")
  const [pvp, setPvp] = useState(false); // el partido es entre dos personas
  const pvpRef = useRef(false);
  const [hud, setHud] = useState<Hud | null>(null);
  const [shouts, setShouts] = useState<Shout[]>([]);
  const [record, setRecord] = useState(readVoleyRecord);
  const [result, setResult] = useState<{ winner: 0 | 1; score: [number, number] } | null>(null);
  const [fighting, setFighting] = useState<[CharId, CharId]>(['cometa', 'inferno']);
  const [stageName, setStageName] = useState('');
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && fitViewport().w < 700);
  const [vp, setVp] = useState(() => typeof window !== 'undefined' ? fitViewport() : { w: 1280, h: 720 });
  const screenRef = useRef(screen); useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __kvMatch?: () => VMatch | null }).__kvMatch = () => matchRef.current; }, []); // (para probar en desarrollo)
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
    const st = mode === 'world' ? cup.stages[n] : stage, cm = mode === 'world' ? nextHumanMatch(cup, n) : null;
    const pair: [CharId, CharId] = cm ? cm.chars : [p1, p2], both = !!cm?.humans[1];
    cupMatch.current = cm ? { index: cm.index, flipped: cm.flipped } : null; pendingScore.current = null;
    pvpRef.current = both; pvpKeys = both; setPvp(both); latch.current = [{}, {}];
    const level = mode === 'world' ? roundLevel(n) : DIFFICULTY[difficulty].level;
    const m = newVoley(st, pair, [null, both ? null : level]);
    matchRef.current = m; setFighting(pair);
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
      if (mode === 'world') { setPlayers(list => list.includes(id) ? list.filter(c => c !== id) : list.length < MAX_CUP_PLAYERS ? [...list, id] : list); return; } // (se agrega o se saca)
      setPick(1); const other = CHAR_IDS.indexOf(p2 === id ? CHAR_IDS[(idx + 1) % 16] : p2); setCursor(other); if (p2 === id) setP2(CHAR_IDS[other]);
    } else { setP2(id); setScreen('vs'); playKfVsSentence(p1, id); }
  }, [pick, mode, p1, p2]);
  // Arranca el mundial con las personas elegidas (si no eligió a nadie, con el luchador marcado).
  const startCup = useCallback(() => {
    const list = players.length ? players : [CHAR_IDS[cursor]];
    setPlayers(list); setCup(newCup(list)); setRound(0); setReveal(0); setCupOut(false); setScreen('ladder');
  }, [players, cursor]);
  const cols = 4;
  useEffect(() => {
    if (screen !== 'select' && screen !== 'vs' && screen !== 'stage' && screen !== 'howto' && screen !== 'ladder') return;
    const down = (e: KeyboardEvent) => {
      const k = e.code;
      if (screen === 'vs') { if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') { e.preventDefault(); playKfButton(); setScreen('stage'); } else if (k === 'Escape' || k === 'Backspace') { setPick(1); setCursor(CHAR_IDS.indexOf(p2)); setScreen('select'); } return; }
      if (screen === 'ladder') { if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') { e.preventDefault(); playKfButton(); setScreen(cupOut ? 'menu' : 'howto'); } else if ((k === 'Escape' || k === 'Backspace') && round === 0 && !cupOut) setScreen('select'); return; }
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
  }, [screen, cursor, cols, narrow, stage, pick, p1, p2, mode, round, begin, chooseChar, cupOut]);

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
        const in1 = pvpRef.current ? (n === 0 ? { ...inputs.current[1], ...latch.current[1] } : inputs.current[1]) : noVInput();
        stepVoley(m, [n === 0 ? { ...inputs.current[0], ...latch.current[0] } : inputs.current[0], in1], 1 / 60);
        if (n === 0) latch.current = [{}, {}];
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
        const win = m.winner === 0, both = pvpRef.current, rec = readVoleyRecord();
        if (!both) { if (win) rec.wins++; else rec.losses++; saveRecord(rec); setRecord(rec); }
        const cm = cupMatch.current; // en el mundial, el resultado se anota al pasar al cuadro (así se puede reintentar)
        if (mode === 'world' && cm) pendingScore.current = cm.flipped ? [m.score[1], m.score[0]] : [m.score[0], m.score[1]];
        setResult({ winner: m.winner, score: [m.score[0], m.score[1]] });
        if (win || both) playWinFanfare(); else playGameOver();
        setScreen('result');
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
      if (s !== 'playing') return;
      const side = keySide(e.code); if (!side) return;
      const [i, k] = side;
      e.preventDefault(); inputs.current[i][k] = true; latch.current[i][k] = true;
    };
    const up = (e: KeyboardEvent) => { const side = keySide(e.code); if (side) inputs.current[side[0]][side[1]] = false; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);
  useEffect(() => { const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prev; }; }, []);

  const hold = (key: Key) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); inputs.current[0][key] = true; latch.current[0][key] = true; },
    onPointerUp: () => { inputs.current[0][key] = false; },
    onPointerLeave: () => { inputs.current[0][key] = false; },
    onPointerCancel: () => { inputs.current[0][key] = false; },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const inMatch = screen === 'playing' || screen === 'paused' || screen === 'result' || screen === 'champion';
  const chars: [CharId, CharId] = inMatch ? fighting : mode === 'world' ? cupChars(cup, round) : [p1, p2];
  const world = mode === 'world', two = inMatch ? pvp : world && !!nextHumanMatch(cup, round)?.humans[1];
  // en el mundial con varias personas, cada una es "JUGADOR n" (su número en el mundial)
  const many = world && cup.humans.length > 1;
  const who = (c: CharId) => many && isHuman(cup, c) ? `JUGADOR ${playerNo(cup, c)}` : '';
  const label = (i: 0 | 1) => who(chars[i]) || (two ? `JUGADOR ${i + 1}` : i === 0 ? 'VOS' : 'CPU');
  const cupName = (c: CharId) => isHuman(cup, c) ? (many ? `${who(c)} · ${CHARS[c].name}` : CHARS[c].name) : `${CHARS[c].name} (CPU)`;
  const cupFresh = round === 0 && cup.rounds[0].every(m => m.sa === null); // todavía no se jugó ningún partido
  const worldLine = result ? (() => {
    const w = chars[result.winner], l = chars[1 - result.winner], next = round + 1 < ROUNDS.length ? ROUNDS[round + 1].toLowerCase() : null;
    if (two) return `${label(result.winner)} ${next ? `pasa a ${next}` : 'gana la final'}; ${label(result.winner === 0 ? 1 : 0)} queda afuera.`;
    if (result.winner === 0) return `${many ? `${who(w)} ganó` : '¡Ganaste'} ${ROUNDS[round].toLowerCase()}${many ? '' : '!'}${next ? ` ${many ? 'Pasa' : 'Pasás'} a ${next}.` : ''}`;
    return `${many ? `${who(l)} quedó afuera` : 'Quedaste afuera'} en ${ROUNDS[round].toLowerCase()}.`;
  })() : '';
  // después de un partido del mundial: se anota el resultado y sigue el próximo de la fase, o se cierra la fase (o termina)
  const continueCup = () => {
    const cm = cupMatch.current, sc = pendingScore.current;
    const a = advanceCup(cm && sc ? setMatchScore(cup, round, cm.index, sc) : cup, round);
    pendingScore.current = null;
    setCup(a.cup); setRound(a.round); setReveal(a.reveal); setCupOut(a.done === 'out');
    if (a.done === 'champion') { const rec = readVoleyRecord(); rec.cups++; saveRecord(rec); setRecord(rec); playWinFanfare(); }
    setScreen(a.done === 'champion' ? 'champion' : 'ladder');
  };
  const curStage: StageId = mode === 'world' ? cup.stages[round] : stage;
  const sideBar = (i: 0 | 1) => {
    const c = CHARS[chars[i]], serving = hud?.server === i, touches = hud ? hud.touches[i] : 0;
    return <div className={`kf-side kf-side--${i}`} data-testid={`kf-side-${i}`}>
      <Portrait char={chars[i]} size={64} mirror={i === 1} square />
      <div className="kf-bars">
        <div className="kf-energy" aria-label={c.name}><i style={{ width: '100%', background: `linear-gradient(180deg, ${c.color}, ${c.color}aa 60%, ${c.color}77)` }} /><b>{c.name}{label(i) === 'VOS' ? '' : ` · ${label(i)}`}</b></div>
        <div className="kf-sub">
          {serving && <em className="kf-pw">🏐 SAQUE</em>}
          <span className="kv-touches" aria-label={`${touches} toques`}>{[1, 2, 3].map(n => <i key={n} className={n <= touches ? 'on' : ''} />)}</span>
        </div>
      </div>
    </div>;
  };
  // Los controles. Entre dos personas: una tarjeta para cada una (izquierda con WASD, derecha con las flechas).
  const howtoCard = (i: 0 | 1) => {
    const c = CHARS[chars[i]], k = two ? (i === 0 ? { move: ['A', 'D'], jump: ['W'], jump2: 'ESPACIO', set: 'X', hit: 'V' } : { move: ['←', '→'], jump: ['↑'], jump2: '', set: 'SHIFT der.', hit: 'ENTER' }) : { move: ['←', '→'], jump: ['↑'], jump2: 'ESPACIO', set: 'X', hit: 'V' };
    return <div key={i} className="kf-howto-card" style={{ ['--kf-c' as string]: c.color }}>
      <div className="kf-howto-head"><Portrait char={chars[i]} size={56} square mirror={i === 1} /><div><b>{c.name}</b><small>{two ? `${label(i)} · lado ${i === 0 ? 'izquierdo' : 'derecho'}` : 'Vos · lado izquierdo'}</small></div></div>
      <ul>
        <li><Keys keys={k.move} /> moverte · <Keys keys={k.jump} />{k.jump2 && <> o <Keys keys={[k.jump2]} /></>} <b>saltar</b></li>
        {!two && <li>Si la pelota te toca sin apretar nada, <b>la recibís</b>: sube en tu cancha (en el tercer toque pasa sola al otro lado).</li>}
        <li><Keys keys={[k.set]} /> <b>levantar</b>: la pelota sube alto cerca de la red, para rematarla.</li>
        <li><Keys keys={[k.hit]} /> <b>golpear</b>: la pasás al otro lado. <b>Más tiempo apretada = más largo</b>.{!two && <> (toquecito: junto a la red). Con → más fuerte, con ← globo.</>} <b>Saltando junto a la red: REMATE</b>.</li>
        <li><Keys keys={[k.hit]} /> <b>saque</b>: mantenela para cargarlo y soltala.</li>
      </ul>
    </div>;
  };
  const howto = () => two ? <>{howtoCard(0)}{howtoCard(1)}</> : howtoCard(0);

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
      {playing && hud?.serving && (hud.server === 0 || two) && <p className="kv-serve-hint">{two ? `Saca ${label(hud.server)}` : 'Tu saque'}: mantené <Keys keys={[two && hud.server === 1 ? 'ENTER' : 'V']} /> (más tiempo = más al fondo) y soltá</p>}
      {playing && <p className="kf-rotate">📱 Girá el celular para ver la cancha más grande</p>}
      <div className="kf-shouts" aria-live="assertive">
        {shouts.map(s => <div key={s.id} className={`kf-shout kf-shout--${s.kind}`} role="status">{s.text}{s.sub && <small>{s.sub}</small>}</div>)}
      </div>
      {(screen === 'ladder' || screen === 'champion') && <div className="kf-select kv-world" role="dialog" aria-labelledby="kf-title">
        {screen === 'champion' && <Fireworks />}
        <h2 id="kf-title" className={screen === 'champion' ? 'end-banner end-banner--win' : undefined}>{screen === 'champion' ? '🏆 ¡CAMPEÓN DEL MUNDO!' : 'MUNDIAL DE KOMBAT VOLEY'}</h2>
        <WorldBracket cup={cup} round={round} reveal={reveal} width={Math.max(300, Math.min(1180, vp.w - 24))} height={Math.max(250, Math.min(620, vp.h - (narrow ? 200 : 215)))} />
        {screen === 'champion' && cup.champion
          ? <p className="kf-zone">{many ? <>¡<b>{who(cup.champion)} · {CHARS[cup.champion].name}</b> ganó el mundial!</> : <>Ganaste octavos, cuartos, semifinal y la final con <b>{CHARS[cup.champion].name}</b>.</>}</p>
          : cupOut ? <p className="kf-zone" data-testid="kv-ladder-next">{many ? 'Quedaron todos afuera' : 'Quedaste afuera'}. Campeón: <b>{cup.champion ? CHARS[cup.champion].name : ''}</b></p>
          : <p className="kf-zone" data-testid="kv-ladder-next"><b>{ROUNDS[round]}</b> · <b>{cupName(chars[0])}</b> vs <b>{cupName(chars[1])}</b> · {STAGES.find(s => s.id === cup.stages[round])!.name}</p>}
        <div className="kf-actions">
          {screen === 'ladder' && !cupOut
            ? <><button type="button" className="kf-secondary" onClick={() => setScreen(cupFresh ? 'select' : 'menu')}>{cupFresh ? '‹ Volver' : 'Abandonar'}</button>
              <button type="button" onClick={() => setScreen('howto')} autoFocus>¡A jugar! ▶</button></>
            : <button type="button" onClick={() => { setRound(0); setReveal(0); setCupOut(false); setScreen('menu'); }} autoFocus>VOLVER A JUGAR</button>}
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
        <h2 id="kf-title">{world ? `MUNDIAL: ELEGÍ LOS JUGADORES (HASTA ${MAX_CUP_PLAYERS})` : pick === 0 ? 'ELEGÍ TU JUGADOR' : 'ELEGÍ AL RIVAL'}</h2>
        <div className="kf-select-row">
          <div className={`kf-pick kf-pick--1${pick === 0 ? ' kf-pick--active' : ''}`} style={{ ['--kf-c' as string]: CHARS[pick === 0 ? shown : p1].color }}>
            <FighterCard char={pick === 0 ? shown : p1} w={cardW} h={cardH} />
            <b data-testid="kv-pick-1">{CHARS[pick === 0 ? shown : p1].name}</b>
            <small>{world ? `JUGADOR ${players.includes(shown) ? players.indexOf(shown) + 1 : Math.min(MAX_CUP_PLAYERS, players.length + 1)}` : 'VOS'}</small>
            <StatBars char={pick === 0 ? shown : p1} />
          </div>
          <div className="kf-grid" role="group" aria-label={world ? 'Jugadores del mundial' : pick === 0 ? 'Tu jugador' : 'Rival'} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {CHAR_IDS.map((id, i) => {
              const sel1 = pick === 0 ? cursor === i : id === p1, sel2 = pick === 1 && cursor === i, jn = world ? players.indexOf(id) + 1 : 0;
              return <button key={id} type="button" className={`kf-cell${sel1 ? ' kf-cell--1' : ''}${sel2 ? ' kf-cell--2' : ''}`} aria-label={CHARS[id].name} aria-pressed={cursor === i}
                onClick={() => { if (cursor === i) chooseChar(i); else { setCursor(i); playKfName(id); if (pick === 0) setP1(id); else setP2(id); } }}
                onDoubleClick={() => chooseChar(i)}>
                <Portrait char={id} size={cell} square />
                {world ? jn > 0 && <i className="kf-tag kf-tag--1" data-testid={`kv-player-${jn}`}>J{jn}</i> : <>{sel1 && <i className="kf-tag kf-tag--1">1</i>}{sel2 && <i className="kf-tag kf-tag--2">CPU</i>}</>}
              </button>;
            })}
          </div>
          {world ? <CupPlayers players={players} w={cardW} h={cardH} /> : <div className={`kf-pick kf-pick--2${pick === 1 ? ' kf-pick--active' : ''}`} style={{ ['--kf-c' as string]: CHARS[pick === 1 ? CHAR_IDS[cursor] : p2].color }}>
            {pick === 1 ? <FighterCard char={CHAR_IDS[cursor]} w={cardW} h={cardH} mirror /> : <div className="kf-pick-empty" style={{ width: cardW, height: cardH }}>?</div>}
            <b data-testid="kv-pick-2">{pick === 1 ? CHARS[CHAR_IDS[cursor]].name : '—'}</b>
            <small>CPU</small>
            {pick === 1 && <StatBars char={CHAR_IDS[cursor]} right />}
          </div>}
        </div>
        <div className="kf-actions">
          <button type="button" className="kf-secondary" onClick={() => { if (pick === 1) { setPick(0); setCursor(CHAR_IDS.indexOf(p1)); } else setScreen('menu'); }}>‹ Volver</button>
          {pick === 1 && <button type="button" className="kf-secondary" onClick={() => chooseChar(CHAR_IDS.indexOf(CHAR_IDS.filter(c => c !== p1)[Math.floor(Math.random() * 15)]))}>🎲 Al azar</button>}
          {world
            ? <><button type="button" className="kf-secondary" data-testid="kv-toggle-player" disabled={!players.includes(CHAR_IDS[cursor]) && players.length >= MAX_CUP_PLAYERS} onClick={() => chooseChar(cursor)}>{players.includes(CHAR_IDS[cursor]) ? `Sacar a ${CHARS[CHAR_IDS[cursor]].name}` : `Agregar a ${CHARS[CHAR_IDS[cursor]].name}`}</button>
              <button type="button" data-testid="kv-start-cup" onClick={startCup}>{players.length > 1 ? `Empezar el mundial (${players.length} jugadores) ▶` : 'Empezar el mundial ▶'}</button></>
            : <button type="button" onClick={() => chooseChar(cursor)}>Elegir {CHARS[CHAR_IDS[cursor]].name} ▶</button>}
        </div>
        <p className="kf-hint">{world ? 'Flechas para moverte · ENTER agrega o saca al luchador · cada uno juega sus partidos contra la máquina (y entre ustedes desde cuartos)' : 'Flechas para moverte · ENTER para elegir · o tocá la cara (dos veces para elegir)'}</p>
      </div>}
      {screen !== 'playing' && !selecting && screen !== 'vs' && screen !== 'ladder' && screen !== 'champion' && <div className={`runner-overlay kf-overlay${screen === 'menu' ? ' kf-menu-wall' : ''}`} role="dialog" aria-labelledby="kf-title" style={screen === 'menu' ? { backgroundImage: `radial-gradient(ellipse at 50% 45%, #0000 40%, #000000b3 100%), url(${menuBg})`, backgroundSize: 'auto, cover', backgroundPosition: 'center', backgroundColor: '#1a0503' } : undefined}>
        <div>
          {screen === 'menu' && <>
            <h2 id="kf-title" className="kf-logo">KOMBAT<br /><span>VOLEY</span></h2>
            <p>Vóley uno contra uno con los luchadores de Kombat Football: un set a {SET_POINTS} (con dos de diferencia), tres toques por lado y remates saltando junto a la red. 16 estadios, cada uno con su pelota: meteorito de fuego, bomba, rayo, fantasma, lunar…</p>
            <div className="kf-modes">
              <button type="button" onClick={() => { playKfSelectVoice(); setMode('cpu'); setPick(0); setCursor(CHAR_IDS.indexOf(p1)); setScreen('select'); }} autoFocus>Amistoso</button>
              <button type="button" onClick={() => { playKfSelectVoice(); setMode('world'); setRound(0); setReveal(0); setPick(0); setCursor(CHAR_IDS.indexOf(p1)); setScreen('select'); }}>Mundial</button>
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
            {two ? <h2 id="kf-title" className="end-banner end-banner--win">¡GANÓ {CHARS[chars[result.winner]].name}!</h2> : <EndBanner win={result.winner === 0} id="kf-title" />}
            <p className="kf-final">{CHARS[chars[0]].name} <b>{result.score[0]} - {result.score[1]}</b> {CHARS[chars[1]].name}</p>
            {world && <p>{worldLine}</p>}
            <div className="kf-actions">
              <button type="button" className="kf-secondary" onClick={() => setScreen('menu')}>Menú</button>
              {world && result.winner === 1 && !two && cup.humans.length === 1 && <button type="button" className="kf-secondary" onClick={() => begin(round)}>Reintentar el partido</button>}
              {world
                ? <button type="button" onClick={continueCup} autoFocus>Ver el cuadro ▶</button>
                : <button type="button" onClick={() => begin(round)} autoFocus>Revancha</button>}
            </div>
          </>}
        </div>
      </div>}
    </div>
    {screen === 'playing' && <GamePad className="kf-pad" action={{ hold: hold('hit'), label: 'Golpear' }} actionLabel="🏐" dirs={{ left: { hold: hold('left'), aria: 'Izquierda' }, right: { hold: hold('right'), aria: 'Derecha' }, up: { hold: hold('up'), aria: 'Saltar' }, down: { hold: hold('down'), aria: 'Abajo' } }} extra={<button type="button" className="kf-cast" aria-label="Levantar" {...hold('set')}>⇧</button>} />}
  </section>;
}
