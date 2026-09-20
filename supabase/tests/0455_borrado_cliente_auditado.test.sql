\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0455 (SDD-0469): borrar un cliente deja un
-- evento de auditoría atómico y la RPC del Studio detecta cuando no borró nada.
-- Fixtures ficticios y rollback: nunca consulta ni modifica una base alojada.
-- Aplica las migraciones REALES 0006, 0080, 0081, 0230, 0360, 0361, la
-- plataforma de auditoría 0258/0261/0267/0294, la función D5 de 0293 extraída
-- del archivo (con sus triggers de client_users y de contacto de clients) y la
-- 0454 real, con los helpers vigentes de 0453, 0200, 0012 y 0351.
--
-- RED: psql -v apply_fix=false. GREEN (predeterminado): aplica la 0455 real.
--
-- Lo que defiende:
--   1. RED, sin 0455: el borrado del Studio no deja ningún evento sobre el
--      cliente y no existe la RPC que detecta cero filas.
--   2. Estático: timeouts antes del preflight; preflight → funciones → trigger
--      → postflight → reset; una función SECURITY DEFINER (trigger) y una
--      SECURITY INVOKER (RPC), las dos con search_path vacío; un solo GRANT
--      (EXECUTE de la RPC a authenticated); sin backfill, tablas ni ALTER.
--   3. Drift: merge_clients que retira con dos UPDATE, ausente o sin SECURITY
--      DEFINER; columna o RLS ausentes; tipo client inactivo; writer sin
--      SECURITY DEFINER o no ejecutable por quien aplica; trigger de 0454 ausente
--      o deshabilitado; objetos ajenos con los nombres de la migración: P0001 en
--      el preflight, sin ids ni Shipping Marks, y catálogo intacto. El
--      postflight rechaza huella distinta, trigger con otra condición, RPC
--      SECURITY DEFINER o ejecutable por anon, trigger ejecutable por la API y
--      un dueño del trigger que no escribe el evento.
--   4. Aplicada: timeouts restaurados, catálogo dependiente intacto, forma final
--      y ACL; reaplicar no cambia nada.
--   5. Comportamiento: UPDATE directo del código desplegado auditado; RPC con
--      motivo humano, sin motivo y con motivo en blanco; cero filas (ya borrado,
--      inexistente, otro tenant) sin evento; motivo inválido, id nulo, anon y
--      service_role rechazados; fusión como client_merged y nunca como
--      client_deleted; fallo atómico del evento (borrado y revocación del
--      Portal revertidos); restaurar y volver a borrar; sin PII en el evento.

\if :{?apply_fix}
\else
\set apply_fix true
\endif

begin;

do $guard$
begin
  if to_regclass('public.clients') is not null or to_regnamespace('auth') is not null then
    raise exception 'TEST 0455 requiere una base desechable vacía';
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

-- ─── Utilidades ─────────────────────────────────────────────────────────────
create function pg_temp.fixture_id(label text) returns uuid language sql immutable as $$
  select md5('0455-synthetic-' || label)::uuid
$$;
create temporary table assertions (label text primary key);
grant insert, select on assertions to authenticated, service_role, anon;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'TEST 0455: %', label; end if;
  insert into pg_temp.assertions values (label);
