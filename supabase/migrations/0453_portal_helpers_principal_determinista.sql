-- ─────────────────────────────────────────────────────────────
-- 0453 · SDD-0466 — Helpers del Portal por principal, deterministas y sin
-- cruce de tenant.
--
-- LOS TRES HUECOS (en main, y en producción hasta aplicar esta migración)
--   · `get_user_tenant_id()` (0200:50-62) toma la primera membresía activa con
--     `limit 1` sin orden. `user_tenants` admite N membresías por usuario (PK
--     `(user_id, tenant_id)`, 0001:28): con dos activas, el tenant que gobierna
--     ~480 policies «<tabla> by tenant» y las RPC 0411-0413 es arbitrario.
--   · `get_portal_client_markbox()` (0080:49-55) devuelve el Shipping Mark del
--     cliente del vínculo activo sin mirar si el cliente vive ni si vínculo y
--     cliente son del mismo tenant. El Shipping Mark es único POR tenant
--     (0006:23): un vínculo incoherente o con cliente borrado leía por cada
--     policy que comparaba sólo ese valor. Las migraciones de frontera del
--     Portal por principal y tenant reemplazaron esas policies: en el catálogo
--     de main reconstruido ninguna policy ni función nombra ya la helper, pero
--     la RPC sigue entregándole ese Shipping Mark a la app. Además `limit 1` sin
--     orden: hoy `unique (auth_user_id)` (0080:30) impide dos vínculos por
--     usuario, y ningún comentario de las funciones lo declara; si esa garantía
--     se retira, la elección se vuelve arbitraria en silencio.
--   · `client_delivery_addresses_validate_client()` (0198:125-152) sella
--     `tenant_id` y `client_markbox` desde `clients` sin mirar el principal.
--     Cuando la RLS no aplica (dueño de la tabla, SECURITY DEFINER,
--     service_role) acepta cualquier cliente vivo: un vínculo de otro tenant o
--     con cliente borrado escribe direcciones de un cliente que no es suyo.
--
-- LA REGLA
--   · `get_user_tenant_id()`: el tenant de la ÚNICA membresía activa; con cero
--     o con más de una devuelve NULL (fail-closed). No hay claim de tenant en
--     el JWT ni selector en la aplicación: cualquier elección en SQL sería
--     silenciosa y no coincidiría con la fila que la aplicación toma por su
--     cuenta. Con una sola membresía activa, idéntica a 0200.
--   · `get_portal_client_markbox()`: el Shipping Mark del ÚNICO vínculo activo
--     cuyo cliente vive y comparte tenant con el vínculo; con cero o con más
--     de uno devuelve NULL. Es la frontera que 0430/0452 ya aplican por RLS.
--   · `client_delivery_addresses_validate_client()`: si hay principal
--     (`auth.uid()`), tiene que ser miembro activo del tenant del cliente o
--     titular del Portal de ESE cliente por un vínculo activo del mismo
--     tenant; si no, 42501. Sin principal (lotes, service_role) conserva el
--     sellado de 0198. Los mensajes no llevan ids ni Shipping Marks.
--
-- SÓLO REDEFINE LAS TRES FUNCIONES con `create or replace`: conservan oid,
-- dueño y ACL, el trigger de 0198 sigue apuntando a la misma función y
-- ninguna policy se toca. Sin DML, grants, policies ni cambios de tablas.
--
-- PREFLIGHT QUE FALLA CERRADO
--   · tablas con RLS y columnas que las funciones nombran;
--   · las tres funciones existen con su forma (retorno, lenguaje, SECURITY
--     DEFINER, volatilidad y ACL: authenticated ejecuta las dos helpers y no la
--     función del trigger, y anon no ejecuta ninguna; el resto de la ACL, como
--     service_role en producción, no se exige y la huella la conserva);
--   · el cuerpo de cada una es el histórico (0200 / 0080 / 0198) o el final
--     (idempotente). Para la función del trigger acepta además la forma Cloud
--     de 0198: el mismo cuerpo sin su comentario interno, medido en producción
--     el 2026-09-14 (md5 7db6f812a549df579f2d7d0d6cd72298), como 0423 acepta
--     el cuerpo de 0195 del repo o de Cloud. Cualquier otro cuerpo aborta para
--     revisar antes de aplicar;
--   · el trigger `client_delivery_addresses_validate_trg` está vivo.
--   El preflight guarda una huella del catálogo dependiente (policies y
--   funciones que nombran las helpers, ACL de las tres, el trigger) y el
--   postflight exige que no haya cambiado. Los mensajes llevan la regla
--   incumplida, nunca ids ni Shipping Marks.
--
-- LOCKS (medidos en PostgreSQL 17.11 sobre el schema completo reconstruido, con
-- la forma de producción)
-- Sólo ACCESS SHARE sobre tablas del producto, hasta el COMMIT: el smoke del
-- postflight lee `clients`, `client_users` y `user_tenants`, y el deparse de las
-- policies en la huella (pg_get_expr) toma ese modo sobre las tablas que nombran
-- sus subconsultas; en el catálogo de main son 19 tablas y 28 índices. Ninguno
-- hace esperar lecturas ni escrituras; sólo choca con un DDL concurrente (ACCESS
-- EXCLUSIVE) sobre esas tablas: con uno retenido sobre `clients`, la migración
-- cortó a los 5,0 s por `lock_timeout` y no cambió nada. En catálogos,
-- RowExclusiveLock sobre pg_description por los comentarios. Las sesiones en
-- curso adoptan la definición nueva al invalidarse su caché. `lock_timeout` y
-- `statement_timeout` de sesión como en 0422; se restauran al final.
--
-- NO aplicar a Producción desde esta rama. Requiere el OK nominal de Sam y el
-- runbook docs/runbooks/aplicar-migraciones-prod.md: de a una y con el name
-- exacto `0453_portal_helpers_principal_determinista`.
-- ─────────────────────────────────────────────────────────────
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  -- Cuerpos normalizados (sin espacios) de las formas aceptadas.
  c_tenant_0200 constant text := 'selecttenant_idfrompublic.user_tenantswhereuser_id=(selectauth.uid())anddisabled_atisnulllimit1;';
  c_tenant_0453 constant text := 'select(pg_catalog.array_agg(ut.tenant_id))[1]frompublic.user_tenantsasutwhereut.user_id=(selectauth.uid())andut.disabled_atisnullhavingpg_catalog.count(*)=1;';
  c_markbox_0080 constant text := 'selectc.markboxfrompublic.client_userscujoinpublic.clientsconc.id=cu.client_idwherecu.auth_user_id=auth.uid()andcu.status=''active''limit1';
  c_markbox_0453 constant text := 'select(pg_catalog.array_agg(c.markbox))[1]frompublic.client_usersascujoinpublic.clientsasconc.id=cu.client_idandc.tenant_id=cu.tenant_idandc.deleted_atisnullwherecu.auth_user_id=(selectauth.uid())andcu.status=''active''havingpg_catalog.count(*)=1;';
  -- Forma Cloud de 0198: el mismo cuerpo sin su comentario interno de tres líneas,
  -- medida en producción el 2026-09-14 (md5(prosrc) 7db6f812a549df579f2d7d0d6cd72298).
  c_validate_0198_cloud constant text := 'declarev_tenantuuid;v_markboxtext;beginselecttenant_id,markboxintov_tenant,v_markboxfrompublic.clientswhereid=new.client_idanddeleted_atisnull;ifv_tenantisnullthenraiseexception''direcciónsobreclienteinexistenteoborrado(client%)'',new.client_idusingerrcode=''check_violation'';endif;new.tenant_id:=v_tenant;new.client_markbox:=v_markbox;returnnew;end;';
  c_validate_0198 constant text := 'declarev_tenantuuid;v_markboxtext;beginselecttenant_id,markboxintov_tenant,v_markboxfrompublic.clientswhereid=new.client_idanddeleted_atisnull;ifv_tenantisnullthenraiseexception''direcciónsobreclienteinexistenteoborrado(client%)'',new.client_idusingerrcode=''check_violation'';endif;--UnclientedelportalsolopuedetocarSUmarkbox(logarantizalaRLScon--get_portal_client_markbox());acásellamostenant+markboxdesdelafuente,--asíelbodynopuedeapuntarlafilaaotrotenant/markbox.new.tenant_id:=v_tenant;new.client_markbox:=v_markbox;returnnew;end;';
  c_validate_0453 constant text := 'declarev_tenantuuid;v_markboxtext;v_actoruuid:=auth.uid();beginselectc.tenant_id,c.markboxintov_tenant,v_markboxfrompublic.clientsascwherec.id=new.client_idandc.deleted_atisnull;ifv_tenantisnullthenraiseexception''direcciónsobreclienteinexistenteoborrado''usingerrcode=''check_violation'';endif;--Conprincipal(sesiónocomandoSECURITYDEFINER):miembroactivodel--tenantdelcliente,otitulardelPortaldeESEclienteporunvínculo--activodelmismotenant.Sinprincipal(lotes,service_role)seconserva--elselladode0198.ifv_actorisnotnullandnotexists(select1frompublic.user_tenantsasutwhereut.user_id=v_actorandut.tenant_id=v_tenantandut.disabled_atisnull)andnotexists(select1frompublic.client_usersascuwherecu.auth_user_id=v_actorandcu.status=''active''andcu.client_id=new.client_idandcu.tenant_id=v_tenant)thenraiseexception''elprincipalnopuedeescribirdireccionesdeesecliente''usingerrcode=''insufficient_privilege'';endif;new.tenant_id:=v_tenant;new.client_markbox:=v_markbox;returnnew;end;';
  v_table text;
  v_column record;
  v_fn record;
  v_body text;
  v_huella text;
