import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import ConfirmDangerModal from '../components/ConfirmDangerModal';
import PartyForm, { toPartyForm } from '../components/PartyForm';
import StatusBadge from '../components/StatusBadge';
import { METHODS, ORDER_STATUSES, birthdayLabel, money, whatsappLink, ymd } from '../format';
import { useStore } from '../store';

const COPY = {
  customers: {
    title: 'Cliente',
    listLabel: 'Clientes',
    back: '/clientes',
    docs: '/ventas',
    get: api.customer,
    save: api.saveCustomer,
    remove: api.deleteCustomer,
    partyLabel: 'Ventas',
    itemLabel: 'cliente',
  },
  suppliers: {
    title: 'Proveedor',
    listLabel: 'Proveedores',
    back: '/proveedores',
    docs: '/compras',
    get: api.supplier,
    save: api.saveSupplier,
    remove: api.deleteSupplier,
    partyLabel: 'Compras',
    itemLabel: 'proveedor',
  },
};

export default function PartyDetailPage({ kind }) {
  const meta = COPY[kind];
  const { id } = useParams();
  const navigate = useNavigate();
  const { currency } = useStore();
  const [party, setParty] = useState(null);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const res = await meta.get(id);
    setParty(res.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [id, kind]);

  if (!party) return <div className="p-6 text-[#6b6266]">{error || 'Cargando…'}</div>;

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <Link className="text-sm text-[#7a5c1e]" to={meta.back}>
            ← {meta.listLabel}
          </Link>
          <h1 className="text-2xl">{party.name}</h1>
          <div className="text-sm text-[#6b6266]">
            {kind === 'customers'
              ? [party.phone || 'Sin teléfono', party.email].filter(Boolean).join(' · ')
              : `${party.tax_id || 'Sin CUIT'} · ${party.phone || 'Sin teléfono'}`}
          </div>
        </div>
        <button className="pill-btn" onClick={() => setEditing(true)}>
          Editar
        </button>
        <button className="pill-btn danger" onClick={() => setRemoving(true)}>
          Borrar
        </button>
      </div>
      <div className="mb-6 kpi-card max-w-xs">
        <div className="kpi-label">Saldo</div>
        <div className="kpi-value">{money(party.balance, currency)}</div>
      </div>
      {kind === 'customers' && <CustomerOrders party={party} />}
      <div className="grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-medium">{meta.partyLabel}</h2>
          <div className="overflow-x-auto rounded-xl border border-[#eadfe2]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Fecha</th>
                  <th>Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {(party.documents || []).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link className="text-[#7a5c1e]" to={`${meta.docs}/${row.id}`}>
                        {row.number}
                      </Link>
                    </td>
                    <td>{ymd(row.issued_at)}</td>
                    <td>{money(row.total, currency)}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
                {!party.documents?.length && (
                  <tr>
                    <td className="py-8 text-center text-[#6b6266]" colSpan={4}>
                      Sin comprobantes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-medium">Pagos</h2>
          <div className="overflow-x-auto rounded-xl border border-[#eadfe2]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Medio</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {(party.payments || []).map((row) => (
                  <tr key={row.id}>
                    <td>{ymd(row.paid_at)}</td>
                    <td>{METHODS[row.method] || row.method}</td>
                    <td>{money(row.amount, currency)}</td>
                  </tr>
                ))}
                {!party.payments?.length && (
                  <tr>
                    <td className="py-8 text-center text-[#6b6266]" colSpan={3}>
                      Sin pagos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      {removing && (
        <ConfirmDangerModal
          title={`Borrar ${party.name}`}
          message={`Se va a borrar el ${meta.itemLabel} ${party.name}. Los comprobantes asociados quedan sin ${meta.itemLabel}.`}
          onClose={() => setRemoving(false)}
          onConfirm={async () => {
            await meta.remove(party.id);
            navigate(meta.back);
          }}
        />
      )}
      {editing && (
        <PartyForm
          title={`Editar ${meta.title.toLowerCase()}`}
          form={toPartyForm(party)}
          kind={kind}
          onClose={() => setEditing(false)}
          onSave={async (body) => {
            await meta.save(party.id, body);
            setEditing(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

// Encargos del cliente, con acceso rápido a cargar uno nuevo y a escribirle por WhatsApp
function CustomerOrders({ party }) {
  const { currency } = useStore();
  const wa = whatsappLink(party.phone);
  return (
    <section className="mb-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="section-title m-0 mr-auto">Encargos</h2>
        {wa && (
          <a className="pill-btn inline-flex items-center no-underline" href={wa} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        )}
        <Link className="pill-btn primary inline-flex items-center no-underline" to={`/encargos?nuevo=1&cliente=${party.id}`}>
          Nuevo encargo
        </Link>
      </div>
      {(party.address || party.notes || party.birthday) && (
        <div className="list-card mb-3">
          {party.address && (
            <div className="list-row">
              <span className="text-[#6b6266]">Dirección</span>
              <span>{party.address}</span>
            </div>
          )}
          {party.birthday && (
            <div className="list-row">
              <span className="text-[#6b6266]">Cumpleaños</span>
              <span>{birthdayLabel(party.birthday)}</span>
            </div>
          )}
          {party.notes && (
            <div className="list-row">
              <span className="text-[#6b6266]">Notas</span>
              <span className="text-right">{party.notes}</span>
            </div>
          )}
        </div>
      )}
      <div className="list-card">
        {(party.orders || []).map((row) => (
          <Link key={row.id} to="/encargos" className="list-row text-[#1c1a1b] no-underline">
            <span>
              {row.number} · {ymd(row.due_date)}
              {row.due_hhmm ? ` ${row.due_hhmm}` : ''}
            </span>
            <span className="flex items-center gap-2">
              {money(row.total, currency)}
              <span className={`badge order-badge-${row.status}`}>{ORDER_STATUSES[row.status]}</span>
            </span>
          </Link>
        ))}
        {!party.orders?.length && <div className="list-empty">Todavía no hizo encargos.</div>}
      </div>
    </section>
  );
}
