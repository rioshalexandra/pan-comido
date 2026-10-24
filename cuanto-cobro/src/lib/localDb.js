// Los datos de cada clienta (ingredientes, recetas, producción, ajustes) viven en SU celular.
// El servidor solo guarda el usuario y la contraseña. Para no perder nada al cambiar de celular
// están "Guardar copia" y "Recuperar copia" (Más → Copia de seguridad).
// Responde las mismas direcciones /api/... que antes respondía el servidor, así las pantallas no cambian.
import { DEMO, EXAMPLE_SETTINGS, INGREDIENTS, RECIPES } from './examples';
import { recipeCosts } from './costs';

const VERSION = 1;
const TABLES = ['suppliers', 'ingredients', 'price_history', 'recipes', 'recipe_items', 'production', 'production_items'];
// Compras a proveedores y sus pagos (llegaron después: las copias viejas no las traen)
const EXTRA_TABLES = ['purchases', 'purchase_items', 'payments', 'quotes'];
const QUOTE_STATUS = ['pendiente', 'aceptado', 'rechazado'];
const METHODS = ['efectivo', 'transferencia'];

class LocalError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new LocalError(status, message);
};

// ---------- utilidades (iguales a las del servidor) ----------
const num = (v, fallback = 0) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};
const text = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const today = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10); // hora argentina
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const byName = (a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });

// ---------- guardar en el celular ----------
let key = null;
let db = null;

function emptyDb(settings = {}) {
  const data = { version: VERSION, seq: 0, created_at: now(), last_backup_at: null, changed_at: null };
  for (const t of [...TABLES, ...EXTRA_TABLES]) data[t] = [];
  data.settings = {
    business_name: text(settings.business_name, 80),
    labor_hour_rate: 0,
    energy_monthly: 0,
    oven_hours_month: 0,
    target_margin: 60,
  };
  return data;
}

function save() {
  db.changed_at = now();
  try {
    localStorage.setItem(key, JSON.stringify(db));
  } catch {
    fail(500, 'No se pudo guardar en este celular (puede que no tenga lugar). Guardá una copia y liberá espacio.');
  }
}

const nextId = () => ++db.seq;

// La demo es para probar, no para trabajar: cada visita empieza de cero con los ejemplos
// (al cerrar la pestaña o la app, o a las 3 horas) y no deja guardar ni recuperar copias.
let demoMode = false;
const DEMO_VISIT = 'cc_demo_visita';
const DEMO_HOURS = 3;
const hoursSince = (stamp) => (Date.now() - new Date(`${stamp.replace(' ', 'T')}Z`).getTime()) / 3600000;

// Al tocar "Salir" termina la visita: si vuelve a entrar, la demo arranca de cero
export function endDemoVisit() {
  try {
    sessionStorage.removeItem(DEMO_VISIT);
  } catch {
    /* nada que borrar */
  }
}

function demoVisitIsNew(stored) {
  let started = null;
  try {
    started = sessionStorage.getItem(DEMO_VISIT);
    sessionStorage.setItem(DEMO_VISIT, '1');
  } catch {
    /* sin sessionStorage: se toma como visita nueva */
  }
  return !started || !stored?.created_at || hoursSince(stored.created_at) > DEMO_HOURS;
}

// Abre los datos de esta usuaria en este celular (los crea la primera vez)
export function openLocal(me) {
  key = `cc_datos_${me.user.username}`;
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    stored = null;
  }
  demoMode = me.examples === 'demo';
  if (demoMode && demoVisitIsNew(stored)) stored = null;
  if (stored && stored.version === VERSION) {
    db = stored;
    for (const t of EXTRA_TABLES) db[t] ||= [];
    if (me.examples === 'demo' && !db.demo_quotes) {
      seedDemoQuotes();
      save();
    }
  } else {
    db = emptyDb(me.settings || {});
    if (me.examples) seedExamples();
    if (me.examples === 'demo') seedDemo();
    save();
  }
  // Pide al navegador que no borre estos datos para liberar espacio
  navigator.storage?.persist?.().catch(() => {});
  return { ...db.settings, user_id: me.user.id };
}

