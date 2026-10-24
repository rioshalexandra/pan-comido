// Páginas de Fecha Libre. Cada página es HTML armado acá; el código que corre en el celular
// está en funciones (helpers, publicClient, panelClient, adminClient) que se mandan tal cual con toString().

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
const textOn = (hex) => {
  const n = parseInt(String(hex).slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 165 ? '#1f1b16' : '#ffffff';
};
const DEFAULT = { color1: '#3f6b5a', color2: '#f2b544' };

const CSS = `
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:'Nunito',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:#f6f3ee;color:#1f1b16;line-height:1.4}
a{color:inherit}
.wrap{max-width:560px;margin:0 auto;padding:0 16px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:14px;padding:13px 18px;font:inherit;font-weight:800;font-size:16px;cursor:pointer;text-decoration:none;background:var(--c1);color:var(--on1)}
.btn.alt{background:#fff;color:#1f1b16;border:1.5px solid #e2dbd0}
.btn.wa{background:#1fa855;color:#fff}
.btn.danger{background:#fff;color:#b42318;border:1.5px solid #f3c1bb}
.btn.small{padding:8px 12px;font-size:14px;border-radius:10px}
.btn:disabled{opacity:.45;cursor:default}
.btn.block{display:flex;width:100%}
.card{background:#fff;border-radius:20px;padding:18px;box-shadow:0 6px 24px rgba(60,40,10,.07);margin:14px 0}
.muted{color:#6f675c}
.small{font-size:13px}
h1,h2,h3{line-height:1.15;margin:0 0 6px}
label{display:block;font-weight:700;font-size:14px;margin:12px 0 0}
input,textarea,select{display:block;width:100%;margin-top:6px;padding:12px;border:1.5px solid #e2dbd0;border-radius:12px;font:inherit;font-size:16px;background:#fff;color:inherit}
input:focus,textarea:focus{outline:2px solid var(--c1);border-color:transparent}
.err{color:#b42318;font-weight:700;min-height:1em}
/* Calendario */
.cal-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.cal-nav h3{margin:0;text-transform:capitalize;font-size:20px}
.cal-nav button{width:42px;height:42px;border-radius:12px;border:1.5px solid #e2dbd0;background:#fff;font-size:20px;cursor:pointer;color:inherit}
.cal-nav button:disabled{opacity:.3}
.cal-week,.cal-days{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}
.cal-week span{text-align:center;font-size:12px;font-weight:800;color:#8a8175}
.day{aspect-ratio:1;border:0;border-radius:12px;font:inherit;font-weight:800;font-size:16px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0;color:#1f1b16;position:relative}
.day.free{background:#dff3e6;color:#17663a}
.day.partial{background:linear-gradient(135deg,#dff3e6 50%,#fde2c4 50%);color:#7a4a0c}
.day.full{background:#f6d6d3;color:#9b2c22}
.day.full b{text-decoration:line-through;text-decoration-thickness:2px}
.day.past{background:transparent;color:#c4bcb0;cursor:default}
.day.today{box-shadow:inset 0 0 0 2.5px var(--c1)}
.day .dot{position:absolute;bottom:5px;width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.6}
.legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:12px;font-size:13px;color:#6f675c}
.legend i{display:inline-block;width:14px;height:14px;border-radius:5px;vertical-align:-2px;margin-right:5px}
/* Hoja que sube desde abajo */
.sheet-bg{position:fixed;inset:0;background:rgba(25,18,8,.45);display:none;align-items:flex-end;justify-content:center;z-index:50}
.sheet-bg.open{display:flex}
.sheet{background:#fff;width:100%;max-width:560px;border-radius:24px 24px 0 0;padding:22px 18px calc(22px + env(safe-area-inset-bottom));max-height:88vh;overflow:auto;position:relative;animation:up .18s ease-out}
@keyframes up{from{transform:translateY(40px);opacity:.5}to{transform:none;opacity:1}}
.sheet h3{font-size:21px;padding-right:40px}
.sheet .x{position:absolute;top:14px;right:14px;width:36px;height:36px;border-radius:50%;border:0;background:#f1ece4;font-size:16px;cursor:pointer}
.slot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;border-radius:14px;margin-top:10px;background:#f6f3ee}
.slot span{display:block;font-size:13px;color:#6f675c}
.slot em{font-style:normal;font-weight:800;color:#9b2c22}
.slot.ok{background:#e9f7ee}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1f1b16;color:#fff;padding:12px 18px;border-radius:12px;font-weight:700;z-index:99;max-width:90vw}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{border:0;border-radius:999px;padding:9px 14px;font:inherit;font-weight:800;font-size:14px;background:#dff3e6;color:#17663a;cursor:pointer}
.tag{display:inline-block;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:800;background:#f1ece4}
.tag.ok{background:#dff3e6;color:#17663a}.tag.wait{background:#fde2c4;color:#7a4a0c}
`;

function shell({ env, title, description = '', head = '', body, color1 = DEFAULT.color1, color2 = DEFAULT.color2, scripts = '', manifest = '', touchIcon = '/icono-v3-180.png', appTitle = '' }) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="${esc(color1)}">
<link rel="icon" type="image/png" href="/icono-v3-192.png">
<link rel="apple-touch-icon" href="${esc(touchIcon)}">
${manifest ? `<link rel="manifest" href="${esc(manifest)}?v=3">` : ''}
${appTitle ? `<meta name="apple-mobile-web-app-title" content="${esc(appTitle)}"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap" rel="stylesheet">
<style>:root{--c1:${esc(color1)};--c2:${esc(color2)};--on1:${textOn(color1)};--on2:${textOn(color2)}}${CSS}</style>
${head}</head><body>${body}
<script>(${helpers.toString()})();window.APP_NAME=${safeJson(env.APP_NAME || 'Fecha Libre')};</script>
${scripts}</body></html>`;
}

// ---------- Código compartido que corre en el navegador ----------
function helpers() {
  const H = (window.H = {});
  H.MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  H.DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  H.pad = (n) => String(n).padStart(2, '0');
  H.ymd = (d) => d.getFullYear() + '-' + H.pad(d.getMonth() + 1) + '-' + H.pad(d.getDate());
  H.parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  H.largo = (s) => { const d = H.parse(s); return H.DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + H.MESES[d.getMonth()]; };
  H.corto = (s) => { const d = H.parse(s); return H.DIAS[d.getDay()].slice(0, 3) + ' ' + d.getDate() + '/' + (d.getMonth() + 1); };
  H.cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  H.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // Número de WhatsApp argentino para wa.me (549 + característica + número)
  H.waNumber = (n) => {
    let d = String(n || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('54')) return d.startsWith('549') ? d : '549' + d.slice(2);
    d = d.replace(/^0/, '');
    return '549' + d;
  };
  H.waLink = (number, text) => 'https://wa.me/' + H.waNumber(number) + '?text=' + encodeURIComponent(text);
  H.igUrl = (v) => {
    v = String(v || '').trim();
    if (!v) return '';
    if (/^https?:\/\//.test(v)) return v;
    return 'https://instagram.com/' + v.replace(/^@/, '').replace(/^(www\.)?instagram\.com\//, '');
  };
  H.dayStatus = (s, slots, taken, today) => {
    if (s < today) return { cls: 'past', disabled: true };
    const n = slots.filter((x) => taken.has(s + '|' + x.id)).length;
    const cls = n === 0 ? 'free' : n === slots.length ? 'full' : 'partial';
    return { cls: cls + (s === today ? ' today' : '') };
  };
  H.calendarHTML = (y, m, statusOf) => {
    const offset = (new Date(y, m, 1).getDay() + 6) % 7;
    const n = new Date(y, m + 1, 0).getDate();
    let h = '<div class="cal-week"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div><div class="cal-days">';
    for (let i = 0; i < offset; i++) h += '<span></span>';
    for (let d = 1; d <= n; d++) {
      const s = H.ymd(new Date(y, m, d));
      const st = statusOf(s);
      h += '<button class="day ' + st.cls + '" data-date="' + s + '"' + (st.disabled ? ' disabled' : '') + ' aria-label="' + H.largo(s) + '"><b>' + d + '</b>' + (st.dot ? '<i class="dot"></i>' : '') + '</button>';
    }
    return h + '</div>';
  };
  H.sheet = (inner) => {
    let el = document.getElementById('sheet');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sheet';
      el.className = 'sheet-bg';
      document.body.appendChild(el);
      el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-close]')) H.closeSheet(); });
    }
    el.innerHTML = '<div class="sheet" role="dialog"><button class="x" data-close aria-label="Cerrar">✕</button>' + inner + '</div>';
    el.classList.add('open');
    return el.querySelector('.sheet');
  };
  H.closeSheet = () => { const el = document.getElementById('sheet'); if (el) el.classList.remove('open'); };
  H.toast = (msg) => {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  };
  H.api = async (path, opts = {}) => {
    const r = await fetch(path, {
      method: opts.method || (opts.body ? 'POST' : 'GET'),
      headers: opts.body ? { 'content-type': 'application/json' } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = {};
    try { data = await r.json(); } catch { /* sin cuerpo */ }
    if (!r.ok) throw Object.assign(new Error(data.error || 'Algo salió mal. Probá de nuevo.'), { status: r.status });
    return data;
  };
  H.share = async (url, text) => {
    if (navigator.share) { try { await navigator.share({ title: text, text, url }); return; } catch { return; } }
    window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + url), '_blank');
  };
}

// ---------- Página pública del salón ----------
function publicClient() {
  const H = window.H, V = window.V;
  const $ = (s) => document.querySelector(s);
  const taken = new Set(V.blocks.map((b) => b[0] + '|' + b[1]));
  const today = H.ymd(new Date());
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 11, 1);
  let cur = first;
  const status = (s) => H.dayStatus(s, V.slots, taken, today);

  function render() {
    $('#mes').textContent = H.MESES[cur.getMonth()] + ' ' + cur.getFullYear();
    $('#prev').disabled = cur <= first;
    $('#next').disabled = cur >= last;
    $('#cal').innerHTML = H.calendarHTML(cur.getFullYear(), cur.getMonth(), status);
  }
  $('#prev').onclick = () => { cur = new Date(cur.getFullYear(), cur.getMonth() - 1, 1); render(); };
  $('#next').onclick = () => { cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1); render(); };
  $('#cal').onclick = (e) => { const b = e.target.closest('.day'); if (b && !b.disabled) openDay(b.dataset.date); };

  function openDay(s) {
    const many = V.slots.length > 1;
    const rows = V.slots.map((sl) => {
      const busy = taken.has(s + '|' + sl.id);
      const msg = '¡Hola! Vi en la página de ' + V.name + ' que el ' + H.largo(s) + (many ? ' (' + sl.label.toLowerCase() + ')' : '') + ' está libre. Quería hacer una consulta para ese día.';
      return '<div class="slot ' + (busy ? 'busy' : 'ok') + '"><div><b>' + H.esc(sl.label) + '</b>' + (sl.hours ? '<span>' + H.esc(sl.hours) + '</span>' : '') + '</div>' +
        (busy ? '<em>Reservado</em>' : '<a class="btn wa small" target="_blank" rel="noopener" href="' + H.waLink(V.whatsapp, msg) + '">💬 Consultar</a>') + '</div>';
    }).join('');
    const allBusy = V.slots.every((sl) => taken.has(s + '|' + sl.id));
    H.sheet('<h3>' + H.cap(H.largo(s)) + '</h3>' + (allBusy ? '<p class="muted">Ese día ya está reservado. ¡Fijate otro día en verde! 🙂</p>' : '<p class="muted">Tocá "Consultar" y se abre WhatsApp con el mensaje listo.</p>') + rows);
  }

  // Próximos fines de semana con algo libre
  const chips = [];
  for (let i = 0; i < 120 && chips.length < 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (![5, 6, 0].includes(d.getDay())) continue;
    const s = H.ymd(d);
    if (V.slots.some((sl) => !taken.has(s + '|' + sl.id))) chips.push(s);
  }
  $('#libres').innerHTML = chips.length
    ? chips.map((s) => '<button class="chip" data-date="' + s + '">' + H.cap(H.corto(s)) + '</button>').join('')
    : '<p class="muted">Por ahora no hay fines de semana libres. Mirá el calendario o consultanos.</p>';
  $('#libres').onclick = (e) => { const b = e.target.closest('.chip'); if (b) openDay(b.dataset.date); };

  render();
}

