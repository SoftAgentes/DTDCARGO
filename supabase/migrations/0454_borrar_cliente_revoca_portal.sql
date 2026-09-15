-- ─────────────────────────────────────────────────────────────
-- 0454 · SDD-0467 — Borrar un cliente revoca su acceso al Portal.
--
-- DECISIÓN DE SAM (2026-09-14, textual): «borrar un cliente: debe revocar el
-- acceso. Así debe ser.»
--
-- EL HUECO (en main, y en producción hasta aplicar esta migración)
--   · El borrado lógico del Studio (`softDeleteClientAction`) sólo pone
--     `clients.deleted_at`. El vínculo `client_users` sigue `active` o
--     `invited`, con `auth_user_id` y `token`, y los códigos cortos de
--     `portal_access_links` siguen sin revocar.
--   · `portal_bind_session()` (0080) activa una fila `invited` por email sin
--     mirar si el cliente vive.
--   · `merge_clients` (0361) marca el duplicado sólo con `status = 'revoked'`:
--     sin `revoked_at`, con `auth_user_id` y `token`. Con `unique (auth_user_id)`
--     esa persona no puede vincularse a otra ficha.
--   La app del Portal ya rechaza al cliente borrado (portal-queries.ts:89-95,
--   layout.tsx:39-40) y el canje del código corto también (loadAccessTarget):
--   el hueco está en los datos y en las RPC.
--
-- LA REGLA
--   Ningún acceso al Portal queda vigente sobre un cliente borrado.
--   · Trigger AFTER UPDATE en `clients`, cuando `deleted_at` pasa de NULL a un
--     valor: en la MISMA transacción revoca todas las filas `client_users` del
--     cliente (status 'revoked', `revoked_at`, `auth_user_id` y `token` en NULL)
--     y todos sus `portal_access_links` sin revocar. Cubre la acción del Studio,
--     `merge_clients` y cualquier UPDATE directo. Si la revocación falla, falla
--     el UPDATE y el borrado no ocurre.
--   · Guarda BEFORE en `client_users` (INSERT o UPDATE de status/client_id que
--     deje la fila `invited` o `active`) y en `portal_access_links` (INSERT o
--     UPDATE de revoked_at/client_id que la deje sin revocar): el cliente tiene
--     que existir y vivir; si no, 23514. Restaurar un cliente no devuelve el
--     acceso: hace falta una invitación nueva.
--   · Backfill idempotente: revoca los vínculos y códigos de los clientes que
--     ya estaban borrados, con conteos agregados en un NOTICE.
--   `merge_clients` no se redefine: muda el acceso ANTES de retirar la ficha, así
--   que el acceso mudado sigue activo en el superviviente y el trigger sólo
--   limpia lo que queda en la ficha retirada.
--
-- CONCURRENCIA
--   · La revocación actualiza TODAS las filas del cliente sin filtrar por estado:
--     una reinvitación concurrente queda bloqueada por esa fila y, al re-evaluar
--     (READ COMMITTED), también se revoca.
--   · Una fila nueva (INSERT) o mudada a otro cliente no la ve la revocación
--     concurrente: la guarda toma `FOR SHARE` sobre el cliente y espera al
--     borrado, que al confirmar la rechaza. En los UPDATE del mismo cliente la
--     guarda no bloquea, para no invertir el orden de locks.
--
-- AUDITORÍA D5
--   `audit_d5_client_users` (0293) ya registra cada cambio de status de
--   `client_users`. Mientras revoca, el trigger fija `dtd.audit_reason` si el
--   caller no trae uno, y lo restaura al terminar, para que el evento
--   `portal_access_status_changed` diga por qué. El actor es quien borra (o
--   `system` sin principal).
--
-- PREFLIGHT QUE FALLA CERRADO (mensajes sin ids ni Shipping Marks)
--   · tablas con RLS y columnas que nombran las funciones; el CHECK de status
--     de `client_users` admite exactamente invited/active/revoked;
--   · `merge_clients` existe, es SECURITY DEFINER y muda o revoca el acceso
--     antes de poner `deleted_at`;
--   · `portal_bind_session()` sólo activa filas `invited` y sólo reconoce
--     filas `active`;
--   · si existe `audit_d5_client_users`, el tipo `portal_invitation` está activo
--     (si no, cada revocación fallaría y bloquearía los borrados);
--   · RLS: el rol que aplica queda como dueño de las dos funciones SECURITY
--     DEFINER; tiene que ser dueño de las tres tablas o tener BYPASSRLS (o ser
--     superusuario), y ninguna puede tener FORCE ROW LEVEL SECURITY. Si no, la
--     revocación y el backfill actualizarían 0 filas sin error;
--   · triggers con los nombres de esta migración: ausentes o con su forma final
--     COMPLETA (habilitados, su función y pg_get_triggerdef normalizado idéntico:
--     evento, momento, columnas y WHEN). El postflight exige lo mismo, y además
--     que el dueño de las funciones evite la RLS de las tres tablas;
--   · huella del catálogo dependiente (triggers ajenos, policies y ACL de las
--     tres tablas, y las RPC del Portal y de fusión), que el postflight exige
--     intacta.
--
-- LOCKS: CREATE TRIGGER toma SHARE ROW EXCLUSIVE sobre `clients`,
-- `client_users` y `portal_access_links` (bloquea escrituras, no lecturas, hasta
-- el COMMIT). Los triggers se crean antes del backfill, así ningún borrado
-- concurrente queda fuera. `lock_timeout` y `statement_timeout` de sesión como
-- en 0453; se restauran al final. Reaplicar no crea ni cambia nada.
--
-- NO aplicar a Producción desde esta rama. Requiere el OK nominal de Sam y el
-- runbook docs/runbooks/aplicar-migraciones-prod.md: de a una y con el name
-- exacto `0454_borrar_cliente_revoca_portal`.
-- ─────────────────────────────────────────────────────────────
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_table text;
  v_column record;
  v_body text;
  v_move int;
  v_revoke int;
  v_retire int;
  v_trg record;
  v_huella text;
