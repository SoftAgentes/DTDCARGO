\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0460 (SDD-0477): un vínculo del Portal
-- revocado conserva su correo y sus fechas 30 días; después la RPC del cron los
-- borra, deja la fila revoked y un evento AUD-01 por fila.
-- Fixtures ficticios y rollback: nunca consulta ni modifica una base alojada.
-- Aplica las migraciones REALES 0006, 0080, 0081, 0226, 0227, 0230, 0360, 0361,
-- la plataforma de auditoría 0258/0261/0267/0294, la función D5 de 0293
-- extraída del archivo (con sus triggers de client_users y de contacto de
-- clients), los holds de 0301 y la 0454 real, con los helpers vigentes de 0453,
-- 0200, 0012 y 0351.
--
-- RED: psql -v apply_fix=false. GREEN (predeterminado): aplica la 0460 real.
--
-- Lo que defiende:
--   1. RED, sin 0460: un vínculo revocado hace 60 días conserva correo y fechas,
--      no existe la RPC y email no admite NULL.
--   2. Estático: timeouts antes del preflight; preflight → ALTER → CHECK → RPC
--      → ACL → postflight → reset; una sola función, SECURITY DEFINER con
--      search_path vacío; un solo GRANT (EXECUTE a service_role); sin DROP,
--      DELETE, INSERT, policies, tablas, índices ni triggers.
--   3. Drift: CHECK de status distinto; email anulable sin el CHECK; el CHECK
--      con otra forma; RLS apagada; columna ausente; writer sin SECURITY
--      DEFINER o no ejecutable por quien aplica; tipo portal_invitation
--      inactivo; holds de 0301 incompletos; FORCE RLS; otra firma de la RPC; un
--      rol que no se salta la RLS: P0001 en el preflight, sin ids ni correos, y
--      catálogo intacto.
--   4. Aplicada: timeouts restaurados, sin huella en la sesión, sin tocar filas
--      ni escribir eventos; forma final, CHECK y ACL; reaplicar no cambia nada y
--      repara una ACL abierta; reaplicar sin el CHECK aborta.
--   5. Comportamiento: sólo service_role ejecuta; parámetros inválidos; dry run
--      sin cambios; una fila invited o active nunca entra, tampoco una revocada
--      hace 29 días; base revoked_at o updated_at; tope por corrida y orden por
--      antigüedad; idempotencia sin eventos duplicados; holds de tenant, de
--      tipo y de entidad (client y portal_invitation) bloquean y uno liberado
--      no; evento por fila sin PII y sin D5 de status; motivo heredado del
--      caller ignorado y restaurado; fallo atómico del evento; la fila borrada
--      se sigue leyendo como revoked y se puede volver a invitar; el CHECK
--      rechaza vaciar una fila viva.
--   Límite: la concurrencia (SKIP LOCKED entre dos corridas) no se prueba en una
--   sola sesión de psql.

\if :{?apply_fix}
\else
\set apply_fix true
\endif

begin;

do $guard$
begin
  if to_regclass('public.clients') is not null or to_regnamespace('auth') is not null then
    raise exception 'TEST 0460 requiere una base desechable vacía';
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
\ir ../migrations/0226_portal_invite_counts.sql
\ir ../migrations/0227_portal_invite_by.sql
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

-- Holds reales de 0301 (AUD-02 E2), que la RPC respeta.
\ir ../migrations/0301_audit_legal_holds.sql

-- La revocación del Portal real (0454), como en producción.
\ir ../migrations/0454_borrar_cliente_revoca_portal.sql

-- ─── Utilidades ─────────────────────────────────────────────────────────────
create function pg_temp.fixture_id(label text) returns uuid language sql immutable as $$
  select md5('0460-synthetic-' || label)::uuid
$$;
create temporary table assertions (label text primary key);
grant insert, select on assertions to authenticated, service_role, anon;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'TEST 0460: %', label; end if;
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
create function pg_temp.erased_events(p_client text) returns bigint language sql volatile as $$
  select count(*) from public.entity_audit_log
   where entity_type = 'portal_invitation' and entity_id = pg_temp.fixture_id(p_client)
     and event_type = 'portal_access_data_erased'
$$;
create function pg_temp.erased_event(p_client text) returns public.entity_audit_log language sql volatile as $$
  select * from public.entity_audit_log
   where entity_type = 'portal_invitation' and entity_id = pg_temp.fixture_id(p_client)
     and event_type = 'portal_access_data_erased'
   order by occurred_at desc limit 1
$$;
create function pg_temp.status_events() returns bigint language sql volatile as $$
  select count(*) from public.entity_audit_log where event_type = 'portal_access_status_changed'
$$;
create function pg_temp.audit_rows() returns bigint language sql volatile as $$
  select count(*) from public.entity_audit_log
$$;
-- La RPC como la llama el cron: rol service_role, sin principal.
create function pg_temp.erase(p_limit integer, p_dry_run boolean) returns jsonb language plpgsql as $$
declare v jsonb;
begin
  perform pg_temp.as_principal('');
  execute 'set local role service_role';
  v := public.erase_revoked_portal_access_data(p_limit, p_dry_run);
  execute 'reset role';
  return v;
end;
$$;
-- SQLSTATE con el que falla la RPC para un rol; NULL si no falla.
create function pg_temp.erase_state(p_role text, p_limit integer, p_dry_run boolean) returns text language plpgsql as $$
declare v_state text;
begin
  perform pg_temp.as_principal(case when p_role = 'authenticated' then 'team-A' else '' end);
  execute format('set local role %I', p_role);
  begin
    perform public.erase_revoked_portal_access_data(p_limit, p_dry_run);
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
  end;
  execute 'reset role';
  return v_state;
end;
$$;
-- SQLSTATE de una sentencia arbitraria; NULL si no falla (se revierte igual).
create function pg_temp.stmt_state(p_sql text) returns text language plpgsql as $$
declare v_state text;
begin
  begin
    execute p_sql;
    raise exception using errcode = 'PT460', message = 'rollback sentencia de prueba';
  exception
    when sqlstate 'PT460' then v_state := null;
    when others then get stacked diagnostics v_state = returned_sqlstate;
  end;
  return v_state;
