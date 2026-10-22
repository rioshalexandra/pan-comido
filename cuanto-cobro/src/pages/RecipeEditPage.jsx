import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useStore } from '../store';
import { recipeCosts } from '../lib/costs';
import { money } from '../lib/format';
import { INPUT_UNITS, toBase } from '../lib/units';
import IngredientForm from '../components/IngredientForm';
import { Loading, Modal } from '../components/ui';

const EMOJIS = ['🧁', '🍪', '🥮', '🍰', '🎂', '🥧', '🍫', '🍋', '🥐', '🍩', '🥕', '🍞', '🥖', '🍓', '🍎', '🥥', '🍮', '🍯', '🎁', '☕'];

// Dibujito sugerido según el nombre
function guessEmoji(name) {
  const n = name.toLowerCase();
  const rules = [
    [/cookie|galleti|pepa/, '🍪'], [/alfajor/, '🥮'], [/lim[oó]n/, '🍋'], [/medialuna|croissant|factura/, '🥐'],
    [/muffin|cupcake|magdalena/, '🧁'], [/brownie|chocolate/, '🍫'], [/zanahoria|carrot/, '🥕'], [/tarta|pie|lemon/, '🥧'],
    [/bud[ií]n|bizcocho|porci[oó]n/, '🍰'], [/torta|cake/, '🎂'], [/dona|rosquilla/, '🍩'], [/caja|combo|box|regalo/, '🎁'],
    [/baguette/, '🥖'], [/\bpan\b/, '🍞'], [/frutilla/, '🍓'], [/manzana/, '🍎'], [/coco/, '🥥'], [/flan/, '🍮'],
  ];
  return rules.find(([re]) => re.test(n))?.[1];
}

const emptyLine = () => ({ key: Math.random(), ingredient_id: '', qty: '', unit: '' });

