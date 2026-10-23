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

-- Legado idéntico ya presente ANTES de guardas: duplicidad y descuadre no se
-- reparan ni se fabrican desactivando triggers después de instalar0497.
-- Nuevos sujetos legados independientes: no reemplazan ninguna semilla vieja.
insert into public.invoices(id,tenant_id,invoice_code,client_markbox,client_name,currency,
  base_amount,iva_amount,total_amount,paid_amount,status,issued_at)
select pg_temp.fixture_id('i3b-'||label),pg_temp.fixture_id('tenant-A'),'F-I3B-'||label,
  'DTD-I3B','Cliente sintético','USD',100,0,100,0,'emitida','2026-10-10'
from unnest(array['legacy-draft','legacy-empty','history90','original-future','legacy-both']) label;
insert into public.journal_entries(id,tenant_id,entry_code,entry_date,memo,status,source,invoice_id,posted_at)
select pg_temp.fixture_id('i3b-entry-'||v.label),pg_temp.fixture_id('tenant-A'),v.code,
  case when v.label='original-future' then (now() at time zone 'America/Caracas')::date+20
       else date '2026-10-10' end,'Nota libre original I3B',v.status::public.entry_status,'invoice',
  pg_temp.fixture_id('i3b-'||v.invoice),case when v.status='asentado' then now() else null end
from (values
  ('legacy-draft','legacy-draft','I3B-LEG-DRAFT','borrador'),
  ('legacy-empty','legacy-empty','I3B-LEG-EMPTY','asentado'),
  ('history90','history90','I3B-HISTORY90','asentado'),
  ('original-future','original-future','I3B-FUTURE','asentado'),
  ('legacy-both','legacy-both','I3B-BOTH-POST','asentado'),
  ('legacy-both-draft','legacy-both','I3B-BOTH-DRAFT','borrador')) v(label,invoice,code,status);
insert into public.journal_lines(entry_id,account_id,debit,credit,line_memo)
select pg_temp.fixture_id('i3b-entry-'||label),pg_temp.fixture_id(account),debit,credit,'Nota libre línea I3B'
from (values ('history90','clientes',90,0),('history90','ventas',0,90),
  ('original-future','clientes',100,0),('original-future','ventas',0,100),
  ('legacy-both','clientes',100,0),('legacy-both','ventas',0,100)) v(label,account,debit,credit);
-- M2: dos sujetos NUEVOS previos a0497; no sustituyen legado ni apagan guardas.
insert into public.invoices(id,tenant_id,invoice_code,client_markbox,client_name,currency,
  base_amount,iva_amount,total_amount,paid_amount,status,issued_at)
select pg_temp.fixture_id('m2-'||label),pg_temp.fixture_id('tenant-A'),'F-M2-'||label,
  'DTD-M2-TEST','Cliente sintético M2','USD',100,0,100,0,'emitida',date '2026-10-10'
from unnest(array['draft-only','posted-and-draft']) label;
insert into public.journal_entries(id,tenant_id,entry_code,entry_date,memo,status,source,invoice_id,posted_at)
select pg_temp.fixture_id('m2-entry-'||label),pg_temp.fixture_id('tenant-A'),code,date '2026-10-10',
  'Legado sintético M2',status::public.entry_status,'invoice',pg_temp.fixture_id('m2-'||invoice),
  case when status='asentado' then now() else null end
from (values('draft-only','draft-only','M2-DRAFT-ONLY','borrador'),
  ('both-posted','posted-and-draft','M2-BOTH-POST','asentado'),
  ('both-draft','posted-and-draft','M2-BOTH-DRAFT','borrador')) v(label,invoice,code,status);
insert into public.journal_lines(entry_id,account_id,debit,credit,line_memo)
select pg_temp.fixture_id('m2-entry-'||label),pg_temp.fixture_id(account),debit,credit,'Línea sintética M2'
from (values('draft-only','clientes',100,0),('draft-only','ventas',0,100),
  ('both-posted','clientes',100,0),('both-posted','ventas',0,100),
  ('both-draft','clientes',100,0),('both-draft','ventas',0,100)) v(label,account,debit,credit);

\if :apply_fix
\ir ../migrations/0497_reverso_al_anular_factura.sql
\endif

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

-- M2/B1/M3: definiciones reales comunes al contrato normal y sus probes (§1).
-- Sólo TEST INVOKER; no se otorga EXECUTE a una autorizadora privada.
create function pg_temp.m2b1_context() returns jsonb language sql as $supp$
  select jsonb_build_object('auditReason',current_setting('dtd.audit_reason',true),
    'closingGucSqlNull',current_setting('dtd.excepcion_cierre',true) is null,
    'closingGucEmpty',current_setting('dtd.excepcion_cierre',true)='',
    'closingGucHasValue',nullif(current_setting('dtd.excepcion_cierre',true),'') is not null)
$supp$;
create function pg_temp.m2b1_snapshot() returns jsonb language sql as $supp$
  select jsonb_build_object(
    'invoices',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.invoices i),'[]'::jsonb),
    'entries',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.journal_entries e),'[]'::jsonb),
    'lines',coalesce((select jsonb_agg(to_jsonb(l) order by l.id) from public.journal_lines l),'[]'::jsonb),
    'receipts',coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from public.payment_receipts r),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.entity_audit_log a),'[]'::jsonb),
    'exceptions',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.accounting_closing_exceptions x),'[]'::jsonb),
    'closingEvents',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.accounting_closing_events e),'[]'::jsonb),
    'settings',coalesce((select jsonb_agg(to_jsonb(s) order by s.tenant_id) from public.accounting_settings s),'[]'::jsonb))
$supp$;
create function pg_temp.m2b1_redact(p_graph jsonb) returns jsonb language sql as $supp$
  select jsonb_set(p_graph,'{exceptions}',coalesce((select jsonb_agg(x.value-'nonce' order by x.value->>'id')
    from jsonb_array_elements(p_graph->'exceptions') x),'[]'::jsonb))
$supp$;
create function pg_temp.m2b1_graph(p_invoice uuid) returns jsonb language sql as $supp$
  select jsonb_build_object('invoice',(select to_jsonb(i) from public.invoices i where i.id=p_invoice),
    'entries',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.journal_entries e where e.invoice_id=p_invoice),'[]'::jsonb),
    'originals',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.journal_entries e where e.invoice_id=p_invoice and e.source='invoice'),'[]'::jsonb),
    'lines',coalesce((select jsonb_agg(to_jsonb(l) order by l.id) from public.journal_lines l where l.entry_id in
      (select e.id from public.journal_entries e where e.invoice_id=p_invoice)),'[]'::jsonb),
    'accounts',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.accounts a where a.id in
      (select l.account_id from public.journal_lines l where l.entry_id in(select e.id from public.journal_entries e where e.invoice_id=p_invoice))),'[]'::jsonb),
    'receipts',coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from public.payment_receipts r where r.invoice_id=p_invoice),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.entity_audit_log a where a.entity_id=p_invoice
      or a.entity_id in(select e.id from public.journal_entries e where e.invoice_id=p_invoice)
      or a.entity_id in(select r.id from public.payment_receipts r where r.invoice_id=p_invoice)),'[]'::jsonb),
    'orphanLines',coalesce((select jsonb_agg(to_jsonb(l) order by l.id) from public.journal_lines l where not exists
      (select 1 from public.journal_entries e where e.id=l.entry_id)),'[]'::jsonb),
    'orphanHeaders',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.journal_entries e
      where e.source in('invoice','invoice_reversal') and not exists(select 1 from public.invoices i where i.id=e.invoice_id)),'[]'::jsonb))
$supp$;
create function pg_temp.m2b1_attempt(p_actor text,p_command text,p_role text default 'authenticated')
returns jsonb language plpgsql as $supp$
declare value jsonb; state text; message text; detail text; hint text; context text;
  schema_value text; table_value text; column_value text; constraint_value text; datatype_value text;
