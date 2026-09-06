// Servicio de Perfiles Familiares (Estilo Netflix)
import { getSupabase } from './supabase.js';
import { state } from '../state.js';
import { isUserAdmin } from '../config.js';

const LS_ACTIVE_MEMBER = 'mc_active_member';

export function getOwnerDisplayName() {
  const profName = state.profile?.full_name;
  if (profName && profName.trim()) return profName.trim();

  const metaName = state.user?.user_metadata?.full_name;
  if (metaName && metaName.trim()) return metaName.trim();

  if (state.user?.email) {
    const part = state.user.email.split('@')[0];
    return part.charAt(0).toUpperCase() + part.slice(1);
  }
  return 'Principal';
}

export function getActiveFamilyMember() {
  const saved = localStorage.getItem(LS_ACTIVE_MEMBER);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.name) return parsed;
    } catch (e) {}
  }
  const fullName = getOwnerDisplayName();
  return { id: 'owner', name: fullName, avatar: '🥑', role: 'owner', is_owner: true };
}

export function setActiveFamilyMember(member) {
  localStorage.setItem(LS_ACTIVE_MEMBER, JSON.stringify(member));
  state.activeMember = member;
  updateHeaderProfileButton();
}

export function updateHeaderProfileButton() {
  const current = getActiveFamilyMember();
  const btn = document.getElementById('btn-header-profile');
  if (btn) {
    if (current.avatar_url) {
      btn.innerHTML = `<img src="${current.avatar_url}" style="width:28px; height:28px; border-radius:50%; object-fit:cover; border:2px solid var(--primary);">`;
    } else {
      btn.innerHTML = `<span style="font-size:1.3rem; line-height:1;">${current.avatar || '🥑'}</span>`;
    }
  }
}

export async function fetchFamilyMembers() {
  const user = state.user;
  if (!user) return [];

  const ownerName = getOwnerDisplayName();
  const defaultOwner = {
    id: 'owner',
    user_id: user.id,
    name: ownerName,
    avatar: '🥑',
    role: 'owner',
    is_owner: true
  };

  const sb = getSupabase();
  if (!sb) return [defaultOwner];

  try {
    const { data, error } = await sb.from('family_profiles')
      .select('*')
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) {
      return [defaultOwner];
    }

    // Si existe algún perfil, aseguramos que el dueño tenga el nombre correcto
    return data.map(item => ({
      id: item.id,
      user_id: item.owner_user_id,
      name: item.is_owner ? ownerName : item.name,
      avatar: item.avatar_type === 'emoji' ? item.avatar_value : '👤',
      avatar_url: item.avatar_type === 'photo' ? item.avatar_value : null,
      color: item.color,
      is_owner: item.is_owner,
      role: item.is_owner ? 'owner' : 'member'
    }));
  } catch (e) {
    console.warn('[Family] Error consultando perfiles:', e);
    return [defaultOwner];
  }
}

export async function createFamilyMember({ name, avatar = '👤', avatarUrl = null }) {
  const user = state.user;
  if (!user) throw new Error('No autenticado');

  const sb = getSupabase();
  if (!sb) throw new Error('Sin conexión a la base de datos');

  // Si es admin, nos aseguramos que su plan en profiles esté en 'pro' para que Supabase RLS no lo bloquee
  if (isUserAdmin(user)) {
    try {
      await sb.from('profiles').update({ plan: 'pro' }).eq('id', user.id);
    } catch (e) {}
  }

  const avatarType = avatarUrl ? 'photo' : 'emoji';
  const avatarValue = avatarUrl || avatar || '🙂';

  const { data, error } = await sb.from('family_profiles').insert({
    owner_user_id: user.id,
    name: name.trim(),
    avatar_type: avatarType,
    avatar_value: avatarValue,
    color: '#10B981',
    is_owner: false
  }).select().single();

  if (error) {
    if (error.message?.includes('row-level security') || error.code === '42501') {
      throw new Error('Solo los usuarios con Plan Pro pueden añadir perfiles familiares.');
    }
    throw error;
  }

  return {
    id: data.id,
    user_id: data.owner_user_id,
    name: data.name,
    avatar: data.avatar_type === 'emoji' ? data.avatar_value : '👤',
    avatar_url: data.avatar_type === 'photo' ? data.avatar_value : null,
    is_owner: data.is_owner,
    role: 'member'
  };
}

export async function deleteFamilyMember(memberId) {
  const user = state.user;
  const sb = getSupabase();
  if (!sb || !user) return;

  const { error } = await sb.from('family_profiles')
    .delete()
    .eq('id', memberId)
    .eq('owner_user_id', user.id)
    .eq('is_owner', false);

  if (error) throw error;

  const current = getActiveFamilyMember();
  if (current && current.id === memberId) {
    localStorage.removeItem(LS_ACTIVE_MEMBER);
  }
}
