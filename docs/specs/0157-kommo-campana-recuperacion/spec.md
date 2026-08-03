---
sdd: "0157"
title: "Campaña de recuperación Kommo — contactos con WhatsApp por tandas + export SMS"
status: done
author: "Sam (founder) + agente adquisición"
created: 2026-07-17
updated: 2026-08-02
supersedes: null
superseded_by: null
related: ["0043", "0058", "0078", "0061"]
confidencialidad: interno
---

# DTD-0157 — Campaña de recuperación Kommo

> **Número:** máx en `docs/specs` = 0156 → **0157 libre** (2026-07-17).
> Ejecuta el §8.6 de [`docs/marketing/adquisicion.md`](../../marketing/adquisicion.md): "los ~2.100
> leads de Kommo tienen WhatsApp verificado; clasificar cada uno — ¿estuvo interesado o ya es
> cliente? — y tocarlo con el guion warm". Decisión founder: canal **mixto** — WhatsApp manual por
> tandas a los mejores + SMS masivo (export CSV) al resto.

## Contexto

El espejo Kommo (SDD-0043) tiene ~2.700 contactos con teléfono real (fueron contactados por
WhatsApp), pero el CRM es un cementerio: nadie los recontacta. La base es el territorio warm #1 del
sistema de adquisición y hoy no hay NINGUNA herramienta para trabajarla.

**Restricciones de datos (verificadas):** el teléfono/email viven en `kommo_contacts.custom_fields`
(jsonb, se parsea con `parseContactFields` de `lib/studio/kommo-convert.ts`), NO en columnas → no se
filtra en SQL. El espejo NO guarda el link lead↔contacto → la campaña se arma sobre **contactos**
(personas), no leads (negocios). El match contra el ERP es por teléfono (`phonesMatch`, últimos 10
dígitos VE) o email (`emailsMatch`), más `clients.kommo_lead_id` no aplica acá (es de leads).

## Decisiones

1. **v1 SIN migración, read-only.** Ni tabla nueva ni escritura al espejo (RLS solo permite SELECT
   a authenticated). El registro del toque se hace en Kommo mismo (nota/tarea del asesor) — Kommo
   sigue siendo el CRM de registro. Persistir "ya contactado" en el ERP = Slice B (tabla propia),
   solo si la operación lo pide.
2. **Universo = `kommo_contacts` × `clients`.** Se clasifica en JS:
   - `cliente` — el teléfono (o email) del contacto matchea un cliente vivo del ERP → guion de
     recompra (su MARKBOX visible).
   - `interesado` — sin match → guion de reactivación.
   - Sin teléfono → fuera de la campaña WhatsApp/SMS (contador visible; si tiene email, es pool de
     la campaña de correo SDD-0082).
   - **Dedupe por teléfono** (mismos últimos 10 dígitos → queda el contacto más reciente): una
     persona = un toque.
3. **Tandas WhatsApp manual (máx 10 por tanda, patrón PortalBackfill):** selección → panel con
   links `wa.me` prellenados con el guion del segmento (plantilla editable, placeholder `{nombre}`)
   → el asesor los abre uno a uno. Sin automatización de envío (cero riesgo de bloqueo).
4. **Export SMS = CSV** (server action que recomputa el universo filtrado completo, no solo la
   página visible) con `nombre, telefono, segmento, dias_inactivo` — para cargar en el proveedor
   de SMS que el founder elija.
5. **UI = 4ª pestaña "Recuperación" en `/studio/kommo`** (mismo gate `requireModuleView("kommo")`,
   solo `commercial` + admin). Lista cap 300 filas server-filtered (segmento · antigüedad ·
   búsqueda nombre/teléfono · orden viejos-primero default); KPIs arriba.

## Slices

- **A (este):** lib pura + queries (`lib/studio/kommo-recovery.ts`), pestaña Recuperación, tandas
  wa.me, export CSV, tests de la lógica pura. Sin migración.
- **B (futuro, si la operación lo pide):** persistir el toque (`recovery_touches` por tenant) +
  cadencia D2/D5 con tareas; escritura de nota al lead vía outbox (patrón 0136).

## Verificación

- `node node_modules/vitest/vitest.mjs run lib/studio/__tests__/kommo-recovery.test.ts` — clasificación,
  dedupe, filtros, plantilla, CSV.
- `pnpm typecheck` + ESLint sobre los archivos tocados.
- Manual: `/studio/kommo?tab=recuperacion` con el espejo real (read-only, sin riesgo).
