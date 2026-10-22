import { useState } from 'react';
import { api } from '../lib/api';

// El link .../demo trae la cuenta de demostración ya escrita
const DEMO = window.location.pathname.replace(/\/$/, '') === '/demo';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState(DEMO ? 'demo' : '');
  const [password, setPassword] = useState(DEMO ? 'probala' : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/api/login', { username, password });
      await onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6">
        <div className="mb-6 text-center">
          <img src="/icon.svg" alt="" className="mx-auto mb-3 h-16 w-16" />
          <h1 className="font-display text-3xl font-bold">Cuánto Cobro</h1>
          <p className="mt-1 text-sm text-cocoa-soft">Sabé cuánto te cuesta cada receta y a cuánto venderla.</p>
        </div>
        {DEMO && (
          <div className="notice mb-4 text-center">
            👋 Esta es la <strong>demo</strong>: una pastelería de ejemplo para que toques todo. Lo que cambies queda solo en tu celular.
          </div>
        )}
        <div className="flex flex-col gap-4">
          <label className="field">
            Usuario
            <input className="input" autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="field">
            Contraseña
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? 'Entrando…' : DEMO ? 'Entrar a la demo' : 'Entrar'}
          </button>
        </div>
      </form>
    </div>
  );
}
