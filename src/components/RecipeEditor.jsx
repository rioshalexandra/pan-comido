import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import { compatibleUnits, convertQty, friendlyUnit, money, recipeQty } from '../format';
import { useStore } from '../store';
import { marginTone, recipeCosts } from '../lib/costs';

// Editor de receta: ingredientes por tanda y cuántas unidades rinde.
// Muestra el costo por tanda y por unidad mientras se edita.
// Cada cantidad se puede escribir en una unidad cómoda (g, ml) y se guarda en la del ingrediente.
export default function RecipeEditor({ product, onSaved, title = 'Receta' }) {
  const { currency, settings } = useStore();
  const [ingredients, setIngredients] = useState([]);
  const [yieldQty, setYieldQty] = useState(String(product.recipe?.yield || ''));
  const [notes, setNotes] = useState(product.recipe?.notes || '');
  const [workMinutes, setWorkMinutes] = useState(minutesText(product.recipe_work_minutes));
  const [ovenMinutes, setOvenMinutes] = useState(minutesText(product.recipe_oven_minutes));
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
  // Cuántas tandas se van a hacer: multiplica las cantidades que se muestran
  const [batches, setBatches] = useState(1);

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
  const draftCosts = recipeCosts({ ingredientUnitCost: unitCost, yieldQty, workMinutes, ovenMinutes, price }, settings);
  const savedCosts = recipeCosts(
    {
      ingredientUnitCost: product.recipe?.unitCost,
      yieldQty: product.recipe?.yield,
      workMinutes: product.recipe_work_minutes,
      ovenMinutes: product.recipe_oven_minutes,
      price,
    },
    settings
  );
  const missingSettings = !Number(settings?.labor_hour_rate) || !Number(settings?.oven_hours_month);

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
        workMinutes: Number(workMinutes || 0),
        ovenMinutes: Number(ovenMinutes || 0),
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
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
              <label className="field">
                <span>Minutos de trabajo por tanda</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={workMinutes}
                  placeholder="Ej: 60"
                  onChange={(e) => setWorkMinutes(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Minutos de horno por tanda</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={ovenMinutes}
                  placeholder="Ej: 15"
                  onChange={(e) => setOvenMinutes(e.target.value)}
                />
              </label>
            </div>
            <p className="-mt-1 m-0 text-xs text-[#6b6266]">
              Contá todo tu tiempo: preparar, armar, decorar y envasar. Con esto la app suma tu trabajo y la luz y el gas al costo.
              El packaging (caja, bolsa, etiqueta) cargalo como un ingrediente más.
            </p>
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
                  {price > 0 && ` · margen bruto ${Math.round(((price - unitCost) / price) * 100)}%`}
                </>
              )}
              {draftCosts && (draftCosts.laborUnit > 0 || draftCosts.energyUnit > 0) && (
                <>
                  <br />
                  Con trabajo, luz y gas: <strong>{money(draftCosts.fullUnit, currency)}</strong> por unidad
                  {draftCosts.realMargin != null && ` · margen real ${draftCosts.realMargin}%`}
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
            <div className="list-row flex-wrap bg-[#faf6ee]">
              <label htmlFor={`tandas-${product.id}`} className="font-medium">
                Tandas a hacer: <strong>{batches}</strong>
              </label>
              <input
                id={`tandas-${product.id}`}
                type="range"
                min="1"
                max="10"
                value={batches}
                onChange={(e) => setBatches(Number(e.target.value))}
                className="min-w-0 flex-[1_1_160px] accent-[var(--gold)]"
                style={{ border: 'none', background: 'transparent', padding: 0, boxShadow: 'none', minHeight: 24 }}
              />
            </div>
            {product.recipe.items.map((item) => (
              <div key={item.id} className="list-row">
                <span>{item.name}</span>
                <span className="text-[#5a5155]">
                  {recipeQty(item.qty * batches, item.unit)} · {money(item.line_cost * batches, currency)}
                </span>
              </div>
            ))}
            <div className="list-row flex-wrap bg-[#f7efe0]">
              <span>
                Rinde <strong>{round(Number(product.recipe.yield) * batches, 2)}</strong> {product.unit}
                {batches > 1 && <span className="text-[#6b6266]"> ({batches} tandas)</span>}
              </span>
              <span>
                {batches > 1 ? 'Total' : 'Tanda'} {money(product.recipe.batchCost * batches, currency)} · unidad{' '}
                <strong>{money(product.recipe.unitCost, currency)}</strong>
              </span>
            </div>
            {savedCosts && (
              <CostBreakdown
                costs={savedCosts}
                currency={currency}
                price={price}
                missingSettings={missingSettings}
                onAddMinutes={() => setEditing(true)}
              />
            )}
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

// Costo completo por unidad y los dos márgenes: bruto (solo ingredientes) y real (con todo)
function CostBreakdown({ costs, currency, price, missingSettings, onAddMinutes }) {
  const noMinutes = !costs.workMinutes && !costs.ovenMinutes;
  return (
    <div className="border-t border-[var(--line)] px-4 py-3 text-sm">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6b6266]">Costo completo por unidad</div>
      <div className="grid gap-1">
        <Line label="Ingredientes y packaging" value={money(costs.ingredientsUnit, currency)} />
        <Line
          label={`Tu trabajo${costs.workMinutes ? ` (${costs.workMinutes} min por tanda)` : ''}`}
          value={money(costs.laborUnit, currency)}
        />
        <Line
          label={`Luz y gas${costs.ovenMinutes ? ` (${costs.ovenMinutes} min de horno)` : ''}`}
          value={money(costs.energyUnit, currency)}
        />
        <Line label={<strong>Costo completo</strong>} value={<strong>{money(costs.fullUnit, currency)}</strong>} />
      </div>
      {price > 0 && <PriceBar costs={costs} price={price} currency={currency} />}
      {price > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Precio de venta" value={money(price, currency)} />
          <Stat label="Margen bruto" value={`${costs.grossMargin}%`} hint="solo ingredientes" />
          <Stat
            label="Margen real"
            value={
              costs.realMargin != null ? <span className={marginTone(costs.realMargin)}>{costs.realMargin}%</span> : '—'
            }
            hint={costs.realMargin != null ? `te quedan ${money(price - costs.fullUnit, currency)} por unidad` : 'faltan los minutos'}
          />
          {costs.perWorkHour != null && (
            <Stat label="Ganás por hora de trabajo" value={money(costs.perWorkHour, currency)} hint="después de ingredientes, luz y gas" />
          )}
        </div>
      )}
      {(noMinutes || missingSettings) && (
        <p className="mb-0 mt-3 text-xs text-[#6b6266]">
          {noMinutes && (
            <>
              Para el margen real falta cargar los minutos de trabajo y de horno.{' '}
              <button type="button" className="text-link p-0 text-xs" onClick={onAddMinutes}>
                Cargarlos
              </button>
              {missingSettings ? ' · ' : ''}
            </>
          )}
          {missingSettings && (
            <>
              Falta el valor de tu hora y el gasto de luz y gas en{' '}
              <Link to="/configuracion" className="text-link">
                Configuración
              </Link>
              .
            </>
          )}
        </p>
      )}
    </div>
  );
}

// Barra de colores: de cada peso del precio, cuánto va a ingredientes, trabajo, luz y gas, y cuánto queda
const BAR_PARTS = [
  { key: 'ingredientsUnit', label: 'Ingredientes', color: '#d9a441' },
  { key: 'laborUnit', label: 'Tu trabajo', color: '#8a5a7a' },
  { key: 'energyUnit', label: 'Luz y gas', color: '#e07a5f' },
];

function PriceBar({ costs, price, currency }) {
  const left = price - costs.fullUnit;
  const parts = [
    ...BAR_PARTS.map((part) => ({ ...part, value: costs[part.key] })),
    { key: 'left', label: left >= 0 ? 'Te queda' : 'Perdés', color: left >= 0 ? '#4c9a6a' : '#c0392b', value: Math.abs(left) },
  ].filter((part) => part.value > 0);
  const total = parts.reduce((sum, part) => sum + part.value, 0) || 1;
  return (
    <div className="mt-3">
      <div className="mb-1 text-xs text-[#6b6266]">Cómo se reparte el precio de venta</div>
      <div className="flex h-4 overflow-hidden rounded-full bg-[#efe7e9]" role="img" aria-label="Reparto del precio">
        {parts.map((part) => (
          <div
            key={part.key}
            style={{ width: `${(part.value / total) * 100}%`, background: part.color }}
            title={`${part.label}: ${money(part.value, currency)}`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#5a5155]">
        {parts.map((part) => (
          <span key={part.key} className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: part.color }} />
            {part.label} {Math.round((part.value / price) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

function Line({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[#5a5155]">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl bg-[#faf6ee] px-3 py-2">
      <div className="text-xs text-[#6b6266]">{label}</div>
      <div className="text-base font-semibold">{value}</div>
      {hint && <div className="text-[11px] text-[#6b6266]">{hint}</div>}
    </div>
  );
}

function minutesText(value) {
  return Number(value) > 0 ? String(Number(value)) : '';
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
