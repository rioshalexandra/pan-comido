export function money(value, currency = 'ARS') {
  return Number(value || 0).toLocaleString('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });
}

export function qty(value) {
  return Number(value || 0).toLocaleString('es-AR', { maximumFractionDigits: 3 });
}

export function ymd(value) {
  if (!value) return '—';
  return String(value).slice(0, 10);
}

export function ymdt(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return ymd(value);
  return date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

export const METHODS = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  check: 'Cheque',
  other: 'Otro',
};

export const STATUSES = {
  draft: 'Borrador',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
};

export const MOVEMENT_KINDS = {
  sale: 'Venta',
  purchase: 'Compra',
  manual: 'Modificación manual',
  adjustment: 'Ajuste',
  import: 'Importación',
  production: 'Producción',
};

// Fecha local AAAA-MM-DD (no UTC, así a la noche no salta al día siguiente)
export function today() {
  return toYmd(new Date());
}

export function toYmd(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Suma (o resta) días a una fecha AAAA-MM-DD
export function addDays(ymdValue, days) {
  const [y, m, d] = ymdValue.split('-').map(Number);
  return toYmd(new Date(y, m - 1, d + days));
}

// "miércoles 7 de octubre"
export function longDate(ymdValue) {
  const [y, m, d] = String(ymdValue).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// "7 de octubre" a partir de una fecha de cumpleaños (ignora el año)
export function birthdayLabel(value) {
  if (!value) return '—';
  const [, m, d] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(2000, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
}



// Estados de un encargo
export const ORDER_STATUSES = {
  pending: 'Pendiente',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

// Unidades sugeridas para productos e ingredientes
export const UNITS = ['un', 'docena', 'kg', 'g', 'l', 'ml', 'porción', 'caja'];

// Medios de pago que se ofrecen al cobrar (los más usados primero)
export const QUICK_METHODS = [
  ['cash', 'Efectivo'],
  ['transfer', 'Transferencia'],
  ['card', 'Tarjeta'],
  ['other', 'Otro'],
];

// Link de WhatsApp con mensaje armado. Asume Argentina si el número no trae código de país.
export function whatsappLink(phone, text = '') {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (!digits.startsWith('54')) digits = `549${digits}`;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

// Unidades compatibles para cargar recetas: la receta se guarda en la unidad del ingrediente,
// pero se puede escribir en gramos aunque la harina esté en kg (o ml si está en litros).
const UNIT_FACTORS = { kg: 1000, g: 1, l: 1000, ml: 1, docena: 12, un: 1 };
const UNIT_FAMILIES = [['kg', 'g'], ['l', 'ml'], ['docena', 'un']];

// Unidades en las que se puede escribir una cantidad de un ingrediente que se guarda en `unit`
export function compatibleUnits(unit) {
  return UNIT_FAMILIES.find((family) => family.includes(unit)) || [unit];
}

// Convierte una cantidad de una unidad a otra de la misma familia (g → kg, etc.)
export function convertQty(value, from, to) {
  if (from === to || !UNIT_FACTORS[from] || !UNIT_FACTORS[to]) return Number(value);
  return (Number(value) * UNIT_FACTORS[from]) / UNIT_FACTORS[to];
}

// Unidad cómoda para mostrar una cantidad de receta: 0,35 kg se lee mejor como 350 g
export function friendlyUnit(value, unit) {
  if ((unit === 'kg' || unit === 'l') && Number(value) < 1) return unit === 'kg' ? 'g' : 'ml';
  return unit;
}

export function recipeQty(value, unit) {
  const shown = friendlyUnit(value, unit);
  return `${qty(convertQty(value, unit, shown))} ${shown}`;
}
