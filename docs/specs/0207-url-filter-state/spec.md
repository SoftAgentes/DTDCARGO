---
sdd: "0207"
title: "Listados Studio — query como fuente de verdad"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0198", "0199", "0204", "0206"]
confidencialidad: interno
---

# SDD-0207 — Listados Studio · query como fuente de verdad

## 1. Propósito

Resolver quince advertencias de filtros URL y estado server/optimista en siete
listados, sin cambiar queries, resultados ni acciones.

## 2. Riesgo y políticas

Riesgo **R2**. SGE-00.01/.05/.07 exige contexto, filtros y estados verdaderos,
incluyendo back/forward del navegador y debounce predecible.

## 3. Contrato resultante

- cada listado absorbe una nueva query por identidad durante render;
- búsqueda conserva debounce de 300/350 ms;
- handlers de efecto consumen el callback más reciente con `useEffectEvent`;
- no quedan supresiones `eslint-disable` en estos flujos;
- Kommo fusiona verdad server con conversiones optimistas monotónicas;
- filtros, rutas, tablas, drawers y resultados permanecen iguales.

## 4. Allowlist exacta

1. `app/studio/(app)/clientes/_components/ClientsClient.tsx`
2. `app/studio/(app)/cotizador/_components/CotizadorClient.tsx`
3. `app/studio/(app)/facturacion/_components/FacturacionClient.tsx`
4. `app/studio/(app)/kommo/_components/KommoClient.tsx`
5. `app/studio/(app)/kommo/_components/RecoveryTab.tsx`
6. `app/studio/(app)/seniat/_components/SeniatClient.tsx`
7. `app/studio/(app)/tarifas/_components/TarifasClient.tsx`
8. `app/studio/_components/__tests__/url-filter-state-contract.test.ts`
9. `docs/specs/0207-url-filter-state/spec.md`
10. `docs/architecture/module-sdd-map.md`
11. `docs/specs/README.md` — generado

## 5. Fuera de alcance

- queries server, Server Actions, permisos, schemas y datos;
- `StudioSidebar`, otros filtros pendientes y reglas ESLint globales;
- cambios visuales, copy o migraciones.

## 6. Verificación

- ESLint focalizado: **0 errores · 0 advertencias**;
- Vitest: **14/14** pruebas de query, debounce y merge optimista;
- `pnpm typecheck`: verde;
- lint completo: **71 → 56 advertencias**, 0 errores;
- docs, gobernanza, componentes, plugin y `diff --check`: verdes.
