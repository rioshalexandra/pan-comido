import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { dateText, money, todayIso } from '../lib/format';
import { INPUT_UNITS, fromBase, niceUnit, qtyText, toBase } from '../lib/units';
import { Modal } from '../components/ui';

export const METHOD_LABELS = { efectivo: '💵 Efectivo', transferencia: '🏦 Transferencia' };
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const parse = (v) => Number(String(v || '').replace(',', '.')) || 0;

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Compras y pagos: lo que compraste en el mes, lo que pagaste (efectivo o transferencia) y lo que debés
export default function PurchasesSection({ purchases, onNewPurchase, onChanged }) {
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [paying, setPaying] = useState(null);
  const [open, setOpen] = useState(null);

  const summary = useMemo(() => {
    const inMonth = purchases.filter((p) => p.purchased_at.startsWith(month));
    const payments = purchases.flatMap((p) => p.payments).filter((x) => x.paid_at.startsWith(month));
    const byMethod = (m) => payments.filter((x) => x.method === m).reduce((s, x) => s + x.amount, 0);
    return {
      inMonth,
      bought: inMonth.reduce((s, p) => s + p.total, 0),
      cash: byMethod('efectivo'),
      transfer: byMethod('transferencia'),
      owed: purchases.reduce((s, p) => s + p.balance, 0),
    };
  }, [purchases, month]);

  const [y, m] = month.split('-').map(Number);

  async function remove(p) {
    if (!confirm(`¿Borrar la compra de ${money(p.total)} a ${p.supplier_name}? Se saca del stock lo que había sumado.`)) return;
    await api.del(`/api/purchases/${p.id}`);
    onChanged();
  }

  async function removePayment(x) {
    if (!confirm(`¿Borrar el pago de ${money(x.amount)}?`)) return;
    await api.del(`/api/payments/${x.id}`);
    onChanged();
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <div className="section-title">Compras y pagos</div>
        <button className="btn btn-sm btn-primary" onClick={() => onNewPurchase({})}>
          + Cargar compra
        </button>
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <button className="btn btn-sm" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mes anterior">
            ‹
          </button>
          <div className="font-bold capitalize">
            {MONTHS[m - 1]} {y}
          </div>
          <button className="btn btn-sm" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Mes siguiente">
            ›
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-cream px-3 py-2.5">
            <div className="text-xs font-semibold text-cocoa-soft">🛒 Compraste</div>
            <div className="text-lg font-extrabold">{money(summary.bought)}</div>
          </div>
          <div className="rounded-xl bg-cream px-3 py-2.5">
            <div className="text-xs font-semibold text-cocoa-soft">✅ Pagaste</div>
            <div className="text-lg font-extrabold text-good">{money(summary.cash + summary.transfer)}</div>
            <div className="text-[11px] text-cocoa-soft">
              💵 {money(summary.cash)} · 🏦 {money(summary.transfer)}
            </div>
          </div>
        </div>
        <div className={`mt-2 rounded-xl px-3 py-2.5 ${summary.owed > 0.5 ? 'bg-bad/5' : 'bg-good/10'}`}>
          <div className="text-xs font-semibold text-cocoa-soft">Debés a proveedores (todo lo que falta pagar)</div>
          <div className={`text-lg font-extrabold ${summary.owed > 0.5 ? 'text-bad' : 'text-good'}`}>{summary.owed > 0.5 ? money(summary.owed) : 'No debés nada 🎉'}</div>
        </div>
      </div>

      {summary.inMonth.length > 0 ? (
        <div className="card mt-3 divide-y divide-line">
          {summary.inMonth.map((p) => (
            <div key={p.id} className="px-4 py-3">
              <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen(open === p.id ? null : p.id)}>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{p.supplier_name}</span>
                  <span className="block truncate text-xs text-cocoa-soft">
                    {dateText(p.purchased_at)} · {p.items.map((i) => i.name).join(', ')}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-bold">{money(p.total)}</span>
                  {p.balance > 0.5 ? (
                    <span className="chip bg-bad/10 text-bad">debés {money(p.balance)}</span>
                  ) : (
                    <span className="chip bg-good/10 text-good">pagada</span>
                  )}
                </span>
              </button>
              {open === p.id && (
                <div className="mt-3 flex flex-col gap-2 rounded-xl bg-cream p-3 text-sm">
                  {p.items.map((i) => (
                    <div key={i.id} className="flex justify-between gap-2">
                      <span>
                        {i.packs} × {qtyText(i.pack_qty, i.unit)} {i.name}
                      </span>
                      <span className="font-semibold">{money(i.subtotal)}</span>
                    </div>
                  ))}
                  {p.notes && <div className="text-cocoa-soft">📝 {p.notes}</div>}
                  {p.payments.length > 0 && (
                    <div className="border-t border-line pt-2">
                      {p.payments.map((x) => (
                        <div key={x.id} className="flex items-center justify-between gap-2">
                          <span>
                            {METHOD_LABELS[x.method]} · {dateText(x.paid_at)}
                          </span>
                          <span className="flex items-center gap-2">
                            <strong className="text-good">{money(x.amount)}</strong>
                            <button className="text-xs text-bad underline" onClick={() => removePayment(x)}>
                              borrar
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-1 flex flex-wrap gap-2">
                    {p.balance > 0.5 && (
                      <button className="btn btn-sm btn-primary" onClick={() => setPaying(p)}>
                        💸 Registrar pago
                      </button>
                    )}
                    <button className="btn btn-sm btn-danger" onClick={() => remove(p)}>
                      🗑 Borrar compra
                    </button>
                  </div>
                </div>
              )}
              {open !== p.id && p.balance > 0.5 && (
                <button className="btn btn-sm mt-2" onClick={() => setPaying(p)}>
                  💸 Registrar pago
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-cocoa-soft">No cargaste compras en este mes.</p>
      )}

      {/* Compras de otros meses que todavía se deben */}
      {purchases.some((p) => p.balance > 0.5 && !p.purchased_at.startsWith(month)) && (
        <div className="card mt-3 p-4">
          <div className="mb-2 text-sm font-bold">Deudas de otros meses</div>
          {purchases
            .filter((p) => p.balance > 0.5 && !p.purchased_at.startsWith(month))
            .map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                <span>
                  {p.supplier_name} · {dateText(p.purchased_at)}
                </span>
                <button className="btn btn-sm" onClick={() => setPaying(p)}>
                  Pagar {money(p.balance)}
                </button>
              </div>
            ))}
        </div>
      )}

      {paying && (
        <PaymentModal
          purchase={paying}
          onClose={() => setPaying(null)}
          onSaved={() => {
            setPaying(null);
            onChanged();
          }}
        />
      )}
    </section>
  );
}

function MethodPicker({ value, onChange, allowLater }) {
  const options = [...(allowLater ? [['', '⏳ Después']] : []), ...Object.entries(METHOD_LABELS)];
  return (
    <div className={`grid gap-2 ${allowLater ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {options.map(([key, label]) => (
        <button
          type="button"
          key={key}
          className={`btn btn-sm ${value === key ? 'btn-primary' : ''}`}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function PaymentModal({ purchase, onClose, onSaved }) {
  const [amount, setAmount] = useState(String(Math.round(purchase.balance * 100) / 100));
  const [method, setMethod] = useState('efectivo');
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState('');

  async function save(e) {
    e.preventDefault();
    try {
      await api.post(`/api/purchases/${purchase.id}/payments`, { amount: parse(amount), method, paid_at: date });
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title={`Pago a ${purchase.supplier_name}`} onClose={onClose}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <p className="text-sm text-cocoa-soft">
          Compra del {dateText(purchase.purchased_at)} por {money(purchase.total)} · falta pagar <strong className="text-bad">{money(purchase.balance)}</strong>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            Cuánto pagaste
            <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </label>
          <label className="field">
            Fecha
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <div className="field">
          Cómo pagaste
          <MethodPicker value={method} onChange={setMethod} />
        </div>
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary">Guardar pago</button>
      </form>
    </Modal>
  );
}

const newLine = (ing, packs = '1') => {
  const unit = ing ? niceUnit(ing.pack_qty, ing.unit) : 'kg';
  return {
    key: Math.random(),
    ingredient_id: ing ? String(ing.id) : '',
    packs,
    pack_qty: ing ? String(fromBase(ing.pack_qty, unit, ing.unit)) : '',
    pack_unit: unit,
    pack_price: ing ? String(ing.pack_price) : '',
  };
};

// Cargar una compra: qué productos, cuánto trae cada paquete y a qué precio. Suma al stock.
export function PurchaseModal({ preset, suppliers, ingredients, onClose, onSaved }) {
  const [supplierId, setSupplierId] = useState(preset.supplier_id ? String(preset.supplier_id) : '');
  const [date, setDate] = useState(todayIso());
  const [lines, setLines] = useState(() => (preset.lines?.length ? preset.lines.map((l) => newLine(l.ing, l.packs)) : [newLine(null)]));
  const [payMethod, setPayMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const byId = (id) => ingredients.find((i) => String(i.id) === String(id));
  // Primero los ingredientes de este proveedor
  const sorted = useMemo(
    () => [...ingredients].sort((a, b) => (String(b.supplier_id) === supplierId) - (String(a.supplier_id) === supplierId)),
    [ingredients, supplierId]
  );
  const setLine = (key, patch) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const total = lines.reduce((s, l) => s + parse(l.packs) * parse(l.pack_price), 0);

  async function save(e) {
    e.preventDefault();
    setError('');
    const items = lines
      .filter((l) => l.ingredient_id)
      .map((l) => {
        const ing = byId(l.ingredient_id);
        return { ingredient_id: Number(l.ingredient_id), packs: parse(l.packs), pack_qty: toBase(parse(l.pack_qty), l.pack_unit, ing.unit), pack_price: parse(l.pack_price) };
      });
    try {
      await api.post('/api/purchases', { supplier_id: supplierId || null, purchased_at: date, items, pay_method: payMethod || null, notes });
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title="Cargar compra" onClose={onClose}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            Proveedor
            <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Sin proveedor</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Fecha
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>

        <div className="flex flex-col gap-3">
          {lines.map((l) => {
            const ing = byId(l.ingredient_id);
            return (
              <div key={l.key} className="flex flex-col gap-2 rounded-xl bg-cream p-3">
                <div className="flex gap-2">
                  <select
                    className="input flex-1"
                    value={l.ingredient_id}
                    onChange={(e) => {
                      const next = byId(e.target.value);
                      setLine(l.key, next ? { ...newLine(next, l.packs), key: l.key } : { ingredient_id: '' });
                    }}
                    aria-label="Producto"
                  >
                    <option value="">Elegí el producto…</option>
                    {sorted.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                  {lines.length > 1 && (
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))} aria-label="Sacar">
                      ✕
                    </button>
                  )}
                </div>
                {ing && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="field">
                        Paquetes
                        <input className="input text-center" inputMode="decimal" value={l.packs} onChange={(e) => setLine(l.key, { packs: e.target.value })} />
                      </label>
                      <label className="field">
                        Trae c/u
                        <input className="input text-center" inputMode="decimal" value={l.pack_qty} onChange={(e) => setLine(l.key, { pack_qty: e.target.value })} />
                      </label>
                      <label className="field">
                        Unidad
                        <select className="input" value={l.pack_unit} onChange={(e) => setLine(l.key, { pack_unit: e.target.value })}>
                          {INPUT_UNITS[ing.unit].map((u) => (
                            <option key={u.value} value={u.value}>
                              {u.value}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="field">
                      Precio de cada paquete
                      <input className="input" inputMode="decimal" value={l.pack_price} onChange={(e) => setLine(l.key, { pack_price: e.target.value })} />
                    </label>
                    <div className="text-xs text-cocoa-soft">
                      Suma {qtyText(parse(l.packs) * toBase(parse(l.pack_qty), l.pack_unit, ing.unit), ing.unit)} al stock · {money(parse(l.packs) * parse(l.pack_price))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
          <button type="button" className="btn btn-sm" onClick={() => setLines((prev) => [...prev, newLine(null)])}>
            + Otro producto
          </button>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-gold-soft/60 px-4 py-3">
          <span className="font-semibold">Total de la compra</span>
          <strong className="text-xl">{money(total)}</strong>
        </div>

        <div className="field">
          ¿La pagaste?
          <MethodPicker value={payMethod} onChange={setPayMethod} allowLater />
          <span className="label-hint">Si pagás después (o una parte), lo cargás con "Registrar pago".</span>
        </div>

        <label className="field">
          Notas
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: factura 0001-234" />
        </label>

        <p className="text-xs text-cocoa-soft">Si cambió el precio de algún producto, se actualiza solo y tus recetas ya usan el precio nuevo.</p>
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary">Guardar compra</button>
      </form>
    </Modal>
  );
}
