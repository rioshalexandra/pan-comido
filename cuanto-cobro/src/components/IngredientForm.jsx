import { useState } from 'react';
import { api } from '../lib/api';
import { money } from '../lib/format';
import { BASE_UNITS, INPUT_UNITS, fromBase, niceUnit, toBase } from '../lib/units';

// Alta o edición de un ingrediente. Se carga como se compra:
// "paquete de 1 kg a $ 1.100", y la app calcula el costo por gramo.
export default function IngredientForm({ ingredient, suppliers = [], onSaved, onCancel }) {
  const editing = Boolean(ingredient?.id);
  const base = ingredient?.unit || 'g';
  const packUnit = ingredient ? niceUnit(ingredient.pack_qty, base) : 'kg';
  const stockUnit = ingredient ? niceUnit(Math.max(ingredient.stock_qty, ingredient.min_stock), base) : 'kg';
  const [f, setF] = useState({
    name: ingredient?.name || '',
    unit: base,
    is_packaging: Boolean(ingredient?.is_packaging),
    pack_qty: ingredient ? String(fromBase(ingredient.pack_qty, packUnit, base)) : '1',
    pack_unit: packUnit,
    pack_price: ingredient ? String(ingredient.pack_price) : '',
    stock_qty: ingredient ? String(fromBase(ingredient.stock_qty, stockUnit, base)) : '',
    min_stock: ingredient ? String(fromBase(ingredient.min_stock, stockUnit, base)) : '',
    stock_unit: stockUnit,
    supplier_id: ingredient?.supplier_id || '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setF((prev) => ({ ...prev, [key]: value }));

  // Al cambiar el tipo de unidad, se eligen unidades de compra y stock que tengan sentido
  function setBase(unit) {
    const big = INPUT_UNITS[unit][1].value;
    setF((prev) => ({ ...prev, unit, pack_unit: unit === 'un' ? 'un' : big, stock_unit: unit === 'un' ? 'un' : big }));
  }

  const parse = (v) => Number(String(v || '').replace(',', '.')) || 0;
  const packBase = toBase(parse(f.pack_qty), f.pack_unit, f.unit);
  const perBase = packBase > 0 ? parse(f.pack_price) / packBase : 0;
  const preview = f.unit === 'un' ? `${money(perBase)} cada una` : `${money(perBase * 1000)} el ${f.unit === 'g' ? 'kg' : 'litro'} · ${money(perBase)} el ${f.unit}`;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const payload = {
      name: f.name,
      unit: f.unit,
      is_packaging: f.is_packaging,
      pack_qty: packBase,
      pack_price: parse(f.pack_price),
      stock_qty: toBase(parse(f.stock_qty), f.stock_unit, f.unit),
      min_stock: toBase(parse(f.min_stock), f.stock_unit, f.unit),
      supplier_id: f.supplier_id || null,
    };
    try {
      const res = editing ? await api.put(`/api/ingredients/${ingredient.id}`, payload) : await api.post('/api/ingredients', payload);
      onSaved(res.data);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const units = INPUT_UNITS[f.unit];
  const unitSelect = (field) => (
    <select className="input w-24 shrink-0" value={f[field]} onChange={(e) => set(field, e.target.value)}>
      {units.map((u) => (
        <option key={u.value} value={u.value}>
          {u.value}
        </option>
      ))}
    </select>
  );

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <label className="field">
        Nombre
        <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej: Harina 0000" autoFocus={!editing} />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          Se mide en
          <select className="input" value={f.unit} onChange={(e) => setBase(e.target.value)} disabled={editing && ingredient.recipe_count > 0}>
            {BASE_UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm font-semibold">
          <input type="checkbox" checked={f.is_packaging} onChange={(e) => set('is_packaging', e.target.checked)} className="h-5 w-5 accent-gold" />
          Es packaging (caja, bolsa, etiqueta…)
        </label>
      </div>

      <fieldset className="rounded-2xl bg-cream p-3">
        <legend className="px-1 text-sm font-bold">¿Cómo lo comprás?</legend>
        <div className="flex flex-wrap items-end gap-2">
          <label className="field min-w-0 flex-1">
            Paquete de
            <div className="flex gap-2">
              <input className="input" inputMode="decimal" value={f.pack_qty} onChange={(e) => set('pack_qty', e.target.value)} />
              {unitSelect('pack_unit')}
            </div>
          </label>
          <label className="field w-36">
            a $
            <input className="input" inputMode="decimal" value={f.pack_price} onChange={(e) => set('pack_price', e.target.value)} placeholder="Ej: 1100" />
          </label>
        </div>
        {perBase > 0 && <p className="mt-2 text-sm text-cocoa-soft">Te sale {preview}</p>}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          Cuánto tenés ahora
          <div className="flex gap-2">
            <input className="input" inputMode="decimal" value={f.stock_qty} onChange={(e) => set('stock_qty', e.target.value)} placeholder="0" />
            {unitSelect('stock_unit')}
          </div>
        </label>
        <label className="field">
          Avisarme cuando quede menos de
          <input className="input" inputMode="decimal" value={f.min_stock} onChange={(e) => set('min_stock', e.target.value)} placeholder={`Ej: 2 ${f.stock_unit}`} />
        </label>
      </div>

      <label className="field">
        Se lo compro a
        <select className="input" value={f.supplier_id} onChange={(e) => set('supplier_id', e.target.value)}>
          <option value="">Sin proveedor</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      {error && <div className="error">{error}</div>}
      <div className="flex gap-2">
        <button className="btn btn-primary flex-1" disabled={busy}>
          {editing ? 'Guardar cambios' : 'Agregar ingrediente'}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
