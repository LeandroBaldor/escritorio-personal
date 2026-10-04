import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BACK_IMAGE, CARD_H, CARD_W, cardImage, SUIT_PIXELS, suitColor } from './pixelCards';
import { bestTarget, canFinish, canMove, cardName, deal, draw, finishStep, isWon, move, picked, SUITS, type Card, type From, type Solitaire, type To } from './solitaire';

const RECORD_KEY = 'escritorio-personal-juegos:solitario-record';
export const readSolitaireRecord = (): { seconds: number; moves: number } | null => {
  try { const value = JSON.parse(localStorage.getItem(RECORD_KEY) ?? 'null'); return value && typeof value.seconds === 'number' ? value : null; } catch { return null; }
};
const saveRecord = (value: { seconds: number; moves: number }) => { try { localStorage.setItem(RECORD_KEY, JSON.stringify(value)); } catch { /* sin almacenamiento */ } };
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

// Un palo pixelado suelto (para el festejo y el menú).
export function PixelSuit({ suit }: { suit: (typeof SUITS)[number] }) {
  return <svg viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true">{SUIT_PIXELS[suit].flatMap((row, y) => [...row].map((ch, x) => ch === 'X' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={suitColor(suit)} /> : null))}</svg>;
}

// Las cartas son imágenes pixeladas armadas en pixelCards.
function CardFace({ card }: { card: Card }) {
  return <span className="sol-face" style={{ backgroundImage: `url("${cardImage(card.suit, card.rank)}")` }} />;
}
function CardBack() {
  return <span className="sol-back" style={{ backgroundImage: `url("${BACK_IMAGE}")` }} aria-hidden="true" />;
}

type Drag = { from: From; ids: string[]; x: number; y: number; dx: number; dy: number; moving: boolean; pointer: number };
type Layout = { cw: number; ch: number; gap: number; tableauHeight: number };

