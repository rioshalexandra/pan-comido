// Ficha de receta para imprimir o "Guardar como PDF"
import { money } from './format';
import { number, qtyText, unitCost } from './units';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

export function printRecipe(recipe, costs, businessName) {
  const rows = recipe.items
    .map(
      (i) => `<tr><td>${esc(i.name)}${i.is_packaging ? ' <small>(packaging)</small>' : ''}</td>
        <td class="r">${esc(qtyText(i.qty, i.unit))}</td><td class="r m">${esc(money(i.qty * unitCost(i)))}</td></tr>`
    )
    .join('');
  const times = [
    costs.workMinutes ? `${number(costs.workMinutes)} min de trabajo` : '',
    costs.ovenMinutes ? `${number(costs.ovenMinutes)} min de horno` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(recipe.name)}</title>
<style>
  body{font-family:Georgia,serif;color:#3b2a22;max-width:720px;margin:32px auto;padding:0 20px}
  h1{font-size:30px;margin:0 0 4px} .sub{color:#7a665c;margin:0 0 20px;font-family:system-ui,sans-serif}
  table{width:100%;border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px;margin-bottom:18px}
  td,th{padding:7px 4px;border-bottom:1px solid #ecdfcf;text-align:left} .r{text-align:right} .m{color:#7a665c}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#7a665c}
  .box{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-family:system-ui,sans-serif;margin-bottom:18px}
  .box div{background:#fbf7f0;border-radius:10px;padding:8px 10px} .box b{display:block;font-size:17px} .box span{font-size:11px;color:#7a665c}
  h2{font-size:16px;margin:18px 0 6px} .notes{white-space:pre-wrap;font-family:system-ui,sans-serif;font-size:14px;line-height:1.55}
  footer{margin-top:28px;font:12px system-ui,sans-serif;color:#a08f85}
</style></head><body>
<h1>${esc(recipe.emoji)} ${esc(recipe.name)}</h1>
<p class="sub">Rinde ${esc(number(recipe.yield_qty))} ${esc(recipe.yield_unit)}${times ? ` · ${esc(times)}` : ''}</p>
<table><thead><tr><th>Ingrediente</th><th class="r">Cantidad</th><th class="r">Costo</th></tr></thead><tbody>${rows}</tbody>
<tfoot><tr><td><b>Costo de la tanda</b></td><td></td><td class="r"><b>${esc(money(costs.batchCost))}</b></td></tr></tfoot></table>
<div class="box">
  <div><span>Ingredientes c/u</span><b>${esc(money(costs.ingredientsUnit))}</b></div>
  <div><span>Costo completo c/u</span><b>${esc(money(costs.fullUnit))}</b></div>
  <div><span>Precio de venta</span><b>${esc(money(costs.price))}</b></div>
  <div><span>Margen real</span><b>${costs.realMargin == null ? '—' : `${costs.realMargin}%`}</b></div>
</div>
<h2>Procedimiento</h2>
<div class="notes">${recipe.notes ? esc(recipe.notes) : '<span class="m">Sin procedimiento cargado.</span>'}</div>
<footer>${esc(businessName || '')} · ficha generada el ${new Date().toLocaleDateString('es-AR')}</footer>
<script>window.onload=()=>{window.print()}</script>
</body></html>`;
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
}
