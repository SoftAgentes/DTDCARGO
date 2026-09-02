\set ON_ERROR_STOP on
-- SDD-0364: aislamiento de las tres policies Portal. Sólo fixtures locales.
-- RED: psql -v apply_fix=false -f este-archivo, sin requerir que exista 0420.
-- Los diagnósticos de otros huecos corren SÓLO antes del fix: no son permisos
-- aprobados ni comportamientos que GREEN deba conservar en el siguiente slice.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
create schema extensions;
create schema storage;
grant usage on schema auth, storage to authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.tenants (id uuid primary key);
create table public.user_tenants (
  user_id uuid primary key, tenant_id uuid not null, role text not null, disabled_at timestamptz
);
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select ut.tenant_id from public.user_tenants ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;
create function public.current_studio_role() returns text
language sql stable security definer set search_path = '' as $$
  select ut.role from public.user_tenants ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create table public.clients (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  markbox text not null, email text, deleted_at timestamptz, unique (tenant_id, markbox)
);
create table public.shipments (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  client_markbox text, deleted_at timestamptz
);
grant select on public.clients to authenticated;
alter table public.clients enable row level security;
alter table public.shipments enable row level security;
create policy "clients by tenant" on public.clients for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
create table storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated, service_role;
create function storage.foldername(text) returns text[] language sql immutable as $$
  select string_to_array($1, '/')
$$;
-- 0077 real sólo necesita este stub lateral para extender el CHECK de auditoría.
-- Las ACL de facturas posteriores no son el objeto de este diagnóstico.
create table public.entity_audit_log (entity_type text);
\ir ../migrations/0077_invoices.sql
\ir ../migrations/0080_portal_cliente.sql
\ir ../migrations/0085_portal_invoices_rls.sql
\ir ../migrations/0195_payment_reports.sql
\ir ../migrations/0230_fix_rls_soft_delete_blocked.sql
-- Mismo conjunto mínimo usado por el contrato 0359. Las cuatro RPC de
-- operarios creadas por0351 no se ejecutan ni requieren sus tablas aquí.
\ir ../migrations/0351_operario_rpc_exige_rol.sql
\ir ../migrations/0359_confirm_payment_report_exige_rol.sql
\ir ../migrations/0363_storage_bug_replays_restrictive.sql

create function pg_temp.fixture_id(p_label text) returns uuid language sql immutable as $$
  select md5('0420-synthetic-' || p_label)::uuid
$$;
insert into public.tenants values (pg_temp.fixture_id('tenant-A')), (pg_temp.fixture_id('tenant-B'));
insert into auth.users (id) select pg_temp.fixture_id(v) from unnest(array[
  'accounting-A', 'marketing-A', 'team-disabled', 'portal-A', 'portal-B', 'revoked', 'retired', 'incoherent', 'invited', 'unlinked'
]) v;
insert into public.user_tenants values
  (pg_temp.fixture_id('accounting-A'), pg_temp.fixture_id('tenant-A'), 'accounting', null),
  (pg_temp.fixture_id('marketing-A'), pg_temp.fixture_id('tenant-A'), 'marketing', null),
  (pg_temp.fixture_id('team-disabled'), pg_temp.fixture_id('tenant-A'), 'accounting', now());
insert into public.clients (id, tenant_id, markbox, deleted_at)
select pg_temp.fixture_id(label), pg_temp.fixture_id(tenant), markbox, case when retired then now() else null end
from (values
  ('client-A', 'tenant-A', 'DUP', false), ('client-A-other', 'tenant-A', 'OTHER', false),
  ('client-retired', 'tenant-A', 'DEAD', true), ('client-invited', 'tenant-A', 'INVITED', false),
  ('client-B', 'tenant-B', 'DUP', false), ('client-B-other', 'tenant-B', 'OTHER', false)
) v(label, tenant, markbox, retired);
insert into public.client_users (auth_user_id, tenant_id, client_id, email, status)
select pg_temp.fixture_id(principal), pg_temp.fixture_id(tenant), pg_temp.fixture_id(client), principal || '@example.invalid', status
from (values
  ('portal-A', 'tenant-A', 'client-A', 'active'), ('portal-B', 'tenant-B', 'client-B', 'active'),
  ('revoked', 'tenant-A', 'client-A-other', 'revoked'), ('retired', 'tenant-A', 'client-retired', 'active'),
  ('incoherent', 'tenant-A', 'client-B-other', 'active'), ('invited', 'tenant-A', 'client-invited', 'invited')
) v(principal, tenant, client, status);
insert into public.invoices (id, tenant_id, invoice_code, client_markbox, client_name, base_amount, total_amount, paid_amount, status, currency)
select pg_temp.fixture_id(label), pg_temp.fixture_id(tenant), code, markbox, 'synthetic', 1000, 1000, 20, 'emitida', 'USD'
from (values
  ('invoice-A', 'tenant-A', 'F-TEST-0001', 'DUP'), ('invoice-B', 'tenant-B', 'F-TEST-0001', 'DUP'),
  ('invoice-A-history', 'tenant-A', 'F-TEST-HISTORY', 'DUP'), ('invoice-A-other', 'tenant-A', 'F-TEST-OTHER', 'OTHER'),
  ('invoice-retired', 'tenant-A', 'F-TEST-DEAD', 'DEAD'), ('invoice-invited', 'tenant-A', 'F-TEST-INVITED', 'INVITED'),
  ('invoice-B-other', 'tenant-B', 'F-TEST-OTHER', 'OTHER'),
  ('invoice-A-paid', 'tenant-A', 'F-TEST-PAID', 'DUP'), ('invoice-A-draft', 'tenant-A', 'F-TEST-DRAFT', 'DUP')
) v(label, tenant, code, markbox);
insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox, amount, currency, method, paid_at, status, deleted_at)
select pg_temp.fixture_id(v.label), i.tenant_id, i.id, 'BODY-NO-CONFIABLE', i.client_markbox, 100, 'USD', 'otro', date '2026-09-01',
       v.status::payment_report_status, case when v.retired then now() else null end
