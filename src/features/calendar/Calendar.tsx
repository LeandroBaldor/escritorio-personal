import { FormEvent, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useData } from '../../app/DataContext';
import { DeskLink, NotebookLink, CalculatorLink, GamesLink, SectionObjects } from '../../app/SectionObjects';
import { EVENT_CATEGORIES, id, syncMonthEntry, type CalendarEvent, type Expense, type EventCategory, type Note, type NoteCalendar } from '../../storage/model';
import { DateInput, formatExpenseDate, money } from '../expenses/Expenses';
import { calendarFrom, TimeInput } from './DateTimeFields';
import { DateQuestion } from './DateQuestion';
import { dateDoubt, dateOf, guessCategory, isoOf, parseEvent } from './parseEvent';
import memeInterstellar from '../../assets/images/meme-interstellar.jpg';

const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
// Nombre completo de cada día; en el celular (columnas angostas) se muestra la abreviatura.
const WEEK_HEADER = [['Lunes', 'Lun'], ['Martes', 'Mar'], ['Miércoles', 'Mié'], ['Jueves', 'Jue'], ['Viernes', 'Vie'], ['Sábado', 'Sáb'], ['Domingo', 'Dom']];
const MAX_CHIPS = 3;


// Cada categoría tiene su color (clase cal-cat--…).
export const categoryClass = (category: EventCategory) => `cal-cat--${category.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}`;
const longDate = (iso: string) => { const date = dateOf(iso); return `${DAY_NAMES[date.getDay()]} ${date.getDate()} de ${MONTH_NAMES[date.getMonth()]}`; };

type Item = { key: string; text: string; time?: string; category: EventCategory; event?: CalendarEvent; note?: Note; expense?: Expense; done?: boolean; source?: 'expense' | 'note' };
type Doubt = { note: Note; date: string | null; time: string | null };
const noteDay = (note: Note, today: Date) => { const created = note.history[0] ? new Date(note.history[0].at) : today; return Number.isNaN(created.getTime()) ? today : created; };

