// Vista de Ajustes, Perfil, Perfiles Familiares (Netflix) y Planes
import { state } from '../state.js';
import { signOut, updatePassword, deleteOwnAccount } from '../services/auth.js';
import { getGeminiApiKey, setGeminiApiKey, isUserAdmin } from '../config.js';
import { getUserSubscriptionInfo, PLAN_PRICES } from '../services/subscriptions.js';
import { fetchFamilyMembers, createFamilyMember, deleteFamilyMember, setActiveFamilyMember, getActiveFamilyMember, updateHeaderProfileButton } from '../services/family.js';
import { toggleTheme } from '../app.js';
import { showToast } from '../utils/toast.js';
import { exportPurchasesToCSV, exportInventoryToCSV } from '../utils/exporter.js';

export async function renderSettingsView(container, navigateTo) {
  const user = state.user;
  const fullName = user?.user_metadata?.full_name || 'Usuario';
  const email = user?.email || '';
  const geminiKey = getGeminiApiKey();
  const isAdmin = isUserAdmin(user);
  const sub = await getUserSubscriptionInfo();
  const activeMember = getActiveFamilyMember();
  const familyMembers = await fetchFamilyMembers();

  container.innerHTML = `
    <div style="margin-bottom: 16px;">
      <h1 style="font-size: 1.35rem; font-weight: 800;">Ajustes & Perfil</h1>
      <p style="color: var(--text-muted); font-size: 0.85rem;">Gestión de cuenta, hogar y suscripción</p>
    </div>

    <!-- ── 1. PERFILES FAMILIARES (ESTILO NETFLIX) ── -->
    <div class="mc-card" style="border: 1.5px solid var(--border); margin-bottom: 16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div>
          <h2 style="font-size: 1.05rem; font-weight: 800; margin:0;">👨‍👩‍👧 Perfiles del Hogar</h2>
          <span style="font-size: 0.75rem; color: var(--text-muted);">¿Quién está usando la app?</span>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-open-family-picker" style="font-size:0.75rem; font-weight:700; padding:4px 10px;">
          Cambiar Perfil
        </button>
      </div>

      <!-- Cuadrícula de Avatares Familiares -->
      <div style="display: flex; gap: 12px; overflow-x: auto; padding: 6px 2px 10px;">
        ${familyMembers.map(m => {
          const isActive = m.id === activeMember.id;
          return `
            <div class="family-chip" data-id="${m.id}"
                 style="display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; min-width: 68px; text-align: center;">
              <div style="width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; background: var(--bg-main); border: 2.5px solid ${isActive ? 'var(--primary)' : 'var(--border)'}; box-shadow: ${isActive ? '0 0 0 2px rgba(16,185,129,0.3)' : 'none'}; position: relative;">
                ${m.avatar_url ? `<img src="${m.avatar_url}" style="width:100%; height:100%; border-radius:12px; object-fit:cover;">` : m.avatar}
                ${isActive ? '<span style="position:absolute; bottom:-4px; right:-4px; background:var(--primary); color:white; border-radius:50%; width:16px; height:16px; font-size:10px; display:flex; align-items:center; justify-content:center;">✓</span>' : ''}
              </div>
              <span style="font-size: 0.78rem; font-weight: ${isActive ? '800' : '600'}; color: ${isActive ? 'var(--primary-dark)' : 'var(--text-main)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 68px;">
                ${m.name}
              </span>
            </div>
          `;
        }).join('')}

        <!-- Botón para añadir nuevo perfil -->
        <div id="btn-add-family-member-direct"
             style="display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; min-width: 68px; text-align: center;">
          <div style="width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; background: var(--bg-main); border: 2px dashed var(--border); color: var(--text-muted);">
            +
          </div>
          <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Añadir</span>
        </div>
      </div>
    </div>

    <!-- ── 2. DATOS DE LA CUENTA ── -->
    <div class="mc-card">
      <h2 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 12px;">Tu Cuenta Principal</h2>
      <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.9rem; margin-bottom: 16px;">
        <div>
          <span style="color: var(--text-muted);">Titular:</span>
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

    <!-- ── 3. SUSCRIPCIÓN Y PLANES ── -->
    <div class="mc-card" style="border: 1.5px solid var(--primary);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <div>
          <span style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">PLAN Y MEMBRESÍA</span>
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
          <span style="color:var(--text-muted);">Perfiles familiares:</span>
          <strong>${sub?.canManageFamily ? 'Habilitado en tu plan 👨‍👩‍👧' : 'Exclusivo Plan Pro 🔒'}</strong>
        </div>
      </div>
    </div>

    <!-- ── 4. IA GEMINI (ADMIN) ── -->
    ${isAdmin ? `
      <div class="mc-card" style="border: 1.5px solid var(--border); border-left: 4.5px solid var(--primary); background: var(--bg-card);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 1.1rem;">👑</span>
            <h2 style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin:0;">Gestión de IA Gemini (Admin)</h2>
          </div>
          <span class="badge ${geminiKey ? 'badge-normal' : 'badge-low'}">
            ${geminiKey ? 'Activo Global 🔒' : 'Sin configurar'}
          </span>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px; line-height:1.4;">
          Esta clave se comparte de forma segura en la base de datos para que todos los usuarios de la app puedan escanear facturas sin configurar nada.
        </p>

        <div class="form-group" style="margin-bottom: 10px;">
          <label class="form-label" style="font-size: 0.75rem; color: var(--text-muted); font-weight:700;">Gemini API Key General</label>
          <input type="password" id="settings-gemini-key" class="form-input" value="${geminiKey}" placeholder="AIzaSy..." style="background: var(--bg-main); color: var(--text-main);">
        </div>

        <button class="btn btn-primary btn-sm" id="btn-save-settings-key" style="width: 100%;">
          Guardar Clave General en Supabase 🔒
        </button>
      </div>
    ` : ''}

    <!-- ── 5. MODO OSCURO & TEMA ── -->
    <div class="mc-card" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <div>
        <div style="font-weight: 700; font-size: 0.95rem;">Modo Oscuro</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">Guardado automáticamente</div>
      </div>
      <button class="btn btn-secondary btn-sm" id="btn-toggle-theme">
        🌓 Cambiar Tema
      </button>
    </div>

    <!-- ── 6. INSTALAR APLICACIÓN PWA ── -->
    <div class="mc-card" style="border: 1.5px solid var(--border); display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <div>
        <div style="font-weight: 700; font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
          <span>📲</span>
          <span>Instalar en tu Celular</span>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">Úsala como app nativa en Android o iOS</div>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-install-pwa" style="font-size: 0.8rem; font-weight: 700; padding: 6px 14px;">
        Instalar
      </button>
    </div>

    <!-- ── 7. EXPORTACIÓN A EXCEL ── -->
    <div class="mc-card" style="border: 1.5px solid var(--border); margin-bottom: 16px;">
      <div style="margin-bottom: 10px;">
        <div style="font-weight: 700; font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
          <span>📊</span>
          <span>Descargar Datos en Excel</span>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">Copia de seguridad en formato CSV para hojas de cálculo</div>
      </div>
      <div style="display: flex; gap: 10px;">
        <button class="btn btn-secondary btn-sm" id="btn-settings-export-purchases" style="flex: 1; font-size: 0.78rem; font-weight: 700; padding: 8px 6px;">
          🛒 Compras (.CSV)
        </button>
        <button class="btn btn-secondary btn-sm" id="btn-settings-export-inventory" style="flex: 1; font-size: 0.78rem; font-weight: 700; padding: 8px 6px;">
          📦 Inventario (.CSV)
        </button>
      </div>
    </div>

    <!-- ── 8. ZONA DE PELIGRO ── -->
    <div class="mc-card" style="border: 1.5px solid var(--danger); margin-bottom: 16px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span style="font-size: 1.1rem;">⚠️</span>
        <div>
          <div style="font-weight: 800; font-size: 0.95rem; color: var(--danger);">Zona de Peligro</div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">Acciones irreversibles para tu cuenta</div>
        </div>
      </div>
      <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 12px; line-height: 1.4;">
        Si eliminas tu cuenta, se borrarán de forma permanente todos tus datos: compras, inventario, perfiles familiares y configuraciones. <strong>Esta acción no se puede deshacer.</strong>
      </p>
      <button class="btn btn-sm" id="btn-delete-account"
              style="width: 100%; font-weight: 700; font-size: 0.88rem; color: var(--danger); border: 1.5px solid var(--danger); background: transparent; padding: 10px 0;">
        🗑️ Eliminar mi Cuenta Permanentemente
      </button>
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

  // Clic en chips de perfil
  document.querySelectorAll('.family-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.getAttribute('data-id');
      const target = familyMembers.find(m => m.id === id);
      if (target) {
        setActiveFamilyMember(target);
        showToast(`Perfil cambiado a ${target.name} ${target.avatar || ''} 👋`, 'success');
        renderSettingsView(container, navigateTo);
      }
    });
  });

  document.getElementById('btn-open-family-picker')?.addEventListener('click', () => {
    openProfileSelectorModal(() => renderSettingsView(container, navigateTo));
  });

  document.getElementById('btn-add-family-member-direct')?.addEventListener('click', () => {
    if (!sub.canManageFamily) {
      openPlansModal();
      showToast('Los perfiles familiares son exclusivos del Plan Pro 🚀', 'info', 4000);
      return;
    }
    openAddFamilyMemberModal(() => renderSettingsView(container, navigateTo));
  });

  document.getElementById('btn-view-plans')?.addEventListener('click', openPlansModal);

  document.getElementById('btn-open-change-pass-modal')?.addEventListener('click', () => {
    openChangePasswordModal();
  });

  document.getElementById('btn-install-pwa')?.addEventListener('click', () => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      showToast('¡MercaConsumo ya está instalada como app en tu dispositivo! ✅', 'success');
      return;
    }

    if (window.deferredInstallPrompt) {
      window.deferredInstallPrompt.prompt();
      window.deferredInstallPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          showToast('¡Instalando MercaConsumo en tu celular! 🎉', 'success');
        }
        window.deferredInstallPrompt = null;
      });
    } else {
      openPwaInstallModal();
    }
  });

  document.getElementById('btn-settings-export-purchases')?.addEventListener('click', () => {
    try {
      exportPurchasesToCSV(state.purchases, state.products, state.stores, state.categories);
      showToast('¡Compras exportadas a Excel (CSV) exitosamente! 📊', 'success');
    } catch (err) {
      showToast(err.message || 'Error al exportar compras', 'error');
    }
  });

  document.getElementById('btn-settings-export-inventory')?.addEventListener('click', () => {
    try {
      exportInventoryToCSV(state.inventory, state.products, state.categories, []);
      showToast('¡Inventario exportado a Excel (CSV) exitosamente! 📊', 'success');
    } catch (err) {
      showToast(err.message || 'Error al exportar inventario', 'error');
    }
  });

  document.getElementById('btn-delete-account')?.addEventListener('click', () => {
    openDeleteAccountModal(navigateTo);
  });

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    sessionStorage.removeItem('mc_session_profile_picked');
    localStorage.removeItem('mc_active_member');
    await signOut();
    showToast('Sesión cerrada', 'info');
    navigateTo('auth');
  });

  document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
    toggleTheme();
  });
}

// ── MODAL GUÍA DE INSTALACIÓN PWA (IOS / ANDROID) ───────────────────────────
export function openPwaInstallModal() {
  const mc = document.getElementById('modal-container');
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  mc.innerHTML = `
    <div class="modal-backdrop show" id="modal-pwa-backdrop">
      <div class="modal-sheet" style="background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border); max-width: 420px;">
        
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:14px;">
          <h2 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin:0;">
            📲 Instalar MercaConsumo
          </h2>
          <button class="btn btn-secondary btn-sm" id="btn-close-pwa-modal" style="border:none; padding:4px 8px;">✕</button>
        </div>

        <div style="text-align:center; margin-bottom:16px;">
          <div style="font-size:2.6rem; margin-bottom:6px;">🥑</div>
          <p style="font-size:0.85rem; color:var(--text-muted); line-height:1.4;">
            Instala la aplicación en tu pantalla de inicio para abrirla rápido, sin barras de navegación y a pantalla completa.
          </p>
        </div>

        ${isIOS ? `
          <!-- Instrucciones para iPhone / iPad (Safari) -->
          <div style="background:var(--bg-main); border:1px solid var(--border); border-radius:12px; padding:14px; margin-bottom:16px; font-size:0.85rem; line-height:1.5;">
            <div style="font-weight:800; margin-bottom:8px; color:var(--primary-dark);">Pasos en iPhone (Safari):</div>
            <div style="display:flex; gap:10px; align-items:center; margin-bottom:8px;">
              <span style="font-size:1.2rem;">1️⃣</span>
              <span>Toca el botón <strong>Compartir</strong> (📤) en la barra inferior de Safari.</span>
            </div>
            <div style="display:flex; gap:10px; align-items:center; margin-bottom:8px;">
              <span style="font-size:1.2rem;">2️⃣</span>
              <span>Desplaza hacia abajo y selecciona <strong>"Agregar a pantalla de inicio"</strong> (➕).</span>
            </div>
            <div style="display:flex; gap:10px; align-items:center;">
              <span style="font-size:1.2rem;">3️⃣</span>
              <span>Toca <strong>"Agregar"</strong> en la esquina superior derecha.</span>
            </div>
          </div>
        ` : `
          <!-- Instrucciones para Android / Chrome / Edge -->
          <div style="background:var(--bg-main); border:1px solid var(--border); border-radius:12px; padding:14px; margin-bottom:16px; font-size:0.85rem; line-height:1.5;">
            <div style="font-weight:800; margin-bottom:8px; color:var(--primary-dark);">Pasos en Android / Chrome:</div>
            <div style="display:flex; gap:10px; align-items:center; margin-bottom:8px;">
              <span style="font-size:1.2rem;">1️⃣</span>
              <span>Toca los <strong>tres puntos (⋮)</strong> en la esquina superior derecha del navegador.</span>
            </div>
            <div style="display:flex; gap:10px; align-items:center; margin-bottom:8px;">
              <span style="font-size:1.2rem;">2️⃣</span>
              <span>Selecciona <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.</span>
            </div>
            <div style="display:flex; gap:10px; align-items:center;">
              <span style="font-size:1.2rem;">3️⃣</span>
              <span>Confirma la instalación y ¡listo! Aparecerá junto a tus otras apps.</span>
            </div>
          </div>
        `}

        <button class="btn btn-primary" id="btn-done-pwa-modal" style="width:100%; font-weight:700;">
          ¡Entendido! ✅
        </button>

      </div>
    </div>
  `;

  const close = () => { mc.innerHTML = ''; };
  document.getElementById('btn-close-pwa-modal')?.addEventListener('click', close);
  document.getElementById('btn-done-pwa-modal')?.addEventListener('click', close);
  document.getElementById('modal-pwa-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-pwa-backdrop') close();
  });
}

// ── MODAL SELECTOR DE PERFILES (ESTILO NETFLIX) ──────────────────────────────
export async function openProfileSelectorModal(onSelectCallback = null) {
  const mc = document.getElementById('modal-container');
  const sub = await getUserSubscriptionInfo();
  const members = await fetchFamilyMembers();
  const activeMember = getActiveFamilyMember();

  mc.innerHTML = `
    <div class="modal-backdrop show" id="modal-family-backdrop">
      <div class="modal-sheet" style="background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border); max-width: 440px;">
        
        <div style="text-align: center; padding: 10px 0 16px;">
          <h2 style="font-size: 1.3rem; font-weight: 800; color: var(--text-main); margin: 0;">¿Quién está mercando hoy?</h2>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">Selecciona tu perfil familiar para registrar tus compras</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px;">
          ${members.map(m => {
            const isAct = m.id === activeMember.id;
            return `
              <div class="netflix-profile-card" data-id="${m.id}"
                   style="background: var(--bg-main); border: 2px solid ${isAct ? 'var(--primary)' : 'var(--border)'}; border-radius: 16px; padding: 16px 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.15s ease; position: relative;">
                
                <div style="width: 64px; height: 64px; border-radius: 18px; display: flex; align-items: center; justify-content: center; font-size: 2.2rem; background: var(--bg-card); border: 2px solid ${isAct ? 'var(--primary)' : 'var(--border)'}; margin-bottom: 8px;">
                  ${m.avatar_url ? `<img src="${m.avatar_url}" style="width:100%; height:100%; border-radius:16px; object-fit:cover;">` : (m.avatar || '👤')}
                </div>

                <div style="font-weight: 800; font-size: 0.95rem; color: ${isAct ? 'var(--primary)' : 'var(--text-main)'};">
                  ${m.name}
                </div>

                <span style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">
                  ${m.role === 'owner' ? 'Titular' : 'Familiar'}
                </span>

                ${isAct ? `<span class="badge badge-normal" style="font-size: 0.65rem; margin-top: 4px;">Activo ✓</span>` : ''}
              </div>
            `;
          }).join('')}

          <!-- Botón + Añadir Perfil -->
          <div id="btn-netflix-add-member"
               style="background: var(--bg-main); border: 2px dashed var(--border); border-radius: 16px; padding: 16px 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer;">
            <div style="width: 64px; height: 64px; border-radius: 18px; display: flex; align-items: center; justify-content: center; font-size: 2rem; color: var(--text-muted); margin-bottom: 8px;">
              +
            </div>
            <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-muted);">
              Añadir Perfil
            </div>
            <span style="font-size: 0.7rem; color: var(--primary); font-weight: 700; margin-top: 2px;">
              ${sub.canManageFamily ? 'Incluido ✨' : 'Plan Pro 🔒'}
            </span>
          </div>
        </div>

        <div style="text-align: center;">
          <button class="btn btn-secondary btn-sm" id="btn-close-family-modal" style="width: 100%;">
            Cerrar
          </button>
        </div>

      </div>
    </div>
  `;

  const close = () => { mc.innerHTML = ''; };
  document.getElementById('btn-close-family-modal')?.addEventListener('click', () => {
    close();
    if (onSelectCallback) onSelectCallback();
  });
  document.getElementById('modal-family-backdrop')?.addEventListener('click', e => {
    if (e.target.id === 'modal-family-backdrop') {
      close();
      if (onSelectCallback) onSelectCallback();
    }
  });

  document.querySelectorAll('.netflix-profile-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-id');
      const target = members.find(m => m.id === id);
      if (target) {
        sessionStorage.setItem('mc_session_profile_picked', '1');
        setActiveFamilyMember(target);
        showToast(`¡Hola de nuevo, ${target.name}! ${target.avatar || ''}`, 'success');
        close();
        if (onSelectCallback) onSelectCallback();
      }
    });
  });

  document.getElementById('btn-netflix-add-member')?.addEventListener('click', () => {
    if (!sub.canManageFamily) {
      close();
      openPlansModal();
      showToast('Los perfiles familiares estilo Netflix son exclusivos del Plan Pro 🚀', 'info', 4000);
      return;
    }
    openAddFamilyMemberModal(() => {
      close();
      openProfileSelectorModal(onSelectCallback);
    });
  });
}

// ── MODAL PARA AÑADIR NUEVO PERFIL CON FOTO / EMOJI ──────────────────────────
export function openAddFamilyMemberModal(onCreatedCallback = null) {
  const mc = document.getElementById('modal-container');
  const availableAvatars = ['🥑', '👨', '👩', '👧', '👦', '👵', '👴', '🍳', '🛒', '🍎', '🥩', '☕'];
  let selectedAvatar = '👤';
  let uploadedPhotoUrl = null;

  mc.innerHTML = `
    <div class="modal-backdrop show" id="modal-add-member-backdrop">
      <div class="modal-sheet" style="background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border);">
        <div class="modal-header" style="border-bottom: 1px solid var(--border);">
          <h2 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin:0;">➕ Añadir Perfil Familiar</h2>
          <button class="btn btn-secondary btn-sm" id="btn-close-add-member-modal" style="border:none; padding:4px 8px;">✕</button>
        </div>

        <form id="form-add-family-member" style="padding-top: 10px;">
          
          <!-- Avatar Preview -->
          <div style="text-align: center; margin-bottom: 14px;">
            <div id="avatar-preview-box"
                 style="width: 70px; height: 70px; border-radius: 20px; background: var(--bg-main); border: 2.5px solid var(--primary); display: flex; align-items: center; justify-content: center; font-size: 2.5rem; margin: 0 auto 8px; overflow: hidden;">
              ${selectedAvatar}
            </div>
            <label for="inp-avatar-file" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 4px 10px; cursor: pointer;">
              📷 Subir Foto de Perfil
            </label>
            <input type="file" id="inp-avatar-file" accept="image/*" style="display: none;">
          </div>

          <!-- Selector de Emojis -->
          <div class="form-group" style="margin-bottom: 14px;">
            <label class="form-label" style="font-size: 0.75rem;">O elige un avatar rápido:</label>
            <div style="display: flex; gap: 8px; overflow-x: auto; padding: 4px 0;">
              ${availableAvatars.map(av => `
                <button type="button" class="btn-select-avatar" data-avatar="${av}"
                        style="background: var(--bg-main); border: 1.5px solid var(--border); border-radius: 12px; width: 40px; height: 40px; font-size: 1.3rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                  ${av}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Nombre -->
          <div class="form-group">
            <label class="form-label">Nombre del Familiar</label>
            <input type="text" id="inp-family-member-name" class="form-input" placeholder="Ej: Mamá, Papá, Sofía..." required style="font-weight: 600;">
          </div>

          <button type="submit" class="btn btn-primary" id="btn-save-family-member" style="width: 100%; margin-top: 8px; font-size: 0.95rem; font-weight: 700;">
            Crear Perfil Familiar ✅
          </button>
        </form>
      </div>
    </div>
  `;

  const close = () => { mc.innerHTML = ''; };
  document.getElementById('btn-close-add-member-modal')?.addEventListener('click', close);
  document.getElementById('modal-add-member-backdrop')?.addEventListener('click', e => { if (e.target.id === 'modal-add-member-backdrop') close(); });

  // Cambiar avatar por emoji
  document.querySelectorAll('.btn-select-avatar').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedAvatar = btn.getAttribute('data-avatar');
      uploadedPhotoUrl = null;
      const preview = document.getElementById('avatar-preview-box');
      if (preview) preview.innerHTML = selectedAvatar;
    });
  });

  // Subir foto
  document.getElementById('inp-avatar-file')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        uploadedPhotoUrl = ev.target.result;
        const preview = document.getElementById('avatar-preview-box');
        if (preview) {
          preview.innerHTML = `<img src="${uploadedPhotoUrl}" style="width:100%; height:100%; object-fit:cover;">`;
        }
      };
      reader.readAsDataURL(file);
    }
  });

  document.getElementById('form-add-family-member')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-family-member');
    btn.disabled = true;
    btn.textContent = 'Guardando perfil...';

    const name = document.getElementById('inp-family-member-name').value.trim();

    try {
      await createFamilyMember({
        name,
        avatar: selectedAvatar,
        avatarUrl: uploadedPhotoUrl
      });
      showToast(`¡Perfil de ${name} creado exitosamente! 👨‍👩‍👧`, 'success');
      close();
      if (onCreatedCallback) onCreatedCallback();
    } catch (err) {
      showToast('Error al crear perfil: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Crear Perfil Familiar ✅';
    }
  });
}

