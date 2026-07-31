---
sdd: "0196"
title: "Almacén CN — feedback y pending de nueva recepción"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0016", "0072", "0194"]
confidencialidad: interno
---

# SDD-0196 — Almacén CN · feedback y pending de nueva recepción

## 1. Propósito

Corregir un slice único de las 172 advertencias de ESLint:
`NewReceiptDrawer`. El drawer invoca `createReceiptAction` manualmente para
resolver tres desenlaces del `SplitActionButton`, pero conservaba un
`useActionState` desconectado. Como consecuencia:

- el pending del drawer y del botón Cancelar no representaba la mutación real;
- el resultado con `fieldErrors` no permanecía conectado a los campos;
- el error persistente se almacenaba en un estado que nunca se renderizaba;
- la serialización de items eliminaba `_key` mediante una variable descartada.

El slice conecta esos estados sin cambiar la Server Action, el payload
contractual, las rutas de éxito, permisos, auditoría o datos.

## 2. Riesgo y políticas

Riesgo **R2**: se modifica la recuperación visible de una creación operativa,
pero no el resultado de negocio ni su autorización.

| Política | Evidencia previa | Clasificación |
|---|---|---|
| SGE-00 v1.0 | La mutación era real, pero el drawer no exponía pending/error verdaderos | no conformidad acotada |
| ERR-01 v1.0 | Un error transaccional podía quedar sólo dentro del split button y los `fieldErrors` no persistían | no conformidad |
| FRM-01 v1.1 | El estado de formulario no correspondía con la llamada manual a servidor | no conformidad |
| LOD-01 v1.0 | Cancelar permanecía habilitado durante la creación y el shell no anunciaba espera | no conformidad |
| CMP-01 v1.1 | Se reutilizan `DrawerShell`, `SplitActionButton`, `ErrorAlert` y `NumericInput` sin alterar su madurez | no aplica |

## 3. Contrato resultante

- el drawer usa un único estado local para la respuesta real de
  `createReceiptAction`;
- una respuesta con `fieldErrors` conserva el resumen y los mensajes junto a
  sus campos;
- un error transaccional permanece visible mediante `ErrorAlert`;
- el pending real bloquea Cancelar, el split button y el cierre del drawer;
- el split button conserva anti-doble-submit y sus tres desenlaces;
- el serializer produce únicamente campos de `WarehouseReceiptItemInput`;
- éxito `close`, `open` y `reset` conserva navegación, toast y reset previos;
- no se modifica `app/studio/(app)/cn/actions.ts`.

## 4. Gate SGE-00

| Principio | Resultado esperado | Evidencia |
|---|---|---|
| 01, 03–06, 08–09, 11–12 | no aplica | No cambian verbo, riesgo, permisos, validación de servidor, pasos, patrón ni IA |
| 02 | cumplimiento | El error no borra campos y el cierre queda bloqueado durante pending |
| 07 | cumplimiento | Pending, error y éxito provienen de la misma respuesta durable |
| 10 | cumplimiento | `ErrorAlert` conserva `role="alert"` y los controles exponen disabled/aria-busy existentes |

## 5. Allowlist exacta

1. `app/studio/(app)/cn/_components/NewReceiptDrawer.tsx`
2. `app/studio/(app)/cn/_components/NewReceiptDrawer.test.tsx`
3. `docs/specs/0196-new-receipt-drawer-feedback/spec.md`
4. `docs/architecture/module-sdd-map.md`
5. `docs/specs/README.md` — generado

## 6. Fuera de alcance

- `app/studio/(app)/cn/actions.ts`, tipos y validadores;
- Supabase, migraciones, Cloud, Producción y Vercel;
- cambios a `SplitActionButton`, `DrawerShell`, `ErrorAlert` o `NumericInput`;
- estilos, copy y rutas de navegación;
- las otras 169 advertencias esperadas;
- barridos de Hooks o supresiones de ESLint.

## 7. Verificación

- ESLint focalizado con cero advertencias;
- Vitest específico para error persistente, `fieldErrors`, pending,
  anti-doble-submit y payload sin `_key`;
- typecheck;
- suite Vitest proporcional;
- `docs:check`, `governance:check`, `components:check`;
- lint completo con objetivo de 169 advertencias y cero errores;
- `git diff --check`.

## 8. Resultado

Implementado dentro de la allowlist:

- ESLint focalizado: cero errores y cero advertencias;
- Vitest focalizado: 3/3 pruebas verdes para error persistente con
  `fieldErrors`, pending real con anti-doble-submit y payload sin `_key`;
- lint completo: cero errores y 169 advertencias, reducción exacta de 172 a
  169 sin barrido adicional;
- typecheck, `docs:check`, `governance:check`, `components:check` y
  `git diff --check`: verdes;
- suite Vitest completa: 330 archivos y 4249/4249 pruebas verdes;
- `pnpm verify`: verde con E2E omitido explícitamente mediante
  `VERIFY_SKIP_E2E=1` y `migrations-applied` omitido por ausencia de entorno
  local; los 39 contratos SQL pasaron en PostgreSQL 17 efímero con rollback
  total y el schema rebuild pasó con 297 migraciones;
- `pnpm build`: verde; conserva únicamente los avisos conocidos de NFT y los
  fallbacks locales por variables públicas de Supabase ausentes.

No se modificaron Server Actions, migraciones, Cloud, Producción ni Vercel.
