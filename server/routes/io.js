import { Router } from 'express';
import multer from 'multer';
import { query, withTransaction } from '../db/pool.js';
import { emptyToNull, httpError, money, qty } from '../lib/helpers.js';
import { buildSheet, parseSheet, truthy } from '../lib/sheet.js';
import { applyStock } from '../lib/stock.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const ENTITIES = {
  products: {
    filename: 'productos',
    sheet: 'Productos',
    headers: [
      'sku',
      'nombre',
      'categoria',
      'unidad',
      'codigo_barras',
      'costo',
      'precio',
      'stock',
      'stock_minimo',
      'activo',
      'descripcion',
      'tipo',
    ],
    async rows() {
      const result = await query(
        `SELECT p.sku, p.name AS nombre, c.name AS categoria, p.unit AS unidad, p.barcode AS codigo_barras,
                p.cost_price AS costo, p.sale_price AS precio, p.stock_qty AS stock, p.min_stock AS stock_minimo,
                CASE WHEN p.active THEN 'si' ELSE 'no' END AS activo, p.description AS descripcion,
                CASE WHEN p.kind = 'ingredient' THEN 'ingrediente' ELSE 'producto' END AS tipo
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.kind <> 'service'
         ORDER BY p.kind DESC, p.name`
      );
      return result.rows;
    },
  },
  customers: {
    filename: 'clientes',
    sheet: 'Clientes',
    headers: ['nombre', 'cuit', 'telefono', 'email', 'direccion', 'notas'],
    async rows() {
      const result = await query(
        `SELECT name AS nombre, tax_id AS cuit, phone AS telefono, email, address AS direccion, notes AS notas
         FROM customers ORDER BY name`
      );
      return result.rows;
    },
  },
  suppliers: {
    filename: 'proveedores',
    sheet: 'Proveedores',
    headers: ['nombre', 'cuit', 'telefono', 'email', 'direccion', 'notas'],
    async rows() {
      const result = await query(
        `SELECT name AS nombre, tax_id AS cuit, phone AS telefono, email, address AS direccion, notes AS notas
         FROM suppliers ORDER BY name`
      );
      return result.rows;
    },
  },
  payments: {
    filename: 'pagos',
    sheet: 'Pagos',
    headers: ['fecha', 'tipo', 'cliente', 'proveedor', 'comprobante', 'medio', 'importe', 'notas'],
    async rows() {
      const result = await query(
        `SELECT p.paid_at AS fecha,
                CASE WHEN p.kind = 'in' THEN 'cobro' ELSE 'pago' END AS tipo,
                c.name AS cliente,
                s.name AS proveedor,
                COALESCE(sa.number, pu.number) AS comprobante,
                p.method AS medio,
                p.amount AS importe,
                p.notes AS notas
         FROM payments p
         LEFT JOIN customers c ON c.id = p.customer_id
         LEFT JOIN suppliers s ON s.id = p.supplier_id
         LEFT JOIN sales sa ON sa.id = p.sale_id
         LEFT JOIN purchases pu ON pu.id = p.purchase_id
         ORDER BY p.paid_at DESC, p.id DESC`
      );
      return result.rows;
    },
  },
};

