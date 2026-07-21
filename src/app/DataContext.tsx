import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { type Data, EMPTY, isData } from '../storage/model';
import { load, loadForUser, markMigrationDecided, migrationDecided, saveForUser } from '../storage/store';
import { type DataBackend, supabaseBackend } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type SyncState = 'loading' | 'saving' | 'synced' | 'error' | 'conflict';
type Ctx = { data: Data; setData: React.Dispatch<React.SetStateAction<Data>>; loading: boolean; syncState: SyncState; warning?: string; retry(): void; loadRemote(): void };
const Context = createContext<Ctx | null>(null);
const messageOf = (issue: unknown) => issue instanceof Error ? issue.message : 'error de red';

function developmentBackend(): DataBackend | null {
  if (!(import.meta.env.DEV && import.meta.env.VITE_E2E_AUTH === 'true')) return null;
  return {
    async read(userId) { const cached = loadForUser(userId); return { data: cached.exists ? { user_id: userId, data: cached.data, updated_at: 'e2e' } : null, error: null }; },
    async insert(userId, data) { saveForUser(userId, data); return { data: { user_id: userId, data, updated_at: 'e2e' }, error: null }; },
    async update(userId, data) { saveForUser(userId, data); return { data: { user_id: userId, data, updated_at: 'e2e' }, error: null }; },
  };
}

