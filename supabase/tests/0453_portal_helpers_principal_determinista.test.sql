\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0453 (SDD-0466): los helpers del Portal
-- resuelven por principal, de forma determinista y sin cruzar tenants.
-- Fixtures ficticios y rollback: nunca consulta ni modifica una base alojada.
-- Aplica las migraciones REALES 0006, 0080, 0081, 0198, 0230, 0347, 0425, 0411,
-- 0258/0261/0267/0294 y 0427 sobre stubs mínimos, y toma get_user_tenant_id()
-- y current_studio_role() del propio archivo 0200 (extraídas por regexp), así
-- el RED corre contra las definiciones que hoy viven en main.
--
-- RED: psql -v apply_fix=false. GREEN (predeterminado): aplica la 0453 real.
--
-- Lo que defiende:
--   1. RED, sin 0453: con dos membresías activas get_user_tenant_id() elige un
--      tenant y la policy «clients by tenant» muestra filas de ese tenant; un
--      vínculo con cliente borrado o incoherente (vínculo en T1, cliente en T2)
--      obtiene Shipping Mark y lee envíos de OTRO tenant por «shipments portal
--      self read» de 0080, la policy que usaba la helper (en main la reemplazó
--      0416 y ya ninguna policy la nombra); con la unique de 0080 retirada y dos
--      vínculos activos, el Shipping Mark es uno cualquiera; y cuando la RLS no aplica (dueño de la
--      tabla o comando SECURITY DEFINER) el trigger 0198 acepta direcciones de
--      un principal que no es miembro ni titular del cliente.
--   2. Estático: timeouts de sesión antes del preflight, preflight antes del
--      primer DDL, postflight después del último, sin DML, grants, policies,
--      triggers, locks ni ALTER; exactamente tres create or replace function.
--   3. Huellas: las formas históricas que acepta el preflight coinciden con las
--      definiciones reales de 0200, 0080 y 0198.
--   3b. Forma de producción (lectura de catálogo autorizada del 2026-09-14): con
--      el cuerpo de 0198 SIN su comentario interno (la forma Cloud),
--      search_path=public y las ACL exactas de producción, el preflight la
--      acepta y la 0453 deja las tres formas finales con esas mismas ACL. Una
--      variante casi Cloud (sin el filtro de cliente vivo) sigue abortando.
--   4. Drift: trigger ausente o deshabilitado, cuerpo desconocido, sin SECURITY
--      DEFINER, ACL abierta a anon o cerrada a authenticated, tabla sin RLS,
--      columna renombrada o auth.uid() ausente: P0001 con mensaje «0453…», sin
--      ids ni Shipping Marks, y catálogo intacto.
--   5. Aplicada: timeouts restaurados, catálogo dependiente (policies, funciones
--      que nombran las helpers, ACL y dueño de las tres, trigger) idéntico,
--      filas idénticas, y reaplicar no cambia nada (mismo oid).
--   6. Comportamiento con 0453: una membresía activa resuelve igual que 0200 y
--      la RPC 0411 responde igual; dos membresías → NULL, cero filas por RLS y
--      42501 en la RPC. Vínculo coherente → su Shipping Mark; borrado,
--      incoherente, revocado, invitado, dos vínculos o sin identidad → NULL y
--      cero envíos. El trigger rechaza con 42501, aun sin RLS, al vínculo de
--      otro tenant, al de cliente borrado, al equipo de otro tenant y al titular
--      de otro cliente; conserva el sellado para el titular y el equipo del
--      tenant y para las escrituras sin principal; y el comando 0427 sigue
--      borrando la dirección propia.

\if :{?apply_fix}
\else
\set apply_fix true
\endif

begin;

do $guard$
begin
  if to_regclass('public.clients') is not null or to_regnamespace('auth') is not null then
    raise exception 'TEST 0453 requiere una base desechable vacía';
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
grant usage on schema auth to authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- tenants y user_tenants con la forma real de 0001 + 0019 (PK compuesta: N
-- membresías por usuario) y la policy de lectura propia de 0200.
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

-- get_user_tenant_id() y current_studio_role() tal como las dejó 0200: se
-- extraen del archivo real y se ejecutan; ACL de 0012.
do $from_0200$
declare v_file text := pg_read_file('/sb/migrations/0200_rbac_disabled_enforcement.sql');
begin
  execute (regexp_match(v_file, 'create or replace function public\.get_user_tenant_id\(\).*?\$\$;'))[1];
  execute (regexp_match(v_file, 'create or replace function public\.current_studio_role\(\).*?\$\$;'))[1];
end;
$from_0200$;
revoke execute on function public.get_user_tenant_id() from public, anon;
grant execute on function public.get_user_tenant_id() to authenticated;
revoke execute on function public.current_studio_role() from public, anon;
grant execute on function public.current_studio_role() to authenticated;
create policy "users see their tenant" on public.tenants for select to authenticated
  using (id = public.get_user_tenant_id());

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create table public.shipments (
  id uuid primary key, tenant_id uuid not null, client_markbox text, deleted_at timestamptz
);
alter table public.shipments enable row level security;
grant select on public.shipments to authenticated;

-- Tabla clients, identidad Portal, sus helpers y direcciones REALES.
-- tenants está vacío: el seed histórico de 0006 no introduce datos demo.
\ir ../migrations/0006_clients.sql
\ir ../migrations/0080_portal_cliente.sql
\ir ../migrations/0081_portal_harden_grants.sql
\ir ../migrations/0198_client_delivery_addresses.sql
\ir ../migrations/0230_fix_rls_soft_delete_blocked.sql
\ir ../migrations/0347_client_delivery_addresses_city_slug.sql
\ir ../migrations/0425_portal_delivery_addresses_tenant_boundary.sql

-- Consumidor de equipo de get_user_tenant_id(): la RPC real de 0411 sobre el
-- mismo fixture mínimo que usa su propio contrato.
create table public.studio_role_module_overrides (
  tenant_id uuid not null, role text not null, module_id text not null, can_view boolean not null,
  primary key (tenant_id, role, module_id)
);
create table public.invoices (
  id uuid primary key, tenant_id uuid not null, client_markbox text not null, currency text not null,
  fx_rate numeric, total_amount numeric not null, status text not null, issued_at date,
  created_at timestamptz not null default now(), deleted_at timestamptz
);
alter table public.invoices enable row level security;
grant select on public.invoices to authenticated;
create policy invoices_team_select on public.invoices for select to authenticated
  using (tenant_id = public.get_user_tenant_id());
\ir ../migrations/0411_client_annual_billing_facade.sql

-- Único escritor SECURITY DEFINER de direcciones en producción: el comando de
-- borrado lógico de 0427, con su plataforma de auditoría real (como en su contrato).
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
\ir ../migrations/0427_portal_delete_delivery_address_command.sql

-- ─── Utilidades ─────────────────────────────────────────────────────────────
create function pg_temp.fixture_id(label text) returns uuid language sql immutable as $$
  select md5('0453-synthetic-' || label)::uuid
$$;
create temporary table assertions (label text primary key);
create temporary sequence assertion_count;
grant insert, select on assertions to authenticated, service_role;
grant usage on sequence assertion_count to authenticated, service_role;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'TEST 0453: %', label; end if;
  insert into pg_temp.assertions values (label);
  perform nextval('pg_temp.assertion_count');
