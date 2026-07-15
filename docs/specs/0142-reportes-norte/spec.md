---
sdd: "0142"
title: "Reportes al Norte — reporte Por agente + reporte IVA"
status: done
author: "Claude Code (ventana secundaria · worktree reportes-norte) + founder"
created: 2026-07-03
updated: 2026-07-15
supersedes: null
superseded_by: null
related: ["0052", "0073", "0078", "0087"]
confidencialidad: interno
---

# SDD-0142 · Reportes al Norte

> Cierra la paridad de `/studio/reportes` (SDD-0052) con el Norte
> (`erp/modules/reports.jsx`): faltaban el reporte **"Por agente"** (Comerciales)
> y el reporte **IVA** (Contables). Solo lectura, sin migración. Elegido por
> auditoría de drift (gap Medio, tamaño S).

## Qué se agregó (commit `91c7ef02`)

### Comerciales · "Por agente" — `commercialByAgent()`
Desempeño por asesor cruzando datos REALES:
- Espejo Kommo (SDD-0078/0087): `kommo_leads.responsible_user_id` + `status_id`
  (142 ganada / 143 perdida) → estimados/ganadas/perdidas/conversión.
- `kommo_users` → nombre del asesor.
- `clients.kommo_lead_id` + `clientAnnualBilling` (invoices USD trailing-12m)
  → **revenue real** (el Norte tenía revenue mock).
- NPS/tickets del Norte **omitidos** (sin fuente). `hasKommo:false` →
  EmptyState honesto si el espejo está vacío.

### Contables · IVA — `ivaPosition()` + helper puro `ivaOutcome()`
Posición ante SENIAT reusando la clasificación fiscal de SDD-0073:
- Débito = IVA de `invoices` (`toSalesRow`/`salesTotals` + `fiscal_settings`).
- Crédito = `supplier_bills` (`toPurchaseRow`/`purchaseTotals`).
- Cuota = débito − crédito; a-pagar/excedente.
- KPIs + tarjeta "Posición ante el SENIAT" + link a `/studio/fiscal`.

## Aproximaciones documentadas (con nota honesta en la UI)
- Crédito fiscal ≈ 0: `supplier_bills` no discrimina IVA soportado en V1.
- Retenciones soportadas = 0 (sin comprobantes V1).
- Módulo fiscal OFF hoy → ventas exentas → débito 0 (la vista lo dice).
- Posición acumulada gerencial sobre el rango de Reportes (no una declaración
  mensual) + link al Libro oficial.

## Decisión abierta para el Director
El Norte **gatea** el tab IVA tras un flag de config (`iva`). Como el toggle
fiscal de DTD está OFF, gatearlo lo dejaría invisible/no testeable → se optó por
**mostrarlo siempre con nota honesta**. Si se prefiere gateo estricto detrás de
`fiscal_module_enabled`: pasar el flag a `page.tsx` y filtrar el tab (cambio chico).

## Patrón (para futuros reportes)
5 capas: `reports/types.ts` (tipo + helpers puros) · `reports/queries.ts`
(query read-only) · `page.tsx` (fetch por `?cat=`) · `ReportesClient.tsx`
(TABS_BY_CATEGORY + CATEGORIES + branch + viewCsv) · `export-csv.ts` (dispatcher).

## Pendiente del Director
`verify.mjs` + `pnpm build` + `ui-ux-designer` + `docs:index`. Sin migración.

## Verificación (lane)
`tsc --noEmit` + `eslint` verdes. Sin push.
