\set ON_ERROR_STOP on
-- 0456 / SDD-0472: escritura de clients bajo el permiso efectivo del módulo.
-- PostgreSQL 17 desechable. Fixtures sintéticos; rollback al terminar.
-- Setup fiel de 0455 hasta sus utilidades: usa migraciones reales 0006, 0080,
-- 0081, 0230, 0360, 0361, 0258, 0261, 0267, 0294 y 0454, más helpers reales.
-- Esta prueba agrega la policy InitPlan real de 0012 antes de 0230,
-- 0455/0357 reales y el autorizador/mapa definitivo 0444.
-- RED: psql -v apply_fix=false; GREEN: apply_fix=true (predeterminado).
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;

do $guard$
begin
  if to_regclass('public.clients') is not null or to_regnamespace('auth') is not null then
    raise exception 'TEST 0456 requiere una base desechable vacía';
  end if;
end;
$guard$;

do $roles$
begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
create schema extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema auth to authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

create table public.tenants (
  id uuid primary key default gen_random_uuid(), slug text unique not null, display_name text
);
create table public.user_tenants (
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  disabled_at timestamptz,
  primary key (user_id, tenant_id)
);
grant select on public.tenants, public.user_tenants to authenticated;
alter table public.tenants enable row level security;
alter table public.user_tenants enable row level security;
create policy "users see their own user_tenants" on public.user_tenants for select to authenticated
  using (user_id = (select auth.uid()) and disabled_at is null);

-- get_user_tenant_id() con la forma vigente (0453) y current_studio_role() de 0200.
do $helpers$
begin
  execute (regexp_match(pg_read_file('/sb/migrations/0453_portal_helpers_principal_determinista.sql'),
    'create or replace function public\.get_user_tenant_id\(\).*?\$\$;'))[1];
  execute (regexp_match(pg_read_file('/sb/migrations/0200_rbac_disabled_enforcement.sql'),
    'create or replace function public\.current_studio_role\(\).*?\$\$;'))[1];
  execute (regexp_match(pg_read_file('/sb/migrations/0012_rls_perf_and_rpc_guards.sql'),
    'create or replace function public\.assert_tenant_match\(p_tenant_id uuid\).*?\$\$;'))[1];
  execute (regexp_match(pg_read_file('/sb/migrations/0351_operario_rpc_exige_rol.sql'),
    'create or replace function public\.assert_studio_role\(p_roles text\[\]\).*?\$\$;'))[1];
end;
$helpers$;
revoke execute on function public.get_user_tenant_id() from public, anon;
grant execute on function public.get_user_tenant_id() to authenticated;
revoke execute on function public.current_studio_role() from public, anon;
grant execute on function public.current_studio_role() to authenticated;
revoke execute on function public.assert_tenant_match(uuid) from public, anon, authenticated;
revoke execute on function public.assert_studio_role(text[]) from public, anon;
grant execute on function public.assert_studio_role(text[]) to authenticated;

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create table public.shipments (
  id uuid primary key, tenant_id uuid not null, client_markbox text, deleted_at timestamptz
);
alter table public.shipments enable row level security;
grant select on public.shipments to authenticated;

-- clients, identidad Portal y códigos cortos REALES.
\ir ../migrations/0006_clients.sql
\ir ../migrations/0080_portal_cliente.sql
\ir ../migrations/0081_portal_harden_grants.sql
-- 0012 reemplazó la policy de 0006: conservar el SELECT escalar/InitPlan.
-- Extraer el bloque exacto evita ejecutar migraciones de tablas fuera del fixture.
do $clients_initplan$
declare source text; statement text; start_at integer; end_at integer;
begin
  source := pg_read_file('/sb/migrations/0012_rls_perf_and_rpc_guards.sql');
  start_at := strpos(source, '-- clients (originally in 0006)');
  end_at := strpos(source, '-- quotes (originally in 0007)');
  if start_at=0 or end_at<=start_at then
    raise exception 'TEST 0456: no se pudo extraer policy clients real de 0012';
  end if;
  statement := substring(source from start_at for end_at-start_at);
  execute statement;
end;
$clients_initplan$;
\ir ../migrations/0230_fix_rls_soft_delete_blocked.sql
\ir ../migrations/0360_portal_access_links.sql

-- merge_clients real (0361) sobre las columnas y tablas que toca.
alter table public.clients
  add column merged_into_client_id uuid references public.clients(id) on delete set null,
  add column address_reference text, add column doc_kind text, add column contact_name text,
  add column cedula_photo_path text, add column facade_photo_url text, add column avatar_path text,
  add column lat numeric, add column lng numeric, add column person_id uuid, add column advisor_id uuid,
  add column kommo_lead_id bigint, add column kommo_contact_id bigint, add column portal_approved_at timestamptz,
  add column email_marketing_optin_at timestamptz, add column email_optin_source text,
  add column whatsapp_marketing_optin_at timestamptz;
