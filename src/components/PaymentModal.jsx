import { useState } from 'react';
import { METHODS, today } from '../format';

export default function PaymentModal({ title, remaining, onClose, onSave }) {
  const [state, setState] = useState({
    amount: remaining > 0 ? remaining : '',
    method: 'cash',
    paidAt: today(),
    notes: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
            await onSave({
              amount: Number(state.amount),
              method: state.method,
              paidAt: state.paidAt,
              notes: state.notes,
            });
          } catch (err) {
            setError(err.message);
            setBusy(false);
          }
        }}
      >
        <div className="border-b border-[#eadfe2] px-5 py-4 text-lg">{title}</div>
        <div className="grid gap-3 px-5 py-4">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <label className="field">
            <span>Importe</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={state.amount}
              onChange={(e) => setState({ ...state, amount: e.target.value })}
              required
            />
          </label>
          <label className="field">
            <span>Medio</span>
            <select value={state.method} onChange={(e) => setState({ ...state, method: e.target.value })}>
              {Object.entries(METHODS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Fecha</span>
            <input type="date" value={state.paidAt} onChange={(e) => setState({ ...state, paidAt: e.target.value })} />
          </label>
          <label className="field">
            <span>Notas</span>
            <input value={state.notes} onChange={(e) => setState({ ...state, notes: e.target.value })} />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#eadfe2] px-5 py-3">
          <button type="button" className="pill-btn" onClick={onClose}>
            Cerrar
          </button>
          <button type="submit" className="pill-btn primary" disabled={busy}>
            Registrar
          </button>
        </div>
      </form>
    </div>
  );
}
