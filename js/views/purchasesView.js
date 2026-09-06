// Vista de Historial y Gestión de Compras (Crear, Editar y Eliminar)
import { state } from '../state.js';
import { formatCurrency, formatDate, formatQuantity } from '../utils/formatters.js';
import { registerPurchase, updatePurchase, deletePurchase } from '../services/purchases.js';
import { createProduct, fetchProducts } from '../services/products.js';
import { createStore, fetchStores } from '../services/stores.js';
import { showToast, showConfirmDialog } from '../utils/toast.js';
import { exportPurchasesToCSV } from '../utils/exporter.js';

export function renderPurchasesView(container, navigateTo, params = {}) {
  const purchases = state.purchases || [];

  function render() {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div>
          <h1 style="font-size:1.35rem; font-weight:800;">Compras</h1>
          <p style="color:var(--text-muted); font-size:0.85rem;">Historial y registro de facturas</p>
        </div>
        <div style="display:flex; gap:8px;">
          ${purchases.length > 0 ? `
            <button class="btn btn-secondary btn-sm" id="btn-export-purchases-csv" style="font-size:0.75rem; font-weight:700; padding:6px 10px;" title="Exportar a Excel">
              📊 Excel
            </button>
          ` : ''}
          <button class="btn btn-primary btn-sm" id="btn-open-purchase-modal">+ Nueva Compra</button>
        </div>
      </div>

      ${purchases.length === 0 ? `
        <div class="mc-card" style="text-align:center; padding:32px 16px;">
          <div style="font-size:2.5rem; margin-bottom:8px;">🛒</div>
          <h3 style="font-weight:700;">No hay compras registradas</h3>
          <p style="color:var(--text-muted); font-size:0.9rem; margin-top:4px;">
            Presiona <strong>+ Nueva Compra</strong> o escanea una factura para empezar.
          </p>
        </div>
      ` : `
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${purchases.map(p => `
            <div class="mc-card" style="padding:14px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="font-weight:700; font-size:1rem;">🏪 ${p.storeName || 'Comercio'}</span>
                <span style="font-weight:800; color:var(--primary-dark); font-size:1.1rem;">${formatCurrency(p.total_amount)}</span>
              </div>

              <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted); margin-bottom:8px;">
                <span>📅 ${formatDate(p.purchase_date)}</span>
                <span>💳 ${p.payment_method || 'Efectivo'}</span>
              </div>

              <!-- Lista de ítems comprados -->
              <div style="background:var(--bg-main); border-radius:8px; padding:8px 10px; font-size:0.85rem; margin-bottom:10px;">
                ${(p.items || []).map(it => `
                  <div style="display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px dashed var(--border);">
                    <span>
                      ${it.categoryIcon || '📦'} <strong>${it.productName || 'Producto'}</strong> (${formatQuantity(it.quantity, it.unit)})
                      ${it.notes ? `<small style="color:var(--text-muted); margin-left:4px;">${it.notes}</small>` : ''}
                    </span>
                    <span style="font-weight:600;">${formatCurrency(it.total_price)}</span>
                  </div>
                `).join('')}
              </div>

              <!-- Botones de Acción (Editar / Eliminar) -->
              <div style="display:flex; justify-content:flex-end; gap:8px;">
                <button class="btn btn-secondary btn-sm btn-edit-purchase" data-id="${p.id}" style="padding:4px 10px; font-size:0.78rem;">
                  ✏️ Editar
                </button>
                <button class="btn btn-secondary btn-sm btn-delete-purchase" data-id="${p.id}" data-store="${p.storeName}" data-total="${p.total_amount}"
                        style="padding:4px 10px; font-size:0.78rem; color:var(--danger); border-color:#fecaca;">
                  🗑️ Eliminar
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;

    attachEvents();
  }

  function attachEvents() {
    document.getElementById('btn-open-purchase-modal')?.addEventListener('click', () => openPurchaseModal());

    document.getElementById('btn-export-purchases-csv')?.addEventListener('click', () => {
      try {
        exportPurchasesToCSV(state.purchases, state.products, state.stores, state.categories);
        showToast('¡Compras exportadas a Excel (CSV) exitosamente! 📊', 'success');
      } catch (err) {
        showToast(err.message || 'Error al exportar compras', 'error');
      }
    });

    document.querySelectorAll('.btn-edit-purchase').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const pur = purchases.find(p => p.id === id);
        if (pur) openPurchaseModal(pur);
      });
    });

    document.querySelectorAll('.btn-delete-purchase').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const store = btn.getAttribute('data-store');
        const total = btn.getAttribute('data-total');

        showConfirmDialog({
          title: '¿Eliminar esta compra?',
          message: `Se eliminará la factura de **${store}** por **${formatCurrency(total)}** y se descontarán automáticamente los productos sumados de tu inventario.`,
          confirmText: 'Sí, Eliminar Compra',
          isDanger: true,
          onConfirm: async () => {
            try {
              await deletePurchase(id);
              showToast('Compra eliminada y stock restaurado correctamente ✅', 'success');
              render();
            } catch (err) {
              showToast('Error al eliminar: ' + err.message, 'error');
            }
          }
        });
      });
    });
  }

  // ── Modal de Compra (Creación y Edición) ──────────────────────────────────
  function openPurchaseModal(existingPurchase = null) {
    const mc = document.getElementById('modal-container');
    const isEdit = Boolean(existingPurchase);
    const today = new Date().toISOString().split('T')[0];

    let stores     = [...(state.stores     || [])];
    let products   = [...(state.products   || [])];
    let categories = [...(state.categories || [])];

    let items = isEdit
      ? (existingPurchase.items || []).map(it => ({
          product_id: it.product_id,
          quantity: it.quantity,
          unit: it.unit,
          unit_price: it.unit_price || (it.total_price / it.quantity),
          total_price: it.total_price
        }))
      : [{ product_id: '', quantity: 1, unit: 'kg', unit_price: 0 }];

    if (items.length === 0) items.push({ product_id: '', quantity: 1, unit: 'kg', unit_price: 0 });

    function productOptions(selectedId) {
      return '<option value="">Selecciona un producto...</option>' +
        products.map(p => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.categoryIcon || '📦'} ${p.name} (${p.base_unit})</option>`).join('');
    }

    function totalAmount() {
      return items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0);
    }

    function renderModal() {
      const units = ['kg','g','unidad','L','ml','paquete','bolsa','caja','lb','docena'];

      mc.innerHTML = `
        <div class="modal-backdrop show" id="modal-purchase-backdrop">
          <div class="modal-sheet">
            <div class="modal-header">
              <h2 style="font-size:1.15rem; font-weight:700;">
                ${isEdit ? '✏️ Editar Compra' : '🛒 Registrar Compra'}
              </h2>
              <button class="btn btn-secondary btn-sm" id="btn-close-modal" style="border:none; padding:4px 8px;">✕</button>
            </div>

            <form id="form-purchase">
              <!-- Tienda -->
              <div class="form-group">
                <label class="form-label">Establecimiento / Supermercado</label>
                <div style="display:flex; gap:6px;">
                  <select class="form-select" id="p-store" style="flex:1;">
                    <option value="">Selecciona una tienda...</option>
                    ${stores.map(s => `<option value="${s.id}" ${(isEdit ? existingPurchase.store_id : '') === s.id ? 'selected' : ''}>🏪 ${s.name}</option>`).join('')}
                  </select>
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-quick-new-store" style="white-space:nowrap;">+ Tienda</button>
                </div>
              </div>

              <!-- Fecha y Método de Pago -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div class="form-group">
                  <label class="form-label">Fecha</label>
                  <input type="date" class="form-input" id="p-date" value="${isEdit ? existingPurchase.purchase_date : today}" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Método de Pago</label>
                  <select class="form-select" id="p-payment">
                    ${['Efectivo','Tarjeta Débito','Tarjeta Crédito','Nequi','Daviplata'].map(m => `
                      <option ${(isEdit ? existingPurchase.payment_method : 'Efectivo') === m ? 'selected' : ''}>${m}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <!-- Productos -->
              <div style="margin:16px 0 10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <label class="form-label" style="margin:0; font-weight:700;">Productos de la Compra</label>
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-add-item" style="font-size:0.75rem; padding:3px 8px;">+ Producto</button>
                </div>

                <div id="items-container">
                  ${items.map((it, idx) => `
                    <div style="background:var(--bg-main); border:1px solid var(--border); border-radius:12px; padding:10px; margin-bottom:8px;" id="p-item-row-${idx}">
                      <div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">
                        <select class="form-select item-prod" data-idx="${idx}" style="flex:1; font-size:0.85rem; font-weight:600;">
                          ${productOptions(it.product_id)}
                        </select>
                        <button type="button" class="btn btn-secondary btn-sm btn-quick-new-prod" data-idx="${idx}" style="padding:4px 8px; font-size:0.75rem;">+ Prod</button>
                        ${items.length > 1 ? `
                          <button type="button" class="btn btn-secondary btn-sm btn-del-item" data-idx="${idx}" style="color:var(--danger); border-color:#fecaca; padding:4px 8px;">✕</button>
                        ` : ''}
                      </div>

                      <div style="display:grid; grid-template-columns:1fr 1fr 1.2fr; gap:6px;">
                        <div>
                          <label style="font-size:0.7rem; color:var(--text-muted); display:block;">Cantidad</label>
                          <input type="number" step="any" min="0.001" class="form-input item-qty" data-idx="${idx}" value="${it.quantity}" style="font-size:0.85rem; padding:6px;">
                        </div>
                        <div>
                          <label style="font-size:0.7rem; color:var(--text-muted); display:block;">Unidad</label>
                          <select class="form-select item-unit" data-idx="${idx}" style="font-size:0.82rem; padding:6px;">
                            ${units.map(u => `<option value="${u}" ${it.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
                          </select>
                        </div>
                        <div>
                          <label style="font-size:0.7rem; color:var(--text-muted); display:block;">Precio Unit.</label>
                          <input type="number" step="100" class="form-input item-price" data-idx="${idx}" value="${it.unit_price}" style="font-size:0.85rem; padding:6px;">
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- Total -->
              <div style="background:linear-gradient(135deg, #10b981 0%, #047857 100%); color:white; border-radius:12px; padding:12px 14px; text-align:right; margin-bottom:14px;">
                <span style="font-size:0.78rem; opacity:0.9;">TOTAL DE LA COMPRA</span>
                <div id="modal-total-display" style="font-size:1.4rem; font-weight:800;">
                  ${formatCurrency(totalAmount())}
                </div>
              </div>

              <button type="submit" class="btn btn-primary" id="btn-save-purchase-action" style="width:100%;">
                ${isEdit ? 'Guardar Cambios y Recalcular Stock ✅' : 'Guardar Compra en Despensa ✅'}
              </button>
            </form>
          </div>
        </div>
      `;

      attachModalEvents();
    }

    function attachModalEvents() {
      const close = () => { mc.innerHTML = ''; };
      document.getElementById('btn-close-modal')?.addEventListener('click', close);
      document.getElementById('modal-purchase-backdrop')?.addEventListener('click', (e) => {
        if (e.target.id === 'modal-purchase-backdrop') close();
      });

      document.getElementById('btn-add-item')?.addEventListener('click', () => {
        items.push({ product_id: '', quantity: 1, unit: 'kg', unit_price: 0 });
        renderModal();
      });

      document.querySelectorAll('.btn-del-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-idx'));
          items.splice(idx, 1);
          renderModal();
        });
      });

      document.querySelectorAll('.item-prod').forEach(sel => {
        sel.addEventListener('change', (e) => {
          const idx = parseInt(e.target.getAttribute('data-idx'));
          items[idx].product_id = e.target.value;
          const p = products.find(prod => prod.id === e.target.value);
          if (p) items[idx].unit = p.base_unit || items[idx].unit;
          renderModal();
        });
      });

      document.querySelectorAll('.item-qty').forEach(inp => {
        inp.addEventListener('input', (e) => {
          const idx = parseInt(e.target.getAttribute('data-idx'));
          items[idx].quantity = parseFloat(e.target.value) || 0;
          const totEl = document.getElementById('modal-total-display');
          if (totEl) totEl.textContent = formatCurrency(totalAmount());
        });
      });

      document.querySelectorAll('.item-unit').forEach(sel => {
        sel.addEventListener('change', (e) => {
          const idx = parseInt(e.target.getAttribute('data-idx'));
          items[idx].unit = e.target.value;
        });
      });

      document.querySelectorAll('.item-price').forEach(inp => {
        inp.addEventListener('input', (e) => {
          const idx = parseInt(e.target.getAttribute('data-idx'));
          items[idx].unit_price = parseFloat(e.target.value) || 0;
          const totEl = document.getElementById('modal-total-display');
          if (totEl) totEl.textContent = formatCurrency(totalAmount());
        });
      });

      // Crear tienda rápida
      document.getElementById('btn-quick-new-store')?.addEventListener('click', async () => {
        const name = prompt('Nombre del supermercado / tienda:');
        if (name && name.trim()) {
          const newS = await createStore({ name: name.trim() });
          await fetchStores();
          stores = [...(state.stores || [])];
          renderModal();
          const sel = document.getElementById('p-store');
          if (sel) sel.value = newS.id;
        }
      });

      // Crear producto rápido
      document.querySelectorAll('.btn-quick-new-prod').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idx = parseInt(btn.getAttribute('data-idx'));
          const name = prompt('Nombre del nuevo producto:');
          if (name && name.trim()) {
            const newP = await createProduct({ name: name.trim(), baseUnit: items[idx].unit || 'unidad' });
            await fetchProducts();
            products = [...(state.products || [])];
            items[idx].product_id = newP.id;
            renderModal();
          }
        });
      });

      document.getElementById('form-purchase')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById('btn-save-purchase-action');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando...';

        const storeId = document.getElementById('p-store').value;
        const purchaseDate = document.getElementById('p-date').value;
        const paymentMethod = document.getElementById('p-payment').value;

        const validItems = items.filter(it => it.product_id && it.quantity > 0);
        if (validItems.length === 0) {
          showToast('Selecciona al menos un producto válido', 'error');
          saveBtn.disabled = false;
          saveBtn.textContent = 'Guardar';
          return;
        }

        try {
          if (isEdit) {
            await updatePurchase({
              purchaseId: existingPurchase.id,
              storeId,
              purchaseDate,
              paymentMethod,
              items: validItems
            });
            showToast('¡Compra actualizada y stock recalculado! ✅', 'success');
          } else {
            await registerPurchase({
              storeId,
              purchaseDate,
              paymentMethod,
              items: validItems
            });
            showToast('¡Compra guardada en despensa! ✅', 'success');
          }

          close();
          render();
        } catch (err) {
          showToast('Error al guardar: ' + err.message, 'error');
          saveBtn.disabled = false;
          saveBtn.textContent = 'Guardar';
        }
      });
    }

    renderModal();
  }

  render();
  if (params.openModal) openPurchaseModal();
}
