// Vista de Historial y Registro de Compras
import { state } from '../state.js';
import { formatCurrency, formatDate, formatQuantity } from '../utils/formatters.js';
import { registerPurchase } from '../services/purchases.js';
import { createProduct, fetchProducts } from '../services/products.js';
import { createStore, fetchStores } from '../services/stores.js';
import { showToast } from '../utils/toast.js';

export function renderPurchasesView(container, navigateTo, params = {}) {
  const purchases = state.purchases || [];

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <div>
        <h1 style="font-size:1.35rem; font-weight:800;">Compras</h1>
        <p style="color:var(--text-muted); font-size:0.85rem;">Historial y registro de facturas</p>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-open-purchase-modal">+ Nueva Compra</button>
    </div>

    ${purchases.length === 0 ? `
      <div class="mc-card" style="text-align:center; padding:32px 16px;">
        <div style="font-size:2.5rem; margin-bottom:8px;">🛒</div>
        <h3 style="font-weight:700;">No hay compras registradas</h3>
        <p style="color:var(--text-muted); font-size:0.9rem; margin-top:4px;">
          Presiona <strong>+ Nueva Compra</strong> para empezar.
        </p>
      </div>
    ` : `
      <div style="display:flex; flex-direction:column; gap:12px;">
        ${purchases.map(p => `
          <div class="mc-card" style="padding:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-weight:700; font-size:1rem;">${p.storeName || 'Comercio'}</span>
              <span style="font-weight:800; color:var(--primary-dark); font-size:1.05rem;">${formatCurrency(p.total_amount)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted); margin-bottom:8px;">
              <span>📅 ${formatDate(p.purchase_date)}</span>
              <span>${p.payment_method || 'Efectivo'}</span>
            </div>
            <div style="background:var(--bg-main); border-radius:8px; padding:8px; font-size:0.85rem;">
              ${(p.items || []).map(it => `
                <div style="display:flex; justify-content:space-between; padding:2px 0;">
                  <span>
                    ${it.productName || 'Producto'} (${formatQuantity(it.quantity, it.unit)})
                    ${it.notes ? `<small style="color:var(--text-muted); margin-left:4px;">${it.notes}</small>` : ''}
                  </span>
                  <span style="font-weight:600;">${formatCurrency(it.total_price)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `}
  `;

  document.getElementById('btn-open-purchase-modal')?.addEventListener('click', () => openModal());
  if (params.openModal) openModal();

  function openModal() {
    const mc = document.getElementById('modal-container');
    const today = new Date().toISOString().split('T')[0];

    let stores     = [...(state.stores     || [])];
    let products   = [...(state.products   || [])];
    let categories = [...(state.categories || [])];
    let items = [newItem()];

    function newItem() {
      return { product_id: '', quantity: 1, unit: 'kg', units_count: '', unit_price: 0 };
    }

    function storeOptions() {
      const base = '<option value="">Selecciona o crea una tienda...</option>';
      return base + stores.map(s => `<option value="${s.id}">${s.name}${s.platform ? ' · ' + s.platform : ''}</option>`).join('');
    }

    function productOptions(selectedId) {
      const base = '<option value="">Selecciona o crea un producto...</option>';
      return base + products.map(p => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.name} (${p.base_unit})</option>`).join('');
    }

    function categoryOptions() {
      return '<option value="">Sin categoría</option>' +
        categories.map(c => `<option value="${c.id}">${c.icon || '📦'} ${c.name}</option>`).join('');
    }

    function totalAmount() {
      return items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0);
    }

    function itemRow(it, idx) {
      const units = ['kg','g','unidad','L','ml','paquete','bolsa','caja','lb','docena'];
      return `
        <div style="background:var(--bg-main); border:1px solid var(--border); border-radius:12px; padding:12px; margin-bottom:8px;">
          <div style="display:flex; gap:6px; align-items:center; margin-bottom:8px;">
            <select class="form-select item-prod" data-idx="${idx}" style="flex:1; font-size:0.82rem;">
              ${productOptions(it.product_id)}
            </select>
            <button type="button" class="btn btn-secondary btn-sm btn-new-product" data-idx="${idx}"
                    style="padding:6px 10px; font-size:0.78rem; white-space:nowrap;">+ Prod</button>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; margin-bottom:6px;">
            <div>
              <label style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:2px;">Cantidad</label>
              <input type="number" class="form-input item-qty" data-idx="${idx}"
                     value="${it.quantity}" min="0.001" step="any" style="font-size:0.85rem; padding:6px 8px;">
            </div>
            <div>
              <label style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:2px;">Unidad</label>
              <select class="form-select item-unit" data-idx="${idx}" style="font-size:0.82rem; padding:6px 6px;">
                ${units.map(u => `<option value="${u}" ${it.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:2px;">Precio unit.</label>
              <input type="number" class="form-input item-price" data-idx="${idx}"
                     value="${it.unit_price}" min="0" step="100" style="font-size:0.85rem; padding:6px 8px;">
            </div>
          </div>

          <!-- Unidades opcionales contenidas (ej: 8 manzanas en 2 kg) -->
          <div style="margin-bottom: 6px;">
            <label style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:2px;">
              Unidades contenidas <small style="color:var(--text-muted);">(Opcional, ej: 8 unidades)</small>
            </label>
            <input type="number" step="any" min="0.1" class="form-input item-units-count" data-idx="${idx}"
                   value="${it.units_count || ''}" placeholder="Ej: 8" style="font-size:0.82rem; padding:4px 8px;">
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 4px;">
            <span style="font-size:0.8rem; color:var(--text-muted);">
              Subtotal: <strong>${formatCurrency((parseFloat(it.quantity)||0) * (parseFloat(it.unit_price)||0))}</strong>
            </span>
            ${idx > 0 ? `<button type="button" class="btn btn-secondary btn-sm btn-rm-item" data-idx="${idx}"
                                 style="color:var(--danger); border-color:#fecaca; padding:3px 8px; font-size:0.75rem;">Quitar</button>` : ''}
          </div>
        </div>`;
    }

    function renderModal() {
      mc.innerHTML = `
        <div class="modal-backdrop show" id="pur-backdrop">
          <div class="modal-sheet" style="max-height:92vh; overflow-y:auto;">
            <div class="modal-header">
              <h2 style="font-size:1.1rem; font-weight:700;">🛒 Registrar Compra</h2>
              <button id="btn-close-pur" style="background:none; border:none; font-size:1.4rem; cursor:pointer; padding:4px 8px;">✕</button>
            </div>

            <form id="pur-form" style="padding:0 2px 16px;">
              <div class="form-group">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                  <label class="form-label" style="margin:0;">Establecimiento</label>
                  <button type="button" id="btn-new-store" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:3px 8px;">+ Nueva tienda</button>
                </div>
                <select class="form-select" id="pur-store">${storeOptions()}</select>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div class="form-group">
                  <label class="form-label">Fecha</label>
                  <input type="date" class="form-input" id="pur-date" value="${today}" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Método de pago</label>
                  <select class="form-select" id="pur-payment">
                    <option>Efectivo</option>
                    <option>Tarjeta Débito</option>
                    <option>Tarjeta Crédito</option>
                    <option>Nequi</option>
                    <option>Daviplata</option>
                    <option>Transferencia</option>
                  </select>
                </div>
              </div>

              <div style="margin:12px 0 8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <label class="form-label" style="margin:0;">Productos</label>
                  <button type="button" id="btn-add-item" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:3px 8px;">+ Agregar ítem</button>
                </div>
                <div id="items-list">${items.map((it, idx) => itemRow(it, idx)).join('')}</div>
              </div>

              <div style="background:linear-gradient(135deg,#10b981,#047857); color:white; border-radius:12px; padding:14px; margin-bottom:16px; text-align:right;">
                <span style="font-size:0.85rem; opacity:0.85;">TOTAL</span>
                <div id="pur-total" style="font-size:1.5rem; font-weight:800; margin-top:2px;">${formatCurrency(totalAmount())}</div>
              </div>

              <button type="submit" class="btn btn-primary" id="btn-save-pur">Guardar Compra</button>
            </form>
          </div>
        </div>
      `;

      attachEvents();
    }

    function recalcTotal() {
      const el = document.getElementById('pur-total');
      if (el) el.textContent = formatCurrency(totalAmount());
    }

    function attachEvents() {
      document.getElementById('btn-close-pur')?.addEventListener('click', () => { mc.innerHTML = ''; });
      document.getElementById('pur-backdrop')?.addEventListener('click', e => {
        if (e.target.id === 'pur-backdrop') mc.innerHTML = '';
      });

      document.getElementById('btn-add-item')?.addEventListener('click', () => {
        items.push(newItem());
        renderModal();
      });

      document.querySelectorAll('.btn-rm-item').forEach(btn => {
        btn.addEventListener('click', () => {
          items.splice(parseInt(btn.dataset.idx), 1);
          renderModal();
        });
      });

      document.querySelectorAll('.item-prod').forEach(sel => {
        sel.addEventListener('change', () => {
          const idx = parseInt(sel.dataset.idx);
          items[idx].product_id = sel.value;
          const prod = products.find(p => p.id === sel.value);
          if (prod) {
            items[idx].unit = prod.base_unit;
            const u = document.querySelector(`.item-unit[data-idx="${idx}"]`);
            if (u) u.value = prod.base_unit;
          }
        });
      });

      document.querySelectorAll('.item-qty').forEach(inp => {
        inp.addEventListener('input', () => {
          items[parseInt(inp.dataset.idx)].quantity = inp.value;
          recalcTotal();
        });
      });

      document.querySelectorAll('.item-unit').forEach(sel => {
        sel.addEventListener('change', () => { items[parseInt(sel.dataset.idx)].unit = sel.value; });
      });

      document.querySelectorAll('.item-units-count').forEach(inp => {
        inp.addEventListener('input', () => { items[parseInt(inp.dataset.idx)].units_count = inp.value; });
      });

      document.querySelectorAll('.item-price').forEach(inp => {
        inp.addEventListener('input', () => {
          items[parseInt(inp.dataset.idx)].unit_price = inp.value;
          recalcTotal();
        });
      });

      document.getElementById('btn-new-store')?.addEventListener('click', () => showInlineForm('store'));

      document.querySelectorAll('.btn-new-product').forEach(btn => {
        btn.addEventListener('click', () => showInlineForm('product', parseInt(btn.dataset.idx)));
      });

      document.getElementById('pur-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const storeId  = document.getElementById('pur-store')?.value || null;
        const date     = document.getElementById('pur-date')?.value;
        const payment  = document.getElementById('pur-payment')?.value || 'Efectivo';
        const valid    = items.filter(it => it.product_id && parseFloat(it.quantity) > 0);

        if (valid.length === 0) {
          showToast('Selecciona al menos un producto con cantidad.', 'error');
          return;
        }

        const btn = document.getElementById('btn-save-pur');
        btn.disabled = true; btn.textContent = 'Guardando...';

        try {
          await registerPurchase({
            storeId, purchaseDate: date, paymentMethod: payment, source: 'manual',
            items: valid.map(it => {
              let notes = '';
              if (it.units_count && Number(it.units_count) > 0) {
                notes = `(${it.units_count} ${Number(it.units_count) === 1 ? 'unidad' : 'unidades'})`;
              }
              return {
                product_id: it.product_id,
                quantity: parseFloat(it.quantity),
                unit: it.unit,
                unit_price: parseFloat(it.unit_price) || 0,
                total_price: (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0),
                notes: notes || null
              };
            })
          });
          mc.innerHTML = '';
          showToast('Compra registrada correctamente ✅', 'success');
          renderPurchasesView(container, navigateTo, {});
        } catch (err) {
          console.error('[Compra]', err);
          showToast('Error: ' + (err.message || 'Intenta de nuevo'), 'error');
          btn.disabled = false; btn.textContent = 'Guardar Compra';
        }
      });
    }

    function showInlineForm(type, productIdx = null) {
      document.getElementById('inline-overlay')?.remove();
      const overlay = document.createElement('div');
      overlay.id = 'inline-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;justify-content:center;z-index:99999;';

      if (type === 'store') {
        overlay.innerHTML = `
          <div style="background:var(--bg-card);border-radius:20px 20px 0 0;padding:24px;width:100%;max-width:480px;">
            <h3 style="font-size:1rem;font-weight:700;margin-bottom:16px;">➕ Nueva Tienda</h3>
            <div class="form-group">
              <label class="form-label">Nombre</label>
              <input id="ns-name" type="text" class="form-input" placeholder="Éxito, D1, Carulla, Merquemos...">
            </div>
            <div class="form-group">
              <label class="form-label">Tipo</label>
              <select id="ns-platform" class="form-select">
                <option>Físico</option><option>Domicilio</option><option>Rappi</option>
                <option>Mercado Libre</option><option>Otro</option>
              </select>
            </div>
            <div style="display:flex;gap:8px;margin-top:8px;">
              <button id="ns-cancel" class="btn btn-secondary" style="flex:1;">Cancelar</button>
              <button id="ns-save" class="btn btn-primary" style="flex:2;">Crear Tienda</button>
            </div>
          </div>`;
        document.body.appendChild(overlay);
        document.getElementById('ns-cancel').onclick = () => overlay.remove();
        document.getElementById('ns-save').onclick = async () => {
          const name = document.getElementById('ns-name').value.trim();
          const platform = document.getElementById('ns-platform').value;
          if (!name) { showToast('Escribe el nombre', 'error'); return; }
          const btn = document.getElementById('ns-save');
          btn.disabled = true; btn.textContent = 'Creando...';
          try {
            await createStore({ name, platform });
            await fetchStores();
            stores = [...(state.stores || [])];
            overlay.remove();
            renderModal();
            showToast(`Tienda "${name}" creada ✅`, 'success');
          } catch (err) {
            showToast('Error: ' + err.message, 'error');
            btn.disabled = false; btn.textContent = 'Crear Tienda';
          }
        };

      } else {
        overlay.innerHTML = `
          <div style="background:var(--bg-card);border-radius:20px 20px 0 0;padding:24px;width:100%;max-width:480px;">
            <h3 style="font-size:1rem;font-weight:700;margin-bottom:16px;">➕ Nuevo Producto</h3>
            <div class="form-group">
              <label class="form-label">Nombre del producto</label>
              <input id="np-name" type="text" class="form-input" placeholder="Arroz, Leche, Shampoo...">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div class="form-group">
                <label class="form-label">Categoría</label>
                <select id="np-cat" class="form-select" style="font-size:0.85rem;">
                  ${categoryOptions()}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Unidad base</label>
                <select id="np-unit" class="form-select" style="font-size:0.85rem;">
                  ${['kg','g','unidad','L','ml','paquete','bolsa','caja','lb','docena'].map(u => `<option>${u}</option>`).join('')}
                </select>
              </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:8px;">
              <button id="np-cancel" class="btn btn-secondary" style="flex:1;">Cancelar</button>
              <button id="np-save" class="btn btn-primary" style="flex:2;">Crear Producto</button>
            </div>
          </div>`;
        document.body.appendChild(overlay);
        document.getElementById('np-cancel').onclick = () => overlay.remove();
        document.getElementById('np-save').onclick = async () => {
          const name = document.getElementById('np-name').value.trim();
          const catId = document.getElementById('np-cat').value || null;
          const unit = document.getElementById('np-unit').value || 'kg';
          if (!name) { showToast('Escribe el nombre', 'error'); return; }
          const btn = document.getElementById('np-save');
          btn.disabled = true; btn.textContent = 'Creando...';
          try {
            const newProd = await createProduct({ name, categoryId: catId, baseUnit: unit });
            await fetchProducts();
            products = [...(state.products || [])];
            if (productIdx !== null) {
              items[productIdx].product_id = newProd.id;
              items[productIdx].unit = unit;
            }
            overlay.remove();
            renderModal();
            showToast(`Producto "${name}" creado ✅`, 'success');
          } catch (err) {
            showToast('Error: ' + err.message, 'error');
            btn.disabled = false; btn.textContent = 'Crear Producto';
          }
        };
      }
    }

    renderModal();
  }
}