end;
$$;
create function pg_temp.as_principal(label text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', case when label = '' then '' else pg_temp.fixture_id(label)::text end, true)
$$;
grant execute on function pg_temp.fixture_id(text), pg_temp.assert_true(boolean, text), pg_temp.as_principal(text)
  to authenticated, service_role;
-- Un comando SECURITY DEFINER hipotético: escribe sin RLS con el JWT del caller,
-- como lo hacen merge_clients, rename_client_markbox y el comando 0427.
create function public.fixture_0453_definer_insert(p_client uuid, p_line text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.client_delivery_addresses (client_id, tenant_id, client_markbox, line)
  values (p_client, p_client, 'forged-by-definer', p_line) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.fixture_0453_definer_insert(uuid, text) from public, anon;
grant execute on function public.fixture_0453_definer_insert(uuid, text) to authenticated;

-- ─── Fixture sintético ──────────────────────────────────────────────────────
insert into public.tenants (id, slug, display_name) values
  (pg_temp.fixture_id('tenant-A'), 'synthetic-A', 'Tenant A'), (pg_temp.fixture_id('tenant-B'), 'synthetic-B', 'Tenant B');
insert into auth.users (id)
select pg_temp.fixture_id(v) from unnest(array[
  'portal-A', 'portal-B', 'incoherent', 'retired', 'revoked', 'invited', 'unbound',
  'team-A', 'team-B', 'team-disabled', 'team-multi', 'team-half'
]) v;
insert into public.user_tenants (user_id, tenant_id, role, disabled_at)
select pg_temp.fixture_id(actor), pg_temp.fixture_id(tenant), role, case when disabled then now() end
from (values
  ('team-A', 'tenant-A', 'admin', false),
  ('team-B', 'tenant-B', 'admin', false),
  ('team-disabled', 'tenant-A', 'admin', true),
  ('team-multi', 'tenant-A', 'admin', false),      -- dos membresías ACTIVAS
  ('team-multi', 'tenant-B', 'admin', false),
  ('team-half', 'tenant-A', 'admin', false),       -- una activa y otra desactivada
  ('team-half', 'tenant-B', 'admin', true)
) v(actor, tenant, role, disabled);
insert into public.clients (id, tenant_id, markbox, name)
select pg_temp.fixture_id(label), pg_temp.fixture_id(tenant), markbox, label
from (values
  ('client-A', 'tenant-A', 'DUP'), ('client-B', 'tenant-B', 'DUP'),
  ('client-other', 'tenant-A', 'OTHER'), ('client-revoked', 'tenant-A', 'REVOKED'),
  ('client-invited', 'tenant-A', 'INVITED'), ('client-retired', 'tenant-A', 'RETIRED')
) v(label, tenant, markbox);
insert into public.client_users (auth_user_id, tenant_id, client_id, email, status)
select pg_temp.fixture_id(actor), pg_temp.fixture_id(tenant), pg_temp.fixture_id(client),
  actor || '@example.invalid', status
from (values
  ('portal-A', 'tenant-A', 'client-A', 'active'),
  ('portal-B', 'tenant-B', 'client-B', 'active'),
  -- Las FK reales permiten un vínculo incoherente: vínculo en A, cliente en B.
  ('incoherent', 'tenant-A', 'client-B', 'active'),
  ('retired', 'tenant-A', 'client-retired', 'active'),
  ('revoked', 'tenant-A', 'client-revoked', 'revoked'),
  ('invited', 'tenant-A', 'client-invited', 'invited')
) v(actor, tenant, client, status);
-- El trigger 0198 sella tenant y Shipping Mark desde clients (sin principal).
insert into public.client_delivery_addresses (id, client_id, tenant_id, client_markbox, line)
select pg_temp.fixture_id('address-' || suffix), pg_temp.fixture_id('client-' || suffix),
  pg_temp.fixture_id('tenant-A'), 'forged-input-is-sealed', 'synthetic-address-' || suffix
from unnest(array['A', 'B', 'other', 'retired']) suffix;
update public.clients set deleted_at = now() where id = pg_temp.fixture_id('client-retired');
insert into public.shipments (id, tenant_id, client_markbox)
select pg_temp.fixture_id('ship-' || label), pg_temp.fixture_id(tenant), markbox
from (values
  ('A-dup', 'tenant-A', 'DUP'), ('B-dup', 'tenant-B', 'DUP'),
  ('A-other', 'tenant-A', 'OTHER'), ('A-retired', 'tenant-A', 'RETIRED')
) v(label, tenant, markbox);
insert into public.invoices (id, tenant_id, client_markbox, currency, fx_rate, total_amount, status, issued_at)
values
  (pg_temp.fixture_id('inv-A1'), pg_temp.fixture_id('tenant-A'), 'DUP', 'USD', null, 1000, 'emitida', current_date - 30),
  (pg_temp.fixture_id('inv-A2'), pg_temp.fixture_id('tenant-A'), 'OTHER', 'USD', null, 250, 'pagada', current_date - 10),
  (pg_temp.fixture_id('inv-B1'), pg_temp.fixture_id('tenant-B'), 'DUP', 'USD', null, 777, 'emitida', current_date - 5);

do $fixture_check$
begin
  if (select count(*) from public.client_delivery_addresses where tenant_id = pg_temp.fixture_id('tenant-B')) <> 1
     or (select count(*) from public.client_delivery_addresses where tenant_id = pg_temp.fixture_id('tenant-A')) <> 3
     or not exists (select from pg_constraint where conname = 'client_users_auth_user_id_key') then
    raise exception 'TEST 0453: el fixture no quedó armado';
  end if;
end;
$fixture_check$;

-- ─── Huellas: lo que acepta el preflight es lo que 0200/0080/0198 producen ──
create function pg_temp.norm(signature text) returns text language sql stable as $$
  select regexp_replace(prosrc, '\s', '', 'g') from pg_proc where oid = signature::regprocedure
$$;
create function pg_temp.constant_0453(name text) returns text language sql stable as $$
  select replace((regexp_match(pg_read_file('/sb/migrations/0453_portal_helpers_principal_determinista.sql'),
    name || ' constant text := ''((?:[^'']|'''')*)'';'))[1], '''''', '''')
$$;
select pg_temp.assert_true(pg_temp.norm('public.get_user_tenant_id()') = pg_temp.constant_0453('c_tenant_0200'),
  'La huella histórica de get_user_tenant_id() es la definición real de 0200');
select pg_temp.assert_true(pg_temp.norm('public.get_portal_client_markbox()') = pg_temp.constant_0453('c_markbox_0080'),
  'La huella histórica de get_portal_client_markbox() es la definición real de 0080');
select pg_temp.assert_true(pg_temp.norm('public.client_delivery_addresses_validate_client()') = pg_temp.constant_0453('c_validate_0198'),
  'La huella histórica de client_delivery_addresses_validate_client() es la definición real de 0198');

-- Variantes de 0198 construidas desde el archivo real: la forma Cloud que corre
-- en producción (sin el comentario interno de tres líneas) y una casi Cloud que
-- además pierde el filtro de cliente vivo, y que el preflight debe rechazar.
create temporary table validate_variants (label text primary key, stmt text not null);
do $variants$
declare
  v_stmt text := (regexp_match(pg_read_file('/sb/migrations/0198_client_delivery_addresses.sql'),
    'create or replace function public\.client_delivery_addresses_validate_client\(\).*?\n\$\$;'))[1];
  v_cloud text;
  v_near text;
begin
  v_cloud := regexp_replace(v_stmt,
    '\n  -- Un cliente del portal[^\n]*\n  -- get_portal_client_markbox\(\)[^\n]*\n  -- así el body[^\n]*', '');
  v_near := replace(v_cloud, E'\n    and deleted_at is null;', ';');
  if v_stmt is null or v_cloud = v_stmt or v_near = v_cloud then
    raise exception 'TEST 0453: no se pudieron construir las variantes de 0198';
  end if;
  insert into pg_temp.validate_variants values ('cloud', v_cloud), ('casi-cloud', v_near);
end;
$variants$;
-- La lectura de producción del 2026-09-14, sin filas, copiada como literal y no
-- tomada de la migración: el contrato no confía en el código que prueba. El
-- md5(prosrc) de producción (7db6f812a549df579f2d7d0d6cd72298) no se reproduce en
-- local porque el texto también difiere en espacios; se compara la forma normalizada.
create function pg_temp.production_validate_body() returns text language sql immutable as $body$
  select $prod$declarev_tenantuuid;v_markboxtext;beginselecttenant_id,markboxintov_tenant,v_markboxfrompublic.clientswhereid=new.client_idanddeleted_atisnull;ifv_tenantisnullthenraiseexception'direcciónsobreclienteinexistenteoborrado(client%)',new.client_idusingerrcode='check_violation';endif;new.tenant_id:=v_tenant;new.client_markbox:=v_markbox;returnnew;end;$prod$
$body$;
create function pg_temp.production_shape_2026_09_14() returns boolean language sql stable as $shape$
  select
    pg_temp.norm('public.get_user_tenant_id()')
      = $prod$selecttenant_idfrompublic.user_tenantswhereuser_id=(selectauth.uid())anddisabled_atisnulllimit1;$prod$
    and pg_temp.norm('public.get_portal_client_markbox()')
      = $prod$selectc.markboxfrompublic.client_userscujoinpublic.clientsconc.id=cu.client_idwherecu.auth_user_id=auth.uid()andcu.status='active'limit1$prod$
    and pg_temp.norm('public.client_delivery_addresses_validate_client()') = pg_temp.production_validate_body()
    and (select p.proacl::text from pg_proc p where p.oid = 'public.get_user_tenant_id()'::regprocedure)
      = '{postgres=X/postgres,authenticated=X/postgres}'
    and (select p.proacl::text from pg_proc p where p.oid = 'public.get_portal_client_markbox()'::regprocedure)
      = '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'
    and (select p.proacl::text from pg_proc p where p.oid = 'public.client_delivery_addresses_validate_client()'::regprocedure)
      = '{postgres=X/postgres,service_role=X/postgres}'
    and (select bool_and(p.proconfig = array['search_path=public']::text[] and p.prosecdef
           and p.proowner = 'postgres'::regrole)
         from pg_proc p where p.oid in ('public.get_user_tenant_id()'::regprocedure,
           'public.get_portal_client_markbox()'::regprocedure,
           'public.client_delivery_addresses_validate_client()'::regprocedure))
    and exists (select from pg_trigger t where t.tgrelid = 'public.client_delivery_addresses'::regclass
      and t.tgname = 'client_delivery_addresses_validate_trg' and t.tgtype = 23 and t.tgenabled = 'O'
      and t.tgfoid = 'public.client_delivery_addresses_validate_client()'::regprocedure)
    and exists (select from pg_trigger t where t.tgrelid = 'public.client_delivery_addresses'::regclass
      and t.tgname = 'client_delivery_addresses_touch')
$shape$;

-- ─── Catálogo y filas antes de la migración ─────────────────────────────────
create function pg_temp.catalog_snapshot() returns jsonb language sql stable as $catalog$
select jsonb_build_object(
  'helpers', (select jsonb_agg(jsonb_build_array(p.oid, p.proowner, p.proacl, p.prosecdef, p.provolatile, p.proconfig, md5(p.prosrc)) order by p.oid)
    from pg_proc p where p.oid in ('public.get_user_tenant_id()'::regprocedure,
      'public.get_portal_client_markbox()'::regprocedure, 'public.client_delivery_addresses_validate_client()'::regprocedure)),
  'dependents', (select jsonb_agg(jsonb_build_array(p.oid, p.proowner, p.proacl, p.proconfig, md5(p.prosrc)) order by p.oid)
    from pg_proc p where p.pronamespace = 'public'::regnamespace
      and (p.prosrc like '%get_user_tenant_id%' or p.prosrc like '%get_portal_client_markbox%')
      and p.oid not in ('public.get_user_tenant_id()'::regprocedure,
        'public.get_portal_client_markbox()'::regprocedure, 'public.client_delivery_addresses_validate_client()'::regprocedure)),
  'policies', (select jsonb_agg(to_jsonb(p) order by schemaname, tablename, policyname) from pg_policies p),
  'triggers', (select jsonb_agg(to_jsonb(t) order by oid) from pg_trigger t
    where tgrelid = 'public.client_delivery_addresses'::regclass),
  'tables', (select jsonb_agg(jsonb_build_array(c.oid, c.relacl, c.relrowsecurity, c.relforcerowsecurity) order by c.oid)
    from pg_class c where c.oid in ('public.clients'::regclass, 'public.client_users'::regclass,
      'public.user_tenants'::regclass, 'public.client_delivery_addresses'::regclass))
);
$catalog$;
create function pg_temp.rows_snapshot() returns jsonb language sql stable as $rows$
select jsonb_build_object(
  'clients', (select jsonb_agg(to_jsonb(c) order by id) from public.clients c),
  'bindings', (select jsonb_agg(to_jsonb(c) order by id) from public.client_users c),
  'memberships', (select jsonb_agg(to_jsonb(u) order by user_id, tenant_id) from public.user_tenants u),
  'addresses', (select jsonb_agg(to_jsonb(a) order by id) from public.client_delivery_addresses a),
  'audit', (select coalesce(jsonb_agg(to_jsonb(a) order by id), '[]'::jsonb) from public.entity_audit_log a)
);
$rows$;
create temporary table before_migration as
  select pg_temp.catalog_snapshot() as catalog, pg_temp.rows_snapshot() as rows;

-- ─── 1 · RED: lo que hoy hace main ──────────────────────────────────────────
savepoint red_probe;
do $red$
declare v_tenant uuid; v_markbox text; n bigint; v_tenant_sealed uuid; v_blocked boolean;
begin
  -- Dos membresías activas: un tenant cualquiera y filas de ese tenant.
  perform pg_temp.as_principal('team-multi');
  v_tenant := public.get_user_tenant_id();
  if v_tenant is null or v_tenant not in (pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('tenant-B')) then
    raise exception 'TEST 0453 baseline no reproduce el limit 1 de get_user_tenant_id()';
  end if;
  raise notice 'TEST 0453 RED baseline: con dos membresías get_user_tenant_id() eligió %',
    case when v_tenant = pg_temp.fixture_id('tenant-A') then 'tenant-A' else 'tenant-B' end;
  execute 'set local role authenticated';
  select count(*) into n from public.clients;
  execute 'reset role';
  if n = 0 then raise exception 'TEST 0453 baseline no reproduce filas por tenant arbitrario'; end if;
  raise notice 'TEST 0453 RED baseline: «clients by tenant» mostró % cliente(s) de ese tenant', n;

  -- Vínculo con cliente borrado y vínculo incoherente: Shipping Mark y envíos ajenos.
  perform pg_temp.as_principal('retired');
  v_markbox := public.get_portal_client_markbox();
  if v_markbox is distinct from 'RETIRED' then
    raise exception 'TEST 0453 baseline no reproduce el Shipping Mark de un cliente borrado';
  end if;
  execute 'set local role authenticated';
  select count(*) into n from public.shipments;
  execute 'reset role';
  raise notice 'TEST 0453 RED baseline: vínculo con cliente borrado obtiene Shipping Mark y lee % envío(s)', n;
  if n <> 1 then raise exception 'TEST 0453 baseline no reproduce la lectura por cliente borrado'; end if;

  perform pg_temp.as_principal('incoherent');
  v_markbox := public.get_portal_client_markbox();
  if v_markbox is distinct from 'DUP' then
    raise exception 'TEST 0453 baseline no reproduce el Shipping Mark de un vínculo incoherente';
  end if;
  execute 'set local role authenticated';
  select count(*) into n from public.shipments;
  execute 'reset role';
  if n <> 2 then raise exception 'TEST 0453 baseline no reproduce la lectura cruzada por Shipping Mark'; end if;
  raise notice 'TEST 0453 RED baseline: vínculo incoherente (vínculo en A, cliente en B) lee % envíos DUP, uno por tenant', n;

  -- Dos vínculos activos, sólo posibles si se retira la unique de 0080.
  execute 'alter table public.client_users drop constraint client_users_auth_user_id_key';
  insert into public.client_users (auth_user_id, tenant_id, client_id, email, status)
  values (pg_temp.fixture_id('portal-A'), pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('client-other'),
    'second@example.invalid', 'active');
  perform pg_temp.as_principal('portal-A');
  v_markbox := public.get_portal_client_markbox();
  if v_markbox is null or v_markbox not in ('DUP', 'OTHER') then
    raise exception 'TEST 0453 baseline no reproduce el limit 1 con dos vínculos';
  end if;
  raise notice 'TEST 0453 RED baseline: con dos vínculos activos get_portal_client_markbox() eligió %', v_markbox;

  -- Trigger sin RLS (dueño de la tabla con el JWT del principal, como un comando
  -- SECURITY DEFINER): acepta a quien no es miembro ni titular del cliente.
  perform pg_temp.as_principal('incoherent');
  insert into public.client_delivery_addresses (client_id, tenant_id, client_markbox, line)
  values (pg_temp.fixture_id('client-B'), pg_temp.fixture_id('tenant-A'), 'DUP', 'red-incoherent')
  returning tenant_id into v_tenant_sealed;
  if v_tenant_sealed <> pg_temp.fixture_id('tenant-B') then
    raise exception 'TEST 0453 baseline no reproduce el sellado hacia otro tenant';
  end if;
  raise notice 'TEST 0453 RED baseline: vínculo de otro tenant escribió una dirección sellada en tenant-B';
  perform pg_temp.as_principal('retired');
  insert into public.client_delivery_addresses (client_id, tenant_id, client_markbox, line)
  values (pg_temp.fixture_id('client-other'), pg_temp.fixture_id('tenant-A'), 'OTHER', 'red-retired');
  perform pg_temp.as_principal('team-A');
  insert into public.client_delivery_addresses (client_id, tenant_id, client_markbox, line)
  values (pg_temp.fixture_id('client-B'), pg_temp.fixture_id('tenant-A'), 'DUP', 'red-team-cross');
  raise notice 'TEST 0453 RED baseline: cliente borrado y equipo de otro tenant también escribieron';
  -- Y por un comando SECURITY DEFINER real, llamado como authenticated.
  execute 'set local role authenticated';
  perform pg_temp.as_principal('portal-A');
  perform public.fixture_0453_definer_insert(pg_temp.fixture_id('client-other'), 'red-other-client');
  execute 'reset role';
  raise notice 'TEST 0453 RED baseline: el titular de A escribió por comando DEFINER una dirección de OTRO cliente';
end;
$red$;
rollback to red_probe;
release red_probe;
select pg_temp.assert_true((select rows from before_migration) = pg_temp.rows_snapshot(),
  'La sonda RED no dejó filas');

\if :apply_fix
-- ─── 3b · Forma de producción medida el 2026-09-14 ──────────────────────────
-- Producción corre 0198 sin su comentario interno y tiene ACL propias. Todo va
-- en un savepoint: el resto del contrato sigue sobre las definiciones del repo.
savepoint production_shape;
do $cloud_install$
begin
  execute (select stmt from pg_temp.validate_variants where label = 'cloud');
end;
$cloud_install$;
revoke all on function public.get_user_tenant_id() from public, anon, authenticated, service_role;
grant execute on function public.get_user_tenant_id() to authenticated;
revoke all on function public.get_portal_client_markbox() from public, anon, authenticated, service_role;
grant execute on function public.get_portal_client_markbox() to service_role;
grant execute on function public.get_portal_client_markbox() to authenticated;
revoke all on function public.client_delivery_addresses_validate_client() from public, anon, authenticated, service_role;
grant execute on function public.client_delivery_addresses_validate_client() to service_role;
select pg_temp.assert_true(pg_temp.production_shape_2026_09_14(),
  'El fixture reproduce la lectura de producción del 2026-09-14: cuerpos, search_path, dueño, ACL y triggers');
\ir ../migrations/0453_portal_helpers_principal_determinista.sql
select pg_temp.assert_true(
  pg_temp.norm('public.get_user_tenant_id()') = pg_temp.constant_0453('c_tenant_0453')
  and pg_temp.norm('public.get_portal_client_markbox()') = pg_temp.constant_0453('c_markbox_0453')
  and pg_temp.norm('public.client_delivery_addresses_validate_client()') = pg_temp.constant_0453('c_validate_0453'),
  'Sobre la forma de producción el preflight acepta y la 0453 deja las tres formas finales');
select pg_temp.assert_true(
  (select p.proacl::text from pg_proc p where p.oid = 'public.get_user_tenant_id()'::regprocedure)
    = '{postgres=X/postgres,authenticated=X/postgres}'
  and (select p.proacl::text from pg_proc p where p.oid = 'public.get_portal_client_markbox()'::regprocedure)
    = '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'
  and (select p.proacl::text from pg_proc p where p.oid = 'public.client_delivery_addresses_validate_client()'::regprocedure)
    = '{postgres=X/postgres,service_role=X/postgres}'
  and exists (select from pg_trigger t where t.tgrelid = 'public.client_delivery_addresses'::regclass
    and t.tgname = 'client_delivery_addresses_validate_trg' and t.tgtype = 23 and t.tgenabled = 'O'),
  'Sobre la forma de producción la 0453 conserva las ACL exactas y el trigger');
select pg_temp.assert_true(
  pg_temp.constant_0453('c_validate_0198_cloud') = pg_temp.production_validate_body()
  and pg_temp.constant_0453('c_validate_0198_cloud') <> pg_temp.constant_0453('c_validate_0198'),
  'La constante Cloud del preflight es la lectura de producción, carácter por carácter, y distinta de 0198 del repo');
rollback to savepoint production_shape;
release savepoint production_shape;
select pg_temp.assert_true((select catalog from before_migration) = pg_temp.catalog_snapshot(),
  'El caso de producción se revierte entero y el resto del contrato corre sobre el repo');

\ir ../migrations/0453_portal_helpers_principal_determinista.sql
select pg_temp.assert_true(current_setting('lock_timeout') = '0' and current_setting('statement_timeout') = '0',
  'La migración restaura lock_timeout y statement_timeout de sesión');
create temporary table after_first as select pg_temp.catalog_snapshot() as catalog;
\ir ../migrations/0453_portal_helpers_principal_determinista.sql
select pg_temp.assert_true((select catalog from after_first) = pg_temp.catalog_snapshot(),
  'Reaplicar deja el catálogo idéntico: mismos oid, ACL, dueño, cuerpos y trigger');
select pg_temp.assert_true(
  (select bool_and(p.proconfig = array['search_path=""']::text[]) from pg_proc p where p.oid in (
    'public.get_user_tenant_id()'::regprocedure, 'public.get_portal_client_markbox()'::regprocedure,
    'public.client_delivery_addresses_validate_client()'::regprocedure)),
  'Las tres funciones quedan con search_path vacío');

-- ─── 2 · Estático ───────────────────────────────────────────────────────────
do $static$
declare
  f text := pg_read_file('/sb/migrations/0453_portal_helpers_principal_determinista.sql');
  p_lock int := position('set lock_timeout = ''5s'';' in f);
  p_stmt int := position('set statement_timeout = ''30s'';' in f);
  p_pre int := position('do $preflight$' in f);
  p_ddl int := position(E'\ncreate or replace function public.' in f);
  p_post int := position('do $postflight$' in f);
  p_reset_stmt int := position('reset statement_timeout;' in f);
  p_reset_lock int := position('reset lock_timeout;' in f);
begin
  perform pg_temp.assert_true(p_lock > 0 and p_stmt > 0 and p_lock < p_pre and p_stmt < p_pre,
    'Timeouts de sesión al inicio, antes del preflight');
  perform pg_temp.assert_true(p_pre > 0 and p_ddl > p_pre and p_post > p_ddl
    and p_reset_stmt > p_post and p_reset_lock > p_reset_stmt,
    'Orden: preflight → tres create or replace → postflight → reset de timeouts');
  perform pg_temp.assert_true(
    (select count(*) from regexp_matches(f, 'create or replace function public\.', 'g')) = 3
    and (select count(*) from regexp_matches(f, '\ncomment on function public\.', 'g')) = 3,
    'Exactamente tres funciones redefinidas y comentadas');
  perform pg_temp.assert_true(f !~* '\n\s*(insert|update|delete|merge|truncate|copy|grant|revoke|alter|drop|lock|create (policy|trigger|table|index))\s',
    'Sin DML, grants, policies, triggers, tablas, índices, locks ni ALTER');
  perform pg_temp.assert_true(f like E'%\ndo $preflight$%\nend;\n$preflight$;\n%' and f like E'%\ndo $postflight$%\nend;\n$postflight$;\n%',
    'Preflight y postflight son bloques do cerrados');
end;
$static$;

-- ─── 4 · Drift: el preflight falla cerrado y no toca nada ───────────────────
do $drift$
declare drift text; failed boolean; message text; state text; after_drift jsonb;
  original jsonb := pg_temp.catalog_snapshot();
  migration text := pg_read_file('/sb/migrations/0453_portal_helpers_principal_determinista.sql');
begin
  foreach drift in array array[
    'drop trigger client_delivery_addresses_validate_trg on public.client_delivery_addresses',
    'alter table public.client_delivery_addresses disable trigger client_delivery_addresses_validate_trg',
    'create or replace function public.get_user_tenant_id() returns uuid language sql stable security definer set search_path = public as $f$ select null::uuid $f$',
    'create or replace function public.get_portal_client_markbox() returns text language sql stable security definer set search_path = public as $f$ select ''DUP''::text $f$',
    'create or replace function public.client_delivery_addresses_validate_client() returns trigger language plpgsql security definer set search_path = public as $f$ begin return new; end $f$',
    'alter function public.get_portal_client_markbox() security invoker',
    'alter function public.client_delivery_addresses_validate_client() security invoker',
    'grant execute on function public.get_user_tenant_id() to anon',
    'revoke execute on function public.get_portal_client_markbox() from authenticated',
    'grant execute on function public.client_delivery_addresses_validate_client() to authenticated',
    'alter table public.client_users disable row level security',
    'alter table public.user_tenants rename column disabled_at to fixture_0453_disabled',
    'alter function auth.uid() rename to fixture_0453_missing_uid'
  ] loop
    failed := false;
    begin
      execute drift;
      after_drift := pg_temp.catalog_snapshot();
      begin execute migration;
      exception when others then
        get stacked diagnostics message = message_text, state = returned_sqlstate;
        -- Sólo vale el preflight («0453 requiere…» / «0453 abortada…»): un rechazo
        -- del postflight («0453: …») llegaría después de haber intentado el DDL.
        if state <> 'P0001' or (message not like '0453 requiere%' and message not like '0453 abortada%') then
          raise exception 'TEST 0453: drift no falló en preflight: % / % (%)', state, message, drift;
        end if;
        if message ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
           or message ~ 'DUP|OTHER|RETIRED|REVOKED|INVITED' then
          raise exception 'TEST 0453: el mensaje del preflight expone ids o Shipping Marks: %', message;
        end if;
        failed := true;
      end;
      if not failed or after_drift <> pg_temp.catalog_snapshot() then
        raise exception 'TEST 0453: preflight aceptó drift o alteró catálogo: %', drift;
      end if;
      raise exception using errcode = 'PT453', message = 'rollback drift sintético';
    exception when sqlstate 'PT453' then null;
    end;
    perform pg_temp.assert_true(failed and original = pg_temp.catalog_snapshot(), 'Preflight rechaza y preserva: ' || drift);
  end loop;
end;
$drift$;

-- Un cuerpo casi Cloud (0198 sin el comentario y sin el filtro de cliente vivo)
-- no es ninguna de las formas aceptadas: aborta en el preflight y no toca nada.
do $near_cloud$
declare failed boolean := false; message text; state text; after_drift jsonb;
  original jsonb := pg_temp.catalog_snapshot();
  migration text := pg_read_file('/sb/migrations/0453_portal_helpers_principal_determinista.sql');
begin
  begin
    execute (select stmt from pg_temp.validate_variants where label = 'casi-cloud');
    after_drift := pg_temp.catalog_snapshot();
    begin execute migration;
    exception when others then
      get stacked diagnostics message = message_text, state = returned_sqlstate;
      failed := state = 'P0001'
        and message like '0453 abortada: el cuerpo de client_delivery_addresses_validate_client()%';
    end;
    if not failed or after_drift <> pg_temp.catalog_snapshot() then
      raise exception 'TEST 0453: el preflight aceptó un cuerpo casi Cloud de 0198 o alteró el catálogo';
    end if;
    raise exception using errcode = 'PT453', message = 'rollback drift sintético';
  exception when sqlstate 'PT453' then null;
  end;
  perform pg_temp.assert_true(failed and original = pg_temp.catalog_snapshot(),
    'Preflight rechaza un cuerpo casi Cloud de 0198 (sin el filtro de cliente vivo) y preserva el catálogo');
end;
$near_cloud$;

-- El guardián del postflight, ejecutado solo con una huella que no coincide.
do $postflight_guard$
declare
  block text := (regexp_match(pg_read_file('/sb/migrations/0453_portal_helpers_principal_determinista.sql'),
    '\ndo \$postflight\$.*?\n\$postflight\$;'))[1];
  failed boolean := false; message text;
begin
  perform pg_temp.assert_true(block is not null, 'El postflight se pudo extraer del archivo');
  perform set_config('dtd.huella_0453', 'huella-sintetica-0453', true);
  begin
    execute block;
  exception when others then
    get stacked diagnostics message = message_text;
    failed := sqlstate = 'P0001' and message like '0453: cambió el catálogo dependiente%';
  end;
  perform pg_temp.assert_true(failed, 'El postflight exige la huella del catálogo dependiente tomada en el preflight');
  perform set_config('dtd.huella_0453', '', true);
end;
$postflight_guard$;
\endif

-- ─── 5 · Aplicada: sólo cambian los tres cuerpos ────────────────────────────
select pg_temp.assert_true(
  (select catalog - 'helpers' from before_migration) = pg_temp.catalog_snapshot() - 'helpers',
  'Policies, funciones dependientes, trigger y ACL de tablas quedan idénticos');
select pg_temp.assert_true(
  (select jsonb_agg(h - 6 - 5 order by h->0) from jsonb_array_elements((select catalog->'helpers' from before_migration)) h)
  = (select jsonb_agg(h - 6 - 5 order by h->0) from jsonb_array_elements(pg_temp.catalog_snapshot()->'helpers') h),
  'Las tres funciones conservan oid, dueño, ACL, SECURITY DEFINER y volatilidad; cambian sólo cuerpo y search_path');
select pg_temp.assert_true((select rows from before_migration) = pg_temp.rows_snapshot(),
  'La migración no modifica clientes, vínculos, membresías, direcciones ni auditoría');

-- ─── 6 · Comportamiento ─────────────────────────────────────────────────────
-- 6a · get_user_tenant_id(): la única membresía activa, o NULL.
do $tenant_helper$
begin
  perform pg_temp.as_principal('team-A');
  perform pg_temp.assert_true(public.get_user_tenant_id() = pg_temp.fixture_id('tenant-A'), 'Una membresía activa resuelve su tenant');
  perform pg_temp.as_principal('team-B');
  perform pg_temp.assert_true(public.get_user_tenant_id() = pg_temp.fixture_id('tenant-B'), 'La membresía de B resuelve B');
  perform pg_temp.as_principal('team-half');
  perform pg_temp.assert_true(public.get_user_tenant_id() = pg_temp.fixture_id('tenant-A'), 'Una activa y otra desactivada resuelve la activa');
  perform pg_temp.as_principal('team-disabled');
  perform pg_temp.assert_true(public.get_user_tenant_id() is null, 'Membresía desactivada → NULL, como en 0200');
  perform pg_temp.as_principal('team-multi');
  perform pg_temp.assert_true(public.get_user_tenant_id() is null, 'Dos membresías activas → NULL (fail-closed), ya no un tenant cualquiera');
  perform pg_temp.as_principal('unbound');
  perform pg_temp.assert_true(public.get_user_tenant_id() is null, 'Sin membresía → NULL');
  perform pg_temp.as_principal('');
  perform pg_temp.assert_true(public.get_user_tenant_id() is null, 'Sin identidad → NULL');
end;
$tenant_helper$;

-- 6b · Policies «by tenant» y la RPC real de 0411 con una y con dos membresías.
set local role authenticated;
do $team_policies$
declare n bigint; blocked boolean; v_rows text;
begin
  perform pg_temp.as_principal('team-A');
  select count(*) into n from public.clients;
  perform pg_temp.assert_true(n = 5, 'Equipo A ve los cinco clientes de su tenant, el borrado incluido (RLS «clients by tenant» tras 0230)');
  select count(*) into n from public.client_delivery_addresses;
  perform pg_temp.assert_true(n = 3, 'Equipo A ve las tres direcciones de su tenant');
  select string_agg(client_markbox || '=' || billed_usd::text, ',' order by client_markbox) into v_rows
    from public.studio_client_annual_billing(current_date);
  perform pg_temp.assert_true(v_rows = 'DUP=1000,OTHER=250', 'RPC 0411 para el admin de A: ' || coalesce(v_rows, '<vacío>'));
  perform pg_temp.as_principal('team-B');
  select string_agg(client_markbox || '=' || billed_usd::text, ',' order by client_markbox) into v_rows
    from public.studio_client_annual_billing(current_date);
  perform pg_temp.assert_true(v_rows = 'DUP=777', 'RPC 0411 para el admin de B: ' || coalesce(v_rows, '<vacío>'));

  perform pg_temp.as_principal('team-multi');
  select count(*) into n from public.clients;
  perform pg_temp.assert_true(n = 0, 'Dos membresías: cero clientes por RLS');
  select count(*) into n from public.client_delivery_addresses;
  perform pg_temp.assert_true(n = 0, 'Dos membresías: cero direcciones por RLS');
  select count(*) into n from public.invoices;
  perform pg_temp.assert_true(n = 0, 'Dos membresías: cero facturas por invoices_team_select');
  blocked := false;
  begin
    insert into public.clients (tenant_id, markbox, name) values (pg_temp.fixture_id('tenant-A'), 'MULTI', 'forbidden');
  exception when insufficient_privilege then blocked := true; end;
  perform pg_temp.assert_true(blocked, 'Dos membresías: INSERT rechazado por WITH CHECK');
  update public.clients set name = 'forbidden';
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 0, 'Dos membresías: UPDATE toca cero filas');
  blocked := false;
  begin
    perform * from public.studio_client_annual_billing(current_date);
  exception when insufficient_privilege then blocked := true; end;
  perform pg_temp.assert_true(blocked, 'Dos membresías: la RPC 0411 responde 42501');
  perform pg_temp.assert_true(public.current_studio_role() is not null,
    'current_studio_role() sigue con limit 1 (fuera de alcance): el rol solo no abre nada porque el tenant es NULL');
end;
$team_policies$;
reset role;

-- 6c · get_portal_client_markbox(): el único vínculo coherente, o NULL.
do $markbox_helper$
declare actor text;
begin
  perform pg_temp.as_principal('portal-A');
  perform pg_temp.assert_true(public.get_portal_client_markbox() = 'DUP', 'Vínculo coherente de A → su Shipping Mark');
  perform pg_temp.as_principal('portal-B');
  perform pg_temp.assert_true(public.get_portal_client_markbox() = 'DUP', 'Vínculo coherente de B → su Shipping Mark');
  foreach actor in array array['retired', 'incoherent', 'revoked', 'invited', 'unbound', 'team-A', ''] loop
    perform pg_temp.as_principal(actor);
    perform pg_temp.assert_true(public.get_portal_client_markbox() is null,
      coalesce(nullif(actor, ''), 'sin identidad') || ': get_portal_client_markbox() → NULL');
  end loop;
end;
$markbox_helper$;
savepoint two_links;
alter table public.client_users drop constraint client_users_auth_user_id_key;
insert into public.client_users (auth_user_id, tenant_id, client_id, email, status)
values (pg_temp.fixture_id('portal-A'), pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('client-other'),
  'second@example.invalid', 'active');
select pg_temp.as_principal('portal-A');
select pg_temp.assert_true(public.get_portal_client_markbox() is null,
  'Dos vínculos activos coherentes → NULL (fail-closed), ya no uno cualquiera');
set local role authenticated;
select pg_temp.assert_true((select count(*) from public.shipments) = 0,
  'Dos vínculos: cero envíos por «shipments portal self read»');
reset role;
update public.client_users set status = 'revoked' where client_id = pg_temp.fixture_id('client-other');
select pg_temp.assert_true(public.get_portal_client_markbox() = 'DUP',
  'Al revocar el segundo vínculo vuelve a resolver el único activo');
rollback to two_links;
release two_links;

-- 6d · Policies del Portal por Shipping Mark con los vínculos inválidos.
set local role authenticated;
do $portal_policies$
declare actor text; n bigint;
begin
  perform pg_temp.as_principal('portal-A');
  select count(*) into n from public.shipments;
  perform pg_temp.assert_true(n = 2, 'Vínculo coherente conserva su lectura de envíos (la policy 0080 compara sólo el Shipping Mark: ' || n || ')');
  select count(*) into n from public.client_delivery_addresses;
  perform pg_temp.assert_true(n = 1, 'Vínculo coherente conserva su dirección (0425)');
  foreach actor in array array['retired', 'incoherent', 'revoked', 'invited', 'unbound'] loop
    perform pg_temp.as_principal(actor);
    select count(*) into n from public.shipments;
    perform pg_temp.assert_true(n = 0, actor || ': cero envíos por Shipping Mark');
  end loop;
end;
$portal_policies$;
reset role;

-- 6e · Trigger sin RLS: dueño de la tabla con el JWT del principal.
do $trigger_owner$
declare blocked boolean; state text; message text; v_row public.client_delivery_addresses; n bigint;
  original jsonb := pg_temp.rows_snapshot();
  cross_case record;
begin
  for cross_case in select * from (values
    ('incoherent', 'client-B', 'vínculo de otro tenant'),
    ('retired', 'client-other', 'vínculo con cliente borrado'),
    ('team-A', 'client-B', 'equipo de otro tenant'),
    ('team-disabled', 'client-A', 'membresía desactivada'),
    ('portal-A', 'client-other', 'titular de otro cliente del mismo tenant'),
    ('portal-B', 'client-A', 'titular de otro tenant con el mismo Shipping Mark'),
    ('revoked', 'client-revoked', 'vínculo revocado'),
    ('unbound', 'client-A', 'sin membresía ni vínculo')
  ) v(actor, client, label) loop
    perform pg_temp.as_principal(cross_case.actor);
    blocked := false;
    begin
      insert into public.client_delivery_addresses (client_id, tenant_id, client_markbox, line)
      values (pg_temp.fixture_id(cross_case.client), pg_temp.fixture_id('tenant-A'), 'forged', 'forbidden');
    exception when insufficient_privilege then
      blocked := true;
      get stacked diagnostics message = message_text;
      if message ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' or message ~ 'DUP|OTHER|RETIRED' then
        raise exception 'TEST 0453: el mensaje del trigger expone ids o Shipping Marks: %', message;
      end if;
    end;
    perform pg_temp.assert_true(blocked, 'Trigger sin RLS rechaza con 42501 a ' || cross_case.label);
  end loop;
  perform pg_temp.assert_true(original = pg_temp.rows_snapshot(), 'Los rechazos del trigger no dejan filas');

  -- Lo legítimo se acepta y se sella igual que en 0198.
  perform pg_temp.as_principal('team-A');
  insert into public.client_delivery_addresses (client_id, tenant_id, client_markbox, line)
  values (pg_temp.fixture_id('client-other'), pg_temp.fixture_id('tenant-B'), 'forged', 'staff-own-tenant')
  returning * into v_row;
  perform pg_temp.assert_true(v_row.tenant_id = pg_temp.fixture_id('tenant-A') and v_row.client_markbox = 'OTHER',
    'Equipo del tenant escribe sin RLS y el trigger sella tenant y Shipping Mark');
  update public.client_delivery_addresses set client_id = pg_temp.fixture_id('client-A') where id = v_row.id
  returning * into v_row;
  perform pg_temp.assert_true(v_row.client_markbox = 'DUP', 'Equipo mueve una dirección entre clientes del mismo tenant (como merge_clients)');
  blocked := false;
  begin
    update public.client_delivery_addresses set client_id = pg_temp.fixture_id('client-B') where id = v_row.id;
  exception when insufficient_privilege then blocked := true; end;
  perform pg_temp.assert_true(blocked, 'Equipo no mueve una dirección a un cliente de otro tenant');
  delete from public.client_delivery_addresses where id = v_row.id;

  -- Dos membresías activas: el trigger valida la pertenencia al tenant CONCRETO
  -- del cliente, donde no hay ambigüedad; la ambigüedad la cierra get_user_tenant_id().
  perform pg_temp.as_principal('team-multi');
  insert into public.client_delivery_addresses (client_id, tenant_id, client_markbox, line)
  values (pg_temp.fixture_id('client-A'), pg_temp.fixture_id('tenant-B'), 'forged', 'multi-A')
  returning * into v_row;
  perform pg_temp.assert_true(v_row.tenant_id = pg_temp.fixture_id('tenant-A') and v_row.client_markbox = 'DUP',
    'Miembro de dos tenants escribe sin RLS en A: membresía verificada contra el tenant del cliente');
  delete from public.client_delivery_addresses where id = v_row.id;
  insert into public.client_delivery_addresses (client_id, tenant_id, client_markbox, line)
  values (pg_temp.fixture_id('client-B'), pg_temp.fixture_id('tenant-A'), 'forged', 'multi-B')
  returning * into v_row;
  perform pg_temp.assert_true(v_row.tenant_id = pg_temp.fixture_id('tenant-B') and v_row.client_markbox = 'DUP',
    'Miembro de dos tenants escribe sin RLS en B por la misma regla');
  delete from public.client_delivery_addresses where id = v_row.id;

  perform pg_temp.as_principal('portal-A');
  insert into public.client_delivery_addresses (client_id, tenant_id, client_markbox, line)
  values (pg_temp.fixture_id('client-A'), pg_temp.fixture_id('tenant-B'), 'forged', 'portal-own')
  returning * into v_row;
  perform pg_temp.assert_true(v_row.tenant_id = pg_temp.fixture_id('tenant-A') and v_row.client_markbox = 'DUP',
    'Titular escribe su dirección sin RLS con sellado');
  blocked := false;
  begin
    update public.client_delivery_addresses set client_id = pg_temp.fixture_id('client-other') where id = v_row.id;
  exception when insufficient_privilege then blocked := true; end;
  perform pg_temp.assert_true(blocked, 'Titular no reasigna su dirección a otro cliente');
  update public.client_delivery_addresses set deleted_at = now() where id = v_row.id;
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 1, 'Titular borra lógicamente su dirección sin RLS (camino del comando 0427)');
  delete from public.client_delivery_addresses where id = v_row.id;

  -- Sin principal (lotes, service_role, backfill de 0198): sellado intacto.
  perform pg_temp.as_principal('');
  insert into public.client_delivery_addresses (client_id, tenant_id, client_markbox, line)
  values (pg_temp.fixture_id('client-B'), pg_temp.fixture_id('tenant-A'), 'forged', 'batch')
  returning * into v_row;
  perform pg_temp.assert_true(v_row.tenant_id = pg_temp.fixture_id('tenant-B') and v_row.client_markbox = 'DUP',
    'Sin principal el trigger conserva el sellado de 0198');
  delete from public.client_delivery_addresses where id = v_row.id;
  execute 'set local role service_role';
  insert into public.client_delivery_addresses (client_id, tenant_id, client_markbox, line)
  values (pg_temp.fixture_id('client-A'), pg_temp.fixture_id('tenant-B'), 'forged', 'service')
  returning * into v_row;
  execute 'reset role';
  perform pg_temp.assert_true(v_row.tenant_id = pg_temp.fixture_id('tenant-A') and v_row.client_markbox = 'DUP',
    'service_role sin JWT conserva el sellado');
  delete from public.client_delivery_addresses where id = v_row.id;

  -- Cliente inexistente o borrado: 23514 como en 0198, ya sin el uuid en el mensaje.
  perform pg_temp.as_principal('team-A');
  blocked := false;
  begin
    insert into public.client_delivery_addresses (client_id, tenant_id, client_markbox, line)
    values (pg_temp.fixture_id('client-retired'), pg_temp.fixture_id('tenant-A'), 'RETIRED', 'forbidden');
  exception when check_violation then
    blocked := true;
    get stacked diagnostics message = message_text;
    if message ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' then
      raise exception 'TEST 0453: el mensaje de cliente borrado expone el id: %', message;
    end if;
  end;
  perform pg_temp.assert_true(blocked, 'Cliente borrado sigue rechazado con 23514, sin id en el mensaje');
  perform pg_temp.assert_true(original = pg_temp.rows_snapshot(), 'Las escrituras legítimas se limpiaron');
end;
$trigger_owner$;

-- 6f · Trigger tras un comando SECURITY DEFINER real, llamado como authenticated.
set local role authenticated;
do $trigger_definer$
declare blocked boolean; v_id uuid; cross_case record;
begin
  for cross_case in select * from (values
    ('incoherent', 'client-B'), ('retired', 'client-other'), ('team-A', 'client-B'),
    ('portal-A', 'client-other'), ('portal-B', 'client-A'), ('team-disabled', 'client-A')
  ) v(actor, client) loop
    perform pg_temp.as_principal(cross_case.actor);
    blocked := false;
    begin
      perform public.fixture_0453_definer_insert(pg_temp.fixture_id(cross_case.client), 'forbidden');
    exception when insufficient_privilege then blocked := true; end;
    perform pg_temp.assert_true(blocked, 'Comando DEFINER: ' || cross_case.actor || ' no escribe direcciones de ' || cross_case.client);
  end loop;
  perform pg_temp.as_principal('portal-A');
  v_id := public.fixture_0453_definer_insert(pg_temp.fixture_id('client-A'), 'definer-own');
  perform pg_temp.assert_true(v_id is not null, 'Comando DEFINER: el titular escribe su propia dirección');
  perform pg_temp.as_principal('team-A');
  v_id := public.fixture_0453_definer_insert(pg_temp.fixture_id('client-other'), 'definer-staff');
  perform pg_temp.assert_true(v_id is not null, 'Comando DEFINER: el equipo escribe direcciones de su tenant');
end;
$trigger_definer$;
reset role;
delete from public.client_delivery_addresses where line in ('definer-own', 'definer-staff');

-- 6g · Caminos con RLS (sesión): sin cambios de resultado.
set local role authenticated;
do $session_paths$
declare blocked boolean; n bigint; actor text;
begin
  perform pg_temp.as_principal('portal-A');
  insert into public.client_delivery_addresses (client_id, tenant_id, client_markbox, line)
  values (pg_temp.fixture_id('client-A'), pg_temp.fixture_id('tenant-B'), 'forged', 'session-own');
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 1, 'Portal: INSERT propio por sesión sigue pasando RLS y trigger');
  update public.client_delivery_addresses set line = 'session-own-edited' where line = 'session-own';
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 1, 'Portal: UPDATE propio por sesión');
  foreach actor in array array['incoherent', 'retired', 'revoked', 'invited', 'unbound', 'team-B'] loop
    perform pg_temp.as_principal(actor);
    blocked := false;
    begin
      insert into public.client_delivery_addresses (client_id, tenant_id, client_markbox, line)
      values (pg_temp.fixture_id('client-A'), pg_temp.fixture_id('tenant-A'), 'DUP', 'forbidden');
    exception when insufficient_privilege then blocked := true; end;
    perform pg_temp.assert_true(blocked, actor || ': INSERT por sesión sigue en 42501');
  end loop;
  perform pg_temp.as_principal('team-A');
  insert into public.client_delivery_addresses (client_id, tenant_id, client_markbox, line)
  values (pg_temp.fixture_id('client-other'), pg_temp.fixture_id('tenant-A'), 'OTHER', 'session-staff');
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 1, 'Equipo: INSERT por sesión en su tenant');
  blocked := false;
  begin
    insert into public.client_delivery_addresses (client_id, tenant_id, client_markbox, line)
    values (pg_temp.fixture_id('client-B'), pg_temp.fixture_id('tenant-A'), 'DUP', 'forbidden');
  exception when insufficient_privilege then blocked := true; end;
  perform pg_temp.assert_true(blocked, 'Equipo: INSERT para un cliente de otro tenant sigue en 42501');
