-- ─────────────────────────────────────────────────────────────
-- 0543 · SDD-0634 · encender o apagar un módulo exige superadministrador, por
--        cualquier camino (también por audit_d1_execute)
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md).
--    ORDEN: después de la 0542 (su preflight lo exige). Migrate-first: la PR trae
--    el aviso de la server action para el 42501.
--
-- ⚠️ LOCK: CREATE TRIGGER toma SHARE ROW EXCLUSIVE sobre `feature_flags` hasta el
--    COMMIT. Es una tabla chica (una fila por tenant y módulo) que solo se lee al
--    cargar el Studio y el portal; mientras corre, esas lecturas siguen, y solo
--    esperan las escrituras. Se corta a los 5 s si algo la tiene tomada.
--
-- EL HUECO (confirmado por el DG en el repo y en el catálogo de producción, sin
-- filas): `audit_d1_execute(uuid,text,uuid,jsonb,text)` (0289:166) es SECURITY
-- DEFINER de postgres, y authenticated tiene EXECUTE. Su única guarda es
-- `audit_d1_admin_tenant()` (0289:131-160), que pide rol admin del tenant. La rama
-- `feature_flag.toggle` (0289:632-650) hace el UPDATE de `feature_flags` como
-- dueño: `feature_flags` no tiene FORCE ROW LEVEL SECURITY (0042:37), así que la
-- policy `feature_flags_platform_admin_update` (0355) no lo alcanza. Cualquier
-- admin del tenant podía encender o apagar módulos por PostgREST, y el candado
-- de superadmin era solo de pantalla (`platformAdminDenial`).
--
-- POR QUÉ UN DISPARADOR Y NO REEMPLAZAR audit_d1_execute: la función tiene ~760
-- líneas y 22 ramas. Reemplazarla para tocar una pisaría cualquier deriva viva de
-- las otras 21, y exigiría el md5 del cuerpo vivo de producción. Un BEFORE UPDATE
-- en la tabla frena todos los caminos (el DEFINER, un UPDATE directo y cualquier
-- RPC futura) sin tocar audit_d1_execute, su cuerpo ni su ACL. Es lo que la 0355
-- quería decir con «el control real va donde vive el privilegio».
--
-- QUIÉN PASA:
--   · el superadministrador (`is_platform_admin()`, que desde la 0542 ejecuta
--     authenticated);
--   · todo lo que no trae sesión de usuario (`auth.uid()` nulo): service_role,
--     migraciones, el sembrado de la 0337 y scripts de operación. Para ellos no
--     cambia nada.
-- QUIÉN NO: un admin del tenant (o cualquier miembro) que no es superadmin
-- recibe 42501 «Solo el superadministrador puede encender o apagar módulos»,
-- que el adaptador D1 traduce a `permission_denied`, y la server action a «No eres
-- superadministrador…». La operación entera vuelve atrás, también su fila en
-- `audit_d1_operations` y su evento de auditoría.
--
-- LA LECCIÓN DE LA 0542 (ACL que no sobrevive): esta migración no hace
-- create or replace ni drop sobre ninguna función existente. Mide el ACL de
-- audit_d1_execute e is_platform_admin() antes, y lo exige igual después. La
-- función nueva del disparador no se concede a nadie: un disparador no necesita
-- EXECUTE para dispararse.
--
-- IDEMPOTENTE: la función se crea o reemplaza (es nueva y propia) y el
-- disparador se borra y se crea. El postflight mide el estado final.
--
-- VOLVER ATRÁS (solo con OK de Sam):
--   drop trigger if exists feature_flags_exige_superadmin on public.feature_flags;
--   drop function if exists public.feature_flags_exige_superadmin();
-- Deja el hueco como estaba.
-- ─────────────────────────────────────────────────────────────

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_ff   oid := pg_catalog.to_regclass('public.feature_flags');
  v_ipa  oid := pg_catalog.to_regprocedure('public.is_platform_admin()');
  v_d1   oid := pg_catalog.to_regprocedure('public.audit_d1_execute(uuid,text,uuid,jsonb,text)');
  v_rol  text;
