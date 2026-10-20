\set ON_ERROR_STOP on
-- SDD-0567 · Contrato de 0494: el candado del crédito de referido. Fixture
-- sintético aislado; no ejecutar sobre una DB real. Aplica con \ir las
-- migraciones REALES de facturas (0077), contabilidad (0078), referidos (0098,
-- 0197, 0237, 0238, 0250), RLS de facturas (0407) y el crédito atómico (0471),
-- y después 0494. Termina en ROLLBACK.
-- RED: psql -v apply_fix=false -f /sb/tests/0494_credito_referido_candado.test.sql
--
-- Todo corre en UNA transacción y en una sesión. Las filas nacen por el camino
-- real (INSERT como invitado o registrado, y después las RPC y los
-- disparadores): con el guardián puesto, ya no se puede sembrar un estado a mano.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
do $fixture_guard$
begin
  if to_regclass('public.invoices') is not null or to_regclass('public.tenants') is not null
     or to_regclass('public.referrals') is not null then
    raise exception 'TEST 0494: fixture rechazada, la base ya contiene objetos de aplicación';
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
grant usage on schema auth to authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.tenants (id uuid primary key, slug text unique not null, display_name text not null);
create table public.user_tenants (
  user_id uuid not null references auth.users(id), tenant_id uuid not null references public.tenants(id),
  role text not null, disabled_at timestamptz, primary key (user_id, tenant_id)
);
alter table public.user_tenants enable row level security;
grant select on public.user_tenants to authenticated;
create policy "users see their own user_tenants" on public.user_tenants
  for select to authenticated using (user_id = (select auth.uid()) and disabled_at is null);
-- El cuerpo de get_user_tenant_id es el de 0453, que el preflight exige por md5.
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1] from public.user_tenants as ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;
create function public.current_studio_role() returns text
language sql stable security definer set search_path = '' as $$
  select ut.role from public.user_tenants ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
-- Los overrides de rol por módulo (lib/studio/rbac.ts), que lee fidelizacion_edicion_autorizada.
create table public.studio_role_module_overrides (
  tenant_id uuid not null references public.tenants(id), role text not null,
  module_id text not null, can_edit boolean, primary key (tenant_id, role, module_id)
);
create table public.shipments (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  shipment_service text, deleted_at timestamptz
);
create table public.clients (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  markbox text not null, name text, deleted_at timestamptz
);
create table public.fiscal_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade
);
create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  entity_type text not null, entity_id uuid not null, actor_type text not null,
  actor_id uuid, event_type text not null, payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint entity_audit_log_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade,
  constraint entity_audit_log_actor_type_check check (actor_type in ('user', 'operario', 'system'))
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

\ir ../migrations/0077_invoices.sql
\ir ../migrations/0078_contabilidad.sql
\ir ../migrations/0098_fidelizacion_referidos.sql
\ir ../migrations/0197_referral_auto_accredit.sql
\ir ../migrations/0237_referral_credit_apply.sql
\ir ../migrations/0238_referrals_accredited_at.sql
\ir ../migrations/0250_referral_settings.sql
\ir ../migrations/0407_invoices_write_rbac.sql
\ir ../migrations/0471_credito_referido_atomico.sql
\if :apply_fix
\ir ../migrations/0494_credito_referido_candado.sql
\endif

create function pg_temp.fixture_id(p_label text) returns uuid language sql immutable as $$
  select md5('0494-synthetic-' || p_label)::uuid
$$;

insert into auth.users (id)
select pg_temp.fixture_id(u) from unnest(array['admin-A', 'accounting-A', 'commercial-A', 'support-A', 'accounting-B']) u;
insert into public.tenants (id, slug, display_name) values
  (pg_temp.fixture_id('tenant-A'), 'tenant-a-0494', 'Tenant A 0494'),
  (pg_temp.fixture_id('tenant-B'), 'tenant-b-0494', 'Tenant B 0494');
insert into public.user_tenants (user_id, tenant_id, role)
select pg_temp.fixture_id(u), pg_temp.fixture_id(t), r from (values
  ('admin-A', 'tenant-A', 'admin'), ('accounting-A', 'tenant-A', 'accounting'),
  ('commercial-A', 'tenant-A', 'commercial'), ('support-A', 'tenant-A', 'support'),
  ('accounting-B', 'tenant-B', 'accounting')) v(u, t, r);
