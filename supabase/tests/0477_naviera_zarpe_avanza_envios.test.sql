\set ON_ERROR_STOP on
-- SDD-0530 · Contrato de 0477: al zarpar el contenedor (cerrado → zarpado) sus
-- envíos pasan a shipped; al arribar (zarpado → arribado), a in_customs. El
-- contenedor, los envíos, sus shipment_events y la auditoría AUD-01 cambian en
-- una transacción; los envíos que no pueden avanzar no se tocan y se informan
-- con su motivo; marcar dos veces no avanza dos veces; la matriz de Naviera y
-- de Tracking decide quién puede; y nadie zarpa un contenedor por fuera de la
-- RPC. Fixture sintético aislado; no ejecutar sobre una DB real. Termina en
-- ROLLBACK.
-- RED: psql -v apply_fix=false -f /sb/tests/0477_naviera_zarpe_avanza_envios.test.sql
--
-- El ANTES sale de los archivos reales donde se puede: la matriz 0357 y la
-- auditoría 0258/0261/0267/0294 por \ir, con el writer real (su validación de
-- correlation_id, entity_type y payload corre de verdad). shipments,
-- shipment_events, consolidations y consolidation_items llevan las columnas que
-- toca 0477 con sus tipos de producción: los enums de 0002 con los nombres de
-- 0256, la RLS por tenant de 0002/0096 y los grants de authenticated. El
-- envoltorio lib/studio/__tests__/naviera-zarpe-avanza-envios.migration.test.ts
-- comprueba que los enums del fixture son los de lib/shared/shipment-public.ts.
--
-- PGlite tiene UNA conexión: el FOR UPDATE de la RPC (contenedor y envíos) no
-- se prueba con dos sesiones aquí.
--
-- fixture_only=true deja la base montada, con 0477 aplicada, dentro de la
-- transacción abierta: lo usan las pruebas de propiedad (regla y matriz).
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
  if to_regclass('public.tenants') is not null or to_regclass('public.consolidations') is not null
     or to_regclass('public.entity_audit_log') is not null then
    raise exception 'TEST 0477: fixture rechazada, la base ya contiene objetos de aplicación';
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
create policy "users see their own user_tenants"
  on public.user_tenants for select to authenticated
  using (user_id = (select auth.uid()) and disabled_at is null);

-- get_user_tenant_id() de 0453.
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

-- ── Envíos: enums de 0002 con los nombres de 0256 ───────────
create type public.shipment_service as enum (
  'consolidado_lcl', 'puerta_a_puerta_DDP', 'fcl_directo', 'transporte_terrestre', 'fcl_bodega'
);
create type public.shipment_status as enum (
  'draft', 'in_warehouse', 'consolidating', 'shipped', 'in_transit', 'in_customs',
  'arrived_destination', 'delayed_warehouse', 'out_for_delivery', 'last_mile',
  'delivered', 'exception', 'cancelled'
);
create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  client_name text,
  client_markbox text,
  shipment_service public.shipment_service not null,
  status public.shipment_status not null default 'draft',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);
create table public.shipment_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status public.shipment_status not null,
  note text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.shipments, public.shipment_events to authenticated;
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;
create policy "shipments by tenant" on public.shipments for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
create policy "shipment_events by tenant" on public.shipment_events for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- ── Contenedores: 0096 con ref nullable y las columnas de 0157/0322 ──
create table public.consolidations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  ref text,
  container_type text,
  status text not null default 'consolidando',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, ref)
);
create table public.consolidation_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  consolidation_id uuid not null references public.consolidations(id) on delete cascade,
  shipment_id uuid references public.shipments(id) on delete set null,
  client_markbox text,
  client_name text,
  cbm numeric(10,3) not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.consolidations, public.consolidation_items to authenticated;
alter table public.consolidations enable row level security;
alter table public.consolidation_items enable row level security;
create policy "consolidations by tenant" on public.consolidations for all to authenticated
  using (tenant_id = public.get_user_tenant_id()) with check (tenant_id = public.get_user_tenant_id());
create policy "consolidation_items by tenant" on public.consolidation_items for all to authenticated
  using (tenant_id = public.get_user_tenant_id()) with check (tenant_id = public.get_user_tenant_id());

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
  select md5('0477-synthetic-' || p_label)::uuid
$$;
insert into public.tenants values (pg_temp.fixture_id('tenant-A')), (pg_temp.fixture_id('tenant-B'));
insert into auth.users (id, email)
select pg_temp.fixture_id(u), u || '@example.invalid'
from unnest(array['admin-A', 'commercial-A', 'operations-A', 'accounting-A', 'warehouse-A',
  'support-A', 'marketing-A', 'operations-off-A', 'operations-B']) as u;
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
  ('operations-B', 'tenant-B', 'operations', null)
) as m(label, tenant, role, disabled_at);

