\set ON_ERROR_STOP on
-- SDD-0515 · Contrato de 0475: nadie lee pin_hash desde la API, la matriz de
-- módulos decide quién ve y quién restablece o crea, cada alta y cada
-- restablecimiento quedan auditados sin el PIN, y no hay dos operarios activos
-- con el mismo PIN en el mismo tenant y región. Fixture sintético aislado; no
-- ejecutar sobre una DB real. Termina en ROLLBACK.
-- RED: psql -v apply_fix=false -f /sb/tests/0475_pin_operarios_endurecer.test.sql
--
-- El ANTES sale de los archivos reales donde se puede: 0021, 0037, 0351 y 0325
-- por \ir, la auditoría 0258/0261/0267/0294 y los desvíos de 0357. Donde un
-- archivo arrastra demasiado (0020 crea recepciones y siembra un operario;
-- 0453 reescribe los helpers del Portal) se copian VERBATIM sus sentencias:
-- get_user_tenant_id() de 0453, current_studio_role() de 0200,
-- assert_tenant_match() de 0012 con la ACL de 0211, la ACL y la RLS de
-- operario_pins de 0020, el enum de 0023 y el search_path de 0210. El
-- envoltorio lib/studio/__tests__/pin-operarios-endurecer.migration.test.ts
-- comprueba que las copias siguen iguales a los archivos. operario_pins tiene
-- las 14 columnas de producción (0020, 0023, 0060, 0066).
--
-- fixture_only=true deja la base montada, con 0475 aplicada, dentro de la
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
    raise exception 'TEST 0475: fixture rechazada, la base ya contiene objetos de aplicación';
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

-- ── ANTES: operario_pins con sus 14 columnas, ACL y RLS de 0020 ──
create type operario_region as enum ('cn', 've');
create table public.operario_pins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  warehouse_id uuid,
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

-- Las RPC de Operarios reales: 0021 (policy, grants), 0037 (validador) con el
-- search_path de 0210, y 0351 (candado de rol), que es lo que corre hoy.
\ir ../migrations/0021_operario_admin_rpcs.sql
\ir ../migrations/0037_harden_operario_pin_validator.sql
alter function public.validate_operario_pin_format(p_pin text) set search_path = public;
\ir ../migrations/0351_operario_rpc_exige_rol.sql
-- El login real (0325): tenant + región + una sola coincidencia.
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

-- ── Semilla sintética ───────────────────────────────────────
create function pg_temp.fixture_id(p_label text) returns uuid language sql immutable as $$
  select md5('0475-synthetic-' || p_label)::uuid
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
-- Operarios: en A dos activos de China, uno de baja y uno de Venezuela; en B uno.
insert into public.operario_pins (id, tenant_id, warehouse_id, display_name, pin_hash, role, active, region)
select pg_temp.fixture_id(o.label), pg_temp.fixture_id(o.tenant),
  case when o.region = 'cn' then pg_temp.fixture_id('wh-' || o.tenant) end,
  o.label, extensions.crypt(o.pin, extensions.gen_salt('bf')), o.role, o.active, o.region::operario_region
from (values
  ('cn-1', 'tenant-A', '5824', 'operario', true, 'cn'),
  ('cn-2', 'tenant-A', '3071', 'operario', true, 'cn'),
  ('cn-baja', 'tenant-A', '6193', 'operario', false, 'cn'),
  ('ve-1', 'tenant-A', '4706', 'camionero', true, 've'),
  ('b-cn', 'tenant-B', '8352', 'operario', true, 'cn')
) as o(label, tenant, pin, role, active, region);

-- Foto de pg_proc en public antes de 0475: sólo puede tocar sus cinco funciones.
create temporary table baseline_functions as
select p.oid, p.proname, to_jsonb(p) as definition
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';

-- Dos veces: el preflight acepta su propio estado, así que re-aplicar es inocuo.
\if :apply_fix
\ir ../migrations/0475_pin_operarios_endurecer.sql
\ir ../migrations/0475_pin_operarios_endurecer.sql
\endif