begin
  if pg_catalog.to_regprocedure('auth.uid()') is null
     or pg_catalog.to_regrole('authenticated') is null
     or pg_catalog.to_regrole('anon') is null then
    raise exception '0453 requiere auth.uid() y los roles authenticated y anon';
  end if;

  foreach v_table in array array[
    'public.user_tenants', 'public.client_users', 'public.clients', 'public.client_delivery_addresses'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_class
      where oid = pg_catalog.to_regclass(v_table) and relkind in ('r', 'p') and relrowsecurity
    ) then
      raise exception '0453 requiere tabla con RLS: %', v_table;
    end if;
  end loop;

  for v_column in select * from (values
    ('public.user_tenants', 'user_id'), ('public.user_tenants', 'tenant_id'),
    ('public.user_tenants', 'disabled_at'),
    ('public.client_users', 'auth_user_id'), ('public.client_users', 'client_id'),
    ('public.client_users', 'tenant_id'), ('public.client_users', 'status'),
    ('public.clients', 'id'), ('public.clients', 'tenant_id'), ('public.clients', 'markbox'),
    ('public.clients', 'deleted_at'),
    ('public.client_delivery_addresses', 'client_id'), ('public.client_delivery_addresses', 'tenant_id'),
    ('public.client_delivery_addresses', 'client_markbox')
  ) as c(relation, attname) loop
    if not exists (
      select 1 from pg_catalog.pg_attribute
      where attrelid = pg_catalog.to_regclass(v_column.relation)
        and attname = v_column.attname and attnum > 0 and not attisdropped
    ) then
      raise exception '0453 requiere la columna %.%', v_column.relation, v_column.attname;
    end if;
  end loop;

  -- Forma de las tres funciones: retorno, lenguaje, SECURITY DEFINER, volatilidad y ACL.
  for v_fn in select * from (values
    ('public.get_user_tenant_id()', 'uuid', 'sql', 's', true),
    ('public.get_portal_client_markbox()', 'text', 'sql', 's', true),
    ('public.client_delivery_addresses_validate_client()', 'trigger', 'plpgsql', 'v', false)
  ) as f(signature, rettype, lang, volatility, api_execute) loop
    if pg_catalog.to_regprocedure(v_fn.signature) is null then
      raise exception '0453 requiere la función %', v_fn.signature;
    end if;
    if not exists (
      select 1 from pg_catalog.pg_proc p
      join pg_catalog.pg_language l on l.oid = p.prolang
      where p.oid = pg_catalog.to_regprocedure(v_fn.signature)
        and p.prokind = 'f' and p.prosecdef and not p.proretset
        and p.prorettype = pg_catalog.to_regtype(v_fn.rettype)
        and l.lanname = v_fn.lang and p.provolatile = v_fn.volatility
    ) then
      raise exception '0453 abortada: % no tiene la forma esperada (retorno, lenguaje, SECURITY DEFINER o volatilidad)', v_fn.signature;
    end if;
    if pg_catalog.has_function_privilege('anon', pg_catalog.to_regprocedure(v_fn.signature), 'EXECUTE')
       or pg_catalog.has_function_privilege('authenticated', pg_catalog.to_regprocedure(v_fn.signature), 'EXECUTE')
          <> v_fn.api_execute then
      raise exception '0453 abortada: ACL inesperada en %', v_fn.signature;
    end if;
  end loop;

  -- Cuerpos: histórico o final; cualquier otro se revisa antes de aplicar.
  select pg_catalog.regexp_replace(prosrc, '\s', '', 'g') into v_body
    from pg_catalog.pg_proc where oid = pg_catalog.to_regprocedure('public.get_user_tenant_id()');
  if v_body <> c_tenant_0200 and v_body <> c_tenant_0453 then
    raise exception '0453 abortada: el cuerpo de get_user_tenant_id() no es el de 0200 ni el final; revisar antes de aplicar';
  end if;
  select pg_catalog.regexp_replace(prosrc, '\s', '', 'g') into v_body
    from pg_catalog.pg_proc where oid = pg_catalog.to_regprocedure('public.get_portal_client_markbox()');
  if v_body <> c_markbox_0080 and v_body <> c_markbox_0453 then
    raise exception '0453 abortada: el cuerpo de get_portal_client_markbox() no es el de 0080 ni el final; revisar antes de aplicar';
  end if;
  select pg_catalog.regexp_replace(prosrc, '\s', '', 'g') into v_body
    from pg_catalog.pg_proc where oid = pg_catalog.to_regprocedure('public.client_delivery_addresses_validate_client()');
  if v_body <> c_validate_0198 and v_body <> c_validate_0198_cloud and v_body <> c_validate_0453 then
    raise exception '0453 abortada: el cuerpo de client_delivery_addresses_validate_client() no es el de 0198 (repo o Cloud) ni el final; revisar antes de aplicar';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_trigger t
    where t.tgrelid = 'public.client_delivery_addresses'::pg_catalog.regclass
      and t.tgname = 'client_delivery_addresses_validate_trg'
      and t.tgfoid = pg_catalog.to_regprocedure('public.client_delivery_addresses_validate_client()')
      and t.tgenabled <> 'D' and not t.tgisinternal
      and (t.tgtype & 1) = 1      -- FOR EACH ROW
      and (t.tgtype & 2) = 2      -- BEFORE
      and (t.tgtype & 4) = 4      -- INSERT
      and (t.tgtype & 16) = 16    -- UPDATE
  ) then
    raise exception '0453 abortada: el trigger client_delivery_addresses_validate_trg no está vivo con la forma de 0198';
  end if;

  -- Huella del catálogo dependiente, que el postflight exige intacta.
  select pg_catalog.md5(pg_catalog.string_agg(x, '|' order by x)) into v_huella
  from (
    select 'F:' || p.oid::text || ':' || p.proowner::text || ':' || coalesce(p.proacl::text, '')
           || ':' || p.prosecdef::text
      from pg_catalog.pg_proc p
     where p.oid in (
       pg_catalog.to_regprocedure('public.get_user_tenant_id()'),
       pg_catalog.to_regprocedure('public.get_portal_client_markbox()'),
       pg_catalog.to_regprocedure('public.client_delivery_addresses_validate_client()'))
    union all
    select 'D:' || p.oid::text || ':' || pg_catalog.md5(p.prosrc) || ':' || coalesce(p.proacl::text, '')
           || ':' || coalesce(p.proconfig::text, '')
      from pg_catalog.pg_proc p
     where p.pronamespace = 'public'::pg_catalog.regnamespace
       and p.oid not in (
         pg_catalog.to_regprocedure('public.get_user_tenant_id()'),
         pg_catalog.to_regprocedure('public.get_portal_client_markbox()'),
         pg_catalog.to_regprocedure('public.client_delivery_addresses_validate_client()'))
       and (p.prosrc like '%get_user_tenant_id%' or p.prosrc like '%get_portal_client_markbox%')
    union all
    select 'P:' || pol.polrelid::text || ':' || pol.polname || ':' || pol.polcmd::text || ':'
           || pol.polpermissive::text || ':' || pol.polroles::text || ':'
           || coalesce(pg_catalog.pg_get_expr(pol.polqual, pol.polrelid), '') || ':'
           || coalesce(pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid), '')
      from pg_catalog.pg_policy pol
     where coalesce(pg_catalog.pg_get_expr(pol.polqual, pol.polrelid), '') like '%get_user_tenant_id%'
        or coalesce(pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid), '') like '%get_user_tenant_id%'
        or coalesce(pg_catalog.pg_get_expr(pol.polqual, pol.polrelid), '') like '%get_portal_client_markbox%'
        or coalesce(pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid), '') like '%get_portal_client_markbox%'
    union all
    select 'T:' || t.oid::text || ':' || t.tgfoid::text || ':' || t.tgtype::text || ':' || t.tgenabled::text
      from pg_catalog.pg_trigger t
     where t.tgrelid = 'public.client_delivery_addresses'::pg_catalog.regclass and not t.tgisinternal
  ) s(x);
  perform pg_catalog.set_config('dtd.huella_0453', coalesce(v_huella, ''), false);
