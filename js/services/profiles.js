// Perfiles Familiares estilo Netflix — Solo bajo la cuenta principal (Plan Pro)
// Los "familiares" NO son cuentas de Supabase Auth separadas: comparten la misma
// sesión y el mismo pago, solo cambian nombre + avatar para personalizar la vista.
import { getSupabase } from './supabase.js';
import { state } from '../state.js';

export const MAX_FAMILY_PROFILES = 5; // Incluye el perfil principal del dueño
export const AVATAR_EMOJIS = ['🥑', '😀', '😎', '🧑', '👩', '👨', '👧', '👦', '👵', '👴', '🐱', '🐶', '🦊', '🐼', '⚽', '🎮'];

export async function fetchFamilyProfiles() {
  const sb = getSupabase();
  if (!sb || !state.user) return [];

  const { data, error } = await sb.from('family_profiles')
    .select('*')
    .eq('owner_user_id', state.user.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error al consultar family_profiles:', error);
    return [];
  }
  return data || [];
}

// Garantiza que exista el perfil principal (el del dueño de la cuenta que paga).
// Se llama de forma segura en cada inicio de sesión; si ya existe, no hace nada.
export async function ensureOwnerProfile() {
  const sb = getSupabase();
  if (!sb || !state.user) return null;

  const { data: existing, error: findErr } = await sb.from('family_profiles')
    .select('*')
    .eq('owner_user_id', state.user.id)
    .eq('is_owner', true)
    .maybeSingle();

  if (findErr) {
    console.warn('No se pudo verificar el perfil principal:', findErr);
  }
  if (existing) return existing;

  const fullName = state.user.user_metadata?.full_name || 'Yo';
  const { data, error } = await sb.from('family_profiles').insert({
    owner_user_id: state.user.id,
    name: fullName,
    avatar_type: 'emoji',
    avatar_value: '🥑',
    is_owner: true
  }).select().single();

  if (error) {
    console.warn('No se pudo crear el perfil principal:', error);
    return null;
  }
  return data;
}

export async function createFamilyProfile({ name, avatarType = 'emoji', avatarValue = '🙂', color = '#10B981' }) {
  const sb = getSupabase();
  if (!sb || !state.user) throw new Error('No autenticado');
  if (!name || !name.trim()) throw new Error('Ponle un nombre al perfil.');

  const current = await fetchFamilyProfiles();
  if (current.length >= MAX_FAMILY_PROFILES) {
    throw new Error(`Solo puedes tener hasta ${MAX_FAMILY_PROFILES} perfiles familiares.`);
  }

  const { data, error } = await sb.from('family_profiles').insert({
    owner_user_id: state.user.id,
    name: name.trim(),
    avatar_type: avatarType,
    avatar_value: avatarValue,
    color,
    is_owner: false
  }).select().single();

  if (error) {
    if (error.message?.includes('row-level security') || error.code === '42501') {
      throw new Error('Añadir familiares es una función del Plan Pro. Actualiza tu plan en Ajustes.');
    }
    throw error;
  }
  return data;
}

export async function updateFamilyProfile({ id, name, avatarType, avatarValue, color }) {
  const sb = getSupabase();
  if (!sb || !state.user) throw new Error('No autenticado');

  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (avatarType !== undefined) updates.avatar_type = avatarType;
  if (avatarValue !== undefined) updates.avatar_value = avatarValue;
  if (color !== undefined) updates.color = color;

  const { data, error } = await sb.from('family_profiles')
    .update(updates)
    .eq('id', id)
    .eq('owner_user_id', state.user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteFamilyProfile(id) {
  const sb = getSupabase();
  if (!sb || !state.user) throw new Error('No autenticado');

  const { error } = await sb.from('family_profiles')
    .delete()
    .eq('id', id)
    .eq('owner_user_id', state.user.id)
    .eq('is_owner', false); // el perfil principal nunca se borra

  if (error) throw error;
}

// Sube una foto de perfil real a Supabase Storage (bucket "avatars") y devuelve la URL pública.
export async function uploadProfileAvatar(file, profileId) {
  const sb = getSupabase();
  if (!sb || !state.user) throw new Error('No autenticado');

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${state.user.id}/${profileId}-${Date.now()}.${ext}`;

  const { error } = await sb.storage.from('avatars').upload(path, file, {
    cacheControl: '3600',
    upsert: true
  });
  if (error) throw error;

  const { data } = sb.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}
