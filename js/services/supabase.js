// Cliente Supabase Singleton con fallback transparente
import { config } from '../config.js';

let supabaseClient = null;

export function getSupabase() {
  if (supabaseClient) return supabaseClient;

  if (window.supabase && config.isSupabaseConfigured()) {
    try {
      supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      return supabaseClient;
    } catch (e) {
      console.warn('Error inicializando cliente Supabase real:', e);
    }
  }
  return null;
}

export function resetSupabaseClient() {
  supabaseClient = null;
}