-- ── Utilidades ──────────────────────────────────────────────
-- Corre una sentencia como p_role, con la sesión de p_user (null = sin sesión).
-- Devuelve {ok, state, message}; y read_as, el texto de la primera columna.
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
create function pg_temp.read_as(p_role text, p_user text, p_sql text) returns text language plpgsql as $$
declare v_value text; v_state text; v_message text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(pg_temp.fixture_id(p_user)::text, ''), true);
  execute format('set local role %I', p_role);
  begin
    execute p_sql into v_value;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    v_value := 'ERROR ' || v_state;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return v_value;
end;
$$;
create function pg_temp.reset_sql(p_operario text, p_pin text) returns text language sql as $$
  select format('select public.admin_reset_operario_pin(%L::uuid, %L)', pg_temp.fixture_id(p_operario), p_pin)
$$;
create function pg_temp.create_sql(p_tenant text, p_name text, p_pin text) returns text language sql as $$
  select format('select public.admin_create_operario(%L::uuid, %L::uuid, %L, null, %L, %L)',
    pg_temp.fixture_id(p_tenant), pg_temp.fixture_id('wh-' || p_tenant), p_name, p_pin, 'operario')
$$;
create function pg_temp.hash_of(p_operario text) returns text language sql volatile as $$
  select pin_hash from public.operario_pins where id = pg_temp.fixture_id(p_operario)
$$;
-- El login real como lo llama la app (service_role, huella de 64 hex).
create function pg_temp.login(p_pin text, p_tenant text, p_region text) returns uuid language sql volatile as $$
  select v.operario_id from public.verify_operario_pin(p_pin, pg_temp.fixture_id(p_tenant),
    p_region::operario_region, repeat('a', 64)) as v
$$;
create function pg_temp.events(p_entity uuid) returns bigint language sql volatile as $$
  select count(*) from public.entity_audit_log where entity_type = 'operario' and entity_id = p_entity
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
  if p_value is distinct from true then raise exception 'TEST 0475: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- 1. pin_hash fuera de la API: ni authenticated, ni service_role, ni anon; las
--    otras 13 columnas siguen legibles por columna para authenticated y service_role.
do $catalogo$
declare v_column text;
begin
  perform pg_temp.check(not has_column_privilege('authenticated', 'public.operario_pins', 'pin_hash', 'SELECT'),
    'authenticated no tiene SELECT sobre pin_hash');
  perform pg_temp.check(not has_column_privilege('service_role', 'public.operario_pins', 'pin_hash', 'SELECT'),
    'service_role no tiene SELECT sobre pin_hash');
  perform pg_temp.check(not has_any_column_privilege('anon', 'public.operario_pins', 'SELECT'),
    'anon no lee ninguna columna');
  foreach v_column in array array['id', 'tenant_id', 'warehouse_id', 'region', 'display_name',
    'display_name_cn', 'role', 'roles', 'active', 'last_login_at', 'created_at', 'updated_at', 'tms_driver_id'] loop
    perform pg_temp.check(has_column_privilege('authenticated', 'public.operario_pins', v_column, 'SELECT')
      and has_column_privilege('service_role', 'public.operario_pins', v_column, 'SELECT'),
      'authenticated y service_role leen ' || v_column);
  end loop;
  perform pg_temp.check(has_table_privilege('service_role', 'public.operario_pins', 'INSERT')
      and has_table_privilege('service_role', 'public.operario_pins', 'UPDATE')
      and has_table_privilege('service_role', 'public.operario_pins', 'DELETE'),
    'service_role conserva la escritura');
end;
$catalogo$;

