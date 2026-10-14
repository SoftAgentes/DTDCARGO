\set ON_ERROR_STOP on
-- SDD-0515 · Contrato de 0475: nadie lee pin_hash ni pin_cifrado desde la API,
-- la matriz de módulos decide quién ve, restablece, crea y ve el PIN, cada alta,
-- restablecimiento, reactivación y consulta del PIN pide motivo y queda auditada
-- sin el PIN, el PIN se recupera descifrado sólo por «Ver PIN», y no hay dos
-- operarios activos con el mismo PIN en el mismo tenant y región. Fixture
-- sintético aislado; no ejecutar sobre una DB real. Termina en ROLLBACK.
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
-- Vault: si la base trae el real (imagen supabase/postgres) se usa tal cual; si
-- no, el stub de 0472 con la misma superficie (vault.create_secret y la vista
-- vault.decrypted_secrets). El stub no cifra en reposo: lo que se prueba es que
-- la clave sale de Vault y que el PIN se guarda cifrado con ella.
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

-- Vault real o stub (mismo patrón que 0472_kommo_functions_base_url.test.sql).
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
-- Todos son anteriores a 0475: ninguno tiene PIN recuperable.
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

-- Foto de pg_proc en public antes de 0475: sólo puede tocar sus funciones.
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
create function pg_temp.reset_sql(p_operario text, p_pin text, p_motivo text default 'Olvidó su PIN en el turno',
  p_reactivar boolean default false) returns text language sql as $$
  select format('select public.admin_reset_operario_pin(%L::uuid, %L, %L, %L)',
    pg_temp.fixture_id(p_operario), p_pin, p_motivo, p_reactivar)
$$;
create function pg_temp.create_sql(p_tenant text, p_name text, p_pin text,
  p_motivo text default 'Operario nuevo del turno de la mañana') returns text language sql as $$
  select format('select public.admin_create_operario(%L::uuid, %L::uuid, %L, null, %L, %L, %L)',
    pg_temp.fixture_id(p_tenant), pg_temp.fixture_id('wh-' || p_tenant), p_name, p_pin, 'operario', p_motivo)
$$;
create function pg_temp.ver_sql(p_operario text, p_motivo text default 'El operario no recuerda su PIN') returns text language sql as $$
  select format('select public.admin_ver_operario_pin(%L::uuid, %L)', pg_temp.fixture_id(p_operario), p_motivo)
$$;
create function pg_temp.hash_of(p_operario text) returns text language sql volatile as $$
  select pin_hash from public.operario_pins where id = pg_temp.fixture_id(p_operario)
$$;
-- El PIN guardado, descifrado como lo haría la base (sólo el dueño puede).
-- plpgsql y no sql: sin 0475 no hay pin_cifrado y el control rojo tiene que
-- llegar a su primera aserción, no caer al crear este helper.
create function pg_temp.pin_of(p_operario text) returns text language plpgsql volatile as $$
begin
  return (select public.operario_pin_descifrar(pin_cifrado) from public.operario_pins
          where id = pg_temp.fixture_id(p_operario));
end;
$$;
-- El login real como lo llama la app (service_role, huella de 64 hex).
create function pg_temp.login(p_pin text, p_tenant text, p_region text) returns uuid language sql volatile as $$
  select v.operario_id from public.verify_operario_pin(p_pin, pg_temp.fixture_id(p_tenant),
    p_region::operario_region, repeat('a', 64)) as v
$$;
create function pg_temp.events(p_entity uuid, p_event text default null) returns bigint language sql volatile as $$
  select count(*) from public.entity_audit_log
  where entity_type = 'operario' and entity_id = p_entity and (p_event is null or event_type = p_event)
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

