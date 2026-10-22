import { useEffect, useRef, useState } from 'react';
import type { Kit } from './kits';
import { kick, newShootout, score, SERIES, SPOT_NAMES, SPOTS, turnOf, type Kick, type Spot, type Taker } from './penalties';
import { playGoal, playKick, playRefWhistle } from './sounds';

// Tanda de penales: arriba el cartel con los tres lugares (1 izquierda, 2 medio, 3 derecha), el arco visto
// desde atrás del que patea, el arquero que se tira y la pelota. Antes de cada penal suena el silbato del
// árbitro. Elegís con los botones o con las teclas 1, 2 y 3 (o ← ↑ →).
type Stage = 'ready' | 'kick' | 'result' | 'done';
const GROUND = 150, ZONE_X: Record<Spot, number> = { 1: 88, 2: 160, 3: 232 };
// Adónde va el arquero en cada caso (desde el medio del arco, con los pies en el piso).
const DIVE: Record<Spot, string> = { 1: 'translate(-66px, -30px) rotate(-72deg)', 2: 'translate(0px, -26px)', 3: 'translate(66px, -30px) rotate(72deg)' };
const KEYS: Record<string, Spot> = { 1: 1, 2: 2, 3: 3, ArrowLeft: 1, ArrowUp: 2, ArrowRight: 3 };

function Player({ kit, x, y, back }: { kit: Kit; x: number; y: number; back?: boolean }) {
  return <g transform={`translate(${x} ${y})`}>
    <rect x={-7} y={-14} width={5} height={14} rx={2} fill="#1f2937" /><rect x={2} y={-14} width={5} height={14} rx={2} fill="#1f2937" />
    <rect x={-9} y={-22} width={18} height={10} rx={3} fill={kit.trim} />
    <rect x={-11} y={-44} width={22} height={24} rx={5} fill={kit.base} stroke={kit.trim} strokeWidth={2} />
    {back && <text x={0} y={-27} textAnchor="middle" fontSize={11} fontWeight={900} fill={kit.trim}>10</text>}
    <circle cx={0} cy={-52} r={8} fill="#d9a273" />
    <path d="M-8 -54 Q0 -64 8 -54 Q4 -59 0 -59 Q-4 -59 -8 -54Z" fill="#2b1b10" />
  </g>;
}

