// Cliente Supabase - Inicialización única y robusta
import { config } from '../config.js';

let _client = null;

export function getSupabase() {
  if (_client) return _client;

  if (!window.supabase) {
    console.error('[MercaConsumo] La librería de Supabase no está cargada aún.');
    return null;
  }

  _client = window.supabase.createClient(
    config.supabaseUrl,
    config.supabaseAnonKey,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    }
  );

  console.log('[MercaConsumo] Cliente Supabase inicializado →', config.supabaseUrl);
  return _client;
}