end;
$session_paths$;
reset role;
delete from public.client_delivery_addresses where line in ('session-own-edited', 'session-staff');

-- 6h · El comando 0427 (SECURITY DEFINER) sigue funcionando con el trigger nuevo.
create temporary table before_delete as select pg_temp.rows_snapshot() as rows;
set local role authenticated;
select pg_temp.as_principal('portal-A');
select pg_temp.assert_true(public.delete_portal_delivery_address(pg_temp.fixture_id('address-A'), pg_temp.fixture_id('corr-own')),
  'Comando 0427: el titular borra su dirección y el trigger la acepta');
select pg_temp.as_principal('incoherent');
select pg_temp.assert_true(public.delete_portal_delivery_address(pg_temp.fixture_id('address-B'), pg_temp.fixture_id('corr-incoherent')) is false,
  'Comando 0427: el vínculo incoherente sigue sin borrar');
select pg_temp.as_principal('retired');
select pg_temp.assert_true(public.delete_portal_delivery_address(pg_temp.fixture_id('address-retired'), pg_temp.fixture_id('corr-retired')) is false,
  'Comando 0427: el vínculo con cliente borrado sigue sin borrar');
reset role;
select pg_temp.assert_true(
  (select count(*) from public.client_delivery_addresses where id = pg_temp.fixture_id('address-A') and deleted_at is not null) = 1
  and (select count(*) from public.entity_audit_log where entity_id = pg_temp.fixture_id('address-A')) = 1,
  'Comando 0427: borrado lógico y evento durable, uno solo');
