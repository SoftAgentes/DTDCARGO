-- ─────────────────────────────────────────────────────────────
-- SDD-0156 · Notificaciones al cliente configurables (journey China→VE)
--
-- Dos tablas:
--   1. client_notification_rules    · CONFIG por tenant (+ override por cliente):
--        por evento del journey → canal · ancla · offset (con signo) · texto ·
--        visibilidad en el portal. La edita el admin del Studio (RLS por tenant).
--   2. client_notification_schedule · AGENDA diferida (el motor la puebla):
--        al ocurrir un evento se calcula scheduled_for = ancla + offset y se
--        inserta una fila idempotente; el cron client-notifications-drain la
--        drena cuando vence y despacha por canal (email directo · push vía el
--        outbox durable outbox_push_events → push-drain). Solo service_role.
--
-- Prereqs:
--   - tenants (0007) · clients (markbox) · shipments (0002)
--   - helper public.get_user_tenant_id() (Studio)
--   - outbox_push_events + enqueue_user_push (0066/0216) · reusados por el drain
--
-- RLS:
--   - rules    → por tenant (mismo molde que mail_scheduled/mail_config); el
--                gating a rol admin lo hace la app (regla de la casa).
--   - schedule → service_role only (cola del motor/cron; el cliente NO la lee,
--                los avisos llegan por email/push).
--
-- Seed: reglas default = comportamiento de HOY (email en in_warehouse / shipped /
--   out_for_delivery / delivered). arrived_destination NO se siembra: sigue por
--   su template shipment_arrived (fireMailEvent) para no duplicar correos.
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. client_notification_rules · configuración               ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.client_notification_rules (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  -- null = regla DEFAULT del tenant; no-null = override para ese cliente.
  client_id         uuid references public.clients(id) on delete cascade,
  trigger_event     text not null,
  channel           text not null default 'email'
                       check (channel in ('email', 'push', 'both', 'none')),
  -- qué timestamp ancla el offset: el hito, o el ETA/ETD del envío.
  anchor            text not null default 'event'
                       check (anchor in ('event', 'eta', 'etd')),
  -- con signo: +7200 = +5 días DESPUÉS del ancla; -7200 = 5 días ANTES.
  offset_minutes    int not null default 0,
  template_key      text,
  -- override de texto (si null → copy default del evento, code-side).
  custom_title      text,
  custom_body       text,
  visible_in_portal boolean not null default true,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.client_notification_rules is
  'SDD-0156: config de avisos al cliente por evento del journey. client_id null = default del tenant; no-null = override por cliente. RLS por tenant; gating admin en la app.';
comment on column public.client_notification_rules.offset_minutes is
  'Corrimiento CON SIGNO respecto al ancla (event/eta/etd). +7200 = +5 días; -7200 = 5 días antes.';
comment on column public.client_notification_rules.visible_in_portal is
  'Si el hito se muestra en el stepper del portal del cliente (Slice D). false + template de cobro = "ocultar aduana y disparar cobro anticipado".';

-- Una regla por evento por alcance: un DEFAULT por (tenant, evento) y un OVERRIDE
-- por (tenant, cliente, evento). Índices parciales porque NULL client_id no
-- colisiona por sí solo en un UNIQUE normal.
create unique index client_notif_rules_default_uniq
  on public.client_notification_rules (tenant_id, trigger_event)
  where client_id is null;
create unique index client_notif_rules_override_uniq
  on public.client_notification_rules (tenant_id, client_id, trigger_event)
  where client_id is not null;
-- Resolución override→default: el motor busca por (tenant, evento) + client_id.
create index client_notif_rules_lookup_idx
  on public.client_notification_rules (tenant_id, trigger_event, active);

alter table public.client_notification_rules enable row level security;

-- Tenant-scoped para authenticated (rol admin lo gatea la app). El motor usa
-- service_role (bypassa RLS).
create policy "client_notif_rules_by_tenant"
  on public.client_notification_rules for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

grant select, insert, update, delete on public.client_notification_rules to authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. client_notification_schedule · agenda diferida          ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.client_notification_schedule (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  shipment_id    uuid not null references public.shipments(id) on delete cascade,
  -- denormalizado (mismo patrón de RLS del portal que shipment_events).
  client_markbox text not null,
  -- restrict (no cascade): borrar una regla con agenda 'sent'/futura se bloquea →
  -- la app debe cancelar (status='canceled') o desactivar la regla primero. Así
  -- el historial de avisos enviados y las cancelaciones quedan rastreables.
  rule_id        uuid not null references public.client_notification_rules(id) on delete restrict,
  trigger_event  text not null,
  channel        text not null check (channel in ('email', 'push', 'both')),
  template_key   text,
  custom_title   text,
  custom_body    text,
  -- = ancla + offset, calculado al programar.
  scheduled_for  timestamptz not null,
  payload        jsonb not null default '{}'::jsonb,
  status         text not null default 'scheduled'
                   check (status in ('scheduled', 'sent', 'skipped', 'canceled', 'failed')),
  sent_at        timestamptz,
  attempts       int not null default 0,
  error          text,
  created_at     timestamptz not null default now()
);

comment on table public.client_notification_schedule is
  'SDD-0156: cola diferida de avisos al cliente. El motor inserta (scheduled_for=ancla+offset); el cron client-notifications-drain despacha los scheduled con scheduled_for<=now(). service_role only.';

-- Idempotencia: no re-programar el mismo evento para el mismo envío desde la
-- misma regla (mismo criterio "no re-notificar" que shipment_events.notified_at).
create unique index client_notif_sched_idem_uniq
  on public.client_notification_schedule (shipment_id, trigger_event, rule_id)
  where status <> 'canceled';

-- Cola del cron: los pendientes vencidos, en orden.
create index client_notif_sched_due_idx
  on public.client_notification_schedule (scheduled_for)
  where status = 'scheduled';

create index client_notif_sched_shipment_idx
  on public.client_notification_schedule (shipment_id);

alter table public.client_notification_schedule enable row level security;

-- Solo el motor/cron (service_role). El cliente NO lee esta cola.
create policy "client_notif_sched_service_role_all"
  on public.client_notification_schedule for all to service_role
  using (true) with check (true);

grant all on public.client_notification_schedule to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. Seed · reglas default = comportamiento de HOY           ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Email inmediato (offset 0, ancla event) en los 4 hitos que hoy avisa
-- notifyShipmentMilestoneToClient. arrived_destination queda fuera (su template
-- shipment_arrived ya avisa). Idempotente: on conflict con el índice de default.
insert into public.client_notification_rules
  (tenant_id, trigger_event, channel, anchor, offset_minutes, visible_in_portal, active)
select t.id, e.evt, 'email', 'event', 0, true, true
from public.tenants t
cross join (values
  ('status:in_warehouse'),
  ('status:shipped'),
  ('status:out_for_delivery'),
  ('status:delivered')
) as e(evt)
on conflict (tenant_id, trigger_event) where client_id is null do nothing;

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0247_client_notifications.sql
-- ─────────────────────────────────────────────────────────────
