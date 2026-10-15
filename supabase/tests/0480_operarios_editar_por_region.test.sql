\set ON_ERROR_STOP on
-- SDD-0529 · Contrato de 0480: un operario de Venezuela se edita desde el
-- Studio con un rol de los de su región y sin almacén; uno de China, con un
-- almacén de China activo; el rol nunca cambia solo ni queda distinto de sus
-- modos; la edición autoriza con la matriz de módulos y deja su evento en la
-- misma transacción, sin los nombres. Fixture sintético aislado; no ejecutar
-- sobre una DB real. Termina en ROLLBACK.
-- RED: psql -v apply_fix=false -f /sb/tests/0480_operarios_editar_por_region.test.sql
--
-- El ANTES es producción después de 0475 (aplicada el 2026-10-14): el fixture
-- de 0475_pin_operarios_endurecer.test.sql, con las mismas copias VERBATIM
-- (get_user_tenant_id de 0453, current_studio_role de 0200,
-- assert_tenant_match de 0012 con la ACL de 0211, la ACL y la RLS de
-- operario_pins de 0020, el enum de 0023, el search_path de 0210) y las mismas
-- migraciones reales por \ir (0021, 0037, 0351, 0325, 0357, 0258, 0261, 0267,
-- 0294 y 0475). Se suman, también verbatim, warehouses_cn de 0008 con la FK de
-- 0020, y las constraints de rol por región de 0025 y de modos de 0066: de
-- ellas sale la regla del rol. El envoltorio
-- lib/studio/__tests__/operarios-editar-por-region.migration.test.ts comprueba
-- que las copias siguen iguales a los archivos.
--
-- fixture_only=true deja la base montada, con 0480 aplicada, dentro de la
-- transacción abierta: lo usa la prueba de propiedad de la matriz.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
\if :{?fixture_only}
\else
\set fixture_only false
\endif
begin;
do $fixture_guard$
begin
  if to_regclass('public.tenants') is not null or to_regclass('public.operario_pins') is not null
     or to_regclass('public.entity_audit_log') is not null then
    raise exception 'TEST 0480: fixture rechazada, la base ya contiene objetos de aplicación';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$fixture_guard$;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
create schema extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema auth, extensions to authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
-- Como el de Supabase: los claims del JWT que PostgREST deja en request.jwt.claims.
create function auth.jwt() returns jsonb language sql stable set search_path = '' as $$
  select coalesce(nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

-- Vault real o stub (mismo patrón que 0472_kommo_functions_base_url.test.sql):
-- 0475 crea su clave al aplicarse.
create schema if not exists vault;
do $vault_stub$
begin
  if to_regclass('vault.secrets') is null then
    create table vault.secrets (
      id uuid primary key default gen_random_uuid(), name text unique, secret text, description text
    );
    create function vault.create_secret(new_secret text, new_name text default null, new_description text default '')
    returns uuid language sql as $stub$
      insert into vault.secrets (name, secret, description) values (new_name, new_secret, new_description) returning id
    $stub$;
    create view vault.decrypted_secrets as
      select id, name, description, secret, secret as decrypted_secret from vault.secrets;
  end if;
end;
$vault_stub$;

create table public.tenants (id uuid primary key);
-- Columnas de 0001/0019/0202 y el CHECK de roles de 0189.
create table public.user_tenants (
  user_id uuid not null references auth.users(id), tenant_id uuid not null references public.tenants(id),
  role text not null, disabled_at timestamptz, warehouse_scope text not null default 'all',
  primary key (user_id, tenant_id),
  constraint user_tenants_role_check
  check (role in (
    'admin', 'commercial', 'operations',
    'accounting', 'warehouse', 'support', 'marketing'
  ))
);
alter table public.user_tenants enable row level security;
grant select on public.user_tenants to authenticated;
-- ── ANTES: policy de user_tenants de 0200, copia verbatim ───
create policy "users see their own user_tenants"
  on public.user_tenants for select to authenticated
  using (user_id = (select auth.uid()) and disabled_at is null);

-- ── ANTES: get_user_tenant_id() de 0453, copia verbatim ─────
create or replace function public.get_user_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1]
  from public.user_tenants as ut
  where ut.user_id = (select auth.uid())
    and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;

-- ── ANTES: current_studio_role() de 0200, copia verbatim ────
create or replace function public.current_studio_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.user_tenants
  where user_id = (select auth.uid())
    and disabled_at is null
  limit 1
$$;