function seedExamples() {
  const ids = new Map();
  for (const [name, unit, packQty, packPrice, isPack, stock, min] of INGREDIENTS) {
    const id = nextId();
    db.ingredients.push(newIngredient(id, { name, unit, packQty, packPrice, isPackaging: isPack, stock, min }, null));
    ids.set(name, id);
  }
  for (const [name, emoji, yieldQty, price, work, oven, notes, items] of RECIPES) {
    const id = nextId();
    db.recipes.push({ id, name, emoji, yield_qty: yieldQty, yield_unit: 'un', sale_price: price, work_minutes: work, oven_minutes: oven, notes, created_at: now(), updated_at: now() });
    for (const [ing, qty] of items) db.recipe_items.push({ id: nextId(), recipe_id: id, ingredient_id: ids.get(ing), qty });
  }
  Object.assign(db.settings, EXAMPLE_SETTINGS);
}

// Cuenta de demostración: más recetas, compras con pagos, producción y subas de precio,
// con fechas de las últimas semanas para que todo se vea "vivo"
function seedDemo() {
  const ago = (days) => new Date(Date.now() - 3 * 3600 * 1000 - days * 86400000).toISOString().slice(0, 10);
  const stamp = (days) => `${ago(days)} 12:00:00`;
  const ids = new Map(db.ingredients.map((i) => [i.name, i]));
  for (const [name, unit, packQty, packPrice, isPack, stock, min] of DEMO.ingredients) {
    const row = newIngredient(nextId(), { name, unit, packQty, packPrice, isPackaging: isPack, stock, min }, null);
    db.ingredients.push(row);
    ids.set(name, row);
  }
  for (const [name, emoji, yieldQty, price, work, oven, notes, items] of DEMO.recipes) {
    const id = nextId();
    db.recipes.push({ id, name, emoji, yield_qty: yieldQty, yield_unit: 'un', sale_price: price, work_minutes: work, oven_minutes: oven, notes, created_at: now(), updated_at: now() });
    for (const [ing, qty] of items) db.recipe_items.push({ id: nextId(), recipe_id: id, ingredient_id: ids.get(ing).id, qty });
  }
  // Subas de precio: el precio de hoy ya es el nuevo
  for (const [name, pct, days] of DEMO.rises) {
    const ing = ids.get(name);
    const cost = ing.pack_price / ing.pack_qty;
    db.price_history.push({ id: nextId(), ingredient_id: ing.id, old_unit_cost: cost / (1 + pct / 100), new_unit_cost: cost, changed_at: stamp(days) });
    ing.price_updated_at = stamp(days);
  }
  const suppliers = new Map();
  for (const [name, notes, products] of DEMO.suppliers) {
    const id = nextId();
    db.suppliers.push({ id, name, phone: '', notes });
    suppliers.set(name, id);
    for (const p of products) ids.get(p).supplier_id = id;
  }
  for (const [supplier, days, lines, pays] of DEMO.purchases) {
    const pid = nextId();
    let total = 0;
    for (const [name, packs] of lines) {
      const ing = ids.get(name);
      const subtotal = packs * ing.pack_price;
      total += subtotal;
      db.purchase_items.push({ id: nextId(), purchase_id: pid, ingredient_id: ing.id, name: ing.name, unit: ing.unit, packs, pack_qty: ing.pack_qty, pack_price: ing.pack_price, qty: packs * ing.pack_qty, subtotal });
    }
    db.purchases.push({ id: pid, supplier_id: suppliers.get(supplier), purchased_at: ago(days), total, notes: '', created_at: stamp(days) });
    for (const [share, method, payDays] of pays) {
      db.payments.push({ id: nextId(), purchase_id: pid, supplier_id: suppliers.get(supplier), amount: Math.round(total * share), method, paid_at: ago(payDays), notes: '' });
    }
  }
  for (const [recipeName, batches, days] of DEMO.production) {
    const r = recipeWithItems(db.recipes.find((x) => x.name === recipeName));
    const pid = nextId();
    const cost = r.items.reduce((sum, i) => sum + i.qty * batches * (i.pack_qty > 0 ? i.pack_price / i.pack_qty : 0), 0);
    db.production.push({ id: pid, recipe_id: r.id, recipe_name: r.name, batches, units: batches * r.yield_qty, cost, produced_at: ago(days), notes: '' });
    for (const i of r.items) db.production_items.push({ production_id: pid, ingredient_id: i.ingredient_id, qty: i.qty * batches });
  }
  Object.assign(db.settings, DEMO.settings);
  // Casi todas con buen precio; solo las de DEMO.underpriced quedan "para revisar"
  for (const r of db.recipes) {
    if (!DEMO.underpriced.includes(r.name)) r.sale_price = recipeCosts(recipeWithItems(r), db.settings).suggested;
  }
  seedDemoQuotes();
  db.last_backup_at = now();
}

