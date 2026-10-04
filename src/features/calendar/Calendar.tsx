import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../../app/DataContext';
import { DeskLink, NotebookLink, CalculatorLink, SectionObjects } from '../../app/SectionObjects';
import { EVENT_CATEGORIES, type CalendarEvent, type EventCategory, type Note, type NoteCalendar } from '../../storage/model';
import { money } from '../expenses/Expenses';
import { dateDoubt, dateOf, guessCategory, isoOf, parseEvent } from './parseEvent';

const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const WEEK_HEADER = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const MAX_CHIPS = 3;

// Cada categoría tiene su color (clase cal-cat--…).
export const categoryClass = (category: EventCategory) => `cal-cat--${category.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}`;
const longDate = (iso: string) => { const date = dateOf(iso); return `${DAY_NAMES[date.getDay()]} ${date.getDate()} de ${MONTH_NAMES[date.getMonth()]}`; };

type Item = { key: string; text: string; time?: string; category: EventCategory; event?: CalendarEvent; note?: Note; done?: boolean; source?: 'expense' | 'note' };
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

// Cambiar a mano la fecha de una nota que ya está en el calendario.
function NoteDateForm({ note, date, time, onSave, onCancel }: { note: Note; date: string; time: string | null; onSave: (calendar: NoteCalendar) => void; onCancel: () => void }) {
  const [day, setDay] = useState(date);
  const [hour, setHour] = useState(time ?? '');
  return <div className="cal-note-date">
    <div className="cal-edit-row">
      <input aria-label={`Día de ${note.text}`} type="date" value={day} onChange={e => setDay(e.target.value)} />
      <input aria-label={`Hora de ${note.text}`} type="time" value={hour} onChange={e => setHour(e.target.value)} />
    </div>
    <div className="cal-edit-row">
      <button type="button" disabled={!day} onClick={() => onSave(hour ? { date: day, time: hour } : { date: day })}>Guardar fecha</button>
      <button type="button" className="cal-secondary" onClick={onCancel}>Cancelar</button>
    </div>
  </div>;
}

