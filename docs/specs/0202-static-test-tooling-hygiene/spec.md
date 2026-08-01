---
sdd: "0202"
title: "Verificación transversal — contratos sin bindings muertos"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0174", "0196", "0200", "0201"]
confidencialidad: interno
---

# SDD-0202 — Verificación transversal · contratos sin bindings muertos

## 1. Propósito

Retirar dieciséis bindings demostrablemente no consumidos en pruebas, tooling y
el service worker móvil, conservando cada contrato observable.

## 2. Riesgo y políticas

Riesgo **R2** por abarcar varios verificadores, aunque los cambios son estáticos.
SGE-00.02/.07 exige evidencia reproducible sin aparentar coberturas o payloads
que los dobles realmente no inspeccionan.

## 3. Contrato resultante

- los mocks siguen aceptando llamadas JavaScript aunque no declaren parámetros;
- las aserciones y valores retornados no cambian;
- el service worker mantiene install, activate, fetch passthrough y fallback push;
- el runner SQL conserva resolución de rutas y ejecución de contratos;
- no se agrega ningún `eslint-disable`.

## 4. Allowlist exacta

1. `app/api/public/estimacion/__tests__/notify.test.ts`
2. `lib/studio/__tests__/invoice-queries.test.ts`
3. `lib/studio/__tests__/payment.test.ts`
4. `lib/studio/__tests__/portal-invite-email.test.ts`
5. `lib/studio/__tests__/radar-types.test.ts`
6. `lib/studio/notifications/__tests__/drain-client-notifications.test.ts`
7. `lib/studio/notifications/__tests__/schedule-client-notifications.test.ts`
8. `lib/studio/notifications/__tests__/schedule-fanout.test.ts`
9. `lib/studio/partner-finance/__tests__/posting-health.test.ts`
10. `public/m/sw.js`
11. `scripts/run-sql-tests.mjs`
12. `docs/specs/0202-static-test-tooling-hygiene/spec.md`
13. `docs/architecture/module-sdd-map.md`
14. `docs/specs/README.md` — generado

## 5. Fuera de alcance

- código productivo, schemas, migraciones, Cloud y datos;
- cambios de casos, aserciones, reglas ESLint o cobertura;
- otros bindings sin uso fuera de pruebas/tooling.

## 6. Verificación

- ESLint focalizado: **0 errores · 0 advertencias**;
- Vitest: **9 suites · 107/107 pruebas**;
- `node --check`: service worker y runner SQL verdes;
- `pnpm typecheck`: verde;
- lint completo: **149 → 133 advertencias**, 0 errores;
- docs, gobernanza, componentes, plugin y `diff --check`: verdes.
