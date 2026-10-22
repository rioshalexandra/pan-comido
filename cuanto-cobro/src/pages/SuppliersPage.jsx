import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useData } from '../lib/useData';
import { useStore } from '../store';
import { money, whatsappLink } from '../lib/format';
import { qtyText } from '../lib/units';
import { Header, Loading, Modal } from '../components/ui';
import PurchasesSection, { PurchaseModal } from './PurchasesSection';

// Proveedores y pedido: junta lo que llegó al mínimo, agrupado por proveedor,
// y arma el mensaje de WhatsApp. Abajo, las compras (suman al stock) y los pagos.
export default function SuppliersPage() {
  const { settings, user } = useStore();
  const { data: suppliers, reload, error } = useData('/api/suppliers');
  const { data: ingredients, reload: reloadIngredients } = useData('/api/ingredients');
  const { data: purchases, reload: reloadPurchases } = useData('/api/purchases');
  const [buying, setBuying] = useState(null);
  const [lines, setLines] = useState({});
  const [editing, setEditing] = useState(null);
  const [copied, setCopied] = useState('');

  const low = useMemo(() => (ingredients || []).filter((i) => i.min_stock > 0 && i.stock_qty <= i.min_stock), [ingredients]);

  // Sugerencia: paquetes para llegar al doble del mínimo
  useEffect(() => {
    const initial = {};
    for (const i of low) initial[i.id] = { checked: true, packs: String(Math.max(1, Math.ceil((i.min_stock * 2 - i.stock_qty) / i.pack_qty))) };
    setLines(initial);
  }, [low]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const i of low) {
      const key = i.supplier_id || 0;
      if (!map.has(key)) map.set(key, { key, name: i.supplier_name || 'Sin proveedor asignado', phone: i.supplier_phone, rows: [] });
      map.get(key).rows.push(i);
    }
    return [...map.values()].sort((a, b) => (a.key === 0) - (b.key === 0));
  }, [low]);

  function message(group) {
    const items = group.rows
      .filter((i) => lines[i.id]?.checked && Number(lines[i.id]?.packs) > 0)
      .map((i) => `• ${lines[i.id].packs} × ${qtyText(i.pack_qty, i.unit)} — ${i.name}`);
    return `Hola! Te paso el pedido de ${settings.business_name || user.name}:\n${items.join('\n')}\nGracias!`;
  }

  async function copy(group) {
    try {
      await navigator.clipboard.writeText(message(group));
      setCopied(group.key);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      alert(message(group));
    }
  }

  async function remove(s) {
    if (!confirm(`¿Borrar a ${s.name}? Sus ingredientes quedan sin proveedor.`)) return;
    try {
      await api.del(`/api/suppliers/${s.id}`);
      reload();
    } catch (err) {
      alert(err.message);
    }
  }

  if (!suppliers || !ingredients || !purchases) return <Loading error={error} />;

  const debtOf = (id) => purchases.filter((p) => p.supplier_id === id).reduce((sum, p) => sum + p.balance, 0);
  // Lo que llegó del pedido se carga como compra con lo tildado
  const fromOrder = (group) => ({
    supplier_id: group.key || null,
    lines: group.rows.filter((i) => lines[i.id]?.checked && Number(lines[i.id]?.packs) > 0).map((i) => ({ ing: i, packs: lines[i.id].packs })),
  });

  return (
    <div className="flex flex-col gap-5">
      <Header title="Proveedores y compras" subtitle="Lo que hay que pedir, lo que compraste y lo que debés." />

      <section>
        <div className="section-title mb-2">Pedido de hoy</div>
        {!groups.length ? (
          <div className="card p-4 text-sm text-cocoa-soft">
            No falta nada. Cuando un ingrediente llegue a su mínimo (lo ponés en "Avisarme cuando quede menos de"), aparece acá.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <div key={group.key} className="card p-4">
                <div className="mb-2 font-bold">🚚 {group.name}</div>
                <div className="flex flex-col gap-2">
                  {group.rows.map((i) => (
                    <label key={i.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-gold"
                        checked={lines[i.id]?.checked ?? true}
                        onChange={(e) => setLines((p) => ({ ...p, [i.id]: { ...p[i.id], checked: e.target.checked } }))}
                      />
                      <span className="min-w-0 flex-1">
                        <strong>{i.name}</strong>
                        <span className="block text-xs text-cocoa-soft">
                          Tenés {qtyText(i.stock_qty, i.unit)} · paquete de {qtyText(i.pack_qty, i.unit)} a {money(i.pack_price)}
                        </span>
                      </span>
                      <input
                        className="input w-16 text-center"
                        inputMode="numeric"
                        value={lines[i.id]?.packs ?? ''}
                        onChange={(e) => setLines((p) => ({ ...p, [i.id]: { ...p[i.id], packs: e.target.value } }))}
                        aria-label={`Paquetes de ${i.name}`}
                      />
                      <span className="text-xs text-cocoa-soft">paq.</span>
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a className="btn btn-sm btn-primary" href={whatsappLink(group.phone, message(group))} target="_blank" rel="noreferrer">
                    💬 Enviar por WhatsApp
                  </a>
                  <button className="btn btn-sm" onClick={() => copy(group)}>
                    {copied === group.key ? '¡Copiado!' : 'Copiar pedido'}
                  </button>
                  <button className="btn btn-sm" onClick={() => setBuying(fromOrder(group))}>
                    📦 Llegó: cargar compra
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <PurchasesSection
        purchases={purchases}
        onNewPurchase={setBuying}
        onChanged={() => {
          reloadPurchases();
          reloadIngredients();
        }}
      />

      <section>
        <div className="mb-2 flex items-center justify-between">
          <div className="section-title">Mis proveedores</div>
          <button className="btn btn-sm btn-primary" onClick={() => setEditing({})}>
            + Nuevo
          </button>
        </div>
        {!suppliers.length ? (
          <p className="text-sm text-cocoa-soft">Todavía no cargaste proveedores.</p>
        ) : (
          <div className="card divide-y divide-line">
            {suppliers.map((s) => {
              const count = ingredients.filter((i) => i.supplier_id === s.id).length;
              const debt = debtOf(s.id);
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{s.name}</div>
                    <div className="text-xs text-cocoa-soft">
                      {s.phone || 'sin teléfono'} · {count} ingrediente{count === 1 ? '' : 's'}
                      {s.notes ? ` · ${s.notes}` : ''}
                    </div>
                    {debt > 0.5 && <div className="text-xs font-bold text-bad">Le debés {money(debt)}</div>}
                  </div>
                  {s.phone && (
                    <a className="btn btn-sm" href={whatsappLink(s.phone, 'Hola! ')} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                      💬
                    </a>
                  )}
                  <button className="btn btn-sm" onClick={() => setEditing(s)}>
                    Editar
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => remove(s)} aria-label="Borrar">
                    🗑
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {buying && (
        <PurchaseModal
          preset={buying}
          suppliers={suppliers}
          ingredients={ingredients}
          onClose={() => setBuying(null)}
          onSaved={() => {
            setBuying(null);
            reloadPurchases();
            reloadIngredients();
          }}
        />
      )}

      {editing && (
        <SupplierModal
          supplier={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function SupplierModal({ supplier, onClose, onSaved }) {
  const [f, setF] = useState({ name: supplier.name || '', phone: supplier.phone || '', notes: supplier.notes || '' });
  const [error, setError] = useState('');
  async function save(e) {
    e.preventDefault();
    try {
      if (supplier.id) await api.put(`/api/suppliers/${supplier.id}`, f);
      else await api.post('/api/suppliers', f);
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <Modal title={supplier.id ? 'Editar proveedor' : 'Nuevo proveedor'} onClose={onClose}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <label className="field">
          Nombre
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
        </label>
        <label className="field">
          WhatsApp
          <input className="input" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="Ej: 11 2345 6789" />
        </label>
        <label className="field">
          Notas
          <input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Ej: entrega martes y jueves" />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary">Guardar</button>
      </form>
    </Modal>
  );
}