create table public.client_delivery_addresses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, client_id uuid not null references public.clients(id),
  is_default boolean not null default false, deleted_at timestamptz
);
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, client_id uuid references public.clients(id),
  channel text not null, deleted_at timestamptz
);
create table public.conversation_monthly_digests (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, client_id uuid references public.clients(id)
);
create table public.client_notification_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, client_id uuid references public.clients(id), trigger_event text not null
);
create table public.client_change_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, client_id uuid references public.clients(id), status text not null default 'pending'
);
create table public.client_claims (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, client_id uuid references public.clients(id)
);
create table public.bitacora_meetings (id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id));
create table public.bitacora_tasks (id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id));
create table public.currency_conversions (id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id));
create table public.inspection_reports (id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id));
create table public.supplier_claim_offsets (id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id));
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_client_id uuid references public.clients(id), referred_client_id uuid references public.clients(id)
);
\ir ../migrations/0361_merge_clients_conserva_kommo_contact.sql

-- Plataforma de auditoría real y los triggers D5 de clients y client_users (0293).
create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  entity_type text not null, entity_id uuid not null, actor_type text not null,
  actor_id uuid, event_type text not null, payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint entity_audit_log_tenant_id_fkey foreign key(tenant_id) references public.tenants(id) on delete cascade,
  constraint entity_audit_log_actor_type_check check(actor_type in ('user','operario','system')),
  constraint entity_audit_log_entity_type_check check(entity_type in ('shipment'))
);
alter table public.entity_audit_log enable row level security;
create policy entity_audit_log_tenant_select on public.entity_audit_log for select to authenticated
  using(tenant_id=public.get_user_tenant_id());
create policy entity_audit_log_service_role_all on public.entity_audit_log for all to service_role
  using(true) with check(true);
grant select on public.entity_audit_log to authenticated;
grant all on public.entity_audit_log to service_role;
create publication supabase_realtime;
alter publication supabase_realtime add table public.entity_audit_log;
\ir ../migrations/0258_audit_entity_catalog.sql
\ir ../migrations/0261_audit_entity_catalog_validate.sql
\ir ../migrations/0267_audit_contract_append_only.sql
\ir ../migrations/0294_audit_d2_human_reasons.sql
insert into public.audit_entity_types (entity_type, status, domain_code, contract_version, introduced_by_ref)
values ('client', 'active', 'commercial', 1, 'migration:0293'),
       ('portal_invitation', 'active', 'access', 1, 'migration:0293');
do $d5$
begin
  execute (regexp_match(pg_read_file('/sb/migrations/0293_audit_d5_residual_and_writer_retirement.sql'),
    'create function public\.audit_d5_residual_change\(\).*?\n\$function\$;'))[1];
end;
$d5$;
revoke all on function public.audit_d5_residual_change() from public, anon, authenticated;
create trigger audit_d5_clients_contact after update of email,phone on public.clients
  for each row execute function public.audit_d5_residual_change();
create trigger audit_d5_client_users after insert or update of status on public.client_users
  for each row execute function public.audit_d5_residual_change();

-- La revocación del Portal real (0454), que 0455 exige viva.
\ir ../migrations/0454_borrar_cliente_revoca_portal.sql


\ir ../migrations/0455_borrado_cliente_auditado.sql
\ir ../migrations/0357_role_module_overrides.sql

-- Extrae código real: no reproduce a mano el motor de roles/overrides.
do $current_contract$
declare source text; statement text; contract_statement text; authorizer_statement text;
begin
  if current_setting('server_version_num')::integer not between 170000 and 179999 then
    raise exception 'TEST 0456 requiere PostgreSQL 17';
  end if;
  source := pg_read_file('/sb/migrations/0444_unlinked_document_entity_rbac.sql');
  contract_statement := (regexp_match(source,
    'create or replace function public\.document_entity_module_contract\(p_entity_type text\).*?\$\$;'))[1];
  authorizer_statement := (regexp_match(source,
    'create or replace function public\.document_entity_authorized\(.*?\$\$;'))[1];
  if contract_statement is null or authorizer_statement is null then
    raise exception 'TEST 0456: no se pudieron extraer los helpers reales de 0444';
  end if;
  execute contract_statement;
  execute authorizer_statement;
  statement := substring(source from strpos(source, 'create or replace function public.document_entity_module_contract')
    for strpos(source, 'do $post$') - strpos(source, 'create or replace function public.document_entity_module_contract'));
  -- El bloque incluye un comentario sobre el wrapper existente desde 0435.
  execute $wrapper$create function public.document_entity_allowed_for_current_role(p_entity_type text)
    returns boolean language sql stable security invoker set search_path = '' as $f$
      select public.document_entity_authorized(p_entity_type, (select public.get_user_tenant_id()), 'view')
    $f$$wrapper$;
  execute statement;
  revoke all on function public.document_entity_allowed_for_current_role(text) from public, anon;
  grant execute on function public.document_entity_allowed_for_current_role(text) to authenticated, service_role;
end;
$current_contract$;

