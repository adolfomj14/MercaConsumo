// Vista de Escaneo de Facturas con IA — Control de Planes y Límites Semanales
import { parseReceiptWithAI, testGeminiApiKey } from '../services/ocr.js';
import { getGeminiApiKey, setGeminiApiKey, isUserAdmin } from '../config.js';
import { state } from '../state.js';
import { registerPurchase } from '../services/purchases.js';
import { createProduct, updateProduct, fetchProducts } from '../services/products.js';
import { createStore, fetchStores } from '../services/stores.js';
import { findBestProductMatch, findBestStoreMatch, guessCategory } from '../utils/matcher.js';
import { getUserSubscriptionInfo, recordScanUsage, PLAN_PRICES } from '../services/subscriptions.js';
import { formatCurrency } from '../utils/formatters.js';
import { showToast } from '../utils/toast.js';

export function renderScanView(container, navigateTo) {
  let detectedData = null;
  const user = state.user;
  const isAdmin = isUserAdmin(user);

  async function renderInitial() {
    const hasKey = Boolean(getGeminiApiKey());
    const sub = await getUserSubscriptionInfo();

    container.innerHTML = `
      <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h1 style="font-size: 1.35rem; font-weight: 800;">📷 Escanear con IA</h1>
          <p style="color: var(--text-muted); font-size: 0.85rem;">Digitalización inteligente y auto-categorización</p>
        </div>
        ${isAdmin ? `
          <button class="btn btn-secondary btn-sm" id="btn-config-key" style="font-size: 0.75rem; padding: 4px 8px;">
            🔑 ${hasKey ? 'Admin Clave IA' : 'Configurar Clave'}
          </button>
        ` : ''}
      </div>

      <!-- Tarjeta de Estado del Plan y Escaneos Disponibles -->
      <div class="mc-card" style="background: ${sub.canScan ? '#f0fdf4' : '#fef2f2'}; border: 1.5px solid ${sub.canScan ? '#bbf7d0' : '#fecaca'}; padding: 12px 14px; margin-bottom: 16px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span style="font-size:0.75rem; font-weight:700; color:${sub.canScan ? '#166534' : '#991b1b'};">TU PLAN ACTUAL</span>
            <div style="font-size:0.95rem; font-weight:800; color:var(--text-main);">
              ${sub.planName}
            </div>
          </div>

          <div style="text-align:right;">
            <span style="font-size:0.72rem; color:var(--text-muted);">Escaneos esta semana:</span>
            <div style="font-size:0.95rem; font-weight:800; color:${sub.canScan ? '#166534' : '#dc2626'};">
              ${sub.scansLimit === Infinity ? 'Ilimitados ⚡' : `${sub.scansUsed} de ${sub.scansLimit} usados`}
            </div>
          </div>
        </div>

        ${!sub.canScan ? `
          <div style="margin-top:10px; padding-top:8px; border-top:1px dashed #fca5a5; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.78rem; color:#b91c1c; font-weight:600;">⚠️ Agotaste tu escaneo semanal</span>
            <button class="btn btn-primary btn-sm" id="btn-upgrade-scan-card" style="font-size:0.75rem; padding:3px 8px;">
              ⭐ Mejorar a Premium
            </button>
          </div>
        ` : ''}
      </div>

      <div class="mc-card" style="text-align: center; padding: 32px 20px; border: 2px dashed var(--border);">
        <div style="font-size: 3.2rem; margin-bottom: 10px;">🧾</div>
        <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 6px;">Capturar Factura o Ticket</h3>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 22px; line-height: 1.5;">
          Toma una foto de tu recibo del supermercado.<br>La IA identificará los productos, sus categorías y los sumará a tu despensa.
        </p>

        <input type="file" id="inp-camera" accept="image/*" capture="environment" style="display: none;">
        <input type="file" id="inp-gallery" accept="image/*" style="display: none;">

        <div style="display: flex; flex-direction: column; gap: 10px; max-width: 280px; margin: 0 auto;">
          <button class="btn btn-primary" id="btn-trigger-camera" style="font-size: 1rem;">📸 Tomar Fotografía</button>
          <button class="btn btn-secondary" id="btn-trigger-gallery" style="font-size: 1rem;">🖼️ Subir desde Galería</button>
        </div>
      </div>
    `;

    const inpCam = document.getElementById('inp-camera');
    const inpGal = document.getElementById('inp-gallery');

    if (isAdmin) {
      document.getElementById('btn-config-key')?.addEventListener('click', openApiKeyModal);
    }

    document.getElementById('btn-upgrade-scan-card')?.addEventListener('click', openUpgradeModal);

    document.getElementById('btn-trigger-camera')?.addEventListener('click', async () => {
      const currentSub = await getUserSubscriptionInfo();
      if (!currentSub.canScan) {
        openUpgradeModal();
        return;
      }
      if (!getGeminiApiKey()) {
        showToast(isAdmin ? 'Configura la API Key de Gemini primero' : 'El lector de IA no está configurado. Contacta al administrador.', 'error');
        if (isAdmin) openApiKeyModal();
        return;
      }
      inpCam.click();
    });

    document.getElementById('btn-trigger-gallery')?.addEventListener('click', async () => {
      const currentSub = await getUserSubscriptionInfo();
      if (!currentSub.canScan) {
        openUpgradeModal();
        return;
      }
      if (!getGeminiApiKey()) {
        showToast(isAdmin ? 'Configura la API Key de Gemini primero' : 'El lector de IA no está configurado. Contacta al administrador.', 'error');
        if (isAdmin) openApiKeyModal();
        return;
      }
      inpGal.click();
    });

    inpCam.addEventListener('change', e => { if (e.target.files[0]) processFile(e.target.files[0]); });
    inpGal.addEventListener('change', e => { if (e.target.files[0]) processFile(e.target.files[0]); });
  }

  async function processFile(file) {
    container.innerHTML = `
      <div style="min-height: calc(100vh - 140px); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px;">
        <div style="font-size: 3.5rem;">🧠</div>
        <h2 style="font-size: 1.25rem; font-weight: 800; margin-top: 16px;">La IA está leyendo tu factura...</h2>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 6px; max-width: 300px;">
          Extrayendo información, reconociendo categorías y buscando coincidencias en tu catálogo.
        </p>
        <div style="margin-top: 24px;">
          <img id="scan-preview-img" src="" alt="Factura" style="max-width: 180px; max-height: 180px; border-radius: 12px; box-shadow: 0 4px 14px rgba(0,0,0,0.15); object-fit: contain;">
        </div>
        <div style="margin-top: 20px; font-size: 0.8rem; color: var(--primary); font-weight: 600;">⚡ Procesando en Gemini Flash (~1-2 seg)</div>
      </div>
    `;
    const reader = new FileReader();
    reader.onload = e => { const img = document.getElementById('scan-preview-img'); if (img) img.src = e.target.result; };
    reader.readAsDataURL(file);

    try {
      detectedData = await parseReceiptWithAI(file);
      await recordScanUsage(); // Consumir 1 escaneo
      renderReviewScreen();
    } catch (err) {
      if (err.message === 'NO_API_KEY') {
        showToast(isAdmin ? 'Por favor configura tu API Key de Gemini' : 'El servicio de IA no está disponible en este momento.', 'info');
        if (isAdmin) openApiKeyModal();
      } else {
        showToast('Error al analizar la factura: ' + err.message, 'error', 6000);
      }
      renderInitial();
    }
  }

  function renderReviewScreen() {
    const d = detectedData;
    const existingStores   = state.stores   || [];
    const existingProducts = state.products || [];
    const categories       = state.categories || [];

    const storeMatch = findBestStoreMatch(d.merchant, existingStores);

    d.items.forEach(it => {
      if (it.selectedTarget === undefined) {
        const prodMatch = findBestProductMatch(it.name || it.rawName, existingProducts);
        if (prodMatch) {
          it.selectedTarget  = `existing_${prodMatch.product.id}`;
          it.matchedProduct   = prodMatch.product;
          it.matchSimilarity  = prodMatch.similarity;
          it.unit             = prodMatch.product.base_unit || it.unit;
          it.categoryId       = prodMatch.product.category_id || null;
        } else {
          it.selectedTarget  = 'new';
          it.matchedProduct   = null;
          const guessed = guessCategory(it.name || it.rawName, categories) ||
                          categories.find(c => c.name.toLowerCase() === (it.category || '').toLowerCase());
          it.categoryId = guessed ? guessed.id : null;
        }
      }
    });

    const storeDatalistOpts = existingStores.map(s => `<option value="${s.name}">`).join('');
    const storeDefaultValue = storeMatch ? storeMatch.store.name : (d.merchant || '');

    container.innerHTML = `
      <div style="margin-bottom: 16px;">
        <span class="badge badge-normal" style="font-size: 0.75rem; background: #dcfce7; color: #15803d;">✨ INTERPRETADO POR IA CON ÉXITO</span>
        <h1 style="font-size: 1.3rem; font-weight: 800; margin-top: 6px;">Revisar y Asignar Productos</h1>
        <p style="color: var(--text-muted); font-size: 0.82rem;">La IA clasificó automáticamente los productos. Puedes modificar nombres y categorías libremente.</p>
      </div>

      <div class="mc-card">
        <!-- Establecimiento -->
        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label">Establecimiento / Supermercado</label>
          <div style="font-size: 0.73rem; color: var(--text-muted); margin-bottom: 4px;">
            🧾 IA leyó: <em>"${d.merchant}"</em>
            ${storeMatch ? `· 💡 Sugerido: <strong>${storeMatch.store.name}</strong>` : '· (Nuevo)'}
          </div>
          <datalist id="stores-datalist">${storeDatalistOpts}</datalist>
          <input type="text" id="rev-store-input" class="form-input" list="stores-datalist"
                 value="${storeDefaultValue}" placeholder="Escribe o selecciona un supermercado..."
                 style="font-weight: 600;">
        </div>

        <!-- Fecha y Método de Pago -->
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
            ${d.items.map((it, idx) => reviewItemCard(it, idx, existingProducts, categories)).join('')}
          </div>
        </div>

        <!-- Total -->
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

  function reviewItemCard(it, idx, existingProducts, categories) {
    const units     = ['kg','g','unidad','L','ml','paquete','bolsa','caja','lb','docena'];
    const rawAiName = it.rawName || it.name || '';
    const isNew     = !it.selectedTarget || it.selectedTarget === 'new';

    const catOptions = categories.map(c =>
      `<option value="${c.id}" ${it.categoryId === c.id ? 'selected' : ''}>${c.icon || '📦'} ${c.name}</option>`
    ).join('');

    const matchedCatObj = categories.find(c => c.id === it.categoryId);

    return `
      <div style="background: var(--bg-main); border: 1px solid var(--border); border-radius: 12px; padding: 12px; margin-bottom: 10px;" id="item-card-${idx}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 0.73rem; color: var(--text-muted); font-weight: 600;">
            🧾 IA: <em>"${rawAiName}"</em>
          </span>
          <button type="button" class="btn btn-secondary btn-sm btn-del-item" data-idx="${idx}"
                  style="color: var(--danger); border-color: #fecaca; padding: 2px 6px; font-size: 0.75rem;">✕ Quitar</button>
        </div>

        <!-- Nombre editable -->
        <div class="form-group" style="margin-bottom: 8px;">
          <label style="font-size: 0.7rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Nombre del Producto</label>
          <input type="text" class="form-input item-name-in" data-idx="${idx}"
                 value="${it.name || rawAiName}"
                 placeholder="Nombre del producto..."
                 style="font-size: 0.88rem; font-weight: 600; padding: 7px 10px;">
        </div>

        <!-- Vincular con producto existente -->
        <div class="form-group" style="margin-bottom: 8px;">
          <label style="font-size: 0.7rem; color: var(--text-muted); display: block; margin-bottom: 2px;">
            Vincular con producto existente:
          </label>
          <select class="form-select item-target-select" data-idx="${idx}" style="font-size: 0.82rem;">
            <option value="new" ${isNew ? 'selected' : ''}>➕ Crear como nuevo producto</option>
            ${existingProducts.length > 0 ? `<optgroup label="— Tus Productos —">
              ${existingProducts.map(p => {
                const isMatched = it.matchedProduct && it.matchedProduct.id === p.id;
                return `<option value="existing_${p.id}" ${it.selectedTarget === `existing_${p.id}` ? 'selected' : ''}>
                  ${p.categoryIcon || '📦'} ${p.name} (${p.base_unit})${isMatched ? ' ⭐ Sugerido' : ''}
                </option>`;
              }).join('')}
            </optgroup>` : ''}
          </select>
          ${it.matchedProduct && it.selectedTarget === `existing_${it.matchedProduct.id}` ? `
            <div style="font-size: 0.72rem; color: #15803d; background: #dcfce7; padding: 3px 8px; border-radius: 6px; margin-top: 4px; font-weight: 600;">
              💡 Vinculado con: <strong>${it.matchedProduct.name}</strong> (${Math.round(it.matchSimilarity * 100)}% similitud)
            </div>
          ` : ''}
        </div>

        <!-- Selector de Categoría -->
        <div class="form-group" style="margin-bottom: 8px;">
          <label style="font-size: 0.7rem; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
            <span>Categoría:</span>
            ${matchedCatObj ? `<span style="color: var(--primary-dark); font-weight: 700;">✨ Auto-detectado: ${matchedCatObj.icon || ''} ${matchedCatObj.name}</span>` : ''}
          </label>
          <select class="form-select item-category-in" data-idx="${idx}" style="font-size: 0.84rem; font-weight: 600;">
            <option value="">📦 General / Sin categoría</option>
            ${catOptions}
          </select>
        </div>

        <!-- Cantidad, Unidad y Precio -->
        <div style="display: grid; grid-template-columns: 1fr 1.1fr 1.2fr; gap: 6px;">
          <div>
            <label style="font-size: 0.7rem; color: var(--text-muted); display: block;">Cantidad</label>
            <input type="number" step="any" min="0.001" class="form-input item-qty-in" data-idx="${idx}"
                   value="${it.quantity}" style="font-size: 0.85rem; padding: 6px 8px;">
          </div>
          <div>
            <label style="font-size: 0.7rem; color: var(--text-muted); display: block;">Unidad</label>
            <select class="form-select item-unit-in" data-idx="${idx}" style="font-size: 0.82rem; padding: 6px 6px;">
              ${units.map(u => `<option value="${u}" ${it.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size: 0.7rem; color: var(--text-muted); display: block;">Precio Total</label>
            <input type="number" step="100" class="form-input item-total-in" data-idx="${idx}"
                   value="${it.totalPrice}" style="font-size: 0.85rem; padding: 6px 8px;">
          </div>
        </div>
      </div>
    `;
  }

  function attachReviewEvents() {
    const existingProducts = state.products  || [];
    const categories       = state.categories || [];

    document.getElementById('btn-cancel-scan')?.addEventListener('click', renderInitial);

    document.getElementById('btn-add-scanned-item')?.addEventListener('click', () => {
      detectedData.items.push({ name: '', rawName: 'Nuevo Ítem', quantity: 1, unit: 'kg', totalPrice: 0, selectedTarget: 'new', categoryId: null });
      renderReviewScreen();
    });

    document.querySelectorAll('.btn-del-item').forEach(btn => {
      btn.addEventListener('click', () => {
        detectedData.items.splice(parseInt(btn.getAttribute('data-idx')), 1);
        renderReviewScreen();
      });
    });

    document.querySelectorAll('.item-name-in').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(inp.getAttribute('data-idx'));
        detectedData.items[idx].name = e.target.value;

        if (detectedData.items[idx].selectedTarget === 'new') {
          const guessed = guessCategory(e.target.value, categories);
          if (guessed) {
            detectedData.items[idx].categoryId = guessed.id;
            const catSelect = document.querySelector(`.item-category-in[data-idx="${idx}"]`);
            if (catSelect) catSelect.value = guessed.id;
          }
        }
      });
    });

    document.querySelectorAll('.item-target-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const idx = parseInt(sel.getAttribute('data-idx'));
        const val = sel.value;
        detectedData.items[idx].selectedTarget = val;

        if (val.startsWith('existing_')) {
          const prod = existingProducts.find(p => p.id === val.replace('existing_', ''));
          if (prod) {
            detectedData.items[idx].unit = prod.base_unit || detectedData.items[idx].unit;
            detectedData.items[idx].matchedProduct  = prod;
            detectedData.items[idx].matchSimilarity = 1;
            detectedData.items[idx].categoryId      = prod.category_id || null;
          }
        } else {
          detectedData.items[idx].matchedProduct = null;
          const guessed = guessCategory(detectedData.items[idx].name, categories);
          if (guessed) detectedData.items[idx].categoryId = guessed.id;
        }

        const card = document.getElementById(`item-card-${idx}`);
        if (card) {
          const tmp = document.createElement('div');
          tmp.innerHTML = reviewItemCard(detectedData.items[idx], idx, existingProducts, categories);
          card.replaceWith(tmp.firstElementChild);
          reattachCardEvents(idx);
        }
      });
    });

    document.querySelectorAll('.item-category-in').forEach(sel => {
      sel.addEventListener('change', () => {
        const idx = parseInt(sel.getAttribute('data-idx'));
        detectedData.items[idx].categoryId = sel.value || null;
      });
    });

    document.querySelectorAll('.item-qty-in').forEach(inp => {
      inp.addEventListener('input', () => {
        detectedData.items[parseInt(inp.getAttribute('data-idx'))].quantity = parseFloat(inp.value) || 1;
      });
    });

    document.querySelectorAll('.item-unit-in').forEach(sel => {
      sel.addEventListener('change', () => {
        detectedData.items[parseInt(sel.getAttribute('data-idx'))].unit = sel.value;
      });
    });

    document.querySelectorAll('.item-total-in').forEach(inp => {
      inp.addEventListener('input', () => {
        detectedData.items[parseInt(inp.getAttribute('data-idx'))].totalPrice = parseFloat(inp.value) || 0;
        const totalEl = document.getElementById('rev-total-display');
        if (totalEl) totalEl.textContent = formatCurrency(calcTotal());
      });
    });

    document.getElementById('btn-confirm-save-scan')?.addEventListener('click', handleSave);
  }

  function reattachCardEvents(idx) {
    const existingProducts = state.products  || [];
    const categories       = state.categories || [];

    document.querySelector(`.btn-del-item[data-idx="${idx}"]`)?.addEventListener('click', () => {
      detectedData.items.splice(idx, 1); renderReviewScreen();
    });

    document.querySelector(`.item-name-in[data-idx="${idx}"]`)?.addEventListener('input', e => {
      detectedData.items[idx].name = e.target.value;
      if (detectedData.items[idx].selectedTarget === 'new') {
        const guessed = guessCategory(e.target.value, categories);
        if (guessed) {
          detectedData.items[idx].categoryId = guessed.id;
          const catSelect = document.querySelector(`.item-category-in[data-idx="${idx}"]`);
          if (catSelect) catSelect.value = guessed.id;
        }
      }
    });

    document.querySelector(`.item-target-select[data-idx="${idx}"]`)?.addEventListener('change', e => {
      const val = e.target.value;
      detectedData.items[idx].selectedTarget = val;
      if (val.startsWith('existing_')) {
        const prod = existingProducts.find(p => p.id === val.replace('existing_', ''));
        if (prod) {
          detectedData.items[idx].unit = prod.base_unit || detectedData.items[idx].unit;
          detectedData.items[idx].matchedProduct  = prod;
          detectedData.items[idx].categoryId      = prod.category_id || null;
        }
      } else {
        detectedData.items[idx].matchedProduct = null;
        const guessed = guessCategory(detectedData.items[idx].name, categories);
        if (guessed) detectedData.items[idx].categoryId = guessed.id;
      }
      const card = document.getElementById(`item-card-${idx}`);
      if (card) {
        const tmp = document.createElement('div');
        tmp.innerHTML = reviewItemCard(detectedData.items[idx], idx, existingProducts, categories);
        card.replaceWith(tmp.firstElementChild);
        reattachCardEvents(idx);
      }
    });

    document.querySelector(`.item-category-in[data-idx="${idx}"]`)?.addEventListener('change', e => {
      detectedData.items[idx].categoryId = e.target.value || null;
    });

    document.querySelector(`.item-qty-in[data-idx="${idx}"]`)?.addEventListener('input', e => {
      detectedData.items[idx].quantity = parseFloat(e.target.value) || 1;
    });

    document.querySelector(`.item-unit-in[data-idx="${idx}"]`)?.addEventListener('change', e => {
      detectedData.items[idx].unit = e.target.value;
    });

    document.querySelector(`.item-total-in[data-idx="${idx}"]`)?.addEventListener('input', e => {
      detectedData.items[idx].totalPrice = parseFloat(e.target.value) || 0;
      const totalEl = document.getElementById('rev-total-display');
      if (totalEl) totalEl.textContent = formatCurrency(calcTotal());
    });
  }

  async function handleSave() {
    const btn = document.getElementById('btn-confirm-save-scan');
    btn.disabled = true; btn.textContent = 'Guardando en Supabase...';

    try {
      const storeInputVal = (document.getElementById('rev-store-input')?.value || '').trim();
      const date    = document.getElementById('rev-date').value;
      const payment = document.getElementById('rev-payment').value;

      let storeId = null;
      const matched = (state.stores || []).find(s => s.name.toLowerCase() === storeInputVal.toLowerCase());
      if (matched) {
        storeId = matched.id;
      } else {
        const newStore = await createStore({ name: storeInputVal || 'Supermercado', platform: 'Físico' });
        await fetchStores();
        storeId = newStore.id;
      }

      const finalItems = [];
      for (const it of detectedData.items) {
        let productId = null;
        let productName = it.name || it.rawName || '';

        if (it.selectedTarget && it.selectedTarget.startsWith('existing_')) {
          productId = it.selectedTarget.replace('existing_', '');
          const ep = (state.products || []).find(p => p.id === productId);
          if (ep) {
            productName = it.name || ep.name;
            if (it.categoryId !== ep.category_id || (it.name && it.name.trim() !== ep.name)) {
              await updateProduct({ id: productId, name: productName, categoryId: it.categoryId });
            }
          }
        } else {
          const cleanName = productName.trim();
          if (!cleanName) continue;
          const newP = await createProduct({ name: cleanName, categoryId: it.categoryId || null, baseUnit: it.unit });
          await fetchProducts();
          productId   = newP.id;
          productName = newP.name;
        }

        const qty = Number(it.quantity) || 1;
        const tot = Number(it.totalPrice) || 0;
        finalItems.push({
          product_id:  productId,
          productName: productName,
          quantity:    qty,
          unit:        it.unit,
          unit_price:  qty > 0 ? (tot / qty) : tot,
          total_price: tot
        });
      }

      if (finalItems.length === 0) {
        showToast('No hay productos válidos para guardar', 'error');
        btn.disabled = false; btn.textContent = 'Guardar en Despensa ✅'; return;
      }

      await registerPurchase({ storeId, purchaseDate: date, paymentMethod: payment, items: finalItems, source: 'receipt_ocr' });
      showToast('¡Factura guardada e inventario actualizado con categorías! 🎯', 'success');
      navigateTo('inventory');
    } catch (err) {
      console.error('Error guardando factura:', err);
      showToast('Error al guardar: ' + err.message, 'error');
      btn.disabled = false; btn.textContent = 'Guardar en Despensa ✅';
    }
  }

  function openApiKeyModal() {
    const modalContainer = document.getElementById('modal-container');
    const currentKey = getGeminiApiKey();
    modalContainer.innerHTML = `
      <div class="modal-backdrop show" id="api-key-modal-backdrop">
        <div class="modal-sheet">
          <div class="modal-header">
            <h2 style="font-size: 1.15rem; font-weight: 700;">👑 Configurar API Key General (Admin)</h2>
            <button class="btn btn-secondary btn-sm" id="btn-close-api-modal" style="border:none; padding:4px 8px;">✕</button>
          </div>
          <div style="padding: 4px 0 16px;">
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 14px; line-height: 1.5;">
              Como administrador, esta clave se guardará de forma segura en Supabase para dar servicio de escaneo a todos los usuarios de la app.
            </p>
            <form id="form-gemini-key">
              <div class="form-group">
                <label class="form-label">Gemini API Key</label>
                <input type="password" id="inp-gemini-key-val" class="form-input" value="${currentKey}" placeholder="AIzaSy..." required>
              </div>
              <div style="display: flex; gap: 8px; margin-top: 12px;">
                <button type="button" class="btn btn-secondary" id="btn-cancel-key" style="flex: 1;">Cancelar</button>
                <button type="submit" class="btn btn-primary" id="btn-save-key-action" style="flex: 2;">Guardar Clave General</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    const close = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-api-modal')?.addEventListener('click', close);
    document.getElementById('btn-cancel-key')?.addEventListener('click', close);
    document.getElementById('api-key-modal-backdrop')?.addEventListener('click', e => { if (e.target.id === 'api-key-modal-backdrop') close(); });
    document.getElementById('form-gemini-key')?.addEventListener('submit', async e => {
      e.preventDefault();
      const saveBtn = document.getElementById('btn-save-key-action');
      saveBtn.disabled = true; saveBtn.textContent = 'Verificando clave...';
      const keyVal  = document.getElementById('inp-gemini-key-val').value.trim();
      const testRes = await testGeminiApiKey(keyVal);
      if (!testRes.success) {
        showToast('Error al verificar la clave: ' + testRes.message, 'error', 5000);
        saveBtn.disabled = false; saveBtn.textContent = 'Guardar Clave General'; return;
      }
      await setGeminiApiKey(keyVal);
      showToast('¡Clave de Gemini guardada globalmente con éxito! ✨', 'success');
      close(); renderInitial();
    });
  }

  // Modal para Actualizar a Plan Premium / Pro
  function openUpgradeModal() {
    const mc = document.getElementById('modal-container');
    mc.innerHTML = `<div class="modal-backdrop show" id="modal-plans-backdrop">
        <div class="modal-sheet" style="background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border);">
          <div class="modal-header" style="border-bottom: 1px solid var(--border);">
            <h2 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin:0;">⭐ Planes MercaConsumo</h2>
            <button class="btn btn-secondary btn-sm" id="btn-close-plans-modal" style="border:none; padding:4px 8px;">✕</button>
          </div>

          <div style="padding: 10px 0 16px;">
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px; line-height: 1.4;">
              Automatiza tu despensa con IA y ahorra tiempo y dinero en cada compra.
            </p>

            <!-- Plan Premium -->
            <div class="mc-card" style="border: 2px solid var(--primary); background: var(--bg-main); margin-bottom: 14px; padding: 16px; border-radius: 14px;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                  <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: var(--primary); font-size: 0.72rem; font-weight: 800; border: 1px solid var(--primary);">MÁS POPULAR ⭐</span>
                  <h3 style="font-size: 1.15rem; font-weight: 800; margin-top: 6px; color: var(--text-main);">Plan Premium</h3>
                </div>
                <div style="text-align:right;">
                  <span style="font-size: 1.35rem; font-weight: 800; color: var(--primary);">$9.900</span>
                  <small style="font-size: 0.75rem; color: var(--text-muted); display: block;">COP / mes</small>
                </div>
              </div>

              <ul style="font-size: 0.84rem; margin: 12px 0 14px 18px; color: var(--text-main); line-height: 1.7;">
                <li>📸 <strong>10 facturas semanales</strong> con IA (~40 al mes)</li>
                <li>🏪 Comparador inteligente de precios entre tiendas</li>
                <li>🛒 Lista de compras automática con alertas</li>
              </ul>

              <button class="btn btn-primary" id="btn-buy-premium-action" style="width: 100%; font-size: 0.92rem; font-weight: 700; padding: 10px 0;">
                Elegir Plan Premium ($9.900/mes)
              </button>
            </div>

            <!-- Plan Pro -->
            <div class="mc-card" style="border: 1.5px solid #818cf8; background: var(--bg-main); margin-bottom: 14px; padding: 16px; border-radius: 14px;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                  <span class="badge" style="background: rgba(99, 102, 241, 0.2); color: #818cf8; font-size: 0.72rem; font-weight: 800; border: 1px solid #818cf8;">ILIMITADO 🚀</span>
                  <h3 style="font-size: 1.15rem; font-weight: 800; margin-top: 6px; color: var(--text-main);">Plan Pro</h3>
                </div>
                <div style="text-align:right;">
                  <span style="font-size: 1.35rem; font-weight: 800; color: #818cf8;">$19.900</span>
                  <small style="font-size: 0.75rem; color: var(--text-muted); display: block;">COP / mes</small>
                </div>
              </div>

              <ul style="font-size: 0.84rem; margin: 12px 0 14px 18px; color: var(--text-main); line-height: 1.7;">
                <li>⚡ <strong>Facturas ILIMITADAS</strong> con IA</li>
                <li>👥 Despensa compartida y multiusuario familiar</li>
                <li>📊 Exportación de reportes y soporte VIP</li>
              </ul>

              <button class="btn btn-secondary" id="btn-buy-pro-action" style="width: 100%; font-size: 0.92rem; font-weight: 700; padding: 10px 0; background: #6366f1; color: white; border: none;">
                Elegir Plan Pro ($19.900/mes)
              </button>
            </div>

            <!-- Plan Gratuito -->
            <div style="text-align: center; padding: 4px;">
              <small style="color: var(--text-muted); font-size: 0.8rem;">
                Plan Gratuito: 1 factura semanal y despensa manual ilimitada para siempre.
              </small>
            </div>

          </div>
        </div>
      </div>`;

    const close = () => { mc.innerHTML = ''; };
    document.getElementById('btn-close-plans-modal')?.addEventListener('click', close);
    document.getElementById('modal-plans-backdrop')?.addEventListener('click', e => { if (e.target.id === 'modal-plans-backdrop') close(); });

    document.getElementById('btn-buy-premium-action')?.addEventListener('click', () => {
      showToast('Pronto podrás pagar directamente con Nequi y Tarjeta 🚀', 'info', 4000);
    });

    document.getElementById('btn-buy-pro-action')?.addEventListener('click', () => {
      showToast('Pronto podrás pagar directamente con Nequi y Tarjeta 🚀', 'info', 4000);
    });
  }
  renderInitial();
}