from (values
  ('R-A', 'invoice-A', 'reportado', false), ('R-B', 'invoice-B', 'reportado', false),
  ('R-A-confirmed', 'invoice-A', 'confirmado', false), ('R-A-rejected', 'invoice-A', 'rechazado', false),
  ('R-A-history', 'invoice-A-history', 'confirmado', false), ('R-A-deleted', 'invoice-A', 'reportado', true),
  ('R-A-paid', 'invoice-A-paid', 'confirmado', false),
  ('R-A-other', 'invoice-A-other', 'reportado', false), ('R-B-other', 'invoice-B-other', 'reportado', false),
  ('R-retired', 'invoice-retired', 'reportado', false), ('R-invited', 'invoice-invited', 'reportado', false)
) v(label, invoice, status, retired) join public.invoices i on i.id = pg_temp.fixture_id(v.invoice);
-- Historia ya registrada antes de archivar su factura; no fabrica nuevos pagos.
update public.invoices set deleted_at = now() where id = pg_temp.fixture_id('invoice-A-history');
update public.invoices set status = 'pagada', paid_amount = 1000 where id = pg_temp.fixture_id('invoice-A-paid');
update public.invoices set status = 'borrador' where id = pg_temp.fixture_id('invoice-A-draft');
-- Un legado incoherente: el trigger actual lo prohíbe al INSERT normal.
alter table public.payment_reports disable trigger payment_reports_validate_invoice_trg;
insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox, amount, method, paid_at)
values (pg_temp.fixture_id('R-legacy-cross-invoice'), pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('invoice-B'),
        'F-TEST-0001', 'DUP', 100, 'otro', date '2026-09-01');
alter table public.payment_reports enable trigger payment_reports_validate_invoice_trg;
insert into storage.objects (id, bucket_id, name) values
  (pg_temp.fixture_id('proof-B-free'), 'payment-proofs', pg_temp.fixture_id('tenant-B')::text || '/' || pg_temp.fixture_id('invoice-B')::text || '/unattached/proof.pdf');
create temporary table reports_baseline as select to_jsonb(p) as row_data from public.payment_reports p;
create temporary table invoices_baseline as select to_jsonb(i) as row_data from public.invoices i;

-- Prueba causal: con factura coherente en B, el trigger0195 no representa al
-- actor A. Reproduce SELECT, INSERT, UPDATE ajenos y reasignación A -> B.
savepoint historical_cross_tenant;
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
do $cross_tenant_baseline$
declare v_count bigint; v_report public.payment_reports;
begin
  if (select count(*) from public.payment_reports where id = pg_temp.fixture_id('R-B')) <> 1 then
    raise exception 'TEST 0420: fixture no reproduce SELECT de reporte B desde A';
  end if;
  insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox, amount, method, paid_at)
  values (pg_temp.fixture_id('R-insert-B-by-A'), pg_temp.fixture_id('tenant-B'), pg_temp.fixture_id('invoice-B'),
          'BODY-FORGED', 'DUP', 33, 'otro', date '2026-09-01') returning * into v_report;
  if v_report.tenant_id <> pg_temp.fixture_id('tenant-B') or v_report.invoice_code <> 'F-TEST-0001' then
    raise exception 'TEST 0420: INSERT cruzado no llegó con snapshot sellado por trigger';
  end if;
  update public.payment_reports set amount = 77, note = 'EDITADO-DESDE-A' where id = pg_temp.fixture_id('R-B');
  get diagnostics v_count = row_count;
  if v_count <> 1 or (select amount from public.payment_reports where id = pg_temp.fixture_id('R-B')) <> 77 then
    raise exception 'TEST 0420: fixture no reproduce UPDATE de B desde A';
  end if;
  update public.payment_reports set tenant_id = pg_temp.fixture_id('tenant-B'), invoice_id = pg_temp.fixture_id('invoice-B')
  where id = pg_temp.fixture_id('R-A');
  get diagnostics v_count = row_count;
  if v_count <> 1 or (select tenant_id from public.payment_reports where id = pg_temp.fixture_id('R-A')) <> pg_temp.fixture_id('tenant-B') then
    raise exception 'TEST 0420: fixture no reproduce reasignación A hacia factura B';
  end if;
  raise notice 'TEST 0420 RED baseline: SELECT B + INSERT B con trigger coherente + UPDATE B + reasignación A->B reproducidos por Portal A';
end;
$cross_tenant_baseline$;
rollback to savepoint historical_cross_tenant;
release savepoint historical_cross_tenant;
reset role;

