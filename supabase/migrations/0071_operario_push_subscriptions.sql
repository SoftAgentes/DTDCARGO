-- ═════════════════════════════════════════════════════════════
-- Sprint 4 (Plan v3) · Push notifications background para operarios
-- ═════════════════════════════════════════════════════════════
-- El operario no tiene auth.uid() (PIN auth), así que sus subscriptions
-- de Web Push viven en tabla propia (NO user_notification_prefs, que es
-- de los users admin del Studio · SDD-0036).
--
-- Un operario puede tener N subscriptions (teléfono personal + tablet del
-- hub, etc). Cada una con su endpoint único. Push se envía a todas.
--
-- El outbox_push_events (Sprint F, 0066) ya soporta target_type='operario'.
-- Este sprint:
--   1. Tabla operario_push_subscriptions
--   2. RPC enqueue_operario_push (inserta en outbox)
--   3. RPC mark_push_sent / increment_push_attempts (worker drain)

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. operario_push_subscriptions                            ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.operario_push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  operario_id   uuid not null references public.operario_pins(id) on delete cascade,
  endpoint      text not null,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  failure_count int not null default 0,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  -- Un mismo endpoint es único globalmente (lo emite el push service del
  -- browser). Si el operario re-suscribe, upsert por endpoint.
  unique (endpoint)
);

comment on table public.operario_push_subscriptions is
  'Sprint 4 v3: Web Push subscriptions del operario (PIN auth, sin auth.uid). N por operario. Auto-unsubscribe en 410/404 desde el worker drain.';

create index if not exists operario_push_subs_operario_idx
  on public.operario_push_subscriptions (operario_id);

create index if not exists operario_push_subs_tenant_idx
  on public.operario_push_subscriptions (tenant_id);

alter table public.operario_push_subscriptions enable row level security;

-- Solo service_role (el operario no es authenticated · todo via RPC/endpoint
-- con admin client tras validar cookie dtd_op).
drop policy if exists "operario_push_subs_service_role" on public.operario_push_subscriptions;
create policy "operario_push_subs_service_role"
  on public.operario_push_subscriptions for all
  to service_role using (true) with check (true);

grant all on public.operario_push_subscriptions to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. enqueue_operario_push · inserta en outbox             ║
-- ╚═══════════════════════════════════════════════════════════╝
--
-- Encola un push para un operario. NO envía (eso lo hace el worker drain
-- TS). Idempotency suave: NO insertamos si ya hay un evento pending
-- idéntico (mismo target + payload->>'tag') en los últimos 60s · evita
-- duplicados si un trigger dispara dos veces.

create or replace function public.enqueue_operario_push(
  p_tenant_id   uuid,
  p_operario_id uuid,
  p_payload     jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid;
  v_tag     text := p_payload->>'tag';
  v_dupe    uuid;
begin
  -- Idempotency: si hay un pending con mismo target + tag reciente, skip
  if v_tag is not null then
    select id into v_dupe
      from public.outbox_push_events
     where target_type = 'operario'
       and target_id = p_operario_id
       and sent_at is null
       and payload->>'tag' = v_tag
       and created_at > now() - interval '60 seconds'
     limit 1;
    if v_dupe is not null then
      return v_dupe;
    end if;
  end if;

  insert into public.outbox_push_events
    (tenant_id, target_type, target_id, payload)
  values
    (p_tenant_id, 'operario', p_operario_id, p_payload)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.enqueue_operario_push(uuid, uuid, jsonb) is
  'Sprint 4 v3: encola un push para un operario en outbox_push_events. Idempotency 60s por tag. No envía · el worker drain TS lo hace.';

revoke all on function public.enqueue_operario_push(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_operario_push(uuid, uuid, jsonb) to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. mark_push_sent + bump_push_attempt (worker drain)     ║
-- ╚═══════════════════════════════════════════════════════════╝

create or replace function public.mark_push_sent(p_event_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.outbox_push_events set sent_at = now() where id = p_event_id;
$$;

create or replace function public.bump_push_attempt(p_event_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.outbox_push_events
     set attempts = attempts + 1
   where id = p_event_id;
$$;

revoke all on function public.mark_push_sent(uuid) from public, anon, authenticated;
revoke all on function public.bump_push_attempt(uuid) from public, anon, authenticated;
grant execute on function public.mark_push_sent(uuid) to service_role;
grant execute on function public.bump_push_attempt(uuid) to service_role;
