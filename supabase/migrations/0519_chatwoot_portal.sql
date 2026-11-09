-- 0519 · SDD-0586 (E10, paso 10.5, PR 1a) · Conversaciones del portal en Chatwoot: la ida.
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla, en prueba o en
--    producción, exige el OK nominal de Sam para este archivo y el runbook
--    aplicar-migraciones-prod.
--
-- La ida, de Studio a Chatwoot (spec §10.5.4: E10-D34, E10-D35 y el aviso de E10-D40;
-- la partición de la PR 1 está en §10.5.16):
--
-- 1. `chatwoot_portal_contactos`: el contacto de Chatwoot de cada ficha. El identificador al
--    azar se guarda ANTES de llamar a Chatwoot (va como `dtd-portal:<uuid>`), así que un
--    reintento lo busca en vez de crear otro contacto.
-- 2. `chatwoot_portal_hilos`: el hilo del portal en Studio ↔ su conversación en Chatwoot.
-- 3. `chatwoot_portal_salida`: la cola, una fila por mensaje. NO la llena un trigger:
--    `chatwoot_portal_tomar` busca el mensaje que le toca a cada hilo y lo reclama. El
--    mensaje del cliente nunca falla por Chatwoot (E10-D24): `portal_post_message` no cambia.
-- 4. `chatwoot_portal_estado`: el corte por tenant. Sin corte, la cola no manda nada; lo
--    anterior al corte lo trae la carga de §10.5.10.
-- 5. Funciones, solo para service_role: tomar, marcar, vincular y rezagados (el aviso a los
--    administradores, con solo números).
-- 6. Flag `chatwoot_portal`, APAGADO (E10-D42): `feature_flag_catalog()` redefinida desde su
--    ÚLTIMA definición (0503, medido en main y en todas las ramas el 2026-11-07) con una fila
--    más, y sembrada en los tenants que ya existen. Apagado, `chatwoot_portal_tomar` no
--    devuelve nada y `chatwoot_portal_rezagados` da cero.
--
-- Orden e idempotencia (E10-D34): por hilo, según `sent_at` y `id`. Un mensaje no sale
-- mientras quede uno anterior del mismo hilo sin enviar, y cada hilo tiene un solo envío en
-- curso. Cada mensaje va a Chatwoot con `source_id = dtd:<id del mensaje>`; después de un
-- intento incierto, `verificar` queda en verdadero y cada intento busca antes ese `source_id`.
-- Reintentos a 1, 2, 4, 8 y 15 minutos, y después cada 15, hasta 24 h desde el primer intento.
-- Pasado eso, «atascado»: el hilo se detiene y avisa `chatwoot_portal_rezagados`.
--
-- Datos personales: aquí solo hay ids, un identificador al azar, el source_id del contacto
-- en Chatwoot (nunca un teléfono), estados, fechas y un código de error. El nombre y el texto
-- del mensaje los lee el servidor de `conversation_messages` y salen a Chatwoot; no se copian.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_catalogo text[];
begin
  if pg_catalog.to_regclass('public.tenants') is null
     or pg_catalog.to_regclass('public.clients') is null
     or pg_catalog.to_regclass('public.conversations') is null
     or pg_catalog.to_regclass('public.conversation_messages') is null
     or pg_catalog.to_regclass('public.conversation_messages_external_idx') is null
     or pg_catalog.to_regclass('public.feature_flags') is null
     or pg_catalog.to_regclass('public.chatwoot_conversations') is null
     or pg_catalog.to_regprocedure('public.feature_flag_catalog()') is null
     or pg_catalog.to_regprocedure('public.chatwoot_registrar_evento(uuid, text, text, bigint, bigint, text, integer, bigint, text, timestamptz, double precision, bigint, boolean)') is null then
    raise exception '0519 requiere 0106 (conversaciones y su índice de external_msg_id), 0503 (feature_flag_catalog y feature_flags) y 0504 (chatwoot_conversations y chatwoot_registrar_evento)';
  end if;
  if pg_catalog.to_regclass('public.chatwoot_portal_salida') is not null
     or pg_catalog.to_regclass('public.chatwoot_portal_contactos') is not null
     or pg_catalog.to_regclass('public.chatwoot_portal_hilos') is not null
     or pg_catalog.to_regclass('public.chatwoot_portal_estado') is not null
     or exists (select 1 from public.feature_flag_catalog() c where c.key = 'chatwoot_portal') then
    raise exception '0519: los objetos del portal en Chatwoot ya existen; no se reaplica';
  end if;
  -- La redefinición copia la de 0503. Si otra migración cambió el catálogo después,
  -- copiar 0503 le borraría ese flag: se para y se rehace desde la definición vigente.
  select pg_catalog.array_agg(c.key) into v_catalogo from public.feature_flag_catalog() c;
  if pg_catalog.cardinality(v_catalogo) is distinct from 23 or not v_catalogo @> array[
    'customs_seniat', 'cargo_insurance', 'hs_autodetect', 'cn_translation', 'ai_copilot',
    'whatsapp', 'email_sequences', 'branding_xcliente', 'multi_currency', 'vault', 'audit_log',
    'api_public', 'webhooks', 'comments', 'consolidation_partial', 'portal_cliente',
    'mobile_operator', 'sustainability', 'backup_auto', 'sso', 'marketing_news',
    'dispatch.show_warehouse_location', 'chatwoot_inbox'
  ]::text[] then
    raise exception '0519: feature_flag_catalog() no es la de 0503; rehacer la redefinición desde la vigente';
  end if;