end;
$$;

-- ─── Fixture sintético ──────────────────────────────────────────────────────
insert into public.tenants (id, slug, display_name) values
  (pg_temp.fixture_id('tenant-A'), 'synthetic-A', 'Tenant A'), (pg_temp.fixture_id('tenant-B'), 'synthetic-B', 'Tenant B');
insert into auth.users (id, email)
select pg_temp.fixture_id(v), v || '@example.invalid' from unnest(array[
  'team-A', 'team-B', 'p-active', 'p-legacy', 'p-deleted'
]) v;
insert into public.user_tenants (user_id, tenant_id, role)
values (pg_temp.fixture_id('team-A'), pg_temp.fixture_id('tenant-A'), 'admin'),
       (pg_temp.fixture_id('team-B'), pg_temp.fixture_id('tenant-B'), 'admin');
insert into public.clients (id, tenant_id, markbox, name, email)
select pg_temp.fixture_id(label), pg_temp.fixture_id(tenant), markbox, 'Cliente Sintético ' || markbox,
  lower(markbox) || '@example.invalid'
from (values
  ('c-active', 'tenant-A', 'ACTIVE'),
  ('c-invited', 'tenant-A', 'INVITED'),
  ('c-rev31', 'tenant-A', 'REVTREINTAYUNO'),
  ('c-rev29', 'tenant-A', 'REVVEINTINUEVE'),
  ('c-legacy', 'tenant-A', 'LEGACY'),
  ('c-legacy-recent', 'tenant-A', 'LEGRECENT'),
  ('c-deleted', 'tenant-A', 'DELETED'),
  ('c-released', 'tenant-A', 'RELEASED'),
  ('c-held-client', 'tenant-A', 'HELDCLIENT'),
  ('c-held-portal', 'tenant-A', 'HELDPORTAL'),
  ('c-held-tenant', 'tenant-B', 'HELDTENANT')
) v(label, tenant, markbox);
-- Días hacia atrás de cada fecha; NULL = sin fecha.
insert into public.client_users (tenant_id, client_id, email, auth_user_id, token, status, invited_by,
  invited_at, bound_at, revoked_at, last_login_at, created_at, updated_at,
  email_invite_count, whatsapp_invite_count, last_email_invite_at, last_whatsapp_invite_at,
  last_email_invite_by, last_whatsapp_invite_by)
select pg_temp.fixture_id(tenant), pg_temp.fixture_id(client), lower(markbox) || '@example.invalid',
  case when owner is null then null else pg_temp.fixture_id(owner) end, token, status, pg_temp.fixture_id(inviter),
  now() - make_interval(days => invited_d),
  case when bound_d is null then null else now() - make_interval(days => bound_d) end,
  case when revoked_d is null then null else now() - make_interval(days => revoked_d) end,
  case when login_d is null then null else now() - make_interval(days => login_d) end,
  now() - make_interval(days => invited_d), now() - make_interval(days => updated_d),
  2, 1, now() - make_interval(days => invited_d - 1), now() - make_interval(days => invited_d - 2),
  pg_temp.fixture_id(inviter), pg_temp.fixture_id(inviter)
from (values
  ('tenant-A', 'c-active', 'ACTIVE', 'p-active', null, 'active', 'team-A', 90, 80, null, 60, 60),
  ('tenant-A', 'c-invited', 'INVITED', null, 'tok-invited-0460', 'invited', 'team-A', 90, null, null, null, 60),
  ('tenant-A', 'c-rev31', 'REVTREINTAYUNO', null, null, 'revoked', 'team-A', 90, 80, 31, 40, 31),
  ('tenant-A', 'c-rev29', 'REVVEINTINUEVE', null, null, 'revoked', 'team-A', 90, 80, 29, 40, 29),
  -- Fusión anterior a 0454: revocada sin revoked_at y todavía con identidad y token.
  ('tenant-A', 'c-legacy', 'LEGACY', 'p-legacy', 'tok-legacy-0460', 'revoked', 'team-A', 90, 80, null, 70, 40),
  ('tenant-A', 'c-legacy-recent', 'LEGRECENT', null, null, 'revoked', 'team-A', 90, null, null, null, 5),
  ('tenant-A', 'c-released', 'RELEASED', null, null, 'revoked', 'team-A', 90, 80, 50, 60, 50),
  ('tenant-A', 'c-held-client', 'HELDCLIENT', null, null, 'revoked', 'team-A', 90, 80, 60, 70, 60),
  ('tenant-A', 'c-held-portal', 'HELDPORTAL', null, null, 'revoked', 'team-A', 90, 80, 60, 70, 60),
  ('tenant-B', 'c-held-tenant', 'HELDTENANT', null, null, 'revoked', 'team-B', 90, 80, 60, 70, 60)
) v(tenant, client, markbox, owner, token, status, inviter, invited_d, bound_d, revoked_d, login_d, updated_d);
-- Cliente borrado: 0454 revoca su vínculo activo; después se lo lleva a 45 días.
insert into public.client_users (tenant_id, client_id, email, auth_user_id, status, invited_by, bound_at, last_login_at)
values (pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('c-deleted'), 'deleted@example.invalid',
  pg_temp.fixture_id('p-deleted'), 'active', pg_temp.fixture_id('team-A'), now() - interval '80 days',
  now() - interval '50 days');
update public.clients set deleted_at = now() where id = pg_temp.fixture_id('c-deleted');
update public.client_users set revoked_at = now() - interval '45 days' where client_id = pg_temp.fixture_id('c-deleted');

