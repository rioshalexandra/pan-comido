import { useState } from 'react';
import { api } from '../api';
import { useStore } from '../store';
import { money } from '../format';
import { ovenHourCost } from '../lib/costs';

// Configuración del negocio: nombre, moneda, impuesto y los datos para el costo completo de las recetas.
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
              laborHourRate: Number(current.labor_hour_rate || 0),
              energyMonthly: Number(current.energy_monthly || 0),
              ovenHoursMonth: Number(current.oven_hours_month || 0),
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
        <fieldset className="space-y-3 rounded-2xl border border-[var(--line)] p-4">
          <legend className="px-1 font-semibold">Costos de producción</legend>
          <p className="m-0 text-sm text-[#5a5155]">
            Con estos datos cada receta muestra su costo completo y su margen real: ingredientes, tu trabajo, y la luz y el gas.
          </p>
          <label className="field">
            <span>Valor de tu hora de trabajo</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              placeholder="Ej: 5000"
              value={current.labor_hour_rate ?? ''}
              onChange={(e) => setForm({ ...current, labor_hour_rate: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              <span>Luz y gas por mes</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                placeholder="Ej: 60000"
                value={current.energy_monthly ?? ''}
                onChange={(e) => setForm({ ...current, energy_monthly: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Horas de horno por mes</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                placeholder="Ej: 80"
                value={current.oven_hours_month ?? ''}
                onChange={(e) => setForm({ ...current, oven_hours_month: e.target.value })}
              />
            </label>
          </div>
          <p className="m-0 text-xs text-[#6b6266]">
            Usá lo que pagás de luz y gas en un mes normal (podés promediar las últimas facturas). Las horas de horno son una
            estimación: por ejemplo, 4 horas por día × 20 días = 80.
            {ovenHourCost(current) > 0 && (
              <>
                {' '}
                Te sale <strong>{money(ovenHourCost(current), current.currency)}</strong> cada hora de horno.
              </>
            )}
          </p>
        </fieldset>
        <button className="pill-btn primary" type="submit">
          {saved ? 'Guardado' : 'Guardar'}
        </button>
      </form>
    </div>
  );
}