begin
  begin
    value:=pg_temp.as_actor(p_actor,p_command,p_role);
    return jsonb_build_object('ok',true,'result',value,'command',p_command);
  exception when others then
    get stacked diagnostics state=returned_sqlstate,message=message_text,detail=pg_exception_detail,
      hint=pg_exception_hint,context=pg_exception_context,schema_value=schema_name,table_value=table_name,
      column_value=column_name,constraint_value=constraint_name,datatype_value=pg_datatype_name;
    return jsonb_build_object('ok',false,'command',p_command,'state',state,'message',message,'detail',detail,
      'hint',hint,'context',context,'schema',schema_value,'table',table_value,'column',column_value,
      'constraint',constraint_value,'datatype',datatype_value);
  end;
end;
$supp$;
create function pg_temp.m2_void_case(p_case text) returns jsonb language plpgsql as $supp$
declare v_invoice uuid:=pg_temp.fixture_id('m2-'||p_case); before_state jsonb; after_state jsonb; result jsonb;
  context_before jsonb; context_after jsonb; expected_headers integer;
begin
  perform pg_temp.assert_true(p_case in('draft-only','posted-and-draft'),'M2 sujeto nominal independiente');
  expected_headers:=case when p_case='draft-only' then 1 else 2 end;
  perform pg_temp.assert_true((select i.tenant_id=pg_temp.fixture_id('tenant-A') and i.currency='USD'
    and i.base_amount=100 and i.iva_amount=0 and i.total_amount=100 and i.paid_amount=0
    and i.status='emitida' and i.deleted_at is null and i.issued_at=date '2026-10-10'
    from public.invoices i where i.id=v_invoice),'M2 preimagen factura100 emitida sin cobro: '||p_case);
  perform pg_temp.assert_true((select count(*)=expected_headers and bool_and(e.tenant_id=pg_temp.fixture_id('tenant-A')
    and e.source='invoice' and e.deleted_at is null and e.entry_date=date '2026-10-10' and e.entry_code is not null)
    and count(*) filter(where e.status='borrador')=1
    and count(*) filter(where e.status='asentado')=expected_headers-1 from public.journal_entries e where e.invoice_id=v_invoice),
    'M2 cabeceras positivas borrador y original dedicados: '||p_case);
  perform pg_temp.assert_true(not exists(select 1 from public.journal_entries e where e.invoice_id=v_invoice
    and not exists(select 1 from public.entity_audit_log a where a.entity_id=e.id))
    and not exists(select 1 from public.journal_entries e where e.invoice_id=v_invoice and
      (select count(*)<>2 or sum(l.debit)<>100 or sum(l.credit)<>100
       or not bool_and(a.tenant_id=pg_temp.fixture_id('tenant-A') and a.is_postable
         and ((a.code='1.1.2' and l.debit=100 and l.credit=0) or(a.code='4.5' and l.debit=0 and l.credit=100)))
       from public.journal_lines l join public.accounts a on a.id=l.account_id where l.entry_id=e.id)),
    'M2 líneas100 propias y auditoría positiva por cabecera: '||p_case);
  before_state:=pg_temp.m2b1_snapshot();context_before:=pg_temp.m2b1_context();
  result:=pg_temp.m2b1_attempt('accounting-A',pg_temp.void_sql('m2-'||p_case,'M2 motivo sintético válido'));
  after_state:=pg_temp.m2b1_snapshot();context_after:=pg_temp.m2b1_context();
  raise notice '0573_M2_RAW %',jsonb_build_object('case',p_case,'before',pg_temp.m2b1_redact(before_state),
    'after',pg_temp.m2b1_redact(after_state),'result',result,'contextBefore',context_before,'contextAfter',context_after);
  perform pg_temp.assert_true(result->>'ok'='false' and result->>'state'='55000'
    and result->>'message'='Los antecedentes de venta requieren revisión.' and result->>'hint'='dtd-anular',
    'M2 void55000 por borrador: '||p_case);
  perform pg_temp.assert_true(after_state=before_state and pg_temp.m2b1_graph(v_invoice)->'orphanLines'='[]'::jsonb
    and pg_temp.m2b1_graph(v_invoice)->'orphanHeaders'='[]'::jsonb,'M2 rechazo conserva grafo entero: '||p_case);
  return result;
end;
$supp$;
create function pg_temp.m2b1_assert_sale(p_invoice uuid,p_reverse boolean,p_label text) returns jsonb language plpgsql as $supp$
declare graph jsonb; original uuid; reversal uuid;
begin
  graph:=pg_temp.m2b1_graph(p_invoice);
  perform pg_temp.assert_true((select tenant_id=pg_temp.fixture_id('tenant-A') and currency='USD'
    and base_amount=100 and iva_amount=0 and total_amount=100 and paid_amount=0 and deleted_at is null
    and status=case when p_reverse then 'anulada'::public.invoice_status else 'emitida'::public.invoice_status end
    from public.invoices where id=p_invoice),'M2B1M3 factura positiva: '||p_label);
  select id into strict original from public.journal_entries where invoice_id=p_invoice and source='invoice';
  select id into reversal from public.journal_entries where reverses_entry_id=original;
  perform pg_temp.assert_true(jsonb_array_length(graph->'entries')=case when p_reverse then 2 else 1 end
    and jsonb_array_length(graph->'lines')=case when p_reverse then 4 else 2 end
    and (reversal is not null)=p_reverse and graph->'receipts'='[]'::jsonb
    and graph->'orphanLines'='[]'::jsonb and graph->'orphanHeaders'='[]'::jsonb,
    'M2B1M3 multiplicidad sin huérfanos: '||p_label);
  perform pg_temp.assert_true(not exists(select 1 from public.journal_entries e where e.invoice_id=p_invoice
    and (e.tenant_id<>pg_temp.fixture_id('tenant-A') or e.status<>'asentado' or e.deleted_at is not null
      or e.posted_at is null or e.entry_code is null or e.entry_date is null))
    and (select count(*)=2 and sum(l.debit)=100 and sum(l.credit)=100 and bool_and(
      a.tenant_id=pg_temp.fixture_id('tenant-A') and a.is_postable and
      ((a.code='1.1.2' and l.debit=100 and l.credit=0) or(a.code='4.5' and l.debit=0 and l.credit=100)))
      from public.journal_lines l join public.accounts a on a.id=l.account_id where l.entry_id=original)
    and exists(select 1 from public.entity_audit_log where entity_id=original and event_type='journal_entry_posted'),
    'M2B1M3 original nominal100 y auditoría reales: '||p_label);
  if p_reverse then
    perform pg_temp.assert_true((select source='invoice_reversal' and invoice_id=p_invoice and reverses_entry_id=original
      from public.journal_entries where id=reversal)
      and not exists((select account_id,debit,credit from public.journal_lines where entry_id=original
        except all select account_id,credit,debit from public.journal_lines where entry_id=reversal)
        union all(select account_id,credit,debit from public.journal_lines where entry_id=reversal
        except all select account_id,debit,credit from public.journal_lines where entry_id=original))
      and exists(select 1 from public.entity_audit_log where entity_id=reversal and event_type='journal_entry_posted')
      and exists(select 1 from public.entity_audit_log where entity_id=p_invoice and event_type='invoice_voided'),
      'M2B1M3 espejo100 y auditoría de anulación completos: '||p_label);
  end if;
  return graph;
end;
$supp$;
create function pg_temp.m2b1_fresh_sale(p_label text) returns uuid language plpgsql as $supp$
declare v_invoice uuid:=pg_temp.fixture_id('m2b1m3-'||p_label); result jsonb;
begin
  insert into public.invoices(id,tenant_id,invoice_code,client_markbox,client_name,currency,
    base_amount,iva_amount,total_amount,paid_amount,status,issued_at)
  values(v_invoice,pg_temp.fixture_id('tenant-A'),'F-0573-'||p_label,'DTD-0573-TEST','Cliente sintético','USD',
    100,0,100,0,'emitida',date '2026-10-10');
  result:=pg_temp.as_actor(null,format('select public.post_invoice_journal_entry_atomic(%L::uuid,%L::uuid)',
    pg_temp.fixture_id('tenant-A'),v_invoice),'service_role');
  perform pg_temp.assert_true(result->>'outcome'='posted','M2B1M3 posting fresco real: '||p_label);
  perform pg_temp.m2b1_assert_sale(v_invoice,false,p_label);
  return v_invoice;
