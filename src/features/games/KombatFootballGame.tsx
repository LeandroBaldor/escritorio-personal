import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BALLS, CHARS, CHAR_IDS, COST, HALF_TIME, MOVE_NAME, POWERS, POWER_MAX, STAGES, STAMINA, TOURNAMENT, attackDir, clockText, comboKeys, movesReady, newMatch, noInput, step, takeEvents,
  type CharId, type Input, type Match, type Move, type StageId,
} from './kombat';
import { drawMatch, viewFor } from './kombatArt';
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
type Screen = 'menu' | 'select' | 'rival' | 'playing' | 'paused' | 'result' | 'champion';
const DIFFICULTY = [{ name: 'Fácil', level: 0.2 }, { name: 'Normal', level: 0.55 }, { name: 'Difícil', level: 0.9 }];
const TOURNAMENT_STAGES: StageId[] = ['city', 'factory', 'glacier', 'lab', 'volcano', 'graveyard', 'storm', 'desert', 'space', 'arena'];
// Rival y dificultad de cada partido del torneo (cada vez más difícil).
function tournamentRival(you: CharId, n: number): CharId { const others = CHAR_IDS.filter(c => c !== you); return others[n % others.length]; }
const tournamentLevel = (n: number) => 0.2 + n * 0.08;

// Teclas: un jugador con las flechas y ESPACIO (también WASD); dos jugadores: J1 con WASD + ESPACIO y J2 con
// las flechas + ENTER.
type Key = 'left' | 'right' | 'up' | 'down' | 'kick';
const KEYS_SOLO: Record<string, Key> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', ' ': 'kick', a: 'left', d: 'right', w: 'up', s: 'down' };
const KEYS_P1: Record<string, Key> = { a: 'left', d: 'right', w: 'up', s: 'down', ' ': 'kick' };
const KEYS_P2: Record<string, Key> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Enter: 'kick' };
const MOVES: Move[] = ['shot', 'defense', 'attack', 'fatal'];
const MOVE_ICON: Record<Move, string> = { shot: '⚡', defense: '🛡', attack: '👊', fatal: '☠' };
const NEW_AT: Move[][] = [[], ['shot', 'defense'], ['attack'], ['fatal']]; // qué se desbloquea en cada nivel de poder
const kickLabel = (mode: Mode, side: 0 | 1) => mode === 'versus' && side === 1 ? 'ENTER' : 'ESPACIO';
// Las flechas del J1 en dos jugadores son WASD.
const wasd = (k: string) => ({ '←': 'A', '→': 'D', '↑': 'W', '↓': 'S' } as Record<string, string>)[k] ?? k;
function comboOf(mv: Move, dir: 1 | -1, mode: Mode, side: 0 | 1) {
  const keys = comboKeys(mv, dir).map(k => mode === 'versus' && side === 0 ? wasd(k) : k);
  return [...keys, kickLabel(mode, side)];
}
const moveLabel = (c: CharId, mv: Move) => mv === 'shot' ? CHARS[c].shot : mv === 'defense' ? CHARS[c].defense : mv === 'attack' ? CHARS[c].attack : CHARS[c].fatal;

interface Side { stamina: number; power: number; ready: Move[]; dir: 1 | -1; powers: string[]; tired: boolean }
interface Hud { score: [number, number]; clock: string; half: string; extra: boolean; sides: [Side, Side]; ball: string | null; intro: boolean }
const hudOf = (m: Match): Hud => ({
  score: [m.fighters[0].goals, m.fighters[1].goals], clock: m.extra ? 'GOL DE ORO' : clockText(m.clock), half: m.extra ? 'EXTRA' : m.half === 1 ? '1T' : '2T', extra: m.extra,
  sides: m.fighters.map(f => ({
    stamina: Math.round(f.stamina), power: Math.floor(f.power), ready: movesReady(f), dir: attackDir(m, f.side),
    powers: (Object.keys(f.powers) as (keyof typeof POWERS)[]).map(k => POWERS[k].name), tired: f.stamina < 20,
  })) as [Side, Side],
  ball: m.ball.kind === 'normal' ? null : BALLS[m.ball.kind].name,
  intro: m.phase === 'intro' && m.half === 1 && !m.extra && m.time < 2.4,
});
const sameHud = (a: Hud, b: Hud) => JSON.stringify(a) === JSON.stringify(b);

