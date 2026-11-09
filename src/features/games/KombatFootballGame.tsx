import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TouchGrips } from './TouchGrips';
import { GamePad } from './GamePad';
import { fitViewport, pixelRatio, useFitScreen } from './fitScreen';
import { Link } from 'react-router-dom';
import { CHARS, CHAR_IDS, HALF_TIME, POWER_MAX, STAGES, STATS, TOURNAMENT, type CharId, type StageId } from './kombat';
import { ATTACKS, LEVEL_CD, attackDir, isHuman as humanTeam, newSoccer, noSInput, soccerClock, stepSoccer, takeSoccerEvents, type SInput, type SoccerMatch } from './kombatSoccer';
import { drawSoccer, drawSoccerBackdrop, drawSoccerThumb } from './kombatSoccerArt';
import { brokenWallURL, vortexURL } from './kombatArt';
import { drawFighterCard, drawPortrait, setLowFx } from './kombatFighters';
import { setNoGrain } from './gravityMonsters';
import { spaceURL } from './kombatSpace';
import { onBackdropLoad, preloadBackdrops } from './kombatScenery';
import {
  playExplosion, playGameOver, playKfBlock, playKfBall, playKfButton, playKfElectric, playKfEnergy, playKfFatal, playKfFinality, playKfFire, playKfThunder, playKfGoal, playKfGoldenRound, playKfVsSentence, playKfHit, playKfKickoffVoice, playKfName, playKfSelectVoice, playKfPickup, playKfPost, playKfPower,
  playRefWhistle, playStart, playWinFanfare, preloadKombatSounds, preloadKombatUi, setCrowd, setKfMusic,
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

type Mode = 'cpu' | 'versus' | 'tournament';
type Screen = 'menu' | 'select' | 'vs' | 'ladder' | 'stage' | 'howto' | 'playing' | 'paused' | 'result' | 'champion';
const DIFFICULTY = [{ name: 'Fácil', level: 0.2 }, { name: 'Normal', level: 0.55 }, { name: 'Difícil', level: 0.9 }];
// El torneo: los 15 rivales en una columna (como la escalera de los juegos de pelea), de los más fáciles abajo al
// jefe arriba; cada partido en un escenario distinto.
const TOURNAMENT_STAGES: StageId[] = ['industrial', 'temple', 'ice', 'subway', 'factory', 'forest', 'desert', 'mines', 'ocean', 'storm', 'coliseum', 'volcano', 'sky', 'base', 'pit'];
const LADDER: CharId[] = ['toxic', 'shadow', 'cometa', 'aguilaBlack', 'frost', 'thunder', 'shadowRed', 'orbotBlue', 'aguila', 'cyber', 'inferno', 'espectro', 'orbot', 'magma', 'brutoRed', 'bruto'];
const tournamentOrder = (you: CharId) => LADDER.filter(c => c !== you);
function tournamentRival(you: CharId, n: number): CharId { return tournamentOrder(you)[Math.min(n, TOURNAMENT - 1)]; }
const tournamentLevel = (n: number) => 0.2 + n * 0.055;

// Teclas (por la tecla física): un jugador con las flechas (o WASD), ESPACIO para patear, X para pasar y C para
// el poder; dos jugadores: J1 con WASD + ESPACIO / Q / E y J2 con las flechas + ENTER / SHIFT / CTRL derechos.
type Key = 'left' | 'right' | 'up' | 'down' | 'kick' | 'pass' | 'power';
const KEYS_SOLO: Record<string, Key> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Space: 'kick', KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', KeyX: 'pass', KeyK: 'pass', KeyC: 'power', KeyL: 'power', KeyZ: 'power' };
const KEYS_P1: Record<string, Key> = { KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', Space: 'kick', KeyQ: 'pass', KeyE: 'power' };
const KEYS_P2: Record<string, Key> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Enter: 'kick', NumpadEnter: 'kick', ShiftRight: 'pass', ControlRight: 'power', Numpad1: 'kick', Numpad2: 'pass', Numpad3: 'power' };
interface KeyHelp { move: string[]; kick: string; pass: string; power: string }
const helpFor = (mode: Mode, side: 0 | 1): KeyHelp => mode === 'versus'
  ? side === 0 ? { move: ['W', 'A', 'S', 'D'], kick: 'ESPACIO', pass: 'Q', power: 'E' } : { move: ['↑', '←', '↓', '→'], kick: 'ENTER', pass: 'SHIFT der.', power: 'CTRL der.' }
  : { move: ['↑', '←', '↓', '→'], kick: 'ESPACIO', pass: 'X', power: 'C' };

interface Side { stamina: number; power: number; ready: boolean; fatal: boolean; dir: 1 | -1; active: CharId; atk: number[] } // atk: cuánto le falta a cada ataque (0 = listo)
interface Hud { score: [number, number]; clock: string; half: string; extra: boolean; sides: [Side, Side]; intro: boolean }
const hudOf = (m: SoccerMatch): Hud => ({
  score: [m.teams[0].goals, m.teams[1].goals], clock: m.extra ? 'GOL DE ORO' : soccerClock(m.clock), half: m.extra ? 'EXTRA' : m.half === 1 ? '1T' : '2T', extra: m.extra,
  sides: ([0, 1] as const).map(t => {
    const T = m.teams[t], a = m.players[T.active], cd = T.atkCd[0] / LEVEL_CD[0];
    return { stamina: Math.round((1 - Math.min(1, cd)) * 25) * 4, power: Math.floor(T.power), ready: cd <= 0, fatal: T.power >= POWER_MAX, dir: attackDir(m, t), active: a.char, atk: T.atkCd.map((c, k) => Math.ceil(c / LEVEL_CD[k] * 8) / 8) };
  }) as [Side, Side],
  intro: m.phase === 'intro' && m.half === 1 && !m.extra && m.time < 2.4,
});
// Los cuatro ataques: C una, dos, tres o cuatro veces.
const tapKeys = (mode: Mode, side: 0 | 1, n: number) => Array.from({ length: n }, () => helpFor(mode, side).power);
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
function StatBars({ char, right = false, testId, attack = false }: { char: CharId; right?: boolean; testId?: string; attack?: boolean }) {
  return <><div className={`kf-stats${right ? ' kf-stats--r' : ''}`} data-testid={testId}>
    {STAT_ROWS.map(([label, k]) => { const v = STATS[char][k]; return <div key={k} className="kf-stat" aria-label={`${label} ${v}`}>
      <span>{label}</span>
      <i style={{ ['--v' as string]: `${v}%`, ['--c' as string]: `hsl(${Math.round(v * 1.2)} 85% 48%)` }}><b /></i>
      <em>{v}</em>
    </div>; })}
  </div>
  {attack && <p className={`kf-attack${right ? ' kf-attack--r' : ''}`} data-testid={testId && `${testId}-attack`}><b>✦ Ataques:</b> {ATTACKS[char].map(x => x.name).join(' · ')}</p>}
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
// Miniatura de un escenario.
// La escalera del torneo: una columna de bloques de piedra con las caras de los rivales (abajo el primero, arriba
// el jefe) y el luchador del jugador en un bloque a la izquierda del rival que le toca. Al ganar sube al siguiente.
function Ladder({ you, round, from, height }: { you: CharId; round: number; from: number; height: number }) {
  const [pos, setPos] = useState(from);
  useEffect(() => { const id = window.setTimeout(() => setPos(round), 450); return () => window.clearTimeout(id); }, [round]);
  const order = tournamentOrder(you), B = Math.max(44, Math.min(76, Math.floor(height / 7.2))), gap = 6, step = B + gap, total = TOURNAMENT * step;
  const cam = Math.max(0, Math.min(total - height, pos * step - height * 0.3));
  const block = (char: CharId, cls: string, mirror = false) => <div className={`kf-ladder-block ${cls}`} style={{ width: Math.round(B * 1.55), height: B }}><Portrait char={char} size={B - 12} mirror={mirror} square /></div>;
  return <div className="kf-tower" style={{ height: Math.min(height, total) }}>
    <div className="kf-tower-inner" style={{ height: total, transform: `translateY(${cam}px)` }}>
      {order.map((c, n) => <div key={c} className="kf-ladder-row" style={{ bottom: n * step }}>
        {block(c, `${n < round ? 'kf-beaten' : ''}${n === round ? ' kf-current' : ''}${n === TOURNAMENT - 1 ? ' kf-boss' : ''}`)}
        <b className="kf-ladder-n">{n === TOURNAMENT - 1 ? 'JEFE' : n + 1}</b>
      </div>)}
      <div className="kf-ladder-you" style={{ bottom: pos * step, left: -Math.round(B * 1.55 * 1.5) - 18 }}>{block(you, 'kf-you', true)}</div>
    </div>
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
  const [mode, setMode] = useState<Mode>('cpu');
  const [p1, setP1] = useState<CharId>('cometa');
  const [p2, setP2] = useState<CharId>('inferno');
  const [pick, setPick] = useState<0 | 1>(0); // a quién se está eligiendo
  const [cursor, setCursor] = useState(0);
  const [stage, setStage] = useState<StageId>('industrial');
  const [difficulty, setDifficulty] = useState(1);
  const [round, setRound] = useState(0);
  const [ladderFrom, setLadderFrom] = useState(0); // desde qué escalón sube el luchador en la escalera
  const [hud, setHud] = useState<Hud | null>(null);
  const [shouts, setShouts] = useState<Shout[]>([]);
  const [banner, setBanner] = useState<{ id: number; side: 0 | 1; dir: 1 | -1 } | null>(null);
  const [record, setRecord] = useState(readKombatRecord);
  const [result, setResult] = useState<{ winner: 0 | 1; score: [number, number] } | null>(null);
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
  const demoStage = screen === 'stage' || screen === 'howto' ? stage : 'industrial';
  useLayoutEffect(() => {
    if (!menuish) return;
    const m = newSoccer(demoStage, [p1, p2], [0.6, 0.6]);
    m.introLen = 0.3;
    matchRef.current = m;
    let frame = 0, last = performance.now();
    const tick = (now: number) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; stepSoccer(m, [noSInput(), noSInput()], dt); takeSoccerEvents(m); if (m.clock < 5 && !m.extra) m.clock = HALF_TIME; if (screenRef.current !== 'select' && screenRef.current !== 'ladder') paint(); frame = requestAnimationFrame(tick); }; // tapado por la selección: no se dibuja
    frame = requestAnimationFrame(tick);
    const observer = new ResizeObserver(paint); if (stageRef.current) observer.observe(stageRef.current);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [menuish, demoStage, p1, p2, paint]);

  const begin = useCallback((n = round) => {
    playStart(); preloadKombatSounds();
    const st = mode === 'tournament' ? TOURNAMENT_STAGES[n] : stage;
    const rival = mode === 'tournament' ? tournamentRival(p1, n) : p2;
    const level = mode === 'tournament' ? tournamentLevel(n) : DIFFICULTY[difficulty].level;
    const m = newSoccer(st, [p1, rival], [null, mode === 'versus' ? null : level]);
    matchRef.current = m; setFighting([p1, rival]);
    inputs.current = [noSInput(), noSInput()];
    setHud(hudOf(m)); setResult(null); setShouts([]); setBanner(null);
    const def = STAGES.find(s => s.id === st)!;
    setStageName(`${mode === 'tournament' ? `Torneo · Partido ${n + 1}/${TOURNAMENT} · ` : ''}${def.name}`);
    setScreen('playing');
  }, [mode, stage, p1, p2, difficulty, round]);

  // ---------------------------------------------------------------- La selección (estilo juego de pelea)
  const chooseChar = useCallback((idx: number) => {
    const id = CHAR_IDS[idx];
    if (pick === 0 || mode === 'tournament') playKfName(id, 0.12); // (el rival lo dice la frase de la pantalla VS)
    if (pick === 0) {
      setP1(id);
      if (mode === 'tournament') { const n = id === p1 ? round : 0; setRound(n); setLadderFrom(n); setScreen('ladder'); return; } // otro luchador: el torneo vuelve a empezar
      setPick(1); const other = CHAR_IDS.indexOf(p2 === id ? CHAR_IDS[(idx + 1) % 16] : p2); setCursor(other); if (p2 === id) setP2(CHAR_IDS[other]);
    } else { setP2(id); setScreen('vs'); playKfVsSentence(p1, id); } // los dos frente a frente antes de elegir el escenario
  }, [pick, mode, p1, p2, round]);
  const cols = 4; // la grilla es un cuadrado de 4 × 4
  // teclado de las pantallas de elegir
  useEffect(() => {
    if (screen !== 'select' && screen !== 'vs' && screen !== 'stage' && screen !== 'howto' && screen !== 'ladder') return;
    const down = (e: KeyboardEvent) => {
      const k = e.code;
      if (screen === 'vs') { if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') { e.preventDefault(); playKfButton(); setScreen('stage'); } else if (k === 'Escape' || k === 'Backspace') { setPick(1); setCursor(CHAR_IDS.indexOf(p2)); setScreen('select'); } return; }
      if (screen === 'ladder') { if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') { e.preventDefault(); playKfButton(); setScreen('howto'); } else if (k === 'Escape' || k === 'Backspace') setScreen('select'); return; }
      if (screen === 'howto') { if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') { e.preventDefault(); playKfButton(); begin(mode === 'tournament' ? round : 0); } else if (k === 'Escape') setScreen(mode === 'tournament' ? 'ladder' : 'stage'); return; }
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

  // La música del menú: suena mientras se elige y se corta cuando aparece el escenario del partido.
  useEffect(() => { preloadKombatUi(); preloadBackdrops(STAGES.map(st => st.id)); const id = window.setTimeout(() => spaceURL(), 700); return () => window.clearTimeout(id); }, []); // el espacio de la selección se pinta antes de que haga falta
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
    if (screen !== 'playing') { setCrowd(0); return; }
    setCrowd(0.6);
    let slow = 1 / 60, checkT = 0;
    let frame = 0, last = performance.now(), acc = 0, bounceT = 0, bannerId = 0, lastBolt = -1, comboT = 0;
    const human = (side: 0 | 1) => modeRef.current === 'versus' || side === 0;
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
      bounceT -= dt; comboT -= dt;
      if (m.stage === 'storm') { const k = Math.floor(m.time / 4.2); if (k !== lastBolt) { if (lastBolt >= 0) playKfThunder(0.6, 0.15); lastBolt = k; } } // los relámpagos del fondo con su trueno
      for (const e of takeSoccerEvents(m)) {
        switch (e.type) {
          case 'kick': playKfBall(Math.min(1.3, 0.6 + e.power * 0.6)); break;
          case 'pass': playKfBall(0.55, 1.15); break;
          case 'control': playKfBall(0.35, 1.3); break;
          case 'hit': playKfHit(1); if (e.kind === 'burn') playKfFire(0.6); else if (e.kind === 'zap') playKfElectric(0.6); else if (e.kind === 'freeze') playKfEnergy(0.5, 1.4); break;
          case 'tackle': if (e.ok) playKfBlock(); break;
          case 'bounce': if (bounceT <= 0 && e.power >= 0.08) { playKfBall(Math.min(0.8, 0.15 + e.power * 0.6), 1.12); bounceT = 0.08; } break;
          case 'post': playKfPost(); break;
          case 'ability': playKfPower(CHARS[e.char].element); if (e.level >= 3) playKfEnergy(0.5 + e.level * 0.1, 0.8); if (human(e.side) && e.level >= 2) shout(ATTACKS[e.char][e.level - 1].name.toUpperCase(), e.level >= 4 ? 'fatal' : 'info', undefined, 900); break;
          case 'fatal': playKfFatal(); playKfFinality(); shout('FATAL GOAL', 'fatal', `${CHARS[e.char].name}: ${CHARS[e.char].fatalName}`, 1700); break;
          case 'goal': playKfGoal(); shout(e.fatal ? '☠ FATAL GOAL ☠' : e.own ? '¡GOL EN CONTRA!' : '¡GOL!', e.fatal ? 'fatal' : 'goal', `${CHARS[e.scorer].name} · ${m.teams[0].goals} - ${m.teams[1].goals}`, 2400); break;
          case 'save': playKfBlock(); shout('¡ATAJADA!', 'block', undefined, 900); break;
          case 'explode': playExplosion(); playKfHit(1); if (e.keeper && m.ball.fatal) shout('¡EL ARQUERO REVENTÓ!', 'fatal', undefined, 1400); break;
          case 'penalty': playRefWhistle('kickoff'); shout('¡PENAL!', 'goal', human(e.side) ? 'ESPACIO para patear (mantenelo para más fuerza) · con ↑ o ↓ elegís el palo, sin flecha va al medio' : 'Poder al que tenía la pelota en el área', 2600); break;
          case 'notReady': if (human(e.side) && comboT <= 0) { comboT = 1.5; shout('Recargando…', 'info', `${ATTACKS[m.players[m.teams[e.side].active].char][e.level - 1].name} todavía no está listo`, 1100); } break;
          case 'header': playKfBall(0.7, 0.9); if (human(e.side)) shout('¡CABEZAZO!', 'info', undefined, 700); break;
          case 'unlock':
            if (human(e.side)) { playKfPickup(); playKfEnergy(0.8); const id = ++bannerId; setBanner({ id, side: e.side, dir: attackDir(m, e.side) }); setTimeout(() => setBanner(b => b && b.id === id ? null : b), 4000); }
            break;
          case 'whistle': playRefWhistle(e.kind); if (e.kind === 'kickoff' && e.start) playKfKickoffVoice(e.start, 0.7); if (e.kind === 'kickoff' && m.teams[0].goals + m.teams[1].goals === 0 && !m.extra) shout(m.half === 1 ? '¡A JUGAR!' : 'SEGUNDO TIEMPO', 'extra', undefined, 1100); break;
          case 'halftime': { const d = -attackDir(m, 0); shout('ENTRETIEMPO', 'extra', `Cambio de lado: ${modeRef.current === 'versus' ? 'J1 ataca' : 'ahora atacás'} hacia la ${d > 0 ? 'derecha ▶' : '◀ izquierda'}`, 3000); break; }
          case 'extra': playRefWhistle('half'); playKfGoldenRound(); shout('TIEMPO EXTRA', 'extra', 'Gol de oro: el primero que mete gana', 2600); break;
        }
      }
      paint();
      const next = hudOf(m);
      setHud(prev => prev && sameHud(prev, next) ? prev : next);
      if (m.phase === 'end' && m.phaseT > 3.2 && m.winner !== null) { // (antes, festejan los que ganaron)
        const win = m.winner === 0, rec = readKombatRecord();
        if (modeRef.current !== 'versus') { if (win) rec.wins++; else rec.losses++; }
        let champion = false;
        if (modeRef.current === 'tournament' && win) { rec.best = Math.max(rec.best, round + 1); if (round + 1 >= TOURNAMENT) { rec.cups++; champion = true; } }
        saveRecord(rec); setRecord(rec);
        setResult({ winner: m.winner, score: [m.teams[0].goals, m.teams[1].goals] });
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

  const chars: [CharId, CharId] = screen === 'playing' || screen === 'paused' || screen === 'result' || screen === 'champion' ? fighting : [p1, mode === 'tournament' ? tournamentRival(p1, round) : p2];
  const isHuman = (i: 0 | 1) => mode === 'versus' || i === 0;
  // La barra de arriba de cada lado: retrato, nombre y la energía (con el poder y la habilidad abajo).
  const sideBar = (i: 0 | 1) => {
    const s = hud?.sides[i], c = CHARS[chars[i]], stamina = s?.stamina ?? 100, power = s?.power ?? 0;
    const color = stamina > 55 ? '#22c55e' : stamina > 25 ? '#facc15' : '#ef4444';
    return <div className={`kf-side kf-side--${i}`} data-testid={`kf-side-${i}`}>
      <Portrait char={chars[i]} size={64} mirror={i === 1} square />
      <div className="kf-bars">
        <div className={`kf-energy${stamina < 20 ? ' kf-energy--low' : ''}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={stamina} aria-label={`Poder de ${c.name}: ${stamina} de 100`} title="Se llena cuando el poder está listo para tirarlo">
          <i style={{ width: `${stamina}%`, background: `linear-gradient(180deg, ${color}, ${color}aa 60%, ${color}77)` }} />
          <b>{c.name}{mode === 'versus' ? ` · J${i + 1}` : i === 0 ? '' : ' · CPU'}</b>
        </div>
        <div className="kf-sub">
          <span className={`kf-power${s?.fatal ? ' kf-power--full' : ''}`} title="Poder: lleno habilita el FATAL GOAL"><u style={{ width: `${power}%` }} /><em>{s?.fatal ? 'FATAL ☠' : 'PODER'}</em></span>

        </div>
      </div>
    </div>;
  };

  const howto = (side: 0 | 1) => { const c = CHARS[chars[side]], k = helpFor(mode, side); return <div className="kf-howto-card" style={{ ['--kf-c' as string]: c.color }}>
    <div className="kf-howto-head"><Portrait char={chars[side]} size={56} square mirror={side === 1} /><div><b>{c.name}</b><small>{mode === 'versus' ? `Jugador ${side + 1}` : 'Vos'} · capitán de 5</small></div></div>
    <ul>
      <li><Keys keys={k.move} /> correr para todos lados. Tu equipo son cinco {c.name}; manejás al del aro amarillo (cambia solo al más cercano a la pelota)</li>
      <li><Keys keys={[k.kick]} /> <b>tirar al arco:</b> mantenelo para cargar el tiro y soltalo. Si al soltar apretás {mode === 'versus' && side === 0 ? 'W o S' : '↑ o ↓'}, la pelota sale <b>con efecto</b> y dobla hacia ese palo.</li>
      <li><Keys keys={[k.pass]} /> <b>pasar</b> al compañero hacia donde apuntás (sin la pelota: cambiar de jugador)</li>
      <li><Keys keys={[k.kick]} /> sin la pelota: <b>quite</b> si estás pegado al rival, <b>barrida</b> si venís corriendo</li>
      <li className="kf-howto-ab"><b>ATAQUES</b> (al rival que tengas adelante, tenga o no la pelota; cada uno se recarga aparte):
        <ol className="kf-atks">{ATTACKS[chars[side]].map((a, k) => <li key={a.name}><Keys keys={tapKeys(mode, side, k + 1)} /> <b>{a.name}</b>{k === 0 ? ' — lo voltea y suelta la pelota' : k === 1 ? ' — lo revienta en sangre' : k === 2 ? ' — revienta a varios' : ' — el más fuerte: revienta a todos los de la zona'}</li>)}</ol>
        Los reventados vuelven a entrar en unos segundos. Si le pegás al que tiene la pelota adentro de tu área, es <b>penal</b>.</li>
      <li><b>Arquero con la pelota:</b> <Keys keys={[k.pass]} /> se la pasa a un compañero · <Keys keys={[k.kick]} /> la tira para arriba, bien lejos</li>
      <li className="kf-howto-fatal"><Keys keys={[k.power]} /> con la barra del equipo llena <b>y la pelota</b>: <b>FATAL GOAL</b> ({c.fatalName}): la pelota sale envuelta en su poder, revienta al arquero y entra.</li>
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
    <TouchGrips actionLabel={screen === 'playing' ? '⚽' : 'Elegir'} extra={playing && mode !== 'versus' ? <>
      <button type="button" className="kf-cast" aria-label="Pasar" {...hold('pass')}>⇄</button>
      <button type="button" className={`kf-cast${hud?.sides[0].ready || hud?.sides[0].fatal ? '' : ' kf-cast--off'}${hud?.sides[0].fatal ? ' kf-cast--fatal' : ''}`} aria-label="Poder" {...hold('power')}>{hud?.sides[0].fatal ? '☠' : '✦'}</button>
    </> : undefined} />
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
      <canvas ref={bgRef} className="kf-bg" aria-hidden="true" />
      <canvas ref={canvasRef} role="img" aria-label="Cancha de Kombat Football" />
      {playing && hud && <div className="kf-hud">
        {sideBar(0)}
        <div className="kf-center">
        <div className="kf-score" aria-live="polite">
          <div className="kf-score-main" data-testid="kf-score">
            <span className="kf-goals" style={{ ['--kf-c' as string]: CHARS[chars[0]].color }}>{hud.score[0]}</span><i> - </i><span className="kf-goals" style={{ ['--kf-c' as string]: CHARS[chars[1]].color }}>{hud.score[1]}</span>
          </div>
          <small data-testid="kf-clock" className={hud.extra ? 'kf-golden' : ''}>{hud.extra ? '' : <b>{hud.half}</b>}{hud.clock}</small>
        </div>
          <div className="kf-specials" data-testid="kf-specials">
            {([0, 1] as const).filter(i => isHuman(i)).map(i => { const c = CHARS[chars[i]], sd = hud.sides[i]; return <span key={i} className={`kf-special kf-special--${i} kf-atkbar`} style={{ ['--kf-c' as string]: c.color }}>
              {ATTACKS[chars[i]].map((a, k) => <i key={a.name} className={sd && sd.atk[k] <= 0 ? 'kf-ready' : ''} style={{ ['--kf-cd' as string]: String(sd?.atk[k] ?? 0) }} title={`${'C '.repeat(k + 1)}· ${a.name}`}><b>{'✦'.repeat(k + 1)}</b><small>{a.name}</small></i>)}
            </span>; })}
          </div>
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
        <div><span>☠ FATAL GOAL · con la pelota apretá</span><Keys keys={[helpFor(mode, banner.side).power]} /></div>
      </div>}
      {playing && <p className="kf-rotate">📱 Girá el celular para ver la cancha más grande</p>}
      <div className="kf-shouts" aria-live="assertive">
        {shouts.map(s => <div key={s.id} className={`kf-shout kf-shout--${s.kind}`} role="status">{s.text}{s.sub && <small>{s.sub}</small>}</div>)}
      </div>
      {screen === 'ladder' && <div className="kf-select kf-ladder" role="dialog" aria-labelledby="kf-title" style={{ backgroundImage: `radial-gradient(ellipse at 50% 42%, #0000 40%, #000000b0 100%), url(${vortexURL() ?? ''})`, backgroundSize: 'auto, cover', backgroundPosition: 'center', backgroundColor: '#0b0518' }}>
        <h2 id="kf-title">ELEGÍ TU DESTINO</h2>
        <Ladder key={`${p1}-${round}`} you={p1} round={round} from={ladderFrom} height={Math.max(260, vp.h - 230)} />
        <p className="kf-zone" data-testid="kf-ladder-next"><b>{CHARS[p1].name}</b> vs <b>{CHARS[tournamentRival(p1, round)].name}</b> · Partido {round + 1} de {TOURNAMENT} · {STAGES.find(s => s.id === TOURNAMENT_STAGES[round])!.name}</p>
        <div className="kf-actions">
          <button type="button" className="kf-secondary" onClick={() => setScreen('select')}>‹ Volver</button>
          <button type="button" onClick={() => setScreen('howto')} autoFocus>¡A pelear! ▶</button>
        </div>
      </div>}
      {screen === 'vs' && <div className="kf-select kf-versus" role="dialog" aria-labelledby="kf-title" style={{ backgroundImage: `linear-gradient(90deg, ${CHARS[p1].color}38, #0000 38%, #0000 62%, ${CHARS[p2].color}38), radial-gradient(ellipse at 50% 50%, #0000 30%, #000000c0 100%), url(${spaceURL() ?? ''})`, backgroundSize: 'auto, auto, cover', backgroundPosition: 'center', backgroundColor: '#03020c' }}>
        <h2 id="kf-title" className="sr-only">{CHARS[p1].name} contra {CHARS[p2].name}</h2>
        <div className="kf-versus-row">
          {([0, 1] as const).map(side => { const id = side === 0 ? p1 : p2, h = narrow ? Math.min(250, vp.h * 0.36, (vp.w - 50) / 2 / 0.76) : Math.min(560, vp.h * 0.62); return <div key={side} className={`kf-versus-side kf-versus-side--${side + 1}`} style={{ ['--kf-c' as string]: CHARS[id].color }}>
            <small>{mode === 'versus' ? `JUGADOR ${side + 1}` : side === 0 ? 'VOS' : 'CPU'}</small>
            <FighterCard char={id} w={Math.round(h * 0.76)} h={Math.round(h)} mirror={side === 1} />
            <b data-testid={`kf-vs-${side + 1}`}>{CHARS[id].name}</b>
            <span>✦ {CHARS[id].abilityName}</span>
            <StatBars char={id} right={side === 1} />
          </div>; })}
          <div className="kf-versus-mid" aria-hidden="true"><strong>VS</strong></div>
        </div>
        <div className="kf-actions">
          <button type="button" className="kf-secondary" onClick={() => { setPick(1); setCursor(CHAR_IDS.indexOf(p2)); setScreen('select'); }}>‹ Volver</button>
          <button type="button" onClick={() => setScreen('stage')} autoFocus>Seleccionar escenario ▶</button>
        </div>
      </div>}
      {selecting && <div className="kf-select" role="dialog" aria-labelledby="kf-title" style={{ backgroundImage: `radial-gradient(ellipse at 50% 45%, #0000 55%, #00000080 100%), url(${spaceURL() ?? ''})`, backgroundSize: 'auto, cover', backgroundPosition: 'center', backgroundColor: '#03020c' }}>
        <h2 id="kf-title">{mode === 'versus' ? `JUGADOR ${pick + 1}: ELEGÍ TU LUCHADOR` : pick === 0 ? 'ELEGÍ TU LUCHADOR' : 'ELEGÍ AL RIVAL'}</h2>
        <div className="kf-select-row">
          <div className={`kf-pick kf-pick--1${pick === 0 ? ' kf-pick--active' : ''}`} style={{ ['--kf-c' as string]: CHARS[pick === 0 ? shown : p1].color }}>
            <FighterCard char={pick === 0 ? shown : p1} w={cardW} h={cardH} />
            <b data-testid="kf-pick-1">{CHARS[pick === 0 ? shown : p1].name}</b>
            <small>{mode === 'versus' ? 'J1' : 'VOS'}</small>
            <StatBars char={pick === 0 ? shown : p1} testId="kf-stats-1" attack />
          </div>
          <div className="kf-grid" role="group" aria-label={pick === 0 ? 'Tu luchador' : 'Rival'} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {CHAR_IDS.map((id, i) => {
              const sel1 = pick === 0 ? cursor === i : id === p1, sel2 = pick === 1 && cursor === i;
              return <button key={id} type="button" className={`kf-cell${sel1 ? ' kf-cell--1' : ''}${sel2 ? ' kf-cell--2' : ''}`} aria-label={CHARS[id].name} aria-pressed={cursor === i}
                onClick={() => { if (cursor === i) chooseChar(i); else { setCursor(i); playKfName(id); if (pick === 0) setP1(id); else setP2(id); } }}
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
            {(pick === 1 || mode === 'tournament') && <StatBars char={pick === 1 ? CHAR_IDS[cursor] : chars[1]} right testId="kf-stats-2" attack />}
          </div>
        </div>
        <div className="kf-actions">
          <button type="button" className="kf-secondary" onClick={() => { if (pick === 1) { setPick(0); setCursor(CHAR_IDS.indexOf(p1)); } else setScreen('menu'); }}>‹ Volver</button>
          {pick === 1 && mode === 'cpu' && <button type="button" className="kf-secondary" onClick={() => chooseChar(CHAR_IDS.indexOf(CHAR_IDS.filter(c => c !== p1)[Math.floor(Math.random() * 15)]))}>🎲 Al azar</button>}
          <button type="button" onClick={() => chooseChar(cursor)}>Elegir {CHARS[CHAR_IDS[cursor]].name} ▶</button>
        </div>
        <p className="kf-hint">Flechas para moverte · ENTER para elegir · o tocá la cara (dos veces para elegir)</p>
      </div>}
      {screen !== 'playing' && !selecting && screen !== 'vs' && <div className={`runner-overlay kf-overlay${screen === 'menu' ? ' kf-menu-wall' : ''}`} role="dialog" aria-labelledby="kf-title" style={screen === 'menu' ? { backgroundImage: `radial-gradient(ellipse at 50% 45%, #0000 40%, #000000b3 100%), url(${brokenWallURL() ?? ''})`, backgroundSize: 'auto, cover', backgroundPosition: 'center', backgroundColor: '#151614' } : undefined}>
        <div>
          {screen === 'menu' && <>
            <h2 id="kf-title" className="kf-logo">KOMBAT<br /><span>FOOTBALL</span></h2>
            <p>Fútbol 5 contra 5 con poderes: elegí tu luchador (tu equipo son cinco iguales) y tirale tu poder a los rivales con su combinación: revientan en sangre. Tiros con efecto, penales y el FATAL GOAL. Dos tiempos de 1:30 y gol de oro si empatan.</p>
            <div className="kf-modes">
              <button type="button" onClick={() => { playKfSelectVoice(); setMode('cpu'); setPick(0); setCursor(CHAR_IDS.indexOf(p1)); setScreen('select'); }} autoFocus>Contra la máquina</button>
              <button type="button" onClick={() => { playKfSelectVoice(); setMode('versus'); setPick(0); setCursor(CHAR_IDS.indexOf(p1)); setScreen('select'); }}>2 jugadores</button>
              <button type="button" onClick={() => { playKfSelectVoice(); setMode('tournament'); setRound(0); setLadderFrom(0); setPick(0); setCursor(CHAR_IDS.indexOf(p1)); setScreen('select'); }}>Torneo</button>
            </div>
          </>}
          {screen === 'stage' && <>
            <h2 id="kf-title" className="kf-title-mk">ELEGÍ EL ESCENARIO</h2>
            <div className="kf-stagegrid" role="group" aria-label="Escenario">
              {STAGES.map(s => <button key={s.id} type="button" className={stage === s.id ? 'kf-chosen' : ''} aria-pressed={stage === s.id} onClick={() => { if (stage === s.id) setScreen('howto'); else setStage(s.id); }}>
                <StageThumb stage={s.id} w={180} h={84} /><b>{s.name}</b>
              </button>)}
            </div>
            {mode === 'cpu' && <div className="kf-diff" role="group" aria-label="Dificultad">{DIFFICULTY.map((d, i) => <button key={d.name} type="button" className={difficulty === i ? 'kf-chosen' : ''} aria-pressed={difficulty === i} onClick={() => setDifficulty(i)}>{d.name}</button>)}</div>}
            <div className="kf-actions">
              <button type="button" className="kf-secondary" onClick={() => setScreen('vs')}>‹ Volver</button>
              <button type="button" onClick={() => setScreen('howto')}>Siguiente ▶</button>
            </div>
          </>}
          {screen === 'howto' && <>
            <h2 id="kf-title" className="kf-title-mk">CONTROLES</h2>
            <p className="kf-note">{CHARS[chars[0]].name} vs {CHARS[chars[1]].name} · {STAGES.find(s => s.id === (mode === 'tournament' ? TOURNAMENT_STAGES[round] : stage))!.name}</p>
            <div className="kf-howto">{howto(0)}{mode === 'versus' && howto(1)}</div>
            <p className="kf-note">La barra de arriba muestra si tu <b>poder</b> está listo; la de <b>PODER</b> de abajo se llena jugando (pases, tiros, quites, poderes que pegan) y llena habilita el FATAL GOAL. La cancha está cerrada por carteles: la pelota rebota y nunca sale.</p>
            <div className="kf-actions">
              <button type="button" className="kf-secondary" onClick={() => setScreen(mode === 'tournament' ? 'ladder' : 'stage')}>‹ Volver</button>
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
                ? <button type="button" onClick={() => { const n = round + 1; setLadderFrom(round); setRound(n); setScreen('ladder'); }} autoFocus>Siguiente rival ▶</button>
                : <button type="button" onClick={() => begin(round)} autoFocus>{mode === 'tournament' ? 'Reintentar el partido' : 'Revancha'}</button>}
            </div>
          </>}
          {screen === 'champion' && <>
            <Fireworks />
            <h2 id="kf-title" className="end-banner end-banner--win">🏆 ¡CAMPEÓN!</h2>
            <p>Le ganaste a los {TOURNAMENT} rivales del torneo con {CHARS[chars[0]].name}.</p>
            <div className="kf-actions"><button type="button" onClick={() => { setRound(0); setScreen('menu'); }} autoFocus>VOLVER A JUGAR</button></div>
          </>}
        </div>
      </div>}
    </div>
    {playing && mode !== 'versus' && <GamePad className="kf-pad" action={{ hold: hold('kick'), label: 'Patear' }} actionLabel="⚽" dirs={{ left: { hold: hold('left'), aria: 'Izquierda' }, right: { hold: hold('right'), aria: 'Derecha' }, up: { hold: hold('up'), aria: 'Arriba' }, down: { hold: hold('down'), aria: 'Abajo' } }} extra={<>
      <button type="button" className="kf-cast" aria-label="Pasar" {...hold('pass')}>⇄</button>
      <button type="button" className={`kf-cast${hud?.sides[0].ready || hud?.sides[0].fatal ? '' : ' kf-cast--off'}${hud?.sides[0].fatal ? ' kf-cast--fatal' : ''}`} aria-label="Poder" {...hold('power')}>{hud?.sides[0].fatal ? '☠' : '✦'}</button>
    </>} />}
  </section>;
}
