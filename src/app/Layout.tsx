import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { parseBackup, serialize } from '../storage/store';
import { useData } from './DataContext';
import { useAuth } from './AuthContext';
import { HeaderClock } from './HeaderClock';
import { HeaderDate } from './HeaderDate';
import logo from '../assets/images/logo-escritorio.webp';

export function Layout() {
  const { data, setData, warning, syncState, retry, loadRemote } = useData();
  const { user, signOut, error: authError } = useAuth();
  const loc = useLocation().pathname;
  const activeSection = loc === '/' ? 'board' : loc.startsWith('/diario') ? 'journal' : loc.startsWith('/gastos') ? 'expenses' : loc.startsWith('/calendario') ? 'calendar' : loc.startsWith('/juegos') ? 'games' : '';
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
      <div className="brand-row"><Link className="brand brand--logo" to="/"><img src={logo} alt="Escritorio Personal" width={640} height={145} draggable={false} /></Link><HeaderClock /><HeaderDate /></div>
      <div className="backup">
        <div className="backup-actions">
          <button onClick={download}>Exportar</button>
          <button ref={importButton} onClick={() => input.current?.click()}>Importar</button>
          <input ref={input} hidden type="file" accept="application/json" onChange={pick} />
        </div>
        <div className="account-summary">
          <span className={`sync-status sync-status--${syncState}`} role="status">
            <span className="sync-dot" aria-hidden="true" />
            {syncState === 'saving' ? 'Guardando…' : syncState === 'synced' ? 'Sincronizado' : syncState === 'conflict' ? 'Conflicto' : syncState === 'error' ? 'Sin conexión' : 'Cargando…'}
          </span>
          <span className="identity">{user?.email}</span>
        </div>
        <button onClick={() => void signOut()}>Salir</button>
      </div>
    </header>
    {(warning || authError) && <p role="alert" className="warning">{warning ?? authError} {syncState === 'error' && <button onClick={retry}>Reintentar</button>} {syncState === 'conflict' && <button onClick={loadRemote}>Cargar versión remota</button>}</p>}
    <main><Outlet /></main>
    {pending && <div className="modal" role="dialog" aria-modal="true" aria-labelledby="restore-title"><div>
      <h2 id="restore-title">¿Restaurar esta copia?</h2>
      <p>Contiene {pending.notes.length} notas, {pending.folders.length} carpetas y {pending.expenses.length} gastos. Reemplazará los datos actuales.</p>
      <button ref={confirmButton} onClick={() => { setData(pending); close(); }}>Confirmar restauración</button>
      <button onClick={close}>Cancelar</button>
    </div></div>}
    <nav className="mobile-nav" aria-label="Navegación">
      <Link to="/" data-section="board" className={activeSection === 'board' ? 'active' : undefined} aria-current={activeSection === 'board' ? 'page' : undefined}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
        <span>Notas</span>
      </Link>
      <Link to="/diario" data-section="journal" className={activeSection === 'journal' ? 'active' : undefined} aria-current={activeSection === 'journal' ? 'page' : undefined}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
        <span>Diario</span>
      </Link>
      <Link to="/gastos" data-section="expenses" className={activeSection === 'expenses' ? 'active' : undefined} aria-current={activeSection === 'expenses' ? 'page' : undefined}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M12 12v5M9.5 14.5h5"/></svg>
        <span>Gastos</span>
      </Link>
      <Link to="/calendario" data-section="calendar" className={activeSection === 'calendar' ? 'active' : undefined} aria-current={activeSection === 'calendar' ? 'page' : undefined}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
        <span>Calendario</span>
      </Link>
      <Link to="/juegos" data-section="games" className={activeSection === 'games' ? 'active' : undefined} aria-current={activeSection === 'games' ? 'page' : undefined}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><rect x="2" y="6" width="20" height="14" rx="4"/><path d="M8 13h4M10 11v4"/><circle cx="16" cy="11" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="15" r="1.2" fill="currentColor" stroke="none"/></svg>
        <span>Juegos</span>
      </Link>
    </nav>
  </>;
}