interface Shout { id: number; text: string; sub?: string; kind: 'goal' | 'fatal' | 'info' | 'block' | 'extra' }
interface PowerBanner { id: number; side: 0 | 1; moves: Move[]; dir: 1 | -1 }

// Un retrato chiquito (la cabeza) dibujado en su propio canvas.
function Portrait({ char, size, mirror = false }: { char: CharId; size: number; mirror?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const k = window.devicePixelRatio || 1; c.width = size * k; c.height = size * k;
    const ctx = c.getContext('2d'); if (!ctx) return;
    ctx.setTransform(k, 0, 0, k, 0, 0); drawPortrait(ctx, char, size, 0, mirror);
  }, [char, size, mirror]);
  return <canvas ref={ref} className="kf-portrait" style={{ width: size, height: size }} aria-hidden="true" />;
}
// El luchador entero, respirando, para elegir personaje.
function FighterCard({ char, w = 120, h = 150 }: { char: CharId; w?: number; h?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const k = window.devicePixelRatio || 1; c.width = w * k; c.height = h * k;
    const ctx = c.getContext('2d'); if (!ctx) return;
    let frame = 0; const t0 = performance.now();
    const draw = (now: number) => { ctx.setTransform(k, 0, 0, k, 0, 0); drawFighterCard(ctx, char, w, h, (now - t0) / 1000); frame = requestAnimationFrame(draw); };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [char, w, h]);
  return <canvas ref={ref} style={{ width: w, height: h }} aria-hidden="true" />;
}
// Las teclas de una combinación, como teclitas.
const Keys = ({ keys }: { keys: string[] }) => <span className="kf-combo">{keys.map((k, i) => <span key={i}>{i > 0 && <i>+</i>}<kbd>{k}</kbd></span>)}</span>;

