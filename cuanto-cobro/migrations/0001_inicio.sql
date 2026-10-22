-- Cuánto Cobro: esquema inicial (Cloudflare D1 / SQLite)
-- Cada compradora tiene su cuenta y solo ve sus propios datos (user_id en cada tabla).

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  -- 'admin' = la dueña de la app (da de alta las cuentas); 'client' = quien la compró
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'client')),
  active INTEGER NOT NULL DEFAULT 1,
  -- Fecha hasta la que vale el acceso (YYYY-MM-DD). NULL = para siempre
  expires_at TEXT,
  phone TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- Intentos fallidos de entrar, para frenar a quien prueba contraseñas
CREATE TABLE login_attempts (
  username TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX login_attempts_idx ON login_attempts (username, at);

CREATE TABLE settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL DEFAULT '',
  labor_hour_rate REAL NOT NULL DEFAULT 0,
  energy_monthly REAL NOT NULL DEFAULT 0,
  oven_hours_month REAL NOT NULL DEFAULT 0,
  -- Margen que quiere ganar, para el precio sugerido
  target_margin REAL NOT NULL DEFAULT 60
);

CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT
);
CREATE INDEX suppliers_user_idx ON suppliers (user_id);

-- Ingredientes y packaging. Todo se guarda en unidad base: g, ml o un.
-- Costo por unidad base = pack_price / pack_qty (ej: $1.200 el paquete de 1000 g).
CREATE TABLE ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'un')),
  pack_qty REAL NOT NULL DEFAULT 1,
  pack_price REAL NOT NULL DEFAULT 0,
  is_packaging INTEGER NOT NULL DEFAULT 0,
  stock_qty REAL NOT NULL DEFAULT 0,
  min_stock REAL NOT NULL DEFAULT 0,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  price_updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX ingredients_user_idx ON ingredients (user_id);

-- Historial de precios de cada ingrediente (para ver cuánto subió)
CREATE TABLE price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  old_unit_cost REAL NOT NULL,
  new_unit_cost REAL NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX price_history_idx ON price_history (ingredient_id, changed_at);

CREATE TABLE recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🧁',
  -- Cuántas unidades salen de una tanda
  yield_qty REAL NOT NULL DEFAULT 1,
  yield_unit TEXT NOT NULL DEFAULT 'un',
  sale_price REAL NOT NULL DEFAULT 0,
  work_minutes REAL NOT NULL DEFAULT 0,
  oven_minutes REAL NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX recipes_user_idx ON recipes (user_id);

-- Cantidad de cada ingrediente por tanda, en la unidad base del ingrediente
CREATE TABLE recipe_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  qty REAL NOT NULL CHECK (qty > 0),
  UNIQUE (recipe_id, ingredient_id)
);

-- Cada vez que se produce: cuántas tandas y qué ingredientes se descontaron
CREATE TABLE production (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
  recipe_name TEXT NOT NULL,
  batches REAL NOT NULL,
  units REAL NOT NULL,
  cost REAL NOT NULL DEFAULT 0,
  produced_at TEXT NOT NULL,
  notes TEXT
);
CREATE INDEX production_user_idx ON production (user_id, produced_at);

CREATE TABLE production_items (
  production_id INTEGER NOT NULL REFERENCES production(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  qty REAL NOT NULL
);