-- Holds: sobre el cliente (client), sobre el vínculo (portal_invitation), uno
-- ya liberado, uno de tenant en B y uno sobre otro cliente que no bloquea a nadie.
insert into public.audit_legal_holds (id, tenant_id, scope_type, entity_type, entity_id, reason, reference, created_by)
values
  (pg_temp.fixture_id('hold-client'), pg_temp.fixture_id('tenant-A'), 'entity', 'client',
   pg_temp.fixture_id('c-held-client'), 'Reclamo sintético abierto', 'REF-0460-1', pg_temp.fixture_id('team-A')),
  (pg_temp.fixture_id('hold-portal'), pg_temp.fixture_id('tenant-A'), 'entity', 'portal_invitation',
   pg_temp.fixture_id('c-held-portal'), 'Investigación sintética', 'REF-0460-2', pg_temp.fixture_id('team-A')),
  (pg_temp.fixture_id('hold-released'), pg_temp.fixture_id('tenant-A'), 'entity', 'client',
   pg_temp.fixture_id('c-released'), 'Hold sintético ya liberado', 'REF-0460-3', pg_temp.fixture_id('team-A')),
  (pg_temp.fixture_id('hold-tenant'), pg_temp.fixture_id('tenant-B'), 'tenant', null, null,
   'Litigio sintético del tenant', 'REF-0460-4', pg_temp.fixture_id('team-B')),
  (pg_temp.fixture_id('hold-other'), pg_temp.fixture_id('tenant-A'), 'entity', 'client',
   pg_temp.fixture_id('c-active'), 'Hold sintético sobre otro cliente', 'REF-0460-5', pg_temp.fixture_id('team-A'));
insert into public.audit_legal_hold_events (hold_id, tenant_id, event_type, reason, actor_id, occurred_at)
select pg_temp.fixture_id(h), pg_temp.fixture_id(t), e, 'Evento sintético del hold', pg_temp.fixture_id(a),
  now() - make_interval(days => d)
from (values
  ('hold-client', 'tenant-A', 'active', 'team-A', 10),
  ('hold-portal', 'tenant-A', 'active', 'team-A', 10),
  ('hold-released', 'tenant-A', 'active', 'team-A', 20),
  ('hold-released', 'tenant-A', 'released', 'team-A', 5),
  ('hold-tenant', 'tenant-B', 'active', 'team-B', 10),
  ('hold-other', 'tenant-A', 'active', 'team-A', 10)
) v(h, t, e, a, d);

do $fixture_check$
begin
  if (select count(*) from public.client_users) <> 11
     or (select count(*) from public.client_users where status = 'revoked') <> 9
     or (pg_temp.binding('c-deleted')).revoked_at <> now() - interval '45 days'
     or (pg_temp.binding('c-deleted')).auth_user_id is not null
     or (select count(*) from public.audit_legal_holds) <> 5
     or not exists (select from pg_trigger where tgname = 'client_users_require_live_client') then
    raise exception 'TEST 0460: el fixture no quedó armado';
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
    from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'),
  'constraints', (select jsonb_agg(jsonb_build_array(c.conrelid::regclass::text, c.conname, c.convalidated, pg_get_constraintdef(c.oid)) order by c.conrelid, c.conname)
    from pg_constraint c where c.connamespace = 'public'::regnamespace),
  'client_users_not_null', (select jsonb_agg(jsonb_build_array(a.attname, a.attnotnull) order by a.attnum)
    from pg_attribute a where a.attrelid = 'public.client_users'::regclass and a.attnum > 0 and not a.attisdropped)
);
$catalog$;
create function pg_temp.entity_types_snapshot() returns jsonb language sql stable as $types$
  select jsonb_agg(to_jsonb(e) order by entity_type) from public.audit_entity_types e
$types$;
create temporary table entity_types_before as select pg_temp.entity_types_snapshot() as types;
create function pg_temp.rows_snapshot() returns jsonb language sql stable as $rows$
select jsonb_build_object(
  'clients', (select jsonb_agg(to_jsonb(c) order by id) from public.clients c),
  'bindings', (select jsonb_agg(to_jsonb(c) order by id) from public.client_users c),
  'holds', (select jsonb_agg(to_jsonb(h) order by id) from public.audit_legal_holds h),
  'audit', (select coalesce(jsonb_agg(to_jsonb(a) order by id), '[]'::jsonb) from public.entity_audit_log a)
);
$rows$;
create temporary table before_migration as
  select pg_temp.catalog_snapshot() as catalog, pg_temp.rows_snapshot() as rows;

-- ─── 1 · RED: lo que hoy hace main ──────────────────────────────────────────
savepoint red_probe;
do $red$
begin
  if to_regprocedure('public.erase_revoked_portal_access_data(integer,boolean)') is not null then
    raise exception 'TEST 0460 baseline: la RPC ya existe antes de la migración';
  end if;
  if (pg_temp.binding('c-held-client')).email is null
     or (pg_temp.binding('c-held-client')).invited_at is null
     or (pg_temp.binding('c-held-client')).bound_at is null then
    raise exception 'TEST 0460 baseline: el vínculo revocado hace 60 días no conserva sus datos';
  end if;
  begin
    update public.client_users set email = null where client_id = pg_temp.fixture_id('c-rev31');
    raise exception 'TEST 0460 baseline: email ya admitía NULL';
  exception when not_null_violation then null;
  end;
  raise notice 'TEST 0460 RED baseline: un vínculo revocado hace 60 días conserva correo y fechas, no existe la RPC que los borra y email no admite NULL';
end;
$red$;
rollback to red_probe;
release red_probe;
select pg_temp.assert_true((select rows from before_migration) = pg_temp.rows_snapshot(),
  'La sonda RED no dejó filas');

\if :apply_fix
-- ─── 3 · Drift: el preflight falla cerrado y no toca nada ───────────────────
do $drift$
declare drift text; failed boolean; message text; state text; after_drift jsonb; n int := 0;
  migration text := pg_read_file('/sb/migrations/0460_retencion_vinculo_portal_revocado.sql');
