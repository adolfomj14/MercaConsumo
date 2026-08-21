// Vista de Autenticación Mobile-First
import { signIn, signUp } from '../services/auth.js';
import { showToast } from '../utils/toast.js';

export function renderAuthView(container, onAuthSuccess) {
  let isSignUpMode = false;

  const render = () => {
    container.innerHTML = `
      <div style="min-height: calc(100vh - 120px); display: flex; flex-direction: column; justify-content: center; padding: 20px 0;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 3.5rem; margin-bottom: 8px;">🥑</div>
          <h1 style="font-size: 1.6rem; font-weight: 800; color: var(--text-main);">MercaConsumo</h1>
          <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 4px;">Control inteligente de compras, inventario y predicción de consumo</p>
        </div>

        <div class="mc-card" style="padding: 24px;">
          <h2 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 16px; text-align: center;">
            ${isSignUpMode ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </h2>

          <form id="auth-form">
            ${isSignUpMode ? `
              <div class="form-group">
                <label class="form-label">Nombre Completo</label>
                <input type="text" id="auth-name" class="form-input" placeholder="Tu nombre" required>
              </div>
            ` : ''}

            <div class="form-group">
              <label class="form-label">Correo Electrónico</label>
              <input type="email" id="auth-email" class="form-input" placeholder="ejemplo@correo.com" required>
            </div>

            <div class="form-group">
              <label class="form-label">Contraseña</label>
              <input type="password" id="auth-password" class="form-input" placeholder="••••••••" required minlength="6">
            </div>

            <button type="submit" class="btn btn-primary" style="margin-top: 8px;" id="btn-auth-submit">
              ${isSignUpMode ? 'Registrarme' : 'Ingresar'}
            </button>
          </form>

          <div style="text-align: center; margin-top: 16px;">
            <button class="btn btn-secondary btn-sm" id="btn-toggle-auth-mode" style="border:none; color: var(--primary);">
              ${isSignUpMode ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
            </button>
          </div>
        </div>

        <div style="text-align: center; margin-top: 12px;">
          <button class="btn btn-secondary btn-sm" id="btn-demo-mode">
            ⚡ Probar Modo Demo sin Registro
          </button>
        </div>
      </div>
    `;

    document.getElementById('auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('auth-email').value;
      const password = document.getElementById('auth-password').value;
      const submitBtn = document.getElementById('btn-auth-submit');
      
      submitBtn.disabled = true;
      submitBtn.innerText = 'Verificando...';

      try {
        if (isSignUpMode) {
          const name = document.getElementById('auth-name').value;
          await signUp(email, password, name);
          showToast('Cuenta creada exitosamente', 'success');
        } else {
          await signIn(email, password);
          showToast('Bienvenido de nuevo 👋', 'success');
        }
        if (onAuthSuccess) onAuthSuccess();
      } catch (err) {
        showToast(err.message || 'Error al autenticar', 'error');
        submitBtn.disabled = false;
        submitBtn.innerText = isSignUpMode ? 'Registrarme' : 'Ingresar';
      }
    });

    document.getElementById('btn-toggle-auth-mode').addEventListener('click', () => {
      isSignUpMode = !isSignUpMode;
      render();
    });

    document.getElementById('btn-demo-mode').addEventListener('click', async () => {
      await signIn('demo@mercaconsumo.app', 'demo123456');
      showToast('Sesión iniciada en Modo Demo', 'success');
      if (onAuthSuccess) onAuthSuccess();
    });
  };

  render();
}
