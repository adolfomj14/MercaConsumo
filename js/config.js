// Configuración de Supabase y App
const STORAGE_KEY_SUPABASE_URL = 'mc_supabase_url';
const STORAGE_KEY_SUPABASE_KEY = 'mc_supabase_key';

// Valores por defecto (Permiten usar Local/Demo Mode si aún no se configuran llaves)
export const config = {
  supabaseUrl: localStorage.getItem(STORAGE_KEY_SUPABASE_URL) || 'https://xyzcompany.supabase.co',
  supabaseAnonKey: localStorage.getItem(STORAGE_KEY_SUPABASE_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy',
  defaultCurrency: 'COP',
  defaultTimezone: 'America/Bogota',
  version: '1.0.0',

  saveSupabaseConfig(url, key) {
    if (url) localStorage.setItem(STORAGE_KEY_SUPABASE_URL, url.trim());
    if (key) localStorage.setItem(STORAGE_KEY_SUPABASE_KEY, key.trim());
    this.supabaseUrl = url;
    this.supabaseAnonKey = key;
  },

  isSupabaseConfigured() {
    return this.supabaseUrl && !this.supabaseUrl.includes('xyzcompany') && this.supabaseAnonKey && !this.supabaseAnonKey.includes('dummy');
  }
};