-- 1. pin_hash y pin_cifrado fuera de la API: nadie los lee y service_role no los
--    escribe; las otras 13 columnas siguen legibles por columna.
do $catalogo$
declare v_column text;
begin
  perform pg_temp.check(not has_column_privilege('authenticated', 'public.operario_pins', 'pin_hash', 'SELECT'),
    'authenticated no tiene SELECT sobre pin_hash');
  foreach v_column in array array['pin_hash', 'pin_cifrado'] loop
    perform pg_temp.check(not has_column_privilege('authenticated', 'public.operario_pins', v_column, 'SELECT')
        and not has_column_privilege('service_role', 'public.operario_pins', v_column, 'SELECT')
        and not has_column_privilege('anon', 'public.operario_pins', v_column, 'SELECT'),
      'nadie de la API lee ' || v_column);
    perform pg_temp.check(not has_column_privilege('service_role', 'public.operario_pins', v_column, 'UPDATE')
        and not has_column_privilege('service_role', 'public.operario_pins', v_column, 'INSERT'),
      'service_role no escribe ' || v_column);
  end loop;
  perform pg_temp.check(not has_any_column_privilege('anon', 'public.operario_pins', 'SELECT'),
    'anon no lee ninguna columna');
  foreach v_column in array array['id', 'tenant_id', 'warehouse_id', 'region', 'display_name',
    'display_name_cn', 'role', 'roles', 'active', 'last_login_at', 'created_at', 'updated_at', 'tms_driver_id'] loop
    perform pg_temp.check(has_column_privilege('authenticated', 'public.operario_pins', v_column, 'SELECT')
      and has_column_privilege('service_role', 'public.operario_pins', v_column, 'SELECT'),
      'authenticated y service_role leen ' || v_column);
  end loop;
  perform pg_temp.check(has_column_privilege('service_role', 'public.operario_pins', 'active', 'UPDATE')
      and has_table_privilege('service_role', 'public.operario_pins', 'DELETE')
      and not has_table_privilege('service_role', 'public.operario_pins', 'INSERT'),
    'service_role conserva la escritura de lo que no es credencial, sin INSERT');
  perform pg_temp.check((select count(*) from vault.decrypted_secrets where name = 'operario_pin_key'
      and char_length(decrypted_secret) >= 32) = 1,
    'la clave operario_pin_key existe una sola vez en Vault, aunque 0475 corrió dos veces');
end;
$catalogo$;

-- 2. Nadie del personal lee pin_hash ni pin_cifrado, tampoco admin; service_role
--    tampoco, y no puede escribirlos ni insertar operarios por fuera de la RPC.
do $sin_hash$
declare v_user text; v_column text;
begin
  foreach v_column in array array['pin_hash', 'pin_cifrado'] loop
    foreach v_user in array array['admin-A', 'operations-A', 'commercial-A', 'support-A'] loop
      perform pg_temp.check(pg_temp.read_as('authenticated', v_user,
          format('select %I::text from public.operario_pins limit 1', v_column)) = 'ERROR 42501',
        v_user || ' no lee ' || v_column);
    end loop;
    perform pg_temp.check(pg_temp.read_as('service_role', null,
        format('select %I::text from public.operario_pins limit 1', v_column)) = 'ERROR 42501',
      'service_role no lee ' || v_column);
    perform pg_temp.check(pg_temp.run_as('service_role', null,
        format('update public.operario_pins set %I = null where false', v_column))->>'state' = '42501',
      'service_role no escribe ' || v_column);
  end loop;
  perform pg_temp.check(pg_temp.run_as('service_role', null,
      'update public.operario_pins set active = active where false')->>'ok' = 'true',
    'service_role sigue pudiendo actualizar active');
  perform pg_temp.check(pg_temp.run_as('service_role', null,
      format('insert into public.operario_pins (tenant_id, display_name, pin_hash, region) values (%L, ''x'', ''x'', ''ve'')',
        pg_temp.fixture_id('tenant-A')))->>'state' = '42501',
    'service_role no inserta operarios por fuera de la RPC');
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

-- 4. Restablecer: operations lo hace con motivo, el login entra con el PIN nuevo,
--    el viejo deja de servir, el PIN queda cifrado y hay UN evento con el motivo y
--    sin el PIN, con el lock por tenant y región.
do $restablecer$
declare
  v_before text := pg_temp.hash_of('cn-2');
  v_result jsonb;
  v_event public.entity_audit_log;
  v_key bigint := hashtextextended('operario_pin:' || pg_temp.fixture_id('tenant-A')::text || ':cn', 0);
