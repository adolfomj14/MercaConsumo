// Vista de Inicio de Sesión Única y Blindada (Supabase Auth + Rate Limiting Exponencial)
import { signIn, mapAuthError } from '../services/auth.js';
import { config } from '../config.js';
import { showToast } from '../utils/toast.js';

const STORAGE_FAILED_ATTEMPTS = 'mc_auth_failed_attempts';
const STORAGE_LOCKOUT_UNTIL = 'mc_auth_lockout_until';
const STORAGE_LOCKOUT_COUNT = 'mc_auth_lockout_count';

const BASE_PENALTY_SECONDS = 30;

function getFailedAttempts() {
  return parseInt(localStorage.getItem(STORAGE_FAILED_ATTEMPTS) || '0', 10);
}

function getLockoutUntil() {
  return parseInt(localStorage.getItem(STORAGE_LOCKOUT_UNTIL) || '0', 10);
}

function getLockoutCount() {
  return parseInt(localStorage.getItem(STORAGE_LOCKOUT_COUNT) || '0', 10);
}

function recordFailedAttempt() {
  const attempts = getFailedAttempts() + 1;
  localStorage.setItem(STORAGE_FAILED_ATTEMPTS, attempts.toString());

  if (attempts >= 3) {
    const lockCount = getLockoutCount();
    const penaltySeconds = BASE_PENALTY_SECONDS * Math.pow(2, lockCount);
    const lockoutUntil = Date.now() + (penaltySeconds * 1000);

    localStorage.setItem(STORAGE_LOCKOUT_UNTIL, lockoutUntil.toString());
    localStorage.setItem(STORAGE_LOCKOUT_COUNT, (lockCount + 1).toString());
    localStorage.setItem(STORAGE_FAILED_ATTEMPTS, '0');
    return { isLocked: true, seconds: penaltySeconds };
  }

  return { isLocked: false, remainingAttempts: 3 - attempts };
}

function resetRateLimit() {
  localStorage.removeItem(STORAGE_FAILED_ATTEMPTS);
  localStorage.removeItem(STORAGE_LOCKOUT_UNTIL);
  localStorage.removeItem(STORAGE_LOCKOUT_COUNT);
}

export function renderAuthView(container, onAuthSuccess) {
  let timerInterval = null;
  let lastEnteredEmail = '';

  const render = () => {
    if (timerInterval) clearInterval(timerInterval);

    const now = Date.now();
    const lockoutUntil = getLockoutUntil();
    const isCurrentlyLocked = lockoutUntil > now;
    const remainingSeconds = isCurrentlyLocked ? Math.ceil((lockoutUntil - now) / 1000) : 0;
    const currentAttempts = getFailedAttempts();
    const isConfigured = config.isConfigured();

    container.innerHTML = `
      <div style="min-height: calc(100vh - 120px); display: flex; flex-direction: column; justify-content: center; padding: 20px 0;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 3.5rem; margin-bottom: 8px;">🥑</div>
          <h1 style="font-size: 1.6rem; font-weight: 800; color: var(--text-main);">MercaConsumo</h1>
          <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 4px;">Acceso seguro con Supabase</p>
        </div>

        <div class="mc-card" style="padding: 24px;">
          <h2 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 16px; text-align: center;">
            Iniciar Sesión
          </h2>

          <!-- Alerta de Bloqueo / Intentos -->
          <div id="lockout-banner" style="display: ${isCurrentlyLocked ? 'block' : 'none'}; background: #fee2e2; border: 1px solid #fecaca; color: #b91c1c; padding: 12px; border-radius: 12px; margin-bottom: 16px; text-align: center; font-size: 0.85rem;">
            ⛔ <strong>Acceso bloqueado por seguridad.</strong><br>
            Has alcanzado 3 intentos fallidos.<br>
            Podrás reintentar en: <strong id="countdown-timer" style="font-size: 1.1rem; display: inline-block; margin-top: 4px;">${remainingSeconds}s</strong>
          </div>

          ${(!isCurrentlyLocked && currentAttempts > 0) ? `
            <div style="background: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: 8px 12px; border-radius: 8px; margin-bottom: 14px; font-size: 0.8rem; text-align: center;">
              ⚠️ Intentos fallidos: <strong>${currentAttempts}/3</strong>. Al llegar a 3 se bloqueará el acceso.
            </div>
          ` : ''}

          <form id="login-form">
            <div class="form-group">
              <label class="form-label">Correo Electrónico</label>
              <input type="email" id="login-email" class="form-input" placeholder="usuario@correo.com" value="${lastEnteredEmail}" required autocomplete="email" ${isCurrentlyLocked || !isConfigured ? 'disabled' : ''}>
            </div>

            <div class="form-group">
              <label class="form-label">Contraseña</label>
              <input type="password" id="login-password" class="form-input" placeholder="••••••••" required autocomplete="current-password" ${isCurrentlyLocked || !isConfigured ? 'disabled' : ''}>
            </div>

            <button type="submit" class="btn btn-primary" style="margin-top: 8px;" id="btn-login-submit" ${isCurrentlyLocked || !isConfigured ? 'disabled' : ''}>
              ${isCurrentlyLocked ? 'Bloqueado Temporalmente' : 'Ingresar'}
            </button>
          </form>
        </div>

        <div style="text-align: center; margin-top: 16px; font-size: 0.8rem; color: var(--text-muted);">
          🔒 Conectado a Supabase: <code>${config.supabaseUrl.replace('https://', '')}</code>
        </div>
      </div>
    `;

    if (isCurrentlyLocked) {
      const countdownElem = document.getElementById('countdown-timer');
      timerInterval = setInterval(() => {
        const currentNow = Date.now();
        const diff = Math.ceil((lockoutUntil - currentNow) / 1000);
        if (diff <= 0) {
          clearInterval(timerInterval);
          localStorage.removeItem(STORAGE_LOCKOUT_UNTIL);
          render();
        } else if (countdownElem) {
          countdownElem.innerText = `${diff}s`;
        }
      }, 1000);
      return;
    }

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      const submitBtn = document.getElementById('btn-login-submit');

      lastEnteredEmail = email;
      submitBtn.disabled = true;
      submitBtn.innerText = 'Verificando con Supabase...';

      try {
        await signIn(email, password);
        resetRateLimit();
        showToast('Bienvenido 👋', 'success');
        if (onAuthSuccess) onAuthSuccess();
      } catch (err) {
        console.error('Error de login Supabase:', err);
        const penalty = recordFailedAttempt();
        const friendlyMsg = mapAuthError(err);

        if (penalty.isLocked) {
          showToast(`3 intentos fallidos. Bloqueado por ${penalty.seconds}s.`, 'error', 4000);
        } else {
          showToast(`${friendlyMsg} (Quedan ${penalty.remainingAttempts} intentos)`, 'error', 5000);
        }
        render();
      }
    });
  };

  render();
}