begin
  if pg_catalog.to_regrole('authenticated') is null
     or pg_catalog.to_regrole('anon') is null
     or pg_catalog.to_regrole('service_role') is null then
    raise exception '0454 requiere los roles authenticated, anon y service_role';
  end if;

  foreach v_table in array array['public.clients', 'public.client_users', 'public.portal_access_links'] loop
    if not exists (
      select 1 from pg_catalog.pg_class
      where oid = pg_catalog.to_regclass(v_table) and relkind in ('r', 'p') and relrowsecurity
    ) then
      raise exception '0454 requiere tabla con RLS: %', v_table;
    end if;
  end loop;

  for v_column in select * from (values
    ('public.clients', 'id'), ('public.clients', 'tenant_id'), ('public.clients', 'deleted_at'),
    ('public.client_users', 'id'), ('public.client_users', 'client_id'), ('public.client_users', 'status'),
    ('public.client_users', 'auth_user_id'), ('public.client_users', 'token'), ('public.client_users', 'revoked_at'),
    ('public.portal_access_links', 'id'), ('public.portal_access_links', 'client_id'),
    ('public.portal_access_links', 'used_at'), ('public.portal_access_links', 'revoked_at')
  ) as c(relation, attname) loop
    if not exists (
      select 1 from pg_catalog.pg_attribute
      where attrelid = pg_catalog.to_regclass(v_column.relation)
        and attname = v_column.attname and attnum > 0 and not attisdropped
    ) then
      raise exception '0454 requiere la columna %.%', v_column.relation, v_column.attname;
    end if;
  end loop;

  -- El CHECK de 0080: status en invited/active/revoked, ni más ni menos.
  if not exists (
    select 1 from pg_catalog.pg_constraint con
    where con.conrelid = 'public.client_users'::pg_catalog.regclass and con.contype = 'c'
      and pg_catalog.regexp_replace(pg_catalog.pg_get_constraintdef(con.oid), '\s', '', 'g')
          = 'CHECK((status=ANY(ARRAY[''invited''::text,''active''::text,''revoked''::text])))'
  ) then
    raise exception '0454 abortada: client_users no tiene el CHECK de status de 0080 (invited, active, revoked)';
  end if;

  -- merge_clients: muda o revoca el acceso de la ficha retirada ANTES de poner deleted_at.
  if pg_catalog.to_regprocedure('public.merge_clients(uuid,uuid)') is null
     or not exists (
       select 1 from pg_catalog.pg_proc p
       where p.oid = pg_catalog.to_regprocedure('public.merge_clients(uuid,uuid)') and p.prosecdef
     ) then
    raise exception '0454 requiere merge_clients(uuid,uuid) SECURITY DEFINER';
  end if;
  select pg_catalog.regexp_replace(prosrc, '\s', '', 'g') into v_body
    from pg_catalog.pg_proc where oid = pg_catalog.to_regprocedure('public.merge_clients(uuid,uuid)');
  v_revoke := pg_catalog.strpos(v_body, 'updatepublic.client_userssetstatus=''revoked''whereclient_id=m.id;');
  v_move := pg_catalog.strpos(v_body, 'updatepublic.client_userssetclient_id=s.idwhereclient_id=m.id;');
  v_retire := pg_catalog.strpos(v_body, 'deleted_at=now()whereid=m.id;');
  if v_revoke = 0 or v_move = 0 or v_retire = 0 or v_revoke > v_retire or v_move > v_retire then
    raise exception '0454 abortada: merge_clients no muda o revoca el acceso antes de retirar la ficha; revisar antes de aplicar';
  end if;

  -- portal_bind_session(): sólo activa filas invited y sólo reconoce filas active.
  if pg_catalog.to_regprocedure('public.portal_bind_session()') is null then
    raise exception '0454 requiere portal_bind_session()';
  end if;
  select pg_catalog.regexp_replace(prosrc, '\s', '', 'g') into v_body
    from pg_catalog.pg_proc where oid = pg_catalog.to_regprocedure('public.portal_bind_session()');
  if pg_catalog.strpos(v_body, 'whereauth_user_id=auth.uid()andstatus=''active''limit1;') = 0
     or pg_catalog.strpos(v_body, 'wherelower(email)=v_emailandstatus=''invited''limit1;') = 0
     or pg_catalog.strpos(v_body, 'setauth_user_id=auth.uid(),status=''active''') = 0 then
    raise exception '0454 abortada: portal_bind_session() no tiene la forma de 0080; revisar antes de aplicar';
  end if;

  -- RLS: la revocación y el backfill corren como el dueño de las dos funciones
  -- SECURITY DEFINER, que queda siendo el rol que aplica. Ese rol tiene que
  -- saltarse la RLS de las tres tablas (dueño sin FORCE, BYPASSRLS o superusuario);
  -- si no, actualizarían 0 filas sin error y los conteos del postflight también
  -- pasarían por la RLS. FORCE aborta siempre, aunque el rol tenga BYPASSRLS.
  foreach v_table in array array['public.clients', 'public.client_users', 'public.portal_access_links'] loop
    if exists (
      select 1 from pg_catalog.pg_class
      where oid = pg_catalog.to_regclass(v_table) and relforcerowsecurity
    ) then
      raise exception '0454 abortada: % tiene FORCE ROW LEVEL SECURITY; la revocación y el backfill actualizarían 0 filas sin error', v_table;
    end if;
    if not exists (
         select 1 from pg_catalog.pg_roles as r
         where r.rolname = current_user and (r.rolsuper or r.rolbypassrls)
       )
       and not exists (
         select 1 from pg_catalog.pg_class as c
         where c.oid = pg_catalog.to_regclass(v_table)
           and pg_catalog.pg_has_role(current_user, c.relowner, 'USAGE')
       ) then
      raise exception '0454 abortada: el rol que aplica no es dueño de % ni tiene BYPASSRLS; la revocación y el backfill actualizarían 0 filas sin error', v_table;
    end if;
  end loop;

  -- Auditoría D5: si el trigger existe, el tipo de entidad tiene que aceptar eventos.
  if exists (
       select 1 from pg_catalog.pg_trigger t
       where t.tgrelid = 'public.client_users'::pg_catalog.regclass
         and t.tgname = 'audit_d5_client_users' and not t.tgisinternal and t.tgenabled <> 'D'
     )
     and (pg_catalog.to_regclass('public.audit_entity_types') is null
          or not exists (
            select 1 from public.audit_entity_types
            where entity_type = 'portal_invitation' and status = 'active'
          )) then
    raise exception '0454 abortada: audit_d5_client_users está vivo pero el tipo portal_invitation no está activo';
  end if;

  -- Triggers de esta migración: ausentes, o con su forma final COMPLETA
  -- (reaplicación): habilitados, con su función y con la definición exacta de
  -- pg_get_triggerdef (evento, momento, columnas y WHEN), normalizada en espacios
  -- y sin el esquema de la función, que depende del search_path de la sesión.
  -- coalesce: antes de la primera aplicación to_regprocedure() de las funciones
  -- nuevas es NULL, y un NULL dentro del not (...) dejaría pasar un trigger ajeno.
  for v_trg in select * from (values
    ('public.clients', 'clients_revoke_portal_on_soft_delete', 'public.clients_revoke_portal_access()',
     'CREATE TRIGGER clients_revoke_portal_on_soft_delete AFTER UPDATE ON public.clients FOR EACH ROW WHEN (((old.deleted_at IS NULL) AND (new.deleted_at IS NOT NULL))) EXECUTE FUNCTION clients_revoke_portal_access()'),
    ('public.client_users', 'client_users_require_live_client', 'public.portal_access_require_live_client()',
     'CREATE TRIGGER client_users_require_live_client BEFORE INSERT OR UPDATE OF status, client_id ON public.client_users FOR EACH ROW WHEN ((new.status = ANY (ARRAY[''invited''::text, ''active''::text]))) EXECUTE FUNCTION portal_access_require_live_client()'),
    ('public.portal_access_links', 'portal_access_links_require_live_client', 'public.portal_access_require_live_client()',
     'CREATE TRIGGER portal_access_links_require_live_client BEFORE INSERT OR UPDATE OF revoked_at, client_id ON public.portal_access_links FOR EACH ROW WHEN ((new.revoked_at IS NULL)) EXECUTE FUNCTION portal_access_require_live_client()')
  ) as x(relation, tgname, fn, def) loop
    if exists (
      select 1 from pg_catalog.pg_trigger as t
      where t.tgrelid = pg_catalog.to_regclass(v_trg.relation)
        and t.tgname = v_trg.tgname and not t.tgisinternal
        and not coalesce(
          t.tgenabled = 'O'
          and t.tgfoid = pg_catalog.to_regprocedure(v_trg.fn)
          and pg_catalog.replace(pg_catalog.regexp_replace(pg_catalog.pg_get_triggerdef(t.oid), '\s+', ' ', 'g'),
                'EXECUTE FUNCTION public.', 'EXECUTE FUNCTION ') = v_trg.def,
          false)
    ) then
      raise exception '0454 abortada: ya existe un trigger con el nombre de esta migración y otra forma; revisar antes de aplicar';
    end if;
  end loop;

  -- Huella del catálogo dependiente, que el postflight exige intacta.
  select pg_catalog.md5(pg_catalog.string_agg(x, '|' order by x)) into v_huella
  from (
    select 'T:' || t.tgrelid::text || ':' || t.tgname || ':' || t.tgfoid::text || ':' || t.tgtype::text
           || ':' || t.tgenabled::text
      from pg_catalog.pg_trigger t
     where t.tgrelid in ('public.clients'::pg_catalog.regclass, 'public.client_users'::pg_catalog.regclass,
                         'public.portal_access_links'::pg_catalog.regclass)
       and not t.tgisinternal
       and t.tgname not in ('clients_revoke_portal_on_soft_delete', 'client_users_require_live_client',
                            'portal_access_links_require_live_client')
    union all
    select 'P:' || pol.polrelid::text || ':' || pol.polname || ':' || pol.polcmd::text || ':'
           || pol.polpermissive::text || ':' || pol.polroles::text || ':'
           || coalesce(pg_catalog.pg_get_expr(pol.polqual, pol.polrelid), '') || ':'
           || coalesce(pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid), '')
      from pg_catalog.pg_policy pol
     where pol.polrelid in ('public.clients'::pg_catalog.regclass, 'public.client_users'::pg_catalog.regclass,
                            'public.portal_access_links'::pg_catalog.regclass)
    union all
    select 'A:' || c.oid::text || ':' || coalesce(c.relacl::text, '') || ':' || c.relrowsecurity::text
           || ':' || c.relforcerowsecurity::text
      from pg_catalog.pg_class c
     where c.oid in ('public.clients'::pg_catalog.regclass, 'public.client_users'::pg_catalog.regclass,
                     'public.portal_access_links'::pg_catalog.regclass)
    union all
    select 'F:' || p.oid::text || ':' || pg_catalog.md5(p.prosrc) || ':' || coalesce(p.proacl::text, '')
           || ':' || coalesce(p.proconfig::text, '') || ':' || p.prosecdef::text
      from pg_catalog.pg_proc p
     where p.pronamespace = 'public'::pg_catalog.regnamespace
       and p.proname in ('merge_clients', 'portal_bind_session', 'portal_invite_client', 'portal_revoke_client',
                         'portal_create_access_link', 'portal_revoke_access_link')
  ) s(x);
  perform pg_catalog.set_config('dtd.huella_0454', coalesce(v_huella, ''), false);
