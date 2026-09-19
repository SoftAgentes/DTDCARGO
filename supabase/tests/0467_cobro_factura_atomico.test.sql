\set ON_ERROR_STOP on
-- SDD-0488 · Contrato de 0467: cobrar, identificar y anular en una transacción.
-- Fixture sintético aislado; no ejecutar sobre una DB real. Aplica con \ir las
-- migraciones REALES de facturas (0077), contabilidad (0078), cobranzas (0079,
-- 0122), RLS (0230, 0407), auditoría (0258/0261/0267) y D2 (0290, 0294), y
-- termina en ROLLBACK.
-- RED: psql -v apply_fix=false -f /sb/tests/0467_cobro_factura_atomico.test.sql
--
-- Una sola sesión: acá se prueban reglas, efectos, auditoría, ACL y que 0467 no
-- toca nada existente. La concurrencia (el FOR UPDATE) la prueban dos sesiones
-- reales en scripts/qa/cobro-factura-race.mjs. Sin 0414 la lectura de facturas
-- queda tenant-wide (0407); el FOR UPDATE igual exige la policy de UPDATE
-- (accounting/admin), que es la de producción.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
do $fixture_guard$
begin
  if to_regclass('public.invoices') is not null or to_regclass('public.tenants') is not null
     or to_regclass('public.entity_audit_log') is not null then
    raise exception 'TEST 0467: fixture rechazada, la base ya contiene objetos de aplicación';
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
-- La semántica de 0453 (la ÚNICA membresía activa) y de 0200.
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
-- 0077 apunta a shipments; 0122 hace backfill por shipment_service.
create table public.shipments (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  shipment_service text, deleted_at timestamptz
);
-- Plataforma legacy mínima de 0267, igual que el contrato 0421.
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
-- 0290 exige las tablas de Tesorería: cascarones con las columnas que lee.
create table public.suppliers (
  id uuid primary key, tenant_id uuid not null, supplier_code text, type text, country text,
  default_currency text, payment_channel text, deleted_at timestamptz
);
create table public.supplier_bills (
  id uuid primary key, tenant_id uuid not null, bill_code text, supplier_id uuid, status text,
  currency text, paid_amount numeric(14,2) not null default 0, deleted_at timestamptz
);
create table public.supplier_payments (
  id uuid primary key, tenant_id uuid not null, payment_code text, bill_id uuid, currency text,
  deleted_at timestamptz
);

\ir ../migrations/0077_invoices.sql
\ir ../migrations/0078_contabilidad.sql
\ir ../migrations/0079_cobranzas.sql
\ir ../migrations/0122_recibos_cobranza.sql
\ir ../migrations/0230_fix_rls_soft_delete_blocked.sql
\ir ../migrations/0258_audit_entity_catalog.sql
\ir ../migrations/0261_audit_entity_catalog_validate.sql
\ir ../migrations/0267_audit_contract_append_only.sql
\ir ../migrations/0290_audit_d2_financial_domain.sql
\ir ../migrations/0294_audit_d2_human_reasons.sql
\ir ../migrations/0407_invoices_write_rbac.sql

create function pg_temp.fixture_id(p_label text) returns uuid language sql immutable as $$
  select md5('0467-synthetic-' || p_label)::uuid
$$;

insert into auth.users (id)
select pg_temp.fixture_id(u) from unnest(array['accounting-A', 'admin-A', 'commercial-A',
  'accounting-B', 'dual', 'unlinked']) u;
insert into public.tenants (id, slug, display_name) values
  (pg_temp.fixture_id('tenant-A'), 'tenant-a-0467', 'Tenant A 0467'),
  (pg_temp.fixture_id('tenant-B'), 'tenant-b-0467', 'Tenant B 0467');
