-- ─────────────────────────────────────────────────────────────
-- 0455 · SDD-0469 — Borrar un cliente deja un evento de auditoría atómico.
--
-- EL HUECO (en main y en producción hasta aplicar esta migración)
--   · `softDeleteClientAction` pone `clients.deleted_at` con un UPDATE por RLS y
--     no deja ningún evento: AUD-01 §2 exige auditar «eliminar». El único trigger
--     de auditoría sobre `clients` (`audit_d5_clients_contact`, 0293) sólo mira
--     email y phone. La revocación del Portal de 0454 sí deja eventos, pero sobre
--     `client_users`, no sobre el cliente.
--   · El UPDATE no dice si alcanzó alguna fila: un cliente ya borrado, de otro
--     tenant o inexistente devolvía `ok`.
--
-- LA REGLA
--   · Trigger AFTER UPDATE en `clients` cuando `deleted_at` pasa de NULL a un
--     valor (la misma transición que dispara la revocación de 0454): en la MISMA
--     transacción escribe, con `append_audit_event`, un evento sobre la entidad
--     `client` con tenant, actor (`auth.uid()`; `system` sin principal, como D5),
--     antes y después de `deleted_at` y `merged_into_client_id`, hora del
--     servidor, motivo y la clasificación MP-01 en el payload. Si el evento no se
--     puede escribir, falla el UPDATE: ni borrado ni revocación del Portal.
--     Cubre cualquier camino: la RPC nueva, el UPDATE directo del código ya
--     desplegado y `merge_clients`.
--   · Fusión: si el mismo UPDATE fija `merged_into_client_id`, el evento es
--     `client_merged` con su motivo propio, no `client_deleted`. `merge_clients`
--     (0361) retira la ficha con un solo UPDATE que pone ambas columnas; el
--     preflight lo exige sobre el cuerpo vivo, sin redefinirla.
--   · RPC `soft_delete_client_with_audit_reason(p_client_id, p_reason)`, SECURITY
--     INVOKER como las RPC `*_with_audit_reason` de 0294: la RLS «clients by
--     tenant» sigue siendo la frontera de tenant y no se amplía ningún permiso.
--     Valida el motivo opcional (4 a 1000 caracteres), lo fija en
--     `dtd.audit_reason` sólo para su transacción (vacío sin motivo, para que el
--     evento lleve el motivo por defecto y no uno heredado), borra por id sólo si
--     el cliente vive y devuelve si alcanzó la fila. Restaura el motivo previo.
--   · Sin backfill: los borrados históricos no tienen actor ni motivo
--     reconstruibles y un evento inventado sería historia falsa (0267).
--
-- MOTIVO
--   Opcional. MP-01 clasifica a los clientes como maestros P1/R2 y R2 no exige
--   motivo; AUD-01 §3 lo exige para R3, rechazo, anulación, override y cambios
--   de acceso, y el cambio de acceso de este borrado ya lleva el suyo (0454).
--   El CHECK de 0267 exige motivo en un evento `_deleted`: sin motivo humano el
--   evento lleva «Cliente eliminado sin motivo indicado (SDD-0469).», que no se
--   confunde con uno escrito por el operador. Con motivo humano, 0454 lo reusa
--   también para el evento de revocación del Portal.
--
-- PREFLIGHT QUE FALLA CERRADO (mensajes sin ids ni Shipping Marks)
--   · roles de la API; `clients` con RLS y sus columnas;
--   · `append_audit_event` (0294) SECURITY DEFINER con search_path vacío y
--     ejecutable por el rol que aplica, que queda como dueño del trigger;
--   · el tipo de entidad `client` activo;
--   · el trigger de revocación de 0454 vivo con su forma: la confirmación del
--     Studio promete esa consecuencia;
--   · `merge_clients` SECURITY DEFINER que retira con un solo UPDATE de
--     `merged_into_client_id` y `deleted_at`;
--   · objetos con los nombres de esta migración: ausentes o con su forma final;
--   · huella del catálogo dependiente, que el postflight exige intacta.
--
-- LOCKS: CREATE TRIGGER toma SHARE ROW EXCLUSIVE sobre `clients` (bloquea
-- escrituras, no lecturas, hasta el COMMIT). `lock_timeout` y
-- `statement_timeout` de sesión como en 0454; se restauran al final. Reaplicar
-- no crea ni cambia nada.
--
-- NO aplicar a Producción desde esta rama. Requiere el OK nominal de Sam y el
-- runbook docs/runbooks/aplicar-migraciones-prod.md: de a una y con el name
-- exacto `0455_borrado_cliente_auditado`.
-- ─────────────────────────────────────────────────────────────
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_column text;
  v_writer oid;
  v_body text;
  v_huella text;
