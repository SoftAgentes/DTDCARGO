\set ON_ERROR_STOP on
-- SDD-0489 · Contrato de 0468: pagar y anular una orden de pago en una transacción.
-- Fixture sintético aislado; no ejecutar sobre una DB real. Aplica con \ir las
-- migraciones REALES de facturas (0077), contabilidad (0078), cobranzas (0079,
-- 0122), Tesorería (0088), RLS (0230), auditoría (0258/0261/0267) y D2 (0290,
-- 0294), y termina en ROLLBACK.
-- RED: psql -v apply_fix=false -f /sb/tests/0468_pago_proveedor_atomico.test.sql
--
-- Una sola sesión: acá se prueban reglas, efectos, auditoría, ACL y que 0468 no
-- toca nada existente. La concurrencia (el FOR UPDATE) la prueban dos sesiones
-- reales en 0468_pago_proveedor_carrera.test.sql. A diferencia del contrato
-- 0467, Tesorería no va en cascarones: supplier_bills, supplier_payments y sus
-- policies son las de 0088 con el arreglo de 0230, las de producción. Falta
-- 0114, que sólo agrega bill_kind con default y un CHECK que las RPC no tocan.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
do $fixture_guard$
begin
  if to_regclass('public.supplier_bills') is not null or to_regclass('public.tenants') is not null
     or to_regclass('public.entity_audit_log') is not null then
    raise exception 'TEST 0468: fixture rechazada, la base ya contiene objetos de aplicación';
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
-- Columnas de 0001/0019/0200; slug lo usan los seeds de 0078 y 0122.
create table public.tenants (id uuid primary key, slug text unique not null, display_name text not null);
create table public.user_tenants (
  user_id uuid not null references auth.users(id), tenant_id uuid not null references public.tenants(id),
  role text not null, disabled_at timestamptz, primary key (user_id, tenant_id)
);
alter table public.user_tenants enable row level security;
grant select on public.user_tenants to authenticated;
create policy "users see their own user_tenants" on public.user_tenants
  for select to authenticated using (user_id = (select auth.uid()) and disabled_at is null);
-- La semántica de 0453 (la ÚNICA membresía activa) y de 0200. Es el cuerpo
-- exacto que exige el preflight de la 0468.
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
-- 0077 y 0088 apuntan a shipments; 0122 hace backfill por shipment_service.
create table public.shipments (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  shipment_service text, deleted_at timestamptz
);
-- Plataforma legacy mínima de 0267, igual que los contratos 0421 y 0467.
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
\ir ../migrations/0079_cobranzas.sql
\ir ../migrations/0088_tesoreria.sql
\ir ../migrations/0122_recibos_cobranza.sql
\ir ../migrations/0230_fix_rls_soft_delete_blocked.sql
\ir ../migrations/0258_audit_entity_catalog.sql
\ir ../migrations/0261_audit_entity_catalog_validate.sql
\ir ../migrations/0267_audit_contract_append_only.sql
\ir ../migrations/0290_audit_d2_financial_domain.sql
\ir ../migrations/0294_audit_d2_human_reasons.sql

create function pg_temp.fixture_id(p_label text) returns uuid language sql immutable as $$
  select md5('0468-synthetic-' || p_label)::uuid
$$;

insert into auth.users (id)
select pg_temp.fixture_id(u) from unnest(array['accounting-A', 'admin-A', 'commercial-A',
  'accounting-B', 'dual', 'unlinked']) u;
insert into public.tenants (id, slug, display_name) values
  (pg_temp.fixture_id('tenant-A'), 'tenant-a-0468', 'Tenant A 0468'),
  (pg_temp.fixture_id('tenant-B'), 'tenant-b-0468', 'Tenant B 0468');
insert into public.user_tenants (user_id, tenant_id, role)
select pg_temp.fixture_id(u), pg_temp.fixture_id(t), r from (values
  ('accounting-A', 'tenant-A', 'accounting'), ('admin-A', 'tenant-A', 'admin'),
  ('commercial-A', 'tenant-A', 'commercial'), ('accounting-B', 'tenant-B', 'accounting'),
  ('dual', 'tenant-A', 'accounting'), ('dual', 'tenant-B', 'accounting')) v(u, t, r);
