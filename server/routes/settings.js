import { Router } from 'express';
import { query } from '../db/pool.js';


const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const result = await query('SELECT * FROM store_settings WHERE id = 1');
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const current = await query('SELECT * FROM store_settings WHERE id = 1');
    const prev = current.rows[0];
    const {
      name = prev.name,
      timezone = prev.timezone,
      currency = prev.currency,
      taxRate = prev.tax_rate,
    } = req.body || {};
    const result = await query(
      `UPDATE store_settings
       SET name = $1, timezone = $2, currency = $3, tax_rate = $4, updated_at = now()
       WHERE id = 1
       RETURNING *`,
      [name, timezone, currency, taxRate]
    );
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
