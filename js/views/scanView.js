// Vista de Escaneo de Facturas con Cámara y Pantalla de Revisión Editable
import { parseReceiptImage } from '../services/ocr.js';
import { state } from '../state.js';
import { registerPurchase } from '../services/purchases.js';
import { createProduct } from '../services/products.js';
import { checkDuplicateProduct } from '../services/products.js';
import { formatCurrency } from '../utils/formatters.js';
import { showToast } from '../utils/toast.js';

export function renderScanView(container, navigateTo) {
  let detectedData = null;
  let isProcessing = false;

  const renderInitialScan = () => {
    container.innerHTML = `
      <div style="margin-bottom: 16px;">
        <h1 style="font-size: 1.35rem; font-weight: 800;">📷 Escanear Factura</h1>
        <p style="color: var(--text-muted); font-size: 0.85rem;">Toma una foto a tu ticket para extraer automáticamente los productos</p>
      </div>

      <div class="mc-card" style="text-align: center; padding: 40px 20px; border: 2px dashed var(--border);">
        <div style="font-size: 3rem; margin-bottom: 12px;">🧾</div>
        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 6px;">Capturar Factura / Ticket</h3>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 20px;">
          Asegúrate de que los productos, cantidades y precios sean legibles.
        </p>

        <input type="file" id="receipt-file-input" accept="image/*" capture="environment" style="display: none;">

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button class="btn btn-primary" id="btn-trigger-camera">
            📸 Tomar Fotografía
          </button>
          <button class="btn btn-secondary" id="btn-trigger-gallery">
            🖼️ Subir desde Galería
          </button>
        </div>
      </div>
    `;

    const fileInput = document.getElementById('receipt-file-input');
    document.getElementById('btn-trigger-camera')?.addEventListener('click', () => {
      fileInput.setAttribute('capture', 'environment');
      fileInput.click();
    });

    document.getElementById('btn-trigger-gallery')?.addEventListener('click', () => {
      fileInput.removeAttribute('capture');
      fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files[0]) {
        await processImage(e.target.files[0]);
      }
    });
  };

  const processImage = async (file) => {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px 20px;">
        <div style="font-size: 3rem; animation: pulse 1.5s infinite;">🔍</div>
        <h2 style="font-size: 1.2rem; font-weight: 700; margin-top: 16px;">Analizando Factura...</h2>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 4px;">Extrayendo productos, cantidades y precios.</p>
        <div style="margin-top: 20px; font-size: 0.8rem; color: var(--primary);">No cierres la aplicación</div>
      </div>
    `;

    try {
      detectedData = await parseReceiptImage(file);
      renderReviewScreen();
    } catch (err) {
      showToast('No se pudo procesar la factura', 'error');
      renderInitialScan();
    }
  };

  // Pantalla de Revisión Obligatoria (Dato Propuesto según Requerimiento 11 y 13)
  const renderReviewScreen = () => {
    container.innerHTML = `
      <div style="margin-bottom: 16px;">
        <span class="badge badge-low" style="margin-bottom: 4px;">DATO PROPUESTO (REVISA Y CORRIGE)</span>
        <h1 style="font-size: 1.35rem; font-weight: 800;">Información Detectada</h1>
        <p style="color: var(--text-muted); font-size: 0.85rem;">Verifica o edita los datos antes de guardar definitivamente</p>
      </div>

      <div class="mc-card">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Establecimiento</label>
            <input type="text" id="review-merchant" class="form-input" value="${detectedData.merchant}" required>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Fecha</label>
            <input type="date" id="review-date" class="form-input" value="${detectedData.date}" required>
          </div>
        </div>

        <h3 style="font-size: 0.95rem; font-weight: 700; margin: 16px 0 8px 0;">Productos Detectados:</h3>

        <div id="review-items-container" style="display: flex; flex-direction: column; gap: 10px;">
          ${detectedData.items.map((it, idx) => {
            const match = checkDuplicateProduct(it.rawName);
            return `
              <div style="background: var(--bg-main); border: 1px solid var(--border); border-radius: 12px; padding: 10px;" id="item-card-${idx}">
                <div class="form-group" style="margin-bottom: 6px;">
                  <label class="form-label" style="font-size:0.75rem;">Nombre Producto</label>
                  <input type="text" class="form-input item-name-val" data-idx="${idx}" value="${match ? match.product.name : it.rawName}">
                </div>

                ${match && !match.isExact ? `
                  <div style="font-size: 0.75rem; background: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 6px; margin-bottom: 6px;">
                    💡 Coincidencia sugerida: <strong>${match.product.name}</strong>
                  </div>
                ` : ''}

                <div style="display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 6px;">
                  <div>
                    <label class="form-label" style="font-size:0.7rem;">Cant.</label>
                    <input type="number" step="any" class="form-input item-qty-val" data-idx="${idx}" value="${it.quantity}">
                  </div>
                  <div>
                    <label class="form-label" style="font-size:0.7rem;">Unidad</label>
                    <select class="form-select item-unit-val" data-idx="${idx}">
                      <option value="kg" ${it.unit === 'kg' ? 'selected' : ''}>kg</option>
                      <option value="g" ${it.unit === 'g' ? 'selected' : ''}>g</option>
                      <option value="L" ${it.unit === 'L' ? 'selected' : ''}>L</option>
                      <option value="unidad" ${it.unit === 'unidad' ? 'selected' : ''}>unidad</option>
                    </select>
                  </div>
                  <div>
                    <label class="form-label" style="font-size:0.7rem;">Precio Tot.</label>
                    <input type="number" class="form-input item-total-val" data-idx="${idx}" value="${it.totalPrice}">
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border); font-size: 1.1rem; font-weight: 800;">
          <span>Total Factura:</span>
          <span style="color: var(--primary-dark);" id="review-total-display">${formatCurrency(detectedData.total)}</span>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 16px;">
          <button class="btn btn-secondary" id="btn-cancel-review" style="flex: 1;">Cancelar</button>
          <button class="btn btn-primary" id="btn-confirm-review" style="flex: 2;">Guardar Compra</button>
        </div>
      </div>
    `;

    document.getElementById('btn-cancel-review').addEventListener('click', renderInitialScan);

    document.getElementById('btn-confirm-review').addEventListener('click', async () => {
      const merchantName = document.getElementById('review-merchant').value.trim();
      const date = document.getElementById('review-date').value;

      // Buscar o crear tienda
      let store = state.stores.find(s => s.name.toLowerCase() === merchantName.toLowerCase());
      if (!store) {
        const { createStore } = await import('../services/stores.js');
        store = await createStore({ name: merchantName, platform: 'Directo' });
      }

      // Procesar cada ítem
      const finalItems = [];
      for (let i = 0; i < detectedData.items.length; i++) {
        const nameVal = document.querySelector(`.item-name-val[data-idx="${i}"]`).value.trim();
        const qtyVal = Number(document.querySelector(`.item-qty-val[data-idx="${i}"]`).value);
        const unitVal = document.querySelector(`.item-unit-val[data-idx="${i}"]`).value;
        const totalVal = Number(document.querySelector(`.item-total-val[data-idx="${i}"]`).value);

        // Buscar o crear producto
        let product = state.products.find(p => p.name.toLowerCase() === nameVal.toLowerCase());
        if (!product) {
          product = await createProduct({ name: nameVal, baseUnit: unitVal });
        }

        finalItems.push({
          product_id: product.id,
          productName: product.name,
          quantity: qtyVal,
          unit: unitVal,
          unit_price: qtyVal > 0 ? (totalVal / qtyVal) : 0,
          total_price: totalVal
        });
      }

      await registerPurchase({
        storeId: store.id,
        purchaseDate: date,
        paymentMethod: 'Factura/Ticket',
        items: finalItems,
        source: 'receipt_ocr'
      });

      showToast('¡Factura guardada e inventario actualizado!', 'success');
      navigateTo('inventory');
    });
  };

  renderInitialScan();
}
