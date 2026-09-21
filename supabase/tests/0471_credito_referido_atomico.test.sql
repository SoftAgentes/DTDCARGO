\set ON_ERROR_STOP on
-- SDD-0496 · Contrato de 0471: aplicar y revertir el crédito de referido en una
-- transacción. Fixture sintético aislado; no ejecutar sobre una DB real. Aplica
-- con \ir las migraciones REALES de facturas (0077), contabilidad (0078),
-- referidos (0098, 0197, 0237, 0238) y RLS de facturas (0407), y termina en
-- ROLLBACK.
-- RED: psql -v apply_fix=false -f /sb/tests/0471_credito_referido_atomico.test.sql
--
-- Una sola sesión: acá se prueban reglas, efectos, ACL y que 0471 no toca nada
-- existente. La concurrencia (el FOR UPDATE) —y las dos ventanas del riesgo
-- residual de la SDD-0490— las prueban tres sesiones reales en
-- supabase/tests/0467_reversion_credito_carrera.test.sql, escenarios 5 y 6.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
do $fixture_guard$
begin
  if to_regclass('public.invoices') is not null or to_regclass('public.tenants') is not null
     or to_regclass('public.referrals') is not null then
    raise exception 'TEST 0471: fixture rechazada, la base ya contiene objetos de aplicación';
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
-- Columnas de 0001/0019/0200; slug lo usan los seeds de 0078.
create table public.tenants (id uuid primary key, slug text unique not null, display_name text not null);
create table public.user_tenants (
  user_id uuid not null references auth.users(id), tenant_id uuid not null references public.tenants(id),
  role text not null, disabled_at timestamptz, primary key (user_id, tenant_id)
);
alter table public.user_tenants enable row level security;
grant select on public.user_tenants to authenticated;
create policy "users see their own user_tenants" on public.user_tenants
  for select to authenticated using (user_id = (select auth.uid()) and disabled_at is null);
-- La semántica de 0453 (la ÚNICA membresía activa) y de 0200. El cuerpo de
-- get_user_tenant_id es el que el preflight de 0471 exige por md5.
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
-- 0077 apunta a shipments.
create table public.shipments (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  shipment_service text, deleted_at timestamptz
);
-- 0098 valida el referidor/referido contra clients; 0197 resuelve el markbox ahí.
create table public.clients (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  markbox text not null, name text, deleted_at timestamptz
);
-- 0237 le agrega referral_credit_mode: cascarón con las columnas que toca.
create table public.fiscal_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade
);
-- Plataforma legacy mínima de 0077/0078, igual que el contrato 0467.
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
\ir ../migrations/0407_invoices_write_rbac.sql

create function pg_temp.fixture_id(p_label text) returns uuid language sql immutable as $$
  select md5('0471-synthetic-' || p_label)::uuid
$$;

insert into auth.users (id)
select pg_temp.fixture_id(u) from unnest(array['accounting-A', 'admin-A', 'commercial-A',
  'accounting-B', 'unlinked']) u;
insert into public.tenants (id, slug, display_name) values
  (pg_temp.fixture_id('tenant-A'), 'tenant-a-0471', 'Tenant A 0471'),
  (pg_temp.fixture_id('tenant-B'), 'tenant-b-0471', 'Tenant B 0471');
insert into public.user_tenants (user_id, tenant_id, role)
select pg_temp.fixture_id(u), pg_temp.fixture_id(t), r from (values
  ('accounting-A', 'tenant-A', 'accounting'), ('admin-A', 'tenant-A', 'admin'),
  ('commercial-A', 'tenant-A', 'commercial'), ('accounting-B', 'tenant-B', 'accounting')) v(u, t, r);

-- Las facturas. `issued_at` importa: la regla de compra nueva compara su día
-- contra el día UTC de accredited_at, que en la semilla es 2026-06-01.
insert into public.invoices (id, tenant_id, invoice_code, client_markbox, client_name, currency,
  fx_rate, base_amount, total_amount, paid_amount, status, issued_at, deleted_at)
select pg_temp.fixture_id(v.label), pg_temp.fixture_id(v.tenant), v.code, v.markbox, 'Cliente 0471',
  v.currency::public.invoice_currency, v.fx, v.total, v.total, v.paid, v.status::public.invoice_status,
  v.issued::date, case when v.archived then now() end
