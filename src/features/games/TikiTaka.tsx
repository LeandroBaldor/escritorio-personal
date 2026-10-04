import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { canShoot, dive, FORMATIONS, GOAL, minute, newMatch, pass, passRisk, PITCH, shoot, shotChance, step, takeEvents, type FormationId, type Match, type MatchEvent, type Side } from './tikiTaka';

// ---------- Equipo guardado y récord ----------
export interface TeamSetup { team: string; coach: string; color: string; formation: FormationId }
const SETUP_KEY = 'escritorio-personal-juegos:tikitaka-equipo';
const RECORD_KEY = 'escritorio-personal-juegos:tikitaka-record';
export interface TikiRecord { played: number; won: number; drawn: number; lost: number; goals: number }
const DEFAULT_SETUP: TeamSetup = { team: 'Los Pibes FC', coach: 'El Profe', color: '#38bdf8', formation: '4-3-3' };
const read = <T,>(key: string, fallback: T): T => { try { const v = JSON.parse(localStorage.getItem(key) ?? 'null'); return v ?? fallback; } catch { return fallback; } };
const write = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento */ } };
export const readTikiRecord = (): TikiRecord => read(RECORD_KEY, { played: 0, won: 0, drawn: 0, lost: 0, goals: 0 });

export const SHIRTS = [
  { color: '#38bdf8', name: 'Celeste' }, { color: '#dc2626', name: 'Rojo' }, { color: '#16a34a', name: 'Verde' }, { color: '#facc15', name: 'Amarillo' },
  { color: '#1d4ed8', name: 'Azul' }, { color: '#7c3aed', name: 'Violeta' }, { color: '#f97316', name: 'Naranja' }, { color: '#111827', name: 'Negro' },
];
const RIVALS = ['Sportivo Empanada', 'Atlético Mate Cocido', 'Deportivo Siesta', 'Real Choripán', 'Juventud Medialuna', 'Unión Fernet', 'Defensores del Asado', 'Racing de la Esquina', 'Huracán del Barrio', 'Estrella del Potrero'];
const hex = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const light = (c: string) => { const [r, g, b] = hex(c); return r * 0.3 + g * 0.59 + b * 0.11 > 150; };
const far = (a: string, b: string) => { const x = hex(a), y = hex(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) > 200; };
const rivalColor = (mine: string) => ['#f8fafc', '#dc2626', '#111827', '#facc15'].find(c => far(c, mine)) ?? '#f8fafc';
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

// ---------- Relator ----------
type Names = { team: string; coach: string; rival: string };
const PHRASES: Record<MatchEvent['type'], string[]> = {
  pass: ['Toca {team}, toca y toca…', '¡Qué pase! {coach} aplaude desde el banco', 'Tiki-taka puro de {team}', 'La pelota va de pie en pie'],
  intercept: ['¡La cortó {rival}!', 'Pase al rival… {coach} se agarra la cabeza'],
  steal: ['¡Se la robaron! Hay que soltarla antes', 'Presión de {rival} y pelota perdida'],
  counter: ['¡Contraataque de {rival}! ¡Elegí dónde tirarte!'],
  cut: ['¡Cierre perfecto de la defensa! {coach} lo festeja'],
  counterSaved: ['¡ATAJADÓN! El arquero de {team} la saca', '¡Voló el arquero! Se salvó {team}'],
  counterGoal: ['Gol de {rival}… {coach} patea un botellón', 'Lo adivinó mal el arquero: gol de {rival}'],
  goal: ['¡GOOOOL DE {team}!', '¡Golazo! {coach} corre por toda la línea de cal'],
  saved: ['¡Atajó el arquero de {rival}!'],
  miss: ['¡Afuera! Pasó cerquita'],
  kickoff: ['Mueve {team}. Tocá a un compañero para pasarle'],
  end: ['¡Terminó el partido!'],
};
const say = (type: MatchEvent['type'], names: Names) => pick(PHRASES[type]).replace('{team}', names.team).replace('{coach}', names.coach).replace('{rival}', names.rival);

// ---------- Dibujo de la cancha ----------
type View = { vertical: boolean; s: number; ox: number; oy: number };
const toScreen = (v: View, x: number, y: number): [number, number] => v.vertical ? [v.ox + y * v.s, v.oy + (PITCH.w - x) * v.s] : [v.ox + x * v.s, v.oy + y * v.s];
const toPitch = (v: View, sx: number, sy: number): [number, number] => v.vertical ? [PITCH.w - (sy - v.oy) / v.s, (sx - v.ox) / v.s] : [(sx - v.ox) / v.s, (sy - v.oy) / v.s];