end;
$preflight$;

-- ─── 1. Tablas ───────────────────────────────────────────────────────────────

create table public.chatwoot_portal_contactos (
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  client_id           uuid not null references public.clients(id) on delete cascade,
  identificador       uuid not null default gen_random_uuid() unique,
  chatwoot_contact_id bigint check (chatwoot_contact_id > 0 and chatwoot_contact_id <= 2147483647),
  -- El source_id del contact_inbox de la bandeja API. Nunca un teléfono: solo dígitos se rechaza.
  chatwoot_source_id  text check (
    chatwoot_source_id ~ '^[A-Za-z0-9._:@=+/-]{1,255}$' and chatwoot_source_id !~ '^\+?[0-9]+$'
  ),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  primary key (tenant_id, client_id),
  unique (tenant_id, chatwoot_contact_id),
  check ((chatwoot_contact_id is null) = (chatwoot_source_id is null))
);

comment on table public.chatwoot_portal_contactos is
  'SDD-0586 E10-D35: el contacto de Chatwoot de cada ficha del portal. identificador (al azar) se guarda antes de llamar a Chatwoot y va como dtd-portal:<uuid>: un reintento lo busca en vez de crear otro. A Chatwoot solo van el nombre y ese identificador. Se borra con la ficha.';

create table public.chatwoot_portal_hilos (
  conversation_id          uuid primary key references public.conversations(id) on delete cascade,
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  chatwoot_conversation_id bigint not null check (chatwoot_conversation_id > 0 and chatwoot_conversation_id <= 2147483647),
  created_at               timestamptz not null default now(),
  unique (tenant_id, chatwoot_conversation_id)
);

comment on table public.chatwoot_portal_hilos is
  'SDD-0586 E10-D35: un hilo del portal en Studio es una conversación de Chatwoot. Si el hilo se archiva y el cliente vuelve a escribir, el hilo nuevo tiene su propia conversación.';

create table public.chatwoot_portal_salida (
  message_id          uuid primary key references public.conversation_messages(id) on delete cascade,
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  conversation_id     uuid not null references public.conversations(id) on delete cascade,
  estado              text not null check (estado in ('pendiente', 'enviando', 'enviado', 'cargado', 'atascado')),
  intentos            integer not null default 0 check (intentos >= 0),
  verificar           boolean not null default false,
  proximo_at          timestamptz,
  chatwoot_message_id bigint check (chatwoot_message_id > 0 and chatwoot_message_id <= 2147483647),
  error               text check (error ~ '^[a-z0-9_]{1,40}$'),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (estado <> 'enviado' or chatwoot_message_id is not null),
  check (estado <> 'pendiente' or proximo_at is not null)
);