end;
$preflight$;

-- ─── get_user_tenant_id(): el tenant de la única membresía activa ─────────
create or replace function public.get_user_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1]
  from public.user_tenants as ut
  where ut.user_id = (select auth.uid())
    and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;

comment on function public.get_user_tenant_id is
  'Helper para RLS policies. Devuelve el tenant_id de la ÚNICA membresía activa (disabled_at is null) del usuario autenticado; con cero o con más de una devuelve NULL (fail-closed, SDD-0466/0453). (select auth.uid()) wrap garantiza caching por query.';

-- ─── get_portal_client_markbox(): el Shipping Mark del único vínculo coherente ─
create or replace function public.get_portal_client_markbox()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select (pg_catalog.array_agg(c.markbox))[1]
  from public.client_users as cu
  join public.clients as c
    on c.id = cu.client_id
   and c.tenant_id = cu.tenant_id
   and c.deleted_at is null
  where cu.auth_user_id = (select auth.uid())
    and cu.status = 'active'
  having pg_catalog.count(*) = 1;
$$;

comment on function public.get_portal_client_markbox is
  'Portal (SDD-0042): Shipping Mark del ÚNICO vínculo client_users activo del auth.uid() actual cuyo cliente vive y comparte tenant con el vínculo; con cero o con más de uno devuelve NULL (fail-closed, SDD-0466/0453). Hoy unique (auth_user_id) de 0080 impide dos vínculos; la función no depende de esa garantía.';

