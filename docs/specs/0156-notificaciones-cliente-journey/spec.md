---
sdd: "0156"
title: "Notificaciones al cliente configurables — journey China→Venezuela"
status: in-progress
author: "Sam (founder) + agente push-cliente"
created: 2026-07-17
updated: 2026-07-17
supersedes: null
superseded_by: null
related: ["0132", "0042", "0101", "0056", "0134", "0154"]
confidencialidad: interno
---

# DTD-0156 — Notificaciones al cliente configurables (journey China→VE)

> **Número:** máx en `docs/specs` = 0155 → **0156 libre** (2026-07-17).
> Absorbe el pendiente **"aviso al cliente en recepción"** de SDD-0154 y el gap #1 de
> `project_flujo_china_ve_push_gap` ("push de estado al cliente = manual por WhatsApp/WeChat").

## Contexto

Hoy el único punto que avisa al cliente es `transitionShipment`
(`app/studio/(app)/tracking/[id]/actions.ts`): al cambiar `shipments.status` dispara,
**inline y sin durabilidad**, un correo por hito (`notifyShipmentMilestoneToClient`,
set `in_warehouse / shipped / out_for_delivery / delivered`) + el template de arribo.
Tres límites duros:

1. **Todo es "al instante".** No se puede decir "avisá +2 días después de consolidar" ni
   "avisá +5 días respecto al ETA". El founder lo necesita para manejar la ansiedad del
   cliente (adelantarse o esperar según el hito).
2. **El set de hitos, canales y textos está hardcodeado.** No hay config por tenant/cliente:
   qué evento avisa, por qué canal, con qué texto, y si un estado se **muestra u oculta** en
   el portal.
3. **El push al cliente se manda inline** (cuando exista canal push): sin outbox → un crash o
   cold-start pierde el aviso. Los operarios YA tienen outbox durable; el cliente no.

Ejemplos reales del founder que el modelo debe expresar:
- Al **ETA** del tránsito directo, avisar "va llegando" con **+5 días** de corrimiento.
- Al **consolidar**, avisar **+2 días después** (no al instante).
- Al **llegar a aduana**, **NO** mostrar "llegó": **ocultar** ese estado y en su lugar disparar
  una alerta de **cobro anticipado**.

## Objetivo

Un **motor de notificaciones al cliente configurable de punta a punta**: por cada evento del
journey, el founder define **canal · corrimiento (offset) · texto · visibilidad**, y el sistema
programa el aviso en una **agenda diferida** que un cron drena de forma **durable**,
reusando la infra que ya existe (outbox de push, Resend, shipment_events).

## No-objetivos

- **WhatsApp saliente al cliente** (no conectado; solo links `wa.me`). Telegram = solo equipo.
- Reescribir `buildTimeline` / el stepper del portal (SDD-0132): se **conserva**; solo se le
  agrega una **capa de visibilidad** por tenant (ocultar hitos).
- Motor de cobranza completo (recordatorios 15d/7d con saldo): el disparo de "cobro anticipado"
  en aduana entra acá; la cadencia de recobro es su propia spec.
- Config por cliente individual en V1 (el esquema lo permite; se difiere el UI — ver §Decisiones).

## Qué se reusa (mapeado 2026-07-17, con file:line)

