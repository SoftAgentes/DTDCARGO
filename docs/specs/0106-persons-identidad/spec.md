---
sdd: "0106"
title: "Identidad por persona (cédula) — tabla persons + Shipping Mark opcional"
status: in-progress
author: "Claude Code (carril sdd-0106-persons-identidad) + founder"
created: 2026-06-24
updated: 2026-06-24
supersedes: null
superseded_by: null
related: ["0010", "0042", "0046", "0093", "0095"]
confidencialidad: interno
---

# SDD-0106 · Identidad por persona (cédula) — `persons` + Shipping Mark opcional

> Reestructura cómo se identifica al cliente. Hoy el identificador de facto es el **Shipping
> Mark** (`clients.markbox`, `DTD-NNNN`): `NOT NULL`, autogenerado, y ~80% de las tablas lo
> referencian por `client_markbox` (texto, sin FK). La cédula/RIF es nullable y secundaria
> (aunque ya tiene índice único normalizado por tenant, migr `0095`). La Academia está
> desconectada de la identidad (usa `student_name`/`student_ci` libres, sin vínculo a `clients`).

## 0. Por qué — y qué NO es (todavía)

**Objetivo (decisión del founder 2026-06-24):** la **cédula es el ancla estable** de una persona
a través de servicios (carga, academia, …); el **Shipping Mark es opcional/lazy** (se genera
cuando la persona necesita carga); se ubica al cliente **primero por cédula, después por Shipping
Mark**. Modelo: **nueva tabla `persons`** (cédula única por tenant) como ancla; `clients`/markbox =
"perfil de carga". Entrega **por fases**.

**Regla de oro de las fases:** NO re-apuntar de golpe las ~80% tablas que usan `client_markbox`
(shipments, quotes, invoices, prealertas, academia…) ni el RLS del portal
(`get_portal_client_markbox`). Siguen funcionando vía `clients`/markbox; la migración a
`person_id`/`client_id` es **gradual y opportunista**, no masiva.

**NO entra en este SDD (Slice A / Fase 1):**
- ❌ Unificar Academia a la persona (Fase 2).
- ❌ Cambiar la ruta de detalle `[markbox]` ni los comboboxes de cotizador/tracking/embarques (Fase 3).
- ❌ Tocar el RLS del portal o re-apuntar tablas con `client_markbox`.

## 1. Modelo objetivo

- **`persons`** = la persona (cédula normalizada única por tenant, nombre, doc_kind, contacto). Ancla de identidad.
- **`clients`** = perfil de carga de una persona (markbox **opcional**, dirección de entrega, advisor, tier, portal). Gana `person_id`.
- **`academy_enrollments`** (Fase 2) = gana `person_id`.

## 2. Alcance — Fase 1 (ESTE entregable)

### 2.1 Migraciones (`0170`–`0173`)
1. **`0170_persons.sql`** — tabla `persons`:
   - `id uuid pk`, `tenant_id fk tenants`, `national_id text` (cédula/RIF, nullable),
     `doc_kind text check (persona|empresa)`, `name text not null`, `email text`, `phone text`,
     `created_at/updated_at/deleted_at`, `legacy_client_id uuid` (auditoría del backfill).
   - **Índice único parcial normalizado** `(tenant_id, upper(regexp_replace(national_id,'[^A-Za-z0-9]','','g'))) where national_id is not null and deleted_at is null` — **espejo del de `0095`**.
   - RLS por tenant (patrón de `clients`), `touch_updated_at` trigger, grants explícitos.
   - **Backfill** en la misma migr: 1 `persons` por cliente vivo (`legacy_client_id = clients.id`); `clients.rif` ya es único por tenant → sin colisión; clientes sin rif → persona con cédula null.
2. **`0172_clients_person_link.sql`** — `clients.person_id uuid references persons(id)`; backfill `update clients set person_id = p.id from persons p where p.legacy_client_id = clients.id`.
3. **`0173_markbox_optional.sql`** — `alter table clients alter column markbox drop not null` + RPC `ensure_client_markbox(p_client_id uuid)` (genera y setea markbox si es null; reusa la lógica de `next_markbox`). **Fase 1 sigue autogenerando markbox en el alta** de carga; el null se habilita para academia-only en Fase 2.

### 2.2 Capa app (Studio · Clientes)
- `lib/studio/person-{types,queries}.ts` — tipo `Person`, validadores (reusa `RIF_REGEX`/`formatRif` de `client-types.ts`), queries puras que reciben `SupabaseClient`.
- `getClientByCedula(sb, tenantId, doc)` en `client-queries.ts` (normaliza igual que el índice de `0095`).
- `listClients`/`parseClientFiltersFromSearchParams`: lookup **cédula-first** (priorizar/normalizar la búsqueda por documento).
- `Client.markbox` pasa a `string | null` en `client-types.ts`; auditar usos que asumen no-null.
- UI de Clientes: elevar la cédula a identificador primario visible junto al Shipping Mark.
- **NO** cambiar la ruta `[markbox]` (Fase 3).

## 3. Roadmap (fuera de Fase 1)
- **Fase 2:** Academia → persona por cédula (`academy_enrollments.person_id`); academia-only = persona + `clients` sin markbox (portal sigue ligando a `clients.id`); validar formato de cédula en el alta de enrollment.
- **Fase 3:** comboboxes cédula-first (cotizador/tracking/embarques); decisión ruta `[markbox]` vs `[id]`; migración gradual de `client_markbox` → FK en features nuevas.

## 4. Seguridad / riesgos
- **markbox nullable ripple:** `Client.markbox` → `string | null`. En Fase 1 el runtime sigue poblado para clientes de carga → riesgo de tipos, no de datos.
- **Backfill:** `persons.count == clients-vivos.count`; todo `clients.person_id` no-null tras el link; el índice único rechaza cédula duplicada normalizada.
- Migraciones NO se aplican a prod por el agente (lo hace la coordinación/founder). Validar en branch efímero.

## 5. Verificación
- Migraciones en **branch efímero de Supabase**: aplicar `0170`–`0173`, chequear backfill (counts, links, unicidad), borrar branch.
- Vitest de normalización/lookup por cédula + validadores de `Person`; ajustar tests de clientes que asuman markbox no-null.
- `node scripts/verify.mjs` TODO VERDE.

## 6. Archivos
```
supabase/migrations/0170_persons.sql
supabase/migrations/0172_clients_person_link.sql
supabase/migrations/0173_markbox_optional.sql
lib/studio/person-types.ts            (nuevo)
lib/studio/person-queries.ts          (nuevo)
lib/studio/client-types.ts            (editar: markbox string|null)
lib/studio/client-queries.ts          (editar: getClientByCedula + lookup cédula-first)
app/studio/(app)/clientes/            (editar: UI cédula primary)
```
