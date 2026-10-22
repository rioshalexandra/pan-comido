import { useState } from 'react';
import { api } from '../lib/api';
import { useData } from '../lib/useData';
import { useStore } from '../store';
import { dateText, todayIso, whatsappLink } from '../lib/format';
import { Header, Loading, Modal } from '../components/ui';

const DURATIONS = [
  { value: '', label: 'Para siempre' },
  { value: '1', label: '1 mes' },
  { value: '3', label: '3 meses' },
  { value: '6', label: '6 meses' },
  { value: '12', label: '1 año' },
];

function addMonths(months, from = todayIso()) {
  const d = new Date(`${from}T12:00:00`);
  d.setMonth(d.getMonth() + Number(months));
  return d.toISOString().slice(0, 10);
}

const slug = (name) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '')
    .slice(0, 30);

function status(c) {
  if (!c.active) return { label: 'Pausada', cls: 'bg-line text-cocoa-soft' };
  if (c.expires_at && c.expires_at < todayIso()) return { label: 'Vencida', cls: 'bg-bad/10 text-bad' };
  return { label: 'Activa', cls: 'bg-good/10 text-good' };
}

// Panel de la dueña: da acceso a quien compra la app
export default function AdminPage() {
  const { appName } = useStore();
  const { data, reload, error } = useData('/api/admin/clients');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [access, setAccess] = useState(null);

  async function reset(c) {
    if (!confirm(`¿Darle una contraseña nueva a ${c.name}? La anterior deja de funcionar.`)) return;
    const res = await api.post(`/api/admin/clients/${c.id}/reset`);
    setAccess({ client: c, password: res.password, isNew: false });
  }

  async function update(c, patch) {
    await api.put(`/api/admin/clients/${c.id}`, { ...c, ...patch });
    reload();
  }

  async function remove(c) {
    if (!confirm(`¿Borrar la cuenta de ${c.name} con todas sus recetas? No se puede deshacer.`)) return;
    if (!confirm('Confirmá de nuevo: se borra todo lo que cargó.')) return;
    await api.del(`/api/admin/clients/${c.id}`);
    reload();
  }

  if (!data) return <Loading error={error} />;
  const active = data.filter((c) => status(c).label === 'Activa').length;

  return (
    <div className="flex flex-col gap-4">
      <Header title="Cuentas de clientas" subtitle={`${active} activa${active === 1 ? '' : 's'} de ${data.length}. Cada una ve solo sus recetas.`}>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Dar acceso
        </button>
      </Header>

      {!data.length ? (
        <div className="card p-6 text-center text-cocoa-soft">
          Cuando alguien te compre {appName}, tocá <strong>"Dar acceso"</strong>. La app le crea un usuario y una contraseña y te arma el mensaje de WhatsApp.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {data.map((c) => {
            const st = status(c);
            return (
              <div key={c.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold">
                      {c.name} <span className={`chip ml-1 ${st.cls}`}>{st.label}</span>
                    </div>
                    <div className="text-sm text-cocoa-soft">
                      Usuario <strong className="text-cocoa">{c.username}</strong>
                      {c.phone ? ` · ${c.phone}` : ''}
                    </div>
                    <div className="text-xs text-cocoa-soft">
                      Alta {dateText(c.created_at)} · {c.expires_at ? `vence ${dateText(c.expires_at)}` : 'sin vencimiento'} ·{' '}
                      {c.last_login_at ? `entró por última vez ${dateText(c.last_login_at)}` : 'todavía no entró'}
                    </div>
                    {c.notes && <div className="mt-1 text-xs text-cocoa-soft">📝 {c.notes}</div>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn btn-sm" onClick={() => reset(c)}>
                    🔑 Nueva contraseña
                  </button>
                  {c.expires_at && (
                    <button className="btn btn-sm" onClick={() => update(c, { expires_at: addMonths(12, c.expires_at > todayIso() ? c.expires_at : todayIso()) })}>
                      Renovar 1 año
                    </button>
                  )}
                  <button className="btn btn-sm" onClick={() => update(c, { active: !c.active })}>
                    {c.active ? 'Pausar' : 'Activar'}
                  </button>
                  <button className="btn btn-sm" onClick={() => setEditing(c)}>
                    Editar
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => remove(c)}>
                    Borrar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onCreated={(client, password) => {
            setCreating(false);
            setAccess({ client, password, isNew: true });
            reload();
          }}
        />
      )}
      {editing && (
        <EditModal
          client={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      {access && <AccessModal {...access} appName={appName} onClose={() => setAccess(null)} />}
    </div>
  );
}

function CreateModal({ onClose, onCreated }) {
  const [f, setF] = useState({ name: '', username: '', phone: '', business_name: '', months: '12', notes: '', with_examples: true });
  const [userTouched, setUserTouched] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/api/admin/clients', { ...f, expires_at: f.months ? addMonths(f.months) : null });
      onCreated(res.data, res.password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Dar acceso a una clienta" onClose={onClose}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <label className="field">
          Nombre y apellido
          <input
            className="input"
            value={f.name}
            autoFocus
            onChange={(e) => {
              set('name', e.target.value);
              if (!userTouched) set('username', slug(e.target.value));
            }}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field">
            Usuario para entrar
            <input
              className="input"
              autoCapitalize="none"
              value={f.username}
              onChange={(e) => {
                setUserTouched(true);
                set('username', e.target.value);
              }}
            />
          </label>
          <label className="field">
            WhatsApp
            <input className="input" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="Para mandarle el acceso" />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field">
            Su emprendimiento (opcional)
            <input className="input" value={f.business_name} onChange={(e) => set('business_name', e.target.value)} />
          </label>
          <label className="field">
            Acceso por
            <select className="input" value={f.months} onChange={(e) => set('months', e.target.value)}>
              {DURATIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          Notas (solo las ves vos)
          <input className="input" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Ej: pagó por transferencia el 22/10" />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="h-5 w-5 accent-gold" checked={f.with_examples} onChange={(e) => set('with_examples', e.target.checked)} />
          Cargarle 3 recetas de ejemplo para que vea cómo funciona
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Creando…' : 'Crear acceso'}
        </button>
      </form>
    </Modal>
  );
}

function EditModal({ client, onClose, onSaved }) {
  const [f, setF] = useState({ ...client, expires_at: client.expires_at || '' });
  const [error, setError] = useState('');
  async function save(e) {
    e.preventDefault();
    try {
      await api.put(`/api/admin/clients/${client.id}`, { ...f, expires_at: f.expires_at || null });
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <Modal title={`Editar a ${client.name}`} onClose={onClose}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <label className="field">
          Nombre
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label className="field">
          WhatsApp
          <input className="input" value={f.phone || ''} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </label>
        <label className="field">
          Vence el (vacío = para siempre)
          <input className="input" type="date" value={f.expires_at} onChange={(e) => setF({ ...f, expires_at: e.target.value })} />
        </label>
        <label className="field">
          Notas
          <input className="input" value={f.notes || ''} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary">Guardar</button>
      </form>
    </Modal>
  );
}

// Muestra el usuario y la contraseña una sola vez, con el mensaje listo para WhatsApp
function AccessModal({ client, password, isNew, appName, onClose }) {
  const [copied, setCopied] = useState(false);
  const link = window.location.origin;
  const message = `Hola ${client.name.split(' ')[0]}! ${isNew ? `Ya tenés tu acceso a ${appName} 🧁` : `Te paso tu nueva contraseña de ${appName}`}

Entrá desde: ${link}
Usuario: ${client.username}
Contraseña: ${password}

${isNew ? 'Te recomiendo cambiar la contraseña en Ajustes. Desde el celular podés tocar "Agregar a pantalla de inicio" para tenerla como una app.' : 'Podés cambiarla en Ajustes.'}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      /* el texto queda a la vista para copiarlo a mano */
    }
  }

  return (
    <Modal title={isNew ? '¡Acceso creado!' : 'Contraseña nueva'} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="rounded-xl bg-cream p-4 text-center">
          <div className="text-sm text-cocoa-soft">Usuario</div>
          <div className="text-xl font-bold">{client.username}</div>
          <div className="mt-2 text-sm text-cocoa-soft">Contraseña</div>
          <div className="font-mono text-2xl font-bold tracking-wide">{password}</div>
        </div>
        <p className="text-sm text-cocoa-soft">Anotala o mandala ahora: por seguridad, después no se puede volver a ver (sí podés crear otra).</p>
        <pre className="max-h-48 overflow-auto rounded-xl border border-line p-3 font-sans text-sm whitespace-pre-wrap">{message}</pre>
        <a className="btn btn-primary" href={whatsappLink(client.phone, message)} target="_blank" rel="noreferrer">
          💬 Mandar por WhatsApp
        </a>
        <button className="btn" onClick={copy}>
          {copied ? '¡Copiado!' : 'Copiar mensaje'}
        </button>
      </div>
    </Modal>
  );
}