export function venuePage(env, origin, v, blocks, { preview } = {}) {
  const color1 = v.color1 || DEFAULT.color1;
  const color2 = v.color2 || DEFAULT.color2;
  const url = `${origin}/s/${v.slug}`;
  const description = `Mirá qué días tiene libres ${v.name} y consultá por WhatsApp.`;
  const logo = v.hasLogo ? `<img class="logo" src="/s/${esc(v.slug)}/logo" alt="${esc(v.name)}">` : `<div class="logo emoji">${esc(v.emoji || '🎉')}</div>`;
  const general = `¡Hola! Vi la página de ${v.name} y quería hacer una consulta.`;
  const info = [
    v.capacity && `👥 ${esc(v.capacity)}`,
    v.price && `💲 ${esc(v.price)}`,
    v.address && `📍 ${esc(v.address)}`,
  ].filter(Boolean).map((t) => `<span class="info">${t}</span>`).join('');
  const hours = v.slots.length > 1 || v.slots[0]?.hours
    ? `<p class="small muted" style="margin:10px 0 0">${v.slots.map((s) => `<b>${esc(s.label)}</b>${s.hours ? ` ${esc(s.hours)}` : ''}`).join(' · ')}</p>`
    : '';
  const head = `
<meta property="og:title" content="${esc(v.name)} · Fechas libres">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
${v.hasLogo ? `<meta property="og:image" content="${esc(origin)}/s/${esc(v.slug)}/logo">` : ''}
<style>
.hero{background:linear-gradient(160deg,var(--c1),color-mix(in srgb,var(--c1) 70%,#000));color:var(--on1);padding:28px 0 64px;text-align:center}
.logo{width:96px;height:96px;border-radius:26px;object-fit:contain;background:#fff;margin:0 auto 12px;display:block;box-shadow:0 8px 24px rgba(0,0,0,.18)}
.logo.emoji{display:flex;align-items:center;justify-content:center;font-size:52px;background:var(--c2)}
.hero h1{font-size:30px;font-weight:900}
.hero p{margin:4px 0 0;opacity:.9}
.infos{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:14px}
.info{background:rgba(255,255,255,.16);border-radius:999px;padding:6px 12px;font-size:14px;font-weight:700}
.pull{margin-top:-46px}
.ig{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px}
.preview{background:#fde2c4;color:#7a4a0c;text-align:center;padding:10px 16px;font-weight:800;font-size:14px}
footer{text-align:center;padding:24px 16px 40px;font-size:13px;color:#8a8175}
</style>`;
  const body = `
${preview ? '<div class="preview">👀 Vista previa: esta página todavía no es pública.</div>' : ''}
<header class="hero"><div class="wrap">${logo}<h1>${esc(v.name)}</h1>${v.tagline ? `<p>${esc(v.tagline)}</p>` : ''}<div class="infos">${info}</div></div></header>
<main class="wrap pull">
  <section class="card">
    <div class="cal-nav"><button id="prev" aria-label="Mes anterior">‹</button><h3 id="mes"></h3><button id="next" aria-label="Mes siguiente">›</button></div>
    <div id="cal"></div>
    <div class="legend"><span><i style="background:#dff3e6"></i>Libre</span><span><i style="background:linear-gradient(135deg,#dff3e6 50%,#fde2c4 50%)"></i>Queda un turno</span><span><i style="background:#f6d6d3"></i>Reservado</span></div>
    ${hours}
    <p class="small muted" style="margin:10px 0 0">Tocá un día para ver los turnos y consultar.</p>
  </section>
  <section class="card">
    <h3>Próximos fines de semana libres</h3>
    <div id="libres" class="chips" style="margin-top:10px"></div>
  </section>
  <a class="btn wa block" target="_blank" rel="noopener" href="https://wa.me/${esc(waNumber(v.whatsapp))}?text=${encodeURIComponent(general)}">💬 Consultar por WhatsApp</a>
  ${v.instagram ? `<a class="btn alt block ig" target="_blank" rel="noopener" href="${esc(igUrl(v.instagram))}">📸 Ver fotos en Instagram</a>` : ''}
  <button class="btn alt block" style="margin-top:10px" onclick="H.share(location.href, ${esc(safeJson(v.name + ' · fechas libres'))})">↗️ Compartir esta página</button>
</main>
<footer>Hecho con ${esc(env.APP_NAME || 'Fecha Libre')}</footer>`;
  return shell({
    env, title: `${v.name} · Fechas libres`, description, head, body, color1, color2,
    manifest: `/s/${v.slug}/manifest.webmanifest`, appTitle: v.name, touchIcon: v.hasLogo ? `/s/${v.slug}/logo` : '/icono-v3-180.png',
    scripts: `<script>window.V=${safeJson({ ...v, blocks })};(${publicClient.toString()})();</script>`,
  });
}