-- DIAGNÓSTICO: la cancelación replica EXACTAMENTE el UPDATE de sesión de
-- cancelPaymentReportAction, incluidos markbox/status/deleted_at, sin RETURNING.
-- Se captura el error sin abortar; luego postgres mira el estado almacenado.
savepoint cancellation_diagnostic;
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
do $cancel_exact_action$
declare v_state text := '00000'; v_message text := 'sin error'; v_count bigint := 0;
begin
  begin
    update public.payment_reports set deleted_at = now()
    where id = pg_temp.fixture_id('R-A') and client_markbox = 'DUP'
      and status = 'reportado' and deleted_at is null;
    get diagnostics v_count = row_count;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
  end;
  raise notice 'DIAG 0420 cancel_exact_action: SQLSTATE=%, affected=%, message=%', v_state, v_count, v_message;
end;
$cancel_exact_action$;
reset role;
select 'DIAG 0420 cancel_stored_state' as diagnostic,
       jsonb_build_object('report_status', r.status, 'deleted_at', r.deleted_at,
                          'invoice_paid', i.paid_amount, 'invoice_status', i.status) as observed
from public.payment_reports r join public.invoices i on i.id = r.invoice_id
where r.id = pg_temp.fixture_id('R-A');
rollback to savepoint cancellation_diagnostic;
release savepoint cancellation_diagnostic;

-- Cada prueba exploratoria revierte SU escritura con una subtransacción. Los
-- NOTICE guardan SQLSTATE, filas afectadas y valores observados antes de revertir.
-- No presupone si la política final mantendrá INSERT/UPDATE directos.
create function pg_temp.diagnose(p_label text, p_sql text, p_observe text) returns void language plpgsql as $$
declare v_state text := '00000'; v_message text := 'sin error'; v_count bigint := 0; v_observed jsonb;
begin
  begin
    execute p_sql;
    get diagnostics v_count = row_count;
    execute p_observe into v_observed;
    raise sqlstate 'PT420' using message = 'rollback de diagnóstico sintético';
  exception
    when sqlstate 'PT420' then null;
    when others then
      get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
  end;
  raise notice 'DIAG 0420 %: SQLSTATE=%, affected=%, observed=%, message=%', p_label, v_state, v_count, v_observed, v_message;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
select pg_temp.diagnose('portal_insert_confirmation_metadata', $sql$
  insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox, amount, method, paid_at, confirmed_by, confirmed_at)
  values (pg_temp.fixture_id('R-diagnostic'), pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('invoice-A'),
          'BODY', 'DUP', 25, 'otro', date '2026-09-01', pg_temp.fixture_id('accounting-A'), timestamptz '2026-09-01T12:00:00Z')
$sql$, $observe$
  select jsonb_build_object('status', status, 'confirmed_by', confirmed_by, 'confirmed_at', confirmed_at)
  from public.payment_reports where id = pg_temp.fixture_id('R-diagnostic')
$observe$);
select pg_temp.diagnose('portal_update_confirmation_metadata', $sql$
  update public.payment_reports set confirmed_by = pg_temp.fixture_id('accounting-A'), confirmed_at = timestamptz '2026-09-01T12:00:00Z'
  where id = pg_temp.fixture_id('R-A')
$sql$, $observe$
  select jsonb_build_object('status', status, 'confirmed_by', confirmed_by, 'confirmed_at', confirmed_at)
  from public.payment_reports where id = pg_temp.fixture_id('R-A')
$observe$);
select pg_temp.diagnose('portal_insert_currency_mismatch', $sql$
  insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox, amount, currency, method, paid_at)
  values (pg_temp.fixture_id('R-diagnostic'), pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('invoice-A'),
          'BODY', 'DUP', 25, 'CNY', 'otro', date '2026-09-01')
$sql$, $observe$
  select jsonb_build_object('report_currency', r.currency, 'invoice_currency', i.currency)
  from public.payment_reports r join public.invoices i on i.id = r.invoice_id where r.id = pg_temp.fixture_id('R-diagnostic')
$observe$);
select pg_temp.diagnose('portal_update_currency_mismatch', $sql$
  update public.payment_reports set currency = 'CNY' where id = pg_temp.fixture_id('R-A')
$sql$, $observe$
  select jsonb_build_object('report_currency', r.currency, 'invoice_currency', i.currency)
  from public.payment_reports r join public.invoices i on i.id = r.invoice_id where r.id = pg_temp.fixture_id('R-A')
$observe$);
-- Path de un objeto B sintético NO asociado a otro reporte: UNIQUE no puede
-- disfrazar como autorización el rechazo de un path ya utilizado.
select pg_temp.diagnose('portal_insert_foreign_proof_path', $sql$
  insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox, amount, method, paid_at, proof_path)
  values (pg_temp.fixture_id('R-diagnostic'), pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('invoice-A'),
          'BODY', 'DUP', 25, 'otro', date '2026-09-01',
          pg_temp.fixture_id('tenant-B')::text || '/' || pg_temp.fixture_id('invoice-B')::text || '/unattached/proof.pdf')
$sql$, $observe$
  select jsonb_build_object('report_tenant', tenant_id, 'proof_path', proof_path)
  from public.payment_reports where id = pg_temp.fixture_id('R-diagnostic')
