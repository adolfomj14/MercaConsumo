// Motor Estadístico de Predicción de Consumo y Presupuesto
import { convertQuantity } from './unitConverter.js';

export function calculateConfidence(completedCyclesCount, purchasesCount, totalSpanDays) {
  if (completedCyclesCount >= 4 || (purchasesCount >= 5 && totalSpanDays >= 30)) {
    return { level: 'ALTA', color: '#10B981', label: 'Alta Confianza', score: 3 };
  }
  if (completedCyclesCount >= 2 || purchasesCount >= 3) {
    return { level: 'MEDIA', color: '#F59E0B', label: 'Media Confianza', score: 2 };
  }
  return { level: 'BAJA', color: '#64748B', label: 'Baja (Pocos datos)', score: 1 };
}

export function calculateProductMetrics(product, purchases, consumptions, cycles, inventoryItem) {
  const prodId = product.id;
  const baseUnit = product.base_unit || 'unidad';
  const currentStock = inventoryItem ? Number(inventoryItem.current_stock) : 0;

  // 1. Filtrar compras de este producto
  const itemPurchases = [];
  purchases.forEach(p => {
    (p.items || []).forEach(it => {
      if (it.product_id === prodId) {
        const normQty = convertQuantity(it.quantity, it.unit, baseUnit);
        const unitPrice = normQty > 0 ? (it.total_price / normQty) : it.unit_price;
        itemPurchases.push({
          date: p.purchase_date,
          store_id: p.store_id,
          quantity: normQty,
          unitPrice: unitPrice,
          totalPrice: it.total_price
        });
      }
    });
  });

  // 2. Filtrar ciclos completados
  const prodCycles = cycles.filter(c => c.product_id === prodId);

  // 3. Filtrar consumos registrados
  const prodConsumptions = consumptions.filter(c => c.product_id === prodId);

  // Cálculo de Precios (Promedio, Mínimo, Máximo, Último)
  let avgPrice = 0;
  let minPrice = 0;
  let maxPrice = 0;
  let lastPrice = 0;

  if (itemPurchases.length > 0) {
    // Ordenar por fecha cronológica
    itemPurchases.sort((a, b) => new Date(a.date) - new Date(b.date));
    const prices = itemPurchases.map(p => p.unitPrice).filter(p => p > 0);
    if (prices.length > 0) {
      avgPrice = prices.reduce((acc, val) => acc + val, 0) / prices.length;
      minPrice = Math.min(...prices);
      maxPrice = Math.max(...prices);
      lastPrice = prices[prices.length - 1];
    }
  }

  // 4. Cálculo de Consumo Diario
  let dailyRate = 0;
  let calculationMethod = 'Sin datos';
  let analyzedCyclesCount = prodCycles.length;

  if (prodCycles.length > 0) {
    // Ventana móvil reciente: usar últimos ciclos (máx 5)
    const recentCycles = prodCycles.slice(-5);
    const totalQty = recentCycles.reduce((sum, c) => sum + convertQuantity(c.total_quantity, c.unit, baseUnit), 0);
    const totalDays = recentCycles.reduce((sum, c) => sum + Number(c.duration_days), 0);
    dailyRate = totalDays > 0 ? (totalQty / totalDays) : 0;
    calculationMethod = `${recentCycles.length} ciclos completos de agotamiento`;
  } else if (itemPurchases.length >= 2) {
    // Estimación por intervalo entre compras
    const firstDate = new Date(itemPurchases[0].date);
    const lastDate = new Date(itemPurchases[itemPurchases.length - 1].date);
    const spanDays = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
    const totalBought = itemPurchases.reduce((sum, p) => sum + p.quantity, 0);
    dailyRate = totalBought / spanDays;
    calculationMethod = `${itemPurchases.length} compras en un lapso de ${Math.round(spanDays)} días`;
  } else if (prodConsumptions.length > 0) {
    // Estimación basada en registros de consumo
    const totalConsumed = prodConsumptions.reduce((sum, c) => sum + convertQuantity(c.quantity, c.unit, baseUnit), 0);
    dailyRate = totalConsumed / Math.max(1, prodConsumptions.length * 3);
    calculationMethod = `${prodConsumptions.length} registros de consumo`;
  }

  const weeklyRate = dailyRate * 7;
  const monthlyRate = dailyRate * 30.4;

  // 5. Predicción de Duración y Próxima Compra
  let daysRemaining = null;
  let estimatedNextPurchaseDate = null;

  if (dailyRate > 0) {
    daysRemaining = currentStock / dailyRate;
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + Math.round(daysRemaining));
    estimatedNextPurchaseDate = nextDate.toISOString().split('T')[0];
  }

  // 6. Confianza
  const spanDays = itemPurchases.length >= 2 ? (new Date(itemPurchases[itemPurchases.length - 1].date) - new Date(itemPurchases[0].date)) / (1000 * 60 * 60 * 24) : 0;
  const confidence = calculateConfidence(prodCycles.length, itemPurchases.length, spanDays);

  // 7. Presupuesto Mensual por Producto
  const priceToUse = avgPrice > 0 ? avgPrice : lastPrice;
  const monthlyBudgetExpected = monthlyRate * priceToUse;
  const monthlyBudgetOptimistic = monthlyRate * (minPrice > 0 ? minPrice : priceToUse);
  const monthlyBudgetConservative = monthlyRate * (maxPrice > 0 ? maxPrice : priceToUse);

  return {
    productId: prodId,
    productName: product.name,
    categoryName: product.categoryName || 'General',
    baseUnit,
    currentStock,
    dailyRate,
    weeklyRate,
    monthlyRate,
    avgPrice,
    minPrice,
    maxPrice,
    lastPrice,
    daysRemaining,
    estimatedNextPurchaseDate,
    confidence,
    calculationMethod,
    purchasesCount: itemPurchases.length,
    cyclesCount: prodCycles.length,
    monthlyBudget: {
      expected: monthlyBudgetExpected,
      optimistic: monthlyBudgetOptimistic,
      conservative: monthlyBudgetConservative
    }
  };
}

export function calculateGlobalBudget(allProductsMetrics) {
  let expectedTotal = 0;
  let optimisticTotal = 0;
  let conservativeTotal = 0;
  const byCategory = {};

  allProductsMetrics.forEach(m => {
    expectedTotal += m.monthlyBudget.expected;
    optimisticTotal += m.monthlyBudget.optimistic;
    conservativeTotal += m.monthlyBudget.conservative;

    const cat = m.categoryName || 'Otros';
    if (!byCategory[cat]) byCategory[cat] = 0;
    byCategory[cat] += m.monthlyBudget.expected;
  });

  return {
    expectedTotal,
    optimisticTotal,
    conservativeTotal,
    byCategory
  };
}