end;
$$;
create function pg_temp.as_principal(label text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', case when label = '' then '' else pg_temp.fixture_id(label)::text end, true)
$$;
grant execute on function pg_temp.fixture_id(text), pg_temp.assert_true(boolean, text), pg_temp.as_principal(text)
  to authenticated, service_role, anon;
-- VOLATILE a propósito: una función STABLE reusa la instantánea de la sentencia
-- que la llama y no vería lo que acaba de escribir un helper volátil.
create function pg_temp.binding(p_client text) returns public.client_users language sql volatile as $$
  select * from public.client_users where client_id = pg_temp.fixture_id(p_client)
$$;
create function pg_temp.open_links(p_client text) returns bigint language sql volatile as $$
  select count(*) from public.portal_access_links where client_id = pg_temp.fixture_id(p_client) and revoked_at is null
$$;
create function pg_temp.alive(p_client text) returns boolean language sql volatile as $$
  select deleted_at is null from public.clients where id = pg_temp.fixture_id(p_client)
$$;
create function pg_temp.client_events(p_client text, p_event text) returns bigint language sql volatile as $$
  select count(*) from public.entity_audit_log
   where entity_type = 'client' and entity_id = pg_temp.fixture_id(p_client) and event_type = p_event
$$;
create function pg_temp.client_event(p_client text, p_event text) returns public.entity_audit_log language sql volatile as $$
  select * from public.entity_audit_log
   where entity_type = 'client' and entity_id = pg_temp.fixture_id(p_client) and event_type = p_event
   order by occurred_at desc limit 1
$$;
create function pg_temp.portal_event(p_client text) returns public.entity_audit_log language sql volatile as $$
  select * from public.entity_audit_log
   where entity_type = 'portal_invitation' and entity_id = pg_temp.fixture_id(p_client)
     and event_type = 'portal_access_status_changed'
   order by occurred_at desc limit 1
$$;
create function pg_temp.audit_rows() returns bigint language sql volatile as $$
  select count(*) from public.entity_audit_log
$$;
-- Borrado del código desplegado hoy: UPDATE directo por RLS con la sesión del
-- operador, como softDeleteClientAction de main (sin RETURNING).
create function pg_temp.studio_soft_delete(p_actor text, p_markbox text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.as_principal(p_actor);
  execute 'set local role authenticated';
  update public.clients set deleted_at = now() where markbox = p_markbox;
  get diagnostics n = row_count;
  execute 'reset role';
  return n;
end;
$$;
-- La RPC nueva, con la sesión del operador.
create function pg_temp.rpc_delete(p_actor text, p_client_id uuid, p_reason text) returns boolean language plpgsql as $$
declare v boolean;
begin
  perform pg_temp.as_principal(p_actor);
  execute 'set local role authenticated';
  v := public.soft_delete_client_with_audit_reason(p_client_id, p_reason);
  execute 'reset role';
  return v;
end;
$$;
-- SQLSTATE con el que falla la RPC para un rol y un principal; NULL si no falla.
create function pg_temp.rpc_state(p_role text, p_actor text, p_client_id uuid, p_reason text) returns text language plpgsql as $$
declare v_state text;
begin
  perform pg_temp.as_principal(p_actor);
  execute format('set local role %I', p_role);
  begin
    perform public.soft_delete_client_with_audit_reason(p_client_id, p_reason);
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
  end;
  execute 'reset role';
  return v_state;
end;
$$;
create function pg_temp.merge_as(p_actor text, p_survivor text, p_merged text) returns jsonb language plpgsql as $$
declare v_res jsonb;
begin
  perform pg_temp.as_principal(p_actor);
  execute 'set local role authenticated';
  v_res := public.merge_clients(pg_temp.fixture_id(p_survivor), pg_temp.fixture_id(p_merged));
  execute 'reset role';
  return v_res;
end;
$$;

-- ─── Fixture sintético ──────────────────────────────────────────────────────
insert into public.tenants (id, slug, display_name) values
  (pg_temp.fixture_id('tenant-A'), 'synthetic-A', 'Tenant A'), (pg_temp.fixture_id('tenant-B'), 'synthetic-B', 'Tenant B');
insert into auth.users (id, email)
select pg_temp.fixture_id(v), v || '@example.invalid' from unnest(array[
  'team-A', 'team-A-ops', 'team-B', 'p-reason', 'p-fail', 'p-dup', 'p-B'
]) v;
insert into public.user_tenants (user_id, tenant_id, role)
select pg_temp.fixture_id(actor), pg_temp.fixture_id(tenant), role
from (values ('team-A', 'tenant-A', 'admin'), ('team-A-ops', 'tenant-A', 'operations'), ('team-B', 'tenant-B', 'admin'))
  v(actor, tenant, role);
insert into public.clients (id, tenant_id, markbox, name, email, phone)
select pg_temp.fixture_id(label), pg_temp.fixture_id(tenant), markbox, name, email, phone
from (values
  ('c-reason', 'tenant-A', 'REASON', 'Inversiones Ñandú Sintética, C.A.', 'p-reason@example.invalid', '+584120007777'),
  ('c-B', 'tenant-B', 'REASON', 'Cliente Sintético de B', 'p-B@example.invalid', null), -- mismo Shipping Mark, otro tenant
  ('c-noreason', 'tenant-A', 'NOREASON', 'Cliente Sin Motivo', 'invitado@example.invalid', null),
  ('c-blank', 'tenant-A', 'BLANK', 'Cliente Motivo En Blanco', null, null),
  ('c-direct', 'tenant-A', 'DIRECT', 'Cliente Borrado Directo', null, null),
  ('c-short', 'tenant-A', 'SHORT', 'Cliente Motivo Corto', null, null),
  ('c-long', 'tenant-A', 'LONG', 'Cliente Motivo Largo', null, null),
  ('c-fail', 'tenant-A', 'FAIL', 'Cliente Auditoría Rota', 'p-fail@example.invalid', null),
  ('c-surv', 'tenant-A', 'SURV', 'Cliente Superviviente', null, null),
  ('c-dup', 'tenant-A', 'DUP', 'Cliente Duplicado', 'p-dup@example.invalid', null),
  ('c-restore', 'tenant-A', 'RESTORE', 'Cliente Restaurado', null, null)
) v(label, tenant, markbox, name, email, phone);
insert into public.client_users (tenant_id, client_id, email, auth_user_id, token, status, bound_at)
select pg_temp.fixture_id(tenant), pg_temp.fixture_id(client), email,
  case when actor is null then null else pg_temp.fixture_id(actor) end, token, status,
  case when status = 'active' then now() end
from (values
  ('tenant-A', 'c-reason', 'p-reason@example.invalid', 'p-reason', null, 'active'),
  ('tenant-B', 'c-B', 'p-B@example.invalid', 'p-B', null, 'active'),
  ('tenant-A', 'c-noreason', 'invitado@example.invalid', null, 'tok-noreason', 'invited'),
  ('tenant-A', 'c-fail', 'p-fail@example.invalid', 'p-fail', null, 'active'),
  ('tenant-A', 'c-dup', 'p-dup@example.invalid', 'p-dup', null, 'active')
) v(tenant, client, email, actor, token, status);
insert into public.portal_access_links (tenant_id, client_id, code, expires_at)
select pg_temp.fixture_id(tenant), pg_temp.fixture_id(client), code, now() + interval '72 hours'
from (values
  ('tenant-A', 'c-reason', 'LINKREASON01'),
  ('tenant-B', 'c-B', 'LINKBBBBBB01'),
  ('tenant-A', 'c-fail', 'LINKFAIL0001')
) v(tenant, client, code);

do $fixture_check$
begin
  if (select count(*) from public.entity_audit_log where event_type = 'portal_access_invited') <> 5
     or (select count(*) from public.entity_audit_log where entity_type = 'client') <> 0
     or (select count(*) from public.clients where deleted_at is null) <> 11
     or not exists (select from pg_trigger where tgname = 'clients_revoke_portal_on_soft_delete') then
    raise exception 'TEST 0455: el fixture no quedó armado';
  end if;
end;
$fixture_check$;

-- ─── Catálogo y filas antes de la migración ─────────────────────────────────
create function pg_temp.catalog_snapshot() returns jsonb language sql stable as $catalog$
select jsonb_build_object(
  'functions', (select jsonb_agg(jsonb_build_array(p.oid, p.proname, p.proowner, p.proacl, p.prosecdef, p.proconfig, md5(p.prosrc)) order by p.oid)
    from pg_proc p where p.pronamespace = 'public'::regnamespace),
  'policies', (select jsonb_agg(to_jsonb(p) order by schemaname, tablename, policyname) from pg_policies p),
  'triggers', (select jsonb_agg(jsonb_build_array(t.oid, t.tgrelid::regclass::text, t.tgname, t.tgfoid, t.tgtype, t.tgenabled, pg_get_triggerdef(t.oid)) order by t.tgrelid, t.tgname)
    from pg_trigger t where not t.tgisinternal),
  'tables', (select jsonb_agg(jsonb_build_array(c.oid, c.relname, c.relacl, c.relrowsecurity, c.relforcerowsecurity) order by c.oid)
    from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r')
);
$catalog$;
-- Aparte del catálogo: el drift del rol sin privilegios no puede leer esta tabla.
create function pg_temp.entity_types_snapshot() returns jsonb language sql stable as $types$
  select jsonb_agg(to_jsonb(e) order by entity_type) from public.audit_entity_types e
$types$;
create temporary table entity_types_before as select pg_temp.entity_types_snapshot() as types;
create function pg_temp.rows_snapshot() returns jsonb language sql stable as $rows$
select jsonb_build_object(
  'clients', (select jsonb_agg(to_jsonb(c) order by id) from public.clients c),
  'bindings', (select jsonb_agg(to_jsonb(c) order by id) from public.client_users c),
  'links', (select jsonb_agg(to_jsonb(l) order by id) from public.portal_access_links l),
  'audit', (select coalesce(jsonb_agg(to_jsonb(a) order by id), '[]'::jsonb) from public.entity_audit_log a)
);
$rows$;
create temporary table before_migration as
  select pg_temp.catalog_snapshot() as catalog, pg_temp.rows_snapshot() as rows;

-- ─── 1 · RED: lo que hoy hace main ──────────────────────────────────────────
savepoint red_probe;
do $red$
begin
  if pg_temp.studio_soft_delete('team-A', 'DIRECT') <> 1 then
    raise exception 'TEST 0455 baseline: el borrado del Studio por RLS no borró exactamente un cliente';
  end if;
  if pg_temp.client_events('c-direct', 'client_deleted') <> 0
     or (select count(*) from public.entity_audit_log where entity_type = 'client') <> 0 then
    raise exception 'TEST 0455 baseline no reproduce el borrado sin evento de auditoría';
  end if;
  if to_regprocedure('public.soft_delete_client_with_audit_reason(uuid,text)') is not null then
    raise exception 'TEST 0455 baseline: la RPC ya existe antes de la migración';
  end if;
  raise notice 'TEST 0455 RED baseline: el borrado del Studio no dejó ningún evento sobre el cliente y no existe la RPC que detecta cero filas';
end;
$red$;
rollback to red_probe;
release red_probe;
select pg_temp.assert_true((select rows from before_migration) = pg_temp.rows_snapshot(),
  'La sonda RED no dejó filas');

\if :apply_fix
-- ─── 3 · Drift: el preflight falla cerrado y no toca nada ───────────────────
create function public.fixture_0455_noop() returns trigger language plpgsql as $$ begin return null; end $$;
do $drift$
declare drift text; failed boolean; message text; state text; after_drift jsonb; n int := 0;
  migration text := pg_read_file('/sb/migrations/0455_borrado_cliente_auditado.sql');
begin
  foreach drift in array array[
    -- merge_clients que retira la ficha con dos UPDATE: el trigger vería un borrado.
    $d$create or replace function public.merge_clients(p_survivor_id uuid, p_merged_id uuid) returns jsonb language plpgsql security definer set search_path = public as $f$
declare s public.clients; m public.clients;
begin
  update public.client_users set client_id = s.id where client_id = m.id;
  update public.clients set deleted_at = now() where id = m.id;
  update public.clients set merged_into_client_id = s.id, deleted_at = now() where id = m.id;
  return null;
end $f$$d$,
    'drop function public.merge_clients(uuid, uuid)',
    'alter function public.merge_clients(uuid, uuid) security invoker',
    'alter table public.clients rename column merged_into_client_id to fixture_0455_merged',
    'alter table public.clients disable row level security',
    $d$update public.audit_entity_types set status = 'deprecated', deprecated_at = now() where entity_type = 'client'$d$,
    'alter function public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text) security invoker',
    'drop trigger clients_revoke_portal_on_soft_delete on public.clients',
    'alter table public.clients disable trigger clients_revoke_portal_on_soft_delete',
    'create trigger clients_audit_soft_delete after update on public.clients for each row execute function public.fixture_0455_noop()',
    $d$create function public.soft_delete_client_with_audit_reason(p_client_id uuid, p_reason text default null) returns boolean language sql security definer set search_path = '' as $f$ select true $f$$d$,
    $d$create function public.soft_delete_client_with_audit_reason(p_markbox text) returns boolean language sql set search_path = '' as $f$ select false $f$$d$,
    -- Aplicada por un rol que no puede ejecutar el writer: el trigger quedaría con
    -- un dueño que no escribe el evento y cada borrado fallaría.
    'create role fixture_0455_applier nologin; set role fixture_0455_applier'
  ] loop
    failed := false;
    begin
      execute drift;
      after_drift := pg_temp.catalog_snapshot();
      begin execute migration;
      exception when others then
        get stacked diagnostics message = message_text, state = returned_sqlstate;
        if state <> 'P0001' or (message not like '0455 requiere%' and message not like '0455 abortada%') then
          raise exception 'TEST 0455: drift no falló en preflight: % / % (%)', state, message, left(drift, 80);
        end if;
        if (drift like '%merged_into_client_id = s.id, deleted_at%'
              and message not like '0455 abortada: merge_clients no retira la ficha con un solo UPDATE%')
           or (drift like '%deprecated%' and message not like '0455 abortada: el tipo de entidad client no está activo%')
           or (drift like '%fixture_0455_applier%'
              and message not like '0455 abortada: el rol que aplica no puede ejecutar append_audit_event%')
           or (drift like '%clients_revoke_portal_on_soft_delete%'
              and message not like '0455 requiere el trigger clients_revoke_portal_on_soft_delete de 0454%')
           or (drift like '%fixture_0455_noop%'
              and message not like '0455 abortada: ya existe un trigger con el nombre de esta migración y otra forma%')
           or (drift like '%soft_delete_client_with_audit_reason%'
              and message not like '0455 abortada: ya existe una función con el nombre de esta migración y otra forma o firma%') then
          raise exception 'TEST 0455: el drift abortó sin su mensaje claro: % (%)', message, left(drift, 80);
        end if;
        if message ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
           or message ~ 'REASON|BLANK|DIRECT|SHORT|LONG|FAIL|SURV|DUP|RESTORE' then
          raise exception 'TEST 0455: el mensaje del preflight expone ids o Shipping Marks: %', message;
        end if;
        failed := true;
      end;
      if not failed or after_drift <> pg_temp.catalog_snapshot() then
        raise exception 'TEST 0455: preflight aceptó drift o alteró catálogo: %', left(drift, 80);
      end if;
      raise exception using errcode = 'PT455', message = 'rollback drift sintético';
    exception when sqlstate 'PT455' then null;
    end;
    n := n + 1;
    perform pg_temp.assert_true(true, 'Drift #' || n || ' rechazado en el preflight sin tocar el catálogo: ' || left(drift, 60));
  end loop;
end;
$drift$;
drop function public.fixture_0455_noop();
select pg_temp.assert_true((select catalog from before_migration) = pg_temp.catalog_snapshot()
  and (select rows from before_migration) = pg_temp.rows_snapshot(),
  'Los drift se revierten enteros');

-- Las formas de merge_clients de 0341 y 0358 también retiran con un solo UPDATE:
-- el preflight las acepta (en producción corre la de 0361).
do $merge_forms$
declare v_file text; v_stmt text;
begin
  foreach v_file in array array['0341_client_merge_duplicados.sql', '0358_merge_clients_exige_rol.sql'] loop
    v_stmt := (regexp_match(pg_read_file('/sb/migrations/' || v_file),
      'create or replace function public\.merge_clients\(p_survivor_id uuid, p_merged_id uuid\).*?\n\$\$;'))[1];
    if v_stmt is null then raise exception 'TEST 0455: no se pudo extraer merge_clients de %', v_file; end if;
    begin
      execute v_stmt;
      execute (regexp_match(pg_read_file('/sb/migrations/0455_borrado_cliente_auditado.sql'),
        'do \$preflight\$.*?\n\$preflight\$;'))[1];
      raise exception using errcode = 'PT455', message = 'rollback forma histórica';
    exception when sqlstate 'PT455' then null;
    end;
    perform pg_temp.assert_true(true, 'El preflight acepta merge_clients de ' || v_file);
  end loop;
end;
$merge_forms$;

-- ─── 4 · Aplicada ───────────────────────────────────────────────────────────
\ir ../migrations/0455_borrado_cliente_auditado.sql
select pg_temp.assert_true(current_setting('lock_timeout') = '0' and current_setting('statement_timeout') = '0',
  'La migración restaura lock_timeout y statement_timeout de sesión');
select pg_temp.assert_true(coalesce(current_setting('dtd.huella_0455', true), '') = ''
  and coalesce(current_setting('dtd.audit_reason', true), '') = '',
  'La migración no deja la huella ni el motivo de auditoría en la sesión');
select pg_temp.assert_true((select rows from before_migration) = pg_temp.rows_snapshot(),
  'Aplicar no toca filas ni escribe eventos: sin backfill');
create temporary table after_first as select pg_temp.catalog_snapshot() as catalog, pg_temp.rows_snapshot() as rows;
\ir ../migrations/0455_borrado_cliente_auditado.sql
select pg_temp.assert_true((select catalog from after_first) = pg_temp.catalog_snapshot(),
  'Reaplicar deja el catálogo idéntico: mismos oid de funciones y trigger');
select pg_temp.assert_true((select rows from after_first) = pg_temp.rows_snapshot(),
  'Reaplicar no toca filas ni escribe eventos');

select pg_temp.assert_true(
  (select jsonb_agg(x order by x) from (
     select value as x from jsonb_array_elements((select catalog from before_migration)->'policies')
   ) s) = (select jsonb_agg(x order by x) from (select value as x from jsonb_array_elements(pg_temp.catalog_snapshot()->'policies')) s)
  and (select catalog->'tables' from before_migration) = pg_temp.catalog_snapshot()->'tables'
  and (select types from entity_types_before) = pg_temp.entity_types_snapshot(),
  'Policies, RLS, ACL de tablas y catálogo de tipos de entidad idénticos a antes de la migración');
select pg_temp.assert_true(
  (select jsonb_agg(value order by value) from jsonb_array_elements((select catalog from before_migration)->'functions'))
  = (select jsonb_agg(value order by value) from jsonb_array_elements(pg_temp.catalog_snapshot()->'functions')
      where value->>1 not in ('clients_audit_soft_delete', 'soft_delete_client_with_audit_reason')),
  'Ninguna función existente cambia: sólo se agregan las dos de la migración');
select pg_temp.assert_true(
  (select jsonb_agg(value order by value) from jsonb_array_elements((select catalog from before_migration)->'triggers'))
  = (select jsonb_agg(value order by value) from jsonb_array_elements(pg_temp.catalog_snapshot()->'triggers')
      where value->>2 <> 'clients_audit_soft_delete'),
  'Ningún trigger existente cambia: sólo se agrega el de la migración');
select pg_temp.assert_true(
  exists (select from pg_proc p where p.oid = 'public.clients_audit_soft_delete()'::regprocedure
    and p.prosecdef and p.provolatile = 'v' and p.proconfig = array['search_path=""']::text[]
    and not has_function_privilege('anon', p.oid, 'EXECUTE')
    and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
    and not has_function_privilege('service_role', p.oid, 'EXECUTE')),
  'El trigger: SECURITY DEFINER, volátil, search_path vacío y sin EXECUTE para anon, authenticated ni service_role');
select pg_temp.assert_true(
  exists (select from pg_proc p where p.oid = 'public.soft_delete_client_with_audit_reason(uuid,text)'::regprocedure
    and not p.prosecdef and p.provolatile = 'v' and p.proconfig = array['search_path=""']::text[]
    and p.prorettype = 'boolean'::regtype
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    and not has_function_privilege('anon', p.oid, 'EXECUTE')
    and not has_function_privilege('service_role', p.oid, 'EXECUTE')
    and not exists (select from aclexplode(p.proacl) a where a.grantee = 0)),
  'La RPC: SECURITY INVOKER, search_path vacío, boolean y EXECUTE sólo para authenticated (sin PUBLIC)');
select pg_temp.assert_true(
  regexp_replace(pg_get_triggerdef((select oid from pg_trigger where tgname = 'clients_audit_soft_delete')), '\s+', ' ', 'g')
    = 'CREATE TRIGGER clients_audit_soft_delete AFTER UPDATE ON public.clients FOR EACH ROW WHEN (((old.deleted_at IS NULL) AND (new.deleted_at IS NOT NULL))) EXECUTE FUNCTION clients_audit_soft_delete()',
  'El trigger queda AFTER UPDATE con la transición de deleted_at de NULL a un valor');

-- ─── 3c · Drift de reaplicación: objetos propios con otra forma ─────────────
do $own_drift$
declare drift text; failed boolean; message text; state text; after_drift jsonb;
  migration text := pg_read_file('/sb/migrations/0455_borrado_cliente_auditado.sql');
begin
  foreach drift in array array[
    'drop trigger clients_audit_soft_delete on public.clients; create trigger clients_audit_soft_delete after update on public.clients for each row when (new.deleted_at is not null) execute function public.clients_audit_soft_delete()',
    'alter table public.clients disable trigger clients_audit_soft_delete',
    'alter function public.soft_delete_client_with_audit_reason(uuid, text) security definer',
    'alter function public.clients_audit_soft_delete() security invoker'
  ] loop
    failed := false;
    begin
      execute drift;
      after_drift := pg_temp.catalog_snapshot();
      begin execute migration;
      exception when others then
        get stacked diagnostics message = message_text, state = returned_sqlstate;
        if state <> 'P0001' or message not like '0455 abortada: ya existe un% con el nombre de esta migración y otra forma%' then
          raise exception 'TEST 0455: drift propio no falló en preflight: % / % (%)', state, message, left(drift, 90);
        end if;
        failed := true;
      end;
      if not failed or after_drift <> pg_temp.catalog_snapshot() then
        raise exception 'TEST 0455: preflight aceptó un objeto propio con otra forma o alteró catálogo: %', left(drift, 90);
      end if;
      raise exception using errcode = 'PT455', message = 'rollback drift propio';
    exception when sqlstate 'PT455' then null;
    end;
    perform pg_temp.assert_true(true, 'Reaplicar sobre un objeto propio con otra forma aborta en el preflight: ' || left(drift, 70));
  end loop;
end;
$own_drift$;
select pg_temp.assert_true((select catalog from after_first) = pg_temp.catalog_snapshot()
  and (select rows from after_first) = pg_temp.rows_snapshot(),
  'Los drift de reaplicación se revierten enteros');

-- ─── 2 · Estático ───────────────────────────────────────────────────────────
do $static$
declare
  f text := pg_read_file('/sb/migrations/0455_borrado_cliente_auditado.sql');
  p_lock int := position('set lock_timeout = ''5s'';' in f);
  p_stmt int := position('set statement_timeout = ''30s'';' in f);
  p_pre int := position('do $preflight$' in f);
  p_fn_trg int := position(E'\ncreate or replace function public.clients_audit_soft_delete()' in f);
  p_fn_rpc int := position(E'\ncreate or replace function public.soft_delete_client_with_audit_reason(' in f);
  p_trg int := position('do $triggers$' in f);
  p_post int := position('do $postflight$' in f);
  p_reset_stmt int := position(E'\nreset statement_timeout;' in f);
  p_reset_lock int := position(E'\nreset lock_timeout;' in f);
  v_rpc text;
begin
  perform pg_temp.assert_true(p_lock > 0 and p_stmt > 0 and p_lock < p_pre and p_stmt < p_pre,
    'Timeouts de sesión al inicio, antes del preflight');
  perform pg_temp.assert_true(p_pre > 0 and p_fn_trg > p_pre and p_fn_rpc > p_fn_trg and p_trg > p_fn_rpc
    and p_post > p_trg and p_reset_stmt > p_post and p_reset_lock > p_reset_stmt,
    'Orden: preflight → trigger function → RPC → trigger → postflight → reset de timeouts');
  perform pg_temp.assert_true(
    (select count(*) from regexp_matches(f, '\ncreate or replace function public\.', 'g')) = 2
    and (select count(*) from regexp_matches(f, '\ncomment on function public\.', 'g')) = 2
    and (select count(*) from regexp_matches(f, '\nsecurity definer\nset search_path = ''''\n', 'g')) = 1
    and (select count(*) from regexp_matches(f, '\nsecurity invoker\nset search_path = ''''\n', 'g')) = 1
    and (select count(*) from regexp_matches(f, '\nrevoke all on function public\.[a-z_]+\([a-z, ]*\) from public, anon, authenticated, service_role;', 'g')) = 2,
    'Dos funciones comentadas con search_path vacío (una DEFINER, una INVOKER) y revoke de los cuatro roles');
  perform pg_temp.assert_true(
    (select count(*) from regexp_matches(f, '\n\s*grant ', 'gi')) = 1
    and strpos(f, E'\ngrant execute on function public.soft_delete_client_with_audit_reason(uuid, text) to authenticated;\n') > 0,
    'Un solo GRANT: EXECUTE de la RPC a authenticated');
  perform pg_temp.assert_true(f !~* '\n\s*(insert|delete|merge|truncate|copy|alter|drop|lock|create (policy|table|index|or replace trigger))\s',
    'Sin INSERT, DELETE, policies, tablas, índices, locks, ALTER ni DROP');
  perform pg_temp.assert_true(
    (select count(*) from regexp_matches(f, '\n\s*create trigger ', 'g')) = 1
    and strpos(f, 'do $backfill$') = 0,
    'Exactamente un trigger creado y sin backfill');
  perform pg_temp.assert_true(f like E'%\ndo $preflight$%\nend;\n$preflight$;\n%'
    and f like E'%\ndo $triggers$%\nend;\n$triggers$;\n%'
    and f like E'%\ndo $postflight$%\nend;\n$postflight$;\n%',
    'Preflight, trigger y postflight son bloques do cerrados');
  -- La RPC fija el motivo antes del UPDATE, borra sólo un cliente vivo por id y
  -- restaura el motivo previo después: sobre el prosrc aplicado, sin comentarios
  -- ni espacios.
  select regexp_replace(regexp_replace(p.prosrc, '--[^\n]*', '', 'g'), '\s', '', 'g') into v_rpc
    from pg_proc p where p.oid = 'public.soft_delete_client_with_audit_reason(uuid,text)'::regprocedure;
  perform pg_temp.assert_true(
    strpos(v_rpc, 'performpg_catalog.set_config(''dtd.audit_reason'',coalesce(v_reason,''''),true);updatepublic.clientssetdeleted_at=pg_catalog.now()whereid=p_client_idanddeleted_atisnull;v_found:=found;performpg_catalog.set_config(''dtd.audit_reason'',coalesce(v_reason_prev,''''),true);returnv_found;') > 0,
    'La RPC fija el motivo, borra por id sólo si vive, devuelve found y restaura el motivo previo');
end;
$static$;

-- El postflight falla cerrado ante cada forma incorrecta.
do $postflight_probe$
declare message text; probe text;
  v_post text := (regexp_match(pg_read_file('/sb/migrations/0455_borrado_cliente_auditado.sql'),
    'do \$postflight\$.*?\n\$postflight\$;'))[1];
  v_pre text := (regexp_match(pg_read_file('/sb/migrations/0455_borrado_cliente_auditado.sql'),
    'do \$preflight\$.*?\n\$preflight\$;'))[1];
  v_probes text[][] := array[
    array['select set_config(''dtd.huella_0455'', ''huella-sintetica'', false)',
          '0455: cambió el catálogo dependiente%'],
    array['drop trigger clients_audit_soft_delete on public.clients; create trigger clients_audit_soft_delete after update on public.clients for each row when (new.deleted_at is not null) execute function public.clients_audit_soft_delete()',
          '0455: el trigger clients_audit_soft_delete no quedó vivo con su forma%'],
    array['grant execute on function public.soft_delete_client_with_audit_reason(uuid, text) to anon',
          '0455: ACL de soft_delete_client_with_audit_reason inválida%'],
    array['alter function public.soft_delete_client_with_audit_reason(uuid, text) security definer',
          '0455: soft_delete_client_with_audit_reason no quedó con la forma final%'],
    array['grant execute on function public.clients_audit_soft_delete() to authenticated',
          '0455: clients_audit_soft_delete() quedó ejecutable por un rol distinto de su dueño%'],
    array['create role fixture_0455_owner nologin; grant create on schema public to fixture_0455_owner; alter function public.clients_audit_soft_delete() owner to fixture_0455_owner',
          '0455: el dueño de clients_audit_soft_delete() no puede ejecutar append_audit_event%'],
    array['update public.audit_entity_types set status = ''deprecated'', deprecated_at = now() where entity_type = ''client''',
          '0455: cambió el catálogo dependiente%']
  ];
  i int;
begin
  for i in 1 .. array_length(v_probes, 1) loop
    probe := v_probes[i][1];
    begin
      execute v_pre;
      execute probe;
      execute v_post;
      raise exception 'TEST 0455: el postflight aceptó: %', left(probe, 90);
    exception when sqlstate 'P0001' then
      get stacked diagnostics message = message_text;
      if message not like v_probes[i][2] then raise; end if;
    end;
    perform pg_temp.assert_true(true, 'El postflight rechaza: ' || left(probe, 70));
  end loop;
end;
$postflight_probe$;
select pg_temp.assert_true((select rows from after_first) = pg_temp.rows_snapshot()
  and (select catalog from after_first) = pg_temp.catalog_snapshot()
  and coalesce(current_setting('dtd.huella_0455', true), '') = '',
  'Las sondas del postflight se revierten enteras');
\endif

-- ─── 5 · Comportamiento ─────────────────────────────────────────────────────
-- El código desplegado hoy (UPDATE directo por RLS) también queda auditado.
select pg_temp.assert_true(pg_temp.studio_soft_delete('team-A', 'DIRECT') = 1
  and pg_temp.client_events('c-direct', 'client_deleted') = 1,
  'El UPDATE directo del código desplegado deja exactamente un evento client_deleted');
select pg_temp.assert_true(
  (pg_temp.client_event('c-direct', 'client_deleted')).actor_type = 'user'
  and (pg_temp.client_event('c-direct', 'client_deleted')).actor_id = pg_temp.fixture_id('team-A')
  and (pg_temp.client_event('c-direct', 'client_deleted')).reason = 'Cliente eliminado sin motivo indicado (SDD-0469).',
  'Sin motivo humano el evento lleva al operador y el motivo por defecto explícito');

-- RPC con motivo humano: evento completo en la misma transacción que la revocación.
select pg_temp.assert_true(
  pg_temp.rpc_delete('team-A', pg_temp.fixture_id('c-reason'), '  Ficha duplicada de prueba  ') is true
  and pg_temp.alive('c-reason') is false,
  'La RPC borra el cliente vivo de su tenant y devuelve true');
create temporary table reason_deleted_at as
  select deleted_at from public.clients where id = pg_temp.fixture_id('c-reason');
do $event$
declare e public.entity_audit_log := pg_temp.client_event('c-reason', 'client_deleted');
  p public.entity_audit_log := pg_temp.portal_event('c-reason');
begin
  perform pg_temp.assert_true(pg_temp.client_events('c-reason', 'client_deleted') = 1
    and pg_temp.client_events('c-reason', 'client_merged') = 0,
    'Un solo evento client_deleted para el cliente borrado');
  perform pg_temp.assert_true(e.tenant_id = pg_temp.fixture_id('tenant-A') and e.entity_type = 'client'
    and e.entity_id = pg_temp.fixture_id('c-reason')
    and e.actor_type = 'user' and e.actor_id = pg_temp.fixture_id('team-A'),
    'El evento registra tenant, entidad y actor desde el contexto confiable');
  perform pg_temp.assert_true(e.reason = 'Ficha duplicada de prueba',
    'El evento lleva el motivo humano recortado');
  perform pg_temp.assert_true(e.before_data = '{"deleted_at": null, "merged_into_client_id": null}'::jsonb
    and (e.after_data->>'deleted_at')::timestamptz = (select deleted_at from reason_deleted_at)
    and e.after_data->'merged_into_client_id' = 'null'::jsonb
    and (select array_agg(k order by k) from jsonb_object_keys(e.after_data) k) = array['deleted_at', 'merged_into_client_id'],
    'Antes y después: deleted_at y merged_into_client_id, nada más');
  perform pg_temp.assert_true(
    e.payload = '{"permanence": "P2", "consequence": "removed_from_lists_portal_access_revoked", "recovery": "no_studio_restore", "related_files": []}'::jsonb
    and e.source = 'rpc' and e.result = 'succeeded' and e.sensitivity = 'restricted' and e.schema_version = 1
    and e.occurred_at is not null,
    'Payload con la clasificación MP-01, consecuencia y recuperación; source, result, sensibilidad y hora del servidor');
  perform pg_temp.assert_true(e.correlation_id ~ ('^d5:clients:' || pg_temp.fixture_id('c-reason')::text || ':[0-9]+$')
    and split_part(e.correlation_id, ':', 4) = split_part(p.correlation_id, ':', 4),
    'Correlación D5 del cliente, con la misma transacción que el evento de revocación del Portal');
  perform pg_temp.assert_true(
    position('Ñandú' in to_jsonb(e)::text) = 0 and position('REASON' in to_jsonb(e)::text) = 0
    and position('example.invalid' in to_jsonb(e)::text) = 0 and position('0007777' in to_jsonb(e)::text) = 0,
    'El evento no copia nombre, Shipping Mark, correo ni teléfono');
  perform pg_temp.assert_true((pg_temp.binding('c-reason')).status = 'revoked' and pg_temp.open_links('c-reason') = 0
    and p.actor_id = pg_temp.fixture_id('team-A') and p.reason = 'Ficha duplicada de prueba',
    'La revocación del Portal ocurre en la misma transacción y reusa el motivo humano');
  perform pg_temp.assert_true(coalesce(current_setting('dtd.audit_reason', true), '') = '',
    'El motivo no queda en la transacción después de la RPC');
end;
$event$;

-- Sin motivo (NULL) y con motivo en blanco: motivo por defecto; la revocación usa el suyo.
select pg_temp.assert_true(
  pg_temp.rpc_delete('team-A', pg_temp.fixture_id('c-noreason'), null) is true
  and (pg_temp.client_event('c-noreason', 'client_deleted')).reason = 'Cliente eliminado sin motivo indicado (SDD-0469).'
  and (pg_temp.portal_event('c-noreason')).reason = 'Cliente borrado: acceso al Portal revocado (SDD-0467).'
  and (pg_temp.binding('c-noreason')).status = 'revoked',
  'Sin motivo: el evento lleva el motivo por defecto y la revocación del Portal el de 0454');
-- Con un motivo previo en la transacción: la RPC no lo hereda y lo restaura.
select set_config('dtd.audit_reason', 'Motivo heredado del caller', true);
select pg_temp.assert_true(
  pg_temp.rpc_delete('team-A', pg_temp.fixture_id('c-blank'), '     ') is true
  and (pg_temp.client_event('c-blank', 'client_deleted')).reason = 'Cliente eliminado sin motivo indicado (SDD-0469).'
  and current_setting('dtd.audit_reason', true) = 'Motivo heredado del caller',
  'Un motivo en blanco cuenta como sin motivo: no hereda el motivo previo y lo restaura al terminar');
select set_config('dtd.audit_reason', '', true);

-- Cero filas: ya borrado, inexistente u otro tenant. Nunca true y nunca evento.
do $zero_rows$
declare v_rows bigint := pg_temp.audit_rows();
begin
  perform pg_temp.assert_true(
    pg_temp.rpc_delete('team-A', pg_temp.fixture_id('c-reason'), 'Segundo intento') is false
    and pg_temp.client_events('c-reason', 'client_deleted') = 1
    and (select deleted_at from public.clients where id = pg_temp.fixture_id('c-reason')) = (select deleted_at from reason_deleted_at),
    'Un cliente ya borrado: false, sin evento nuevo y sin mover deleted_at');
  perform pg_temp.assert_true(
    pg_temp.rpc_delete('team-A', pg_temp.fixture_id('c-inexistente'), null) is false,
    'Un cliente inexistente: false');
  perform pg_temp.assert_true(
    pg_temp.rpc_delete('team-B', pg_temp.fixture_id('c-surv'), 'Intento cruzado') is false
    and pg_temp.alive('c-surv') and pg_temp.client_events('c-surv', 'client_deleted') = 0,
    'Un cliente de otro tenant es invisible por RLS: false y sigue vivo');
  perform pg_temp.assert_true(pg_temp.audit_rows() = v_rows,
    'Los intentos de cero filas no escriben ningún evento');
end;
$zero_rows$;
select pg_temp.assert_true(
  pg_temp.rpc_delete('team-B', pg_temp.fixture_id('c-B'), 'Baja en tenant B') is true
  and (pg_temp.client_event('c-B', 'client_deleted')).tenant_id = pg_temp.fixture_id('tenant-B')
  and (pg_temp.client_event('c-B', 'client_deleted')).actor_id = pg_temp.fixture_id('team-B')
  and pg_temp.client_events('c-reason', 'client_deleted') = 1,
  'Con el mismo Shipping Mark en otro tenant, B borra lo suyo con su tenant y su actor, sin tocar A');

-- Entradas inválidas y roles de la API sin EXECUTE: nada cambia.
do $invalid$
declare v_rows bigint := pg_temp.audit_rows();
begin
  perform pg_temp.assert_true(pg_temp.rpc_state('authenticated', 'team-A', pg_temp.fixture_id('c-short'), 'abc') = '22023',
    'Un motivo de 3 caracteres se rechaza con 22023');
  perform pg_temp.assert_true(pg_temp.rpc_state('authenticated', 'team-A', pg_temp.fixture_id('c-short'), repeat('m', 1001)) = '22023',
    'Un motivo de 1001 caracteres se rechaza con 22023');
  perform pg_temp.assert_true(pg_temp.rpc_state('authenticated', 'team-A', null, 'Motivo válido') = '22023',
    'Sin id de cliente se rechaza con 22023');
  perform pg_temp.assert_true(pg_temp.rpc_state('authenticated', 'team-A', pg_temp.fixture_id('c-reason'), 'abc') = '22023',
    'El motivo se valida antes de buscar la fila: también sobre un cliente ya borrado');
  perform pg_temp.assert_true(pg_temp.rpc_state('anon', '', pg_temp.fixture_id('c-short'), null) = '42501',
    'anon no puede ejecutar la RPC');
  perform pg_temp.assert_true(pg_temp.rpc_state('service_role', '', pg_temp.fixture_id('c-short'), null) = '42501',
    'service_role no puede ejecutar la RPC');
  perform pg_temp.assert_true(pg_temp.alive('c-short') and pg_temp.audit_rows() = v_rows,
    'Los rechazos no borran ni escriben eventos');
end;
$invalid$;
select pg_temp.assert_true(
  pg_temp.rpc_delete('team-A', pg_temp.fixture_id('c-short'), 'Dupl') is true
  and (pg_temp.client_event('c-short', 'client_deleted')).reason = 'Dupl'
  and pg_temp.rpc_delete('team-A', pg_temp.fixture_id('c-long'), repeat('m', 1000)) is true
  and char_length((pg_temp.client_event('c-long', 'client_deleted')).reason) = 1000,
  'Los límites del motivo (4 y 1000 caracteres) se aceptan');

-- Fusión: client_merged para la ficha retirada, nunca client_deleted.
do $merge$
declare v_res jsonb; e public.entity_audit_log;
begin
  v_res := pg_temp.merge_as('team-A-ops', 'c-surv', 'c-dup');
  e := pg_temp.client_event('c-dup', 'client_merged');
  perform pg_temp.assert_true(v_res->>'access' = 'acceso mudado al superviviente' and pg_temp.alive('c-dup') is false,
    'merge_clients retira la ficha duplicada');
  perform pg_temp.assert_true(pg_temp.client_events('c-dup', 'client_merged') = 1
    and pg_temp.client_events('c-dup', 'client_deleted') = 0
    and (select count(*) from public.entity_audit_log where entity_type = 'client'
           and entity_id = pg_temp.fixture_id('c-surv') and event_type in ('client_deleted', 'client_merged')) = 0,
    'La fusión deja un solo client_merged sobre la ficha retirada, ningún client_deleted y ningún borrado ni fusión sobre el superviviente');
  perform pg_temp.assert_true(e.actor_type = 'user' and e.actor_id = pg_temp.fixture_id('team-A-ops')
    and e.reason = 'Ficha retirada por fusión con otro cliente (merge_clients).'
    and (e.after_data->>'merged_into_client_id')::uuid = pg_temp.fixture_id('c-surv')
    and e.before_data->'merged_into_client_id' = 'null'::jsonb
    and e.payload->>'consequence' = 'retired_by_merge',
    'El evento de fusión nombra al operador, al superviviente y su motivo propio');
end;
$merge$;
-- Una ficha que ya estaba fusionada, restaurada a mano y borrada por un
-- operador: es un borrado, no otra fusión (merged_into_client_id no cambia).
update public.clients set deleted_at = null where id = pg_temp.fixture_id('c-dup');
select pg_temp.assert_true(
  pg_temp.rpc_delete('team-A', pg_temp.fixture_id('c-dup'), 'Baja tras restaurar') is true
  and pg_temp.client_events('c-dup', 'client_deleted') = 1
  and pg_temp.client_events('c-dup', 'client_merged') = 1
  and (pg_temp.client_event('c-dup', 'client_deleted')).after_data->>'merged_into_client_id' = pg_temp.fixture_id('c-surv')::text
  and (pg_temp.client_event('c-dup', 'client_deleted')).payload->>'consequence' = 'removed_from_lists_portal_access_revoked',
  'Borrar una ficha que ya estaba fusionada es client_deleted, no otra fusión');

-- Fallo atómico: si el evento no se escribe, no hay borrado ni revocación.
savepoint atomic_probe;
create function public.fixture_0455_boom() returns trigger language plpgsql as $$
begin
  if new.entity_type = 'client' then raise exception 'auditoría rota a propósito'; end if;
  return new;
end $$;
create trigger fixture_0455_boom before insert on public.entity_audit_log
  for each row execute function public.fixture_0455_boom();
do $atomic$
declare v_state text; v_rows bigint := pg_temp.audit_rows();
begin
  perform pg_temp.assert_true(
    pg_temp.rpc_state('authenticated', 'team-A', pg_temp.fixture_id('c-fail'), 'Motivo válido') = 'P0001',
    'Con el writer roto la RPC falla');
  perform pg_temp.assert_true(pg_temp.alive('c-fail')
    and (pg_temp.binding('c-fail')).status = 'active' and (pg_temp.binding('c-fail')).auth_user_id is not null
    and pg_temp.open_links('c-fail') = 1 and pg_temp.audit_rows() = v_rows,
    'Si el evento falla por la RPC, el cliente sigue vivo con su acceso y su código, y no queda ningún evento');
  begin
    perform pg_temp.studio_soft_delete('team-A', 'FAIL');
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    execute 'reset role';
  end;
  perform pg_temp.assert_true(v_state = 'P0001' and pg_temp.alive('c-fail')
    and (pg_temp.binding('c-fail')).status = 'active' and pg_temp.open_links('c-fail') = 1
    and pg_temp.audit_rows() = v_rows,
    'Si el evento falla por el UPDATE directo, tampoco hay borrado, revocación ni evento');
end;
$atomic$;
rollback to atomic_probe;
savepoint atomic_catalog;
update public.audit_entity_types set status = 'deprecated', deprecated_at = now() where entity_type = 'client';
select pg_temp.assert_true(
  pg_temp.rpc_state('authenticated', 'team-A', pg_temp.fixture_id('c-fail'), null) = '23503'
  and pg_temp.alive('c-fail') and (pg_temp.binding('c-fail')).status = 'active',
  'Con el tipo client inactivo el writer rechaza el evento y el borrado no ocurre');
rollback to atomic_catalog;
release atomic_probe;

-- Restaurar no emite borrado; volver a borrar es otra transición auditada.
select pg_temp.assert_true(pg_temp.rpc_delete('team-A', pg_temp.fixture_id('c-restore'), 'Primera baja') is true
  and pg_temp.client_events('c-restore', 'client_deleted') = 1,
  'Primera baja auditada');
update public.clients set deleted_at = null where id = pg_temp.fixture_id('c-restore');
select pg_temp.assert_true(pg_temp.client_events('c-restore', 'client_deleted') = 1,
  'Restaurar (deleted_at a NULL) no escribe un client_deleted');
select pg_temp.assert_true(pg_temp.rpc_delete('team-A', pg_temp.fixture_id('c-restore'), 'Segunda baja') is true
  and pg_temp.client_events('c-restore', 'client_deleted') = 2,
  'Volver a borrar el cliente restaurado deja un segundo evento');
update public.clients set deleted_at = deleted_at + interval '1 minute' where id = pg_temp.fixture_id('c-restore');
select pg_temp.assert_true(pg_temp.client_events('c-restore', 'client_deleted') = 2,
  'Mover deleted_at de un cliente ya borrado no escribe otro evento');

-- La fusión rellena el correo del superviviente y el D5 de contacto (0293)
-- registra client_contact_updated sobre él: el único otro evento del cliente.
select pg_temp.assert_true(
  not exists (select from public.entity_audit_log where entity_type = 'client'
    and event_type in ('client_deleted', 'client_merged') and (reason is null or sensitivity <> 'restricted'))
  and (select count(*) from public.entity_audit_log where entity_type = 'client' and event_type = 'client_deleted') = 10
  and (select count(*) from public.entity_audit_log where entity_type = 'client' and event_type = 'client_merged') = 1
  and not exists (select from public.entity_audit_log where entity_type = 'client'
    and event_type not in ('client_deleted', 'client_merged', 'client_contact_updated')),
  'Todos los borrados y fusiones llevan motivo y sensibilidad restringida: 10 borrados y 1 fusión');

do $done$
begin
  raise notice 'TEST 0455 OK: % aserciones', (select count(*) from pg_temp.assertions);
end;
$done$;

rollback;