-- Contenedores. zarpe y arribo llevan los estados mezclados; los demás sirven
-- para conflictos, permisos y el fallo de auditoría.
insert into public.consolidations (id, tenant_id, ref, status)
select pg_temp.fixture_id(c.label), pg_temp.fixture_id(c.tenant), c.ref, c.status
from (values
  ('con-zarpe', 'tenant-A', 'DTD-CONSOL-0101', 'cerrado'),
  ('con-arribo', 'tenant-A', 'DTD-CONSOL-0102', 'zarpado'),
  ('con-abierto', 'tenant-A', 'DTD-CONSOL-0103', 'consolidando'),
  ('con-cerrado', 'tenant-A', 'DTD-CONSOL-0104', 'cerrado'),
  ('con-acc', 'tenant-A', 'DTD-CONSOL-0105', 'cerrado'),
  ('con-admin', 'tenant-A', 'DTD-CONSOL-0106', 'cerrado'),
  ('con-comercial', 'tenant-A', 'DTD-CONSOL-0107', 'cerrado'),
  ('con-fallo', 'tenant-A', 'DTD-CONSOL-0108', 'cerrado'),
  ('con-borrado', 'tenant-A', 'DTD-CONSOL-0109', 'cerrado'),
  ('con-B', 'tenant-B', 'DTD-CONSOL-0201', 'cerrado')
) as c(label, tenant, ref, status);
update public.consolidations set deleted_at = now() where id = pg_temp.fixture_id('con-borrado');

insert into public.shipments (id, tenant_id, code, client_markbox, client_name, shipment_service, status, deleted_at)
select pg_temp.fixture_id(s.label), pg_temp.fixture_id(s.tenant), s.code, s.markbox, 'Cliente ' || s.code,
  s.service::public.shipment_service, s.status::public.shipment_status,
  case when s.borrado then now() end
from (values
  -- Zarpe: cuatro avanzan, siete no.
  ('s-draft',   'tenant-A', 'ENV-101', 'DTD-1001', 'consolidado_lcl',      'draft',               false),
  ('s-wh',      'tenant-A', 'ENV-102', 'DTD-1002', 'consolidado_lcl',      'in_warehouse',        false),
  ('s-cons',    'tenant-A', 'ENV-103', 'DTD-1003', 'puerta_a_puerta_DDP',  'consolidating',       false),
  ('s-fcl',     'tenant-A', 'ENV-104', 'DTD-1004', 'fcl_directo',          'in_warehouse',        false),
  ('s-ya',      'tenant-A', 'ENV-105', 'DTD-1005', 'consolidado_lcl',      'shipped',             false),
  ('s-transit', 'tenant-A', 'ENV-106', 'DTD-1006', 'consolidado_lcl',      'in_transit',          false),
  ('s-deliv',   'tenant-A', 'ENV-107', 'DTD-1007', 'consolidado_lcl',      'delivered',           false),
  ('s-cancel',  'tenant-A', 'ENV-108', 'DTD-1008', 'consolidado_lcl',      'cancelled',           false),
  ('s-exc',     'tenant-A', 'ENV-109', 'DTD-1009', 'consolidado_lcl',      'exception',           false),
  ('s-terr',    'tenant-A', 'ENV-110', 'DTD-1010', 'transporte_terrestre', 'in_warehouse',        false),
  ('s-del',     'tenant-A', 'ENV-111', 'DTD-1011', 'consolidado_lcl',      'in_warehouse',        true),
  -- Arribo: tres avanzan, tres no.
  ('a-shipped', 'tenant-A', 'ENV-201', 'DTD-2001', 'consolidado_lcl',      'shipped',             false),
  ('a-transit', 'tenant-A', 'ENV-202', 'DTD-2002', 'puerta_a_puerta_DDP',  'in_transit',          false),
  ('a-fclb',    'tenant-A', 'ENV-203', 'DTD-2003', 'fcl_bodega',           'shipped',             false),
  ('a-customs', 'tenant-A', 'ENV-204', 'DTD-2004', 'consolidado_lcl',      'in_customs',          false),
  ('a-bodega',  'tenant-A', 'ENV-205', 'DTD-2005', 'consolidado_lcl',      'arrived_destination', false),
  ('a-delayed', 'tenant-A', 'ENV-206', 'DTD-2006', 'consolidado_lcl',      'delayed_warehouse',   false),
  -- Los demás.
  ('s-open',    'tenant-A', 'ENV-301', 'DTD-3001', 'consolidado_lcl',      'in_warehouse',        false),
  ('s-cerrado', 'tenant-A', 'ENV-302', 'DTD-3002', 'consolidado_lcl',      'in_warehouse',        false),
  ('s-acc',     'tenant-A', 'ENV-303', 'DTD-3003', 'consolidado_lcl',      'in_warehouse',        false),
  ('s-admin',   'tenant-A', 'ENV-304', 'DTD-3004', 'consolidado_lcl',      'in_warehouse',        false),
  ('s-com',     'tenant-A', 'ENV-305', 'DTD-3005', 'consolidado_lcl',      'in_warehouse',        false),
  ('s-fallo',   'tenant-A', 'ENV-306', 'DTD-3006', 'consolidado_lcl',      'in_warehouse',        false),
  ('s-B',       'tenant-B', 'ENV-901', 'DTD-9001', 'consolidado_lcl',      'in_warehouse',        false)
) as s(label, tenant, code, markbox, service, status, borrado);

