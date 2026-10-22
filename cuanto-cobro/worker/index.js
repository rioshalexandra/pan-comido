// Cuánto Cobro — servidor (Cloudflare Worker + D1).
// Solo guarda las cuentas: cada compradora entra con su usuario y contraseña.
// Sus recetas, ingredientes y producción se guardan en su celular (src/lib/localDb.js).
// La dueña de la app (rol admin) da de alta las cuentas desde /admin.
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { checkPassword, friendlyPassword, hashPassword, newToken } from './auth.js';

const app = new Hono();
const COOKIE = 'cc_sesion';
const SESSION_DAYS = 30;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new HttpError(status, message);
};

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: 'Algo salió mal. Probá de nuevo en un ratito.' }, 500);
});

// ---------- utilidades ----------
const text = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const today = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10); // hora argentina
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

const all = async (db, sql, ...params) => (await db.prepare(sql).bind(...params).all()).results;
const first = (db, sql, ...params) => db.prepare(sql).bind(...params).first();
const run = (db, sql, ...params) => db.prepare(sql).bind(...params).run();

async function body(c) {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
}

// Crea la cuenta admin la primera vez, con el usuario y la contraseña de las variables de Cloudflare
async function ensureAdmin(env) {
  if (!env.ADMIN_USER || !env.ADMIN_PASSWORD) return;
  const exists = await first(env.DB, `SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
  if (exists) return;
  const hash = await hashPassword(env.ADMIN_PASSWORD);
  const res = await run(
    env.DB,
    `INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, 'admin')`,
    env.ADMIN_USER.trim(),
    hash,
    env.ADMIN_NAME || 'Administradora'
  );
  await run(env.DB, `INSERT INTO settings (user_id) VALUES (?)`, res.meta.last_row_id);
}

function expired(user) {
  return user.expires_at && user.expires_at < today();
}

// ---------- entrar y salir ----------
app.post('/api/login', async (c) => {
  const db = c.env.DB;
  await ensureAdmin(c.env);
  const { username, password } = await body(c);
  const name = text(username, 80).toLowerCase();
  if (!name || !password) fail(400, 'Escribí tu usuario y tu contraseña');

  const recent = await first(
    db,
    `SELECT COUNT(*) AS n FROM login_attempts WHERE username = ? AND at > datetime('now', '-15 minutes')`,
    name
  );
  if (recent.n >= 8) fail(429, 'Probaste muchas veces. Esperá 15 minutos y volvé a intentar.');

  const user = await first(db, `SELECT * FROM users WHERE username = ?`, name);
  if (!user || !(await checkPassword(String(password), user.password_hash))) {
    await run(db, `INSERT INTO login_attempts (username) VALUES (?)`, name);
    fail(401, 'El usuario o la contraseña no coinciden');
  }
  if (!user.active) fail(403, 'Tu acceso está pausado. Escribile a quien te vendió la app.');
  if (expired(user)) fail(403, 'Tu acceso venció. Escribile a quien te vendió la app para renovarlo.');

  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400 * 1000).toISOString();
  await db.batch([
    db.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`).bind(token, user.id, expires),
    db.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`).bind(user.id),
    db.prepare(`DELETE FROM login_attempts WHERE username = ?`).bind(name),
    db.prepare(`DELETE FROM sessions WHERE expires_at < ?`).bind(new Date().toISOString()),
  ]);
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
  return c.json({ ok: true });
});

app.post('/api/logout', async (c) => {
  const token = getCookie(c, COOKIE);
  if (token) await run(c.env.DB, `DELETE FROM sessions WHERE token = ?`, token);
  deleteCookie(c, COOKIE, { path: '/' });
  return c.json({ ok: true });
});

// Todo lo que sigue necesita estar adentro
app.use('/api/*', async (c, next) => {
  const token = getCookie(c, COOKIE);
  if (!token) fail(401, 'Tenés que entrar con tu usuario');
  const user = await first(
    c.env.DB,
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?`,
    token,
    new Date().toISOString()
  );
  if (!user) fail(401, 'Tenés que entrar con tu usuario');
  if (!user.active || expired(user)) {
    await run(c.env.DB, `DELETE FROM sessions WHERE user_id = ?`, user.id);
    fail(401, 'Tu acceso venció o está pausado. Escribile a quien te vendió la app.');
  }
  c.set('user', user);
  c.set('uid', user.id);
  await next();
});

app.get('/api/me', async (c) => {
  const user = c.get('user');
  const settings = await first(c.env.DB, `SELECT * FROM settings WHERE user_id = ?`, user.id);
  return c.json({
    user: { id: user.id, username: user.username, name: user.name, role: user.role, expires_at: user.expires_at },
    settings,
    // 2 = cuenta de demostración, con compras, pagos y producción de ejemplo
    examples: user.seed_examples === 2 ? 'demo' : !!user.seed_examples,
    appName: c.env.APP_NAME || 'Cuánto Cobro',
    sellerPhone: c.env.SELLER_WHATSAPP || '',
  });
});

