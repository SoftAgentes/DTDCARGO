\set ON_ERROR_STOP on
-- SDD-0365 etapa 2. Fixture sintético aislado; no ejecutar sobre una DB real.
-- RED: psql -v apply_fix=false -f /sb/tests/0421_payment_report_commands.test.sql
-- Auditoría REAL: 0258/0261/0267/0294; nunca sustituye append_audit_event.
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
  if to_regclass('public.payment_reports') is not null or to_regclass('public.tenants') is not null
     or to_regclass('public.entity_audit_log') is not null then
    raise exception 'TEST 0421: fixture rechazada, la base ya contiene objetos de aplicación';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$fixture_guard$;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
create schema extensions;
create schema storage;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema auth, storage to authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.tenants (id uuid primary key);
-- Columnas de 0001/0019; las membresías y el principal se consultan de verdad.
create table public.user_tenants (
  user_id uuid not null references auth.users(id), tenant_id uuid not null references public.tenants(id),
  role text not null, disabled_at timestamptz, primary key (user_id, tenant_id)
);
alter table public.user_tenants enable row level security;
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
alter table public.clients enable row level security;
alter table public.shipments enable row level security;
grant select on public.clients to authenticated;
create policy "clients by tenant" on public.clients for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
create table storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text,
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated, service_role;
create function storage.foldername(text) returns text[] language sql immutable as $$
  select string_to_array($1, '/')
$$;
-- Plataforma legacy mínima de0267; esquema/constraints/writer v1 se instalan
-- desde las migraciones reales, no de una función de auditoría simulada.
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
\ir ../migrations/0080_portal_cliente.sql
\ir ../migrations/0085_portal_invoices_rls.sql
\ir ../migrations/0195_payment_reports.sql
\ir ../migrations/0230_fix_rls_soft_delete_blocked.sql
\ir ../migrations/0258_audit_entity_catalog.sql
\ir ../migrations/0261_audit_entity_catalog_validate.sql
\ir ../migrations/0267_audit_contract_append_only.sql
-- Wrapper vigente de motivo humano; las RPC laterales se crean pero no se
-- ejecutan, igual que los stubs de plataforma usados por contratos históricos.
\ir ../migrations/0294_audit_d2_human_reasons.sql
\ir ../migrations/0351_operario_rpc_exige_rol.sql
\ir ../migrations/0359_confirm_payment_report_exige_rol.sql
\ir ../migrations/0363_storage_bug_replays_restrictive.sql
\ir ../migrations/0420_portal_payment_reports_tenant_boundary.sql

create function pg_temp.fixture_id(p_label text) returns uuid language sql immutable as $$
  select md5('0421-synthetic-' || p_label)::uuid
$$;
create function pg_temp.proof_path(p_tenant text, p_invoice text, p_report text, p_object text default 'object')
returns text language sql immutable as $$
  select pg_temp.fixture_id(p_tenant)::text || '/' || pg_temp.fixture_id(p_invoice)::text || '/' ||
    pg_temp.fixture_id(p_report)::text || '/' || pg_temp.fixture_id(p_object)::text || '.pdf'
$$;
insert into public.tenants values (pg_temp.fixture_id('tenant-A')), (pg_temp.fixture_id('tenant-B'));
insert into auth.users (id, email) select pg_temp.fixture_id(v), v || '@example.invalid' from unnest(array[
  'portal-A', 'portal-B', 'revoked', 'invited', 'retired', 'incoherent', 'unlinked', 'dual',
  'accounting-A', 'admin-A', 'marketing-A', 'disabled-A', 'accounting-B'
]) v;
insert into public.user_tenants values
  (pg_temp.fixture_id('accounting-A'), pg_temp.fixture_id('tenant-A'), 'accounting', null),
  (pg_temp.fixture_id('admin-A'), pg_temp.fixture_id('tenant-A'), 'admin', null),
  (pg_temp.fixture_id('marketing-A'), pg_temp.fixture_id('tenant-A'), 'marketing', null),
  (pg_temp.fixture_id('disabled-A'), pg_temp.fixture_id('tenant-A'), 'accounting', now()),
  (pg_temp.fixture_id('accounting-B'), pg_temp.fixture_id('tenant-B'), 'accounting', null),
  (pg_temp.fixture_id('dual'), pg_temp.fixture_id('tenant-A'), 'accounting', null);
insert into public.clients (id, tenant_id, markbox, deleted_at)
select pg_temp.fixture_id(v.label), pg_temp.fixture_id(v.tenant), v.markbox, case when v.retired then now() else null end
from (values
  ('client-A', 'tenant-A', 'DUP', false), ('client-A-other', 'tenant-A', 'OTHER', false),
  ('client-retired', 'tenant-A', 'DEAD', true), ('client-invited', 'tenant-A', 'INVITED', false),
  ('client-B', 'tenant-B', 'DUP', false), ('client-B-other', 'tenant-B', 'OTHER', false),
  ('client-dual', 'tenant-B', 'DUAL', false)
) v(label, tenant, markbox, retired);
insert into public.client_users (auth_user_id, tenant_id, client_id, email, status)
select pg_temp.fixture_id(v.principal), pg_temp.fixture_id(v.tenant), pg_temp.fixture_id(v.client),
  v.principal || '@example.invalid', v.status
from (values
  ('portal-A', 'tenant-A', 'client-A', 'active'), ('portal-B', 'tenant-B', 'client-B', 'active'),
  ('revoked', 'tenant-A', 'client-A-other', 'revoked'), ('retired', 'tenant-A', 'client-retired', 'active'),
  ('incoherent', 'tenant-A', 'client-B-other', 'active'), ('invited', 'tenant-A', 'client-invited', 'invited'),
  ('dual', 'tenant-B', 'client-dual', 'active')
) v(principal, tenant, client, status);
insert into public.invoices (id, tenant_id, invoice_code, client_markbox, client_name, base_amount, total_amount, paid_amount, status, currency)
select pg_temp.fixture_id(v.label), pg_temp.fixture_id(v.tenant), v.code, v.markbox, 'synthetic',
  1000, 1000, 20, 'emitida', v.currency::public.invoice_currency
