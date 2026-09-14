\set ON_ERROR_STOP on
-- SDD-0365 etapa3: sólo datos sintéticos, PostgreSQL desechable vacío.
-- RED: -v apply_fix=false. Normal: BEGIN/ROLLBACK. Sin Cloud ni datos reales.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
\set apply_boundary :apply_fix
\set apply_fix true
\set fixture_in_transaction true
begin;
\ir 0421_payment_report_commands.test.sql
\set fixture_in_transaction false
\set apply_fix :apply_boundary

-- El bootstrap anterior deja esta MISMA transacción abierta y no ejecuta la
-- suite de expansión: el contrato de0421 permanece en su prueba independiente.
create temporary sequence boundary_assertions;
create function pg_temp.boundary_assert(value boolean, label text) returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception 'TEST 0422: %', label; end if;
  perform nextval('pg_temp.boundary_assertions');
end;
$$;

create function pg_temp.boundary_actor(actor text, statement text, api_role text default 'authenticated')
returns jsonb language plpgsql as $$
declare result jsonb;
begin
  perform set_config('request.jwt.claim.sub',coalesce(pg_temp.fixture_id(actor)::text,''),true);
  execute format('set local role %I',api_role);
  execute statement into result;
  reset role;
  return result;
exception when others then reset role; raise;
end;
$$;
create function pg_temp.boundary_state() returns jsonb language sql as $$
  select jsonb_build_object(
    'reports',(select jsonb_agg(to_jsonb(t) order by id) from public.payment_reports t),
    'invoices',(select jsonb_agg(to_jsonb(t) order by id) from public.invoices t),
    'events',(select jsonb_agg(to_jsonb(t) order by id) from public.entity_audit_log t),
    'receipts',(select jsonb_agg(to_jsonb(t) order by request_id) from payment_private.report_commands t),
    'objects',(select jsonb_agg(to_jsonb(t) order by id) from storage.objects t),
    'clients',(select jsonb_agg(to_jsonb(t) order by id) from public.clients t));
$$;
create function pg_temp.boundary_denied(label text, actor text, statement text,
  api_role text default 'authenticated', expected_state text default '42501') returns void language plpgsql as $$
declare before_state jsonb := pg_temp.boundary_state(); denied boolean := false; code text;
begin
  begin perform pg_temp.boundary_actor(actor,statement,api_role);
  exception when others then
    get stacked diagnostics code=returned_sqlstate;
    if code <> expected_state then raise exception 'TEST 0422: % SQLSTATE inesperado %: %',label,code,sqlerrm; end if;
    denied:=true;
  end;
  perform pg_temp.boundary_assert(denied,label || ': se esperaba rechazo');
  perform pg_temp.boundary_assert(pg_temp.boundary_state()=before_state,label || ': ninguna mutación parcial');
end;
$$;

-- Rename REAL vigente: sólo las tablas laterales están vacías y reducidas a
-- las columnas leídas por0371. No se simula el comando ni su guard de tenant.
alter table public.clients add column merged_into_client_id uuid,
  add column aliado_id uuid, add column kommo_lead_id bigint;
create table public.aliados(id uuid primary key, tenant_id uuid, client_id uuid,
  prefix text, status text, deleted_at timestamptz);
do $rename_platform$
declare t text; source text; body text;
begin
  foreach t in array array['prealertas','payment_receipts','prealerta_service_requests','prealerta_documents',
    'shipment_documents','client_delivery_addresses','client_claims','client_claim_evidence',
    'client_notification_schedule','quotes','sales_orders','purchase_orders','consolidation_items',
    'packing_list_submissions','suppliers_cn','supplier_claims','supplier_order_signals','warehouse_receipts_cn',
    'academy_enrollments','academy_lesson_progress','academy_diplomas','club_members','legal_acceptances'] loop
    execute format('create table public.%I(tenant_id uuid,client_markbox text)',t);
  end loop;
  foreach t in array array['warehouse_boxes','warehouse_receipt_ve_boxes','qr_print_orders'] loop
    execute format('create table public.%I(tenant_id uuid,markbox text)',t);
  end loop;
  source:=pg_read_file('/sb/migrations/0012_rls_perf_and_rpc_guards.sql');
  body:=split_part(split_part(source,'create or replace function public.assert_tenant_match(p_tenant_id uuid)',2),
    'comment on function public.assert_tenant_match',1);
  if body='' or body not like '%Tenant mismatch:%' then raise exception 'TEST 0422: fuente0012 no reconocida'; end if;
  execute 'create or replace function public.assert_tenant_match(p_tenant_id uuid)' || body;
