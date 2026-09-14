\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0454 (SDD-0467): borrar un cliente revoca su
-- acceso al Portal en el mismo acto. Fixtures ficticios y rollback: nunca
-- consulta ni modifica una base alojada.
-- Aplica las migraciones REALES 0006, 0080, 0081, 0230, 0360 y 0361 (con
-- assert_tenant_match de 0012 y assert_studio_role de 0351 extraídas del
-- archivo), la plataforma de auditoría 0258/0261/0267/0294 y la función D5
-- de 0293 extraída del archivo, y toma get_user_tenant_id() de 0453 (la forma
-- vigente) y current_studio_role() de 0200.
--
-- RED: psql -v apply_fix=false. GREEN (predeterminado): aplica la 0454 real.
--
-- Lo que defiende:
--   1. RED, sin 0454: el borrado del Studio deja el vínculo activo y el código
--      corto sin revocar; portal_bind_session() activa la invitación de un
--      cliente borrado; merge_clients deja al duplicado con auth_user_id y la
--      persona no puede vincularse a otra ficha.
--   2. Estático: timeouts antes del preflight; preflight → funciones → triggers
--      → backfill → postflight → reset; dos funciones SECURITY DEFINER con
--      search_path vacío, sin GRANT, sin policies, tablas ni ALTER.
--   3. Drift: merge_clients que retira antes de mudar, sin SECURITY DEFINER o
--      ausente; portal_bind_session con otra forma; columna, RLS o CHECK de
--      status ausentes; D5 vivo con el tipo portal_invitation inactivo; trigger
--      ajeno con el nombre de la migración: P0001 en el preflight, sin ids ni
--      Shipping Marks, y catálogo intacto. El postflight rechaza una huella
--      distinta y un vínculo vigente sobre un cliente borrado.
--   4. Aplicada: timeouts restaurados, catálogo dependiente intacto, backfill
--      de los clientes ya borrados (activo, invitado, revocado incompleto y sus
--      códigos) con evento D5 de sistema y motivo; reaplicar no cambia nada.
--   5. Comportamiento: borrado del Studio por RLS (invited y active, códigos
--      abiertos y usados, auditoría con el actor), aislamiento entre tenants con
--      el mismo Shipping Mark, bind y canje rechazados, restaurar no devuelve
--      el acceso y una invitación nueva sí, guardas en INSERT y UPDATE, fallo
--      atómico, y los dos caminos de merge_clients.

\if :{?apply_fix}
\else
\set apply_fix true
\endif

begin;

do $guard$
begin
  if to_regclass('public.clients') is not null or to_regnamespace('auth') is not null then
    raise exception 'TEST 0454 requiere una base desechable vacía';
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

-- Plataforma de auditoría real y el trigger D5 de client_users (0293).
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
values ('portal_invitation', 'active', 'access', 1, 'migration:0293');
do $d5$
begin
  execute (regexp_match(pg_read_file('/sb/migrations/0293_audit_d5_residual_and_writer_retirement.sql'),
    'create function public\.audit_d5_residual_change\(\).*?\n\$function\$;'))[1];
end;
$d5$;
revoke all on function public.audit_d5_residual_change() from public, anon, authenticated;
create trigger audit_d5_client_users after insert or update of status on public.client_users
  for each row execute function public.audit_d5_residual_change();

-- ─── Utilidades ─────────────────────────────────────────────────────────────
create function pg_temp.fixture_id(label text) returns uuid language sql immutable as $$
  select md5('0454-synthetic-' || label)::uuid
$$;
create temporary table assertions (label text primary key);
create temporary sequence assertion_count;
grant insert, select on assertions to authenticated, service_role;
grant usage on sequence assertion_count to authenticated, service_role;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'TEST 0454: %', label; end if;
  insert into pg_temp.assertions values (label);
  perform nextval('pg_temp.assertion_count');
end;
$$;
create function pg_temp.as_principal(label text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', case when label = '' then '' else pg_temp.fixture_id(label)::text end, true)
$$;
grant execute on function pg_temp.fixture_id(text), pg_temp.assert_true(boolean, text), pg_temp.as_principal(text)
  to authenticated, service_role;
-- Estado de acceso de un cliente: vínculos y códigos. VOLATILE a propósito: una
-- función STABLE reusa la instantánea de la sentencia que la llama y no vería lo
-- que acaba de escribir un helper volátil (borrar, vincular, fusionar) en la
-- misma aserción.
create function pg_temp.binding(p_client text) returns public.client_users language sql volatile as $$
  select * from public.client_users where client_id = pg_temp.fixture_id(p_client)
$$;
create function pg_temp.fully_revoked(p_client text) returns boolean language sql volatile as $$
  select count(*) > 0 and bool_and(status = 'revoked' and revoked_at is not null and auth_user_id is null and token is null)
  from public.client_users where client_id = pg_temp.fixture_id(p_client)
$$;
create function pg_temp.open_links(p_client text) returns bigint language sql volatile as $$
  select count(*) from public.portal_access_links where client_id = pg_temp.fixture_id(p_client) and revoked_at is null
$$;
create function pg_temp.bad_rows() returns bigint language sql volatile as $$
  select (select count(*) from public.client_users cu join public.clients c on c.id = cu.client_id
           where c.deleted_at is not null
             and (cu.status <> 'revoked' or cu.revoked_at is null or cu.auth_user_id is not null or cu.token is not null))
       + (select count(*) from public.portal_access_links l join public.clients c on c.id = l.client_id
           where c.deleted_at is not null and l.revoked_at is null)
$$;
-- Borrado del Studio: UPDATE directo por RLS con la sesión del operador, como
-- softDeleteClientAction (sin RETURNING).
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
create function pg_temp.bind_as(p_actor text) returns boolean language plpgsql as $$
declare v_bound boolean;
begin
  perform pg_temp.as_principal(p_actor);
  execute 'set local role authenticated';
  select bound into v_bound from public.portal_bind_session();
  execute 'reset role';
  return coalesce(v_bound, false);
end;
$$;
create function pg_temp.invite_as(p_actor text, p_client text) returns text language plpgsql as $$
declare v_token text;
begin
  perform pg_temp.as_principal(p_actor);
  execute 'set local role authenticated';
  select claim_token into v_token from public.portal_invite_client(pg_temp.fixture_id(p_client));
  execute 'reset role';
  return v_token;
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
  'team-A', 'team-A-ops', 'team-B',
  'p-active', 'p-invited', 'p-B', 'p-orphan1', 'p-orphan3', 'p-dup1', 'p-surv2', 'p-dup2', 'p-fail'
]) v;
insert into public.user_tenants (user_id, tenant_id, role)
select pg_temp.fixture_id(actor), pg_temp.fixture_id(tenant), role
from (values ('team-A', 'tenant-A', 'admin'), ('team-A-ops', 'tenant-A', 'operations'), ('team-B', 'tenant-B', 'admin'))
  v(actor, tenant, role);
