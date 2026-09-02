# Cierre técnico · SDD-0351 · RBAC admin-only de Mailing

Fecha: 2026-09-02

Rol: worker
Rama: `codex/saneamiento-integral`
Base auditada: `origin/main@2a2e81bf554dbe7bd4f05170847e8f02e988d320`
Commit: el commit que contiene este handoff

## Resultado

- Plantillas, firmas, reglas, configuración, blacklist y programados ahora
  exigen rol `admin` activo y tenant coincidente en RLS.
- Las ACL de `authenticated` quedan limitadas al CRUD que usa cada tabla; no
  incluyen TRUNCATE ni privilegios incidentales.
- `mail_increment_template_metrics` y `mail_check_blacklist` quedan reservadas
  a `service_role`; los replays históricos ya no devuelven EXECUTE al equipo.
- El runtime privilegiado de envíos, webhooks y colas conserva su acceso.

`mail_logs` no cambia: Cobranzas lee quejas y últimos recordatorios por factura.
Cerrar esa lectura exige primero una RPC minimizada; se mantiene como deuda P1
explícita y no se mezcla con el slice administrativo.

## Allowlist

- `supabase/migrations/0408_mailing_admin_rbac.sql`
- `supabase/tests/0408_mailing_admin_rbac.test.sql`
- `docs/specs/0351-mailing-rbac/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-mailing-rbac-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Evidencia local

- `node scripts/run-sql-tests.mjs`: 149/149 contratos pasaron sobre PostgreSQL
  17 y terminaron en rollback total.
- `node scripts/check-schema-rebuild.mjs`: 405 migraciones; 387 aplicadas desde
  cero + 18 sólo-ledger; aislamiento multi-tenant verificado sobre 219 tablas y
  2 tenants.
- El contrato 0408 cubre no-admin, admin desactivado, admin de otro tenant,
  admin legítimo, matriz CRUD, ausencia de TRUNCATE y las dos RPC internas.

## Gates externos

- La migración 0408 NO fue aplicada a Cloud o Producción.
- No hubo push, merge, deploy, escritura alojada ni lectura de PII.
- Aplicación futura: autorización específica que nombre
  `0408_mailing_admin_rbac.sql` y ejecución individual mediante
  `docs/runbooks/aplicar-migraciones-prod.md`.
