import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { configurationError, supabase } from '../lib/supabase';

type AuthContextValue = {
  session: Session | null; user: User | null; loading: boolean; error?: string; notice?: string;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
};
const Context = createContext<AuthContextValue | null>(null);
const messageOf = (issue: unknown) => issue instanceof Error ? issue.message : 'No pudimos completar la operación.';

const e2eEnabled = import.meta.env.DEV && import.meta.env.VITE_E2E_AUTH === 'true';
const e2eUser = { id: '00000000-0000-4000-8000-000000000001', email: 'e2e@example.test' } as User;
const e2eSession = { user: e2eUser, access_token: 'e2e', refresh_token: 'e2e' } as Session;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(e2eEnabled ? e2eSession : null);
  const [loading, setLoading] = useState(!e2eEnabled && !configurationError);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  useEffect(() => {
    if (e2eEnabled || !supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data, error: issue }) => {
      if (!active) return;
      setSession(data.session);
      setError(issue?.message);
      setLoading(false);
    }).catch(issue => { if (active) { setError(messageOf(issue)); setLoading(false); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) { setSession(next); setLoading(false); }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  const signIn = async (email: string, password: string) => {
    setError(undefined); setNotice(undefined);
    if (!supabase) { setError(configurationError); return; }
    try { const { error: issue } = await supabase.auth.signInWithPassword({ email, password }); if (issue) setError(issue.message); }
    catch (issue) { setError(messageOf(issue)); }
  };
  const signUp = async (email: string, password: string) => {
    setError(undefined); setNotice(undefined);
    if (!supabase) { setError(configurationError); return; }
    try {
      const { data, error: issue } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}${import.meta.env.BASE_URL}` } });
      if (issue) setError(issue.message);
      else if (!data.session) setNotice('Revisá tu correo para confirmar la cuenta antes de iniciar sesión.');
    } catch (issue) { setError(messageOf(issue)); }
  };
  const signOut = async () => {
    setError(undefined); setNotice(undefined);
    const saved = await new Promise<boolean>(resolve => {
      const timeout = setTimeout(() => resolve(false), 1500);
      window.dispatchEvent(new CustomEvent('escritorio:flush', { detail: (complete: boolean) => { clearTimeout(timeout); resolve(complete); } }));
    });
    if (!saved && !confirm('No pudimos confirmar que los últimos cambios estén sincronizados. ¿Salir de todos modos?')) return;
    if (e2eEnabled) { setSession(null); return; }
    if (!supabase) return;
    try { const { error: issue } = await supabase.auth.signOut(); if (issue) setError(issue.message); else setSession(null); }
    catch (issue) { setError(messageOf(issue)); }
  };
  return <Context.Provider value={{ session, user: session?.user ?? null, loading, error: error ?? configurationError, notice, signIn, signUp, signOut }}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw Error('AuthProvider faltante'); return value; }
