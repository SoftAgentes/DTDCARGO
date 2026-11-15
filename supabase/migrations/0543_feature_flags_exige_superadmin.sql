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
-- ⚠️ LOCK: CREATE TRIGGER y ALTER TABLE … ENABLE ALWAYS TRIGGER toman SHARE ROW
--    EXCLUSIVE sobre `feature_flags` hasta el COMMIT. Es una tabla chica (una fila
--    por tenant y módulo) que solo se lee al cargar el Studio y el portal;
--    mientras corre, las lecturas siguen y solo esperan las escrituras. Se corta a
--    los 5 s si algo la tiene tomada.
--
-- EL HUECO (confirmado por el DG en el repo y en el catálogo de producción, sin
-- filas): `audit_d1_execute(uuid,text,uuid,jsonb,text)` (0289:166) es SECURITY
-- DEFINER de postgres, y authenticated tiene EXECUTE. Su única guarda es
-- `audit_d1_admin_tenant()` (0289:131-160), que pide rol admin del tenant. La rama
-- `feature_flag.toggle` (0289:632-650) hace un UPDATE por id de `feature_flags`
-- como dueño: la tabla no tiene FORCE ROW LEVEL SECURITY (0042:37), así que la
-- policy `feature_flags_platform_admin_update` (0355) no lo alcanza. Cualquier
-- admin del tenant podía encender o apagar módulos por PostgREST, y el candado
-- de superadmin era solo de pantalla (`platformAdminDenial`).
--
-- POR QUÉ UN DISPARADOR Y NO REEMPLAZAR audit_d1_execute: la función tiene ~760
-- líneas y 22 ramas. Reemplazarla para tocar una pisaría cualquier deriva viva de
-- las otras 21, y exigiría el md5 del cuerpo vivo de producción. Un disparador
-- en la tabla frena todos los caminos (el DEFINER, un UPDATE directo y cualquier
-- RPC futura) sin tocar audit_d1_execute, su cuerpo ni su ACL.
--
-- QUIÉN ES «UNA SESIÓN»: dentro de un DEFINER, `current_user` es postgres, así
-- que no sirve. La regla sale de los claims del JWT que PostgREST deja en la
-- transacción, en sus dos formas: `request.jwt.claims` (JSON, la actual) y
-- `request.jwt.claim.role` / `request.jwt.claim.sub` (la antigua):
--   · rol `service_role` → pasa (la clave de servicio del servidor);
--   · sin rol y sin sub (migraciones, jobs, psql del dueño, el sembrado de la
--     0337) → pasa;
--   · rol `anon` → se NIEGA siempre (hoy anon no tiene ni EXECUTE ni privilegios
--     sobre la tabla; esto cierra el camino si algún día recibe un grant);
--   · cualquier otro caso (rol `authenticated`, otro rol, o un sub sin rol) →
--     exige `is_platform_admin()` (que desde la 0542 ejecuta authenticated). Un
--     authenticated sin sub da false: se niega.
-- `auth.uid() is null` solo no alcanzaba: dejaba pasar a anon.
--
-- INSERT Y DELETE NO SE CUBREN, Y POR QUÉ (lo comprueba el preflight en el
-- catálogo): authenticated y anon no tienen INSERT ni DELETE sobre la tabla
-- (0042: `grant select, update`), y además hay policies `with check (false)` y
-- `using (false)` para authenticated (0042). Los únicos que insertan son el
-- sembrado (0337, `on conflict do nothing`, sin elegir valores) y migraciones; el
-- único que borra es el `on delete cascade` de `tenants`. audit_d1_execute no
-- tiene rama que inserte ni borre flags. Cubrirlos con el disparador frenaría el
-- alta o la baja de un tenant hechas con sesión, sin cerrar ningún camino abierto.
--
-- ENABLE ALWAYS: un disparador normal no corre con session_replication_role =
-- replica. Ese ajuste solo lo puede cambiar un superusuario (o quien tenga SET
-- sobre él), no authenticated ni el dueño postgres, que no es superusuario. Igual
-- se deja ALWAYS: no cuesta nada, y una restauración o una réplica tampoco se lo
-- saltan (en ellas no hay claims, así que pasan, como cualquier migración).
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
  if (select pg_catalog.pg_get_userbyid(c.relowner) from pg_catalog.pg_class c where c.oid = v_ff) <> 'postgres' then
    raise exception '0543: feature_flags no es de postgres';
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
  -- La premisa de no cubrir INSERT ni DELETE: ningún rol de sesión puede hacerlos.
  foreach v_rol in array array['anon', 'authenticated'] loop
    if pg_catalog.has_table_privilege(v_rol, v_ff, 'INSERT')
       or pg_catalog.has_table_privilege(v_rol, v_ff, 'DELETE')
       or pg_catalog.has_table_privilege(v_rol, v_ff, 'TRUNCATE') then
      raise exception '0543: % puede insertar, borrar o vaciar feature_flags; el disparador solo cubre UPDATE', v_rol;
    end if;
  end loop;
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
declare
  v_claims jsonb := nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb;
  v_rol    text := coalesce(
    nullif(v_claims ->> 'role', ''),
    nullif(pg_catalog.current_setting('request.jwt.claim.role', true), ''));
  v_sub    text := coalesce(
    nullif(v_claims ->> 'sub', ''),
    nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), ''));
begin
  -- La clave de servicio, o sin claims (migraciones, jobs, el dueño): pasa.
  if v_rol = 'service_role' or (v_rol is null and v_sub is null) then
    return new;
  end if;
  -- anon nunca; cualquier otra sesión, solo el superadministrador.
  if v_rol = 'anon' or not public.is_platform_admin() then
    raise exception 'Solo el superadministrador puede encender o apagar módulos'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

alter function public.feature_flags_exige_superadmin() owner to postgres;
revoke all on function public.feature_flags_exige_superadmin() from public, anon, authenticated, service_role;

comment on function public.feature_flags_exige_superadmin() is
  'SDD-0634 · 0543: BEFORE UPDATE de feature_flags (ENABLE ALWAYS). Por los claims del JWT: service_role o sin claims pasa; anon nunca; cualquier otra sesión, solo is_platform_admin(). Frena también audit_d1_execute (DEFINER, 0289). No se concede a nadie.';

drop trigger if exists feature_flags_exige_superadmin on public.feature_flags;
create trigger feature_flags_exige_superadmin
  before update on public.feature_flags
  for each row execute function public.feature_flags_exige_superadmin();
alter table public.feature_flags enable always trigger feature_flags_exige_superadmin;

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
      and t.tgfoid = v_fn
      -- tgtype: ROW (1) + BEFORE (2) + UPDATE (16) = 19
      and t.tgtype = 19
  ) then
    raise exception '0543: no quedó el disparador BEFORE UPDATE FOR EACH ROW feature_flags_exige_superadmin';
  end if;
  if (select t.tgenabled from pg_catalog.pg_trigger t
      where t.tgrelid = v_ff and t.tgname = 'feature_flags_exige_superadmin') <> 'A' then
    raise exception '0543: el disparador feature_flags_exige_superadmin no quedó ENABLE ALWAYS';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = v_fn and p.prosecdef
      and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
      and p.proconfig = array['search_path=""']::text[]
  ) then
    raise exception '0543: feature_flags_exige_superadmin() no quedó DEFINER de postgres con search_path vacío';
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