insert into public.user_tenants (user_id, tenant_id, role)
select pg_temp.fixture_id(u), pg_temp.fixture_id(t), r from (values
  ('accounting-A', 'tenant-A', 'accounting'), ('admin-A', 'tenant-A', 'admin'),
  ('commercial-A', 'tenant-A', 'commercial'), ('accounting-B', 'tenant-B', 'accounting'),
  ('dual', 'tenant-A', 'accounting'), ('dual', 'tenant-B', 'accounting')) v(u, t, r);
insert into public.accounts (id, tenant_id, code, name, type, is_postable)
select pg_temp.fixture_id('cash-' || t), pg_temp.fixture_id('tenant-' || t), '1.1.1.1', 'Banco ' || t, 'A', true
from unnest(array['A', 'B']) t;
insert into public.invoices (id, tenant_id, invoice_code, client_markbox, client_name, currency, fx_rate,
  base_amount, total_amount, paid_amount, status, fund_class, deleted_at)
select pg_temp.fixture_id(v.label), pg_temp.fixture_id(v.tenant), v.code, 'DTD-0467', 'Cliente 0467',
  v.currency::public.invoice_currency, v.fx, v.total, v.total, v.paid, v.status::public.invoice_status,
  v.fund, case when v.archived then now() end
from (values
  ('inv-open', 'tenant-A', 'F-OPEN', 'USD', null::numeric, 1000, 0, 'emitida', 'third_party', false),
  ('inv-local', 'tenant-A', 'F-LOCAL', 'USD', null, 1000, 0, 'emitida', 'local_revenue', false),
  ('inv-edge', 'tenant-A', 'F-EDGE', 'USD', null, 1000, 600, 'parcial', 'third_party', false),
  ('inv-overdue', 'tenant-A', 'F-OVERDUE', 'USD', null, 1000, 0, 'vencida', 'third_party', false),
  ('inv-paid', 'tenant-A', 'F-PAID', 'USD', null, 500, 500, 'pagada', 'third_party', false),
  ('inv-void', 'tenant-A', 'F-VOID', 'USD', null, 800, 300, 'anulada', 'third_party', false),
  ('inv-draft', 'tenant-A', 'F-DRAFT', 'USD', null, 700, 0, 'borrador', 'third_party', false),
  ('inv-archived', 'tenant-A', 'F-ARCHIVED', 'USD', null, 700, 0, 'emitida', 'third_party', true),
  ('inv-ves', 'tenant-A', 'F-VES', 'VES', 36.5, 5000, 0, 'emitida', 'third_party', false),
  ('inv-identify', 'tenant-A', 'F-IDENTIFY', 'USD', null, 2000, 0, 'emitida', 'local_revenue', false),
  ('inv-reapply', 'tenant-A', 'F-REAPPLY', 'USD', null, 2000, 400, 'parcial', 'third_party', false),
  ('inv-B', 'tenant-B', 'F-B', 'USD', null, 1000, 0, 'emitida', 'third_party', false)
) v(label, tenant, code, currency, fx, total, paid, status, fund, archived);
insert into public.payment_receipts (id, tenant_id, receipt_code, invoice_id, client_markbox, client_name,
  amount, currency, fx_rate, method, cash_account_id, received_at, application_status, fund_class)
select pg_temp.fixture_id(v.label), pg_temp.fixture_id('tenant-A'), v.code,
  case when v.invoice is null then null else pg_temp.fixture_id(v.invoice) end,
  case when v.invoice is null then null else 'DTD-0467' end,
  case when v.invoice is null then null else 'Cliente 0467' end,
  v.amount, v.currency::public.invoice_currency, v.fx, 'transferencia', pg_temp.fixture_id('cash-A'),
  date '2026-05-20', case when v.invoice is null then 'recibido_sin_ref' else 'aplicado' end, 'third_party'
