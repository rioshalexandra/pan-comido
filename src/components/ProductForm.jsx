import { useEffect, useState } from 'react';
import { api } from '../api';
import { UNITS } from '../format';
import { ICONS, guessIcon } from '../lib/icons';

// Alta / edición de un producto (para vender) o de un ingrediente (materia prima).
export default function ProductForm({ form, categories, onClose, onSave }) {
  const [state, setState] = useState(form);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const isIngredient = state.kind === 'ingredient';
  // Un producto con receta calcula su costo solo; no se edita a mano
  const costFromRecipe = !isIngredient && Number(form.recipeCount) > 0;

  // Proveedores para elegir el habitual (se usa en el Pedido)
  useEffect(() => {
    api.suppliers().then((res) => setSuppliers(res.data)).catch(() => {});
  }, []);

  function set(key, value) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  // Si nunca se eligió dibujo, se propone uno según el nombre
  const shownIcon = state.icon == null ? guessIcon(state.name) : state.icon;

  const title = `${state.id ? 'Editar' : 'Nuevo'} ${isIngredient ? 'ingrediente' : 'producto'}`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal-card wide"
        onClick={(ev) => ev.stopPropagation()}
        onSubmit={async (ev) => {
          ev.preventDefault();
          setBusy(true);
          setError('');
          try {
            await onSave({
              kind: state.kind,
              sku: state.sku,
              name: state.name,
              description: state.description,
              categoryId: state.categoryId || null,
              unit: state.unit,
              barcode: state.barcode,
              costPrice: Number(state.costPrice || 0),
              salePrice: isIngredient ? 0 : Number(state.salePrice || 0),
              stockQty: Number(state.stockQty || 0),
              minStock: Number(state.minStock || 0),
              reorderQty: Number(state.reorderQty || 0) || null,
              supplierId: state.supplierId || null,
              active: state.active !== false,
              ...(isIngredient ? {} : { icon: shownIcon }),
            });
          } catch (err) {
            setError(err.message);
            setBusy(false);
          }
        }}
      >
        <div className="modal-head">{title}</div>
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</div>}
          <label className="field sm:col-span-2">
            <span>Nombre</span>
            <input
              value={state.name}
              placeholder={isIngredient ? 'Ej: Harina 0000' : 'Ej: Cookies de chocolate'}
              onChange={(e) => set('name', e.target.value)}
              required
            />
          </label>
          {!isIngredient && (
            <div className="field sm:col-span-2">
              <span>Dibujito (se ve en Vender y en la lista)</span>
              <div className="flex flex-wrap gap-1.5">
                {ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    aria-label={`Dibujito ${icon}`}
                    aria-pressed={shownIcon === icon}
                    className={`grid h-10 w-10 place-items-center rounded-lg border text-xl ${
                      shownIcon === icon ? 'border-[var(--gold)] bg-[#f7efe0] ring-2 ring-[var(--gold)]' : 'border-[var(--line)] bg-white'
                    }`}
                    onClick={() => set('icon', icon)}
                  >
                    {icon}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={shownIcon === ''}
                  className={`h-10 rounded-lg border px-3 text-xs ${
                    shownIcon === '' ? 'border-[var(--gold)] bg-[#f7efe0] ring-2 ring-[var(--gold)]' : 'border-[var(--line)] bg-white'
                  }`}
                  onClick={() => set('icon', '')}
                >
                  Sin dibujo
                </button>
              </div>
              <small className="text-xs text-[#6b6266]">Si el producto tiene foto, se ve la foto.</small>
            </div>
          )}
          <label className="field">
            <span>Categoría</span>
            <select value={state.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              <option value="">Sin categoría</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Unidad</span>
            <input list="units" value={state.unit} onChange={(e) => set('unit', e.target.value)} />
            <datalist id="units">
              {UNITS.map((unit) => (
                <option key={unit} value={unit} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span>{isIngredient ? `Costo por ${state.unit || 'unidad'}` : 'Costo'}</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={state.costPrice}
              disabled={costFromRecipe}
              onChange={(e) => set('costPrice', e.target.value)}
            />
            {costFromRecipe && <small className="text-xs text-[#6b6266]">Se calcula con la receta.</small>}
          </label>
          {!isIngredient && (
            <label className="field">
              <span>Precio de venta</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={state.salePrice}
                onChange={(e) => set('salePrice', e.target.value)}
              />
            </label>
          )}
          {!state.id && (
            <label className="field">
              <span>Stock inicial</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.001"
                value={state.stockQty}
                onChange={(e) => set('stockQty', e.target.value)}
              />
            </label>
          )}

          {/* Stock crítico: productos → aparecen en "Qué hornear"; ingredientes → en "Pedido" */}
          <div className="mt-2 text-sm font-semibold sm:col-span-2">Stock crítico</div>
          <label className="field">
            <span>Stock crítico</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.001"
              value={state.minStock}
              placeholder="Ej: 2"
              onChange={(e) => set('minStock', e.target.value)}
            />
            <small className="text-xs text-[#6b6266]">
              {isIngredient
                ? 'Con esta cantidad o menos, pasa a la lista de Pedido.'
                : 'Con esta cantidad o menos, aparece en "Qué hornear".'}
            </small>
          </label>
          {isIngredient && (
            <>
              <label className="field">
                <span>Cantidad a pedir (opcional)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.001"
                  value={state.reorderQty}
                  placeholder="Automática"
                  onChange={(e) => set('reorderQty', e.target.value)}
                />
              </label>
              <label className="field sm:col-span-2">
                <span>Proveedor habitual</span>
                <select value={state.supplierId} onChange={(e) => set('supplierId', e.target.value)}>
                  <option value="">Sin proveedor</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className="field sm:col-span-2">
            <span>Descripción (opcional)</span>
            <textarea rows={2} value={state.description} onChange={(e) => set('description', e.target.value)} />
          </label>
          <label className="field">
            <span>Código (opcional)</span>
            <input value={state.sku} placeholder="Se genera solo" onChange={(e) => set('sku', e.target.value)} />
          </label>
          {state.id && (
            <label className="flex items-center gap-2 self-end pb-3 text-sm">
              <input type="checkbox" checked={state.active === false} onChange={(e) => set('active', !e.target.checked)} />
              Desactivar (deja de aparecer en listas y ventas)
            </label>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="pill-btn" onClick={onClose}>
            Cerrar
          </button>
          <button type="submit" className="pill-btn primary" disabled={busy}>
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}

export function emptyProduct(kind = 'product') {
  return {
    id: null,
    kind,
    sku: '',
    name: '',
    description: '',
    categoryId: '',
    unit: kind === 'ingredient' ? 'kg' : 'un',
    barcode: '',
    costPrice: '',
    salePrice: '',
    stockQty: '',
    minStock: '',
    reorderQty: '',
    supplierId: '',
    active: true,
    icon: null,
    recipeCount: 0,
  };
}

export function toProductForm(row) {
  return {
    id: row.id,
    kind: row.kind || 'product',
    sku: row.sku || '',
    name: row.name || '',
    description: row.description || '',
    categoryId: row.category_id || '',
    unit: row.unit || 'un',
    barcode: row.barcode || '',
    costPrice: row.cost_price != null ? String(Number(row.cost_price)) : '',
    salePrice: row.sale_price != null ? String(Number(row.sale_price)) : '',
    stockQty: row.stock_qty || '',
    minStock: Number(row.min_stock) ? String(Number(row.min_stock)) : '',
    reorderQty: row.reorder_qty ? String(Number(row.reorder_qty)) : '',
    supplierId: row.supplier_id ? String(row.supplier_id) : '',
    active: row.active !== false,
    icon: row.icon ?? null,
    recipeCount: row.recipe_count || (row.recipe?.items?.length ?? 0),
  };
}
