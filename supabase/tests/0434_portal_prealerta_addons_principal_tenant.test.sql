\set ON_ERROR_STOP on
-- SDD-0402: PostgreSQL local y principals exclusivamente sintéticos.
-- RED: psql -v apply_fix=false -f este archivo.
-- GREEN por defecto: aplica 0434; apply_fix=false conserva el fallo histórico.
\if :{?apply_fix}
\else
\set apply_fix true
\endif

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;
create schema auth;
grant usage on schema auth to authenticated, service_role;
create function auth.uid() returns uuid
language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.clients (
  id uuid primary key,
  tenant_id uuid not null,
  markbox text not null,
  deleted_at timestamptz
);
create table public.client_users (
  auth_user_id uuid primary key,
  tenant_id uuid not null,
  client_id uuid not null references public.clients(id),
  status text not null
);
create table public.user_tenants (
  user_id uuid primary key,
  tenant_id uuid not null,
  disabled_at timestamptz
);
create table public.prealerta_addons (
  id uuid primary key,
  tenant_id uuid not null,
  code text not null,
  is_active boolean not null default true
);

create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select ut.tenant_id from public.user_tenants ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;
create function public.get_portal_client_tenant() returns uuid
language sql stable security definer set search_path = '' as $$
  select cu.tenant_id from public.client_users cu
  where cu.auth_user_id = (select auth.uid()) and cu.status = 'active' limit 1
$$;

grant select, insert, update, delete on public.prealerta_addons to authenticated;
grant all on public.prealerta_addons to service_role;
grant select on public.clients, public.client_users, public.user_tenants
  to authenticated;
alter table public.clients enable row level security;
alter table public.client_users enable row level security;
alter table public.prealerta_addons enable row level security;

create policy "clients portal self read" on public.clients
  for select to authenticated
  using (
    deleted_at is null and exists (
      select 1 from public.client_users cu
      where cu.auth_user_id = (select auth.uid())
        and cu.status = 'active'
        and cu.client_id = clients.id
        and cu.tenant_id = clients.tenant_id
    )
  );
create policy "client_users self read" on public.client_users
  for select to authenticated
  using (auth_user_id = (select auth.uid()));
create policy "prealerta_addons read" on public.prealerta_addons
  for select to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    or tenant_id = public.get_portal_client_tenant()
  );
create policy "prealerta_addons tenant write" on public.prealerta_addons
  for all to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());
create policy "prealerta_addons service_role all" on public.prealerta_addons
  for all to service_role using (true) with check (true);

insert into public.clients values
  ('31000000-4340-4000-8000-000000000001', '10000000-4340-4000-8000-000000000001', 'OWN', null),
  ('32000000-4340-4000-8000-000000000001', '20000000-4340-4000-8000-000000000002', 'OTHER', null),
  ('31000000-4340-4000-8000-000000000003', '10000000-4340-4000-8000-000000000001', 'DEAD', now());
insert into public.client_users values
  ('aaaaaaaa-4340-4000-8000-000000000101', '10000000-4340-4000-8000-000000000001', '31000000-4340-4000-8000-000000000001', 'active'),
  ('aaaaaaaa-4340-4000-8000-000000000102', '10000000-4340-4000-8000-000000000001', '32000000-4340-4000-8000-000000000001', 'active'),
  ('aaaaaaaa-4340-4000-8000-000000000103', '10000000-4340-4000-8000-000000000001', '31000000-4340-4000-8000-000000000001', 'revoked'),
  ('aaaaaaaa-4340-4000-8000-000000000104', '10000000-4340-4000-8000-000000000001', '31000000-4340-4000-8000-000000000003', 'active');
insert into public.user_tenants values
  ('aaaaaaaa-4340-4000-8000-000000000001', '10000000-4340-4000-8000-000000000001', null);
insert into public.prealerta_addons values
  ('41000000-4340-4000-8000-000000000001', '10000000-4340-4000-8000-000000000001', 'tenant-a', true),
  ('42000000-4340-4000-8000-000000000001', '20000000-4340-4000-8000-000000000002', 'tenant-b', true);

-- La rama Portal histórica acepta el tenant del vínculo sin validar su cliente.
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4340-4000-8000-000000000102';
do $historical_bug$
begin
  if (select array_agg(code order by code) from public.prealerta_addons)
     is distinct from array['tenant-a']::text[] then
    raise exception 'TEST 0434: no reprodujo catálogo por vínculo incoherente';
  end if;
  raise notice 'TEST 0434 RED baseline: vínculo incoherente lee catálogo tenant A';
end;
$historical_bug$;
reset role;