end;
$rename_platform$;
revoke all on function public.assert_tenant_match(uuid) from public,anon,authenticated;
grant execute on function public.assert_tenant_match(uuid) to service_role;
create table public.referrals(tenant_id uuid,referrer_markbox text);
create table public.dispatch_orders(id uuid,tenant_id uuid);
create table public.dispatch_order_packages(od_id uuid,markbox text);
create table public.dispatch_rules(tenant_id uuid,vip_markboxes text[],whitelist_markboxes text[]);
\ir ../migrations/0367_client_markbox_historial.sql
\ir ../migrations/0371_insignia_pelada_del_aliado.sql

insert into auth.users(id,email) select pg_temp.fixture_id(v),v||'@example.invalid'
  from unnest(array['admin-B','marketing-B','dual-nonfinancial']) v;
insert into public.user_tenants values
  (pg_temp.fixture_id('admin-B'),pg_temp.fixture_id('tenant-B'),'admin',null),
  (pg_temp.fixture_id('marketing-B'),pg_temp.fixture_id('tenant-B'),'marketing',null),
  (pg_temp.fixture_id('dual-nonfinancial'),pg_temp.fixture_id('tenant-B'),'marketing',null);
insert into public.clients(id,tenant_id,markbox) values(pg_temp.fixture_id('client-extra'),pg_temp.fixture_id('tenant-A'),'LOCAL');
insert into public.client_users(auth_user_id,tenant_id,client_id,email,status)
values(pg_temp.fixture_id('dual-nonfinancial'),pg_temp.fixture_id('tenant-A'),pg_temp.fixture_id('client-extra'),'dual-synthetic@example.invalid','active');
insert into public.invoices(id,tenant_id,invoice_code,client_markbox,client_name,base_amount,total_amount,paid_amount,status,currency)
values(pg_temp.fixture_id('invoice-extra'),pg_temp.fixture_id('tenant-A'),'F-EXTRA','LOCAL','synthetic',1000,1000,20,'emitida','USD');
insert into public.payment_reports(id,tenant_id,invoice_id,invoice_code,client_markbox,amount,currency,method,paid_at,note,proof_path,status)
select pg_temp.fixture_id(v.label),i.tenant_id,i.id,i.invoice_code,i.client_markbox,100,i.currency,'otro',current_date-1,
  'Nota sintética conservada',pg_temp.proof_path(v.tenant,v.invoice,v.label),v.status::public.payment_report_status
from (values
  ('legacy-dual','tenant-B','invoice-dual','reportado'),('legacy-extra','tenant-A','invoice-extra','reportado'),
  ('legacy-retired','tenant-A','invoice-retired','reportado'),('legacy-invited','tenant-A','invoice-invited','reportado'),
  ('legacy-incoherent','tenant-A','invoice-incoherent','reportado'),('legacy-deleted','tenant-A','invoice-A','reportado'),
  ('history-confirmed','tenant-A','invoice-A','confirmado'),('history-rejected','tenant-A','invoice-A','rechazado')
) v(label,tenant,invoice,status) join public.invoices i on i.id=pg_temp.fixture_id(v.invoice);
insert into storage.objects(bucket_id,name) select 'payment-proofs',proof_path from public.payment_reports p
where not exists(select 1 from storage.objects o where o.bucket_id='payment-proofs' and o.name=p.proof_path);
update public.payment_reports set deleted_at=now() where id=pg_temp.fixture_id('legacy-deleted');
-- Historia cancelada real, con evento/recibo producidos por0421 antes de0422.
select pg_temp.boundary_actor('portal-A',format('select public.cancel_portal_payment_report(%L::uuid,%L::uuid,%L,%L)',
  pg_temp.fixture_id('preexisting-cancel'),pg_temp.fixture_id('audit-cancel'),'F-AUDIT','Cancelación sintética previa'));

-- Control previo: rename normal funciona; padre archivado es una limitación
-- heredada de0195, diagnosticada sin convertirla en requisito de reparación.
savepoint rename_before;
select pg_temp.boundary_assert((pg_temp.boundary_actor('admin-B',format(
  'select public.rename_client_markbox(%L::uuid,%L,%L)',pg_temp.fixture_id('client-B'),'DTD-B-NEW','Motivo sintético'))->>'ok')::boolean,
  'rename0371 normal funciona antes de restricción');
rollback to rename_before;
release savepoint rename_before;
select pg_temp.boundary_denied('diagnóstico previo rename con padre archivado','admin-A',format(
  'select public.rename_client_markbox(%L::uuid,%L,%L)',pg_temp.fixture_id('client-A'),'DTD-A-NEW','Motivo sintético'),
  'authenticated','23514');

-- Grants independientes por columna: todos deben retirarse, incluso heredados
-- desde PUBLIC. Es fixture adversarial, nunca un permiso nuevo en producción.
grant update(amount),insert(note),references(invoice_id),select(proof_path)
  on public.payment_reports to anon,authenticated,service_role;
