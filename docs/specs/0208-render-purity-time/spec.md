---
sdd: "0208"
title: "Render — referencias temporales estables"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0196", "0204", "0206", "0207"]
confidencialidad: interno
---

# SDD-0208 — Render · referencias temporales estables

## 1. Propósito

Resolver siete advertencias de pureza/estado en cuatro superficies temporales,
sin cambiar acciones ni persistencia.

## 2. Riesgo y políticas

Riesgo **R2**. SGE-00.05/.07 exige que un render sea reproducible y que fechas,
rates sugeridos y mensajes reflejen una referencia explícita.

## 3. Contrato resultante

- tabla de bugs y mailing usan una referencia temporal estable por carga;
- la vigencia nueva conserva 30 días y no invoca reloj durante render;
- vaciar destino limpia el rate sugerido en el mismo evento;
- tracking muestra fecha/hora absoluta en Caracas, estable y auditable;
- no cambian formularios, Server Actions, filtros ni datos.

## 4. Allowlist exacta

1. `app/studio/(app)/bugs/_components/BugTable.tsx`
2. `app/studio/(app)/cotizador/_components/QuoteDrawer.tsx`
3. `app/studio/(app)/mailing/_components/MailingClient.tsx`
4. `app/studio/(app)/tracking/[id]/page.tsx`
5. `app/studio/_components/__tests__/render-purity-contract.test.ts`
6. `docs/specs/0208-render-purity-time/spec.md`
7. `docs/architecture/module-sdd-map.md`
8. `docs/specs/README.md` — generado

## 5. Fuera de alcance

- relojes en vivo, rediseño, copy general, APIs, schemas y Cloud;
- otras advertencias React pendientes y reglas ESLint globales.

## 6. Verificación

- ESLint focalizado: **0 errores · 0 advertencias**;
- Vitest: **3/3** pruebas de referencia estable, vigencia y timezone;
- `pnpm typecheck`: verde;
- lint completo: **56 → 49 advertencias**, 0 errores;
- docs, gobernanza, componentes, plugin y `diff --check`: verdes.
