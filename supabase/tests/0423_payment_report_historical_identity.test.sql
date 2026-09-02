\set ON_ERROR_STOP on
-- SDD-0366: historia de pago no debe impedir el rename autorizado de identidad.
-- Sólo PostgreSQL desechable vacío y datos sintéticos. Nunca Cloud.
-- RED: psql -v apply_fix=false -f /sb/tests/0423_payment_report_historical_identity.test.sql
\if :{?apply_fix}
\else
\set apply_fix true
\endif
\if :{?fixture_only}
\else
\set fixture_only false
\endif
\if :{?cloud_validator_baseline}
\else
\set cloud_validator_baseline false
\endif
\set apply_historical_fix :apply_fix
\set apply_fix true
\set fixture_in_transaction true
begin;
\ir 0421_payment_report_commands.test.sql
\set fixture_in_transaction false
\set apply_fix :apply_historical_fix

-- Dependencias laterales mínimas de0371: cuerpos reales, sin simular rename,
-- sus guards de roles/tenant ni el writer de auditoría instalado por0421.
alter table public.clients add column merged_into_client_id uuid,
  add column aliado_id uuid, add column kommo_lead_id bigint;
create table public.aliados(id uuid primary key,tenant_id uuid,client_id uuid,prefix text,status text,deleted_at timestamptz);
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
  if body='' or body not like '%Tenant mismatch:%' then raise exception 'TEST0423: fuente0012 no reconocida'; end if;
  execute 'create or replace function public.assert_tenant_match(p_tenant_id uuid)'||body;
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
\ir ../migrations/0422_payment_report_command_boundary.sql

\if :cloud_validator_baseline
-- Variante EXACTA0195 observada read-only en el catálogo alojado (2026-09-02).
-- Se reproduce sólo localmente: no conecta ni escribe en Cloud. El ARRAY
-- garantiza LF inicial/final independiente del checkout Windows; no normaliza
-- ni acepta cuerpos arbitrarios. La huella debe coincidir antes y después.
do $cloud_validator_baseline$
declare
  exact_body text:=chr(10)||array_to_string(array[
    $line$declare v_code text;$line$,
    $line$begin$line$,
    $line$  select invoice_code into v_code from public.invoices$line$,
    $line$  where id = new.invoice_id and tenant_id = new.tenant_id and client_markbox = new.client_markbox and status <> 'borrador' and deleted_at is null;$line$,
    $line$  if v_code is null then$line$,
    $line$    raise exception 'reporte de pago sobre factura inexistente, ajena, en borrador o de otro cliente (invoice %, tenant %, markbox %)', new.invoice_id, new.tenant_id, new.client_markbox using errcode = 'check_violation';$line$,
    $line$  end if;$line$,
    $line$  new.invoice_code := v_code;$line$,
    $line$  return new;$line$,
    $line$end;$line$
  ],chr(10))||chr(10);
  before_metadata jsonb;
begin
  if md5(exact_body)<>'cb17928a9d5beea435eddf06ea2087bc' then
    raise exception 'TEST0423: cuerpo Cloud sintético no coincide con la huella observada';
  end if;
  select to_jsonb(p)-'prosrc' into strict before_metadata from pg_proc p
    where oid='public.payment_reports_validate_invoice()'::regprocedure;
  execute format('create or replace function public.payment_reports_validate_invoice() returns trigger language plpgsql security definer set search_path=public as %L',exact_body);
  if not exists(select 1 from pg_proc p where oid='public.payment_reports_validate_invoice()'::regprocedure
    and md5(prosrc)='cb17928a9d5beea435eddf06ea2087bc' and to_jsonb(p)-'prosrc'=before_metadata) then
    raise exception 'TEST0423: variante Cloud alteró metadata/ACL o perdió su huella exacta';
  end if;
  raise notice 'TEST0423: baseline Cloud exacto cb17928a9d5beea435eddf06ea2087bc instalado sólo en fixture';
end;
$cloud_validator_baseline$;
\endif

