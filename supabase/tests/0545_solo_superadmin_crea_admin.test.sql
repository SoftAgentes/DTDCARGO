\set ON_ERROR_STOP on

-- SDD-0636 · contrato de la 0545 (política de roles: solo el superadministrador
-- crea o reactiva administradores).
--
-- Arma:
--   · is_platform_admin() con el cuerpo de la 0058 y el ACL que deja la 0542;
--   · user_invitations, user_tenants, user_profiles, platform_admins y
--     user_role_audit con las columnas que usan las funciones copiadas;
--   · COPIAS LITERALES (el envoltorio de Vitest comprueba que siguen iguales):
--     studio_invite_user (0203), studio_accept_invitation (0352),
--     studio_set_user_disabled y studio_change_user_role (0355),
--     audit_user_tenants_changes (0202) con su disparador de la 0201, la guarda
--     audit_d1_admin_tenant (0289) y las ramas membership.invite y
--     membership.role_change de audit_d1_execute (0289);
--   · un doble de audit_d1_execute con la FIRMA real, DEFINER y concedido a
--     authenticated como en la 0289;
-- y aplica la 0545 REAL dos veces, y después su desarme.
--
-- Lo que defiende:
--   (0) antes de la 0545, un admin que no es superadmin invita admins por los
--       dos caminos (audit_d1_execute y la rpc), y esa invitación se acepta;
--   (a) invitar: el admin recibe 42501 al invitar como admin, también al
--       re-invitar como admin una invitación pendiente; sigue invitando los
--       demás roles por audit_d1_execute; la rpc directa ya no la ejecuta
--       authenticated; el superadmin invita admins;
--   (b) aceptar: la invitación de admin de un superadmin se acepta y el alta
--       queda en user_role_audit; una de admin que no emitió un superadmin se
--       niega; las de otros roles se aceptan;
--   (c) reactivar a un admin suspendido: ni aceptando una invitación ni por
--       ningún otro camino sin el superadmin; el superadmin lo reactiva por
--       studio_set_user_disabled; un comercial suspendido sí vuelve;
--   (d) cambiar el rol a admin: solo el superadmin, también por el dueño;
--   (e) la sesión se detecta por los claims: anon nunca, authenticated sin sub
--       y un sub sin rol se niegan; service_role, sin claims y '{}' pasan; un
--       JSON inválido falla cerrado;
--   (f) ENABLE ALWAYS: el modo réplica no se lo salta;
--   (g) las funciones nuevas no se conceden a nadie; el ACL de las demás no
--       cambia salvo lo dicho de studio_invite_user;
--   (h) lo que no crea ni reactiva admins no se frena (revocar, suspender, la
--       oficina de un admin);
--   (i) es idempotente;
--   (j) el desarme deja todo como antes.
--
-- CONTROL ROJO: sin la 0545 cae «(a)».
-- Termina siempre en ROLLBACK. Solo ids y correos sintéticos.
begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
-- Como el auth.uid() de Supabase: el sub de request.jwt.claim.sub o de request.jwt.claims.
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select coalesce(
  nullif(current_setting('request.jwt.claim.sub', true), ''),
  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
)::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text);

-- Lo único de pgcrypto que usa studio_invite_user (0031).
create schema extensions;
create function extensions.gen_random_bytes(p_n integer) returns bytea language sql volatile as $$
  select substring(decode(md5(random()::text) || md5(random()::text), 'hex') from 1 for p_n)
$$;

create type public.user_region as enum ('ve', 'cn');
create table public.tenants (id uuid primary key);
create table public.user_profiles (
  user_id uuid primary key references auth.users(id),
  first_name text,
  last_name text,
  updated_at timestamptz not null default now()
);
create table public.user_tenants (
  user_id uuid not null references auth.users(id),
  tenant_id uuid not null references public.tenants(id),
  role text not null,
  region public.user_region not null default 've',
  warehouse_scope text not null default 'all',
  invited_by uuid references auth.users(id),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, tenant_id)
);
grant select on public.user_tenants to authenticated;
create table public.user_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  email text not null check (email = lower(email)),
  role text not null,
  region public.user_region not null default 've',
  token text not null unique,
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index user_invitations_pending_uniq
  on public.user_invitations (tenant_id, email)
  where accepted_at is null and revoked_at is null;
grant select on public.user_invitations to authenticated;
-- Como la 0033: service_role escribe las dos tablas.
grant all on public.user_invitations, public.user_tenants to service_role;
create table public.user_role_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  actor_user_id uuid,
  target_user_id uuid not null,
  action text not null check (action in ('role_change', 'disable', 'enable', 'scope_change')),
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

-- Copia de 0453.
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1]
  from public.user_tenants as ut
  where ut.user_id = (select auth.uid())
    and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;
grant execute on function public.get_user_tenant_id() to authenticated;

-- Forma de la 0058, con el ACL que deja la 0542.
create table public.platform_admins (user_id uuid primary key references auth.users(id));
alter table public.platform_admins enable row level security;
create function public.is_platform_admin()
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = (select auth.uid())
  );
$$;
revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated, service_role;