insert into public.clients (id, tenant_id, markbox, name, email)
select pg_temp.fixture_id(label), pg_temp.fixture_id(tenant), markbox, label, email
from (values
  ('c-active', 'tenant-A', 'ACTIVE', 'p-active@example.invalid'),
  ('c-B', 'tenant-B', 'ACTIVE', 'p-B@example.invalid'),       -- mismo Shipping Mark, otro tenant
  ('c-invited', 'tenant-A', 'INVITED', 'p-invited@example.invalid'),
  ('c-orphan-active', 'tenant-A', 'ORPHAN1', null),
  ('c-orphan-invited', 'tenant-A', 'ORPHAN2', null),
  ('c-orphan-partial', 'tenant-A', 'ORPHAN3', null),
  ('c-surv1', 'tenant-A', 'SURV1', null), ('c-dup1', 'tenant-A', 'DUP1', null),
  ('c-surv2', 'tenant-A', 'SURV2', null), ('c-dup2', 'tenant-A', 'DUP2', null),
  ('c-other', 'tenant-A', 'OTHER', 'p-dup2@example.invalid'),
  ('c-fail', 'tenant-A', 'FAIL', null),
  ('c-ghost', 'tenant-A', 'GHOST', 'ghost@example.invalid')
) v(label, tenant, markbox, email);
insert into public.client_users (tenant_id, client_id, email, auth_user_id, token, status, bound_at)
select pg_temp.fixture_id(tenant), pg_temp.fixture_id(client), email,
  case when actor is null then null else pg_temp.fixture_id(actor) end, token, status,
  case when status = 'active' then now() end
from (values
  ('tenant-A', 'c-active', 'p-active@example.invalid', 'p-active', null, 'active'),
  ('tenant-B', 'c-B', 'p-B@example.invalid', 'p-B', null, 'active'),
  ('tenant-A', 'c-invited', 'p-invited@example.invalid', null, 'tok-invited', 'invited'),
  ('tenant-A', 'c-orphan-active', 'p-orphan1@example.invalid', 'p-orphan1', null, 'active'),
  ('tenant-A', 'c-orphan-invited', 'orphan2@example.invalid', null, 'tok-orphan2', 'invited'),
  -- Lo que deja merge_clients en main: revocado sin revoked_at, con identidad y token.
  ('tenant-A', 'c-orphan-partial', 'p-orphan3@example.invalid', 'p-orphan3', 'tok-orphan3', 'revoked'),
  ('tenant-A', 'c-dup1', 'p-dup1@example.invalid', 'p-dup1', null, 'active'),
  ('tenant-A', 'c-surv2', 'p-surv2@example.invalid', 'p-surv2', null, 'active'),
  ('tenant-A', 'c-dup2', 'p-dup2@example.invalid', 'p-dup2', null, 'active'),
  ('tenant-A', 'c-fail', 'p-fail@example.invalid', 'p-fail', null, 'active')
) v(tenant, client, email, actor, token, status);
insert into public.portal_access_links (tenant_id, client_id, code, expires_at, used_at)
select pg_temp.fixture_id(tenant), pg_temp.fixture_id(client), code, now() + expires, case when used then now() end
from (values
  ('tenant-A', 'c-active', 'LINKACTIVE01', interval '72 hours', false),
  ('tenant-A', 'c-active', 'LINKACTIVE02', interval '72 hours', true),
  ('tenant-B', 'c-B', 'LINKBBBBBB01', interval '72 hours', false),
  ('tenant-A', 'c-invited', 'LINKINVITE01', interval '72 hours', false),
  ('tenant-A', 'c-orphan-active', 'LINKORPHAN01', interval '72 hours', false),
  ('tenant-A', 'c-orphan-invited', 'LINKORPHAN02', interval '-1 hours', false),
  ('tenant-A', 'c-surv1', 'LINKSURV1001', interval '72 hours', false),
  ('tenant-A', 'c-dup1', 'LINKDUP10001', interval '72 hours', false),
  ('tenant-A', 'c-surv2', 'LINKSURV2001', interval '72 hours', false),
  ('tenant-A', 'c-dup2', 'LINKDUP20001', interval '72 hours', false),
  ('tenant-A', 'c-fail', 'LINKFAIL0001', interval '72 hours', false)
) v(tenant, client, code, expires, used);
-- Clientes ya borrados antes de la migración: el caso del backfill.
update public.clients set deleted_at = now() - interval '1 day'
where id in (pg_temp.fixture_id('c-orphan-active'), pg_temp.fixture_id('c-orphan-invited'),
             pg_temp.fixture_id('c-orphan-partial'), pg_temp.fixture_id('c-ghost'));

