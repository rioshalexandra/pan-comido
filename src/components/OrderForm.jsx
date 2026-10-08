import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Search } from 'lucide-react';
import { api } from '../api';
import { QUICK_METHODS, money, today } from '../format';
import { useStore } from '../store';

// Alta / edición de un encargo: cliente, fecha y hora, retiro o envío, productos y seña.
export default function OrderForm({ form, onClose, onSave, onDelete }) {
  const { currency } = useStore();
  const [state, setState] = useState(form);
  const [catalog, setCatalog] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [walkIn, setWalkIn] = useState(!form.customerId && Boolean(form.customerName));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isNew = !state.id;

  useEffect(() => {
    Promise.all([api.products('?kind=product'), api.customers()])
      .then(([p, c]) => {
        setCatalog(p.data);
        setCustomers(c.data);
      })
      .catch((err) => setError(err.message));
  }, []);

  function set(key, value) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  // Al elegir un cliente de la lista se completan teléfono y dirección
  function pickCustomer(id) {
    const c = customers.find((row) => String(row.id) === String(id));
    setState((prev) => ({ ...prev, customerId: id, phone: c?.phone || prev.phone, address: c?.address || prev.address }));
  }

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return catalog.filter((row) => row.name.toLowerCase().includes(term)).slice(0, 6);
  }, [search, catalog]);

  function add(row) {
    setState((prev) => {
      const found = prev.items.find((item) => item.productId === row.id);
      const items = found
        ? prev.items.map((item) => (item.productId === row.id ? { ...item, qty: item.qty + 1 } : item))
        : [...prev.items, { productId: row.id, name: row.name, qty: 1, price: Number(row.sale_price) }];
      return { ...prev, items };
    });
    setSearch('');
  }

  function changeItem(productId, patch) {
    setState((prev) => ({
      ...prev,
      items: prev.items
        .map((item) => (item.productId === productId ? { ...item, ...patch } : item))
        .filter((item) => item.qty > 0),
    }));
  }

  const subtotal = state.items.reduce((sum, item) => sum + item.qty * Number(item.price || 0), 0);
  const shipping = state.fulfillment === 'delivery' ? Number(state.shippingCost || 0) : 0;
  const total = subtotal + shipping;

  async function submit(ev) {
    ev.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave({
        customerId: walkIn ? null : state.customerId || null,
        customerName: walkIn ? state.customerName : null,
        phone: state.phone,
        dueDate: state.dueDate,
        dueTime: state.dueTime,
        fulfillment: state.fulfillment,
        address: state.address,
        shippingCost: shipping,
        notes: state.notes,
        items: state.items.map((item) => ({ productId: item.productId, qty: item.qty, unitPrice: Number(item.price || 0) })),
        deposit: isNew && Number(state.depositAmount) > 0 ? { amount: Number(state.depositAmount), method: state.depositMethod } : null,
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal-card" onClick={(ev) => ev.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">{isNew ? 'Nuevo encargo' : `Editar encargo ${form.number}`}</div>
        <div className="grid grid-cols-2 gap-3 px-5 py-4">
          {error && <div className="col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {/* Cliente */}
          <div className="field col-span-2">
            <span>Cliente</span>
            {walkIn ? (
              <input
                value={state.customerName}
                placeholder="Nombre del cliente"
                onChange={(e) => set('customerName', e.target.value)}
                required
              />
            ) : (
              <select value={state.customerId} onChange={(e) => pickCustomer(e.target.value)} required>
                <option value="">Elegí un cliente…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.phone ? ` · ${c.phone}` : ''}
                  </option>
                ))}
              </select>
            )}
            <button type="button" className="link-btn self-start text-xs" onClick={() => setWalkIn((prev) => !prev)}>
              {walkIn ? 'Elegir de mis clientes' : '¿Es nuevo? Escribir solo el nombre'}
            </button>
          </div>
          <label className="field col-span-2">
            <span>Teléfono / WhatsApp</span>
            <input type="tel" inputMode="tel" value={state.phone} onChange={(e) => set('phone', e.target.value)} />
          </label>

          {/* Cuándo */}
          <label className="field">
            <span>Fecha de entrega</span>
            <input type="date" value={state.dueDate} onChange={(e) => set('dueDate', e.target.value)} required />
          </label>
          <label className="field">
            <span>Hora (opcional)</span>
            <input type="time" step="900" value={state.dueTime} onChange={(e) => set('dueTime', e.target.value)} />
          </label>

          {/* Retiro o envío */}
          <div className="col-span-2 grid grid-cols-2 gap-2">
            {[
              ['pickup', 'Retira en el local'],
              ['delivery', 'Envío a domicilio'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`method-btn ${state.fulfillment === value ? 'active' : ''}`}
                onClick={() => set('fulfillment', value)}
              >
                {label}
              </button>
            ))}
          </div>
          {state.fulfillment === 'delivery' && (
            <>
              <label className="field col-span-2">
                <span>Dirección de entrega</span>
                <input value={state.address} onChange={(e) => set('address', e.target.value)} required />
              </label>
              <label className="field">
                <span>Costo de envío</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={state.shippingCost}
                  onChange={(e) => set('shippingCost', e.target.value)}
                />
              </label>
              <div />
            </>
          )}

          {/* Productos */}
          <div className="col-span-2">
            <div className="mb-1.5 text-xs font-semibold text-[#5a5155]">Productos</div>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6266]" />
              <input
                className="search-input pl-9"
                placeholder="Buscar producto…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {!!matches.length && (
                <div className="dropdown">
                  {matches.map((row) => (
                    <button key={row.id} type="button" className="dropdown-item" onClick={() => add(row)}>
                      <span>{row.name}</span>
                      <span>{money(row.sale_price, currency)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!state.items.length && catalog.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {catalog.slice(0, 8).map((row) => (
                  <button key={row.id} type="button" className="chip" onClick={() => add(row)}>
                    {row.name}
                  </button>
                ))}
              </div>
            )}
            {state.items.length > 0 && (
              <ul className="mt-3 divide-y divide-[#eadfe2] rounded-xl border border-[#eadfe2] bg-white p-0">
                {state.items.map((item) => (
                  <li key={item.productId} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{item.name}</div>
                      <input
                        className="mt-1 w-28 rounded-md border border-[#eadfe2] px-2 py-1 text-sm"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        value={item.price}
                        onChange={(e) => changeItem(item.productId, { price: e.target.value })}
                        aria-label="Precio unitario"
                      />
                    </div>
                    <button type="button" className="qty-btn" onClick={() => changeItem(item.productId, { qty: item.qty - 1 })}>
                      <Minus size={14} />
                    </button>
                    <input
                      className="w-12 rounded-md border border-[#eadfe2] px-1 py-1 text-center text-sm font-semibold"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={item.qty}
                      onChange={(e) => changeItem(item.productId, { qty: Number(e.target.value) || 0 })}
                      aria-label="Cantidad"
                    />
                    <button type="button" className="qty-btn" onClick={() => changeItem(item.productId, { qty: item.qty + 1 })}>
                      <Plus size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className="field col-span-2">
            <span>Notas (sabor, decoración, dedicatoria…)</span>
            <textarea rows={2} value={state.notes} onChange={(e) => set('notes', e.target.value)} />
          </label>

          {/* Seña: solo al crear (después se agrega desde la tarjeta del encargo) */}
          {isNew && (
            <>
              <label className="field">
                <span>Seña (opcional)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={state.depositAmount}
                  onChange={(e) => set('depositAmount', e.target.value)}
                />
              </label>
              <label className="field">
                <span>Medio de la seña</span>
                <select value={state.depositMethod} onChange={(e) => set('depositMethod', e.target.value)}>
                  {QUICK_METHODS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
        <div className="modal-foot">
          {!isNew && onDelete && (
            <button type="button" className="pill-btn danger mr-auto" onClick={onDelete}>
              Borrar
            </button>
          )}
          <div className={isNew || !onDelete ? 'mr-auto' : ''}>
            <div className="text-xs text-[#6b6266]">Total{shipping ? ' con envío' : ''}</div>
            <div className="text-xl font-semibold">{money(total, currency)}</div>
          </div>
          <button type="button" className="pill-btn" onClick={onClose}>
            Cerrar
          </button>
          <button type="submit" className="pill-btn primary" disabled={busy || !state.items.length}>
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}

export function emptyOrder(customerId = '') {
  return {
    id: null,
    customerId: customerId ? String(customerId) : '',
    customerName: '',
    phone: '',
    dueDate: today(),
    dueTime: '',
    fulfillment: 'pickup',
    address: '',
    shippingCost: '',
    notes: '',
    items: [],
    depositAmount: '',
    depositMethod: 'transfer',
  };
}

export function toOrderForm(row) {
  return {
    id: row.id,
    number: row.number,
    customerId: row.customer_id ? String(row.customer_id) : '',
    customerName: row.customer_id ? '' : row.customer_name || '',
    phone: row.phone || '',
    dueDate: String(row.due_date).slice(0, 10),
    dueTime: row.due_hhmm || '',
    fulfillment: row.fulfillment,
    address: row.address || '',
    shippingCost: Number(row.shipping_cost) ? String(Number(row.shipping_cost)) : '',
    notes: row.notes || '',
    items: (row.items || []).map((item) => ({
      productId: item.product_id,
      name: item.description,
      qty: Number(item.qty),
      price: Number(item.unit_price),
    })),
    depositAmount: '',
    depositMethod: 'transfer',
  };
}
