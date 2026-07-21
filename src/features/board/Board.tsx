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

function Card({ note, move, remove, reorder, position, total, dragging, dropSide, onDragStart, onDragEnd }: {
  note: Note;
  move: (status: Status) => void;
  remove: () => void;
  reorder: (delta: -1 | 1) => void;
  position: number;
  total: number;
  dragging: boolean;
  dropSide?: 'before' | 'after';
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}) {
  const dragBlocked = useRef(false);
  const history = validHistory(note);
  const columnIndex = columns.findIndex(column => column.status === note.status);
  const previous = columns[columnIndex - 1];
  const next = columns[columnIndex + 1];
  return (
    <article data-note-id={note.id} className={`note${dragging ? ' note--dragging' : ''}${dropSide ? ` note--drop-${dropSide}` : ''}`} style={{ background: note.color }} draggable
      onPointerDownCapture={event => { dragBlocked.current = Boolean((event.target as HTMLElement).closest('button, summary, details, a, input, textarea, select')); }}
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
      <div className="note-order-actions" role="group" aria-label={`Cambiar orden: posición ${position} de ${total}`}>
        <button type="button" aria-label="Mover una posición antes" title="Mover una posición antes" disabled={position === 1} onClick={() => reorder(-1)}>⇤</button>
        <button type="button" aria-label="Mover una posición después" title="Mover una posición después" disabled={position === total} onClick={() => reorder(1)}>⇥</button>
      </div>
      <div className="note-actions" role="group" aria-label="Mover nota">
        {previous && <button type="button" aria-label={`Mover a ${previous.label}`} title={`Mover a ${previous.label}`} onClick={() => move(previous.status)}>←</button>}
        {next && <button type="button" aria-label={`Mover a ${next.label}`} title={`Mover a ${next.label}`} onClick={() => move(next.status)}>→</button>}
      </div>
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
  const clearDrag = () => { setDraggedId(null); setDropTarget(null); };
  const place = (noteId: string, status: Status, requestedIndex: number | ((notes: Note[]) => number)) => {
    const source = data.notes.find(note => note.id === noteId);
    if (!source) return;
    const at = new Date().toISOString();
    setData(current => {
      const index = typeof requestedIndex === 'function' ? requestedIndex(current.notes) : requestedIndex;
      const nextNotes = reorderNotes(current.notes, noteId, status, index, at);
      if (nextNotes === current.notes) return current;
      return { ...current, notes: nextNotes };
    });
    setAnnouncement(`${source.text}: orden actualizado en ${columns.find(column => column.status === status)?.label}`);
  };
  const move = (note: Note, status: Status) => {
    if (note.status === status) return;
    place(note.id, status, notes => notes.filter(item => item.status === status && item.id !== note.id).length);
  };
  const reorder = (note: Note, delta: -1 | 1) => {
    place(note.id, note.status, notes => {
      const siblings = notes.filter(item => item.status === note.status);
      const current = siblings.findIndex(item => item.id === note.id);
      return Math.max(0, Math.min(current + delta, siblings.length - 1));
    });
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
        <Link className="notebook" to="/diario" aria-label="Mi diario"><span className="notebook-binding" aria-hidden="true" /><span>Mi diario</span><small>Abrir libreta</small></Link>
        <Link className="calc-object" to="/gastos" aria-label="Gastos"><span aria-hidden="true">7 8 9<br />4 5 6<br />1 2 3</span><strong>Gastos</strong></Link>
      </div>
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
              return notes.map((note, noteIndex) => {
              const targetCard = dropTarget?.status === column.status && dropTarget.index < visibleWithoutDragged.length ? visibleWithoutDragged[dropTarget.index].id : null;
              const isLastTarget = dropTarget?.status === column.status && dropTarget.index === visibleWithoutDragged.length && note.id === visibleWithoutDragged.at(-1)?.id;
              return <Card key={note.id} note={note} move={status => move(note, status)} reorder={delta => reorder(note, delta)}
                position={noteIndex + 1} total={notes.length}
                dragging={draggedId === note.id} dropSide={targetCard === note.id ? 'before' : isLastTarget ? 'after' : undefined}
                onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData(NOTE_MIME, note.id); setDraggedId(note.id); }}
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
