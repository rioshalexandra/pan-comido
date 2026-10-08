import { METHODS, money, qty, ymd } from '../format';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function ticketItemsFromDoc(doc, kind) {
  return (doc.items || []).map((item) => ({
    name: item.description,
    sku: item.sku,
    qty: Number(item.qty),
    price: Number(kind === 'sales' ? item.unit_price : item.unit_cost),
  }));
}

export function printApiDocument({ doc, kind, storeName, currency, partyLabel, partyFallback, title }) {
  const remaining = Number(doc.total || 0) - Number(doc.paid || 0);
  printTicket({
    storeName,
    title,
    number: doc.number,
    issuedAt: doc.issued_at,
    partyLabel,
    partyName: doc.customer_name || doc.supplier_name || partyFallback,
    items: ticketItemsFromDoc(doc, kind),
    total: doc.total,
    paid: doc.status === 'confirmed' ? Number(doc.paid) : null,
    remaining,
    payments: doc.payments || [],
    notes: doc.notes,
    currency,
  });
}

export function printTicket({
  storeName,
  title,
  number,
  issuedAt,
  partyLabel,
  partyName,
  items,
  total,
  paid,
  remaining,
  payments = [],
  notes,
  currency,
}) {
  const rows = items
    .map((item) => {
      const line = Number(item.qty || 0) * Number(item.price || 0);
      return `<tr>
        <td>${esc(qty(item.qty))} ${esc(item.name)}</td>
        <td class="r">${esc(money(line, currency))}</td>
      </tr>`;
    })
    .join('');
  const payRows = payments
    .map(
      (row) =>
        `<div class="row"><span>${esc(METHODS[row.method] || row.method)}</span><span>${esc(
          money(row.amount, currency)
        )}</span></div>`
    )
    .join('');

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Ticket ${esc(number)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 0; color: #111; }
    .ticket { width: 72mm; padding: 8px 10px 16px; }
    h1 { font-size: 16px; text-align: center; margin: 0 0 4px; }
    .muted { text-align: center; font-size: 11px; margin: 0 0 10px; }
    .line { border-top: 1px dashed #111; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    td { padding: 2px 0; vertical-align: top; }
    .r { text-align: right; white-space: nowrap; padding-left: 8px; }
    .row { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; }
    .total { font-size: 14px; font-weight: 700; }
    .foot { text-align: center; font-size: 11px; margin-top: 12px; }
    @media print { body { margin: 0; } .ticket { width: 72mm; } }
  </style>
</head>
<body>
  <div class="ticket">
    <h1>${esc(storeName || 'Ticket')}</h1>
    <p class="muted">${esc(title)} ${esc(number)}<br/>${esc(ymd(issuedAt))}</p>
    <div class="row"><span>${esc(partyLabel)}</span><span>${esc(partyName)}</span></div>
    <div class="line"></div>
    <table>${rows}</table>
    <div class="line"></div>
    <div class="row total"><span>Total</span><span>${esc(money(total, currency))}</span></div>
    ${
      paid != null
        ? `<div class="row"><span>Pagado</span><span>${esc(money(paid, currency))}</span></div>
           <div class="row"><span>Saldo</span><span>${esc(money(remaining, currency))}</span></div>`
        : ''
    }
    ${payRows ? `<div class="line"></div>${payRows}` : ''}
    ${notes ? `<div class="line"></div><div class="muted">${esc(notes)}</div>` : ''}
    <p class="foot">${title === 'Compra' ? 'Comprobante de compra' : 'Gracias por su compra'}</p>
  </div>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    throw new Error('No se pudo abrir la vista de impresión');
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  const cleanup = () => {
    iframe.remove();
  };
  win.addEventListener('afterprint', cleanup);
  setTimeout(() => {
    win.focus();
    win.print();
  }, 50);
}