do $fixture_check$
begin
  if pg_temp.bad_rows() <> 5
     or (select count(*) from public.entity_audit_log where event_type = 'portal_access_invited') <> 10
     or not exists (select from pg_constraint where conname = 'client_users_auth_user_id_key') then
    raise exception 'TEST 0454: el fixture no quedó armado (bad_rows=%)', pg_temp.bad_rows();
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
declare v_row public.client_users; v_blocked boolean := false;
begin
  if pg_temp.studio_soft_delete('team-A', 'ACTIVE') <> 1 then
    raise exception 'TEST 0454 baseline: el borrado del Studio por RLS no borró exactamente un cliente';
  end if;
  v_row := pg_temp.binding('c-active');
  if v_row.status <> 'active' or v_row.auth_user_id is null or pg_temp.open_links('c-active') <> 2 then
    raise exception 'TEST 0454 baseline no reproduce el vínculo vigente tras el borrado';
  end if;
  raise notice 'TEST 0454 RED baseline: tras el borrado del Studio el vínculo sigue % y quedan % código(s) sin revocar',
    v_row.status, pg_temp.open_links('c-active');

  perform pg_temp.studio_soft_delete('team-A', 'INVITED');
  insert into auth.users (id, email) values (pg_temp.fixture_id('p-invited-login'), 'p-invited@example.invalid')
    on conflict do nothing;
  if not pg_temp.bind_as('p-invited') or (pg_temp.binding('c-invited')).status <> 'active' then
    raise exception 'TEST 0454 baseline no reproduce la activación de una invitación de cliente borrado';
  end if;
  raise notice 'TEST 0454 RED baseline: portal_bind_session() activó la invitación de un cliente borrado';

  perform pg_temp.merge_as('team-A-ops', 'c-surv2', 'c-dup2');
  v_row := pg_temp.binding('c-dup2');
  if v_row.status <> 'revoked' or v_row.revoked_at is not null or v_row.auth_user_id is null
     or pg_temp.open_links('c-dup2') <> 1 then
    raise exception 'TEST 0454 baseline no reproduce el duplicado revocado a medias por merge_clients';
  end if;
  perform pg_temp.invite_as('team-A', 'c-other');
  begin
    perform pg_temp.bind_as('p-dup2');
  exception when unique_violation then v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'TEST 0454 baseline no reproduce el bloqueo de unique (auth_user_id)';
  end if;
  raise notice 'TEST 0454 RED baseline: merge_clients dejó el duplicado sin revoked_at, con identidad y su código; la persona no pudo vincularse a otra ficha';
end;
$red$;
rollback to red_probe;
release red_probe;
select pg_temp.assert_true((select rows from before_migration) = pg_temp.rows_snapshot(),
  'La sonda RED no dejó filas');

\if :apply_fix
-- ─── 3 · Drift: el preflight falla cerrado y no toca nada ───────────────────
create function public.fixture_0454_noop() returns trigger language plpgsql as $$ begin return null; end $$;
do $drift$
declare drift text; failed boolean; message text; state text; after_drift jsonb;
  migration text := pg_read_file('/sb/migrations/0454_borrar_cliente_revoca_portal.sql');
begin
  foreach drift in array array[
    -- merge_clients que retira la ficha ANTES de mudar o revocar el acceso.
    $d$create or replace function public.merge_clients(p_survivor_id uuid, p_merged_id uuid) returns jsonb language plpgsql security definer set search_path = public as $f$
declare s public.clients; m public.clients;
begin
  update public.clients set merged_into_client_id = s.id, deleted_at = now() where id = m.id;
  if exists (select 1 from public.client_users where client_id = m.id) then
    update public.client_users set status = 'revoked' where client_id = m.id;
    update public.client_users set client_id = s.id where client_id = m.id;
  end if;
  return null;
end $f$$d$,
    'alter function public.merge_clients(uuid, uuid) security invoker',
    'drop function public.merge_clients(uuid, uuid)',
    $d$create or replace function public.portal_bind_session() returns table (client_id uuid, bound boolean) language plpgsql security definer set search_path = public as $f$
begin
  update public.client_users set auth_user_id = auth.uid(), status = 'active' where status in ('invited', 'revoked');
  return query select null::uuid, true;
end $f$$d$,
    'alter table public.client_users rename column revoked_at to fixture_0454_revoked',
    'alter table public.clients rename column deleted_at to fixture_0454_deleted',
    'alter table public.portal_access_links disable row level security',
    'alter table public.client_users drop constraint client_users_status_check',
    $d$update public.audit_entity_types set status = 'deprecated', deprecated_at = now() where entity_type = 'portal_invitation'$d$,
    'create trigger clients_revoke_portal_on_soft_delete after update on public.clients for each row execute function public.fixture_0454_noop()'
  ] loop
    failed := false;
    begin
      execute drift;
      after_drift := pg_temp.catalog_snapshot();
      begin execute migration;
      exception when others then
        get stacked diagnostics message = message_text, state = returned_sqlstate;
        if state <> 'P0001' or (message not like '0454 requiere%' and message not like '0454 abortada%') then
          raise exception 'TEST 0454: drift no falló en preflight: % / % (%)', state, message, left(drift, 80);
        end if;
        if message ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
           or message ~ 'ACTIVE|INVITED|ORPHAN|SURV|DUP|OTHER|FAIL|GHOST' then
          raise exception 'TEST 0454: el mensaje del preflight expone ids o Shipping Marks: %', message;
        end if;
        failed := true;
      end;
      if not failed or after_drift <> pg_temp.catalog_snapshot() then
        raise exception 'TEST 0454: preflight aceptó drift o alteró catálogo: %', left(drift, 80);
      end if;
      raise exception using errcode = 'PT454', message = 'rollback drift sintético';
    exception when sqlstate 'PT454' then null;
    end;
    perform pg_temp.assert_true(true, 'Drift rechazado en el preflight sin tocar el catálogo: ' || left(drift, 60));
  end loop;