-- ── ANTES: assert_tenant_match() de 0012 y su ACL de 0211 ───
create or replace function public.assert_tenant_match(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_tenant uuid := public.get_user_tenant_id();
begin
  if p_tenant_id is null then
    raise exception 'Tenant ID required' using errcode = '42501';
  end if;
  if v_caller_tenant is null then
    raise exception 'Authenticated tenant required for this operation' using errcode = '42501';
  end if;
  if p_tenant_id <> v_caller_tenant then
    raise exception 'Tenant mismatch: caller does not belong to tenant %', p_tenant_id
      using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.assert_tenant_match(uuid) from public, anon;
grant execute on function public.assert_tenant_match(uuid) to authenticated;
revoke execute on function public.assert_tenant_match(p_tenant_id uuid) from authenticated;
grant execute on function public.assert_tenant_match(p_tenant_id uuid) to service_role;

-- ── ANTES: el catálogo global de almacenes de China de 0008, copia verbatim ──
create table public.warehouses_cn (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,              -- 'YIW-A1'
  hub_code        text not null,                     -- 'YIW' (para agrupar/prefix)
  hub_name_es     text not null,                     -- 'Yiwu'
  hub_name_cn     text not null,                     -- '义乌'
  warehouse_name  text,                              -- 'A1 · 义乌港二期 (directo)'
  city            text,                              -- 'Yiwu, Zhejiang'
  address         text,                              -- dirección completa
  active          boolean not null default true,
  display_order   int not null default 0,            -- orden en dropdowns
  created_at      timestamptz not null default now()
);

-- ── ANTES: operario_pins con sus 14 columnas, ACL y RLS de 0020 ──
-- La FK de warehouse_id es la de 0020.
create type operario_region as enum ('cn', 've');
create table public.operario_pins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  warehouse_id uuid references public.warehouses_cn(id) on delete restrict,
  display_name text not null,
  display_name_cn text,
  pin_hash text not null,
  role text not null default 'operario'
    check (role in ('operario', 'supervisor', 'bodeguero', 'camionero')),
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  region operario_region not null default 'cn',
  tms_driver_id uuid,
  roles text[] not null default '{}',
  unique (warehouse_id, display_name),
  constraint operario_pins_cn_requires_warehouse check (region <> 'cn' or warehouse_id is not null)
);
revoke all on public.operario_pins from public, anon, authenticated;
grant select, insert, update, delete on public.operario_pins to service_role;
alter table public.operario_pins enable row level security;
-- La ACL viva de service_role, leída por el Director el 2026-10-14: arwdDxtm
-- (también TRUNCATE, REFERENCES, TRIGGER y, desde PostgreSQL 17, MAINTAIN).
grant truncate, references, trigger on public.operario_pins to service_role;
do $maintain$
begin
  if pg_catalog.current_setting('server_version_num')::integer >= 170000 then
    execute 'grant maintain on public.operario_pins to service_role';
  end if;
end;
$maintain$;

-- ── ANTES: el rol por región de 0025 y los modos de 0066, copias verbatim ──
-- Constraint nuevo: bodeguero/camionero requieren region='ve'
alter table public.operario_pins
  add constraint operario_pins_ve_role_requires_ve_region
  check (
    region = 've'
    or role not in ('bodeguero', 'camionero')
  );
alter table public.operario_pins
      add constraint operario_pins_roles_check
      check (
        roles <@ ARRAY['operario','supervisor','bodeguero','camionero']::text[]
      );

-- Las RPC de Operarios reales: 0021 (policy, grants), 0037 (validador) con el
-- search_path de 0210, y 0351 (candado de rol): admin_update_operario sigue
-- siendo la de 0351 en producción.
\ir ../migrations/0021_operario_admin_rpcs.sql
\ir ../migrations/0037_harden_operario_pin_validator.sql
alter function public.validate_operario_pin_format(p_pin text) set search_path = public;
\ir ../migrations/0351_operario_rpc_exige_rol.sql
-- El login real (0325): tenant + región + una sola coincidencia; devuelve role y roles.
\ir ../migrations/0325_operario_pin_login_hardening.sql
-- La matriz editable real (0357).
\ir ../migrations/0357_role_module_overrides.sql

-- Plataforma legacy mínima de 0267; esquema/constraints/writer v1 se instalan
-- desde las migraciones reales, no de una función de auditoría simulada.
create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  entity_type text not null, entity_id uuid not null, actor_type text not null,
  actor_id uuid, event_type text not null, payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint entity_audit_log_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade,
  constraint entity_audit_log_actor_type_check check (actor_type in ('user', 'operario', 'system')),
  constraint entity_audit_log_entity_type_check check (entity_type in ('shipment'))
);
alter table public.entity_audit_log enable row level security;
create policy entity_audit_log_tenant_select on public.entity_audit_log for select to authenticated
  using (tenant_id = public.get_user_tenant_id());
create policy entity_audit_log_service_role_all on public.entity_audit_log for all to service_role
  using (true) with check (true);
grant select on public.entity_audit_log to authenticated;
grant all on public.entity_audit_log to service_role;
create publication supabase_realtime;
alter publication supabase_realtime add table public.entity_audit_log;
\ir ../migrations/0258_audit_entity_catalog.sql
\ir ../migrations/0261_audit_entity_catalog_validate.sql
\ir ../migrations/0267_audit_contract_append_only.sql
\ir ../migrations/0294_audit_d2_human_reasons.sql

-- Producción hoy: 0475 aplicada (matriz, entidad operario, PIN cifrado).
\ir ../migrations/0475_pin_operarios_endurecer.sql

-- ── Semilla sintética ───────────────────────────────────────
create function pg_temp.fixture_id(p_label text) returns uuid language sql immutable as $$
  select md5('0480-synthetic-' || p_label)::uuid
$$;
insert into public.tenants values (pg_temp.fixture_id('tenant-A')), (pg_temp.fixture_id('tenant-B'));
insert into auth.users (id, email)
select pg_temp.fixture_id(u), u || '@example.invalid'
from unnest(array['admin-A', 'commercial-A', 'operations-A', 'accounting-A', 'warehouse-A',
  'support-A', 'marketing-A', 'operations-off-A', 'operations-B', 'admin-B']) as u;
