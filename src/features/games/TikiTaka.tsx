import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { KITS, kitById, paintKit, rivalKit, type Kit } from './kits';
import { canShoot, chase, dive, FORMATIONS, GOAL, minute, newMatch, pass, passRisk, PITCH, shoot, shotChance, startSecondHalf, step, takeEvents, type FormationId, type Match, type MatchEvent, type Side } from './tikiTaka';

// ---------- Equipo guardado y récord ----------
export interface TeamSetup { team: string; coach: string; country: string; formation: FormationId }
const SETUP_KEY = 'escritorio-personal-juegos:tikitaka-equipo';
const RECORD_KEY = 'escritorio-personal-juegos:tikitaka-record';
export interface TikiRecord { played: number; won: number; drawn: number; lost: number; goals: number }
const DEFAULT_SETUP: TeamSetup = { team: 'Los Pibes FC', coach: 'El Profe', country: 'arg', formation: '4-3-3' };
const read = <T,>(key: string, fallback: T): T => { try { const v = JSON.parse(localStorage.getItem(key) ?? 'null'); return v ?? fallback; } catch { return fallback; } };
const write = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento */ } };
export const readTikiRecord = (): TikiRecord => read(RECORD_KEY, { played: 0, won: 0, drawn: 0, lost: 0, goals: 0 });

const RIVALS = ['Sportivo Empanada', 'Atlético Mate Cocido', 'Deportivo Siesta', 'Real Choripán', 'Juventud Medialuna', 'Unión Fernet', 'Defensores del Asado', 'Racing de la Esquina', 'Huracán del Barrio', 'Estrella del Potrero'];
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#d9a273'];
const HAIR = ['#2b1b10', '#4a2c17', '#111111', '#7a4a24', '#d6b25e', '#1f1f1f'];

// ---------- Relator ----------
type Names = { team: string; coach: string; rival: string };
const PHRASES: Record<MatchEvent['type'], string[]> = {
  pass: ['Toca {team}, toca y toca…', '¡Qué pase! {coach} aplaude desde el banco', 'Tiki-taka puro de {team}', 'La pelota va de pie en pie'],
  intercept: ['¡La cortó {rival}! Tocá a uno de los tuyos para mandarlo a marcar', 'Pase al rival… {coach} grita: ¡a marcar!'],
  steal: ['¡Se la robaron! Mandá a alguien a marcar', 'Presión de {rival} y pelota perdida: ¡a recuperarla!'],
  recover: ['¡La recuperó {team}!', '¡Bien ahí! Presión y pelota recuperada', '{coach} festeja la recuperación'],
  dribble: ['¡Lo gambeteó! Insistí con la marca', '¡Qué amague de {rival}! Sigue con la pelota'],
  rivalShot: ['¡Patea {rival}! ¡Elegí dónde tirarte!'],
  keeperSave: ['¡ATAJADÓN del arquero de {team}!', '¡Voló el arquero! Se salvó {team}'],
  rivalGoal: ['Gol de {rival}… {coach} patea un botellón', 'Lo adivinó mal el arquero: gol de {rival}'],
  goal: ['¡GOOOOL DE {team}!', '¡Golazo! {coach} corre por toda la línea de cal'],
  saved: ['¡Atajó el arquero de {rival}! Ahora atacan ellos', 'Tapada del arquero rival. ¡A defender!'],
  miss: ['¡Afuera! Pasó cerquita. Sale {rival} desde el fondo'],
  kickoff: ['Mueve el partido. Con la pelota: tocá a un compañero. Sin la pelota: tocá a uno tuyo para marcar'],
  half: ['¡Final del primer tiempo!'],
  end: ['¡Terminó el partido!'],
};
const say = (type: MatchEvent['type'], names: Names) => pick(PHRASES[type]).replace('{team}', names.team).replace('{coach}', names.coach).replace('{rival}', names.rival);

// ---------- Dibujo ----------
type View = { vertical: boolean; s: number; ox: number; oy: number };
const toScreen = (v: View, x: number, y: number): [number, number] => v.vertical ? [v.ox + y * v.s, v.oy + (PITCH.w - x) * v.s] : [v.ox + x * v.s, v.oy + y * v.s];
const toPitch = (v: View, sx: number, sy: number): [number, number] => v.vertical ? [PITCH.w - (sy - v.oy) / v.s, (sx - v.ox) / v.s] : [(sx - v.ox) / v.s, (sy - v.oy) / v.s];
const rect = (v: View, x: number, y: number, w: number, h: number) => {
  const [ax, ay] = toScreen(v, x, y), [bx, by] = toScreen(v, x + w, y + h);
  return [Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay)] as const;
};