insert into public.consolidation_items (tenant_id, consolidation_id, shipment_id, client_markbox)
select pg_temp.fixture_id(i.tenant), pg_temp.fixture_id(i.con),
  case when i.ship is null then null else pg_temp.fixture_id(i.ship) end, i.markbox
from (values
  ('tenant-A', 'con-zarpe', 's-draft', 'DTD-1001'),
  ('tenant-A', 'con-zarpe', 's-wh', 'DTD-1002'),
  -- El mismo envío en dos piezas: avanza una vez.
  ('tenant-A', 'con-zarpe', 's-wh', 'DTD-1002'),
  ('tenant-A', 'con-zarpe', 's-cons', 'DTD-1003'),
  ('tenant-A', 'con-zarpe', 's-fcl', 'DTD-1004'),
  ('tenant-A', 'con-zarpe', 's-ya', 'DTD-1005'),
  ('tenant-A', 'con-zarpe', 's-transit', 'DTD-1006'),
  ('tenant-A', 'con-zarpe', 's-deliv', 'DTD-1007'),
  ('tenant-A', 'con-zarpe', 's-cancel', 'DTD-1008'),
  ('tenant-A', 'con-zarpe', 's-exc', 'DTD-1009'),
  ('tenant-A', 'con-zarpe', 's-terr', 'DTD-1010'),
  ('tenant-A', 'con-zarpe', 's-del', 'DTD-1011'),
  -- Una pieza cargada a mano, sin envío.
  ('tenant-A', 'con-zarpe', null, 'DTD-1099'),
  -- Una pieza de A que apunta a un envío de B (dato roto): no se toca.
  ('tenant-A', 'con-zarpe', 's-B', 'DTD-9001'),
  ('tenant-A', 'con-arribo', 'a-shipped', 'DTD-2001'),
  ('tenant-A', 'con-arribo', 'a-transit', 'DTD-2002'),
  ('tenant-A', 'con-arribo', 'a-fclb', 'DTD-2003'),
  ('tenant-A', 'con-arribo', 'a-customs', 'DTD-2004'),
  ('tenant-A', 'con-arribo', 'a-bodega', 'DTD-2005'),
  ('tenant-A', 'con-arribo', 'a-delayed', 'DTD-2006'),
  ('tenant-A', 'con-abierto', 's-open', 'DTD-3001'),
  ('tenant-A', 'con-cerrado', 's-cerrado', 'DTD-3002'),
  ('tenant-A', 'con-acc', 's-acc', 'DTD-3003'),
  ('tenant-A', 'con-admin', 's-admin', 'DTD-3004'),
  ('tenant-A', 'con-comercial', 's-com', 'DTD-3005'),
  ('tenant-A', 'con-fallo', 's-fallo', 'DTD-3006'),
  ('tenant-B', 'con-B', 's-B', 'DTD-9001')
) as i(tenant, con, ship, markbox);

-- Foto de pg_proc en public antes de 0477: sólo puede agregar sus funciones.
create temporary table baseline_functions as
select p.oid, p.proname, to_jsonb(p) as definition
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';

\if :apply_fix
\ir ../migrations/0477_naviera_zarpe_avanza_envios.sql
\endif

