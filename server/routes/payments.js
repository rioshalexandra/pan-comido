import { Router } from 'express';
import { query } from '../db/pool.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const params = [];
    const where = [];
    if (req.query.kind) {
      params.push(req.query.kind);
      where.push(`p.kind = $${params.length}`);
    }
    if (req.query.method) {
      params.push(req.query.method);
      where.push(`p.method = $${params.length}`);
    }
    if (req.query.from) {
      params.push(req.query.from);
      where.push(`p.paid_at >= $${params.length}`);
    }
    if (req.query.to) {
      params.push(req.query.to);
      where.push(`p.paid_at <= $${params.length}`);
    }
    if (req.query.q) {
      params.push(`%${String(req.query.q).trim()}%`);
      where.push(
        `(COALESCE(c.name, '') ILIKE $${params.length} OR COALESCE(s.name, '') ILIKE $${params.length} OR COALESCE(sa.number, '') ILIKE $${params.length} OR COALESCE(pu.number, '') ILIKE $${params.length} OR COALESCE(p.notes, '') ILIKE $${params.length})`
      );
    }
    const sql = `
      SELECT p.*,
             c.name AS customer_name,
             s.name AS supplier_name,
             sa.number AS sale_number,
             pu.number AS purchase_number
      FROM payments p
      LEFT JOIN customers c ON c.id = p.customer_id
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN sales sa ON sa.id = p.sale_id
      LEFT JOIN purchases pu ON pu.id = p.purchase_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY p.paid_at DESC, p.id DESC
      LIMIT 300
    `;
    const result = await query(sql, params);
    const totals = result.rows.reduce(
      (acc, row) => {
        if (row.kind === 'in') acc.in += Number(row.amount);
        else acc.out += Number(row.amount);
        return acc;
      },
      { in: 0, out: 0 }
    );
    res.json({ data: result.rows, totals });
  } catch (err) {
    next(err);
  }
});

export default router;