-- 2. Nadie del personal lee pin_hash, tampoco admin; service_role tampoco.
do $sin_hash$
declare v_user text;
begin
  foreach v_user in array array['admin-A', 'operations-A', 'commercial-A', 'support-A'] loop
    perform pg_temp.check(pg_temp.read_as('authenticated', v_user,
        'select pin_hash from public.operario_pins limit 1') = 'ERROR 42501',
      v_user || ' no lee pin_hash');
  end loop;
  perform pg_temp.check(pg_temp.read_as('service_role', null,
      'select pin_hash from public.operario_pins limit 1') = 'ERROR 42501',
    'service_role no lee pin_hash');
  perform pg_temp.check(pg_temp.read_as('authenticated', 'operations-A',
      'select count(*) from (select * from public.operario_pins) x') = 'ERROR 42501',
    'select * falla: hay que nombrar las columnas');
  perform pg_temp.check(pg_temp.read_as('authenticated', 'operations-A',
      'select count(*) from (select id, tenant_id, warehouse_id, region, display_name, display_name_cn, role, active, last_login_at, created_at from public.operario_pins order by active desc, display_name) x') = '4',
    'la lista de Studio › Operarios sigue funcionando para operations');
  perform pg_temp.check(pg_temp.read_as('service_role', null,
      'select count(*) from (select id, tenant_id, warehouse_id, display_name, display_name_cn, role, roles, region, active, tms_driver_id from public.operario_pins) x') = '5',
    'la sesión del operario (service_role) sigue leyendo sus columnas');
end;
$sin_hash$;

-- 3. Lectura por la matriz: default, desvíos y membresía activa.
do $vista$
begin
  perform pg_temp.check(pg_temp.read_as('authenticated', 'admin-A', 'select count(*) from public.operario_pins') = '4',
    'admin ve los operarios de su tenant');
  perform pg_temp.check(pg_temp.read_as('authenticated', 'operations-A', 'select count(*) from public.operario_pins') = '4',
    'operations ve los operarios de su tenant por default');
  perform pg_temp.check(pg_temp.read_as('authenticated', 'commercial-A', 'select count(*) from public.operario_pins') = '0',
    'commercial no ve los operarios por default');
  perform pg_temp.check(pg_temp.read_as('authenticated', 'support-A', 'select count(*) from public.operario_pins') = '0',
    'support no ve los operarios por default');
  perform pg_temp.check(pg_temp.read_as('authenticated', 'operations-off-A', 'select count(*) from public.operario_pins') = '0',
    'un operations desactivado no ve nada');
  perform pg_temp.check(pg_temp.read_as('authenticated', 'operations-B', 'select count(*) from public.operario_pins') = '1',
    'operations de otro tenant sólo ve los suyos');
  perform pg_temp.check(pg_temp.read_as('anon', null, 'select count(*) from public.operario_pins') = 'ERROR 42501',
    'anon no lee operario_pins');
  -- El helper también se llama directo por PostgREST, con el tenant que uno
  -- quiera: la membresía desactivada no cuenta ni nombrando su tenant.
  perform pg_temp.check(pg_temp.read_as('authenticated', 'operations-off-A',
      format('select public.operarios_module_authorized(%L::uuid, ''edit'')', pg_temp.fixture_id('tenant-A'))) = 'false',
    'el helper no autoriza una membresía desactivada aunque se nombre su tenant');
  perform pg_temp.check(pg_temp.read_as('authenticated', 'operations-B',
      format('select public.operarios_module_authorized(%L::uuid, ''view'')', pg_temp.fixture_id('tenant-A'))) = 'false',
    'el helper no autoriza en un tenant ajeno');
  perform pg_temp.check(pg_temp.read_as('authenticated', 'operations-A',
      format('select public.operarios_module_authorized(%L::uuid, ''borrar'')', pg_temp.fixture_id('tenant-A'))) = 'false',
    'el helper niega un acceso que no es view ni edit');
  perform pg_temp.set_override('commercial', true, false);
  perform pg_temp.check(pg_temp.read_as('authenticated', 'commercial-A', 'select count(*) from public.operario_pins') = '4',
    'un desvío que le da la vista a commercial la abre');
  perform pg_temp.set_override('operations', false, false);
  perform pg_temp.check(pg_temp.read_as('authenticated', 'operations-A', 'select count(*) from public.operario_pins') = '0',
    'un desvío que le quita Operarios a operations la cierra');
  perform pg_temp.set_override('commercial', null, null);
  perform pg_temp.set_override('operations', null, null);
end;
$vista$;

