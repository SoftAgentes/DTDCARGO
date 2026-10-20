\set ON_ERROR_STOP on
-- SDD-0573 · Contrato de 0497: anular una factura revierte su asiento de venta,
-- en la misma transacción. Fixture sintético aislado; no ejecutar sobre una DB
-- real. Es el del contrato 0467_cobro_factura_atomico.test.sql (facturas,
-- contabilidad, cobranzas, RLS y auditoría D2 con 0290 y 0294), más el cierre
-- de período (0133) y el cierre con superclave (0493), y después 0497.
-- Termina en ROLLBACK.
-- RED: psql -v apply_fix=false -f /sb/tests/0497_reverso_al_anular_factura.test.sql
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
do $fixture_guard$
begin
  if to_regclass('public.invoices') is not null or to_regclass('public.tenants') is not null
     or to_regclass('public.entity_audit_log') is not null then
    raise exception 'TEST 0497: fixture rechazada, la base ya contiene objetos de aplicación';
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

-- 0493 exige los triggers del cierre con el search_path de 0210 y la matriz de
-- módulos de 0357.
create table public.studio_role_module_overrides (
  tenant_id uuid not null references public.tenants(id), role text not null, module_id text not null,
  can_view boolean, can_edit boolean, primary key (tenant_id, role, module_id)
);
\ir ../migrations/0133_period_close.sql
alter function public.journal_entries_validate_closing() set search_path = public;
alter function public.journal_lines_validate_closing() set search_path = public;
\ir ../migrations/0493_cierre_contable_superclave.sql
\if :apply_fix
\ir ../migrations/0497_reverso_al_anular_factura.sql
\endif

create function pg_temp.fixture_id(p_label text) returns uuid language sql immutable as $$
  select md5('0497-synthetic-' || p_label)::uuid
$$;

insert into auth.users (id)
select pg_temp.fixture_id(u) from unnest(array['accounting-A', 'admin-A', 'commercial-A', 'accounting-B']) u;
insert into public.tenants (id, slug, display_name) values
  (pg_temp.fixture_id('tenant-A'), 'tenant-a-0497', 'Tenant A 0497'),
  (pg_temp.fixture_id('tenant-B'), 'tenant-b-0497', 'Tenant B 0497');
insert into public.user_tenants (user_id, tenant_id, role)
select pg_temp.fixture_id(u), pg_temp.fixture_id(t), r from (values
  ('accounting-A', 'tenant-A', 'accounting'), ('admin-A', 'tenant-A', 'admin'),
  ('commercial-A', 'tenant-A', 'commercial'), ('accounting-B', 'tenant-B', 'accounting')) v(u, t, r);

-- Las cuentas del asiento de venta (invoice-posting.ts) y una caja.
insert into public.accounts (id, tenant_id, code, name, type, is_postable)
select pg_temp.fixture_id(v.l), pg_temp.fixture_id('tenant-A'), v.code, v.l, v.type::public.acct_type, true
from (values ('clientes', '1.1.2', 'A'), ('ventas', '4.5', 'I'), ('iva', '2.1.5', 'P'), ('caja', '1.1.1.1', 'A')) v(l, code, type);

-- Una factura por escenario.
insert into public.invoices (id, tenant_id, invoice_code, client_markbox, client_name, currency,
  base_amount, iva_amount, total_amount, paid_amount, status)
select pg_temp.fixture_id(v.l), pg_temp.fixture_id(v.t), v.code, 'DTD-0497', 'Cliente 0497', 'USD',
  v.base, v.iva, v.base + v.iva, v.paid, v.status::public.invoice_status
