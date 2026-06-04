---
sdd: "0055"
title: "Calculadora — configuración desde el Studio (Fase 3): ciudades + estados de tarifa + importador"
status: in-progress
author: "Claude Code (carril calculadora · worktree feat/calculadora)"
created: 2026-06-04
updated: 2026-06-04
supersedes: null
superseded_by: null
related: ["0008", "0002", "0101"]
confidencialidad: interno
---

# DTD-0055 — Calculadora configurable desde el Studio (Fase 3)

> Mueve la configuración del **calculador público LCL DDP** (hoy hardcoded en
> `lib/calculadora.ts`) a la base de datos, editable desde **`/studio/tarifas`**, sin
> que el sitio público cruce la frontera al ERP. Continúa la **Fase 2** (tarifa base +
> piso vía `rates.is_public`, SDD-0101) y la **Fase 3 Slice A** (8 parámetros escalares
> → `calculator_settings`, commit `eaa0eec`).

## 1. Resumen en una línea
Dos piezas nuevas — **Slice B**: las **ciudades** del calculador (hoy array hardcoded
`CIUDADES`) → tabla `calculator_cities` editable, leída por el público vía RPC anon;
**Slice C**: **estados de tarifa** (`draft`/`published`/`archived`) sobre `rates` para
preparar tarifas antes de publicarlas + un **importador masivo** de tarifas.

## 2. Por qué (grounding)
- **Hoy es hardcode:** `lib/calculadora.ts:133` tiene `CIUDADES` (15 ciudades VE + km
  desde Valencia + flag `casco`) literal en el código → cambiar una ciudad/distancia
  exige un deploy. Slice A ya movió los 8 parámetros escalares a `calculator_settings`;
  las ciudades quedaron pendientes (Slice B).
- **No hay borrador de tarifa (0008 §96):** "Estados de tarifa (draft/published/archived)
  — no hay; toda tarifa [es live]". El admin no puede preparar una tarifa nueva sin que
  impacte de inmediato. Slice C agrega el lifecycle + carga masiva.
- **La frontera es dura:** el sitio público (`app/calculadora`, `lib/calculadora`,
  `components/CalculadoraForm`) NUNCA importa `@/lib/studio`/`@/lib/db`. Lee la config por
  **RPCs anon de retorno mínimo** (`lib/public/rates-queries.ts`), igual que la tarifa de
  Fase 2. Esto se mantiene intacto.

## 3. Decisiones ancladas
1. **Frontera intacta + zero-regression (como Fase 2/Slice A):** el público lee por RPC
   anon; si la DB no tiene filas, **fallback a los defaults hardcoded** (`CIUDADES`,
   `DEFAULT_PARAMS`) → nada se rompe sin config. Los RPC anon devuelven **retorno mínimo**
   (jamás `tenant_id` ni columnas internas).
2. **Migración aditiva `0104`** (siguiente libre mirando todas las ramas; 0103 = settings).
   **NO** se aplica a prod en esta corrida (la aplica el founder).
3. **Ciudades (Slice B):** tabla `calculator_cities` por tenant; `calcularEnvioLCL` recibe
   la lista de ciudades (como ya recibe `params`) en vez de leer el array global → la
   función pura sigue testeable y el público le inyecta lo de la DB (o el fallback).
4. **Estados de tarifa (Slice C):** `rates.status` enum `draft|published|archived`. La
   tarifa **pública** del calculador = la que es `is_public` (singleton de Fase 2) **y**
   `published`. `draft` = preparada, NO live. Publicar = `draft→published`; archivar =
   `→archived`. El RPC público sólo devuelve la `published` + `is_public`.
5. **Importador (Slice C):** carga masiva de tarifas pegando CSV (textarea) → parse +
   validación + **preview** antes de insertar; las filas entran como **`draft`** (se revisan
   y publican aparte, no van live de una). Sin dependencias nuevas (parser propio, no libs).
6. **Sin Zod** (validadores propios). Patrones del Studio (server actions + `useActionState`).

## 4. Approach

### Migración `0104_calculator_cities_rate_status.sql` (aditiva · NO a prod)
- **`calculator_cities`**: `id uuid pk`, `tenant_id → tenants`, `slug text` (sin espacios),
  `label text`, `km numeric(10,1)` (≥0), `casco boolean not null default false`,
  `sort_order int default 0`, `deleted_at`, `created_at`, `updated_at`.
  `unique(tenant_id, slug) where deleted_at is null`. RLS por tenant (read authenticated;
  write admin; `service_role all`). **Seed** las 15 ciudades actuales de `lib/calculadora.ts`
  para el tenant `dtd` (idempotente `on conflict do nothing`).
