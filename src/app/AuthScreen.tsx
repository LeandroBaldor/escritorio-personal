import { type FormEvent, useState } from 'react';
import { useAuth } from './AuthContext';

export function AuthScreen() {
  const { signIn, signUp, error, notice } = useAuth();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login'); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { await (mode === 'login' ? signIn(email, password) : signUp(email, password)); } finally { setBusy(false); } };
  return <main className="auth-screen"><form className="auth-card" onSubmit={submit}>
    <h1>Escritorio Personal</h1><p>{mode === 'login' ? 'Ingresá para abrir tu escritorio.' : 'Creá una cuenta para sincronizar tus datos.'}</p>
    <label>Correo<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
    <label>Contraseña<input required minLength={6} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} /></label>
    {error && <p role="alert" className="auth-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    <button disabled={busy}>{busy ? 'Esperá…' : mode === 'login' ? 'Ingresar' : 'Registrarme'}</button>
    <button type="button" className="secondary" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Crear una cuenta' : 'Ya tengo cuenta'}</button>
  </form></main>;
}