// Una nota con una posible fecha: la flecha la pone en el calendario (con el día que se puede cambiar), la X deja de preguntar.
function DoubtRow({ doubt, onSave }: { doubt: Doubt; onSave: (calendar: NoteCalendar | null) => void }) {
  const [day, setDay] = useState(doubt.date ?? '');
  return <li className="cal-doubt">
    <span className="cal-doubt-text">{doubt.note.text}</span>
    <input aria-label={`Día de ${doubt.note.text}`} type="date" value={day} onChange={e => setDay(e.target.value)} />
    <button type="button" className="cal-doubt-ok" disabled={!day} onClick={() => onSave(doubt.time ? { date: day, time: doubt.time } : { date: day })} aria-label={`Sí, ${doubt.note.text} es una fecha`} title="Sí, poner en el calendario">→</button>
    <button type="button" className="cal-doubt-no" onClick={() => onSave(null)} aria-label={`${doubt.note.text} no es una fecha`} title="No es una fecha">✕</button>
  </li>;
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

function EventEditor({ event, onSave, onCancel }: { event: CalendarEvent; onSave: (event: CalendarEvent) => void; onCancel: () => void }) {
  const [text, setText] = useState(event.text);
  const [date, setDate] = useState(event.date);
  const [time, setTime] = useState(event.time ?? '');
  const [category, setCategory] = useState(event.category);
  const save = (submit: FormEvent) => {
    submit.preventDefault();
    if (!text.trim() || !date) return;
    const next: CalendarEvent = { ...event, text: text.trim(), date, category };
    if (time) next.time = time; else delete next.time;
    onSave(next);
  };
  return <form className="cal-edit" onSubmit={save} aria-label={`Editar ${event.text}`}>
    <input aria-label="Qué pasa" value={text} onChange={e => setText(e.target.value)} />
    <div className="cal-edit-row">
      <input aria-label="Día" type="date" value={date} onChange={e => setDate(e.target.value)} />
      <input aria-label="Hora" type="time" value={time} onChange={e => setTime(e.target.value)} />
      <select aria-label="Tipo" value={category} onChange={e => setCategory(e.target.value as EventCategory)}>
        {EVENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
    <div className="cal-edit-row">
      <button disabled={!text.trim() || !date}>Guardar</button>
      <button type="button" className="cal-secondary" onClick={onCancel}>Cancelar</button>
    </div>
  </form>;
}

export function Calendar() {
  const { data, setData } = useData();
  const today = new Date();
  const todayIso = isoOf(today);
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState(todayIso);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [movingNoteId, setMovingNoteId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const byDay = new Map<string, Item[]>();
  const push = (date: string, item: Item) => byDay.set(date, [...(byDay.get(date) ?? []), item]);
  for (const event of data.events ?? []) push(event.date, { key: event.id, text: event.text, time: event.time, category: event.category, event });
  for (const expense of data.expenses) if (expense.date) push(expense.date, { key: `gasto-${expense.id}`, text: `${expense.concept} · ${money(expense.cents)}`, category: 'Pagos', done: expense.paid ?? false, source: 'expense' });
  // Las notas del escritorio y de Guardadas con una fecha en el texto también aparecen; "13/10" sin año se toma desde el día en que se creó la nota.
  // Si la fecha se confirmó a mano (note.calendar) se usa esa; si el texto parece tener una fecha que no se entiende, se pregunta.
  const doubts: Doubt[] = [];
  for (const note of data.notes) {
    if (note.calendar === null) continue;
    const found = parseEvent(note.text, noteDay(note, today));
    const doubt = found.date ? null : dateDoubt(note.text, noteDay(note, today));
    const date = note.calendar?.date ?? found.date;
    const time = note.calendar ? note.calendar.time : found.time ?? undefined;
    if (date) push(date, { key: `nota-${note.id}`, text: doubt?.text ?? found.text, time, category: guessCategory(note.text), done: note.status === 'done', source: 'note', note });
    else if (doubt) doubts.push({ note, date: doubt.date, time: doubt.time });
  }
  const itemsOf = (iso: string) => (byDay.get(iso) ?? []).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));

  const goTo = (iso: string) => { const date = dateOf(iso); setView({ year: date.getFullYear(), month: date.getMonth() }); setSelected(iso); };
  const shiftMonth = (delta: number) => setView(({ year, month }) => { const date = new Date(year, month + delta, 1); return { year: date.getFullYear(), month: date.getMonth() }; });
  const saveEvent = (event: CalendarEvent) => { setData(d => ({ ...d, events: (d.events ?? []).map(e => e.id === event.id ? event : e) })); setEditingId(null); goTo(event.date); };
  const setNoteCalendar = (note: Note, calendar: NoteCalendar | null) => {
    setData(d => ({ ...d, notes: d.notes.map(n => n.id === note.id ? { ...n, calendar } : n) }));
    setMovingNoteId(null);
    if (calendar) { goTo(calendar.date); setAnnouncement(`${note.text}: anotado el ${longDate(calendar.date)}`); }
  };
  const removeEvent = (event: CalendarEvent) => { if (confirm(`¿Borrar "${event.text}"?`)) setData(d => ({ ...d, events: (d.events ?? []).filter(e => e.id !== event.id) })); };

  const days = monthGrid(view.year, view.month);
  const selectedItems = itemsOf(selected);

  return <section>
    <div className="section-title">
      <div><p className="eyebrow">Lo que se viene</p><h1>Calendario</h1></div>
      <SectionObjects large><DeskLink /><NotebookLink /><CalculatorLink /></SectionObjects>
    </div>


    <div className="cal-layout">
      <div className="cal-sheet">
        <div className="cal-rings" aria-hidden="true"><span /><span /></div>
        <div className="cal-band">
          <button type="button" className="cal-arrow" onClick={() => shiftMonth(-1)} aria-label="Mes anterior">‹</button>
          <BandClock />
          <h2 aria-live="polite"><span>{MONTH_NAMES[view.month]}</span><small>{view.year}</small></h2>
          <button type="button" className="cal-arrow" onClick={() => shiftMonth(1)} aria-label="Mes siguiente">›</button>
        </div>
        <div className="cal-toolbar">
          <ul className="cal-legend" aria-label="Colores">
            {EVENT_CATEGORIES.map(c => <li key={c}><span className={`cal-dot ${categoryClass(c)}`} aria-hidden="true" />{c}</li>)}
          </ul>
          <button type="button" className="cal-today" onClick={() => goTo(todayIso)}>Hoy</button>
        </div>
        <div className="cal-grid">
          {WEEK_HEADER.map((name, index) => <div key={name} className={`cal-weekday${index >= 5 ? ' cal-weekday--weekend' : ''}`} aria-hidden="true">{name}</div>)}
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
                {items.slice(0, MAX_CHIPS).map(item => <span key={item.key} className={`cal-chip ${categoryClass(item.category)}${item.done ? ' cal-chip--done' : ''}`}>{item.time && <><b>{item.time}</b> </>}{item.text}</span>)}
                {items.length > MAX_CHIPS && <span className="cal-more">+{items.length - MAX_CHIPS} más</span>}
              </span>
            </button>;
          })}
        </div>
      </div>

      <aside className="cal-day-panel" aria-label="Día elegido">
        <h2>{longDate(selected)}</h2>
        {selectedItems.length === 0
          ? <p className="cal-empty">No hay nada anotado para este día.</p>
          : <ul className="cal-items">
            {selectedItems.map(item => <li key={item.key} className={`cal-item ${categoryClass(item.category)}`}>
              {item.event && editingId === item.event.id
                ? <EventEditor event={item.event} onSave={saveEvent} onCancel={() => setEditingId(null)} />
                : <>
                  <div className="cal-item-text">
                    {item.time && <b>{item.time}</b>}
                    <span className={item.done ? 'cal-done' : undefined}>{item.text}</span>
                    <small>{item.source === 'expense' ? `Mis gastos · ${item.done ? 'Pagado' : 'No pagado'}` : item.note ? `${item.note.archivedAt ? 'Nota guardada' : 'Nota del escritorio'} · ${item.category}` : item.category}</small>
                  </div>
                  {item.event
                    ? <div className="cal-item-actions">
                      <button type="button" className="cal-secondary" onClick={() => setEditingId(item.event!.id)}>Editar</button>
                      <button type="button" className="delete" onClick={() => removeEvent(item.event!)}>Borrar</button>
                    </div>
                    : item.note && movingNoteId === item.note.id
                      ? <NoteDateForm note={item.note} date={selected} time={item.time ?? null} onSave={calendar => setNoteCalendar(item.note!, calendar)} onCancel={() => setMovingNoteId(null)} />
                      : <div className="cal-item-actions">
                        <Link className="cal-item-link" to={item.source === 'expense' ? '/gastos' : item.note?.archivedAt ? '/guardadas' : '/'}>{item.source === 'expense' ? 'Ver gasto' : 'Ver nota'}</Link>
                        {item.note && <button type="button" className="cal-secondary" onClick={() => setMovingNoteId(item.note!.id)}>Cambiar fecha</button>}
                      </div>}
                </>}
            </li>)}
          </ul>}
        {doubts.length > 0 && <section className="cal-doubts" aria-labelledby="cal-doubts-title">
          <h3 id="cal-doubts-title">¿Son fechas?</h3>
          <p>Estas notas parecen tener una fecha que no entendí. Con la flecha van al calendario; con la X dejo de preguntar.</p>
          <ul>{doubts.map(doubt => <DoubtRow key={doubt.note.id} doubt={doubt} onSave={calendar => setNoteCalendar(doubt.note, calendar)} />)}</ul>
        </section>}
      </aside>
    </div>
    <div className="sr-only" aria-live="polite">{announcement}</div>
  </section>;
}