create temporary sequence historical_assertions;
create function pg_temp.historical_assert(p_value boolean,p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST0423: %',p_label; end if;
  perform nextval('pg_temp.historical_assertions');
end;
$$;
create function pg_temp.historical_actor(p_actor text,p_sql text,p_role text default 'authenticated')
returns jsonb language plpgsql as $$
declare result jsonb;
begin
  perform set_config('request.jwt.claim.sub',coalesce(pg_temp.fixture_id(p_actor)::text,''),true);
  execute format('set local role %I',p_role);
  execute p_sql into result;
  reset role;
  return result;
exception when others then reset role; raise;
end;
$$;
-- La vista enlaza por OID para poder comprobar filas incluso durante el
-- canario que renombra la tabla privada de recibos.
create temporary view historical_receipt_rows as select to_jsonb(r) as row_data from payment_private.report_commands r;
create function pg_temp.historical_state() returns jsonb language sql as $$
  select jsonb_build_object(
    'clients',(select jsonb_agg(to_jsonb(t) order by id) from public.clients t),
    'invoices',(select jsonb_agg(to_jsonb(t) order by id) from public.invoices t),
    'reports',(select jsonb_agg(to_jsonb(t) order by id) from public.payment_reports t),
    'aliases',(select jsonb_agg(to_jsonb(t) order by id) from public.client_markbox_history t),
    'events',(select jsonb_agg(to_jsonb(t) order by id) from public.entity_audit_log t),
    'receipts',(select jsonb_agg(row_data order by row_data->>'request_id') from pg_temp.historical_receipt_rows),
    'objects',(select jsonb_agg(to_jsonb(t) order by id) from storage.objects t));
$$;
create function pg_temp.historical_denied(p_label text,p_actor text,p_sql text,
  p_role text default 'authenticated',p_code text default '42501') returns void language plpgsql as $$
declare before_state jsonb:=pg_temp.historical_state(); denied boolean:=false; actual_code text;
begin
  begin perform pg_temp.historical_actor(p_actor,p_sql,p_role);
  exception when others then
    get stacked diagnostics actual_code=returned_sqlstate;
    if (p_code is not null and actual_code<>p_code)
       or (p_code is null and actual_code not in ('23514','42501')) then
      raise exception 'TEST0423: % devuelve SQLSTATE inesperado %: %',p_label,actual_code,sqlerrm;
    end if;
    denied:=true;
  end;
  perform pg_temp.historical_assert(denied,p_label||': rechazo esperado');
  perform pg_temp.historical_assert(before_state=pg_temp.historical_state(),p_label||': sin mutación parcial');
end;
$$;

-- Estados históricos legítimos creados con los comandos auditados reales.
-- La factura se archiva DESPUÉS: no se debilita ningún trigger para sembrarlos.
insert into auth.users(id,email) select pg_temp.fixture_id(v),v||'@example.invalid'
  from unnest(array['operations-A','commercial-A','admin-B']) v;
insert into public.user_tenants values
  (pg_temp.fixture_id('operations-A'),pg_temp.fixture_id('tenant-A'),'operations',null),
  (pg_temp.fixture_id('commercial-A'),pg_temp.fixture_id('tenant-A'),'commercial',null),
  (pg_temp.fixture_id('admin-B'),pg_temp.fixture_id('tenant-B'),'admin',null);
update public.invoices set deleted_at=null where id=pg_temp.fixture_id('invoice-archived');
insert into public.payment_reports(id,tenant_id,invoice_id,invoice_code,client_markbox,amount,currency,method,paid_at,note,proof_path)
select pg_temp.fixture_id(v.label),i.tenant_id,i.id,i.invoice_code,i.client_markbox,v.amount,i.currency,'otro',current_date-1,
  'Nota histórica original',pg_temp.proof_path('tenant-A','invoice-archived',v.label)
from (values('history-cancelled',25),('history-confirmed',35),('history-rejected',45),('history-deleted',55)) v(label,amount)
cross join public.invoices i where i.id=pg_temp.fixture_id('invoice-archived');
insert into storage.objects(bucket_id,name) select 'payment-proofs',p.proof_path from public.payment_reports p
where p.id in (pg_temp.fixture_id('history-cancelled'),pg_temp.fixture_id('history-confirmed'),
  pg_temp.fixture_id('history-rejected'),pg_temp.fixture_id('history-deleted'));
select pg_temp.historical_actor('portal-A',format('select public.cancel_portal_payment_report(%L::uuid,%L::uuid,%L,%L)',
  pg_temp.fixture_id('cancel-before-archive'),pg_temp.fixture_id('history-cancelled'),'F-ARCHIVED','Cancelación previa al archivo'));
select pg_temp.historical_actor('accounting-A',format('select public.resolve_payment_report(%L::uuid,%L::uuid,%L,%L)',
  pg_temp.fixture_id('confirm-before-archive'),pg_temp.fixture_id('history-confirmed'),'confirmado','Confirmación previa al archivo'));
select pg_temp.historical_actor('admin-A',format('select public.resolve_payment_report(%L::uuid,%L::uuid,%L,%L)',
  pg_temp.fixture_id('reject-before-archive'),pg_temp.fixture_id('history-rejected'),'rechazado','Rechazo previo al archivo'));
update public.payment_reports set deleted_at=now() where id=pg_temp.fixture_id('history-deleted');
update public.invoices set deleted_at=now() where id=pg_temp.fixture_id('invoice-archived');

create temporary table historical_original_reports as select id,to_jsonb(p) as row_data from public.payment_reports p;
create temporary table historical_original_invoices as select id,to_jsonb(i) as row_data from public.invoices i;
create temporary table historical_original_events as select id,to_jsonb(a) as row_data from public.entity_audit_log a;
create temporary table historical_original_receipts as select request_id,to_jsonb(r) as row_data from payment_private.report_commands r;
create temporary table historical_original_storage as select to_jsonb(o) as row_data from storage.objects o;
create temporary table historical_original_buckets as select to_jsonb(b) as row_data from storage.buckets b;
create temporary table historical_original_state as select pg_temp.historical_state() as row_data;
create temporary table historical_original_policies as select to_jsonb(p) as definition from pg_policies p;
create temporary table historical_original_triggers as select to_jsonb(t) as definition from pg_trigger t
  where tgrelid in ('public.payment_reports'::regclass,'public.invoices'::regclass,'public.entity_audit_log'::regclass);
create temporary table historical_original_acl as select c.oid,c.relacl from pg_class c where c.oid in
  ('public.payment_reports'::regclass,'public.invoices'::regclass,'payment_private.report_commands'::regclass,
    'public.entity_audit_log'::regclass,'storage.objects'::regclass,'storage.buckets'::regclass);
create temporary table historical_original_functions as select p.oid,p.proname,pg_get_functiondef(p.oid) as definition,
  p.proacl,p.proowner,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','payment_private','auth','storage') and p.prokind='f';

-- Preparación adversarial por owner de fixture: fabrica cada contexto de forma
-- independiente para verificar guards del trigger, sin afirmar que una API
-- pueda escribir clients/history. No sustituye rename ni su auditoría.
create function pg_temp.historical_context(p_actor text default 'admin-A',p_client text default 'client-A')
returns void language plpgsql as $$
declare c public.clients;
begin
  select * into strict c from public.clients where id=pg_temp.fixture_id(p_client);
  insert into public.client_markbox_history(tenant_id,client_id,markbox,reason,retired_by)
    values(c.tenant_id,c.id,c.markbox,'Motivo histórico sintético válido',pg_temp.fixture_id(p_actor));
  update public.clients set markbox='DTD-HISTORY-TEST' where id=c.id;
  update public.invoices set client_markbox='DTD-HISTORY-TEST' where tenant_id=c.tenant_id and client_markbox=c.markbox;
end;
$$;

-- Canarios iniciales: el dueño SQL tampoco puede insertar o editar dinero
-- sobre una factura archivada; no basta con que la ACL0422 rechace a la API.
select pg_temp.historical_denied('alta sobre factura archivada',null,format(
  'insert into public.payment_reports(id,tenant_id,invoice_id,invoice_code,client_markbox,amount,currency,method,paid_at) values(%L::uuid,%L::uuid,%L::uuid,%L,%L,100,%L,%L,current_date)',
  pg_temp.fixture_id('history-new-invalid'),pg_temp.fixture_id('tenant-A'),pg_temp.fixture_id('invoice-archived'),'F-ARCHIVED','DUP','USD','otro'),
  'postgres','23514');
select pg_temp.historical_denied('edición monetaria sobre factura archivada',null,format(
  'update public.payment_reports set amount=amount+1 where id=%L::uuid',pg_temp.fixture_id('legacy-archived')),'postgres','23514');
select pg_temp.historical_denied('RPC confirmación sobre factura archivada','accounting-A',format(
  'select public.resolve_payment_report(%L::uuid,%L::uuid,%L,%L)',pg_temp.fixture_id('history-confirm-invalid'),
  pg_temp.fixture_id('legacy-archived'),'confirmado','Motivo sintético financiero'),'authenticated','23514');

\if :apply_fix
\if :fixture_only
\else
-- Derivas deliberadas, cada una aislada por subtransacción. La migración debe
-- fallar ANTES de reemplazar el validador, sin aceptar un catálogo distinto.
create temporary sequence historical_drifts;
create function pg_temp.historical_catalog() returns jsonb language sql as $$
  select jsonb_build_object(
    'functions',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('public','payment_private','auth','storage')),
    'tables',(select jsonb_agg(jsonb_build_array(c.oid,c.relacl,c.relowner,c.relrowsecurity) order by c.oid)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','payment_private','auth','storage')),
    'policies',(select jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname) from pg_policies p),
    'triggers',(select jsonb_agg(to_jsonb(t) order by t.oid) from pg_trigger t));
