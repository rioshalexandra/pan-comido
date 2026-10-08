export function emptyToNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function qty(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1000) / 1000;
}

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export async function nextNumber(client, table, prefix) {
  const allowed = { sales: true, purchases: true };
  if (!allowed[table]) throw new Error('Tabla inválida');
  const result = await client.query(
    `SELECT number FROM ${table} WHERE number LIKE $1 ORDER BY id DESC LIMIT 1`,
    [`${prefix}-%`]
  );
  const last = result.rows[0]?.number;
  const n = last ? Number(String(last).split('-').pop()) + 1 : 1;
  return `${prefix}-${String(n).padStart(5, '0')}`;
}

export function computeDocTotals(items, taxRate) {
  const subtotal = money(items.reduce((sum, item) => sum + Number(item.line_total || 0), 0));
  const tax = money(subtotal * (Number(taxRate || 0) / 100));
  return { subtotal, tax, total: money(subtotal + tax) };
}
