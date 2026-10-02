import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../../app/DataContext';
import { cleanMonthName, EXPENSE_CATEGORIES, isMonthKey, sameMonthName, total, totalsByCategory, type ExpenseMonth } from '../../storage/model';
import { formatExpenseDate, money } from './Expenses';

const monthOrder = (name: string) => isMonthKey(name) ? Number(name.slice(3)) * 100 + Number(name.slice(0, 2)) : Number.MAX_SAFE_INTEGER;
const byMonth = (a: ExpenseMonth, b: ExpenseMonth) => monthOrder(a.name) - monthOrder(b.name);
const monthTotal = (month: ExpenseMonth) => { try { return money(total(month.expenses)); } catch { return '—'; } };
const monthCategories = (month: ExpenseMonth) => { try { const sums = totalsByCategory(month.expenses); return EXPENSE_CATEGORIES.filter(c => sums[c] > 0).map(c => ({ category: c, cents: sums[c] })); } catch { return []; } };

export function ExpenseMonths() {
  const { data, setData } = useData();
  const months = [...(data.expenseMonths ?? [])].sort(byMonth);
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
                    ? <p className="ledger-empty">Hoja en blanco. Guardá un gasto en “{month.name}” desde Mis gastos.</p>
                    : <ol>
                      {month.expenses.map(e => <li key={e.id}>
                        <span className="ledger-text">{e.concept} / {e.category ?? 'Otros'} / {e.date ? formatExpenseDate(e.date) : 'sin fecha'} / {money(e.cents)} / <button type="button" className={e.paid ? 'ledger-status ledger-paid' : 'ledger-status ledger-unpaid'} aria-pressed={e.paid ?? false} title="Tocá para cambiar el estado de pago" onClick={() => togglePaid(month, e.id)}>{e.paid ? 'Pagado' : 'No pagado'}</button></span>
                        <button className="ledger-remove" aria-label={`Borrar ${e.concept} de la hoja`} onClick={() => removeLine(month, e.id, e.concept)}>×</button>
                      </li>)}
                    </ol>}
                  {monthCategories(month).length > 0 && <div className="ledger-categories">
                    <h3>Por categoría</h3>
                    <ul>{monthCategories(month).map(({ category, cents }) => <li key={category}><span>{category}</span><strong>{money(cents)}</strong></li>)}</ul>
                  </div>}
                  <p className="ledger-total"><span>Total del mes</span><strong>{monthTotal(month)}</strong></p>
                </div>
              </div>
              : months.length === 0
                ? <div className="empty"><h2>Todavía no hay meses guardados</h2><p>En Mis gastos escribí un mes en un gasto, por ejemplo 08/2026, y tocá Guardar.</p></div>
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
