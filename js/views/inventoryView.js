// Vista de Inventario Doméstico con Equivalencia de Unidades Invariante
import { state } from '../state.js';
import { formatQuantity, formatDate, formatRelativeDays } from '../utils/formatters.js';
import { calculateProductMetrics } from '../utils/forecasting.js';
import { parseUnitWeight } from '../utils/unitConverter.js';
import { registerConsumption, updateConsumption, deleteConsumption, updateInventoryStock, registerDepletion } from '../services/inventory.js';
import { showToast, showConfirmDialog } from '../utils/toast.js';

export function renderInventoryView(container, navigateTo, params = {}) {
  const products = state.products || [];
  const inventory = state.inventory || [];
  const purchases = state.purchases || [];
  const consumptions = state.consumptions || [];
  const cycles = state.cycles || [];

  let activeTab = params.tab || 'stock';

  const metricsList = products.map(p => {
    const inv = inventory.find(i => i.product_id === p.id);
    const unitWeight = parseUnitWeight(p.brand || inv?.brand);
    return {
      ...calculateProductMetrics(p, purchases, consumptions, cycles, inv),
      brand: p.brand || inv?.brand || '',
      unitWeight: unitWeight
    };
  });

  function render() {
    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <div>
          <h1 style="font-size: 1.35rem; font-weight: 800;">Inventario</h1>
          <p style="color: var(--text-muted); font-size: 0.85rem;">Stock disponible y cálculo exacto de unidades</p>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-open-consume-modal">
          + Consumo
        </button>
      </div>

      <!-- Pestañas de Vista -->
      <div style="display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
        <button class="btn btn-sm ${activeTab === 'stock' ? 'btn-primary' : 'btn-secondary'}" id="tab-stock-btn" style="flex: 1; font-weight: 700;">
          📦 Stock Actual (${metricsList.length})
        </button>
        <button class="btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}" id="tab-history-btn" style="flex: 1; font-weight: 700;">
          📋 Historial de Consumos (${consumptions.length})
        </button>
      </div>

      <div id="tab-content">
        ${activeTab === 'stock' ? renderStockTab() : renderHistoryTab()}
      </div>
    `;

    attachMainEvents();
  }

  function renderStockTab() {
    if (metricsList.length === 0) {
      return `
        <div class="mc-card" style="text-align: center; padding: 32px 16px;">
          <div style="font-size: 2.5rem; margin-bottom: 8px;">📦</div>
          <h3 style="font-weight: 700;">No hay productos en inventario</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 4px;">Registra una compra para comenzar a gestionar tu despensa.</p>
        </div>
      `;
    }

    return `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${metricsList.map(m => {
          const isDepleted = m.currentStock <= 0;
          const isLow = !isDepleted && (m.daysRemaining !== null && m.daysRemaining <= 3);
          const badgeClass = isDepleted ? 'badge-depleted' : (isLow ? 'badge-low' : 'badge-normal');
          const badgeText = isDepleted ? '🔴 Agotado' : (isLow ? '🟡 Próximo a agotarse' : '🟢 Normal');

          const targetStock = m.monthlyRate > 0 ? (m.monthlyRate / 2) : 5;
          const percent = Math.min(100, Math.round((m.currentStock / targetStock) * 100));

          // Cálculo exacto e invariante de unidades restantes
          let approxUnitsText = '';
          if (m.unitWeight && m.unitWeight > 0 && m.currentStock > 0 && m.baseUnit !== 'unidad') {
            const exactUnits = m.currentStock / m.unitWeight;
            const roundedUnits = Math.round(exactUnits * 10) / 10;
            approxUnitsText = `(~${roundedUnits % 1 === 0 ? roundedUnits.toFixed(0) : roundedUnits.toFixed(1)} ${roundedUnits === 1 ? 'unidad' : 'unidades'})`;
          }

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
              <div class="progress-track" style="margin-top: 10px;">
                <div class="progress-fill ${isDepleted ? 'depleted' : (isLow ? 'low' : '')}" style="width: ${percent}%;"></div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; font-size: 0.85rem;">
                <div>
                  <strong>Stock:</strong> ${formatQuantity(m.currentStock, m.baseUnit)}
                  ${approxUnitsText ? `<span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 6px; font-weight: 600; font-size: 0.75rem; margin-left: 4px;">${approxUnitsText}</span>` : ''}
                </div>
                <div style="color: var(--text-muted);">
                  Duración aprox: <strong>${formatRelativeDays(m.daysRemaining)}</strong>
                </div>
              </div>

              ${m.unitWeight ? `
                <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">
                  ⚖️ Peso fijo por pieza: 1 unidad = ${m.unitWeight >= 1 ? m.unitWeight.toFixed(2) + ' ' + m.baseUnit : (m.unitWeight * 1000).toFixed(0) + ' g'}
                </div>
              ` : ''}

              <!-- Botones de Acción -->
              <div style="display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 6px; margin-top: 12px;">
                <button class="btn btn-primary btn-sm btn-quick-consume" data-product-id="${m.productId}" style="padding: 6px 4px; font-size: 0.8rem;">
                  🍽️ Consumir
                </button>
                <button class="btn btn-secondary btn-sm btn-edit-stock" data-product-id="${m.productId}" style="padding: 6px 4px; font-size: 0.8rem;">
                  ✏️ Ajustar
                </button>
                <button class="btn btn-danger btn-sm btn-quick-deplete" data-product-id="${m.productId}" data-product-name="${m.productName}" style="padding: 6px 4px; font-size: 0.8rem;">
                  ⚠️ ¡Se acabó!
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderHistoryTab() {
    if (consumptions.length === 0) {
      return `
        <div class="mc-card" style="text-align: center; padding: 32px 16px;">
          <div style="font-size: 2.5rem; margin-bottom: 8px;">🍽️</div>
          <h3 style="font-weight: 700;">No hay consumos registrados</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 4px;">Usa el botón "+ Consumo" para registrar lo que vas gastando.</p>
        </div>
      `;
    }

    return `
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${consumptions.map(c => `
          <div class="mc-card" style="padding: 12px 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="font-size: 0.95rem;">${c.categoryIcon || '🍽️'} ${c.productName}</strong>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
                  📅 ${formatDate(c.consumption_date)}
                  ${c.is_depletion_event ? '<span class="badge badge-depleted" style="margin-left: 6px; font-size: 0.7rem;">¡Se acabó!</span>' : ''}
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 800; color: var(--primary-dark); font-size: 1rem;">
                  -${formatQuantity(c.quantity, c.unit)}
                </div>
                ${c.notes ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${c.notes}</div>` : ''}
              </div>
            </div>

            <!-- Botones Editar / Eliminar -->
            <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border);">
              <button class="btn btn-secondary btn-sm btn-edit-consumption" data-id="${c.id}" style="padding: 3px 8px; font-size: 0.75rem;">
                ✏️ Editar
              </button>
              <button class="btn btn-secondary btn-sm btn-delete-consumption" data-id="${c.id}" data-name="${c.productName}" data-qty="${c.quantity}" data-unit="${c.unit}" style="padding: 3px 8px; font-size: 0.75rem; color: var(--danger); border-color: #fecaca;">
                🗑️ Eliminar
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function attachMainEvents() {
    document.getElementById('tab-stock-btn')?.addEventListener('click', () => {
      activeTab = 'stock';
      render();
    });

    document.getElementById('tab-history-btn')?.addEventListener('click', () => {
      activeTab = 'history';
      render();
    });

    document.getElementById('btn-open-consume-modal')?.addEventListener('click', () => {
      openConsumptionModal();
    });

    document.querySelectorAll('.btn-quick-consume').forEach(btn => {
      btn.addEventListener('click', () => {
        const prodId = btn.getAttribute('data-product-id');
        openConsumptionModal(prodId);
      });
    });

    document.querySelectorAll('.btn-edit-stock').forEach(btn => {
      btn.addEventListener('click', () => {
        const prodId = btn.getAttribute('data-product-id');
        openAdjustStockModal(prodId);
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
            render();
          }
        });
      });
    });

    document.querySelectorAll('.btn-edit-consumption').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const cons = consumptions.find(c => c.id === id);
        if (cons) openEditConsumptionModal(cons);
      });
    });

    document.querySelectorAll('.btn-delete-consumption').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        const qty = btn.getAttribute('data-qty');
        const unit = btn.getAttribute('data-unit');
        const cons = consumptions.find(c => c.id === id);

        showConfirmDialog({
          title: '¿Eliminar este registro de consumo?',
          message: `Se eliminará el registro de **${formatQuantity(qty, unit)}** de **${name}** y se devolverá esa cantidad a tu stock actual.`,
          confirmText: 'Sí, Eliminar',
          isDanger: true,
          onConfirm: async () => {
            try {
              await deleteConsumption({ id, productId: cons.product_id, quantity: qty, unit });
              showToast('Registro eliminado y stock restaurado ✅', 'success');
              render();
            } catch (err) {
              showToast('Error al eliminar: ' + err.message, 'error');
            }
          }
        });
      });
    });
  }

  // Modal para Ajustar Stock e Información de Unidades
  function openAdjustStockModal(productId) {
    const modalContainer = document.getElementById('modal-container');
    const product = products.find(p => p.id === productId);
    const inv = inventory.find(i => i.product_id === productId);

    if (!product) return;

    const currentStock = inv ? inv.current_stock : 0;
    const currentUnit = inv ? inv.unit : (product.base_unit || 'kg');
    const minStock = product.min_stock_alert || 1;
    const currentUnitWeight = parseUnitWeight(product.brand);

    // Si ya existe unitWeight, calcular cuántas unidades representa el stock actual
    let initialUnits = '';
    if (currentUnitWeight && currentUnitWeight > 0 && currentStock > 0) {
      initialUnits = (currentStock / currentUnitWeight).toFixed(0);
    }

    modalContainer.innerHTML = `
      <div class="modal-backdrop show" id="adjust-stock-backdrop">
        <div class="modal-sheet">
          <div class="modal-header">
            <h2 style="font-size: 1.15rem; font-weight: 700;">✏️ Ajustar Stock y Unidades</h2>
            <button class="btn btn-secondary btn-sm" id="btn-close-adjust-modal" style="border:none; padding:4px 8px;">✕</button>
          </div>

          <form id="adjust-stock-form">
            <div class="form-group">
              <label class="form-label">Producto</label>
              <input type="text" class="form-input" value="${product.name}" disabled style="background: var(--bg-main); opacity: 0.9; font-weight: 600;">
            </div>

            <!-- Stock disponible -->
            <div style="display: grid; grid-template-columns: 1.8fr 1.2fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Stock Actual</label>
                <input type="number" step="any" min="0" class="form-input" id="adj-stock-qty" value="${currentStock}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Unidad Base</label>
                <select class="form-select" id="adj-stock-unit">
                  ${['kg','g','unidad','L','ml','paquete','bolsa','caja','lb'].map(u => `
                    <option value="${u}" ${u === currentUnit ? 'selected' : ''}>${u}</option>
                  `).join('')}
                </select>
              </div>
            </div>

            <!-- Equivalencia en unidades -->
            <div class="form-group">
              <label class="form-label" style="display: flex; justify-content: space-between;">
                <span>¿A cuántas unidades equivale este stock?</span>
              </label>
              <input type="number" step="any" min="0.1" class="form-input" id="adj-units-count" value="${initialUnits}" placeholder="Ej: 3 (plátanos, manzanas...)">
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 8px 10px; border-radius: 8px; margin-top: 6px; font-size: 0.8rem; font-weight: 600;" id="adj-unit-calc">
                Calculando equivalencia...
              </div>
            </div>

            <!-- Alerta Stock Mínimo -->
            <div class="form-group">
              <label class="form-label">Alerta de Stock Mínimo</label>
              <input type="number" step="any" min="0" class="form-input" id="adj-min-stock" value="${minStock}">
            </div>

            <button type="submit" class="btn btn-primary" id="btn-save-adj-stock" style="margin-top: 8px;">Guardar Ajuste</button>
          </form>
        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-adjust-modal')?.addEventListener('click', close);
    document.getElementById('adjust-stock-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'adjust-stock-backdrop') close();
    });

    let currentCalculatedWeight = currentUnitWeight;

    const updateCalc = () => {
      const stockVal = parseFloat(document.getElementById('adj-stock-qty').value) || 0;
      const unitVal = document.getElementById('adj-stock-unit').value;
      const unitsVal = parseFloat(document.getElementById('adj-units-count').value) || 0;
      const calcEl = document.getElementById('adj-unit-calc');

      if (stockVal > 0 && unitsVal > 0 && unitVal !== 'unidad') {
        currentCalculatedWeight = stockVal / unitsVal;
        const weightStr = currentCalculatedWeight >= 1 ? `${currentCalculatedWeight.toFixed(2)} ${unitVal}` : `${(currentCalculatedWeight * 1000).toFixed(0)} g`;
        calcEl.style.display = 'block';
        calcEl.innerHTML = `⚖️ <strong>Peso fijo por unidad:</strong> 1 ${product.name} = ${weightStr}.<br><span style="font-weight: 400; font-size: 0.75rem; color: #15803d;">Este peso se mantendrá fijo cada vez que consumas piezas individuales.</span>`;
      } else {
        calcEl.style.display = 'none';
        currentCalculatedWeight = null;
      }
    };

    document.getElementById('adj-stock-qty')?.addEventListener('input', updateCalc);
    document.getElementById('adj-units-count')?.addEventListener('input', updateCalc);
    document.getElementById('adj-stock-unit')?.addEventListener('change', updateCalc);
    updateCalc();

    document.getElementById('adjust-stock-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-save-adj-stock');
      btn.disabled = true;
      btn.innerText = 'Guardando...';

      const newStock = document.getElementById('adj-stock-qty').value;
      const newUnit = document.getElementById('adj-stock-unit').value;
      const approxUnits = document.getElementById('adj-units-count').value;
      const minStockAlert = document.getElementById('adj-min-stock').value;

      try {
        await updateInventoryStock({
          productId,
          currentStock: newStock,
          unit: newUnit,
          unitWeight: currentCalculatedWeight,
          approxUnits,
          minStockAlert
        });
        showToast('Stock y peso unitario fijo guardados ✅', 'success');
        close();
        render();
      } catch (err) {
        showToast('Error al actualizar: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerText = 'Guardar Ajuste';
      }
    });
  }

  // Modal para Registrar Consumo (con Asistente Inteligente)
  function openConsumptionModal(preselectedProductId = null) {
    const modalContainer = document.getElementById('modal-container');
    const today = new Date().toISOString().split('T')[0];

    const prod = products.find(p => p.id === preselectedProductId);
    const defaultUnit = prod ? prod.base_unit : 'kg';

    modalContainer.innerHTML = `
      <div class="modal-backdrop show" id="consume-modal-backdrop">
        <div class="modal-sheet">
          <div class="modal-header">
            <h2 style="font-size: 1.15rem; font-weight: 700;">🍽️ Registrar Consumo</h2>
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

            <div id="consume-equivalence-hint" style="display: none; background: #e0f2fe; color: #0369a1; padding: 8px 10px; border-radius: 8px; font-size: 0.8rem; margin-bottom: 12px; font-weight: 500;">
            </div>

            <div style="display: grid; grid-template-columns: 1.8fr 1.2fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Cantidad Consumida</label>
                <input type="number" step="any" min="0.001" class="form-input" id="consume-quantity" placeholder="Ej: 2 o 0.5" required>
              </div>
              <div class="form-group">
                <label class="form-label">Unidad</label>
                <select class="form-select" id="consume-unit">
                  ${['unidad','kg','g','L','ml','paquete','bolsa','caja','lb'].map(u => `
                    <option value="${u}" ${u === defaultUnit ? 'selected' : ''}>${u}</option>
                  `).join('')}
                </select>
              </div>
            </div>

            <!-- Previsualización del descuento real -->
            <div id="consume-live-calc" style="display: none; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 6px 10px; border-radius: 6px; font-size: 0.8rem; margin-bottom: 10px;">
            </div>

            <div class="form-group">
              <label class="form-label">Fecha de Consumo</label>
              <input type="date" class="form-input" id="consume-date" value="${today}" required>
            </div>

            <div class="form-group">
              <label class="form-label">Notas / Receta <small style="color: var(--text-muted);">(Opcional)</small></label>
              <input type="text" class="form-input" id="consume-notes" placeholder="Ej: Desayuno, almuerzo, etc.">
            </div>

            <button type="submit" class="btn btn-primary" id="btn-save-consume" style="margin-top: 8px;">Guardar Consumo</button>
          </form>
        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-consume-modal')?.addEventListener('click', close);
    document.getElementById('consume-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'consume-modal-backdrop') close();
    });

    let currentSelectedProd = prod || null;

    const updateProductHint = (pId) => {
      currentSelectedProd = products.find(p => p.id === pId);
      const hintEl = document.getElementById('consume-equivalence-hint');
      const unitEl = document.getElementById('consume-unit');

      if (!currentSelectedProd) {
        if (hintEl) hintEl.style.display = 'none';
        return;
      }

      const unitWeight = parseUnitWeight(currentSelectedProd.brand);
      const inv = inventory.find(i => i.product_id === pId);
      const currentStock = inv ? Number(inv.current_stock) : 0;

      if (unitWeight && unitWeight > 0 && currentSelectedProd.base_unit !== 'unidad') {
        const remainingUnits = (currentStock / unitWeight).toFixed(1);
        const weightStr = unitWeight >= 1 ? `${unitWeight.toFixed(2)} ${currentSelectedProd.base_unit}` : `${(unitWeight * 1000).toFixed(0)} g`;
        hintEl.style.display = 'block';
        hintEl.innerHTML = `💡 <strong>Equivalencia fija:</strong> 1 unidad = ${weightStr}.<br>Stock actual: <strong>${currentStock} ${currentSelectedProd.base_unit}</strong> (~${remainingUnits} unidades).`;
      } else {
        hintEl.style.display = 'none';
      }

      updateLiveCalc();
    };

    const updateLiveCalc = () => {
      const qty = parseFloat(document.getElementById('consume-quantity')?.value) || 0;
      const unit = document.getElementById('consume-unit')?.value || '';
      const calcEl = document.getElementById('consume-live-calc');

      if (!calcEl) return;

      if (!currentSelectedProd || qty <= 0) {
        calcEl.style.display = 'none';
        return;
      }

      const unitWeight = parseUnitWeight(currentSelectedProd.brand);

      if (unit.toLowerCase() === 'unidad' && currentSelectedProd.base_unit !== 'unidad' && unitWeight) {
        const deductedKg = qty * unitWeight;
        calcEl.style.display = 'block';
        calcEl.innerHTML = `🔻 Se descontarán <strong>${deductedKg.toFixed(2)} ${currentSelectedProd.base_unit}</strong> de tu inventario.`;
      } else if (unit.toLowerCase() !== 'unidad' && currentSelectedProd.base_unit !== 'unidad' && unitWeight) {
        const approxPieces = (qty / unitWeight).toFixed(1);
        calcEl.style.display = 'block';
        calcEl.innerHTML = `🔻 ${qty} ${unit} equivale a consumir <strong>~${approxPieces} ${approxPieces === '1.0' ? 'unidad' : 'unidades'}</strong>.`;
      } else {
        calcEl.style.display = 'none';
      }
    };

    document.getElementById('consume-product-id')?.addEventListener('change', (e) => {
      updateProductHint(e.target.value);
    });
    document.getElementById('consume-quantity')?.addEventListener('input', updateLiveCalc);
    document.getElementById('consume-unit')?.addEventListener('change', updateLiveCalc);

    if (preselectedProductId) {
      updateProductHint(preselectedProductId);
    }

    document.getElementById('consume-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-save-consume');
      btn.disabled = true;
      btn.innerText = 'Guardando...';

      const productId = document.getElementById('consume-product-id').value;
      const quantity = document.getElementById('consume-quantity').value;
      const unit = document.getElementById('consume-unit').value;
      const date = document.getElementById('consume-date').value;
      const notes = document.getElementById('consume-notes').value;

      try {
        await registerConsumption({ productId, quantity, unit, date, notes });
        showToast('Consumo registrado y stock descontado con exactitud ✅', 'success');
        close();
        render();
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerText = 'Guardar Consumo';
      }
    });
  }

  // Modal para Editar Consumo Existente
  function openEditConsumptionModal(cons) {
    const modalContainer = document.getElementById('modal-container');

    let unitsMatch = cons.notes ? cons.notes.match(/^\((\d+(?:\.\d+)?)\s*unidades?\)(?:\s*-\s*(.*))?$/) : null;
    let initialUnits = unitsMatch ? unitsMatch[1] : '';
    let initialNotes = unitsMatch ? (unitsMatch[2] || '') : (cons.notes || '');

    modalContainer.innerHTML = `
      <div class="modal-backdrop show" id="edit-consume-modal-backdrop">
        <div class="modal-sheet">
          <div class="modal-header">
            <h2 style="font-size: 1.15rem; font-weight: 700;">✏️ Editar Consumo</h2>
            <button class="btn btn-secondary btn-sm" id="btn-close-edit-modal" style="border:none; padding:4px 8px;">✕</button>
          </div>

          <form id="edit-consume-form">
            <div class="form-group">
              <label class="form-label">Producto</label>
              <input type="text" class="form-input" value="${cons.productName}" disabled style="background: var(--bg-main); opacity: 0.85;">
            </div>

            <div style="display: grid; grid-template-columns: 1.8fr 1.2fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Cantidad Consumida</label>
                <input type="number" step="any" min="0.001" class="form-input" id="edit-consume-quantity" value="${cons.quantity}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Unidad</label>
                <select class="form-select" id="edit-consume-unit">
                  ${['unidad','kg','g','L','ml','paquete','bolsa','caja','lb'].map(u => `
                    <option value="${u}" ${u === cons.unit ? 'selected' : ''}>${u}</option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Fecha de Consumo</label>
              <input type="date" class="form-input" id="edit-consume-date" value="${cons.consumption_date}" required>
            </div>

            <div class="form-group">
              <label class="form-label">Notas / Receta <small style="color: var(--text-muted);">(Opcional)</small></label>
              <input type="text" class="form-input" id="edit-consume-notes" value="${initialNotes}" placeholder="Ej: Almuerzo, jugo, etc.">
            </div>

            <button type="submit" class="btn btn-primary" id="btn-save-edit-consume" style="margin-top: 8px;">Guardar Cambios</button>
          </form>
        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-edit-modal')?.addEventListener('click', close);
    document.getElementById('edit-consume-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'edit-consume-modal-backdrop') close();
    });

    document.getElementById('edit-consume-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-save-edit-consume');
      btn.disabled = true;
      btn.innerText = 'Guardando...';

      const newQty = document.getElementById('edit-consume-quantity').value;
      const newUnit = document.getElementById('edit-consume-unit').value;
      const date = document.getElementById('edit-consume-date').value;
      const notes = document.getElementById('edit-consume-notes').value;

      try {
        await updateConsumption({
          id: cons.id,
          productId: cons.product_id,
          oldQuantity: cons.quantity,
          oldUnit: cons.unit,
          newQuantity: newQty,
          newUnit: newUnit,
          date: date,
          notes: notes
        });
        showToast('Registro de consumo actualizado y stock recalculado ✅', 'success');
        close();
        render();
      } catch (err) {
        showToast('Error al actualizar: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerText = 'Guardar Cambios';
      }
    });
  }

  render();

  if (params.openConsumeModal) {
    openConsumptionModal();
  }
}