$observe$);
select pg_temp.diagnose('portal_update_foreign_proof_path', $sql$
  update public.payment_reports set proof_path = pg_temp.fixture_id('tenant-B')::text || '/' || pg_temp.fixture_id('invoice-B')::text || '/unattached/proof.pdf'
  where id = pg_temp.fixture_id('R-A')
$sql$, $observe$
  select jsonb_build_object('report_tenant', tenant_id, 'proof_path', proof_path)
  from public.payment_reports where id = pg_temp.fixture_id('R-A')
$observe$);
select pg_temp.diagnose('portal_update_status_confirmed', $sql$
  update public.payment_reports set status = 'confirmado' where id = pg_temp.fixture_id('R-A')
$sql$, $observe$
  select jsonb_build_object('report_status', status) from public.payment_reports where id = pg_temp.fixture_id('R-A')
$observe$);
select pg_temp.diagnose('portal_hard_delete', $sql$
  delete from public.payment_reports where id = pg_temp.fixture_id('R-A')
$sql$, $observe$
  select jsonb_build_object('report_visible', exists(select 1 from public.payment_reports where id = pg_temp.fixture_id('R-A')))
$observe$);

select set_config('request.jwt.claim.sub', pg_temp.fixture_id('marketing-A')::text, true);
select pg_temp.diagnose('nonfinancial_rpc_confirm', $sql$
  select public.confirm_payment_report(pg_temp.fixture_id('R-A'), 'confirmado', null)
$sql$, $observe$
  select jsonb_build_object('report_status', r.status, 'invoice_paid', i.paid_amount, 'invoice_status', i.status)
  from public.payment_reports r join public.invoices i on i.id = r.invoice_id where r.id = pg_temp.fixture_id('R-A')
$observe$);
select pg_temp.diagnose('nonfinancial_direct_confirm_without_accumulator', $sql$
  update public.payment_reports set status = 'confirmado' where id = pg_temp.fixture_id('R-A')
$sql$, $observe$
  select jsonb_build_object('report_status', r.status, 'confirmed_by', r.confirmed_by, 'confirmed_at', r.confirmed_at,
                          'invoice_paid_before', 20, 'invoice_paid_after', i.paid_amount, 'invoice_status', i.status,
                          'last_payment_at', i.last_payment_at)
  from public.payment_reports r join public.invoices i on i.id = r.invoice_id where r.id = pg_temp.fixture_id('R-A')
$observe$);
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('accounting-A')::text, true);
select pg_temp.diagnose('accounting_rpc_confirm_accumulator', $sql$
  select public.confirm_payment_report(pg_temp.fixture_id('R-A'), 'confirmado', null)
$sql$, $observe$
  select jsonb_build_object('report_status', r.status, 'confirmed_by', r.confirmed_by, 'confirmed_at', r.confirmed_at,
                          'invoice_paid_before', 20, 'invoice_paid_after', i.paid_amount, 'invoice_status', i.status)
  from public.payment_reports r join public.invoices i on i.id = r.invoice_id where r.id = pg_temp.fixture_id('R-A')
$observe$);
reset role;
-- Antes del assert RED: verificar que todos los diagnósticos realmente revirtieron.
do $diagnostics_rolled_back$
begin
  if exists (
    (select row_data from reports_baseline except select to_jsonb(p) from public.payment_reports p)
    union all
    (select to_jsonb(p) from public.payment_reports p except select row_data from reports_baseline)
  ) or exists (
    (select row_data from invoices_baseline except select to_jsonb(i) from public.invoices i)
    union all
    (select to_jsonb(i) from public.invoices i except select row_data from invoices_baseline)
  ) then raise exception 'TEST 0420: un diagnóstico dejó cambios sin revertir'; end if;
end;
$diagnostics_rolled_back$;

-- Pendientes obligatorios de otro slice: cancelación/auditoría, metadatos de
-- confirmación, currency, paths y confirmación directa no financiera. No se
-- vuelven a ejecutar ni se afirman como válidos después de aplicar 0420.
create temporary table portal_policy_baseline as
  select to_jsonb(p) as definition from pg_catalog.pg_policies p
  where schemaname = 'public' and tablename = 'payment_reports' and policyname like '% portal %';
create temporary table other_policy_baseline as
  select to_jsonb(p) as definition from pg_catalog.pg_policies p
  where to_jsonb(p) not in (select definition from portal_policy_baseline);
create temporary table table_acl_baseline as
  select oid, relacl, relrowsecurity, relforcerowsecurity from pg_catalog.pg_class
  where relnamespace in ('public'::regnamespace, 'storage'::regnamespace, 'auth'::regnamespace)
    and relkind in ('r', 'p');
create temporary table function_baseline as
  select to_jsonb(p) as definition from pg_catalog.pg_proc p
  where pronamespace in ('public'::regnamespace, 'storage'::regnamespace, 'auth'::regnamespace);
create temporary table trigger_baseline as select to_jsonb(t) as definition from pg_catalog.pg_trigger t;
create temporary table storage_baseline as
  select 'buckets'::text as source, to_jsonb(b) as row_data from storage.buckets b
  union all select 'objects', to_jsonb(o) from storage.objects o;
create temporary table identity_baseline as
  select 'clients'::text as source, to_jsonb(c) as row_data from public.clients c
  union all select 'client_users', to_jsonb(cu) from public.client_users cu
  union all select 'user_tenants', to_jsonb(ut) from public.user_tenants ut;
