import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TouchGrips } from './TouchGrips';
import { GamePad } from './GamePad';
import { fitViewport, pixelRatio, useFitScreen } from './fitScreen';
import { Link } from 'react-router-dom';
import { CHARS, CHAR_IDS, STAGES, STATS, type CharId, type StageId } from './kombat';
import { FORMATIONS, L as FIELD_L, D as FIELD_D, SOCCER_HALF, STYLES, attackDir, footballScore, formationSpots, isHuman as humanTeam, newSoccer, noSInput, soccerClock, spawnHazard, stepSoccer, takeSoccerEvents, type FormationId, type HazardKind, type SInput, type SoccerMatch, type Style } from './kombatSoccer';
import { CUP_ROUNDS, MAX_CUP_PLAYERS, advanceCup, cupSlot, isHuman, newCup, nextHumanMatch, playerNo, setMatchScore, type Cup } from './kombatVoleyCup';
import { KombatShootout } from './KombatShootout';
import { drawSoccer, drawSoccerBackdrop, drawSoccerThumb } from './kombatSoccerArt';
import { drawFighterCard, drawPortrait, setLowFx } from './kombatFighters';
import { setNoGrain } from './gravityMonsters';
import spaceBg from './assets/fondos/kf-espacio.webp'; // (el espacio de la selección, ya pintado: antes se dibujaba al abrir y trababa el menú)
import menuBg from './assets/fondos/kf-menu.webp';
import { onBackdropLoad, preloadBackdrops } from './kombatScenery';
import {
  playGameOver, playKfBlock, playKfBall, playKfButton, playKfElectric, playKfEnergy, playKfThunder, playKfGoal, playKfVsSentence, playKfHit, playKfKickoffVoice, playKfLaser, playKfMeteorFall, playKfMeteorImpact, playKfName, playKfSelectVoice, playKfPost, playPenExplosion, playVampAcid, playBombBeep,
  playRefWhistle, playSharkBite, playSharkLeap, playUfoArrive, preloadKfHazardSounds, setKfRotor, playStart, playWinFanfare, preloadKombatSounds, preloadKombatUi, setCrowd, setKfMusic,
} from './sounds';
import { EndBanner } from './EndBanner';
import { Fireworks } from './Fireworks';

// ---------------------------------------------------------------- Récords (en el navegador)
const RECORD_KEY = 'escritorio-personal-juegos:kombat';
export interface KombatRecord { wins: number; losses: number; best: number; cups: number }
export const readKombatRecord = (): KombatRecord => {
  try { const v = JSON.parse(localStorage.getItem(RECORD_KEY) ?? 'null'); return v && typeof v.wins === 'number' ? v : { wins: 0, losses: 0, best: 0, cups: 0 }; } catch { return { wins: 0, losses: 0, best: 0, cups: 0 }; }
};
const saveRecord = (r: KombatRecord) => { try { localStorage.setItem(RECORD_KEY, JSON.stringify(r)); } catch { /* sin almacenamiento */ } };

type Mode = 'cpu' | 'versus' | 'world';
type Screen = 'menu' | 'select' | 'vs' | 'ladder' | 'stage' | 'tactics' | 'howto' | 'playing' | 'paused' | 'result' | 'champion';
// Fácil: para aprender los botones (la máquina es lenta, no usa la C, casi nunca hace gol seguro y los peligros no
// van contra tu jugador). Normal y Difícil, cada vez más rápida y más peligrosa.
const DIFFICULTY = [
  { name: 'Fácil', level: 0.2, desc: 'Para aprender los botones: la máquina es lenta y no te saca la pelota' },
  { name: 'Normal', level: 0.55, desc: 'Un partido parejo' },
  { name: 'Difícil', level: 0.9, desc: 'Rápida, te saca la pelota y patea con la barra llena' },
];
// El Mundial (igual que el de Kombat Penales y Kombat Voley): los 16 luchadores en un cuadro de octavos, cuartos,
// semifinal y final, con hasta MAX_CUP_PLAYERS personas. La máquina es más difícil en cada fase.
const ROUNDS = CUP_ROUNDS;
const cupLevel = (n: number) => 0.3 + n * 0.17;
// En los penales (si empatan): cuánto llega el arquero de la máquina (lo mismo que en Kombat Penales).
const PEN_REACH = [0.12, 0.3, 0.5];
const cupPenReach = (n: number) => 0.18 + n * 0.1;
const cupChars = (cup: Cup, n: number): [CharId, CharId] => nextHumanMatch(cup, n)?.chars ?? [cup.humans[0], CHAR_IDS.find(c => !isHuman(cup, c))!];

// Teclas (por la tecla física): un jugador con las flechas (o WASD), V para patear al arco (cuanto más se aprieta,
// más fuerte), X para pasar (sin la pelota: cambiar al más cercano a la pelota) y C para sacarle la pelota al rival.
// Dos jugadores: J1 con WASD + V / Q / E y J2 con las flechas + ENTER / SHIFT der. / CTRL der.
type Key = 'left' | 'right' | 'up' | 'down' | 'kick' | 'pass' | 'steal' | 'auto';
const KEYS_SOLO: Record<string, Key> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', KeyV: 'kick', KeyX: 'pass', KeyK: 'pass', KeyC: 'steal', KeyL: 'steal', KeyZ: 'auto', KeyJ: 'auto' };
const KEYS_P1: Record<string, Key> = { KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', KeyV: 'kick', KeyQ: 'pass', KeyE: 'steal', KeyR: 'auto' };
const KEYS_P2: Record<string, Key> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Enter: 'kick', NumpadEnter: 'kick', ShiftRight: 'pass', ControlRight: 'steal', Numpad1: 'kick', Numpad2: 'pass', Numpad3: 'steal', Slash: 'auto', Numpad4: 'auto' };
interface KeyHelp { move: string[]; kick: string; pass: string; steal: string; auto: string }
const helpFor = (two: boolean, side: 0 | 1): KeyHelp => two
  ? side === 0 ? { move: ['W', 'A', 'S', 'D'], kick: 'V', pass: 'Q', steal: 'E', auto: 'R' } : { move: ['↑', '←', '↓', '→'], kick: 'ENTER', pass: 'SHIFT der.', steal: 'CTRL der.', auto: '/' }
  : { move: ['↑', '←', '↓', '→'], kick: 'V', pass: 'X', steal: 'C', auto: 'Z' };

interface Side { dir: 1 | -1; active: CharId }
interface Hud { score: [number, number]; clock: string; half: string; extra: boolean; sides: [Side, Side]; intro: boolean }
const hudOf = (m: SoccerMatch): Hud => ({
  score: [m.teams[0].goals, m.teams[1].goals], clock: m.extra ? 'GOL DE ORO' : soccerClock(m.clock), half: m.extra ? 'EXTRA' : m.half === 1 ? '1T' : '2T', extra: m.extra,
  sides: ([0, 1] as const).map(t => ({ dir: attackDir(m, t), active: m.players[m.teams[t].active].char })) as [Side, Side],
  intro: m.phase === 'intro' && m.half === 1 && !m.extra && m.time < 2.4,
});
// Lo que se anuncia cuando aparece cada peligro.
const HAZARD_SHOUT: Record<HazardKind, string> = { shark: '🦈 ¡TIBURÓN!', acid: '🟢 ¡ÁCIDO!', ufo: '🛸 ¡OVNI!', meteor: '☄️ ¡METEORITO!' };
const activeIds = (m: SoccerMatch) => ([0, 1] as const).filter(t => humanTeam(m, t)).map(t => m.teams[t].active);
const QUALITY = [1, 0.82, 0.68, 0.55]; // escalones de resolución del partido
const sameHud = (a: Hud, b: Hud) => JSON.stringify(a) === JSON.stringify(b);

interface Shout { id: number; text: string; sub?: string; kind: 'goal' | 'fatal' | 'info' | 'block' | 'extra' }