end;
$preflight$;

-- ─── Revocación en el mismo acto del borrado lógico ───────────────────────
create or replace function public.clients_revoke_portal_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason_prev text := pg_catalog.current_setting('dtd.audit_reason', true);
begin
  -- Motivo para el evento D5 de client_users, sólo si el caller no trae uno.
  if coalesce(pg_catalog.btrim(v_reason_prev), '') = '' then
    perform pg_catalog.set_config('dtd.audit_reason',
      'Cliente borrado: acceso al Portal revocado (SDD-0467).', true);
  end if;

  -- Todas las filas del cliente, sin filtrar por estado: una reinvitación
  -- concurrente queda esperando esta fila y, al re-evaluar, también se revoca.
  update public.client_users as cu
     set status = 'revoked',
         revoked_at = coalesce(cu.revoked_at, pg_catalog.now()),
         auth_user_id = null,
         token = null
   where cu.client_id = new.id;

  update public.portal_access_links as l
     set revoked_at = coalesce(l.revoked_at, pg_catalog.now())
   where l.client_id = new.id;

  perform pg_catalog.set_config('dtd.audit_reason', coalesce(v_reason_prev, ''), true);
  return null;
end;
$$;

comment on function public.clients_revoke_portal_access is
  'SDD-0467/0454: al pasar clients.deleted_at de NULL a un valor, revoca en la misma transacción todo client_users del cliente (status revoked, revoked_at, auth_user_id y token en NULL) y todo portal_access_links sin revocar. Si falla, falla el borrado.';

