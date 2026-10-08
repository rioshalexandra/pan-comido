import { useState } from 'react';
import { qty } from '../format';

export default function StockAdjustModal({ product, onClose, onSave }) {
  const [direction, setDirection] = useState('up');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const current = Number(product.stock_qty || 0);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal-card"
        onClick={(ev) => ev.stopPropagation()}
        onSubmit={async (ev) => {
          ev.preventDefault();
          const value = Number(amount);
          if (!Number.isFinite(value) || value <= 0) {
            setError('Indicá una cantidad mayor a cero');
            return;
          }
          setBusy(true);
          setError('');
          try {
            await onSave({
              direction,
              qty: value,
              notes: notes.trim(),
            });
          } catch (err) {
            setError(err.message);
            setBusy(false);
          }
        }}
      >
        <div className="border-b border-[#eadfe2] px-5 py-4">
          <div className="text-lg">Ajustar stock</div>
          <div className="mt-1 text-sm text-[#6b6266]">
            {product.name} · actual {qty(current)} {product.unit || 'un'}
          </div>
        </div>
        <div className="grid gap-3 px-5 py-4">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="field">
            <span>Movimiento</span>
            <div className="flex flex-wrap gap-2">
              <label
                className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-medium ${
                  direction === 'up' ? 'border-[#7a5c1e] bg-[#f7efe0] text-[#7a5c1e]' : 'border-[#eadfe2]'
                }`}
              >
                <input
                  type="radio"
                  className="hidden"
                  name="direction"
                  checked={direction === 'up'}
                  onChange={() => setDirection('up')}
                />
                Subir stock
              </label>
              <label
                className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-medium ${
                  direction === 'down' ? 'border-[#c5221f] bg-[#fce8e6] text-[#c5221f]' : 'border-[#eadfe2]'
                }`}
              >
                <input
                  type="radio"
                  className="hidden"
                  name="direction"
                  checked={direction === 'down'}
                  onChange={() => setDirection('down')}
                />
                Bajar stock
              </label>
            </div>
          </div>
          <label className="field">
            <span>Cantidad</span>
            <input
              type="number"
              min="0.001"
              step="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Motivo (opcional)</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. inventario, merma, rotura…"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#eadfe2] px-5 py-3">
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
