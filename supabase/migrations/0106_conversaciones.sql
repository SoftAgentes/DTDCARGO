-- ─────────────────────────────────────────────────────────────
-- SDD-0056 · Conversaciones · Fase 1 (núcleo + canal Portal)
--
-- Bandeja unificada de atención al cliente: un hilo (`conversations`) por
-- cliente×canal (decisión #1 del founder: granularidad cliente×canal en datos,
-- vista unificable por cliente en la UI) + mensajes (`conversation_messages`)
-- inbound/outbound. Fase 1 cablea el canal `portal` (el cliente escribe desde el
-- portal Supabase-backed) + respuesta del agente (opcional por Resend). Email
-- (Fase 2) y WhatsApp (Fase 3) quedan diferidos: el enum `channel` ya los
-- contempla pero no hay ingesta.
--
-- - RLS por `tenant_id` (patrón estándar 0006/0097): el EQUIPO del tenant ve y
--   responde; el CLIENTE del portal NUNCA lee estas tablas directo (solo escribe
--   vía la RPC SECURITY DEFINER `portal_post_message`).
-- - FKs reales: `client_id → clients`, `conversation_id → conversations` (cascade).
-- - `external_msg_id` unique parcial por tenant → idempotencia de inbound
--   (webhooks de Fases 2-3 no duplican).
-- - `unread_count` / `last_message_at` denormalizados (orden + badges sin
--   agregaciones caras). Los mantiene la RPC inbound + las actions de reply.
-- - Correlativo de display `C-YYYY-NNNN` vía RPC `next_conversation_ref` (barato:
--   MAX(num)+1 por tenant·año, mismo patrón que next_markbox/next_consolidation_ref).
--
-- Sin DDL destructivo. NO se aplica a prod desde acá (lo hace el founder / MCP).
-- Número 0106 (0104/0105 tomados por otras ramas).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. ENUMS                                                   ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Canal de la conversación. portal = Fase 1; email/whatsapp = Fases 2-3.
create type conversation_channel as enum ('whatsapp', 'email', 'portal');

-- Estado operativo del hilo.
create type conversation_status as enum ('abierto', 'pendiente', 'resuelto');

-- Dirección del mensaje: in = del cliente · out = del agente DTD.
create type conversation_direction as enum ('in', 'out');

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. TABLA conversations · 1 hilo por cliente×canal          ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  ref             text,                                  -- "C-YYYY-NNNN" (display, opcional)
  channel         conversation_channel not null,
  status          conversation_status not null default 'abierto',
  is_case         boolean not null default false,        -- reclamo / prioridad alta
  assigned_to     uuid references auth.users(id) on delete set null,  -- agente
  subject         text,
  last_message_at timestamptz,                           -- denormalizado (orden)
  unread_count    int not null default 0,                -- mensajes inbound sin leer
  external_ref    text,                                  -- id del chat WA / thread email (Fases 2-3)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,                           -- soft delete (auditable)
  -- Decisión #1: granularidad cliente×canal → 1 hilo VIVO por (tenant,client,channel).
  -- Parcial por deleted_at: un hilo archivado no bloquea reabrir.
  constraint conversations_unread_nonneg check (unread_count >= 0)
);

comment on table public.conversations is
  'SDD-0056: hilo de atención al cliente, 1 por cliente×canal (decisión #1). RLS por tenant_id — equipo del tenant. unread_count/last_message_at denormalizados. ref = correlativo de display C-YYYY-NNNN. Soft delete via deleted_at. portal cableado en Fase 1; email/whatsapp en Fases 2-3.';

