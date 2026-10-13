import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Search, X } from 'lucide-react';
import { api } from '../api';
import { QUICK_METHODS, money } from '../format';
import { useStore } from '../store';
import { productIcon } from '../lib/icons';

// Venta de mostrador en un solo paso: elegir qué se vende y cómo paga. Listo.
export default function CheckoutModal({ onClose, onDone }) {
  const { currency } = useStore();
  const [catalog, setCatalog] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [items, setItems] = useState([]);
  const [method, setMethod] = useState('cash');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.products('?kind=product'), api.customers()])
      .then(([p, c]) => {
        setCatalog(p.data);
        setCustomers(c.data);
      })
      .catch((err) => setError(err.message));
  }, []);

  const total = useMemo(() => items.reduce((sum, item) => sum + item.qty * Number(item.price || 0), 0), [items]);

  // Resultados del buscador
  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return catalog.filter((row) => row.name.toLowerCase().includes(term)).slice(0, 6);
  }, [search, catalog]);

  // Accesos rápidos: botones con los productos que hay en stock
  const quickProducts = catalog.filter((row) => Number(row.stock_qty) > 0).slice(0, 12);

  function add(row) {
    setItems((prev) => {
      const found = prev.find((item) => item.productId === row.id);
      if (found) return prev.map((item) => (item.productId === row.id ? { ...item, qty: item.qty + 1 } : item));
      return [
        ...prev,
        { productId: row.id, name: row.name, qty: 1, price: Number(row.sale_price) },
      ];
    });
    setSearch('');
  }

  function changeQty(productId, delta) {
    setItems((prev) =>
      prev
        .map((item) => (item.productId === productId ? { ...item, qty: item.qty + delta } : item))
        .filter((item) => item.qty > 0)
    );
  }

  function setPrice(productId, price) {
    setItems((prev) => prev.map((item) => (item.productId === productId ? { ...item, price } : item)));
  }

  async function submit() {
    if (!items.length) {
      setError('Agregá al menos un producto');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.quickSale({
        customerId: customerId || null,
        method,
        items: items.map((item) => ({ productId: item.productId, qty: item.qty, unitPrice: Number(item.price || 0) })),
      });
      onDone?.(res.data);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal-head flex items-center">
          <span className="mr-auto">Vender</span>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-4 px-5 py-4">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {/* Cliente (opcional) */}
          <label className="field">
            <span>Cliente (opcional)</span>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Sin cliente</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {/* Qué se vende: un toque en un producto suma una unidad */}
          <div>
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
                      <span>
                        {productIcon(row) && <span className="mr-1.5">{productIcon(row)}</span>}
                        {row.name}
                        <span className="ml-2 text-xs text-[#6b6266]">hay {Number(row.stock_qty)}</span>
                      </span>
                      <span>{money(row.sale_price, currency)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {quickProducts.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {quickProducts.map((row) => (
                  <button key={row.id} type="button" className="chip" onClick={() => add(row)}>
                    {productIcon(row) && <span className="mr-1 text-base" aria-hidden="true">{productIcon(row)}</span>}
                    {row.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <ul className="divide-y divide-[#eadfe2] rounded-xl border border-[#eadfe2] bg-white">
              {items.map((item) => (
                <li key={item.productId} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{item.name}</div>
                    <input
                      className="mt-1 w-28 rounded-md border border-[#eadfe2] px-2 py-1 text-sm"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={item.price}
                      onChange={(e) => setPrice(item.productId, e.target.value)}
                      aria-label="Precio"
                    />
                  </div>
                  <button type="button" className="qty-btn" onClick={() => changeQty(item.productId, -1)} aria-label="Restar">
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">{item.qty}</span>
                  <button type="button" className="qty-btn" onClick={() => changeQty(item.productId, 1)} aria-label="Sumar">
                    <Plus size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Cómo paga */}
          <div>
            <div className="mb-2 text-xs font-medium text-[#6b6266]">Medio de pago</div>
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
        </div>
        <div className="modal-foot">
          <div className="mr-auto">
            <div className="text-xs text-[#6b6266]">Total</div>
            <div className="text-2xl font-semibold">{money(total, currency)}</div>
          </div>
          <button className="pill-btn primary big" onClick={submit} disabled={busy || !items.length}>
            {busy ? 'Cobrando…' : 'Cobrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
