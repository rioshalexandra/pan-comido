import { Router } from 'express';
import { query, withTransaction } from '../db/pool.js';
import { computeDocTotals, emptyToNull, httpError, money, nextNumber, qty } from '../lib/helpers.js';
import { confirmPurchaseStock, deletePurchaseRecord, refreshPurchasePaid, reversePurchaseStock } from '../lib/stock.js';
import { listAttachments, pullAttachments } from '../lib/attachments.js';
import { removeStoredFile } from '../lib/storage.js';

const router = Router();

const PURCHASE_SELECT = `
  SELECT p.*, s.name AS supplier_name,
         (p.total - p.paid) AS balance
  FROM purchases p
  LEFT JOIN suppliers s ON s.id = p.supplier_id
`;

router.get('/', async (req, res, next) => {
  try {
    const params = [];
    const where = [];
    if (req.query.q) {
      params.push(`%${String(req.query.q).trim()}%`);
      where.push(`(p.number ILIKE $${params.length} OR COALESCE(s.name, '') ILIKE $${params.length})`);
    }
    if (req.query.status) {
      params.push(req.query.status);
      where.push(`p.status = $${params.length}`);
    }
    if (req.query.from) {
      params.push(req.query.from);
      where.push(`p.issued_at >= $${params.length}`);
    }
    if (req.query.to) {
      params.push(req.query.to);
      where.push(`p.issued_at <= $${params.length}`);
    }
    const sql = `${PURCHASE_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.issued_at DESC, p.id DESC LIMIT 200`;
    const result = await query(sql, params);
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const purchase = await loadPurchase(req.params.id);
    if (!purchase) return res.status(404).json({ error: 'Compra no encontrada' });
    res.json({ data: purchase });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const purchase = await withTransaction((client) => savePurchase(client, null, req.body, req.user?.id));
    res.status(201).json({ data: await loadPurchase(purchase.id) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    await withTransaction((client) => savePurchase(client, req.params.id, req.body, req.user?.id));
    res.json({ data: await loadPurchase(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/confirm', async (req, res, next) => {
  try {
    await withTransaction(async (client) => {
      const current = await client.query('SELECT * FROM purchases WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!current.rowCount) throw httpError(404, 'Compra no encontrada');
      if (current.rows[0].status !== 'draft') throw httpError(400, 'Solo se confirman borradores');
      await confirmPurchaseStock(client, current.rows[0].id, req.body?.updateCosts !== false);
      await client.query(`UPDATE purchases SET status = 'confirmed', updated_at = now() WHERE id = $1`, [
        current.rows[0].id,
      ]);
    });
    res.json({ data: await loadPurchase(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    await withTransaction(async (client) => {
      const current = await client.query('SELECT * FROM purchases WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!current.rowCount) throw httpError(404, 'Compra no encontrada');
      const purchase = current.rows[0];
      if (purchase.status === 'cancelled') throw httpError(400, 'La compra ya está cancelada');
      if (purchase.status === 'confirmed') await reversePurchaseStock(client, purchase.id);
      await client.query(`UPDATE purchases SET status = 'cancelled', updated_at = now() WHERE id = $1`, [
        purchase.id,
      ]);
    });
    res.json({ data: await loadPurchase(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const keys = await withTransaction(async (client) => {
      const files = await pullAttachments(client, 'purchase', req.params.id);
      await deletePurchaseRecord(client, req.params.id);
      return files;
    });
    await Promise.all(keys.map((key) => removeStoredFile(key)));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/payments', async (req, res, next) => {
  try {
    const payment = await withTransaction(async (client) => {
      const current = await client.query('SELECT * FROM purchases WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!current.rowCount) throw httpError(404, 'Compra no encontrada');
      const purchase = current.rows[0];
      if (purchase.status !== 'confirmed') throw httpError(400, 'Solo se pagan compras confirmadas');
      const amount = money(req.body?.amount);
      if (amount <= 0) throw httpError(400, 'El importe debe ser mayor a cero');
      const inserted = await client.query(
        `INSERT INTO payments (kind, supplier_id, purchase_id, amount, method, paid_at, notes, created_by)
         VALUES ('out', $1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          purchase.supplier_id,
          purchase.id,
          amount,
          req.body?.method || 'cash',
          req.body?.paidAt || new Date().toISOString().slice(0, 10),
          emptyToNull(req.body?.notes),
          req.user?.id || null,
        ]
      );
      await refreshPurchasePaid(client, purchase.id);
      return inserted.rows[0];
    });
    res.status(201).json({ data: { payment, purchase: await loadPurchase(req.params.id) } });
  } catch (err) {
    next(err);
  }
});

async function savePurchase(client, id, body, userId) {
  const items = await mapPurchaseItems(client, body.items || []);
  if (!items.length) throw httpError(400, 'Agregá al menos un producto');
  const settings = await client.query('SELECT tax_rate FROM store_settings WHERE id = 1');
  const totals = computeDocTotals(items, body.taxRate ?? settings.rows[0]?.tax_rate);
  if (id) {
    const current = await client.query('SELECT * FROM purchases WHERE id = $1 FOR UPDATE', [id]);
    if (!current.rowCount) throw httpError(404, 'Compra no encontrada');
    if (current.rows[0].status !== 'draft') throw httpError(400, 'Solo se editan borradores');
    await client.query(
      `UPDATE purchases
       SET supplier_id = $1, issued_at = $2, notes = $3, subtotal = $4, tax = $5, total = $6, updated_at = now()
       WHERE id = $7`,
      [
        body.supplierId || null,
        body.issuedAt || current.rows[0].issued_at,
        emptyToNull(body.notes),
        totals.subtotal,
        totals.tax,
        totals.total,
        id,
      ]
    );
    await client.query('DELETE FROM purchase_items WHERE purchase_id = $1', [id]);
    await insertPurchaseItems(client, id, items);
    return current.rows[0];
  }
  const number = await nextNumber(client, 'purchases', 'C');
  const inserted = await client.query(
    `INSERT INTO purchases (number, supplier_id, issued_at, notes, subtotal, tax, total, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      number,
      body.supplierId || null,
      body.issuedAt || new Date().toISOString().slice(0, 10),
      emptyToNull(body.notes),
      totals.subtotal,
      totals.tax,
      totals.total,
      userId || null,
    ]
  );
  await insertPurchaseItems(client, inserted.rows[0].id, items);
  return inserted.rows[0];
}

async function mapPurchaseItems(client, items) {
  const mapped = [];
  for (const item of items) {
    const product = await client.query('SELECT * FROM products WHERE id = $1', [item.productId]);
    if (!product.rowCount) throw httpError(400, 'Producto inválido');
    const quantity = qty(item.qty);
    const unitCost = money(item.unitCost ?? product.rows[0].cost_price);
    if (quantity <= 0) throw httpError(400, 'La cantidad debe ser mayor a cero');
    mapped.push({
      product_id: product.rows[0].id,
      description: product.rows[0].name,
      qty: quantity,
      unit_cost: unitCost,
      line_total: money(quantity * unitCost),
    });
  }
  return mapped;
}

async function insertPurchaseItems(client, purchaseId, items) {
  for (const item of items) {
    await client.query(
      `INSERT INTO purchase_items (purchase_id, product_id, description, qty, unit_cost, line_total)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [purchaseId, item.product_id, item.description, item.qty, item.unit_cost, item.line_total]
    );
  }
}

async function loadPurchase(id) {
  const result = await query(`${PURCHASE_SELECT} WHERE p.id = $1`, [id]);
  if (!result.rowCount) return null;
  const items = await query(
    `SELECT i.*, pr.sku, pr.unit, pr.stock_qty
     FROM purchase_items i
     JOIN products pr ON pr.id = i.product_id
     WHERE i.purchase_id = $1
     ORDER BY i.id`,
    [id]
  );
  const payments = await query('SELECT * FROM payments WHERE purchase_id = $1 ORDER BY paid_at, id', [id]);
  const attachments = await listAttachments('purchase', id);
  return { ...result.rows[0], items: items.rows, payments: payments.rows, attachments };
}

export default router;