from (values
  ('rec-void', 'R-SEED-0001', 'inv-void', 300, 'USD', null::numeric),
  ('rec-reapply', 'R-SEED-0002', 'inv-reapply', 400, 'USD', null),
  ('rec-sinref', 'R-SEED-0003', null, 800, 'USD', null),
  ('rec-sinref-ves', 'R-SEED-0004', null, 1000, 'VES', 36.5),
  ('rec-sinref-big', 'R-SEED-0005', null, 3000, 'USD', null),
  ('rec-sinref-void', 'R-SEED-0006', null, 50, 'USD', null)
) v(label, code, invoice, amount, currency, fx);

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
union all select 'receipt', to_jsonb(r) from public.payment_receipts r;

\if :apply_fix
\ir ../migrations/0467_cobro_factura_atomico.sql
\endif

-- Helpers de observación: las RPC reales bajo el rol API y el auth.uid de la
-- fixture. No reemplazan autorización ni writer.
create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0467: %', p_label; end if;
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
    'receipts', (select jsonb_agg(to_jsonb(r) order by id) from public.payment_receipts r),
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
create function pg_temp.cobro_sql(p_invoice text, p_amount numeric, p_payer_kind text default 'cliente',
  p_payer_name text default null, p_payer_relation text default null, p_licit boolean default false,
  p_cash text default 'cash-A') returns text language sql as $$
  select format('select public.register_collection_receipt(%L::uuid, %s::numeric, %L::uuid, %L, %L::date, %L, %L, %L, %L, %L, %L::boolean)',
    pg_temp.fixture_id(p_invoice), p_amount, pg_temp.fixture_id(p_cash), 'zelle', date '2026-06-01',
    'ZELLE-0467', 'Nota del cobro', p_payer_kind, p_payer_name, p_payer_relation, p_licit)
$$;
create function pg_temp.identify_sql(p_receipt text, p_invoice text) returns text language sql as $$
  select format('select public.identify_collection_receipt(%L::uuid, %L::uuid)',
    pg_temp.fixture_id(p_receipt), pg_temp.fixture_id(p_invoice))
$$;
create function pg_temp.void_sql(p_receipt uuid, p_reason text default 'Pago devuelto al cliente') returns text
language sql as $$
  select format('select public.void_collection_receipt(%L::uuid, %L)', p_receipt, p_reason)
$$;
create function pg_temp.invoice(p_label text) returns public.invoices language sql as $$
  select * from public.invoices where id = pg_temp.fixture_id(p_label)
$$;

-- 1. Catálogo: tres funciones INVOKER, search_path vacío, owner postgres y
--    EXECUTE sólo para authenticated (el patrón D2 de 0294).
do $catalog$
declare v_fn text;
begin
  foreach v_fn in array array[
    'public.register_collection_receipt(uuid,numeric,uuid,text,date,text,text,text,text,text,boolean)',
    'public.identify_collection_receipt(uuid,uuid)', 'public.void_collection_receipt(uuid,text)'] loop
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

-- 2. 0467 es aditiva: policies, ACL, triggers, funciones y filas previas intactas.
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
    (select 'invoice' as kind, to_jsonb(i) as row_data from public.invoices i
     union all select 'receipt', to_jsonb(r) from public.payment_receipts r) n using(kind, row_data)
    where b.row_data is null or n.row_data is null), 'ninguna fila de negocio cambia al aplicar');
end;
$unchanged$;

-- 3. Centinela para CI (una sola conexión): cada lectura que decide el saldo
--    lleva FOR UPDATE. La prueba de que alcanza es la carrera de dos sesiones.
do $sentinel$
begin
  perform pg_temp.assert_true((select count(*) from regexp_matches(prosrc, '\n\s*for update;', 'g')) = 1,
    'register_collection_receipt toma la factura FOR UPDATE')
  from pg_proc where oid = 'public.register_collection_receipt(uuid,numeric,uuid,text,date,text,text,text,text,text,boolean)'::regprocedure;
  perform pg_temp.assert_true((select count(*) from regexp_matches(prosrc, '\n\s*for update;', 'g')) = 2,
    'identify_collection_receipt toma recibo y factura FOR UPDATE')
  from pg_proc where oid = 'public.identify_collection_receipt(uuid,uuid)'::regprocedure;
  perform pg_temp.assert_true((select count(*) from regexp_matches(prosrc, '\n\s*for update;', 'g')) = 2,
    'void_collection_receipt toma recibo y factura FOR UPDATE')
  from pg_proc where oid = 'public.void_collection_receipt(uuid,text)'::regprocedure;