router.get('/export/:entity', async (req, res, next) => {
  try {
    const entity = ENTITIES[req.params.entity];
    const format = String(req.query.format || 'xlsx') === 'csv' ? 'csv' : 'xlsx';
    if (!entity) {
      return res.status(404).json({ error: 'Exportación no disponible' });
    }
    const rows = await entity.rows();
    const payload = rows.length ? rows : [Object.fromEntries(entity.headers.map((h) => [h, '']))];
    const buffer = buildSheet(payload, entity.sheet, format);
    const filename = `${entity.filename}.${format}`;
    res.setHeader(
      'Content-Type',
      format === 'csv'
        ? 'text/csv; charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.post('/import/:entity', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Subí un archivo CSV o Excel' });
    const rows = parseSheet(req.file.buffer);
    if (!rows.length) return res.status(400).json({ error: 'El archivo no tiene filas' });
    let result;
    if (req.params.entity === 'products') result = await importProducts(rows);
    else if (req.params.entity === 'customers') result = await importParties('customers', rows);
    else if (req.params.entity === 'suppliers') result = await importParties('suppliers', rows);
    else throw httpError(404, 'Importación no disponible');
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

async function importProducts(rows) {
  return withTransaction(async (client) => {
    let created = 0;
    let updated = 0;
    const errors = [];
    for (const [index, row] of rows.entries()) {
      const sku = String(row.sku || '').trim();
      const name = String(row.name || '').trim();
      if (!sku || !name) {
        errors.push({ row: index + 2, error: 'Falta SKU o nombre' });
        continue;
      }
      let categoryId = null;
      const categoryName = String(row.category || '').trim();
      if (categoryName) {
        const existing = await client.query('SELECT id FROM categories WHERE lower(name) = lower($1)', [
          categoryName,
        ]);
        if (existing.rowCount) categoryId = existing.rows[0].id;
        else {
          const inserted = await client.query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [
            categoryName,
          ]);
          categoryId = inserted.rows[0].id;
        }
      }
      const found = await client.query('SELECT * FROM products WHERE sku = $1', [sku]);
      const cost = money(row.cost_price);
      const price = money(row.sale_price);
      const minStock = qty(row.min_stock);
      const stockQty = qty(row.stock_qty);
      // Columna "tipo": producto (para vender) o ingrediente (materia prima)
      const kindText = String(row.kind || '').trim().toLowerCase();
      const kind = kindText.startsWith('ing') ? 'ingredient' : kindText ? 'product' : null;
      if (found.rowCount) {
        const product = found.rows[0];
        await client.query(
          `UPDATE products
           SET name = $1, description = $2, category_id = $3, unit = $4, barcode = $5,
               cost_price = $6, sale_price = $7, min_stock = $8, active = $9, kind = $11, updated_at = now()
           WHERE id = $10`,
          [
            name,
            emptyToNull(row.description),
            categoryId,
            String(row.unit || product.unit || 'un').trim() || 'un',
            emptyToNull(row.barcode),
            cost,
            price,
            minStock,
            truthy(row.active),
            product.id,
            kind || product.kind,
          ]
        );
        const delta = qty(stockQty - Number(product.stock_qty));
        if (delta) {
          await applyStock(client, {
            productId: product.id,
            kind: 'import',
            delta,
            unitCost: cost,
            notes: 'Importación CSV/Excel',
          });
        }
        updated += 1;
      } else {
        const inserted = await client.query(
          `INSERT INTO products
             (sku, name, description, category_id, unit, barcode, cost_price, sale_price, stock_qty, min_stock, active, kind)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11)
           RETURNING id`,
          [
            sku,
            name,
            emptyToNull(row.description),
            categoryId,
            String(row.unit || 'un').trim() || 'un',
            emptyToNull(row.barcode),
            cost,
            price,
            minStock,
            truthy(row.active),
            kind || 'product',
          ]
        );
        if (stockQty) {
          await applyStock(client, {
            productId: inserted.rows[0].id,
            kind: 'import',
            delta: stockQty,
            unitCost: cost,
            notes: 'Importación CSV/Excel',
          });
        }
        created += 1;
      }
    }
    return { created, updated, errors };
  });
}

async function importParties(table, rows) {
  let created = 0;
  let updated = 0;
  const errors = [];
  for (const [index, row] of rows.entries()) {
    const name = String(row.name || '').trim();
    if (!name) {
      errors.push({ row: index + 2, error: 'Falta nombre' });
      continue;
    }
    const taxId = emptyToNull(row.tax_id);
    let found = { rowCount: 0, rows: [] };
    if (taxId) {
      found = await query(`SELECT id FROM ${table} WHERE tax_id = $1`, [taxId]);
    }
    if (!found.rowCount) {
      found = await query(`SELECT id FROM ${table} WHERE lower(name) = lower($1)`, [name]);
    }
    const values = [
      name,
      taxId,
      emptyToNull(row.phone),
      emptyToNull(row.email),
      emptyToNull(row.address),
      emptyToNull(row.notes),
    ];
    if (found.rowCount) {
      await query(
        `UPDATE ${table} SET name = $1, tax_id = $2, phone = $3, email = $4, address = $5, notes = $6 WHERE id = $7`,
        [...values, found.rows[0].id]
      );
      updated += 1;
    } else {
      await query(
        `INSERT INTO ${table} (name, tax_id, phone, email, address, notes) VALUES ($1, $2, $3, $4, $5, $6)`,
        values
      );
      created += 1;
    }
  }
  return { created, updated, errors };
}

export default router;
