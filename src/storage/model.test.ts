import { beforeEach, describe, expect, it } from 'vitest';
import { EMPTY, isData, isExpenseDate, parseCents, total } from './model';
import { load, parseBackup, save, serialize } from './store';
import { editableMoney, money } from '../features/expenses/Expenses';

describe('datos exactos y backup', () => {
  beforeEach(() => localStorage.clear());
  it('suma en centavos', () => expect(total([{ id: '1', concept: 'a', cents: 10 }, { id: '2', concept: 'b', cents: 20 }])).toBe(30));
  it('valida montos y overflow', () => {
    expect(parseCents('12,34')).toBe(1234);
    expect(parseCents('12.34')).toBe(1234);
    expect(parseCents('-1')).toBeNull();
    expect(parseCents('999999999999999999')).toBeNull();
    expect(() => total([{ id: '1', concept: 'a', cents: Number.MAX_SAFE_INTEGER }, { id: '2', concept: 'b', cents: 1 }])).toThrow();
  });
  it.each(['2024-02-29', '2026-07-22'])('acepta una fecha calendario real: %s', value => expect(isExpenseDate(value)).toBe(true));
  it.each(['0000-01-01', '2023-02-29', '2026-04-31', '2026-13-01', '2026-01-00', '22/07/2026', ''])('rechaza una fecha inexistente o no ISO: %s', value => expect(isExpenseDate(value)).toBe(false));
  it.each([['1900-02-29',false],['2000-02-29',true]] as const)('valida correctamente años seculares: %s', (value, valid) => expect(isExpenseDate(value)).toBe(valid));
  it('formatea centavos grandes sin perder precisión', () => {
    expect(editableMoney(9007199254740990)).toBe('90071992547409,90');
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
  it('hace round trip', () => expect(parseBackup(serialize(EMPTY))).toEqual(EMPTY));
  it('persiste', () => { save(EMPTY); expect(load().data).toEqual(EMPTY); });
  it.each([{ ...EMPTY, notes: [{ id: '', text: 'x', color: '#ffe783', status: 'todo', history: [] }] }, { ...EMPTY, folders: [{ id: 'f', name: 'n', pages: [] }] }, { ...EMPTY, expenses: [{ id: 'e', concept: '', cents: -1 }] }])('rechaza estructuras internas inválidas', bad => expect(() => parseBackup(JSON.stringify(bad))).toThrow());
  it('rechaza backup incompatible', () => expect(() => parseBackup('{}')).toThrow());
});
