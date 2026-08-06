-- SDD-0235 · perfiles del staff solo propios o de un tenant compartido activo.
set lock_timeout = '5s';
set statement_timeout = '30s';

drop policy if exists "user_profiles_all_select" on public.user_profiles;
create policy "user_profiles_all_select"
on public.user_profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.user_tenants caller_membership
    join public.user_tenants profile_membership
      on profile_membership.tenant_id = caller_membership.tenant_id
     and profile_membership.user_id = user_profiles.user_id
     and profile_membership.disabled_at is null
    where caller_membership.user_id = (select auth.uid())
      and caller_membership.disabled_at is null
  )
);

comment on policy "user_profiles_all_select" on public.user_profiles is
  'SDD-0235: fila propia o perfil con membresía activa en un tenant compartido.';
