import { marginTone } from '../lib/costs';

export function Header({ title, subtitle, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-cocoa-soft">{subtitle}</p>}
      </div>
      {children && <div className="no-print flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Loading({ error }) {
  if (error) return <div className="error">{error}</div>;
  return <div className="py-10 text-center text-cocoa-soft">Cargando…</div>;
}

export function Empty({ icon, title, children }) {
  return (
    <div className="card px-6 py-10 text-center">
      <div className="mb-2 text-4xl">{icon}</div>
      <div className="font-bold">{title}</div>
      <div className="mt-1 text-sm text-cocoa-soft">{children}</div>
    </div>
  );
}

export function MarginChip({ value, label = 'margen real' }) {
  if (value == null) return <span className="chip bg-line/60 text-cocoa-soft">sin minutos de trabajo</span>;
  const bg = value >= 50 ? 'bg-good/10' : value >= 30 ? 'bg-warn/10' : 'bg-bad/10';
  return (
    <span className={`chip ${bg} ${marginTone(value)}`}>
      {value < 0 ? `pierde ${Math.abs(value)}%` : `${value}% ${label}`}
    </span>
  );
}

export function Stat({ label, value, hint, tone = '' }) {
  return (
    <div className="rounded-xl bg-cream px-3 py-2.5">
      <div className="text-xs font-semibold text-cocoa-soft">{label}</div>
      <div className={`text-lg font-extrabold ${tone}`}>{value}</div>
      {hint && <div className="text-[11px] text-cocoa-soft">{hint}</div>}
    </div>
  );
}

// Ventana simple (en el celular sube desde abajo)
export function Modal({ title, onClose, children }) {
  return (
    <div className="no-print fixed inset-0 z-40 flex items-end justify-center bg-cocoa/40 md:items-center" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-paper p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <button className="btn btn-sm" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
