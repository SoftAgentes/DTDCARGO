---
sdd: "0204"
title: "Frontend — errores visibles y props consumidas"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0174", "0196", "0202", "0203"]
confidencialidad: interno
---

# SDD-0204 — Frontend · errores visibles y props consumidas

## 1. Propósito

Cerrar diecisiete bindings frontend sin consumidor y siete advertencias React
en los mismos archivos, corrigiendo estados derivados y errores invisibles.

## 2. Riesgo y políticas

Riesgo **R2**. SGE-00.02/.05/.07 exige errores visibles y componentes que no
declaren señales falsas o estados imposibles.

## 3. Contrato resultante

- clientes y tarifas muestran errores del action o del flujo crear;
- facturación sólo mantiene el error que realmente puede producirse;
- `CategoryBar` consume su tono de fondo;
- Almacén VE remonta filtros desde la query y conserva ambos debounces;
- el reporte de bugs captura contexto una vez al abrirse;
- lookups y confirmaciones no copian estado sincrónicamente desde efectos;
- props públicas necesarias se preservan aunque el hook interno no las use;
- imports, setters y cálculos demostrablemente muertos se retiran;
- no cambian acciones, payloads, permisos ni datos.

## 4. Allowlist exacta

1. `app/invitar/[token]/page.tsx`
2. `app/studio/_components/bug-reporter/BugReportModal.tsx`
3. `app/studio/_components/ui/DataTable.tsx`
4. `app/studio/(app)/admin/_components/calculator/CityDrawer.tsx`
5. `app/studio/(app)/bugs/_components/BugDrawer.tsx`
6. `app/studio/(app)/bugs/_components/BugKanban.tsx`
7. `app/studio/(app)/bugs/_components/BugStats.tsx`
8. `app/studio/(app)/clientes/_components/ClientDrawer.tsx`
9. `app/studio/(app)/facturacion/_components/InvoiceDrawer.tsx`
10. `app/studio/(app)/nomina/_components/ComunicacionesTab.tsx`
11. `app/studio/(app)/reclamos/_components/ReclamosClient.tsx`
12. `app/studio/(app)/tarifas/_components/RateDrawer.tsx`
13. `app/studio/(app)/tms/_components/GpsLiveTab.tsx`
14. `app/studio/(app)/tracking/[id]/_components/TimelinePanel.tsx`
15. `app/studio/(app)/ve/_components/AlmacenVeClient.tsx`
16. `components/UltimoKmCalculator.tsx`
17. `app/studio/_components/__tests__/frontend-state-contract.test.ts`
18. `docs/specs/0204-frontend-visible-error-contracts/spec.md`
19. `docs/architecture/module-sdd-map.md`
20. `docs/specs/README.md` — generado

## 5. Fuera de alcance

- Hooks con sincronización pendiente, Server Actions, payloads y base de datos;
- rediseño visual, copy, schemas y reglas ESLint globales;
- otras advertencias React del inventario.

## 6. Verificación

- ESLint focalizado: **0 errores · 0 advertencias**;
- Vitest: **6/6** pruebas de errores, tonos, remount y captura;
- `pnpm typecheck`: verde;
- lint completo: **114 → 90 advertencias**, 0 errores;
- docs, gobernanza, componentes, plugin y `diff --check`: verdes.
