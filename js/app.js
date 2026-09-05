// Orquestador principal de MercaConsumo con Gestión de Sesiones y Recuperación
import { state }          from './state.js';
import { getSupabase }    from './services/supabase.js';
import { getCurrentUser } from './services/auth.js';
import { loadGlobalSettings } from './config.js';
import { fetchCategories, fetchProducts } from './services/products.js';
import { fetchStores }    from './services/stores.js';
import { fetchPurchases } from './services/purchases.js';
import { fetchInventory, fetchConsumptions, fetchCycles } from './services/inventory.js';

import { renderAuthView }         from './views/authView.js';
import { renderDashboardView }    from './views/dashboardView.js';
import { renderInventoryView }    from './views/inventoryView.js';
import { renderPurchasesView }    from './views/purchasesView.js';
import { renderStatsView }        from './views/statsView.js';
import { renderScanView }         from './views/scanView.js';
import { renderSettingsView }     from './views/settingsView.js';
import { renderShoppingListView } from './views/shoppingListView.js';

const root      = () => document.getElementById('app-root');
const bottomNav = () => document.getElementById('app-bottom-nav');
const fab       = () => document.getElementById('app-fab');

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
  await loadData();
  navigate('dashboard');
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

  // Verificar si la URL viene de un enlace de recuperación de contraseña
  const hash = window.location.hash || '';
  const isRecovery = hash.includes('type=recovery') || hash.includes('access_token');

  const user = await getCurrentUser();

  if (isRecovery) {
    navigate('auth', { authMode: 'reset' });
    return;
  }

  if (user) {
    await loadData();
    navigate('dashboard');
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
  document.getElementById('btn-header-profile')?.addEventListener('click', () => navigate('settings'));
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