-- Un solo hilo VIVO por cliente×canal (decisión #1). Índice único parcial.
create unique index conversations_client_channel_live_idx
  on public.conversations (tenant_id, client_id, channel)
  where deleted_at is null;

create index conversations_tenant_status_idx
  on public.conversations (tenant_id, status, last_message_at desc)
  where deleted_at is null;

create index conversations_tenant_assigned_idx
  on public.conversations (tenant_id, assigned_to)
  where deleted_at is null;

-- GRANTS explícitos (auto-expose new tables OFF en el proyecto)
grant select, insert, update, delete on public.conversations to authenticated;
grant all on public.conversations to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. TABLA conversation_messages · mensajes in/out          ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.conversation_messages (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  direction        conversation_direction not null,
  author_name      text,                                 -- nombre legible (cliente o agente)
  author_user_id   uuid references auth.users(id) on delete set null,  -- si out
  body             text not null,
  external_msg_id  text,                                 -- id del proveedor (idempotencia inbound)
  sent_at          timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

comment on table public.conversation_messages is
  'SDD-0056: mensajes de un hilo. direction in=cliente / out=agente. external_msg_id = id del proveedor para idempotencia de inbound (unique parcial por tenant). RLS por tenant_id. Cascade al borrar la conversation.';

create index conversation_messages_conv_idx
  on public.conversation_messages (conversation_id, sent_at);

-- Idempotencia de inbound: el mismo external_msg_id no se inserta dos veces por
-- tenant. Parcial (solo cuando hay id) → outbound (sin id) no choca.
create unique index conversation_messages_external_idx
  on public.conversation_messages (tenant_id, external_msg_id)
  where external_msg_id is not null;

grant select, insert, update, delete on public.conversation_messages to authenticated;
grant all on public.conversation_messages to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. Trigger updated_at (reusa touch_updated_at de 0002)    ║
-- ╚═══════════════════════════════════════════════════════════╝
create trigger conversations_touch
  before update on public.conversations
  for each row execute function public.touch_updated_at();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. RLS · fail-closed por tenant (patrón 0097)             ║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

-- Equipo del tenant: CRUD por tenant (lectura solo no-borradas).
create policy "conversations by tenant"
  on public.conversations for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

create policy "conversations service_role all"
  on public.conversations for all
  to service_role
  using (true)
  with check (true);

-- Mensajes: el equipo ve/escribe los de los hilos de su tenant.
create policy "conversation_messages by tenant"
  on public.conversation_messages for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

create policy "conversation_messages service_role all"
  on public.conversation_messages for all
  to service_role
  using (true)
  with check (true);

-- NOTA: el CLIENTE del portal NO tiene policy de lectura/escritura directa acá.
-- Su único punto de entrada es la RPC SECURITY DEFINER `portal_post_message`
-- (sección 7), que valida su identidad vía get_portal_client_id().

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. RPC next_conversation_ref · correlativo C-YYYY-NNNN     ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Patrón next_markbox/next_consolidation_ref: MAX(num)+1 por tenant·año.
-- Barato (un scan parcial). Se llama al crear un hilo nuevo.
create or replace function public.next_conversation_ref(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year   text := to_char(now(), 'YYYY');
  v_max    int;
  v_padded text;
begin
  select coalesce(max((regexp_match(ref, '^C-' || v_year || '-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.conversations
  where tenant_id = p_tenant_id;

  v_padded := lpad(v_max::text, 4, '0');
  return 'C-' || v_year || '-' || v_padded;
end;
$$;

comment on function public.next_conversation_ref is
  'SDD-0056: próximo correlativo de display C-YYYY-NNNN para un tenant·año. MAX(num)+1, padding 4.';

grant execute on function public.next_conversation_ref(uuid) to authenticated;
grant execute on function public.next_conversation_ref(uuid) to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 7. RPC portal_post_message · canal Portal (inbound)       ║
-- ╚═══════════════════════════════════════════════════════════╝
-- El CLIENTE del portal escribe desde app/portal. Esta RPC SECURITY DEFINER es
-- su ÚNICO punto de entrada (no tiene policy directa sobre las tablas):
--   1. resuelve su client_id vía get_portal_client_id() (auth.uid del portal)
--   2. lee tenant_id + name + markbox del cliente
--   3. crea/reusa el hilo cliente×canal='portal' (decisión #1)
--   4. inserta el mensaje direction='in', bump unread_count + last_message_at
--   5. reabre el hilo si estaba 'resuelto' (volvió a escribir)
-- Devuelve el id del hilo. Defiende en la DB (no solo en la action): cubre
-- cualquier cliente del portal sin exponer las tablas a su rol.
create or replace function public.portal_post_message(p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_tenant    uuid;
  v_name      text;
  v_conv_id   uuid;
  v_ref       text;
  v_body      text := trim(coalesce(p_body, ''));
begin
  if v_body = '' then
    raise exception 'El mensaje no puede estar vacío';
  end if;
  if length(v_body) > 4000 then
    raise exception 'El mensaje es demasiado largo (máx 4000)';
  end if;

  -- Identidad del portal (auth.uid → client_users activo → client_id).
  v_client_id := public.get_portal_client_id();
  if v_client_id is null then
    raise exception 'No autorizado: la sesión no es un cliente del portal' using errcode = '42501';
  end if;

  select c.tenant_id, c.name into v_tenant, v_name
  from public.clients c
  where c.id = v_client_id and c.deleted_at is null;
  if v_tenant is null then
    raise exception 'Cliente no encontrado';
  end if;

  -- Hilo vivo cliente×canal='portal' (decisión #1).
  select id into v_conv_id
  from public.conversations
  where tenant_id = v_tenant and client_id = v_client_id
    and channel = 'portal' and deleted_at is null
  limit 1;

  if v_conv_id is null then
    v_ref := public.next_conversation_ref(v_tenant);
    insert into public.conversations (tenant_id, client_id, ref, channel, status, last_message_at, unread_count)
    values (v_tenant, v_client_id, v_ref, 'portal', 'abierto', now(), 0)
    returning id into v_conv_id;
  end if;

  insert into public.conversation_messages (tenant_id, conversation_id, direction, author_name, body, sent_at)
  values (v_tenant, v_conv_id, 'in', v_name, v_body, now());

  -- Bump denormalizados + reabrir si estaba resuelto (el cliente reescribió).
  update public.conversations
  set last_message_at = now(),
      unread_count = unread_count + 1,
      status = case when status = 'resuelto' then 'abierto' else status end
  where id = v_conv_id;

  return v_conv_id;
end;
$$;

comment on function public.portal_post_message is
  'SDD-0056 Fase 1 (canal Portal): el cliente del portal manda un mensaje inbound. Resuelve su client_id vía get_portal_client_id(), crea/reusa el hilo cliente×canal=portal, inserta direction=in, bump unread/last_message_at, reabre si estaba resuelto. SECURITY DEFINER — único punto de entrada del cliente (sin policy directa sobre las tablas).';

grant execute on function public.portal_post_message(text) to authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 8. Realtime · publicación supabase_realtime               ║
-- ╚═══════════════════════════════════════════════════════════╝
-- La bandeja del Studio subscribe (useRealtimeRefresh) a estas tablas para
-- refrescar en vivo cuando entra un mensaje del portal (patrón Despacho, 0043).
-- RLS filtra los payloads por tenant automáticamente. Idempotente.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'conversation_messages'
  ) then
    alter publication supabase_realtime add table public.conversation_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0106_conversaciones.sql
-- Aplicar con: supabase migration apply 0106 · o MCP apply_migration
-- ─────────────────────────────────────────────────────────────
