import { httpError, money, qty } from './helpers.js';
import { refreshCostsUsingIngredient } from './recipes.js';

// Suma o resta stock de un producto o ingrediente y deja el movimiento en el historial.
// allowNegative: permite quedar en negativo (se usa al descontar ingredientes en producción,
// para no frenar el trabajo si todavía no se cargó el stock de materia prima).
export async function applyStock(client, { productId, kind, delta, unitCost, refType, refId, notes, allowNegative = false }) {
  const change = qty(delta);
  if (!change) return;
  const product = await client.query('SELECT id, name, stock_qty, kind FROM products WHERE id = $1 FOR UPDATE', [
    productId,
  ]);
  if (!product.rowCount) throw httpError(404, 'Producto no encontrado');
  // Los ítems sin stock (por ejemplo, el envío) no mueven inventario
  if (product.rows[0].kind === 'service') return;
  const next = qty(Number(product.rows[0].stock_qty) + change);
  if (next < 0 && !allowNegative) {
    throw httpError(
      400,
      `No alcanza el stock de ${product.rows[0].name} (hay ${Number(product.rows[0].stock_qty)}). Registrá la producción o ajustá el stock.`
    );
  }
  await client.query('UPDATE products SET stock_qty = $1, updated_at = now() WHERE id = $2', [next, productId]);
  await client.query(
    `INSERT INTO stock_movements (product_id, kind, qty, unit_cost, ref_type, ref_id, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [productId, kind, change, unitCost ?? null, refType || null, refId || null, notes || null]
  );
}

export async function confirmSaleStock(client, saleId) {
  const items = await client.query('SELECT * FROM sale_items WHERE sale_id = $1', [saleId]);
  for (const item of items.rows) {
    await applyStock(client, {
      productId: item.product_id,
      kind: 'sale',
      delta: -Number(item.qty),
      unitCost: item.cost_price,
      refType: 'sale',
      refId: saleId,
    });
  }
}

export async function reverseSaleStock(client, saleId) {
  const items = await client.query('SELECT * FROM sale_items WHERE sale_id = $1', [saleId]);
  for (const item of items.rows) {
    await applyStock(client, {
      productId: item.product_id,
      kind: 'adjustment',
      delta: Number(item.qty),
      unitCost: item.cost_price,
      refType: 'sale',
      refId: saleId,
      notes: 'Reverso por cancelación de venta',
    });
  }
}

export async function confirmPurchaseStock(client, purchaseId, updateCosts) {
  const items = await client.query('SELECT * FROM purchase_items WHERE purchase_id = $1', [purchaseId]);
  for (const item of items.rows) {
    await applyStock(client, {
      productId: item.product_id,
      kind: 'purchase',
      delta: Number(item.qty),
      unitCost: item.unit_cost,
      refType: 'purchase',
      refId: purchaseId,
    });
    if (updateCosts) {
      await client.query('UPDATE products SET cost_price = $1, updated_at = now() WHERE id = $2', [
        money(item.unit_cost),
        item.product_id,
      ]);
      // Si es un ingrediente, se recalcula el costo de las recetas que lo usan
      await refreshCostsUsingIngredient(client, item.product_id);
    }
  }
}

export async function deleteSaleRecord(client, id) {
  const current = await client.query('SELECT * FROM sales WHERE id = $1 FOR UPDATE', [id]);
  if (!current.rowCount) throw httpError(404, 'Venta no encontrada');
  const sale = current.rows[0];
  if (sale.status === 'confirmed') await reverseSaleStock(client, sale.id);
  // Si la venta vino de un encargo: la seña vuelve a quedar en el encargo y este pasa a "listo"
  await client.query('UPDATE payments SET sale_id = NULL WHERE sale_id = $1 AND order_id IS NOT NULL', [sale.id]);
  await client.query(`UPDATE orders SET status = 'ready', sale_id = NULL, updated_at = now() WHERE sale_id = $1`, [sale.id]);
  await client.query('DELETE FROM payments WHERE sale_id = $1', [sale.id]);
  await client.query(`DELETE FROM stock_movements WHERE ref_type = 'sale' AND ref_id = $1`, [sale.id]);
  await client.query('DELETE FROM sales WHERE id = $1', [sale.id]);
}

export async function deletePurchaseRecord(client, id) {
  const current = await client.query('SELECT * FROM purchases WHERE id = $1 FOR UPDATE', [id]);
  if (!current.rowCount) throw httpError(404, 'Compra no encontrada');
  const purchase = current.rows[0];
  if (purchase.status === 'confirmed') await reversePurchaseStock(client, purchase.id);
  await client.query('DELETE FROM payments WHERE purchase_id = $1', [purchase.id]);
  await client.query(`DELETE FROM stock_movements WHERE ref_type = 'purchase' AND ref_id = $1`, [purchase.id]);
  await client.query('DELETE FROM purchases WHERE id = $1', [purchase.id]);
}

export async function reversePurchaseStock(client, purchaseId) {
  const items = await client.query('SELECT * FROM purchase_items WHERE purchase_id = $1', [purchaseId]);
  for (const item of items.rows) {
    await applyStock(client, {
      productId: item.product_id,
      kind: 'adjustment',
      delta: -Number(item.qty),
      unitCost: item.unit_cost,
      refType: 'purchase',
      refId: purchaseId,
      notes: 'Reverso por cancelación de compra',
    });
  }
}

export async function refreshSalePaid(client, saleId) {
  const result = await client.query(
    `UPDATE sales
     SET paid = COALESCE((SELECT SUM(amount) FROM payments WHERE sale_id = $1), 0),
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [saleId]
  );
  return result.rows[0];
}

export async function refreshPurchasePaid(client, purchaseId) {
  const result = await client.query(
    `UPDATE purchases
     SET paid = COALESCE((SELECT SUM(amount) FROM payments WHERE purchase_id = $1), 0),
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [purchaseId]
  );
  return result.rows[0];
}