end;
$sentinel$;

-- 4. Cobro: recibo + saldo + estado + auditoría en una transacción.
do $cobro$
declare v_result jsonb; v_receipt public.payment_receipts; v_inv public.invoices; v_events bigint;
begin
  v_events := (select count(*) from public.entity_audit_log);
  v_result := pg_temp.as_actor('accounting-A', pg_temp.cobro_sql('inv-open', 300));
  select * into v_receipt from public.payment_receipts where id = (v_result->>'receipt_id')::uuid;
  v_inv := pg_temp.invoice('inv-open');
  perform pg_temp.assert_true(v_receipt.invoice_id = v_inv.id and v_receipt.amount = 300
    and v_receipt.currency = 'USD' and v_receipt.application_status = 'aplicado'
    and v_receipt.client_markbox = 'DTD-0467' and v_receipt.client_name = 'Cliente 0467'
    and v_receipt.method = 'zelle' and v_receipt.reference = 'ZELLE-0467' and v_receipt.notes = 'Nota del cobro'
    and v_receipt.received_at = date '2026-06-01' and v_receipt.cash_account_id = pg_temp.fixture_id('cash-A')
    and v_receipt.payer_kind = 'cliente' and v_receipt.payer_name is null and not v_receipt.licit_declared
    and v_receipt.fund_class = 'third_party' and v_receipt.deleted_at is null, 'el recibo del cobro');
  perform pg_temp.assert_true(v_receipt.receipt_code ~ ('^R-' || extract(year from current_date) || '-0001$'),
    'primer código R- del año para el tenant (los R-SEED no cuentan)');
  perform pg_temp.assert_true(v_inv.paid_amount = 300 and v_inv.status = 'parcial'
    and v_inv.last_payment_at is not null, 'la factura sube a 300 y queda parcial');
  perform pg_temp.assert_true(v_result @> jsonb_build_object('receipt_code', v_receipt.receipt_code,
    'tenant_id', pg_temp.fixture_id('tenant-A'), 'invoice_id', v_inv.id, 'invoice_code', 'F-OPEN',
    'currency', 'USD', 'amount', 300, 'paid_amount', 300, 'total_amount', 1000, 'status', 'parcial',
    'fully_paid', false), 'resultado del cobro');
  perform pg_temp.assert_true(exists(select 1 from public.entity_audit_log a where a.entity_id = v_receipt.id
      and a.event_type = 'payment_registered' and a.actor_id = pg_temp.fixture_id('accounting-A'))
    and exists(select 1 from public.entity_audit_log a where a.entity_id = v_inv.id
      and a.event_type = 'invoice_payment_registered'), 'D2 audita el recibo y la factura en la misma transacción');
  perform pg_temp.assert_true(exists(select 1 from pg_locks l where l.locktype = 'advisory' and l.classid = 488
    and l.pid = pg_backend_pid() and l.granted), 'el cobro toma el lock consultivo 488 del tenant hasta el COMMIT');

  -- El segundo cobro salda justo el total: 700 de 700 restantes.
  v_result := pg_temp.as_actor('admin-A', pg_temp.cobro_sql('inv-open', 700));
  v_inv := pg_temp.invoice('inv-open');
  perform pg_temp.assert_true(v_inv.paid_amount = 1000 and v_inv.status = 'pagada'
    and (v_result->>'fully_paid')::boolean, 'un cobro por el saldo exacto la deja pagada');
  perform pg_temp.assert_true(v_result->>'receipt_code' ~ ('^R-' || extract(year from current_date) || '-0002$'),
    'el código siguiente es consecutivo');

  -- vencida (visual, 0077) también es cobrable, como en la app; fund_class hereda.
  v_result := pg_temp.as_actor('accounting-A', pg_temp.cobro_sql('inv-overdue', 100));
  perform pg_temp.assert_true((pg_temp.invoice('inv-overdue')).status = 'parcial', 'vencida cobrada queda parcial');
  v_result := pg_temp.as_actor('accounting-A', pg_temp.cobro_sql('inv-local', 100, 'tercero', 'María Pérez',
    'familiar', true));
  select * into v_receipt from public.payment_receipts where id = (v_result->>'receipt_id')::uuid;
  perform pg_temp.assert_true(v_receipt.fund_class = 'local_revenue' and v_receipt.payer_kind = 'tercero'
    and v_receipt.payer_name = 'María Pérez' and v_receipt.payer_relation = 'familiar'
    and v_receipt.licit_declared, 'pagador tercero y fund_class heredada de la factura');
