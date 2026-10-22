import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../lib/useData';
import { useStore } from '../store';
import { recipeCosts, missingSettings } from '../lib/costs';
import { money } from '../lib/format';
import { number } from '../lib/units';
import { Empty, Header, Loading, MarginChip } from '../components/ui';

const SORTS = [
  { value: 'name', label: 'Nombre (A-Z)' },
  { value: 'margin', label: 'Margen real' },
  { value: 'hour', label: 'Ganancia por hora' },
];

export default function RecipesPage() {
  const { settings } = useStore();
  const { data, error } = useData('/api/recipes');
  const [sort, setSort] = useState('name');
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const list = (data || [])
      .map((r) => ({ ...r, costs: recipeCosts(r, settings) }))
      .filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase()));
    const val = (r) => (sort === 'margin' ? r.costs.realMargin : r.costs.perWorkHour) ?? -Infinity;
    if (sort !== 'name') list.sort((a, b) => val(b) - val(a));
    return list;
  }, [data, settings, sort, q]);

  return (
    <div>
      <Header title="Recetas" subtitle="Cuánto te cuesta cada una y cuánto te deja.">
        <Link to="/recetas/nueva" className="btn btn-primary">
          + Nueva receta
        </Link>
      </Header>

      {missingSettings(settings) && (
        <div className="notice mb-4">
          Para ver el <strong>margen real</strong> cargá el valor de tu hora y la luz y el gas en{' '}
          <Link to="/ajustes" className="font-bold underline">
            Ajustes
          </Link>
          .
        </div>
      )}

      {!data ? (
        <Loading error={error} />
      ) : !data.length ? (
        <Empty icon="📖" title="Todavía no hay recetas">
          Primero cargá tus ingredientes con su precio, después armá la receta.
        </Empty>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <input className="input max-w-xs flex-1" placeholder="Buscar receta…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar por">
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  Ordenar: {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            {rows.map((r) => {
              const c = r.costs;
              const low = c.price > 0 && c.suggested > c.price;
              return (
                <Link key={r.id} to={`/recetas/${r.id}`} className="card flex items-center gap-3 p-3.5 hover:border-gold/60">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gold-soft text-2xl">{r.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{r.name}</span>
                    <span className="block text-sm text-cocoa-soft">
                      Rinde {number(r.yield_qty)} {r.yield_unit} · cuesta {money(c.fullUnit)} c/u · vendés a {money(c.price)}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <MarginChip value={c.realMargin} />
                      {c.perWorkHour != null && <span className="chip bg-plum/10 text-plum">{money(c.perWorkHour)} por hora</span>}
                      {low && <span className="chip bg-gold-soft text-gold-dark">sugerido {money(c.suggested)}</span>}
                    </span>
                  </span>
                  <span className="text-cocoa-soft">›</span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
