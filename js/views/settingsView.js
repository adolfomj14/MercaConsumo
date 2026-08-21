// Vista de Ajustes y Perfil
import { state } from '../state.js';
import { signOut } from '../services/auth.js';
import { showToast } from '../utils/toast.js';

export function renderSettingsView(container, navigateTo) {
  const user = state.user;
  const fullName = user?.user_metadata?.full_name || 'Usuario';
  const email = user?.email || '';

  container.innerHTML = `
    <div style="margin-bottom: 16px;">
      <h1 style="font-size: 1.35rem; font-weight: 800;">Ajustes & Perfil</h1>
      <p style="color: var(--text-muted); font-size: 0.85rem;">Detalles de tu cuenta</p>
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
        <div>
          <span style="color: var(--text-muted);">Zona Horaria:</span>
          <strong>America/Bogota</strong>
        </div>
      </div>

      <button class="btn btn-secondary btn-sm" id="btn-logout" style="color: var(--danger); border-color: #fecaca; width: 100%;">
        🚪 Cerrar Sesión
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