-- ── Utilidades ──────────────────────────────────────────────
-- Corre una sentencia como p_role, con la sesión de p_user (null = sin sesión).
-- Devuelve {ok, state, message}; con p_select, además value: el texto de la
-- primera columna (sólo para un SELECT).
create function pg_temp.run_as(p_role text, p_user text, p_sql text, p_select boolean default false)
returns jsonb language plpgsql as $$
declare v_state text; v_message text; v_value text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(pg_temp.fixture_id(p_user)::text, ''), true);
  execute format('set local role %I', p_role);
  begin
    if p_select then
      execute p_sql into v_value;
    else
      execute p_sql;
    end if;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  return jsonb_build_object('ok', v_state is null, 'state', v_state, 'message', v_message, 'value', v_value);
end;
$$;
create function pg_temp.advance_sql(p_con text, p_to text) returns text language sql as $$
  select format('select public.advance_consolidation_governed(%L::uuid, %L)::text',
    pg_temp.fixture_id(p_con), p_to)
$$;
-- La RPC como la llama la app: authenticated con la sesión de p_user.
create function pg_temp.advance(p_user text, p_con text, p_to text) returns jsonb language sql volatile as $$
  select pg_temp.run_as('authenticated', p_user, pg_temp.advance_sql(p_con, p_to), true)
$$;
create function pg_temp.status_of(p_label text) returns text language sql volatile as $$
  select status::text from public.shipments where id = pg_temp.fixture_id(p_label)
$$;
create function pg_temp.con_status(p_label text) returns text language sql volatile as $$
  select status from public.consolidations where id = pg_temp.fixture_id(p_label)
$$;
create function pg_temp.events_of(p_label text) returns bigint language sql volatile as $$
  select count(*) from public.shipment_events where shipment_id = pg_temp.fixture_id(p_label)
$$;
create function pg_temp.audit_of(p_entity uuid, p_event text) returns bigint language sql volatile as $$
  select count(*) from public.entity_audit_log where entity_id = p_entity and event_type = p_event
$$;
create function pg_temp.set_override(p_role text, p_module text, p_view boolean, p_edit boolean)
returns void language sql volatile as $$
  delete from public.studio_role_module_overrides
   where tenant_id = pg_temp.fixture_id('tenant-A') and role = p_role and module_id = p_module;
  insert into public.studio_role_module_overrides (tenant_id, role, module_id, can_view, can_edit)
  select pg_temp.fixture_id('tenant-A'), p_role, p_module, p_view, p_edit
  where p_view is not null;
$$;

\if :fixture_only
\quit
\endif

