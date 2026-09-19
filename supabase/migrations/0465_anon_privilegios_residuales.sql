-- ─────────────────────────────────────────────────────────────
-- 0465 · SDD-0485 · anon y authenticated pierden MAINTAIN, REFERENCES y
--        TRIGGER sobre las tablas y vistas de public.
--
-- EVIDENCIA. Catálogo de producción leído por el Director el 2026-09-18 con
-- aclexplode(relacl), sin filas de negocio:
--   · public tiene 264 tablas y 2 vistas, todas de postgres. PUBLIC no tiene
--     privilegios sobre ellas, nadie tiene grant option y el grantor es postgres.
--   · anon: MAINTAIN, REFERENCES y TRIGGER en 179 tablas y 1 vista, y SELECT en
--     5 tablas con RLS (back_glosario, back_noticias, back_servicios, news_posts
--     y ve_locality_catalog). Nada más: sin INSERT, UPDATE, DELETE ni TRUNCATE.
--   · authenticated: MAINTAIN, REFERENCES y TRIGGER en 195 tablas y 1 vista,
--     además del SELECT/INSERT/UPDATE/DELETE que gobiernan RLS y cada SDD.
--   · El default de postgres para tablas nuevas de public ya es
--     {postgres, service_role} (0263). TRUNCATE ya no está (0399).
--
-- Es el default de Supabase recortado sólo en parte: las tablas creadas antes
-- de 0263 nacieron con arwdDxtm para anon y authenticated, y las migraciones
-- siguientes quitaron el DML y TRUNCATE, pero no estos tres privilegios.
--
-- POR QUÉ SE QUITAN SI EL RIESGO ES BAJO. PostgREST no ejecuta DDL: ningún
-- camino de la API los usa.
--   · MAINTAIN: VACUUM, ANALYZE, CLUSTER, REINDEX, REFRESH MATERIALIZED VIEW y
--     LOCK TABLE en cualquier modo.
--   · REFERENCES: crear una FK que apunte a la tabla.
--   · TRIGGER: crear triggers sobre la tabla.
-- Es defensa en profundidad. Si mañana aparece una función INVOKER con SQL
-- dinámico expuesta por RPC, estos privilegios permitirían bloquear tablas o
-- engancharles triggers. Hoy, de las 172 funciones INVOKER que anon o
-- authenticated pueden ejecutar, ninguna los usa: la única mención es el tag de
-- comando dentro de extensions.pgrst_ddl_watch().
--
-- QUÉ NO TOCA, a propósito:
--   · SELECT, INSERT, UPDATE y DELETE de anon y authenticated, ni los
--     privilegios por columna (UPDATE de authenticated en 7 columnas).
--   · El SELECT de anon en las 5 tablas públicas: lo leen /noticias, el
--     contenido del sitio y el selector de ciudades del registro (SDD-0485).
--   · EXECUTE de funciones, secuencias, policies, service_role, postgres y los
--     demás schemas (storage, auth, realtime, payment_private...).
--   · Los default privileges. El de postgres ya está limpio y aquí se AFIRMA.
--     El de supabase_admin sigue dando todo a anon y authenticated, pero postgres
--     no lo puede cambiar («permission denied to change default privileges»,
--     medido en supabase/postgres:17.6.1.165) y hoy no hay ningún objeto de
--     supabase_admin en public. Queda como límite residual en SDD-0485.
--
-- CÓMO FALLA. Preflight, foto de los ACL, revoke y postflight van en UN solo
-- bloque DO: si algo no cuadra, aborta sin cambiar nada, haya o no transacción
-- externa. El postflight compara la foto de antes con la de después: lo único
-- que puede faltar son esos tres privilegios de anon y authenticated (más el
-- REFERENCES por columna, que PostgreSQL retira junto con el de tabla), y no
-- puede aparecer nada nuevo.
--
-- LOCKS, medidos en PostgreSQL 17 local (ver SDD-0485): REVOKE no pide locks de
-- tabla sobre las relaciones; reescribe sus filas de pg_class. Sólo espera si
-- otra transacción abierta modificó esa misma fila (un ALTER TABLE en curso,
-- por ejemplo); ahí corta lock_timeout y no queda nada a medias.
--
-- VUELTA ATRÁS: grant maintain, references, trigger sobre la lista exacta de
-- relaciones que el Director guarda antes de aplicar (consulta en SDD-0485).
-- Ningún camino conocido la necesita.
--
-- NO aplicar a producción desde la rama. Requiere OK nominal de Sam y
-- docs/runbooks/aplicar-migraciones-prod.md; name exacto
-- 0465_anon_privilegios_residuales.
-- ─────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

