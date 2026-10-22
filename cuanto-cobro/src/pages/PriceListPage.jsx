import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useData } from '../lib/useData';
import { useStore } from '../store';
import { recipeCosts } from '../lib/costs';
import { money } from '../lib/format';
import { Header, Loading } from '../components/ui';

// Colores de cada estilo de la imagen
const STYLES = {
  dorado: { label: 'Dorado', bg: '#fbf6ee', card: '#ffffff', ink: '#3f2a22', soft: '#8a7266', accent: '#c98f2a', line: '#ecdfcf' },
  rosa: { label: 'Rosa', bg: '#fbeef1', card: '#ffffff', ink: '#4a2333', soft: '#8f6676', accent: '#c45b80', line: '#f1d6de' },
  pizarra: { label: 'Pizarra', bg: '#2b2420', card: '#362d28', ink: '#f6ece2', soft: '#c4b2a4', accent: '#e8b55c', line: '#4a3e37' },
};
const W = 1080;
const H = 1350;
const unitLabel = (r) => (Number(r.yield_qty) > 1 ? 'c/u' : '');

// Dibuja la lista como imagen para Instagram (1080 × 1350)
function drawList(canvas, { title, note, style, rows }) {
  const s = STYLES[style] || STYLES.dorado;
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, W, H);

  // Título
  ctx.textAlign = 'center';
  ctx.fillStyle = s.accent;
  ctx.font = '800 30px Nunito, "Segoe UI", sans-serif';
  ctx.fillText('LISTA DE PRECIOS', W / 2, 120);
  ctx.fillStyle = s.ink;
  let size = 84;
  ctx.font = `bold ${size}px Georgia, "Times New Roman", serif`;
  while (ctx.measureText(title).width > W - 160 && size > 44) {
    size -= 4;
    ctx.font = `bold ${size}px Georgia, "Times New Roman", serif`;
  }
  ctx.fillText(title, W / 2, 215);

  // Tarjeta con los productos
  // Con pocos productos la tarjeta se achica y queda centrada
  const areaTop = 280;
  const areaBottom = note ? H - 190 : H - 110;
  const pad = 56;
  const rowH = Math.min(120, (areaBottom - areaTop - pad * 2) / Math.max(rows.length, 1));
  const cardH = rowH * Math.max(rows.length, 1) + pad * 2;
  const top = areaTop + (areaBottom - areaTop - cardH) / 2;
  const cardX = 70;
  const cardW = W - 140;
  ctx.fillStyle = s.card;
  ctx.beginPath();
  ctx.roundRect(cardX, top, cardW, cardH, 44);
  ctx.fill();

  const font = Math.max(26, Math.min(44, rowH * 0.42));
  rows.forEach((r, i) => {
    const y = top + pad + rowH * i + rowH / 2;
    if (i > 0) {
      ctx.strokeStyle = s.line;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cardX + pad, y - rowH / 2);
      ctx.lineTo(cardX + cardW - pad, y - rowH / 2);
      ctx.stroke();
    }
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = `${font * 1.15}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.fillText(r.emoji, cardX + pad, y);
    // Precio a la derecha
    ctx.textAlign = 'right';
    const unit = unitLabel(r);
    let priceRight = cardX + cardW - pad;
    if (unit) {
      ctx.fillStyle = s.soft;
      ctx.font = `700 ${font * 0.6}px Nunito, "Segoe UI", sans-serif`;
      ctx.fillText(unit, priceRight, y + 2);
      priceRight -= ctx.measureText(unit).width + 10;
    }
    ctx.fillStyle = s.accent;
    ctx.font = `800 ${font}px Nunito, "Segoe UI", sans-serif`;
    const price = money(r.sale_price);
    ctx.fillText(price, priceRight, y);
    const priceLeft = priceRight - ctx.measureText(price).width - 24;
    // Nombre, recortado si no entra
    ctx.textAlign = 'left';
    ctx.fillStyle = s.ink;
    ctx.font = `700 ${font * 0.86}px Nunito, "Segoe UI", sans-serif`;
    const nameX = cardX + pad + font * 1.6;
    let name = r.name;
    while (ctx.measureText(name).width > priceLeft - nameX && name.length > 4) name = `${name.slice(0, -2).trimEnd()}…`;
    ctx.fillText(name, nameX, y);
  });
  ctx.textBaseline = 'alphabetic';

  // Nota de abajo
  if (note) {
    ctx.textAlign = 'center';
    ctx.fillStyle = s.ink;
    ctx.font = '700 34px Nunito, "Segoe UI", sans-serif';
    ctx.fillText(note, W / 2, H - 110, W - 140);
  }
  ctx.fillStyle = s.soft;
  ctx.font = '600 24px Nunito, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Precios actualizados al ${new Date().toLocaleDateString('es-AR')}`, W / 2, H - 52);
}