create index chatwoot_portal_salida_pendiente_idx
  on public.chatwoot_portal_salida (tenant_id, proximo_at)
  where estado in ('pendiente', 'enviando', 'atascado');

comment on table public.chatwoot_portal_salida is
  'SDD-0586 E10-D34: la cola de la ida, una fila por mensaje del portal que se intentó mandar a Chatwoot. La llena chatwoot_portal_tomar, no un trigger. verificar = hubo un intento incierto: antes de reenviar se busca source_id = dtd:<message_id> en Chatwoot. error solo admite un código.';

create table public.chatwoot_portal_estado (
  tenant_id  uuid primary key references public.tenants(id) on delete cascade,
  corte      timestamptz,
  cargado_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.chatwoot_portal_estado is
  'SDD-0586 §10.5.6: desde cuándo manda la cola (corte). Lo anterior lo trae la carga de §10.5.10, que fija el corte; sin corte la cola no manda nada.';

alter table public.chatwoot_portal_contactos enable row level security;
alter table public.chatwoot_portal_hilos enable row level security;
alter table public.chatwoot_portal_salida enable row level security;
alter table public.chatwoot_portal_estado enable row level security;

create policy chatwoot_portal_contactos_service_role on public.chatwoot_portal_contactos
  for all to service_role using (true) with check (true);
create policy chatwoot_portal_hilos_service_role on public.chatwoot_portal_hilos
  for all to service_role using (true) with check (true);
create policy chatwoot_portal_salida_service_role on public.chatwoot_portal_salida
  for all to service_role using (true) with check (true);
create policy chatwoot_portal_estado_service_role on public.chatwoot_portal_estado
  for all to service_role using (true) with check (true);

revoke all on public.chatwoot_portal_contactos from public, anon, authenticated;
revoke all on public.chatwoot_portal_hilos from public, anon, authenticated;
revoke all on public.chatwoot_portal_salida from public, anon, authenticated;
revoke all on public.chatwoot_portal_estado from public, anon, authenticated;
grant all on public.chatwoot_portal_contactos to service_role;
grant all on public.chatwoot_portal_hilos to service_role;
grant all on public.chatwoot_portal_salida to service_role;
grant all on public.chatwoot_portal_estado to service_role;

-- ─── 2. Tomar el mensaje que le toca a cada hilo ─────────────────────────────
--
-- Solo el portal, solo mensajes del cliente, solo desde el corte, sin lo que vino de
-- Chatwoot (`chatwoot:` en external_msg_id) y sin las fichas borradas. Por hilo, la cabeza
-- es el mensaje más viejo que todavía no está enviado ni cargado; si espera su próximo
-- intento, está en curso o atascado, el hilo no da nada (no se salta al siguiente). El
-- bloqueo es `for no key update skip locked` sobre la fila del hilo: no choca con el
-- `for key share` de la clave foránea, así que no frena a `portal_post_message`. La garantía
-- de un solo envío en curso es el upsert con guarda: el segundo que llega no reclama.
create or replace function public.chatwoot_portal_tomar(
  p_tenant_id       uuid,
  p_limite          integer default 20,
  p_conversation_id uuid default null
)
returns table (
  mensaje_id         uuid,
  hilo_id            uuid,
  autor              text,
  cuerpo             text,
  enviado_at         timestamptz,
  intento            integer,
  verificar          boolean,
  identificador      uuid,
  contacto_id        bigint,
  contacto_source_id text,
  conversacion_id    bigint
)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
#variable_conflict use_column
declare
  v_corte  timestamptz;
  v_limite integer := least(greatest(coalesce(p_limite, 20), 1), 100);
  v_hilo   record;
begin
  if p_tenant_id is null then
    raise exception 'chatwoot_portal_tomar: falta el tenant' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.feature_flags f
    where f.tenant_id = p_tenant_id and f.key = 'chatwoot_portal' and f.enabled
  ) then
    return;
  end if;
  select e.corte into v_corte from public.chatwoot_portal_estado e where e.tenant_id = p_tenant_id;
  if v_corte is null then
    return;
  end if;

  for v_hilo in
    select c.id as hilo, cab.id as mensaje, cab.author_name, cab.body, cab.sent_at, c.client_id
    from public.conversations c
    cross join lateral (
      select m.id, m.author_name, m.body, m.sent_at, s.estado, s.proximo_at, s.updated_at as tomado_at
      from public.conversation_messages m
      left join public.chatwoot_portal_salida s on s.message_id = m.id
      where m.conversation_id = c.id
        and m.tenant_id = p_tenant_id
        and m.direction = 'in'
        and m.sent_at >= v_corte
        and (m.external_msg_id is null or m.external_msg_id not like 'chatwoot:%')
        and (s.estado is null or s.estado not in ('enviado', 'cargado'))
      order by m.sent_at, m.id
      limit 1
    ) cab
    where c.tenant_id = p_tenant_id
      and c.channel = 'portal'
      and (p_conversation_id is null or c.id = p_conversation_id)
      and exists (
        select 1 from public.clients cl
        where cl.id = c.client_id and cl.tenant_id = p_tenant_id and cl.deleted_at is null
      )
      and (cab.estado is null
           or (cab.estado = 'pendiente' and cab.proximo_at <= pg_catalog.now())
           or (cab.estado = 'enviando' and cab.tomado_at <= pg_catalog.now() - interval '5 minutes'))
    order by cab.sent_at, cab.id
    limit v_limite
    for no key update of c skip locked
  loop
    -- Reclamar. Un `enviando` colgado más de 5 min cuenta como incierto: pudo haber salido.
    insert into public.chatwoot_portal_salida as s (message_id, tenant_id, conversation_id, estado, intentos)
    values (v_hilo.mensaje, p_tenant_id, v_hilo.hilo, 'enviando', 1)
    on conflict (message_id) do update
      set estado     = 'enviando',
          intentos   = s.intentos + 1,
          verificar  = s.verificar or s.estado = 'enviando',
          proximo_at = null,
          updated_at = pg_catalog.now()
      where (s.estado = 'pendiente' and s.proximo_at <= pg_catalog.now())
         or (s.estado = 'enviando' and s.updated_at <= pg_catalog.now() - interval '5 minutes')
    returning s.intentos, s.verificar into intento, verificar;
    if not found then
      continue;
    end if;

    -- El identificador del contacto, una sola vez por ficha y antes de llamar a Chatwoot.
    insert into public.chatwoot_portal_contactos (tenant_id, client_id)
    values (p_tenant_id, v_hilo.client_id)
    on conflict (tenant_id, client_id) do nothing;

    select k.identificador, k.chatwoot_contact_id, k.chatwoot_source_id
      into identificador, contacto_id, contacto_source_id
    from public.chatwoot_portal_contactos k
    where k.tenant_id = p_tenant_id and k.client_id = v_hilo.client_id;

    select hl.chatwoot_conversation_id into conversacion_id
    from public.chatwoot_portal_hilos hl
    where hl.conversation_id = v_hilo.hilo and hl.tenant_id = p_tenant_id;

    mensaje_id := v_hilo.mensaje;
    hilo_id := v_hilo.hilo;
    autor := v_hilo.author_name;
    cuerpo := v_hilo.body;
    enviado_at := v_hilo.sent_at;
    return next;
  end loop;
