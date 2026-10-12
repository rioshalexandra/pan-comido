import { NavLink, Outlet } from 'react-router-dom';
import {
  ClipboardList,
  Cookie,
  CookingPot,
  FileSpreadsheet,
  History,
  Home,
  LogOut,
  Menu,
  NotebookPen,
  PackagePlus,
  Percent,
  Receipt,
  Settings,
  ShoppingBag,
  Truck,
  Users,
  Wallet,
  Wheat,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../auth';
import { useStore } from '../store';
import PoweredBy from './PoweredBy';

// Menú completo, agrupado por lo que se va a hacer:
//   Caja       → atender al cliente (vender y tomar encargos)
//   Registros  → todo lo que se carga y registra
//   Consultas  → para mirar lo que pasó
//   Ajustes    → herramientas que se usan de vez en cuando
export const NAV_GROUPS = [
  { title: null, items: [{ to: '/', label: 'Inicio', icon: Home, end: true }] },
  {
    title: 'Caja',
    items: [
      { to: '/vender', label: 'Vender', icon: Wallet },
      { to: '/encargos', label: 'Encargos', icon: ClipboardList },
    ],
  },
  {
    title: 'Registros',
    items: [
      { to: '/produccion', label: 'Producción', icon: CookingPot },
      { to: '/recetas', label: 'Recetas', icon: NotebookPen },
      { to: '/productos', label: 'Productos', icon: Cookie },
      { to: '/ingredientes', label: 'Ingredientes', icon: Wheat },
      { to: '/clientes', label: 'Clientes', icon: Users },
      { to: '/proveedores', label: 'Proveedores', icon: Truck },
      { to: '/pedido', label: 'Pedido a proveedores', icon: ShoppingBag },
    ],
  },
  {
    title: 'Consultas',
    items: [
      { to: '/ventas', label: 'Ventas', icon: Receipt },
      { to: '/compras', label: 'Compras', icon: PackagePlus },
      { to: '/pagos', label: 'Pagos', icon: Wallet },
      { to: '/movimientos', label: 'Movimientos de stock', icon: History },
    ],
  },
  {
    title: 'Ajustes',
    items: [
      { to: '/precios', label: 'Precios', icon: Percent },
      { to: '/importar', label: 'CSV / Excel', icon: FileSpreadsheet },
      { to: '/configuracion', label: 'Configuración', icon: Settings },
    ],
  },
];

// Barra inferior del celular: lo de todos los días al alcance del pulgar
const BOTTOM = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/encargos', label: 'Encargos', icon: ClipboardList },
  { to: '/vender', label: 'Vender', icon: Wallet, accent: true },
  { to: '/produccion', label: 'Producción', icon: CookingPot },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { settings } = useStore();
  const [open, setOpen] = useState(false);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="flex min-w-0 items-center gap-2">
          <div className="brand-mark grid h-9 w-9 shrink-0 place-items-center rounded-full sm:h-10 sm:w-10">
            <Cookie size={18} />
          </div>
          <div className="min-w-0">
            <div className="brand-name truncate text-lg sm:text-xl">{settings?.name || 'Pan Comido'}</div>
            <div className="truncate text-xs text-[#6b6266]">Pastelería · {user?.name || user?.username}</div>
          </div>
        </div>
        <button className="icon-btn ml-auto" type="button" onClick={logout} title="Salir">
          <LogOut size={18} />
        </button>
      </header>

      {/* Menú completo (celular): se abre con "Más" */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <aside className="drawer" onClick={(ev) => ev.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="brand-name text-lg">Menú</div>
              <button className="icon-btn" type="button" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <Nav onPick={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="side-nav hidden lg:block">
          <Nav />
        </aside>
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>

      {/* Barra inferior (solo celular) */}
      <nav className="bottom-nav lg:hidden" aria-label="Accesos rápidos">
        {BOTTOM.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `bottom-link ${item.accent ? 'accent' : ''} ${isActive ? 'active' : ''}`}
          >
            <item.icon size={item.accent ? 24 : 20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button type="button" className="bottom-link" onClick={() => setOpen(true)}>
          <Menu size={20} />
          <span>Más</span>
        </button>
      </nav>
      <div className="hidden lg:block">
        <PoweredBy />
      </div>
    </div>
  );
}

function Nav({ onPick }) {
  return (
    <nav>
      {NAV_GROUPS.map((group) => (
        <div key={group.title || 'inicio'}>
          {group.title && <div className="nav-group">{group.title}</div>}
          {group.items.map((item) => (
            <NavItem key={item.to} item={item} onPick={onPick} />
          ))}
        </div>
      ))}
    </nav>
  );
}

function NavItem({ item, onPick }) {
  return (
    <NavLink to={item.to} end={item.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onPick}>
      <item.icon size={18} />
      {item.label}
    </NavLink>
  );
}
