import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import CheckoutModal from '../components/CheckoutModal';
import { money } from '../format';
import { useStore } from '../store';

// Venta de mostrador: alguien pasa por el local, elige y paga en el momento.
export default function CobrarPage() {
  const navigate = useNavigate();
  const { currency } = useStore();
  const [done, setDone] = useState(null);
  const [round, setRound] = useState(0); // para reiniciar el formulario en cada cobro nuevo

  return (
    <div className="page">
      <h1 className="mb-4 text-2xl">Vender</h1>
      {done ? (
        <div className="card-tile mx-auto max-w-md text-center">
          <CheckCircle2 size={40} className="mx-auto mb-2 text-[#137333]" />
          <div className="text-lg font-medium">Venta registrada</div>
          <div className="mb-4 text-3xl font-semibold">{money(done.total, currency)}</div>
          <div className="mb-4 text-sm text-[#5a5155]">
            {done.number}
            {done.customer_name && ` · ${done.customer_name}`}
          </div>
          <div className="flex justify-center gap-2">
            <Link className="pill-btn inline-flex items-center no-underline" to={`/ventas/${done.id}`}>
              Ver / imprimir
            </Link>
            <button
              className="pill-btn primary"
              onClick={() => {
                setDone(null);
                setRound((n) => n + 1);
              }}
            >
              Nueva venta
            </button>
          </div>
        </div>
      ) : (
        <CheckoutModal key={round} onClose={() => navigate(-1)} onDone={(sale) => setDone(sale)} />
      )}
    </div>
  );
}