end;
$supp$;

create temporary sequence m2b1_seen_manual minvalue 0 start 0;
create temporary sequence m2b1_seen_original minvalue 0 start 0;
create temporary sequence m2b1_seen_reverso minvalue 0 start 0;
select setval('pg_temp.m2b1_seen_manual',0,true),setval('pg_temp.m2b1_seen_original',0,true),setval('pg_temp.m2b1_seen_reverso',0,true);
create temporary table m2b1_targets(label text primary key,id uuid unique not null,reason text not null);
create temporary table m2b1_settings_before as select closing_date,closing_mode from public.accounting_settings where false;
create function pg_temp.m2b1_test_key() returns text language sql immutable as $supp$
  select 'SOLO-TEST-0573-SUPERCLAVE'
$supp$;
create function pg_temp.m2b1_observe() returns trigger language plpgsql security invoker set search_path='' as $supp$
declare target record; exception_row public.accounting_closing_exceptions%rowtype; match_count bigint;
  expected_owner text; closing date; observed bigint; sequence_name text;
begin
  select * into target from pg_temp.m2b1_targets t where t.id=old.id;
  if not found then return new; end if;
  select pg_catalog.pg_get_userbyid(p.proowner) into strict expected_owner from pg_catalog.pg_proc p
    where p.oid='public.anular_asiento_en_cierre(uuid,text,text)'::pg_catalog.regprocedure;
  select closing_date into strict closing from public.accounting_settings where tenant_id=old.tenant_id;
  if tg_op<>'UPDATE' or current_user is distinct from expected_owner or old.status<>'asentado'
    or new.status<>'anulado' or new.id is distinct from old.id
    or (to_jsonb(new)-'status'-'updated_at') is distinct from (to_jsonb(old)-'status'-'updated_at')
    or old.tenant_id is distinct from pg_temp.fixture_id('tenant-A') or auth.uid() is distinct from pg_temp.fixture_id('accounting-A')
    or closing is null or old.entry_date>closing then raise exception 'TEST B1: contexto real del observador inválido'; end if;
  select count(*) into match_count from public.accounting_closing_exceptions x
    where x.entry_id=old.id and x.tenant_id=old.tenant_id and x.user_id=auth.uid()
      and x.operation='anular' and x.authorized_by='superclave' and x.entry_code=old.entry_code
      and x.entry_date=old.entry_date and x.closing_date=closing and x.reason=target.reason
      and x.amount_before=100 and x.amount_after=0
      and x.nonce=nullif(pg_catalog.current_setting('dtd.excepcion_cierre',true),'')
      and x.txid=pg_catalog.txid_current();
  if match_count<>1 or nullif(pg_catalog.current_setting('dtd.excepcion_cierre',true),'') is null
    or public.excepcion_al_cierre_vigente(old.id) is distinct from true then
    raise exception 'TEST B1: excepción singular nonce/GUC/txid no acreditada'; end if;
  select x.* into strict exception_row from public.accounting_closing_exceptions x
    where x.entry_id=old.id and x.nonce=nullif(pg_catalog.current_setting('dtd.excepcion_cierre',true),'')
      and x.txid=pg_catalog.txid_current();
  sequence_name:='pg_temp.m2b1_seen_'||target.label;
  observed:=pg_catalog.nextval(sequence_name::pg_catalog.regclass);
  raise notice '0573_B1_AUTHENTIC_WITNESS %',jsonb_build_object('case',target.label,'target',old.id,
    'exceptionId',exception_row.id,'txid',exception_row.txid::text,'actor',exception_row.user_id,
    'tenant',exception_row.tenant_id,'operation',exception_row.operation,'authorizedBy',exception_row.authorized_by,
    'entryDate',exception_row.entry_date,'closingDate',exception_row.closing_date,'observed',observed,
    'matchCount',match_count,'nonceMatchesGuc',exception_row.nonce=current_setting('dtd.excepcion_cierre',true),
    'sameTxid',exception_row.txid=txid_current(),'validator',public.excepcion_al_cierre_vigente(old.id),
    'contextOwner',current_user,'expectedOwner',expected_owner);
  return new;
end;
$supp$;
create trigger a0573_m2b1_observe before update on public.journal_entries for each row execute function pg_temp.m2b1_observe();
create function pg_temp.m2b1_setup() returns void language plpgsql as $supp$
declare v_invoice uuid; original uuid; reversal uuid; manual uuid:=pg_temp.fixture_id('m2b1-manual'); result jsonb; close_date date;
begin
  perform pg_temp.assert_true(not exists(select 1 from pg_temp.m2b1_targets)
    and not exists(select 1 from public.accounting_closing_secrets where tenant_id=pg_temp.fixture_id('tenant-A')),
    'B1 setup único y clave TEST inicialmente ausente');
  insert into pg_temp.m2b1_settings_before select closing_date,closing_mode from public.accounting_settings where tenant_id=pg_temp.fixture_id('tenant-A');
  perform pg_temp.assert_true((select count(*)=1 from pg_temp.m2b1_settings_before),'B1 configuración previa singular');
  update public.accounting_settings set closing_date=null,closing_mode='superclave' where tenant_id=pg_temp.fixture_id('tenant-A');
  v_invoice:=pg_temp.m2b1_fresh_sale('b1-pair');
  result:=pg_temp.as_actor('accounting-A',format('select to_jsonb(public.void_invoice_with_audit_reason(%L::uuid,''B1 crear par sintético''))',v_invoice));
  perform pg_temp.assert_true(result='true'::jsonb,'B1 par fresco por void público real');
  perform pg_temp.m2b1_assert_sale(v_invoice,true,'B1 par dedicado');
  select e.id into strict original from public.journal_entries e where e.invoice_id=v_invoice and e.source='invoice';
  select e.id into strict reversal from public.journal_entries e where e.reverses_entry_id=original;
  insert into public.journal_entries(id,tenant_id,entry_code,entry_date,status,source)
    values(manual,pg_temp.fixture_id('tenant-A'),'M-0573-B1',date '2026-10-10','borrador','manual');
  insert into public.journal_lines(entry_id,account_id,debit,credit) values
    (manual,pg_temp.fixture_id('clientes'),100,0),(manual,pg_temp.fixture_id('ventas'),0,100);
  update public.journal_entries set status='asentado',posted_at=now() where public.journal_entries.id=manual;
  perform pg_temp.assert_true((select count(*)=2 and sum(debit)=100 and sum(credit)=100 from public.journal_lines where entry_id=manual)
    and exists(select 1 from public.entity_audit_log where entity_id=manual and event_type='journal_entry_posted'),
    'B1 manual dedicado asentado100 positivo');
  result:=pg_temp.as_actor('admin-A','select public.fijar_superclave_de_cierre(null,pg_temp.m2b1_test_key())');
  perform pg_temp.assert_true(result->'ok'='true'::jsonb and (select closing_mode='superclave'
    from public.accounting_settings where tenant_id=pg_temp.fixture_id('tenant-A')),'B1 clave configurada por RPC admin real en modo superclave');
  select max(entry_date) into close_date from public.journal_entries where public.journal_entries.id in(original,reversal,manual);
  update public.accounting_settings set closing_date=close_date where tenant_id=pg_temp.fixture_id('tenant-A');
  perform pg_temp.assert_true((select count(*)=3 and bool_and(entry_date<=close_date and status='asentado')
    from public.journal_entries where public.journal_entries.id in(original,reversal,manual)),'B1 cierre alcanza manual y AMBOS extremos reales');
  insert into pg_temp.m2b1_targets values('manual',manual,'B1 motivo manual permitido'),
    ('original',original,'B1 motivo original protegido'),('reverso',reversal,'B1 motivo reverso protegido');