from (values
  ('inv-open',     'tenant-A', 'F-OPEN',     'DTD-0471', 'USD',  null::numeric, 1000,   0, 'emitida',  '2026-06-10', false),
  ('inv-usdt',     'tenant-A', 'F-USDT',     'DTD-0471', 'USDT', null,          1000,   0, 'emitida',  '2026-06-10', false),
  ('inv-full',     'tenant-A', 'F-FULL',     'DTD-0471', 'USD',  null,          1000, 920, 'parcial',  '2026-06-10', false),
  ('inv-tight',    'tenant-A', 'F-TIGHT',    'DTD-0471', 'USD',  null,          1000, 950, 'parcial',  '2026-06-10', false),
  ('inv-exact',    'tenant-A', 'F-EXACT',    'DTD-0471', 'USD',  null,          1000, 920, 'parcial',  '2026-06-10', false),
  ('inv-old',      'tenant-A', 'F-OLD',      'DTD-0471', 'USD',  null,          1000,   0, 'emitida',  '2026-05-31', false),
  ('inv-sameday',  'tenant-A', 'F-SAMEDAY',  'DTD-0471', 'USD',  null,          1000,   0, 'emitida',  '2026-06-01', false),
  ('inv-nodate',   'tenant-A', 'F-NODATE',   'DTD-0471', 'USD',  null,          1000,   0, 'emitida',  null,         false),
  ('inv-overdue',  'tenant-A', 'F-OVERDUE',  'DTD-0471', 'USD',  null,          1000,   0, 'vencida',  '2026-06-10', false),
  ('inv-paid',     'tenant-A', 'F-PAID',     'DTD-0471', 'USD',  null,           500, 500, 'pagada',   '2026-06-10', false),
  ('inv-draft',    'tenant-A', 'F-DRAFT',    'DTD-0471', 'USD',  null,           700,   0, 'borrador', '2026-06-10', false),
  ('inv-archived', 'tenant-A', 'F-ARCHIVED', 'DTD-0471', 'USD',  null,           700,   0, 'emitida',  '2026-06-10', true),
  ('inv-ves',      'tenant-A', 'F-VES',      'DTD-0471', 'VES',  36.5,          5000,   0, 'emitida',  '2026-06-10', false),
  ('inv-other',    'tenant-A', 'F-OTHER',    'DTD-OTRO', 'USD',  null,          1000,   0, 'emitida',  '2026-06-10', false),
  ('inv-void',     'tenant-A', 'F-VOID',     'DTD-0471', 'USD',  null,           800, 380, 'anulada',  '2026-06-10', false),
  ('inv-two',      'tenant-A', 'F-TWO',      'DTD-0471', 'USD',  null,          1000, 160, 'parcial',  '2026-06-10', false),
  ('inv-payback',  'tenant-A', 'F-PAYBACK',  'DTD-0471', 'USD',  null,          1000,  80, 'parcial',  '2026-06-10', false),
  ('inv-repaid',   'tenant-A', 'F-REPAID',   'DTD-0471', 'USD',  null,          1000,1000, 'pagada',   '2026-06-10', false),
  ('inv-B',        'tenant-B', 'F-B',        'DTD-0471', 'USD',  null,          1000,   0, 'emitida',  '2026-06-10', false)
) v(label, tenant, code, markbox, currency, fx, total, paid, status, issued, archived);

-- Los créditos. accredited_at explícito: el trigger de 0238 sólo sella cuando
-- llega null, así que la semilla manda.
insert into public.referrals (id, tenant_id, referral_code, referrer_markbox, referred_name,
  status, reward_usd, accredited_at, applied_invoice_id, applied_at)
select pg_temp.fixture_id(v.label), pg_temp.fixture_id(v.tenant), v.code, v.markbox, 'Referido 0471',
  v.status::public.referral_status, v.reward, v.accredited::timestamptz,
  case when v.invoice is null then null else pg_temp.fixture_id(v.invoice) end,
  case when v.invoice is null then null else timestamptz '2026-06-11 12:00:00+00' end