end;
$cobro$;

-- 5. Reglas del cobro. Saldo estricto, decisión de Sam (igual que la 0464).
do $cobro_rules$
begin
  perform pg_temp.expect_rejected('un centavo sobre el saldo', 'accounting-A',
    pg_temp.cobro_sql('inv-edge', 400.01), 'PAYMENT_EXCEEDS_BALANCE', '23514');
  perform pg_temp.expect_rejected('factura pagada', 'accounting-A',
    pg_temp.cobro_sql('inv-paid', 1), 'PAYMENT_INVOICE_PAID', '23514');
  perform pg_temp.expect_rejected('factura anulada', 'accounting-A',
    pg_temp.cobro_sql('inv-void', 1), 'PAYMENT_STATE', '23514');
  perform pg_temp.expect_rejected('factura en borrador', 'accounting-A',
    pg_temp.cobro_sql('inv-draft', 1), 'PAYMENT_STATE', '23514');
  perform pg_temp.expect_rejected('factura archivada', 'accounting-A',
    pg_temp.cobro_sql('inv-archived', 1), 'PAYMENT_STATE', '23514');
  perform pg_temp.expect_rejected('monto con tres decimales', 'accounting-A',
    pg_temp.cobro_sql('inv-edge', 1.001), 'PAYMENT_INPUT', '22023');
  perform pg_temp.expect_rejected('monto cero', 'accounting-A',
    pg_temp.cobro_sql('inv-edge', 0), 'PAYMENT_INPUT', '22023');
  perform pg_temp.expect_rejected('monto negativo', 'accounting-A',
    pg_temp.cobro_sql('inv-edge', -5), 'PAYMENT_INPUT', '22023');
  perform pg_temp.expect_rejected('rol comercial', 'commercial-A',
    pg_temp.cobro_sql('inv-edge', 1), 'PAYMENT_FORBIDDEN', '42501');
  perform pg_temp.expect_rejected('sin membresía', 'unlinked',
    pg_temp.cobro_sql('inv-edge', 1), 'PAYMENT_FORBIDDEN', '42501');
  perform pg_temp.expect_rejected('dos membresías activas (get_user_tenant_id NULL)', 'dual',
    pg_temp.cobro_sql('inv-edge', 1), 'PAYMENT_FORBIDDEN', '42501');
  perform pg_temp.expect_rejected('factura de otro tenant', 'accounting-A',
    pg_temp.cobro_sql('inv-B', 1), 'PAYMENT_INVOICE_NOT_FOUND', 'P0002');
  -- El CHECK de 0122 rechaza el tercero incompleto y la RPC entera se revierte.
  perform pg_temp.expect_rejected('tercero sin nombre', 'accounting-A',
    pg_temp.cobro_sql('inv-edge', 1, 'tercero', null, 'familiar', true),
    'new row for relation "payment_receipts" violates check constraint "payment_receipts_tercero_completo_check"', '23514');
end;
$cobro_rules$;