-- SELECT Portal tal como quedó en 0430; SELECT Studio sigue tenant-only (0230).
do $portal_policy$
declare statement text;
begin
  statement := (regexp_match(pg_read_file('/sb/migrations/0430_portal_profile_change_requests_principal_tenant.sql'),
    'alter policy "clients portal self read" on public\.clients.*?;'))[1];
  if statement is null then raise exception 'TEST 0456: falta policy Portal real'; end if;
  execute statement;
end;
$portal_policy$;

create function pg_temp.fixture_id(label text) returns uuid language sql immutable as $$
  select md5('0456-synthetic-' || label)::uuid
$$;
create temporary table assertions (label text primary key);
grant insert, select on assertions to authenticated, service_role, anon;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'TEST 0456: %', label; end if;
  insert into pg_temp.assertions values (label);
end;
$$;

-- Todos los accesos de la matriz pasan por el rol API authenticated.
-- Captura SQLSTATE/row_count y restaura rol tanto en éxito como en error.
create function pg_temp.write_as(actor text, statement text, api_role text default 'authenticated')
returns jsonb language plpgsql as $$
declare affected bigint := 0; state text := '00000';
begin
  perform set_config('request.jwt.claim.sub', case when actor is null then '' else pg_temp.fixture_id(actor)::text end, true);
  execute format('set local role %I', api_role);
  begin
    execute statement;
    get diagnostics affected = row_count;
  exception when others then
    get stacked diagnostics state = returned_sqlstate;
  end;
  execute 'reset role';
  return jsonb_build_object('state', state, 'rows', affected);
end;
$$;
create function pg_temp.read_as(actor text, statement text, api_role text default 'authenticated')
returns jsonb language plpgsql as $$
declare result jsonb;
begin
  perform set_config('request.jwt.claim.sub', case when actor is null then '' else pg_temp.fixture_id(actor)::text end, true);
  execute format('set local role %I', api_role);
  execute statement into result;
  execute 'reset role';
  return result;
exception when others then
  execute 'reset role';
  raise;
end;
$$;

create function pg_temp.catalog_snapshot(include_clients_mutation boolean default true)
returns jsonb language sql stable as $snapshot$
  select jsonb_build_object(
    'functions', (select jsonb_agg(jsonb_build_array(p.oid, p.proname, p.proowner, p.proacl, p.prosecdef,
      p.provolatile, p.proconfig, md5(pg_get_functiondef(p.oid))) order by p.oid)
      from pg_proc p where p.pronamespace = 'public'::regnamespace),
    'policies', (select jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname)
      from pg_policies p where include_clients_mutation or p.tablename <> 'clients' or p.policyname = 'clients portal self read'),
    'triggers', (select jsonb_agg(jsonb_build_array(t.oid,t.tgenabled,pg_get_triggerdef(t.oid)) order by t.oid)
      from pg_trigger t where not t.tgisinternal),
    'tables', (select jsonb_agg(jsonb_build_array(c.oid,c.relowner,c.relrowsecurity,c.relforcerowsecurity,
      case when include_clients_mutation or c.oid <> 'public.clients'::regclass then c.relacl::text else 'clients ACL checked separately' end)
      order by c.oid) from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r'),
    'constraints', (select jsonb_agg(jsonb_build_array(c.oid,c.convalidated,pg_get_constraintdef(c.oid)) order by c.oid)
      from pg_constraint c where c.connamespace='public'::regnamespace)
  )
$snapshot$;
create function pg_temp.rows_snapshot() returns jsonb language sql volatile as $$
  select jsonb_build_object(
    'clients', (select jsonb_agg(to_jsonb(c) order by id) from public.clients c),
    'bindings', (select jsonb_agg(to_jsonb(c) order by id) from public.client_users c),
    'links', (select jsonb_agg(to_jsonb(c) order by id) from public.portal_access_links c),
    'audit', (select jsonb_agg(to_jsonb(c) order by id) from public.entity_audit_log c)
  )
$$;

insert into public.tenants (id,slug,display_name) values
  (pg_temp.fixture_id('tenant-A'),'fixture-0456-A','Tenant sintético A'),
  (pg_temp.fixture_id('tenant-B'),'fixture-0456-B','Tenant sintético B');
insert into auth.users (id,email)
select pg_temp.fixture_id(label), label || '@example.invalid'
from unnest(array['admin','commercial','operations','accounting','warehouse','support','marketing',
  'disabled','unknown','unassigned','foreign','multiple','portal','portal-fail','portal-merged']) label;
insert into public.user_tenants (user_id,tenant_id,role)
select pg_temp.fixture_id(role),pg_temp.fixture_id('tenant-A'),role
from unnest(array['admin','commercial','operations','accounting','warehouse','support','marketing']) role;
insert into public.user_tenants (user_id,tenant_id,role,disabled_at) values
  (pg_temp.fixture_id('disabled'),pg_temp.fixture_id('tenant-A'),'admin',now()),
  (pg_temp.fixture_id('unknown'),pg_temp.fixture_id('tenant-A'),'inventado',null),
  (pg_temp.fixture_id('foreign'),pg_temp.fixture_id('tenant-B'),'admin',null),
  (pg_temp.fixture_id('multiple'),pg_temp.fixture_id('tenant-A'),'admin',null),
  (pg_temp.fixture_id('multiple'),pg_temp.fixture_id('tenant-B'),'admin',null);
