# Cierre técnico · SDD-0353 · contexto de correo de Cobranzas

Fecha: 2026-09-02

Rol: worker
Rama: `codex/saneamiento-integral`
Base auditada: `origin/main@2a2e81bf554dbe7bd4f05170847e8f02e988d320`
Commit: el commit que contiene este handoff

## Resultado

- Cobranzas dejó de consultar `clients.email` y `mail_logs` directamente.
- `collections_mail_context(uuid[])` deriva sólo las señales de las facturas
  solicitadas y nunca recibe un tenant del caller.
- La respuesta contiene invoice id, Shipping Mark, `has_email`, `complained` y
  fecha UTC del último recordatorio; no contiene email ni metadata.
- La función exige `accounting|admin`, tenant activo y máximo 1.000 ids.
- `mail_logs` queda visible directamente sólo a admin; `service_role` conserva
  envío, webhooks y health checks.

## Allowlist

- `lib/studio/collections/recordatorios-queries.ts`
- `lib/studio/collections/__tests__/recordatorios-queries.test.ts`
- `supabase/migrations/0410_collections_mail_context.sql`
- `supabase/tests/0410_collections_mail_context.test.sql`
- `docs/specs/0353-collections-mail-context/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-collections-mail-context-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Evidencia local

- Vitest focal: 1 archivo / 3 pruebas.
- TypeScript y ESLint: OK.
- `node scripts/run-sql-tests.mjs`: 151/151 contratos pasaron sobre PostgreSQL
  17 y terminaron en rollback total.
- `node scripts/check-schema-rebuild.mjs`: 407 migraciones; 389 aplicadas desde
  cero + 18 sólo-ledger; aislamiento multi-tenant verificado sobre 219 tablas y
  2 tenants.

## Gates externos

- La migración 0410 NO fue aplicada a Cloud o Producción.
- No hubo push, merge, deploy, escritura alojada ni lectura de PII.
- Aplicación futura: autorización específica que nombre
  `0410_collections_mail_context.sql` y ejecución individual mediante
  `docs/runbooks/aplicar-migraciones-prod.md`.