begin
  foreach drift in array array[
    $d$alter table public.client_users drop constraint client_users_status_check; alter table public.client_users add constraint client_users_status_check check (status in ('invited', 'active', 'revoked', 'paused'))$d$,
    'alter table public.client_users alter column email drop not null',
    'alter table public.client_users alter column invited_at drop not null',
    'alter table public.client_users add constraint client_users_erased_only_when_revoked check (email is not null)',
    'alter table public.client_users disable row level security',
    'alter table public.client_users rename column last_whatsapp_invite_at to fixture_0460_col',
    'alter function public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text) security invoker',
    $d$update public.audit_entity_types set status = 'deprecated', deprecated_at = now() where entity_type = 'portal_invitation'$d$,
    'alter table public.audit_legal_hold_events rename column occurred_at to fixture_0460_at',
    'alter table public.client_users force row level security',
    'alter table public.audit_legal_holds force row level security',
    $d$create function public.erase_revoked_portal_access_data(p_limit integer) returns jsonb language sql set search_path = '' as $f$ select '{}'::jsonb $f$$d$,
    -- Un rol que no ejecuta el writer: la RPC quedaría con un dueño que no escribe el evento.
    'create role fixture_0460_plain nologin; set role fixture_0460_plain',
    -- Un rol que ejecuta el writer pero no se salta la RLS: la RPC vería 0 filas sin error.
    'create role fixture_0460_applier nologin; grant execute on function public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text) to fixture_0460_applier; grant select on public.audit_entity_types to fixture_0460_applier; set role fixture_0460_applier'
  ] loop
    failed := false;
    begin
      execute drift;
      after_drift := pg_temp.catalog_snapshot();
      begin execute migration;
      exception when others then
        get stacked diagnostics message = message_text, state = returned_sqlstate;
        if state <> 'P0001' or (message not like '0460 requiere%' and message not like '0460 abortada%') then
          raise exception 'TEST 0460: drift no falló en preflight: % / % (%)', state, message, left(drift, 80);
        end if;
        if (drift like '%paused%' and message not like '0460 abortada: el CHECK de status%')
           or (drift like '%drop not null%' and message not like '0460 abortada: email o invited_at ya admiten NULL%')
           or (drift like '%check (email is not null)%'
               and message not like '0460 abortada: ya existe client_users_erased_only_when_revoked con otra forma%')
           or (drift like '%disable row level security%' and message not like '0460 requiere tabla con RLS%')
           or (drift like '%fixture_0460_col%' and message not like '0460 requiere la columna%')
           or (drift like '%security invoker%' and message not like '0460 requiere append_audit_event%')
           or (drift like '%deprecated%' and message not like '0460 abortada: el tipo de entidad portal_invitation%')
           or (drift like '%fixture_0460_at%' and message not like '0460 requiere los holds de 0301%')
           or (drift like '%client_users force%' and message not like '0460 abortada: public.client_users tiene FORCE%')
           or (drift like '%audit_legal_holds force%' and message not like '0460 abortada: public.audit_legal_holds tiene FORCE%')
           or (drift like '%p_limit integer)%' and message not like '0460 abortada: existe otra firma%')
           or (drift like '%fixture_0460_plain%'
               and message not like '0460 abortada: el rol que aplica no puede ejecutar append_audit_event%')
           or (drift like '%fixture_0460_applier%'
               and message not like '0460 abortada: el rol que aplica no es dueño de public.client_users%') then
          raise exception 'TEST 0460: el drift abortó sin su mensaje claro: % (%)', message, left(drift, 80);
        end if;
        if message ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' or message like '%@%' then
          raise exception 'TEST 0460: el mensaje del preflight expone ids o correos: %', message;
        end if;
        failed := true;
      end;
      if not failed or after_drift <> pg_temp.catalog_snapshot() then
        raise exception 'TEST 0460: preflight aceptó drift o alteró catálogo: %', left(drift, 80);
      end if;
      raise exception using errcode = 'PT460', message = 'rollback drift sintético';
    exception when sqlstate 'PT460' then null;
    end;
    n := n + 1;
    perform pg_temp.assert_true(true, 'Drift #' || n || ' rechazado en el preflight sin tocar el catálogo: ' || left(drift, 60));
  end loop;
end;
$drift$;
select pg_temp.assert_true((select catalog from before_migration) = pg_temp.catalog_snapshot()
  and (select rows from before_migration) = pg_temp.rows_snapshot()
  and (select types from entity_types_before) = pg_temp.entity_types_snapshot(),
  'Los drift se revierten enteros');

-- ─── 4 · Aplicada ───────────────────────────────────────────────────────────
\ir ../migrations/0460_retencion_vinculo_portal_revocado.sql
select pg_temp.assert_true(current_setting('lock_timeout') = '0' and current_setting('statement_timeout') = '0',
  'La migración restaura lock_timeout y statement_timeout de sesión');
select pg_temp.assert_true(coalesce(current_setting('dtd.m0460_huella', true), '') = '',
  'La migración no deja la huella en la sesión');
select pg_temp.assert_true((select rows from before_migration) = pg_temp.rows_snapshot(),
  'Aplicar no toca filas ni escribe eventos: sin backfill');
create temporary table after_first as select pg_temp.catalog_snapshot() as catalog, pg_temp.rows_snapshot() as rows;
\ir ../migrations/0460_retencion_vinculo_portal_revocado.sql
select pg_temp.assert_true((select catalog from after_first) = pg_temp.catalog_snapshot()
  and (select rows from after_first) = pg_temp.rows_snapshot(),
  'Reaplicar deja catálogo y filas idénticos: mismo oid de la RPC');

select pg_temp.assert_true(
  (select catalog->'policies' from before_migration) = pg_temp.catalog_snapshot()->'policies'
  and (select catalog->'tables' from before_migration) = pg_temp.catalog_snapshot()->'tables'
  and (select catalog->'triggers' from before_migration) = pg_temp.catalog_snapshot()->'triggers'
  and (select types from entity_types_before) = pg_temp.entity_types_snapshot(),
  'Policies, triggers, RLS, ACL de tablas y tipos de entidad idénticos a antes de la migración');
select pg_temp.assert_true(
  (select jsonb_agg(value order by value) from jsonb_array_elements((select catalog from before_migration)->'functions'))
  = (select jsonb_agg(value order by value) from jsonb_array_elements(pg_temp.catalog_snapshot()->'functions')
      where value->>1 <> 'erase_revoked_portal_access_data'),
  'Ninguna función existente cambia: sólo se agrega la RPC');