insert into public.user_tenants (user_id, tenant_id, role, disabled_at)
select pg_temp.fixture_id(m.label), pg_temp.fixture_id(m.tenant), m.role, m.disabled_at
from (values
  ('admin-A', 'tenant-A', 'admin', null::timestamptz),
  ('commercial-A', 'tenant-A', 'commercial', null),
  ('operations-A', 'tenant-A', 'operations', null),
  ('accounting-A', 'tenant-A', 'accounting', null),
  ('warehouse-A', 'tenant-A', 'warehouse', null),
  ('support-A', 'tenant-A', 'support', null),
  ('marketing-A', 'tenant-A', 'marketing', null),
  ('operations-off-A', 'tenant-A', 'operations', now()),
  ('operations-B', 'tenant-B', 'operations', null),
  ('admin-B', 'tenant-B', 'admin', null)
) as m(label, tenant, role, disabled_at);
-- Almacenes de China: dos activos y uno desactivado.
insert into public.warehouses_cn (id, code, hub_code, hub_name_es, hub_name_cn, active)
values (pg_temp.fixture_id('wh-yiw'), 'YIW-A1', 'YIW', 'Yiwu', '义乌', true),
       (pg_temp.fixture_id('wh-gz'), 'GZ-B1', 'GZ', 'Guangzhou', '广州', true),
       (pg_temp.fixture_id('wh-cerrado'), 'SZ-C1', 'SZ', 'Shenzhen', '深圳', false);
-- Operarios de A: dos de China activos y uno viejo (modos vacíos, almacén
-- desactivado); de Venezuela, un camionero (Luis), una bodeguera, uno con un
-- almacén de China (anomalía de antes), uno con el rol «operario» (que en
-- Venezuela no sirve), uno con dos modos y uno que nadie toca hasta el paso 9.
-- En B, uno de Venezuela.
insert into public.operario_pins
  (id, tenant_id, warehouse_id, display_name, display_name_cn, pin_hash, role, roles, active, region)
select pg_temp.fixture_id(o.label), pg_temp.fixture_id(o.tenant),
  case when o.warehouse is not null then pg_temp.fixture_id(o.warehouse) end,
  o.name, o.name_cn, extensions.crypt(o.pin, extensions.gen_salt('bf')), o.role, o.roles, true,
  o.region::operario_region
from (values
  ('cn-ana', 'tenant-A', 'wh-yiw', 'Ana China', '安娜', '5824', 'operario', array['operario'], 'cn'),
  ('cn-bruno', 'tenant-A', 'wh-yiw', 'Bruno Supervisor', null, '3071', 'supervisor', array['supervisor'], 'cn'),
  ('cn-viejo', 'tenant-A', 'wh-cerrado', 'Viejo Almacén', null, '6193', 'operario', array[]::text[], 'cn'),
  ('ve-luis', 'tenant-A', null, 'Luis Hernández', null, '4706', 'camionero', array['camionero'], 've'),
  ('ve-carla', 'tenant-A', null, 'Carla Bodega', null, '2958', 'bodeguero', array['bodeguero'], 've'),
  ('ve-almacen', 'tenant-A', 'wh-yiw', 'Raro Con Almacén', null, '7314', 'camionero', array['camionero'], 've'),
  ('ve-operario', 'tenant-A', null, 'Legado Operario', null, '8642', 'operario', array['operario'], 've'),
  ('ve-multi', 'tenant-A', null, 'Multi Modos', null, '5170', 'bodeguero', array['bodeguero', 'camionero'], 've'),
  ('ve-quieto', 'tenant-A', null, 'Quieto Sin Cambios', null, '9036', 'camionero', array['camionero'], 've'),
  ('b-ve', 'tenant-B', null, 'Otro Tenant', null, '4706', 'camionero', array['camionero'], 've')
) as o(label, tenant, warehouse, name, name_cn, pin, role, roles, region);

-- Foto de pg_proc en public antes de 0480: sólo puede tocar sus funciones.
create temporary table baseline_functions as
select p.oid, p.proname, to_jsonb(p) as definition
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';

-- Dos veces: el preflight acepta su propio estado, así que re-aplicar es inocuo.
\if :apply_fix
\ir ../migrations/0480_operarios_editar_por_region.sql
\ir ../migrations/0480_operarios_editar_por_region.sql
\endif

-- ── Utilidades ──────────────────────────────────────────────
-- Corre una sentencia como p_role, con la sesión de p_user (null = sin sesión).
-- Devuelve {ok, state, message}.
create function pg_temp.run_as(p_role text, p_user text, p_sql text) returns jsonb language plpgsql as $$
declare v_state text; v_message text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(pg_temp.fixture_id(p_user)::text, ''), true);
  execute format('set local role %I', p_role);
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return jsonb_build_object('ok', v_state is null, 'state', v_state, 'message', v_message);
end;
$$;
-- La llamada de la app: admin_update_operario(operario, nombre, nombre chino, rol, almacén).
create function pg_temp.update_sql(p_operario text, p_name text, p_name_cn text, p_role text,
  p_warehouse text) returns text language sql as $$
  select format('select public.admin_update_operario(%L::uuid, %L, %L, %L, %L::uuid)',
    coalesce(pg_temp.fixture_id(p_operario), '00000000-0000-4000-8000-000000000480'::uuid),
    p_name, p_name_cn, p_role, pg_temp.fixture_id(p_warehouse))
$$;
-- La fila tal como la ve la app, más xmin: si cambia, alguien la escribió.
create function pg_temp.snap(p_operario text) returns jsonb language sql volatile as $$
  select jsonb_build_object('display_name', op.display_name, 'display_name_cn', op.display_name_cn,
    'role', op.role, 'roles', op.roles, 'warehouse_id', op.warehouse_id, 'region', op.region,
    'xmin', op.xmin::text)
  from public.operario_pins op where op.id = pg_temp.fixture_id(p_operario)
