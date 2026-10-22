import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useData } from '../lib/useData';
import { useStore } from '../store';
import { recipeCosts } from '../lib/costs';
import { dateText, money, todayIso, whatsappLink } from '../lib/format';
import { Empty, Header, Loading } from '../components/ui';

const STATUS = {
  pendiente: { label: 'Esperando respuesta', chip: 'bg-gold-soft text-gold-dark' },
  aceptado: { label: 'Aceptado', chip: 'bg-good/10 text-good' },
  rechazado: { label: 'No lo tomó', chip: 'bg-line/60 text-cocoa-soft' },
};
const parse = (v) => Number(String(v ?? '').replace(',', '.')) || 0;
const pct = (total, cost) => (total > 0 ? Math.round(((total - cost) / total) * 100) : 0);

function longDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// El mensaje que le llega a la clienta por WhatsApp
export function quoteMessage(q, business) {
  const lines = [
    `Hola${q.customer ? ` ${q.customer.split(' ')[0]}` : ''}! Te paso el presupuesto${business ? ` de ${business}` : ''}:`,
    '',
    ...q.items.map((i) => `${i.emoji} ${i.qty} × ${i.name} — ${money(i.qty * i.unit_price)}`),
    ...q.extras.map((x) => `✨ ${x.label} — ${money(x.amount)}`),
  ];
  if (q.discount_pct > 0) lines.push(`🎁 Descuento ${q.discount_pct}%`);
  if (q.delivery > 0) lines.push(`🚚 Envío — ${money(q.delivery)}`);
  lines.push('', `*Total: ${money(q.total)}*`);
  if (q.deposit_pct > 0 && q.deposit_pct < 100) {
    lines.push(`Para reservar, seña del ${q.deposit_pct}%: ${money(Math.round((q.total * q.deposit_pct) / 100))}`);
  }
  if (q.due_date) lines.push(`Entrega: ${longDate(q.due_date)}`);
  if (q.notes) lines.push('', q.notes);
  if (q.valid_days > 0) lines.push('', `Precio válido por ${q.valid_days} días.`);
  lines.push('', '¡Gracias por elegirnos! 💛');
  return lines.join('\n');
}