insert into public.accounts (id, tenant_id, code, name, type, is_postable)
select pg_temp.fixture_id(a.label || '-' || t), pg_temp.fixture_id('tenant-' || t), a.code, a.name || ' ' || t,
  a.kind::public.acct_type, true
from unnest(array['A', 'B']) t,
  (values ('cash', '1.1.1.1', 'Banco', 'A'), ('expense', '5.1.1.1', 'Flete', 'CGS')) a(label, code, name, kind);
insert into public.suppliers (id, tenant_id, supplier_code, name)
select pg_temp.fixture_id('supplier-' || t), pg_temp.fixture_id('tenant-' || t), 'PRV-0001', 'Proveedor 0468 ' || t
from unnest(array['A', 'B']) t;
-- Un asiento del pago sembrado: la anulación lo devuelve para anularlo aparte.
insert into public.journal_entries (id, tenant_id, entry_code, source)
values (pg_temp.fixture_id('je-reapply'), pg_temp.fixture_id('tenant-A'), 'A-SEED-0001', 'supplier_payment');
insert into public.supplier_bills (id, tenant_id, bill_code, supplier_id, supplier_name, expense_account_id,
  currency, fx_rate, total_amount, paid_amount, status, due_date, deleted_at)
select pg_temp.fixture_id(v.label), pg_temp.fixture_id('tenant-' || v.t), v.code,
  pg_temp.fixture_id('supplier-' || v.t), 'Proveedor 0468 ' || v.t, pg_temp.fixture_id('expense-' || v.t),
  v.currency::public.invoice_currency, v.fx, v.total, v.paid, v.status, date '2026-07-01',
  case when v.archived then now() end
from (values
  ('bill-open', 'A', 'CXP-OPEN', 'USD', null::numeric, 1000, 0, 'pendiente', false),
  ('bill-edge', 'A', 'CXP-EDGE', 'USD', null, 1000, 600, 'parcial', false),
  ('bill-paid', 'A', 'CXP-PAID', 'USD', null, 500, 500, 'pagada', false),
  -- Lo que deja la carrera vieja: anulada con una orden viva que el pagado no refleja.
  ('bill-void', 'A', 'CXP-VOID', 'USD', null, 800, 300, 'anulada', false),
  ('bill-archived', 'A', 'CXP-ARCHIVED', 'USD', null, 700, 0, 'pendiente', true),
  ('bill-ves', 'A', 'CXP-VES', 'VES', 36.5, 5000, 0, 'pendiente', false),
  ('bill-reapply', 'A', 'CXP-REAPPLY', 'USD', null, 2000, 400, 'parcial', false),
  ('bill-full', 'A', 'CXP-FULL', 'USD', null, 900, 900, 'pagada', false),
  ('bill-B', 'B', 'CXP-B', 'USD', null, 1000, 0, 'pendiente', false)
) v(label, t, code, currency, fx, total, paid, status, archived);
insert into public.supplier_payments (id, tenant_id, payment_code, bill_id, supplier_id, supplier_name,
  amount, currency, method, cash_account_id, paid_at, journal_entry_id)
select pg_temp.fixture_id(v.label), pg_temp.fixture_id('tenant-A'), v.code, pg_temp.fixture_id(v.bill),
  pg_temp.fixture_id('supplier-A'), 'Proveedor 0468 A', v.amount, 'USD', 'transferencia',
  pg_temp.fixture_id('cash-A'), date '2026-05-20',
  case when v.entry is null then null else pg_temp.fixture_id(v.entry) end
from (values
  ('pay-void', 'OP-SEED-0001', 'bill-void', 300, null),
  ('pay-reapply', 'OP-SEED-0002', 'bill-reapply', 400, 'je-reapply'),
  ('pay-full-1', 'OP-SEED-0003', 'bill-full', 500, null),
  ('pay-full-2', 'OP-SEED-0004', 'bill-full', 400, null)
) v(label, code, bill, amount, entry);

create temporary table baseline_policies as select to_jsonb(p) as definition from pg_catalog.pg_policies p;
create temporary table baseline_acl as select c.oid, c.relacl from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v');
create temporary table baseline_triggers as select t.oid, to_jsonb(t) as definition
from pg_trigger t where not t.tgisinternal;
create temporary table baseline_functions as
select p.oid, to_jsonb(p) as definition from pg_catalog.pg_proc p
join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'auth');
create temporary table baseline_rows as
select 'bill' as kind, to_jsonb(b) as row_data from public.supplier_bills b
union all select 'payment', to_jsonb(p) from public.supplier_payments p;