$$;
create function pg_temp.events(p_operario text) returns bigint language sql volatile as $$
  select count(*) from public.entity_audit_log
  where entity_type = 'operario' and entity_id = pg_temp.fixture_id(p_operario) and event_type = 'operario_updated'
$$;
-- El último evento de edición, con los campos que importan.
create function pg_temp.last_event(p_operario text) returns jsonb language sql volatile as $$
  select jsonb_build_object('tenant_id', e.tenant_id, 'actor_type', e.actor_type, 'actor_id', e.actor_id,
    'source', e.source, 'result', e.result, 'reason', e.reason, 'sensitivity', e.sensitivity,
    'before', e.before_data, 'after', e.after_data, 'payload', e.payload,
    'correlation', e.correlation_id like 'operario_updated:%')
  from public.entity_audit_log e
  where e.entity_type = 'operario' and e.entity_id = pg_temp.fixture_id(p_operario)
    and e.event_type = 'operario_updated'
  order by e.occurred_at desc limit 1
$$;
-- El login real como lo llama la app: devuelve el rol y los modos con que entra.
create function pg_temp.login(p_pin text, p_tenant text, p_region text) returns jsonb language sql volatile as $$
  select jsonb_build_object('id', v.operario_id, 'role', v.role, 'roles', v.roles)
  from public.verify_operario_pin(p_pin, pg_temp.fixture_id(p_tenant), p_region::operario_region, repeat('a', 64)) as v
$$;
create function pg_temp.set_override(p_role text, p_view boolean, p_edit boolean) returns void language sql volatile as $$
  delete from public.studio_role_module_overrides
   where tenant_id = pg_temp.fixture_id('tenant-A') and role = p_role and module_id = 'operarios';
  insert into public.studio_role_module_overrides (tenant_id, role, module_id, can_view, can_edit)
  select pg_temp.fixture_id('tenant-A'), p_role, 'operarios', p_view, p_edit
  where p_view is not null;
$$;

\if :fixture_only
\quit
\endif