create temporary sequence assertion_count;
create function pg_temp.check(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0477: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- 1. Catálogo: la RPC es DEFINER con search_path vacío y sólo la ejecuta
--    authenticated; los helpers no se ejecutan desde la API.
do $catalogo$
declare v_fn text;
begin
  perform pg_temp.check(to_regprocedure('public.advance_consolidation_governed(uuid,text)') is not null,
    'existe public.advance_consolidation_governed(uuid,text)');
  perform pg_temp.check((select p.prosecdef and p.proconfig = array['search_path=""']
      from pg_catalog.pg_proc p where p.oid = 'public.advance_consolidation_governed(uuid,text)'::regprocedure),
    'la RPC es SECURITY DEFINER con search_path vacío');
  perform pg_temp.check(has_function_privilege('authenticated', 'public.advance_consolidation_governed(uuid,text)', 'EXECUTE')
      and not has_function_privilege('anon', 'public.advance_consolidation_governed(uuid,text)', 'EXECUTE')
      and not has_function_privilege('service_role', 'public.advance_consolidation_governed(uuid,text)', 'EXECUTE'),
    'sólo authenticated ejecuta la RPC');
  foreach v_fn in array array['public.naviera_avance_module_authorized(uuid,text)',
      'public.naviera_avance_decision(text,text,text)', 'public.guard_consolidation_advance()'] loop
    perform pg_temp.check(not has_function_privilege('authenticated', v_fn, 'EXECUTE')
        and not has_function_privilege('anon', v_fn, 'EXECUTE')
        and not has_function_privilege('service_role', v_fn, 'EXECUTE'),
      'nadie de la API ejecuta ' || v_fn);
  end loop;
  perform pg_temp.check(exists (select 1 from pg_catalog.pg_trigger t
      where t.tgrelid = 'public.consolidations'::regclass and t.tgname = 'guard_consolidation_advance_trg'
        and not t.tgisinternal),
    'consolidations tiene el trigger guard_consolidation_advance_trg');
end;
$catalogo$;

-- 2. Nadie zarpa ni arriba por un UPDATE directo, ni siquiera el dueño; el
--    resto del contenedor se sigue editando.
do $guard$
declare v_state text;
begin
  perform pg_temp.check(pg_temp.run_as('authenticated', 'operations-A', format(
      'update public.consolidations set status = %L where id = %L', 'zarpado', pg_temp.fixture_id('con-cerrado')))->>'state' = '42501',
    'un UPDATE directo a zarpado falla con 42501');
  perform pg_temp.check(pg_temp.run_as('authenticated', 'operations-A', format(
      'update public.consolidations set status = %L where id = %L', 'arribado', pg_temp.fixture_id('con-arribo')))->>'state' = '42501',
    'un UPDATE directo a arribado falla con 42501');
  begin
    update public.consolidations set status = 'zarpado' where id = pg_temp.fixture_id('con-cerrado');
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
  end;
  perform pg_temp.check(v_state = '42501', 'tampoco el dueño de la tabla zarpa sin la RPC');
  perform pg_temp.check(pg_temp.run_as('authenticated', 'operations-A', format(
      'update public.consolidations set notes = %L where id = %L', 'nota', pg_temp.fixture_id('con-cerrado')))->>'ok' = 'true',
    'editar otra columna del contenedor sigue funcionando');
  perform pg_temp.check(pg_temp.con_status('con-cerrado') = 'cerrado' and pg_temp.con_status('con-arribo') = 'zarpado',
    'los contenedores no cambiaron de estado');
end;
$guard$;

-- 3. El zarpe: cuatro envíos avanzan a shipped, siete no y se dicen con su motivo.
create temporary table zarpe as
select (pg_temp.advance('operations-A', 'con-zarpe', 'zarpado')->>'value')::jsonb as r;

do $zarpe$
declare
  v_r jsonb := (select r from zarpe);
  v_corr text;
begin
  perform pg_temp.check(v_r is not null and v_r->>'outcome' = 'transitioned' and v_r->>'to' = 'zarpado'
      and v_r->>'shipment_status' = 'shipped' and v_r->>'tenant_id' = pg_temp.fixture_id('tenant-A')::text
      and v_r->>'consolidation_ref' = 'DTD-CONSOL-0101' and v_r->>'from' = 'cerrado',
    'el zarpe devuelve transitioned, el destino shipped, el tenant y la referencia');
  perform pg_temp.check(pg_temp.con_status('con-zarpe') = 'zarpado', 'el contenedor quedó zarpado');
  perform pg_temp.check((select array_agg(e->>'code' order by e->>'code') from jsonb_array_elements(v_r->'advanced') e)
      = array['ENV-101', 'ENV-102', 'ENV-103', 'ENV-104'],
    'avanzan exactamente draft, in_warehouse, consolidating y el FCL directo, ENV-102 una sola vez');
  perform pg_temp.check((select array_agg((e->>'code') || ':' || (e->>'from') || ':' || (e->>'client_markbox') || ':' || (e->>'client_name')
        order by e->>'code') from jsonb_array_elements(v_r->'advanced') e)
      = array['ENV-101:draft:DTD-1001:Cliente ENV-101', 'ENV-102:in_warehouse:DTD-1002:Cliente ENV-102',
              'ENV-103:consolidating:DTD-1003:Cliente ENV-103', 'ENV-104:in_warehouse:DTD-1004:Cliente ENV-104'],
    'cada avanzado trae su estado anterior, Shipping Mark y nombre para el aviso');
  perform pg_temp.check((select array_agg((e->>'code') || ':' || (e->>'reason') || ':' || (e->>'status') order by e->>'code')
        from jsonb_array_elements(v_r->'skipped') e)
      = array['ENV-105:ya_en_estado:shipped', 'ENV-106:mas_avanzado:in_transit', 'ENV-107:entregado:delivered',
              'ENV-108:cancelado:cancelled', 'ENV-109:excepcion:exception', 'ENV-110:servicio_sin_estado:in_warehouse',
              'ENV-111:eliminado:in_warehouse'],
    'los siete que no avanzan salen con su motivo exacto');
  perform pg_temp.check((v_r->>'pieces_without_shipment')::int = 1, 'cuenta la pieza sin envío');
  perform pg_temp.check(pg_temp.status_of('s-draft') = 'shipped' and pg_temp.status_of('s-wh') = 'shipped'
      and pg_temp.status_of('s-cons') = 'shipped' and pg_temp.status_of('s-fcl') = 'shipped',
    'los cuatro quedaron shipped en la base');
  perform pg_temp.check(pg_temp.status_of('s-ya') = 'shipped' and pg_temp.status_of('s-transit') = 'in_transit'
      and pg_temp.status_of('s-deliv') = 'delivered' and pg_temp.status_of('s-cancel') = 'cancelled'
      and pg_temp.status_of('s-exc') = 'exception' and pg_temp.status_of('s-terr') = 'in_warehouse'
      and pg_temp.status_of('s-del') = 'in_warehouse',
    'los que no avanzan conservan su estado');
  perform pg_temp.check(pg_temp.status_of('s-B') = 'in_warehouse' and pg_temp.events_of('s-B') = 0
      and not (v_r::text like '%ENV-901%'),
    'el envío de otro tenant colgado de una pieza no se toca ni se nombra');
  perform pg_temp.check(pg_temp.events_of('s-wh') = 1 and (select count(*) from public.shipment_events) = 4,
    'un evento por envío que avanzó, uno solo para ENV-102, ninguno para los demás');
  perform pg_temp.check((select bool_and(e.status::text = 'shipped' and e.note = 'Zarpó con el contenedor DTD-CONSOL-0101.'
        and e.created_by = pg_temp.fixture_id('operations-A') and e.tenant_id = pg_temp.fixture_id('tenant-A'))
      from public.shipment_events e),
    'los eventos dicen shipped, la nota del zarpe, el autor y el tenant');

  select correlation_id into v_corr from public.entity_audit_log
  where entity_id = pg_temp.fixture_id('con-zarpe') and event_type = 'consolidation_status_advanced';
  perform pg_temp.check(v_corr like 'naviera-avance:%'
      and (select count(*) from public.entity_audit_log where correlation_id = v_corr) = 5,
    'contenedor y cuatro envíos comparten un correlation_id naviera-avance');
  perform pg_temp.check((select count(*) from public.entity_audit_log l
      where l.event_type = 'shipment_status_changed' and l.entity_type = 'shipment' and l.actor_type = 'user'
        and l.actor_id = pg_temp.fixture_id('operations-A') and l.source = 'rpc' and l.result = 'succeeded'
        and l.after_data = '{"status": "shipped"}'::jsonb and l.payload->>'via' = 'consolidation_zarpado'
        and l.payload->>'consolidation_ref' = 'DTD-CONSOL-0101'
        and l.before_data->>'status' = l.payload->>'from') = 4,
    'cuatro eventos AUD-01 shipment_status_changed con actor, antes, después y contenedor');
  perform pg_temp.check((select l.before_data = '{"status": "cerrado"}'::jsonb and l.after_data = '{"status": "zarpado"}'::jsonb
        and jsonb_array_length(l.payload->'advanced') = 4 and jsonb_array_length(l.payload->'skipped') = 7
        and (l.payload->>'pieces_without_shipment')::int = 1 and l.payload->>'shipment_status' = 'shipped'
      from public.entity_audit_log l where l.entity_id = pg_temp.fixture_id('con-zarpe')
        and l.event_type = 'consolidation_status_advanced'),
    'el evento del contenedor guarda antes, después, avanzados, saltados y piezas');
  perform pg_temp.check(not exists (select 1 from public.entity_audit_log l
      where l.event_type in ('shipment_status_changed', 'consolidation_status_advanced')
        and (l.payload::text like '%client_name%' or l.payload::text like '%client_markbox%'
             or l.payload::text like '%Cliente ENV%')),
    'la auditoría no guarda nombres ni Shipping Mark de clientes');
end;
$zarpe$;

-- 4. Marcar zarpado otra vez no avanza ni audita nada.
do $dos_veces$
declare
  v_eventos bigint := (select count(*) from public.shipment_events);
  v_audit bigint := (select count(*) from public.entity_audit_log);
  v_r jsonb := (pg_temp.advance('operations-A', 'con-zarpe', 'zarpado')->>'value')::jsonb;
begin
  perform pg_temp.check(v_r->>'outcome' = 'already' and jsonb_array_length(v_r->'advanced') = 0
      and jsonb_array_length(v_r->'skipped') = 0 and v_r->>'tenant_id' = pg_temp.fixture_id('tenant-A')::text,
    'el segundo zarpe devuelve already, sin avanzados ni saltados');
  perform pg_temp.check((select count(*) from public.shipment_events) = v_eventos
      and (select count(*) from public.entity_audit_log) = v_audit
      and pg_temp.con_status('con-zarpe') = 'zarpado' and pg_temp.status_of('s-wh') = 'shipped',
    'el segundo zarpe no agrega eventos ni auditoría');
end;
$dos_veces$;

-- 5. El arribo: shipped e in_transit pasan a in_customs; in_customs, bodega VE y
--    bodegaje no.
do $arribo$
declare v_r jsonb := (pg_temp.advance('operations-A', 'con-arribo', 'arribado')->>'value')::jsonb;
begin
  perform pg_temp.check(v_r->>'outcome' = 'transitioned' and v_r->>'shipment_status' = 'in_customs'
      and v_r->>'from' = 'zarpado' and pg_temp.con_status('con-arribo') = 'arribado',
    'el arribo deja el contenedor arribado y devuelve el destino in_customs');
  perform pg_temp.check((select array_agg((e->>'code') || ':' || (e->>'from') order by e->>'code')
        from jsonb_array_elements(v_r->'advanced') e)
      = array['ENV-201:shipped', 'ENV-202:in_transit', 'ENV-203:shipped'],
    'avanzan el LCL embarcado, el puerta a puerta en tránsito y el FCL de bodega');
  perform pg_temp.check((select array_agg((e->>'code') || ':' || (e->>'reason') order by e->>'code')
        from jsonb_array_elements(v_r->'skipped') e)
      = array['ENV-204:ya_en_estado', 'ENV-205:mas_avanzado', 'ENV-206:mas_avanzado'],
    'en aduana, en bodega VE y en bodegaje no avanzan');
  perform pg_temp.check(pg_temp.status_of('a-shipped') = 'in_customs' and pg_temp.status_of('a-transit') = 'in_customs'
      and pg_temp.status_of('a-fclb') = 'in_customs' and pg_temp.status_of('a-bodega') = 'arrived_destination'
      and pg_temp.status_of('a-delayed') = 'delayed_warehouse',
    'los estados del arribo quedaron como dice la regla');
  perform pg_temp.check((select count(*) from public.shipment_events e
      where e.note = 'Llegó a Venezuela con el contenedor DTD-CONSOL-0102.' and e.status::text = 'in_customs') = 3,
    'tres eventos in_customs con la nota del arribo');
end;
$arribo$;

-- 6. Estados del contenedor que no corresponden: nada cambia.
do $conflictos$
declare v_r jsonb;
begin
  v_r := pg_temp.advance('operations-A', 'con-abierto', 'zarpado');
  perform pg_temp.check(v_r->>'state' = '40001' and pg_temp.con_status('con-abierto') = 'consolidando'
      and pg_temp.status_of('s-open') = 'in_warehouse' and pg_temp.events_of('s-open') = 0,
    'un contenedor consolidando no zarpa (40001) y su envío no avanza');
  perform pg_temp.check(v_r->>'message' = 'naviera: el contenedor está en «consolidando» y sólo pasa a «zarpado» desde «cerrado»',
    'el rechazo dice en qué estado está el contenedor y desde cuál se zarpa');
  v_r := pg_temp.advance('operations-A', 'con-cerrado', 'arribado');
  perform pg_temp.check(v_r->>'state' = '40001' and pg_temp.con_status('con-cerrado') = 'cerrado'
      and pg_temp.status_of('s-cerrado') = 'in_warehouse',
    'un contenedor cerrado no arriba (40001)');
  perform pg_temp.check(pg_temp.advance('operations-A', 'con-cerrado', 'cerrado')->>'state' = '22023'
      and pg_temp.advance('operations-A', 'con-cerrado', 'transito')->>'state' = '22023'
      and pg_temp.run_as('authenticated', 'operations-A', format(
        'select public.advance_consolidation_governed(%L::uuid, null)::text', pg_temp.fixture_id('con-cerrado')))->>'state' = '22023',
    'cualquier destino que no sea zarpado o arribado falla con 22023');
  perform pg_temp.check(pg_temp.advance('operations-A', 'con-borrado', 'zarpado')->>'state' = 'P0002',
    'un contenedor eliminado no está disponible (P0002)');
  perform pg_temp.check(pg_temp.con_status('con-cerrado') = 'cerrado', 'el contenedor cerrado sigue cerrado');
end;
$conflictos$;

-- 7. Permisos: membresía activa en el tenant del contenedor y edición de
--    Naviera Y de Tracking según la matriz y sus desvíos.
do $permisos$
declare v_user text;
begin
  foreach v_user in array array['commercial-A', 'warehouse-A', 'support-A', 'marketing-A'] loop
    perform pg_temp.check(pg_temp.advance(v_user, 'con-cerrado', 'zarpado')->>'state' = '42501',
      v_user || ' no zarpa (42501)');
  end loop;
  perform pg_temp.check(pg_temp.advance('operations-off-A', 'con-cerrado', 'zarpado')->>'state' = 'P0002',
    'una membresía desactivada no ve el contenedor (P0002)');
  perform pg_temp.check(pg_temp.advance('operations-B', 'con-cerrado', 'zarpado')->>'state' = 'P0002',
    'el operador de otro tenant no ve el contenedor (P0002)');
  perform pg_temp.check(pg_temp.advance(null, 'con-cerrado', 'zarpado')->>'state' = '42501',
    'sin sesión no se zarpa (42501)');
  perform pg_temp.check(pg_temp.run_as('anon', null, pg_temp.advance_sql('con-cerrado', 'zarpado'))->>'state' = '42501',
    'anon no puede ejecutar la RPC');
  perform pg_temp.check(pg_temp.con_status('con-cerrado') = 'cerrado' and pg_temp.status_of('s-cerrado') = 'in_warehouse',
    'ningún intento denegado cambió nada');

  perform pg_temp.check(pg_temp.advance('accounting-A', 'con-acc', 'zarpado')->>'value' is not null
      and pg_temp.status_of('s-acc') = 'shipped',
    'accounting edita Naviera y Tracking: zarpa');
  perform pg_temp.check(pg_temp.advance('admin-A', 'con-admin', 'zarpado')->>'value' is not null
      and pg_temp.status_of('s-admin') = 'shipped',
    'admin zarpa');

  -- Desvíos de 0357.
  perform pg_temp.set_override('operations', 'tracking', true, false);
  perform pg_temp.check(pg_temp.advance('operations-A', 'con-cerrado', 'zarpado')->>'state' = '42501',
    'operations sin edición de Tracking por desvío no zarpa');
  perform pg_temp.set_override('operations', 'tracking', null, null);
  perform pg_temp.set_override('operations', 'naviera', true, false);
  perform pg_temp.check(pg_temp.advance('operations-A', 'con-cerrado', 'zarpado')->>'state' = '42501',
    'operations sin edición de Naviera por desvío no zarpa');
  perform pg_temp.set_override('operations', 'naviera', null, null);
  perform pg_temp.set_override('support', 'naviera', true, true);
  perform pg_temp.set_override('support', 'tracking', true, true);
  perform pg_temp.check(pg_temp.advance('support-A', 'con-cerrado', 'zarpado')->>'state' = '42501',
    'support nunca edita, ni con desvío');
  perform pg_temp.set_override('commercial', 'naviera', true, true);
  perform pg_temp.check(pg_temp.advance('commercial-A', 'con-comercial', 'zarpado')->>'value' is not null
      and pg_temp.status_of('s-com') = 'shipped',
    'commercial con edición de Naviera por desvío zarpa');
  perform pg_temp.check(pg_temp.con_status('con-cerrado') = 'cerrado', 'los desvíos negativos no cambiaron nada');
end;
$permisos$;

-- 8. Si la auditoría no se puede escribir, no cambia nada.
do $fallo_auditoria$
declare v_r jsonb;
begin
  update public.audit_entity_types set status = 'deprecated', deprecated_at = now() where entity_type = 'shipment';
  v_r := pg_temp.advance('operations-A', 'con-fallo', 'zarpado');
  update public.audit_entity_types set status = 'active', deprecated_at = null where entity_type = 'shipment';
  perform pg_temp.check(v_r->>'state' = '23503', 'con la entidad shipment inactiva el writer rechaza (23503)');
  perform pg_temp.check(pg_temp.con_status('con-fallo') = 'cerrado' and pg_temp.status_of('s-fallo') = 'in_warehouse'
      and pg_temp.events_of('s-fallo') = 0
      and pg_temp.audit_of(pg_temp.fixture_id('con-fallo'), 'consolidation_status_advanced') = 0,
    'el fallo de auditoría revierte el contenedor, el envío y su evento');
end;
$fallo_auditoria$;

-- 9. 0477 sólo agrega sus cuatro funciones a public.
do $sin_danos$
begin
  perform pg_temp.check(not exists (
    select 1 from baseline_functions b
    full join (select p.oid, p.proname, to_jsonb(p) as definition
               from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public') c on c.oid = b.oid
    where coalesce(b.proname, c.proname) not in ('advance_consolidation_governed',
        'naviera_avance_module_authorized', 'naviera_avance_decision', 'guard_consolidation_advance')
      and (b.oid is null or c.oid is null or b.definition <> c.definition)),
    '0477 no toca ninguna otra función de public');
  perform pg_temp.check((select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('advance_consolidation_governed',
        'naviera_avance_module_authorized', 'naviera_avance_decision', 'guard_consolidation_advance')) = 4,
    'las cuatro funciones de 0477 existen una sola vez');
end;
$sin_danos$;

select 'TEST 0477 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
