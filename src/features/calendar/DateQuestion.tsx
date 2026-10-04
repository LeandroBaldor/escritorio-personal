import { useState } from 'react';
import type { NoteCalendar } from '../../storage/model';

// Pregunta si una nota tiene fecha: el día sugerido se puede cambiar, la flecha la pone en el calendario y la X deja de preguntar.
export function DateQuestion({ text, date, time, onSave }: { text: string; date: string | null; time: string | null; onSave: (calendar: NoteCalendar | null) => void }) {
  const [day, setDay] = useState(date ?? '');
  return <div className="cal-doubt">
    <span className="cal-doubt-text">{text}</span>
    <input aria-label={`Día de ${text}`} type="date" value={day} onChange={e => setDay(e.target.value)} />
    <button type="button" className="cal-doubt-ok" disabled={!day} onClick={() => onSave(time ? { date: day, time } : { date: day })} aria-label={`Sí, ${text} es una fecha`} title="Sí, poner en el calendario">→</button>
    <button type="button" className="cal-doubt-no" onClick={() => onSave(null)} aria-label={`${text} no es una fecha`} title="No es una fecha">✕</button>
  </div>;
}
