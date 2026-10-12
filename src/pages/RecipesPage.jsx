import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Download } from 'lucide-react';
import { api } from '../api';
import RecipeEditor from '../components/RecipeEditor';
import { money, qty } from '../format';
import { printRecipe } from '../lib/recipeSheet';
import { marginTone, recipeCosts } from '../lib/costs';
import { useStore } from '../store';

// Recetas: todas las recetas en un solo lugar. Lo que se carga acá es lo que
// Producción descuenta de los ingredientes cada vez que se registra una tanda.
export default function RecipesPage() {
  const { id } = useParams();
  return id ? <RecipeDetail id={id} /> : <RecipeList />;
}

const SORTS = [
  { key: 'margin', label: 'Margen real' },
  { key: 'hour', label: 'Ganancia por hora' },
  { key: 'name', label: 'Nombre' },
];

function RecipeList() {
  const { currency, settings } = useStore();
  const [sort, setSort] = useState('margin');
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .products('?kind=product')
      .then((res) => setRows(res.data))
      .catch((err) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((row) => !term || row.name.toLowerCase().includes(term));
  }, [rows, q]);
  const withRecipe = filtered
    .filter((row) => row.recipe_count > 0)
    .map((row) => ({
      ...row,
      costs: recipeCosts(
        {
          ingredientUnitCost: row.cost_price,
          yieldQty: row.recipe_yield,
          workMinutes: row.recipe_work_minutes,
          ovenMinutes: row.recipe_oven_minutes,
          price: row.sale_price,
        },
        settings
      ),
    }))
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      const value = (row) => (sort === 'hour' ? row.costs?.perWorkHour : row.costs?.realMargin) ?? -Infinity;
      return value(b) - value(a);
    });
  const withoutRecipe = filtered.filter((row) => !row.recipe_count);

  return (
    <div className="page">
      <h1 className="mb-1 text-2xl">Recetas</h1>
      <p className="mb-4 max-w-2xl text-sm text-[#5a5155]">
        Cargá la receta que usás para cada producto: ingredientes de una tanda y cuánto rinde. Cuando registrás producción se
        descuentan exactamente estas cantidades del stock de ingredientes, y el costo del producto sale de acá.
      </p>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <input className="search-input mb-4 w-full px-4 sm:max-w-xs" placeholder="Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} />

      <section className="mb-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title m-0">Con receta</h2>
          <div className="flex flex-wrap items-center gap-1 text-sm">
            <span className="text-[#6b6266]">Ordenar por</span>
            {SORTS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`pill-btn ${sort === item.key ? 'primary' : ''}`}
                onClick={() => setSort(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mb-2 text-xs text-[#6b6266]">
          Margen real: lo que te queda de cada venta después de ingredientes, tu trabajo, luz y gas. Ganancia por hora: lo
          que te deja cada hora que le dedicás a ese producto; cuanto más alta, más conviene producirlo.
        </p>
        <div className="list-card">
          {withRecipe.map((row) => (
            <Link key={row.id} to={`/recetas/${row.id}`} className="list-row hover:bg-[#faf6ee]">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{row.name}</div>
                <div className="text-xs text-[#6b6266]">
                  rinde {qty(row.recipe_yield)} {row.unit}
                  {row.costs?.workMinutes ? ` · ${row.costs.workMinutes} min de trabajo` : ' · faltan los minutos de trabajo'}
                  {' · '}costo {money(row.costs?.fullUnit ?? row.cost_price, currency)} c/u
                </div>
              </div>
              <div className="text-right text-sm">
                <div className={`font-semibold ${marginTone(row.costs?.realMargin)}`}>
                  {row.costs?.realMargin != null ? `${row.costs.realMargin}%` : '—'}
                </div>
                <div className="text-xs text-[#6b6266]">
                  {row.costs?.perWorkHour != null ? `${money(row.costs.perWorkHour, currency)}/hora` : 'sin calcular'}
                </div>
              </div>
            </Link>
          ))}
          {!withRecipe.length && <div className="list-empty">Todavía no hay recetas cargadas.</div>}
        </div>
      </section>

      {withoutRecipe.length > 0 && (
        <section>
          <h2 className="section-title">Sin receta</h2>
          <p className="mb-2 text-xs text-[#6b6266]">Al producirlos no se descuenta ningún ingrediente.</p>
          <div className="list-card">
            {withoutRecipe.map((row) => (
              <Link key={row.id} to={`/recetas/${row.id}`} className="list-row hover:bg-[#faf6ee]">
                <span className="min-w-0 flex-1 font-medium">{row.name}</span>
                <span className="pill-btn">Cargar receta</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RecipeDetail({ id }) {
  const { settings, currency } = useStore();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    const res = await api.product(id);
    setProduct(res.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [id]);

  return (
    <div className="page">
      <Link to="/recetas" className="text-link mb-3 inline-flex items-center gap-1 text-sm">
        <ChevronLeft size={16} /> Recetas
      </Link>
      {!product ? (
        <div className="text-[#6b6266]">{error || 'Cargando…'}</div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h1 className="m-0 text-2xl">{product.name}</h1>
            {product.recipe?.items?.length > 0 && (
              <button
                type="button"
                className="pill-btn inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
                onClick={() => printRecipe({ product, storeName: settings?.name, currency, settings })}
              >
                <Download size={16} /> Descargar ficha
              </button>
            )}
          </div>
          <RecipeEditor key={product.updated_at} product={product} onSaved={load} title="Ingredientes por tanda" />
          <Link to={`/productos/${product.id}`} className="text-link text-sm">
            Ver ficha del producto (precio, stock, fotos)
          </Link>
        </>
      )}
    </div>
  );
}
