import { beforeEach, describe, expect, it } from 'vitest';
import { appendToMonth, cleanMonthName, EMPTY, moveToMonth, PAGE_LIMIT, parseMonthKey, sortMonths, syncMonthEntry, isData, isExpenseDate, parseCents, sameMonthName, total } from './model';
import { load, parseBackup, save, serialize } from './store';
import { editableMoney, formatExpenseDate, money, parseExpenseDate } from '../features/expenses/Expenses';

describe('datos exactos y backup', () => {
  beforeEach(() => localStorage.clear());
  it('cada hoja del diario admite hasta 3.000 caracteres', () => {
    const page = (text: string) => ({ ...EMPTY, folders: [{ id: 'f', name: 'Diario', pages: [{ id: 'p', text, createdAt: new Date().toISOString() }] }] });
    expect(PAGE_LIMIT).toBe(3000);
    expect(isData(page('a'.repeat(3000)))).toBe(true);
    expect(isData(page('a'.repeat(3001)))).toBe(false);
  });
  it('suma en centavos', () => expect(total([{ id: '1', concept: 'a', cents: 10 }, { id: '2', concept: 'b', cents: 20 }])).toBe(30));
  it('valida montos y overflow', () => {
    expect(parseCents('12,34')).toBe(1234);
    expect(parseCents('12.34')).toBe(1234);
    expect(parseCents('-1')).toBeNull();
    expect(parseCents('311.020,03')).toBe(31102003);
    expect(parseCents('1.234')).toBe(123400);
    expect(parseCents('1.234.567')).toBe(123456700);
    expect(parseCents('12.3456')).toBeNull();
    expect(parseCents('1.23.456')).toBeNull();
    expect(parseCents('999999999999999999')).toBeNull();
    expect(() => total([{ id: '1', concept: 'a', cents: Number.MAX_SAFE_INTEGER }, { id: '2', concept: 'b', cents: 1 }])).toThrow();
  });
  it.each(['2024-02-29', '2026-07-22'])('acepta una fecha calendario real: %s', value => expect(isExpenseDate(value)).toBe(true));
  it.each(['0000-01-01', '2023-02-29', '2026-04-31', '2026-13-01', '2026-01-00', '22/07/2026', ''])('rechaza una fecha inexistente o no ISO: %s', value => expect(isExpenseDate(value)).toBe(false));
  it.each([
    ['2026-07-21', '21/07/2026'],
    ['2000-02-29', '29/02/2000'],
  ])('convierte fecha ISO a formato visible: %s', (iso, display) => {
    expect(formatExpenseDate(iso)).toBe(display);
    expect(parseExpenseDate(display)).toBe(iso);
  });
  it.each(['31/02/2026', '29/02/1900', '7/07/2026', '07/7/2026', '2026-07-07', '07-07-2026', '', '00/01/2026', '01/13/2026', '21/07/20260', ' 21/07/2026', 'aa/bb/cccc'])('rechaza fecha visible invalida: %s', value => expect(parseExpenseDate(value)).toBeNull());
  it('no presenta como fecha un ISO invalido', () => expect(formatExpenseDate('2026-02-30')).toBe(''));
  it.each([['1900-02-29',false],['2000-02-29',true]] as const)('valida correctamente años seculares: %s', (value, valid) => expect(isExpenseDate(value)).toBe(valid));
  it('formatea centavos grandes sin perder precisión', () => {
    expect(editableMoney(9007199254740990)).toBe('90.071.992.547.409,90');
    expect(editableMoney(31102003)).toBe('311.020,03');
    expect(money(9007199254740990)).toBe('$\u00a090.071.992.547.409,90');
    expect(parseCents(editableMoney(9007199254740990))).toBe(9007199254740990);
  });
  it('mantiene compatibles los gastos v1 sin fecha', () => {
    const legacy = { ...EMPTY, expenses: [{ id: 'e', concept: 'Luz', cents: 1234 }] };
    expect(isData(legacy)).toBe(true);
    expect(parseBackup(JSON.stringify(legacy))).toEqual(legacy);
  });
  it('acepta una fecha válida y rechaza una presente inválida', () => {
    expect(isData({ ...EMPTY, expenses: [{ id: 'e', concept: 'Luz', cents: 1234, date: '2026-07-22' }] })).toBe(true);
    expect(isData({ ...EMPTY, expenses: [{ id: 'e', concept: 'Luz', cents: 1234, date: '2026-02-30' }] })).toBe(false);
  });
  it('mantiene compatibles los gastos sin estado de pago y valida el tipo cuando está presente', () => {
    expect(isData({ ...EMPTY, expenses: [{ id: 'e', concept: 'Luz', cents: 1234 }] })).toBe(true);
    expect(isData({ ...EMPTY, expenses: [{ id: 'e', concept: 'Luz', cents: 1234, paid: true }] })).toBe(true);
    expect(isData({ ...EMPTY, expenses: [{ id: 'e', concept: 'Luz', cents: 1234, paid: 'sí' }] })).toBe(false);
  });
  it('mantiene compatibles las notas sin archivar y valida la fecha de guardado', () => {
    const base = { id: 'n', text: 'x', color: '#ffe783', status: 'todo' as const, history: [{ status: 'todo' as const, at: '2026-07-22T00:00:00.000Z' }] };
    expect(isData({ ...EMPTY, notes: [base] })).toBe(true);
    expect(isData({ ...EMPTY, notes: [{ ...base, archivedAt: '2026-07-22T00:00:00.000Z' }] })).toBe(true);
    expect(isData({ ...EMPTY, notes: [{ ...base, archivedAt: 'no-es-fecha' }] })).toBe(false);
  });
  it('mantiene compatibles los datos sin meses y valida las carpetas de meses', () => {
    const luz = { id: 'e', concept: 'Luz', cents: 1234, date: '2026-08-02', category: 'Casa' as const, paid: true };
    expect(isData({ ...EMPTY, expenseMonths: [{ id: 'm', name: 'Agosto 2026', expenses: [luz] }] })).toBe(true);
    expect(isData({ ...EMPTY, expenseMonths: [{ id: 'm', name: '', expenses: [] }] })).toBe(false);
    expect(isData({ ...EMPTY, expenseMonths: [{ id: 'm', name: 'Agosto 2026', expenses: [{ ...luz, cents: -1 }] }] })).toBe(false);
    expect(isData({ ...EMPTY, expenseMonths: {} })).toBe(false);
  });
  it('compara nombres de mes sin importar mayúsculas ni espacios', () => {
    expect(sameMonthName(' agosto 2026', 'Agosto 2026')).toBe(true);
    expect(sameMonthName('Agosto 2026', 'Septiembre 2026')).toBe(false);
  });
  it('agrega gastos a la carpeta existente o crea una nueva', () => {
    const luz = { id: 'e', concept: 'Luz', cents: 100 };
    const created = appendToMonth([], '  Agosto   2026 ', [luz]);
    expect(created).toEqual([{ id: created[0].id, name: 'Agosto 2026', expenses: [luz] }]);
    const appended = appendToMonth(created, 'agosto 2026', [{ ...luz, id: 'f' }]);
    expect(appended).toHaveLength(1);
    expect(appended[0].expenses.map(e => e.id)).toEqual(['e', 'f']);
  });
  it.each([['08/2026', '08/2026'], ['8/2026', '08/2026'], [' 12-2025 ', '12/2025']])('normaliza el mes %s', (input, key) => expect(parseMonthKey(input)).toBe(key));
  it.each(['13/2026', '00/2026', '08/26', 'agosto', '', '08/0000'])('rechaza el mes inválido %s', value => expect(parseMonthKey(value)).toBeNull());
  it('usa mm/aaaa como nombre de carpeta cuando el mes es válido', () => {
    expect(cleanMonthName('8/2026')).toBe('08/2026');
    expect(cleanMonthName('  Agosto   2026 ')).toBe('Agosto 2026');
  });
  it('mueve el gasto de carpeta y mantiene una sola copia', () => {
    const luz = { id: 'e', concept: 'Luz', cents: 100 };
    const agosto = moveToMonth([], '08/2026', luz);
    expect(agosto).toEqual([{ id: agosto[0].id, name: '08/2026', expenses: [{ ...luz, month: '08/2026' }] }]);
    expect(moveToMonth(agosto, '08/2026', { ...luz, cents: 200 })[0].expenses).toEqual([{ ...luz, cents: 200, month: '08/2026' }]);
    const moved = moveToMonth(agosto, '09/2026', luz);
    expect(moved.map(m => [m.name, m.expenses.length])).toEqual([['08/2026', 0], ['09/2026', 1]]);
    expect(isData({ ...EMPTY, expenses: [{ ...luz, month: '09/2026' }], expenseMonths: moved })).toBe(true);
    expect(moveToMonth([], 'Agosto 2026', { ...luz, month: '08/2026' })[0].expenses[0]).toEqual(luz);
  });
  it('actualiza en la carpeta los cambios del gasto guardado', () => {
    const luz = { id: 'e', concept: 'Luz', cents: 100, month: '08/2026' };
    const months = [{ id: 'm', name: '08/2026', expenses: [luz] }];
    expect(syncMonthEntry(months, { ...luz, cents: 300 })![0].expenses[0].cents).toBe(300);
    expect(syncMonthEntry(months, { id: 'otro', concept: 'x', cents: 1 })).toBe(months);
  });
  it('rechaza un mes de gasto con formato inválido', () => expect(isData({ ...EMPTY, expenses: [{ id: 'e', concept: 'Luz', cents: 1, month: 'agosto' }] })).toBe(false));
  it('ordena las carpetas mm/aaaa por fecha y deja las demás al final', () => {
    const folder = (name: string) => ({ id: name, name, expenses: [] });
    expect(sortMonths([folder('Viaje'), folder('01/2027'), folder('12/2026')]).map(m => m.name)).toEqual(['12/2026', '01/2027', 'Viaje']);
  });
  it('valida las carpetas de notas guardadas y la carpeta de cada nota', () => {
    const note = { id: 'n', text: 'x', color: '#ffe783', status: 'todo' as const, history: [{ status: 'todo' as const, at: '2026-07-22T00:00:00.000Z' }], archivedAt: '2026-07-22T00:00:00.000Z' };
    expect(isData({ ...EMPTY, notes: [{ ...note, savedFolder: 'f' }], noteFolders: [{ id: 'f', name: 'Turnos' }] })).toBe(true);
    expect(isData({ ...EMPTY, noteFolders: [{ id: 'f', name: '' }] })).toBe(false);
    expect(isData({ ...EMPTY, notes: [{ ...note, savedFolder: 3 }] })).toBe(false);
    expect(isData({ ...EMPTY, notes: [{ ...note, savedOrder: 2 }] })).toBe(true);
    expect(isData({ ...EMPTY, notes: [{ ...note, savedOrder: 'primero' }] })).toBe(false);
  });
  it('hace round trip', () => expect(parseBackup(serialize(EMPTY))).toEqual(EMPTY));
  it('persiste', () => { save(EMPTY); expect(load().data).toEqual(EMPTY); });
  it.each([{ ...EMPTY, notes: [{ id: '', text: 'x', color: '#ffe783', status: 'todo', history: [] }] }, { ...EMPTY, folders: [{ id: 'f', name: 'n', pages: [] }] }, { ...EMPTY, expenses: [{ id: 'e', concept: '', cents: -1 }] }])('rechaza estructuras internas inválidas', bad => expect(() => parseBackup(JSON.stringify(bad))).toThrow());
  it('rechaza backup incompatible', () => expect(() => parseBackup('{}')).toThrow());
});