revoke all on function public.clients_revoke_portal_access() from public, anon, authenticated, service_role;

-- ─── Guarda: ningún acceso vigente sobre un cliente inexistente o borrado ──
create or replace function public.portal_access_require_live_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alive boolean;
begin
  if tg_op = 'INSERT' or new.client_id is distinct from old.client_id then
    -- Fila nueva o mudada: la revocación concurrente no la ve. FOR SHARE espera
    -- a un borrado en curso y, al confirmarse, deja de encontrar al cliente.
    perform 1 from public.clients as c
     where c.id = new.client_id and c.deleted_at is null
       for share of c;
    v_alive := found;
  else
    v_alive := exists (
      select 1 from public.clients as c
       where c.id = new.client_id and c.deleted_at is null
    );
  end if;

  if not v_alive then
    raise exception 'acceso al Portal sobre un cliente inexistente o borrado'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function public.portal_access_require_live_client is
  'SDD-0467/0454: guarda BEFORE de client_users (fila invited o active) y portal_access_links (fila sin revocar): el cliente tiene que existir y vivir; si no, 23514. Restaurar un cliente no devuelve el acceso.';

revoke all on function public.portal_access_require_live_client() from public, anon, authenticated, service_role;

do $triggers$
begin
  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.clients'::pg_catalog.regclass
      and tgname = 'clients_revoke_portal_on_soft_delete' and not tgisinternal
  ) then
    create trigger clients_revoke_portal_on_soft_delete
      after update on public.clients
      for each row
      when (old.deleted_at is null and new.deleted_at is not null)
      execute function public.clients_revoke_portal_access();
  end if;

  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.client_users'::pg_catalog.regclass
      and tgname = 'client_users_require_live_client' and not tgisinternal
  ) then
    create trigger client_users_require_live_client
      before insert or update of status, client_id on public.client_users
      for each row
      when (new.status in ('invited', 'active'))
      execute function public.portal_access_require_live_client();
  end if;

  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.portal_access_links'::pg_catalog.regclass
      and tgname = 'portal_access_links_require_live_client' and not tgisinternal
  ) then
    create trigger portal_access_links_require_live_client
      before insert or update of revoked_at, client_id on public.portal_access_links
      for each row
      when (new.revoked_at is null)
      execute function public.portal_access_require_live_client();
  end if;