$$;
do $preflight_drifts$
declare drift text; failed boolean; error_message text; before_catalog jsonb; before_rows jsonb;
  original_catalog jsonb:=pg_temp.historical_catalog(); original_rows jsonb:=pg_temp.historical_state();
  migration text:=pg_read_file('/sb/migrations/0423_payment_report_historical_identity.sql');
begin
  foreach drift in array array[
    'alter table public.payment_reports disable row level security',
    'alter table public.invoices disable row level security',
    'alter table public.clients disable row level security',
    'alter table public.client_markbox_history disable row level security',
    'alter table public.user_tenants disable row level security',
    'alter table public.entity_audit_log disable row level security',
    'alter table public.payment_reports disable trigger payment_reports_validate_invoice_trg',
    'drop trigger payment_reports_validate_invoice_trg on public.payment_reports',
    'alter function public.payment_reports_validate_invoice() set search_path='''',public',
    'alter function public.payment_reports_validate_invoice() owner to authenticated',
    'grant update on public.payment_reports to authenticated',
    'grant update(amount) on public.payment_reports to service_role',
    'grant execute on function public.confirm_payment_report(uuid,public.payment_report_status,text) to authenticated',
    'alter function auth.uid() rename to fixture_missing_uid',
    'alter function public.rename_client_markbox(uuid,text,text) rename to fixture_missing_rename',
    'alter function public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text) rename to fixture_missing_audit',
    'alter table payment_private.report_commands rename to fixture_missing_receipts',
    'validator_body_drift'
  ] loop
    begin
      if drift='validator_body_drift' then
        execute (select format('create or replace function public.payment_reports_validate_invoice() returns trigger language plpgsql security definer set search_path=public as %L',
          prosrc||E'\n-- canario sintético de fingerprint') from pg_proc
          where oid='public.payment_reports_validate_invoice()'::regprocedure);
      else execute drift; end if;
      before_catalog:=pg_temp.historical_catalog(); before_rows:=pg_temp.historical_state(); failed:=false;
      begin execute migration;
      exception when others then
        get stacked diagnostics error_message=message_text;
        if sqlstate<>'P0001' or error_message not like '0423 %' then
          raise exception 'TEST0423: deriva % falló fuera del preflight: % / %',drift,sqlstate,error_message;
        end if;
        failed:=true;
      end;
      perform pg_temp.historical_assert(failed,'preflight rechaza '||drift);
      perform pg_temp.historical_assert(before_catalog=pg_temp.historical_catalog(),'preflight no escribe catálogo tras '||drift);
      perform pg_temp.historical_assert(before_rows=pg_temp.historical_state(),'preflight no escribe datos tras '||drift);
      perform nextval('pg_temp.historical_drifts');
      raise exception using errcode='PT423',message='rollback de deriva';
    exception when sqlstate 'PT423' then null;
    end;
    perform pg_temp.historical_assert(original_catalog=pg_temp.historical_catalog()
      and original_rows=pg_temp.historical_state(),'deriva retirada: '||drift);
  end loop;
end;
$preflight_drifts$;
select last_value as historical_preflight_drifts_passed from historical_drifts;
\endif
\ir ../migrations/0423_payment_report_historical_identity.sql
\endif
\if :fixture_only
-- Opt-in para advisors locales: conserva SOLAMENTE este schema sintético.
-- La guarda de0421 exige DB vacía; el caller es dueño del contenedor a retirar.
commit;
\quit
\endif

select pg_temp.historical_assert((select row_data=pg_temp.historical_state() from historical_original_state),
  'aplicar0423 no modifica ninguna fila del fixture');
select pg_temp.historical_assert(not exists(
  (select definition from historical_original_policies except select to_jsonb(p) from pg_policies p)
  union all (select to_jsonb(p) from pg_policies p except select definition from historical_original_policies)),
  'policies completas, incluida Portal0420 y ACL0422, intactas');
select pg_temp.historical_assert(not exists(select 1 from historical_original_acl b join pg_class c on c.oid=b.oid
  where c.relacl is distinct from b.relacl),'ACL de tablas sin cambios');
select pg_temp.historical_assert(not exists(
  (select definition from historical_original_triggers except select to_jsonb(t) from pg_trigger t
    where tgrelid in ('public.payment_reports'::regclass,'public.invoices'::regclass,'public.entity_audit_log'::regclass))
  union all (select to_jsonb(t) from pg_trigger t
    where tgrelid in ('public.payment_reports'::regclass,'public.invoices'::regclass,'public.entity_audit_log'::regclass)
    except select definition from historical_original_triggers)), 'triggers originales conservados');
select pg_temp.historical_assert(not exists(select 1 from historical_original_functions b
  left join pg_proc p on p.oid=b.oid where p.oid is null or p.proacl is distinct from b.proacl
    or p.proowner<>b.proowner or p.prosecdef<>b.prosecdef
    or (b.proname<>'payment_reports_validate_invoice' and
      (pg_get_functiondef(p.oid)<>b.definition or p.proconfig is distinct from b.proconfig))),
  'sólo cambia función0195, no rename0371 ni comandos0421 ni writer real');

-- Un canario por propiedad; cada contexto vuelve íntegro a su estado inicial.
-- Los cambios owner preparan datos sintéticos imposibles de escribir por API;
-- la operación bajo prueba SIEMPRE pasa por el trigger real.
create function pg_temp.historical_guard_case(p_label text,p_setup text,p_change text,
  p_actor text default 'admin-A',p_code text default '23514',p_role text default 'postgres',
  p_client text default 'client-A',p_report text default 'legacy-archived') returns void language plpgsql as $$
declare before_state jsonb:=pg_temp.historical_state();
begin
  begin
    perform pg_temp.historical_context(coalesce(p_actor,'admin-A'),p_client);
    if p_setup is not null then execute p_setup; end if;
    perform pg_temp.historical_denied(p_label,p_actor,format(
      'update public.payment_reports set client_markbox=%L%s where id=%L::uuid',
      'DTD-HISTORY-TEST',coalesce(', '||p_change,''),pg_temp.fixture_id(p_report)),p_role,p_code);
    raise exception using errcode='PT423',message='rollback de contexto sintético';
  exception when sqlstate 'PT423' then null;
  end;
  perform pg_temp.historical_assert(before_state=pg_temp.historical_state(),p_label||': contexto retirado');
end;
$$;

-- apply_fix=false debe seguir terminando en el RED causal original, sin exigir
-- guards nuevos antes de que exista la solución.
\if :apply_fix
do $immutable_payload$
declare alteration text;
begin
  foreach alteration in array array[
    'amount=amount+1','currency=''CNY''','method=''zelle''','paid_at=paid_at-1',
    'note=''Nota alterada''','proof_path=null','status=''confirmado''',
    'confirmed_by=pg_temp.fixture_id(''admin-A'')','confirmed_at=now()',
    'invoice_code=''SNAPSHOT-FALSO''','id=pg_temp.fixture_id(''changed-report-id'')',
    'created_at=created_at-interval ''1 day''','deleted_at=now()',
    'resolution_reason=''Motivo manipulado''','cancelled_at=now(),cancelled_by=pg_temp.fixture_id(''admin-A'')',
    'invoice_id=pg_temp.fixture_id(''invoice-A'')','tenant_id=pg_temp.fixture_id(''tenant-B'')'
  ] loop
    perform pg_temp.historical_guard_case('historia no permite '||alteration,
      'update public.invoices set deleted_at=now() where id=pg_temp.fixture_id(''invoice-A'')',alteration);
  end loop;