-- 6. Identificación: recibo y saldo juntos; received_at intacto (SDD-0068 #6).
do $identify$
declare v_result jsonb; v_receipt public.payment_receipts; v_inv public.invoices;
begin
  v_result := pg_temp.as_actor('accounting-A', pg_temp.identify_sql('rec-sinref', 'inv-identify'));
  select * into v_receipt from public.payment_receipts where id = pg_temp.fixture_id('rec-sinref');
  v_inv := pg_temp.invoice('inv-identify');
  perform pg_temp.assert_true(v_receipt.invoice_id = v_inv.id and v_receipt.application_status = 'aplicado'
    and v_receipt.client_markbox = 'DTD-0467' and v_receipt.client_name = 'Cliente 0467'
    and v_receipt.identified_at is not null and v_receipt.received_at = date '2026-05-20'
    and v_receipt.fund_class = 'local_revenue', 'el recibo queda aplicado con snapshots y fecha original');
  perform pg_temp.assert_true(v_inv.paid_amount = 800 and v_inv.status = 'parcial', 'la factura sube a 800');
  perform pg_temp.assert_true(v_result @> jsonb_build_object('receipt_code', 'R-SEED-0003',
    'invoice_code', 'F-IDENTIFY', 'amount', 800, 'currency', 'USD', 'received_at', '2026-05-20',
    'paid_amount', 800, 'status', 'parcial', 'fully_paid', false), 'resultado de la identificación');
  perform pg_temp.assert_true(exists(select 1 from public.entity_audit_log a where a.entity_id = v_receipt.id
    and a.event_type = 'payment_identified'), 'D2 audita la identificación');

  perform pg_temp.expect_rejected('identificar dos veces', 'accounting-A',
    pg_temp.identify_sql('rec-sinref', 'inv-edge'), 'PAYMENT_RECEIPT_APPLIED', '23514');
  perform pg_temp.expect_rejected('moneda distinta', 'accounting-A',
    pg_temp.identify_sql('rec-sinref-ves', 'inv-edge'), 'PAYMENT_CURRENCY', '23514');
  perform pg_temp.expect_rejected('supera el saldo', 'accounting-A',
    pg_temp.identify_sql('rec-sinref-big', 'inv-edge'), 'PAYMENT_EXCEEDS_BALANCE', '23514');
  perform pg_temp.expect_rejected('factura pagada', 'accounting-A',
    pg_temp.identify_sql('rec-sinref-big', 'inv-paid'), 'PAYMENT_INVOICE_PAID', '23514');
  perform pg_temp.expect_rejected('factura anulada', 'accounting-A',
    pg_temp.identify_sql('rec-sinref-big', 'inv-void'), 'PAYMENT_STATE', '23514');
  perform pg_temp.expect_rejected('rol comercial', 'commercial-A',
    pg_temp.identify_sql('rec-sinref-big', 'inv-edge'), 'PAYMENT_FORBIDDEN', '42501');
  perform pg_temp.expect_rejected('recibo de otro tenant', 'accounting-B',
    pg_temp.identify_sql('rec-sinref-big', 'inv-B'), 'PAYMENT_RECEIPT_NOT_FOUND', 'P0002');
end;
$identify$;

-- 7. Anulación: marca con motivo D2, baja el pagado y recalcula, junta.
do $void$
declare v_result jsonb; v_receipt uuid; v_inv public.invoices;
begin
  -- El primer cobro de F-OPEN (300) sobre la factura pagada 1000/1000.
  select id into v_receipt from public.payment_receipts
  where invoice_id = pg_temp.fixture_id('inv-open') and amount = 300;
  v_result := pg_temp.as_actor('accounting-A', pg_temp.void_sql(v_receipt));
  v_inv := pg_temp.invoice('inv-open');
  perform pg_temp.assert_true((select deleted_at is not null from public.payment_receipts where id = v_receipt),
    'el recibo queda anulado');
  perform pg_temp.assert_true(v_inv.paid_amount = 700 and v_inv.status = 'parcial', 'pagada 1000 → parcial 700');
  perform pg_temp.assert_true(v_result @> jsonb_build_object('receipt_id', v_receipt, 'invoice_id', v_inv.id,
    'paid_amount', 700, 'status', 'parcial'), 'resultado de la anulación');
  perform pg_temp.assert_true(exists(select 1 from public.entity_audit_log a where a.entity_id = v_receipt
      and a.event_type = 'payment_voided' and a.reason = 'Pago devuelto al cliente')
    and exists(select 1 from public.entity_audit_log a where a.entity_id = v_inv.id
      and a.event_type = 'invoice_payment_registered' and a.reason = 'Pago devuelto al cliente'),
    'el motivo humano queda en el evento del recibo y en el de la factura');

  perform pg_temp.expect_rejected('anular dos veces', 'accounting-A', pg_temp.void_sql(v_receipt),
    'PAYMENT_RECEIPT_VOIDED', '23514');
  perform pg_temp.expect_rejected('motivo corto', 'accounting-A',
    pg_temp.void_sql(pg_temp.fixture_id('rec-reapply'), 'no'),
    'audit: reason debe tener entre 4 y 1000 caracteres', '22023');
  perform pg_temp.expect_rejected('rol comercial', 'commercial-A', pg_temp.void_sql(pg_temp.fixture_id('rec-reapply')),
    'PAYMENT_FORBIDDEN', '42501');
  perform pg_temp.expect_rejected('recibo de otro tenant', 'accounting-B',
    pg_temp.void_sql(pg_temp.fixture_id('rec-reapply')), 'PAYMENT_RECEIPT_NOT_FOUND', 'P0002');

  -- Hasta cero: parcial 400 → emitida 0.
  perform pg_temp.as_actor('accounting-A', pg_temp.void_sql(pg_temp.fixture_id('rec-reapply')));
  v_inv := pg_temp.invoice('inv-reapply');
  perform pg_temp.assert_true(v_inv.paid_amount = 0 and v_inv.status = 'emitida', 'parcial 400 → emitida 0');

  -- El bug que se corrige: void_invoice_with_audit_reason (0294) anula una
  -- factura parcial con recibos; anular después su recibo NO la revive.
  perform pg_temp.as_actor('accounting-A', pg_temp.void_sql(pg_temp.fixture_id('rec-void')));
  v_inv := pg_temp.invoice('inv-void');
  perform pg_temp.assert_true(v_inv.paid_amount = 0 and v_inv.status = 'anulada',
    'la factura anulada conserva su estado y sólo baja el pagado');

  -- Un sin-ref no tiene factura: sólo se anula el recibo.
  v_result := pg_temp.as_actor('accounting-A', pg_temp.void_sql(pg_temp.fixture_id('rec-sinref-void')));
  perform pg_temp.assert_true(v_result->'invoice_id' = 'null'::jsonb and v_result->'paid_amount' = 'null'::jsonb
    and (select deleted_at is not null from public.payment_receipts where id = pg_temp.fixture_id('rec-sinref-void')),
    'anular un sin-ref no toca ninguna factura');
end;
$void$;

-- 8. anon y service_role no pueden llamar a las RPC.
do $acl$
declare v_state text;
begin
  begin
    perform pg_temp.as_actor('accounting-A', pg_temp.cobro_sql('inv-edge', 1), 'anon');
  exception when others then get stacked diagnostics v_state = returned_sqlstate;
  end;
  perform pg_temp.assert_true(v_state = '42501', 'anon no ejecuta register_collection_receipt');
  v_state := null;
  begin
    perform pg_temp.as_actor('accounting-A', pg_temp.void_sql(pg_temp.fixture_id('rec-sinref-big')), 'service_role');
  exception when others then get stacked diagnostics v_state = returned_sqlstate;
  end;
  perform pg_temp.assert_true(v_state = '42501', 'service_role no ejecuta void_collection_receipt');
end;
$acl$;

select 'TEST 0467 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