end;
$triggers$;

-- ─── Backfill idempotente: clientes que ya estaban borrados ───────────────
do $backfill$
declare
  v_reason_prev text := pg_catalog.current_setting('dtd.audit_reason', true);
  v_active bigint;
  v_invited bigint;
  v_incomplete bigint;
  v_links bigint;
begin
  perform pg_catalog.set_config('dtd.audit_reason',
    'Migración 0454: cliente ya borrado, acceso al Portal revocado (SDD-0467).', true);

  with objetivo as (
    select cu.id, cu.status as status_previo
      from public.client_users as cu
      join public.clients as c on c.id = cu.client_id
     where c.deleted_at is not null
       and (cu.status <> 'revoked' or cu.revoked_at is null
            or cu.auth_user_id is not null or cu.token is not null)
       for update of cu
  ), revocados as (
    update public.client_users as cu
       set status = 'revoked',
           revoked_at = coalesce(cu.revoked_at, pg_catalog.now()),
           auth_user_id = null,
           token = null
      from objetivo as o
     where cu.id = o.id
    returning o.status_previo
  )
  select pg_catalog.count(*) filter (where status_previo = 'active'),
         pg_catalog.count(*) filter (where status_previo = 'invited'),
         pg_catalog.count(*) filter (where status_previo = 'revoked')
    into v_active, v_invited, v_incomplete
    from revocados;

  update public.portal_access_links as l
     set revoked_at = pg_catalog.now()
    from public.clients as c
   where c.id = l.client_id
     and c.deleted_at is not null
     and l.revoked_at is null;
  get diagnostics v_links = row_count;

  perform pg_catalog.set_config('dtd.audit_reason', coalesce(v_reason_prev, ''), true);

  raise notice '0454 backfill: vínculos revocados de clientes ya borrados: % activos, % invitados, % revocados incompletos; códigos cortos revocados: %',
    v_active, v_invited, v_incomplete, v_links;
