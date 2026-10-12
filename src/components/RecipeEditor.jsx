import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import { compatibleUnits, convertQty, friendlyUnit, money, recipeQty } from '../format';
import { useStore } from '../store';

// Editor de receta: ingredientes por tanda y cuántas unidades rinde.
// Muestra el costo por tanda y por unidad mientras se edita.
// Cada cantidad se puede escribir en una unidad cómoda (g, ml) y se guarda en la del ingrediente.
export default function RecipeEditor({ product, onSaved, title = 'Receta' }) {
  const { currency } = useStore();
  const [ingredients, setIngredients] = useState([]);
  const [yieldQty, setYieldQty] = useState(String(product.recipe?.yield || ''));
  const [notes, setNotes] = useState(product.recipe?.notes || '');
  const [lines, setLines] = useState(
    (product.recipe?.items || []).map((item) => {
      const unit = friendlyUnit(item.qty, item.unit);
      return { ingredientId: String(item.ingredient_id), qty: String(round(convertQty(item.qty, item.unit, unit))), unit };
    })
  );
  const [editing, setEditing] = useState(!product.recipe?.items?.length);
  // Al tocar "escribir procedimiento" se abre el editor con el cursor en las notas
  const notesRef = useRef(null);
  const [focusNotes, setFocusNotes] = useState(false);
  useEffect(() => {
    if (editing && focusNotes) {
      notesRef.current?.focus();
      setFocusNotes(false);
    }
  }, [editing, focusNotes]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.products('?kind=ingredient').then((res) => setIngredients(res.data)).catch((err) => setError(err.message));
  }, []);

  const byId = useMemo(() => Object.fromEntries(ingredients.map((ing) => [String(ing.id), ing])), [ingredients]);
  // Cantidad de una línea en la unidad del ingrediente (la que usa el stock y el costo)
  const storedQty = (line) => {
    const ing = byId[line.ingredientId];
    return ing ? convertQty(line.qty || 0, line.unit || ing.unit, ing.unit) : Number(line.qty || 0);
  };
  const batchCost = lines.reduce((sum, line) => sum + storedQty(line) * Number(byId[line.ingredientId]?.cost_price || 0), 0);
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
        notes,
        items: lines.filter((line) => line.ingredientId && Number(line.qty) > 0).map((line) => ({
          ingredientId: Number(line.ingredientId),
          qty: round(storedQty(line), 4),
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
        <h2 className="section-title m-0">{title}</h2>
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
              Cargá los ingredientes de <strong>una tanda</strong> tal como los usás (por ejemplo, 350 g de harina) y cuántas
              unidades salen. Al registrar producción se descuentan estas cantidades del stock de ingredientes.
            </p>
            {lines.map((line, index) => {
              const ing = byId[line.ingredientId];
              return (
                <div key={index} className="flex items-end gap-2">
                  <label className="field min-w-0 flex-1">
                    <span>Ingrediente</span>
                    <select
                      value={line.ingredientId}
                      onChange={(e) => setLine(index, { ingredientId: e.target.value, unit: defaultUnit(byId[e.target.value]?.unit) })}
                    >
                      <option value="">Elegí…</option>
                      {ingredients.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.unit})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field w-24">
                    <span>Cantidad</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.001"
                      value={line.qty}
                      onChange={(e) => setLine(index, { qty: e.target.value })}
                    />
                  </label>
                  <label className="field w-20">
                    <span>Unidad</span>
                    <select
                      value={line.unit || ing?.unit || ''}
                      disabled={!ing}
                      onChange={(e) => setLine(index, { unit: e.target.value })}
                    >
                      {(ing ? compatibleUnits(ing.unit) : ['']).map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
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
              onClick={() => setLines((prev) => [...prev, { ingredientId: '', qty: '', unit: '' }])}
            >
              <Plus size={15} /> Agregar ingrediente
            </button>
            <label className="field max-w-xs">
              <span>Rinde ({product.unit || 'unidades'} por tanda)</span>
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
            <label className="field">
              <span>Notas o procedimiento</span>
              <textarea
                ref={notesRef}
                rows={6}
                value={notes}
                placeholder="Ej: Batir la manteca con el azúcar, sumar los huevos de a uno… Horno 180° por 12 minutos."
                onChange={(e) => setNotes(e.target.value)}
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
                  {recipeQty(item.qty, item.unit)} · {money(item.line_cost, currency)}
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
            {/* El procedimiento se ve siempre, aunque esté vacío, para que se sepa dónde cargarlo */}
            <div className="border-t border-[var(--line)] px-4 py-3">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#6b6266]">Notas o procedimiento</div>
              {product.recipe.notes ? (
                <p className="m-0 whitespace-pre-wrap text-sm">{product.recipe.notes}</p>
              ) : (
                <button type="button" className="text-link p-0 text-sm" onClick={() => {
                    setFocusNotes(true);
                    setEditing(true);
                  }}
                >
                  Todavía no hay procedimiento. Tocá acá para escribirlo.
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// Al elegir un ingrediente en kg o litros, la receta se escribe en g o ml
function defaultUnit(unit) {
  if (unit === 'kg') return 'g';
  if (unit === 'l') return 'ml';
  return unit || '';
}

function round(value, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}
