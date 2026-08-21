// Vista de Configuración, Perfil, Supabase y Datos Demo
import { state } from '../state.js';
import { config } from '../config.js';
import { signOut } from '../services/auth.js';
import { loadDemoData, clearDemoData } from '../services/demoData.js';
import { showToast, showConfirmDialog } from '../utils/toast.js';

export function renderSettingsView(container, navigateTo) {
  const user = state.user;

  container.innerHTML = `
    <div style="margin-bottom: 16px;">
      <h1 style="font-size: 1.35rem; font-weight: 800;">Ajustes & Perfil</h1>
      <p style="color: var(--text-muted); font-size: 0.85rem;">Preferencias del sistema y conexión</p>
    </div>

    <!-- Perfil -->
    <div class="mc-card">
      <h2 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 8px;">Cuenta</h2>
      <div style="font-size: 0.9rem; margin-bottom: 4px;">
        <strong>Email:</strong> ${user?.email || 'Usuario Demo'}
      </div>
      <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 12px;">
        <strong>Moneda:</strong> COP (Pesos Colombianos) • <strong>Zona:</strong> America/Bogota
      </div>
      <button class="btn btn-secondary btn-sm" id="btn-logout" style="color: var(--danger); border-color: #fecaca;">
        Cerrar Sesión
      </button>
    </div>

    <!-- Configuración Supabase -->
    <div class="mc-card">
      <h2 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 4px;">Conexión Supabase</h2>
      <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px;">
        Ingresa las credenciales de tu proyecto Supabase para sincronización en la nube con RLS.
      </p>

      <form id="supabase-config-form">
        <div class="form-group">
          <label class="form-label">Supabase Project URL</label>
          <input type="url" id="sb-url" class="form-input" value="${config.supabaseUrl}" placeholder="https://tu-proyecto.supabase.co">
        </div>

        <div class="form-group">
          <label class="form-label">Supabase Anon Key (Public)</label>
          <input type="password" id="sb-key" class="form-input" value="${config.supabaseAnonKey}" placeholder="eyJhbGciOi...">
        </div>

        <button type="submit" class="btn btn-secondary btn-sm">Guardar Configuración</button>
      </form>
    </div>

    <!-- Datos de Demostración -->
    <div class="mc-card">
      <h2 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 4px;">Datos de Demostración</h2>
      <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px;">
        Carga o reinicia un conjunto realista de compras colombianas (Plátano, Leche, Huevos, Arroz) con 60 días de historial para probar las predicciones.
      </p>

      <div style="display: flex; gap: 8px;">
        <button class="btn btn-primary btn-sm" id="btn-load-demo" style="flex: 1;">
          ⚡ Cargar Datos Demo
        </button>
        <button class="btn btn-secondary btn-sm" id="btn-clear-demo" style="flex: 1; color: var(--danger);">
          🗑️ Limpiar Datos
        </button>
      </div>
    </div>

    <!-- Tema Oscuro -->
    <div class="mc-card" style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-weight: 700; font-size: 0.95rem;">Modo Oscuro</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">Optimizado para uso nocturno</div>
      </div>
      <button class="btn btn-secondary btn-sm" id="btn-toggle-theme">
        🌓 Cambiar Tema
      </button>
    </div>
  `;

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await signOut();
    navigateTo('auth');
  });

  document.getElementById('supabase-config-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = document.getElementById('sb-url').value;
    const key = document.getElementById('sb-key').value;
    config.saveSupabaseConfig(url, key);
    showToast('Configuración de Supabase guardada. Reiniciando...', 'success');
    setTimeout(() => window.location.reload(), 800);
  });

  document.getElementById('btn-load-demo')?.addEventListener('click', async () => {
    await loadDemoData();
    showToast('¡Datos de demostración cargados exitosamente!', 'success');
    navigateTo('dashboard');
  });

  document.getElementById('btn-clear-demo')?.addEventListener('click', () => {
    showConfirmDialog({
      title: '¿Limpiar todos los datos?',
      message: 'Esta acción borrará los registros locales de compras e inventario.',
      confirmText: 'Limpiar Todo',
      isDanger: true,
      onConfirm: () => {
        clearDemoData();
      }
    });
  });

  document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('mc_theme', isDark ? 'light' : 'dark');
  });
}