from (values
  ('invoice-A', 'tenant-A', 'F-CMD-SHARED', 'DUP', 'USD'), ('invoice-B', 'tenant-B', 'F-CMD-SHARED', 'DUP', 'CNY'),
  ('invoice-B-only', 'tenant-B', 'F-B-ONLY', 'DUP', 'USD'), ('invoice-A-other', 'tenant-A', 'F-OTHER', 'OTHER', 'USD'),
  ('invoice-retired', 'tenant-A', 'F-DEAD', 'DEAD', 'USD'), ('invoice-invited', 'tenant-A', 'F-INVITED', 'INVITED', 'USD'),
  ('invoice-incoherent', 'tenant-A', 'F-INCOHERENT', 'OTHER', 'USD'), ('invoice-dual', 'tenant-B', 'F-DUAL', 'DUAL', 'USD'),
  ('invoice-limit', 'tenant-A', 'F-LIMIT', 'DUP', 'USD'), ('invoice-draft', 'tenant-A', 'F-DRAFT', 'DUP', 'USD'),
  ('invoice-paid', 'tenant-A', 'F-PAID', 'DUP', 'USD'), ('invoice-void', 'tenant-A', 'F-VOID', 'DUP', 'USD'),
  ('invoice-archived', 'tenant-A', 'F-ARCHIVED', 'DUP', 'USD'),
  ('invoice-audit', 'tenant-A', 'F-AUDIT', 'DUP', 'USD'),
  ('invoice-overpay', 'tenant-A', 'F-OVERPAY', 'DUP', 'USD')
) v(label, tenant, code, markbox, currency);
insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox, amount, currency, method, paid_at, note, proof_path)
select pg_temp.fixture_id(v.label), i.tenant_id, i.id, 'UNTRUSTED', i.client_markbox, 100, i.currency, 'otro', current_date - 1,
  'Nota original sintética', pg_temp.proof_path(v.tenant, v.invoice, v.label)
from (values
  ('legacy-A', 'tenant-A', 'invoice-A'), ('legacy-B', 'tenant-B', 'invoice-B'),
  ('legacy-other', 'tenant-A', 'invoice-A-other'), ('legacy-archived', 'tenant-A', 'invoice-archived'),
  ('audit-cancel', 'tenant-A', 'invoice-audit'), ('audit-resolve', 'tenant-A', 'invoice-audit')
) v(label, tenant, invoice) join public.invoices i on i.id = pg_temp.fixture_id(v.invoice);
insert into storage.objects (bucket_id, name) select 'payment-proofs', proof_path from public.payment_reports;
-- Objetos subidos antes de los comandos; el comando sólo los vincula.
insert into storage.objects (bucket_id, name)
select 'payment-proofs', pg_temp.proof_path(v.tenant, v.invoice, v.report)
from (values
  ('tenant-A', 'invoice-A', 'new-A'), ('tenant-B', 'invoice-B', 'new-B'),
  ('tenant-A', 'invoice-A', 'cancel-A'), ('tenant-A', 'invoice-A', 'confirm-A'),
  ('tenant-A', 'invoice-A', 'reject-A'), ('tenant-A', 'invoice-overpay', 'overpay-A'),
  ('tenant-A', 'invoice-audit', 'audit-create'), ('tenant-B', 'invoice-dual', 'new-dual'),
  ('tenant-A', 'invoice-A', 'invalid'), ('tenant-A', 'invoice-A', 'boundary'),
  ('tenant-A', 'invoice-draft', 'invalid-draft'), ('tenant-A', 'invoice-paid', 'invalid-paid'),
  ('tenant-A', 'invoice-void', 'invalid-void'), ('tenant-A', 'invoice-archived', 'invalid-archived'),
  ('tenant-A', 'invoice-retired', 'invalid-retired'), ('tenant-A', 'invoice-invited', 'invalid-invited'),
  ('tenant-A', 'invoice-incoherent', 'invalid-incoherent'), ('tenant-A', 'invoice-A-other', 'invalid-other'),
  ('tenant-B', 'invoice-B-only', 'invalid-cross')
) v(tenant, invoice, report);
insert into storage.objects (bucket_id, name)
select 'payment-proofs', pg_temp.proof_path('tenant-A', 'invoice-limit', 'limit-' || n)
from generate_series(1, 6) n;
insert into storage.buckets (id, name, public) values ('synthetic-other', 'synthetic-other', false);
insert into storage.objects (bucket_id, name)
values ('synthetic-other', pg_temp.proof_path('tenant-A', 'invoice-A', 'wrong-bucket'));
-- Los objetos malformados existen: el rechazo debe ser por el alcance/path,
-- no accidentalmente por la inexistencia del archivo en Storage.
insert into storage.objects (bucket_id, name)
select 'payment-proofs', v_path from unnest(array[
  pg_temp.proof_path('tenant-B','invoice-A','invalid'),
  pg_temp.proof_path('tenant-A','invoice-B','invalid'),
  'https://example.invalid/proof.pdf', '../proof.pdf', '/absolute/proof.pdf',
  replace(pg_temp.proof_path('tenant-A','invoice-A','invalid'),'/','//'),
  pg_temp.proof_path('tenant-A','invoice-A','invalid') || E'\n',
  replace(pg_temp.proof_path('tenant-A','invoice-A','invalid'),'.pdf','.exe'),
  replace(pg_temp.proof_path('tenant-A','invoice-A','invalid'),'.pdf','.html')
]) v_path;
update public.invoices set status = 'borrador' where id = pg_temp.fixture_id('invoice-draft');
update public.invoices set status = 'pagada', paid_amount = 1000 where id = pg_temp.fixture_id('invoice-paid');
update public.invoices set status = 'anulada' where id = pg_temp.fixture_id('invoice-void');
update public.invoices set deleted_at = now() where id = pg_temp.fixture_id('invoice-archived');

-- Evidencia causal heredada: con identidad A real el UPDATE de cancelación
-- no puede mover deleted_at fuera del predicado SELECT. Sólo diagnóstico.
savepoint legacy_cancellation;
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
do $legacy_cancellation$
declare v_state text := '00000'; v_rows bigint := 0;
begin
  begin
    update public.payment_reports set deleted_at = now()
    where id = pg_temp.fixture_id('legacy-A') and invoice_code = 'F-CMD-SHARED'
      and client_markbox = 'DUP' and status = 'reportado' and deleted_at is null;
    get diagnostics v_rows = row_count;
  exception when others then get stacked diagnostics v_state = returned_sqlstate;
  end;
  raise notice 'TEST 0421 legado: cancelación de sesión SQLSTATE %, filas %', v_state, v_rows;
end;
$legacy_cancellation$;
reset role;
rollback to savepoint legacy_cancellation;
release savepoint legacy_cancellation;

create temporary table baseline_storage as select to_jsonb(o) as row_data from storage.objects o;
create temporary table baseline_buckets as select to_jsonb(b) as row_data from storage.buckets b;
create temporary table baseline_policies as select to_jsonb(p) as definition from pg_catalog.pg_policies p;
create temporary table baseline_acl as select c.oid, c.relacl from pg_class c
where c.oid in ('public.payment_reports'::regclass, 'public.invoices'::regclass,
  'public.entity_audit_log'::regclass, 'storage.objects'::regclass, 'storage.buckets'::regclass);
create temporary table baseline_triggers as select t.oid, to_jsonb(t) as definition
from pg_trigger t where not t.tgisinternal;
create temporary table baseline_rows as select to_jsonb(p) as row_data from public.payment_reports p;
create temporary table baseline_functions as
select p.oid, to_jsonb(p) as definition from pg_catalog.pg_proc p
join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','auth','storage');

