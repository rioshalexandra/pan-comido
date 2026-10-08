import XLSX from 'xlsx';

const HEADER_ALIASES = {
  sku: 'sku',
  codigo: 'sku',
  code: 'sku',
  nombre: 'name',
  name: 'name',
  descripcion: 'description',
  description: 'description',
  categoria: 'category',
  category: 'category',
  unidad: 'unit',
  unit: 'unit',
  codigo_barras: 'barcode',
  barcode: 'barcode',
  costo: 'cost_price',
  cost: 'cost_price',
  cost_price: 'cost_price',
  precio: 'sale_price',
  price: 'sale_price',
  sale_price: 'sale_price',
  stock: 'stock_qty',
  stock_qty: 'stock_qty',
  stock_minimo: 'min_stock',
  min_stock: 'min_stock',
  minimo: 'min_stock',
  tipo: 'kind',
  kind: 'kind',
  activo: 'active',
  active: 'active',
  cuit: 'tax_id',
  tax_id: 'tax_id',
  telefono: 'phone',
  phone: 'phone',
  email: 'email',
  direccion: 'address',
  address: 'address',
  notas: 'notes',
  notes: 'notes',
};

function normalizeKey(key) {
  return String(key || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function parseSheet(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  return rows.map((row) => {
    const out = {};
    for (const [key, value] of Object.entries(row)) {
      const mapped = HEADER_ALIASES[normalizeKey(key)];
      if (mapped) out[mapped] = value;
    }
    return out;
  });
}

export function buildSheet(rows, sheetName, format) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const bookType = format === 'csv' ? 'csv' : 'xlsx';
  return XLSX.write(workbook, { type: 'buffer', bookType });
}

export function truthy(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return true;
  return !['0', 'false', 'no', 'n', 'inactivo'].includes(text);
}