begin
  if pg_catalog.to_regrole('authenticated') is null
     or pg_catalog.to_regrole('anon') is null
     or pg_catalog.to_regrole('service_role') is null then
    raise exception '0455 requiere los roles authenticated, anon y service_role';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_class
    where oid = pg_catalog.to_regclass('public.clients') and relkind in ('r', 'p') and relrowsecurity
  ) then
    raise exception '0455 requiere tabla con RLS: public.clients';
  end if;

  foreach v_column in array array['id', 'tenant_id', 'deleted_at', 'merged_into_client_id'] loop
    if not exists (
      select 1 from pg_catalog.pg_attribute
      where attrelid = 'public.clients'::pg_catalog.regclass
        and attname = v_column and attnum > 0 and not attisdropped
    ) then
      raise exception '0455 requiere la columna public.clients.%', v_column;
    end if;
  end loop;

  -- El writer de auditoría: SECURITY DEFINER, search_path vacío y ejecutable por
  -- el rol que aplica, que queda como dueño del trigger. Va antes de leer
  -- audit_entity_types, que un rol sin privilegios no puede leer.
  v_writer := pg_catalog.to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)');
  if v_writer is null or not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = v_writer and p.prosecdef and p.proconfig @> array['search_path=""']::text[]
  ) then
    raise exception '0455 requiere append_audit_event SECURITY DEFINER con search_path vacío (0267/0294)';
  end if;
  if not pg_catalog.has_function_privilege(current_user, v_writer, 'EXECUTE') then
    raise exception '0455 abortada: el rol que aplica no puede ejecutar append_audit_event; el trigger quedaría con un dueño que no escribe el evento';
  end if;

  if pg_catalog.to_regclass('public.audit_entity_types') is null
     or not exists (
       select 1 from public.audit_entity_types where entity_type = 'client' and status = 'active'
     ) then
    raise exception '0455 abortada: el tipo de entidad client no está activo; cada borrado fallaría';
  end if;

  -- 0454: la confirmación del Studio promete que el cliente pierde su acceso al Portal.
  if not exists (
    select 1 from pg_catalog.pg_trigger as t
    where t.tgrelid = 'public.clients'::pg_catalog.regclass
      and t.tgname = 'clients_revoke_portal_on_soft_delete' and not t.tgisinternal
      and t.tgenabled = 'O'
      and pg_catalog.replace(pg_catalog.regexp_replace(pg_catalog.pg_get_triggerdef(t.oid), '\s+', ' ', 'g'),
            'EXECUTE FUNCTION public.', 'EXECUTE FUNCTION ')
          = 'CREATE TRIGGER clients_revoke_portal_on_soft_delete AFTER UPDATE ON public.clients FOR EACH ROW WHEN (((old.deleted_at IS NULL) AND (new.deleted_at IS NOT NULL))) EXECUTE FUNCTION clients_revoke_portal_access()'
  ) then
    raise exception '0455 requiere el trigger clients_revoke_portal_on_soft_delete de 0454 vivo y con su forma';
  end if;

  -- merge_clients retira la ficha con un solo UPDATE que fija merged_into_client_id
  -- y deleted_at: así el trigger distingue la fusión del borrado.
  if pg_catalog.to_regprocedure('public.merge_clients(uuid,uuid)') is null
     or not exists (
       select 1 from pg_catalog.pg_proc p
       where p.oid = pg_catalog.to_regprocedure('public.merge_clients(uuid,uuid)') and p.prosecdef
     ) then
    raise exception '0455 requiere merge_clients(uuid,uuid) SECURITY DEFINER';
  end if;
  select pg_catalog.regexp_replace(prosrc, '\s', '', 'g') into v_body
    from pg_catalog.pg_proc where oid = pg_catalog.to_regprocedure('public.merge_clients(uuid,uuid)');
  if pg_catalog.strpos(v_body, 'updatepublic.clientssetmerged_into_client_id=s.id,deleted_at=now()whereid=m.id;') = 0
     or pg_catalog.strpos(v_body, 'updatepublic.clientssetdeleted_at') > 0 then
    raise exception '0455 abortada: merge_clients no retira la ficha con un solo UPDATE de merged_into_client_id y deleted_at; la fusión quedaría auditada como borrado';
  end if;

  -- Objetos de esta migración: ausentes o con su forma final (reaplicación).
  if exists (
    select 1 from pg_catalog.pg_proc p
    where p.pronamespace = 'public'::pg_catalog.regnamespace
      and p.proname = 'soft_delete_client_with_audit_reason'
      and not coalesce(
        p.oid = pg_catalog.to_regprocedure('public.soft_delete_client_with_audit_reason(uuid,text)')
        and not p.prosecdef
        and p.prorettype = 'boolean'::pg_catalog.regtype
        and p.proconfig = array['search_path=""']::text[],
        false)
  ) or exists (
    select 1 from pg_catalog.pg_proc p
    where p.pronamespace = 'public'::pg_catalog.regnamespace
      and p.proname = 'clients_audit_soft_delete'
      and not coalesce(
        p.oid = pg_catalog.to_regprocedure('public.clients_audit_soft_delete()')
        and p.prosecdef
        and p.prorettype = 'trigger'::pg_catalog.regtype
        and p.proconfig = array['search_path=""']::text[],
        false)
  ) then
    raise exception '0455 abortada: ya existe una función con el nombre de esta migración y otra forma o firma; revisar antes de aplicar';
  end if;

  -- coalesce: antes de la primera aplicación to_regprocedure() de la función nueva
  -- es NULL, y un NULL dentro del not (...) dejaría pasar un trigger ajeno.
  if exists (
    select 1 from pg_catalog.pg_trigger as t
    where t.tgrelid = 'public.clients'::pg_catalog.regclass
      and t.tgname = 'clients_audit_soft_delete' and not t.tgisinternal
      and not coalesce(
        t.tgenabled = 'O'
        and t.tgfoid = pg_catalog.to_regprocedure('public.clients_audit_soft_delete()')
        and pg_catalog.replace(pg_catalog.regexp_replace(pg_catalog.pg_get_triggerdef(t.oid), '\s+', ' ', 'g'),
              'EXECUTE FUNCTION public.', 'EXECUTE FUNCTION ')
            = 'CREATE TRIGGER clients_audit_soft_delete AFTER UPDATE ON public.clients FOR EACH ROW WHEN (((old.deleted_at IS NULL) AND (new.deleted_at IS NOT NULL))) EXECUTE FUNCTION clients_audit_soft_delete()',
        false)
  ) then
    raise exception '0455 abortada: ya existe un trigger con el nombre de esta migración y otra forma; revisar antes de aplicar';
  end if;

  -- Huella del catálogo dependiente, que el postflight exige intacta.
  select pg_catalog.md5(pg_catalog.string_agg(x, '|' order by x)) into v_huella
  from (
    select 'T:' || t.tgrelid::text || ':' || t.tgname || ':' || t.tgfoid::text || ':' || t.tgtype::text
           || ':' || t.tgenabled::text
      from pg_catalog.pg_trigger t
     where t.tgrelid in ('public.clients'::pg_catalog.regclass, 'public.entity_audit_log'::pg_catalog.regclass)
       and not t.tgisinternal
       and t.tgname <> 'clients_audit_soft_delete'
    union all
    select 'P:' || pol.polrelid::text || ':' || pol.polname || ':' || pol.polcmd::text || ':'
           || pol.polpermissive::text || ':' || pol.polroles::text || ':'
           || coalesce(pg_catalog.pg_get_expr(pol.polqual, pol.polrelid), '') || ':'
           || coalesce(pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid), '')
      from pg_catalog.pg_policy pol
     where pol.polrelid in ('public.clients'::pg_catalog.regclass, 'public.entity_audit_log'::pg_catalog.regclass)
    union all
    select 'A:' || c.oid::text || ':' || coalesce(c.relacl::text, '') || ':' || c.relrowsecurity::text
           || ':' || c.relforcerowsecurity::text
      from pg_catalog.pg_class c
     where c.oid in ('public.clients'::pg_catalog.regclass, 'public.entity_audit_log'::pg_catalog.regclass)
    union all
    select 'F:' || p.oid::text || ':' || pg_catalog.md5(p.prosrc) || ':' || coalesce(p.proacl::text, '')
           || ':' || coalesce(p.proconfig::text, '') || ':' || p.prosecdef::text
      from pg_catalog.pg_proc p
     where p.pronamespace = 'public'::pg_catalog.regnamespace
       and p.proname in ('append_audit_event', 'append_audit_event_v1', 'merge_clients',
                         'clients_revoke_portal_access', 'audit_d5_residual_change')
    union all
    select 'E:' || e.entity_type || ':' || e.status
      from public.audit_entity_types e
     where e.entity_type = 'client'
  ) s(x);
  perform pg_catalog.set_config('dtd.huella_0455', coalesce(v_huella, ''), false);