\if :apply_fix
\ir ../migrations/0421_payment_report_commands.sql
\endif

do $expected_api$
begin
  if to_regprocedure('public.create_portal_payment_report(uuid,uuid,text,numeric,payment_report_method,date,text,text)') is null
     or to_regprocedure('public.cancel_portal_payment_report(uuid,uuid,text,text)') is null
     or to_regprocedure('public.resolve_payment_report(uuid,uuid,payment_report_status,text)') is null then
    raise exception 'TEST 0421 RED: faltan las tres APIs de comandos auditados de SDD-0365';
  end if;
end;
$expected_api$;

-- Sólo para un segundo PostgreSQL desechable vacío y explícitamente autorizado:
-- permite ensayos de concurrencia con sesiones independientes. Nunca Cloud.
-- El modo predeterminado conserva BEGIN/ROLLBACK y no deja datos.
\if :fixture_only
commit;
\quit
\endif

-- Helpers de observación: APIs reales bajo rol API y auth.uid de la fixture.
-- No reemplazan autorización ni writer.
create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0421: %', p_label; end if;
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
create function pg_temp.create_sql(p_request text, p_report text,
  p_invoice text default 'invoice-A', p_override jsonb default '{}'::jsonb)
returns text language plpgsql as $$
declare v_i public.invoices%rowtype; v_input jsonb;
begin
  select * into strict v_i from public.invoices where id = pg_temp.fixture_id(p_invoice);
  v_input := jsonb_build_object('request', pg_temp.fixture_id(p_request), 'report', pg_temp.fixture_id(p_report),
    'code', v_i.invoice_code, 'amount', 100, 'method', 'otro', 'paid_at', current_date - 1,
    'path', v_i.tenant_id::text || '/' || v_i.id::text || '/' || pg_temp.fixture_id(p_report)::text || '/' ||
      pg_temp.fixture_id('object')::text || '.pdf', 'note', null) || p_override;
  return format('select public.create_portal_payment_report(%L::uuid,%L::uuid,%L,%L::numeric,%L::public.payment_report_method,%L::date,%L,%L)',
    v_input->>'request', v_input->>'report', v_input->>'code', v_input->>'amount',
    v_input->>'method', v_input->>'paid_at', v_input->>'path', v_input->>'note');
end;
$$;
create function pg_temp.cancel_sql(p_request text, p_report text,
  p_code text default 'F-CMD-SHARED', p_reason text default 'Cancelación solicitada')
returns text language sql as $$
  select format('select public.cancel_portal_payment_report(%L::uuid,%L::uuid,%L,%L)',
    pg_temp.fixture_id(p_request), pg_temp.fixture_id(p_report), p_code, p_reason)
$$;
create function pg_temp.resolve_sql(p_request text, p_report text,
  p_action text default 'confirmado', p_reason text default 'Pago cotejado por finanzas')
returns text language sql as $$
  select format('select public.resolve_payment_report(%L::uuid,%L::uuid,%L::public.payment_report_status,%L)',
    pg_temp.fixture_id(p_request), pg_temp.fixture_id(p_report), p_action, p_reason)
$$;
create function pg_temp.state_snapshot() returns jsonb language sql as $$
  select jsonb_build_object(
    'reports', (select jsonb_agg(to_jsonb(p) order by id) from public.payment_reports p),
    'invoices', (select jsonb_agg(to_jsonb(i) order by id) from public.invoices i),
    'events', (select jsonb_agg(to_jsonb(a) order by id) from public.entity_audit_log a),
    'receipts', (select jsonb_agg(to_jsonb(c) order by request_id) from payment_private.report_commands c),
    'objects', (select jsonb_agg(to_jsonb(o) order by id) from storage.objects o))
$$;
create function pg_temp.expect_denied(p_label text, p_actor text, p_sql text,
  p_role text default 'authenticated') returns void language plpgsql as $$
declare v_before jsonb := pg_temp.state_snapshot(); v_failed boolean := false; v_state text;
begin
  begin
    perform pg_temp.as_actor(p_actor, p_sql, p_role);
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state not like 'P%' and left(v_state, 2) not in ('22', '23') and v_state not in ('42501','55000') then
      raise exception 'TEST 0421: error inesperado de fixture en % (SQLSTATE %): %', p_label, v_state, sqlerrm;
    end if;
    v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, p_label || ': se esperaba rechazo');
  perform pg_temp.assert_true(pg_temp.state_snapshot() = v_before, p_label || ': hubo mutación parcial');
end;
$$;
create function pg_temp.assert_receipt(p_result jsonb, p_request text, p_report text,
  p_invoice text, p_status text, p_cancelled boolean, p_replayed boolean) returns void language plpgsql as $$
declare v_keys text[];
begin
  select array_agg(k order by k) into v_keys from jsonb_object_keys(p_result) k;
  perform pg_temp.assert_true(v_keys = array['audit_event_id','cancelled','invoice_code','invoice_id',
    'replayed','report_id','request_id','status'], 'resultado mínimo exacto, sin importes ni comprobante');
  perform pg_temp.assert_true(p_result @> jsonb_build_object('request_id', pg_temp.fixture_id(p_request),
    'report_id', pg_temp.fixture_id(p_report), 'invoice_id', pg_temp.fixture_id(p_invoice),
    'status', p_status, 'cancelled', p_cancelled, 'replayed', p_replayed), 'contenido del recibo');
  perform pg_temp.assert_true(p_result->>'invoice_code' =
    (select invoice_code from public.invoices where id = pg_temp.fixture_id(p_invoice)), 'snapshot de código');
  perform pg_temp.assert_true(exists(select 1 from public.entity_audit_log a
    where a.id = (p_result->>'audit_event_id')::uuid and a.entity_id = pg_temp.fixture_id(p_report)
      and a.correlation_id = pg_temp.fixture_id(p_request)::text), 'recibo vincula evento real');
end;
$$;

-- La expansión no altera historia, políticas, ACL o writers existentes.
do $unchanged_baseline$
begin
  perform pg_temp.assert_true(not exists(select 1 from baseline_rows b full join
    (select to_jsonb(p) - array['cancelled_at','cancelled_by','resolution_reason'] as row_data
     from public.payment_reports p) n using(row_data) where b.row_data is null or n.row_data is null),
    'la migración no modifica reportes históricos');
  perform pg_temp.assert_true(not exists(select 1 from baseline_policies b full join
    (select to_jsonb(p) as definition from pg_policies p) n using(definition)
    where b.definition is null or n.definition is null), 'políticas existentes intactas');
  perform pg_temp.assert_true(not exists(select 1 from baseline_acl b join pg_class c on c.oid = b.oid
    where b.relacl is distinct from c.relacl), 'ACL de tablas existentes intacta');
  perform pg_temp.assert_true(not exists(select 1 from baseline_functions b left join pg_proc p on p.oid = b.oid
    where b.definition is distinct from to_jsonb(p)), 'writer real vigente y demás funciones heredadas intactas');
  perform pg_temp.assert_true(not exists(select 1 from baseline_triggers b left join pg_trigger t on t.oid = b.oid
    where b.definition is distinct from to_jsonb(t)), 'triggers heredados intactos');
