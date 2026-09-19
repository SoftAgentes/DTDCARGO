-- Lecturas de catálogo para SDD-0485 / migración 0465. Sin filas de negocio.
-- A · identidad de aplicación y versión
select current_user, session_user, current_setting('server_version_num') as server_version_num,
       pg_has_role(current_user, 'postgres', 'USAGE') as puede_postgres,
       pg_has_role(current_user, 'supabase_admin', 'USAGE') as puede_supabase_admin,
       pg_has_role('postgres', 'supabase_admin', 'MEMBER') as postgres_miembro_de_supabase_admin;

-- B · relaciones de public por tipo y dueño
select c.relkind, pg_get_userbyid(c.relowner) as owner, count(*) as n
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p','v','m','f','S')
group by 1, 2 order by 1, 2;

-- C · privilegios de tabla de anon / authenticated / PUBLIC en public (conteos)
select c.relkind, coalesce(g.rolname, 'PUBLIC') as grantee, a.privilege_type,
       a.is_grantable, pg_get_userbyid(a.grantor) as grantor, count(*) as n
from pg_class c
cross join lateral aclexplode(c.relacl) a
left join pg_roles g on g.oid = a.grantee
where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p','v','m','f','S')
  and (g.rolname in ('anon', 'authenticated') or a.grantee = 0)
group by 1, 2, 3, 4, 5 order by 2, 1, 3;

-- D · relaciones donde anon tiene SELECT (efectivo), con RLS y policies para anon/public
select c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname
           and p.roles && array['anon', 'public']::name[]) as policies_anon_o_public,
       (select string_agg(a.privilege_type, ',' order by a.privilege_type)
          from aclexplode(c.relacl) a where a.grantee = 'anon'::regrole) as privilegios_anon
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p','v','m','f')
  and has_table_privilege('anon', c.oid, 'SELECT')
order by 1;

-- E · privilegios por columna de anon / authenticated / PUBLIC en public (conteos)
select coalesce(g.rolname, 'PUBLIC') as grantee, a.privilege_type,
       count(distinct c.oid) as relaciones, count(*) as columnas
from pg_attribute at
join pg_class c on c.oid = at.attrelid
cross join lateral aclexplode(at.attacl) a
left join pg_roles g on g.oid = a.grantee
where c.relnamespace = 'public'::regnamespace and at.attacl is not null
  and (g.rolname in ('anon', 'authenticated') or a.grantee = 0)
group by 1, 2 order by 1, 2;

-- F · default privileges de todos los roles (public y globales)
select pg_get_userbyid(d.defaclrole) as rol, coalesce(n.nspname, '<global>') as schema,
       d.defaclobjtype, d.defaclacl::text as acl
from pg_default_acl d
left join pg_namespace n on n.oid = d.defaclnamespace
order by 1, 2, 3;

-- G · funciones INVOKER ejecutables por anon/authenticated cuyo cuerpo menciona
--     operaciones que exigen MAINTAIN, TRIGGER o REFERENCES (sólo nombres).
--     Control positivo: total de INVOKER ejecutables por esos roles.
select count(*) filter (where true) as invoker_ejecutables,
       count(*) filter (where p.prosrc ~* '\m(lock|refresh\s+materialized|vacuum|analyze|cluster|reindex|create\s+(constraint\s+)?trigger|references)\M') as mencionan_mantenimiento
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname not in ('pg_catalog', 'information_schema') and not p.prosecdef
  and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'));

select p.oid::regprocedure as funcion, n.nspname,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec,
       (select string_agg(distinct lower(m[1]), ',') from regexp_matches(p.prosrc,
          '\m(lock|refresh\s+materialized|vacuum|analyze|cluster|reindex|create\s+(?:constraint\s+)?trigger|references)\M', 'gi') m) as menciones
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname not in ('pg_catalog', 'information_schema') and not p.prosecdef
  and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  and p.prosrc ~* '\m(lock|refresh\s+materialized|vacuum|analyze|cluster|reindex|create\s+(constraint\s+)?trigger|references)\M'
order by 2, 1;

-- H · event triggers (pueden re-conceder privilegios a tablas nuevas)
select e.evtname, e.evtevent, pg_get_userbyid(e.evtowner) as owner, e.evtenabled, e.evtfoid::regproc as funcion
from pg_event_trigger e order by 1;

-- I · vistas y vistas materializadas de public con security_invoker
select c.relname, c.relkind, pg_get_userbyid(c.relowner) as owner,
       coalesce((select option_value from pg_options_to_table(c.reloptions) where option_name = 'security_invoker'), 'false') as security_invoker
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind in ('v', 'm')
order by 1;
