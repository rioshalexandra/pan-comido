import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import ConfirmDangerModal from '../components/ConfirmDangerModal';
import AttachmentsPanel from '../components/AttachmentsPanel';
import PaymentModal from '../components/PaymentModal';
import StatusBadge from '../components/StatusBadge';
import { METHODS, money, qty, today, ymd } from '../format';
import { printTicket } from '../lib/ticket';
import { useStore } from '../store';

const COPY = {
  sales: {
    title: 'Venta',
    list: '/ventas',
    partyLabel: 'Cliente',
    fallback: 'Consumidor final',
    priceLabel: 'Precio',
    get: api.sale,
    save: api.saveSale,
    confirm: api.confirmSale,
    cancel: api.cancelSale,
    remove: api.deleteSale,
    pay: api.paySale,
    parties: api.customers,
    partyKey: 'customerId',
    partyName: 'customer_name',
    unitKey: 'unitPrice',
    defaultPrice: (product) => product.sale_price,
  },
  purchases: {
    title: 'Compra',
    list: '/compras',
    partyLabel: 'Proveedor',
    fallback: 'Sin proveedor',
    priceLabel: 'Costo',
    get: api.purchase,
    save: api.savePurchase,
    confirm: (id) => api.confirmPurchase(id, { updateCosts: true }),
    cancel: api.cancelPurchase,
    remove: api.deletePurchase,
    pay: api.payPurchase,
    parties: api.suppliers,
    partyKey: 'supplierId',
    partyName: 'supplier_name',
    unitKey: 'unitCost',
    defaultPrice: (product) => product.cost_price,
  },
};

