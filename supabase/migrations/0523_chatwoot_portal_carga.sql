-- 0523 · SDD-0586 (E10, paso 10.7, PR 2: P4) · La carga a Chatwoot de los hilos del portal que ya existen.
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Se aplica ANTES de fusionar
--    (migrate-first, decisión del DG del 2026-11-08), desde la cabeza aprobada de la PR: primero en
--    prueba y después en producción, cada una con el OK nominal de Sam para este archivo y el
--    runbook aplicar-migraciones-prod. Va después de la 0519 y la 0520. No depende de la 0521.
--
-- Spec §10.5.10 (P4) y el formato cerrado con E5 de `preparado.ndjson` y `vinculos.ndjson`. Tres
-- funciones, todas `security definer`, `search_path = ''` y solo para `service_role`. Las tres se
-- niegan con el flag `chatwoot_portal` encendido: la carga corre con la cola quieta, y lo que se
-- escriba después del corte lo manda la cola al encender.
--
-- 1. `chatwoot_portal_reservar_contactos(p_tenant_id)`: guarda el identificador al azar de cada
--    ficha con un hilo del portal por cargar ANTES de llamar a Chatwoot (riesgo 1 de §10.5.10, la
--    regla de la 0519). Una repetición reusa el mismo y el cargador encuentra su contacto
--    `dtd-portal:<identificador>`. Escribe en Studio: en producción va dentro de la puerta 4.
-- 2. `chatwoot_portal_carga_lineas(p_tenant_id, p_cuenta, p_bandeja)`: las líneas de
--    `preparado.ndjson`. Solo en una transacción de solo lectura (la foto). El `corte` va 5 minutos
--    antes de que empiece esa transacción (riesgo 2): lo que cae en el margen y está en la foto
--    queda `cargado` y la cola lo salta (`0519:228`); lo que no está, lo manda la cola.
-- 3. `chatwoot_portal_vincular_carga(p_tenant_id, p_preparado, p_vinculos)`: el paso 4. Guarda los
--    vínculos de contactos e hilos, marca `cargado` cada mensaje cargado, crea las filas de
--    `chatwoot_conversations` y fija el corte si no había. Compara las dos cabeceras y los conteos.
--    No crea tarjetas, tareas ni avisos, y no cambia `conversations` ni `conversation_messages`.
--
-- Qué se carga: los hilos del canal `portal` del tenant, vivos y archivados, que todavía no tienen
-- vínculo en `chatwoot_portal_hilos` (los que lo tienen los llevó la cola), de fichas no borradas
-- (una ficha borrada no se copia a otro sistema, como en la vuelta de la 0520), con todos sus
-- mensajes salvo los que vinieron de Chatwoot (`chatwoot:`).
--
-- Datos personales: el nombre de la ficha (`clients.name`) y el texto de cada mensaje, que es lo
-- que el chat de Soporte ya lleva a Chatwoot desde la 1a. Nunca teléfono, correo, cédula, RIF ni
-- Shipping Mark. La revisión (`revisar-datos-ve`) está en la spec.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.chatwoot_portal_hilos') is null
     or pg_catalog.to_regclass('public.chatwoot_portal_contactos') is null
     or pg_catalog.to_regclass('public.chatwoot_portal_salida') is null
     or pg_catalog.to_regclass('public.chatwoot_portal_estado') is null
     or pg_catalog.to_regclass('public.chatwoot_conversations') is null
     or pg_catalog.to_regclass('public.chatwoot_agent_links') is null
     or pg_catalog.to_regprocedure('public.chatwoot_portal_respuesta(uuid, bigint, bigint, text, timestamptz, bigint)') is null then
    raise exception '0523 requiere 0519 (chatwoot_portal_*), 0520 (chatwoot_portal_respuesta), 0504 (chatwoot_conversations) y 0503 (chatwoot_agent_links)';
  end if;
  if pg_catalog.to_regprocedure('public.chatwoot_portal_vincular_carga(uuid, jsonb, jsonb)') is not null
     or pg_catalog.to_regprocedure('public.chatwoot_portal_carga_lineas(uuid, integer, bigint)') is not null
     or pg_catalog.to_regprocedure('public.chatwoot_portal_reservar_contactos(uuid)') is not null then
    raise exception '0523: la carga del portal ya existe; no se reaplica';
  end if;
