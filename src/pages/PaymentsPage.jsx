import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { METHODS, money, ymd } from '../format';
import { useStore } from '../store';

export default function PaymentsPage() {
  const { currency } = useStore();
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({ in: 0, out: 0 });
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [method, setMethod] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (kind) params.set('kind', kind);
    if (method) params.set('method', method);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await api.payments(`?${params.toString()}`);
    setRows(res.data);
    setTotals(res.totals);
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      load().catch((err) => setError(err.message));
    }, 200);
    return () => clearTimeout(handle);
  }, [q, kind, method, from, to]);

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl">Historial de pagos</h1>
        <button className="pill-btn" onClick={() => api.exportFile('payments', 'xlsx')}>
          Excel
        </button>
        <button className="pill-btn" onClick={() => api.exportFile('payments', 'csv')}>
          CSV
        </button>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className="h-9 min-w-[180px] rounded-full border border-[#eadfe2] px-4 text-sm"
          placeholder="Buscar cliente, proveedor o n°…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="h-9 rounded-full border border-[#eadfe2] px-3 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Cobros y pagos</option>
          <option value="in">Cobros</option>
          <option value="out">Pagos a proveedores</option>
        </select>
        <select className="h-9 rounded-full border border-[#eadfe2] px-3 text-sm" value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="">Todos los medios</option>
          {Object.entries(METHODS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input className="h-9 rounded-full border border-[#eadfe2] px-3 text-sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className="h-9 rounded-full border border-[#eadfe2] px-3 text-sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="kpi-card">
          <div className="kpi-label">Cobrado</div>
          <div className="kpi-value">{money(totals.in, currency)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pagado a proveedores</div>
          <div className="kpi-value">{money(totals.out, currency)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Neto</div>
          <div className="kpi-value">{money(totals.in - totals.out, currency)}</div>
        </div>
      </div>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="overflow-x-auto rounded-xl border border-[#eadfe2]">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Persona</th>
              <th>Comprobante</th>
              <th>Medio</th>
              <th>Importe</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{ymd(row.paid_at)}</td>
                <td>
                  <span className={`badge ${row.kind === 'in' ? 'badge-in' : 'badge-out'}`}>
                    {row.kind === 'in' ? 'Cobro' : 'Pago'}
                  </span>
                </td>
                <td>{row.customer_name || row.supplier_name || '—'}</td>
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
                <td>{METHODS[row.method] || row.method}</td>
                <td>{money(row.amount, currency)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="py-8 text-center text-[#6b6266]" colSpan={6}>
                  No hay pagos con esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
