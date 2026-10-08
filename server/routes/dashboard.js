// Resumen de la página de inicio de Pan Comido.
import { Router } from 'express';
import { query } from '../db/pool.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    // El navegador manda su fecha local (?today=AAAA-MM-DD) para que "hoy" sea el día
    // del negocio y no el del servidor (que suele estar en hora UTC).
    const today = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.today || '')) ? req.query.today : null;
    const day = 'COALESCE($1::date, CURRENT_DATE)';

    const [cash, todaySales, month, orders, toBake, toBuy, top] = await Promise.all([
      // Caja del día: lo cobrado hoy por medio de pago (incluye señas)
      query(
        `SELECT method, SUM(amount)::numeric AS total FROM payments
         WHERE kind = 'in' AND paid_at = ${day} GROUP BY method ORDER BY total DESC`,
        [today]
      ),
      // Ventas de hoy
      query(
        `SELECT COALESCE(SUM(total), 0)::numeric AS total, COUNT(*)::int AS count
         FROM sales WHERE status = 'confirmed' AND issued_at = ${day}`,
        [today]
      ),
      // Ventas del mes y ganancia estimada (precio - costo de cada ítem)
      query(
        `SELECT COALESCE(SUM(s.total), 0)::numeric AS total, COUNT(DISTINCT s.id)::int AS count,
                COALESCE(SUM(i.line_total - i.qty * i.cost_price), 0)::numeric AS margin
         FROM sales s
         LEFT JOIN sale_items i ON i.sale_id = s.id
         WHERE s.status = 'confirmed' AND s.issued_at >= date_trunc('month', ${day}) AND s.issued_at <= ${day}`,
        [today]
      ),
      // Encargos abiertos de hoy y mañana (y atrasados)
      query(
        `SELECT o.id, o.number, o.due_date, to_char(o.due_time, 'HH24:MI') AS due_hhmm, o.status, o.fulfillment,
                o.total, COALESCE(c.name, o.customer_name) AS customer,
                COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id), 0)::numeric AS deposit,
                (SELECT string_agg(trim(to_char(oi.qty, 'FM999999990.###')) || ' ' || oi.description, ', ' ORDER BY oi.id)
                 FROM order_items oi WHERE oi.order_id = o.id) AS summary
         FROM orders o
         LEFT JOIN customers c ON c.id = o.customer_id
         WHERE o.status IN ('pending', 'ready') AND o.due_date <= ${day} + 1
         ORDER BY o.due_date, o.due_time NULLS LAST`,
        [today]
      ),
      // Qué hornear (hoy y mañana): encargos + stock crítico - stock actual
      query(
        `SELECT p.id, p.name, p.unit, p.stock_qty, p.min_stock, COALESCE(o.ordered, 0) AS ordered
         FROM products p
         LEFT JOIN LATERAL (
           SELECT SUM(oi.qty) AS ordered FROM order_items oi JOIN orders o ON o.id = oi.order_id
           WHERE oi.product_id = p.id AND o.status IN ('pending', 'ready') AND o.due_date <= ${day} + 1
         ) o ON true
         WHERE p.kind = 'product' AND p.active = true
           AND COALESCE(o.ordered, 0) + p.min_stock - p.stock_qty > 0
         ORDER BY p.name`,
        [today]
      ),
      // Para comprar: ingredientes y productos sin receta en su stock crítico
      query(
        `SELECT p.id, p.name, p.unit, p.stock_qty, p.min_stock, p.kind
         FROM products p
         WHERE p.active = true AND p.kind IN ('product', 'ingredient') AND p.min_stock > 0 AND p.stock_qty <= p.min_stock
           AND NOT EXISTS (SELECT 1 FROM recipe_items r WHERE r.product_id = p.id)
         ORDER BY p.name LIMIT 12`
      ),
      // Lo más vendido del mes
      query(
        `SELECT i.product_id, i.description AS name, SUM(i.qty)::numeric AS qty, SUM(i.line_total)::numeric AS total
         FROM sale_items i
         JOIN sales s ON s.id = i.sale_id
         JOIN products p ON p.id = i.product_id
         WHERE s.status = 'confirmed' AND p.kind = 'product'
           AND s.issued_at >= date_trunc('month', ${day}) AND s.issued_at <= ${day}
         GROUP BY i.product_id, i.description
         ORDER BY SUM(i.qty) DESC
         LIMIT 5`,
        [today]
      ),
    ]);

    res.json({
      data: {
        cashToday: cash.rows,
        todaySales: todaySales.rows[0],
        month: month.rows[0],
        orders: orders.rows,
        toBake: toBake.rows.map((row) => ({
          ...row,
          to_make: Math.ceil(Number(row.ordered) + Number(row.min_stock) - Number(row.stock_qty)),
        })),
        toBuy: toBuy.rows,
        topProducts: top.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