do $migracion_0465$
declare
  -- Las 5 tablas que anon lee por PostgREST, en orden alfabético.
  c_lectura_anon constant text[] := array[
    'back_glosario', 'back_noticias', 'back_servicios', 'news_posts',
    've_locality_catalog'
  ];
  c_tablas constant "char"[] := array['r', 'p', 'v', 'm', 'f']::"char"[];
  v_anon oid;
  v_authenticated oid;
  v_detalle text;
  v_acl_antes text[];
  v_acl_despues text[];
  v_cols_antes text[];
  v_cols_despues text[];
  v_quitados text[];
  v_agregados text[];
  v_lectura_anon text[];
begin
  -- ── Preflight ────────────────────────────────────────────
  if pg_catalog.current_setting('server_version_num')::int < 170000 then
    raise exception '0465 requiere PostgreSQL 17 o superior: el privilegio MAINTAIN no existe antes';
  end if;

  if (select count(*) from pg_catalog.pg_roles
      where rolname in ('anon', 'authenticated', 'service_role', 'postgres')) <> 4 then
    raise exception '0465 requiere los roles anon, authenticated, service_role y postgres';
  end if;
  v_anon := 'anon'::regrole;
  v_authenticated := 'authenticated'::regrole;

  if not pg_catalog.pg_has_role(current_user, 'postgres', 'USAGE') then
    raise exception '0465 debe correr como postgres: un revoke hecho por otro rol no tiene efecto sobre tablas de postgres';
  end if;

  -- Si una relación fuera de otro dueño, el revoke no la cubriría y el
  -- resultado mentiría.
  select string_agg(format('%s (%s)', c.oid::regclass, pg_catalog.pg_get_userbyid(c.relowner)),
                    ', ' order by c.oid::regclass::text)
    into v_detalle
  from pg_catalog.pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = any (c_tablas)
    and c.relowner <> 'postgres'::regrole;
  if v_detalle is not null then
    raise exception '0465 abortado: relaciones de public con dueño distinto de postgres: %', v_detalle;
  end if;

  -- Un grant option de anon o authenticated obligaría a revocar en cascada.
  select string_agg(x, ', ' order by x)
    into v_detalle
  from (
    select format('%s %s %s', c.oid::regclass, pg_catalog.pg_get_userbyid(a.grantee), a.privilege_type) as x
    from pg_catalog.pg_class c
    cross join lateral pg_catalog.aclexplode(c.relacl) a
    where c.relnamespace = 'public'::regnamespace
      and c.relkind = any (c_tablas)
      and a.grantee in (v_anon, v_authenticated)
      and a.is_grantable
  ) s;
  if v_detalle is not null then
    raise exception '0465 abortado: grant option inesperado para anon/authenticated: %', v_detalle;
  end if;

  -- anon tiene que estar como se inventarió: MAINTAIN, REFERENCES y TRIGGER
  -- donde sea, y SELECT sólo en las 5 tablas. Cualquier otra cosa (o un grant a
  -- PUBLIC, que anon hereda) es un cambio posterior al análisis de SDD-0485.
  select string_agg(x, ', ' order by x)
    into v_detalle
  from (
    select format('%s %s %s', c.oid::regclass,
                  coalesce(pg_catalog.pg_get_userbyid(nullif(a.grantee, 0)), 'PUBLIC'),
                  a.privilege_type) as x
    from pg_catalog.pg_class c
    cross join lateral pg_catalog.aclexplode(c.relacl) a
    where c.relnamespace = 'public'::regnamespace
      and c.relkind = any (c_tablas)
      and (a.grantee = 0
           or (a.grantee = v_anon
               and a.privilege_type not in ('MAINTAIN', 'REFERENCES', 'TRIGGER')
               and not (a.privilege_type = 'SELECT'
                        and c.relkind = 'r'
                        and c.relname::text = any (c_lectura_anon))))
  ) s;
  if v_detalle is not null then
    raise exception '0465 abortado: privilegios de anon/PUBLIC fuera del inventario de SDD-0485: %', v_detalle;
  end if;

  -- Por columna, anon y PUBLIC no tienen nada en producción.
  select string_agg(x, ', ' order by x)
    into v_detalle
  from (
    select format('%s.%s %s %s', c.oid::regclass, at.attname,
                  coalesce(pg_catalog.pg_get_userbyid(nullif(a.grantee, 0)), 'PUBLIC'),
                  a.privilege_type) as x
    from pg_catalog.pg_attribute at
    join pg_catalog.pg_class c on c.oid = at.attrelid
    cross join lateral pg_catalog.aclexplode(at.attacl) a
    where c.relnamespace = 'public'::regnamespace
      and at.attacl is not null
      and a.grantee in (0, v_anon)
  ) s;
  if v_detalle is not null then
    raise exception '0465 abortado: privilegios por columna de anon/PUBLIC fuera del inventario de SDD-0485: %', v_detalle;
  end if;

  select string_agg(format('%I', t.nombre), ', ' order by t.nombre)
    into v_detalle
  from unnest(c_lectura_anon) as t(nombre)
  where not exists (
    select 1
    from pg_catalog.pg_class c
    cross join lateral pg_catalog.aclexplode(c.relacl) a
    where c.relnamespace = 'public'::regnamespace
      and c.relname = t.nombre
      and c.relkind = 'r'
      and c.relrowsecurity
      and a.grantee = v_anon
      and a.privilege_type = 'SELECT'
  );
  if v_detalle is not null then
    raise exception '0465 abortado: sin SELECT de anon o sin RLS en: %', v_detalle;
  end if;

  -- Las tablas nuevas no deben volver a nacer con privilegios para anon ni
  -- authenticated. El default de postgres (por schema o global) ya lo cumple.
  select string_agg(x, ', ' order by x)
    into v_detalle
  from (
    select format('%s/%s: %s', coalesce(n.nspname, '<global>'), d.defaclobjtype,
                  coalesce(pg_catalog.pg_get_userbyid(nullif(a.grantee, 0)), 'PUBLIC')) as x
    from pg_catalog.pg_default_acl d
    left join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
    cross join lateral pg_catalog.aclexplode(d.defaclacl) a
    where d.defaclrole = 'postgres'::regrole
      and d.defaclobjtype = 'r'
      and (d.defaclnamespace = 0 or d.defaclnamespace = 'public'::regnamespace)
      and a.grantee in (0, v_anon, v_authenticated)
  ) s;
  if v_detalle is not null then
    raise exception '0465 abortado: el default de postgres volvió a dar privilegios de tabla a %', v_detalle;
  end if;

  -- ── Foto de los ACL, de tabla y de columna ──────────────
  -- Claves por OID: un nombre con caracteres raros no rompe la comparación.
  select coalesce(array_agg(x order by x), '{}')
    into v_acl_antes
  from (
    select concat_ws('|', c.oid, a.grantee, a.privilege_type, a.is_grantable, a.grantor) as x
    from pg_catalog.pg_class c
    cross join lateral pg_catalog.aclexplode(c.relacl) a
    where c.relnamespace = 'public'::regnamespace
      and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
  ) s;

  select coalesce(array_agg(x order by x), '{}')
    into v_cols_antes
  from (
    select concat_ws('|', c.oid, at.attnum, a.grantee, a.privilege_type, a.is_grantable, a.grantor) as x
    from pg_catalog.pg_attribute at
    join pg_catalog.pg_class c on c.oid = at.attrelid
    cross join lateral pg_catalog.aclexplode(at.attacl) a
    where c.relnamespace = 'public'::regnamespace
      and at.attacl is not null
  ) s;

  -- ── El cambio ────────────────────────────────────────────
  revoke maintain, references, trigger on all tables in schema public
    from anon, authenticated;

  -- ── Postflight ───────────────────────────────────────────
  select coalesce(array_agg(x order by x), '{}')
    into v_acl_despues
  from (
    select concat_ws('|', c.oid, a.grantee, a.privilege_type, a.is_grantable, a.grantor) as x
    from pg_catalog.pg_class c
    cross join lateral pg_catalog.aclexplode(c.relacl) a
    where c.relnamespace = 'public'::regnamespace
      and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
  ) s;

  select coalesce(array_agg(x order by x), '{}')
    into v_cols_despues
  from (
    select concat_ws('|', c.oid, at.attnum, a.grantee, a.privilege_type, a.is_grantable, a.grantor) as x
    from pg_catalog.pg_attribute at
    join pg_catalog.pg_class c on c.oid = at.attrelid
    cross join lateral pg_catalog.aclexplode(at.attacl) a
    where c.relnamespace = 'public'::regnamespace
      and at.attacl is not null
  ) s;

  select array_agg(x order by x) into v_agregados
  from (select unnest(v_acl_despues) except select unnest(v_acl_antes)) d(x);
  if v_agregados is not null then
    raise exception '0465: aparecieron privilegios que no estaban: %', v_agregados;
  end if;

  select array_agg(x order by x) into v_quitados
  from (select unnest(v_acl_antes) except select unnest(v_acl_despues)) d(x)
  where not (split_part(x, '|', 2)::oid in (v_anon, v_authenticated)
             and split_part(x, '|', 3) in ('MAINTAIN', 'REFERENCES', 'TRIGGER'));
  if v_quitados is not null then
    raise exception '0465: se quitó algo más que MAINTAIN, REFERENCES y TRIGGER de anon/authenticated: %', v_quitados;
  end if;

  -- Por columna sólo puede faltar REFERENCES de anon/authenticated: PostgreSQL
  -- lo retira junto con el de tabla. UPDATE y los demás quedan como estaban.
  select array_agg(x order by x) into v_agregados
  from (select unnest(v_cols_despues) except select unnest(v_cols_antes)) d(x);
  select array_agg(x order by x) into v_quitados
  from (select unnest(v_cols_antes) except select unnest(v_cols_despues)) d(x)
  where not (split_part(x, '|', 3)::oid in (v_anon, v_authenticated)
             and split_part(x, '|', 4) = 'REFERENCES');
  if v_agregados is not null or v_quitados is not null then
    raise exception '0465: cambiaron privilegios por columna que no eran objetivo: agregados %, quitados %',
      v_agregados, v_quitados;
  end if;

  -- Privilegios efectivos, incluidos los heredados de PUBLIC o por membresía.
  select string_agg(x, ', ' order by x)
    into v_detalle
  from (
    select format('%s (%s)', c.oid::regclass, r.rolname) as x
    from pg_catalog.pg_class c
    cross join (values ('anon'), ('authenticated')) as r(rolname)
    where c.relnamespace = 'public'::regnamespace
      and c.relkind = any (c_tablas)
      and (pg_catalog.has_table_privilege(r.rolname, c.oid, 'MAINTAIN, REFERENCES, TRIGGER')
           or pg_catalog.has_any_column_privilege(r.rolname, c.oid, 'REFERENCES'))
  ) s;
  if v_detalle is not null then
    raise exception '0465: todavía quedan MAINTAIN, REFERENCES o TRIGGER en %', v_detalle;
  end if;

  select coalesce(array_agg(c.relname::text order by c.relname::text), '{}')
    into v_lectura_anon
  from pg_catalog.pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = any (c_tablas)
    and pg_catalog.has_any_column_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, REFERENCES');
  if v_lectura_anon is distinct from c_lectura_anon then
    raise exception '0465: anon tiene que leer exactamente %, y lee %', c_lectura_anon, v_lectura_anon;
  end if;

  select string_agg(c.oid::regclass::text, ', ' order by c.oid::regclass::text)
    into v_detalle
  from pg_catalog.pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = any (c_tablas)
    and pg_catalog.has_table_privilege('anon', c.oid, 'INSERT, UPDATE, DELETE, TRUNCATE');
  if v_detalle is not null then
    raise exception '0465: anon puede escribir en %', v_detalle;
  end if;
end
$migracion_0465$;
