---
sdd: "0148"
title: "Aviso al equipo de mensajes entrantes del portal — activar el chat de Soporte"
status: in-progress
author: "Claude Code (sesión Director) + founder"
created: 2026-07-04
updated: 2026-07-04
supersedes: null
superseded_by: null
related: ["0056", "0036", "0134", "0147"]
confidencialidad: interno
---

# SDD-0148 · Aviso al equipo de mensajes entrantes del portal

> El chat de Soporte del portal (SDD-0147 / Conversaciones SDD-0056) **funciona
> punta a punta** pero se siente muerto: cuando el cliente escribe, hoy **solo sube
> el contador "sin leer" — a nadie le suena nada**. Si el equipo no está mirando la
> bandeja, el cliente escribe al vacío. Este SDD cierra ese lazo: **avisar al equipo
> (agente asignado o admins) cuando entra un mensaje del portal**, para que alguien
> responda. Es el paso #1 para "activar" el chat.

## Contexto / problema

Flujo actual (verificado):
1. Cliente escribe en `/portal/soporte` → `sendPortalMessageAction` → RPC
   `portal_post_message` (SECURITY DEFINER).
2. La RPC crea/reusa el hilo `portal` del cliente, inserta el mensaje `direction=in`,
   **bump `unread_count` + `last_message_at`**, reabre si estaba resuelto, y
   **devuelve el `conversation_id`**.
3. El mensaje aparece en `/studio/conversaciones` (bandeja del equipo, con realtime
   del lado Studio). El agente responde ahí; la respuesta baja al chat del cliente
   y, si tiene email, también por correo (Resend).

**El gap:** el paso 2 **no dispara ninguna notificación**. El equipo tiene que estar
mirando la bandeja para enterarse. Sin un ping, el canal rota.

## Objetivo

Cuando entra un mensaje inbound del portal, **notificar al equipo** — best-effort,
sin romper el envío del cliente — para que alguien lo tome y responda.

## Diseño / enfoque

### Punto de enganche
En `sendPortalMessageAction` (`app/portal/(app)/mensajes/actions.ts`), **después**
de que `portal_post_message` devuelve OK el `conversation_id`: llamar a un módulo
nuevo `notifyConversationInbound(...)` con el admin client. **Best-effort** (try/catch,
loguea, nunca tira) — calca el patrón de [[0134]] `payment-report-notify.ts`.

### A quién se notifica
Con el `conversation_id` devuelto, el admin client lee del hilo:
`tenant_id, assigned_to, unread_count, ref` + `client.name/markbox` + el body.

- **Hilo asignado** (`assigned_to` != null) → notificar a **ESE agente** por los
  primitivos por-usuario de [[0036]]: **campanita in-app** (`notify/write-inapp`) +
  **Telegram** (`notify/send-user-telegram`) + **push** (`notify/send-user-push`),
  respetando las preferencias por-canal del usuario.
- **Sin asignar** → **broadcast a los admins** del tenant (`resolveAdminEntries` +
  `sendAdminTelegram`, patrón "avisar al equipo" de `new-client-notify`), para que
  alguien lo tome. (El fallback de **asignación automática** es otro ítem —#2 de la
  lista de activación— fuera de este SDD.)

### Anti-spam (sin migración)
Si el cliente manda 5 mensajes seguidos, NO mandar 5 avisos. Regla: **notificar solo
cuando `unread_count == 1` tras el post** — es decir, la PRIMERA actividad de una
tanda no leída (el equipo ya había leído todo). Si `unread_count > 1`, ya hay un
pendiente → el equipo ya fue avisado por esta tanda → se omite. Aprovecha el
`unread_count` que la RPC ya mantiene; **cero columnas nuevas, cero migración**.

### Contenido del aviso
Nombre + Shipping Mark del cliente + preview del mensaje (recortado) + **link a
`/studio/conversaciones`** (bandeja; el badge de "sin leer" lo guía al hilo). El
deep-link al hilo puntual queda para Fase 2 si el módulo necesita un param.