export function Penalties({ team, rival, myKit, rivalKit, onDone }: { team: string; rival: string; myKit: Kit; rivalKit: Kit; onDone: (score: [number, number]) => void }) {
  const [s] = useState(() => newShootout());
  const [stage, setStage] = useState<Stage>('ready');
  const [last, setLast] = useState<Kick | null>(null);
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; }, [onDone]);

  // El árbitro da la orden de patear con un pitazo.
  useEffect(() => { if (stage === 'ready') playRefWhistle('penalty'); }, [stage]);
  useEffect(() => {
    const wait = (ms: number, next: () => void) => { const id = setTimeout(next, ms); return () => clearTimeout(id); };
    if (stage === 'kick') return wait(700, () => { setStage('result'); if (last?.goal) playGoal(); });
    if (stage === 'result') return wait(1800, () => setStage(s.winner ? 'done' : 'ready'));
    if (stage === 'done') return wait(2000, () => done.current(score(s)));
  }, [stage, last, s]);

  const choose = (spot: Spot) => {
    if (stage !== 'ready') return;
    const k = kick(s, spot);
    if (!k) return;
    setLast(k); setStage('kick'); playKick(1);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => { const spot = KEYS[e.key]; if (spot) { e.preventDefault(); choose(spot); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const taker: Taker = stage === 'ready' || !last ? turnOf(s) : last.team;
  const keeperKit = taker === 'mine' ? rivalKit : myKit, kickerKit = taker === 'mine' ? myKit : rivalKit;
  const moving = stage !== 'ready' && last;
  const [mine, theirs] = score(s);
  const title = stage === 'ready'
    ? taker === 'mine' ? '¡Pateás vos! Elegí adónde patear' : `¡Patea ${rival}! Elegí adónde tirarte`
    : stage === 'kick' ? (taker === 'mine' ? 'Patea…' : `Patea ${rival}…`)
      : stage === 'done' ? (s.winner === 'mine' ? `¡Ganó ${team} por penales!` : `Ganó ${rival} por penales`)
        : last?.goal ? (taker === 'mine' ? '¡GOOOOL!' : `Gol de ${rival}`) : taker === 'mine' ? '¡Te lo atajaron!' : '¡ATAJASTE!';
  const detail = last && stage !== 'ready' && stage !== 'kick'
    ? `${last.team === 'mine' ? 'Pateaste' : `Pateó ${rival}`} al ${last.aim} (${SPOT_NAMES[last.aim]}) y ${last.team === 'mine' ? 'el arquero' : 'te'} ${last.team === 'mine' ? 'se tiró' : 'tiraste'} al ${last.dive} (${SPOT_NAMES[last.dive]}).`
    : stage === 'ready' ? `El ${taker === 'mine' ? 'arquero' : 'pateador'} de ${rival} ya eligió su número…` : ' ';
  const rows: [string, Kit, Taker][] = [[team, myKit, 'mine'], [rival, rivalKit, 'rival']];
  const shown = Math.max(SERIES, Math.ceil(s.kicks.length / 2));
  const ballTo = moving ? `translate(${ZONE_X[last.aim] - 160}px, ${last.goal ? -92 : -80}px) scale(0.62)` : 'none';

  return <div className="tt-pen" role="dialog" aria-labelledby="tt-pen-title">
    <div className="tt-pen-card">
      <p className="tt-round">Definición por penales</p>
      <div className="tt-pen-board">
        {rows.map(([name, kit, side]) => <div key={side} className="tt-pen-row">
          <span className="tt-team"><i style={{ background: kit.base, borderColor: kit.trim }} />{name}</span>
          <span className="tt-pen-dots">{Array.from({ length: shown }, (_, i) => {
            const k = s.kicks.filter(q => q.team === side)[i];
            return <span key={i} className={k ? (k.goal ? 'is-goal' : 'is-miss') : ''} aria-label={k ? (k.goal ? 'gol' : 'errado') : 'falta patear'}>{k ? (k.goal ? '✓' : '✗') : ''}</span>;
          })}</span>
          <strong data-testid={`tt-pen-${side}`}>{side === 'mine' ? mine : theirs}</strong>
        </div>)}
      </div>
      <div className="tt-pen-sign" data-testid="tt-pen-sign">Izquierda: <b>1</b> · Medio: <b>2</b> · Derecha: <b>3</b></div>
      <svg className="tt-pen-field" viewBox="0 0 320 190" role="img" aria-label="Arco, arquero y pelota">
        <defs>
          <linearGradient id="tt-pen-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0f172a" /><stop offset="1" stopColor="#1e3a5f" /></linearGradient>
          <pattern id="tt-pen-net" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M0 0L9 9M9 0L0 9" stroke="#ffffff55" strokeWidth="0.8" /></pattern>
        </defs>
        <rect width="320" height="190" fill="url(#tt-pen-sky)" />
        {Array.from({ length: 16 }, (_, i) => <circle key={i} cx={10 + i * 20} cy={12 + (i % 3) * 5} r={2.2} fill={['#fde047', '#f8fafc', '#fca5a5'][i % 3]} opacity={0.5} />)}
        {Array.from({ length: 8 }, (_, i) => <rect key={i} x={0} y={GROUND - 10 + i * 6} width={320} height={6} fill={i % 2 ? '#2f9e44' : '#37b24d'} />)}
        <rect x={0} y={GROUND - 12} width={320} height={4} fill="#ffffffaa" />
        <rect x={44} y={34} width={232} height={GROUND - 34} fill="url(#tt-pen-net)" />
        {SPOTS.map(spot => <g key={spot} opacity={moving && (last.aim === spot) ? 0.9 : 0.4}>
          <rect x={ZONE_X[spot] - 36} y={38} width={72} height={GROUND - 42} fill={moving && last.aim === spot ? '#facc1533' : 'transparent'} stroke="#ffffff55" strokeDasharray="4 4" />
          <text x={ZONE_X[spot]} y={78} textAnchor="middle" fontSize={30} fontWeight={900} fill="#fff">{spot}</text>
        </g>)}
        <rect x={38} y={28} width={7} height={GROUND - 26} fill="#f8fafc" /><rect x={275} y={28} width={7} height={GROUND - 26} fill="#f8fafc" /><rect x={38} y={28} width={244} height={7} fill="#f8fafc" />
        <g className={moving ? '' : 'tt-pen-keeper-idle'} style={{ transform: moving ? DIVE[last.dive] : 'none', transformOrigin: `160px ${GROUND}px`, transformBox: 'view-box', transition: moving ? 'transform .55s cubic-bezier(.2,.8,.3,1)' : 'none' }}>
          <Player kit={keeperKit} x={160} y={GROUND} />
          <circle cx={147} cy={GROUND - 40} r={4} fill="#f97316" /><circle cx={173} cy={GROUND - 40} r={4} fill="#f97316" />
        </g>
        <Player kit={kickerKit} x={126} y={206} back />
        <g style={{ transform: ballTo, transformOrigin: '160px 176px', transformBox: 'view-box', transition: moving ? 'transform .6s ease-out' : 'none' }}>
          <circle cx={160} cy={176} r={9} fill="#f8fafc" stroke="#111827" strokeWidth={1.5} />
          <path d="M160 170l4 3-1.5 5h-5L156 173z" fill="#111827" />
        </g>
      </svg>
      <h2 id="tt-pen-title">{title}</h2>
      <p className="tt-pen-detail">{detail}</p>
      <div className="tt-sides tt-pen-buttons">
        {SPOTS.map(spot => <button key={spot} type="button" disabled={stage !== 'ready'} onClick={() => choose(spot)} aria-label={`${spot}: ${SPOT_NAMES[spot]}`}>
          <b>{spot}</b><small>{spot === 1 ? '⬅ ' : spot === 3 ? '' : '⬆ '}{SPOT_NAMES[spot][0].toUpperCase() + SPOT_NAMES[spot].slice(1)}{spot === 3 ? ' ➡' : ''}</small>
        </button>)}
      </div>
    </div>
  </div>;
}
