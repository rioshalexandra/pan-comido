// Fecha Libre: servidor (Cloudflare Worker). Páginas en pages.js, contraseñas en auth.js.
import { hashPassword, checkPassword, newToken, friendlyPassword } from './auth.js';
import { homePage, venuePage, notReadyPage, notFoundPage, panelPage, adminPage } from './pages.js';
import { DEMO_VENUES, DEMO_USER, DEMO_PASSWORD, demoBlocks } from './demo.js';

const SESSION_DAYS = 60;
const COOKIE = 'fl_sid';

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
const html = (body, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' } });
const fail = (error, status = 400) => json({ error }, status);

// Fecha de hoy en Argentina (UTC-3), como AAAA-MM-DD
const todayAR = (offsetDays = 0) => new Date(Date.now() - 3 * 3600e3 + offsetDays * 86400e3).toISOString().slice(0, 10);

const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const isColor = (v) => /^#[0-9a-f]{6}$/i.test(v);
const slugify = (s) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/^(salon|salón|quinta|espacio)\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'salon';

function cleanSlots(v) {
  if (!Array.isArray(v)) return null;
  const out = v.slice(0, 4).map((s, i) => ({
    id: /^s\d{1,3}$/.test(s?.id) ? s.id : `s${Date.now() % 1000}${i}`,
    label: str(s?.label, 30),
    hours: str(s?.hours, 30),
  })).filter((s) => s.label);
  return out.length ? out : null;
}

// Campos que puede cambiar el dueño (y la admin)
function ownerFields(b) {
  const f = {};
  for (const [k, max] of [['name', 60], ['tagline', 120], ['address', 120], ['capacity', 60], ['price', 60], ['whatsapp', 30], ['instagram', 120]]) {
    if (b[k] !== undefined) f[k] = str(b[k], max);
  }
  if (f.name === '') delete f.name;
  if (b.slots !== undefined) {
    const slots = cleanSlots(b.slots);
    if (slots) f.slots = JSON.stringify(slots);
  }
  return f;
}

async function updateVenue(db, id, f) {
  const keys = Object.keys(f);
  if (!keys.length) return;
  await db.prepare(`UPDATE venues SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).bind(...keys.map((k) => f[k]), id).run();
}

const publicVenue = (v) => ({
  id: v.id, slug: v.slug, name: v.name, tagline: v.tagline, address: v.address, capacity: v.capacity, price: v.price,
  whatsapp: v.whatsapp, instagram: v.instagram, emoji: v.emoji, color1: v.color1, color2: v.color2,
  hasLogo: !!v.logo, slots: JSON.parse(v.slots || '[]'), ready: !!v.ready, isDemo: !!v.is_demo,
});

// ---------- Sesiones ----------

function getCookie(req, name) {
  const m = (req.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}

async function getSession(req, env) {
  const token = getCookie(req, COOKIE);
  if (!token) return null;
  return env.DB.prepare(
    `SELECT s.token, s.role, s.user_id, u.venue_id, u.username FROM sessions s LEFT JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`,
  ).bind(token, Math.floor(Date.now() / 1000)).first();
}

async function startSession(env, role, userId) {
  const token = newToken();
  await env.DB.prepare('INSERT INTO sessions (token, user_id, role, expires_at) VALUES (?, ?, ?, ?)')
    .bind(token, userId, role, Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400).run();
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

function sameText(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

// ---------- Demo ----------

async function ensureDemo(env) {
  const have = await env.DB.prepare('SELECT COUNT(*) AS n FROM venues WHERE is_demo = 1').first();
  if (have.n >= DEMO_VENUES.length) return;
  for (const d of DEMO_VENUES) {
    const exists = await env.DB.prepare('SELECT id FROM venues WHERE slug = ?').bind(d.slug).first();
    if (!exists) await env.DB.prepare('INSERT INTO venues (slug, name, is_demo, ready) VALUES (?, ?, 1, 1)').bind(d.slug, d.name).run();
  }
  const main = await env.DB.prepare('SELECT id FROM venues WHERE slug = ?').bind(DEMO_VENUES[0].slug).first();
  if (!(await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(DEMO_USER).first())) {
    await env.DB.prepare('INSERT INTO users (venue_id, username, password_hash) VALUES (?, ?, ?)')
      .bind(main.id, DEMO_USER, await hashPassword(DEMO_PASSWORD)).run();
  }
  await resetDemo(env);
}

// Vuelve los salones de ejemplo a como estaban, con fechas ocupadas a partir de hoy
async function resetDemo(env, onlyIfOlderThanHours = 0) {
  const venues = (await env.DB.prepare('SELECT * FROM venues WHERE is_demo = 1').all()).results;
  const now = Math.floor(Date.now() / 1000);
  for (const v of venues) {
    if (onlyIfOlderThanHours && now - v.demo_reset_at < onlyIfOlderThanHours * 3600) continue;
    const d = DEMO_VENUES.find((x) => x.slug === v.slug);
    if (!d) continue;
    const { slug, ...fields } = d.fields;
    await updateVenue(env.DB, v.id, {
      ...fields, name: d.name, whatsapp: env.SELLER_WHATSAPP || '', slots: JSON.stringify(d.slots), ready: 1, demo_reset_at: now,
    });
    const stmts = [env.DB.prepare('DELETE FROM blocks WHERE venue_id = ?').bind(v.id)];
    for (const b of demoBlocks(v.slug, d.slots, todayAR(), d.busy)) {
      stmts.push(env.DB.prepare('INSERT INTO blocks (venue_id, date, slot, note) VALUES (?, ?, ?, ?)').bind(v.id, b.date, b.slot, b.note));
    }
    await env.DB.batch(stmts);
  }
}

// ---------- API ----------

async function api(req, env, url, session) {
  const { pathname } = url;
  const method = req.method;
  let body = {};
  if (method !== 'GET') {
    // Solo JSON: así un formulario de otra página no puede mandar pedidos con la sesión del usuario
    if (!(req.headers.get('content-type') || '').includes('application/json')) return fail('Pedido inválido', 415);
    try { body = await req.json(); } catch { body = {}; }
  }

  if (pathname === '/api/login' && method === 'POST') {
    const username = str(body.username, 60).toLowerCase();
    const password = String(body.password || '');
    if (env.ADMIN_USER && env.ADMIN_PASSWORD && sameText(username, env.ADMIN_USER.toLowerCase()) && sameText(password, env.ADMIN_PASSWORD)) {
      return json({ role: 'admin' }, 200, { 'set-cookie': await startSession(env, 'admin', null) });
    }
    if (username === DEMO_USER) await ensureDemo(env);
    const user = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
    if (!user || !(await checkPassword(password, user.password_hash))) return fail('Usuario o contraseña incorrectos', 401);
    if (username === DEMO_USER) await resetDemo(env);
    return json({ role: 'owner' }, 200, { 'set-cookie': await startSession(env, 'owner', user.id) });
  }

  if (pathname === '/api/logout' && method === 'POST') {
    if (session) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(session.token).run();
    return json({ ok: true }, 200, { 'set-cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` });
  }

  if (!session) return fail('Tenés que entrar de nuevo', 401);

  if (pathname === '/api/me') return json({ role: session.role, username: session.username || env.ADMIN_USER });

  // ----- Dueño -----
  if (pathname.startsWith('/api/panel')) {
    if (session.role !== 'owner') return fail('Solo para dueños', 403);
    const venueId = session.venue_id;
    const isDemoUser = session.username === DEMO_USER;

    if (pathname === '/api/panel' && method === 'GET') {
      const v = await env.DB.prepare('SELECT * FROM venues WHERE id = ?').bind(venueId).first();
      if (!v) return fail('No encontramos tu salón', 404);
      const blocks = (await env.DB.prepare('SELECT date, slot, note FROM blocks WHERE venue_id = ? AND date >= ? ORDER BY date')
        .bind(venueId, todayAR(-90)).all()).results;
      return json({ venue: publicVenue(v), blocks, username: session.username, isDemoUser });
    }

    // Guarda los turnos de un día: [{ slot, taken, note }]
    if (pathname === '/api/panel/day' && method === 'POST') {
      const date = str(body.date, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('Fecha inválida');
      const stmts = [];
      for (const s of Array.isArray(body.slots) ? body.slots.slice(0, 4) : []) {
        const slot = str(s.slot, 8);
        if (!/^s\d{1,4}$/.test(slot)) continue;
        stmts.push(s.taken
          ? env.DB.prepare('INSERT INTO blocks (venue_id, date, slot, note) VALUES (?, ?, ?, ?) ON CONFLICT (venue_id, date, slot) DO UPDATE SET note = excluded.note')
            .bind(venueId, date, slot, str(s.note, 200))
          : env.DB.prepare('DELETE FROM blocks WHERE venue_id = ? AND date = ? AND slot = ?').bind(venueId, date, slot));
      }
      if (stmts.length) await env.DB.batch(stmts);
      return json({ ok: true });
    }

    if (pathname === '/api/panel/venue' && method === 'PUT') {
      await updateVenue(env.DB, venueId, ownerFields(body));
      return json({ ok: true });
    }

    if (pathname === '/api/panel/password' && method === 'POST') {
      if (isDemoUser) return fail('En la demo no se puede cambiar la contraseña');
      const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.user_id).first();
      if (!(await checkPassword(String(body.current || ''), user.password_hash))) return fail('La contraseña actual no es correcta');
      const next = String(body.next || '');
      if (next.length < 6) return fail('La nueva contraseña tiene que tener al menos 6 letras o números');
      await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(next), user.id).run();
      return json({ ok: true });
    }
    return fail('No encontrado', 404);
  }

  // ----- Admin (quien vende la app) -----
  if (pathname.startsWith('/api/admin')) {
    if (session.role !== 'admin') return fail('Solo para la administradora', 403);
    const m = pathname.match(/^\/api\/admin\/venues\/(\d+)(\/[a-z-]+)?$/);
    const id = m ? Number(m[1]) : null;

    if (pathname === '/api/admin/venues' && method === 'GET') {
      await ensureDemo(env);
      const rows = (await env.DB.prepare(
        `SELECT v.*, u.username FROM venues v LEFT JOIN users u ON u.venue_id = v.id ORDER BY v.is_demo, v.created_at DESC`,
      ).all()).results;
      return json({ venues: rows.map((v) => ({ ...publicVenue(v), username: v.username, logo: v.logo || '' })) });
    }

    if (pathname === '/api/admin/venues' && method === 'POST') {
      const name = str(body.name, 60);
      if (!name) return fail('Poné el nombre del salón');
      let slug = slugify(name);
      for (let i = 2; await env.DB.prepare('SELECT id FROM venues WHERE slug = ?').bind(slug).first(); i++) slug = `${slugify(name)}-${i}`;
      const res = await env.DB.prepare('INSERT INTO venues (slug, name, whatsapp) VALUES (?, ?, ?)').bind(slug, name, str(body.whatsapp, 30)).run();
      const venueId = res.meta.last_row_id;
      const base = slug.replace(/-/g, '').slice(0, 20);
      let username = base;
      for (let i = 2; await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first(); i++) username = `${base}${i}`;
      const password = friendlyPassword();
      await env.DB.prepare('INSERT INTO users (venue_id, username, password_hash) VALUES (?, ?, ?)').bind(venueId, username, await hashPassword(password)).run();
      return json({ id: venueId, slug, username, password });
    }

    if (id && !m[2] && method === 'PUT') {
      const f = ownerFields(body);
      if (body.emoji !== undefined) f.emoji = str(body.emoji, 8) || '🎉';
      if (isColor(body.color1)) f.color1 = body.color1;
      if (isColor(body.color2)) f.color2 = body.color2;
      if (body.ready !== undefined) f.ready = body.ready ? 1 : 0;
      if (body.logo !== undefined) {
        if (body.logo === '' || body.logo === null) f.logo = null;
        else if (/^data:image\/(png|jpeg|webp);base64,/.test(body.logo) && body.logo.length < 700000) f.logo = body.logo;
        else return fail('El logo es muy pesado o no es una imagen');
      }
      if (body.slug !== undefined) {
        const slug = slugify(body.slug);
        const taken = await env.DB.prepare('SELECT id FROM venues WHERE slug = ? AND id != ?').bind(slug, id).first();
        if (taken) return fail('Ese link ya lo usa otro salón');
        f.slug = slug;
      }
      await updateVenue(env.DB, id, f);
      return json({ ok: true, slug: f.slug });
    }

    if (id && m[2] === '/password' && method === 'POST') {
      const user = await env.DB.prepare('SELECT * FROM users WHERE venue_id = ?').bind(id).first();
      if (!user) return fail('Ese salón no tiene usuario');
      if (user.username === DEMO_USER) return fail('La contraseña de la demo no se cambia');
      const password = friendlyPassword();
      await env.DB.batch([
        env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(password), user.id),
        env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
      ]);
      return json({ username: user.username, password });
    }

    if (id && m[2] === '/reset-demo' && method === 'POST') {
      await resetDemo(env);
      return json({ ok: true });
    }

    if (id && !m[2] && method === 'DELETE') {
      const v = await env.DB.prepare('SELECT is_demo FROM venues WHERE id = ?').bind(id).first();
      if (v?.is_demo) return fail('Los salones de ejemplo no se borran');
      await env.DB.batch([
        env.DB.prepare('DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE venue_id = ?)').bind(id),
        env.DB.prepare('DELETE FROM users WHERE venue_id = ?').bind(id),
        env.DB.prepare('DELETE FROM blocks WHERE venue_id = ?').bind(id),
        env.DB.prepare('DELETE FROM venues WHERE id = ?').bind(id),
      ]);
      return json({ ok: true });
    }
    return fail('No encontrado', 404);
  }

  return fail('No encontrado', 404);
}

