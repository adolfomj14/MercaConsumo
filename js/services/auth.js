// Autenticación con Supabase Auth
import { getSupabase } from './supabase.js';
import { state } from '../state.js';

export function mapAuthError(err) {
  if (!err) return 'Error desconocido al autenticar.';
  const msg = err.message || err.toString();
  if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
    return 'Correo o contraseña incorrectos. Verifica que el usuario esté creado en Supabase.';
  }
  if (msg.includes('Email not confirmed')) {
    return 'Tu correo no está confirmado en Supabase. En Supabase -> Users márcalo como confirmado.';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Demasiadas solicitudes a Supabase. Espera un momento.';
  }
  return msg;
}

export async function getCurrentUser() {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data: { session }, error } = await sb.auth.getSession();
    if (error) {
      console.warn('Error al recuperar sesión:', error);
      state.setUser(null);
      return null;
    }

    if (session && session.user) {
      state.setUser(session.user);
      return session.user;
    }
  } catch (err) {
    console.error('Excepción al obtener sesión:', err);
  }

  state.setUser(null);
  return null;
}

export async function signIn(email, password) {
  const sb = getSupabase();
  if (!sb) throw new Error('Cliente de Supabase no inicializado. Revisa js/config.js');

  const { data, error } = await sb.auth.signInWithPassword({
    email: email.trim(),
    password: password
  });

  if (error) throw error;
  if (!data.user) throw new Error('No se pudo autenticar el usuario');

  state.setUser(data.user);
  return data.user;
}

export async function signOut() {
  const sb = getSupabase();
  if (sb) {
    await sb.auth.signOut();
  }
  state.setUser(null);
}