from (values
  ('inv-abierta', 'tenant-A', 'F-0497-01', 1000, 160, 0, 'emitida'),
  ('inv-cerrada', 'tenant-A', 'F-0497-02', 500, 0, 0, 'emitida'),
  ('inv-recibo', 'tenant-A', 'F-0497-03', 300, 0, 100, 'parcial'),
  ('inv-credito', 'tenant-A', 'F-0497-04', 400, 0, 80, 'parcial'),
  ('inv-borrador', 'tenant-A', 'F-0497-05', 200, 0, 0, 'borrador'),
  ('inv-pagada', 'tenant-A', 'F-0497-06', 200, 0, 200, 'pagada'),
  ('inv-doble', 'tenant-A', 'F-0497-07', 200, 0, 0, 'emitida'),
  ('inv-descuadre', 'tenant-A', 'F-0497-08', 200, 0, 0, 'emitida'),
  ('inv-recibo-anulado', 'tenant-A', 'F-0497-09', 250, 0, 0, 'emitida'),
  ('inv-futuro', 'tenant-A', 'F-0497-10', 300, 0, 0, 'emitida'),
  ('inv-B', 'tenant-B', 'F-0497-B', 100, 0, 0, 'emitida')) v(l, t, code, base, iva, paid, status);

-- Los asientos de venta, como los escribe invoice-posting.ts.
insert into public.journal_entries (id, tenant_id, entry_code, entry_date, memo, status, source, invoice_id, posted_at)
select pg_temp.fixture_id(v.l), pg_temp.fixture_id('tenant-A'), v.code, v.d::date, 'Factura ' || v.inv_code,
  'asentado', 'invoice', pg_temp.fixture_id(v.inv), now()
from (values
  ('e-abierta', 'A-2026-0101', '2026-10-01', 'inv-abierta', 'F-0497-01'),
  ('e-cerrada', 'A-2026-0102', '2026-01-15', 'inv-cerrada', 'F-0497-02'),
  ('e-doble-1', 'A-2026-0103', '2026-10-02', 'inv-doble', 'F-0497-07'),
  ('e-doble-2', 'A-2026-0104', '2026-10-03', 'inv-doble', 'F-0497-07'),
  ('e-descuadre', 'A-2026-0105', '2026-10-04', 'inv-descuadre', 'F-0497-08'),
  ('e-recibo-anulado', 'A-2026-0106', '2026-10-05', 'inv-recibo-anulado', 'F-0497-09'),
  ('e-futuro', 'A-2026-0107', '2026-10-06', 'inv-futuro', 'F-0497-10')) v(l, code, d, inv, inv_code);
insert into public.journal_lines (entry_id, account_id, debit, credit, line_memo)
select pg_temp.fixture_id(v.e), pg_temp.fixture_id(v.a), v.d, v.c, v.m
from (values
  ('e-abierta', 'clientes', 1160, 0, 'Por cobrar F-0497-01'), ('e-abierta', 'ventas', 0, 1000, 'Ingreso'),
  ('e-abierta', 'iva', 0, 160, 'IVA por pagar'),
  ('e-cerrada', 'clientes', 500, 0, null), ('e-cerrada', 'ventas', 0, 500, null),
  ('e-doble-1', 'clientes', 200, 0, null), ('e-doble-1', 'ventas', 0, 200, null),
  ('e-doble-2', 'clientes', 200, 0, null), ('e-doble-2', 'ventas', 0, 200, null),
  ('e-descuadre', 'clientes', 200, 0, null), ('e-descuadre', 'ventas', 0, 150, null),
  ('e-recibo-anulado', 'clientes', 250, 0, null), ('e-recibo-anulado', 'ventas', 0, 250, null),
  ('e-futuro', 'clientes', 300, 0, null), ('e-futuro', 'ventas', 0, 300, null)) v(e, a, d, c, m);

-- Un recibo vivo y uno anulado (el anulado no cuenta).
insert into public.payment_receipts (id, tenant_id, receipt_code, invoice_id, client_markbox, client_name,
  amount, cash_account_id, received_at, deleted_at)
values
  (pg_temp.fixture_id('r-vivo'), pg_temp.fixture_id('tenant-A'), 'R-0497-01', pg_temp.fixture_id('inv-recibo'),
   'DTD-0497', 'Cliente 0497', 100, pg_temp.fixture_id('caja'), '2026-10-06', null),
  (pg_temp.fixture_id('r-anulado'), pg_temp.fixture_id('tenant-A'), 'R-0497-02', pg_temp.fixture_id('inv-recibo-anulado'),
   'DTD-0497', 'Cliente 0497', 250, pg_temp.fixture_id('caja'), '2026-10-06', now());

