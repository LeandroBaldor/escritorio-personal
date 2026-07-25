import { DragEvent, FormEvent, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { COLORS, id, Note, Status } from '../../storage/model';
import { useData } from '../../app/DataContext';

const NOTE_MIME = 'application/x-escritorio-note';
const columns: { status: Status; label: string }[] = [
  { status: 'todo', label: 'No iniciado' },
  { status: 'doing', label: 'En progreso' },
  { status: 'done', label: 'Terminado' },
];
const colorNames: Record<string, string> = {
  '#ffe783': 'Amarillo', '#f7b7c3': 'Rosa', '#bde7c6': 'Verde', '#bcdcf6': 'Celeste', '#e3c5f4': 'Lila',
};
type DropTarget = { status: Status; index: number };

function validHistory(note: Note) {
  return (note.history ?? []).filter(
    entry => columns.some(column => column.status === entry?.status) && !Number.isNaN(Date.parse(entry?.at)),
  );
}

function reorderNotes(notes: Note[], noteId: string, targetStatus: Status, requestedIndex: number, at: string): Note[] {
  if (notes.filter(note => note.id === noteId).length !== 1) return notes;
  const sourceIndex = notes.findIndex(note => note.id === noteId);
  if (sourceIndex < 0 || !columns.some(column => column.status === targetStatus)) return notes;
  const source = notes[sourceIndex];
  const destination = notes.filter(note => note.status === targetStatus && note.id !== noteId);
  const targetIndex = Math.max(0, Math.min(requestedIndex, destination.length));
  const withoutSource = notes.filter(note => note.id !== noteId);
  let globalIndex: number;
  if (targetIndex < destination.length) {
    globalIndex = withoutSource.findIndex(note => note.id === destination[targetIndex].id);
  } else if (destination.length) {
    globalIndex = withoutSource.findIndex(note => note.id === destination.at(-1)!.id) + 1;
  } else {
    globalIndex = withoutSource.length;
  }
  const moved = source.status === targetStatus
    ? source
    : { ...source, status: targetStatus, history: [...validHistory(source), { status: targetStatus, at }] };
  const result = [...withoutSource.slice(0, globalIndex), moved, ...withoutSource.slice(globalIndex)];
  return source.status === targetStatus && result.every((note, index) => note === notes[index]) ? notes : result;
}

function insertionIndex(column: HTMLElement, draggedId: string, x: number, y: number) {
  const cards = Array.from(column.querySelectorAll<HTMLElement>('.note'))
    .filter(card => card.dataset.noteId !== draggedId);
  if (!cards.length) return 0;
  const tolerance = 8;
  let rowStart = 0;
  while (rowStart < cards.length) {
    const firstRect = cards[rowStart].getBoundingClientRect();
    let rowEnd = rowStart + 1;
    let rowBottom = firstRect.bottom;
    while (rowEnd < cards.length) {
      const rect = cards[rowEnd].getBoundingClientRect();
      if (Math.abs(rect.top - firstRect.top) > tolerance) break;
      rowBottom = Math.max(rowBottom, rect.bottom);
      rowEnd += 1;
    }
    if (y < firstRect.top - tolerance) return rowStart;
    if (y <= rowBottom + tolerance) {
      for (let index = rowStart; index < rowEnd; index += 1) {
        const rect = cards[index].getBoundingClientRect();
        if (x < rect.left + rect.width / 2) return index;
      }
      return rowEnd;
    }
    rowStart = rowEnd;
  }
  return cards.length;
}

function Card({ note, remove, dragging, dropSide, onDragStart, onDragEnd, onTouchPointerDown, onTouchPointerMove, onTouchPointerUp }: {
  note: Note;
  remove: () => void;
  dragging: boolean;
  dropSide?: 'before' | 'after';
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onTouchPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onTouchPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onTouchPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
}) {
  const dragBlocked = useRef(false);
  const history = validHistory(note);
  return (
    <article data-note-id={note.id} className={`note${dragging ? ' note--dragging' : ''}${dropSide ? ` note--drop-${dropSide}` : ''}`} style={{ background: note.color }} draggable aria-label={`${note.text}. Arrastrá la tarjeta para moverla.`}
      onPointerDownCapture={event => { dragBlocked.current = Boolean((event.target as HTMLElement).closest('button, summary, details, a, input, textarea, select')); }}
      onPointerDown={event => { if (!dragBlocked.current) onTouchPointerDown(event); }}
      onPointerMove={onTouchPointerMove}
      onPointerUp={onTouchPointerUp}
      onPointerCancel={onTouchPointerUp}
      onDragEnd={() => { dragBlocked.current = false; onDragEnd(); }}
      onDragStart={event => {
        if (dragBlocked.current || (event.target as HTMLElement).closest('button, summary, details, a, input, textarea, select')) {
          event.preventDefault(); dragBlocked.current = false; return;
        }
        onDragStart(event);
      }}>
      <div className="note-text">{note.text}</div>
      <small>{history.at(-1) ? `Desde ${new Date(history.at(-1)!.at).toLocaleString()}` : 'Sin fecha disponible'}</small>
      <details><summary>Historial</summary>{history.map((entry, index) => <div key={`${entry.at}-${index}`}>{columns.find(column => column.status === entry.status)?.label}: {new Date(entry.at).toLocaleString()}</div>)}</details>
      <button className="delete" onClick={remove}>Borrar</button>
    </article>
  );
}

export function Board() {
  const { data, setData } = useData();
  const [text, setText] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const pointerDrag = useRef<{ id: string; pointerId: number; startX: number; startY: number; active: boolean } | null>(null);
  const clearDrag = () => { setDraggedId(null); setDropTarget(null); };
  const place = (noteId: string, status: Status, requestedIndex: number | ((notes: Note[]) => number)) => {
    const source = data.notes.find(note => note.id === noteId);
    if (!source) return;
    const at = new Date().toISOString();
    const initialIndex = typeof requestedIndex === 'function' ? requestedIndex(data.notes) : requestedIndex;
    if (reorderNotes(data.notes, noteId, status, initialIndex, at) === data.notes) return;
    setData(current => {
      const index = typeof requestedIndex === 'function' ? requestedIndex(current.notes) : requestedIndex;
      const nextNotes = reorderNotes(current.notes, noteId, status, index, at);
      if (nextNotes === current.notes) return current;
      return { ...current, notes: nextNotes };
    });
    setAnnouncement(`${source.text}: orden actualizado en ${columns.find(column => column.status === status)?.label}`);
  };
  const add = (event: FormEvent) => {
    event.preventDefault(); if (!text.trim()) return;
    const at = new Date().toISOString();
    setData(current => ({ ...current, notes: [...current.notes, { id: id(), text: text.trim(), color, status: 'todo', history: [{ status: 'todo', at }] }] }));
    setText('');
  };
  const dragId = (event: DragEvent) => event.dataTransfer.getData(NOTE_MIME);
  const updateTarget = (event: DragEvent<HTMLElement>, status: Status) => {
    const noteId = draggedId || dragId(event);
    if (!noteId || !data.notes.some(note => note.id === noteId)) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'move';
    const index = insertionIndex(event.currentTarget, noteId, event.clientX, event.clientY);
    setDropTarget(current => current?.status === status && current.index === index ? current : { status, index });
  };
  const pointerTarget = (event: React.PointerEvent<HTMLElement>) => {
    const column = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('.column');
    const status = column?.dataset.status as Status | undefined;
    if (!column || !status || !columns.some(item => item.status === status)) return null;
    return { status, index: insertionIndex(column, pointerDrag.current?.id ?? '', event.clientX, event.clientY) };
  };
  const startTouchDrag = (event: React.PointerEvent<HTMLElement>, noteId: string) => {
    if (event.pointerType === 'mouse') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerDrag.current = { id: noteId, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false };
  };
  const moveTouchDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = pointerDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 8) return;
    drag.active = true;
    event.preventDefault();
    setDraggedId(drag.id);
    const target = pointerTarget(event);
    setDropTarget(current => target && current?.status === target.status && current.index === target.index ? current : target);
  };
  const endTouchDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = pointerDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const target = drag.active ? pointerTarget(event) : null;
    pointerDrag.current = null;
    if (target) place(drag.id, target.status, target.index);
    clearDrag();
  };
  return (
    <section>
      <div className="section-title">
        <div><p className="eyebrow">Tu mesa de hoy</p><h1>Notas del escritorio</h1></div>
        <form onSubmit={add} className="new-note">
          <label>Nueva nota<input value={text} onChange={event => setText(event.target.value)} placeholder="¿Qué necesitás recordar?" /></label>
          <fieldset className="color-picker"><legend>Color</legend>{COLORS.map(option => <button key={option} type="button" className={color === option ? 'chosen' : ''} style={{ backgroundColor: option }} aria-label={colorNames[option]} title={colorNames[option]} aria-pressed={color === option} onClick={() => setColor(option)}><span aria-hidden="true">✓</span></button>)}</fieldset>
          <button>Agregar nota</button>
        </form>
      </div>
      <div className="desk-objects" aria-label="Objetos del escritorio">
        <svg className="desk-arrow" aria-hidden="true" width="100" height="57" viewBox="0 0 100 50" fill="none">
          <path d="M4 32 C 24 40, 46 14, 76 21" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M76 21 L61 13" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M76 21 L69 35" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <Link className="notebook" to="/diario" aria-label="Mi diario"><span className="notebook-binding" aria-hidden="true" /><span>Mi diario</span><small>Abrir libreta</small></Link>
        <Link className="calc-object" to="/gastos" aria-label="Gastos"><span aria-hidden="true">7 8 9<br />4 5 6<br />1 2 3</span><strong>Gastos</strong></Link>
      </div>
      <p className="drag-hint">Arrastrá cualquier nota para cambiarla de lugar o de sección.</p>
      <div className="board" onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget(null); }}>
        {columns.map(column => {
          const notes = data.notes.filter(note => note.status === column.status);
          return <section className={`column${dropTarget?.status === column.status ? ' column--drag-over' : ''}`} data-status={column.status} key={column.status}
            onDragOver={event => updateTarget(event, column.status)} onDrop={event => {
              event.preventDefault();
              const noteId = dragId(event);
              if (noteId && data.notes.some(note => note.id === noteId)) {
                const index = insertionIndex(event.currentTarget, noteId, event.clientX, event.clientY);
                place(noteId, column.status, index);
              }
              clearDrag();
            }}>
            <h2>{column.label}<span>{notes.length}</span></h2>
            {(() => {
              const visibleWithoutDragged = notes.filter(item => item.id !== draggedId);
              return notes.map(note => {
              const targetCard = dropTarget?.status === column.status && dropTarget.index < visibleWithoutDragged.length ? visibleWithoutDragged[dropTarget.index].id : null;
              const isLastTarget = dropTarget?.status === column.status && dropTarget.index === visibleWithoutDragged.length && note.id === visibleWithoutDragged.at(-1)?.id;
              return <Card key={note.id} note={note}
                dragging={draggedId === note.id} dropSide={targetCard === note.id ? 'before' : isLastTarget ? 'after' : undefined}
                onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData(NOTE_MIME, note.id); setDraggedId(note.id); }}
                onTouchPointerDown={event => startTouchDrag(event, note.id)} onTouchPointerMove={moveTouchDrag} onTouchPointerUp={endTouchDrag}
                onDragEnd={clearDrag} remove={() => confirm('¿Borrar esta nota?') && setData(current => ({ ...current, notes: current.notes.filter(item => item.id !== note.id) }))} />;
              });
            })()}
            {dropTarget?.status === column.status && notes.filter(note => note.id !== draggedId).length === 0 && <div className="drop-indicator" aria-hidden="true" />}
          </section>;
        })}
      </div>
      <div className="sr-only" aria-live="polite">{announcement}</div>
    </section>
  );
}
