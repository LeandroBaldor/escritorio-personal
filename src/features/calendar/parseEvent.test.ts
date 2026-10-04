import { describe, expect, it } from 'vitest';
import { EMPTY, isData } from '../../storage/model';
import { guessCategory, parseEvent } from './parseEvent';

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
    ['Gimnasio el lunes', 'Gimnasio', '2026-10-05', null],
    ['Feria el sábado', 'Feria', '2026-10-10', null],
    ['Asado el domingo', 'Asado', '2026-10-11', null],
    ['Vence tarjeta 2/10', 'Vence tarjeta', '2027-10-02', null],
  ])('%s', (input, text, date, time) => {
    expect(parseEvent(input, today)).toEqual({ text, date, time });
  });

  it('deja el texto entero y sin fecha cuando no encuentra una', () => {
    expect(parseEvent('Llamar al plomero', today)).toEqual({ text: 'Llamar al plomero', date: null, time: null });
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
  });
});
