import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { api } from '../api';
import { money, qty, recipeQty, today, ymd } from '../format';
import { useStore } from '../store';

// Producción: qué hornear (según encargos y stock crítico) y registro de lo horneado.
export default function ProductionPage() {
  const { currency } = useStore();
  const [plan, setPlan] = useState([]);
  const [days, setDays] = useState(2);
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ productId: '', qty: '', producedAt: today() });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recipe, setRecipe] = useState(null);

  async function load(nextDays = days) {
    const [p, b, list] = await Promise.all([api.productionPlan(today(), nextDays), api.production(), api.products('?kind=product')]);
    setPlan(p.data);
    setBatches(b.data);
    setProducts(list.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  // Receta del producto elegido, para mostrar qué ingredientes se van a descontar
  useEffect(() => {
    setRecipe(null);
    if (!form.productId) return;
    let alive = true;
    api
      .product(form.productId)
      .then((res) => alive && setRecipe(res.data.recipe))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [form.productId]);
  const factor = recipe?.yield && Number(form.qty) > 0 ? Number(form.qty) / Number(recipe.yield) : 0;

  async function produce(productId, amount) {
    setBusy(true);
    setError('');
    try {
      const res = await api.produce({ productId, qty: Number(amount), producedAt: form.producedAt });
      const product = products.find((p) => p.id === Number(productId));
      let text = `Registrado: ${qty(amount)} ${product?.unit || ''} de ${product?.name || 'producto'}.`;
      if (!res.data.hasRecipe) text += ' Este producto no tiene receta: no se descontaron ingredientes.';
      if (res.data.negatives.length) text += ` Quedaron en negativo: ${res.data.negatives.join(', ')} (cargá su stock).`;
      setNotice(text);
      setForm((prev) => ({ ...prev, productId: '', qty: '' }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <h1 className="mb-1 text-2xl">Producción</h1>
      <p className="mb-4 max-w-2xl text-sm text-[#5a5155]">
        Registrá lo que horneaste: se suma al stock del producto y se descuentan los ingredientes de su receta.
      </p>
      {notice && <div className="notice mb-3">{notice}</div>}
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* Qué hornear */}
      <section className="mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="section-title m-0 mr-auto">Qué hornear</h2>
          <select
            className="pill-select"
            value={days}
            onChange={(e) => {
              setDays(Number(e.target.value));
              load(Number(e.target.value)).catch((err) => setError(err.message));
            }}
          >
            <option value={1}>Encargos de hoy</option>
            <option value={2}>Hoy y mañana</option>
            <option value={3}>Próximos 3 días</option>
            <option value={7}>Próxima semana</option>
          </select>
        </div>
        <div className="list-card">
          {plan.map((row) => (
            <div key={row.id} className="list-row">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{row.name}</div>
                <div className="text-xs text-[#6b6266]">
                  Hay {qty(row.stock_qty)}
                  {Number(row.ordered) > 0 && ` · encargos ${qty(row.ordered)}`}
                  {Number(row.min_stock) > 0 && ` · crítico ${qty(row.min_stock)}`}
                  {!row.recipe_count && ' · sin receta'}
                </div>
              </div>
              <span className="gold-pill">
                {row.to_make} {row.unit}
              </span>
              <button className="pill-btn primary" disabled={busy} onClick={() => produce(row.id, row.to_make)}>
                Horneé
              </button>
            </div>
          ))}
          {!plan.length && <div className="list-empty">No hace falta hornear nada: alcanza para los encargos y el stock crítico.</div>}
        </div>
      </section>

      {/* Registro manual de una tanda */}
      <section className="mb-6">
        <h2 className="section-title">Registrar producción</h2>
        <form
          className="list-card grid gap-3 p-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (form.productId && Number(form.qty) > 0) produce(form.productId, form.qty);
          }}
        >
          <label className="field">
            <span>Producto</span>
            <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required>
              <option value="">Elegí…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Cantidad</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={form.qty}
              onChange={(e) => setForm({ ...form, qty: e.target.value })}
              required
            />
          </label>
          <label className="field">
            <span>Fecha</span>
            <input type="date" value={form.producedAt} onChange={(e) => setForm({ ...form, producedAt: e.target.value })} />
          </label>
          <button className="pill-btn primary" type="submit" disabled={busy}>
            Registrar
          </button>
          {form.productId && recipe && (
            <div className="text-sm text-[#5a5155] sm:col-span-4">
              {!recipe.items.length ? (
                <>
                  Este producto no tiene receta: no se va a descontar ningún ingrediente.{' '}
                  <Link className="text-link" to={`/recetas/${form.productId}`}>
                    Cargar receta
                  </Link>
                </>
              ) : factor > 0 ? (
                <>
                  Se descuenta ({qty(factor)} tanda{factor === 1 ? '' : 's'} de {qty(recipe.yield)}):{' '}
                  {recipe.items
                    .map((item) => `${item.name} ${recipeQty(Number(item.qty) * factor, item.unit)}`)
                    .join(' · ')}
                  .{' '}
                  <Link className="text-link" to={`/recetas/${form.productId}`}>
                    Ver receta
                  </Link>
                </>
              ) : (
                <>Receta: rinde {qty(recipe.yield)} por tanda. Poné la cantidad para ver qué se descuenta.</>
              )}
            </div>
          )}
        </form>
      </section>

      {/* Historial */}
      <section>
        <h2 className="section-title">Últimas producciones</h2>
        <div className="list-card">
          {batches.map((row) => (
            <div key={row.id} className="list-row">
              <div className="min-w-0 flex-1">
                <Link className="text-link" to={`/productos/${row.product_id}`}>
                  {row.product_name}
                </Link>
                <div className="text-xs text-[#6b6266]">
                  {ymd(row.produced_at)} · costo {money(row.unit_cost, currency)} c/u
                </div>
              </div>
              <span className="font-medium">
                {qty(row.qty)} {row.unit}
              </span>
              <button
                className="icon-btn h-8 w-8 text-[#a39a9d]"
                title="Borrar (revierte el stock)"
                onClick={async () => {
                  if (!confirm('¿Borrar esta producción? Se revierte el stock del producto y de los ingredientes.')) return;
                  try {
                    await api.deleteProduction(row.id);
                    await load();
                  } catch (err) {
                    setError(err.message);
                  }
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {!batches.length && <div className="list-empty">Todavía no registraste producción.</div>}
        </div>
      </section>
    </div>
  );
}