end;
$preflight$;

-- ¿El flag del portal está encendido en el tenant? La carga se niega: corre con la cola quieta.
create or replace function public.chatwoot_portal_carga_apagado(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select not exists (
    select 1 from public.feature_flags f
    where f.tenant_id = p_tenant_id and f.key = 'chatwoot_portal' and f.enabled
  );
$function$;

comment on function public.chatwoot_portal_carga_apagado(uuid) is
  'SDD-0586 10.7: ¿chatwoot_portal está apagado en el tenant? La carga (P4) solo corre con el flag apagado.';

-- Los hilos por cargar: del portal, sin vínculo, de fichas vivas.
create or replace function public.chatwoot_portal_carga_hilos(p_tenant_id uuid)
returns table (conversation_id uuid, client_id uuid)
language sql
stable
security definer
set search_path = ''
as $function$
  select c.id, c.client_id
  from public.conversations c
  join public.clients cl on cl.id = c.client_id and cl.tenant_id = c.tenant_id and cl.deleted_at is null
  where c.tenant_id = p_tenant_id
    and c.channel = 'portal'
    and not exists (select 1 from public.chatwoot_portal_hilos h where h.conversation_id = c.id);
$function$;

comment on function public.chatwoot_portal_carga_hilos(uuid) is
  'SDD-0586 10.7: los hilos del portal del tenant por cargar a Chatwoot: sin vínculo en chatwoot_portal_hilos y de fichas no borradas, vivos y archivados.';

-- ─── 1. La reserva del identificador ─────────────────────────────────────────
create or replace function public.chatwoot_portal_reservar_contactos(p_tenant_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_n integer;
begin
  if p_tenant_id is null then
    raise exception 'chatwoot_portal_reservar_contactos: falta el tenant' using errcode = '22023';
  end if;
  if not public.chatwoot_portal_carga_apagado(p_tenant_id) then
    raise exception 'chatwoot_portal_reservar_contactos: apagar chatwoot_portal antes de la carga' using errcode = '55000';
  end if;
  insert into public.chatwoot_portal_contactos (tenant_id, client_id)
  select distinct p_tenant_id, h.client_id from public.chatwoot_portal_carga_hilos(p_tenant_id) h
  on conflict (tenant_id, client_id) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

comment on function public.chatwoot_portal_reservar_contactos(uuid) is
  'SDD-0586 10.7, riesgo 1: guarda el identificador al azar de cada ficha con un hilo del portal por cargar, antes de llamar a Chatwoot; no toca uno que ya existe. Devuelve cuántos guardó. Con chatwoot_portal encendido se niega.';

-- ─── 2. Las líneas de preparado.ndjson ───────────────────────────────────────
create or replace function public.chatwoot_portal_carga_lineas(p_tenant_id uuid, p_cuenta integer, p_bandeja bigint)
returns setof text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_corte text;
  v_contactos integer;
  v_conversaciones integer;
  v_mensajes integer;
begin
  if p_tenant_id is null or p_cuenta is null or p_cuenta <= 0 or p_bandeja is null or p_bandeja <= 0 then
    raise exception 'chatwoot_portal_carga_lineas: faltan el tenant, la cuenta o la bandeja' using errcode = '22023';
  end if;
  if pg_catalog.current_setting('transaction_read_only') <> 'on' then
    raise exception 'chatwoot_portal_carga_lineas: solo en una transacción de solo lectura' using errcode = '25006';
  end if;
  if not public.chatwoot_portal_carga_apagado(p_tenant_id) then
    raise exception 'chatwoot_portal_carga_lineas: apagar chatwoot_portal antes de la carga' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.chatwoot_portal_carga_hilos(p_tenant_id) h
    where not exists (
      select 1 from public.chatwoot_portal_contactos k where k.tenant_id = p_tenant_id and k.client_id = h.client_id
    )
  ) then
    raise exception 'chatwoot_portal_carga_lineas: falta reservar los contactos (chatwoot_portal_reservar_contactos)' using errcode = '55000';
  end if;

  -- El corte: 5 minutos antes de que empiece la transacción de la foto (riesgo 2).
  v_corte := pg_catalog.to_char(
    (pg_catalog.transaction_timestamp() - interval '5 minutes') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');

  select pg_catalog.count(distinct h.client_id), pg_catalog.count(*) into v_contactos, v_conversaciones
  from public.chatwoot_portal_carga_hilos(p_tenant_id) h;
  select pg_catalog.count(*) into v_mensajes
  from public.chatwoot_portal_carga_hilos(p_tenant_id) h
  join public.conversation_messages m on m.conversation_id = h.conversation_id and m.tenant_id = p_tenant_id
  where m.external_msg_id is null or m.external_msg_id not like 'chatwoot:%';

  return next pg_catalog.jsonb_build_object(
    'tipo', 'cabecera', 'version', 1, 'tenant_id', p_tenant_id, 'cuenta', p_cuenta, 'bandeja', p_bandeja,
    'corte', v_corte, 'contactos', v_contactos, 'conversaciones', v_conversaciones, 'mensajes', v_mensajes
  )::text;

  return query
  select pg_catalog.jsonb_build_object(
    'tipo', 'contacto', 'cliente', k.client_id, 'identificador', k.identificador, 'nombre', cl.name
  )::text
  from (select distinct h.client_id from public.chatwoot_portal_carga_hilos(p_tenant_id) h) d
  join public.chatwoot_portal_contactos k on k.tenant_id = p_tenant_id and k.client_id = d.client_id
  join public.clients cl on cl.id = d.client_id
  order by k.client_id;

  return query
  select pg_catalog.jsonb_build_object(
    'tipo', 'conversacion',
    'hilo', c.id,
    'cliente', c.client_id,
    'estado', case
      when c.deleted_at is not null then 'resolved'
      when c.status = 'abierto' then 'open'
      when c.status = 'pendiente' then 'pending'
      else 'resolved'
    end,
    'creada_at', pg_catalog.to_char(c.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'archivado_at', case when c.deleted_at is null then null
      else pg_catalog.to_char(c.deleted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,
    'nota_archivo', case when c.deleted_at is null then null else pg_catalog.jsonb_build_object(
      'source_id', 'dtd:archivado:' || c.id::text,
      'texto', 'Hilo archivado en el Studio. El cliente ya no lo ve: lo que se escriba aquí no le llega.',
      'created_at', pg_catalog.to_char(c.deleted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    ) end
  )::text
  from public.chatwoot_portal_carga_hilos(p_tenant_id) h
  join public.conversations c on c.id = h.conversation_id
  order by c.id;

  return query
  select pg_catalog.jsonb_build_object(
    'tipo', 'mensaje',
    'hilo', m.conversation_id,
    'mensaje', m.id,
    'source_id', 'dtd:' || m.id::text,
    'sentido', case when m.direction = 'out' then 'saliente' else 'entrante' end,
    'texto', m.body,
    'created_at', pg_catalog.to_char(m.sent_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'agente', case when m.direction = 'out' then (
      select l.chatwoot_user_id from public.chatwoot_agent_links l
      where l.tenant_id = p_tenant_id and l.user_id = m.author_user_id
    ) end
  )::text
  from public.chatwoot_portal_carga_hilos(p_tenant_id) h
  join public.conversation_messages m on m.conversation_id = h.conversation_id and m.tenant_id = p_tenant_id
  where m.external_msg_id is null or m.external_msg_id not like 'chatwoot:%'
  order by m.conversation_id, m.sent_at, m.id;
end;
$function$;

comment on function public.chatwoot_portal_carga_lineas(uuid, integer, bigint) is
  'SDD-0586 10.7: las líneas de preparado.ndjson (cabecera, contactos, conversaciones y mensajes en el orden de Studio), solo en una transacción de solo lectura y con el flag apagado. El corte va 5 minutos antes de la transacción. Sin teléfono, correo, cédula, RIF ni Shipping Mark.';

-- ─── 3. La vinculación ───────────────────────────────────────────────────────
--
-- `p_preparado`: la cabecera de preparado.ndjson. `p_vinculos`: todas las líneas de vinculos.ndjson,
-- cabecera incluida, como un arreglo jsonb. Todo o nada: cualquier rechazo deshace todo.
create or replace function public.chatwoot_portal_vincular_carga(
  p_tenant_id uuid,
  p_preparado jsonb,
  p_vinculos  jsonb
)
returns table (contactos integer, hilos integer, mensajes integer)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
#variable_conflict use_column
declare
  v_cab      jsonb;
  v_linea    jsonb;
  v_corte    timestamptz;
  v_bandeja  bigint;
  v_client   uuid;
  v_actual   bigint;
  v_ident    uuid;
  v_deleted  timestamptz;
  v_status   text;
  v_ultimo   timestamptz;
  v_hilo     uuid;
  v_conv     bigint;
  v_n_cont   integer := 0;
  v_n_hilos  integer := 0;
  v_n_msj    integer := 0;
begin
  if p_tenant_id is null or p_preparado is null or pg_catalog.jsonb_typeof(p_vinculos) is distinct from 'array' then
    raise exception 'chatwoot_portal_vincular_carga: faltan el tenant, la cabecera del preparado o los vínculos' using errcode = '22023';
  end if;
  if not public.chatwoot_portal_carga_apagado(p_tenant_id) then
    raise exception 'chatwoot_portal_vincular_carga: apagar chatwoot_portal antes de la carga' using errcode = '55000';
  end if;

  -- Las cabeceras: una sola en los vínculos, igual a la del preparado y del tenant.
  if (select pg_catalog.count(*) from pg_catalog.jsonb_array_elements(p_vinculos) e where e ->> 'tipo' = 'cabecera') <> 1 then
    raise exception 'chatwoot_portal_vincular_carga: los vínculos llevan una sola cabecera' using errcode = '22023';
  end if;
  select e into v_cab from pg_catalog.jsonb_array_elements(p_vinculos) e where e ->> 'tipo' = 'cabecera';
  if p_preparado ->> 'tipo' is distinct from 'cabecera'
     or (p_preparado ->> 'version') is distinct from '1' or (v_cab ->> 'version') is distinct from '1'
     or (p_preparado ->> 'tenant_id') is distinct from p_tenant_id::text
     or (v_cab ->> 'tenant_id') is distinct from p_tenant_id::text
     or (v_cab ->> 'cuenta') is distinct from (p_preparado ->> 'cuenta')
     or (v_cab ->> 'bandeja') is distinct from (p_preparado ->> 'bandeja')
     or (v_cab ->> 'corte') is distinct from (p_preparado ->> 'corte') then
    raise exception 'chatwoot_portal_vincular_carga: la cabecera de los vínculos no es la del preparado' using errcode = '22023';
  end if;
  if (v_cab ->> 'contactos')::integer is distinct from
       (select pg_catalog.count(*)::integer from pg_catalog.jsonb_array_elements(p_vinculos) e where e ->> 'tipo' = 'contacto')
     or (v_cab ->> 'conversaciones')::integer is distinct from
       (select pg_catalog.count(*)::integer from pg_catalog.jsonb_array_elements(p_vinculos) e where e ->> 'tipo' = 'conversacion')
     or (v_cab ->> 'mensajes')::integer is distinct from
       (select pg_catalog.count(*)::integer from pg_catalog.jsonb_array_elements(p_vinculos) e where e ->> 'tipo' = 'mensaje') then
    raise exception 'chatwoot_portal_vincular_carga: los conteos de la cabecera no son los de las líneas' using errcode = '22023';
  end if;
  -- Y tienen que ser los del preparado: un vinculos incompleto fijaría el corte y lo que falta,
  -- anterior al corte, no saldría nunca por la cola.
  if (v_cab ->> 'contactos')::integer is distinct from (p_preparado ->> 'contactos')::integer
     or (v_cab ->> 'conversaciones')::integer is distinct from (p_preparado ->> 'conversaciones')::integer
     or (v_cab ->> 'mensajes')::integer is distinct from (p_preparado ->> 'mensajes')::integer then
    raise exception 'chatwoot_portal_vincular_carga: los conteos de los vínculos no son los del preparado' using errcode = '22023';
  end if;
  v_corte := (p_preparado ->> 'corte')::timestamptz;
  v_bandeja := (p_preparado ->> 'bandeja')::bigint;
  if v_corte is null or v_bandeja is null or v_bandeja <= 0 then
    raise exception 'chatwoot_portal_vincular_carga: falta el corte o la bandeja' using errcode = '22023';
  end if;

  -- Contactos: el identificador tiene que ser el reservado.
  for v_linea in select e from pg_catalog.jsonb_array_elements(p_vinculos) e where e ->> 'tipo' = 'contacto' loop
    select k.identificador, k.chatwoot_contact_id into v_ident, v_actual
    from public.chatwoot_portal_contactos k
    where k.tenant_id = p_tenant_id and k.client_id = (v_linea ->> 'cliente')::uuid
    for update;
    if not found then
      raise exception 'chatwoot_portal_vincular_carga: un contacto sin reserva' using errcode = 'P0002';
    end if;
    if v_ident::text is distinct from v_linea ->> 'identificador' then
      raise exception 'chatwoot_portal_vincular_carga: el identificador no es el reservado' using errcode = '22023';
    end if;
    if v_actual is not null and v_actual <> (v_linea ->> 'contacto_id')::bigint then
      raise exception 'chatwoot_portal_vincular_carga: la ficha ya tiene otro contacto' using errcode = '23505';
    end if;
    update public.chatwoot_portal_contactos k
    set chatwoot_contact_id = (v_linea ->> 'contacto_id')::bigint,
        chatwoot_source_id  = v_linea ->> 'source_id',
        updated_at          = pg_catalog.now()
    where k.tenant_id = p_tenant_id and k.client_id = (v_linea ->> 'cliente')::uuid;
    v_n_cont := v_n_cont + 1;
  end loop;

  -- Conversaciones: el vínculo del hilo y su fila del espejo.
  for v_linea in select e from pg_catalog.jsonb_array_elements(p_vinculos) e where e ->> 'tipo' = 'conversacion' loop
    v_hilo := (v_linea ->> 'hilo')::uuid;
    v_conv := (v_linea ->> 'conversacion_id')::bigint;
    if v_conv is null or v_conv <= 0 or v_conv > 2147483647 then
      raise exception 'chatwoot_portal_vincular_carga: id de conversación inválido' using errcode = '22023';
    end if;
    select c.client_id, c.deleted_at, c.status::text, c.last_message_at into v_client, v_deleted, v_status, v_ultimo
    from public.conversations c
    where c.id = v_hilo and c.tenant_id = p_tenant_id and c.channel = 'portal';
    if v_client is null then
      raise exception 'chatwoot_portal_vincular_carga: hilo del portal no encontrado' using errcode = 'P0002';
    end if;
    insert into public.chatwoot_portal_hilos (conversation_id, tenant_id, chatwoot_conversation_id)
    values (v_hilo, p_tenant_id, v_conv)
    on conflict do nothing;
    select hl.chatwoot_conversation_id into v_actual
    from public.chatwoot_portal_hilos hl where hl.conversation_id = v_hilo;
    if v_actual is distinct from v_conv then
      raise exception 'chatwoot_portal_vincular_carga: el hilo o la conversación ya tienen otro vínculo' using errcode = '23505';
    end if;
    insert into public.chatwoot_conversations (tenant_id, conversation_id, inbox_id, status, client_id, last_activity_at)
    values (
      p_tenant_id, v_conv, v_bandeja,
      case
        when v_deleted is not null then 'resolved'
        when v_status = 'abierto' then 'open'
        when v_status = 'pendiente' then 'pending'
        else 'resolved'
      end,
      v_client, v_ultimo
    )
    on conflict (tenant_id, conversation_id) do nothing;
    v_n_hilos := v_n_hilos + 1;
  end loop;

  -- Mensajes: cada uno, del tenant y de un hilo ya vinculado, queda `cargado` con su id de Chatwoot.
  for v_linea in select e from pg_catalog.jsonb_array_elements(p_vinculos) e where e ->> 'tipo' = 'mensaje' loop
    if (v_linea ->> 'mensaje_id')::bigint is null or (v_linea ->> 'mensaje_id')::bigint <= 0
       or (v_linea ->> 'mensaje_id')::bigint > 2147483647 then
      raise exception 'chatwoot_portal_vincular_carga: id de mensaje inválido' using errcode = '22023';
    end if;
    select m.conversation_id into v_hilo
    from public.conversation_messages m
    join public.chatwoot_portal_hilos hl on hl.conversation_id = m.conversation_id and hl.tenant_id = p_tenant_id
    where m.id = (v_linea ->> 'mensaje')::uuid and m.tenant_id = p_tenant_id;
    if v_hilo is null then
      raise exception 'chatwoot_portal_vincular_carga: un mensaje que no es de un hilo vinculado del tenant' using errcode = 'P0002';
    end if;
    insert into public.chatwoot_portal_salida as s (message_id, tenant_id, conversation_id, estado, chatwoot_message_id)
    values ((v_linea ->> 'mensaje')::uuid, p_tenant_id, v_hilo, 'cargado', (v_linea ->> 'mensaje_id')::bigint)
    on conflict (message_id) do update
      set estado = 'cargado', chatwoot_message_id = excluded.chatwoot_message_id, verificar = false,
          proximo_at = null, error = null, updated_at = pg_catalog.now()
      where s.estado <> 'enviado';
    v_n_msj := v_n_msj + 1;
  end loop;

  -- El corte: se fija si no había; uno que ya existe no se mueve (la cola ya corre desde ahí).
  insert into public.chatwoot_portal_estado as e (tenant_id, corte, cargado_at)
  values (p_tenant_id, v_corte, pg_catalog.now())
  on conflict (tenant_id) do update
    set corte = coalesce(e.corte, excluded.corte), cargado_at = excluded.cargado_at, updated_at = pg_catalog.now();

  contactos := v_n_cont;
  hilos := v_n_hilos;
  mensajes := v_n_msj;
  return next;
end;
$function$;

comment on function public.chatwoot_portal_vincular_carga(uuid, jsonb, jsonb) is
  'SDD-0586 10.7, paso 4 de §10.5.10: vincula en Studio lo que cargó el cargador de E5. Compara la cabecera de vinculos.ndjson con la del preparado y los conteos; guarda contactos (con el identificador reservado) e hilos, crea las filas de chatwoot_conversations sin eventos, marca cargado cada mensaje (nunca pisa uno enviado) y fija el corte si no había. Todo o nada. Con chatwoot_portal encendido se niega.';

revoke all on function public.chatwoot_portal_carga_apagado(uuid) from public, anon, authenticated;
grant execute on function public.chatwoot_portal_carga_apagado(uuid) to service_role;
revoke all on function public.chatwoot_portal_carga_hilos(uuid) from public, anon, authenticated;
grant execute on function public.chatwoot_portal_carga_hilos(uuid) to service_role;
revoke all on function public.chatwoot_portal_reservar_contactos(uuid) from public, anon, authenticated;
grant execute on function public.chatwoot_portal_reservar_contactos(uuid) to service_role;
revoke all on function public.chatwoot_portal_carga_lineas(uuid, integer, bigint) from public, anon, authenticated;
grant execute on function public.chatwoot_portal_carga_lineas(uuid, integer, bigint) to service_role;
revoke all on function public.chatwoot_portal_vincular_carga(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.chatwoot_portal_vincular_carga(uuid, jsonb, jsonb) to service_role;

-- ─── Postflight ──────────────────────────────────────────────────────────────
do $postflight$
declare
  v_firma text;
begin
  foreach v_firma in array array[
    'public.chatwoot_portal_carga_apagado(uuid)',
    'public.chatwoot_portal_carga_hilos(uuid)',
    'public.chatwoot_portal_reservar_contactos(uuid)',
    'public.chatwoot_portal_carga_lineas(uuid, integer, bigint)',
    'public.chatwoot_portal_vincular_carga(uuid, jsonb, jsonb)'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure(v_firma)
        and p.prosecdef
        and p.proconfig @> array['search_path=""']
    ) then
      raise exception '0523: % no quedó security definer con search_path vacío', v_firma;
    end if;
    if pg_catalog.has_function_privilege('anon', v_firma, 'EXECUTE')
       or pg_catalog.has_function_privilege('authenticated', v_firma, 'EXECUTE')
       or not pg_catalog.has_function_privilege('service_role', v_firma, 'EXECUTE') then
      raise exception '0523: % tiene que ser solo de service_role', v_firma;
    end if;
  end loop;
end;
$postflight$;
