import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useData } from '../lib/useData';
import { useStore } from '../store';
import { recipeCosts } from '../lib/costs';
import { money } from '../lib/format';
import { costLabel, qtyText, unitCost } from '../lib/units';
import IngredientForm from '../components/IngredientForm';
import { Empty, Header, Loading, Modal } from '../components/ui';

const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'low', label: 'Para pedir' },
  { value: 'pack', label: 'Packaging' },
];

export default function IngredientsPage() {
  const { settings } = useStore();
  const { data, setData, error } = useData('/api/ingredients');
  const { data: suppliers } = useData('/api/suppliers');
  const { data: recipes, reload: reloadRecipes } = useData('/api/recipes');
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [buying, setBuying] = useState(null);
  const [impact, setImpact] = useState(null);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data || []).filter((i) => {
      if (term && !i.name.toLowerCase().includes(term)) return false;
      if (filter === 'low') return i.min_stock > 0 && i.stock_qty <= i.min_stock;
      if (filter === 'pack') return i.is_packaging;
      return true;
    });
  }, [data, filter, q]);

  function saved(ing) {
    setData((prev) => {
      const exists = prev.some((i) => i.id === ing.id);
      const list = exists ? prev.map((i) => (i.id === ing.id ? ing : i)) : [...prev, ing];
      return list.sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  // Cuando cambia el precio, muestra cómo quedan las recetas que lo usan
  function showImpact(before, after) {
    if (Math.abs(unitCost(before) - unitCost(after)) < 1e-9 || !recipes) return;
    const affected = recipes
      .filter((r) => r.items.some((i) => i.ingredient_id === after.id))
      .map((r) => {
        const old = recipeCosts(r, settings);
        const items = r.items.map((i) => (i.ingredient_id === after.id ? { ...i, pack_qty: after.pack_qty, pack_price: after.pack_price } : i));
        const now = recipeCosts({ ...r, items }, settings);
        return { recipe: r, old, now };
      });
    const pct = unitCost(before) > 0 ? Math.round(((unitCost(after) - unitCost(before)) / unitCost(before)) * 100) : null;
    setImpact({ ingredient: after, pct, affected });
    reloadRecipes();
  }

  async function remove(ing) {
    if (!confirm(`¿Borrar "${ing.name}"?`)) return;
    try {
      await api.del(`/api/ingredients/${ing.id}`);
      setData((prev) => prev.filter((i) => i.id !== ing.id));
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      <Header title="Ingredientes" subtitle="Cargalos como los comprás. La app calcula el costo por gramo.">
        <button className="btn btn-primary" onClick={() => setEditing({})}>
          + Nuevo
        </button>
      </Header>

      {!data ? (
        <Loading error={error} />
      ) : !data.length ? (
        <Empty icon="🧈" title="Todavía no hay ingredientes">
          Empezá por los que más usás: harina, manteca, azúcar, huevos… y el packaging.
        </Empty>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <input className="input max-w-xs flex-1" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="flex gap-1">
              {FILTERS.map((f) => (
                <button key={f.value} className={`btn btn-sm ${filter === f.value ? 'btn-primary' : ''}`} onClick={() => setFilter(f.value)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {rows.map((ing) => (
              <div key={ing.id} className="card flex flex-col p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-bold">
                      {ing.name}
                      {ing.is_packaging ? <span className="ml-1 text-xs font-normal text-cocoa-soft">packaging</span> : null}
                    </div>
                    <div className="text-sm text-cocoa-soft">{costLabel(ing, money)}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-bold">{qtyText(ing.stock_qty, ing.unit)}</div>
                    <div className="text-xs text-cocoa-soft">en stock</div>
                  </div>
                </div>
                <StockBar ing={ing} />
                <div className="mt-2 text-xs text-cocoa-soft">
                  {ing.supplier_name ? `Proveedor: ${ing.supplier_name}` : 'Sin proveedor'} · en {ing.recipe_count} receta{ing.recipe_count === 1 ? '' : 's'}
                </div>
                <div className="mt-3 flex gap-2">
                  <button className="btn btn-sm btn-primary flex-1" onClick={() => setBuying(ing)}>
                    🛒 Compré
                  </button>
                  <button className="btn btn-sm" onClick={() => setEditing(ing)}>
                    Editar
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => remove(ing)} aria-label={`Borrar ${ing.name}`}>
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {editing && (
        <Modal title={editing.id ? 'Editar ingrediente' : 'Nuevo ingrediente'} onClose={() => setEditing(null)}>
          <IngredientForm
            ingredient={editing.id ? editing : null}
            suppliers={suppliers || []}
            onCancel={() => setEditing(null)}
            onSaved={(ing) => {
              saved(ing);
              if (editing.id) showImpact(editing, ing);
              setEditing(null);
            }}
          />
        </Modal>
      )}

      {buying && (
        <PurchaseModal
          ing={buying}
          onClose={() => setBuying(null)}
          onSaved={(ing) => {
            saved(ing);
            showImpact(buying, ing);
            setBuying(null);
          }}
        />
      )}

      {impact && (
        <Modal title={`Cambió el precio de ${impact.ingredient.name}`} onClose={() => setImpact(null)}>
          {impact.pct != null && (
            <p className="mb-3">
              {impact.pct > 0 ? `Subió ${impact.pct}%` : `Bajó ${Math.abs(impact.pct)}%`}. Ahora: <strong>{costLabel(impact.ingredient, money)}</strong>.
            </p>
          )}
          {!impact.affected.length ? (
            <p className="text-cocoa-soft">No se usa en ninguna receta todavía.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-cocoa-soft">Así quedan las recetas que lo usan:</p>
              {impact.affected.map(({ recipe, old, now }) => {
                const low = now.price > 0 && now.suggested > now.price;
                return (
                  <Link key={recipe.id} to={`/recetas/${recipe.id}`} className="rounded-xl bg-cream p-3">
                    <div className="font-bold">
                      {recipe.emoji} {recipe.name}
                    </div>
                    <div className="text-sm">
                      Costo c/u {money(old.fullUnit)} → <strong>{money(now.fullUnit)}</strong>
                      {now.realMargin != null && ` · margen real ${old.realMargin}% → ${now.realMargin}%`}
                    </div>
                    {low && (
                      <div className="text-sm font-bold text-gold-dark">
                        Vendés a {money(now.price)}: te sugiero subir a {money(now.suggested)}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
          <button className="btn btn-primary mt-4 w-full" onClick={() => setImpact(null)}>
            Entendido
          </button>
        </Modal>
      )}
    </div>
  );
}

// Barra de stock: rojo si hay que pedir, amarillo si queda poco, verde si sobra
function StockBar({ ing }) {
  const min = Number(ing.min_stock || 0);
  if (!(min > 0)) return null;
  const stock = Number(ing.stock_qty || 0);
  const pct = Math.max(3, Math.min(100, (stock / (min * 2.5)) * 100));
  const tone = stock <= min ? 'bg-bad' : stock <= min * 1.5 ? 'bg-amber-400' : 'bg-good';
  const label = stock <= min ? 'Hay que pedir' : stock <= min * 1.5 ? 'Queda poco' : 'Bien de stock';
  return (
    <div className="mt-3">
      <div className="h-2 overflow-hidden rounded-full bg-line">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-[11px] text-cocoa-soft">
        {label} · aviso con menos de {qtyText(min, ing.unit)}
      </div>
    </div>
  );
}

function PurchaseModal({ ing, onClose, onSaved }) {
  const [packs, setPacks] = useState('1');
  const [price, setPrice] = useState(String(ing.pack_price));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const parse = (v) => Number(String(v || '').replace(',', '.')) || 0;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post(`/api/ingredients/${ing.id}/purchase`, { packs: parse(packs), pack_price: parse(price) });
      onSaved(res.data);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={`Compré ${ing.name}`} onClose={onClose}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            Paquetes de {qtyText(ing.pack_qty, ing.unit)}
            <input className="input" inputMode="decimal" value={packs} onChange={(e) => setPacks(e.target.value)} autoFocus />
          </label>
          <label className="field">
            Precio de cada paquete
            <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
        </div>
        <p className="text-sm text-cocoa-soft">
          Se suman {qtyText(parse(packs) * ing.pack_qty, ing.unit)} al stock · total {money(parse(packs) * parse(price))}
          {parse(price) !== Number(ing.pack_price) && ' · se actualiza el precio y el costo de tus recetas'}
        </p>
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary" disabled={busy}>
          Guardar compra
        </button>
      </form>
    </Modal>
  );
}
