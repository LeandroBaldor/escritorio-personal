import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { bestTarget, canFinish, canMove, cardName, deal, draw, finishStep, isRed, isWon, move, picked, RANK_NAMES, type Card, type From, type Solitaire, type Suit, type To } from './solitaire';

const RECORD_KEY = 'escritorio-personal-juegos:solitario-record';
export const readSolitaireRecord = (): { seconds: number; moves: number } | null => {
  try { const value = JSON.parse(localStorage.getItem(RECORD_KEY) ?? 'null'); return value && typeof value.seconds === 'number' ? value : null; } catch { return null; }
};
const saveRecord = (value: { seconds: number; moves: number }) => { try { localStorage.setItem(RECORD_KEY, JSON.stringify(value)); } catch { /* sin almacenamiento */ } };
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

// Dibujos de los palos: balde de palomitas, estrella, claqueta y rollo de película.
export function SuitIcon({ suit, x, y, size }: { suit: Suit; x?: number; y?: number; size?: number }) {
  const box = { viewBox: '0 0 24 24', 'aria-hidden': true, x, y, width: size, height: size } as const;
  if (suit === 'palomitas') return <svg {...box}>
    <circle cx="8" cy="7" r="3.2" fill="#fde68a" /><circle cx="12" cy="5.5" r="3.4" fill="#fef3c7" /><circle cx="16" cy="7" r="3.2" fill="#fde68a" /><circle cx="10" cy="8.5" r="2.6" fill="#fef9c3" /><circle cx="14.2" cy="8.6" r="2.6" fill="#fef9c3" />
    <path d="M4.5 9h15l-2 13h-11z" fill="#fff" stroke="#b91c1c" strokeWidth=".8" />
    <path d="M7.4 9h2.4l.5 13H8.4zM12 9h2.4l-.3 13h-2z" fill="#dc2626" /><path d="M16.6 9h2.4l-1.9 12.8-1.6.2z" fill="#dc2626" />
  </svg>;
  if (suit === 'estrella') return <svg {...box}>
    <path d="M12 1.8l3 6.4 7 .8-5.2 4.8 1.4 6.9L12 17.2l-6.2 3.5 1.4-6.9L2 9l7-.8z" fill="#dc2626" stroke="#7f1d1d" strokeWidth=".7" strokeLinejoin="round" />
    <path d="M12 5.2l1.8 3.9 4.2.5" fill="none" stroke="#fca5a5" strokeWidth="1" strokeLinecap="round" />
  </svg>;
  if (suit === 'claqueta') return <svg {...box}>
    <rect x="3" y="10" width="18" height="11" rx="1.5" fill="#111827" />
    <path d="M3 10h18" stroke="#fff" strokeWidth=".6" /><rect x="5.5" y="13" width="13" height="1.4" rx=".7" fill="#e5e7eb" /><rect x="5.5" y="16.4" width="8" height="1.4" rx=".7" fill="#9ca3af" />
    <g transform="rotate(-16 3 8.5)"><rect x="3" y="5.6" width="18" height="3.6" rx=".8" fill="#111827" /><path d="M5.5 5.6l2.4 3.6M10 5.6l2.4 3.6M14.5 5.6l2.4 3.6" stroke="#fff" strokeWidth="1.5" /></g>
  </svg>;
  return <svg {...box}>
    <circle cx="12" cy="12" r="10" fill="#111827" />
    <circle cx="12" cy="12" r="2" fill="#9ca3af" />
    {[0, 72, 144, 216, 288].map(angle => <circle key={angle} cx={12 + 5.6 * Math.sin(angle * Math.PI / 180)} cy={12 - 5.6 * Math.cos(angle * Math.PI / 180)} r="2.3" fill="#f3f4f6" />)}
    <path d="M21.5 15c1.5 3 0 6-3 6.5" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}

