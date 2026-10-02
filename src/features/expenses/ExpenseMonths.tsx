import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../../app/DataContext';
import { cleanMonthName, EXPENSE_CATEGORIES, parseCents, sameMonthName, sortMonths, total, totalsByCategory, type Expense, type ExpenseCategory, type ExpenseMonth } from '../../storage/model';
import { DateInput, editableMoney, formatExpenseDate, MoneyInput, money, parseExpenseDate } from './Expenses';
const monthTotal = (month: ExpenseMonth) => { try { return money(total(month.expenses)); } catch { return '—'; } };
const monthCategories = (month: ExpenseMonth) => { try { const sums = totalsByCategory(month.expenses); return EXPENSE_CATEGORIES.filter(c => sums[c] > 0).map(c => ({ category: c, cents: sums[c] })); } catch { return []; } };

// Renglón de la hoja: se lee como texto y, al tocar Editar, se convierte en un formulario con todos los datos del gasto.
function LedgerLine({ expense, onTogglePaid, onSave, onDelete }: { expense: Expense; onTogglePaid: () => void; onSave: (next: Expense) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [concept, setConcept] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Otros');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState('');
  const startEditing = () => {
    setConcept(expense.concept);
    setCategory(expense.category ?? 'Otros');
    setDate(expense.date ? formatExpenseDate(expense.date) : '');
    setAmount(editableMoney(expense.cents));
    setPaid(expense.paid ?? false);
    setError('');
    setEditing(true);
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    const cents = parseCents(amount);
    const isoDate = date === '' ? null : parseExpenseDate(date);
    if (!concept.trim() || cents === null || (date !== '' && isoDate === null)) { setError('Revisá el gasto, la fecha (dd/mm/aaaa) y el monto.'); return; }
    const next: Expense = { ...expense, concept: concept.trim(), category, cents, paid };
    if (isoDate) next.date = isoDate;
    else delete next.date;
    onSave(next);
    setEditing(false);
  };
  if (editing) return <li className="ledger-editing">
    <form className="ledger-edit" onSubmit={save} aria-label={`Editar ${expense.concept}`}>
      <input aria-label="Gasto" value={concept} onChange={e => setConcept(e.target.value)} />
      <select aria-label="Categoría" value={category} onChange={e => setCategory(e.target.value as ExpenseCategory)}>
        {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <DateInput id={`ledger-date-${expense.id}`} label="Fecha" value={date} onChange={setDate} />
      <MoneyInput label="Monto en pesos" value={amount} onChange={setAmount} />
      <select aria-label="Estado de pago" className={paid ? 'paid-select paid' : 'paid-select'} value={paid ? 'paid' : 'unpaid'} onChange={e => setPaid(e.target.value === 'paid')}>
        <option value="unpaid">No pagado</option>
        <option value="paid">Pagado</option>
      </select>
      <span className="ledger-edit-actions">
        <button>Guardar cambios</button>
        <button type="button" className="ledger-cancel" onClick={() => setEditing(false)}>Cancelar</button>
      </span>
      {error && <small role="alert">{error}</small>}
    </form>
  </li>;
  return <li>
    <span className="ledger-text">{expense.concept} / {expense.category ?? 'Otros'} / {expense.date ? formatExpenseDate(expense.date) : 'sin fecha'} / {money(expense.cents)} / <button type="button" className={expense.paid ? 'ledger-status ledger-paid' : 'ledger-status ledger-unpaid'} aria-pressed={expense.paid ?? false} title="Tocá para cambiar el estado de pago" onClick={onTogglePaid}>{expense.paid ? 'Pagado' : 'No pagado'}</button></span>
    <span className="ledger-actions">
      <button type="button" onClick={startEditing} aria-label={`Editar ${expense.concept}`}>Editar</button>
      <button type="button" className="ledger-delete" onClick={onDelete} aria-label={`Borrar ${expense.concept}`}>Borrar</button>
    </span>
  </li>;
}

export function ExpenseMonths() {
  const { data, setData } = useData();
  const months = sortMonths(data.expenseMonths ?? []);
  const [selected, setSelected] = useState<string | null>(null);
  const month = months.find(m => m.id === selected);

  const update = (change: (months: ExpenseMonth[]) => ExpenseMonth[]) =>
    setData(d => ({ ...d, expenseMonths: change(d.expenseMonths ?? []) }));
  const rename = (target: ExpenseMonth) => {
    const answer = prompt('Nuevo nombre de la carpeta', target.name);
    const name = cleanMonthName(answer ?? '');
    if (!name || name === target.name) return;
    if (months.some(m => m.id !== target.id && sameMonthName(m.name, name))) { alert(`Ya existe una carpeta llamada “${name}”.`); return; }
    update(list => list.map(m => m.id === target.id ? { ...m, name } : m));
  };
  const remove = (target: ExpenseMonth) => {
    if (!confirm(`¿Borrar la carpeta “${target.name}” y sus ${target.expenses.length} gastos?`)) return;
    if (selected === target.id) setSelected(null);
    update(list => list.filter(m => m.id !== target.id));
  };
  // El estado de pago se mantiene igual en la hoja y en la lista de Mis gastos.
  const togglePaid = (target: ExpenseMonth, expenseId: string) => setData(d => {
    const entry = d.expenseMonths?.find(m => m.id === target.id)?.expenses.find(e => e.id === expenseId);
    if (!entry) return d;
    const paid = !entry.paid;
    return { ...d, expenses: d.expenses.map(e => e.id === expenseId ? { ...e, paid } : e), expenseMonths: (d.expenseMonths ?? []).map(m => m.id === target.id ? { ...m, expenses: m.expenses.map(e => e.id === expenseId ? { ...e, paid } : e) } : m) };
  });
  const saveLine = (target: ExpenseMonth, next: Expense) =>
    update(list => list.map(m => m.id === target.id ? { ...m, expenses: m.expenses.map(e => e.id === next.id ? next : e) } : m));
  const removeLine = (target: ExpenseMonth, expenseId: string, concept: string) => {
    if (!confirm(`¿Borrar “${concept}” de ${target.name}?`)) return;
    update(list => list.map(m => m.id === target.id ? { ...m, expenses: m.expenses.filter(e => e.id !== expenseId) } : m));
  };

  return (
    <section>
      <div className="section-title">
        <div><p className="eyebrow">Gastos archivados</p><h1>Meses guardados</h1></div>
        <Link className="back-to-expenses" to="/gastos">← Mis gastos</Link>
      </div>
      <div className="floppy-page">
        <div className="floppy-page-body">
          <div className="floppy-page-shutter" aria-hidden="true"><span /></div>
          <div className="floppy-page-label">
            {month
              ? <div className="month-sheet">
                <div className="month-sheet-actions">
                  <button onClick={() => setSelected(null)}>‹ Carpetas</button>
                  <button onClick={() => rename(month)}>Editar nombre</button>
                  <button className="delete" onClick={() => remove(month)}>Borrar carpeta</button>
                </div>
                <div className="ledger" aria-label={`Hoja de ${month.name}`}>
                  <h2>{month.name}</h2>
                  {month.expenses.length === 0
                    ? <p className="ledger-empty">Hoja en blanco. En Mis gastos elegí “{month.name}” en un gasto y tocá Guardar.</p>
                    : <ol>
                      {month.expenses.map(e => <LedgerLine key={e.id} expense={e} onTogglePaid={() => togglePaid(month, e.id)} onSave={next => saveLine(month, next)} onDelete={() => removeLine(month, e.id, e.concept)} />)}
                    </ol>}
                  {monthCategories(month).length > 0 && <div className="ledger-categories">
                    <h3>Por categoría</h3>
                    <ul>{monthCategories(month).map(({ category, cents }) => <li key={category}><span>{category}</span><strong>{money(cents)}</strong></li>)}</ul>
                  </div>}
                  <p className="ledger-total"><span>Total del mes</span><strong>{monthTotal(month)}</strong></p>
                </div>
              </div>
              : months.length === 0
                ? <div className="empty"><h2>Todavía no hay meses guardados</h2><p>En Mis gastos, abajo del formulario, cargá un mes (por ejemplo 08/2026) y tocá Crear carpeta.</p></div>
                : <ul className="month-folders">
                  {months.map(m => <li key={m.id} className="month-folder">
                    <button className="month-folder-open" onClick={() => setSelected(m.id)} aria-label={`Abrir ${m.name}`}>
                      <span className="month-folder-icon" aria-hidden="true">📁</span>
                      <strong>{m.name}</strong>
                      <small>{m.expenses.length} {m.expenses.length === 1 ? 'gasto' : 'gastos'} · {monthTotal(m)}</small>
                    </button>
                    <div className="month-folder-actions">
                      <button onClick={() => rename(m)} aria-label={`Editar nombre de ${m.name}`}>Editar</button>
                      <button className="delete" onClick={() => remove(m)} aria-label={`Borrar ${m.name}`}>Borrar</button>
                    </div>
                  </li>)}
                </ul>}
          </div>
        </div>
      </div>
    </section>
  );
}