end;
$supp$;
create function pg_temp.m2b1_restore() returns void language plpgsql as $supp$
begin
  update public.accounting_settings s set closing_date=b.closing_date,closing_mode=b.closing_mode
    from pg_temp.m2b1_settings_before b where s.tenant_id=pg_temp.fixture_id('tenant-A');
  drop trigger if exists a0573_m2b1_observe on public.journal_entries;
end;
$supp$;
create function pg_temp.m2b1_case(p_case text) returns jsonb language plpgsql as $supp$
declare target record; before_state jsonb; after_state jsonb; before_context jsonb; after_context jsonb;
  before_count bigint; after_count bigint; before_called boolean; after_called boolean; result jsonb;
begin
  select * into strict target from pg_temp.m2b1_targets where label=p_case;
  execute format('select last_value,is_called from pg_temp.%I','m2b1_seen_'||p_case) into before_count,before_called;
  before_state:=pg_temp.m2b1_snapshot();before_context:=pg_temp.m2b1_context();
  result:=pg_temp.m2b1_attempt('accounting-A',format(
    'select public.anular_asiento_en_cierre(%L::uuid,pg_temp.m2b1_test_key(),%L)',target.id,target.reason));
  execute format('select last_value,is_called from pg_temp.%I','m2b1_seen_'||p_case) into after_count,after_called;
  after_state:=pg_temp.m2b1_snapshot();after_context:=pg_temp.m2b1_context();
  raise notice '0573_B1_ATTEMPT_RAW %',jsonb_build_object('case',p_case,'target',target.id,'result',result,
    'before',pg_temp.m2b1_redact(before_state),'after',pg_temp.m2b1_redact(after_state),
    'sequenceBefore',before_count,'sequenceAfter',after_count,'isCalledBefore',before_called,'isCalledAfter',after_called,
    'contextBefore',before_context,'contextAfter',after_context);
  perform pg_temp.assert_true(before_called and after_called and after_count=before_count+1,'B1 testigo auténtico avanza EXACTO1: '||p_case);
  if p_case='manual' then
    perform pg_temp.assert_true(result->>'ok'='true' and result->'result'->'ok'='true'::jsonb
      and exists(select 1 from public.journal_entries where id=target.id and status='anulado')
      and exists(select 1 from public.entity_audit_log where entity_id=target.id and event_type='journal_entry_voided' and reason=target.reason)
      and (select count(*)=1 from public.accounting_closing_exceptions where entry_id=target.id
        and operation='anular' and authorized_by='superclave' and user_id=pg_temp.fixture_id('accounting-A')
        and txid=txid_current() and reason=target.reason and amount_before=100 and amount_after=0),
      'B1 manual permitido por la misma excepción auténtica');
  else
    perform pg_temp.assert_true(result->>'ok'='false' and result->>'state'='23514'
      and result->>'message'='El asiento automático es inmutable; revisa su factura y reverso.',
      'B1 excepción auténtica no autoriza extremo: '||p_case);
    perform pg_temp.assert_true(after_state=before_state,'B1 rechazo conserva grafo/excepciones/auditoría ENTEROS: '||p_case);
  end if;
  return result;
end;
$supp$;
create function pg_temp.m2b1_run(p_only text default null) returns void language plpgsql as $supp$
begin
  perform pg_temp.m2b1_setup();
  if p_only is null then
    perform pg_temp.m2b1_case('manual');perform pg_temp.m2b1_case('original');perform pg_temp.m2b1_case('reverso');
  else
    perform pg_temp.assert_true(p_only in('original','reverso'),'B1 probe focal nominal');perform pg_temp.m2b1_case(p_only);
  end if;
  perform pg_temp.m2b1_restore();
exception when others then
  -- La fixture completa hará ROLLBACK; no se sustituye el primario por cleanup.
  begin perform pg_temp.m2b1_restore();exception when others then raise notice '0573_B1_CLEANUP_ERROR %',sqlerrm;end;
  raise;
end;
$supp$;

create function pg_temp.m3_setup() returns jsonb language plpgsql as $supp$
declare a uuid; b uuid;
begin
  a:=pg_temp.m2b1_fresh_sale('m3-before');b:=pg_temp.m2b1_fresh_sale('m3-after');
  perform pg_temp.assert_true((select closing_date is null or closing_date<date '2026-10-31'
    from public.accounting_settings where tenant_id=pg_temp.fixture_id('tenant-A')),'M3 cierre no domina las dos bandas');
  return jsonb_build_object('before',pg_temp.m2b1_assert_sale(a,false,'M3 antes positivo'),
    'after',pg_temp.m2b1_assert_sale(b,false,'M3 después positivo'),'setupTxid',txid_current()::text);
end;
$supp$;
create function pg_temp.m3_sample() returns jsonb language sql as $supp$
  select jsonb_build_object('utc',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'epochUs',(extract(epoch from now())*1000000)::numeric(30,0)::text,'txid',txid_current()::text,
    'caracasDate',(now() at time zone 'America/Caracas')::date::text)
$supp$;

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
  = 'Reverso de la factura F-0497-01 (asiento A-2026-0101 del 2026-10-01).',
  'el memo cita la factura, el asiento original y su fecha sin motivo libre');
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
    and je.memo = 'Reverso de la factura F-0497-02 (asiento A-2026-0102 del 2026-01-15). — período cerrado: el reverso va en el período abierto.'
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
  'un reverso header-first cerrado se rechaza sin atribuir la guarda alcanzada');
select pg_temp.assert_true(pg_temp.err(format(
  'insert into public.journal_entries(tenant_id,entry_code,entry_date,status,source) '
  || 'values(%L::uuid,''M-CIERRE-0497'',''2026-01-20'',''borrador'',''manual'')',
  pg_temp.fixture_id('tenant-A')))
  like '23514|Período contable cerrado: no se puede crear un asiento en período cerrado (cierre: 2026-01-31).|%',
  'un manual ajeno alcanza el cierre real0493 sin excepción');

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
create function pg_temp.guard_snapshot() returns jsonb language sql as $$
  select jsonb_build_object(
    'entries',(select jsonb_agg(to_jsonb(e) order by e.id) from public.journal_entries e),
    'lines',(select jsonb_agg(to_jsonb(l) order by l.id) from public.journal_lines l),
    'audit',(select jsonb_agg(to_jsonb(a) order by a.id) from public.entity_audit_log a),
    'reason',current_setting('dtd.audit_reason',true))
$$;
create temporary table guard_before as select pg_temp.guard_snapshot() as value;
select pg_temp.assert_true(split_part(pg_temp.err(format(
  'insert into public.journal_entries (tenant_id, entry_code, entry_date, status, source, invoice_id, reverses_entry_id) '
  || 'values (%L::uuid, ''A-2026-0901'', ''2026-10-10'', ''borrador'', ''invoice_reversal'', %L::uuid, %L::uuid)',
  pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('inv-abierta'), pg_temp.fixture_id('e-abierta'))), '|', 1) = '23514',
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
  'delete from public.journal_entries where id = %L::uuid', pg_temp.fixture_id('e-abierta'))), '|', 1) = '23514',
  'el original no se borra mientras exista su reverso');
-- Guarda temprana, no error nativo de UNIQUE/RESTRICT. Catálogo separado abajo.
select pg_temp.assert_true(pg_temp.guard_snapshot()=(select value from guard_before),
  'rechazos tempranos conservan cabeceras líneas eventos y contexto exactos');

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


-- I3-B 01..18: escenarios AUTORADOS, NO EJECUTADOS. ROLLBACK de esta fixture
-- no acredita COMMIT/races: esos oráculos pertenecen al archivo dblink nuevo.
update public.accounting_settings set closing_date='2026-01-31'
where tenant_id=pg_temp.fixture_id('tenant-A');

