import { FocusEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../../app/DataContext';
import { appendToMonth, cleanMonthName, EXPENSE_CATEGORIES, id, isExpenseDate, moveToMonth, parseCents, parseMonthKey, sameMonthName, syncMonthEntry, total, totalsByCategory, type Expense, type ExpenseCategory } from '../../storage/model';

const integerMoney = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const moneyParts = (c: number) => ({ whole: Math.trunc(c / 100), fraction: c % 100 });
export const money = (c: number) => { const { whole, fraction } = moneyParts(c); return `$\u00a0${integerMoney.format(whole)},${String(fraction).padStart(2, '0')}`; };
export const editableMoney = (c: number) => { const { whole, fraction } = moneyParts(c); return `${whole},${String(fraction).padStart(2, '0')}`; };
const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
export const formatExpenseDate = (iso: string) => {
  if (!isExpenseDate(iso)) return '';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
};
export const parseExpenseDate = (display: string) => {
  const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  return isExpenseDate(iso) ? iso : null;
};

function DateInput({ id, value, onChange, onBlur, onEnter, onCalendarSelect, label }: { id: string; value: string; onChange: (value: string) => void; onBlur?: () => void; onEnter?: () => void; onCalendarSelect?: (value: string) => void; label: string }) {
  const isoValue = parseExpenseDate(value) ?? '';
  const pickerRef = useRef<HTMLInputElement>(null);
  const leaveControl = (event: FocusEvent<HTMLSpanElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onBlur?.();
  };
  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker) return;
    try {
      if (typeof picker.showPicker === 'function') {
        picker.showPicker();
        return;
      }
    } catch {
      // Some browsers expose showPicker but restrict it; use their native click path.
    }
    picker.focus();
    picker.click();
  };
  return <span className="date-input" onBlur={leaveControl}>
    <input id={id} aria-label={label} type="text" inputMode="text" maxLength={10} placeholder="dd/mm/yyyy" value={value} onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onEnter?.(); }} />
    <button className="date-picker-icon" type="button" aria-label={`Abrir calendario de ${label.toLowerCase()}`} onClick={openPicker}>&#128197;</button>
    <input ref={pickerRef} className="native-date-picker" aria-label={`Selector de ${label.toLowerCase()}`} tabIndex={-1} type="date" value={isoValue} onChange={e => { const display = formatExpenseDate(e.target.value); onChange(display); onCalendarSelect?.(display); }} />
  </span>;
}

function MoneyInput({ value, onChange, onBlur, label, placeholder }: { value: string; onChange: (value: string) => void; onBlur?: () => void; label: string; placeholder?: string }) {
  return <span className="money-input"><span aria-hidden="true">$</span><input aria-label={label} inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur} placeholder={placeholder} /></span>;
}

