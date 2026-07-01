---
sdd: "0123"
title: "Hitos del envío + notificación de estado al cliente"
status: draft
author: "agente-secundario (inventario portal)"
created: 2026-07-01
updated: 2026-07-01
supersedes: null
superseded_by: null
related: ["0042", "0047", "0056", "0101"]
confidencialidad: interno
---

# DTD-0123 — Hitos del envío + notificación de estado al cliente

> ⚠️ **Número TENTATIVO.** En `main` el máx de spec = 0119; hay ramas en vuelo hasta 0122
> (`feat/construccion-norte`). El **Director confirma el número libre real** antes de aprobar.
> Origen: `INVENTARIO-PORTAL.md` gap **⭐1** (rama `feat/portal-inventario`).

## Contexto

Dos huecos que hoy conviven:

1. **El seguimiento del envío no tiene fechas por hito.** El stepper del portal (detalle
   del envío) y la "actividad reciente" del dashboard se **derivan del `status`** actual vía
   `buildTimeline(status, service)` (`lib/portal/portal-types.ts`, reusa
   `lib/studio/tracking-progress.ts`). Eso da los pasos done/active/pending, pero **sin la
   fecha real de cada paso** ("recibido en China el 12/06", "embarcado el 20/06"). El Norte
   (`_norte/portal/app.jsx` · `PortalShipmentDetail`) muestra un feed de hitos con fecha/hora
   reales. Naviera Tier 1 (SDD-0101) ya trae ETA/estado del **buque** vía SeaRates, pero eso
   es el tramo marítimo — no los hitos propios del flujo puerta a puerta de DTD.

