// Pantalla de Login - Simple, directa, 100% Supabase
import { signIn } from '../services/auth.js';
import { showToast } from '../utils/toast.js';

// ── Rate Limiting (solo en el navegador, no en Supabase) ──
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
  if (fails >= 3) {
    const lvl = parseInt(localStorage.getItem(K.level) || '0', 10);
    const secs = 30 * Math.pow(2, lvl);  // 30s, 60s, 120s, 240s...
    localStorage.setItem(K.until, Date.now() + secs * 1000);
    localStorage.setItem(K.level, lvl + 1);
    localStorage.setItem(K.fails, '0');
    return { locked: true, seconds: secs };
  }
  return { locked: false, left: 3 - fails };
}
function clearRateLimit() {
  Object.values(K).forEach(k => localStorage.removeItem(k));
}

export function renderAuthView(container, onLoginSuccess) {
  let countdown = null;

  function paint() {
    if (countdown) clearInterval(countdown);

    const locked = isLockedOut();
    const secs = lockSecondsLeft();

    container.innerHTML = `
      <div style="min-height: calc(100vh - 120px); display:flex; flex-direction:column; justify-content:center; padding:20px 0;">
        <div style="text-align:center; margin-bottom:24px;">
          <div style="font-size:3.5rem; margin-bottom:8px;">🥑</div>
          <h1 style="font-size:1.6rem; font-weight:800; color:var(--text-main);">MercaConsumo</h1>
          <p style="color:var(--text-muted); font-size:0.9rem; margin-top:4px;">Gestión de compras e inventario del hogar</p>
        </div>

        <div class="mc-card" style="padding:24px;">
          <h2 style="font-size:1.15rem; font-weight:700; margin-bottom:18px; text-align:center;">Iniciar Sesión</h2>

          <!-- Caja de error -->
          <div id="login-err"
               style="display:none; background:#fee2e2; border:1px solid #fecaca; color:#b91c1c;
                      padding:10px 14px; border-radius:10px; margin-bottom:14px; font-size:0.85rem; line-height:1.4;">
          </div>

          <!-- Bloqueo temporal -->
          ${locked ? `
            <div style="background:#fef3c7; border:1px solid #fde68a; color:#92400e;
                        padding:12px; border-radius:10px; margin-bottom:14px; text-align:center; font-size:0.85rem;">
              ⛔ <strong>Bloqueado por múltiples intentos fallidos.</strong><br>
              Reintenta en <strong id="lock-cd">${secs}s</strong>
            </div>
          ` : ''}

          <form id="login-form" autocomplete="on">
            <div class="form-group">
              <label class="form-label">Correo electrónico</label>
              <input type="email" id="inp-email" class="form-input"
                     placeholder="correo@dominio.com"
                     required autocomplete="email"
                     ${locked ? 'disabled' : ''}>
            </div>
            <div class="form-group">
              <label class="form-label">Contraseña</label>
              <input type="password" id="inp-pass" class="form-input"
                     placeholder="••••••••"
                     required autocomplete="current-password"
                     ${locked ? 'disabled' : ''}>
            </div>
            <button type="submit" id="btn-login" class="btn btn-primary" style="margin-top:10px;" ${locked ? 'disabled' : ''}>
              Ingresar
            </button>
          </form>
        </div>
      </div>
    `;

    // Contador regresivo si está bloqueado
    if (locked) {
      const cdEl = document.getElementById('lock-cd');
      countdown = setInterval(() => {
        const left = lockSecondsLeft();
        if (left <= 0) {
          clearInterval(countdown);
          localStorage.removeItem(K.until);
          paint();
        } else if (cdEl) {
          cdEl.textContent = left + 's';
        }
      }, 500);
      return;
    }

    // Manejador del formulario
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('inp-email').value.trim();
      const pass  = document.getElementById('inp-pass').value;
      const btn   = document.getElementById('btn-login');
      const errEl = document.getElementById('login-err');

      btn.disabled = true;
      btn.textContent = 'Verificando...';
      errEl.style.display = 'none';

      try {
        await signIn(email, pass);
        clearRateLimit();
        showToast('¡Bienvenido! 👋', 'success');
        if (onLoginSuccess) onLoginSuccess();
      } catch (err) {
        console.error('[Login]', err.message);
        const penalty = recordFailedAttempt();

        if (penalty.locked) {
          paint(); // redibuja con el bloqueo
        } else {
          btn.disabled = false;
          btn.textContent = 'Ingresar';
          errEl.style.display = 'block';
          errEl.innerHTML = `❌ ${err.message}<br><small style="color:#9b1c1c;">Intentos restantes: <strong>${penalty.left}</strong></small>`;
        }
      }
    });
  }

  paint();
}