// Figuras: J Camarógrafo, Q Protagonista, K Director.
const ROLES: Record<number, string> = { 11: 'Camarógrafo', 12: 'Protagonista', 13: 'Director' };
function RoleIcon({ rank, red }: { rank: number; red: boolean }) {
  const ink = red ? '#b91c1c' : '#111827';
  if (rank === 13) return <svg viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="20" cy="15" r="7" fill="#fcd9b6" /><path d="M13 13c0-6 14-6 14 0z" fill="#3b2412" /><rect x="12" y="10" width="16" height="3" rx="1.5" fill={ink} />
    <path d="M8 44c0-10 5-16 12-16s12 6 12 16z" fill={ink} />
    <path d="M30 22l12-6v16l-12-6z" fill="#facc15" stroke="#a16207" strokeWidth="1" /><rect x="26" y="22" width="5" height="4" rx="1" fill="#a16207" />
  </svg>;
  if (rank === 12) return <svg viewBox="0 0 48 48" aria-hidden="true">
    <path d="M24 4c-9 0-12 7-12 13 0 5 2 9 3 11h18c1-2 3-6 3-11 0-6-3-13-12-13z" fill="#facc15" />
    <circle cx="24" cy="17" r="7.5" fill="#fcd9b6" />
    <rect x="16.5" y="14.5" width="6.5" height="4" rx="2" fill="#111827" /><rect x="25" y="14.5" width="6.5" height="4" rx="2" fill="#111827" /><path d="M23 16h2" stroke="#111827" strokeWidth="1.2" />
    <path d="M21.5 21.5q2.5 1.6 5 0" stroke={ink} strokeWidth="1.4" fill="none" strokeLinecap="round" />
    <path d="M10 46c0-11 6-17 14-17s14 6 14 17z" fill={ink} />
    <path d="M24 31l1.6 3.3 3.6.4-2.7 2.5.7 3.6L24 39l-3.2 1.8.7-3.6-2.7-2.5 3.6-.4z" fill="#fde047" />
  </svg>;
  return <svg viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="13" cy="12" r="6" fill={ink} /><circle cx="27" cy="12" r="6" fill={ink} /><circle cx="13" cy="12" r="2.2" fill="#e5e7eb" /><circle cx="27" cy="12" r="2.2" fill="#e5e7eb" />
    <rect x="6" y="19" width="28" height="15" rx="3" fill={ink} /><path d="M34 23l9-4v15l-9-4z" fill="#6b7280" />
    <circle cx="14" cy="26.5" r="3" fill="#facc15" /><path d="M14 34l-6 12M20 34v12M26 34l6 12" stroke="#78716c" strokeWidth="2.2" strokeLinecap="round" />
  </svg>;
}

function CardFace({ card }: { card: Card }) {
  const red = isRed(card.suit);
  const index = <><b>{RANK_NAMES[card.rank]}</b><SuitIcon suit={card.suit} /></>;
  return <span className={`cine-face${red ? ' cine-face--red' : ''}`}>
    <span className="cine-corner">{index}</span>
    <span className="cine-center">
      {card.rank >= 11 ? <><RoleIcon rank={card.rank} red={red} /><small>{ROLES[card.rank]}</small></>
        : <span className={card.rank === 1 ? 'cine-ace' : undefined}><SuitIcon suit={card.suit} /></span>}
    </span>
    <span className="cine-corner cine-corner--end">{index}</span>
  </span>;
}

type Drag = { from: From; ids: string[]; x: number; y: number; dx: number; dy: number; moving: boolean; pointer: number };
type Layout = { cw: number; ch: number; gap: number; tableauHeight: number };

