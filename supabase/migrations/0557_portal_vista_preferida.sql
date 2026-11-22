-- ─────────────────────────────────────────────────────────────────────────────
-- 0557 · SDD-0654 fase 1 — Vista preferida del Portal (Vista simple / Vista Pro).
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla exige el
--    OK nominal de Sam NOMBRANDO este archivo, el runbook
--    docs/runbooks/aplicar-migraciones-prod.md y el Director General, de a una,
--    con el name exacto `0557_portal_vista_preferida`. Fusionar la PR NO
--    autoriza aplicarla.
--    ORDEN: indistinto. Con la app de antes y la migración aplicada no cambia
--    nada visible: nadie lee las columnas nuevas ni llama a las RPC. Con la app
--    nueva y sin la migración, la lectura de la preferencia degrada a «pro» y a
--    «guía ya vista» (lib/portal/vista-preferida.ts) y el selector, que solo
--    existe con PORTAL_VISTA_SIMPLE=true, avisa que no pudo guardar.
--
-- ── Qué crea ────────────────────────────────────────────────────────────────
-- · `client_users.portal_vista text not null`, CHECK simple|pro. Las filas que
--   ya existen quedan en 'pro' (nadie ve un portal distinto sin pedirlo) y el
--   default de las filas nuevas queda en 'simple' (spec §5, AC-2). Se agrega con
--   default 'pro' y después se cambia el default: PostgreSQL 11+ no reescribe la
--   tabla ni hace UPDATE, así que no corre ningún trigger ni se mueve
--   updated_at en las filas existentes.
-- · `client_users.portal_guia_vista_at timestamptz null`: vacío = la guía de las
--   primeras veces todavía no se mostró (spec §6.2, fase 2).
-- · `portal_set_vista(p_vista text)` y `portal_marcar_guia_vista()`:
--   SECURITY DEFINER, search_path vacío, EXECUTE solo authenticated, sin ningún
--   identificador de entrada. Toman la fila ACTIVA de auth.uid() con su cliente
--   vivo del mismo tenant (la misma frontera que el principal del Portal) y
--   escriben SOLO su columna. El trigger client_users_touch mueve updated_at; se
--   acepta (spec §5): nada usa client_users.updated_at como señal de negocio.
-- · Grants explícitos de la tabla: se revocan INSERT, UPDATE, DELETE y TRUNCATE
--   de public, anon y authenticated. `client_users` nunca tuvo policies de
--   escritura (0080: «solo las RPCs SECURITY DEFINER escriben»), así que hoy
--   esas escrituras ya no alcanzan ninguna fila; la revocación vuelve explícito
--   en el catálogo lo que la RLS ya imponía (AC-4). Quien escribe la tabla son
--   funciones SECURITY DEFINER (0080, 0227, 0361, 0454, 0460, 0552) y el
--   service_role, que no se tocan. SELECT para authenticated se conserva.
--
-- ── Qué NO toca ─────────────────────────────────────────────────────────────
-- Las policies (no se agrega ninguna: la RLS filtra filas, no columnas, y una
-- policy de UPDATE dejaría cambiar client_id, tenant_id o status), los triggers,
-- las otras columnas ni las filas.
--
-- LOCKS: un ALTER TABLE (ACCESS EXCLUSIVE breve sobre client_users para agregar
-- las columnas y validar el CHECK, sin reescritura), CREATE FUNCTION, REVOKE,
-- GRANT y COMMENT. Sin backfill. lock_timeout 5 s, statement_timeout 30 s.
-- Reaplicar aborta en el preflight: las columnas ya existen.
-- Desarme: drop de las dos funciones y de las dos columnas (los privilegios
-- revocados no se devuelven; no había policies que los usaran).
-- ─────────────────────────────────────────────────────────────────────────────
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_req record;
  v_bad text;
