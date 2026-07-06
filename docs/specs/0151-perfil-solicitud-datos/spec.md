---
sdd: "0151"
title: "Perfil cliente — aviso de pendientes in-page + solicitud de cambio de datos con aprobación del asesor"
status: done
author: "Claude Code (worktree perfil-solicitud-datos) + founder"
created: 2026-07-06
updated: 2026-07-06
supersedes: null
superseded_by: null
related: ["0042", "0138", "0145"]
confidencialidad: interno
---

# SDD-0151 · Perfil cliente: aviso de pendientes + solicitud de cambio de datos

> Pedido founder 2026-07-06. Dos mejoras sobre "Mi perfil" (`/portal/perfil`,
> SDD-0145): (1) que adentro del perfil quede **claro qué falta** (hoy el aviso
> solo vive en el dashboard), y (2) que el cliente pueda **proponer un cambio a
> sus datos de identidad**, que el asesor **aprueba dentro del Studio** antes de
> que se apliquen a la ficha.

## Contexto

Hoy en `/portal/perfil`:

- El aviso "Completa tu perfil" (`ProfileIncompleteCard`) vive **solo en el
  dashboard** (`/portal`). Al entrar al perfil el cliente pierde la señal y solo
  queda el punto ámbar tenue de la fila de cédula. → **no llama la atención**.
- "Actualizar mis datos" **no edita nada**: es un link al chat con el asesor
  (`/portal/soporte?tema=datos`). Todo dato de identidad lo carga el asesor a
  mano. Si hay un typo en el nombre o la cédula, el cliente no puede corregirlo.

Los datos de identidad son **documentación registrada** (ISO 9001) con reglas
duras: `rif` único, validación nombre+documento sin duplicados
(`project_client_identity_validation`). Por eso el cliente **no** escribe
directo: propone y el asesor aprueba (queda traza de quién y cuándo).

## Alcance

### Fase A · Aviso claro dentro de Mi perfil *(UI puro, sin DB)*

- **Banner "Datos por completar"** arriba del perfil (`ProfilePendingBanner`,
  estilo ámbar reusando el del dashboard). Cada pendiente es un **ancla** que
  baja a su sección: `#doc-identidad` (foto cédula/RIF) · `#direcciones`.
- **Badge "1 pendiente"** en el header de *Identidad y documentos* cuando falta
  la foto. Texto en grey-700 (AA; el ámbar lo llevan punto + borde).
- **Borde izquierdo ámbar** en la fila de cédula cuando está pendiente.
- Señal = `getProfileCompleteness()` (misma fuente que el dashboard).

### Fase B · Base de datos — `client_change_requests` (migración 0220)

Tabla de solicitudes de cambio de datos del cliente:

- Campos propuestos (whitelist): `proposed_name`, `proposed_rif`,
  `proposed_phone`. **Nunca** markbox (código) ni email.
- `status`: `pending | approved | rejected`.
- Traza: `submitted_at`, `reviewed_at`, `reviewed_by`, `review_note`.
- Snapshot del valor anterior (`prev_name`/`prev_rif`/`prev_phone`) para el diff
  y para auditoría (qué se cambió, aunque la ficha ya mutó).
- **Una sola solicitud abierta a la vez** por cliente → índice único parcial
  `WHERE status = 'pending'`.
- RLS: el cliente (portal) **ve y crea las suyas** vía `get_portal_client_id`
  (INSERT + SELECT self-scope); nunca UPDATE (no puede auto-aprobar). El asesor
  opera con service_role desde el Studio (RLS por tenant, no por rol).

### Fase C · Portal — el cliente propone

- "Actualizar mis datos" abre un **editor** (los 3 campos prellenados). Al
  enviar **crea la solicitud PENDING** (no toca `clients`). Código y email se
  muestran fijos, no editables.
- Mientras haya una solicitud abierta: estado **"En revisión"** + no deja
  reenviar (refleja el índice único parcial; UX antes que el 23505).
- Server action con el patrón del portal: identidad por SESIÓN
  (`get_portal_client_id`) → INSERT scopeado a ese id.

### Fase D · Studio — el asesor aprueba

- En `/studio/clientes/[markbox]`: card **"Solicitud de cambio pendiente"** con
  el diff *antes → propuesto* y botones **Aprobar / Rechazar**.
- **Aprobar** → aplica los campos a `clients` (respetando `rif` único; si choca,
  error claro), marca `approved` + `reviewed_by/at`.
