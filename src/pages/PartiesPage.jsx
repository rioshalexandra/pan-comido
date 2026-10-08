import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import ConfirmDangerModal from '../components/ConfirmDangerModal';
import PartyForm, { emptyParty, toPartyForm } from '../components/PartyForm';
import { money, ymd } from '../format';
import { useStore } from '../store';
import { useAuth } from '../auth';

const COPY = {
  customers: {
    title: 'Clientes',
    newLabel: 'Nuevo cliente',
    path: '/clientes',
    list: () => api.customers,
    save: api.saveCustomer,
    remove: api.deleteCustomer,
    itemLabel: 'cliente',
  },
  suppliers: {
    title: 'Proveedores',
    newLabel: 'Nuevo proveedor',
    path: '/proveedores',
    list: () => api.suppliers,
    save: api.saveSupplier,
    remove: api.deleteSupplier,
    itemLabel: 'proveedor',
  },
};

export default function PartiesPage({ kind }) {
  const meta = COPY[kind];
  const { isAdmin } = useAuth();
  const { currency } = useStore();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [error, setError] = useState('');

  async function load(term = q) {
    const params = new URLSearchParams();
    if (term.trim()) params.set('q', term.trim());
    const res = await meta.list()(`?${params.toString()}`);
    setRows(res.data);
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      load(q).catch((err) => setError(err.message));
    }, 200);
    return () => clearTimeout(handle);
  }, [q, kind]);

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl">{meta.title}</h1>
        <input
          className="h-9 w-full min-w-0 rounded-full border border-[#eadfe2] px-4 text-sm outline-none focus:border-[#7a5c1e] sm:w-auto sm:min-w-[240px]"
          placeholder={kind === 'customers' ? 'Buscar por nombre o teléfono…' : 'Buscar por nombre, CUIT o teléfono…'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="pill-btn primary" onClick={() => setEditing(emptyParty())}>
          {meta.newLabel}
        </button>
      </div>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {/* Celular: tarjetas simples que llevan a la ficha */}
      <div className="grid gap-2 sm:hidden">
        {rows.map((row) => (
          <Link key={row.id} to={`${meta.path}/${row.id}`} className="card-tile flex items-center gap-3 no-underline">
            <span className="avatar small">{row.name.slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-[#1c1a1b]">{row.name}</div>
              <div className="truncate text-xs text-[#6b6266]">
                {row.phone || 'Sin teléfono'}
                {row.next_order && ` · encargo ${ymd(row.next_order)}`}
              </div>
            </div>
          </Link>
        ))}
        {!rows.length && <div className="list-empty">No hay registros.</div>}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border border-[#eadfe2] bg-white sm:block">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              {kind === 'customers' ? (
                <>
                  <th>Teléfono</th>
                  <th>Última compra</th>
                  <th>Próximo encargo</th>
                </>
              ) : (
                <>
                  <th>CUIT / DNI</th>
                  <th>Teléfono</th>
                </>
              )}
              <th>Saldo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link className="font-medium text-[#7a5c1e]" to={`${meta.path}/${row.id}`}>
                    {row.name}
                  </Link>
                </td>
                {kind === 'customers' ? (
                  <>
                    <td>{row.phone || '—'}</td>
                    <td>{row.last_purchase ? ymd(row.last_purchase) : '—'}</td>
                    <td>{row.next_order ? ymd(row.next_order) : '—'}</td>
                  </>
                ) : (
                  <>
                    <td>{row.tax_id || '—'}</td>
                    <td>{row.phone || '—'}</td>
                  </>
                )}
                <td>{money(row.balance, currency)}</td>
                <td className="text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button className="pill-btn" onClick={() => setEditing(toPartyForm(row))}>
                      Editar
                    </button>
                    {isAdmin && (
                      <button className="pill-btn danger" onClick={() => setRemoving(row)}>
                        Borrar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="py-8 text-center text-[#6b6266]" colSpan={kind === 'customers' ? 6 : 5}>
                  No hay registros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {removing && (
        <ConfirmDangerModal
          title={`Borrar ${removing.name}`}
          message={`Se va a borrar el ${meta.itemLabel} ${removing.name}. Los comprobantes asociados quedan sin ${meta.itemLabel}.`}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await meta.remove(removing.id);
            setRemoving(null);
            await load();
          }}
        />
      )}
      {editing && (
        <PartyForm
          title={editing.id ? 'Editar' : meta.newLabel}
          form={editing}
          kind={kind}
          onClose={() => setEditing(null)}
          onSave={async (body) => {
            await meta.save(editing.id, body);
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}