begin
  foreach v_rol in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_catalog.pg_roles where rolname = v_rol) then
      raise exception '0543: falta el rol %', v_rol;
    end if;
  end loop;
  if v_ff is null then
    raise exception '0543 requiere public.feature_flags (0042)';
  end if;
  if pg_catalog.to_regprocedure('auth.uid()') is null then
    raise exception '0543 requiere auth.uid()';
  end if;
  if v_ipa is null or not (select p.prosecdef from pg_catalog.pg_proc p where p.oid = v_ipa) then
    raise exception '0543 requiere public.is_platform_admin() DEFINER (0058)';
  end if;
  if not pg_catalog.has_function_privilege('authenticated', v_ipa, 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', v_ipa, 'EXECUTE') then
    raise exception '0543 requiere la 0542: authenticated ejecuta is_platform_admin() y anon no';
  end if;
  if v_d1 is null
     or not (select p.prosecdef from pg_catalog.pg_proc p where p.oid = v_d1)
     or (select pg_catalog.pg_get_userbyid(p.proowner) from pg_catalog.pg_proc p where p.oid = v_d1) <> 'postgres' then
    raise exception '0543 requiere public.audit_d1_execute DEFINER de postgres (0289)';
  end if;
  if pg_catalog.has_function_privilege('anon', v_d1, 'EXECUTE') then
    raise exception '0543: anon puede ejecutar audit_d1_execute; revisar antes de aplicar';
  end if;
  if exists (
    select 1 from pg_catalog.pg_trigger t
    where t.tgrelid = v_ff and not t.tgisinternal
      and t.tgname = 'feature_flags_exige_superadmin'
      and t.tgfoid <> coalesce(pg_catalog.to_regprocedure('public.feature_flags_exige_superadmin()')::oid, 0::oid)
  ) then
    raise exception '0543: ya existe un disparador feature_flags_exige_superadmin con otra función';
  end if;

  -- El ACL de las dos funciones que no se tocan, para compararlo en el postflight.
  perform pg_catalog.set_config('dtd.acl_0543',
    coalesce((select p.proacl::text from pg_catalog.pg_proc p where p.oid = v_d1), 'null')
    || '|' || coalesce((select p.proacl::text from pg_catalog.pg_proc p where p.oid = v_ipa), 'null'),
    true);
end;
$preflight$;

create or replace function public.feature_flags_exige_superadmin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- Sin sesión de usuario (service_role, migraciones, sembrado): no cambia nada.
  if (select auth.uid()) is not null
     and not public.is_platform_admin() then
    raise exception 'Solo el superadministrador puede encender o apagar módulos'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

alter function public.feature_flags_exige_superadmin() owner to postgres;
revoke all on function public.feature_flags_exige_superadmin() from public, anon, authenticated, service_role;

comment on function public.feature_flags_exige_superadmin() is
  'SDD-0634 · 0543: BEFORE UPDATE de feature_flags. Con sesión de usuario, solo el superadministrador (is_platform_admin) cambia un flag, también por audit_d1_execute (DEFINER, 0289). Sin sesión (service_role, migraciones) pasa. No se concede a nadie.';

drop trigger if exists feature_flags_exige_superadmin on public.feature_flags;
create trigger feature_flags_exige_superadmin
  before update on public.feature_flags
  for each row execute function public.feature_flags_exige_superadmin();

do $postflight$
declare
  v_ff  oid := pg_catalog.to_regclass('public.feature_flags');
  v_fn  oid := pg_catalog.to_regprocedure('public.feature_flags_exige_superadmin()');
  v_d1  oid := pg_catalog.to_regprocedure('public.audit_d1_execute(uuid,text,uuid,jsonb,text)');
  v_ipa oid := pg_catalog.to_regprocedure('public.is_platform_admin()');
  v_rol text;
begin
  if not exists (
    select 1 from pg_catalog.pg_trigger t
    where t.tgrelid = v_ff and t.tgname = 'feature_flags_exige_superadmin'
      and t.tgfoid = v_fn and t.tgenabled = 'O'
      -- tgtype: ROW (1) + BEFORE (2) + UPDATE (16) = 19
      and t.tgtype = 19
  ) then
    raise exception '0543: no quedó el disparador BEFORE UPDATE FOR EACH ROW feature_flags_exige_superadmin';
  end if;
  if not (select p.prosecdef from pg_catalog.pg_proc p where p.oid = v_fn) then
    raise exception '0543: feature_flags_exige_superadmin() no quedó DEFINER';
  end if;
  foreach v_rol in array array['anon', 'authenticated', 'service_role'] loop
    if pg_catalog.has_function_privilege(v_rol, v_fn, 'EXECUTE') then
      raise exception '0543: % puede ejecutar feature_flags_exige_superadmin()', v_rol;
    end if;
  end loop;
  if exists (
    select 1 from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
    where p.oid = v_fn and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) then
    raise exception '0543: PUBLIC tiene EXECUTE sobre feature_flags_exige_superadmin()';
  end if;
  if coalesce((select p.proacl::text from pg_catalog.pg_proc p where p.oid = v_d1), 'null')
     || '|' || coalesce((select p.proacl::text from pg_catalog.pg_proc p where p.oid = v_ipa), 'null')
     <> pg_catalog.current_setting('dtd.acl_0543') then
    raise exception '0543: cambió el ACL de audit_d1_execute o de is_platform_admin()';
  end if;
  if not pg_catalog.has_function_privilege('authenticated', v_d1, 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', v_ipa, 'EXECUTE') then
    raise exception '0543: authenticated perdió EXECUTE de audit_d1_execute o de is_platform_admin()';
  end if;
end;
$postflight$;