end;
$immutable_payload$;
select pg_temp.historical_guard_case('columna futura protegida por defecto',
  'alter table public.payment_reports add column fixture_future_payload text',
  'fixture_future_payload=''alterado''');
select pg_temp.historical_guard_case('cambio parent y tenant ajenos coherentes no autorizado',
  'update public.invoices set deleted_at=now(),client_markbox=''DTD-HISTORY-TEST'' where id=pg_temp.fixture_id(''invoice-B'')',
  'tenant_id=pg_temp.fixture_id(''tenant-B''),invoice_id=pg_temp.fixture_id(''invoice-B''),invoice_code=''F-CMD-SHARED''');
select pg_temp.historical_guard_case('factura archivada en borrador',
  'update public.invoices set status=''borrador'' where id=pg_temp.fixture_id(''invoice-archived'')',null);

do $identity_guards$
declare actor text;
begin
  foreach actor in array array[null,'unlinked','portal-A','accounting-A','marketing-A','disabled-A','admin-B'] loop
    perform pg_temp.historical_guard_case('actor histórico inválido '||coalesce(actor,'sin uid'),null,null,actor,'42501');
  end loop;
end;
$identity_guards$;
select pg_temp.historical_guard_case('membresía admin revocada',
  'update public.user_tenants set disabled_at=now() where user_id=pg_temp.fixture_id(''admin-A'')',null,'admin-A','42501');