end;
$preflight$;

-- ─── Evento de auditoría en el mismo acto del borrado lógico ──────────────
create or replace function public.clients_audit_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  -- La fusión fija merged_into_client_id en el mismo UPDATE que retira la ficha.
  v_merge boolean := new.merged_into_client_id is not null
    and new.merged_into_client_id is distinct from old.merged_into_client_id;
begin
  -- append_audit_event (0294) prioriza dtd.audit_reason, el motivo humano que fija
  -- la RPC; sin él queda el motivo por defecto de cada evento.
  perform public.append_audit_event(
    new.tenant_id,
    'client',
    new.id,
    case when v_actor is null then 'system' else 'user' end,
    v_actor,
    case when v_merge then 'client_merged' else 'client_deleted' end,
    'rpc',
    'succeeded',
    case when v_merge
      then 'Ficha retirada por fusión con otro cliente (merge_clients).'
      else 'Cliente eliminado sin motivo indicado (SDD-0469).'
    end,
    pg_catalog.jsonb_build_object('deleted_at', old.deleted_at,
                                  'merged_into_client_id', old.merged_into_client_id),
    pg_catalog.jsonb_build_object('deleted_at', new.deleted_at,
                                  'merged_into_client_id', new.merged_into_client_id),
    pg_catalog.jsonb_build_object(
      'permanence', 'P2',
      'consequence', case when v_merge
        then 'retired_by_merge'
        else 'removed_from_lists_portal_access_revoked'
      end,
      'recovery', 'no_studio_restore',
      'related_files', '[]'::jsonb),
    pg_catalog.concat('d5:clients:', new.id::text, ':', pg_catalog.txid_current()::text),
    1,
    'restricted'
  );
  return null;
