-- 0505 · SDD-0586 (E10 del programa SDD-0582, pasos 10.1 a 10.3) · Segmento del contacto y respuestas del bot.
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla exige el
--    OK nominal de Sam para este archivo y el runbook aplicar-migraciones-prod.
--    Requiere la 0504 (E2) aplicada antes: el manejador que la usa corre dentro
--    del procesador de eventos de la 0504.
--
-- 1. `chatwoot_segmento_contacto(tenant, phone_last10)`: la regla de segmentos
--    de Sam (0.8, 2026-10-30), calculada en el momento y sin guardar estado.
--    Devuelve SOLO 'cliente', 'lead_registrado' o 'lead_nuevo': ni ids, ni
--    códigos, ni nombres.
--      · lead_nuevo: el teléfono no es de 10 dígitos, o no cruza con ninguna
--        ficha viva, o cruza con más de una (phone_last10 no es único: ambiguo
--        = desconocido, como chatwoot_registrar_evento de la 0504).
--      · cliente: la ficha tiene algún envío vivo (deleted_at null y estado
--        distinto de draft y cancelled) o algún recibo vivo en China
--        (deleted_at null, no huérfano) con uno de sus códigos.
--      · lead_registrado: tiene ficha y no es cliente. Quien pierde su único
--        envío y no tiene carga en China vuelve aquí solo.
--    Códigos de la ficha: el vigente, su historial (0367) y el código e
--    historial de toda ficha cuya cadena merged_into_client_id llega a ella
--    (0341, hasta 10 saltos), comparados con upper(btrim()) como
--    client_outstanding (0492) y resolve_markbox (0367).
--    Recibo en `incidencia`: CUENTA. Es una caja física recibida a nombre del
--    cliente; el estado describe la consolidación (0008: pendiente,
--    consolidado, incidencia) y la UI lo usa para daños o faltantes, no para
--    anular la recepción (app/studio/(app)/cn/actions.ts:603-608). Lo que anula
--    un recibo es el borrado suave (0476).
--    Recibo huérfano: NO cuenta, aunque tenga código escrito; la app solo
--    trata como del cliente un recibo con `not is_orphan and client_markbox`
--    (app/studio/(app)/cn/actions.ts:264, lib/studio/dispatch-queries.ts:169).
-- 2. `chatwoot_respuestas_bot`: una fila por conversación con la última
--    respuesta automática (redirección del cliente o respuesta neutra). Evita
--    responder dos veces: cada mensaje que sale cuenta contra el cupo de 1.000
--    gratis al mes de Meta. No guarda el texto ni el destinatario.
--    `chatwoot_reservar_respuesta` reserva antes de enviar (una por
--    conversación cada 24 h) y `chatwoot_cerrar_respuesta` la cierra como
--    enviada, incierta o rechazada. Un resultado incierto o una reserva colgada
--    nunca habilitan otro envío antes de las 24 h.
-- 3. `chatwoot_contactos_bsuid`: los usuarios de WhatsApp sin teléfono (con
--    username), por su BSUID (ID por portafolio de Meta), para vincularlos a
--    una ficha después (10.3). Guarda solo el BSUID, la última conversación y
--    dos fechas. Retención: PENDIENTE de decisión de Sam (ver SDD-0586). La
--    lee el admin de su tenant (RLS); escribe solo service_role.
--
-- Las funciones son solo de service_role (el webhook de Chatwoot en Studio).
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.tenants') is null
     or pg_catalog.to_regclass('public.clients') is null
     or pg_catalog.to_regclass('public.client_markbox_history') is null
     or pg_catalog.to_regclass('public.shipments') is null
     or pg_catalog.to_regclass('public.warehouse_receipts_cn') is null
     or pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('public.is_tenant_admin()') is null then
    raise exception '0505 requiere tenants, clients, client_markbox_history, shipments, warehouse_receipts_cn, get_user_tenant_id() e is_tenant_admin()';
  end if;
  if (select pg_catalog.count(*) from pg_catalog.pg_attribute
      where not attisdropped and attnum > 0 and (
        (attrelid = 'public.clients'::regclass and attname in ('tenant_id', 'markbox', 'phone_last10', 'merged_into_client_id', 'deleted_at'))
        or (attrelid = 'public.client_markbox_history'::regclass and attname in ('tenant_id', 'client_id', 'markbox'))
        or (attrelid = 'public.shipments'::regclass and attname in ('tenant_id', 'client_markbox', 'status', 'deleted_at'))
        or (attrelid = 'public.warehouse_receipts_cn'::regclass and attname in ('tenant_id', 'client_markbox', 'is_orphan', 'deleted_at'))
      )) <> 16 then
    raise exception '0505 requiere las columnas de la regla de segmentos (clients, client_markbox_history, shipments, warehouse_receipts_cn)';
  end if;
  if pg_catalog.to_regprocedure('public.chatwoot_segmento_contacto(uuid,text)') is not null
     or pg_catalog.to_regclass('public.chatwoot_respuestas_bot') is not null
     or pg_catalog.to_regclass('public.chatwoot_contactos_bsuid') is not null then
    raise exception '0505: los objetos de segmento de Chatwoot ya existen; no se reaplica';
  end if;
