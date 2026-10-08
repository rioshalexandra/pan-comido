import { Router } from 'express';
import { query } from '../db/pool.js';

const router = Router();

const KINDS = new Set(['sale', 'purchase', 'manual', 'adjustment', 'import']);

router.get('/', async (req, res, next) => {
  try {
    const params = [];
    const where = [];
    if (req.query.kind && KINDS.has(String(req.query.kind))) {
      params.push(req.query.kind);
      where.push(`m.kind = $${params.length}`);
    }
    if (req.query.productId) {
      params.push(Number(req.query.productId));
      where.push(`m.product_id = $${params.length}`);
    }
    if (req.query.from) {
      params.push(req.query.from);
      where.push(`m.created_at >= $${params.length}::date`);
    }
    if (req.query.to) {
      params.push(req.query.to);
      where.push(`m.created_at < ($${params.length}::date + interval '1 day')`);
    }
    if (req.query.q) {
      params.push(`%${String(req.query.q).trim()}%`);
      where.push(
        `(pr.name ILIKE $${params.length} OR pr.sku ILIKE $${params.length} OR COALESCE(m.notes, '') ILIKE $${params.length} OR COALESCE(sa.number, '') ILIKE $${params.length} OR COALESCE(pu.number, '') ILIKE $${params.length})`
      );
    }
    const sql = `
      SELECT m.id, m.product_id, m.kind, m.qty, m.unit_cost, m.ref_type, m.ref_id, m.notes, m.created_at,
             pr.name AS product_name, pr.sku, pr.unit,
             sa.id AS sale_id, sa.number AS sale_number,
             pu.id AS purchase_id, pu.number AS purchase_number
      FROM stock_movements m
      JOIN products pr ON pr.id = m.product_id
      LEFT JOIN sales sa ON m.ref_type = 'sale' AND sa.id = m.ref_id
      LEFT JOIN purchases pu ON m.ref_type = 'purchase' AND pu.id = m.ref_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT 400
    `;
    const result = await query(sql, params);
    const totals = result.rows.reduce(
      (acc, row) => {
        const amount = Number(row.qty);
        if (amount > 0) acc.in += amount;
        else acc.out += amount;
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
