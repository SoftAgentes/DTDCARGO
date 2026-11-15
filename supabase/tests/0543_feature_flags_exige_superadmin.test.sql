\set ON_ERROR_STOP on

-- SDD-0634 · contrato de la 0543 (encender o apagar un módulo exige superadmin
-- por cualquier camino).
--
-- Arma:
--   · is_platform_admin() con el cuerpo de la 0058 y el ACL que deja la 0542;
--   · feature_flags con la forma de la 0042 y la policy LITERAL de la 0355;
--   · un doble de audit_d1_execute con la FIRMA real, DEFINER de postgres y
--     concedido a authenticated como en la 0289:930-935, cuya guarda
--     (audit_d1_admin_tenant, 0289:131-160) y rama feature_flag.toggle
--     (0289:632-650) son copia literal. El envoltorio de Vitest comprueba que
--     esa copia sigue en la 0289.
-- y aplica la 0543 REAL dos veces.
--
-- Lo que defiende (las 5 condiciones del DG, 2026-11-15):
--   (0) antes de la 0543, un admin del tenant que no es superadmin enciende un
--       flag por el DEFINER (el hueco medido);
--   (a) después, ese admin recibe 42501 por el DEFINER, en las dos formas de
--       claims, y nada por UPDATE directo; el flag no cambia;
--   (b) el superadmin pasa por el camino real (feature_flag.toggle) y directo;
--   (c) la sesión se detecta por los claims, no por current_user: anon (con o
--       sin sub), authenticated sin sub y un sub sin rol se niegan con el dueño
--       de por medio;
--   (d) service_role (las dos formas) y sin claims pasan;
--   (e) ninguna sesión inserta ni borra flags (por qué basta con UPDATE);
--   (f) ENABLE ALWAYS: el modo réplica no se lo salta;
--   (g) la función nueva no se concede a nadie, y el ACL de audit_d1_execute e
--       is_platform_admin() no cambia;
--   (h) es idempotente.
--
-- CONTROL ROJO: sin la 0543 cae «(a)».
-- Termina siempre en ROLLBACK. Solo ids y textos sintéticos.
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
create table auth.users (id uuid primary key);

create table public.tenants (id uuid primary key);
create table public.user_tenants (
  user_id uuid not null references auth.users(id),
  tenant_id uuid not null references public.tenants(id),
  role text not null,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, tenant_id)
);
grant select on public.user_tenants to authenticated;

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

-- feature_flags con la forma de la 0042 y la policy de UPDATE LITERAL de la 0355.
create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  key text not null,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (tenant_id, key)
);
alter table public.feature_flags enable row level security;
create policy "feature_flags_tenant_select"
  on public.feature_flags for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));
create policy feature_flags_platform_admin_update
  on public.feature_flags
  for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.is_platform_admin())
  )
  with check (tenant_id = (select public.get_user_tenant_id()));
grant select, update on public.feature_flags to authenticated;
grant all on public.feature_flags to service_role;

-- Copia LITERAL de la guarda de la 0289:131-160.
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

-- Doble de audit_d1_execute: la firma real y la rama feature_flag.toggle LITERAL
-- de la 0289:632-650. Las otras 21 ramas no se copian: la 0543 no las toca.
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
  v_entity_id uuid;
  v_before jsonb;
  v_result jsonb := '{}'::jsonb;
begin
  case p_operation_type
    when 'feature_flag.toggle' then
      select pg_catalog.jsonb_build_object('enabled', f.enabled), f.id
        into v_before, v_entity_id
      from public.feature_flags f
      where f.tenant_id = v_tenant_id
        and f.key = p_input ->> 'key'
      for update;
      if v_entity_id is null then
        raise exception 'invalid_state' using errcode = 'P0002';
      end if;
      update public.feature_flags
      set
        enabled = (p_input ->> 'enabled')::boolean,
        updated_at = pg_catalog.clock_timestamp(),
        updated_by = v_actor_id
      where id = v_entity_id;
      v_result := pg_catalog.jsonb_build_object('entity_id', v_entity_id);
  end case;
  return v_result;
