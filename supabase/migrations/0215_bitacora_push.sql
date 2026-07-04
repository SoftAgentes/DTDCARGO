-- ─────────────────────────────────────────────────────────────
-- SDD-0146 · Bitácora — push multi-dispositivo (Fase 5)
--
-- Hoy el push de un user (admin del Studio, SDD-0036) vive en UN jsonb
-- (`user_notification_prefs.push_subscription`) → un solo dispositivo. Esta
-- migración suma la tabla `user_push_subscriptions` (N dispositivos por user,
-- espejo de `operario_push_subscriptions` de 0071) + la RPC `enqueue_user_push`
-- (clon de `enqueue_operario_push`, target_type 'user') para que el push del
-- digest y de las asignaciones de Bitácora sea durable (outbox 0066 + drain).
--
-- El jsonb legacy NO se borra: queda como fallback de LECTURA en
-- sendPushToUserDevices (los users que aún no re-suscribieron siguen recibiendo
-- push). El backfill copia lo que ya está guardado ahí a la tabla nueva.
--
-- Moldes: 0071 (tabla subs + enqueue RPC), 0066 (outbox_push_events, target_type
-- 'user' YA en el CHECK), 0028 (user_notification_prefs).
--
-- Aditiva. Sin DDL destructivo. GRANT base JUNTO a la RLS. REVOKE public/anon
-- en la función. NO aplicar a prod (lo hace el founder).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. user_push_subscriptions · N dispositivos por user       ║
-- ╚═══════════════════════════════════════════════════════════╝
-- El user SÍ es authenticated (auth.uid) → RLS self (a diferencia del operario,
-- que es PIN sin auth.uid y por eso su tabla es service_role-only). `endpoint`
-- único global (lo emite el push service del browser): re-suscribir = upsert por
-- endpoint. `subscription` guarda el PushSubscription completo (endpoint + keys).
create table if not exists public.user_push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  endpoint      text not null,
  subscription  jsonb not null,                             -- { endpoint, keys:{p256dh,auth}, expirationTime? }
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  unique (endpoint)
);

comment on table public.user_push_subscriptions is
  'SDD-0146 Fase 5: Web Push subscriptions de un user (auth.uid) del Studio. N por user (teléfono + desktop). Espejo de operario_push_subscriptions (0071) pero RLS self. Auto-unsubscribe en 410/404 desde el drain. El jsonb legacy user_notification_prefs.push_subscription queda de fallback de lectura.';

create index if not exists user_push_subs_user_idx
  on public.user_push_subscriptions (user_id);

create index if not exists user_push_subs_tenant_idx
  on public.user_push_subscriptions (tenant_id);

alter table public.user_push_subscriptions enable row level security;

-- RLS self: cada user gestiona SOLO sus propias subscriptions. SIN policy UPDATE
-- (una re-suscripción = delete-then-insert por endpoint desde el route con
-- identidad verificada; el last_used_at lo estampa el drain con service_role).
create policy "user_push_subs self select"
  on public.user_push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "user_push_subs self insert"
  on public.user_push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "user_push_subs self delete"
  on public.user_push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "user_push_subs service_role all"
  on public.user_push_subscriptions for all
  to service_role using (true) with check (true);

-- GRANT base JUNTO a la RLS (auto-expose OFF). Sin UPDATE para authenticated
-- (no hay policy UPDATE; el drain usa service_role).
grant select, insert, delete on public.user_push_subscriptions to authenticated;
grant all on public.user_push_subscriptions to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. enqueue_user_push · inserta en outbox (target 'user')   ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Clon EXACTO de enqueue_operario_push (0071) con target_type = 'user'.
-- Idempotency suave: NO inserta si ya hay un pending idéntico (mismo target +
-- payload->>'tag') en los últimos 60s (evita duplicados de doble-dispatch).
-- SECURITY DEFINER porque inserta en outbox_push_events (service_role-only RLS).
-- REVOKE public/anon/authenticated + GRANT solo service_role: el browser NUNCA
-- encola (lo hacen el server action / cron con admin client).
create or replace function public.enqueue_user_push(
  p_tenant_id uuid,
  p_user_id   uuid,
  p_payload   jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_tag  text := p_payload->>'tag';
  v_dupe uuid;
begin
  if v_tag is not null then
    select id into v_dupe
      from public.outbox_push_events
     where target_type = 'user'
       and target_id = p_user_id
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
    (p_tenant_id, 'user', p_user_id, p_payload)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.enqueue_user_push(uuid, uuid, jsonb) is
  'SDD-0146 Fase 5: encola un push para un user (auth.uid) en outbox_push_events (target_type user). Idempotency 60s por tag. No envía · el drain TS lo hace. service_role only (el browser no encola).';

revoke all on function public.enqueue_user_push(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_user_push(uuid, uuid, jsonb) to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. Backfill · jsonb legacy → user_push_subscriptions       ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Copia las subscriptions ya guardadas en user_notification_prefs.push_subscription
-- a la tabla nueva. tenant_id resuelto por JOIN a user_tenants ACTIVOS; si el
-- user tiene varias filas de tenant, se toma UNA determinista (menor tenant_id).
-- El jsonb legacy NO se toca (sigue de fallback de lectura). on conflict por
-- endpoint no duplica si se re-corre.
insert into public.user_push_subscriptions (tenant_id, user_id, endpoint, subscription, created_at)
select
  t.tenant_id,
  unp.user_id,
  unp.push_subscription->>'endpoint',
  unp.push_subscription,
  now()
from public.user_notification_prefs unp
join lateral (
  select ut.tenant_id
    from public.user_tenants ut
   where ut.user_id = unp.user_id
     and ut.disabled_at is null
   order by ut.tenant_id
   limit 1
) t on true
where unp.push_subscription is not null
  and nullif(unp.push_subscription->>'endpoint', '') is not null
on conflict (endpoint) do nothing;

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0215_bitacora_push.sql
-- ─────────────────────────────────────────────────────────────