select pg_temp.assert_true(
  (select jsonb_agg(value order by value) from jsonb_array_elements((select catalog from before_migration)->'constraints'))
  = (select jsonb_agg(value order by value) from jsonb_array_elements(pg_temp.catalog_snapshot()->'constraints')
      where value->>1 <> 'client_users_erased_only_when_revoked')
  and exists (select from pg_constraint where conrelid = 'public.client_users'::regclass
    and conname = 'client_users_erased_only_when_revoked' and contype = 'c' and convalidated
    and pg_get_constraintdef(oid) = 'CHECK (((status = ''revoked''::text) OR ((email IS NOT NULL) AND (invited_at IS NOT NULL))))'),
  'Sólo se agrega el CHECK de la migración, validado y con su forma');
select pg_temp.assert_true(
  (select jsonb_object_agg(value->>0, value->1) from jsonb_array_elements(pg_temp.catalog_snapshot()->'client_users_not_null'))
  = (select jsonb_object_agg(value->>0, case when value->>0 in ('email', 'invited_at') then 'false'::jsonb else value->1 end)
       from jsonb_array_elements((select catalog from before_migration)->'client_users_not_null')),
  'Sólo email e invited_at dejan de ser NOT NULL');
select pg_temp.assert_true(
  exists (select from pg_proc p where p.oid = 'public.erase_revoked_portal_access_data(integer,boolean)'::regprocedure
    and p.prosecdef and p.provolatile = 'v' and p.proconfig = array['search_path=""']::text[]
    and p.prorettype = 'jsonb'::regtype
    and has_function_privilege('service_role', p.oid, 'EXECUTE')
    and not has_function_privilege('anon', p.oid, 'EXECUTE')
    and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
    and not exists (select from aclexplode(p.proacl) a where a.grantee = 0)),
  'La RPC: SECURITY DEFINER, volátil, search_path vacío, jsonb y EXECUTE sólo para service_role (sin PUBLIC)');

-- ─── 3c · Reaplicación sobre objetos propios alterados ──────────────────────
do $own_drift$
declare message text; state text; after_drift jsonb;
  migration text := pg_read_file('/sb/migrations/0460_retencion_vinculo_portal_revocado.sql');
begin
  -- Sin el CHECK pero con las columnas anulables: drift, aborta.
  begin
    execute 'alter table public.client_users drop constraint client_users_erased_only_when_revoked';
    after_drift := pg_temp.catalog_snapshot();
    begin execute migration;
    exception when others then
      get stacked diagnostics message = message_text, state = returned_sqlstate;
    end;
    if state is distinct from 'P0001' or message not like '0460 abortada: email o invited_at ya admiten NULL%'
       or after_drift <> pg_temp.catalog_snapshot() then
      raise exception 'TEST 0460: reaplicar sin el CHECK no abortó en el preflight: % / %', state, message;
    end if;
    raise exception using errcode = 'PT460', message = 'rollback drift propio';
  exception when sqlstate 'PT460' then null;
  end;
  perform pg_temp.assert_true(true, 'Reaplicar con las columnas anulables y sin el CHECK aborta en el preflight');

  -- ACL abierta a authenticated: reaplicar la vuelve a cerrar.
  begin
    execute 'grant execute on function public.erase_revoked_portal_access_data(integer, boolean) to authenticated, anon';
    execute migration;
    if has_function_privilege('authenticated', 'public.erase_revoked_portal_access_data(integer,boolean)', 'EXECUTE')
       or has_function_privilege('anon', 'public.erase_revoked_portal_access_data(integer,boolean)', 'EXECUTE') then
      raise exception 'TEST 0460: reaplicar no cerró la ACL abierta';
    end if;
    raise exception using errcode = 'PT460', message = 'rollback reparación de ACL';
  exception when sqlstate 'PT460' then null;
  end;
  perform pg_temp.assert_true(true, 'Reaplicar cierra una ACL abierta de la RPC');
end;
$own_drift$;
select pg_temp.assert_true((select catalog from after_first) = pg_temp.catalog_snapshot()
  and (select rows from after_first) = pg_temp.rows_snapshot(),
  'Los drift de reaplicación se revierten enteros');

-- ─── 2 · Estático ───────────────────────────────────────────────────────────
do $static$
declare
  f text := pg_read_file('/sb/migrations/0460_retencion_vinculo_portal_revocado.sql');
  p_lock int := position('set lock_timeout = ''5s'';' in f);
  p_stmt int := position('set statement_timeout = ''30s'';' in f);
  p_pre int := position(E'\ndo $preflight$' in f);
  p_alter int := position(E'\nalter table public.client_users\n  alter column email drop not null,\n  alter column invited_at drop not null;' in f);
  p_check int := position(E'\ndo $check$' in f);
  p_fn int := position(E'\ncreate or replace function public.erase_revoked_portal_access_data(' in f);
  p_revoke int := position(E'\nrevoke all on function public.erase_revoked_portal_access_data(integer, boolean)\n  from public, anon, authenticated, service_role;' in f);
  p_grant int := position(E'\ngrant execute on function public.erase_revoked_portal_access_data(integer, boolean) to service_role;' in f);
  p_post int := position(E'\ndo $postflight$' in f);
  p_reset_stmt int := position(E'\nreset statement_timeout;' in f);
  p_reset_lock int := position(E'\nreset lock_timeout;' in f);
  v_body text := (regexp_match(f, E'\\$function\\$(.*)\\$function\\$'))[1];
