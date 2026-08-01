---
sdd: "0209"
title: "Drawers — sugerencias y resultados derivados"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0196", "0206", "0207", "0208"]
confidencialidad: interno
---

# SDD-0209 — Drawers · sugerencias y resultados derivados

## 1. Propósito

Resolver ocho copias de estado en cuatro drawers/hilos sin cambiar acciones,
payloads ni datos.

## 2. Riesgo y políticas

Riesgo **R2**. SGE-00.02/.05/.07 exige resultados visibles una vez, defaults
predecibles y ausencia de estados intermedios falsos.

## 3. Contrato resultante

- respuesta enviada limpia el borrador y recarga el hilo una sola vez;
- elegir proveedor sugiere almacén en el mismo evento;
- share link deriva origin y absorbe cada respuesta por identidad;
- trámite SENIAT encadena puerto y agente sin efectos de copia;
- errores, cierre, toast, refresh y selección manual se preservan.

## 4. Allowlist exacta

1. `app/studio/(app)/conversaciones/_components/ConversationThread.tsx`
2. `app/studio/(app)/etiquetas/_components/LabelGeneratorClient.tsx`
3. `app/studio/(app)/proveedores/_components/ProviderLinkDrawer.tsx`
4. `app/studio/(app)/seniat/_components/CreateFilingDrawer.tsx`
5. `app/studio/_components/__tests__/drawer-derived-state-contract.test.ts`
6. `docs/specs/0209-drawer-derived-state/spec.md`
7. `docs/architecture/module-sdd-map.md`
8. `docs/specs/README.md` — generado

## 5. Fuera de alcance

- `ProfileModal`, `CategoryDetector`, Server Actions, APIs y schemas;
- cambios visuales, Cloud y reglas ESLint globales.

## 6. Verificación

- ESLint focalizado: **0 errores · 0 advertencias**;
- Vitest: **4/4** pruebas de conversación, proveedor, share link y trámite;
- `pnpm typecheck`: verde;
- lint completo: **49 → 41 advertencias**, 0 errores;
- docs, gobernanza, componentes, plugin y `diff --check`: verdes.
