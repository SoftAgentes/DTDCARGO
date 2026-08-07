-- ─────────────────────────────────────────────────────────────
-- 0355 · Superadmin · las llaves del sistema salen de "admin"
--
-- QUÉ RESUELVE: hasta hoy `admin` era todo o nada. El founder pidió un nivel
-- por encima —"todo lo del admin MÁS las llaves del sistema"— y este es su
-- primer corte, deliberadamente chico: DOS llaves, no todas.
--
-- 🔴 EL HUECO QUE CIERRA, Y QUE SE ABRIÓ HOY MISMO: al subir a un segundo
-- director a `admin` (2026-08-06), quedó con capacidad de DESACTIVAR o DEGRADAR
-- al founder. El anti-lockout de la 0200 sólo bloquea cuando el target es el
-- ÚLTIMO admin activo (`v_other_active_admins = 0`); con tres admins deja pasar
-- todo lo demás. No es teórico: es consecuencia directa de un cambio de rol
-- hecho esta semana.
--
-- ⭐ POR QUÉ EN LA BASE Y NO EN LA APP: `studio_set_user_disabled` y
-- `studio_change_user_role` tienen `grant execute ... to authenticated`, así que
-- son invocables como endpoint desde PostgREST. Gatear sólo la server action
-- dejaría el mismo hueco un nivel más abajo — es exactamente el error que
-- SDD-0085 ya cometió una vez y que cazó su auditoría adversarial. El control
-- real va donde vive el privilegio.
--
-- SE REUSA `platform_admins` (migr 0058) EN VEZ DE UN ROL NUEVO. Dos motivos
-- medidos: (1) los 7 roles están fijados en CINCO lugares de la base —CHECK de
-- user_tenants, CHECK de user_invitations, y tres funciones (migr 0189)— así que
-- un rol nuevo es una migración con blast radius grande; (2) la tabla ya existe
-- con su RLS, su helper `is_platform_admin()` y su fila del founder sembrada
-- desde el 2026-05-29, y hasta hoy NINGÚN código la leía. Su propia cabecera lo
-- dice: "NO se agrega al enum StudioUserRole porque no es un rol más DENTRO del
-- tenant". Se levanta la infraestructura dormida en vez de crear un segundo
-- concepto de superadmin conviviendo con el primero.
--
-- LAS DOS LLAVES DE ESTE CORTE:
--   1. Feature flags — encender/apagar módulos del ERP. Lo pidió explícitamente.
--   2. Tocar a otro admin — desactivarlo o cambiarle el rol.
--
-- LO QUE **NO** ENTRA (queda como está, abierto a cualquier admin): capa legal,
-- No-Olvidar, Financiero China, Dirección, Mailing, Rendiciones. Son decisión
-- pendiente del founder y no se suben por iniciativa propia.
--
-- ⚠️ SOBRE SÍ MISMO SIGUE PUDIENDO: un admin puede degradarse o desactivarse a
-- sí mismo. Bloquearlo sería otra clase de encierro, y el anti-lockout del
-- último admin ya protege al tenant de quedarse sin nadie.
--
-- ⚠️ RECUPERACIÓN: `platform_admins` sólo la escribe `service_role`. Si el único
-- platform admin pierde el acceso, la vía es SQL con service_role — igual que
-- antes de esta migración. No se degrada nada; simplemente conviene saberlo.
-- ─────────────────────────────────────────────────────────────

do $preflight$
begin
  if to_regclass('public.platform_admins') is null then
    raise exception '0355 requiere public.platform_admins (migr 0058)';
  end if;
  if to_regprocedure('public.is_platform_admin()') is null then
    raise exception '0355 requiere public.is_platform_admin() (migr 0058)';
  end if;
  if not exists (select 1 from public.platform_admins) then
    raise exception '0355 abortado: platform_admins está VACÍA. Aplicarla dejaría las llaves sin dueño y nadie podría tocar los feature flags.';
  end if;
end;
$preflight$;

