// Vista de Inventario Doméstico y Ciclos de Consumo
import { state } from '../state.js';
import { formatQuantity, formatRelativeDays } from '../utils/formatters.js';
import { calculateProductMetrics } from '../utils/forecasting.js';
import { registerConsumption, registerDepletion } from '../services/inventory.js';
import { showToast, showConfirmDialog } from '../utils/toast.js';

export function renderInventoryView(container, navigateTo, params = {}) {
  const products = state.products || [];
  const inventory = state.inventory || [];
  const purchases = state.purchases || [];
  const consumptions = state.consumptions || [];
  const cycles = state.cycles || [];

  const metricsList = products.map(p => {
    const inv = inventory.find(i => i.product_id === p.id);
    return calculateProductMetrics(p, purchases, consumptions, cycles, inv);
  });

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <div>
        <h1 style="font-size: 1.35rem; font-weight: 800;">Inventario</h1>
        <p style="color: var(--text-muted); font-size: 0.85rem;">Stock disponible y cálculo de duración</p>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-open-consume-modal">
        + Registrar Consumo
      </button>
    </div>

    ${metricsList.length === 0 ? `
      <div class="mc-card" style="text-align: center; padding: 32px 16px;">
        <div style="font-size: 2.5rem; margin-bottom: 8px;">📦</div>
        <h3 style="font-weight: 700;">No hay productos en inventario</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 4px;">Registra una compra o carga datos de prueba para comenzar.</p>
      </div>
    ` : `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${metricsList.map(m => {
          const isDepleted = m.currentStock <= 0;
          const isLow = !isDepleted && (m.daysRemaining !== null && m.daysRemaining <= 3);
          const badgeClass = isDepleted ? 'badge-depleted' : (isLow ? 'badge-low' : 'badge-normal');
          const badgeText = isDepleted ? '🔴 Agotado' : (isLow ? '🟡 Próximo a agotarse' : '🟢 Normal');
          
          // Porcentaje de stock relativo (usando stock promedio o alerta)
          const targetStock = m.monthlyRate > 0 ? (m.monthlyRate / 2) : 5;
          const percent = Math.min(100, Math.round((m.currentStock / targetStock) * 100));

          return `
            <div class="mc-card" style="padding: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <h3 style="font-size: 1.05rem; font-weight: 700;">${m.productName}</h3>
                  <div style="font-size: 0.8rem; color: var(--text-muted);">
                    Categoría: ${m.categoryName} • Consumo: ~${formatQuantity(m.dailyRate, m.baseUnit)}/día
                  </div>
                </div>
                <span class="badge ${badgeClass}">${badgeText}</span>
              </div>

              <!-- Barra de Stock -->
              <div class="progress-track">
                <div class="progress-fill ${isDepleted ? 'depleted' : (isLow ? 'low' : '')}" style="width: ${percent}%;"></div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; font-size: 0.85rem;">
                <div>
                  <strong>Stock:</strong> ${formatQuantity(m.currentStock, m.baseUnit)}
                </div>
                <div style="color: var(--text-muted);">
                  Duración aprox: <strong>${formatRelativeDays(m.daysRemaining)}</strong>
                </div>
              </div>

              <!-- Botones de Acción -->
              <div style="display: flex; gap: 8px; margin-top: 12px;">
                <button class="btn btn-secondary btn-sm btn-quick-consume" data-product-id="${m.productId}" style="flex: 1;">
                  🍽️ Consumir
                </button>
                <button class="btn btn-danger btn-sm btn-quick-deplete" data-product-id="${m.productId}" data-product-name="${m.productName}" style="flex: 1;">
                  ⚠️ ¡Se acabó!
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;

  // Listeners para botones de acción en tarjetas
  document.querySelectorAll('.btn-quick-consume').forEach(btn => {
    btn.addEventListener('click', () => {
      const prodId = btn.getAttribute('data-product-id');
      openConsumptionModal(prodId);
    });
  });

  document.querySelectorAll('.btn-quick-deplete').forEach(btn => {
    btn.addEventListener('click', () => {
      const prodId = btn.getAttribute('data-product-id');
      const prodName = btn.getAttribute('data-product-name');
      showConfirmDialog({
        title: '¿Registrar agotamiento?',
        message: `¿Confirmas que se terminó **${prodName}**? El sistema calculará automáticamente la duración de este ciclo para afinar tus predicciones.`,
        confirmText: 'Sí, ¡Se acabó!',
        isDanger: true,
        onConfirm: async () => {
          await registerDepletion(prodId);
          showToast(`Ciclo registrado para ${prodName} 🎯`, 'success');
          renderInventoryView(container, navigateTo);
        }
      });
    });
  });

  document.getElementById('btn-open-consume-modal')?.addEventListener('click', () => {
    openConsumptionModal();
  });

  if (params.openConsumeModal) {
    openConsumptionModal();
  }

  // Modal para Registrar Consumo
  function openConsumptionModal(preselectedProductId = null) {
    const modalContainer = document.getElementById('modal-container');
    const today = new Date().toISOString().split('T')[0];

    modalContainer.innerHTML = `
      <div class="modal-backdrop show" id="consume-modal-backdrop">
        <div class="modal-sheet">
          <div class="modal-header">
            <h2 style="font-size: 1.15rem; font-weight: 700;">+ Registrar Consumo</h2>
            <button class="btn btn-secondary btn-sm" id="btn-close-consume-modal" style="border:none; padding:4px 8px;">✕</button>
          </div>

          <form id="consume-form">
            <div class="form-group">
              <label class="form-label">Producto</label>
              <select class="form-select" id="consume-product-id" required>
                <option value="">Selecciona un producto...</option>
                ${products.map(p => `
                  <option value="${p.id}" ${p.id === preselectedProductId ? 'selected' : ''}>
                    ${p.name} (${p.base_unit})
                  </option>
                `).join('')}
              </select>
            </div>

            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Cantidad Consumida</label>
                <input type="number" step="any" min="0.01" class="form-input" id="consume-quantity" placeholder="Ej: 1 o 0.5" required>
              </div>
              <div class="form-group">
                <label class="form-label">Unidad</label>
                <select class="form-select" id="consume-unit">
                  <option value="unidad">unidad</option>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="L">L</option>
                  <option value="ml">ml</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Fecha de Consumo</label>
              <input type="date" class="form-input" id="consume-date" value="${today}" required>
            </div>

            <button type="submit" class="btn btn-primary" style="margin-top: 8px;">Guardar Consumo</button>
          </form>
        </div>
      </div>
    `;

    const backdrop = document.getElementById('consume-modal-backdrop');
    const closeBtn = document.getElementById('btn-close-consume-modal');
    const close = () => { modalContainer.innerHTML = ''; };

    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

    document.getElementById('consume-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const productId = document.getElementById('consume-product-id').value;
      const quantity = document.getElementById('consume-quantity').value;
      const unit = document.getElementById('consume-unit').value;
      const date = document.getElementById('consume-date').value;

      await registerConsumption({ productId, quantity, unit, date });
      showToast('Consumo registrado y descontado del inventario', 'success');
      close();
      renderInventoryView(container, navigateTo);
    });
  }
}