begin
  perform pg_temp.check(pg_temp.pin_of('cn-2') is null, 'un PIN anterior a 0475 no tiene cifrado');
  v_result := pg_temp.run_as('authenticated', 'operations-A', pg_temp.reset_sql('cn-2', '7395'));
  perform pg_temp.check((v_result->>'ok')::boolean, 'operations restablece el PIN (' || coalesce(v_result->>'message', '') || ')');
  perform pg_temp.check(pg_temp.hash_of('cn-2') is distinct from v_before, 'el hash cambia');
  perform pg_temp.check(pg_temp.pin_of('cn-2') = '7395', 'el PIN nuevo queda cifrado con la clave de Vault');
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
      and v_event.reason = 'Olvidó su PIN en el turno' and v_event.payload = '{}'::jsonb
      and v_event.correlation_id like 'operario_pin_reset:%',
    'el evento dice quién, a qué operario, en qué tenant, por qué y desde dónde');
  perform pg_temp.check(v_event.before_data = '{"active": true}'::jsonb
      and v_event.after_data = '{"credential": "pin", "region": "cn", "active": true, "recoverable": true}'::jsonb,
    'el before/after es el estado y la credencial rotada');
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

-- 5. El motivo es obligatorio, acotado y sin el PIN; sin él no cambia nada.
do $motivo$
declare
  v_before text := pg_temp.hash_of('cn-2');
  v_events bigint := pg_temp.events(pg_temp.fixture_id('cn-2'));
  v_result jsonb;
  v_case record;
begin
  for v_case in select * from (values
    ('sin motivo', null::text, 'Escribe el motivo: entre 4 y 300 caracteres.'),
    ('con un motivo de espacios', '      ', 'Escribe el motivo: entre 4 y 300 caracteres.'),
    ('con un motivo de 3 letras', 'abc', 'Escribe el motivo: entre 4 y 300 caracteres.'),
    ('con un motivo de 301 letras', repeat('x', 301), 'Escribe el motivo: entre 4 y 300 caracteres.'),
    ('con el PIN en el motivo', 'Le puse 4152 porque lo pidió', 'No escribas el PIN en el motivo: queda en la auditoría.')
  ) c(label, motivo, message) loop
    v_result := pg_temp.run_as('authenticated', 'operations-A', pg_temp.reset_sql('cn-2', '4152', v_case.motivo));
    perform pg_temp.check(v_result->>'state' = 'P0020' and v_result->>'message' = v_case.message,
      'restablecer ' || v_case.label || ' se rechaza con P0020');
  end loop;
  -- La app de antes llama sin p_motivo: resuelve a la firma nueva y rebota igual.
  v_result := pg_temp.run_as('authenticated', 'operations-A',
    format('select public.admin_reset_operario_pin(%L::uuid, %L)', pg_temp.fixture_id('cn-2'), '4152'));
  perform pg_temp.check(v_result->>'state' = 'P0020', 'la llamada de la app de antes, sin motivo, también se rechaza');
  perform pg_temp.check(pg_temp.hash_of('cn-2') = v_before and pg_temp.events(pg_temp.fixture_id('cn-2')) = v_events,
    'sin motivo válido no cambia el hash ni queda evento');
  -- Con un PIN nuevo y libre: el operario no vuelve al suyo, que es otra regla.
  perform pg_temp.check((pg_temp.run_as('authenticated', 'operations-A',
      pg_temp.reset_sql('cn-2', '9047', '  ' || repeat('m', 300) || '  '))->>'ok')::boolean,
    'el motivo se recorta antes de medirlo: 300 letras con espacios alrededor pasan');
end;
$motivo$;

