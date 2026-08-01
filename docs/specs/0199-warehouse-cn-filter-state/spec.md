---
sdd: "0199"
title: "Almacén CN — filtros URL y selección coherentes"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0016", "0194", "0196", "0197"]
confidencialidad: interno
---

# SDD-0199 — Almacén CN · filtros URL y selección coherentes

## 1. Propósito

Resolver siete advertencias concentradas en `AlmacenCnClient` sin cambiar
queries, Server Actions, permisos, datos ni resultados de negocio.

## 2. Riesgo y políticas

Riesgo **R2**: filtros y selección gobiernan las filas sobre las que operan las
acciones masivas. SGE-00.01/.05/.07 exige contexto predecible, estado verdadero
y ausencia de selección obsoleta.

## 3. Contrato resultante

- la query string es la fuente de verdad de filtros y drawer;
- un cambio externo de query remonta el estado local mediante `key`;
- la selección se reinicia al cambiar el conjunto visible;
- búsqueda conserva debounce de 300 ms;
- `lang`, `view` y parámetros futuros se preservan;
- el builder elimina filtros vacíos y recorta búsqueda;
- se retiran cuatro bindings sin consumidor real.

## 4. Allowlist exacta

1. `app/studio/(app)/cn/_components/AlmacenCnClient.tsx`
2. `app/studio/(app)/cn/_components/AlmacenCnClient.test.ts`
3. `docs/specs/0199-warehouse-cn-filter-state/spec.md`
4. `docs/architecture/module-sdd-map.md`
5. `docs/specs/README.md` — generado

## 5. Fuera de alcance

- queries, acciones bulk, Supabase, migraciones, Cloud y Vercel;
- tabla, drawer, copy, estilos o permisos;
- otros módulos y reglas ESLint globales.

## 6. Verificación

- ESLint focalizado: **0 errores · 0 advertencias**;
- Vitest: **2/2** pruebas del builder, preservación de params y contrato de
  remount;
- `pnpm typecheck`: verde;
- lint completo: **163 → 156 advertencias**, 0 errores;
- docs, gobernanza, componentes, plugin y `diff --check`: verdes.