create temporary table team_rows as select id from public.payment_reports where tenant_id = pg_temp.fixture_id('tenant-A');
grant select on team_rows to authenticated;
grant select on reports_baseline to service_role;
\if :apply_fix
\ir ../migrations/0420_portal_payment_reports_tenant_boundary.sql
do $preflight_drift$
declare v_ddl text; v_rejected boolean; v_drift_count integer := 0;
begin
  foreach v_ddl in array array[
    'create policy "0420 unexpected" on public.payment_reports for select to authenticated using (true)',
    'drop policy "payment_reports portal self insert" on public.payment_reports',
    'alter policy "payment_reports portal self read" on public.payment_reports to anon',
    'alter policy "payment_reports service_role all" on public.payment_reports to authenticated',
    'drop policy "payment_reports portal self read" on public.payment_reports; create policy "payment_reports portal self read" on public.payment_reports for insert to authenticated with check (true)',
    'drop policy "payment_reports portal self read" on public.payment_reports; create policy "payment_reports portal self read" on public.payment_reports as restrictive for select to authenticated using (true)',
    'alter table public.clients disable row level security',
    'alter table public.client_users disable row level security',
    'alter table public.payment_reports disable row level security',
    'alter function auth.uid() rename to uid_unavailable_fixture'
  ] loop
    begin
      execute v_ddl;
      v_rejected := false;
      begin execute pg_catalog.pg_read_file('/sb/migrations/0420_portal_payment_reports_tenant_boundary.sql');
      exception when raise_exception then
        if sqlerrm not like '0420:%' then raise; end if;
        v_rejected := true;
      end;
      if not v_rejected then raise exception 'TEST 0420: preflight aceptó drift: %', v_ddl; end if;
      raise sqlstate 'PT420' using message = 'rollback de drift sintético';
    exception when sqlstate 'PT420' then null;
    end;
    v_drift_count := v_drift_count + 1;
  end loop;
  raise notice 'TEST 0420: % drifts de preflight rechazados y revertidos', v_drift_count;
end;
$preflight_drift$;
do $three_substitutions$
begin
  if (select count(*) from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'payment_reports') <> 5
     or (select count(*) from portal_policy_baseline) <> 3
     or (select count(*) from pg_catalog.pg_policies p join portal_policy_baseline b
         on b.definition->>'schemaname' = p.schemaname and b.definition->>'tablename' = p.tablename
         and b.definition->>'policyname' = p.policyname
         where b.definition is distinct from to_jsonb(p)) <> 3 then
    raise exception 'TEST 0420: no sustituyó exactamente tres policies Portal de cinco';
  end if;
  if exists (select 1 from pg_catalog.pg_policies p join portal_policy_baseline b
      on b.definition->>'schemaname' = p.schemaname and b.definition->>'tablename' = p.tablename
      and b.definition->>'policyname' = p.policyname
      where b.definition - 'qual' - 'with_check' is distinct from to_jsonb(p) - 'qual' - 'with_check') then
    raise exception 'TEST 0420: cambió roles, comandos o modo de las policies Portal';
  end if;
end;
$three_substitutions$;
\endif
do $unchanged_catalogs$
begin
  if exists (
    (select definition from other_policy_baseline except
     select to_jsonb(p) from pg_catalog.pg_policies p where not exists (
       select 1 from portal_policy_baseline b where b.definition->>'schemaname' = p.schemaname
         and b.definition->>'tablename' = p.tablename and b.definition->>'policyname' = p.policyname))
    union all
    (select to_jsonb(p) from pg_catalog.pg_policies p where not exists (
       select 1 from portal_policy_baseline b where b.definition->>'schemaname' = p.schemaname
         and b.definition->>'tablename' = p.tablename and b.definition->>'policyname' = p.policyname)
     except select definition from other_policy_baseline)
  ) or exists (
    select 1 from table_acl_baseline b full join (
      select oid, relacl, relrowsecurity, relforcerowsecurity from pg_catalog.pg_class
      where relnamespace in ('public'::regnamespace, 'storage'::regnamespace, 'auth'::regnamespace)
        and relkind in ('r', 'p')
    ) c using (oid)
    where b.oid is null or c.oid is null or c.relacl is distinct from b.relacl
      or c.relrowsecurity is distinct from b.relrowsecurity or c.relforcerowsecurity is distinct from b.relforcerowsecurity
  ) or exists (
    (select definition from function_baseline except select to_jsonb(p) from pg_catalog.pg_proc p
     where pronamespace in ('public'::regnamespace, 'storage'::regnamespace, 'auth'::regnamespace))
    union all
    (select to_jsonb(p) from pg_catalog.pg_proc p
     where pronamespace in ('public'::regnamespace, 'storage'::regnamespace, 'auth'::regnamespace)
     except select definition from function_baseline)
  ) or exists (
    (select definition from trigger_baseline except select to_jsonb(t) from pg_catalog.pg_trigger t)
    union all
    (select to_jsonb(t) from pg_catalog.pg_trigger t except select definition from trigger_baseline)
  ) then raise exception 'TEST 0420: cambió policy no Portal/Storage, ACL, RLS, función o trigger'; end if;
end;
$unchanged_catalogs$;
create function pg_temp.assert_rows_unchanged() returns void language plpgsql as $$
begin
  if exists (
    (select row_data from reports_baseline except select to_jsonb(p) from public.payment_reports p)
    union all (select to_jsonb(p) from public.payment_reports p except select row_data from reports_baseline)
  ) or exists (
    (select row_data from invoices_baseline except select to_jsonb(i) from public.invoices i)
    union all (select to_jsonb(i) from public.invoices i except select row_data from invoices_baseline)
  ) or exists (
    with current_storage as (
      select 'buckets'::text as source, to_jsonb(b) as row_data from storage.buckets b
      union all select 'objects', to_jsonb(o) from storage.objects o
    )
    (select * from storage_baseline except select * from current_storage)
    union all (select * from current_storage except select * from storage_baseline)
  ) or exists (
    with current_identity as (
      select 'clients'::text as source, to_jsonb(c) as row_data from public.clients c
      union all select 'client_users', to_jsonb(cu) from public.client_users cu
      union all select 'user_tenants', to_jsonb(ut) from public.user_tenants ut
    )
    (select * from identity_baseline except select * from current_identity)
    union all (select * from current_identity except select * from identity_baseline)
  ) then raise exception 'TEST 0420: cambió datos/historia/identidad/bucket/objetos o quedó residuo de pruebas'; end if;