create function pg_temp.i3b_invoice(p_label text,p_base numeric default 100,
  p_iva numeric default 0,p_total numeric default 100,p_issued date default date '2026-10-10')
returns uuid language plpgsql as $test$
declare v_id uuid := pg_temp.fixture_id('i3b-'||p_label);
begin
  insert into public.invoices(id,tenant_id,invoice_code,client_markbox,client_name,currency,
    base_amount,iva_amount,total_amount,paid_amount,status,issued_at)
  values(v_id,pg_temp.fixture_id('tenant-A'),'F-I3B-'||p_label,'DTD-I3B','Cliente sintético','USD',
    p_base,p_iva,p_total,0,'emitida',p_issued);
  return v_id;
end;
$test$;
create function pg_temp.i3b_post_sql(p_label text) returns text language sql as $test$
  select format('select public.post_invoice_journal_entry_atomic(%L::uuid,%L::uuid)',
    pg_temp.fixture_id('tenant-A'),pg_temp.fixture_id('i3b-'||p_label))
$test$;
create function pg_temp.i3b_post(p_label text) returns jsonb language sql as $test$
  select pg_temp.as_actor(null,pg_temp.i3b_post_sql(p_label),'service_role')
$test$;
create function pg_temp.i3b_snapshot() returns jsonb language sql as $test$
  select jsonb_build_object('journal',pg_temp.guard_snapshot(),
    'invoices',(select jsonb_agg(to_jsonb(i) order by i.id) from public.invoices i))
$test$;

-- 01. Fórmula/civil/IVA exactos; base0 conserva su línea4.5 cero.
select pg_temp.i3b_invoice('normal',100,16,116);
select pg_temp.assert_true(pg_temp.i3b_post('normal')->>'outcome'='posted','I3B01 posting ordinario');
select pg_temp.assert_true((select e.entry_date=date '2026-10-10' and count(l.*)=3
  and sum(l.debit)=116 and sum(l.credit)=116 from public.journal_entries e
  join public.journal_lines l on l.entry_id=e.id
  where e.invoice_id=pg_temp.fixture_id('i3b-normal') group by e.id),
  'I3B01 fórmula exacta fecha persistida y tres líneas');
select pg_temp.i3b_invoice('base0',0,16,16);
do $test$ declare result jsonb; begin
result:=pg_temp.i3b_post('base0');
perform pg_temp.assert_true(result->>'outcome'='posted'
  and exists(select 1 from public.journal_entries e join public.journal_lines l on l.entry_id=e.id
    join public.accounts a on a.id=l.account_id
    where e.invoice_id=pg_temp.fixture_id('i3b-base0') and a.code='4.5' and l.debit=0 and l.credit=0),
  'I3B01 base0 IVApositivo conserva4.5 cero');
end; $test$;

-- 02. Cero sólo después de validar; negativos/NaN/centavo no se reparan.
select pg_temp.i3b_invoice('zero',0,0,0);
select pg_temp.assert_true(pg_temp.i3b_post('zero')=
  jsonb_build_object('version',1,'outcome','not_posted','reason','zero_total',
    'invoice_id',pg_temp.fixture_id('i3b-zero'),'entry_id',null,'entry_code',null,'entry_date',null),
  'I3B02 cero coherente no certifica asiento');
select pg_temp.i3b_invoice('cent',100,0,100.01);
select pg_temp.i3b_invoice('negative',-1,0,0);
select pg_temp.i3b_invoice('nan','NaN'::numeric,0,'NaN'::numeric);
select pg_temp.assert_true(pg_temp.i3b_post('cent')->>'reason'='totals_mismatch'
  and pg_temp.i3b_post('negative')->>'reason'='invalid_amounts'
  and pg_temp.i3b_post('nan')->>'reason'='invalid_amounts',
  'I3B02 centavo negativo y NaN rechazan antes del cero');
select pg_temp.i3b_invoice('bad-date',100,0,100,null);
select pg_temp.assert_true(pg_temp.i3b_post('bad-date')->>'reason'='invalid_issue_date',
  'I3B02 fecha ausente sin fallback');
select pg_temp.i3b_invoice('infinite-date',100,0,100,'infinity'::date);
select pg_temp.assert_true(pg_temp.i3b_post('infinite-date')->>'reason'='invalid_issue_date',
  'I3B02 fecha infinita sin fallback');
select pg_temp.i3b_invoice('exact-cent',0.01,0,0.01);
select pg_temp.assert_true(pg_temp.i3b_post('exact-cent')->>'outcome'='posted',
  'I3B02 un centavo exacto no se redondea ni se rechaza');
select pg_temp.i3b_invoice('max-finite',999999999999.99,0,999999999999.99);
select pg_temp.assert_true(pg_temp.i3b_post('max-finite')->>'outcome'='posted',
  'I3B02 máximo numeric14,2 finito íntegro');
select pg_temp.i3b_invoice('not-postable-account');
update public.accounts set is_postable=false where id=pg_temp.fixture_id('ventas');
select pg_temp.assert_true(pg_temp.i3b_post('not-postable-account')->>'reason'='missing_accounts',
  'I3B02 cuenta existente no imputable no acredita catálogo');
update public.accounts set is_postable=true where id=pg_temp.fixture_id('ventas');

-- 03. Reconocimiento íntegro es lectura aun cerrado y90 no se revalora a100.
create temporary table i3b_read_before as select pg_temp.i3b_snapshot() as value;
select pg_temp.assert_true(pg_temp.i3b_post('normal')->>'outcome'='already_posted',
  'I3B03 reconocimiento íntegro');
select pg_temp.assert_true(pg_temp.i3b_snapshot()=(select value from i3b_read_before),
  'I3B03 reconocimiento no escribe ni audita');
select pg_temp.assert_true(pg_temp.i3b_post('history90')->>'outcome'='already_posted',
  'I3B03 documento100 reconoce original íntegro90 sin revalorarlo');
do $test$ declare result jsonb; begin
result:=pg_temp.as_actor('accounting-A',format(
  'select to_jsonb(public.void_invoice_with_audit_reason(%L::uuid,''I3B histórico90''))',
  pg_temp.fixture_id('i3b-history90')));
perform pg_temp.assert_true(result='true'::jsonb
  and (select sum(l.debit) from public.journal_lines l join public.journal_entries e on e.id=l.entry_id
    where e.reverses_entry_id=pg_temp.fixture_id('i3b-entry-history90'))=90,
  'I3B03 reverso conserva90 no ajusta diez del documento');
end; $test$;
do $test$ declare result jsonb; begin
result:=pg_temp.as_actor('accounting-A',format(
  'select to_jsonb(public.void_invoice_with_audit_reason(%L::uuid,''I3B fecha original futura''))',
  pg_temp.fixture_id('i3b-original-future')));
perform pg_temp.assert_true(result='true'::jsonb
  and (select entry_date from public.journal_entries where reverses_entry_id=pg_temp.fixture_id('i3b-entry-original-future'))
    =(now() at time zone 'America/Caracas')::date+20,
  'I3B03 M3 nunca fecha reverso antes del original futuro');
end; $test$;
update public.accounting_settings set closing_date='2026-10-31'
where tenant_id=pg_temp.fixture_id('tenant-A');
select pg_temp.assert_true(pg_temp.i3b_post('normal')->>'outcome'='already_posted',
  'I3B03 cierre posterior no modifica original válido');
select pg_temp.i3b_invoice('closed',100,0,100);
select pg_temp.assert_true(pg_temp.i3b_post('closed')->>'reason'='period_closed',
  'I3B03 nuevo posting cerrado rechaza sin excepción');
update public.accounting_settings set closing_date='2026-01-31'
where tenant_id=pg_temp.fixture_id('tenant-A');