export default function DocumentEditorPage({ kind }) {
  const meta = COPY[kind];
  const { id } = useParams();
  const navigate = useNavigate();
  const { currency, settings } = useStore();
  const [doc, setDoc] = useState(null);
  const [parties, setParties] = useState([]);
  const [products, setProducts] = useState([]);
  const [partyId, setPartyId] = useState('');
  const [issuedAt, setIssuedAt] = useState(today());
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const searchRef = useRef(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);

  const locked = doc && doc.status !== 'draft';
  const remaining = Number(doc?.total || 0) - Number(doc?.paid || 0);

  const partyName =
    parties.find((party) => String(party.id) === String(partyId))?.name ||
    doc?.customer_name ||
    doc?.supplier_name ||
    meta.fallback;

  function handlePrint() {
    try {
      printTicket({
        storeName: settings?.name,
        title: meta.title,
        number: doc.number,
        issuedAt: doc.issued_at || issuedAt,
        partyLabel: meta.partyLabel,
        partyName,
        items,
        total: doc.total ?? totals.total,
        paid: doc.status === 'confirmed' ? doc.paid : null,
        remaining,
        payments: doc.payments || [],
        notes,
        currency,
      });
    } catch (err) {
      setError(err.message);
    }
  }

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0);
    return { subtotal, total: subtotal };
  }, [items]);

  async function load() {
    const [partyRes, productRes] = await Promise.all([meta.parties(), api.products('?active=all')]);
    setParties(partyRes.data);
    setProducts(productRes.data);
    if (!id || id === 'nueva') return;
    const res = await meta.get(id);
    setDoc(res.data);
    setPartyId(res.data.customer_id || res.data.supplier_id || '');
    setIssuedAt(String(res.data.issued_at).slice(0, 10));
    setNotes(res.data.notes || '');
    setItems(
      (res.data.items || []).map((item) => ({
        productId: item.product_id,
        name: item.description,
        sku: item.sku,
        qty: Number(item.qty),
        price: Number(kind === 'sales' ? item.unit_price : item.unit_cost),
      }))
    );
  }

  useEffect(() => {
    setDoc(null);
    setItems([]);
    setPartyId('');
    setIssuedAt(today());
    setNotes('');
    load().catch((err) => setError(err.message));
  }, [id, kind]);

  const matches = products
    .filter((product) => {
      // Ventas: solo productos. Compras: ingredientes y productos (nunca ítems internos como el envío)
      if (kind === 'sales' && product.kind !== 'product') return false;
      if (product.kind === 'service') return false;
      const term = search.trim().toLowerCase();
      if (!term) return false;
      return (
        product.name.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term) ||
        String(product.barcode || '').toLowerCase().includes(term)
      );
    })
    .slice(0, 8);

  function pickByScan(term) {
    const value = String(term || '').trim();
    if (!value) return null;
    const lower = value.toLowerCase();
    return (
      products.find((product) => String(product.barcode || '') === value) ||
      products.find((product) => String(product.barcode || '').toLowerCase() === lower) ||
      products.find((product) => product.sku.toLowerCase() === lower) ||
      (matches.length === 1 ? matches[0] : null)
    );
  }

  function addProduct(product) {
    if (!product) return;
    setItems((prev) => {
      const found = prev.find((item) => item.productId === product.id);
      if (found) {
        return prev.map((item) =>
          item.productId === product.id ? { ...item, qty: Number(item.qty) + 1 } : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          qty: 1,
          price: Number(meta.defaultPrice(product) || 0),
        },
      ];
    });
    setSearch('');
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  function confirmSearch(ev) {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    addProduct(pickByScan(search) || matches[0]);
  }

  async function persist(andConfirm) {
    setBusy(true);
    setError('');
    try {
      const body = {
        [meta.partyKey]: partyId || null,
        issuedAt,
        notes,
        items: items.map((item) => ({
          productId: item.productId,
          qty: Number(item.qty),
          [meta.unitKey]: Number(item.price),
        })),
      };
      const saved = await meta.save(doc?.id, body);
      const current = saved.data;
      if (andConfirm) {
        const confirmed = await meta.confirm(current.id);
        setDoc(confirmed.data);
        navigate(`${meta.list}/${current.id}`, { replace: true });
      } else {
        setDoc(current);
        if (!id) navigate(`${meta.list}/${current.id}`, { replace: true });
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl">{doc?.number || `Nueva ${meta.title.toLowerCase()}`}</h1>
        {doc && <StatusBadge status={doc.status} />}
        {doc?.number && (
          <button className="pill-btn primary" type="button" onClick={handlePrint}>
            Imprimir
          </button>
        )}
      </div>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <label className="field">
          <span>{meta.partyLabel}</span>
          {locked ? (
            <div className="flex h-10 items-center px-1">{partyName}</div>
          ) : (
            <select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
              <option value="">{meta.fallback}</option>
              {parties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.name}
                </option>
              ))}
            </select>
          )}
        </label>
        <label className="field">
          <span>Fecha</span>
          {locked ? (
            <div className="flex h-10 items-center px-1">{ymd(issuedAt)}</div>
          ) : (
            <input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
          )}
        </label>
        <label className="field">
          <span>Notas</span>
          {locked ? (
            <div className="flex min-h-10 items-center px-1">{notes || '—'}</div>
          ) : (
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          )}
        </label>
      </div>
      {!locked && (
        <div className="relative z-20 mb-4 max-w-xl">
          <label className="field">
            <span>{kind === 'purchases' ? 'Agregar ingrediente o producto' : 'Agregar producto'}</span>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={confirmSearch}
              placeholder="Buscar o escanear código…"
              autoComplete="off"
            />
          </label>
          {!!matches.length && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-[#eadfe2] bg-white shadow-lg">
              {matches.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-[#f7efe0]"
                  onMouseDown={(ev) => {
                    ev.preventDefault();
                    addProduct(product);
                  }}
                >
                  <span>
                    {product.name}
                    <span className="ml-2 text-[#6b6266]">{product.sku}</span>
                    {product.kind === 'ingredient' && <span className="badge badge-in ml-2">Ingrediente</span>}
                  </span>
                  <span>{money(meta.defaultPrice(product), currency)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="mb-4 overflow-x-auto rounded-xl border border-[#eadfe2]">
        <table className="data-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>{meta.priceLabel}</th>
              <th>Total</th>
              {!locked && <th />}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.productId}>
                <td>
                  {item.name}
                  <div className="text-xs text-[#6b6266]">{item.sku}</div>
                </td>
                <td>
                  {locked ? qty(item.qty) : (
                    <input
                      className="w-24 rounded-lg border border-[#eadfe2] px-2 py-1"
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={item.qty}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, qty: e.target.value } : row))
                        )
                      }
                    />
                  )}
                </td>
                <td>
                  {locked ? (
                    money(item.price, currency)
                  ) : (
                    <input
                      className="w-28 rounded-lg border border-[#eadfe2] px-2 py-1"
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, price: e.target.value } : row))
                        )
                      }
                    />
                  )}
                </td>
                <td>{money(Number(item.qty || 0) * Number(item.price || 0), currency)}</td>
                {!locked && (
                  <td>
                    <button
                      className="pill-btn"
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                    >
                      Quitar
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td className="py-8 text-center text-[#6b6266]" colSpan={locked ? 4 : 5}>
                  Agregá productos para armar el comprobante.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="text-lg font-semibold">Total {money(doc?.total ?? totals.total, currency)}</div>
        {doc?.status === 'confirmed' && (
          <div className="text-sm text-[#6b6266]">
            Pagado {money(doc.paid, currency)} · Saldo {money(remaining, currency)}
          </div>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {!locked && (
            <>
              <button className="pill-btn" disabled={busy || !items.length} onClick={() => persist(false)}>
                Guardar borrador
              </button>
              <button className="pill-btn primary" disabled={busy || !items.length} onClick={() => persist(true)}>
                Confirmar
              </button>
            </>
          )}
          {doc?.status === 'confirmed' && (
            <button className="pill-btn primary" onClick={() => setPaying(true)}>
              Registrar pago
            </button>
          )}
          {doc && doc.status !== 'cancelled' && (
            <button
              className="pill-btn"
              disabled={busy}
              onClick={async () => {
                if (!confirm(`¿Cancelar esta ${meta.title.toLowerCase()}? El stock se revierte y el comprobante queda anulado.`)) return;
                setBusy(true);
                try {
                  const res = await meta.cancel(doc.id);
                  setDoc(res.data);
                } catch (err) {
                  setError(err.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Anular
            </button>
          )}
          {doc && (
            <button className="pill-btn danger" disabled={busy} onClick={() => setRemoving(true)}>
              Borrar
            </button>
          )}
        </div>
      </div>
      {kind === 'purchases' && (
        <AttachmentsPanel
          title="Factura y archivos"
          entityType="purchase"
          entityId={doc?.id}
          items={doc?.attachments || []}
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic,application/pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.pdf,.csv,.xls,.xlsx,.doc,.docx,.txt"
          helper={
            doc?.id
              ? 'Subí la factura, un ticket o cualquier archivo de la compra (foto o PDF, hasta 12 MB).'
              : 'Guardá la compra para poder adjuntar la factura.'
          }
          onChanged={load}
        />
      )}
      {!!doc?.payments?.length && (
        <section>
          <h2 className="mb-3 text-lg font-medium">Pagos de este comprobante</h2>
          <div className="overflow-x-auto rounded-xl border border-[#eadfe2]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Medio</th>
                  <th>Importe</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {doc.payments.map((row) => (
                  <tr key={row.id}>
                    <td>{ymd(row.paid_at)}</td>
                    <td>{METHODS[row.method] || row.method}</td>
                    <td>{money(row.amount, currency)}</td>
                    <td>{row.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {removing && (
        <ConfirmDangerModal
          title={`Borrar ${doc.number}`}
          message={
            doc.status === 'confirmed'
              ? `Se va a borrar ${doc.number} y se va a revertir el stock. También se eliminan los pagos de este comprobante.`
              : `Se va a borrar ${doc.number} y sus renglones.`
          }
          onClose={() => setRemoving(false)}
          onConfirm={async () => {
            await meta.remove(doc.id);
            navigate(meta.list);
          }}
        />
      )}
      {paying && (
        <PaymentModal
          title={`Pago de ${doc.number}`}
          remaining={remaining}
          onClose={() => setPaying(false)}
          onSave={async (body) => {
            await meta.pay(doc.id, body);
            setPaying(false);
            await load();
          }}
        />
      )}
    </div>
  );
}
