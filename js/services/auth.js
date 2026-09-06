// Autenticación 100% Supabase Auth con Registro y Cambio de Contraseña
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
      await fetchUserProfile(session.user.id);
      return session.user;
    }
  } catch (err) {
    console.warn('[Auth] getSession falló:', err.message);
  }

  state.setUser(null);
  state.setProfile(null);
  return null;
}

// Carga el registro de public.profiles
export async function fetchUserProfile(userId) {
  const sb = getSupabase();
  if (!sb || !userId) return null;

  try {
    const { data, error } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!error && data) {
      state.setProfile(data);
      return data;
    }
  } catch (e) {
    console.warn('[Auth] Error al consultar perfil:', e);
  }
  return null;
}

// Inicia sesión con correo y contraseña de Supabase.
export async function signIn(email, password) {
  const sb = getSupabase();
  if (!sb) throw new Error('No se pudo conectar con Supabase. Revisa tu conexión a internet.');

  const { data, error } = await sb.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });

  if (error) {
    const msg = error.message || '';
    if (msg.includes('Email not confirmed')) {
      throw new Error('Tu correo no ha sido confirmado aún. Revisa tu bandeja de entrada o confirma el usuario en Supabase.');
    }
    if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
      throw new Error('Correo o contraseña incorrectos.');
    }
    if (msg.includes('Too many requests')) {
      throw new Error('Demasiados intentos. Espera un momento e intenta de nuevo.');
    }
    throw new Error(msg || 'Error al iniciar sesión.');
  }

  state.setUser(data.user);
  await fetchUserProfile(data.user.id);
  console.log('[Auth] Sesión iniciada →', data.user.email);
  return data.user;
}

// Registro de nuevo usuario en Supabase
export async function signUp(email, password, fullName = '') {
  const sb = getSupabase();
  if (!sb) throw new Error('No se pudo conectar con Supabase. Revisa tu conexión a internet.');

  const siteUrl = window.location.origin + window.location.pathname;

  const { data, error } = await sb.auth.signUp({
    email: email.trim().toLowerCase(),
    password: password,
    options: {
      data: {
        full_name: fullName.trim() || 'Usuario'
      },
      emailRedirectTo: siteUrl
    }
  });

  if (error) {
    const msg = error.message || '';
    if (msg.includes('User already registered') || msg.includes('already exists')) {
      throw new Error('Ya existe una cuenta registrada con este correo electrónico.');
    }
    if (msg.includes('Password should be at least')) {
      throw new Error('La contraseña debe tener al menos 6 caracteres.');
    }
    throw new Error(msg || 'Error al crear la cuenta.');
  }

  // Si la sesión se inició automáticamente (ej. confirm_email desactivado)
  if (data.session?.user) {
    state.setUser(data.session.user);
    return { user: data.session.user, session: data.session, requiresConfirmation: false };
  }

  return { user: data.user, session: null, requiresConfirmation: true };
}

// Envía correo de recuperación de contraseña
export async function resetPasswordForEmail(email) {
  const sb = getSupabase();
  if (!sb) throw new Error('No se pudo conectar con Supabase.');

  const siteUrl = window.location.origin + window.location.pathname;

  const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: siteUrl
  });

  if (error) {
    throw new Error(error.message || 'Error enviando correo de recuperación.');
  }

  return true;
}

// Actualiza la contraseña del usuario actual
export async function updatePassword(newPassword) {
  const sb = getSupabase();
  if (!sb) throw new Error('No se pudo conectar con Supabase.');

  if (!newPassword || newPassword.length < 6) {
    throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
  }

  const { data, error } = await sb.auth.updateUser({
    password: newPassword
  });

  if (error) {
    throw new Error(error.message || 'Error al actualizar la contraseña.');
  }

  return data.user;
}

// Cierra la sesión actual.
export async function signOut() {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
  state.setUser(null);
  console.log('[Auth] Sesión cerrada.');
}

// Elimina la cuenta del usuario actual (llama a RPC con SECURITY DEFINER).
// Requiere que exista la función public.delete_own_account() en Supabase.
export async function deleteOwnAccount() {
  const sb = getSupabase();
  if (!sb) throw new Error('Sin conexión con Supabase.');

  const { error } = await sb.rpc('delete_own_account');
  if (error) throw new Error(error.message || 'Error al eliminar la cuenta.');

  // Limpiar estado y sesión local
  state.setUser(null);
  state.setProfile(null);
  sessionStorage.removeItem('mc_session_profile_picked');
  localStorage.removeItem('mc_active_member');
  if (sb) await sb.auth.signOut().catch(() => {});
  console.log('[Auth] Cuenta eliminada y sesión cerrada.');
}
