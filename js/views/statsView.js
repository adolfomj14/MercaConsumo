// Vista de Estadísticas, Comparador de Precios y Presupuesto Predictivo
import { state } from '../state.js';
import { formatCurrency, formatQuantity, formatDate } from '../utils/formatters.js';
import { calculateProductMetrics, calculateGlobalBudget } from '../utils/forecasting.js';
import { exportPurchasesToCSV, exportInventoryToCSV } from '../utils/exporter.js';
import { showToast } from '../utils/toast.js';

export function renderStatsView(container, navigateTo) {
  const products     = state.products     || [];
  const inventory    = state.inventory    || [];
  const purchases    = state.purchases    || [];
  const consumptions = state.consumptions || [];
  const cycles       = state.cycles       || [];

  const metricsList = products.map(p => {
    const inv = inventory.find(i => i.product_id === p.id);
    return calculateProductMetrics(p, purchases, consumptions, cycles, inv);
  });

  const globalBudget = calculateGlobalBudget(metricsList);

  // ── Construir Matriz Detallada de Comparación de Precios ───────────────────
  // Para cada producto, recopilar historial de precios por supermercado
  const productPriceComparisons = [];

  products.forEach(p => {
    const storeHistory = {}; // storeName -> { minPrice, maxPrice, lastPrice, lastDate, count }

    purchases.forEach(pur => {
      const storeName = pur.rawStoreName || pur.storeName || 'Tienda';
      (pur.items || []).forEach(it => {
        if (it.product_id === p.id && it.unit_price > 0) {
          const uPrice = Number(it.unit_price);
          if (!storeHistory[storeName]) {
            storeHistory[storeName] = {
              storeName: storeName,
              minPrice: uPrice,
              maxPrice: uPrice,
              lastPrice: uPrice,
              lastDate: pur.purchase_date,
              unit: it.unit || p.base_unit
            };
          } else {
            if (uPrice < storeHistory[storeName].minPrice) storeHistory[storeName].minPrice = uPrice;
            if (uPrice > storeHistory[storeName].maxPrice) storeHistory[storeName].maxPrice = uPrice;
            if (pur.purchase_date >= storeHistory[storeName].lastDate) {
              storeHistory[storeName].lastPrice = uPrice;
              storeHistory[storeName].lastDate = pur.purchase_date;
            }
          }
        }
      });
    });

    const storeEntries = Object.values(storeHistory);
    if (storeEntries.length >= 1) {
      storeEntries.sort((a, b) => a.lastPrice - b.lastPrice);
      const cheapest = storeEntries[0];
      const expensive = storeEntries[storeEntries.length - 1];
      const savings = expensive.lastPrice - cheapest.lastPrice;
      const savingsPct = expensive.lastPrice > 0 ? Math.round((savings / expensive.lastPrice) * 100) : 0;

      productPriceComparisons.push({
        product: p,
        storesCount: storeEntries.length,
        hasComparison: storeEntries.length >= 2,
        cheapestStore: cheapest,
        expensiveStore: expensive,
        savings,
        savingsPct,
        allStores: storeEntries
      });
    }
  });

  // Ordenar: primero los que tienen comparativa entre 2+ tiendas con mayor ahorro
  productPriceComparisons.sort((a, b) => {
    if (a.hasComparison && !b.hasComparison) return -1;
    if (!a.hasComparison && b.hasComparison) return 1;
    return b.savingsPct - a.savingsPct;
  });

  let selectedProductId = productPriceComparisons.length > 0 ? productPriceComparisons[0].product.id : null;

  function render() {
    const selectedComp = productPriceComparisons.find(c => c.product.id === selectedProductId) || productPriceComparisons[0];

    container.innerHTML = `
      <div style="margin-bottom: 16px;">
        <h1 style="font-size: 1.35rem; font-weight: 800;">Estadísticas & Precios</h1>
        <p style="color: var(--text-muted); font-size: 0.85rem;">Comparador entre supermercados y control de presupuesto</p>
      </div>

      <!-- ── 1. COMPARADOR INTELIGENTE DE PRECIOS ── -->
      <div class="mc-card" style="border: 2px solid var(--primary); margin-bottom: 18px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <h2 style="font-size: 1.1rem; font-weight: 800; color: var(--primary-dark);">
            🏪 Comparador de Supermercados
          </h2>
          <span class="badge badge-normal" style="font-size: 0.75rem;">
            ${productPriceComparisons.filter(c => c.hasComparison).length} productos comparados
          </span>
        </div>
        <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 14px;">
          Descubre dónde te sale más barato comprar cada producto.
        </p>

        ${productPriceComparisons.length === 0 ? `
          <div style="text-align: center; padding: 20px; background: var(--bg-main); border-radius: 12px;">
            <div style="font-size: 2rem; margin-bottom: 6px;">🏷️</div>
            <p style="color: var(--text-muted); font-size: 0.85rem;">
              Registra compras con precios en diferentes supermercados para activar la comparativa automática.
            </p>
          </div>
        ` : `
          <!-- Selector de Producto a Comparar -->
          <div class="form-group" style="margin-bottom: 14px;">
            <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Selecciona un producto para comparar:</label>
            <select class="form-select" id="stats-prod-select" style="font-weight: 700; font-size: 0.9rem;">
              ${productPriceComparisons.map(c => `
                <option value="${c.product.id}" ${selectedComp && selectedComp.product.id === c.product.id ? 'selected' : ''}>
                  ${c.product.categoryIcon || '📦'} ${c.product.name} ${c.hasComparison ? `(Ahorra hasta ${c.savingsPct}%) 💰` : ''}
                </option>
              `).join('')}
            </select>
          </div>

          ${selectedComp ? renderProductComparisonDetail(selectedComp) : ''}
        `}
      </div>

      <!-- ── 2. PRESUPUESTO MENSUAL PROYECTADO ── -->
      <div class="mc-card" style="border-left: 4px solid var(--primary); margin-bottom: 18px;">
        <h2 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 4px;">¿Cuánto necesitas para el próximo mes?</h2>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px;">Estimación basada en tu ritmo de consumo y precios reales</p>

        <div style="text-align: center; padding: 14px; background: var(--bg-main); border-radius: 12px; margin-bottom: 12px;">
          <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">TOTAL ESTIMADO ESPERADO</div>
          <div style="font-size: 1.6rem; font-weight: 800; color: var(--primary-dark); margin-top: 2px;">
            ${formatCurrency(globalBudget.expectedTotal)}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem;">
          <div style="background: var(--bg-main); padding: 10px; border-radius: 8px;">
            <span style="color: var(--text-muted); font-size: 0.72rem;">Mínimo (Optimista):</span>
            <div style="font-weight: 700; color: #059669; font-size: 0.95rem;">${formatCurrency(globalBudget.optimisticTotal)}</div>
          </div>
          <div style="background: var(--bg-main); padding: 10px; border-radius: 8px;">
            <span style="color: var(--text-muted); font-size: 0.72rem;">Máximo (Conservador):</span>
            <div style="font-weight: 700; color: #dc2626; font-size: 0.95rem;">${formatCurrency(globalBudget.conservativeTotal)}</div>
          </div>
        </div>

        <!-- Desglose por Categoría -->
        <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--border);">
          <h4 style="font-size: 0.85rem; font-weight: 700; margin-bottom: 8px;">Gasto estimado por Categoría:</h4>
          ${Object.entries(globalBudget.byCategory).map(([cat, val]) => `
            <div style="display: flex; justify-content: space-between; font-size: 0.82rem; padding: 4px 0;">
              <span style="color: var(--text-muted);">${cat}</span>
              <span style="font-weight: 700;">${formatCurrency(val)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('stats-prod-select')?.addEventListener('change', (e) => {
      selectedProductId = e.target.value;
      render();
    });
  }

  function renderProductComparisonDetail(comp) {
    const p = comp.product;
    const stores = comp.allStores;
    const cheapest = comp.cheapestStore;
    const maxPrice = Math.max(...stores.map(s => s.lastPrice));

    return `
      <div style="background: var(--bg-main); border-radius: 12px; padding: 14px;">
        <!-- Banner de Recomendación si hay 2+ tiendas -->
        ${comp.hasComparison ? `
          <div style="background: rgba(16,185,129,0.12); border: 1.5px solid var(--primary); border-radius: 10px; padding: 10px 12px; margin-bottom: 12px;">
            <div style="font-size: 0.85rem; font-weight: 800; color: var(--text-main);">
              💡 ¡Ahorras ${comp.savingsPct}% comprando en ${cheapest.storeName}!
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
              Diferencia de <strong>${formatCurrency(comp.savings)}</strong> por ${p.base_unit} respecto al más costoso (${comp.expensiveStore.storeName}).
            </div>
          </div>
        ` : `
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 10px;">
            Solo tienes compras registradas en 1 tienda para este producto. Registra compras en otros lugares para comparar.
          </div>
        `}

        <!-- Barras de Precios por Comercio -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${stores.map((s, idx) => {
            const isBest = idx === 0 && comp.hasComparison;
            const barWidth = maxPrice > 0 ? Math.max(20, Math.round((s.lastPrice / maxPrice) * 100)) : 100;
            const barColor = isBest ? '#10b981' : (idx === stores.length - 1 && comp.hasComparison ? '#ef4444' : '#3b82f6');

            return `
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; margin-bottom: 4px;">
                  <div>
                    <strong>🏪 ${s.storeName}</strong>
                    ${isBest ? '<span class="badge badge-normal" style="font-size:0.68rem; margin-left:6px; padding:2px 6px;">🥇 Más Barato</span>' : ''}
                  </div>
                  <div style="font-weight: 800; font-size: 0.95rem; color: ${isBest ? 'var(--primary-dark)' : 'var(--text-main)'};">
                    ${formatCurrency(s.lastPrice)} <small style="font-size:0.75rem; color:var(--text-muted); font-weight:400;">/${s.unit}</small>
                  </div>
                </div>

                <!-- Barra Visual -->
                <div style="background: var(--border); border-radius: 8px; height: 10px; overflow: hidden;">
                  <div style="background: ${barColor}; width: ${barWidth}%; height: 100%; border-radius: 8px; transition: width 0.3s ease;"></div>
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-muted); margin-top: 3px;">
                  <span>Última compra: ${formatDate(s.lastDate)}</span>
                  ${s.minPrice !== s.maxPrice ? `<span>Rango: ${formatCurrency(s.minPrice)} - ${formatCurrency(s.maxPrice)}</span>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- ── EXPORTACIÓN DE REPORTES A EXCEL ── -->
      <div class="mc-card" style="margin-top: 18px; border: 1.5px solid var(--border);">
        <h2 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 6px;">📊 Exportar Reportes a Excel</h2>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 14px;">
          Descarga tus datos consolidados en formato CSV compatible con Microsoft Excel y Google Sheets.
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <button class="btn btn-secondary btn-sm" id="btn-stats-export-purchases" style="font-size: 0.8rem; font-weight: 700; padding: 10px 8px; display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <span style="font-size: 1.2rem;">🛒</span>
            <span>Historial Compras</span>
          </button>

          <button class="btn btn-secondary btn-sm" id="btn-stats-export-inventory" style="font-size: 0.8rem; font-weight: 700; padding: 10px 8px; display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <span style="font-size: 1.2rem;">📦</span>
            <span>Stock Inventario</span>
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-stats-export-purchases')?.addEventListener('click', () => {
      try {
        exportPurchasesToCSV(state.purchases, state.products, state.stores, state.categories);
        showToast('¡Compras exportadas a Excel (CSV) exitosamente! 📊', 'success');
      } catch (err) {
        showToast(err.message || 'Error al exportar compras', 'error');
      }
    });

    document.getElementById('btn-stats-export-inventory')?.addEventListener('click', () => {
      try {
        exportInventoryToCSV(state.inventory, state.products, state.categories, metricsList);
        showToast('¡Inventario exportado a Excel (CSV) exitosamente! 📊', 'success');
      } catch (err) {
        showToast(err.message || 'Error al exportar inventario', 'error');
      }
    });
  }

  render();
}