from (values
  ('ref-ok',       'tenant-A', 'REF-2026-0001', 'DTD-0471', 'acreditado', 80, '2026-06-01', null, null),
  ('ref-usdt',     'tenant-A', 'REF-2026-0002', 'DTD-0471', 'acreditado', 80, '2026-06-01', null, null),
  ('ref-full',     'tenant-A', 'REF-2026-0003', 'DTD-0471', 'acreditado', 80, '2026-06-01', null, null),
  ('ref-tight',    'tenant-A', 'REF-2026-0004', 'DTD-0471', 'acreditado', 80, '2026-06-01', null, null),
  ('ref-exact',    'tenant-A', 'REF-2026-0005', 'DTD-0471', 'acreditado', 80, '2026-06-01', null, null),
  ('ref-old',      'tenant-A', 'REF-2026-0006', 'DTD-0471', 'acreditado', 80, '2026-06-01', null, null),
  ('ref-sameday',  'tenant-A', 'REF-2026-0007', 'DTD-0471', 'acreditado', 80, '2026-06-01', null, null),
  ('ref-nodate',   'tenant-A', 'REF-2026-0008', 'DTD-0471', 'acreditado', 80, '2026-06-01', null, null),
  ('ref-overdue',  'tenant-A', 'REF-2026-0009', 'DTD-0471', 'acreditado', 80, '2026-06-01', null, null),
  ('ref-paid',     'tenant-A', 'REF-2026-0010', 'DTD-0471', 'acreditado', 80, '2026-06-01', null, null),
  ('ref-draft',    'tenant-A', 'REF-2026-0011', 'DTD-0471', 'acreditado', 80, '2026-06-01', null, null),
  ('ref-archived', 'tenant-A', 'REF-2026-0012', 'DTD-0471', 'acreditado', 80, '2026-06-01', null, null),
  ('ref-ves',      'tenant-A', 'REF-2026-0013', 'DTD-0471', 'acreditado', 80, '2026-06-01', null, null),
  ('ref-other',    'tenant-A', 'REF-2026-0014', 'DTD-0471', 'acreditado', 80, '2026-06-01', null, null),
  ('ref-zero',     'tenant-A', 'REF-2026-0015', 'DTD-0471', 'acreditado',  0, '2026-06-01', null, null),
  ('ref-invitado', 'tenant-A', 'REF-2026-0016', 'DTD-0471', 'invitado',   80, null,         null, null),
  ('ref-nocred',   'tenant-A', 'REF-2026-0017', 'DTD-0471', 'acreditado', 80, null,         null, null),
  ('ref-crossinv', 'tenant-A', 'REF-2026-0018', 'DTD-0471', 'acreditado', 80, '2026-06-01', null, null),
  ('ref-void',     'tenant-A', 'REF-2026-0019', 'DTD-0471', 'aplicado',   80, '2026-06-01', 'inv-void', 'entry-void'),
  ('ref-two-a',    'tenant-A', 'REF-2026-0020', 'DTD-0471', 'aplicado',   80, '2026-06-01', 'inv-two', null),
  ('ref-two-b',    'tenant-A', 'REF-2026-0021', 'DTD-0471', 'aplicado',   80, '2026-06-01', 'inv-two', null),
  ('ref-payback',  'tenant-A', 'REF-2026-0022', 'DTD-0471', 'aplicado',   80, '2026-06-01', 'inv-payback', null),
  ('ref-repaid',   'tenant-A', 'REF-2026-0023', 'DTD-0471', 'aplicado',   80, '2026-06-01', 'inv-repaid', null),
  ('ref-B',        'tenant-B', 'REF-2026-0024', 'DTD-0471', 'acreditado', 80, '2026-06-01', null, null)
) v(label, tenant, code, markbox, status, reward, accredited, invoice, entry);

-- Un asiento vivo para el crédito ya aplicado de inv-void: la reversión lo
-- devuelve en el jsonb para que la app lo anule, y limpia el link. Va después
-- de la semilla de créditos porque los dos se referencian: journal_entries.referral_id
-- (0237) y referrals.applied_entry_id (0237) cierran el círculo.
insert into public.journal_entries (id, tenant_id, entry_code, entry_date, memo, status, source, referral_id)
values (pg_temp.fixture_id('entry-void'), pg_temp.fixture_id('tenant-A'), 'A-2026-0471',
  date '2026-06-10', 'Crédito de referido', 'asentado', 'referral_credit', pg_temp.fixture_id('ref-void'));
update public.referrals set applied_entry_id = pg_temp.fixture_id('entry-void')
where id = pg_temp.fixture_id('ref-void');