- **`rates.status`**: `add column status text not null default 'published'` con
  `CHECK (status in ('draft','published','archived'))`. Backfill: las existentes quedan
  `published` (no cambia nada). El singleton de `is_public` de 0101 se mantiene; opcional
  reforzar índice para exigir `status='published'` en la pública.
- **RPC anon** `public_calculator_cities(p_tenant uuid default null)` → filas
  `(slug, label, km, casco)` de retorno MÍNIMO (security definer, `set search_path=public`,
  grant anon+authenticated), resuelve el tenant `dtd` por default igual que `public_cbm_rate`.
- (El RPC `public_cbm_rate` de 0101 debe filtrar además `status='published'` si se agrega el
  estado — confirmá su cuerpo y ajustá para que un `draft` no se sirva nunca.)

### `lib/calculadora.ts` (función pura — refactor mínimo)
- `calcularEnvioLCL(input, params, ciudades?)`: aceptar la **lista de ciudades** como 3er
  arg (default `CIUDADES`, el array actual). Resolver `ciudad` desde esa lista. Esto NO
  cambia el comportamiento con el default → los tests existentes siguen verdes.
- `CIUDADES` queda como **fallback** exportado (defaults), igual que `DEFAULT_PARAMS`.

### `lib/public/rates-queries.ts` (frontera pública)
- `getPublicCalculatorCities()` → llama el RPC anon, mapea a `Ciudad[]`; `[]`/error → el
  caller cae al fallback. Mismo estilo que `getPublicCbmRate`/`getPublicCalculatorConfig`.

### `app/calculadora/page.tsx` + `components/CalculadoraForm.tsx`
- La page (server) fetchea `getPublicCalculatorCities()` junto a rate+config; si vacío →
  `CIUDADES`. Pasa la lista a `CalculadoraForm` (que hoy importa `CIUDADES` directo) y al
  cálculo. El form usa la lista recibida para el dropdown de destino.

### Studio `/studio/tarifas` (admin)
- **Ciudades (Slice B):** panel/tab "Ciudades" — CRUD de `calculator_cities` (agregar/editar/
  borrar + label + km + casco + orden). Queries en `lib/studio/calculator-cities-{queries,types}.ts`;
  actions en `tarifas/actions.ts` (`revalidatePath("/calculadora")`). Admin-only.
