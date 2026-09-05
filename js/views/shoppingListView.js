// Vista de Lista de Compras Inteligente Autogenerada desde el Inventario
import { state } from '../state.js';
import { formatQuantity } from '../utils/formatters.js';
import { calculateProductMetrics } from '../utils/forecasting.js';
import { showToast } from '../utils/toast.js';

const LS_KEY = 'mc_shopping_checked';

function getChecked() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function saveChecked(obj) {
  localStorage.setItem(LS_KEY, JSON.stringify(obj));
}

export function renderShoppingListView(container, navigateTo) {
  const products     = state.products     || [];
  const inventory    = state.inventory    || [];
  const purchases    = state.purchases    || [];
  const consumptions = state.consumptions || [];
  const cycles       = state.cycles       || [];

  // Calcular métricas de cada producto
  const metrics = products.map(p => {
    const inv = inventory.find(i => i.product_id === p.id);
    return {
      ...calculateProductMetrics(p, purchases, consumptions, cycles, inv),
      categoryName: p.categoryName || 'General',
      categoryIcon: p.categoryIcon || '📦'
    };
  });

  // Filtrar: solo los que están agotados o con stock para ≤ 3 días
  const needed = metrics.filter(m => m.currentStock <= 0 || (m.daysRemaining !== null && m.daysRemaining <= 3));
  const optional = metrics.filter(m => m.daysRemaining !== null && m.daysRemaining > 3 && m.daysRemaining <= 7);

  let checked = getChecked();

  function render() {
    checked = getChecked();

    const urgentCount   = needed.filter(m => !checked[m.productId]).length;
    const optionalCount = optional.filter(m => !checked[m.productId]).length;

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <div>
          <h1 style="font-size: 1.35rem; font-weight: 800;">🛒 Lista de Compras</h1>
          <p style="color: var(--text-muted); font-size: 0.85rem;">Generada automáticamente desde tu despensa</p>
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-clear-checks" style="font-size: 0.78rem;">
          ↺ Reiniciar
        </button>
      </div>

      <!-- Resumen Rápido -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px;">
        <div class="mc-card" style="text-align: center; padding: 14px 10px; border: 2px solid #ef4444;">
          <div style="font-size: 1.8rem; font-weight: 800; color: #ef4444;">${urgentCount}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">Urgentes (0–3 días)</div>
        </div>
        <div class="mc-card" style="text-align: center; padding: 14px 10px; border: 2px solid #f59e0b;">
          <div style="font-size: 1.8rem; font-weight: 800; color: #f59e0b;">${optionalCount}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">Pronto (4–7 días)</div>
        </div>
      </div>

      ${needed.length === 0 && optional.length === 0 ? `
        <div class="mc-card" style="text-align: center; padding: 40px 20px;">
          <div style="font-size: 3rem; margin-bottom: 10px;">🎉</div>
          <h3 style="font-weight: 700;">¡Tu despensa está bien surtida!</h3>
          <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 6px;">
            Ningún producto necesita reposición en los próximos días.
          </p>
        </div>
      ` : `
        <!-- Urgentes -->
        ${needed.length > 0 ? `
          <h2 style="font-size: 1rem; font-weight: 800; color: #ef4444; margin-bottom: 8px;">🔴 Comprar Ya (agotados o ≤ 3 días)</h2>
          <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
            ${needed.map(m => itemRow(m, 'urgent')).join('')}
          </div>
        ` : ''}

        <!-- Próximamente -->
        ${optional.length > 0 ? `
          <h2 style="font-size: 1rem; font-weight: 800; color: #f59e0b; margin-bottom: 8px;">🟡 Pronto por Agotarse (4–7 días)</h2>
          <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
            ${optional.map(m => itemRow(m, 'optional')).join('')}
          </div>
        ` : ''}
      `}

      <!-- Botón para ir a escanear la nueva factura -->
      ${(needed.length > 0 || optional.length > 0) ? `
        <button class="btn btn-primary" id="btn-go-scan" style="width: 100%; margin-top: 4px; font-size: 1rem;">
          📷 Ir a Escanear Factura Nueva
        </button>
      ` : ''}
    `;

    document.getElementById('btn-clear-checks')?.addEventListener('click', () => {
      saveChecked({});
      render();
      showToast('Lista reiniciada ✅', 'success');
    });

    document.getElementById('btn-go-scan')?.addEventListener('click', () => navigateTo('scan'));

    // Checkboxes
    document.querySelectorAll('.shop-item-check').forEach(cb => {
      cb.addEventListener('change', () => {
        const pid = cb.getAttribute('data-pid');
        const c = getChecked();
        if (cb.checked) c[pid] = true; else delete c[pid];
        saveChecked(c);
        // Solo actualizar el estado visual sin re-renderizar todo
        const row = document.getElementById(`shop-row-${pid}`);
        if (row) {
          row.style.opacity = cb.checked ? '0.45' : '1';
          row.style.textDecoration = cb.checked ? 'line-through' : 'none';
        }
      });
    });
  }

  function itemRow(m, type) {
    const isDone = checked[m.productId];
    const border = type === 'urgent' ? '#fecaca' : '#fde68a';
    const stockText = m.currentStock <= 0
      ? '<span style="color:#ef4444; font-weight:700;">Agotado</span>'
      : `Stock: <strong>${formatQuantity(m.currentStock, m.baseUnit)}</strong> (~${Math.round(m.daysRemaining)} días)`;

    return `
      <div id="shop-row-${m.productId}"
           style="background: var(--bg-card); border: 1.5px solid ${border}; border-radius: 12px; padding: 12px 14px;
                  display: flex; align-items: center; gap: 12px;
                  opacity: ${isDone ? '0.45' : '1'};
                  text-decoration: ${isDone ? 'line-through' : 'none'};">
        <input type="checkbox" class="shop-item-check" data-pid="${m.productId}" ${isDone ? 'checked' : ''}
               style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--primary); flex-shrink: 0;">
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 700; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${m.categoryIcon} ${m.productName}
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">${stockText}</div>
        </div>
        <div style="font-size: 0.72rem; color: var(--text-muted); text-align: right; flex-shrink: 0;">
          ${m.categoryName}
        </div>
      </div>
    `;
  }

  render();
}