end;
$function$;
revoke all on function public.audit_d1_execute(uuid,text,uuid,jsonb,text) from public, anon;
grant execute on function public.audit_d1_execute(uuid,text,uuid,jsonb,text) to authenticated;

-- ── Fixture ─────────────────────────────────────────────────────────────
-- T1 = 1…1. a1 admin de T1 (no es superadmin) · a2 admin de T1 y superadmin ·
-- b1 comercial de T1.
insert into public.tenants values ('11111111-1111-1111-1111-111111111111');
insert into auth.users values
  ('a0000000-0000-0000-0000-0000000000a1'),
  ('a0000000-0000-0000-0000-0000000000a2'),
  ('a0000000-0000-0000-0000-0000000000b1');
insert into public.user_tenants (user_id, tenant_id, role) values
  ('a0000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('a0000000-0000-0000-0000-0000000000a2', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('a0000000-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111', 'commercial');
insert into public.platform_admins values ('a0000000-0000-0000-0000-0000000000a2');
insert into public.feature_flags (tenant_id, key, enabled) values
  ('11111111-1111-1111-1111-111111111111', 'chatwoot_portal', false);

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0543: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

create function pg_temp.u(p_user text) returns uuid language sql immutable as $$
  select ('a0000000-0000-0000-0000-0000000000' || p_user)::uuid;
$$;

/**
 * Deja los claims como los deja PostgREST. p_forma: 'json' (request.jwt.claims,
 * la actual), 'antigua' (request.jwt.claim.role/sub) o 'ninguna' (sin claims:
 * migraciones, jobs, el dueño). p_user null = sin sub.
 */
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
 * Ejecuta p_sql con esos claims. p_como: el rol de base con el que corre
 * ('authenticated', 'service_role'…) o null para el dueño (como un DEFINER o
 * una migración). Devuelve 'ok', el número de filas si p_sql es un UPDATE, o
 * 'ERROR <sqlstate>: <mensaje>'.
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
    v := case when p_sql ~* '^\s*update' then n::text else 'ok' end;
  exception when others then
    v := 'ERROR ' || sqlstate || ': ' || sqlerrm;
  end;
  reset role;
  perform pg_temp.jwt(null, null, 'ninguna');
  return v;
end;
$$;

/** Una persona autenticada enciende/apaga por audit_d1_execute (el camino real de la server action). */
create function pg_temp.por_d1(p_user text, p_enabled boolean, p_forma text default 'json') returns text language sql as $$
  select pg_temp.como('authenticated', p_user, 'authenticated', format(
    $q$select public.audit_d1_execute(gen_random_uuid(), 'feature_flag.toggle', null, %L::jsonb, null)$q$,
    jsonb_build_object('key', 'chatwoot_portal', 'enabled', p_enabled)::text), p_forma);
$$;

/** UPDATE directo, como lo haría PostgREST con la sesión. */
create function pg_temp.directo(p_user text, p_enabled boolean) returns text language sql as $$
  select pg_temp.como('authenticated', p_user, 'authenticated',
    format('update public.feature_flags set enabled = %L where key = %L', p_enabled, 'chatwoot_portal'));
$$;

/** UPDATE del dueño (como dentro de un DEFINER) con los claims dados. */
create function pg_temp.dueno(p_claim_rol text, p_user text, p_enabled boolean, p_forma text default 'json') returns text language sql as $$
  select pg_temp.como(p_claim_rol, p_user, null,
    format('update public.feature_flags set enabled = %L where key = %L', p_enabled, 'chatwoot_portal'), p_forma);
$$;

create function pg_temp.flag() returns boolean language sql as $$
  select enabled from public.feature_flags where key = 'chatwoot_portal';
$$;

/**
 * Repone el flag entre casos SIN pasar por el disparador (lo apaga y lo devuelve
 * a su estado anterior, sea O, A o D), para que un mutante caiga en su propio
 * caso y no aquí.
 */
create function pg_temp.reponer(p_enabled boolean) returns void language plpgsql as $$
declare v_estado "char" := (select tgenabled from pg_trigger
  where tgrelid = 'public.feature_flags'::regclass and tgname = 'feature_flags_exige_superadmin');
begin
  perform pg_temp.jwt(null, null, 'ninguna');
  if v_estado is not null then alter table public.feature_flags disable trigger feature_flags_exige_superadmin; end if;
  update public.feature_flags set enabled = p_enabled where key = 'chatwoot_portal';
  if v_estado = 'A' then alter table public.feature_flags enable always trigger feature_flags_exige_superadmin;
  elsif v_estado = 'O' then alter table public.feature_flags enable trigger feature_flags_exige_superadmin;
  elsif v_estado = 'R' then alter table public.feature_flags enable replica trigger feature_flags_exige_superadmin;
  end if;
end;
$$;

-- (0) Antes de la 0543: el hueco. El admin que no es superadmin enciende el flag
-- por el DEFINER, aunque la policy se lo niegue por UPDATE directo.
select pg_temp.assert_true(pg_temp.directo('a1', true) = '0',
  '(0) antes de la 0543, la policy le niega al admin el UPDATE directo');
select pg_temp.assert_true(pg_temp.por_d1('a1', true) = 'ok' and pg_temp.flag() = true,
  '(0) antes de la 0543, el admin enciende el flag por audit_d1_execute');
select pg_temp.reponer(false);

\ir ../migrations/0543_feature_flags_exige_superadmin.sql

-- (a) El admin del tenant que no es superadmin: 42501 por el DEFINER (en las dos
-- formas de claims) y nada por UPDATE directo. El flag no cambia.
select pg_temp.assert_true(pg_temp.por_d1('a1', true)
    = 'ERROR 42501: Solo el superadministrador puede encender o apagar módulos',
  '(a) el admin que no es superadmin recibe 42501 por audit_d1_execute');
select pg_temp.assert_true(pg_temp.por_d1('a1', true, 'antigua') ~ '^ERROR 42501: Solo el superadministrador',
  '(a) también con los claims en la forma antigua');
select pg_temp.assert_true(pg_temp.directo('a1', true) = '0',
  '(a) el admin no logra el UPDATE directo');
select pg_temp.assert_true(pg_temp.flag() = false, '(a) el flag sigue apagado');

-- (b) El superadmin lo cambia por el camino real (audit_d1_execute) y por UPDATE directo.
select pg_temp.assert_true(pg_temp.por_d1('a2', true) = 'ok' and pg_temp.flag() = true,
  '(b) el superadmin enciende el flag por audit_d1_execute');
select pg_temp.assert_true(pg_temp.por_d1('a2', false, 'antigua') = 'ok' and pg_temp.flag() = false,
  '(b) el superadmin lo apaga con los claims en la forma antigua');
select pg_temp.assert_true(pg_temp.directo('a2', true) = '1' and pg_temp.flag() = true,
  '(b) el superadmin enciende el flag por UPDATE directo');
select pg_temp.reponer(false);

-- (c) Otras sesiones con el dueño de por medio (como dentro de un DEFINER).
select pg_temp.assert_true(pg_temp.dueno('anon', null, true) ~ '^ERROR 42501',
  '(c) anon sin sub: se niega');
select pg_temp.assert_true(pg_temp.dueno('anon', 'a2', true) ~ '^ERROR 42501',
  '(c) anon, aunque traiga el sub del superadmin: se niega');
select pg_temp.assert_true(pg_temp.dueno('authenticated', null, true) ~ '^ERROR 42501',
  '(c) authenticated sin sub: se niega');
select pg_temp.assert_true(pg_temp.dueno(null, 'a1', true) ~ '^ERROR 42501',
  '(c) un sub sin rol que no es superadmin: se niega');
select pg_temp.assert_true(pg_temp.flag() = false, '(c) el flag sigue apagado');
-- Un comercial no pasa ni la guarda de audit_d1 (no es admin del tenant).
select pg_temp.assert_true(pg_temp.por_d1('b1', true) ~ '^ERROR 42501: permission_denied',
  '(c) el comercial no pasa audit_d1_admin_tenant');

-- (d) service_role y sin claims pasan.
select pg_temp.assert_true(pg_temp.como('service_role', null, 'service_role',
    'update public.feature_flags set enabled = true where key = ''chatwoot_portal''') = '1'
    and pg_temp.flag() = true,
  '(d) service_role (claims JSON) cambia el flag');
select pg_temp.assert_true(pg_temp.dueno('service_role', null, false, 'antigua') = '1' and pg_temp.flag() = false,
  '(d) service_role (forma antigua) cambia el flag');
select pg_temp.assert_true(pg_temp.dueno(null, null, true, 'ninguna') = '1' and pg_temp.flag() = true,
  '(d) sin claims (migración, job, el dueño) cambia el flag');
select pg_temp.reponer(false);

-- (e) INSERT y DELETE: ninguna sesión los puede hacer (premisa de cubrir solo UPDATE).
select pg_temp.assert_true(pg_temp.como('authenticated', 'a2', 'authenticated',
    'insert into public.feature_flags (tenant_id, key, enabled) values (''11111111-1111-1111-1111-111111111111'', ''otro'', true)')
    ~ '^ERROR 42501',
  '(e) authenticated no inserta flags');
select pg_temp.assert_true(pg_temp.como('authenticated', 'a2', 'authenticated',
    'delete from public.feature_flags where key = ''chatwoot_portal''') ~ '^ERROR 42501',
  '(e) authenticated no borra flags');

-- (f) ENABLE ALWAYS: tampoco se lo salta el modo réplica.
set local session_replication_role = replica;
select pg_temp.assert_true(pg_temp.por_d1('a1', true) ~ '^ERROR 42501',
  '(f) con session_replication_role = replica, el admin sigue recibiendo 42501');
set local session_replication_role = origin;
select pg_temp.assert_true(pg_temp.flag() = false, '(f) el flag sigue apagado');

-- (g) La función nueva no se concede a nadie; el ACL de las otras no cambió.
select pg_temp.assert_true(
    not has_function_privilege('authenticated', 'public.feature_flags_exige_superadmin()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.feature_flags_exige_superadmin()', 'EXECUTE'),
  '(g) nadie ejecuta feature_flags_exige_superadmin()');
select pg_temp.assert_true(
    has_function_privilege('authenticated', 'public.audit_d1_execute(uuid,text,uuid,jsonb,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.audit_d1_execute(uuid,text,uuid,jsonb,text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.is_platform_admin()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.is_platform_admin()', 'EXECUTE'),
  '(g) audit_d1_execute e is_platform_admin() conservan su ACL');

-- (h) Idempotente: aplicarla otra vez deja un solo disparador y el mismo resultado.
\ir ../migrations/0543_feature_flags_exige_superadmin.sql
select pg_temp.assert_true(
    (select count(*) from pg_trigger where tgrelid = 'public.feature_flags'::regclass
       and tgname = 'feature_flags_exige_superadmin' and tgenabled = 'A') = 1
    and pg_temp.por_d1('a1', true) ~ '^ERROR 42501'
    and pg_temp.por_d1('a2', true) = 'ok',
  '(h) la segunda aplicación deja el mismo resultado');

select 'TEST 0543: ' || nextval('pg_temp.assertion_count') - 1 || ' aserciones OK' as resultado;

rollback;
