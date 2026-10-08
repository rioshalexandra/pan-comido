import { NavLink, useLocation } from 'react-router-dom';

const SECTIONS = [
  { test: (path) => path === '/', to: '/', label: 'Inicio', end: true },
  { test: (path) => path.startsWith('/agenda'), to: '/agenda', label: 'Agenda' },
  { test: (path) => path.startsWith('/servicios'), to: '/servicios', label: 'Servicios' },
  { test: (path) => path.startsWith('/productos'), to: '/productos', label: 'Productos' },
  { test: (path) => path.startsWith('/movimientos'), to: '/movimientos', label: 'Movimientos' },
  { test: (path) => path.startsWith('/clientes'), to: '/clientes', label: 'Clientes' },
  { test: (path) => path.startsWith('/proveedores'), to: '/proveedores', label: 'Proveedores' },
  { test: (path) => path.startsWith('/ventas'), to: '/ventas', label: 'Ventas' },
  { test: (path) => path.startsWith('/compras'), to: '/compras', label: 'Compras' },
  { test: (path) => path.startsWith('/pagos'), to: '/pagos', label: 'Pagos' },
  { test: (path) => path.startsWith('/precios'), to: '/precios', label: 'Precios' },
  { test: (path) => path.startsWith('/importar'), to: '/importar', label: 'CSV / Excel' },
  { test: (path) => path.startsWith('/configuracion'), to: '/configuracion', label: 'Configuración' },
];

export default function Sitemap() {
  const { pathname } = useLocation();
  const section = SECTIONS.find((item) => item.test(pathname)) || SECTIONS[0];
  const crumbs = section.to === '/' ? [SECTIONS[0]] : [SECTIONS[0], section];

  return (
    <nav className="sitemap" aria-label="Sitio">
      {crumbs.map((item, index) => (
        <span key={item.to} className="contents">
          {index > 0 && <span className="sitemap-sep">/</span>}
          <NavLink
            to={item.to}
            end={item.end}
            className={({ isActive }) => `sitemap-btn${isActive ? ' active' : ''}`}
          >
            {item.label}
          </NavLink>
        </span>
      ))}
    </nav>
  );
}
