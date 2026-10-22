import { money } from '../lib/format';

// Barra que reparte el precio de venta: ingredientes, trabajo, luz y gas y lo que queda
export default function PriceBar({ costs }) {
  const price = costs.price;
  if (!(price > 0)) return null;
  const left = price - costs.fullUnit;
  const parts = [
    { label: 'Ingredientes', value: costs.ingredientsUnit, color: '#d9a441' },
    { label: 'Tu trabajo', value: costs.laborUnit, color: '#8a5a7a' },
    { label: 'Luz y gas', value: costs.energyUnit, color: '#e07a5f' },
    { label: left >= 0 ? 'Te queda' : 'Perdés', value: Math.abs(left), color: left >= 0 ? '#4c9a6a' : '#c0392b' },
  ].filter((p) => p.value > 0.004);
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div>
      <div className="flex h-5 overflow-hidden rounded-full bg-line" role="img" aria-label="Cómo se reparte el precio">
        {parts.map((p) => (
          <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${money(p.value)}`} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-cocoa-soft">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
            {p.label} {money(p.value)} ({Math.round((p.value / price) * 100)}%)
          </span>
        ))}
      </div>
    </div>
  );
}