-- ─── client_delivery_addresses_validate_client(): por principal y tenant ──
create or replace function public.client_delivery_addresses_validate_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant  uuid;
  v_markbox text;
  v_actor   uuid := auth.uid();
begin
  select c.tenant_id, c.markbox into v_tenant, v_markbox
  from public.clients as c
  where c.id = new.client_id
    and c.deleted_at is null;

  if v_tenant is null then
    raise exception 'dirección sobre cliente inexistente o borrado'
      using errcode = 'check_violation';
  end if;

  -- Con principal (sesión o comando SECURITY DEFINER): miembro activo del
  -- tenant del cliente, o titular del Portal de ESE cliente por un vínculo
  -- activo del mismo tenant. Sin principal (lotes, service_role) se conserva
  -- el sellado de 0198.
  if v_actor is not null
     and not exists (
       select 1 from public.user_tenants as ut
       where ut.user_id = v_actor
         and ut.tenant_id = v_tenant
         and ut.disabled_at is null
     )
     and not exists (
       select 1 from public.client_users as cu
       where cu.auth_user_id = v_actor
         and cu.status = 'active'
         and cu.client_id = new.client_id
         and cu.tenant_id = v_tenant
     ) then
    raise exception 'el principal no puede escribir direcciones de ese cliente'
      using errcode = 'insufficient_privilege';
  end if;

  new.tenant_id      := v_tenant;
  new.client_markbox := v_markbox;
  return new;
