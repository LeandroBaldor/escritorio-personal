import { useId, useState } from 'react';
import type { NoteCalendar } from '../../storage/model';
import { DateInput, formatExpenseDate } from '../expenses/Expenses';
import { calendarFrom } from './DateTimeFields';

// Pregunta si una nota tiene fecha: el día sugerido (dd/mm/aaaa) se puede cambiar, la flecha la pone en el calendario y la X deja de preguntar.
export function DateQuestion({ text, date, time, onSave }: { text: string; date: string | null; time: string | null; onSave: (calendar: NoteCalendar | null) => void }) {
  const fieldId = useId();
  const [day, setDay] = useState(date ? formatExpenseDate(date) : '');
  const calendar = calendarFrom(day, time ?? '');
  return <div className="cal-doubt">
    <span className="cal-doubt-text">{text}</span>
    <DateInput id={fieldId} label={`Día de ${text}`} value={day} onChange={setDay} />
    <button type="button" className="cal-doubt-ok" disabled={!calendar} onClick={() => calendar && onSave(calendar)} aria-label={`Sí, ${text} es una fecha`} title="Sí, poner en el calendario">→</button>
    <button type="button" className="cal-doubt-no" onClick={() => onSave(null)} aria-label={`${text} no es una fecha`} title="No es una fecha">✕</button>
  </div>;
}
