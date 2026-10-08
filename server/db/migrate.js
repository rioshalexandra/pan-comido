// Prepara la base de datos al arrancar: aplica el esquema, crea el usuario inicial
// y, si la base está vacía y SEED_DEMO=true, carga datos de ejemplo de pastelería.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { getPool, query } from './pool.js';
import { refreshRecipeCost } from '../lib/recipes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const pool = getPool();
  for (const statement of statements) {
    await pool.query(statement);
  }
}

async function ensureAdmin() {
  const existing = await query('SELECT id FROM users WHERE username = $1', [config.defaultAdminUser]);
  if (existing.rowCount) {
    console.log(`OK: usuario listo (${config.defaultAdminUser})`);
    return;
  }
  const hash = await bcrypt.hash(config.defaultAdminPassword, 10);
  await query(`INSERT INTO users (username, password_hash, name, role) VALUES ($1, $2, $3, 'admin')`, [
    config.defaultAdminUser,
    hash,
    'Administración',
  ]);
  console.log(`OK: usuario creado (${config.defaultAdminUser})`);
}

async function ensureSettings() {
  await query('UPDATE store_settings SET timezone = $1 WHERE id = 1', [config.storeTimezone]);
  const current = await query('SELECT name FROM store_settings WHERE id = 1');
  if (current.rows[0]?.name === 'Pan Comido' && config.storeName) {
    await query('UPDATE store_settings SET name = $1 WHERE id = 1', [config.storeName]);
  }
}

// ---------- Datos de ejemplo ----------

// Ingredientes: [nombre, unidad, costo por unidad, stock, stock crítico, categoría]
const INGREDIENTS = [
  ['Harina 0000', 'kg', 900, 10, 5, 'Secos'],
  ['Azúcar', 'kg', 1300, 6, 3, 'Secos'],
  ['Azúcar impalpable', 'kg', 2200, 2, 1, 'Secos'],
  ['Fécula de maíz (maicena)', 'kg', 2800, 3, 2, 'Secos'],
  ['Polvo de hornear', 'kg', 6000, 0.5, 0.2, 'Secos'],
  ['Coco rallado', 'kg', 9000, 0.4, 0.5, 'Secos'],
  ['Nueces', 'kg', 18000, 0.5, 0.5, 'Secos'],
  ['Chips de chocolate', 'kg', 14000, 0.8, 1, 'Secos'],
  ['Manteca', 'kg', 9000, 3, 2, 'Lácteos y huevos'],
  ['Huevos', 'un', 250, 60, 30, 'Lácteos y huevos'],
  ['Queso crema', 'kg', 11000, 1, 1, 'Lácteos y huevos'],
  ['Dulce de leche repostero', 'kg', 5500, 4, 2, 'Rellenos'],
  ['Dulce de membrillo', 'kg', 4000, 2, 1, 'Rellenos'],
  ['Aceite', 'l', 3000, 2, 1, 'Varios'],
  ['Esencia de vainilla', 'l', 8000, 0.5, 0.2, 'Varios'],
  ['Limones', 'un', 300, 10, 5, 'Varios'],
  ['Zanahorias', 'kg', 1200, 2, 1, 'Varios'],
];

// Productos: [nombre, unidad, precio, stock, stock crítico, categoría, rinde, receta {ingrediente: cantidad}]
const PRODUCTS = [
  ['Cookies de chocolate', 'un', 1500, 18, 12, 'Cookies', 24, {
    'Harina 0000': 0.35, Manteca: 0.2, Azúcar: 0.2, Huevos: 2, 'Chips de chocolate': 0.2, 'Esencia de vainilla': 0.01,
  }],
  ['Alfajores de maicena', 'un', 1200, 8, 12, 'Alfajores', 20, {
    'Fécula de maíz (maicena)': 0.3, 'Harina 0000': 0.2, Manteca: 0.2, 'Azúcar impalpable': 0.15, Huevos: 3,
    'Dulce de leche repostero': 0.5, 'Coco rallado': 0.05, 'Polvo de hornear': 0.01,
  }],
  ['Budín de limón', 'un', 9000, 3, 2, 'Budines y tortas', 1, {
    'Harina 0000': 0.25, Azúcar: 0.2, Huevos: 3, Aceite: 0.1, Limones: 2, 'Polvo de hornear': 0.01,
  }],
  ['Pepas de membrillo (docena)', 'docena', 4000, 2, 2, 'Masas secas', 4, {
    'Harina 0000': 0.5, Manteca: 0.25, Azúcar: 0.2, Huevos: 2, 'Dulce de membrillo': 0.3,
  }],
  ['Mini tarta coco y dulce de leche', 'un', 3500, 4, 3, 'Budines y tortas', 8, {
    'Harina 0000': 0.3, Manteca: 0.15, Azúcar: 0.1, Huevos: 2, 'Dulce de leche repostero': 0.4, 'Coco rallado': 0.15,
  }],
  ['Carrot cake', 'un', 22000, 1, 1, 'Budines y tortas', 1, {
    'Harina 0000': 0.3, Azúcar: 0.25, Huevos: 4, Aceite: 0.2, Zanahorias: 0.4, Nueces: 0.1, 'Queso crema': 0.3,
    'Azúcar impalpable': 0.1, 'Polvo de hornear': 0.01,
  }],
  ['Caja matera', 'un', 12000, 0, 0, 'Cajas y combos', null, null],
];

