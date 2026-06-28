---
sdd: "0056"
title: "Conversaciones · bandeja unificada (WhatsApp + email + portal)"
status: done
author: "founder"
created: 2026-06-04
updated: 2026-06-28
supersedes: null
superseded_by: null
related: ["0026", "0042", "0043", "0045"]
confidencialidad: interno
---

# DTD-0056 — Conversaciones (bandeja unificada)

> Una bandeja única donde el agente de DTD ve y responde toda la comunicación con un cliente —
> WhatsApp, email y mensajes del portal— en un solo hilo por cliente, con asignación, estado y casos.

## Contexto

La operación de DTD es **WhatsApp-céntrica**: el cliente escribe por WhatsApp, a veces por
email, a veces deja un mensaje en el portal. Hoy esa comunicación está **dispersa**: el agente
salta entre el teléfono, la casilla de correo y el Studio, sin un hilo único por cliente ni
trazabilidad de quién respondió qué. Cuando lo interrumpen (patrón documentado en el CLAUDE.md
del Studio: el operador trabaja mientras lo llaman por WhatsApp), pierde el contexto.

Este módulo es el **gap real** que detectó el review de drift del Norte (2026-06-04): de los 11
"candidatos a backend" del mapa, **Conversaciones es uno de los 2 genuinamente pendientes** (junto
con Flujo de trabajo). El resto ya se repatrió a backend nativo.

### Qué NO es (límites vs módulos existentes)

| Módulo | Qué hace | Por qué NO es esto |
|---|---|---|
| **Mailing** ([[0026]]) | Email **saliente** transaccional + reglas (`fireMailEvent`, Resend) | Es outbound automático (factura/cotización/welcome). Conversaciones es **inbound + bidireccional de atención**, multi-canal. Puede **reusar** el envío de Resend para la respuesta por email. |
| **Comentarios + @menciones** ([[0045]]) | Comentarios **internos** del equipo sobre entidades + bandeja de menciones | Es colaboración **interna** (equipo↔equipo). Conversaciones es **cliente↔DTD**. |
| **Kommo connector** ([[0043]]) | Sync **read-only** de un CRM externo (leads/contactos/pipelines) | Es un espejo de un sistema externo, **no la bandeja operativa**. Kommo no es el CRM de prod. |
| **Portal del cliente** ([[0042]]) | El cliente ve sus envíos / perfil | El portal es el lado del cliente; acá vive el **mensaje que el cliente manda** desde el portal, ya del lado del agente. |

Conversaciones se apoya en estos (reusa el cliente/MARKBOX, el envío Resend, el contexto de
envíos) pero es una entidad nueva: **el hilo de atención al cliente**.

## Alcance

**Dentro:**
- Entidad `conversations` (1 hilo por cliente×canal o unificado por cliente — ver Decisiones) +
  `conversation_messages` (mensajes inbound/outbound).
- **Bandeja unificada**: lista filtrable (estado · canal · búsqueda por cliente/MARKBOX) + panel de
  hilo con respuesta, quick replies, cambio de estado y asignación a agente.
- **Estados** del hilo: `abierto · pendiente · resuelto` + flag **caso/reclamo** (prioridad alta).
- **Asignación** a un agente (`assigned_to` → `user_tenants`), con "sin asignar" visible.
- **Contexto del cliente** en el hilo: MARKBOX, envíos activos, saldo CxC (link, no duplicar data).
- KPIs: Abiertas (+ sin leer) · Sin asignar · Casos abiertos · Resueltas hoy.
- **Realtime**: la lista/hilo se actualizan en vivo cuando entra un mensaje (Supabase Realtime,
  patrón ya usado en Despacho — ver [[project_bridge_approach_supabase_realtime]]).

**Fuera (diferido / otros specs):**
- El motor de **reglas/automatización** de respuestas (eso es Mailing/SDD-0020 agentes).
- Chatbot/IA de respuesta automática (futuro, sobre el runtime de agentes).
- Telefonía/llamadas de voz.

### Fases (cada una shippa sola, cero regresión)