-- Enero cerrado (como postgres: el historial queda sin usuario).
insert into public.accounting_settings (tenant_id, closing_date)
values (pg_temp.fixture_id('tenant-A'), '2026-01-31');

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0497: %', p_label; end if;
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
create function pg_temp.void_sql(p_inv text, p_motivo text default 'Factura emitida por error') returns text language sql as $$
  select format('select to_jsonb(public.void_invoice_with_audit_reason(%L::uuid, %L))', pg_temp.fixture_id(p_inv), p_motivo)
$$;
-- Anula como un actor y devuelve lo que devolvió la RPC (true o false), o el
-- error como texto: así una regla rota cae en SU aserción, no en el runner.
create function pg_temp.anular(p_actor text, p_inv text) returns text language plpgsql as $$
begin
  return (pg_temp.as_actor(p_actor, pg_temp.void_sql(p_inv)))::text;
exception when others then
  return 'ERROR: ' || sqlerrm;
end;
$$;
create function pg_temp.estado(p_inv text) returns text language sql as $$
  select status::text from public.invoices where id = pg_temp.fixture_id(p_inv)
$$;
create function pg_temp.hoy() returns date language sql as $$
  select (now() at time zone 'America/Caracas')::date
$$;

-- ── 0. La migración está (control rojo: sin 0497 falla acá) ──
select pg_temp.assert_true(exists (select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'journal_entries' and column_name = 'reverses_entry_id'),
  'existe journal_entries.reverses_entry_id');
-- Después del §0: nombran la columna nueva, y una función sql se valida al crearla.
create function pg_temp.reverso_de(p_entry text) returns uuid language sql as $$
  select je.id from public.journal_entries je where je.reverses_entry_id = pg_temp.fixture_id(p_entry)
$$;
-- Saldo por cuenta del par original + reverso: tiene que dar cero en todas.
create function pg_temp.neto_del_par(p_entry text) returns numeric language sql as $$
  select coalesce(sum(abs(s.neto)), 0) from (
    select l.account_id, sum(l.debit - l.credit) as neto
    from public.journal_lines l
    where l.entry_id in (pg_temp.fixture_id(p_entry), pg_temp.reverso_de(p_entry))
    group by l.account_id) s
$$;

-- ── 1. Quién anula y con qué motivo ──
select pg_temp.assert_true(pg_temp.error_of('commercial-A', pg_temp.void_sql('inv-abierta'))
  = '42501|Solo admin o contabilidad anulan una factura.|dtd-anular', 'commercial no anula una factura');
select pg_temp.assert_true(pg_temp.anular('accounting-B', 'inv-abierta') = 'false',
  'otro tenant no anula la factura (no la encuentra)');
select pg_temp.assert_true(pg_temp.error_of('accounting-A', pg_temp.void_sql('inv-abierta', 'no'))
  = '22023|audit: reason debe tener entre 4 y 1000 caracteres|', 'el motivo corto se rechaza como en la 0294');
select pg_temp.assert_true(pg_temp.estado('inv-abierta') = 'emitida' and pg_temp.reverso_de('e-abierta') is null,
  'los rechazos no cambian nada');

-- ── 2. Período abierto: anula y crea el contra-asiento ──
select pg_temp.assert_true(pg_temp.anular('accounting-A', 'inv-abierta') = 'true', 'contabilidad anula la factura');
select pg_temp.assert_true(pg_temp.estado('inv-abierta') = 'anulada', 'la factura queda anulada');
select pg_temp.assert_true((select je.source = 'invoice_reversal' and je.status = 'asentado'
    and je.invoice_id = pg_temp.fixture_id('inv-abierta') and je.posted_at is not null and je.deleted_at is null
    and je.entry_date = pg_temp.hoy()
  from public.journal_entries je where je.id = pg_temp.reverso_de('e-abierta')),
  'el reverso es un asiento asentado de la factura, fechado hoy en Caracas');
select pg_temp.assert_true((select je.memo from public.journal_entries je where je.id = pg_temp.reverso_de('e-abierta'))
  = 'Reverso de la factura F-0497-01 (asiento A-2026-0101 del 2026-10-01). Motivo: Factura emitida por error',
  'el memo cita la factura, el asiento original, su fecha y el motivo');
