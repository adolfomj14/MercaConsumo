// Configuración Segura de MercaConsumo con Almacenamiento Compartido en Supabase
import { getSupabase } from './services/supabase.js';

export const config = {
  supabaseUrl: 'https://kfewxixrbkiztgqqkiwm.supabase.co',
  supabaseAnonKey: 'sb_publishable_f7z5iiQl-TDzRsAYKkCwWw_PBV6s69v',
  geminiApiKey: '',
  defaultCurrency: 'COP',
  defaultTimezone: 'America/Bogota'
};

let _globalGeminiKey = '';

export function getGeminiApiKey() {
  return _globalGeminiKey || localStorage.getItem('mc_gemini_api_key') || config.geminiApiKey || '';
}

// Carga las configuraciones compartidas desde la tabla segura app_settings de Supabase
export async function loadGlobalSettings() {
  const sb = getSupabase();
  if (!sb) return;

  try {
    const { data, error } = await sb.from('app_settings').select('*');
    if (!error && data) {
      data.forEach(item => {
        if (item.key === 'gemini_api_key' && item.value) {
          _globalGeminiKey = item.value;
          localStorage.setItem('mc_gemini_api_key', item.value);
        }
      });
    }
  } catch (e) {
    console.warn('No se pudieron cargar ajustes globales de Supabase:', e);
  }
}

// Guarda la clave en Supabase para que todas las cuentas y dispositivos la tengan
export async function setGeminiApiKey(key) {
  const cleanKey = key ? key.trim() : '';
  _globalGeminiKey = cleanKey;

  if (cleanKey) {
    localStorage.setItem('mc_gemini_api_key', cleanKey);
  } else {
    localStorage.removeItem('mc_gemini_api_key');
  }

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('app_settings').upsert({
        key: 'gemini_api_key',
        value: cleanKey,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Error guardando clave en app_settings:', e);
    }
  }
}
