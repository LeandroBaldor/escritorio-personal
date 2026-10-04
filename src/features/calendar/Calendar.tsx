import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../../app/DataContext';
import { DeskLink, NotebookLink, CalculatorLink, SectionObjects } from '../../app/SectionObjects';
import { EVENT_CATEGORIES, id, type CalendarEvent, type EventCategory } from '../../storage/model';
import { money } from '../expenses/Expenses';
import { dateOf, guessCategory, isoOf, parseEvent } from './parseEvent';

const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const WEEK_HEADER = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const MAX_CHIPS = 3;

// Cada categoría tiene su color (clase cal-cat--…).
export const categoryClass = (category: EventCategory) => `cal-cat--${category.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}`;
const longDate = (iso: string) => { const date = dateOf(iso); return `${DAY_NAMES[date.getDay()]} ${date.getDate()} de ${MONTH_NAMES[date.getMonth()]}`; };
const shortDate = (iso: string) => { const date = dateOf(iso); return `${DAY_NAMES[date.getDay()]} ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`; };

type Item = { key: string; text: string; time?: string; category: EventCategory; event?: CalendarEvent; paid?: boolean; fromExpenses?: boolean };

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
  const [draft, setDraft] = useState('');
  const [chosenCategory, setChosenCategory] = useState<EventCategory | ''>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const parsed = draft.trim() ? parseEvent(draft, today) : null;
  const draftDate = parsed?.date ?? selected;
  const draftCategory = chosenCategory || guessCategory(draft);

  const byDay = new Map<string, Item[]>();
  const push = (date: string, item: Item) => byDay.set(date, [...(byDay.get(date) ?? []), item]);
  for (const event of data.events ?? []) push(event.date, { key: event.id, text: event.text, time: event.time, category: event.category, event });
  for (const expense of data.expenses) if (expense.date) push(expense.date, { key: `gasto-${expense.id}`, text: `${expense.concept} · ${money(expense.cents)}`, category: 'Pagos', paid: expense.paid ?? false, fromExpenses: true });
  const itemsOf = (iso: string) => (byDay.get(iso) ?? []).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));

  const goTo = (iso: string) => { const date = dateOf(iso); setView({ year: date.getFullYear(), month: date.getMonth() }); setSelected(iso); };
  const shiftMonth = (delta: number) => setView(({ year, month }) => { const date = new Date(year, month + delta, 1); return { year: date.getFullYear(), month: date.getMonth() }; });
  const add = (submit: FormEvent) => {
    submit.preventDefault();
    if (!parsed) return;
    const event: CalendarEvent = { id: id(), text: parsed.text, date: draftDate, category: draftCategory };
    if (parsed.time) event.time = parsed.time;
    setData(d => ({ ...d, events: [...(d.events ?? []), event] }));
    setDraft(''); setChosenCategory('');
    goTo(draftDate);
    setAnnouncement(`${event.text}: anotado el ${longDate(draftDate)}`);
  };
  const saveEvent = (event: CalendarEvent) => { setData(d => ({ ...d, events: (d.events ?? []).map(e => e.id === event.id ? event : e) })); setEditingId(null); goTo(event.date); };
  const removeEvent = (event: CalendarEvent) => { if (confirm(`¿Borrar "${event.text}"?`)) setData(d => ({ ...d, events: (d.events ?? []).filter(e => e.id !== event.id) })); };

  const days = monthGrid(view.year, view.month);
  const selectedItems = itemsOf(selected);

  return <section>
    <div className="section-title">
      <div><p className="eyebrow">Lo que se viene</p><h1>Calendario</h1></div>
      <SectionObjects large><DeskLink /><NotebookLink /><CalculatorLink /></SectionObjects>
    </div>

    <form className="cal-new" onSubmit={add}>
      <label className="cal-new-text">¿Qué pasa?<input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Ej. Turno Altamar 13/10 10:30" /></label>
      <label>Tipo<select value={chosenCategory} onChange={e => setChosenCategory(e.target.value as EventCategory | '')}>
        <option value="">Automático ({guessCategory(draft)})</option>
        {EVENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select></label>
      <button disabled={!parsed}>Agregar</button>
      {parsed && <p className="cal-preview" role="status">
        <span className={`cal-dot ${categoryClass(draftCategory)}`} aria-hidden="true" />
        <strong>{shortDate(draftDate)}</strong>{parsed.time && <> · {parsed.time}</>} · {parsed.text}
        {!parsed.date && <small> (no encontré una fecha en el texto: se anota en el día elegido)</small>}
      </p>}
    </form>

    <div className="cal-layout">
      <div className="cal-sheet">
        <div className="cal-rings" aria-hidden="true"><span /><span /></div>
        <div className="cal-band">
          <button type="button" className="cal-arrow" onClick={() => shiftMonth(-1)} aria-label="Mes anterior">‹</button>
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
                {items.slice(0, MAX_CHIPS).map(item => <span key={item.key} className={`cal-chip ${categoryClass(item.category)}${item.paid ? ' cal-chip--done' : ''}`}>{item.time && <b>{item.time}</b>}{item.text}</span>)}
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
                    <span className={item.paid ? 'cal-done' : undefined}>{item.text}</span>
                    <small>{item.fromExpenses ? (item.paid ? 'Mis gastos · Pagado' : 'Mis gastos · No pagado') : item.category}</small>
                  </div>
                  {item.event
                    ? <div className="cal-item-actions">
                      <button type="button" className="cal-secondary" onClick={() => setEditingId(item.event!.id)}>Editar</button>
                      <button type="button" className="delete" onClick={() => removeEvent(item.event!)}>Borrar</button>
                    </div>
                    : <Link className="cal-item-link" to="/gastos">Ver gasto</Link>}
                </>}
            </li>)}
          </ul>}
        <p className="cal-hint">Escribí arriba qué pasa con la fecha, por ejemplo <q>Turno Altamar 13/10</q>, y se anota solo en ese día.</p>
      </aside>
    </div>
    <div className="sr-only" aria-live="polite">{announcement}</div>
  </section>;
}
