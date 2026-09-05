// Vista de Ajustes y Perfil con Estado de Suscripción y Planes
import { state } from '../state.js';
import { signOut, updatePassword } from '../services/auth.js';
import { getGeminiApiKey, setGeminiApiKey, isUserAdmin } from '../config.js';
import { getUserSubscriptionInfo, PLAN_PRICES } from '../services/subscriptions.js';
import { toggleTheme } from '../app.js';
import { showToast } from '../utils/toast.js';

export async function renderSettingsView(container, navigateTo) {
  const user = state.user;
  const fullName = user?.user_metadata?.full_name || 'Usuario';
  const email = user?.email || '';
  const geminiKey = getGeminiApiKey();
  const isAdmin = isUserAdmin(user);
  const sub = await getUserSubscriptionInfo();

  container.innerHTML = `
    <div style="margin-bottom: 16px;">
      <h1 style="font-size: 1.35rem; font-weight: 800;">Ajustes & Perfil</h1>
      <p style="color: var(--text-muted); font-size: 0.85rem;">Detalles de tu cuenta y plan</p>
    </div>

    <!-- Perfil del Usuario -->
    <div class="mc-card">
      <h2 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 12px;">Tu Cuenta</h2>
      <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.9rem; margin-bottom: 16px;">
        <div>
          <span style="color: var(--text-muted);">Nombre:</span>
          <strong>${fullName}</strong>
        </div>
        <div>
          <span style="color: var(--text-muted);">Correo:</span>
          <strong>${email}</strong>
          ${isAdmin ? '<span class="badge badge-normal" style="font-size:0.68rem; margin-left:6px; padding:2px 6px;">👑 Admin</span>' : ''}
        </div>
        <div>
          <span style="color: var(--text-muted);">Moneda:</span>
          <strong>COP (Pesos Colombianos)</strong>
        </div>
      </div>

      <div style="display:flex; gap:8px;">
        <button class="btn btn-secondary btn-sm" id="btn-open-change-pass-modal" style="flex:1; font-weight:600;">
          🔑 Cambiar Contraseña
        </button>
        <button class="btn btn-secondary btn-sm" id="btn-logout" style="color: var(--danger); border-color: #fecaca; flex:1; font-weight:600;">
          🚪 Cerrar Sesión
        </button>
      </div>
    </div>

    <!-- Suscripción y Planes -->
    <div class="mc-card" style="border: 1.5px solid var(--primary);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <div>
          <span style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">PLAN Y SUSCRIPCIÓN</span>
          <h2 style="font-size:1.05rem; font-weight:800; color:var(--primary-dark); margin-top:2px;">
            ${sub?.planName || 'Plan Gratuito'}
          </h2>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-view-plans" style="font-size:0.78rem; font-weight:700; padding:5px 10px;">
          ⭐ Ver Planes
        </button>
      </div>

      <div style="background:var(--bg-main); border-radius:8px; padding:8px 10px; font-size:0.82rem; margin-top:8px;">
        <div style="display:flex; justify-content:space-between;">
          <span style="color:var(--text-muted);">Escaneos de facturas con IA:</span>
          <strong>${sub?.scansLimit === Infinity ? 'Ilimitados ⚡' : `${sub?.scansRemaining} restantes esta semana`}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:4px;">
          <span style="color:var(--text-muted);">Registro de compras e inventario:</span>
          <strong style="color:var(--primary-dark);">Ilimitado siempre ✅</strong>
        </div>
      </div>
    </div>

    <!-- IA Gemini para Facturas (SOLO VISIBLE PARA EL ADMINISTRADOR) -->
    ${isAdmin ? `
      <div class="mc-card" style="border: 1.5px solid #bbf7d0; background: #f0fdf4;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 1.1rem;">👑</span>
            <h2 style="font-size: 1rem; font-weight: 800; color: #166534; margin:0;">Gestión de IA Gemini (Admin)</h2>
          </div>
          <span class="badge ${geminiKey ? 'badge-normal' : 'badge-low'}">
            ${geminiKey ? 'Activo Global 🔒' : 'Sin configurar'}
          </span>
        </div>
        <p style="font-size: 0.8rem; color: #15803d; margin-bottom: 12px; line-height:1.4;">
          Esta clave se comparte de forma segura en la base de datos para que todos los usuarios de la app puedan escanear facturas sin configurar nada.
        </p>

        <div class="form-group" style="margin-bottom: 10px;">
          <label class="form-label" style="font-size: 0.75rem; color: #166534; font-weight:700;">Gemini API Key General</label>
          <input type="password" id="settings-gemini-key" class="form-input" value="${geminiKey}" placeholder="AIzaSy..." style="background: white;">
        </div>

        <button class="btn btn-primary btn-sm" id="btn-save-settings-key" style="width: 100%;">
          Guardar Clave General en Supabase 🔒
        </button>
      </div>
    ` : ''}

    <!-- Modo Oscuro -->
    <div class="mc-card" style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-weight: 700; font-size: 0.95rem;">Modo Oscuro</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">Guardado automáticamente</div>
      </div>
      <button class="btn btn-secondary btn-sm" id="btn-toggle-theme">
        🌓 Cambiar Tema
      </button>
    </div>

    <!-- Seguridad -->
    <div class="mc-card" style="background: var(--bg-main); border: 1px dashed var(--border);">
      <div style="font-size: 0.8rem; color: var(--text-muted); text-align: center;">
        🔒 Tu despensa es privada y está cifrada de forma segura con Supabase RLS.
      </div>
    </div>
  `;

  if (isAdmin) {
    document.getElementById('btn-save-settings-key')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-save-settings-key');
      btn.disabled = true;
      btn.textContent = 'Guardando en Supabase...';
      const val = document.getElementById('settings-gemini-key').value.trim();
      await setGeminiApiKey(val);
      showToast('Clave de IA guardada de forma segura en Supabase 🔒✅', 'success');
      btn.disabled = false;
      btn.textContent = 'Guardar Clave General en Supabase 🔒';
    });
  }

  document.getElementById('btn-view-plans')?.addEventListener('click', openPlansModal);

  document.getElementById('btn-open-change-pass-modal')?.addEventListener('click', () => {
    openChangePasswordModal();
  });

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await signOut();
    showToast('Sesión cerrada', 'info');
    navigateTo('auth');
  });

  document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
    toggleTheme();
  });

  // Modal para Ver Planes y Precios
  function openPlansModal() {
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

    function openChangePasswordModal() {
    const mc = document.getElementById('modal-container');

    mc.innerHTML = `
      <div class="modal-backdrop show" id="modal-pass-backdrop">
        <div class="modal-sheet">
          <div class="modal-header">
            <h2 style="font-size: 1.15rem; font-weight: 700;">🔑 Cambiar Contraseña</h2>
            <button class="btn btn-secondary btn-sm" id="btn-close-pass-modal" style="border:none; padding:4px 8px;">✕</button>
          </div>

          <form id="form-change-pass" style="padding-top:4px;">
            <div id="modal-pass-error" style="display:none; background:#fee2e2; border:1px solid #fecaca; color:#b91c1c; padding:8px 12px; border-radius:8px; font-size:0.82rem; margin-bottom:12px;"></div>

            <div class="form-group">
              <label class="form-label">Nueva Contraseña (Mínimo 6 caracteres)</label>
              <input type="password" id="inp-new-password" class="form-input" placeholder="••••••••" minlength="6" required autocomplete="new-password">
            </div>

            <div class="form-group">
              <label class="form-label">Confirmar Nueva Contraseña</label>
              <input type="password" id="inp-new-password-confirm" class="form-input" placeholder="••••••••" minlength="6" required autocomplete="new-password">
            </div>

            <div style="display:flex; gap:8px; margin-top:16px;">
              <button type="button" class="btn btn-secondary" id="btn-cancel-change-pass" style="flex:1;">Cancelar</button>
              <button type="submit" class="btn btn-primary" id="btn-submit-change-pass" style="flex:2;">Guardar Contraseña</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { mc.innerHTML = ''; };
    document.getElementById('btn-close-pass-modal')?.addEventListener('click', close);
    document.getElementById('btn-cancel-change-pass')?.addEventListener('click', close);
    document.getElementById('modal-pass-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-pass-backdrop') close();
    });

    document.getElementById('form-change-pass')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const p1 = document.getElementById('inp-new-password').value;
      const p2 = document.getElementById('inp-new-password-confirm').value;
      const errEl = document.getElementById('modal-pass-error');
      const submitBtn = document.getElementById('btn-submit-change-pass');

      if (p1 !== p2) {
        errEl.style.display = 'block';
        errEl.textContent = 'Las contraseñas no coinciden.';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Actualizando...';

      try {
        await updatePassword(p1);
        showToast('¡Contraseña actualizada exitosamente! 🔒✅', 'success');
        close();
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar Contraseña';
        errEl.style.display = 'block';
        errEl.textContent = err.message;
      }
    });
  }
}
