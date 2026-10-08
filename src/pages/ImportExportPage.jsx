import { useState } from 'react';
import { api } from '../api';

const BLOCKS = [
  {
    entity: 'products',
    title: 'Productos',
    hint: 'Columnas: sku, nombre, categoria, unidad, codigo_barras, costo, precio, stock, stock_minimo, activo, descripcion. Si el SKU ya existe, se actualiza.',
  },
  {
    entity: 'customers',
    title: 'Clientes',
    hint: 'Columnas: nombre, cuit, telefono, email, direccion, notas. Matchea por CUIT o nombre.',
  },
  {
    entity: 'suppliers',
    title: 'Proveedores',
    hint: 'Columnas: nombre, cuit, telefono, email, direccion, notas.',
  },
];

export default function ImportExportPage() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  async function onUpload(entity, file) {
    if (!file) return;
    setBusy(entity);
    setError('');
    setMessage('');
    try {
      const res = await api.importFile(entity, file);
      const extra = res.data.errors?.length ? ` · ${res.data.errors.length} filas con error` : '';
      setMessage(
        `${entity}: ${res.data.created} alta(s), ${res.data.updated} actualización(es)${extra}`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <h1 className="mb-2 text-2xl">Carga y descarga CSV / Excel</h1>
      <p className="mb-6 max-w-2xl text-sm text-[#6b6266]">
        Descargá una plantilla, completala y volvé a subirla. También podés exportar el listado actual.
        Acepta `.csv`, `.xlsx` y `.xls`.
      </p>
      {message && <div className="mb-3 rounded-lg bg-[#e6f4ea] px-3 py-2 text-sm text-[#137333]">{message}</div>}
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="grid gap-4">
        {BLOCKS.map((block) => (
          <section key={block.entity} className="rounded-xl border border-[#eadfe2] p-4">
            <h2 className="mb-1 text-lg font-medium">{block.title}</h2>
            <p className="mb-4 text-sm text-[#6b6266]">{block.hint}</p>
            <div className="flex flex-wrap gap-2">
              <button className="pill-btn" onClick={() => api.exportFile(block.entity, 'xlsx')}>
                Descargar Excel
              </button>
              <button className="pill-btn" onClick={() => api.exportFile(block.entity, 'csv')}>
                Descargar CSV
              </button>
              <label className="pill-btn primary grid cursor-pointer place-items-center">
                {busy === block.entity ? 'Importando…' : 'Subir archivo'}
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  disabled={Boolean(busy)}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    onUpload(block.entity, file);
                  }}
                />
              </label>
            </div>
          </section>
        ))}
        <section className="rounded-xl border border-[#eadfe2] p-4">
          <h2 className="mb-1 text-lg font-medium">Historial de pagos</h2>
          <p className="mb-4 text-sm text-[#6b6266]">Solo descarga. Los pagos se cargan desde cada venta o compra.</p>
          <div className="flex flex-wrap gap-2">
            <button className="pill-btn" onClick={() => api.exportFile('payments', 'xlsx')}>
              Descargar Excel
            </button>
            <button className="pill-btn" onClick={() => api.exportFile('payments', 'csv')}>
              Descargar CSV
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