// La cara (cuadrada para la grilla, redonda para la barra de arriba).
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
// El luchador entero, respirando, como en la pantalla de selección de los juegos de pelea.
// Las barras de velocidad, fuerza y salto (0 a 100). A la izquierda: nombre, barra y número; a la derecha (el
// rival) al revés: número, barra y nombre, y la barra se llena desde la derecha.
const STAT_ROWS = [['Velocidad', 'speed'], ['Fuerza', 'strength'], ['Salto', 'jump']] as const;
// La miniatura de la formación: la cancha vista desde arriba (el equipo ataca hacia la derecha), con el arquero, los
// defensores y los delanteros, y flechitas que muestran el modo (para adelante, para atrás o los dos).
function FormationMini({ formation, style, color, testId }: { formation: FormationId; style: Style; color: string; testId?: string }) {
  const W = 300, H = 132, pad = 6, sx = (x: number) => pad + x / FIELD_L * (W - pad * 2), sy = (z: number) => pad + z / FIELD_D * (H - pad * 2);
  const spots = formationSpots(formation);
  const arrow = (role: string) => style === 'off' ? 1 : style === 'def' ? -1 : role === 'fwd' ? 1 : -1;
  return <svg className="kf-formation-mini" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Formación ${formation}`} data-testid={testId}>
    {Array.from({ length: 10 }, (_, i) => <rect key={i} x={pad + i * (W - pad * 2) / 10} y={pad} width={(W - pad * 2) / 10} height={H - pad * 2} fill={i % 2 ? '#2f7d32' : '#358a38'} />)}
    <g fill="none" stroke="#e8f5e9" strokeWidth="1.4" opacity="0.85">
      <rect x={pad} y={pad} width={W - pad * 2} height={H - pad * 2} />
      <line x1={W / 2} y1={pad} x2={W / 2} y2={H - pad} />
      <circle cx={W / 2} cy={H / 2} r={(H - pad * 2) * 0.17} />
      <rect x={pad} y={sy(FIELD_D / 2 - 8.25)} width={sx(7) - pad} height={sy(FIELD_D / 2 + 8.25) - sy(FIELD_D / 2 - 8.25)} />
      <rect x={sx(FIELD_L - 7)} y={sy(FIELD_D / 2 - 8.25)} width={sx(7) - pad} height={sy(FIELD_D / 2 + 8.25) - sy(FIELD_D / 2 - 8.25)} />
    </g>
    <rect x={pad - 4} y={sy(FIELD_D / 2 - 4.3)} width="4" height={sy(FIELD_D / 2 + 4.3) - sy(FIELD_D / 2 - 4.3)} fill="#fff" />
    <rect x={W - pad} y={sy(FIELD_D / 2 - 4.3)} width="4" height={sy(FIELD_D / 2 + 4.3) - sy(FIELD_D / 2 - 4.3)} fill="#fff" />
    {spots.map(([role, x, z], i) => { const cx = sx(x), cy = sy(z), a = role === 'gk' ? 0 : arrow(role);
      return <g key={i}>
        {a !== 0 && <path d={`M${cx + a * 9} ${cy} l${a * 10} 0 m${-a * 4} -4 l${a * 4} 4 l${-a * 4} 4`} stroke="#fde047" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        <circle cx={cx} cy={cy} r="7" fill={role === 'gk' ? '#fde047' : color} stroke="#000" strokeWidth="1.5" />
        <text x={cx} y={cy + 3} textAnchor="middle" fontSize={role === 'fwd' ? 6.5 : 8} fontWeight="900" fill="#000">{role === 'gk' ? 'A' : role === 'def' ? 'D' : 'DL'}</text>
      </g>; })}
  </svg>;
}

function StatBars({ char, right = false, testId }: { char: CharId; right?: boolean; testId?: string }) {
  return <><div className={`kf-stats${right ? ' kf-stats--r' : ''}`} data-testid={testId}>
    {STAT_ROWS.map(([label, k]) => { const v = STATS[char][k]; return <div key={k} className="kf-stat" aria-label={`${label} ${v}`}>
      <span>{label}</span>
      <i style={{ ['--v' as string]: `${v}%`, ['--c' as string]: `hsl(${Math.round(v * 1.2)} 85% 48%)` }}><b /></i>
      <em>{v}</em>
    </div>; })}
  </div>
  </>;
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
// La copa y el cuadro del mundial (igual que en Kombat Penales; si empataron, los penales entre paréntesis).
const Trophy = ({ size }: { size: number }) => <svg className="kv-trophy" width={size} height={size * 1.25} viewBox="0 0 100 125" aria-hidden="true">
  <defs>
    <linearGradient id="kf-gold" x1="0" x2="1"><stop offset="0" stopColor="#7c4a03" /><stop offset=".3" stopColor="#fde68a" /><stop offset=".55" stopColor="#f59e0b" /><stop offset="1" stopColor="#78350f" /></linearGradient>
    <radialGradient id="kf-ballg" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#fff" /><stop offset=".7" stopColor="#e5e7eb" /><stop offset="1" stopColor="#6b7280" /></radialGradient>
  </defs>
  <circle cx="50" cy="20" r="17" fill="url(#kf-ballg)" stroke="#111" strokeWidth="1.5" />
  <polygon points="50,13 57,18 54,26 46,26 43,18" fill="#111" />
  <path d="M50 13 V4 M57 18 L66 15 M54 26 L59 33 M46 26 L41 33 M43 18 L34 15" stroke="#111" strokeWidth="1.5" />
  <path d="M22 38 H78 C78 62 66 74 56 78 V90 H44 V78 C34 74 22 62 22 38 Z" fill="url(#kf-gold)" stroke="#451a03" strokeWidth="1.5" />
  <path d="M22 44 C8 44 8 62 26 64 M78 44 C92 44 92 62 74 64" fill="none" stroke="url(#kf-gold)" strokeWidth="5" />
  <path d="M30 98 H70 L74 112 H26 Z" fill="url(#kf-gold)" stroke="#451a03" strokeWidth="1.5" />
  <rect x="38" y="88" width="24" height="11" rx="2" fill="#92400e" />
  <rect x="20" y="111" width="60" height="10" rx="2" fill="#1c1917" stroke="#a16207" strokeWidth="1.5" />
  <text x="50" y="119" textAnchor="middle" fontSize="6.4" fontWeight="900" fill="#fcd34d" fontFamily="system-ui">KOMBAT FOOTBALL</text>
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
    const n = c < 3 ? pos(c + 1, Math.floor(k / 2)) : { x: W / 2, y: top + ph / 2 }, nS = c < 3 ? S : S * 1.3, xout = n.x - sgn * nS / 2, xm = (xin + xout) / 2;
    const you = !!sl && isHuman(cup, sl.char), fresh = c === reveal - 1 && sl?.won;
    const color = sl?.won ? (you ? '#fbbf24' : '#e2e8f0') : sl?.lost ? '#33415588' : '#64748b88';
    lines.push(<path key={`l${c}-${k}`} className={fresh ? 'kv-line-new' : undefined} d={`M${xin} ${p.y} H${xm} V${n.y} H${xout}`} fill="none" stroke={color} strokeWidth={sl?.won ? (you ? 4 : 3) : 2} strokeLinejoin="round" pathLength={1} />);
    const current = !!mine && c === round && !champ && Math.floor(k / 2) === mine.index;
    slots.push(<div key={`s${c}-${k}-${sl?.char ?? ''}`} data-testid={`kf-slot-${c}-${k}`} title={sl ? CHARS[sl.char].name : undefined}
      className={`kv-slot${sl ? '' : ' kv-slot--empty'}${you ? ' kv-slot--you' : ''}${sl?.lost ? ' kv-slot--out' : ''}${current ? ' kv-slot--now' : ''}${c === reveal && c > 0 ? ' kv-slot--new' : ''}`}
      style={{ left: p.x - S / 2, top: p.y - S / 2, width: S, height: S, ['--d' as string]: `${0.15 + (k % (8 >> c)) * 0.05}s` }}>
      {sl ? <Portrait char={sl.char} size={S - 6} mirror={!p.left} square /> : <span>?</span>}
      {c === 0 && sl && you && cup.humans.length > 1 && <i className="kv-seed kv-seed--you" style={{ [p.left ? 'right' : 'left']: S + 4 }}>J{playerNo(cup, sl.char)}</i>}
      {sl && sl.score !== null && <b className={`kv-score${sl.won ? ' kv-score--won' : ''}`} style={{ [p.left ? 'left' : 'right']: S + 3 }}>{sl.score}{sl.pen !== null ? <small> ({sl.pen})</small> : null}</b>}
    </div>);
  }
  const cS = Math.round(S * 1.3);
  return <div className="kv-bracket" data-testid="kf-bracket" style={{ width: W, height: H }}>
    {(['OCTAVOS', 'CUARTOS', 'SEMIS', 'FINAL'] as const).map((t, c) => <span key={t} className={`kv-col${c === round && !champ ? ' kv-col--now' : ''}`} style={{ left: (c + 0.5) * col, ['--w' as string]: `${col}px` }}>{t}</span>)}
    {(['OCTAVOS', 'CUARTOS', 'SEMIS', 'FINAL'] as const).map((t, c) => <span key={`r${t}`} className={`kv-col${c === round && !champ ? ' kv-col--now' : ''}`} style={{ left: W - (c + 0.5) * col, ['--w' as string]: `${col}px` }}>{t}</span>)}
    <svg className="kv-lines" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">{lines}</svg>
    {slots}
    <div className="kv-cup" style={{ left: W / 2, top: top + ph / 2 - cS / 2 - Math.min(ph * 0.42, col * 2.3) - 4 }}><Trophy size={Math.min(ph * 0.34, col * 1.85)} /></div>
    <div data-testid="kf-champion" className={`kv-slot kv-slot--champ${champ ? (isHuman(cup, champ) ? ' kv-slot--you' : '') : ' kv-slot--empty'}${reveal === 4 ? ' kv-slot--new' : ''}`} title={champ ? CHARS[champ].name : 'Campeón'}
      style={{ left: W / 2 - cS / 2, top: top + ph / 2 - cS / 2, width: cS, height: cS, ['--d' as string]: '0.4s' }}>
      {champ ? <Portrait char={champ} size={cS - 6} square /> : <span>🏆</span>}
    </div>
    <small className="kv-note" style={{ top: top + ph / 2 + cS / 2 + 8 }}>{champ ? `CAMPEÓN: ${CHARS[champ].name}` : 'Cruces sorteados al azar'}</small>
  </div>;
}
// Las personas elegidas para el mundial (a la derecha de la selección).
function CupPlayers({ players, w, h }: { players: CharId[]; w: number; h: number }) {
  return <div className="kf-pick kf-pick--2 kv-players" style={{ width: w, minHeight: h }} data-testid="kf-cup-players">
    <b>JUGADORES</b>
    {players.length ? <ol>{players.map((c, i) => <li key={c} style={{ ['--kf-c' as string]: CHARS[c].color }}><Portrait char={c} size={Math.min(56, Math.floor(h / Math.max(5, players.length + 2)))} square /><span><small>JUGADOR {i + 1}</small>{CHARS[c].name}</span></li>)}</ol>
      : <p>Elegí uno o más luchadores (hasta {MAX_CUP_PLAYERS}). Los demás los maneja la máquina.</p>}
    <small>{players.length > 1 ? 'No se cruzan en octavos' : 'Cruces sorteados al azar'}</small>
  </div>;
}
function StageThumb({ stage, w, h }: { stage: StageId; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(0);
  useEffect(() => onBackdropLoad(() => setLoaded(n => n + 1)), []); // cuando llega el fondo pintado, se redibuja
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const k = pixelRatio(2); c.width = w * k; c.height = h * k;
    const ctx = c.getContext('2d'); if (!ctx) return;
    ctx.setTransform(k, 0, 0, k, 0, 0); drawSoccerThumb(ctx, stage, w, h);
  }, [stage, w, h, loaded]);
  return <canvas ref={ref} style={{ width: '100%', aspectRatio: `${w}/${h}` }} aria-hidden="true" />;
}
const Keys = ({ keys }: { keys: string[] }) => <span className="kf-combo">{keys.map((k, i) => <span key={i}>{i > 0 && <i>+</i>}<kbd>{k}</kbd></span>)}</span>;

export function KombatFootball() {
  const fit = useFitScreen(); // celulares y tablets en horizontal: igual que en la computadora, más chico
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null); // el fondo, en su propio lienzo: siempre con toda la calidad
  const bgKey = useRef('');
  const matchRef = useRef<SoccerMatch | null>(null);
  const inputs = useRef<[SInput, SInput]>([noSInput(), noSInput()]);
  const latch = useRef<[Partial<SInput>, Partial<SInput>]>([{}, {}]); // teclas tocadas muy rápido (entre dos cuadros): cuentan igual
  const [screen, setScreen] = useState<Screen>('menu');
  useEffect(() => { // (para probar en desarrollo: mirar el partido y hacer aparecer un peligro)
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __kfMatch?: () => SoccerMatch | null; __kfHazard?: (k: HazardKind) => unknown };
    w.__kfMatch = () => matchRef.current; w.__kfHazard = k => matchRef.current && spawnHazard(matchRef.current, k);
  }, []);
  const [mode, setMode] = useState<Mode>('cpu');
  const [p1, setP1] = useState<CharId>('cometa');
  const [p2, setP2] = useState<CharId>('inferno');
  const [pick, setPick] = useState<0 | 1>(0); // a quién se está eligiendo
  const [cursor, setCursor] = useState(0);
  const [stage, setStage] = useState<StageId>('industrial');
  const [difficulty, setDifficulty] = useState(1);
  const [formations, setFormations] = useState<[FormationId, FormationId]>(['3-2', '3-2']);
  const [styles, setStyles] = useState<[Style, Style]>(['bal', 'bal']);
  const [round, setRound] = useState(0);
  const [reveal, setReveal] = useState(0);
  const [cup, setCup] = useState<Cup>(() => newCup('cometa'));
  const [players, setPlayers] = useState<CharId[]>([]); // las personas del mundial (jugador 1, 2…)
  const [cupOut, setCupOut] = useState(false); // ya no queda ninguna persona en el mundial
  const cupMatch = useRef<{ index: number; flipped: boolean } | null>(null);
  const [pvp, setPvp] = useState(false); // el partido es entre dos personas (2 jugadores, o dos personas en el mundial)
  const pvpRef = useRef(false);
  // la tanda de penales si el partido terminó empatado (la de Kombat Penales)
  const [pens, setPens] = useState<{ key: number; stage: StageId; reach: number } | null>(null);
  const goalsRef = useRef<[number, number]>([0, 0]);
  const [hud, setHud] = useState<Hud | null>(null);
  const [shouts, setShouts] = useState<Shout[]>([]);
  const [record, setRecord] = useState(readKombatRecord);
  const [result, setResult] = useState<{ winner: 0 | 1; score: [number, number]; pens?: [number, number] } | null>(null);
  const [fighting, setFighting] = useState<[CharId, CharId]>(['cometa', 'inferno']);
  const [stageName, setStageName] = useState('');
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

  // Calidad del dibujo: si los cuadros tardan mucho (celular lento) baja un escalón; si sobra, vuelve a subir.
  const quality = useRef(0);
  const backdropTick = useRef(0); // (cuando termina de cargar un fondo, se vuelve a pintar)
  useEffect(() => onBackdropLoad(() => { backdropTick.current++; }), []);
  const paint = useCallback(() => {
    const el = stageRef.current, canvas = canvasRef.current, m = matchRef.current;
    if (!el || !canvas || !m) return;
    // como mucho ~1920 × 1100 píxeles reales: en pantallas grandes o retina el dibujo no se pone lento. En celulares
    // y tablets un poco menos, y si igual va lento (quality baja sola) se dibuja con menos píxeles.
    const touch = !!window.matchMedia?.('(pointer: coarse)').matches;
    const k = Math.min(pixelRatio(touch ? 1.5 : 2), (touch ? 1280 : 1920) / Math.max(1, el.clientWidth), (touch ? 760 : 1100) / Math.max(1, el.clientHeight)) * QUALITY[quality.current], w = Math.round(el.clientWidth * k), h = Math.round(el.clientHeight * k);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const low = touch || quality.current > 0; setLowFx(low); setNoGrain(low);
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
    drawSoccer(ctx, m, w, h, { activeIds: screenRef.current === 'playing' || screenRef.current === 'paused' ? activeIds(m) : [], noBackdrop: true });
    const bg = bgRef.current;
    if (bg) { // (con la resolución de la pantalla aunque el partido baje la calidad)
      const kb = Math.min(pixelRatio(2), 2560 / Math.max(1, el.clientWidth), 1500 / Math.max(1, el.clientHeight)), bw = Math.round(el.clientWidth * kb), bh = Math.round(el.clientHeight * kb);
      if (bg.width !== bw || bg.height !== bh) { bg.width = bw; bg.height = bh; bgKey.current = ''; }
      const key = `${m.stage}|${Math.round(m.cam.x * 8)}|${Math.round(m.cam.z * 8)}|${backdropTick.current}`;
      const bctx = bg.getContext('2d');
      if (bctx && key !== bgKey.current) { bgKey.current = key; bctx.setTransform(1, 0, 0, 1, 0, 0); drawSoccerBackdrop(bctx, m, bw, bh); }
    }
    setNoGrain(false); // (los otros juegos sí la usan)
  }, []);

  // El partido que se ve de fondo en los menús (dos máquinas jugando).
  const menuish = screen === 'menu' || screen === 'select' || screen === 'vs' || screen === 'ladder' || screen === 'stage' || screen === 'howto';
  const demoStage = screen === 'stage' || screen === 'howto' ? (mode === 'world' ? cup.stages[round] : stage) : 'industrial';
  useLayoutEffect(() => {
    if (!menuish) return;
    const m = newSoccer(demoStage, [p1, p2], [0.6, 0.6]);
    m.introLen = 0.3;
    matchRef.current = m;
    let frame = 0, last = performance.now();
    const tick = (now: number) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; stepSoccer(m, [noSInput(), noSInput()], dt); takeSoccerEvents(m); if (m.clock < 5) m.clock = SOCCER_HALF; if (screenRef.current !== 'select' && screenRef.current !== 'ladder' && screenRef.current !== 'menu') paint(); /* (detrás del menú no se ve) */ frame = requestAnimationFrame(tick); }; // tapado por la selección: no se dibuja
    frame = requestAnimationFrame(tick);
    const observer = new ResizeObserver(paint); if (stageRef.current) observer.observe(stageRef.current);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [menuish, demoStage, p1, p2, paint]);

  const begin = useCallback((n = round) => {
    playStart(); preloadKombatSounds(); preloadKfHazardSounds();
    const world = mode === 'world', cm = world ? nextHumanMatch(cup, n) : null;
    const st = world ? cup.stages[n] : stage, pair: [CharId, CharId] = cm ? cm.chars : [p1, p2];
    const both = cm ? cm.humans[1] : mode === 'versus';
    cupMatch.current = cm ? { index: cm.index, flipped: cm.flipped } : null;
    pvpRef.current = both; setPvp(both);
    const level = world ? cupLevel(n) : DIFFICULTY[difficulty].level;
    const cpuF = FORMATIONS[Math.floor(Math.random() * FORMATIONS.length)].id, cpuS = STYLES[Math.floor(Math.random() * STYLES.length)].id; // (la máquina: al azar)
    const m = newSoccer(st, pair, [null, both ? null : level], Math.random, { formations: [formations[0], both ? formations[1] : cpuF], styles: [styles[0], both ? styles[1] : cpuS] });
    matchRef.current = m; setFighting(pair);
    inputs.current = [noSInput(), noSInput()];
    setHud(hudOf(m)); setResult(null); setShouts([]); setPens(null);
    const def = STAGES.find(s => s.id === st)!;
    setStageName(`${world ? `Mundial · ${ROUNDS[n]} · ` : ''}${def.name}`);
    setScreen('playing');
  }, [mode, stage, p1, p2, difficulty, round, formations, styles, cup]);
  // Termina el partido (en el tiempo, o en los penales): el récord, el resultado y, en el mundial, se anota en el cuadro.
  const finishMatch = useCallback((winner: 0 | 1, score: [number, number], penScore?: [number, number]) => {
    const both = pvpRef.current, win = winner === 0, rec = readKombatRecord();
    if (!both) { if (win) rec.wins++; else rec.losses++; saveRecord(rec); setRecord(rec); }
    const cm = cupMatch.current;
    if (modeRef.current === 'world' && cm) {
      const sw = (v: [number, number]): [number, number] => cm.flipped ? [v[1], v[0]] : v;
      setCup(c => setMatchScore(c, round, cm.index, sw(score), penScore ? sw(penScore) : undefined));
    }
    setResult({ winner, score, pens: penScore }); setPens(null);
    if (win || both) playWinFanfare(); else playGameOver();
    setScreen('result');
  }, [round]);
  // Después de un partido del mundial: el que sigue de la misma fase, o se cierra la fase (o termina el mundial).
  const continueCup = () => {
    const a = advanceCup(cup, round, Math.random, footballScore);
    setCup(a.cup); setRound(a.round); setReveal(a.reveal); setCupOut(a.done === 'out');
    if (a.done === 'champion') { const rec = readKombatRecord(); rec.cups++; saveRecord(rec); setRecord(rec); playWinFanfare(); }
    setScreen(a.done === 'champion' ? 'champion' : 'ladder');
  };
  // Arranca el mundial con las personas elegidas (si no eligió a nadie, con el luchador marcado).
  const startCup = useCallback(() => {
    const list = players.length ? players : [CHAR_IDS[cursor]];
    setPlayers(list); setCup(newCup(list, Math.random, true)); setRound(0); setReveal(0); setCupOut(false); setScreen('ladder');
  }, [players, cursor]);

  // ---------------------------------------------------------------- La selección (estilo juego de pelea)
  const chooseChar = useCallback((idx: number) => {
    const id = CHAR_IDS[idx];
    if (pick === 0) playKfName(id, 0.12); // (el rival lo dice la frase de la pantalla VS)
    if (pick === 0) {
      setP1(id);
      if (mode === 'world') { setPlayers(list => list.includes(id) ? list.filter(c => c !== id) : list.length < MAX_CUP_PLAYERS ? [...list, id] : list); return; } // (se agrega o se saca)
      setPick(1); const other = CHAR_IDS.indexOf(p2 === id ? CHAR_IDS[(idx + 1) % 16] : p2); setCursor(other); if (p2 === id) setP2(CHAR_IDS[other]);
    } else { setP2(id); setScreen('vs'); playKfVsSentence(p1, id); } // los dos frente a frente antes de elegir el escenario
  }, [pick, mode, p1, p2]);
  const cols = 4; // la grilla es un cuadrado de 4 × 4
  // teclado de las pantallas de elegir
  useEffect(() => {
    if (screen !== 'select' && screen !== 'vs' && screen !== 'stage' && screen !== 'tactics' && screen !== 'howto' && screen !== 'ladder') return;
    const down = (e: KeyboardEvent) => {
      const k = e.code;
      if (screen === 'vs') { if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') { e.preventDefault(); playKfButton(); setScreen('stage'); } else if (k === 'Escape' || k === 'Backspace') { setPick(1); setCursor(CHAR_IDS.indexOf(p2)); setScreen('select'); } return; }
      if (screen === 'ladder') { if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') { e.preventDefault(); playKfButton(); setScreen(cupOut ? 'menu' : 'tactics'); } else if ((k === 'Escape' || k === 'Backspace') && round === 0 && !cupOut) setScreen('select'); return; }
      if (screen === 'howto') { if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') { e.preventDefault(); playKfButton(); begin(mode === 'world' ? round : 0); } else if (k === 'Escape') setScreen('tactics'); return; }
      if (screen === 'tactics') { if (k === 'Enter' || k === 'NumpadEnter') { e.preventDefault(); playKfButton(); setScreen('howto'); } else if (k === 'Escape' || k === 'Backspace') setScreen(mode === 'world' ? 'ladder' : 'stage'); return; }
      const n = screen === 'select' ? 16 : STAGES.length, c = screen === 'select' ? cols : narrow ? 2 : 4;
      const cur = screen === 'select' ? cursor : STAGES.findIndex(s => s.id === stage);
      let next: number;
      if (k === 'ArrowLeft' || k === 'KeyA') next = (cur + n - 1) % n;
      else if (k === 'ArrowRight' || k === 'KeyD') next = (cur + 1) % n;
      else if (k === 'ArrowUp' || k === 'KeyW') next = (cur - c + n) % n;
      else if (k === 'ArrowDown' || k === 'KeyS') next = (cur + c) % n;
      else if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') { e.preventDefault(); playKfButton(); if (screen === 'select') chooseChar(cursor); else setScreen('tactics'); return; }
      else if (k === 'Escape' || k === 'Backspace') { if (screen === 'stage') setScreen('vs'); else if (pick === 1) { setPick(0); setCursor(CHAR_IDS.indexOf(p1)); } else setScreen('menu'); return; }
      else return;
      e.preventDefault(); playKfButton(0.45);
      if (screen === 'select') { setCursor(next); playKfName(CHAR_IDS[next], 0.05); if (pick === 0) setP1(CHAR_IDS[next]); else setP2(CHAR_IDS[next]); } else setStage(STAGES[next].id);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [screen, cursor, cols, narrow, stage, pick, p1, p2, mode, round, begin, chooseChar, cupOut]);

  // La música del menú: suena mientras se elige y se corta cuando aparece el escenario del partido.
  useEffect(() => { preloadKombatUi(); preloadBackdrops(STAGES.map(st => st.id)); const img = new Image(); img.src = spaceBg; }, []); // (el espacio de la selección se baja antes de que haga falta)
  useEffect(() => {
    setKfMusic(menuish);
    if (!menuish) return;
    const first = () => setKfMusic(true); // sin un clic previo el navegador no deja sonar: arranca con el primero
    window.addEventListener('pointerdown', first, { once: true }); window.addEventListener('keydown', first, { once: true });
    return () => { window.removeEventListener('pointerdown', first); window.removeEventListener('keydown', first); };
  }, [menuish]);
  useEffect(() => () => setKfMusic(false), []);

  // ---------------------------------------------------------------- El partido
  useEffect(() => {
    if (screen !== 'playing' || pens) { if (!pens) setCrowd(0); return; } // (en los penales manda la tanda)
    setCrowd(0.6);
    let slow = 1 / 60, checkT = 0;
    let frame = 0, last = performance.now(), acc = 0, bounceT = 0, lastBolt = -1;
    const human = (side: 0 | 1) => pvpRef.current || side === 0;
    const tick = (now: number) => {
      const m = matchRef.current; if (!m) return;
      // pasos fijos de 1/60 s: si la compu va lenta el partido no se pone en cámara lenta (hasta 6 pasos por cuadro)
      const dt = Math.min(0.2, (now - last) / 1000); last = now; acc += dt;
      slow = slow * 0.95 + dt * 0.05; checkT += dt;
      if (checkT > 1.5) { // como mucho un cambio cada 1,5 s (cambiar el tamaño rearma el fondo)
        if (slow > 1 / 45 && quality.current < QUALITY.length - 1) { quality.current++; checkT = 0; }
        else if (slow < 1 / 57 && quality.current > 0 && checkT > 6) { quality.current--; checkT = 0; }
      }
      for (let n = 0; acc >= 1 / 60 && n < 6; n++) {
        acc -= 1 / 60;
        const [a, b] = inputs.current, [la, lb] = latch.current;
        stepSoccer(m, n === 0 ? [{ ...a, ...la }, { ...b, ...lb }] : inputs.current, 1 / 60);
        if (n === 0) latch.current = [{}, {}];
      }
      if (acc > 1 / 60) acc = 0;
      bounceT -= dt;
      if (m.stage === 'storm') { const k = Math.floor(m.time / 4.2); if (k !== lastBolt) { if (lastBolt >= 0) playKfThunder(0.6, 0.15); lastBolt = k; } } // los relámpagos del fondo con su trueno
      for (const e of takeSoccerEvents(m)) {
        switch (e.type) {
          case 'kick': playKfBall(Math.min(1.3, 0.6 + e.power * 0.6)); if (e.full) playKfEnergy(0.7, 1.2); break;
          case 'pass': playKfBall(0.55, 1.15); if (e.space && e.side !== undefined && human(e.side)) shout('¡AL ESPACIO!', 'info', undefined, 650); break;
          case 'autopass': playKfBall(0.6, 1.05); break;
          case 'control': playKfBall(0.35, 1.3); break;
          case 'tackle': if (e.ok) playKfBlock(); break;
          case 'bounce': if (bounceT <= 0 && e.power >= 0.08) { playKfBall(Math.min(0.8, 0.15 + e.power * 0.6), 1.12); bounceT = 0.08; } break;
          case 'post': playKfPost(); break;
          case 'goal': playKfGoal(); shout(e.bomb ? '💣 ¡GOL BOMBA! ×2' : e.own ? '¡GOL EN CONTRA!' : '¡GOL!', e.bomb ? 'fatal' : 'goal', `${CHARS[e.scorer].name} · ${m.teams[0].goals} - ${m.teams[1].goals}`, 2400); break;
          case 'save': playKfBlock(); shout('¡ATAJADA!', 'block', undefined, 900); break;
          case 'switch': playKfButton(0.35); break;
          case 'steal': playKfBlock(); playKfHit(0.8); break;
          case 'header': playKfBall(0.7, 0.9); if (human(e.side)) shout('¡CABEZAZO!', 'info', undefined, 700); break;
          // los peligros del escenario
          case 'hazard': shout(HAZARD_SHOUT[e.kind], 'info', undefined, 1100); if (e.kind === 'ufo') playUfoArrive(); else if (e.kind === 'acid') playVampAcid(); else if (e.kind === 'meteor') playKfMeteorFall(1.8); break;
          case 'dive': playSharkLeap(); break;
          case 'eaten': playSharkBite(human(e.side) ? 'player' : 'persona', 0.9); playKfHit(0.8); break;
          case 'acid': playVampAcid(); break;
          case 'bomb': playBombBeep(3); playKfEnergy(0.7, 0.7); shout('💣 ¡PELOTA BOMBA!', 'fatal', 'Metela en el arco antes de que explote: el gol vale doble', 2200); break;
          case 'bombTick': playBombBeep(e.n <= 3 ? e.n : 3); break;
          case 'bombBoom': playKfMeteorImpact(); if (e.side !== null) shout('💥 ¡BOOM!', 'fatal', undefined, 1000); break;
          case 'beam': playKfLaser(); playKfElectric(0.7); break;
          case 'impact': playKfMeteorImpact(); break;
          case 'explode': playPenExplosion(); playKfHit(1); break;
          case 'whistle': playRefWhistle(e.kind); if (e.kind === 'kickoff' && e.start) playKfKickoffVoice(e.start, 0.7); if (e.kind === 'kickoff' && m.teams[0].goals + m.teams[1].goals === 0) shout(m.half === 1 ? '¡A JUGAR!' : 'SEGUNDO TIEMPO', 'extra', undefined, 1100); break;
          case 'halftime': { const d = -attackDir(m, 0); shout('ENTRETIEMPO', 'extra', `Cambio de lado: ${pvpRef.current ? 'J1 ataca' : 'ahora atacás'} hacia la ${d > 0 ? 'derecha ▶' : '◀ izquierda'}`, 3000); break; }
          case 'penalties': shout('¡PENALES!', 'extra', `Terminó empatado ${m.teams[0].goals} - ${m.teams[1].goals}: se define por penales`, 2600); break;
        }
      }
      paint();
      { const sh = m.hazards.find(h => h.kind === 'shark'); setKfRotor(sh ? Math.max(0.15, 1 - Math.abs(sh.x - m.cam.x) / 30) * (sh.stage === 1 ? 1 : 0.8) : 0); } // la hélice del tiburón
      const next = hudOf(m);
      setHud(prev => prev && sameHud(prev, next) ? prev : next);
      if (m.phase === 'end' && m.penalties && m.phaseT > 2.8) { // empate: a los penales (la tanda de Kombat Penales)
        goalsRef.current = [m.teams[0].goals, m.teams[1].goals]; setKfRotor(0);
        const md = modeRef.current, n = round;
        setPens({ key: m.time, stage: m.stage, reach: md === 'world' ? cupPenReach(n) : PEN_REACH[difficulty] });
        return;
      }
      if (m.phase === 'end' && m.phaseT > 3.2 && m.winner !== null) { // (antes, festejan los que ganaron)
        finishMatch(m.winner, [m.teams[0].goals, m.teams[1].goals]);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hide = () => { if (document.hidden) setScreen('paused'); };
    document.addEventListener('visibilitychange', hide);
    const observer = new ResizeObserver(paint); if (stageRef.current) observer.observe(stageRef.current);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', hide); observer.disconnect(); setKfRotor(0); };
  }, [screen, paint, shout, round, pens, difficulty, finishMatch]);
  useEffect(() => () => setCrowd(0), []);

  // Teclado del partido.
  useEffect(() => {
    const map = (code: string): [0 | 1, Key] | null => {
      if (pvpRef.current) { if (KEYS_P1[code]) return [0, KEYS_P1[code]]; if (KEYS_P2[code]) return [1, KEYS_P2[code]]; return null; }
      return KEYS_SOLO[code] ? [0, KEYS_SOLO[code]] : null;
    };
    const down = (e: KeyboardEvent) => {
      const s = screenRef.current;
      if ((e.code === 'Escape' || e.code === 'KeyP') && (s === 'playing' || s === 'paused')) { setScreen(s === 'playing' ? 'paused' : 'playing'); return; }
      const hit = map(e.code);
      if (!hit || s !== 'playing') return;
      e.preventDefault();
      inputs.current[hit[0]][hit[1]] = true; latch.current[hit[0]][hit[1]] = true;
    };
    const up = (e: KeyboardEvent) => { const hit = map(e.code); if (hit) inputs.current[hit[0]][hit[1]] = false; };
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

  const inMatch = screen === 'playing' || screen === 'paused' || screen === 'result';
  const world = mode === 'world';
  const two = inMatch ? pvp : mode === 'versus' || (world && !!nextHumanMatch(cup, round)?.humans[1]);
  const chars: [CharId, CharId] = inMatch ? fighting : world ? cupChars(cup, round) : [p1, p2];
  // en el mundial con varias personas, cada una es "JUGADOR n" (su número en el mundial)
  const many = world && cup.humans.length > 1;
  const who = (c: CharId) => many && isHuman(cup, c) ? `JUGADOR ${playerNo(cup, c)}` : '';
  const label = (i: 0 | 1) => who(chars[i]) || (two ? `JUGADOR ${i + 1}` : i === 0 ? 'VOS' : 'CPU');
  const cupName = (c: CharId) => isHuman(cup, c) ? (many ? `${who(c)} · ${CHARS[c].name}` : CHARS[c].name) : `${CHARS[c].name} (CPU)`;
  const cupFresh = round === 0 && cup.rounds[0].every(m => m.sa === null); // todavía no se jugó ningún partido
  const worldLine = result && world ? (() => {
    const w = chars[result.winner], l = chars[1 - result.winner], next = round + 1 < ROUNDS.length ? ROUNDS[round + 1].toLowerCase() : null;
    if (two) return `${label(result.winner)} ${next ? `pasa a ${next}` : 'gana la final'}; ${label(result.winner === 0 ? 1 : 0)} queda afuera.`;
    if (result.winner === 0) return `${many ? `${who(w)} ganó` : '¡Ganaste'} ${ROUNDS[round].toLowerCase()}${many ? '' : '!'}${next ? ` ${many ? 'Pasa' : 'Pasás'} a ${next}.` : ''}`;
    return `${many ? `${who(l)} quedó afuera` : 'Quedaste afuera'} en ${ROUNDS[round].toLowerCase()}.`;
  })() : '';
  // La barra de arriba de cada lado: retrato y nombre (sin barras de poder: los jugadores no se atacan).
  const sideBar = (i: 0 | 1) => {
    const c = CHARS[chars[i]];
    return <div className={`kf-side kf-side--${i}`} data-testid={`kf-side-${i}`}>
      <Portrait char={chars[i]} size={64} mirror={i === 1} square />
      <div className="kf-bars">
        <div className="kf-energy">
          <i style={{ width: '100%', background: `linear-gradient(180deg, ${c.color}, ${c.color}aa 60%, ${c.color}77)` }} />
          <b>{c.name}{who(chars[i]) ? ` · J${playerNo(cup, chars[i])}` : two ? ` · J${i + 1}` : i === 0 ? '' : ' · CPU'}</b>
        </div>
      </div>
    </div>;
  };

  const howto = (side: 0 | 1) => { const c = CHARS[chars[side]], k = helpFor(two, side); return <div className="kf-howto-card" style={{ ['--kf-c' as string]: c.color }}>
    <div className="kf-howto-head"><Portrait char={chars[side]} size={56} square mirror={side === 1} /><div><b>{c.name}</b><small>{two ? `${label(side)[0]}${label(side).slice(1).toLowerCase()}` : 'Vos'} · capitán de 6</small></div></div>
    <ul>
      <li><Keys keys={k.move} /> correr para todos lados. Tu equipo son seis {c.name} (el arquero y 5 jugadores); manejás al del aro amarillo (cambia solo al más cercano a la pelota)</li>
      <li><Keys keys={[k.kick]} /> <b>patear al arco:</b> cuanto más lo apretás, más fuerte sale (soltalo para patear). Si llenás la barra es <b>gol seguro</b>: el arquero no llega. Flojo, el arquero lo ataja. Si al soltar apretás {two && side === 0 ? 'W o S' : '↑ o ↓'}, la pelota sale con efecto hacia ese palo.</li>
      <li><Keys keys={[k.pass]} /> <b>pasar</b> al compañero hacia donde apuntás. Si va más adelante y tiene lugar, es un <b>pase al espacio</b>: la pelota va adelante suyo y él pica a buscarla · sin la pelota: <b>cambiar</b> al jugador más cercano a la pelota</li>
      <li><Keys keys={[k.auto]} /> <b>autopase:</b> te la tocás larga hacia donde corrés y salís detrás. Sin la pelota pegada se corre más rápido, así que sirve para dejar atrás al rival (¡pero puede llegar antes!)</li>
      <li><Keys keys={[k.steal]} /> <b>sacar la pelota:</b> el rival que la tiene sale volando para arriba y explota en sangre y huesos (si está un poco lejos, te tirás hacia él). ¡Ojo que la máquina también lo hace!</li>
      <li className="kf-howto-fatal">💣 <b>PELOTA BOMBA:</b> cada tanto la pelota se convierte en una bomba con la mecha prendida y una cuenta regresiva. Al que la tenga cuando llega a cero, ¡le explota encima! Pero si la metés en el arco antes, el <b>gol vale doble</b> y el arco vuela por el aire con el arquero. Pensalo dos veces antes de robarla con la C.</li>
      <li><b>Arquero con la pelota:</b> <Keys keys={[k.pass]} /> se la pasa a un compañero · <Keys keys={[k.kick]} /> la tira para arriba, bien lejos</li>
      <li className="kf-howto-ab"><b>CUIDADO CON LA CANCHA</b> (le puede tocar a cualquiera, de los dos equipos):
        <ul className="kf-atks">
          <li>🦈 <b>Tiburones voladores:</b> persiguen a un jugador desde el aire y se tiran en picada. Corré para que no te coman.</li>
          <li>🟢 <b>Charcos de ácido:</b> aparecen de la nada (primero burbujea el piso). Rodealos: el que los pisa se derrite.</li>
          <li>🛸 <b>Ovni:</b> sigue a un jugador, se frena, marca el piso en celeste y dispara. Salí de la marca.</li>
          <li>☄️ <b>Meteoritos:</b> la marca roja avisa dónde caen. El que queda adentro explota.</li>
        </ul>
        Pasan de a uno por vez. Los que mueren vuelven a entrar en unos segundos.</li>
      <li><b>Dos tiempos de 2:30.</b> Si terminan empatados, <b>penales</b> como en Kombat Penales: piedra, papel o tijera para ver quién patea primero y en cada penal elegís el lugar con las flechas ({two ? 'entre dos, primero el que patea y después el arquero, sin mirar' : 'la máquina ya eligió apenas suena el silbato'}).</li>
    </ul>
  </div>; };

  const playing = screen === 'playing' || screen === 'paused';
  const selecting = screen === 'select';
  const shown = selecting ? CHAR_IDS[cursor] : p1;
  // La selección ocupa toda la pantalla, centrada: los cuadrados 50% más grandes (156 px) si entran, y el
  // luchador elegido del alto de la grilla.
  const cell = narrow ? Math.max(56, Math.min(99, Math.floor((vp.w - 40) / 4))) : Math.max(70, Math.min(156, Math.floor((vp.h - 230) / 4)));
  const cardH = narrow ? 225 : Math.round(Math.min(375, cell * 4 * 0.98, Math.max(150, vp.h - 360))) /* (pantallas bajas: más chico, así entra con sus barras) */, cardW = Math.round(cardH * 0.76);
  return <section className="runner kf" style={fit} aria-label="Kombat Football" onClickCapture={e => { if ((e.target as Element).closest('button, a')) playKfButton(); }}>
    <TouchGrips actionLabel={screen === 'playing' ? '⚽' : 'Elegir'} extra={playing && !two && !pens ? <>
      <button type="button" className="kf-cast" aria-label="Pasar" {...hold('pass')}>⇄</button>
      <button type="button" className="kf-cast" aria-label="Autopase" {...hold('auto')}>»</button>
      <button type="button" className="kf-cast" aria-label="Sacar la pelota" {...hold('steal')}>✊</button>
    </> : undefined} />
    <div className="runner-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1>Kombat Football</h1>
      <div className="runner-scores">
        {world && playing && <span>Mundial <strong data-testid="kf-round">{ROUNDS[round]}</strong></span>}
        {record.wins + record.losses > 0 && <span>Récord <strong>{record.wins}G {record.losses}P{record.cups ? ` · 🏆 ${record.cups}` : ''}</strong></span>}
      </div>
      {playing && <button type="button" onClick={() => setScreen(s => s === 'playing' ? 'paused' : 'playing')}>{screen === 'playing' ? 'Pausa' : 'Seguir'}</button>}
    </div>
    <div className="runner-stage kf-stage" ref={stageRef}>
      <canvas ref={bgRef} className="kf-bg" aria-hidden="true" />
      <canvas ref={canvasRef} role="img" aria-label="Cancha de Kombat Football" />
      {playing && pens && <KombatShootout key={pens.key} stage={pens.stage} chars={fighting} two={pvp} reach={pens.reach} labels={[label(0), label(1)]} paused={screen === 'paused'} onEnd={(w, sc) => finishMatch(w, goalsRef.current, sc)} />}
      {playing && hud && !pens && <div className="kf-hud">
        {sideBar(0)}
        <div className="kf-center">
        <div className="kf-score" aria-live="polite">
          <div className="kf-score-main" data-testid="kf-score">
            <span className="kf-goals" style={{ ['--kf-c' as string]: CHARS[chars[0]].color }}>{hud.score[0]}</span><i> - </i><span className="kf-goals" style={{ ['--kf-c' as string]: CHARS[chars[1]].color }}>{hud.score[1]}</span>
          </div>
          <small data-testid="kf-clock"><b>{hud.half}</b>{hud.clock}</small>
        </div>
        </div>
        {sideBar(1)}
      </div>}
      {playing && hud?.intro && <div className="kf-vs" aria-hidden="true">
        <div className="kf-vs-side" style={{ ['--kf-c' as string]: CHARS[chars[0]].color }}><FighterCard char={chars[0]} w={150} h={190} /><b>{CHARS[chars[0]].name}</b></div>
        <div className="kf-vs-mid"><strong>VS</strong><small>{stageName}</small></div>
        <div className="kf-vs-side" style={{ ['--kf-c' as string]: CHARS[chars[1]].color }}><FighterCard char={chars[1]} w={150} h={190} mirror /><b>{CHARS[chars[1]].name}</b></div>
      </div>}
      {playing && <p className="kf-rotate">📱 Girá el celular para ver la cancha más grande</p>}
      <div className="kf-shouts" aria-live="assertive">
        {shouts.map(s => <div key={s.id} className={`kf-shout kf-shout--${s.kind}`} role="status">{s.text}{s.sub && <small>{s.sub}</small>}</div>)}
      </div>
      {(screen === 'ladder' || screen === 'champion') && <div className="kf-select kv-world" role="dialog" aria-labelledby="kf-title">
        {screen === 'champion' && <Fireworks />}
        <h2 id="kf-title" className={screen === 'champion' ? 'end-banner end-banner--win' : undefined}>{screen === 'champion' ? '🏆 ¡CAMPEÓN DEL MUNDO!' : 'MUNDIAL DE KOMBAT FOOTBALL'}</h2>
        <WorldBracket cup={cup} round={round} reveal={reveal} width={Math.max(300, Math.min(1180, vp.w - 24))} height={Math.max(250, Math.min(620, vp.h - (narrow ? 200 : 215)))} />
        {screen === 'champion' && cup.champion
          ? <p className="kf-zone">{many ? <>¡<b>{who(cup.champion)} · {CHARS[cup.champion].name}</b> ganó el mundial!</> : <>Ganaste octavos, cuartos, semifinal y la final con <b>{CHARS[cup.champion].name}</b>.</>}</p>
          : cupOut ? <p className="kf-zone" data-testid="kf-ladder-next">{many ? 'Quedaron todos afuera' : 'Quedaste afuera'}. Campeón: <b>{cup.champion ? CHARS[cup.champion].name : ''}</b></p>
          : <p className="kf-zone" data-testid="kf-ladder-next"><b>{ROUNDS[round]}</b> · <b>{cupName(chars[0])}</b> vs <b>{cupName(chars[1])}</b> · {STAGES.find(s => s.id === cup.stages[round])!.name}</p>}
        <div className="kf-actions">
          {screen === 'ladder' && !cupOut
            ? <><button type="button" className="kf-secondary" onClick={() => setScreen(cupFresh ? 'select' : 'menu')}>{cupFresh ? '‹ Volver' : 'Abandonar'}</button>
              <button type="button" onClick={() => setScreen('tactics')} autoFocus>¡A jugar! ▶</button></>
            : <button type="button" onClick={() => { setRound(0); setReveal(0); setCupOut(false); setScreen('menu'); }} autoFocus>VOLVER A JUGAR</button>}
        </div>
      </div>}
      {screen === 'vs' && <div className="kf-select kf-versus" role="dialog" aria-labelledby="kf-title" style={{ backgroundImage: `linear-gradient(90deg, ${CHARS[p1].color}38, #0000 38%, #0000 62%, ${CHARS[p2].color}38), radial-gradient(ellipse at 50% 50%, #0000 30%, #000000c0 100%), url(${spaceBg})`, backgroundSize: 'auto, auto, cover', backgroundPosition: 'center', backgroundColor: '#03020c' }}>
        <h2 id="kf-title" className="sr-only">{CHARS[p1].name} contra {CHARS[p2].name}</h2>
        <div className="kf-versus-row">
          {([0, 1] as const).map(side => { const id = side === 0 ? p1 : p2, h = narrow ? Math.min(250, vp.h * 0.36, (vp.w - 50) / 2 / 0.76) : Math.min(560, vp.h * 0.62); return <div key={side} className={`kf-versus-side kf-versus-side--${side + 1}`} style={{ ['--kf-c' as string]: CHARS[id].color }}>
            <small>{two ? `JUGADOR ${side + 1}` : side === 0 ? 'VOS' : 'CPU'}</small>
            <FighterCard char={id} w={Math.round(h * 0.76)} h={Math.round(h)} mirror={side === 1} />
            <b data-testid={`kf-vs-${side + 1}`}>{CHARS[id].name}</b>
            <StatBars char={id} right={side === 1} />
          </div>; })}
          <div className="kf-versus-mid" aria-hidden="true"><strong>VS</strong></div>
        </div>
        <div className="kf-actions">
          <button type="button" className="kf-secondary" onClick={() => { setPick(1); setCursor(CHAR_IDS.indexOf(p2)); setScreen('select'); }}>‹ Volver</button>
          <button type="button" onClick={() => setScreen('stage')} autoFocus>Seleccionar escenario ▶</button>
        </div>
      </div>}
      {selecting && <div className="kf-select" role="dialog" aria-labelledby="kf-title" style={{ backgroundImage: `radial-gradient(ellipse at 50% 45%, #0000 55%, #00000080 100%), url(${spaceBg})`, backgroundSize: 'auto, cover', backgroundPosition: 'center', backgroundColor: '#03020c' }}>
        <h2 id="kf-title">{world ? `MUNDIAL: ELEGÍ LOS JUGADORES (HASTA ${MAX_CUP_PLAYERS})` : mode === 'versus' ? `JUGADOR ${pick + 1}: ELEGÍ TU LUCHADOR` : pick === 0 ? 'ELEGÍ TU LUCHADOR' : 'ELEGÍ AL RIVAL'}</h2>
        <div className="kf-select-row">
          <div className={`kf-pick kf-pick--1${pick === 0 ? ' kf-pick--active' : ''}`} style={{ ['--kf-c' as string]: CHARS[pick === 0 ? shown : p1].color }}>
            <FighterCard char={pick === 0 ? shown : p1} w={cardW} h={cardH} />
            <b data-testid="kf-pick-1">{CHARS[pick === 0 ? shown : p1].name}</b>
            <small>{world ? (players.includes(shown) ? `JUGADOR ${players.indexOf(shown) + 1}` : players.length < MAX_CUP_PLAYERS ? `JUGADOR ${players.length + 1}` : `YA SON ${MAX_CUP_PLAYERS}`) : mode === 'versus' ? 'J1' : 'VOS'}</small>
            <StatBars char={pick === 0 ? shown : p1} testId="kf-stats-1" />
          </div>
          <div className="kf-grid" role="group" aria-label={world ? 'Jugadores del mundial' : pick === 0 ? 'Tu luchador' : 'Rival'} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {CHAR_IDS.map((id, i) => {
              const sel1 = pick === 0 ? cursor === i : id === p1, sel2 = pick === 1 && cursor === i, jn = world ? players.indexOf(id) + 1 : 0;
              return <button key={id} type="button" className={`kf-cell${sel1 ? ' kf-cell--1' : ''}${sel2 ? ' kf-cell--2' : ''}`} aria-label={CHARS[id].name} aria-pressed={cursor === i}
                onClick={() => { if (cursor === i) chooseChar(i); else { setCursor(i); playKfName(id); if (pick === 0) setP1(id); else setP2(id); } }}
                onDoubleClick={() => chooseChar(i)}>
                <Portrait char={id} size={cell} square />
                {world ? jn > 0 && <i className="kf-tag kf-tag--1" data-testid={`kf-player-${jn}`}>J{jn}</i> : <>{sel1 && <i className="kf-tag kf-tag--1">1</i>}{sel2 && <i className="kf-tag kf-tag--2">{mode === 'versus' ? '2' : 'CPU'}</i>}</>}
              </button>;
            })}
          </div>
          {world ? <CupPlayers players={players} w={cardW} h={cardH} /> : <div className={`kf-pick kf-pick--2${pick === 1 ? ' kf-pick--active' : ''}`} style={{ ['--kf-c' as string]: CHARS[pick === 1 ? CHAR_IDS[cursor] : p2].color }}>
            {pick === 1 ? <FighterCard char={CHAR_IDS[cursor]} w={cardW} h={cardH} mirror /> : <div className="kf-pick-empty" style={{ width: cardW, height: cardH }}>?</div>}
            <b data-testid="kf-pick-2">{pick === 1 ? CHARS[CHAR_IDS[cursor]].name : '—'}</b>
            <small>{mode === 'versus' ? 'J2' : 'CPU'}</small>
            {pick === 1 && <StatBars char={CHAR_IDS[cursor]} right testId="kf-stats-2" />}
          </div>}
        </div>
        <div className="kf-actions">
          <button type="button" className="kf-secondary" onClick={() => { if (pick === 1) { setPick(0); setCursor(CHAR_IDS.indexOf(p1)); } else setScreen('menu'); }}>‹ Volver</button>
          {pick === 1 && mode === 'cpu' && <button type="button" className="kf-secondary" onClick={() => chooseChar(CHAR_IDS.indexOf(CHAR_IDS.filter(c => c !== p1)[Math.floor(Math.random() * 15)]))}>🎲 Al azar</button>}
          {world
            ? <><button type="button" className="kf-secondary" data-testid="kf-toggle-player" disabled={!players.includes(CHAR_IDS[cursor]) && players.length >= MAX_CUP_PLAYERS} onClick={() => chooseChar(cursor)}>{players.includes(CHAR_IDS[cursor]) ? `Sacar a ${CHARS[CHAR_IDS[cursor]].name}` : `Agregar a ${CHARS[CHAR_IDS[cursor]].name}`}</button>
              <button type="button" data-testid="kf-start-cup" onClick={startCup}>{players.length > 1 ? `Empezar el mundial (${players.length} jugadores) ▶` : 'Empezar el mundial ▶'}</button></>
            : <button type="button" onClick={() => chooseChar(cursor)}>Elegir {CHARS[CHAR_IDS[cursor]].name} ▶</button>}
        </div>
        <p className="kf-hint">{world ? 'Flechas para moverte · ENTER agrega o saca al luchador · cada uno juega sus partidos contra la máquina (y entre ustedes desde cuartos)' : 'Flechas para moverte · ENTER para elegir · o tocá la cara (dos veces para elegir)'}</p>
      </div>}
      {screen !== 'playing' && !selecting && screen !== 'vs' && screen !== 'ladder' && screen !== 'champion' && <div className={`runner-overlay kf-overlay${screen === 'menu' ? ' kf-menu-wall' : ''}`} role="dialog" aria-labelledby="kf-title" style={screen === 'menu' ? { backgroundImage: `radial-gradient(ellipse at 50% 45%, #0000 40%, #000000b3 100%), url(${menuBg})`, backgroundSize: 'auto, cover', backgroundPosition: 'center', backgroundColor: '#1a0503' } : undefined}>
        <div>
          {screen === 'menu' && <>
            <h2 id="kf-title" className="kf-logo">KOMBAT<br /><span>FOOTBALL</span></h2>
            <p>Fútbol 6 contra 6 (arquero + 5) en una cancha larga: elegí tu luchador (tu equipo son seis iguales), la formación y el modo de juego, y sobreviví a la cancha. Sacale la pelota al rival con la C (sale volando y explota), cuidado con los tiburones voladores, los charcos de ácido, el ovni y los meteoritos, y con la PELOTA BOMBA: si te explota en los pies, volás; si la metés en el arco, el gol vale doble. Con la barra del tiro llena es gol seguro. Dos tiempos de 2:30 y, si empatan, penales como en Kombat Penales.</p>
            <div className="kf-modes">
              <button type="button" onClick={() => { playKfSelectVoice(); setMode('cpu'); setPick(0); setCursor(CHAR_IDS.indexOf(p1)); setScreen('select'); }} autoFocus>Contra la máquina</button>
              <button type="button" onClick={() => { playKfSelectVoice(); setMode('versus'); setPick(0); setCursor(CHAR_IDS.indexOf(p1)); setScreen('select'); }}>2 jugadores</button>
              <button type="button" onClick={() => { playKfSelectVoice(); setMode('world'); setRound(0); setReveal(0); setPick(0); setCursor(CHAR_IDS.indexOf(p1)); setScreen('select'); }}>Mundial</button>
            </div>
          </>}
          {screen === 'stage' && <>
            <h2 id="kf-title" className="kf-title-mk">ELEGÍ EL ESCENARIO</h2>
            <div className="kf-stagegrid" role="group" aria-label="Escenario">
              {STAGES.map(s => <button key={s.id} type="button" className={stage === s.id ? 'kf-chosen' : ''} aria-pressed={stage === s.id} onClick={() => { if (stage === s.id) setScreen('tactics'); else setStage(s.id); }}>
                <StageThumb stage={s.id} w={180} h={84} /><b>{s.name}</b>
              </button>)}
            </div>
            <div className="kf-actions">
              <button type="button" className="kf-secondary" onClick={() => setScreen('vs')}>‹ Volver</button>
              <button type="button" onClick={() => setScreen('tactics')}>Siguiente ▶</button>
            </div>
          </>}
          {screen === 'tactics' && <>
            <h2 id="kf-title" className="kf-title-mk">{two ? 'LOS EQUIPOS' : 'TU EQUIPO'}</h2>
            <p className="kf-note">Seis de cada lado: el arquero y 5 jugadores. Elegí la formación y el modo de juego.</p>
            <div className="kf-tactics">{(two ? [0, 1] as const : [0] as const).map(t => <div key={t} className="kf-tactics-team" data-testid={`kf-tactics-${t}`}>
              <b className="kf-tactics-name" style={{ color: CHARS[chars[t]].color }}>{CHARS[chars[t]].name}{two ? ` · ${label(t)}` : ''}</b>
              <FormationMini formation={formations[t]} style={styles[t]} color={CHARS[chars[t]].color} testId={`kf-mini-${t}`} />
              <div className="kf-tactics-row" role="group" aria-label={`Formación${two ? ` J${t + 1}` : ''}`}>
                {FORMATIONS.map(f => <button key={f.id} type="button" className={formations[t] === f.id ? 'kf-chosen' : ''} aria-pressed={formations[t] === f.id} title={`Arquero + ${f.name}`} onClick={() => { playKfButton(0.45); setFormations(cur => (t === 0 ? [f.id, cur[1]] : [cur[0], f.id])); }}>
                  <b>{f.defs}-{f.fwds}</b><small>{f.defs} def. · {f.fwds} del.</small>
                </button>)}
              </div>
              <div className="kf-tactics-row" role="group" aria-label={`Modo${two ? ` J${t + 1}` : ''}`}>
                {STYLES.map(st => <button key={st.id} type="button" className={styles[t] === st.id ? 'kf-chosen' : ''} aria-pressed={styles[t] === st.id} onClick={() => { playKfButton(0.45); setStyles(cur => (t === 0 ? [st.id, cur[1]] : [cur[0], st.id])); }}>
                  <b>{st.name}</b><small>{st.desc}</small>
                </button>)}
              </div>
            </div>)}</div>
            {mode === 'cpu' && <div className="kf-tactics-team kf-tactics-diff">
              <b className="kf-tactics-name">Dificultad</b>
              <div className="kf-tactics-row" role="group" aria-label="Dificultad">{DIFFICULTY.map((d, i) => <button key={d.name} type="button" className={difficulty === i ? 'kf-chosen' : ''} aria-pressed={difficulty === i} onClick={() => { playKfButton(0.45); setDifficulty(i); }}><b>{d.name}</b><small>{d.desc}</small></button>)}</div>
            </div>}
            <div className="kf-actions">
              <button type="button" className="kf-secondary" onClick={() => setScreen(world ? 'ladder' : 'stage')}>‹ Volver</button>
              <button type="button" onClick={() => setScreen('howto')} autoFocus>Siguiente ▶</button>
            </div>
          </>}
          {screen === 'howto' && <>
            <h2 id="kf-title" className="kf-title-mk">CONTROLES</h2>
            <p className="kf-note">{CHARS[chars[0]].name} vs {CHARS[chars[1]].name} · {STAGES.find(s => s.id === (world ? cup.stages[round] : stage))!.name}</p>
            <div className="kf-howto">{howto(0)}{two && howto(1)}</div>
            <p className="kf-note">La cancha es larga y está cerrada por carteles: la pelota rebota y nunca sale. Los peligros le pueden tocar a cualquiera, de los dos equipos.</p>
            <div className="kf-actions">
              <button type="button" className="kf-secondary" onClick={() => setScreen('tactics')}>‹ Volver</button>
              <button type="button" onClick={() => begin(world ? round : 0)} autoFocus>¡A jugar!</button>
            </div>
          </>}
          {screen === 'paused' && <>
            <h2 id="kf-title">Pausa</h2>
            <div className="kf-howto">{howto(0)}{two && howto(1)}</div>
            <div className="kf-actions">
              <button type="button" className="kf-secondary" onClick={() => setScreen('menu')}>Abandonar</button>
              <button type="button" onClick={() => setScreen('playing')} autoFocus>Seguir</button>
            </div>
          </>}
          {screen === 'result' && result && <>
            {two ? <h2 id="kf-title" className="end-banner end-banner--win">¡GANÓ {CHARS[chars[result.winner]].name}!</h2> : <EndBanner win={result.winner === 0} id="kf-title" />}
            <p className="kf-final" data-testid="kf-final">{CHARS[chars[0]].name} <b>{result.score[0]} - {result.score[1]}</b> {CHARS[chars[1]].name}</p>
            {result.pens && <p data-testid="kf-final-pens">Empataron: ganó <b>{CHARS[chars[result.winner]].name}</b> por penales <b>{result.pens[0]} - {result.pens[1]}</b>.</p>}
            {world && <p>{worldLine}</p>}
            <div className="kf-actions">
              <button type="button" className="kf-secondary" onClick={() => setScreen('menu')}>Menú</button>
              {world
                ? <button type="button" onClick={continueCup} autoFocus>Ver el cuadro ▶</button>
                : <button type="button" onClick={() => begin(0)} autoFocus>Revancha</button>}
            </div>
          </>}
        </div>
      </div>}
    </div>
    {playing && !two && !pens && <GamePad className="kf-pad" action={{ hold: hold('kick'), label: 'Patear' }} actionLabel="⚽" dirs={{ left: { hold: hold('left'), aria: 'Izquierda' }, right: { hold: hold('right'), aria: 'Derecha' }, up: { hold: hold('up'), aria: 'Arriba' }, down: { hold: hold('down'), aria: 'Abajo' } }} extra={<>
      <button type="button" className="kf-cast" aria-label="Pasar" {...hold('pass')}>⇄</button>
      <button type="button" className="kf-cast" aria-label="Autopase" {...hold('auto')}>»</button>
      <button type="button" className="kf-cast" aria-label="Sacar la pelota" {...hold('steal')}>✊</button>
    </>} />}
  </section>;
}
