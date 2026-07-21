import { useEffect, useRef, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { parseBackup, serialize } from '../storage/store';
import { useData } from './DataContext';

export function Layout() {
  const { data, setData, warning } = useData();
  const input = useRef<HTMLInputElement>(null);
  const importButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState<ReturnType<typeof parseBackup> | null>(null);
  const close = () => {
    setPending(null);
    requestAnimationFrame(() => importButton.current?.focus());
  };

  useEffect(() => {
    if (!pending) return;
    confirmButton.current?.focus();
    const key = (event: KeyboardEvent) => event.key === 'Escape' && close();
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [pending]);

  const download = () => {
    const url = URL.createObjectURL(new Blob([serialize(data)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `escritorio-personal-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const pick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try { setPending(parseBackup(await file.text())); }
    catch (error) { alert(error instanceof Error ? error.message : 'Copia inválida'); }
    event.target.value = '';
  };

  return <>
    <header>
      <Link className="brand" to="/">Escritorio Personal</Link>
      <div className="backup">
        <button onClick={download}>Exportar</button>
        <button ref={importButton} onClick={() => input.current?.click()}>Importar</button>
        <input ref={input} hidden type="file" accept="application/json" onChange={pick} />
      </div>
    </header>
    {warning && <p role="alert" className="warning">{warning}</p>}
    <main><Outlet /></main>
    {pending && <div className="modal" role="dialog" aria-modal="true" aria-labelledby="restore-title"><div>
      <h2 id="restore-title">¿Restaurar esta copia?</h2>
      <p>Contiene {pending.notes.length} notas, {pending.folders.length} carpetas y {pending.expenses.length} gastos. Reemplazará los datos actuales.</p>
      <button ref={confirmButton} onClick={() => { setData(pending); close(); }}>Confirmar restauración</button>
      <button onClick={close}>Cancelar</button>
    </div></div>}
  </>;
}