end;
$unchanged_baseline$;

-- Sin UID/vínculo, invitado, revocado, cliente retirado o vínculo incoherente.
do $identity$
declare v_actor text; v_invoice text; v_report text;
begin
  foreach v_actor in array array[null,'unlinked','revoked','invited','retired','incoherent','accounting-A'] loop
    v_invoice := case v_actor when 'retired' then 'invoice-retired' when 'invited' then 'invoice-invited'
      when 'incoherent' then 'invoice-incoherent' else 'invoice-A' end;
    v_report := case v_actor when 'retired' then 'invalid-retired' when 'invited' then 'invalid-invited'
      when 'incoherent' then 'invalid-incoherent' else 'invalid' end;
    perform pg_temp.expect_denied('create identidad ' || coalesce(v_actor,'sin UID'), v_actor,
      pg_temp.create_sql('deny-identity', v_report, v_invoice));
    perform pg_temp.expect_denied('cancel identidad ' || coalesce(v_actor,'sin UID'), v_actor,
      pg_temp.cancel_sql('deny-identity', 'legacy-A'));
  end loop;
  foreach v_actor in array array[null,'unlinked','portal-A','revoked','marketing-A','disabled-A','accounting-B'] loop
    perform pg_temp.expect_denied('resolve rol ' || coalesce(v_actor,'sin UID'), v_actor,
      pg_temp.resolve_sql('deny-role', 'legacy-A'));
  end loop;
  perform pg_temp.expect_denied('anon no invoca API', 'portal-A', pg_temp.create_sql('deny-anon','invalid'), 'anon');
  perform pg_temp.expect_denied('service sin actor no elude identidad', null,
    pg_temp.create_sql('deny-service','invalid'), 'service_role');
end;
$identity$;

do $boundaries$
begin
  perform pg_temp.expect_denied('A no crea factura B aun mismo mark', 'portal-A',
    pg_temp.create_sql('cross-create','invalid-cross','invoice-B-only'));
  perform pg_temp.expect_denied('A no usa objeto B con código compartido', 'portal-A',
    pg_temp.create_sql('cross-shared','new-B','invoice-B'));
  perform pg_temp.expect_denied('B no usa objeto A con código compartido', 'portal-B',
    pg_temp.create_sql('cross-shared','new-A','invoice-A'));
  perform pg_temp.expect_denied('A no crea factura de otro cliente del tenant', 'portal-A',
    pg_temp.create_sql('cross-client','invalid-other','invoice-A-other'));
  perform pg_temp.expect_denied('A no cancela reporte B', 'portal-A', pg_temp.cancel_sql('cross-cancel','legacy-B'));
  perform pg_temp.expect_denied('B no cancela reporte A', 'portal-B', pg_temp.cancel_sql('cross-cancel','legacy-A'));
  perform pg_temp.expect_denied('A no cancela otro cliente', 'portal-A', pg_temp.cancel_sql('cross-client','legacy-other','F-OTHER'));
  perform pg_temp.expect_denied('factura incorrecta no cancela', 'portal-A', pg_temp.cancel_sql('wrong-code','legacy-A','F-NO-EXISTE'));
  perform pg_temp.expect_denied('reporte inexistente no es éxito', 'portal-A', pg_temp.cancel_sql('no-report','missing'));
  perform pg_temp.expect_denied('equipo A no resuelve B', 'accounting-A', pg_temp.resolve_sql('cross-resolve','legacy-B'));
  perform pg_temp.expect_denied('equipo B no resuelve A', 'accounting-B', pg_temp.resolve_sql('cross-resolve','legacy-A'));
  perform pg_temp.expect_denied('principal dual no convierte rol A en permiso financiero B', 'dual', pg_temp.resolve_sql('dual-cross','legacy-B'));
  perform pg_temp.expect_denied('principal dual no usa rol A para crear como cliente A', 'dual', pg_temp.create_sql('dual-cross','invalid'));
end;
$boundaries$;

do $input_contract$
declare v_override jsonb; v_path text; v_invoice text; v_reason text;
begin
  for v_override in select value from jsonb_array_elements(jsonb_build_array(
    jsonb_build_object('request',null), jsonb_build_object('report',null), jsonb_build_object('code',null),
    jsonb_build_object('code',''), jsonb_build_object('amount',null), jsonb_build_object('amount',0),
    jsonb_build_object('amount',-1), jsonb_build_object('amount',10000000), jsonb_build_object('amount',1.001),
    jsonb_build_object('amount','NaN'), jsonb_build_object('amount','Infinity'),
    jsonb_build_object('method',null), jsonb_build_object('method','inexistente'),
    jsonb_build_object('paid_at',null), jsonb_build_object('paid_at',current_date+1),
    jsonb_build_object('paid_at','2026-02-30'), jsonb_build_object('note',repeat('x',501)),
    jsonb_build_object('path',null), jsonb_build_object('path',''))) loop
    perform pg_temp.expect_denied('input inválido ' || v_override::text, 'portal-A',
      pg_temp.create_sql('invalid-input','invalid','invoice-A',v_override));
  end loop;
  foreach v_path in array array[
    pg_temp.proof_path('tenant-B','invoice-A','invalid'),
    pg_temp.proof_path('tenant-A','invoice-B','invalid'),
    pg_temp.proof_path('tenant-A','invoice-A','new-A'),
    pg_temp.proof_path('tenant-A','invoice-A','invalid','missing-object'),
    'https://example.invalid/proof.pdf', '../proof.pdf', '/absolute/proof.pdf',
    replace(pg_temp.proof_path('tenant-A','invoice-A','invalid'),'/','//'),
    pg_temp.proof_path('tenant-A','invoice-A','invalid') || E'\n',
    replace(pg_temp.proof_path('tenant-A','invoice-A','invalid'),'.pdf','.exe'),
    replace(pg_temp.proof_path('tenant-A','invoice-A','invalid'),'.pdf','.html')
  ] loop
    perform pg_temp.expect_denied('objeto/path ajeno o inválido', 'portal-A',
      pg_temp.create_sql('invalid-path','invalid','invoice-A',jsonb_build_object('path',v_path)));
  end loop;
  perform pg_temp.expect_denied('objeto sólo en otro bucket', 'portal-A', pg_temp.create_sql('wrong-bucket','wrong-bucket'));
  foreach v_invoice in array array['draft','paid','void','archived'] loop
    perform pg_temp.expect_denied('alta no acepta factura ' || v_invoice, 'portal-A',
      pg_temp.create_sql('invoice-invalid','invalid-' || v_invoice,'invoice-' || v_invoice));
  end loop;
  perform pg_temp.expect_denied('no cancela historia de factura archivada','portal-A',
    pg_temp.cancel_sql('archived','legacy-archived','F-ARCHIVED'));
  perform pg_temp.expect_denied('no confirma historia de factura archivada','accounting-A',
    pg_temp.resolve_sql('archived','legacy-archived'));
  foreach v_reason in array array[null,'','   ','abc',repeat('x',501)] loop
    perform pg_temp.expect_denied('cancel exige motivo 4 a 500','portal-A',pg_temp.cancel_sql('reason','legacy-A','F-CMD-SHARED',v_reason));
    perform pg_temp.expect_denied('confirmar exige motivo 4 a 500','accounting-A',pg_temp.resolve_sql('reason','legacy-A','confirmado',v_reason));
    perform pg_temp.expect_denied('rechazar exige motivo 4 a 500','admin-A',pg_temp.resolve_sql('reason','legacy-A','rechazado',v_reason));
  end loop;
  perform pg_temp.expect_denied('resolve no acepta reportado','accounting-A',pg_temp.resolve_sql('bad-action','legacy-A','reportado'));
  perform pg_temp.expect_denied('resolve no acepta acción NULL','accounting-A',pg_temp.resolve_sql('bad-action','legacy-A',null));
