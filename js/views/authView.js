// Pantalla de Autenticación Completa: Iniciar Sesión, Registrarse y Recuperar Contraseña
import { signIn, signUp, resetPasswordForEmail, updatePassword } from '../services/auth.js';
import { showToast } from '../utils/toast.js';

const K = { until: 'mc_lock_until', fails: 'mc_lock_fails', level: 'mc_lock_lvl' };

function isLockedOut() {
  return Date.now() < parseInt(localStorage.getItem(K.until) || '0', 10);
}
function lockSecondsLeft() {
  return Math.max(0, Math.ceil((parseInt(localStorage.getItem(K.until) || '0', 10) - Date.now()) / 1000));
}
function recordFailedAttempt() {
  const fails = parseInt(localStorage.getItem(K.fails) || '0', 10) + 1;
  localStorage.setItem(K.fails, fails);
  if (fails >= 4) {
    const lvl = parseInt(localStorage.getItem(K.level) || '0', 10);
    const secs = 30 * Math.pow(2, lvl);
    localStorage.setItem(K.until, Date.now() + secs * 1000);
    localStorage.setItem(K.level, lvl + 1);
    localStorage.setItem(K.fails, '0');
    return { locked: true, seconds: secs };
  }
  return { locked: false, left: 4 - fails };
}
function clearRateLimit() {
  Object.values(K).forEach(k => localStorage.removeItem(k));
}

