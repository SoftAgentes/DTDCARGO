---
sdd: "0243"
title: "Anulación gobernada de gastos"
status: in-progress
author: "Sam (founder) + Codex"
created: 2026-08-03
updated: 2026-08-03
supersedes: null
superseded_by: null
related: ["0039", "0077", "0079", "0080", "0174", "0224"]
confidencialidad: interno
---

# SDD-0243 — Anulación gobernada de gastos

## 1. Objetivo

Convertir el flujo R3 visible `Eliminar gasto` en `Anular gasto`, preservando el
registro financiero, neutralizando su asiento y creando auditoría obligatoria
en una sola transacción PostgreSQL.

El slice cubre exclusivamente el dominio Gastos y sus dos consumidores reales:
Studio `/studio/gastos` y Móvil `/m/erp`. No certifica el módulo completo ni
modifica creación, edición, recibos, antivirus, retención, restore drill, E5 u
otros módulos.

## 2. Evidencia de partida

REV-SGE-057 comprobó que el flujo actual:

- usa confirmaciones inline y el verbo `Eliminar`;
- recibe únicamente `id`, sin motivo ni referencia idempotente;
- marca `expenses.deleted_at` y luego intenta anular `journal_entries` en un
  segundo paso best-effort;
- devuelve éxito aunque falle la anulación contable;
- no crea un evento AUD-01 para el gasto;
- tiene un segundo consumidor móvil que además intenta borrar el recibo de
  Storage después de la mutación.

Estas son brechas comprobadas del flujo. La clasificación histórica `BE` no se
usa como sustituto de esa evidencia.

## 3. Decisión aprobada

- La acción visible se llama `Anular gasto`; no promete eliminación.
- La permanencia es P3/R3: el gasto, su código y sus referencias se conservan.
- `void_expense` se propone para `accounting` y `admin`; el RPC vuelve a
  verificar rol, membresía activa, tenant, estado y período contable.
- `void_expense_governed(uuid,text,text)` bloquea la fila, exige motivo de
  4–1000 caracteres y una referencia idempotente válida.
- El RPC registra la anulación del gasto, neutraliza todo asiento vivo asociado
  y persiste los eventos obligatorios dentro de la misma transacción.
- La misma referencia puede reintentarse como replay; otra referencia contra un
  gasto ya anulado devuelve conflicto.
- CRUD directo no puede realizar la transición gobernada.
- Studio y Móvil reutilizan `ConfirmDialog` canonical con consecuencia
  explícita, motivo obligatorio, foco seguro, pending real y presión sostenida
  con alternativa accesible.
- El caller solo anuncia éxito después de recibir `voided` o `replayed`.
- `receipt_path` y `receipt_document_id` se conservan sin tocar Storage. Su
  antivirus, retención, disposición y restore drill permanecen bajo SDD-0224 y
  sus gates externos.

La propuesta no crea un movimiento financiero nuevo: conserva el patrón
vigente de neutralización lógica del asiento (`status='anulado'`). Cualquier
decisión futura de contra-asiento contable requiere otro SDD.

## 4. Clasificación por política

| Política | Clasificación objetivo del slice |
|---|---|
| SGE-00 v1.0 | cumplimiento: consecuencia, tenant, permiso, período, atomicidad y verdad del éxito |
| MP-01 v1.1 | cumplimiento P3/R3: original preservado, motivo, permiso especial y rastro |
| BTN-01 v1.1 | cumplimiento: verbo `Anular`, decisión final explícita y destructiva aislada |
| HTD-01 v1.0 | cumplimiento: presión sostenida opcional elegida para este R3, con alternativa accesible |
| AUD-01 v1.0 | cumplimiento: gasto, asiento y eventos fallan o confirman juntos |
| AUD-02 v1.0 | no aplica: no cambia consulta, retención, exportación ni acceso a logs |
| ERR-01 v1.0 | cumplimiento: permiso, no encontrado, conflicto, validación y fallo inesperado usan copy seguro y recuperable |
| FRM-01 v1.1 | cumplimiento: motivo obligatorio se conserva ante error |
| LOD-01 v1.0 | cumplimiento: pending bloquea repetición y el éxito espera resultado durable |
| A11Y-01 v1.1 | cumplimiento condicionado a pruebas automatizadas y smoke autenticado por rol |
| CMP-01 v1.1 | cumplimiento: reutiliza `ConfirmDialog` canonical y no crea componentes |
| UPL-01 v1.0 | no aplica: el slice no carga, reemplaza ni elimina archivos |
| NUM-01 v1.1 | no aplica: no modifica montos ni precisión |
| IA-01 v1.0 | no aplica: no interviene IA |

No se propone excepción ni una política nueva.

