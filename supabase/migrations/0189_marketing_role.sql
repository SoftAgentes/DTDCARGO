-- 0189_marketing_role.sql
--
-- SDD-0119 · Agrega el 7º rol oficial: `marketing`.
--
-- CONTEXTO: hasta ahora existían 6 roles (SDD-0024): admin, commercial,
-- operations, accounting, warehouse, support. El módulo de Marketing
-- (dashboard "buenos días" + HUB + motor de noticias) debe ser visible SOLO
-- para gente de marketing → se necesita un rol propio.
--
-- TOCA (todos los lugares que hardcodean la lista de roles):
--   1. user_tenants.role            — CHECK constraint
--   2. user_invitations.role        — CHECK constraint (inline)
--   3. studio_invite_user()         — validación inline (última def: 0032)
--   4. studio_change_user_role()    — validación inline (def: 0019)
--   5. service_workflow_steps.owner_role — CHECK (0143, motor de flujo interno)
--
-- IDEMPOTENTE: drop-if-exists + recreate. CREATE OR REPLACE en funciones.

-- ─── 1. user_tenants.role ────────────────────────────────────
alter table public.user_tenants
  drop constraint if exists user_tenants_role_check;
alter table public.user_tenants
  add constraint user_tenants_role_check
  check (role in (
    'admin', 'commercial', 'operations',
    'accounting', 'warehouse', 'support', 'marketing'
  ));
comment on constraint user_tenants_role_check on public.user_tenants is
  'SDD-0119: 7 roles oficiales (marketing agregado a los 6 de SDD-0024).';

-- ─── 2. user_invitations.role ────────────────────────────────
alter table public.user_invitations
  drop constraint if exists user_invitations_role_check;
alter table public.user_invitations
  add constraint user_invitations_role_check
  check (role in (
    'admin', 'commercial', 'operations',
    'accounting', 'warehouse', 'support', 'marketing'
  ));

-- ─── 3. studio_invite_user() — re-def con marketing ──────────
-- Cuerpo idéntico al de 0032 (último fix), solo cambia la lista de roles.
create or replace function public.studio_invite_user(
  p_email text,
  p_role text
)
returns table (invitation_id uuid, token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.get_user_tenant_id();
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_email text := lower(trim(p_email));
  v_token text;
  v_existing record;
begin
  if p_role not in ('admin', 'commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing') then
    raise exception 'Rol inválido: %', p_role using errcode = '22023';
  end if;

  select role into v_actor_role
  from public.user_tenants
  where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null;
  if v_actor_role <> 'admin' then
    raise exception 'Solo admins pueden invitar usuarios' using errcode = '42501';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email inválido: %', v_email using errcode = '22023';
  end if;

  if exists (
    select 1 from public.user_tenants ut
    join auth.users u on u.id = ut.user_id
    where ut.tenant_id = v_tenant_id and lower(u.email) = v_email and ut.disabled_at is null
  ) then
    raise exception 'Ese email ya es miembro activo del tenant' using errcode = '23505';
  end if;

  select * into v_existing
  from public.user_invitations
  where tenant_id = v_tenant_id and email = v_email
    and accepted_at is null and revoked_at is null;
  if v_existing.id is not null then
    return query select v_existing.id, v_existing.token;
    return;
  end if;

  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');

  return query
  insert into public.user_invitations (
    tenant_id, email, role, token, invited_by
  ) values (
    v_tenant_id, v_email, p_role, v_token, v_actor
  )
  returning user_invitations.id, user_invitations.token;
end;
$$;

-- ─── 4. studio_change_user_role() — re-def con marketing ─────
-- Cuerpo idéntico al de 0019, solo cambia la lista de roles.
create or replace function public.studio_change_user_role(
  p_target_user_id uuid,
  p_new_role text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.get_user_tenant_id();
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_target_role text;
  v_admin_count int;
begin
  -- Validar role
  if p_new_role not in ('admin', 'commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing') then
    raise exception 'Rol inválido: %', p_new_role using errcode = '22023';
  end if;

  -- Caller es admin
  select role into v_actor_role
  from public.user_tenants
  where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null;
  if v_actor_role <> 'admin' then
    raise exception 'Solo admins pueden cambiar roles' using errcode = '42501';
  end if;

  -- Target existe en el tenant
  select role into v_target_role
  from public.user_tenants
  where user_id = p_target_user_id and tenant_id = v_tenant_id;
  if v_target_role is null then
    raise exception 'El usuario target no pertenece a este tenant' using errcode = '23503';
  end if;

  -- Anti-lockout: si target es admin y el nuevo rol no es admin,
  -- verificar que no sea el último admin activo del tenant.
  if v_target_role = 'admin' and p_new_role <> 'admin' then
    select count(*) into v_admin_count
    from public.user_tenants
    where tenant_id = v_tenant_id and role = 'admin' and disabled_at is null;
    if v_admin_count <= 1 then
      raise exception 'No se puede degradar al último admin del tenant' using errcode = '23514';
    end if;
  end if;

  update public.user_tenants
  set role = p_new_role
  where user_id = p_target_user_id and tenant_id = v_tenant_id;

  return true;
end;
$$;

-- ─── 5. service_workflow_steps.owner_role (SDD-0091/0143) ────
-- El owner_role del motor de flujo interno reusa los mismos roles.
alter table public.service_workflow_steps
  drop constraint if exists service_workflow_steps_owner_role_chk;
alter table public.service_workflow_steps
  add constraint service_workflow_steps_owner_role_chk
  check (owner_role is null or owner_role in (
    'admin','commercial','operations','accounting','warehouse','support','marketing'
  ));
