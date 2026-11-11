-- 0521 · SDD-0586 (E10, paso 10.5, PR 1c-2) · Conversaciones del portal en Chatwoot: el estado, la
-- conciliación y la guarda de los hilos del portal.
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Se aplica ANTES de fusionar
--    (migrate-first, decisión del DG del 2026-11-08), desde la cabeza aprobada de la PR: primero en
--    prueba y después en producción, cada una con el OK nominal de Sam para este archivo y el
--    runbook aplicar-migraciones-prod. Va después de la 0520.
--
-- 1. `chatwoot_portal_estado_hilo`: el estado de la conversación de Chatwoot en el hilo del portal
--    (spec §10.5.16, «1c-2 · diseño», E10-D39). Lo lee del espejo `chatwoot_conversations` (0504),
--    que `chatwoot_registrar_evento` ya ordena por `source_updated_at`: un evento viejo no lo pisa.
--    Nunca del evento, porque el reproceso lo rellena. Escribe solo si cambia.
-- 2. `chatwoot_portal_por_conciliar` y `chatwoot_portal_marcar_conciliado`: la conciliación del cron
--    (E10-D40, punto 5). Dos columnas nuevas en `chatwoot_portal_hilos`: `conciliado_at` y la marca
--    de agua `conciliado_hasta` (el id de Chatwoot del mensaje más nuevo revisado en una corrida
--    completa; nunca vuelve hacia atrás).
-- 3. La guarda de los hilos del portal (decisión del DG del 2026-11-08). Cierra el riesgo residual
--    (I) de la 0106: `authenticated` escribe `conversations` y `conversation_messages` directo por
--    PostgREST (`0106:80` y la policy `for all` por tenant). Solo para `current_user = 'authenticated'`:
--    la función del trigger es `security invoker`, así que dentro de una función `security definer`
--    (`portal_post_message`, `chatwoot_portal_respuesta`, `chatwoot_portal_estado_hilo`) el
--    `current_user` es su dueño y pasa.
--      a. siempre: ningún hilo se vuelve ni deja de ser `portal` (insert o update de `channel`);
--      b. con el flag encendido: ningún saliente (`direction = 'out'`) en un hilo del portal;
--      c. con el flag encendido: ningún cambio de `status` en un hilo del portal (lo decide Chatwoot).
--    `assigned_to` e `is_case` siguen libres.
--
-- Aplicar antes del código es seguro (medido en `146d5ea5e`): nadie cambia `channel` (no hay
-- `.update` con `channel` en `app/` ni en `lib/`, y ninguna migración hace `set channel`), y b y c
-- hacen en la base lo mismo que la 1c-1 ya hace en el servidor.
--
-- Datos personales: ninguno nuevo. El estado y las marcas son ids, fechas y un enum.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.chatwoot_portal_hilos') is null
     or pg_catalog.to_regclass('public.chatwoot_conversations') is null
     or pg_catalog.to_regprocedure('public.chatwoot_portal_respuesta(uuid, bigint, bigint, text, timestamptz, bigint)') is null
     or pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regtype('public.conversation_status') is null
     or pg_catalog.to_regtype('public.conversation_channel') is null then
    raise exception '0521 requiere 0519 (chatwoot_portal_hilos), 0504 (chatwoot_conversations), 0520 (chatwoot_portal_respuesta), 0453 (get_user_tenant_id) y 0106 (conversation_status y conversation_channel)';
  end if;
  if exists (
    select 1 from pg_catalog.pg_attribute a
    where a.attrelid = pg_catalog.to_regclass('public.chatwoot_portal_hilos')
      and a.attname in ('conciliado_at', 'conciliado_hasta') and not a.attisdropped
  ) or pg_catalog.to_regprocedure('public.chatwoot_portal_estado_hilo(uuid, bigint)') is not null
    or pg_catalog.to_regprocedure('public.chatwoot_portal_guarda()') is not null then
    raise exception '0521: el estado y la guarda del portal ya existen; no se reaplica';
  end if;
end;
$preflight$;

-- ─── Columnas de la conciliación ─────────────────────────────────────────────
alter table public.chatwoot_portal_hilos
  add column conciliado_at    timestamptz,
  add column conciliado_hasta bigint
    check (conciliado_hasta is null or (conciliado_hasta > 0 and conciliado_hasta <= 2147483647));

