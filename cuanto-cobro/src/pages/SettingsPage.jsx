import { useState } from 'react';
import { api } from '../lib/api';
import { useStore } from '../store';
import { ovenHourCost } from '../lib/costs';
import { dateText, money } from '../lib/format';
import { Header } from '../components/ui';

export default function SettingsPage() {
  const { settings, setSettings, user } = useStore();
  const [f, setF] = useState({
    business_name: settings.business_name || '',
    labor_hour_rate: settings.labor_hour_rate ? String(settings.labor_hour_rate) : '',
    energy_monthly: settings.energy_monthly ? String(settings.energy_monthly) : '',
    oven_hours_month: settings.oven_hours_month ? String(settings.oven_hours_month) : '',
    target_margin: String(settings.target_margin ?? 60),
  });
  const [notice, setNotice] = useState('');
  const set = (key, value) => setF((prev) => ({ ...prev, [key]: value }));
  const parse = (v) => Number(String(v || '').replace(',', '.')) || 0;
  const hourCost = ovenHourCost({ energy_monthly: parse(f.energy_monthly), oven_hours_month: parse(f.oven_hours_month) });

  async function save(e) {
    e.preventDefault();
    try {
      const res = await api.put('/api/settings', f);
      setSettings(res.settings);
      setNotice('Guardado. Todas tus recetas ya usan estos números.');
    } catch (err) {
      setNotice(err.message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Header title="Ajustes" subtitle={user.expires_at ? `Tu acceso vale hasta el ${dateText(user.expires_at)}.` : undefined} />

      <form onSubmit={save} className="card flex flex-col gap-4 p-4">
        <label className="field">
          Nombre de tu emprendimiento
          <input className="input" value={f.business_name} onChange={(e) => set('business_name', e.target.value)} placeholder="Sale en el pedido a proveedores y en las fichas" />
        </label>

        <div className="section-title mt-2">Costos de producción</div>
        <label className="field">
          ¿Cuánto vale una hora de tu trabajo?
          <input className="input" inputMode="decimal" value={f.labor_hour_rate} onChange={(e) => set('labor_hour_rate', e.target.value)} placeholder="Ej: 4000" />
          <span className="label-hint">Lo que te pagarías a vos (o a una ayudante) por hora. Si no lo contás, trabajás gratis.</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field">
            Luz y gas por mes
            <input className="input" inputMode="decimal" value={f.energy_monthly} onChange={(e) => set('energy_monthly', e.target.value)} placeholder="Ej: 45000" />
            <span className="label-hint">Lo que pagás de las facturas (o la parte que corresponde a la cocina).</span>
          </label>
          <label className="field">
            Horas de horno por mes
            <input className="input" inputMode="decimal" value={f.oven_hours_month} onChange={(e) => set('oven_hours_month', e.target.value)} placeholder="Ej: 60" />
            <span className="label-hint">Más o menos: horas por día × días que horneás.</span>
          </label>
        </div>
        {hourCost > 0 && <p className="text-sm text-cocoa-soft">Cada hora de horno te cuesta {money(hourCost)}.</p>}

        <label className="field">
          Margen que querés ganar: {f.target_margin}%
          <input type="range" min="10" max="85" step="5" value={f.target_margin} onChange={(e) => set('target_margin', e.target.value)} className="accent-gold" />
          <span className="label-hint">Con esto se calcula el precio sugerido de cada receta. En pastelería se suele buscar entre 50% y 70%.</span>
        </label>

        {notice && <div className="notice">{notice}</div>}
        <button className="btn btn-primary">Guardar</button>
      </form>

      <PasswordForm />
    </div>
  );
}

function PasswordForm() {
  const [f, setF] = useState({ current: '', next: '', again: '' });
  const [msg, setMsg] = useState(null);

  async function save(e) {
    e.preventDefault();
    if (f.next !== f.again) return setMsg({ ok: false, text: 'Las dos contraseñas nuevas no coinciden' });
    try {
      await api.post('/api/password', { current: f.current, next: f.next });
      setF({ current: '', next: '', again: '' });
      setMsg({ ok: true, text: 'Listo, tu contraseña cambió.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  }

  return (
    <form onSubmit={save} className="card flex flex-col gap-3 p-4">
      <div className="section-title">Cambiar contraseña</div>
      <input className="input" type="password" placeholder="Contraseña actual" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
      <input className="input" type="password" placeholder="Nueva contraseña" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
      <input className="input" type="password" placeholder="Repetí la nueva" autoComplete="new-password" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} />
      {msg && <div className={msg.ok ? 'notice' : 'error'}>{msg.text}</div>}
      <button className="btn">Cambiar contraseña</button>
    </form>
  );
}