export default function RecipeEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useStore();
  const [ingredients, setIngredients] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [f, setF] = useState(null);
  const [emojiTouched, setEmojiTouched] = useState(Boolean(id));
  const [creatingFor, setCreatingFor] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/api/ingredients'), api.get('/api/suppliers'), id ? api.get(`/api/recipes/${id}`) : null])
      .then(([ing, sup, rec]) => {
        setIngredients(ing.data);
        setSuppliers(sup.data);
        const r = rec?.data;
        setF({
          name: r?.name || '',
          emoji: r?.emoji || '🧁',
          yield_qty: r ? String(r.yield_qty) : '',
          yield_unit: r?.yield_unit || 'un',
          sale_price: r?.sale_price ? String(r.sale_price) : '',
          work_minutes: r?.work_minutes ? String(r.work_minutes) : '',
          oven_minutes: r?.oven_minutes ? String(r.oven_minutes) : '',
          notes: r?.notes || '',
          items: r?.items?.length
            ? r.items.map((i) => ({ key: i.id, ingredient_id: String(i.ingredient_id), qty: String(i.qty), unit: i.unit }))
            : [emptyLine(), emptyLine(), emptyLine()],
        });
      })
      .catch((err) => setError(err.message));
  }, [id]);

  // Si se llegó desde "Tocá acá para escribirlo", ir directo al procedimiento
  useEffect(() => {
    if (f && location.hash === '#notas') document.getElementById('notas')?.focus();
  }, [f, location.hash]);

  const byId = useMemo(() => new Map((ingredients || []).map((i) => [String(i.id), i])), [ingredients]);
  const parse = (v) => Number(String(v || '').replace(',', '.')) || 0;

  // Receta "en borrador" para calcular costos en vivo
  const draft = useMemo(() => {
    if (!f) return null;
    const items = f.items
      .filter((l) => byId.has(l.ingredient_id) && parse(l.qty) > 0)
      .map((l) => {
        const ing = byId.get(l.ingredient_id);
        return { ...ing, qty: toBase(parse(l.qty), l.unit || ing.unit, ing.unit) };
      });
    return { ...f, yield_qty: parse(f.yield_qty), sale_price: parse(f.sale_price), work_minutes: parse(f.work_minutes), oven_minutes: parse(f.oven_minutes), items };
  }, [f, byId]);
  const costs = draft && draft.yield_qty > 0 ? recipeCosts(draft, settings) : null;

  if (!f || !ingredients) return <Loading error={error} />;

  const set = (key, value) => setF((prev) => ({ ...prev, [key]: value }));
  const setLine = (key, patch) => setF((prev) => ({ ...prev, items: prev.items.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));

  function setName(name) {
    setF((prev) => ({ ...prev, name, emoji: emojiTouched ? prev.emoji : guessEmoji(name) || prev.emoji }));
  }

  function pickIngredient(line, value) {
    if (value === '__new') return setCreatingFor(line.key);
    const ing = byId.get(value);
    setLine(line.key, { ingredient_id: value, unit: ing ? ing.unit : '' });
  }

  async function save() {
    setBusy(true);
    setError('');
    const payload = {
      ...f,
      items: draft.items.map((i) => ({ ingredient_id: i.id, qty: i.qty })),
    };
    try {
      const res = id ? await api.put(`/api/recipes/${id}`, payload) : await api.post('/api/recipes', payload);
      navigate(`/recetas/${res.data.id}`, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link to={id ? `/recetas/${id}` : '/recetas'} className="text-sm font-semibold text-cocoa-soft">
          ‹ Volver
        </Link>
        <h1 className="page-title">{id ? 'Editar receta' : 'Nueva receta'}</h1>
      </div>

      <section className="card flex flex-col gap-4 p-4">
        <label className="field">
          Nombre
          <input className="input" value={f.name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Cookies de chocolate" />
        </label>
        <div>
          <div className="mb-1 text-sm font-semibold text-cocoa-soft">Dibujito</div>
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setEmojiTouched(true);
                  set('emoji', e);
                }}
                className={`grid h-10 w-10 place-items-center rounded-xl text-xl ${f.emoji === e ? 'bg-gold-soft ring-2 ring-gold' : 'bg-cream'}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="field">
            Rinde (cuántas salen)
            <input className="input" inputMode="decimal" value={f.yield_qty} onChange={(e) => set('yield_qty', e.target.value)} placeholder="Ej: 24" />
          </label>
          <label className="field">
            De qué
            <input className="input" list="yield-units" value={f.yield_unit} onChange={(e) => set('yield_unit', e.target.value)} />
            <datalist id="yield-units">
              {['un', 'porciones', 'docenas', 'tortas', 'cajas', 'frascos'].map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </label>
          <label className="field">
            Min. de trabajo por tanda
            <input className="input" inputMode="decimal" value={f.work_minutes} onChange={(e) => set('work_minutes', e.target.value)} placeholder="Ej: 60" />
          </label>
          <label className="field">
            Min. de horno por tanda
            <input className="input" inputMode="decimal" value={f.oven_minutes} onChange={(e) => set('oven_minutes', e.target.value)} placeholder="Ej: 15" />
          </label>
        </div>
        <label className="field max-w-xs">
          Precio de venta (por unidad)
          <input className="input" inputMode="decimal" value={f.sale_price} onChange={(e) => set('sale_price', e.target.value)} placeholder="Si no sabés, dejalo vacío" />
          <span className="label-hint">Si lo dejás vacío, la app te sugiere uno.</span>
        </label>
      </section>

      <section className="card p-4">
        <div className="section-title mb-3">Ingredientes de una tanda</div>
        {!ingredients.length && <div className="notice mb-3">Todavía no cargaste ingredientes. Elegí "Crear ingrediente nuevo" en la lista.</div>}
        <div className="flex flex-col gap-2">
          {f.items.map((line) => {
            const ing = byId.get(line.ingredient_id);
            return (
              <div key={line.key} className="flex flex-wrap items-center gap-2 rounded-xl bg-cream p-2">
                <select className="input min-w-0 flex-[1_1_180px]" value={line.ingredient_id} onChange={(e) => pickIngredient(line, e.target.value)}>
                  <option value="">Elegí un ingrediente…</option>
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                      {i.is_packaging ? ' (packaging)' : ''}
                    </option>
                  ))}
                  <option value="__new">+ Crear ingrediente nuevo</option>
                </select>
                <input className="input w-24" inputMode="decimal" placeholder="Cant." value={line.qty} onChange={(e) => setLine(line.key, { qty: e.target.value })} />
                <select className="input w-24" value={line.unit} onChange={(e) => setLine(line.key, { unit: e.target.value })} disabled={!ing}>
                  {(ing ? INPUT_UNITS[ing.unit] : [{ value: '' }]).map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.value || '—'}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-sm"
                  aria-label="Quitar"
                  onClick={() => setF((prev) => ({ ...prev, items: prev.items.filter((l) => l.key !== line.key) }))}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
        <button type="button" className="btn btn-sm mt-3" onClick={() => set('items', [...f.items, emptyLine()])}>
          + Agregar ingrediente
        </button>
        <p className="mt-2 text-xs text-cocoa-soft">Sumá también el packaging (cajas, bolsas, etiquetas) para que el costo sea completo.</p>
      </section>

      <section className="card p-4">
        <label className="field" htmlFor="notas">
          Notas o procedimiento
        </label>
        <textarea
          id="notas"
          className="input mt-1 min-h-32 py-2"
          value={f.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Ej: Batir la manteca con el azúcar, sumar los huevos de a uno… Horno 180° por 12 minutos."
        />
      </section>

      {costs && (
        <div className="notice sticky bottom-20 md:bottom-4">
          Tanda: <strong>{money(costs.batchCost)}</strong> · ingredientes c/u <strong>{money(costs.ingredientsUnit)}</strong> · completo c/u{' '}
          <strong>{money(costs.fullUnit)}</strong>
          {costs.realMargin != null && ` · margen real ${costs.realMargin}%`}
          {costs.suggested > 0 && (
            <>
              {' '}
              · sugerido <strong>{money(costs.suggested)}</strong>
            </>
          )}
        </div>
      )}

      {error && <div className="error">{error}</div>}
      <button className="btn btn-primary" onClick={save} disabled={busy}>
        {busy ? 'Guardando…' : 'Guardar receta'}
      </button>

      {creatingFor && (
        <Modal title="Nuevo ingrediente" onClose={() => setCreatingFor(null)}>
          <IngredientForm
            suppliers={suppliers}
            onCancel={() => setCreatingFor(null)}
            onSaved={(ing) => {
              setIngredients((prev) => [...prev, ing].sort((a, b) => a.name.localeCompare(b.name)));
              setLine(creatingFor, { ingredient_id: String(ing.id), unit: ing.unit });
              setCreatingFor(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
