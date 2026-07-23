-- ─────────────────────────────────────────────────────────────
-- 0263 · Hardening del ACL predeterminado de tablas public/postgres
--
-- Corrige únicamente tablas FUTURAS creadas por el rol postgres:
--   · anon: ningún privilegio predeterminado;
--   · authenticated: ningún privilegio predeterminado;
--   · service_role y postgres: ACL predeterminado preservado.
--
-- Deliberadamente NO cambia:
--   · grants de tablas ya existentes;
--   · defaults de secuencias o funciones;
--   · defaults del rol supabase_admin, que postgres no puede administrar.
--
-- REVISIÓN LOCAL SOLAMENTE. NO AUTORIZADA PARA CLOUD.
-- ─────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon')
     or not exists (select 1 from pg_roles where rolname = 'authenticated')
     or not exists (select 1 from pg_roles where rolname = 'service_role')
     or not exists (select 1 from pg_roles where rolname = 'postgres') then
    raise exception '0263 requiere los roles anon, authenticated, service_role y postgres';
  end if;

  if not exists (select 1 from pg_namespace where nspname = 'public') then
    raise exception '0263 requiere el schema public';
  end if;

  if not pg_has_role(current_user, 'postgres', 'USAGE') then
    raise exception '0263 requiere administrar los default privileges del rol postgres';
  end if;

  if not exists (
    select 1
    from pg_default_acl as d
    where d.defaclrole = 'postgres'::regrole
      and d.defaclnamespace = 'public'::regnamespace
      and d.defaclobjtype = 'r'
  ) then
    raise exception '0263 requiere el ACL predeterminado de tablas public/postgres';
  end if;

  if exists (
    select 1
    from pg_default_acl as d
    cross join lateral aclexplode(d.defaclacl) as acl
    join pg_roles as grantee on grantee.oid = acl.grantee
    where d.defaclrole = 'postgres'::regrole
      and d.defaclnamespace = 'public'::regnamespace
      and d.defaclobjtype = 'r'
      and grantee.rolname in ('anon', 'authenticated', 'service_role')
      and acl.is_grantable
  ) then
    raise exception '0263 detectó WITH GRANT OPTION inesperado en el ACL predeterminado';
  end if;
end
$preflight$;

create temporary table acl_0263_preserved_defaults
on commit drop
as
select
  grantee.rolname as role_name,
  array_agg(acl.privilege_type order by acl.privilege_type) as privileges
from pg_default_acl as d
cross join lateral aclexplode(d.defaclacl) as acl
join pg_roles as grantee on grantee.oid = acl.grantee
where d.defaclrole = 'postgres'::regrole
  and d.defaclnamespace = 'public'::regnamespace
  and d.defaclobjtype = 'r'
  and grantee.rolname in ('postgres', 'service_role')
group by grantee.rolname;

alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;

do $postconditions$
declare
  v_expected record;
  v_actual text[];
begin
  if exists (
    select 1
    from pg_default_acl as d
    cross join lateral aclexplode(d.defaclacl) as acl
    join pg_roles as grantee on grantee.oid = acl.grantee
    where d.defaclrole = 'postgres'::regrole
      and d.defaclnamespace = 'public'::regnamespace
      and d.defaclobjtype = 'r'
      and grantee.rolname in ('anon', 'authenticated')
  ) then
    raise exception '0263 dejó privilegios predeterminados de tabla para anon/authenticated';
  end if;

  for v_expected in
    select role_name, privileges
    from acl_0263_preserved_defaults
  loop
    select array_agg(acl.privilege_type order by acl.privilege_type)
      into v_actual
    from pg_default_acl as d
    cross join lateral aclexplode(d.defaclacl) as acl
    join pg_roles as grantee on grantee.oid = acl.grantee
    where d.defaclrole = 'postgres'::regrole
      and d.defaclnamespace = 'public'::regnamespace
      and d.defaclobjtype = 'r'
      and grantee.rolname = v_expected.role_name;

    if v_actual is distinct from v_expected.privileges then
      raise exception
        '0263 cambió el ACL predeterminado preservado de %: esperado %, actual %',
        v_expected.role_name, v_expected.privileges, v_actual;
    end if;
  end loop;
end
$postconditions$;