// ---------- Páginas ----------

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const { pathname } = url;
    try {
      const session = await getSession(req, env);
      if (pathname.startsWith('/api/')) return await api(req, env, url, session);

      if (pathname === '/') {
        await ensureDemo(env);
        return html(homePage(env, url.origin));
      }
      if (pathname === '/panel') return html(panelPage(env));
      if (pathname === '/admin') return html(adminPage(env));
      if (pathname === '/demo') return Response.redirect(`${url.origin}/panel?demo=1`, 302);

      const logo = pathname.match(/^\/s\/([a-z0-9-]+)\/logo$/);
      if (logo) {
        const v = await env.DB.prepare('SELECT logo FROM venues WHERE slug = ?').bind(logo[1]).first();
        if (!v?.logo) return new Response('', { status: 404 });
        const [, type, b64] = v.logo.match(/^data:([^;]+);base64,(.*)$/);
        return new Response(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)), {
          headers: { 'content-type': type, 'cache-control': 'public, max-age=300' },
        });
      }

      const page = pathname.match(/^\/s\/([a-z0-9-]+)\/?$/);
      if (page) {
        if (DEMO_VENUES.some((d) => d.slug === page[1])) {
          await ensureDemo(env);
          await resetDemo(env, 6);
        }
        const v = await env.DB.prepare('SELECT * FROM venues WHERE slug = ?').bind(page[1]).first();
        if (!v) return html(notFoundPage(env), 404);
        const canPreview = session && (session.role === 'admin' || session.venue_id === v.id);
        if (!v.ready && !canPreview) return html(notReadyPage(env, v));
        const blocks = (await env.DB.prepare('SELECT date, slot FROM blocks WHERE venue_id = ? AND date >= ? AND date <= ?')
          .bind(v.id, todayAR(-2), todayAR(400)).all()).results.map((b) => [b.date, b.slot]);
        return html(venuePage(env, url.origin, publicVenue(v), blocks, { preview: !v.ready }));
      }

      return html(notFoundPage(env), 404);
    } catch (err) {
      console.error(err);
      if (pathname.startsWith('/api/')) return fail('Algo salió mal. Probá de nuevo en un ratito.', 500);
      return html('<p style="font-family:sans-serif;padding:24px">Algo salió mal. Probá de nuevo en un ratito.</p>', 500);
    }
  },
};