-- ─── Segundo juego de llaves · cuenta de respaldo del founder ─
--
-- POR QUÉ: al aplicar esta migración las llaves quedan en UNA sola cuenta, y
-- `platform_admins` sólo la escribe `service_role` — o sea que si el founder
-- pierde el acceso a su correo principal, NADIE puede devolvérselas desde el
-- Studio: hay que entrar al SQL Editor de Supabase. Antes de esta migración eso
-- no importaba porque ningún código leía la tabla; ahora sí.
--
-- Decisión del founder (2026-08-07): que su segunda cuenta,
-- `hailuway.com@hotmail.com`, tenga la llave **y** membresía de Admin. Sin el
-- rol la llave no sirve para recuperar: `is_platform_admin()` devolvería true,
-- pero sin membership no puede abrir ninguna pantalla del Studio —incluida la
-- de feature flags— así que sostendría un permiso que no puede ejercer.
--
-- Idempotente y portable: si ese correo no existe (entorno de prueba, branch
-- efímero) sólo deja un NOTICE y sigue. La postcondición no lo exige por eso.
do $respaldo$
declare
  v_user uuid;
  v_tenant uuid;
  v_otorgante uuid;
begin
  select id into v_user from auth.users where email = 'hailuway.com@hotmail.com';
  if v_user is null then
    raise notice '0355: hailuway.com@hotmail.com no existe en este entorno — se omite el segundo juego de llaves';
    return;
  end if;

  -- Tenant y otorgante: los del platform admin que ya existe, para no
  -- hardcodear ids y que funcione igual en cualquier entorno.
  select pa.user_id into v_otorgante from public.platform_admins pa limit 1;
  select ut.tenant_id into v_tenant
  from public.user_tenants ut
  where ut.user_id = v_otorgante and ut.disabled_at is null
  limit 1;

  if v_tenant is null then
    raise notice '0355: no se pudo resolver el tenant del platform admin — se omite el segundo juego de llaves';
    return;
  end if;

  -- ⚠️ EL PERFIL VA PRIMERO. `user_tenants` tiene FK
  -- `user_tenants_user_id_profile_fkey` → `user_profiles`, y esta cuenta existe
  -- en `auth.users` SIN fila de perfil (es anterior al trigger handle_new_user,
  -- o se creó por otra vía). Sin esta inserción la migración revienta con
  -- 23503 — pasó en el primer intento de aplicarla contra prod, 2026-08-07.
  -- Sólo `user_id` es obligatorio; el resto tiene default o admite null.
  insert into public.user_profiles (user_id)
  values (v_user)
  on conflict (user_id) do nothing;

  insert into public.user_tenants (user_id, tenant_id, role)
  values (v_user, v_tenant, 'admin')
  on conflict (user_id, tenant_id) do update
    set role = 'admin', disabled_at = null;

  insert into public.platform_admins (user_id, granted_by, notes)
  values (v_user, v_otorgante, 'Cuenta de respaldo del founder — segundo juego de llaves (0355)')
  on conflict (user_id) do nothing;

  raise notice '0355: segundo juego de llaves otorgado a hailuway.com@hotmail.com';
end;
$respaldo$;

-- ─── Llave 1 · feature flags ─────────────────────────────────
-- La policy vieja dejaba actualizar a CUALQUIER admin activo del tenant.
-- Se conserva el scope por tenant y se le suma la exigencia de plataforma.
drop policy if exists feature_flags_admin_update on public.feature_flags;

create policy feature_flags_platform_admin_update
  on public.feature_flags
  for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.is_platform_admin())
  )
  with check (tenant_id = (select public.get_user_tenant_id()));

comment on policy feature_flags_platform_admin_update on public.feature_flags is
  'Sólo un platform admin enciende/apaga módulos. Antes bastaba con ser admin del tenant. SDD-0250 · 0355.';