end;
$input_contract$;

-- Facturas y reportes cambiados DESPUÉS de su creación: los comandos deben
-- consultar nuevamente el padre, moneda y estado; cada caso se revierte.
savepoint resolution_parent_draft;
update public.invoices set status = 'borrador' where id = pg_temp.fixture_id('invoice-A');
select pg_temp.expect_denied('resolve no acepta padre borrador','accounting-A',pg_temp.resolve_sql('parent-draft','legacy-A'));
rollback to savepoint resolution_parent_draft;
release savepoint resolution_parent_draft;
savepoint resolution_parent_void;
update public.invoices set status = 'anulada' where id = pg_temp.fixture_id('invoice-A');
select pg_temp.expect_denied('resolve no acepta padre anulado','accounting-A',pg_temp.resolve_sql('parent-void','legacy-A'));
rollback to savepoint resolution_parent_void;
release savepoint resolution_parent_void;
savepoint resolution_currency;
update public.payment_reports set currency = 'CNY' where id = pg_temp.fixture_id('legacy-A');
select pg_temp.expect_denied('resolve no mezcla monedas','accounting-A',pg_temp.resolve_sql('currency','legacy-A'));
rollback to savepoint resolution_currency;
release savepoint resolution_currency;
savepoint resolution_deleted;
update public.payment_reports set deleted_at = now() where id = pg_temp.fixture_id('legacy-A');
select pg_temp.expect_denied('resolve no revive reporte eliminado','accounting-A',pg_temp.resolve_sql('deleted','legacy-A'));
select pg_temp.expect_denied('cancel no revive reporte eliminado','portal-A',pg_temp.cancel_sql('deleted','legacy-A'));
rollback to savepoint resolution_deleted;
release savepoint resolution_deleted;

-- Fronteras inclusivas del input, no sólo casos de rechazo.
savepoint maximum_input;
do $maximum_input$
declare v_result jsonb;
begin
  v_result := pg_temp.as_actor('portal-A',pg_temp.create_sql('maximum','boundary','invoice-A',
    jsonb_build_object('amount',9999999.99,'note',repeat('x',500),'paid_at',current_date)));
  perform pg_temp.assert_receipt(v_result,'maximum','boundary','invoice-A','reportado',false,false);
  perform pg_temp.assert_true((select amount = 9999999.99 and length(note) = 500 and paid_at = current_date
    from public.payment_reports where id = pg_temp.fixture_id('boundary')),'acepta monto máximo, nota 500 y fecha actual');
  v_result := pg_temp.as_actor('portal-A',pg_temp.cancel_sql('maximum-cancel','boundary','F-CMD-SHARED',repeat('m',500)));
  perform pg_temp.assert_receipt(v_result,'maximum-cancel','boundary','invoice-A','reportado',true,false);
end;
$maximum_input$;
rollback to savepoint maximum_input;
release savepoint maximum_input;
savepoint minimum_input;
do $minimum_input$
declare v_result jsonb;
begin
  v_result := pg_temp.as_actor('portal-A',pg_temp.create_sql('minimum','boundary','invoice-A',jsonb_build_object('amount',0.01)));
  perform pg_temp.assert_receipt(v_result,'minimum','boundary','invoice-A','reportado',false,false);
  v_result := pg_temp.as_actor('accounting-A',pg_temp.resolve_sql('minimum-resolve','boundary','confirmado','Bien'));
  perform pg_temp.assert_receipt(v_result,'minimum-resolve','boundary','invoice-A','confirmado',false,false);
end;
$minimum_input$;
rollback to savepoint minimum_input;
release savepoint minimum_input;

create temporary table successful_results(label text primary key, result jsonb not null);
do $create_and_retry$
declare v_result jsonb; v_before jsonb;
begin
  v_result := pg_temp.as_actor('portal-A',pg_temp.create_sql('create-A','new-A','invoice-A',jsonb_build_object('note','Nota original sintética')));
  perform pg_temp.assert_receipt(v_result,'create-A','new-A','invoice-A','reportado',false,false);
  insert into successful_results values ('create-A',v_result);
  perform pg_temp.assert_true(exists(select 1 from public.payment_reports where id = pg_temp.fixture_id('new-A')
    and tenant_id = pg_temp.fixture_id('tenant-A') and client_markbox = 'DUP' and currency = 'USD'
    and amount = 100 and note = 'Nota original sintética' and confirmed_by is null and confirmed_at is null
    and cancelled_at is null and cancelled_by is null and resolution_reason is null and deleted_at is null), 'alta sella identidad, moneda y metadatos');
  v_before := pg_temp.state_snapshot();
  v_result := pg_temp.as_actor('portal-A',pg_temp.create_sql('create-A','new-A','invoice-A',jsonb_build_object('note','Nota original sintética')));
  perform pg_temp.assert_receipt(v_result,'create-A','new-A','invoice-A','reportado',false,true);
  perform pg_temp.assert_true(pg_temp.state_snapshot() = v_before,'replay create no muta ni audita otra vez');
  perform pg_temp.expect_denied('misma clave otro monto','portal-A',pg_temp.create_sql('create-A','new-A','invoice-A',jsonb_build_object('amount',101,'note','Nota original sintética')));
  perform pg_temp.expect_denied('misma clave otro actor','portal-B',pg_temp.create_sql('create-A','new-B','invoice-B'));
  perform pg_temp.expect_denied('misma clave otra operación','portal-A',pg_temp.cancel_sql('create-A','new-A'));
  perform pg_temp.expect_denied('otro request no duplica report_id','portal-A',pg_temp.create_sql('duplicate-report','new-A'));
  v_result := pg_temp.as_actor('portal-B',pg_temp.create_sql('create-B','new-B','invoice-B'));
  perform pg_temp.assert_receipt(v_result,'create-B','new-B','invoice-B','reportado',false,false);
  insert into successful_results values ('create-B',v_result);
  perform pg_temp.assert_true((select currency = 'CNY' from public.payment_reports where id = pg_temp.fixture_id('new-B')), 'moneda deriva de factura B, no default USD');
  v_result := pg_temp.as_actor('dual',pg_temp.create_sql('create-dual','new-dual','invoice-dual'));
  perform pg_temp.assert_receipt(v_result,'create-dual','new-dual','invoice-dual','reportado',false,false);
  insert into successful_results values ('create-dual',v_result);