end;
$$;
select pg_temp.assert_rows_unchanged();
create function pg_temp.expect_sqlstate(p_sql text, p_expected text) returns void language plpgsql as $$
declare v_state text := '00000';
begin
  begin execute p_sql;
  exception when others then get stacked diagnostics v_state = returned_sqlstate; end;
  if v_state <> p_expected then
    raise exception 'TEST 0420: SQLSTATE %, esperado %, sentencia %', v_state, p_expected, p_sql;
  end if;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
do $expected_cross_tenant_guard$
begin
  if exists (select 1 from public.payment_reports where id = pg_temp.fixture_id('R-B')) then
    raise exception 'TEST 0420 RED: Portal A leyó reporte B con mismo Shipping Mark e invoice_code';
  end if;
  if not exists (select 1 from public.payment_reports where id = pg_temp.fixture_id('R-A')) then
    raise exception 'TEST 0420: se denegó lectura propia A para esconder el cruce';
  end if;
end;
$expected_cross_tenant_guard$;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-B')::text, true);
do $reverse_cross_tenant_guard$
begin
  if exists (select 1 from public.payment_reports where id = pg_temp.fixture_id('R-A'))
     or not exists (select 1 from public.payment_reports where id = pg_temp.fixture_id('R-B')) then
    raise exception 'TEST 0420: frontera inversa B/A incorrecta';
  end if;
end;
$reverse_cross_tenant_guard$;
reset role;

-- Leer historia no exige factura viva ni pendiente; el borrado del propio
-- reporte sí lo oculta. El legado incoherente no se declara válido ni saneado.
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
do $read_history$
begin
  if (select count(*) from public.payment_reports where id in (
      pg_temp.fixture_id('R-A-confirmed'), pg_temp.fixture_id('R-A-rejected'),
      pg_temp.fixture_id('R-A-history'), pg_temp.fixture_id('R-A-paid'))) <> 4 then
    raise exception 'TEST 0420: perdió historia propia confirmada/rechazada o de factura pagada/archivada';
  end if;
  if exists (select 1 from public.payment_reports
      where id in (pg_temp.fixture_id('R-A-deleted'), pg_temp.fixture_id('R-A-other'))
        or tenant_id <> pg_temp.fixture_id('tenant-A') or client_markbox <> 'DUP') then
    raise exception 'TEST 0420: Portal A leyó reporte borrado, otro cliente o tenant';
  end if;
end;
$read_history$;
do $cross_writes_both_directions$
declare v record; v_count bigint;
begin
  for v in select * from (values ('A', 'B'), ('B', 'A')) x(own_side, foreign_side) loop
    perform set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-' || v.own_side)::text, true);
    update public.payment_reports set amount = amount + 1, note = 'cross update'
    where id = pg_temp.fixture_id('R-' || v.foreign_side);
    get diagnostics v_count = row_count;
    if v_count <> 0 then raise exception 'TEST 0420: UPDATE ajeno % -> %', v.own_side, v.foreign_side; end if;
    perform pg_temp.expect_sqlstate(format(
      'insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox, amount, method, paid_at)
       values (%L, %L, %L, %L, %L, 25, %L, %L)',
      pg_temp.fixture_id('R-cross-insert'), pg_temp.fixture_id('tenant-' || v.foreign_side),
      pg_temp.fixture_id('invoice-' || v.foreign_side), 'BODY', 'DUP', 'otro', '2026-09-01'), '42501');
    perform pg_temp.expect_sqlstate(format(
      'update public.payment_reports set tenant_id = %L, invoice_id = %L where id = %L',
      pg_temp.fixture_id('tenant-' || v.foreign_side), pg_temp.fixture_id('invoice-' || v.foreign_side),
      pg_temp.fixture_id('R-' || v.own_side)), '42501');
    -- Tampoco se puede capturar una fila ajena trayéndola al tenant propio.
    update public.payment_reports
    set tenant_id = pg_temp.fixture_id('tenant-' || v.own_side), invoice_id = pg_temp.fixture_id('invoice-' || v.own_side)
    where id = pg_temp.fixture_id('R-' || v.foreign_side);
    get diagnostics v_count = row_count;
    if v_count <> 0 then raise exception 'TEST 0420: capturó reporte ajeno hacia %', v.own_side; end if;
    delete from public.payment_reports where id in (pg_temp.fixture_id('R-A'), pg_temp.fixture_id('R-B'));
    get diagnostics v_count = row_count;
    if v_count <> 0 then raise exception 'TEST 0420: Portal puro obtuvo DELETE'; end if;
  end loop;
