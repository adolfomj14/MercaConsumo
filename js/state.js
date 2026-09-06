// Estado Reactivo Global
class AppState {
  constructor() {
    this.user = null;
    this.profile = null; // Datos de public.profiles (full_name, plan, etc.)
    this.currentView = 'dashboard';
    this.products = [];
    this.categories = [];
    this.stores = [];
    this.purchases = [];
    this.inventory = [];
    this.consumptions = [];
    this.cycles = [];
    this.activeProfile = null; // Perfil familiar activo (estilo Netflix) — solo Plan Pro
    this.listeners = [];
  }

  setUser(user) {
    this.user = user;
    this.notify();
  }

  setProfile(profile) {
    this.profile = profile;
    this.notify();
  }

  setView(view) {
    this.currentView = view;
    this.notify();
  }

  setProducts(products) {
    this.products = products;
    this.notify();
  }

  setInventory(inventory) {
    this.inventory = inventory;
    this.notify();
  }

  setPurchases(purchases) {
    this.purchases = purchases;
    this.notify();
  }

  setStores(stores) {
    this.stores = stores;
    this.notify();
  }

  setConsumptions(consumptions) {
    this.consumptions = consumptions;
    this.notify();
  }

  setCycles(cycles) {
    this.cycles = cycles;
    this.notify();
  }

  // Guarda el perfil familiar activo y lo persiste en localStorage por usuario,
  // para recordarlo entre sesiones en el mismo dispositivo (como Netflix).
  setActiveProfile(profile) {
    this.activeProfile = profile;
    if (this.user) {
      try {
        if (profile) {
          localStorage.setItem(`mc_active_profile_${this.user.id}`, JSON.stringify(profile));
        } else {
          localStorage.removeItem(`mc_active_profile_${this.user.id}`);
        }
      } catch (e) { /* localStorage no disponible, se ignora */ }
    }
    this.notify();
  }

  // Recupera el último perfil elegido para el usuario actual (si existe).
  loadActiveProfileFromStorage() {
    if (!this.user) { this.activeProfile = null; return null; }
    try {
      const raw = localStorage.getItem(`mc_active_profile_${this.user.id}`);
      this.activeProfile = raw ? JSON.parse(raw) : null;
    } catch (e) {
      this.activeProfile = null;
    }
    return this.activeProfile;
  }

  // Limpia el perfil activo en memoria (usado al cerrar sesión) sin borrar
  // el recuerdo guardado en localStorage para la próxima vez que inicie sesión.
  clearActiveProfileMemory() {
    this.activeProfile = null;
    this.notify();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(fn => fn(this));
  }
}

export const state = new AppState();