- **Estados + importador (Slice C):** en `TarifasClient`/`RateDrawer` — badge de estado +
  acciones **Publicar**/**Archivar** (con `<ActionButton>`); **Importador** = drawer con
  textarea CSV → parse + preview + insertar como `draft`. Validación propia + dedup por
  `(service,origin,destination)`.

## 5. Acceptance
- [x] **Slice B:** `calculator_cities` + RLS + seed; RPC anon `public_calculator_cities`
      (retorno mínimo); `calcularEnvioLCL` con ciudades inyectadas (tests existentes verdes);
      el calculador público usa las ciudades de la DB con fallback a `CIUDADES`; UI admin CRUD
      de ciudades en /studio/tarifas (admin-only) con `revalidatePath("/calculadora")`.
- [x] **Slice C:** `rates.status` (draft/published/archived) + backfill published; el RPC
      público sirve sólo `published`+`is_public` (un `draft` NUNCA se sirve); UI de estados
      (publicar/archivar) + importador CSV con preview que inserta como `draft`.
- [x] Frontera intacta (público no importa `@/lib/studio`/`@/lib/db`; lee por RPC anon).
      Zero-regression con DB vacía (fallback). Sin Zod.
- [x] `node scripts/verify.mjs` 🟢. Migración `0104` **NO** aplicada a prod.

## 6. Fuera de alcance
- **NO** scraping ni tarifas automáticas. **NO** multi-moneda en el importador (USD).
- **NO** versionado histórico de ciudades (soft-delete alcanza). **NO** tocar la frontera.
- **NO** aplicar `0104` a prod (la aplica el founder). **NO** mover la tarifa base/piso
  (siguen en `rates.is_public`, Fase 2).

## 7. Notas de implementación

### Migración `0104_calculator_cities_rate_status.sql` (aditiva · NO a prod)
- **`calculator_cities`**: tal como el plan. `unique(tenant_id, slug) where deleted_at is null`,
  CHECK `km >= 0` + `length(trim(slug)) > 0`. RLS: read = cualquier usuario del tenant;
  **write (insert/update) = solo ADMIN del tenant** (subselect inline a `user_tenants` con
  `role='admin' and disabled_at is null`, patrón de 0029); `service_role all`. GRANTs
  explícitos (`authenticated` select/insert/update + `service_role all`). Seed idempotente
  de las 15 ciudades de `CIUDADES` para el tenant `dtd` con `on conflict (tenant_id, slug)
  where (deleted_at is null) do nothing`.
- **RPC `public_calculator_cities(p_tenant uuid default null)`** → `(slug,label,km,casco)`,
  retorno mínimo, security definer + `set search_path=public`, resuelve `dtd` por default,
  grant anon+authenticated. Orden `sort_order, label`.
- **`rates.status`** = `add column ... not null default 'published'` + CHECK por `do $$`
  guard (idempotente). Backfill automático por el default → existentes `published`.
- **`public_cbm_rate()`** (de 0101) reescrita: ahora exige además `r.status = 'published'`
  → un `draft`/`archived` nunca se sirve al público. Resto del cuerpo idéntico.

### Calculador puro + frontera
- `calcularEnvioLCL(input, params, ciudades = CIUDADES)`: 3er arg con default → cero
  cambio de comportamiento con el default; la ciudad se resuelve desde la lista inyectada.
- `lib/public/rates-queries.ts` → `getPublicCalculatorCities()` (RPC anon, mapea `slug→id`,
  descarta filas corruptas, error/[] → caller usa fallback). `app/calculadora/page.tsx`
  fetchea las 3 fuentes en paralelo y pasa `ciudades` (o `CIUDADES`) al form + al cálculo;
  `CalculadoraForm` usa la lista recibida para el dropdown y el destino inicial.

### Studio `/studio/tarifas`
- **Ciudades (Slice B):** `lib/studio/calculator-cities-{queries,types}.ts` (validador propio
  con `slugify` + `validateCityInput`); pestaña **"Ciudades"** (`CiudadesPanel` + `CityDrawer`)
  con CRUD admin-only — la página resuelve `isAdmin` (`user_tenants.role`, filtrado por
  `user_id`) y lo pasa al cliente; no-admin ve solo lectura. Actions `createCityAction` /
  `updateCityAction` / `deleteCityAction` (soft-delete) chequean `isAdmin` server-side además
  de la RLS. `revalidatePath("/calculadora")`.
- **Estados (Slice C):** `rate-types.ts` agrega `RateStatus` + `rateStatusLabel/Tone`;
  `RATE_COLUMNS` incluye `status`. Badge de estado + **Publicar** (`draft→published`, respeta
  el singleton de `is_public` reusando `isPublicRateConflict`) y **Archivar** (`→archived` +
  `is_public=false` para no servir un archivado) con `<ActionButton>` tanto en la tabla como
  en el `RateDrawer` (edit). El create manual queda `published` (default DB) → cero regresión.
- **Importador (Slice C):** `lib/studio/rate-import.ts` (parser CSV propio sin libs:
  comillas dobles, encabezado en cualquier orden, validación por fila, dedup interno por
  `(service,origin,destination)` case-insensitive). `ImportRatesDrawer` (textarea + "Validar"
  → preview por fila + "Importar como borrador"). `importRatesAction` dedup además contra la
  DB (llaves vivas del tenant) e inserta las nuevas como `status='draft'`, `is_public=false`.

### Tests (Vitest)
- `__tests__/calculadora-ciudades.test.ts` — ciudades inyectadas cambian el cálculo,
  fallback a `CIUDADES`, ciudad ausente → `ciudad_invalida`. Los tests existentes de
  `__tests__/calculadora.test.ts` siguen verdes (default no cambió).
- `lib/studio/__tests__/rate-import.test.ts` — parser/validador/dedup (válidas, inválidas,
  duplicadas internas case-insensitive, errores globales de encabezado/CSV vacío).
- `lib/studio/__tests__/calculator-cities-types.test.ts` — `slugify` + `validateCityInput`
  (km≥0, slug no vacío/válido, sort_order).

### Pendiente del founder
- Aplicar `0104` a prod (la migración NO se aplicó por el harness).
- `node scripts/verify.mjs` 🟢 (lint sin errores, typecheck, 1056 tests, docs:check).