comment on column public.chatwoot_portal_hilos.conciliado_at is
  'SDD-0586 E10-D40.5: la última conciliación completa del hilo. Nula: nunca. Ordena la cola del cron.';
comment on column public.chatwoot_portal_hilos.conciliado_hasta is
  'SDD-0586 E10-D40.5: marca de agua, el id de Chatwoot del mensaje más nuevo revisado en una conciliación completa. Nunca vuelve hacia atrás.';

-- ─── 1. El estado del hilo, desde el espejo ──────────────────────────────────
--
-- `resultado`:
--   actualizado  cambió `conversations.status` (`estado` es el nuevo)
--   igual        ya tenía ese estado
--   apagado      el flag `chatwoot_portal` está apagado
--   sin_hilo     la conversación de Chatwoot no es de un hilo vivo del portal de ese tenant
--   archivado    el hilo de Studio está archivado: no cambia (§10.5.10)
--   sin_espejo   el espejo todavía no tiene esa conversación
create or replace function public.chatwoot_portal_estado_hilo(
  p_tenant_id                uuid,
  p_chatwoot_conversation_id bigint
)
returns table (resultado text, estado text)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
#variable_conflict use_column
declare
  v_hilo      uuid;
  v_espejo    text;
  v_nuevo     public.conversation_status;
  v_actual    public.conversation_status;
  v_archivado timestamptz;
begin
  if p_tenant_id is null then
    raise exception 'chatwoot_portal_estado_hilo: falta el tenant' using errcode = '22023';
  end if;
  if p_chatwoot_conversation_id is null or p_chatwoot_conversation_id <= 0 or p_chatwoot_conversation_id > 2147483647 then
    raise exception 'chatwoot_portal_estado_hilo: id de Chatwoot inválido' using errcode = '22023';
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

  select cc.status into v_espejo
  from public.chatwoot_conversations cc
  where cc.tenant_id = p_tenant_id and cc.conversation_id = p_chatwoot_conversation_id;
  if v_espejo is null then
    resultado := 'sin_espejo';
    return next;
    return;
  end if;
  v_nuevo := case v_espejo
    when 'open'     then 'abierto'
    when 'resolved' then 'resuelto'
    when 'pending'  then 'pendiente'
    when 'snoozed'  then 'pendiente'
  end::public.conversation_status;

  select c.status, c.deleted_at into v_actual, v_archivado
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
  if v_actual = v_nuevo then
    resultado := 'igual';
    estado := v_actual::text;
    return next;
    return;
  end if;

  update public.conversations c set status = v_nuevo where c.id = v_hilo;
  resultado := 'actualizado';
  estado := v_nuevo::text;
  return next;
end;
$function$;

comment on function public.chatwoot_portal_estado_hilo(uuid, bigint) is
  'SDD-0586 E10-D39: lleva el estado de la conversación de Chatwoot al hilo del portal, leído del espejo chatwoot_conversations (ordenado por source_updated_at), nunca del evento: open → abierto, resolved → resuelto, pending y snoozed → pendiente. Escribe solo si cambia. No toca un hilo archivado, otro canal ni otro tenant, ni nada con el flag apagado.';

-- ─── 2. La conciliación ──────────────────────────────────────────────────────
--
-- Los hilos vivos del portal con el flag encendido: los que no están resueltos, sin ventana (un
-- agente puede contestar días después y perderse el webhook), y los resueltos con actividad en los
-- últimos 7 días. Primero los que nunca se conciliaron o hace más; el tope lo pone el cron.
create or replace function public.chatwoot_portal_por_conciliar(p_tenant_id uuid, p_limite integer default 20)
returns table (conversation_id uuid, chatwoot_conversation_id bigint, conciliado_hasta bigint)
language sql
stable
security definer
set search_path = ''
as $function$
  select hl.conversation_id, hl.chatwoot_conversation_id, hl.conciliado_hasta
  from public.chatwoot_portal_hilos hl
  join public.conversations c
    on c.id = hl.conversation_id and c.tenant_id = hl.tenant_id
   and c.channel = 'portal' and c.deleted_at is null
  left join public.chatwoot_conversations cc
    on cc.tenant_id = hl.tenant_id and cc.conversation_id = hl.chatwoot_conversation_id
  where hl.tenant_id = p_tenant_id
    and exists (
      select 1 from public.feature_flags f
      where f.tenant_id = p_tenant_id and f.key = 'chatwoot_portal' and f.enabled
    )
    and (
      c.status <> 'resuelto'
      or greatest(cc.last_activity_at, c.last_message_at) >= pg_catalog.now() - interval '7 days'
    )
  order by hl.conciliado_at asc nulls first, hl.conversation_id
  limit least(greatest(coalesce(p_limite, 20), 1), 100);
