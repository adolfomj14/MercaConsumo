-- ═══════════════════════════════════════════════════════════════════════
-- MercaConsumo — Migración: Perfiles Familiares estilo Netflix (Plan Pro)
-- Ejecutar completo en: Supabase Dashboard > SQL Editor > New Query
-- ═══════════════════════════════════════════════════════════════════════

-- 1) Tabla de perfiles familiares
-- Cada fila es un "perfil" (como en Netflix). Todos pertenecen a la cuenta
-- que paga (owner_user_id). No son cuentas de Supabase Auth separadas:
-- comparten la misma sesión/pago, solo cambian nombre + avatar visual.
create table if not exists public.family_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  avatar_type text not null default 'emoji' check (avatar_type in ('emoji', 'photo')),
  avatar_value text not null default '🙂',
  color text default '#10B981',
  is_owner boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_family_profiles_owner on public.family_profiles(owner_user_id);

alter table public.family_profiles enable row level security;

-- Lectura, actualización y borrado: solo el dueño de la cuenta ve/gestiona sus propios perfiles
drop policy if exists "family_profiles_select_own" on public.family_profiles;
create policy "family_profiles_select_own"
  on public.family_profiles for select
  using (owner_user_id = auth.uid());

drop policy if exists "family_profiles_update_own" on public.family_profiles;
create policy "family_profiles_update_own"
  on public.family_profiles for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "family_profiles_delete_own" on public.family_profiles;
create policy "family_profiles_delete_own"
  on public.family_profiles for delete
  using (owner_user_id = auth.uid() and is_owner = false); -- el perfil principal (is_owner=true) nunca se borra

-- 2) Función auxiliar: ¿el dueño tiene plan Pro?
-- Se apoya en tu tabla existente "profiles" (id = auth.uid(), columna "plan").
create or replace function public.is_owner_pro(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select plan = 'pro' from public.profiles where id = uid), false);
$$;

-- 3) Inserción:
--   a) el perfil principal (is_owner = true) siempre se puede crear (representa al dueño)
--   b) perfiles familiares adicionales (is_owner = false) SOLO si el dueño es Plan Pro
drop policy if exists "family_profiles_insert_owner_self" on public.family_profiles;
create policy "family_profiles_insert_owner_self"
  on public.family_profiles for insert
  with check (owner_user_id = auth.uid() and is_owner = true);

drop policy if exists "family_profiles_insert_pro_only" on public.family_profiles;
create policy "family_profiles_insert_pro_only"
  on public.family_profiles for insert
  with check (
    owner_user_id = auth.uid()
    and is_owner = false
    and public.is_owner_pro(auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 4) Storage: bucket público para fotos de perfil
-- ═══════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Lectura pública (para poder mostrar las fotos sin firmar URLs)
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Solo el dueño autenticado puede subir/actualizar/borrar dentro de su propia carpeta
-- (la app sube los archivos como: avatars/<user_id>/<archivo>)
drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ═══════════════════════════════════════════════════════════════════════
-- Listo. Después de correr esto, cada usuario Pro podrá crear hasta
-- MAX_FAMILY_PROFILES (definido en services/profiles.js) perfiles.
-- ═══════════════════════════════════════════════════════════════════════