end;
$$;

comment on function public.client_delivery_addresses_validate_client is
  'SDD-0138/0466: valida que client_delivery_addresses.client_id exista y viva, exige que el principal (si lo hay) sea miembro activo del tenant del cliente o titular del Portal de ese cliente por un vínculo activo del mismo tenant, y sella tenant_id + client_markbox desde clients. Sin principal conserva el sellado de 0198.';

do $postflight$
declare
  c_tenant_0453 constant text := 'select(pg_catalog.array_agg(ut.tenant_id))[1]frompublic.user_tenantsasutwhereut.user_id=(selectauth.uid())andut.disabled_atisnullhavingpg_catalog.count(*)=1;';
  c_markbox_0453 constant text := 'select(pg_catalog.array_agg(c.markbox))[1]frompublic.client_usersascujoinpublic.clientsasconc.id=cu.client_idandc.tenant_id=cu.tenant_idandc.deleted_atisnullwherecu.auth_user_id=(selectauth.uid())andcu.status=''active''havingpg_catalog.count(*)=1;';
  c_validate_0453 constant text := 'declarev_tenantuuid;v_markboxtext;v_actoruuid:=auth.uid();beginselectc.tenant_id,c.markboxintov_tenant,v_markboxfrompublic.clientsascwherec.id=new.client_idandc.deleted_atisnull;ifv_tenantisnullthenraiseexception''direcciónsobreclienteinexistenteoborrado''usingerrcode=''check_violation'';endif;--Conprincipal(sesiónocomandoSECURITYDEFINER):miembroactivodel--tenantdelcliente,otitulardelPortaldeESEclienteporunvínculo--activodelmismotenant.Sinprincipal(lotes,service_role)seconserva--elselladode0198.ifv_actorisnotnullandnotexists(select1frompublic.user_tenantsasutwhereut.user_id=v_actorandut.tenant_id=v_tenantandut.disabled_atisnull)andnotexists(select1frompublic.client_usersascuwherecu.auth_user_id=v_actorandcu.status=''active''andcu.client_id=new.client_idandcu.tenant_id=v_tenant)thenraiseexception''elprincipalnopuedeescribirdireccionesdeesecliente''usingerrcode=''insufficient_privilege'';endif;new.tenant_id:=v_tenant;new.client_markbox:=v_markbox;returnnew;end;';
  v_fn record;
  v_body text;
  v_huella text;