end;
$create_and_retry$;

-- Reintentos vuelven a consultar autorización viva, no confían en el recibo.
savepoint revoked_replay;
update public.client_users set status = 'revoked' where auth_user_id = pg_temp.fixture_id('portal-A');
select pg_temp.expect_denied('replay con vínculo revocado','portal-A',pg_temp.create_sql('create-A','new-A','invoice-A',jsonb_build_object('note','Nota original sintética')));
rollback to savepoint revoked_replay;
release savepoint revoked_replay;
savepoint retired_replay;
update public.clients set deleted_at = now() where id = pg_temp.fixture_id('client-A');
select pg_temp.expect_denied('replay con cliente retirado','portal-A',pg_temp.create_sql('create-A','new-A','invoice-A',jsonb_build_object('note','Nota original sintética')));
rollback to savepoint retired_replay;
release savepoint retired_replay;

do $cancel_and_resolve$
declare v_result jsonb; v_before jsonb; v_paid numeric; v_report jsonb;
begin
  perform pg_temp.as_actor('portal-A',pg_temp.create_sql('create-cancel','cancel-A','invoice-A',jsonb_build_object('note','Nota original sintética')));
  select to_jsonb(p) into v_report from public.payment_reports p where id = pg_temp.fixture_id('cancel-A');
  select paid_amount into v_paid from public.invoices where id = pg_temp.fixture_id('invoice-A');
  perform set_config('dtd.audit_reason','Motivo hostil aportado por caller',true);
  v_result := pg_temp.as_actor('portal-A',pg_temp.cancel_sql('cancel-A','cancel-A','F-CMD-SHARED','Cancelación legítima del cliente'));
  perform pg_temp.assert_receipt(v_result,'cancel-A','cancel-A','invoice-A','reportado',true,false);
  insert into successful_results values ('cancel-A',v_result);
  perform pg_temp.assert_true(current_setting('dtd.audit_reason',true) = 'Motivo hostil aportado por caller','restaura contexto previo de motivo');
  perform pg_temp.assert_true((select reason = 'Cancelación legítima del cliente' from public.entity_audit_log
    where id = (v_result->>'audit_event_id')::uuid),'GUC hostil no sustituye motivo validado');
  perform set_config('dtd.audit_reason','',true);
  perform pg_temp.assert_true((select to_jsonb(p) - array['cancelled_at','cancelled_by','updated_at'] =
    v_report - array['cancelled_at','cancelled_by','updated_at'] and cancelled_at is not null
    and cancelled_by = pg_temp.fixture_id('portal-A') and deleted_at is null from public.payment_reports p
    where id = pg_temp.fixture_id('cancel-A')),'cancel conserva estado, monto, nota, comprobante y fila');
  perform pg_temp.assert_true((select paid_amount = v_paid from public.invoices where id = pg_temp.fixture_id('invoice-A')),'cancel no toca saldo');
  v_before := pg_temp.state_snapshot();
  v_result := pg_temp.as_actor('portal-A',pg_temp.cancel_sql('cancel-A','cancel-A','F-CMD-SHARED','Cancelación legítima del cliente'));
  perform pg_temp.assert_receipt(v_result,'cancel-A','cancel-A','invoice-A','reportado',true,true);
  perform pg_temp.assert_true(pg_temp.state_snapshot() = v_before,'replay cancel no muta ni audita');
  perform pg_temp.expect_denied('cancelado no se confirma','accounting-A',pg_temp.resolve_sql('cancel-confirm','cancel-A'));
  perform pg_temp.expect_denied('cancelación nueva no repite transición terminal','portal-A',pg_temp.cancel_sql('cancel-again','cancel-A'));

  perform pg_temp.as_actor('portal-A',pg_temp.create_sql('create-confirm','confirm-A','invoice-A',jsonb_build_object('note','Nota original sintética')));
  v_result := pg_temp.as_actor('accounting-A',pg_temp.resolve_sql('resolve-A','confirm-A','confirmado','Pago validado contra comprobante'));
  perform pg_temp.assert_receipt(v_result,'resolve-A','confirm-A','invoice-A','confirmado',false,false);
  insert into successful_results values ('resolve-A',v_result);
  perform pg_temp.assert_true((select paid_amount = v_paid + 100 and status = 'parcial' from public.invoices
    where id = pg_temp.fixture_id('invoice-A')),'confirmar suma una sola vez y conserva fórmula de parcial');
  perform pg_temp.assert_true((select status = 'confirmado' and confirmed_by = pg_temp.fixture_id('accounting-A')
    and confirmed_at is not null and resolution_reason = 'Pago validado contra comprobante'
    and note = 'Nota original sintética' and proof_path = pg_temp.proof_path('tenant-A','invoice-A','confirm-A')
    from public.payment_reports where id = pg_temp.fixture_id('confirm-A')),'confirmación separa motivo de nota y conserva prueba');
  v_before := pg_temp.state_snapshot();
  v_result := pg_temp.as_actor('accounting-A',pg_temp.resolve_sql('resolve-A','confirm-A','confirmado','Pago validado contra comprobante'));
  perform pg_temp.assert_receipt(v_result,'resolve-A','confirm-A','invoice-A','confirmado',false,true);
  perform pg_temp.assert_true(pg_temp.state_snapshot() = v_before,'replay resolve no suma ni audita otra vez');
  perform pg_temp.expect_denied('segundo request no confirma dos veces','accounting-A',pg_temp.resolve_sql('resolve-twice','confirm-A'));
  perform pg_temp.expect_denied('confirmado no se rechaza','admin-A',pg_temp.resolve_sql('resolve-reject','confirm-A','rechazado'));
  perform pg_temp.expect_denied('confirmado no se cancela','portal-A',pg_temp.cancel_sql('resolve-cancel','confirm-A'));

  perform pg_temp.as_actor('portal-A',pg_temp.create_sql('create-reject','reject-A','invoice-A',jsonb_build_object('note','Nota original sintética')));
  v_result := pg_temp.as_actor('admin-A',pg_temp.resolve_sql('reject-A','reject-A','rechazado','Comprobante no corresponde'));
  perform pg_temp.assert_receipt(v_result,'reject-A','reject-A','invoice-A','rechazado',false,false);
  insert into successful_results values ('reject-A',v_result);
  perform pg_temp.assert_true((select paid_amount = v_paid + 100 from public.invoices where id = pg_temp.fixture_id('invoice-A')),'rechazar no suma saldo');
  perform pg_temp.assert_true((select note = 'Nota original sintética' and resolution_reason = 'Comprobante no corresponde'
    and proof_path = pg_temp.proof_path('tenant-A','invoice-A','reject-A') from public.payment_reports where id = pg_temp.fixture_id('reject-A')),'rechazo conserva nota y evidencia');
  perform pg_temp.expect_denied('rechazado no se confirma','accounting-A',pg_temp.resolve_sql('reject-confirm','reject-A'));

  perform pg_temp.as_actor('portal-A',pg_temp.create_sql('create-overpay','overpay-A','invoice-overpay',jsonb_build_object('amount',1200)));
  v_result := pg_temp.as_actor('admin-A',pg_temp.resolve_sql('overpay-A','overpay-A'));
  perform pg_temp.assert_receipt(v_result,'overpay-A','overpay-A','invoice-overpay','confirmado',false,false);
  perform pg_temp.assert_true((select paid_amount = 1220 and status = 'pagada' from public.invoices where id = pg_temp.fixture_id('invoice-overpay')),'preserva sobrepago heredado y estado pagada');