-- 4. Restablecer: operations lo hace, el login entra con el PIN nuevo, el viejo
--    deja de servir y queda UN evento sin el PIN, con el lock por tenant y región.
do $restablecer$
declare
  v_before text := pg_temp.hash_of('cn-2');
  v_result jsonb;
  v_event public.entity_audit_log;
  v_key bigint := hashtextextended('operario_pin:' || pg_temp.fixture_id('tenant-A')::text || ':cn', 0);
begin
  v_result := pg_temp.run_as('authenticated', 'operations-A', pg_temp.reset_sql('cn-2', '7395'));
  perform pg_temp.check((v_result->>'ok')::boolean, 'operations restablece el PIN (' || coalesce(v_result->>'message', '') || ')');
  perform pg_temp.check(pg_temp.hash_of('cn-2') is distinct from v_before, 'el hash cambia');
  perform pg_temp.check(pg_temp.login('7395', 'tenant-A', 'cn') = pg_temp.fixture_id('cn-2'),
    'el login entra con el PIN nuevo');
  perform pg_temp.check(pg_temp.login('3071', 'tenant-A', 'cn') is null, 'el PIN viejo deja de servir');
  perform pg_temp.check(pg_temp.events(pg_temp.fixture_id('cn-2')) = 1, 'queda un solo evento del restablecimiento');
  select * into v_event from public.entity_audit_log
   where entity_type = 'operario' and entity_id = pg_temp.fixture_id('cn-2');
  perform pg_temp.check(v_event.tenant_id = pg_temp.fixture_id('tenant-A')
      and v_event.event_type = 'operario_pin_reset' and v_event.actor_type = 'user'
      and v_event.actor_id = pg_temp.fixture_id('operations-A') and v_event.source = 'rpc'
      and v_event.result = 'succeeded' and v_event.sensitivity = 'restricted'
      and v_event.reason is null and v_event.before_data is null and v_event.payload = '{}'::jsonb
      and v_event.correlation_id like 'operario_pin_reset:%',
    'el evento dice quién, a qué operario, en qué tenant y desde dónde');
  perform pg_temp.check(v_event.after_data = '{"credential": "pin", "region": "cn", "active": true}'::jsonb,
    'el after_data es la credencial rotada, la región y el estado');
  perform pg_temp.check(position('7395' in concat_ws('|', v_event.payload::text, v_event.before_data::text,
      v_event.after_data::text, v_event.reason)) = 0
      and position('$2' in concat_ws('|', v_event.payload::text, v_event.after_data::text)) = 0,
    'la auditoría no guarda el PIN ni el hash');
  perform pg_temp.check(exists (select 1 from pg_catalog.pg_locks l
      where l.locktype = 'advisory' and l.pid = pg_catalog.pg_backend_pid() and l.granted
        and l.classid::bigint = ((v_key >> 32) & 4294967295) and l.objid::bigint = (v_key & 4294967295)
        and l.objsubid = 1),
    'el restablecimiento toma el lock de (tenant, región) hasta el COMMIT');
end;
$restablecer$;

-- 5. Restablecer: la matriz rechaza, sin cambiar el hash ni auditar.
do $denegado$
declare
  v_before text := pg_temp.hash_of('cn-1');
  v_user text;
  v_result jsonb;
