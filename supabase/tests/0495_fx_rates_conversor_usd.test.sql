\set ON_ERROR_STOP on
-- SDD-0569 · Contrato de 0495: el conversor a USD que falla cerrado y la tabla de
-- tasas. Fixture sintético aislado; no ejecutar sobre una DB real. Aplica con
-- \ir las migraciones REALES de la auditoría (0267, 0294), facturas (0077),
-- contabilidad (0078) y tesorería (0088), y después 0495. Termina en ROLLBACK.
-- RED: psql -v apply_fix=false -f /sb/tests/0495_fx_rates_conversor_usd.test.sql
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
do $fixture_guard$
begin
  if to_regclass('public.entity_audit_log') is not null or to_regclass('public.invoices') is not null then
    raise exception 'TEST 0495: fixture rechazada, la base ya contiene objetos de aplicación';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$fixture_guard$;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create table public.tenants (id uuid primary key, slug text unique not null, display_name text not null);

-- La auditoría, como el contrato 0491.
create table public.audit_entity_types (
  entity_type text primary key,
  status text not null check (status in ('active', 'deprecated')),
  domain_code text, contract_version integer, introduced_by_ref text
);
-- El tipo exchange_rate lo siembra 0293 en producción.
insert into public.audit_entity_types values ('exchange_rate', 'active', 'configuration', 1, 'migration:0293');
create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  entity_type text not null, entity_id uuid not null, actor_type text not null,
  actor_id uuid, event_type text not null, payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint entity_audit_log_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade,
  constraint entity_audit_log_entity_type_fkey foreign key (entity_type)
    references public.audit_entity_types(entity_type) on update restrict on delete restrict,
  constraint entity_audit_log_actor_type_check check (actor_type in ('user', 'operario', 'system'))
);
alter table public.entity_audit_log enable row level security;
create policy entity_audit_log_tenant_select on public.entity_audit_log for select to authenticated using (true);
create policy entity_audit_log_service_role_all on public.entity_audit_log for all to service_role using (true) with check (true);
grant select on public.entity_audit_log to authenticated;
grant all on public.entity_audit_log to service_role;
create publication supabase_realtime;
alter publication supabase_realtime add table public.entity_audit_log;
\ir ../migrations/0267_audit_contract_append_only.sql
\ir ../migrations/0294_audit_d2_human_reasons.sql

create table public.user_tenants (
  user_id uuid not null references auth.users(id), tenant_id uuid not null references public.tenants(id),
  role text not null, disabled_at timestamptz, primary key (user_id, tenant_id)
);
alter table public.user_tenants enable row level security;
grant select on public.user_tenants to authenticated;
create policy "users see their own user_tenants" on public.user_tenants
  for select to authenticated using (user_id = (select auth.uid()) and disabled_at is null);
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1] from public.user_tenants as ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;
grant execute on function public.get_user_tenant_id() to authenticated;
create function public.current_studio_role() returns text
language sql stable security definer set search_path = '' as $$
  select ut.role from public.user_tenants ut where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create table public.shipments (
  id uuid primary key, tenant_id uuid not null references public.tenants(id), shipment_service text, deleted_at timestamptz
);
-- 0074 crea tenant_fx_history; acá basta su forma para el conteo del preflight.
create table public.tenant_fx_history (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
  currency_pair text not null, rate numeric not null check (rate > 0), set_at timestamptz default now(),
  set_by uuid, expense_id uuid
);

\ir ../migrations/0077_invoices.sql
\ir ../migrations/0078_contabilidad.sql
\ir ../migrations/0088_tesoreria.sql
-- 0077, 0078 y 0088 vuelven a crear la lista cerrada (CHECK) de entity_type, que
-- en producción retiró la 0261: desde entonces manda la FK a audit_entity_types.
alter table public.entity_audit_log drop constraint entity_audit_log_entity_type_check;
\if :apply_fix
\ir ../migrations/0495_fx_rates_conversor_usd.sql
\endif

create function pg_temp.fixture_id(p_label text) returns uuid language sql immutable as $$
  select md5('0495-synthetic-' || p_label)::uuid
