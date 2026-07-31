---
sdd: "0210"
title: "Bitácora — estado externo y cargas coherentes"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0146", "0198", "0205", "0208"]
confidencialidad: interno
---

# SDD-0210 — Bitácora · estado externo y cargas coherentes

## 1. Propósito

Eliminar seis sincronizaciones de estado por efecto en Bitácora desktop y móvil
sin cambiar acciones, payloads, persistencia ni comportamiento visible.

## 2. Riesgo y políticas

Riesgo **R2**. SGE-00.02/.05/.07 exige defaults predecibles, una fuente de
verdad observable y ausencia de estados intermedios falsos.

## 3. Contrato resultante

- las preferencias de vista y agrupación se leen como stores del navegador;
- un cambio local notifica al consumidor sin render intermedio con el default;
- tareas nuevas del server reemplazan el snapshot optimista por identidad;
- comentarios y adjuntos cargan juntos y descartan respuestas tras desmontaje;
- deep links inicializan el drawer desde el primer render.

## 4. Allowlist exacta

1. `app/studio/(app)/bitacora/_components/BitacoraClient.tsx`
2. `app/m/erp/bitacora/_components/HoyClient.tsx`
3. `app/studio/(app)/bitacora/_components/BoardList.tsx`
4. `app/studio/(app)/bitacora/_components/TaskCollabSection.tsx`
5. `app/studio/_components/__tests__/bitacora-state-contract.test.ts`
6. `docs/specs/0210-bitacora-state-subscriptions/spec.md`
7. `docs/architecture/module-sdd-map.md`
8. `docs/specs/README.md` — generado

## 5. Fuera de alcance

- acciones, APIs, queries, schemas y migraciones;
- cambios visuales, Cloud y reglas ESLint globales.

## 6. Verificación

- ESLint focalizado: **0 errores · 0 advertencias**;
- Vitest focalizado: contrato de preferencias, tareas, deep link y colaboración;
- `pnpm typecheck`: verde;
- lint completo: **41 → 35 advertencias**, 0 errores;
- docs, gobernanza, componentes, plugin y `diff --check`: verdes.
