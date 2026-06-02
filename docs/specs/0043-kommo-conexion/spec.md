---
sdd: "0043"
title: "Conector Kommo CRM — Alcance A (espejo read-only)"
status: done
author: "founder"
created: 2026-06-02
updated: 2026-06-02
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

## Adjuntos

Prompt fuente del alcance: `PROMPT_CLAUDE_CODE_kommo_conexion_A.md` (raíz del repo).