-- 04. Legado duplicado/descuadrado no se completa ni se reconoce.
select pg_temp.assert_true(pg_temp.i3b_post('legacy-draft')->>'reason'='existing_sale_requires_review'
  and pg_temp.i3b_post('legacy-empty')->>'reason'='existing_sale_requires_review'
  and pg_temp.i3b_post('legacy-both')->>'reason'='existing_sale_requires_review',
  'I3B04 borrador huérfana y borrador coexistente no son reconocimiento');
select pg_temp.assert_true(pg_temp.as_actor(null,format(
  'select public.post_invoice_journal_entry_atomic(%L::uuid,%L::uuid)',
  pg_temp.fixture_id('tenant-A'),pg_temp.fixture_id('inv-doble')),'service_role')->>'reason'
  ='invalid_issue_date', 'I3B04 fecha legada ausente no se inventa');
select pg_temp.assert_true(split_part(pg_temp.err(format(
  'insert into public.journal_lines(entry_id,account_id,debit,credit) values(%L::uuid,%L::uuid,0,50)',
  pg_temp.fixture_id('e-descuadre'),pg_temp.fixture_id('ventas'))),'|',1)='23514',
  'I3B04 no completar cabecera legada ni aun sin reverso');

-- 05. Header-first no confirma ni D2; la emisión persistida se conserva.
select pg_temp.i3b_invoice('header-first');
create temporary table i3b_header_before as select pg_temp.i3b_snapshot() as value;
select pg_temp.assert_true(split_part(pg_temp.err(format(
  'insert into public.journal_entries(tenant_id,entry_code,entry_date,status,source,invoice_id,posted_at)'
  ||' values(%L::uuid,''I3B-HEADER-FIRST'',''2026-10-10'',''asentado'',''invoice'',%L::uuid,now())',
  pg_temp.fixture_id('tenant-A'),pg_temp.fixture_id('i3b-header-first'))),'|',1)='23514'
  and pg_temp.i3b_snapshot()=(select value from i3b_header_before),
  'I3B05 header-first no deja fila auditoría ni revierte emisión anterior');

-- 06. Ambos extremos, OLD/NEW y líneas: no editar/restaurar como compensación.
create temporary table i3b_pair_before as select pg_temp.i3b_snapshot() as value;
do $test$
declare v_id uuid; v_sql text;
begin
  for v_id in select id from public.journal_entries where id in
    (pg_temp.fixture_id('e-abierta'),pg_temp.reverso_de('e-abierta'))
  loop
    foreach v_sql in array array[
      format('update public.journal_entries set source=''manual'' where id=%L::uuid',v_id),
      format('update public.journal_entries set tenant_id=%L::uuid where id=%L::uuid',pg_temp.fixture_id('tenant-B'),v_id),
      format('update public.journal_entries set deleted_at=now() where id=%L::uuid',v_id),
      format('update public.journal_entries set status=''anulado'' where id=%L::uuid',v_id),
      format('delete from public.journal_entries where id=%L::uuid',v_id),
      format('delete from public.journal_lines where entry_id=%L::uuid',v_id),
      format('update public.journal_lines set debit=debit+1 where entry_id=%L::uuid',v_id),
      format('insert into public.journal_lines(entry_id,account_id,debit,credit) values(%L::uuid,%L::uuid,0,0)',
        v_id,pg_temp.fixture_id('ventas'))
    ] loop
      perform pg_temp.assert_true(split_part(pg_temp.err(v_sql),'|',1)='23514','I3B06 mutación protegida rechazada');
    end loop;
  end loop;
end;
$test$;
select pg_temp.assert_true(pg_temp.i3b_snapshot()=(select value from i3b_pair_before),
  'I3B06 ambos extremos líneas eventos y contexto intactos');

-- 07. Desvincular/reabrir factura tampoco convierte el par en manual.
select pg_temp.assert_true(split_part(pg_temp.err(format(
  'update public.invoices set status=''emitida'' where id=%L::uuid',
  pg_temp.fixture_id('inv-abierta'))),'|',1)='23514'
  and split_part(pg_temp.err(format('update public.invoices set deleted_at=now() where id=%L::uuid',
    pg_temp.fixture_id('inv-abierta'))),'|',1)='23514',
  'I3B07 no reabrir ni ocultar factura del par');

-- 08. FK singular diferida se fuerza de verdad; NULL no se interpreta como éxito.
do $test$
declare v_state text;
begin
  begin
    set constraints public.journal_lines_entry_id_fkey deferred;
    insert into public.journal_lines(entry_id,account_id,debit,credit)
    values(pg_temp.fixture_id('missing-parent'),pg_temp.fixture_id('ventas'),0,1);
    set constraints public.journal_lines_entry_id_fkey immediate;
    raise exception 'I3B08 no falló la FK';
  exception when foreign_key_violation then v_state:=sqlstate;
  end;
  perform pg_temp.assert_true(v_state='23503','I3B08 FK forzada rechaza huérfana');
end;
$test$;

-- 09. Manual ajeno sigue header→líneas; DELETE físico CASCADE se observa.
insert into public.journal_entries(id,tenant_id,entry_code,entry_date,status,source)
values(pg_temp.fixture_id('manual-i3b'),pg_temp.fixture_id('tenant-A'),'M-I3B','2026-10-10','borrador','manual');
insert into public.journal_lines(entry_id,account_id,debit,credit) values
  (pg_temp.fixture_id('manual-i3b'),pg_temp.fixture_id('clientes'),5,0),
  (pg_temp.fixture_id('manual-i3b'),pg_temp.fixture_id('ventas'),0,5);
delete from public.journal_entries where id=pg_temp.fixture_id('manual-i3b');
select pg_temp.assert_true(not exists(select 1 from public.journal_lines where entry_id=pg_temp.fixture_id('manual-i3b'))
  and exists(select 1 from public.entity_audit_log where entity_id=pg_temp.fixture_id('manual-i3b')
    and event_type='journal_entry_deleted'),'I3B09 manual físico RC conserva CASCADE y D2');

-- 10. Caller ALL IMMEDIATE: construcción difiere sólo sus tres nombres.
select pg_temp.i3b_invoice('caller-immediate');
set constraints all immediate;
select pg_temp.assert_true(pg_temp.i3b_post('caller-immediate')->>'outcome'='posted',
  'I3B10 caller ALL IMMEDIATE admite construcción íntegra');
select pg_temp.assert_true(pg_temp.as_actor('accounting-A',format(
  'select to_jsonb(public.void_invoice_with_audit_reason(%L::uuid,''I3B motivo exacto''))',
  pg_temp.fixture_id('i3b-caller-immediate')))='true'::jsonb,
  'I3B10 reverso transitorio no se valida antes de anular');
set constraints public.i3_journal_entry_final_check,public.i3_invoice_final_check immediate;

-- 11. Pendiente inválido del caller se rechaza antes de construir otra venta.
select pg_temp.i3b_invoice('prior-pending');
do $test$
declare v_before jsonb:=pg_temp.i3b_snapshot(); v_state text;
begin
  begin
    set constraints public.journal_lines_entry_id_fkey deferred;
    insert into public.journal_lines(entry_id,account_id,debit,credit)
      values(pg_temp.fixture_id('prior-invalid'),pg_temp.fixture_id('ventas'),0,1);
    perform pg_temp.i3b_post('prior-pending');
    raise exception 'I3B11 se omitió pendiente previo';
  exception when foreign_key_violation then v_state:=sqlstate;
  end;
  perform pg_temp.assert_true(v_state='23503' and pg_temp.i3b_snapshot()=v_before,
    'I3B11 pendiente previo no deja posting parcial');
end;
$test$;

-- 12. No-op/reconocimiento no fuerzan una FK previamente diferida.
do $test$
begin
  set constraints public.journal_lines_entry_id_fkey deferred;
  insert into public.journal_lines(entry_id,account_id,debit,credit)
    values(pg_temp.fixture_id('noop-pending'),pg_temp.fixture_id('ventas'),0,1);
  perform pg_temp.assert_true(pg_temp.i3b_post('zero')->>'reason'='zero_total'
    and pg_temp.i3b_post('normal')->>'outcome'='already_posted',
    'I3B12 no-op y lectura no fuerzan pendientes ajenos');
  delete from public.journal_lines where entry_id=pg_temp.fixture_id('noop-pending');
  set constraints public.journal_lines_entry_id_fkey immediate;