$function$;

comment on function public.chatwoot_portal_por_conciliar(uuid, integer) is
  'SDD-0586 E10-D40.5: los hilos vivos del portal a conciliar con el flag encendido: los no resueltos sin ventana y los resueltos con actividad en 7 días, primero los menos recientes en conciliarse. Devuelve la marca de agua de cada uno. Tope de 1 a 100.';

-- La conciliación de un hilo llegó a su marca (o al principio de la conversación): la marca sube al
-- mensaje más nuevo revisado, nunca baja, y queda la hora. Con `faltan_paginas` no se llama.
create or replace function public.chatwoot_portal_marcar_conciliado(
  p_tenant_id       uuid,
  p_conversation_id uuid,
  p_hasta           bigint
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
begin
  if p_tenant_id is null or p_conversation_id is null then
    raise exception 'chatwoot_portal_marcar_conciliado: faltan el tenant o el hilo' using errcode = '22023';
  end if;
  if p_hasta is not null and (p_hasta <= 0 or p_hasta > 2147483647) then
    raise exception 'chatwoot_portal_marcar_conciliado: marca inválida' using errcode = '22023';
  end if;
  update public.chatwoot_portal_hilos hl
  set conciliado_at    = pg_catalog.now(),
      conciliado_hasta = case
        when p_hasta is null then hl.conciliado_hasta
        else greatest(coalesce(hl.conciliado_hasta, p_hasta), p_hasta)
      end
  where hl.tenant_id = p_tenant_id and hl.conversation_id = p_conversation_id;
  return found;
end;
$function$;

comment on function public.chatwoot_portal_marcar_conciliado(uuid, uuid, bigint) is
  'SDD-0586 E10-D40.5: cierra una conciliación completa del hilo: conciliado_at ahora y la marca de agua conciliado_hasta al mayor entre la actual y p_hasta (nunca hacia atrás; nula la deja igual). Devuelve si encontró el hilo.';

-- ─── 3. La guarda de los hilos del portal ────────────────────────────────────
--
-- El flag del tenant de la sesión. `security definer` porque el trigger corre como `authenticated`
-- y su RLS no le muestra `feature_flags` de otro modo. Compara el tenant con el de la sesión: nadie
-- pregunta por el flag de otro tenant. Con dos membresías activas `get_user_tenant_id()` es nulo y
-- da `false`; esa escritura la corta igual la policy de la 0106, que usa el mismo nulo.
create or replace function public.chatwoot_portal_flag(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    p_tenant_id is not null
    and p_tenant_id = public.get_user_tenant_id()
    and exists (
      select 1 from public.feature_flags f
      where f.tenant_id = p_tenant_id and f.key = 'chatwoot_portal' and f.enabled
    ),
    false
  );
$function$;

comment on function public.chatwoot_portal_flag(uuid) is
  'SDD-0586 1c-2: ¿está chatwoot_portal encendido en el tenant de la sesión? Para la guarda de los hilos del portal. Con un tenant que no es el de la sesión, false.';

-- `security invoker` a propósito: dentro de una función `security definer` el `current_user` es su
-- dueño y la escritura pasa. No se usa `current_setting('role')`: dentro de `portal_post_message`
-- sigue diciendo `authenticated` y frenaría a las funciones legítimas.
create or replace function public.chatwoot_portal_guarda()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_table_name = 'conversations' then
    if tg_op = 'INSERT' then
      if new.channel = 'portal' then
        raise exception 'Un hilo del portal solo lo crea el portal.' using errcode = '42501';
      end if;
      return new;
    end if;
    if new.channel is distinct from old.channel and (old.channel = 'portal' or new.channel = 'portal') then
      raise exception 'Un hilo no se vuelve ni deja de ser del portal.' using errcode = '42501';
    end if;
    if old.channel = 'portal' and new.status is distinct from old.status
       and public.chatwoot_portal_flag(old.tenant_id) then
      raise exception 'El estado de este hilo del portal se cambia en la Bandeja de Chatwoot.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- conversation_messages
  if new.direction = 'out'
     and exists (
       select 1 from public.conversations c
       where c.id = new.conversation_id and c.channel = 'portal'
     )
     and public.chatwoot_portal_flag(new.tenant_id) then
    raise exception 'Este hilo del portal se responde desde la Bandeja de Chatwoot.' using errcode = '42501';
  end if;
  return new;
end;
$function$;

comment on function public.chatwoot_portal_guarda() is
  'SDD-0586 1c-2: guarda de los hilos del portal para authenticated (security invoker: las funciones security definer pasan). Siempre: ningún hilo se vuelve ni deja de ser portal. Con chatwoot_portal encendido: ningún saliente ni cambio de estado en un hilo del portal.';

create trigger chatwoot_portal_guarda_hilo
  before insert or update of channel, status on public.conversations
  for each row execute function public.chatwoot_portal_guarda();

create trigger chatwoot_portal_guarda_mensaje
  before insert on public.conversation_messages
  for each row execute function public.chatwoot_portal_guarda();

revoke all on function public.chatwoot_portal_estado_hilo(uuid, bigint) from public, anon, authenticated;
grant execute on function public.chatwoot_portal_estado_hilo(uuid, bigint) to service_role;
revoke all on function public.chatwoot_portal_por_conciliar(uuid, integer) from public, anon, authenticated;
grant execute on function public.chatwoot_portal_por_conciliar(uuid, integer) to service_role;
revoke all on function public.chatwoot_portal_marcar_conciliado(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.chatwoot_portal_marcar_conciliado(uuid, uuid, bigint) to service_role;
revoke all on function public.chatwoot_portal_flag(uuid) from public, anon;
grant execute on function public.chatwoot_portal_flag(uuid) to authenticated, service_role;
revoke all on function public.chatwoot_portal_guarda() from public, anon, authenticated;

-- ─── Postflight ──────────────────────────────────────────────────────────────
do $postflight$
declare
  v_firma text;
begin
  foreach v_firma in array array[
    'public.chatwoot_portal_estado_hilo(uuid, bigint)',
    'public.chatwoot_portal_por_conciliar(uuid, integer)',
    'public.chatwoot_portal_marcar_conciliado(uuid, uuid, bigint)',
    'public.chatwoot_portal_flag(uuid)'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure(v_firma)
        and p.prosecdef
        and p.proconfig @> array['search_path=""']
    ) then
      raise exception '0521: % no quedó security definer con search_path vacío', v_firma;
    end if;
    if pg_catalog.has_function_privilege('anon', v_firma, 'EXECUTE') then
      raise exception '0521: % no puede ser de anon', v_firma;
    end if;
  end loop;
  foreach v_firma in array array[
    'public.chatwoot_portal_estado_hilo(uuid, bigint)',
    'public.chatwoot_portal_por_conciliar(uuid, integer)',
    'public.chatwoot_portal_marcar_conciliado(uuid, uuid, bigint)'
  ] loop
    if pg_catalog.has_function_privilege('authenticated', v_firma, 'EXECUTE')
       or not pg_catalog.has_function_privilege('service_role', v_firma, 'EXECUTE') then
      raise exception '0521: % tiene que ser solo de service_role', v_firma;
    end if;
  end loop;
  if not pg_catalog.has_function_privilege('authenticated', 'public.chatwoot_portal_flag(uuid)', 'EXECUTE') then
    raise exception '0521: chatwoot_portal_flag tiene que ser de authenticated (la llama la guarda)';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure('public.chatwoot_portal_guarda()')
      and not p.prosecdef
      and p.proconfig @> array['search_path=""']
  ) then
    raise exception '0521: chatwoot_portal_guarda tiene que ser security invoker con search_path vacío';
  end if;
  if (
    select pg_catalog.count(*) from pg_catalog.pg_trigger t
    where t.tgfoid = pg_catalog.to_regprocedure('public.chatwoot_portal_guarda()')
      and not t.tgisinternal and t.tgenabled = 'O'
      and t.tgrelid in (pg_catalog.to_regclass('public.conversations'), pg_catalog.to_regclass('public.conversation_messages'))
  ) <> 2 then
    raise exception '0521: faltan los dos triggers de la guarda, activos';
  end if;
end;
$postflight$;