// Presupuestos de ejemplo (también para quien abrió la demo antes de que existieran)
function seedDemoQuotes() {
  const ago = (days) => new Date(Date.now() - 3 * 3600 * 1000 - days * 86400000).toISOString().slice(0, 10);
  db.demo_quotes = true;
  for (const [customer, days, due, lines, extras, delivery, status] of DEMO.quotes) {
    if (!lines.every(([name]) => db.recipes.some((x) => x.name === name))) continue;
    const items = lines.map(([name, qty]) => {
      const r = recipeWithItems(db.recipes.find((x) => x.name === name));
      return { recipe_id: r.id, name: r.name, emoji: r.emoji, qty, unit_price: r.sale_price, unit_cost: recipeCosts(r, db.settings).fullUnit };
    });
    const q = quoteFields({ customer, due_date: ago(-due), items, extras: extras.map(([label, amount]) => ({ label, amount })), delivery, deposit_pct: 50 });
    db.quotes.push({ id: nextId(), ...q, status, created_at: `${ago(days)} 12:00:00` });
  }
}

// ---------- copia de seguridad ----------
export function backupInfo() {
  const hasData = db && (db.recipes.length > 0 || db.ingredients.length > 0);
  return { lastBackup: db?.last_backup_at || null, changedAt: db?.changed_at || null, hasData };
}

export function backupFile() {
  if (demoMode) fail(400, 'En la demo no se pueden guardar copias.');
  db.last_backup_at = now();
  save();
  const content = JSON.stringify({ app: 'cuanto-cobro', ...db }, null, 1);
  return new File([content], `cuanto-cobro-copia-${today()}.json`, { type: 'application/json' });
}

export async function restoreFile(file) {
  if (demoMode) fail(400, 'En la demo no se pueden recuperar copias.');
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    fail(400, 'Ese archivo no es una copia de Cuánto Cobro');
  }
  if (data?.app !== 'cuanto-cobro' || !TABLES.every((t) => Array.isArray(data[t])) || !data.settings) {
    fail(400, 'Ese archivo no es una copia de Cuánto Cobro');
  }
  if (data.version > VERSION) fail(400, 'Esta copia es de una versión más nueva de la app. Recargá la página y probá de nuevo.');
  delete data.app;
  db = { ...emptyDb(), ...data, version: VERSION, last_backup_at: now() };
  for (const t of EXTRA_TABLES) if (!Array.isArray(db[t])) db[t] = [];
  save();
  return { ...db.settings };
}

// ---------- ingredientes y recetas ----------
function newIngredient(id, f, supplier) {
  return {
    id,
    name: f.name,
    unit: f.unit,
    pack_qty: f.packQty,
    pack_price: f.packPrice,
    is_packaging: f.isPackaging,
    stock_qty: f.stock,
    min_stock: f.min,
    supplier_id: supplier,
    price_updated_at: now(),
  };
}

function ingredientRow(i) {
  const s = db.suppliers.find((x) => x.id === i.supplier_id);
  return {
    ...i,
    supplier_name: s?.name ?? null,
    supplier_phone: s?.phone ?? null,
    recipe_count: db.recipe_items.filter((r) => r.ingredient_id === i.id).length,
  };
}

function ownIngredient(id) {
  const row = db.ingredients.find((i) => i.id === Number(id));
  if (!row) fail(404, 'No encontré ese ingrediente');
  return row;
}

const validSupplier = (id) => (id && db.suppliers.some((s) => s.id === Number(id)) ? Number(id) : null);

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

// Guarda en el historial si cambió el costo por gramo/ml/unidad
function priceChange(row, packQty, packPrice) {
  const oldCost = row.pack_qty > 0 ? row.pack_price / row.pack_qty : 0;
  const newCost = packQty > 0 ? packPrice / packQty : 0;
  if (Math.abs(oldCost - newCost) < 1e-9) return;
  db.price_history.push({ id: nextId(), ingredient_id: row.id, old_unit_cost: oldCost, new_unit_cost: newCost, changed_at: now() });
  row.price_updated_at = now();
}