-- El referidor (c0) y seis clientes referidos.
insert into public.clients (id, tenant_id, markbox, name)
select pg_temp.fixture_id('c' || n), pg_temp.fixture_id('tenant-A'), 'DTD-940' || n, 'Cliente ' || n
from generate_series(0, 6) n;
-- La factura del referidor, donde se aplican los créditos.
insert into public.invoices (id, tenant_id, invoice_code, client_markbox, client_name, currency,
  base_amount, total_amount, paid_amount, status, issued_at)
values (pg_temp.fixture_id('inv-ref'), pg_temp.fixture_id('tenant-A'), 'F-REF', 'DTD-9400', 'Referidor',
  'USD', 1000, 1000, 0, 'emitida', date '2099-01-01');

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0494: %', p_label; end if;
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
-- 'código|mensaje|hint' de un intento que tiene que fallar ('ok' si no falló).
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
-- Lo mismo, como postgres: un UPDATE o DELETE directo que salta los GRANT pero no el guardián.
create function pg_temp.error_directo(p_sql text) returns text language plpgsql as $$
declare v_state text; v_message text; v_hint text;
begin
  execute p_sql;
  return 'ok';
exception when others then
  get stacked diagnostics v_state = returned_sqlstate, v_message = message_text, v_hint = pg_exception_hint;
  return v_state || '|' || v_message || '|' || coalesce(v_hint, '');
end;
$$;
create function pg_temp.ref(p_label text) returns public.referrals language plpgsql as $$
begin
  return (select r from public.referrals r where r.id = pg_temp.fixture_id(p_label));
end;
$$;
-- Un referido invitado del tenant A, por el camino de registerReferral (INSERT de la sesión).
create function pg_temp.invitar(p_label text, p_n integer) returns void language plpgsql as $$
begin
  perform pg_temp.as_actor('commercial-A', format(
    'insert into public.referrals (id, tenant_id, referral_code, referrer_client_id, referrer_markbox, referred_name, status, reward_usd) '
    || 'values (%L::uuid, %L::uuid, %L, %L::uuid, ''DTD-9400'', %L, ''invitado'', 0) returning to_jsonb(id)',
    pg_temp.fixture_id(p_label), pg_temp.fixture_id('tenant-A'), 'REF-2099-' || lpad(p_n::text, 4, '0'),
    pg_temp.fixture_id('c0'), 'Referido ' || p_n));
end;
$$;
-- Una venta del cliente referido (dispara la acreditación de 0250).
create function pg_temp.vender(p_label text, p_cliente integer, p_estado text default 'emitida') returns void
language plpgsql as $$
begin
  insert into public.invoices (id, tenant_id, invoice_code, client_markbox, client_name, currency,
    base_amount, total_amount, paid_amount, status, issued_at)
  values (pg_temp.fixture_id(p_label), pg_temp.fixture_id('tenant-A'), 'F-' || p_label, 'DTD-940' || p_cliente,
    'Cliente ' || p_cliente, 'USD', 500, 500, 0, p_estado::public.invoice_status, date '2099-01-01');
end;
$$;
create function pg_temp.avanzar(p_actor text, p_label text, p_estado text, p_markbox text default null) returns text
language plpgsql as $$
begin
  return pg_temp.error_of(p_actor, format('select public.avanzar_referido(%L::uuid, %L, %L)',
    pg_temp.fixture_id(p_label), p_estado, p_markbox));
end;
$$;

-- ── 0. La migración está (control rojo: sin 0494 falla acá) ──
select pg_temp.assert_true(to_regprocedure('public.avanzar_referido(uuid,text,text)') is not null,
  'existe public.avanzar_referido(uuid,text,text)');

