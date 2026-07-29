\set ON_ERROR_STOP on

begin;

do $fixture_guard$
begin
  if to_regclass('public.acl_0263_existing_probe') is not null
     or to_regclass('public.acl_0263_future_probe') is not null then
    raise exception 'Fixture 0263 rechazada: los objetos de prueba ya existen';
  end if;

  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end
$fixture_guard$;

create table public.acl_0263_existing_probe (
  id bigint primary key
);

grant select on table public.acl_0263_existing_probe to anon;
grant select, insert, update
  on table public.acl_0263_existing_probe
  to authenticated;
grant all privileges
  on table public.acl_0263_existing_probe
  to service_role;

create temporary table acl_0263_existing_before as
select relacl
from pg_class
where oid = 'public.acl_0263_existing_probe'::regclass;

alter default privileges for role postgres in schema public
  grant all privileges on tables to anon, authenticated, service_role;

\ir ../migrations/0263_harden_postgres_public_default_table_acl.sql

do $existing_assertion$
declare
  v_before aclitem[];
  v_after aclitem[];
begin
  select relacl into v_before from acl_0263_existing_before;
  select relacl into v_after
  from pg_class
  where oid = 'public.acl_0263_existing_probe'::regclass;

  if v_after is distinct from v_before then
    raise exception 'TEST 0263: cambió el ACL de una tabla existente';
  end if;
end
$existing_assertion$;

create table public.acl_0263_future_probe (
  id bigint primary key
);

do $future_assertions$
declare
  v_role text;
  v_actual text[];
  v_service_expected text[];
begin
  foreach v_role in array array['anon', 'authenticated']
  loop
    select coalesce(
      array_agg(acl.privilege_type order by acl.privilege_type),
      array[]::text[]
    )
      into v_actual
    from pg_class as c
    cross join lateral aclexplode(
      coalesce(c.relacl, acldefault('r', c.relowner))
    ) as acl
    join pg_roles as grantee on grantee.oid = acl.grantee
    where c.oid = 'public.acl_0263_future_probe'::regclass
      and grantee.rolname = v_role;

    if cardinality(v_actual) <> 0 then
      raise exception
        'TEST 0263: una tabla futura heredó privilegios para %: %',
        v_role, v_actual;
    end if;
  end loop;

  select array_agg(acl.privilege_type order by acl.privilege_type)
    into v_service_expected
  from pg_default_acl as d
  cross join lateral aclexplode(d.defaclacl) as acl
  join pg_roles as grantee on grantee.oid = acl.grantee
  where d.defaclrole = 'postgres'::regrole
    and d.defaclnamespace = 'public'::regnamespace
    and d.defaclobjtype = 'r'
    and grantee.rolname = 'service_role';

  select array_agg(acl.privilege_type order by acl.privilege_type)
    into v_actual
  from pg_class as c
  cross join lateral aclexplode(
    coalesce(c.relacl, acldefault('r', c.relowner))
  ) as acl
  join pg_roles as grantee on grantee.oid = acl.grantee
  where c.oid = 'public.acl_0263_future_probe'::regclass
    and grantee.rolname = 'service_role';

  if v_actual is distinct from v_service_expected then
    raise exception
      'TEST 0263: una tabla futura no preservó service_role: esperado %, actual %',
      v_service_expected, v_actual;
  end if;
end
$future_assertions$;

rollback;

select
  to_regclass('public.acl_0263_existing_probe') is null
  and to_regclass('public.acl_0263_future_probe') is null
  as acl_0263_fixture_rolled_back;