begin
  perform pg_temp.assert_true(p_lock > 0 and p_stmt > 0 and p_lock < p_pre and p_stmt < p_pre,
    'Timeouts de sesión al inicio, antes del preflight');
  perform pg_temp.assert_true(p_pre > 0 and p_alter > p_pre and p_check > p_alter and p_fn > p_check
    and p_revoke > p_fn and p_grant > p_revoke and p_post > p_grant
    and p_reset_stmt > p_post and p_reset_lock > p_reset_stmt,
    'Orden: preflight → ALTER → CHECK → RPC → revoke → grant → postflight → reset de timeouts');
  perform pg_temp.assert_true(
    (select count(*) from regexp_matches(f, '\ncreate or replace function public\.', 'g')) = 1
    and (select count(*) from regexp_matches(f, '\ncomment on function public\.', 'g')) = 1
    and (select count(*) from regexp_matches(f, '\nsecurity definer\nset search_path = ''''\n', 'g')) = 1,
    'Una sola función, comentada, SECURITY DEFINER con search_path vacío');
  perform pg_temp.assert_true(
    (select count(*) from regexp_matches(f, '\n\s*grant ', 'gi')) = 1 and p_grant > 0,
    'Un solo GRANT: EXECUTE de la RPC a service_role');
  perform pg_temp.assert_true(
    f !~* '\n\s*(insert|delete|merge|truncate|copy|drop|lock|create (policy|table|index|trigger|or replace trigger))\s',
    'Sin INSERT, DELETE, DROP, policies, tablas, índices, triggers ni locks explícitos');
  perform pg_temp.assert_true(
    strpos(v_body, 'for update of cu skip locked') > 0 and strpos(v_body, 'limit p_limit') > 0
    and strpos(v_body, 'order by coalesce(cu.revoked_at, cu.updated_at), cu.id') > 0
    and (select count(*) from regexp_matches(v_body, 'cu\.status = ''revoked''', 'g')) = 2
    and strpos(v_body, 'where id = r.id and status = ''revoked'';') > 0,
    'La RPC bloquea con SKIP LOCKED, respeta el tope, ordena por antigüedad y sólo toca filas revoked');
  perform pg_temp.assert_true(f like E'%\ndo $preflight$%\nend;\n$preflight$;\n%'
    and f like E'%\ndo $check$%\nend;\n$check$;\n%'
    and f like E'%\ndo $postflight$%\nend;\n$postflight$;\n%',
    'Preflight, CHECK y postflight son bloques do cerrados');
end;
$static$;

-- ─── 5 · Comportamiento ─────────────────────────────────────────────────────
-- Sólo service_role ejecuta; los parámetros se validan.
select pg_temp.assert_true(
  pg_temp.erase_state('anon', 10, true) = '42501'
  and pg_temp.erase_state('authenticated', 10, true) = '42501'
  and pg_temp.erase_state('service_role', 10, true) is null,
  'anon y authenticated no ejecutan la RPC; service_role sí');
select pg_temp.assert_true(
  pg_temp.erase_state('service_role', 0, false) = '22023'
  and pg_temp.erase_state('service_role', 1001, false) = '22023'
  and pg_temp.erase_state('service_role', null, false) = '22023'
  and pg_temp.erase_state('service_role', 10, null) = '22023'
  and (select rows from before_migration) = pg_temp.rows_snapshot(),
  'Tope fuera de 1..1000, tope NULL o dry run NULL: 22023 sin tocar nada');

-- Dry run: cuenta sin cambiar filas ni escribir eventos.
do $dry$
declare v jsonb := pg_temp.erase(200, true);
begin
  perform pg_temp.assert_true(
    (v->>'dry_run')::boolean and (v->>'retention_days')::int = 30
    and (v->>'cutoff')::timestamptz = now() - interval '30 days'
    and (v->>'eligible')::int = 4 and (v->>'held')::int = 3
    and (v->>'erased')::int = 0 and (v->>'remaining')::int = 4 and (v->>'limit')::int = 200,
    'Dry run: 4 elegibles (31, 40, 45 y 50 días), 3 retenidos por hold, 0 borrados: ' || v::text);
  perform pg_temp.assert_true((select rows from before_migration) = pg_temp.rows_snapshot(),
    'El dry run no toca filas ni escribe eventos');
end;
$dry$;

-- Un hold de tipo (client) sobre el tenant A retiene todo A; el de tenant, todo B.
savepoint type_hold;
insert into public.audit_legal_holds (id, tenant_id, scope_type, entity_type, entity_id, reason, reference, created_by)
values (pg_temp.fixture_id('hold-type'), pg_temp.fixture_id('tenant-A'), 'entity_type', 'client', null,
  'Auditoría sintética de clientes', 'REF-0460-6', pg_temp.fixture_id('team-A'));
insert into public.audit_legal_hold_events (hold_id, tenant_id, event_type, reason, actor_id)
values (pg_temp.fixture_id('hold-type'), pg_temp.fixture_id('tenant-A'), 'active', 'Evento sintético del hold',
  pg_temp.fixture_id('team-A'));
do $type_hold$
declare v jsonb := pg_temp.erase(200, false);
begin
  perform pg_temp.assert_true((v->>'eligible')::int = 0 and (v->>'held')::int = 7 and (v->>'erased')::int = 0
    and pg_temp.erased_events('c-rev31') = 0 and (pg_temp.binding('c-rev31')).email is not null,
    'Un hold de tipo client en A retiene los 6 candidatos de A, más el de B por su hold de tenant: ' || v::text);
end;
$type_hold$;
-- Con liberación pedida el hold sigue reteniendo.
insert into public.audit_legal_hold_events (hold_id, tenant_id, event_type, reason, actor_id)
values (pg_temp.fixture_id('hold-type'), pg_temp.fixture_id('tenant-A'), 'release_requested',
  'Liberación sintética pedida', pg_temp.fixture_id('team-A'));
select pg_temp.assert_true((pg_temp.erase(200, true)->>'held')::int = 7,
  'Un hold con liberación pedida sigue reteniendo');
rollback to type_hold;
release type_hold;

-- Atomicidad: si el writer rechaza el evento, no se borra nada.
savepoint atomic_probe;
update public.audit_entity_types set status = 'deprecated', deprecated_at = now() where entity_type = 'portal_invitation';
select pg_temp.assert_true(
  pg_temp.erase_state('service_role', 200, false) = '23503'
  and (pg_temp.binding('c-rev31')).email is not null and (pg_temp.binding('c-released')).email is not null
  and pg_temp.erased_events('c-rev31') = 0,
  'Con el tipo portal_invitation inactivo la corrida falla entera: ni datos borrados ni eventos');
rollback to atomic_probe;
release atomic_probe;

create temporary table rows_pre_erase as
  select client_id, to_jsonb(cu) as fila from public.client_users cu;
create temporary table status_events_pre as select pg_temp.status_events() as n;