end;
$cross_writes_both_directions$;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
do $same_tenant_other_client$
declare v_count bigint;
begin
  update public.payment_reports set amount = amount + 1 where id = pg_temp.fixture_id('R-A-other');
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'TEST 0420: modificó otro cliente del mismo tenant'; end if;
  perform pg_temp.expect_sqlstate(format(
    'insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox, amount, method, paid_at)
     values (%L, %L, %L, %L, %L, 25, %L, %L)',
    pg_temp.fixture_id('R-other-insert'), pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('invoice-A-other'),
    'BODY', 'OTHER', 'otro', '2026-09-01'), '42501');
  perform pg_temp.expect_sqlstate(format(
    'update public.payment_reports set invoice_id = %L, client_markbox = %L where id = %L',
    pg_temp.fixture_id('invoice-A-other'), 'OTHER', pg_temp.fixture_id('R-A')), '42501');
end;
$same_tenant_other_client$;
reset role;

savepoint own_writer;
set local role authenticated;
do $own_insert_update$
declare v_side text; v_status text; v_count bigint; v_report public.payment_reports;
begin
  foreach v_side in array array['A', 'B'] loop
    perform set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-' || v_side)::text, true);
    insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox, amount, method, paid_at)
    values (pg_temp.fixture_id('R-new-' || v_side), pg_temp.fixture_id('tenant-' || v_side),
            pg_temp.fixture_id('invoice-' || v_side), 'BODY-FORGED', 'DUP', 40, 'otro', date '2026-09-01')
    returning * into v_report;
    if v_report.id is null or v_report.invoice_code <> 'F-TEST-0001' or v_report.status <> 'reportado' then
      raise exception 'TEST 0420: INSERT propio % perdió estado o snapshot de factura', v_side;
    end if;
    update public.payment_reports set amount = 65, note = 'edición propia', invoice_code = 'BODY-FORGED-AGAIN'
    where id = v_report.id returning * into v_report;
    get diagnostics v_count = row_count;
    if v_count <> 1 or v_report.amount <> 65 or v_report.note <> 'edición propia' or v_report.invoice_code <> 'F-TEST-0001' then
      raise exception 'TEST 0420: UPDATE propio % o sellado de snapshot se rompió', v_side;
    end if;
    foreach v_status in array array['confirmado', 'rechazado'] loop
      perform pg_temp.expect_sqlstate(format(
        'insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox, amount, method, paid_at, status)
         values (%L, %L, %L, %L, %L, 25, %L, %L, %L)',
        pg_temp.fixture_id('R-status-forbidden'), pg_temp.fixture_id('tenant-' || v_side),
        pg_temp.fixture_id('invoice-' || v_side), 'BODY', 'DUP', 'otro', '2026-09-01', v_status), '42501');
      perform pg_temp.expect_sqlstate(format(
        'update public.payment_reports set status = %L where id = %L', v_status, v_report.id), '42501');
    end loop;
  end loop;
  perform set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
  update public.payment_reports set note = 'terminal modificado'
  where id in (pg_temp.fixture_id('R-A-confirmed'), pg_temp.fixture_id('R-A-rejected'));
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'TEST 0420: Portal editó reporte terminal'; end if;
end;
$own_insert_update$;
reset role;
rollback to savepoint own_writer;
release savepoint own_writer;

set local role authenticated;
do $invalid_principals$
declare v record; v_count bigint;
begin
  for v in select * from (values
    ('revoked', 'invoice-A-other', 'OTHER'), ('retired', 'invoice-retired', 'DEAD'),
    ('incoherent', 'invoice-A-other', 'OTHER'), ('invited', 'invoice-invited', 'INVITED'),
    ('unlinked', 'invoice-A', 'DUP'), ('unknown-auth-user', 'invoice-A', 'DUP'),
    ('team-disabled', 'invoice-A', 'DUP'), (null, 'invoice-A', 'DUP')
  ) x(principal, invoice_label, markbox) loop
    perform set_config('request.jwt.claim.sub', coalesce(pg_temp.fixture_id(v.principal)::text, ''), true);
    if exists (select 1 from public.payment_reports) then
      raise exception 'TEST 0420: principal inválido % obtuvo lectura', coalesce(v.principal, 'sin auth.uid');
    end if;
    update public.payment_reports set amount = amount + 1;
    get diagnostics v_count = row_count;
    if v_count <> 0 then raise exception 'TEST 0420: principal inválido % obtuvo UPDATE', v.principal; end if;
    delete from public.payment_reports;
    get diagnostics v_count = row_count;
    if v_count <> 0 then raise exception 'TEST 0420: principal inválido % obtuvo DELETE', v.principal; end if;
    -- La factura de cada intento sí es coherente con el tenant/markbox de la
    -- fila: el rechazo debe venir de identidad/RLS, no del trigger de factura.
    perform pg_temp.expect_sqlstate(format(
      'insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox, amount, method, paid_at)
       values (%L, %L, %L, %L, %L, 25, %L, %L)',
      pg_temp.fixture_id('R-invalid-principal'), pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id(v.invoice_label),
      'BODY', v.markbox, 'otro', '2026-09-01'), '42501');
  end loop;
end;
$invalid_principals$;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
do $historical_invoice_trigger$
declare v_invoice text;
begin
  foreach v_invoice in array array['invoice-B', 'invoice-A-other', 'invoice-A-draft', 'invoice-A-history', 'invoice-missing'] loop
    perform pg_temp.expect_sqlstate(format(
      'insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox, amount, method, paid_at)
       values (%L, %L, %L, %L, %L, 25, %L, %L)',
      pg_temp.fixture_id('R-bad-invoice'), pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id(v_invoice),
      'BODY', 'DUP', 'otro', '2026-09-01'), '23514');
    perform pg_temp.expect_sqlstate(format(
      'update public.payment_reports set invoice_id = %L where id = %L',
      pg_temp.fixture_id(v_invoice), pg_temp.fixture_id('R-A')), '23514');
  end loop;