## 5. Allowlist exacta de implementación

- `docs/specs/0243-gastos-anulacion-gobernada/spec.md`
- `docs/specs/README.md`
- `docs/architecture/module-sdd-map.md`
- `docs/governance/README.md`
- `docs/governance/reviews/post-governance-10-gastos-r3-audit-2026-08-03.md`
- `docs/governance/reviews/gastos-r3-expense-void-implementation-2026-08-03.md`
- `.agents/handoffs/2026-08-03-post-governance-10-sdd-0243-close.md`
- `app/studio/(app)/gastos/page.tsx`
- `app/studio/(app)/gastos/actions.ts`
- `app/studio/(app)/gastos/_components/GastosClient.tsx`
- `app/studio/(app)/gastos/_components/ExpenseRowActions.tsx`
- `app/studio/(app)/gastos/_components/ExpenseRowActions.test.tsx`
- `app/m/erp/actions.ts`
- `app/m/erp/_components/MobileErpClient.tsx`
- `app/m/erp/_components/MobileErpClient.expense-void.test.tsx`
- `lib/i18n/es-VE/expenses.ts`
- `lib/i18n/zh-CN/expenses.ts`
- `lib/studio/expense-void.ts`
- `lib/studio/__tests__/expense-void.test.ts`
- `lib/studio/rbac.ts`
- `lib/studio/rbac.test.ts`
- `supabase/migrations/0340_expense_void_governance.sql`
- `supabase/tests/0340_expense_void_governance.test.sql`
- `e2e/gastos-expense-void.spec.ts`

`0340` continuó libre al revalidar 102 refs con `pnpm sdd:next` el 2026-08-03.
El archivo local `0340_expense_void_governance.sql` materializa el correlativo
en este carril, pero no está integrado ni autorizado para Producción. Si otra
rama alcanza `main` con el mismo número antes de la integración, se renumera
este trabajo no aplicado.

## 6. Pruebas de aceptación

### Contrato SQL

- `accounting` y `admin` del tenant pueden anular un gasto vivo con motivo y
  request ref válidos;
- `warehouse`, `operations`, anon, membresía inactiva y otro tenant fallan sin
  mutar;
- período cerrado, gasto inexistente y gasto ya anulado con otra referencia
  fallan de forma cerrada;
- repetir la misma referencia devuelve replay sin duplicar eventos;
- gasto y asiento cambian juntos y conservan `expense_code`, `expense_id`,
  `receipt_path` y `receipt_document_id`;
- los eventos comparten actor, motivo, tenant y correlación;
- fallo forzado del writer de auditoría revierte gasto y asiento;
- el `UPDATE` directo de la transición queda rechazado;
- anon no tiene `EXECUTE`, `search_path` queda vacío y los grants son mínimos.

### UI y acciones

- abrir `Anular gasto` no muta;
- el diálogo nombra el código y explica que se conserva el registro y se
  neutraliza el asiento;
- Cancelar recibe foco inicial; teclado, Escape, foco restaurado, zoom 200 % y
  viewport móvil permiten completar o abandonar la tarea;
- motivo vacío no envía; el server vuelve a validarlo;
- pending impide cancelar y repetir;
- un error permanece en el diálogo, conserva el motivo y ofrece recuperación;
- éxito se muestra solo con resultado durable y la fila sale de la vista activa;
- Studio y Móvil consumen el mismo contrato y no ejecutan cleanup de Storage.

### Gates locales

- pruebas Vitest focalizadas;
- contrato SQL focalizado y suite SQL completa;
- `pnpm typecheck`, `pnpm lint`, `pnpm governance:check`,
  `pnpm components:check`, `pnpm docs:check`, `pnpm verify`, build,
  PLG-01 7/7 y `git diff --check`.

El smoke autenticado se ejecuta con fixture ficticio por rol y sin PII. Cloud,
Preview, Producción y la migración conservan autorizaciones separadas.

## 7. Gates y rollout

1. Aprobar esta propuesta y confirmar `void_expense = accounting + admin`.
2. Revalidar los correlativos SDD/migración contra todas las refs.
3. Implementar solo el allowlist y verificar localmente.
4. Publicar código sin aplicar migraciones.
5. Abrir el gate nominal únicamente para el basename autorizado de la migración.
6. Ejecutar postflight de objeto, ledger, ACL, triggers, `search_path`, auditoría
   y advisors.
7. Desplegar el caller compatible y ejecutar smoke autenticado por rol.
8. Actualizar cobertura de Gastos de `BE` a `VA` solo con recibo durable local,
   Cloud y runtime suficiente.

No se abre E5 salvo que un preflight futuro devuelva eventos elegibles. No se
promueve ningún `NA+BE` dentro de este SDD.
