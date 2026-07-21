import { FormEvent, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { COLORS, id, Note, Status } from '../../storage/model';
import { useData } from '../../app/DataContext';

const columns: { status: Status; label: string }[] = [
  { status: 'todo', label: 'No iniciado' },
  { status: 'doing', label: 'En progreso' },
  { status: 'done', label: 'Terminado' },
];
const colorNames: Record<string, string> = {
  '#ffe783': 'Amarillo',
  '#f7b7c3': 'Rosa',
  '#bde7c6': 'Verde',
  '#bcdcf6': 'Celeste',
  '#e3c5f4': 'Lila',
};

function Card({ note, move, remove }: { note: Note; move: (status: Status) => void; remove: () => void }) {
  const dragBlocked = useRef(false);
  const history = (note.history ?? []).filter(
    entry => columns.some(column => column.status === entry?.status) && !Number.isNaN(Date.parse(entry?.at)),
  );
  const columnIndex = columns.findIndex(column => column.status === note.status);
  const previous = columns[columnIndex - 1];
  const next = columns[columnIndex + 1];
  return (
    <article className="note" style={{ background: note.color }} draggable onPointerDownCapture={event => {
      dragBlocked.current = Boolean((event.target as HTMLElement).closest('button, summary, details, a, input, textarea, select'));
    }} onDragEnd={() => { dragBlocked.current = false; }} onDragStart={event => {
      if (dragBlocked.current) {
        event.preventDefault();
        dragBlocked.current = false;
        return;
      }
      event.dataTransfer.setData('note', note.id);
    }}>
      <div className="note-text">{note.text}</div>
      <small>{history.at(-1) ? `Desde ${new Date(history.at(-1)!.at).toLocaleString()}` : 'Sin fecha disponible'}</small>
      <details>
        <summary>Historial</summary>
        {history.map((entry, index) => (
          <div key={`${entry.at}-${index}`}>{columns.find(column => column.status === entry.status)?.label}: {new Date(entry.at).toLocaleString()}</div>
        ))}
      </details>
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
  const update = (noteId: string, patch: Partial<Note>) => setData(current => ({
    ...current,
    notes: current.notes.map(note => note.id === noteId ? { ...note, ...patch } : note),
  }));
  const move = (note: Note, status: Status) => {
    if (note.status === status) return;
    const history = (note.history ?? []).filter(
      entry => columns.some(column => column.status === entry?.status) && !Number.isNaN(Date.parse(entry?.at)),
    );
    update(note.id, { status, history: [...history, { status, at: new Date().toISOString() }] });
  };
  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    const at = new Date().toISOString();
    setData(current => ({
      ...current,
      notes: [...current.notes, { id: id(), text: text.trim(), color, status: 'todo', history: [{ status: 'todo', at }] }],
    }));
    setText('');
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
      <div className="board">
        {columns.map(column => (
          <section className="column" key={column.status} onDragOver={event => event.preventDefault()} onDrop={event => {
            const note = data.notes.find(item => item.id === event.dataTransfer.getData('note'));
            if (note) move(note, column.status);
          }}>
            <h2>{column.label}<span>{data.notes.filter(note => note.status === column.status).length}</span></h2>
            {data.notes.filter(note => note.status === column.status).map(note => (
              <Card
                key={note.id}
                note={note}
                move={status => move(note, status)}
                remove={() => confirm('¿Borrar esta nota?') && setData(current => ({ ...current, notes: current.notes.filter(item => item.id !== note.id) }))}
              />
            ))}
          </section>
        ))}
      </div>
    </section>
  );
}
