import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { COLORS, id, Note, Status } from '../../storage/model';
import { useData } from '../../app/DataContext';

const columns: { status: Status; label: string }[] = [
  { status: 'todo', label: 'No iniciado' },
  { status: 'doing', label: 'En progreso' },
  { status: 'done', label: 'Terminado' },
];

function Card({ note, update, move, remove }: { note: Note; update: (patch: Partial<Note>) => void; move: (status: Status) => void; remove: () => void }) {
  const [draft, setDraft] = useState(note.text);
  const history = (note.history ?? []).filter(
    entry => columns.some(column => column.status === entry?.status) && !Number.isNaN(Date.parse(entry?.at)),
  );
  const columnIndex = columns.findIndex(column => column.status === note.status);
  const previous = columns[columnIndex - 1];
  const next = columns[columnIndex + 1];
  const commit = () => {
    const value = draft.trim();
    if (value) update({ text: value });
    else setDraft(note.text);
  };

  return (
    <article className="note" style={{ background: note.color }} draggable onDragStart={event => event.dataTransfer.setData('note', note.id)}>
      <textarea aria-label="Texto de nota" value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit} />
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
          <label>Color<select value={color} onChange={event => setColor(event.target.value)}>{COLORS.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
          <button>Agregar nota</button>
        </form>
      </div>
      <div className="desk-objects" aria-label="Objetos del escritorio">
        <Link className="notebook" to="/diario"><span>Mi diario</span><small>Abrir libreta</small></Link>
        <Link className="calc-object" to="/gastos"><span aria-hidden="true">7 8 9<br />4 5 6<br />1 2 3</span><strong>Gastos</strong></Link>
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
                update={patch => update(note.id, patch)}
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
