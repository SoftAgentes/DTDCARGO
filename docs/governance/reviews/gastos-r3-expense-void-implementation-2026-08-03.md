# REV-SGE-058 — Implementación local R3 de anulación de Gastos

| Control | Valor |
|---|---|
| Fecha | 2026-08-03 |
| Base | `origin/main@b78a686336aedadc24cd7a508ae54d788f8c2243` |
| Carril | `codex/post-governance-10-slices` |
| SDD | SDD-0243 · `in-progress` |
| Módulo | Gastos · conserva `BE` |
| Flujo | `Anular gasto` · Studio y Móvil |
| Roles | `accounting` + `admin` |
| Migración | `0340_expense_void_governance` · sólo local |
| Resultado | implementación local verificada; Cloud/runtime pendientes |

## 1. Recorrido implementado

| Capa | Evidencia durable del carril | Resultado |
|---|---|---|
| UI Studio | `ExpenseRowActions.tsx:15,191-210` | `ConfirmDialog` canonical, motivo, consecuencia, hold y alternativa accesible |
| Action Studio | `actions.ts:326-349` | validación, capability y respuesta durable del RPC |
| UI Móvil | `MobileErpClient.tsx:3178-3197` | mismo diálogo; acción visible sólo para `accounting`/`admin` |
| Action Móvil | `app/m/erp/actions.ts:362-385` | mismo validador y RPC; sin cleanup de Storage en la anulación |
| Validación/librería | `expense-void.ts:15-48` | UUID, motivo, request ref y resultados cerrados `voided/replayed` |
| RBAC | `rbac.ts:213`; `rbac.test.ts:210-219` | `void_expense = accounting`; `admin` continúa implícito |
| PostgreSQL | `0340_expense_void_governance.sql:63-280` | guard exclusivo, locks, período, tenant/rol y transacción única |
| Auditoría | `0340_expense_void_governance.sql:180-249` | asiento y gasto se anulan con motivo y correlación dentro de la transacción |
| Pruebas SQL | `0340_expense_void_governance.test.sql:190-381` | éxito, replay, roles, tenant, período, rollback, ACL y `search_path` |
| Pruebas UI | `ExpenseRowActions.test.tsx:54-113`; `MobileErpClient.expense-void.test.tsx:80-105` | foco, no mutación al abrir, motivo, error recuperable y capability |
| E2E | `e2e/gastos-expense-void.spec.ts:7-59` | smoke autenticado preparado; 6 casos omitidos por ausencia de fixture |

La anulación no borra `receipt_path`, `receipt_document_id` ni objetos de
Storage. Los removals que permanecen en las actions corresponden a rollback de
uploads o reemplazos de edición, no al recorrido `voidExpenseAction`.

## 2. Clasificación por política

| Política | Clasificación del slice local | Evidencia |
|---|---|---|
| SGE-00 v1.0 | cumplimiento | permiso, consecuencia, período, atomicidad y respuesta verdadera |
| MP-01 v1.1 | cumplimiento | P3/R3, motivo y rastro; original y recibo preservados |
| BTN-01 v1.1 | cumplimiento | verbo `Anular` y decisión destructiva aislada |
| HTD-01 v1.0 | cumplimiento | hold-to-confirm con alternativa accesible |
| AUD-01 v1.0 | cumplimiento | gasto, asiento y auditoría confirman o revierten juntos |
| AUD-02 v1.0 | no aplica | no cambia consulta, exportación ni retención de logs |
| ERR-01 v1.0 | cumplimiento | errores seguros y recuperables; éxito sólo tras `voided/replayed` |
| FRM-01 v1.1 | cumplimiento | motivo obligatorio validado en cliente y servidor |
| LOD-01 v1.0 | cumplimiento | pending evita repetición y espera confirmación durable |
| A11Y-01 v1.1 | cumplimiento local | teclado/foco cubiertos por componentes; smoke autenticado pendiente |
| CMP-01 v1.1 | cumplimiento | reutiliza `ConfirmDialog`; cero componentes nuevos |
| UPL-01 v1.0 | no aplica | no carga, reemplaza ni elimina archivos |
| NUM-01 v1.1 | no aplica | no modifica montos ni precisión |
| IA-01 v1.0 | no aplica | no interviene IA |