-- Copia LITERAL de la 0202 (la última definición) y el disparador de la 0201.
create or replace function public.audit_user_tenants_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    insert into public.user_role_audit
      (tenant_id, actor_user_id, target_user_id, action, old_value, new_value)
    values
      (new.tenant_id, auth.uid(), new.user_id, 'role_change', old.role, new.role);
  end if;

  if old.disabled_at is null and new.disabled_at is not null then
    insert into public.user_role_audit
      (tenant_id, actor_user_id, target_user_id, action, old_value, new_value)
    values
      (new.tenant_id, auth.uid(), new.user_id, 'disable', new.role, new.role);
  elsif old.disabled_at is not null and new.disabled_at is null then
    insert into public.user_role_audit
      (tenant_id, actor_user_id, target_user_id, action, old_value, new_value)
    values
      (new.tenant_id, auth.uid(), new.user_id, 'enable', new.role, new.role);
  end if;

  if new.warehouse_scope is distinct from old.warehouse_scope then
    insert into public.user_role_audit
      (tenant_id, actor_user_id, target_user_id, action, old_value, new_value)
    values
      (new.tenant_id, auth.uid(), new.user_id, 'scope_change', old.warehouse_scope, new.warehouse_scope);
  end if;

  return new;
end;
$$;
revoke all on function public.audit_user_tenants_changes() from public, anon, authenticated;
create trigger user_tenants_audit
  after update on public.user_tenants
  for each row
  execute function public.audit_user_tenants_changes();