function drawPitch(ctx: CanvasRenderingContext2D, v: View) {
  const rect = (x: number, y: number, w: number, h: number) => {
    const [ax, ay] = toScreen(v, x, y), [bx, by] = toScreen(v, x + w, y + h);
    return [Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay)] as const;
  };
  for (let i = 0; i < 14; i++) { ctx.fillStyle = i % 2 ? '#2f9e44' : '#37b24d'; ctx.fillRect(...rect(i * PITCH.w / 14, 0, PITCH.w / 14, PITCH.h)); }
  ctx.strokeStyle = '#ffffffd9'; ctx.lineWidth = Math.max(1.5, v.s * 0.25);
  const line = (x: number, y: number, w: number, h: number) => ctx.strokeRect(...rect(x, y, w, h));
  line(0, 0, PITCH.w, PITCH.h);
  ctx.beginPath(); ctx.moveTo(...toScreen(v, PITCH.w / 2, 0)); ctx.lineTo(...toScreen(v, PITCH.w / 2, PITCH.h)); ctx.stroke();
  ctx.beginPath(); ctx.arc(...toScreen(v, PITCH.w / 2, PITCH.h / 2), 9.15 * v.s, 0, Math.PI * 2); ctx.stroke();
  line(0, (PITCH.h - 40.3) / 2, 16.5, 40.3); line(PITCH.w - 16.5, (PITCH.h - 40.3) / 2, 16.5, 40.3);
  line(0, (PITCH.h - 18.3) / 2, 5.5, 18.3); line(PITCH.w - 5.5, (PITCH.h - 18.3) / 2, 5.5, 18.3);
  ctx.fillStyle = '#ffffffd9';
  for (const x of [11, PITCH.w - 11, PITCH.w / 2]) { ctx.beginPath(); ctx.arc(...toScreen(v, x, PITCH.h / 2), Math.max(1.5, v.s * 0.35), 0, Math.PI * 2); ctx.fill(); }
  // arcos con red
  for (const x of [-2, PITCH.w]) {
    ctx.fillStyle = '#ffffff40'; ctx.fillRect(...rect(x, GOAL.top, 2, GOAL.bottom - GOAL.top));
    ctx.strokeStyle = '#fff'; ctx.strokeRect(...rect(x, GOAL.top, 2, GOAL.bottom - GOAL.top));
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, v: View, x: number, y: number, color: string, label: string, ring?: string, dashed = false) {
  const [sx, sy] = toScreen(v, x, y), r = Math.max(7, 1.7 * v.s);
  ctx.fillStyle = '#00000040'; ctx.beginPath(); ctx.ellipse(sx + r * 0.2, sy + r * 0.35, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = Math.max(2, r * 0.22); ctx.setLineDash(dashed ? [r * 0.4, r * 0.3] : []); ctx.beginPath(); ctx.arc(sx, sy, r * 1.55, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
  ctx.fillStyle = color; ctx.strokeStyle = light(color) ? '#1f2937' : '#f8fafc'; ctx.lineWidth = Math.max(1.5, r * 0.15);
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (label) { ctx.fillStyle = light(color) ? '#111827' : '#fff'; ctx.font = `900 ${Math.round(r * 1.05)}px Nunito, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, sx, sy + r * 0.05); }
}

const RISK_COLORS = { safe: '#22c55e', risky: '#f59e0b', blocked: '#ef4444' };

function draw(ctx: CanvasRenderingContext2D, m: Match, v: View, setup: TeamSetup, rival: string, time: number) {
  drawPitch(ctx, v);
  const shooting = canShoot(m);
  if (shooting) {
    const pulse = 0.35 + 0.25 * Math.sin(time * 8);
    ctx.fillStyle = `rgba(250, 204, 21, ${pulse})`;
    const [ax, ay] = toScreen(v, PITCH.w - 3, GOAL.top - 2), [bx, by] = toScreen(v, PITCH.w + 2, GOAL.bottom + 2);
    ctx.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
  }
  drawPlayer(ctx, v, 2.5, PITCH.h / 2, '#a3e635', '1');
  m.rivals.forEach(r => drawPlayer(ctx, v, r.x, r.y, rival, ''));
  drawPlayer(ctx, v, m.keeper.x, m.keeper.y, '#f97316', '');
  m.mine.forEach((p, i) => {
    const holder = i === m.holder;
    const risk = m.phase === 'play' && m.holder !== null && !holder ? passRisk(m, i) : null;
    drawPlayer(ctx, v, p.x, p.y, setup.color, String(p.n), holder ? '#fde047' : risk ? RISK_COLORS[risk] : undefined, risk === 'blocked');
  });
  // pelota (en un tiro se ve más grande a mitad de camino, como si se elevara)
  const lift = m.flight?.to === 'goal' ? Math.sin(Math.min(1, m.flight.t / m.flight.dur) * Math.PI) * 0.6 : 0;
  const [bx, by] = toScreen(v, m.ball.x + (m.holder !== null ? 1.6 : 0), m.ball.y + (m.holder !== null ? 1.2 : 0));
  const br = Math.max(4, 0.9 * v.s) * (1 + lift);
  ctx.fillStyle = '#0000004d'; ctx.beginPath(); ctx.ellipse(bx + br * 0.3, by + br * 0.5 + lift * br, br, br * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111827'; ctx.lineWidth = Math.max(1, br * 0.15);
  ctx.beginPath(); ctx.arc(bx, by - lift * br, br, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.arc(bx, by - lift * br, br * 0.38, 0, Math.PI * 2); ctx.fill();
}

// ---------- Pantalla ----------
type Screen = 'setup' | 'match';
const SIDE_LABELS: Record<Side, string> = { izq: '⬅ Izquierda', medio: '⬆ Medio', der: 'Derecha ➡' };

function FormationPreview({ id, color }: { id: FormationId; color: string }) {
  const counts = FORMATIONS[id];
  return <svg viewBox="0 0 60 40" aria-hidden="true">
    <rect width="60" height="40" rx="3" fill="#2f9e44" /><path d="M30 0v40M0 0h60v40H0z" stroke="#ffffffaa" fill="none" strokeWidth="1" /><circle cx="30" cy="20" r="5" stroke="#ffffffaa" fill="none" strokeWidth="1" />
    <circle cx="4" cy="20" r="2.4" fill="#a3e635" />
    {counts.flatMap((n, i) => Array.from({ length: n }, (_, j) => <circle key={`${i}-${j}`} cx={14 + i * (40 / Math.max(1, counts.length - 1))} cy={40 * (j + 1) / (n + 1)} r="2.6" fill={color} stroke="#fff" strokeWidth=".6" />))}
  </svg>;
}

export function TikiTaka() {
  const [setup, setSetup] = useState<TeamSetup>(() => ({ ...DEFAULT_SETUP, ...read<Partial<TeamSetup>>(SETUP_KEY, {}) }));
  const [screen, setScreen] = useState<Screen>('setup');
  const [rival, setRival] = useState(() => pick(RIVALS));
  const [hud, setHud] = useState({ minute: 0, mine: 0, rival: 0, phase: 'play' as Match['phase'], canShoot: false, chance: 0, counter: null as Match['counter'], passes: 0, shots: 0 });
  const [line, setLine] = useState('');
  const [celebrate, setCelebrate] = useState(false);
  const [record, setRecord] = useState(readTikiRecord);
  const matchRef = useRef<Match | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<View>({ vertical: false, s: 1, ox: 0, oy: 0 });
  const rivalShirt = rivalColor(setup.color);
  const names: Names = { team: setup.team.trim() || DEFAULT_SETUP.team, coach: setup.coach.trim() || DEFAULT_SETUP.coach, rival };

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const start = (e?: React.FormEvent) => {
    e?.preventDefault();
    write(SETUP_KEY, setup);
    matchRef.current = newMatch(setup.formation);
    setLine(say('kickoff', names));
    setCelebrate(false);
    setScreen('match');
  };

  const paint = useCallback(() => {
    const stage = stageRef.current, canvas = canvasRef.current, m = matchRef.current;
    if (!stage || !canvas || !m) return;
    const w = stage.clientWidth, h = stage.clientHeight, dpr = window.devicePixelRatio || 1;
    const vertical = w < h * 0.95;
    const fieldW = (vertical ? PITCH.h : PITCH.w) + 6, fieldH = (vertical ? PITCH.w : PITCH.h) + 6;
    const s = Math.min(w / fieldW, h / fieldH);
    const v: View = { vertical, s, ox: (w - (vertical ? PITCH.h : PITCH.w) * s) / 2, oy: (h - (vertical ? PITCH.w : PITCH.h) * s) / 2 };
    viewRef.current = v;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = `${w}px`; canvas.style.height = `${h}px`; }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    draw(ctx, m, v, setup, rivalShirt, performance.now() / 1000);
  }, [setup, rivalShirt]);

  useLayoutEffect(() => {
    if (screen !== 'match') return;
    const observer = new ResizeObserver(paint);
    if (stageRef.current) observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [screen, paint]);

  // Bucle del partido.
  useEffect(() => {
    if (screen !== 'match') return;
    let frame = 0, last = performance.now(), paused = false;
    const tick = (now: number) => {
      const m = matchRef.current;
      if (!m) return;
      const dt = paused ? 0 : Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      step(m, dt);
      for (const event of takeEvents(m)) {
        if (event.type === 'pass' && Math.random() > 0.35) continue; // el relator no comenta cada pase
        setLine(say(event.type, names));
        if (event.type === 'goal') { setCelebrate(true); setTimeout(() => setCelebrate(false), 2000); }
        if (event.type === 'end') {
          const r = readTikiRecord();
          const next = { played: r.played + 1, won: r.won + (m.goals.mine > m.goals.rival ? 1 : 0), drawn: r.drawn + (m.goals.mine === m.goals.rival ? 1 : 0), lost: r.lost + (m.goals.mine < m.goals.rival ? 1 : 0), goals: r.goals + m.goals.mine };
          write(RECORD_KEY, next); setRecord(next);
        }
      }
      setHud(prev => {
        const next = { minute: minute(m), mine: m.goals.mine, rival: m.goals.rival, phase: m.phase, canShoot: canShoot(m), chance: canShoot(m) ? Math.round(shotChance(m) * 10) * 10 : 0, counter: m.counter && { ...m.counter }, passes: m.stats.passes, shots: m.stats.shots };
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
      paint();
      if (m.phase !== 'end') frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hide = () => { paused = document.hidden; };
    document.addEventListener('visibilitychange', hide);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', hide); };
  }, [screen, paint]); // eslint-disable-line react-hooks/exhaustive-deps

  const tryShoot = () => { const m = matchRef.current; if (m) shoot(m); };
  const tryDive = (side: Side) => { const m = matchRef.current; if (m) dive(m, side); };

  useEffect(() => {
    if (screen !== 'match') return;
    const key = (e: KeyboardEvent) => {
      const sides: Record<string, Side> = { ArrowLeft: 'izq', ArrowUp: 'medio', ArrowRight: 'der' };
      if (sides[e.key] && matchRef.current?.phase === 'counter') { e.preventDefault(); tryDive(sides[e.key]); }
      if ((e.key === ' ' || e.key === 'Enter') && matchRef.current && canShoot(matchRef.current)) { e.preventDefault(); tryShoot(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [screen]);

  // Tocar la cancha: a un compañero le pasa la pelota; al arco, patea.
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const m = matchRef.current;
    if (!m || m.phase !== 'play') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const [x, y] = toPitch(viewRef.current, e.clientX - rect.left, e.clientY - rect.top);
    if (x > PITCH.w - 8 && y > GOAL.top - 8 && y < GOAL.bottom + 8 && canShoot(m)) { shoot(m); return; }
    let best = -1, bestDist = 6;
    m.mine.forEach((p, i) => { const d = Math.hypot(p.x - x, p.y - y); if (i !== m.holder && d < bestDist) { bestDist = d; best = i; } });
    if (best >= 0) pass(m, best);
  };

  const rematch = () => { setRival(pick(RIVALS.filter(r => r !== rival))); setTimeout(() => start(), 0); };
  const result = hud.mine > hud.rival ? 'won' : hud.mine < hud.rival ? 'lost' : 'drawn';
  const c = hud.counter;

  return <section className="runner tt" aria-label="Tiki-Taka">
    <div className="runner-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1>Tiki-Taka</h1>
      {screen === 'match' && <div className="tt-score" aria-live="polite">
        <span className="tt-team"><i style={{ background: setup.color }} />{names.team}</span>
        <strong data-testid="tt-score">{hud.mine} - {hud.rival}</strong>
        <span className="tt-team"><i style={{ background: rivalShirt }} />{rival}</span>
        <span className="tt-minute">{hud.minute}'</span>
      </div>}
    </div>

    {screen === 'setup' && <form className="tt-setup" onSubmit={start}>
      <h2>Armá tu equipo</h2>
      <div className="tt-fields">
        <label>Nombre del equipo<input value={setup.team} maxLength={24} onChange={e => setSetup({ ...setup, team: e.target.value })} /></label>
        <label>Nombre del DT<input value={setup.coach} maxLength={24} onChange={e => setSetup({ ...setup, coach: e.target.value })} /></label>
      </div>
      <fieldset className="tt-shirts"><legend>Camiseta</legend>
        {SHIRTS.map(s => <button key={s.color} type="button" aria-label={s.name} aria-pressed={setup.color === s.color} style={{ background: s.color }} onClick={() => setSetup({ ...setup, color: s.color })} />)}
      </fieldset>
      <fieldset className="tt-formations"><legend>Formación</legend>
        {(Object.keys(FORMATIONS) as FormationId[]).map(id => <button key={id} type="button" aria-pressed={setup.formation === id} onClick={() => setSetup({ ...setup, formation: id })}>
          <FormationPreview id={id} color={setup.color} /><span>{id}</span>
        </button>)}
      </fieldset>
      <p className="tt-tip">Con más defensores cortás más contraataques y tenés más tiempo para atajar. Con más volantes y delanteros, más opciones de pase cerca del arco.</p>
      <p className="tt-rival">Hoy juegan contra <strong>{rival}</strong></p>
      <button type="submit" className="tt-go">¡A la cancha! ⚽</button>
      {record.played > 0 && <p className="tt-record">Tu campaña: {record.won} ganados, {record.drawn} empatados, {record.lost} perdidos · {record.goals} goles</p>}
    </form>}

    {screen === 'match' && <>
      <div className="tt-stage" ref={stageRef}>
        <canvas ref={canvasRef} onPointerDown={onPointerDown} role="img" aria-label="Cancha" />
        {celebrate && <div className="tt-goal" aria-hidden="true"><span>¡GOOOL!</span><small>{names.team}</small></div>}
        {hud.phase === 'counter' && c && <div className="tt-counter" role="dialog" aria-labelledby="tt-counter-title">
          <div>
            <h2 id="tt-counter-title">{c.result === 'cut' ? '¡La cortó tu defensa!' : c.result === 'saved' ? '¡ATAJASTE!' : c.result === 'goal' ? `Gol de ${rival}` : `¡Contraataque de ${rival}!`}</h2>
            {!c.result && <>
              <p>¿Para dónde se tira el arquero?</p>
              <div className="tt-timer"><span key={c.window} style={{ animationDuration: `${c.window + Math.max(0, -c.t)}s` }} /></div>
              <div className="tt-sides">{(['izq', 'medio', 'der'] as Side[]).map(side => <button key={side} type="button" onClick={() => tryDive(side)}>{SIDE_LABELS[side]}</button>)}</div>
            </>}
            {c.result && c.result !== 'cut' && <p>El rival pateó a la {c.dir === 'medio' ? 'del medio' : c.dir === 'izq' ? 'izquierda' : 'derecha'}{c.chosen ? ` y te tiraste a la ${c.chosen === 'medio' ? 'del medio' : c.chosen === 'izq' ? 'izquierda' : 'derecha'}` : ' y no llegaste a tirarte'}.</p>}
          </div>
        </div>}
        {hud.phase === 'end' && <div className="runner-overlay" role="dialog" aria-labelledby="tt-end">
          <div>
            <h2 id="tt-end">{result === 'won' ? `¡Ganó ${names.team}!` : result === 'lost' ? `Ganó ${rival}` : '¡Empate!'}</h2>
            <p className="tt-final">{names.team} {hud.mine} - {hud.rival} {rival}</p>
            <p>{result === 'won' ? `${names.coach} sale en andas.` : result === 'lost' ? `${names.coach} ya piensa en la revancha.` : `${names.coach} dice que el punto sirve.`} {hud.passes} pases y {hud.shots} tiros.</p>
            <div className="tt-end-actions"><button type="button" onClick={rematch} autoFocus>Revancha</button><button type="button" onClick={() => setScreen('setup')}>Cambiar equipo</button></div>
          </div>
        </div>}
      </div>
      <div className="tt-bottom">
        <p className="tt-line" aria-live="polite">🎙️ {line}</p>
        <button type="button" className="tt-shoot" disabled={!hud.canShoot} onClick={tryShoot}>¡Patear!{hud.canShoot && <small>{hud.chance}%</small>}</button>
      </div>
      <p className="tt-help">Tocá a un compañero para pasarle. Anillo verde: pase seguro · amarillo: arriesgado · rojo: lo cortan. Cerca del arco, ¡patear!</p>
    </>}
  </section>;
}
