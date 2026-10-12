import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Download } from 'lucide-react';
import { api } from '../api';
import RecipeEditor from '../components/RecipeEditor';
import { money, qty } from '../format';
import { printRecipe } from '../lib/recipeSheet';
import { useStore } from '../store';

// Recetas: todas las recetas en un solo lugar. Lo que se carga acá es lo que
// Producción descuenta de los ingredientes cada vez que se registra una tanda.
export default function RecipesPage() {
  const { id } = useParams();
  return id ? <RecipeDetail id={id} /> : <RecipeList />;
}

function RecipeList() {
  const { currency } = useStore();
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
  const withRecipe = filtered.filter((row) => row.recipe_count > 0);
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
        <h2 className="section-title">Con receta</h2>
        <div className="list-card">
          {withRecipe.map((row) => (
            <Link key={row.id} to={`/recetas/${row.id}`} className="list-row hover:bg-[#faf6ee]">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{row.name}</div>
                <div className="text-xs text-[#6b6266]">
                  {row.recipe_count} ingrediente{row.recipe_count === 1 ? '' : 's'} · rinde {qty(row.recipe_yield)} {row.unit}
                </div>
              </div>
              <span className="text-sm text-[#5a5155]">costo {money(row.cost_price, currency)} c/u</span>
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
                onClick={() => printRecipe({ product, storeName: settings?.name, currency })}
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