create temporary table baseline_policies as select to_jsonb(p) as definition from pg_catalog.pg_policies p;
create temporary table baseline_acl as select c.oid, c.relacl from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v');
create temporary table baseline_triggers as select t.oid, to_jsonb(t) as definition
from pg_trigger t where not t.tgisinternal;
create temporary table baseline_functions as
select p.oid, to_jsonb(p) as definition from pg_catalog.pg_proc p
join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'auth');
create temporary table baseline_rows as
select 'invoice' as kind, to_jsonb(i) as row_data from public.invoices i
union all select 'referral', to_jsonb(r) from public.referrals r;
create temporary view current_rows as
select 'invoice' as kind, to_jsonb(i) as row_data from public.invoices i
union all select 'referral', to_jsonb(r) from public.referrals r;

\if :apply_fix
\ir ../migrations/0471_credito_referido_atomico.sql
\endif

-- Helpers de observación: las RPC reales bajo el rol API y el auth.uid de la
-- fixture. No reemplazan autorización ni writer.
create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0471: %', p_label; end if;
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
create function pg_temp.state() returns jsonb language sql as $$
  select jsonb_build_object(
    'invoices', (select jsonb_agg(to_jsonb(i) order by id) from public.invoices i),
    'referrals', (select jsonb_agg(to_jsonb(r) order by id) from public.referrals r),
    'entries', (select jsonb_agg(to_jsonb(e) order by id) from public.journal_entries e))
$$;
-- Un rechazo esperado: mensaje y SQLSTATE exactos, y ninguna mutación parcial.
create function pg_temp.expect_rejected(p_label text, p_actor text, p_sql text,
  p_message text, p_state text, p_role text default 'authenticated') returns void language plpgsql as $$
declare v_before jsonb := pg_temp.state(); v_message text; v_state text;
begin
  begin
    perform pg_temp.as_actor(p_actor, p_sql, p_role);
  exception when others then
    get stacked diagnostics v_message = message_text, v_state = returned_sqlstate;
  end;
  perform pg_temp.assert_true(v_message is not null, p_label || ': se esperaba rechazo ' || p_message);
  perform pg_temp.assert_true(v_message = p_message and v_state = p_state,
    format('%s: se esperaba %s (%s), llegó %s (%s)', p_label, p_message, p_state, v_message, v_state));
  perform pg_temp.assert_true(pg_temp.state() = v_before, p_label || ': hubo mutación parcial');
end;
$$;
create function pg_temp.apply_sql(p_referral text, p_invoice text) returns text language sql as $$
  select format('select public.apply_referral_credit(%L::uuid, %L::uuid)',
    pg_temp.fixture_id(p_referral), pg_temp.fixture_id(p_invoice))
$$;
create function pg_temp.revert_sql(p_invoice text, p_referral text default null) returns text
language sql as $$
  select format('select public.revert_referral_credits(%L::uuid, %s)',
    pg_temp.fixture_id(p_invoice),
    case when p_referral is null then 'null::uuid'
         else quote_literal(pg_temp.fixture_id(p_referral)) || '::uuid' end)
$$;
create function pg_temp.invoice(p_label text) returns public.invoices language sql as $$
  select * from public.invoices where id = pg_temp.fixture_id(p_label)
$$;
create function pg_temp.referral(p_label text) returns public.referrals language sql as $$
  select * from public.referrals where id = pg_temp.fixture_id(p_label)
$$;

-- 1. Catálogo: dos funciones INVOKER, search_path vacío, owner postgres y
--    EXECUTE sólo para authenticated (el patrón D2 de 0294 y 0467).
do $catalog$
declare v_fn text;
begin
  foreach v_fn in array array[
    'public.apply_referral_credit(uuid,uuid)', 'public.revert_referral_credits(uuid,uuid)'] loop
    perform pg_temp.assert_true(to_regprocedure(v_fn) is not null, 'existe ' || v_fn);
    perform pg_temp.assert_true(exists(select 1 from pg_proc p where p.oid = to_regprocedure(v_fn)
      and not p.prosecdef and p.provolatile = 'v' and p.proowner = 'postgres'::regrole
      and p.prorettype = 'jsonb'::regtype and p.proconfig = array['search_path=""']), 'forma de ' || v_fn);
    perform pg_temp.assert_true(has_function_privilege('authenticated', to_regprocedure(v_fn), 'EXECUTE')
      and not has_function_privilege('anon', to_regprocedure(v_fn), 'EXECUTE')
      and not has_function_privilege('service_role', to_regprocedure(v_fn), 'EXECUTE'),
      'EXECUTE de ' || v_fn || ' sólo para authenticated');
  end loop;
end;
$catalog$;