function drawPitch(ctx: CanvasRenderingContext2D, v: View) {
  for (let i = 0; i < 14; i++) { ctx.fillStyle = i % 2 ? '#2f9e44' : '#37b24d'; ctx.fillRect(...rect(v, i * PITCH.w / 14, 0, PITCH.w / 14, PITCH.h)); }
  ctx.strokeStyle = '#ffffffdd'; ctx.lineWidth = Math.max(1.5, v.s * 0.22);
  const line = (x: number, y: number, w: number, h: number) => ctx.strokeRect(...rect(v, x, y, w, h));
  line(0, 0, PITCH.w, PITCH.h);
  ctx.beginPath(); ctx.moveTo(...toScreen(v, PITCH.w / 2, 0)); ctx.lineTo(...toScreen(v, PITCH.w / 2, PITCH.h)); ctx.stroke();
  ctx.beginPath(); ctx.arc(...toScreen(v, PITCH.w / 2, PITCH.h / 2), 9.15 * v.s, 0, Math.PI * 2); ctx.stroke();
  line(0, (PITCH.h - 40.3) / 2, 16.5, 40.3); line(PITCH.w - 16.5, (PITCH.h - 40.3) / 2, 16.5, 40.3);
  line(0, (PITCH.h - 18.3) / 2, 5.5, 18.3); line(PITCH.w - 5.5, (PITCH.h - 18.3) / 2, 5.5, 18.3);
  ctx.fillStyle = '#ffffffdd';
  for (const x of [11, PITCH.w - 11, PITCH.w / 2]) { ctx.beginPath(); ctx.arc(...toScreen(v, x, PITCH.h / 2), Math.max(1.5, v.s * 0.3), 0, Math.PI * 2); ctx.fill(); }
}

// Arco visto desde arriba: red con malla, palos y travesaño con sombra.
function drawGoal(ctx: CanvasRenderingContext2D, v: View, right: boolean) {
  const lineX = right ? PITCH.w : 0, backX = right ? PITCH.w + GOAL.depth : -GOAL.depth;
  const pts = [[lineX, GOAL.top], [backX, GOAL.top + 0.6], [backX, GOAL.bottom - 0.6], [lineX, GOAL.bottom]].map(([x, y]) => toScreen(v, x, y));
  ctx.save();
  ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
  ctx.fillStyle = '#0b3d1c'; ctx.fill();
  ctx.clip();
  ctx.strokeStyle = '#ffffff70'; ctx.lineWidth = 1;
  for (let y = GOAL.top; y <= GOAL.bottom; y += 0.55) { ctx.beginPath(); ctx.moveTo(...toScreen(v, lineX, y)); ctx.lineTo(...toScreen(v, backX, y)); ctx.stroke(); }
  for (let d = 0; d <= GOAL.depth; d += 0.55) { const x = right ? lineX + d : lineX - d; ctx.beginPath(); ctx.moveTo(...toScreen(v, x, GOAL.top)); ctx.lineTo(...toScreen(v, x, GOAL.bottom)); ctx.stroke(); }
  ctx.restore();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = '#00000055'; ctx.lineWidth = Math.max(3, v.s * 0.45);
  ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x + 2, y + 3) : ctx.moveTo(x + 2, y + 3)); ctx.stroke();
  ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = Math.max(2.5, v.s * 0.3);
  ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  for (const y of [GOAL.top, GOAL.bottom]) { ctx.beginPath(); ctx.arc(...toScreen(v, lineX, y), Math.max(2.5, v.s * 0.32), 0, Math.PI * 2); ctx.fill(); }
}