function recipeWithItems(r) {
  const items = db.recipe_items
    .filter((ri) => ri.recipe_id === r.id)
    .map((ri) => {
      const i = db.ingredients.find((x) => x.id === ri.ingredient_id);
      return i && { id: ri.id, recipe_id: r.id, ingredient_id: i.id, qty: ri.qty, name: i.name, unit: i.unit, pack_qty: i.pack_qty, pack_price: i.pack_price, is_packaging: i.is_packaging, stock_qty: i.stock_qty };
    })
    .filter(Boolean)
    .sort((a, b) => a.is_packaging - b.is_packaging || byName(a, b));
  return { ...r, items };
}

function ownRecipe(id) {
  const r = db.recipes.find((x) => x.id === Number(id));
  if (!r) fail(404, 'No encontré esa receta');
  return r;
}

function saveRecipe(b, id) {
  const name = text(b.name, 80);
  if (!name) fail(400, 'Poné el nombre de la receta');
  const yieldQty = num(b.yield_qty);
  if (!(yieldQty > 0)) fail(400, 'Poné cuántas unidades salen de una tanda (el rinde)');
  const fields = {
    name,
    emoji: text(b.emoji, 8) || '🧁',
    yield_qty: yieldQty,
    yield_unit: text(b.yield_unit, 20) || 'un',
    sale_price: Math.max(0, num(b.sale_price)),
    work_minutes: Math.max(0, num(b.work_minutes)),
    oven_minutes: Math.max(0, num(b.oven_minutes)),
    notes: text(b.notes, 5000),
    updated_at: now(),
  };
  // Solo ingredientes que existen; si se repite uno, se suman las cantidades
  const merged = new Map();
  for (const item of Array.isArray(b.items) ? b.items : []) {
    const ing = Number(item.ingredient_id);
    const qty = num(item.qty);
    if (!db.ingredients.some((i) => i.id === ing) || !(qty > 0)) continue;
    merged.set(ing, (merged.get(ing) || 0) + qty);
  }
  let recipe;
  if (id) {
    recipe = Object.assign(ownRecipe(id), fields);
  } else {
    recipe = { id: nextId(), ...fields, created_at: now() };
    db.recipes.push(recipe);
  }
  db.recipe_items = db.recipe_items.filter((ri) => ri.recipe_id !== recipe.id);
  for (const [ing, qty] of merged) db.recipe_items.push({ id: nextId(), recipe_id: recipe.id, ingredient_id: ing, qty });
  save();
  return { data: recipeWithItems(recipe) };
}

// ---------- compras a proveedores y pagos ----------
function purchaseRow(p) {
  const payments = db.payments.filter((x) => x.purchase_id === p.id).sort((a, b) => a.paid_at.localeCompare(b.paid_at));
  const paid = payments.reduce((sum, x) => sum + x.amount, 0);
  const items = db.purchase_items
    .filter((x) => x.purchase_id === p.id)
    .map((x) => {
      const i = db.ingredients.find((ing) => ing.id === x.ingredient_id);
      return { ...x, name: i?.name || x.name, unit: i?.unit || x.unit };
    });
  const supplier = db.suppliers.find((s) => s.id === p.supplier_id);
  return { ...p, supplier_name: supplier?.name || p.supplier_name || 'Sin proveedor', items, payments, paid, balance: Math.max(0, p.total - paid) };
}

const ownPurchase = (id) => db.purchases.find((p) => p.id === Number(id)) || fail(404, 'No encontré esa compra');

function addPayment(purchase, b) {
  const amount = Math.round(num(b.amount) * 100) / 100;
  if (!(amount > 0)) fail(400, 'Poné cuánto pagaste');
  const balance = purchaseRow(purchase).balance;
  if (amount > balance + 0.5) fail(400, `Esta compra debe ${Math.round(balance)}. No se puede pagar más que eso.`);
  if (!METHODS.includes(b.method)) fail(400, 'Elegí si pagaste en efectivo o por transferencia');
  db.payments.push({
    id: nextId(), purchase_id: purchase.id, supplier_id: purchase.supplier_id, amount, method: b.method,
    paid_at: isDate(b.paid_at) ? b.paid_at : today(), notes: text(b.notes, 200),
  });
}