end;
$preflight$;

-- ─── 1. Segmento del contacto ────────────────────────────────────────────────
create function public.chatwoot_segmento_contacto(p_tenant_id uuid, p_phone_last10 text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_cliente uuid;
  v_cruces  integer := 0;
  v_codigos text[];
begin
  if p_tenant_id is null then
    raise exception 'chatwoot_segmento_contacto: el tenant es obligatorio' using errcode = '22023';
  end if;
  if p_phone_last10 is null or p_phone_last10 !~ '^[0-9]{10}$' then
    return 'lead_nuevo';
  end if;

  -- Exactamente una ficha viva con ese teléfono; ninguna o varias = desconocido.
  select (pg_catalog.array_agg(c.id))[1], pg_catalog.count(*)
    into v_cliente, v_cruces
  from public.clients c
  where c.tenant_id = p_tenant_id
    and c.phone_last10 = p_phone_last10
    and c.deleted_at is null;
  if v_cruces <> 1 then
    return 'lead_nuevo';
  end if;

  -- Sus códigos: el vigente, el historial y los de las fichas fusionadas en ella.
  with recursive familia as (
    select v_cliente as miembro, 0 as nivel
    union all
    select m.id, f.nivel + 1
    from familia f
    join public.clients m
      on m.merged_into_client_id = f.miembro and m.tenant_id = p_tenant_id
    where f.nivel < 10
  ), crudos as (
    select m.markbox as codigo
    from familia f join public.clients m on m.id = f.miembro
    union all
    select h.markbox
    from familia f
    join public.client_markbox_history h
      on h.client_id = f.miembro and h.tenant_id = p_tenant_id
  )
  select pg_catalog.array_agg(distinct pg_catalog.upper(pg_catalog.btrim(x.codigo)))
    into v_codigos
  from crudos x
  where pg_catalog.btrim(coalesce(x.codigo, '')) <> '';

  if v_codigos is not null and (
    exists (
      select 1 from public.shipments s
      where s.tenant_id = p_tenant_id
        and s.deleted_at is null
        and s.status::text not in ('draft', 'cancelled')
        and pg_catalog.upper(pg_catalog.btrim(s.client_markbox)) = any (v_codigos)
    )
    or exists (
      select 1 from public.warehouse_receipts_cn r
      where r.tenant_id = p_tenant_id
        and r.deleted_at is null
        and not r.is_orphan
        and pg_catalog.upper(pg_catalog.btrim(r.client_markbox)) = any (v_codigos)
    )
  ) then
    return 'cliente';
  end if;
  return 'lead_registrado';
end;
$fn$;

comment on function public.chatwoot_segmento_contacto(uuid, text) is
  'SDD-0586 (10.1): segmento del contacto de WhatsApp según la regla de Sam (0.8): cliente, lead_registrado o lead_nuevo. Calculado en el momento; no devuelve datos personales. Solo service_role.';

revoke all on function public.chatwoot_segmento_contacto(uuid, text) from public;
revoke all on function public.chatwoot_segmento_contacto(uuid, text) from anon, authenticated;
grant execute on function public.chatwoot_segmento_contacto(uuid, text) to service_role;

-- ─── 2. Respuestas automáticas por conversación ──────────────────────────────
-- Estados: reservada (se va a enviar) → enviada | incierta. Un rechazo
-- definitivo de Chatwoot borra la fila (no salió: se puede volver a intentar).
-- «incierta» (red, 5xx o tiempo agotado: pudo haber salido) y una reserva que
-- quedó más de 10 min sin cerrar (el proceso murió entre reservar y confirmar)
-- NUNCA habilitan otro envío por vencimiento: preferimos no responder dos veces
-- (revisión de Codex). Solo pasadas 24 h se puede responder de nuevo.
create table public.chatwoot_respuestas_bot (
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  conversation_id bigint not null check (conversation_id > 0),
  tipo            text not null check (tipo in ('redireccion_cliente', 'neutra_sin_telefono')),
  estado          text not null default 'reservada' check (estado in ('reservada', 'enviada', 'incierta')),
  reservada_at    timestamptz not null default now(),
  enviada_at      timestamptz,
  primary key (tenant_id, conversation_id),
  check ((estado = 'enviada') = (enviada_at is not null))
);

comment on table public.chatwoot_respuestas_bot is
  'SDD-0586 (10.2/10.3): última respuesta automática del bot por conversación, para no responder dos veces (cada mensaje cuenta contra el cupo de Meta). Sin texto ni destinatario. Solo service_role.';

alter table public.chatwoot_respuestas_bot enable row level security;
create policy chatwoot_respuestas_bot_service_role_all on public.chatwoot_respuestas_bot
  for all to service_role using (true) with check (true);
revoke all on public.chatwoot_respuestas_bot from public, anon, authenticated;
grant all on public.chatwoot_respuestas_bot to service_role;

-- Reserva la respuesta antes de enviarla. Devuelve:
--   'enviar'     esta llamada reservó: puede enviar;
--   'ya_enviada' salió hace menos de 24 h: no se envía;
--   'incierta'   pudo haber salido (o la reserva quedó colgada más de 10 min):
--                no se envía;
--   'en_curso'   otra entrega la reservó hace menos de 10 min: el llamador NO
--                debe dar el evento por terminado (se reintenta después).
create function public.chatwoot_reservar_respuesta(p_tenant_id uuid, p_conversation_id bigint, p_tipo text)
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_filas   integer;
  v_estado  text;
  v_reserva timestamptz;
begin
  insert into public.chatwoot_respuestas_bot as r (tenant_id, conversation_id, tipo)
  values (p_tenant_id, p_conversation_id, p_tipo)
  on conflict (tenant_id, conversation_id) do update
    set tipo = excluded.tipo, estado = 'reservada', reservada_at = pg_catalog.now(), enviada_at = null
    where (r.estado = 'enviada' and r.enviada_at < pg_catalog.now() - interval '24 hours')
       or (r.estado <> 'enviada' and r.reservada_at < pg_catalog.now() - interval '24 hours');
  get diagnostics v_filas = row_count;
  if v_filas = 1 then
    return 'enviar';
  end if;

  select r.estado, r.reservada_at into v_estado, v_reserva
  from public.chatwoot_respuestas_bot r
  where r.tenant_id = p_tenant_id and r.conversation_id = p_conversation_id;
  if v_estado = 'enviada' then
    return 'ya_enviada';
  elsif v_estado = 'incierta' or v_reserva < pg_catalog.now() - interval '10 minutes' then
    return 'incierta';
  end if;
  return 'en_curso';
end;
$fn$;

comment on function public.chatwoot_reservar_respuesta(uuid, bigint, text) is
  'SDD-0586: reserva la respuesta automática de una conversación (una cada 24 h). Devuelve enviar, ya_enviada, incierta o en_curso. Solo service_role.';

-- Cierra una reserva: 'enviada' la confirma, 'incierta' la deja bloqueada hasta
-- las 24 h y 'rechazada' (Chatwoot dijo que no) la borra para que se reintente.
-- Solo actúa sobre una reserva abierta: nunca reabre una enviada.
create function public.chatwoot_cerrar_respuesta(p_tenant_id uuid, p_conversation_id bigint, p_resultado text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_filas integer;
begin
  if p_resultado = 'rechazada' then
    delete from public.chatwoot_respuestas_bot r
    where r.tenant_id = p_tenant_id and r.conversation_id = p_conversation_id and r.estado = 'reservada';
  elsif p_resultado in ('enviada', 'incierta') then
    update public.chatwoot_respuestas_bot r
    set estado = p_resultado,
        enviada_at = case when p_resultado = 'enviada' then pg_catalog.now() end
    where r.tenant_id = p_tenant_id and r.conversation_id = p_conversation_id and r.estado = 'reservada';
  else
    raise exception 'chatwoot_cerrar_respuesta: resultado desconocido' using errcode = '22023';
  end if;
  get diagnostics v_filas = row_count;
  return v_filas = 1;
end;
$fn$;

comment on function public.chatwoot_cerrar_respuesta(uuid, bigint, text) is
  'SDD-0586: cierra la reserva de respuesta automática como enviada, incierta o rechazada. Solo service_role.';

-- ─── 3. Usuarios sin teléfono (BSUID) ────────────────────────────────────────
create table public.chatwoot_contactos_bsuid (
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  -- Un BSUID nunca es solo dígitos: eso sería un teléfono (wa_id) y no se guarda.
  bsuid           text not null check (bsuid ~ '^[A-Za-z0-9._:-]{1,128}$' and bsuid !~ '^[0-9]+$'),
  conversation_id bigint not null check (conversation_id > 0),
  primera_vez_at  timestamptz not null default now(),
  ultima_vez_at   timestamptz not null default now(),
  primary key (tenant_id, bsuid)
);

comment on table public.chatwoot_contactos_bsuid is
  'SDD-0586 (10.3): usuarios de WhatsApp sin teléfono, por su BSUID, para vincularlos a una ficha después. Sin nombre, teléfono ni texto. Retención pendiente de decisión de Sam. Lee el admin de su tenant; escribe solo service_role.';

alter table public.chatwoot_contactos_bsuid enable row level security;
-- RLS por tenant (pedido del Director, 2026-10-30): el admin ve los de su
-- tenant, para vincularlos a una ficha. Nadie más que service_role escribe.
create policy chatwoot_contactos_bsuid_select_admin on public.chatwoot_contactos_bsuid
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()));
create policy chatwoot_contactos_bsuid_service_role_all on public.chatwoot_contactos_bsuid
  for all to service_role using (true) with check (true);
