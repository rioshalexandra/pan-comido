// Recetas: costo por unidad y consumo de ingredientes.
import { money } from './helpers.js';

// Devuelve la receta de un producto con el costo actual de cada ingrediente.
// unitCost = costo total de la tanda / rinde.
export async function loadRecipe(client, productId) {
  const product = await client.query('SELECT id, recipe_yield, recipe_notes FROM products WHERE id = $1', [productId]);
  const items = await client.query(
    `SELECT r.id, r.ingredient_id, r.qty, i.name, i.unit, i.cost_price, i.stock_qty,
            ROUND(r.qty * i.cost_price, 2) AS line_cost
     FROM recipe_items r
     JOIN products i ON i.id = r.ingredient_id
     WHERE r.product_id = $1
     ORDER BY i.name`,
    [productId]
  );
  const yieldQty = Number(product.rows[0]?.recipe_yield || 0);
  const batchCost = items.rows.reduce((sum, row) => sum + Number(row.qty) * Number(row.cost_price), 0);
  return {
    yield: yieldQty || null,
    notes: product.rows[0]?.recipe_notes || '',
    items: items.rows,
    batchCost: money(batchCost),
    unitCost: yieldQty > 0 ? money(batchCost / yieldQty) : null,
  };
}

// Recalcula el costo de un producto a partir de su receta (si tiene) y lo guarda.
export async function refreshRecipeCost(client, productId) {
  const recipe = await loadRecipe(client, productId);
  if (recipe.unitCost != null && recipe.items.length) {
    await client.query('UPDATE products SET cost_price = $1, updated_at = now() WHERE id = $2', [
      recipe.unitCost,
      productId,
    ]);
  }
  return recipe;
}

// Cuando cambia el costo de un ingrediente, actualiza el costo de los productos que lo usan
export async function refreshCostsUsingIngredient(client, ingredientId) {
  const users = await client.query('SELECT DISTINCT product_id FROM recipe_items WHERE ingredient_id = $1', [
    ingredientId,
  ]);
  for (const row of users.rows) await refreshRecipeCost(client, row.product_id);
}