1. **Fase 1 · Núcleo + canal Portal (sin integraciones externas).**
   Tablas + RLS + bandeja UI + el canal `portal` (el cliente ya escribe desde el portal
   Supabase-backed; esos mensajes entran al hilo). Respuesta del agente se guarda y, si el cliente
   tiene email, sale por Resend. Realtime. **Es el MVP demostrable sin tocar APIs externas.**
2. **Fase 2 · Email entrante.** Ingesta de email inbound (webhook de Resend inbound o IMAP) →
   threading al `conversation` por cliente/asunto. Salida por el envío Resend existente.
3. **Fase 3 · WhatsApp.** WhatsApp Business API (Meta Cloud API): webhook inbound + envío outbound,
   plantillas aprobadas, ventana de 24h. Es la fase pesada (aprobación de Meta, número, plantillas).

## Diseño

Norte (texto-código + versión, NUNCA link relativo):
`docs/design/studio/_norte/erp/modules/conversaciones.jsx` (**v1.9.1**) +
`docs/design/studio/_norte/erp/modules/conversaciones-data.jsx`.

Layout: `PageHeader` + 4 KPIs + grid `360px 1fr` (lista filtrable | hilo). Lista = filtros
(estado/canal/búsqueda) + items con cliente/MARKBOX/canal/último mensaje/sin-leer. Hilo = burbujas
in/out + composer con quick replies + acciones (estado, asignar) + panel de contexto del cliente.
Respeta tokens del Studio (`var(--*)`), `ERPUI`/primitivas, cero AI slop (ver `_norte/CLAUDE.md`).

## Modelo de datos (boceto)

```
channel   = enum('whatsapp','email','portal')
conv_status = enum('abierto','pendiente','resuelto')

conversations
  id uuid pk · tenant_id uuid (RLS) · client_id uuid → clients
  channel channel · status conv_status default 'abierto'
  is_case boolean default false           -- reclamo/prioridad alta
  assigned_to uuid → auth.users (nullable) -- agente
  subject text · last_message_at timestamptz · unread_count int default 0
  external_ref text                        -- id del chat WA / thread email (Fases 2-3)
  created_at · updated_at · (soft delete: deleted_at)

conversation_messages
  id uuid pk · tenant_id uuid (RLS) · conversation_id uuid → conversations (cascade)
  direction enum('in','out') · author_name text · author_user_id uuid (nullable, si out)
  body text · sent_at timestamptz · external_msg_id text (idempotencia inbound)
  created_at
```

- **RLS por `tenant_id`** (patrón estándar). Lectura/escritura: agentes autenticados del tenant.
- **Validación DB de la relación polimórfica-ish** no aplica (FKs reales a `clients`/`conversations`).
- Correlativo de display si se quiere (`C-2026-NNNN`) vía RPC, opcional.
- Idempotencia de inbound (`external_msg_id` unique parcial) para no duplicar webhooks.

## Arquitectura (convenciones del proyecto)

- `lib/studio/conversaciones/` (dominio ≥3 archivos): `conversations-types.ts` (+ validators sin
  Zod), `conversations-queries.ts` (puras, reciben `SupabaseClient`), `messages-*.ts`.
- `app/studio/(app)/conversaciones/`: `page.tsx` (fetch) + `actions.ts` (server actions:
  `sendReplyAction`, `setStatusAction`, `assignAction`, `markCaseAction`) + `_components/`
  (`ConversacionesClient`, `ConversationList`, `ConversationThread`).
- **Realtime** vía hook existente (`lib/studio/hooks/use-realtime-table.ts`) sobre
  `conversation_messages` filtrado por tenant.
- **Trazabilidad visual** (estándar del Studio): cambio de estado/asignación → highlight + toast.
- Entry en `StudioSidebar.tsx` (grupo Comercial/Atención).
- Webhooks (Fases 2-3): `app/api/conversaciones/{email,whatsapp}/route.ts` finos (sin lógica de
  negocio), con verificación de firma + idempotencia.
- Migración numerada con tablas + enums + RLS + (opcional) RPC correlativo.

## Decisiones (resueltas por el founder)

1. **Granularidad del hilo:** ✅ **cliente×canal en datos**, vista unificable por cliente en la UI.
   Implementado: índice único parcial `conversations_client_channel_live_idx (tenant, client,
   channel) where deleted_at is null` (un hilo VIVO por cliente×canal).
