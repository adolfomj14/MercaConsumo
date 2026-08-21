// Vista de Historial y Registro de Compras
import { state } from '../state.js';
import { formatCurrency, formatDate, formatQuantity } from '../utils/formatters.js';
import { registerPurchase } from '../services/purchases.js';
import { createProduct } from '../services/products.js';
import { showToast } from '../utils/toast.js';

export function renderPurchasesView(container, navigateTo, params = {}) {
  const purchases = state.purchases || [];
  const stores = state.stores || [];
  const products = state.products || [];

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <div>
        <h1 style="font-size: 1.35rem; font-weight: 800;">Compras</h1>
        <p style="color: var(--text-muted); font-size: 0.85rem;">Historial y registro de facturas</p>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-open-purchase-modal">
        + Nueva Compra
      </button>
    </div>

    ${purchases.length === 0 ? `
      <div class="mc-card" style="text-align: center; padding: 32px 16px;">
        <div style="font-size: 2.5rem; margin-bottom: 8px;">🛒</div>
        <h3 style="font-weight: 700;">No hay compras registradas</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 4px;">Usa el botón superior o escanea un ticket con la cámara.</p>
      </div>
    ` : `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${purchases.map(p => `
          <div class="mc-card" style="padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-weight: 700; font-size: 1rem;">${p.storeName || 'Comercio'}</span>
              <span style="font-weight: 800; color: var(--primary-dark); font-size: 1.05rem;">${formatCurrency(p.total_amount)}</span>
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px;">
              <span>📅 ${formatDate(p.purchase_date)}</span>
              <span>${p.payment_method || 'Efectivo'} • ${p.source === 'receipt_ocr' ? '📷 Factura' : '✍️ Manual'}</span>
            </div>

            <div style="background: var(--bg-main); border-radius: 8px; padding: 8px; font-size: 0.85rem;">
              ${(p.items || []).map(it => `
                <div style="display: flex; justify-content: space-between; padding: 2px 0;">
                  <span>${it.productName || 'Producto'} (${formatQuantity(it.quantity, it.unit)})</span>
                  <span style="font-weight: 600;">${formatCurrency(it.total_price)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `}
  `;

  document.getElementById('btn-open-purchase-modal')?.addEventListener('click', () => openNewPurchaseModal());

  if (params.openModal) {
    openNewPurchaseModal();
  }

  function openNewPurchaseModal() {
    const modalContainer = document.getElementById('modal-container');
    const today = new Date().toISOString().split('T')[0];
    let purchaseItems = [
      { product_id: '', quantity: 1, unit: 'kg', unit_price: 0, total_price: 0 }
    ];

    const renderModalContent = () => {
      modalContainer.innerHTML = `
        <div class="modal-backdrop show" id="purchase-modal-backdrop">
          <div class="modal-sheet">
            <div class="modal-header">
              <h2 style="font-size: 1.15rem; font-weight: 700;">+ Registrar Compra</h2>
              <button class="btn btn-secondary btn-sm" id="btn-close-purchase-modal" style="border:none; padding:4px 8px;">✕</button>
            </div>

            <form id="purchase-form">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group">
                  <label class="form-label">Establecimiento</label>
                  <select class="form-select" id="pur-store-id" required>
                    <option value="">Selecciona...</option>
                    ${stores.map(s => `<option value="${s.id}">${s.name} (${s.platform})</option>`).join('')}
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">Fecha</label>
                  <input type="date" class="form-input" id="pur-date" value="${today}" required>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Método de Pago</label>
                <select class="form-select" id="pur-payment">
                  <option value="Efectivo">Efectivo</option>
                  <option value="Tarjeta Débito">Tarjeta Débito</option>
                  <option value="Tarjeta Crédito">Tarjeta Crédito</option>
                  <option value="Nequi">Nequi</option>
                  <option value="Daviplata">Daviplata</option>
                </select>
              </div>

              <!-- Lista Dinámica de Productos -->
              <div style="margin: 16px 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <label class="form-label" style="margin-bottom:0;">Productos Comprados</label>
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-add-item-row" style="font-size: 0.75rem; padding: 4px 8px;">+ Ítem</button>
                </div>

                <div id="purchase-items-list" style="display: flex; flex-direction: column; gap: 10px;">
                  ${purchaseItems.map((it, idx) => `
                    <div style="background: var(--bg-main); border: 1px solid var(--border); border-radius: 12px; padding: 10px;">
                      <div class="form-group" style="margin-bottom: 8px;">
                        <select class="form-select item-prod-select" data-idx="${idx}" required>
                          <option value="">Selecciona producto...</option>
                          ${products.map(p => `<option value="${p.id}" ${p.id === it.product_id ? 'selected' : ''}>${p.name} (${p.base_unit})</option>`).join('')}
                        </select>
                      </div>

                      <div style="display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 6px;">
                        <input type="number" step="any" min="0.01" class="form-input item-qty-input" data-idx="${idx}" placeholder="Cant." value="${it.quantity || 1}" required>
                        <select class="form-select item-unit-select" data-idx="${idx}">
                          <option value="kg" ${it.unit === 'kg' ? 'selected' : ''}>kg</option>
                          <option value="g" ${it.unit === 'g' ? 'selected' : ''}>g</option>
                          <option value="L" ${it.unit === 'L' ? 'selected' : ''}>L</option>
                          <option value="ml" ${it.unit === 'ml' ? 'selected' : ''}>ml</option>
                          <option value="unidad" ${it.unit === 'unidad' ? 'selected' : ''}>unidad</option>
                        </select>
                        <input type="number" min="0" class="form-input item-price-input" data-idx="${idx}" placeholder="Precio Tot." value="${it.total_price || ''}" required>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>

              <button type="submit" class="btn btn-primary" style="margin-top: 8px;">Guardar Compra</button>
            </form>
          </div>
        </div>
      `;

      // Eventos del modal
      const backdrop = document.getElementById('purchase-modal-backdrop');
      const closeBtn = document.getElementById('btn-close-purchase-modal');
      const close = () => { modalContainer.innerHTML = ''; };

      closeBtn.addEventListener('click', close);
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

      document.getElementById('btn-add-item-row').addEventListener('click', () => {
        purchaseItems.push({ product_id: '', quantity: 1, unit: 'kg', unit_price: 0, total_price: 0 });
        renderModalContent();
      });

      document.querySelectorAll('.item-prod-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
          const idx = e.target.getAttribute('data-idx');
          purchaseItems[idx].product_id = e.target.value;
          const p = products.find(prod => prod.id === e.target.value);
          if (p) purchaseItems[idx].unit = p.base_unit;
        });
      });

      document.querySelectorAll('.item-qty-input').forEach(inp => {
        inp.addEventListener('input', (e) => {
          const idx = e.target.getAttribute('data-idx');
          purchaseItems[idx].quantity = Number(e.target.value);
        });
      });

      document.querySelectorAll('.item-unit-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
          const idx = e.target.getAttribute('data-idx');
          purchaseItems[idx].unit = e.target.value;
        });
      });

      document.querySelectorAll('.item-price-input').forEach(inp => {
        inp.addEventListener('input', (e) => {
          const idx = e.target.getAttribute('data-idx');
          purchaseItems[idx].total_price = Number(e.target.value);
          purchaseItems[idx].unit_price = purchaseItems[idx].quantity > 0 ? (purchaseItems[idx].total_price / purchaseItems[idx].quantity) : 0;
        });
      });

      document.getElementById('purchase-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const storeId = document.getElementById('pur-store-id').value;
        const purchaseDate = document.getElementById('pur-date').value;
        const paymentMethod = document.getElementById('pur-payment').value;

        // Validar ítems
        const validItems = purchaseItems.filter(it => it.product_id && it.total_price > 0);
        if (validItems.length === 0) {
          showToast('Debes seleccionar al menos un producto con precio', 'warning');
          return;
        }

        await registerPurchase({
          storeId,
          purchaseDate,
          paymentMethod,
          items: validItems,
          source: 'manual'
        });

        showToast('Compra registrada y stock actualizado ✅', 'success');
        close();
        renderPurchasesView(container, navigateTo);
      });
    };

    renderModalContent();
  }
}
