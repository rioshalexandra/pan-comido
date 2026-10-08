import { useState } from 'react';

// Formulario de cliente o proveedor.
export default function PartyForm({ title, form, kind = 'customers', onClose, onSave }) {
  const [state, setState] = useState(form);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isCustomer = kind === 'customers';

  function set(key, value) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal-card"
        onClick={(ev) => ev.stopPropagation()}
        onSubmit={async (ev) => {
          ev.preventDefault();
          setBusy(true);
          setError('');
          try {
            await onSave(state);
          } catch (err) {
            setError(err.message);
            setBusy(false);
          }
        }}
      >
        <div className="modal-head">{title}</div>
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</div>}
          <label className="field sm:col-span-2">
            <span>Nombre</span>
            <input value={state.name} onChange={(e) => set('name', e.target.value)} required />
          </label>
          <label className="field">
            <span>Teléfono / WhatsApp</span>
            <input type="tel" inputMode="tel" value={state.phone} onChange={(e) => set('phone', e.target.value)} />
          </label>
          {isCustomer ? (
            <label className="field">
              <span>Cumpleaños (opcional)</span>
              <input type="date" value={state.birthday} onChange={(e) => set('birthday', e.target.value)} />
            </label>
          ) : (
            <label className="field">
              <span>CUIT / DNI</span>
              <input value={state.taxId} onChange={(e) => set('taxId', e.target.value)} />
            </label>
          )}
          <label className="field sm:col-span-2">
            <span>{isCustomer ? 'Dirección (para envíos)' : 'Dirección'}</span>
            <input value={state.address} onChange={(e) => set('address', e.target.value)} />
          </label>
          <label className="field">
            <span>Email</span>
            <input type="email" value={state.email} onChange={(e) => set('email', e.target.value)} />
          </label>
          {isCustomer && (
            <label className="field">
              <span>DNI / CUIT (para facturar)</span>
              <input value={state.taxId} onChange={(e) => set('taxId', e.target.value)} />
            </label>
          )}
          <label className="field sm:col-span-2">
            <span>{isCustomer ? 'Notas (gustos, preferencias…)' : 'Notas'}</span>
            <textarea rows={2} value={state.notes} onChange={(e) => set('notes', e.target.value)} />
          </label>
        </div>
        <div className="modal-foot">
          <button type="button" className="pill-btn" onClick={onClose}>
            Cerrar
          </button>
          <button type="submit" className="pill-btn primary" disabled={busy}>
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}

export function emptyParty() {
  return { id: null, name: '', taxId: '', phone: '', email: '', address: '', notes: '', birthday: '' };
}

export function toPartyForm(row) {
  return {
    id: row.id,
    name: row.name || '',
    taxId: row.tax_id || '',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    notes: row.notes || '',
    birthday: row.birthday ? String(row.birthday).slice(0, 10) : '',
  };
}
