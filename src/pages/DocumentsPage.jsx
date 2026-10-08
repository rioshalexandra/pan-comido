import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import ConfirmDangerModal from '../components/ConfirmDangerModal';
import StatusBadge from '../components/StatusBadge';
import { money, ymd } from '../format';
import { printApiDocument } from '../lib/ticket';
import { useStore } from '../store';

const COPY = {
  sales: {
    title: 'Ventas',
    docTitle: 'Venta',
    newTo: '/ventas/nueva',
    newLabel: 'Nueva venta',
    party: 'Cliente',
    path: '/ventas',
    list: api.sales,
    get: api.sale,
    remove: api.deleteSale,
    fallback: 'Consumidor final',
  },
  purchases: {
    title: 'Compras',
    docTitle: 'Compra',
    newTo: '/compras/nueva',
    newLabel: 'Nueva compra',
    party: 'Proveedor',
    path: '/compras',
    list: api.purchases,
    get: api.purchase,
    remove: api.deletePurchase,
    fallback: 'Sin proveedor',
  },
};

export default function DocumentsPage({ kind }) {
  const meta = COPY[kind];
  const navigate = useNavigate();
  const { currency, settings } = useStore();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [printingId, setPrintingId] = useState(null);
  const [removing, setRemoving] = useState(null);

  async function handlePrint(row, ev) {
    ev.preventDefault();
    ev.stopPropagation();
    setError('');
    setPrintingId(row.id);
    try {
      const res = await meta.get(row.id);
      printApiDocument({
        doc: res.data,
        kind,
        storeName: settings?.name,
        currency,
        partyLabel: meta.party,
        partyFallback: meta.fallback,
        title: meta.docTitle,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setPrintingId(null);
    }
  }

  async function load() {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (status) params.set('status', status);
    const res = await meta.list(`?${params.toString()}`);
    setRows(res.data);
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      load().catch((err) => setError(err.message));
    }, 200);
    return () => clearTimeout(handle);
  }, [q, status, kind]);

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl">{meta.title}</h1>
        <input
          className="h-9 w-full min-w-0 rounded-full border border-[#eadfe2] px-4 text-sm outline-none focus:border-[#7a5c1e] sm:w-auto sm:min-w-[220px]"
          placeholder="Buscar número o nombre…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="h-9 rounded-full border border-[#eadfe2] px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="draft">Borrador</option>
          <option value="confirmed">Confirmado</option>
          <option value="cancelled">Cancelado</option>
        </select>
        <Link className="pill-btn primary grid place-items-center" to={meta.newTo}>
          {meta.newLabel}
        </Link>
      </div>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="overflow-x-auto rounded-xl border border-[#eadfe2]">
        <table className="data-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Fecha</th>
              <th>{meta.party}</th>
              <th>Total</th>
              <th>Saldo</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer"
                onClick={() => navigate(`${meta.path}/${row.id}`)}
              >
                <td>
                  <Link
                    className="font-medium text-[#7a5c1e]"
                    to={`${meta.path}/${row.id}`}
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    {row.number}
                  </Link>
                </td>
                <td>{ymd(row.issued_at)}</td>
                <td>{row.customer_name || row.supplier_name || meta.fallback}</td>
                <td>{money(row.total, currency)}</td>
                <td>{money(row.balance, currency)}</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link
                      className="pill-btn grid place-items-center"
                      to={`${meta.path}/${row.id}`}
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      Ver
                    </Link>
                    <button
                      className="pill-btn"
                      type="button"
                      disabled={printingId === row.id}
                      onClick={(ev) => handlePrint(row, ev)}
                    >
                      {printingId === row.id ? 'Imprimiendo…' : 'Imprimir'}
                    </button>
                    <button
                      className="pill-btn danger"
                      type="button"
                      onClick={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        setRemoving(row);
                      }}
                    >
                      Borrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="py-8 text-center text-[#6b6266]" colSpan={7}>
                  No hay comprobantes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {removing && (
        <ConfirmDangerModal
          title={`Borrar ${removing.number}`}
          message={
            removing.status === 'confirmed'
              ? `Se va a borrar ${removing.number} y se va a revertir el stock. También se eliminan los pagos de este comprobante.`
              : `Se va a borrar ${removing.number} y sus renglones.`
          }
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await meta.remove(removing.id);
            setRemoving(null);
            await load();
          }}
        />
      )}
    </div>
  );
}
