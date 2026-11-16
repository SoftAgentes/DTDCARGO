-- ─────────────────────────────────────────────────────────────
-- 0545 · SDD-0636 · política de roles: solo el superadministrador crea o
--        reactiva administradores
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md).
--    ORDEN: después de la 0542 (su preflight lo exige). Migrate-first: la PR trae
--    el aviso de la server action para el 42501.
--
-- ⚠️ LOCK: en la primera aplicación, CREATE TRIGGER y ALTER TABLE … ENABLE
--    ALWAYS TRIGGER toman SHARE ROW EXCLUSIVE sobre `user_invitations` y
--    `user_tenants` hasta el COMMIT: las lecturas siguen y solo esperan las
--    escrituras. Al REAPLICARLA (los disparadores ya existen), el DROP TRIGGER
--    toma ACCESS EXCLUSIVE: hasta el COMMIT esperan también las lecturas
--    (`user_tenants` se lee en cada pantalla del Studio). La migración dura
--    milisegundos y se corta a los 5 s si algo tiene tomada una tabla.
--
-- LA POLÍTICA (decisión de Sam, 2026-11-15): solo el superadministrador
-- (`is_platform_admin()`) puede crear o reactivar un administrador del equipo.
-- Cubre invitar con rol admin, aceptar una invitación de admin, cambiar el rol a
-- admin y reactivar a un admin suspendido. Un admin del equipo sigue pudiendo
-- invitar a los demás roles.
--
-- QUÉ HACE, EN CUATRO PIEZAS:
--   1. `user_invitations_exige_superadmin`: BEFORE INSERT OR UPDATE OF role de
--      `user_invitations`. Con sesión, una invitación con rol admin exige
--      `is_platform_admin()`. «OF role»: aceptar (accepted_at) y revocar
--      (revoked_at) no escriben el rol y no pasan por aquí.
--   2. `user_tenants_exige_superadmin`: BEFORE INSERT OR UPDATE de
--      `user_tenants`. Con sesión, que una fila QUEDE admin viniendo de no
--      serlo (alta o cambio de rol) o que un admin suspendido vuelva a estar
--      activo exige `is_platform_admin()`. Una sola excepción: quien acepta,
--      para sí mismo, una invitación vigente de admin que emitió un
--      superadministrador (así el invitado, que no es superadmin, puede
--      aceptarla). Reactivar a un admin suspendido no tiene excepción.
--   3. La invitación por sesión pasa solo por `audit_d1_execute`, que la
--      registra en la auditoría D1: se quita el EXECUTE directo de `studio_invite_user` a
--      authenticated (la app no la llama directo desde la SDD-0273). La llama
--      `audit_d1_execute` como su dueño, postgres, que la conserva.
--   4. `user_tenants_audit_alta`: AFTER INSERT de `user_tenants`, escribe en
--      `user_role_audit` (0201) el rol con que entra la persona. La 0201 solo
--      auditaba UPDATE; con esto el alta también queda en la bitácora de roles.
--
-- POR QUÉ DISPARADORES Y NO REEMPLAZAR LAS FUNCIONES: como en la 0543.
-- `studio_invite_user` (0203), `studio_accept_invitation` (0352),
-- `studio_change_user_role` y `studio_set_user_disabled` (0355) son DEFINER de
-- postgres y escriben como dueño; la regla tiene que vivir en la tabla.
-- Reemplazarlas exigiría el md5 del cuerpo vivo de cada una y arriesga pisar
-- deriva. Un disparador en la tabla aplica la política a todas, también a
-- las futuras, sin tocar sus cuerpos.
--
-- QUIÉN ES «UNA SESIÓN»: la misma regla de la 0543, por los claims del JWT en sus
-- dos formas (`request.jwt.claims` y `request.jwt.claim.role`/`.sub`):
--   · rol `service_role` → pasa (la clave de servicio del servidor);
--   · sin rol y sin sub (migraciones, jobs, el dueño, el respaldo de la 0355)
--     → pasa;
--   · rol `anon` → se niega siempre, sin excepción;
--   · cualquier otro caso → exige `is_platform_admin()` (o la excepción de 2).
--
-- ENABLE ALWAYS en los dos guardianes: el modo réplica tampoco se los salta (en
-- una restauración no hay claims, así que pasan). El de auditoría (4) se deja
-- normal, como el de la 0201: en una restauración la bitácora se restaura con
-- sus propias filas, y un ALWAYS las duplicaría.
--
-- LA LECCIÓN DE LA 0542 (ACL que no sobrevive): ninguna función existente se
-- reemplaza ni se borra. El preflight guarda el ACL de `audit_d1_execute`,
-- `is_platform_admin()` y `studio_accept_invitation`, y el postflight lo exige
-- igual. De `studio_invite_user` solo cambia lo dicho en 3, y el postflight lo
-- mide. Las tres funciones nuevas no se conceden a nadie.
--
-- IDEMPOTENTE: las funciones nuevas se crean o reemplazan y los disparadores se
-- borran y se crean. El postflight mide el estado final.
--
-- VOLVER ATRÁS (solo con OK de Sam): supabase/desarmes/0545_desarme.sql
-- ─────────────────────────────────────────────────────────────

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_inv  oid := pg_catalog.to_regclass('public.user_invitations');
  v_ut   oid := pg_catalog.to_regclass('public.user_tenants');
  v_pa   oid := pg_catalog.to_regclass('public.platform_admins');
  v_ura  oid := pg_catalog.to_regclass('public.user_role_audit');
  v_ipa  oid := pg_catalog.to_regprocedure('public.is_platform_admin()');
  v_d1   oid := pg_catalog.to_regprocedure('public.audit_d1_execute(uuid,text,uuid,jsonb,text)');
  v_siu  oid := pg_catalog.to_regprocedure('public.studio_invite_user(text,text,text)');
  v_sai  oid := pg_catalog.to_regprocedure('public.studio_accept_invitation(text,text,text)');
  v_rol  text;
  v_tab  oid;
  v_par  record;
