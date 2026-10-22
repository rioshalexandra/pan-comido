// Cuánto Cobro — servidor (Cloudflare Worker + D1).
// Cada compradora entra con su usuario y contraseña y solo ve sus datos.
// La dueña de la app (rol admin) da de alta las cuentas desde /admin.
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { checkPassword, friendlyPassword, hashPassword, newToken } from './auth.js';
import { seedExamples } from './examples.js';

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
const num = (v, fallback = 0) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};
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
    appName: c.env.APP_NAME || 'Cuánto Cobro',
    sellerPhone: c.env.SELLER_WHATSAPP || '',
  });
});

app.post('/api/password', async (c) => {
  const user = c.get('user');
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

// ---------- configuración ----------
app.put('/api/settings', async (c) => {
  const b = await body(c);
  await run(
    c.env.DB,
    `UPDATE settings SET business_name = ?, labor_hour_rate = ?, energy_monthly = ?, oven_hours_month = ?, target_margin = ?
     WHERE user_id = ?`,
    text(b.business_name, 80),
    Math.max(0, num(b.labor_hour_rate)),
    Math.max(0, num(b.energy_monthly)),
    Math.max(0, num(b.oven_hours_month)),
    Math.min(95, Math.max(0, num(b.target_margin, 60))),
    c.get('uid')
  );
  return c.json({ settings: await first(c.env.DB, `SELECT * FROM settings WHERE user_id = ?`, c.get('uid')) });
});

// ---------- proveedores ----------
app.get('/api/suppliers', async (c) =>
  c.json({ data: await all(c.env.DB, `SELECT * FROM suppliers WHERE user_id = ? ORDER BY name COLLATE NOCASE`, c.get('uid')) })
);

app.post('/api/suppliers', async (c) => {
  const b = await body(c);
  if (!text(b.name)) fail(400, 'Poné el nombre del proveedor');
  const res = await run(
    c.env.DB,
    `INSERT INTO suppliers (user_id, name, phone, notes) VALUES (?, ?, ?, ?)`,
    c.get('uid'),
    text(b.name, 80),
    text(b.phone, 40),
    text(b.notes)
  );
  return c.json({ data: await first(c.env.DB, `SELECT * FROM suppliers WHERE id = ?`, res.meta.last_row_id) });
});

app.put('/api/suppliers/:id', async (c) => {
  const b = await body(c);
  if (!text(b.name)) fail(400, 'Poné el nombre del proveedor');
  const res = await run(
    c.env.DB,
    `UPDATE suppliers SET name = ?, phone = ?, notes = ? WHERE id = ? AND user_id = ?`,
    text(b.name, 80),
    text(b.phone, 40),
    text(b.notes),
    c.req.param('id'),
    c.get('uid')
  );
  if (!res.meta.changes) fail(404, 'No encontré ese proveedor');
  return c.json({ ok: true });
});

app.delete('/api/suppliers/:id', async (c) => {
  await run(c.env.DB, `DELETE FROM suppliers WHERE id = ? AND user_id = ?`, c.req.param('id'), c.get('uid'));
  return c.json({ ok: true });
});

// ---------- ingredientes ----------
const INGREDIENT_SELECT = `
  SELECT i.*, s.name AS supplier_name, s.phone AS supplier_phone,
         (SELECT COUNT(*) FROM recipe_items r WHERE r.ingredient_id = i.id) AS recipe_count
  FROM ingredients i LEFT JOIN suppliers s ON s.id = i.supplier_id`;

async function ownIngredient(c, id) {
  const row = await first(c.env.DB, `SELECT * FROM ingredients WHERE id = ? AND user_id = ?`, id, c.get('uid'));
  if (!row) fail(404, 'No encontré ese ingrediente');
  return row;
}

async function validSupplier(c, id) {
  if (!id) return null;
  const row = await first(c.env.DB, `SELECT id FROM suppliers WHERE id = ? AND user_id = ?`, id, c.get('uid'));
  return row ? row.id : null;
}

function ingredientFields(b) {
  const name = text(b.name, 80);
  if (!name) fail(400, 'Poné el nombre del ingrediente');
  const unit = ['g', 'ml', 'un'].includes(b.unit) ? b.unit : fail(400, 'Elegí la unidad');
  const packQty = num(b.pack_qty);
  if (!(packQty > 0)) fail(400, 'Poné cuánto trae el paquete');
  return {
    name,
    unit,
    packQty,
    packPrice: Math.max(0, num(b.pack_price)),
    isPackaging: b.is_packaging ? 1 : 0,
    stock: num(b.stock_qty),
    min: Math.max(0, num(b.min_stock)),
  };
}

app.get('/api/ingredients', async (c) =>
  c.json({ data: await all(c.env.DB, `${INGREDIENT_SELECT} WHERE i.user_id = ? ORDER BY i.name COLLATE NOCASE`, c.get('uid')) })
);

app.post('/api/ingredients', async (c) => {
  const b = await body(c);
  const f = ingredientFields(b);
  const supplier = await validSupplier(c, b.supplier_id);
  const res = await run(
    c.env.DB,
    `INSERT INTO ingredients (user_id, name, unit, pack_qty, pack_price, is_packaging, stock_qty, min_stock, supplier_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    c.get('uid'), f.name, f.unit, f.packQty, f.packPrice, f.isPackaging, f.stock, f.min, supplier
  );
  return c.json({ data: await first(c.env.DB, `${INGREDIENT_SELECT} WHERE i.id = ?`, res.meta.last_row_id) });
});

// Guarda en el historial si cambió el costo por gramo/ml/unidad
function priceChange(db, row, packQty, packPrice) {
  const oldCost = row.pack_qty > 0 ? row.pack_price / row.pack_qty : 0;
  const newCost = packQty > 0 ? packPrice / packQty : 0;
  if (Math.abs(oldCost - newCost) < 1e-9) return [];
  return [
    db.prepare(`INSERT INTO price_history (ingredient_id, old_unit_cost, new_unit_cost) VALUES (?, ?, ?)`).bind(row.id, oldCost, newCost),
    db.prepare(`UPDATE ingredients SET price_updated_at = datetime('now') WHERE id = ?`).bind(row.id),
  ];
}

app.put('/api/ingredients/:id', async (c) => {
  const db = c.env.DB;
  const row = await ownIngredient(c, c.req.param('id'));
  const b = await body(c);
  const f = ingredientFields(b);
  if (f.unit !== row.unit) {
    const used = await first(db, `SELECT COUNT(*) AS n FROM recipe_items WHERE ingredient_id = ?`, row.id);
    if (used.n > 0) fail(400, 'No se puede cambiar la unidad porque ya se usa en recetas');
  }
  const supplier = await validSupplier(c, b.supplier_id);
  await db.batch([
    ...priceChange(db, row, f.packQty, f.packPrice),
    db
      .prepare(
        `UPDATE ingredients SET name = ?, unit = ?, pack_qty = ?, pack_price = ?, is_packaging = ?, stock_qty = ?, min_stock = ?, supplier_id = ?
         WHERE id = ?`
      )
      .bind(f.name, f.unit, f.packQty, f.packPrice, f.isPackaging, f.stock, f.min, supplier, row.id),
  ]);
  return c.json({ data: await first(db, `${INGREDIENT_SELECT} WHERE i.id = ?`, row.id) });
});

// Cargar una compra: suma stock y, si cambió, actualiza el precio del paquete
app.post('/api/ingredients/:id/purchase', async (c) => {
  const db = c.env.DB;
  const row = await ownIngredient(c, c.req.param('id'));
  const b = await body(c);
  const packs = num(b.packs);
  if (!(packs > 0)) fail(400, 'Poné cuántos paquetes compraste');
  const packPrice = b.pack_price === '' || b.pack_price == null ? row.pack_price : Math.max(0, num(b.pack_price));
  await db.batch([
    ...priceChange(db, row, row.pack_qty, packPrice),
    db.prepare(`UPDATE ingredients SET stock_qty = stock_qty + ?, pack_price = ? WHERE id = ?`).bind(packs * row.pack_qty, packPrice, row.id),
  ]);
  return c.json({ data: await first(db, `${INGREDIENT_SELECT} WHERE i.id = ?`, row.id) });
});

app.get('/api/ingredients/:id/history', async (c) => {
  const row = await ownIngredient(c, c.req.param('id'));
  return c.json({
    data: await all(c.env.DB, `SELECT * FROM price_history WHERE ingredient_id = ? ORDER BY changed_at DESC LIMIT 20`, row.id),
  });
});

app.delete('/api/ingredients/:id', async (c) => {
  const row = await ownIngredient(c, c.req.param('id'));
  const used = await all(
    c.env.DB,
    `SELECT r.name FROM recipe_items ri JOIN recipes r ON r.id = ri.recipe_id WHERE ri.ingredient_id = ?`,
    row.id
  );
  if (used.length) fail(400, `Se usa en: ${used.map((u) => u.name).join(', ')}. Sacalo de esas recetas primero.`);
  await run(c.env.DB, `DELETE FROM ingredients WHERE id = ?`, row.id);
  return c.json({ ok: true });
});

// Subas de precio recientes (para avisar en Inicio)
app.get('/api/price-changes', async (c) =>
  c.json({
    data: await all(
      c.env.DB,
      `SELECT h.*, i.name, i.unit FROM price_history h JOIN ingredients i ON i.id = h.ingredient_id
       WHERE i.user_id = ? AND h.changed_at > datetime('now', '-30 days')
       ORDER BY h.changed_at DESC LIMIT 20`,
      c.get('uid')
    ),
  })
);

// ---------- recetas ----------
async function recipesWithItems(c, where = '', ...params) {
  const db = c.env.DB;
  const recipes = await all(db, `SELECT * FROM recipes WHERE user_id = ? ${where} ORDER BY name COLLATE NOCASE`, c.get('uid'), ...params);
  if (!recipes.length) return [];
  const items = await all(
    db,
    `SELECT ri.id, ri.recipe_id, ri.ingredient_id, ri.qty, i.name, i.unit, i.pack_qty, i.pack_price, i.is_packaging, i.stock_qty
     FROM recipe_items ri JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE i.user_id = ? ORDER BY i.is_packaging, i.name COLLATE NOCASE`,
    c.get('uid')
  );
  const byRecipe = new Map(recipes.map((r) => [r.id, { ...r, items: [] }]));
  for (const item of items) byRecipe.get(item.recipe_id)?.items.push(item);
  return [...byRecipe.values()];
}

async function ownRecipe(c, id) {
  const [row] = await recipesWithItems(c, 'AND id = ?', id);
  if (!row) fail(404, 'No encontré esa receta');
  return row;
}

app.get('/api/recipes', async (c) => c.json({ data: await recipesWithItems(c) }));
app.get('/api/recipes/:id', async (c) => c.json({ data: await ownRecipe(c, c.req.param('id')) }));

async function saveRecipe(c, id) {
  const db = c.env.DB;
  const b = await body(c);
  const name = text(b.name, 80);
  if (!name) fail(400, 'Poné el nombre de la receta');
  const yieldQty = num(b.yield_qty);
  if (!(yieldQty > 0)) fail(400, 'Poné cuántas unidades salen de una tanda (el rinde)');
  const fields = [
    name,
    text(b.emoji, 8) || '🧁',
    yieldQty,
    text(b.yield_unit, 20) || 'un',
    Math.max(0, num(b.sale_price)),
    Math.max(0, num(b.work_minutes)),
    Math.max(0, num(b.oven_minutes)),
    text(b.notes, 5000),
  ];

  // Solo ingredientes propios; si se repite uno, se suman las cantidades
  const mine = new Set((await all(db, `SELECT id FROM ingredients WHERE user_id = ?`, c.get('uid'))).map((r) => r.id));
  const merged = new Map();
  for (const item of Array.isArray(b.items) ? b.items : []) {
    const ing = Number(item.ingredient_id);
    const qty = num(item.qty);
    if (!mine.has(ing) || !(qty > 0)) continue;
    merged.set(ing, (merged.get(ing) || 0) + qty);
  }

  let recipeId = id;
  if (id) {
    await ownRecipe(c, id);
    await run(
      db,
      `UPDATE recipes SET name = ?, emoji = ?, yield_qty = ?, yield_unit = ?, sale_price = ?, work_minutes = ?, oven_minutes = ?, notes = ?,
       updated_at = datetime('now') WHERE id = ?`,
      ...fields,
      id
    );
  } else {
    const res = await run(
      db,
      `INSERT INTO recipes (name, emoji, yield_qty, yield_unit, sale_price, work_minutes, oven_minutes, notes, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ...fields,
      c.get('uid')
    );
    recipeId = res.meta.last_row_id;
  }
  await db.batch([
    db.prepare(`DELETE FROM recipe_items WHERE recipe_id = ?`).bind(recipeId),
    ...[...merged].map(([ing, qty]) =>
      db.prepare(`INSERT INTO recipe_items (recipe_id, ingredient_id, qty) VALUES (?, ?, ?)`).bind(recipeId, ing, qty)
    ),
  ]);
  return c.json({ data: await ownRecipe(c, recipeId) });
}

app.post('/api/recipes', (c) => saveRecipe(c, null));
app.put('/api/recipes/:id', (c) => saveRecipe(c, Number(c.req.param('id'))));

// Cambiar solo el precio de venta (botón "Usar este precio")
app.post('/api/recipes/:id/price', async (c) => {
  const { sale_price } = await body(c);
  const res = await run(
    c.env.DB,
    `UPDATE recipes SET sale_price = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
    Math.max(0, num(sale_price)),
    c.req.param('id'),
    c.get('uid')
  );
  if (!res.meta.changes) fail(404, 'No encontré esa receta');
  return c.json({ data: await ownRecipe(c, c.req.param('id')) });
});

app.post('/api/recipes/:id/duplicate', async (c) => {
  const db = c.env.DB;
  const r = await ownRecipe(c, c.req.param('id'));
  const res = await run(
    db,
    `INSERT INTO recipes (user_id, name, emoji, yield_qty, yield_unit, sale_price, work_minutes, oven_minutes, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    c.get('uid'), `${r.name} (copia)`, r.emoji, r.yield_qty, r.yield_unit, r.sale_price, r.work_minutes, r.oven_minutes, r.notes
  );
  const newId = res.meta.last_row_id;
  if (r.items.length) {
    await db.batch(
      r.items.map((i) => db.prepare(`INSERT INTO recipe_items (recipe_id, ingredient_id, qty) VALUES (?, ?, ?)`).bind(newId, i.ingredient_id, i.qty))
    );
  }
  return c.json({ data: await ownRecipe(c, newId) });
});

app.delete('/api/recipes/:id', async (c) => {
  await ownRecipe(c, c.req.param('id'));
  await run(c.env.DB, `DELETE FROM recipes WHERE id = ?`, c.req.param('id'));
  return c.json({ ok: true });
});

// ---------- producción ----------
app.get('/api/production', async (c) =>
  c.json({
    data: await all(c.env.DB, `SELECT * FROM production WHERE user_id = ? ORDER BY produced_at DESC, id DESC LIMIT 60`, c.get('uid')),
  })
);

// Registrar lo que se hizo: descuenta los ingredientes según las tandas
app.post('/api/production', async (c) => {
  const db = c.env.DB;
  const b = await body(c);
  const recipe = await ownRecipe(c, Number(b.recipe_id));
  const batches = num(b.batches);
  if (!(batches > 0)) fail(400, 'Poné cuántas tandas hiciste');
  if (!recipe.items.length) fail(400, 'Esta receta todavía no tiene ingredientes');
  const producedAt = isDate(b.produced_at) ? b.produced_at : today();
  const cost = recipe.items.reduce((sum, i) => sum + i.qty * batches * (i.pack_qty > 0 ? i.pack_price / i.pack_qty : 0), 0);

  const res = await run(
    db,
    `INSERT INTO production (user_id, recipe_id, recipe_name, batches, units, cost, produced_at, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    c.get('uid'), recipe.id, recipe.name, batches, batches * recipe.yield_qty, cost, producedAt, text(b.notes)
  );
  const pid = res.meta.last_row_id;
  await db.batch(
    recipe.items.flatMap((i) => [
      db.prepare(`INSERT INTO production_items (production_id, ingredient_id, qty) VALUES (?, ?, ?)`).bind(pid, i.ingredient_id, i.qty * batches),
      db.prepare(`UPDATE ingredients SET stock_qty = stock_qty - ? WHERE id = ?`).bind(i.qty * batches, i.ingredient_id),
    ])
  );
  // Si algún ingrediente quedó en negativo, se avisa (pero no se frena el trabajo)
  const negatives = await all(
    db,
    `SELECT i.name FROM production_items p JOIN ingredients i ON i.id = p.ingredient_id WHERE p.production_id = ? AND i.stock_qty < 0`,
    pid
  );
  return c.json({ data: { id: pid, negatives: negatives.map((n) => n.name) } });
});

// Borrar una producción cargada por error: devuelve los ingredientes al stock
app.delete('/api/production/:id', async (c) => {
  const db = c.env.DB;
  const row = await first(db, `SELECT * FROM production WHERE id = ? AND user_id = ?`, c.req.param('id'), c.get('uid'));
  if (!row) fail(404, 'No encontré esa producción');
  const items = await all(db, `SELECT * FROM production_items WHERE production_id = ?`, row.id);
  await db.batch([
    ...items.map((i) => db.prepare(`UPDATE ingredients SET stock_qty = stock_qty + ? WHERE id = ?`).bind(i.qty, i.ingredient_id)),
    db.prepare(`DELETE FROM production WHERE id = ?`).bind(row.id),
  ]);
  return c.json({ ok: true });
});

// ---------- panel de la dueña: cuentas de quienes compraron ----------
app.use('/api/admin/*', async (c, next) => {
  if (c.get('user').role !== 'admin') fail(403, 'Esta parte es solo para la administradora');
  await next();
});

const CLIENT_SELECT = `
  SELECT u.id, u.username, u.name, u.active, u.expires_at, u.phone, u.notes, u.created_at, u.last_login_at,
         (SELECT COUNT(*) FROM recipes r WHERE r.user_id = u.id) AS recipe_count
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
    `INSERT INTO users (username, password_hash, name, role, expires_at, phone, notes) VALUES (?, ?, ?, 'client', ?, ?, ?)`,
    username, await hashPassword(password), f.name, f.expires, f.phone, f.notes
  );
  const id = res.meta.last_row_id;
  await run(db, `INSERT INTO settings (user_id, business_name) VALUES (?, ?)`, id, text(b.business_name, 80));
  if (b.with_examples) await seedExamples(db, id);
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
