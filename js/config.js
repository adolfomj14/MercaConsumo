// Configuración de MercaConsumo
export const config = {
  supabaseUrl: 'https://kfewxixrbkiztgqqkiwm.supabase.co',
  supabaseAnonKey: 'sb_publishable_f7z5iiQl-TDzRsAYKkCwWw_PBV6s69v',
  // Puedes poner tu API Key de Gemini aquí o configurarla desde la app:
  geminiApiKey: '',
  defaultCurrency: 'COP',
  defaultTimezone: 'America/Bogota'
};

export function getGeminiApiKey() {
  return localStorage.getItem('mc_gemini_api_key') || config.geminiApiKey || '';
}

export function setGeminiApiKey(key) {
  if (key) {
    localStorage.setItem('mc_gemini_api_key', key.trim());
  } else {
    localStorage.removeItem('mc_gemini_api_key');
  }
}
