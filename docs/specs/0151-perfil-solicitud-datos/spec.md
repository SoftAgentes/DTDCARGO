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