insert into public.clients (id,tenant_id,markbox,name)
select pg_temp.fixture_id(label),pg_temp.fixture_id('tenant-A'),label,'Cliente sintético ' || label
from unnest(array['c-edit','c-soft','c-fail','c-survivor','c-merged','c-merge-denied',
  'delete-admin','delete-commercial','delete-operations','delete-accounting','delete-warehouse','delete-support','delete-marketing']) label;
insert into public.clients (id,tenant_id,markbox,name) values
  (pg_temp.fixture_id('c-foreign'),pg_temp.fixture_id('tenant-B'),'c-foreign','Cliente sintético B');
insert into public.client_users (tenant_id,client_id,email,auth_user_id,status,bound_at)
select pg_temp.fixture_id('tenant-A'),pg_temp.fixture_id(client),actor || '@example.invalid',pg_temp.fixture_id(actor),'active',now()
from (values ('c-soft','portal'),('c-fail','portal-fail'),('c-merged','portal-merged')) v(client,actor);
insert into public.portal_access_links (tenant_id,client_id,code,expires_at)
select pg_temp.fixture_id('tenant-A'),pg_temp.fixture_id(client),code,now()+interval '72 hours'
from (values ('c-soft','RBACSOFT0001'),('c-fail','RBACFAIL0001'),('c-merged','RBACMERGE001')) v(client,code);

create temporary table before_migration as
select pg_temp.catalog_snapshot() as catalog,pg_temp.catalog_snapshot(false) as unchanged,pg_temp.rows_snapshot() as rows,
  current_setting('lock_timeout') as lock_timeout,current_setting('statement_timeout') as statement_timeout,
  (select jsonb_agg(to_jsonb(a) order by a.grantor,a.grantee,a.privilege_type)
   from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
   where c.oid='public.clients'::regclass
     and not (a.grantee='authenticated'::regrole and a.privilege_type='DELETE')) as preserved_acl;

-- RED control: reproduce las tres escrituras indebidas antes de aplicar 0456.
savepoint red_probe;
do $red$
declare role_name text; result jsonb;
begin
  result := pg_temp.write_as('support',format('insert into public.clients (tenant_id,markbox,name) values (%L,''red-insert'',''Sintético'')',pg_temp.fixture_id('tenant-A')));
  perform pg_temp.assert_true(result->>'state'='00000','RED support podía INSERT directo');
  result := pg_temp.write_as('warehouse',format('update public.clients set notes=''red'' where id=%L',pg_temp.fixture_id('c-edit')));
  perform pg_temp.assert_true(result->>'state'='00000' and result->>'rows'='1','RED warehouse podía UPDATE directo');
  foreach role_name in array array['admin','commercial','operations','accounting','warehouse','support','marketing'] loop
    result := pg_temp.write_as(role_name,format('delete from public.clients where id=%L',pg_temp.fixture_id('delete-' || role_name)));
    perform pg_temp.assert_true(result->>'state'='00000' and result->>'rows'='1','RED DELETE permitido a ' || role_name);
  end loop;
  raise notice 'TEST 0456 RED confirmado: support inserta, warehouse edita y los siete roles borran físicamente';
end;
$red$;
rollback to red_probe;
release red_probe;
select pg_temp.assert_true(pg_temp.rows_snapshot()=(select rows from before_migration),'La sonda RED revierte todas las filas');

-- Un drift se rechaza sin cambios de catálogo. DELETE heredado lo detecta el
-- postflight, todavía dentro del único DO atómico; los demás casos, el preflight.
create function pg_temp.reject_drift(label text, drift text) returns void language plpgsql as $$
declare failed boolean := false; state text; message text; snapshot jsonb;
begin
  begin
    execute drift;
    snapshot := pg_temp.catalog_snapshot();
    begin
      execute pg_read_file('/sb/migrations/0456_clients_write_rbac.sql');
    exception when others then
      get stacked diagnostics state=returned_sqlstate,message=message_text;
      if state <> 'P0001' or message not like '0456%' then
        raise exception 'TEST 0456: drift % falló fuera de los vuelos de seguridad: % / %',label,state,message;
      end if;
      failed := true;
    end;
    if not failed then raise exception 'TEST 0456: migración aceptó drift %',label; end if;
    if snapshot is distinct from pg_temp.catalog_snapshot() then
      raise exception 'TEST 0456: rechazo alteró catálogo con drift %',label;
    end if;
    raise exception using errcode='PT456',message='rollback drift sintético';
  exception when sqlstate 'PT456' then null;
  end;
  perform pg_temp.assert_true(true,'Drift rechazado: ' || label);
end;
$$;

