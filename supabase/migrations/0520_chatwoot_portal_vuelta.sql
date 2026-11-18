-- 0520 · SDD-0586 (E10, paso 10.5, PR 1b) · Conversaciones del portal en Chatwoot: la vuelta y destrabar.
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla, en prueba o en
--    producción, exige el OK nominal de Sam para este archivo y el runbook
--    aplicar-migraciones-prod. Va después de la 0519, que también está en espera.
--
-- 1. `chatwoot_portal_respuesta`: la vuelta, de Chatwoot al portal (spec §10.5.4, E10-D37). La
--    respuesta del agente se escribe en `conversation_messages` con `direction = 'out'`,
--    idempotente por `external_msg_id = 'chatwoot:<id del mensaje>'` (el índice único de 0106,
--    que la 0512 ya exige), con la hora de Chatwoot como `sent_at` y el autor del vínculo del
--    agente (`chatwoot_agent_links`, 0503). Deja el `unread_count` del hilo en 0, como la
--    respuesta desde Studio (`insertOutboundMessage`). Devuelve si insertó: el push al cliente
--    sale una sola vez. A un hilo archivado (`deleted_at`) no le escribe: el portal lee solo el
--    hilo vivo; el servidor deja la nota privada en Chatwoot (§10.5.10, «Hilos archivados»).
-- 2. `chatwoot_portal_destrabar`: el admin del tenant reintenta los mensajes «atascados» de la
--    ida (§10.5.20, decisión del Director General del 2026-11-07). Es el procedimiento manual de
--    la 0519 hecho función: vuelven a «pendiente» con un plazo nuevo de 24 h y con `verificar`
--    encendido, porque un atascado pudo haber llegado. Para `authenticated`, con la comprobación
--    de admin aquí dentro (`is_tenant_admin`, 0386): el tenant sale de la sesión, no del que
--    llama.
--
-- Datos personales: la vuelta copia el texto de la respuesta del agente al hilo del cliente,
-- que es lo que el cliente tiene que leer, y el nombre del usuario de Studio vinculado, como la
-- respuesta de hoy. No guarda nada de Chatwoot fuera de `conversation_messages`: ni el nombre
-- ni el correo del agente en Chatwoot, ni el payload.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.chatwoot_portal_hilos') is null
     or pg_catalog.to_regclass('public.chatwoot_portal_salida') is null
     or pg_catalog.to_regprocedure('public.chatwoot_portal_tomar(uuid, integer, uuid)') is null
     or pg_catalog.to_regclass('public.chatwoot_agent_links') is null
     or pg_catalog.to_regclass('public.user_profiles') is null
     or pg_catalog.to_regprocedure('public.is_tenant_admin()') is null
     or pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null then
    raise exception '0520 requiere 0519 (chatwoot_portal_hilos, chatwoot_portal_salida y chatwoot_portal_tomar), 0503 (chatwoot_agent_links), 0019 (user_profiles) y 0386 (is_tenant_admin)';
  end if;
  if coalesce(pg_catalog.pg_get_indexdef(
       pg_catalog.to_regclass('public.conversation_messages_external_idx')
     ), '') not like 'CREATE UNIQUE INDEX %(tenant_id, external_msg_id) WHERE (external_msg_id IS NOT NULL)' then
    raise exception '0520: índice único de external_msg_id ausente o distinto de 0106';
  end if;
  if pg_catalog.to_regprocedure('public.chatwoot_portal_respuesta(uuid, bigint, bigint, text, timestamptz, bigint)') is not null
     or pg_catalog.to_regprocedure('public.chatwoot_portal_destrabar()') is not null then
    raise exception '0520: la vuelta del portal ya existe; no se reaplica';
  end if;
end;
$preflight$;

