// Estado Reactivo Global
class AppState {
  constructor() {
    this.user = null;
    this.currentView = 'dashboard';
    this.products = [];
    this.categories = [];
    this.stores = [];
    this.purchases = [];
    this.inventory = [];
    this.consumptions = [];
    this.cycles = [];
    this.listeners = [];
  }

  setUser(user) {
    this.user = user;
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