revoke all on public.chatwoot_contactos_bsuid from public, anon, authenticated;
grant select on public.chatwoot_contactos_bsuid to authenticated;
grant all on public.chatwoot_contactos_bsuid to service_role;

create function public.chatwoot_guardar_bsuid(p_tenant_id uuid, p_bsuid text, p_conversation_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.chatwoot_contactos_bsuid as b (tenant_id, bsuid, conversation_id)
  values (p_tenant_id, p_bsuid, p_conversation_id)
  on conflict (tenant_id, bsuid) do update
    set conversation_id = excluded.conversation_id, ultima_vez_at = pg_catalog.now();
end;
$fn$;

comment on function public.chatwoot_guardar_bsuid(uuid, text, bigint) is
  'SDD-0586 (10.3): guarda o actualiza el BSUID de un usuario sin teléfono. Solo service_role.';

revoke all on function public.chatwoot_reservar_respuesta(uuid, bigint, text) from public;
revoke all on function public.chatwoot_reservar_respuesta(uuid, bigint, text) from anon, authenticated;
grant execute on function public.chatwoot_reservar_respuesta(uuid, bigint, text) to service_role;
revoke all on function public.chatwoot_cerrar_respuesta(uuid, bigint, text) from public;
revoke all on function public.chatwoot_cerrar_respuesta(uuid, bigint, text) from anon, authenticated;
grant execute on function public.chatwoot_cerrar_respuesta(uuid, bigint, text) to service_role;
revoke all on function public.chatwoot_guardar_bsuid(uuid, text, bigint) from public;
revoke all on function public.chatwoot_guardar_bsuid(uuid, text, bigint) from anon, authenticated;
grant execute on function public.chatwoot_guardar_bsuid(uuid, text, bigint) to service_role;
