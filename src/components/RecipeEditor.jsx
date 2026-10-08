import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import { money } from '../format';
import { useStore } from '../store';

// Editor de receta: ingredientes por tanda y cuántas unidades rinde.
// Muestra el costo por tanda y por unidad mientras se edita.
export default function RecipeEditor({ product, onSaved }) {
  const { currency } = useStore();
  const [ingredients, setIngredients] = useState([]);
  const [yieldQty, setYieldQty] = useState(String(product.recipe?.yield || ''));
  const [lines, setLines] = useState(
    (product.recipe?.items || []).map((item) => ({ ingredientId: String(item.ingredient_id), qty: String(Number(item.qty)) }))
  );
  const [editing, setEditing] = useState(!product.recipe?.items?.length);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.products('?kind=ingredient').then((res) => setIngredients(res.data)).catch((err) => setError(err.message));
  }, []);

  const byId = useMemo(() => Object.fromEntries(ingredients.map((ing) => [String(ing.id), ing])), [ingredients]);
  const batchCost = lines.reduce((sum, line) => sum + Number(line.qty || 0) * Number(byId[line.ingredientId]?.cost_price || 0), 0);
  const unitCost = Number(yieldQty) > 0 ? batchCost / Number(yieldQty) : null;
  const price = Number(product.sale_price || 0);

  function setLine(index, patch) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api.saveRecipe(product.id, {
        yield: Number(yieldQty || 0),
        items: lines.filter((line) => line.ingredientId && Number(line.qty) > 0).map((line) => ({
          ingredientId: Number(line.ingredientId),
          qty: Number(line.qty),
        })),
      });
      setEditing(false);
      await onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="section-title m-0">Receta</h2>
        {!editing && (
          <button className="pill-btn" onClick={() => setEditing(true)}>
            Editar receta
          </button>
        )}
      </div>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="list-card">
        {editing ? (
          <div className="grid gap-3 p-4">
            <p className="m-0 text-sm text-[#5a5155]">
              Cargá los ingredientes de <strong>una tanda</strong>, en la misma unidad de cada ingrediente (por ejemplo, 0,35
              kg de harina), y cuántas unidades salen.
            </p>
            {lines.map((line, index) => {
              const ing = byId[line.ingredientId];
              return (
                <div key={index} className="flex items-end gap-2">
                  <label className="field min-w-0 flex-1">
                    <span>Ingrediente</span>
                    <select value={line.ingredientId} onChange={(e) => setLine(index, { ingredientId: e.target.value })}>
                      <option value="">Elegí…</option>
                      {ingredients.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.unit})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field w-28">
                    <span>Cantidad{ing ? ` (${ing.unit})` : ''}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.001"
                      value={line.qty}
                      onChange={(e) => setLine(index, { qty: e.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    className="icon-btn mb-0.5"
                    title="Quitar"
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              className="pill-btn inline-flex w-fit items-center gap-1"
              onClick={() => setLines((prev) => [...prev, { ingredientId: '', qty: '' }])}
            >
              <Plus size={15} /> Agregar ingrediente
            </button>
            <label className="field max-w-xs">
              <span>Rinde (unidades por tanda)</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                value={yieldQty}
                placeholder="Ej: 24"
                onChange={(e) => setYieldQty(e.target.value)}
              />
            </label>
            <div className="notice">
              Costo por tanda: <strong>{money(batchCost, currency)}</strong>
              {unitCost != null && (
                <>
                  {' '}
                  · por unidad: <strong>{money(unitCost, currency)}</strong>
                  {price > 0 && ` · ganancia ${Math.round(((price - unitCost) / price) * 100)}%`}
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button className="pill-btn primary" onClick={save} disabled={busy}>
                Guardar receta
              </button>
              {product.recipe?.items?.length > 0 && (
                <button className="pill-btn" onClick={() => setEditing(false)}>
                  Cancelar
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {product.recipe.items.map((item) => (
              <div key={item.id} className="list-row">
                <span>{item.name}</span>
                <span className="text-[#5a5155]">
                  {Number(item.qty)} {item.unit} · {money(item.line_cost, currency)}
                </span>
              </div>
            ))}
            <div className="list-row bg-[#f7efe0]">
              <span>
                Rinde <strong>{Number(product.recipe.yield)}</strong> {product.unit}
              </span>
              <span>
                Tanda {money(product.recipe.batchCost, currency)} · unidad{' '}
                <strong>{money(product.recipe.unitCost, currency)}</strong>
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
