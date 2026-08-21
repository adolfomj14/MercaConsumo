// Conversión inteligente de unidades y ratios fijos de peso
const CONVERSIONS = {
  // Masa
  kg_to_g: (val) => val * 1000,
  g_to_kg: (val) => val / 1000,
  kg_to_lb: (val) => val * 2.20462,
  lb_to_kg: (val) => val / 2.20462,
  // Volumen
  L_to_ml: (val) => val * 1000,
  ml_to_L: (val) => val / 1000
};

export function areUnitsCompatible(unitA, unitB) {
  if (!unitA || !unitB) return false;
  const a = unitA.toLowerCase().trim();
  const b = unitB.toLowerCase().trim();
  if (a === b) return true;
  if ((a === 'kg' || a === 'g' || a === 'lb') && (b === 'kg' || b === 'g' || b === 'lb')) return true;
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
  return q;
}

// Extrae el peso unitario fijo almacenado en el producto (en formato JSON o texto)
export function parseUnitWeight(brandField) {
  if (!brandField) return null;
  try {
    if (brandField.startsWith('{') && brandField.endsWith('}')) {
      const data = JSON.parse(brandField);
      if (data && typeof data.unitWeight === 'number' && data.unitWeight > 0) {
        return data.unitWeight;
      }
    }
  } catch (e) {}

  // Soporte de texto: "12 unidades" o "1 u = 0.25 kg" o "(0.25 kg/u)"
  const ratioMatch = brandField.match(/unitWeight[:=]\s*(\d+(?:\.\d+)?)/i);
  if (ratioMatch) return parseFloat(ratioMatch[1]);

  return null;
}

// Genera el string guardable para la metadata del producto
export function formatUnitWeightMetadata(unitWeight, baseUnit, totalUnits = null) {
  if (!unitWeight || unitWeight <= 0) return '';
  return JSON.stringify({
    unitWeight: Number(unitWeight),
    baseUnit: baseUnit,
    totalUnits: totalUnits ? Number(totalUnits) : null
  });
}