\if :apply_fix
select pg_temp.reject_drift('RLS desactivada','alter table public.clients disable row level security');
select pg_temp.reject_drift('authenticated dueño de clients','alter table public.clients owner to authenticated');
select pg_temp.reject_drift('policy ALL ajena','create policy unexpected_all on public.clients for all to authenticated using(true) with check(true)');
select pg_temp.reject_drift('policy DELETE ajena','create policy unexpected_delete on public.clients for delete to authenticated using(true)');
select pg_temp.reject_drift('policy UPDATE ajena','create policy unexpected_update on public.clients for update to authenticated using(true) with check(true)');
select pg_temp.reject_drift('USING previo abierto','alter policy "clients by tenant" on public.clients using(true)');
select pg_temp.reject_drift('WITH CHECK previo abierto','alter policy "clients by tenant" on public.clients with check(true)');
select pg_temp.reject_drift('trigger 0454 desactivado','alter table public.clients disable trigger clients_revoke_portal_on_soft_delete');
select pg_temp.reject_drift('trigger 0455 desactivado','alter table public.clients disable trigger clients_audit_soft_delete');
select pg_temp.reject_drift('RPC soft-delete definer','alter function public.soft_delete_client_with_audit_reason(uuid,text) security definer');
select pg_temp.reject_drift('RPC soft-delete público','grant execute on function public.soft_delete_client_with_audit_reason(uuid,text) to public');
select pg_temp.reject_drift('helper invoker','alter function public.document_entity_authorized(text,uuid,text) security invoker');
select pg_temp.reject_drift('helper path inseguro','alter function public.document_entity_authorized(text,uuid,text) set search_path=public');
-- No eliminar whitespace dentro de literales al verificar la huella: cambiar
-- clients a cl ients desconecta los overrides aunque la estructura sea idéntica.
select pg_temp.reject_drift('literal del módulo alterado con whitespace',
  replace(pg_get_functiondef('public.document_entity_module_contract(text)'::regprocedure),
    '''clients''','''cl ients'''));
select pg_temp.reject_drift('override edit implica view ausente','alter table public.studio_role_module_overrides drop constraint studio_role_module_overrides_edit_implies_view');
select pg_temp.reject_drift('override can_edit nullable','alter table public.studio_role_module_overrides alter column can_edit drop not null');
select pg_temp.reject_drift('UPDATE directo de overrides por authenticated','grant update on public.studio_role_module_overrides to authenticated');
select pg_temp.reject_drift('override rol desconocido permitido','alter table public.studio_role_module_overrides drop constraint studio_role_module_overrides_role_check');
select pg_temp.reject_drift('DELETE heredado','create role fixture_0456_delete nologin; grant delete on public.clients to fixture_0456_delete; grant fixture_0456_delete to authenticated');
\ir ../migrations/0456_clients_write_rbac.sql
\endif

-- Primera aserción GREEN: apply_fix=false debe terminar aquí en rojo.
select pg_temp.assert_true(not has_table_privilege('authenticated','public.clients','DELETE'),
  'GREEN authenticated carece de DELETE efectivo');
select pg_temp.assert_true(pg_temp.rows_snapshot()=(select rows from before_migration),'0456 no modifica filas');
select pg_temp.assert_true(current_setting('lock_timeout')=(select lock_timeout from before_migration)
  and current_setting('statement_timeout')=(select statement_timeout from before_migration),
  '0456 conserva los timeouts de sesión');
select pg_temp.assert_true(pg_temp.catalog_snapshot(false)=(select unchanged from before_migration),
  '0456 conserva funciones, triggers, constraints, otras policies y ACL ajenas');
select pg_temp.assert_true((select preserved_acl from before_migration)=(
  select jsonb_agg(to_jsonb(a) order by a.grantor,a.grantee,a.privilege_type)
  from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
  where c.oid='public.clients'::regclass),'Sólo desaparece ACL DELETE de authenticated');
select pg_temp.assert_true((select count(*)=4 from pg_policies where schemaname='public' and tablename='clients')
  and not exists(select from pg_policies where schemaname='public' and tablename='clients' and cmd in('ALL','DELETE'))
  and exists(select from pg_policies where schemaname='public' and tablename='clients' and policyname='clients by tenant' and cmd='SELECT')
  and exists(select from pg_policies where schemaname='public' and tablename='clients' and policyname='clients insert authorized' and cmd='INSERT')
  and exists(select from pg_policies where schemaname='public' and tablename='clients' and policyname='clients update authorized' and cmd='UPDATE'),
  'Inventario exacto SELECT Studio/Portal más INSERT/UPDATE gobernados');

create temporary table after_migration as select pg_temp.catalog_snapshot() as catalog,pg_temp.rows_snapshot() as rows;
\ir ../migrations/0456_clients_write_rbac.sql
select pg_temp.assert_true(pg_temp.catalog_snapshot()=(select catalog from after_migration)
  and pg_temp.rows_snapshot()=(select rows from after_migration),'Reaplicar 0456 es idempotente en catálogo y filas');