end;
$drift$;
drop function public.fixture_0454_noop();
select pg_temp.assert_true((select catalog from before_migration) = pg_temp.catalog_snapshot()
  and (select rows from before_migration) = pg_temp.rows_snapshot(),
  'Los drift se revierten enteros');

-- La forma de merge_clients de 0341 y 0358 también muda antes de retirar: el
-- preflight las acepta (en producción corre la de 0361).
do $merge_forms$
declare v_file text; v_stmt text;
begin
  foreach v_file in array array['0341_client_merge_duplicados.sql', '0358_merge_clients_exige_rol.sql'] loop
    v_stmt := (regexp_match(pg_read_file('/sb/migrations/' || v_file),
      'create or replace function public\.merge_clients\(p_survivor_id uuid, p_merged_id uuid\).*?\n\$\$;'))[1];
    if v_stmt is null then raise exception 'TEST 0454: no se pudo extraer merge_clients de %', v_file; end if;
    begin
      execute v_stmt;
      execute (regexp_match(pg_read_file('/sb/migrations/0454_borrar_cliente_revoca_portal.sql'),
        'do \$preflight\$.*?\n\$preflight\$;'))[1];
      raise exception using errcode = 'PT454', message = 'rollback forma histórica';
    exception when sqlstate 'PT454' then null;
    end;
    perform pg_temp.assert_true(true, 'El preflight acepta merge_clients de ' || v_file);
  end loop;
end;
$merge_forms$;

-- ─── 4 · Aplicada ───────────────────────────────────────────────────────────
\ir ../migrations/0454_borrar_cliente_revoca_portal.sql
select pg_temp.assert_true(current_setting('lock_timeout') = '0' and current_setting('statement_timeout') = '0',
  'La migración restaura lock_timeout y statement_timeout de sesión');
select pg_temp.assert_true(coalesce(current_setting('dtd.huella_0454', true), '') = ''
  and coalesce(current_setting('dtd.audit_reason', true), '') = '',
  'La migración no deja la huella ni el motivo de auditoría en la sesión');
create temporary table after_first as select pg_temp.catalog_snapshot() as catalog, pg_temp.rows_snapshot() as rows;
\ir ../migrations/0454_borrar_cliente_revoca_portal.sql
select pg_temp.assert_true((select catalog from after_first) = pg_temp.catalog_snapshot(),
  'Reaplicar deja el catálogo idéntico: mismos oid de funciones y triggers');
select pg_temp.assert_true((select rows from after_first) = pg_temp.rows_snapshot(),
  'Reaplicar no toca filas: el backfill es idempotente y no emite eventos');

select pg_temp.assert_true(
  (select jsonb_agg(x order by x) from (
     select value as x from jsonb_array_elements((select catalog from before_migration)->'policies')
   ) s) = (select jsonb_agg(x order by x) from (select value as x from jsonb_array_elements(pg_temp.catalog_snapshot()->'policies')) s)
  and (select catalog->'tables' from before_migration) = pg_temp.catalog_snapshot()->'tables',
  'Policies, RLS y ACL de tablas idénticas a antes de la migración');
select pg_temp.assert_true(
  (select jsonb_agg(value order by value) from jsonb_array_elements((select catalog from before_migration)->'functions'))
  = (select jsonb_agg(value order by value) from jsonb_array_elements(pg_temp.catalog_snapshot()->'functions')
      where value->>1 not in ('clients_revoke_portal_access', 'portal_access_require_live_client')),
  'Ninguna función existente cambia: sólo se agregan las dos de la migración');
select pg_temp.assert_true(
  (select jsonb_agg(value order by value) from jsonb_array_elements((select catalog from before_migration)->'triggers'))
  = (select jsonb_agg(value order by value) from jsonb_array_elements(pg_temp.catalog_snapshot()->'triggers')
      where value->>2 not in ('clients_revoke_portal_on_soft_delete', 'client_users_require_live_client',
                              'portal_access_links_require_live_client')),
  'Ningún trigger existente cambia: sólo se agregan los tres de la migración');
