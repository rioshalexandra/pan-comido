// Encargos: pedidos de clientes con fecha de entrega o retiro, seña y envío.
// Al entregar se genera la venta (descuenta stock) y se cobra lo que falta.
import { Router } from 'express';
import { query, withTransaction } from '../db/pool.js';
import { emptyToNull, httpError, money, qty } from '../lib/helpers.js';
import { createPaidSale, loadSale, METHODS } from './sales.js';

const router = Router();

const STATUSES = ['pending', 'ready', 'delivered', 'cancelled'];
const SHIPPING_SKU = 'ENVIO'; // ítem interno (sin stock) para cobrar el envío

const ORDER_SELECT = `
  SELECT o.*,
         to_char(o.due_time, 'HH24:MI') AS due_hhmm,
         COALESCE(c.name, o.customer_name) AS display_customer,
         COALESCE(o.phone, c.phone) AS display_phone,
         COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id), 0)::numeric AS deposit,
         s.number AS sale_number
  FROM orders o
  LEFT JOIN customers c ON c.id = o.customer_id
  LEFT JOIN sales s ON s.id = o.sale_id
`;

// Lista: ?from=&to= (fechas de entrega) ?status=pending|ready|delivered|cancelled|open
router.get('/', async (req, res, next) => {
  try {
    const params = [];
    const where = [];
    if (req.query.from) {
      params.push(req.query.from);
      where.push(`o.due_date >= $${params.length}`);
    }
    if (req.query.to) {
      params.push(req.query.to);
      where.push(`o.due_date <= $${params.length}`);
    }
    if (req.query.status === 'open') where.push(`o.status IN ('pending', 'ready')`);
    else if (STATUSES.includes(req.query.status)) {
      params.push(req.query.status);
      where.push(`o.status = $${params.length}`);
    }
    if (req.query.customerId) {
      params.push(Number(req.query.customerId));
      where.push(`o.customer_id = $${params.length}`);
    }
    const order = req.query.status === 'delivered' ? 'DESC' : 'ASC';
    const result = await query(
      `${ORDER_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY o.due_date ${order}, o.due_time ${order} NULLS LAST, o.id
       LIMIT 300`,
      params
    );
    // Se agregan los ítems de cada encargo para mostrarlos en la lista
    const ids = result.rows.map((row) => row.id);
    const items = ids.length
      ? await query(`SELECT * FROM order_items WHERE order_id = ANY($1::int[]) ORDER BY id`, [ids])
      : { rows: [] };
    const data = result.rows.map((row) => ({ ...row, items: items.rows.filter((item) => item.order_id === row.id) }));
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const order = await loadOrder(req.params.id);
    if (!order) return res.status(404).json({ error: 'Encargo no encontrado' });
    res.json({ data: order });
  } catch (err) {
    next(err);
  }
});

