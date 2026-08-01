# REV-SGE-031 — Implementación R3 de anulación gobernada de finiquito

| Control | Valor |
|---|---|
| Fecha | 2026-07-31 |
| SDD | [SDD-0226](../../specs/0226-nomina-anulacion-finiquito-gobernada/spec.md) |
| Hallazgo origen | [REV-SGE-030](payroll-r3-settlement-void-audit-2026-07-31.md) |
| Superficie | Studio ERP · Nómina y RRHH |
| Flujo | `finiquito confirmado → anulado` |
| Riesgo | R3 / P3 |
| Resultado local | aprobado |

## 1. Brechas cerradas

| Hallazgo | Cierre verificable |
|---|---|
| PAY-R3-001 | `Anular` sólo abre `ConfirmDialog`; consecuencia, motivo y entidad aparecen antes de enviar. |
| PAY-R3-002 | capability `void_payroll_settlement` admin-only en UI/server y membresía DB activa. |
| PAY-R3-003 | actor y motivo humanos llegan a los eventos del asiento y del finiquito. |
| PAY-R3-004 | asiento, finiquito y eventos comparten una sola transacción PostgreSQL. |
| PAY-R3-005 | lifecycle/totales sellados y renglones confirmados no admiten CRUD directo. |
| PAY-R3-006 | `FOR UPDATE`, estado, affected-row guard y request ref eliminan éxito falso y deduplican replay. |
| PAY-R3-007 | contrato SQL, UI, RBAC, frontera Server Action y E2E Tier 3 quedaron definidos. |

El `journal_entry_id` permanece en el finiquito anulado. No se borra la fila ni
su desglose; el índice parcial existente permite generar un nuevo finiquito sin
destruir el anterior.

## 2. Contrato técnico

- `0316_nomina_settlement_void_governance` crea un RPC security-definer con
  `search_path=''`, ACL únicamente para `authenticated` y autorización interna
  admin/tenant;
- un advisory lock por request ref y `FOR UPDATE` por finiquito serializan
  doble ejecución y respuesta perdida;
- el trigger D2 del asiento y el evento explícito del finiquito comparten la
  correlación transaccional `d2:journal_entries:<id>:<txid>`;
- el request ref se conserva como metadata mínima para replay, sin PII;
- el writer de auditoría sigue siendo obligatorio: su falla revierte todo;
- accounting conserva lectura/edición ordinaria del módulo, pero no esta
  capability laboral R3.

## 3. UI y accesibilidad

La UI reutiliza `ConfirmDialog` canonical. Incluye foco seguro inicial,
`reasonRequired`, error persistente, pending no cancelable, presión sostenida
de 1,5 s y alternativa de checkbox + click. No añade tokens, colores,
tipografías o componentes nuevos.

La prueba automatizada verifica que el trigger no muta, el motivo vacío no
envía, el error conserva diálogo/input y pending bloquea cancelar/repetir. El
smoke autenticado, zoom 200 %, móvil, light/dark y lector permanecen como gate
runtime del programa de cobertura; no se inventan a partir de jsdom.

## 4. Evidencia local

- Vitest focalizado: 3 archivos, 32 pruebas verdes;
- ESLint focalizado: cero errores; el spec E2E está excluido por configuración;
- SQL PostgreSQL 17: 42/42 contratos con rollback total;
- schema rebuild: 303 migrations, 286 aplicadas y 17 sólo-ledger;
- aislamiento: 219 tablas y dos tenants de fixture;
- typecheck: verde;
- Cloud, Producción y deploy: todavía no ejecutados en este recibo local.

## 5. Clasificación

SGE-00, MP-01, BTN-01, HTD-01, AUD-01, ERR-01, FRM-01 y LOD-01 pasan a
`cumplimiento` para esta acción. NUM-01 es `no aplica`. A11Y-01 tiene
cumplimiento automatizado acotado y conserva evidencia manual/runtime
pendiente. No existe excepción.

Nómina continúa `BE` en LB-SGE-104: cerrar una acción no certifica las demás
acciones R3 del módulo.
