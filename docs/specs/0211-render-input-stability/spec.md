---
sdd: "0211"
title: "Render — entradas estables y acumuladores puros"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0208", "0209"]
confidencialidad: interno
---

# SDD-0211 — Render · entradas estables y acumuladores puros

## 1. Propósito

Estabilizar referencias derivadas, eliminar acumuladores mutables durante render
y usar el componente de imagen canónico sin alterar cálculos ni presentación.

## 2. Riesgo y políticas

Riesgo **R2**. SGE-00.05/.07 exige una fuente de verdad y comportamiento
predecible; la regla visual del repo exige `next/image`.

## 3. Contrato resultante

- posición, carga entrante, ciudades y formulario efectivo conservan identidad;
- saldos y segmentos de gráfica se construyen como transformaciones puras;
- la previsualización POD usa `Image` sin optimizar URLs blob locales;
- fórmulas, orden y estilos permanecen iguales.

## 4. Allowlist exacta

1. `app/m/erp/_components/MobileErpClient.tsx`
2. `app/m/ve/camionero/_components/PodModal.tsx`
3. `app/studio/(app)/financiero-china/_components/LedgerTab.tsx`
4. `app/studio/(app)/naviera/_components/AssignCargoDrawer.tsx`
5. `app/studio/(app)/reportes/_components/charts.tsx`
6. `components/CalculadoraForm.tsx`
7. `app/studio/_components/__tests__/render-input-stability-contract.test.ts`
8. `docs/specs/0211-render-input-stability/spec.md`
9. `docs/architecture/module-sdd-map.md`
10. `docs/specs/README.md` — generado

## 5. Fuera de alcance

APIs, acciones, persistencia, fórmulas, diseño y Cloud.

## 6. Verificación

- ESLint focalizado: **0 errores · 0 advertencias**;
- Vitest focalizado: estabilidad y pureza de seis consumidores;
- `pnpm typecheck`: verde;
- lint completo: **35 → 26 advertencias**, 0 errores;
- docs, gobernanza, componentes, plugin y `diff --check`: verdes.