2. **Email inbound (Fase 2):** ✅ **resuelto: Resend Inbound** (mismo proveedor que el saliente,
   dominio ya verificado — NO IMAP, NO Cloudflare). Webhook `email.received` (solo metadata) +
   Received Emails API (baja el cuerpo por `email_id`). Threading al hilo `channel='email'` del
   cliente. Ver "Fase 2 · notas de implementación".
3. **WhatsApp (Fase 3):** ⏸ diferido. Gate founder pesado (Meta Business + plantillas + número).
4. **SLA:** ✅ V1 muestra **antigüedad** (`relativeAge`); timers/alertas de SLA quedan para una
   fase posterior.

## Fase 1 · notas de implementación (2026-06-04)

Shippeada vía harness en el worktree `feat/conversaciones`. Núcleo + canal Portal, sin
integraciones externas.

- **Migración `0106_conversaciones.sql`** (NO aplicada a prod): enums `conversation_channel` /
  `conversation_status` / `conversation_direction`; tablas `conversations` + `conversation_messages`
  con RLS por `tenant_id` (equipo del tenant) + FKs reales + `external_msg_id` unique parcial
  (idempotencia inbound) + `unread_count`/`last_message_at` denormalizados. RPC `next_conversation_ref`
  (`C-YYYY-NNNN`). RPC SECURITY DEFINER `portal_post_message(p_body)` = único punto de entrada del
  cliente del portal (no tiene policy directa sobre las tablas).
- **`lib/studio/conversaciones/`**: `conversations-types.ts` (enums + validators sin Zod + helpers
  label/badge tone + `filterConversations` + `relativeAge`), `conversations-queries.ts`
  (`listConversations`, `computeConversationKpis`/`aggregateKpis`, `listAssignableAgents`,
  `getClientContext`/`aggregateOutstanding`), `messages-queries.ts` (`listMessages`,
  `insertOutboundMessage`, `insertInboundMessage` idempotente).
- **`app/studio/(app)/conversaciones/`**: `page.tsx` (fetch server) + `actions.ts`
  (`sendReplyAction` → si el cliente tiene email sale por Resend; `setStatusAction`, `assignAction`,
  `markCaseAction`) + `_components/` (`ConversacionesClient` con Realtime via `useRealtimeRefresh`
  sobre `conversation_messages` + `ConversationList` + `ConversationThread`). Detalle del hilo
  (mensajes + contexto cliente) servido lazy por `app/api/studio/conversaciones/[id]/route.ts`.
- **Canal Portal**: `app/portal/(app)/mensajes/` (page + form + action fina que llama
  `portal_post_message`) + nav link en `PortalNav`. El hilo del cliente se lee con admin client
  scopeado por `client_id` (`lib/portal/portal-conversation-queries.ts`).
- **Sidebar**: entry `Conversaciones` en grupo COMERCIAL (`StudioSidebar.tsx`).
- **Tests**: `lib/studio/conversaciones/__tests__/conversaciones.test.ts` (39 casos: validators,
  filtros, KPIs, saldo, label/tone, antigüedad, idempotencia inbound).

**Pendiente founder:** aplicar `0106` a prod (MCP / SQL editor). Para que el Realtime + el envío por
email del agente funcionen en runtime, las tablas ya están en `supabase_realtime` por RLS y el
envío reusa `mail_config` del tenant (Resend ya configurado).

## Fase 2 · notas de implementación (2026-06-05)