// Jugador visto desde arriba: hombros con la camiseta, cabeza con pelo y nariz hacia donde mira.
function drawPerson(ctx: CanvasRenderingContext2D, v: View, x: number, y: number, angle: number, kit: Kit, look: number, ring?: string, dashed = false) {
  // Un poco más grandes que en la realidad, para que se vean bien en la pantalla.
  const [sx, sy] = toScreen(v, x, y), s = Math.max(5.5, v.s) * 1.6;
  const across = 1.2 * s, depth = 0.6 * s, head = 0.5 * s;
  if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = Math.max(2, s * 0.22); ctx.setLineDash(dashed ? [s * 0.5, s * 0.35] : []); ctx.beginPath(); ctx.arc(sx, sy, across * 1.22, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
  ctx.save();
  ctx.translate(sx, sy); ctx.rotate(angle);
  ctx.fillStyle = '#00000040'; ctx.beginPath(); ctx.ellipse(s * 0.25, s * 0.35, depth * 1.1, across * 1.05, 0, 0, Math.PI * 2); ctx.fill();
  // hombros y camiseta
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0, 0, depth, across, 0, 0, Math.PI * 2); ctx.clip();
  paintKit(ctx, kit, depth * 2, across * 2);
  ctx.restore();
  ctx.fillStyle = kit.trim;
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(0, side * across * 0.86, depth * 0.62, across * 0.2, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = '#0f172a99'; ctx.lineWidth = Math.max(1, s * 0.08);
  ctx.beginPath(); ctx.ellipse(0, 0, depth, across, 0, 0, Math.PI * 2); ctx.stroke();
  // cabeza: piel, nariz adelante y pelo atrás
  const skin = SKINS[look % SKINS.length];
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.moveTo(head * 0.85, -head * 0.28); ctx.lineTo(head * 1.38, 0); ctx.lineTo(head * 0.85, head * 0.28); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, head, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = HAIR[(look * 7) % HAIR.length];
  ctx.beginPath(); ctx.ellipse(-head * 0.3, 0, head * 0.72, head * 0.92, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0000001f'; // orejas
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(head * 0.05, side * head * 0.95, head * 0.18, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = '#0f172a80'; ctx.lineWidth = Math.max(0.8, s * 0.06);
  ctx.beginPath(); ctx.arc(0, 0, head, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// Pelota con gajos negros, brillo y sombra; gira mientras rueda.
function drawBall(ctx: CanvasRenderingContext2D, v: View, x: number, y: number, spin: number, lift: number) {
  const [sx, sy0] = toScreen(v, x, y);
  const r = Math.max(5, 0.8 * v.s) * (1 + lift * 0.7), sy = sy0 - lift * r * 1.6;
  ctx.fillStyle = `rgba(0,0,0,${0.35 - lift * 0.15})`;
  ctx.beginPath(); ctx.ellipse(sx + r * 0.35, sy0 + r * 0.55, r * (1 + lift * 0.3), r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.clip();
  const g = ctx.createRadialGradient(sx - r * 0.35, sy - r * 0.35, r * 0.1, sx, sy, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#e5e7eb'); g.addColorStop(1, '#9ca3af');
  ctx.fillStyle = g; ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
  const pent = (cx: number, cy: number, size: number, rot: number) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) { const a = rot + i * Math.PI * 2 / 5; const px = cx + Math.cos(a) * size, py = cy + Math.sin(a) * size; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.closePath(); ctx.fill();
  };
  ctx.fillStyle = '#111827';
  const offset = (spin % 1) * r * 0.9;
  pent(sx + offset * 0.3, sy, r * 0.36, spin);
  for (let i = 0; i < 5; i++) { const a = spin + i * Math.PI * 2 / 5 + Math.PI / 5; pent(sx + Math.cos(a) * r * 0.95, sy + Math.sin(a) * r * 0.95, r * 0.3, a); }
  ctx.strokeStyle = '#11182766'; ctx.lineWidth = Math.max(0.6, r * 0.06);
  for (let i = 0; i < 5; i++) { const a = spin + i * Math.PI * 2 / 5; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * r * 0.36, sy + Math.sin(a) * r * 0.36); ctx.lineTo(sx + Math.cos(a) * r * 0.75, sy + Math.sin(a) * r * 0.75); ctx.stroke(); }
  const shine = ctx.createRadialGradient(sx - r * 0.4, sy - r * 0.45, 0, sx - r * 0.4, sy - r * 0.45, r * 0.6);
  shine.addColorStop(0, '#ffffffcc'); shine.addColorStop(1, '#ffffff00');
  ctx.fillStyle = shine; ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
  ctx.restore();
  ctx.strokeStyle = '#374151'; ctx.lineWidth = Math.max(0.8, r * 0.1);
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
}

const RISK_COLORS = { safe: '#22c55e', risky: '#f59e0b', blocked: '#ef4444' };
const KEEPER_MINE: Kit = { id: 'gk1', name: '', base: '#a3e635', pattern: 'solid', trim: '#1f2937' };
const KEEPER_RIVAL: Kit = { id: 'gk2', name: '', base: '#f97316', pattern: 'solid', trim: '#1f2937' };

function draw(ctx: CanvasRenderingContext2D, m: Match, v: View, mine: Kit, rival: Kit, time: number) {
  drawPitch(ctx, v);
  drawGoal(ctx, v, false); drawGoal(ctx, v, true);
  if (canShoot(m)) {
    ctx.fillStyle = `rgba(250, 204, 21, ${0.3 + 0.25 * Math.sin(time * 8)})`;
    ctx.fillRect(...rect(v, PITCH.w - 2.5, GOAL.top - 1.5, 2.5 + GOAL.depth, GOAL.bottom - GOAL.top + 3));
  }
  const [bsx, bsy] = toScreen(v, m.ball.x, m.ball.y);
  const face = (x: number, y: number, tx = bsx, ty = bsy) => { const [px, py] = toScreen(v, x, y); return Math.atan2(ty - py, tx - px); };
  const [gx, gy] = toScreen(v, PITCH.w, PITCH.h / 2), [hx, hy] = toScreen(v, 0, PITCH.h / 2);
  drawPerson(ctx, v, m.myKeeper.x, m.myKeeper.y, face(m.myKeeper.x, m.myKeeper.y), KEEPER_MINE, 3);
  drawPerson(ctx, v, m.keeper.x, m.keeper.y, face(m.keeper.x, m.keeper.y), KEEPER_RIVAL, 8);
  m.rivals.forEach((r, i) => {
    const holder = m.possession === 'rival' && i === m.holder;
    drawPerson(ctx, v, r.x, r.y, holder ? face(r.x, r.y, hx, hy) : face(r.x, r.y), rival, i + 11, holder ? '#ef4444' : undefined);
  });
  m.mine.forEach((p, i) => {
    const holder = m.possession === 'mine' && i === m.holder;
    const risk = m.phase === 'play' && m.possession === 'mine' && m.holder !== null && !holder ? passRisk(m, i) : null;
    const ring = holder ? '#fde047' : m.possession === 'rival' && i === m.chaser ? '#f43f5e' : risk ? RISK_COLORS[risk] : undefined;
    drawPerson(ctx, v, p.x, p.y, holder ? face(p.x, p.y, gx, gy) : face(p.x, p.y), mine, i, ring, risk === 'blocked' || (m.possession === 'rival' && i === m.chaser));
  });
  const shot = m.flight?.to === 'goal' ? Math.sin(Math.min(1, m.flight.t / m.flight.dur) * Math.PI) : m.phase === 'save' && m.save ? Math.sin(Math.min(1, Math.max(0, m.save.t) / m.save.window) * Math.PI) : 0;
  const holderP = m.holder !== null ? (m.possession === 'mine' ? m.mine[m.holder] : m.rivals[m.holder]) : null;
  const ahead = holderP ? (m.possession === 'mine' ? 1.6 : -1.6) : 0;
  drawBall(ctx, v, m.ball.x + ahead, m.ball.y, m.spin, shot);
}

// ---------- Pantalla ----------
type Screen = 'setup' | 'match';
const SIDE_LABELS: Record<Side, string> = { izq: '⬅ Izquierda', medio: '⬆ Medio', der: 'Derecha ➡' };
const sideName = (s: Side) => s === 'medio' ? 'al medio' : s === 'izq' ? 'a la izquierda' : 'a la derecha';

function FormationPreview({ id, color }: { id: FormationId; color: string }) {
  const counts = FORMATIONS[id];
  return <svg viewBox="0 0 60 40" aria-hidden="true">
    <rect width="60" height="40" rx="3" fill="#2f9e44" /><path d="M30 0v40M0 0h60v40H0z" stroke="#ffffffaa" fill="none" strokeWidth="1" /><circle cx="30" cy="20" r="5" stroke="#ffffffaa" fill="none" strokeWidth="1" />
    <circle cx="4" cy="20" r="2.4" fill="#a3e635" />
    {counts.flatMap((n, i) => Array.from({ length: n }, (_, j) => <circle key={`${i}-${j}`} cx={14 + i * (40 / Math.max(1, counts.length - 1))} cy={40 * (j + 1) / (n + 1)} r="2.6" fill={color} stroke="#0f172a" strokeWidth=".6" />))}
  </svg>;
}

// Camiseta de frente para elegir el país.
export function KitPreview({ kit }: { kit: Kit }) {
  const id = `kit-${kit.id}`;
  return <svg viewBox="0 0 40 40" aria-hidden="true">
    <defs><clipPath id={id}><path d="M13 4l-9 5 3 8 4-2v21h18V15l4 2 3-8-9-5c-1 3-4 4.5-7 4.5S14 7 13 4z" /></clipPath></defs>
    <g clipPath={`url(#${id})`}>
      <rect width="40" height="40" fill={kit.base} />
      {kit.pattern === 'stripes' && kit.second && [10, 17, 24, 31].map(x => <rect key={x} x={x} width="3.5" height="40" fill={kit.second} />)}
      {kit.pattern === 'checks' && kit.second && Array.from({ length: 64 }, (_, i) => (i % 8 + Math.floor(i / 8)) % 2 ? <rect key={i} x={(i % 8) * 5} y={Math.floor(i / 8) * 5} width="5" height="5" fill={kit.second} /> : null)}
      {kit.pattern === 'sash' && kit.second && <path d="M4 4h7l25 36h-7z" fill={kit.second} />}
      <path d="M4 9l3 8 4-2" fill="none" stroke={kit.trim} strokeWidth="3" /><path d="M36 9l-3 8-4-2" fill="none" stroke={kit.trim} strokeWidth="3" />
      <path d="M13 4c1 3 4 4.5 7 4.5S26 7 27 4" fill="none" stroke={kit.trim} strokeWidth="2.4" />
    </g>
    <path d="M13 4l-9 5 3 8 4-2v21h18V15l4 2 3-8-9-5c-1 3-4 4.5-7 4.5S14 7 13 4z" fill="none" stroke="#0f172a" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>;
}

export function TikiTaka() {
  const [setup, setSetup] = useState<TeamSetup>(() => { const saved = read<Partial<TeamSetup>>(SETUP_KEY, {}); return { ...DEFAULT_SETUP, ...saved, country: saved.country && KITS.some(k => k.id === saved.country) ? saved.country : DEFAULT_SETUP.country }; });
  const [screen, setScreen] = useState<Screen>('setup');
  const [rival, setRival] = useState(() => pick(RIVALS));
  const myKit = kitById(setup.country);
  const [rivalShirt, setRivalShirt] = useState(() => rivalKit(myKit));
  const [hud, setHud] = useState({ minute: 0, half: 1, mine: 0, rival: 0, phase: 'play' as Match['phase'], possession: 'mine' as Match['possession'], canShoot: false, chance: 0, save: null as Match['save'], passes: 0, shots: 0, recovered: 0 });
  const [line, setLine] = useState('');
  const [celebrate, setCelebrate] = useState(false);
  const [record, setRecord] = useState(readTikiRecord);
  const matchRef = useRef<Match | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<View>({ vertical: false, s: 1, ox: 0, oy: 0 });
  const names: Names = { team: setup.team.trim() || DEFAULT_SETUP.team, coach: setup.coach.trim() || DEFAULT_SETUP.coach, rival };

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const start = (e?: React.FormEvent) => {
    e?.preventDefault();
    write(SETUP_KEY, setup);
    if (rivalShirt.id === myKit.id || rivalShirt.base === myKit.base) setRivalShirt(rivalKit(myKit));
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
    const margin = GOAL.depth + 1;
    const fieldW = vertical ? PITCH.h + 2 : PITCH.w + margin * 2, fieldH = vertical ? PITCH.w + margin * 2 : PITCH.h + 2;
    const s = Math.min(w / fieldW, h / fieldH);
    const v: View = { vertical, s, ox: (w - (vertical ? PITCH.h : PITCH.w) * s) / 2, oy: (h - (vertical ? PITCH.w : PITCH.h) * s) / 2 };
    viewRef.current = v;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = `${w}px`; canvas.style.height = `${h}px`; }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    draw(ctx, m, v, myKit, rivalShirt, performance.now() / 1000);
  }, [myKit, rivalShirt]);

  useLayoutEffect(() => {
    if (screen !== 'match') return;
    const observer = new ResizeObserver(paint);
    if (stageRef.current) observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [screen, paint]);

  // Bucle del partido.
  useEffect(() => {
    if (screen !== 'match') return;
    let frame = 0, last = performance.now(), hidden = false;
    const tick = (now: number) => {
      const m = matchRef.current;
      if (!m) return;
      const dt = hidden ? 0 : Math.max(0, Math.min(0.05, (now - last) / 1000));
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
        const next = { minute: minute(m), half: m.half, mine: m.goals.mine, rival: m.goals.rival, phase: m.phase, possession: m.possession, canShoot: canShoot(m), chance: canShoot(m) ? Math.round(shotChance(m) * 10) * 10 : 0, save: m.save && { ...m.save }, passes: m.stats.passes, shots: m.stats.shots, recovered: m.stats.recovered };
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
      paint();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hide = () => { hidden = document.hidden; };
    document.addEventListener('visibilitychange', hide);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', hide); };
  }, [screen, paint]); // eslint-disable-line react-hooks/exhaustive-deps

  const tryShoot = () => { const m = matchRef.current; if (m) shoot(m); };
  const tryDive = (side: Side) => { const m = matchRef.current; if (m) dive(m, side); };
  const secondHalf = () => { const m = matchRef.current; if (m && startSecondHalf(m)) setLine(`¡Arranca el segundo tiempo! Saca ${rival}`); };

  useEffect(() => {
    if (screen !== 'match') return;
    const key = (e: KeyboardEvent) => {
      const sides: Record<string, Side> = { ArrowLeft: 'izq', ArrowUp: 'medio', ArrowRight: 'der' };
      if (sides[e.key] && matchRef.current?.phase === 'save') { e.preventDefault(); tryDive(sides[e.key]); }
      if ((e.key === ' ' || e.key === 'Enter') && matchRef.current && canShoot(matchRef.current)) { e.preventDefault(); tryShoot(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [screen]);

  // Tocar la cancha: con la pelota, pase (o tiro si tocás el arco); sin la pelota, mandar a marcar.
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const m = matchRef.current;
    if (!m || (m.phase !== 'play' && m.phase !== 'flight')) return;
    const r = e.currentTarget.getBoundingClientRect();
    const [x, y] = toPitch(viewRef.current, e.clientX - r.left, e.clientY - r.top);
    if (m.possession === 'mine' && x > PITCH.w - 8 && y > GOAL.top - 8 && y < GOAL.bottom + 8 && canShoot(m)) { shoot(m); return; }
    let best = -1, bestDist = 6;
    m.mine.forEach((p, i) => { const d = Math.hypot(p.x - x, p.y - y); if ((m.possession === 'rival' || i !== m.holder) && d < bestDist) { bestDist = d; best = i; } });
    if (best < 0) return;
    if (m.possession === 'mine') pass(m, best); else chase(m, best);
  };

  const rematch = () => { setRival(pick(RIVALS.filter(r => r !== rival))); setRivalShirt(rivalKit(myKit)); setTimeout(() => start(), 0); };
  const result = hud.mine > hud.rival ? 'won' : hud.mine < hud.rival ? 'lost' : 'drawn';
  const s = hud.save;

  return <section className="runner tt" aria-label="Tiki-Taka">
    <div className="runner-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1>Tiki-Taka</h1>
      {screen === 'match' && <div className="tt-board" aria-live="polite">
        <div className="tt-board-row">
          <span className="tt-team"><i style={{ background: myKit.base, borderColor: myKit.trim }} />{names.team}</span>
          <strong data-testid="tt-score">{hud.mine} - {hud.rival}</strong>
          <span className="tt-team tt-team--rival"><i style={{ background: rivalShirt.base, borderColor: rivalShirt.trim }} /><b>{rival}</b></span>
        </div>
        <div className="tt-board-time">{hud.half === 1 ? '1T' : '2T'} · {hud.minute}'</div>
      </div>}
    </div>

    {screen === 'setup' && <form className="tt-setup" onSubmit={start}>
      <h2>Armá tu equipo</h2>
      <div className="tt-fields">
        <label>Nombre del equipo<input value={setup.team} maxLength={24} onChange={e => setSetup({ ...setup, team: e.target.value })} /></label>
        <label>Nombre del DT<input value={setup.coach} maxLength={24} onChange={e => setSetup({ ...setup, coach: e.target.value })} /></label>
      </div>
      <fieldset className="tt-kits"><legend>Camiseta: {myKit.name}</legend>
        {KITS.map(k => <button key={k.id} type="button" aria-label={k.name} title={k.name} aria-pressed={setup.country === k.id} onClick={() => setSetup({ ...setup, country: k.id })}><KitPreview kit={k} /><span>{k.name}</span></button>)}
      </fieldset>
      <fieldset className="tt-formations"><legend>Formación</legend>
        {(Object.keys(FORMATIONS) as FormationId[]).map(id => <button key={id} type="button" aria-pressed={setup.formation === id} onClick={() => setSetup({ ...setup, formation: id })}>
          <FormationPreview id={id} color={myKit.base} /><span>{id}</span>
        </button>)}
      </fieldset>
      <p className="tt-tip">Con más defensores te cuesta menos defender; con más volantes y delanteros, tenés más opciones de pase cerca del arco.</p>
      <p className="tt-rival">Hoy juegan contra <strong>{rival}</strong></p>
      <button type="submit" className="tt-go">¡A la cancha! ⚽</button>
      {record.played > 0 && <p className="tt-record">Tu campaña: {record.won} ganados, {record.drawn} empatados, {record.lost} perdidos · {record.goals} goles</p>}
    </form>}

    {screen === 'match' && <>
      <div className="tt-stage" ref={stageRef}>
        <canvas ref={canvasRef} onPointerDown={onPointerDown} role="img" aria-label="Cancha" />
        {celebrate && <div className="tt-goal" aria-hidden="true"><span>¡GOOOL!</span><small>{names.team}</small></div>}
        {hud.phase === 'save' && s && <div className="tt-save" role="dialog" aria-labelledby="tt-save-title">
          <h2 id="tt-save-title">{s.result === 'saved' ? '¡ATAJASTE!' : s.result === 'goal' ? `Gol de ${rival}` : `¡Patea ${rival}!`}</h2>
          {!s.result && <>
            <div className="tt-timer"><span key={s.window} style={{ animationDuration: `${s.window}s` }} /></div>
            <div className="tt-sides">{(['izq', 'medio', 'der'] as Side[]).map(side => <button key={side} type="button" onClick={() => tryDive(side)}>{SIDE_LABELS[side]}</button>)}</div>
          </>}
          {s.result && <p>Pateó {sideName(s.dir)}{s.chosen ? ` y te tiraste ${sideName(s.chosen)}` : ' y no llegaste a tirarte'}.</p>}
        </div>}
        {hud.phase === 'half' && <div className="runner-overlay" role="dialog" aria-labelledby="tt-half">
          <div>
            <h2 id="tt-half">Entretiempo</h2>
            <p className="tt-final">{names.team} {hud.mine} - {hud.rival} {rival}</p>
            <p>{names.coach} da la charla en el vestuario. {hud.passes} pases, {hud.recovered} recuperaciones.</p>
            <button type="button" onClick={secondHalf} autoFocus>Segundo tiempo ▶</button>
          </div>
        </div>}
        {hud.phase === 'end' && <div className="runner-overlay" role="dialog" aria-labelledby="tt-end">
          <div>
            <h2 id="tt-end">{result === 'won' ? `¡Ganó ${names.team}!` : result === 'lost' ? `Ganó ${rival}` : '¡Empate!'}</h2>
            <p className="tt-final">{names.team} {hud.mine} - {hud.rival} {rival}</p>
            <p>{result === 'won' ? `${names.coach} sale en andas.` : result === 'lost' ? `${names.coach} ya piensa en la revancha.` : `${names.coach} dice que el punto sirve.`} {hud.passes} pases, {hud.shots} tiros y {hud.recovered} recuperaciones.</p>
            <div className="tt-end-actions"><button type="button" onClick={rematch} autoFocus>Revancha</button><button type="button" onClick={() => setScreen('setup')}>Cambiar equipo</button></div>
          </div>
        </div>}
      </div>
      <div className="tt-bottom">
        <p className="tt-line" aria-live="polite">🎙️ {line}</p>
        <button type="button" className="tt-shoot" disabled={!hud.canShoot} onClick={tryShoot}>¡Patear!{hud.canShoot && <small>{hud.chance}%</small>}</button>
      </div>
    </>}
  </section>;
}
