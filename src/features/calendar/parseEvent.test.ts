import { describe, expect, it } from 'vitest';
import { EMPTY, isData } from '../../storage/model';
import { dateDoubt, guessCategory, parseEvent } from './parseEvent';

// Domingo 4 de octubre de 2026.
const today = new Date(2026, 9, 4, 15, 30);

describe('parseEvent', () => {
  it.each([
    ['Turno Altamar 13/10', 'Turno Altamar', '2026-10-13', null],
    ['Turno Altamar 13/10 10:30', 'Turno Altamar', '2026-10-13', '10:30'],
    ['Turno Altamar el 13/10 a las 9hs', 'Turno Altamar', '2026-10-13', '09:00'],
    ['13/10/2027 Dentista', 'Dentista', '2027-10-13', null],
    ['Pagar luz 5-11-26', 'Pagar luz', '2026-11-05', null],
    ['Cumple de Juan 13 de octubre', 'Cumple de Juan', '2026-10-13', null],
    ['Reunión 20 oct 15:00', 'Reunión', '2026-10-20', '15:00'],
    ['Llamar a mamá mañana', 'Llamar a mamá', '2026-10-05', null],
    ['Comprar regalo pasado mañana', 'Comprar regalo', '2026-10-06', null],
    ['Hoy cena con amigos 21:30', 'cena con amigos', '2026-10-04', '21:30'],
    ['Gimnasio lunes 13/10', 'Gimnasio', '2026-10-13', null],
        ['Vence tarjeta 2/10', 'Vence tarjeta', '2027-10-02', null],
    ['Turno dentista lunes 13/10 a las 15', 'Turno dentista', '2026-10-13', '15:00'],
    ['Turno Altamar el martes 13 de octubre 9:30hs', 'Turno Altamar', '2026-10-13', '09:30'],
  ])('%s', (input, text, date, time) => {
    expect(parseEvent(input, today)).toEqual({ text, date, time });
  });

  it.each([
    ['Lunes Telecentro', 'Telecentro', '2026-10-05'],
    ['Gimnasio el lunes', 'Gimnasio', '2026-10-05'],
    ['Feria el sábado', 'Feria', '2026-10-10'],
    ['Asado el domingo', 'Asado', '2026-10-11'],
  ])('marca como adivinada la fecha que sale de un día de la semana: %s', (input, text, date) => {
    expect(parseEvent(input, today)).toEqual({ text, date, time: null, guessed: true });
  });

  it('deja el texto entero y sin fecha cuando no encuentra una', () => {
    expect(parseEvent('Llamar al plomero', today)).toEqual({ text: 'Llamar al plomero', date: null, time: null });
  });

  it('toma el año desde el día de referencia (por ejemplo, cuando se creó la nota)', () => {
    expect(parseEvent('Turno 2/10', new Date(2026, 8, 20)).date).toBe('2026-10-02');
  });

  it('no toma como fecha un día que no existe', () => {
    expect(parseEvent('Algo 31/02', today).date).toBeNull();
  });
});

describe('guessCategory', () => {
  it.each([
    ['Turno Altamar', 'Salud'],
    ['Dentista', 'Salud'],
    ['Pagar luz', 'Pagos'],
    ['Vence tarjeta', 'Pagos'],
    ['Lunes Telecentro', 'Pagos'],
    ['Reunión con el cliente', 'Trabajo'],
    ['Cumple de Juan', 'Cumpleaños'],
    ['Cena con amigos', 'Personal'],
  ])('%s → %s', (text, category) => expect(guessCategory(text)).toBe(category));
});

describe('eventos guardados', () => {
  it('valida los eventos del calendario', () => {
    const event = { id: 'e', text: 'Turno', date: '2026-10-13', time: '10:30', category: 'Salud' };
    expect(isData({ ...EMPTY, events: [event] })).toBe(true);
    expect(isData({ ...EMPTY, events: [{ ...event, date: '2026-02-30' }] })).toBe(false);
    expect(isData({ ...EMPTY, events: [{ ...event, time: '25:00' }] })).toBe(false);
    expect(isData({ ...EMPTY, events: [{ ...event, category: 'Fiesta' }] })).toBe(false);
    const note = { id: 'n', text: 'Turno 13.10', color: '#ffe783', status: 'todo', history: [{ status: 'todo', at: '2026-10-01T10:00:00.000Z' }] };
    expect(isData({ ...EMPTY, notes: [{ ...note, calendar: { date: '2026-10-13', time: '10:30' } }] })).toBe(true);
    expect(isData({ ...EMPTY, notes: [{ ...note, calendar: null }] })).toBe(true);
    expect(isData({ ...EMPTY, notes: [{ ...note, calendar: { date: '13/10' } }] })).toBe(false);
    expect(isData({ ...EMPTY, notes: [{ ...note, calendarCategory: 'Trabajo' }] })).toBe(true);
    expect(isData({ ...EMPTY, notes: [{ ...note, calendarCategory: 'Fiesta' }] })).toBe(false);
    const gasto = { id: 'g', concept: 'Claro', cents: 1863607, date: '2026-10-22' };
    expect(isData({ ...EMPTY, expenses: [{ ...gasto, time: '09:00', calendarCategory: 'Trabajo' }] })).toBe(true);
    expect(isData({ ...EMPTY, expenses: [{ ...gasto, time: '9' }] })).toBe(false);
    expect(isData({ ...EMPTY, expenses: [{ ...gasto, calendarCategory: 'Fiesta' }] })).toBe(false);
  });
});

describe('dateDoubt', () => {
  it.each([
    ['Turno 13.10', '2026-10-13'],
    ['Turno el 20 a las 10hs', '2026-10-20'],
    ['Pagar el 2', '2026-11-02'],
    ['Algo 31/02', null],
  ])('pregunta por %s', (text, date) => expect(dateDoubt(text, today)?.date ?? null).toBe(date));

  it('saca la fecha dudosa del texto', () => {
    expect(dateDoubt('Turno dermatólogo 20.10', today)?.text).toBe('Turno dermatólogo');
    expect(dateDoubt('Pagar seguro el 28', today)?.text).toBe('Pagar seguro');
  });

  it.each(['Turno Altamar 13/10', 'Comprar pintura', 'Llevar 2.5 kilos'])('no pregunta por %s', text => expect(dateDoubt(text, today)).toBeNull());
});
