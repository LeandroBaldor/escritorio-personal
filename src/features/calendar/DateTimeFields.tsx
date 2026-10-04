import type { NoteCalendar } from '../../storage/model';
import { parseExpenseDate } from '../expenses/Expenses';

// Hora en formato de 24 horas (hh:mm): acepta "9:30", "09:30", "0930" o "18.30". Vacía = sin hora.
export const parseTime = (value: string) => {
  const match = /^([01]?\d|2[0-3])[:.]?([0-5]\d)$/.exec(value.trim());
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
};
export const validTime = (value: string) => value.trim() === '' || parseTime(value) !== null;

export function TimeInput({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return <input className="time-input" aria-label={label} type="text" inputMode="numeric" maxLength={5} placeholder="hh:mm" value={value}
    onChange={event => onChange(event.target.value)} onBlur={() => { const time = parseTime(value); if (time) onChange(time); }} />;
}

// Día (dd/mm/aaaa) y hora (hh:mm, opcional) escritos en los campos → fecha para el calendario, o null si alguno no es válido.
export function calendarFrom(day: string, hour: string): NoteCalendar | null {
  const date = parseExpenseDate(day.trim());
  if (!date || !validTime(hour)) return null;
  const time = parseTime(hour);
  return time ? { date, time } : { date };
}
