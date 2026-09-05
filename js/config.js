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
let _adminUserId = '';

export function getGeminiApiKey() {
  return _globalGeminiKey || config.geminiApiKey || localStorage.getItem('mc_gemini_api_key') || '';
}

// Verifica de forma estricta si el usuario es el Administrador/Dueño registrado en Supabase
export function isUserAdmin(user) {
  if (!user || !user.id) return false;

  // 1. Si coincide con el ID de admin registrado en Supabase app_settings
  if (_adminUserId && user.id === _adminUserId) return true;

  // 2. Si tiene rol admin en metadata de Supabase
  if (user.user_metadata?.is_admin === true || user.app_metadata?.is_admin === true) return true;

  return false;
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
        }
        if (item.key === 'admin_user_id' && item.value) {
          _adminUserId = item.value;
        }
      });
    }
  } catch (e) {
    console.warn('No se pudieron cargar ajustes globales de Supabase:', e);
  }
}

// Guarda la clave en Supabase vinculando al Admin
export async function setGeminiApiKey(key) {
  const cleanKey = key ? key.trim() : '';
  _globalGeminiKey = cleanKey;

  const sb = getSupabase();
  if (sb) {
    try {
      const { data: { user } } = await sb.auth.getUser();

      await sb.from('app_settings').upsert([
        {
          key: 'gemini_api_key',
          value: cleanKey,
          updated_at: new Date().toISOString()
        },
        ...(user ? [{
          key: 'admin_user_id',
          value: user.id,
          updated_at: new Date().toISOString()
        }] : [])
      ]);

      if (user) {
        _adminUserId = user.id;
      }
    } catch (e) {
      console.warn('Error guardando clave en app_settings:', e);
    }
  }
}
