// Clientes y proveedores (comparten la misma estructura).
import { Router } from 'express';
import { query } from '../db/pool.js';
import { emptyToNull, httpError } from '../lib/helpers.js';

export function partyRouter(table) {
  const router = Router();
  const isCustomers = table === 'customers';
  const label = isCustomers ? 'Cliente' : 'Proveedor';
  const fk = isCustomers ? 'customer_id' : 'supplier_id';
  const docs = isCustomers ? 'sales' : 'purchases';
  // Saldo de cuenta corriente: lo vendido/comprado confirmado que falta cobrar/pagar
  const balanceSql = `COALESCE((SELECT SUM(s.total - s.paid) FROM ${docs} s WHERE s.${fk} = p.id AND s.status = 'confirmed'), 0)`;
  // Para clientes: próximo encargo abierto y última compra
  const extraSql = isCustomers
    ? `,
       (SELECT MIN(o.due_date) FROM orders o WHERE o.customer_id = p.id AND o.status IN ('pending', 'ready')) AS next_order,
       (SELECT MAX(s.issued_at) FROM sales s WHERE s.customer_id = p.id AND s.status = 'confirmed') AS last_purchase`
    : '';

  router.get('/', async (req, res, next) => {
    try {
      const q = String(req.query.q || '').trim();
      const params = [];
      let sql = `SELECT p.*, ${balanceSql} AS balance${extraSql} FROM ${table} p`;
      if (q) {
        params.push(`%${q}%`);
        sql += ` WHERE p.name ILIKE $1 OR COALESCE(p.tax_id, '') ILIKE $1 OR COALESCE(p.phone, '') ILIKE $1`;
      }
      sql += ' ORDER BY p.name';
      const result = await query(sql, params);
      res.json({ data: result.rows });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const result = await query(`SELECT p.*, ${balanceSql} AS balance${extraSql} FROM ${table} p WHERE p.id = $1`, [
        req.params.id,
      ]);
      if (!result.rowCount) return res.status(404).json({ error: `${label} no encontrado` });
      const [documents, payments, orders] = await Promise.all([
        query(
          `SELECT id, number, issued_at, status, total, paid FROM ${docs}
           WHERE ${fk} = $1 ORDER BY issued_at DESC, id DESC LIMIT 80`,
          [req.params.id]
        ),
        query(`SELECT * FROM payments WHERE ${fk} = $1 ORDER BY paid_at DESC, id DESC LIMIT 80`, [req.params.id]),
        isCustomers
          ? query(
              `SELECT id, number, due_date, to_char(due_time, 'HH24:MI') AS due_hhmm, status, total
               FROM orders WHERE customer_id = $1 ORDER BY due_date DESC, id DESC LIMIT 50`,
              [req.params.id]
            )
          : null,
      ]);
      res.json({
        data: { ...result.rows[0], documents: documents.rows, payments: payments.rows, orders: orders?.rows || [] },
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      res.status(201).json({ data: await saveParty(table, label, null, req.body) });
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      res.json({ data: await saveParty(table, label, req.params.id, req.body) });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

async function saveParty(table, label, id, body = {}) {
  const name = String(body.name || '').trim();
  if (!name) throw httpError(400, 'El nombre es obligatorio');
  const cols = ['name', 'tax_id', 'phone', 'email', 'address', 'notes'];
  const values = [
    name,
    emptyToNull(body.taxId),
    emptyToNull(body.phone),
    emptyToNull(body.email),
    emptyToNull(body.address),
    emptyToNull(body.notes),
  ];
  // Los clientes guardan también el cumpleaños
  if (table === 'customers') {
    cols.push('birthday');
    values.push(emptyToNull(body.birthday));
  }
  if (id) {
    const sets = cols.map((col, i) => `${col} = $${i + 1}`).join(', ');
    const result = await query(`UPDATE ${table} SET ${sets} WHERE id = $${cols.length + 1} RETURNING *`, [...values, id]);
    if (!result.rowCount) throw httpError(404, `${label} no encontrado`);
    return result.rows[0];
  }
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const result = await query(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`, values);
  return result.rows[0];
}