select pg_temp.assert_true(
  (select bool_and(p.prosecdef and p.proconfig = array['search_path=""']::text[] and p.provolatile = 'v'
     and not has_function_privilege('anon', p.oid, 'EXECUTE')
     and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
     and not has_function_privilege('service_role', p.oid, 'EXECUTE'))
   from pg_proc p where p.oid in ('public.clients_revoke_portal_access()'::regprocedure,
     'public.portal_access_require_live_client()'::regprocedure)),
  'Las dos funciones: SECURITY DEFINER, search_path vacío y sin EXECUTE para anon, authenticated ni service_role');
select pg_temp.assert_true(
  regexp_replace(pg_get_triggerdef((select oid from pg_trigger where tgname = 'clients_revoke_portal_on_soft_delete')), '\s+', ' ', 'g')
    = 'CREATE TRIGGER clients_revoke_portal_on_soft_delete AFTER UPDATE ON public.clients FOR EACH ROW WHEN (((old.deleted_at IS NULL) AND (new.deleted_at IS NOT NULL))) EXECUTE FUNCTION clients_revoke_portal_access()'
  and regexp_replace(pg_get_triggerdef((select oid from pg_trigger where tgname = 'client_users_require_live_client')), '\s+', ' ', 'g')
    = 'CREATE TRIGGER client_users_require_live_client BEFORE INSERT OR UPDATE OF status, client_id ON public.client_users FOR EACH ROW WHEN ((new.status = ANY (ARRAY[''invited''::text, ''active''::text]))) EXECUTE FUNCTION portal_access_require_live_client()'
  and regexp_replace(pg_get_triggerdef((select oid from pg_trigger where tgname = 'portal_access_links_require_live_client')), '\s+', ' ', 'g')
    = 'CREATE TRIGGER portal_access_links_require_live_client BEFORE INSERT OR UPDATE OF revoked_at, client_id ON public.portal_access_links FOR EACH ROW WHEN ((new.revoked_at IS NULL)) EXECUTE FUNCTION portal_access_require_live_client()',
  'Los tres triggers quedan con su evento, momento, columnas y condición');

-- ─── 2 · Estático ───────────────────────────────────────────────────────────
do $static$
declare
  f text := pg_read_file('/sb/migrations/0454_borrar_cliente_revoca_portal.sql');
  p_lock int := position('set lock_timeout = ''5s'';' in f);
  p_stmt int := position('set statement_timeout = ''30s'';' in f);
  p_pre int := position('do $preflight$' in f);
  p_fn int := position(E'\ncreate or replace function public.' in f);
  p_trg int := position('do $triggers$' in f);
  p_back int := position('do $backfill$' in f);
  p_post int := position('do $postflight$' in f);
  p_reset_stmt int := position('reset statement_timeout;' in f);
  p_reset_lock int := position('reset lock_timeout;' in f);