// Mismas cuentas que en el navegador, para armar links del lado del servidor
function waNumber(n) {
  let d = String(n || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('54')) return d.startsWith('549') ? d : `549${d.slice(2)}`;
  return `549${d.replace(/^0/, '')}`;
}
function igUrl(v) {
  v = String(v || '').trim();
  if (/^https?:\/\//.test(v)) return v;
  return `https://instagram.com/${v.replace(/^@/, '').replace(/^(www\.)?instagram\.com\//, '')}`;
}

export function notReadyPage(env, v) {
  return shell({
    env, title: v.name, color1: v.color1, color2: v.color2,
    body: `<main class="wrap" style="padding-top:18vh;text-align:center"><div style="font-size:56px">${esc(v.emoji || '🎉')}</div><h1>${esc(v.name)}</h1><p class="muted">Estamos preparando esta página. ¡Volvé en unos días!</p></main>`,
  });
}

export function notFoundPage(env) {
  return shell({
    env, title: 'No encontrado',
    body: `<main class="wrap" style="padding-top:18vh;text-align:center"><div style="font-size:56px">🤔</div><h1>No encontramos esta página</h1><p class="muted">Revisá que el link esté bien escrito.</p></main>`,
  });
}

// ---------- Inicio (presentación de la app) ----------
export function homePage(env, origin) {
  const name = env.APP_NAME || 'Fecha Libre';
  const want = `¡Hola! Vi ${name} y quiero la página para mi salón.`;
  const head = `
<meta property="og:title" content="${esc(name)}: que tus clientes vean qué días tenés libres">
<meta property="og:description" content="Una página para tu salón con el calendario de fechas libres y consulta directa por WhatsApp.">
<style>
.hero{background:linear-gradient(160deg,#3f6b5a,#24443a);color:#fff;padding:44px 0 70px}
.hero h1{font-size:36px;font-weight:900}
.hero p{font-size:18px;opacity:.92}
.pull{margin-top:-44px}
.feat{display:flex;gap:12px;align-items:flex-start;margin:14px 0}
.feat b{display:block}
.feat .ico{font-size:26px;width:44px;height:44px;border-radius:14px;background:#f6f3ee;display:flex;align-items:center;justify-content:center;flex:none}
.stack{display:grid;gap:10px}
</style>`;
  const body = `
<header class="hero"><div class="wrap"><div style="font-size:44px">🎉</div><h1>${esc(name)}</h1><p>Que tus clientes vean qué días tenés libres, y te escriban solo por esos.</p></div></header>
<main class="wrap pull">
  <section class="card stack">
    <h3>Mirá cómo queda</h3>
    <a class="btn block" href="/s/los-aromos">🎈 Salón de ejemplo (2 turnos)</a>
    <a class="btn alt block" href="/s/la-escondida">🌳 Quinta de ejemplo (día completo)</a>
    <a class="btn alt block" href="/panel?demo=1">🔑 Probar el panel del dueño</a>
  </section>
  <section class="card">
    <div class="feat"><div class="ico">🗓️</div><div><b>Calendario siempre al día</b><span class="muted">El dueño toca un día y lo marca ocupado. Listo.</span></div></div>
    <div class="feat"><div class="ico">💬</div><div><b>Consultas que sirven</b><span class="muted">La gente consulta por WhatsApp solo por días libres, con la fecha ya escrita.</span></div></div>
    <div class="feat"><div class="ico">📸</div><div><b>Con su Instagram, su logo y sus colores</b><span class="muted">Un link propio para la bio de Instagram y los estados.</span></div></div>
    <div class="feat"><div class="ico">✅</div><div><b>Sin mensualidad</b><span class="muted">Se paga una sola vez.</span></div></div>
  </section>
  <a class="btn wa block" target="_blank" rel="noopener" href="https://wa.me/${esc(waNumber(env.SELLER_WHATSAPP))}?text=${encodeURIComponent(want)}">💬 Quiero la página para mi salón</a>
  <p class="small muted" style="text-align:center;margin:18px 0 40px">¿Ya tenés tu salón? <a href="/panel">Entrá a tu panel</a></p>
</main>`;
  return shell({ env, title: `${name} · Fechas libres para tu salón`, head, body });
}

// ---------- Panel del dueño ----------
function panelClient() {
  const H = window.H;
  const $ = (s) => document.querySelector(s);
  const app = $('#app');
  let V = null, taken = new Map(), cur = null, isDemoUser = false, tab = 'cal';
  const today = H.ymd(new Date());

  async function start() {
    try {
      const me = await H.api('/api/me');
      if (me.role === 'admin') { location.href = '/admin'; return; }
      await load();
    } catch { loginView(); }
  }

  function loginView() {
    const demo = new URLSearchParams(location.search).has('demo');
    app.innerHTML = '<section class="card" style="margin-top:12vh"><div style="font-size:40px">🔑</div><h2>Entrar a mi salón</h2>' +
      (demo ? '<p class="muted small">Es una demo: ya están puestos el usuario y la contraseña. Tocá Entrar.</p>' : '') +
      '<form id="f"><label>Usuario<input id="u" autocomplete="username" autocapitalize="none" value="' + (demo ? 'demo' : '') + '"></label>' +
      '<label>Contraseña<input id="p" type="password" autocomplete="current-password" value="' + (demo ? 'probala' : '') + '"></label>' +
      '<p class="err" id="err"></p><button class="btn block">Entrar</button></form></section>';
    $('#f').onsubmit = async (e) => {
      e.preventDefault();
      try {
        const r = await H.api('/api/login', { body: { username: $('#u').value, password: $('#p').value } });
        if (r.role === 'admin') { location.href = '/admin'; return; }
        await load();
      } catch (err) { $('#err').textContent = err.message; }
    };
  }

  async function load() {
    const d = await H.api('/api/panel');
    V = d.venue;
    isDemoUser = d.isDemoUser;
    taken = new Map(d.blocks.map((b) => [b.date + '|' + b.slot, b.note || '']));
    if (!cur) { const n = new Date(); cur = new Date(n.getFullYear(), n.getMonth(), 1); }
    document.documentElement.style.setProperty('--c1', V.color1);
    draw();
  }

  function draw() {
    const link = location.origin + '/s/' + V.slug;
    app.innerHTML =
      '<header style="display:flex;align-items:center;gap:12px;padding:18px 0 4px">' +
        (V.hasLogo ? '<img src="/s/' + V.slug + '/logo" style="width:46px;height:46px;border-radius:14px;object-fit:contain;background:#fff">' : '<div style="font-size:34px">' + H.esc(V.emoji) + '</div>') +
        '<div style="flex:1"><h2 style="margin:0">' + H.esc(V.name) + '</h2><span class="muted small">Panel del dueño</span></div>' +
        '<button class="btn alt small" id="salir">Salir</button></header>' +
      (isDemoUser ? '<p class="tag wait" style="margin:8px 0 0">Demo: probá todo, se reinicia sola.</p>' : '') +
      '<div class="chips" style="margin:14px 0 0"><button class="chip" data-tab="cal" style="' + (tab === 'cal' ? '' : 'background:#fff;color:#6f675c') + '">🗓️ Calendario</button>' +
      '<button class="chip" data-tab="datos" style="' + (tab === 'datos' ? '' : 'background:#fff;color:#6f675c') + '">✏️ Mis datos</button></div>' +
      '<div id="tab"></div>';
    $('#salir').onclick = async () => { await H.api('/api/logout', { body: {} }); location.href = '/panel'; };
    app.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; draw(); }));
    if (tab === 'cal') drawCal(link); else drawDatos();
  }

  function drawCal(link) {
    const upcoming = [...taken.keys()].map((k) => k.split('|')).filter(([d]) => d >= today).sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(0, 8);
    $('#tab').innerHTML =
      '<section class="card">' +
        (V.ready
          ? '<b>Tu página</b><p class="small muted" style="margin:4px 0 10px;word-break:break-all">' + link + '</p><div class="chips"><a class="btn small" href="' + link + '" target="_blank">👀 Ver</a><button class="btn wa small" id="share">↗️ Compartir</button></div>'
          : '<b>Tu página está en preparación</b><p class="small muted" style="margin:4px 0 10px">Todavía no es pública. Mientras tanto cargá tus fechas ocupadas. Te avisamos cuando esté lista para compartir.</p><a class="btn alt small" href="' + link + '" target="_blank">👀 Ver cómo va quedando</a>') +
      '</section>' +
      '<section class="card"><div class="cal-nav"><button id="prev">‹</button><h3 id="mes"></h3><button id="next">›</button></div><div id="cal"></div>' +
        '<div class="legend"><span><i style="background:#dff3e6"></i>Libre</span><span><i style="background:linear-gradient(135deg,#dff3e6 50%,#fde2c4 50%)"></i>Un turno ocupado</span><span><i style="background:#f6d6d3"></i>Ocupado</span></div>' +
        '<p class="small muted" style="margin:10px 0 0">Tocá un día para marcarlo ocupado o libre.</p></section>' +
      '<section class="card"><h3>Próximas fechas ocupadas</h3>' +
        (upcoming.length ? upcoming.map(([d, s]) => {
          const sl = V.slots.find((x) => x.id === s);
          const note = taken.get(d + '|' + s);
          return '<div class="slot" data-date="' + d + '" style="cursor:pointer"><div><b>' + H.cap(H.largo(d)) + '</b><span>' + H.esc(sl ? sl.label : '') + (note ? ' · ' + H.esc(note) : '') + '</span></div><span>›</span></div>';
        }).join('') : '<p class="muted">No tenés fechas ocupadas cargadas.</p>') +
      '</section>';
    if ($('#share')) $('#share').onclick = () => H.share(link, V.name + ': mirá qué días tenemos libres');
    const render = () => {
      $('#mes').textContent = H.MESES[cur.getMonth()] + ' ' + cur.getFullYear();
      $('#cal').innerHTML = H.calendarHTML(cur.getFullYear(), cur.getMonth(), (s) => {
        const st = H.dayStatus(s, V.slots, taken, today);
        st.dot = V.slots.some((x) => taken.get(s + '|' + x.id));
        if (st.cls === 'past') { st.disabled = false; st.cls = 'past'; }
        return st;
      });
    };
    $('#prev').onclick = () => { cur = new Date(cur.getFullYear(), cur.getMonth() - 1, 1); render(); };
    $('#next').onclick = () => { cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1); render(); };
    $('#cal').onclick = (e) => { const b = e.target.closest('.day'); if (b) openDay(b.dataset.date); };
    $('#tab').querySelectorAll('.slot[data-date]').forEach((el) => (el.onclick = () => openDay(el.dataset.date)));
    render();
  }

  function openDay(s) {
    const state = V.slots.map((sl) => ({ slot: sl.id, label: sl.label, hours: sl.hours, taken: taken.has(s + '|' + sl.id), note: taken.get(s + '|' + sl.id) || '' }));
    const sheet = H.sheet('<h3>' + H.cap(H.largo(s)) + '</h3><div id="rows"></div>' +
      (state.length > 1 ? '<button class="btn alt block" id="all" style="margin-top:12px">Marcar todo el día ocupado</button>' : '') +
      '<button class="btn block" id="save" style="margin-top:10px">Guardar</button>');
    const rows = () => {
      sheet.querySelector('#rows').innerHTML = state.map((x, i) =>
        '<div class="slot ' + (x.taken ? '' : 'ok') + '" style="flex-wrap:wrap;' + (x.taken ? 'background:#fbe7e5' : '') + '"><div><b>' + H.esc(x.label) + '</b>' + (x.hours ? '<span>' + H.esc(x.hours) + '</span>' : '') + '</div>' +
        '<button class="btn small ' + (x.taken ? 'danger' : 'alt') + '" data-i="' + i + '">' + (x.taken ? '🔴 Ocupado' : '🟢 Libre') + '</button>' +
        (x.taken ? '<input data-note="' + i + '" placeholder="Nota (solo la ves vos): quién, seña..." value="' + H.esc(x.note) + '" maxlength="200">' : '') + '</div>').join('');
      sheet.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => { const x = state[b.dataset.i]; x.taken = !x.taken; rows(); }));
      sheet.querySelectorAll('[data-note]').forEach((inp) => (inp.oninput = () => { state[inp.dataset.note].note = inp.value; }));
    };
    rows();
    if (sheet.querySelector('#all')) sheet.querySelector('#all').onclick = () => { state.forEach((x) => (x.taken = true)); rows(); };
    sheet.querySelector('#save').onclick = async () => {
      try {
        await H.api('/api/panel/day', { body: { date: s, slots: state.map((x) => ({ slot: x.slot, taken: x.taken, note: x.note })) } });
        state.forEach((x) => { const k = s + '|' + x.slot; if (x.taken) taken.set(k, x.note); else taken.delete(k); });
        H.closeSheet();
        H.toast('¡Guardado! Ya se ve en tu página.');
        draw();
      } catch (err) { H.toast(err.message); }
    };
  }

  function drawDatos() {
    const f = (id, label, val, extra) => '<label>' + label + '<input id="' + id + '" value="' + H.esc(val) + '" ' + (extra || '') + '></label>';
    $('#tab').innerHTML =
      '<section class="card"><h3>Datos de tu página</h3>' +
        f('name', 'Nombre del salón', V.name, 'maxlength="60"') +
        f('tagline', 'Frase corta', V.tagline, 'maxlength="120" placeholder="Ej: Salón con parque y pileta"') +
        f('capacity', 'Capacidad', V.capacity, 'maxlength="60" placeholder="Ej: Hasta 80 personas"') +
        f('price', 'Precio (opcional)', V.price, 'maxlength="60" placeholder="Ej: Desde $250.000"') +
        f('address', 'Zona o dirección', V.address, 'maxlength="120"') +
        f('whatsapp', 'WhatsApp para consultas', V.whatsapp, 'inputmode="tel" placeholder="Ej: 11 2345 6789"') +
        f('instagram', 'Instagram', V.instagram, 'autocapitalize="none" placeholder="Ej: @misalon"') +
        '<h3 style="margin-top:22px">Turnos</h3><p class="small muted" style="margin:0">Por ejemplo "Mediodía" y "Noche", o uno solo "Día completo".</p><div id="slots"></div>' +
        '<button class="btn alt small" id="addslot" style="margin-top:10px">+ Agregar turno</button>' +
        '<p class="err" id="err"></p><button class="btn block" id="guardar">Guardar cambios</button></section>' +
      '<section class="card"><h3>Cambiar contraseña</h3>' +
        (isDemoUser ? '<p class="muted small">En la demo no se puede cambiar.</p>' :
          '<label>Contraseña actual<input id="pw0" type="password" autocomplete="current-password"></label><label>Contraseña nueva<input id="pw1" type="password" autocomplete="new-password"></label><label>Repetí la nueva<input id="pw2" type="password" autocomplete="new-password"></label><p class="err" id="errpw"></p><button class="btn alt block" id="pw">Cambiar contraseña</button>') +
      '</section>';
    const slots = V.slots.map((s) => ({ ...s }));
    const drawSlots = () => {
      $('#slots').innerHTML = slots.map((s, i) =>
        '<div style="display:flex;gap:8px;align-items:end"><label style="flex:1">Nombre<input data-k="label" data-i="' + i + '" value="' + H.esc(s.label) + '" maxlength="30"></label>' +
        '<label style="flex:1">Horario<input data-k="hours" data-i="' + i + '" value="' + H.esc(s.hours) + '" maxlength="30" placeholder="12 a 18 hs"></label>' +
        (slots.length > 1 ? '<button class="btn danger small" data-del="' + i + '" style="margin-bottom:4px">✕</button>' : '') + '</div>').join('');
      $('#slots').querySelectorAll('input').forEach((inp) => (inp.oninput = () => { slots[inp.dataset.i][inp.dataset.k] = inp.value; }));
      $('#slots').querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => { slots.splice(b.dataset.del, 1); drawSlots(); }));
      $('#addslot').style.display = slots.length >= 4 ? 'none' : '';
    };
    drawSlots();
    $('#addslot').onclick = () => {
      const used = slots.map((s) => Number(s.id.slice(1)));
      slots.push({ id: 's' + (Math.max(0, ...used) + 1), label: '', hours: '' });
      drawSlots();
    };
    $('#guardar').onclick = async () => {
      const body = { slots: slots.filter((s) => s.label.trim()) };
      ['name', 'tagline', 'capacity', 'price', 'address', 'whatsapp', 'instagram'].forEach((k) => (body[k] = $('#' + k).value));
      if (!body.name.trim()) { $('#err').textContent = 'Poné el nombre del salón'; return; }
      if (!body.slots.length) { $('#err').textContent = 'Tiene que haber al menos un turno con nombre'; return; }
      try { await H.api('/api/panel/venue', { method: 'PUT', body }); H.toast('¡Guardado!'); await load(); }
      catch (err) { $('#err').textContent = err.message; }
    };
    if ($('#pw')) $('#pw').onclick = async () => {
      if ($('#pw1').value !== $('#pw2').value) { $('#errpw').textContent = 'Las dos contraseñas nuevas no son iguales'; return; }
      try { await H.api('/api/panel/password', { body: { current: $('#pw0').value, next: $('#pw1').value } }); H.toast('Contraseña cambiada'); drawDatos(); }
      catch (err) { $('#errpw').textContent = err.message; }
    };
  }

  start();
}

