// Vista de Estadísticas, Comparador de Precios y Presupuesto Predictivo
import { state } from '../state.js';
import { formatCurrency, formatQuantity } from '../utils/formatters.js';
import { calculateProductMetrics, calculateGlobalBudget } from '../utils/forecasting.js';

export function renderStatsView(container, navigateTo) {
  const products = state.products || [];
  const inventory = state.inventory || [];
  const purchases = state.purchases || [];
  const consumptions = state.consumptions || [];
  const cycles = state.cycles || [];
  const stores = state.stores || [];

  const metricsList = products.map(p => {
    const inv = inventory.find(i => i.product_id === p.id);
    return calculateProductMetrics(p, purchases, consumptions, cycles, inv);
  });

  const globalBudget = calculateGlobalBudget(metricsList);

  // Construir matriz de comparación de precios por establecimiento
  const storeComparison = [];
  products.forEach(p => {
    const pricesByStore = {};
    purchases.forEach(pur => {
      (pur.items || []).forEach(it => {
        if (it.product_id === p.id && it.unit_price > 0) {
          const storeName = pur.storeName || 'General';
          if (!pricesByStore[storeName] || it.unit_price < pricesByStore[storeName]) {
            pricesByStore[storeName] = it.unit_price;
          }
        }
      });
    });

    const storeEntries = Object.entries(pricesByStore);
    if (storeEntries.length >= 2) {
      storeEntries.sort((a, b) => a[1] - b[1]);
      const best = storeEntries[0];
      const worst = storeEntries[storeEntries.length - 1];
      const diff = worst[1] - best[1];
      storeComparison.push({
        productName: p.name,
        baseUnit: p.base_unit,
        bestStore: best[0],
        bestPrice: best[1],
        worstStore: worst[0],
        worstPrice: worst[1],
        potentialSavingsPerUnit: diff
      });
    }
  });

  container.innerHTML = `
    <div style="margin-bottom: 16px;">
      <h1 style="font-size: 1.35rem; font-weight: 800;">Estadísticas & Presupuesto</h1>
      <p style="color: var(--text-muted); font-size: 0.85rem;">Análisis predictivo de gastos y consumo</p>
    </div>

    <!-- Presupuesto General Proyectado -->
    <div class="mc-card" style="border-left: 4px solid var(--primary);">
      <h2 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 4px;">¿Cuánto necesito para el próximo mes?</h2>
      <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px;">Estimación basada en consumo real y precios históricos</p>

      <div style="text-align: center; padding: 12px; background: var(--bg-main); border-radius: 12px; margin-bottom: 12px;">
        <div style="font-size: 0.8rem; color: var(--text-muted);">TOTAL ESTIMADO ESPERADO</div>
        <div style="font-size: 1.6rem; font-weight: 800; color: var(--primary-dark);">${formatCurrency(globalBudget.expectedTotal)}</div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem;">
        <div style="background: var(--bg-main); padding: 8px; border-radius: 8px;">
          <span style="color: var(--text-muted); font-size: 0.75rem;">Mínimo (Optimista):</span>
          <div style="font-weight: 700; color: #059669;">${formatCurrency(globalBudget.optimisticTotal)}</div>
        </div>
        <div style="background: var(--bg-main); padding: 8px; border-radius: 8px;">
          <span style="color: var(--text-muted); font-size: 0.75rem;">Máximo (Conservador):</span>
          <div style="font-weight: 700; color: #dc2626;">${formatCurrency(globalBudget.conservativeTotal)}</div>
        </div>
      </div>

      <!-- Desglose por Categoría -->
      <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--border);">
        <h4 style="font-size: 0.85rem; font-weight: 700; margin-bottom: 6px;">Desglose por Categoría:</h4>
        ${Object.entries(globalBudget.byCategory).map(([cat, val]) => `
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; padding: 3px 0;">
            <span style="color: var(--text-muted);">${cat}</span>
            <span style="font-weight: 600;">${formatCurrency(val)}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Comparador de Precios entre Establecimientos -->
    <div class="mc-card">
      <h2 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 4px;">Comparativa de Precios</h2>
      <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px;">¿Dónde te conviene comprar cada producto?</p>

      ${storeComparison.length === 0 ? `
        <p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 12px;">
          Registra compras del mismo producto en diferentes comercios para ver la comparativa.
        </p>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${storeComparison.map(sc => `
            <div style="background: var(--bg-main); border-radius: 10px; padding: 10px; font-size: 0.85rem;">
              <div style="display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 4px;">
                <span>${sc.productName}</span>
                <span style="color: #059669;">Mejor: ${sc.bestStore}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted);">
                <span>${sc.bestStore}: <strong>${formatCurrency(sc.bestPrice)}/${sc.baseUnit}</strong></span>
                <span>${sc.worstStore}: ${formatCurrency(sc.worstPrice)}/${sc.baseUnit}</span>
              </div>
              <div style="margin-top: 4px; font-size: 0.75rem; color: var(--primary-dark); font-weight: 600;">
                💡 Ahorro potencial: ${formatCurrency(sc.potentialSavingsPerUnit)} por ${sc.baseUnit}
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>

    <!-- Nivel de Confianza y Explicación de Métricas -->
    <div class="mc-card">
      <h2 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 8px;">Detalle de Predicciones</h2>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${metricsList.map(m => `
          <div style="padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 0.85rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 700;">${m.productName}</span>
              <span class="badge" style="background: ${m.confidence.color}20; color: ${m.confidence.color}; font-size: 0.7rem;">
                ${m.confidence.label}
              </span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
              Consumo estimado: <strong>${formatQuantity(m.monthlyRate, m.baseUnit)}/mes</strong> • Presupuesto: <strong>${formatCurrency(m.monthlyBudget.expected)}</strong>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
              Fuente: ${m.calculationMethod}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