export function DataProvider({ children, backend: providedBackend }: { children: ReactNode; backend?: DataBackend | null }) {
  const { user } = useAuth();
  const userId = user!.id;
  const backend = useMemo(() => providedBackend === undefined ? developmentBackend() ?? supabaseBackend : providedBackend, [providedBackend]);
  const [data, setData] = useState<Data>(() => structuredClone(EMPTY));
  const [loading, setLoading] = useState(true);
  const [syncState, setSyncState] = useState<SyncState>('loading');
  const [warning, setWarning] = useState<string>();
  const revision = useRef<string | null>(null);
  const hydrated = useRef(false);
  const suppressNextSave = useRef(false);
  const generation = useRef(0);
  const latest = useRef(data);
  const dirty = useRef(false);
  const blocked = useRef(false);
  const running = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const readRemote = useCallback(async (offerMigration: boolean, preserveDirty = false) => {
    const token = ++generation.current;
    const pendingLocal = latest.current;
    const hadDirty = preserveDirty && dirty.current;
    setLoading(true); setSyncState('loading'); setWarning(undefined); hydrated.current = false;
    if (running.current) await running.current;
    if (token !== generation.current) return;
    const cache = loadForUser(userId);
    const hydrateCache = (message: string) => {
      suppressNextSave.current = true; setData(cache.data); setWarning(message); setSyncState('error'); setLoading(false); hydrated.current = true;
    };
    if (!backend) { hydrateCache('La sincronización remota no está configurada.'); return; }
    let result;
    try { result = await backend.read(userId); }
    catch (issue) { if (token === generation.current) hydrateCache(`No pudimos cargar la nube: ${messageOf(issue)}. Usamos la caché de esta cuenta.`); return; }
    if (token !== generation.current) return;
    if (result.error) { hydrateCache(`No pudimos cargar la nube: ${result.error.message}. Usamos la caché de esta cuenta.`); return; }
    if (result.data) {
      if (result.data.user_id !== userId || !isData(result.data.data)) { hydrateCache('Los datos remotos no pertenecen a esta cuenta o no tienen un formato compatible.'); return; }
      revision.current = result.data.updated_at;
      if (hadDirty) {
        setWarning('La nube contiene otra versión. Exportá tu copia local o cargá la versión remota.');
        setSyncState('conflict'); setLoading(false); hydrated.current = true; blocked.current = true; return;
      }
      dirty.current = false; blocked.current = false; suppressNextSave.current = true; setData(result.data.data);
      const cacheIssue = saveForUser(userId, result.data.data); setWarning(cacheIssue); setSyncState('synced'); setLoading(false); hydrated.current = true; return;
    }
    const legacy = load();
    const hasLegacy = JSON.stringify(legacy.data) !== JSON.stringify(EMPTY);
    const migrate = offerMigration && hasLegacy && !migrationDecided() && confirm('Encontramos datos guardados en este dispositivo. ¿Querés subirlos a esta cuenta?');
    const initial = hadDirty ? pendingLocal : migrate ? legacy.data : structuredClone(EMPTY);
    let created;
    try { created = await backend.insert(userId, initial); }
    catch (issue) { if (token === generation.current) hydrateCache(`No pudimos crear los datos de la cuenta: ${messageOf(issue)}.`); return; }
    if (token !== generation.current) return;
    if (created.error?.code === '23505') {
      try {
        const raced = await backend.read(userId);
        if (token !== generation.current) return;
        if (raced.data?.user_id === userId && isData(raced.data.data)) {
          revision.current = raced.data.updated_at;
          if (hadDirty) { setWarning('Otra sesión creó datos para esta cuenta. Exportá tu copia o cargá la versión remota.'); setSyncState('conflict'); setLoading(false); hydrated.current = true; blocked.current = true; return; }
          dirty.current = false; blocked.current = false; suppressNextSave.current = true; setData(raced.data.data); saveForUser(userId, raced.data.data); setSyncState('synced'); setLoading(false); hydrated.current = true; return;
        }
      } catch (issue) { hydrateCache(`No pudimos recuperar la cuenta: ${messageOf(issue)}.`); return; }
    }
    if (created.error || !created.data || created.data.user_id !== userId || !isData(created.data.data)) { hydrateCache(`No pudimos crear los datos de la cuenta: ${created.error?.message ?? 'respuesta inválida'}.`); return; }
    revision.current = created.data.updated_at; markMigrationDecided(); dirty.current = false; blocked.current = false;
    suppressNextSave.current = true; setData(initial); const cacheIssue = saveForUser(userId, initial); setWarning(cacheIssue); setSyncState('synced'); setLoading(false); hydrated.current = true;
  }, [backend, userId]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (running.current) await running.current;
    if (!dirty.current) return !blocked.current;
    if (!hydrated.current || !backend || !revision.current || blocked.current) return false;
    const token = generation.current;
    dirty.current = false; setSyncState('saving');
    running.current = (async () => {
      do {
        const snapshot = latest.current; dirty.current = false;
        let result;
        try { result = await backend.update(userId, snapshot, revision.current!); }
        catch (issue) { if (token === generation.current) { dirty.current = true; setWarning(`No pudimos sincronizar: ${messageOf(issue)}`); setSyncState('error'); } return false; }
        if (token !== generation.current) return false;
        if (result.error) { dirty.current = true; setWarning(`No pudimos sincronizar: ${result.error.message}`); setSyncState('error'); return false; }
        if (!result.data) { blocked.current = true; setWarning('Hay cambios más nuevos en otro dispositivo. Podés cargar la versión remota o exportar tu copia antes.'); setSyncState('conflict'); return false; }
        if (result.data.user_id !== userId || !isData(result.data.data)) { dirty.current = true; setWarning('La respuesta remota no pertenece a esta cuenta o no es válida.'); setSyncState('error'); return false; }
        revision.current = result.data.updated_at;
      } while (dirty.current);
      blocked.current = false; setSyncState('synced'); return true;
    })().finally(() => { running.current = null; });
    return running.current;
  }, [backend, userId]);

  useEffect(() => { void readRemote(true); return () => { generation.current += 1; if (timer.current) clearTimeout(timer.current); hydrated.current = false; }; }, [readRemote]);
  useEffect(() => {
    latest.current = data;
    if (suppressNextSave.current) { suppressNextSave.current = false; return; }
    if (!hydrated.current) return;
    const issue = saveForUser(userId, data); if (issue) setWarning(issue);
    dirty.current = true; setSyncState('saving'); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => void flush(), 600);
  }, [data, flush, userId]);
  useEffect(() => {
    const beforeLogout = (event: Event) => { const done = (event as CustomEvent<(saved: boolean) => void>).detail; void flush().then(done, () => done(false)); };
    window.addEventListener('escritorio:flush', beforeLogout); return () => window.removeEventListener('escritorio:flush', beforeLogout);
  }, [flush]);
  const retry = () => { if (revision.current) { dirty.current = true; blocked.current = false; void flush(); } else void readRemote(false, true); };
  const loadRemote = () => { if (syncState !== 'conflict' || confirm('¿Descartar los cambios locales sin sincronizar y cargar la versión remota?')) { dirty.current = false; blocked.current = false; void readRemote(false); } };
  return <Context.Provider value={{ data, setData, loading, syncState, warning, retry, loadRemote }}>{children}</Context.Provider>;
}
export const useData = () => { const c = useContext(Context); if (!c) throw Error('DataProvider faltante'); return c; };