-- 6. Restablecer: la matriz rechaza, sin cambiar el hash ni auditar.
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
  -- El candado corre antes de buscar el operario y antes del motivo: sin oráculo.
  perform pg_temp.check(pg_temp.run_as('authenticated', 'commercial-A', pg_temp.reset_sql('no-existe', '2963'))->>'state' = '42501',
    'sin permiso, un id inexistente también da 42501');
  perform pg_temp.check(pg_temp.run_as('authenticated', 'commercial-A', pg_temp.reset_sql('cn-1', '2963', null))->>'state' = '42501',
    'sin permiso, el motivo vacío también da 42501');
  perform pg_temp.check(pg_temp.run_as('authenticated', 'admin-A', pg_temp.reset_sql('no-existe', '2963'))->>'state' = 'P0014',
    'con permiso, un id inexistente da Operario no encontrado');
  v_result := pg_temp.run_as('authenticated', 'operations-B', pg_temp.reset_sql('cn-1', '2963'));
  perform pg_temp.check(v_result->>'state' = '42501' and v_result->>'message' like 'Tenant mismatch%',
    'operations de otro tenant choca con el candado de tenant');
  perform pg_temp.check(pg_temp.run_as('anon', null, pg_temp.reset_sql('cn-1', '2963'))->>'state' = '42501'
      and pg_temp.run_as('service_role', null, pg_temp.reset_sql('cn-1', '2963'))->>'state' = '42501',
    'anon y service_role no ejecutan el restablecimiento');
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

-- 7. PIN repetidos: se rechaza sólo contra otro operario ACTIVO del mismo
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

-- 8. Alta: la matriz, el motivo, el PIN libre, el cifrado y el evento.
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
  perform pg_temp.check(pg_temp.run_as('authenticated', 'admin-A', pg_temp.create_sql('tenant-A', 'Nuevo', '2963', 'ok'))->>'state' = 'P0020',
    'el alta sin un motivo válido se rechaza');
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
  perform pg_temp.check((select public.operario_pin_descifrar(pin_cifrado) from public.operario_pins where id = v_id) = '2963',
    'el alta guarda el PIN cifrado');
  select * into v_event from public.entity_audit_log where event_type = 'operario_created';
  perform pg_temp.check(v_event.entity_id = v_id and v_event.entity_type = 'operario'
      and v_event.tenant_id = pg_temp.fixture_id('tenant-A') and v_event.actor_id = pg_temp.fixture_id('operations-A')
      and v_event.source = 'rpc' and v_event.result = 'succeeded' and v_event.sensitivity = 'restricted'
      and v_event.reason = 'Operario nuevo del turno de la mañana'
      and v_event.correlation_id like 'operario_created:%'
      and v_event.after_data = jsonb_build_object('credential', 'pin', 'region', 'cn', 'role', 'operario',
        'warehouse_id', pg_temp.fixture_id('wh-tenant-A'), 'active', true, 'recoverable', true)
      and position('2963' in concat_ws('|', v_event.payload::text, v_event.after_data::text, v_event.reason)) = 0,
    'el alta deja su evento con el motivo y sin el PIN');
  perform pg_temp.check(pg_temp.run_as('authenticated', 'admin-A', pg_temp.create_sql('tenant-A', 'Nuevo', '4152'))->>'state' = 'P0013',
    'el nombre repetido en el almacén sigue dando P0013');
  perform pg_temp.check(pg_temp.run_as('authenticated', 'admin-A',
      format('select public.admin_create_operario(%L::uuid, %L::uuid, ''Sin motivo'', null, ''4152'', ''operario'')',
        pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('wh-tenant-A')))->>'state' = 'P0020',
    'la llamada de alta de la app de antes, sin motivo, se rechaza');
end;
$alta$;

-- 9. Ver PIN: misma regla que restablecer, motivo, evento pin_visto sin el PIN,
--    y NULL para un PIN anterior a 0475.
do $ver$
declare
  v_events bigint;
  v_event public.entity_audit_log;
  v_result jsonb;
  v_user text;