$$;
insert into auth.users (id) select pg_temp.fixture_id(u) from unnest(array['admin-A', 'accounting-A', 'commercial-A', 'admin-B']) u;
insert into public.tenants (id, slug, display_name) values
  (pg_temp.fixture_id('tenant-A'), 'tenant-a-0495', 'Tenant A 0495'),
  (pg_temp.fixture_id('tenant-B'), 'tenant-b-0495', 'Tenant B 0495');
insert into public.user_tenants (user_id, tenant_id, role)
select pg_temp.fixture_id(u), pg_temp.fixture_id(t), r from (values
  ('admin-A', 'tenant-A', 'admin'), ('accounting-A', 'tenant-A', 'accounting'),
  ('commercial-A', 'tenant-A', 'commercial'), ('admin-B', 'tenant-B', 'admin')) v(u, t, r);

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0495: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;
create function pg_temp.as_actor(p_actor text, p_sql text, p_role text default 'authenticated')
returns jsonb language plpgsql as $$
declare v_result jsonb;
begin
  perform set_config('request.jwt.claim.sub', coalesce(pg_temp.fixture_id(p_actor)::text, ''), true);
  execute format('set local role %I', p_role);
  execute p_sql into v_result;
  reset role;
  return v_result;
exception when others then
  reset role;
  raise;
end;
$$;
create function pg_temp.error_of(p_actor text, p_sql text, p_role text default 'authenticated')
returns text language plpgsql as $$
declare v_state text; v_message text; v_hint text;
begin
  perform pg_temp.as_actor(p_actor, p_sql, p_role);
  return 'ok';
exception when others then
  get stacked diagnostics v_state = returned_sqlstate, v_message = message_text, v_hint = pg_exception_hint;
  return v_state || '|' || v_message || '|' || coalesce(v_hint, '');
end;
$$;
create function pg_temp.err(p_sql text) returns text language plpgsql as $$
declare v_state text; v_message text; v_hint text;
begin
  execute p_sql;
  return 'ok';
exception when others then
  get stacked diagnostics v_state = returned_sqlstate, v_message = message_text, v_hint = pg_exception_hint;
  return v_state || '|' || v_message || '|' || coalesce(v_hint, '');
end;
$$;
-- Si to_usd lanza, devuelve -999999 (ningún caso feliz da eso): un mutante que
-- lanza muere en la aserción con su etiqueta, no con el mensaje crudo.
create function pg_temp.usd(p_amount numeric, p_currency text, p_rate numeric) returns numeric language plpgsql as $$
begin
  return public.to_usd(p_amount, p_currency, p_rate);
exception when others then
  return -999999;
end;
$$;

-- ── 0. La migración está (control rojo: sin 0495 falla acá) ──
select pg_temp.assert_true(to_regprocedure('public.to_usd(numeric,text,numeric)') is not null,
  'existe public.to_usd(numeric,text,numeric)');

-- ── 1. El conversor: USDT = USD 1:1, VES y CNY con tasa ──
select pg_temp.assert_true(pg_temp.usd(100, 'USD', null) = 100 and pg_temp.usd(100, 'usdt', null) = 100,
  'USD y USDT valen 1:1, sin tasa (decisión 1 de Sam)');
select pg_temp.assert_true(pg_temp.usd(36500, 'VES', 36.5) = 1000, 'VES se divide por la tasa');
select pg_temp.assert_true(pg_temp.usd(718, 'CNY', 7.18) = 100 and pg_temp.usd(718, 'RMB', 7.18) = 100,
  'CNY se divide por la tasa, y RMB es CNY');
select pg_temp.assert_true(pg_temp.usd(10, 'VES', 3) = 3.33, 'redondea a 2 decimales al final');
-- Revisión de seguridad (2026-10-20), hallazgos 5 y 12: los mismos casos que
-- lib/shared/__tests__/fx.test.ts. Medio centavo lejos de cero, como round(numeric).
select pg_temp.assert_true(pg_temp.usd(15.66, 'CNY', 7.2) = 2.18 and pg_temp.usd(-15.66, 'CNY', 7.2) = -2.18,
  'el medio centavo se redondea lejos de cero (CNY)');