-- ── 1. authenticated ya no escribe referrals por la API ──
select pg_temp.assert_true(not has_table_privilege('authenticated', 'public.referrals', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.referrals', 'DELETE')
  and has_table_privilege('authenticated', 'public.referrals', 'INSERT')
  and has_table_privilege('authenticated', 'public.referrals', 'SELECT'),
  'authenticated conserva SELECT e INSERT, sin UPDATE ni DELETE');
select pg_temp.invitar('r1', 1);
select pg_temp.assert_true(split_part(pg_temp.error_of('accounting-A', format(
  'update public.referrals set status = ''acreditado'', reward_usd = 80 where id = %L::uuid returning to_jsonb(id)',
  pg_temp.fixture_id('r1'))), '|', 1) = '42501', 'un UPDATE directo de la sesión se rechaza');
select pg_temp.assert_true(split_part(pg_temp.error_of('accounting-A', format(
  'delete from public.referrals where id = %L::uuid returning to_jsonb(id)', pg_temp.fixture_id('r1'))), '|', 1) = '42501',
  'un DELETE directo de la sesión se rechaza');
select pg_temp.assert_true(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'referrals' and roles = '{authenticated}') = 2
  and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'referrals' and policyname = 'referrals by tenant'),
  'la policy «for all» se reemplazó por una de SELECT y otra de INSERT');

-- ── 2. Aplicar y revertir: DEFINER, con el cuerpo de 0471 intacto ──
select pg_temp.assert_true((select bool_and(p.prosecdef) from pg_proc p
  where p.oid in ('public.apply_referral_credit(uuid,uuid)'::regprocedure, 'public.revert_referral_credits(uuid,uuid)'::regprocedure)),
  'aplicar y revertir pasan a SECURITY DEFINER');
select pg_temp.assert_true(
  (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = 'public.apply_referral_credit(uuid,uuid)'::regprocedure)
    = '8c32487e62bc23c16def30cc4e3c343b'
  and (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc where oid = 'public.revert_referral_credits(uuid,uuid)'::regprocedure)
    = '256c1331a53ab794af184f8bb90a1ca4',
  'el cuerpo de aplicar y revertir no cambia');

-- ── 3. Cómo nace un referido ──
select pg_temp.assert_true(pg_temp.error_of('commercial-A', format(
  'insert into public.referrals (tenant_id, referral_code, referrer_markbox, referred_name, status, reward_usd) '
  || 'values (%L::uuid, ''REF-2099-0901'', ''DTD-9400'', ''X'', ''acreditado'', 80) returning to_jsonb(id)',
  pg_temp.fixture_id('tenant-A'))) = '23514|Un referido nace invitado o registrado, no acreditado.|dtd-referidos',
  'un referido no nace acreditado');
select pg_temp.assert_true(pg_temp.error_of('commercial-A', format(
  'insert into public.referrals (tenant_id, referral_code, referrer_markbox, referred_name, status, reward_usd) '
  || 'values (%L::uuid, ''REF-2099-0902'', ''DTD-9400'', ''X'', ''invitado'', 80) returning to_jsonb(id)',
  pg_temp.fixture_id('tenant-A'))) = '23514|Un referido nace sin crédito, sin acreditación y sin aplicación.|dtd-referidos',
  'un referido no nace con monto');
select pg_temp.assert_true(pg_temp.error_of('admin-A', format(
  'insert into public.referrals (tenant_id, referral_code, referrer_markbox, referred_name, status, reward_usd) '
  || 'values (%L::uuid, ''REF-2099-0903'', ''DTD-9400'', ''X'', ''registrado'', 0) returning to_jsonb(id)',
  pg_temp.fixture_id('tenant-A')), 'service_role') = '23514|Un referido registrado tiene que tener su cliente.|dtd-referidos',
  'un referido no nace registrado sin su cliente, tampoco por service_role');
-- El camino del registro público (service_role): nace registrado con su cliente.
select pg_temp.assert_true(pg_temp.error_of('admin-A', format(
  'insert into public.referrals (id, tenant_id, referral_code, referrer_markbox, referred_name, referred_client_id, status, reward_usd) '
  || 'values (%L::uuid, %L::uuid, ''REF-2099-0005'', ''DTD-9400'', ''R5'', %L::uuid, ''registrado'', 0) returning to_jsonb(id)',
  pg_temp.fixture_id('r5'), pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('c5')), 'service_role') = 'ok',
  'el registro público crea un referido registrado con su cliente');