select pg_temp.reject_drift('policy final UPDATE abierta','alter policy "clients update authorized" on public.clients using(true) with check(true)');
select pg_temp.reject_drift('policy final INSERT abierta','alter policy "clients insert authorized" on public.clients with check(true)');

-- Forzar una alteración entre DDL y postflight demuestra que la huella y los
-- controles finales causan rollback completo aun si el preflight había pasado.
do $postflight_defense$
declare injection text; source text; changed text; snapshot jsonb; failed boolean; state text; message text;
begin
  source := pg_read_file('/sb/migrations/0456_clients_write_rbac.sql');
  foreach injection in array array[
    'alter function public.soft_delete_client_with_audit_reason(uuid,text) security definer;',
    'grant delete on public.clients to authenticated;',
    'create policy fixture_0456_reopened_all on public.clients for all to authenticated using(true) with check(true);'
  ] loop
    snapshot := pg_temp.catalog_snapshot();
    failed := false;
    changed := replace(source,'revoke delete on public.clients from authenticated;',
      'revoke delete on public.clients from authenticated; ' || injection);
    if changed=source then raise exception 'TEST 0456: no encontró el punto de inyección postflight'; end if;
    begin
      execute changed;
    exception when others then
      get stacked diagnostics state=returned_sqlstate,message=message_text;
      if state<>'P0001' or message not like '0456%' then
        raise exception 'TEST 0456: postflight falló por otra causa: % / %',state,message;
      end if;
      failed := true;
    end;
    perform pg_temp.assert_true(failed and pg_temp.catalog_snapshot()=snapshot,
      'Postflight rechaza y revierte: ' || injection);
  end loop;
end;
$postflight_defense$;

-- Matriz INSERT y UPDATE. Revisa el resultado persistido además de SQLSTATE.
create function pg_temp.check_write(label text, actor text, allowed boolean, tenant text default 'tenant-A')
returns void language plpgsql as $$
declare result jsonb; v_insert_id uuid := pg_temp.fixture_id('insert-' || label); prior_notes text;
  target_id uuid := pg_temp.fixture_id(case when tenant='tenant-A' then 'c-edit' else 'c-foreign' end);
begin
  select notes into prior_notes from public.clients where clients.id=target_id;
  result := pg_temp.write_as(actor,format('insert into public.clients (id,tenant_id,markbox,name) values (%L,%L,%L,%L)',
    v_insert_id,pg_temp.fixture_id(tenant),'insert-' || label,'Cliente sintético ' || label));
  perform pg_temp.assert_true(case when allowed then result->>'state'='00000' and result->>'rows'='1'
    else result->>'state'='42501' end,label || ' INSERT autorización');
  perform pg_temp.assert_true(exists(select from public.clients c where c.id=v_insert_id)=allowed,label || ' INSERT persistencia');
  result := pg_temp.write_as(actor,format('update public.clients set notes=%L where id=%L',label,target_id));
  perform pg_temp.assert_true(case when allowed then result->>'state'='00000' and result->>'rows'='1'
    else (result->>'state'='00000' and result->>'rows'='0') or result->>'state'='42501' end,label || ' UPDATE autorización');
  perform pg_temp.assert_true((select notes from public.clients where clients.id=target_id)
    is not distinct from case when allowed then label else prior_notes end,label || ' UPDATE persistencia');
end;
$$;
do $matrix$
declare role_name text; result jsonb;
begin
  foreach role_name in array array['admin','commercial','operations','accounting','warehouse','support','marketing'] loop
    perform pg_temp.check_write('default-' || role_name,role_name,role_name in ('admin','commercial','operations','accounting'));
    result := pg_temp.write_as(role_name,format('delete from public.clients where id=%L',pg_temp.fixture_id('delete-' || role_name)));
    perform pg_temp.assert_true(result->>'state'='42501'
      and exists(select from public.clients where id=pg_temp.fixture_id('delete-' || role_name)),'DELETE bloqueado para ' || role_name);
    perform pg_temp.assert_true((pg_temp.read_as(role_name,format('select to_jsonb(count(*)) from public.clients where id=%L',pg_temp.fixture_id('c-edit'))))::integer=1,
      'SELECT tenant-only preservado para ' || role_name);
  end loop;
end;
$matrix$;

insert into public.studio_role_module_overrides (tenant_id,role,module_id,can_view,can_edit)
select pg_temp.fixture_id('tenant-A'),role,'clients',true,true from unnest(array['warehouse','marketing','support']) role;
select pg_temp.check_write('override-enable-warehouse','warehouse',true);
select pg_temp.check_write('override-enable-marketing','marketing',true);
select pg_temp.check_write('override-support-readonly','support',false);
insert into public.studio_role_module_overrides (tenant_id,role,module_id,can_view,can_edit)
select pg_temp.fixture_id('tenant-A'),role,'clients',false,false from unnest(array['commercial','operations','accounting']) role;
select pg_temp.check_write('override-deny-commercial','commercial',false);
select pg_temp.check_write('override-deny-operations','operations',false);
select pg_temp.check_write('override-deny-accounting','accounting',false);
update public.studio_role_module_overrides set can_view=true,can_edit=false where role in('warehouse','marketing','commercial');
select pg_temp.check_write('override-view-warehouse','warehouse',false);
select pg_temp.check_write('override-view-marketing','marketing',false);
select pg_temp.check_write('override-view-commercial','commercial',false);
select pg_temp.check_write('override-admin-invariable','admin',true);
select pg_temp.assert_true(pg_temp.read_as('operations',format('select to_jsonb(count(*)) from public.clients where id=%L',pg_temp.fixture_id('c-edit')))='1'::jsonb,
  'Override negativo de escritura no altera SELECT Studio');
