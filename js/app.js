// Orquestador Principal de MercaConsumo PWA
import { state } from './state.js';
import { getCurrentUser } from './services/auth.js';
import { getSupabase } from './services/supabase.js';
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

  if (!state.user || viewName === 'auth') {
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
  try {
    // Usar allSettled para que si una tabla está vacía o recién creada, no bloquee la carga
    await Promise.allSettled([
      fetchCategories(),
      fetchStores(),
      fetchProducts(),
      fetchInventory(),
      fetchPurchases(),
      fetchConsumptions(),
      fetchCycles()
    ]);
  } catch (err) {
    console.warn('Advertencia al cargar datos de tablas:', err);
  }
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

  // Suscribirse a cambios de sesión en Supabase
  const sb = getSupabase();
  if (sb) {
    sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        state.setUser(session.user);
      } else if (event === 'SIGNED_OUT') {
        state.setUser(null);
        navigate('auth');
      }
    });
  }

  initApp();
});
