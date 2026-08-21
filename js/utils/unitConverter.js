// Conversión inteligente de unidades compatibles
const CONVERSIONS = {
  // Masa
  kg_to_g: (val) => val * 1000,
  g_to_kg: (val) => val / 1000,
  // Volumen
  L_to_ml: (val) => val * 1000,
  ml_to_L: (val) => val / 1000
};

export function areUnitsCompatible(unitA, unitB) {
  if (!unitA || !unitB) return false;
  const a = unitA.toLowerCase().trim();
  const b = unitB.toLowerCase().trim();
  if (a === b) return true;
  if ((a === 'kg' || a === 'g') && (b === 'kg' || b === 'g')) return true;
  if ((a === 'l' || a === 'ml') && (b === 'l' || b === 'ml')) return true;
  return false;
}

export function convertQuantity(qty, fromUnit, toUnit) {
  const q = Number(qty);
  if (isNaN(q)) return 0;
  const from = fromUnit.toLowerCase().trim();
  const to = toUnit.toLowerCase().trim();
  if (from === to) return q;

  const key = `${from}_to_${to}`;
  if (CONVERSIONS[key]) {
    return CONVERSIONS[key](q);
  }
  // Si no son directamente convertibles matemáticamente, retornamos la cantidad tal cual
  return q;
}
