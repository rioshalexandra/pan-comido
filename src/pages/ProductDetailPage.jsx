import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import AttachmentsPanel from '../components/AttachmentsPanel';
import ConfirmDangerModal from '../components/ConfirmDangerModal';
import ProductForm, { toProductForm } from '../components/ProductForm';
import RecipeEditor from '../components/RecipeEditor';
import StockAdjustModal from '../components/StockAdjustModal';
import { MOVEMENT_KINDS, money, qty, ymd } from '../format';
import { useStore } from '../store';

// Detalle de un producto (con receta y producción) o de un ingrediente (con las recetas que lo usan).
export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currency } = useStore();
  const [product, setProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const [res, cats] = await Promise.all([api.product(id), api.categories()]);
    setProduct(res.data);
    setCategories(cats.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [id]);

  if (!product) return <div className="page text-[#6b6266]">{error || 'Cargando…'}</div>;

  const isIngredient = product.kind === 'ingredient';
  const backPath = isIngredient ? '/ingredientes' : '/productos';
  const margin =
    !isIngredient && Number(product.sale_price) > 0
      ? Math.round(((Number(product.sale_price) - Number(product.cost_price)) / Number(product.sale_price)) * 100)
      : null;

  return (
    <div className="page">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="mr-auto min-w-0">
          <Link className="text-link text-sm" to={backPath}>
            ← {isIngredient ? 'Ingredientes' : 'Productos'}
          </Link>
          <h1 className="text-2xl">{product.name}</h1>
          <div className="text-sm text-[#6b6266]">
            {product.category_name || 'Sin categoría'}
            {!product.active && ' · Desactivado'}
          </div>
        </div>
        <button className="pill-btn" onClick={() => setAdjusting(true)}>
          Ajustar stock
        </button>
        <button className="pill-btn" onClick={() => setEditing(true)}>
          Editar
        </button>
      </div>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="kpi-card">
          <div className="kpi-label">Stock</div>
          <div className="kpi-value">
            {qty(product.stock_qty)} {product.unit}
          </div>
          <div className="mt-1 text-xs text-[#6b6266]">Crítico: {qty(product.min_stock)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{isIngredient ? `Costo por ${product.unit}` : 'Costo por unidad'}</div>
          <div className="kpi-value">{money(product.cost_price, currency)}</div>
        </div>
        {!isIngredient && (
          <>
            <div className="kpi-card">
              <div className="kpi-label">Precio</div>
              <div className="kpi-value">{money(product.sale_price, currency)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Ganancia por unidad</div>
              <div className="kpi-value">{money(Number(product.sale_price) - Number(product.cost_price), currency)}</div>
              {margin != null && <div className="mt-1 text-xs text-[#6b6266]">{margin}% del precio</div>}
            </div>
          </>
        )}
        {isIngredient && product.supplier_name && (
          <div className="kpi-card">
            <div className="kpi-label">Proveedor</div>
            <div className="mt-1 font-medium">{product.supplier_name}</div>
          </div>
        )}
      </div>

      {!isIngredient && <RecipeEditor key={product.updated_at} product={product} onSaved={load} />}

      {/* Ingrediente: en qué recetas se usa */}
      {isIngredient && (
        <section className="mb-6">
          <h2 className="section-title">Se usa en</h2>
          <div className="list-card">
            {product.used_in.map((row) => (
              <Link key={row.id} to={`/productos/${row.id}`} className="list-row text-[#1c1a1b] no-underline">
                <span>{row.name}</span>
                <span className="text-[#5a5155]">
                  {Number(row.qty)} {product.unit} por tanda
                </span>
              </Link>
            ))}
            {!product.used_in.length && <div className="list-empty">Todavía no está en ninguna receta.</div>}
          </div>
        </section>
      )}

      {/* Producto: últimas tandas producidas */}
      {!isIngredient && product.batches.length > 0 && (
        <section className="mb-6">
          <h2 className="section-title">Últimas producciones</h2>
          <div className="list-card">
            {product.batches.map((row) => (
              <div key={row.id} className="list-row">
                <span>{ymd(row.produced_at)}</span>
                <span>
                  {qty(row.qty)} {product.unit} · {money(row.unit_cost, currency)} c/u
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <AttachmentsPanel
        title="Fotos"
        entityType="product"
        entityId={product.id}
        items={product.attachments || []}
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,.jpg,.jpeg,.png,.webp,.gif,.heic"
        helper="Podés subir fotos (hasta 12 MB cada una)."
        onChanged={load}
      />

      <section className="mb-6">
        <h2 className="section-title">Movimientos de stock</h2>
        <div className="list-card">
          {(product.movements || []).slice(0, 30).map((row) => (
            <div key={row.id} className="list-row">
              <div className="min-w-0">
                <div>{MOVEMENT_KINDS[row.kind] || row.kind}</div>
                <div className="truncate text-xs text-[#6b6266]">
                  {ymd(row.created_at)}
                  {row.notes ? ` · ${row.notes}` : ''}
                </div>
              </div>
              <span className={Number(row.qty) < 0 ? 'text-[#c5221f]' : 'text-[#137333]'}>
                {Number(row.qty) > 0 ? '+' : ''}
                {qty(row.qty)}
              </span>
            </div>
          ))}
          {!product.movements?.length && <div className="list-empty">Sin movimientos.</div>}
        </div>
      </section>

      <button className="pill-btn danger" onClick={() => setRemoving(true)}>
        Borrar {isIngredient ? 'ingrediente' : 'producto'}
      </button>

      {removing && (
        <ConfirmDangerModal
          title={`Borrar ${product.name}`}
          message={`Se va a borrar ${product.name}. Si ya tiene ventas, encargos, compras, producción o está en una receta, no se puede borrar: en ese caso desactivalo desde Editar.`}
          onClose={() => setRemoving(false)}
          onConfirm={async () => {
            await api.deleteProduct(product.id);
            navigate(backPath);
          }}
        />
      )}
      {adjusting && (
        <StockAdjustModal
          product={product}
          onClose={() => setAdjusting(false)}
          onSave={async (body) => {
            await api.adjustStock(product.id, body);
            setAdjusting(false);
            await load();
          }}
        />
      )}
      {editing && (
        <ProductForm
          form={toProductForm(product)}
          categories={categories}
          onClose={() => setEditing(false)}
          onSave={async (body) => {
            await api.saveProduct(product.id, body);
            setEditing(false);
            await load();
          }}
        />
      )}
    </div>
  );
}
