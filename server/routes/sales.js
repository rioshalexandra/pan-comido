// Ventas: mostrador (cobro en un paso), detalle, cobros parciales, cancelación y borrado.
import { Router } from 'express';
import { query, withTransaction } from '../db/pool.js';
import { computeDocTotals, emptyToNull, httpError, money, nextNumber, qty } from '../lib/helpers.js';
import { confirmSaleStock, deleteSaleRecord, refreshSalePaid, reverseSaleStock } from '../lib/stock.js';

export const METHODS = ['cash', 'transfer', 'card', 'check', 'other'];

const router = Router();

const SALE_SELECT = `
  SELECT s.*, c.name AS customer_name,
         (s.total - s.paid) AS balance,
         (SELECT o.number FROM orders o WHERE o.sale_id = s.id LIMIT 1) AS order_number
  FROM sales s
  LEFT JOIN customers c ON c.id = s.customer_id
`;

router.get('/', async (req, res, next) => {
  try {
    const params = [];
    const where = [];
    if (req.query.q) {
      params.push(`%${String(req.query.q).trim()}%`);
      where.push(`(s.number ILIKE $${params.length} OR COALESCE(c.name, '') ILIKE $${params.length})`);
    }
    if (req.query.status) {
      params.push(req.query.status);
      where.push(`s.status = $${params.length}`);
    }
    if (req.query.from) {
      params.push(req.query.from);
      where.push(`s.issued_at >= $${params.length}`);
    }
    if (req.query.to) {
      params.push(req.query.to);
      where.push(`s.issued_at <= $${params.length}`);
    }
    const sql = `${SALE_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY s.issued_at DESC, s.id DESC LIMIT 200`;
    const result = await query(sql, params);
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

// Cobro en un solo paso (mostrador): arma la venta, la confirma (descuenta stock)
// y registra el pago completo.
// body: { customerId, items:[{productId, qty, unitPrice}], method, notes }
router.post('/quick', async (req, res, next) => {
  try {
    const body = req.body || {};
    const saleId = await withTransaction((client) =>
      createPaidSale(client, {
        customerId: body.customerId || null,
        items: body.items,
        method: body.method,
        notes: body.notes,
        user: req.user,
      })
    );
    res.status(201).json({ data: await loadSale(saleId) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const sale = await loadSale(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });
    res.json({ data: sale });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const sale = await withTransaction((client) => saveSale(client, null, req.body, req.user));
    res.status(201).json({ data: await loadSale(sale.id) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    await withTransaction((client) => saveSale(client, req.params.id, req.body, req.user));
    res.json({ data: await loadSale(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/confirm', async (req, res, next) => {
  try {
    await withTransaction(async (client) => {
      const current = await client.query('SELECT * FROM sales WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!current.rowCount) throw httpError(404, 'Venta no encontrada');
      if (current.rows[0].status !== 'draft') throw httpError(400, 'Solo se confirman borradores');
      await confirmSaleStock(client, current.rows[0].id);
      await client.query(`UPDATE sales SET status = 'confirmed', updated_at = now() WHERE id = $1`, [current.rows[0].id]);
    });
    res.json({ data: await loadSale(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    await withTransaction(async (client) => {
      const current = await client.query('SELECT * FROM sales WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!current.rowCount) throw httpError(404, 'Venta no encontrada');
      const sale = current.rows[0];
      if (sale.status === 'cancelled') throw httpError(400, 'La venta ya está cancelada');
      if (sale.status === 'confirmed') await reverseSaleStock(client, sale.id);
      await client.query(`UPDATE sales SET status = 'cancelled', updated_at = now() WHERE id = $1`, [sale.id]);
    });
    res.json({ data: await loadSale(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await withTransaction((client) => deleteSaleRecord(client, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Cobro parcial o total de una venta ya confirmada
router.post('/:id/payments', async (req, res, next) => {
  try {
    const payment = await withTransaction(async (client) => {
      const current = await client.query('SELECT * FROM sales WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!current.rowCount) throw httpError(404, 'Venta no encontrada');
      const sale = current.rows[0];
      if (sale.status !== 'confirmed') throw httpError(400, 'Solo se cobran ventas confirmadas');
      const amount = money(req.body?.amount);
      if (amount <= 0) throw httpError(400, 'El importe debe ser mayor a cero');
      const inserted = await client.query(
        `INSERT INTO payments (kind, customer_id, sale_id, amount, method, paid_at, notes, created_by)
         VALUES ('in', $1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE), $6, $7)
         RETURNING *`,
        [
          sale.customer_id,
          sale.id,
          amount,
          METHODS.includes(req.body?.method) ? req.body.method : 'cash',
          req.body?.paidAt || null,
          emptyToNull(req.body?.notes),
          req.user?.id || null,
        ]
      );
      await refreshSalePaid(client, sale.id);
      return inserted.rows[0];
    });
    res.status(201).json({ data: { payment, sale: await loadSale(req.params.id) } });
  } catch (err) {
    next(err);
  }
});

// Crea una venta confirmada (descuenta stock) y registra el pago de lo que falte cobrar.
// La usan el mostrador y la entrega de encargos.
// alreadyPaid: lo que ya se cobró antes (por ejemplo, la seña de un encargo).
export async function createPaidSale(client, { customerId, items, method, notes, issuedAt, alreadyPaid = 0, user }) {
  const sale = await saveSale(client, null, { customerId, items, notes, issuedAt }, user);
  await confirmSaleStock(client, sale.id);
  const confirmed = await client.query(
    `UPDATE sales SET status = 'confirmed', updated_at = now() WHERE id = $1 RETURNING *`,
    [sale.id]
  );
  const remaining = money(Number(confirmed.rows[0].total) - Number(alreadyPaid || 0));
  if (remaining > 0) {
    await client.query(
      `INSERT INTO payments (kind, customer_id, sale_id, amount, method, paid_at, created_by)
       VALUES ('in', $1, $2, $3, $4, CURRENT_DATE, $5)`,
      [customerId || null, sale.id, remaining, METHODS.includes(method) ? method : 'cash', user?.id || null]
    );
  }
  await refreshSalePaid(client, sale.id);
  return sale.id;
}

export async function saveSale(client, id, body, user) {
  const items = await mapSaleItems(client, body.items || []);
  if (!items.length) throw httpError(400, 'Agregá al menos un producto');
  const settings = await client.query('SELECT tax_rate FROM store_settings WHERE id = 1');
  const totals = computeDocTotals(items, body.taxRate ?? settings.rows[0]?.tax_rate);
  if (id) {
    const current = await client.query('SELECT * FROM sales WHERE id = $1 FOR UPDATE', [id]);
    if (!current.rowCount) throw httpError(404, 'Venta no encontrada');
    if (current.rows[0].status !== 'draft') throw httpError(400, 'Solo se editan borradores');
    await client.query(
      `UPDATE sales
       SET customer_id = $1, issued_at = $2, notes = $3, subtotal = $4, tax = $5, total = $6, updated_at = now()
       WHERE id = $7`,
      [
        body.customerId || null,
        body.issuedAt || current.rows[0].issued_at,
        emptyToNull(body.notes),
        totals.subtotal,
        totals.tax,
        totals.total,
        id,
      ]
    );
    await client.query('DELETE FROM sale_items WHERE sale_id = $1', [id]);
    await insertSaleItems(client, id, items);
    return current.rows[0];
  }
  const number = await nextNumber(client, 'sales', 'V');
  const inserted = await client.query(
    `INSERT INTO sales (number, customer_id, issued_at, notes, subtotal, tax, total, created_by)
     VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      number,
      body.customerId || null,
      body.issuedAt || null,
      emptyToNull(body.notes),
      totals.subtotal,
      totals.tax,
      totals.total,
      user?.id || null,
    ]
  );
  await insertSaleItems(client, inserted.rows[0].id, items);
  return inserted.rows[0];
}

async function mapSaleItems(client, items) {
  const mapped = [];
  for (const item of items) {
    const product = await client.query('SELECT * FROM products WHERE id = $1', [item.productId]);
    if (!product.rowCount) throw httpError(400, 'Producto inválido');
    const quantity = qty(item.qty);
    const unitPrice = money(item.unitPrice ?? product.rows[0].sale_price);
    if (quantity <= 0) throw httpError(400, 'La cantidad debe ser mayor a cero');
    mapped.push({
      product_id: product.rows[0].id,
      description: item.description || product.rows[0].name,
      qty: quantity,
      unit_price: unitPrice,
      cost_price: money(product.rows[0].cost_price),
      line_total: money(quantity * unitPrice),
    });
  }
  return mapped;
}

async function insertSaleItems(client, saleId, items) {
  for (const item of items) {
    await client.query(
      `INSERT INTO sale_items (sale_id, product_id, description, qty, unit_price, cost_price, line_total)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [saleId, item.product_id, item.description, item.qty, item.unit_price, item.cost_price, item.line_total]
    );
  }
}

export async function loadSale(id) {
  const result = await query(`${SALE_SELECT} WHERE s.id = $1`, [id]);
  if (!result.rowCount) return null;
  const items = await query(
    `SELECT i.*, p.sku, p.unit, p.stock_qty
     FROM sale_items i
     JOIN products p ON p.id = i.product_id
     WHERE i.sale_id = $1
     ORDER BY i.id`,
    [id]
  );
  const payments = await query('SELECT * FROM payments WHERE sale_id = $1 ORDER BY paid_at, id', [id]);
  return { ...result.rows[0], items: items.rows, payments: payments.rows };
}

export default router;
