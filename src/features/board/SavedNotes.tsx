import { type DragEvent, type FormEvent, type KeyboardEvent, useRef, useState } from 'react';
import { useData } from '../../app/DataContext';
import { CalendarLink, DeskLink, GamesLink, SectionObjects } from '../../app/SectionObjects';
import { id, type Note } from '../../storage/model';
import { columns, formatHistoryDate, validHistory } from './Board';

const SAVED_NOTE_MIME = 'application/x-escritorio-saved-note';
const FOLDER_MIME = 'application/x-escritorio-note-folder';
const LOOSE = '';
// Las notas ordenadas a mano usan savedOrder; las recién guardadas (sin orden) aparecen primero, de la más nueva a la más vieja.
const bySavedOrder = (a: Note, b: Note) => {
  if (a.savedOrder === undefined && b.savedOrder === undefined) return (b.archivedAt as string).localeCompare(a.archivedAt as string);
  if (a.savedOrder === undefined) return -1;
  if (b.savedOrder === undefined) return 1;
  return a.savedOrder - b.savedOrder;
};
const withoutOrder = (note: Note) => { const next = { ...note }; delete next.savedOrder; return next; };

export function SavedNotes() {
  const { data, setData } = useData();
  const folders = data.noteFolders ?? [];
  const [view, setView] = useState(LOOSE);
  const [newFolder, setNewFolder] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [draggedFolder, setDraggedFolder] = useState<string | null>(null);
  const [folderDrop, setFolderDrop] = useState<{ id: string; side: 'before' | 'after' } | null>(null);
  const [noteDrop, setNoteDrop] = useState<{ id: string; side: 'before' | 'after' } | null>(null);
  const notesTop = useRef<HTMLDivElement>(null);
  const folder = folders.find(f => f.id === view);
  const currentView = folder ? folder.id : LOOSE;
  const saved = data.notes
    .filter(note => note.archivedAt)
    .sort(bySavedOrder);
  // Una nota cuya carpeta ya no existe se muestra como suelta.
  const folderOf = (note: Note) => note.savedFolder && folders.some(f => f.id === note.savedFolder) ? note.savedFolder : LOOSE;
  const visible = saved.filter(note => folderOf(note) === currentView);
  const countIn = (folderId: string) => saved.filter(note => folderOf(note) === folderId).length;

  const updateNote = (noteId: string, change: (note: Note) => Note) =>
    setData(current => ({ ...current, notes: current.notes.map(note => note.id === noteId ? change(note) : note) }));
  // Al cambiar de carpeta la nota pierde su lugar y aparece primera en la carpeta nueva.
  const moveTo = (noteId: string, folderId: string) => updateNote(noteId, note => {
    const next = withoutOrder(note);
    if (folderId) next.savedFolder = folderId;
    else delete next.savedFolder;
    return next;
  });
  const restore = (noteId: string) => updateNote(noteId, note => {
    const next = { ...withoutOrder(note), archivedAt: undefined };
    delete next.savedFolder;
    return next;
  });
  // Reordena las tarjetas de la vista actual y guarda el orden resultante.
  const placeNote = (noteId: string, targetId: string, side: 'before' | 'after') => {
    if (noteId === targetId) return;
    const ids = visible.map(note => note.id).filter(id => id !== noteId);
    const target = ids.indexOf(targetId);
    if (target < 0 || !visible.some(note => note.id === noteId)) return;
    ids.splice(side === 'before' ? target : target + 1, 0, noteId);
    const order = new Map(ids.map((id, index) => [id, index]));
    setData(current => ({ ...current, notes: current.notes.map(note => order.has(note.id) ? { ...note, savedOrder: order.get(note.id) } : note) }));
  };
  const shiftNote = (noteId: string, step: -1 | 1) => {
    const index = visible.findIndex(note => note.id === noteId);
    const neighbor = visible[index + step];
    if (neighbor) placeNote(noteId, neighbor.id, step < 0 ? 'before' : 'after');
  };
  const remove = (noteId: string, text: string) => {
    if (!confirm(`¿Borrar definitivamente “${text}”?`)) return;
    setData(current => ({ ...current, notes: current.notes.filter(note => note.id !== noteId) }));
  };

  const createFolder = (event: FormEvent) => {
    event.preventDefault();
    const name = newFolder.trim().replace(/\s+/g, ' ');
    if (!name) return;
    const folderId = id();
    setData(current => ({ ...current, noteFolders: [...(current.noteFolders ?? []), { id: folderId, name }] }));
    setNewFolder('');
  };
  const renameFolder = () => {
    if (!folder) return;
    const name = prompt('Nuevo nombre de la carpeta', folder.name)?.trim().replace(/\s+/g, ' ');
    if (!name || name === folder.name) return;
    setData(current => ({ ...current, noteFolders: (current.noteFolders ?? []).map(f => f.id === folder.id ? { ...f, name } : f) }));
  };
  // Borrar una carpeta no borra sus notas: vuelven a la lista de notas sueltas.
  const deleteFolder = () => {
    if (!folder) return;
    const count = countIn(folder.id);
    if (!confirm(count ? `¿Borrar la carpeta “${folder.name}”? Sus ${count} ${count === 1 ? 'nota vuelve' : 'notas vuelven'} a Sin carpeta.` : `¿Borrar la carpeta “${folder.name}”?`)) return;
    setView(LOOSE);
    setData(current => ({
      ...current,
      noteFolders: (current.noteFolders ?? []).filter(f => f.id !== folder.id),
      notes: current.notes.map(note => {
        if (note.savedFolder !== folder.id) return note;
        const next = { ...note };
        delete next.savedFolder;
        return next;
      }),
    }));
  };

  // Doble clic (o Enter) abre la carpeta y lleva la vista hasta sus notas.
  const openFolder = (folderId: string) => {
    setView(folderId);
    requestAnimationFrame(() => notesTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const openWithKeyboard = (event: KeyboardEvent<HTMLElement>, folderId: string) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openFolder(folderId); }
  };
  // Las carpetas se reordenan arrastrándolas; "Sin carpeta" queda siempre primera.
  const placeFolder = (folderId: string, targetId: string, side: 'before' | 'after') => setData(current => {
    const list = [...(current.noteFolders ?? [])];
    const from = list.findIndex(f => f.id === folderId);
    if (from < 0 || folderId === targetId) return current;
    const [moved] = list.splice(from, 1);
    const target = list.findIndex(f => f.id === targetId);
    if (target < 0) return current;
    list.splice(side === 'before' ? target : target + 1, 0, moved);
    return { ...current, noteFolders: list };
  });
  const shiftFolder = (folderId: string, step: -1 | 1) => {
    const index = folders.findIndex(f => f.id === folderId);
    const neighbor = folders[index + step];
    if (neighbor) placeFolder(folderId, neighbor.id, step < 0 ? 'before' : 'after');
  };
  const draggingFolder = (event: DragEvent<HTMLElement>) => Boolean(draggedFolder) || event.dataTransfer.types.includes(FOLDER_MIME);
  const draggedNote = (event: DragEvent<HTMLElement>) => draggedId || event.dataTransfer.getData(SAVED_NOTE_MIME);
  const sideOf = (event: DragEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return event.clientX < box.left + box.width / 2 ? 'before' as const : 'after' as const;
  };
  const clearFolderDrag = () => { setDraggedFolder(null); setFolderDrop(null); };
  const dropZone = (folderId: string) => ({
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (draggingFolder(event)) {
        if (!folderId || folderId === draggedFolder) { setFolderDrop(null); return; }
        event.preventDefault(); event.dataTransfer.dropEffect = 'move';
        setFolderDrop({ id: folderId, side: sideOf(event) });
        return;
      }
      if (!draggedId && !event.dataTransfer.types.includes(SAVED_NOTE_MIME)) return;
      event.preventDefault(); event.dataTransfer.dropEffect = 'move';
      setDropTarget(folderId);
    },
    onDragLeave: () => { setDropTarget(target => target === folderId ? null : target); setFolderDrop(target => target?.id === folderId ? null : target); },
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      if (draggingFolder(event)) {
        const moving = draggedFolder || event.dataTransfer.getData(FOLDER_MIME);
        if (moving && folderId && moving !== folderId) placeFolder(moving, folderId, sideOf(event));
        clearFolderDrag();
        return;
      }
      const noteId = draggedNote(event);
      if (noteId && saved.some(note => note.id === noteId)) moveTo(noteId, folderId);
      setDraggedId(null); setDropTarget(null);
    },
  });
  const tileClass = (folderId: string) => `saved-folder${currentView === folderId ? ' active' : ''}${dropTarget === folderId ? ' saved-folder--drop' : ''}${draggedFolder === folderId ? ' saved-folder--dragging' : ''}${folderDrop?.id === folderId ? ` saved-folder--insert-${folderDrop.side}` : ''}`;

  return (
    <section>
      <div className="section-title">
        <div><p className="eyebrow">Notas de vuelta a casa</p><h1>Disquete</h1></div>
        <SectionObjects large><DeskLink /><CalendarLink /><GamesLink /></SectionObjects>
      </div>
      <div className="floppy-page">
        <div className="floppy-page-body">
          <div className="floppy-page-shutter" aria-hidden="true"><span /></div>
          <div className="floppy-page-label">
            <div className="saved-folders" aria-label="Carpetas de notas guardadas">
              <div role="button" tabIndex={0} className={tileClass(LOOSE)} onClick={() => setView(LOOSE)} onDoubleClick={() => openFolder(LOOSE)} onKeyDown={event => openWithKeyboard(event, LOOSE)} aria-label={`Sin carpeta, ${countIn(LOOSE)} notas`} {...dropZone(LOOSE)}>
                <span aria-hidden="true">🗂️</span><strong>Sin carpeta</strong><small>{countIn(LOOSE)}</small>
              </div>
              {folders.map(f => (
                <div role="button" tabIndex={0} key={f.id} className={tileClass(f.id)} draggable title="Doble clic para abrir. Arrastrala para cambiarla de lugar."
                  onClick={() => setView(f.id)} onDoubleClick={() => openFolder(f.id)} onKeyDown={event => openWithKeyboard(event, f.id)}
                  aria-label={`Carpeta ${f.name}, ${countIn(f.id)} notas`}
                  onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData(FOLDER_MIME, f.id); setDraggedFolder(f.id); }}
                  onDragEnd={clearFolderDrag}
                  {...dropZone(f.id)}>
                  <span aria-hidden="true">📁</span><strong>{f.name}</strong><small>{countIn(f.id)}</small>
                </div>
              ))}
              <form className="saved-folder-new" onSubmit={createFolder}>
                <input aria-label="Nombre de la nueva carpeta" placeholder="Nueva carpeta" value={newFolder} onChange={event => setNewFolder(event.target.value)} />
                <button disabled={!newFolder.trim()}>Crear carpeta</button>
              </form>
            </div>
            <div ref={notesTop} className="saved-notes-top" />
            {folder && <div className="saved-folder-header">
              <h2>📁 {folder.name}</h2>
              <button type="button" className="saved-folder-shift" onClick={() => shiftFolder(folder.id, -1)} disabled={folders[0]?.id === folder.id} aria-label="Mover carpeta a la izquierda">◀</button>
              <button type="button" className="saved-folder-shift" onClick={() => shiftFolder(folder.id, 1)} disabled={folders.at(-1)?.id === folder.id} aria-label="Mover carpeta a la derecha">▶</button>
              <button type="button" onClick={renameFolder}>Editar nombre</button>
              <button type="button" className="delete" onClick={deleteFolder}>Borrar carpeta</button>
            </div>}
            {saved.length === 0
              ? <div className="empty"><h2>Todavía no guardaste ninguna nota</h2><p>Arrastrá una nota del escritorio hasta el disquete para guardarla acá.</p></div>
              : visible.length === 0
                ? <p className="saved-empty">{folder ? 'Carpeta vacía. Arrastrá notas hasta esta carpeta para guardarlas acá.' : 'No hay notas sin carpeta.'}</p>
                : <ul className="saved-list">
                  {visible.map(note => {
                    const history = validHistory(note);
                    return (
                      <li key={note.id} className={`saved-note${draggedId === note.id ? ' saved-note--dragging' : ''}${noteDrop?.id === note.id ? ` saved-note--insert-${noteDrop.side}` : ''}`} style={{ background: note.color }} draggable
                        aria-label={`${note.text}. Arrastrá la nota para ordenarla o hasta una carpeta.`}
                        onDragOver={event => {
                          if (draggingFolder(event) || (!draggedId && !event.dataTransfer.types.includes(SAVED_NOTE_MIME))) return;
                          if (draggedId === note.id) { setNoteDrop(null); return; }
                          event.preventDefault(); event.dataTransfer.dropEffect = 'move';
                          setNoteDrop({ id: note.id, side: sideOf(event) });
                        }}
                        onDragLeave={() => setNoteDrop(target => target?.id === note.id ? null : target)}
                        onDrop={event => {
                          if (draggingFolder(event)) return;
                          event.preventDefault();
                          const noteId = draggedNote(event);
                          if (noteId) placeNote(noteId, note.id, sideOf(event));
                          setDraggedId(null); setNoteDrop(null);
                        }}
                        onDragStart={event => {
                          if ((event.target as HTMLElement).closest('button, select, summary, details')) { event.preventDefault(); return; }
                          event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData(SAVED_NOTE_MIME, note.id); setDraggedId(note.id);
                        }}
                        onDragEnd={() => { setDraggedId(null); setDropTarget(null); setNoteDrop(null); }}>
                        <div className="note-text">{note.text}</div>
                        <small>Guardada el {formatHistoryDate(note.archivedAt as string)}</small>
                        <details><summary>Historial</summary>
                          {history.map((entry, index) => <div key={`${entry.at}-${index}`}>{columns.find(column => column.status === entry.status)?.label}: {formatHistoryDate(entry.at)}</div>)}
                        </details>
                        {folders.length > 0 && <select className="saved-move" aria-label={`Mover “${note.text}” a una carpeta`} value={folderOf(note)} onChange={event => moveTo(note.id, event.target.value)}>
                          <option value={LOOSE}>Sin carpeta</option>
                          {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>}
                        <div className="saved-note-actions">
                          <button onClick={() => restore(note.id)}>Restaurar</button>
                          <button className="delete" onClick={() => remove(note.id, note.text)}>Borrar</button>
                          <span className="saved-note-shift">
                            <button type="button" onClick={() => shiftNote(note.id, -1)} disabled={visible[0].id === note.id} aria-label={`Mover “${note.text}” antes`}>◀</button>
                            <button type="button" onClick={() => shiftNote(note.id, 1)} disabled={visible.at(-1)!.id === note.id} aria-label={`Mover “${note.text}” después`}>▶</button>
                          </span>
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
