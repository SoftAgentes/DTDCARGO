-- ─────────────────────────────────────────────────────────────
-- 0261b · SDD-0168 DB-1 · ACL mínimo para comentarios
--
-- Corrige únicamente los grants directos de las tres tablas de comentarios:
--   · anon: ningún privilegio de tabla;
--   · authenticated: sólo el DML requerido por 0090_comments.sql;
--   · service_role y otros roles: sin cambios.
--
-- REVOKE ALL + GRANT explícito es intencional: también retira MAINTAIN en
-- PostgreSQL 17 sin introducir sintaxis incompatible con PostgreSQL 15.
--
-- Deliberadamente NO modifica ALTER DEFAULT PRIVILEGES ni otras tablas.
-- El ACL predeterminado global requiere una revisión sistémica separada.
--
-- REVISIÓN LOCAL SOLAMENTE. NO AUTORIZADA PARA CLOUD.
-- ─────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

-- ── 0. Preflight fail-closed ──────────────────────────────────

do $preflight$
declare
  v_table text;
  v_relkind "char";
  v_rls boolean;
begin
  if not exists (select 1 from pg_roles where rolname = 'anon')
     or not exists (select 1 from pg_roles where rolname = 'authenticated')
     or not exists (select 1 from pg_roles where rolname = 'service_role') then
    raise exception '0261b requiere los roles anon, authenticated y service_role';
  end if;

  foreach v_table in array array[
    'public.comments',
    'public.comment_mentions',
    'public.comment_reactions'
  ]
  loop
    if to_regclass(v_table) is null then
      raise exception '0261b requiere la tabla %', v_table;
    end if;

    select relkind, relrowsecurity
      into v_relkind, v_rls
    from pg_class
    where oid = to_regclass(v_table);

    if v_relkind <> 'r' then
      raise exception '0261b esperaba una tabla ordinaria en %, recibió relkind=%',
        v_table, v_relkind;
    end if;

    if not v_rls then
      raise exception '0261b requiere RLS activo en %', v_table;
    end if;

    if exists (
      select 1
      from pg_class as c
      cross join lateral aclexplode(
        coalesce(c.relacl, acldefault('r', c.relowner))
      ) as acl
      where c.oid = to_regclass(v_table)
        and acl.grantee = 0
    ) then
      raise exception
        '0261b detectó privilegios PUBLIC en %; su corrección queda fuera de este alcance',
        v_table;
    end if;
  end loop;
end
$preflight$;

-- ── 1. Sustituir ACL amplio por la matriz mínima de 0090 ─────

revoke all privileges
  on table public.comments, public.comment_mentions, public.comment_reactions
  from anon, authenticated;

grant select, insert, update
  on table public.comments, public.comment_mentions
  to authenticated;

grant select, insert, delete
  on table public.comment_reactions
  to authenticated;

-- ── 2. Postcondiciones exactas, independientes de la versión ─

do $postconditions$
declare
  v_contract record;
  v_actual text[];
  v_has_grant_option boolean;
  v_anon_count integer;
  v_public_count integer;
begin
  for v_contract in
    select *
    from (
      values
        (
          'public.comments'::text,
          array['INSERT', 'SELECT', 'UPDATE']::text[]
        ),
        (
          'public.comment_mentions'::text,
          array['INSERT', 'SELECT', 'UPDATE']::text[]
        ),
        (
          'public.comment_reactions'::text,
          array['DELETE', 'INSERT', 'SELECT']::text[]
        )
    ) as expected(table_name, privileges)
  loop
    select
      coalesce(
        array_agg(acl.privilege_type order by acl.privilege_type),
        array[]::text[]
      ),
      coalesce(bool_or(acl.is_grantable), false)
      into v_actual, v_has_grant_option
    from pg_class as c
    cross join lateral aclexplode(
      coalesce(c.relacl, acldefault('r', c.relowner))
    ) as acl
    join pg_roles as grantee
      on grantee.oid = acl.grantee
    where c.oid = to_regclass(v_contract.table_name)
      and grantee.rolname = 'authenticated';

    if v_actual is distinct from v_contract.privileges then
      raise exception
        '0261b dejó ACL authenticated inesperado en %: esperado %, actual %',
        v_contract.table_name, v_contract.privileges, v_actual;
    end if;

    if v_has_grant_option then
      raise exception
        '0261b dejó WITH GRANT OPTION para authenticated en %',
        v_contract.table_name;
    end if;

    select count(*)
      into v_anon_count
    from pg_class as c
    cross join lateral aclexplode(
      coalesce(c.relacl, acldefault('r', c.relowner))
    ) as acl
    join pg_roles as grantee
      on grantee.oid = acl.grantee
    where c.oid = to_regclass(v_contract.table_name)
      and grantee.rolname = 'anon';

    if v_anon_count <> 0 then
      raise exception
        '0261b dejó % privilegios directos para anon en %',
        v_anon_count, v_contract.table_name;
    end if;

    select count(*)
      into v_public_count
    from pg_class as c
    cross join lateral aclexplode(
      coalesce(c.relacl, acldefault('r', c.relowner))
    ) as acl
    where c.oid = to_regclass(v_contract.table_name)
      and acl.grantee = 0;

    if v_public_count <> 0 then
      raise exception
        '0261b dejó % privilegios PUBLIC en %',
        v_public_count, v_contract.table_name;
    end if;
  end loop;
end
$postconditions$;