end;
$historical_invoice_trigger$;
reset role;

-- Compatibilidad positiva del equipo: alcance por tenant de0230, CRUD sobre
-- una fila válida y RPC financiera0359 con acumulador, no confirmación directa.
savepoint team_compatibility;
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('accounting-A')::text, true);
do $team_compatibility$
declare v_count bigint; v_report public.payment_reports;
begin
  if exists ((select id from team_rows except select id from public.payment_reports)
      union all (select id from public.payment_reports except select id from team_rows)) then
    raise exception 'TEST 0420: cambió lectura interna por tenant o historial borrado de0230';
  end if;
  insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox, amount, method, paid_at)
  values (pg_temp.fixture_id('R-team-new'), pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('invoice-A-other'),
          'BODY', 'OTHER', 30, 'otro', date '2026-09-01');
  update public.payment_reports set amount = 45 where id = pg_temp.fixture_id('R-team-new');
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0420: perdió UPDATE interno'; end if;
  delete from public.payment_reports where id = pg_temp.fixture_id('R-team-new');
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0420: perdió DELETE interno'; end if;
  select * into v_report from public.confirm_payment_report(pg_temp.fixture_id('R-A'), 'confirmado', null);
  if v_report.status <> 'confirmado' or v_report.confirmed_by <> pg_temp.fixture_id('accounting-A')
     or v_report.confirmed_at is null or not exists (
       select 1 from public.invoices where id = pg_temp.fixture_id('invoice-A') and paid_amount = 120 and status = 'parcial') then
    raise exception 'TEST 0420: rompió RPC financiera o acumulador real';
  end if;
end;
$team_compatibility$;
reset role;
rollback to savepoint team_compatibility;
release savepoint team_compatibility;

savepoint dual_principal;
insert into public.user_tenants values (pg_temp.fixture_id('portal-B'), pg_temp.fixture_id('tenant-A'), 'marketing', null);
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-B')::text, true);
do $dual_principal$
declare v_count bigint;
begin
  if exists ((select id from team_rows except select id from public.payment_reports where tenant_id = pg_temp.fixture_id('tenant-A'))
      union all (select id from public.payment_reports where tenant_id = pg_temp.fixture_id('tenant-A') except select id from team_rows))
     or not exists (select 1 from public.payment_reports where id = pg_temp.fixture_id('R-B'))
     or exists (select 1 from public.payment_reports where id = pg_temp.fixture_id('R-B-other')) then
    raise exception 'TEST 0420: principal dual perdió equipo A/Portal B o amplió acceso a otro cliente B';
  end if;
  update public.payment_reports set amount = amount + 1
  where id in (pg_temp.fixture_id('R-A-other'), pg_temp.fixture_id('R-B'));
  get diagnostics v_count = row_count;
  if v_count <> 2 then raise exception 'TEST 0420: principal dual perdió UPDATE interno/propio'; end if;
  update public.payment_reports set amount = amount + 1 where id = pg_temp.fixture_id('R-B-other');
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'TEST 0420: principal dual editó otro cliente B'; end if;
  perform pg_temp.expect_sqlstate(format(
    'insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox, amount, method, paid_at)
     values (%L, %L, %L, %L, %L, 25, %L, %L)',
    pg_temp.fixture_id('R-dual-forbidden'), pg_temp.fixture_id('tenant-B'), pg_temp.fixture_id('invoice-B-other'),
    'BODY', 'OTHER', 'otro', '2026-09-01'), '42501');
  delete from public.payment_reports where id = pg_temp.fixture_id('R-B');
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'TEST 0420: rol interno A habilitó DELETE Portal B'; end if;
end;
$dual_principal$;
reset role;
rollback to savepoint dual_principal;
release savepoint dual_principal;

savepoint service_compatibility;
set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
do $service_compatibility$
declare v_count bigint;
begin
  if (select count(*) from public.payment_reports) <> (select count(*) from reports_baseline) then
    raise exception 'TEST 0420: cambió lectura service_role';
  end if;
  insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox, amount, method, paid_at)
  values (pg_temp.fixture_id('R-service-new'), pg_temp.fixture_id('tenant-B'), pg_temp.fixture_id('invoice-B-other'),
          'BODY', 'OTHER', 30, 'otro', date '2026-09-01');
  update public.payment_reports set amount = 45 where id = pg_temp.fixture_id('R-service-new');
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0420: perdió UPDATE service_role'; end if;
  delete from public.payment_reports where id = pg_temp.fixture_id('R-service-new');
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'TEST 0420: perdió DELETE service_role'; end if;
  if not exists (select 1 from storage.objects where id = pg_temp.fixture_id('proof-B-free')) then
    raise exception 'TEST 0420: service_role perdió objeto Storage existente';
  end if;
end;
$service_compatibility$;
reset role;
rollback to savepoint service_compatibility;
release savepoint service_compatibility;

set local role anon;
select pg_temp.expect_sqlstate('select * from public.payment_reports', '42501');
reset role;
select pg_temp.assert_rows_unchanged();
rollback;
select to_regclass('public.payment_reports') is null as fixture_rolled_back;