select pg_temp.assert_true(pg_temp.usd(10.075, 'USD', null) = 10.08 and pg_temp.usd(-10.075, 'USDT', null) = -10.08
  and pg_temp.usd(0.005, 'USD', null) = 0.01, 'el medio centavo se redondea lejos de cero (USD)');
select pg_temp.assert_true(pg_temp.usd(999999999999.99, 'USD', null) = 999999999999.99
  and pg_temp.usd(1000000000000, 'USD', null) = -999999 and pg_temp.usd(-1000000000000, 'USD', null) = -999999,
  'el tope es el mismo que en TS: |monto| < 1e12');
select pg_temp.assert_true(pg_temp.err('select public.to_usd(null, ''VES'', 36)') = '22023|FX_AMOUNT_INVALID|dtd-fx',
  'un monto nulo falla cerrado, como en TS');

-- ── 2. Falla cerrado: nunca 0 ni el monto tal cual ──
select pg_temp.assert_true(pg_temp.err('select public.to_usd(500, ''VES'', null)') = '22023|FX_RATE_MISSING|dtd-fx',
  'VES sin tasa falla cerrado (no el nominal)');
select pg_temp.assert_true(pg_temp.err('select public.to_usd(500, ''CNY'', null)') = '22023|FX_RATE_MISSING|dtd-fx',
  'CNY sin tasa falla cerrado (no 0)');
select pg_temp.assert_true(pg_temp.err('select public.to_usd(500, ''VES'', 0)') = '22023|FX_RATE_MISSING|dtd-fx'
  and pg_temp.err('select public.to_usd(500, ''VES'', -1)') = '22023|FX_RATE_MISSING|dtd-fx',
  'una tasa 0 o negativa falla cerrado');
select pg_temp.assert_true(pg_temp.err('select public.to_usd(500, ''VES'', ''NaN''::numeric)') = '22023|FX_RATE_MISSING|dtd-fx'
  and pg_temp.err('select public.to_usd(500, ''VES'', ''Infinity''::numeric)') = '22023|FX_RATE_MISSING|dtd-fx',
  'NaN e Infinity no son una tasa');
select pg_temp.assert_true(pg_temp.err('select public.to_usd(''NaN''::numeric, ''USD'', null)') = '22023|FX_AMOUNT_INVALID|dtd-fx',
  'NaN no es un monto');
select pg_temp.assert_true(pg_temp.err('select public.to_usd(500, ''EUR'', 1.1)') = '22023|FX_CURRENCY_UNKNOWN|dtd-fx',
  'una moneda desconocida falla cerrado');
select pg_temp.assert_true(
  (select p.provolatile from pg_proc p where p.oid = 'public.to_usd(numeric,text,numeric)'::regprocedure) = 'i'
  and (select p.provolatile from pg_proc p where p.oid = 'public.fx_rate_on(uuid,text,date)'::regprocedure) = 's',
  'to_usd es IMMUTABLE (recibe la tasa) y fx_rate_on es STABLE (lee la tabla)');