-- ── 4. Avanzar a mano ──
select pg_temp.assert_true(pg_temp.avanzar('support-A', 'r1', 'registrado', 'DTD-9401')
  = '42501|No tienes permiso para editar Fidelización.|dtd-referidos', 'support no edita Fidelización');
select pg_temp.assert_true(pg_temp.avanzar('commercial-A', 'r1', 'registrado')
  = '22023|Para marcarlo registrado, indica el markbox de un cliente activo.|dtd-referidos',
  'pasar a registrado pide el cliente');
select pg_temp.assert_true(pg_temp.avanzar('commercial-A', 'r1', 'registrado', 'dtd-9401') = 'ok',
  'commercial lo marca registrado con el markbox del cliente');
select pg_temp.assert_true((pg_temp.ref('r1')).status = 'registrado'
  and (pg_temp.ref('r1')).referred_client_id = pg_temp.fixture_id('c1'), 'queda registrado con su cliente');
select pg_temp.assert_true(pg_temp.avanzar('commercial-A', 'r1', 'acreditado')
  = '22023|Ese paso no se marca a mano.|dtd-referidos', 'acreditar no es un paso que se marque');
select pg_temp.invitar('r2', 2);
select pg_temp.avanzar('commercial-A', 'r2', 'registrado', 'DTD-9402');
select pg_temp.assert_true(pg_temp.avanzar('commercial-A', 'r2', 'primer-embarque') = 'ok'
  and (pg_temp.ref('r2')).status = 'primer-embarque', 'registrado pasa a primer embarque');
select pg_temp.assert_true(pg_temp.avanzar('commercial-A', 'r2', 'registrado')
  = '22023|Ese paso no se marca a mano.|dtd-referidos', 'no se retrocede a mano');

-- ── 5. La venta real acredita y guarda su factura ──
select pg_temp.vender('s1', 1);
select pg_temp.assert_true((pg_temp.ref('r1')).status = 'acreditado' and (pg_temp.ref('r1')).reward_usd = 80
  and (pg_temp.ref('r1')).accredited_invoice_id = pg_temp.fixture_id('s1') and (pg_temp.ref('r1')).accredited_at is not null,
  'la primera venta del referido acredita el crédito y guarda la factura');

-- ── 6. Acreditar a mano: solo el admin, con motivo ──
select pg_temp.assert_true(pg_temp.error_of('commercial-A', format(
  'select public.acreditar_referido_con_motivo(%L::uuid, %L)', pg_temp.fixture_id('r2'), 'Venta acordada fuera del sistema'))
  = '42501|Solo el admin acredita un referido sin venta.|dtd-referidos', 'commercial no acredita sin venta');
select pg_temp.assert_true(pg_temp.error_of('admin-A', format(
  'select public.acreditar_referido_con_motivo(%L::uuid, %L)', pg_temp.fixture_id('r2'), 'corto'))
  = '22023|El motivo debe tener entre 10 y 1000 caracteres.|dtd-referidos', 'el motivo tiene al menos 10 caracteres');
select pg_temp.assert_true(pg_temp.error_of('admin-A', format(
  'select public.acreditar_referido_con_motivo(%L::uuid, %L)', pg_temp.fixture_id('r2'), 'Venta acordada fuera del sistema')) = 'ok'
  and (pg_temp.ref('r2')).status = 'acreditado' and (pg_temp.ref('r2')).reward_usd = 80
  and (pg_temp.ref('r2')).accredited_reason = 'Venta acordada fuera del sistema'
  and (pg_temp.ref('r2')).accredited_by = pg_temp.fixture_id('admin-A') and (pg_temp.ref('r2')).accredited_invoice_id is null,
  'el admin acredita con motivo y queda quién');
select pg_temp.assert_true(pg_temp.error_of('admin-A', format(
  'select public.acreditar_referido_con_motivo(%L::uuid, %L)', pg_temp.fixture_id('r1'), 'Otra vez el mismo crédito'))
  = '22023|Solo se acredita un referido registrado o en su primer embarque.|dtd-referidos', 'un crédito no se acredita dos veces');

