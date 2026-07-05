---
sdd: "0147"
title: "Soporte del portal a Norte — fusión de Reclamos + chat con el asesor en una pantalla"
status: in-progress
author: "Claude Code (sesión Director) + founder"
created: 2026-07-04
updated: 2026-07-04
supersedes: null
superseded_by: null
related: ["0042", "0056", "0101", "0102", "0145"]
confidencialidad: interno
---

# SDD-0147 · Soporte del portal a Norte (fusión Reclamos + chat)

> Lleva el hub **Soporte** del portal al diseño del Norte: **una sola pantalla**
> con **Tus casos** (los reclamos, con número/estado/seguimiento) a la izquierda y
> el **chat con tu asesor** a la derecha. Hoy son dos pestañas separadas
> (`Mensajes` · `Reclamos`); el Norte los funde en "Soporte" — hablás con el
> agente o abrís un caso con seguimiento, todo en un lugar.

## Contexto / problema

El portal ya migró a Norte (Inicio · Alertas · Finanzas · Perfil). **Soporte** es
lo último que falta. Hoy el destino "Soporte" del top-nav abre dos sub-pestañas
independientes:

- **Mensajes** (`/portal/mensajes`, SDD-0056 · Conversaciones): hilo libre
  cliente↔asesor. El mensaje entra a la bandeja del Studio (Conversaciones) como
  inbound; se responde por el portal y, si hay email, por correo.
- **Reclamos** (`/portal/reclamos`, SDD-0101/0102): casos formales con número
  (`SP-2026-NNNN`), tipo (faltante/demora/daño…), estado con pasos y gate de pago
  en la DB. Tiene su propio hilo de mensajes por caso.

El **prototipo Norte** (`docs/design/studio/_norte/portal/app.jsx` · `PortalSupport`,
líneas ~1581-1877) los presenta **fusionados** en una pantalla "Soporte":

- **Columna izquierda — TUS CASOS**: lista de casos (número + badge de tipo +
  estado + "Paso N de 3") + botón "Nuevo caso". Vacío → EmptyState.
- **Columna derecha — Agente + canales**: card de chat con el asesor (avatar +
  nombre + presencia "En línea"), hilo, caja de envío; debajo, "Otros canales"
  (WhatsApp + Email) — **WhatsApp deja de ser el CTA hero** y baja a canal alterno.

Decisión del founder (2026-07-04): **hacer la fusión completa como SDD** (no el
parche chato). El acceso a soporte del cliente es por el **chat interno**, no
WhatsApp (ver también el fix de "Actualizar mis datos" en Mi perfil, ya en prod).

## Objetivo

Una pantalla **`/portal/soporte`** (Norte) que:

1. Muestre **Tus casos** (reclamos) a la izquierda con su número/tipo/estado/paso,
   "Nuevo caso" y navegación al detalle del caso (hilo + seguimiento).
2. Muestre el **chat con el asesor** a la derecha (hilo de Conversaciones +
   caja de envío), con la identidad del asesor asignado.
3. Baje **WhatsApp** a "Otros canales" (junto a email/teléfono), sin CTA hero.
4. Reutilice **sin migración** los dos backends existentes (Conversaciones y
   Reclamos) — es un rediseño de presentación + fusión de navegación, no un
   modelo de datos nuevo.

## Estado actual (lo que ya existe y se reutiliza)

- **Conversaciones** (SDD-0056, migr 0106): `getPortalThread(admin, clientId)`,
  `sendPortalMessageAction`, `getPortalAdvisor`. Hilo + envío ya funcionan
  (`PortalMessageForm`, `mensajes/page.tsx`). Prefill por `?tema=` ya soportado.
- **Reclamos** (SDD-0101/0102, migr 0152-0157): tablas de casos + hilo por caso +
  gate de pago en DB (índice único parcial para idempotencia). Componente
  `PortalClaims` (`reclamos/_components/PortalClaims.tsx`) + `reclamos/page.tsx`.
- **Navegación**: `SoporteHubTabs` (Mensajes · Reclamos) en `PortalHubTabs.tsx`;
  el top-nav "Soporte" apunta al hub.
- **Asesor**: `clients.advisor_id` (ERP→Norte); si no hay, degrada al contacto
  público del CRM.

