-- SDD-0676 · Desarme de la 0566 («Vincular a cliente»).
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada la
--    aplique ni la empaquete. Usarla exige OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción.
-- Ensayo: lib/studio/__tests__/chatwoot-vincular-canal.migration.test.ts.
--
-- DEVUELVE a su cuerpo anterior chatwoot_registrar_evento (0504, 13 parámetros), crm_entrada_chatwoot y
-- crm_asesor_desde_chatwoot (0513), chatwoot_quitar_union y el disparador de ficha borrada (0554), y
-- chatwoot_portal_vincular (0519). Los cuerpos de abajo son copia literal de esas migraciones.
-- BORRA las uniones de origen «portal»: antes de la 0566 no existían, el origen no cabe en el CHECK de
-- la 0554 y el dato sigue completo en chatwoot_portal_contactos. Ese borrado NO se audita fila por
-- fila: no es la decisión de una persona sobre un cliente, sino volver al esquema anterior, y nada se
-- pierde (la evidencia del desarme es la del runbook con que se aplique). Las conversaciones del portal
-- conservan su cliente (la 0504 no se lo quita a un evento sin teléfono).
-- QUITA además chatwoot_conversations.chat_contact_id y devuelve el CHECK del origen a sus tres valores.
-- SUELTA las tarjetas absorbidas (vuelven a su tablero) y QUITA chatwoot_vincular_contacto,
-- chatwoot_ficha_de_contacto, absorber y soltar, las columnas crm_tarjetas.absorbida_en / absorbida_at y
-- chatwoot_contact_links.canal_chat.
-- NO toca las demás uniones (chatwoot_contact_links) ni la auditoría. El teléfono que se le quitó a una tarjeta
-- al absorberla no vuelve: lo repone el siguiente mensaje de esa persona.
-- CANAL GUARDADO: el desarme borra chatwoot_contact_links.canal_chat y ese dato NO se puede
-- reconstruir (sale del tipo de bandeja en el momento de vincular). Si hay uniones con canal,
-- el desarme SE NIEGA. Para aceptar la pérdida, en la MISMA transacción y antes de este archivo:
--     set local dtd.desarme_0566_perder_canal = 'si';
-- Las uniones siguen; solo dejan de mostrar el logo de su canal.
-- ORDEN: primero publicar el web anterior (o uno que tolere su falta: el de esta PR la tolera) y después
-- el desarme. El web de esta PR, sin estas piezas, vuelve solo al cruce por teléfono.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $guarda$
declare
  v_con_canal bigint := 0;
begin
  -- Repetible: la segunda vez la columna ya no está y no hay nada que cuidar.
  if exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.chatwoot_contact_links'::regclass and attname = 'canal_chat' and not attisdropped
  ) then
    -- Las del portal no cuentan: su canal no es un dato que se pierda (sale del origen) y
    -- el desarme las borra de todos modos.
    execute 'select count(*) from public.chatwoot_contact_links where canal_chat is not null and origen <> ''portal''' into v_con_canal;
  end if;
  if v_con_canal > 0
     and coalesce(pg_catalog.current_setting('dtd.desarme_0566_perder_canal', true), '') <> 'si' then
    raise exception 'desarme 0566: hay % unión(es) con canal guardado y el desarme lo borra. Para aceptarlo: set local dtd.desarme_0566_perder_canal = ''si''', v_con_canal;
  end if;
end;
$guarda$;

do $soltar$
begin
  -- Repetible: la segunda vez la columna ya no está.
  if exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.crm_tarjetas'::regclass and attname = 'absorbida_en' and not attisdropped
  ) then
    execute 'update public.crm_tarjetas set absorbida_en = null, absorbida_at = null where absorbida_en is not null';
  end if;
end;
$soltar$;

drop function if exists public.chatwoot_vincular_contacto(uuid, uuid, uuid, bigint, text, text, boolean);