function ExpenseRow({ expense, onChange, onDelete, onSaveMonth }: { expense: Expense; onChange: (e: Expense) => void; onDelete: () => void; onSaveMonth: (key: string) => void }) {
  const [concept, setConcept] = useState(expense.concept);
  const [category, setCategory] = useState<ExpenseCategory>(expense.category ?? 'Otros');
  const [date, setDate] = useState(expense.date ? formatExpenseDate(expense.date) : '');
  const [amount, setAmount] = useState(editableMoney(expense.cents));
  const [paid, setPaid] = useState(expense.paid ?? false);
  const [monthDraft, setMonthDraft] = useState(expense.month ?? '');
  const [error, setError] = useState('');
  const keepDrafts = useRef(false);
  useEffect(() => { setMonthDraft(expense.month ?? ''); }, [expense.month]);
  useEffect(() => { if (keepDrafts.current) { keepDrafts.current = false; return; } setConcept(expense.concept); setCategory(expense.category ?? 'Otros'); setDate(expense.date ? formatExpenseDate(expense.date) : ''); setAmount(editableMoney(expense.cents)); setPaid(expense.paid ?? false); }, [expense]);
  const commit = (candidateDate = date) => {
    const cents = parseCents(amount);
    const isoDate = candidateDate === '' ? null : parseExpenseDate(candidateDate);
    if (!concept.trim() || cents === null || (candidateDate !== '' && isoDate === null)) {
      setError('Concepto, fecha o monto inválido.');
      return;
    }
    const next: Expense = { ...expense, concept: concept.trim(), cents };
    if (isoDate) next.date = isoDate;
    else delete next.date;
    onChange(next);
    setDate(isoDate ? formatExpenseDate(isoDate) : '');
    setAmount(editableMoney(cents));
    setError('');
  };
  const selectCalendarDate = (display: string) => {
    const isoDate = parseExpenseDate(display);
    if (!isoDate) return;
    keepDrafts.current = true;
    onChange({ ...expense, date: isoDate });
  };
  const changeCategory = (value: ExpenseCategory) => {
    setCategory(value);
    keepDrafts.current = true;
    onChange({ ...expense, category: value });
  };
  const changePaid = (value: boolean) => {
    setPaid(value);
    keepDrafts.current = true;
    onChange({ ...expense, paid: value });
  };
  const saveMonth = () => {
    const key = parseMonthKey(monthDraft);
    if (!key) { setError('Escribí el mes como mm/aaaa, por ejemplo 08/2026.'); return; }
    setMonthDraft(key);
    setError('');
    onSaveMonth(key);
  };
  const savedHere = Boolean(expense.month) && monthDraft === expense.month;
  return <div className="expense-row">
    <input aria-label="Concepto" value={concept} onChange={e => setConcept(e.target.value)} onBlur={() => commit()} />
    <select aria-label="Categoría" value={category} onChange={e => changeCategory(e.target.value as ExpenseCategory)}>
      {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
    <DateInput id={`expense-date-${expense.id}`} label="Fecha" value={date} onChange={setDate} onBlur={() => commit()} onEnter={() => commit()} onCalendarSelect={selectCalendarDate} />
    <MoneyInput label="Monto en pesos" value={amount} onChange={setAmount} onBlur={() => commit()} />
    <select aria-label="Estado de pago" className={paid ? 'paid-select paid' : 'paid-select'} value={paid ? 'paid' : 'unpaid'} onChange={e => changePaid(e.target.value === 'paid')}>
      <option value="unpaid">No pagado</option>
      <option value="paid">Pagado</option>
    </select>
    <span className="expense-month">
      <input aria-label="Mes de la carpeta" inputMode="numeric" maxLength={7} placeholder="mm/aaaa" value={monthDraft} onChange={e => setMonthDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveMonth(); }} />
      <button type="button" onClick={saveMonth}>Guardar</button>
      {savedHere && <span className="expense-month-saved" role="img" aria-label={`Guardado en ${expense.month}`} title={`Guardado en ${expense.month}`}>✓</span>}
    </span>
    <button aria-label="Borrar gasto" onClick={onDelete}>×</button>
    {error && <small role="alert">{error}</small>}
  </div>;
}

