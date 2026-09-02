# Cierre técnico · SDD-0350 · RBAC de escritura de facturas

Fecha: 2026-09-02

Rol: worker
Rama: `codex/saneamiento-integral`
Base auditada: `origin/main@2a2e81bf554dbe7bd4f05170847e8f02e988d320`
Commit: el commit que contiene este handoff

## Resultado

- La policy histórica `invoices by tenant` deja de gobernar todas las acciones.
- El SELECT interno sigue limitado por tenant y se conserva por compatibilidad.
- INSERT/UPDATE exigen membresía activa `accounting` o `admin` en el tenant.
- `authenticated` pierde DELETE físico; `service_role` conserva el camino
  privilegiado ya existente para jobs y RPCs controladas.
- La policy de lectura del Portal no se elimina ni se reemplaza.

La lectura tenant-wide de facturas permanece como no conformidad acotada: los
consumidores comerciales deben migrar primero a RPCs agregadas/minimizadas. Ese
cambio requiere otro SDD y no se mezcló con este slice de integridad.

## Allowlist

- `supabase/migrations/0407_invoices_write_rbac.sql`
- `supabase/tests/0407_invoices_write_rbac.test.sql`
- `docs/specs/0350-invoices-write-rbac/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-invoices-write-rbac-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Evidencia local

- `node scripts/run-sql-tests.mjs`: 148/148 contratos pasaron sobre PostgreSQL
  17 y terminaron en rollback total.
- `node scripts/check-schema-rebuild.mjs`: 404 migraciones; 386 aplicadas desde
  cero + 18 sólo-ledger; aislamiento multi-tenant verificado sobre 219 tablas y
  2 tenants.
- El contrato 0407 prueba roles no financieros, membresía desactivada, frontera
  de tenant, escrituras legítimas de accounting/admin, revocación de DELETE y
  preservación de la policy del Portal.

## Gates externos

- La migración 0407 NO fue aplicada a Cloud o Producción.
- No hubo push, merge, deploy, escritura alojada ni lectura de PII.
- Aplicación futura: autorización específica que nombre
  `0407_invoices_write_rbac.sql` y ejecución individual mediante
  `docs/runbooks/aplicar-migraciones-prod.md`.