export function KombatFootball() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const matchRef = useRef<Match | null>(null);
  const inputs = useRef<[Input, Input]>([noInput(), noInput()]);
  const [screen, setScreen] = useState<Screen>('menu');
  const [mode, setMode] = useState<Mode>('cpu');
  const [p1, setP1] = useState<CharId>('venox');
  const [p2, setP2] = useState<CharId>('blazehorn');
  const [randomRival, setRandomRival] = useState(false);
  const [stage, setStage] = useState<StageId>('city');
  const [difficulty, setDifficulty] = useState(1);
  const [round, setRound] = useState(0); // partido del torneo (0 a 9)
  const [hud, setHud] = useState<Hud | null>(null);
  const [shouts, setShouts] = useState<Shout[]>([]);
  const [banner, setBanner] = useState<PowerBanner | null>(null);
  const [record, setRecord] = useState(readKombatRecord);
  const [result, setResult] = useState<{ winner: 0 | 1; score: [number, number] } | null>(null);
  const [fighting, setFighting] = useState<[CharId, CharId]>(['venox', 'blazehorn']);
  const [stageName, setStageName] = useState('');
  const screenRef = useRef(screen); useEffect(() => { screenRef.current = screen; }, [screen]);
  const modeRef = useRef(mode); useEffect(() => { modeRef.current = mode; }, [mode]);
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
  const demoStage = screen === 'rival' ? stage : 'city';
  useLayoutEffect(() => {
    if (screen !== 'menu' && screen !== 'select' && screen !== 'rival') return;
    const m = newMatch(demoStage, [p1, mode === 'tournament' ? tournamentRival(p1, round) : p2], [0.6, 0.6]);
    m.phase = 'play';
    matchRef.current = m;
    let frame = 0, last = performance.now();
    const tick = (now: number) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; step(m, [noInput(), noInput()], dt); takeEvents(m); if (m.phase === 'end' || m.phase === 'halftime' || (m.phase === 'goal' && m.phaseT > 2)) { m.phase = 'play'; m.clock = HALF_TIME; } paint(); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    const observer = new ResizeObserver(paint); if (stageRef.current) observer.observe(stageRef.current);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [screen, demoStage, p1, p2, mode, round, paint]);

  const begin = useCallback((n = round) => {
    playStart(); preloadKombatSounds();
    const st = mode === 'tournament' ? TOURNAMENT_STAGES[n] : stage;
    const rival = mode === 'tournament' ? tournamentRival(p1, n) : mode === 'cpu' && randomRival ? CHAR_IDS.filter(c => c !== p1)[Math.floor(Math.random() * 4)] : p2;
    const level = mode === 'tournament' ? tournamentLevel(n) : DIFFICULTY[difficulty].level;
    const m = newMatch(st, [p1, rival], [null, mode === 'versus' ? null : level]);
    matchRef.current = m; setFighting([p1, rival]);
    inputs.current = [noInput(), noInput()];
    setHud(hudOf(m)); setResult(null); setShouts([]); setBanner(null);
    const def = STAGES.find(s => s.id === st)!;
    setStageName(`${mode === 'tournament' ? `Torneo · Partido ${n + 1}/${TOURNAMENT} · ` : ''}${def.name}`);
    setScreen('playing');
  }, [mode, stage, p1, p2, randomRival, difficulty, round]);

  // El partido.
  useEffect(() => {
    if (screen !== 'playing') { setCrowd(0); return; }
    setCrowd(1);
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
          case 'move':
            if (e.move === 'fatal') { playKfFatal(); shout('FATAL GOAL', 'fatal', `${CHARS[e.char].name}: ${CHARS[e.char].fatal}`, 1700); }
            else { playKfPower(e.char, e.move === 'defense'); shout(moveLabel(e.char, e.move), 'block', `${CHARS[e.char].name} · ${MOVE_NAME[e.move]}`, 1100); }
            break;
          case 'fatalBlocked': playExplosion(); shout('¡BLOQUEADO!', 'block', 'Frenó el FATAL GOAL', 1500); break;
          case 'goal': playGoal(); shout(e.fatal ? '☠ FATAL GOAL ☠' : '¡GOL!', e.fatal ? 'fatal' : 'goal', `${CHARS[m.fighters[e.side].char].name} ${m.fighters[0].goals} - ${m.fighters[1].goals}`, 2400); break;
          case 'save': playKfBlock(); shout(e.caught ? '¡LA ATAJÓ!' : '¡ATAJADA!', 'block', undefined, 900); break;
          case 'refDown': shout('¡ÁRBITRO KO!', 'block', 'Vuelve en unos segundos', 1300); break;
          case 'power': playKfPickup(); shout(`${who(e.side)}: ${POWERS[e.kind].name}`, 'info', POWERS[e.kind].text, 2200); break;
          case 'ballKind': if (e.kind !== 'normal') { playKfPickup(); shout(BALLS[e.kind].name, 'info', BALLS[e.kind].text, 2600); } break;
          case 'unlock':
            if (human(e.side)) { playKfPickup(); const id = ++bannerId; setBanner({ id, side: e.side, moves: NEW_AT[e.level] ?? [], dir: attackDir(m, e.side) }); setTimeout(() => setBanner(b => b && b.id === id ? null : b), 3600); }
            break;
          case 'tired': if (human(e.side) && tiredT <= 0) { tiredT = 9; shout('¡Sin energía!', 'info', 'Caminá o quedate quieto un momento para recuperarla', 2400); } break;
          case 'far': if (human(e.side)) shout('¡Acercate a la pelota!', 'info', 'El tiro especial se hace con la pelota al lado', 1800); break;
          case 'trap': if (e.kind === 'laser') playLaserOn(); break;
          case 'boom': playExplosion(); break;
          case 'thunder': playThunder(0.7); break;
          case 'zap': playLaserOn(); break;
          case 'whistle': playRefWhistle(e.kind); if (e.kind === 'kickoff' && m.phaseT < 0.1 && m.fighters[0].goals + m.fighters[1].goals === 0 && !m.extra) shout(m.half === 1 ? '¡A JUGAR!' : 'SEGUNDO TIEMPO', 'extra', undefined, 1100); break;
          case 'halftime': {
            const d = -attackDir(m, 0);
            shout('ENTRETIEMPO', 'extra', `Cambio de lado: ${modeRef.current === 'versus' ? 'J1' : 'ahora'} ataca${modeRef.current === 'versus' ? '' : 's'} hacia la ${d > 0 ? 'derecha ▶' : '◀ izquierda'}`, 3000);
            break;
          }
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

  // Teclado.
  useEffect(() => {
    const map = (key: string): [0 | 1, Key] | null => {
      const k = key.length === 1 ? key.toLowerCase() : key;
      if (modeRef.current === 'versus') { if (KEYS_P1[k]) return [0, KEYS_P1[k]]; if (KEYS_P2[k]) return [1, KEYS_P2[k]]; return null; }
      return KEYS_SOLO[k] ? [0, KEYS_SOLO[k]] : null;
    };
    const down = (e: KeyboardEvent) => {
      const s = screenRef.current;
      if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && (s === 'playing' || s === 'paused')) { setScreen(s === 'playing' ? 'paused' : 'playing'); return; }
      const hit = map(e.key);
      if (!hit || s !== 'playing') return;
      e.preventDefault();
      inputs.current[hit[0]][hit[1]] = true;
    };
    const up = (e: KeyboardEvent) => { const hit = map(e.key); if (hit) inputs.current[hit[0]][hit[1]] = false; };
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

  const chars: [CharId, CharId] = screen === 'playing' || screen === 'paused' || screen === 'result' || screen === 'champion' ? fighting : [p1, p2];
  const tester = isTester();
  const isHuman = (i: 0 | 1) => mode === 'versus' || i === 0;
  const sideBar = (i: 0 | 1) => {
    const s = hud?.sides[i], c = CHARS[chars[i]], power = s?.power ?? 0, stamina = s?.stamina ?? STAMINA;
    const staminaColor = stamina > 55 ? '#22c55e' : stamina > 25 ? '#facc15' : '#ef4444';
    return <div className={`kf-side kf-side--${i}`} data-testid={`kf-side-${i}`}>
      <Portrait char={chars[i]} size={46} mirror={i === 1} />
      <div className="kf-bars">
        <strong style={{ color: c.color }}>{c.name}{mode === 'versus' ? ` (J${i + 1})` : i === 0 ? ' (vos)' : ' (máquina)'}</strong>
        <div className={`kf-energy${s?.tired ? ' kf-energy--low' : ''}`} role="meter" aria-valuemin={0} aria-valuemax={STAMINA} aria-valuenow={stamina} aria-label={`Energía ${stamina} de ${STAMINA}`} title="Energía: correr, saltar, patear y recibir golpes la gastan; quieto se recupera">
          <i style={{ width: `${stamina}%`, background: `linear-gradient(90deg, ${staminaColor}, ${staminaColor}cc)` }} />
          <b>ENERGÍA</b>
        </div>
        <div className={`kf-power${power >= POWER_MAX ? ' kf-power--full' : ''}`} aria-label={`Poder nivel ${Math.floor(power / 100)} de 3`} title="Poder: se carga jugando; cada nivel habilita una jugada especial">
          {[0, 1, 2].map(k => <i key={k} className={power >= (k + 1) * 100 ? 'kf-on' : ''}><u style={{ width: `${Math.max(0, Math.min(100, power - k * 100))}%` }} /></i>)}
        </div>
        <div className="kf-skills">
          {isHuman(i) && s?.ready.map(mv => <span key={mv} className="kf-ready" title={`${MOVE_NAME[mv]}: ${moveLabel(chars[i], mv)}`}>{MOVE_ICON[mv]} <Keys keys={comboOf(mv, s.dir, mode, i)} /></span>)}
          {s?.powers.map(p => <em key={p}>{p}</em>)}
        </div>
      </div>
    </div>;
  };

  const stat = (label: string, v: number) => <div className="kf-stat"><span>{label}</span><i><u style={{ width: `${Math.round(Math.max(0.08, Math.min(1, (v - 0.8) / 0.45)) * 100)}%` }} /></i></div>;
  const charPicker = (value: CharId, set: (c: CharId) => void, label: string, extra?: React.ReactNode) => <div className="kf-chars" role="group" aria-label={label}>
    {CHAR_IDS.map(id => <button key={id} type="button" className={value === id ? 'kf-chosen' : ''} aria-pressed={value === id} onClick={() => set(id)} style={{ ['--kf-c' as string]: CHARS[id].color }} aria-label={`${CHARS[id].name}: ${CHARS[id].element}`}>
      <FighterCard char={id} />
      <b>{CHARS[id].name}</b><small>{CHARS[id].element}</small>
    </button>)}
    {extra}
  </div>;
  const charInfo = (id: CharId) => { const c = CHARS[id]; return <div className="kf-detail" style={{ ['--kf-c' as string]: c.color }}>
    <div className="kf-detail-head"><b>{c.name}</b><small>{c.element}</small><p>{c.bio}</p></div>
    <div className="kf-stats">{stat('Velocidad', c.speed)}{stat('Potencia', c.power)}{stat('Salto', c.jump)}{stat('Resistencia', c.stamina)}</div>
    <ul className="kf-info">
      {MOVES.map(mv => <li key={mv}><span className="kf-move">{MOVE_ICON[mv]} {MOVE_NAME[mv]} <em>{COST[mv] / 100} {COST[mv] > 100 ? 'niveles' : 'nivel'}</em></span> <Keys keys={comboOf(mv, 1, mode === 'versus' ? 'cpu' : mode, 0)} /> <b>{moveLabel(id, mv)}:</b> {mv === 'shot' ? c.shotText : mv === 'defense' ? c.defenseText : mv === 'attack' ? c.attackText : c.fatalText}</li>)}
    </ul>
  </div>; };
  const keysHelp = mode === 'versus'
    ? <p className="runner-keys kf-keys">J1: <kbd>A</kbd><kbd>D</kbd> correr · <kbd>W</kbd> saltar · <kbd>S</kbd> bloquear · <kbd>Espacio</kbd> patear<br />J2: <kbd>←</kbd><kbd>→</kbd> correr · <kbd>↑</kbd> saltar · <kbd>↓</kbd> bloquear · <kbd>Enter</kbd> patear<br />Jugadas especiales: flechas hacia adelante/atrás + patear (adelante = hacia el arco rival). <kbd>Esc</kbd> pausa</p>
    : <p className="runner-keys kf-keys"><kbd>←</kbd><kbd>→</kbd> correr · <kbd>↑</kbd> saltar · <kbd>↓</kbd> bloquear · <kbd>Espacio</kbd> patear (con <kbd>↑</kbd> globo, con <kbd>↓</kbd> rasante; corriendo con <kbd>↓</kbd> barrida) · <kbd>Esc</kbd> pausa<br />Cuando se carga el poder aparece el cartel <b>PODER ESPECIAL</b> con la combinación (adelante = hacia el arco rival).</p>;

  const playing = screen === 'playing' || screen === 'paused';
  const padSide = hud?.sides[0];
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
          <div data-testid="kf-score">{hud.score[0]} - {hud.score[1]}</div>
          <small data-testid="kf-clock" className={hud.extra ? 'kf-golden' : ''}>{hud.extra ? '' : <b>{hud.half}</b>}{hud.clock}</small>
          {hud.ball && <em>{hud.ball}</em>}
        </div>
        {sideBar(1)}
      </div>}
      {playing && hud?.intro && <div className="kf-vs" aria-hidden="true">
        <div className="kf-vs-side" style={{ ['--kf-c' as string]: CHARS[chars[0]].color }}><Portrait char={chars[0]} size={110} /><b>{CHARS[chars[0]].name}</b></div>
        <div className="kf-vs-mid"><strong>VS</strong><small>{stageName}</small></div>
        <div className="kf-vs-side" style={{ ['--kf-c' as string]: CHARS[chars[1]].color }}><Portrait char={chars[1]} size={110} mirror /><b>{CHARS[chars[1]].name}</b></div>
      </div>}
      {playing && banner && banner.moves.length > 0 && <div key={banner.id} className="kf-unlock" role="status" style={{ ['--kf-c' as string]: CHARS[chars[banner.side]].color }}>
        <b>{mode === 'versus' ? `J${banner.side + 1} · ` : ''}PODER ESPECIAL</b>
        {banner.moves.map(mv => <div key={mv}><span>{MOVE_ICON[mv]} {moveLabel(chars[banner.side], mv)}</span><Keys keys={comboOf(mv, banner.dir, mode, banner.side)} /></div>)}
      </div>}
      {playing && <p className="kf-rotate">📱 Girá el celular para ver la cancha más grande</p>}
      <div className="kf-shouts" aria-live="assertive">
        {shouts.map(s => <div key={s.id} className={`kf-shout kf-shout--${s.kind}`} role="status">{s.text}{s.sub && <small>{s.sub}</small>}</div>)}
      </div>
      {screen !== 'playing' && <div className="runner-overlay kf-overlay" role="dialog" aria-labelledby="kf-title">
        <div>
          {screen === 'menu' && <>
            <h2 id="kf-title" className="kf-logo">KOMBAT<br /><span>FOOTBALL</span></h2>
            <p>Fútbol 1 contra 1 con poderes, golpes y trampas en la cancha. Dos tiempos de 1:30 (en el entretiempo se cambia de lado); si empatan, gol de oro. Cada equipo tiene su arquero y hay un árbitro… al que también le puede tocar.</p>
            <div className="kf-modes">
              <button type="button" onClick={() => { setMode('cpu'); setScreen('select'); }} autoFocus>⚔️ Partido contra la máquina</button>
              <button type="button" onClick={() => { setMode('versus'); setScreen('select'); }}>👥 2 jugadores</button>
              <button type="button" onClick={() => { setMode('tournament'); setRound(0); setScreen('select'); }}>🏆 Torneo: 10 partidos</button>
            </div>
          </>}
          {screen === 'select' && <>
            <h2 id="kf-title">{mode === 'versus' ? 'Jugador 1: elegí tu luchador' : mode === 'tournament' ? 'Torneo: elegí tu luchador' : 'Elegí tu luchador'}</h2>
            {charPicker(p1, setP1, 'Tu luchador')}
            {charInfo(p1)}
            {mode === 'tournament' && <>
              <p className="kf-note">Ganá 10 partidos seguidos, cada uno en un escenario distinto y contra rivales cada vez más difíciles, para ser campeón.{tester ? ' (Modo prueba: podés arrancar desde cualquier partido.)' : ''}</p>
              {(tester || record.best > 0) && <div className="kf-stages kf-rounds" role="group" aria-label="Partido del torneo">
                {TOURNAMENT_STAGES.map((st, n) => { const locked = !tester && n > Math.min(record.best, TOURNAMENT - 1); return <button key={st} type="button" disabled={locked} className={round === n ? 'kf-chosen' : ''} aria-pressed={round === n} onClick={() => setRound(n)}><b>{locked ? '🔒' : n + 1}</b><small>{STAGES.find(s => s.id === st)!.name}</small></button>; })}
              </div>}
              {keysHelp}
            </>}
            <div className="kf-actions">
              <button type="button" className="kf-secondary" onClick={() => setScreen('menu')}>‹ Volver</button>
              {mode === 'tournament'
                ? <button type="button" onClick={() => begin(round)}>¡A jugar!</button>
                : <button type="button" onClick={() => { if (p2 === p1) setP2(CHAR_IDS.find(c => c !== p1)!); setScreen('rival'); }}>Siguiente ▶</button>}
            </div>
          </>}
          {screen === 'rival' && <>
            <h2 id="kf-title">{mode === 'versus' ? 'Jugador 2: elegí tu luchador' : 'Elegí el luchador de la máquina'}</h2>
            {charPicker(p2, c => { setP2(c); setRandomRival(false); }, 'Rival', mode === 'cpu' && <button type="button" className={`kf-random${randomRival ? ' kf-chosen' : ''}`} aria-pressed={randomRival} onClick={() => setRandomRival(r => !r)} style={{ ['--kf-c' as string]: '#a1a1aa' }}><span>🎲</span><b>AL AZAR</b><small>Sorpresa</small></button>)}
            {!randomRival && charInfo(p2)}
            <h3>Escenario</h3>
            <div className="kf-stages" role="group" aria-label="Escenario">
              {STAGES.map(s => <button key={s.id} type="button" className={stage === s.id ? 'kf-chosen' : ''} aria-pressed={stage === s.id} onClick={() => setStage(s.id)} title={s.hazard}><b>{s.name}</b><small>{s.hazard}</small></button>)}
            </div>
            {mode === 'cpu' && <div className="kf-diff" role="group" aria-label="Dificultad">{DIFFICULTY.map((d, i) => <button key={d.name} type="button" className={difficulty === i ? 'kf-chosen' : ''} aria-pressed={difficulty === i} onClick={() => setDifficulty(i)}>{d.name}</button>)}</div>}
            {keysHelp}
            <div className="kf-actions">
              <button type="button" className="kf-secondary" onClick={() => setScreen('select')}>‹ Volver</button>
              <button type="button" onClick={() => begin(0)}>¡A jugar!</button>
            </div>
          </>}
          {screen === 'paused' && <>
            <h2 id="kf-title">Pausa</h2>
            {keysHelp}
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
      {padSide?.ready.map(mv => <button key={mv} type="button" className={`kf-cast kf-cast--${mv}`} aria-label={MOVE_NAME[mv]} onPointerDown={e => { e.preventDefault(); inputs.current[0].cast = mv; }}>{MOVE_ICON[mv]}</button>)}
    </div>}
  </section>;
}