grant update(currency) on public.payment_reports to public;
create temporary table boundary_baseline_state as select pg_temp.boundary_state() as snapshot;
create temporary table boundary_baseline_policies as select to_jsonb(p) as definition from pg_policies p;
create temporary table boundary_baseline_functions as select p.oid,pg_get_functiondef(p.oid) as definition,p.proacl
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','auth','storage','payment_private') and p.prokind='f';
create temporary table boundary_baseline_triggers as select t.oid,to_jsonb(t) as definition from pg_trigger t where not t.tgisinternal;
create temporary table boundary_baseline_acl as select c.oid,c.relacl from pg_class c
  where c.oid in ('public.invoices'::regclass,'public.entity_audit_log'::regclass,'storage.objects'::regclass,
    'storage.buckets'::regclass,'payment_private.report_commands'::regclass);
create temporary table boundary_baseline_buckets as select to_jsonb(b) as row_data from storage.buckets b;

\if :apply_fix
-- Cada drift vive en una subtransacción: se exige rechazo y catálogo/filas
-- idénticos a justo antes de intentar la migración. Incluye fallos postflight.
create function pg_temp.boundary_catalog() returns jsonb language sql as $$
  select jsonb_build_object(
    'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p),
    'tables',(select jsonb_agg(jsonb_build_array(c.oid,c.relowner,c.relacl,c.relrowsecurity) order by c.oid)
      from pg_class c where c.oid in ('public.payment_reports'::regclass,'public.user_tenants'::regclass,'payment_private.report_commands'::regclass)),
    'columns',(select jsonb_agg(jsonb_build_array(a.attrelid,a.attnum,a.attacl) order by a.attrelid,a.attnum)
      from pg_attribute a where a.attrelid in ('public.payment_reports'::regclass,'payment_private.report_commands'::regclass) and a.attnum>0),
    'functions',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('public','auth','payment_private')));
$$;
do $preflight_drift$
declare ddl text; rejected boolean; before_catalog jsonb; before_state jsonb; drift_count integer:=0;
begin
  foreach ddl in array array[
    'alter policy "payment_reports by tenant" on public.payment_reports using (tenant_id=public.get_user_tenant_id() or true)',
    'alter policy "payment_reports portal self read" on public.payment_reports using (true)',
    'alter policy "payment_reports portal self insert" on public.payment_reports with check (true)',
    'alter policy "payment_reports portal self update" on public.payment_reports with check (true)',
    'alter policy "payment_reports service_role all" on public.payment_reports using (false)',
    'drop policy "payment_reports portal self read" on public.payment_reports',
    'alter policy "payment_reports portal self read" on public.payment_reports to anon',
    'create policy unexpected_boundary_policy on public.payment_reports for select to authenticated using(true)',
    'alter table public.payment_reports disable row level security',
    'alter table public.invoices disable row level security',
    'alter table public.clients disable row level security',
    'alter table public.client_users disable row level security',
    'alter table public.user_tenants disable row level security',
    'alter table payment_private.report_commands disable row level security',
    'alter function auth.uid() rename to uid_missing',
    'alter function public.get_user_tenant_id() rename to tenant_missing',
    'alter function public.current_studio_role() rename to role_missing',
    'alter function public.assert_studio_role(text[]) rename to assert_role_missing',
    'alter function public.cancel_portal_payment_report(uuid,uuid,text,text) rename to cancel_missing',
    'alter function public.resolve_payment_report(uuid,uuid,payment_report_status,text) security definer',
    'alter function payment_private.run_report_command(uuid,uuid,text,jsonb) security invoker',
    'alter function public.cancel_portal_payment_report(uuid,uuid,text,text) set search_path=public',
    'alter function payment_private.run_report_command(uuid,uuid,text,jsonb) owner to service_role',
    'alter table public.payment_reports owner to service_role',
    'alter table payment_private.report_commands owner to service_role',
    'revoke execute on function public.cancel_portal_payment_report(uuid,uuid,text,text) from authenticated',
    'grant execute on function public.cancel_portal_payment_report(uuid,uuid,text,text) to anon',
    'grant execute on function payment_private.run_report_command(uuid,uuid,text,jsonb) to service_role',
    'grant select on payment_private.report_commands to authenticated',
    'grant select(result) on payment_private.report_commands to anon',
    'create policy unexpected_receipt_policy on payment_private.report_commands for select to authenticated using(true)',
    'revoke select on public.user_tenants from authenticated',
    'create role test0422_anon_parent nologin; grant select(amount) on public.payment_reports to test0422_anon_parent; grant test0422_anon_parent to anon',
    'create role test0422_auth_parent nologin; grant update on public.payment_reports to test0422_auth_parent; grant test0422_auth_parent to authenticated',
    'create role test0422_maintain_parent nologin; grant maintain on public.payment_reports to test0422_maintain_parent; grant test0422_maintain_parent to authenticated'
  ] loop
    begin
      execute ddl;
      before_catalog:=pg_temp.boundary_catalog(); before_state:=pg_temp.boundary_state(); rejected:=false;
      begin execute pg_read_file('/sb/migrations/0422_payment_report_command_boundary.sql');
      exception when raise_exception then
        if sqlerrm not like '0422%' then raise; end if;
        rejected:=true;
      end;
      perform pg_temp.boundary_assert(rejected,'drift rechazado: '||ddl);
      perform pg_temp.boundary_assert(pg_temp.boundary_catalog()=before_catalog,'drift no deja cambios de catálogo');
      perform pg_temp.boundary_assert(pg_temp.boundary_state()=before_state,'drift no deja cambios de filas');
      raise sqlstate 'PT422' using message='revertir únicamente fixture de drift';
    exception when sqlstate 'PT422' then null;
    end;
    drift_count:=drift_count+1;
  end loop;
  raise notice 'TEST 0422: % drifts rechazados con rollback de catálogo y filas',drift_count;