export function renderAuthView(container, onLoginSuccess, initialMode = 'login') {
  let mode = initialMode; // 'login' | 'register' | 'forgot' | 'reset'
  let countdown = null;

  function render() {
    if (countdown) clearInterval(countdown);

    const locked = isLockedOut();
    const secs = lockSecondsLeft();

    container.innerHTML = `
      <div style="min-height: calc(100vh - 100px); display:flex; flex-direction:column; justify-content:center; padding:16px 0; max-width: 420px; margin: 0 auto;">
        
        <!-- Logo y Encabezado -->
        <div style="text-align:center; margin-bottom:20px;">
          <div style="font-size:3.2rem; margin-bottom:6px; line-height: 1;">🥑</div>
          <h1 style="font-size:1.6rem; font-weight:800; color:var(--text-main); margin: 0;">MercaConsumo</h1>
          <p style="color:var(--text-muted); font-size:0.85rem; margin-top:4px;">Tu despensa e inventario doméstico inteligente</p>
        </div>

        <div class="mc-card" style="padding:22px 20px;">
          
          <!-- Pestañas de Alternancia (Login vs Registro) -->
          ${mode === 'login' || mode === 'register' ? `
            <div style="display:flex; background:var(--bg-main); border-radius:10px; padding:4px; margin-bottom:18px; border:1px solid var(--border);">
              <button id="tab-btn-login" class="btn btn-sm ${mode === 'login' ? 'btn-primary' : 'btn-secondary'}"
                      style="flex:1; border:none; font-weight:700; font-size:0.85rem; padding:6px 0; ${mode !== 'login' ? 'background:transparent; color:var(--text-muted);' : ''}">
                Iniciar Sesión
              </button>
              <button id="tab-btn-register" class="btn btn-sm ${mode === 'register' ? 'btn-primary' : 'btn-secondary'}"
                      style="flex:1; border:none; font-weight:700; font-size:0.85rem; padding:6px 0; ${mode !== 'register' ? 'background:transparent; color:var(--text-muted);' : ''}">
                Crear Cuenta ✨
              </button>
            </div>
          ` : ''}

          <!-- Mensaje de error/alerta -->
          <div id="auth-alert"
               style="display:none; padding:10px 14px; border-radius:10px; margin-bottom:14px; font-size:0.85rem; line-height:1.4;">
          </div>

          <!-- Bloqueo temporal -->
          ${locked ? `
            <div style="background:#fef3c7; border:1px solid #fde68a; color:#92400e;
                        padding:12px; border-radius:10px; margin-bottom:14px; text-align:center; font-size:0.85rem;">
              ⛔ <strong>Bloqueado por intentos fallidos.</strong><br>
              Reintenta en <strong id="lock-cd">${secs}s</strong>
            </div>
          ` : ''}

          <!-- 1. FORMULARIO DE INICIO DE SESIÓN -->
          ${mode === 'login' ? `
            <form id="login-form" autocomplete="on">
              <div class="form-group">
                <label class="form-label">Correo electrónico</label>
                <input type="email" id="inp-email" class="form-input"
                       placeholder="tu@correo.com" required autocomplete="email"
                       ${locked ? 'disabled' : ''}>
              </div>
              <div class="form-group" style="margin-bottom: 8px;">
                <label class="form-label">Contraseña</label>
                <input type="password" id="inp-pass" class="form-input"
                       placeholder="••••••••" required autocomplete="current-password"
                       ${locked ? 'disabled' : ''}>
              </div>

              <div style="text-align:right; margin-bottom:16px;">
                <button type="button" id="btn-forgot-pass-link"
                        style="background:none; border:none; color:var(--primary); font-size:0.8rem; font-weight:600; cursor:pointer; padding:0; text-decoration:underline;">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <button type="submit" id="btn-login" class="btn btn-primary" style="width:100%; font-size:0.95rem; font-weight:700;" ${locked ? 'disabled' : ''}>
                Ingresar a mi Despensa
              </button>
            </form>
          ` : ''}

          <!-- 2. FORMULARIO DE REGISTRO DE CUENTA -->
          ${mode === 'register' ? `
            <form id="register-form" autocomplete="on">
              <div class="form-group">
                <label class="form-label">Tu Nombre</label>
                <input type="text" id="inp-reg-name" class="form-input"
                       placeholder="Ej: Laura Gómez" required autocomplete="name">
              </div>

              <div class="form-group">
                <label class="form-label">Correo electrónico</label>
                <input type="email" id="inp-reg-email" class="form-input"
                       placeholder="tu@correo.com" required autocomplete="email">
              </div>

              <div class="form-group">
                <label class="form-label">Contraseña (Mínimo 6 caracteres)</label>
                <input type="password" id="inp-reg-pass" class="form-input"
                       placeholder="••••••••" minlength="6" required autocomplete="new-password">
              </div>

              <div class="form-group">
                <label class="form-label">Confirmar Contraseña</label>
                <input type="password" id="inp-reg-pass-confirm" class="form-input"
                       placeholder="••••••••" minlength="6" required autocomplete="new-password">
              </div>

              <button type="submit" id="btn-register" class="btn btn-primary" style="width:100%; font-size:0.95rem; font-weight:700; margin-top:6px;">
                Crear Mi Cuenta Gratis ✅
              </button>
            </form>
          ` : ''}

          <!-- 3. FORMULARIO DE RECUPERACIÓN / CAMBIO DE CONTRASEÑA -->
          ${mode === 'forgot' ? `
            <div>
              <h2 style="font-size:1.1rem; font-weight:700; margin-bottom:6px;">Recuperar Contraseña</h2>
              <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:14px; line-height:1.4;">
                Ingresa tu correo y te enviaremos un enlace seguro para crear una nueva contraseña.
              </p>

              <form id="forgot-form">
                <div class="form-group">
                  <label class="form-label">Correo electrónico</label>
                  <input type="email" id="inp-forgot-email" class="form-input"
                         placeholder="tu@correo.com" required autocomplete="email">
                </div>

                <button type="submit" id="btn-send-reset" class="btn btn-primary" style="width:100%; font-size:0.95rem; font-weight:700; margin-top:4px;">
                  Enviar Enlace de Recuperación ✉️
                </button>
              </form>

              <div style="text-align:center; margin-top:16px;">
                <button type="button" id="btn-back-to-login" class="btn btn-secondary btn-sm" style="font-size:0.8rem;">
                  ← Volver a Iniciar Sesión
                </button>
              </div>
            </div>
          ` : ''}

          <!-- 4. FORMULARIO DE NUEVA CONTRASEÑA (Triggered por recuperación) -->
          ${mode === 'reset' ? `
            <div>
              <h2 style="font-size:1.1rem; font-weight:700; margin-bottom:6px;">Establecer Nueva Contraseña</h2>
              <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:14px;">
                Ingresa tu nueva contraseña para acceder a tu cuenta.
              </p>

              <form id="new-pass-form">
                <div class="form-group">
                  <label class="form-label">Nueva Contraseña (Mínimo 6 caracteres)</label>
                  <input type="password" id="inp-new-pass" class="form-input"
                         placeholder="••••••••" minlength="6" required autocomplete="new-password">
                </div>
                <div class="form-group">
                  <label class="form-label">Confirmar Nueva Contraseña</label>
                  <input type="password" id="inp-new-pass-confirm" class="form-input"
                         placeholder="••••••••" minlength="6" required autocomplete="new-password">
                </div>

                <button type="submit" id="btn-save-new-pass" class="btn btn-primary" style="width:100%; font-size:0.95rem; font-weight:700; margin-top:6px;">
                  Guardar Nueva Contraseña 🔒
                </button>
              </form>
            </div>
          ` : ''}

        </div>

        <!-- Pie de página de Privacidad -->
        <div style="text-align:center; margin-top:16px; font-size:0.75rem; color:var(--text-muted);">
          🔒 Tus datos están cifrados y protegidos de forma privada con Supabase RLS.
        </div>

      </div>
    `;

    if (locked) {
      const cdEl = document.getElementById('lock-cd');
      countdown = setInterval(() => {
        const left = lockSecondsLeft();
        if (left <= 0) {
          clearInterval(countdown);
          localStorage.removeItem(K.until);
          render();
        } else if (cdEl) {
          cdEl.textContent = left + 's';
        }
      }, 500);
      return;
    }

    attachEvents();
  }

  function showAlert(msg, type = 'error') {
    const el = document.getElementById('auth-alert');
    if (!el) return;
    el.style.display = 'block';
    if (type === 'success') {
      el.style.background = '#dcfce7';
      el.style.borderColor = '#86efac';
      el.style.color = '#15803d';
      el.innerHTML = `✅ ${msg}`;
    } else {
      el.style.background = '#fee2e2';
      el.style.borderColor = '#fecaca';
      el.style.color = '#b91c1c';
      el.innerHTML = `❌ ${msg}`;
    }
  }

  function attachEvents() {
    document.getElementById('tab-btn-login')?.addEventListener('click', () => { mode = 'login'; render(); });
    document.getElementById('tab-btn-register')?.addEventListener('click', () => { mode = 'register'; render(); });
    document.getElementById('btn-forgot-pass-link')?.addEventListener('click', () => { mode = 'forgot'; render(); });
    document.getElementById('btn-back-to-login')?.addEventListener('click', () => { mode = 'login'; render(); });

    // Submit: Login
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('inp-email').value.trim();
      const pass  = document.getElementById('inp-pass').value;
      const btn   = document.getElementById('btn-login');

      btn.disabled = true;
      btn.textContent = 'Verificando...';

      try {
        await signIn(email, pass);
        clearRateLimit();
        showToast('¡Bienvenido de nuevo! 👋', 'success');
        if (onLoginSuccess) onLoginSuccess();
      } catch (err) {
        const penalty = recordFailedAttempt();
        if (penalty.locked) {
          render();
        } else {
          btn.disabled = false;
          btn.textContent = 'Ingresar a mi Despensa';
          showAlert(`${err.message}<br><small style="opacity:0.85;">Intentos restantes: <strong>${penalty.left}</strong></small>`);
        }
      }
    });

    // Submit: Registro
    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name    = document.getElementById('inp-reg-name').value.trim();
      const email   = document.getElementById('inp-reg-email').value.trim();
      const pass    = document.getElementById('inp-reg-pass').value;
      const passC   = document.getElementById('inp-reg-pass-confirm').value;
      const btn     = document.getElementById('btn-register');

      if (pass !== passC) {
        showAlert('Las contraseñas no coinciden. Por favor verifícalas.');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Creando cuenta...';

      try {
        const res = await signUp(email, pass, name);

        if (res.requiresConfirmation) {
          showAlert(`¡Cuenta creada con éxito! 🎉<br>Hemos enviado un enlace de confirmación a <strong>${email}</strong>. Por favor revísalo para activar tu cuenta.`, 'success');
          btn.disabled = false;
          btn.textContent = 'Crear Mi Cuenta Gratis ✅';
        } else {
          showToast(`¡Bienvenido a MercaConsumo, ${name || 'Usuario'}! 🎉`, 'success');
          if (onLoginSuccess) onLoginSuccess();
        }
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Crear Mi Cuenta Gratis ✅';
        showAlert(err.message);
      }
    });

    // Submit: Enviar enlace de recuperación de contraseña
    document.getElementById('forgot-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('inp-forgot-email').value.trim();
      const btn = document.getElementById('btn-send-reset');

      btn.disabled = true;
      btn.textContent = 'Enviando enlace...';

      try {
        await resetPasswordForEmail(email);
        showAlert(`¡Correo enviado! ✉️<br>Revisa tu bandeja de entrada en <strong>${email}</strong> y haz clic en el enlace para cambiar tu contraseña.`, 'success');
        btn.textContent = 'Enlace Enviado ✅';
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Enviar Enlace de Recuperación ✉️';
        showAlert(err.message);
      }
    });

    // Submit: Nueva contraseña tras recuperación
    document.getElementById('new-pass-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newP = document.getElementById('inp-new-pass').value;
      const newPC = document.getElementById('inp-new-pass-confirm').value;
      const btn = document.getElementById('btn-save-new-pass');

      if (newP !== newPC) {
        showAlert('Las contraseñas no coinciden.');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Guardando...';

      try {
        await updatePassword(newP);
        showToast('¡Contraseña actualizada con éxito! 🔒', 'success');
        if (onLoginSuccess) onLoginSuccess();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Guardar Nueva Contraseña 🔒';
        showAlert(err.message);
      }
    });
  }

  render();
}
