// Vista de Escaneo de Facturas con IA y Emparejamiento Inteligente de Catálogo
import { parseReceiptWithAI, testGeminiApiKey } from '../services/ocr.js';
import { getGeminiApiKey, setGeminiApiKey } from '../config.js';
import { state } from '../state.js';
import { registerPurchase } from '../services/purchases.js';
import { createProduct, fetchProducts } from '../services/products.js';
import { createStore, fetchStores } from '../services/stores.js';
import { findBestProductMatch, findBestStoreMatch } from '../utils/matcher.js';
import { formatCurrency } from '../utils/formatters.js';
import { showToast } from '../utils/toast.js';

export function renderScanView(container, navigateTo) {
  let detectedData = null;

  function renderInitial() {
    const hasKey = Boolean(getGeminiApiKey());

    container.innerHTML = `
      <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h1 style="font-size: 1.35rem; font-weight: 800;">📷 Escanear con IA</h1>
          <p style="color: var(--text-muted); font-size: 0.85rem;">Digitalización inteligente y auto-emparejamiento</p>
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-config-key" style="font-size: 0.75rem; padding: 4px 8px;">
          🔑 ${hasKey ? 'Cambiar API Key' : 'Configurar Clave'}
        </button>
      </div>

      ${!hasKey ? `
        <div style="background: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: 12px 14px; border-radius: 12px; margin-bottom: 16px; font-size: 0.85rem;">
          <div style="font-weight: 700; margin-bottom: 4px;">⚡ Requiere API Key Gratuita de Gemini</div>
          Para que la IA interprete tus facturas, ingresa tu clave gratuita de Google AI Studio.
          <div style="margin-top: 8px;">
            <button class="btn btn-primary btn-sm" id="btn-quick-setup-key" style="font-size: 0.8rem; padding: 4px 10px;">
              + Ingresar Clave Gratis (1 minuto)
            </button>
          </div>
        </div>
      ` : `
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 8px 12px; border-radius: 10px; margin-bottom: 16px; font-size: 0.8rem; display: flex; align-items: center; justify-content: space-between;">
          <span>✨ <strong>IA Gemini Activa:</strong> Lista para leer tus facturas</span>
          <button id="btn-test-key-inline" style="background:none; border:none; color:#15803d; text-decoration:underline; cursor:pointer; font-size:0.75rem;">Probar conexión</button>
        </div>
      `}

      <div class="mc-card" style="text-align: center; padding: 36px 20px; border: 2px dashed var(--border);">
        <div style="font-size: 3.5rem; margin-bottom: 12px;">🧾</div>
        <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 6px;">Capturar Factura o Ticket</h3>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 24px; line-height: 1.5;">
          Toma una foto de tu recibo del supermercado.<br>La IA identificará los productos y los vinculará con tu inventario.
        </p>

        <input type="file" id="inp-camera" accept="image/*" capture="environment" style="display: none;">
        <input type="file" id="inp-gallery" accept="image/*" style="display: none;">

        <div style="display: flex; flex-direction: column; gap: 10px; max-width: 280px; margin: 0 auto;">
          <button class="btn btn-primary" id="btn-trigger-camera" style="font-size: 1rem;">
            📸 Tomar Fotografía
          </button>
          <button class="btn btn-secondary" id="btn-trigger-gallery" style="font-size: 1rem;">
            🖼️ Subir desde Galería
          </button>
        </div>
      </div>
    `;

    const inpCam = document.getElementById('inp-camera');
    const inpGal = document.getElementById('inp-gallery');

    document.getElementById('btn-config-key')?.addEventListener('click', openApiKeyModal);
    document.getElementById('btn-quick-setup-key')?.addEventListener('click', openApiKeyModal);

    document.getElementById('btn-test-key-inline')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-test-key-inline');
      btn.textContent = 'Probando...';
      const res = await testGeminiApiKey(getGeminiApiKey());
      if (res.success) {
        showToast('Conexión con Gemini OK ✅', 'success');
        btn.textContent = 'Conexión OK ✅';
      } else {
        showToast('Error con la clave: ' + res.message, 'error', 5000);
        btn.textContent = 'Revisar clave ❌';
      }
    });

    document.getElementById('btn-trigger-camera')?.addEventListener('click', () => {
      if (!getGeminiApiKey()) { openApiKeyModal(); return; }
      inpCam.click();
    });

    document.getElementById('btn-trigger-gallery')?.addEventListener('click', () => {
      if (!getGeminiApiKey()) { openApiKeyModal(); return; }
      inpGal.click();
    });

    inpCam.addEventListener('change', e => { if (e.target.files[0]) processFile(e.target.files[0]); });
    inpGal.addEventListener('change', e => { if (e.target.files[0]) processFile(e.target.files[0]); });
  }

  async function processFile(file) {
    container.innerHTML = `
      <div style="min-height: calc(100vh - 140px); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px;">
        <div style="font-size: 3.5rem; animation: pulse 1.5s infinite;">🧠</div>
        <h2 style="font-size: 1.25rem; font-weight: 800; margin-top: 16px;">La IA está leyendo tu factura...</h2>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 6px; max-width: 300px;">
          Extrayendo información y buscando coincidencias con tus productos ya creados.
        </p>

        <div style="margin-top: 24px;">
          <img id="scan-preview-img" src="" alt="Factura" style="max-width: 180px; max-height: 180px; border-radius: 12px; box-shadow: 0 4px 14px rgba(0,0,0,0.15); object-fit: contain;">
        </div>

        <div style="margin-top: 20px; font-size: 0.8rem; color: var(--primary); font-weight: 600;">
          ⚡ Procesando en Gemini Flash (~1-2 seg)
        </div>
      </div>
    `;

    const reader = new FileReader();
    reader.onload = e => {
      const img = document.getElementById('scan-preview-img');
      if (img) img.src = e.target.result;
    };
    reader.readAsDataURL(file);

    try {
      detectedData = await parseReceiptWithAI(file);
      renderReviewScreen();
    } catch (err) {
      console.error('[AI OCR Error]', err);
      if (err.message === 'NO_API_KEY') {
        showToast('Por favor configura tu API Key de Gemini', 'info');
        openApiKeyModal();
      } else {
        showToast('Error al analizar la factura: ' + err.message, 'error', 6000);
      }
      renderInitial();
    }
  }

  function renderReviewScreen() {
    const d = detectedData;
    const existingStores = state.stores || [];
    const existingProducts = state.products || [];

    // Buscar coincidencia de tienda
    const storeMatch = findBestStoreMatch(d.merchant, existingStores);

    // Preparar estado de ítems con sus sugerencias automáticas
    d.items.forEach((it, idx) => {
      if (it.selectedTarget === undefined) {
        const prodMatch = findBestProductMatch(it.name || it.rawName, existingProducts);
        if (prodMatch) {
          it.selectedTarget = `existing_${prodMatch.product.id}`;
          it.matchedProduct = prodMatch.product;
          it.matchSimilarity = prodMatch.similarity;
          it.unit = prodMatch.product.base_unit || it.unit;
        } else {
          it.selectedTarget = 'new';
          it.matchedProduct = null;
        }
      }
    });

    container.innerHTML = `
      <div style="margin-bottom: 16px;">
        <span class="badge badge-normal" style="font-size: 0.75rem; background: #dcfce7; color: #15803d;">
          ✨ INTERPRETADO POR IA CON ÉXITO
        </span>
        <h1 style="font-size: 1.3rem; font-weight: 800; margin-top: 6px;">Revisar y Asignar Productos</h1>
        <p style="color: var(--text-muted); font-size: 0.82rem;">La IA detectó estos ítems. Puedes vincularlos a tus productos existentes o crearlos como nuevos.</p>
      </div>

      <div class="mc-card">
        <!-- Establecimiento -->
        <div class="form-group" style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <label class="form-label" style="margin: 0;">Establecimiento</label>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Leído: <em>"${d.merchant}"</em></span>
          </div>

          <select class="form-select" id="rev-store-select">
            <option value="new" ${!storeMatch ? 'selected' : ''}>➕ Crear nuevo: "${d.merchant}"</option>
            ${existingStores.length > 0 ? `
              <optgroup label="Tus Establecimientos Creados">
                ${existingStores.map(s => `
                  <option value="existing_${s.id}" ${storeMatch && storeMatch.store.id === s.id ? 'selected' : ''}>
                    🏪 ${s.name} ${s.platform ? '· ' + s.platform : ''} ${storeMatch && storeMatch.store.id === s.id ? '(Sugerido ⭐)' : ''}
                  </option>
                `).join('')}
              </optgroup>
            ` : ''}
          </select>
          ${storeMatch ? `
            <div style="font-size: 0.75rem; color: #15803d; margin-top: 4px; font-weight: 600;">
              💡 Coincide automáticamente con tu tienda: <strong>${storeMatch.store.name}</strong>
            </div>
          ` : ''}
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Fecha</label>
            <input type="date" id="rev-date" class="form-input" value="${d.date}" required>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Método de Pago</label>
            <select class="form-select" id="rev-payment">
              <option ${d.paymentMethod.includes('Efectivo') ? 'selected' : ''}>Efectivo</option>
              <option ${d.paymentMethod.includes('Débito') ? 'selected' : ''}>Tarjeta Débito</option>
              <option ${d.paymentMethod.includes('Crédito') ? 'selected' : ''}>Tarjeta Crédito</option>
              <option ${d.paymentMethod.includes('Nequi') ? 'selected' : ''}>Nequi</option>
              <option ${d.paymentMethod.includes('Daviplata') ? 'selected' : ''}>Daviplata</option>
            </select>
          </div>
        </div>

        <!-- Lista de Productos -->
        <div style="margin: 16px 0 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <label class="form-label" style="margin: 0; font-weight: 700;">Productos Detectados (${d.items.length})</label>
            <button type="button" id="btn-add-scanned-item" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 3px 8px;">+ Ítem</button>
          </div>

          <div id="review-items-list">
            ${d.items.map((it, idx) => reviewItemCard(it, idx, existingProducts)).join('')}
          </div>
        </div>

        <div style="background: linear-gradient(135deg, #10b981 0%, #047857 100%); color: white; border-radius: 12px; padding: 14px; text-align: right; margin-bottom: 16px;">
          <span style="font-size: 0.8rem; opacity: 0.85;">TOTAL DE LA FACTURA</span>
          <div id="rev-total-display" style="font-size: 1.5rem; font-weight: 800; margin-top: 2px;">
            ${formatCurrency(d.total || calcTotal())}
          </div>
        </div>

        <div style="display: flex; gap: 10px;">
          <button class="btn btn-secondary" id="btn-cancel-scan" style="flex: 1;">← Volver</button>
          <button class="btn btn-primary" id="btn-confirm-save-scan" style="flex: 2;">Guardar en Despensa ✅</button>
        </div>
      </div>
    `;

    attachReviewEvents();
  }

  function calcTotal() {
    return detectedData.items.reduce((s, it) => s + (Number(it.totalPrice) || 0), 0);
  }

  function reviewItemCard(it, idx, existingProducts) {
    const units = ['kg','g','unidad','L','ml','paquete','bolsa','caja','lb','docena'];
    const rawAiName = it.rawName || it.name;

    return `
      <div style="background: var(--bg-main); border: 1px solid var(--border); border-radius: 12px; padding: 12px; margin-bottom: 10px;" id="item-card-${idx}">
        <!-- Encabezado con texto leído por la IA -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">
            🧾 Texto IA: <strong style="color: var(--text-main);">"${rawAiName}"</strong>
          </span>
          <button type="button" class="btn btn-secondary btn-sm btn-del-item" data-idx="${idx}" style="color: var(--danger); border-color: #fecaca; padding: 2px 6px; font-size: 0.75rem;">✕ Quitar</button>
        </div>

        <!-- Selector Inteligente de Asignación de Producto -->
        <div class="form-group" style="margin-bottom: 8px;">
          <label style="font-size: 0.72rem; color: var(--text-muted); display: block; margin-bottom: 2px;">
            Asignar a producto de tu inventario:
          </label>
          <select class="form-select item-target-select" data-idx="${idx}" style="font-size: 0.85rem; font-weight: 600;">
            <option value="new" ${it.selectedTarget === 'new' ? 'selected' : ''}>
              ➕ Crear como nuevo producto ("${it.name}")
            </option>
            ${existingProducts.length > 0 ? `
              <optgroup label="Tus Productos Existentes">
                ${existingProducts.map(p => {
                  const isMatched = it.matchedProduct && it.matchedProduct.id === p.id;
                  return `
                    <option value="existing_${p.id}" ${it.selectedTarget === `existing_${p.id}` ? 'selected' : ''}>
                      📦 ${p.name} (${p.base_unit}) ${isMatched ? '⭐ Coincidencia sugerida' : ''}
                    </option>
                  `;
                }).join('')}
              </optgroup>
            ` : ''}
          </select>

          ${it.matchedProduct && it.selectedTarget === `existing_${it.matchedProduct.id}` ? `
            <div style="font-size: 0.75rem; color: #15803d; background: #dcfce7; padding: 3px 8px; border-radius: 6px; margin-top: 4px; font-weight: 600;">
              💡 Coincide con tu producto: <strong>${it.matchedProduct.name}</strong> (${Math.round(it.matchSimilarity * 100)}% similitud)
            </div>
          ` : ''}
        </div>

        <!-- Si elige crear nuevo, permitir editar el nombre limpio -->
        ${it.selectedTarget === 'new' ? `
          <div class="form-group" style="margin-bottom: 8px;">
            <label style="font-size: 0.7rem; color: var(--text-muted); display: block;">Nombre para el nuevo producto:</label>
            <input type="text" class="form-input item-name-in" data-idx="${idx}" value="${it.name}" placeholder="Nombre del producto" style="font-size: 0.85rem; padding: 6px 8px;">
          </div>
        ` : ''}

        <!-- Cantidad, Unidad y Precio -->
        <div style="display: grid; grid-template-columns: 1fr 1.1fr 1.2fr; gap: 6px;">
          <div>
            <label style="font-size: 0.7rem; color: var(--text-muted); display: block;">Cantidad</label>
            <input type="number" step="any" min="0.001" class="form-input item-qty-in" data-idx="${idx}" value="${it.quantity}" style="font-size: 0.85rem; padding: 6px 8px;">
          </div>
          <div>
            <label style="font-size: 0.7rem; color: var(--text-muted); display: block;">Unidad</label>
            <select class="form-select item-unit-in" data-idx="${idx}" style="font-size: 0.82rem; padding: 6px 6px;">
              ${units.map(u => `<option value="${u}" ${it.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size: 0.7rem; color: var(--text-muted); display: block;">Precio Total</label>
            <input type="number" step="100" class="form-input item-total-in" data-idx="${idx}" value="${it.totalPrice}" style="font-size: 0.85rem; padding: 6px 8px;">
          </div>
        </div>
      </div>
    `;
  }

  function attachReviewEvents() {
    document.getElementById('btn-cancel-scan')?.addEventListener('click', renderInitial);

    document.getElementById('btn-add-scanned-item')?.addEventListener('click', () => {
      detectedData.items.push({ name: '', rawName: 'Nuevo Ítem', quantity: 1, unit: 'kg', totalPrice: 0, selectedTarget: 'new' });
      renderReviewScreen();
    });

    document.querySelectorAll('.btn-del-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'));
        detectedData.items.splice(idx, 1);
        renderReviewScreen();
      });
    });

    document.querySelectorAll('.item-target-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const idx = parseInt(sel.getAttribute('data-idx'));
        const val = sel.value;
        detectedData.items[idx].selectedTarget = val;

        if (val.startsWith('existing_')) {
          const pId = val.replace('existing_', '');
          const prod = (state.products || []).find(p => p.id === pId);
          if (prod) {
            detectedData.items[idx].unit = prod.base_unit || detectedData.items[idx].unit;
          }
        }
        renderReviewScreen();
      });
    });

    document.querySelectorAll('.item-name-in').forEach(inp => {
      inp.addEventListener('input', () => {
        const idx = parseInt(inp.getAttribute('data-idx'));
        detectedData.items[idx].name = inp.value;
      });
    });

    document.querySelectorAll('.item-qty-in').forEach(inp => {
      inp.addEventListener('input', () => {
        const idx = parseInt(inp.getAttribute('data-idx'));
        detectedData.items[idx].quantity = parseFloat(inp.value) || 1;
      });
    });

    document.querySelectorAll('.item-unit-in').forEach(sel => {
      sel.addEventListener('change', () => {
        const idx = parseInt(sel.getAttribute('data-idx'));
        detectedData.items[idx].unit = sel.value;
      });
    });

    document.querySelectorAll('.item-total-in').forEach(inp => {
      inp.addEventListener('input', () => {
        const idx = parseInt(inp.getAttribute('data-idx'));
        detectedData.items[idx].totalPrice = parseFloat(inp.value) || 0;
        const totalEl = document.getElementById('rev-total-display');
        if (totalEl) totalEl.textContent = formatCurrency(calcTotal());
      });
    });

    document.getElementById('btn-confirm-save-scan')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-confirm-save-scan');
      btn.disabled = true;
      btn.textContent = 'Guardando en Supabase...';

      try {
        const storeSelectVal = document.getElementById('rev-store-select').value;
        const date = document.getElementById('rev-date').value;
        const payment = document.getElementById('rev-payment').value;

        // 1. Resolver Establecimiento
        let storeId = null;
        if (storeSelectVal.startsWith('existing_')) {
          storeId = storeSelectVal.replace('existing_', '');
        } else {
          // Crear nueva tienda
          const newStore = await createStore({ name: detectedData.merchant || 'Supermercado', platform: 'Físico' });
          await fetchStores();
          storeId = newStore.id;
        }

        // 2. Procesar productos
        const finalItems = [];
        for (const it of detectedData.items) {
          let productId = null;
          let productName = it.name;

          if (it.selectedTarget && it.selectedTarget.startsWith('existing_')) {
            productId = it.selectedTarget.replace('existing_', '');
            const existingP = (state.products || []).find(p => p.id === productId);
            if (existingP) productName = existingP.name;
          } else {
            // Crear nuevo producto
            const cleanName = (it.name || it.rawName || '').trim();
            if (!cleanName) continue;
            const newP = await createProduct({ name: cleanName, baseUnit: it.unit });
            await fetchProducts();
            productId = newP.id;
            productName = newP.name;
          }

          const qty = Number(it.quantity) || 1;
          const tot = Number(it.totalPrice) || 0;

          finalItems.push({
            product_id: productId,
            productName: productName,
            quantity: qty,
            unit: it.unit,
            unit_price: qty > 0 ? (tot / qty) : tot,
            total_price: tot
          });
        }

        if (finalItems.length === 0) {
          showToast('No hay productos válidos para guardar', 'error');
          btn.disabled = false;
          btn.textContent = 'Guardar en Despensa ✅';
          return;
        }

        await registerPurchase({
          storeId: storeId,
          purchaseDate: date,
          paymentMethod: payment,
          items: finalItems,
          source: 'receipt_ocr'
        });

        showToast('¡Factura guardada e inventario actualizado correctamente! 🎯', 'success');
        navigateTo('inventory');
      } catch (err) {
        console.error('Error guardando factura:', err);
        showToast('Error al guardar: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Guardar en Despensa ✅';
      }
    });
  }

  function openApiKeyModal() {
    const modalContainer = document.getElementById('modal-container');
    const currentKey = getGeminiApiKey();

    modalContainer.innerHTML = `
      <div class="modal-backdrop show" id="api-key-modal-backdrop">
        <div class="modal-sheet">
          <div class="modal-header">
            <h2 style="font-size: 1.15rem; font-weight: 700;">🔑 Configurar API Key de Gemini</h2>
            <button class="btn btn-secondary btn-sm" id="btn-close-api-modal" style="border:none; padding:4px 8px;">✕</button>
          </div>

          <div style="padding: 4px 0 16px;">
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 14px; line-height: 1.5;">
              La API Key de Google Gemini es <strong>100% gratuita</strong> y permite que la IA interprete cualquier tipo de factura con alta precisión.
            </p>

            <div style="background: var(--bg-main); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; font-size: 0.8rem; margin-bottom: 14px; line-height: 1.6;">
              <strong>¿Cómo obtener tu clave gratis?</strong><br>
              1. Entra a <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: var(--primary); font-weight: 700;">aistudio.google.com/app/apikey</a>.<br>
              2. Inicia sesión con tu cuenta de Google.<br>
              3. Dale clic a <strong>"Create API key"</strong> y pégala aquí abajo.
            </div>

            <form id="form-gemini-key">
              <div class="form-group">
                <label class="form-label">Tu Gemini API Key</label>
                <input type="password" id="inp-gemini-key-val" class="form-input" value="${currentKey}" placeholder="AIzaSy..." required>
              </div>

              <div style="display: flex; gap: 8px; margin-top: 12px;">
                <button type="button" class="btn btn-secondary" id="btn-cancel-key" style="flex: 1;">Cancelar</button>
                <button type="submit" class="btn btn-primary" id="btn-save-key-action" style="flex: 2;">Guardar y Probar</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-api-modal')?.addEventListener('click', close);
    document.getElementById('btn-cancel-key')?.addEventListener('click', close);
    document.getElementById('api-key-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'api-key-modal-backdrop') close();
    });

    document.getElementById('form-gemini-key')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('btn-save-key-action');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Verificando clave...';

      const keyVal = document.getElementById('inp-gemini-key-val').value.trim();
      const testRes = await testGeminiApiKey(keyVal);

      if (!testRes.success) {
        showToast('Error al verificar la clave: ' + testRes.message, 'error', 5000);
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar y Probar';
        return;
      }

      setGeminiApiKey(keyVal);
      showToast('¡Clave de Gemini verificada y guardada con éxito! ✨', 'success');
      close();
      renderInitial();
    });
  }

  renderInitial();
}