\if :apply_fix
\ir ../migrations/0468_pago_proveedor_atomico.sql
\endif

-- Helpers de observación: las RPC reales bajo el rol API y el auth.uid de la
-- fixture. No reemplazan autorización ni writer.
create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0468: %', p_label; end if;
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
    'bills', (select jsonb_agg(to_jsonb(b) order by id) from public.supplier_bills b),
    'payments', (select jsonb_agg(to_jsonb(p) order by id) from public.supplier_payments p),
    'events', (select count(*) from public.entity_audit_log))
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
create function pg_temp.pago_sql(p_bill text, p_amount numeric, p_cash uuid default null,
  p_method text default 'zelle', p_paid_at date default date '2026-06-01') returns text language sql as $$
  select format('select public.register_supplier_payment_order(%L::uuid, %s::numeric, %L::uuid, %L, %L::date, %L, %L)',
    pg_temp.fixture_id(p_bill), p_amount, coalesce(p_cash, pg_temp.fixture_id('cash-A')), p_method, p_paid_at,
    'ZELLE-0468', 'Nota del pago')
$$;
create function pg_temp.void_sql(p_payment uuid, p_reason text default 'Pago devuelto por el proveedor') returns text
language sql as $$
  select format('select public.void_supplier_payment_order(%L::uuid, %L)', p_payment, p_reason)
$$;
create function pg_temp.bill(p_label text) returns public.supplier_bills language sql as $$
  select * from public.supplier_bills where id = pg_temp.fixture_id(p_label)
$$;

-- 1. Catálogo: dos funciones INVOKER, search_path vacío, owner postgres y
--    EXECUTE sólo para authenticated (el patrón D2 de 0294, como la 0467).
do $catalog$
declare v_fn text;
begin
  foreach v_fn in array array[
    'public.register_supplier_payment_order(uuid,numeric,uuid,text,date,text,text)',
    'public.void_supplier_payment_order(uuid,text)'] loop
    perform pg_temp.assert_true(to_regprocedure(v_fn) is not null, 'existe ' || v_fn);
    perform pg_temp.assert_true(exists(select 1 from pg_proc p where p.oid = to_regprocedure(v_fn)
      and not p.prosecdef and p.provolatile = 'v' and p.proowner = 'postgres'::regrole
      and p.prorettype = 'jsonb'::regtype and p.proconfig = array['search_path=""']), 'forma de ' || v_fn);
    perform pg_temp.assert_true(has_function_privilege('authenticated', to_regprocedure(v_fn), 'EXECUTE')
      and not has_function_privilege('anon', to_regprocedure(v_fn), 'EXECUTE')
      and not has_function_privilege('service_role', to_regprocedure(v_fn), 'EXECUTE'), 'ACL de ' || v_fn);
  end loop;
end;
$catalog$;

-- 2. 0468 es aditiva: policies, ACL, triggers, funciones y filas previas intactas.
do $unchanged$
begin
  perform pg_temp.assert_true(not exists(select 1 from baseline_policies b full join
    (select to_jsonb(p) as definition from pg_policies p) n using(definition)
    where b.definition is null or n.definition is null), 'policies existentes intactas');
  perform pg_temp.assert_true(not exists(select 1 from baseline_acl b join pg_class c on c.oid = b.oid
    where b.relacl is distinct from c.relacl), 'ACL de tablas intacta');
  perform pg_temp.assert_true(not exists(select 1 from baseline_triggers b left join pg_trigger t on t.oid = b.oid
    where b.definition is distinct from to_jsonb(t)), 'triggers intactos');
  perform pg_temp.assert_true(not exists(select 1 from baseline_functions b left join pg_proc p on p.oid = b.oid
    where b.definition is distinct from to_jsonb(p)), 'funciones existentes intactas');
  perform pg_temp.assert_true(not exists(select 1 from baseline_rows b full join
    (select 'bill' as kind, to_jsonb(s) as row_data from public.supplier_bills s
     union all select 'payment', to_jsonb(p) from public.supplier_payments p) n using(kind, row_data)
    where b.row_data is null or n.row_data is null), 'ninguna fila de negocio cambia al aplicar');
end;
$unchanged$;

