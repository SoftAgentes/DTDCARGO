---
sdd: 0352
title: Aplicar RBAC financiero a conciliación bancaria
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0040
  - SDD-0085
  - SDD-0105
  - SDD-0139
confidencialidad: interno
---

# SDD-0352 — RBAC financiero para conciliación bancaria

> **Nota de importación — 2026-09-10; actualizada el 2026-09-11.** Esta spec entró a `main` desde
> la PR #21 con su contenido original, `status: done` incluido. Su migración
> `0409_bank_reconciliation_rbac` **fue APLICADA a producción el 2026-09-11** con OK nominal de
> Sam (ledger `20260911111907 / 0409_bank_reconciliation_rbac`) y se verificó contra el objeto;
> el registro y la vuelta atrás están en `.agents/handoffs/0409-aplicacion-prod-20260911.md`.

## Estado real

Contabilidad y sus acciones de conciliación están restringidas a `accounting`
y `admin` en Next. Las tablas `bank_statements` y `bank_statement_lines`, sin
embargo, concedían CRUD directo por PostgREST a cualquier sesión
`authenticated` del tenant mediante policies `FOR ALL`.

## Decisión

1. Sustituir cada policy `FOR ALL` por SELECT/INSERT/UPDATE/DELETE separados.
2. Exigir tenant activo y rol `accounting|admin` en USING y WITH CHECK.
3. Conservar el CRUD vigente: la creación hace rollback manual del extracto si
   falla el lote de líneas y por eso necesita DELETE.
4. Fijar ACL explícita sin TRUNCATE, REFERENCES ni TRIGGER para authenticated.
5. Mantener intactos estados, matching, asientos, índices y triggers de
   integridad cross-tenant.

## Gate SGE-00 y AUD-01

- `cumplimiento` SGE-00.05: dinero exige rol también en la base.
- `cumplimiento` SGE-00.06/11: no-financieros y membresías desactivadas fallan
  cerrados; accounting/admin conservan el flujo esperado.
- `cumplimiento` AUD-D2: no aparece un write-path nuevo y se mantienen los
  triggers/índices de la conciliación existente.
- `no aplica`: visuales, accesibilidad, IA, notificaciones o cambio de estados.

## MP-01

- Extractos y movimientos bancarios: P3/R3 por su naturaleza financiera.
- Este slice no cambia retención ni agrega purga; sólo reduce sujetos capaces de
  leer y mutar. El DELETE preexistente queda limitado a accounting/admin para el
  rollback técnico del alta fallida.

## Allowlist exacta

- `supabase/migrations/0409_bank_reconciliation_rbac.sql`
- `supabase/tests/0409_bank_reconciliation_rbac.test.sql`
- `docs/specs/0352-bank-reconciliation-rbac/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-bank-reconciliation-rbac-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- Los cinco roles no financieros no leen, insertan, actualizan ni borran
  conciliación por PostgREST directo.
- Accounting desactivado y accounting de otro tenant no cruzan el gate.
- Accounting/admin activos conservan el CRUD del tenant.
- `service_role` conserva su acceso y authenticated no tiene TRUNCATE.
- Contrato SQL, rebuild, docs, numeración, gobernanza y diff pasan.

## Fuera de alcance

- Cambiar estados, matching, asientos, UI o acciones existentes.
- Rediseñar la retención de extractos o retirar el rollback compensatorio.
- Aplicar la migración a Cloud/Producción.
