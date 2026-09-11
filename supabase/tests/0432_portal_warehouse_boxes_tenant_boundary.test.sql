\set ON_ERROR_STOP on
-- SDD-0400: PostgreSQL local y principals exclusivamente sintéticos.
-- RED: psql -v apply_fix=false -f este archivo.
-- GREEN por defecto: aplica 0432; apply_fix=false conserva el fallo histórico.
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
create table public.warehouse_boxes (
  id uuid primary key,
  tenant_id uuid not null,
  markbox text,
  deleted_at timestamptz
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
create function public.get_portal_client_markbox() returns text
language sql stable security definer set search_path = '' as $$
  select c.markbox from public.client_users cu
  join public.clients c on c.id = cu.client_id
  where cu.auth_user_id = (select auth.uid()) and cu.status = 'active' limit 1
$$;

grant select, insert, update, delete on public.warehouse_boxes to authenticated;
grant select, insert, update, delete on public.warehouse_boxes to service_role;
grant select on public.clients, public.client_users, public.user_tenants to authenticated;
alter table public.warehouse_boxes enable row level security;

create policy "warehouse_boxes by tenant" on public.warehouse_boxes for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
create policy "warehouse_boxes portal self read" on public.warehouse_boxes
  for select to authenticated
  using (
    tenant_id = public.get_portal_client_tenant()
    and markbox = public.get_portal_client_markbox()
    and deleted_at is null
  );

insert into public.clients values
  ('31000000-4320-4000-8000-000000000001', '10000000-4320-4000-8000-000000000001', 'DUP', null),
  ('32000000-4320-4000-8000-000000000001', '20000000-4320-4000-8000-000000000002', 'OTHER', null),
  ('31000000-4320-4000-8000-000000000003', '10000000-4320-4000-8000-000000000001', 'DEAD', now());
insert into public.client_users values
  ('aaaaaaaa-4320-4000-8000-000000000101', '10000000-4320-4000-8000-000000000001', '31000000-4320-4000-8000-000000000001', 'active'),
  ('aaaaaaaa-4320-4000-8000-000000000102', '10000000-4320-4000-8000-000000000001', '32000000-4320-4000-8000-000000000001', 'active'),
  ('aaaaaaaa-4320-4000-8000-000000000103', '10000000-4320-4000-8000-000000000001', '31000000-4320-4000-8000-000000000003', 'revoked');
insert into public.user_tenants values
  ('aaaaaaaa-4320-4000-8000-000000000001', '10000000-4320-4000-8000-000000000001', null);
insert into public.warehouse_boxes values
  ('41000000-4320-4000-8000-000000000001', '10000000-4320-4000-8000-000000000001', 'DUP', null),
  ('41000000-4320-4000-8000-000000000002', '10000000-4320-4000-8000-000000000001', 'OTHER', null),
  ('42000000-4320-4000-8000-000000000001', '20000000-4320-4000-8000-000000000002', 'DUP', null),
  ('42000000-4320-4000-8000-000000000002', '20000000-4320-4000-8000-000000000002', 'OTHER', null),
  ('41000000-4320-4000-8000-000000000003', '10000000-4320-4000-8000-000000000001', 'DUP', now());

-- La policy histórica combina tenant A con el Shipping Mark del cliente B.
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4320-4000-8000-000000000102';
do $historical_bug$
begin
  if (select count(*) from public.warehouse_boxes) <> 1 then
    raise exception 'TEST 0432: no reprodujo la lectura por vínculo incoherente';
  end if;
  raise notice 'TEST 0432 RED baseline: caja ajena visible con vínculo tenant/cliente incoherente';
end;
$historical_bug$;
reset role;

create temporary table unchanged_policy_baseline as
  select to_jsonb(p) as definition from pg_catalog.pg_policies p
  where schemaname = 'public' and tablename = 'warehouse_boxes'
    and policyname <> 'warehouse_boxes portal self read';
create temporary table table_baseline as
  select relacl, relrowsecurity from pg_catalog.pg_class
  where oid = 'public.warehouse_boxes'::regclass;

\if :apply_fix
\ir ../migrations/0432_portal_warehouse_boxes_tenant_boundary.sql

do $preflight_drift$
declare v record; v_rejected boolean;
begin
  for v in select * from (values
    ('create policy "0432 unexpected" on public.warehouse_boxes for select to authenticated using (true)',
     '0432: inventario de policies ausente o con drift'),
    ('drop policy "warehouse_boxes portal self read" on public.warehouse_boxes',
     '0432: inventario de policies ausente o con drift'),
    ('alter table public.warehouse_boxes disable row level security',
     '0432: tabla ausente o sin RLS: warehouse_boxes')
  ) d(ddl, expected) loop
    begin
      execute v.ddl;
      begin
        execute pg_catalog.pg_read_file('/sb/migrations/0432_portal_warehouse_boxes_tenant_boundary.sql');
      exception when others then
        v_rejected := position(v.expected in sqlerrm) > 0;
      end;
      raise exception 'rollback drift';
    exception when raise_exception then
      if sqlerrm <> 'rollback drift' then raise; end if;
    end;
    if not v_rejected then
      raise exception 'TEST 0432: preflight aceptó drift: %', v.ddl;
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
     where schemaname = 'public' and tablename = 'warehouse_boxes'
       and policyname <> 'warehouse_boxes portal self read')
    except table unchanged_policy_baseline
  ) or exists (
    table unchanged_policy_baseline except
    select to_jsonb(p) from pg_catalog.pg_policies p
    where schemaname = 'public' and tablename = 'warehouse_boxes'
      and policyname <> 'warehouse_boxes portal self read'
  ) then
    raise exception 'TEST 0432: cambió la policy de equipo';
  end if;
  if exists (
    (select relacl, relrowsecurity from pg_catalog.pg_class
     where oid = 'public.warehouse_boxes'::regclass)
    except table table_baseline
  ) then
    raise exception 'TEST 0432: cambió ACL o habilitación RLS';
  end if;
end;
$unchanged$;

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4320-4000-8000-000000000101';
do $coherent$
begin
  if (select count(*) from public.warehouse_boxes) <> 1 then
    raise exception 'TEST 0432: principal coherente no quedó en su única caja viva';
  end if;
end;
$coherent$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4320-4000-8000-000000000102';
do $invalid$
declare v_blocked boolean := false;
begin
  if (select count(*) from public.warehouse_boxes) <> 0 then
    raise exception 'TEST 0432: vínculo incoherente todavía lee cajas';
  end if;
  begin
    insert into public.warehouse_boxes values
      ('41000000-4320-4000-8000-000000000099', '10000000-4320-4000-8000-000000000001', 'OTHER', null);
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'TEST 0432: vínculo incoherente escribió caja'; end if;
end;
$invalid$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4320-4000-8000-000000000103';
do $revoked$
begin
  if (select count(*) from public.warehouse_boxes) <> 0 then
    raise exception 'TEST 0432: vínculo revocado leyó cajas';
  end if;
end;
$revoked$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4320-4000-8000-000000000001';
do $staff$
begin
  if (select count(*) from public.warehouse_boxes) <> 2 then
    raise exception 'TEST 0432: staff perdió su lectura tenant-wide';
  end if;
end;
$staff$;
reset role;

set local role service_role;
do $service$
begin
  if (select count(*) from public.warehouse_boxes) <> 5 then
    raise exception 'TEST 0432: service_role perdió filas';
  end if;
end;
$service$;
reset role;

rollback;
select to_regclass('public.warehouse_boxes') is null as portal_boxes_0432_fixture_rolled_back;