-- ─── 1. La vuelta: la respuesta del agente en el hilo del portal ─────────────
--
-- `resultado`:
--   insertado     escribió la respuesta: el servidor manda el push al cliente (`cliente_id`)
--   duplicado     ya estaba (un reintento del mismo evento): no se avisa otra vez
--   archivado     el hilo de Studio está archivado: no se escribe; el servidor deja la nota
--   sin_texto     el hilo está vivo pero la respuesta no trae texto (solo un adjunto)
--   ficha_borrada la ficha del cliente está borrada: no se escribe ni se avisa
--   sin_hilo      la conversación de Chatwoot no es de un hilo del portal
--   apagado       el flag `chatwoot_portal` está apagado
create or replace function public.chatwoot_portal_respuesta(
  p_tenant_id                uuid,
  p_chatwoot_conversation_id bigint,
  p_chatwoot_message_id      bigint,
  p_cuerpo                   text,
  p_enviado_at               timestamptz,
  p_chatwoot_user_id         bigint default null
)
returns table (resultado text, cliente_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
#variable_conflict use_column
declare
  v_hilo      uuid;
  v_cliente   uuid;
  v_archivado timestamptz;
  v_usuario   uuid;
  v_nombre    text;
  v_cuando    timestamptz;
  v_id        uuid;
begin
  if p_tenant_id is null then
    raise exception 'chatwoot_portal_respuesta: falta el tenant' using errcode = '22023';
  end if;
  if p_chatwoot_conversation_id is null or p_chatwoot_conversation_id <= 0 or p_chatwoot_conversation_id > 2147483647
     or p_chatwoot_message_id is null or p_chatwoot_message_id <= 0 or p_chatwoot_message_id > 2147483647 then
    raise exception 'chatwoot_portal_respuesta: ids de Chatwoot inválidos' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.feature_flags f
    where f.tenant_id = p_tenant_id and f.key = 'chatwoot_portal' and f.enabled
  ) then
    resultado := 'apagado';
    return next;
    return;
  end if;

  select hl.conversation_id into v_hilo
  from public.chatwoot_portal_hilos hl
  where hl.tenant_id = p_tenant_id and hl.chatwoot_conversation_id = p_chatwoot_conversation_id;
  if v_hilo is null then
    resultado := 'sin_hilo';
    return next;
    return;
  end if;

  -- El hilo, bloqueado para escribir su resumen. `no key update` no choca con el `for key share`
  -- de la clave foránea, así que no frena a `portal_post_message` mientras inserta su mensaje.
  select c.client_id, c.deleted_at into v_cliente, v_archivado
  from public.conversations c
  where c.id = v_hilo and c.tenant_id = p_tenant_id and c.channel = 'portal'
  for no key update;
  if not found then
    resultado := 'sin_hilo';
    return next;
    return;
  end if;
  if v_archivado is not null then
    resultado := 'archivado';
    return next;
    return;
  end if;
  if not exists (
    select 1 from public.clients cl
    where cl.id = v_cliente and cl.tenant_id = p_tenant_id and cl.deleted_at is null
  ) then
    resultado := 'ficha_borrada';
    return next;
    return;
  end if;
  if p_cuerpo is null or pg_catalog.btrim(p_cuerpo) = '' then
    resultado := 'sin_texto';
    return next;
    return;
  end if;

  -- El autor: el usuario de Studio vinculado al agente, con su nombre como en la respuesta de
  -- hoy (`resolveAgent`). Sin vínculo, el nombre va vacío y el portal muestra «DTD Cargo».
  if p_chatwoot_user_id is not null then
    select l.user_id into v_usuario
    from public.chatwoot_agent_links l
    where l.tenant_id = p_tenant_id and l.chatwoot_user_id = p_chatwoot_user_id;
    if v_usuario is not null then
      select nullif(pg_catalog.btrim(pg_catalog.concat_ws(' ', p.first_name, p.last_name)), '') into v_nombre
      from public.user_profiles p
      where p.user_id = v_usuario;
      v_nombre := coalesce(v_nombre, 'Agente DTD');
    end if;
  end if;

  -- La hora de Chatwoot: una respuesta que llega tarde por un reintento queda en su lugar del
  -- hilo. Nunca en el futuro, por si los relojes no coinciden.
  v_cuando := least(coalesce(p_enviado_at, pg_catalog.now()), pg_catalog.now());

  insert into public.conversation_messages (
    tenant_id, conversation_id, direction, author_name, author_user_id, body, external_msg_id, sent_at
  )
  values (
    p_tenant_id, v_hilo, 'out', v_nombre, v_usuario, p_cuerpo, 'chatwoot:' || p_chatwoot_message_id::text, v_cuando
  )
  on conflict (tenant_id, external_msg_id) where external_msg_id is not null do nothing
  returning id into v_id;
  if v_id is null then
    resultado := 'duplicado';
    return next;
    return;
  end if;

  update public.conversations c
  set last_message_at = greatest(coalesce(c.last_message_at, v_cuando), v_cuando),
      unread_count    = 0
  where c.id = v_hilo;

  resultado := 'insertado';
  cliente_id := v_cliente;
  return next;