// ---------- presupuestos para encargos ----------
function quoteFields(b) {
  const items = (Array.isArray(b.items) ? b.items : [])
    .map((x) => {
      const r = db.recipes.find((y) => y.id === Number(x.recipe_id));
      return {
        recipe_id: r ? r.id : null,
        name: text(x.name || r?.name, 80),
        emoji: text(x.emoji || r?.emoji, 8) || '🧁',
        qty: num(x.qty),
        unit_price: Math.max(0, num(x.unit_price)),
        unit_cost: Math.max(0, num(x.unit_cost)),
      };
    })
    .filter((x) => x.name && x.qty > 0);
  const extras = (Array.isArray(b.extras) ? b.extras : [])
    .map((x) => ({ label: text(x.label, 80), amount: Math.max(0, num(x.amount)), cost: Math.max(0, num(x.cost)) }))
    .filter((x) => x.label && x.amount > 0);
  if (!items.length && !extras.length) fail(400, 'Agregá al menos un producto al presupuesto');
  const delivery = Math.max(0, num(b.delivery));
  const discount = Math.min(100, Math.max(0, num(b.discount_pct)));
  const subtotal = items.reduce((s, x) => s + x.qty * x.unit_price, 0) + extras.reduce((s, x) => s + x.amount, 0);
  const total = Math.round(subtotal * (1 - discount / 100) + delivery);
  const cost = items.reduce((s, x) => s + x.qty * x.unit_cost, 0) + extras.reduce((s, x) => s + x.cost, 0);
  return {
    customer: text(b.customer, 80),
    phone: text(b.phone, 40),
    due_date: isDate(b.due_date) ? b.due_date : null,
    items,
    extras,
    delivery,
    discount_pct: discount,
    deposit_pct: Math.min(100, Math.max(0, num(b.deposit_pct, 50))),
    valid_days: Math.max(0, Math.round(num(b.valid_days, 7))),
    notes: text(b.notes, 1000),
    total,
    cost: Math.round(cost),
  };
}

const ownQuote = (id) => db.quotes.find((q) => q.id === Number(id)) || fail(404, 'No encontré ese presupuesto');