end;
$backfill$;

do $postflight$
declare
  v_fn record;
  v_exp record;
  v_huella text;
  v_users bigint;
  v_links bigint;
begin
  for v_fn in select * from (values
    ('public.clients_revoke_portal_access()'),
    ('public.portal_access_require_live_client()')
  ) as f(signature) loop
    if not exists (
      select 1 from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure(v_fn.signature)
        and p.prosecdef and p.provolatile = 'v'
        and p.prorettype = 'trigger'::pg_catalog.regtype
        and p.proconfig = array['search_path=""']::text[]
    ) then
      raise exception '0454: % no quedó con la forma final (SECURITY DEFINER, volátil, trigger y search_path vacío)', v_fn.signature;
    end if;
    if pg_catalog.has_function_privilege('anon', pg_catalog.to_regprocedure(v_fn.signature), 'EXECUTE')
       or pg_catalog.has_function_privilege('authenticated', pg_catalog.to_regprocedure(v_fn.signature), 'EXECUTE')
       or pg_catalog.has_function_privilege('service_role', pg_catalog.to_regprocedure(v_fn.signature), 'EXECUTE') then
      raise exception '0454: % quedó ejecutable por un rol de la API', v_fn.signature;
    end if;
  end loop;

  -- El dueño de las dos funciones (con el que corren la revocación y las guardas)
  -- evita la RLS de las tres tablas: superusuario, BYPASSRLS o dueño sin FORCE.
  if exists (
       select 1 from pg_catalog.pg_class as c
       where c.oid in ('public.clients'::pg_catalog.regclass, 'public.client_users'::pg_catalog.regclass,
                       'public.portal_access_links'::pg_catalog.regclass)
         and c.relforcerowsecurity
     )
     or exists (
       select 1
         from pg_catalog.pg_proc as p
         join pg_catalog.pg_roles as r on r.oid = p.proowner
         cross join pg_catalog.pg_class as c
        where p.oid in (pg_catalog.to_regprocedure('public.clients_revoke_portal_access()'),
                        pg_catalog.to_regprocedure('public.portal_access_require_live_client()'))
          and c.oid in ('public.clients'::pg_catalog.regclass, 'public.client_users'::pg_catalog.regclass,
                        'public.portal_access_links'::pg_catalog.regclass)
          and not (r.rolsuper or r.rolbypassrls)
          and not pg_catalog.pg_has_role(p.proowner, c.relowner, 'USAGE')
     ) then
    raise exception '0454: el dueño de las funciones no evita la RLS de clients, client_users o portal_access_links; la revocación actualizaría 0 filas sin error';
  end if;

  -- Los tres triggers: habilitados, con su función y con la definición completa
  -- (pg_get_triggerdef normalizado en espacios y sin el esquema de la función).
  for v_exp in select * from (values
    ('public.clients', 'clients_revoke_portal_on_soft_delete', 'public.clients_revoke_portal_access()',
     'CREATE TRIGGER clients_revoke_portal_on_soft_delete AFTER UPDATE ON public.clients FOR EACH ROW WHEN (((old.deleted_at IS NULL) AND (new.deleted_at IS NOT NULL))) EXECUTE FUNCTION clients_revoke_portal_access()'),
    ('public.client_users', 'client_users_require_live_client', 'public.portal_access_require_live_client()',
     'CREATE TRIGGER client_users_require_live_client BEFORE INSERT OR UPDATE OF status, client_id ON public.client_users FOR EACH ROW WHEN ((new.status = ANY (ARRAY[''invited''::text, ''active''::text]))) EXECUTE FUNCTION portal_access_require_live_client()'),
    ('public.portal_access_links', 'portal_access_links_require_live_client', 'public.portal_access_require_live_client()',
     'CREATE TRIGGER portal_access_links_require_live_client BEFORE INSERT OR UPDATE OF revoked_at, client_id ON public.portal_access_links FOR EACH ROW WHEN ((new.revoked_at IS NULL)) EXECUTE FUNCTION portal_access_require_live_client()')
  ) as x(relation, tgname, fn, def) loop
    if not exists (
      select 1 from pg_catalog.pg_trigger as t
      where t.tgrelid = pg_catalog.to_regclass(v_exp.relation)
        and t.tgname = v_exp.tgname and not t.tgisinternal
        and t.tgenabled = 'O'
        and t.tgfoid = pg_catalog.to_regprocedure(v_exp.fn)
        and pg_catalog.replace(pg_catalog.regexp_replace(pg_catalog.pg_get_triggerdef(t.oid), '\s+', ' ', 'g'),
              'EXECUTE FUNCTION public.', 'EXECUTE FUNCTION ') = v_exp.def
    ) then
      raise exception '0454: los tres triggers no quedaron vivos con su forma';
    end if;
  end loop;

  select pg_catalog.md5(pg_catalog.string_agg(x, '|' order by x)) into v_huella
  from (
    select 'T:' || t.tgrelid::text || ':' || t.tgname || ':' || t.tgfoid::text || ':' || t.tgtype::text
           || ':' || t.tgenabled::text
      from pg_catalog.pg_trigger t
     where t.tgrelid in ('public.clients'::pg_catalog.regclass, 'public.client_users'::pg_catalog.regclass,
                         'public.portal_access_links'::pg_catalog.regclass)
       and not t.tgisinternal
       and t.tgname not in ('clients_revoke_portal_on_soft_delete', 'client_users_require_live_client',
                            'portal_access_links_require_live_client')
    union all
    select 'P:' || pol.polrelid::text || ':' || pol.polname || ':' || pol.polcmd::text || ':'
           || pol.polpermissive::text || ':' || pol.polroles::text || ':'
           || coalesce(pg_catalog.pg_get_expr(pol.polqual, pol.polrelid), '') || ':'
           || coalesce(pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid), '')
      from pg_catalog.pg_policy pol
     where pol.polrelid in ('public.clients'::pg_catalog.regclass, 'public.client_users'::pg_catalog.regclass,
                            'public.portal_access_links'::pg_catalog.regclass)
    union all
    select 'A:' || c.oid::text || ':' || coalesce(c.relacl::text, '') || ':' || c.relrowsecurity::text
           || ':' || c.relforcerowsecurity::text
      from pg_catalog.pg_class c
     where c.oid in ('public.clients'::pg_catalog.regclass, 'public.client_users'::pg_catalog.regclass,
                     'public.portal_access_links'::pg_catalog.regclass)
    union all
    select 'F:' || p.oid::text || ':' || pg_catalog.md5(p.prosrc) || ':' || coalesce(p.proacl::text, '')
           || ':' || coalesce(p.proconfig::text, '') || ':' || p.prosecdef::text
      from pg_catalog.pg_proc p
     where p.pronamespace = 'public'::pg_catalog.regnamespace
       and p.proname in ('merge_clients', 'portal_bind_session', 'portal_invite_client', 'portal_revoke_client',
                         'portal_create_access_link', 'portal_revoke_access_link')
  ) s(x);
  if coalesce(v_huella, '') is distinct from pg_catalog.current_setting('dtd.huella_0454', true) then
    raise exception '0454: cambió el catálogo dependiente (triggers ajenos, policies o ACL de las tres tablas, o las RPC del Portal y de fusión); esta migración sólo agrega sus funciones y triggers';
  end if;

  -- El invariante, en conteos agregados: nada vigente sobre un cliente borrado.
  select pg_catalog.count(*) into v_users
    from public.client_users as cu
    join public.clients as c on c.id = cu.client_id
   where c.deleted_at is not null
     and (cu.status <> 'revoked' or cu.revoked_at is null or cu.auth_user_id is not null or cu.token is not null);
  select pg_catalog.count(*) into v_links
    from public.portal_access_links as l
    join public.clients as c on c.id = l.client_id
   where c.deleted_at is not null
     and l.revoked_at is null;
  if v_users > 0 or v_links > 0 then
    raise exception '0454: quedaron % vínculo(s) y % código(s) corto(s) utilizables de clientes borrados', v_users, v_links;
  end if;

  perform pg_catalog.set_config('dtd.huella_0454', '', false);
end;
$postflight$;

reset statement_timeout;
reset lock_timeout;
