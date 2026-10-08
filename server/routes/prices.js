import { Router } from 'express';
import { query, withTransaction } from '../db/pool.js';
import { emptyToNull, httpError, money } from '../lib/helpers.js';

const router = Router();

function nextPrice(oldPrice, mode, value) {
  const base = Number(oldPrice || 0);
  const next = mode === 'percent' ? base * (1 + Number(value) / 100) : base + Number(value);
  return money(Math.max(0, next));
}

async function matchingProducts(categoryId) {
  const params = [];
  // Solo productos de venta (los ingredientes no tienen precio de venta)
  let sql = "SELECT * FROM products WHERE active = true AND kind = 'product'";
  if (categoryId) {
    params.push(Number(categoryId));
    sql += ` AND category_id = $1`;
  }
  sql += ' ORDER BY name';
  return query(sql, params);
}

router.post('/preview', async (req, res, next) => {
  try {
    const { mode, value, categoryId } = req.body || {};
    if (!['percent', 'amount'].includes(mode)) {
      return res.status(400).json({ error: 'Modo inválido' });
    }
    if (!Number.isFinite(Number(value)) || Number(value) === 0) {
      return res.status(400).json({ error: 'Indicá un valor distinto de cero' });
    }
    const products = await matchingProducts(categoryId);
    const items = products.rows.map((product) => {
      const newPrice = nextPrice(product.sale_price, mode, value);
      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        old_price: Number(product.sale_price),
        new_price: newPrice,
        delta: money(newPrice - Number(product.sale_price)),
      };
    });
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

router.post('/apply', async (req, res, next) => {
  try {
    const { mode, value, categoryId, notes } = req.body || {};
    if (!['percent', 'amount'].includes(mode)) {
      return res.status(400).json({ error: 'Modo inválido' });
    }
    if (!Number.isFinite(Number(value)) || Number(value) === 0) {
      return res.status(400).json({ error: 'Indicá un valor distinto de cero' });
    }
    const adjustment = await withTransaction(async (client) => {
      const products = await matchingProducts(categoryId);
      if (!products.rowCount) throw httpError(400, 'No hay productos para ajustar');
      const inserted = await client.query(
        `INSERT INTO price_adjustments (mode, value, category_id, notes, product_count, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [mode, value, categoryId || null, emptyToNull(notes), products.rowCount, req.user?.id || null]
      );
      const adj = inserted.rows[0];
      for (const product of products.rows) {
        const newPrice = nextPrice(product.sale_price, mode, value);
        await client.query(
          `INSERT INTO price_adjustment_items (adjustment_id, product_id, old_price, new_price)
           VALUES ($1, $2, $3, $4)`,
          [adj.id, product.id, product.sale_price, newPrice]
        );
        await client.query('UPDATE products SET sale_price = $1, updated_at = now() WHERE id = $2', [
          newPrice,
          product.id,
        ]);
      }
      return adj;
    });
    const items = await query(
      `SELECT i.*, p.sku, p.name
       FROM price_adjustment_items i
       JOIN products p ON p.id = i.product_id
       WHERE i.adjustment_id = $1
       ORDER BY p.name`,
      [adjustment.id]
    );
    res.status(201).json({ data: { ...adjustment, items: items.rows } });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT a.*, c.name AS category_name, u.name AS user_name
       FROM price_adjustments a
       LEFT JOIN categories c ON c.id = a.category_id
       LEFT JOIN users u ON u.id = a.created_by
       ORDER BY a.created_at DESC
       LIMIT 50`
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT a.*, c.name AS category_name
       FROM price_adjustments a
       LEFT JOIN categories c ON c.id = a.category_id
       WHERE a.id = $1`,
      [req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Ajuste no encontrado' });
    const items = await query(
      `SELECT i.*, p.sku, p.name
       FROM price_adjustment_items i
       JOIN products p ON p.id = i.product_id
       WHERE i.adjustment_id = $1
       ORDER BY p.name`,
      [req.params.id]
    );
    res.json({ data: { ...result.rows[0], items: items.rows } });
  } catch (err) {
    next(err);
  }
});

export default router;