end;
$$;

comment on function public.clients_audit_soft_delete is
  'SDD-0469/0455: al pasar clients.deleted_at de NULL a un valor escribe en la misma transacción client_deleted (o client_merged si el mismo UPDATE fija merged_into_client_id) con tenant, actor, antes/después y motivo. Si el evento falla, falla el borrado.';

revoke all on function public.clients_audit_soft_delete() from public, anon, authenticated, service_role;

-- ─── RPC del Studio: motivo opcional y detección de cero filas ────────────
create or replace function public.soft_delete_client_with_audit_reason(
  p_client_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_reason_prev text := pg_catalog.current_setting('dtd.audit_reason', true);
  v_found boolean;
begin
  if p_client_id is null then
    raise exception 'soft_delete_client: p_client_id es obligatorio'
      using errcode = '22023';
  end if;
  if v_reason is not null
     and pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'audit: reason debe tener entre 4 y 1000 caracteres'
      using errcode = '22023';
  end if;

  -- Motivo sólo para esta transacción. Sin motivo se vacía: el evento lleva el
  -- motivo por defecto y no uno heredado del caller.
  perform pg_catalog.set_config('dtd.audit_reason', coalesce(v_reason, ''), true);

  -- Por RLS (SECURITY INVOKER): otro tenant, inexistente o ya borrado → 0 filas.
  update public.clients
     set deleted_at = pg_catalog.now()
   where id = p_client_id
     and deleted_at is null;
  v_found := found;

  perform pg_catalog.set_config('dtd.audit_reason', coalesce(v_reason_prev, ''), true);
  return v_found;
end;
$$;

comment on function public.soft_delete_client_with_audit_reason is
  'SDD-0469/0455: borrado lógico de un cliente por id, por RLS, con motivo humano opcional (4 a 1000 caracteres) para su evento de auditoría. Devuelve false si no alcanzó ninguna fila (ya borrado, de otro tenant o inexistente).';

revoke all on function public.soft_delete_client_with_audit_reason(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.soft_delete_client_with_audit_reason(uuid, text) to authenticated;

do $triggers$
begin
  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.clients'::pg_catalog.regclass
      and tgname = 'clients_audit_soft_delete' and not tgisinternal
  ) then
    create trigger clients_audit_soft_delete
      after update on public.clients
      for each row
      when (old.deleted_at is null and new.deleted_at is not null)
      execute function public.clients_audit_soft_delete();
  end if;
end;
$triggers$;

do $postflight$
declare
  v_trigger_fn oid := pg_catalog.to_regprocedure('public.clients_audit_soft_delete()');
  v_rpc oid := pg_catalog.to_regprocedure('public.soft_delete_client_with_audit_reason(uuid,text)');
  v_huella text;
begin
  if v_trigger_fn is null or not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = v_trigger_fn and p.prosecdef and p.provolatile = 'v'
      and p.prorettype = 'trigger'::pg_catalog.regtype
      and p.proconfig = array['search_path=""']::text[]
  ) then
    raise exception '0455: clients_audit_soft_delete() no quedó con la forma final (SECURITY DEFINER, volátil, trigger y search_path vacío)';
  end if;
  if exists (
    select 1 from pg_catalog.pg_proc p,
      lateral pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
    where p.oid = v_trigger_fn and a.grantee <> p.proowner
  ) then
    raise exception '0455: clients_audit_soft_delete() quedó ejecutable por un rol distinto de su dueño';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = v_trigger_fn
      and pg_catalog.has_function_privilege(p.proowner,
            'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'::pg_catalog.regprocedure,
            'EXECUTE')
  ) then
    raise exception '0455: el dueño de clients_audit_soft_delete() no puede ejecutar append_audit_event';
  end if;

  if v_rpc is null or not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = v_rpc and not p.prosecdef and p.provolatile = 'v'
      and p.prorettype = 'boolean'::pg_catalog.regtype
      and p.proconfig = array['search_path=""']::text[]
  ) or (
    select pg_catalog.count(*) from pg_catalog.pg_proc p
    where p.pronamespace = 'public'::pg_catalog.regnamespace
      and p.proname = 'soft_delete_client_with_audit_reason'
  ) <> 1 then
    raise exception '0455: soft_delete_client_with_audit_reason no quedó con la forma final (SECURITY INVOKER, volátil, boolean, search_path vacío y una sola firma)';
  end if;
  if not pg_catalog.has_function_privilege('authenticated', v_rpc, 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', v_rpc, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', v_rpc, 'EXECUTE')
     or exists (
       select 1 from pg_catalog.pg_proc p,
         lateral pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
       where p.oid = v_rpc
         and (a.grantee not in (p.proowner, 'authenticated'::pg_catalog.regrole) or a.is_grantable)
     ) then
    raise exception '0455: ACL de soft_delete_client_with_audit_reason inválida (sólo authenticated ejecuta)';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_trigger as t
    where t.tgrelid = 'public.clients'::pg_catalog.regclass
      and t.tgname = 'clients_audit_soft_delete' and not t.tgisinternal
      and t.tgenabled = 'O'
      and t.tgfoid = v_trigger_fn
      and pg_catalog.replace(pg_catalog.regexp_replace(pg_catalog.pg_get_triggerdef(t.oid), '\s+', ' ', 'g'),
            'EXECUTE FUNCTION public.', 'EXECUTE FUNCTION ')
          = 'CREATE TRIGGER clients_audit_soft_delete AFTER UPDATE ON public.clients FOR EACH ROW WHEN (((old.deleted_at IS NULL) AND (new.deleted_at IS NOT NULL))) EXECUTE FUNCTION clients_audit_soft_delete()'
  ) then
    raise exception '0455: el trigger clients_audit_soft_delete no quedó vivo con su forma';
  end if;

  select pg_catalog.md5(pg_catalog.string_agg(x, '|' order by x)) into v_huella
  from (
    select 'T:' || t.tgrelid::text || ':' || t.tgname || ':' || t.tgfoid::text || ':' || t.tgtype::text
           || ':' || t.tgenabled::text
      from pg_catalog.pg_trigger t
     where t.tgrelid in ('public.clients'::pg_catalog.regclass, 'public.entity_audit_log'::pg_catalog.regclass)
       and not t.tgisinternal
       and t.tgname <> 'clients_audit_soft_delete'
    union all
    select 'P:' || pol.polrelid::text || ':' || pol.polname || ':' || pol.polcmd::text || ':'
           || pol.polpermissive::text || ':' || pol.polroles::text || ':'
           || coalesce(pg_catalog.pg_get_expr(pol.polqual, pol.polrelid), '') || ':'
           || coalesce(pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid), '')
      from pg_catalog.pg_policy pol
     where pol.polrelid in ('public.clients'::pg_catalog.regclass, 'public.entity_audit_log'::pg_catalog.regclass)
    union all
    select 'A:' || c.oid::text || ':' || coalesce(c.relacl::text, '') || ':' || c.relrowsecurity::text
           || ':' || c.relforcerowsecurity::text
      from pg_catalog.pg_class c
     where c.oid in ('public.clients'::pg_catalog.regclass, 'public.entity_audit_log'::pg_catalog.regclass)
    union all
    select 'F:' || p.oid::text || ':' || pg_catalog.md5(p.prosrc) || ':' || coalesce(p.proacl::text, '')
           || ':' || coalesce(p.proconfig::text, '') || ':' || p.prosecdef::text
      from pg_catalog.pg_proc p
     where p.pronamespace = 'public'::pg_catalog.regnamespace
       and p.proname in ('append_audit_event', 'append_audit_event_v1', 'merge_clients',
                         'clients_revoke_portal_access', 'audit_d5_residual_change')
    union all
    select 'E:' || e.entity_type || ':' || e.status
      from public.audit_entity_types e
     where e.entity_type = 'client'
  ) s(x);
  if coalesce(v_huella, '') is distinct from pg_catalog.current_setting('dtd.huella_0455', true) then
    raise exception '0455: cambió el catálogo dependiente (triggers, policies o ACL de clients o entity_audit_log, el writer de auditoría, merge_clients, la revocación de 0454 o el tipo client); esta migración sólo agrega sus dos funciones y su trigger';
  end if;

  perform pg_catalog.set_config('dtd.huella_0455', '', false);
end;
$postflight$;

reset statement_timeout;
reset lock_timeout;