-- 3. Centinela para CI (una sola conexión): cada lectura que decide el saldo
--    lleva FOR UPDATE. La prueba de que alcanza es la carrera de dos sesiones.
do $sentinel$
begin
  perform pg_temp.assert_true((select count(*) from regexp_matches(prosrc, '\n\s*for update;', 'g')) = 1,
    'register_supplier_payment_order toma la CxP FOR UPDATE')
  from pg_proc where oid = 'public.register_supplier_payment_order(uuid,numeric,uuid,text,date,text,text)'::regprocedure;
  perform pg_temp.assert_true((select count(*) from regexp_matches(prosrc, '\n\s*for update;', 'g')) = 2,
    'void_supplier_payment_order toma la orden y la CxP FOR UPDATE')
  from pg_proc where oid = 'public.void_supplier_payment_order(uuid,text)'::regprocedure;
end;
$sentinel$;

-- 4. Pago: orden + saldo + estado + auditoría en una transacción.
do $pago$
declare v_result jsonb; v_payment public.supplier_payments; v_bill public.supplier_bills;
begin
  v_result := pg_temp.as_actor('accounting-A', pg_temp.pago_sql('bill-open', 300));
  select * into v_payment from public.supplier_payments where id = (v_result->>'payment_id')::uuid;
  v_bill := pg_temp.bill('bill-open');
  perform pg_temp.assert_true(v_payment.bill_id = v_bill.id and v_payment.amount = 300
    and v_payment.supplier_id = pg_temp.fixture_id('supplier-A') and v_payment.supplier_name = 'Proveedor 0468 A'
    and v_payment.currency = 'USD' and v_payment.fx_rate is null and v_payment.method = 'zelle'
    and v_payment.reference = 'ZELLE-0468' and v_payment.notes = 'Nota del pago'
    and v_payment.paid_at = date '2026-06-01' and v_payment.cash_account_id = pg_temp.fixture_id('cash-A')
    and v_payment.tenant_id = pg_temp.fixture_id('tenant-A') and v_payment.journal_entry_id is null
    and v_payment.deleted_at is null, 'la orden del pago');
  perform pg_temp.assert_true(v_payment.payment_code ~ ('^OP-' || extract(year from current_date) || '-0001$'),
    'primer código OP- del año para el tenant (los OP-SEED no cuentan)');
  perform pg_temp.assert_true(v_bill.paid_amount = 300 and v_bill.status = 'parcial',
    'la CxP sube a 300 y queda parcial');
  perform pg_temp.assert_true(v_result @> jsonb_build_object('payment_code', v_payment.payment_code,
    'tenant_id', pg_temp.fixture_id('tenant-A'), 'bill_id', v_bill.id, 'bill_code', 'CXP-OPEN',
    'currency', 'USD', 'fx_rate', null, 'amount', 300, 'paid_amount', 300, 'total_amount', 1000,
    'status', 'parcial', 'fully_paid', false), 'resultado del pago');
  perform pg_temp.assert_true(exists(select 1 from public.entity_audit_log a where a.entity_id = v_payment.id
      and a.event_type = 'payment_registered' and a.actor_id = pg_temp.fixture_id('accounting-A'))
    and exists(select 1 from public.entity_audit_log a where a.entity_id = v_bill.id
      and a.event_type = 'bill_status_changed'), 'D2 audita la orden y la CxP en la misma transacción');
  perform pg_temp.assert_true(exists(select 1 from pg_locks l where l.locktype = 'advisory' and l.classid = 489
    and l.pid = pg_backend_pid() and l.granted), 'el pago toma el lock consultivo 489 del tenant hasta el COMMIT');

  -- El segundo pago salda justo el total: 700 de 700 restantes.
  v_result := pg_temp.as_actor('admin-A', pg_temp.pago_sql('bill-open', 700));
  v_bill := pg_temp.bill('bill-open');
  perform pg_temp.assert_true(v_bill.paid_amount = 1000 and v_bill.status = 'pagada'
    and (v_result->>'fully_paid')::boolean, 'un pago por el saldo exacto la deja pagada');
  perform pg_temp.assert_true(v_result->>'payment_code' ~ ('^OP-' || extract(year from current_date) || '-0002$'),
    'el código siguiente es consecutivo');

  -- La orden hereda la moneda y el fx_rate de la CxP; método y fecha por defecto.
  v_result := pg_temp.as_actor('accounting-A', format(
    'select public.register_supplier_payment_order(%L::uuid, 1250::numeric, %L::uuid, null, null, null, null)',
    pg_temp.fixture_id('bill-ves'), pg_temp.fixture_id('cash-A')));
  select * into v_payment from public.supplier_payments where id = (v_result->>'payment_id')::uuid;
  perform pg_temp.assert_true(v_payment.currency = 'VES' and v_payment.fx_rate = 36.5
    and v_payment.method = 'transferencia' and v_payment.paid_at = current_date
    and v_payment.reference is null and v_payment.notes is null
    and v_result @> jsonb_build_object('currency', 'VES', 'fx_rate', 36.5, 'status', 'parcial'),
    'moneda y fx_rate de la CxP; transferencia y hoy por defecto');