No se registra excepción. El cumplimiento se limita al flujo modificado y no
se eleva a regla bloqueante para otros módulos.

## 3. Pruebas ejecutadas

| Gate | Resultado |
|---|---|
| Suite SQL desechable | 70/70 verde, incluido `0340` |
| Vitest focalizado | 46/46 verde en cuatro archivos |
| TypeScript | verde |
| ESLint focalizado | cero errores; E2E conserva el ignore esperado |
| Playwright focalizado | 6 omitidos por falta de fixture autenticado ficticio |
| `governance:check` | 27 políticas; cápsula vigente |
| `components:check` | 4 fuentes; cero rutas rotas |
| PLG-01 | read-only; 27 políticas; 4 componentes; 7/7 |
| `docs:check` | verde con índice de 233 specs regenerado |
| `pnpm verify` | TODO VERDE; configuración pública Supabase inyectada sólo al proceso |
| Suite completa Vitest dentro de `verify` | 396 archivos y 4683 pruebas verdes |
| Schema rebuild | 333 migraciones; 316 aplicadas, 17 sólo-ledger; aislamiento multi-tenant verde |
| E2E general | 72 verdes y 18 omitidos; un retry recuperó el caso preexistente CBM móvil |
| Build | verde; 155 páginas generadas |
| `git diff --check` | verde |

`pnpm verify` cerró verde de extremo a extremo. Para el runner E2E se inyectaron
la URL pública y la anon key de Supabase únicamente en el proceso transitorio;
no se creó ni modificó `.env.local`. El gate interno `migrations-applied` se
omitió por ausencia de service-role key y se compensó con el preflight real
metadata-only descrito abajo. Las seis omisiones del smoke SDD-0243 —dos casos
en tres navegadores— se deben a que no existe un fixture autenticado ficticio
con rol y gasto elegible; no se convierten en evidencia durable ni en defecto
funcional. La primera pasada encontró una intermitencia preexistente en el
panel CBM móvil y el retry canónico terminó verde.

## 4. Preflight Cloud metadata-only

El proyecto `xpfuzqombmjmxvprjgmi` confirmó sin leer filas de negocio:

- `expenses`, `journal_entries`, catálogo y log AUD-01 presentes;
- `append_audit_event`, cierre contable y D2 presentes;
- trigger D2 de asientos habilitado;
- RPC, guard y trigger de `0340` todavía ausentes;
- `0316` presente una vez y `0326`–`0329` presentes cuatro veces en ledger;
- `0340_expense_void_governance` ausente del ledger.

No se aplicó la migración, no se modificó Cloud y no se ejecutaron advisors de
postflight porque todavía no ocurrió DDL.

## 5. E5 y cobertura

El preflight agregado del 2026-08-03 evaluó los cutoffs máximos:

| Clase | Cutoff UTC | Tenants con elegibles | Eventos elegibles |
|---|---:|---:|---:|
| `operational` | `2021-08-03 11:38:26.854423+00` | 0 | 0 |
| `security` | `2024-08-03 11:38:26.862433+00` | 0 | 0 |

`audit_retention_batches` y `audit_retention_batch_events` continúan en cero.
No se creó dry-run, lote ni evento E5.

Gastos conserva `BE`: existe evidencia durable local, pero no aplicación Cloud
ni smoke autenticado runtime. Por eso no se modifica la baseline de 31 `VA`,
18 `BE` y ocho `NA+BE`. Los ocho `NA+BE` no se abren dentro de este slice.

## 6. Gates externos preservados

- Producción requiere autorización individual por basename exacto
  `0340_expense_void_governance`.
- Push/integración requiere el literal `cerrar`.
- Preview/deploy y smoke autenticado conservan su gate y fixture propios.
- Adjuntos, antivirus, retención, restore drill y limpieza de worktrees no se
  modificaron.
