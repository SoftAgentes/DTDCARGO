---
sdd: "0226"
title: "Anulación gobernada de finiquito de Nómina"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0103", "0109", "0174", "0187"]
confidencialidad: interno
---

# SDD-0226 — Anulación gobernada de finiquito de Nómina

## 1. Objetivo

Corregir el flujo R3 `finiquito confirmado → anulado` identificado por
REV-SGE-030. La anulación del finiquito, la neutralización de su asiento y los
eventos obligatorios deben ocurrir en una sola transacción PostgreSQL, con
tenant, actor, rol, motivo, estado e idempotencia verificados en servidor.

El slice no certifica el módulo completo de Nómina ni modifica el cálculo,
confirmación, pago, PDF o creación de finiquitos.

## 2. Decisiones

- La capability `void_payroll_settlement` es admin-only. El rol `accounting`
  conserva acceso al módulo, pero no puede ejecutar esta decisión laboral R3.
- El RPC `void_payroll_settlement_governed` bloquea la fila con `FOR UPDATE`,
  valida membresía activa, tenant, estado, motivo y referencia idempotente.
- El asiento y el finiquito cambian juntos o ninguno cambia. El
  `journal_entry_id` se conserva como vínculo histórico.
- Los eventos `journal_entry_voided` y `payroll_settlement_voided` conservan el
  mismo actor, motivo y correlation id. La referencia del request permite
  replay idempotente después de una respuesta perdida.
- Una falla del writer de auditoría revierte ambas mutaciones.
- Los renglones de un finiquito confirmado o anulado quedan inmutables. Las
  columnas sustantivas de un finiquito confirmado no pueden alterarse por CRUD
  directo; la transición a `anulado` sólo ocurre dentro del RPC.
- La UI reutiliza `ConfirmDialog` canonical con consecuencia explícita, motivo
  obligatorio, presión sostenida de 1,5 s y alternativa accesible.
- Los errores de base de datos se traducen a copy seguro. Una referencia se
  muestra en el error inesperado sin exponer SQL ni datos internos.

## 3. Riesgo y políticas

| Política | Clasificación del slice |
|---|---|
| SGE-00 v1.0 | cumplimiento: permiso, tenant, estado, atomicidad y verdad de éxito |
| MP-01 v1.1 | cumplimiento P3/R3: consecuencia, motivo y rastro preservado |
| BTN-01 v1.1 | cumplimiento: el trigger sólo abre el diálogo |
| HTD-01 v1.0 | cumplimiento: presión sostenida con alternativa de checkbox + click |
| AUD-01 v1.0 | cumplimiento: mutación y eventos son atómicos |
| ERR-01 v1.0 | cumplimiento: conflicto/permiso/validación usan mensajes seguros |
| FRM-01 v1.1 | cumplimiento: motivo obligatorio y preservado ante error |
| LOD-01 v1.0 | cumplimiento: pending bloquea repetición y éxito espera durabilidad |
| NUM-01 v1.1 | no aplica: el slice no modifica montos |
| A11Y-01 v1.1 | cumplimiento automatizado acotado; runtime manual sigue como gate |

No se registra excepción.

## 4. Allowlist

- `docs/specs/0226-nomina-anulacion-finiquito-gobernada/spec.md`
- `docs/specs/README.md` generado
- `docs/architecture/module-sdd-map.md`
- `docs/governance/README.md`
- `docs/governance/reviews/payroll-r3-settlement-void-implementation-2026-07-31.md`
- `app/studio/(app)/nomina/actions.ts`
- `app/studio/(app)/nomina/_components/FiniquitoDetalle.tsx`
- `app/studio/(app)/nomina/_components/__tests__/FiniquitoDetalle.test.tsx`
- `app/studio/(app)/nomina/__tests__/settlement-void-action.test.ts`
- `lib/studio/rbac.ts`
- `lib/studio/rbac.test.ts`
- `supabase/migrations/0316_nomina_settlement_void_governance.sql`
- `supabase/tests/0316_nomina_settlement_void_governance.test.sql`
- `e2e/nomina-settlement-void.spec.ts`

## 5. Aceptación

- admin del tenant puede anular con motivo y request ref válidos;
- `accounting`, anon, una membresía desactivada y otro tenant fallan sin mutar;
- doble llamada con la misma referencia devuelve replay y no duplica eventos;
- una referencia distinta contra una fila ya anulada devuelve conflicto;
- asiento y finiquito cambian juntos y conservan el vínculo;
- ambos eventos comparten actor, motivo y correlación;
- fallo forzado de auditoría revierte ambas filas;
- actualización lifecycle/totales directa y mutación de renglones sellados fallan;
- click en `Anular` no muta; el diálogo exige motivo y conserva error/input;
- pending impide cancelar o repetir; éxito sólo ocurre tras respuesta durable;
- pruebas focalizadas, contrato SQL, E2E autorizado y gates de gobernanza pasan.

## 6. Cloud y rollback

La migration se prepara y valida localmente antes de cualquier aplicación.
Producción se aplica por basename exacto, una vez que el commit esté publicado.
El rollback operativo es apagar el caller y corregir forward-only: no se
restaura el CRUD directo ni se borra evidencia histórica.

## 7. Resultado local

La implementación local quedó verificada con 32 pruebas focalizadas, 42
contratos SQL, typecheck, reconstrucción de 303 migrations, aislamiento de 219
tablas, documentación y gates de gobernanza. La aplicación Cloud y el E2E
autenticado se registran como gates posteriores, sin alterar este contrato.