begin
  v_events := pg_temp.events(pg_temp.fixture_id('cn-2'), 'pin_visto');
  perform pg_temp.check(pg_temp.read_as('authenticated', 'operations-A', pg_temp.ver_sql('cn-2')) = '6193',
    'operations ve el PIN vigente');
  perform pg_temp.check(pg_temp.events(pg_temp.fixture_id('cn-2'), 'pin_visto') = v_events + 1,
    'ver el PIN deja exactamente un evento pin_visto');
  select * into v_event from public.entity_audit_log
   where entity_id = pg_temp.fixture_id('cn-2') and event_type = 'pin_visto';
  perform pg_temp.check(v_event.tenant_id = pg_temp.fixture_id('tenant-A') and v_event.entity_type = 'operario'
      and v_event.actor_type = 'user' and v_event.actor_id = pg_temp.fixture_id('operations-A')
      and v_event.source = 'rpc' and v_event.result = 'succeeded' and v_event.sensitivity = 'restricted'
      and v_event.reason = 'El operario no recuerda su PIN' and v_event.correlation_id like 'pin_visto:%'
      and v_event.before_data is null and v_event.payload = '{}'::jsonb
      and v_event.after_data = '{"credential": "pin", "recoverable": true}'::jsonb,
    'el evento pin_visto dice quién, a qué operario y por qué');
  perform pg_temp.check(position('6193' in concat_ws('|', v_event.payload::text, v_event.after_data::text, v_event.reason)) = 0,
    'el evento pin_visto no guarda el PIN');
  -- Sin permiso, sin motivo o con el PIN en el motivo: ni PIN ni evento.
  v_events := (select count(*) from public.entity_audit_log where event_type = 'pin_visto');
  foreach v_user in array array['commercial-A', 'accounting-A', 'warehouse-A', 'support-A', 'marketing-A', 'operations-off-A'] loop
    perform pg_temp.check(pg_temp.read_as('authenticated', v_user, pg_temp.ver_sql('cn-2')) = 'ERROR 42501',
      v_user || ' no ve el PIN por default');
  end loop;
  perform pg_temp.set_override('commercial', true, false);
  perform pg_temp.check(pg_temp.read_as('authenticated', 'commercial-A', pg_temp.ver_sql('cn-2')) = 'ERROR 42501',
    'con sólo la vista de Operarios no se ve el PIN');
  perform pg_temp.set_override('commercial', null, null);
  perform pg_temp.check(pg_temp.read_as('authenticated', 'commercial-A', pg_temp.ver_sql('no-existe')) = 'ERROR 42501',
    'sin permiso, un id inexistente también da 42501 al ver');
  perform pg_temp.check(pg_temp.read_as('authenticated', 'operations-A', pg_temp.ver_sql('cn-2', null)) = 'ERROR P0020'
      and pg_temp.read_as('authenticated', 'operations-A', pg_temp.ver_sql('cn-2', 'ok')) = 'ERROR P0020',
    'ver el PIN sin un motivo válido se rechaza');
  v_result := pg_temp.run_as('authenticated', 'operations-A', pg_temp.ver_sql('cn-2', 'Confirmar que es el 6193'));
  perform pg_temp.check(v_result->>'state' = 'P0020'
      and v_result->>'message' = 'No escribas el PIN en el motivo: queda en la auditoría.',
    'un motivo con el PIN se rechaza y no lo guarda');
  perform pg_temp.check(pg_temp.read_as('authenticated', 'operations-B', pg_temp.ver_sql('cn-2')) = 'ERROR 42501',
    'operations de otro tenant no ve el PIN');
  perform pg_temp.check(pg_temp.read_as('anon', null, pg_temp.ver_sql('cn-2')) = 'ERROR 42501'
      and pg_temp.read_as('service_role', null, pg_temp.ver_sql('cn-2')) = 'ERROR 42501',
    'anon y service_role no ejecutan «Ver PIN»');
  perform pg_temp.check((select count(*) from public.entity_audit_log where event_type = 'pin_visto') = v_events,
    'ninguna consulta rechazada deja evento');
  perform pg_temp.check(pg_temp.read_as('authenticated', 'admin-A', pg_temp.ver_sql('no-existe')) = 'ERROR P0014',
    'con permiso, un id inexistente da Operario no encontrado');
  -- Un desvío que le da Operarios a commercial le abre «Ver PIN».
  perform pg_temp.set_override('commercial', true, true);
  perform pg_temp.check(pg_temp.read_as('authenticated', 'commercial-A', pg_temp.ver_sql('cn-2')) = '6193',
    'commercial con el desvío (ver y editar) ve el PIN');
  perform pg_temp.set_override('commercial', null, null);
  -- PIN anterior a 0475: NULL, y la consulta igual queda registrada.
  perform pg_temp.check(pg_temp.read_as('authenticated', 'admin-A', pg_temp.ver_sql('cn-baja')) is null,
    'un PIN anterior a 0475 devuelve NULL');
  perform pg_temp.check(exists (select 1 from public.entity_audit_log e
      where e.entity_id = pg_temp.fixture_id('cn-baja') and e.event_type = 'pin_visto'
        and e.actor_id = pg_temp.fixture_id('admin-A')
        and e.after_data = '{"credential": "pin", "recoverable": false}'::jsonb),
    'la consulta de un PIN viejo queda registrada como no recuperable');
