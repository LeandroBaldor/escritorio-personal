import { describe, expect, it } from 'vitest';
import { calendarParts } from './GamesCalendar';

describe('calendarParts', () => {
  it('muestra el día de la semana, el número, el mes y el año en castellano', () => {
    expect(calendarParts(new Date(2026, 9, 26))).toEqual({ weekday: 'Lunes', day: '26', month: 'OCTUBRE', year: '2026' });
    expect(calendarParts(new Date(2026, 8, 9))).toEqual({ weekday: 'Miércoles', day: '9', month: 'SEPTIEMBRE', year: '2026' });
  });
});
