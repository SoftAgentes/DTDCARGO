---
sdd: "0126"
title: "Tasas de cambio — gestión de tenant_fx_history desde Administración"
status: in-progress
author: "Claude Code (sesión secundaria · worktree web-norte) + founder"
created: 2026-07-01
updated: 2026-07-01
supersedes: null
superseded_by: null
related: ["0039", "0110"]
confidencialidad: interno
---

# SDD-0126 · Tasas de cambio

> Séptima sección real de Administración. **Sin migración**: gestiona la tabla
> `tenant_fx_history` (migr 0074), que YA es el store de tasas del tenant.

## Contexto

`tenant_fx_history` (par + rate + set_at, append-only) ya existe y **es la
fuente de verdad**: el drawer de Gastos hace prefill con la última tasa
(`getLastFxRate`) y el posting contable (`receipt-posting`) la usa para convertir
a USD. No hacía falta una config nueva ni otra tabla — solo faltaba un lugar
para **registrar** la tasa desde admin.

## Alcance

- **Tasas vigentes** — última por par (`CNY/USD`, `VES/USD`) con su fecha.
- **Registrar tasa nueva** — form (par + valor) → INSERT en `tenant_fx_history`
  (append-only; el INSERT ya está grantado a authenticated). Warning suave si la
  tasa cae fuera del rango histórico (`FX_RATE_SANITY_RANGE`), sin bloquear.

## Superficie de código

- `lib/studio/exchange-rates-types.ts` — pares, labels, validación, rango.
- `lib/studio/exchange-rates-queries.ts` — `getExchangeRatesOverview` (reusa
  `getLastFxRate`).
- `app/studio/(app)/admin/exchange-rates-actions.ts` — `recordExchangeRateAction`
  (admin-gated).
- `app/studio/(app)/admin/_components/ExchangeRatesSection.tsx`.
- `app/studio/(app)/admin/page.tsx` — fetch + render.

## Fuera de alcance

- "Qué tasa usa cada flujo" (BCV/paralelo por flujo) del Norte → requiere
  modelar múltiples fuentes por par; es una spec financiera con más peso.
- Editar/borrar historial (es append-only por diseño).

## Estado

Código listo; `pnpm typecheck` + `pnpm lint` + build en verde. Sin migración.
