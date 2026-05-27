-- 0036_fk_user_tenants_profile.sql
--
-- Fix bug: /studio/usuarios devolvía HTTP 400 al consumir
-- `user_tenants?select=...,profile:user_profiles(*)`.
--
-- Causa: PostgREST requiere FK declarada para resolver embed
-- `profile:user_profiles(*)`. La tabla user_tenants NO tenía
-- FK a user_profiles (solo a tenants), aunque user_tenants.user_id
-- y user_profiles.user_id son siempre el mismo uuid de auth.users.
--
-- Fix: agregar FK explícita. user_profiles.user_id ya es PK,
-- así que el target es válido. ON DELETE CASCADE matchea el
-- comportamiento de user_profiles → auth.users.
--
-- Detectado 2026-05-26 al revisar logs API durante audit post-Resend.

alter table public.user_tenants
  add constraint user_tenants_user_id_profile_fkey
  foreign key (user_id) references public.user_profiles(user_id)
  on delete cascade;

-- Refresh PostgREST schema cache para que reconozca la FK nueva inmediato
notify pgrst, 'reload schema';