begin
  foreach v_user in array array['commercial-A', 'accounting-A', 'warehouse-A', 'support-A', 'marketing-A', 'operations-off-A'] loop
    v_result := pg_temp.run_as('authenticated', v_user, pg_temp.reset_sql('cn-1', '2963'));
    perform pg_temp.check(v_result->>'state' = '42501', v_user || ' no restablece por default');
  end loop;
  perform pg_temp.set_override('operations', true, false);
  perform pg_temp.check(pg_temp.run_as('authenticated', 'operations-A', pg_temp.reset_sql('cn-1', '2963'))->>'state' = '42501',
    'operations con el desvío (ver sí, editar no) no restablece');
  perform pg_temp.set_override('operations', null, null);
  perform pg_temp.set_override('support', true, true);
  perform pg_temp.check(pg_temp.run_as('authenticated', 'support-A', pg_temp.reset_sql('cn-1', '2963'))->>'state' = '42501',
    'support no edita ni con un desvío que lo permita');
  perform pg_temp.set_override('support', null, null);
  perform pg_temp.check(pg_temp.hash_of('cn-1') = v_before and pg_temp.events(pg_temp.fixture_id('cn-1')) = 0,
    'una llamada rechazada no cambia el hash ni deja evento');
  -- El candado corre antes de buscar el operario: sin oráculo de ids.
  perform pg_temp.check(pg_temp.run_as('authenticated', 'commercial-A', pg_temp.reset_sql('no-existe', '2963'))->>'state' = '42501',
    'sin permiso, un id inexistente también da 42501');
  perform pg_temp.check(pg_temp.run_as('authenticated', 'admin-A', pg_temp.reset_sql('no-existe', '2963'))->>'state' = 'P0014',
    'con permiso, un id inexistente da Operario no encontrado');
  v_result := pg_temp.run_as('authenticated', 'operations-B', pg_temp.reset_sql('cn-1', '2963'));
  perform pg_temp.check(v_result->>'state' = '42501' and v_result->>'message' like 'Tenant mismatch%',
    'operations de otro tenant choca con el candado de tenant');
  -- Y un desvío que le da Operarios a commercial le abre el restablecimiento.
  perform pg_temp.set_override('commercial', true, true);
  v_result := pg_temp.run_as('authenticated', 'commercial-A', pg_temp.reset_sql('cn-1', '2963'));
  perform pg_temp.check((v_result->>'ok')::boolean, 'commercial con el desvío (ver y editar) restablece');
  perform pg_temp.check(exists (select 1 from public.entity_audit_log e
      where e.entity_id = pg_temp.fixture_id('cn-1') and e.actor_id = pg_temp.fixture_id('commercial-A')),
    'el evento registra a commercial como actor');
  perform pg_temp.set_override('commercial', null, null);
  -- Vuelve a 5824 para las pruebas de repetidos (con admin: siempre puede).
  perform pg_temp.check((pg_temp.run_as('authenticated', 'admin-A', pg_temp.reset_sql('cn-1', '5824'))->>'ok')::boolean,
    'admin restablece siempre');
end;
$denegado$;

-- 6. PIN repetidos: se rechaza sólo contra otro operario ACTIVO del mismo
--    tenant y región; el operario puede volver a su propio PIN.
do $repetidos$
declare
  v_before text := pg_temp.hash_of('cn-2');
  v_events bigint := pg_temp.events(pg_temp.fixture_id('cn-2'));
  v_result jsonb;
begin
  v_result := pg_temp.run_as('authenticated', 'operations-A', pg_temp.reset_sql('cn-2', '5824'));
  perform pg_temp.check(v_result->>'state' = 'P0018'
      and v_result->>'message' = 'Ese PIN ya lo usa otro operario activo de la misma región. Usa otro o genera uno nuevo.',
    'el PIN de otro operario activo del mismo tenant y región se rechaza con P0018');
  perform pg_temp.check(pg_temp.hash_of('cn-2') = v_before and pg_temp.events(pg_temp.fixture_id('cn-2')) = v_events,
    'el rechazo por repetido no cambia el hash ni deja evento');
  perform pg_temp.check((pg_temp.run_as('authenticated', 'operations-A', pg_temp.reset_sql('ve-1', '5824'))->>'ok')::boolean,
    'el mismo PIN en otra región del tenant se acepta');
  perform pg_temp.check((pg_temp.run_as('authenticated', 'operations-B', pg_temp.reset_sql('b-cn', '5824'))->>'ok')::boolean,
    'el mismo PIN en otro tenant se acepta');
  perform pg_temp.check((pg_temp.run_as('authenticated', 'operations-A', pg_temp.reset_sql('cn-2', '6193'))->>'ok')::boolean,
    'el PIN de un operario dado de baja no bloquea');
  perform pg_temp.check((pg_temp.run_as('authenticated', 'operations-A', pg_temp.reset_sql('cn-1', '5824'))->>'ok')::boolean,
    'un operario puede volver a su propio PIN');
  perform pg_temp.check(pg_temp.login('5824', 'tenant-A', 'cn') = pg_temp.fixture_id('cn-1')
      and pg_temp.login('5824', 'tenant-A', 've') = pg_temp.fixture_id('ve-1')
      and pg_temp.login('5824', 'tenant-B', 'cn') = pg_temp.fixture_id('b-cn'),
    'con el mismo PIN en otra región y en otro tenant, cada login entra con su operario');