end;
$ver$;

-- 10. Reactivar exige un PIN nuevo y libre; desactivar sigue igual.
do $reactivar$
declare
  v_result jsonb;
  v_event public.entity_audit_log;
begin
  v_result := pg_temp.run_as('authenticated', 'admin-A',
    format('select public.admin_set_operario_active(%L::uuid, true)', pg_temp.fixture_id('cn-baja')));
  perform pg_temp.check(v_result->>'state' = 'P0019'
      and v_result->>'message' = 'Para reactivar a un operario dale un PIN nuevo con «Restablecer PIN»: así no vuelve con un PIN repetido.',
    'activar a un operario de baja sin PIN nuevo se rechaza con P0019');
  perform pg_temp.check(not (select active from public.operario_pins where id = pg_temp.fixture_id('cn-baja')),
    'y sigue de baja');
  perform pg_temp.check(pg_temp.run_as('authenticated', 'admin-A', pg_temp.reset_sql('cn-baja', '5824', p_reactivar => true))->>'state' = 'P0018',
    'reactivar con el PIN de otro operario activo se rechaza');
  v_result := pg_temp.run_as('authenticated', 'admin-A', pg_temp.reset_sql('cn-baja', '2741', 'Vuelve de vacaciones', true));
  perform pg_temp.check((v_result->>'ok')::boolean
      and (select active from public.operario_pins where id = pg_temp.fixture_id('cn-baja'))
      and pg_temp.login('2741', 'tenant-A', 'cn') = pg_temp.fixture_id('cn-baja'),
    'restablecer con p_reactivar lo reactiva con un PIN nuevo que entra');
  select * into v_event from public.entity_audit_log
   where entity_id = pg_temp.fixture_id('cn-baja') and event_type = 'operario_reactivated';
  perform pg_temp.check(v_event.reason = 'Vuelve de vacaciones'
      and v_event.before_data = '{"active": false}'::jsonb
      and v_event.after_data = '{"credential": "pin", "region": "cn", "active": true, "recoverable": true}'::jsonb,
    'la reactivación queda como operario_reactivated, con su motivo');
  -- Desactivar sigue funcionando; restablecer sin p_reactivar no reactiva.
  perform pg_temp.check((pg_temp.run_as('authenticated', 'operations-A',
      format('select public.admin_set_operario_active(%L::uuid, false)', pg_temp.fixture_id('cn-1')))->>'ok')::boolean,
    'desactivar sigue funcionando');
  perform pg_temp.check((pg_temp.run_as('authenticated', 'operations-A', pg_temp.reset_sql('cn-1', '3316'))->>'ok')::boolean
      and not (select active from public.operario_pins where id = pg_temp.fixture_id('cn-1'))
      and pg_temp.login('3316', 'tenant-A', 'cn') is null,
    'restablecer sin p_reactivar deja al operario de baja');
  perform pg_temp.check(pg_temp.run_as('authenticated', 'operations-A',
      format('select public.admin_set_operario_active(%L::uuid, true)', pg_temp.fixture_id('cn-1')))->>'state' = 'P0019',
    'tampoco se reactiva con el toggle después de restablecer');
  perform pg_temp.check((pg_temp.run_as('authenticated', 'operations-A', pg_temp.reset_sql('cn-1', '3316', p_reactivar => true))->>'ok')::boolean
      and pg_temp.login('3316', 'tenant-A', 'cn') = pg_temp.fixture_id('cn-1'),
    'restablecer con p_reactivar al PIN que acaba de recibir lo reactiva');
end;
$reactivar$;

-- 11. El validador contesta con tuteo y sigue rechazando lo mismo.
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

-- 12. AUD-01: si el evento no se puede escribir, nada cambia y el PIN no sale.
do $auditoria_falla$
declare
  v_before text := pg_temp.hash_of('cn-2');
  v_result jsonb;