export function panelPage(env) {
  return shell({
    env, title: `Mi salón · ${env.APP_NAME || 'Fecha Libre'}`, manifest: '/panel.webmanifest', appTitle: 'Mi salón',
    head: '<meta name="robots" content="noindex">',
    body: '<main class="wrap" id="app" style="padding-bottom:40px"></main>',
    scripts: `<script>(${panelClient.toString()})();</script>`,
  });
}

// ---------- Panel de la administradora ----------
function adminClient() {
  const H = window.H;
  const $ = (s) => document.querySelector(s);
  const app = $('#app');
  let venues = [];
  const PALETTES = [
    ['#7a3e9d', '#f4b942'], ['#2f6f5e', '#e9a23b'], ['#c2410c', '#fde68a'], ['#1d4ed8', '#fbbf24'],
    ['#be185d', '#fbcfe8'], ['#111827', '#d4af37'], ['#0f766e', '#99f6e4'], ['#7c2d12', '#fdba74'],
  ];

  async function start() {
    try {
      const me = await H.api('/api/me');
      if (me.role !== 'admin') throw new Error();
      await list();
    } catch { loginView(); }
  }

  function loginView() {
    app.innerHTML = '<section class="card" style="margin-top:12vh"><h2>Administración</h2><form id="f"><label>Usuario<input id="u" autocapitalize="none" autocomplete="username"></label><label>Contraseña<input id="p" type="password" autocomplete="current-password"></label><p class="err" id="err"></p><button class="btn block">Entrar</button></form></section>';
    $('#f').onsubmit = async (e) => {
      e.preventDefault();
      try {
        const r = await H.api('/api/login', { body: { username: $('#u').value, password: $('#p').value } });
        if (r.role !== 'admin') { location.href = '/panel'; return; }
        await list();
      } catch (err) { $('#err').textContent = err.message; }
    };
  }

  async function list() {
    venues = (await H.api('/api/admin/venues')).venues;
    app.innerHTML = '<header style="display:flex;align-items:center;gap:10px;padding:18px 0 0"><h2 style="flex:1;margin:0">Mis salones</h2><button class="btn alt small" id="salir">Salir</button></header>' +
      '<button class="btn block" id="nuevo" style="margin-top:14px">+ Nuevo salón</button>' +
      venues.map((v) => '<section class="card" style="display:flex;gap:12px;align-items:center;cursor:pointer" data-id="' + v.id + '">' +
        (v.logo ? '<img src="' + v.logo + '" style="width:52px;height:52px;border-radius:14px;object-fit:contain;background:#f6f3ee">' : '<div style="width:52px;height:52px;border-radius:14px;background:' + v.color2 + ';display:flex;align-items:center;justify-content:center;font-size:28px">' + H.esc(v.emoji) + '</div>') +
        '<div style="flex:1;min-width:0"><b>' + H.esc(v.name) + '</b><div class="small muted">/s/' + v.slug + (v.username ? ' · usuario: ' + H.esc(v.username) : '') + '</div>' +
        '<div style="margin-top:4px">' + (v.isDemo ? '<span class="tag">Ejemplo</span> ' : '') + (v.ready ? '<span class="tag ok">Pública</span>' : '<span class="tag wait">En preparación</span>') + '</div></div><span>›</span></section>').join('');
    $('#salir').onclick = async () => { await H.api('/api/logout', { body: {} }); location.reload(); };
    $('#nuevo').onclick = nuevo;
    app.querySelectorAll('[data-id]').forEach((el) => (el.onclick = () => edit(venues.find((v) => v.id == el.dataset.id))));
  }

  function credentials(title, v, username, password) {
    const msg = '¡Hola! Ya está creado tu panel de ' + v.name + ' en ' + window.APP_NAME + '.\n\nEntrá acá para marcar tus fechas ocupadas: ' + location.origin + '/panel\nUsuario: ' + username + '\nContraseña: ' + password + '\n\nCuando tu página esté lista te paso el link para compartir.';
    const sheet = H.sheet('<h3>' + title + '</h3><div class="slot"><div><span>Usuario</span><b>' + H.esc(username) + '</b></div></div><div class="slot"><div><span>Contraseña</span><b>' + H.esc(password) + '</b></div></div>' +
      '<p class="small muted">Mandale esto al dueño ahora: la contraseña después no se puede volver a ver (sí se puede generar otra).</p>' +
      '<div style="display:grid;gap:10px">' +
      (v.whatsapp ? '<a class="btn wa block" target="_blank" rel="noopener" href="' + H.waLink(v.whatsapp, msg) + '">💬 Mandar por WhatsApp al dueño</a>' : '') +
      '<button class="btn alt block" id="sharemsg">↗️ Compartir (elegís a quién)</button>' +
      '<button class="btn alt block" id="copy">📋 Copiar el mensaje</button></div>' +
      '<label>El mensaje que le llega<textarea id="msgtxt" rows="7" readonly>' + H.esc(msg) + '</textarea></label>');
    sheet.querySelector('#sharemsg').onclick = async () => {
      if (navigator.share) { try { await navigator.share({ text: msg }); } catch { /* lo cerró */ } }
      else window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
    };
    sheet.querySelector('#copy').onclick = async () => {
      const ta = sheet.querySelector('#msgtxt');
      try { await navigator.clipboard.writeText(msg); H.toast('¡Copiado! Pegalo en el chat del dueño'); return; } catch { /* probamos a mano */ }
      ta.removeAttribute('readonly'); ta.focus(); ta.select(); ta.setSelectionRange(0, msg.length);
      const ok = document.execCommand && document.execCommand('copy');
      ta.setAttribute('readonly', '');
      H.toast(ok ? '¡Copiado! Pegalo en el chat del dueño' : 'Mantené apretado el mensaje para copiarlo');
    };
  }

  function nuevo() {
    const sheet = H.sheet('<h3>Nuevo salón</h3><label>Nombre del salón<input id="nn" placeholder="Ej: Salón Las Rosas" maxlength="60"></label><label>WhatsApp del dueño<input id="nw" inputmode="tel" placeholder="Ej: 11 2345 6789"></label><p class="err" id="nerr"></p><button class="btn block" id="crear">Crear</button>');
    sheet.querySelector('#crear').onclick = async () => {
      try {
        const name = sheet.querySelector('#nn').value, whatsapp = sheet.querySelector('#nw').value;
        const r = await H.api('/api/admin/venues', { body: { name, whatsapp } });
        await list();
        credentials('¡Salón creado!', { name, whatsapp }, r.username, r.password);
      } catch (err) { sheet.querySelector('#nerr').textContent = err.message; }
    };
  }

  function edit(v) {
    const s = { ...v };
    const f = (id, label, extra) => '<label>' + label + '<input id="e_' + id + '" value="' + H.esc(s[id]) + '" ' + (extra || '') + '></label>';
    app.innerHTML = '<header style="display:flex;align-items:center;gap:10px;padding:18px 0 0"><button class="btn alt small" id="volver">‹ Volver</button><h2 style="flex:1;margin:0;font-size:20px">' + H.esc(v.name) + '</h2></header>' +
      '<section class="card"><label style="display:flex;align-items:center;gap:10px;margin:0"><input type="checkbox" id="e_ready" style="width:24px;height:24px;margin:0"' + (s.ready ? ' checked' : '') + '> Página lista y pública</label>' +
        '<p class="small muted" style="margin:6px 0 10px">Mientras no esté tildado, la página dice "en preparación" (vos y el dueño sí la ven).</p>' +
        '<div class="chips"><a class="btn alt small" target="_blank" href="/s/' + v.slug + '">👀 Ver página</a>' +
        (v.isDemo ? '<button class="btn alt small" id="resetdemo">🔄 Reiniciar ejemplo</button>' : '<button class="btn alt small" id="newpw">📲 Mandar acceso al dueño</button>') + '</div>' +
        (v.isDemo ? '' : '<p class="small muted" style="margin:8px 0 0">"Mandar acceso" crea una contraseña nueva (la anterior deja de andar) y te deja mandársela por WhatsApp.</p>') + '</section>' +
      '<section class="card"><h3>Logo y colores <span class="tag">Extra</span></h3>' +
        '<div style="display:flex;gap:14px;align-items:center;margin-top:10px"><div id="prevlogo"></div><div class="chips"><label class="btn alt small" style="margin:0">📷 Subir logo<input type="file" id="e_logo" accept="image/*" style="display:none"></label><button class="btn alt small" id="nologo">Quitar</button></div></div>' +
        '<button class="btn alt small" id="fromlogo" style="margin-top:10px">🎨 Sacar colores del logo</button>' +
        '<div style="display:flex;gap:12px;margin-top:6px"><label style="flex:1">Color principal<input type="color" id="e_color1" value="' + s.color1 + '" style="height:48px;padding:4px"></label><label style="flex:1">Color de acento<input type="color" id="e_color2" value="' + s.color2 + '" style="height:48px;padding:4px"></label></div>' +
        '<p class="small muted" style="margin:10px 0 6px">Combinaciones listas:</p><div class="chips" id="pals">' + PALETTES.map((p, i) => '<button data-p="' + i + '" style="width:44px;height:44px;border-radius:12px;border:0;cursor:pointer;background:linear-gradient(135deg,' + p[0] + ' 55%,' + p[1] + ' 55%)" aria-label="Combinación ' + (i + 1) + '"></button>').join('') + '</div>' +
        f('emoji', 'Emoji (si no hay logo)', 'maxlength="8" style="width:90px;font-size:24px"') +
      '</section>' +
      '<section class="card"><h3>Datos</h3>' +
        f('name', 'Nombre', 'maxlength="60"') + f('slug', 'Link: ' + location.origin + '/s/…', 'autocapitalize="none" maxlength="40"') +
        f('tagline', 'Frase corta', 'maxlength="120"') + f('capacity', 'Capacidad', 'maxlength="60"') + f('price', 'Precio', 'maxlength="60"') +
        f('address', 'Zona o dirección', 'maxlength="120"') + f('whatsapp', 'WhatsApp del salón', 'inputmode="tel"') + f('instagram', 'Instagram', 'autocapitalize="none" placeholder="@misalon"') +
      '</section><p class="err" id="eerr"></p><button class="btn block" id="guardar">Guardar</button>' +
      (v.isDemo ? '' : '<button class="btn danger block" id="borrar" style="margin:14px 0 40px">Borrar salón</button>') + '<div style="height:30px"></div>';

    const drawLogo = () => {
      $('#prevlogo').innerHTML = s.logo ? '<img src="' + s.logo + '" style="width:72px;height:72px;border-radius:18px;object-fit:contain;background:#f6f3ee">' : '<div style="width:72px;height:72px;border-radius:18px;background:' + s.color2 + ';display:flex;align-items:center;justify-content:center;font-size:38px">' + H.esc(s.emoji) + '</div>';
      $('#fromlogo').style.display = s.logo ? '' : 'none';
    };
    drawLogo();
    $('#volver').onclick = list;
    $('#e_logo').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try { s.logo = await shrink(file); drawLogo(); H.toast('Logo cargado. Acordate de Guardar.'); }
      catch { H.toast('No se pudo leer esa imagen'); }
    };
    $('#nologo').onclick = () => { s.logo = ''; drawLogo(); };
    $('#fromlogo').onclick = async () => {
      const [a, b] = await colorsOf(s.logo);
      if (a) $('#e_color1').value = a;
      if (b) $('#e_color2').value = b;
      H.toast('Listo, mirá si te gustan');
    };
    $('#pals').onclick = (e) => { const b = e.target.closest('[data-p]'); if (!b) return; const p = PALETTES[b.dataset.p]; $('#e_color1').value = p[0]; $('#e_color2').value = p[1]; };
    if ($('#newpw')) $('#newpw').onclick = async () => {
      if (!confirm('Se va a crear una contraseña nueva para el dueño (la anterior deja de andar). ¿Seguimos?')) return;
      try { const r = await H.api('/api/admin/venues/' + v.id + '/password', { body: {} }); credentials('Acceso para el dueño', v, r.username, r.password); }
      catch (err) { H.toast(err.message); }
    };
    if ($('#resetdemo')) $('#resetdemo').onclick = async () => { await H.api('/api/admin/venues/' + v.id + '/reset-demo', { body: {} }); H.toast('Ejemplo reiniciado'); };
    $('#guardar').onclick = async () => {
      const body = { ready: $('#e_ready').checked, color1: $('#e_color1').value, color2: $('#e_color2').value, logo: s.logo || '' };
      ['emoji', 'name', 'slug', 'tagline', 'capacity', 'price', 'address', 'whatsapp', 'instagram'].forEach((k) => (body[k] = $('#e_' + k).value));
      try { await H.api('/api/admin/venues/' + v.id, { method: 'PUT', body }); H.toast('¡Guardado!'); await list(); }
      catch (err) { $('#eerr').textContent = err.message; }
    };
    if ($('#borrar')) $('#borrar').onclick = async () => {
      const answer = prompt('Para borrar "' + v.name + '" con todas sus fechas, escribí la palabra BORRAR');
      if (answer === null) return;
      if (answer.trim().toLowerCase() !== 'borrar') { H.toast('No se borró: tenés que escribir la palabra BORRAR'); return; }
      try {
        await H.api('/api/admin/venues/' + v.id, { method: 'DELETE', body: {} });
        H.toast('Salón borrado');
        await list();
      } catch (err) { H.toast(err.message); }
    };
  }

  // Achica la imagen a 320 px como máximo, para que pese poco
  function loadImg(src) {
    return new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
  }
  async function shrink(file) {
    const url = URL.createObjectURL(file);
    const img = await loadImg(url);
    const k = Math.min(1, 320 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    const webp = c.toDataURL('image/webp', 0.9);
    return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/png');
  }
  // Los dos colores que más aparecen en el logo (sin contar blancos, negros ni grises)
  async function colorsOf(src) {
    const img = await loadImg(src);
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, 64, 64);
    const px = ctx.getImageData(0, 0, 64, 64).data;
    const count = {};
    for (let i = 0; i < px.length; i += 4) {
      const [r, g, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]];
      if (a < 200) continue;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max - min < 28 || max < 40 || min > 225) continue;
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      count[key] = (count[key] || 0) + 1;
    }
    const keys = Object.keys(count).sort((a, b) => count[b] - count[a]).map(Number);
    const hex = (k) => '#' + [(k >> 8) & 15, (k >> 4) & 15, k & 15].map((v) => (v * 16 + 8).toString(16).padStart(2, '0')).join('');
    const dist = (a, b) => Math.abs(((a >> 8) & 15) - ((b >> 8) & 15)) + Math.abs(((a >> 4) & 15) - ((b >> 4) & 15)) + Math.abs((a & 15) - (b & 15));
    const first = keys[0];
    const second = keys.find((k) => dist(k, first) > 6);
    return [first !== undefined ? hex(first) : null, second !== undefined ? hex(second) : null];
  }

  start();
}

export function adminPage(env) {
  return shell({
    env, title: `Administración · ${env.APP_NAME || 'Fecha Libre'}`, manifest: '/admin.webmanifest', appTitle: 'Mis salones',
    head: '<meta name="robots" content="noindex">',
    body: '<main class="wrap" id="app" style="padding-bottom:40px"></main>',
    scripts: `<script>(${adminClient.toString()})();</script>`,
  });
}
