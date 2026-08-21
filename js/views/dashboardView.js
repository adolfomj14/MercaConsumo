// Vista de Dashboard Principal Mobile-First
import { state } from '../state.js';
import { formatCurrency, formatRelativeDays, formatQuantity } from '../utils/formatters.js';
import { calculateProductMetrics, calculateGlobalBudget } from '../utils/forecasting.js';

export function renderDashboardView(container, navigateTo) {
  const products = state.products || [];
  const inventory = state.inventory || [];
  const purchases = state.purchases || [];
  const consumptions = state.consumptions || [];
  const cycles = state.cycles || [];

  const metricsList = products.map(p => {
    const inv = inventory.find(i => i.product_id === p.id);
    return calculateProductMetrics(p, purchases, consumptions, cycles, inv);
  });

  const globalBudget = calculateGlobalBudget(metricsList);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthPurchases = purchases.filter(p => {
    const d = new Date(p.purchase_date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const totalMonthSpent = monthPurchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);

  const itemsToReplenish = metricsList
    .filter(m => m.daysRemaining !== null && m.daysRemaining <= 3 || m.currentStock <= 0)
    .sort((a, b) => (a.daysRemaining || 0) - (b.daysRemaining || 0));

  const upcomingPurchases = metricsList
    .filter(m => m.daysRemaining !== null && m.dailyRate > 0)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 4);

  const topConsumingProducts = [...metricsList]
    .filter(m => m.monthlyRate > 0)
    .sort((a, b) => (b.monthlyBudget.expected) - (a.monthlyBudget.expected))
    .slice(0, 5);

  container.innerHTML = `
    <!-- Saludo -->
    <div style="margin-bottom: 20px;">
      <h1 style="font-size: 1.35rem; font-weight: 800;">Hola 👋</h1>
      <p style="color: var(--text-muted); font-size: 0.9rem;">Estado actual de tu despensa y presupuesto</p>
    </div>

    <!-- Tarjeta Resumen del Mes -->
    <div class="mc-card" style="background: linear-gradient(135deg, #10b981 0%, #047857 100%); color: white; border: none;">
      <div style="font-size: 0.85rem; font-weight: 600; opacity: 0.9; margin-bottom: 12px; display: flex; justify-content: space-between;">
        <span>RESUMEN DEL MES</span>
        <span>${new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(now).toUpperCase()}</span>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 12px;">
          <div style="font-size: 0.75rem; opacity: 0.85;">Compras del Mes</div>
          <div style="font-size: 1.2rem; font-weight: 800; margin-top: 2px;">${formatCurrency(totalMonthSpent)}</div>
        </div>

        <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 12px;">
          <div style="font-size: 0.75rem; opacity: 0.85;">Presupuesto Necesario</div>
          <div style="font-size: 1.2rem; font-weight: 800; margin-top: 2px;">${formatCurrency(globalBudget.expectedTotal)}</div>
        </div>
      </div>

      <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2); display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.85rem;">Productos por reponer:</span>
        <span class="badge" style="background: ${itemsToReplenish.length > 0 ? '#fee2e2' : '#dcfce7'}; color: ${itemsToReplenish.length > 0 ? '#b91c1c' : '#15803d'}; font-size: 0.85rem; padding: 4px 10px;">
          ${itemsToReplenish.length} ${itemsToReplenish.length === 1 ? 'producto' : 'productos'}
        </span>
      </div>
    </div>

    <!-- Acciones Rápidas -->
    <div style="margin-bottom: 20px;">
      <h2 style="font-size: 1rem; font-weight: 700; margin-bottom: 10px;">Acciones Rápidas</h2>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
        <button class="btn btn-secondary" id="dash-action-buy" style="padding: 10px 4px; flex-direction: column; gap: 4px; font-size: 0.75rem;">
          <span style="font-size: 1.3rem;">🛒</span>
          <span>+ Compra</span>
        </button>
        <button class="btn btn-secondary" id="dash-action-consume" style="padding: 10px 4px; flex-direction: column; gap: 4px; font-size: 0.75rem;">
          <span style="font-size: 1.3rem;">🍽️</span>
          <span>+ Consumo</span>
        </button>
        <button class="btn btn-secondary" id="dash-action-scan" style="padding: 10px 4px; flex-direction: column; gap: 4px; font-size: 0.75rem; border: 1px solid var(--primary);">
          <span style="font-size: 1.3rem;">📷</span>
          <span>Escanear</span>
        </button>
        <button class="btn btn-secondary" id="dash-action-inventory" style="padding: 10px 4px; flex-direction: column; gap: 4px; font-size: 0.75rem;">
          <span style="font-size: 1.3rem;">📦</span>
          <span>Inventario</span>
        </button>
      </div>
    </div>

    <!-- Próximas Compras Estimadas -->
    <div class="mc-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2 style="font-size: 1.05rem; font-weight: 700;">Próximas Compras</h2>
        <span style="font-size: 0.8rem; color: var(--primary); cursor: pointer;" id="btn-see-all-predictions">Ver todas</span>
      </div>

      ${upcomingPurchases.length === 0 ? `
        <div style="text-align: center; padding: 16px; color: var(--text-muted); font-size: 0.9rem;">
          Registra compras y consumos para proyectar las próximas fechas de compra.
        </div>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${upcomingPurchases.map(p => {
            const isUrgent = p.daysRemaining <= 2;
            return `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border);">
                <div>
                  <div style="font-weight: 600; font-size: 0.95rem;">${p.productName}</div>
                  <div style="font-size: 0.8rem; color: var(--text-muted);">
                    Stock: ${formatQuantity(p.currentStock, p.baseUnit)} (${formatRelativeDays(p.daysRemaining)})
                  </div>
                </div>
                <div>
                  <span class="badge ${isUrgent ? 'badge-depleted' : 'badge-low'}">
                    ${p.daysRemaining <= 0 ? '🔴 Agotado' : (p.daysRemaining === 1 ? '🟡 Mañana' : `🟢 en ${Math.round(p.daysRemaining)}d`)}
                  </span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>

    <!-- Productos con Mayor Consumo -->
    <div class="mc-card">
      <h2 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 12px;">Productos con Mayor Consumo</h2>
      ${topConsumingProducts.length === 0 ? `
        <p style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 10px;">Registra compras y consumos para ver el ranking.</p>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${topConsumingProducts.map((p, idx) => `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 700; color: var(--text-muted); width: 18px;">${idx + 1}.</span>
                <div>
                  <div style="font-weight: 600;">${p.productName}</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">
                    ${formatQuantity(p.monthlyRate, p.baseUnit)} / mes
                  </div>
                </div>
              </div>
              <div style="text-align: right; font-weight: 700; color: var(--primary-dark);">
                ${formatCurrency(p.monthlyBudget.expected)}
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;

  document.getElementById('dash-action-buy')?.addEventListener('click', () => navigateTo('purchases', { openModal: true }));
  document.getElementById('dash-action-consume')?.addEventListener('click', () => navigateTo('inventory', { openConsumeModal: true }));
  document.getElementById('dash-action-scan')?.addEventListener('click', () => navigateTo('scan'));
  document.getElementById('dash-action-inventory')?.addEventListener('click', () => navigateTo('inventory'));
  document.getElementById('btn-see-all-predictions')?.addEventListener('click', () => navigateTo('stats'));

  if (window.lucide) window.lucide.createIcons();
}
