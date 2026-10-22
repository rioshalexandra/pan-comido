import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useData } from '../lib/useData';
import { dateText, money, todayIso } from '../lib/format';
import { number, qtyText, unitCost } from '../lib/units';
import { Empty, Header, Loading } from '../components/ui';

// Producción: lo que se hizo. Descuenta los ingredientes del stock según las tandas.
export default function ProductionPage() {
  const location = useLocation();
  const { data: recipes, error } = useData('/api/recipes');
  const { data: history, reload } = useData('/api/production');
  const [recipeId, setRecipeId] = useState(location.state?.recipeId ? String(location.state.recipeId) : '');
  const [batches, setBatches] = useState('1');
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const usable = (recipes || []).filter((r) => r.items.length);
  const recipe = usable.find((r) => String(r.id) === recipeId);
  const n = Number(String(batches).replace(',', '.')) || 0;

  const needs = useMemo(
    () =>
      recipe
        ? recipe.items.map((i) => ({ ...i, need: i.qty * n, short: i.stock_qty < i.qty * n }))
        : [],
    [recipe, n]
  );

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const res = await api.post('/api/production', { recipe_id: Number(recipeId), batches: n, produced_at: date, notes });
      const neg = res.data.negatives;
      setNotice({
        ok: true,
        text: `Listo: ${number(n * recipe.yield_qty)} ${recipe.yield_unit} de ${recipe.name}. Ya descontamos los ingredientes.`,
        warn: neg.length ? `Quedaron en negativo: ${neg.join(', ')}. Cargá la compra o corregí el stock en Ingredientes.` : '',
      });
      setNotes('');
      reload();
    } catch (err) {
      setNotice({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function remove(row) {
    if (!confirm(`¿Borrar la producción de ${row.recipe_name}? Los ingredientes vuelven al stock.`)) return;
    await api.del(`/api/production/${row.id}`);
    reload();
  }

  if (!recipes) return <Loading error={error} />;

  return (
    <div className="flex flex-col gap-4">
      <Header title="Producción" subtitle="Anotá lo que hiciste y la app descuenta los ingredientes." />

      {!usable.length ? (
        <Empty icon="👩‍🍳" title="Primero armá una receta">
          <Link to="/recetas/nueva" className="underline">
            Crear receta
          </Link>
        </Empty>
      ) : (
        <form onSubmit={save} className="card flex flex-col gap-4 p-4">
          <label className="field">
            ¿Qué hiciste?
            <select className="input" value={recipeId} onChange={(e) => setRecipeId(e.target.value)}>
              <option value="">Elegí la receta…</option>
              {usable.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.emoji} {r.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              Tandas
              <input className="input" inputMode="decimal" value={batches} onChange={(e) => setBatches(e.target.value)} />
              {recipe && (
                <span className="label-hint">
                  = {number(n * recipe.yield_qty)} {recipe.yield_unit}
                </span>
              )}
            </label>
            <label className="field">
              Fecha
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>
          {recipe && (
            <div className="rounded-xl bg-cream p-3 text-sm">
              <div className="mb-1 font-bold">Se van a descontar:</div>
              {needs.map((i) => (
                <div key={i.id} className="flex justify-between gap-2">
                  <span>{i.name}</span>
                  <span className={i.short ? 'font-bold text-bad' : ''}>
                    {qtyText(i.need, i.unit)}
                    {i.short && ` (tenés ${qtyText(i.stock_qty, i.unit)})`}
                  </span>
                </div>
              ))}
              <div className="mt-2 border-t border-line pt-2">
                Costo de ingredientes: <strong>{money(needs.reduce((s, i) => s + i.need * unitCost(i), 0))}</strong>
              </div>
            </div>
          )}
          <label className="field">
            Nota (opcional)
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: pedido de Laura" />
          </label>
          {notice && (
            <div className={notice.ok ? 'notice' : 'error'}>
              {notice.text}
              {notice.warn && <div className="mt-1 font-bold text-bad">{notice.warn}</div>}
            </div>
          )}
          <button className="btn btn-primary" disabled={busy || !recipe || !(n > 0)}>
            Guardar producción
          </button>
        </form>
      )}

      <section>
        <div className="section-title mb-2">Últimas producciones</div>
        {!history?.length ? (
          <p className="text-sm text-cocoa-soft">Todavía no registraste ninguna.</p>
        ) : (
          <div className="card divide-y divide-line">
            {history.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{row.recipe_name}</div>
                  <div className="text-xs text-cocoa-soft">
                    {dateText(row.produced_at)} · {number(row.batches)} tanda{row.batches === 1 ? '' : 's'} · {number(row.units)} un · {money(row.cost)}
                    {row.notes ? ` · ${row.notes}` : ''}
                  </div>
                </div>
                <button className="btn btn-sm btn-danger" onClick={() => remove(row)} aria-label="Borrar">
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
