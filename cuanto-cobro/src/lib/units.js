// Unidades. Cada ingrediente se guarda en una unidad base (g, ml o un),
// pero se puede escribir en la que sea más cómoda: 1 kg, 350 g, 1 docena…

export const BASE_UNITS = [
  { value: 'g', label: 'Peso (kg / g)' },
  { value: 'ml', label: 'Líquido (litros / ml)' },
  { value: 'un', label: 'Unidades (un / docena)' },
];

// Unidades que se pueden escribir para cada unidad base, con su factor
export const INPUT_UNITS = {
  g: [{ value: 'g', factor: 1 }, { value: 'kg', factor: 1000 }],
  ml: [{ value: 'ml', factor: 1 }, { value: 'l', factor: 1000 }],
  un: [{ value: 'un', factor: 1 }, { value: 'docena', factor: 12 }],
};

export function toBase(value, inputUnit, base) {
  const unit = (INPUT_UNITS[base] || []).find((u) => u.value === inputUnit);
  return Number(value || 0) * (unit ? unit.factor : 1);
}

export function fromBase(value, inputUnit, base) {
  const unit = (INPUT_UNITS[base] || []).find((u) => u.value === inputUnit);
  return Number(value || 0) / (unit ? unit.factor : 1);
}

// La unidad más cómoda para mostrar una cantidad: 1500 g → 1,5 kg; 350 g → 350 g
export function niceUnit(value, base) {
  const v = Math.abs(Number(value || 0));
  if (base === 'g' && v >= 1000) return 'kg';
  if (base === 'ml' && v >= 1000) return 'l';
  return base;
}

export function qtyText(value, base) {
  const unit = niceUnit(value, base);
  return `${number(fromBase(value, unit, base))} ${unit}`;
}

export function number(value, digits = 2) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: digits }).format(Number(value || 0));
}

// Costo por unidad base del ingrediente
export const unitCost = (ing) => (Number(ing.pack_qty) > 0 ? Number(ing.pack_price) / Number(ing.pack_qty) : 0);

// "$ 1.100 el kg", "$ 220 c/u"
export function costLabel(ing, money) {
  const c = unitCost(ing);
  if (ing.unit === 'g') return `${money(c * 1000)} el kg`;
  if (ing.unit === 'ml') return `${money(c * 1000)} el litro`;
  return `${money(c)} c/u`;
}