begin
  foreach v_rol in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_catalog.pg_roles where rolname = v_rol) then
      raise exception '0545: falta el rol %', v_rol;
    end if;
  end loop;
  foreach v_tab in array array[v_inv, v_ut, v_pa, v_ura] loop
    if v_tab is null then
      raise exception '0545 requiere user_invitations, user_tenants, platform_admins y user_role_audit';
    end if;
    if (select pg_catalog.pg_get_userbyid(c.relowner) from pg_catalog.pg_class c where c.oid = v_tab) <> 'postgres' then
      raise exception '0545: % no es de postgres', v_tab::regclass;
    end if;
  end loop;
  if v_ipa is null or not (select p.prosecdef from pg_catalog.pg_proc p where p.oid = v_ipa) then
    raise exception '0545 requiere public.is_platform_admin() DEFINER (0058)';
  end if;
  if not pg_catalog.has_function_privilege('authenticated', v_ipa, 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', v_ipa, 'EXECUTE') then
    raise exception '0545 requiere la 0542: authenticated ejecuta is_platform_admin() y anon no';
  end if;
  -- Las tres DEFINER de postgres que escriben estas tablas. studio_invite_user
  -- tiene que ser del mismo dueño que audit_d1_execute: quitado el EXECUTE de
  -- authenticated, audit_d1_execute la sigue llamando como su dueño.
  for v_par in
    select * from (values
      (v_d1,  'audit_d1_execute (0289)'),
      (v_siu, 'studio_invite_user(text,text,text) (0203)'),
      (v_sai, 'studio_accept_invitation(text,text,text) (0352)')
    ) as f(fn, nombre)
  loop
    if v_par.fn is null
       or not (select p.prosecdef from pg_catalog.pg_proc p where p.oid = v_par.fn)
       or (select pg_catalog.pg_get_userbyid(p.proowner) from pg_catalog.pg_proc p where p.oid = v_par.fn) <> 'postgres' then
      raise exception '0545 requiere public.% DEFINER de postgres', v_par.nombre;
    end if;
    if pg_catalog.has_function_privilege('anon', v_par.fn, 'EXECUTE') then
      raise exception '0545: anon puede ejecutar public.%; revisar antes de aplicar', v_par.nombre;
    end if;
  end loop;
  if exists (
    select 1 from pg_catalog.pg_trigger t
    where not t.tgisinternal
      and (t.tgrelid, t.tgname) in (
        (v_inv, 'user_invitations_exige_superadmin'),
        (v_ut,  'user_tenants_exige_superadmin'),
        (v_ut,  'user_tenants_audit_alta'))
      and t.tgfoid not in (
        coalesce(pg_catalog.to_regprocedure('public.user_invitations_exige_superadmin()')::oid, 0::oid),
        coalesce(pg_catalog.to_regprocedure('public.user_tenants_exige_superadmin()')::oid, 0::oid),
        coalesce(pg_catalog.to_regprocedure('public.audit_user_tenants_alta()')::oid, 0::oid))
  ) then
    raise exception '0545: ya existe uno de sus disparadores con otra función';
  end if;

  -- El ACL de las funciones que no cambian, y el de studio_invite_user para
  -- service_role, para compararlos en el postflight.
  perform pg_catalog.set_config('dtd.acl_0545',
    coalesce((select p.proacl::text from pg_catalog.pg_proc p where p.oid = v_d1), 'null')
    || '|' || coalesce((select p.proacl::text from pg_catalog.pg_proc p where p.oid = v_ipa), 'null')
    || '|' || coalesce((select p.proacl::text from pg_catalog.pg_proc p where p.oid = v_sai), 'null'),
    true);
  perform pg_catalog.set_config('dtd.siu_sr_0545',
    pg_catalog.has_function_privilege('service_role', v_siu, 'EXECUTE')::text, true);
end;
$preflight$;

-- ─── 1 · invitar con rol admin ───────────────────────────────
create or replace function public.user_invitations_exige_superadmin()
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
  if new.role is distinct from 'admin' then
    return new;
  end if;
  -- La clave de servicio, o sin claims (migraciones, jobs, el dueño): pasa.
  if v_rol = 'service_role' or (v_rol is null and v_sub is null) then
    return new;
  end if;
  -- anon nunca; cualquier otra sesión, solo el superadministrador.
  if v_rol = 'anon' or not public.is_platform_admin() then
    raise exception 'Solo el superadministrador puede crear o reactivar administradores'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

-- ─── 2 · que una membresía quede admin activa ────────────────
create or replace function public.user_tenants_exige_superadmin()
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
  v_crea     boolean;
  v_reactiva boolean;
begin
  if new.role is distinct from 'admin' then
    return new;
  end if;
  -- Crea un admin: la fila entra como admin, o pasa a admin desde otro rol.
  v_crea := tg_op = 'INSERT' or old.role is distinct from 'admin';
  -- Reactiva un admin: estaba suspendida y queda activa, con rol admin.
  v_reactiva := tg_op = 'UPDATE' and old.disabled_at is not null and new.disabled_at is null;
  if not v_crea and not v_reactiva then
    return new;
  end if;
  -- La clave de servicio, o sin claims (migraciones, jobs, el dueño): pasa.
  if v_rol = 'service_role' or (v_rol is null and v_sub is null) then
    return new;
  end if;
  if v_rol is distinct from 'anon' then
    if public.is_platform_admin() then
      return new;
    end if;
    -- La excepción: quien acepta, para sí mismo, una invitación vigente de
    -- admin emitida por un superadministrador. No cubre reactivar.
    if v_crea and not v_reactiva
       and v_sub = new.user_id::text
       and exists (
         select 1
         from public.user_invitations ui
         join public.platform_admins pa on pa.user_id = ui.invited_by
         join auth.users u on u.id = new.user_id
         where ui.tenant_id = new.tenant_id
           and ui.invited_by = new.invited_by
           and ui.role = 'admin'
           and ui.accepted_at is null
           and ui.revoked_at is null
           and ui.expires_at >= pg_catalog.now()
           and pg_catalog.lower(ui.email) = pg_catalog.lower(u.email)
       ) then
      return new;
    end if;
  end if;
  raise exception 'Solo el superadministrador puede crear o reactivar administradores'
    using errcode = '42501';
end;
$function$;

-- ─── 4 · el alta queda en la bitácora de roles ───────────────
create or replace function public.audit_user_tenants_alta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.user_role_audit
    (tenant_id, actor_user_id, target_user_id, action, old_value, new_value)
  values
    (new.tenant_id, auth.uid(), new.user_id, 'role_change', null, new.role);
  return new;
end;
$function$;

alter function public.user_invitations_exige_superadmin() owner to postgres;
alter function public.user_tenants_exige_superadmin() owner to postgres;
alter function public.audit_user_tenants_alta() owner to postgres;
revoke all on function public.user_invitations_exige_superadmin() from public, anon, authenticated, service_role;
revoke all on function public.user_tenants_exige_superadmin() from public, anon, authenticated, service_role;
revoke all on function public.audit_user_tenants_alta() from public, anon, authenticated, service_role;

comment on function public.user_invitations_exige_superadmin() is
  'SDD-0636 · 0545: BEFORE INSERT OR UPDATE OF role de user_invitations (ENABLE ALWAYS). Una invitación con rol admin, con sesión, exige is_platform_admin(); service_role o sin claims pasa; anon nunca. No se concede a nadie.';
comment on function public.user_tenants_exige_superadmin() is
  'SDD-0636 · 0545: BEFORE INSERT OR UPDATE de user_tenants (ENABLE ALWAYS). Que una membresía quede admin viniendo de no serlo, o que un admin suspendido vuelva activo, exige is_platform_admin() con sesión; excepción: aceptar para sí una invitación vigente de admin emitida por un superadmin. service_role o sin claims pasa; anon nunca. No se concede a nadie.';
comment on function public.audit_user_tenants_alta() is
  'SDD-0636 · 0545: AFTER INSERT de user_tenants: registra en user_role_audit el rol con que entra la persona (role_change, old_value null). Complementa la 0201, que solo audita UPDATE. No se concede a nadie.';

drop trigger if exists user_invitations_exige_superadmin on public.user_invitations;
create trigger user_invitations_exige_superadmin
  before insert or update of role on public.user_invitations
  for each row execute function public.user_invitations_exige_superadmin();
alter table public.user_invitations enable always trigger user_invitations_exige_superadmin;

drop trigger if exists user_tenants_exige_superadmin on public.user_tenants;
create trigger user_tenants_exige_superadmin
  before insert or update on public.user_tenants
  for each row execute function public.user_tenants_exige_superadmin();
alter table public.user_tenants enable always trigger user_tenants_exige_superadmin;

drop trigger if exists user_tenants_audit_alta on public.user_tenants;
create trigger user_tenants_audit_alta
  after insert on public.user_tenants
  for each row execute function public.audit_user_tenants_alta();

-- ─── 3 · invitar por sesión pasa por audit_d1_execute ─────────
revoke execute on function public.studio_invite_user(text, text, text) from public, anon, authenticated;

do $postflight$
declare
  v_inv oid := pg_catalog.to_regclass('public.user_invitations');
  v_ut  oid := pg_catalog.to_regclass('public.user_tenants');
  v_fi  oid := pg_catalog.to_regprocedure('public.user_invitations_exige_superadmin()');
  v_ft  oid := pg_catalog.to_regprocedure('public.user_tenants_exige_superadmin()');
  v_fa  oid := pg_catalog.to_regprocedure('public.audit_user_tenants_alta()');
  v_d1  oid := pg_catalog.to_regprocedure('public.audit_d1_execute(uuid,text,uuid,jsonb,text)');
  v_ipa oid := pg_catalog.to_regprocedure('public.is_platform_admin()');
  v_siu oid := pg_catalog.to_regprocedure('public.studio_invite_user(text,text,text)');
  v_sai oid := pg_catalog.to_regprocedure('public.studio_accept_invitation(text,text,text)');
  v_rol text;
  v_fn  oid;
begin
  -- tgtype: ROW (1) + BEFORE (2) + INSERT (4) + UPDATE (16) = 23; AFTER INSERT = 1 + 4 = 5.
  if not exists (
    select 1 from pg_catalog.pg_trigger t
    where t.tgrelid = v_inv and t.tgname = 'user_invitations_exige_superadmin'
      and t.tgfoid = v_fi and t.tgtype = 23
      -- UPDATE OF role: una sola columna, la del rol. Se compara como texto: el
      -- int2vector empieza en 0 y una igualdad de arreglos mira también eso.
      and t.tgattr::text = (select a.attnum::text from pg_catalog.pg_attribute a
                            where a.attrelid = v_inv and a.attname = 'role')
  ) then
    raise exception '0545: no quedó el disparador BEFORE INSERT OR UPDATE OF role user_invitations_exige_superadmin';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_trigger t
    where t.tgrelid = v_ut and t.tgname = 'user_tenants_exige_superadmin'
      and t.tgfoid = v_ft and t.tgtype = 23 and t.tgattr::text = ''
  ) then
    raise exception '0545: no quedó el disparador BEFORE INSERT OR UPDATE user_tenants_exige_superadmin';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_trigger t
    where t.tgrelid = v_ut and t.tgname = 'user_tenants_audit_alta'
      and t.tgfoid = v_fa and t.tgtype = 5
  ) then
    raise exception '0545: no quedó el disparador AFTER INSERT user_tenants_audit_alta';
  end if;
  if (select t.tgenabled from pg_catalog.pg_trigger t
      where t.tgrelid = v_inv and t.tgname = 'user_invitations_exige_superadmin') <> 'A'
     or (select t.tgenabled from pg_catalog.pg_trigger t
         where t.tgrelid = v_ut and t.tgname = 'user_tenants_exige_superadmin') <> 'A' then
    raise exception '0545: un disparador guardián no quedó ENABLE ALWAYS';
  end if;
  if (select t.tgenabled from pg_catalog.pg_trigger t
      where t.tgrelid = v_ut and t.tgname = 'user_tenants_audit_alta') <> 'O' then
    raise exception '0545: el disparador user_tenants_audit_alta no quedó ENABLE (origen)';
  end if;
  foreach v_fn in array array[v_fi, v_ft, v_fa] loop
    if not exists (
      select 1 from pg_catalog.pg_proc p
      where p.oid = v_fn and p.prosecdef
        and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
        and p.proconfig = array['search_path=""']::text[]
    ) then
      raise exception '0545: % no quedó DEFINER de postgres con search_path vacío', v_fn::regprocedure;
    end if;
    foreach v_rol in array array['anon', 'authenticated', 'service_role'] loop
      if pg_catalog.has_function_privilege(v_rol, v_fn, 'EXECUTE') then
        raise exception '0545: % puede ejecutar %', v_rol, v_fn::regprocedure;
      end if;
    end loop;
    if exists (
      select 1 from pg_catalog.pg_proc p,
           pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
      where p.oid = v_fn and a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ) then
      raise exception '0545: PUBLIC tiene EXECUTE sobre %', v_fn::regprocedure;
    end if;
  end loop;
  -- 3: authenticated ya no llama studio_invite_user directo; service_role queda igual.
  if pg_catalog.has_function_privilege('authenticated', v_siu, 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', v_siu, 'EXECUTE') then
    raise exception '0545: authenticated o anon siguen ejecutando studio_invite_user';
  end if;
  if pg_catalog.has_function_privilege('service_role', v_siu, 'EXECUTE')::text
     <> pg_catalog.current_setting('dtd.siu_sr_0545') then
    raise exception '0545: cambió el EXECUTE de service_role sobre studio_invite_user';
  end if;
  if coalesce((select p.proacl::text from pg_catalog.pg_proc p where p.oid = v_d1), 'null')
     || '|' || coalesce((select p.proacl::text from pg_catalog.pg_proc p where p.oid = v_ipa), 'null')
     || '|' || coalesce((select p.proacl::text from pg_catalog.pg_proc p where p.oid = v_sai), 'null')
     <> pg_catalog.current_setting('dtd.acl_0545') then
    raise exception '0545: cambió el ACL de audit_d1_execute, is_platform_admin() o studio_accept_invitation';
  end if;
  if not pg_catalog.has_function_privilege('authenticated', v_d1, 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', v_ipa, 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', v_sai, 'EXECUTE') then
    raise exception '0545: authenticated perdió EXECUTE de audit_d1_execute, is_platform_admin() o studio_accept_invitation';
  end if;
end;
$postflight$;
