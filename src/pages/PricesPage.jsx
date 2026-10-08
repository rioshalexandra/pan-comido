import { useEffect, useState } from 'react';
import { api } from '../api';
import { money } from '../format';
import { useStore } from '../store';

export default function PricesPage() {
  const { currency } = useStore();
  const [categories, setCategories] = useState([]);
  const [history, setHistory] = useState([]);
  const [mode, setMode] = useState('percent');
  const [value, setValue] = useState('10');
  const [categoryId, setCategoryId] = useState('');
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const [cats, adj] = await Promise.all([api.categories(), api.priceAdjustments()]);
    setCategories(cats.data);
    setHistory(adj.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function runPreview() {
    setError('');
    setBusy(true);
    try {
      const res = await api.previewPrices({
        mode,
        value: Number(value),
        categoryId: categoryId || null,
      });
      setPreview(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <h1 className="mb-4 text-2xl">Ajuste masivo de precios</h1>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="mb-6 grid max-w-3xl gap-3 sm:grid-cols-2">
        <label className="field">
          <span>Modo</span>
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="percent">Porcentaje</option>
            <option value="amount">Importe fijo</option>
          </select>
        </label>
        <label className="field">
          <span>{mode === 'percent' ? 'Porcentaje (10 = +10%, -5 = baja 5%)' : 'Importe (+ o −)'}</span>
          <input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <label className="field">
          <span>Categoría</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Todos los productos activos</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Notas</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. lista abril" />
        </label>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button className="pill-btn" disabled={busy} onClick={runPreview}>
          Previsualizar
        </button>
        <button
          className="pill-btn primary"
          disabled={busy || !preview.length}
          onClick={async () => {
            if (!confirm(`¿Aplicar el nuevo precio a ${preview.length} productos?`)) return;
            setBusy(true);
            setError('');
            try {
              await api.applyPrices({
                mode,
                value: Number(value),
                categoryId: categoryId || null,
                notes,
              });
              setPreview([]);
              await load();
            } catch (err) {
              setError(err.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Aplicar a {preview.length || 0} productos
        </button>
      </div>
      {!!preview.length && (
        <div className="mb-8 overflow-x-auto rounded-xl border border-[#eadfe2]">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Producto</th>
                <th>Precio actual</th>
                <th>Nuevo precio</th>
                <th>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row) => (
                <tr key={row.id}>
                  <td>{row.sku}</td>
                  <td>{row.name}</td>
                  <td>{money(row.old_price, currency)}</td>
                  <td>{money(row.new_price, currency)}</td>
                  <td className={row.delta >= 0 ? 'text-[#137333]' : 'text-[#c5221f]'}>
                    {money(row.delta, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h2 className="mb-3 text-lg font-medium">Historial</h2>
      <div className="overflow-x-auto rounded-xl border border-[#eadfe2]">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Ajuste</th>
              <th>Alcance</th>
              <th>Productos</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.id}>
                <td>{String(row.created_at).slice(0, 16).replace('T', ' ')}</td>
                <td>
                  {row.mode === 'percent'
                    ? `${Number(row.value) > 0 ? '+' : ''}${row.value}%`
                    : money(row.value, currency)}
                </td>
                <td>{row.category_name || 'Todos'}</td>
                <td>{row.product_count}</td>
                <td>{row.notes || '—'}</td>
              </tr>
            ))}
            {!history.length && (
              <tr>
                <td className="py-8 text-center text-[#6b6266]" colSpan={5}>
                  Todavía no hay ajustes masivos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
