import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, CookingPot, PackageOpen, ShoppingBag, Sparkles, Trophy, Wallet } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { METHODS, ORDER_STATUSES, addDays, longDate, money, qty, today, ymd } from '../format';
import { useStore } from '../store';
import { marginTone, recipeCosts } from '../lib/costs';
import { productIcon } from '../lib/icons';

// Inicio de Pan Comido: caja del día, encargos próximos, qué hornear y qué comprar.
export default function DashboardPage() {
  const { currency, settings } = useStore();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const [products, setProducts] = useState([]);

  useEffect(() => {
    api.dashboard(today()).then((res) => setData(res.data)).catch((err) => setError(err.message));
    // Para "Qué conviene producir" (si falla, la tarjeta no se muestra)
    api.products('?kind=product').then((res) => setProducts(res.data)).catch(() => {});
  }, []);

  if (!data && !error) return <div className="page text-[#6b6266]">Cargando…</div>;

  const cashTotal = (data?.cashToday || []).reduce((sum, row) => sum + Number(row.total), 0);
  const firstName = String(user?.name || '').split(' ')[0];

  return (
    <div className="page">
      <h1 className="text-2xl">Hola{firstName && firstName !== 'Administración' ? `, ${firstName}` : ''}</h1>
      <div className="mb-5 text-sm text-[#6b6266] first-letter:uppercase">{longDate(today())}</div>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Kpi label="Ventas de hoy" value={money(data.todaySales.total, currency)} hint={`${data.todaySales.count} ventas`} />
            <Kpi label="Ventas del mes" value={money(data.month.total, currency)} hint={`${data.month.count} ventas`} />
            <Kpi
              className="col-span-2 sm:col-span-1"
              label="Ganancia del mes"
              value={money(data.month.margin, currency)}
              hint="Precio menos costo"
            />
          </div>

          <div className="mb-6 grid gap-6 xl:grid-cols-[3fr_2fr]">
            <div className="grid content-start gap-6">
              {/* Encargos de hoy y mañana */}
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="section-title m-0 flex items-center gap-2">
                    <ClipboardList size={18} /> Encargos de hoy y mañana
                  </h2>
                  <Link className="text-link text-sm" to="/encargos">
                    Ver todos
                  </Link>
                </div>
                <ol className="agenda-thread compact">
                  {data.orders.map((row) => {
                    const day = ymd(row.due_date);
                    const when = day === today() ? 'Hoy' : day === addDays(today(), 1) ? 'Mañana' : 'Atrasado';
                    return (
                      <li key={row.id} className={`agenda-item order-${row.status}`}>
                        <div className="agenda-time">
                          <div className="font-semibold">{row.due_hhmm || '—'}</div>
                          <div className={`text-[11px] ${when === 'Atrasado' ? 'text-[#c5221f]' : 'text-[#6b6266]'}`}>{when}</div>
                        </div>
                        <Link to="/encargos" className="agenda-card block text-[#1c1a1b] no-underline">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium">{row.customer}</div>
                              <div className="text-sm text-[#5a5155]">{row.summary}</div>
                              <div className="mt-1 text-xs text-[#6b6266]">
                                {row.fulfillment === 'delivery' ? 'Envío' : 'Retira'} · falta{' '}
                                {money(Math.max(Number(row.total) - Number(row.deposit), 0), currency)}
                              </div>
                            </div>
                            <span className={`badge order-badge-${row.status}`}>{ORDER_STATUSES[row.status]}</span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                  {!data.orders.length && (
                    <li className="agenda-empty">
                      No hay encargos para hoy ni mañana.{' '}
                      <Link className="text-link" to="/encargos?nuevo=1">
                        Cargar un encargo
                      </Link>
                    </li>
                  )}
                </ol>
              </section>

              {/* Qué hornear */}
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="section-title m-0 flex items-center gap-2">
                    <CookingPot size={18} /> Qué hornear
                  </h2>
                  <Link className="text-link text-sm" to="/produccion">
                    Ir a producción
                  </Link>
                </div>
                <div className="list-card">
                  {data.toBake.map((row) => (
                    <div key={row.id} className="list-row">
                      <div className="min-w-0">
                        <div className="truncate">{row.name}</div>
                        <div className="text-xs text-[#6b6266]">
                          Hay {qty(row.stock_qty)}
                          {Number(row.ordered) > 0 && ` · encargos ${qty(row.ordered)}`}
                        </div>
                      </div>
                      <span className="gold-pill">
                        {row.to_make} {row.unit}
                      </span>
                    </div>
                  ))}
                  {!data.toBake.length && <div className="list-empty">Alcanza para los encargos y el stock crítico.</div>}
                </div>
              </section>
            </div>

            <div className="grid content-start gap-6">
              {/* Caja del día */}
              <section>
                <h2 className="section-title flex items-center gap-2">
                  <Wallet size={18} /> Caja de hoy
                </h2>
                <div className="list-card">
                  {data.cashToday.map((row) => (
                    <div key={row.method} className="list-row">
                      <span>{METHODS[row.method] || row.method}</span>
                      <span className="font-medium">{money(row.total, currency)}</span>
                    </div>
                  ))}
                  {data.cashToday.length > 0 && (
                    <div className="list-row bg-[#f7efe0]">
                      <span>
                        Total <span className="text-xs text-[#6b6266]">(incluye señas)</span>
                      </span>
                      <strong>{money(cashTotal, currency)}</strong>
                    </div>
                  )}
                  {!data.cashToday.length && <div className="list-empty">Todavía no se cobró nada hoy.</div>}
                </div>
              </section>

              {/* Para comprar */}
              <section>
                <h2 className="section-title flex items-center gap-2">
                  <PackageOpen size={18} /> Para comprar
                </h2>
                <div className="list-card">
                  {data.toBuy.map((row) => (
                    <Link
                      key={row.id}
                      to={`/${row.kind === 'ingredient' ? 'ingredientes' : 'productos'}/${row.id}`}
                      className="list-row text-[#1c1a1b] no-underline"
                    >
                      <span>{row.name}</span>
                      <span className="badge badge-low">
                        {qty(row.stock_qty)} / crítico {qty(row.min_stock)} {row.unit}
                      </span>
                    </Link>
                  ))}
                  {!data.toBuy.length && <div className="list-empty">No falta ningún ingrediente.</div>}
                </div>
                {data.toBuy.length > 0 && (
                  <Link className="pill-btn primary mt-3 inline-flex items-center gap-1 no-underline" to="/pedido">
                    <ShoppingBag size={15} /> Armar pedido
                  </Link>
                )}
              </section>

              <BestToProduce products={products} settings={settings} currency={currency} />

              {/* Lo más vendido */}
              <section>
                <h2 className="section-title flex items-center gap-2">
                  <Trophy size={18} /> Lo más vendido del mes
                </h2>
                <div className="list-card">
                  {data.topProducts.map((row) => (
                    <div key={row.product_id} className="list-row">
                      <span>{row.name}</span>
                      <span className="text-[#5a5155]">
                        {qty(row.qty)} · {money(row.total, currency)}
                      </span>
                    </div>
                  ))}
                  {!data.topProducts.length && <div className="list-empty">Todavía no hay ventas este mes.</div>}
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Las 3 recetas que más dejan por cada hora de trabajo (solo las que tienen los minutos cargados)
function BestToProduce({ products, settings, currency }) {
  if (!Number(settings?.labor_hour_rate)) return null;
  const ranked = products
    .filter((row) => row.recipe_count > 0 && row.active !== false)
    .map((row) => ({
      row,
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
    .filter((item) => item.costs?.perWorkHour != null)
    .sort((a, b) => b.costs.perWorkHour - a.costs.perWorkHour)
    .slice(0, 3);
  if (!ranked.length) return null;
  return (
    <section>
      <h2 className="section-title flex items-center gap-2">
        <Sparkles size={18} /> Qué conviene producir
      </h2>
      <div className="list-card">
        {ranked.map(({ row, costs }, index) => (
          <Link key={row.id} to={`/recetas/${row.id}`} className="list-row text-inherit no-underline hover:bg-[#faf6ee]">
            <span className="flex min-w-0 items-center gap-2">
              <span className="w-4 text-xs font-semibold text-[#6b6266]">{index + 1}</span>
              {productIcon(row) && <span aria-hidden="true">{productIcon(row)}</span>}
              <span className="truncate">{row.name}</span>
            </span>
            <span className="shrink-0 text-right">
              <strong>{money(costs.perWorkHour, currency)}</strong>
              <span className="text-xs text-[#6b6266]"> por hora</span>
              {costs.realMargin != null && (
                <span className={`ml-2 text-xs ${marginTone(costs.realMargin)}`}>{costs.realMargin}%</span>
              )}
            </span>
          </Link>
        ))}
      </div>
      <p className="mb-0 mt-2 text-xs text-[#6b6266]">
        Lo que te deja cada hora de trabajo, ya descontando ingredientes, luz y gas.{' '}
        <Link to="/recetas" className="text-link">
          Ver todas las recetas
        </Link>
      </p>
    </section>
  );
}

function Kpi({ label, value, hint, className = '' }) {
  return (
    <div className={`kpi-card ${className}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="mt-1 text-xs text-[#6b6266]">{hint}</div>
    </div>
  );
}