begin
  if pg_catalog.to_regrole('authenticated') is null
     or pg_catalog.to_regrole('anon') is null
     or pg_catalog.to_regrole('service_role') is null then
    raise exception '0557 requiere los roles authenticated, anon y service_role';
  end if;

  if pg_catalog.to_regprocedure('auth.uid()') is null then
    raise exception '0557 requiere auth.uid()';
  end if;

  -- Cada columna que las funciones leen o escriben.
  for v_req in
    select * from (values
      ('public.client_users', 'id'), ('public.client_users', 'tenant_id'),
      ('public.client_users', 'client_id'), ('public.client_users', 'auth_user_id'),
      ('public.client_users', 'status'), ('public.client_users', 'updated_at'),
      ('public.clients', 'id'), ('public.clients', 'tenant_id'), ('public.clients', 'deleted_at')
    ) as r(tbl, col)
  loop
    if pg_catalog.to_regclass(v_req.tbl) is null or not exists (
      select 1 from pg_catalog.pg_attribute
      where attrelid = pg_catalog.to_regclass(v_req.tbl)
        and attname = v_req.col and attnum > 0 and not attisdropped
    ) then
      raise exception '0557 requiere la columna %.%', v_req.tbl, v_req.col;
    end if;
  end loop;

  -- Lo que esta migración crea no puede existir ya: si existe, alguien la
  -- aplicó (o algo parecido) por otro camino y no sabemos con qué forma.
  if exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.client_users'::pg_catalog.regclass
      and attname in ('portal_vista', 'portal_guia_vista_at')
      and attnum > 0 and not attisdropped
  ) then
    raise exception '0557 abortada: client_users ya tiene portal_vista o portal_guia_vista_at';
  end if;
  if pg_catalog.to_regprocedure('public.portal_set_vista(text)') is not null
     or pg_catalog.to_regprocedure('public.portal_marcar_guia_vista()') is not null then
    raise exception '0557 abortada: portal_set_vista o portal_marcar_guia_vista ya existen';
  end if;

  -- La frontera del Portal en esta tabla es la RLS de solo lectura de 0080.
  if not exists (
    select 1 from pg_catalog.pg_class
    where oid = 'public.client_users'::pg_catalog.regclass and relrowsecurity
  ) then
    raise exception '0557 requiere RLS en client_users';
  end if;
  select pg_catalog.string_agg(p.polname, ', ' order by p.polname) into v_bad
  from pg_catalog.pg_policy as p
  where p.polrelid = 'public.client_users'::pg_catalog.regclass
    and p.polcmd <> 'r';
  if v_bad is not null then
    raise exception '0557 abortada: client_users tiene policies de escritura que esta migración no conoce: %', v_bad;
  end if;

  -- Las RPC escriben una columna nueva: cualquier trigger que corra en TODO
  -- UPDATE (sin lista de columnas) también correría. Solo se conoce el de
  -- updated_at (0080). Los de 0293, 0454 y 0479 son UPDATE OF status/… y no
  -- corren.
  select pg_catalog.string_agg(t.tgname, ', ' order by t.tgname) into v_bad
  from pg_catalog.pg_trigger as t
  where t.tgrelid = 'public.client_users'::pg_catalog.regclass
    and not t.tgisinternal
    and (t.tgtype & 16) <> 0
    and coalesce(pg_catalog.array_length(t.tgattr::pg_catalog.int2[], 1), 0) = 0
    and t.tgname <> 'client_users_touch';
  if v_bad is not null then
    raise exception '0557 abortada: client_users tiene triggers de UPDATE que esta migración no conoce: %', v_bad;
  end if;
end;
$preflight$;

-- ── 1. Columnas ──────────────────────────────────────────────────────────────
alter table public.client_users
  add column portal_vista text not null default 'pro'
    constraint client_users_portal_vista_check check (portal_vista in ('simple', 'pro')),
  add column portal_guia_vista_at timestamptz;

alter table public.client_users
  alter column portal_vista set default 'simple';

comment on column public.client_users.portal_vista is
  'SDD-0654: vista del Portal que eligió el cliente (simple | pro). Las filas anteriores a la 0557 quedaron en pro; las nuevas nacen en simple. Solo la escribe portal_set_vista(text). Sin PORTAL_VISTA_SIMPLE nadie la lee.';
comment on column public.client_users.portal_guia_vista_at is
  'SDD-0654: cuándo se le mostró al cliente la guía de las primeras veces. Vacío = todavía no. Solo la escribe portal_marcar_guia_vista(), una vez.';

