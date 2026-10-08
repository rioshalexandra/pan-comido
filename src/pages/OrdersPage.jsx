import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapPin, MessageCircle, Plus, Store } from 'lucide-react';
import { api } from '../api';
import OrderForm, { emptyOrder, toOrderForm } from '../components/OrderForm';
import { ORDER_STATUSES, QUICK_METHODS, addDays, longDate, money, qty, today, whatsappLink, ymd } from '../format';
import { useStore } from '../store';

// Filtros de la lista de encargos
const VIEWS = [
  ['open', 'Por entregar'],
  ['delivered', 'Entregados'],
  ['cancelled', 'Cancelados'],
];

// Encargos agrupados por día, como una línea de tiempo con hilo vertical.
export default function OrdersPage() {
  const { currency, settings } = useStore();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState('open');
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [paying, setPaying] = useState(null); // { order, mode: 'deliver' | 'deposit' }
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function load(nextView = view) {
    const query = new URLSearchParams({ status: nextView });
    // Entregados y cancelados: solo los últimos 60 días
    if (nextView !== 'open') query.set('from', addDays(today(), -60));
    const res = await api.orders(`?${query.toString()}`);
    setRows(res.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [view]);

  // Abrir el formulario directo (desde Inicio o desde la ficha de un cliente)
  useEffect(() => {
    if (params.get('nuevo') === '1') {
      setEditing(emptyOrder(params.get('cliente') || ''));
      setParams({}, { replace: true });
    }
  }, [params]);

  // Agrupar por fecha de entrega
  const groups = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const day = ymd(row.due_date);
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(row);
    }
    return [...map.entries()];
  }, [rows]);

  function flash(text) {
    setNotice(text);
    setTimeout(() => setNotice(''), 4000);
  }

  async function setStatus(row, status) {
    try {
      await api.setOrderStatus(row.id, status);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function dayLabel(day) {
    if (day === today()) return 'Hoy';
    if (day === addDays(today(), 1)) return 'Mañana';
    if (day < today() && view === 'open') return `Atrasado · ${longDate(day)}`;
    return longDate(day);
  }

  function readyText(row) {
    const name = String(row.display_customer || '').split(' ')[0];
    return row.fulfillment === 'delivery'
      ? `¡Hola ${name}! Tu pedido de ${settings?.name || 'Pan Comido'} ya está listo y sale para tu domicilio.`
      : `¡Hola ${name}! Tu pedido de ${settings?.name || 'Pan Comido'} ya está listo para retirar.`;
  }

  return (
    <div className="page">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl">Encargos</h1>
        <button className="pill-btn primary hidden items-center gap-1 lg:inline-flex" onClick={() => setEditing(emptyOrder())}>
          <Plus size={16} /> Nuevo encargo
        </button>
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {VIEWS.map(([value, label]) => (
          <button key={value} className={`chip ${view === value ? 'chip-active' : ''}`} onClick={() => setView(value)}>
            {label}
          </button>
        ))}
      </div>
      {notice && <div className="notice mb-3">{notice}</div>}
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {groups.map(([day, list]) => (
        <section key={day} className="mb-5">
          <h2 className={`mb-3 text-base font-semibold first-letter:uppercase ${day < today() && view === 'open' ? 'text-[#c5221f]' : ''}`}>
            {dayLabel(day)}
          </h2>
          <ol className="agenda-thread">
            {list.map((row) => {
              const balance = Number(row.total) - Number(row.deposit);
              const wa = whatsappLink(row.display_phone, readyText(row));
              const open = row.status === 'pending' || row.status === 'ready';
              return (
                <li key={row.id} className={`agenda-item order-${row.status}`}>
                  <div className="agenda-time">
                    <div className="font-semibold">{row.due_hhmm || '—'}</div>
                    <div className="text-[11px] text-[#6b6266]">{row.number}</div>
                  </div>
                  <div className="agenda-card">
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">
                          {row.customer_id ? (
                            <Link className="text-link" to={`/clientes/${row.customer_id}`}>
                              {row.display_customer}
                            </Link>
                          ) : (
                            row.display_customer
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-[#5a5155]">
                          {row.fulfillment === 'delivery' ? <MapPin size={13} /> : <Store size={13} />}
                          {row.fulfillment === 'delivery' ? row.address : 'Retira en el local'}
                        </div>
                      </div>
                      <span className={`badge order-badge-${row.status}`}>{ORDER_STATUSES[row.status]}</span>
                    </div>
                    <ul className="my-2 list-none p-0 text-sm">
                      {row.items.map((item) => (
                        <li key={item.id}>
                          <strong>{qty(item.qty)}</strong> × {item.description}
                        </li>
                      ))}
                    </ul>
                    {row.notes && <div className="mb-2 rounded-lg bg-[#fbf3f5] px-2 py-1 text-sm text-[#5a5155]">{row.notes}</div>}
                    <div className="text-sm">
                      Total <strong>{money(row.total, currency)}</strong>
                      {Number(row.shipping_cost) > 0 && <span className="text-[#6b6266]"> (envío {money(row.shipping_cost, currency)})</span>}
                      {Number(row.deposit) > 0 && <> · seña {money(row.deposit, currency)}</>}
                      {open && balance > 0 && (
                        <>
                          {' '}
                          · falta <strong>{money(balance, currency)}</strong>
                        </>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {open && (
                        <button className="pill-btn primary" onClick={() => setPaying({ order: row, mode: 'deliver' })}>
                          Entregar{balance > 0 ? ' y cobrar' : ''}
                        </button>
                      )}
                      {row.status === 'pending' && (
                        <button className="pill-btn" onClick={() => setStatus(row, 'ready')}>
                          Está listo
                        </button>
                      )}
                      {open && wa && (
                        <a className="pill-btn inline-flex items-center gap-1 no-underline" href={wa} target="_blank" rel="noreferrer">
                          <MessageCircle size={15} /> Avisar
                        </a>
                      )}
                      {open && (
                        <button className="pill-btn" onClick={() => setPaying({ order: row, mode: 'deposit' })}>
                          Seña
                        </button>
                      )}
                      {open && (
                        <button className="pill-btn" onClick={() => setEditing(toOrderForm(row))}>
                          Editar
                        </button>
                      )}
                      {row.status === 'cancelled' && (
                        <button className="pill-btn" onClick={() => setStatus(row, 'pending')}>
                          Reactivar
                        </button>
                      )}
                      {row.sale_id && (
                        <Link className="pill-btn inline-flex items-center no-underline" to={`/ventas/${row.sale_id}`}>
                          Venta {row.sale_number}
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {!rows.length && (
        <div className="agenda-empty ml-0">
          {view === 'open' ? 'No hay encargos por entregar.' : 'No hay encargos en esta lista.'}{' '}
          {view === 'open' && (
            <button className="link-btn" onClick={() => setEditing(emptyOrder())}>
              Cargar un encargo
            </button>
          )}
        </div>
      )}

      {/* Botón flotante para cargar un encargo desde el celular */}
      <button className="fab lg:hidden" onClick={() => setEditing(emptyOrder())} aria-label="Nuevo encargo">
        <Plus size={26} />
      </button>

      {editing && (
        <OrderForm
          form={editing}
          onClose={() => setEditing(null)}
          onSave={async (body) => {
            await api.saveOrder(editing.id, body);
            setEditing(null);
            await load();
          }}
          onDelete={async () => {
            if (!confirm('¿Borrar este encargo? Si tenía seña, también se borra el registro de la seña.')) return;
            try {
              await api.deleteOrder(editing.id);
              setEditing(null);
              await load();
            } catch (err) {
              setError(err.message);
            }
          }}
        />
      )}
      {paying && (
        <PayModal
          order={paying.order}
          mode={paying.mode}
          onClose={() => setPaying(null)}
          onDone={async (text) => {
            setPaying(null);
            flash(text);
            await load();
          }}
          onCancelOrder={async () => {
            if (!confirm('¿Cancelar este encargo? La seña queda registrada (si la devolvés, borrá el encargo).')) return;
            await setStatus(paying.order, 'cancelled');
            setPaying(null);
          }}
        />
      )}
    </div>
  );
}

// Modal para entregar (cobrando el saldo) o para registrar una seña
function PayModal({ order, mode, onClose, onDone, onCancelOrder }) {
  const { currency } = useStore();
  const balance = Number(order.total) - Number(order.deposit);
  const [method, setMethod] = useState('cash');
  const [amount, setAmount] = useState(mode === 'deposit' ? '' : String(balance));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isDeliver = mode === 'deliver';

  async function submit() {
    setBusy(true);
    setError('');
    try {
      if (isDeliver) {
        const res = await api.deliverOrder(order.id, { method });
        onDone(`Entregado ${order.number} · venta ${res.data.sale.number} por ${money(res.data.sale.total, currency)}`);
      } else {
        await api.addDeposit(order.id, { amount: Number(amount), method });
        onDone(`Seña de ${money(amount, currency)} registrada en ${order.number}`);
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal-head">
          {isDeliver ? 'Entregar' : 'Registrar seña'} · {order.display_customer}
        </div>
        <div className="grid gap-4 px-5 py-4">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="list-card">
            <div className="list-row">
              <span>Total del encargo</span>
              <strong>{money(order.total, currency)}</strong>
            </div>
            <div className="list-row">
              <span>Seña cobrada</span>
              <span>{money(order.deposit, currency)}</span>
            </div>
            <div className="list-row bg-[#f7efe0]">
              <span>Falta cobrar</span>
              <strong>{money(Math.max(balance, 0), currency)}</strong>
            </div>
          </div>
          {!isDeliver && (
            <label className="field">
              <span>Importe de la seña</span>
              <input type="number" inputMode="decimal" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
          )}
          {(!isDeliver || balance > 0) && (
            <div>
              <div className="mb-2 text-xs font-semibold text-[#5a5155]">Medio de pago</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {QUICK_METHODS.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`method-btn ${method === value ? 'active' : ''}`}
                    onClick={() => setMethod(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {isDeliver && (
            <p className="m-0 text-xs text-[#6b6266]">
              Al entregar se descuentan los productos del stock. Si falta stock, primero registrá la producción.
            </p>
          )}
        </div>
        <div className="modal-foot">
          {isDeliver && (
            <button className="pill-btn danger mr-auto" onClick={onCancelOrder}>
              Cancelar encargo
            </button>
          )}
          <button className="pill-btn" onClick={onClose}>
            Cerrar
          </button>
          <button className="pill-btn primary" onClick={submit} disabled={busy || (!isDeliver && !(Number(amount) > 0))}>
            {isDeliver ? (balance > 0 ? `Cobrar ${money(balance, currency)} y entregar` : 'Entregar') : 'Guardar seña'}
          </button>
        </div>
      </div>
    </div>
  );
}