-- ── 7. El guardián, aunque se salten los GRANT ──
select pg_temp.invitar('r3', 3);
select pg_temp.avanzar('commercial-A', 'r3', 'registrado', 'DTD-9403');
select pg_temp.assert_true(pg_temp.error_directo(format(
  'update public.referrals set status = ''acreditado'', reward_usd = 80 where id = %L::uuid', pg_temp.fixture_id('r3')))
  = '23514|Un crédito de referido nace de una venta real del referido o de una acreditación con motivo.|dtd-referidos',
  'sin venta ni motivo no nace un crédito');
select pg_temp.vender('s0', 0);
select pg_temp.assert_true(pg_temp.error_directo(format(
  'update public.referrals set status = ''acreditado'', reward_usd = 80, accredited_invoice_id = %L::uuid where id = %L::uuid',
  pg_temp.fixture_id('s0'), pg_temp.fixture_id('r3')))
  = '23514|Un crédito de referido nace de una venta real del referido o de una acreditación con motivo.|dtd-referidos',
  'la venta de otro cliente no acredita');
select pg_temp.assert_true(pg_temp.error_directo(format(
  'update public.referrals set reward_usd = 999 where id = %L::uuid', pg_temp.fixture_id('r1')))
  = '23514|El crédito de un referido no cambia después de acreditarse.|dtd-referidos', 'el monto acreditado no cambia');
select pg_temp.assert_true(pg_temp.error_directo(format(
  'update public.referrals set status = ''invitado'' where id = %L::uuid', pg_temp.fixture_id('r1')))
  = '23514|Un referido no pasa de acreditado a invitado.|dtd-referidos', 'un acreditado no retrocede a invitado');
select pg_temp.assert_true(pg_temp.error_directo(format(
  'update public.referrals set applied_invoice_id = %L::uuid, applied_at = now() where id = %L::uuid',
  pg_temp.fixture_id('inv-ref'), pg_temp.fixture_id('r1')))
  = '23514|Un crédito que no está aplicado no tiene factura, fecha ni asiento de aplicación.|dtd-referidos',
  'un acreditado no lleva rastro de aplicación («renacido»)');
select pg_temp.assert_true(pg_temp.error_directo(format(
  'delete from public.referrals where id = %L::uuid', pg_temp.fixture_id('r1')))
  = '23514|Un referido acreditado no se borra.|dtd-referidos', 'un acreditado no se borra');
select pg_temp.assert_true(pg_temp.error_directo(format(
  'update public.referrals set deleted_at = now() where id = %L::uuid', pg_temp.fixture_id('r1')))
  = '23514|Un referido acreditado no se borra.|dtd-referidos', 'un acreditado no se borra a medias');
select pg_temp.assert_true(pg_temp.error_directo(format(
  'update public.referrals set referrer_markbox = ''DTD-9499'' where id = %L::uuid', pg_temp.fixture_id('r2'))) = 'ok',
  'lo que no es del crédito (el markbox del referidor) sí cambia, como en rename_client_markbox');

-- ── 8. Aplicar, enlazar el asiento y revertir: el camino del dinero ──
select pg_temp.assert_true(pg_temp.error_of('accounting-A', format(
  'select public.apply_referral_credit(%L::uuid, %L::uuid)', pg_temp.fixture_id('r1'), pg_temp.fixture_id('inv-ref'))) = 'ok'
  and (pg_temp.ref('r1')).status = 'aplicado', 'accounting aplica el crédito con la RPC');
select pg_temp.assert_true((select paid_amount from public.invoices where id = pg_temp.fixture_id('inv-ref')) = 80,
  'la factura del referidor recibe el abono');
-- El crédito aplicado dos veces: sacarlo de «aplicado» sin la reversión. Por la API ya no se puede.
select pg_temp.assert_true(split_part(pg_temp.error_of('accounting-A', format(
  'update public.referrals set status = ''acreditado'', applied_invoice_id = null, applied_at = null where id = %L::uuid returning to_jsonb(id)',
  pg_temp.fixture_id('r1'))), '|', 1) = '42501',
  'la «reversión falsa» por la API (sin bajar el pagado) se rechaza');
