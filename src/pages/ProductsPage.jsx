import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import ProductForm, { emptyProduct, toProductForm } from '../components/ProductForm';
import StockAdjustModal from '../components/StockAdjustModal';
import { money, qty } from '../format';
import { useStore } from '../store';
import { ProductIcon } from '../lib/icons';

// Textos de cada variante de la página: productos para vender o ingredientes (materia prima)
const COPY = {
  products: {
    title: 'Productos',
    newLabel: 'Nuevo producto',
    path: '/productos',
    kind: 'product',
    empty: 'No hay productos con esos filtros.',
  },
  ingredients: {
    title: 'Ingredientes',
    newLabel: 'Nuevo ingrediente',
    path: '/ingredientes',
    kind: 'ingredient',
    empty: 'Todavía no cargaste ingredientes (harina, manteca, huevos…).',
  },
};

export default function ProductsPage({ kind = 'products' }) {
  const meta = COPY[kind];
  const isIngredients = kind === 'ingredients';
  const { currency } = useStore();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState(params.get('q') || '');
  const [categoryId, setCategoryId] = useState(params.get('categoryId') || '');
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [editing, setEditing] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const [newCategory, setNewCategory] = useState('');
  const [error, setError] = useState('');

  const query = useMemo(() => {
    const search = new URLSearchParams();
    search.set('kind', meta.kind);
    if (q.trim()) search.set('q', q.trim());
    if (categoryId) search.set('categoryId', categoryId);
    return `?${search.toString()}`;
  }, [q, categoryId, meta.kind]);

  async function load() {
    const [products, cats] = await Promise.all([api.products(query), api.categories()]);
    setRows(products.data);
    setCategories(cats.data);
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (q.trim()) next.set('q', q.trim());
          else next.delete('q');
          if (categoryId) next.set('categoryId', categoryId);
          else next.delete('categoryId');
          return next;
        },
        { replace: true }
      );
      load().catch((err) => setError(err.message));
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  const isCritical = (row) => Number(row.min_stock) > 0 && Number(row.stock_qty) <= Number(row.min_stock);
  const visible = onlyCritical ? rows.filter(isCritical) : rows;

  return (
    <div className="page">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl">{meta.title}</h1>
        <button className="pill-btn primary" onClick={() => setEditing(emptyProduct(meta.kind))}>
          {meta.newLabel}
        </button>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="search-input px-4 sm:max-w-xs"
          placeholder="Buscar…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="pill-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <label className="check-tile py-2">
          <input type="checkbox" checked={onlyCritical} onChange={(e) => setOnlyCritical(e.target.checked)} />
          Solo stock crítico
        </label>
      </div>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* Tarjetas: se leen bien tanto en el celular como en la compu */}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((row) => {
          const margin =
            !isIngredients && Number(row.sale_price) > 0
              ? Math.round(((Number(row.sale_price) - Number(row.cost_price)) / Number(row.sale_price)) * 100)
              : null;
          return (
            <div key={row.id} className="card-tile cursor-default">
              <div className="flex items-start gap-3">
                <ProductIcon row={row} />
                <div className="min-w-0 flex-1">
                  <Link className="text-link block truncate" to={`${meta.path}/${row.id}`}>
                    {row.name}
                  </Link>
                  <div className="text-xs text-[#6b6266]">
                    {row.category_name || 'Sin categoría'}
                    {!isIngredients && (row.recipe_count ? ' · con receta' : ' · sin receta')}
                  </div>
                </div>
                {isCritical(row) && <span className="badge badge-low">Crítico</span>}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-lg bg-[#fbf3f5] py-1.5">
                  <div className="text-[11px] text-[#6b6266]">Stock</div>
                  <div className="font-medium">
                    {qty(row.stock_qty)} {row.unit}
                  </div>
                </div>
                <div className="rounded-lg bg-[#fbf3f5] py-1.5">
                  <div className="text-[11px] text-[#6b6266]">{isIngredients ? `Costo / ${row.unit}` : 'Costo'}</div>
                  <div className="font-medium">{money(row.cost_price, currency)}</div>
                </div>
                <div className="rounded-lg bg-[#f7efe0] py-1.5">
                  <div className="text-[11px] text-[#6b6266]">{isIngredients ? 'Crítico' : 'Precio'}</div>
                  <div className="font-semibold">
                    {isIngredients ? `${qty(row.min_stock)} ${row.unit}` : money(row.sale_price, currency)}
                  </div>
                </div>
              </div>
              {isIngredients && <StockBar row={row} />}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {margin != null && <span className="mr-auto text-xs text-[#6b6266]">Ganancia {margin}%</span>}
                <button className={`pill-btn ${margin == null ? 'ml-auto' : ''}`} onClick={() => setAdjusting(row)}>
                  Stock
                </button>
                <button className="pill-btn" onClick={() => setEditing(toProductForm(row))}>
                  Editar
                </button>
              </div>
            </div>
          );
        })}
        {!visible.length && <div className="list-empty sm:col-span-2 xl:col-span-3">{meta.empty}</div>}
      </div>

      <form
        className="mt-6 flex flex-wrap gap-2"
        onSubmit={async (ev) => {
          ev.preventDefault();
          if (!newCategory.trim()) return;
          try {
            await api.saveCategory({ name: newCategory.trim() });
            setNewCategory('');
            await load();
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        <input
          className="search-input px-4 sm:max-w-xs"
          placeholder="Nueva categoría"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
        />
        <button className="pill-btn" type="submit">
          Agregar categoría
        </button>
      </form>

      {adjusting && (
        <StockAdjustModal
          product={adjusting}
          onClose={() => setAdjusting(null)}
          onSave={async (body) => {
            await api.adjustStock(adjusting.id, body);
            setAdjusting(null);
            await load();
          }}
        />
      )}
      {editing && (
        <ProductForm
          form={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSave={async (body) => {
            await api.saveProduct(editing.id, body);
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

// Barra de stock de un ingrediente: rojo si está en el crítico o menos, amarillo si queda poco, verde si sobra
function StockBar({ row }) {
  const stock = Number(row.stock_qty || 0);
  const min = Number(row.min_stock || 0);
  if (!(min > 0)) return null;
  const pct = Math.max(3, Math.min(100, (stock / (min * 2.5)) * 100));
  const tone = stock <= min ? 'bg-red-500' : stock <= min * 1.5 ? 'bg-amber-400' : 'bg-green-500';
  const label = stock <= min ? 'Hay que pedir' : stock <= min * 1.5 ? 'Queda poco' : 'Bien de stock';
  return (
    <div className="mt-3">
      <div className="h-2 overflow-hidden rounded-full bg-[#efe7e9]">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-[11px] text-[#6b6266]">{label}</div>
    </div>
  );
}