delete from public.studio_role_module_overrides;

select pg_temp.check_write('disabled','disabled',false);
select pg_temp.check_write('unknown-role','unknown',false);
select pg_temp.check_write('no-membership','unassigned',false);
select pg_temp.check_write('null-principal',null,false);
select pg_temp.check_write('foreign-tenant','foreign',false);
select pg_temp.check_write('multiple-memberships','multiple',false);
select pg_temp.check_write('insert-foreign-tenant','admin',false,'tenant-B');

-- NULL de rol/tenant no debe abrir autorización, aun simulando drift de datos.
savepoint null_role;
alter table public.user_tenants alter column role drop not null;
update public.user_tenants set role=null where user_id=pg_temp.fixture_id('unknown');
select pg_temp.check_write('null-role','unknown',false);
rollback to null_role;
release null_role;
select pg_temp.assert_true(pg_temp.read_as('admin',$q$select to_jsonb(public.document_entity_authorized('client',null,'edit'))$q$)='false'::jsonb,
  'Tenant NULL falla cerrado');
select pg_temp.assert_true((pg_temp.write_as('admin',format('update public.clients set tenant_id=%L where id=%L',pg_temp.fixture_id('tenant-B'),pg_temp.fixture_id('c-edit')))->>'state')='42501'
  and (select tenant_id=pg_temp.fixture_id('tenant-A') from public.clients where id=pg_temp.fixture_id('c-edit')),
  'WITH CHECK impide mover una fila hacia tenant ajeno');

-- Error al resolver overrides: la escritura aborta, nunca recupera defaults.
savepoint lookup_error;
alter table public.studio_role_module_overrides rename to fixture_0456_overrides_unavailable;
do $lookup_error$
declare result jsonb;
begin
  result := pg_temp.write_as('commercial',format('update public.clients set notes=''lookup-error'' where id=%L',pg_temp.fixture_id('c-edit')));
  perform pg_temp.assert_true(result->>'state'<>'00000' and result->>'rows'='0','Error de consulta falla cerrado');
end;
$lookup_error$;
rollback to lookup_error;
release lookup_error;

-- RPC INVOKER: negada para support aunque tenga EXECUTE; no cambia filas/eventos.
do $soft_denied$
declare snapshot jsonb := pg_temp.rows_snapshot(); result jsonb;
begin
  result := pg_temp.read_as('support',format('select to_jsonb(public.soft_delete_client_with_audit_reason(%L,''Intento sin permiso''))',pg_temp.fixture_id('c-soft')));
  perform pg_temp.assert_true(result='false'::jsonb and pg_temp.rows_snapshot()=snapshot,
    'RPC INVOKER niega support sin borrado, revocación ni auditoría');
end;
$soft_denied$;

-- Éxito de RPC: actor, motivo y consecuencia atomizan con la revocación Portal.
select pg_temp.assert_true(pg_temp.read_as('commercial',format('select to_jsonb(public.soft_delete_client_with_audit_reason(%L,''Baja sintética autorizada''))',pg_temp.fixture_id('c-soft')))='true'::jsonb,
  'RPC soft-delete funciona para rol autorizado');
select pg_temp.assert_true((select deleted_at is not null from public.clients where id=pg_temp.fixture_id('c-soft'))
  and exists(select from public.client_users where client_id=pg_temp.fixture_id('c-soft') and status='revoked'
    and revoked_at is not null and auth_user_id is null and token is null)
  and not exists(select from public.portal_access_links where client_id=pg_temp.fixture_id('c-soft') and revoked_at is null)
  and (select count(*)=1 from public.entity_audit_log where entity_id=pg_temp.fixture_id('c-soft') and event_type='client_deleted'
    and actor_id=pg_temp.fixture_id('commercial') and reason='Baja sintética autorizada'),
  'Soft-delete conserva client_deleted y revoca todos los accesos con motivo/actor');
select pg_temp.assert_true(pg_temp.read_as('commercial',format('select to_jsonb(public.soft_delete_client_with_audit_reason(%L,null))',pg_temp.fixture_id('c-soft')))='false'::jsonb,
  'Segundo soft-delete devuelve false');
select pg_temp.assert_true(pg_temp.read_as('admin',format('select to_jsonb(count(*)) from public.clients where id=%L',pg_temp.fixture_id('c-soft')))='1'::jsonb,
  'SELECT Studio conserva visibilidad tenant-only incluso para fila borrada');
