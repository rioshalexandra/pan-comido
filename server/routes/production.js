// Producción: registrar lo que se horneó.
// Cada tanda suma stock al producto y descuenta los ingredientes de su receta.
import { Router } from 'express';
import { query, withTransaction } from '../db/pool.js';
import { emptyToNull, httpError, qty } from '../lib/helpers.js';
import { applyStock } from '../lib/stock.js';
import { refreshRecipeCost } from '../lib/recipes.js';

const router = Router();

// Últimas tandas producidas
router.get('/', async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT b.*, p.name AS product_name, p.unit
       FROM production_batches b
       JOIN products p ON p.id = b.product_id
       ORDER BY b.produced_at DESC, b.id DESC
       LIMIT 60`
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

// Qué hornear: para cada producto, lo que piden los encargos pendientes de los próximos días
// más su stock crítico, menos lo que ya hay. ?days=N (por defecto 2: hoy y mañana)
router.get('/plan', async (req, res, next) => {
  try {
    const today = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.today || '')) ? req.query.today : null;
    const days = Math.min(Math.max(Number(req.query.days) || 2, 1), 14);
    const result = await query(
      `SELECT p.id, p.name, p.unit, p.stock_qty, p.min_stock, p.recipe_yield,
              COALESCE(o.ordered, 0) AS ordered,
              (SELECT COUNT(*) FROM recipe_items r WHERE r.product_id = p.id)::int AS recipe_count
       FROM products p
       LEFT JOIN LATERAL (
         SELECT SUM(oi.qty) AS ordered
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE oi.product_id = p.id AND o.status IN ('pending', 'ready')
           AND o.due_date < COALESCE($1::date, CURRENT_DATE) + $2::int
       ) o ON true
       WHERE p.kind = 'product' AND p.active = true
       ORDER BY p.name`,
      [today, days]
    );
    const data = result.rows
      .map((row) => {
        const needed = Number(row.ordered) + Number(row.min_stock) - Number(row.stock_qty);
        return { ...row, to_make: Math.max(0, Math.ceil(needed)) };
      })
      .filter((row) => row.to_make > 0);
    res.json({ data, days });
  } catch (err) {
    next(err);
  }
});

// Registrar una tanda: { productId, qty, producedAt, notes }
router.post('/', async (req, res, next) => {
  try {
    const productId = Number(req.body?.productId);
    const amount = qty(req.body?.qty);
    if (!productId) throw httpError(400, 'Elegí qué produjiste');
    if (amount <= 0) throw httpError(400, 'La cantidad debe ser mayor a cero');
    const producedAt = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.producedAt || '')) ? req.body.producedAt : null;

    const result = await withTransaction(async (client) => {
      const product = await client.query(`SELECT * FROM products WHERE id = $1 AND kind = 'product'`, [productId]);
      if (!product.rowCount) throw httpError(400, 'Producto inválido');
      const recipe = await refreshRecipeCost(client, productId);
      const unitCost = recipe.unitCost ?? Number(product.rows[0].cost_price);

      const batch = await client.query(
        `INSERT INTO production_batches (product_id, qty, produced_at, unit_cost, notes, created_by)
         VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4, $5, $6)
         RETURNING *`,
        [productId, amount, producedAt, unitCost, emptyToNull(req.body?.notes), req.user?.id || null]
      );
      const batchId = batch.rows[0].id;

      // Suma el producto terminado
      await applyStock(client, {
        productId,
        kind: 'production',
        delta: amount,
        unitCost,
        refType: 'production',
        refId: batchId,
        notes: 'Producción',
      });

      // Descuenta los ingredientes en proporción al rinde de la receta
      const negatives = [];
      if (recipe.yield && recipe.items.length) {
        const factor = amount / recipe.yield;
        for (const item of recipe.items) {
          const used = Math.round(Number(item.qty) * factor * 1000) / 1000;
          if (!used) continue;
          await applyStock(client, {
            productId: item.ingredient_id,
            kind: 'production',
            delta: -used,
            unitCost: item.cost_price,
            refType: 'production',
            refId: batchId,
            notes: `Usado en ${product.rows[0].name}`,
            allowNegative: true,
          });
          if (Number(item.stock_qty) - used < 0) negatives.push(item.name);
        }
      }
      return { batch: batch.rows[0], negatives, hasRecipe: recipe.items.length > 0 };
    });
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
});

// Borrar una tanda cargada por error: revierte el stock del producto y de los ingredientes
router.delete('/:id', async (req, res, next) => {
  try {
    await withTransaction(async (client) => {
      const batch = await client.query('SELECT * FROM production_batches WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!batch.rowCount) throw httpError(404, 'Tanda no encontrada');
      const moves = await client.query(
        `SELECT product_id, qty FROM stock_movements WHERE ref_type = 'production' AND ref_id = $1`,
        [req.params.id]
      );
      for (const move of moves.rows) {
        await client.query('UPDATE products SET stock_qty = stock_qty - $1, updated_at = now() WHERE id = $2', [
          move.qty,
          move.product_id,
        ]);
      }
      await client.query(`DELETE FROM stock_movements WHERE ref_type = 'production' AND ref_id = $1`, [req.params.id]);
      await client.query('DELETE FROM production_batches WHERE id = $1', [req.params.id]);
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