create temporary sequence assertion_count;
create function pg_temp.check(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0480: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;
-- Un rechazo de la base: el código, el mensaje, la fila intacta y sin evento.
create function pg_temp.rejects(p_user text, p_operario text, p_name text, p_name_cn text, p_role text,
  p_warehouse text, p_state text, p_message text, p_label text) returns void language plpgsql as $$
declare
  v_before jsonb := pg_temp.snap(p_operario);
  v_events bigint := pg_temp.events(p_operario);
  v_result jsonb := pg_temp.run_as('authenticated', p_user,
    pg_temp.update_sql(p_operario, p_name, p_name_cn, p_role, p_warehouse));
begin
  perform pg_temp.check(v_result->>'state' = p_state
      and (p_message is null or v_result->>'message' = p_message),
    p_label || ' (' || coalesce(v_result->>'state', 'ok') || ': ' || coalesce(v_result->>'message', '') || ')');
  perform pg_temp.check(pg_temp.snap(p_operario) is not distinct from v_before
      and pg_temp.events(p_operario) = v_events,
    p_label || ': la fila no cambia y no queda evento');
end;
$$;
create function pg_temp.saves(p_user text, p_operario text, p_name text, p_name_cn text, p_role text,
  p_warehouse text, p_label text) returns void language plpgsql as $$
declare
  v_result jsonb := pg_temp.run_as('authenticated', p_user,
    pg_temp.update_sql(p_operario, p_name, p_name_cn, p_role, p_warehouse));
begin
  perform pg_temp.check((v_result->>'ok')::boolean,
    p_label || ' (' || coalesce(v_result->>'state', 'ok') || ': ' || coalesce(v_result->>'message', '') || ')');
end;
$$;

-- 1. El defecto: un camionero de Venezuela se edita con un rol de despacho y
--    sin almacén, y entra por /m/ve con el modo nuevo.
do $venezuela$
declare v_snap jsonb; v_event jsonb;
begin
  -- Un motivo que quedó en la sesión de otra operación no se cuela en el evento.
  perform set_config('dtd.audit_reason', 'motivo de otra operación', true);
  perform pg_temp.saves('operations-A', 've-luis', 'Luis Hernández', null, 'bodeguero', null,
    'operations cambia el rol de un camionero de Venezuela a bodeguero, sin almacén');
  perform set_config('dtd.audit_reason', '', true);
  v_snap := pg_temp.snap('ve-luis');
  perform pg_temp.check(v_snap->>'role' = 'bodeguero' and v_snap->'roles' = '["bodeguero"]'::jsonb
      and v_snap->'warehouse_id' = 'null'::jsonb and v_snap->>'region' = 've',
    'el rol y sus modos cambian juntos; sigue de Venezuela y sin almacén');
  perform pg_temp.check(pg_temp.login('4706', 'tenant-A', 've')
      = jsonb_build_object('id', pg_temp.fixture_id('ve-luis'), 'role', 'bodeguero', 'roles', '["bodeguero"]'::jsonb),
    'Luis entra por /m/ve con su PIN de siempre, ya como bodeguero');
  v_event := pg_temp.last_event('ve-luis');
  perform pg_temp.check(pg_temp.events('ve-luis') = 1
      and v_event = jsonb_build_object('tenant_id', pg_temp.fixture_id('tenant-A'), 'actor_type', 'user',
        'actor_id', pg_temp.fixture_id('operations-A'), 'source', 'rpc', 'result', 'succeeded',
        'reason', null, 'sensitivity', 'internal',
        'before', '{"region": "ve", "role": "camionero", "roles": ["camionero"], "warehouse_id": null}'::jsonb,
        'after', '{"region": "ve", "role": "bodeguero", "roles": ["bodeguero"], "warehouse_id": null}'::jsonb,
        'payload', '{"cambios": ["role", "roles"]}'::jsonb, 'correlation', true),
    'el cambio de rol deja un evento operario_updated con quién, antes, después y qué cambió');
  perform pg_temp.saves('admin-A', 've-luis', 'Luis Hernández', null, 'camionero', null,
    'admin lo devuelve a camionero');
  perform pg_temp.check(pg_temp.login('4706', 'tenant-A', 've')->'roles' = '["camionero"]'::jsonb
      and pg_temp.events('ve-luis') = 2
      and pg_temp.last_event('ve-luis')->>'actor_id' = pg_temp.fixture_id('admin-A')::text,
    'y vuelve a entrar como camionero, con un segundo evento a nombre de admin');
  perform pg_temp.saves('operations-A', 've-luis', 'Luis A. Hernández', null, 'camionero', null,
    'operations corrige el nombre de un operario de Venezuela');
  perform pg_temp.check(pg_temp.snap('ve-luis')->>'display_name' = 'Luis A. Hernández'
      and pg_temp.last_event('ve-luis')->'payload' = '{"cambios": ["display_name"]}'::jsonb
      and pg_temp.last_event('ve-luis')->'before' = pg_temp.last_event('ve-luis')->'after',
    'cambiar sólo el nombre cambia sólo el nombre, y el evento lo dice');
  perform pg_temp.check(not exists (select 1 from public.entity_audit_log e
      where e.entity_type = 'operario' and e.event_type = 'operario_updated'
        and (concat_ws(' ', e.before_data::text, e.after_data::text, e.payload::text, e.reason) like '%Luis%'
          or concat_ws(' ', e.before_data::text, e.after_data::text, e.payload::text, e.reason) like '%Hernández%')),
    'los nombres no se copian al evento: basta el id');
end;
$venezuela$;

-- 2. Catálogo: la única fuente de la regla y quién ejecuta qué.
do $catalogo$
begin
  perform pg_temp.check(public.operario_roles_por_region()
      = '{"cn": ["operario", "supervisor"], "ve": ["bodeguero", "camionero", "supervisor"]}'::jsonb
      and jsonb_typeof(public.operario_roles_por_region()->'cn') = 'array',
    'operario_roles_por_region(): China operario y supervisor; Venezuela bodeguero, camionero y supervisor, en ese orden');
  perform pg_temp.check((select array_agg(k order by k) from jsonb_object_keys(public.operario_roles_por_region()) k)
      = (select array_agg(e::text order by e::text) from unnest(enum_range(null::operario_region)) e),
    'una entrada por cada región del enum');
  perform pg_temp.check(has_function_privilege('authenticated', 'public.operario_roles_por_region()', 'EXECUTE')
      and not has_function_privilege('anon', 'public.operario_roles_por_region()', 'EXECUTE')
      and not has_function_privilege('service_role', 'public.operario_roles_por_region()', 'EXECUTE'),
    'el Studio (authenticated) lee los roles de cada región; anon y service_role no');
  perform pg_temp.check(has_function_privilege('authenticated', 'public.admin_update_operario(uuid,text,text,text,uuid)', 'EXECUTE')
      and not has_function_privilege('anon', 'public.admin_update_operario(uuid,text,text,text,uuid)', 'EXECUTE'),
    'admin_update_operario: authenticated sí, anon no');
  perform pg_temp.check((select p.prosecdef and p.proconfig = array['search_path=""']
      from pg_proc p where p.oid = 'public.admin_update_operario(uuid,text,text,text,uuid)'::regprocedure),
    'admin_update_operario es DEFINER con search_path vacío');
end;
$catalogo$;

-- 3. La regla sale de la base: cada rol que se ofrece pasa los CHECK de
--    operario_pins en su región, los que los CHECK rechazan no se ofrecen, y la
--    única diferencia es «operario» en Venezuela (ninguna RPC de /m/ve lo acepta).
do $derivacion$
declare
  v_region text;
  v_role text;
  v_table boolean;
  v_offered boolean;
  v_diff text[] := array[]::text[];
begin
  foreach v_region in array array['cn', 've'] loop
    foreach v_role in array array['operario', 'supervisor', 'bodeguero', 'camionero'] loop
      begin
        insert into public.operario_pins (tenant_id, warehouse_id, display_name, pin_hash, role, roles, region)
        values (pg_temp.fixture_id('tenant-A'),
          case when v_region = 'cn' then pg_temp.fixture_id('wh-gz') end,
          'sonda ' || v_region || ' ' || v_role, 'x', v_role, array[v_role], v_region::operario_region);
        raise exception 'deshacer la sonda' using errcode = 'P0999';
      exception
        when sqlstate 'P0999' then v_table := true;
        when check_violation then v_table := false;
      end;
      v_offered := coalesce((public.operario_roles_por_region()->v_region) ? v_role, false);
      perform pg_temp.check(not v_offered or v_table,
        format('el rol %s que se ofrece en %s pasa los CHECK de operario_pins', v_role, v_region));
      if v_table and not v_offered then v_diff := v_diff || (v_region || ':' || v_role); end if;
    end loop;
  end loop;
  perform pg_temp.check(v_diff = array['ve:operario'],
    'lo que la tabla admite y no se ofrece es sólo operario en Venezuela (' || array_to_string(v_diff, ', ') || ')');
  perform pg_temp.check(not exists (select 1 from public.operario_pins where display_name like 'sonda %'),
    'las sondas no quedan');
end;
$derivacion$;

-- 4. La matriz de módulos decide, como en alta, restablecimiento y «Ver PIN».
--    Un guardado sin cambios basta: el candado corre antes que todo.
do $matriz$
declare v_user text;
begin
  foreach v_user in array array['admin-A', 'operations-A'] loop
    perform pg_temp.saves(v_user, 'cn-ana', 'Ana China', '安娜', 'operario', 'wh-yiw', v_user || ' puede editar');
  end loop;
  foreach v_user in array array['commercial-A', 'accounting-A', 'warehouse-A', 'support-A', 'marketing-A',
      'operations-off-A'] loop
    perform pg_temp.rejects(v_user, 'cn-ana', 'Ana China', '安娜', 'operario', 'wh-yiw', '42501',
      'No tienes permiso para realizar esta acción', v_user || ' no edita');
  end loop;
  perform pg_temp.rejects(null, 'cn-ana', 'Ana China', '安娜', 'operario', 'wh-yiw', '42501', null,
    'sin sesión no se edita');
  -- Los desvíos de 0357, en las dos direcciones.
  perform pg_temp.set_override('commercial', true, true);
  perform pg_temp.saves('commercial-A', 'cn-ana', 'Ana China', '安娜', 'operario', 'wh-yiw',
    'commercial con el desvío (ver y editar) edita');
  perform pg_temp.set_override('operations', true, false);
  perform pg_temp.rejects('operations-A', 'cn-ana', 'Ana China', '安娜', 'operario', 'wh-yiw', '42501', null,
    'operations con el desvío (ver sí, editar no) no edita');
  perform pg_temp.set_override('support', true, true);
  perform pg_temp.rejects('support-A', 'cn-ana', 'Ana China', '安娜', 'operario', 'wh-yiw', '42501', null,
    'support no edita ni con el desvío');
  perform pg_temp.set_override('commercial', null, null);
  perform pg_temp.set_override('operations', null, null);
  perform pg_temp.set_override('support', null, null);
  -- Sin permiso no hay oráculo de ids; con permiso, un id que no existe es P0014.
  perform pg_temp.check(pg_temp.run_as('authenticated', 'commercial-A',
      pg_temp.update_sql(null, 'Nadie', null, 'operario', 'wh-yiw'))->>'state' = '42501',
    'sin permiso, un id que no existe también da 42501');
  perform pg_temp.check(pg_temp.run_as('authenticated', 'operations-A',
      pg_temp.update_sql(null, 'Nadie', null, 'operario', 'wh-yiw')) = jsonb_build_object('ok', false,
        'state', 'P0014', 'message', 'Operario no encontrado'),
    'con permiso, un id que no existe da P0014');
  -- Otro tenant: la matriz de B no alcanza a los operarios de A.
  perform pg_temp.rejects('operations-B', 've-luis', 'Luis', null, 'bodeguero', null, '42501', null,
    'operations de otro tenant no edita un operario de A');
  perform pg_temp.rejects('admin-B', 've-luis', 'Luis', null, 'bodeguero', null, '42501', null,
    'admin de otro tenant tampoco');
  perform pg_temp.check(pg_temp.events('cn-ana') = 0,
    'los guardados sin cambios de la matriz no dejaron evento');
end;
$matriz$;

-- 5. El rol: de los de su región, exacto y nunca por defecto.
do $rol$
begin
  perform pg_temp.rejects('operations-A', 'cn-ana', 'Ana China', '安娜', 'bodeguero', 'wh-yiw', 'P0012',
    'Ese rol no corresponde a la región del operario. Elige uno de la lista.', 'China no acepta bodeguero');
  perform pg_temp.rejects('operations-A', 'cn-ana', 'Ana China', '安娜', 'camionero', 'wh-yiw', 'P0012', null,
    'China no acepta camionero');
  perform pg_temp.rejects('operations-A', 've-carla', 'Carla Bodega', null, 'operario', null, 'P0012', null,
    'Venezuela no acepta operario');
  perform pg_temp.rejects('operations-A', 'cn-ana', 'Ana China', '安娜', null, 'wh-yiw', 'P0012', null,
    'sin rol no hay rol por defecto (China, donde «operario» sería válido)');
  perform pg_temp.rejects('operations-A', 've-carla', 'Carla Bodega', null, null, null, 'P0012', null,
    'sin rol no hay rol por defecto');
  perform pg_temp.rejects('operations-A', 've-carla', 'Carla Bodega', null, '', null, 'P0012', null,
    'un rol vacío tampoco');
  perform pg_temp.rejects('operations-A', 've-carla', 'Carla Bodega', null, 'Camionero', null, 'P0012', null,
    'el rol se compara exacto');
  perform pg_temp.rejects('operations-A', 've-carla', 'Carla Bodega', null, 'jefe', null, 'P0012', null,
    'un rol que no existe');
  -- Uno de Venezuela con «operario» no lo conserva al guardar: tiene que elegir.
  perform pg_temp.rejects('operations-A', 've-operario', 'Legado Operario Corregido', null, 'operario', null,
    'P0012', null, 'un operario de Venezuela con el rol «operario» no se guarda conservándolo');
  perform pg_temp.saves('operations-A', 've-operario', 'Legado Operario', null, 'supervisor', null,
    'eligiendo supervisor sí se guarda');
  perform pg_temp.check(pg_temp.snap('ve-operario')->>'role' = 'supervisor'
      and pg_temp.snap('ve-operario')->'roles' = '["supervisor"]'::jsonb,
    'y sus modos pasan a supervisor');
  perform pg_temp.saves('operations-A', 've-carla', 'Carla Bodega', null, 'supervisor', null,
    'Venezuela acepta supervisor');
  perform pg_temp.saves('operations-A', 'cn-bruno', 'Bruno Supervisor', null, 'operario', 'wh-yiw',
    'China pasa de supervisor a operario');
  perform pg_temp.check(pg_temp.snap('cn-bruno')->'roles' = '["operario"]'::jsonb
      and pg_temp.login('3071', 'tenant-A', 'cn')->'roles' = '["operario"]'::jsonb,
    'y entra por /m/cn con el modo operario');
end;
$rol$;

-- 6. El nombre: obligatorio, recortado y sin repetir en el almacén.
do $nombre$
begin
  perform pg_temp.rejects('operations-A', 'cn-bruno', '   ', null, 'operario', 'wh-yiw', 'P0011',
    'Escribe el nombre del operario.', 'nombre en blanco');
  perform pg_temp.rejects('operations-A', 'cn-bruno', null, null, 'operario', 'wh-yiw', 'P0011', null,
    'nombre nulo');
  perform pg_temp.rejects('operations-A', 'cn-bruno', 'Ana China', null, 'operario', 'wh-yiw', 'P0013',
    'Ya hay un operario con ese nombre en ese almacén.', 'el nombre de otro operario del mismo almacén');
  perform pg_temp.saves('operations-A', 'cn-bruno', '  Bruno Pérez  ', '  布鲁诺  ', 'operario', 'wh-yiw',
    'nombres con espacios alrededor');
  perform pg_temp.check(pg_temp.snap('cn-bruno')->>'display_name' = 'Bruno Pérez'
      and pg_temp.snap('cn-bruno')->>'display_name_cn' = '布鲁诺',
    'se guardan recortados');
  perform pg_temp.saves('operations-A', 'cn-bruno', 'Bruno Pérez', '   ', 'operario', 'wh-yiw',
    'nombre chino en blanco');
  perform pg_temp.check(pg_temp.snap('cn-bruno')->'display_name_cn' = 'null'::jsonb
      and pg_temp.last_event('cn-bruno')->'payload' = '{"cambios": ["display_name_cn"]}'::jsonb,
    'queda vacío y el evento dice que cambió');
  -- En Venezuela no hay almacén: dos con el mismo nombre no chocan.
  perform pg_temp.saves('operations-A', 've-multi', 'Carla Bodega', null, 'bodeguero', null,
    'en Venezuela el nombre no choca con el de otro sin almacén');
  perform pg_temp.saves('operations-A', 've-multi', 'Multi Modos', null, 'bodeguero', null, 'y vuelve');
end;
$nombre$;

-- 7. El almacén: China, uno activo (o el que ya tenía); Venezuela, ninguno.
do $almacen$
declare v_event jsonb;
begin
  perform pg_temp.rejects('operations-A', 'cn-ana', 'Ana China', '安娜', 'operario', null, 'P0023',
    'Elige el almacén de China del operario.', 'China sin almacén');
  perform pg_temp.rejects('operations-A', 'cn-ana', 'Ana China', '安娜', 'operario', 'wh-inventado', 'P0023',
    'Ese almacén no existe o ya no está activo. Elige otro.', 'China con un almacén que no existe');
  perform pg_temp.rejects('operations-A', 'cn-ana', 'Ana China', '安娜', 'operario', 'wh-cerrado', 'P0023',
    'Ese almacén no existe o ya no está activo. Elige otro.', 'China con un almacén desactivado');
  perform pg_temp.saves('operations-A', 'cn-ana', 'Ana China', '安娜', 'operario', 'wh-gz',
    'China pasa a otro almacén activo');
  perform pg_temp.check(pg_temp.snap('cn-ana')->>'warehouse_id' = pg_temp.fixture_id('wh-gz')::text
      and pg_temp.last_event('cn-ana')->'payload' = '{"cambios": ["warehouse_id"]}'::jsonb
      and pg_temp.last_event('cn-ana')->'before'->>'warehouse_id' = pg_temp.fixture_id('wh-yiw')::text
      and pg_temp.last_event('cn-ana')->'after'->>'warehouse_id' = pg_temp.fixture_id('wh-gz')::text,
    'y el evento lleva el almacén de antes y el de después');
  perform pg_temp.saves('operations-A', 'cn-viejo', 'Viejo Almacén Renombrado', null, 'operario', 'wh-cerrado',
    'uno de China conserva su almacén aunque se haya desactivado');
  perform pg_temp.rejects('operations-A', 've-carla', 'Carla Bodega', null, 'supervisor', 'wh-yiw', 'P0023',
    'Los operarios de Venezuela no llevan almacén: son de despacho.', 'Venezuela con almacén');
  perform pg_temp.rejects('operations-A', 've-almacen', 'Raro Con Almacén', null, 'camionero', 'wh-yiw', 'P0023',
    null, 'uno de Venezuela que tenía almacén no lo conserva');
  perform pg_temp.saves('operations-A', 've-almacen', 'Raro Con Almacén', null, 'camionero', null,
    'guardado sin almacén, se le quita');
  v_event := pg_temp.last_event('ve-almacen');
  perform pg_temp.check(pg_temp.snap('ve-almacen')->'warehouse_id' = 'null'::jsonb
      and v_event->'payload' = '{"cambios": ["warehouse_id"]}'::jsonb
      and v_event->'before'->>'warehouse_id' = pg_temp.fixture_id('wh-yiw')::text
      and v_event->'after'->'warehouse_id' = 'null'::jsonb,
    'y el evento dice qué almacén tenía');
end;
$almacen$;

-- 8. Los modos de la app: con uno solo siguen al rol; con varios, el rol es uno
--    de ellos y los modos no cambian. Modos vacíos (anteriores a 0066) cuentan
--    como el rol.
do $modos$
begin
  perform pg_temp.saves('operations-A', 've-multi', 'Multi Modos', null, 'camionero', null,
    'con dos modos, el rol pasa a otro de ellos');
  perform pg_temp.check(pg_temp.snap('ve-multi')->>'role' = 'camionero'
      and pg_temp.snap('ve-multi')->'roles' = '["bodeguero", "camionero"]'::jsonb
      and pg_temp.last_event('ve-multi')->'payload' = '{"cambios": ["role"]}'::jsonb,
    'y los modos no cambian');
  perform pg_temp.rejects('operations-A', 've-multi', 'Multi Modos', null, 'supervisor', null, 'P0012',
    'Este operario entra con los modos bodeguero, camionero: su rol tiene que ser uno de ellos.',
    'con dos modos, un rol fuera de ellos no');
  perform pg_temp.saves('operations-A', 'cn-viejo', 'Viejo Almacén', null, 'operario', 'wh-cerrado',
    'sin modos guardados, cambiar sólo el nombre');
  perform pg_temp.check(pg_temp.snap('cn-viejo')->'roles' = '[]'::jsonb,
    'deja los modos vacíos como estaban');
  perform pg_temp.saves('operations-A', 'cn-viejo', 'Viejo Almacén', null, 'supervisor', 'wh-cerrado',
    'sin modos guardados, cambiar el rol');
  perform pg_temp.check(pg_temp.snap('cn-viejo')->'roles' = '["supervisor"]'::jsonb
      and pg_temp.last_event('cn-viejo')->'payload' = '{"cambios": ["role", "roles"]}'::jsonb,
    'le da el modo del rol nuevo');
end;
$modos$;

-- 9. Guardar sin cambios no escribe ni deja evento; y la edición compara con la
--    fila bloqueada (FOR UPDATE), así que lo de antes del evento es lo que hay.
do $sin_cambios$
declare
  v_before jsonb := pg_temp.snap('ve-quieto');
  v_xmax text := (select xmax::text from public.operario_pins where id = pg_temp.fixture_id('ve-quieto'));
begin
  perform pg_temp.check(v_xmax = '0', 'nadie bloqueó todavía al operario quieto');
  perform pg_temp.saves('operations-A', 've-quieto', '  Quieto Sin Cambios ', '  ', 'camionero', null,
    'guardar lo mismo (con espacios que se recortan)');
  perform pg_temp.check(pg_temp.snap('ve-quieto') = v_before and pg_temp.events('ve-quieto') = 0,
    'no escribe la fila ni deja evento');
  perform pg_temp.check((select xmax::text from public.operario_pins where id = pg_temp.fixture_id('ve-quieto')) <> '0',
    'pero sí bloqueó la fila mientras comparaba');
end;
$sin_cambios$;

-- 10. AUD-01: si el evento no se puede escribir, nada cambia.
do $auditoria_falla$
declare v_before jsonb := pg_temp.snap('ve-luis'); v_result jsonb;
begin
  update public.audit_entity_types set status = 'deprecated', deprecated_at = now() where entity_type = 'operario';
  v_result := pg_temp.run_as('authenticated', 'operations-A',
    pg_temp.update_sql('ve-luis', 'Luis A. Hernández', null, 'bodeguero', null));
  perform pg_temp.check(v_result->>'state' = '23503' and v_result->>'message' = 'audit: entity_type inexistente o inactivo',
    'sin el tipo de auditoría la edición falla');
  perform pg_temp.check(pg_temp.snap('ve-luis') = v_before, 'y el operario no cambia');
  update public.audit_entity_types set status = 'active', deprecated_at = null where entity_type = 'operario';
end;
$auditoria_falla$;

-- 11. 0480 sólo toca sus dos funciones; desactivar sigue como en 0475.
do $sin_danos$
begin
  perform pg_temp.check(not exists (
    select 1 from baseline_functions b
    full join (select p.oid, p.proname, to_jsonb(p) as definition
               from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public') c on c.oid = b.oid
    where coalesce(b.proname, c.proname) not in ('admin_update_operario', 'operario_roles_por_region')
      and (b.oid is null or c.oid is null or b.definition <> c.definition)),
    '0480 no toca ninguna otra función de public (admin_set_operario_active, alta, restablecer, «Ver PIN» y login incluidas)');
  perform pg_temp.check((select count(*) from pg_proc where pronamespace = 'public'::regnamespace
      and proname in ('admin_update_operario', 'operario_roles_por_region')) = 2,
    'sin sobrecargas, aunque 0480 corrió dos veces');
  perform pg_temp.check(position('assert_studio_role' in (select prosrc from pg_proc
      where oid = 'public.admin_set_operario_active(uuid,boolean)'::regprocedure)) > 0,
    'desactivar conserva su candado de 0475 (fuera de alcance de 0480)');
end;
$sin_danos$;

select 'TEST 0480 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
