import { useState } from 'react';

export default function ConfirmDangerModal({
  title,
  message,
  confirmLabel = 'Borrar',
  onClose,
  onConfirm,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(ev) => ev.stopPropagation()}>
        <div className="border-b border-[#eadfe2] px-5 py-4">
          <div className="text-lg text-[#c5221f]">{title}</div>
        </div>
        <div className="grid gap-3 px-5 py-4">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="rounded-lg border border-[#f6aea9] bg-[#fce8e6] px-3 py-3 text-sm text-[#5f2120]">
            {message}
          </div>
          <p className="text-sm text-[#6b6266]">Esta acción no se puede deshacer.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#eadfe2] px-5 py-3">
          <button type="button" className="pill-btn" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="pill-btn danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await onConfirm();
              } catch (err) {
                setError(err.message);
                setBusy(false);
              }
            }}
          >
            {busy ? 'Borrando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