begin
  for v_fn in select * from (values
    ('public.get_user_tenant_id()', c_tenant_0453, 's'),
    ('public.get_portal_client_markbox()', c_markbox_0453, 's'),
    ('public.client_delivery_addresses_validate_client()', c_validate_0453, 'v')
  ) as f(signature, body, volatility) loop
    select pg_catalog.regexp_replace(p.prosrc, '\s', '', 'g') into v_body
      from pg_catalog.pg_proc p
     where p.oid = pg_catalog.to_regprocedure(v_fn.signature)
       and p.prosecdef and p.provolatile = v_fn.volatility
       and p.proconfig = array['search_path=""']::text[];
    if v_body is distinct from v_fn.body then
      raise exception '0453: % no quedó con la forma final (cuerpo, SECURITY DEFINER, volatilidad o search_path)', v_fn.signature;
    end if;
  end loop;

  select pg_catalog.md5(pg_catalog.string_agg(x, '|' order by x)) into v_huella
  from (
    select 'F:' || p.oid::text || ':' || p.proowner::text || ':' || coalesce(p.proacl::text, '')
           || ':' || p.prosecdef::text
      from pg_catalog.pg_proc p
     where p.oid in (
       pg_catalog.to_regprocedure('public.get_user_tenant_id()'),
       pg_catalog.to_regprocedure('public.get_portal_client_markbox()'),
       pg_catalog.to_regprocedure('public.client_delivery_addresses_validate_client()'))
    union all
    select 'D:' || p.oid::text || ':' || pg_catalog.md5(p.prosrc) || ':' || coalesce(p.proacl::text, '')
           || ':' || coalesce(p.proconfig::text, '')
      from pg_catalog.pg_proc p
     where p.pronamespace = 'public'::pg_catalog.regnamespace
       and p.oid not in (
         pg_catalog.to_regprocedure('public.get_user_tenant_id()'),
         pg_catalog.to_regprocedure('public.get_portal_client_markbox()'),
         pg_catalog.to_regprocedure('public.client_delivery_addresses_validate_client()'))
       and (p.prosrc like '%get_user_tenant_id%' or p.prosrc like '%get_portal_client_markbox%')
    union all
    select 'P:' || pol.polrelid::text || ':' || pol.polname || ':' || pol.polcmd::text || ':'
           || pol.polpermissive::text || ':' || pol.polroles::text || ':'
           || coalesce(pg_catalog.pg_get_expr(pol.polqual, pol.polrelid), '') || ':'
           || coalesce(pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid), '')
      from pg_catalog.pg_policy pol
     where coalesce(pg_catalog.pg_get_expr(pol.polqual, pol.polrelid), '') like '%get_user_tenant_id%'
        or coalesce(pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid), '') like '%get_user_tenant_id%'
        or coalesce(pg_catalog.pg_get_expr(pol.polqual, pol.polrelid), '') like '%get_portal_client_markbox%'
        or coalesce(pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid), '') like '%get_portal_client_markbox%'
    union all
    select 'T:' || t.oid::text || ':' || t.tgfoid::text || ':' || t.tgtype::text || ':' || t.tgenabled::text
      from pg_catalog.pg_trigger t
     where t.tgrelid = 'public.client_delivery_addresses'::pg_catalog.regclass and not t.tgisinternal
  ) s(x);
  if coalesce(v_huella, '') is distinct from pg_catalog.current_setting('dtd.huella_0453', true) then
    raise exception '0453: cambió el catálogo dependiente (ACL o dueño de las tres funciones, policies o funciones que las nombran, o el trigger); esta migración sólo redefine cuerpos';
  end if;

  -- Sin principal las dos helpers cierran: la sesión que aplica no tiene JWT.
  if auth.uid() is null
     and (public.get_user_tenant_id() is not null or public.get_portal_client_markbox() is not null) then
    raise exception '0453: las helpers no cierran sin principal';
  end if;
  perform pg_catalog.set_config('dtd.huella_0453', '', false);
end;
$postflight$;

reset statement_timeout;
reset lock_timeout;