export function PixelSolitaire() {
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
      const cw = Math.floor(Math.min(120, (width - gap * 6) / 7, (height - gap * 3) / (CARD_H / CARD_W * 2 + 1.2)));
      const ch = Math.round(cw * CARD_H / CARD_W);
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
      className={`sol-card${card.up ? '' : ' sol-card--back'}${shake === card.id ? ' sol-card--shake' : ''}${drag?.moving && drag.ids.includes(card.id) ? ' sol-card--lifted' : ''}`}
      style={{ ...style, ...dragStyle(card) }}
      aria-label={card.up ? cardName(card) : 'Carta boca abajo'}
      tabIndex={movable ? 0 : -1}
      onPointerDown={movable ? event => startDrag(event, from) : undefined}
      onClick={movable ? event => { if (event.detail === 0) tap(from, card.id); } : undefined} // con teclado (Enter o Espacio)
    >{card.up ? <CardFace card={card} /> : <CardBack />}</button>;
  };

  const { cw, ch, gap, tableauHeight } = layout;
  const dropTargets = drag?.moving ? new Set([
    ...[0, 1, 2, 3].filter(pile => canMove(game, drag.from, { kind: 'foundation', pile })).map(p => `f${p}`),
    ...[0, 1, 2, 3, 4, 5, 6].filter(pile => canMove(game, drag.from, { kind: 'tableau', pile })).map(p => `t${p}`),
  ]) : new Set<string>();

  return <section className="runner sol pix" aria-label="Solitario 8 bits">
    <div className="runner-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1>Solitario 8 bits</h1>
      <div className="runner-scores">
        <span>Tiempo <strong>{clock(seconds)}</strong></span>
        <span>Movimientos <strong data-testid="solitaire-moves">{game.moves}</strong></span>
        {record && <span>Récord <strong>{clock(record.seconds)}</strong></span>}
      </div>
      <button type="button" onClick={undo} disabled={!history.length || finishing}>Deshacer</button>
      <button type="button" onClick={restart}>Nueva partida</button>
    </div>
    <div ref={boardRef} onPointerMove={onMove} onPointerUp={endDrag} onPointerCancel={() => setDrag(null)}
      className="sol-board" style={{ '--cw': `${cw}px`, '--ch': `${ch}px`, '--gap': `${gap}px` } as React.CSSProperties}>
      <div className="sol-top">
        <button type="button" className={`sol-slot sol-stock${game.stock.length ? '' : ' sol-slot--empty'}`} onClick={() => !finishing && commit(draw(game))}
          aria-label={game.stock.length ? `Mazo: ${game.stock.length} cartas, dar vuelta una` : 'Volver a armar el mazo'}>
          {game.stock.length ? <span className="sol-card sol-card--back" aria-hidden="true"><CardBack /></span> : <span className="sol-redo" aria-hidden="true">↻</span>}
          {game.stock.length > 0 && <small className="sol-count" aria-hidden="true">{game.stock.length}</small>}
        </button>
        <div className="sol-slot sol-waste" aria-label="Cartas dadas vuelta">
          {game.waste.slice(-3).map((card, i, shown) => renderCard(card, i === shown.length - 1 ? { kind: 'waste' } : null, { left: i * cw * 0.22, zIndex: i }))}
        </div>
        <span className="sol-spacer" />
        {game.foundations.map((pile, f) => <div key={f} data-drop={`f${f}`} className={`sol-slot sol-foundation${dropTargets.has(`f${f}`) ? ' sol-slot--target' : ''}`} aria-label={`Base ${f + 1}${pile.length ? `: ${cardName(pile[pile.length - 1])}` : ', vacía'}`}>
          {!pile.length && <span className="sol-slot-mark" aria-hidden="true">A</span>}
          {pile.slice(-2).map((card, i, shown) => renderCard(card, i === shown.length - 1 ? { kind: 'foundation', pile: f } : null, { zIndex: i }))}
        </div>)}
      </div>
      <div className="sol-tableau">
        {game.tableau.map((pile, t) => {
          // Si una columna es muy larga, se aprietan las cartas para que entre en la pantalla.
          const downs = pile.filter(c => !c.up).length, ups = pile.length - downs;
          const want = { down: ch * 0.13, up: ch * 0.27 };
          const needed = downs * want.down + Math.max(0, ups - 1) * want.up;
          const k = needed > tableauHeight - ch ? (tableauHeight - ch) / needed : 1;
          let y = 0;
          return <div key={t} data-drop={`t${t}`} className={`sol-column${dropTargets.has(`t${t}`) ? ' sol-slot--target' : ''}`} style={{ height: tableauHeight }} aria-label={`Columna ${t + 1}`}>
            {!pile.length && <span className="sol-slot sol-slot-mark sol-slot--king" aria-hidden="true">K</span>}
            {pile.map((card, i) => {
              const top = y;
              y += (card.up ? want.up : want.down) * k;
              return renderCard(card, card.up ? { kind: 'tableau', pile: t, index: i } : null, { top, zIndex: i });
            })}
          </div>;
        })}
      </div>
      {canFinish(game) && !finishing && <button type="button" className="sol-finish" onClick={() => setFinishing(true)}>Terminar solo ▶</button>}
      {won && <div className="runner-overlay" role="dialog" aria-labelledby="sol-won">
        <div className="sol-confetti" aria-hidden="true">
          {Array.from({ length: 28 }, (_, i) => <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.25}s`, animationDuration: `${2.4 + (i % 5) * 0.4}s` }}><PixelSuit suit={SUITS[i % 4]} /></span>)}
        </div>
        <div>
          <h2 id="sol-won">¡GANASTE!</h2>
          <p>Lo terminaste en <strong>{clock(seconds)}</strong> con <strong>{game.moves}</strong> movimientos.{newRecord && ' ¡Nuevo récord!'}</p>
          <button type="button" onClick={restart} autoFocus>Jugar de nuevo</button>
        </div>
      </div>}
    </div>
  </section>;
}
