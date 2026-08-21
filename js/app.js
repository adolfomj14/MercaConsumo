// Orquestador principal de MercaConsumo
import { state }          from './state.js';
import { getSupabase }    from './services/supabase.js';
import { getCurrentUser } from './services/auth.js';
import { fetchCategories, fetchProducts } from './services/products.js';
import { fetchStores }    from './services/stores.js';
import { fetchPurchases } from './services/purchases.js';
import { fetchInventory, fetchConsumptions, fetchCycles } from './services/inventory.js';

import { renderAuthView }      from './views/authView.js';
import { renderDashboardView } from './views/dashboardView.js';
import { renderInventoryView } from './views/inventoryView.js';
import { renderPurchasesView } from './views/purchasesView.js';
import { renderStatsView }     from './views/statsView.js';
import { renderScanView }      from './views/scanView.js';
import { renderSettingsView }  from './views/settingsView.js';

// ── Helpers de DOM ──
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

// ── Router ──
export function navigate(viewName, params = {}) {
  state.setView(viewName);

  if (!state.user || viewName === 'auth') {
    showApp(false);
    renderAuthView(root(), () => afterLogin());
    return;
  }

  setActiveNav(viewName);
  showApp(true);
  window.scrollTo(0, 0);

  switch (viewName) {
    case 'dashboard':  renderDashboardView(root(), navigate);         break;
    case 'purchases':  renderPurchasesView(root(), navigate, params); break;
    case 'inventory':  renderInventoryView(root(), navigate, params); break;
    case 'stats':      renderStatsView(root(), navigate);             break;
    case 'scan':       renderScanView(root(), navigate);              break;
    case 'settings':   renderSettingsView(root(), navigate);          break;
    default:           renderDashboardView(root(), navigate);
  }

  if (window.lucide) window.lucide.createIcons();
}

// ── Carga de datos desde Supabase ──
async function loadData() {
  await Promise.allSettled([
    fetchCategories(),
    fetchStores(),
    fetchProducts(),
    fetchInventory(),
    fetchPurchases(),
    fetchConsumptions(),
    fetchCycles()
  ]);
}

// ── Flujo post-login ──
async function afterLogin() {
  await loadData();
  navigate('dashboard');
}

// ── Arranque inicial ──
async function boot() {
  // Muestra "Iniciando..." mientras verificamos sesión
  root().innerHTML = `
    <div style="min-height:calc(100vh - 120px); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px;">
      <div style="font-size:2.5rem;">🥑</div>
      <p style="color:var(--text-muted); font-size:0.95rem;">Iniciando MercaConsumo...</p>
    </div>`;
  showApp(false);

  const user = await getCurrentUser();

  if (user) {
    await loadData();
    navigate('dashboard');
  } else {
    navigate('auth');
  }
}

// ── Setup de eventos ──
function setup() {
  // Navegación inferior
  document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
    item.addEventListener('click', () => navigate(item.getAttribute('data-view')));
  });

  // FAB → nueva compra
  fab()?.addEventListener('click', () => navigate('purchases', { openModal: true }));

  // Header
  document.getElementById('btn-header-home')?.addEventListener('click', () => navigate('dashboard'));
  document.getElementById('btn-header-profile')?.addEventListener('click', () => navigate('settings'));

  // Escuchar cambios de sesión de Supabase (ej. expiración de token)
  const sb = getSupabase();
  if (sb) {
    sb.auth.onAuthStateChange((event, session) => {
      console.log('[Auth event]', event);
      if (event === 'SIGNED_OUT') {
        state.setUser(null);
        navigate('auth');
      }
    });
  }

  boot();
}

// Ejecutar setup cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setup);
} else {
  setup();
}