end;
$function$;

comment on function public.chatwoot_portal_respuesta(uuid, bigint, bigint, text, timestamptz, bigint) is
  'SDD-0586 E10-D37: la respuesta de un agente en la bandeja del portal se escribe en el hilo del cliente (direction out), una sola vez por external_msg_id chatwoot:<id>, con la hora de Chatwoot y el autor del vínculo del agente; deja unread_count en 0. A un hilo archivado, a una ficha borrada o con el flag apagado no le escribe. Devuelve el resultado y, solo si insertó, el cliente para el push.';

-- ─── 2. Destrabar: el admin reintenta los atascados de la ida ────────────────
--
-- Toca solo los atascados del tenant de la sesión. Cada uno vuelve a «pendiente» ahora, con
-- `verificar` encendido (el próximo intento busca antes su source_id y no lo duplica) y con un
-- plazo nuevo de 24 h (`created_at`). El cron `chatwoot-reintentos` los toma en su próxima
-- corrida, en orden, porque cada atascado es la cabeza de su hilo.
create or replace function public.chatwoot_portal_destrabar()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
  v_n      integer;
begin
  if not coalesce(public.is_tenant_admin(), false) then
    raise exception 'chatwoot_portal_destrabar: solo el admin del tenant' using errcode = '42501';
  end if;
  v_tenant := public.get_user_tenant_id();
  if v_tenant is null then
    raise exception 'chatwoot_portal_destrabar: sin tenant' using errcode = '42501';
  end if;

  update public.chatwoot_portal_salida s
  set estado = 'pendiente', proximo_at = pg_catalog.now(), verificar = true,
      created_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where s.tenant_id = v_tenant and s.estado = 'atascado';
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

comment on function public.chatwoot_portal_destrabar() is
  'SDD-0586 §10.5.20: el admin del tenant de la sesión reintenta los mensajes atascados de la ida a Chatwoot: vuelven a pendiente ahora, con verificar encendido y un plazo nuevo de 24 h. Devuelve cuántos destrabó. Rechaza a quien no es admin.';

revoke all on function public.chatwoot_portal_respuesta(uuid, bigint, bigint, text, timestamptz, bigint) from public, anon, authenticated;
grant execute on function public.chatwoot_portal_respuesta(uuid, bigint, bigint, text, timestamptz, bigint) to service_role;
revoke all on function public.chatwoot_portal_destrabar() from public, anon;
grant execute on function public.chatwoot_portal_destrabar() to authenticated;

-- ─── Postflight ──────────────────────────────────────────────────────────────
do $postflight$
declare
  v_firma text;
begin
  foreach v_firma in array array[
    'public.chatwoot_portal_respuesta(uuid, bigint, bigint, text, timestamptz, bigint)',
    'public.chatwoot_portal_destrabar()'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure(v_firma)
        and p.prosecdef
        and p.proconfig @> array['search_path=""']
    ) then
      raise exception '0520: % no quedó security definer con search_path vacío', v_firma;
    end if;
    if pg_catalog.has_function_privilege('anon', v_firma, 'EXECUTE') then
      raise exception '0520: % no puede ser de anon', v_firma;
    end if;
  end loop;
  if pg_catalog.has_function_privilege('authenticated', 'public.chatwoot_portal_respuesta(uuid, bigint, bigint, text, timestamptz, bigint)', 'EXECUTE')
     or not pg_catalog.has_function_privilege('service_role', 'public.chatwoot_portal_respuesta(uuid, bigint, bigint, text, timestamptz, bigint)', 'EXECUTE') then
    raise exception '0520: chatwoot_portal_respuesta tiene que ser solo de service_role';
  end if;
  if not pg_catalog.has_function_privilege('authenticated', 'public.chatwoot_portal_destrabar()', 'EXECUTE') then
    raise exception '0520: chatwoot_portal_destrabar tiene que ser de authenticated (comprueba el admin dentro)';
  end if;
end;
$postflight$;
