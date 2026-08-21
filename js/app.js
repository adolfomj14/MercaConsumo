// Orquestador Principal de MercaConsumo PWA
import { state } from './state.js';
import { getCurrentUser } from './services/auth.js';
import { fetchCategories, fetchProducts } from './services/products.js';
import { fetchStores } from './services/stores.js';
import { fetchPurchases } from './services/purchases.js';
import { fetchInventory, fetchConsumptions, fetchCycles } from './services/inventory.js';

import { renderAuthView } from './views/authView.js';
import { renderDashboardView } from './views/dashboardView.js';
import { renderInventoryView } from './views/inventoryView.js';
import { renderPurchasesView } from './views/purchasesView.js';
import { renderStatsView } from './views/statsView.js';
import { renderScanView } from './views/scanView.js';
import { renderSettingsView } from './views/settingsView.js';

// Registrar Service Worker para PWA Offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.log('SW registration skipped:', err);
    });
  });
}

// Aplicar tema guardado
const savedTheme = localStorage.getItem('mc_theme');
if (savedTheme === 'dark') {
  document.body.setAttribute('data-theme', 'dark');
}

// Router Principal
export function navigate(viewName, params = {}) {
  state.setView(viewName);
  const root = document.getElementById('app-root');
  const bottomNav = document.getElementById('app-bottom-nav');
  const fab = document.getElementById('app-fab');

  // Actualizar Bottom Nav activo
  document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
    if (item.getAttribute('data-view') === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  if (!state.user && viewName !== 'auth') {
    bottomNav.style.display = 'none';
    fab.style.display = 'none';
    renderAuthView(root, () => initApp());
    return;
  }

  if (viewName === 'auth') {
    bottomNav.style.display = 'none';
    fab.style.display = 'none';
    renderAuthView(root, () => initApp());
    return;
  }

  bottomNav.style.display = 'flex';
  fab.style.display = 'flex';

  window.scrollTo(0, 0);

  switch (viewName) {
    case 'dashboard':
      renderDashboardView(root, navigate);
      break;
    case 'purchases':
      renderPurchasesView(root, navigate, params);
      break;
    case 'inventory':
      renderInventoryView(root, navigate, params);
      break;
    case 'stats':
      renderStatsView(root, navigate);
      break;
    case 'scan':
      renderScanView(root, navigate);
      break;
    case 'settings':
      renderSettingsView(root, navigate);
      break;
    default:
      renderDashboardView(root, navigate);
  }

  if (window.lucide) window.lucide.createIcons();
}

async function loadInitialData() {
  await Promise.all([
    fetchCategories(),
    fetchStores(),
    fetchProducts(),
    fetchInventory(),
    fetchPurchases(),
    fetchConsumptions(),
    fetchCycles()
  ]);
}

async function initApp() {
  const user = await getCurrentUser();
  if (user) {
    await loadInitialData();
    navigate('dashboard');
  } else {
    navigate('auth');
  }
}

// Global Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Navigation tabs
  document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.getAttribute('data-view');
      navigate(view);
    });
  });

  // FAB button
  document.getElementById('app-fab')?.addEventListener('click', () => {
    navigate('purchases', { openModal: true });
  });

  // Header home & profile
  document.getElementById('btn-header-home')?.addEventListener('click', () => navigate('dashboard'));
  document.getElementById('btn-header-profile')?.addEventListener('click', () => navigate('settings'));

  initApp();
});