begin
  perform pg_temp.assert_true(p_lock > 0 and p_stmt > 0 and p_lock < p_pre and p_stmt < p_pre,
    'Timeouts de sesión al inicio, antes del preflight');
  perform pg_temp.assert_true(p_pre > 0 and p_fn > p_pre and p_trg > p_fn and p_back > p_trg and p_post > p_back
    and p_reset_stmt > p_post and p_reset_lock > p_reset_stmt,
    'Orden: preflight → funciones → triggers → backfill → postflight → reset de timeouts');
  perform pg_temp.assert_true(
    (select count(*) from regexp_matches(f, '\ncreate or replace function public\.', 'g')) = 2
    and (select count(*) from regexp_matches(f, '\ncomment on function public\.', 'g')) = 2
    and (select count(*) from regexp_matches(f, '\nsecurity definer\nset search_path = ''''\n', 'g')) = 2
    and (select count(*) from regexp_matches(f, '\nrevoke all on function public\.[a-z_]+\(\) from public, anon, authenticated, service_role;', 'g')) = 2,
    'Exactamente dos funciones SECURITY DEFINER con search_path vacío, comentadas y sin EXECUTE para la API');
  perform pg_temp.assert_true(f !~* '\n\s*(grant|insert|delete|merge|truncate|copy|alter|drop|lock|create (policy|table|index|or replace trigger))\s',
    'Sin GRANT, INSERT, DELETE, policies, tablas, índices, locks, ALTER ni DROP');
  perform pg_temp.assert_true(
    (select count(*) from regexp_matches(f, '\n\s*create trigger ', 'g')) = 3,
    'Exactamente tres triggers creados');
  perform pg_temp.assert_true(f like E'%\ndo $preflight$%\nend;\n$preflight$;\n%'
    and f like E'%\ndo $triggers$%\nend;\n$triggers$;\n%'
    and f like E'%\ndo $backfill$%\nend;\n$backfill$;\n%'
    and f like E'%\ndo $postflight$%\nend;\n$postflight$;\n%',
    'Preflight, triggers, backfill y postflight son bloques do cerrados');
end;
$static$;

-- El postflight falla cerrado: con una huella distinta y con un vínculo vigente
-- sobre un cliente borrado (colado con la guarda deshabilitada).
do $postflight_probe$
declare message text; state text;
  v_post text := (regexp_match(pg_read_file('/sb/migrations/0454_borrar_cliente_revoca_portal.sql'),
    'do \$postflight\$.*?\n\$postflight\$;'))[1];
  v_pre text := (regexp_match(pg_read_file('/sb/migrations/0454_borrar_cliente_revoca_portal.sql'),
    'do \$preflight\$.*?\n\$preflight\$;'))[1];
begin
  begin
    perform set_config('dtd.huella_0454', 'huella-sintetica', false);
    execute v_post;
    raise exception 'TEST 0454: el postflight aceptó una huella distinta';
  exception when sqlstate 'P0001' then
    get stacked diagnostics message = message_text;
    if message not like '0454: cambió el catálogo dependiente%' then raise; end if;
  end;
  perform pg_temp.assert_true(true, 'El postflight rechaza una huella de catálogo distinta');

  begin
    execute v_pre;
    alter table public.client_users disable trigger client_users_require_live_client;
    update public.client_users set status = 'active', auth_user_id = pg_temp.fixture_id('p-orphan1')
     where client_id = pg_temp.fixture_id('c-orphan-active');
    alter table public.client_users enable trigger client_users_require_live_client;
    execute v_post;
    raise exception 'TEST 0454: el postflight aceptó un vínculo vigente sobre un cliente borrado';
  exception when sqlstate 'P0001' then
    get stacked diagnostics message = message_text, state = returned_sqlstate;
    if message not like '0454: quedaron 1 vínculo(s) y 0 código(s) corto(s) utilizables%' then raise; end if;
  end;
  perform pg_temp.assert_true(true, 'El postflight rechaza un vínculo vigente sobre un cliente borrado, con conteos agregados');
  perform set_config('dtd.huella_0454', '', false);
end;
$postflight_probe$;
select pg_temp.assert_true((select rows from after_first) = pg_temp.rows_snapshot()
  and (select catalog from after_first) = pg_temp.catalog_snapshot(),
  'Las sondas del postflight se revierten enteras');
\endif

-- ─── 5 · Comportamiento ─────────────────────────────────────────────────────
-- Backfill: los clientes que ya estaban borrados quedan sin acceso ni códigos.
select pg_temp.assert_true(pg_temp.fully_revoked('c-orphan-active') and pg_temp.fully_revoked('c-orphan-invited')
  and pg_temp.fully_revoked('c-orphan-partial'),
  'Backfill: el vínculo activo, el invitado y el revocado a medias de clientes ya borrados quedan revocados del todo');
select pg_temp.assert_true(pg_temp.open_links('c-orphan-active') = 0 and pg_temp.open_links('c-orphan-invited') = 0,
  'Backfill: los códigos cortos de clientes ya borrados quedan revocados, abiertos y vencidos');
select pg_temp.assert_true(
  (select count(*) from public.entity_audit_log where event_type = 'portal_access_status_changed'
     and actor_type = 'system' and actor_id is null
     and reason = 'Migración 0454: cliente ya borrado, acceso al Portal revocado (SDD-0467).'
     and after_data->>'status' = 'revoked') = 2
  and (select count(*) from public.entity_audit_log where event_type = 'portal_access_status_changed') = 2,
  'Backfill: un evento D5 de sistema con motivo por cada cambio de status (activo e invitado), ninguno por el revocado a medias');
select pg_temp.assert_true(pg_temp.bad_rows() = 0, 'Invariante tras la migración: nada vigente sobre un cliente borrado');
select pg_temp.assert_true(
  (pg_temp.binding('c-active')).status = 'active' and (pg_temp.binding('c-invited')).status = 'invited'
  and (pg_temp.binding('c-B')).status = 'active' and pg_temp.open_links('c-active') = 2
  and pg_temp.open_links('c-B') = 1 and pg_temp.open_links('c-surv1') = 1,
  'Los clientes vivos conservan su acceso y sus códigos');

-- Borrado del Studio por RLS: el operador de A borra «ACTIVE» de su tenant.
select pg_temp.assert_true(pg_temp.studio_soft_delete('team-A', 'ACTIVE') = 1,
  'El borrado del Studio por RLS borra exactamente el cliente del tenant del operador');
select pg_temp.assert_true(pg_temp.fully_revoked('c-active'),
  'Tras el borrado del Studio el vínculo activo queda revocado con revoked_at y sin identidad ni token');
select pg_temp.assert_true(pg_temp.open_links('c-active') = 0
  and (select count(*) from public.portal_access_links where client_id = pg_temp.fixture_id('c-active')
         and used_at is not null and revoked_at is not null) = 1,
  'Tras el borrado del Studio no queda ningún código corto sin revocar, tampoco el usado');
select pg_temp.assert_true(
  exists (select from public.entity_audit_log where event_type = 'portal_access_status_changed'
    and entity_id = pg_temp.fixture_id('c-active') and actor_type = 'user' and actor_id = pg_temp.fixture_id('team-A')
    and reason = 'Cliente borrado: acceso al Portal revocado (SDD-0467).'
    and before_data->>'status' = 'active' and after_data->>'status' = 'revoked')
  and coalesce(current_setting('dtd.audit_reason', true), '') = '',
  'El evento D5 registra al operador que borró y el motivo, y el motivo no queda en la transacción');
select pg_temp.assert_true((pg_temp.binding('c-B')).status = 'active' and (pg_temp.binding('c-B')).auth_user_id is not null
  and pg_temp.open_links('c-B') = 1,
  'Aislamiento: el cliente de otro tenant con el mismo Shipping Mark conserva su vínculo y su código');

-- Invitado: borrado y luego intento de vincular la sesión.
select pg_temp.assert_true(pg_temp.studio_soft_delete('team-A', 'INVITED') = 1 and pg_temp.fully_revoked('c-invited')
  and pg_temp.open_links('c-invited') = 0,
  'Tras borrar un cliente invitado la invitación queda revocada, sin token, y su código también');
insert into auth.users (id, email) values (pg_temp.fixture_id('p-invited-login'), 'p-invited@example.invalid');
select pg_temp.assert_true(not pg_temp.bind_as('p-invited') and (pg_temp.binding('c-invited')).status = 'revoked',
  'portal_bind_session() no activa la invitación de un cliente borrado');
select pg_temp.assert_true(not pg_temp.bind_as('p-active') and (pg_temp.binding('c-active')).auth_user_id is null,
  'portal_bind_session() no reconoce al titular de un cliente borrado');

-- Canje del código corto: el sellado atómico de consumeAccessLink no encuentra fila.
do $redeem$
declare n bigint;
begin
  update public.portal_access_links set used_at = now()
   where code = 'LINKACTIVE01' and used_at is null and revoked_at is null;
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 0, 'El código corto de un cliente borrado no se puede sellar como usado');
  update public.portal_access_links set used_at = null where code = 'LINKACTIVE02';
  perform pg_temp.assert_true(pg_temp.open_links('c-active') = 0,
    'Soltar el reclamo de un código usado (releaseAccessLink) no lo reabre');
end;
$redeem$;

-- Restaurar no devuelve el acceso; una invitación nueva sí.
update public.clients set deleted_at = null where id = pg_temp.fixture_id('c-active');
select pg_temp.assert_true(pg_temp.fully_revoked('c-active') and pg_temp.open_links('c-active') = 0,
  'Restaurar el cliente no reactiva su vínculo ni sus códigos');
select pg_temp.assert_true(not pg_temp.bind_as('p-active'),
  'Tras restaurar, la sesión del antiguo titular no se vincula sin invitación');
select pg_temp.assert_true(pg_temp.invite_as('team-A', 'c-active') is not null
  and (pg_temp.binding('c-active')).status = 'invited',
  'Una invitación nueva sobre el cliente restaurado vuelve a habilitar el acceso');
select pg_temp.assert_true(pg_temp.bind_as('p-active') and (pg_temp.binding('c-active')).status = 'active'
  and pg_temp.fully_revoked('c-active') is false,
  'Con la invitación nueva el titular se vuelve a vincular');

-- Guardas: nada vigente sobre un cliente inexistente o borrado.
do $guards$
declare v_state text;
  v_cases text[] := array[
    $c$insert into public.client_users (tenant_id, client_id, email, status) values (md5('0454-synthetic-tenant-A')::uuid, md5('0454-synthetic-c-ghost')::uuid, 'ghost@example.invalid', 'active')$c$,
    $c$insert into public.client_users (tenant_id, client_id, email, token, status) values (md5('0454-synthetic-tenant-A')::uuid, md5('0454-synthetic-c-ghost')::uuid, 'ghost@example.invalid', 'tok-ghost', 'invited')$c$,
    $c$insert into public.client_users (tenant_id, client_id, email, status) values (md5('0454-synthetic-tenant-A')::uuid, gen_random_uuid(), 'nadie@example.invalid', 'invited')$c$,
    $c$update public.client_users set status = 'invited', token = 'tok-again' where client_id = md5('0454-synthetic-c-invited')::uuid$c$,
    $c$update public.client_users set client_id = md5('0454-synthetic-c-ghost')::uuid where client_id = md5('0454-synthetic-c-fail')::uuid$c$,
    $c$insert into public.portal_access_links (tenant_id, client_id, code, expires_at) values (md5('0454-synthetic-tenant-A')::uuid, md5('0454-synthetic-c-ghost')::uuid, 'LINKGHOST001', now() + interval '1 hour')$c$,
    $c$update public.portal_access_links set revoked_at = null where code = 'LINKORPHAN01'$c$,
    $c$update public.portal_access_links set client_id = md5('0454-synthetic-c-ghost')::uuid where code = 'LINKFAIL0001'$c$
  ];
  i int;
begin
  for i in 1 .. array_length(v_cases, 1) loop
    v_state := null;
    begin
      execute v_cases[i];
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
    end;
    perform pg_temp.assert_true(v_state = '23514', 'Guarda 23514 #' || i || ': ' || left(v_cases[i], 90));
  end loop;
end;
$guards$;
select pg_temp.assert_true(pg_temp.bad_rows() = 0, 'Las guardas no dejan nada vigente sobre clientes borrados');
do $guards_allowed$
begin
  insert into public.client_users (tenant_id, client_id, email, status, revoked_at)
  values (pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('c-ghost'), 'ghost@example.invalid', 'revoked', now());
  insert into public.portal_access_links (tenant_id, client_id, code, expires_at, revoked_at)
  values (pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('c-ghost'), 'LINKGHOST002', now(), now());
  update public.client_users set last_login_at = now() where client_id = pg_temp.fixture_id('c-B');
  update public.portal_access_links set used_at = now() where code = 'LINKBBBBBB01';
  update public.portal_access_links set used_at = null where code = 'LINKBBBBBB01';
  perform pg_temp.assert_true(true,
    'Las guardas dejan pasar filas revocadas de clientes borrados y los cambios que no reabren acceso');
end;
$guards_allowed$;
do $rpc_guards$
declare v_blocked int := 0;
begin
  perform pg_temp.as_principal('team-A');
  execute 'set local role authenticated';
  begin
    perform public.portal_create_access_link(pg_temp.fixture_id('c-invited'), 'LINKDELETED1', 72);
  exception when others then v_blocked := v_blocked + 1;
  end;
  begin
    perform public.portal_invite_client(pg_temp.fixture_id('c-invited'));
  exception when others then v_blocked := v_blocked + 1;
  end;
  execute 'reset role';
  perform pg_temp.assert_true(v_blocked = 2 and pg_temp.open_links('c-invited') = 0 and pg_temp.fully_revoked('c-invited'),
    'Las RPC de invitación y de código corto siguen rechazando al cliente borrado');
end;
$rpc_guards$;

-- Fallo atómico: si la revocación falla, el borrado no ocurre.
savepoint atomic_probe;
create function public.fixture_0454_boom() returns trigger language plpgsql as $$
begin raise exception 'revocación rota a propósito'; end $$;
create trigger fixture_0454_boom before update on public.portal_access_links
  for each row execute function public.fixture_0454_boom();
do $atomic$
declare v_state text;
begin
  begin
    perform pg_temp.studio_soft_delete('team-A', 'FAIL');
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    execute 'reset role';
  end;
  perform pg_temp.assert_true(v_state = 'P0001'
    and (select deleted_at is null from public.clients where id = pg_temp.fixture_id('c-fail'))
    and (pg_temp.binding('c-fail')).status = 'active' and (pg_temp.binding('c-fail')).auth_user_id is not null
    and pg_temp.open_links('c-fail') = 1,
    'Si la revocación falla, el UPDATE falla y el cliente, su vínculo y su código quedan como estaban');
end;
$atomic$;
rollback to atomic_probe;
release atomic_probe;

-- merge_clients, camino 1: el superviviente no tenía acceso y lo recibe.
do $merge_moved$
declare v_res jsonb; v_row public.client_users;
begin
  v_res := pg_temp.merge_as('team-A-ops', 'c-surv1', 'c-dup1');
  v_row := pg_temp.binding('c-surv1');
  perform pg_temp.assert_true(v_res->>'access' = 'acceso mudado al superviviente'
    and v_row.status = 'active' and v_row.auth_user_id = pg_temp.fixture_id('p-dup1')
    and v_row.revoked_at is null
    and not exists (select from public.client_users where client_id = pg_temp.fixture_id('c-dup1')),
    'merge_clients muda el acceso: sigue activo en el superviviente con la misma identidad');
  perform pg_temp.assert_true(pg_temp.open_links('c-dup1') = 0 and pg_temp.open_links('c-surv1') = 1,
    'merge_clients con acceso mudado: la ficha retirada queda sin códigos y el superviviente conserva el suyo');
  perform pg_temp.as_principal('p-dup1');
  perform pg_temp.assert_true(public.get_portal_client_id() = pg_temp.fixture_id('c-surv1'),
    'Tras la fusión el titular resuelve al superviviente');
end;
$merge_moved$;

-- merge_clients, camino 2: el superviviente ya tenía acceso; el duplicado se revoca del todo.
do $merge_dup$
declare v_res jsonb; v_row public.client_users;
begin
  v_res := pg_temp.merge_as('team-A-ops', 'c-surv2', 'c-dup2');
  v_row := pg_temp.binding('c-surv2');
  perform pg_temp.assert_true(v_res->>'access' = 'el superviviente ya tenía acceso; se revocó el duplicado'
    and v_row.status = 'active' and v_row.auth_user_id = pg_temp.fixture_id('p-surv2')
    and pg_temp.open_links('c-surv2') = 1,
    'merge_clients con acceso en el superviviente: su vínculo y su código siguen intactos');
  perform pg_temp.assert_true(pg_temp.fully_revoked('c-dup2') and pg_temp.open_links('c-dup2') = 0,
    'merge_clients con acceso en el superviviente: el duplicado queda revocado con revoked_at, sin identidad ni token ni códigos');
  perform pg_temp.assert_true(
    (select count(*) from public.entity_audit_log where event_type = 'portal_access_status_changed'
       and entity_id = pg_temp.fixture_id('c-dup2')) = 1,
    'La fusión deja un solo evento D5 de cambio de status para el duplicado');
end;
$merge_dup$;
select pg_temp.assert_true(pg_temp.invite_as('team-A', 'c-other') is not null and pg_temp.bind_as('p-dup2')
  and (pg_temp.binding('c-other')).auth_user_id = pg_temp.fixture_id('p-dup2'),
  'La persona del duplicado puede vincularse a otra ficha: unique (auth_user_id) ya no la bloquea');

-- Aislamiento entre tenants: B borra su «ACTIVE»; A no se toca; B no alcanza a A.
select pg_temp.assert_true(pg_temp.studio_soft_delete('team-B', 'ACTIVE') = 1 and pg_temp.fully_revoked('c-B')
  and pg_temp.open_links('c-B') = 0,
  'El operador de B borra su cliente y revoca sólo su acceso');
select pg_temp.assert_true((pg_temp.binding('c-active')).status = 'active' and pg_temp.open_links('c-surv1') = 1,
  'El borrado en B no toca el acceso ni los códigos de A');
select pg_temp.assert_true(pg_temp.studio_soft_delete('team-B', 'SURV1') = 0
  and (pg_temp.binding('c-surv1')).status = 'active' and pg_temp.open_links('c-surv1') = 1,
  'El operador de B no alcanza a borrar ni a revocar un cliente de A');

select pg_temp.assert_true(pg_temp.bad_rows() = 0, 'Invariante final: nada vigente sobre un cliente borrado');

do $done$
begin
  raise notice 'TEST 0454 OK: % aserciones', (select count(*) from pg_temp.assertions);
end;
$done$;

rollback;