select pg_temp.historical_guard_case('rol válido en otro tenant no autoriza historia B',
  'update public.invoices set deleted_at=now() where id=pg_temp.fixture_id(''invoice-B'')',
  null,'admin-A','42501','postgres','client-B','legacy-B');
select pg_temp.historical_guard_case('sin alias previo',
  'delete from public.client_markbox_history',null,'admin-A','42501');
select pg_temp.historical_guard_case('alias de otro cliente',
  'update public.client_markbox_history set client_id=pg_temp.fixture_id(''client-A-other'')',null,'admin-A','42501');
select pg_temp.historical_guard_case('alias de otro tenant',
  'update public.client_markbox_history set tenant_id=pg_temp.fixture_id(''tenant-B'')',null,'admin-A','42501');
select pg_temp.historical_guard_case('alias retirado por otro actor',
  'update public.client_markbox_history set retired_by=pg_temp.fixture_id(''commercial-A'')',null,'admin-A','42501');
select pg_temp.historical_guard_case('alias sin actor',
  'update public.client_markbox_history set retired_by=null',null,'admin-A','42501');
select pg_temp.historical_guard_case('código viejo no pertenece al alias',
  'update public.client_markbox_history set markbox=''OTHER''',null,'admin-A','42501');
select pg_temp.historical_guard_case('cliente eliminado',
  'update public.clients set deleted_at=now() where id=pg_temp.fixture_id(''client-A'')',null,'admin-A','42501');
select pg_temp.historical_guard_case('cliente fusionado',
  'update public.clients set merged_into_client_id=pg_temp.fixture_id(''client-A-other'') where id=pg_temp.fixture_id(''client-A'')',
  null,'admin-A','42501');
select pg_temp.historical_guard_case('cliente con código actual distinto',
  'update public.clients set markbox=''DTD-DIFFERENT'' where id=pg_temp.fixture_id(''client-A'')',null,'admin-A','42501');