end;
$test$;

-- 13. M4/D2: motivo EXACTO en su evento, referencias sin notas libres.
select pg_temp.assert_true(exists(select 1 from public.entity_audit_log
    where entity_id=pg_temp.fixture_id('i3b-caller-immediate') and event_type='invoice_voided'
      and reason='I3B motivo exacto')
  and not exists(select 1 from public.journal_entries
    where invoice_id=pg_temp.fixture_id('i3b-caller-immediate') and memo like '%I3B motivo exacto%')
  and not exists(select 1 from public.journal_lines l join public.journal_entries e on e.id=l.entry_id
    where e.invoice_id=pg_temp.fixture_id('inv-abierta') and e.source='invoice_reversal'
      and (l.line_memo like '%Factura emitida por error%' or l.line_memo like '%Por cobrar%'
           or l.line_memo like '%Ingreso%'))
  and not exists(select 1 from public.entity_audit_log a join public.journal_entries e on e.id=a.entity_id
    where e.invoice_id=pg_temp.fixture_id('i3b-caller-immediate')
      and a.event_type='journal_entry_posted' and a.reason like '%I3B motivo exacto%'),
  'I3B13 motivo sólo invoice_voided y no copia notas');
select set_config('dtd.audit_reason','I3B contexto exterior',true);
select pg_temp.i3b_invoice('context-outer');
do $test$ declare result jsonb; begin
result:=pg_temp.i3b_post('context-outer');
perform pg_temp.assert_true(result->>'outcome'='posted'
  and current_setting('dtd.audit_reason',true)='I3B contexto exterior',
  'I3B13 SET de función restaura contexto exterior no vacío');
end; $test$;
select pg_temp.assert_true(not exists(select 1 from public.entity_audit_log a join public.journal_entries e on e.id=a.entity_id
  where e.invoice_id=pg_temp.fixture_id('i3b-context-outer') and a.event_type='journal_entry_posted'
    and a.reason='I3B contexto exterior'),'I3B13 contexto externo no contamina posting');
select set_config('dtd.audit_reason','',true);

-- 14. Tres intentos TOTALES selectivos, con todas las líneas/audit en subunidad.
create temporary sequence i3b_code_attempts;
create temporary table i3b_code_mode(value text);
insert into i3b_code_mode values('twice');
create temporary table i3b_code_original as
select pg_get_functiondef('public.next_entry_code(uuid)'::regprocedure) as ddl;
create or replace function public.next_entry_code(p_tenant_id uuid)
returns text language plpgsql security definer set search_path=public as $test$
declare n bigint:=nextval('pg_temp.i3b_code_attempts'); mode text; yr int:=extract(year from current_date); mx int;
begin
  select value into mode from pg_temp.i3b_code_mode;
  if mode='always' or (mode='twice' and n<=2) then return 'A-2026-0101'; end if;
  select coalesce(max((regexp_match(entry_code,'^A-\d{4}-(\d+)$'))[1]::int),0)+1 into mx
    from public.journal_entries where tenant_id=p_tenant_id and entry_code like 'A-'||yr||'-%';
  return 'A-'||yr||'-'||lpad(mx::text,4,'0');
end;
$test$;
select pg_temp.i3b_invoice('collision-two');
do $test$ declare result jsonb; begin
result:=pg_temp.i3b_post('collision-two');
perform pg_temp.assert_true(result->>'outcome'='posted'
  and (select last_value from i3b_code_attempts)=3
  and (select count(*) from public.journal_entries where invoice_id=pg_temp.fixture_id('i3b-collision-two'))=1,
  'I3B14 dos colisiones tercera unidad íntegra sin líneas o eventos de intentos fallidos');
end; $test$;
update i3b_code_mode set value='always';
select setval('pg_temp.i3b_code_attempts',1,false);
select pg_temp.i3b_invoice('collision-three');
create temporary table i3b_collision_before as select pg_temp.i3b_snapshot() as value;
do $test$ declare failure text; begin
failure:=pg_temp.error_of(null,pg_temp.i3b_post_sql('collision-three'),'service_role');
perform pg_temp.assert_true(split_part(failure,'|',1)='23505'
  and (select last_value from i3b_code_attempts)=3
  and pg_temp.i3b_snapshot()=(select value from i3b_collision_before),
  'I3B14 tercera colisión propaga23505 y revierte unidad completa');
end; $test$;
-- Otro23505/FK real: sólo UN intento de código, no un retry genérico.
update i3b_code_mode set value='none';
create temporary table i3b_native_error_mode(value text);
insert into i3b_native_error_mode values('unique');
create function pg_temp.i3b_native_error() returns trigger language plpgsql as $test$
begin
  if new.line_memo like 'Factura F-I3B-native-%' then
    if (select value from pg_temp.i3b_native_error_mode)='unique' then
      select id into new.id from public.journal_lines order by id limit 1;
    else
      new.account_id:=pg_temp.fixture_id('i3b-account-does-not-exist');
    end if;
  end if;
  return new;
end;
$test$;
create trigger i3b_test_native_error before insert on public.journal_lines
for each row execute function pg_temp.i3b_native_error();
do $test$
declare kind text; before_state jsonb; failure text;
begin
  foreach kind in array array['unique','foreign-key'] loop
    update pg_temp.i3b_native_error_mode set value=kind;
    perform pg_temp.i3b_invoice('native-'||kind);
    before_state:=pg_temp.i3b_snapshot();
    perform setval('pg_temp.i3b_code_attempts',1,false);
    failure:=pg_temp.error_of(null,pg_temp.i3b_post_sql('native-'||kind),'service_role');
    perform pg_temp.assert_true(split_part(failure,'|',1)=case when kind='unique' then '23505' else '23503' end
      and (select last_value from pg_temp.i3b_code_attempts)=1 and pg_temp.i3b_snapshot()=before_state,
      'I3B14 otra UNIQUE/FK propaga sin retry ni efectos');
  end loop;
end;
$test$;
drop trigger i3b_test_native_error on public.journal_lines;
do $test$ begin execute (select ddl from pg_temp.i3b_code_original); end; $test$;

-- 15. Append REAL falla en su INSERT; no sustituimos0290/0294/0267.
create temporary table i3b_append_mode(value text);
insert into i3b_append_mode values('journal_entry_posted');
create function pg_temp.i3b_fail_append() returns trigger language plpgsql as $test$
begin
  if new.event_type=(select value from pg_temp.i3b_append_mode) then
    raise exception 'I3B fallo append real' using errcode='23514';
  end if;
  return new;
end;
$test$;
create trigger i3b_test_fail_append before insert on public.entity_audit_log
for each row execute function pg_temp.i3b_fail_append();
select pg_temp.i3b_invoice('append-post');
create temporary table i3b_append_before as select pg_temp.i3b_snapshot() as value;
select pg_temp.assert_true(pg_temp.error_of(null,pg_temp.i3b_post_sql('append-post'),'service_role')
  ='23514|I3B fallo append real|' and pg_temp.i3b_snapshot()=(select value from i3b_append_before),
  'I3B15 append de posted revierte cabecera todas líneas y evento');
update i3b_append_mode set value='';
select pg_temp.i3b_invoice('append-void');
select pg_temp.i3b_post('append-void');
update i3b_append_mode set value='invoice_voided';
create temporary table i3b_void_before as select pg_temp.i3b_snapshot() as value;
select pg_temp.assert_true(pg_temp.error_of('accounting-A',format(
  'select to_jsonb(public.void_invoice_with_audit_reason(%L::uuid,''I3B motivo de fallo''))',
    pg_temp.fixture_id('i3b-append-void')))='23514|I3B fallo append real|'
  and pg_temp.i3b_snapshot()=(select value from i3b_void_before),
  'I3B15 append de invoice_voided revierte reverso posted y transición');
