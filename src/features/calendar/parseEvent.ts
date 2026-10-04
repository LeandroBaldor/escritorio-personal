import type { EventCategory } from '../../storage/model';

export type ParsedEvent = { text: string; date: string | null; time: string | null };

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const plain = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const pad = (value: number) => String(value).padStart(2, '0');

export const isoOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const dateOf = (iso: string) => { const [year, month, day] = iso.split('-').map(Number); return new Date(year, month - 1, day); };
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

// Fecha real del calendario; sin año toma la próxima vez que llega ese día (hoy incluido).
function calendarDate(day: number, month: number, year: number | null, today: Date) {
  const build = (y: number) => { const date = new Date(y, month - 1, day); return date.getMonth() === month - 1 && date.getDate() === day ? date : null; };
  if (year !== null) return build(year < 100 ? 2000 + year : year);
  const thisYear = build(today.getFullYear());
  if (thisYear && thisYear >= addDays(today, 0)) return thisYear;
  return build(today.getFullYear() + 1) ?? build(today.getFullYear() + 2) ?? build(today.getFullYear() + 3) ?? build(today.getFullYear() + 4);
}

// Saca la parte reconocida del texto, junto con conectores sueltos como "el", "para el" o "a las".
function cut(text: string, index: number, length: number) {
  const before = text.slice(0, index).replace(/(?:\s+(?:para|desde|hasta|el|la|a\s+las?|a|de|del|los|las|-|,))+\s*$/i, '');
  const after = text.slice(index + length);
  return `${before} ${after}`.replace(/\s+/g, ' ').replace(/^[\s,.:;-]+|[\s,:;-]+$/g, '').trim();
}

// Igual que cut, pero si la fecha viene después del día de la semana ("lunes 13/10") también lo saca.
function cutWithWeekday(text: string, index: number, length: number) {
  const before = new RegExp(`(?:\\b(?:el|este)\\s+)?\\b(?:${WEEKDAYS.join('|')})\\s*,?\\s*$`, 'i').exec(plain(text.slice(0, index)));
  return before ? cut(text, before.index, index - before.index + length) : cut(text, index, length);
}

// Reconoce la fecha y la hora dentro de un texto como "Turno Altamar 13/10 10:30".
export function parseEvent(input: string, today: Date): ParsedEvent {
  let text = input.trim();
  let date: Date | null = null;
  let time: string | null = null;

  const timeMatch = /\b(?:a\s+las\s+)?([01]?\d|2[0-3]):([0-5]\d)\s*(?:hs?\b|h\b)?/i.exec(text) ?? /\b(?:a\s+las\s+)?([01]?\d|2[0-3])\s*(?:hs|h)\b/i.exec(text) ?? /\ba\s+las\s+([01]?\d|2[0-3])\b(?![/-]\d)/i.exec(text);
  if (timeMatch) {
    time = `${pad(Number(timeMatch[1]))}:${timeMatch[2] ?? '00'}`;
    text = cut(text, timeMatch.index, timeMatch[0].length);
  }

  const numeric = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}|\d{2}))?\b/.exec(text);
  const written = new RegExp(`\\b(\\d{1,2})\\s+(?:de\\s+)?(${MONTHS.join('|')})[a-zñ]*\\.?(?:\\s+(?:de\\s+|del\\s+)?(\\d{4}))?`, 'i').exec(plain(text));
  const relative = /\b(pasado\s+manana|manana|hoy)\b/i.exec(plain(text));
  const weekday = new RegExp(`\\b(?:el\\s+|este\\s+|proximo\\s+)?(${WEEKDAYS.join('|')})(?:\\s+(?:que\\s+viene|proximo))?\\b`, 'i').exec(plain(text));

  if (numeric) {
    date = calendarDate(Number(numeric[1]), Number(numeric[2]), numeric[3] ? Number(numeric[3]) : null, today);
    if (date) text = cutWithWeekday(text, numeric.index, numeric[0].length);
  } else if (written) {
    date = calendarDate(Number(written[1]), MONTHS.indexOf(written[2].toLowerCase()) + 1, written[3] ? Number(written[3]) : null, today);
    if (date) text = cutWithWeekday(text, written.index, written[0].length);
  } else if (relative) {
    const word = relative[1].toLowerCase();
    date = addDays(today, word === 'hoy' ? 0 : word === 'manana' ? 1 : 2);
    text = cut(text, relative.index, relative[0].length);
  } else if (weekday) {
    const target = WEEKDAYS.indexOf(weekday[1].toLowerCase());
    date = addDays(today, ((target - today.getDay() + 7) % 7) || 7);
    text = cut(text, weekday.index, weekday[0].length);
  }

  return { text: text || input.trim(), date: date ? isoOf(date) : null, time };
}

const KEYWORDS: [EventCategory, RegExp][] = [
  ['Salud', /\b(turno|medic|doctor|dr\.?|dra\.?|dentista|odontolog|analisis|estudio|vacuna|clinica|hospital|kinesio|psicolog|oculista|farmacia|altamar)/],
  ['Pagos', /\b(pagar|pago|vence|vencimiento|cuota|tarjeta|factura|impuesto|alquiler|expensas|abl|luz|gas|agua|internet|claro|movistar|seguro|monotributo)/],
  ['Trabajo', /\b(trabajo|reunion|oficina|cliente|entrega|jefe|laburo|meet|zoom|presentacion|informe)/],
  ['Cumpleaños', /\b(cumple|cumpleanos|aniversario)/],
];

// Elige un color según las palabras del texto; si no reconoce ninguna, queda en "Personal".
export function guessCategory(text: string): EventCategory {
  const words = plain(text);
  return KEYWORDS.find(([, pattern]) => pattern.test(words))?.[0] ?? 'Personal';
}
