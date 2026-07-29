\set ON_ERROR_STOP on

begin;

create schema supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key,
  name text not null,
  statements text[] not null
);

insert into supabase_migrations.schema_migrations (version, name, statements)
values
  (
    '20260528060007',
    '0031_fix_studio_invite_gen_random_bytes',
    array[$sdd0118_followup_source_0$-- 0031_fix_studio_invite_gen_random_bytes.sql
--
-- Fix bug: studio_invite_user falla con "function gen_random_bytes(integer)
-- does not exist" porque set search_path=public restringe la búsqueda y
-- gen_random_bytes vive en schema extensions (no public).
--
-- Detectado 2026-05-26 al testear el flow de invitación post-setup Resend.
-- Fix: hardcode extensions.gen_random_bytes(24).
--
-- No cambia signature ni comportamiento, solo arregla el qualifier.

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
  -- Validar role
  if p_role not in ('admin', 'commercial', 'operations', 'accounting', 'warehouse', 'support') then
    raise exception 'Rol inválido: %', p_role using errcode = '22023';
  end if;

  -- Validar caller es admin del tenant
  select role into v_actor_role
  from public.user_tenants
  where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null;
  if v_actor_role <> 'admin' then
    raise exception 'Solo admins pueden invitar usuarios' using errcode = '42501';
  end if;

  -- Email válido (simple check)
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email inválido: %', v_email using errcode = '22023';
  end if;

  -- ¿Ya es miembro activo?
  if exists (
    select 1 from public.user_tenants ut
    join auth.users u on u.id = ut.user_id
    where ut.tenant_id = v_tenant_id and lower(u.email) = v_email and ut.disabled_at is null
  ) then
    raise exception 'Ese email ya es miembro activo del tenant' using errcode = '23505';
  end if;

  -- ¿Hay invitation pendiente? → devolver la existente
  select * into v_existing
  from public.user_invitations
  where tenant_id = v_tenant_id and email = v_email
    and accepted_at is null and revoked_at is null;
  if v_existing.id is not null then
    return query select v_existing.id, v_existing.token;
    return;
  end if;

  -- Generar token 32 chars url-safe (base64 sin padding sobre 24 bytes random).
  -- FIX 0031: extensions.gen_random_bytes (no public, search_path=public lo excluye).
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');

  -- Insert invitation
  return query
  insert into public.user_invitations (
    tenant_id, email, role, token, invited_by
  ) values (
    v_tenant_id, v_email, p_role, v_token, v_actor
  )
  returning id, token;
end;
$$;

comment on function public.studio_invite_user is
  'Solo admins. Crea invitation o devuelve la existente si ya hay pending. Token 32 chars url-safe, expira en 7 días.';
$sdd0118_followup_source_0$]
  ),
  (
    '20260528060008',
    '0032_fix_studio_invite_ambiguous_token',
    array[$sdd0118_followup_source_1$-- 0032_fix_studio_invite_ambiguous_token.sql
--
-- Fix bug: studio_invite_user falla con "column reference 'token' is ambiguous"
-- porque el RETURNS TABLE (invitation_id uuid, token text) declara una OUTPUT
-- column llamada `token` que clashea con la columna real
-- public.user_invitations.token en el RETURNING.
--
-- Detectado 2026-05-26 inmediatamente después de aplicar 0031 (gen_random_bytes
-- qualifier fix). Cuando se hizo el primer test real de invitación.
--
-- Fix: qualificar user_invitations.token en el RETURNING.

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
  if p_role not in ('admin', 'commercial', 'operations', 'accounting', 'warehouse', 'support') then
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

  -- gen_random_bytes vive en schema extensions (fix 0031)
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');

  -- FIX 0032: qualificar user_invitations.token en RETURNING porque
  -- el RETURNS TABLE declara una output column 'token' que clashea.
  return query
  insert into public.user_invitations (
    tenant_id, email, role, token, invited_by
  ) values (
    v_tenant_id, v_email, p_role, v_token, v_actor
  )
  returning user_invitations.id, user_invitations.token;
end;
$$;

comment on function public.studio_invite_user is
  'Solo admins. Crea invitation o devuelve la existente si ya hay pending. Token 32 chars url-safe, expira en 7 días.';
$sdd0118_followup_source_1$]
  );

\ir ../migrations/0272_skip_superseded_invite_history.sql
\ir ../migrations/0272_skip_superseded_invite_history.sql

do $contract$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060007'
      and name = '0031_fix_studio_invite_gen_random_bytes'
      and cardinality(statements) = 1
      and md5(statements[1]) = '9e4dc98716f8335c93e9961ccdf18fbe'
  ) then
    raise exception 'TEST 0272: estado incorrecto en 20260528060007';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060008'
      and name = '0032_fix_studio_invite_ambiguous_token'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'accd69afa043efc46960c8de5faa7c34'
  ) then
    raise exception 'TEST 0272: estado incorrecto en 20260528060008';
  end if;
end
$contract$;

rollback;

select to_regnamespace('supabase_migrations') is null
  as sdd_0118_followup_fixture_rolled_back;