begin
  update public.audit_entity_types set status = 'deprecated', deprecated_at = now() where entity_type = 'operario';
  v_result := pg_temp.run_as('authenticated', 'operations-A', pg_temp.reset_sql('cn-2', '8160'));
  perform pg_temp.check(v_result->>'state' = '23503' and v_result->>'message' = 'audit: entity_type inexistente o inactivo',
    'sin el tipo de auditoría el restablecimiento falla');
  perform pg_temp.check(pg_temp.hash_of('cn-2') = v_before and pg_temp.pin_of('cn-2') = '6193', 'y el PIN no cambia');
  v_result := pg_temp.run_as('authenticated', 'operations-A', pg_temp.create_sql('tenant-A', 'Sin rastro', '8160'));
  perform pg_temp.check(v_result->>'state' = '23503'
      and not exists (select 1 from public.operario_pins where display_name = 'Sin rastro'),
    'sin el tipo de auditoría el alta falla y no queda el operario');
  perform pg_temp.check(pg_temp.read_as('authenticated', 'operations-A', pg_temp.ver_sql('cn-2')) = 'ERROR 23503',
    'sin el tipo de auditoría «Ver PIN» falla y no devuelve el PIN');
  update public.audit_entity_types set status = 'active', deprecated_at = null where entity_type = 'operario';
end;
$auditoria_falla$;

-- 13. Catálogo: la policy, las funciones y lo que 0475 no toca.
do $sin_danos$
begin
  perform pg_temp.check((select count(*) from pg_catalog.pg_policy where polrelid = 'public.operario_pins'::regclass) = 1
      and exists (select 1 from pg_catalog.pg_policy where polrelid = 'public.operario_pins'::regclass
        and polname = 'operario_pins select by operarios module'),
    'operario_pins tiene una sola policy, la de 0475');
  perform pg_temp.check(to_regprocedure('public.admin_reset_operario_pin(uuid,text)') is null
      and to_regprocedure('public.admin_create_operario(uuid,uuid,text,text,text,text)') is null,
    'las firmas sin motivo ya no existen');
  perform pg_temp.check(not exists (select 1 from unnest(array[
        'public.operario_pin_assert_available(uuid,operario_region,text,uuid)',
        'public.operario_pin_cifrar(text)', 'public.operario_pin_descifrar(bytea)',
        'public.operario_motivo_valido(text,text)']) f(signature)
      where has_function_privilege('authenticated', f.signature, 'EXECUTE')
         or has_function_privilege('service_role', f.signature, 'EXECUTE')
         or has_function_privilege('anon', f.signature, 'EXECUTE')),
    'los helpers del PIN no se ejecutan desde la API');
  perform pg_temp.check(pg_temp.run_as('authenticated', 'admin-A',
      format('select public.operario_pin_assert_available(%L::uuid, ''cn'', ''5824'', null)', pg_temp.fixture_id('tenant-A')))->>'state' = '42501'
      and pg_temp.read_as('authenticated', 'admin-A',
        'select public.operario_pin_descifrar(''\x00''::bytea)') = 'ERROR 42501',
    'ni siquiera admin puede sondear PIN ni descifrar con los helpers directos');
  perform pg_temp.check(not exists (
    select 1 from baseline_functions b
    full join (select p.oid, p.proname, to_jsonb(p) as definition
               from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public') c on c.oid = b.oid
    where coalesce(b.proname, c.proname) not in ('admin_create_operario', 'admin_reset_operario_pin',
        'admin_set_operario_active', 'admin_ver_operario_pin', 'validate_operario_pin_format',
        'operarios_module_authorized', 'operario_pin_assert_available', 'operario_pin_cifrar',
        'operario_pin_descifrar', 'operario_motivo_valido')
      and (b.oid is null or c.oid is null or b.definition <> c.definition)),
    '0475 no toca ninguna otra función de public (verify_operario_pin y admin_update_operario incluidas)');
  perform pg_temp.check((select count(*) from public.audit_entity_types where entity_type = 'operario'
      and status = 'active' and domain_code = 'access') = 1,
    'el catálogo tiene la entidad operario de acceso');
end;
$sin_danos$;

select 'TEST 0475 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