select pg_temp.assert_true(pg_temp.neto_del_par('e-abierta') = 0
  and (select count(*) from public.journal_lines where entry_id = pg_temp.reverso_de('e-abierta')) = 3,
  'el reverso tiene las mismas líneas al revés: el par suma cero en cada cuenta');
select pg_temp.assert_true((select bool_and(l.line_memo like 'Reverso: %') from public.journal_lines l
  where l.entry_id = pg_temp.reverso_de('e-abierta')), 'las líneas del reverso dicen que son reverso');
select pg_temp.assert_true((select status::text from public.journal_entries where id = pg_temp.fixture_id('e-abierta')) = 'asentado',
  'el asiento original no se toca');
select pg_temp.assert_true(exists (select 1 from public.entity_audit_log
  where entity_type = 'invoice' and entity_id = pg_temp.fixture_id('inv-abierta') and event_type = 'invoice_voided'
    and reason = 'Factura emitida por error'), 'la anulación queda en la auditoría D2 con su motivo');
select pg_temp.assert_true(pg_temp.anular('accounting-A', 'inv-abierta') = 'false',
  'anular otra vez devuelve false');
select pg_temp.assert_true((select count(*) from public.journal_entries where reverses_entry_id = pg_temp.fixture_id('e-abierta')) = 1,
  'y no crea un segundo reverso');

-- ── 3. Período cerrado: el reverso va al período abierto, sin tocar el cierre ──
select pg_temp.assert_true(pg_temp.anular('admin-A', 'inv-cerrada') = 'true', 'el admin anula una factura de enero cerrado');
select pg_temp.assert_true((select je.entry_date = pg_temp.hoy()
    and je.memo = 'Reverso de la factura F-0497-02 (asiento A-2026-0102 del 2026-01-15). Motivo: Factura emitida por error — período cerrado: el reverso va en el período abierto.'
  from public.journal_entries je where je.id = pg_temp.reverso_de('e-cerrada')),
  'el reverso de un asiento de período cerrado va hoy, con el memo del período cerrado');
select pg_temp.assert_true((select status::text from public.journal_entries where id = pg_temp.fixture_id('e-cerrada')) = 'asentado'
  and pg_temp.neto_del_par('e-cerrada') = 0, 'el original de enero no se toca y el par suma cero');
select pg_temp.assert_true((select closing_date from public.accounting_settings where tenant_id = pg_temp.fixture_id('tenant-A')) = '2026-01-31'
  and not exists (select 1 from public.accounting_closing_exceptions), 'el cierre sigue igual y no se usó ninguna excepción de la 0493');
-- El cierre sigue mandando: un reverso a mano dentro del período cerrado choca.
select pg_temp.assert_true(split_part(pg_temp.err(format(
  'insert into public.journal_entries (tenant_id, entry_code, entry_date, status, source, invoice_id, reverses_entry_id) '
  || 'values (%L::uuid, ''A-2026-0900'', ''2026-01-20'', ''borrador'', ''invoice_reversal'', %L::uuid, %L::uuid)',
  pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('inv-doble'), pg_temp.fixture_id('e-doble-1'))), '|', 1) = '23514',
  'un reverso dentro del período cerrado lo rechaza el cierre (0133/0493)');

-- ── 4. Cobros vivos y abonos sin recibo: no se anula ──
select pg_temp.assert_true(pg_temp.error_of('accounting-A', pg_temp.void_sql('inv-recibo'))
  = '55000|La factura tiene 1 cobro(s) vivo(s): anúlalos primero en Cobranzas.|dtd-anular', 'con un recibo vivo no se anula');
select pg_temp.assert_true(pg_temp.estado('inv-recibo') = 'parcial', 'y la factura sigue como estaba');
select pg_temp.assert_true(pg_temp.error_of('accounting-A', pg_temp.void_sql('inv-credito'))
  = '55000|La factura tiene 80.00 aplicado sin recibo (un crédito de referido o un reporte de pago): revierte el crédito antes de anular.|dtd-anular',
  'con un abono sin recibo (crédito o reporte) no se anula');
select pg_temp.assert_true(pg_temp.anular('accounting-A', 'inv-recibo-anulado') = 'true'
  and pg_temp.reverso_de('e-recibo-anulado') is not null, 'un recibo anulado no cuenta: la factura se anula y se revierte');