-- Un motivo de auditoría del caller no se hereda y se restaura al terminar.
select set_config('dtd.audit_reason', 'Motivo heredado del caller, ajeno', true);

-- Primera corrida con tope 2: los dos más antiguos (50 y 45 días).
do $first$
declare v jsonb := pg_temp.erase(2, false);
begin
  perform pg_temp.assert_true(not (v->>'dry_run')::boolean
    and (v->>'eligible')::int = 4 and (v->>'held')::int = 3
    and (v->>'erased')::int = 2 and (v->>'remaining')::int = 2,
    'Tope 2: borra 2 de 4 y deja 2 pendientes: ' || v::text);
  perform pg_temp.assert_true(pg_temp.erased_events('c-released') = 1 and pg_temp.erased_events('c-deleted') = 1
    and pg_temp.erased_events('c-legacy') = 0 and pg_temp.erased_events('c-rev31') = 0
    and (pg_temp.binding('c-legacy')).email is not null and (pg_temp.binding('c-rev31')).email is not null,
    'Con tope, primero los más antiguos: el de 50 días (hold liberado) y el del cliente borrado (45)');
end;
$first$;
select pg_temp.assert_true(current_setting('dtd.audit_reason', true) = 'Motivo heredado del caller, ajeno',
  'La RPC restaura el motivo de auditoría del caller');

-- Segunda corrida: los dos restantes. Tercera: nada, sin eventos nuevos.
do $second$
declare v jsonb := pg_temp.erase(200, false); v3 jsonb; n_audit bigint;
begin
  perform pg_temp.assert_true((v->>'eligible')::int = 2 and (v->>'erased')::int = 2
    and (v->>'remaining')::int = 0 and (v->>'held')::int = 3,
    'Segunda corrida: borra los 2 restantes (40 y 31 días): ' || v::text);
  n_audit := pg_temp.audit_rows();
  v3 := pg_temp.erase(200, false);
  perform pg_temp.assert_true((v3->>'eligible')::int = 0 and (v3->>'erased')::int = 0
    and (v3->>'held')::int = 3 and pg_temp.audit_rows() = n_audit,
    'Tercera corrida: nada elegible y ningún evento nuevo (idempotente): ' || v3::text);
end;
$second$;
-- Una fila borrada hace más de 30 días (updated_at viejo) no vuelve a entrar:
-- sin datos que borrar no es elegible, y la corrida diaria no repite su evento.
alter table public.client_users disable trigger client_users_touch;
update public.client_users set updated_at = now() - interval '40 days'
 where client_id in (pg_temp.fixture_id('c-rev31'), pg_temp.fixture_id('c-legacy'));
alter table public.client_users enable trigger client_users_touch;
do $old_tombstone$
declare n_audit bigint := pg_temp.audit_rows(); v jsonb := pg_temp.erase(200, false);
begin
  perform pg_temp.assert_true((v->>'eligible')::int = 0 and (v->>'erased')::int = 0
    and pg_temp.audit_rows() = n_audit
    and pg_temp.erased_events('c-rev31') = 1 and pg_temp.erased_events('c-legacy') = 1,
    'Una fila ya borrada con updated_at de 40 días no es elegible ni repite su evento: ' || v::text);
end;
$old_tombstone$;
select set_config('dtd.audit_reason', '', true);

-- Las filas borradas: sin correo, fechas ni identidad; el resto de la fila intacto.
do $erased_rows$
declare c text; b public.client_users; pre jsonb;
begin
  foreach c in array array['c-rev31', 'c-legacy', 'c-deleted', 'c-released'] loop
    b := pg_temp.binding(c);
    pre := (select fila from rows_pre_erase where client_id = pg_temp.fixture_id(c));
    perform pg_temp.assert_true(
      b.status = 'revoked' and b.email is null and b.invited_at is null and b.bound_at is null
      and b.last_login_at is null and b.revoked_at is null and b.last_email_invite_at is null
      and b.last_whatsapp_invite_at is null and b.auth_user_id is null and b.token is null,
      c || ': queda revoked sin correo, fechas, identidad ni token');
    perform pg_temp.assert_true(
      b.id::text = pre->>'id' and b.tenant_id::text = pre->>'tenant_id' and b.client_id::text = pre->>'client_id'
      and b.invited_by::text = pre->>'invited_by' and b.created_at = (pre->>'created_at')::timestamptz
      and b.email_invite_count = (pre->>'email_invite_count')::int
      and b.whatsapp_invite_count = (pre->>'whatsapp_invite_count')::int
      and b.last_email_invite_by::text is not distinct from pre->>'last_email_invite_by'
      and b.last_whatsapp_invite_by::text is not distinct from pre->>'last_whatsapp_invite_by',
      c || ': conserva id, tenant, cliente, quién invitó, created_at y contadores');
  end loop;
end;
$erased_rows$;

-- Una fila invited o active nunca entra, tampoco una revocada hace 29 días, una
-- revocada sin fecha con updated_at reciente ni una retenida por hold.
select pg_temp.assert_true(
  not exists (
    select 1 from rows_pre_erase r
    join public.client_users cu on cu.client_id = r.client_id
    where r.client_id in (select pg_temp.fixture_id(c) from unnest(array[
      'c-active', 'c-invited', 'c-rev29', 'c-legacy-recent', 'c-held-client', 'c-held-portal', 'c-held-tenant']) c)
      and to_jsonb(cu) <> r.fila
  )
  and (select count(*) from rows_pre_erase) = 11
  and pg_temp.erased_events('c-active') = 0 and pg_temp.erased_events('c-invited') = 0
  and pg_temp.erased_events('c-rev29') = 0 and pg_temp.erased_events('c-legacy-recent') = 0,
  'Active, invited, revocada hace 29 días, legado reciente y retenidas: filas idénticas y sin evento');

