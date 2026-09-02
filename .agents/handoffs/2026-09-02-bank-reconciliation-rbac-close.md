# Cierre técnico · SDD-0352 · RBAC de conciliación bancaria

Fecha: 2026-09-02

Rol: worker
Rama: `codex/saneamiento-integral`
Base auditada: `origin/main@2a2e81bf554dbe7bd4f05170847e8f02e988d320`
Commit: el commit que contiene este handoff

## Resultado

- `bank_statements` y `bank_statement_lines` dejan de usar policies `FOR ALL`
  basadas sólo en tenant.
- SELECT/INSERT/UPDATE/DELETE exigen tenant activo y rol `accounting|admin`.
- El CRUD del flujo vigente se conserva, incluido DELETE para el rollback
  compensatorio si falla el lote inicial de movimientos.
- `authenticated` no obtiene TRUNCATE, REFERENCES ni TRIGGER; `service_role`
  conserva su acceso privilegiado.
- Estados, matching, asientos, índices y triggers no cambiaron.

## Allowlist

- `supabase/migrations/0409_bank_reconciliation_rbac.sql`
- `supabase/tests/0409_bank_reconciliation_rbac.test.sql`
- `docs/specs/0352-bank-reconciliation-rbac/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-bank-reconciliation-rbac-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Evidencia local

- `node scripts/run-sql-tests.mjs`: 150/150 contratos pasaron sobre PostgreSQL
  17 y terminaron en rollback total.
- `node scripts/check-schema-rebuild.mjs`: 406 migraciones; 388 aplicadas desde
  cero + 18 sólo-ledger; aislamiento multi-tenant verificado sobre 219 tablas y
  2 tenants.
- El contrato 0409 cubre cinco roles no financieros, accounting desactivado,
  accounting de otro tenant, accounting/admin legítimos, CRUD y ACL final.

## Gates externos

- La migración 0409 NO fue aplicada a Cloud o Producción.
- No hubo push, merge, deploy, escritura alojada ni lectura de PII.
- Aplicación futura: autorización específica que nombre
  `0409_bank_reconciliation_rbac.sql` y ejecución individual mediante
  `docs/runbooks/aplicar-migraciones-prod.md`.