do $reason_guards$
declare reason text;
begin
  foreach reason in array array[null,'','   ','abc',repeat('x',501)] loop
    perform pg_temp.historical_guard_case('motivo inválido '||coalesce(length(reason)::text,'NULL'),
      format('update public.client_markbox_history set reason=%L',reason),null,'admin-A','22023');
  end loop;
end;
$reason_guards$;
select pg_temp.historical_guard_case('API autenticada no recupera UPDATE',null,null,'admin-A','42501','authenticated');
select pg_temp.historical_guard_case('service_role no recupera UPDATE',null,null,'admin-A','42501','service_role');

-- El mismo comando0371 conserva sus roles permitidos. Los motivos mínimos y
-- máximos se ejercitan por el flujo real, no sólo por un UPDATE de fixture.
do $allowed_roles$
declare actor text; result jsonb; before_state jsonb:=pg_temp.historical_state(); expected_reason text;
begin
  foreach actor in array array['commercial-A','operations-A'] loop
    begin
      expected_reason:=case when actor='commercial-A' then 'abcd' else repeat('x',500) end;
      result:=pg_temp.historical_actor(actor,format('select public.rename_client_markbox(%L::uuid,%L,%L)',
        pg_temp.fixture_id('client-A'),'DTD-ROLE-CONTROL',expected_reason));
      perform pg_temp.historical_assert((result->>'ok')::boolean,actor||': rename histórico autorizado');
      perform pg_temp.historical_assert((select count(*)=5 and bool_and(actor_id=pg_temp.fixture_id(actor)
        and expected_reason=entity_audit_log.reason and tenant_id=pg_temp.fixture_id('tenant-A'))
        from public.entity_audit_log where event_type='payment_report_markbox_updated'),actor||': cinco eventos propios');
      raise exception using errcode='PT423',message='rollback de control positivo';
    exception when sqlstate 'PT423' then null;
    end;
    perform pg_temp.historical_assert(before_state=pg_temp.historical_state(),actor||': control positivo retirado');
  end loop;
end;
$allowed_roles$;
do $rename_reason_guards$
declare reason text;
begin
  perform set_config('dtd.audit_reason','GUC ajeno no autoriza ni sustituye motivo',true);
  foreach reason in array array[null,'','abc',repeat('x',501)] loop
    perform pg_temp.historical_denied('rename sin motivo humano válido','admin-A',format(
      'select public.rename_client_markbox(%L::uuid,%L,%L)',pg_temp.fixture_id('client-A'),'DTD-BAD-REASON',reason),
      'authenticated','22023');
    perform pg_temp.historical_assert(current_setting('dtd.audit_reason',true)='GUC ajeno no autoriza ni sustituye motivo',
      'rename denegado conserva contexto de auditoría previo');
  end loop;
end;
$rename_reason_guards$;

-- La auditoría es la REAL0267/0294. Sólo falla el destino en la segunda fila,
-- después de que el rename ya haya movido cliente/facturas y un evento previo.
-- Ni excepción ni un INSERT que devuelve NULL pueden confirmar parcialmente.
create function pg_temp.historical_audit_fault() returns trigger language plpgsql as $$
begin
  if new.event_type='payment_report_markbox_updated' and exists(
    select 1 from public.entity_audit_log where event_type='payment_report_markbox_updated') then
    if tg_argv[0]='null' then return null; end if;
    raise exception 'TEST0423 fallo sintético en destino de auditoría' using errcode='P0001';
  end if;
  return new;
end;
$$;
create trigger historical_audit_fault before insert on public.entity_audit_log
  for each row execute function pg_temp.historical_audit_fault('raise');
select pg_temp.historical_denied('fallo de auditoría revierte TODO el rename','admin-A',format(
  'select public.rename_client_markbox(%L::uuid,%L,%L)',pg_temp.fixture_id('client-A'),'DTD-FAULT','Motivo válido con fallo sintético'),
  'authenticated','P0001');
select pg_temp.historical_assert(current_setting('dtd.audit_reason',true)='GUC ajeno no autoriza ni sustituye motivo',
  'excepción del writer restaura el contexto previo');
drop trigger historical_audit_fault on public.entity_audit_log;
create trigger historical_audit_fault before insert on public.entity_audit_log
  for each row execute function pg_temp.historical_audit_fault('null');
select pg_temp.historical_denied('auditoría sin ID revierte TODO el rename','admin-A',format(
  'select public.rename_client_markbox(%L::uuid,%L,%L)',pg_temp.fixture_id('client-A'),'DTD-NULL-AUDIT','Motivo válido sin recibo de auditoría'),
  'authenticated','23514');
drop trigger historical_audit_fault on public.entity_audit_log;
\endif

