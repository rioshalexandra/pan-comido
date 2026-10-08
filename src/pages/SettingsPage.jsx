import { useState } from 'react';
import { api } from '../api';
import { useStore } from '../store';

// Configuración del negocio: nombre, moneda e impuesto.
export default function SettingsPage() {
  const { settings, reload } = useStore();
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const current = form || settings;
  if (!current) return <div className="page">Cargando…</div>;

  return (
    <div className="page">
      <h1 className="mb-4 text-2xl">Configuración</h1>
      <form
        className="max-w-xl space-y-5"
        onSubmit={async (ev) => {
          ev.preventDefault();
          setError('');
          try {
            await api.saveSettings({
              name: current.name,
              timezone: current.timezone,
              currency: current.currency,
              taxRate: Number(current.tax_rate || 0),
            });
            await reload();
            setForm(null);
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <label className="field">
          <span>Nombre del negocio</span>
          <input value={current.name} onChange={(e) => setForm({ ...current, name: e.target.value })} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            <span>Moneda</span>
            <input value={current.currency} onChange={(e) => setForm({ ...current, currency: e.target.value })} />
          </label>
          <label className="field">
            <span>IVA / impuesto (%)</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={current.tax_rate}
              onChange={(e) => setForm({ ...current, tax_rate: e.target.value })}
            />
          </label>
        </div>
        <label className="field">
          <span>Zona horaria</span>
          <input value={current.timezone} onChange={(e) => setForm({ ...current, timezone: e.target.value })} />
        </label>
        <button className="pill-btn primary" type="submit">
          {saved ? 'Guardado' : 'Guardar'}
        </button>
      </form>
    </div>
  );
}