drop trigger i3b_test_fail_append on public.entity_audit_log;

-- 16. Error de última línea y otra UNIQUE no son código ocupado.
create function pg_temp.i3b_last_line_fail() returns trigger language plpgsql as $test$
begin
  if new.line_memo='IVA de factura F-I3B-last-line' then
    raise exception 'I3B última línea' using errcode='23514';
  end if;
  return new;
end;
$test$;
create trigger i3b_test_last_line before insert on public.journal_lines
for each row execute function pg_temp.i3b_last_line_fail();
select pg_temp.i3b_invoice('last-line',100,16,116);
create temporary table i3b_line_before as select pg_temp.i3b_snapshot() as value;
select pg_temp.assert_true(pg_temp.error_of(null,pg_temp.i3b_post_sql('last-line'),'service_role')
  ='23514|I3B última línea|' and pg_temp.i3b_snapshot()=(select value from i3b_line_before),
  'I3B16 última línea revierte toda unidad sin compensación');
drop trigger i3b_test_last_line on public.journal_lines;

-- Borrar PRE-header es lícito; sólo el conjunto restante admite la cabecera.
select pg_temp.i3b_invoice('preheader-delete');
select pg_temp.i3b_invoice('preheader-missing');
do $test$
declare entry uuid:=pg_temp.fixture_id('i3b-preheader-entry'); extra uuid:=pg_temp.fixture_id('i3b-preheader-extra');
  before_state jsonb; failure text;
begin
  set constraints public.journal_lines_entry_id_fkey,
    public.i3_journal_entry_final_check,public.i3_invoice_final_check deferred;
  insert into public.journal_lines(entry_id,account_id,debit,credit) values
    (entry,pg_temp.fixture_id('clientes'),100,0),(entry,pg_temp.fixture_id('ventas'),0,100);
  insert into public.journal_lines(id,entry_id,account_id,debit,credit)
    values(extra,entry,pg_temp.fixture_id('ventas'),0,1);
  delete from public.journal_lines where id=extra;
  insert into public.journal_entries(id,tenant_id,entry_code,entry_date,status,source,invoice_id,posted_at)
    values(entry,pg_temp.fixture_id('tenant-A'),'I3B-PRE-DELETE','2026-10-10','asentado','invoice',
      pg_temp.fixture_id('i3b-preheader-delete'),now());
  set constraints public.journal_lines_entry_id_fkey,
    public.i3_journal_entry_final_check,public.i3_invoice_final_check immediate;
  perform pg_temp.assert_true((select count(*) from public.journal_lines where entry_id=entry)=2,
    'I3B16 extra borrada antes de admisión no altera unidad final');
  before_state:=pg_temp.i3b_snapshot();
  failure:=pg_temp.err(format('delete from public.journal_lines where entry_id=%L::uuid',entry));
  perform pg_temp.assert_true(split_part(failure,'|',1)='23514' and pg_temp.i3b_snapshot()=before_state,
    'I3B16 misma operación después de admitir cabecera está bloqueada');
  begin
    entry:=pg_temp.fixture_id('i3b-preheader-missing-entry');
    set constraints public.journal_lines_entry_id_fkey,
      public.i3_journal_entry_final_check,public.i3_invoice_final_check deferred;
    insert into public.journal_lines(entry_id,account_id,debit,credit) values
      (entry,pg_temp.fixture_id('clientes'),100,0),(entry,pg_temp.fixture_id('ventas'),0,100);
    delete from public.journal_lines where entry_id=entry and credit=100;
    insert into public.journal_entries(id,tenant_id,entry_code,entry_date,status,source,invoice_id,posted_at)
      values(entry,pg_temp.fixture_id('tenant-A'),'I3B-PRE-MISSING','2026-10-10','asentado','invoice',
        pg_temp.fixture_id('i3b-preheader-missing'),now());
    raise exception 'I3B16 cabecera incompleta indebidamente admitida';
  exception when check_violation then failure:=sqlstate;
  end;
  perform pg_temp.assert_true(failure='23514' and pg_temp.i3b_snapshot()=before_state,
    'I3B16 línea esencial ausente rechaza y revierte líneas/cabecera/eventos');
end;
$test$;

-- 17. Catálogo nativo separado del bloqueo temprano.
select pg_temp.assert_true((select count(*)=2 and bool_and(p.pronargdefaults=8
    and pg_get_expr(p.proargdefaults,0::oid,false)=$defaults$'succeeded'::text, NULL::text, NULL::jsonb, NULL::jsonb, '{}'::jsonb, NULL::text, 1, 'internal'::text$defaults$)
  from pg_proc p where p.oid in (
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'::regprocedure,
    'public.append_audit_event_v1(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'::regprocedure)),
  'I3B17 defaults tipados exactos de ambos escritores reales');
select pg_temp.assert_true((select pronargdefaults=0 and proargdefaults is null from pg_proc
  where oid='public.post_invoice_journal_entry_atomic(uuid,uuid)'::regprocedure),
  'I3B17 posting sin expresiones de defaults');
select pg_temp.assert_true(exists(select 1 from pg_index i
  where i.indexrelid='public.journal_entries_un_reverso'::regclass
    and i.indisunique and i.indisvalid and i.indisready and i.indislive and i.indimmediate
    and i.indnatts=1 and i.indnkeyatts=1 and i.indexprs is null
    and array(select x from unnest(i.indkey::smallint[]) x)=array[
      (select attnum from pg_attribute where attrelid='public.journal_entries'::regclass and attname='reverses_entry_id')]::smallint[]
    and pg_get_expr(i.indpred,i.indrelid)='(reverses_entry_id IS NOT NULL)'),
  'I3B17 UNIQUE real clave predicado y validez del reverso');
select pg_temp.assert_true(exists(select 1 from pg_constraint c join pg_index i on i.indexrelid=c.conindid
  where c.conrelid='public.journal_entries'::regclass and c.conname='journal_entries_reverses_entry_id_fkey'
    and c.contype='f' and c.confrelid=c.conrelid and c.confdeltype='r' and c.confupdtype='a'
    and c.confmatchtype='s' and c.convalidated and not c.condeferrable and not c.condeferred
    and i.indisprimary and i.indisvalid and i.indisunique),
  'I3B17 FK real RESTRICT PK y diferibilidad independientes');
select pg_temp.assert_true(exists(select 1 from pg_constraint c
  where c.conrelid='public.journal_entries'::regclass and c.conname='journal_entries_reverso_coherente'
    and c.contype='c' and c.convalidated
    and regexp_replace(pg_get_expr(c.conbin,c.conrelid),'[[:space:]()]','','g')
      ='source=''invoice_reversal''::text=reverses_entry_idISNOTNULL'),
  'I3B17 CHECK exacto ambas direcciones independiente');

-- 18. ACL efectiva: API posting sólo service_role; helpers no se exponen.
select pg_temp.assert_true(has_function_privilege('service_role','public.post_invoice_journal_entry_atomic(uuid,uuid)','EXECUTE')
  and not has_function_privilege('authenticated','public.post_invoice_journal_entry_atomic(uuid,uuid)','EXECUTE')
  and not has_function_privilege('anon','public.post_invoice_journal_entry_atomic(uuid,uuid)','EXECUTE')
  and not has_function_privilege('service_role','public.i3_lock_entry(uuid)','EXECUTE'),
  'I3B18 ACL efectiva y helper privado');
set constraints public.journal_lines_entry_id_fkey,
  public.i3_journal_entry_final_check,public.i3_invoice_final_check immediate;


-- Suplemento M2/B1 independiente; sólo se ejecutará con un GO futuro.
select pg_temp.m2_void_case('draft-only');
select pg_temp.m2_void_case('posted-and-draft');
select pg_temp.m2b1_run();

select 'TEST 0497 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