end;
$repetidos$;

-- 7. Alta: la matriz, el PIN libre y el evento, igual que al restablecer.
do $alta$
declare
  v_result jsonb;
  v_id uuid;
  v_event public.entity_audit_log;
begin
  v_result := pg_temp.run_as('authenticated', 'admin-A', pg_temp.create_sql('tenant-A', 'Nuevo', '5824'));
  perform pg_temp.check(v_result->>'state' = 'P0018', 'el alta con el PIN de otro operario activo se rechaza');
  perform pg_temp.check(not exists (select 1 from public.operario_pins where display_name = 'Nuevo')
      and not exists (select 1 from public.entity_audit_log where event_type = 'operario_created'),
    'el alta rechazada no deja operario ni evento');
  perform pg_temp.check(pg_temp.run_as('authenticated', 'commercial-A', pg_temp.create_sql('tenant-A', 'Nuevo', '2963'))->>'state' = '42501',
    'commercial no crea operarios por default');
  perform pg_temp.set_override('operations', true, false);
  perform pg_temp.check(pg_temp.run_as('authenticated', 'operations-A', pg_temp.create_sql('tenant-A', 'Nuevo', '2963'))->>'state' = '42501',
    'operations con el desvío (ver sí, editar no) no crea operarios');
  perform pg_temp.set_override('operations', null, null);
  v_result := pg_temp.run_as('authenticated', 'operations-A', pg_temp.create_sql('tenant-A', 'Nuevo', '2963'));
  perform pg_temp.check((v_result->>'ok')::boolean, 'operations crea un operario con un PIN libre');
  select id into v_id from public.operario_pins where display_name = 'Nuevo';
  perform pg_temp.check(pg_temp.login('2963', 'tenant-A', 'cn') = v_id, 'el operario nuevo entra con su PIN');
  select * into v_event from public.entity_audit_log where event_type = 'operario_created';
  perform pg_temp.check(v_event.entity_id = v_id and v_event.entity_type = 'operario'
      and v_event.tenant_id = pg_temp.fixture_id('tenant-A') and v_event.actor_id = pg_temp.fixture_id('operations-A')
      and v_event.source = 'rpc' and v_event.result = 'succeeded' and v_event.sensitivity = 'restricted'
      and v_event.correlation_id like 'operario_created:%'
      and v_event.after_data = jsonb_build_object('credential', 'pin', 'region', 'cn', 'role', 'operario',
        'warehouse_id', pg_temp.fixture_id('wh-tenant-A'), 'active', true)
      and position('2963' in concat_ws('|', v_event.payload::text, v_event.after_data::text)) = 0,
    'el alta deja su evento sin el PIN');
  perform pg_temp.check(pg_temp.run_as('authenticated', 'admin-A', pg_temp.create_sql('tenant-A', 'Nuevo', '4152'))->>'state' = 'P0013',
    'el nombre repetido en el almacén sigue dando P0013');
end;
$alta$;