end;
$pago$;

-- 5. Reglas del pago. Saldo estricto, el de Cobranzas (0467, decisión de Sam).
do $pago_rules$
begin
  perform pg_temp.expect_rejected('un centavo sobre el saldo', 'accounting-A',
    pg_temp.pago_sql('bill-edge', 400.01), 'PAYMENT_EXCEEDS_BALANCE', '23514');
  perform pg_temp.expect_rejected('CxP pagada', 'accounting-A',
    pg_temp.pago_sql('bill-paid', 1), 'PAYMENT_BILL_PAID', '23514');
  perform pg_temp.expect_rejected('CxP anulada', 'accounting-A',
    pg_temp.pago_sql('bill-void', 1), 'PAYMENT_STATE', '23514');
  perform pg_temp.expect_rejected('CxP archivada', 'accounting-A',
    pg_temp.pago_sql('bill-archived', 1), 'PAYMENT_STATE', '23514');
  perform pg_temp.expect_rejected('monto con tres decimales', 'accounting-A',
    pg_temp.pago_sql('bill-edge', 1.001), 'PAYMENT_INPUT', '22023');
  perform pg_temp.expect_rejected('monto cero', 'accounting-A',
    pg_temp.pago_sql('bill-edge', 0), 'PAYMENT_INPUT', '22023');
  perform pg_temp.expect_rejected('monto negativo', 'accounting-A',
    pg_temp.pago_sql('bill-edge', -5), 'PAYMENT_INPUT', '22023');
  perform pg_temp.expect_rejected('sin cuenta de caja', 'accounting-A', format(
    'select public.register_supplier_payment_order(%L::uuid, 1::numeric, null, null, null, null, null)',
    pg_temp.fixture_id('bill-edge')), 'PAYMENT_INPUT', '22023');
  perform pg_temp.expect_rejected('rol comercial', 'commercial-A',
    pg_temp.pago_sql('bill-edge', 1), 'PAYMENT_FORBIDDEN', '42501');
  perform pg_temp.expect_rejected('sin membresía', 'unlinked',
    pg_temp.pago_sql('bill-edge', 1), 'PAYMENT_FORBIDDEN', '42501');
  perform pg_temp.expect_rejected('dos membresías activas (get_user_tenant_id NULL)', 'dual',
    pg_temp.pago_sql('bill-edge', 1), 'PAYMENT_FORBIDDEN', '42501');
  perform pg_temp.expect_rejected('CxP de otro tenant', 'accounting-A',
    pg_temp.pago_sql('bill-B', 1), 'PAYMENT_BILL_NOT_FOUND', 'P0002');
  -- Una cuenta de caja inexistente muere en la FK de 0088, después de tomar la
  -- CxP y el código: la RPC entera se revierte.
  perform pg_temp.expect_rejected('cuenta de caja inexistente', 'accounting-A',
    pg_temp.pago_sql('bill-edge', 1, pg_temp.fixture_id('cash-missing')),
    'insert or update on table "supplier_payments" violates foreign key constraint "supplier_payments_cash_account_id_fkey"',
    '23503');
end;
$pago_rules$;

