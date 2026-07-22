import { FormEvent, useEffect, useState } from 'react';
import { useData } from '../../app/DataContext';
import { id, isExpenseDate, parseCents, total, type Expense } from '../../storage/model';

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

function DateInput({ value, onChange, onBlur, onEnter, label }: { value: string; onChange: (value: string) => void; onBlur?: () => void; onEnter?: () => void; label: string }) {
  return <input aria-label={label} type="text" inputMode="text" maxLength={10} placeholder="dd/mm/yyyy" value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur} onKeyDown={e => { if (e.key === 'Enter') onEnter?.(); }} />;
}

function MoneyInput({ value, onChange, onBlur, label, placeholder }: { value: string; onChange: (value: string) => void; onBlur?: () => void; label: string; placeholder?: string }) {
  return <span className="money-input"><span aria-hidden="true">$</span><input aria-label={label} inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur} placeholder={placeholder} /></span>;
}

function ExpenseRow({ expense, onChange, onDelete }: { expense: Expense; onChange: (e: Expense) => void; onDelete: () => void }) {
  const [concept, setConcept] = useState(expense.concept);
  const [date, setDate] = useState(expense.date ? formatExpenseDate(expense.date) : '');
  const [amount, setAmount] = useState(editableMoney(expense.cents));
  const [error, setError] = useState('');
  useEffect(() => { setConcept(expense.concept); setDate(expense.date ? formatExpenseDate(expense.date) : ''); setAmount(editableMoney(expense.cents)); }, [expense]);
  const commit = () => {
    const cents = parseCents(amount);
    const isoDate = date === '' ? null : parseExpenseDate(date);
    if (!concept.trim() || cents === null || (date !== '' && isoDate === null)) {
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
  return <div className="expense-row">
    <input aria-label="Concepto" value={concept} onChange={e => setConcept(e.target.value)} onBlur={commit} />
    <DateInput label="Fecha" value={date} onChange={setDate} onBlur={commit} onEnter={commit} />
    <MoneyInput label="Monto en pesos" value={amount} onChange={setAmount} onBlur={commit} />
    <button aria-label="Borrar gasto" onClick={onDelete}>×</button>
    {error && <small role="alert">{error}</small>}
  </div>;
}

export function Expenses() {
  const { data, setData } = useData();
  const [concept, setConcept] = useState('');
  const [date, setDate] = useState(() => formatExpenseDate(localToday()));
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  let sumError = '';
  let sum = 0;
  try { sum = total(data.expenses); } catch (e) { sumError = e instanceof Error ? e.message : 'Total inválido'; }
  const add = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseCents(amount);
    const isoDate = parseExpenseDate(date);
    if (!concept.trim() || isoDate === null || cents === null) {
      setError('Ingresá un concepto, una fecha y un monto válido no negativo.');
      return;
    }
    setData(d => ({ ...d, expenses: [...d.expenses, { id: id(), concept: concept.trim(), date: isoDate, cents }] }));
    setConcept('');
    setDate(formatExpenseDate(localToday()));
    setAmount('');
    setError('');
  };
  return <section><div className="section-title"><div><p className="eyebrow">Control cotidiano</p><h1>Mis gastos</h1></div><div className="total"><small>Total</small><strong>{sumError ? '—' : money(sum)}</strong>{sumError && <small role="alert">{sumError}</small>}</div></div><div className="calculator"><form onSubmit={add}>
    <label>Gasto<input value={concept} onChange={e => setConcept(e.target.value)} placeholder="Ej. Electricidad" /></label>
    <label>Fecha<DateInput label="Fecha del gasto" value={date} onChange={setDate} /></label>
    <label>Monto<MoneyInput label="Monto del gasto en pesos" value={amount} onChange={setAmount} placeholder="0,00" /></label>
    <button>Agregar</button>
    {error && <p role="alert">{error}</p>}
  </form><div className="expense-list">{data.expenses.map(e => <ExpenseRow key={e.id} expense={e} onChange={next => setData(d => ({ ...d, expenses: d.expenses.map(v => v.id === e.id ? next : v) }))} onDelete={() => setData(d => ({ ...d, expenses: d.expenses.filter(v => v.id !== e.id) }))} />)}</div></div></section>;
}
