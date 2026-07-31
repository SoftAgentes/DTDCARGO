---
sdd: "0214"
title: "Efectos externos — fronteras cancelables"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0205", "0212", "0213"]
confidencialidad: interno
---

# SDD-0214 — Efectos externos · fronteras cancelables

## 1. Propósito

Cerrar las últimas advertencias válidas en integraciones con storage, timers,
DOM, Notification, URL hash y búsquedas remotas.

## 2. Riesgo y políticas

Riesgo **R2**. SGE-00.02/.05/.07 exige resultados visibles una vez y descartar
respuestas o callbacks que ya no pertenecen al consumidor montado.

## 3. Contrato resultante

- borradores, recientes, portal DOM, notificaciones y hashes hidratan de forma cancelable;
- búsquedas debounced conservan su protección contra respuestas obsoletas;
- el resaltado cancela microtarea, frame y timer al desmontarse;
- el lookup vacío limpia el resultado sin cascada síncrona.

## 4. Allowlist exacta

1. `app/p/[token]/PackingListFormSection.tsx`
2. `app/studio/(app)/kommo/_components/ConvertLeadDrawer.tsx`
3. `app/studio/(app)/tracking/[id]/_components/ChangeDestinationModal.tsx`
4. `app/studio/(app)/usuarios/_components/UsersClient.tsx`
5. `app/studio/_components/ui/useRowHighlight.ts`
6. `app/studio/_components/wiring/GlobalSearchModal.tsx`
7. `app/studio/_components/wiring/ProfileModal.tsx`
8. `components/FaqExplorer.tsx`
9. `app/studio/_components/__tests__/external-effect-boundaries-contract.test.ts`
10. `docs/specs/0214-external-effect-boundaries/spec.md`
11. `docs/architecture/module-sdd-map.md`
12. `docs/specs/README.md` — generado

## 5. Fuera de alcance

APIs, acciones, schemas, contenido visual, Cloud, service worker y permisos.

## 6. Verificación

- ESLint focalizado: **0 errores · 0 advertencias**;
- Vitest focalizado: fronteras cancelables de ocho consumidores;
- `pnpm typecheck`: verde;
- lint completo: **8 → 0 advertencias**, 0 errores;
- docs, gobernanza, componentes, plugin y `diff --check`: verdes.
