import { money, qty, recipeQty } from '../format';
import { esc, printHtml } from './ticket';

// Ficha de receta para imprimir o guardar como PDF: ingredientes, rinde,
// costos y el procedimiento.
export function printRecipe({ product, storeName, currency }) {
  const recipe = product.recipe || {};
  const items = recipe.items || [];
  const rows = items
    .map(
      (item) => `<tr>
        <td>${esc(item.name)}</td>
        <td class="r">${esc(recipeQty(item.qty, item.unit))}</td>
        <td class="r muted">${esc(money(item.line_cost, currency))}</td>
      </tr>`
    )
    .join('');
  const notes = recipe.notes
    ? `<div class="notes">${esc(recipe.notes)}</div>`
    : '<p class="muted">Sin procedimiento cargado.</p>';

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Receta ${esc(product.name)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Georgia, 'Times New Roman', serif; margin: 0; color: #222; }
    .sheet { max-width: 180mm; margin: 0 auto; padding: 14mm 12mm; }
    .store { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #777; margin: 0; }
    h1 { font-size: 26px; margin: 4px 0 2px; }
    .sub { font-size: 13px; color: #555; margin: 0 0 18px; }
    h2 { font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: #8a5a2b;
         border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 20px 0 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    td { padding: 5px 0; border-bottom: 1px dotted #ddd; vertical-align: top; }
    .r { text-align: right; white-space: nowrap; padding-left: 12px; }
    .muted { color: #888; font-size: 12px; }
    .costs { display: flex; gap: 24px; font-size: 14px; margin-top: 10px; }
    .costs b { display: block; font-size: 16px; }
    .notes { white-space: pre-wrap; font-size: 14px; line-height: 1.55; }
    .foot { margin-top: 24px; font-size: 11px; color: #999; }
    @page { margin: 10mm; }
    @media print { .sheet { padding: 0; } }
  </style>
</head>
<body>
  <div class="sheet">
    ${storeName ? `<p class="store">${esc(storeName)}</p>` : ''}
    <h1>${esc(product.name)}</h1>
    <p class="sub">Rinde ${esc(qty(recipe.yield || 0))} ${esc(product.unit || 'un')} por tanda</p>

    <h2>Ingredientes</h2>
    ${items.length ? `<table>${rows}</table>` : '<p class="muted">Sin ingredientes cargados.</p>'}
    <div class="costs">
      <div><span class="muted">Costo de la tanda</span><b>${esc(money(recipe.batchCost || 0, currency))}</b></div>
      ${recipe.unitCost != null ? `<div><span class="muted">Costo por unidad</span><b>${esc(money(recipe.unitCost, currency))}</b></div>` : ''}
    </div>

    <h2>Procedimiento</h2>
    ${notes}

    <p class="foot">Ficha generada el ${esc(new Date().toLocaleDateString('es-AR'))}</p>
  </div>
</body>
</html>`;

  printHtml(html, `Receta ${product.name}`);
}
