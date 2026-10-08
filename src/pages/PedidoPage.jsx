import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardCopy, MessageCircle, PackageCheck } from 'lucide-react';
import { api } from '../api';
import { money, qty, whatsappLink } from '../format';
import { useStore } from '../store';

// Pedido a proveedores: junta los productos que llegaron a su stock crítico,
// agrupados por proveedor habitual. Desde acá se manda el pedido por WhatsApp
// o se crea la compra (en borrador) para confirmarla cuando llega la mercadería.
export default function PedidoPage() {
  const { currency, settings } = useStore();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  // Por producto: si va en el pedido y qué cantidad (editable)
  const [lines, setLines] = useState({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.reorderList(), api.suppliers()])
      .then(([r, s]) => {
        setRows(r.data);
        setSuppliers(s.data);
        const initial = {};
        for (const row of r.data) initial[row.id] = { checked: true, qty: String(row.suggested_qty) };
        setLines(initial);
      })
      .catch((err) => setError(err.message));
  }, []);

  // Agrupar por proveedor habitual (los que no tienen proveedor van al final)
  const groups = useMemo(() => {
    const map = new Map();
    for (const row of rows || []) {
      const key = row.supplier_id || 0;
      if (!map.has(key)) map.set(key, { supplierId: row.supplier_id, name: row.supplier_name || 'Sin proveedor asignado', rows: [] });
      map.get(key).rows.push(row);
    }
    return [...map.values()];
  }, [rows]);

  function setLine(id, patch) {
    setLines((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  // Ítems marcados de un grupo, con cantidad mayor a cero
  function picked(group) {
    return group.rows
      .filter((row) => lines[row.id]?.checked && Number(lines[row.id]?.qty) > 0)
      .map((row) => ({ row, qty: Number(lines[row.id].qty) }));
  }

  function orderText(group) {
    const items = picked(group).map(({ row, qty: q }) => `• ${qty(q)} ${row.unit} — ${row.name}`);
    return `Hola! Te paso el pedido de ${settings?.name || 'Pan Comido'}:\n${items.join('\n')}\nGracias!`;
  }

  async function copy(group) {
    try {
      await navigator.clipboard.writeText(orderText(group));
      flash('Pedido copiado: pegalo en un mensaje o mail.');
    } catch {
      setError('No se pudo copiar. Probá con el botón de WhatsApp.');
    }
  }

  async function createPurchase(group) {
    const items = picked(group);
    if (!items.length) return;
    try {
      const res = await api.savePurchase(null, {
        supplierId: group.supplierId || null,
        notes: 'Pedido por stock crítico',
        items: items.map(({ row, qty: q }) => ({ productId: row.id, qty: q, unitCost: Number(row.cost_price) })),
      });
      navigate(`/compras/${res.data.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  function flash(text) {
    setNotice(text);
    setTimeout(() => setNotice(''), 3000);
  }

  if (!rows && !error) return <div className="page text-[#6b6266]">Cargando…</div>;

  return (
    <div className="page">
      <h1 className="text-2xl">Pedido</h1>
      <p className="mb-4 max-w-2xl text-sm text-[#5a5155]">
        Acá aparecen solos los ingredientes (y productos que comprás hechos) que llegaron a su <strong>stock crítico</strong>.
        Ajustá las cantidades, mandá el pedido al proveedor y, cuando llegue la mercadería, confirmá la compra para que se
        sume al stock.
      </p>
      {notice && <div className="notice mb-3">{notice}</div>}
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {rows && !rows.length && (
        <div className="card-tile mx-auto max-w-md cursor-default text-center">
          <PackageCheck size={36} className="mx-auto mb-2 text-[#137333]" />
          <div className="font-medium">No hay nada para pedir</div>
          <div className="mt-1 text-sm text-[#6b6266]">
            Todos los ingredientes están por encima de su stock crítico. Podés ajustar el crítico de cada uno en{' '}
            <Link className="text-link" to="/ingredientes">
              Ingredientes
            </Link>
            .
          </div>
        </div>
      )}

      <div className="grid gap-5">
        {groups.map((group) => {
          const items = picked(group);
          const total = items.reduce((sum, { row, qty: q }) => sum + q * Number(row.cost_price || 0), 0);
          const supplier = suppliers.find((s) => s.id === group.supplierId);
          const wa = items.length ? whatsappLink(supplier?.phone, orderText(group)) : null;
          return (
            <section key={group.supplierId || 0}>
              <h2 className="section-title">{group.name}</h2>
              <div className="list-card">
                {group.rows.map((row) => {
                  const line = lines[row.id] || {};
                  return (
                    <label key={row.id} className="list-row cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-5 w-5 shrink-0 accent-[#1c1a1b]"
                        checked={Boolean(line.checked)}
                        onChange={(e) => setLine(row.id, { checked: e.target.checked })}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{row.name}</div>
                        <div className="text-xs text-[#6b6266]">
                          Hay {qty(row.stock_qty)} · crítico {qty(row.min_stock)}
                        </div>
                      </div>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        className="w-20 rounded-lg border border-[#eadfe2] px-2 py-2 text-right text-base"
                        value={line.qty || ''}
                        onChange={(e) => setLine(row.id, { qty: e.target.value, checked: true })}
                        aria-label={`Cantidad a pedir de ${row.name}`}
                      />
                      <span className="w-8 text-xs text-[#6b6266]">{row.unit}</span>
                    </label>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="mr-auto text-sm text-[#5a5155]">
                  {items.length} producto{items.length === 1 ? '' : 's'}
                  {total > 0 && ` · aprox. ${money(total, currency)} a costo`}
                </span>
                {wa ? (
                  <a className="pill-btn inline-flex items-center gap-1 no-underline" href={wa} target="_blank" rel="noreferrer">
                    <MessageCircle size={15} /> Enviar por WhatsApp
                  </a>
                ) : null}
                <button className="pill-btn inline-flex items-center gap-1" disabled={!items.length} onClick={() => copy(group)}>
                  <ClipboardCopy size={15} /> Copiar
                </button>
                <button className="pill-btn primary" disabled={!items.length} onClick={() => createPurchase(group)}>
                  Crear compra
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
