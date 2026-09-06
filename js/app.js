// Orquestador principal de MercaConsumo con Perfiles Familiares y Planes
import { state }          from './state.js';
import { getSupabase }    from './services/supabase.js';
import { getCurrentUser } from './services/auth.js';
import { loadGlobalSettings } from './config.js';
import { fetchCategories, fetchProducts } from './services/products.js';
import { fetchStores }    from './services/stores.js';
import { fetchPurchases } from './services/purchases.js';
import { fetchInventory, fetchConsumptions, fetchCycles } from './services/inventory.js';
import { updateHeaderProfileButton } from './services/family.js';

import { renderAuthView }         from './views/authView.js';
import { renderDashboardView }    from './views/dashboardView.js';
import { renderInventoryView }    from './views/inventoryView.js';
import { renderPurchasesView }    from './views/purchasesView.js';
import { renderStatsView }        from './views/statsView.js';
import { renderScanView }         from './views/scanView.js';
import { renderSettingsView, openProfileSelectorModal } from './views/settingsView.js';
import { renderShoppingListView } from './views/shoppingListView.js';

const root      = () => document.getElementById('app-root');
const bottomNav = () => document.getElementById('app-bottom-nav');
const fab       = () => document.getElementById('app-fab');

// Registro de Service Worker para soporte PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('[PWA] Error registrando service worker:', err);
    });
  });
}

// Captura del evento de instalación PWA
window.deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredInstallPrompt = e;
  window.dispatchEvent(new Event('pwa-can-install'));
});

function showApp(show) {
  if (bottomNav()) bottomNav().style.display = show ? 'flex' : 'none';
  if (fab())       fab().style.display       = show ? 'flex' : 'none';
}

function setActiveNav(viewName) {
  document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-view') === viewName);
  });
}

// Función global para alternar y persistir el tema
export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  document.body.setAttribute('data-theme', newTheme);
  localStorage.setItem('mc_theme', newTheme);
}

// Router
export function navigate(viewName, params = {}) {
  state.setView(viewName);

  if (!state.user || viewName === 'auth') {
    showApp(false);
    renderAuthView(root(), () => afterLogin(), params.authMode || 'login');
    return;
  }

  setActiveNav(viewName);
  showApp(true);
  window.scrollTo(0, 0);

  switch (viewName) {
    case 'dashboard':      renderDashboardView(root(), navigate);         break;
    case 'purchases':      renderPurchasesView(root(), navigate, params); break;
    case 'inventory':      renderInventoryView(root(), navigate, params); break;
    case 'stats':          renderStatsView(root(), navigate);             break;
    case 'scan':           renderScanView(root(), navigate);              break;
    case 'settings':       renderSettingsView(root(), navigate);          break;
    case 'shopping-list':  renderShoppingListView(root(), navigate);      break;
    default:               renderDashboardView(root(), navigate);
  }

  updateHeaderProfileButton();
  if (window.lucide) window.lucide.createIcons();
}

async function loadData() {
  await Promise.allSettled([
    loadGlobalSettings(),
    fetchCategories(),
    fetchStores(),
    fetchProducts(),
    fetchInventory(),
    fetchPurchases(),
    fetchConsumptions(),
    fetchCycles()
  ]);
}

async function afterLogin() {
  sessionStorage.removeItem('mc_session_profile_picked');
  await loadData();
  navigate('dashboard');
  openProfileSelectorModal(() => {
    sessionStorage.setItem('mc_session_profile_picked', '1');
    navigate('dashboard');
  });
}

async function boot() {
  const savedTheme = localStorage.getItem('mc_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.body.setAttribute('data-theme', savedTheme);

  root().innerHTML = `
    <div style="min-height:calc(100vh - 120px); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px;">
      <div style="font-size:2.5rem;">🥑</div>
      <p style="color:var(--text-muted); font-size:0.95rem;">Iniciando MercaConsumo...</p>
    </div>`;
  showApp(false);

  const hash = window.location.hash || '';
  const isRecovery = hash.includes('type=recovery') || hash.includes('access_token');

  const user = await getCurrentUser();

  if (isRecovery) {
    navigate('auth', { authMode: 'reset' });
    return;
  }

  if (user) {
    await loadData();
    updateHeaderProfileButton();
    navigate('dashboard');
    
    // Si inicia una nueva sesión de navegador, pregunta con cuál perfil entrar (estilo Netflix)
    if (!sessionStorage.getItem('mc_session_profile_picked')) {
      openProfileSelectorModal(() => {
        sessionStorage.setItem('mc_session_profile_picked', '1');
        navigate('dashboard');
      });
    }
  } else {
    navigate('auth');
  }
}

function setup() {
  document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
    item.addEventListener('click', () => navigate(item.getAttribute('data-view')));
  });

  fab()?.addEventListener('click', () => navigate('purchases', { openModal: true }));

  document.getElementById('btn-header-home')?.addEventListener('click', () => navigate('dashboard'));
  document.getElementById('btn-header-profile')?.addEventListener('click', () => {
    openProfileSelectorModal(() => navigate('dashboard'));
  });
  document.getElementById('btn-header-theme')?.addEventListener('click', toggleTheme);

  const sb = getSupabase();
  if (sb) {
    sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        state.setUser(null);
        navigate('auth');
      } else if (event === 'PASSWORD_RECOVERY') {
        navigate('auth', { authMode: 'reset' });
      }
    });
  }

  boot();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setup);
} else {
  setup();
}
