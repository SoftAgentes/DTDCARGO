-- 0513 · SDD-0587 (E6 del programa SDD-0582, paso 6.4) · Entrada de leads desde Chatwoot y la web.
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla exige el
--    OK nominal de Sam para este archivo y el runbook aplicar-migraciones-prod.
--    Requiere la 0503, la 0504 y la 0506 aplicadas antes. Va ANTES de suscribir
--    el webhook de Chatwoot a los eventos nuevos.
--
-- 1. `chatwoot_webhook_events.event` admite también `conversation_created` y
--    `conversation_updated` (SDD-0587 §4.2.2). Va aquí y no editando la 0504: la
--    RPC de alta hace falta de todos modos, la 0504 es de E2 (otra PR de la pila)
--    y así da igual si la 0504 ya se aplicó.
-- 2. `crm_entrada_chatwoot`: crea la tarjeta si no existe (llave única de §4.1 y
--    `on conflict do nothing`) en «Nuevo» o «Registrado / recontacto» según el
--    segmento. Si existe, la completa sin pisar lo que ya tiene. Con un mensaje
--    entrante, quien estaba en «Perdido» vuelve a «Registrado / recontacto» con
--    tarea (§4.3, §6.2).
-- 3. `crm_asesor_desde_chatwoot`: da asesor a la tarjeta que no lo tiene (§5.4).
-- 4. `crm_alta_tarjeta_web`: alta desde `/registro`. Crea la tarjeta o liga la del
--    lead que ya escribió, y guarda fuente y atribución, que no se pisan.
--
-- Todo se puede correr dos veces sin efecto doble. Solo service_role.
-- Datos personales: nombre visible y últimos 10 dígitos solo del lead sin ficha
-- (D6). Sin texto de mensajes, correo ni teléfono completo.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.crm_tarjetas') is null
     or pg_catalog.to_regclass('public.crm_tareas') is null
     or pg_catalog.to_regclass('public.chatwoot_agent_links') is null
     or pg_catalog.to_regclass('public.chatwoot_webhook_events') is null
     or pg_catalog.to_regprocedure('public.crm_segmento_cliente(uuid,uuid)') is null
     or pg_catalog.to_regprocedure('public.crm_mover_etapa_auto(uuid,uuid,text,text,text,timestamptz)') is null then
    raise exception '0513 requiere la 0503 (chatwoot_agent_links), la 0504 (chatwoot_webhook_events) y la 0506 (crm_tarjetas)';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.clients'::regclass and attname = 'advisor_id' and not attisdropped
  ) then
    raise exception '0513 requiere clients.advisor_id (0151)';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.chatwoot_webhook_events'::regclass and conname = 'chatwoot_webhook_events_event_check'
  ) then
    raise exception '0513 requiere el check chatwoot_webhook_events_event_check (0504)';
  end if;
  if pg_catalog.to_regprocedure('public.crm_ficha_por_telefono(uuid,text)') is not null then
    raise exception '0513: la entrada de leads ya existe; no se reaplica';
  end if;
end;
$preflight$;

-- ─── 1. Eventos del webhook ──────────────────────────────────────────────────
alter table public.chatwoot_webhook_events drop constraint chatwoot_webhook_events_event_check;
alter table public.chatwoot_webhook_events add constraint chatwoot_webhook_events_event_check
  check (event in ('message_created', 'conversation_status_changed', 'conversation_created', 'conversation_updated'));