## Diseño / enfoque

### Ruta y navegación
- Nueva pantalla unificada en **`/portal/soporte`** (server component) que
  compone casos + chat. `/portal/mensajes` y `/portal/reclamos` **redirigen** a
  `/portal/soporte` (`permanentRedirect`) — sin romper links viejos (patrón
  `/portal/cuenta`→`/portal/perfil` de SDD-0145). El detalle de un caso vive en
  `/portal/soporte/[caso]` (o se reusa `reclamos/[id]`), a decidir en build.
- `SoporteHubTabs` se retira (o queda con un solo destino); "Soporte" del top-nav
  apunta a `/portal/soporte`.

### Layout (grid `1.7fr / 1fr`, como el resto del Norte)
- **Izquierda — Tus casos**: reutiliza la data/acciones de `PortalClaims`
  (lista + "Nuevo caso" + navegación al detalle). Se re-estiliza al patrón Norte
  (eyebrow "TUS CASOS", cards con número mono + badge de tipo + badge de estado +
  "Paso N de 3"). Cero cambio de backend.
- **Derecha — Chat del asesor**: card con header (avatar + nombre del asesor +
  presencia), hilo (`getPortalThread`) y `PortalMessageForm`. Debajo, card
  **"Otros canales"** con WhatsApp + Email + Teléfono (de `CONTACT.ve`).

### Presencia "En línea" (el punto sensible)
El prototipo muestra "En línea" del agente. Presencia real requiere trackear el
estado online del staff (realtime) — **fuera de V1**. Propuesta V1:
- Mostrar el asesor asignado (nombre/cargo) **sin** indicador de presencia falso,
  o con un indicador honesto de **horario/SLA** ("Te responde en el día",
  "Horario Lun-Vie 9-18"). El chat "no está activo todavía" (founder) → V1 deja
  claro que se responde por acá + email, sin prometer tiempo real.

### Reutilización / no-duplicación
- El backend de Reclamos y Conversaciones **no se toca** (sin migración). El
  gate de pago, idempotencia y RLS por markbox de Reclamos siguen intactos.
- Se comparten helpers de badge/estado de reclamos ya existentes.

## Fases propuestas

- **Fase 1 — Shell + fusión de navegación**: crear `/portal/soporte`, redirects
  de `/mensajes` y `/reclamos`, top-nav → soporte, retirar `SoporteHubTabs`.
- **Fase 2 — Columna Tus casos (Norte)**: portar `PortalClaims` al layout/estilo
  Norte dentro de la pantalla; "Nuevo caso" + detalle del caso.
- **Fase 3 — Columna Chat del asesor (Norte)**: card de chat (asesor + hilo +
  envío) + "Otros canales" (WhatsApp/email/teléfono). WhatsApp baja a alterno.
- **Fase 4 — Pulido**: EmptyStates, responsive (apilado en móvil), a11y, dark.

## Decisiones del founder (2026-07-04 · resueltas)

1. **Ruta**: ✅ `/portal/soporte` nueva, con `permanentRedirect` de `/mensajes` y
   `/reclamos`.
2. **Presencia del agente**: ✅ **V1 honesto** — se muestra el asesor asignado +
   indicador de **horario/SLA** ("Te responde en el día" / horario), **sin** el
   "En línea" del prototipo (no trackeamos presencia real; el chat aún no es
   tiempo real). Presencia realtime = feature aparte, fuera de este SDD.
3. **Nuevo caso desde el chat**: ✅ **No** en V1 — el chat libre y "Nuevo caso"
   quedan como dos acciones separadas en la misma pantalla, sin puente
   automático chat→reclamo.

## Fuera de alcance (V1)

- Presencia realtime del staff.
- Adjuntos nuevos en el chat libre (los de reclamos ya existen).
- Cambios al modelo de datos de Reclamos o Conversaciones (cero migración).

## Verificación

- `node scripts/verify.mjs` + `pnpm build` verdes.
- Redirects de `/mensajes` y `/reclamos` → `/soporte` (301).
- El hilo del asesor y "Nuevo caso"/detalle de reclamo siguen funcionando igual
  (mismo backend), ahora en la pantalla fusionada.
- Dark + claro OK; móvil apila casos arriba / chat abajo.
