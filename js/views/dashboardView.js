// Vista de Dashboard Principal Mobile-First con Plan Visible y Perfiles Familiares
import { state } from '../state.js';
import { formatCurrency, formatRelativeDays, formatQuantity } from '../utils/formatters.js';
import { calculateProductMetrics, calculateGlobalBudget } from '../utils/forecasting.js';
import { getUserSubscriptionInfo } from '../services/subscriptions.js';
import { getActiveFamilyMember } from '../services/family.js';
import { openProfileSelectorModal, openPlansModal } from './settingsView.js';

export async function renderDashboardView(container, navigateTo) {
  const products     = state.products     || [];
  const inventory    = state.inventory    || [];
  const purchases    = state.purchases    || [];
  const consumptions = state.consumptions || [];
  const cycles       = state.cycles       || [];

  const sub = await getUserSubscriptionInfo();
  const currentMember = getActiveFamilyMember();

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
    .filter(m => (m.daysRemaining !== null && m.daysRemaining <= 3) || m.currentStock <= 0)
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
    <!-- Cabecera con Saludo de Perfil y Selector Estilo Netflix -->
    <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <h1 style="font-size: 1.35rem; font-weight: 800; margin: 0; display:flex; align-items:center; gap:6px;">
          <span>Hola, ${currentMember.name || 'Usuario'}</span>
          <span>${currentMember.avatar || '👋'}</span>
        </h1>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 2px;">Estado de tu despensa y presupuesto</p>
      </div>

      <!-- Botón para cambiar de usuario familiar -->
      <button class="btn btn-secondary btn-sm" id="btn-dash-switch-profile"
              style="font-size: 0.78rem; font-weight: 700; padding: 4px 10px; display: flex; align-items: center; gap: 4px; border-radius: 20px;">
        <span>👥 Cambiar Perfil</span>
      </button>
    </div>

    <!-- ── CHIP / BANNER DEL PLAN VISIBLE EN INICIO ── -->
    <div id="dash-plan-banner" class="mc-card"
         style="background: var(--bg-card); border: 1.5px solid var(--border); border-radius: 14px; padding: 12px 14px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: transform 0.15s ease; border-left: 4.5px solid ${sub.plan === 'pro' || sub.isAdmin ? 'var(--primary)' : (sub.plan === 'premium' ? '#8b5cf6' : (sub.plan === 'trial' ? '#10b981' : '#f59e0b'))};">
      
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; background: ${sub.plan === 'pro' || sub.isAdmin ? 'rgba(16,185,129,0.15)' : (sub.plan === 'premium' ? 'rgba(139,92,246,0.15)' : (sub.plan === 'trial' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'))};">
          ${sub.plan === 'pro' || sub.isAdmin ? '🚀' : (sub.plan === 'premium' ? '⭐️' : (sub.plan === 'trial' ? '✨' : '📦'))}
        </div>
        <div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 0.88rem; font-weight: 800; color: var(--text-main);">
              ${sub.isAdmin ? '👑 Plan Administrador' : (sub.plan === 'pro' ? '🚀 Plan Pro' : (sub.plan === 'premium' ? '⭐️ Plan Premium' : (sub.plan === 'trial' ? `✨ Prueba Gratis (${sub.trialDaysLeft}d)` : '📦 Plan Gratuito')))}
            </span>
            <span class="badge badge-normal" style="font-size: 0.65rem; padding: 1px 6px;">
              ${sub.scansLimit === Infinity ? 'Ilimitado ⚡' : `${sub.scansRemaining} rest./sem`}
            </span>
          </div>
          <p style="font-size: 0.74rem; color: var(--text-muted); margin: 2px 0 0; line-height: 1.3;">
            ${sub.plan === 'free'
              ? 'Pásate a <strong>Premium</strong> (5 facturas/sem) o <strong>Pro</strong> (Ilimitado + Perfiles).'
              : (sub.plan === 'premium'
                ? 'Pásate a <strong>Plan Pro</strong> para facturas ilimitadas y perfiles familiares.'
                : (sub.plan === 'trial'
                  ? 'Facturas ilimitadas con IA durante tus 3 días de prueba.'
                  : 'Facturas ilimitadas y perfiles familiares multiusuario activos.'))}
          </p>
        </div>
      </div>

      <button class="btn btn-primary btn-sm" id="btn-dash-see-plans" style="font-size: 0.75rem; font-weight: 700; white-space: nowrap; padding: 6px 12px; border-radius: 8px; margin-left: 8px;">
        ${sub.plan === 'pro' || sub.isAdmin ? 'Ver Ajustes' : '⭐ Ver Planes'}
      </button>
    </div>

    <!-- Tarjeta Resumen del Mes -->
    <div class="mc-card" style="background: linear-gradient(135deg, #10b981 0%, #047857 100%); color: white; border: none; margin-bottom: 18px;">
      <div style="font-size: 0.82rem; font-weight: 600; opacity: 0.9; margin-bottom: 12px; display: flex; justify-content: space-between;">
        <span>RESUMEN DEL MES</span>
        <span>${new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(now).toUpperCase()}</span>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 12px;">
          <div style="font-size: 0.72rem; opacity: 0.85;">Compras del Mes</div>
          <div style="font-size: 1.2rem; font-weight: 800; margin-top: 2px;">${formatCurrency(totalMonthSpent)}</div>
        </div>

        <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 12px;">
          <div style="font-size: 0.72rem; opacity: 0.85;">Presupuesto Estimado</div>
          <div style="font-size: 1.2rem; font-weight: 800; margin-top: 2px;">${formatCurrency(globalBudget.expectedTotal)}</div>
        </div>
      </div>

      <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2); display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.85rem;">Productos por reponer:</span>
        <span class="badge" style="background: ${itemsToReplenish.length > 0 ? '#fee2e2' : '#dcfce7'}; color: ${itemsToReplenish.length > 0 ? '#b91c1c' : '#15803d'}; font-size: 0.85rem; padding: 4px 10px; font-weight: 700;">
          ${itemsToReplenish.length} ${itemsToReplenish.length === 1 ? 'producto' : 'productos'}
        </span>
      </div>
    </div>

    <!-- Acciones Rápidas -->
    <div style="margin-bottom: 20px;">
      <h2 style="font-size: 1rem; font-weight: 700; margin-bottom: 10px;">Acciones Rápidas</h2>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
        <button class="btn btn-secondary action-btn" id="dash-btn-scan" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 75px; padding: 4px;">
          <span style="font-size: 1.4rem;">📷</span>
          <span style="font-size: 0.72rem; font-weight: 600; margin-top: 4px;">Escanear</span>
        </button>
        <button class="btn btn-secondary action-btn" id="dash-btn-consume" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 75px; padding: 4px;">
          <span style="font-size: 1.4rem;">🍽️</span>
          <span style="font-size: 0.72rem; font-weight: 600; margin-top: 4px;">Consumir</span>
        </button>
        <button class="btn btn-secondary action-btn" id="dash-btn-buy" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 75px; padding: 4px;">
          <span style="font-size: 1.4rem;">🛒</span>
          <span style="font-size: 0.72rem; font-weight: 600; margin-top: 4px;">+ Compra</span>
        </button>
        <button class="btn btn-secondary action-btn" id="dash-btn-list" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 75px; padding: 4px;">
          <span style="font-size: 1.4rem;">🧺</span>
          <span style="font-size: 0.72rem; font-weight: 600; margin-top: 4px;">Lista</span>
        </button>
      </div>
    </div>

    <!-- Productos por Reponer -->
    ${itemsToReplenish.length > 0 ? `
      <div class="mc-card" style="border-left: 4px solid var(--danger); margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--danger);">⚠️ Urgente por Agotarse</h3>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Stock bajo</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${itemsToReplenish.slice(0, 3).map(m => `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; padding: 4px 0; border-bottom: 1px dashed var(--border);">
              <span>${m.categoryIcon || '📦'} <strong>${m.productName}</strong></span>
              <span style="color: var(--danger); font-weight: 700;">
                ${m.currentStock <= 0 ? 'Agotado' : formatRelativeDays(m.daysRemaining)}
              </span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;

  document.getElementById('btn-dash-switch-profile')?.addEventListener('click', () => {
    openProfileSelectorModal(() => renderDashboardView(container, navigateTo));
  });

  document.getElementById('dash-plan-banner')?.addEventListener('click', () => {
    openPlansModal();
  });

  document.getElementById('btn-dash-see-plans')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openPlansModal();
  });

  document.getElementById('dash-btn-scan')?.addEventListener('click', () => navigateTo('scan'));
  document.getElementById('dash-btn-consume')?.addEventListener('click', () => navigateTo('inventory', { openConsumeModal: true }));
  document.getElementById('dash-btn-buy')?.addEventListener('click', () => navigateTo('purchases', { openModal: true }));
  document.getElementById('dash-btn-list')?.addEventListener('click', () => navigateTo('shopping-list'));
}