-- 2. 0471 no toca nada existente: ni policies, ni ACL de tablas, ni triggers, ni
--    las funciones que ya estaban, ni una sola fila.
do $unchanged$
begin
  perform pg_temp.assert_true(not exists (
    (select definition from baseline_policies except select to_jsonb(p) from pg_catalog.pg_policies p)
    union all
    (select to_jsonb(p) from pg_catalog.pg_policies p except select definition from baseline_policies)),
    '0471 no cambia ninguna policy');
  perform pg_temp.assert_true(not exists (
    select 1 from baseline_acl b join pg_class c on c.oid = b.oid
    where c.relacl is distinct from b.relacl), '0471 no cambia la ACL de ninguna tabla');
  perform pg_temp.assert_true(
    (select count(*) from pg_trigger t where not t.tgisinternal) = (select count(*) from baseline_triggers)
    and not exists (
      select 1 from baseline_triggers b join pg_trigger t on t.oid = b.oid
      where to_jsonb(t) is distinct from b.definition), '0471 no toca ningún trigger');
  perform pg_temp.assert_true(not exists (
    select 1 from baseline_functions b join pg_catalog.pg_proc p on p.oid = b.oid
    where to_jsonb(p) is distinct from b.definition), '0471 no redefine ninguna función previa');
  perform pg_temp.assert_true(not exists (
    (select * from baseline_rows except select * from current_rows)
    union all
    (select * from current_rows except select * from baseline_rows)),
    '0471 no toca ninguna fila al aplicarse');
end;
$unchanged$;

-- 3. Centinela para CI (una sola conexión): la factura se lee con FOR UPDATE en
--    las dos funciones, y la reversión toma además los créditos. La prueba de
--    que alcanza es la carrera de tres sesiones (0467_reversion_credito_carrera).
do $sentinel$
begin
  perform pg_temp.assert_true((select count(*) from regexp_matches(prosrc, '\n\s*for update;', 'g')) = 2,
    'apply_referral_credit toma la factura y el crédito FOR UPDATE')
  from pg_proc where oid = 'public.apply_referral_credit(uuid,uuid)'::regprocedure;
  perform pg_temp.assert_true((select count(*) from regexp_matches(prosrc, '\n\s*for update;', 'g')) = 1
    and (select count(*) from regexp_matches(prosrc, '\n\s*for update\n\s*loop', 'g')) = 1,
    'revert_referral_credits toma la factura y después los créditos FOR UPDATE')
  from pg_proc where oid = 'public.revert_referral_credits(uuid,uuid)'::regprocedure;
end;
$sentinel$;

-- 4. Gate de rol: sólo accounting y admin. El de dinero de MONEY_MODULES.
do $rol$
begin
  perform pg_temp.expect_rejected('aplicar sin rol de dinero', 'commercial-A',
    pg_temp.apply_sql('ref-ok', 'inv-open'), 'REFERRAL_CREDIT_FORBIDDEN', '42501');
  perform pg_temp.expect_rejected('revertir sin rol de dinero', 'commercial-A',
    pg_temp.revert_sql('inv-void'), 'REFERRAL_CREDIT_FORBIDDEN', '42501');
  perform pg_temp.expect_rejected('aplicar sin tenant', 'unlinked',
    pg_temp.apply_sql('ref-ok', 'inv-open'), 'REFERRAL_CREDIT_FORBIDDEN', '42501');
end;
$rol$;

