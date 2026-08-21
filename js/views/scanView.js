// Vista de Escaneo de Facturas con OCR Real (Tesseract.js)
import { parseReceiptImage } from '../services/ocr.js';
import { state } from '../state.js';
import { registerPurchase } from '../services/purchases.js';
import { createProduct, fetchProducts, checkDuplicateProduct } from '../services/products.js';
import { createStore, fetchStores } from '../services/stores.js';
import { formatCurrency } from '../utils/formatters.js';
import { showToast } from '../utils/toast.js';

export function renderScanView(container, navigateTo) {
  let scannedData = null;

  // ── Pantalla inicial ──────────────────────────────────────────────────────
  function showInitial() {
    container.innerHTML = `
      <div style="margin-bottom:16px;">
        <h1 style="font-size:1.35rem; font-weight:800;">📷 Escanear Factura</h1>
        <p style="color:var(--text-muted); font-size:0.85rem;">Toma foto o sube imagen de tu ticket para extraer los productos automáticamente</p>
      </div>

      <div class="mc-card" style="text-align:center; padding:36px 20px; border:2px dashed var(--border);">
        <div style="font-size:3rem; margin-bottom:12px;">🧾</div>
        <h3 style="font-size:1.1rem; font-weight:700; margin-bottom:6px;">Capturar Factura / Ticket</h3>
        <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:24px; line-height:1.5;">
          Asegúrate de que el texto sea legible.<br>
          <strong>Mejor resultado:</strong> buena iluminación, sin sombras.
        </p>

        <!-- Input oculto para cámara -->
        <input type="file" id="inp-camera" accept="image/*" capture="environment" style="display:none;">
        <!-- Input oculto para galería -->
        <input type="file" id="inp-gallery" accept="image/*" style="display:none;">

        <div style="display:flex; flex-direction:column; gap:10px; max-width:280px; margin:0 auto;">
          <button class="btn btn-primary" id="btn-camera" style="font-size:1rem;">
            📸 Tomar fotografía
          </button>
          <button class="btn btn-secondary" id="btn-gallery" style="font-size:1rem;">
            🖼️ Subir desde galería
          </button>
        </div>
      </div>

      <div class="mc-card" style="margin-top:12px; background:var(--bg-main); border:1px dashed var(--border);">
        <h3 style="font-size:0.9rem; font-weight:700; margin-bottom:8px;">💡 Consejos para mejores resultados</h3>
        <ul style="font-size:0.82rem; color:var(--text-muted); line-height:1.8; padding-left:16px; margin:0;">
          <li>Mantén la cámara paralela al ticket (sin ángulo)</li>
          <li>Buena iluminación — evita sombras sobre el papel</li>
          <li>Incluye toda la factura en la foto</li>
          <li>Después del escaneo podrás revisar y corregir todo</li>
        </ul>
      </div>
    `;

    const inpCamera  = document.getElementById('inp-camera');
    const inpGallery = document.getElementById('inp-gallery');

    document.getElementById('btn-camera')?.addEventListener('click', () => inpCamera.click());
    document.getElementById('btn-gallery')?.addEventListener('click', () => inpGallery.click());

    inpCamera.addEventListener('change',  e => { if (e.target.files[0]) processImage(e.target.files[0]); });
    inpGallery.addEventListener('change', e => { if (e.target.files[0]) processImage(e.target.files[0]); });
  }

  // ── Procesamiento con OCR ─────────────────────────────────────────────────
  async function processImage(file) {
    // Vista de progreso
    container.innerHTML = `
      <div style="min-height:calc(100vh - 140px); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; text-align:center; padding:20px;">
        <div style="font-size:3rem;">🔍</div>
        <h2 style="font-size:1.2rem; font-weight:700;">Analizando Factura...</h2>
        <p style="color:var(--text-muted); font-size:0.9rem;">Extrayendo texto con OCR. No cierres la app.</p>

        <!-- Barra de progreso -->
        <div style="width:100%; max-width:300px; background:var(--border); border-radius:99px; height:8px; overflow:hidden;">
          <div id="ocr-progress-bar" style="height:100%; background:var(--primary); border-radius:99px; width:5%; transition:width 0.3s ease;"></div>
        </div>
        <div id="ocr-progress-text" style="font-size:0.85rem; color:var(--primary); font-weight:600;">Cargando motor OCR...</div>

        <!-- Miniatura de la imagen -->
        <div style="margin-top:12px;">
          <img id="preview-img" src="" alt="Factura"
               style="max-width:200px; max-height:200px; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.15); object-fit:contain;">
        </div>
      </div>
    `;

    // Mostrar preview de la imagen
    const reader = new FileReader();
    reader.onload = e => {
      const img = document.getElementById('preview-img');
      if (img) img.src = e.target.result;
    };
    reader.readAsDataURL(file);

    try {
      scannedData = await parseReceiptImage(file, (pct) => {
        const bar  = document.getElementById('ocr-progress-bar');
        const text = document.getElementById('ocr-progress-text');
        if (bar)  bar.style.width  = pct + '%';
        if (text) text.textContent = pct < 100 ? `Reconociendo texto... ${pct}%` : '✅ Texto extraído';
      });

      showReview();
    } catch (err) {
      console.error('[OCR]', err);
      showToast('No se pudo procesar la imagen. Intenta con mejor iluminación.', 'error');
      showInitial();
    }
  }

  // ── Pantalla de revisión ──────────────────────────────────────────────────
  function showReview() {
    const d = scannedData;

    container.innerHTML = `
      <div style="margin-bottom:16px;">
        <span style="background:#dbeafe; color:#1e40af; padding:3px 10px; border-radius:99px; font-size:0.75rem; font-weight:600;">
          REVISA Y CORRIGE ANTES DE GUARDAR
        </span>
        <h1 style="font-size:1.25rem; font-weight:800; margin-top:8px;">Datos Detectados</h1>
        <p style="color:var(--text-muted); font-size:0.82rem;">
          ${d.items.length > 0
            ? `Se detectaron <strong>${d.items.length}</strong> ítem(s). Corrige lo que sea necesario.`
            : '⚠️ No se detectaron ítems. Edita manualmente o intenta con otra foto.'}
        </p>
      </div>

      <div class="mc-card">
        <!-- Establecimiento y fecha -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
          <div class="form-group" style="margin:0;">
            <label class="form-label">Establecimiento</label>
            <input type="text" id="rev-merchant" class="form-input" value="${d.merchant}">
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">Fecha</label>
            <input type="date" id="rev-date" class="form-input" value="${d.date}">
          </div>
        </div>

        <!-- Productos detectados -->
        <div style="margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <label class="form-label" style="margin:0; font-weight:700;">Productos (${d.items.length})</label>
            <button type="button" id="btn-add-scanned-item" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:3px 8px;">+ Agregar ítem</button>
          </div>

          <div id="review-items">
            ${d.items.map((it, idx) => reviewItemRow(it, idx)).join('')}
            ${d.items.length === 0 ? reviewItemRow({ rawName: '', quantity: 1, unit: 'unidad', unitPrice: 0, totalPrice: 0 }, 0) : ''}
          </div>
        </div>

        <!-- Total -->
        <div style="background:linear-gradient(135deg,#10b981,#047857); color:white; border-radius:12px; padding:12px; text-align:right; margin-bottom:16px;">
          <span style="font-size:0.8rem; opacity:0.85;">TOTAL DETECTADO</span>
          <div style="font-size:1.4rem; font-weight:800;">${formatCurrency(d.total)}</div>
        </div>

        <div style="display:flex; gap:10px;">
          <button class="btn btn-secondary" id="btn-back-scan" style="flex:1;">← Volver</button>
          <button class="btn btn-primary" id="btn-save-scan" style="flex:2;">Guardar Compra ✅</button>
        </div>
      </div>

      ${d.rawText ? `
        <details style="margin-top:12px;">
          <summary style="font-size:0.8rem; color:var(--text-muted); cursor:pointer; padding:8px 0;">
            🔤 Ver texto bruto del OCR
          </summary>
          <div style="background:var(--bg-main); border-radius:10px; padding:10px; font-size:0.72rem; font-family:monospace; white-space:pre-wrap; color:var(--text-muted); max-height:200px; overflow-y:auto; margin-top:6px;">
            ${d.rawText.replace(/</g,'&lt;')}
          </div>
        </details>
      ` : ''}
    `;

    document.getElementById('btn-back-scan')?.addEventListener('click', showInitial);
    document.getElementById('btn-add-scanned-item')?.addEventListener('click', () => {
      scannedData.items.push({ rawName: '', quantity: 1, unit: 'unidad', unitPrice: 0, totalPrice: 0 });
      showReview();
    });
    document.getElementById('btn-save-scan')?.addEventListener('click', saveScannedPurchase);
  }

  function reviewItemRow(it, idx) {
    const units = ['unidad','kg','g','ml','l','paquete','bolsa','caja','lb','docena'];
    return `
      <div style="background:var(--bg-main); border:1px solid var(--border); border-radius:10px; padding:10px; margin-bottom:8px;">
        <div style="display:flex; gap:6px; margin-bottom:8px; align-items:center;">
          <input type="text" class="form-input rev-name" data-idx="${idx}"
                 value="${it.rawName || ''}" placeholder="Nombre del producto..."
                 style="flex:1; font-size:0.85rem; padding:7px 10px;">
          <button type="button" class="btn btn-secondary btn-sm rev-remove" data-idx="${idx}"
                  style="color:var(--danger); border-color:#fecaca; padding:4px 8px; font-size:0.8rem;">✕</button>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
          <div>
            <label style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:2px;">Cantidad</label>
            <input type="number" class="form-input rev-qty" data-idx="${idx}"
                   value="${it.quantity || 1}" min="0.001" step="any" style="font-size:0.85rem; padding:6px 8px;">
          </div>
          <div>
            <label style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:2px;">Unidad</label>
            <select class="form-select rev-unit" data-idx="${idx}" style="font-size:0.82rem; padding:6px 6px;">
              ${units.map(u => `<option value="${u}" ${it.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:2px;">Total ítem</label>
            <input type="number" class="form-input rev-total" data-idx="${idx}"
                   value="${it.totalPrice || 0}" min="0" step="100" style="font-size:0.85rem; padding:6px 8px;">
          </div>
        </div>
      </div>`;
  }

  // ── Guardar compra escaneada ─────────────────────────────────────────────
  async function saveScannedPurchase() {
    const btn = document.getElementById('btn-save-scan');
    btn.disabled = true; btn.textContent = 'Guardando...';

    try {
      const merchantName = document.getElementById('rev-merchant')?.value?.trim() || 'Establecimiento';
      const date         = document.getElementById('rev-date')?.value || new Date().toISOString().split('T')[0];

      // Leer ítems editados por el usuario
      const nameEls  = document.querySelectorAll('.rev-name');
      const qtyEls   = document.querySelectorAll('.rev-qty');
      const unitEls  = document.querySelectorAll('.rev-unit');
      const totalEls = document.querySelectorAll('.rev-total');

      const editedItems = [];
      for (let i = 0; i < nameEls.length; i++) {
        const name  = nameEls[i].value.trim();
        const qty   = parseFloat(qtyEls[i].value) || 1;
        const unit  = unitEls[i].value;
        const total = parseFloat(totalEls[i].value) || 0;
        if (name && total > 0) {
          editedItems.push({ name, qty, unit, total });
        }
      }

      if (editedItems.length === 0) {
        showToast('Agrega al menos un ítem con nombre y precio', 'error');
        btn.disabled = false; btn.textContent = 'Guardar Compra ✅';
        return;
      }

      // Buscar o crear la tienda
      let store = state.stores.find(s => s.name.toLowerCase() === merchantName.toLowerCase());
      if (!store) {
        store = await createStore({ name: merchantName, platform: 'Físico' });
        await fetchStores();
      }

      // Buscar o crear cada producto
      const finalItems = [];
      for (const it of editedItems) {
        let product = state.products.find(p => p.name.toLowerCase() === it.name.toLowerCase());
        if (!product) {
          const match = checkDuplicateProduct(it.name);
          if (match && match.score > 0.8) {
            product = match.product;
          } else {
            product = await createProduct({ name: it.name, baseUnit: it.unit });
            await fetchProducts();
          }
        }
        finalItems.push({
          product_id: product.id,
          quantity: it.qty,
          unit: it.unit,
          unit_price: it.qty > 0 ? it.total / it.qty : 0,
          total_price: it.total
        });
      }

      await registerPurchase({
        storeId: store.id,
        purchaseDate: date,
        paymentMethod: 'Factura/Ticket',
        items: finalItems,
        source: 'receipt_ocr'
      });

      showToast('Factura guardada e inventario actualizado ✅', 'success');
      navigateTo('inventory');
    } catch (err) {
      console.error('[Scan Save]', err);
      showToast('Error al guardar: ' + (err.message || 'Intenta de nuevo'), 'error');
      btn.disabled = false; btn.textContent = 'Guardar Compra ✅';
    }
  }

  showInitial();
}