end;
$cancel_and_resolve$;

savepoint finance_revoked;
update public.user_tenants set disabled_at = now() where user_id = pg_temp.fixture_id('accounting-A');
select pg_temp.expect_denied('replay financiero revocado','accounting-A',pg_temp.resolve_sql('resolve-A','confirm-A','confirmado','Pago validado contra comprobante'));
rollback to savepoint finance_revoked;
release savepoint finance_revoked;

do $pending_limit$
declare n integer; v_result jsonb; v_before jsonb;
begin
  for n in 1..5 loop
    v_result := pg_temp.as_actor('portal-A',pg_temp.create_sql('create-limit-' || n,'limit-' || n,'invoice-limit'));
    perform pg_temp.assert_receipt(v_result,'create-limit-' || n,'limit-' || n,'invoice-limit','reportado',false,false);
  end loop;
  perform pg_temp.expect_denied('sexto pendiente se rechaza','portal-A',pg_temp.create_sql('create-limit-6','limit-6','invoice-limit'));
  v_before := pg_temp.state_snapshot();
  v_result := pg_temp.as_actor('portal-A',pg_temp.create_sql('create-limit-1','limit-1','invoice-limit'));
  perform pg_temp.assert_receipt(v_result,'create-limit-1','limit-1','invoice-limit','reportado',false,true);
  perform pg_temp.assert_true(pg_temp.state_snapshot() = v_before,'límite no bloquea replay autorizado');
  perform pg_temp.as_actor('portal-A',pg_temp.cancel_sql('cancel-limit-1','limit-1','F-LIMIT'));
  v_result := pg_temp.as_actor('portal-A',pg_temp.create_sql('create-limit-6','limit-6','invoice-limit'));
  perform pg_temp.assert_receipt(v_result,'create-limit-6','limit-6','invoice-limit','reportado',false,false);
  perform pg_temp.assert_true((select count(*) = 5 from public.payment_reports where invoice_id = pg_temp.fixture_id('invoice-limit')
    and status = 'reportado' and cancelled_at is null and deleted_at is null),'cancelado no cuenta como pendiente');
end;
$pending_limit$;

-- Inyección de fallo en el INSERT final del writer real. No se reemplaza ni
-- altera append_audit_event: exige rollback de todas sus dependencias.
create function pg_temp.reject_audit_insert() returns trigger language plpgsql as $$
begin raise exception 'TEST 0421 fallo sintético del destino de auditoría'; end;
$$;
create trigger test_0421_audit_unavailable before insert on public.entity_audit_log
for each row execute function pg_temp.reject_audit_insert();
select pg_temp.expect_denied('audit roto revierte create','portal-A',pg_temp.create_sql('audit-create','audit-create','invoice-audit'));
select pg_temp.expect_denied('audit roto revierte cancel','portal-A',pg_temp.cancel_sql('audit-cancel','audit-cancel','F-AUDIT'));
select pg_temp.expect_denied('audit roto revierte reporte y saldo resolve','accounting-A',pg_temp.resolve_sql('audit-resolve','audit-resolve'));
drop trigger test_0421_audit_unavailable on public.entity_audit_log;
do $audit_retry$
declare v_result jsonb;
begin
  v_result := pg_temp.as_actor('portal-A',pg_temp.create_sql('audit-create','audit-create','invoice-audit'));
  perform pg_temp.assert_receipt(v_result,'audit-create','audit-create','invoice-audit','reportado',false,false);
  v_result := pg_temp.as_actor('portal-A',pg_temp.cancel_sql('audit-cancel','audit-cancel','F-AUDIT'));
  perform pg_temp.assert_receipt(v_result,'audit-cancel','audit-cancel','invoice-audit','reportado',true,false);
  v_result := pg_temp.as_actor('accounting-A',pg_temp.resolve_sql('audit-resolve','audit-resolve'));
  perform pg_temp.assert_receipt(v_result,'audit-resolve','audit-resolve','invoice-audit','confirmado',false,false);
end;
$audit_retry$;

