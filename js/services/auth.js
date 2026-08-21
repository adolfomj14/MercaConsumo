// Autenticación 100% Supabase Auth
import { getSupabase } from './supabase.js';
import { state } from '../state.js';

// Devuelve el usuario de la sesión activa, o null si no hay sesión.
export async function getCurrentUser() {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data: { session }, error } = await sb.auth.getSession();
    if (error) throw error;
    if (session?.user) {
      state.setUser(session.user);
      return session.user;
    }
  } catch (err) {
    console.warn('[Auth] getSession falló:', err.message);
  }

  state.setUser(null);
  return null;
}

// Inicia sesión con correo y contraseña de Supabase.
// Lanza un Error con mensaje en español si algo falla.
export async function signIn(email, password) {
  const sb = getSupabase();
  if (!sb) throw new Error('No se pudo conectar con Supabase. Revisa tu conexión a internet.');

  const { data, error } = await sb.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });

  if (error) {
    // Traducir mensajes comunes de Supabase al español
    const msg = error.message || '';
    if (msg.includes('Email not confirmed')) {
      throw new Error('Tu correo no está confirmado. Ve a Supabase → Authentication → Users y confirma el usuario.');
    }
    if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
      throw new Error('Correo o contraseña incorrectos.');
    }
    if (msg.includes('Too many requests')) {
      throw new Error('Demasiados intentos. Espera un momento e intenta de nuevo.');
    }
    throw new Error(msg || 'Error de autenticación.');
  }

  state.setUser(data.user);
  console.log('[Auth] Sesión iniciada →', data.user.email);
  return data.user;
}

// Cierra la sesión actual.
export async function signOut() {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
  state.setUser(null);
  console.log('[Auth] Sesión cerrada.');
}
