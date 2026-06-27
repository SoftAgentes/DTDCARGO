---
sdd: "0043"
title: "Conector Kommo CRM — Alcance A (espejo read-only) + Alcance B (webhooks)"
status: done
author: "founder"
created: 2026-06-02
updated: 2026-06-27
supersedes: null
superseded_by: null
related: []
confidencialidad: interno
---

# DTD-0043 — Conector Kommo CRM (Alcance A: espejo read-only)

> Trae datos de Kommo CRM (leads, contactos, pipelines, etapas, custom fields) y los espeja en Supabase para que el ERP propio los consuma. Sin webhooks, sin escribir en Kommo, sin mapeo a entidades de negocio.

## Contexto

Kommo es el CRM externo que DTD usa hoy. Este módulo lo conecta como **fuente de datos** (NO es el CRM de producción; el CRM propio es una fase posterior). Multi-tenant desde el día 1 (tablas con `tenant_id` + RLS), aunque hoy hay una sola cuenta: `doortudoor.kommo.com`, tenant `dtd`.

## Alcance

**Incluye (Alcance A):**

- Credenciales seguras: long-lived token de Kommo en **Supabase Vault** (nunca en repo / columna / frontend).
- 7 tablas espejo + RLS por `tenant_id`.
- Edge Function `kommo-sync` que autentica con Kommo, pagina, hace UPSERT idempotente y registra en `sync_logs`.
- Invocación manual (backend).

**Fuera de alcance (fases posteriores):**

- Webhooks de Kommo → **Fase B** (se monta sobre estas mismas tablas, sin reescribir).
- Escribir en Kommo (crear/editar leads, etapas, etc.).
- Mapeo Kommo → entidades de negocio del ERP (cliente / envío / contenedor).
- OAuth 2.0 (onboarding multi-cliente).
- Dashboard, KPIs, "tiempo por etapa".

## Diseño

### Datos (migraciones)

- **`0082_kommo_mirror_schema`** — `kommo_connections`, `kommo_pipelines`, `kommo_statuses`, `kommo_custom_fields`, `kommo_contacts`, `kommo_leads`, `sync_logs`. RLS habilitado (no forzado): SELECT tenant-scoped para `authenticated` + policy `all` para `service_role` (patrón de 0033). `tenants` se reusa (existe en 0001).
- **`0083_kommo_statuses_pk_pipeline`** — PK de `kommo_statuses` → `(tenant_id, pipeline_id, id)`. Las etapas reservadas de Kommo (142 "ganado" / 143 "perdido") se repiten en cada pipeline con el mismo `id`, por eso la clave natural incluye `pipeline_id`.

### Credenciales

- Token en Vault (`vault.create_secret`, secret name `kommo_token_dtd_v1`). `kommo_connections` guarda solo el **nombre** del secreto, nunca el token.
- Lectura en runtime: `kommo_get_token(connection_id)` — `security definer`, `search_path=''`, ejecutable **solo por `service_role`**.

### Edge Function `supabase/functions/kommo-sync/`

- **`kommoFetch` (M4)**: 204/401/429/5xx con backoff + reintentos; delay ~150 ms (≤7 req/s).
- **`paginateTwoPass` (M2)**: dos pasadas `order[updated_at]` + `order[created_at]` desc, dedupe por id, corte por página incompleta o 204, tope 20 páginas/pasada.
- **`getFieldValue` (M1)**: lee `custom_fields_values` por keyword (para la capa de normalización futura).
- **UPSERT idempotente (M3)** por la PK de cada tabla; re-ejecutar no duplica.
- Orquesta: pipelines → statuses → custom_fields (leads + contacts) → contacts → leads; una fila en `sync_logs` por entidad.

### Auth de invocación (decisión)

`verify_jwt = OFF`: las API keys nuevas de Supabase (`sb_secret_*` / `sb_publishable_*`) **no son JWT**, y el gateway con `verify_jwt=on` las rechaza (`401 UNAUTHORIZED_INVALID_JWT_FORMAT`). El guard quedó **dentro** de la función: exige el `service key` del proyecto en `Authorization`/`apikey`. La función **no** queda pública. (Cambio aprobado por el founder.)

## Criterios de aceptación — verificados E2E (2026-06-02)

- ✅ Migraciones aplican limpio (0082 + 0083).
- ✅ RLS por `tenant_id` (un tenant no ve filas de otro).
- ✅ Token solo en Vault, leído en runtime; nada en repo/texto plano.
- ✅ `kommo-sync` trae datos reales: **10 pipelines · 62 statuses · 22 custom_fields · 2.683 contactos · 2.658 leads**.
- ✅ Re-ejecutar no duplica (conteos idénticos en la 2ª corrida).
- ✅ `sync_logs` registra cada corrida con conteos + estado.