-- ─── Llave 2a · desactivar a otro admin ──────────────────────
-- Cuerpo idéntico al vivo (0200) salvo el bloque nuevo marcado 0355.
create or replace function public.studio_set_user_disabled(
  p_target_user_id uuid,
  p_disabled boolean
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid := public.get_user_tenant_id();
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_target_role text;
  v_target_disabled_at timestamptz;
  v_other_active_admins int;
begin
  if v_tenant_id is null then
    raise exception 'Sin membership activo' using errcode = '42501';
  end if;

  select role into v_actor_role
  from public.user_tenants
  where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null;
  if v_actor_role is distinct from 'admin' then
    raise exception 'Solo admins pueden activar/desactivar usuarios' using errcode = '42501';
  end if;

  select role, disabled_at into v_target_role, v_target_disabled_at
  from public.user_tenants
  where user_id = p_target_user_id and tenant_id = v_tenant_id;
  if v_target_role is null then
    raise exception 'El usuario target no pertenece a este tenant' using errcode = '23503';
  end if;

  -- ─── 0355 · un admin no toca a OTRO admin ───
  if v_target_role = 'admin'
     and p_target_user_id <> v_actor
     and not public.is_platform_admin() then
    raise exception 'Solo el superadministrador puede suspender a otro administrador'
      using errcode = '42501';
  end if;

  -- Anti-lockout (0200): no desactivar al último admin activo del tenant.
  if p_disabled and v_target_role = 'admin' and v_target_disabled_at is null then
    perform pg_advisory_xact_lock(hashtextextended('user_tenants_admins:' || v_tenant_id::text, 42));
    select count(*) into v_other_active_admins
    from public.user_tenants
    where tenant_id = v_tenant_id
      and role = 'admin'
      and disabled_at is null
      and user_id <> p_target_user_id;
    if v_other_active_admins = 0 then
      raise exception 'No se puede desactivar al último admin del tenant' using errcode = '23514';
    end if;
  end if;

  update public.user_tenants
  set disabled_at = case when p_disabled then coalesce(disabled_at, now()) else null end
  where user_id = p_target_user_id and tenant_id = v_tenant_id;

  return true;
end;
$function$;

-- ─── Llave 2b · cambiarle el rol a otro admin ────────────────
create or replace function public.studio_change_user_role(
  p_target_user_id uuid,
  p_new_role text
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid := public.get_user_tenant_id();
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_target_role text;
  v_target_disabled_at timestamptz;
  v_admin_count int;
begin
  if p_new_role not in ('admin', 'commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing') then
    raise exception 'Rol inválido: %', p_new_role using errcode = '22023';
  end if;

  select role into v_actor_role
  from public.user_tenants
  where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null;
  if v_actor_role <> 'admin' then
    raise exception 'Solo admins pueden cambiar roles' using errcode = '42501';
  end if;

  select role, disabled_at into v_target_role, v_target_disabled_at
  from public.user_tenants
  where user_id = p_target_user_id and tenant_id = v_tenant_id;
  if v_target_role is null then
    raise exception 'El usuario target no pertenece a este tenant' using errcode = '23503';
  end if;

  -- ─── 0355 · un admin no toca a OTRO admin ───
  -- Cubre los dos sentidos: degradar a un admin existente Y ascender a alguien
  -- a admin. Sin la segunda mitad, cualquier admin podría fabricarse aliados.
  if (v_target_role = 'admin' or p_new_role = 'admin')
     and p_target_user_id <> v_actor
     and not public.is_platform_admin() then
    raise exception 'Solo el superadministrador puede cambiar el rol de un administrador'
      using errcode = '42501';
  end if;

  -- Anti-lockout (0200): no degradar al último admin activo.
  if v_target_role = 'admin' and p_new_role <> 'admin' and v_target_disabled_at is null then
    perform pg_advisory_xact_lock(hashtextextended('user_tenants_admins:' || v_tenant_id::text, 42));
    select count(*) into v_admin_count
    from public.user_tenants
    where tenant_id = v_tenant_id and role = 'admin' and disabled_at is null;
    if v_admin_count <= 1 then
      raise exception 'No se puede degradar al último admin del tenant' using errcode = '23514';
    end if;
  end if;

  update public.user_tenants
  set role = p_new_role
  where user_id = p_target_user_id and tenant_id = v_tenant_id;

  return true;
end;
$function$;

-- ─── Postcondiciones ─────────────────────────────────────────
do $post$
begin
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='feature_flags'
      and policyname='feature_flags_admin_update'
  ) then
    raise exception '0355: la policy vieja de feature_flags sigue viva';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='feature_flags'
      and policyname='feature_flags_platform_admin_update'
  ) then
    raise exception '0355: no quedó la policy nueva de feature_flags';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='studio_set_user_disabled'
      and pg_get_functiondef(p.oid) like '%is_platform_admin%'
  ) then
    raise exception '0355: studio_set_user_disabled no quedó con el gate de plataforma';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='studio_change_user_role'
      and pg_get_functiondef(p.oid) like '%is_platform_admin%'
  ) then
    raise exception '0355: studio_change_user_role no quedó con el gate de plataforma';
  end if;
end;
$post$;
