// Gestión de tiendas y establecimientos
import { getSupabase } from './supabase.js';
import { state } from '../state.js';

const LOCAL_STORES_KEY = 'mc_local_stores';

export async function fetchStores() {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from('stores').select('*').order('name');
    if (!error && data) {
      state.setStores(data);
      return data;
    }
  }

  const cached = localStorage.getItem(LOCAL_STORES_KEY);
  const stores = cached ? JSON.parse(cached) : [
    { id: 'store-1', name: 'Merca Z', platform: 'Directo' },
    { id: 'store-2', name: 'Éxito', platform: 'Directo' },
    { id: 'store-3', name: 'Rappi (Éxito)', platform: 'Rappi' },
    { id: 'store-4', name: 'D1', platform: 'Directo' }
  ];
  state.setStores(stores);
  return stores;
}

export async function createStore({ name, platform = 'Directo', notes = '' }) {
  const newStore = {
    id: 'store-' + Date.now(),
    name: name.trim(),
    platform: platform.trim(),
    notes: notes.trim()
  };

  const sb = getSupabase();
  if (sb && state.user) {
    const { data, error } = await sb.from('stores').insert({
      user_id: state.user.id,
      name: newStore.name,
      platform: newStore.platform,
      notes: newStore.notes
    }).select().single();
    if (error) throw error;
    await fetchStores();
    return data;
  }

  const current = [...state.stores, newStore];
  localStorage.setItem(LOCAL_STORES_KEY, JSON.stringify(current));
  state.setStores(current);
  return newStore;
}