export default function QuotesPage() {
  const { data: quotes, error, reload } = useData('/api/quotes');
  if (!quotes) return <Loading error={error} />;

  const open = quotes.filter((q) => q.status === 'pendiente');
  const accepted = quotes.filter((q) => q.status === 'aceptado');

  async function setStatus(q, status) {
    await api.post(`/api/quotes/${q.id}/status`, { status });
    reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <Header title="Presupuestos" subtitle="Armá el precio de un encargo y mandalo por WhatsApp.">
        <Link to="/presupuestos/nuevo" className="btn btn-primary">
          + Nuevo presupuesto
        </Link>
      </Header>

      {quotes.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div className="card p-3">
            <div className="text-xs font-semibold text-cocoa-soft">⏳ Esperando respuesta</div>
            <div className="text-xl font-extrabold">{money(open.reduce((s, q) => s + q.total, 0))}</div>
            <div className="text-[11px] text-cocoa-soft">{open.length} presupuesto{open.length === 1 ? '' : 's'}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs font-semibold text-cocoa-soft">✅ Aceptados</div>
            <div className="text-xl font-extrabold text-good">{money(accepted.reduce((s, q) => s + q.total, 0))}</div>
            <div className="text-[11px] text-cocoa-soft">{accepted.length} encargo{accepted.length === 1 ? '' : 's'}</div>
          </div>
        </div>
      )}

      {!quotes.length ? (
        <Empty icon="🧾" title="Todavía no hiciste presupuestos">
          Cuando te pregunten "¿cuánto sale?", tocá <strong>Nuevo presupuesto</strong>: elegís las recetas, sumás decoración y envío, y la app arma el mensaje.
        </Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {quotes.map((q) => (
            <div key={q.id} className="card p-4">
              <Link to={`/presupuestos/${q.id}`} className="flex items-start gap-3">
                <span className="text-2xl">{q.items[0]?.emoji || '🧾'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{q.customer || 'Sin nombre'}</span>
                  <span className="block truncate text-sm text-cocoa-soft">
                    {q.items.map((i) => `${i.qty} ${i.name}`).join(', ') || q.extras.map((x) => x.label).join(', ')}
                  </span>
                  <span className="block text-xs text-cocoa-soft">
                    {q.due_date ? `Entrega ${dateText(q.due_date)}` : `Hecho el ${dateText(q.created_at)}`}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-lg font-extrabold">{money(q.total)}</span>
                  <span className={`chip ${STATUS[q.status].chip}`}>{STATUS[q.status].label}</span>
                </span>
              </Link>
              {q.status === 'pendiente' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn btn-sm" onClick={() => setStatus(q, 'aceptado')}>
                    ✅ Lo aceptó
                  </button>
                  <button className="btn btn-sm" onClick={() => setStatus(q, 'rechazado')}>
                    No lo tomó
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const emptyItem = () => ({ key: Math.random(), recipe_id: '', qty: '1', unit_price: '' });
const emptyExtra = () => ({ key: Math.random(), label: '', amount: '', cost: '' });

export function QuoteEditPage() {
  const { id } = useParams();
  const isNew = id === 'nuevo';
  const navigate = useNavigate();
  const { settings } = useStore();
  const { data: recipes, error } = useData('/api/recipes');
  const [quote, setQuote] = useState(isNew ? null : undefined);
  const [f, setF] = useState({
    customer: '', phone: '', due_date: '', delivery: '', discount_pct: '', deposit_pct: '50', valid_days: '7', notes: '',
    items: [emptyItem()], extras: [],
  });
  const [notice, setNotice] = useState('');
  const [err, setErr] = useState('');
  const set = (key, value) => setF((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (isNew) return;
    api.get(`/api/quotes/${id}`).then((res) => {
      const q = res.data;
      setQuote(q);
      setF({
        customer: q.customer, phone: q.phone, due_date: q.due_date || '', delivery: q.delivery ? String(q.delivery) : '',
        discount_pct: q.discount_pct ? String(q.discount_pct) : '', deposit_pct: String(q.deposit_pct), valid_days: String(q.valid_days), notes: q.notes,
        items: q.items.map((i) => ({ key: Math.random(), recipe_id: i.recipe_id ? String(i.recipe_id) : '', name: i.name, emoji: i.emoji, qty: String(i.qty), unit_price: String(i.unit_price), unit_cost: i.unit_cost })),
        extras: q.extras.map((x) => ({ key: Math.random(), label: x.label, amount: String(x.amount), cost: x.cost ? String(x.cost) : '' })),
      });
    }).catch((e) => setErr(e.message));
  }, [id, isNew]);

  const costs = useMemo(() => new Map((recipes || []).map((r) => [String(r.id), { recipe: r, costs: recipeCosts(r, settings) }])), [recipes, settings]);
  const defaultPrice = (rid) => {
    const c = costs.get(String(rid));
    return c ? c.recipe.sale_price || c.costs.suggested : 0;
  };

  // Lo que se guarda: el costo de cada producto queda fijo al momento del presupuesto
  const payload = useMemo(() => {
    const items = f.items
      .filter((i) => i.recipe_id || i.name)
      .map((i) => {
        const c = costs.get(String(i.recipe_id));
        return {
          recipe_id: i.recipe_id ? Number(i.recipe_id) : null,
          name: c?.recipe.name || i.name,
          emoji: c?.recipe.emoji || i.emoji,
          qty: parse(i.qty),
          unit_price: i.unit_price === '' ? defaultPrice(i.recipe_id) : parse(i.unit_price),
          unit_cost: c ? c.costs.fullUnit : i.unit_cost || 0,
        };
      });
    const extras = f.extras.filter((x) => x.label).map((x) => ({ label: x.label, amount: parse(x.amount), cost: parse(x.cost) }));
    const subtotal = items.reduce((s, i) => s + i.qty * i.unit_price, 0) + extras.reduce((s, x) => s + x.amount, 0);
    const total = Math.round(subtotal * (1 - Math.min(100, parse(f.discount_pct)) / 100) + parse(f.delivery));
    const cost = items.reduce((s, i) => s + i.qty * i.unit_cost, 0) + extras.reduce((s, x) => s + x.cost, 0);
    return {
      customer: f.customer, phone: f.phone, due_date: f.due_date, items, extras, delivery: parse(f.delivery),
      discount_pct: parse(f.discount_pct), deposit_pct: f.deposit_pct === '' ? 0 : parse(f.deposit_pct), valid_days: parse(f.valid_days), notes: f.notes,
      total, cost: Math.round(cost),
    };
  }, [f, costs]);

  if (!recipes || quote === undefined) return <Loading error={error || err} />;

  const profit = payload.total - payload.delivery - payload.cost;
  const margin = pct(payload.total - payload.delivery, payload.cost);
  const deposit = Math.round((payload.total * payload.deposit_pct) / 100);
  const message = quoteMessage(payload, settings.business_name);
  const setItem = (key, patch) => set('items', f.items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const setExtra = (key, patch) => set('extras', f.extras.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  async function save() {
    setErr('');
    try {
      const res = isNew ? await api.post('/api/quotes', payload) : await api.put(`/api/quotes/${id}`, payload);
      if (isNew) navigate(`/presupuestos/${res.data.id}`, { replace: true });
      setQuote(res.data);
      setNotice('Guardado.');
      setTimeout(() => setNotice(''), 2000);
      return true;
    } catch (e) {
      setErr(e.message);
      return false;
    }
  }

  async function send() {
    if (!(await save())) return;
    window.open(whatsappLink(f.phone, message), '_blank');
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setNotice('¡Copiado! Pegalo en el chat.');
    } catch {
      setNotice('No se pudo copiar. Mantené apretado el texto de abajo para copiarlo.');
    }
  }

  async function remove() {
    if (!confirm('¿Borrar este presupuesto?')) return;
    await api.del(`/api/quotes/${id}`);
    navigate('/presupuestos');
  }

  return (
    <div className="flex flex-col gap-4">
      <Header title={isNew ? 'Nuevo presupuesto' : `Presupuesto${f.customer ? ` de ${f.customer}` : ''}`}>
        <Link to="/presupuestos" className="btn btn-sm">
          ‹ Presupuestos
        </Link>
      </Header>

      <section className="card flex flex-col gap-3 p-4">
        <div className="section-title">Para quién</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="field col-span-2">
            Nombre
            <input className="input" value={f.customer} onChange={(e) => set('customer', e.target.value)} placeholder="Ej: Laura (cumple de Mati)" />
          </label>
          <label className="field">
            WhatsApp
            <input className="input" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="11 2345 6789" />
          </label>
          <label className="field">
            Entrega
            <input className="input" type="date" min={todayIso()} value={f.due_date} onChange={(e) => set('due_date', e.target.value)} />
          </label>
        </div>
      </section>

      <section className="card flex flex-col gap-3 p-4">
        <div className="section-title">Qué lleva</div>
        {f.items.map((i) => {
          const c = costs.get(String(i.recipe_id));
          const price = i.unit_price === '' ? defaultPrice(i.recipe_id) : parse(i.unit_price);
          return (
            <div key={i.key} className="flex flex-col gap-2 rounded-xl bg-cream p-3">
              <div className="flex gap-2">
                <select
                  className="input flex-1"
                  aria-label="Receta"
                  value={i.recipe_id}
                  onChange={(e) => setItem(i.key, { recipe_id: e.target.value, unit_price: '' })}
                >
                  <option value="">{i.name && !i.recipe_id ? i.name : 'Elegí la receta…'}</option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.emoji} {r.name}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => set('items', f.items.filter((x) => x.key !== i.key))} aria-label="Sacar">
                  ✕
                </button>
              </div>
              {(i.recipe_id || i.name) && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="field">
                      Cantidad
                      <input className="input text-center" inputMode="decimal" value={i.qty} onChange={(e) => setItem(i.key, { qty: e.target.value })} />
                    </label>
                    <label className="field">
                      Precio c/u
                      <input className="input" inputMode="decimal" value={i.unit_price} placeholder={String(defaultPrice(i.recipe_id))} onChange={(e) => setItem(i.key, { unit_price: e.target.value })} />
                    </label>
                  </div>
                  <div className="flex justify-between text-xs text-cocoa-soft">
                    <span>{c ? `Te cuesta ${money(c.costs.fullUnit)} c/u${!c.recipe.sale_price ? ' · precio sugerido' : ''}` : ''}</span>
                    <strong className="text-cocoa">{money(parse(i.qty) * price)}</strong>
                  </div>
                </>
              )}
            </div>
          );
        })}
        <button type="button" className="btn btn-sm" onClick={() => set('items', [...f.items, emptyItem()])}>
          + Otra receta
        </button>

        <div className="section-title mt-2">Extras</div>
        {f.extras.map((x) => (
          <div key={x.key} className="grid grid-cols-[1fr_6.5rem_auto] items-end gap-2">
            <label className="field">
              Qué
              <input className="input" value={x.label} onChange={(e) => setExtra(x.key, { label: e.target.value })} placeholder="Ej: Decoración temática" />
            </label>
            <label className="field">
              Precio
              <input className="input" inputMode="decimal" value={x.amount} onChange={(e) => setExtra(x.key, { amount: e.target.value })} />
            </label>
            <button type="button" className="btn btn-sm btn-danger mb-1" onClick={() => set('extras', f.extras.filter((y) => y.key !== x.key))} aria-label="Sacar">
              ✕
            </button>
            <label className="field col-span-3 -mt-1">
              <span className="label-hint">¿Cuánto te cuesta a vos? (opcional, para calcular tu ganancia)</span>
              <input className="input" inputMode="decimal" value={x.cost} onChange={(e) => setExtra(x.key, { cost: e.target.value })} placeholder="Ej: 2500" />
            </label>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-sm" onClick={() => set('extras', [...f.extras, emptyExtra()])}>
            + Extra (decoración, cartel, topper…)
          </button>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-3">
          <label className="field">
            Envío
            <input className="input" inputMode="decimal" value={f.delivery} onChange={(e) => set('delivery', e.target.value)} placeholder="0" />
          </label>
          <label className="field">
            Descuento %
            <input className="input" inputMode="decimal" value={f.discount_pct} onChange={(e) => set('discount_pct', e.target.value)} placeholder="0" />
          </label>
          <label className="field">
            Seña %
            <input className="input" inputMode="decimal" value={f.deposit_pct} onChange={(e) => set('deposit_pct', e.target.value)} />
          </label>
          <label className="field">
            Precio válido (días)
            <input className="input" inputMode="numeric" value={f.valid_days} onChange={(e) => set('valid_days', e.target.value)} />
          </label>
          <label className="field col-span-2">
            Nota para la clienta (opcional)
            <input className="input" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Ej: Retiro por Lanús o envío a domicilio" />
          </label>
        </div>
      </section>

      <section className="card flex flex-col gap-3 p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="section-title">Total</div>
            <div className="font-display text-4xl font-bold">{money(payload.total)}</div>
          </div>
          {payload.deposit_pct > 0 && payload.deposit_pct < 100 && (
            <div className="text-right text-sm">
              <div className="text-cocoa-soft">Seña {payload.deposit_pct}%</div>
              <div className="text-lg font-extrabold text-gold-dark">{money(deposit)}</div>
            </div>
          )}
        </div>
        {payload.cost > 0 && (
          <div className={`rounded-xl px-3 py-2.5 text-sm ${margin >= (settings.target_margin ?? 60) ? 'bg-good/10' : margin >= 30 ? 'bg-gold-soft/70' : 'bg-bad/5'}`}>
            <div className="text-xs font-bold text-cocoa-soft">🔒 Solo lo ves vos</div>
            Te cuesta <strong>{money(payload.cost)}</strong> · ganás <strong>{money(profit)}</strong> ({margin}%)
            {margin < (settings.target_margin ?? 60) && <div className="text-xs">Está por debajo del {settings.target_margin ?? 60}% que querés ganar.</div>}
          </div>
        )}
        <details className="rounded-xl bg-cream p-3 text-sm">
          <summary className="cursor-pointer font-bold">Ver el mensaje que le llega</summary>
          <pre className="mt-2 font-sans whitespace-pre-wrap">{message}</pre>
        </details>
        {err && <div className="error">{err}</div>}
        {notice && <div className="notice">{notice}</div>}
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-primary col-span-2" onClick={send}>
            💬 Guardar y mandar por WhatsApp
          </button>
          <button className="btn" onClick={save}>
            Guardar
          </button>
          <button className="btn" onClick={copy}>
            Copiar texto
          </button>
        </div>
        {!isNew && (
          <button className="btn btn-sm btn-danger self-end" onClick={remove}>
            Borrar presupuesto
          </button>
        )}
      </section>
    </div>
  );
}