end;
$function$;

comment on function public.chatwoot_portal_tomar(uuid, integer, uuid) is
  'SDD-0586 E10-D34: reclama, por hilo del portal, el mensaje del cliente que le toca ir a Chatwoot, el más viejo primero y uno por hilo. Apagado (chatwoot_portal) o sin corte, no devuelve nada. Devuelve el texto y el nombre porque el envío los necesita, y la hora del mensaje para acotar la búsqueda de su source_id; no devuelve el client_id.';

-- ─── 3. Cerrar un intento ────────────────────────────────────────────────────
--
-- Solo cierra el intento vigente (`p_intento`): si otro lo retomó por colgado, el viejo no
-- escribe. Un fallo espera 1, 2, 4, 8 y después 15 min; a las 24 h del primer intento queda
-- «atascado». `verificar` no se apaga hasta que el mensaje sale.
create or replace function public.chatwoot_portal_marcar(
  p_tenant_id           uuid,
  p_mensaje_id          uuid,
  p_intento             integer,
  p_ok                  boolean,
  p_chatwoot_message_id bigint default null,
  p_error               text default null,
  p_incierto            boolean default false
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_fila   public.chatwoot_portal_salida%rowtype;
  v_espera interval;
begin
  select * into v_fila
  from public.chatwoot_portal_salida s
  where s.message_id = p_mensaje_id and s.tenant_id = p_tenant_id
  for update;
  if not found or v_fila.estado <> 'enviando' or v_fila.intentos <> p_intento then
    return null;
  end if;

  if p_ok then
    if p_chatwoot_message_id is null or p_chatwoot_message_id <= 0 or p_chatwoot_message_id > 2147483647 then
      raise exception 'chatwoot_portal_marcar: un envío ok lleva el id del mensaje en Chatwoot' using errcode = '22023';
    end if;
    update public.chatwoot_portal_salida s
    set estado = 'enviado', chatwoot_message_id = p_chatwoot_message_id, error = null,
        proximo_at = null, updated_at = pg_catalog.now()
    where s.message_id = p_mensaje_id;
    return 'enviado';
  end if;

  if p_error is null or p_error !~ '^[a-z0-9_]{1,40}$' then
    raise exception 'chatwoot_portal_marcar: el error es un código' using errcode = '22023';
  end if;

  if pg_catalog.now() - v_fila.created_at >= interval '24 hours' then
    update public.chatwoot_portal_salida s
    set estado = 'atascado', proximo_at = null, error = p_error,
        verificar = v_fila.verificar or coalesce(p_incierto, false), updated_at = pg_catalog.now()
    where s.message_id = p_mensaje_id;
    return 'atascado';
  end if;

  v_espera := case v_fila.intentos
    when 1 then interval '1 minute'
    when 2 then interval '2 minutes'
    when 3 then interval '4 minutes'
    when 4 then interval '8 minutes'
    else interval '15 minutes'
  end;
  update public.chatwoot_portal_salida s
  set estado = 'pendiente', proximo_at = pg_catalog.now() + v_espera, error = p_error,
      verificar = v_fila.verificar or coalesce(p_incierto, false), updated_at = pg_catalog.now()
  where s.message_id = p_mensaje_id;
  return 'pendiente';
end;
$function$;

comment on function public.chatwoot_portal_marcar(uuid, uuid, integer, boolean, bigint, text, boolean) is
  'SDD-0586 E10-D34: cierra el intento vigente de un mensaje: enviado con el id de Chatwoot, o el código de error y el próximo intento (1, 2, 4, 8 y 15 min), o atascado a las 24 h. Devuelve el estado nuevo, o null si el intento ya no era el vigente.';

-- ─── 4. Guardar el vínculo ───────────────────────────────────────────────────
--
-- El contacto (siempre) y, si ya existe, la conversación del hilo. La ficha sale del hilo:
-- el servidor nunca maneja el client_id. Crea o completa la fila de chatwoot_conversations
-- (0504) con el client_id, para la Ficha DTD; un evento posterior sin teléfono lo conserva
-- (0504, `client_id = case when p_phone_last10 … else cc.client_id end`).
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

-- ─── 5. Lo que no llegó: el aviso con solo números (E10-D40) ─────────────────
create or replace function public.chatwoot_portal_rezagados(p_tenant_id uuid)
returns table (sin_llegar integer, atascados integer)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_corte timestamptz;
begin
  if not exists (
    select 1 from public.feature_flags f
    where f.tenant_id = p_tenant_id and f.key = 'chatwoot_portal' and f.enabled
  ) then
    return query select 0, 0;
    return;
  end if;
  select e.corte into v_corte from public.chatwoot_portal_estado e where e.tenant_id = p_tenant_id;
  if v_corte is null then
    return query select 0, 0;
    return;
  end if;

  return query
  select pg_catalog.count(*)::integer,
         (pg_catalog.count(*) filter (where s.estado = 'atascado'))::integer
  from public.conversation_messages m
  join public.conversations c
    on c.id = m.conversation_id and c.tenant_id = p_tenant_id and c.channel = 'portal'
  join public.clients cl
    on cl.id = c.client_id and cl.tenant_id = p_tenant_id and cl.deleted_at is null
  left join public.chatwoot_portal_salida s on s.message_id = m.id
  where m.tenant_id = p_tenant_id
    and m.direction = 'in'
    and m.sent_at >= v_corte
    and (m.external_msg_id is null or m.external_msg_id not like 'chatwoot:%')
    and (s.estado is null or s.estado not in ('enviado', 'cargado'))
    and m.sent_at <= pg_catalog.now() - interval '15 minutes';
end;
$function$;

comment on function public.chatwoot_portal_rezagados(uuid) is
  'SDD-0586 E10-D40: cuántos mensajes del portal llevan más de 15 min sin llegar a Chatwoot y cuántos de ellos están atascados. Solo números. Apagado o sin corte, cero.';

revoke all on function public.chatwoot_portal_tomar(uuid, integer, uuid) from public, anon, authenticated;
revoke all on function public.chatwoot_portal_marcar(uuid, uuid, integer, boolean, bigint, text, boolean) from public, anon, authenticated;
revoke all on function public.chatwoot_portal_vincular(uuid, uuid, bigint, text, bigint, bigint) from public, anon, authenticated;
revoke all on function public.chatwoot_portal_rezagados(uuid) from public, anon, authenticated;
grant execute on function public.chatwoot_portal_tomar(uuid, integer, uuid) to service_role;
grant execute on function public.chatwoot_portal_marcar(uuid, uuid, integer, boolean, bigint, text, boolean) to service_role;
grant execute on function public.chatwoot_portal_vincular(uuid, uuid, bigint, text, bigint, bigint) to service_role;
grant execute on function public.chatwoot_portal_rezagados(uuid) to service_role;

-- ─── 6. Catálogo de flags: la definición de 0503 más chatwoot_portal ─────────
create or replace function public.feature_flag_catalog()
returns table (key text, enabled boolean, description text)
language sql
immutable
set search_path = public, pg_catalog
as $$
  select *
  from (values
    ('customs_seniat',        false, 'Aduana SENIAT workflow'),
    ('cargo_insurance',       false, 'Seguro de carga'),
    ('hs_autodetect',         true,  'Auto-detección HS code'),
    ('cn_translation',        true,  'Traductor CN'),
    ('ai_copilot',            false, 'AI Copilot conversacional'),
    ('whatsapp',              true,  'Integración WhatsApp Business'),
    ('email_sequences',       false, 'Email sequences automáticas'),
    ('branding_xcliente',     true,  'Branding personalizado por cliente'),
    ('multi_currency',        true,  'Multi-moneda USD/VES/CNY'),
    ('vault',                 true,  'No-Olvidar (caja fuerte)'),
    ('audit_log',             true,  'Audit log con drill-down'),
    ('api_public',            false, 'API pública para terceros'),
    ('webhooks',              true,  'Webhooks salientes'),
    ('comments',              true,  'Comments con @menciones'),
    ('consolidation_partial', true,  'Consolidación parcial'),
    ('portal_cliente',        true,  'Portal del cliente externo'),
    ('mobile_operator',       false, 'App móvil operario CN/VE'),
    ('sustainability',        false, 'Reportes de sustentabilidad'),
    ('backup_auto',           true,  'Backup automático'),
    ('sso',                   false, 'Single Sign-On'),
    ('marketing_news',        false, 'Marketing · Generador de Noticias Web'),
    ('dispatch.show_warehouse_location', false,
     'Mostrar pasillo/zona/estante del paquete en bodeguero PWA. Activar solo cuando la bodega esté zoneada y los paquetes tengan warehouse_location populado.'),
    -- SDD-0585: la Bandeja de Chatwoot dentro de Studio. Apagada hasta que el
    -- token de la Platform App esté en el servidor y los agentes vinculados.
    ('chatwoot_inbox',        false, 'Bandeja de Chatwoot dentro de Studio'),
    -- SDD-0586 (10.5): el chat del portal en Chatwoot. Apagado de nacimiento:
    -- encenderlo es un OK nominal de Sam, con T1 a T4 publicados (E10-D42).
    ('chatwoot_portal',       false, 'Conversaciones del portal en Chatwoot')
  ) as t(key, enabled, description);
$$;

comment on function public.feature_flag_catalog() is
  'SDD-0240: catálogo canónico de feature flags (key, default, descripción). Fuente única del seed inicial y del trigger de tenant nuevo. Espejo en TS: lib/studio/feature-flags-types.ts (FEATURE_FLAG_DEFAULTS), verificado por feature-flags-catalog.test.ts. Última definición: 0519 (SDD-0586, chatwoot_portal).';

revoke all on function public.feature_flag_catalog() from public;
revoke all on function public.feature_flag_catalog() from anon;
grant execute on function public.feature_flag_catalog() to service_role;

insert into public.feature_flags (tenant_id, key, enabled, description)
select t.id, c.key, c.enabled, c.description
from public.tenants t
cross join public.feature_flag_catalog() c
where c.key = 'chatwoot_portal'
on conflict (tenant_id, key) do nothing;

-- ─── Postflight ──────────────────────────────────────────────────────────────
do $postflight$
declare
  v_firma text;
  v_tabla text;
begin
  foreach v_firma in array array[
    'public.chatwoot_portal_tomar(uuid, integer, uuid)',
    'public.chatwoot_portal_marcar(uuid, uuid, integer, boolean, bigint, text, boolean)',
    'public.chatwoot_portal_vincular(uuid, uuid, bigint, text, bigint, bigint)',
    'public.chatwoot_portal_rezagados(uuid)'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure(v_firma)
        and p.prosecdef
        and p.proconfig @> array['search_path=""']
    ) then
      raise exception '0519: % no quedó security definer con search_path vacío', v_firma;
    end if;
    if pg_catalog.has_function_privilege('anon', v_firma, 'EXECUTE')
       or pg_catalog.has_function_privilege('authenticated', v_firma, 'EXECUTE')
       or not pg_catalog.has_function_privilege('service_role', v_firma, 'EXECUTE') then
      raise exception '0519: % tiene que ser solo de service_role', v_firma;
    end if;
  end loop;
  foreach v_tabla in array array[
    'public.chatwoot_portal_contactos', 'public.chatwoot_portal_hilos',
    'public.chatwoot_portal_salida', 'public.chatwoot_portal_estado'
  ] loop
    if not (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = pg_catalog.to_regclass(v_tabla))
       or pg_catalog.has_table_privilege('anon', v_tabla, 'SELECT')
       or pg_catalog.has_table_privilege('authenticated', v_tabla, 'SELECT') then
      raise exception '0519: % tiene que tener RLS y ningún permiso para anon ni authenticated', v_tabla;
    end if;
  end loop;
  if not exists (select 1 from public.feature_flag_catalog() c where c.key = 'chatwoot_portal' and not c.enabled) then
    raise exception '0519: el catálogo no quedó con chatwoot_portal apagado';
  end if;
end;
$postflight$;