export function Expenses() {
  const { data, setData } = useData();
  const [concept, setConcept] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Otros');
  const [date, setDate] = useState(() => formatExpenseDate(localToday()));
  const [amount, setAmount] = useState('');
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState('');
  const [month, setMonth] = useState('');
  const [monthNotice, setMonthNotice] = useState('');
  const months = data.expenseMonths ?? [];
  let sumError = '';
  let sum = 0;
  let categoryTotals: Record<ExpenseCategory, number> = Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c, 0])) as Record<ExpenseCategory, number>;
  try { sum = total(data.expenses); categoryTotals = totalsByCategory(data.expenses); } catch (e) { sumError = e instanceof Error ? e.message : 'Total inválido'; }
  const readForm = (): Expense | null => {
    const cents = parseCents(amount);
    const isoDate = parseExpenseDate(date);
    if (!concept.trim() || isoDate === null || cents === null) {
      setError('Ingresá un concepto, una fecha y un monto válido no negativo.');
      return null;
    }
    return { id: id(), concept: concept.trim(), date: isoDate, cents, category, paid };
  };
  const resetForm = () => {
    setConcept('');
    setDate(formatExpenseDate(localToday()));
    setAmount('');
    setPaid(false);
    setError('');
  };
  const add = (e: FormEvent) => {
    e.preventDefault();
    const expense = readForm();
    if (!expense) return;
    setData(d => ({ ...d, expenses: [...d.expenses, expense] }));
    resetForm();
  };
  // Guardar en un mes: crea la carpeta si no existe y, si el formulario tiene un gasto, lo anota en su hoja.
  const saveToMonth = () => {
    const name = cleanMonthName(month);
    setMonthNotice('');
    if (!name) { setError('Escribí un mes, por ejemplo “Agosto 2026”.'); return; }
    const formEmpty = !concept.trim() && !amount.trim();
    const expense = formEmpty ? null : readForm();
    if (!formEmpty && !expense) return;
    setData(d => ({ ...d, expenseMonths: appendToMonth(d.expenseMonths ?? [], name, expense ? [expense] : []) }));
    const folderName = months.find(m => sameMonthName(m.name, name))?.name ?? name;
    if (expense) resetForm(); else setError('');
    setMonthNotice(expense ? `Gasto guardado en “${folderName}”.` : `Carpeta “${folderName}” lista.`);
  };
  // Guardar un gasto de la lista en su carpeta mm/aaaa; la carpeta se crea si todavía no existe.
  const saveRowToMonth = (expenseId: string, key: string) => setData(d => {
    const current = d.expenses.find(v => v.id === expenseId);
    if (!current) return d;
    const next = { ...current, month: key };
    return { ...d, expenses: d.expenses.map(v => v.id === expenseId ? next : v), expenseMonths: moveToMonth(d.expenseMonths ?? [], key, next) };
  });
  // Cerrar el mes: pasa toda la lista actual a la carpeta y deja la lista vacía para empezar el siguiente.
  const closeMonth = () => {
    const name = cleanMonthName(month);
    setMonthNotice('');
    if (!name) { setError('Escribí el mes que querés cerrar, por ejemplo “Agosto 2026”.'); return; }
    if (data.expenses.length === 0) { setError('No hay gastos en la lista para pasar al mes.'); return; }
    const folderName = months.find(m => sameMonthName(m.name, name))?.name ?? name;
    const count = data.expenses.length;
    if (!confirm(`¿Pasar ${count} ${count === 1 ? 'gasto' : 'gastos'} de la lista a “${folderName}”? La lista quedará vacía.`)) return;
    setData(d => ({ ...d, expenses: [], expenseMonths: d.expenses.reduce((list, e) => moveToMonth(list, name, e), d.expenseMonths ?? []) }));
    setError('');
    setMonthNotice(`Mes cerrado: ${count} ${count === 1 ? 'gasto pasó' : 'gastos pasaron'} a “${folderName}”.`);
  };
  return <section><div className="section-title"><div className="title-with-floppy"><div><p className="eyebrow">Control cotidiano</p><h1>Mis gastos</h1></div><Link className="floppy floppy--small" to="/gastos/meses" aria-label="Meses guardados" title="Meses guardados"><span className="floppy-shutter" aria-hidden="true" /><span>Meses</span></Link></div><div className="total"><small>Total</small><strong>{sumError ? '—' : money(sum)}</strong>{sumError && <small role="alert">{sumError}</small>}</div></div><div className="expenses-layout"><div className="calculator"><form onSubmit={add}>
    <label>Gasto<input value={concept} onChange={e => setConcept(e.target.value)} placeholder="Ej. Electricidad" /></label>
    <label>Categoría<select aria-label="Categoría del gasto" value={category} onChange={e => setCategory(e.target.value as ExpenseCategory)}>
      {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
    </select></label>
    <div className="expense-field"><label htmlFor="new-expense-date">Fecha</label><DateInput id="new-expense-date" label="Fecha del gasto" value={date} onChange={setDate} /></div>
    <label>Monto<MoneyInput label="Monto del gasto en pesos" value={amount} onChange={setAmount} placeholder="0,00" /></label>
    <label>Pagado<select aria-label="Estado de pago del gasto" className={paid ? 'paid-select paid' : 'paid-select'} value={paid ? 'paid' : 'unpaid'} onChange={e => setPaid(e.target.value === 'paid')}>
      <option value="unpaid">No pagado</option>
      <option value="paid">Pagado</option>
    </select></label>
    <button>Agregar</button>
    <div className="month-save">
      <label>Mes<input value={month} onChange={e => { setMonth(e.target.value); setMonthNotice(''); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveToMonth(); } }} placeholder="Ej. Agosto 2026" list="expense-month-names" /></label>
      <datalist id="expense-month-names">{months.map(m => <option key={m.id} value={m.name} />)}</datalist>
      <button type="button" onClick={saveToMonth}>Guardar</button>
      <button type="button" className="close-month" onClick={closeMonth}>Cerrar mes</button>
      {monthNotice && <span role="status">{monthNotice}</span>}
    </div>
    {error && <p role="alert">{error}</p>}
  </form><div className="expense-list">{data.expenses.map(e => <ExpenseRow key={e.id} expense={e} onChange={next => setData(d => ({ ...d, expenses: d.expenses.map(v => v.id === e.id ? next : v), expenseMonths: syncMonthEntry(d.expenseMonths, next) }))} onSaveMonth={key => saveRowToMonth(e.id, key)} onDelete={() => setData(d => ({ ...d, expenses: d.expenses.filter(v => v.id !== e.id) }))} />)}</div></div><aside className="expense-summary">
    <h2>Subtotales</h2>
    <ul>{EXPENSE_CATEGORIES.map(c => <li key={c}><span>{c}</span><strong>{sumError ? '—' : money(categoryTotals[c])}</strong></li>)}</ul>
    <div className="expense-summary-total"><span>Total</span><strong>{sumError ? '—' : money(sum)}</strong></div>
  </aside></div></section>;
}
