# Cierre técnico · SDD-0354 · facturación anual minimizada

Fecha: 2026-09-02

Rol: worker

Estado: CERRADO LOCALMENTE · MIGRACIÓN ALOJADA PENDIENTE

## Resultado

- `clientAnnualBilling()` dejó de leer filas de `invoices`.
- `studio_client_annual_billing(date)` deriva el tenant del principal, exige
  acceso efectivo a Fidelización, CRM o Reportes y devuelve únicamente Shipping
  Mark + USD agregado de los últimos 12 meses. El cierre correctivo de overrides
  está en `2026-09-02-client-annual-billing-overrides-close.md`.
- La fecha del caller queda acotada a `current_date ± 1 día`; no habilita
  consultas históricas arbitrarias.
- Normalización, estados billable, fallback de fecha, soft-delete y aislamiento
  se calculan en PostgreSQL. `invoices_team_select` permanece temporalmente para
  los otros consumidores que aún deben migrarse.

## Archivos

- `lib/studio/fidelizacion/queries.ts`
- `lib/studio/fidelizacion/__tests__/queries.test.ts`
- `lib/studio/reports/__tests__/queries.test.ts`
- `supabase/migrations/0411_client_annual_billing_facade.sql`
- `supabase/tests/0411_client_annual_billing_facade.test.sql`
- `docs/specs/0354-client-annual-billing-facade/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-client-annual-billing-facade-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Evidencia ejecutada

- Vitest focal: 2 archivos / 40 pruebas, todas verdes.
- TypeScript: verde.
- ESLint: verde.
- SQL: 152/152 contratos, rollback total.
- Rebuild: 408 migraciones; 390 desde cero + 18 sólo-ledger; aislamiento en
  219 tablas y 2 tenants.
- `docs:check`, `sdd:check`, `governance:check`, `components:check` y
  `git diff --check`: verdes al cierre.

## Gates no cruzados

- `0411_client_annual_billing_facade.sql` no se aplicó a Cloud/Producción.
- No hubo push, merge a `main`, deploy, cambios de secretos ni lectura de PII.
- La policy SELECT general de `invoices` no se endureció en este slice.

## Siguiente slice

Crear una fachada mínima para el saldo agregado que usa Conversaciones. Después
corresponden el resumen por orden de venta y, sólo al final, el cierre del
SELECT directo de `invoices` con un contrato de consumidores permitidos.