-- Copia LITERAL de la 0203, con su ACL.
create or replace function public.studio_invite_user(
  p_email text,
  p_role text,
  p_region text default 've'
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
  v_region public.user_region;
  v_token text;
  v_existing_id uuid;
  v_existing_token text;
begin
  if v_actor is null then
    raise exception 'Necesitas estar autenticado' using errcode = '42501';
  end if;
  if v_tenant_id is null then
    raise exception 'No tienes un tenant asignado' using errcode = '42501';
  end if;

  if p_role not in ('admin','commercial','operations','accounting','warehouse','support','marketing') then
    raise exception 'Rol inválido: %', p_role using errcode = '22023';
  end if;

  -- Region con default 've' si viene NULL o inválida
  if p_region is null or p_region not in ('ve','cn') then
    v_region := 've';
  else
    v_region := p_region::public.user_region;
  end if;

  select ut.role into v_actor_role
  from public.user_tenants ut
  where ut.user_id = v_actor and ut.tenant_id = v_tenant_id and ut.disabled_at is null;
  if v_actor_role is null or v_actor_role <> 'admin' then
    raise exception 'Solo los admins pueden invitar usuarios' using errcode = '42501';
  end if;

  if v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email inválido: %', v_email using errcode = '22023';
  end if;

  if exists (
    select 1 from public.user_tenants ut
    join auth.users u on u.id = ut.user_id
    where ut.tenant_id = v_tenant_id and lower(u.email) = v_email and ut.disabled_at is null
  ) then
    raise exception 'Ese email ya es miembro activo del tenant' using errcode = '23505';
  end if;

  -- Invitación pending existente → actualizar rol+oficina y devolverla.
  -- Refs calificadas (ui.*) + vars escalares: las OUT columns
  -- invitation_id/token no pueden chocar (la herida de 0032 y de prod).
  select ui.id, ui.token into v_existing_id, v_existing_token
  from public.user_invitations ui
  where ui.tenant_id = v_tenant_id and ui.email = v_email
    and ui.accepted_at is null and ui.revoked_at is null
  limit 1;

  if v_existing_id is not null then
    update public.user_invitations
       set role = p_role, region = v_region
     where id = v_existing_id;
    return query select v_existing_id, v_existing_token;
    return;
  end if;

  -- gen_random_bytes vive en schema extensions (fix 0031)
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');

  -- RETURNING calificado — la OUT column `token` clashea si no (fix 0032)
  return query
  insert into public.user_invitations (
    tenant_id, email, role, region, token, invited_by
  ) values (
    v_tenant_id, v_email, p_role, v_region, v_token, v_actor
  )
  returning user_invitations.id, user_invitations.token;
end;
$$;
revoke execute on function public.studio_invite_user(text, text, text) from public, anon;
grant execute on function public.studio_invite_user(text, text, text) to authenticated, service_role;

-- Copia LITERAL de la 0352, con su ACL.
create or replace function public.studio_accept_invitation(
  p_token text,
  p_first_name text default null,
  p_last_name text default null
)
returns table (user_id uuid, tenant_id uuid, role text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_actor uuid := auth.uid();
  v_actor_email text;
  v_inv record;
begin
  if v_actor is null then
    raise exception 'Necesitas estar autenticado para aceptar la invitación' using errcode = '42501';
  end if;

  select * into v_inv
  from public.user_invitations
  where token = p_token;

  if v_inv.id is null then
    raise exception 'Token de invitación inválido' using errcode = '22023';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'Esta invitación ya fue aceptada' using errcode = '23505';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'Esta invitación fue revocada' using errcode = '23505';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'Esta invitación expiró' using errcode = '23505';
  end if;

  if v_inv.invited_by = v_actor then
    raise exception 'No puedes aceptar una invitación que tú mismo creaste' using errcode = '42501';
  end if;

  -- ── SDD-0251: la invitación es NOMINAL ────────────────────────────────
  -- El token demuestra que tienes el link, no que seas el invitado. Sin este
  -- chequeo el link ES la credencial.
  select lower(u.email) into v_actor_email
  from auth.users u
  where u.id = v_actor;

  if v_actor_email is null
     or v_actor_email is distinct from lower(trim(coalesce(v_inv.email, ''))) then
    raise exception 'Esta invitación fue emitida para otro correo'
      using errcode = '42501';
  end if;

  insert into public.user_profiles (user_id, first_name, last_name)
  values (v_actor, p_first_name, p_last_name)
  on conflict (user_id) do update
  set first_name = coalesce(excluded.first_name, public.user_profiles.first_name),
      last_name  = coalesce(excluded.last_name,  public.user_profiles.last_name),
      updated_at = now();

  -- Se conserva el fix 0203: propagar la region de la invitación.
  insert into public.user_tenants (user_id, tenant_id, role, region, invited_by)
  values (v_actor, v_inv.tenant_id, v_inv.role, v_inv.region, v_inv.invited_by)
  on conflict (user_id, tenant_id) do update
  set role        = v_inv.role,
      region      = v_inv.region,
      disabled_at = null,
      invited_by  = v_inv.invited_by;

  update public.user_invitations
  set accepted_at = now(), accepted_by = v_actor
  where id = v_inv.id;

  return query select v_actor, v_inv.tenant_id, v_inv.role;
end;
$$;
revoke execute on function public.studio_accept_invitation(text, text, text) from public, anon;
grant execute on function public.studio_accept_invitation(text, text, text) to authenticated;

-- Copias LITERALES de la 0355, con el ACL de la 0019 y la 0200.
create or replace function public.studio_set_user_disabled(
  p_target_user_id uuid,
  p_disabled boolean
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid := public.get_user_tenant_id();
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_target_role text;
  v_target_disabled_at timestamptz;
  v_other_active_admins int;
begin
  if v_tenant_id is null then
    raise exception 'Sin membership activo' using errcode = '42501';
  end if;

  select role into v_actor_role
  from public.user_tenants
  where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null;
  if v_actor_role is distinct from 'admin' then
    raise exception 'Solo admins pueden activar/desactivar usuarios' using errcode = '42501';
  end if;

  select role, disabled_at into v_target_role, v_target_disabled_at
  from public.user_tenants
  where user_id = p_target_user_id and tenant_id = v_tenant_id;
  if v_target_role is null then
    raise exception 'El usuario target no pertenece a este tenant' using errcode = '23503';
  end if;

  -- ─── 0355 · un admin no toca a OTRO admin ───
  if v_target_role = 'admin'
     and p_target_user_id <> v_actor
     and not public.is_platform_admin() then
    raise exception 'Solo el superadministrador puede suspender a otro administrador'
      using errcode = '42501';
  end if;

  -- Anti-lockout (0200): no desactivar al último admin activo del tenant.
  if p_disabled and v_target_role = 'admin' and v_target_disabled_at is null then
    perform pg_advisory_xact_lock(hashtextextended('user_tenants_admins:' || v_tenant_id::text, 42));
    select count(*) into v_other_active_admins
    from public.user_tenants
    where tenant_id = v_tenant_id
      and role = 'admin'
      and disabled_at is null
      and user_id <> p_target_user_id;
    if v_other_active_admins = 0 then
      raise exception 'No se puede desactivar al último admin del tenant' using errcode = '23514';
    end if;
  end if;

  update public.user_tenants
  set disabled_at = case when p_disabled then coalesce(disabled_at, now()) else null end
  where user_id = p_target_user_id and tenant_id = v_tenant_id;

  return true;
end;
$function$;
create or replace function public.studio_change_user_role(
  p_target_user_id uuid,
  p_new_role text
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid := public.get_user_tenant_id();
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_target_role text;
  v_target_disabled_at timestamptz;
  v_admin_count int;
begin
  if p_new_role not in ('admin', 'commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing') then
    raise exception 'Rol inválido: %', p_new_role using errcode = '22023';
  end if;

  select role into v_actor_role
  from public.user_tenants
  where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null;
  if v_actor_role <> 'admin' then
    raise exception 'Solo admins pueden cambiar roles' using errcode = '42501';
  end if;

  select role, disabled_at into v_target_role, v_target_disabled_at
  from public.user_tenants
  where user_id = p_target_user_id and tenant_id = v_tenant_id;
  if v_target_role is null then
    raise exception 'El usuario target no pertenece a este tenant' using errcode = '23503';
  end if;

  -- ─── 0355 · un admin no toca a OTRO admin ───
  -- Cubre los dos sentidos: degradar a un admin existente Y ascender a alguien
  -- a admin. Sin la segunda mitad, cualquier admin podría fabricarse aliados.
  if (v_target_role = 'admin' or p_new_role = 'admin')
     and p_target_user_id <> v_actor
     and not public.is_platform_admin() then
    raise exception 'Solo el superadministrador puede cambiar el rol de un administrador'
      using errcode = '42501';
  end if;

  -- Anti-lockout (0200): no degradar al último admin activo.
  if v_target_role = 'admin' and p_new_role <> 'admin' and v_target_disabled_at is null then
    perform pg_advisory_xact_lock(hashtextextended('user_tenants_admins:' || v_tenant_id::text, 42));
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
$function$;
revoke execute on function public.studio_set_user_disabled(uuid, boolean) from public, anon;
grant execute on function public.studio_set_user_disabled(uuid, boolean) to authenticated;
revoke execute on function public.studio_change_user_role(uuid, text) from public, anon;
grant execute on function public.studio_change_user_role(uuid, text) to authenticated;

-- Copia LITERAL de la guarda de la 0289.
create function public.audit_d1_admin_tenant()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_tenant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select ut.tenant_id
    into v_tenant_id
  from public.user_tenants ut
  where ut.user_id = auth.uid()
    and ut.role = 'admin'
    and ut.disabled_at is null
  order by ut.created_at
  limit 1;

  if v_tenant_id is null then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  return v_tenant_id;
end;
$function$;
revoke all on function public.audit_d1_admin_tenant() from public, anon, authenticated, service_role;

-- Doble de audit_d1_execute: la firma real y las ramas membership.invite y
-- membership.role_change LITERALES de la 0289. Las otras ramas no se copian.
create function public.audit_d1_execute(
  p_operation_id uuid,
  p_operation_type text,
  p_target_id uuid default null,
  p_input jsonb default '{}'::jsonb,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant_id uuid := public.audit_d1_admin_tenant();
  v_actor_id uuid := auth.uid();
  v_invitation record;
  v_existing record;
  v_entity_type text;
  v_entity_id uuid;
  v_event_type text;
  v_before jsonb;
  v_after jsonb;
  v_result jsonb := '{}'::jsonb;
begin
  case p_operation_type
    when 'membership.invite' then
      select *
        into v_invitation
      from public.studio_invite_user(
        p_input ->> 'email',
        p_input ->> 'role',
        coalesce(p_input ->> 'region', 've')
      );
      v_entity_type := 'membership';
      v_entity_id := v_invitation.invitation_id;
      v_event_type := 'membership_invited';
      v_after := pg_catalog.jsonb_build_object(
        'role', p_input ->> 'role',
        'region', coalesce(p_input ->> 'region', 've')
      );
      v_result := pg_catalog.jsonb_build_object(
        'entity_id', v_entity_id,
        'invitation_id', v_entity_id
      );

    when 'membership.role_change' then
      select ut.role
        into v_existing
      from public.user_tenants ut
      where ut.tenant_id = v_tenant_id
        and ut.user_id = p_target_id
      for update;
      if not found then
        raise exception 'invalid_state' using errcode = 'P0002';
      end if;
      perform public.studio_change_user_role(
        p_target_id,
        p_input ->> 'role'
      );
      v_entity_type := 'membership';
      v_entity_id := p_target_id;
      v_event_type := 'membership_role_changed';
      v_before := pg_catalog.jsonb_build_object('role', v_existing.role);
      v_after := pg_catalog.jsonb_build_object('role', p_input ->> 'role');
      v_result := pg_catalog.jsonb_build_object('entity_id', p_target_id);
  end case;
  return v_result;
end;
$function$;
revoke all on function public.audit_d1_execute(uuid,text,uuid,jsonb,text) from public, anon;
grant execute on function public.audit_d1_execute(uuid,text,uuid,jsonb,text) to authenticated;

-- ── Fixture ─────────────────────────────────────────────────────────────
-- T1 = 1…1. a1 admin (no es superadmin) · a2 admin y superadmin · b1 comercial ·
-- d1 admin suspendido · c1 comercial suspendido · n1, n2, n3, n4 sin membresía.
insert into public.tenants values ('11111111-1111-1111-1111-111111111111');
insert into auth.users
select ('a0000000-0000-0000-0000-0000000000' || u)::uuid, u || '@prueba.test'
from unnest(array['a1', 'a2', 'b1', 'd1', 'c1', 'e1', 'e2', 'e3', 'e4']) as u;
insert into public.user_profiles (user_id) select id from auth.users;
insert into public.user_tenants (user_id, tenant_id, role, disabled_at) values
  ('a0000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'admin', null),
  ('a0000000-0000-0000-0000-0000000000a2', '11111111-1111-1111-1111-111111111111', 'admin', null),
  ('a0000000-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111', 'commercial', null),
  ('a0000000-0000-0000-0000-0000000000d1', '11111111-1111-1111-1111-111111111111', 'admin', now()),
  ('a0000000-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'commercial', now());
insert into public.platform_admins values ('a0000000-0000-0000-0000-0000000000a2');

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0545: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

create function pg_temp.u(p_user text) returns uuid language sql immutable as $$
  select ('a0000000-0000-0000-0000-0000000000' || p_user)::uuid;
$$;
create function pg_temp.correo(p_user text) returns text language sql immutable as $$
  select p_user || '@prueba.test';
$$;

/** Claims como los deja PostgREST: 'json', 'antigua' o 'ninguna'. p_user null = sin sub. */
create function pg_temp.jwt(p_rol text, p_user text, p_forma text default 'json') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  if p_forma = 'json' then
    perform set_config('request.jwt.claims',
      jsonb_strip_nulls(jsonb_build_object('role', p_rol, 'sub', pg_temp.u(p_user)))::text, true);
  elsif p_forma = 'antigua' then
    perform set_config('request.jwt.claim.role', coalesce(p_rol, ''), true);
    perform set_config('request.jwt.claim.sub', coalesce(pg_temp.u(p_user)::text, ''), true);
  end if;
end;
$$;

/**
 * Ejecuta p_sql con esos claims, como el rol de base p_como (null = el dueño,
 * como dentro de un DEFINER o una migración). Devuelve 'ok', las filas si es
 * un UPDATE o un INSERT, o 'ERROR <sqlstate>: <mensaje>'.
 */
create function pg_temp.como(p_claim_rol text, p_user text, p_como text, p_sql text, p_forma text default 'json')
returns text language plpgsql as $$
declare v text; n int;
begin
  perform pg_temp.jwt(p_claim_rol, p_user, p_forma);
  if p_como is not null then execute format('set local role %I', p_como); end if;
  begin
    execute p_sql;
    get diagnostics n = row_count;
    v := case when p_sql ~* '^\s*(update|insert)' then n::text else 'ok' end;
  exception when others then
    v := 'ERROR ' || sqlstate || ': ' || sqlerrm;
  end;
  reset role;
  perform pg_temp.jwt(null, null, 'ninguna');
  return v;
end;
$$;

/** Invitar por audit_d1_execute (el camino de la pantalla). */
create function pg_temp.d1_invita(p_user text, p_invitado text, p_rol text, p_forma text default 'json') returns text language sql as $$
  select pg_temp.como('authenticated', p_user, 'authenticated', format(
    $q$select public.audit_d1_execute(gen_random_uuid(), 'membership.invite', null, %L::jsonb, null)$q$,
    jsonb_build_object('email', pg_temp.correo(p_invitado), 'role', p_rol)::text), p_forma);
$$;

/** Invitar por la rpc studio_invite_user, directo con la sesión. */
create function pg_temp.rpc_invita(p_user text, p_invitado text, p_rol text) returns text language sql as $$
  select pg_temp.como('authenticated', p_user, 'authenticated', format(
    $q$select public.studio_invite_user(%L, %L, 've')$q$, pg_temp.correo(p_invitado), p_rol));
$$;

/** Cambiar el rol por audit_d1_execute. */
create function pg_temp.d1_rol(p_user text, p_target text, p_rol text) returns text language sql as $$
  select pg_temp.como('authenticated', p_user, 'authenticated', format(
    $q$select public.audit_d1_execute(gen_random_uuid(), 'membership.role_change', %L::uuid, %L::jsonb, null)$q$,
    pg_temp.u(p_target), jsonb_build_object('role', p_rol)::text));
$$;

/** Suspender o reactivar por studio_set_user_disabled. */
create function pg_temp.suspende(p_user text, p_target text, p_disabled boolean) returns text language sql as $$
  select pg_temp.como('authenticated', p_user, 'authenticated', format(
    $q$select public.studio_set_user_disabled(%L::uuid, %L::boolean)$q$, pg_temp.u(p_target), p_disabled));
$$;

/** El token de la invitación pendiente de un correo (lo lee el dueño). */
create function pg_temp.token(p_invitado text) returns text language sql as $$
  select token from public.user_invitations
  where email = pg_temp.correo(p_invitado) and accepted_at is null and revoked_at is null;
$$;

/** El invitado acepta su invitación pendiente con su propia sesión. */
create function pg_temp.acepta(p_user text) returns text language sql as $$
  select pg_temp.como('authenticated', p_user, 'authenticated', format(
    $q$select public.studio_accept_invitation(%L, null, null)$q$, pg_temp.token(p_user)));
$$;

/** El dueño (como dentro de un DEFINER) con esos claims. */
create function pg_temp.dueno(p_claim_rol text, p_user text, p_sql text, p_forma text default 'json') returns text language sql as $$
  select pg_temp.como(p_claim_rol, p_user, null, p_sql, p_forma);
$$;

/** El dueño con request.jwt.claims crudo (p. ej. '{}' o un JSON inválido). */
create function pg_temp.crudo(p_claims text, p_sql text) returns text language plpgsql as $$
declare v text; n int;
begin
  perform pg_temp.jwt(null, null, 'ninguna');
  perform set_config('request.jwt.claims', p_claims, true);
  begin
    execute p_sql;
    get diagnostics n = row_count;
    v := n::text;
  exception when others then
    v := 'ERROR ' || sqlstate || ': ' || sqlerrm;
  end;
  perform pg_temp.jwt(null, null, 'ninguna');
  return v;
end;
$$;

/** El rol de la invitación pendiente de un correo, o null. */
create function pg_temp.pendiente(p_invitado text) returns text language sql as $$
  select role from public.user_invitations
  where email = pg_temp.correo(p_invitado) and accepted_at is null and revoked_at is null;
$$;

/** 'rol/activa', 'rol/suspendida' o null si no es miembro. */
create function pg_temp.miembro(p_user text) returns text language sql as $$
  select role || case when disabled_at is null then '/activa' else '/suspendida' end
  from public.user_tenants where user_id = pg_temp.u(p_user);
$$;

/**
 * Prepara el estado SIN pasar por los disparadores de la 0545 (los apaga y los
 * devuelve a su estado anterior, sea O, A, R o D), para que un mutante caiga en
 * su propio caso y no aquí.
 */
create function pg_temp.sembrar(p_sql text) returns void language plpgsql as $$
declare
  v_t record;
begin
  perform pg_temp.jwt(null, null, 'ninguna');
  create temporary table if not exists sembrar_estado (rel regclass, nombre name, estado "char") on commit drop;
  delete from sembrar_estado;
  insert into sembrar_estado
  select t.tgrelid::regclass, t.tgname, t.tgenabled from pg_trigger t
  where t.tgname in ('user_invitations_exige_superadmin', 'user_tenants_exige_superadmin');
  for v_t in select * from sembrar_estado loop
    execute format('alter table %s disable trigger %I', v_t.rel, v_t.nombre);
  end loop;
  execute p_sql;
  for v_t in select * from sembrar_estado loop
    execute format('alter table %s %s trigger %I', v_t.rel,
      case v_t.estado when 'A' then 'enable always' when 'O' then 'enable'
                      when 'R' then 'enable replica' else 'disable' end, v_t.nombre);
  end loop;
end;
$$;

-- (0) Antes de la 0545: un admin que no es superadmin invita admins por los dos
-- caminos, y la invitación se acepta.
select pg_temp.assert_true(pg_temp.d1_invita('a1', 'e1', 'admin') = 'ok' and pg_temp.pendiente('e1') = 'admin',
  '(0) antes de la 0545, el admin invita un admin por audit_d1_execute');
select pg_temp.assert_true(pg_temp.rpc_invita('a1', 'e2', 'admin') = 'ok' and pg_temp.pendiente('e2') = 'admin',
  '(0) antes de la 0545, el admin invita un admin por la rpc directa');
select pg_temp.assert_true(pg_temp.acepta('e1') = 'ok' and pg_temp.miembro('e1') = 'admin/activa',
  '(0) antes de la 0545, esa invitación se acepta y la persona queda admin');
-- Se deshace lo de e1; la invitación de admin de e2 sigue pendiente.
select pg_temp.sembrar($s$
  delete from public.user_tenants where user_id = pg_temp.u('e1');
  delete from public.user_invitations where email = pg_temp.correo('e1');
  delete from public.user_role_audit;
$s$);

\ir ../migrations/0545_solo_superadmin_crea_admin.sql

-- (a) Invitar.
select pg_temp.assert_true(pg_temp.d1_invita('a1', 'e1', 'admin')
    = 'ERROR 42501: Solo el superadministrador puede crear o reactivar administradores',
  '(a) el admin que no es superadmin recibe 42501 al invitar un admin por audit_d1_execute');
select pg_temp.assert_true(pg_temp.d1_invita('a1', 'e1', 'admin', 'antigua') ~ '^ERROR 42501: Solo el superadministrador',
  '(a) también con los claims en la forma antigua');
select pg_temp.assert_true(pg_temp.pendiente('e1') is null, '(a) no quedó invitación para e1');
select pg_temp.assert_true(pg_temp.d1_invita('a1', 'e2', 'admin') ~ '^ERROR 42501: Solo el superadministrador',
  '(a) re-invitar como admin una invitación de admin pendiente también se niega');
select pg_temp.assert_true(pg_temp.rpc_invita('a1', 'e1', 'commercial') ~ '^ERROR 42501: permission denied for function studio_invite_user',
  '(a) authenticated ya no ejecuta studio_invite_user directo');
select pg_temp.assert_true(pg_temp.rpc_invita('a2', 'e1', 'admin') ~ '^ERROR 42501: permission denied for function studio_invite_user',
  '(a) ni siquiera el superadmin: invitar por sesión pasa por audit_d1_execute');
select pg_temp.assert_true(pg_temp.d1_invita('a1', 'e3', 'commercial') = 'ok' and pg_temp.pendiente('e3') = 'commercial',
  '(a) el admin sigue invitando los demás roles por audit_d1_execute');
select pg_temp.assert_true(pg_temp.d1_invita('a2', 'e1', 'admin') = 'ok' and pg_temp.pendiente('e1') = 'admin',
  '(a) el superadmin invita un admin por audit_d1_execute');

-- (b) Aceptar.
select pg_temp.assert_true(pg_temp.acepta('e1') = 'ok' and pg_temp.miembro('e1') = 'admin/activa',
  '(b) la invitación de admin de un superadmin se acepta');
select pg_temp.assert_true((select count(*) from public.user_role_audit
    where target_user_id = pg_temp.u('e1') and actor_user_id = pg_temp.u('e1')
      and action = 'role_change' and old_value is null and new_value = 'admin') = 1,
  '(b) el alta queda en user_role_audit');
select pg_temp.assert_true(pg_temp.acepta('e2') ~ '^ERROR 42501: Solo el superadministrador'
    and pg_temp.miembro('e2') is null and pg_temp.pendiente('e2') = 'admin',
  '(b) una invitación de admin que no emitió un superadmin no se acepta');
select pg_temp.assert_true(pg_temp.acepta('e3') = 'ok' and pg_temp.miembro('e3') = 'commercial/activa',
  '(b) las invitaciones de otros roles se aceptan');
select pg_temp.assert_true((select count(*) from public.user_role_audit
    where target_user_id = pg_temp.u('e3') and action = 'role_change' and old_value is null and new_value = 'commercial') = 1,
  '(b) el alta de un comercial también queda en user_role_audit');
-- La excepción es solo para el invitado: otra sesión no la usa, aunque exista
-- la invitación del superadmin.
select pg_temp.assert_true(pg_temp.d1_invita('a2', 'e4', 'admin') = 'ok'
    and pg_temp.dueno('authenticated', 'a1',
      $q$insert into public.user_tenants (user_id, tenant_id, role, invited_by) values
        ('a0000000-0000-0000-0000-0000000000e4', '11111111-1111-1111-1111-111111111111', 'admin',
         'a0000000-0000-0000-0000-0000000000a2')$q$) ~ '^ERROR 42501: Solo el superadministrador'
    and pg_temp.miembro('e4') is null,
  '(b) la excepción del invitado no la usa otra sesión');
select pg_temp.sembrar($s$delete from public.user_invitations where email = pg_temp.correo('e4')$s$);

-- (c) Reactivar a un admin suspendido.
select pg_temp.assert_true(pg_temp.d1_invita('a2', 'd1', 'admin') = 'ok'
    and pg_temp.acepta('d1') ~ '^ERROR 42501: Solo el superadministrador'
    and pg_temp.miembro('d1') = 'admin/suspendida',
  '(c) un admin suspendido no vuelve aceptando una invitación, aunque la emita el superadmin');
select pg_temp.assert_true(pg_temp.dueno('authenticated', 'a1',
    $q$update public.user_tenants set disabled_at = null where user_id = 'a0000000-0000-0000-0000-0000000000d1'$q$)
    ~ '^ERROR 42501: Solo el superadministrador' and pg_temp.miembro('d1') = 'admin/suspendida',
  '(c) el admin no reactiva a otro admin por el dueño');
select pg_temp.assert_true(pg_temp.suspende('a1', 'd1', false) ~ '^ERROR 42501' and pg_temp.miembro('d1') = 'admin/suspendida',
  '(c) el admin no reactiva a otro admin por studio_set_user_disabled');
select pg_temp.assert_true(pg_temp.suspende('a2', 'd1', false) = 'ok' and pg_temp.miembro('d1') = 'admin/activa',
  '(c) el superadmin reactiva al admin suspendido');
select pg_temp.assert_true((select count(*) from public.user_role_audit
    where target_user_id = pg_temp.u('d1') and actor_user_id = pg_temp.u('a2') and action = 'enable') = 1,
  '(c) la reactivación queda en user_role_audit');
select pg_temp.assert_true(pg_temp.d1_invita('a2', 'c1', 'admin') = 'ok'
    and pg_temp.acepta('c1') ~ '^ERROR 42501: Solo el superadministrador'
    and pg_temp.miembro('c1') = 'commercial/suspendida',
  '(c) un comercial suspendido no vuelve como admin aceptando una invitación, aunque la emita el superadmin');
-- a1 cambia esa invitación pendiente a comercial (bajar el rol no se frena).
select pg_temp.assert_true(pg_temp.d1_invita('a1', 'c1', 'commercial') = 'ok'
    and pg_temp.acepta('c1') = 'ok' and pg_temp.miembro('c1') = 'commercial/activa',
  '(c) un comercial suspendido sí vuelve aceptando una invitación de comercial');

-- (d) Cambiar el rol a admin.
select pg_temp.assert_true(pg_temp.d1_rol('a1', 'b1', 'admin') ~ '^ERROR 42501' and pg_temp.miembro('b1') = 'commercial/activa',
  '(d) el admin no sube a admin a un comercial por audit_d1_execute');
select pg_temp.assert_true(pg_temp.dueno('authenticated', 'a1',
    $q$update public.user_tenants set role = 'admin' where user_id = 'a0000000-0000-0000-0000-0000000000b1'$q$)
    ~ '^ERROR 42501: Solo el superadministrador' and pg_temp.miembro('b1') = 'commercial/activa',
  '(d) ni por el dueño');
select pg_temp.assert_true(pg_temp.d1_rol('a2', 'b1', 'admin') = 'ok' and pg_temp.miembro('b1') = 'admin/activa',
  '(d) el superadmin sube a admin a un comercial');
select pg_temp.sembrar($s$update public.user_tenants set role = 'commercial' where user_id = pg_temp.u('b1')$s$);

-- (e) La sesión se detecta por los claims, con el dueño de por medio.
create function pg_temp.inv_admin(p_invitado text) returns text language sql as $$
  select format($q$insert into public.user_invitations (tenant_id, email, role, token, invited_by)
    values ('11111111-1111-1111-1111-111111111111', %L, 'admin', %L, 'a0000000-0000-0000-0000-0000000000a2')$q$,
    pg_temp.correo(p_invitado), 'tok-' || p_invitado || '-' || gen_random_uuid());
$$;
create function pg_temp.sube_b1() returns text language sql as $$
  select $q$update public.user_tenants set role = 'admin' where user_id = 'a0000000-0000-0000-0000-0000000000b1'$q$;
$$;
select pg_temp.assert_true(pg_temp.dueno('anon', null, pg_temp.inv_admin('e4')) ~ '^ERROR 42501'
    and pg_temp.dueno('anon', null, pg_temp.sube_b1()) ~ '^ERROR 42501',
  '(e) anon sin sub: se niega');
select pg_temp.assert_true(pg_temp.dueno('anon', 'a2', pg_temp.inv_admin('e4')) ~ '^ERROR 42501'
    and pg_temp.dueno('anon', 'a2', pg_temp.sube_b1()) ~ '^ERROR 42501',
  '(e) anon, aunque traiga el sub del superadmin: se niega');
select pg_temp.assert_true(pg_temp.dueno('authenticated', null, pg_temp.inv_admin('e4')) ~ '^ERROR 42501'
    and pg_temp.dueno('authenticated', null, pg_temp.sube_b1()) ~ '^ERROR 42501',
  '(e) authenticated sin sub: se niega');
select pg_temp.assert_true(pg_temp.dueno(null, 'a1', pg_temp.inv_admin('e4')) ~ '^ERROR 42501'
    and pg_temp.dueno(null, 'a1', pg_temp.sube_b1()) ~ '^ERROR 42501',
  '(e) un sub sin rol que no es superadmin: se niega');
select pg_temp.assert_true(pg_temp.pendiente('e4') is null and pg_temp.miembro('b1') = 'commercial/activa',
  '(e) no quedó nada de esas sesiones');
select pg_temp.assert_true(pg_temp.como('service_role', null, 'service_role', pg_temp.inv_admin('e4')) = '1',
  '(e) service_role (claims JSON) crea una invitación de admin');
select pg_temp.assert_true(pg_temp.dueno('service_role', null, pg_temp.sube_b1(), 'antigua') = '1'
    and pg_temp.miembro('b1') = 'admin/activa',
  '(e) service_role (forma antigua) sube a admin');
select pg_temp.sembrar($s$
  update public.user_tenants set role = 'commercial' where user_id = pg_temp.u('b1');
  delete from public.user_invitations where email = pg_temp.correo('e4');
$s$);
select pg_temp.assert_true(pg_temp.dueno(null, null, pg_temp.sube_b1(), 'ninguna') = '1'
    and pg_temp.miembro('b1') = 'admin/activa',
  '(e) sin claims (migración, job, el dueño) sube a admin');
select pg_temp.sembrar($s$update public.user_tenants set role = 'commercial' where user_id = pg_temp.u('b1')$s$);
select pg_temp.assert_true(pg_temp.crudo('{}', pg_temp.inv_admin('e4')) = '1',
  '(e) claims ''{}'' (sin role ni sub) es lo mismo que sin claims: pasa');
select pg_temp.sembrar($s$delete from public.user_invitations where email = pg_temp.correo('e4')$s$);
select pg_temp.assert_true(pg_temp.crudo('no-es-json', pg_temp.inv_admin('e4')) ~ '^ERROR 22P02'
    and pg_temp.crudo('no-es-json', pg_temp.sube_b1()) ~ '^ERROR 22P02'
    and pg_temp.pendiente('e4') is null and pg_temp.miembro('b1') = 'commercial/activa',
  '(e) un JSON de claims inválido falla cerrado');

-- (f) ENABLE ALWAYS: tampoco se lo salta el modo réplica.
set local session_replication_role = replica;
select pg_temp.assert_true(pg_temp.d1_invita('a1', 'e4', 'admin') ~ '^ERROR 42501',
  '(f) con session_replication_role = replica, invitar un admin sigue negado');
select pg_temp.assert_true(pg_temp.dueno('authenticated', 'a1', pg_temp.sube_b1()) ~ '^ERROR 42501',
  '(f) con session_replication_role = replica, subir a admin sigue negado');
set local session_replication_role = origin;
select pg_temp.assert_true(pg_temp.pendiente('e4') is null and pg_temp.miembro('b1') = 'commercial/activa',
  '(f) no quedó nada');

-- (g) Las funciones nuevas no se conceden a nadie; el ACL de las demás.
select pg_temp.assert_true(
    not has_function_privilege('authenticated', 'public.user_invitations_exige_superadmin()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.user_tenants_exige_superadmin()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.audit_user_tenants_alta()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.user_tenants_exige_superadmin()', 'EXECUTE'),
  '(g) nadie ejecuta las funciones nuevas');
select pg_temp.assert_true(
    not has_function_privilege('authenticated', 'public.studio_invite_user(text,text,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.studio_invite_user(text,text,text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.audit_d1_execute(uuid,text,uuid,jsonb,text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.studio_accept_invitation(text,text,text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.is_platform_admin()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.is_platform_admin()', 'EXECUTE'),
  '(g) studio_invite_user sale de authenticated y lo demás conserva su ACL');

-- (h) Lo que no crea ni reactiva admins no se frena.
select pg_temp.assert_true(pg_temp.dueno('authenticated', 'a1',
    format($q$update public.user_invitations set revoked_at = now() where email = %L$q$, pg_temp.correo('e2'))) = '1'
    and pg_temp.pendiente('e2') is null,
  '(h) revocar una invitación de admin no pasa por el disparador (OF role)');
select pg_temp.assert_true(pg_temp.dueno('authenticated', 'a1',
    $q$update public.user_tenants set region = 'cn' where user_id = 'a0000000-0000-0000-0000-0000000000a2'$q$) = '1',
  '(h) cambiar la oficina de un admin activo no se frena');
select pg_temp.assert_true(pg_temp.suspende('a2', 'e1', true) = 'ok' and pg_temp.miembro('e1') = 'admin/suspendida',
  '(h) suspender a un admin no se frena');
select pg_temp.assert_true(pg_temp.d1_rol('a1', 'e3', 'operations') = 'ok' and pg_temp.miembro('e3') = 'operations/activa',
  '(h) cambiar entre roles que no son admin no se frena');

-- (i) Idempotente: aplicarla otra vez deja los mismos disparadores y el mismo resultado.
\ir ../migrations/0545_solo_superadmin_crea_admin.sql
select pg_temp.assert_true(
    (select count(*) from pg_trigger where tgname in ('user_invitations_exige_superadmin', 'user_tenants_exige_superadmin')
       and tgenabled = 'A') = 2
    and (select count(*) from pg_trigger where tgname = 'user_tenants_audit_alta' and tgenabled = 'O') = 1
    and pg_temp.d1_invita('a1', 'e4', 'admin') ~ '^ERROR 42501'
    and pg_temp.d1_invita('a2', 'e4', 'admin') = 'ok',
  '(i) la segunda aplicación deja el mismo resultado');

-- (j) El desarme deja todo como antes de la 0545.
\ir ../desarmes/0545_desarme.sql
select pg_temp.assert_true(
    not exists (select 1 from pg_trigger where tgname in
      ('user_invitations_exige_superadmin', 'user_tenants_exige_superadmin', 'user_tenants_audit_alta'))
    and to_regprocedure('public.user_tenants_exige_superadmin()') is null
    and has_function_privilege('authenticated', 'public.studio_invite_user(text,text,text)', 'EXECUTE'),
  '(j) el desarme quita los disparadores y devuelve el EXECUTE de studio_invite_user');
select pg_temp.assert_true(pg_temp.d1_invita('a1', 'n9', 'admin') = 'ok',
  '(j) después del desarme, el admin vuelve a invitar admins');

select 'TEST 0545: ' || nextval('pg_temp.assertion_count') - 1 || ' aserciones OK' as resultado;

rollback;