create temporary table unchanged_policy_baseline as
  select to_jsonb(p) as definition from pg_catalog.pg_policies p
  where schemaname = 'public' and tablename = 'prealerta_addons'
    and policyname <> 'prealerta_addons read';
create temporary table table_baseline as
  select relacl, relrowsecurity from pg_catalog.pg_class
  where oid = 'public.prealerta_addons'::regclass;

\if :apply_fix
\ir ../migrations/0434_portal_prealerta_addons_principal_tenant.sql

do $preflight_drift$
declare v record; v_rejected boolean;
begin
  for v in select * from (values
    ('create policy "0434 unexpected" on public.prealerta_addons for select to authenticated using (true)',
     '0434: inventario de policies ausente o con drift'),
    ('drop policy "prealerta_addons read" on public.prealerta_addons',
     '0434: inventario de policies ausente o con drift'),
    ('alter table public.prealerta_addons disable row level security',
     '0434: tabla ausente o sin RLS: prealerta_addons')
  ) d(ddl, expected) loop
    begin
      execute v.ddl;
      begin
        execute pg_catalog.pg_read_file(
          '/sb/migrations/0434_portal_prealerta_addons_principal_tenant.sql'
        );
      exception when others then
        v_rejected := position(v.expected in sqlerrm) > 0;
      end;
      raise exception 'rollback drift';
    exception when raise_exception then
      if sqlerrm <> 'rollback drift' then raise; end if;
    end;
    if not v_rejected then
      raise exception 'TEST 0434: preflight aceptó drift: %', v.ddl;
    end if;
    v_rejected := false;
  end loop;
end;
$preflight_drift$;
\endif

do $unchanged$
begin
  if exists (
    (select to_jsonb(p) from pg_catalog.pg_policies p
     where schemaname = 'public' and tablename = 'prealerta_addons'
       and policyname <> 'prealerta_addons read')
    except table unchanged_policy_baseline
  ) or exists (
    table unchanged_policy_baseline except
    select to_jsonb(p) from pg_catalog.pg_policies p
    where schemaname = 'public' and tablename = 'prealerta_addons'
      and policyname <> 'prealerta_addons read'
  ) then raise exception 'TEST 0434: cambió una policy ajena'; end if;
  if exists (
    (select relacl, relrowsecurity from pg_catalog.pg_class
     where oid = 'public.prealerta_addons'::regclass)
    except table table_baseline
  ) then raise exception 'TEST 0434: cambió ACL de tabla o RLS'; end if;
end;
$unchanged$;

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4340-4000-8000-000000000101';
do $coherent$
begin
  if (select array_agg(code order by code) from public.prealerta_addons)
     is distinct from array['tenant-a']::text[] then
    raise exception 'TEST 0434: principal coherente perdió su catálogo';
  end if;
end;
$coherent$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4340-4000-8000-000000000102';
do $incoherent$
begin
  if (select count(*) from public.prealerta_addons) <> 0 then
    raise exception 'TEST 0434: vínculo incoherente todavía lee catálogo';
  end if;
end;
$incoherent$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4340-4000-8000-000000000103';
do $revoked$
begin
  if (select count(*) from public.prealerta_addons) <> 0 then
    raise exception 'TEST 0434: vínculo revocado leyó catálogo';
  end if;
end;
$revoked$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4340-4000-8000-000000000104';
do $deleted_client$
begin
  if (select count(*) from public.prealerta_addons) <> 0 then
    raise exception 'TEST 0434: cliente borrado leyó catálogo';
  end if;
end;
$deleted_client$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4340-4000-8000-000000000001';
do $staff$
declare v_blocked boolean := false;
begin
  if (select array_agg(code order by code) from public.prealerta_addons)
     is distinct from array['tenant-a']::text[] then
    raise exception 'TEST 0434: staff perdió el catálogo de su tenant';
  end if;
  insert into public.prealerta_addons values
    ('41000000-4340-4000-8000-000000000002', '10000000-4340-4000-8000-000000000001', 'staff-write', true);
  begin
    insert into public.prealerta_addons values
      ('42000000-4340-4000-8000-000000000002', '20000000-4340-4000-8000-000000000002', 'cross-write', true);
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'TEST 0434: staff escribió otro tenant'; end if;
end;
$staff$;
reset role;

set local role service_role;
do $service$
begin
  if (select count(*) from public.prealerta_addons) <> 3 then
    raise exception 'TEST 0434: service_role perdió filas';
  end if;
end;
$service$;
reset role;

rollback;
select to_regclass('public.prealerta_addons') is null
  as portal_addons_0434_fixture_rolled_back;
