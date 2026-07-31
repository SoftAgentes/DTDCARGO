---
sdd: "0212"
title: "Preferencias — hidratación cancelable del navegador"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0205", "0210", "0211"]
confidencialidad: interno
---

# SDD-0212 — Preferencias · hidratación cancelable del navegador

## 1. Propósito

Hidratar preferencias persistidas sin setters síncronos dentro de efectos y sin
cambiar defaults SSR, claves de almacenamiento ni interacción.

## 2. Riesgo y políticas

Riesgo **R2**. SGE-00.05/.07 exige estado predecible y una única aplicación de
preferencias externas.

## 3. Contrato resultante

- cada lectura de storage ocurre en una microtarea cancelable;
- desmontar antes de la hidratación impide actualizar estado obsoleto;
- sidebar declara el estado de padres antes de cualquier captura;
- persistencia, defaults y claves existentes se conservan.

## 4. Allowlist exacta

1. `app/studio/(app)/_components/StudioSidebar.tsx`
2. `app/studio/(app)/ordenes-compra/_components/OrdenesCompraClient.tsx`
3. `app/studio/(app)/proveedores/_components/ProveedoresClient.tsx`
4. `app/studio/(app)/reportes/_components/BuilderView.tsx`
5. `app/studio/_components/bug-reporter/BugFABButton.tsx`
6. `app/studio/_components/ui/SplitActionButton.tsx`
7. `app/studio/_components/ui/columns/ColumnConfig.tsx`
8. `app/studio/_components/wiring/WiringProvider.tsx`
9. `app/studio/_components/__tests__/browser-preference-hydration-contract.test.ts`
10. `docs/specs/0212-browser-preference-hydration/spec.md`
11. `docs/architecture/module-sdd-map.md`
12. `docs/specs/README.md` — generado

## 5. Fuera de alcance

Navegación derivada, llamadas remotas, diseño, claves de storage y Cloud.

## 6. Verificación

- ESLint focalizado: sólo queda la navegación derivada fuera de este corte;
- Vitest focalizado: **8/8** consumidores con hidratación cancelable;
- `pnpm typecheck`: verde;
- lint completo: **26 → 17 advertencias**, 0 errores;
- docs, gobernanza, componentes, plugin y `diff --check`: verdes.
