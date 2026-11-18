-- ─────────────────────────────────────────────────────────────
-- 0542 · SDD-0633 · devolverle a authenticated el EXECUTE de is_platform_admin()
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md).
--    ORDEN: migrate-first (se aplica y se fusiona la PR enseguida). La PR trae
--    código que llama a la RPC con la sesión: sin esta migración, el
--    superadministrador sigue viendo «no eres superadministrador».
--
-- LOCK: GRANT/REVOKE sobre una función solo toca su fila de pg_proc. No hay
--    tablas en juego. Igual se corta a los 5 s si algo la tiene tomada.
--
-- EL SÍNTOMA (medido por el DG en producción el 2026-11-15, sobre el catálogo
-- y el log del api-gw, sin filas): `POST /rest/v1/rpc/is_platform_admin` da
-- 403. Es la única RPC con 403 en 7 días. `proacl` vale
-- {postgres=X/postgres, service_role=X/postgres}, y
-- has_function_privilege('authenticated', 'public.is_platform_admin()', 'EXECUTE')
-- da f.
--
-- POR QUÉ NO QUEDÓ EL GRANT (leído en el repo):
--   · 0058:66 lo dio a authenticated, y 0209:49 lo repitió.
--   · 0211:27 (revoke_authenticated_rpc_sweep) lo revocó, con la premisa de que
--     la llamaban solo los DEFINER del servidor. La 0248:25 lo excluyó a
--     propósito de su sweep-back por la misma razón.
--   · Las «devoluciones» de 0273:90, 0282:119, 0287:3594 y 0288:3694 nunca se
--     ejecutaron: están DENTRO de literales dollar-quoted
--     (`$sdd0118_platform_admin_target$ …`) que esas migraciones escriben en
--     `supabase_migrations.schema_migrations.statements` para hacer reproducible
--     el ledger (SDD-0118). Es texto del ledger, no SQL que corra. Por eso están
--     en el ledger y el grant no está.
--   · La premisa de la 0211 era falsa para esta función: la llaman con la
--     sesión `lib/studio/platform-admin.ts` (isPlatformAdmin, que usan
--     platformAdminDenial y el segundo candado de rbac-guard.ts para los
--     SUPERADMIN_ONLY_MODULES) y la policy feature_flags_platform_admin_update
--     (0355:137), que corre como authenticated. Fail-closed: el
--     superadministrador quedó tratado como uno más.
--   · Los DEFINER que la llaman por dentro (studio_set_user_disabled,
--     studio_change_user_role de la 0355 y studio_grant_user_module de la 0538)
--     corren como postgres y no dependen de este grant.
--
-- POR QUÉ ES SEGURO PARA authenticated: es DEFINER con search_path fijo y solo
-- devuelve el booleano «¿auth.uid() está en platform_admins?». No recibe
-- argumentos y no dice nada de otro usuario. El preflight exige ese cuerpo
-- exacto, sin contar los espacios: si el cuerpo vivo es otro, aborta sin tocar
-- nada. anon y PUBLIC quedan sin EXECUTE (revoke explícito), y service_role
-- conserva el suyo.
--
-- IDEMPOTENTE: GRANT y REVOKE repetidos no cambian nada. El postflight mide el
-- estado final, no el cambio.
--
-- VOLVER ATRÁS (solo con OK de Sam): revoke execute on function
-- public.is_platform_admin() from authenticated;  (deja todo como estaba: la
-- llave falla cerrada).
-- ─────────────────────────────────────────────────────────────

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_oid    oid := pg_catalog.to_regprocedure('public.is_platform_admin()');
  v_fn     record;
  v_cuerpo text;
begin
  if v_oid is null then
    raise exception '0542 requiere public.is_platform_admin() (migr 0058)';
  end if;
  foreach v_cuerpo in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_catalog.pg_roles where rolname = v_cuerpo) then
      raise exception '0542: falta el rol %', v_cuerpo;
    end if;
  end loop;

  select p.prosecdef, p.provolatile, p.prorettype, p.proconfig, p.prosrc,
         pg_catalog.pg_get_userbyid(p.proowner) as dueno, l.lanname
    into v_fn
  from pg_catalog.pg_proc p
  join pg_catalog.pg_language l on l.oid = p.prolang
  where p.oid = v_oid;

  if not v_fn.prosecdef then
    raise exception '0542: is_platform_admin() no es SECURITY DEFINER';
  end if;
  if v_fn.dueno <> 'postgres' then
    raise exception '0542: is_platform_admin() es de %, no de postgres', v_fn.dueno;
  end if;
  if v_fn.lanname <> 'sql' or v_fn.prorettype <> 'pg_catalog.bool'::pg_catalog.regtype then
    raise exception '0542: is_platform_admin() no es SQL que devuelve boolean';
  end if;
  if v_fn.proconfig is null
     or not (v_fn.proconfig <@ array['search_path=public', 'search_path=""']::text[])
     or pg_catalog.cardinality(v_fn.proconfig) <> 1 then
    raise exception '0542: is_platform_admin() no tiene un search_path fijo (proconfig=%)', v_fn.proconfig;
  end if;

  -- El cuerpo de la 0058, sin contar los espacios: solo el booleano de auth.uid().
  v_cuerpo := pg_catalog.btrim(pg_catalog.regexp_replace(v_fn.prosrc, '\s+', ' ', 'g'));
  if v_cuerpo <> 'select exists ( select 1 from public.platform_admins where user_id = (select auth.uid()) );' then
    raise exception '0542: el cuerpo vivo de is_platform_admin() no es el de la 0058 (md5 %)',
      pg_catalog.md5(v_fn.prosrc);
  end if;
end;
$preflight$;

revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated, service_role;

comment on function public.is_platform_admin() is
  'SDD-0633 · 0542: ¿auth.uid() está en platform_admins? DEFINER, sin argumentos. EXECUTE para authenticated (la llaman la sesión del Studio y la policy feature_flags_platform_admin_update) y service_role; nunca anon ni PUBLIC.';

do $postflight$
declare
  v_oid oid := pg_catalog.to_regprocedure('public.is_platform_admin()');
begin
  if not pg_catalog.has_function_privilege('authenticated', v_oid, 'EXECUTE') then
    raise exception '0542: authenticated sigue sin EXECUTE';
  end if;
  if not pg_catalog.has_function_privilege('service_role', v_oid, 'EXECUTE') then
    raise exception '0542: service_role perdió EXECUTE';
  end if;
  if pg_catalog.has_function_privilege('anon', v_oid, 'EXECUTE') then
    raise exception '0542: anon puede ejecutar is_platform_admin()';
  end if;
  if exists (
    select 1
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
    where p.oid = v_oid and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) then
    raise exception '0542: PUBLIC tiene EXECUTE sobre is_platform_admin()';
  end if;
end;
$postflight$;