select pg_temp.assert_true(pg_temp.read_as('portal',format('select to_jsonb(count(*)) from public.clients where id=%L',pg_temp.fixture_id('c-soft')))='0'::jsonb,
  'Portal pierde acceso a cliente borrado');

-- Si falla auditoría, vuelve TODO: cliente, sesión Portal, links y eventos.
create function pg_temp.reject_client_audit() returns trigger language plpgsql as $$
begin
  if new.entity_type='client' then raise exception 'fallo sintético de auditoría'; end if;
  return new;
end;
$$;
create trigger fixture_0456_broken_audit before insert on public.entity_audit_log
for each row execute function pg_temp.reject_client_audit();
do $atomic$
declare snapshot jsonb := pg_temp.rows_snapshot(); result jsonb;
begin
  result := pg_temp.write_as('operations',format('select public.soft_delete_client_with_audit_reason(%L,''Rollback sintético'')',pg_temp.fixture_id('c-fail')));
  perform pg_temp.assert_true(result->>'state'='P0001' and pg_temp.rows_snapshot()=snapshot,
    'Fallo de auditoría revierte soft-delete y revocación Portal');
  result := pg_temp.write_as('accounting',format('update public.clients set deleted_at=now() where id=%L',pg_temp.fixture_id('c-fail')));
  perform pg_temp.assert_true(result->>'state'='P0001' and pg_temp.rows_snapshot()=snapshot,
    'Fallo de auditoría revierte también UPDATE directo autorizado');
end;
$atomic$;
drop trigger fixture_0456_broken_audit on public.entity_audit_log;

-- merge_clients mantiene su SECURITY DEFINER y guard propios de 0361.
do $merge_guard$
declare snapshot jsonb := pg_temp.rows_snapshot(); result jsonb;
begin
  result := pg_temp.write_as('warehouse',format('select public.merge_clients(%L,%L)',pg_temp.fixture_id('c-survivor'),pg_temp.fixture_id('c-merge-denied')));
  perform pg_temp.assert_true(result->>'state'='42501' and pg_temp.rows_snapshot()=snapshot,
    'Guard propio de merge_clients rechaza warehouse sin efectos');
  result := pg_temp.write_as('admin',format('select public.merge_clients(%L,%L)',pg_temp.fixture_id('c-survivor'),pg_temp.fixture_id('c-merged')));
  perform pg_temp.assert_true(result->>'state'='00000','merge_clients legítimo sigue funcionando');
  perform pg_temp.assert_true((select deleted_at is not null and merged_into_client_id=pg_temp.fixture_id('c-survivor')
    from public.clients where id=pg_temp.fixture_id('c-merged'))
    and (select count(*)=1 from public.entity_audit_log where entity_id=pg_temp.fixture_id('c-merged') and event_type='client_merged')
    and not exists(select from public.entity_audit_log where entity_id=pg_temp.fixture_id('c-merged') and event_type='client_deleted')
    and not exists(select from public.client_users where client_id=pg_temp.fixture_id('c-merged'))
    and exists(select from public.client_users where client_id=pg_temp.fixture_id('c-survivor')
      and status='active' and revoked_at is null and auth_user_id=pg_temp.fixture_id('portal-merged'))
    and not exists(select from public.portal_access_links where client_id=pg_temp.fixture_id('c-merged') and revoked_at is null),
    'Merge conserva client_merged, traslada binding al superviviente y revoca links de la absorbida');
  perform pg_temp.assert_true(pg_temp.read_as('portal-merged',format('select to_jsonb(count(*)) from public.clients where id=%L',pg_temp.fixture_id('c-survivor')))='1'::jsonb
    and pg_temp.read_as('portal-merged',format('select to_jsonb(count(*)) from public.clients where id=%L',pg_temp.fixture_id('c-merged')))='0'::jsonb,
    'Portal conserva acceso al superviviente y pierde lectura de la ficha absorbida');
end;
$merge_guard$;

select pg_temp.assert_true(not (select prosecdef from pg_proc where oid='public.soft_delete_client_with_audit_reason(uuid,text)'::regprocedure)
  and has_function_privilege('authenticated','public.soft_delete_client_with_audit_reason(uuid,text)','EXECUTE')
  and not has_function_privilege('anon','public.soft_delete_client_with_audit_reason(uuid,text)','EXECUTE')
  and not has_function_privilege('service_role','public.soft_delete_client_with_audit_reason(uuid,text)','EXECUTE'),
  'RPC mantiene SECURITY INVOKER y ACL authenticated exclusiva');
select pg_temp.assert_true((pg_temp.write_as('admin',format('select public.soft_delete_client_with_audit_reason(%L,null)',pg_temp.fixture_id('c-fail')),'service_role')->>'state')='42501',
  'No se crea bypass nuevo por service_role');
select count(*) as assertions_passed_0456 from assertions;
rollback;
select to_regclass('public.clients') is null and to_regnamespace('auth') is null as clients_write_rbac_0456_fixture_rolled_back;