-- Un evento por fila borrada, sin PII, sin D5 de status.
do $events$
declare c text; e public.entity_audit_log;
begin
  foreach c in array array['c-rev31', 'c-legacy', 'c-deleted', 'c-released'] loop
    perform pg_temp.assert_true(pg_temp.erased_events(c) = 1, c || ': exactamente un evento de borrado');
    e := pg_temp.erased_event(c);
    perform pg_temp.assert_true(
      e.tenant_id = pg_temp.fixture_id('tenant-A') and e.entity_id = pg_temp.fixture_id(c)
      and e.actor_type = 'system' and e.actor_id is null and e.source = 'job' and e.result = 'succeeded'
      and e.sensitivity = 'restricted'
      and e.reason = 'Retención de 30 días cumplida: se borran el correo y las fechas del vínculo del Portal revocado (SDD-0477).'
      and e.before_data->>'status' = 'revoked' and (e.before_data->>'email_present')::boolean
      and e.after_data = jsonb_build_object('status', 'revoked', 'email_present', false,
            'identity_present', false, 'dates_present', '[]'::jsonb)
      and e.payload->>'mp01' = 'minimizacion_pii' and (e.payload->>'retention_days')::int = 30
      and e.payload->>'sdd' = '0477' and e.correlation_id like 'sdd0477:erase:%',
      c || ': evento system/job con motivo, sensibilidad restringida y antes/después sin valores');
    perform pg_temp.assert_true(to_jsonb(e)::text !~ '@|example\.invalid|tok-',
      c || ': el evento no copia correo, dominio ni token');
  end loop;
  perform pg_temp.assert_true((pg_temp.erased_event('c-legacy')).payload->>'retention_basis' = 'updated_at'
    and ((pg_temp.erased_event('c-legacy')).before_data->>'identity_present')::boolean
    and (pg_temp.erased_event('c-rev31')).payload->>'retention_basis' = 'revoked_at'
    and not ((pg_temp.erased_event('c-rev31')).before_data->>'identity_present')::boolean
    and (pg_temp.erased_event('c-rev31')).before_data->'dates_present'
        = '["invited_at", "bound_at", "last_login_at", "revoked_at", "last_email_invite_at", "last_whatsapp_invite_at"]'::jsonb,
    'El evento dice la base del plazo, si había identidad y qué fechas se borraron');
  perform pg_temp.assert_true(pg_temp.status_events() = (select n from status_events_pre),
    'Borrar datos no cambia el status: ningún portal_access_status_changed nuevo');
end;
$events$;

-- Liberar el hold del cliente: la corrida siguiente lo borra.
insert into public.audit_legal_hold_events (hold_id, tenant_id, event_type, reason, actor_id)
values (pg_temp.fixture_id('hold-client'), pg_temp.fixture_id('tenant-A'), 'released',
  'Liberación sintética aprobada', pg_temp.fixture_id('team-A'));
do $released$
declare v jsonb := pg_temp.erase(200, false);
begin
  perform pg_temp.assert_true((v->>'erased')::int = 1 and (v->>'held')::int = 2
    and pg_temp.erased_events('c-held-client') = 1 and (pg_temp.binding('c-held-client')).email is null
    and (pg_temp.binding('c-held-portal')).email is not null and (pg_temp.binding('c-held-tenant')).email is not null,
    'Liberado el hold del cliente, se borra; los de portal_invitation y de tenant siguen reteniendo: ' || v::text);
end;
$released$;

-- El equipo sigue leyendo la fila como revoked (tarjeta «Revocado» del Studio).
do $team_read$
declare v_status text; v_email text; v_invited timestamptz;
begin
  perform pg_temp.as_principal('team-A');
  execute 'set local role authenticated';
  select status, email, invited_at into v_status, v_email, v_invited
    from public.client_users where client_id = pg_temp.fixture_id('c-rev31');
  execute 'reset role';
  perform pg_temp.assert_true(v_status = 'revoked' and v_email is null and v_invited is null,
    'El equipo del tenant lee el vínculo borrado como revoked, sin correo ni fecha');
end;
$team_read$;

-- El CHECK: una fila viva no puede quedar sin correo ni fecha de invitación.
select pg_temp.assert_true(
  pg_temp.stmt_state($s$update public.client_users set email = null where client_id = pg_temp.fixture_id('c-invited')$s$) = '23514'
  and pg_temp.stmt_state($s$update public.client_users set invited_at = null where client_id = pg_temp.fixture_id('c-active')$s$) = '23514'
  and pg_temp.stmt_state($s$update public.client_users set status = 'active', auth_user_id = null where client_id = pg_temp.fixture_id('c-rev31')$s$) = '23514'
  and pg_temp.stmt_state($s$update public.client_users set email = null where client_id = pg_temp.fixture_id('c-rev29')$s$) is null,
  'El CHECK rechaza vaciar o reactivar sin datos una fila viva (23514) y permite vaciar una revocada');

-- Volver a invitar la fila borrada funciona como con cualquier revocada.
do $reinvite$
declare n_status bigint := pg_temp.status_events(); b public.client_users; v jsonb;
begin
  perform pg_temp.as_principal('team-A');
  execute 'set local role authenticated';
  perform * from public.portal_invite_client(pg_temp.fixture_id('c-rev31'));
  execute 'reset role';
  b := pg_temp.binding('c-rev31');
  perform pg_temp.assert_true(b.status = 'invited' and b.email = 'revtreintayuno@example.invalid'
    and b.invited_at = now() and b.revoked_at is null and b.token is not null
    and pg_temp.status_events() = n_status + 1,
    'portal_invite_client reinvita la fila borrada: invited, con correo y fecha, y D5 registra el cambio');
  perform pg_temp.as_principal('team-A');
  execute 'set local role authenticated';
  perform public.portal_revoke_client(pg_temp.fixture_id('c-rev31'));
  execute 'reset role';
  v := pg_temp.erase(200, true);
  perform pg_temp.assert_true((pg_temp.binding('c-rev31')).status = 'revoked'
    and (pg_temp.binding('c-rev31')).email is not null and (v->>'eligible')::int = 0,
    'Revocada otra vez hoy, conserva su correo: el plazo vuelve a empezar');
end;
$reinvite$;
\endif

do $done$
begin
  raise notice 'TEST 0460 OK: % aserciones', (select count(*) from pg_temp.assertions);
end;
$done$;

rollback;
