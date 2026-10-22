import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { whatsappLink } from '../lib/format';

export default function MorePage() {
  const { user, logout, sellerPhone, appName } = useStore();
  const items = [
    { to: '/presupuestos', label: 'Presupuestos', hint: 'Armá el precio de un encargo y mandalo por WhatsApp', icon: '🧾' },
    { to: '/lista-precios', label: 'Lista de precios', hint: 'Una imagen con tus precios para WhatsApp o Instagram', icon: '📋' },
    { to: '/copia', label: 'Copia de seguridad', hint: 'Tus datos están en este celular: guardá una copia', icon: '💾' },
    { to: '/proveedores', label: 'Proveedores y compras', hint: 'Pedido, compras, pagos y lo que debés', icon: '🚚' },
    { to: '/ajustes', label: 'Ajustes', hint: 'Tu hora, luz y gas, margen y contraseña', icon: '⚙️' },
  ];
  if (user.role === 'admin') items.push({ to: '/admin', label: 'Cuentas de clientas', hint: 'Dar acceso a quien compra la app', icon: '🔑' });
  return (
    <div className="flex flex-col gap-3">
      <h1 className="page-title">Más</h1>
      {items.map((item) => (
        <Link key={item.to} to={item.to} className="card flex items-center gap-3 p-4">
          <span className="text-2xl">{item.icon}</span>
          <span>
            <span className="block font-bold">{item.label}</span>
            <span className="block text-sm text-cocoa-soft">{item.hint}</span>
          </span>
        </Link>
      ))}
      {sellerPhone && user.role !== 'admin' && (
        <a className="card flex items-center gap-3 p-4" href={whatsappLink(sellerPhone, `Hola! Te escribo por ${appName}: `)} target="_blank" rel="noreferrer">
          <span className="text-2xl">💬</span>
          <span className="font-bold">Pedir ayuda por WhatsApp</span>
        </a>
      )}
      <button className="btn mt-2" onClick={logout}>
        Salir
      </button>
    </div>
  );
}