select pg_temp.assert_true(
  (select rows - 'addresses' - 'audit' from before_delete) = pg_temp.rows_snapshot() - 'addresses' - 'audit',
  'Comando 0427: clientes, vínculos y membresías intactos');

-- 6i · Renombre de Shipping Mark como lo hace rename_client_markbox (dueño con JWT del equipo).
savepoint rename_probe;
select pg_temp.as_principal('team-A');
update public.clients set markbox = 'RENAMED-0453' where id = pg_temp.fixture_id('client-A');
update public.client_delivery_addresses set client_markbox = 'RENAMED-0453'
where tenant_id = pg_temp.fixture_id('tenant-A') and client_markbox = 'DUP';
select pg_temp.assert_true(
  (select bool_and(client_markbox = 'RENAMED-0453') from public.client_delivery_addresses where client_id = pg_temp.fixture_id('client-A')),
  'Renombre por el equipo del tenant pasa el trigger y sella el Shipping Mark nuevo');
set local role authenticated;
select pg_temp.as_principal('portal-A');
select pg_temp.assert_true(public.get_portal_client_markbox() = 'RENAMED-0453', 'La helper sigue al renombre');
reset role;
rollback to rename_probe;
release rename_probe;

select last_value as assertions_0453 from assertion_count;
rollback;
do $$ begin
  if to_regclass('public.client_delivery_addresses') is not null or to_regnamespace('auth') is not null
    or to_regnamespace('portal_address_private') is not null then raise exception 'TEST 0453: rollback incompleto'; end if;
end $$;