select pg_temp.assert_true(pg_temp.error_directo(format(
  'update public.referrals set applied_invoice_id = %L::uuid where id = %L::uuid', pg_temp.fixture_id('s0'), pg_temp.fixture_id('r1')))
  = '23514|La aplicación de un crédito no cambia: se revierte.|dtd-referidos', 'la factura de la aplicación no cambia');
insert into public.journal_entries (id, tenant_id, entry_code, entry_date, memo, status, source, referral_id, invoice_id)
values
  (pg_temp.fixture_id('e-r1'), pg_temp.fixture_id('tenant-A'), 'A-2099-0001', date '2099-01-01', 'Crédito', 'asentado',
   'referral_credit', pg_temp.fixture_id('r1'), pg_temp.fixture_id('inv-ref')),
  (pg_temp.fixture_id('e-otro'), pg_temp.fixture_id('tenant-A'), 'A-2099-0002', date '2099-01-01', 'Otro', 'asentado',
   'manual', null, null);
select pg_temp.assert_true(pg_temp.error_of('accounting-A', format(
  'select public.vincular_asiento_del_credito(%L::uuid, %L::uuid)', pg_temp.fixture_id('r1'), pg_temp.fixture_id('e-otro')))
  = '22023|Ese asiento no es el del crédito.|dtd-referidos', 'no se enlaza un asiento que no es del crédito');
select pg_temp.assert_true(pg_temp.error_of('commercial-A', format(
  'select public.vincular_asiento_del_credito(%L::uuid, %L::uuid)', pg_temp.fixture_id('r1'), pg_temp.fixture_id('e-r1')))
  = '42501|No tienes permiso para enlazar el asiento del crédito.|dtd-referidos', 'commercial no enlaza el asiento');
select pg_temp.assert_true(pg_temp.error_of('accounting-A', format(
  'select public.vincular_asiento_del_credito(%L::uuid, %L::uuid)', pg_temp.fixture_id('r1'), pg_temp.fixture_id('e-r1'))) = 'ok'
  and (pg_temp.ref('r1')).applied_entry_id = pg_temp.fixture_id('e-r1'), 'accounting enlaza el asiento del crédito');
select pg_temp.assert_true(pg_temp.error_directo(format(
  'update public.referrals set applied_entry_id = %L::uuid where id = %L::uuid', pg_temp.fixture_id('e-otro'), pg_temp.fixture_id('r1')))
  = '23514|El asiento de un crédito aplicado no cambia.|dtd-referidos', 'el asiento enlazado no cambia');

-- ── 9. La venta que acreditó se anula ──
-- Sin aplicar y sin otra venta: vuelve a registrado, con la acreditación limpia.
select pg_temp.vender('s3', 3);
select pg_temp.assert_true((pg_temp.ref('r3')).status = 'acreditado', 'r3 se acredita con su venta');
update public.invoices set status = 'anulada' where id = pg_temp.fixture_id('s3');
select pg_temp.assert_true((pg_temp.ref('r3')).status = 'registrado' and (pg_temp.ref('r3')).reward_usd = 0
  and (pg_temp.ref('r3')).accredited_at is null and (pg_temp.ref('r3')).accredited_invoice_id is null,
  'anulada la venta, el crédito sin aplicar vuelve a espera (registrado) y limpio');
select pg_temp.vender('s3b', 3);
select pg_temp.assert_true((pg_temp.ref('r3')).status = 'acreditado' and (pg_temp.ref('r3')).accredited_invoice_id = pg_temp.fixture_id('s3b'),
  'la próxima venta lo acredita de nuevo');
-- Sin aplicar y con otra venta viva: queda acreditado y apunta a la otra.
select pg_temp.invitar('r4', 4);
select pg_temp.avanzar('commercial-A', 'r4', 'registrado', 'DTD-9404');
select pg_temp.vender('s4a', 4);
select pg_temp.vender('s4b', 4);
update public.invoices set deleted_at = now() where id = pg_temp.fixture_id('s4a');
select pg_temp.assert_true((pg_temp.ref('r4')).status = 'acreditado' and (pg_temp.ref('r4')).accredited_invoice_id = pg_temp.fixture_id('s4b'),
  'borrada la venta, el crédito pasa a otra venta viva del referido');