async function seedDemo() {
  if (!config.seedDemo) return;
  const count = await query('SELECT COUNT(*)::int AS n FROM products');
  if (count.rows[0].n > 0) {
    console.log('OK: datos de ejemplo ya existen');
    return;
  }

  const categoryIds = {};
  async function category(name) {
    if (!categoryIds[name]) {
      const result = await query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [name]);
      categoryIds[name] = result.rows[0].id;
    }
    return categoryIds[name];
  }

  const supplier = await query(
    `INSERT INTO suppliers (name, phone, notes) VALUES ('Distribuidora de ejemplo', '1140000000', 'Proveedor de ejemplo: cambiá los datos')
     RETURNING id`
  );

  // Ingredientes con su stock inicial
  const ingredientIds = {};
  let n = 1;
  for (const [name, unit, cost, stock, critical, cat] of INGREDIENTS) {
    const result = await query(
      `INSERT INTO products (sku, name, kind, unit, cost_price, stock_qty, min_stock, category_id, supplier_id)
       VALUES ($1, $2, 'ingredient', $3, $4, $5, $6, $7, $8) RETURNING id`,
      [`ING-${String(n).padStart(3, '0')}`, name, unit, cost, stock, critical, await category(cat), supplier.rows[0].id]
    );
    n += 1;
    ingredientIds[name] = result.rows[0].id;
    await query(
      `INSERT INTO stock_movements (product_id, kind, qty, unit_cost, notes) VALUES ($1, 'import', $2, $3, 'Stock inicial de ejemplo')`,
      [result.rows[0].id, stock, cost]
    );
  }

  // Productos con su receta; el costo sale de la receta
  const productIds = {};
  n = 1;
  for (const [name, unit, price, stock, critical, cat, yieldQty, recipe] of PRODUCTS) {
    const result = await query(
      `INSERT INTO products (sku, name, kind, unit, sale_price, stock_qty, min_stock, category_id, recipe_yield)
       VALUES ($1, $2, 'product', $3, $4, $5, $6, $7, $8) RETURNING id`,
      [`PRD-${String(n).padStart(3, '0')}`, name, unit, price, stock, critical, await category(cat), yieldQty]
    );
    n += 1;
    const id = result.rows[0].id;
    productIds[name] = id;
    for (const [ingredient, amount] of Object.entries(recipe || {})) {
      await query('INSERT INTO recipe_items (product_id, ingredient_id, qty) VALUES ($1, $2, $3)', [
        id,
        ingredientIds[ingredient],
        amount,
      ]);
    }
    await refreshRecipeCost({ query }, id);
    if (stock) {
      await query(
        `INSERT INTO stock_movements (product_id, kind, qty, notes) VALUES ($1, 'import', $2, 'Stock inicial de ejemplo')`,
        [id, stock]
      );
    }
  }

  // Un cliente y un encargo para mañana, para ver cómo funciona
  const customer = await query(
    `INSERT INTO customers (name, phone, address, notes)
     VALUES ('Cliente de ejemplo', '1123456789', 'Calle Falsa 123', 'Cliente de ejemplo: podés borrarlo')
     RETURNING id`
  );
  const order = await query(
    `INSERT INTO orders (number, customer_id, due_date, due_time, fulfillment, address, shipping_cost, notes, subtotal, total)
     VALUES ('E-00001', $1, CURRENT_DATE + 1, '17:00', 'delivery', 'Calle Falsa 123', 2500,
             'Encargo de ejemplo: cumpleaños, sin nueces en las cookies', 36400, 38900)
     RETURNING id`,
    [customer.rows[0].id]
  );
  await query(
    `INSERT INTO order_items (order_id, product_id, description, qty, unit_price, line_total)
     VALUES ($1, $2, 'Alfajores de maicena', 12, 1200, 14400),
            ($1, $3, 'Carrot cake', 1, 22000, 22000)`,
    [order.rows[0].id, productIds['Alfajores de maicena'], productIds['Carrot cake']]
  );
  await query(
    `INSERT INTO payments (kind, customer_id, order_id, amount, method, notes)
     VALUES ('in', $1, $2, 15000, 'transfer', 'Seña de encargo')`,
    [customer.rows[0].id, order.rows[0].id]
  );

  console.log('OK: datos de ejemplo de pastelería cargados');
}

async function migrate() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to run migrations');
  }
  await runSchema();
  console.log('OK: schema aplicado');
  await ensureSettings();
  await ensureAdmin();
  await seedDemo();
  console.log('Migrations completed successfully.');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  migrate()
    .then(async () => {
      await getPool().end();
    })
    .catch(async (err) => {
      console.error('Migration failed:', err.message);
      try {
        await getPool().end();
      } catch {
        // ignore
      }
      process.exit(1);
    });
}

export { migrate };
