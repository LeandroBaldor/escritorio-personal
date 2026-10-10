import { FocusEvent, FormEvent, KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../../app/DataContext';
import { useFitInput } from '../../app/useFitInput';
import { CalendarLink, DeskLink, GamesLink, NotebookLink, SectionObjects } from '../../app/SectionObjects';
import { FloatingCalculator } from './FloatingCalculator';
import memeCalculos from '../../assets/images/meme-calculos.jpg';
import { appendToMonth, EXPENSE_CATEGORIES, id, isExpenseDate, moveToMonth, parseCents, parseMonthKey, sameMonthName, sortMonths, syncMonthEntry, type ExpenseMonth, total, totalsByCategory, type Expense, type ExpenseCategory } from '../../storage/model';

const integerMoney = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const moneyParts = (c: number) => ({ whole: Math.trunc(c / 100), fraction: c % 100 });
export const money = (c: number) => { const { whole, fraction } = moneyParts(c); return `$\u00a0${integerMoney.format(whole)},${String(fraction).padStart(2, '0')}`; };
export const editableMoney = (c: number) => { const { whole, fraction } = moneyParts(c); return `${integerMoney.format(whole)},${String(fraction).padStart(2, '0')}`; };
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

export function DateInput({ id, value, onChange, onBlur, onEnter, onCalendarSelect, label }: { id: string; value: string; onChange: (value: string) => void; onBlur?: () => void; onEnter?: () => void; onCalendarSelect?: (value: string) => void; label: string }) {
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

export function MoneyInput({ value, onChange, onBlur, label, placeholder }: { value: string; onChange: (value: string) => void; onBlur?: () => void; label: string; placeholder?: string }) {
  const fitRef = useFitInput(value);
  return <span className="money-input"><span aria-hidden="true">$</span><input ref={fitRef} aria-label={label} inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} onBlur={() => { const cents = parseCents(value); if (cents !== null) onChange(editableMoney(cents)); onBlur?.(); }} placeholder={placeholder} /></span>;
}

// Menú propio en lugar de <select>: el nativo abre hacia arriba cerca del borde de la pantalla, éste siempre abre hacia abajo.
function MonthPicker({ months, value, onChange }: { months: ExpenseMonth[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLSpanElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = months.find(m => m.id === value);
  const disabled = months.length === 0;
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    listRef.current?.scrollIntoView({ block: 'nearest' });
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const show = () => { setActive(Math.max(0, months.findIndex(m => m.id === value))); setOpen(true); };
  const choose = (id: string) => { onChange(id); setOpen(false); };
  const onKeyDown = (event: KeyboardEvent) => {
    if (disabled) return;
    if (event.key === 'Escape') { setOpen(false); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) { show(); return; }
      setActive(i => Math.min(months.length - 1, Math.max(0, i + (event.key === 'ArrowDown' ? 1 : -1))));
    } else if ((event.key === 'Enter' || event.key === ' ') && open) {
      event.preventDefault();
      choose(months[active].id);
    }
  };
  return <span className="month-picker" ref={rootRef} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <button type="button" className="month-picker-button" aria-label="Carpeta del mes" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-activedescendant={open ? `${listId}-${active}` : undefined}
      disabled={disabled} onClick={() => (open ? setOpen(false) : show())} onKeyDown={onKeyDown}>
      <span>{selected ? selected.name : disabled ? 'Sin carpetas' : 'Elegí el mes'}</span><span aria-hidden="true" className="month-picker-arrow">▾</span>
    </button>
    {open && <ul className="month-picker-list" role="listbox" id={listId} ref={listRef} aria-label="Carpetas de meses">
      {months.map((m, i) => <li key={m.id} id={`${listId}-${i}`} role="option" aria-selected={m.id === value} className={i === active ? 'active' : undefined}
        onPointerDown={event => event.preventDefault()} onPointerEnter={() => setActive(i)} onClick={() => choose(m.id)}>{m.name}</li>)}
    </ul>}
  </span>;
}

function ExpenseRow({ expense, months, onChange, onDelete, onSaveToFolder }: { expense: Expense; months: ExpenseMonth[]; onChange: (e: Expense) => void; onDelete: () => void; onSaveToFolder: (folderId: string) => void }) {
  const [concept, setConcept] = useState(expense.concept);
  const conceptRef = useFitInput(concept);
  const [category, setCategory] = useState<ExpenseCategory>(expense.category ?? 'Otros');
  const [date, setDate] = useState(expense.date ? formatExpenseDate(expense.date) : '');
  const [amount, setAmount] = useState(editableMoney(expense.cents));
  const [paid, setPaid] = useState(expense.paid ?? false);
  const [folderId, setFolderId] = useState('');
  const [error, setError] = useState('');
  const keepDrafts = useRef(false);
  const folder = months.find(m => m.id === folderId);
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
  const saveToFolder = () => {
    if (!folder) { setError(months.length === 0 ? 'Primero cargá un mes abajo del formulario.' : 'Elegí la carpeta del mes.'); return; }
    setError('');
    onSaveToFolder(folder.id);
  };
  return <div className="expense-row">
    <input ref={conceptRef} aria-label="Concepto" value={concept} onChange={e => setConcept(e.target.value)} onBlur={() => commit()} />
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
      <MonthPicker months={months} value={folder ? folderId : ''} onChange={value => { setFolderId(value); setError(''); }} />
      <button type="button" onClick={saveToFolder}>Guardar</button>
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
  const months = sortMonths(data.expenseMonths ?? []);
  const [summaryMonthId, setSummaryMonthId] = useState('');
  const summaryMonth = months.find(m => m.id === summaryMonthId);
  const summaryExpenses = summaryMonth ? summaryMonth.expenses : data.expenses;
  const totals = (expenses: Expense[]) => {
    try { return { sum: total(expenses), byCategory: totalsByCategory(expenses), error: '' }; }
    catch (e) { return { sum: 0, byCategory: Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c, 0])) as Record<ExpenseCategory, number>, error: e instanceof Error ? e.message : 'Total inválido' }; }
  };
  const summary = totals(summaryExpenses);
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
  // Cargar mes: crea la carpeta mm/aaaa en el disquete para después elegirla en cada gasto.
  const createMonth = () => {
    setMonthNotice('');
    const key = parseMonthKey(month);
    if (!key) { setError('Escribí el mes como mm/aaaa, por ejemplo 08/2026.'); return; }
    setError('');
    setMonth('');
    if (months.some(m => sameMonthName(m.name, key))) { setMonthNotice(`La carpeta ${key} ya existe.`); return; }
    setData(d => ({ ...d, expenseMonths: appendToMonth(d.expenseMonths ?? [], key, []) }));
    setMonthNotice(`Carpeta ${key} creada en el disquete.`);
  };
  // Guardar un gasto en la carpeta elegida: pasa al disquete y sale de la lista de Mis gastos.
  const saveRowToFolder = (expenseId: string, folderId: string) => {
    const target = months.find(m => m.id === folderId);
    const current = data.expenses.find(v => v.id === expenseId);
    if (!target || !current) return;
    setData(d => {
      const expense = d.expenses.find(v => v.id === expenseId);
      const folder = d.expenseMonths?.find(m => m.id === folderId);
      if (!expense || !folder) return d;
      return { ...d, expenses: d.expenses.filter(v => v.id !== expenseId), expenseMonths: moveToMonth(d.expenseMonths ?? [], folder.name, expense) };
    });
    setMonthNotice(`“${current.concept}” se guardó en ${target.name}.`);
  };
  return <section className="expenses-page"><div className="section-title"><div className="title-with-floppy"><div><p className="eyebrow">Control cotidiano</p><h1>Mis gastos</h1></div><Link className="floppy floppy--small" to="/gastos/meses" aria-label="Meses guardados" title="Meses guardados"><span className="floppy-shutter" aria-hidden="true" /><span>Meses</span></Link></div><div className="calc-art" aria-hidden="true"><img src={memeCalculos} alt="" width={800} height={337} draggable={false} /></div><SectionObjects large><DeskLink /><NotebookLink /><CalendarLink /><GamesLink /></SectionObjects></div><div className="expenses-layout"><div className="calculator"><form onSubmit={add}>
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
      <label>Cargar mes<input value={month} inputMode="numeric" maxLength={7} onChange={e => { setMonth(e.target.value); setMonthNotice(''); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createMonth(); } }} placeholder="mm/aaaa" /></label>
      <button type="button" onClick={createMonth}>Crear carpeta</button>
      {monthNotice && <span role="status">{monthNotice}</span>}
    </div>
    {error && <p role="alert">{error}</p>}
  </form><div className="expense-list">{data.expenses.map(e => <ExpenseRow key={e.id} expense={e} onChange={next => setData(d => ({ ...d, expenses: d.expenses.map(v => v.id === e.id ? next : v), expenseMonths: syncMonthEntry(d.expenseMonths, next) }))} months={months} onSaveToFolder={folderId => saveRowToFolder(e.id, folderId)} onDelete={() => setData(d => ({ ...d, expenses: d.expenses.filter(v => v.id !== e.id) }))} />)}</div></div><aside className="expense-summary">
    <h2>Subtotales</h2>
    <label className="summary-month">Ver mes<select aria-label="Mes de los subtotales" value={summaryMonth ? summaryMonthId : ''} onChange={e => setSummaryMonthId(e.target.value)}>
      <option value="">Gastos actuales</option>
      {months.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
    </select></label>
    <ul>{EXPENSE_CATEGORIES.map(c => <li key={c}><span>{c}</span><strong>{summary.error ? '—' : money(summary.byCategory[c])}</strong></li>)}</ul>
    <div className="expense-summary-total"><span>Total</span><strong>{summary.error ? '—' : money(summary.sum)}</strong></div>
    {summary.error && <small role="alert">{summary.error}</small>}
    <FloatingCalculator />
  </aside></div></section>;
}