// ── MODAL DE PLANES Y PRECIOS ───────────────────────────────────────────────
export function openPlansModal() {
  const mc = document.getElementById('modal-container');

  mc.innerHTML = `
    <div class="modal-backdrop show" id="modal-plans-backdrop">
      <div class="modal-sheet" style="background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border); max-width: 440px;">
        <div class="modal-header" style="border-bottom: 1px solid var(--border);">
          <h2 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin:0;">⭐ Planes MercaConsumo</h2>
          <button class="btn btn-secondary btn-sm" id="btn-close-plans-modal" style="border:none; padding:4px 8px;">✕</button>
        </div>

        <div style="padding: 10px 0 16px;">
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px; line-height: 1.4;">
            Automatiza tu despensa con IA y ahorra tiempo y dinero en cada compra.
          </p>

          <!-- Plan Premium (5 facturas) -->
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
              <li>📸 <strong>5 facturas semanales</strong> con IA (~20 al mes)</li>
              <li>🏪 Comparador inteligente de precios entre tiendas</li>
              <li>🛒 Lista de compras automática con alertas</li>
            </ul>

            <button class="btn btn-primary" id="btn-buy-premium-action" style="width: 100%; font-size: 0.92rem; font-weight: 700; padding: 10px 0;">
              Elegir Plan Premium ($9.900/mes)
            </button>
          </div>

          <!-- Plan Pro (Ilimitado + Familia Netflix) -->
          <div class="mc-card" style="border: 1.5px solid #818cf8; background: var(--bg-main); margin-bottom: 14px; padding: 16px; border-radius: 14px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <span class="badge" style="background: rgba(99, 102, 241, 0.2); color: #818cf8; font-size: 0.72rem; font-weight: 800; border: 1px solid #818cf8;">TODO INCLUIDO 🚀</span>
                <h3 style="font-size: 1.15rem; font-weight: 800; margin-top: 6px; color: var(--text-main);">Plan Pro</h3>
              </div>
              <div style="text-align:right;">
                <span style="font-size: 1.35rem; font-weight: 800; color: #818cf8;">$19.900</span>
                <small style="font-size: 0.75rem; color: var(--text-muted); display: block;">COP / mes</small>
              </div>
            </div>

            <ul style="font-size: 0.84rem; margin: 12px 0 14px 18px; color: var(--text-main); line-height: 1.7;">
              <li>⚡ <strong>Facturas ILIMITADAS</strong> con IA</li>
              <li>👨‍👩‍👧 <strong>Perfiles Familiares (Estilo Netflix)</strong> con foto</li>
              <li>👥 Despensa compartida y sincronizada en el hogar</li>
              <li>📊 Exportación de reportes y soporte VIP</li>
            </ul>

            <button class="btn btn-secondary" id="btn-buy-pro-action" style="width: 100%; font-size: 0.92rem; font-weight: 700; padding: 10px 0; background: #6366f1; color: white; border: none;">
              Elegir Plan Pro ($19.900/mes)
            </button>
          </div>

          <div style="text-align: center; padding: 4px;">
            <small style="color: var(--text-muted); font-size: 0.8rem;">
              Plan Gratuito: 1 factura semanal y despensa manual ilimitada para siempre.
            </small>
          </div>

        </div>
      </div>
    </div>
  `;

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

// ── MODAL CAMBIO DE CONTRASEÑA ──────────────────────────────────────────────
export function openChangePasswordModal() {
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

// ── MODAL ELIMINAR CUENTA ───────────────────────────────────────────────────
export function openDeleteAccountModal(navigateTo) {
  const mc = document.getElementById('modal-container');

  mc.innerHTML = `
    <div class="modal-backdrop show" id="modal-delete-account-backdrop">
      <div class="modal-sheet" style="background: var(--bg-card); color: var(--text-main); border: 1.5px solid var(--danger); max-width: 420px;">
        
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:14px;">
          <h2 style="font-size: 1.1rem; font-weight: 800; color: var(--danger); margin:0;">
            🗑️ Eliminar Cuenta
          </h2>
          <button class="btn btn-secondary btn-sm" id="btn-close-delete-modal" style="border:none; padding:4px 8px;">✕</button>
        </div>

        <div style="text-align:center; margin-bottom:16px;">
          <div style="font-size:2.8rem; margin-bottom:8px;">⚠️</div>
          <p style="font-size:0.88rem; color:var(--text-muted); line-height:1.5;">
            Esta acción eliminará <strong style="color:var(--text-main);">permanentemente</strong> tu cuenta y todos los datos asociados:
          </p>
          <ul style="text-align:left; font-size:0.83rem; color:var(--text-muted); margin:10px auto; max-width:280px; line-height:1.8; list-style:none; padding:0;">
            <li>❌ Historial de compras y facturas</li>
            <li>❌ Inventario y productos</li>
            <li>❌ Perfiles familiares</li>
            <li>❌ Estadísticas y reportes</li>
          </ul>
        </div>

        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label" style="font-size:0.82rem; font-weight:700; color:var(--danger);">
            Para confirmar, escribe <strong>ELIMINAR</strong> a continuación:
          </label>
          <input type="text" id="inp-confirm-delete" class="form-input"
                 placeholder="Escribe ELIMINAR"
                 style="text-align:center; font-weight:800; letter-spacing:0.05em; border-color: var(--danger);">
        </div>

        <div id="delete-account-error" style="display:none; background:#fee2e2; border:1px solid #fecaca; color:#b91c1c; padding:8px 12px; border-radius:8px; font-size:0.82rem; margin-bottom:12px;"></div>

        <div style="display:flex; gap:8px;">
          <button class="btn btn-secondary" id="btn-cancel-delete" style="flex:1; font-weight:700;">
            Cancelar
          </button>
          <button class="btn btn-sm" id="btn-confirm-delete-account"
                  style="flex:2; font-weight:800; font-size:0.9rem; color:white; background:var(--danger); border:none; border-radius:10px; padding:12px 0;">
            Eliminar mi Cuenta
          </button>
        </div>

      </div>
    </div>
  `;

  const close = () => { mc.innerHTML = ''; };
  document.getElementById('btn-close-delete-modal')?.addEventListener('click', close);
  document.getElementById('btn-cancel-delete')?.addEventListener('click', close);
  document.getElementById('modal-delete-account-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-delete-account-backdrop') close();
  });

  document.getElementById('btn-confirm-delete-account')?.addEventListener('click', async () => {
    const confirmInput = document.getElementById('inp-confirm-delete').value.trim();
    const errEl = document.getElementById('delete-account-error');
    const btn = document.getElementById('btn-confirm-delete-account');

    errEl.style.display = 'none';

    if (confirmInput !== 'ELIMINAR') {
      errEl.style.display = 'block';
      errEl.textContent = 'Debes escribir exactamente "ELIMINAR" para confirmar.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Eliminando cuenta...';

    try {
      await deleteOwnAccount();
      close();
      showToast('Cuenta eliminada. ¡Hasta luego! 👋', 'info', 4000);
      setTimeout(() => navigateTo('auth'), 500);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Eliminar mi Cuenta';
      errEl.style.display = 'block';
      errEl.textContent = err.message || 'Error al eliminar la cuenta. Intenta de nuevo.';
    }
  });
}