-- 8. El validador contesta con tuteo y sigue rechazando lo mismo.
do $validador$
declare v_result jsonb;
begin
  v_result := pg_temp.run_as('authenticated', 'admin-A', pg_temp.reset_sql('cn-2', '1234'));
  perform pg_temp.check(v_result->>'state' = 'P0010' and v_result->>'message' = 'PIN demasiado común. Elige uno menos predecible.',
    'el PIN común se rechaza con «Elige»');
  v_result := pg_temp.run_as('authenticated', 'admin-A', pg_temp.reset_sql('cn-2', '12a4'));
  perform pg_temp.check(v_result->>'state' = 'P0010' and v_result->>'message' = 'PIN debe ser 4 dígitos numéricos',
    'el formato inválido se sigue rechazando');
  perform pg_temp.check((select count(*) from generate_series(0, 9999) g
      where exists (select 1 from (select pg_temp.run_as('postgres', null,
        format('select public.validate_operario_pin_format(%L)', lpad(g::text, 4, '0'))) as r) x
        where (x.r->>'ok')::boolean is false)) = 24,
    'sobre los 10.000 PIN rechaza los mismos 24 comunes');
  perform pg_temp.check((select proconfig from pg_catalog.pg_proc
      where oid = 'public.validate_operario_pin_format(text)'::regprocedure) = array['search_path=public'],
    'el validador conserva el search_path de 0210');
end;
$validador$;

-- 9. AUD-01: si el evento no se puede escribir, el PIN no cambia y el alta no queda.
do $auditoria_falla$
declare
  v_before text := pg_temp.hash_of('cn-2');
  v_result jsonb;
begin
  update public.audit_entity_types set status = 'deprecated', deprecated_at = now() where entity_type = 'operario';
  v_result := pg_temp.run_as('authenticated', 'operations-A', pg_temp.reset_sql('cn-2', '8160'));
  perform pg_temp.check(v_result->>'state' = '23503' and v_result->>'message' = 'audit: entity_type inexistente o inactivo',
    'sin el tipo de auditoría el restablecimiento falla');
  perform pg_temp.check(pg_temp.hash_of('cn-2') = v_before, 'y el PIN no cambia');
  v_result := pg_temp.run_as('authenticated', 'operations-A', pg_temp.create_sql('tenant-A', 'Sin rastro', '8160'));
  perform pg_temp.check(v_result->>'state' = '23503'
      and not exists (select 1 from public.operario_pins where display_name = 'Sin rastro'),
    'sin el tipo de auditoría el alta falla y no queda el operario');
  update public.audit_entity_types set status = 'active', deprecated_at = null where entity_type = 'operario';
end;
$auditoria_falla$;

-- 10. Catálogo: la policy, las funciones y lo que 0475 no toca.
do $sin_danos$
begin
  perform pg_temp.check((select count(*) from pg_catalog.pg_policy where polrelid = 'public.operario_pins'::regclass) = 1
      and exists (select 1 from pg_catalog.pg_policy where polrelid = 'public.operario_pins'::regclass
        and polname = 'operario_pins select by operarios module'),
    'operario_pins tiene una sola policy, la de 0475');
  perform pg_temp.check(not has_function_privilege('authenticated',
      'public.operario_pin_assert_available(uuid,operario_region,text,uuid)', 'EXECUTE')
      and not has_function_privilege('service_role', 'public.operario_pin_assert_available(uuid,operario_region,text,uuid)', 'EXECUTE'),
    'el chequeo de PIN libre no se ejecuta desde la API');
  perform pg_temp.check(pg_temp.run_as('authenticated', 'admin-A',
      format('select public.operario_pin_assert_available(%L::uuid, ''cn'', ''5824'', null)', pg_temp.fixture_id('tenant-A')))->>'state' = '42501',
    'ni siquiera admin puede sondear PIN con el chequeo directo');
  perform pg_temp.check(not exists (
    select 1 from baseline_functions b
    full join (select p.oid, p.proname, to_jsonb(p) as definition
               from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public') c on c.oid = b.oid
    where coalesce(b.proname, c.proname) not in ('admin_create_operario', 'admin_reset_operario_pin',
        'validate_operario_pin_format', 'operarios_module_authorized', 'operario_pin_assert_available')
      and (b.oid is null or c.oid is null or b.definition <> c.definition)),
    '0475 no toca ninguna otra función de public (verify_operario_pin, set_active y update incluidas)');
  perform pg_temp.check((select count(*) from public.audit_entity_types where entity_type = 'operario'
      and status = 'active' and domain_code = 'access') = 1,
    'el catálogo tiene la entidad operario de acceso');
end;
$sin_danos$;

select 'TEST 0475 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
