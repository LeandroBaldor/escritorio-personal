import { useData } from '../../app/DataContext';
import { columns, formatHistoryDate, validHistory } from './Board';

export function SavedNotes() {
  const { data, setData } = useData();
  const saved = data.notes
    .filter(note => note.archivedAt)
    .sort((a, b) => (b.archivedAt as string).localeCompare(a.archivedAt as string));

  const restore = (noteId: string) =>
    setData(current => ({ ...current, notes: current.notes.map(note => note.id === noteId ? { ...note, archivedAt: undefined } : note) }));
  const remove = (noteId: string, text: string) => {
    if (!confirm(`¿Borrar definitivamente “${text}”?`)) return;
    setData(current => ({ ...current, notes: current.notes.filter(note => note.id !== noteId) }));
  };

  return (
    <section>
      <div className="section-title">
        <div><p className="eyebrow">Notas de vuelta a casa</p><h1>Disquete</h1></div>
      </div>
      <div className="floppy-page">
        <div className="floppy-page-body">
          <div className="floppy-page-shutter" aria-hidden="true"><span /></div>
          <div className="floppy-page-label">
            {saved.length === 0
              ? <div className="empty"><h2>Todavía no guardaste ninguna nota</h2><p>Arrastrá una nota del escritorio hasta el disquete para guardarla acá.</p></div>
              : <ul className="saved-list">
                {saved.map(note => {
                  const history = validHistory(note);
                  return (
                    <li key={note.id} className="saved-note" style={{ background: note.color }}>
                      <div className="note-text">{note.text}</div>
                      <small>Guardada el {formatHistoryDate(note.archivedAt as string)}</small>
                      <details><summary>Historial</summary>
                        {history.map((entry, index) => <div key={`${entry.at}-${index}`}>{columns.find(column => column.status === entry.status)?.label}: {formatHistoryDate(entry.at)}</div>)}
                      </details>
                      <div className="saved-note-actions">
                        <button onClick={() => restore(note.id)}>Restaurar</button>
                        <button className="delete" onClick={() => remove(note.id, note.text)}>Borrar</button>
                      </div>
                    </li>
                  );
                })}
              </ul>}
          </div>
        </div>
      </div>
    </section>
  );
}