end;
$preflight_drift$;
\ir ../migrations/0422_payment_report_command_boundary.sql
\endif

select pg_temp.boundary_assert(
  not has_table_privilege('authenticated','public.payment_reports','INSERT,UPDATE,DELETE'),
  'RED: authenticated todavía puede escribir sin los comandos auditados');

do $restriction_invariants$
declare role_name text;
begin
  perform pg_temp.boundary_assert(pg_temp.boundary_state()=(select snapshot from boundary_baseline_state),
    'restricción no cambia reportes, facturas, objetos, auditoría ni recibos');
  perform pg_temp.boundary_assert(not exists(select 1 from boundary_baseline_policies b full join
    (select to_jsonb(p) as definition from pg_policies p) n using(definition)
    where coalesce(b.definition,n.definition)->>'tablename'<>'payment_reports'
      and (b.definition is null or n.definition is null)),'policies ajenas intactas');
  perform pg_temp.boundary_assert(exists(select 1 from boundary_baseline_policies b join
    (select to_jsonb(p) as definition from pg_policies p) n using(definition)
    where b.definition->>'policyname'='payment_reports portal self read'),'Portalread0420 preservada EXACTA');
  perform pg_temp.boundary_assert((select count(*)=3 and bool_and(cmd='SELECT') from pg_policies
    where schemaname='public' and tablename='payment_reports'),'sólo tres policies SELECT');
  perform pg_temp.boundary_assert(not exists(select 1 from boundary_baseline_functions b left join pg_proc p on p.oid=b.oid
    where b.definition is distinct from pg_get_functiondef(p.oid)
      or (p.proname<>'confirm_payment_report' and b.proacl is distinct from p.proacl)),
    'cuerpos/seguridad de funciones y ACL nuevas/rename intactos');
  perform pg_temp.boundary_assert(not exists(select 1 from boundary_baseline_triggers b left join pg_trigger t on t.oid=b.oid
    where b.definition is distinct from to_jsonb(t)),'triggers intactos');
  perform pg_temp.boundary_assert(not exists(select 1 from boundary_baseline_acl b join pg_class c on c.oid=b.oid
    where b.relacl is distinct from c.relacl),'ACL ajenas intactas');
  foreach role_name in array array['anon','authenticated','service_role'] loop
    perform pg_temp.boundary_assert(not has_table_privilege(role_name,'public.payment_reports','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'),
      'sin escritura/privilegios auxiliares de tabla: '||role_name);
    perform pg_temp.boundary_assert(not has_any_column_privilege(role_name,'public.payment_reports','INSERT,UPDATE,REFERENCES'),
      'sin grants de columna remanentes: '||role_name);
    perform pg_temp.boundary_assert(has_table_privilege(role_name,'public.payment_reports','SELECT')=(role_name<>'anon'),
      'SELECT sólo authenticated/service: '||role_name);
    perform pg_temp.boundary_assert(not has_function_privilege(role_name,
      'public.confirm_payment_report(uuid,payment_report_status,text)','EXECUTE'),'sin legacy EXECUTE: '||role_name);
    perform pg_temp.boundary_assert(not has_table_privilege(role_name,'payment_private.report_commands','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
      'recibos sin privilegios API: '||role_name);
  end loop;
  perform pg_temp.boundary_assert(not has_any_column_privilege('anon','public.payment_reports','SELECT'),
    'anon tampoco conserva lectura de columna');
  perform pg_temp.boundary_assert(not exists(select 1 from pg_attribute a cross join lateral aclexplode(a.attacl) x
    where a.attrelid='public.payment_reports'::regclass and x.grantee in (0,'anon'::regrole,'authenticated'::regrole,'service_role'::regrole)),
    'no sobreviven grants API/PUBLIC independientes de columna');
end;
$restriction_invariants$;

-- No basta leer ACL: ejecutar cada operación como API exige42501, incluso
-- con filas válidas, rol financiero y metadatos que antes pasaban por ALL.
do $direct_api_commands$
declare actor text; api_role text; statement text;
begin
  foreach actor in array array['portal-A','accounting-A','marketing-A','accounting-B','dual',null] loop
    foreach statement in array array[
      format('insert into public.payment_reports(id,tenant_id,invoice_id,invoice_code,client_markbox,amount,currency,method,paid_at) values(%L::uuid,%L::uuid,%L::uuid,%L,%L,25,%L,%L,current_date)',
        pg_temp.fixture_id('direct-denied'),pg_temp.fixture_id('tenant-A'),pg_temp.fixture_id('invoice-A'),'F-CMD-SHARED','DUP','USD','otro'),
      format('update public.payment_reports set status=%L,amount=25,note=%L where id=%L::uuid','confirmado','DML sin auditoría',pg_temp.fixture_id('legacy-A')),
      format('delete from public.payment_reports where id=%L::uuid',pg_temp.fixture_id('legacy-A'))
    ] loop
      perform pg_temp.boundary_denied('DML directo '||coalesce(actor,'sin uid'),actor,statement);
    end loop;
  end loop;
  foreach api_role in array array['anon','service_role'] loop
    foreach statement in array array[
      format('insert into public.payment_reports(id,tenant_id,invoice_id,invoice_code,client_markbox,amount,currency,method,paid_at) values(%L::uuid,%L::uuid,%L::uuid,%L,%L,25,%L,%L,current_date)',
        pg_temp.fixture_id('direct-denied'),pg_temp.fixture_id('tenant-A'),pg_temp.fixture_id('invoice-A'),'F-CMD-SHARED','DUP','USD','otro'),
      format('update public.payment_reports set amount=25 where id=%L::uuid',pg_temp.fixture_id('legacy-A')),
      format('delete from public.payment_reports where id=%L::uuid',pg_temp.fixture_id('legacy-A'))
    ] loop
      perform pg_temp.boundary_denied('DML '||api_role,'accounting-A',statement,api_role);
    end loop;
  end loop;
  foreach api_role in array array['anon','authenticated','service_role'] loop
    perform pg_temp.boundary_denied('TRUNCATE API','accounting-A','truncate public.payment_reports',api_role);
    perform pg_temp.boundary_denied('TRIGGER API','accounting-A',
      'create trigger forbidden_payment_trigger before update on public.payment_reports for each row execute function public.touch_updated_at()',api_role);
    perform pg_temp.boundary_denied('legacyRPC API','accounting-A',format(
      'select to_jsonb(public.confirm_payment_report(%L::uuid,%L,null))',pg_temp.fixture_id('legacy-A'),'confirmado'),api_role);
    perform pg_temp.boundary_denied('recibos privados API','portal-A','select to_jsonb(r) from payment_private.report_commands r limit 1',api_role);
  end loop;
end;
$direct_api_commands$;

create function pg_temp.visible_reports(actor text, expected_ids uuid[], api_role text default 'authenticated')
returns void language plpgsql as $$
declare actual jsonb; expected jsonb;
begin
  select coalesce(jsonb_agg(id order by id),'[]') into expected from unnest(expected_ids) id;
  actual:=pg_temp.boundary_actor(actor,'select coalesce(jsonb_agg(id order by id),''[]'') from public.payment_reports',api_role);
  perform pg_temp.boundary_assert(actual=expected,'filas exactas para '||coalesce(actor,api_role)||': '||actual::text);
end;
$$;
do $read_matrix$
declare actor text; team_a uuid[]; team_b uuid[]; portal_a uuid[];
begin
  select array_agg(id) into team_a from public.payment_reports where tenant_id=pg_temp.fixture_id('tenant-A');
  select array_agg(id) into team_b from public.payment_reports where tenant_id=pg_temp.fixture_id('tenant-B');
  select array_agg(pg_temp.fixture_id(label)) into portal_a from unnest(array[
    'legacy-A','legacy-archived','audit-cancel','audit-resolve','history-confirmed','history-rejected']) label;
  foreach actor in array array['accounting-A','admin-A'] loop perform pg_temp.visible_reports(actor,team_a); end loop;
  foreach actor in array array['accounting-B','admin-B'] loop perform pg_temp.visible_reports(actor,team_b); end loop;
  perform pg_temp.visible_reports('portal-A',portal_a);
  perform pg_temp.visible_reports('portal-B',array[pg_temp.fixture_id('legacy-B')]);
  perform pg_temp.visible_reports('dual',team_a||array[pg_temp.fixture_id('legacy-dual')]);
  perform pg_temp.visible_reports('dual-nonfinancial',array[pg_temp.fixture_id('legacy-extra')]);
  foreach actor in array array['marketing-A','marketing-B','disabled-A','unlinked','revoked','invited','retired','incoherent',null] loop
    perform pg_temp.visible_reports(actor,array[]::uuid[]);
  end loop;
  perform pg_temp.visible_reports(null,team_a||team_b,'service_role');
  perform pg_temp.boundary_denied('anon SELECT',null,'select to_jsonb(p) from public.payment_reports p','anon');
end;
$read_matrix$;

-- Una identidad con dos membresías no toma el rol financiero de otro tenant.
savepoint multiple_memberships;
insert into public.user_tenants values
  (pg_temp.fixture_id('unlinked'),pg_temp.fixture_id('tenant-A'),'accounting',null),
  (pg_temp.fixture_id('unlinked'),pg_temp.fixture_id('tenant-B'),'accounting',null);
do $multiple_memberships$
declare selected_tenant uuid; expected uuid[];
begin
  selected_tenant:=(pg_temp.boundary_actor('unlinked','select to_jsonb(public.get_user_tenant_id())') #>> '{}')::uuid;
  select array_agg(id) into expected from public.payment_reports where tenant_id=selected_tenant;
  perform pg_temp.visible_reports('unlinked',expected);
  update public.user_tenants set role='marketing' where user_id=pg_temp.fixture_id('unlinked') and tenant_id=selected_tenant;
  perform pg_temp.visible_reports('unlinked',array[]::uuid[]);
  update public.user_tenants set disabled_at=now() where user_id=pg_temp.fixture_id('unlinked') and tenant_id=selected_tenant;
  select array_agg(id) into expected from public.payment_reports where tenant_id<>selected_tenant;
  perform pg_temp.visible_reports('unlinked',expected);
end;
$multiple_memberships$;
rollback to multiple_memberships;
release savepoint multiple_memberships;

create function pg_temp.boundary_create_sql(request_label text,report_label text,invoice_label text default 'invoice-A')
returns text language plpgsql as $$
declare inv public.invoices;
begin
  select * into strict inv from public.invoices where id=pg_temp.fixture_id(invoice_label);
  return format('select public.create_portal_payment_report(%L::uuid,%L::uuid,%L,100,%L,current_date-1,%L,%L)',
    pg_temp.fixture_id(request_label),pg_temp.fixture_id(report_label),inv.invoice_code,'otro',
    inv.tenant_id::text||'/'||inv.id::text||'/'||pg_temp.fixture_id(report_label)::text||'/'||pg_temp.fixture_id('object')::text||'.pdf',
    'Nota sintética del cliente');
end;
$$;
create function pg_temp.boundary_cancel_sql(request_label text,report_label text,code text default 'F-CMD-SHARED')
returns text language sql as $$
  select format('select public.cancel_portal_payment_report(%L::uuid,%L::uuid,%L,%L)',
    pg_temp.fixture_id(request_label),pg_temp.fixture_id(report_label),code,'Motivo sintético de cancelación')
$$;
create function pg_temp.boundary_resolve_sql(request_label text,report_label text,action text default 'confirmado')
returns text language sql as $$
  select format('select public.resolve_payment_report(%L::uuid,%L::uuid,%L,%L)',
    pg_temp.fixture_id(request_label),pg_temp.fixture_id(report_label),action,'Motivo sintético financiero')
$$;
create function pg_temp.boundary_receipt(p_result jsonb,p_request_label text,p_report_label text,
  p_actor text,p_status text,p_cancelled boolean,p_replayed boolean default false) returns void language plpgsql as $$
declare keys text[];
begin
  select array_agg(k order by k) into keys from jsonb_object_keys(p_result) k;
  perform pg_temp.boundary_assert(keys=array['audit_event_id','cancelled','invoice_code','invoice_id','replayed','report_id','request_id','status'],
    'recibo mínimo exacto conserva8campos');
  perform pg_temp.boundary_assert(p_result @> jsonb_build_object('request_id',pg_temp.fixture_id(p_request_label),
    'report_id',pg_temp.fixture_id(p_report_label),'status',p_status,'cancelled',p_cancelled,'replayed',p_replayed),'identidad/transición exacta de recibo');
  perform pg_temp.boundary_assert(exists(select 1 from payment_private.report_commands r
    join public.entity_audit_log a on a.id=r.audit_event_id join public.payment_reports p on p.id=r.report_id
    where r.request_id=pg_temp.fixture_id(p_request_label) and r.report_id=pg_temp.fixture_id(p_report_label)
      and r.actor_id=pg_temp.fixture_id(p_actor) and a.actor_id=r.actor_id and a.tenant_id=p.tenant_id
      and a.entity_id=p.id and a.correlation_id=r.request_id::text and a.id=(p_result->>'audit_event_id')::uuid
      and p.invoice_id=(p_result->>'invoice_id')::uuid and p.invoice_code=p_result->>'invoice_code'),
    'recibo vincula reporte, actor, tenant y auditoría REAL');
end;
$$;
do $new_commands$
declare result jsonb; state_before jsonb; paid_before numeric;
begin
  result:=pg_temp.boundary_actor('portal-A',pg_temp.boundary_create_sql('boundary-create','new-A'));
  perform pg_temp.boundary_receipt(result,'boundary-create','new-A','portal-A','reportado',false);
  state_before:=pg_temp.boundary_state();
  result:=pg_temp.boundary_actor('portal-A',pg_temp.boundary_create_sql('boundary-create','new-A'));
  perform pg_temp.boundary_receipt(result,'boundary-create','new-A','portal-A','reportado',false,true);
  perform pg_temp.boundary_assert(state_before=pg_temp.boundary_state(),'replay create no duplica efectos');
  result:=pg_temp.boundary_actor('portal-A',pg_temp.boundary_cancel_sql('boundary-cancel','new-A'));
  perform pg_temp.boundary_receipt(result,'boundary-cancel','new-A','portal-A','reportado',true);
  state_before:=pg_temp.boundary_state();
  result:=pg_temp.boundary_actor('portal-A',pg_temp.boundary_cancel_sql('boundary-cancel','new-A'));
  perform pg_temp.boundary_receipt(result,'boundary-cancel','new-A','portal-A','reportado',true,true);
  perform pg_temp.boundary_assert(state_before=pg_temp.boundary_state(),'replay cancel no duplica efectos');
  perform pg_temp.boundary_assert((select deleted_at is null and proof_path=pg_temp.proof_path('tenant-A','invoice-A','new-A')
    and note='Nota sintética del cliente' from public.payment_reports where id=pg_temp.fixture_id('new-A')),
    'cancelación mantiene fila, nota y comprobante');
  select paid_amount into paid_before from public.invoices where id=pg_temp.fixture_id('invoice-A');
  result:=pg_temp.boundary_actor('accounting-A',pg_temp.boundary_resolve_sql('boundary-confirm','legacy-A'));
  perform pg_temp.boundary_receipt(result,'boundary-confirm','legacy-A','accounting-A','confirmado',false);
  perform pg_temp.boundary_assert((select paid_amount=paid_before+100 from public.invoices where id=pg_temp.fixture_id('invoice-A')),
    'confirmación acreditó exactamente100');
  state_before:=pg_temp.boundary_state();
  result:=pg_temp.boundary_actor('accounting-A',pg_temp.boundary_resolve_sql('boundary-confirm','legacy-A'));
  perform pg_temp.boundary_receipt(result,'boundary-confirm','legacy-A','accounting-A','confirmado',false,true);
  perform pg_temp.boundary_assert(state_before=pg_temp.boundary_state(),'replay confirm no vuelve a acreditar');
  result:=pg_temp.boundary_actor('admin-A',pg_temp.boundary_resolve_sql('boundary-reject','legacy-other','rechazado'));
  perform pg_temp.boundary_receipt(result,'boundary-reject','legacy-other','admin-A','rechazado',false);
  result:=pg_temp.boundary_actor('portal-B',pg_temp.boundary_create_sql('boundary-create-B','new-B','invoice-B'));
  perform pg_temp.boundary_receipt(result,'boundary-create-B','new-B','portal-B','reportado',false);
  perform pg_temp.boundary_denied('segundo request no duplica confirmación','accounting-A',
    pg_temp.boundary_resolve_sql('boundary-confirm-again','legacy-A'),'authenticated','23514');
  perform pg_temp.boundary_denied('request no cambia de verbo','portal-A',
    pg_temp.boundary_cancel_sql('boundary-create','new-A'),'authenticated','23505');
  perform pg_temp.boundary_denied('marketing no gana resolución','marketing-A',pg_temp.boundary_resolve_sql('denied-role','audit-resolve'));
  perform pg_temp.boundary_denied('membresía financiera desactivada','disabled-A',pg_temp.boundary_resolve_sql('denied-role','audit-resolve'));
  perform pg_temp.boundary_denied('A no cancela B','portal-A',pg_temp.boundary_cancel_sql('denied-cross','new-B'),'authenticated','P0002');
  perform pg_temp.boundary_denied('B no cancela A','portal-B',pg_temp.boundary_cancel_sql('denied-cross','new-A'),'authenticated','P0002');
  perform pg_temp.boundary_denied('A no resuelve B','accounting-A',pg_temp.boundary_resolve_sql('denied-cross','new-B'),'authenticated','P0002');
  perform pg_temp.boundary_denied('service no ejecuta wrapper nuevo',null,pg_temp.boundary_create_sql('denied-service','invalid'),'service_role');
  perform pg_temp.boundary_denied('anon no ejecuta wrapper nuevo',null,pg_temp.boundary_create_sql('denied-anon','invalid'),'anon');
end;
$new_commands$;

-- Revocación posterior al recibo: ni el replay sustituye la identidad viva.
savepoint revoked_replay;
update public.client_users set status='revoked' where auth_user_id=pg_temp.fixture_id('portal-A');
select pg_temp.visible_reports('portal-A',array[]::uuid[]);
select pg_temp.boundary_denied('replay revocado','portal-A',pg_temp.boundary_create_sql('boundary-create','new-A'));
rollback to revoked_replay;
release savepoint revoked_replay;

-- Fallo del destino REAL de auditoría, no un mock del writer: todos los verbos
-- deben revertir datos, saldo y recibo. Nada se borra de Storage como compensación.
create function pg_temp.boundary_audit_unavailable() returns trigger language plpgsql as $$
begin raise exception 'TEST0422_DESTINO_AUDITORIA_NO_DISPONIBLE'; end;
$$;
create trigger test0422_audit_failure before insert on public.entity_audit_log
  for each row execute function pg_temp.boundary_audit_unavailable();
select pg_temp.boundary_denied('audit rollback create','portal-A',
  pg_temp.boundary_create_sql('audit-create','audit-create','invoice-audit'),'authenticated','P0001');
select pg_temp.boundary_denied('audit rollback cancel','portal-A',
  pg_temp.boundary_cancel_sql('audit-cancel','audit-resolve','F-AUDIT'),'authenticated','P0001');
select pg_temp.boundary_denied('audit rollback confirm','accounting-A',
  pg_temp.boundary_resolve_sql('audit-confirm','audit-resolve'),'authenticated','P0001');
select pg_temp.boundary_denied('audit rollback reject','admin-A',
  pg_temp.boundary_resolve_sql('audit-reject','audit-resolve','rechazado'),'authenticated','P0001');
drop trigger test0422_audit_failure on public.entity_audit_log;

do $rename_after$
declare result jsonb; receipts_before jsonb; proofs_before jsonb; events_before bigint;
begin
  select jsonb_agg(to_jsonb(r) order by request_id) into receipts_before from payment_private.report_commands r;
  select jsonb_agg(jsonb_build_array(id,proof_path) order by id) into proofs_before from public.payment_reports;
  select count(*) into events_before from public.entity_audit_log;
  result:=pg_temp.boundary_actor('admin-B',format('select public.rename_client_markbox(%L::uuid,%L,%L)',
    pg_temp.fixture_id('client-B'),'DTD-B-NEW','Renombrado sintético aprobado'));
  perform pg_temp.boundary_assert(result->>'new_markbox'='DTD-B-NEW','rename0371 REAL sigue ejecutable');
  perform pg_temp.boundary_assert((select count(*)=2 and bool_and(client_markbox='DTD-B-NEW') from public.payment_reports
    where id in(pg_temp.fixture_id('legacy-B'),pg_temp.fixture_id('new-B'))),'rename mueve ambas copias financieras');
  perform pg_temp.boundary_assert((select jsonb_agg(to_jsonb(r) order by request_id)=receipts_before from payment_private.report_commands r),
    'rename no reescribe recibos append-only');
  perform pg_temp.boundary_assert((select jsonb_agg(jsonb_build_array(id,proof_path) order by id)=proofs_before from public.payment_reports),
    'rename conserva IDs y evidencia original');
  perform pg_temp.boundary_assert((select count(*)=events_before from public.entity_audit_log),'rename no altera auditoría de comandos');
  perform pg_temp.visible_reports('portal-B',array[pg_temp.fixture_id('legacy-B'),pg_temp.fixture_id('new-B')]);
  result:=pg_temp.boundary_actor('portal-B',pg_temp.boundary_create_sql('boundary-create-B','new-B','invoice-B'));
  perform pg_temp.boundary_receipt(result,'boundary-create-B','new-B','portal-B','reportado',false,true);
  perform pg_temp.boundary_assert(exists(select 1 from public.client_markbox_history where
    client_id=pg_temp.fixture_id('client-B') and markbox='DUP'),'rename conserva alias histórico');
end;
$rename_after$;
select pg_temp.boundary_denied('diagnóstico posterior rename con padre archivado','admin-A',format(
  'select public.rename_client_markbox(%L::uuid,%L,%L)',pg_temp.fixture_id('client-A'),'DTD-A-NEW','Motivo sintético'),
  'authenticated','23514');

do $final_checks$
declare assertions bigint;
begin
  perform pg_temp.boundary_assert(not exists(select 1 from boundary_baseline_buckets b full join
    (select to_jsonb(x) as row_data from storage.buckets x) n using(row_data)
    where b.row_data is null or n.row_data is null),'buckets intactos');
  perform pg_temp.boundary_assert((pg_temp.boundary_state()->'objects')=(select snapshot->'objects' from boundary_baseline_state),
    'ningún comando o rename borra/reemplaza evidencia');
  perform pg_temp.boundary_assert((select count(*) from public.entity_audit_log)=(select count(*) from payment_private.report_commands),
    'un evento real por comando efectivo');
  select last_value into assertions from boundary_assertions;
  raise notice 'TEST0422 GREEN: % aserciones; permisos API, filas visibles, comandos reales, drift, rollback y rename',assertions;
end;
$final_checks$;

rollback;
select to_regclass('public.payment_reports') is null as fixture_rolled_back;