- **Rechazar** → marca `rejected` + `review_note` (opcional). El cliente puede
  proponer de nuevo.
- **Aviso al asesor** por Telegram al crearse la solicitud (reusa el patrón de
  notificaciones existente).

## No-objetivos

- No edita email ni markbox (código) — fijos por diseño.
- No es edición directa self-service: siempre pasa por aprobación.
- No cubre cambio de dirección (ya existe SDD-0138, flujo aparte).

## Seguridad / datos

- El cliente nunca escribe `clients` (RLS read-only); solo INSERT en
  `client_change_requests` self-scope. La aplicación a la ficha la hace el Studio
  (service_role, tras aprobación humana).
- `rif` único se valida en la aprobación (no dejar duplicados).
- PII (nombre/cédula/teléfono) vive en Supabase con RLS, nunca en git.

## Verificación

`node scripts/verify.mjs` + `pnpm build`. E2E manual: cliente propone → asesor
ve diff → aprueba → ficha actualizada + solicitud approved.

## Adenda 2026-07-06 · post-merge

Dos ajustes tras la primera corrida (migración 0220 ya en prod):

- **Reset de verificación de identidad al cambiar nombre/RIF.** Al aprobar un
  cambio que toca `name` o `rif`, se limpian los `doc_verify_*` (SDD-0046) para
  forzar re-verificación — la ficha ya no queda "verificada" contra un documento
  viejo. Mismo criterio en el edit directo del admin (`updateClientAction`).
  Helper compartido `lib/studio/identity/reset-on-change.ts` (con test).
- **Aviso al cliente al resolverse.** Push web al cliente cuando su solicitud se
  aprueba o rechaza (con motivo), reusando `sendPushToUserDevices` +
  `client_users` activos (patrón SDD-0148). Abre `/portal/perfil`. Best-effort.
- E2E validado como dry-run transaccional en prod (índice único parcial +
  loop propone→aprueba+reset), sin residuo.

## Adenda 2026-07-06 · menores + backlog del área

Sobre lo anterior:

- **Cancelar solicitud (cliente).** En "En revisión", botón con confirm de 2
  pasos → `cancelDataChangeRequestAction` borra la pendiente (service_role,
  scopeada) y libera el índice → puede proponer de nuevo.
- **Historial en el Studio.** `listResolvedChangeRequests` + `ChangeRequestHistory`
  (read-only) en la ficha: resueltas con badge, fecha, diff y motivo.
- **#1 Ruteo del aviso.** El Telegram de una solicitud va al **asesor asignado**
  del cliente (`advisor_id`) si tiene Telegram; sin asesor / sin Telegram →
  broadcast a admins (patrón SDD-0148). Quita ruido al equipo.
- **#2 Quién revisó.** El historial muestra el nombre del revisor
  (`reviewed_by` → `user_profiles`, `resolveReviewerNames`).
- **#3 Traza de edits del equipo (migración 0221).** Columna `source`
  (`client|admin`). Si el equipo cambia nombre/RIF/teléfono directo en la ficha
  (`updateClientAction`), se registra una fila `source='admin'` auto-aprobada →
  aparece en el historial junto a lo del cliente (badge "Editado por el equipo").
  Las queries del portal filtran `source='client'` (el cliente solo ve lo suyo).
- **#4 Nudge de re-verificación.** Al aprobar un cambio que reseteó la
  verificación, el toast del asesor lo avisa ("identidad quedó sin verificar,
  conviene re-verificar"). `approveChangeRequestAction` devuelve `identityReset`.
- **#6 Robustez.** Historial hasta 20 (antes 10). Outbox durable para
  notify/push **diferido** (deuda sistémica compartida con Bug Reporter — hoy
  best-effort `console.error`).

### Decisión · cambio de email (no se implementa)

El **email queda fijo** (no editable por el cliente ni vía solicitud). Razón: es
la **identidad de auth** del portal (magic-link contra `auth.users.email`).
Cambiar `clients.email` NO cambia el login del cliente → sería un cambio a medias
y confuso. Un cambio de email real exige re-vincular `auth.users` (Supabase Auth)
+ re-verificar el correo nuevo — flujo aparte, sensible, fuera del alcance de
SDD-0151. Si el founder lo pide, se hace como spec propia (toca auth). Por ahora:
cambios de correo se manejan por el asesor / soporte.