-- RED causal:0371 es autorizado y actualiza primero cliente/factura, pero0195
-- rechaza el UPDATE de la copia histórica porque su factura está archivada.
do $authorized_rename$
declare result jsonb; state_before jsonb:=pg_temp.historical_state(); error_code text; error_message text;
begin
  begin
    result:=pg_temp.historical_actor('admin-A',format('select public.rename_client_markbox(%L::uuid,%L,%L)',
      pg_temp.fixture_id('client-A'),'DTD-HISTORY-NEW','Cambio de identidad sintético autorizado'));
  exception when others then
    get stacked diagnostics error_code=returned_sqlstate,error_message=message_text;
    raise notice 'TEST0423 RED diagnóstico: SQLSTATE %, error %, rollback integral %',error_code,error_message,
      state_before=pg_temp.historical_state();
  end;
  perform pg_temp.historical_assert(error_code is null and (result->>'ok')::boolean,
    'rename autorizado debe conservar reportes sobre facturas archivadas');
  perform pg_temp.historical_assert(result->>'old_markbox'='DUP' and result->>'new_markbox'='DTD-HISTORY-NEW'
    and result->>'client_id'=pg_temp.fixture_id('client-A')::text,'recibo del rename conserva identidad original');
end;
$authorized_rename$;

do $historical_integrity$
declare old_report record; old_invoice record; actual_row jsonb; expected_mark text; event_row record; alias_id uuid;
begin
  perform pg_temp.historical_assert((select count(*) from public.payment_reports)=
    (select count(*) from historical_original_reports),'ningún reporte creado ni perdido');
  for old_report in select * from historical_original_reports loop
    select to_jsonb(p) into strict actual_row from public.payment_reports p where id=old_report.id;
    expected_mark:=case when old_report.row_data->>'tenant_id'=pg_temp.fixture_id('tenant-A')::text
      and old_report.row_data->>'client_markbox'='DUP' then 'DTD-HISTORY-NEW' else old_report.row_data->>'client_markbox' end;
    perform pg_temp.historical_assert(actual_row->>'client_markbox'=expected_mark,'markbox correcto para '||old_report.id);
    perform pg_temp.historical_assert(actual_row-array['client_markbox','updated_at']=
      old_report.row_data-array['client_markbox','updated_at'],'fila completa conservada para '||old_report.id);
    if expected_mark<>'DTD-HISTORY-NEW' then
      perform pg_temp.historical_assert(actual_row=old_report.row_data,'reporte ajeno ni siquiera cambia updated_at');
    end if;
  end loop;
  for old_invoice in select * from historical_original_invoices loop
    select to_jsonb(i) into strict actual_row from public.invoices i where id=old_invoice.id;
    perform pg_temp.historical_assert(actual_row-array['client_markbox','updated_at']=
      old_invoice.row_data-array['client_markbox','updated_at'],'saldo y snapshot fiscal de factura conservados');
  end loop;
  perform pg_temp.historical_assert((select count(*)=1 and bool_and(client_id=pg_temp.fixture_id('client-A')
    and tenant_id=pg_temp.fixture_id('tenant-A') and markbox='DUP' and retired_by=pg_temp.fixture_id('admin-A')
    and reason='Cambio de identidad sintético autorizado') from public.client_markbox_history),'alias original reservado al mismo cliente');
  select id into strict alias_id from public.client_markbox_history where client_id=pg_temp.fixture_id('client-A');
  perform pg_temp.historical_assert((select client_id=pg_temp.fixture_id('client-A') and canonical_markbox='DTD-HISTORY-NEW'
    and was_redirected from public.resolve_markbox(pg_temp.fixture_id('tenant-A'),'DUP')),'alias viejo resuelve al mismo cliente');
  perform pg_temp.historical_assert((select client_id=pg_temp.fixture_id('client-B') and canonical_markbox='DUP'
    and not was_redirected from public.resolve_markbox(pg_temp.fixture_id('tenant-B'),'DUP')),'mismo código en B no se renombra');
  perform pg_temp.historical_assert((select count(*)=5 from public.entity_audit_log
    where event_type='payment_report_markbox_updated'),'exactamente un evento por cada reporte histórico, incluso soft-deleted');
  for event_row in select * from public.entity_audit_log where event_type='payment_report_markbox_updated' loop
    perform pg_temp.historical_assert(event_row.entity_type='payment_report' and event_row.source='rpc'
      and event_row.result='succeeded' and event_row.actor_type='user'
      and event_row.actor_id=pg_temp.fixture_id('admin-A') and event_row.tenant_id=pg_temp.fixture_id('tenant-A')
      and event_row.correlation_id=alias_id::text,'evento vincula actor/tenant reales e historial');
    perform pg_temp.historical_assert(event_row.reason='Cambio de identidad sintético autorizado',
      'motivo validado prevalece sobre GUC ajeno');
    perform pg_temp.historical_assert(event_row.before_data=jsonb_build_object('invoice_id',pg_temp.fixture_id('invoice-archived'),'client_markbox','DUP')
      and event_row.after_data=jsonb_build_object('invoice_id',pg_temp.fixture_id('invoice-archived'),'client_markbox','DTD-HISTORY-NEW'),
      'antes/después mínimos sin monto, pagador, nota ni comprobante');
    perform pg_temp.historical_assert(not(event_row.payload ?| array['amount','currency','note','proof_path','paid_at','payer']),
      'payload del evento no copia datos financieros');
  end loop;
  perform pg_temp.historical_assert(not exists(select 1 from public.payment_reports p where p.invoice_id=pg_temp.fixture_id('invoice-archived')
    and not exists(select 1 from public.entity_audit_log a where a.entity_id=p.id and a.event_type='payment_report_markbox_updated')),
    'cada reporte archivado tiene su evento propio');
  perform pg_temp.historical_assert(not exists(select 1 from historical_original_events b
    left join public.entity_audit_log a on a.id=b.id where a.id is null or to_jsonb(a)<>b.row_data),
    'eventos previos no se reescriben');
  perform pg_temp.historical_assert((select count(*) from public.entity_audit_log)=
    (select count(*)+5 from historical_original_events),'no hay eventos duplicados ni ajenos');
  perform pg_temp.historical_assert(not exists(
    (select row_data from historical_original_receipts except select to_jsonb(r) from payment_private.report_commands r)
    union all (select to_jsonb(r) from payment_private.report_commands r except select row_data from historical_original_receipts)),
    'recibos e idempotencia originales no se reescriben');
  perform pg_temp.historical_assert(not exists(
    (select row_data from historical_original_storage except select to_jsonb(o) from storage.objects o)
    union all (select to_jsonb(o) from storage.objects o except select row_data from historical_original_storage)),
    'comprobantes originales conservados, sin subida ni borrado');
  perform pg_temp.historical_assert(not exists(
    (select row_data from historical_original_buckets except select to_jsonb(b) from storage.buckets b)
    union all (select to_jsonb(b) from storage.buckets b except select row_data from historical_original_buckets)),
    'buckets completos sin cambios');
  perform pg_temp.historical_assert(current_setting('dtd.audit_reason',true)='GUC ajeno no autoriza ni sustituye motivo',
    'éxito restaura el contexto previo del caller');