export default function PriceListPage() {
  const { settings } = useStore();
  const { data: recipes, error } = useData('/api/recipes');
  const { data: saved } = useData('/api/price-list');
  const [f, setF] = useState(null);
  const [image, setImage] = useState('');
  const [notice, setNotice] = useState('');
  const canvas = useRef(null);

  useEffect(() => {
    if (saved && recipes && !f) {
      setF({
        ids: saved.recipe_ids ?? recipes.filter((r) => r.sale_price > 0).map((r) => r.id),
        title: saved.title || settings.business_name || 'Mis productos',
        note: saved.note,
        style: saved.style,
      });
    }
  }, [saved, recipes, f, settings.business_name]);

  const rows = useMemo(() => (recipes && f ? recipes.filter((r) => f.ids.includes(r.id) && r.sale_price > 0) : []), [recipes, f]);

  // Redibuja la vista previa y guarda la elección (sin apuro, para no guardar en cada letra)
  useEffect(() => {
    if (!f || !canvas.current) return;
    const t = setTimeout(() => {
      drawList(canvas.current, { ...f, rows });
      setImage(canvas.current.toDataURL('image/png'));
      api.put('/api/price-list', { recipe_ids: f.ids, title: f.title, note: f.note, style: f.style }).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [f, rows]);

  if (!recipes || !saved || !f) return <Loading error={error} />;

  const set = (key, value) => setF((prev) => ({ ...prev, [key]: value }));
  const toggle = (id) => set('ids', f.ids.includes(id) ? f.ids.filter((x) => x !== id) : [...f.ids, id]);
  const fileName = `lista-de-precios-${new Date().toISOString().slice(0, 10)}.png`;

  async function shareImage() {
    const blob = await new Promise((resolve) => canvas.current.toBlob(resolve, 'image/png'));
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: f.title });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    setNotice('Se descargó la imagen. Buscala en Descargas para mandarla o subirla a Instagram.');
  }

  async function copyText() {
    const text = [`*${f.title}* — Lista de precios`, '', ...rows.map((r) => `${r.emoji} ${r.name}: ${money(r.sale_price)}${unitLabel(r) ? ' c/u' : ''}`)];
    if (f.note) text.push('', f.note);
    try {
      await navigator.clipboard.writeText(text.join('\n'));
      setNotice('¡Copiada! Pegala en WhatsApp.');
    } catch {
      setNotice('No se pudo copiar en este aparato.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Header title="Lista de precios" subtitle="Una imagen linda con tus precios, para WhatsApp o Instagram. Se arma sola con los precios de tus recetas." />

      <div className="card overflow-hidden p-2">
        {image ? <img src={image} alt="Vista previa de la lista de precios" className="w-full rounded-xl" /> : <div className="aspect-[4/5]" />}
        <canvas ref={canvas} className="hidden" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-primary" onClick={shareImage} disabled={!rows.length}>
          📤 Compartir imagen
        </button>
        <button className="btn" onClick={copyText} disabled={!rows.length}>
          Copiar como texto
        </button>
      </div>
      {notice && <div className="notice">{notice}</div>}

      <section className="card flex flex-col gap-3 p-4">
        <label className="field">
          Título
          <input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} />
        </label>
        <label className="field">
          Abajo (opcional)
          <input className="input" value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="Ej: Pedidos por WhatsApp al 11 2345 6789" />
        </label>
        <div className="field">
          Estilo
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(STYLES).map(([key, s]) => (
              <button
                key={key}
                type="button"
                className={`btn btn-sm ${f.style === key ? 'btn-primary' : ''}`}
                onClick={() => set('style', key)}
              >
                <span className="h-4 w-4 rounded-full border border-line" style={{ background: s.accent }} />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card p-4">
        <div className="section-title mb-2">Qué productos van</div>
        <div className="flex flex-col divide-y divide-line">
          {recipes.map((r) => {
            const c = recipeCosts(r, settings);
            const low = r.sale_price > 0 && c.suggested > r.sale_price;
            return (
              <label key={r.id} className="flex items-center gap-3 py-2.5">
                <input type="checkbox" className="h-5 w-5 accent-gold" checked={f.ids.includes(r.id)} disabled={!r.sale_price} onChange={() => toggle(r.id)} />
                <span className="text-xl">{r.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.name}</span>
                  {!r.sale_price && <span className="block text-xs text-cocoa-soft">Ponele precio de venta en la receta para sumarla</span>}
                  {low && <span className="block text-xs text-warn">Ojo: te conviene cobrarla {money(c.suggested)}</span>}
                </span>
                <span className="font-bold">{r.sale_price ? money(r.sale_price) : '—'}</span>
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
}
