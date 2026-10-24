import { NavLink } from 'react-router-dom';
import { useStore } from '../store';
import { whatsappLink } from '../lib/format';

const MAIN = [
  { to: '/', label: 'Inicio', icon: '🏠', end: true },
  { to: '/recetas', label: 'Recetas', icon: '📖' },
  { to: '/ingredientes', label: 'Ingredientes', icon: '🧈' },
  { to: '/produccion', label: 'Producción', icon: '👩‍🍳' },
];
const EXTRA = [
  { to: '/presupuestos', label: 'Presupuestos', icon: '🧾' },
  { to: '/lista-precios', label: 'Lista de precios', icon: '📋' },
  { to: '/proveedores', label: 'Proveedores y compras', icon: '🚚' },
  { to: '/ajustes', label: 'Ajustes', icon: '⚙️' },
];

export default function Layout({ children }) {
  const { appName, user, settings, logout, examples, sellerPhone } = useStore();
  const extra = user.role === 'admin' ? [...EXTRA, { to: '/admin', label: 'Cuentas de clientas', icon: '🔑' }] : EXTRA;
  const link = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold ${
      isActive ? 'bg-gold-soft text-cocoa' : 'text-cocoa-soft hover:bg-gold-soft/50'
    }`;

  return (
    <div className="min-h-screen md:flex">
      {/* Menú lateral en compu */}
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-paper p-4 md:flex">
        <div className="mb-6 px-2">
          <div className="font-display text-2xl font-bold">{appName}</div>
          <div className="truncate text-sm text-cocoa-soft">{settings.business_name || user.name}</div>
        </div>
        <nav className="flex flex-col gap-1">
          {[...MAIN, ...extra].map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={link}>
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button className="btn btn-sm mt-auto" onClick={logout}>
          Salir
        </button>
      </aside>

      <main className="mx-auto w-full max-w-3xl px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-12">
        {examples === 'demo' && (
          <div className="no-print notice mb-4 text-sm">
            👋 Estás en la <strong>demo</strong>. Tocá todo lo que quieras: lo que cargues se borra cuando salís.{' '}
            <a
              className="font-bold underline"
              href={sellerPhone ? whatsappLink(sellerPhone, `Hola! Probé la demo de ${appName} y quiero mi cuenta`) : '/presentacion'}
              target={sellerPhone ? '_blank' : undefined}
              rel="noreferrer"
            >
              Quiero mi cuenta
            </a>
          </div>
        )}
        {children}
      </main>

      {/* Barra de abajo en el celular */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {[...MAIN, { to: '/mas', label: 'Más', icon: '☰' }].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold ${isActive ? 'text-gold-dark' : 'text-cocoa-soft'}`
            }
          >
            <span className="text-xl leading-none">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
