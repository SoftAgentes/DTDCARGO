# Cierre técnico de SDD-0118 y SDD-0172

| Control | Valor |
|---|---|
| Revisión | REV-AUD-039 |
| Fecha | 2026-07-30 |
| SDD | [SDD-0118](../../specs/0118-seed-migrations-idempotentes/spec.md) · [SDD-0172](../../specs/0172-tenant-fixtures-lifecycle/spec.md) |
| Producción | `0284`–`0288` aplicadas individualmente |
| Resultado | replay, seed, E2E, verificación y teardown terminal aprobados |

## 1. Recibos individuales de Producción

El runbook de aplicación se ejecutó una migración por vez. El ledger de
Producción registra:

| Versión | Basename exacto |
|---|---|
| `20260730160209` | `0284_repair_pin_search_path_split_history` |
| `20260730160939` | `0285_repair_revoke_anon_split_history` |
| `20260730161446` | `0286_repair_tenant_acl_split_history` |
| `20260730162532` | `0287_repair_replay_gate_split_history` |
| `20260730165010` | `0288_finalize_replay_gate_split_history` |

Cada aplicación tuvo preflight metadata-only, postcondiciones sobre versión,
nombre, cardinalidad y digest, y advisors posteriores. El inventario final de
advisors permaneció en security 125 (`INFO` 5, `WARN` 120) y performance 546
(`INFO` 430, `WARN` 116), sin drift atribuible a estas reparaciones ledger-only.

No se ejecutó DDL histórico sobre Producción, DML de negocio, lectura de PII,
Auth, Storage o Vercel.

## 2. Recorrido de replay

Los entornos posteriores a R15 se crearon siempre sin datos de Producción y se
destruyeron completos ante cualquier fallo:

| Ronda | Resultado |
|---|---|
| R16–R18 | revelaron, en orden, los splits de `0276`, `0279` y de los gates de reparación; produjeron `0285`–`0287` |
| R19 | fallo de aprovisionamiento del control plane; sin ledger ni seed |
| R20 | demostró que `0280`–`0286` también se materializaban fragmentadas y produjo `0288` |
| R21–R22 | replay de 293 entradas y seed verdes; el E2E detectó dos supuestos inválidos del harness |
| R23–R27 | replay verde; fallos operativos fail-closed de credencial efímera, IPv4/IPv6, variable server-side y lock local |
| R28 | recorrido funcional completo; la verificación intentó leer auditoría con `service_role`, contrario al ACL append-only |
| R29 | replay, seed, E2E y verificación integral verdes |

No se reintentó un seed sobre el mismo entorno, no se borraron filas para
limpiar y no se reparó ningún branch con SQL ad hoc.

## 3. Evidencia final R29

| Campo | Valor |
|---|---|
| Nombre | `sdd-0172-r29-20260730` |
| `branch_id` | `d4df25d3-951e-47ca-af61-fe508b15e76a` |
| `project_ref` | `inxjipnsdccxdllfuudm` |
| Datos de Producción | no |
| Ledger remoto | 293 entradas |
| Última entrada | `20260730165010 · 0288_finalize_replay_gate_split_history` |
| Seed sintético | aprobado |
| E2E lifecycle comments | 1/1 aprobado |
| Fixture verificado | 1 tenant · 2 memberships · 4 eventos de auditoría |
| Cleanup DB | no ejecutado |

El E2E ejerció creación de comentario, picker real de mención, reacción,
soft-delete, deshacer, segundo soft-delete y restauración. Las relaciones y
los cuatro eventos append-only conservaron identidad y orden.

La lectura de `entity_audit_log` se realizó con un cliente
`authenticated`. No se amplió `SELECT` de `service_role`; ese rol conserva el
contrato de escritura append-only aprobado en `0267`.

## 4. Teardown terminal

El control plane eliminó exactamente el branch R29 y devolvió éxito. El
inventario posterior no contiene su `branch_id` ni su `project_ref`; conserva
únicamente:

```text
main · xpfuzqombmjmxvprjgmi · ACTIVE_HEALTHY
```

No quedaron procesos Next del recorrido ni proyectos efímeros activos.

## 5. Gates locales de cierre

| Gate | Resultado |
|---|---|
| TypeScript | verde |
| Lint | 0 errores · 174 warnings preexistentes |
| Vitest | 317 archivos · 4.148 pruebas aprobadas |
| Build | verde |
| Docs | `docs:check` verde |
| Gobernanza | 27 políticas aprobadas · cápsula vigente |
| Componentes | 3 fuentes válidas · agregado reproducible |
| SQL PostgreSQL 15 | 27/27 contratos · rollback total |
| SQL PostgreSQL 17 | 27/27 contratos · rollback total |
| Schema rebuild | 267 migraciones de schema + 17 sólo-ledger |
| Aislamiento | 219 tablas · 2 tenants sintéticos |
| Diff | `git diff --check` verde |

`pnpm verify` terminó verde con `VERIFY_SKIP_E2E=1`, escape documentado para
worktrees sin credenciales. No se conectó el Playwright general a Producción.
El recorrido autenticado que acepta SDD-0172 no fue omitido: se ejecutó contra
R29 con variables efímeras, aprobó 1/1 y precedió su teardown terminal.

## 6. Veredicto técnico

REV-AUD-039 aprueba el cierre de SDD-0118 y SDD-0172:

- el historial remoto reproduce el schema completo desde cero;
- el seed sintético está bloqueado fuera de un project ref efímero;
- el lifecycle E2E respeta RLS y el ACL append-only;
- la verificación no usa DML de cleanup;
- el teardown terminal está demostrado por el control plane.

CMP-01 v1.1, el caso deprecated, D1, D2–D5, nuevos slices y PLG-P3 o
posteriores permanecen fuera de este gate.