-- ─── chatwoot_quitar_union y el disparador, como en la 0554 ───────────────
create or replace function public.chatwoot_quitar_union(
  p_tenant_id uuid, p_actor_user_id uuid, p_client_id uuid, p_contact_id bigint, p_motivo text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_motivo text := pg_catalog.btrim(coalesce(p_motivo, ''));
  v_fila   public.chatwoot_contact_links;
begin
  if not public.chatwoot_contact_links_actor_puede(p_tenant_id, p_actor_user_id) then
    raise exception 'No tienes permiso para realizar esta acción.' using errcode = '42501';
  end if;
  if pg_catalog.char_length(v_motivo) not between 4 and 1000 then
    raise exception 'chatwoot_quitar_union: el motivo va de 4 a 1000 caracteres' using errcode = '22023';
  end if;

  delete from public.chatwoot_contact_links l
  where l.tenant_id = p_tenant_id and l.client_id = p_client_id and l.chatwoot_contact_id = p_contact_id
  returning l.* into v_fila;
  if not found then
    return false;
  end if;

  perform public.append_audit_event(
    p_tenant_id, 'chatwoot_contact_link', p_client_id, 'user', p_actor_user_id,
    'chatwoot_contact_unlinked', 'studio', 'succeeded', v_motivo,
    pg_catalog.jsonb_build_object('chatwoot_contact_id', v_fila.chatwoot_contact_id, 'origen', v_fila.origen),
    null,
    '{}'::jsonb,
    pg_catalog.concat('chatwoot-contact-unlink:', p_client_id::text, ':', p_contact_id::text, ':', pg_catalog.txid_current()::text),
    1,
    'internal'
  );
  return true;
end;
$fn$;

revoke all on function public.chatwoot_quitar_union(uuid, uuid, uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.chatwoot_quitar_union(uuid, uuid, uuid, bigint, text) to service_role;

create or replace function public.chatwoot_contact_links_al_borrar_ficha()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid       uuid := (select auth.uid());
  v_contactos bigint[];
begin
  if new.deleted_at is not null and old.deleted_at is null then
    with borradas as (
      delete from public.chatwoot_contact_links l where l.client_id = new.id
      returning l.chatwoot_contact_id
    )
    select pg_catalog.array_agg(b.chatwoot_contact_id order by b.chatwoot_contact_id) into v_contactos from borradas b;

    -- Una fila de auditoría por ficha borrada, solo con los ids de los contactos.
    -- Restaurar la ficha no restaura las uniones.
    if v_contactos is not null then
      perform public.append_audit_event(
        new.tenant_id, 'chatwoot_contact_link', new.id,
        case when v_uid is null then 'system' else 'user' end, v_uid,
        'chatwoot_contact_unlinked', 'rpc', 'succeeded', 'Ficha borrada: sus chats dejan de estar unidos',
        pg_catalog.jsonb_build_object('chatwoot_contact_ids', pg_catalog.to_jsonb(v_contactos), 'motivo', 'ficha_borrada'),
        null,
        '{}'::jsonb,
        pg_catalog.concat('chatwoot-contact-unlink:', new.id::text, ':ficha-borrada:', pg_catalog.txid_current()::text),
        1,
        'internal'
      );
    end if;
  end if;
  return null;
end;
$fn$;

revoke all on function public.chatwoot_contact_links_al_borrar_ficha() from public, anon, authenticated;

-- ─── crm_entrada_chatwoot y crm_asesor_desde_chatwoot, como en la 0513 ────
create or replace function public.crm_entrada_chatwoot(
  p_tenant_id          uuid,
  p_contact_id         bigint,
  p_bsuid              text,
  p_phone_last10       text,
  p_nombre_visible     text,
  p_fuente             text,
  p_agente_chatwoot_id bigint,
  p_clave_mensaje      text,
  p_ocurrio_at         timestamptz
)
returns table (tarjeta_id uuid, creada boolean, volvio boolean)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_ocurrio  timestamptz := coalesce(p_ocurrio_at, pg_catalog.now());
  v_telefono text := case when p_phone_last10 ~ '^[0-9]{10}$' then p_phone_last10 end;
  v_nombre   text := nullif(pg_catalog.btrim(pg_catalog.left(pg_catalog.btrim(coalesce(p_nombre_visible, '')), 120)), '');
  v_agente   uuid := public.crm_usuario_de_agente(p_tenant_id, p_agente_chatwoot_id);
  v_ficha    uuid;
  v_segmento text;
  v_tarjeta  uuid;
  v_actual   uuid;
  v_etapa    text;
  v_volvio   boolean := false;
begin
  if p_tenant_id is null or (p_contact_id is null and p_bsuid is null) then
    raise exception 'crm_entrada_chatwoot: tenant y contacto o BSUID son obligatorios' using errcode = '22023';
  end if;
  if p_fuente is null or p_fuente not in ('whatsapp_leads', 'whatsapp_clientes', 'instagram', 'messenger', 'correo') then
    raise exception 'crm_entrada_chatwoot: fuente que no viene de Chatwoot' using errcode = '22023';
  end if;

  v_ficha := public.crm_ficha_por_telefono(p_tenant_id, v_telefono);
  v_tarjeta := public.crm_buscar_tarjeta(p_tenant_id, v_ficha, p_contact_id, p_bsuid, v_telefono);

  if v_tarjeta is null then
    v_segmento := public.crm_segmento_cliente(p_tenant_id, v_ficha);
    insert into public.crm_tarjetas as t (
      tenant_id, client_id, chatwoot_contact_id, bsuid, nombre_visible, phone_last10,
      etapa_leads, asesor_id, fuente, ultima_actividad_at
    )
    select p_tenant_id, v_ficha, p_contact_id, p_bsuid,
           case when v_ficha is null then v_nombre end,
           case when v_ficha is null then v_telefono end,
           case when v_segmento = 'lead_nuevo' then 'nuevo' else 'registrado_recontacto' end,
           coalesce(
             (select public.crm_asesor_activo(p_tenant_id, c.advisor_id) from public.clients c where c.id = v_ficha),
             v_agente),
           p_fuente, v_ocurrio
    on conflict do nothing
    returning t.id into v_tarjeta;
    if v_tarjeta is not null then
      return query select v_tarjeta, true, false;
      return;
    end if;
    -- Otra entrega la creó entre la búsqueda y la inserción.
    v_tarjeta := public.crm_buscar_tarjeta(p_tenant_id, v_ficha, p_contact_id, p_bsuid, v_telefono);
    if v_tarjeta is null then
      raise exception 'crm_entrada_chatwoot: conflicto sin tarjeta' using errcode = '40001';
    end if;
  end if;

  select t.client_id, t.etapa_leads into v_actual, v_etapa
  from public.crm_tarjetas t
  where t.id = v_tarjeta
  for update;

  -- Una ficha borrada o fusionada ya no sirve: manda la que cruce hoy.
  if v_actual is not null and exists (
    select 1 from public.clients c where c.id = v_actual and c.deleted_at is null
  ) then
    v_ficha := v_actual;
  end if;

  -- Se completa lo que falta. Con ficha, nombre y teléfono viven en clients (D6).
  update public.crm_tarjetas t
  set client_id = v_ficha,
      nombre_visible = case when v_ficha is null then coalesce(t.nombre_visible, v_nombre) end,
      phone_last10 = case when v_ficha is null then coalesce(t.phone_last10, v_telefono) end,
      chatwoot_contact_id = coalesce(t.chatwoot_contact_id, case when not exists (
        select 1 from public.crm_tarjetas x
        where x.tenant_id = p_tenant_id and x.chatwoot_contact_id = p_contact_id and x.id <> v_tarjeta
      ) then p_contact_id end),
      bsuid = coalesce(t.bsuid, case when not exists (
        select 1 from public.crm_tarjetas x
        where x.tenant_id = p_tenant_id and x.bsuid = p_bsuid and x.id <> v_tarjeta
      ) then p_bsuid end),
      asesor_id = coalesce(
        t.asesor_id,
        (select public.crm_asesor_activo(p_tenant_id, c.advisor_id) from public.clients c where c.id = v_ficha),
        v_agente),
      ultima_actividad_at = greatest(t.ultima_actividad_at, v_ocurrio)
  where t.id = v_tarjeta;

  if p_clave_mensaje is not null
     and v_etapa = 'perdido'
     and public.crm_segmento_cliente(p_tenant_id, v_ficha) <> 'cliente' then
    v_volvio := public.crm_volver_a_recontacto(p_tenant_id, v_tarjeta, 'chatwoot_volvio:' || p_clave_mensaje, v_ocurrio);
  end if;

  return query select v_tarjeta, false, v_volvio;
end;
$fn$;

revoke all on function public.crm_entrada_chatwoot(uuid, bigint, text, text, text, text, bigint, text, timestamptz) from public, anon, authenticated;
grant execute on function public.crm_entrada_chatwoot(uuid, bigint, text, text, text, text, bigint, text, timestamptz) to service_role;

create or replace function public.crm_asesor_desde_chatwoot(
  p_tenant_id uuid, p_contact_id bigint, p_bsuid text, p_phone_last10 text, p_agente_chatwoot_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_telefono text := case when p_phone_last10 ~ '^[0-9]{10}$' then p_phone_last10 end;
  v_agente   uuid := public.crm_usuario_de_agente(p_tenant_id, p_agente_chatwoot_id);
  v_tarjeta  uuid;
  v_filas    integer;
begin
  if v_agente is null then
    return false;
  end if;
  v_tarjeta := public.crm_buscar_tarjeta(
    p_tenant_id, public.crm_ficha_por_telefono(p_tenant_id, v_telefono), p_contact_id, p_bsuid, v_telefono);
  if v_tarjeta is null then
    return false;
  end if;
  update public.crm_tarjetas t
  set asesor_id = coalesce(
        (select public.crm_asesor_activo(p_tenant_id, c.advisor_id) from public.clients c where c.id = t.client_id),
        v_agente)
  where t.id = v_tarjeta
    and t.asesor_id is null;
  get diagnostics v_filas = row_count;
  return v_filas = 1;
end;
$fn$;

revoke all on function public.crm_asesor_desde_chatwoot(uuid, bigint, text, text, bigint) from public, anon, authenticated;
grant execute on function public.crm_asesor_desde_chatwoot(uuid, bigint, text, text, bigint) to service_role;

-- ─── chatwoot_registrar_evento, como en la 0504 (13 parámetros) ───────────
drop function if exists public.chatwoot_registrar_evento(uuid, text, text, bigint, bigint, text, integer, bigint, text, timestamptz, double precision, bigint, boolean, bigint);

create or replace function public.chatwoot_registrar_evento(
  p_tenant_id         uuid,
  p_event_key         text,
  p_event             text,
  p_conversation_id   bigint,
  p_inbox_id          bigint,
  p_status            text,
  p_unread_count      integer,
  p_assignee_id       bigint,
  p_phone_last10      text,
  p_last_activity_at  timestamptz,
  p_source_updated_at double precision,
  p_message_id        bigint default null,
  p_avisar            boolean default false
)
returns table (nuevo boolean, aplicado boolean, client_id uuid)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_filas   integer;
  v_cliente uuid;
  v_cruces  integer := 0;
begin
  if p_tenant_id is null or p_conversation_id is null or p_conversation_id <= 0 then
    raise exception 'chatwoot_registrar_evento: tenant y conversación son obligatorios';
  end if;

  -- Idempotencia: el mismo evento dos veces no hace nada la segunda, salvo que
  -- la primera haya fallado (o se haya colgado): entonces se reclama.
  if p_event_key is not null then
    insert into public.chatwoot_webhook_events (tenant_id, event_key, event, conversation_id, message_id, avisar, assignee_id)
    values (p_tenant_id, p_event_key, p_event, p_conversation_id, p_message_id, coalesce(p_avisar, false), p_assignee_id)
    on conflict on constraint chatwoot_webhook_events_pkey do nothing;
    get diagnostics v_filas = row_count;
    if v_filas = 0 then
      update public.chatwoot_webhook_events e
      set status = 'procesando', attempts = e.attempts + 1, updated_at = pg_catalog.now(), next_attempt_at = null
      where e.tenant_id = p_tenant_id
        and e.event_key = p_event_key
        and e.attempts < 5
        and (e.status = 'fallido'
             or (e.status = 'procesando' and e.updated_at < pg_catalog.now() - interval '5 minutes'));
      get diagnostics v_filas = row_count;
      if v_filas = 0 then
        return query select false, false, null::uuid;
        return;
      end if;
    end if;
  end if;

  -- Cruce con el cliente: exactamente uno o nada (phone_last10 no es único).
  if p_phone_last10 ~ '^[0-9]{10}$' then
    select (pg_catalog.array_agg(c.id))[1], pg_catalog.count(*)
      into v_cliente, v_cruces
    from public.clients c
    where c.tenant_id = p_tenant_id
      and c.phone_last10 = p_phone_last10
      and c.deleted_at is null;
    if v_cruces <> 1 then
      v_cliente := null;
    end if;
  end if;

  insert into public.chatwoot_conversations as cc (
    tenant_id, conversation_id, inbox_id, status, unread_count, assignee_id,
    client_id, last_activity_at, source_updated_at, updated_at
  ) values (
    p_tenant_id, p_conversation_id, p_inbox_id, p_status, greatest(coalesce(p_unread_count, 0), 0),
    p_assignee_id, v_cliente, p_last_activity_at, coalesce(p_source_updated_at, 0), pg_catalog.now()
  )
  on conflict (tenant_id, conversation_id) do update set
    inbox_id          = excluded.inbox_id,
    status            = excluded.status,
    unread_count      = excluded.unread_count,
    assignee_id       = excluded.assignee_id,
    -- Sin teléfono en el evento se conserva el cruce anterior; con teléfono se
    -- recalcula (y un cruce que se volvió ambiguo vuelve a null).
    client_id         = case when p_phone_last10 ~ '^[0-9]{10}$' then excluded.client_id else cc.client_id end,
    last_activity_at  = excluded.last_activity_at,
    source_updated_at = excluded.source_updated_at,
    updated_at        = pg_catalog.now()
  where cc.source_updated_at <= excluded.source_updated_at;
  get diagnostics v_filas = row_count;

  return query select true, v_filas = 1, v_cliente;
end;
$fn$;

revoke all on function public.chatwoot_registrar_evento(uuid, text, text, bigint, bigint, text, integer, bigint, text, timestamptz, double precision, bigint, boolean) from public, anon, authenticated;
grant execute on function public.chatwoot_registrar_evento(uuid, text, text, bigint, bigint, text, integer, bigint, text, timestamptz, double precision, bigint, boolean) to service_role;

-- ─── chatwoot_portal_vincular, como en la 0519 ────────────────────────────
create or replace function public.chatwoot_portal_vincular(
  p_tenant_id          uuid,
  p_hilo_id            uuid,
  p_contacto_id        bigint,
  p_contacto_source_id text,
  p_inbox_id           bigint default null,
  p_conversacion_id    bigint default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_client uuid;
  v_actual bigint;
begin
  select c.client_id into v_client
  from public.conversations c
  where c.id = p_hilo_id and c.tenant_id = p_tenant_id and c.channel = 'portal';
  if v_client is null then
    raise exception 'chatwoot_portal_vincular: hilo del portal no encontrado' using errcode = 'P0002';
  end if;
  if p_contacto_id is null or p_contacto_id <= 0 or p_contacto_id > 2147483647 then
    raise exception 'chatwoot_portal_vincular: id de contacto inválido' using errcode = '22023';
  end if;

  select k.chatwoot_contact_id into v_actual
  from public.chatwoot_portal_contactos k
  where k.tenant_id = p_tenant_id and k.client_id = v_client
  for update;
  if not found then
    -- Sin identificador guardado no hay contacto legítimo: lo crea chatwoot_portal_tomar.
    raise exception 'chatwoot_portal_vincular: la ficha no tiene identificador' using errcode = 'P0002';
  end if;
  if v_actual is not null and v_actual <> p_contacto_id then
    raise exception 'chatwoot_portal_vincular: la ficha ya tiene otro contacto' using errcode = '23505';
  end if;
  update public.chatwoot_portal_contactos k
  set chatwoot_contact_id = p_contacto_id, chatwoot_source_id = p_contacto_source_id, updated_at = pg_catalog.now()
  where k.tenant_id = p_tenant_id and k.client_id = v_client;

  if p_conversacion_id is null then
    return;
  end if;
  if p_conversacion_id <= 0 or p_conversacion_id > 2147483647 or p_inbox_id is null or p_inbox_id <= 0 then
    raise exception 'chatwoot_portal_vincular: conversación o bandeja inválida' using errcode = '22023';
  end if;

  insert into public.chatwoot_portal_hilos (conversation_id, tenant_id, chatwoot_conversation_id)
  values (p_hilo_id, p_tenant_id, p_conversacion_id)
  on conflict do nothing;
  select hl.chatwoot_conversation_id into v_actual
  from public.chatwoot_portal_hilos hl
  where hl.conversation_id = p_hilo_id;
  if v_actual is distinct from p_conversacion_id then
    raise exception 'chatwoot_portal_vincular: el hilo o la conversación ya tienen otro vínculo' using errcode = '23505';
  end if;

  insert into public.chatwoot_conversations as cc (tenant_id, conversation_id, inbox_id, status, client_id)
  values (p_tenant_id, p_conversacion_id, p_inbox_id, 'open', v_client)
  on conflict (tenant_id, conversation_id) do update
    set client_id = excluded.client_id,
        inbox_id  = coalesce(cc.inbox_id, excluded.inbox_id);
end;
$function$;

comment on function public.chatwoot_portal_vincular(uuid, uuid, bigint, text, bigint, bigint) is
  'SDD-0586 E10-D35: guarda el contacto de Chatwoot de la ficha del hilo y, si viene, la conversación del hilo, y deja el client_id en chatwoot_conversations para la Ficha DTD. Rechaza un segundo contacto o una segunda conversación.';

revoke all on function public.chatwoot_portal_vincular(uuid, uuid, bigint, text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.chatwoot_portal_vincular(uuid, uuid, bigint, text, bigint, bigint) to service_role;

-- ─── Las uniones del portal y el CHECK del origen, como en la 0554 ────────
delete from public.chatwoot_contact_links where origen = 'portal';

do $origen$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_catalog.pg_constraint c
    where c.conrelid = 'public.chatwoot_contact_links'::regclass
      and c.contype = 'c'
      and pg_catalog.pg_get_constraintdef(c.oid) like '%kommo%'
  loop
    execute pg_catalog.format('alter table public.chatwoot_contact_links drop constraint %I', r.conname);
  end loop;
  alter table public.chatwoot_contact_links add constraint chatwoot_contact_links_origen_check
    check (origen in ('webhook', 'kommo', 'manual'));
end;
$origen$;

drop index if exists public.chatwoot_conversations_chat_contact_idx;
alter table public.chatwoot_conversations drop column if exists chat_contact_id;

-- ─── Los comentarios de antes (copia literal de la 0554, la 0513 y la 0504) ──
comment on function public.chatwoot_quitar_union(uuid, uuid, uuid, bigint, text) is
  'SDD-0650 F2 (D4): deshace una unión chat ↔ ficha de cualquier origen. Solo service_role, con la misma comprobación del actor que unir; motivo; auditada con el actor real.';

comment on function public.crm_entrada_chatwoot(uuid, bigint, text, text, text, text, bigint, text, timestamptz) is
  'SDD-0587 (6.4, §5.1, §5.2): crea o completa la tarjeta de quien entra por Chatwoot. Idempotente: llave única de §4.1 y on conflict do nothing. Fuente y atribución fijas; la etapa solo se mueve si estaba en «Perdido» y escribió. Solo service_role.';

comment on function public.crm_asesor_desde_chatwoot(uuid, bigint, text, text, bigint) is
  'SDD-0587 (6.4, §5.4): conversation_updated con asignado. Da asesor solo a la tarjeta que no lo tiene y no crea tarjetas. Idempotente. Solo service_role.';

comment on function public.chatwoot_registrar_evento(uuid, text, text, bigint, bigint, text, integer, bigint, text, timestamptz, double precision, bigint, boolean) is
  'SDD-0585 E2-D18/E2-D19/E2-D22: registra un evento de Chatwoot (idempotente por event_key) y aplica el estado de la conversación si no es más viejo que lo guardado. event_key nulo = reconciliación por API. Solo service_role.';

-- ─── Las piezas nuevas ────────────────────────────────────────────────────
drop function if exists public.crm_absorber_tarjeta_de_contacto(uuid, uuid, bigint);
drop function if exists public.crm_soltar_tarjeta_de_contacto(uuid, bigint);
drop function if exists public.chatwoot_ficha_de_contacto(uuid, bigint);

alter table public.crm_tarjetas drop constraint if exists crm_tarjetas_absorbida_check;
drop index if exists public.crm_tarjetas_absorbida_idx;
alter table public.crm_tarjetas drop column if exists absorbida_en;
alter table public.crm_tarjetas drop column if exists absorbida_at;
alter table public.chatwoot_contact_links drop column if exists canal_chat;

do $post$
begin
  if pg_catalog.to_regprocedure('public.chatwoot_vincular_contacto(uuid,uuid,uuid,bigint,text,text,boolean)') is not null
     or pg_catalog.to_regprocedure('public.chatwoot_ficha_de_contacto(uuid,bigint)') is not null
     or pg_catalog.to_regprocedure('public.chatwoot_registrar_evento(uuid,text,text,bigint,bigint,text,integer,bigint,text,timestamptz,double precision,bigint,boolean,bigint)') is not null
     or pg_catalog.to_regprocedure('public.chatwoot_registrar_evento(uuid,text,text,bigint,bigint,text,integer,bigint,text,timestamptz,double precision,bigint,boolean)') is null then
    raise exception 'desarme 0566: quedó una función nueva o falta la firma anterior de chatwoot_registrar_evento';
  end if;
  if exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.crm_tarjetas'::regclass and attname in ('absorbida_en', 'absorbida_at') and not attisdropped
  ) or exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.chatwoot_contact_links'::regclass and attname = 'canal_chat' and not attisdropped
  ) or exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.chatwoot_conversations'::regclass and attname = 'chat_contact_id' and not attisdropped
  ) then
    raise exception 'desarme 0566: quedó una columna';
  end if;
end;
$post$;
