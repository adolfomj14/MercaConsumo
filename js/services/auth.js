// Autenticación con Supabase Auth
import { getSupabase } from './supabase.js';
import { state } from '../state.js';

const LOCAL_STORAGE_DEMO_USER = 'mc_demo_user';

export async function getCurrentUser() {
  const sb = getSupabase();
  if (sb) {
    const { data: { session }, error } = await sb.auth.getSession();
    if (session && session.user) {
      state.setUser(session.user);
      return session.user;
    }
  }

  // Modo Local / Demo
  const demoUser = localStorage.getItem(LOCAL_STORAGE_DEMO_USER);
  if (demoUser) {
    const user = JSON.parse(demoUser);
    state.setUser(user);
    return user;
  }

  state.setUser(null);
  return null;
}

export async function signIn(email, password) {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    state.setUser(data.user);
    return data.user;
  }

  // Fallback Local
  const mockUser = {
    id: 'local-user-id-001',
    email: email || 'usuario@mercaconsumo.app',
    user_metadata: { full_name: email.split('@')[0] }
  };
  localStorage.setItem(LOCAL_STORAGE_DEMO_USER, JSON.stringify(mockUser));
  state.setUser(mockUser);
  return mockUser;
}

export async function signUp(email, password, fullName) {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });
    if (error) throw error;
    if (data.user) state.setUser(data.user);
    return data.user;
  }

  // Fallback Local
  const mockUser = {
    id: 'local-user-id-001',
    email,
    user_metadata: { full_name: fullName || email.split('@')[0] }
  };
  localStorage.setItem(LOCAL_STORAGE_DEMO_USER, JSON.stringify(mockUser));
  state.setUser(mockUser);
  return mockUser;
}

export async function signOut() {
  const sb = getSupabase();
  if (sb) {
    await sb.auth.signOut();
  }
  localStorage.removeItem(LOCAL_STORAGE_DEMO_USER);
  state.setUser(null);
}
