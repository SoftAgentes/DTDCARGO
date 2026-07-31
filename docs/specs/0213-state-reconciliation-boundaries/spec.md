---
sdd: "0213"
title: "Estado — reconciliación cancelable por frontera"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0206", "0207", "0209", "0212"]
confidencialidad: interno
---

# SDD-0213 — Estado · reconciliación cancelable por frontera

## 1. Propósito

Reconciliar navegación, props y resultados de actions en una frontera diferida
y cancelable, sin cascadas síncronas ni cambios de comportamiento visible.

## 2. Riesgo y políticas

Riesgo **R2**. SGE-00.02/.05/.07 exige feedback único, estado predecible y una
fuente de verdad vigente.

## 3. Contrato resultante

- navegación y filtros seleccionan una alternativa válida tras cada cambio;
- respuestas de actions limpian el estado de edición una sola vez;
- sugerencias y prefills se reinician sin sobrevivir a un desmontaje;
- rutas, categorías y confirmación Telegram descartan reconciliaciones obsoletas.

## 4. Allowlist exacta

1. `app/studio/(app)/_components/StudioSidebar.tsx`
2. `app/portal/(app)/compras/nueva/SupplierPicker.tsx`
3. `app/studio/(app)/admin/_components/calculator/ParametrosPanel.tsx`
4. `app/studio/(app)/conversaciones/_components/ConversacionesClient.tsx`
5. `app/studio/(app)/marketing/noticias-web/_components/CategoryDetector.tsx`
6. `app/studio/(app)/tms/_components/RouteDrawer.tsx`
7. `app/studio/_components/wiring/ProfileModal.tsx`
8. `components/EstimadoModal.tsx`
9. `app/studio/_components/__tests__/state-reconciliation-contract.test.ts`
10. `docs/specs/0213-state-reconciliation-boundaries/spec.md`
11. `docs/architecture/module-sdd-map.md`
12. `docs/specs/README.md` — generado

## 5. Fuera de alcance

Notificaciones del navegador, búsquedas remotas, DOM/hash, borradores locales,
diseño, Cloud y contratos de actions.

## 6. Verificación

- ESLint focalizado: sólo queda la inicialización de Notification fuera del corte;
- Vitest focalizado: **8/8** fronteras cancelables;
- `pnpm typecheck`: verde;
- lint completo: **17 → 8 advertencias**, 0 errores;
- docs, gobernanza, componentes, plugin y `diff --check`: verdes.