Email entrante vía **Resend Inbound** (decisión #2). Shippeada vía harness en el worktree
`feat/conversaciones`. **Sin migración** (code-only sobre el schema 0106): el admin client
service_role bypassa RLS y reusa `conversation_messages.external_msg_id` (idempotencia inbound) +
el índice único parcial cliente×canal.

- **Contrato real de Resend (verificado en docs 2026-06-05):** el webhook `email.received` trae
  **solo metadata** (`email_id`, `from`, `to`, `subject`, `message_id`, `attachments`); el cuerpo se
  baja aparte con `GET https://api.resend.com/emails/receiving/{email_id}` (Received Emails API,
  Bearer `RESEND_API_KEY`). La idempotencia usa `email_id` (estable, lo asigna Resend) como
  `external_msg_id`, no el header `message_id` del remitente.
- **Core provider-agnóstico** `lib/studio/conversaciones/inbound-email.ts` (`ingestInboundEmail`,
  puro, recibe admin `SupabaseClient`): resuelve cliente por `clients.email` (case-insensitive,
  vivo) → `unmatched` (0 matches, NO inserta: `client_id` es NOT NULL) · `ambiguous` (mismo email en
  >1 tenant, sin mapa tenant↔dominio receptor no se adivina) · si 1 tenant → reusa/crea el hilo
  `channel='email'` (RPC `next_conversation_ref`, maneja race 23505 re-seleccionando) → inserta
  inbound idempotente (`duplicate` si el `email_id` ya existe) → bump unread/last_message_at +
  reabre si estaba `resuelto` (mismo comportamiento que `portal_post_message`).
- **Adapter** `lib/studio/conversaciones/resend-inbound-adapter.ts`: aísla TODO el parsing
  Resend-específico (webhook + Received Email → input del core). `parseFromAddress` (display name +
  address), `bodyFromEmail` (prefiere `text`, deriva de `html` con strip básico). Swappable si
  cambia el proveedor.
- **Webhook** `app/api/conversaciones/email/route.ts` (fino, sin lógica de negocio): verifica firma
  Svix (reusa `verifyResendWebhookSignature` del webhook de delivery) → adapter → fetch cuerpo
  (`resendGetReceivedEmail` agregada a `lib/studio/mail/resend-api.ts`) → `ingestInboundEmail`.
  Responde **200** en todos los desenlaces válidos (ingested/duplicate/unmatched/ambiguous) para que
  Resend no reintente en loop; `!= 200` solo si falta secret (503), firma inválida (401) o falla
  bajar el cuerpo (502). Errores con `apiError` (no filtra detail en prod).
- **Reply threading:** al crear el hilo email se siembra `conversations.external_ref` con el
  `email_id`/Message-ID del primer email; `sendReplyAction` setea `In-Reply-To`/`References` (vía
  `headers` agregado a `sendEmail`) para hilos `channel='email'`, así la respuesta cae en el mismo
  hilo de la casilla del cliente.
- **Tests:** `lib/studio/conversaciones/__tests__/inbound-email.test.ts` (18 casos: core
  ingested/append+bump/reabre-resuelto/duplicate/unmatched/ambiguous/race-23505/body-vacío +
  helpers + adapter fixture/parse/html→text).

**Setup founder (no automatizable):** ver `docs/runbooks/setup-resend-inbound.md`. En síntesis:
MX en un **subdominio receptor** (NO pisar el MX de envío, prioridad baja) + webhook `email.received`
a `{SITE_URL}/api/conversaciones/email` + `RESEND_INBOUND_WEBHOOK_SECRET` (cae a `RESEND_WEBHOOK_SECRET`
si falta) + `RESEND_API_KEY` con lectura. ⚠️ Resend Inbound puede requerir un **plan específico**
(confirmar en el dashboard). El código queda listo y testeado con mocks aunque el setup no esté.

**Fuera de Fase 2:** WhatsApp (Fase 3) · auto-crear lead/cliente desde un remitente desconocido
(decisión futura del founder; por ahora `unmatched` se descarta + log) · adjuntos (el webhook trae
solo metadata de adjuntos; bajar el binario por la Attachments API queda como follow-up).

## Adjuntos

Mockups → el Norte ya tiene la fuente (`conversaciones.jsx` v1.9.1). Si se generan diagramas de
datos propios del spec → `docs/specs/0056-conversaciones/assets/`.

---
<!-- Estado: in-progress. Fase 1 (núcleo + canal Portal) y Fase 2 (email entrante · Resend Inbound)
     shippeadas vía harness. Pendiente: Fase 3 (WhatsApp · Meta Cloud API, gate founder pesado). El
     spec pasa a 'done' cuando cierre la Fase 3 o el founder decida congelar el alcance en email. -->