-- 5. Aplicación: el claim del crédito y el abono a la factura, juntos. Es lo que
--    cierra la ventana: no existe el estado «crédito aplicado, factura sin abono».
do $aplicar$
declare v_result jsonb; v_ref public.referrals; v_inv public.invoices; v_error text;
begin
  v_result := pg_temp.as_actor('accounting-A', pg_temp.apply_sql('ref-ok', 'inv-open'));
  v_ref := pg_temp.referral('ref-ok');
  v_inv := pg_temp.invoice('inv-open');
  perform pg_temp.assert_true(v_ref.status = 'aplicado' and v_ref.applied_invoice_id = v_inv.id
    and v_ref.applied_at is not null and v_ref.applied_entry_id is null,
    'el crédito queda aplicado con su rastro y sin asiento linkeado todavía');
  perform pg_temp.assert_true(v_inv.paid_amount = 80 and v_inv.status = 'parcial'
    and v_inv.last_payment_at is not null,
    'la factura recibe el abono no monetario y queda parcial');
  perform pg_temp.assert_true(v_result->>'amount' = '80.00' and v_result->>'invoice_code' = 'F-OPEN'
    and v_result->>'referral_code' = 'REF-2026-0001' and (v_result->>'paid_amount')::numeric = 80
    and v_result->>'status' = 'parcial' and (v_result->>'fully_paid')::boolean is false,
    'el jsonb trae lo que la app necesita para el asiento');

  -- Un abono que completa el total deja la factura pagada, como el cobro de 0467.
  v_result := pg_temp.as_actor('accounting-A', pg_temp.apply_sql('ref-full', 'inv-full'));
  v_inv := pg_temp.invoice('inv-full');
  perform pg_temp.assert_true(v_inv.paid_amount = 1000 and v_inv.status = 'pagada'
    and (v_result->>'fully_paid')::boolean is true, 'el abono que completa el total deja pagada');

  -- USDT y vencida también admiten crédito (CREDIT_APPLICABLE_INVOICE_STATUSES).
  perform pg_temp.as_actor('accounting-A', pg_temp.apply_sql('ref-usdt', 'inv-usdt'));
  perform pg_temp.assert_true((pg_temp.invoice('inv-usdt')).paid_amount = 80, 'USDT admite crédito');
  perform pg_temp.as_actor('accounting-A', pg_temp.apply_sql('ref-overdue', 'inv-overdue'));
  perform pg_temp.assert_true((pg_temp.invoice('inv-overdue')).paid_amount = 80, 'vencida admite crédito');

  -- El día del crédito ya cuenta: la regla es «no anterior», no «posterior».
  -- El rechazo se captura para que la aserción lo nombre en vez de propagarse:
  -- así un mutante de la comparación cae acá y no en un error suelto.
  begin
    perform pg_temp.as_actor('admin-A', pg_temp.apply_sql('ref-sameday', 'inv-sameday'));
  exception when others then get stacked diagnostics v_error = message_text;
  end;
  perform pg_temp.assert_true((pg_temp.invoice('inv-sameday')).paid_amount = 80,
    'una factura del mismo día del crédito lo admite, y admin también aplica'
    || coalesce(' (rechazada con ' || v_error || ')', ''));

  -- Saldo exacto: 1000 − 920 = 80. No sobra ni un centavo y se acepta.
  perform pg_temp.as_actor('accounting-A', pg_temp.apply_sql('ref-exact', 'inv-exact'));
  perform pg_temp.assert_true((pg_temp.invoice('inv-exact')).status = 'pagada',
    'el crédito igual al saldo se acepta y deja pagada');
end;
$aplicar$;