-- ─── 2. Piezas internas ──────────────────────────────────────────────────────
-- Exactamente una ficha viva con ese teléfono, o ninguna: no se adivina (§5.3).
create function public.crm_ficha_por_telefono(p_tenant_id uuid, p_phone_last10 text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $fn$
  select case when pg_catalog.count(*) = 1 then (pg_catalog.array_agg(c.id))[1] end
  from public.clients c
  where c.tenant_id = p_tenant_id
    and c.phone_last10 = p_phone_last10
    and c.deleted_at is null;
$fn$;

comment on function public.crm_ficha_por_telefono(uuid, text) is
  'SDD-0587 (6.4): la única ficha viva con esos últimos 10 dígitos; con cero o más de una, null. Solo service_role.';

-- Un usuario activo del tenant, o null: el trigger de crm_tarjetas rechaza a los demás.
create function public.crm_asesor_activo(p_tenant_id uuid, p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $fn$
  select ut.user_id
  from public.user_tenants ut
  where ut.user_id = p_user_id
    and ut.tenant_id = p_tenant_id
    and ut.disabled_at is null
  limit 1;
$fn$;

comment on function public.crm_asesor_activo(uuid, uuid) is
  'SDD-0587 (6.4): el usuario si está activo en el tenant; si no, null. Solo service_role.';

-- El usuario vinculado a un agente de Chatwoot, solo si sigue activo (§5.4).
create function public.crm_usuario_de_agente(p_tenant_id uuid, p_chatwoot_user_id bigint)
returns uuid
language sql
stable
security definer
set search_path = ''
as $fn$
  select public.crm_asesor_activo(p_tenant_id, l.user_id)
  from public.chatwoot_agent_links l
  where l.tenant_id = p_tenant_id
    and l.chatwoot_user_id = p_chatwoot_user_id;
$fn$;

comment on function public.crm_usuario_de_agente(uuid, bigint) is
  'SDD-0587 (6.4): traduce un agente de Chatwoot a su usuario de Studio por chatwoot_agent_links, si sigue activo. Solo service_role.';

-- La tarjeta de una persona, por la llave de §4.1: ficha, contacto, BSUID. Al
-- final, la cargada a mano solo con el teléfono (sin ficha ni contacto).
create function public.crm_buscar_tarjeta(
  p_tenant_id uuid, p_client_id uuid, p_contact_id bigint, p_bsuid text, p_phone_last10 text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $fn$
  select t.id
  from public.crm_tarjetas t
  where t.tenant_id = p_tenant_id
    and (t.client_id = p_client_id
         or t.chatwoot_contact_id = p_contact_id
         or t.bsuid = p_bsuid
         or (t.phone_last10 = p_phone_last10 and t.client_id is null and t.chatwoot_contact_id is null))
  order by case
             when t.client_id = p_client_id then 0
             when t.chatwoot_contact_id = p_contact_id then 1
             when t.bsuid = p_bsuid then 2
             else 3
           end,
           t.created_at, t.id
  limit 1;
$fn$;

comment on function public.crm_buscar_tarjeta(uuid, uuid, bigint, text, text) is
  'SDD-0587 (6.4): ubica la tarjeta de una persona por la llave de §4.1. Solo service_role.';

-- Quien estaba en «Perdido» y vuelve: a «Registrado / recontacto», sin el motivo
-- y con una tarea. Idempotente por clave; un movimiento manual posterior gana.
create function public.crm_volver_a_recontacto(
  p_tenant_id uuid, p_tarjeta_id uuid, p_clave text, p_ocurrio_at timestamptz)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if public.crm_mover_etapa_auto(
       p_tenant_id, p_tarjeta_id, 'leads', 'registrado_recontacto', p_clave, p_ocurrio_at) <> 'movida' then
    return false;
  end if;
  update public.crm_tarjetas t set motivo_perdida = null where t.id = p_tarjeta_id;
  insert into public.crm_tareas (tenant_id, tarjeta_id, texto, asignado_a, origen, clave_evento)
  select p_tenant_id, p_tarjeta_id, 'Volvió a escribir: recontactar', t.asesor_id, 'automatico', p_clave
  from public.crm_tarjetas t
  where t.id = p_tarjeta_id
  on conflict (tenant_id, clave_evento) where clave_evento is not null do nothing;
  return true;
end;
$fn$;

comment on function public.crm_volver_a_recontacto(uuid, uuid, text, timestamptz) is
  'SDD-0587 (6.4, §4.3): saca a una tarjeta de «Perdido» cuando la persona vuelve, con tarea y sin motivo. Idempotente por clave. Solo service_role.';

-- ─── 3. Entrada desde Chatwoot ───────────────────────────────────────────────
-- p_clave_mensaje solo viene con un mensaje entrante: es lo que dice que volvió.
create function public.crm_entrada_chatwoot(
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

comment on function public.crm_entrada_chatwoot(uuid, bigint, text, text, text, text, bigint, text, timestamptz) is
  'SDD-0587 (6.4, §5.1, §5.2): crea o completa la tarjeta de quien entra por Chatwoot. Idempotente: llave única de §4.1 y on conflict do nothing. Fuente y atribución fijas; la etapa solo se mueve si estaba en «Perdido» y escribió. Solo service_role.';

-- Si la tarjeta no tiene asesor, toma el agente vinculado. No crea tarjetas. Si
-- la persona tiene ficha con asesor activo, manda ese (§5.4).
create function public.crm_asesor_desde_chatwoot(
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

comment on function public.crm_asesor_desde_chatwoot(uuid, bigint, text, text, bigint) is
  'SDD-0587 (6.4, §5.4): conversation_updated con asignado. Da asesor solo a la tarjeta que no lo tiene y no crea tarjetas. Idempotente. Solo service_role.';

-- ─── 4. Alta desde /registro ─────────────────────────────────────────────────
-- Tarjeta nueva en «Nuevo» (§4.3), aunque la ficha ya sea lead registrado. La del
-- lead que ya escribió se liga si su teléfono cruza con esta única ficha, y
-- conserva etapa, fuente y atribución (§3, §4.5); solo sale de «Perdido».
create function public.crm_alta_tarjeta_web(
  p_tenant_id    uuid,
  p_client_id    uuid,
  p_origen       text,
  p_utm_source   text default null,
  p_utm_medium   text default null,
  p_utm_campaign text default null,
  p_utm_content  text default null,
  p_utm_term     text default null
)
returns table (tarjeta_id uuid, resultado text)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_telefono text;
  v_asesor   uuid;
  v_tarjeta  uuid;
  v_etapa    text;
begin
  select c.phone_last10, public.crm_asesor_activo(p_tenant_id, c.advisor_id)
    into v_telefono, v_asesor
  from public.clients c
  where c.id = p_client_id
    and c.tenant_id = p_tenant_id
    and c.deleted_at is null;
  if not found then
    raise exception 'crm_alta_tarjeta_web: ficha inexistente' using errcode = '22023';
  end if;

  select t.id into v_tarjeta
  from public.crm_tarjetas t
  where t.tenant_id = p_tenant_id and t.client_id = p_client_id;
  if v_tarjeta is not null then
    return query select v_tarjeta, 'existente'::text;
    return;
  end if;

  if public.crm_ficha_por_telefono(p_tenant_id, v_telefono) = p_client_id then
    select t.id, t.etapa_leads into v_tarjeta, v_etapa
    from public.crm_tarjetas t
    where t.tenant_id = p_tenant_id
      and t.client_id is null
      and t.phone_last10 = v_telefono
    order by t.created_at, t.id
    limit 1
    for update;
    if v_tarjeta is not null then
      update public.crm_tarjetas t
      set client_id = p_client_id,
          nombre_visible = null,
          phone_last10 = null,
          asesor_id = coalesce(t.asesor_id, v_asesor),
          ultima_actividad_at = pg_catalog.now()
      where t.id = v_tarjeta;
      if v_etapa = 'perdido' then
        perform public.crm_volver_a_recontacto(p_tenant_id, v_tarjeta, 'web_registro:' || p_client_id::text, pg_catalog.now());
      end if;
      return query select v_tarjeta, 'ligada'::text;
      return;
    end if;
  end if;

  insert into public.crm_tarjetas as t (
    tenant_id, client_id, etapa_leads, asesor_id, fuente, fuente_detalle,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term
  ) values (
    p_tenant_id, p_client_id, 'nuevo', v_asesor, 'web_registro',
    nullif(pg_catalog.btrim(pg_catalog.left(pg_catalog.btrim(coalesce(p_origen, '')), 120)), ''),
    nullif(pg_catalog.btrim(pg_catalog.left(pg_catalog.btrim(coalesce(p_utm_source, '')), 120)), ''),
    nullif(pg_catalog.btrim(pg_catalog.left(pg_catalog.btrim(coalesce(p_utm_medium, '')), 120)), ''),
    nullif(pg_catalog.btrim(pg_catalog.left(pg_catalog.btrim(coalesce(p_utm_campaign, '')), 120)), ''),
    nullif(pg_catalog.btrim(pg_catalog.left(pg_catalog.btrim(coalesce(p_utm_content, '')), 120)), ''),
    nullif(pg_catalog.btrim(pg_catalog.left(pg_catalog.btrim(coalesce(p_utm_term, '')), 120)), '')
  )
  on conflict do nothing
  returning t.id into v_tarjeta;
  if v_tarjeta is not null then
    return query select v_tarjeta, 'creada'::text;
    return;
  end if;

  -- Otra llamada la creó entre la búsqueda y la inserción.
  select t.id into v_tarjeta
  from public.crm_tarjetas t
  where t.tenant_id = p_tenant_id and t.client_id = p_client_id;
  return query select v_tarjeta, 'existente'::text;
end;
$fn$;

comment on function public.crm_alta_tarjeta_web(uuid, uuid, text, text, text, text, text, text) is
  'SDD-0587 (6.4, §5.1): alta desde /registro. Crea la tarjeta con fuente web_registro, el origen y los UTM, o liga la del lead que ya escribió sin pisar su fuente. Idempotente. Solo service_role.';

-- ─── 5. Permisos: nada de esto es para la API del navegador ──────────────────
revoke all on function public.crm_ficha_por_telefono(uuid, text) from public;
revoke all on function public.crm_ficha_por_telefono(uuid, text) from anon, authenticated;
revoke all on function public.crm_asesor_activo(uuid, uuid) from public;
revoke all on function public.crm_asesor_activo(uuid, uuid) from anon, authenticated;
revoke all on function public.crm_usuario_de_agente(uuid, bigint) from public;
revoke all on function public.crm_usuario_de_agente(uuid, bigint) from anon, authenticated;
revoke all on function public.crm_buscar_tarjeta(uuid, uuid, bigint, text, text) from public;
revoke all on function public.crm_buscar_tarjeta(uuid, uuid, bigint, text, text) from anon, authenticated;
revoke all on function public.crm_volver_a_recontacto(uuid, uuid, text, timestamptz) from public;
revoke all on function public.crm_volver_a_recontacto(uuid, uuid, text, timestamptz) from anon, authenticated;
revoke all on function public.crm_entrada_chatwoot(uuid, bigint, text, text, text, text, bigint, text, timestamptz) from public;
revoke all on function public.crm_entrada_chatwoot(uuid, bigint, text, text, text, text, bigint, text, timestamptz) from anon, authenticated;
grant execute on function public.crm_entrada_chatwoot(uuid, bigint, text, text, text, text, bigint, text, timestamptz) to service_role;
revoke all on function public.crm_asesor_desde_chatwoot(uuid, bigint, text, text, bigint) from public;
revoke all on function public.crm_asesor_desde_chatwoot(uuid, bigint, text, text, bigint) from anon, authenticated;
grant execute on function public.crm_asesor_desde_chatwoot(uuid, bigint, text, text, bigint) to service_role;
revoke all on function public.crm_alta_tarjeta_web(uuid, uuid, text, text, text, text, text, text) from public;
revoke all on function public.crm_alta_tarjeta_web(uuid, uuid, text, text, text, text, text, text) from anon, authenticated;
grant execute on function public.crm_alta_tarjeta_web(uuid, uuid, text, text, text, text, text, text) to service_role;
