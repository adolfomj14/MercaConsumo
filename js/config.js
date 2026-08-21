// Configuración de MercaConsumo
// Ingresa tus credenciales de Supabase exclusivamente en este archivo:
export const config = {
  supabaseUrl: 'https://kfewxixrbkiztgqqkiwm.supabase.co',
  supabaseAnonKey: 'sb_publishable_f7z5iiQl-TDzRsAYKkCwWw_PBV6s69v',
  defaultCurrency: 'COP',
  defaultTimezone: 'America/Bogota',
  version: '1.0.0',

  isConfigured() {
    return Boolean(
      this.supabaseUrl && 
      !this.supabaseUrl.includes('TU-PROYECTO') && 
      this.supabaseAnonKey && 
      !this.supabaseAnonKey.includes('TU-ANON-KEY')
    );
  }
};