-- 6. Los rechazos de la aplicación, cada uno con su código. Ninguno deja
--    mutación parcial: expect_rejected compara el estado completo.
do $rechazos$
begin
  perform pg_temp.expect_rejected('crédito ya aplicado', 'accounting-A',
    pg_temp.apply_sql('ref-ok', 'inv-usdt'), 'REFERRAL_CREDIT_STATE', '23514');
  perform pg_temp.expect_rejected('crédito no acreditado', 'accounting-A',
    pg_temp.apply_sql('ref-invitado', 'inv-open'), 'REFERRAL_CREDIT_STATE', '23514');
  perform pg_temp.expect_rejected('crédito sin monto', 'accounting-A',
    pg_temp.apply_sql('ref-zero', 'inv-open'), 'REFERRAL_CREDIT_AMOUNT', '23514');
  perform pg_temp.expect_rejected('factura de otro cliente', 'accounting-A',
    pg_temp.apply_sql('ref-other', 'inv-other'), 'REFERRAL_CREDIT_OTHER_CLIENT', '23514');
  perform pg_temp.expect_rejected('factura pagada', 'accounting-A',
    pg_temp.apply_sql('ref-paid', 'inv-paid'), 'REFERRAL_CREDIT_INVOICE_STATE', '23514');
  perform pg_temp.expect_rejected('factura en borrador', 'accounting-A',
    pg_temp.apply_sql('ref-draft', 'inv-draft'), 'REFERRAL_CREDIT_INVOICE_STATE', '23514');
  perform pg_temp.expect_rejected('factura anulada', 'accounting-A',
    pg_temp.apply_sql('ref-tight', 'inv-void'), 'REFERRAL_CREDIT_INVOICE_STATE', '23514');
  perform pg_temp.expect_rejected('factura en VES', 'accounting-A',
    pg_temp.apply_sql('ref-ves', 'inv-ves'), 'REFERRAL_CREDIT_CURRENCY', '23514');
  perform pg_temp.expect_rejected('factura anterior al crédito', 'accounting-A',
    pg_temp.apply_sql('ref-old', 'inv-old'), 'REFERRAL_CREDIT_OLD_INVOICE', '23514');
  perform pg_temp.expect_rejected('factura sin fecha de emisión', 'accounting-A',
    pg_temp.apply_sql('ref-nodate', 'inv-nodate'), 'REFERRAL_CREDIT_OLD_INVOICE', '23514');
  perform pg_temp.expect_rejected('crédito sin accredited_at', 'accounting-A',
    pg_temp.apply_sql('ref-nocred', 'inv-open'), 'REFERRAL_CREDIT_OLD_INVOICE', '23514');
  perform pg_temp.expect_rejected('saldo menor que el crédito', 'accounting-A',
    pg_temp.apply_sql('ref-tight', 'inv-tight'), 'REFERRAL_CREDIT_EXCEEDS_BALANCE', '23514');
  perform pg_temp.expect_rejected('factura archivada', 'accounting-A',
    pg_temp.apply_sql('ref-archived', 'inv-archived'), 'REFERRAL_CREDIT_INVOICE_NOT_FOUND', 'P0002');
  perform pg_temp.expect_rejected('factura de otro tenant', 'accounting-A',
    pg_temp.apply_sql('ref-crossinv', 'inv-B'), 'REFERRAL_CREDIT_INVOICE_NOT_FOUND', 'P0002');
  perform pg_temp.expect_rejected('crédito de otro tenant', 'accounting-A',
    pg_temp.apply_sql('ref-B', 'inv-open'), 'REFERRAL_CREDIT_NOT_FOUND', 'P0002');
  perform pg_temp.expect_rejected('sin crédito', 'accounting-A',
    'select public.apply_referral_credit(null::uuid, null::uuid)', 'REFERRAL_CREDIT_INPUT', '22023');
end;
$rechazos$;

-- 7. Reversión: devuelve el crédito y baja el abono, con la regla de estado de
--    void_collection_receipt (0467). Es lo que evita la factura «pagada» con saldo.
do $revertir$
declare v_result jsonb; v_ref public.referrals; v_inv public.invoices;
begin
  -- La factura anulada conserva su estado: sólo baja el pagado. 380 = recibo de
  -- 300 + crédito de 80 → queda 300, no 0 y tampoco 220.
  v_result := pg_temp.as_actor('accounting-A', pg_temp.revert_sql('inv-void'));
  v_ref := pg_temp.referral('ref-void');
  v_inv := pg_temp.invoice('inv-void');
  perform pg_temp.assert_true(v_ref.status = 'acreditado' and v_ref.applied_invoice_id is null
    and v_ref.applied_entry_id is null and v_ref.applied_at is null,
    'el crédito revertido vuelve a acreditado con el rastro limpio');
  perform pg_temp.assert_true(v_inv.paid_amount = 300 and v_inv.status = 'anulada',
    'la factura anulada conserva su estado y sólo baja el crédito');
  perform pg_temp.assert_true((v_result->>'count')::int = 1
    and (v_result->'reverted'->0->>'applied_entry_id') = pg_temp.fixture_id('entry-void')::text
    and (v_result->'reverted'->0->>'amount')::numeric = 80,
    'el jsonb nombra el asiento a anular, que la app barre por referral_id');
  perform pg_temp.assert_true((select status from public.journal_entries
    where id = pg_temp.fixture_id('entry-void')) = 'asentado',
    'la reversión no toca el asiento: eso queda en la app, best-effort');

  -- Idempotente: revertir dos veces no baja dos veces.
  v_result := pg_temp.as_actor('accounting-A', pg_temp.revert_sql('inv-void'));
  perform pg_temp.assert_true((v_result->>'count')::int = 0
    and (pg_temp.invoice('inv-void')).paid_amount = 300, 'revertir dos veces no baja dos veces');

  -- Sin pagos queda emitida, no «parcial con 0».
  perform pg_temp.as_actor('accounting-A', pg_temp.revert_sql('inv-payback'));
  v_inv := pg_temp.invoice('inv-payback');
  perform pg_temp.assert_true(v_inv.paid_amount = 0 and v_inv.status = 'emitida',
    'una factura que se queda sin pagos vuelve a emitida');

  -- Una pagada a la que se le baja el pagado NO queda pagada con saldo.
  perform pg_temp.as_actor('accounting-A', pg_temp.revert_sql('inv-repaid'));
  v_inv := pg_temp.invoice('inv-repaid');
  perform pg_temp.assert_true(v_inv.paid_amount = 920 and v_inv.status = 'parcial',
    'una pagada a la que se le baja el crédito queda parcial, nunca pagada con saldo');

  -- p_referral_id acota: es la compensación de la app cuando el asiento falla.
  v_result := pg_temp.as_actor('accounting-A', pg_temp.revert_sql('inv-two', 'ref-two-a'));
  v_inv := pg_temp.invoice('inv-two');
  perform pg_temp.assert_true((v_result->>'count')::int = 1 and v_inv.paid_amount = 80
    and (pg_temp.referral('ref-two-a')).status = 'acreditado'
    and (pg_temp.referral('ref-two-b')).status = 'aplicado',
    'con p_referral_id se revierte sólo ese crédito');

  -- Sin filtro barre los que queden.
  v_result := pg_temp.as_actor('accounting-A', pg_temp.revert_sql('inv-two'));
  perform pg_temp.assert_true((v_result->>'count')::int = 1
    and (pg_temp.invoice('inv-two')).paid_amount = 0
    and (pg_temp.invoice('inv-two')).status = 'emitida', 'sin filtro barre lo que queda');

  -- Una factura que no existe no es un error: es el caso idempotente que
  -- revertReferralCreditsForInvoice ya trataba como no-op.
  v_result := pg_temp.as_actor('accounting-A',
    format('select public.revert_referral_credits(%L::uuid, null::uuid)', gen_random_uuid()));
  perform pg_temp.assert_true((v_result->>'count')::int = 0, 'una factura inexistente no es un error');

  perform pg_temp.expect_rejected('revertir sin factura', 'accounting-A',
    'select public.revert_referral_credits(null::uuid, null::uuid)', 'REFERRAL_CREDIT_INPUT', '22023');