// ---------- las direcciones ----------
const routes = [
  ['PUT', /^\/api\/settings$/, (b) => {
    Object.assign(db.settings, {
      business_name: text(b.business_name, 80),
      labor_hour_rate: Math.max(0, num(b.labor_hour_rate)),
      energy_monthly: Math.max(0, num(b.energy_monthly)),
      oven_hours_month: Math.max(0, num(b.oven_hours_month)),
      target_margin: Math.min(95, Math.max(0, num(b.target_margin, 60))),
    });
    save();
    return { settings: { ...db.settings } };
  }],

  // proveedores
  ['GET', /^\/api\/suppliers$/, () => ({ data: [...db.suppliers].sort(byName) })],
  ['POST', /^\/api\/suppliers$/, (b) => {
    if (!text(b.name)) fail(400, 'Poné el nombre del proveedor');
    const row = { id: nextId(), name: text(b.name, 80), phone: text(b.phone, 40), notes: text(b.notes) };
    db.suppliers.push(row);
    save();
    return { data: row };
  }],
  ['PUT', /^\/api\/suppliers\/(\d+)$/, (b, id) => {
    if (!text(b.name)) fail(400, 'Poné el nombre del proveedor');
    const row = db.suppliers.find((s) => s.id === Number(id)) || fail(404, 'No encontré ese proveedor');
    Object.assign(row, { name: text(b.name, 80), phone: text(b.phone, 40), notes: text(b.notes) });
    save();
    return { ok: true };
  }],
  ['DELETE', /^\/api\/suppliers\/(\d+)$/, (b, id) => {
    if (db.purchases.some((p) => p.supplier_id === Number(id) && purchaseRow(p).balance > 0.5)) {
      fail(400, 'Le debés plata a este proveedor. Cargá el pago antes de borrarlo.');
    }
    db.suppliers = db.suppliers.filter((s) => s.id !== Number(id));
    for (const i of db.ingredients) if (i.supplier_id === Number(id)) i.supplier_id = null;
    save();
    return { ok: true };
  }],

  // ingredientes
  ['GET', /^\/api\/ingredients$/, () => ({ data: db.ingredients.map(ingredientRow).sort(byName) })],
  ['POST', /^\/api\/ingredients$/, (b) => {
    const row = newIngredient(nextId(), ingredientFields(b), validSupplier(b.supplier_id));
    db.ingredients.push(row);
    save();
    return { data: ingredientRow(row) };
  }],
  ['PUT', /^\/api\/ingredients\/(\d+)$/, (b, id) => {
    const row = ownIngredient(id);
    const f = ingredientFields(b);
    if (f.unit !== row.unit && db.recipe_items.some((ri) => ri.ingredient_id === row.id)) {
      fail(400, 'No se puede cambiar la unidad porque ya se usa en recetas');
    }
    priceChange(row, f.packQty, f.packPrice);
    Object.assign(row, {
      name: f.name, unit: f.unit, pack_qty: f.packQty, pack_price: f.packPrice, is_packaging: f.isPackaging,
      stock_qty: f.stock, min_stock: f.min, supplier_id: validSupplier(b.supplier_id),
    });
    save();
    return { data: ingredientRow(row) };
  }],
  // Cargar una compra: suma stock y, si cambió, actualiza el precio del paquete
  ['POST', /^\/api\/ingredients\/(\d+)\/purchase$/, (b, id) => {
    const row = ownIngredient(id);
    const packs = num(b.packs);
    if (!(packs > 0)) fail(400, 'Poné cuántos paquetes compraste');
    const packPrice = b.pack_price === '' || b.pack_price == null ? row.pack_price : Math.max(0, num(b.pack_price));
    priceChange(row, row.pack_qty, packPrice);
    row.stock_qty += packs * row.pack_qty;
    row.pack_price = packPrice;
    save();
    return { data: ingredientRow(row) };
  }],
  ['GET', /^\/api\/ingredients\/(\d+)\/history$/, (b, id) => {
    const row = ownIngredient(id);
    const data = db.price_history.filter((h) => h.ingredient_id === row.id).sort((x, y) => y.changed_at.localeCompare(x.changed_at)).slice(0, 20);
    return { data };
  }],
  ['DELETE', /^\/api\/ingredients\/(\d+)$/, (b, id) => {
    const row = ownIngredient(id);
    const used = db.recipe_items.filter((ri) => ri.ingredient_id === row.id).map((ri) => db.recipes.find((r) => r.id === ri.recipe_id)?.name);
    if (used.length) fail(400, `Se usa en: ${used.join(', ')}. Sacalo de esas recetas primero.`);
    db.ingredients = db.ingredients.filter((i) => i.id !== row.id);
    db.price_history = db.price_history.filter((h) => h.ingredient_id !== row.id);
    db.production_items = db.production_items.filter((p) => p.ingredient_id !== row.id);
    // Las compras viejas quedan en el historial con el nombre guardado
    save();
    return { ok: true };
  }],
  // Subas de precio de los últimos 30 días (para avisar en Inicio)
  ['GET', /^\/api\/price-changes$/, () => {
    const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const data = db.price_history
      .filter((h) => h.changed_at > since)
      .map((h) => {
        const i = db.ingredients.find((x) => x.id === h.ingredient_id);
        return i && { ...h, name: i.name, unit: i.unit };
      })
      .filter(Boolean)
      .sort((x, y) => y.changed_at.localeCompare(x.changed_at))
      .slice(0, 20);
    return { data };
  }],

  // recetas
  ['GET', /^\/api\/recipes$/, () => ({ data: db.recipes.map(recipeWithItems).sort(byName) })],
  ['GET', /^\/api\/recipes\/(\d+)$/, (b, id) => ({ data: recipeWithItems(ownRecipe(id)) })],
  ['POST', /^\/api\/recipes$/, (b) => saveRecipe(b, null)],
  ['PUT', /^\/api\/recipes\/(\d+)$/, (b, id) => saveRecipe(b, id)],
  // Cambiar solo el precio de venta (botón "Usar este precio")
  ['POST', /^\/api\/recipes\/(\d+)\/price$/, (b, id) => {
    const r = ownRecipe(id);
    r.sale_price = Math.max(0, num(b.sale_price));
    r.updated_at = now();
    save();
    return { data: recipeWithItems(r) };
  }],
  ['POST', /^\/api\/recipes\/(\d+)\/duplicate$/, (b, id) => {
    const r = ownRecipe(id);
    const copy = { ...r, id: nextId(), name: `${r.name} (copia)`, created_at: now(), updated_at: now() };
    db.recipes.push(copy);
    for (const ri of db.recipe_items.filter((x) => x.recipe_id === r.id)) db.recipe_items.push({ ...ri, id: nextId(), recipe_id: copy.id });
    save();
    return { data: recipeWithItems(copy) };
  }],
  ['DELETE', /^\/api\/recipes\/(\d+)$/, (b, id) => {
    const r = ownRecipe(id);
    db.recipes = db.recipes.filter((x) => x.id !== r.id);
    db.recipe_items = db.recipe_items.filter((x) => x.recipe_id !== r.id);
    for (const p of db.production) if (p.recipe_id === r.id) p.recipe_id = null;
    save();
    return { ok: true };
  }],

  // compras: suman al stock y actualizan el precio de cada ingrediente
  ['GET', /^\/api\/purchases$/, () => ({
    data: db.purchases.map(purchaseRow).sort((x, y) => y.purchased_at.localeCompare(x.purchased_at) || y.id - x.id),
  })],
  ['POST', /^\/api\/purchases$/, (b) => {
    const supplier = validSupplier(b.supplier_id);
    const lines = (Array.isArray(b.items) ? b.items : [])
      .map((x) => ({ ing: db.ingredients.find((i) => i.id === Number(x.ingredient_id)), packs: num(x.packs), packQty: num(x.pack_qty), packPrice: Math.max(0, num(x.pack_price)) }))
      .filter((x) => x.ing && x.packs > 0);
    if (!lines.length) fail(400, 'Agregá al menos un producto con su cantidad');
    if (lines.some((x) => !(x.packQty > 0))) fail(400, 'Poné cuánto trae cada paquete');
    const pid = nextId();
    let total = 0;
    for (const { ing, packs, packQty, packPrice } of lines) {
      priceChange(ing, packQty, packPrice);
      ing.pack_qty = packQty;
      ing.pack_price = packPrice;
      ing.stock_qty += packs * packQty;
      if (supplier && !ing.supplier_id) ing.supplier_id = supplier;
      total += packs * packPrice;
      db.purchase_items.push({ id: nextId(), purchase_id: pid, ingredient_id: ing.id, name: ing.name, unit: ing.unit, packs, pack_qty: packQty, pack_price: packPrice, qty: packs * packQty, subtotal: packs * packPrice });
    }
    const purchase = {
      id: pid, supplier_id: supplier, purchased_at: isDate(b.purchased_at) ? b.purchased_at : today(), total: Math.round(total * 100) / 100,
      notes: text(b.notes, 300), created_at: now(),
    };
    db.purchases.push(purchase);
    if (b.pay_method) addPayment(purchase, { amount: purchase.total, method: b.pay_method, paid_at: purchase.purchased_at });
    save();
    return { data: purchaseRow(purchase) };
  }],
  // Borrar una compra cargada por error: saca del stock lo que había sumado (el precio queda como está)
  ['DELETE', /^\/api\/purchases\/(\d+)$/, (b, id) => {
    const p = ownPurchase(id);
    for (const item of db.purchase_items.filter((x) => x.purchase_id === p.id)) {
      const ing = db.ingredients.find((i) => i.id === item.ingredient_id);
      if (ing) ing.stock_qty -= item.qty;
    }
    db.purchases = db.purchases.filter((x) => x.id !== p.id);
    db.purchase_items = db.purchase_items.filter((x) => x.purchase_id !== p.id);
    db.payments = db.payments.filter((x) => x.purchase_id !== p.id);
    save();
    return { ok: true };
  }],
  ['POST', /^\/api\/purchases\/(\d+)\/payments$/, (b, id) => {
    const p = ownPurchase(id);
    addPayment(p, b);
    save();
    return { data: purchaseRow(p) };
  }],
  ['DELETE', /^\/api\/payments\/(\d+)$/, (b, id) => {
    db.payments = db.payments.filter((x) => x.id !== Number(id));
    save();
    return { ok: true };
  }],

  // presupuestos
  ['GET', /^\/api\/quotes$/, () => ({ data: [...db.quotes].sort((x, y) => y.created_at.localeCompare(x.created_at) || y.id - x.id) })],
  ['GET', /^\/api\/quotes\/(\d+)$/, (b, id) => ({ data: ownQuote(id) })],
  ['POST', /^\/api\/quotes$/, (b) => {
    const q = { id: nextId(), ...quoteFields(b), status: 'pendiente', created_at: now() };
    db.quotes.push(q);
    save();
    return { data: q };
  }],
  ['PUT', /^\/api\/quotes\/(\d+)$/, (b, id) => {
    const q = Object.assign(ownQuote(id), quoteFields(b), { updated_at: now() });
    save();
    return { data: q };
  }],
  ['POST', /^\/api\/quotes\/(\d+)\/status$/, (b, id) => {
    const q = ownQuote(id);
    if (!QUOTE_STATUS.includes(b.status)) fail(400, 'Estado no válido');
    q.status = b.status;
    save();
    return { data: q };
  }],
  ['DELETE', /^\/api\/quotes\/(\d+)$/, (b, id) => {
    db.quotes = db.quotes.filter((q) => q.id !== Number(id));
    save();
    return { ok: true };
  }],

  // lista de precios para compartir: qué recetas van, la nota de abajo y el estilo
  ['GET', /^\/api\/price-list$/, () => ({ data: { recipe_ids: null, title: '', note: '', style: 'dorado', ...(db.price_list || {}) } })],
  ['PUT', /^\/api\/price-list$/, (b) => {
    db.price_list = {
      recipe_ids: Array.isArray(b.recipe_ids) ? b.recipe_ids.map(Number).filter((id) => db.recipes.some((r) => r.id === id)) : null,
      title: text(b.title, 60),
      note: text(b.note, 160),
      style: ['dorado', 'rosa', 'pizarra'].includes(b.style) ? b.style : 'dorado',
    };
    save();
    return { data: db.price_list };
  }],

  // producción
  ['GET', /^\/api\/production$/, () => ({
    data: [...db.production].sort((x, y) => y.produced_at.localeCompare(x.produced_at) || y.id - x.id).slice(0, 60),
  })],
  // Registrar lo que se hizo: descuenta los ingredientes según las tandas
  ['POST', /^\/api\/production$/, (b) => {
    const recipe = recipeWithItems(ownRecipe(b.recipe_id));
    const batches = num(b.batches);
    if (!(batches > 0)) fail(400, 'Poné cuántas tandas hiciste');
    if (!recipe.items.length) fail(400, 'Esta receta todavía no tiene ingredientes');
    const cost = recipe.items.reduce((sum, i) => sum + i.qty * batches * (i.pack_qty > 0 ? i.pack_price / i.pack_qty : 0), 0);
    const pid = nextId();
    db.production.push({
      id: pid, recipe_id: recipe.id, recipe_name: recipe.name, batches, units: batches * recipe.yield_qty, cost,
      produced_at: isDate(b.produced_at) ? b.produced_at : today(), notes: text(b.notes),
    });
    const negatives = [];
    for (const i of recipe.items) {
      db.production_items.push({ production_id: pid, ingredient_id: i.ingredient_id, qty: i.qty * batches });
      const ing = db.ingredients.find((x) => x.id === i.ingredient_id);
      ing.stock_qty -= i.qty * batches;
      // Si algún ingrediente quedó en negativo, se avisa (pero no se frena el trabajo)
      if (ing.stock_qty < 0) negatives.push(ing.name);
    }
    save();
    return { data: { id: pid, negatives } };
  }],
  // Borrar una producción cargada por error: devuelve los ingredientes al stock
  ['DELETE', /^\/api\/production\/(\d+)$/, (b, id) => {
    const row = db.production.find((p) => p.id === Number(id)) || fail(404, 'No encontré esa producción');
    for (const item of db.production_items.filter((p) => p.production_id === row.id)) {
      const ing = db.ingredients.find((x) => x.id === item.ingredient_id);
      if (ing) ing.stock_qty += item.qty;
    }
    db.production = db.production.filter((p) => p.id !== row.id);
    db.production_items = db.production_items.filter((p) => p.production_id !== row.id);
    save();
    return { ok: true };
  }],
];

// Devuelve la respuesta si la dirección se atiende en el celular, o null si va al servidor
export function localRequest(method, url, data) {
  for (const [m, pattern, handler] of routes) {
    const match = method === m && url.match(pattern);
    if (!match) continue;
    if (!db) fail(401, 'Tenés que entrar con tu usuario');
    return handler(data || {}, match[1]);
  }
  return null;
}
