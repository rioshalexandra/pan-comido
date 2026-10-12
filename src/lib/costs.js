// Costo completo y margen real de una receta.
// Además de los ingredientes (y el packaging, si se cargó como ingrediente)
// suma el trabajo y la luz y el gas según los minutos por tanda.

// Costo de una hora de horno: lo que se paga de luz y gas por mes ÷ horas de horno por mes
export function ovenHourCost(settings) {
  const hours = Number(settings?.oven_hours_month || 0);
  return hours > 0 ? Number(settings?.energy_monthly || 0) / hours : 0;
}

// ingredientUnitCost: costo de ingredientes por unidad (el de la receta)
export function recipeCosts({ ingredientUnitCost, yieldQty, workMinutes, ovenMinutes, price }, settings) {
  const units = Number(yieldQty || 0);
  if (!(units > 0)) return null;
  const ingredientsUnit = Number(ingredientUnitCost || 0);
  const work = Number(workMinutes || 0);
  const oven = Number(ovenMinutes || 0);
  const laborBatch = (work / 60) * Number(settings?.labor_hour_rate || 0);
  const energyBatch = (oven / 60) * ovenHourCost(settings);
  const laborUnit = laborBatch / units;
  const energyUnit = energyBatch / units;
  const fullUnit = ingredientsUnit + laborUnit + energyUnit;
  const salePrice = Number(price || 0);
  const pct = (cost) => (salePrice > 0 ? Math.round(((salePrice - cost) / salePrice) * 100) : null);
  return {
    ingredientsUnit,
    laborUnit,
    energyUnit,
    fullUnit,
    workMinutes: work,
    ovenMinutes: oven,
    grossMargin: pct(ingredientsUnit),
    // Sin los minutos de trabajo el margen real no se puede saber
    realMargin: work > 0 ? pct(fullUnit) : null,
    // Lo que deja cada hora de trabajo después de pagar ingredientes, luz y gas
    perWorkHour: work > 0 && salePrice > 0 ? ((salePrice - ingredientsUnit - energyUnit) * units) / (work / 60) : null,
  };
}

// Margen real con color: verde si es bueno, amarillo si es justo, rojo si es bajo
export function marginTone(value) {
  if (value == null) return 'text-[#6b6266]';
  if (value >= 50) return 'text-green-700';
  if (value >= 30) return 'text-amber-700';
  return 'text-red-700';
}
