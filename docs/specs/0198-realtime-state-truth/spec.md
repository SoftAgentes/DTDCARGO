---
sdd: "0198"
title: "Realtime transversal — estado de conexión y datos verdaderos"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0029", "0030", "0146"]
confidencialidad: interno
---

# SDD-0198 — Realtime transversal · estado y datos verdaderos

## 1. Propósito

Resolver tres advertencias `react-hooks/set-state-in-effect` en los hooks
realtime compartidos sin cambiar canales, RLS, filtros ni contratos de sus
consumidores.

## 2. Riesgo y políticas

Riesgo **R2**: estos hooks alimentan Despacho, móviles VE, conversaciones,
notificaciones y Bitácora. SGE-00.07 exige que conexión y datos visibles sean
verdaderos; LOD-01 prohíbe estados de espera falsos.

## 3. Contrato resultante

- una identidad nueva de tabla/filtro comienza en `connecting`;
- `disabled` permanece `idle` y no abre canal;
- callbacks del canal fijan `connected`, `error` o `closed` para la identidad
  que los originó;
- un nuevo `initial` del servidor se refleja sin un efecto de copia;
- el siguiente payload realtime se aplica sobre el `initial` más reciente;
- cleanup conserva `unsubscribe` y debounce conserva un solo refresh.

## 4. Allowlist exacta

1. `lib/studio/hooks/use-realtime-refresh.ts`
2. `lib/studio/hooks/use-realtime-table.ts`
3. `lib/studio/hooks/use-realtime-hooks.test.tsx`
4. `docs/specs/0198-realtime-state-truth/spec.md`
5. `docs/architecture/module-sdd-map.md`
6. `docs/specs/README.md` — generado

## 5. Fuera de alcance

- Supabase, schema, publicaciones Realtime, migraciones y Cloud;
- consumidores, UI del indicador y copy;
- polling, reconexión nueva o cambios de performance;
- otros warnings o supresiones ESLint.

## 6. Verificación

- ESLint focalizado con cero advertencias;
- pruebas de cambio de filtro, cleanup, dataset inicial, payload y disabled;
- typecheck;
- lint completo con reducción esperada de 166 a 163;
- docs, gobernanza, componentes y `diff --check` verdes.

## 7. Resultado

- ESLint focalizado: cero errores y cero advertencias;
- pruebas focalizadas: 3/3 verdes;
- lint completo: cero errores y 163 advertencias, reducción exacta de tres;
- typecheck, documentación, gobernanza, componentes y `diff --check`: verdes;
- no se modificaron consumidores, Supabase, Cloud, Producción ni Vercel.