### Indicador en el topbar del Studio (founder 2026-07-04)
Además del ping puntual, un **ícono propio de Conversaciones en el topbar** (arriba
a la derecha, **al lado de la campana**, NO dentro de ella) con **badge de no-leídos**
que lleva a `/studio/conversaciones`. Así los mensajes del cliente están **siempre
visibles** en el chrome del ERP, en cada pantalla. Calca el patrón de la campana
(`NotificationBell` + `useRealtimeTable`): el layout server-fetcha las conversaciones
abiertas del tenant, el componente client mantiene el conteo vivo por Realtime
(la tabla `conversations` ya está en la publicación — la bandeja la usa) y pinta el
badge (Σ / conversaciones con `unread_count > 0`). Con este badge SIEMPRE a la vista,
el "re-aviso por tiempo" pierde urgencia → V1 va con el aviso simple.

### Reúso (cero backend nuevo)
- `lib/studio/notify/{write-inapp,send-user-telegram,send-user-push}.ts` (per-usuario, [[0036]]).
- `resolveAdminEntries` + `sendAdminTelegram` de `lib/studio/new-client-notify.ts`.
- El `unread_count`/`assigned_to` que ya mantiene `conversations` (0106).
- **Cero migración.**

## Fases

- **Fase 1 — Aviso base + indicador topbar.**
  (a) Módulo `lib/studio/conversation-inbound-notify.ts` + wiring en
  `sendPortalMessageAction`. Asignado → per-usuario (campanita+Telegram+push); sin
  asignar → admins. Anti-spam por `unread_count == 1`. Link a la bandeja.
  (b) **Indicador de Conversaciones en el topbar** (`ConversationsIndicator`) con
  badge de no-leídos, realtime, → `/studio/conversaciones`; el layout inyecta el
  conteo inicial (junto a `initialNotifications`).
- **Fase 2 — Deep-link + preferencia por-evento.** Link directo al hilo en
  `/studio/conversaciones?c=<ref>` (si hace falta soportar el param) + registrar el
  evento "mensaje entrante del portal" en el centro de preferencias de notificaciones
  ([[0036]]) para que el agente lo pueda silenciar por canal.

- **Fase 2 — activar el lazo completo (2026-07-04, LIVE).** Los tres ítems que
  faltaban para que el chat se sienta vivo, todos SIN migración:
  - **#2 Auto-asignación**: hilo entrante sin asesor + el cliente tiene `advisor_id`
    → se auto-asigna a ese asesor (`update conversations set assigned_to`, guard
    `.is(assigned_to,null)`) y el aviso va a él. Reusa la relación cliente↔asesor.
  - **#3a Near-realtime en `/portal/soporte`**: `PortalChatPoller` refresca el server
    component cada 20s mientras la pestaña está visible → las respuestas del equipo
    aparecen sin recargar. Evita abrir la RLS de `conversation_messages` al cliente.
    El **aviso al cliente** ya existe por **email** (SDD-0056 al responder).
  - **#4 Badge de no-leídos en el nav del portal**: punto en "Soporte" cuando el
    último reply del equipo (`getPortalLastReplyAt`) es más nuevo que la última
    visita del cliente (localStorage `dtd-portal-soporte-seen`). Se limpia al entrar.
- **Fase 3 — deep-link + preferencia por-evento** (pend): link directo al hilo en
  `/studio/conversaciones` + toggle del evento "mensaje del portal" en prefs [[0036]].

## Fuera de alcance

- **Push al CLIENTE** cuando el equipo responde (el email ya cubre el aviso; el push
  del cliente necesita infra de suscripción en el portal — service worker + VAPID +
  UI de opt-in — feature aparte).
- **Realtime "de verdad"** en el portal (Supabase Realtime) — requeriría una policy
  RLS SELECT del cliente sobre sus propios `conversation_messages`; se prefirió el
  poller para no tocar la seguridad de esas tablas.
- **Round-robin / pool** para clientes SIN asesor asignado (hoy caen a los admins).

## Verificación

- `node scripts/verify.mjs` + `pnpm build` verdes.
- Un mensaje del portal con hilo **asignado** → el agente recibe campanita (y
  Telegram/push si opta) y NO se dispara a otros.
- Un mensaje con hilo **sin asignar** → los admins reciben el aviso.
- 3 mensajes seguidos del mismo cliente → **un solo** aviso (anti-spam por unread).
- Si el subsistema de notificaciones falla, el mensaje del cliente **igual se envía**
  (best-effort).