-- ── 5. Sin asiento, pagada, inconsistencias ──
select pg_temp.assert_true(pg_temp.anular('accounting-A', 'inv-borrador') = 'true'
  and not exists (select 1 from public.journal_entries where invoice_id = pg_temp.fixture_id('inv-borrador')),
  'un borrador sin asiento se anula sin reverso');
select pg_temp.assert_true(pg_temp.anular('accounting-A', 'inv-pagada') = 'false' and pg_temp.estado('inv-pagada') = 'pagada',
  'una pagada no se anula (false, como en la 0294)');
select pg_temp.assert_true(pg_temp.error_of('accounting-A', pg_temp.void_sql('inv-doble'))
  = '55000|La factura tiene 2 asientos de venta vivos: revisa el libro diario antes de anular.|dtd-anular',
  'con dos asientos de venta vivos no se anula');
select pg_temp.assert_true(pg_temp.error_of('accounting-A', pg_temp.void_sql('inv-descuadre'))
  = '55000|El asiento de venta A-2026-0105 no cuadra: revisa el libro diario antes de anular.|dtd-anular',
  'con un asiento de venta que no cuadra no se anula');
select pg_temp.assert_true(pg_temp.estado('inv-doble') = 'emitida' and pg_temp.estado('inv-descuadre') = 'emitida',
  'esos rechazos no cambian la factura');

-- ── 6. El vínculo del reverso ──
select pg_temp.assert_true(split_part(pg_temp.err(format(
  'insert into public.journal_entries (tenant_id, entry_code, entry_date, status, source, invoice_id, reverses_entry_id) '
  || 'values (%L::uuid, ''A-2026-0901'', ''2026-10-10'', ''borrador'', ''invoice_reversal'', %L::uuid, %L::uuid)',
  pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('inv-abierta'), pg_temp.fixture_id('e-abierta'))), '|', 1) = '23505',
  'un asiento tiene un solo reverso');
select pg_temp.assert_true(split_part(pg_temp.err(format(
  'insert into public.journal_entries (tenant_id, entry_code, entry_date, status, source) '
  || 'values (%L::uuid, ''A-2026-0902'', ''2026-10-10'', ''borrador'', ''invoice_reversal'')',
  pg_temp.fixture_id('tenant-A'))), '|', 1) = '23514', 'un invoice_reversal sin el asiento que revierte se rechaza');
select pg_temp.assert_true(split_part(pg_temp.err(format(
  'insert into public.journal_entries (tenant_id, entry_code, entry_date, status, source, reverses_entry_id) '
  || 'values (%L::uuid, ''A-2026-0903'', ''2026-10-10'', ''borrador'', ''manual'', %L::uuid)',
  pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('e-futuro'))), '|', 1) = '23514', 'solo un invoice_reversal revierte un asiento');
select pg_temp.assert_true(split_part(pg_temp.err(format(
  'delete from public.journal_entries where id = %L::uuid', pg_temp.fixture_id('e-abierta'))), '|', 1) in ('23001', '23503'),
  'el original no se borra mientras exista su reverso');
-- (23001 en PGlite, 23503 en postgres:17: los dos son la clave foránea RESTRICT.)

-- ── 7. Un cierre a futuro: el reverso va al primer día abierto (cierre + 1) ──
update public.accounting_settings set closing_date = pg_temp.hoy() + 10
where tenant_id = pg_temp.fixture_id('tenant-A');
select pg_temp.assert_true(pg_temp.anular('accounting-A', 'inv-futuro') = 'true', 'con hoy dentro del cierre, se anula igual');
select pg_temp.assert_true((select je.entry_date = pg_temp.hoy() + 11
    and je.memo like '% — período cerrado: el reverso va en el período abierto.'
  from public.journal_entries je where je.id = pg_temp.reverso_de('e-futuro')),
  'el reverso va el primer día abierto (cierre + 1), con el memo del período cerrado');

-- ── 8. ACL ──
select pg_temp.assert_true(not has_function_privilege('anon', 'public.void_invoice_with_audit_reason(uuid,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.void_invoice_with_audit_reason(uuid,text)', 'EXECUTE'),
  'solo authenticated ejecuta la anulación');

select 'TEST 0497 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
