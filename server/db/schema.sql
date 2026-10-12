-- =====================================================================
-- Pan Comido — esquema de la base de datos (PostgreSQL)
-- Es idempotente: se puede ejecutar muchas veces sin romper nada.
-- =====================================================================

-- ---------- Usuarios y sesiones ----------
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  -- 'admin' ve todo. Queda preparado para sumar empleados más adelante.
  role TEXT NOT NULL DEFAULT 'admin',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_role CHECK (role IN ('admin', 'staff'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Configuración del negocio (una sola fila) ----------
CREATE TABLE IF NOT EXISTS store_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name TEXT NOT NULL DEFAULT 'Pan Comido',
  timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  currency TEXT NOT NULL DEFAULT 'ARS',
  tax_rate NUMERIC(6,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO store_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ---------- Catálogo ----------
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  tax_id TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Una sola tabla para todo lo que tiene stock o precio. kind:
--   'product'    → lo que se vende (cookies, alfajores, budines…)
--   'ingredient' → materia prima (harina, manteca, huevos…)
--   'service'    → ítems sin stock (por ejemplo, el costo de envío)
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL DEFAULT 'product',
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  unit TEXT NOT NULL DEFAULT 'un',
  barcode TEXT,
  cost_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  stock_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  -- Stock crítico: con esta cantidad o menos, avisa (a producir o a pedir)
  min_stock NUMERIC(14,3) NOT NULL DEFAULT 0,
  -- Cantidad sugerida para pedir al proveedor (opcional)
  reorder_qty NUMERIC(14,3),
  supplier_id INT REFERENCES suppliers(id) ON DELETE SET NULL,
  -- Receta: cuántas unidades salen de una tanda (rinde)
  recipe_yield NUMERIC(14,3),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT products_kind CHECK (kind IN ('product', 'ingredient', 'service'))
);

-- Receta de cada producto: qué ingredientes y cuánto (en la unidad del ingrediente) por tanda
CREATE TABLE IF NOT EXISTS recipe_items (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id INT NOT NULL REFERENCES products(id),
  qty NUMERIC(14,4) NOT NULL,
  CONSTRAINT recipe_items_qty CHECK (qty > 0),
  CONSTRAINT recipe_items_unique UNIQUE (product_id, ingredient_id)
);

-- Notas o procedimiento de la receta (pasos, temperatura, tiempos)
ALTER TABLE products ADD COLUMN IF NOT EXISTS recipe_notes TEXT;
-- Costo completo de una receta: minutos de trabajo y de horno por tanda
ALTER TABLE products ADD COLUMN IF NOT EXISTS recipe_work_minutes NUMERIC(8,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS recipe_oven_minutes NUMERIC(8,2);
-- Valor de la hora de trabajo y gasto de luz y gas para calcular el margen real
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS labor_hour_rate NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS energy_monthly NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS oven_hours_month NUMERIC(8,2) NOT NULL DEFAULT 0;

-- ---------- Clientes ----------
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  tax_id TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  birthday DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Ventas ----------
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  number TEXT UNIQUE NOT NULL,
  customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
  issued_at DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sales_status CHECK (status IN ('draft', 'confirmed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id),
  description TEXT NOT NULL,
  qty NUMERIC(14,3) NOT NULL,
  unit_price NUMERIC(14,2) NOT NULL,
  cost_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(14,2) NOT NULL,
  CONSTRAINT sale_items_qty CHECK (qty > 0)
);

-- ---------- Encargos (pedidos de clientes con fecha de entrega) ----------
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  number TEXT UNIQUE NOT NULL,
  customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  phone TEXT,
  due_date DATE NOT NULL,
  due_time TIME,
  -- 'pickup' = retira en el local; 'delivery' = envío a domicilio
  fulfillment TEXT NOT NULL DEFAULT 'pickup',
  address TEXT,
  shipping_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  sale_id INT REFERENCES sales(id) ON DELETE SET NULL,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT orders_fulfillment CHECK (fulfillment IN ('pickup', 'delivery')),
  CONSTRAINT orders_status CHECK (status IN ('pending', 'ready', 'delivered', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id),
  description TEXT NOT NULL,
  qty NUMERIC(14,3) NOT NULL,
  unit_price NUMERIC(14,2) NOT NULL,
  line_total NUMERIC(14,2) NOT NULL,
  CONSTRAINT order_items_qty CHECK (qty > 0)
);

-- ---------- Compras a proveedores ----------
CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  number TEXT UNIQUE NOT NULL,
  supplier_id INT REFERENCES suppliers(id) ON DELETE SET NULL,
  issued_at DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT purchases_status CHECK (status IN ('draft', 'confirmed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id SERIAL PRIMARY KEY,
  purchase_id INT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id),
  description TEXT NOT NULL,
  qty NUMERIC(14,3) NOT NULL,
  unit_cost NUMERIC(14,2) NOT NULL,
  line_total NUMERIC(14,2) NOT NULL,
  CONSTRAINT purchase_items_qty CHECK (qty > 0)
);

-- ---------- Cobros y pagos ----------
-- kind 'in' = cobro a cliente; 'out' = pago a proveedor.
-- Una seña de encargo se guarda con order_id; al entregar se le asigna la venta (sale_id).
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
  supplier_id INT REFERENCES suppliers(id) ON DELETE SET NULL,
  sale_id INT REFERENCES sales(id) ON DELETE SET NULL,
  purchase_id INT REFERENCES purchases(id) ON DELETE SET NULL,
  order_id INT REFERENCES orders(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash',
  paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payments_kind CHECK (kind IN ('in', 'out')),
  CONSTRAINT payments_amount CHECK (amount > 0),
  CONSTRAINT payments_method CHECK (method IN ('cash', 'transfer', 'card', 'check', 'other'))
);

-- ---------- Producción ----------
-- Cada tanda horneada: suma stock del producto y descuenta los ingredientes de la receta
CREATE TABLE IF NOT EXISTS production_batches (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id),
  qty NUMERIC(14,3) NOT NULL,
  produced_at DATE NOT NULL DEFAULT CURRENT_DATE,
  unit_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT production_qty CHECK (qty > 0)
);

-- ---------- Movimientos de stock (historial de cada entrada y salida) ----------
CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id),
  kind TEXT NOT NULL,
  qty NUMERIC(14,3) NOT NULL,
  unit_cost NUMERIC(14,2),
  ref_type TEXT,
  ref_id INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT stock_movements_kind CHECK (kind IN ('sale', 'purchase', 'adjustment', 'import', 'manual', 'production'))
);

-- ---------- Ajustes masivos de precios ----------
CREATE TABLE IF NOT EXISTS price_adjustments (
  id SERIAL PRIMARY KEY,
  mode TEXT NOT NULL,
  value NUMERIC(14,4) NOT NULL,
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  notes TEXT,
  product_count INT NOT NULL DEFAULT 0,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT price_adjustments_mode CHECK (mode IN ('percent', 'amount'))
);

CREATE TABLE IF NOT EXISTS price_adjustment_items (
  id SERIAL PRIMARY KEY,
  adjustment_id INT NOT NULL REFERENCES price_adjustments(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id),
  old_price NUMERIC(14,2) NOT NULL,
  new_price NUMERIC(14,2) NOT NULL
);

-- ---------- Fotos y archivos adjuntos ----------
CREATE TABLE IF NOT EXISTS attachments (
  id SERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id INT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'file',
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INT NOT NULL,
  storage_key TEXT NOT NULL,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT attachments_entity_type CHECK (entity_type IN ('product', 'purchase')),
  CONSTRAINT attachments_kind CHECK (kind IN ('photo', 'file'))
);

-- ---------- Índices ----------
CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions (token);
CREATE INDEX IF NOT EXISTS products_name_idx ON products (name);
CREATE INDEX IF NOT EXISTS products_kind_idx ON products (kind, active);
CREATE INDEX IF NOT EXISTS customers_name_idx ON customers (name);
CREATE INDEX IF NOT EXISTS suppliers_name_idx ON suppliers (name);
CREATE INDEX IF NOT EXISTS sales_issued_idx ON sales (issued_at);
CREATE INDEX IF NOT EXISTS purchases_issued_idx ON purchases (issued_at);
CREATE INDEX IF NOT EXISTS payments_paid_idx ON payments (paid_at);
CREATE INDEX IF NOT EXISTS payments_order_idx ON payments (order_id);
CREATE INDEX IF NOT EXISTS orders_due_idx ON orders (due_date, due_time);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);
CREATE INDEX IF NOT EXISTS recipe_items_product_idx ON recipe_items (product_id);
CREATE INDEX IF NOT EXISTS production_date_idx ON production_batches (produced_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON stock_movements (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_ref_idx ON stock_movements (ref_type, ref_id);
CREATE INDEX IF NOT EXISTS attachments_entity_idx ON attachments (entity_type, entity_id)