-- Aplicado: no se revierte solo, queda marcado.
update public.invoices set status = 'anulada' where id = pg_temp.fixture_id('s1');
select pg_temp.assert_true((pg_temp.ref('r1')).status = 'aplicado' and (pg_temp.ref('r1')).sale_voided_at is not null,
  'un crédito aplicado cuya venta se anula no se revierte solo: queda marcado');
-- Y si después se revierte, ya no está aplicado: vale la regla de la venta anulada.
select pg_temp.assert_true(pg_temp.error_of('accounting-A', format(
  'select public.revert_referral_credits(%L::uuid, %L::uuid)', pg_temp.fixture_id('inv-ref'), pg_temp.fixture_id('r1'))) = 'ok',
  'accounting revierte el crédito');
select pg_temp.assert_true((pg_temp.ref('r1')).status = 'registrado' and (pg_temp.ref('r1')).reward_usd = 0
  and (pg_temp.ref('r1')).applied_invoice_id is null and (pg_temp.ref('r1')).sale_voided_at is null,
  'revertido, el crédito con la venta anulada vuelve a espera y no queda acreditado en el aire');
select pg_temp.assert_true((select paid_amount from public.invoices where id = pg_temp.fixture_id('inv-ref')) = 0,
  'la reversión bajó el abono de la factura del referidor');
select pg_temp.assert_true(pg_temp.error_directo(format(
  'update public.referrals set sale_voided_at = now() where id = %L::uuid', pg_temp.fixture_id('r4')))
  = '23514|La marca de venta anulada solo se pone en un crédito aplicado.|dtd-referidos',
  'la marca de venta anulada no se pone a mano en un acreditado');

-- ── 10. Lo que el guardián no traba ──
-- Borrar el cliente de un registrado pone la FK en null: el guardián no lo traba.
delete from public.clients where id = pg_temp.fixture_id('c5');
select pg_temp.assert_true((pg_temp.ref('r5')).referred_client_id is null and (pg_temp.ref('r5')).status = 'registrado',
  'borrar el cliente de un registrado no se traba');
-- El portal (service_role) pasa un invitado a registrado con su cliente.
select pg_temp.invitar('r6', 6);
select pg_temp.assert_true(pg_temp.error_of('admin-A', format(
  'update public.referrals set status = ''registrado'', referred_client_id = %L::uuid where id = %L::uuid returning to_jsonb(id)',
  pg_temp.fixture_id('c6'), pg_temp.fixture_id('r6')), 'service_role') = 'ok',
  'el registro público (service_role) pasa un invitado a registrado');

-- ── 11. El catálogo: lo interno no se llama desde la API ──
select pg_temp.assert_true(not exists (
  select 1 from pg_proc p where p.oid in (
    'public.referrals_candado()'::regprocedure, 'public.referrals_venta_anulada()'::regprocedure,
    'public.referido_venta_real(uuid,uuid,uuid)'::regprocedure, 'public.referido_otra_venta(uuid,uuid,uuid)'::regprocedure,
    'public.fidelizacion_edicion_autorizada(uuid)'::regprocedure)
  and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('service_role', p.oid, 'execute'))),
  'las funciones internas no tienen EXECUTE para la API');
select pg_temp.assert_true(not exists (
  select 1 from pg_proc p where p.oid in (
    'public.acreditar_referido_con_motivo(uuid,text)'::regprocedure, 'public.avanzar_referido(uuid,text,text)'::regprocedure,
    'public.vincular_asiento_del_credito(uuid,uuid)'::regprocedure)
  and (not has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('service_role', p.oid, 'execute'))),
  'las tres RPC son solo para authenticated');
select pg_temp.assert_true(pg_temp.error_of('accounting-B', format(
  'select public.avanzar_referido(%L::uuid, ''primer-embarque'', null)', pg_temp.fixture_id('r6')))
  = '42501|No tienes permiso para editar Fidelización.|dtd-referidos'
  and pg_temp.error_of('accounting-B', format(
  'select public.vincular_asiento_del_credito(%L::uuid, %L::uuid)', pg_temp.fixture_id('r1'), pg_temp.fixture_id('e-r1')))
  = '22023|El crédito no está aplicado.|dtd-referidos',
  'otro tenant no ve los referidos del tenant A');

select 'TEST 0494 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
