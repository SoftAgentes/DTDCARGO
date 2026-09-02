# Cierre correctivo · SDD-0354 · permisos efectivos

Fecha: 2026-09-02

Rol: worker

Estado: CERRADO LOCALMENTE · SIN PUSH NI CLOUD

## Hallazgo y corrección

La primera versión local de 0411 comprobaba sólo los roles predeterminados.
SDD-0252 permite overrides por rol para Fidelización y CRM, por lo que esa
comprobación podía ignorar tanto una concesión como una revocación explícita.

La RPC ahora exige acceso efectivo a cualquiera de sus tres consumidores:

- Reportes: `accounting|admin`, candado no editable.
- Fidelización: override del tenant/rol, o default `commercial|support`.
- CRM (`kommo`): override del tenant/rol, o default `commercial`.

Una membresía ausente/desactivada siempre bloquea. Los overrides se consultan
desde el tenant derivado; no hay tenant arbitrario ni lectura de PII. 0411 sigue
sin publicar/aplicar, por eso se corrigió su archivo antes del gate alojado.

## Allowlist de este commit

- `supabase/migrations/0411_client_annual_billing_facade.sql`
- `supabase/tests/0411_client_annual_billing_facade.test.sql`
- `docs/specs/0354-client-annual-billing-facade/spec.md`
- `.agents/handoffs/2026-09-02-client-annual-billing-facade-close.md`
- `.agents/handoffs/2026-09-02-client-annual-billing-overrides-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`

## Verificación

- 152/152 contratos SQL con rollback total, incluidos grant, revoke e
  aislamiento de overrides por tenant.
- Rebuild de 408 migraciones: 390 desde cero + 18 sólo-ledger; 219 tablas y
  2 tenants aislados.
- Docs, numeración, gobernanza, componentes y diff: verdes.
- No cambia TypeScript; conserva la evidencia focal de 40 pruebas del cierre
  anterior.

## Pendiente externo

La migración 0411 no se aplicó a Cloud/Producción y la rama no se ha publicado.
