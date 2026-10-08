import { useRef, useState } from 'react';
import { api, attachmentFileUrl } from '../api';

export default function AttachmentsPanel({
  title,
  entityType,
  entityId,
  items = [],
  accept,
  helper,
  onChanged,
}) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function uploadFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length || !entityId) return;
    setBusy(true);
    setError('');
    try {
      for (const file of files) {
        await api.uploadAttachment(entityType, entityId, file);
      }
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function remove(id) {
    if (!confirm('¿Borrar este archivo?')) return;
    setBusy(true);
    setError('');
    try {
      await api.deleteAttachment(id);
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-lg font-medium">{title}</h2>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple
          disabled={!entityId || busy}
          onChange={(ev) => uploadFiles(ev.target.files)}
        />
        <button
          className="pill-btn"
          type="button"
          disabled={!entityId || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Subiendo…' : 'Subir'}
        </button>
      </div>
      {helper && <p className="mb-3 text-sm text-[#6b6266]">{helper}</p>}
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((row) => (
          <article key={row.id} className="overflow-hidden rounded-xl border border-[#eadfe2]">
            {row.kind === 'photo' ? (
              <a href={attachmentFileUrl(row.id)} target="_blank" rel="noreferrer">
                <img
                  src={attachmentFileUrl(row.id)}
                  alt={row.original_name}
                  className="h-40 w-full bg-[#fbf3f5] object-cover"
                />
              </a>
            ) : (
              <a
                href={attachmentFileUrl(row.id)}
                target="_blank"
                rel="noreferrer"
                className="flex h-40 items-center justify-center bg-[#fbf3f5] px-4 text-center text-sm font-medium text-[#7a5c1e]"
              >
                {row.original_name}
              </a>
            )}
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1 truncate text-sm" title={row.original_name}>
                {row.original_name}
              </div>
              <button className="pill-btn danger" type="button" disabled={busy} onClick={() => remove(row.id)}>
                Borrar
              </button>
            </div>
          </article>
        ))}
        {!items.length && (
          <div className="rounded-xl border border-dashed border-[#eadfe2] px-4 py-8 text-center text-sm text-[#6b6266] sm:col-span-2 lg:col-span-3">
            Todavía no hay archivos.
          </div>
        )}
      </div>
    </section>
  );
}
