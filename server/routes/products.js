// Productos e ingredientes (una sola tabla, diferenciados por "kind").
//   product    → lo que se vende (cookies, alfajores…), puede tener receta
//   ingredient → materia prima (harina, manteca…), se compra a proveedores
import { Router } from 'express';
import { query, withTransaction } from '../db/pool.js';
import { emptyToNull, httpError, money, qty } from '../lib/helpers.js';
import { applyStock } from '../lib/stock.js';
import { listAttachments, pullAttachments } from '../lib/attachments.js';
import { removeStoredFile } from '../lib/storage.js';
import { loadRecipe, refreshCostsUsingIngredient, refreshRecipeCost } from '../lib/recipes.js';

const router = Router();

const KINDS = ['product', 'ingredient'];

const PRODUCT_SELECT = `
  SELECT p.*, c.name AS category_name, sup.name AS supplier_name,
         (SELECT COUNT(*) FROM recipe_items r WHERE r.product_id = p.id)::int AS recipe_count,
         (SELECT a.id FROM attachments a
          WHERE a.entity_type = 'product' AND a.entity_id = p.id AND a.kind = 'photo'
          ORDER BY a.id LIMIT 1) AS photo_id
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN suppliers sup ON sup.id = p.supplier_id
`;

// ---------- Categorías ----------
router.get('/categories', async (_req, res, next) => {
  try {
    const result = await query('SELECT * FROM categories ORDER BY name');
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/categories', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const result = await query('INSERT INTO categories (name) VALUES ($1) RETURNING *', [name]);
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/categories/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------- Pedido a proveedores ----------
// Lo que llegó a su stock crítico y se compra (ingredientes, o productos sin receta).
// Los productos con receta no van acá: van a "Qué hornear" en Producción.
router.get('/reorder', async (_req, res, next) => {
  try {
    const result = await query(
      `${PRODUCT_SELECT}
       WHERE p.active = true AND p.kind IN ('product', 'ingredient') AND p.min_stock > 0 AND p.stock_qty <= p.min_stock
         AND NOT EXISTS (SELECT 1 FROM recipe_items r WHERE r.product_id = p.id)
       ORDER BY sup.name NULLS LAST, p.name`
    );
    const data = result.rows.map((row) => {
      const stock = Number(row.stock_qty);
      const critical = Number(row.min_stock);
      // Sugerencia: la cantidad cargada, o lo necesario para llegar al doble del crítico
      const suggested = Number(row.reorder_qty) > 0 ? Number(row.reorder_qty) : Math.max(Math.ceil(critical * 2 - stock), 1);
      return { ...row, suggested_qty: suggested };
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// ---------- Listado ----------
// ?kind=product|ingredient  ?q=texto  ?categoryId=N  ?active=all
router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const params = [];
    const where = [];
    if (q) {
      params.push(`%${q}%`);
      where.push(
        `(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR COALESCE(p.barcode, '') ILIKE $${params.length})`
      );
    }
    if (req.query.categoryId) {
      params.push(Number(req.query.categoryId));
      where.push(`p.category_id = $${params.length}`);
    }
    if (KINDS.includes(req.query.kind)) {
      params.push(req.query.kind);
      where.push(`p.kind = $${params.length}`);
    } else if (req.query.kind !== 'all') {
      // Por defecto no se listan los ítems internos (como el envío)
      where.push(`p.kind <> 'service'`);
    }
    if (req.query.active !== 'all') where.push('p.active = true');
    const sql = `${PRODUCT_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.name`;
    const result = await query(sql, params);
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

// ---------- Detalle ----------
router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(`${PRODUCT_SELECT} WHERE p.id = $1`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Producto no encontrado' });
    const product = result.rows[0];
    const [movements, attachments, recipe, usedIn, batches] = await Promise.all([
      query(`SELECT * FROM stock_movements WHERE product_id = $1 ORDER BY created_at DESC LIMIT 80`, [req.params.id]),
      listAttachments('product', req.params.id),
      product.kind === 'product' ? loadRecipe({ query }, req.params.id) : null,
      // Para ingredientes: en qué recetas se usa
      product.kind === 'ingredient'
        ? query(
            `SELECT p.id, p.name, r.qty FROM recipe_items r JOIN products p ON p.id = r.product_id
             WHERE r.ingredient_id = $1 ORDER BY p.name`,
            [req.params.id]
          )
        : null,
      product.kind === 'product'
        ? query(`SELECT * FROM production_batches WHERE product_id = $1 ORDER BY produced_at DESC, id DESC LIMIT 20`, [
            req.params.id,
          ])
        : null,
    ]);
    res.json({
      data: {
        ...product,
        movements: movements.rows,
        attachments,
        recipe,
        used_in: usedIn?.rows || [],
        batches: batches?.rows || [],
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------- Receta ----------
// body: { yield: 24, items: [{ ingredientId, qty }], notes: 'Procedimiento…', workMinutes: 60, ovenMinutes: 15 }
router.put('/:id/recipe', async (req, res, next) => {
  try {
    const recipe = await withTransaction(async (client) => {
      const product = await client.query(`SELECT id FROM products WHERE id = $1 AND kind = 'product'`, [req.params.id]);
      if (!product.rowCount) throw httpError(404, 'Producto no encontrado');
      const yieldQty = qty(req.body?.yield);
      const items = (req.body?.items || [])
        .map((item) => ({ ingredientId: Number(item.ingredientId), qty: Number(item.qty) }))
        .filter((item) => item.ingredientId && item.qty > 0);
      if (items.length && yieldQty <= 0) throw httpError(400, 'Indicá cuántas unidades rinde la receta');

      const minutes = (value) => (Number(value) > 0 ? Number(value) : null);
      await client.query(
        `UPDATE products SET recipe_yield = $1, recipe_notes = $2, recipe_work_minutes = $3, recipe_oven_minutes = $4,
           updated_at = now() WHERE id = $5`,
        [
          yieldQty > 0 ? yieldQty : null,
          emptyToNull(req.body?.notes),
          minutes(req.body?.workMinutes),
          minutes(req.body?.ovenMinutes),
          req.params.id,
        ]
      );
      await client.query('DELETE FROM recipe_items WHERE product_id = $1', [req.params.id]);
      for (const item of items) {
        const ing = await client.query(`SELECT id FROM products WHERE id = $1 AND kind = 'ingredient'`, [item.ingredientId]);
        if (!ing.rowCount) throw httpError(400, 'Ingrediente inválido');
        await client.query(
          `INSERT INTO recipe_items (product_id, ingredient_id, qty) VALUES ($1, $2, $3)
           ON CONFLICT (product_id, ingredient_id) DO UPDATE SET qty = recipe_items.qty + EXCLUDED.qty`,
          [req.params.id, item.ingredientId, item.qty]
        );
      }
      // El costo del producto pasa a ser el de la receta
      return refreshRecipeCost(client, req.params.id);
    });
    res.json({ data: recipe });
  } catch (err) {
    next(err);
  }
});

// ---------- Alta, edición y baja ----------
router.post('/', async (req, res, next) => {
  try {
    const product = await withTransaction((client) => saveProduct(client, null, req.body));
    res.status(201).json({ data: product });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const product = await withTransaction((client) => saveProduct(client, req.params.id, req.body));
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const keys = await withTransaction(async (client) => {
      const product = await client.query('SELECT id, name FROM products WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!product.rowCount) throw httpError(404, 'Producto no encontrado');
      const used = await client.query(
        `SELECT
           (SELECT COUNT(*) FROM sale_items WHERE product_id = $1) +
           (SELECT COUNT(*) FROM purchase_items WHERE product_id = $1) +
           (SELECT COUNT(*) FROM order_items WHERE product_id = $1) +
           (SELECT COUNT(*) FROM production_batches WHERE product_id = $1) +
           (SELECT COUNT(*) FROM recipe_items WHERE ingredient_id = $1) AS n`,
        [req.params.id]
      );
      if (Number(used.rows[0].n) > 0) {
        throw httpError(
          409,
          'Ya tiene ventas, encargos, compras, producción o está en una receta. En lugar de borrarlo, desactivalo.'
        );
      }
      const files = await pullAttachments(client, 'product', req.params.id);
      await client.query('DELETE FROM stock_movements WHERE product_id = $1', [req.params.id]);
      await client.query('DELETE FROM price_adjustment_items WHERE product_id = $1', [req.params.id]);
      await client.query('DELETE FROM products WHERE id = $1', [req.params.id]);
      return files;
    });
    await Promise.all(keys.map((key) => removeStoredFile(key)));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Ajuste manual de stock (sube o baja, con motivo)
router.post('/:id/adjust-stock', async (req, res, next) => {
  try {
    const amount = Math.abs(qty(req.body?.qty ?? req.body?.delta));
    if (!amount) return res.status(400).json({ error: 'Indicá una cantidad distinta de cero' });
    const down = req.body?.direction === 'down' || req.body?.direction === 'bajar' || Number(req.body?.delta) < 0;
    const product = await withTransaction(async (client) => {
      await applyStock(client, {
        productId: Number(req.params.id),
        kind: 'manual',
        delta: down ? -amount : amount,
        notes: emptyToNull(req.body?.notes),
      });
      const result = await client.query(`${PRODUCT_SELECT} WHERE p.id = $1`, [req.params.id]);
      return result.rows[0];
    });
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
});

async function saveProduct(client, id, body = {}) {
  const name = String(body.name || '').trim();
  if (!name) throw httpError(400, 'El nombre es obligatorio');
  const kind = KINDS.includes(body.kind) ? body.kind : 'product';
  // Si no se carga un código, se genera uno automático a partir del nombre
  const sku = String(body.sku || '').trim() || (await autoSku(client, name, kind));
  const values = [
    sku,
    name,
    emptyToNull(body.description),
    body.categoryId || null,
    String(body.unit || 'un').trim() || 'un',
    emptyToNull(body.barcode),
    money(body.costPrice),
    kind === 'ingredient' ? 0 : money(body.salePrice),
    qty(body.minStock),
    body.active !== false,
    kind,
    Number(body.reorderQty) > 0 ? qty(body.reorderQty) : null,
    body.supplierId ? Number(body.supplierId) : null,
    // Dibujito: si no viene se deja el que tenía; '' = sin dibujo
    body.icon === undefined || body.icon === null ? null : String(body.icon).trim().slice(0, 16),
  ];
  if (id) {
    const result = await client.query(
      `UPDATE products
       SET sku = $1, name = $2, description = $3, category_id = $4, unit = $5, barcode = $6,
           cost_price = $7, sale_price = $8, min_stock = $9, active = $10, kind = $11,
           reorder_qty = $12, supplier_id = $13, icon = COALESCE($14, icon), updated_at = now()
       WHERE id = $15
       RETURNING *`,
      [...values, id]
    );
    if (!result.rowCount) throw httpError(404, 'Producto no encontrado');
    // Si cambió el costo de un ingrediente, se actualizan las recetas que lo usan
    if (kind === 'ingredient') await refreshCostsUsingIngredient(client, id);
    // Un producto con receta mantiene el costo calculado por la receta
    if (kind === 'product') await refreshRecipeCost(client, id);
    return result.rows[0];
  }
  const inserted = await client.query(
    `INSERT INTO products
       (sku, name, description, category_id, unit, barcode, cost_price, sale_price, min_stock, active, kind,
        reorder_qty, supplier_id, icon, stock_qty)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 0)
     RETURNING *`,
    values
  );
  const product = inserted.rows[0];
  const stockQty = qty(body.stockQty);
  if (stockQty) {
    await applyStock(client, {
      productId: product.id,
      kind: 'import',
      delta: stockQty,
      unitCost: money(body.costPrice),
      notes: 'Stock inicial',
    });
    product.stock_qty = stockQty;
  }
  return product;
}

// Genera un código único tipo "PRD-COOKIES-DE-CHOCOLATE" o "ING-HARINA-0000"
async function autoSku(client, name, kind) {
  const base =
    (kind === 'ingredient' ? 'ING-' : 'PRD-') +
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24);
  let sku = base;
  for (let i = 2; ; i += 1) {
    const exists = await client.query('SELECT 1 FROM products WHERE sku = $1', [sku]);
    if (!exists.rowCount) return sku;
    sku = `${base}-${i}`;
  }
}

export default router;