do $new_columns_and_private_acl$
declare v_role text; v_function oid; v_sql text;
begin
  foreach v_function in array array[
    'public.create_portal_payment_report(uuid,uuid,text,numeric,payment_report_method,date,text,text)'::regprocedure::oid,
    'public.cancel_portal_payment_report(uuid,uuid,text,text)'::regprocedure::oid,
    'public.resolve_payment_report(uuid,uuid,payment_report_status,text)'::regprocedure::oid] loop
    perform pg_temp.assert_true((select not prosecdef from pg_proc where oid = v_function),'wrapper público invoker');
    perform pg_temp.assert_true(has_function_privilege('authenticated',v_function,'EXECUTE') and
      not has_function_privilege('anon',v_function,'EXECUTE'),'API ejecutable sólo por sesión autenticada');
  end loop;
  perform pg_temp.assert_true(exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'payment_private' and p.proname = 'run_report_command' and p.prosecdef
      and exists(select 1 from unnest(p.proconfig) x where x in ('search_path=""','search_path='))), 'helper privado definer con search_path vacío');
  perform pg_temp.assert_true((select relrowsecurity from pg_class where oid = 'payment_private.report_commands'::regclass)
    and not exists(select 1 from pg_policy where polrelid = 'payment_private.report_commands'::regclass),'recibos privados con RLS sin policies');
  foreach v_role in array array['anon','authenticated','service_role'] loop
    perform pg_temp.assert_true(not has_table_privilege(v_role,'payment_private.report_commands','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
      'sin privilegios de tabla privada para ' || v_role);
    perform pg_temp.expect_denied('lectura directa recibo privada ' || v_role,'portal-A','select to_jsonb(c) from payment_private.report_commands c limit 1',v_role);
  end loop;
  perform pg_temp.assert_true(not exists(select 1 from information_schema.columns where table_schema = 'payment_private'
    and table_name = 'report_commands' and column_name in ('amount','note','proof_path','paid_at','method')),'recibo no duplica contenido financiero/comprobante');
  perform pg_temp.assert_true(exists(select 1 from pg_constraint where conrelid = 'payment_private.report_commands'::regclass
    and confrelid = 'public.payment_reports'::regclass and contype = 'f' and convalidated and confdeltype in ('a','r')),
    'FK validada del recibo bloquea borrado del reporte');
  perform pg_temp.assert_true(exists(select 1 from pg_constraint where conrelid = 'payment_private.report_commands'::regclass
    and confrelid = 'public.tenants'::regclass and contype = 'f' and convalidated and confdeltype in ('a','r')),
    'FK validada del recibo bloquea borrado del tenant, independientemente de otras FK');
  foreach v_sql in array array[
    format('update public.payment_reports set cancelled_at = now(), cancelled_by = %L::uuid where id = %L::uuid',pg_temp.fixture_id('portal-A'),pg_temp.fixture_id('legacy-A')),
    format('update public.payment_reports set resolution_reason = %L where id = %L::uuid','Motivo directo prohibido',pg_temp.fixture_id('legacy-A')),
    format('update public.payment_reports set cancelled_at = null, cancelled_by = null where id = %L::uuid',pg_temp.fixture_id('cancel-A')),
    format('update public.payment_reports set deleted_at = now() where id = %L::uuid',pg_temp.fixture_id('cancel-A'))
  ] loop
    perform pg_temp.expect_denied('API no escribe metadatos nuevos ni borra cancelado','accounting-A',v_sql);
    perform pg_temp.expect_denied('service directo no escribe metadatos nuevos','portal-A',v_sql,'service_role');
  end loop;
  perform pg_temp.expect_denied('cancelación persistida tampoco se deshace como owner',null,
    format('update public.payment_reports set cancelled_at = null, cancelled_by = null where id = %L::uuid',pg_temp.fixture_id('cancel-A')),'postgres');
  perform pg_temp.expect_denied('pareja cancelación consistente',null,
    format('update public.payment_reports set cancelled_at = now() where id = %L::uuid',pg_temp.fixture_id('legacy-A')),'postgres');
  perform pg_temp.expect_denied('recibo append-only UPDATE owner',null,
    'update payment_private.report_commands set request_id = request_id','postgres');
  perform pg_temp.expect_denied('recibo append-only DELETE owner',null,
    'delete from payment_private.report_commands','postgres');
  perform pg_temp.expect_denied('recibo append-only TRUNCATE owner',null,
    'truncate payment_private.report_commands','postgres');
  perform pg_temp.expect_denied('recibo impide borrado físico reporte',null,
    format('delete from public.payment_reports where id = %L::uuid',pg_temp.fixture_id('new-A')),'postgres');
  perform pg_temp.expect_denied('recibo impide borrado físico tenant',null,
    format('delete from public.tenants where id = %L::uuid',pg_temp.fixture_id('tenant-A')),'postgres');
end;
$new_columns_and_private_acl$;

do $audit_and_storage_invariants$
declare v_assertions bigint;
begin
  perform pg_temp.assert_true(not exists(select 1 from public.entity_audit_log a
    where a.entity_type <> 'payment_report' or a.source <> 'rpc' or a.actor_type <> 'user' or a.actor_id is null
      or a.result <> 'succeeded' or a.correlation_id is null),'auditoría real identifica entidad, fuente y actor');
  perform pg_temp.assert_true((select count(*) from public.entity_audit_log) =
    (select count(*) from payment_private.report_commands),'cada comando efectivo tiene exactamente un evento y recibo');
  perform pg_temp.assert_true(not exists(select 1 from public.entity_audit_log group by correlation_id having count(*) <> 1),
    'correlación request_id única por efecto, incluidos reintentos');
  perform pg_temp.assert_true(not exists(select 1 from successful_results s
    join (values ('create-A','portal-A'),('create-B','portal-B'),('create-dual','dual'),
      ('cancel-A','portal-A'),('resolve-A','accounting-A'),('reject-A','admin-A')) v(label, actor) on v.label = s.label
    join public.entity_audit_log a on a.id = (s.result->>'audit_event_id')::uuid
    join public.payment_reports p on p.id = a.entity_id
    where a.actor_id <> pg_temp.fixture_id(v.actor) or a.tenant_id <> p.tenant_id),
    'auditoría corresponde al actor exacto y tenant del objeto en cada verbo');
  perform pg_temp.assert_true(not exists(select 1 from public.entity_audit_log a where
    (coalesce(a.payload,'{}') || coalesce(a.before_data,'{}') || coalesce(a.after_data,'{}'))::text ~
      '"(amount|note|proof_path|paid_amount|total_amount)"'),'payload de auditoría no duplica importes, nota ni comprobante');
  perform pg_temp.assert_true(not exists(select 1 from public.entity_audit_log a where
    a.payload::text like '%Nota original sintética%' or a.before_data::text like '%Nota original sintética%'
      or a.after_data::text like '%Nota original sintética%'),'nota original no aparece en auditoría');
  perform pg_temp.assert_true(not exists(select 1 from baseline_storage b full join
    (select to_jsonb(o) as row_data from storage.objects o) n using(row_data)
    where b.row_data is null or n.row_data is null),'ningún comando borra o sobrescribe objetos Storage');
  perform pg_temp.assert_true(not exists(select 1 from baseline_buckets b full join
    (select to_jsonb(o) as row_data from storage.buckets o) n using(row_data)
    where b.row_data is null or n.row_data is null),'buckets intactos');
  select last_value into v_assertions from pg_temp.assertion_count;
  raise notice 'TEST 0421 GREEN: % aserciones; identidad, comandos, idempotencia, tope, auditoría real, conservación y ACL', v_assertions;
end;
$audit_and_storage_invariants$;

-- El bloqueo concurrente se verifica además con sesiones PostgreSQL separadas;
-- este contrato transaccional no sustituye esa evidencia ni la de Cloud.
rollback;
select to_regclass('public.payment_reports') is null as fixture_rolled_back;
