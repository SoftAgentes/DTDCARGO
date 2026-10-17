# infra/ops/lib/acl.sh — permisos de `public` para los roles cliente (SDD-0505).
#
# Se carga con `source`; no corre solo. Lo usan import-from-cloud.sh (igualar el
# staging a Cloud), pg-dump-to-s3.sh (guardar los permisos del origen junto al
# dump) y restore.sh (igualarlos y compararlos después de restaurar).
#
# Por qué hace falta: restaurando como supabase_admin, los default privileges que
# la imagen supabase/postgres le da a ese rol en `public` abren ALL a anon y
# authenticated en cada objeto que crea pg_restore, y el dump no los revoca
# (solo emite lo que difiere de acldefault). Medido en el traslado el 2026-10-09
# (docs/runbooks/servidor-contabo.md §2.2).
#
# ACL_SYNC_SQL devuelve, ejecutado en el ORIGEN, el SQL que deja otra base con los
# mismos permisos: revoke de todo a los roles cliente y los grants exactos.
# ACL_FINGERPRINT_SQL devuelve `<cantidad>:<md5>` de esos permisos; dos bases con
# la misma huella dan los mismos permisos a anon, authenticated, service_role y
# PUBLIC sobre todo lo de `public`.

# shellcheck disable=SC2034  # las variables se usan donde se carga
# Objetos de public y sus permisos para los roles cliente (anon, authenticated,
# service_role y PUBLIC). Con search_path vacío todo sale calificado, así la salida
# no depende del search_path de quien la corre. Un ACL nulo vale lo que
# acldefault (en funciones: EXECUTE para PUBLIC).
ACL_CTES="$(cat <<'SQL'
with rel as (
  select c.relkind, c.relowner, c.relacl,
         pg_catalog.format('%I.%I', n.nspname, c.relname) as name,
         case when c.relkind = 'S' then 'sequence' else 'table' end as kind
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
), fn as (
  select p.proowner, p.proacl,
         pg_catalog.format('%I.%I(%s)', n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid)) as name,
         case p.prokind when 'p' then 'procedure' else 'function' end as kind
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f', 'p', 'w')
), col as (
  select a.attacl, pg_catalog.quote_ident(a.attname) as col,
         pg_catalog.format('%I.%I', n.nspname, c.relname) as name
  from pg_catalog.pg_attribute a
  join pg_catalog.pg_class c on c.oid = a.attrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and a.attnum > 0 and not a.attisdropped and a.attacl is not null
), grants as (
  select r.kind, r.name, null::text as col, x.grantee, x.privilege_type, x.is_grantable
  from rel r
  cross join lateral pg_catalog.aclexplode(coalesce(r.relacl,
    pg_catalog.acldefault(case when r.relkind = 'S' then 's'::"char" else 'r'::"char" end, r.relowner))) x
  union all
  select f.kind, f.name, null, x.grantee, x.privilege_type, x.is_grantable
  from fn f
  cross join lateral pg_catalog.aclexplode(coalesce(f.proacl, pg_catalog.acldefault('f'::"char", f.proowner))) x
  union all
  select 'table', c.name, c.col, x.grantee, x.privilege_type, x.is_grantable
  from col c
  cross join lateral pg_catalog.aclexplode(c.attacl) x
), client as (
  select g.*, case when g.grantee = 0 then 'public' else pg_catalog.quote_ident(ro.rolname) end as who
  from grants g
  left join pg_catalog.pg_roles ro on ro.oid = g.grantee
  where g.grantee = 0 or ro.rolname in ('anon', 'authenticated', 'service_role')
)
SQL
)"
# Igualación: revoke de todo a los roles cliente y los grants exactos de Cloud.
ACL_SYNC_SQL="set search_path = '';
${ACL_CTES}
select s from (
  select 1 as ord, name, pg_catalog.format('revoke all on %s %s from public, anon, authenticated, service_role;', kind, name) as s from rel
  union all
  select 1, name, pg_catalog.format('revoke all on %s %s from public, anon, authenticated, service_role;', kind, name) from fn
  union all
  select 2, name, pg_catalog.format('grant %s%s on %s %s to %s%s;', privilege_type,
         coalesce(' (' || col || ')', ''), kind, name, who, case when is_grantable then ' with grant option' else '' end)
  from client
) t order by ord, name, s"
# Huella: cantidad y md5 de todos los permisos de los roles cliente en public.
ACL_FINGERPRINT_SQL="set search_path = '';
${ACL_CTES}
select count(*) || ':' || coalesce(pg_catalog.md5(string_agg(kind || ' ' || name || coalesce('.' || col, '') || ' '
       || who || ' ' || privilege_type || ' ' || is_grantable::text, ',' order by kind, name, col, who, privilege_type)), '-')
from client"