-- 6. Anulación: marca con motivo D2, baja el pagado y recalcula, junta.
do $void$
declare v_result jsonb; v_bill public.supplier_bills;
begin
  v_result := pg_temp.as_actor('accounting-A', pg_temp.void_sql(pg_temp.fixture_id('pay-reapply')));
  v_bill := pg_temp.bill('bill-reapply');
  perform pg_temp.assert_true((select deleted_at is not null from public.supplier_payments
    where id = pg_temp.fixture_id('pay-reapply')), 'la orden queda anulada');
  perform pg_temp.assert_true(v_bill.paid_amount = 0 and v_bill.status = 'pendiente', 'parcial 400 → pendiente 0');
  perform pg_temp.assert_true(v_result @> jsonb_build_object('payment_id', pg_temp.fixture_id('pay-reapply'),
    'payment_code', 'OP-SEED-0002', 'tenant_id', pg_temp.fixture_id('tenant-A'), 'bill_id', v_bill.id,
    'bill_code', 'CXP-REAPPLY', 'journal_entry_id', pg_temp.fixture_id('je-reapply'), 'paid_amount', 0,
    'total_amount', 2000, 'status', 'pendiente'), 'resultado de la anulación, con el asiento a anular');
  perform pg_temp.assert_true(exists(select 1 from public.entity_audit_log a
      where a.entity_id = pg_temp.fixture_id('pay-reapply')
      and a.event_type = 'payment_voided' and a.reason = 'Pago devuelto por el proveedor')
    and exists(select 1 from public.entity_audit_log a where a.entity_id = v_bill.id
      and a.event_type = 'bill_status_changed' and a.reason = 'Pago devuelto por el proveedor'),
    'el motivo humano queda en el evento de la orden y en el de la CxP');

  perform pg_temp.expect_rejected('anular dos veces', 'accounting-A',
    pg_temp.void_sql(pg_temp.fixture_id('pay-reapply')), 'PAYMENT_ORDER_VOIDED', '23514');
  perform pg_temp.expect_rejected('motivo corto', 'accounting-A',
    pg_temp.void_sql(pg_temp.fixture_id('pay-full-2'), 'no'),
    'audit: reason debe tener entre 4 y 1000 caracteres', '22023');
  perform pg_temp.expect_rejected('rol comercial', 'commercial-A',
    pg_temp.void_sql(pg_temp.fixture_id('pay-full-2')), 'PAYMENT_FORBIDDEN', '42501');
  perform pg_temp.expect_rejected('orden de otro tenant', 'accounting-B',
    pg_temp.void_sql(pg_temp.fixture_id('pay-full-2')), 'PAYMENT_ORDER_NOT_FOUND', 'P0002');
  perform pg_temp.expect_rejected('sin orden', 'accounting-A',
    'select public.void_supplier_payment_order(null, ''Pago devuelto por el proveedor'')',
    'PAYMENT_INPUT', '22023');

  -- Pagada → parcial: 900 − 400 = 500.
  v_result := pg_temp.as_actor('admin-A', pg_temp.void_sql(pg_temp.fixture_id('pay-full-2')));
  v_bill := pg_temp.bill('bill-full');
  perform pg_temp.assert_true(v_bill.paid_amount = 500 and v_bill.status = 'parcial'
    and v_result @> '{"journal_entry_id": null, "status": "parcial"}'::jsonb, 'pagada 900 → parcial 500');

  -- Una CxP anulada no revive: sólo baja el pagado. La app no la tocaba.
  perform pg_temp.as_actor('accounting-A', pg_temp.void_sql(pg_temp.fixture_id('pay-void')));
  v_bill := pg_temp.bill('bill-void');
  perform pg_temp.assert_true(v_bill.paid_amount = 0 and v_bill.status = 'anulada',
    'la CxP anulada conserva su estado y sólo baja el pagado');
end;
$void$;

-- 7. anon y service_role no pueden llamar a las RPC.
do $acl$
declare v_state text;
begin
  begin
    perform pg_temp.as_actor('accounting-A', pg_temp.pago_sql('bill-edge', 1), 'anon');
  exception when others then get stacked diagnostics v_state = returned_sqlstate;
  end;
  perform pg_temp.assert_true(v_state = '42501', 'anon no ejecuta register_supplier_payment_order');
  v_state := null;
  begin
    perform pg_temp.as_actor('accounting-A', pg_temp.void_sql(pg_temp.fixture_id('pay-full-1')), 'service_role');
  exception when others then get stacked diagnostics v_state = returned_sqlstate;
  end;
  perform pg_temp.assert_true(v_state = '42501', 'service_role no ejecuta void_supplier_payment_order');
end;
$acl$;

select 'TEST 0468 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