-- ── 3. La tabla: solo se lee por la API ──
select pg_temp.assert_true(has_table_privilege('authenticated', 'public.fx_rates', 'SELECT')
  and not has_table_privilege('authenticated', 'public.fx_rates', 'INSERT')
  and not has_table_privilege('authenticated', 'public.fx_rates', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.fx_rates', 'DELETE'),
  'authenticated solo lee fx_rates');
select pg_temp.assert_true(split_part(pg_temp.error_of('admin-A', format(
  'insert into public.fx_rates (tenant_id, currency, rate, valid_on, source) values (%L::uuid, ''VES'', 36, ''2026-10-01'', ''bcv'') returning to_jsonb(id)',
  pg_temp.fixture_id('tenant-A'))), '|', 1) = '42501', 'ni el admin escribe la tabla a mano');

-- ── 4. Registrar una tasa: admin o accounting, con fecha y validada ──
select pg_temp.assert_true(pg_temp.error_of('commercial-A',
  'select public.registrar_tasa_de_cambio(''VES'', 36.5, ''2026-10-01'', null)')
  = '42501|Solo admin o contabilidad registran una tasa de cambio.|dtd-fx', 'commercial no registra tasas');
select pg_temp.assert_true(pg_temp.error_of('admin-A',
  'select public.registrar_tasa_de_cambio(''USD'', 1, ''2026-10-01'', null)')
  = '22023|La tasa se registra para bolívares (VES) o yuanes (CNY).|dtd-fx', 'no se registra una tasa de USD');
select pg_temp.assert_true(pg_temp.error_of('admin-A',
  'select public.registrar_tasa_de_cambio(''VES'', 0, ''2026-10-01'', null)')
  = '22023|La tasa tiene que ser un número mayor que 0.|dtd-fx', 'una tasa 0 no se registra');
select pg_temp.assert_true(pg_temp.error_of('admin-A',
  'select public.registrar_tasa_de_cambio(''VES'', ''NaN''::numeric, ''2026-10-01'', null)')
  = '22023|La tasa tiene que ser un número mayor que 0.|dtd-fx', 'NaN no se registra');
select pg_temp.assert_true(pg_temp.error_of('admin-A', format(
  'select public.registrar_tasa_de_cambio(''VES'', 36, %L::date, null)', (now() at time zone 'America/Caracas')::date + 1))
  = '22023|La fecha de la tasa no puede ser posterior a hoy.|dtd-fx', 'una tasa no se registra con fecha futura');
select pg_temp.assert_true(pg_temp.error_of('admin-A',
  'select public.registrar_tasa_de_cambio(''VES'', 36.123456789, ''2026-10-01'', null)')
  = '22023|La tasa admite hasta 8 decimales.|dtd-fx', 'una tasa con más de 8 decimales se rechaza');
select pg_temp.assert_true((pg_temp.as_actor('admin-A',
  'select public.registrar_tasa_de_cambio(''VES'', 36.5, ''2026-10-01'', ''BCV del día'')') ->> 'ok')::boolean
  and (pg_temp.as_actor('accounting-A',
  'select public.registrar_tasa_de_cambio(''rmb'', 7.18, ''2026-10-01'', null)') ->> 'currency') = 'CNY',
  'admin y accounting registran; rmb queda como CNY');
select pg_temp.assert_true((select source = 'manual' and set_by = pg_temp.fixture_id('admin-A') and rate = 36.5
  from public.fx_rates where tenant_id = pg_temp.fixture_id('tenant-A') and currency = 'VES' and valid_on = '2026-10-01'),
  'la tasa queda como manual, con quién');

-- ── 5. La segunda del mismo día la reemplaza, y la auditoría guarda la anterior ──
select pg_temp.as_actor('accounting-A', 'select public.registrar_tasa_de_cambio(''VES'', 36.7, ''2026-10-01'', ''Corrección'')');
select pg_temp.assert_true((select count(*) from public.fx_rates
  where tenant_id = pg_temp.fixture_id('tenant-A') and currency = 'VES' and valid_on = '2026-10-01') = 1
  and (select rate from public.fx_rates where tenant_id = pg_temp.fixture_id('tenant-A') and currency = 'VES' and valid_on = '2026-10-01') = 36.7,
  'la segunda tasa manual del mismo día reemplaza a la primera');
select pg_temp.assert_true(exists (select 1 from public.entity_audit_log
  where entity_type = 'exchange_rate' and event_type = 'exchange_rate_corrected'
    and (before_data ->> 'rate')::numeric = 36.5 and (after_data ->> 'rate')::numeric = 36.7),
  'la auditoría D2 guarda la tasa anterior y la nueva');
select pg_temp.assert_true((select count(*) from public.entity_audit_log
  where entity_type = 'exchange_rate' and event_type = 'exchange_rate_recorded') = 2,
  'cada tasa nueva queda registrada en la auditoría');
-- Pedido del Director (2026-10-20): la auditoría de fx_rates solo guarda la
-- moneda, la tasa, el día y la fuente. Ni la nota (texto libre, puede traer un
-- nombre) ni set_by. El actor queda en actor_id, como en toda la D2 (AUD-01).
select pg_temp.assert_true(not exists (
  select 1 from public.entity_audit_log a
  where a.entity_type = 'exchange_rate' and (
    exists (select 1 from jsonb_object_keys(coalesce(a.before_data, '{}'::jsonb)) k
            where k not in ('currency', 'rate', 'valid_on', 'source'))
    or exists (select 1 from jsonb_object_keys(coalesce(a.after_data, '{}'::jsonb)) k
            where k not in ('currency', 'rate', 'valid_on', 'source'))
    or to_jsonb(a)::text like '%Corrección%'
    or coalesce(a.before_data::text, '') || coalesce(a.after_data::text, '') || coalesce(a.payload::text, '')
       like '%' || pg_temp.fixture_id('accounting-A')::text || '%')),
  'la auditoría D2 de fx_rates no guarda datos personales: solo moneda, tasa, día y fuente');

-- ── 6. La tasa vigente: la fecha más reciente, y ese día bcv > manual > operacion ──
insert into public.fx_rates (tenant_id, currency, rate, valid_on, source) values
  (pg_temp.fixture_id('tenant-A'), 'VES', 37.0, '2026-10-05', 'operacion'),
  (pg_temp.fixture_id('tenant-A'), 'VES', 36.9, '2026-10-05', 'manual'),
  (pg_temp.fixture_id('tenant-A'), 'VES', 36.8, '2026-10-05', 'bcv'),
  (pg_temp.fixture_id('tenant-B'), 'VES', 99.0, '2026-10-05', 'bcv'),
  (pg_temp.fixture_id('tenant-B'), 'VES', 98.0, '2026-10-06', 'bcv');
create function pg_temp.vigente(p_actor text, p_currency text, p_on date) returns text language plpgsql as $$
begin
  return (pg_temp.as_actor(p_actor, format(
    'select to_jsonb(r) from public.fx_rate_on(%L::uuid, %L, %L::date) r', pg_temp.fixture_id('tenant-A'), p_currency, p_on)))::text;
end;
$$;
select pg_temp.assert_true((pg_temp.vigente('accounting-A', 'VES', '2026-10-05'))::jsonb
  = '{"rate": 36.80000000, "source": "bcv", "valid_on": "2026-10-05"}'::jsonb, 'ese día gana la del BCV');
select pg_temp.assert_true((pg_temp.vigente('accounting-A', 'VES', '2026-10-03'))::jsonb
  = '{"rate": 36.70000000, "source": "manual", "valid_on": "2026-10-01"}'::jsonb, 'sin tasa ese día, la más reciente anterior');
select pg_temp.assert_true(pg_temp.error_of('accounting-A', format(
  'select to_jsonb(r) from public.fx_rate_on(%L::uuid, ''VES'', ''2026-09-30'') r', pg_temp.fixture_id('tenant-A')))
  = '22023|FX_RATE_MISSING|dtd-fx', 'sin ninguna tasa anterior, falla cerrado');
-- Pedido del Director: el filtro por tenant va en la consulta (acá) Y en la RLS
-- (abajo). service_role no tiene RLS que lo corte: con la tasa del tenant B más
-- reciente, fx_rate_on(A) tiene que seguir devolviendo la de A.
select pg_temp.assert_true((pg_temp.as_actor(null, format(
  'select to_jsonb(r) from public.fx_rate_on(%L::uuid, ''VES'', ''2026-10-06'') r', pg_temp.fixture_id('tenant-A')),
  'service_role'))::jsonb = '{"rate": 36.80000000, "source": "bcv", "valid_on": "2026-10-05"}'::jsonb,
  'fx_rate_on filtra por el tenant pedido también sin RLS');
select pg_temp.assert_true(pg_temp.error_of('admin-B', format(
  'select to_jsonb(r) from public.fx_rate_on(%L::uuid, ''VES'', ''2026-10-05'') r', pg_temp.fixture_id('tenant-A')))
  = '22023|FX_RATE_MISSING|dtd-fx', 'otro tenant no ve las tasas del tenant A');
-- Revisión, hallazgo 1: borrar una tasa (service_role, la futura carga o una
-- limpieza) deja exchange_rate_deleted con su motivo y la tasa anterior.
select pg_temp.assert_true(pg_temp.error_of(null, format(
  'delete from public.fx_rates where tenant_id = %L::uuid and valid_on = ''2026-10-05'' and source = ''operacion'' returning to_jsonb(id)',
  pg_temp.fixture_id('tenant-A')), 'service_role') = 'ok', 'una tasa se puede borrar');
select pg_temp.assert_true(exists (select 1 from public.entity_audit_log
  where entity_type = 'exchange_rate' and event_type = 'exchange_rate_deleted'
    and (before_data ->> 'rate')::numeric = 37.0 and after_data is null and reason is not null),
  'borrar una tasa queda en la auditoría con su motivo y la tasa anterior');

-- ── 7. El documento guarda la fuente y la fecha de su tasa ──
select pg_temp.assert_true(
  (select count(*) from information_schema.columns where table_schema = 'public'
     and table_name in ('invoices', 'supplier_bills') and column_name in ('fx_rate_source', 'fx_rate_valid_on')) = 4,
  'facturas y CxP guardan la fuente y la fecha de su tasa');
select pg_temp.assert_true(pg_temp.err(format(
  'insert into public.invoices (tenant_id, invoice_code, client_markbox, client_name, currency, fx_rate, fx_rate_source, base_amount, total_amount, paid_amount, status) '
  || 'values (%L::uuid, ''F-1'', ''DTD-1'', ''C'', ''VES'', 36, ''paralela'', 100, 100, 0, ''borrador'')', pg_temp.fixture_id('tenant-A'))) like '23514|%',
  'la fuente de la tasa del documento es bcv, manual u operacion');

-- Revisión, hallazgo 6: la tasa del documento tiene los mismos 8 decimales que
-- fx_rates. Ampliar numeric(14,4) a numeric(20,8) no pierde nada: los enteros
-- pasan de 10 a 12 dígitos y los decimales de 4 a 8, así que cada valor cabe igual.
select pg_temp.assert_true((select count(*) from information_schema.columns
  where table_schema = 'public' and table_name in ('invoices', 'supplier_bills') and column_name = 'fx_rate'
    and numeric_precision = 20 and numeric_scale = 8) = 2,
  'la tasa de facturas y CxP es numeric(20,8), como fx_rates');
select pg_temp.assert_true(pg_temp.err(format(
  'insert into public.invoices (tenant_id, invoice_code, client_markbox, client_name, currency, fx_rate, base_amount, total_amount, paid_amount, status) '
  || 'values (%L::uuid, ''F-2'', ''DTD-1'', ''C'', ''VES'', 36.12345678, 100, 100, 0, ''borrador'')', pg_temp.fixture_id('tenant-A'))) = 'ok',
  'una factura acepta una tasa con 8 decimales');
-- En otra sentencia: la misma no ve lo que insertó la función.
select pg_temp.assert_true((select fx_rate from public.invoices where invoice_code = 'F-2') = 36.12345678,
  'la factura guarda la tasa con sus 8 decimales');
select pg_temp.assert_true(
  0.000000001::numeric(20,8) = 0 and 0.000000004999999::numeric(20,8) = 0
  and 0.000000005::numeric(20,8) = 0.00000001 and 0.000000015::numeric(20,8) = 0.00000002,
  'la captura debe rechazar tasas que numeric(20,8) redondea a cero y respetar la mitad');
-- El lock que toma la 0495 sobre las dos tablas (dura lo que la transacción).
select pg_temp.assert_true((select count(*) from pg_locks l
  where l.locktype = 'relation' and l.granted and l.mode = 'AccessExclusiveLock'
    and l.relation in ('public.invoices'::regclass, 'public.supplier_bills'::regclass)) = 2,
  'el lock medido: ACCESS EXCLUSIVE sobre invoices y supplier_bills');
select pg_temp.assert_true((select c.relrowsecurity from pg_class c where c.oid = 'public.fx_rates'::regclass)
  and not has_table_privilege('anon', 'public.fx_rates', 'SELECT'),
  'fx_rates tiene RLS activa y anon no la lee');

-- ── 8. El preflight: tenant_fx_history vacía y aplicada una sola vez ──
-- Revisión Codex: source=manual del catálogo no implica override documental.
select pg_temp.assert_true(
  (select count(*) from information_schema.columns where table_schema = 'public'
    and table_name in ('invoices', 'supplier_bills') and column_name = 'fx_rate_is_override'
    and data_type = 'boolean' and is_nullable = 'NO' and column_default = 'false') = 2,
  'facturas y CxP distinguen override explícito, false por defecto');
update public.invoices set fx_rate_source = 'manual', fx_rate_valid_on = '2026-10-19'
  where invoice_code = 'F-2';
select pg_temp.assert_true((select not fx_rate_is_override from public.invoices where invoice_code = 'F-2'),
  'source manual del catálogo no se convierte en override documental');
update public.invoices set fx_rate_is_override = true where invoice_code = 'F-2';
select pg_temp.assert_true((select fx_rate_is_override from public.invoices where invoice_code = 'F-2'),
  'el override documental explícito queda persistido');

-- Todas las sentencias de este contrato viven en una transacción: updated_at
-- no cambia, pero write_version sí, incluso si el cliente intenta asignarla.
select pg_temp.assert_true((select write_version = 2 from public.invoices where invoice_code = 'F-2'),
  'la versión distingue dos escrituras dentro de la misma transacción');
update public.invoices set client_name = 'Otro destinatario sintético', total_amount = 101,
  write_version = 999 where invoice_code = 'F-2';
select pg_temp.assert_true((select write_version = 3 from public.invoices where invoice_code = 'F-2'),
  'cualquier cambio de factura incrementa versión e ignora la versión propuesta');
with cambiado as (
  update public.invoices set status = 'emitida' where invoice_code = 'F-2'
    and write_version = 2 and status = 'borrador' and currency = 'VES'
    returning id
)
select pg_temp.assert_true((select count(*) from cambiado) = 0,
  'una emisión con versión obsoleta no afecta filas');
with cambiado as (
  update public.invoices set status = 'emitida' where invoice_code = 'F-2'
    and write_version = 3 and status = 'borrador' and currency = 'VES'
    returning id
)
select pg_temp.assert_true((select count(*) from cambiado) = 1,
  'la emisión con versión vigente afecta exactamente una fila');
with cambiado as (
  update public.invoices set currency = 'USD' where invoice_code = 'F-2'
    and write_version = 3 and status = 'borrador' and currency = 'VES'
    returning id
)
select pg_temp.assert_true((select count(*) from cambiado) = 0,
  'una edición pendiente no cambia la factura ya emitida');
select pg_temp.assert_true((select status = 'emitida' and currency = 'VES' and write_version = 4
  from public.invoices where invoice_code = 'F-2'),
  'la carrera conserva estado moneda y versión de la emisión ganadora');
select pg_temp.assert_true(
  not has_function_privilege('authenticated', 'public.increment_invoice_write_version()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.increment_invoice_write_version()', 'EXECUTE'),
  'el disparador de versión no expone una RPC ejecutable');
select pg_temp.assert_true(pg_temp.error_of('accounting-A',
  'update public.invoices set notes = ''nota sintética'' where invoice_code = ''F-2'' returning to_jsonb(id)') = 'ok',
  'authenticated actualiza la factura por RLS sin permiso EXECUTE directo del trigger');
select pg_temp.assert_true((select write_version = 5 from public.invoices where invoice_code = 'F-2'),
  'la actualización autenticada también aumenta la versión');

select pg_temp.assert_true((select count(*) from public.tenant_fx_history) = 0, 'tenant_fx_history sigue vacía');

select 'TEST 0495 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
