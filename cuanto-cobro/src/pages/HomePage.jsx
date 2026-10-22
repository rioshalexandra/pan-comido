import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../lib/useData';
import { useStore } from '../store';
import { missingSettings, recipeCosts } from '../lib/costs';
import { dateText, money } from '../lib/format';
import { Loading, MarginChip } from '../components/ui';
import { BackupReminder } from './BackupPage';

export default function HomePage() {
  const { settings, user } = useStore();
  const { data: recipes, error } = useData('/api/recipes');
  const { data: ingredients } = useData('/api/ingredients');
  const { data: changes } = useData('/api/price-changes');

  const rows = useMemo(() => (recipes || []).map((r) => ({ ...r, costs: recipeCosts(r, settings) })), [recipes, settings]);
  if (!recipes || !ingredients) return <Loading error={error} />;

  const firstName = (settings.business_name || user.name || '').split(' ')[0];
  const toReview = rows.filter((r) => r.items.length && r.costs.price > 0 && r.costs.suggested > r.costs.price);
  const best = rows
    .filter((r) => r.costs.perWorkHour != null)
    .sort((a, b) => b.costs.perWorkHour - a.costs.perWorkHour)
    .slice(0, 3);
  const low = ingredients.filter((i) => i.min_stock > 0 && i.stock_qty <= i.min_stock);
  const rises = (changes || []).filter((c) => c.new_unit_cost > c.old_unit_cost);

  const steps = [
    { done: !missingSettings(settings), to: '/ajustes', text: 'Cargá cuánto vale tu hora y lo que pagás de luz y gas' },
    { done: ingredients.length > 0, to: '/ingredientes', text: 'Cargá tus ingredientes con el precio del paquete' },
    { done: recipes.some((r) => r.items.length), to: '/recetas/nueva', text: 'Armá tu primera receta y mirá cuánto te cuesta' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="page-title">Hola{firstName ? `, ${firstName}` : ''} 👋</h1>
        <p className="mt-1 text-cocoa-soft">Acá ves si tus precios te dejan ganancia.</p>
      </div>

      <BackupReminder />

      {steps.some((s) => !s.done) && (
        <section className="card p-4">
          <div className="section-title mb-3">Para empezar</div>
          <ol className="flex flex-col gap-2">
            {steps.map((s, i) => (
              <li key={s.to}>
                <Link to={s.to} className={`flex items-center gap-3 rounded-xl p-2.5 ${s.done ? 'text-cocoa-soft line-through' : 'bg-gold-soft/60 font-semibold'}`}>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm ${s.done ? 'bg-good text-white' : 'bg-gold text-white'}`}>
                    {s.done ? '✓' : i + 1}
                  </span>
                  {s.text}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Tile to="/recetas" icon="📖" value={recipes.length} label="recetas" />
        <Tile to="/recetas" icon="⚠️" value={toReview.length} label="para revisar precio" alert={toReview.length > 0} />
        <Tile to="/proveedores" icon="🛒" value={low.length} label="para comprar" alert={low.length > 0} />
      </div>

      {toReview.length > 0 && (
        <section className="card p-4">
          <div className="section-title mb-1">Estás cobrando de menos</div>
          <p className="mb-3 text-sm text-cocoa-soft">Para ganar el {settings.target_margin ?? 60}% que buscás, estas recetas deberían costar más:</p>
          <div className="flex flex-col gap-2">
            {toReview.slice(0, 5).map((r) => (
              <Link key={r.id} to={`/recetas/${r.id}`} className="flex items-center gap-3 rounded-xl bg-cream p-2.5">
                <span className="text-2xl">{r.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{r.name}</span>
                  <span className="block text-sm">
                    Vendés a {money(r.costs.price)} → sugerido <strong className="text-gold-dark">{money(r.costs.suggested)}</strong>
                  </span>
                </span>
                <MarginChip value={r.costs.realMargin} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {best.length > 0 && (
        <section className="card p-4">
          <div className="section-title mb-1">Qué conviene producir</div>
          <p className="mb-3 text-sm text-cocoa-soft">Las que más te dejan por cada hora de trabajo.</p>
          <div className="flex flex-col gap-2">
            {best.map((r, i) => (
              <Link key={r.id} to={`/recetas/${r.id}`} className="flex items-center gap-3 rounded-xl bg-cream p-2.5">
                <span className="w-5 text-center font-bold text-cocoa-soft">{i + 1}</span>
                <span className="text-2xl">{r.emoji}</span>
                <span className="min-w-0 flex-1 truncate font-bold">{r.name}</span>
                <span className="font-bold text-plum">{money(r.costs.perWorkHour)}/h</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {rises.length > 0 && (
        <section className="card p-4">
          <div className="section-title mb-2">Subas de precio (últimos 30 días)</div>
          <div className="flex flex-col gap-1 text-sm">
            {rises.slice(0, 6).map((c) => (
              <div key={c.id} className="flex justify-between gap-2">
                <span>
                  {c.name} <span className="text-cocoa-soft">· {dateText(c.changed_at)}</span>
                </span>
                <strong className="text-bad">+{Math.round(((c.new_unit_cost - c.old_unit_cost) / (c.old_unit_cost || 1)) * 100)}%</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Link to="/recetas/nueva" className="btn btn-primary">
          + Nueva receta
        </Link>
        <Link to="/produccion" className="btn">
          👩‍🍳 Anotar producción
        </Link>
        <Link to="/presupuestos/nuevo" className="btn">
          🧾 Hacer presupuesto
        </Link>
        <Link to="/lista-precios" className="btn">
          📋 Lista de precios
        </Link>
      </div>
    </div>
  );
}

function Tile({ to, icon, value, label, alert }) {
  return (
    <Link to={to} className={`card p-3 text-center ${alert ? 'border-gold' : ''}`}>
      <div className="text-xl">{icon}</div>
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-[11px] leading-tight text-cocoa-soft">{label}</div>
    </Link>
  );
}