// Nuevo encargo. Si viene { deposit: { amount, method } } se registra la seña.
router.post('/', async (req, res, next) => {
  try {
    const id = await withTransaction(async (client) => {
      const orderId = await saveOrder(client, null, req.body, req.user);
      const amount = money(req.body?.deposit?.amount);
      if (amount > 0) await addDeposit(client, orderId, amount, req.body.deposit.method, req.user);
      return orderId;
    });
    res.status(201).json({ data: await loadOrder(id) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    await withTransaction((client) => saveOrder(client, req.params.id, req.body, req.user));
    res.json({ data: await loadOrder(req.params.id) });
  } catch (err) {
    next(err);
  }
});

// Cambiar estado: pendiente / listo / cancelado (la entrega se hace con /deliver)
router.post('/:id/status', async (req, res, next) => {
  try {
    const status = String(req.body?.status || '');
    if (!['pending', 'ready', 'cancelled'].includes(status)) throw httpError(400, 'Estado inválido');
    const current = await query('SELECT status FROM orders WHERE id = $1', [req.params.id]);
    if (!current.rowCount) throw httpError(404, 'Encargo no encontrado');
    if (current.rows[0].status === 'delivered') throw httpError(400, 'El encargo ya fue entregado');
    await query('UPDATE orders SET status = $1, updated_at = now() WHERE id = $2', [status, req.params.id]);
    res.json({ data: await loadOrder(req.params.id) });
  } catch (err) {
    next(err);
  }
});

// Registrar una seña (o un pago adelantado más)
router.post('/:id/deposit', async (req, res, next) => {
  try {
    await withTransaction(async (client) => {
      const current = await client.query('SELECT status FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!current.rowCount) throw httpError(404, 'Encargo no encontrado');
      if (current.rows[0].status === 'delivered') throw httpError(400, 'El encargo ya fue entregado');
      const amount = money(req.body?.amount);
      if (amount <= 0) throw httpError(400, 'El importe debe ser mayor a cero');
      await addDeposit(client, req.params.id, amount, req.body?.method, req.user);
    });
    res.json({ data: await loadOrder(req.params.id) });
  } catch (err) {
    next(err);
  }
});

// Entregar: crea la venta (descuenta stock), le asigna la seña y cobra el saldo con { method }
router.post('/:id/deliver', async (req, res, next) => {
  try {
    const saleId = await withTransaction(async (client) => {
      const current = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!current.rowCount) throw httpError(404, 'Encargo no encontrado');
      const order = current.rows[0];
      if (order.status === 'delivered') throw httpError(400, 'El encargo ya fue entregado');
      if (order.status === 'cancelled') throw httpError(400, 'El encargo está cancelado');

      const lines = await client.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [order.id]);
      const items = lines.rows.map((row) => ({
        productId: row.product_id,
        qty: Number(row.qty),
        unitPrice: Number(row.unit_price),
        description: row.description,
      }));
      if (Number(order.shipping_cost) > 0) {
        const shipping = await shippingProduct(client);
        items.push({ productId: shipping, qty: 1, unitPrice: Number(order.shipping_cost), description: 'Envío' });
      }
      const deposits = await client.query('SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE order_id = $1', [
        order.id,
      ]);
      const sale = await createPaidSale(client, {
        customerId: order.customer_id,
        items,
        method: req.body?.method,
        notes: `Encargo ${order.number}`,
        alreadyPaid: Number(deposits.rows[0].total),
        user: req.user,
      });
      // La seña pasa a formar parte de la venta
      await client.query('UPDATE payments SET sale_id = $1 WHERE order_id = $2', [sale, order.id]);
      await client.query(
        `UPDATE sales SET paid = COALESCE((SELECT SUM(amount) FROM payments WHERE sale_id = $1), 0) WHERE id = $1`,
        [sale]
      );
      await client.query(`UPDATE orders SET status = 'delivered', sale_id = $1, updated_at = now() WHERE id = $2`, [
        sale,
        order.id,
      ]);
      return sale;
    });
    res.json({ data: { order: await loadOrder(req.params.id), sale: await loadSale(saleId) } });
  } catch (err) {
    next(err);
  }
});

// Borrar un encargo que no se entregó. Las señas registradas se borran con él.
router.delete('/:id', async (req, res, next) => {
  try {
    await withTransaction(async (client) => {
      const current = await client.query('SELECT status FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!current.rowCount) throw httpError(404, 'Encargo no encontrado');
      if (current.rows[0].status === 'delivered') {
        throw httpError(400, 'Un encargo entregado no se borra: ya tiene su venta. Si hace falta, cancelá la venta.');
      }
      await client.query('DELETE FROM payments WHERE order_id = $1 AND sale_id IS NULL', [req.params.id]);
      await client.query('DELETE FROM orders WHERE id = $1', [req.params.id]);
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------- Funciones internas ----------

async function saveOrder(client, id, body = {}, user) {
  const dueDate = String(body.dueDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw httpError(400, 'Elegí la fecha de entrega');
  const dueTime = /^\d{2}:\d{2}$/.test(String(body.dueTime || '')) ? body.dueTime : null;
  const customerId = body.customerId ? Number(body.customerId) : null;
  const customerName = emptyToNull(body.customerName);
  if (!customerId && !customerName) throw httpError(400, 'Indicá el cliente');
  const fulfillment = body.fulfillment === 'delivery' ? 'delivery' : 'pickup';
  const address = emptyToNull(body.address);
  if (fulfillment === 'delivery' && !address) throw httpError(400, 'Para un envío, cargá la dirección');
  const shippingCost = fulfillment === 'delivery' ? money(body.shippingCost) : 0;

  // Ítems del encargo con el precio de lista por defecto
  const items = [];
  for (const item of body.items || []) {
    const product = await client.query(`SELECT id, name, sale_price FROM products WHERE id = $1 AND kind = 'product'`, [
      item.productId,
    ]);
    if (!product.rowCount) throw httpError(400, 'Producto inválido');
    const quantity = qty(item.qty);
    if (quantity <= 0) continue;
    const unitPrice = money(item.unitPrice ?? product.rows[0].sale_price);
    items.push({ productId: product.rows[0].id, description: product.rows[0].name, qty: quantity, unitPrice });
  }
  if (!items.length) throw httpError(400, 'Agregá al menos un producto');
  const subtotal = money(items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0));
  const total = money(subtotal + shippingCost);

  const values = [
    customerId,
    customerName,
    emptyToNull(body.phone),
    dueDate,
    dueTime,
    fulfillment,
    fulfillment === 'delivery' ? address : null,
    shippingCost,
    emptyToNull(body.notes),
    subtotal,
    total,
  ];

  let orderId = id;
  if (id) {
    const current = await client.query('SELECT status FROM orders WHERE id = $1 FOR UPDATE', [id]);
    if (!current.rowCount) throw httpError(404, 'Encargo no encontrado');
    if (current.rows[0].status === 'delivered') throw httpError(400, 'Un encargo entregado no se puede editar');
    await client.query(
      `UPDATE orders
       SET customer_id = $1, customer_name = $2, phone = $3, due_date = $4, due_time = $5, fulfillment = $6,
           address = $7, shipping_cost = $8, notes = $9, subtotal = $10, total = $11, updated_at = now()
       WHERE id = $12`,
      [...values, id]
    );
    await client.query('DELETE FROM order_items WHERE order_id = $1', [id]);
  } else {
    const number = await nextOrderNumber(client);
    const inserted = await client.query(
      `INSERT INTO orders
         (customer_id, customer_name, phone, due_date, due_time, fulfillment, address, shipping_cost, notes,
          subtotal, total, number, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [...values, number, user?.id || null]
    );
    orderId = inserted.rows[0].id;
  }
  for (const item of items) {
    await client.query(
      `INSERT INTO order_items (order_id, product_id, description, qty, unit_price, line_total)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [orderId, item.productId, item.description, item.qty, item.unitPrice, money(item.qty * item.unitPrice)]
    );
  }
  return orderId;
}

async function addDeposit(client, orderId, amount, method, user) {
  const order = await client.query('SELECT customer_id FROM orders WHERE id = $1', [orderId]);
  await client.query(
    `INSERT INTO payments (kind, customer_id, order_id, amount, method, paid_at, notes, created_by)
     VALUES ('in', $1, $2, $3, $4, CURRENT_DATE, 'Seña de encargo', $5)`,
    [order.rows[0]?.customer_id || null, orderId, amount, METHODS.includes(method) ? method : 'cash', user?.id || null]
  );
}

// Número correlativo E-00001, E-00002…
async function nextOrderNumber(client) {
  const result = await client.query(`SELECT number FROM orders WHERE number LIKE 'E-%' ORDER BY id DESC LIMIT 1`);
  const last = result.rows[0]?.number;
  const n = last ? Number(String(last).split('-').pop()) + 1 : 1;
  return `E-${String(n).padStart(5, '0')}`;
}

// Ítem interno "Envío" (sin stock): se crea la primera vez que hace falta
async function shippingProduct(client) {
  const found = await client.query('SELECT id FROM products WHERE sku = $1', [SHIPPING_SKU]);
  if (found.rowCount) return found.rows[0].id;
  const created = await client.query(
    `INSERT INTO products (sku, name, kind, unit, active) VALUES ($1, 'Envío', 'service', 'un', false) RETURNING id`,
    [SHIPPING_SKU]
  );
  return created.rows[0].id;
}

async function loadOrder(id) {
  const result = await query(`${ORDER_SELECT} WHERE o.id = $1`, [id]);
  if (!result.rowCount) return null;
  const items = await query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [id]);
  const payments = await query('SELECT * FROM payments WHERE order_id = $1 ORDER BY paid_at, id', [id]);
  return { ...result.rows[0], items: items.rows, payments: payments.rows };
}

export default router;
