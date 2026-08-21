// Establecimientos en Supabase
import { getSupabase } from './supabase.js';
import { state } from '../state.js';

export async function fetchStores() {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('stores').select('*').order('name');
  if (error) {
    console.error('Error al consultar stores:', error);
    return [];
  }
  state.setStores(data || []);
  return state.stores;
}

export async function createStore({ name, platform = 'Directo', notes = '' }) {
  const sb = getSupabase();
  if (!sb || !state.user) throw new Error('No autenticado');

  const { data, error } = await sb.from('stores').insert({
    user_id: state.user.id,
    name: name.trim(),
    platform: platform ? platform.trim() : 'Directo',
    notes: notes ? notes.trim() : null
  }).select().single();

  if (error) throw error;
  await fetchStores();
  return data;
}