2. **El portal es read-only: no hay push de estado al cliente.** Cuando la carga avanza, el
   cliente no se entera salvo que entre al portal. No existe notificación de hito por
   correo / WhatsApp / push. (Gap ya anotado en memoria: "push de estado al cliente NO
   existe".)

Ambos se resuelven con **una fuente de verdad de eventos por envío** (`shipment_events`) que
la operación puebla a medida que la carga avanza — y que, además de alimentar el stepper con
fechas, dispara la notificación.

## Objetivo

- Registrar **hitos del envío con fecha real** (`shipment_events`), poblados por la operación
  (manual al inicio, luego automático).
- Mostrar en el portal el **stepper con la fecha de cada hito** + "actividad reciente" real.
- **Notificar al cliente** cuando ocurre un hito notificable (correo / WhatsApp / push,
  best-effort, reusando la infra existente).

## No-objetivos

- **Tracking público** `/track/[code]` con snapshot vivo → SDD-0101 Slice C (aparte).
- Reemplazar `buildTimeline` como cálculo de pasos del flujo canónico: se **conserva** (define
  qué pasos existen por servicio); los eventos le **agregan la fecha real** a cada paso.
- Pasarela de pago / reportar pago → SDD-D (aparte).

## Modelo de datos (propuesta)

Tabla nueva `shipment_events`:

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `tenant_id` | uuid not null | multi-tenant, FK tenants |
| `shipment_id` | uuid not null | FK shipments |
| `client_markbox` | text not null | denormalizado (mismo patrón que `shipments`/`invoices` para la RLS del portal) |
| `milestone` | text not null | clave del hito (ver catálogo) — validar contra el flow canónico |
| `at` | timestamptz not null | **fecha real del hito** (la que ve el cliente) |
| `payload` | jsonb | datos del hito (ej. `{ "cbm": 3.2 }` en "medido", nº de contenedor, POD adjunto) |
| `source` | text not null | `manual` \| `status_change` \| `searates` \| `automation` |
| `notified_at` | timestamptz | null hasta que se despachó la notificación (idempotencia) |
| `created_by` | uuid | user que lo registró (null si automático) |
| `created_at` | timestamptz default now() | |

- **RLS:** política de equipo `by tenant` (permissive) **+** política de portal
  `client_markbox = get_portal_client_markbox()` (self-read, SELECT-only) — mismo molde que
  `shipments`/`invoices` (migr 0080/0085). Defensa en profundidad: las queries del portal
  filtran explícito por markbox (patrón `lib/portal/*`).
- **Índices:** `(shipment_id, at)` para el stepper; `(tenant_id, milestone, notified_at)` para
  el barrido de notificaciones pendientes.
- **Idempotencia de notificación:** índice único parcial o guard sobre `notified_at`
  (mismo criterio que SDD-0102: "no re-notificar").

### Catálogo de hitos (borrador — alinear con `buildTimeline` por servicio)

`cotizado → aceptado (T&C) → orden → recibido_cn → medido → embarcado → en_transito →
en_aduana → arribado → en_reparto → entregado` + `excepcion` (con motivo en `payload`).
Cada servicio (LCL / DDP / FCL / terrestre) usa el subconjunto que ya define el flow canónico.

## Poblado (3 fuentes)

1. **Manual desde el Studio** (Slice A): en el detalle del envío, el operador marca un hito y
   su fecha (o "ahora"). Es la vía mínima para tener fechas reales ya.
2. **Automático por cambio de status** (Slice B): cuando el `status` del shipment cambia (por
   la operación o el móvil `/m`), se inserta el evento correspondiente con `at = now()` y
   `source='status_change'` (trigger DB o hook en la server action que cambia el status).
3. **Desde SeaRates** (Slice B): mapear los hitos del snapshot de tracking (SDD-0101) a
   `shipment_events` (`source='searates'`), sin gastar cuota extra (lee el cache).

## Notificación (Slice C)

- Al insertar un hito **notificable** (subconjunto del catálogo — decisión del founder), se
  encola una notificación **best-effort** por los canales disponibles, reusando la infra:
  correo (`lib/studio/mail/send-email.ts`, Resend), Telegram interno y/o **push web**
  (`/m` ya tiene VAPID). WhatsApp saliente al cliente depende de SDD-0056 F3 (diferido).
- Marca `notified_at` para no repetir. Un fallo de canal no rompe el registro del hito.

## UI del portal

- **Detalle del envío:** el stepper muestra la **fecha real** por paso (del evento) en vez de
  solo done/pending; los pasos sin evento quedan como "pendiente" (degradación honesta).
- **Dashboard:** "Actividad reciente" lee los últimos `shipment_events` del cliente (hoy
  deriva del `updated_at` de los envíos — pobre).

## Seguridad

- Mismo patrón de aislamiento del portal: helper `get_portal_client_markbox()` +
  filtro explícito por markbox en las queries. Sin `maybeSingle` desnudo.
- `payload` no expone datos internos (proveedor, costos) — solo lo que el cliente puede ver.

## Decisiones abiertas (founder)

1. **¿Qué hitos disparan notificación?** (ej. solo recibido_cn / embarcado / arribado /
   entregado, no todos) → evita spam.
2. **Canal por defecto:** ¿correo, WhatsApp (cuando F3 exista), push, o el que esté?
   ¿el cliente elige / opta-out?
3. **Manual vs automático primero:** ¿arrancamos Slice A (manual) para tener fechas ya, o
   vamos directo al automático por status?
4. **Fecha del hito:** ¿el operador puede backdatear (poner la fecha real pasada) o siempre
   es "ahora"?

## Slices sugeridos

- **A** — `shipment_events` + RLS + marcado manual desde el Studio + stepper del portal con
  fechas. (Valor inmediato, sin depender de automatización.)
- **B** — poblado automático (trigger por status + mapeo SeaRates).
- **C** — notificaciones de hito (canales + preferencias + idempotencia).

## Verificación

- `node scripts/verify.mjs` verde (typecheck + lint + tests + docs:check).
- Tests de aislamiento del portal (un cliente solo ve los eventos de SU markbox).
- Validar la migración con el patrón `begin … rollback` en prod antes de aplicar (branching
  Supabase no disponible).