end;
$historical_integrity$;

-- Lectura propia conserva historia; no depende de una factura viva y no revela
-- las filas soft-deleted ni las de otro cliente/tenant con el mismo código.
do $portal_visibility$
declare actual jsonb; expected jsonb; actor text;
begin
  foreach actor in array array['portal-A','portal-B'] loop
    select coalesce(jsonb_agg(id::text order by id),'[]'::jsonb) into expected from historical_original_reports
      where row_data->>'tenant_id'=pg_temp.fixture_id(case when actor='portal-A' then 'tenant-A' else 'tenant-B' end)::text
      and row_data->>'client_markbox'='DUP' and row_data->>'deleted_at' is null;
    actual:=pg_temp.historical_actor(actor,'select coalesce(jsonb_agg(id::text order by id),''[]''::jsonb) from public.payment_reports');
    perform pg_temp.historical_assert(actual=expected,actor||': visibilidad propia conserva los mismos IDs');
  end loop;
end;
$portal_visibility$;

select pg_temp.historical_denied('alta histórica sigue prohibida tras0423',null,format(
  'insert into public.payment_reports(id,tenant_id,invoice_id,invoice_code,client_markbox,amount,currency,method,paid_at) values(%L::uuid,%L::uuid,%L::uuid,%L,%L,100,%L,%L,current_date)',
  pg_temp.fixture_id('history-new-invalid'),pg_temp.fixture_id('tenant-A'),pg_temp.fixture_id('invoice-archived'),
  'F-ARCHIVED','DTD-HISTORY-NEW','USD','otro'),'postgres','23514');
select pg_temp.historical_denied('importe histórico sigue inmutable tras rename',null,format(
  'update public.payment_reports set amount=amount+1 where id=%L::uuid',pg_temp.fixture_id('legacy-archived')),'postgres','23514');
select pg_temp.historical_denied('confirmación histórica sigue prohibida tras rename','accounting-A',format(
  'select public.resolve_payment_report(%L::uuid,%L::uuid,%L,%L)',pg_temp.fixture_id('history-confirm-invalid'),
  pg_temp.fixture_id('legacy-archived'),'confirmado','Motivo sintético financiero'),'authenticated','23514');
select pg_temp.historical_denied('cancelación histórica sigue prohibida tras rename','portal-A',format(
  'select public.cancel_portal_payment_report(%L::uuid,%L::uuid,%L,%L)',pg_temp.fixture_id('history-cancel-invalid'),
  pg_temp.fixture_id('legacy-archived'),'F-ARCHIVED','Motivo sintético cancelación'),'authenticated','23514');
select pg_temp.historical_assert(not has_table_privilege('authenticated','public.payment_reports','INSERT,UPDATE,DELETE')
  and not has_table_privilege('service_role','public.payment_reports','INSERT,UPDATE,DELETE')
  and not has_function_privilege('authenticated','public.confirm_payment_report(uuid,public.payment_report_status,text)','EXECUTE'),
  'ACL0422 no reabre DML ni RPC legacy');
select last_value as historical_assertions_passed from historical_assertions;
rollback;
select to_regclass('public.payment_reports') is null as fixture_rolled_back;
