import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useData } from '../lib/useData';
import { useStore } from '../store';
import { marginTone, missingSettings, recipeCosts } from '../lib/costs';
import { money } from '../lib/format';
import { number, qtyText, unitCost } from '../lib/units';
import { printRecipe } from '../lib/recipeSheet';
import PriceBar from '../components/PriceBar';
import { Loading, MarginChip, Stat } from '../components/ui';

export default function RecipePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = useStore();
  const { data: recipe, setData, error } = useData(`/api/recipes/${id}`);
  const [batches, setBatches] = useState(1);
  const [target, setTarget] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const goal = target ?? Number(settings.target_margin ?? 60);
  const costs = useMemo(() => (recipe ? recipeCosts(recipe, { ...settings, target_margin: goal }) : null), [recipe, settings, goal]);

  if (!recipe) return <Loading error={error} />;

  async function applyPrice() {
    setBusy(true);
    try {
      const res = await api.post(`/api/recipes/${id}/price`, { sale_price: costs.suggested });
      setData(res.data);
      setNotice(`Listo, el precio de venta ahora es ${money(costs.suggested)}.`);
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    const res = await api.post(`/api/recipes/${id}/duplicate`);
    navigate(`/recetas/${res.data.id}/editar`);
  }

  async function remove() {
    if (!confirm(`¿Borrar la receta "${recipe.name}"? No se puede deshacer.`)) return;
    await api.del(`/api/recipes/${id}`);
    navigate('/recetas');
  }

  const priceIsLow = costs.price > 0 && costs.suggested > costs.price;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gold-soft text-3xl">{recipe.emoji}</span>
          <div className="min-w-0">
            <Link to="/recetas" className="text-sm font-semibold text-cocoa-soft">
              ‹ Recetas
            </Link>
            <h1 className="page-title">{recipe.name}</h1>
          </div>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          {recipe.items.length > 0 && (
            <button className="btn btn-sm" onClick={() => printRecipe(recipe, costs, settings.business_name) || alert('Permití las ventanas emergentes para descargar la ficha.')}>
              📄 Descargar ficha
            </button>
          )}
          <Link to={`/recetas/${id}/editar`} className="btn btn-sm btn-primary">
            ✏️ Editar
          </Link>
        </div>
      </div>

      {!recipe.items.length && (
        <div className="notice">
          Esta receta todavía no tiene ingredientes.{' '}
          <Link to={`/recetas/${id}/editar`} className="font-bold underline">
            Cargalos acá
          </Link>
          .
        </div>
      )}

      {/* Precio: lo primero que se quiere saber */}
      <section className="card p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Te cuesta cada una" value={money(costs.fullUnit)} hint="con trabajo, luz y gas" />
          <Stat label="La vendés a" value={costs.price > 0 ? money(costs.price) : 'sin precio'} />
          <Stat
            label={`Precio sugerido (${goal}%)`}
            value={money(costs.suggested)}
            tone={priceIsLow ? 'text-gold-dark' : ''}
            hint={priceIsLow ? 'estás cobrando menos' : costs.price > 0 ? 'tu precio está bien' : ''}
          />
        </div>
        <label className="mt-4 block text-sm font-semibold text-cocoa-soft">
          Margen que querés ganar: <strong className="text-cocoa">{goal}%</strong>
          <input
            type="range"
            min="10"
            max="85"
            step="5"
            value={goal}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="mt-1 w-full accent-gold"
          />
        </label>
        {costs.suggested > 0 && costs.suggested !== costs.price && (
          <button className="btn btn-sm btn-primary no-print mt-2" onClick={applyPrice} disabled={busy}>
            Usar {money(costs.suggested)} como precio de venta
          </button>
        )}
        {notice && <div className="notice mt-3">{notice}</div>}
      </section>

      {costs.price > 0 && (
        <section className="card p-4">
          <div className="section-title mb-3">Cómo se reparte el precio</div>
          <PriceBar costs={costs} />
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Margen bruto" value={`${costs.grossMargin}%`} hint="solo ingredientes" />
            <Stat label="Margen real" value={costs.realMargin == null ? '—' : `${costs.realMargin}%`} tone={marginTone(costs.realMargin)} hint="con todo" />
            <Stat label="Ganás por hora" value={costs.perWorkHour == null ? '—' : money(costs.perWorkHour)} hint="de tu trabajo" />
            <Stat label="Ganancia c/u" value={money(costs.profitUnit)} tone={costs.profitUnit < 0 ? 'text-bad' : ''} />
          </div>
          {costs.realMargin != null && costs.realMargin < 0 && (
            <div className="error mt-3">Ojo: con este precio esta receta pierde plata. Subí el precio o revisá los costos.</div>
          )}
          {missingSettings(settings) && (
            <div className="notice mt-3">
              Falta cargar tu hora y la luz y el gas en{' '}
              <Link to="/ajustes" className="font-bold underline">
                Ajustes
              </Link>{' '}
              para que el costo sea completo.
            </div>
          )}
        </section>
      )}

      {/* Desglose del costo */}
      <section className="card divide-y divide-line">
        <Row label="Ingredientes y packaging" value={money(costs.ingredientsUnit)} />
        <Row label={`Tu trabajo${costs.workMinutes ? ` (${number(costs.workMinutes)} min por tanda)` : ''}`} value={money(costs.laborUnit)} />
        <Row label={`Luz y gas${costs.ovenMinutes ? ` (${number(costs.ovenMinutes)} min de horno)` : ''}`} value={money(costs.energyUnit)} />
        <Row label={<strong>Costo completo por unidad</strong>} value={<strong>{money(costs.fullUnit)}</strong>} />
      </section>

      {/* Ingredientes con tandas */}
      {recipe.items.length > 0 && (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 bg-gold-soft/60 px-4 py-3">
            <label htmlFor="tandas" className="font-bold">
              Tandas a hacer: {batches}
            </label>
            <input id="tandas" type="range" min="1" max="10" value={batches} onChange={(e) => setBatches(Number(e.target.value))} className="min-w-0 flex-[1_1_160px] accent-gold" />
          </div>
          <div className="divide-y divide-line">
            {recipe.items.map((item) => {
              const short = item.stock_qty < item.qty * batches;
              return (
                <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    {item.name}
                    {item.is_packaging ? <span className="ml-1 text-xs text-cocoa-soft">(packaging)</span> : null}
                    {short && <span className="ml-1 text-xs font-bold text-bad">· no alcanza el stock</span>}
                  </span>
                  <span className="shrink-0 text-right text-cocoa-soft">
                    <strong className="text-cocoa">{qtyText(item.qty * batches, item.unit)}</strong> · {money(item.qty * batches * unitCost(item))}
                  </span>
                </div>
              );
            })}
            <div className="flex flex-wrap justify-between gap-2 bg-cream px-4 py-3">
              <span>
                Rinde <strong>{number(recipe.yield_qty * batches)}</strong> {recipe.yield_unit}
              </span>
              <span>
                {batches > 1 ? 'Total' : 'Tanda'} <strong>{money(costs.batchCost * batches)}</strong> · ingredientes c/u {money(costs.ingredientsUnit)}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* El procedimiento siempre a la vista, aunque esté vacío */}
      <section className="card p-4">
        <div className="section-title mb-2">Notas o procedimiento</div>
        {recipe.notes ? (
          <p className="whitespace-pre-wrap leading-relaxed">{recipe.notes}</p>
        ) : (
          <Link to={`/recetas/${id}/editar#notas`} className="text-gold-dark underline">
            Todavía no hay procedimiento. Tocá acá para escribirlo.
          </Link>
        )}
      </section>

      <div className="no-print flex flex-wrap gap-2">
        <button className="btn btn-sm" onClick={duplicate}>
          Duplicar receta
        </button>
        <Link to="/produccion" state={{ recipeId: recipe.id }} className="btn btn-sm">
          👩‍🍳 Registrar que la hice
        </Link>
        <button className="btn btn-sm btn-danger ml-auto" onClick={remove}>
          Borrar
        </button>
      </div>
      <MarginChipLegend />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <span className="text-cocoa-soft">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function MarginChipLegend() {
  return (
    <p className="text-xs text-cocoa-soft">
      Margen real: <MarginChip value={55} label="" /> bien · <MarginChip value={35} label="" /> justo · <MarginChip value={10} label="" /> bajo
    </p>
  );
}