export function CinemaSolitaire() {
  const [game, setGame] = useState<Solitaire>(() => deal());
  const [history, setHistory] = useState<Solitaire[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [shake, setShake] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [record, setRecord] = useState(readSolitaireRecord);
  const [newRecord, setNewRecord] = useState(false);
  const [layout, setLayout] = useState<Layout>({ cw: 80, ch: 112, gap: 8, tableauHeight: 400 });
  const boardRef = useRef<HTMLDivElement>(null);
  const won = isWon(game);

  // Tamaño de las cartas según la pantalla: 7 columnas a lo ancho y que entre todo a lo alto.
  useLayoutEffect(() => {
    const fit = () => {
      const board = boardRef.current;
      if (!board) return;
      const width = board.clientWidth, height = board.clientHeight;
      const gap = Math.max(4, Math.min(14, width / 70));
      const cw = Math.floor(Math.min(120, (width - gap * 6) / 7, (height - gap * 3) / (1.4 * 2 + 1.2)));
      const ch = Math.round(cw * 1.4);
      setLayout({ cw, ch, gap, tableauHeight: Math.max(ch, height - ch - gap * 2) });
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (boardRef.current) observer.observe(boardRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started || won) return;
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [started, won]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const commit = useCallback((next: Solitaire | null) => {
    if (!next) return false;
    setHistory(h => [...h.slice(-199), game]);
    setGame(next);
    setStarted(true);
    return true;
  }, [game]);

  useEffect(() => {
    if (!won || !started) return;
    const best = readSolitaireRecord();
    if (!best || seconds < best.seconds) { const value = { seconds, moves: game.moves }; saveRecord(value); setRecord(value); setNewRecord(true); }
  }, [won]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Terminar solo": sube una carta por vez a las bases.
  useEffect(() => {
    if (!finishing) return;
    if (won) { setFinishing(false); return; }
    const id = setTimeout(() => { const next = finishStep(game); if (next) setGame(next); else setFinishing(false); }, 90);
    return () => clearTimeout(id);
  }, [finishing, game, won]);

  const restart = () => { setGame(deal()); setHistory([]); setSeconds(0); setStarted(false); setFinishing(false); setNewRecord(false); };
  const undo = () => { if (!history.length || finishing) return; setGame(history[history.length - 1]); setHistory(h => h.slice(0, -1)); };

  // Tocar una carta (sin arrastrarla) la manda sola a su lugar; si no tiene adónde ir, tiembla.
  const tap = (from: From, cardId: string) => {
    if (finishing) return;
    const target = bestTarget(game, from);
    if (!target || !commit(move(game, from, target))) { setShake(cardId); setTimeout(() => setShake(s => s === cardId ? null : s), 400); }
  };

  const startDrag = (event: React.PointerEvent, from: From) => {
    if (finishing || event.button > 0) return;
    const cards = picked(game, from);
    if (!cards.length) return;
    boardRef.current?.setPointerCapture(event.pointerId);
    setDrag({ from, ids: cards.map(c => c.id), x: event.clientX, y: event.clientY, dx: 0, dy: 0, moving: false, pointer: event.pointerId });
  };
  const onMove = (event: React.PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    setDrag({ ...drag, dx, dy, moving: drag.moving || Math.hypot(dx, dy) > 6 });
  };
  const endDrag = (event: React.PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    if (!drag.moving) tap(drag.from, drag.ids[0]);
    else {
      const zone = document.elementsFromPoint(event.clientX, event.clientY).map(el => (el as HTMLElement).closest<HTMLElement>('[data-drop]')).find(Boolean);
      const drop = zone?.dataset.drop;
      if (drop) {
        const to: To = drop[0] === 'f' ? { kind: 'foundation', pile: Number(drop.slice(1)) } : { kind: 'tableau', pile: Number(drop.slice(1)) };
        commit(move(game, drag.from, to));
      }
    }
    setDrag(null);
  };

  const dragStyle = (card: Card): React.CSSProperties | undefined =>
    drag?.moving && drag.ids.includes(card.id) ? { transform: `translate(${drag.dx}px, ${drag.dy}px)`, zIndex: 100 + drag.ids.indexOf(card.id), pointerEvents: 'none', transition: 'none' } : undefined;

  const renderCard = (card: Card, from: From | null, style: React.CSSProperties = {}) => {
    const movable = from && card.up;
    return <button
      key={card.id}
      type="button"
      className={`cine-card${card.up ? '' : ' cine-card--back'}${shake === card.id ? ' cine-card--shake' : ''}${drag?.moving && drag.ids.includes(card.id) ? ' cine-card--lifted' : ''}`}
      style={{ ...style, ...dragStyle(card) }}
      aria-label={card.up ? cardName(card) : 'Carta boca abajo'}
      tabIndex={movable ? 0 : -1}
      onPointerDown={movable ? event => startDrag(event, from) : undefined}
      onClick={movable ? event => { if (event.detail === 0) tap(from, card.id); } : undefined} // con teclado (Enter o Espacio)
    >{card.up ? <CardFace card={card} /> : <span className="cine-back" aria-hidden="true"><SuitIcon suit="rollo" /></span>}</button>;
  };

  const { cw, ch, gap, tableauHeight } = layout;
  const dropTargets = drag?.moving ? new Set([
    ...[0, 1, 2, 3].filter(pile => canMove(game, drag.from, { kind: 'foundation', pile })).map(p => `f${p}`),
    ...[0, 1, 2, 3, 4, 5, 6].filter(pile => canMove(game, drag.from, { kind: 'tableau', pile })).map(p => `t${p}`),
  ]) : new Set<string>();

  return <section className="runner cine" aria-label="Solitario de cine">
    <div className="runner-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1>Solitario de cine</h1>
      <div className="runner-scores">
        <span>Tiempo <strong>{clock(seconds)}</strong></span>
        <span>Movimientos <strong data-testid="solitaire-moves">{game.moves}</strong></span>
        {record && <span>Récord <strong>{clock(record.seconds)}</strong></span>}
      </div>
      <button type="button" onClick={undo} disabled={!history.length || finishing}>Deshacer</button>
      <button type="button" onClick={restart}>Nueva partida</button>
    </div>
    <div ref={boardRef} onPointerMove={onMove} onPointerUp={endDrag} onPointerCancel={() => setDrag(null)}
      className={`cine-board${cw < 76 ? ' cine-board--small' : ''}`} style={{ '--cw': `${cw}px`, '--ch': `${ch}px`, '--gap': `${gap}px` } as React.CSSProperties}>
      <div className="cine-top">
        <button type="button" className={`cine-slot cine-stock${game.stock.length ? '' : ' cine-slot--empty'}`} onClick={() => !finishing && commit(draw(game))}
          aria-label={game.stock.length ? `Mazo: ${game.stock.length} cartas, dar vuelta una` : 'Volver a armar el mazo'}>
          {game.stock.length ? <span className="cine-card cine-card--back" aria-hidden="true"><span className="cine-back"><SuitIcon suit="rollo" /></span></span> : <span className="cine-redo" aria-hidden="true">↻</span>}
          {game.stock.length > 0 && <small className="cine-count" aria-hidden="true">{game.stock.length}</small>}
        </button>
        <div className="cine-slot cine-waste" aria-label="Cartas dadas vuelta">
          {game.waste.slice(-3).map((card, i, shown) => renderCard(card, i === shown.length - 1 ? { kind: 'waste' } : null, { left: i * cw * 0.22, zIndex: i }))}
        </div>
        <span className="cine-spacer" />
        {game.foundations.map((pile, f) => <div key={f} data-drop={`f${f}`} className={`cine-slot cine-foundation${dropTargets.has(`f${f}`) ? ' cine-slot--target' : ''}`} aria-label={`Base ${f + 1}${pile.length ? `: ${cardName(pile[pile.length - 1])}` : ', vacía'}`}>
          {!pile.length && <span className="cine-slot-mark" aria-hidden="true">A</span>}
          {pile.slice(-2).map((card, i, shown) => renderCard(card, i === shown.length - 1 ? { kind: 'foundation', pile: f } : null, { zIndex: i }))}
        </div>)}
      </div>
      <div className="cine-tableau">
        {game.tableau.map((pile, t) => {
          // Si una columna es muy larga, se aprietan las cartas para que entre en la pantalla.
          const downs = pile.filter(c => !c.up).length, ups = pile.length - downs;
          const want = { down: ch * 0.13, up: ch * 0.27 };
          const needed = downs * want.down + Math.max(0, ups - 1) * want.up;
          const k = needed > tableauHeight - ch ? (tableauHeight - ch) / needed : 1;
          let y = 0;
          return <div key={t} data-drop={`t${t}`} className={`cine-column${dropTargets.has(`t${t}`) ? ' cine-slot--target' : ''}`} style={{ height: tableauHeight }} aria-label={`Columna ${t + 1}`}>
            {!pile.length && <span className="cine-slot cine-slot-mark cine-slot--king" aria-hidden="true">K</span>}
            {pile.map((card, i) => {
              const top = y;
              y += (card.up ? want.up : want.down) * k;
              return renderCard(card, card.up ? { kind: 'tableau', pile: t, index: i } : null, { top, zIndex: i });
            })}
          </div>;
        })}
      </div>
      {canFinish(game) && !finishing && <button type="button" className="cine-finish" onClick={() => setFinishing(true)}>Terminar solo ▶</button>}
      {won && <div className="runner-overlay" role="dialog" aria-labelledby="cine-won">
        <div className="cine-confetti" aria-hidden="true">
          {Array.from({ length: 28 }, (_, i) => <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.25}s`, animationDuration: `${2.4 + (i % 5) * 0.4}s` }}><SuitIcon suit={(['palomitas', 'estrella', 'claqueta', 'rollo'] as Suit[])[i % 4]} /></span>)}
        </div>
        <div>
          <h2 id="cine-won">¡Fin de la película! Ganaste</h2>
          <p>Lo terminaste en <strong>{clock(seconds)}</strong> con <strong>{game.moves}</strong> movimientos.{newRecord && ' ¡Nuevo récord!'}</p>
          <button type="button" onClick={restart} autoFocus>Jugar de nuevo</button>
        </div>
      </div>}
    </div>
  </section>;
}
