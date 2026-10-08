import { useState } from 'react';
import { Cookie } from 'lucide-react';
import { useAuth } from '../auth';
import PoweredBy from '../components/PoweredBy';
import { Navigate } from 'react-router-dom';

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && isAuthenticated) return <Navigate to="/" replace />;

  async function submit(ev) {
    ev.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-[#fbf3f5]">
      <div className="grid flex-1 place-items-center p-4">
        <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#eadfe2] sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="brand-mark grid h-11 w-11 shrink-0 place-items-center rounded-full text-white">
              <Cookie size={20} />
            </div>
            <div>
              <h1 className="m-0 text-2xl">Pan Comido</h1>
              <div className="text-sm text-[#6b6266]">Pastelería: ventas, encargos y producción</div>
            </div>
          </div>
          {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <label className="field mb-3">
            <span>Usuario</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </label>
          <label className="field mb-5">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button
            type="submit"
            className="h-11 w-full rounded-full bg-[#7a5c1e] font-medium text-white disabled:opacity-60"
            disabled={busy}
          >
            Ingresar
          </button>
        </form>
      </div>
      <PoweredBy />
    </div>
  );
}
