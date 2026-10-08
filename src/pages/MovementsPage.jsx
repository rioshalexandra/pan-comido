import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { MOVEMENT_KINDS, qty, ymdt } from '../format';

export default function MovementsPage() {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({ in: 0, out: 0 });
  const [q, setQ] = useState(params.get('q') || '');
  const [kind, setKind] = useState(params.get('kind') || '');
  const [from, setFrom] = useState(params.get('from') || '');
  const [to, setTo] = useState(params.get('to') || '');
  const [error, setError] = useState('');

  async function load() {
    const search = new URLSearchParams();
    if (q.trim()) search.set('q', q.trim());
    if (kind) search.set('kind', kind);
    if (from) search.set('from', from);
    if (to) search.set('to', to);
    if (params.get('productId')) search.set('productId', params.get('productId'));
    const res = await api.movements(`?${search.toString()}`);
    setRows(res.data);
    setTotals(res.totals);
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (q.trim()) next.set('q', q.trim());
          else next.delete('q');
          if (kind) next.set('kind', kind);
          else next.delete('kind');
          if (from) next.set('from', from);
          else next.delete('from');
          if (to) next.set('to', to);
          else next.delete('to');
          return next;
        },
        { replace: true }
      );
      load().catch((err) => setError(err.message));
    }, 200);
    return () => clearTimeout(handle);
  }, [q, kind, from, to, params.get('productId')]);

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <h1 className="mb-4 text-2xl">Movimientos de stock</h1>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className="h-9 min-w-[200px] flex-1 rounded-full border border-[#eadfe2] px-4 text-sm sm:max-w-xs"
          placeholder="Buscar producto, SKU o comprobante…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="h-9 rounded-full border border-[#eadfe2] px-3 text-sm"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="">Todos los tipos</option>
          {Object.entries(MOVEMENT_KINDS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          className="h-9 rounded-full border border-[#eadfe2] px-3 text-sm"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input
          className="h-9 rounded-full border border-[#eadfe2] px-3 text-sm"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="kpi-card">
          <div className="kpi-label">Entradas</div>
          <div className="kpi-value text-[#137333]">+{qty(totals.in)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Salidas</div>
          <div className="kpi-value text-[#c5221f]">{qty(totals.out)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Neto</div>
          <div className="kpi-value">{qty(totals.in + totals.out)}</div>
        </div>
      </div>
      {params.get('productId') && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-[#f7efe0] px-3 py-2 text-sm text-[#6b5120]">
          Mostrando un producto.
          <button
            className="underline"
            type="button"
            onClick={() => {
              setParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete('productId');
                return next;
              });
            }}
          >
            Ver todos
          </button>
        </div>
      )}
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="overflow-x-auto rounded-xl border border-[#eadfe2]">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Comprobante</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="whitespace-nowrap">{ymdt(row.created_at)}</td>
                <td>
                  <span className={`badge badge-${row.kind}`}>{MOVEMENT_KINDS[row.kind] || row.kind}</span>
                </td>
                <td>
                  <Link className="font-medium text-[#7a5c1e]" to={`/productos/${row.product_id}`}>
                    {row.product_name}
                  </Link>
                  <div className="text-xs text-[#6b6266]">{row.sku}</div>
                </td>
                <td className={Number(row.qty) < 0 ? 'font-medium text-[#c5221f]' : 'font-medium text-[#137333]'}>
                  {Number(row.qty) > 0 ? '+' : ''}
                  {qty(row.qty)} {row.unit}
                </td>
                <td>
                  {row.sale_id ? (
                    <Link className="text-[#7a5c1e]" to={`/ventas/${row.sale_id}`}>
                      {row.sale_number}
                    </Link>
                  ) : row.purchase_id ? (
                    <Link className="text-[#7a5c1e]" to={`/compras/${row.purchase_id}`}>
                      {row.purchase_number}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{row.notes || '—'}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="py-8 text-center text-[#6b6266]" colSpan={6}>
                  No hay movimientos con esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
