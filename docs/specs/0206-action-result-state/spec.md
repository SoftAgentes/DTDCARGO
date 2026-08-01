---
sdd: "0206"
title: "Formularios — resultados de action manejados una vez"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0146", "0196", "0204", "0205"]
confidencialidad: interno
---

# SDD-0206 — Formularios · resultados de action manejados una vez

## 1. Propósito

Eliminar diez copias de estado desde efectos en formularios y preferencias,
preservando mensajes, reset, navegación, toasts y persistencia.

## 2. Riesgo y políticas

Riesgo **R2**. SGE-00.02/.05/.07 exige pending y resultado verdaderos, error
visible y confirmaciones que no se repitan por renders posteriores.

## 3. Contrato resultante

- cada objeto de respuesta se absorbe una sola vez por identidad;
- campos sólo se limpian tras éxito y los errores conservan los valores;
- tokens API continúan revelándose una sola vez;
- preferencias locales usan stores externos con snapshot SSR;
- toasts, refresh, cierre y timers permanecen en efectos de sincronización;
- no cambian Server Actions, payloads, permisos ni datos.

## 4. Allowlist exacta

1. `app/portal/_components/ReferralInviteForm.tsx`
2. `app/portal/_components/ShareProviderButton.tsx`
3. `app/portal/(app)/reclamos/_components/PortalClaims.tsx`
4. `app/registro/RegisterForm.tsx`
5. `app/studio/(app)/admin/_components/ApiIntegrationSection.tsx`
6. `app/studio/(app)/admin/_components/AppearanceSection.tsx`
7. `app/studio/(app)/admin/_components/RecepcionAddonsSection.tsx`
8. `app/studio/(app)/fiscal/_components/FiscalConfig.tsx`
9. `app/studio/(app)/marketing/noticias-web/_components/LLMModeToggle.tsx`
10. `app/studio/(app)/nomina/_components/AmonestacionDrawer.tsx`
11. `app/studio/_components/__tests__/action-result-contract.test.ts`
12. `docs/specs/0206-action-result-state/spec.md`
13. `docs/architecture/module-sdd-map.md`
14. `docs/specs/README.md` — generado

## 5. Fuera de alcance

- Server Actions, APIs, schemas, Cloud, payloads y reglas de negocio;
- `SupplierPicker`, `SplitActionButton` y otros estados React pendientes;
- rediseño visual o reglas ESLint globales.

## 6. Verificación

- ESLint focalizado: **0 errores · 0 advertencias**;
- Vitest: **10/10** pruebas de absorción única, stores y salto de errores;
- `pnpm typecheck`: verde;
- lint completo: **81 → 71 advertencias**, 0 errores;
- docs, gobernanza, componentes, plugin y `diff --check`: verdes.
