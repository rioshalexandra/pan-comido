// Costo completo, margen real, ganancia por hora y precio sugerido de una receta.
import { unitCost } from './units';

export function ovenHourCost(settings) {
  const hours = Number(settings?.oven_hours_month || 0);
  return hours > 0 ? Number(settings?.energy_monthly || 0) / hours : 0;
}

// Redondea para arriba a un número "lindo" para la vitrina
export function nicePrice(value) {
  const v = Number(value || 0);
  if (!(v > 0)) return 0;
  const step = v >= 5000 ? 100 : v >= 1000 ? 50 : v >= 100 ? 10 : 1;
  return Math.ceil(v / step) * step;
}

export function recipeCosts(recipe, settings, batches = 1) {
  const units = Number(recipe.yield_qty || 0);
  const items = recipe.items || [];
  let ingredientsBatch = 0;
  let packagingBatch = 0;
  for (const item of items) {
    const cost = Number(item.qty) * unitCost(item);
    if (item.is_packaging) packagingBatch += cost;
    else ingredientsBatch += cost;
  }
  const work = Number(recipe.work_minutes || 0);
  const oven = Number(recipe.oven_minutes || 0);
  const laborBatch = (work / 60) * Number(settings?.labor_hour_rate || 0);
  const energyBatch = (oven / 60) * ovenHourCost(settings);
  const per = (v) => (units > 0 ? v / units : 0);

  const ingredientsUnit = per(ingredientsBatch + packagingBatch);
  const laborUnit = per(laborBatch);
  const energyUnit = per(energyBatch);
  const fullUnit = ingredientsUnit + laborUnit + energyUnit;
  const price = Number(recipe.sale_price || 0);
  const pct = (cost) => (price > 0 ? Math.round(((price - cost) / price) * 100) : null);
  const target = Math.min(95, Number(settings?.target_margin ?? 60));
  const suggestedRaw = fullUnit > 0 ? fullUnit / (1 - target / 100) : 0;

  return {
    units,
    batchCost: (ingredientsBatch + packagingBatch) * batches,
    ingredientsBatch,
    packagingBatch,
    ingredientsUnit,
    packagingUnit: per(packagingBatch),
    laborUnit,
    energyUnit,
    fullUnit,
    price,
    workMinutes: work,
    ovenMinutes: oven,
    grossMargin: pct(ingredientsUnit),
    // Sin los minutos de trabajo el margen real no se puede saber
    realMargin: work > 0 ? pct(fullUnit) : null,
    perWorkHour: work > 0 && price > 0 ? ((price - ingredientsUnit - energyUnit) * units) / (work / 60) : null,
    target,
    suggested: nicePrice(suggestedRaw),
    profitUnit: price - fullUnit,
  };
}

// Verde si es bueno, amarillo si es justo, rojo si es bajo
export function marginTone(value) {
  if (value == null) return 'text-cocoa-soft';
  if (value >= 50) return 'text-good';
  if (value >= 30) return 'text-warn';
  return 'text-bad';
}

export function missingSettings(settings) {
  return !(Number(settings?.labor_hour_rate) > 0) || !(Number(settings?.oven_hours_month) > 0);
}