end;
$revertir$;

-- 8. Ida y vuelta: aplicar y revertir deja la factura y el crédito como estaban.
--    El crédito vuelve a ser aplicable (accredited_at no se pisa).
do $ida_y_vuelta$
declare v_inv_antes jsonb; v_ref_antes jsonb;
begin
  v_inv_antes := to_jsonb(pg_temp.invoice('inv-sameday'));
  v_ref_antes := to_jsonb(pg_temp.referral('ref-sameday'));
  perform pg_temp.as_actor('accounting-A', pg_temp.revert_sql('inv-sameday'));
  perform pg_temp.as_actor('accounting-A', pg_temp.apply_sql('ref-sameday', 'inv-sameday'));
  perform pg_temp.assert_true(
    (to_jsonb(pg_temp.invoice('inv-sameday')) - 'updated_at' - 'last_payment_at')
      = (v_inv_antes - 'updated_at' - 'last_payment_at'),
    'aplicar tras revertir deja la factura igual salvo las marcas de tiempo');
  perform pg_temp.assert_true(
    (to_jsonb(pg_temp.referral('ref-sameday')) - 'updated_at' - 'applied_at')
      = (v_ref_antes - 'updated_at' - 'applied_at'),
    'el crédito vuelve a quedar aplicado sobre la misma factura');
  perform pg_temp.assert_true((pg_temp.referral('ref-sameday')).accredited_at = timestamptz '2026-06-01',
    'revertir no pisa accredited_at: el crédito no se vuelve inaplicable');
end;
$ida_y_vuelta$;

-- 9. anon y service_role no pueden llamar a las RPC. La reversión ya no corre
--    con el admin client: la llama el usuario de contabilidad, bajo su RLS.
do $acl$
declare v_state text;
begin
  begin
    perform pg_temp.as_actor('accounting-A', pg_temp.apply_sql('ref-tight', 'inv-open'), 'anon');
  exception when others then get stacked diagnostics v_state = returned_sqlstate;
  end;
  perform pg_temp.assert_true(v_state = '42501', 'anon no ejecuta apply_referral_credit');
  v_state := null;
  begin
    perform pg_temp.as_actor('accounting-A', pg_temp.revert_sql('inv-open'), 'service_role');
  exception when others then get stacked diagnostics v_state = returned_sqlstate;
  end;
  perform pg_temp.assert_true(v_state = '42501', 'service_role no ejecuta revert_referral_credits');
end;
$acl$;

select 'TEST 0471 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