## Deuda conocida

- `status='error'` bloquea el próximo invoke hasta reset manual a `active` (mejorar en Fase B: auto-reset on invoke).
- M3 "no pisar con `updated_at` más viejo" es no-op (suficiente en Alcance A; relevante con webhooks fuera de orden).
- `KOMMO_API_REFERENCE.md` no está en el repo; el modelo de la API v4 quedó validado contra la API real durante el E2E.
- El gate `node scripts/verify.mjs` no cubre Deno (1ª Edge Function del repo).

## Alcance B · Webhooks (push en vivo)

> Se monta sobre las MISMAS tablas `kommo_*` del Alcance A, sin reescribir el pull. El pull diario de pg_cron (`kommo_run_sync`) queda como **backstop de reconciliación**.

### Qué incluye

- Edge Function `supabase/functions/kommo-webhook/` (Deno, `verify_jwt = OFF`): recibe el POST form-urlencoded de Kommo cuando un lead/contacto cambia y espeja el cambio en segundos.
- Lógica **pura y testeable** en `supabase/functions/_shared/` (dentro del árbol que Supabase Edge Functions bundlea; cubierta por Vitest dentro de `node scripts/verify.mjs`):
  - `kommo-webhook-parse.ts` · `parseKommoWebhookPayload(formBody)` → eventos `{entity, action, id}` + `subdomain` + `accountId`. Parsea el form-urlencoded anidado de Kommo (`leads[add][0][id]`, `…[update]`, `…[status]`, `…[delete]`, `contacts[…]`, `account[subdomain|id]`), ignora ruido y **deduplica por (entity,id) con la acción más fuerte** (delete > status > update > add).
  - `kommo-mapping.ts` · `mapLeadRow` / `mapContactRow` / `epochToIso` → la **misma forma de fila** que el sync read-only. `sync.ts` fue refactorizado para importar estas funciones (single source of truth; extracción mecánica, comportamiento idéntico). Deno y Vitest comparten el módulo TS. Vive en `supabase/functions/_shared/` (no en `lib/`) porque las Edge Functions de Supabase solo bundlean código dentro de `supabase/functions/`.
- Migración `0107_kommo_webhook_guard.sql` · trigger `BEFORE UPDATE` en `kommo_leads` y `kommo_contacts` que descarta updates con `kommo_updated_at` más viejo (orden fuera de secuencia).

### Flujo del webhook

1. **Auth**: `?secret=` vs `KOMMO_WEBHOOK_SECRET` (comparación de longitud-constante). 403 si no matchea — único 4xx.
2. Parsea el body; sin eventos → 200.
3. Resuelve la conexión por `account[subdomain]` → `tenant_id` + token (Vault vía `kommo_get_token`). Sin conexión/token → **200** (no 4xx, para que Kommo no reintente en loop), con log.
4. add/update/status → `kommoFetch` la entidad por id → `map*Row` → `upsertRows` (reusado de `sync.ts`). delete → borra la fila (`tenant_id`+`id`).
5. Registra en `sync_logs` (`entity` = `webhook_leads` / `webhook_contacts`) y **resetea `kommo_connections.status='active'` + `last_error=null`** en éxito.
6. Responde 200 salvo secret inválido (403) o error interno irrecuperable (500). Errores logueados sin filtrar secretos.

### Qué arregla de la deuda conocida (Alcance A)

- **Deuda #1** (`status='error'` bloquea el próximo invoke): el webhook resetea `status='active'` en cada éxito → la conexión se destraba sola.
- **Deuda #2** ("no pisar con `updated_at` más viejo" era no-op): ahora lo fuerza el trigger de la migr 0107 a nivel DB, cubriendo webhooks fuera de orden.

### Fuera de alcance (Alcance B)

Escribir en Kommo · mapeo Kommo→entidades de negocio (cliente/envío/contenedor) · OAuth multi-cliente · adjuntos de Kommo · UI nueva grande.

### Notas de despliegue

- La function y la migración **NO** se aplican desde el harness — las aplica el founder por MCP.
- Setup del founder (secret de la function + config del webhook en Kommo): `docs/runbooks/setup-kommo-webhook.md`.
- El gate `node scripts/verify.mjs` cubre el parser + el mapping + los tests (Node); la Edge Function Deno queda excluida del gate (tsconfig + eslint) como en Alcance A.

## Adjuntos

Prompt fuente del alcance: `PROMPT_CLAUDE_CODE_kommo_conexion_A.md` (raíz del repo).