// Reloj de fondo del cartel del mes: marca la hora actual y se mueve cada minuto.
function BandClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(timer); }, []);
  const minute = now.getMinutes() * 6, hour = (now.getHours() % 12) * 30 + now.getMinutes() / 2;
  return <svg className="cal-band-clock" viewBox="-50 -50 100 100" aria-hidden="true">
    <circle r="46" fill="none" stroke="currentColor" strokeWidth="2.5" />
    {Array.from({ length: 12 }, (_, index) => <line key={index} y1="-42" y2={index % 3 ? '-38' : '-34'} stroke="currentColor" strokeWidth={index % 3 ? 1.5 : 3} transform={`rotate(${index * 30})`} />)}
    <line y2="-22" stroke="currentColor" strokeWidth="4" strokeLinecap="round" transform={`rotate(${hour})`} />
    <line y2="-33" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${minute})`} />
    <circle r="3" fill="currentColor" />
  </svg>;
}


// Editar una nota, tarea o gasto del día (se abre con el botón Editar): categoría, fecha (dd/mm/aaaa) y hora, uno debajo del otro, y Guardar.
function ItemEditor({ item, date, onSave, onCancel, onDelete }: { item: Item; date: string; onSave: (category: EventCategory, calendar: NoteCalendar) => void; onCancel: () => void; onDelete?: () => void }) {
  const fieldId = useId();
  const [category, setCategory] = useState(item.category);
  const [day, setDay] = useState(formatExpenseDate(date));
  const [hour, setHour] = useState(item.time ?? '');
  const calendar = calendarFrom(day, hour);
  return <form className="cal-item-form" aria-label={`Editar ${item.text}`} onSubmit={event => { event.preventDefault(); if (calendar) onSave(category, calendar); }}>
    <label>Categoría<select value={category} onChange={event => setCategory(event.target.value as EventCategory)}>
      {EVENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
    </select></label>
    <div className="cal-item-field"><label htmlFor={fieldId}>Fecha</label><DateInput id={fieldId} label={`Fecha de ${item.text}`} value={day} onChange={setDay} /></div>
    <label>Hora<TimeInput label={`Hora de ${item.text}`} value={hour} onChange={setHour} /></label>
    <div className="cal-item-actions">
      <button disabled={!calendar}>Guardar</button>
      <button type="button" className="cal-cancel" onClick={onCancel}>Cancelar</button>
      {onDelete && <button type="button" className="delete" onClick={onDelete}>Borrar</button>}
    </div>
  </form>;
}

// Semanas de lunes a domingo que cubren el mes entero (con los días del mes anterior y siguiente para completar).
function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
  const last = new Date(year, month + 1, 0);
  const days: Date[] = [];
  for (let day = start; day <= last || days.length % 7 !== 0; day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)) days.push(day);
  return days;
}


export function Calendar() {
  const { data, setData } = useData();
  const today = new Date();
  const todayIso = isoOf(today);
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState(todayIso);
  const [editing, setEditing] = useState<string | null>(null);
  const [newText, setNewText] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newCategory, setNewCategory] = useState<EventCategory | ''>('');
  const [announcement, setAnnouncement] = useState('');

  const byDay = new Map<string, Item[]>();
  const push = (date: string, item: Item) => byDay.set(date, [...(byDay.get(date) ?? []), item]);
  for (const event of data.events ?? []) push(event.date, { key: event.id, text: event.text, time: event.time, category: event.category, event });
  for (const expense of data.expenses) if (expense.date) push(expense.date, { key: `gasto-${expense.id}`, text: `${expense.concept} · ${money(expense.cents)}`, time: expense.time, category: expense.calendarCategory ?? 'Pagos', done: expense.paid ?? false, source: 'expense', expense });
  // Las notas del escritorio y de Guardadas con una fecha en el texto también aparecen; "13/10" sin año se toma desde el día en que se creó la nota.
  // Si la fecha se confirmó a mano (note.calendar) se usa esa; si el texto parece tener una fecha que no se entiende, se pregunta.
  const doubts: Doubt[] = [];
  for (const note of data.notes) {
    if (note.calendar === null) continue;
    const found = parseEvent(note.text, noteDay(note, today));
    const doubt = found.date ? null : dateDoubt(note.text, noteDay(note, today));
    const date = note.calendar?.date ?? found.date;
    const time = note.calendar ? note.calendar.time : found.time ?? undefined;
    if (date) push(date, { key: `nota-${note.id}`, text: doubt?.text ?? found.text, time, category: note.calendarCategory ?? guessCategory(note.text), done: note.status === 'done', source: 'note', note });
    else if (doubt) doubts.push({ note, date: doubt.date, time: doubt.time });
  }
  const itemsOf = (iso: string) => (byDay.get(iso) ?? []).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));

  const goTo = (iso: string) => { const date = dateOf(iso); setView({ year: date.getFullYear(), month: date.getMonth() }); setSelected(iso); };
  const shiftMonth = (delta: number) => setView(({ year, month }) => { const date = new Date(year, month + delta, 1); return { year: date.getFullYear(), month: date.getMonth() }; });
  const setNoteCalendar = (note: Note, calendar: NoteCalendar | null) => {
    setData(d => ({ ...d, notes: d.notes.map(n => n.id === note.id ? { ...n, calendar } : n) }));
    if (calendar) { goTo(calendar.date); setAnnouncement(`${note.text}: anotado el ${longDate(calendar.date)}`); }
  };
  // Guardar lo editado en el panel del día: las tareas cambian su categoría, día y hora; las notas lo guardan en calendar y calendarCategory.
  const saveItem = (item: Item, category: EventCategory, calendar: NoteCalendar) => {
    if (item.event) setData(d => ({ ...d, events: (d.events ?? []).map(e => {
      if (e.id !== item.event!.id) return e;
      const next: CalendarEvent = { ...e, category, date: calendar.date };
      if (calendar.time) next.time = calendar.time; else delete next.time;
      return next;
    }) }));
    else if (item.note) setData(d => ({ ...d, notes: d.notes.map(n => n.id === item.note!.id ? { ...n, calendar, calendarCategory: category } : n) }));
    else if (item.expense) setData(d => {
      const current = d.expenses.find(e => e.id === item.expense!.id);
      if (!current) return d;
      const next: Expense = { ...current, date: calendar.date, calendarCategory: category };
      if (calendar.time) next.time = calendar.time; else delete next.time;
      return { ...d, expenses: d.expenses.map(e => e.id === next.id ? next : e), expenseMonths: syncMonthEntry(d.expenseMonths, next) };
    });
    setEditing(null);
    goTo(calendar.date);
    setAnnouncement(`${item.text}: guardado el ${longDate(calendar.date)}`);
  };
  const taskDay = newDate || formatExpenseDate(selected);
  const taskCalendar = calendarFrom(taskDay, newTime);
  const taskCategory = newCategory || guessCategory(newText);
  const addTask = (submit: FormEvent) => {
    submit.preventDefault();
    if (!newText.trim() || !taskCalendar) return;
    const event: CalendarEvent = { id: id(), text: newText.trim(), date: taskCalendar.date, category: taskCategory };
    if (taskCalendar.time) event.time = taskCalendar.time;
    setData(d => ({ ...d, events: [...(d.events ?? []), event] }));
    setNewText(''); setNewDate(''); setNewTime(''); setNewCategory('');
    goTo(event.date);
    setAnnouncement(`${event.text}: anotado el ${longDate(event.date)}`);
  };
  const removeEvent = (event: CalendarEvent) => { if (confirm(`¿Borrar "${event.text}"?`)) setData(d => ({ ...d, events: (d.events ?? []).filter(e => e.id !== event.id) })); };

  const days = monthGrid(view.year, view.month);
  const weeks = days.length / 7;
  const gridRef = useRef<HTMLDivElement>(null);
  const [rowHeight, setRowHeight] = useState<number | null>(null);
  // Días cuadrados: en la compu cada fila mide lo mismo que el ancho de un día (así se sabe cuántas cosas entran).
  // En pantallas táctiles (celulares y tablets) las filas crecen lo necesario para que cada tarea se lea entera.
  useLayoutEffect(() => {
    const fit = () => {
      const grid = gridRef.current;
      const day = grid?.querySelector<HTMLElement>('.cal-day');
      if (!grid || !day || window.innerWidth <= 1000 || window.matchMedia?.('(pointer:coarse)').matches) { setRowHeight(null); return; }
      setRowHeight(Math.round(day.getBoundingClientRect().width));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [weeks]);
  // Con filas ajustadas cada cosa ocupa una línea (unos 30px con el espacio) debajo del número del día.
  const chipLimit = rowHeight === null ? MAX_CHIPS : Math.max(1, Math.min(MAX_CHIPS, Math.floor((rowHeight - 36) / 30)));
  const selectedItems = itemsOf(selected);

  return <section className="cal-page">
    <div className="section-title">
      <div><p className="eyebrow">Lo que se viene</p><h1>Calendario</h1></div>
      {/* El meme ocupa el lugar libre del encabezado y se apoya sobre el borde de arriba del calendario. */}
      <div className="cal-art-room" aria-hidden="true"><img className="cal-art" src={memeInterstellar} alt="" width={917} height={497} draggable={false} /></div>
      <SectionObjects large><DeskLink /><NotebookLink /><CalculatorLink /><GamesLink /></SectionObjects>
    </div>


    <div className="cal-layout">
      <div className="cal-sheet">
        <div className="cal-rings" aria-hidden="true"><span /><span /></div>
        <div className="cal-band-wrap">
          <div className="cal-band">
            <button type="button" className="cal-arrow" onClick={() => shiftMonth(-1)} aria-label="Mes anterior">‹</button>
            <BandClock />
            <h2 aria-live="polite" style={{ '--len': MONTH_NAMES[view.month].length + 5 } as React.CSSProperties}><span>{MONTH_NAMES[view.month]}</span><small>{view.year}</small></h2>
            <button type="button" className="cal-arrow" onClick={() => shiftMonth(1)} aria-label="Mes siguiente">›</button>
          </div>
        </div>
        <div className="cal-toolbar">
          <ul className="cal-legend" aria-label="Colores">
            {EVENT_CATEGORIES.map(c => <li key={c}><span className={`cal-dot ${categoryClass(c)}`} aria-hidden="true" />{c}</li>)}
          </ul>
          <button type="button" className="cal-today" onClick={() => goTo(todayIso)}>Hoy</button>
        </div>
        <div ref={gridRef} className={`cal-grid${rowHeight !== null ? ' cal-grid--compact' : ''}`} style={rowHeight ? { gridTemplateRows: `auto repeat(${weeks}, ${rowHeight}px)` } : undefined}>
          {WEEK_HEADER.map(([name, short], index) => <div key={name} className={`cal-weekday${index >= 5 ? ' cal-weekday--weekend' : ''}`} aria-hidden="true"><span className="cal-weekday-full">{name}</span><span className="cal-weekday-short">{short}</span></div>)}
          {days.map(day => {
            const iso = isoOf(day);
            const items = itemsOf(iso);
            const outside = day.getMonth() !== view.month;
            const weekend = day.getDay() === 0 || day.getDay() === 6;
            return <button type="button" key={iso} onClick={() => setSelected(iso)}
              className={`cal-day${outside ? ' cal-day--outside' : ''}${weekend ? ' cal-day--weekend' : ''}${iso === todayIso ? ' cal-day--today' : ''}${iso === selected ? ' cal-day--selected' : ''}`}
              aria-label={`${longDate(iso)}${items.length ? `, ${items.length} ${items.length === 1 ? 'cosa' : 'cosas'}` : ''}`} aria-pressed={iso === selected}>
              <span className="cal-day-number">{day.getDate()}</span>
              <span className="cal-chips" aria-hidden="true">
                {items.slice(0, chipLimit).map(item => <span key={item.key} className={`cal-chip ${categoryClass(item.category)}${item.done ? ' cal-chip--done' : ''}`}>{item.time && <><b>{item.time}</b> </>}{item.text}</span>)}
                {items.length > chipLimit && <span className="cal-more">+{items.length - chipLimit}{chipLimit > 1 ? ' más' : ''}</span>}
              </span>
            </button>;
          })}
        </div>
      </div>

      <aside className="cal-day-panel" aria-label="Panel del calendario">
        <section className="cal-card cal-card--day" aria-labelledby="cal-day-title">
          <header className="cal-card-head">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
            <h2 id="cal-day-title">{longDate(selected)}</h2>
            {selectedItems.length > 0 && <span className="cal-card-count" aria-label={`${selectedItems.length} ${selectedItems.length === 1 ? 'cosa' : 'cosas'}`}>{selectedItems.length}</span>}
          </header>
          <div className="cal-card-body">
        {selectedItems.length === 0
          ? <p className="cal-empty">No hay nada anotado para este día.</p>
          : <ul className="cal-items">
            {selectedItems.map(item => <li key={item.key} className={`cal-item ${categoryClass(item.category)}`}>
              <div className="cal-item-text">
                {item.time && <b>{item.time}</b>}
                <span className={item.done ? 'cal-done' : undefined}>{item.text}</span>
                <small>{item.source === 'expense' ? `Mis gastos · ${item.done ? 'Pagado' : 'No pagado'}` : item.note ? (item.note.archivedAt ? 'Nota guardada' : 'Nota del escritorio') : 'Tarea del calendario'} · {item.category}</small>
              </div>
              {editing === `${item.key}-${selected}`
                ? <ItemEditor key={`${item.key}-${selected}`} item={item} date={selected} onSave={(category, calendar) => saveItem(item, category, calendar)} onCancel={() => setEditing(null)} onDelete={item.event ? () => removeEvent(item.event!) : undefined} />
                : <div className="cal-item-actions"><button type="button" className="cal-edit-button" onClick={() => setEditing(`${item.key}-${selected}`)} aria-label={`Editar ${item.text}`}>Editar</button></div>}
            </li>)}
          </ul>}
          </div>
        </section>
        <form className="cal-card cal-card--add" onSubmit={addTask} aria-labelledby="cal-add-title">
          <header className="cal-card-head">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>
            <h3 id="cal-add-title">Agregar tarea</h3>
          </header>
          <div className="cal-card-body cal-add">
          <label>Qué es<input value={newText} onChange={e => setNewText(e.target.value)} placeholder="Ej. Turno Altamar" /></label>
          <div className="cal-add-row">
            <div className="cal-add-field"><label htmlFor="cal-add-day">Día</label><DateInput id="cal-add-day" label="Día" value={taskDay} onChange={setNewDate} /></div>
            <label>Hora<TimeInput label="Hora" value={newTime} onChange={setNewTime} /></label>
          </div>
          <label>Categoría<select value={taskCategory} onChange={e => setNewCategory(e.target.value as EventCategory)}>
            {EVENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select></label>
          <button disabled={!newText.trim() || !taskCalendar}>Agregar</button>
          </div>
        </form>
        {doubts.length > 0 && <section className="cal-card cal-card--doubts" aria-labelledby="cal-doubts-title">
          <header className="cal-card-head">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17h.01" /></svg>
            <h3 id="cal-doubts-title">¿Son fechas?</h3>
            <span className="cal-card-count">{doubts.length}</span>
          </header>
          <div className="cal-card-body cal-doubts">
            <p>Estas notas parecen tener una fecha que no entendí. Con la flecha van al calendario; con la X dejo de preguntar.</p>
            <ul>{doubts.map(doubt => <li key={doubt.note.id}><DateQuestion text={doubt.note.text} date={doubt.date} time={doubt.time} onSave={calendar => setNoteCalendar(doubt.note, calendar)} /></li>)}</ul>
          </div>
        </section>}
      </aside>
    </div>
    <div className="sr-only" aria-live="polite">{announcement}</div>
  </section>;
}
