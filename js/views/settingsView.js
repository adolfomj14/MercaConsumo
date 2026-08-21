// Vista de Ajustes y Perfil
import { state } from '../state.js';
import { signOut } from '../services/auth.js';
import { getGeminiApiKey, setGeminiApiKey } from '../config.js';
import { showToast } from '../utils/toast.js';

export function renderSettingsView(container, navigateTo) {
  const user = state.user;
  const fullName = user?.user_metadata?.full_name || 'Usuario';
  const email = user?.email || '';
  const geminiKey = getGeminiApiKey();

  container.innerHTML = `
    <div style="margin-bottom: 16px;">
      <h1 style="font-size: 1.35rem; font-weight: 800;">Ajustes & Perfil</h1>
      <p style="color: var(--text-muted); font-size: 0.85rem;">Detalles de tu cuenta y configuración</p>
    </div>

    <!-- Perfil -->
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
        </div>
        <div>
          <span style="color: var(--text-muted);">Moneda:</span>
          <strong>COP (Pesos Colombianos)</strong>
        </div>
      </div>

      <button class="btn btn-secondary btn-sm" id="btn-logout" style="color: var(--danger); border-color: #fecaca; width: 100%;">
        🚪 Cerrar Sesión
      </button>
    </div>

    <!-- IA Gemini para Facturas -->
    <div class="mc-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h2 style="font-size: 1.05rem; font-weight: 700;">🧠 Lector de Facturas con IA</h2>
        <span class="badge ${geminiKey ? 'badge-normal' : 'badge-low'}">
          ${geminiKey ? 'Activo' : 'Sin configurar'}
        </span>
      </div>
      <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 12px;">
        Google Gemini Flash Vision lee automáticamente tus fotos de tickets y facturas.
      </p>

      <div class="form-group" style="margin-bottom: 10px;">
        <label class="form-label" style="font-size: 0.75rem;">Gemini API Key (Gratis)</label>
        <input type="password" id="settings-gemini-key" class="form-input" value="${geminiKey}" placeholder="AIzaSy...">
      </div>

      <button class="btn btn-primary btn-sm" id="btn-save-settings-key" style="width: 100%;">
        Guardar Clave de IA
      </button>
    </div>

    <!-- Modo Oscuro -->
    <div class="mc-card" style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-weight: 700; font-size: 0.95rem;">Modo Oscuro</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">Optimizado para uso nocturno</div>
      </div>
      <button class="btn btn-secondary btn-sm" id="btn-toggle-theme">
        🌓 Cambiar Tema
      </button>
    </div>

    <!-- Seguridad -->
    <div class="mc-card" style="background: var(--bg-main); border: 1px dashed var(--border);">
      <div style="font-size: 0.8rem; color: var(--text-muted); text-align: center;">
        🔒 Conectado de forma segura a Supabase con Row Level Security (RLS) activo.
      </div>
    </div>
  `;

  document.getElementById('btn-save-settings-key')?.addEventListener('click', () => {
    const val = document.getElementById('settings-gemini-key').value.trim();
    setGeminiApiKey(val);
    showToast('Clave de IA actualizada ✅', 'success');
  });

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await signOut();
    showToast('Sesión cerrada', 'info');
    navigateTo('auth');
  });

  document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('mc_theme', isDark ? 'light' : 'dark');
  });
}
