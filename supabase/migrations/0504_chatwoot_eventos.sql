-- 0504 · SDD-0585 (E2, paso 2.3) · Eventos de Chatwoot: idempotencia, estado por conversación y cruce con el cliente.
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla exige el
--    OK nominal de Sam para este archivo y el runbook aplicar-migraciones-prod.
--
-- 1. `chatwoot_webhook_events`: una fila por evento procesado, con clave
--    semántica (E2-D18). La PK hace la idempotencia: un reintento de Chatwoot
--    no vuelve a avisar ni a contar. Solo service_role.
-- 2. `chatwoot_conversations`: el último estado conocido de cada conversación
--    (estado, no leídos, asignado, bandeja, actividad) y el `client_id` cuando
--    el teléfono del contacto cruza con UN solo cliente (E2-D19). Alimenta el
--    contador del sidebar y la tarjeta de la ficha. Lectura por tenant; entra en
--    `supabase_realtime` para el contador en vivo.
-- 3. `chatwoot_registrar_evento(...)`: registra el evento y aplica el estado en
--    una transacción. Un evento más viejo que lo guardado no pisa el estado. Con
--    `p_event_key` nulo es la reconciliación por API (E2-D22), que no deja evento.
--
-- Datos personales: NO se guarda texto de mensajes, nombres ni teléfonos. El
-- teléfono llega a la RPC reducido a sus últimos 10 dígitos, solo para el
-- cruce, y no se persiste.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.tenants') is null
     or pg_catalog.to_regclass('public.clients') is null
     or pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null then
    raise exception '0504 requiere tenants, clients y get_user_tenant_id()';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.clients'::regclass and attname = 'phone_last10' and not attisdropped
  ) then
    raise exception '0504 requiere clients.phone_last10 (0383)';
  end if;
  if pg_catalog.to_regclass('public.chatwoot_conversations') is not null
     or pg_catalog.to_regclass('public.chatwoot_webhook_events') is not null then
    raise exception '0504: las tablas de eventos de Chatwoot ya existen; no se reaplica';
  end if;
end;
$preflight$;

-- ─── 1. Eventos procesados ───────────────────────────────────────────────────
create table public.chatwoot_webhook_events (
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  event_key       text not null check (length(event_key) between 1 and 200),
  event           text not null check (event in ('message_created', 'conversation_status_changed')),
  conversation_id bigint not null check (conversation_id > 0),
  received_at     timestamptz not null default now(),
  primary key (tenant_id, event_key)
);

create index chatwoot_webhook_events_received_idx on public.chatwoot_webhook_events (received_at);

comment on table public.chatwoot_webhook_events is
  'SDD-0585 E2-D18: eventos de Chatwoot ya procesados (idempotencia por clave semántica). Sin payload, texto ni datos personales. Solo service_role. E10 (clasificar) se engancha después del registro.';

alter table public.chatwoot_webhook_events enable row level security;
create policy chatwoot_webhook_events_service_role_all on public.chatwoot_webhook_events
  for all to service_role using (true) with check (true);
revoke all on public.chatwoot_webhook_events from public, anon, authenticated;
grant all on public.chatwoot_webhook_events to service_role;

-- ─── 2. Estado por conversación ──────────────────────────────────────────────
create table public.chatwoot_conversations (
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  conversation_id   bigint not null check (conversation_id > 0),
  inbox_id          bigint,
  status            text not null check (status in ('open', 'resolved', 'pending', 'snoozed')),
  unread_count      integer not null default 0 check (unread_count >= 0),
  assignee_id       bigint,
  client_id         uuid references public.clients(id) on delete set null,
  last_activity_at  timestamptz,
  source_updated_at double precision not null default 0,
  updated_at        timestamptz not null default now(),
  primary key (tenant_id, conversation_id)
);

create index chatwoot_conversations_client_idx
  on public.chatwoot_conversations (tenant_id, client_id, last_activity_at desc)
  where client_id is not null;
create index chatwoot_conversations_unread_idx
  on public.chatwoot_conversations (tenant_id)
  where status = 'open' and unread_count > 0;

comment on table public.chatwoot_conversations is
  'SDD-0585 E2-D21/E2-D23: último estado conocido de cada conversación de Chatwoot (sin texto ni datos del contacto). client_id solo cuando el teléfono cruza con UN cliente. La escribe chatwoot_registrar_evento.';

alter table public.chatwoot_conversations enable row level security;
create policy chatwoot_conversations_select_tenant on public.chatwoot_conversations
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));
create policy chatwoot_conversations_service_role_all on public.chatwoot_conversations
  for all to service_role using (true) with check (true);
revoke all on public.chatwoot_conversations from public, anon, authenticated;
grant select on public.chatwoot_conversations to authenticated;
grant all on public.chatwoot_conversations to service_role;

do $realtime$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.chatwoot_conversations;
  end if;
end;
$realtime$;

-- ─── 3. Registrar un evento (o reconciliar) ──────────────────────────────────
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
  p_source_updated_at double precision
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

  -- Idempotencia: el mismo evento dos veces no hace nada la segunda.
  if p_event_key is not null then
    insert into public.chatwoot_webhook_events (tenant_id, event_key, event, conversation_id)
    values (p_tenant_id, p_event_key, p_event, p_conversation_id)
    on conflict on constraint chatwoot_webhook_events_pkey do nothing;
    get diagnostics v_filas = row_count;
    if v_filas = 0 then
      return query select false, false, null::uuid;
      return;
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

comment on function public.chatwoot_registrar_evento(uuid, text, text, bigint, bigint, text, integer, bigint, text, timestamptz, double precision) is
  'SDD-0585 E2-D18/E2-D19/E2-D22: registra un evento de Chatwoot (idempotente por event_key) y aplica el estado de la conversación si no es más viejo que lo guardado. event_key nulo = reconciliación por API. Solo service_role.';

revoke all on function public.chatwoot_registrar_evento(uuid, text, text, bigint, bigint, text, integer, bigint, text, timestamptz, double precision) from public;
revoke all on function public.chatwoot_registrar_evento(uuid, text, text, bigint, bigint, text, integer, bigint, text, timestamptz, double precision) from anon, authenticated;
grant execute on function public.chatwoot_registrar_evento(uuid, text, text, bigint, bigint, text, integer, bigint, text, timestamptz, double precision) to service_role;