app.post('/api/password', async (c) => {
  const user = c.get('user');
  if (user.seed_examples === 2) fail(400, 'Esta es la cuenta de demostración: la contraseña no se puede cambiar.');
  const { current, next } = await body(c);
  if (!(await checkPassword(String(current || ''), user.password_hash))) fail(400, 'La contraseña actual no es correcta');
  if (String(next || '').length < 6) fail(400, 'La nueva contraseña tiene que tener al menos 6 letras o números');
  const hash = await hashPassword(String(next));
  const token = getCookie(c, COOKIE);
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).bind(hash, user.id),
    c.env.DB.prepare(`DELETE FROM sessions WHERE user_id = ? AND token <> ?`).bind(user.id, token),
  ]);
  return c.json({ ok: true });
});

// ---------- panel de la dueña: cuentas de quienes compraron ----------
app.use('/api/admin/*', async (c, next) => {
  if (c.get('user').role !== 'admin') fail(403, 'Esta parte es solo para la administradora');
  await next();
});

const CLIENT_SELECT = `
  SELECT u.id, u.username, u.name, u.active, u.expires_at, u.phone, u.notes, u.created_at, u.last_login_at
  FROM users u WHERE u.role = 'client'`;

app.get('/api/admin/clients', async (c) =>
  c.json({ data: await all(c.env.DB, `${CLIENT_SELECT} ORDER BY u.created_at DESC`) })
);

function clientFields(b) {
  const expires = b.expires_at ? (isDate(b.expires_at) ? b.expires_at : fail(400, 'La fecha de vencimiento no es válida')) : null;
  return { name: text(b.name, 80), phone: text(b.phone, 40), notes: text(b.notes), expires };
}

app.post('/api/admin/clients', async (c) => {
  const db = c.env.DB;
  const b = await body(c);
  const f = clientFields(b);
  if (!f.name) fail(400, 'Poné el nombre de la clienta');
  const username = text(b.username, 40).toLowerCase().replace(/\s+/g, '');
  if (!/^[a-z0-9._@-]{3,40}$/.test(username)) fail(400, 'El usuario tiene que tener al menos 3 letras o números, sin espacios');
  if (await first(db, `SELECT id FROM users WHERE username = ?`, username)) fail(400, 'Ese usuario ya existe, elegí otro');
  const password = friendlyPassword();
  const res = await run(
    db,
    `INSERT INTO users (username, password_hash, name, role, expires_at, phone, notes, seed_examples) VALUES (?, ?, ?, 'client', ?, ?, ?, ?)`,
    username, await hashPassword(password), f.name, f.expires, f.phone, f.notes, b.with_examples ? 1 : 0
  );
  const id = res.meta.last_row_id;
  await run(db, `INSERT INTO settings (user_id, business_name) VALUES (?, ?)`, id, text(b.business_name, 80));
  return c.json({ data: await first(db, `${CLIENT_SELECT} AND u.id = ?`, id), password });
});

app.put('/api/admin/clients/:id', async (c) => {
  const b = await body(c);
  const f = clientFields(b);
  if (!f.name) fail(400, 'Poné el nombre de la clienta');
  const res = await run(
    c.env.DB,
    `UPDATE users SET name = ?, phone = ?, notes = ?, expires_at = ?, active = ? WHERE id = ? AND role = 'client'`,
    f.name, f.phone, f.notes, f.expires, b.active ? 1 : 0, c.req.param('id')
  );
  if (!res.meta.changes) fail(404, 'No encontré esa cuenta');
  if (!b.active) await run(c.env.DB, `DELETE FROM sessions WHERE user_id = ?`, c.req.param('id'));
  return c.json({ data: await first(c.env.DB, `${CLIENT_SELECT} AND u.id = ?`, c.req.param('id')) });
});

// Nueva contraseña (por si se la olvidó). Cierra sus sesiones abiertas.
app.post('/api/admin/clients/:id/reset', async (c) => {
  const db = c.env.DB;
  const user = await first(db, `SELECT id FROM users WHERE id = ? AND role = 'client'`, c.req.param('id'));
  if (!user) fail(404, 'No encontré esa cuenta');
  const password = friendlyPassword();
  await db.batch([
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).bind(await hashPassword(password), user.id),
    db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(user.id),
  ]);
  return c.json({ password });
});

app.delete('/api/admin/clients/:id', async (c) => {
  const res = await run(c.env.DB, `DELETE FROM users WHERE id = ? AND role = 'client'`, c.req.param('id'));
  if (!res.meta.changes) fail(404, 'No encontré esa cuenta');
  return c.json({ ok: true });
});

app.all('/api/*', (c) => c.json({ error: 'No existe' }, 404));

export default app;
