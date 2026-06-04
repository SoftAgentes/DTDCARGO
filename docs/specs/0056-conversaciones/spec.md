---
sdd: "0056"
title: "Conversaciones · bandeja unificada (WhatsApp + email + portal)"
status: draft
author: "founder"
created: 2026-06-04
updated: 2026-06-04
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

## Decisiones abiertas

1. **Granularidad del hilo:** ¿1 conversación por **cliente** (todos los canales en un hilo) o 1
   por **cliente×canal**? El mockup del Norte filtra por canal → sugiere por-canal, pero "un solo
   hilo por cliente" es el gancho del subtítulo. **Propuesta:** por cliente×canal en datos, vista
   unificable por cliente en la UI (lo mejor de ambos). Confirmar con founder.
2. **Email inbound (Fase 2):** ¿Resend inbound (si lo soporta el plan) vs IMAP propio vs un relay?
   Definir al llegar a Fase 2.
3. **WhatsApp (Fase 3):** número/línea (¿el CRM WhatsApp `+58 412 166 8021` existente?), cuenta de
   Meta Business, plantillas. Es setup founder pesado — gate explícito antes de Fase 3.
4. **SLA:** ¿timers/alertas por tiempo sin responder en V1 o diferido? Propuesta: mostrar
   "antigüedad" en V1, alertas de SLA en una fase posterior.

## Adjuntos

Mockups → el Norte ya tiene la fuente (`conversaciones.jsx` v1.9.1). Si se generan diagramas de
datos propios del spec → `docs/specs/0056-conversaciones/assets/`.

---
<!-- Estado: draft. Próximo paso sugerido: revisar alcance/fases con founder (plan-eng-review),
     luego Fase 1 vía harness. NO empezar implementación hasta aprobar el spec. -->