| Pieza | Ubicación | Rol en 0156 |
|---|---|---|
| Web push VAPID | `lib/studio/notify/vapid.ts` | firma de push (sin cambios) |
| Sender push a user | `lib/studio/notify/send-user-push.ts` (`sendPushToUserDevices`) | entrega push al cliente (es `auth.user`) |
| **Outbox durable** | tabla `outbox_push_events` (0066) + RPC `enqueue_user_push` (0216) + `drainOperarioPushOutbox` + cron `/api/cron/push-drain` | **durabilidad de la ENTREGA del push** (cierra hueco #2) |
| Push del portal cliente | `app/portal/_components/PortalPushOptIn.tsx` · `app/api/portal/push/subscribe/route.ts` → `user_push_subscriptions` | el cliente YA puede suscribirse a push (la nota "diferido" de 0132 quedó vieja) |
| Email Resend | `lib/studio/mail/send-email.ts` + `mail-rule-engine.ts` (`fireMailEvent`) + `mail_templates` | entrega email + templates por evento |
| Envío diferido email | `mail_scheduled` (0207) + cron `mail-scheduled` | **arte previo** de cron-drena-cola; 0156 generaliza a offset-relativo multi-canal |
| Fuente de verdad de hitos | `shipment_events` (SDD-0013/0132) — `transitionShipment` la puebla | **ancla** de los offsets (`occurred_at` del hito) |
| Aviso inline actual | `lib/studio/shipment-milestone-notify.ts` | se **reemplaza** por el motor (seed = mismo comportamiento) |

## Los dos huecos que se construyen

1. **Agenda diferida RELATIVA a un evento** (`client_notification_schedule`): al ocurrir un
   evento del dominio, se calcula `scheduled_for = ancla + offset` y se inserta una fila. No existe.
2. **Push al cliente durable**: hoy iría inline; se rutea por `enqueue_user_push` → `outbox_push_events`
   → `push-drain` (mismo patrón que operarios/staff).

## Columna vertebral del journey (sobre esto cuelgan los avisos)

`shipments.status` (enum `shipment_status`, `0002_shipments.sql`):
`draft → in_warehouse → consolidating → shipped → in_transit → in_customs →
arrived_destination → (delayed_warehouse) → out_for_delivery → last_mile → delivered`
(+ `exception`, `cancelled`).

- **Único gancho hoy:** `transitionShipment` (`tracking/[id]/actions.ts`, ~L192-297).
- **Máquinas PARALELAS sin gancho** (Slice D): "consolidado" (`warehouse_receipts_cn`) y naviera
  (`consolidations`/`sailings`, donde vive el **ETA**) NO tocan `shipments.status` ni notifican.
- **Anclas de tiempo:** el `occurred_at` del `shipment_event` (default) · `sailings.eta/etd` ·
  `tracking_snapshots.pod_eta` (SeaRates) · `warehouse_receipts_ve.eta`.

## Modelo de datos (propuesta)

### 1. `client_notification_rules` — configuración (por tenant, override opcional por cliente)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `tenant_id` | uuid not null | FK tenants |
| `client_id` | uuid null | **null = regla default del tenant**; no-null = override para ese cliente (V1: siempre null) |
| `trigger_event` | text not null | clave del catálogo (ver abajo) |
| `channel` | text not null | `email` \| `push` \| `both` \| `none` (`none` = silenciar ese evento) |
| `anchor` | text not null default `'event'` | qué timestamp ancla el offset: `event` (occurred_at del hito) \| `eta` \| `etd` |
| `offset_minutes` | int not null default 0 | **con signo**: `+7200` = +5 días; `-7200` = 5 días antes del ancla |
| `template_key` | text | copy a usar (null → copy default del evento) |
| `visible_in_portal` | boolean not null default true | si el hito se muestra en el stepper del cliente (Slice D) |
| `active` | boolean not null default true | |
| `created_at` / `updated_at` | timestamptz | |

- **Unicidad:** `unique (tenant_id, client_id, trigger_event)` — una regla por evento por alcance.
  (con `client_id` null tratado como scope "tenant"; índice único parcial para el default).
- **RLS:** por tenant (`tenant_id = get_user_tenant_id()`); gating a rol admin en la app
  (regla de la casa: RLS por tenant, rol en la app). El cliente NO lee esta tabla.
- **"Ocultar estado → disparar otra alerta"** = dos perillas independientes en la MISMA fila,
  sin mecanismo especial: `visible_in_portal=false` + `template_key='cobro_anticipado'`
  sobre el evento `status:in_customs`. Ocultar el hito y disparar el cobro son ortogonales.

### 2. `client_notification_schedule` — agenda diferida (el hueco #1)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `tenant_id` | uuid not null | FK tenants |
| `shipment_id` | uuid not null | FK shipments |
| `client_markbox` | text not null | denormalizado (patrón RLS del portal, igual que `shipment_events`) |
| `rule_id` | uuid null | regla que la originó (null si ad-hoc) |
| `trigger_event` | text not null | |
| `channel` | text not null | `email` \| `push` \| `both` |
| `template_key` | text | |
| `scheduled_for` | timestamptz not null | **= ancla + offset**, calculado al programar |
| `payload` | jsonb not null | snapshot de vars (código de envío, copy) al programar |
| `status` | text not null default `'scheduled'` | `scheduled` \| `sent` \| `skipped` \| `canceled` \| `failed` |
| `sent_at` | timestamptz | |
| `attempts` | int not null default 0 | tope `MAX_ATTEMPTS` (5, como el push outbox) |
| `error` | text | |
| `created_at` | timestamptz default now() | |

- **Idempotencia:** `unique (shipment_id, trigger_event, rule_id) where status <> 'canceled'`
  — no re-programar el mismo evento para el mismo envío.
- **Índice de la cola:** `(status, scheduled_for) where status = 'scheduled'`.
- **RLS:** `service_role` para el cron (igual que `outbox_push_events`). El cliente **no** lee esta
  cola (los avisos llegan por email/push, no por lectura). Opcional: exponer al portal solo las
  `sent` como "historial de avisos" (diferido).

## Flujo (motor)

```
Evento del dominio (ej. transitionShipment → 'shipped')
   │
   ▼  scheduleClientNotifications(admin, tenant, {shipment, event, anchorTime})
   1. carga reglas activas del evento (override cliente → default tenant)
   2. por cada regla con channel≠'none':
        scheduled_for = anclaSegún(rule.anchor) + rule.offset_minutes
        INSERT en client_notification_schedule (idempotente)
   │
   ▼  drain: inline tras programar (para offset≤0 = inmediatos) + cron backstop cada minuto
      /api/cron/client-notifications-drain
        SELECT status='scheduled' AND scheduled_for<=now() AND attempts<MAX  (batch)
        despacho por canal:
          email → sendEmail(templated)                       (Resend, ya durable en mail_logs)
          push  → enqueue_user_push(clienteAuthUserId,...)   → outbox_push_events → push-drain
          both  → los dos
        marcar status='sent'/sent_at  |  bump attempts en fallo transitorio
```

- **Durabilidad email:** `sendEmail` ya registra en `mail_logs`; la agenda garantiza el disparo diferido.
- **Durabilidad push (hueco #2):** la agenda **no entrega** el push; **encola** en el outbox
  existente. La entrega + reintentos + limpieza de subs muertas ya la hace `push-drain`.
- **Resolver `client_markbox → auth.user_id`** (para el push): el cliente del portal es `auth.user`
  (magic-link, SDD-0042). La resolución markbox→user se hace con el mapeo del portal
  (a verificar en build: tabla/vista de vínculo cliente↔user). Sin user vinculado → push se `skip`
  (email sigue), no rompe.

## Catálogo de eventos (`trigger_event`)

Slice A (sobre `shipments.status`, gancho existente):
`status:in_warehouse` · `status:consolidating` · `status:shipped` · `status:in_transit` ·
`status:in_customs` · `status:arrived_destination` · `status:out_for_delivery` ·
`status:last_mile` · `status:delivered` · `status:exception`.

Slice D (máquinas paralelas, ganchos nuevos):
`consolidated` (warehouse_receipts_cn) · `sailing_departed` / `eta_set` (sailings, ancla ETA) ·
`received_ve` (warehouse_receipts_ve).

## Slices

- **A — Motor + agenda + config DB (núcleo).** Tablas `client_notification_rules` +
  `client_notification_schedule` + RPCs (`schedule_client_notification`, idempotente) +
  `scheduleClientNotifications()` + cron `client-notifications-drain` + wire en `transitionShipment`
  (reemplaza los 2 avisos inline). **Seed de reglas default = comportamiento de HOY** (email en
  `in_warehouse/shipped/out_for_delivery/delivered`, arribo por su template) → **cero regresión**.
- **B — UI de config (Studio admin).** CRUD de reglas por evento (canal · offset · ancla · template ·
  visibilidad), espejo de `mail_rules` admin. Acá el founder setea "+2 días consolidado",
  "in_customs oculto + cobro". Admin-only.
- **C — Push al cliente durable (hueco #2).** Rutear `channel=push` por `enqueue_user_push`;
  resolver markbox→auth user; templates push. (El opt-in del portal ya existe.)
- **D — Anclas ETA + máquinas paralelas + visibilidad del portal.** Ganchos en consolidado y
  naviera (ETA); el caso "+5 días al ETA"; el stepper del portal respeta `visible_in_portal`.
- **E — Cobro anticipado en aduana.** `status:in_customs` oculto + template de cobro; enlaza con
  la cadencia de recobro (gap #3 de la memoria; spec aparte).

## Seguridad y DB (reglas de la casa)

- **Skills Supabase** (seguridad + postgres) antes de tocar la DB. **Revisión adversarial** de las
  migraciones. Migraciones a prod **solo con OK del founder NOMBRANDO el archivo**, de a una.
- RLS: config por tenant; agenda por `service_role`. `search_path` fijado; `extensions.gen_random_uuid()`
  calificado. Validar la migración con `begin … rollback` en prod (branching Supabase no disponible).
- El `payload` que ve el cliente no expone datos internos (proveedor, costos).

## Verificación

- `node scripts/verify.mjs` verde (typecheck + lint + tests + docs:check) + `pnpm build`.
- Tests: idempotencia de la agenda (no doble-programa) · cálculo de `scheduled_for` por ancla/offset
  con signo · drain marca sent/bump attempts · seed no regresa el comportamiento actual ·
  aislamiento (un cliente no ve reglas/cola de otro).
- `/ui-check` en la UI de config (Slice B).

## Decisiones (founder · 2026-07-17)

1. **Semántica de "+5 días al ETA":** el **default = ETA + 5 días** (esperar a que esté cerca),
   **100% editable** desde la UI de config. El offset con signo cubre cualquier ajuste (+/−).
2. **Alcance V1 = por tenant + override por cliente** (ambos entran ya). `client_id` no-null =
   override de ese cliente; la resolución es **override cliente → default tenant**.
3. **Canales V1:** email + push (los dos son reales para el cliente hoy). WhatsApp/Telegram fuera.
4. **Arranque = Slice A + B** (motor + agenda + config DB + UI de config admin, con override por
   cliente). Push durable (C) y anclas ETA de máquinas paralelas (D) a continuación.

## Estado de implementación (2026-07-17 · rama `feat/push-cliente`)

**Slice A + B construidos**, verify verde salvo `migrations-applied` (0247 esperando OK del
founder para aplicar a prod). Archivos:

- **Migr `0247_client_notifications.sql`** (PEND. founder): 2 tablas + índices únicos parciales
  (default vs override) + RLS (rules por tenant · schedule service_role) + seed de las 4 reglas
  default = comportamiento de HOY. Revisión adversarial pasada (fix cascade→**restrict** en
  `schedule.rule_id` para preservar historial 'sent'/cancelaciones).
- **Motor** `lib/studio/notifications/`: `client-notification-types.ts` (catálogo + copy +
  precedencia override→template→default) · `schedule-client-notifications.ts` (resuelve regla,
  calcula `scheduled_for`, inserta idempotente, drain inline) · `drain-client-notifications.ts`
  (claim atómico anti doble-envío · email vía `sendEmail` · push vía `enqueue_user_push`→outbox) ·
  `client-notification-rules-queries.ts` (CRUD + validación + `seedDefaultRulesForTenant`).
- **Cron** `/api/cron/client-notifications-drain` (cada minuto, `vercel.json`).
- **Wire**: `transitionShipment` ahora llama `scheduleClientNotifications` (reemplaza el aviso
  inline de 0132; `arrived_destination` sigue por su template). ⚠️ **Requiere 0247 aplicada**:
  sin la tabla, el motor no programa nada → los emails de hito se cortan (regresión). Por eso
  0247 se aplica **antes** del push.
- **UI** `app/studio/(app)/admin/notificaciones/` (admin-only): fila editable por evento
  (canal · ancla+offset con signo · texto · visibilidad · activo) + override por cliente +
  restaurar defaults. Enlace en Administración (`bell`, SDD-0156). `/ui-check` OK.
- **Tests**: 4 archivos, 33 casos (copy, offset con signo, validadores, scheduler
  override>default/idempotencia/skips, drain claim+outcomes) + entrada en la ALLOWLIST RBAC.

**Pendiente founder**: aplicar `0247_client_notifications` a prod (OK nombrándola) → habilita el
feature y restaura los emails de hito.
**Diferido (Slice C/D/E)**: push como canal por defecto (infra lista; hoy configurable) ·
anclas ETA/ETD + ganchos de máquinas paralelas (consolidado/naviera/recepción VE) ·
visibilidad del stepper del portal (`visible_in_portal`) · cobro anticipado en aduana enlazado
a la cadencia de recobro.

### Nota de anclaje ETA en Slice A
La regla "va llegando +5 al ETA" se **ancla en el ETA** pero se **programa** cuando el envío
alcanza un status conocido (ej. `shipped`/`in_transit`, donde el ETA ya existe). El motor lee el
ETA del envío (`sailings.eta` / `tracking_snapshots.pod_eta` / `warehouse_receipts_ve.eta`) al
programar — sin necesitar aún el gancho de evento de la naviera (eso es Slice D). Sin ETA
disponible → la regla anclada en ETA se `skip` (no rompe).