-- ── 2. Cambiar la vista ──────────────────────────────────────────────────────
create function public.portal_set_vista(p_vista text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_vista text;
begin
  if p_vista is null or p_vista not in ('simple', 'pro') then
    raise exception 'vista no válida' using errcode = '22023';
  end if;

  update public.client_users as cu
     set portal_vista = p_vista
   where cu.auth_user_id = (select auth.uid())
     and cu.status = 'active'
     and exists (
       select 1 from public.clients as c
       where c.id = cu.client_id
         and c.tenant_id = cu.tenant_id
         and c.deleted_at is null
     )
  returning cu.portal_vista into v_vista;

  if not found then
    raise exception 'sin vínculo activo del Portal' using errcode = '42501';
  end if;

  return v_vista;
end;
$function$;

-- ── 3. Marcar la guía como vista ─────────────────────────────────────────────
create function public.portal_marcar_guia_vista()
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_at timestamptz;
begin
  -- FOR UPDATE: dos pestañas a la vez escriben una sola vez y ven la misma fecha.
  select cu.id, cu.portal_guia_vista_at into v_id, v_at
  from public.client_users as cu
  where cu.auth_user_id = (select auth.uid())
    and cu.status = 'active'
    and exists (
      select 1 from public.clients as c
      where c.id = cu.client_id
        and c.tenant_id = cu.tenant_id
        and c.deleted_at is null
    )
  for update of cu;

  if v_id is null then
    raise exception 'sin vínculo activo del Portal' using errcode = '42501';
  end if;

  if v_at is null then
    update public.client_users as cu
       set portal_guia_vista_at = pg_catalog.now()
     where cu.id = v_id
    returning cu.portal_guia_vista_at into v_at;
  end if;

  return v_at;
end;
$function$;

alter function public.portal_set_vista(text) owner to postgres;
alter function public.portal_marcar_guia_vista() owner to postgres;

-- ── 4. Grants explícitos ─────────────────────────────────────────────────────
revoke all on function public.portal_set_vista(text)
  from public, anon, authenticated, service_role;
revoke all on function public.portal_marcar_guia_vista()
  from public, anon, authenticated, service_role;
grant execute on function public.portal_set_vista(text) to authenticated;
grant execute on function public.portal_marcar_guia_vista() to authenticated;

revoke insert, update, delete, truncate on table public.client_users
  from public, anon, authenticated;

comment on function public.portal_set_vista(text) is
  'SDD-0654: el cliente del Portal elige su vista (simple | pro). Deriva la fila de auth.uid() (vínculo activo, cliente vivo del mismo tenant) y escribe solo portal_vista. 22023 si el valor no vale; 42501 sin vínculo activo.';
comment on function public.portal_marcar_guia_vista() is
  'SDD-0654: marca la guía de las primeras veces como vista, solo si estaba vacía, y devuelve la fecha. Deriva la fila de auth.uid() y escribe solo portal_guia_vista_at. 42501 sin vínculo activo.';

-- ── 5. Postflight ────────────────────────────────────────────────────────────
do $postflight$
declare
  v_fn text;
  v_oid oid;
  v_role text;
  v_priv text;
begin
  if (select pg_catalog.pg_get_expr(d.adbin, d.adrelid)
      from pg_catalog.pg_attrdef as d
      join pg_catalog.pg_attribute as a on a.attrelid = d.adrelid and a.attnum = d.adnum
      where d.adrelid = 'public.client_users'::pg_catalog.regclass
        and a.attname = 'portal_vista') is distinct from '''simple''::text' then
    raise exception '0557 postflight: el default de portal_vista no es simple';
  end if;
  if exists (select 1 from public.client_users where portal_vista <> 'pro') then
    raise exception '0557 postflight: hay filas existentes que no quedaron en pro';
  end if;

  foreach v_fn in array array['public.portal_set_vista(text)', 'public.portal_marcar_guia_vista()'] loop
    v_oid := pg_catalog.to_regprocedure(v_fn);
    if v_oid is null or not exists (
      select 1 from pg_catalog.pg_proc as p
      where p.oid = v_oid and p.prosecdef and p.proconfig @> array['search_path=""']::text[]
    ) then
      raise exception '0557 postflight: % sin SECURITY DEFINER o con search_path', v_fn;
    end if;
    if not pg_catalog.has_function_privilege('authenticated', v_oid, 'EXECUTE')
       or pg_catalog.has_function_privilege('anon', v_oid, 'EXECUTE')
       or pg_catalog.has_function_privilege('service_role', v_oid, 'EXECUTE') then
      raise exception '0557 postflight: EXECUTE de % debe ser solo de authenticated', v_fn;
    end if;
    if exists (
      select 1 from pg_catalog.aclexplode((select proacl from pg_catalog.pg_proc where oid = v_oid)) as a
      where a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ) then
      raise exception '0557 postflight: PUBLIC conserva EXECUTE sobre %', v_fn;
    end if;
  end loop;

  foreach v_role in array array['anon', 'authenticated'] loop
    foreach v_priv in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
      if pg_catalog.has_table_privilege(v_role, 'public.client_users', v_priv) then
        raise exception '0557 postflight: % conserva % sobre client_users', v_role, v_priv;
      end if;
    end loop;
    if pg_catalog.has_any_column_privilege(v_role, 'public.client_users', 'INSERT')
       or pg_catalog.has_any_column_privilege(v_role, 'public.client_users', 'UPDATE') then
      raise exception '0557 postflight: % conserva privilegios de columna de escritura sobre client_users', v_role;
    end if;
  end loop;

  if exists (
    select 1 from pg_catalog.pg_policy
    where polrelid = 'public.client_users'::pg_catalog.regclass and polcmd <> 'r'
  ) then
    raise exception '0557 postflight: client_users tiene policies de escritura';
  end if;
end;
$postflight$;

notify pgrst, 'reload schema';
